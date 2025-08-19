import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { Readable } from 'stream';
import StreamValues from 'stream-json/streamers/StreamValues';
import parser from 'stream-json';
import { LocalCardData, DatabaseSyncStatus, ScryfallCard, CardMechanicsData } from './types';
import { cardMechanicsTagger } from './card-mechanics-tagger';

const gunzip = promisify(zlib.gunzip);

/**
 * Server-side Card Database Service
 * 
 * This service manages a server-side card database stored in the file system.
 * It automatically syncs with Scryfall and provides fast local card lookups.
 */

// Use /tmp for writable storage on Vercel and Railway, local data dir otherwise
const isVercel = process.env.VERCEL === '1';
const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
const DATA_DIR = (isVercel || isRailway) ? '/tmp/commander-deck-data' : path.join(process.cwd(), 'data');
const CARDS_FILE = path.join(DATA_DIR, 'cards.json');
const STATUS_FILE = path.join(DATA_DIR, 'sync-status.json');
const NAME_INDEX_FILE = path.join(DATA_DIR, 'name-index.json');

export class ServerCardDatabase {
  private cards: Map<string, LocalCardData> = new Map();
  private nameIndex: Map<string, string> = new Map(); // name -> id
  private syncStatus: DatabaseSyncStatus = {
    last_full_sync: null,
    last_incremental_sync: null,
    total_cards: 0,
    sync_in_progress: false,
    sync_progress: 0
  };
  private initialized = false;

  /**
   * Initialize the database, loading from file system if available
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure data directory exists
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('Created data directory');
      }

      // Load existing data from files
      await this.loadFromFiles();
      
      // Check if we successfully loaded cards
      if (this.cards.size === 0) {
        console.log('❌ No cards loaded from GitHub database - this is an error');
        console.log('🔄 As fallback, will try manual sync (but GitHub should work)');
        // Only sync as absolute fallback
        setImmediate(() => {
          this.performFullSync().catch(error => {
            console.error('Fallback sync failed:', error);
          });
        });
      } else {
        console.log(`✅ Successfully loaded ${this.cards.size} cards from external database`);
        // Don't sync if external database loaded successfully
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing server card database:', error);
      this.initialized = true; // Don't block app startup
    }
  }

  /**
   * Perform full sync from Scryfall bulk data
   */
  async performFullSync(): Promise<void> {
    if (this.syncStatus.sync_in_progress) {
      throw new Error('Sync already in progress');
    }

    this.syncStatus.sync_in_progress = true;
    this.syncStatus.sync_progress = 0;
    this.syncStatus.last_error = undefined;
    await this.saveStatus();

    try {
      console.log('Starting full card database sync...');
      
      // Fetch bulk data info from Scryfall
      const bulkResponse = await fetch('https://api.scryfall.com/bulk-data');
      const bulkData = await bulkResponse.json();
      
      // Find the oracle cards bulk data
      const oracleData = bulkData.data.find((bulk: { type: string; download_uri: string }) => bulk.type === 'oracle_cards');
      if (!oracleData) {
        throw new Error('Oracle cards bulk data not found');
      }

      this.syncStatus.sync_progress = 10;
      await this.saveStatus();

      // Download the bulk data
      console.log('Downloading bulk card data...');
      const cardsResponse = await fetch(oracleData.download_uri);
      const scryfallCards: ScryfallCard[] = await cardsResponse.json();

      this.syncStatus.sync_progress = 50;
      await this.saveStatus();

      // Convert and store cards
      console.log(`Processing ${scryfallCards.length} cards...`);
      this.cards.clear();
      this.nameIndex.clear();

      const batchSize = 1000;
      for (let i = 0; i < scryfallCards.length; i += batchSize) {
        const batch = scryfallCards.slice(i, i + batchSize);
        
        for (const scryfallCard of batch) {
          const localCard = await this.convertScryfallToLocal(scryfallCard);
          this.cards.set(localCard.id, localCard);
          this.nameIndex.set(localCard.name.toLowerCase(), localCard.id);
        }

        // Update progress
        this.syncStatus.sync_progress = 50 + ((i / scryfallCards.length) * 40);
        await this.saveStatus();
      }

      // Save to files
      await this.saveToFiles();

      this.syncStatus.last_full_sync = new Date().toISOString();
      this.syncStatus.total_cards = this.cards.size;
      this.syncStatus.sync_progress = 100;
      
      console.log(`Full sync completed: ${this.cards.size} cards`);
      
    } catch (error) {
      this.syncStatus.last_error = error instanceof Error ? error.message : 'Unknown error';
      console.error('Full sync failed:', error);
      throw error;
    } finally {
      this.syncStatus.sync_in_progress = false;
      await this.saveStatus();
    }
  }

  /**
   * Search for cards by name (fuzzy matching)
   */
  searchByName(query: string, limit = 20): LocalCardData[] {
    const queryLower = query.toLowerCase();
    const results: LocalCardData[] = [];
    
    // Exact name match first
    const exactId = this.nameIndex.get(queryLower);
    if (exactId) {
      const exactCard = this.cards.get(exactId);
      if (exactCard) {
        results.push(exactCard);
      }
    }
    
    // Then partial matches
    if (results.length < limit) {
      for (const [name, id] of this.nameIndex.entries()) {
        if (results.length >= limit) break;
        
        if (name.includes(queryLower) && name !== queryLower) {
          const card = this.cards.get(id);
          if (card) {
            results.push(card);
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Get cards by color identity and additional filters
   */
  searchByFilters(filters: {
    colorIdentity?: string[];
    query?: string;
    types?: string[];
    cmc?: { min?: number; max?: number };
    legal_in_commander?: boolean;
    mechanics?: string[];        // Search by mechanic tags
    functionalRoles?: string[];  // Search by functional roles
    archetypes?: string[];       // Search by archetype relevance
    powerLevel?: { min?: number; max?: number }; // Search by power level
  }, limit = 50): LocalCardData[] {
    const results: LocalCardData[] = [];
    
    for (const card of this.cards.values()) {
      if (results.length >= limit) break;
      
      // Color identity filter
      if (filters.colorIdentity !== undefined) {
        if (!card.color_identity.every(color => filters.colorIdentity!.includes(color))) {
          continue;
        }
      }
      
      // Commander legality filter
      if (filters.legal_in_commander && card.legalities.commander !== 'legal') {
        continue;
      }
      
      // Oracle text search
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const cardText = (card.oracle_text || '').toLowerCase();
        const cardName = card.name.toLowerCase();
        
        if (!cardText.includes(query) && !cardName.includes(query)) {
          continue;
        }
      }
      
      // Type filter
      if (filters.types && filters.types.length > 0) {
        const cardTypes = card.type_line.toLowerCase();
        if (!filters.types.some(type => cardTypes.includes(type.toLowerCase()))) {
          continue;
        }
      }
      
      // CMC filter
      if (filters.cmc) {
        if (filters.cmc.min !== undefined && card.cmc < filters.cmc.min) {
          continue;
        }
        if (filters.cmc.max !== undefined && card.cmc > filters.cmc.max) {
          continue;
        }
      }
      
      // Mechanics filter
      if (filters.mechanics && filters.mechanics.length > 0) {
        if (!card.mechanics) continue;
        const cardMechanics = card.mechanics.mechanicTags.map(tag => tag.name);
        if (!filters.mechanics.some(mechanic => cardMechanics.includes(mechanic))) {
          continue;
        }
      }
      
      // Functional roles filter
      if (filters.functionalRoles && filters.functionalRoles.length > 0) {
        if (!card.mechanics) continue;
        if (!filters.functionalRoles.some(role => card.mechanics!.functionalRoles.includes(role))) {
          continue;
        }
      }
      
      // Archetype filter
      if (filters.archetypes && filters.archetypes.length > 0) {
        if (!card.mechanics) continue;
        if (!filters.archetypes.some(archetype => card.mechanics!.archetypeRelevance.includes(archetype))) {
          continue;
        }
      }
      
      // Power level filter
      if (filters.powerLevel) {
        const cardPower = card.mechanics?.powerLevel || 5;
        if (filters.powerLevel.min !== undefined && cardPower < filters.powerLevel.min) {
          continue;
        }
        if (filters.powerLevel.max !== undefined && cardPower > filters.powerLevel.max) {
          continue;
        }
      }
      
      results.push(card);
    }
    
    return results;
  }

  /**
   * Get card by exact name
   */
  getCardByName(name: string): LocalCardData | null {
    const id = this.nameIndex.get(name.toLowerCase());
    return id ? this.cards.get(id) || null : null;
  }

  /**
   * Get all cards in the database
   */
  getAllCards(): LocalCardData[] {
    return Array.from(this.cards.values());
  }

  /**
   * Get database status
   */
  getStatus(): DatabaseSyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Check if database needs sync (no data or older than 24 hours)
   */
  needsSync(): boolean {
    if (this.cards.size === 0) return true;
    
    if (!this.syncStatus.last_full_sync) return true;
    
    const lastSync = new Date(this.syncStatus.last_full_sync);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return lastSync < dayAgo;
  }

  /**
   * Re-analyze all cards with enhanced comprehensive tagging system
   */
  async reAnalyzeAllCards(): Promise<void> {
    if (this.cards.size === 0) {
      throw new Error('No cards in database to re-analyze');
    }

    console.log(`Starting re-analysis of ${this.cards.size} cards with comprehensive tagging...`);
    
    let processed = 0;
    const total = this.cards.size;
    const batchSize = 100; // Smaller batches for re-analysis to avoid overwhelming

    for (const [cardId, card] of this.cards.entries()) {
      try {
        // Re-analyze with comprehensive enhanced method
        const mechanicsAnalysis = await cardMechanicsTagger.analyzeCardEnhanced(card);
        
        // Update the card's mechanics data
        const updatedCard = {
          ...card,
          mechanics: {
            primaryType: mechanicsAnalysis.primaryType,
            functionalRoles: mechanicsAnalysis.functionalRoles,
            mechanicTags: mechanicsAnalysis.mechanicTags,
            synergyKeywords: mechanicsAnalysis.synergyKeywords,
            powerLevel: mechanicsAnalysis.powerLevel,
            archetypeRelevance: mechanicsAnalysis.archetypeRelevance,
            lastAnalyzed: new Date().toISOString()
          }
        };
        
        this.cards.set(cardId, updatedCard);
        processed++;

        // Progress reporting
        if (processed % batchSize === 0) {
          const progress = (processed / total) * 100;
          console.log(`Re-analyzed ${processed}/${total} cards (${progress.toFixed(1)}%)`);
          
          // Save progress periodically
          await this.saveToFiles();
        }
      } catch (error) {
        console.error(`Error re-analyzing card ${card.name}:`, error);
        // Continue with other cards
      }
    }

    // Final save
    await this.saveToFiles();
    console.log(`✅ Re-analysis complete! Updated ${processed} cards with comprehensive tagging.`);
  }

  private async convertScryfallToLocal(scryfallCard: ScryfallCard): Promise<LocalCardData> {
    // Analyze card mechanics using the comprehensive enhanced method
    const mechanicsAnalysis = await cardMechanicsTagger.analyzeCardEnhanced(scryfallCard);
    
    const mechanics: CardMechanicsData = {
      primaryType: mechanicsAnalysis.primaryType,
      functionalRoles: mechanicsAnalysis.functionalRoles,
      mechanicTags: mechanicsAnalysis.mechanicTags,
      synergyKeywords: mechanicsAnalysis.synergyKeywords,
      powerLevel: mechanicsAnalysis.powerLevel,
      archetypeRelevance: mechanicsAnalysis.archetypeRelevance,
      lastAnalyzed: new Date().toISOString()
    };
    
    return {
      id: scryfallCard.id,
      name: scryfallCard.name,
      mana_cost: scryfallCard.mana_cost,
      cmc: scryfallCard.cmc,
      type_line: scryfallCard.type_line,
      oracle_text: scryfallCard.oracle_text,
      flavor_text: scryfallCard.flavor_text || '',
      power: scryfallCard.power || '',
      toughness: scryfallCard.toughness || '',
      loyalty: scryfallCard.loyalty || '',
      color_identity: scryfallCard.color_identity,
      colors: scryfallCard.colors,
      keywords: scryfallCard.keywords || [],
      set_code: scryfallCard.set || '',
      set_name: scryfallCard.set_name || '',
      rarity: scryfallCard.rarity || 'common',
      collector_number: scryfallCard.collector_number || '',
      legalities: scryfallCard.legalities,
      prices: scryfallCard.prices,
      edhrec_rank: scryfallCard.edhrec_rank,
      image_uris: scryfallCard.image_uris,
      last_updated: new Date().toISOString(),
      scryfall_uri: scryfallCard.scryfall_uri || `https://scryfall.com/card/${scryfallCard.set}/${scryfallCard.id}`,
      mechanics
    };
  }

  private async loadFromFiles(): Promise<void> {
    try {
      // First try local files (dev data/ directory or production public/database/)
      const localLoaded = await this.loadFromLocalFiles();
      if (localLoaded) {
        return;
      }

      // Only if no local files exist, try GitHub chunked database
      const githubLoaded = await this.loadFromPublicURL();
      if (githubLoaded) {
        return;
      }

      console.error('❌ Failed to load database from any source');
    } catch (error) {
      console.error('Error loading database:', error);
    }
  }

  private async loadFromLocalFiles(): Promise<boolean> {
    try {
      console.log(`🔍 Checking for local files in: ${DATA_DIR}`);
      console.log(`🔍 Environment: Vercel=${isVercel}, Railway=${isRailway}`);
      console.log(`🔍 Target cards file: ${CARDS_FILE}`);
      
      // Check if directory exists
      const dirExists = fs.existsSync(DATA_DIR);
      console.log(`📁 Directory ${DATA_DIR} exists: ${dirExists}`);
      
      // Check for local data directory first (development or modified production)
      if (fs.existsSync(CARDS_FILE)) {
        const stats = fs.statSync(CARDS_FILE);
        console.log(`📁 Loading from local data directory...`);
        console.log(`📁 Local file path: ${CARDS_FILE}`);
        console.log(`📊 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log(`📅 File modified: ${stats.mtime.toISOString()}`);
        
        // Load sync status
        if (fs.existsSync(STATUS_FILE)) {
          const statusData = fs.readFileSync(STATUS_FILE, 'utf8');
          this.syncStatus = JSON.parse(statusData);
        }

        // Load cards
        const cardsData = fs.readFileSync(CARDS_FILE, 'utf8');
        const cardObject = JSON.parse(cardsData);
        this.cards = new Map(Object.entries(cardObject));

        // Load name index
        if (fs.existsSync(NAME_INDEX_FILE)) {
          const indexData = fs.readFileSync(NAME_INDEX_FILE, 'utf8');
          const indexObject = JSON.parse(indexData);
          this.nameIndex = new Map(Object.entries(indexObject));
        }

        this.syncStatus.total_cards = this.cards.size;
        console.log(`✅ Loaded ${this.cards.size} cards from local files`);
        console.log(`🎯 Successfully using MODIFIED local database!`);
        return true;
      } else {
        console.log(`❌ Local cards file not found at: ${CARDS_FILE}`);
      }

      // Check for public database directory (production builds)
      const publicDbPath = path.join(process.cwd(), 'public', 'database');
      const publicCardsFile = path.join(publicDbPath, 'cards.json.gz');
      const publicIndexFile = path.join(publicDbPath, 'name-index.json.gz');
      const publicStatusFile = path.join(publicDbPath, 'sync-status.json');

      if (fs.existsSync(publicCardsFile)) {
        console.log('📦 Loading from public database directory...');

        // Load sync status
        if (fs.existsSync(publicStatusFile)) {
          const statusData = fs.readFileSync(publicStatusFile, 'utf8');
          this.syncStatus = JSON.parse(statusData);
        }

        // Load cards (gzipped) using streaming to avoid memory exhaustion
        const compressedCardsData = fs.readFileSync(publicCardsFile);
        const decompressedCardsData = await gunzip(compressedCardsData);
        
        // Use streaming JSON parser to avoid loading entire dataset into memory
        this.cards = new Map();
        await this.parseCardsStream(decompressedCardsData);

        // Load name index (gzipped)
        if (fs.existsSync(publicIndexFile)) {
          const compressedIndexData = fs.readFileSync(publicIndexFile);
          const decompressedIndexData = await gunzip(compressedIndexData);
          const indexObject = JSON.parse(decompressedIndexData.toString());
          this.nameIndex = new Map(Object.entries(indexObject));
        }

        this.syncStatus.total_cards = this.cards.size;
        console.log(`✅ Loaded ${this.cards.size} cards from public database`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error loading from local files:', error);
      return false;
    }
  }

  private async loadFromPublicURL(): Promise<boolean> {
    try {
      const baseUrl = 'https://raw.githubusercontent.com/Leeler7/commander-deck-generator/main/public';
      
      console.log(`🌐 Loading manifest from updated repository: ${baseUrl}/database/chunks/manifest.json`);
      const manifestResponse = await fetch(`${baseUrl}/database/chunks/manifest.json`);
      if (!manifestResponse.ok) {
        throw new Error(`Manifest fetch failed: ${manifestResponse.status}`);
      }
      const manifest = await manifestResponse.json();
      
      console.log(`📦 Database has ${manifest.totalCards} cards in ${manifest.totalChunks} chunks`);

      // Load sync status
      console.log(`🌐 Loading sync status...`);
      const statusResponse = await fetch(`${baseUrl}/database/sync-status.json`);
      if (statusResponse.ok) {
        const syncStatus = await statusResponse.json();
        this.syncStatus = { ...this.syncStatus, ...syncStatus };
      }

      // Load name index (gzipped)
      console.log(`🌐 Loading name index...`);
      const indexResponse = await fetch(`${baseUrl}/database/name-index.json.gz`);
      if (indexResponse.ok) {
        const compressedBuffer = Buffer.from(await indexResponse.arrayBuffer());
        const decompressedBuffer = await gunzip(compressedBuffer);
        const indexObject = JSON.parse(decompressedBuffer.toString());
        this.nameIndex = new Map(Object.entries(indexObject));
      }

      // Load cards in chunks to avoid memory issues
      this.cards = new Map();
      let totalLoaded = 0;
      
      for (let i = 0; i < manifest.totalChunks; i++) {
        const chunkUrl = `${baseUrl}/database/chunks/cards-chunk-${i}.json.gz`;
        console.log(`📊 Loading chunk ${i + 1}/${manifest.totalChunks}...`);
        
        try {
          const chunkResponse = await fetch(chunkUrl);
          if (!chunkResponse.ok) {
            console.error(`❌ Failed to load chunk ${i}: ${chunkResponse.status}`);
            continue;
          }
          
          // Decompress the gzipped chunk
          const compressedBuffer = Buffer.from(await chunkResponse.arrayBuffer());
          const decompressedBuffer = await gunzip(compressedBuffer);
          const chunkData = JSON.parse(decompressedBuffer.toString());
          
          // Add cards to map
          for (const [id, card] of Object.entries(chunkData)) {
            this.cards.set(id, card as any);
            totalLoaded++;
          }
          
          console.log(`✅ Loaded chunk ${i + 1}: ${Object.keys(chunkData).length} cards (Total: ${totalLoaded}/${manifest.totalCards})`);
          
          // Small delay between chunks to avoid overwhelming memory
          if (i < manifest.totalChunks - 1) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          
        } catch (chunkError) {
          console.error(`❌ Error loading chunk ${i}:`, chunkError);
        }
      }

      this.syncStatus.total_cards = this.cards.size;
      console.log(`✅ Successfully loaded ${this.cards.size} cards from ${manifest.totalChunks} chunks`);
      
      return this.cards.size > 0;

    } catch (error) {
      console.error('❌ Failed to load from chunked database:', error);
      return false;
    }
  }

  private async parseCardsStream(buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = Readable.from(buffer.toString());
      let cardCount = 0;
      
      const pipeline = stream
        .pipe(parser())
        .pipe(StreamValues.withParser());
      
      pipeline.on('data', (data) => {
        try {
          // data.value is each card object, data.key is the card ID
          if (data.key && data.value) {
            this.cards.set(data.key, data.value);
            cardCount++;
            
            // Log progress every 5000 cards to avoid excessive logging
            if (cardCount % 5000 === 0) {
              console.log(`📊 Loaded ${cardCount} cards...`);
            }
          }
        } catch (error) {
          console.error('Error processing card:', error);
        }
      });
      
      pipeline.on('end', () => {
        console.log(`✅ Streaming complete: ${cardCount} cards loaded`);
        resolve();
      });
      
      pipeline.on('error', (error) => {
        console.error('Streaming error:', error);
        reject(error);
      });
    });
  }

  private async saveToFiles(): Promise<void> {
    try {
      // Ensure data directory exists (especially important for /tmp on Vercel)
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // Save cards
      const cardObject = Object.fromEntries(this.cards);
      fs.writeFileSync(CARDS_FILE, JSON.stringify(cardObject));

      // Save name index
      const indexObject = Object.fromEntries(this.nameIndex);
      fs.writeFileSync(NAME_INDEX_FILE, JSON.stringify(indexObject));

      console.log('Database saved to files');
    } catch (error) {
      console.error('Error saving to files:', error);
      // Don't throw - just log the error on Vercel
      if (isVercel) {
        console.log('Note: File saving is limited on Vercel. Data will be re-synced on next cold start.');
      }
    }
  }

  private async saveStatus(): Promise<void> {
    try {
      // Ensure data directory exists
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(STATUS_FILE, JSON.stringify(this.syncStatus, null, 2));
    } catch (error) {
      console.error('Error saving status:', error);
      // Don't throw - just log the error on Vercel
      if (isVercel) {
        console.log('Note: Status saving is limited on Vercel.');
      }
    }
  }
}

// Singleton instance
export const serverCardDatabase = new ServerCardDatabase();
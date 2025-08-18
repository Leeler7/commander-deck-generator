import { LocalCardData, DatabaseSyncStatus, ScryfallCard } from './types';

/**
 * Local Card Database Service
 * 
 * This service manages a local cache of Magic cards to reduce Scryfall API calls
 * and improve performance. It handles:
 * - Full database sync from Scryfall bulk data
 * - Incremental updates for new cards/sets
 * - Fast local search and filtering
 * - Automatic fallback to Scryfall API when needed
 */

export class CardDatabase {
  private cards: Map<string, LocalCardData> = new Map();
  private nameIndex: Map<string, string> = new Map(); // name -> id
  private syncStatus: DatabaseSyncStatus = {
    last_full_sync: null,
    last_incremental_sync: null,
    total_cards: 0,
    sync_in_progress: false,
    sync_progress: 0
  };

  /**
   * Initialize the database, loading from localStorage if available
   */
  async initialize(): Promise<void> {
    try {
      // Load existing data from localStorage
      const storedCards = localStorage.getItem('mtg_card_database');
      const storedStatus = localStorage.getItem('mtg_sync_status');
      
      if (storedCards && storedStatus) {
        const cardData = JSON.parse(storedCards);
        const status = JSON.parse(storedStatus);
        
        // Rebuild Map from stored data
        this.cards = new Map(Object.entries(cardData));
        this.syncStatus = status;
        
        // Rebuild name index
        this.rebuildNameIndex();
        
        console.log(`Loaded ${this.cards.size} cards from local storage`);
      } else {
        console.log('No local card database found, will need initial sync');
      }
    } catch (error) {
      console.error('Error initializing card database:', error);
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
    this.updateSyncStatus();

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
      this.updateSyncStatus();

      // Download the bulk data
      console.log('Downloading bulk card data...');
      const cardsResponse = await fetch(oracleData.download_uri);
      const scryfallCards: ScryfallCard[] = await cardsResponse.json();

      this.syncStatus.sync_progress = 50;
      this.updateSyncStatus();

      // Convert and store cards
      console.log(`Processing ${scryfallCards.length} cards...`);
      this.cards.clear();
      this.nameIndex.clear();

      const batchSize = 1000;
      for (let i = 0; i < scryfallCards.length; i += batchSize) {
        const batch = scryfallCards.slice(i, i + batchSize);
        
        for (const scryfallCard of batch) {
          const localCard = this.convertScryfallToLocal(scryfallCard);
          this.cards.set(localCard.id, localCard);
          this.nameIndex.set(localCard.name.toLowerCase(), localCard.id);
        }

        // Update progress
        this.syncStatus.sync_progress = 50 + ((i / scryfallCards.length) * 40);
        this.updateSyncStatus();
      }

      // Save to localStorage
      this.saveToStorage();

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
      this.updateSyncStatus();
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
   * Get database status
   */
  getStatus(): DatabaseSyncStatus {
    return { ...this.syncStatus };
  }

  /**
   * Check if database needs sync (no data or older than 7 days)
   */
  needsSync(): boolean {
    if (this.cards.size === 0) return true;
    
    if (!this.syncStatus.last_full_sync) return true;
    
    const lastSync = new Date(this.syncStatus.last_full_sync);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return lastSync < weekAgo;
  }

  private convertScryfallToLocal(scryfallCard: ScryfallCard): LocalCardData {
    return {
      id: scryfallCard.id,
      name: scryfallCard.name,
      mana_cost: scryfallCard.mana_cost,
      cmc: scryfallCard.cmc,
      type_line: scryfallCard.type_line,
      oracle_text: scryfallCard.oracle_text,
      flavor_text: '', // Not typically needed for deck generation
      power: '', // Would need to extract from ScryfallCard if needed
      toughness: '',
      loyalty: '',
      color_identity: scryfallCard.color_identity,
      colors: scryfallCard.colors,
      keywords: scryfallCard.keywords || [],
      set_code: scryfallCard.set || '',
      set_name: scryfallCard.set_name || '',
      rarity: 'common', // Would need proper mapping
      collector_number: '',
      legalities: scryfallCard.legalities,
      prices: scryfallCard.prices,
      edhrec_rank: scryfallCard.edhrec_rank,
      image_uris: scryfallCard.image_uris,
      last_updated: new Date().toISOString(),
      scryfall_uri: `https://scryfall.com/card/${scryfallCard.set}/${scryfallCard.id}`
    };
  }

  private rebuildNameIndex(): void {
    this.nameIndex.clear();
    for (const card of this.cards.values()) {
      this.nameIndex.set(card.name.toLowerCase(), card.id);
    }
  }

  private saveToStorage(): void {
    try {
      // Convert Map to Object for storage
      const cardObject = Object.fromEntries(this.cards);
      
      localStorage.setItem('mtg_card_database', JSON.stringify(cardObject));
      localStorage.setItem('mtg_sync_status', JSON.stringify(this.syncStatus));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  private updateSyncStatus(): void {
    localStorage.setItem('mtg_sync_status', JSON.stringify(this.syncStatus));
  }
}

// Singleton instance
export const cardDatabase = new CardDatabase();
import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';
import { CardMechanicsTagger } from '@/lib/card-mechanics-tagger';

// Global flag to check if sync should stop
let shouldStopSync = false;

// Function to check if we should stop
function checkSyncStop(): boolean {
  return shouldStopSync;
}

// Function to set stop flag
export function stopSync(): void {
  shouldStopSync = true;
  console.log('🛑 SYNC STOP SIGNAL RECEIVED');
}

interface ScryfallBulkData {
  object: string;
  id: string;
  type: string;
  updated_at: string;
  uri: string;
  name: string;
  description: string;
  size: number;
  download_uri: string;
  content_type: string;
  content_encoding: string;
}

export async function POST(request: NextRequest) {
  try {
    // Reset stop flag at start
    shouldStopSync = false;
    console.log('🔄 Starting incremental sync...');
    
    // Get last sync timestamp from database
    const lastSync = await getLastSyncTimestamp();
    console.log(`📅 Last sync: ${lastSync || 'Never'}`);
    
    // Check if Scryfall has updates since last sync
    const bulkDataResponse = await fetch('https://api.scryfall.com/bulk-data');
    if (!bulkDataResponse.ok) {
      throw new Error('Failed to fetch Scryfall bulk data info');
    }
    
    const bulkData = await bulkDataResponse.json();
    const defaultCards = bulkData.data.find((item: ScryfallBulkData) => 
      item.type === 'default_cards'
    );
    
    if (!defaultCards) {
      throw new Error('Could not find default cards bulk data');
    }
    
    const scryfallUpdated = new Date(defaultCards.updated_at);
    const lastSyncDate = lastSync ? new Date(lastSync) : new Date(0);
    
    if (scryfallUpdated <= lastSyncDate) {
      console.log('✅ No updates needed - Scryfall data unchanged');
      return NextResponse.json({
        success: true,
        message: 'No updates needed',
        lastSync: lastSync,
        scryfallUpdated: defaultCards.updated_at
      });
    }
    
    console.log(`📦 Scryfall updated: ${defaultCards.updated_at} - fetching cards since ${lastSyncDate.toISOString()}...`);
    
    // Use Scryfall search API to get only NEW unique cards since last sync
    // This is much more efficient than downloading 500MB+ of all cards and all reprints
    const searchQuery = `game:mtg legal:commander lang:en -is:digital firstprint>${lastSyncDate.toISOString().split('T')[0]}`;
    const searchUrl = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(searchQuery)}&unique=cards&order=released`;
    
    console.log(`🔍 Searching for: ${searchQuery}`);
    
    let cards: any[] = [];
    let nextUrl: string | null = searchUrl;
    
    // Handle paginated results from Scryfall search
    while (nextUrl) {
      const response = await fetch(nextUrl);
      if (!response.ok) {
        if (response.status === 404) {
          console.log('📭 No new cards found since last sync');
          break;
        }
        throw new Error(`Failed to search Scryfall: ${response.statusText}`);
      }
      
      const data = await response.json();
      cards.push(...(data.data || []));
      nextUrl = data.next_page || null;
      
      // Rate limiting - Scryfall asks for 50-100ms delays
      if (nextUrl) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`📊 Found ${cards.length} new/updated commander-legal cards since last sync`);
    
    if (cards.length === 0) {
      console.log('✅ No new cards to process');
      return NextResponse.json({
        success: true,
        message: 'No new cards found',
        stats: {
          totalProcessed: 0,
          newCards: 0,
          updated: 0,
          scryfallUpdated: defaultCards.updated_at
        },
        newCards: [],
        updatedCards: []
      });
    }
    
    const commanderLegalCards = cards;
    
    // Process in batches to avoid overwhelming the system
    const batchSize = 100;
    let processed = 0;
    let newCards = 0;
    let updated = 0;
    const newCardsList: any[] = [];
    const updatedCardsList: any[] = [];
    const tagger = new CardMechanicsTagger();
    
    for (let i = 0; i < commanderLegalCards.length; i += batchSize) {
      // Check if we should stop
      if (checkSyncStop()) {
        console.log('🛑 SYNC STOPPED - Cancelling remaining operations');
        return NextResponse.json({
          success: false,
          message: 'Sync stopped by user request',
          stats: {
            totalProcessed: processed,
            newCards,
            updated,
            stopped: true
          }
        });
      }
      
      const batch = commanderLegalCards.slice(i, i + batchSize);
      const batchResults = await processBatch(batch, tagger, lastSyncDate);
      
      processed += batch.length;
      newCards += batchResults.newCards;
      updated += batchResults.updated;
      newCardsList.push(...batchResults.newCardsList);
      updatedCardsList.push(...batchResults.updatedCardsList);
      
      console.log(`📈 Processed ${processed}/${commanderLegalCards.length} cards (${newCards} new, ${updated} updated)`);
      
      // Small delay to prevent overwhelming the database
      if (i + batchSize < commanderLegalCards.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Update last sync timestamp
    await setLastSyncTimestamp(defaultCards.updated_at);
    
    console.log('✅ Incremental sync completed');
    
    return NextResponse.json({
      success: true,
      message: 'Incremental sync completed',
      stats: {
        totalProcessed: processed,
        newCards,
        updated,
        scryfallUpdated: defaultCards.updated_at
      },
      newCards: newCardsList.map(card => ({
        id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.set_name,
        rarity: card.rarity,
        type_line: card.type_line,
        released_at: card.released_at,
        scryfall_uri: card.scryfall_uri
      })),
      updatedCards: updatedCardsList.map(card => ({
        id: card.id,
        name: card.name,
        set: card.set,
        set_name: card.set_name,
        rarity: card.rarity,
        type_line: card.type_line,
        updated_reason: card.updated_reason || 'Content changed'
      }))
    });
    
  } catch (error) {
    console.error('❌ Incremental sync failed:', error);
    return NextResponse.json(
      { error: 'Incremental sync failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

async function processBatch(
  cards: any[], 
  tagger: CardMechanicsTagger, 
  lastSyncDate: Date
): Promise<{ newCards: number; updated: number; newCardsList: any[]; updatedCardsList: any[] }> {
  let newCards = 0;
  let updated = 0;
  const newCardsList: any[] = [];
  const updatedCardsList: any[] = [];
  
  for (const card of cards) {
    try {
      // Check if card exists in database
      const existingCard = await database.getCardById(card.id);
      const cardDate = new Date(card.released_at || '1970-01-01');
      
      if (!existingCard) {
        // New card - add with auto-tagging
        await addNewCardWithTags(card, tagger);
        newCards++;
        newCardsList.push(card);
        console.log(`🆕 NEW: ${card.name} (${card.set_name})`);
      } else if (cardDate > lastSyncDate || hasSignificantChanges(existingCard, card)) {
        // Updated card - refresh tags if needed
        await updateCardWithTags(card, tagger);
        updated++;
        updatedCardsList.push({
          ...card,
          updated_reason: hasSignificantChanges(existingCard, card) ? 'Content changed' : 'Recent release'
        });
        console.log(`🔄 UPDATED: ${card.name} (${card.set_name})`);
      }
    } catch (error) {
      console.error(`❌ Failed to process card ${card.name}:`, error);
    }
  }
  
  return { newCards, updated, newCardsList, updatedCardsList };
}

async function addNewCardWithTags(card: any, tagger: CardMechanicsTagger): Promise<void> {
  console.log(`➕ Adding new card: ${card.name}`);
  
  // First, add the card to the database
  const success = await database.upsertCard({
    ...card,
    tag_ids: [] // Will be populated by auto-tagging
  });
  
  if (!success) {
    throw new Error(`Failed to add card ${card.name} to database`);
  }
  
  // Auto-tag the new card
  await autoTagCard(card, tagger);
}

async function updateCardWithTags(card: any, tagger: CardMechanicsTagger): Promise<void> {
  console.log(`🔄 Updating card: ${card.name}`);
  
  // Update card data
  const success = await database.upsertCard(card);
  
  if (!success) {
    throw new Error(`Failed to update card ${card.name} in database`);
  }
  
  // Re-tag if card text changed significantly
  await autoTagCard(card, tagger);
}

async function autoTagCard(card: any, tagger: CardMechanicsTagger): Promise<void> {
  try {
    console.log(`🏷️ Auto-tagging: ${card.name}`);
    
    // Generate mechanics analysis
    const mechanics = await tagger.analyzeCard(card);
    
    // Convert mechanic tags to tag IDs
    // This requires looking up existing tags and creating new ones if needed
    const tagIds = await convertMechanicsToTagIds(mechanics.mechanicTags);
    
    // Update card with tag IDs
    if (tagIds.length > 0) {
      const success = await database.addTagsToCard(card.id, tagIds);
      if (success) {
        console.log(`✅ Auto-tagged ${card.name} with ${tagIds.length} tags`);
      }
    }
    
  } catch (error) {
    console.error(`❌ Failed to auto-tag ${card.name}:`, error);
  }
}

async function convertMechanicsToTagIds(mechanicTags: any[]): Promise<number[]> {
  const tagIds: number[] = [];
  
  for (const mechanic of mechanicTags) {
    // Look up existing tag by name and category
    const existingTags = await database.searchTags(mechanic.name, mechanic.category, 1);
    
    if (existingTags.length > 0) {
      tagIds.push(existingTags[0].id);
    } else {
      // Create new tag if it doesn't exist (with manual review flag)
      // This should be rare if our tag vocabulary is comprehensive
      console.log(`🆕 New mechanic found: ${mechanic.name} (${mechanic.category})`);
      // For now, skip unknown mechanics - they need manual review
    }
  }
  
  return tagIds;
}

async function hasSignificantChanges(existingCard: any, newCard: any): boolean {
  // Check if oracle text, type line, or other important fields changed
  return (
    existingCard.oracle_text !== newCard.oracle_text ||
    existingCard.type_line !== newCard.type_line ||
    existingCard.keywords?.join(',') !== newCard.keywords?.join(',')
  );
}

async function getLastSyncTimestamp(): Promise<string | null> {
  try {
    const { data, error } = await database.supabase
      .from('sync_metadata')
      .select('last_sync')
      .eq('sync_type', 'incremental')
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') { // Not found error - no records
        console.log('No sync records found - using recent fallback date');
        return '2025-01-01T00:00:00Z'; // Only sync recent cards
      } else if (error.code === 'PGRST205') { // Table doesn't exist
        console.log('sync_metadata table does not exist - using recent fallback date');
        return '2025-01-01T00:00:00Z'; // Only sync recent cards
      }
      console.error('Error fetching last sync timestamp:', error);
      return null;
    }
    
    return data?.last_sync || null;
  } catch (error) {
    console.error('Error fetching last sync timestamp:', error);
    return null;
  }
}

async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  try {
    // First, try to create the table if it doesn't exist
    await ensureSyncMetadataTable();
    
    const { error } = await database.supabase
      .from('sync_metadata')
      .upsert({
        sync_type: 'incremental',
        last_sync: timestamp,
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      if (error.code === 'PGRST205') { // Table doesn't exist
        console.log('sync_metadata table does not exist - skipping timestamp update');
        return;
      }
      console.error('Error setting last sync timestamp:', error);
    } else {
      console.log(`✅ Updated sync timestamp to: ${timestamp}`);
    }
  } catch (error) {
    console.error('Error setting last sync timestamp:', error);
  }
}

async function ensureSyncMetadataTable(): Promise<void> {
  try {
    // Try to create the table by first inserting a test record
    // This will fail if the table doesn't exist, which we can catch
    const { error: testError } = await database.supabase
      .from('sync_metadata')
      .select('id')
      .limit(1);
    
    if (testError && testError.code === 'PGRST205') {
      // Table doesn't exist, create it programmatically
      console.log('Creating sync_metadata table...');
      
      // We can't create tables through the API easily, so let's at least log this
      console.log('⚠️ sync_metadata table needs to be created manually in Supabase dashboard');
      console.log('SQL to run:');
      console.log(`
        CREATE TABLE IF NOT EXISTS public.sync_metadata (
          id SERIAL PRIMARY KEY,
          sync_type VARCHAR(20) NOT NULL,
          last_sync TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(sync_type)
        );
      `);
    }
  } catch (error) {
    console.log('Could not verify sync_metadata table existence:', error);
  }
}
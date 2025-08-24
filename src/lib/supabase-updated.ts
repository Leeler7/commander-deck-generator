import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// Create Supabase client (read-only operations)
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create admin Supabase client with service role (write operations)
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Database types
export interface CardRecord {
  id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  flavor_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  color_identity: string[];
  colors: string[];
  keywords: string[];
  set_code: string;
  set_name: string;
  rarity: string;
  collector_number: string;
  legalities: Record<string, string>;
  prices: Record<string, string | null>;
  edhrec_rank?: number;
  image_uris: Record<string, string>;
  last_updated: string;
  scryfall_uri: string;
  tag_ids: number[]; // NEW: Array of tag IDs
  created_at: string;
  updated_at: string;
}

export interface TagRecord {
  id: number;
  name: string;
  category: string;
  synergy_weight: number;
  description?: string;
  is_active: boolean;
}

// Import the interface
import type { DatabaseInterface } from './database-factory';

export class SupabaseCardDatabase implements Partial<DatabaseInterface> {
  private tagsCache: Map<number, TagRecord> = new Map();
  private tagsCacheTimestamp = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  constructor() {
    console.log('🗄️ Using Supabase database with streamlined tag structure');
  }

  // Get all tags and cache them
  private async loadTagsCache(): Promise<void> {
    const now = Date.now();
    if (this.tagsCacheTimestamp && (now - this.tagsCacheTimestamp) < this.CACHE_DURATION) {
      return; // Cache is still fresh
    }

    const { data: tags, error } = await supabase
      .from('tags')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error loading tags cache:', error);
      return;
    }

    this.tagsCache.clear();
    tags?.forEach(tag => {
      this.tagsCache.set(tag.id, tag);
    });
    this.tagsCacheTimestamp = now;
    console.log(`📦 Loaded ${this.tagsCache.size} tags into cache`);
  }

  // Get tags for a card using its tag_ids array
  async getCardTags(cardId: string): Promise<TagRecord[]> {
    try {
      // Get the card with its tag_ids
      const { data: card, error } = await supabase
        .from('cards')
        .select('tag_ids')
        .eq('id', cardId)
        .single();

      if (error || !card || !card.tag_ids || card.tag_ids.length === 0) {
        return [];
      }

      // Ensure tags cache is loaded
      await this.loadTagsCache();

      // Map tag_ids to full tag records from cache
      const tags = card.tag_ids
        .map(tagId => this.tagsCache.get(tagId))
        .filter(tag => tag !== undefined) as TagRecord[];

      return tags;
    } catch (error) {
      console.error('Error getting card tags:', error);
      return [];
    }
  }

  // Get all cards (with pagination)
  async getAllCards(limit: number = 50000): Promise<CardRecord[]> {
    const allCards: CardRecord[] = [];
    const pageSize = 1000;
    let page = 1;
    let hasMore = true;

    console.log(`📊 Getting ${limit} cards with pagination...`);

    while (hasMore && allCards.length < limit) {
      const offset = (page - 1) * pageSize;
      const currentLimit = Math.min(pageSize, limit - allCards.length);
      
      console.log(`📦 Fetching page ${page}, cards ${offset + 1}-${offset + currentLimit}`);
      
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .range(offset, offset + currentLimit - 1)
        .order('name');

      if (error) {
        console.error(`Error fetching cards page ${page}:`, error);
        break;
      }

      if (!data || data.length === 0) {
        console.log(`📄 Reached end of database at ${allCards.length} cards`);
        hasMore = false;
      } else {
        allCards.push(...data);
        if (data.length < currentLimit) {
          console.log(`📄 Reached end of database at ${allCards.length} cards`);
          hasMore = false;
        }
      }

      page++;
    }

    console.log(`✅ Successfully loaded ${allCards.length} cards`);
    return allCards;
  }

  // Search for cards with specific tags
  async searchCardsByTags(tagIds: number[]): Promise<CardRecord[]> {
    if (tagIds.length === 0) return [];

    // Use the overlaps operator to find cards that have any of the specified tag IDs
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .overlaps('tag_ids', tagIds)
      .limit(100);

    if (error) {
      console.error('Error searching cards by tags:', error);
      return [];
    }

    return data || [];
  }

  // Add tags to a card
  async addTagsToCard(cardId: string, tagIds: number[]): Promise<boolean> {
    try {
      console.log(`🏷️ [ADD] Starting addTagsToCard for card ${cardId} with tags: [${tagIds.join(', ')}]`);
      
      // Get current tag_ids
      const { data: card, error: fetchError } = await supabase
        .from('cards')
        .select('tag_ids')
        .eq('id', cardId)
        .single();

      if (fetchError) {
        console.error('🚨 [ADD] Error fetching card:', fetchError);
        return false;
      }

      // Merge new tag IDs with existing ones (avoid duplicates)
      const existingTags = card?.tag_ids || [];
      const updatedTags = [...new Set([...existingTags, ...tagIds])].sort();
      
      console.log(`🏷️ [ADD] Current tags: [${existingTags.join(', ')}]`);
      console.log(`🏷️ [ADD] Updated tags: [${updatedTags.join(', ')}]`);

      // Update the card with new tag_ids using admin client
      const { error: updateError } = await supabaseAdmin
        .from('cards')
        .update({ tag_ids: updatedTags })
        .eq('id', cardId);

      if (updateError) {
        console.error('🚨 [ADD] Error updating card tags:', updateError);
        return false;
      }

      console.log(`✅ [ADD] Successfully added tags to card ${cardId}`);
      return true;
    } catch (error) {
      console.error('🚨 [ADD] Error adding tags to card:', error);
      return false;
    }
  }

  // Remove tags from a card
  async removeTagsFromCard(cardId: string, tagIds: number[]): Promise<boolean> {
    try {
      console.log(`🏷️ [REMOVE] Starting removeTagsFromCard for card ${cardId} with tags: [${tagIds.join(', ')}]`);
      
      // Get current tag_ids
      const { data: card, error: fetchError } = await supabase
        .from('cards')
        .select('tag_ids')
        .eq('id', cardId)
        .single();

      if (fetchError) {
        console.error('🚨 [REMOVE] Error fetching card:', fetchError);
        return false;
      }

      // Remove specified tag IDs
      const existingTags = card?.tag_ids || [];
      const updatedTags = existingTags.filter(id => !tagIds.includes(id));
      
      console.log(`🏷️ [REMOVE] Current tags: [${existingTags.join(', ')}]`);
      console.log(`🏷️ [REMOVE] Removing tag IDs: [${tagIds.join(', ')}]`);
      console.log(`🏷️ [REMOVE] Updated tags: [${updatedTags.join(', ')}]`);

      // Update the card with new tag_ids using admin client
      const { error: updateError } = await supabaseAdmin
        .from('cards')
        .update({ tag_ids: updatedTags })
        .eq('id', cardId);

      if (updateError) {
        console.error('🚨 [REMOVE] Error updating card tags:', updateError);
        return false;
      }

      console.log(`✅ [REMOVE] Successfully removed tags from card ${cardId}`);
      return true;
    } catch (error) {
      console.error('🚨 [REMOVE] Error removing tags from card:', error);
      return false;
    }
  }

  // Search tags by name or category
  async searchTags(query: string, category?: string | null, limit: number = 20): Promise<TagRecord[]> {
    let queryBuilder = supabase
      .from('tags')
      .select('*')
      .eq('is_active', true);

    if (query && query.length > 0) {
      queryBuilder = queryBuilder.ilike('name', `%${query}%`);
    }

    if (category && category !== 'all') {
      queryBuilder = queryBuilder.eq('category', category);
    }

    const { data, error } = await queryBuilder
      .order('category')
      .order('name')
      .limit(limit);

    if (error) {
      console.error('Error searching tags:', error);
      return [];
    }

    return data || [];
  }

  // Get tag usage counts (how many cards use each tag)
  async getTagUsageCounts(tagIds: number[]): Promise<Record<number, number>> {
    const counts: Record<number, number> = {};
    
    if (tagIds.length === 0) return counts;

    // Initialize all counts to 0
    tagIds.forEach(id => counts[id] = 0);

    // Query cards and count tag usage
    const { data: cards, error } = await supabase
      .from('cards')
      .select('tag_ids')
      .overlaps('tag_ids', tagIds);

    if (error) {
      console.error('Error getting tag usage counts:', error);
      return counts;
    }

    // Count occurrences
    cards?.forEach(card => {
      card.tag_ids?.forEach(tagId => {
        if (counts.hasOwnProperty(tagId)) {
          counts[tagId]++;
        }
      });
    });

    return counts;
  }

  // Get available tag categories
  async getTagCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('category')
      .eq('is_active', true);

    if (error) {
      console.error('Error getting tag categories:', error);
      return [];
    }

    // Get unique categories
    const categories = [...new Set(data?.map(row => row.category) || [])];
    return categories.sort();
  }

  // Get all legal commanders efficiently (without loading all cards)
  async getAllCommanders(): Promise<CardRecord[]> {
    console.log('🎲 Getting commanders with efficient database query...');
    
    // First, get a reasonable sample of legendary creatures
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .ilike('type_line', '%legendary%')
      .ilike('type_line', '%creature%')
      .not('type_line', 'ilike', '%background%')
      .order('name')
      .limit(3000); // Limit to first 3000 legendary creatures for speed

    if (error) {
      console.error('Error getting commanders:', error);
      return [];
    }

    // Filter for commander legality
    const commanders = (data || []).filter(card => {
      return card.legalities && card.legalities.commander === 'legal';
    });

    console.log(`✅ Found ${commanders.length} legal commanders from ${data?.length} legendary creatures`);
    return commanders;
  }

  // Get cards efficiently with reasonable limit for deck generation
  async getCardsForGeneration(limit: number = 10000): Promise<CardRecord[]> {
    console.log(`📊 Loading ${limit} cards for deck generation...`);
    
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('legalities->>commander', 'legal')
      .order('name')
      .limit(limit);

    if (error) {
      console.error('Error getting cards for generation:', error);
      return [];
    }

    console.log(`✅ Loaded ${data?.length || 0} cards for generation`);
    return data || [];
  }

  // Search cards by filters (compatibility method for generation pipeline)
  async searchByFilters(filters: any, limit: number = 10000): Promise<CardRecord[]> {
    console.log(`🔍 Searching cards with filters:`, filters);
    console.log(`🎨 Color identity filter:`, filters.colorIdentity);
    
    // We need to paginate to get ALL commander-legal cards
    // Supabase has a max limit of 1000 per request
    const pageSize = 1000;
    let allCards: CardRecord[] = [];
    let page = 0;
    let hasMore = true;

    console.log(`📊 Fetching all commander-legal cards with pagination...`);

    while (hasMore) {
      const offset = page * pageSize;
      
      let queryBuilder = supabase
        .from('cards')
        .select('*')
        .range(offset, offset + pageSize - 1)
        .order('name');

      // Apply commander legality filter
      if (filters.legal_in_commander) {
        queryBuilder = queryBuilder.eq('legalities->>commander', 'legal');
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error(`Error fetching cards page ${page}:`, error);
        break;
      }

      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allCards.push(...data);
        if (data.length < pageSize) {
          hasMore = false;
        }
      }

      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 50) {
        console.warn(`⚠️ Reached page limit (${page}), stopping pagination`);
        break;
      }
    }

    console.log(`📊 Fetched ${allCards.length} total commander-legal cards`);

    let filteredCards = allCards;

    // Apply color identity filter in JavaScript
    if (filters.colorIdentity && Array.isArray(filters.colorIdentity) && filters.colorIdentity.length > 0) {
      const commanderColors = filters.colorIdentity;
      filteredCards = filteredCards.filter(card => {
        // Card's color identity must be a subset of commander's color identity
        const cardColors = card.color_identity || [];
        return cardColors.every(color => commanderColors.includes(color));
      });
      console.log(`🎨 Filtered from ${allCards.length} to ${filteredCards.length} cards by color identity: [${commanderColors.join(', ')}]`);
    }

    // Apply the limit after filtering
    if (filteredCards.length > limit) {
      filteredCards = filteredCards.slice(0, limit);
      console.log(`📊 Limited results to ${limit} cards`);
    }

    console.log(`✅ Returning ${filteredCards.length} cards matching all filters`);
    return filteredCards;
  }

  // Search cards by name (compatibility method) - no tags for performance
  async searchByName(query: string, limit: number = 20): Promise<any[]> {
    console.log(`🔍 Searching for cards with query: "${query}", limit: ${limit}`);
    
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (error) {
      console.error('Error searching cards by name:', error);
      return [];
    }

    console.log(`✅ Found ${data?.length || 0} cards matching "${query}"`);
    
    // Return cards without tags for performance - tags will be loaded on-demand
    return data || [];
  }

  // Get a single card by ID
  async getCardById(cardId: string): Promise<CardRecord | null> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return null;
      }
      console.error('Error fetching card by ID:', error);
      return null;
    }

    return data;
  }

  // Upsert (insert or update) a card
  async upsertCard(card: any): Promise<boolean> {
    try {
      // Transform Scryfall card data to match our database schema
      const transformedCard: Partial<CardRecord> = {
        id: card.id,
        name: card.name,
        mana_cost: card.mana_cost,
        cmc: card.cmc || 0,
        type_line: card.type_line,
        oracle_text: card.oracle_text,
        flavor_text: card.flavor_text,
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty,
        color_identity: card.color_identity || [],
        colors: card.colors || [],
        keywords: card.keywords || [],
        set_code: card.set || card.set_code,
        set_name: card.set_name,
        rarity: card.rarity,
        collector_number: card.collector_number,
        legalities: card.legalities || {},
        prices: card.prices || {},
        edhrec_rank: card.edhrec_rank,
        image_uris: card.image_uris || {},
        last_updated: card.released_at || new Date().toISOString(),
        scryfall_uri: card.scryfall_uri,
        tag_ids: card.tag_ids || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabaseAdmin
        .from('cards')
        .upsert(transformedCard, {
          onConflict: 'id'
        });

      if (error) {
        console.error('Error upserting card:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error upserting card:', error);
      return false;
    }
  }

  // Get Supabase client (for sync operations)
  get supabase() {
    // Use admin client only if service key is available (for admin operations)
    // Otherwise use regular client (for normal deck generation)
    if (SUPABASE_SERVICE_KEY && SUPABASE_SERVICE_KEY.length > 0) {
      console.log('Using admin client (service key available)');
      return supabaseAdmin;
    }
    console.log('Using regular client (no service key or empty)');
    console.log('Anon key present:', SUPABASE_ANON_KEY ? 'Yes' : 'No');
    console.log('Anon key length:', SUPABASE_ANON_KEY?.length || 0);
    return supabase;
  }

  // Get available tags (compatibility method)
  async getAvailableTags(): Promise<TagRecord[]> {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Error getting available tags:', error);
      return [];
    }

    return data || [];
  }

  // Get card by name with full tag details (for database explorer)
  async getCardByName(name: string): Promise<any> {
    console.log(`🔍 Getting card by exact name: "${name}"`);
    
    // First get the card
    const { data: card, error } = await supabase
      .from('cards')
      .select('*')
      .eq('name', name)
      .single();

    if (error || !card) {
      console.error(`❌ Card not found: "${name}"`, error);
      return null;
    }

    console.log(`✅ Found card: ${card.name} with tag_ids: [${card.tag_ids?.join(', ') || 'none'}]`);

    // If no tags, return card without mechanic_tags
    if (!card.tag_ids || card.tag_ids.length === 0) {
      return {
        ...card,
        mechanic_tags: []
      };
    }

    // Get the associated tags from tags table
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('*')
      .in('id', card.tag_ids)
      .eq('is_active', true);

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      return {
        ...card,
        mechanic_tags: []
      };
    }

    // Convert to mechanic_tags format for backward compatibility
    const mechanicTags = (tags || []).map(tag => ({
      tag_name: tag.name,
      tag_category: tag.category,
      priority: 5, // Default priority
      confidence: 0.95, // Default confidence
      evidence: [], // No evidence data in new system
      is_manual: false, // All tags are automatic in new system
      name: tag.name, // Legacy support
      category: tag.category // Legacy support
    }));

    console.log(`📝 Found ${mechanicTags.length} tags for card: ${card.name}`);

    return {
      ...card,
      mechanic_tags: mechanicTags
    };
  }

  // Clean up overlapping mechanic_ and ability_keyword_ tags
  async cleanupOverlappingTags(): Promise<{ deletedCount: number; overlaps: any[] }> {
    const { data: tags, error } = await supabase
      .from('tags')
      .select('id, name, category')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching tags:', error);
      throw error;
    }

    const mechanicTags = tags?.filter(tag => tag.name.startsWith('mechanic_')) || [];
    const abilityKeywordTags = tags?.filter(tag => tag.name.startsWith('ability_keyword_')) || [];
    
    const overlaps = [];
    const mechanicIdsToDelete = [];
    const abilityIdToKeep: Record<number, number> = {};

    for (const mechanicTag of mechanicTags) {
      const baseName = mechanicTag.name.replace('mechanic_', '');
      const correspondingAbilityTag = abilityKeywordTags.find(tag => 
        tag.name === `ability_keyword_${baseName}`
      );
      
      if (correspondingAbilityTag) {
        overlaps.push({
          baseName,
          mechanicTag: mechanicTag.name,
          abilityKeywordTag: correspondingAbilityTag.name
        });
        
        mechanicIdsToDelete.push(mechanicTag.id);
        abilityIdToKeep[mechanicTag.id] = correspondingAbilityTag.id;
      }
    }

    if (mechanicIdsToDelete.length > 0) {
      // First, update all cards to replace mechanic tag IDs with ability_keyword tag IDs
      const { data: affectedCards, error: cardsError } = await supabase
        .from('cards')
        .select('id, tag_ids')
        .overlaps('tag_ids', mechanicIdsToDelete);

      if (!cardsError && affectedCards) {
        for (const card of affectedCards) {
          const updatedTagIds = card.tag_ids.map(id => 
            abilityIdToKeep[id] || id
          );
          // Remove duplicates
          const uniqueTagIds = [...new Set(updatedTagIds)];
          
          await supabase
            .from('cards')
            .update({ tag_ids: uniqueTagIds })
            .eq('id', card.id);
        }
      }

      // Now delete the mechanic_ tags
      const { error: deleteError } = await supabase
        .from('tags')
        .delete()
        .in('id', mechanicIdsToDelete);

      if (deleteError) {
        console.error('Error deleting tags:', deleteError);
        throw deleteError;
      }
    }

    return {
      deletedCount: mechanicIdsToDelete.length,
      overlaps
    };
  }

  // Get database status information
  async getStatus(): Promise<any> {
    try {
      // Get last sync info from sync_metadata table
      const { data: syncData, error: syncError } = await supabase
        .from('sync_metadata')
        .select('sync_type, last_sync, updated_at')
        .order('updated_at', { ascending: false });

      const status = {
        last_full_sync: null as string | null,
        last_incremental_sync: null as string | null,
        database_initialized: true,
        total_cards: 0
      };

      if (syncError) {
        if (syncError.code === 'PGRST205') { // Table doesn't exist
          console.log('sync_metadata table does not exist - using default status');
        } else {
          console.error('Error fetching sync metadata:', syncError);
        }
      } else if (syncData) {
        syncData.forEach(sync => {
          if (sync.sync_type === 'full') {
            status.last_full_sync = sync.last_sync;
          } else if (sync.sync_type === 'incremental') {
            status.last_incremental_sync = sync.last_sync;
          }
        });
      }

      // Get card count
      const { count, error: countError } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true });

      if (!countError && count !== null) {
        status.total_cards = count;
      }

      return status;
    } catch (error) {
      console.error('Error getting database status:', error);
      return {
        last_full_sync: null,
        last_incremental_sync: null,
        database_initialized: false,
        total_cards: 0
      };
    }
  }
}

// Export a singleton instance
export const database = new SupabaseCardDatabase();
import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  primary_type: string;
  functional_roles: string[];
  synergy_keywords: string[];
  power_level: number;
  archetype_relevance: string[];
  last_analyzed?: string;
  created_at: string;
  updated_at: string;
}

export interface CardTagRecord {
  id: string;
  card_id: string;
  tag_name: string;
  tag_category?: string;
  confidence?: number;
  priority?: number;
  evidence: string[];
  is_manual: boolean;
  created_at: string;
}

export interface DatabaseSyncStatusRecord {
  id: string;
  last_full_sync?: string;
  last_incremental_sync?: string;
  total_cards: number;
  sync_in_progress: boolean;
  sync_progress: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

// Database service functions
export class SupabaseCardDatabase {
  
  async searchByName(query: string, limit: number = 20) {
    const { data, error } = await supabase
      .from('cards')
      .select('id, name, type_line, mana_cost, cmc')
      .or(`name.ilike.%${query}%,oracle_text.ilike.%${query}%`)
      .order('name')
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  }
  
  async getCardById(id: string) {
    // Query with tags joined
    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();
    
    if (cardError) {
      console.error('Error getting card by ID:', cardError);
      throw cardError;
    }
    
    // Get tags for this card
    const { data: tags, error: tagsError } = await supabase
      .from('card_tags')
      .select('*')
      .eq('card_id', id);
    
    if (tagsError) {
      console.error('Error getting card tags:', tagsError);
    }
    
    // Combine card with tags
    return {
      ...cardData,
      mechanic_tags: tags || []
    };
  }
  
  async getCardByName(name: string) {
    // Query with tags joined
    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('name', name)
      .single();
    
    if (cardError && cardError.code !== 'PGRST116') {
      console.error('Error getting card by name:', cardError);
      throw cardError;
    }
    
    if (!cardData) return null;
    
    // Get tags for this card
    const { data: tags, error: tagsError } = await supabase
      .from('card_tags')
      .select('*')
      .eq('card_id', cardData.id);
    
    if (tagsError) {
      console.error('Error getting card tags:', tagsError);
    }
    
    // Combine card with tags
    return {
      ...cardData,
      mechanic_tags: tags || []
    };
  }
  
  async searchByFilters(filters: {
    colorIdentity?: string[];
    query?: string;
    types?: string[];
    cmc?: { min?: number; max?: number };
    legal_in_commander?: boolean;
    mechanics?: string[];
    functionalRoles?: string[];
    archetypes?: string[];
    powerLevel?: { min?: number; max?: number };
  }, limit: number = 5000) {
    
    // If limit is <= 1000, use single query
    if (limit <= 1000) {
      return this.searchByFiltersSingle(filters, limit);
    }
    
    // For larger limits, use pagination
    return this.searchByFiltersPaginated(filters, limit);
  }
  
  private async searchByFiltersSingle(filters: any, limit: number) {
    let query = supabase.from('cards').select(`
      id, name, mana_cost, cmc, type_line, oracle_text, 
      color_identity, colors, keywords, set_code, set_name, 
      rarity, power, toughness, loyalty, legalities, prices, 
      edhrec_rank, image_uris, last_updated, scryfall_uri
    `);
    
    query = this.applyFilters(query, filters);
    query = query.limit(limit);
    
    const { data, error } = await query;
    if (error) throw error;
    
    return data || [];
  }
  
  private async searchByFiltersPaginated(filters: any, limit: number) {
    const CHUNK_SIZE = 1000;
    let allResults: any[] = [];
    let page = 0;
    
    while (allResults.length < limit) {
      const remainingRecords = limit - allResults.length;
      const currentChunkSize = Math.min(CHUNK_SIZE, remainingRecords);
      
      let query = supabase.from('cards').select(`
        id, name, mana_cost, cmc, type_line, oracle_text, 
        color_identity, colors, keywords, set_code, set_name, 
        rarity, power, toughness, loyalty, legalities, prices, 
        edhrec_rank, image_uris, last_updated, scryfall_uri
      `);
      
      query = this.applyFilters(query, filters);
      query = query.range(page * CHUNK_SIZE, page * CHUNK_SIZE + currentChunkSize - 1);
      
      const { data, error } = await query;
      if (error) throw error;
      
      if (!data || data.length === 0) break;
      
      allResults.push(...data);
      page++;
      
      // If we got fewer records than expected, we've reached the end
      if (data.length < currentChunkSize) break;
    }
    
    return allResults;
  }
  
  private applyFilters(query: any, filters: any) {
    // Color identity filter
    if (filters.colorIdentity && filters.colorIdentity.length > 0) {
      console.log('🎨 Color identity filter disabled - TODO: implement proper PostgreSQL array filtering');
      // TODO: Implement proper color identity filtering for PostgreSQL JSON arrays
      // The challenge is that Supabase/PostgREST array operators need correct typing
      // For now, color identity filtering is handled in application logic
    }
    
    // Text search
    if (filters.query) {
      query = query.or(`name.ilike.%${filters.query}%,oracle_text.ilike.%${filters.query}%`);
    }
    
    // Type filter
    if (filters.types && filters.types.length > 0) {
      const typeConditions = filters.types.map(type => `type_line.ilike.%${type}%`);
      query = query.or(typeConditions.join(','));
    }
    
    // CMC filter
    if (filters.cmc?.min !== undefined) {
      query = query.gte('cmc', filters.cmc.min);
    }
    if (filters.cmc?.max !== undefined) {
      query = query.lte('cmc', filters.cmc.max);
    }
    
    // Commander legality
    if (filters.legal_in_commander) {
      // Use proper JSON path syntax for Supabase
      query = query.filter('legalities', 'cs', '{"commander": "legal"}');
    }
    
    // Power level filter
    if (filters.powerLevel?.min !== undefined) {
      query = query.gte('power_level', filters.powerLevel.min);
    }
    if (filters.powerLevel?.max !== undefined) {
      query = query.lte('power_level', filters.powerLevel.max);
    }
    
    return query;
  }
  
  async getAllCards(limit?: number) {
    const targetLimit = limit || 50000;
    
    // If requesting 1000 or fewer cards, use single query
    if (targetLimit <= 1000) {
      let query = supabase.from('cards').select('*').limit(targetLimit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
    
    // For larger requests, use pagination
    const CHUNK_SIZE = 1000;
    let allCards: any[] = [];
    let page = 0;
    
    console.log(`📊 Getting ${targetLimit} cards with pagination...`);
    
    while (allCards.length < targetLimit) {
      const remainingRecords = targetLimit - allCards.length;
      const currentChunkSize = Math.min(CHUNK_SIZE, remainingRecords);
      
      console.log(`📦 Fetching page ${page + 1}, cards ${allCards.length + 1}-${allCards.length + currentChunkSize}`);
      
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .range(page * CHUNK_SIZE, page * CHUNK_SIZE + currentChunkSize - 1);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.log(`📄 No more cards available, ending at ${allCards.length} cards`);
        break;
      }
      
      allCards.push(...data);
      page++;
      
      // If we got fewer records than expected, we've reached the end
      if (data.length < currentChunkSize) {
        console.log(`📄 Reached end of database at ${allCards.length} cards`);
        break;
      }
      
      // Small delay to avoid overwhelming the API
      if (page % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Successfully loaded ${allCards.length} cards`);
    return allCards;
  }
  
  async getAvailableTags() {
    // Get all unique tags with their categories
    const { data, error } = await supabase
      .from('card_tags')
      .select('tag_name, tag_category');
    
    if (error) {
      console.error('Error getting available tags:', error);
      throw error;
    }
    
    // Group and count tags in JavaScript
    const tagCounts = new Map<string, { category: string; count: number }>();
    
    if (data) {
      console.log(`🏷️ Processing ${data.length} tag records...`);
      
      // Check for dice tags specifically
      const diceTags = data.filter(tag => tag.tag_name === 'dice');
      console.log(`🎲 Found ${diceTags.length} dice tag records:`, diceTags);
      
      for (const tag of data) {
        const key = tag.tag_name;
        if (tagCounts.has(key)) {
          tagCounts.get(key)!.count++;
        } else {
          tagCounts.set(key, {
            category: tag.tag_category || 'uncategorized',
            count: 1
          });
        }
      }
      
      // Log if dice is in the final count
      if (tagCounts.has('dice')) {
        console.log(`🎲 Dice tag found in final counts:`, tagCounts.get('dice'));
      } else {
        console.log(`🎲 Dice tag NOT found in final counts`);
      }
    }
    
    // Convert to array format
    const result = Array.from(tagCounts.entries()).map(([name, info]) => ({
      tag_name: name,
      tag_category: info.category,
      count: info.count
    }));
    
    // Sort by count descending
    result.sort((a, b) => b.count - a.count);
    
    return result;
  }
  
  async addTagToCards(tagName: string, cardIds: string[]) {
    const tagRecords = cardIds.map(cardId => ({
      card_id: cardId,
      tag_name: tagName,
      tag_category: 'manual',
      confidence: 1.0,
      priority: 5,
      evidence: [],
      is_manual: true
    }));
    
    const { data, error } = await supabase
      .from('card_tags')
      .insert(tagRecords);
    
    if (error) throw error;
    return data;
  }
  
  async removeTagFromCards(tagName: string, cardIds?: string[]) {
    let query = supabase
      .from('card_tags')
      .delete()
      .eq('tag_name', tagName);
    
    if (cardIds) {
      query = query.in('card_id', cardIds);
    }
    
    const { error } = await query;
    if (error) throw error;
  }
  
  async getSyncStatus() {
    const { data, error } = await supabase
      .from('database_sync_status')
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }
  
  async updateSyncStatus(status: Partial<DatabaseSyncStatusRecord>) {
    const { data, error } = await supabase
      .from('database_sync_status')
      .update(status)
      .single();
    
    if (error) throw error;
    return data;
  }
}

// Singleton instance
export const supabaseDb = new SupabaseCardDatabase();
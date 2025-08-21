import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create Supabase client with error checking
export const supabase = (() => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('🚨 Missing Supabase configuration:');
    console.error('SUPABASE_URL:', SUPABASE_URL ? '✓ Set' : '❌ Missing');
    console.error('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓ Set' : '❌ Missing');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();

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

// Legacy structure (to be phased out)
export interface CardTagRecord {
  id: string;
  card_id: string;
  tag_name?: string;    // Legacy field
  tag_category?: string; // Legacy field
  tag_id?: number;      // New field
  priority?: number;
  created_at: string;
}

// New normalized tag structure
export interface TagRecord {
  id: number;
  name: string;
  category: string;
  description?: string;
  synergy_weight: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Enhanced card tag with joined tag data
export interface CardTagWithTag extends Omit<CardTagRecord, 'tag_name' | 'tag_category'> {
  tag: TagRecord;
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
  private tagsCache: Map<number, any> = new Map();
  private tagsCacheTimestamp = 0;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  constructor() {
    console.log('🗄️ Using Supabase database');
    // Pre-load tags cache on initialization
    this.loadTagsCache();
  }
  
  private async loadTagsCache(): Promise<void> {
    try {
      console.log('🔄 Loading tags cache from Supabase...');
      const { data: tags, error } = await supabase
        .from('tags')
        .select('id, name, category, synergy_weight')
        .eq('is_active', true);
      
      if (error) {
        console.error('❌ Error loading tags from Supabase:', error);
        return;
      }
      
      if (tags && tags.length > 0) {
        this.tagsCache.clear();
        tags.forEach(tag => {
          this.tagsCache.set(tag.id, tag);
        });
        this.tagsCacheTimestamp = Date.now();
        console.log(`📦 Successfully loaded ${tags.length} tags into cache for faster deck generation`);
      } else {
        console.warn('⚠️ No tags found in database');
      }
    } catch (error) {
      console.error('💥 Exception while loading tags cache:', error);
    }
  }
  
  private async ensureTagsCacheLoaded(): Promise<void> {
    const now = Date.now();
    if (!this.tagsCacheTimestamp || (now - this.tagsCacheTimestamp) > this.CACHE_DURATION) {
      await this.loadTagsCache();
    }
  }
  
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
    // Query card with all fields including tag_ids
    const { data: cardData, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();
    
    if (cardError) {
      console.error('Error getting card by ID:', cardError);
      throw cardError;
    }
    
    // For backward compatibility, if tag_ids exists, use it
    // Otherwise fall back to old mechanic_tags structure
    if (cardData.tag_ids && cardData.tag_ids.length > 0) {
      // Card already has tag_ids, no need for additional queries
      return cardData;
    }
    
    // Legacy fallback: Get tags for this card
    const tags = await this.getCardTags(id);
    
    // Combine card with tags
    return {
      ...cardData,
      mechanic_tags: tags || []
    };
  }

  /**
   * Convert database tags to CardMechanics format for synergy analysis
   * This allows using database tags with synergy weights instead of re-analyzing text
   */
  async getCardMechanicsFromDatabase(cardId: string): Promise<any | null> {
    try {
      const card = await this.getCardById(cardId);
      
      // Check if card has the new tag_ids array
      if (!card || !card.tag_ids || card.tag_ids.length === 0) {
        // Fallback to old mechanic_tags if available
        if (card && card.mechanic_tags && card.mechanic_tags.length > 0) {
          // Use old structure as fallback
          const mechanicTags = card.mechanic_tags.map((dbTag: any) => ({
            name: dbTag.name || 'unknown',
            category: dbTag.category || 'uncategorized',
            priority: dbTag.priority || 5,
            synergy_weight: dbTag.synergy_weight || 1.0
          }));
          
          return {
            cardId: card.id,
            cardName: card.name,
            primaryType: card.primary_type || card.type_line.split(' ')[0].toLowerCase(),
            functionalRoles: card.functional_roles || [],
            mechanicTags,
            synergyKeywords: card.synergy_keywords || [],
            powerLevel: card.power_level || 5,
            archetypeRelevance: card.archetype_relevance || []
          };
        }
        return null; // No tags available
      }

      // Ensure tags cache is loaded
      await this.ensureTagsCacheLoaded();
      
      // Get tag details from cache (much faster than querying database)
      const tags = card.tag_ids
        .map(tagId => this.tagsCache.get(tagId))
        .filter(tag => tag !== undefined);
      
      if (tags.length === 0) {
        return null; // No valid tags found
      }

      // Convert tags to MechanicTag format
      const mechanicTags = tags.map((tag: any) => ({
        name: tag.name || 'unknown',
        category: tag.category || 'uncategorized',
        priority: 5, // Default priority since it's not in the tags table
        synergy_weight: tag.synergy_weight || 1.0
      }));

      // Create a minimal CardMechanics object for synergy analysis
      return {
        cardId: card.id,
        cardName: card.name,
        primaryType: card.primary_type || card.type_line.split(' ')[0].toLowerCase(),
        functionalRoles: card.functional_roles || [],
        mechanicTags,
        synergyKeywords: card.synergy_keywords || [],
        powerLevel: card.power_level || 5,
        archetypeRelevance: card.archetype_relevance || []
      };
    } catch (error) {
      console.error('Error getting card mechanics from database:', error);
      return null;
    }
  }

  // Helper method to get card tags with backward compatibility
  private async getCardTags(cardId: string): Promise<any[]> {
    try {
      // Try new structure with JOIN
      const { data: newTags, error: newError } = await supabase
        .from('card_tags')
        .select(`
          id,
          priority,
          tag_id,
          tags (
            id,
            name,
            category,
            synergy_weight
          )
        `)
        .eq('card_id', cardId)
        .not('tag_id', 'is', null);
      
      // If new structure works and has data, use it
      if (!newError && newTags && newTags.length > 0) {
        return newTags.map(cardTag => ({
          name: cardTag.tags?.name || 'unknown',
          category: cardTag.tags?.category || 'uncategorized',
          priority: cardTag.priority || 5,
          synergy_weight: cardTag.tags?.synergy_weight || 1.0
        }));
      }
      
      // Fall back to legacy structure
      const { data: legacyTags, error: legacyError } = await supabase
        .from('card_tags')
        .select('*')
        .eq('card_id', cardId);
      
      if (legacyError) {
        console.error('Error getting card tags:', legacyError);
        return [];
      }
      
      return (legacyTags || []).map(tag => ({
        name: tag.tag_name || 'unknown',
        category: tag.tag_category || 'uncategorized',
        priority: tag.priority || 5,
        synergy_weight: 1.0 // Default weight for legacy tags
      }));
      
    } catch (error) {
      console.error('Error in getCardTags:', error);
      return [];
    }
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
    try {
      // Try new structure first - get tags directly from tags table
      const { data: newTags, error: newError } = await supabase
        .from('tags')
        .select('id, name, category, synergy_weight')
        .eq('is_active', true);
      
      if (!newError && newTags && newTags.length > 0) {
        console.log(`🏷️ Using new tag structure: ${newTags.length} unique tags`);
        
        // Get usage counts for each tag
        const tagsWithCounts = await Promise.all(
          newTags.map(async (tag) => {
            const { count } = await supabase
              .from('card_tags')
              .select('*', { count: 'exact', head: true })
              .eq('tag_id', tag.id);
            
            return {
              tag_name: tag.name,
              tag_category: tag.category,
              count: count || 0,
              synergy_weight: tag.synergy_weight
            };
          })
        );
        
        // Sort by count descending
        tagsWithCounts.sort((a, b) => b.count - a.count);
        return tagsWithCounts;
      }
    } catch (error) {
      console.log('⚠️ New tag structure not available, falling back to legacy');
    }
    
    // Fall back to legacy structure
    console.log('🏷️ Using legacy tag structure...');
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
      count: info.count,
      synergy_weight: 1.0 // Default for legacy
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
      priority: 5
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

  async searchTags(query: string, category?: string | null, limit: number = 20): Promise<TagRecord[]> {
    try {
      // Try new structure first - search tags table
      // Also search against cleaned/formatted versions of tag names
      const cleanedQuery = query.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      
      // Use broader search to get more candidates, let scoring do the filtering
      // For short queries (common case like "fl"), get even more results 
      const multiplier = query.length <= 2 ? 10 : 5;
      
      let tagQuery = supabase
        .from('tags')
        .select('*')
        .eq('is_active', true);
      
      // Only add name filter if we have a query
      if (query && query.length > 0) {
        tagQuery = tagQuery.ilike('name', `%${query}%`);
      }
      
      tagQuery = tagQuery.limit(limit * 5);
      
      if (category && category !== 'all') {
        tagQuery = tagQuery.eq('category', category);
      }
      
      const { data: newTags, error: newError } = await tagQuery;
      
      if (!newError && newTags && newTags.length > 0) {
        // Helper function to format tag names consistently with the API route
        const formatTagName = (rawName: string): string => {
          return rawName
            .replace(/^(ability_keyword_|ability_word_|keyword_|mechanic_)/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
            .replace(/\bEtb\b/g, 'ETB')
            .replace(/\bLtb\b/g, 'LTB')
            .replace(/\bCmc\b/g, 'CMC');
        };
        
        // Filter and score results based on how well they match the query
        const queryLower = query?.toLowerCase() || '';
        const scoredTags = newTags.map(tag => {
          const formattedName = formatTagName(tag.name).toLowerCase();
          const rawName = tag.name.toLowerCase();
          
          let score = 0;
          
          // If no query, give all tags a base score (category filtering scenario)
          if (!query || query.length === 0) {
            score = 10; // Base score for category matches
          } else {
            // Exact match on formatted name gets highest score
            if (formattedName === queryLower) score += 1000;
            // Starts with query on formatted name gets high score
            else if (formattedName.startsWith(queryLower)) score += 100;
            // Contains query on formatted name gets medium score
            else if (formattedName.includes(queryLower)) score += 50;
            // Raw name matches get lower scores
            else if (rawName.startsWith(queryLower)) score += 25;
            else if (rawName.includes(queryLower)) score += 10;
            // Description matches get lowest score
            else if (tag.description?.toLowerCase().includes(queryLower)) score += 5;
          }
          
          return { tag, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map(item => item.tag);
        
        return scoredTags;
      }
    } catch (error) {
    }

    // Fallback to legacy structure - search card_tags
    let legacyQuery = supabase
      .from('card_tags')
      .select('tag_name, tag_category')
      .or(`tag_name.ilike.%${query}%`)
      .limit(limit * 3); // Get more to account for duplicates
    
    if (category && category !== 'all') {
      legacyQuery = legacyQuery.eq('tag_category', category);
    }
    
    const { data: legacyTags, error: legacyError } = await legacyQuery;
    
    if (legacyError) throw legacyError;
    
    // Remove duplicates and convert to TagRecord format
    const uniqueTags = new Map();
    legacyTags?.forEach(tag => {
      const key = `${tag.tag_name}:${tag.tag_category || 'uncategorized'}`;
      if (!uniqueTags.has(key)) {
        uniqueTags.set(key, {
          id: 0, // Placeholder for legacy
          name: tag.tag_name,
          category: tag.tag_category || 'uncategorized',
          synergy_weight: 1.0,
          is_active: true,
          created_at: '',
          updated_at: ''
        } as TagRecord);
      }
    });
    
    return Array.from(uniqueTags.values()).slice(0, limit);
  }
  
  async updateSyncStatus(status: Partial<DatabaseSyncStatusRecord>) {
    const { data, error } = await supabase
      .from('database_sync_status')
      .update(status)
      .single();
    
    if (error) throw error;
    return data;
  }

  async getTagCategories(): Promise<string[]> {
    try {
      // Get distinct categories from the tags table
      const { data, error } = await supabase
        .from('tags')
        .select('category')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Extract unique categories and sort them
      const categories = [...new Set(data?.map(item => item.category) || [])]
        .filter(category => category) // Remove null/undefined
        .sort();
      
      return categories;
    } catch (error) {
      console.error('Error getting tag categories:', error);
      return [];
    }
  }

  async getTagUsageCounts(tagIds: number[], tagNames: string[]): Promise<Record<string | number, number>> {
    const counts: Record<string | number, number> = {};
    
    try {
      // Use RPC function or aggregation query for better performance
      // Batch the queries to avoid timeouts
      const batchSize = 5; // Smaller batches to avoid timeout
      
      // Get counts for tags with IDs (new structure) in batches
      for (let i = 0; i < tagIds.length; i += batchSize) {
        const batch = tagIds.slice(i, i + batchSize);
        
        if (batch.length > 0) {
          const { data: idData, error: idError } = await supabase
            .from('card_tags')
            .select('tag_id')
            .in('tag_id', batch);
          
          if (!idError && idData) {
            // Count occurrences of each tag_id
            idData.forEach(row => {
              if (row.tag_id) {
                counts[row.tag_id] = (counts[row.tag_id] || 0) + 1;
              }
            });
          }
        }
      }
      
      // Get counts for tags by name (legacy structure) in batches
      for (let i = 0; i < tagNames.length; i += batchSize) {
        const batch = tagNames.slice(i, i + batchSize);
        
        if (batch.length > 0) {
          const { data: nameData, error: nameError } = await supabase
            .from('card_tags')
            .select('tag_name')
            .in('tag_name', batch);
          
          if (!nameError && nameData) {
            // Count occurrences of each tag_name
            nameData.forEach(row => {
              if (row.tag_name) {
                counts[row.tag_name] = (counts[row.tag_name] || 0) + 1;
              }
            });
          }
        }
      }
      
      return counts;
    } catch (error) {
      console.error('Error getting tag usage counts:', error);
      return counts;
    }
  }
}

// Singleton instance
export const supabaseDb = new SupabaseCardDatabase();
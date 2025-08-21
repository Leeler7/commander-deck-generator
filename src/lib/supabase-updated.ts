import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bykbnagijmxtfpkaflae.supabase.co';
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
      // Get current tag_ids
      const { data: card, error: fetchError } = await supabase
        .from('cards')
        .select('tag_ids')
        .eq('id', cardId)
        .single();

      if (fetchError) {
        console.error('Error fetching card:', fetchError);
        return false;
      }

      // Merge new tag IDs with existing ones (avoid duplicates)
      const existingTags = card?.tag_ids || [];
      const updatedTags = [...new Set([...existingTags, ...tagIds])].sort();

      // Update the card with new tag_ids
      const { error: updateError } = await supabase
        .from('cards')
        .update({ tag_ids: updatedTags })
        .eq('id', cardId);

      if (updateError) {
        console.error('Error updating card tags:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error adding tags to card:', error);
      return false;
    }
  }

  // Remove tags from a card
  async removeTagsFromCard(cardId: string, tagIds: number[]): Promise<boolean> {
    try {
      // Get current tag_ids
      const { data: card, error: fetchError } = await supabase
        .from('cards')
        .select('tag_ids')
        .eq('id', cardId)
        .single();

      if (fetchError) {
        console.error('Error fetching card:', fetchError);
        return false;
      }

      // Remove specified tag IDs
      const existingTags = card?.tag_ids || [];
      const updatedTags = existingTags.filter(id => !tagIds.includes(id));

      // Update the card with new tag_ids
      const { error: updateError } = await supabase
        .from('cards')
        .update({ tag_ids: updatedTags })
        .eq('id', cardId);

      if (updateError) {
        console.error('Error updating card tags:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error removing tags from card:', error);
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
    
    let queryBuilder = supabase
      .from('cards')
      .select('*');

    // Apply color identity filter
    if (filters.colorIdentity && Array.isArray(filters.colorIdentity)) {
      // For now, just get all commander-legal cards and filter in JS
      // This is a simplified approach for compatibility
      queryBuilder = queryBuilder.eq('legalities->>commander', 'legal');
    }

    // Apply commander legality filter
    if (filters.legal_in_commander) {
      queryBuilder = queryBuilder.eq('legalities->>commander', 'legal');
    }

    const { data, error } = await queryBuilder
      .order('name')
      .limit(limit);

    if (error) {
      console.error('Error searching cards by filters:', error);
      return [];
    }

    console.log(`✅ Found ${data?.length || 0} cards matching filters`);
    return data || [];
  }

  // Search cards by name (compatibility method)
  async searchByName(query: string, limit: number = 20): Promise<any[]> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (error) {
      console.error('Error searching cards by name:', error);
      return [];
    }

    // For performance, only add full tag details if it's a small result set
    if (limit <= 100 && data && data.length <= 100) {
      await this.loadTagsCache();
      
      return data.map(card => ({
        ...card,
        mechanic_tags: (card.tag_ids || []).map((tagId: number) => {
          const tag = this.tagsCache.get(tagId);
          if (!tag) return null;
          
          return {
            tag_name: tag.name,
            tag_category: tag.category,
            priority: 5,
            confidence: 0.95,
            evidence: [],
            is_manual: false,
            name: tag.name,
            category: tag.category
          };
        }).filter((tag: any) => tag !== null)
      }));
    }

    return data || [];
  }

  // Get card by ID (compatibility method)
  async getCardById(id: string): Promise<CardRecord | null> {
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error getting card by ID:', error);
      return null;
    }

    return data;
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
    const { data, error } = await supabase
      .from('cards')
      .select('*')
      .eq('name', name)
      .single();

    if (error || !data) {
      console.error('Error getting card by name:', error);
      return null;
    }

    // Load tags cache if needed
    await this.loadTagsCache();

    // Convert tag_ids to mechanic_tags format for backward compatibility
    const mechanicTags = (data.tag_ids || []).map(tagId => {
      const tag = this.tagsCache.get(tagId);
      if (!tag) return null;
      
      return {
        tag_name: tag.name,
        tag_category: tag.category,
        priority: 5, // Default priority
        confidence: 0.95, // Default confidence
        evidence: [], // No evidence data in new system
        is_manual: false, // All tags are automatic in new system
        name: tag.name, // Legacy support
        category: tag.category // Legacy support
      };
    }).filter(tag => tag !== null);

    return {
      ...data,
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
}

// Export a singleton instance
export const database = new SupabaseCardDatabase();
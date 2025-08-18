import { ScryfallCard } from './types';
import { mtgjsonComprehensive } from './mtgjson-comprehensive';

/**
 * Local MTGJSON file integration service
 * Handles both local file data and API fallbacks
 */

interface LocalMTGJSONFile {
  name: string;
  code: string;
  releaseDate: string;
  type: string;
  cards?: Array<{
    name: string;
    manaCost?: string;
    cmc?: number;
    type: string;
    text?: string;
    colorIdentity?: string[];
    colors?: string[];
    legalities?: Record<string, string>;
    rarity?: string;
    multiverseid?: string;
    number?: string;
    artist?: string;
    power?: string;
    toughness?: string;
    loyalty?: string;
  }>;
}

class MTGJSONLocalService {
  private localSetData: Map<string, LocalMTGJSONFile> = new Map();
  private isInitialized = false;

  /**
   * Initialize local data from the mtgjson folder
   */
  async initializeLocalData(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Note: In a real implementation, you would scan the local mtgjson folder
      // For now, we'll provide integration points for when local files are available
      console.log('🔧 MTGJSON Local Service initialized (offline mode ready)');
      this.isInitialized = true;
    } catch (error) {
      console.warn('⚠️ Could not initialize local MTGJSON data:', error);
    }
  }

  /**
   * Load a specific set from local files
   * Falls back to API if local file not available
   */
  async loadSet(setCode: string): Promise<LocalMTGJSONFile | null> {
    await this.initializeLocalData();

    // Check if we have local data first
    if (this.localSetData.has(setCode)) {
      return this.localSetData.get(setCode)!;
    }

    try {
      // Try to load from local file system (in a real implementation)
      // For now, fall back to API
      console.log(`📁 Loading set ${setCode} from API (local file not found)`);
      
      // This would be replaced with actual file reading in a production setup
      const data = await this.loadSetFromAPI(setCode);
      if (data) {
        this.localSetData.set(setCode, data);
      }
      return data;
    } catch (error) {
      console.error(`Failed to load set ${setCode}:`, error);
      return null;
    }
  }

  /**
   * Fallback to API when local files aren't available
   */
  private async loadSetFromAPI(setCode: string): Promise<LocalMTGJSONFile | null> {
    try {
      // Use comprehensive service to get set data
      const allPrintings = await mtgjsonComprehensive.fetchAllPrintings();
      const set = allPrintings[setCode];
      
      if (!set) return null;

      return {
        name: set.name,
        code: set.code,
        releaseDate: set.releaseDate,
        type: set.type,
        cards: set.cards?.map(card => ({
          name: card.name,
          manaCost: card.manaCost,
          cmc: card.manaValue,
          type: card.type || '',
          text: card.text,
          colorIdentity: card.colorIdentity,
          colors: card.colors,
          legalities: card.legalities as Record<string, string>,
          rarity: card.rarity,
          multiverseid: card.identifiers?.multiverseId,
          number: card.number,
          artist: card.artist,
          power: card.power,
          toughness: card.toughness,
          loyalty: card.loyalty
        }))
      };
    } catch (error) {
      console.error(`API fallback failed for set ${setCode}:`, error);
      return null;
    }
  }

  /**
   * Get recommendations for loading specific sets based on Commander format
   */
  getRecommendedSetsForCommander(): string[] {
    return [
      // Core/Base sets commonly used in Commander
      'M21', 'M20', 'M19', // Core sets
      'CMR', 'CM2', 'C21', 'C20', 'C19', 'C18', 'C17', 'C16', 'C15', 'C14', 'C13', // Commander products
      'MH3', 'MH2', 'MH1', // Modern Horizons (Commander staples)
      'KHM', 'ZNR', 'IKO', 'THB', 'ELD', 'WAR', 'RNA', 'GRN', // Recent standard sets
      'SOI', 'EMN', 'XLN', 'RIX', 'DOM', // Popular sets
      'TSP', 'PLC', 'FUT', // Time Spiral block (many reprints)
      'LTR', 'WOE', 'LCI', // Recent special sets
      'NEO', 'SNC', 'DMU', 'BRO' // Recent popular sets
    ];
  }

  /**
   * Batch load recommended sets for Commander
   */
  async loadRecommendedSets(): Promise<{
    loaded: string[];
    failed: string[];
    totalCards: number;
  }> {
    const recommendedSets = this.getRecommendedSetsForCommander();
    const loaded: string[] = [];
    const failed: string[] = [];
    let totalCards = 0;

    console.log(`📚 Loading ${recommendedSets.length} recommended Commander sets...`);

    for (const setCode of recommendedSets) {
      try {
        const setData = await this.loadSet(setCode);
        if (setData) {
          loaded.push(setCode);
          totalCards += setData.cards?.length || 0;
          console.log(`✅ Loaded ${setCode}: ${setData.name} (${setData.cards?.length || 0} cards)`);
        } else {
          failed.push(setCode);
          console.log(`❌ Failed to load ${setCode}`);
        }
      } catch (error) {
        failed.push(setCode);
        console.error(`Error loading ${setCode}:`, error);
      }
    }

    console.log(`📊 Batch load complete: ${loaded.length} sets loaded, ${totalCards} total cards`);

    return { loaded, failed, totalCards };
  }

  /**
   * Search cards across loaded sets
   */
  searchLoadedSets(query: {
    name?: string;
    type?: string;
    colorIdentity?: string[];
    commanderLegal?: boolean;
  }): ScryfallCard[] {
    const results: ScryfallCard[] = [];

    for (const [setCode, setData] of this.localSetData) {
      if (!setData.cards) continue;

      for (const card of setData.cards) {
        // Apply filters
        if (query.name && !card.name.toLowerCase().includes(query.name.toLowerCase())) {
          continue;
        }

        if (query.type && !card.type.toLowerCase().includes(query.type.toLowerCase())) {
          continue;
        }

        if (query.colorIdentity) {
          const cardColorIdentity = card.colorIdentity || [];
          const queryColorIdentity = query.colorIdentity;
          
          // Check if card's color identity is within the query's color identity
          if (!cardColorIdentity.every(color => queryColorIdentity.includes(color))) {
            continue;
          }
        }

        if (query.commanderLegal && card.legalities?.commander !== 'legal') {
          continue;
        }

        // Convert to ScryfallCard format
        const scryfallCard: ScryfallCard = {
          id: `${setCode}-${card.number || card.name}`, // Generate ID
          name: card.name,
          mana_cost: card.manaCost,
          cmc: card.cmc || 0,
          type_line: card.type,
          oracle_text: card.text,
          color_identity: card.colorIdentity || [],
          colors: card.colors,
          legalities: {
            commander: card.legalities?.commander as any || 'not_legal',
            legacy: card.legalities?.legacy as any,
            vintage: card.legalities?.vintage as any,
            modern: card.legalities?.modern as any,
            pioneer: card.legalities?.pioneer as any,
            standard: card.legalities?.standard as any,
            pauper: card.legalities?.pauper as any,
            historic: card.legalities?.historic as any,
            brawl: card.legalities?.brawl as any
          },
          prices: {
            usd: undefined,
            usd_foil: undefined,
            eur: undefined,
            tix: undefined
          },
          set: setCode,
          keywords: []
        };

        results.push(scryfallCard);
      }
    }

    return results;
  }

  /**
   * Get status of local data
   */
  getLocalDataStatus(): {
    isInitialized: boolean;
    loadedSets: number;
    totalCards: number;
    loadedSetCodes: string[];
  } {
    const totalCards = Array.from(this.localSetData.values())
      .reduce((sum, set) => sum + (set.cards?.length || 0), 0);

    return {
      isInitialized: this.isInitialized,
      loadedSets: this.localSetData.size,
      totalCards,
      loadedSetCodes: Array.from(this.localSetData.keys())
    };
  }

  /**
   * Clear local cache
   */
  clearLocalCache(): void {
    this.localSetData.clear();
    this.isInitialized = false;
    console.log('🗑️ Local MTGJSON cache cleared');
  }
}

// Export singleton instance
export const mtgjsonLocal = new MTGJSONLocalService();

// Helper functions
export async function loadCommanderRecommendedSets() {
  return await mtgjsonLocal.loadRecommendedSets();
}

export async function searchLocalMTGJSONCards(query: {
  name?: string;
  type?: string;
  colorIdentity?: string[];
  commanderLegal?: boolean;
}): Promise<ScryfallCard[]> {
  return mtgjsonLocal.searchLoadedSets(query);
}

export function getLocalMTGJSONStatus() {
  return mtgjsonLocal.getLocalDataStatus();
}
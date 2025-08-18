import { ScryfallCard } from './types';

// MTGJSON comprehensive data types
interface MTGJSONCard {
  artist?: string;
  artistIds?: string[];
  asciiName?: string;
  availability?: string[];
  boosterTypes?: string[];
  borderColor?: string;
  cardKingdomEtchedId?: string;
  cardKingdomFoilId?: string;
  cardKingdomId?: string;
  colorIdentity?: string[];
  colorIndicator?: string[];
  colors?: string[];
  convertedManaCost?: number;
  count?: number;
  edhrecRank?: number;
  edhrecSaltiness?: number;
  faceConvertedManaCost?: number;
  faceManaValue?: number;
  faceName?: string;
  finishes?: string[];
  flavorName?: string;
  flavorText?: string;
  foreignData?: Array<{
    flavorText?: string;
    language?: string;
    multiverseId?: number;
    name?: string;
    text?: string;
    type?: string;
  }>;
  frameEffects?: string[];
  frameVersion?: string;
  hand?: string;
  hasAlternativeDeckLimit?: boolean;
  hasContentWarning?: boolean;
  identifiers?: {
    cardKingdomEtchedId?: string;
    cardKingdomFoilId?: string;
    cardKingdomId?: string;
    cardsphereId?: string;
    mcmId?: string;
    mcmMetaId?: string;
    mtgArenaId?: string;
    mtgoFoilId?: string;
    mtgoId?: string;
    mtgjsonFoilVersionId?: string;
    mtgjsonNonFoilVersionId?: string;
    mtgjsonV4Id?: string;
    multiverseId?: string;
    scryfallId?: string;
    scryfallOracleId?: string;
    scryfallIllustrationId?: string;
    tcgplayerProductId?: string;
    tcgplayerEtchedProductId?: string;
  };
  isAlternative?: boolean;
  isFullArt?: boolean;
  isFunny?: boolean;
  isOnlineOnly?: boolean;
  isOversized?: boolean;
  isPromo?: boolean;
  isRebalanced?: boolean;
  isReprint?: boolean;
  isReserved?: boolean;
  isStarter?: boolean;
  isStorySpotlight?: boolean;
  isTextless?: boolean;
  isTimeshifted?: boolean;
  keywords?: string[];
  language?: string;
  layout?: string;
  leadershipSkills?: {
    brawl?: boolean;
    commander?: boolean;
    oathbreaker?: boolean;
  };
  legalities?: {
    alchemy?: string;
    brawl?: string;
    commander?: string;
    duel?: string;
    explorer?: string;
    future?: string;
    gladiator?: string;
    historic?: string;
    historicbrawl?: string;
    legacy?: string;
    modern?: string;
    oathbreaker?: string;
    oldschool?: string;
    pauper?: string;
    paupercommander?: string;
    penny?: string;
    pioneer?: string;
    predh?: string;
    premodern?: string;
    standard?: string;
    standardbrawl?: string;
    timeless?: string;
    vintage?: string;
  };
  life?: string;
  loyalty?: string;
  manaCost?: string;
  manaValue?: number;
  name: string;
  number?: string;
  originalPrintings?: string[];
  originalReleaseDate?: string;
  originalText?: string;
  originalType?: string;
  otherFaceIds?: string[];
  power?: string;
  printings?: string[];
  promoTypes?: string[];
  purchaseUrls?: {
    cardKingdom?: string;
    cardKingdomEtched?: string;
    cardKingdomFoil?: string;
    cardmarket?: string;
    tcgplayer?: string;
    tcgplayerEtched?: string;
  };
  rarity?: string;
  rebalancedPrintings?: string[];
  relatedCards?: {
    reverseRelated?: string[];
    spellbook?: string[];
  };
  securityStamp?: string;
  setCode?: string;
  side?: string;
  signature?: string;
  subsets?: string[];
  subtypes?: string[];
  supertypes?: string[];
  text?: string;
  toughness?: string;
  type?: string;
  types?: string[];
  uuid: string;
  variations?: string[];
  watermark?: string;
}

interface MTGJSONSet {
  baseSetSize?: number;
  block?: string;
  booster?: any;
  cards?: MTGJSONCard[];
  cardsphere?: {
    url?: string;
  };
  code: string;
  codeV3?: string;
  isForeignOnly?: boolean;
  isFoilOnly?: boolean;
  isNonFoilOnly?: boolean;
  isOnlineOnly?: boolean;
  isPaperOnly?: boolean;
  isPartialPreview?: boolean;
  keyruneCode?: string;
  languages?: string[];
  mcmId?: number;
  mcmIdExtras?: number;
  mcmName?: string;
  mtgoCode?: string;
  name: string;
  parentCode?: string;
  releaseDate: string;
  sealedProduct?: Array<{
    category?: string;
    identifiers?: {
      cardKingdomId?: string;
      mcmId?: string;
      tcgplayerProductId?: string;
    };
    name?: string;
    productSize?: number;
    purchaseUrls?: {
      cardKingdom?: string;
      cardmarket?: string;
      tcgplayer?: string;
    };
    releaseDate?: string;
    subtype?: string;
    uuid?: string;
  }>;
  tcgplayerGroupId?: number;
  tokens?: MTGJSONCard[];
  totalSetSize?: number;
  translations?: Record<string, string>;
  type: string;
}

interface MTGJSONSetList {
  baseSetSize: number;
  block?: string;
  code: string;
  codeV3?: string;
  isForeignOnly: boolean;
  isFoilOnly: boolean;
  isNonFoilOnly?: boolean;
  isOnlineOnly: boolean;
  isPaperOnly?: boolean;
  isPartialPreview: boolean;
  keyruneCode: string;
  mcmId?: number;
  mcmIdExtras?: number;
  mcmName?: string;
  mtgoCode?: string;
  name: string;
  parentCode?: string;
  releaseDate: string;
  sealedProduct?: any[];
  tcgplayerGroupId?: number;
  totalSetSize: number;
  translations: Record<string, string>;
  type: string;
}

interface MTGJSONCombo {
  colorIdentity?: string[];
  commanderSpellbookId?: number;
  description?: string;
  status?: string;
  uses?: Array<{
    card?: MTGJSONCard;
    zoneLocations?: string[];
  }>;
  produces?: Array<{
    feature?: {
      name?: string;
      uncategorized?: boolean;
    };
  }>;
}

class MTGJSONComprehensiveService {
  private allPrintingsData: Record<string, MTGJSONSet> | null = null;
  private atomicCardsData: Record<string, MTGJSONCard> | null = null;
  private setListData: MTGJSONSetList[] | null = null;
  private combosData: MTGJSONCombo[] | null = null;
  private lastFetchDate: Record<string, string> = {};
  private isLoading: Record<string, boolean> = {};

  /**
   * Fetch comprehensive AllPrintings.json data (warning: very large file ~500MB+)
   */
  async fetchAllPrintings(): Promise<Record<string, MTGJSONSet>> {
    const cacheKey = 'allPrintings';
    const today = new Date().toISOString().split('T')[0];
    
    if (this.allPrintingsData && this.lastFetchDate[cacheKey] === today) {
      return this.allPrintingsData;
    }

    if (this.isLoading[cacheKey]) {
      while (this.isLoading[cacheKey]) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return this.allPrintingsData || {};
    }

    this.isLoading[cacheKey] = true;
    
    try {
      console.log('📥 Fetching MTGJSON AllPrintings data (this may take a while - large file)...');
      const response = await fetch('https://mtgjson.com/api/v5/AllPrintings.json', {
        headers: {
          'User-Agent': 'Commander-Deck-Generator/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data.data) {
        throw new Error('Invalid MTGJSON AllPrintings data format');
      }

      this.allPrintingsData = data.data;
      this.lastFetchDate[cacheKey] = today;
      
      const setCount = Object.keys(this.allPrintingsData).length;
      const totalCards = Object.values(this.allPrintingsData)
        .reduce((sum, set) => sum + (set.cards?.length || 0), 0);
      
      console.log(`✅ MTGJSON AllPrintings loaded: ${setCount} sets, ${totalCards} total cards`);
      
      return this.allPrintingsData;
    } catch (error) {
      console.error('❌ Failed to fetch MTGJSON AllPrintings:', error);
      console.log('💡 Consider downloading AllPrintings.json locally for better performance');
      return {};
    } finally {
      this.isLoading[cacheKey] = false;
    }
  }

  /**
   * Fetch AtomicCards.json data (unique cards, not printings)
   */
  async fetchAtomicCards(): Promise<Record<string, MTGJSONCard>> {
    const cacheKey = 'atomicCards';
    const today = new Date().toISOString().split('T')[0];
    
    if (this.atomicCardsData && this.lastFetchDate[cacheKey] === today) {
      return this.atomicCardsData;
    }

    if (this.isLoading[cacheKey]) {
      while (this.isLoading[cacheKey]) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return this.atomicCardsData || {};
    }

    this.isLoading[cacheKey] = true;
    
    try {
      console.log('📥 Fetching MTGJSON AtomicCards data...');
      const response = await fetch('https://mtgjson.com/api/v5/AtomicCards.json', {
        headers: {
          'User-Agent': 'Commander-Deck-Generator/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data.data) {
        throw new Error('Invalid MTGJSON AtomicCards data format');
      }

      this.atomicCardsData = data.data;
      this.lastFetchDate[cacheKey] = today;
      
      const cardCount = Object.keys(this.atomicCardsData).length;
      console.log(`✅ MTGJSON AtomicCards loaded: ${cardCount} unique cards`);
      
      return this.atomicCardsData;
    } catch (error) {
      console.error('❌ Failed to fetch MTGJSON AtomicCards:', error);
      return {};
    } finally {
      this.isLoading[cacheKey] = false;
    }
  }

  /**
   * Fetch SetList.json data
   */
  async fetchSetList(): Promise<MTGJSONSetList[]> {
    const cacheKey = 'setList';
    const today = new Date().toISOString().split('T')[0];
    
    if (this.setListData && this.lastFetchDate[cacheKey] === today) {
      return this.setListData;
    }

    if (this.isLoading[cacheKey]) {
      while (this.isLoading[cacheKey]) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.setListData || [];
    }

    this.isLoading[cacheKey] = true;
    
    try {
      console.log('📥 Fetching MTGJSON SetList data...');
      const response = await fetch('https://mtgjson.com/api/v5/SetList.json', {
        headers: {
          'User-Agent': 'Commander-Deck-Generator/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data.data) {
        throw new Error('Invalid MTGJSON SetList data format');
      }

      this.setListData = data.data;
      this.lastFetchDate[cacheKey] = today;
      
      console.log(`✅ MTGJSON SetList loaded: ${this.setListData.length} sets`);
      
      return this.setListData;
    } catch (error) {
      console.error('❌ Failed to fetch MTGJSON SetList:', error);
      return [];
    } finally {
      this.isLoading[cacheKey] = false;
    }
  }

  /**
   * Convert MTGJSON card to Scryfall-compatible format
   */
  convertToScryfallFormat(mtgjsonCard: MTGJSONCard): ScryfallCard {
    return {
      id: mtgjsonCard.uuid,
      name: mtgjsonCard.name,
      mana_cost: mtgjsonCard.manaCost,
      cmc: mtgjsonCard.manaValue || mtgjsonCard.convertedManaCost || 0,
      type_line: mtgjsonCard.type || '',
      oracle_text: mtgjsonCard.text,
      color_identity: mtgjsonCard.colorIdentity || [],
      colors: mtgjsonCard.colors,
      legalities: {
        commander: mtgjsonCard.legalities?.commander as any || 'not_legal',
        legacy: mtgjsonCard.legalities?.legacy as any,
        vintage: mtgjsonCard.legalities?.vintage as any,
        modern: mtgjsonCard.legalities?.modern as any,
        pioneer: mtgjsonCard.legalities?.pioneer as any,
        standard: mtgjsonCard.legalities?.standard as any,
        pauper: mtgjsonCard.legalities?.pauper as any,
        historic: mtgjsonCard.legalities?.historic as any,
        brawl: mtgjsonCard.legalities?.brawl as any
      },
      prices: {
        // Note: MTGJSON doesn't include pricing in card data
        // Use separate pricing service for this
        usd: undefined,
        usd_foil: undefined,
        eur: undefined,
        tix: undefined
      },
      edhrec_rank: mtgjsonCard.edhrecRank,
      keywords: mtgjsonCard.keywords,
      set: mtgjsonCard.setCode,
      image_uris: {
        // Generate Scryfall image URLs from identifiers
        small: `https://cards.scryfall.io/small/front/${mtgjsonCard.identifiers?.scryfallId?.charAt(0)}/${mtgjsonCard.identifiers?.scryfallId?.charAt(1)}/${mtgjsonCard.identifiers?.scryfallId}.jpg`,
        normal: `https://cards.scryfall.io/normal/front/${mtgjsonCard.identifiers?.scryfallId?.charAt(0)}/${mtgjsonCard.identifiers?.scryfallId?.charAt(1)}/${mtgjsonCard.identifiers?.scryfallId}.jpg`,
        large: `https://cards.scryfall.io/large/front/${mtgjsonCard.identifiers?.scryfallId?.charAt(0)}/${mtgjsonCard.identifiers?.scryfallId?.charAt(1)}/${mtgjsonCard.identifiers?.scryfallId}.jpg`,
        png: `https://cards.scryfall.io/png/front/${mtgjsonCard.identifiers?.scryfallId?.charAt(0)}/${mtgjsonCard.identifiers?.scryfallId?.charAt(1)}/${mtgjsonCard.identifiers?.scryfallId}.jpg`,
        art_crop: `https://cards.scryfall.io/art_crop/front/${mtgjsonCard.identifiers?.scryfallId?.charAt(0)}/${mtgjsonCard.identifiers?.scryfallId?.charAt(1)}/${mtgjsonCard.identifiers?.scryfallId}.jpg`,
        border_crop: `https://cards.scryfall.io/border_crop/front/${mtgjsonCard.identifiers?.scryfallId?.charAt(0)}/${mtgjsonCard.identifiers?.scryfallId?.charAt(1)}/${mtgjsonCard.identifiers?.scryfallId}.jpg`
      }
    };
  }

  /**
   * Search for cards using MTGJSON data
   */
  async searchCards(query: {
    name?: string;
    colors?: string[];
    colorIdentity?: string[];
    types?: string[];
    commanderLegal?: boolean;
    setCode?: string;
    limit?: number;
  }): Promise<ScryfallCard[]> {
    const atomicCards = await this.fetchAtomicCards();
    
    let results = Object.values(atomicCards);

    // Filter by name
    if (query.name) {
      const searchName = query.name.toLowerCase();
      results = results.filter(card => 
        card.name.toLowerCase().includes(searchName)
      );
    }

    // Filter by color identity
    if (query.colorIdentity) {
      results = results.filter(card => {
        const cardColorIdentity = card.colorIdentity || [];
        return query.colorIdentity!.every(color => cardColorIdentity.includes(color)) &&
               cardColorIdentity.every(color => query.colorIdentity!.includes(color));
      });
    }

    // Filter by colors
    if (query.colors) {
      results = results.filter(card => {
        const cardColors = card.colors || [];
        return query.colors!.some(color => cardColors.includes(color));
      });
    }

    // Filter by types
    if (query.types) {
      results = results.filter(card => {
        const cardType = (card.type || '').toLowerCase();
        return query.types!.some(type => cardType.includes(type.toLowerCase()));
      });
    }

    // Filter by Commander legality
    if (query.commanderLegal) {
      results = results.filter(card => 
        card.legalities?.commander === 'legal'
      );
    }

    // Filter by set
    if (query.setCode) {
      results = results.filter(card => 
        card.setCode === query.setCode
      );
    }

    // Apply limit
    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    // Convert to Scryfall format
    return results.map(card => this.convertToScryfallFormat(card));
  }

  /**
   * Get enhanced card data with MTGJSON information
   */
  async getEnhancedCardData(cardName: string): Promise<{
    card: ScryfallCard;
    mtgjsonData: MTGJSONCard;
    allPrintings: MTGJSONCard[];
    setInfo?: MTGJSONSetList;
  } | null> {
    const atomicCards = await this.fetchAtomicCards();
    const setList = await this.fetchSetList();
    
    const atomicCard = atomicCards[cardName];
    if (!atomicCard) {
      return null;
    }

    // Get all printings of this card
    const allPrintings: MTGJSONCard[] = [];
    if (atomicCard.printings) {
      try {
        const allPrintingsData = await this.fetchAllPrintings();
        for (const setCode of atomicCard.printings) {
          const set = allPrintingsData[setCode];
          if (set?.cards) {
            const printing = set.cards.find(c => c.name === cardName);
            if (printing) {
              allPrintings.push(printing);
            }
          }
        }
      } catch (error) {
        console.warn('Could not fetch all printings data:', error);
      }
    }

    // Get set information
    const setInfo = atomicCard.setCode ? 
      setList.find(set => set.code === atomicCard.setCode) : undefined;

    return {
      card: this.convertToScryfallFormat(atomicCard),
      mtgjsonData: atomicCard,
      allPrintings,
      setInfo
    };
  }

  /**
   * Get data status for monitoring
   */
  async getDataStatus(): Promise<{
    atomicCards: { loaded: boolean; count: number; lastFetch?: string };
    allPrintings: { loaded: boolean; setCount: number; cardCount: number; lastFetch?: string };
    setList: { loaded: boolean; count: number; lastFetch?: string };
  }> {
    return {
      atomicCards: {
        loaded: this.atomicCardsData !== null,
        count: this.atomicCardsData ? Object.keys(this.atomicCardsData).length : 0,
        lastFetch: this.lastFetchDate['atomicCards']
      },
      allPrintings: {
        loaded: this.allPrintingsData !== null,
        setCount: this.allPrintingsData ? Object.keys(this.allPrintingsData).length : 0,
        cardCount: this.allPrintingsData ? 
          Object.values(this.allPrintingsData).reduce((sum, set) => sum + (set.cards?.length || 0), 0) : 0,
        lastFetch: this.lastFetchDate['allPrintings']
      },
      setList: {
        loaded: this.setListData !== null,
        count: this.setListData ? this.setListData.length : 0,
        lastFetch: this.lastFetchDate['setList']
      }
    };
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.allPrintingsData = null;
    this.atomicCardsData = null;
    this.setListData = null;
    this.combosData = null;
    this.lastFetchDate = {};
    console.log('🗑️ MTGJSON comprehensive cache cleared');
  }
}

// Export singleton instance
export const mtgjsonComprehensive = new MTGJSONComprehensiveService();

// Helper functions
export async function searchMTGJSONCards(query: {
  name?: string;
  colors?: string[];
  colorIdentity?: string[];
  types?: string[];
  commanderLegal?: boolean;
  setCode?: string;
  limit?: number;
}): Promise<ScryfallCard[]> {
  return await mtgjsonComprehensive.searchCards(query);
}

export async function getEnhancedCardData(cardName: string) {
  return await mtgjsonComprehensive.getEnhancedCardData(cardName);
}

export type { MTGJSONCard, MTGJSONSet, MTGJSONSetList };
import { ScryfallCard } from './types';

interface MTGJSONPricePoints {
  etched?: Record<string, number>;
  foil?: Record<string, number>;
  normal?: Record<string, number>;
}

interface MTGJSONPriceList {
  buylist?: MTGJSONPricePoints;
  currency: string;
  retail?: MTGJSONPricePoints;
}

interface MTGJSONPriceFormats {
  paper?: {
    tcgplayer?: MTGJSONPriceList;
    cardkingdom?: MTGJSONPriceList;
    cardmarket?: MTGJSONPriceList;
    cardsphere?: MTGJSONPriceList;
  };
  mtgo?: {
    cardhoarder?: MTGJSONPriceList;
  };
}

interface MTGJSONPricingData {
  [uuid: string]: MTGJSONPriceFormats;
}

class MTGJSONPricingService {
  private pricingData: MTGJSONPricingData | null = null;
  private lastFetchDate: string | null = null;
  private isLoading = false;

  private async fetchPricingData(): Promise<MTGJSONPricingData> {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Check if we already have today's data
    if (this.pricingData && this.lastFetchDate === today) {
      return this.pricingData;
    }

    // Prevent multiple simultaneous fetches
    if (this.isLoading) {
      // Wait for current fetch to complete
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.pricingData || {};
    }

    this.isLoading = true;
    
    try {
      console.log('📥 Fetching MTGJSON pricing data...');
      const response = await fetch('https://mtgjson.com/api/v5/AllPricesToday.json', {
        headers: {
          'User-Agent': 'Commander-Deck-Generator/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data.data) {
        throw new Error('Invalid MTGJSON pricing data format');
      }

      this.pricingData = data.data;
      this.lastFetchDate = today;
      
      console.log(`✅ MTGJSON pricing data loaded (${Object.keys(this.pricingData).length} cards)`);
      
      return this.pricingData;
    } catch (error) {
      console.error('❌ Failed to fetch MTGJSON pricing data:', error);
      // Return empty object so we fall back to Scryfall pricing
      return {};
    } finally {
      this.isLoading = false;
    }
  }

  async getCardPrice(
    card: ScryfallCard, 
    preferCheapest = false,
    preferredProvider: 'tcgplayer' | 'cardkingdom' | 'cardmarket' | 'cardsphere' = 'tcgplayer'
  ): Promise<{ price: number; source: string }> {
    try {
      const pricingData = await this.fetchPricingData();
      
      // Look up card by UUID
      const cardPricing = pricingData[card.id];
      if (!cardPricing?.paper?.[preferredProvider]?.retail) {
        return await this.fallbackToScryfallPrice(card, preferCheapest);
      }

      const retail = cardPricing.paper[preferredProvider].retail!;
      const today = new Date().toISOString().split('T')[0];
      
      // Try to get price for today, fall back to most recent available
      const prices: number[] = [];
      
      // Check normal, foil, etched in order of preference
      const finishTypes = ['normal', 'foil', 'etched'] as const;
      
      for (const finish of finishTypes) {
        const finishPrices = retail[finish];
        if (!finishPrices) continue;
        
        // Try today's price first
        if (finishPrices[today]) {
          prices.push(finishPrices[today]);
        } else {
          // Get most recent price
          const dates = Object.keys(finishPrices).sort().reverse();
          if (dates.length > 0) {
            prices.push(finishPrices[dates[0]]);
          }
        }
      }

      if (prices.length === 0) {
        return await this.fallbackToScryfallPrice(card, preferCheapest);
      }

      const finalPrice = preferCheapest ? Math.min(...prices) : prices[0];
      
      return {
        price: finalPrice,
        source: `MTGJSON-${preferredProvider}`
      };
      
    } catch (error) {
      console.error(`Error getting MTGJSON price for ${card.name}:`, error);
      return await this.fallbackToScryfallPrice(card, preferCheapest);
    }
  }

  private async fallbackToScryfallPrice(card: ScryfallCard, preferCheapest: boolean): Promise<{ price: number; source: string }> {
    // First try local Scryfall data
    const usdPrice = card.prices.usd;
    const usdFoilPrice = card.prices.usd_foil;
    
    if (usdPrice || usdFoilPrice) {
      const prices = [usdPrice, usdFoilPrice]
        .filter((price): price is string => price !== null && price !== undefined)
        .map(price => parseFloat(price))
        .filter(price => !isNaN(price));
      
      if (prices.length > 0) {
        const finalPrice = preferCheapest ? Math.min(...prices) : prices[0];
        return { price: finalPrice, source: 'Scryfall-local' };
      }
    }
    
    // If local data is missing/invalid, try Scryfall API
    try {
      const { fetchScryfallPrice } = await import('./scryfall-pricing');
      const apiPrice = await fetchScryfallPrice(card, preferCheapest);
      if (apiPrice > 0) {
        return { price: apiPrice, source: 'Scryfall-API' };
      }
    } catch (error) {
      console.warn(`Scryfall API fallback failed for ${card.name}:`, error);
    }
    
    // Final fallback: rarity-based estimates
    const rarityPrices = {
      'mythic': 5.00,
      'rare': 1.50,
      'uncommon': 0.25,
      'common': 0.10
    };
    
    const estimatedPrice = rarityPrices[card.rarity?.toLowerCase() as keyof typeof rarityPrices] || 0.50;
    // Using rarity estimate for pricing
    
    return { price: estimatedPrice, source: 'rarity-estimate' };
  }

  async getBatchCardPrices(
    cards: ScryfallCard[], 
    preferCheapest = false,
    preferredProvider: 'tcgplayer' | 'cardkingdom' | 'cardmarket' | 'cardsphere' = 'tcgplayer'
  ): Promise<Array<{ card: ScryfallCard; price: number; source: string }>> {
    // Fetch pricing data once for the entire batch
    await this.fetchPricingData();
    
    // Process all cards in parallel
    const results = await Promise.all(
      cards.map(async (card) => {
        const { price, source } = await this.getCardPrice(card, preferCheapest, preferredProvider);
        return { card, price, source };
      })
    );
    
    return results;
  }

  // Method to check if MTGJSON data is available and fresh
  async getDataStatus(): Promise<{
    isAvailable: boolean;
    lastFetchDate: string | null;
    cardCount: number;
    isToday: boolean;
  }> {
    const today = new Date().toISOString().split('T')[0];
    
    try {
      await this.fetchPricingData();
      
      return {
        isAvailable: this.pricingData !== null,
        lastFetchDate: this.lastFetchDate,
        cardCount: this.pricingData ? Object.keys(this.pricingData).length : 0,
        isToday: this.lastFetchDate === today
      };
    } catch (error) {
      return {
        isAvailable: false,
        lastFetchDate: null,
        cardCount: 0,
        isToday: false
      };
    }
  }

  // Clear cached data (useful for testing or forcing refresh)
  clearCache(): void {
    this.pricingData = null;
    this.lastFetchDate = null;
    console.log('🗑️ MTGJSON pricing cache cleared');
  }
}

// Export singleton instance
export const mtgjsonPricing = new MTGJSONPricingService();

// Enhanced price extraction function that uses MTGJSON first
export async function extractCardPriceEnhanced(
  card: ScryfallCard, 
  preferCheapest = false,
  provider: 'tcgplayer' | 'cardkingdom' | 'cardmarket' | 'cardsphere' = 'tcgplayer'
): Promise<{ price: number; source: string }> {
  return await mtgjsonPricing.getCardPrice(card, preferCheapest, provider);
}

// Batch processing for better performance
export async function extractBatchCardPrices(
  cards: ScryfallCard[], 
  preferCheapest = false,
  provider: 'tcgplayer' | 'cardkingdom' | 'cardmarket' | 'cardsphere' = 'tcgplayer'
): Promise<Array<{ card: ScryfallCard; price: number; source: string }>> {
  return await mtgjsonPricing.getBatchCardPrices(cards, preferCheapest, provider);
}
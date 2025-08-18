import { ScryfallCard } from './types';

interface ScryfallApiCard {
  prices: {
    usd?: string | null;
    usd_foil?: string | null;
    eur?: string | null;
    tix?: string | null;
  };
  name: string;
  set: string;
  set_name: string;
}

class ScryfallPricingService {
  private cache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 1000 * 60 * 60; // 1 hour cache
  private readonly RATE_LIMIT_DELAY = 100; // 100ms between requests
  private lastRequestTime = 0;

  private async rateLimitedFetch(url: string): Promise<Response> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.RATE_LIMIT_DELAY) {
      await new Promise(resolve => 
        setTimeout(resolve, this.RATE_LIMIT_DELAY - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();
    return fetch(url);
  }

  async getCardPrice(card: ScryfallCard, preferCheapest = false): Promise<number> {
    // Check cache first
    const cacheKey = `${card.id}_${preferCheapest}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.price;
    }

    try {
      // First check if the card already has valid prices
      const localPrice = this.extractPriceFromCard(card, preferCheapest);
      if (localPrice > 0) {
        this.cache.set(cacheKey, { price: localPrice, timestamp: Date.now() });
        return localPrice;
      }

      // If no local price, fetch from Scryfall API
      console.log(`🔍 Fetching price for ${card.name} from Scryfall API...`);
      
      // Use the card's ID to get the exact card
      const response = await this.rateLimitedFetch(
        `https://api.scryfall.com/cards/${card.id}`
      );

      if (!response.ok) {
        // If specific card fetch fails, try searching by name
        const searchResponse = await this.rateLimitedFetch(
          `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}`
        );
        
        if (!searchResponse.ok) {
          console.error(`Failed to fetch price for ${card.name}`);
          return 0;
        }
        
        const searchData: ScryfallApiCard = await searchResponse.json();
        const price = this.extractPriceFromApiCard(searchData, preferCheapest);
        this.cache.set(cacheKey, { price, timestamp: Date.now() });
        return price;
      }

      const data: ScryfallApiCard = await response.json();
      const price = this.extractPriceFromApiCard(data, preferCheapest);
      
      this.cache.set(cacheKey, { price, timestamp: Date.now() });
      return price;
      
    } catch (error) {
      console.error(`Error fetching price for ${card.name}:`, error);
      return 0;
    }
  }

  async getBatchPrices(
    cards: ScryfallCard[], 
    preferCheapest = false
  ): Promise<Map<string, number>> {
    const prices = new Map<string, number>();
    
    // Process in batches to avoid rate limiting
    const BATCH_SIZE = 10;
    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      const batch = cards.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(card => this.getCardPrice(card, preferCheapest))
      );
      
      batch.forEach((card, index) => {
        prices.set(card.id, batchResults[index]);
      });
      
      // Small delay between batches
      if (i + BATCH_SIZE < cards.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    return prices;
  }

  private extractPriceFromCard(card: ScryfallCard, preferCheapest: boolean): number {
    const prices = card.prices || {};
    const usdPrice = prices.usd;
    const usdFoilPrice = prices.usd_foil;
    
    if (!usdPrice && !usdFoilPrice) {
      return 0;
    }
    
    const validPrices = [usdPrice, usdFoilPrice]
      .filter((price): price is string => price !== null && price !== undefined)
      .map(price => parseFloat(price))
      .filter(price => !isNaN(price) && price > 0);
    
    if (validPrices.length === 0) {
      return 0;
    }
    
    return preferCheapest ? Math.min(...validPrices) : validPrices[0];
  }

  private extractPriceFromApiCard(data: ScryfallApiCard, preferCheapest: boolean): number {
    const prices = data.prices || {};
    const usdPrice = prices.usd;
    const usdFoilPrice = prices.usd_foil;
    
    if (!usdPrice && !usdFoilPrice) {
      return 0;
    }
    
    const validPrices = [usdPrice, usdFoilPrice]
      .filter((price): price is string => price !== null && price !== undefined)
      .map(price => parseFloat(price))
      .filter(price => !isNaN(price) && price > 0);
    
    if (validPrices.length === 0) {
      return 0;
    }
    
    return preferCheapest ? Math.min(...validPrices) : validPrices[0];
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const scryfallPricingService = new ScryfallPricingService();

// Export main functions
export async function fetchScryfallPrice(
  card: ScryfallCard, 
  preferCheapest = false
): Promise<number> {
  return scryfallPricingService.getCardPrice(card, preferCheapest);
}

export async function fetchScryfallBatchPrices(
  cards: ScryfallCard[], 
  preferCheapest = false
): Promise<Map<string, number>> {
  return scryfallPricingService.getBatchPrices(cards, preferCheapest);
}
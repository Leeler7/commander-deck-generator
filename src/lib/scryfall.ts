import { ScryfallCard, ScryfallSearchResponse } from './types';

const SCRYFALL_API_BASE = 'https://api.scryfall.com';
const RATE_LIMIT_DELAY = 100; // 100ms between requests as per Scryfall guidelines

class RateLimiter {
  private lastRequestTime = 0;
  private requestQueue: Array<() => void> = [];
  private isProcessing = false;

  async executeRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) return;
    
    this.isProcessing = true;
    
    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      
      if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
        await new Promise(resolve => 
          setTimeout(resolve, RATE_LIMIT_DELAY - timeSinceLastRequest)
        );
      }
      
      const request = this.requestQueue.shift();
      if (request) {
        this.lastRequestTime = Date.now();
        await request();
      }
    }
    
    this.isProcessing = false;
  }
}

const rateLimiter = new RateLimiter();

async function fetchWithRetry(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited, implement exponential backoff
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      
      // Exponential backoff for network errors
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw new Error('Max retries exceeded');
}

export class ScryfallClient {
  async searchCards(query: string, page = 1, orderBy = 'edhrec'): Promise<ScryfallSearchResponse> {
    return rateLimiter.executeRequest(async () => {
      const url = new URL(`${SCRYFALL_API_BASE}/cards/search`);
      url.searchParams.set('q', query);
      url.searchParams.set('page', page.toString());
      
      // Add ordering - default to EDHREC ranking to avoid alphabetical bias
      if (orderBy) {
        url.searchParams.set('order', orderBy);
      }
      
      const response = await fetchWithRetry(url.toString());
      return response.json();
    });
  }

  async getCardByName(name: string, exact = true): Promise<ScryfallCard> {
    return rateLimiter.executeRequest(async () => {
      const url = new URL(`${SCRYFALL_API_BASE}/cards/named`);
      url.searchParams.set(exact ? 'exact' : 'fuzzy', name);
      
      const response = await fetchWithRetry(url.toString());
      return response.json();
    });
  }

  async getCardsByIds(ids: string[]): Promise<ScryfallCard[]> {
    return rateLimiter.executeRequest(async () => {
      const response = await fetchWithRetry(`${SCRYFALL_API_BASE}/cards/collection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifiers: ids.map(id => ({ id }))
        })
      });
      
      const data = await response.json();
      return data.data;
    });
  }

  async searchLegalCommanders(query = ''): Promise<ScryfallCard[]> {
    const baseQuery = 'is:commander legal:commander';
    const fullQuery = query ? `${baseQuery} ${query}` : baseQuery;
    
    try {
      const response = await this.searchCards(fullQuery, 1, 'edhrec');
      return response.data;
    } catch (error) {
      console.error('Error searching commanders:', error);
      return [];
    }
  }

  async searchCardsByColorIdentity(
    colorIdentity: string[],
    additionalQuery = '',
    orderBy = 'edhrec'
  ): Promise<ScryfallCard[]> {
    // Format color identity for Scryfall search
    const colorQuery = colorIdentity.length > 0 
      ? `id<=${colorIdentity.sort().join('')}` 
      : 'id:c'; // Colorless
    
    const query = [
      colorQuery,
      'f:commander',
      additionalQuery
    ].filter(Boolean).join(' ');
    
    try {
      const response = await this.searchCards(query, 1, orderBy);
      return response.data;
    } catch (error) {
      console.error('Error searching by color identity:', error);
      // Return empty array on error instead of throwing
      return [];
    }
  }

  async getBulkData(type: 'all_cards' | 'oracle_cards' = 'oracle_cards'): Promise<ScryfallCard[]> {
    return rateLimiter.executeRequest(async () => {
      // First get the bulk data info
      const bulkResponse = await fetchWithRetry(`${SCRYFALL_API_BASE}/bulk-data`);
      const bulkData = await bulkResponse.json();
      
      const targetBulk = bulkData.data.find((bulk: any) => bulk.type === type);
      if (!targetBulk) {
        throw new Error(`Bulk data type ${type} not found`);
      }
      
      // Download the actual bulk data
      const dataResponse = await fetchWithRetry(targetBulk.download_uri);
      return dataResponse.json();
    });
  }

  async validateCommander(name: string): Promise<{
    isValid: boolean;
    card?: ScryfallCard;
    error?: string;
  }> {
    try {
      const card = await this.getCardByName(name, true);
      
      // Check if it's legal in Commander format
      if (card.legalities.commander !== 'legal') {
        return {
          isValid: false,
          error: `${name} is not legal in Commander format`
        };
      }
      
      // Check if it's actually a legendary creature or planeswalker that can be a commander
      const isLegendaryCreature = card.type_line.includes('Legendary') && card.type_line.includes('Creature');
      const isPlaneswalkerCommander = card.type_line.includes('Planeswalker') && 
        card.oracle_text?.includes('can be your commander');
      
      if (!isLegendaryCreature && !isPlaneswalkerCommander) {
        return {
          isValid: false,
          error: `${name} cannot be a commander`
        };
      }
      
      return {
        isValid: true,
        card
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Could not find card: ${name}`
      };
    }
  }

  async getRandomCommander(): Promise<ScryfallCard | null> {
    return rateLimiter.executeRequest(async () => {
      console.log('🎲 Fetching random commander from Scryfall...');
      
      // Use Scryfall's random card endpoint with commander constraints
      const url = `${SCRYFALL_API_BASE}/cards/random?q=is%3Acommander`;
      const response = await fetchWithRetry(url);
      
      if (!response.ok) {
        console.error('Failed to fetch random commander:', response.status, response.statusText);
        return null;
      }
      
      const card = await response.json() as ScryfallCard;
      console.log(`✅ Got random commander: ${card.name}`);
      return card;
    });
  }
}

export const scryfallClient = new ScryfallClient();
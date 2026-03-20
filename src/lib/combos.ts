import { ComboResult, BracketEstimate } from './types';

const SPELLBOOK_BASE = 'https://backend.commanderspellbook.com';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class CommanderSpellbookClient {
  private static instance: CommanderSpellbookClient;
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  private constructor() {}

  static getInstance(): CommanderSpellbookClient {
    if (!CommanderSpellbookClient.instance) {
      CommanderSpellbookClient.instance = new CommanderSpellbookClient();
    }
    return CommanderSpellbookClient.instance;
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCached<T>(key: string, data: T): void {
    this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private cacheKey(endpoint: string, commanderName: string, cardNames: string[]): string {
    const sorted = [...cardNames].sort().join(',');
    return `${endpoint}:${commanderName}:${sorted}`;
  }

  /**
   * Find combos that exist within a given card list (for a specific commander).
   */
  async findCombos(commanderName: string, cardNames: string[]): Promise<ComboResult[]> {
    const key = this.cacheKey('combos', commanderName, cardNames);
    const cached = this.getCached<ComboResult[]>(key);
    if (cached) return cached;

    try {
      const res = await fetch(`${SPELLBOOK_BASE}/find-my-combos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commanders: [commanderName],
          cards: cardNames,
        }),
      });

      if (!res.ok) {
        console.error(`[Spellbook] findCombos HTTP ${res.status}`);
        return [];
      }

      const json = await res.json();
      const combos = this.parseComboResults(json);
      this.setCached(key, combos);
      return combos;
    } catch (err) {
      console.error('[Spellbook] findCombos error:', err);
      return [];
    }
  }

  /**
   * Estimate the power bracket for a deck.
   */
  async estimateBracket(commanderName: string, cardNames: string[]): Promise<BracketEstimate | null> {
    const key = this.cacheKey('bracket', commanderName, cardNames);
    const cached = this.getCached<BracketEstimate>(key);
    if (cached) return cached;

    try {
      const res = await fetch(`${SPELLBOOK_BASE}/estimate-bracket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commanders: [commanderName],
          cards: cardNames,
        }),
      });

      if (!res.ok) {
        console.error(`[Spellbook] estimateBracket HTTP ${res.status}`);
        return null;
      }

      const json = await res.json();
      const result: BracketEstimate = {
        bracket: json?.bracket ?? json?.estimated_bracket ?? 1,
        combos: this.parseComboResults(json?.combos ?? []),
      };
      this.setCached(key, result);
      return result;
    } catch (err) {
      console.error('[Spellbook] estimateBracket error:', err);
      return null;
    }
  }

  private parseComboResults(raw: any[]): ComboResult[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((item: any) => ({
      cards: item?.uses?.map((u: any) => u?.card?.name ?? u?.name ?? '').filter(Boolean)
        ?? item?.cards ?? [],
      prerequisites: item?.prerequisites ?? [],
      steps: item?.steps ?? [],
      results: item?.produces?.map((p: any) => p?.feature?.name ?? p?.name ?? '').filter(Boolean)
        ?? item?.results ?? [],
    }));
  }
}

export const spellbookClient = CommanderSpellbookClient.getInstance();

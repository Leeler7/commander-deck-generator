import { EDHRECCardRecommendation, EDHRECTheme } from './types';

const EDHREC_JSON_BASE = 'https://json.edhrec.com';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_REQUEST_INTERVAL_MS = 1000; // max 1 req/sec

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a commander name to the EDHREC URL slug.
 * e.g. "Atraxa, Praetors' Voice" → "atraxa-praetors-voice"
 */
export function commanderToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[',\.]/g, '')      // remove commas, apostrophes, periods
    .replace(/\s+/g, '-')        // spaces → hyphens
    .replace(/-+/g, '-')         // collapse multiple hyphens
    .replace(/^-|-$/g, '');      // trim leading/trailing hyphens
}

// ─── Cache entry ─────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// ─── EDHRECClient singleton ───────────────────────────────────────────────────

class EDHRECClient {
  private static instance: EDHRECClient;
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private lastRequestAt = 0;

  private constructor() {}

  static getInstance(): EDHRECClient {
    if (!EDHRECClient.instance) {
      EDHRECClient.instance = new EDHRECClient();
    }
    return EDHRECClient.instance;
  }

  // ── Rate-limited fetch ──────────────────────────────────────────────────────

  private async fetchJson<T>(url: string): Promise<T | null> {
    // Enforce 1 req/sec
    const now = Date.now();
    const elapsed = now - this.lastRequestAt;
    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed));
    }
    this.lastRequestAt = Date.now();

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'commander-deck-generator/1.0' },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`EDHREC HTTP ${res.status}: ${res.statusText}`);
      return (await res.json()) as T;
    } catch (err) {
      console.error(`[EDHREC] fetch failed for ${url}:`, err);
      return null;
    }
  }

  // ── Cache helpers ───────────────────────────────────────────────────────────

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

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Fetch the full EDHREC commander page JSON.
   * Returns null if the commander isn't found or has insufficient data.
   */
  async getCommanderPage(commanderName: string): Promise<unknown | null> {
    const slug = commanderToSlug(commanderName);
    const cacheKey = `commander:${slug}`;
    const cached = this.getCached<unknown>(cacheKey);
    if (cached) return cached;

    const url = `${EDHREC_JSON_BASE}/pages/commanders/${slug}.json`;
    const data = await this.fetchJson<unknown>(url);
    if (data) this.setCached(cacheKey, data);
    return data;
  }

  /**
   * Extract available themes for a commander.
   * Returns an empty array if no themes exist or commander isn't found.
   */
  async getCommanderThemes(commanderName: string): Promise<EDHRECTheme[]> {
    const page = await this.getCommanderPage(commanderName) as any;
    if (!page) return [];

    // EDHREC pages nest themes under "panels" or "related_info" → "themes"
    const rawThemes: any[] =
      page?.panels?.tribelinks?.cardlists ??
      page?.related_info?.themes ??
      page?.container?.json_dict?.relatedinfo?.themes ??
      [];

    return rawThemes.map((t: any) => ({
      name: t.header ?? t.name ?? '',
      slug: t.href?.split('/').pop() ?? commanderToSlug(t.header ?? t.name ?? ''),
      count: t.num_decks ?? t.count ?? 0,
    })).filter(t => t.name);
  }

  /**
   * Get card recommendations for a commander, optionally filtered by theme.
   * Returns cards sorted by synergy score (descending).
   */
  async getThemedRecommendations(
    commanderName: string,
    theme?: string
  ): Promise<EDHRECCardRecommendation[]> {
    const slug = commanderToSlug(commanderName);
    const cacheKey = theme ? `recs:${slug}:${theme}` : `recs:${slug}`;
    const cached = this.getCached<EDHRECCardRecommendation[]>(cacheKey);
    if (cached) return cached;

    let url: string;
    if (theme) {
      url = `${EDHREC_JSON_BASE}/pages/commanders/${slug}/${theme}.json`;
    } else {
      url = `${EDHREC_JSON_BASE}/pages/commanders/${slug}.json`;
    }

    const page = await this.fetchJson<any>(url);
    if (!page) return [];

    const recs = this.extractCardRecommendations(page);
    this.setCached(cacheKey, recs);
    return recs;
  }

  /**
   * Fetch EDHREC's average 99-card decklist for this commander.
   * Returns null if not found.
   */
  async getAverageDeck(commanderName: string): Promise<EDHRECCardRecommendation[] | null> {
    const slug = commanderToSlug(commanderName);
    const cacheKey = `avgdeck:${slug}`;
    const cached = this.getCached<EDHRECCardRecommendation[]>(cacheKey);
    if (cached) return cached;

    const url = `${EDHREC_JSON_BASE}/pages/average-decks/${slug}.json`;
    const page = await this.fetchJson<any>(url);
    if (!page) return null;

    const recs = this.extractCardRecommendations(page);
    this.setCached(cacheKey, recs);
    return recs;
  }

  // ── Internal parsing ────────────────────────────────────────────────────────

  private extractCardRecommendations(page: any): EDHRECCardRecommendation[] {
    const recs: EDHRECCardRecommendation[] = [];

    // EDHREC JSON pages store cards under "cardlists" arrays within panels/container
    const cardlists: any[] =
      page?.container?.json_dict?.cardlists ??
      page?.cardlists ??
      [];

    for (const list of cardlists) {
      const cards: any[] = list?.cardviews ?? list?.cards ?? [];
      for (const card of cards) {
        const name: string = card?.name ?? card?.card_digest?.name ?? '';
        if (!name) continue;

        recs.push({
          name,
          synergy: card?.synergy ?? 0,
          inclusion: card?.inclusion ?? 0,
          numDecks: card?.num_decks ?? 0,
          potentialDecks: card?.potential_decks ?? 0,
        });
      }
    }

    // Sort by synergy descending
    recs.sort((a, b) => b.synergy - a.synergy);
    return recs;
  }
}

export const edhrecClient = EDHRECClient.getInstance();

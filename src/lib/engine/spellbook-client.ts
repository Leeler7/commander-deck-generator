const BASE_URL = 'https://backend.commanderspellbook.com';
const USER_AGENT = 'BigDeckEnergy/1.0 (MTG Commander Deck Generator)';
const REQUEST_TIMEOUT = 15_000;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ── Types ──────────────────────────────────────────────────────────────────

export interface SpellbookCombo {
  id: string;
  cards: string[];
  prerequisites: string[];
  steps: string[];
  results: string[];
  bracket: number;
  cardCount: number;
}

export interface SpellbookBracketEstimate {
  bracket: number;
  reasons: string[];
}

interface FindMyCombosResponse {
  results: Array<{
    id: string;
    uses: Array<{ card: { name: string } }>;
    requires?: Array<{ template: { name: string } }>;
    produces: Array<{ feature: { name: string } }>;
    description?: string;
    bracket?: number;
    identity?: string;
  }>;
}

// ── Cache ──────────────────────────────────────────────────────────────────

const comboCache = new Map<string, { data: SpellbookCombo[]; timestamp: number }>();

function getCacheKey(cardNames: string[]): string {
  return [...cardNames].sort().join('|').substring(0, 500);
}

// ── API helpers ────────────────────────────────────────────────────────────

async function spellbookFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Commander Spellbook API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Find combos that can be assembled from the given card pool.
 * Uses POST /find-my-combos endpoint.
 */
export async function findMyCombos(cardNames: string[]): Promise<SpellbookCombo[]> {
  if (cardNames.length === 0) return [];

  const cacheKey = getCacheKey(cardNames);
  const cached = comboCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const response = await spellbookFetch<FindMyCombosResponse>('/find-my-combos', {
      method: 'POST',
      body: JSON.stringify({
        commanders: [],
        main: cardNames.map(name => ({ card: name })),
      }),
    });

    const combos: SpellbookCombo[] = (response.results || []).map(r => ({
      id: r.id,
      cards: r.uses?.map(u => u.card.name) ?? [],
      prerequisites: r.requires?.map(req => req.template.name) ?? [],
      steps: r.description ? [r.description] : [],
      results: r.produces?.map(p => p.feature.name) ?? [],
      bracket: r.bracket ?? 0,
      cardCount: r.uses?.length ?? 0,
    }));

    comboCache.set(cacheKey, { data: combos, timestamp: Date.now() });
    console.log(`[Spellbook] Found ${combos.length} combos for ${cardNames.length} cards`);
    return combos;
  } catch (err) {
    console.warn('[Spellbook] find-my-combos failed, returning empty:', err);
    return [];
  }
}

/**
 * Classify combos as early (bracket 4+, <=2 cards) or late (bracket 3, 3+ cards).
 */
export function classifyCombos(combos: SpellbookCombo[]): {
  early: SpellbookCombo[];
  late: SpellbookCombo[];
  compactWinLines: number;
} {
  const early: SpellbookCombo[] = [];
  const late: SpellbookCombo[] = [];

  for (const combo of combos) {
    if (combo.bracket >= 4 || combo.cardCount <= 2) {
      early.push(combo);
    } else {
      late.push(combo);
    }
  }

  // Compact win lines = distinct <=2-card combos
  const compactWinLines = combos.filter(c => c.cardCount <= 2).length;

  return { early, late, compactWinLines };
}

/**
 * Convert Spellbook combos to the DetectedCombo format used by the bracket estimator.
 */
export function toDetectedCombos(
  combos: SpellbookCombo[],
  deckCardNames: Set<string>,
): Array<{
  comboId: string;
  cards: string[];
  results: string[];
  isComplete: boolean;
  missingCards: string[];
  deckCount: number;
  bracket: string;
}> {
  return combos.map(combo => {
    const missing = combo.cards.filter(c => !deckCardNames.has(c));
    return {
      comboId: combo.id,
      cards: combo.cards,
      results: combo.results,
      isComplete: missing.length === 0,
      missingCards: missing,
      deckCount: 0,
      bracket: String(combo.bracket),
    };
  });
}

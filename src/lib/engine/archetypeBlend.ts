// Archetype backfill. For a commander with thin EDHREC data (or a generation with no themes chosen),
// the base pool is small, so the engine has little to recommend from. This blends the commander's top
// EDHREC theme/archetype pool into the commander pool — cards in BOTH get an overlap priority signal,
// and archetype-only cards are injected at a down-weighted inclusion so they backfill without swamping
// a well-supported commander. Ported from upstream (Manafoundry).

import type { EDHRECCard, EDHRECCommanderData } from './types';

// ─── Adaptive weight ─────────────────────────────────────────────────
// How much an archetype-only card's inclusion counts when injected. Mainstream commander-theme
// pairings barely move (0.35); thin ones get real backfill (0.9). Log-interpolated between.
export const ARCHETYPE_WEIGHT_MIN = 0.35;
export const ARCHETYPE_WEIGHT_MAX = 0.9;
export const ARCHETYPE_THIN_DECKS = 50;
export const ARCHETYPE_HEALTHY_DECKS = 500;
/** Max archetype-only cards injected per category. */
export const ARCHETYPE_INJECT_CAP = 15;

// A commander whose EDHREC non-land pool is smaller than this is "thin" and gets archetype backfill.
// A well-supported commander returns a large pool (all category lists full) and is left alone —
// this is the reliable thinness signal, since EDHREC's per-commander numDecks stat is often 0.
export const ARCHETYPE_POOL_THIN = 120;

/** Log-interpolated inclusion weight for archetype-only cards. Unknown/0 deck count = thin. */
export function archetypeWeight(commanderThemeDeckCount: number): number {
  const n = commanderThemeDeckCount;
  if (!n || n <= ARCHETYPE_THIN_DECKS) return ARCHETYPE_WEIGHT_MAX;
  if (n >= ARCHETYPE_HEALTHY_DECKS) return ARCHETYPE_WEIGHT_MIN;
  const t = Math.log(n / ARCHETYPE_THIN_DECKS) / Math.log(ARCHETYPE_HEALTHY_DECKS / ARCHETYPE_THIN_DECKS);
  return ARCHETYPE_WEIGHT_MAX - (ARCHETYPE_WEIGHT_MAX - ARCHETYPE_WEIGHT_MIN) * t;
}

type Cardlists = EDHRECCommanderData['cardlists'];

export interface ArchetypePool {
  pool: Cardlists;
  sourceLabel: string;
}

const CATEGORY_KEYS = [
  'creatures', 'instants', 'sorceries', 'artifacts',
  'enchantments', 'planeswalkers', 'lands',
] as const;

/**
 * Cross-reference the commander pool against archetype pools, mutating commanderPool in place.
 * - Cards in BOTH get archetypeOverlap = true (commander inclusion/synergy untouched — commander data
 *   is ground truth; the flag feeds a priority bonus).
 * - Archetype-only cards are injected at inclusion × archetypeWeight(deckCount), capped per category,
 *   marked fromArchetype + archetypeSource. Null pools (failed fetches) are skipped.
 */
export function blendArchetypeData(
  commanderPool: Cardlists,
  tagPools: Array<ArchetypePool | null>,
  commanderThemeDeckCount: number,
): { overlapCount: number; injectedCount: number } {
  const weight = archetypeWeight(commanderThemeDeckCount);
  let overlapCount = 0;
  let injectedCount = 0;

  const commanderNames = new Set<string>();
  for (const list of Object.values(commanderPool)) {
    for (const c of list) commanderNames.add(c.name);
  }

  for (const tagPool of tagPools) {
    if (!tagPool) continue;

    // 1. Mark overlap on commander cards.
    const tagNames = new Set<string>();
    for (const list of Object.values(tagPool.pool)) {
      for (const c of list) tagNames.add(c.name);
    }
    for (const list of Object.values(commanderPool)) {
      for (const c of list) {
        if (tagNames.has(c.name) && !c.archetypeOverlap) {
          c.archetypeOverlap = true;
          overlapCount++;
        }
      }
    }

    // 2. Inject archetype-only cards, capped per category. Tag-pool lists are inclusion-sorted, so
    //    the first N are the archetype's strongest cards.
    for (const key of CATEGORY_KEYS) {
      let taken = 0;
      for (const card of tagPool.pool[key]) {
        if (taken >= ARCHETYPE_INJECT_CAP) break;
        if (commanderNames.has(card.name)) continue;
        const copy: EDHRECCard = {
          ...card,
          inclusion: card.inclusion * weight,
          fromArchetype: true,
          archetypeSource: tagPool.sourceLabel,
        };
        commanderPool[key].push(copy);
        if (key !== 'lands') commanderPool.allNonLand.push(copy);
        commanderNames.add(card.name); // dedupe across pools
        taken++;
        injectedCount++;
      }
    }
  }

  // Restore inclusion-descending order (parseCardlists invariant).
  for (const key of Object.keys(commanderPool) as (keyof Cardlists)[]) {
    commanderPool[key].sort((a, b) => b.inclusion - a.inclusion);
  }

  return { overlapCount, injectedCount };
}

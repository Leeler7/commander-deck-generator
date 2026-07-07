import { hasTag } from './tagger-client';
import { FREE_INTERACTION } from './bracketEstimator';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TagRollupResult {
  total_interaction: { count: number; names: string[] };
  free_interaction: { count: number; names: string[] };
  card_advantage: { count: number; names: string[] };
  stax_piece_count: { count: number; names: string[] };
  counterspell_count: { count: number; names: string[] };
  removal_count: { count: number; names: string[] };
  boardwipe_count: { count: number; names: string[] };
  bounce_count: { count: number; names: string[] };
  tutor_count: { count: number; names: string[] };
  untagged: string[];
  coverageRatio: number;
}

// Tag groups from engine-config.json tag_rollup_map
const INTERACTION_TAGS = ['counterspell', 'removal', 'bounce', 'spot-removal', 'boardwipe'];
const CARD_ADVANTAGE_TAGS = ['card-advantage', 'draw', 'tutor', 'cantrip', 'wheel'];

/**
 * Aggregate tagger tags into bracket metrics using the rollup map.
 * Each card is counted at most once per target metric (dedup).
 */
export function computeTagRollup(cardNames: string[]): TagRollupResult {
  const totalInteraction: string[] = [];
  const freeInteraction: string[] = [];
  const cardAdvantage: string[] = [];
  const stax: string[] = [];
  const counterspells: string[] = [];
  const removal: string[] = [];
  const boardwipes: string[] = [];
  const bounces: string[] = [];
  const tutors: string[] = [];
  const untagged: string[] = [];

  const interactionSeen = new Set<string>();

  for (const name of cardNames) {
    let hasAnyTag = false;

    // Total interaction (deduped per card)
    let isInteraction = false;
    for (const tag of INTERACTION_TAGS) {
      if (hasTag(name, tag)) {
        hasAnyTag = true;
        isInteraction = true;
        if (tag === 'counterspell') counterspells.push(name);
        if (tag === 'removal' || tag === 'spot-removal') {
          if (!removal.includes(name)) removal.push(name);
        }
        if (tag === 'boardwipe') boardwipes.push(name);
        if (tag === 'bounce') bounces.push(name);
      }
    }
    if (isInteraction && !interactionSeen.has(name)) {
      interactionSeen.add(name);
      totalInteraction.push(name);
    }

    // Free interaction from curated list
    if (FREE_INTERACTION.has(name)) {
      freeInteraction.push(name);
      hasAnyTag = true;
    }

    // Card advantage (deduped per card)
    let isCardAdv = false;
    for (const tag of CARD_ADVANTAGE_TAGS) {
      if (hasTag(name, tag)) {
        hasAnyTag = true;
        isCardAdv = true;
        if (tag === 'tutor') tutors.push(name);
      }
    }
    if (isCardAdv && !cardAdvantage.includes(name)) {
      cardAdvantage.push(name);
    }

    // Ramp/dork/rock tags
    if (hasTag(name, 'ramp') || hasTag(name, 'mana-dork') || hasTag(name, 'mana-rock') || hasTag(name, 'cost-reducer')) {
      hasAnyTag = true;
    }

    // Extra turn / mass land denial
    if (hasTag(name, 'extra-turn') || hasTag(name, 'mass-land-denial')) {
      hasAnyTag = true;
    }

    // Utility/tapland
    if (hasTag(name, 'utility-land') || hasTag(name, 'tapland')) {
      hasAnyTag = true;
    }

    if (!hasAnyTag) {
      untagged.push(name);
    }
  }

  return {
    total_interaction: { count: totalInteraction.length, names: totalInteraction },
    free_interaction: { count: freeInteraction.length, names: freeInteraction },
    card_advantage: { count: cardAdvantage.length, names: cardAdvantage },
    stax_piece_count: { count: stax.length, names: stax },
    counterspell_count: { count: counterspells.length, names: counterspells },
    removal_count: { count: removal.length, names: removal },
    boardwipe_count: { count: boardwipes.length, names: boardwipes },
    bounce_count: { count: bounces.length, names: bounces },
    tutor_count: { count: tutors.length, names: tutors },
    untagged,
    coverageRatio: cardNames.length > 0 ? (cardNames.length - untagged.length) / cardNames.length : 1,
  };
}

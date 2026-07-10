// Functional card similarity — "what plays most like this card." Used to rank
// replacement suggestions so a cut card is swapped for something that fills the
// same role in the same way (a flyer for a flyer, a 2-drop for a 2-drop), not
// just any same-role card. Ported from the upstream (Manafoundry) cardSimilarity
// module. No oracle-text parsing (deliberately).
//
// Upstream also blends in EDHREC's per-card "similar" list (its strongest term).
// This fork only has EDHREC similarity data for commanders, not per card, so the
// three structural signals are re-normalized to sum to 1.

// Primary card type, ordered so combined types resolve to the most informative
// supertype (Artifact Creature → creature, Artifact Land → land).
const TYPE_PRECEDENCE = ['planeswalker', 'creature', 'land', 'battle', 'instant', 'sorcery', 'artifact', 'enchantment', 'tribal'];

/** The card's primary type for grouping (front face, supertype-precedence). */
export function primaryType(typeLine?: string): string | null {
  if (!typeLine) return null;
  const front = typeLine.split('//')[0].split('—')[0].toLowerCase();
  return TYPE_PRECEDENCE.find(t => front.includes(t)) ?? null;
}

// Re-normalized structural weights (upstream: type .25 / kw .15 / cmc .10 under a
// .50 EDHREC term; here the EDHREC term is absent so these scale to sum to 1).
const W_TYPE = 0.5;
const W_KEYWORDS = 0.3;
const W_CMC = 0.2;
const CMC_RANGE = 3;

/** Minimal card shape needed to score similarity. */
export interface SimilarityCard {
  type_line?: string;
  keywords?: string[];
  cmc?: number;
}

/**
 * Structural functional similarity between a deck card and a candidate
 * replacement, 0..1. Higher = plays more like `current`.
 */
export function scoreSimilarity(current: SimilarityCard, candidate: SimilarityCard): number {
  // Same primary card type.
  const curType = primaryType(current.type_line);
  const type = curType != null && curType === primaryType(candidate.type_line) ? 1 : 0;

  // Shared keywords (flying, deathtouch, ward, …), as a fraction of the current
  // card's keywords.
  const curKw = new Set((current.keywords ?? []).map(k => k.toLowerCase()));
  const shared = (candidate.keywords ?? []).filter(k => curKw.has(k.toLowerCase())).length;
  const keywords = curKw.size > 0 ? shared / curKw.size : 0;

  // Mana-value proximity.
  const cmcDelta = Math.abs((current.cmc ?? 0) - (candidate.cmc ?? 0));
  const cmc = 1 - Math.min(cmcDelta, CMC_RANGE) / CMC_RANGE;

  return W_TYPE * type + W_KEYWORDS * keywords + W_CMC * cmc;
}

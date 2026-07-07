import type { EDHRECCommanderData, EDHRECCard, EDHRECTheme } from './types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface MetaProfile {
  themes: EDHRECTheme[];
  deckCount: number;
  avgSynergy: number;
  avgSalt: number;
  topSynergyCards: Array<{ name: string; synergy: number }>;
  highInclusionCards: Array<{ name: string; inclusion: number }>;
}

// ── API ────────────────────────────────────────────────────────────────────

/**
 * Extract meta-level signals from EDHREC data.
 * These signals inform theme/synergy choices but NEVER feed into bracket scoring.
 * Per engine-config: EDHREC is used for theme_tags, synergy_scores, salt_score,
 * inclusion_rate, meta_prevalence — NOT fast_mana_count, interaction_count, or bracket_score.
 */
export function extractMetaProfile(data: EDHRECCommanderData): MetaProfile {
  const allCards = data.cardlists.allNonLand;

  const cardsWithSynergy = allCards
    .filter((c): c is EDHRECCard & { synergy: number } => c.synergy != null)
    .sort((a, b) => b.synergy - a.synergy);

  const cardsWithInclusion = allCards
    .filter(c => c.inclusion > 0)
    .sort((a, b) => b.inclusion - a.inclusion);

  const avgSynergy = cardsWithSynergy.length > 0
    ? cardsWithSynergy.reduce((sum, c) => sum + c.synergy, 0) / cardsWithSynergy.length
    : 0;

  const cardsWithSalt = allCards.filter((c): c is EDHRECCard & { salt: number } => c.salt != null);
  const avgSalt = cardsWithSalt.length > 0
    ? cardsWithSalt.reduce((sum, c) => sum + c.salt, 0) / cardsWithSalt.length
    : 0;

  return {
    themes: data.themes,
    deckCount: data.stats.numDecks,
    avgSynergy: Math.round(avgSynergy * 100) / 100,
    avgSalt: Math.round(avgSalt * 100) / 100,
    topSynergyCards: cardsWithSynergy.slice(0, 10).map(c => ({ name: c.name, synergy: c.synergy })),
    highInclusionCards: cardsWithInclusion.slice(0, 10).map(c => ({ name: c.name, inclusion: c.inclusion })),
  };
}

/**
 * Check if a commander has enough EDHREC data for reliable meta signals.
 * Commanders with <50 decks are undersampled and should get a confidence note.
 */
export function isMetaReliable(data: EDHRECCommanderData): { reliable: boolean; note?: string } {
  if (data.stats.numDecks < 50) {
    return { reliable: false, note: `EDHREC has only ${data.stats.numDecks} decks — meta signals are undersampled` };
  }
  if (data.stats.numDecks < 200) {
    return { reliable: true, note: `EDHREC has ${data.stats.numDecks} decks — meta signals are directional but thin` };
  }
  return { reliable: true };
}

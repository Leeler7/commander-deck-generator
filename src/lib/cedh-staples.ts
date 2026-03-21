/**
 * cEDH Staples by Color
 *
 * Cards that appear in nearly every competitive EDH deck of a given color.
 * These are fetched by exact name from Scryfall and added to the pool with
 * high base scores when targeting Bracket 4-5.
 *
 * Each list is categorised by function for readability but exported flat.
 */

export interface CedhStapleEntry {
  name: string;
  category: 'fast_mana' | 'interaction' | 'draw' | 'tutor' | 'hate' | 'utility' | 'extra_turn' | 'win_condition';
}

// ─── Colorless (every cEDH deck) ──────────────────────────────────────────────
const COLORLESS_STAPLES: CedhStapleEntry[] = [
  // Fast mana
  { name: 'Sol Ring',               category: 'fast_mana' },
  { name: 'Mana Crypt',             category: 'fast_mana' },
  { name: 'Mana Vault',             category: 'fast_mana' },
  { name: 'Chrome Mox',             category: 'fast_mana' },
  { name: 'Mox Diamond',            category: 'fast_mana' },
  { name: 'Mox Opal',               category: 'fast_mana' },
  { name: 'Grim Monolith',          category: 'fast_mana' },
  { name: 'Jeweled Lotus',          category: 'fast_mana' },
  { name: 'Lotus Petal',            category: 'fast_mana' },
  { name: "Lion's Eye Diamond",     category: 'fast_mana' },
  { name: 'Ancient Tomb',           category: 'fast_mana' },
  { name: 'Mox Amber',              category: 'fast_mana' },
  // Draw / Utility
  { name: 'Skullclamp',             category: 'draw' },
  { name: "Sensei's Divining Top",  category: 'draw' },
  { name: 'The One Ring',           category: 'draw' },
  // Hate
  { name: 'Trinisphere',            category: 'hate' },
  // Utility
  { name: 'Walking Ballista',       category: 'win_condition' },
];

// ─── White ────────────────────────────────────────────────────────────────────
const WHITE_STAPLES: CedhStapleEntry[] = [
  { name: 'Drannith Magistrate',    category: 'hate' },
  { name: 'Enlightened Tutor',      category: 'tutor' },
  { name: 'Swords to Plowshares',   category: 'interaction' },
  { name: 'Path to Exile',          category: 'interaction' },
  { name: 'Silence',                category: 'interaction' },
  { name: 'Grand Abolisher',        category: 'hate' },
  { name: 'Smothering Tithe',       category: 'draw' },
  { name: 'Esper Sentinel',         category: 'draw' },
  { name: 'Trouble in Pairs',       category: 'draw' },
  { name: "Serra's Sanctum",        category: 'fast_mana' },
  { name: 'Aven Mindcensor',        category: 'hate' },
  { name: 'Rule of Law',            category: 'hate' },
  { name: 'Rest in Peace',          category: 'hate' },
  { name: 'Stony Silence',          category: 'hate' },
  { name: 'Deafening Silence',      category: 'hate' },
];

// ─── Blue ─────────────────────────────────────────────────────────────────────
const BLUE_STAPLES: CedhStapleEntry[] = [
  { name: 'Force of Will',          category: 'interaction' },
  { name: 'Force of Negation',      category: 'interaction' },
  { name: 'Fierce Guardianship',    category: 'interaction' },
  { name: 'Pact of Negation',       category: 'interaction' },
  { name: 'Swan Song',              category: 'interaction' },
  { name: 'Counterspell',           category: 'interaction' },
  { name: 'Mental Misstep',         category: 'interaction' },
  { name: 'Flusterstorm',           category: 'interaction' },
  { name: 'Dispel',                 category: 'interaction' },
  { name: 'An Offer You Can\'t Refuse', category: 'interaction' },
  { name: 'Cyclonic Rift',          category: 'interaction' },
  { name: 'Rhystic Study',          category: 'draw' },
  { name: 'Mystic Remora',          category: 'draw' },
  { name: "Thassa's Oracle",        category: 'win_condition' },
  { name: 'Mystical Tutor',         category: 'tutor' },
  { name: 'Brainstorm',             category: 'draw' },
  { name: 'Ponder',                 category: 'draw' },
  { name: 'Preordain',              category: 'draw' },
  { name: 'Gitaxian Probe',         category: 'draw' },
  { name: 'Windfall',               category: 'draw' },
  { name: 'Timetwister',            category: 'draw' },
  { name: 'Narset, Parter of Veils', category: 'hate' },
  { name: 'Dress Down',             category: 'interaction' },
  { name: 'Intuition',              category: 'tutor' },
];

// ─── Black ────────────────────────────────────────────────────────────────────
const BLACK_STAPLES: CedhStapleEntry[] = [
  { name: 'Demonic Tutor',          category: 'tutor' },
  { name: 'Vampiric Tutor',         category: 'tutor' },
  { name: 'Imperial Seal',          category: 'tutor' },
  { name: 'Diabolic Intent',        category: 'tutor' },
  { name: 'Dark Ritual',            category: 'fast_mana' },
  { name: 'Cabal Ritual',           category: 'fast_mana' },
  { name: 'Culling the Weak',       category: 'fast_mana' },
  { name: 'Rain of Filth',          category: 'fast_mana' },
  { name: 'Ad Nauseam',             category: 'draw' },
  { name: 'Necropotence',           category: 'draw' },
  { name: "Bolas's Citadel",        category: 'draw' },
  { name: 'Opposition Agent',       category: 'hate' },
  { name: 'Dauthi Voidwalker',      category: 'hate' },
  { name: 'Toxic Deluge',           category: 'interaction' },
  { name: 'Feed the Swarm',         category: 'interaction' },
  { name: 'Praetor\'s Grasp',       category: 'tutor' },
  { name: 'Entomb',                 category: 'tutor' },
  { name: 'Reanimate',              category: 'utility' },
  { name: 'Animate Dead',           category: 'utility' },
  { name: 'Tergrid, God of Fright', category: 'hate' },
];

// ─── Red ──────────────────────────────────────────────────────────────────────
const RED_STAPLES: CedhStapleEntry[] = [
  { name: 'Deflecting Swat',        category: 'interaction' },
  { name: 'Pyroblast',              category: 'interaction' },
  { name: 'Red Elemental Blast',    category: 'interaction' },
  { name: "Tibalt's Trickery",      category: 'interaction' },
  { name: 'Chaos Warp',             category: 'interaction' },
  { name: 'Abrade',                 category: 'interaction' },
  { name: 'Wheel of Fortune',       category: 'draw' },
  { name: 'Faithless Looting',      category: 'draw' },
  { name: "Jeska's Will",           category: 'fast_mana' },
  { name: 'Gamble',                 category: 'tutor' },
  { name: 'Imperial Recruiter',     category: 'tutor' },
  { name: 'Blood Moon',             category: 'hate' },
  { name: 'Underworld Breach',      category: 'win_condition' },
  { name: 'Dockside Extortionist',  category: 'fast_mana' },
  { name: 'Simian Spirit Guide',    category: 'fast_mana' },
  { name: 'Rite of Flame',          category: 'fast_mana' },
  { name: 'Pyretic Ritual',         category: 'fast_mana' },
  { name: 'Desperate Ritual',       category: 'fast_mana' },
  { name: 'Final Fortune',          category: 'extra_turn' },
  { name: 'Fork',                   category: 'utility' },
  { name: 'Reverberate',            category: 'utility' },
];

// ─── Green ────────────────────────────────────────────────────────────────────
const GREEN_STAPLES: CedhStapleEntry[] = [
  { name: 'Survival of the Fittest', category: 'tutor' },
  { name: "Gaea's Cradle",           category: 'fast_mana' },
  { name: 'Worldly Tutor',           category: 'tutor' },
  { name: 'Green Sun\'s Zenith',     category: 'tutor' },
  { name: 'Finale of Devastation',   category: 'tutor' },
  { name: 'Natural Order',           category: 'tutor' },
  { name: 'Eldritch Evolution',      category: 'tutor' },
  { name: 'Sylvan Library',          category: 'draw' },
  { name: 'Carpet of Flowers',       category: 'fast_mana' },
  { name: 'Birds of Paradise',       category: 'fast_mana' },
  { name: 'Elvish Mystic',           category: 'fast_mana' },
  { name: 'Llanowar Elves',          category: 'fast_mana' },
  { name: 'Arbor Elf',               category: 'fast_mana' },
  { name: 'Elvish Spirit Guide',     category: 'fast_mana' },
  { name: 'Nature\'s Claim',         category: 'interaction' },
  { name: 'Veil of Summer',          category: 'interaction' },
  { name: 'Collector Ouphe',         category: 'hate' },
  { name: 'Vorinclex, Voice of Hunger', category: 'hate' },
  { name: 'Endurance',               category: 'interaction' },
  { name: 'Destiny Spinner',         category: 'utility' },
];

// ─── Multi-color staples ──────────────────────────────────────────────────────
const MULTI_STAPLES: CedhStapleEntry[] = [
  { name: 'Kinnan, Bonder Prodigy',    category: 'fast_mana' },  // UG
  { name: 'Drown in the Loch',         category: 'interaction' }, // UB
  { name: 'Dovin\'s Veto',             category: 'interaction' }, // WU
  { name: 'Assassin\'s Trophy',        category: 'interaction' }, // BG
  { name: 'Teferi, Time Raveler',      category: 'hate' },        // WU
  { name: 'Notion Thief',              category: 'hate' },        // UB
];

// ─── Color → entries map ──────────────────────────────────────────────────────

const COLOR_STAPLE_MAP: Record<string, CedhStapleEntry[]> = {
  W: WHITE_STAPLES,
  U: BLUE_STAPLES,
  B: BLACK_STAPLES,
  R: RED_STAPLES,
  G: GREEN_STAPLES,
};

/**
 * Returns all cEDH staple card names appropriate for the given color identity.
 * Includes colorless staples (always), mono-color staples for each color in
 * the identity, and multicolor staples whose colors are a subset.
 */
export function getCedhStaplesForColors(colorIdentity: string[]): CedhStapleEntry[] {
  const colors = new Set(colorIdentity.map(c => c.toUpperCase()));
  const entries: CedhStapleEntry[] = [...COLORLESS_STAPLES];

  for (const [color, staples] of Object.entries(COLOR_STAPLE_MAP)) {
    if (colors.has(color)) {
      entries.push(...staples);
    }
  }

  // Multi-color staples: only if ALL colors of the staple are in the identity
  // We do a simplified check by card name → known colors
  const MULTI_COLORS: Record<string, string[]> = {
    'Kinnan, Bonder Prodigy': ['U', 'G'],
    'Drown in the Loch': ['U', 'B'],
    "Dovin's Veto": ['W', 'U'],
    "Assassin's Trophy": ['B', 'G'],
    'Teferi, Time Raveler': ['W', 'U'],
    'Notion Thief': ['U', 'B'],
  };

  for (const entry of MULTI_STAPLES) {
    const required = MULTI_COLORS[entry.name] ?? [];
    if (required.every(c => colors.has(c))) {
      entries.push(entry);
    }
  }

  return entries;
}

/**
 * Returns just the card names for Scryfall fetching.
 */
export function getCedhStapleNames(colorIdentity: string[]): string[] {
  return getCedhStaplesForColors(colorIdentity).map(e => e.name);
}

/**
 * Returns the subset of Game Changers that fit within a color identity.
 * Used by bracket 4+ to actively search for Game Changers by name.
 */
export function getGameChangersForColors(
  gameChangerList: string[],
  colorIdentity: string[],
): string[] {
  // We can't know GC color identity without Scryfall data, so we return all
  // and let the pipeline's color-identity check filter at fetch time.
  return gameChangerList;
}

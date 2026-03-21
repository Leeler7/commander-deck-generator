/**
 * Bracket Strategy System
 *
 * Each bracket (1-5) defines a complete configuration that changes how the
 * entire generation pipeline operates — scoring weights, combo handling,
 * card pool priorities, and win condition philosophy.
 *
 * Official Commander Format Panel bracket descriptions:
 *   1 = Exhibition  — Theme over winning. Fun, weird, casual.
 *   2 = Core        — Average precon level. Big splashy turns, no OTK.
 *   3 = Upgraded    — Stronger than precon. Carefully selected cards.
 *   4 = Optimized   — Full power. Explosive starts. Cheap combos.
 *   5 = cEDH        — Competitive. Every slot optimized. Win ASAP.
 */

import { FunctionalCoverage } from './functional-roles';

export interface BracketStrategy {
  /** Human-readable bracket name */
  name: string;
  /** Short description for UI display */
  description: string;

  // ── Combo tuning ──────────────────────────────────────────────────────────
  /** How aggressively to seek combos */
  comboMode: 'none' | 'late_game' | 'aggressive' | 'maximum';
  /** How aggressively to force-complete partial combos post-assembly */
  comboCompleteness: 'skip' | 'best_effort' | 'force';
  /** For late_game mode: minimum total CMC of combo pieces to allow */
  comboMinTotalCMC: number;

  // ── Game Changers ─────────────────────────────────────────────────────────
  /** Maximum Game Changer cards allowed (Infinity = no cap) */
  gameChangersAllowed: number;

  // ── Tutor tuning (step 2 scoring) ─────────────────────────────────────────
  /** Score adjustment for tutor cards (negative = discourage, positive = seek) */
  tutorAdjustment: number;
  /** If true, tutors are completely excluded from the pool (step1), not just penalized */
  excludeTutors: boolean;

  // ── EDHREC synergy weight (step 2) ────────────────────────────────────────
  /** Multiplier on the EDHREC synergy bonus (1.0 = normal) */
  edhrecSynergyWeight: number;

  // ── Theme bonus multiplier (step 3) ───────────────────────────────────────
  /** Multiplier on step3 theme bonuses (1.0 = normal) */
  themeBonus: number;

  // ── Functional minimums override (step 4 + fallback) ──────────────────────
  /** Override functional coverage minimums for this bracket */
  functionalMinimums: Partial<FunctionalCoverage>;

  // ── Mana curve ────────────────────────────────────────────────────────────
  /** General curve preference label */
  preferCurve: 'high' | 'balanced' | 'efficient' | 'low' | 'hyper_low';
  /** Penalize cards costing 5+ mana (unless they're win conditions) */
  penalizeHighCMC: boolean;
  /** Per-point penalty for each CMC above the threshold (0 = none) */
  highCMCPenaltyPerPoint: number;
  /** CMC threshold above which the penalty kicks in */
  highCMCThreshold: number;

  // ── Fast mana ─────────────────────────────────────────────────────────────
  /** Whether fast mana rocks/rituals are allowed */
  fastManaAllowed: boolean;
  /** Score bonus applied to detected fast mana cards */
  fastManaBonus: number;

  // ── Permission toggles ────────────────────────────────────────────────────
  /** Whether extra-turn spells are allowed */
  extraTurnsAllowed: boolean;
  /** Whether mass land destruction is allowed */
  massLandDenialAllowed: boolean;

  // ── Density targets ───────────────────────────────────────────────────────
  /** Target land count (including basics) */
  landCount: number;

  // ── Supplemental searches ─────────────────────────────────────────────────
  /** Whether to run a fast mana supplemental search in step1 */
  searchFastMana: boolean;
  /** Whether to run a cEDH staples supplemental search in step1 */
  searchCedhStaples: boolean;
  /** Whether to actively search for Game Changers by name in step1 */
  searchGameChangers: boolean;

  // ── Bracket-specific scoring adjustments (step 2) ─────────────────────────
  /** Score penalty for casual tribal filler at high brackets (0 = none) */
  tribalFillerPenalty: number;
  /** Score bonus for interaction pieces (counterspells, removal) */
  interactionBonus: number;
  /** Penalty for hyper-optimized auto-includes at Exhibition bracket */
  hyperOptimizedPenalty: number;
  /** Bonus applied to cEDH staple cards when found in pool */
  cedhStapleBonus: number;

  // ── Dynamic sourcing overrides (bracket 4-5) ───────────────────────────────
  /** Whether to bypass type ratio filtering (step4) and sort by score instead */
  bypassTypeRatios: boolean;
  /** Minimum override score for combo pieces from Commander Spellbook */
  comboOverrideScore: number;
  /** Minimum override score for fast mana cards */
  fastManaOverrideScore: number;
  /** Minimum override score for instant-speed interaction */
  interactionOverrideScore: number;
}

// ─── Fast mana card names (for detection + supplemental search) ─────────────

export const FAST_MANA_CARDS = [
  'Sol Ring', 'Mana Crypt', 'Mana Vault', 'Chrome Mox', 'Mox Diamond',
  'Lotus Petal', 'Dark Ritual', 'Simian Spirit Guide', 'Rite of Flame',
  'Jeweled Lotus', 'Ancient Tomb', 'Grim Monolith', "Lion's Eye Diamond",
  'Mox Opal', 'Mox Amber', 'Elvish Spirit Guide', 'Cabal Ritual',
  'Culling the Weak', 'Rain of Filth', 'Pyretic Ritual', 'Desperate Ritual',
  'Seething Song',
];

export const FAST_MANA_NAMES_LOWER = new Set(FAST_MANA_CARDS.map(n => n.toLowerCase()));

/** Returns true if a card is a fast mana piece (by name) */
export function isFastMana(cardName: string): boolean {
  return FAST_MANA_NAMES_LOWER.has(cardName.toLowerCase());
}

/** Known casual tribal filler sorceries/enchantments that are too slow for bracket 4-5 */
export const TRIBAL_FILLER_NAMES_LOWER = new Set([
  'dragon fodder', "krenko's command", 'hordeling outburst',
  'goblin rally', 'empty the warrens', 'mogg war marshal',
  'raise the alarm', 'lingering souls', 'spectral procession',
  'call of the herd', 'increasing devotion', 'army of the damned',
  'decree of justice', 'white sun\'s zenith',
].map(n => n.toLowerCase()));

/** Returns true if a card is known casual tribal filler */
export function isTribalFiller(cardName: string): boolean {
  return TRIBAL_FILLER_NAMES_LOWER.has(cardName.toLowerCase());
}

// ─── Bracket Configurations ─────────────────────────────────────────────────

const BRACKET_1_EXHIBITION: BracketStrategy = {
  name: 'Exhibition',
  description: 'Theme-focused, no combos, no Game Changers, no fast mana',
  comboMode: 'none',
  comboCompleteness: 'skip',
  comboMinTotalCMC: Infinity,
  gameChangersAllowed: 0,
  tutorAdjustment: -30,
  excludeTutors: true,
  edhrecSynergyWeight: 0.5,
  themeBonus: 2.0,
  functionalMinimums: {
    ramp: 8,
    card_draw: 6,
    removal: 5,
    board_wipe: 1,
    protection: 2,
    tutor: 0,
    payoff: 2,
  },
  preferCurve: 'high',
  penalizeHighCMC: false,
  highCMCPenaltyPerPoint: 0,
  highCMCThreshold: 99,
  fastManaAllowed: false,
  fastManaBonus: 0,
  extraTurnsAllowed: false,
  massLandDenialAllowed: false,
  landCount: 38,
  searchFastMana: false,
  searchCedhStaples: false,
  searchGameChangers: false,
  tribalFillerPenalty: 0,
  interactionBonus: 0,
  hyperOptimizedPenalty: 15,
  cedhStapleBonus: 0,
  bypassTypeRatios: false,
  comboOverrideScore: 0,
  fastManaOverrideScore: 0,

  interactionOverrideScore: 0,
};

const BRACKET_2_CORE: BracketStrategy = {
  name: 'Core',
  description: 'Precon-level, balanced, no infinite combos',
  comboMode: 'none',
  comboCompleteness: 'skip',
  comboMinTotalCMC: Infinity,
  gameChangersAllowed: 0,
  tutorAdjustment: -15,
  excludeTutors: false,
  edhrecSynergyWeight: 1.0,
  themeBonus: 1.5,
  functionalMinimums: {
    ramp: 10,
    card_draw: 8,
    removal: 7,
    board_wipe: 2,
    protection: 3,
    tutor: 0,
    payoff: 3,
  },
  preferCurve: 'balanced',
  penalizeHighCMC: false,
  highCMCPenaltyPerPoint: 0,
  highCMCThreshold: 99,
  fastManaAllowed: true, // Sol Ring is fine at Bracket 2
  fastManaBonus: 0,
  extraTurnsAllowed: false,
  massLandDenialAllowed: false,
  landCount: 37,
  searchFastMana: false,
  searchCedhStaples: false,
  searchGameChangers: false,
  tribalFillerPenalty: 0,
  interactionBonus: 0,
  hyperOptimizedPenalty: 0,
  cedhStapleBonus: 0,
  bypassTypeRatios: false,
  comboOverrideScore: 0,
  fastManaOverrideScore: 0,

  interactionOverrideScore: 0,
};

const BRACKET_3_UPGRADED: BracketStrategy = {
  name: 'Upgraded',
  description: 'Optimized synergy, up to 3 Game Changers, late-game combos OK',
  comboMode: 'late_game',
  comboCompleteness: 'best_effort',
  comboMinTotalCMC: 6,
  gameChangersAllowed: 3,
  tutorAdjustment: 0,
  excludeTutors: false,
  edhrecSynergyWeight: 1.2,
  themeBonus: 1.0,
  functionalMinimums: {
    ramp: 10,
    card_draw: 9,
    removal: 8,
    board_wipe: 2,
    protection: 3,
    tutor: 0,
    payoff: 5,
  },
  preferCurve: 'efficient',
  penalizeHighCMC: false,
  highCMCPenaltyPerPoint: 0,
  highCMCThreshold: 99,
  fastManaAllowed: true,
  fastManaBonus: 0,
  extraTurnsAllowed: true,
  massLandDenialAllowed: false,
  landCount: 36,
  searchFastMana: false,
  searchCedhStaples: false,
  searchGameChangers: false,
  tribalFillerPenalty: 0,
  interactionBonus: 0,
  hyperOptimizedPenalty: 0,
  cedhStapleBonus: 0,
  bypassTypeRatios: false,
  comboOverrideScore: 0,
  fastManaOverrideScore: 0,

  interactionOverrideScore: 0,
};

const BRACKET_4_OPTIMIZED: BracketStrategy = {
  name: 'Optimized',
  description: 'Full power, all combos, all Game Changers, explosive starts',
  comboMode: 'aggressive',
  comboCompleteness: 'force',
  comboMinTotalCMC: 0,
  gameChangersAllowed: Infinity,
  tutorAdjustment: 20,
  excludeTutors: false,
  edhrecSynergyWeight: 1.5,
  themeBonus: 0.5,
  functionalMinimums: {
    ramp: 12,
    card_draw: 10,
    removal: 8,
    board_wipe: 2,
    protection: 4,
    tutor: 2,
    payoff: 7,
  },
  preferCurve: 'low',
  penalizeHighCMC: true,
  highCMCPenaltyPerPoint: 10,
  highCMCThreshold: 5,
  fastManaAllowed: true,
  fastManaBonus: 25,
  extraTurnsAllowed: true,
  massLandDenialAllowed: true,
  landCount: 34,
  searchFastMana: true,
  searchCedhStaples: true,
  searchGameChangers: true,
  tribalFillerPenalty: 10,
  interactionBonus: 15,
  hyperOptimizedPenalty: 0,
  cedhStapleBonus: 20,
  bypassTypeRatios: true,
  comboOverrideScore: 160,
  fastManaOverrideScore: 140,
  interactionOverrideScore: 0,
};

const BRACKET_5_CEDH: BracketStrategy = {
  name: 'cEDH',
  description: 'Competitive — fastest combos, maximum interaction, win turns 1-3',
  comboMode: 'maximum',
  comboCompleteness: 'force',
  comboMinTotalCMC: 0,
  gameChangersAllowed: Infinity,
  tutorAdjustment: 35,
  excludeTutors: false,
  edhrecSynergyWeight: 2.0,
  themeBonus: 0.0,
  functionalMinimums: {
    ramp: 14,
    card_draw: 10,
    removal: 10,
    board_wipe: 2,
    protection: 6,
    tutor: 3,
    payoff: 8,
  },
  preferCurve: 'hyper_low',
  penalizeHighCMC: true,
  highCMCPenaltyPerPoint: 15,
  highCMCThreshold: 4,
  fastManaAllowed: true,
  fastManaBonus: 50,
  extraTurnsAllowed: true,
  massLandDenialAllowed: true,
  landCount: 29,
  searchFastMana: true,
  searchCedhStaples: true,
  searchGameChangers: true,
  tribalFillerPenalty: 30,
  interactionBonus: 30,
  hyperOptimizedPenalty: 0,
  cedhStapleBonus: 40,
  bypassTypeRatios: true,
  comboOverrideScore: 200,
  fastManaOverrideScore: 180,
  interactionOverrideScore: 150,
};

export const BRACKET_STRATEGIES: Record<number, BracketStrategy> = {
  1: BRACKET_1_EXHIBITION,
  2: BRACKET_2_CORE,
  3: BRACKET_3_UPGRADED,
  4: BRACKET_4_OPTIMIZED,
  5: BRACKET_5_CEDH,
};

/**
 * Returns the BracketStrategy for the given target bracket, or null if
 * no bracket is specified (legacy "any" mode — existing defaults apply).
 */
export function getBracketStrategy(targetBracket?: number): BracketStrategy | null {
  if (targetBracket === undefined || targetBracket === null) return null;
  return BRACKET_STRATEGIES[targetBracket] ?? null;
}

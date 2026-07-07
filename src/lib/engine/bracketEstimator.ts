import type { DetectedCombo } from './types';
import { hasTag, isMassLandDenial, isExtraTurn, getCardRole } from './tagger-client';
import {
  SOFT_SCORE_WEIGHTS,
  getHardConstraints,
  type Band,
  type Posture,
} from './bracketConfig';
import { loadFastManaLists, loadFreeInteractionList } from './curated-lists';

// ── Types ──────────────────────────────────────────────────────────────────

export interface BracketEstimation {
  bracket: 1 | 2 | 3 | 4 | 5;
  label: string;
  band: Band;
  hardFloors: BracketFloor[];
  softScore: number;
  breakdown: BracketBreakdown;
  shapedBy?: string[];
  confidenceNotes?: string[];
  snapshotVersion?: string;
}

export interface BracketFloor {
  bracket: number;
  reason: string;
  detail?: string;
}

export interface BracketBreakdown {
  gameChangerCount: number;
  gameChangerNames: string[];
  massLandDenialCount: number;
  massLandDenialNames: string[];
  extraTurnCount: number;
  extraTurnNames: string[];
  earlyComboCount: number;
  lateComboCount: number;
  // T1: split fast_mana into rocks vs dorks
  fastManaRockCount: number;
  fastManaRockNames: string[];
  manaDorkCount: number;
  manaDorkNames: string[];
  // free interaction (0-cost alt-cost interaction)
  freeInteractionCount: number;
  freeInteractionNames: string[];
  // compact win lines (distinct <=2-card combos)
  compactWinLines: number;
  // legacy compat — sum of rocks + dorks
  fastManaCount: number;
  fastManaNames: string[];
  tutorCount: number;
  tutorNames: string[];
  averageCmc: number;
  interactionCount: number;
}

// ── Constants ──────────────────────────────────────────────────────────────

const BRACKET_LABELS: Record<number, string> = {
  1: 'Exhibition',
  2: 'Core',
  3: 'Upgraded',
  4: 'Optimized',
  5: 'cEDH',
};

// D3: Fast mana ROCKS + rituals — loaded from data/fast-mana-lists.json.
// Hardcoded defaults below are used until initBracketLists() is called.
// Mana dorks are tracked separately and do NOT feed into bracket score.
export let FAST_MANA_ROCKS = new Set([
  'Sol Ring', 'Mana Crypt', 'Mana Vault', 'Grim Monolith',
  'Chrome Mox', 'Mox Diamond', "Lion's Eye Diamond", 'Lotus Petal',
  'Mox Opal', 'Mox Amber', 'Jeweled Lotus', 'Ancient Tomb',
  'Dark Ritual', 'Cabal Ritual', 'Rite of Flame', 'Pyretic Ritual',
  'Desperate Ritual', "Jeska's Will", 'Culling the Weak',
  'Simian Spirit Guide', 'Elvish Spirit Guide',
  'Arcane Signet', 'Fellwar Stone',
  'Talisman of Creativity', 'Talisman of Conviction', 'Talisman of Curiosity',
  'Talisman of Dominance', 'Talisman of Hierarchy', 'Talisman of Impulse',
  'Talisman of Indulgence', 'Talisman of Progress', 'Talisman of Resilience',
  'Talisman of Unity', 'Basalt Monolith',
]);

// D3: Free interaction — loaded from data/free-interaction-list.json.
export let FREE_INTERACTION = new Set([
  'Force of Will', 'Force of Negation', 'Fierce Guardianship',
  'Pact of Negation', 'Mental Misstep', 'Deflecting Swat', 'Deadly Rollick',
  'Misdirection', 'Mindbreak Trap',
  'Subtlety', 'Solitude', 'Grief', 'Endurance', 'Fury',
  'Force of Vigor', 'Flare of Denial', 'Flare of Fortitude',
  'Flare of Malice', 'Flare of Duplication', 'Flare of Cultivation',
]);

// D3: Mana dorks — loaded from data/fast-mana-lists.json.
export let MANA_DORKS = new Set<string>();

let listsInitialized = false;

/**
 * Load bracket signal lists from curated list files (data/*.json).
 * Call once during deck generation startup. Safe to call multiple times.
 */
export async function initBracketLists(): Promise<void> {
  if (listsInitialized) return;
  try {
    const [fastMana, freeInt] = await Promise.all([
      loadFastManaLists(),
      loadFreeInteractionList(),
    ]);
    FAST_MANA_ROCKS = fastMana.bracketSignal;
    MANA_DORKS = fastMana.dorks;
    FREE_INTERACTION = freeInt.cards;
    listsInitialized = true;
    console.log(`[BracketEstimator] Lists initialized from curated files (rocks=${FAST_MANA_ROCKS.size}, dorks=${MANA_DORKS.size}, free=${FREE_INTERACTION.size})`);
  } catch (err) {
    console.warn('[BracketEstimator] Failed to load curated lists, using hardcoded defaults:', err);
  }
}

// ── Estimation ─────────────────────────────────────────────────────────────

export function estimateBracket(
  allCardNames: string[],
  detectedCombos: DetectedCombo[] | undefined,
  averageCmc: number,
  _deckScore: number | undefined,
  roleCounts: Record<string, number> | undefined,
  gameChangerNames: Set<string>,
  userIntentBracket?: number,
  snapshotVersion?: string,
): BracketEstimation {
  // ── 1. Count signals (T1: split rocks vs dorks) ──

  const gameChangers: string[] = [];
  const massLandDenial: string[] = [];
  const extraTurns: string[] = [];
  const fastManaRocks: string[] = [];
  const manaDorks: string[] = [];
  const freeInteraction: string[] = [];
  const tutors: string[] = [];

  for (const name of allCardNames) {
    if (gameChangerNames.has(name)) gameChangers.push(name);
    if (isMassLandDenial(name)) massLandDenial.push(name);
    if (isExtraTurn(name)) extraTurns.push(name);
    if (FAST_MANA_ROCKS.has(name)) fastManaRocks.push(name);
    if (FREE_INTERACTION.has(name)) freeInteraction.push(name);
    // Mana dorks: curated list OR tagger tag (union, deduplicated by the push guard)
    if (MANA_DORKS.has(name) || hasTag(name, 'mana-dork')) manaDorks.push(name);
    if (hasTag(name, 'tutor') && getCardRole(name) === 'cardDraw') tutors.push(name);
  }

  // ── 2. Classify combos ──

  let earlyComboCount = 0;
  let lateComboCount = 0;

  if (detectedCombos) {
    for (const combo of detectedCombos) {
      if (!combo.isComplete) continue;
      const bracketNum = parseInt(combo.bracket, 10);
      if (isNaN(bracketNum)) continue;
      if (bracketNum >= 4) earlyComboCount++;
      else if (bracketNum === 3) lateComboCount++;
    }
  }

  const compactWinLines = earlyComboCount + lateComboCount;

  // ── 3. Interaction count ──

  const interactionCount = roleCounts
    ? (roleCounts['removal'] ?? 0) + (roleCounts['boardwipe'] ?? 0)
    : 0;

  // ── 4. T2: Two-band step function — primary hard gate on GC count ──
  // T8: Hard constraints are DISQUALIFYING GATES, not score penalties.

  const gcCount = gameChangers.length;
  let band: Band;
  let candidateBrackets: number[];

  if (gcCount === 0) {
    band = 'low';
    candidateBrackets = [1, 2];
  } else if (gcCount >= 1 && gcCount <= 3) {
    band = 'low';
    candidateBrackets = [3];
  } else {
    band = 'high';
    candidateBrackets = [4, 5];
  }

  // Also force high band on MLD or fast 2-card combos
  if (massLandDenial.length > 0) {
    band = 'high';
    candidateBrackets = [4, 5];
  }
  if (earlyComboCount > 0) {
    band = 'high';
    candidateBrackets = [4, 5];
  }

  // Build hard floor reasons for display
  const hardFloors: BracketFloor[] = [];

  if (gcCount >= 4) {
    hardFloors.push({
      bracket: 4,
      reason: `${gcCount} Game Changer cards`,
      detail: 'Having 4+ Game Changers places this deck in the high power band (B4/B5).',
    });
  } else if (gcCount > 0) {
    hardFloors.push({
      bracket: 3,
      reason: `${gcCount} Game Changer card${gcCount > 1 ? 's' : ''}`,
      detail: gcCount <= 3
        ? 'Up to 3 Game Changers is allowed at Bracket 3.'
        : undefined,
    });
  }

  if (massLandDenial.length > 0) {
    hardFloors.push({
      bracket: 4,
      reason: `Mass land denial (${massLandDenial.join(', ')})`,
      detail: 'Mass land denial forces high band regardless of other metrics.',
    });
  }

  if (earlyComboCount > 0) {
    hardFloors.push({
      bracket: 4,
      reason: `${earlyComboCount} fast two-card combo${earlyComboCount > 1 ? 's' : ''}`,
      detail: 'Fast (pre-turn-6) two-card infinite combos force high band.',
    });
  }

  if (extraTurns.length > 0) {
    hardFloors.push({
      bracket: 2,
      reason: `${extraTurns.length} extra turn spell${extraTurns.length > 1 ? 's' : ''}`,
      detail: 'Extra turns push power level above Exhibition.',
    });
  }

  // ── 5. T3: Soft score — weighted sum of four discriminators ──
  // card_advantage_engines, tutor_count, mana_dork_count have ZERO weight.
  // Exact thresholds are PROVISIONAL (MEASURED_UNDERSAMPLED).

  const w = SOFT_SCORE_WEIGHTS;

  // Normalize each signal to 0-1 range using measured high-bracket ceilings
  const normRocks = Math.min(1, fastManaRocks.length / 15);
  const normFree = Math.min(1, freeInteraction.length / 8);
  const normCombos = Math.min(1, compactWinLines / 5);
  const normGC = Math.min(1, gcCount / 20);

  const rawSoftScore =
    w.fast_mana_rocks * normRocks +
    w.free_interaction * normFree +
    w.compact_win_lines * normCombos +
    w.game_changer_count * normGC;

  const softScore = Math.round(rawSoftScore * 100);

  // ── 6. Place within band ──

  let bracket: number;

  if (band === 'high') {
    // T4: Do NOT separate B4 from B5 by deck contents.
    // Split only by user intent flag.
    if (userIntentBracket === 5) {
      bracket = 5;
    } else {
      bracket = 4;
    }
  } else {
    // Low band: B1, B2, or B3
    if (candidateBrackets.includes(3)) {
      bracket = 3;
    } else {
      // GC=0: distinguish B1 vs B2
      // B1 = Exhibition (thematic/casual, no combos, no extra turns, low soft score)
      // B2 = Core (everything else with GC=0)
      if (softScore <= 5 && earlyComboCount === 0 && lateComboCount === 0 && extraTurns.length === 0) {
        bracket = 1;
      } else {
        bracket = 2;
      }
    }
  }

  // Ensure floor from hard constraints
  const floor = hardFloors.length > 0
    ? Math.max(...hardFloors.map(f => f.bracket))
    : 1;
  bracket = Math.max(bracket, floor);

  const clampedBracket = Math.max(1, Math.min(5, bracket)) as 1 | 2 | 3 | 4 | 5;

  return {
    bracket: clampedBracket,
    label: BRACKET_LABELS[clampedBracket],
    band,
    hardFloors,
    softScore,
    breakdown: {
      gameChangerCount: gcCount,
      gameChangerNames: gameChangers,
      massLandDenialCount: massLandDenial.length,
      massLandDenialNames: massLandDenial,
      extraTurnCount: extraTurns.length,
      extraTurnNames: extraTurns,
      earlyComboCount,
      lateComboCount,
      fastManaRockCount: fastManaRocks.length,
      fastManaRockNames: fastManaRocks,
      manaDorkCount: manaDorks.length,
      manaDorkNames: manaDorks,
      freeInteractionCount: freeInteraction.length,
      freeInteractionNames: freeInteraction,
      compactWinLines,
      // Legacy compat
      fastManaCount: fastManaRocks.length + manaDorks.length,
      fastManaNames: [...fastManaRocks, ...manaDorks],
      tutorCount: tutors.length,
      tutorNames: tutors,
      averageCmc: averageCmc,
      interactionCount,
    },
    snapshotVersion,
  };
}

// ── T8: Hard constraint validation ─────────────────────────────────────────
// Returns violations if the deck breaks the hard constraints for its target
// bracket. These are DISQUALIFYING — a B2 deck with 1 GC is rejected, not
// merely scored lower.

export interface HardConstraintViolation {
  constraint: string;
  message: string;
  actual: number;
  limit: number | null;
}

export function validateHardConstraints(
  targetBracket: number,
  breakdown: BracketBreakdown,
): HardConstraintViolation[] {
  const violations: HardConstraintViolation[] = [];
  const hard = getHardConstraints(targetBracket);

  if (hard.game_changers_max !== null && breakdown.gameChangerCount > hard.game_changers_max) {
    violations.push({
      constraint: 'game_changers_max',
      message: `Bracket ${targetBracket} allows at most ${hard.game_changers_max} Game Changer${hard.game_changers_max !== 1 ? 's' : ''}, but deck has ${breakdown.gameChangerCount}.`,
      actual: breakdown.gameChangerCount,
      limit: hard.game_changers_max,
    });
  }

  if (!hard.mass_land_denial && breakdown.massLandDenialCount > 0) {
    violations.push({
      constraint: 'mass_land_denial',
      message: `Bracket ${targetBracket} does not allow mass land denial.`,
      actual: breakdown.massLandDenialCount,
      limit: 0,
    });
  }

  if (hard.intentional_two_card_combos === false && (breakdown.earlyComboCount + breakdown.lateComboCount) > 0) {
    violations.push({
      constraint: 'intentional_two_card_combos',
      message: `Bracket ${targetBracket} does not allow intentional two-card combos.`,
      actual: breakdown.earlyComboCount + breakdown.lateComboCount,
      limit: 0,
    });
  }

  if (hard.early_two_card_combos === false && breakdown.earlyComboCount > 0) {
    violations.push({
      constraint: 'early_two_card_combos',
      message: `Bracket ${targetBracket} does not allow early (pre-turn-6) two-card combos.`,
      actual: breakdown.earlyComboCount,
      limit: 0,
    });
  }

  return violations;
}

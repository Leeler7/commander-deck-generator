/**
 * Classifies a card's functional role(s) based on its oracle text.
 * A card can fill multiple roles simultaneously (e.g. a creature that ramps AND draws).
 */

export type FunctionalRole = 'ramp' | 'card_draw' | 'removal' | 'board_wipe' | 'protection' | 'tutor' | 'payoff';

export interface FunctionalCoverage {
  ramp: number;
  card_draw: number;
  removal: number;
  board_wipe: number;
  protection: number;
  tutor: number;
  payoff: number;
}

/** Minimum thresholds for a well-rounded deck */
export const FUNCTIONAL_MINIMUMS: FunctionalCoverage = {
  ramp: 10,
  card_draw: 8,
  removal: 7,
  board_wipe: 2,
  protection: 3,
  tutor: 0,   // tutors are optional — bonus only, no minimum
  payoff: 3,
};

/** Bonus points awarded when a card fills an unmet functional need */
export const FUNCTIONAL_BONUSES: FunctionalCoverage = {
  ramp: 15,
  card_draw: 15,
  removal: 15,
  board_wipe: 20,
  protection: 10,
  tutor: 10,
  payoff: 12,
};

export function classifyCardFunction(oracleText: string, typeLine: string = ''): FunctionalRole[] {
  const text = oracleText.toLowerCase();
  const type = typeLine.toLowerCase();
  const roles: FunctionalRole[] = [];

  // ── Ramp ──────────────────────────────────────────────────────────────────
  // Mana acceleration: adding mana, fetching lands, mana rocks/dorks
  if (
    text.includes('add {') ||
    text.includes('add one mana') ||
    text.includes('add mana') ||
    (text.includes('search your library') && text.includes('land') && text.includes('put it onto the battlefield')) ||
    (text.includes('search your library') && text.includes('land') && text.includes('put that card onto the battlefield')) ||
    (type.includes('creature') && text.includes('add {') ) ||
    text.includes('you may spend mana as though') ||
    text.includes('costs {') && text.includes('less to cast')
  ) {
    roles.push('ramp');
  }

  // ── Card Draw ─────────────────────────────────────────────────────────────
  if (
    text.includes('draw a card') ||
    text.includes('draw cards') ||
    text.includes('draw x cards') ||
    text.includes('draw two') ||
    text.includes('draw three') ||
    /draw \d+ cards?/.test(text) ||
    (text.includes('exile the top') && (text.includes('you may play') || text.includes('you may cast'))) ||
    (text.includes('exile') && text.includes('top of') && text.includes('may cast'))
  ) {
    roles.push('card_draw');
  }

  // ── Removal ───────────────────────────────────────────────────────────────
  // Single-target removal
  if (
    text.includes('destroy target') ||
    text.includes('exile target') ||
    (text.includes('deals') && text.includes('damage') && (text.includes('to target') || text.includes('to any target'))) ||
    text.includes('return target') && text.includes("owner's hand") ||
    text.includes('-x/-x') ||
    (text.includes('target creature') && text.includes('-') && text.includes('/'))
  ) {
    roles.push('removal');
  }

  // ── Board Wipe ────────────────────────────────────────────────────────────
  if (
    text.includes('destroy all') ||
    text.includes('exile all') ||
    text.includes('all creatures') && (text.includes('destroy') || text.includes('exile') || text.includes('damage')) ||
    text.includes('deals x damage to each') ||
    text.includes('deals damage to each creature') ||
    text.includes('each creature gets -') ||
    text.includes('return all') && text.includes("owner's hand") ||
    text.includes('sacrifice all')
  ) {
    roles.push('board_wipe');
  }

  // ── Protection ────────────────────────────────────────────────────────────
  if (
    text.includes('hexproof') ||
    text.includes('shroud') ||
    text.includes('indestructible') ||
    text.includes('ward ') ||
    (text.includes('can\'t be the target') && text.includes('spells')) ||
    text.includes('regenerate') ||
    (text.includes('protection from') && (type.includes('equipment') || type.includes('enchantment') || type.includes('instant')))
  ) {
    roles.push('protection');
  }

  // ── Tutor ─────────────────────────────────────────────────────────────────
  // Library searches NOT for basic lands
  if (
    text.includes('search your library') &&
    !text.includes('search your library for a basic land') &&
    !text.includes('search your library for a land card') &&
    !(text.includes('search your library') && text.includes('land') && !text.includes('creature') && !text.includes('artifact') && !text.includes('card with'))
  ) {
    roles.push('tutor');
  }

  // ── Payoff ────────────────────────────────────────────────────────────────
  // Win conditions, anthem effects, damage to opponents
  if (
    text.includes('each opponent loses') ||
    text.includes('damage to each opponent') ||
    text.includes('life total becomes') ||
    (text.includes('creatures you control') && text.includes('get +')) ||
    (text.includes('creature tokens') && text.includes('get +')) ||
    text.includes('whenever a creature enters') && text.includes('damage') ||
    text.includes('whenever a creature enters') && text.includes('each opponent') ||
    text.includes('when ~ enters') && text.includes('damage') ||
    text.includes('win the game')
  ) {
    roles.push('payoff');
  }

  return roles;
}

/** Count functional roles across a set of cards */
export function countFunctionalRoles(cards: Array<{ oracle_text?: string; type_line?: string }>): FunctionalCoverage {
  const coverage: FunctionalCoverage = {
    ramp: 0, card_draw: 0, removal: 0,
    board_wipe: 0, protection: 0, tutor: 0, payoff: 0
  };
  for (const card of cards) {
    const roles = classifyCardFunction(card.oracle_text || '', card.type_line || '');
    for (const role of roles) coverage[role]++;
  }
  return coverage;
}

/**
 * Calculate bonus points for a card based on unmet functional needs.
 *
 * When a `minimumsOverride` is provided (from BracketStrategy), it takes
 * precedence over the old ad-hoc bracket logic.
 */
export function calculateFunctionalBonus(
  roles: FunctionalRole[],
  coverage: FunctionalCoverage,
  bracketTarget?: number,
  minimumsOverride?: Partial<FunctionalCoverage>,
): { bonus: number; reasons: string[] } {
  let bonus = 0;
  const reasons: string[] = [];

  // Resolve minimums: strategy-driven override > ad-hoc bracket logic > defaults
  let minimums: FunctionalCoverage;
  let bonuses: FunctionalCoverage;

  if (minimumsOverride) {
    minimums = { ...FUNCTIONAL_MINIMUMS, ...minimumsOverride };
    // Scale tutor bonus based on whether tutors are desired
    const tutorBonus = (minimumsOverride.tutor ?? 0) > 0 ? 20 : FUNCTIONAL_BONUSES.tutor;
    bonuses = { ...FUNCTIONAL_BONUSES, tutor: tutorBonus };
  } else {
    const isHighPower = bracketTarget !== undefined && bracketTarget >= 4;
    minimums = isHighPower
      ? { ...FUNCTIONAL_MINIMUMS, ramp: 12, card_draw: 10, tutor: 3 }
      : FUNCTIONAL_MINIMUMS;
    bonuses = isHighPower
      ? { ...FUNCTIONAL_BONUSES, tutor: 20 }
      : (bracketTarget !== undefined && bracketTarget <= 2)
        ? { ...FUNCTIONAL_BONUSES, tutor: -10 }
        : FUNCTIONAL_BONUSES;
  }

  for (const role of roles) {
    const min = minimums[role];
    const current = coverage[role];
    if (current < min) {
      const b = bonuses[role];
      if (b > 0) {
        bonus += b;
        reasons.push(`+${b} (needs ${role}: ${current}/${min})`);
      } else if (b < 0) {
        bonus += b;
        reasons.push(`${b} (${role} deprioritized)`);
      }
    }
  }

  return { bonus, reasons };
}

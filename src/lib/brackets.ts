// Official Commander Format Panel bracket system (as of Feb 2026)
export const GAME_CHANGERS: string[] = [
  // White
  'Drannith Magistrate', 'Enlightened Tutor', "Serra's Sanctum",
  'Smothering Tithe', 'Trouble in Pairs',
  // Blue
  'Cyclonic Rift', 'Expropriate', 'Force of Will', 'Fierce Guardianship',
  'Rhystic Study', "Thassa's Oracle", 'Urza, Lord High Artificer',
  'Mystical Tutor', 'Jin-Gitaxias, Core Augur',
  // Black
  "Bolas's Citadel", 'Demonic Tutor', 'Imperial Seal',
  'Opposition Agent', 'Tergrid, God of Fright', 'Vampiric Tutor', 'Ad Nauseam',
  // Red
  "Jeska's Will", 'Underworld Breach',
  // Green
  'Survival of the Fittest', 'Vorinclex, Voice of Hunger', "Gaea's Cradle",
  // Multicolor
  'Kinnan, Bonder Prodigy', "Yuriko, the Tiger's Shadow",
  'Winota, Joiner of Forces', 'Grand Arbiter Augustin IV',
  // Colorless
  'Ancient Tomb', 'Chrome Mox', 'The One Ring',
  'The Tabernacle at Pendrell Vale', 'Trinisphere', 'Grim Monolith',
  "Lion's Eye Diamond", 'Mox Diamond', 'Mana Vault', 'Glacial Chasm',
  // Added Feb 2026
  'Farewell', 'Biorhythm',
];

import { isFastMana } from './bracket-strategy';

export interface BracketEstimateLocal {
  bracket: number;
  gameChangersFound: string[];
  gameChangerCount: number;
  reasons: string[];
  combos?: import('./types').ComboResult[];
  /** Detailed diagnostics for bracket verification */
  diagnostics?: BracketDiagnostics;
}

export interface BracketDiagnostics {
  tutorCount: number;
  fastManaCount: number;
  averageCMC: number;
  infiniteComboCount: number;
  gameChangerCount: number;
  /** Cards used for diagnostics (for display) */
  tutorNames: string[];
  fastManaNames: string[];
}

/**
 * Estimate the power bracket of a deck based on its card composition.
 *
 * Bracket 1 (Exhibition) — ALL of:
 *   - Zero Game Changers
 *   - Zero tutors (non-land library search)
 *   - Zero extra turn cards
 *   - No fast mana
 *   - Average CMC of non-land cards >= 3.0
 *
 * Bracket 2 (Core):
 *   - Zero Game Changers
 *   - Does NOT meet all Bracket 1 restrictions
 *
 * Bracket 3 (Upgraded):
 *   - 1-3 Game Changers
 *   - OR: 0 Game Changers but infinite combos detected
 *
 * Bracket 4 (Optimized):
 *   - 4+ Game Changers
 *   - OR: any Game Changers + infinite combos + fast mana density >= 4
 *
 * Bracket 5 (cEDH):
 *   - User-selected only (mindset-based, cannot be auto-detected reliably)
 *   - Verified by: 6+ GC + multiple combo lines + avg CMC < 2.5 + 8+ fast mana
 */
export function estimateBracketLocal(
  cardNames: string[],
  commanderName: string,
  combos: import('./types').ComboResult[] = [],
  oracleTexts?: Map<string, string>,
  cardCMCs?: Map<string, number>,
  cardTypes?: Map<string, string>,
): BracketEstimateLocal {
  const normalizedCards = cardNames.map(n => n.toLowerCase());
  const normalizedCommander = commanderName.toLowerCase();

  // ── Game Changers ─────────────────────────────────────────────────────────
  const found: string[] = [];
  for (const gc of GAME_CHANGERS) {
    if (
      normalizedCards.includes(gc.toLowerCase()) ||
      normalizedCommander === gc.toLowerCase()
    ) {
      found.push(gc);
    }
  }
  const gcCount = found.length;

  // ── Tutors (non-land library search) ──────────────────────────────────────
  const tutorNames: string[] = [];
  if (oracleTexts) {
    for (const [name, text] of oracleTexts) {
      const t = text.toLowerCase();
      if (
        t.includes('search your library') &&
        !t.includes('search your library for a basic land') &&
        !t.includes('search your library for a land card') &&
        !(t.includes('search your library') && t.includes('land') && !t.includes('creature') && !t.includes('artifact') && !t.includes('card with'))
      ) {
        tutorNames.push(name);
      }
    }
  }

  // ── Fast mana ─────────────────────────────────────────────────────────────
  const fastManaNames: string[] = [];
  for (const cardName of cardNames) {
    if (isFastMana(cardName)) {
      fastManaNames.push(cardName);
    }
  }

  // ── Average CMC ───────────────────────────────────────────────────────────
  let averageCMC = 3.0; // default if no data
  if (cardCMCs && cardTypes) {
    const nonLandCMCs: number[] = [];
    for (const [name, cmc] of cardCMCs) {
      const type = cardTypes.get(name) ?? '';
      if (!type.toLowerCase().includes('land')) {
        nonLandCMCs.push(cmc);
      }
    }
    if (nonLandCMCs.length > 0) {
      averageCMC = nonLandCMCs.reduce((a, b) => a + b, 0) / nonLandCMCs.length;
    }
  }

  // ── Infinite combos ───────────────────────────────────────────────────────
  const infiniteCombos = combos.filter(c =>
    c.results.some(r => {
      const rl = r.toLowerCase();
      return rl.includes('infinite') || rl.includes('unlimited');
    })
  );

  const diagnostics: BracketDiagnostics = {
    tutorCount: tutorNames.length,
    fastManaCount: fastManaNames.length,
    averageCMC: Math.round(averageCMC * 100) / 100,
    infiniteComboCount: infiniteCombos.length,
    gameChangerCount: gcCount,
    tutorNames,
    fastManaNames,
  };

  // ── Bracket determination ─────────────────────────────────────────────────
  const reasons: string[] = [];
  let bracket: number;

  if (gcCount >= 4) {
    // Bracket 4+ territory
    bracket = 4;
    reasons.push(`Contains ${gcCount} Game Changers (4+ = Optimized): ${found.join(', ')}`);

    // Check for cEDH indicators (bracket 5 verification)
    if (gcCount >= 6 && infiniteCombos.length >= 2 && averageCMC < 2.5 && fastManaNames.length >= 8) {
      bracket = 5;
      reasons.push(`cEDH indicators: ${gcCount} GC, ${infiniteCombos.length} infinite combos, avg CMC ${averageCMC.toFixed(2)}, ${fastManaNames.length} fast mana`);
    }
  } else if (gcCount >= 1 && gcCount <= 3) {
    // Bracket 3 base
    bracket = 3;
    reasons.push(`Contains ${gcCount} Game Changer${gcCount > 1 ? 's' : ''}: ${found.join(', ')}`);

    // Can bump to 4 if also has infinite combos + fast mana
    if (infiniteCombos.length > 0 && fastManaNames.length >= 4) {
      bracket = 4;
      reasons.push(`Bumped to Optimized: ${infiniteCombos.length} infinite combo(s) + ${fastManaNames.length} fast mana sources`);
    }
  } else {
    // Zero Game Changers: Bracket 1 or 2
    if (infiniteCombos.length > 0) {
      bracket = 3;
      reasons.push(`${infiniteCombos.length} infinite combo(s) detected — bumped to Upgraded (Bracket 3)`);
    } else {
      // Distinguish Bracket 1 vs 2
      const hasNoTutors = tutorNames.length === 0;
      const hasNoFastMana = fastManaNames.length === 0;
      const hasHighCMC = averageCMC >= 3.0;

      if (hasNoTutors && hasNoFastMana && hasHighCMC) {
        bracket = 1;
        reasons.push(`Exhibition: no Game Changers, no tutors, no fast mana, avg CMC ${averageCMC.toFixed(2)} ≥ 3.0`);
      } else {
        bracket = 2;
        const detailParts: string[] = [];
        if (!hasNoTutors) detailParts.push(`${tutorNames.length} tutor(s)`);
        if (!hasNoFastMana) detailParts.push(`${fastManaNames.length} fast mana`);
        if (!hasHighCMC) detailParts.push(`avg CMC ${averageCMC.toFixed(2)} < 3.0`);
        reasons.push(`Core (Bracket 2): no Game Changers but has ${detailParts.join(', ')}`);
      }
    }
  }

  return { bracket, gameChangersFound: found, gameChangerCount: gcCount, reasons, combos, diagnostics };
}

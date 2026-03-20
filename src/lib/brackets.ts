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

export interface BracketEstimateLocal {
  bracket: number;
  gameChangersFound: string[];
  gameChangerCount: number;
  reasons: string[];
  combos?: import('./types').ComboResult[];
}

export function estimateBracketLocal(
  cardNames: string[],
  commanderName: string,
  combos: import('./types').ComboResult[] = []
): BracketEstimateLocal {
  const normalizedCards = cardNames.map(n => n.toLowerCase());
  const normalizedCommander = commanderName.toLowerCase();

  const found: string[] = [];
  for (const gc of GAME_CHANGERS) {
    if (
      normalizedCards.includes(gc.toLowerCase()) ||
      normalizedCommander === gc.toLowerCase()
    ) {
      found.push(gc);
    }
  }

  const count = found.length;
  const reasons: string[] = [];
  let bracket: number;

  if (count === 0) {
    bracket = 2;
    reasons.push('No Game Changers found — Core (Bracket 2) baseline');
    if (combos.length > 0) {
      bracket = 3;
      reasons.push(`${combos.length} infinite combo(s) detected — bumped to Upgraded (Bracket 3)`);
    }
  } else if (count <= 3) {
    bracket = 3;
    reasons.push(`Contains ${count} Game Changer${count > 1 ? 's' : ''}: ${found.join(', ')}`);
  } else {
    bracket = 4;
    reasons.push(`Contains ${count} Game Changers (4+ = Optimized): ${found.join(', ')}`);
  }

  return { bracket, gameChangersFound: found, gameChangerCount: count, reasons, combos };
}

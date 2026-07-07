import { describe, it, expect, beforeAll } from 'vitest';
import { estimateBracket, initBracketLists, FAST_MANA_ROCKS, FREE_INTERACTION } from '../bracketEstimator';
import { loadGameChangerList } from '../curated-lists';
import type { DetectedCombo } from '../types';

// Ground truth from engine-config.json bracket_ground_truth
const FIXTURES = [
  {
    commander: 'Kinnan, Bonder Prodigy',
    expectedBrackets: [4, 5],
    expectedBand: 'high' as const,
    // Kinnan cEDH: tons of game changers, fast mana, infinite mana combos
    gameChangerCount: 13, // approximate
    fastRockCount: 13,    // approximate
    comboCount: 3,
  },
  {
    commander: 'Bristly Bill, Spine Sower',
    expectedBrackets: [3],
    expectedBand: 'low' as const,
    gameChangerCount: 1,
    fastRockCount: 0,
    comboCount: 0,
  },
  {
    commander: 'Shorikai, Genesis Engine',
    expectedBrackets: [4, 5],
    expectedBand: 'high' as const,
    gameChangerCount: 8,
    fastRockCount: 10,
    comboCount: 2,
  },
  {
    commander: 'Brigid, Hero of Kinsbaile',
    expectedBrackets: [2],
    expectedBand: 'low' as const,
    gameChangerCount: 0,
    fastRockCount: 0,
    comboCount: 0,
  },
];

describe('Bracket cross-validation', () => {
  let gcNames: Set<string>;

  beforeAll(async () => {
    await initBracketLists();
    const gcList = await loadGameChangerList();
    gcNames = gcList.cards;
  });

  it('game changers snapshot has 53 cards', async () => {
    const gcList = await loadGameChangerList();
    // DFC front-face indexing adds extras, so check original count
    expect(gcList.cards.size).toBeGreaterThanOrEqual(53);
  });

  it('fast mana rocks loaded from curated list', () => {
    expect(FAST_MANA_ROCKS.size).toBeGreaterThanOrEqual(25);
    expect(FAST_MANA_ROCKS.has('Sol Ring')).toBe(true);
    expect(FAST_MANA_ROCKS.has('Mana Crypt')).toBe(true);
    expect(FAST_MANA_ROCKS.has('Dark Ritual')).toBe(true);
  });

  it('free interaction loaded from curated list', () => {
    expect(FREE_INTERACTION.size).toBeGreaterThanOrEqual(15);
    expect(FREE_INTERACTION.has('Force of Will')).toBe(true);
    expect(FREE_INTERACTION.has('Fierce Guardianship')).toBe(true);
  });

  for (const fixture of FIXTURES) {
    describe(fixture.commander, () => {
      it(`classifies as band=${fixture.expectedBand}`, () => {
        // Build a synthetic card list matching the fixture's profile
        const cards = buildSyntheticDeck(fixture);
        const combos = buildSyntheticCombos(fixture.comboCount);

        const result = estimateBracket(
          cards,
          combos,
          fixture.expectedBand === 'high' ? 2.2 : 3.0,
          undefined,
          undefined,
          gcNames,
        );

        expect(result.band).toBe(fixture.expectedBand);
      });

      it(`bracket is in ${JSON.stringify(fixture.expectedBrackets)}`, () => {
        const cards = buildSyntheticDeck(fixture);
        const combos = buildSyntheticCombos(fixture.comboCount);

        const result = estimateBracket(
          cards,
          combos,
          fixture.expectedBand === 'high' ? 2.2 : 3.0,
          undefined,
          undefined,
          gcNames,
        );

        expect(fixture.expectedBrackets).toContain(result.bracket);
      });

      it('snapshot version propagates when provided', () => {
        const cards = buildSyntheticDeck(fixture);
        const combos = buildSyntheticCombos(fixture.comboCount);

        const result = estimateBracket(
          cards,
          combos,
          3.0,
          undefined,
          undefined,
          gcNames,
          undefined,
          'test-v1.0',
        );

        expect(result.snapshotVersion).toBe('test-v1.0');
      });
    });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function buildSyntheticDeck(fixture: typeof FIXTURES[0]): string[] {
  const cards: string[] = [fixture.commander];

  // Add game changers from the real list
  const gcArray = [
    'Sol Ring', 'Mana Crypt', 'Mana Vault', 'Grim Monolith', 'Chrome Mox',
    'Mox Diamond', 'Rhystic Study', 'Smothering Tithe', 'Cyclonic Rift',
    'Demonic Tutor', 'Vampiric Tutor', 'Mystical Tutor', 'Force of Will',
    'Fierce Guardianship', 'Necropotence', 'Ad Nauseam', 'The One Ring',
    "Jeska's Will", 'Consecrated Sphinx', 'Thassa\'s Oracle',
  ];
  for (let i = 0; i < fixture.gameChangerCount && i < gcArray.length; i++) {
    cards.push(gcArray[i]);
  }

  // Add fast mana rocks (non-GC ones to avoid double counting)
  const extraRocks = [
    'Arcane Signet', 'Fellwar Stone', 'Lotus Petal', 'Mox Opal', 'Mox Amber',
    'Dark Ritual', 'Cabal Ritual', 'Pyretic Ritual', 'Ancient Tomb',
    'Talisman of Dominance', 'Talisman of Progress', 'Basalt Monolith',
  ];
  const rocksNeeded = Math.max(0, fixture.fastRockCount - fixture.gameChangerCount);
  for (let i = 0; i < rocksNeeded && i < extraRocks.length; i++) {
    if (!cards.includes(extraRocks[i])) cards.push(extraRocks[i]);
  }

  // Pad to ~30 cards with generic names
  while (cards.length < 30) {
    cards.push(`Generic Card ${cards.length}`);
  }

  return cards;
}

function buildSyntheticCombos(count: number): DetectedCombo[] {
  const combos: DetectedCombo[] = [];
  for (let i = 0; i < count; i++) {
    combos.push({
      comboId: `test-combo-${i}`,
      cards: [`Combo Card A${i}`, `Combo Card B${i}`],
      results: ['Infinite mana'],
      isComplete: true,
      missingCards: [],
      deckCount: 100,
      bracket: '4',
    });
  }
  return combos;
}

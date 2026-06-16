/**
 * Adapter layer: maps between BDE's API format and the 20q2 engine format.
 * BDE's frontend expects GeneratedDeck from src/lib/types.ts.
 * The 20q2 engine produces GeneratedDeck from src/lib/engine/types.ts.
 */

import type {
  GenerationConstraints as BDEConstraints,
  GeneratedDeck as BDEGeneratedDeck,
  DeckCard as BDEDeckCard,
  CardRole as BDECardRole,
  BracketEstimate as BDEBracketEstimate,
} from '../types';

import type {
  ScryfallCard as EngineScryfallCard,
  GeneratedDeck as EngineGeneratedDeck,
  Customization as EngineCustomization,
  DeckCategory,
  ThemeResult,
  BracketLevel,
  GameChangerLimit,
} from './types';

// ─── BDE constraints → 20q2 Customization ──────────────────────────────────

export function bdeToCustomization(
  bdeConstraints: BDEConstraints
): EngineCustomization {
  const bracket = bdeConstraints.targetBracket ?? 3;

  // Map game changer limit from BDE format
  let gcLimit: GameChangerLimit;
  if (bdeConstraints.gameChangerLimit !== undefined) {
    gcLimit = bdeConstraints.gameChangerLimit;
  } else {
    gcLimit = getGameChangerLimit(bracket);
  }

  const custom: EngineCustomization = {
    deckFormat: 99,
    landCount: bdeConstraints.landCount ?? 36,
    nonBasicLandCount: bdeConstraints.nonBasicLandCount ?? 20,
    bannedCards: bdeConstraints.excludedCards || [],
    banLists: [{
      id: 'default',
      name: 'Commander Banlist',
      cards: [],
      isPreset: true,
      enabled: true,
    }],
    mustIncludeCards: bdeConstraints.mustIncludeCards || [],
    tempBannedCards: [],
    tempMustIncludeCards: [],
    maxCardPrice: bdeConstraints.max_card_price || 50,
    deckBudget: bdeConstraints.total_budget || 100,
    budgetOption: 'any' as const,
    gameChangerLimit: gcLimit,
    bracketLevel: (bracket <= 5 && bracket >= 1 ? bracket : 'all') as BracketLevel,
    maxRarity: bdeConstraints.maxRarity ?? null,
    tinyLeaders: false,
    collectionMode: false,
    collectionStrategy: 'full' as const,
    collectionOwnedPercent: 100,
    arenaOnly: false,
    scryfallQuery: '',
    comboCount: bdeConstraints.comboCount ?? (bdeConstraints.no_infinite_combos ? 0 : 1),
    hyperFocus: bdeConstraints.hyperFocus ?? false,
    balancedRoles: true,
    ignoreOwnedBudget: false,
    ignoreOwnedRarity: false,
    currency: 'USD' as const,
    appliedExcludeLists: [],
    appliedIncludeLists: [],
    advancedTargets: buildAdvancedTargets(bdeConstraints),
    tempoAutoDetect: !bdeConstraints.pacing,
    tempoPacing: bdeConstraints.pacing ?? 'balanced',
  };
  return custom;
}

function getGameChangerLimit(bracket: number): GameChangerLimit {
  switch (bracket) {
    case 1: return 'none';
    case 2: return 'none';
    case 3: return 3;
    case 4:
    case 5:
    default:
      return 'unlimited';
  }
}

function buildAdvancedTargets(bde: BDEConstraints): EngineCustomization['advancedTargets'] {
  const weights = bde.card_type_weights;
  if (!weights) {
    return {
      curvePercentages: null,
      typePercentages: null,
      roleTargets: null,
      edhrecBlendWeight: null,
      edhrecInclusionThreshold: null,
    };
  }

  // Planeswalkers use an exact count (0-20), not a relative weight.
  // Normalize only the 0-10 sliders against each other for percentage distribution.
  const nonPwTotal = weights.creatures + weights.artifacts + weights.enchantments +
    weights.instants + weights.sorceries;
  if (nonPwTotal === 0 && weights.planeswalkers === 0) {
    return {
      curvePercentages: null,
      typePercentages: null,
      roleTargets: null,
      edhrecBlendWeight: null,
      edhrecInclusionThreshold: null,
    };
  }

  // Planeswalker percentage is special: it's an exact count that gets converted
  // to a percentage of non-land cards in applyAdvancedOverrides. We use -1 as a
  // sentinel meaning "exact count" and store the count in a separate field.
  // For the other types, distribute the remaining deck percentage proportionally.
  return {
    typePercentages: {
      creature: nonPwTotal > 0 ? Math.round((weights.creatures / nonPwTotal) * 100) : 0,
      artifact: nonPwTotal > 0 ? Math.round((weights.artifacts / nonPwTotal) * 100) : 0,
      enchantment: nonPwTotal > 0 ? Math.round((weights.enchantments / nonPwTotal) * 100) : 0,
      instant: nonPwTotal > 0 ? Math.round((weights.instants / nonPwTotal) * 100) : 0,
      sorcery: nonPwTotal > 0 ? Math.round((weights.sorceries / nonPwTotal) * 100) : 0,
      planeswalker: weights.planeswalkers,
    },
    planeswalkerExactCount: weights.planeswalkers,
    curvePercentages: null,
    roleTargets: null,
    edhrecBlendWeight: null,
    edhrecInclusionThreshold: null,
  };
}

// ─── Build the context object the engine's generateDeck() expects ───────────

export function buildGenerationContext(
  commander: EngineScryfallCard,
  customization: EngineCustomization,
  themes?: ThemeResult[],
) {
  return {
    commander,
    partnerCommander: null,
    colorIdentity: commander.color_identity,
    customization,
    selectedThemes: themes,
  };
}

// ─── 20q2 GeneratedDeck → BDE GeneratedDeck ─────────────────────────────────

export function engineDeckToBde(
  engineDeck: EngineGeneratedDeck,
  commanderCard: EngineScryfallCard
): BDEGeneratedDeck {
  const nonLandCategories: DeckCategory[] = [
    'ramp', 'cardDraw', 'singleRemoval', 'boardWipes',
    'creatures', 'synergy', 'utility'
  ];

  const lands = (engineDeck.categories.lands || []).map(c => engineCardToBdeDeckCard(c, 'Land'));
  const nonlandCards: BDEDeckCard[] = [];

  for (const cat of nonLandCategories) {
    const cards = engineDeck.categories[cat] || [];
    const role = categoryToRole(cat);
    for (const card of cards) {
      nonlandCards.push(engineCardToBdeDeckCard(card, role));
    }
  }

  // Build role breakdown
  const roleBreakdown: Record<BDECardRole, number> = {
    'Commander': 1,
    'Ramp': (engineDeck.categories.ramp || []).length,
    'Draw/Advantage': (engineDeck.categories.cardDraw || []).length,
    'Removal/Interaction': (engineDeck.categories.singleRemoval || []).length,
    'Board Wipe': (engineDeck.categories.boardWipes || []).length,
    'Tutor': 0,
    'Protection': 0,
    'Synergy/Wincon': (engineDeck.categories.synergy || []).length,
    'Creature': (engineDeck.categories.creatures || []).length,
    'Utility': (engineDeck.categories.utility || []).length,
    'Land': (engineDeck.categories.lands || []).length,
  };

  // Calculate total price
  const allCards = Object.values(engineDeck.categories).flat();
  const totalPrice = allCards.reduce((sum, card) => {
    const price = parseFloat(card.prices?.usd || '0');
    return sum + (isNaN(price) ? 0 : price);
  }, 0);

  // Build set of card names actually in the deck (used for filtering combos and game changers)
  const deckCardNames = new Set(allCards.map(c => c.name));

  // Map combos — only include combos where ALL cards are actually in the deck
  const combos = (engineDeck.detectedCombos || [])
    .filter(combo => combo.cards.every(card => deckCardNames.has(card)))
    .map(combo => ({
      comboId: combo.comboId,
      cards: combo.cards,
      prerequisites: [] as string[],
      steps: [] as string[],
      results: combo.results || [],
    }));

  // Map bracket estimation
  let bracketEstimate: BDEBracketEstimate | undefined;
  if (engineDeck.bracketEstimation) {
    const be = engineDeck.bracketEstimation;
    const gameChangersInDeck = (engineDeck.gameChangerNames || []).filter(name => deckCardNames.has(name));
    const actualInfiniteComboCount = combos.filter(c => c.results.some(r => r.toLowerCase().includes('infinite') || r.toLowerCase().includes('unlimited'))).length;

    // Filter out combo-related reasons that came from unfiltered engine data
    const reasons = (be.hardFloors?.map(f => f.reason || '') || []).filter(r => !r.toLowerCase().includes('infinite combo'));
    // Re-add combo reason based on actual filtered count
    if (actualInfiniteComboCount >= 2) {
      reasons.push(`${actualInfiniteComboCount} early-game infinite combos`);
    } else if (actualInfiniteComboCount === 1) {
      reasons.push('1 early-game infinite combo');
    }

    bracketEstimate = {
      bracket: be.bracket,
      combos,
      gameChangersFound: gameChangersInDeck,
      gameChangerCount: gameChangersInDeck.length,
      reasons,
      diagnostics: {
        tutorCount: be.breakdown?.tutorCount ?? 0,
        fastManaCount: be.breakdown?.fastManaCount ?? 0,
        averageCMC: be.breakdown?.averageCmc ?? engineDeck.stats?.averageCmc ?? 0,
        infiniteComboCount: actualInfiniteComboCount,
        gameChangerCount: be.breakdown?.gameChangerCount ?? 0,
        tutorNames: be.breakdown?.tutorNames ?? [],
        fastManaNames: be.breakdown?.fastManaNames ?? [],
      },
    };
  }

  // Count tutors from all deck cards (tutors are a cardDraw subtype)
  const tutorCount = allCards.filter((c: EngineScryfallCard) => c.cardDrawSubtype === 'tutor').length;

  // Build functional coverage from role counts
  const functionalCoverage = engineDeck.roleCounts ? {
    ramp: engineDeck.roleCounts.ramp || 0,
    card_draw: engineDeck.roleCounts.cardDraw || 0,
    removal: engineDeck.roleCounts.removal || 0,
    board_wipe: engineDeck.roleCounts.boardwipe || 0,
    tutor: tutorCount,
  } : undefined;

  // Build subtype breakdowns from actual categorized cards (not enricher totals,
  // which overcount because creatures with roles get sorted into 'creatures' not the role category)
  const countSubtypes = (cards: EngineScryfallCard[], field: 'rampSubtype' | 'removalSubtype' | 'boardwipeSubtype' | 'cardDrawSubtype') => {
    const counts: Record<string, number> = {};
    for (const card of cards) {
      const sub = card[field] as string | undefined;
      if (sub) counts[sub] = (counts[sub] || 0) + 1;
    }
    return Object.keys(counts).length > 0 ? counts : undefined;
  };
  const subtypeCounts = {
    ramp: countSubtypes(engineDeck.categories.ramp || [], 'rampSubtype'),
    removal: countSubtypes(engineDeck.categories.singleRemoval || [], 'removalSubtype'),
    boardwipe: countSubtypes(engineDeck.categories.boardWipes || [], 'boardwipeSubtype'),
    cardDraw: countSubtypes(engineDeck.categories.cardDraw || [], 'cardDrawSubtype'),
  };

  // Build warnings
  const warnings: string[] = [];
  if (engineDeck.gapAnalysis && engineDeck.gapAnalysis.length > 0) {
    warnings.push(`Gap analysis found ${engineDeck.gapAnalysis.length} potential improvements.`);
  }
  if (engineDeck.filterShortfall && engineDeck.filterShortfall > 0) {
    warnings.push(`Card pool was limited — ${engineDeck.filterShortfall} extra basic lands added.`);
  }

  // Build generation notes
  const notes: string[] = [];
  if (engineDeck.dataSource) {
    notes.push(`Data source: ${engineDeck.dataSource}`);
  }
  if (engineDeck.detectedArchetype) {
    notes.push(`Detected archetype: ${engineDeck.detectedArchetype}`);
  }
  if (engineDeck.detectedPacing) {
    notes.push(`Detected pacing: ${engineDeck.detectedPacing}`);
  }
  if (engineDeck.usedThemes && engineDeck.usedThemes.length > 0) {
    notes.push(`Themes: ${engineDeck.usedThemes.join(', ')}`);
  }
  if (engineDeck.deckGrade) {
    notes.push(`Deck grade: ${engineDeck.deckGrade.letter} — ${engineDeck.deckGrade.headline}`);
  }

  const commanderDeckCard = engineCardToBdeDeckCard(commanderCard, 'Commander');

  return {
    commander: commanderDeckCard,
    nonland_cards: nonlandCards,
    lands,
    total_price: Math.round(totalPrice * 100) / 100,
    role_breakdown: roleBreakdown,
    warnings,
    generation_notes: notes,
    deck_explanation: buildDeckExplanation(engineDeck, commanderCard),
    bracketEstimate,
    functionalCoverage,
    subtypeCounts,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function engineCardToBdeDeckCard(
  card: EngineScryfallCard,
  role: BDECardRole
): BDEDeckCard {
  const price = parseFloat(card.prices?.usd || '0');
  return {
    id: card.id,
    name: card.name,
    mana_cost: card.mana_cost,
    cmc: card.cmc,
    type_line: card.type_line,
    oracle_text: card.oracle_text,
    color_identity: card.color_identity,
    colors: card.colors,
    legalities: card.legalities as BDEDeckCard['legalities'],
    prices: {
      usd: card.prices.usd ?? undefined,
      usd_foil: card.prices.usd_foil ?? undefined,
      eur: card.prices.eur ?? undefined,
      tix: card.prices.tix ?? undefined,
    },
    edhrec_rank: card.edhrec_rank,
    keywords: card.keywords,
    set: card.set,
    set_name: card.set_name,
    rarity: card.rarity,
    power: card.power,
    toughness: card.toughness,
    loyalty: card.loyalty,
    image_uris: card.image_uris,
    quantity: 1,
    role,
    tags: buildTags(card),
    synergy_notes: buildSynergyNotes(card),
    price_used: isNaN(price) ? 0 : price,
    price_source: 'scryfall',
  };
}

function categoryToRole(category: string): BDECardRole {
  switch (category) {
    case 'ramp': return 'Ramp';
    case 'cardDraw': return 'Draw/Advantage';
    case 'singleRemoval': return 'Removal/Interaction';
    case 'boardWipes': return 'Board Wipe';
    case 'creatures': return 'Creature';
    case 'utility': return 'Utility';
    case 'lands': return 'Land';
    default: return 'Synergy/Wincon';
  }
}

function buildTags(card: EngineScryfallCard): string[] {
  const tags: string[] = [];
  if (card.isGameChanger) tags.push('game-changer');
  if (card.isThemeSynergyCard) tags.push('theme-synergy');
  if (card.isMustInclude) tags.push('must-include');
  if (card.deckRole) tags.push(`role:${card.deckRole}`);
  return tags;
}

function buildSynergyNotes(card: EngineScryfallCard): string {
  const parts: string[] = [];
  if (card.deckRole) parts.push(`Role: ${card.deckRole}`);
  if (card.rampSubtype) parts.push(`Ramp: ${card.rampSubtype}`);
  if (card.removalSubtype) parts.push(`Removal: ${card.removalSubtype}`);
  if (card.cardDrawSubtype) parts.push(`Draw: ${card.cardDrawSubtype}`);
  if (card.isGameChanger) parts.push('Game Changer');
  return parts.join(' | ');
}

function buildDeckExplanation(
  engineDeck: EngineGeneratedDeck,
  commander: EngineScryfallCard
): string {
  const stats = engineDeck.stats;
  const parts: string[] = [];
  parts.push(`Deck for ${commander.name}`);
  if (stats) {
    parts.push(`${stats.totalCards} cards, avg CMC ${stats.averageCmc.toFixed(2)}`);
  }
  if (engineDeck.detectedArchetype) {
    parts.push(`Archetype: ${engineDeck.detectedArchetype}`);
  }
  if (engineDeck.usedThemes && engineDeck.usedThemes.length > 0) {
    parts.push(`Themes: ${engineDeck.usedThemes.join(', ')}`);
  }
  if (engineDeck.deckGrade) {
    parts.push(`Grade: ${engineDeck.deckGrade.letter}`);
  }
  return parts.join('. ') + '.';
}

/**
 * Structured Commander Oracle Text Parser
 *
 * Extracts mechanical data from a commander's oracle text using MTG templating rules.
 * The resulting CommanderProfile is computed ONCE per generation and reused for every
 * candidate card evaluation — it replaces the shallow keyword matching in engine-interaction.ts.
 */

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export interface TokenProduction {
  creates: boolean;
  tokenTypes: string[];   // ["Goblin", "Zombie"]
  tokenPT: string | null; // "1/1", "2/2"
  tokenColors: string[];  // ["red", "white"]
  scaling: string | null;  // "number of Goblins you control"
}

export interface CounterProduction {
  type: string;    // "+1/+1", "charge", "loyalty"
  target: string;  // "self", "target creature", "each creature"
}

export interface DamageProfile {
  type: string | null;   // "each opponent", "target", "combat", "any target"
  scaling: string | null; // "number of Goblins", etc.
}

export interface CommanderProfile {
  name: string;

  // ── What does the commander need to function? ─────────────────────────────
  activationCosts: {
    tapsSelf: boolean;
    manaCost: string | null;
    sacrificeCost: string | null;
    otherCosts: string[];
  };

  // ── What does the commander produce? ──────────────────────────────────────
  produces: {
    tokens: TokenProduction | null;
    counters: CounterProduction | null;
    mana: boolean;
    cardDraw: boolean;
    damage: DamageProfile | null;
  };

  // ── What does the commander care about? ───────────────────────────────────
  scalingFactors: string[];   // ["Goblins you control", "creatures you control"]
  relevantTypes: string[];    // ["Goblin"] from type line + oracle
  relevantZones: string[];    // ["graveyard", "exile"]

  // ── Keywords the commander has or grants ──────────────────────────────────
  keywords: string[];

  // ── Derived synergy profile ───────────────────────────────────────────────
  wants: {
    untapEffects: boolean;
    hasteEnablers: boolean;
    tokenPayoffs: boolean;
    sacrificeOutlets: boolean;
    tribalPieces: string[];
    anthemEffects: boolean;
    etkTriggers: boolean;
    costReduction: boolean;
    selfMillOrDiscard: boolean;
    counterSynergy: boolean;
    topOfLibrary: boolean;
    damageAmplifiers: boolean;
    goWidePayoffs: boolean;
  };
}

// ────────────────────────────────────────────────────────────────────────────
// MTG Keywords
// ────────────────────────────────────────────────────────────────────────────

const MTG_KEYWORDS = [
  'deathtouch', 'defender', 'double strike', 'first strike', 'flash',
  'flying', 'haste', 'hexproof', 'indestructible', 'lifelink', 'menace',
  'reach', 'shroud', 'trample', 'vigilance', 'ward', 'wither',
  'infect', 'undying', 'persist', 'cascade', 'convoke', 'delve',
  'affinity', 'annihilator', 'prowess', 'exalted',
];

// ────────────────────────────────────────────────────────────────────────────
// Creature type extraction
// ────────────────────────────────────────────────────────────────────────────

const CREATURE_TYPES = [
  'Goblin', 'Zombie', 'Vampire', 'Elf', 'Merfolk', 'Soldier', 'Human',
  'Dragon', 'Angel', 'Demon', 'Spirit', 'Elemental', 'Beast', 'Knight',
  'Warrior', 'Wizard', 'Rogue', 'Cleric', 'Dinosaur', 'Cat', 'Dog',
  'Wolf', 'Bear', 'Bird', 'Snake', 'Spider', 'Insect', 'Rat', 'Squirrel',
  'Sliver', 'Pirate', 'Faerie', 'Dwarf', 'Giant', 'Treefolk', 'Fungus',
  'Saproling', 'Phyrexian', 'Horror', 'Nightmare', 'Shade', 'Skeleton',
  'Eldrazi', 'Artifact', 'Artificer', 'Shaman', 'Druid', 'Monk',
  'Samurai', 'Ninja', 'Ally', 'Thopter', 'Servo', 'Construct', 'Golem',
  'Minotaur', 'Hydra', 'Phoenix', 'Sphinx', 'Wurm', 'Troll', 'Ogre',
];

function extractCreatureTypes(typeLine: string, oracleText: string): string[] {
  const types: string[] = [];
  for (const ct of CREATURE_TYPES) {
    // Check type line (exact word boundary match)
    const typeRe = new RegExp(`\\b${ct}\\b`, 'i');
    if (typeRe.test(typeLine)) {
      types.push(ct);
    }
  }
  // Also extract types from oracle text that are referenced mechanically
  // "Goblin creature token", "whenever a Zombie", "other Elves", "each Vampire"
  for (const ct of CREATURE_TYPES) {
    if (types.includes(ct)) continue;
    const oracleRe = new RegExp(
      `(?:whenever (?:a|an) |other |each |all |number of |\\b)${ct}s?\\b`,
      'i',
    );
    if (oracleRe.test(oracleText)) {
      types.push(ct);
    }
  }
  return types;
}

// ────────────────────────────────────────────────────────────────────────────
// Token parsing
// ────────────────────────────────────────────────────────────────────────────

function parseTokenCreation(oracle: string): TokenProduction | null {
  const lower = oracle.toLowerCase();
  if (!lower.includes('create') || !lower.includes('token')) return null;

  const prod: TokenProduction = {
    creates: true,
    tokenTypes: [],
    tokenPT: null,
    tokenColors: [],
    scaling: null,
  };

  // Extract P/T: "1/1", "2/2", "X/X"
  const ptMatch = oracle.match(/(\d+\/\d+|X\/X)/);
  if (ptMatch) prod.tokenPT = ptMatch[1];

  // Extract colors
  const colorWords = ['white', 'blue', 'black', 'red', 'green', 'colorless'];
  for (const c of colorWords) {
    if (lower.includes(c) && lower.includes('token')) prod.tokenColors.push(c);
  }

  // Extract creature types from token creation text
  for (const ct of CREATURE_TYPES) {
    const re = new RegExp(`${ct.toLowerCase()}[^.]*?(?:creature )?tokens?`, 'i');
    if (re.test(lower)) prod.tokenTypes.push(ct);
  }

  // Check for scaling: "where X is", "equal to", "for each"
  const scalingMatch = oracle.match(
    /(?:where X is|equal to|for each)\s+(?:the\s+)?(?:number of\s+)?(.+?)(?:\.|,|$)/i,
  );
  if (scalingMatch) prod.scaling = scalingMatch[1].trim();

  return prod;
}

// ────────────────────────────────────────────────────────────────────────────
// Counter parsing
// ────────────────────────────────────────────────────────────────────────────

function parseCounterProduction(oracle: string): CounterProduction | null {
  const lower = oracle.toLowerCase();

  // +1/+1 counters
  if (lower.includes('+1/+1 counter')) {
    let target = 'self';
    if (lower.includes('target creature')) target = 'target creature';
    else if (lower.includes('each creature')) target = 'each creature';
    else if (lower.includes('creatures you control')) target = 'each creature you control';
    return { type: '+1/+1', target };
  }

  // Other counter types
  const counterMatch = oracle.match(
    /(?:put|place|add)\s+(?:a\s+)?(\w+)\s+counter/i,
  );
  if (counterMatch && counterMatch[1].toLowerCase() !== 'a') {
    return { type: counterMatch[1].toLowerCase(), target: 'self' };
  }

  if (lower.includes('proliferate')) {
    return { type: 'proliferate', target: 'each' };
  }

  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Damage parsing
// ────────────────────────────────────────────────────────────────────────────

function parseDamageProfile(oracle: string): DamageProfile | null {
  const lower = oracle.toLowerCase();
  if (!lower.includes('damage') && !lower.includes('deals')) return null;

  let type: string | null = null;
  if (lower.includes('combat damage')) type = 'combat';
  else if (lower.includes('to each opponent') || lower.includes('each opponent loses')) type = 'each opponent';
  else if (lower.includes('to any target') || lower.includes('any target')) type = 'any target';
  else if (lower.includes('to target')) type = 'target';
  else if (lower.includes('deals') && lower.includes('damage')) type = 'general';

  if (!type) return null;

  let scaling: string | null = null;
  const scalingMatch = oracle.match(
    /deals?\s+(?:damage\s+)?(?:equal to|where X is)\s+(?:the\s+)?(?:number of\s+)?(.+?)(?:\s+damage|\.|,|$)/i,
  );
  if (scalingMatch) scaling = scalingMatch[1].trim();

  return { type, scaling };
}

// ────────────────────────────────────────────────────────────────────────────
// Activation cost parsing
// ────────────────────────────────────────────────────────────────────────────

interface ActivationCosts {
  tapsSelf: boolean;
  manaCost: string | null;
  sacrificeCost: string | null;
  otherCosts: string[];
}

function parseActivationCosts(oracle: string): ActivationCosts {
  const result: ActivationCosts = {
    tapsSelf: false,
    manaCost: null,
    sacrificeCost: null,
    otherCosts: [],
  };

  // Find activated abilities: "{cost}: {effect}"
  // MTG uses colon to separate cost from effect in activated abilities
  const abilityMatches = oracle.match(/^(.+?):\s/gm) || [];

  for (const costPart of abilityMatches) {
    const cost = costPart.replace(/:\s*$/, '');

    // Check for tap symbol
    if (cost.includes('{T}')) result.tapsSelf = true;

    // Check for mana in cost
    const manaMatch = cost.match(/\{[WUBRGCX\d]+\}/g);
    if (manaMatch && !result.manaCost) {
      result.manaCost = manaMatch.join('');
    }

    // Check for sacrifice cost
    const sacMatch = cost.match(/[Ss]acrifice\s+(?:a|an)\s+(\w+)/);
    if (sacMatch) result.sacrificeCost = sacMatch[1].toLowerCase();

    // Other costs
    if (cost.toLowerCase().includes('discard')) result.otherCosts.push('discard');
    if (cost.toLowerCase().includes('pay') && cost.toLowerCase().includes('life')) result.otherCosts.push('pay life');
    if (cost.toLowerCase().includes('remove') && cost.toLowerCase().includes('counter')) result.otherCosts.push('remove counter');
    if (cost.toLowerCase().includes('exile')) result.otherCosts.push('exile');
  }

  return result;
}

// ────────────────────────────────────────────────────────────────────────────
// Scaling factor extraction
// ────────────────────────────────────────────────────────────────────────────

function extractScalingFactors(oracle: string): string[] {
  const factors: string[] = [];
  const lower = oracle.toLowerCase();

  // "for each X"
  const forEachMatches = lower.matchAll(/for each\s+(.+?)(?:\.|,|$)/gi);
  for (const m of forEachMatches) factors.push(m[1].trim());

  // "equal to the number of X"
  const numMatches = lower.matchAll(/(?:equal to|where X is)\s+(?:the\s+)?(?:number of\s+)?(.+?)(?:\.|,|$)/gi);
  for (const m of numMatches) factors.push(m[1].trim());

  return [...new Set(factors)];
}

// ────────────────────────────────────────────────────────────────────────────
// Zone references
// ────────────────────────────────────────────────────────────────────────────

function extractZoneReferences(oracle: string): string[] {
  const zones: string[] = [];
  const lower = oracle.toLowerCase();
  if (lower.includes('graveyard')) zones.push('graveyard');
  if (lower.includes('exile') || lower.includes('exiled')) zones.push('exile');
  if (lower.includes('top of your library') || lower.includes('top of their library')) zones.push('top of library');
  if (lower.includes('command zone')) zones.push('command zone');
  return zones;
}

// ────────────────────────────────────────────────────────────────────────────
// Keyword extraction
// ────────────────────────────────────────────────────────────────────────────

function extractKeywords(oracle: string): string[] {
  const lower = oracle.toLowerCase();
  return MTG_KEYWORDS.filter(kw => {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    return re.test(lower);
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Main parser
// ────────────────────────────────────────────────────────────────────────────

export function parseCommanderMechanics(
  oracleText: string,
  typeLine: string,
  name: string,
): CommanderProfile {
  const oracle = oracleText || '';
  const lower = oracle.toLowerCase();

  const activationCosts = parseActivationCosts(oracle);
  const tokens = parseTokenCreation(oracle);
  const counters = parseCounterProduction(oracle);
  const damage = parseDamageProfile(oracle);
  const relevantTypes = extractCreatureTypes(typeLine, oracle);
  const scalingFactors = extractScalingFactors(oracle);
  const relevantZones = extractZoneReferences(oracle);
  const keywords = extractKeywords(oracle);

  const producesMana =
    lower.includes('add {') ||
    lower.includes('add one mana') ||
    (lower.includes('treasure') && lower.includes('token'));

  const producesCardDraw =
    lower.includes('draw a card') ||
    lower.includes('draw cards') ||
    (lower.includes('exile') && lower.includes('may play'));

  // ── Derive wants ──────────────────────────────────────────────────────────
  const wants = {
    untapEffects: activationCosts.tapsSelf,
    hasteEnablers: activationCosts.tapsSelf,
    tokenPayoffs: tokens !== null && tokens.creates,
    sacrificeOutlets: tokens !== null && tokens.creates, // expendable tokens = sac fodder
    tribalPieces: relevantTypes,
    anthemEffects: tokens !== null && tokens.creates,
    etkTriggers: tokens !== null && tokens.creates,
    costReduction: activationCosts.manaCost !== null,
    selfMillOrDiscard:
      relevantZones.includes('graveyard') ||
      activationCosts.otherCosts.includes('discard'),
    counterSynergy: counters !== null,
    topOfLibrary: relevantZones.includes('top of library'),
    damageAmplifiers:
      damage !== null && damage.type !== 'combat',
    goWidePayoffs: tokens !== null && tokens.creates,
  };

  return {
    name,
    activationCosts,
    produces: {
      tokens,
      counters,
      mana: producesMana,
      cardDraw: producesCardDraw,
      damage,
    },
    scalingFactors,
    relevantTypes,
    relevantZones,
    keywords,
    wants,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Human-readable summary (for the UI)
// ────────────────────────────────────────────────────────────────────────────

export function summarizeProfile(profile: CommanderProfile): {
  wantsDescription: string[];
  producesDescription: string[];
  activationDescription: string;
} {
  const wantsDesc: string[] = [];
  const w = profile.wants;

  if (w.untapEffects) wantsDesc.push('Untap effects');
  if (w.hasteEnablers) wantsDesc.push('Haste enablers');
  if (w.tokenPayoffs) wantsDesc.push('Token payoffs');
  if (w.sacrificeOutlets) wantsDesc.push('Sacrifice outlets');
  if (w.tribalPieces.length > 0) wantsDesc.push(`${w.tribalPieces.join('/')} creatures`);
  if (w.anthemEffects) wantsDesc.push('Anthem effects');
  if (w.etkTriggers) wantsDesc.push('ETB payoffs');
  if (w.costReduction) wantsDesc.push('Cost reduction');
  if (w.selfMillOrDiscard) wantsDesc.push('Self-mill / discard');
  if (w.counterSynergy) wantsDesc.push('Counter synergy');
  if (w.topOfLibrary) wantsDesc.push('Top-of-library manipulation');
  if (w.damageAmplifiers) wantsDesc.push('Damage amplifiers');
  if (w.goWidePayoffs) wantsDesc.push('Go-wide payoffs');

  const producesDesc: string[] = [];
  const p = profile.produces;
  if (p.tokens) {
    const parts: string[] = [];
    if (p.tokens.tokenPT) parts.push(p.tokens.tokenPT);
    if (p.tokens.tokenColors.length > 0) parts.push(p.tokens.tokenColors.join('/'));
    if (p.tokens.tokenTypes.length > 0) parts.push(p.tokens.tokenTypes.join('/'));
    parts.push('creature tokens');
    if (p.tokens.scaling) parts.push(`(scaling: ${p.tokens.scaling})`);
    producesDesc.push(parts.join(' '));
  }
  if (p.counters) {
    producesDesc.push(`${p.counters.type} counters on ${p.counters.target}`);
  }
  if (p.mana) producesDesc.push('Mana');
  if (p.cardDraw) producesDesc.push('Card draw');
  if (p.damage) {
    const d = p.damage;
    let desc = `Damage to ${d.type || 'targets'}`;
    if (d.scaling) desc += ` (scales with ${d.scaling})`;
    producesDesc.push(desc);
  }

  let activationDesc = '';
  const ac = profile.activationCosts;
  const costParts: string[] = [];
  if (ac.tapsSelf) costParts.push('Tap');
  if (ac.manaCost) costParts.push(ac.manaCost);
  if (ac.sacrificeCost) costParts.push(`Sacrifice a ${ac.sacrificeCost}`);
  if (ac.otherCosts.length > 0) costParts.push(ac.otherCosts.join(', '));
  if (costParts.length > 0) {
    activationDesc = costParts.join(' + ');
    if (ac.tapsSelf) activationDesc += ' — benefits from untap and haste';
  } else {
    activationDesc = 'No activation cost (passive / triggered)';
  }

  return {
    wantsDescription: wantsDesc,
    producesDescription: producesDesc,
    activationDescription: activationDesc,
  };
}

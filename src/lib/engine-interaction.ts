/**
 * Commander Engine Interaction Scoring
 *
 * Every commander has an "engine" — a set of things it PRODUCES and things it NEEDS.
 * Cards that plug into that engine (triggering off production, enabling needs, amplifying output)
 * should score higher. Cards that reference mechanics the commander never uses should be penalized.
 *
 * This is intentionally commander-agnostic: we infer the engine solely from oracle text,
 * so it works for any legendary creature without hard-coded card names.
 */

// ────────────────────────────────────────────────────────────────────────────
// Traits
// ────────────────────────────────────────────────────────────────────────────

export interface CommanderEngineTraits {
  // ── Production ─────────────────────────────────────────────────────────────
  produces_tokens: boolean;
  produces_token_subtype: string | null;  // e.g. 'goblin', 'soldier', 'zombie'
  produces_counters: boolean;             // +1/+1 or other counters placed by commander
  produces_treasure: boolean;
  produces_clues: boolean;
  produces_food: boolean;
  produces_energy: boolean;
  // ── Needs / Costs ──────────────────────────────────────────────────────────
  needs_tap: boolean;                     // commander has a tap-cost or tap-activated ability
  needs_sacrifice: boolean;              // commander asks you to sacrifice permanents
  needs_spells_cast: boolean;            // commander triggers/cares about casting spells
  needs_attack: boolean;                 // commander triggers/cares about attacking
  needs_discard: boolean;                // commander rewards or requires discarding
  needs_life_payment: boolean;           // commander pays life
  // ── Damage Profile ─────────────────────────────────────────────────────────
  deals_noncombat_damage: boolean;       // commander directly pings/deals damage outside combat
  deals_combat_damage: boolean;          // commander has "whenever deals combat damage"
  // ── Other Engine Behaviors ─────────────────────────────────────────────────
  mills: boolean;                        // commander mills / puts cards from library to graveyard
  loots: boolean;                        // commander draws then discards (loot/rummage)
  reanimates: boolean;                   // commander returns cards from graveyard to battlefield
  blinks: boolean;                       // commander exiles then returns permanents
  gains_life: boolean;                   // commander has lifelink or gains life
  fills_graveyard: boolean;              // commander sends things to graveyard intentionally
}

// ────────────────────────────────────────────────────────────────────────────
// Token subtype extraction
// ────────────────────────────────────────────────────────────────────────────

const KNOWN_TOKEN_SUBTYPES = [
  'goblin','soldier','zombie','spirit','saproling','insect','bird','snake','cat',
  'wolf','vampire','merfolk','human','elf','dragon','angel','demon','sliver',
  'horror','beast','dinosaur','knight','warrior','rogue','wizard','cleric',
  'rat','squirrel','bear','boar','faerie','elemental','phyrexian','servo',
  'thopter','golem','construct','treasure','clue','food','blood','shard',
  'spawn','eldrazi','tentacle','copy','treasure','treasure','treasure',
];

function extractTokenSubtype(text: string): string | null {
  for (const sub of KNOWN_TOKEN_SUBTYPES) {
    // "create a X token" / "creates X/X Y tokens" — avoid partial matches like 'cat' in 'scatter'
    const re = new RegExp(`(?:create[s]?|put[s]?) (?:a |an |one |two |three |\\d+ )*(?:[^.]+? )?\\b${sub}\\b[^.]*?token`, 'i');
    if (re.test(text)) return sub;
    // also "X/X [subtype] creature token"
    const re2 = new RegExp(`\\b${sub}\\b[^.]*?creature token`, 'i');
    if (re2.test(text)) return sub;
  }
  return null;
}

// ────────────────────────────────────────────────────────────────────────────
// Commander engine extraction
// ────────────────────────────────────────────────────────────────────────────

export function extractCommanderEngine(
  oracleText: string,
  _typeLine: string = '',
): CommanderEngineTraits {
  const t = oracleText.toLowerCase();

  const createsTokens =
    t.includes('create') && t.includes('token') ||
    t.includes('put') && t.includes('token') && t.includes('onto the battlefield');

  const tokenSubtype = createsTokens ? extractTokenSubtype(t) : null;

  return {
    // Production
    produces_tokens: createsTokens,
    produces_token_subtype: tokenSubtype,
    produces_counters:
      t.includes('+1/+1 counter') ||
      t.includes('put') && t.includes('counter') ||
      t.includes('proliferate'),
    produces_treasure:
      t.includes('treasure token') || t.includes('create a treasure'),
    produces_clues:
      t.includes('clue token') || t.includes('investigate'),
    produces_food:
      t.includes('food token') || t.includes('create a food'),
    produces_energy:
      t.includes('{e}') || t.includes('energy counter'),
    // Needs / Costs
    needs_tap:
      (t.includes('{t}') && t.includes(':')) ||
      t.includes('tap target') ||
      t.includes('tap all') ||
      t.includes('tap each') ||
      t.includes('whenever ~ becomes tapped') ||
      (t.includes('tap') && t.includes('additional cost')),
    needs_sacrifice:
      t.includes('sacrifice') && (
        t.includes('as an additional cost') ||
        t.includes('sacrifice a ') ||
        t.includes('sacrifice another') ||
        t.includes('sacrifice up to')
      ),
    needs_spells_cast:
      t.includes('whenever you cast') ||
      t.includes('whenever a spell') ||
      t.includes('whenever a player casts'),
    needs_attack:
      (t.includes('whenever ~ attacks') ||
      t.includes('whenever this creature attacks') ||
      t.includes('at the beginning of combat') ||
      t.includes('when ~ attacks')) &&
      !t.includes('prevent all combat damage'),
    needs_discard:
      t.includes('discard') && (
        t.includes('you may discard') ||
        t.includes('whenever you discard') ||
        t.includes('discard a card: ')
      ),
    needs_life_payment:
      (t.includes('pay') && t.includes('life')) ||
      t.includes('as an additional cost') && t.includes('life'),
    // Damage profile
    deals_noncombat_damage:
      (t.includes('deals') || t.includes('deal')) &&
      t.includes('damage') &&
      !t.includes('combat damage') &&
      (t.includes('target') || t.includes('each opponent') || t.includes('any target')),
    deals_combat_damage:
      t.includes('whenever') && t.includes('deals combat damage'),
    // Other behaviors
    mills:
      t.includes('mill ') || t.includes('mills ') ||
      (t.includes('put') && t.includes('into their graveyard') && t.includes('library')),
    loots:
      t.includes('draw') && t.includes('discard') &&
      (t.includes('then discard') || t.includes('discard a card')),
    reanimates:
      t.includes('return') && t.includes('graveyard') &&
      t.includes('onto the battlefield'),
    blinks:
      t.includes('exile') &&
      (t.includes('return it to the battlefield') || t.includes('return that card to the battlefield')),
    gains_life:
      t.includes('lifelink') ||
      t.includes('you gain') && t.includes('life') ||
      t.includes('gain ') && t.includes('life'),
    fills_graveyard:
      t.includes('from your graveyard') ||
      t.includes('mill') ||
      (t.includes('discard') && t.includes('your graveyard')) ||
      t.includes('from libraries to their owners') ||
      t.includes('dredge'),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Candidate scoring
// ────────────────────────────────────────────────────────────────────────────

export interface EngineInteractionResult {
  bonus: number;
  reasons: string[];
}

export function scoreEngineInteraction(
  traits: CommanderEngineTraits,
  candidateOracle: string,
  candidateTypes: string,
): EngineInteractionResult {
  const t = candidateOracle.toLowerCase();
  const ty = candidateTypes.toLowerCase();
  let bonus = 0;
  const reasons: string[] = [];

  // ── Token production synergies ────────────────────────────────────────────
  if (traits.produces_tokens) {
    // Anthem effects for tokens
    if (
      (t.includes('token') && t.includes('get +')) ||
      (t.includes('tokens you control') && (t.includes('+') || t.includes('trample') || t.includes('haste') || t.includes('flying'))) ||
      (t.includes('creature tokens') && t.includes('get +')) ||
      (t.includes('tokens you control') && t.includes('get +'))) {
      bonus += 22;
      reasons.push('+22 token anthem (commander creates tokens)');
    }
    // ETB/death triggers when commander creates tokens (lots of creatures entering/dying)
    if (
      t.includes('whenever a creature enters') ||
      t.includes('whenever one or more creatures enter') ||
      (t.includes('whenever a token') && (t.includes('enters') || t.includes('created'))) ||
      (t.includes('whenever another creature') && (t.includes('enters') || t.includes('dies')))) {
      bonus += 18;
      reasons.push('+18 creature-ETB/death trigger (commander floods board with tokens)');
    }
    // Sac outlets that consume tokens
    if (
      (ty.includes('creature') || ty.includes('artifact') || ty.includes('enchantment')) &&
      (t.includes('sacrifice a creature') || t.includes('sacrifice another creature') ||
       t.includes('sacrifice any number') || t.includes('sacrifice up to'))) {
      bonus += 15;
      reasons.push('+15 sac outlet (converts commander tokens into value)');
    }
    // Specific subtype synergies
    if (traits.produces_token_subtype) {
      const sub = traits.produces_token_subtype;
      // "other Goblins you control", "Goblin creatures you control", etc.
      const subRe = new RegExp(`\\b${sub}s?\\b.{0,40}(you control|lord|creature)`, 'i');
      const subRe2 = new RegExp(`(other|each|all).{0,20}\\b${sub}s?\\b`, 'i');
      if (subRe.test(t) || subRe2.test(t)) {
        bonus += 20;
        reasons.push(`+20 ${sub} tribal synergy (commander produces ${sub} tokens)`);
      }
    }
    // Wide-board payoffs
    if (
      t.includes('for each creature you control') ||
      t.includes('equal to the number of creatures') ||
      t.includes('creatures you control deal') ||
      t.includes('for each token') ||
      (t.includes('populate') )) {
      bonus += 15;
      reasons.push('+15 go-wide payoff (commander produces many tokens)');
    }
  }

  // ── Counter synergies ─────────────────────────────────────────────────────
  if (traits.produces_counters) {
    if (
      t.includes('proliferate') ||
      t.includes('add a counter') ||
      t.includes('for each counter') ||
      (t.includes('counter') && t.includes('for each +1/+1')) ||
      t.includes('evolve') ||
      t.includes('adapt')) {
      bonus += 18;
      reasons.push('+18 counter synergy (commander distributes +1/+1 counters)');
    }
  }

  // ── Treasure synergies ────────────────────────────────────────────────────
  if (traits.produces_treasure) {
    if (
      t.includes('for each treasure') ||
      (t.includes('sacrifice') && t.includes('treasure')) ||
      t.includes('treasures you control') ||
      t.includes('artifact token') && t.includes('enter')) {
      bonus += 15;
      reasons.push('+15 treasure synergy');
    }
  }

  // ── Tap-ability synergies ─────────────────────────────────────────────────
  if (traits.needs_tap) {
    if (
      t.includes('untap') && (t.includes('target creature') || t.includes('each creature')) ||
      t.includes('for each tapped') ||
      t.includes('whenever a creature becomes tapped') ||
      t.includes('tap: add') ||
      (t.includes('untap') && t.includes('at the beginning of'))) {
      bonus += 15;
      reasons.push('+15 untap/tap enabler (commander uses tap abilities)');
    }
  }

  // ── Sacrifice synergies ───────────────────────────────────────────────────
  if (traits.needs_sacrifice) {
    if (
      t.includes('when this creature dies') ||
      t.includes('whenever a creature dies') ||
      t.includes('whenever another creature dies') ||
      t.includes('death trigger') ||
      t.includes('after ~ dies') ||
      (t.includes('dies') && t.includes('draw')) ||
      (t.includes('dies') && t.includes('return'))) {
      bonus += 15;
      reasons.push('+15 death/dies synergy (commander sacrifices creatures)');
    }
  }

  // ── Attack synergies ──────────────────────────────────────────────────────
  if (traits.needs_attack) {
    if (
      t.includes('menace') ||
      t.includes('trample') ||
      t.includes('haste') ||
      t.includes('whenever ~ attacks') ||
      t.includes('whenever this creature attacks') ||
      t.includes('goad') ||
      t.includes('inspired') ||
      t.includes('exert') ||
      t.includes('when ~ deals combat damage') ||
      (t.includes('attack') && t.includes('trigger'))) {
      bonus += 12;
      reasons.push('+12 attack enabler (commander triggers on attack)');
    }
  }

  // ── Spell-cast synergies ───────────────────────────────────────────────────
  if (traits.needs_spells_cast) {
    if (
      t.includes('whenever you cast') ||
      t.includes('magecraft') ||
      t.includes('whenever a spell') ||
      t.includes('whenever you cast a noncreature') ||
      t.includes('storm')) {
      bonus += 15;
      reasons.push('+15 spell-cast trigger (commander cares about casting spells)');
    }
  }

  // ── Noncombat damage synergies ────────────────────────────────────────────
  if (traits.deals_noncombat_damage) {
    if (
      t.includes('damage dealt by sources you control') ||
      t.includes('if a source you control would deal') ||
      t.includes('damage triggers') ||
      (t.includes('damage') && t.includes('twice') && t.includes('source')) ||
      t.includes('whenever a source you control deals damage') ||
      t.includes('each opponent loses') && t.includes('for each')) {
      bonus += 22;
      reasons.push('+22 damage amplifier (commander pings/deals noncombat damage)');
    }
  }

  // ── Loot/discard synergies ─────────────────────────────────────────────────
  if (traits.loots || traits.needs_discard) {
    if (
      t.includes('whenever you discard') ||
      t.includes('madness') ||
      t.includes('hellbent') ||
      t.includes('when you have no cards in hand') ||
      (t.includes('flashback') && t.includes('discard'))) {
      bonus += 15;
      reasons.push('+15 discard/loot synergy (commander loots/discards)');
    }
  }

  // ── Graveyard synergies ───────────────────────────────────────────────────
  if (traits.fills_graveyard || traits.mills) {
    if (
      t.includes('from your graveyard') ||
      t.includes('return target') && t.includes('graveyard') ||
      t.includes('from a graveyard') ||
      t.includes('dredge') ||
      t.includes('threshold') ||
      t.includes('delirium') ||
      t.includes('escape') ||
      t.includes('flashback') ||
      t.includes('unearth')) {
      bonus += 15;
      reasons.push('+15 graveyard synergy (commander fills graveyard)');
    }
  }

  // ── Lifelink / life-gain synergies ────────────────────────────────────────
  if (traits.gains_life) {
    if (
      t.includes('whenever you gain life') ||
      t.includes('for each life you gained') ||
      t.includes('lifelink') ||
      t.includes('soul sisters') ||
      (t.includes('gain life') && t.includes('draw'))) {
      bonus += 12;
      reasons.push('+12 life-gain synergy (commander has lifelink/gains life)');
    }
  }

  // ── Reanimate synergies ───────────────────────────────────────────────────
  if (traits.reanimates) {
    if (
      (t.includes('dies') && t.includes('return')) ||
      t.includes('return target') && t.includes('graveyard') && t.includes('battlefield') ||
      t.includes('when ~ dies') ||
      t.includes('undying') ||
      t.includes('persist') ||
      t.includes('eternalize') ||
      t.includes('encore')) {
      bonus += 15;
      reasons.push('+15 reanimate synergy (commander reanimates)');
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Anti-patterns — card references mechanics the commander never uses
  // ────────────────────────────────────────────────────────────────────────────

  // Whenever you gain life → useless if commander never gains life
  if (
    !traits.gains_life &&
    (t.includes('whenever you gain life') || t.includes('for each life you gained'))
  ) {
    bonus -= 10;
    reasons.push('-10 life-gain trigger (commander does not gain life)');
  }

  // Whenever you draw a card → useless if commander doesn't draw
  const commanderDraws = false; // commanders with draw abilities are rare and hard to detect generically
  if (
    !commanderDraws &&
    !traits.loots &&
    t.includes('whenever you draw a card') &&
    !t.includes('draw a card') // exclude cards that draw AND have the trigger (e.g. Brainstorm with Teferi)
  ) {
    bonus -= 8;
    reasons.push('-8 draw-trigger (commander does not draw cards)');
  }

  // Whenever ~ deals combat damage → useless if commander doesn't attack or deal combat damage
  if (
    !traits.deals_combat_damage &&
    !traits.needs_attack &&
    t.includes('whenever') && t.includes('deals combat damage')
  ) {
    bonus -= 8;
    reasons.push('-8 combat-damage trigger (commander does not deal combat damage)');
  }

  // Noncombat damage rider → useless if commander doesn't ping
  if (
    !traits.deals_noncombat_damage &&
    (t.includes('if a source you control would deal') ||
     t.includes('whenever a source you control deals noncombat damage') ||
     t.includes('damage dealt by sources you control') && !t.includes('combat damage'))
  ) {
    bonus -= 10;
    reasons.push('-10 damage-amplifier (commander does not deal noncombat damage)');
  }

  // Graveyard recursion → useless if commander doesn't fill graveyard
  if (
    !traits.fills_graveyard && !traits.mills && !traits.reanimates &&
    (t.includes('delirium') || t.includes('threshold') ||
     (t.includes('return target') && t.includes('from your graveyard')))
  ) {
    bonus -= 5;
    reasons.push('-5 graveyard synergy (commander does not fill graveyard)');
  }

  return { bonus, reasons };
}

import { ScryfallCard } from './types';

/**
 * Commander Profile System
 * Extracts mechanics, archetypes, and optimization hints from commander cards
 */

export interface CommanderProfile {
  // Core identity
  name: string;
  colorIdentity: string[];
  cmc: number;
  
  // Mechanical tags (what this commander enables/cares about)
  tags: CommanderTag[];
  
  // Archetype classification
  primaryArchetype: Archetype;
  secondaryArchetypes: Archetype[];
  
  // Package recommendations (starter synergy bundles)
  packages: PackageSeed[];
  
  // Optimization hints
  curveHints: CurveHints;
  planHints: PlanHints;
}

export interface CommanderTag {
  name: string;           // "tokens", "landfall", "spellslinger", etc.
  confidence: number;     // 0-1, how certain we are this tag applies
  context: string;        // Oracle text that triggered this tag
  priority: number;       // 1-10, how central this is to the commander
}

export type Archetype = 
  | 'aggro' | 'midrange' | 'control' | 'combo'
  | 'tribal' | 'tokens' | 'voltron' | 'aristocrats' 
  | 'spellslinger' | 'artifacts' | 'enchantments'
  | 'landfall' | 'reanimator' | 'blink' | 'counters'
  | 'sacrifice' | 'ramp' | 'storm' | 'stax';

export interface PackageSeed {
  name: string;           // "Token Engine", "Landfall Package", etc.
  cards: string[];        // Specific card names that synergize
  priority: number;       // 1-10, how important this package is
  budgetTier: 'budget' | 'mid' | 'high'; // Budget considerations
}

export interface CurveHints {
  preferredAvgMv: number;     // Ideal average mana value for this commander
  earlyGamePriority: number;  // 1-10, how much to prioritize 1-2 MV cards
  lateGameTolerance: number;  // 1-10, how much 6+ MV is acceptable
  multiSpellTurns: boolean;   // Does this deck want to cast multiple spells per turn?
}

export interface PlanHints {
  rampPriority: number;       // 1-10, how much ramp this deck needs
  drawPriority: number;       // 1-10, how much card draw this deck needs  
  protectionPriority: number; // 1-10, how much protection this deck needs
  interactionPriority: number; // 1-10, how much removal this deck needs
  winconFocus: 'wide' | 'tall' | 'combo' | 'value'; // Primary win condition style
}

export class CommanderProfiler {
  
  /**
   * Generate a comprehensive profile for a commander
   */
  profile(commander: ScryfallCard): CommanderProfile {
    const tags = this.extractTags(commander);
    const archetypes = this.classifyArchetypes(commander, tags);
    const packages = this.generatePackages(commander, tags, archetypes);
    const curveHints = this.calculateCurveHints(commander, tags, archetypes);
    const planHints = this.calculatePlanHints(commander, tags, archetypes);

    return {
      name: commander.name,
      colorIdentity: commander.color_identity,
      cmc: commander.cmc,
      tags,
      primaryArchetype: archetypes[0] || 'midrange',
      secondaryArchetypes: archetypes.slice(1),
      packages,
      curveHints,
      planHints
    };
  }

  /**
   * Extract mechanical tags from commander's oracle text and type line
   */
  private extractTags(commander: ScryfallCard): CommanderTag[] {
    const text = (commander.oracle_text || '').toLowerCase();
    const typeLine = commander.type_line.toLowerCase();
    const tags: CommanderTag[] = [];

    // Resource/Object patterns
    const resourcePatterns = [
      { name: 'tokens', patterns: ['create.*token', 'token.*creature'], priority: 8 },
      { name: 'treasures', patterns: ['treasure', 'create.*treasure'], priority: 7 },
      { name: 'clues', patterns: ['investigate', 'clue'], priority: 6 },
      { name: 'food', patterns: ['food', 'create.*food'], priority: 6 },
      { name: 'counters', patterns: ['\\+1/\\+1 counter', 'counter.*creature'], priority: 7 },
      { name: 'energy', patterns: ['energy counter', 'get.*energy'], priority: 6 },
      { name: 'experience', patterns: ['experience counter'], priority: 8 },
      { name: 'landfall', patterns: ['landfall', 'land.*enters.*battlefield'], priority: 8 },
      { name: 'proliferate', patterns: ['proliferate'], priority: 7 },
      { name: 'surveil', patterns: ['surveil'], priority: 6 },
      { name: 'connive', patterns: ['connive'], priority: 6 }
    ];

    // Timing hook patterns
    const timingPatterns = [
      { name: 'etb', patterns: ['enters the battlefield', 'when.*enters'], priority: 6 },
      { name: 'attack_triggers', patterns: ['whenever.*attacks', 'combat damage'], priority: 7 },
      { name: 'cast_triggers', patterns: ['whenever you cast', 'when you cast'], priority: 7 },
      { name: 'spellslinger', patterns: ['instant.*sorcery', 'noncreature spell'], priority: 8 },
      { name: 'blink', patterns: ['exile.*return', 'flicker', 'blink'], priority: 7 },
      { name: 'reanimator', patterns: ['return.*graveyard.*battlefield', 'reanimate'], priority: 8 },
      { name: 'sacrifice', patterns: ['sacrifice.*creature', 'aristocrats'], priority: 7 },
      { name: 'activated_abilities', patterns: ['\\{.*\\}:', 'tap.*:'], priority: 5 }
    ];

    // Tribal patterns
    const tribalTypes = this.extractCreatureTypes(typeLine);
    tribalTypes.forEach(tribe => {
      if (text.includes(tribe) || text.includes('creature you control')) {
        tags.push({
          name: `${tribe}_tribal`,
          confidence: text.includes(tribe) ? 0.9 : 0.7,
          context: `${tribe} tribal synergies`,
          priority: 8
        });
      }
    });

    // Cost/Cheat patterns
    const costPatterns = [
      { name: 'cost_reduction', patterns: ['cost.*less', 'spells cost'], priority: 6 },
      { name: 'alternative_cost', patterns: ['without paying', 'may cast.*without'], priority: 7 },
      { name: 'cheat_into_play', patterns: ['put.*battlefield', 'may play.*from'], priority: 7 }
    ];

    // Process all pattern groups
    [resourcePatterns, timingPatterns, costPatterns].flat().forEach(({ name, patterns, priority }) => {
      patterns.forEach(pattern => {
        const regex = new RegExp(pattern, 'i');
        const match = regex.exec(text);
        if (match) {
          tags.push({
            name,
            confidence: 0.8 + (match[0].length / text.length) * 0.2, // Longer matches = higher confidence
            context: match[0],
            priority
          });
        }
      });
    });

    // Deduplicate and sort by priority
    const uniqueTags = new Map<string, CommanderTag>();
    tags.forEach(tag => {
      const existing = uniqueTags.get(tag.name);
      if (!existing || tag.confidence > existing.confidence) {
        uniqueTags.set(tag.name, tag);
      }
    });

    return Array.from(uniqueTags.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Classify commander into primary and secondary archetypes
   */
  private classifyArchetypes(commander: ScryfallCard, tags: CommanderTag[]): Archetype[] {
    const archetypes: { type: Archetype, score: number }[] = [];
    
    // Score each archetype based on tags and commander properties
    const tagNames = tags.map(t => t.name);
    const text = (commander.oracle_text || '').toLowerCase();
    
    // Tribal scoring
    if (tagNames.some(t => t.includes('_tribal'))) {
      archetypes.push({ type: 'tribal', score: 8 });
    }
    
    // Token scoring
    if (tagNames.includes('tokens')) {
      archetypes.push({ type: 'tokens', score: 7 });
    }
    
    // Spellslinger scoring
    if (tagNames.includes('spellslinger') || text.includes('instant') || text.includes('sorcery')) {
      archetypes.push({ type: 'spellslinger', score: 6 });
    }
    
    // Artifact/Enchantment matters
    if (text.includes('artifact')) {
      archetypes.push({ type: 'artifacts', score: 5 });
    }
    if (text.includes('enchantment')) {
      archetypes.push({ type: 'enchantments', score: 5 });
    }
    
    // Landfall
    if (tagNames.includes('landfall')) {
      archetypes.push({ type: 'landfall', score: 7 });
    }
    
    // Aristocrats/Sacrifice
    if (tagNames.includes('sacrifice') || text.includes('sacrifice')) {
      archetypes.push({ type: 'aristocrats', score: 7 });
    }
    
    // Blink/ETB
    if (tagNames.includes('blink') || tagNames.includes('etb')) {
      archetypes.push({ type: 'blink', score: 6 });
    }
    
    // Counters
    if (tagNames.includes('counters')) {
      archetypes.push({ type: 'counters', score: 6 });
    }
    
    // Reanimator
    if (tagNames.includes('reanimator')) {
      archetypes.push({ type: 'reanimator', score: 7 });
    }
    
    // Voltron (single creature focus)
    if (commander.type_line.includes('Legendary Creature') && 
        (text.includes('equip') || text.includes('aura') || text.includes('gets +') || commander.cmc >= 4)) {
      archetypes.push({ type: 'voltron', score: 4 });
    }
    
    // Control vs Aggro based on CMC and abilities
    if (commander.cmc >= 5 || text.includes('control') || text.includes('counter')) {
      archetypes.push({ type: 'control', score: 3 });
    } else if (commander.cmc <= 3 && (text.includes('haste') || text.includes('attack'))) {
      archetypes.push({ type: 'aggro', score: 5 });
    } else {
      archetypes.push({ type: 'midrange', score: 4 });
    }
    
    // Sort by score and return top archetypes
    return archetypes
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(a => a.type);
  }

  /**
   * Generate package recommendations based on commander profile
   */
  private generatePackages(commander: ScryfallCard, tags: CommanderTag[], archetypes: Archetype[]): PackageSeed[] {
    const packages: PackageSeed[] = [];
    const tagNames = tags.map(t => t.name);
    
    // Token packages
    if (tagNames.includes('tokens')) {
      packages.push({
        name: 'Token Engines',
        cards: ['Skullclamp', 'Parallel Lives', 'Anointed Procession', 'Doubling Season'],
        priority: 8,
        budgetTier: 'mid'
      });
    }
    
    // Landfall packages
    if (tagNames.includes('landfall')) {
      packages.push({
        name: 'Landfall Package',
        cards: ['Fetchlands', 'Lotus Cobra', 'Azusa Lost but Seeking', 'Oracle of Mul Daya'],
        priority: 8,
        budgetTier: 'high'
      });
    }
    
    // Spellslinger packages
    if (tagNames.includes('spellslinger')) {
      packages.push({
        name: 'Spellslinger Engine',
        cards: ['Talrand Sky Summoner', 'Young Pyromancer', 'Guttersnipe', 'Storm-Kiln Artist'],
        priority: 7,
        budgetTier: 'budget'
      });
    }
    
    // Artifact packages
    if (archetypes.includes('artifacts')) {
      packages.push({
        name: 'Artifact Synergy',
        cards: ['Urza Lord High Artificer', 'Sai Master Thopterist', 'Cranial Plating', 'Affinity creatures'],
        priority: 7,
        budgetTier: 'mid'
      });
    }
    
    return packages;
  }

  /**
   * Calculate curve optimization hints
   */
  private calculateCurveHints(commander: ScryfallCard, tags: CommanderTag[], archetypes: Archetype[]): CurveHints {
    let preferredAvgMv = 3.0; // Base
    let earlyGamePriority = 5;
    let lateGameTolerance = 5;
    let multiSpellTurns = false;
    
    // Adjust based on commander CMC
    if (commander.cmc <= 2) {
      preferredAvgMv -= 0.3;
      earlyGamePriority += 2;
    } else if (commander.cmc >= 5) {
      preferredAvgMv += 0.2;
      lateGameTolerance += 1;
    }
    
    // Adjust based on archetypes
    if (archetypes.includes('aggro')) {
      preferredAvgMv -= 0.5;
      earlyGamePriority += 3;
      lateGameTolerance -= 2;
    } else if (archetypes.includes('control')) {
      preferredAvgMv += 0.3;
      earlyGamePriority -= 1;
      lateGameTolerance += 2;
    }
    
    // Spellslinger wants multiple spells per turn
    if (archetypes.includes('spellslinger')) {
      multiSpellTurns = true;
      preferredAvgMv -= 0.2;
    }
    
    return {
      preferredAvgMv: Math.max(2.0, Math.min(4.0, preferredAvgMv)),
      earlyGamePriority: Math.max(1, Math.min(10, earlyGamePriority)),
      lateGameTolerance: Math.max(1, Math.min(10, lateGameTolerance)),
      multiSpellTurns
    };
  }

  /**
   * Calculate deck plan optimization hints
   */
  private calculatePlanHints(commander: ScryfallCard, tags: CommanderTag[], archetypes: Archetype[]): PlanHints {
    let rampPriority = 6;      // Base priorities
    let drawPriority = 6;
    let protectionPriority = 5;
    let interactionPriority = 6;
    let winconFocus: 'wide' | 'tall' | 'combo' | 'value' = 'value';
    
    // Adjust based on commander cost
    if (commander.cmc >= 5) {
      rampPriority += 2;
    } else if (commander.cmc <= 2) {
      rampPriority -= 1;
    }
    
    // Adjust based on archetypes
    if (archetypes.includes('tokens')) {
      winconFocus = 'wide';
      drawPriority += 1;
    } else if (archetypes.includes('voltron')) {
      winconFocus = 'tall';
      protectionPriority += 3;
    } else if (archetypes.includes('combo') || archetypes.includes('storm')) {
      winconFocus = 'combo';
      drawPriority += 2;
      protectionPriority += 1;
    }
    
    if (archetypes.includes('control')) {
      interactionPriority += 2;
      drawPriority += 1;
    } else if (archetypes.includes('aggro')) {
      interactionPriority -= 1;
      protectionPriority -= 1;
    }
    
    return {
      rampPriority: Math.max(1, Math.min(10, rampPriority)),
      drawPriority: Math.max(1, Math.min(10, drawPriority)),
      protectionPriority: Math.max(1, Math.min(10, protectionPriority)),
      interactionPriority: Math.max(1, Math.min(10, interactionPriority)),
      winconFocus
    };
  }

  /**
   * Extract creature types from type line
   */
  private extractCreatureTypes(typeLine: string): string[] {
    const commonTribes = [
      'human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit',
      'wizard', 'warrior', 'soldier', 'beast', 'cat', 'vampire', 'merfolk',
      'elemental', 'giant', 'dwarf', 'orc', 'treefolk', 'spider', 'snake'
    ];
    
    return commonTribes.filter(tribe => 
      new RegExp(`\\b${tribe}\\b`, 'i').test(typeLine)
    );
  }
}

export const commanderProfiler = new CommanderProfiler();
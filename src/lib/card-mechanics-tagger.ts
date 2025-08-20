import { ScryfallCard, LocalCardData } from './types';
import { mtgjsonKeywords } from './mtgjson-keywords';

// Comprehensive keyword list for enhanced detection
const ENHANCED_KEYWORDS = {
  landMechanics: ['landfall', 'land enters', 'additional land', 'extra land', 'lands you control'],
  counterMechanics: ['+1/+1 counter', 'proliferate', 'modular', 'sunburst', 'graft', 'evolve', 'adapt', 'monstrosity'],
  graveyardMechanics: ['dredge', 'flashback', 'unearth', 'delve', 'escape', 'threshold', 'delirium', 'undergrowth'],
  artifactMechanics: ['affinity', 'imprint', 'living weapon', 'metalcraft', 'improvise', 'crew'],
  tokenMechanics: ['create', 'token', 'populate', 'embalm', 'eternalize', 'manifest'],
  spellMechanics: ['storm', 'cascade', 'replicate', 'overload', 'prowess', 'magecraft'],
  tribalMechanics: ['changeling', 'tribal', 'lord effect', 'kindred'],
  etbMechanics: ['enters the battlefield', 'when.*enters', 'whenever.*enters', 'etb']
};

/**
 * Comprehensive Card Mechanics Tagging System
 * Analyzes cards and assigns specific mechanical tags for synergy detection
 */

export interface MechanicTag {
  name: string;          // The mechanic name (e.g., "token_creation", "landfall", "sacrifice_outlet")
  category: string;      // Category (e.g., "resource_generation", "triggers", "activated_abilities")
  priority: number;      // 1-10, how important this mechanic is for the card
  synergy_weight?: number; // Multiplier for synergy scoring (from normalized tags table)
}

export interface CardMechanics {
  cardId: string;
  cardName: string;
  primaryType: string;           // creature, artifact, etc.
  functionalRoles: string[];     // ramp, draw, removal, etc.
  mechanicTags: MechanicTag[];   // All detected mechanics
  synergyKeywords: string[];     // Keywords for synergy matching
  powerLevel: number;            // 1-10 estimated power level
  archetypeRelevance: string[];  // Which archetypes this fits
}

export class CardMechanicsTagger {
  
  /**
   * Utility function to create a clean MechanicTag without redundant fields
   */
  private createTag(name: string, category: string, priority: number): MechanicTag {
    return {
      name,
      category,
      priority
    };
  }
  
  /**
   * Analyze a card and generate comprehensive mechanics tags with enhanced keyword detection
   */
  async analyzeCardEnhanced(card: ScryfallCard | LocalCardData): Promise<CardMechanics> {
    const text = (card.oracle_text || '').toLowerCase();
    const typeLine = card.type_line.toLowerCase();
    const name = card.name.toLowerCase();
    
    const mechanicTags: MechanicTag[] = [];
    
    // CRITICAL: Add comprehensive type tagging FIRST
    mechanicTags.push(...this.extractTypeTags(card.type_line));
    
    // Add MTGJSON-enhanced keyword detection
    const keywordAnalysis = await mtgjsonKeywords.analyzeCardKeywords(card.oracle_text || '');
    mechanicTags.push(...this.convertKeywordsToTags(keywordAnalysis, text));
    
    // Add all existing mechanic detection methods (pass name where needed)
    mechanicTags.push(...this.detectResourceGeneration(text, typeLine));
    mechanicTags.push(...this.detectTriggerMechanics(text, typeLine));
    mechanicTags.push(...this.detectActivatedAbilities(text, typeLine));
    mechanicTags.push(...this.detectStaticAbilities(text, typeLine));
    mechanicTags.push(...this.detectTargetingMechanics(text, typeLine));
    mechanicTags.push(...this.detectMovementMechanics(text, typeLine));
    mechanicTags.push(...this.detectCounterMechanics(text, typeLine, name));
    mechanicTags.push(...this.detectTribalMechanics(text, typeLine));
    mechanicTags.push(...this.detectCombatMechanics(text, typeLine));
    mechanicTags.push(...this.detectSpellMechanics(text, typeLine));
    mechanicTags.push(...this.detectArtifactMechanics(text, typeLine));
    mechanicTags.push(...this.detectLandMechanics(text, typeLine));
    mechanicTags.push(...this.detectGraveyardMechanics(text, typeLine));
    mechanicTags.push(...this.detectLibraryMechanics(text, typeLine));
    mechanicTags.push(...this.detectHandMechanics(text, typeLine));
    mechanicTags.push(...this.detectExileMechanics(text, typeLine));
    mechanicTags.push(...this.detectWinConditions(text, typeLine));
    mechanicTags.push(...this.detectProtectionMechanics(text, typeLine));
    mechanicTags.push(...this.detectKeywordsAndAbilities(text, typeLine));
    
    // Add enhanced keyword detection
    mechanicTags.push(...this.detectEnhancedKeywords(text, typeLine));
    
    const primaryType = this.determinePrimaryType(typeLine);
    const functionalRoles = this.determineFunctionalRoles(mechanicTags, typeLine);
    const synergyKeywords = this.generateSynergyKeywords(mechanicTags, text);
    const powerLevel = this.estimatePowerLevel(card, mechanicTags);
    const archetypeRelevance = this.determineArchetypeRelevance(mechanicTags, typeLine);
    
    return {
      cardId: card.id,
      cardName: card.name,
      primaryType,
      functionalRoles,
      mechanicTags,
      synergyKeywords,
      powerLevel,
      archetypeRelevance
    };
  }

  /**
   * Extract comprehensive type tags from type line
   */
  private extractTypeTags(typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    const originalTypeLine = typeLine;
    typeLine = typeLine.toLowerCase();
    
    // Split type line into main types and subtypes
    const parts = originalTypeLine.split('—').map(p => p.trim());
    const mainTypes = parts[0] ? parts[0].split(' ') : [];
    const subTypes = parts[1] ? parts[1].split(' ') : [];
    
    // SUPERTYPES (Legendary, Basic, Snow, World, Ongoing)
    const supertypes = ['legendary', 'basic', 'snow', 'world', 'ongoing', 'host', 'token'];
    for (const supertype of supertypes) {
      if (typeLine.includes(supertype)) {
        tags.push({
          name: `supertype_${supertype}`,
          category: 'type_supertype',
          confidence: 1.0,
          evidence: [supertype],
          priority: supertype === 'legendary' ? 8 : 5
        });
      }
    }
    
    // MAIN CARD TYPES
    const cardTypes = ['creature', 'artifact', 'enchantment', 'instant', 'sorcery', 'planeswalker', 'land', 'battle', 'plane', 'phenomenon', 'scheme', 'vanguard', 'conspiracy'];
    for (const cardType of cardTypes) {
      if (typeLine.includes(cardType)) {
        tags.push({
          name: `type_${cardType}`,
          category: 'type_main',
          confidence: 1.0,
          evidence: [cardType],
          priority: 7
        });
      }
    }
    
    // ARTIFACT SUBTYPES
    const artifactSubtypes = ['equipment', 'vehicle', 'fortification', 'contraption', 'clue', 'food', 'gold', 'treasure', 'blood', 'powerstone'];
    for (const subtype of artifactSubtypes) {
      if (typeLine.includes(subtype)) {
        tags.push({
          name: `subtype_${subtype}`,
          category: 'type_artifact_subtype',
          confidence: 1.0,
          evidence: [subtype],
          priority: subtype === 'equipment' ? 8 : 6
        });
      }
    }
    
    // ENCHANTMENT SUBTYPES  
    const enchantmentSubtypes = ['aura', 'curse', 'saga', 'shrine', 'background', 'class', 'room', 'role', 'shard'];
    for (const subtype of enchantmentSubtypes) {
      if (typeLine.includes(subtype)) {
        tags.push({
          name: `subtype_${subtype}`,
          category: 'type_enchantment_subtype',
          confidence: 1.0,
          evidence: [subtype],
          priority: subtype === 'aura' ? 7 : 6
        });
      }
    }
    
    // LAND SUBTYPES
    const landSubtypes = ['plains', 'island', 'swamp', 'mountain', 'forest', 'gate', 'lair', 'locus', 'urza', 'mine', 'power-plant', 'tower', 'desert'];
    for (const subtype of landSubtypes) {
      if (typeLine.includes(subtype)) {
        tags.push({
          name: `subtype_${subtype}`,
          category: 'type_land_subtype',
          confidence: 1.0,
          evidence: [subtype],
          priority: 6
        });
      }
    }
    
    // SPELL SUBTYPES
    const spellSubtypes = ['arcane', 'trap', 'adventure', 'lesson'];
    for (const subtype of spellSubtypes) {
      if (typeLine.includes(subtype)) {
        tags.push({
          name: `subtype_${subtype}`,
          category: 'type_spell_subtype',
          confidence: 1.0,
          evidence: [subtype],
          priority: 6
        });
      }
    }
    
    // CREATURE TYPES (comprehensive list)
    const creatureTypes = [
      // Races
      'human', 'elf', 'dwarf', 'goblin', 'merfolk', 'vampire', 'werewolf', 'zombie', 'orc', 'giant', 'troll',
      'faerie', 'kithkin', 'kor', 'vedalken', 'leonin', 'azra', 'tiefling', 'halfling', 'gnome',
      
      // Classes
      'warrior', 'wizard', 'cleric', 'rogue', 'shaman', 'druid', 'knight', 'soldier', 'berserker',
      'monk', 'ninja', 'samurai', 'archer', 'scout', 'pilot', 'pirate', 'noble', 'advisor', 'artificer',
      'assassin', 'barbarian', 'bard', 'ranger', 'warlock', 'paladin',
      
      // Creature types
      'angel', 'demon', 'dragon', 'hydra', 'phoenix', 'sphinx', 'avatar', 'god', 'elemental', 'horror',
      'beast', 'bird', 'cat', 'dog', 'wolf', 'bear', 'boar', 'elk', 'horse', 'ox', 'rhino',
      'spider', 'insect', 'snake', 'lizard', 'crocodile', 'turtle', 'frog', 'fish', 'whale', 'octopus',
      'crab', 'leech', 'worm', 'slug', 'jellyfish', 'starfish', 'squid', 'shark', 'ape', 'monkey',
      
      // Artifact creatures
      'golem', 'construct', 'thopter', 'myr', 'servo', 'gnome', 'automaton', 'juggernaut',
      
      // Undead
      'skeleton', 'spirit', 'specter', 'shade', 'wraith', 'lich', 'mummy',
      
      // Tribal relevant
      'sliver', 'ally', 'eldrazi', 'processor', 'scion', 'spawn',
      
      // Other
      'mutant', 'illusion', 'shapeshifter', 'changeling', 'minotaur', 'centaur', 'satyr',
      'dryad', 'treefolk', 'fungus', 'saproling', 'plant', 'wall', 'scarecrow', 'gargoyle',
      'dinosaur', 'egg', 'weird', 'ooze', 'gremlin', 'devil', 'imp', 'nightmare', 'unicorn',
      'pegasus', 'griffin', 'hippogriff', 'basilisk', 'cockatrice', 'gorgon', 'harpy', 'chimera',
      'manticore', 'naga', 'siren', 'triton', 'kraken', 'serpent', 'wurm', 'drake', 'wyvern',
      'archon', 'praetor', 'phyrexian'
    ];
    
    for (const creatureType of creatureTypes) {
      // FIXED: Use word boundary matching to avoid "wolf" matching "werewolf"  
      const wordBoundaryRegex = new RegExp(`\\b${creatureType}\\b`, 'i');
      if (wordBoundaryRegex.test(typeLine)) {
        tags.push({
          name: `creature_type_${creatureType}`,
          category: 'type_creature',
          confidence: 1.0,
          evidence: [creatureType],
          priority: 6
        });
      }
    }
    
    // PLANESWALKER TYPES
    const planeswalkerTypes = [
      'ajani', 'ashiok', 'basri', 'bolas', 'chandra', 'dack', 'daretti', 'davriel', 'domri',
      'dovin', 'elspeth', 'garruk', 'gideon', 'huatli', 'jace', 'jaya', 'karn', 'kasmina',
      'kaya', 'kiora', 'koth', 'liliana', 'lukka', 'nahiri', 'narset', 'nissa', 'nixilis',
      'oko', 'ral', 'rowan', 'saheeli', 'samut', 'sarkhan', 'serra', 'sorin', 'tamiyo',
      'teferi', 'teyo', 'tezzeret', 'tibalt', 'ugin', 'venser', 'vivien', 'vraska', 'will',
      'windgrace', 'wrenn', 'xenagos', 'yanggu', 'yanling'
    ];
    
    for (const pw of planeswalkerTypes) {
      if (typeLine.includes(pw)) {
        tags.push({
          name: `planeswalker_type_${pw}`,
          category: 'type_planeswalker',
          confidence: 1.0,
          evidence: [pw],
          priority: 7
        });
      }
    }
    
    return tags;
  }
  
  /**
   * Synchronous version for backward compatibility
   */
  analyzeCard(card: ScryfallCard | LocalCardData): CardMechanics {
    const text = (card.oracle_text || '').toLowerCase();
    const typeLine = card.type_line.toLowerCase();
    const name = card.name.toLowerCase();
    
    const mechanicTags: MechanicTag[] = [];
    
    // Add comprehensive type tagging
    mechanicTags.push(...this.extractTypeTags(card.type_line));
    
    // Add all mechanic detection methods
    mechanicTags.push(...this.detectResourceGeneration(text, typeLine));
    mechanicTags.push(...this.detectTriggerMechanics(text, typeLine));
    mechanicTags.push(...this.detectActivatedAbilities(text, typeLine));
    mechanicTags.push(...this.detectStaticAbilities(text, typeLine));
    mechanicTags.push(...this.detectTargetingMechanics(text, typeLine));
    mechanicTags.push(...this.detectMovementMechanics(text, typeLine));
    mechanicTags.push(...this.detectCounterMechanics(text, typeLine, name));
    mechanicTags.push(...this.detectTribalMechanics(text, typeLine));
    mechanicTags.push(...this.detectCombatMechanics(text, typeLine));
    mechanicTags.push(...this.detectSpellMechanics(text, typeLine));
    mechanicTags.push(...this.detectArtifactMechanics(text, typeLine));
    mechanicTags.push(...this.detectLandMechanics(text, typeLine));
    mechanicTags.push(...this.detectGraveyardMechanics(text, typeLine));
    mechanicTags.push(...this.detectLibraryMechanics(text, typeLine));
    mechanicTags.push(...this.detectHandMechanics(text, typeLine));
    mechanicTags.push(...this.detectExileMechanics(text, typeLine));
    mechanicTags.push(...this.detectWinConditions(text, typeLine));
    mechanicTags.push(...this.detectProtectionMechanics(text, typeLine));
    mechanicTags.push(...this.detectKeywordsAndAbilities(text, typeLine));
    
    const primaryType = this.determinePrimaryType(typeLine);
    const functionalRoles = this.determineFunctionalRoles(mechanicTags, typeLine);
    const synergyKeywords = this.generateSynergyKeywords(mechanicTags, text);
    const powerLevel = this.estimatePowerLevel(card, mechanicTags);
    const archetypeRelevance = this.determineArchetypeRelevance(mechanicTags, typeLine);
    
    return {
      cardId: card.id,
      cardName: card.name,
      primaryType,
      functionalRoles,
      mechanicTags,
      synergyKeywords,
      powerLevel,
      archetypeRelevance
    };
  }
  
  /**
   * Detect resource generation mechanics - COMPREHENSIVE
   */
  private detectResourceGeneration(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // MANA GENERATION - All forms
    if (text.includes('add') && (/\{[wubrgcx]\}/.test(text) || text.includes('mana'))) {
      const evidence = this.extractEvidence(text, ['add.*mana', 'add.*\\{[wubrgc]\\}']);
      tags.push({
        name: 'mana_generation',
        category: 'resource_generation',
        confidence: 0.9,
        evidence,
        priority: 8
      });
      
      // Specific mana colors
      if (text.includes('{w}') || text.includes('white mana')) tags.push({name: 'mana_white', category: 'mana_generation', priority: 6});
      if (text.includes('{u}') || text.includes('blue mana')) tags.push(this.createTag('mana_blue', 'mana_generation', 6));
      if (text.includes('{b}') || text.includes('black mana')) tags.push({name: 'mana_black', category: 'mana_generation', confidence: 0.95, evidence, priority: 6});
      if (text.includes('{r}') || text.includes('red mana')) tags.push({name: 'mana_red', category: 'mana_generation', confidence: 0.95, evidence, priority: 6});
      if (text.includes('{g}') || text.includes('green mana')) tags.push({name: 'mana_green', category: 'mana_generation', confidence: 0.95, evidence, priority: 6});
      if (text.includes('{c}') || text.includes('colorless mana')) tags.push({name: 'mana_colorless', category: 'mana_generation', confidence: 0.95, evidence, priority: 6});
    }
    
    // MANA ACCELERATION (non-land)
    if ((text.includes('add') && text.includes('mana')) || 
        (typeLine.includes('artifact') && (text.includes('{t}:') && /\{[wubrgc]\}/.test(text)))) {
      tags.push({
        name: 'mana_acceleration',
        category: 'resource_generation',
        confidence: 0.9,
        evidence: this.extractEvidence(text, ['add.*mana', '{t}:.*{[wubrgc]}']),
        priority: 7
      });
    }
    
    // LAND RAMP - All forms
    if ((text.includes('search your library for') && text.includes('land')) ||
        (text.includes('put') && text.includes('land') && text.includes('battlefield')) ||
        text.includes('basic land card') ||
        text.includes('play an additional land')) {
      const evidence = this.extractEvidence(text, ['search.*library.*land', 'basic land', 'put.*land.*battlefield', 'additional land']);
      tags.push({
        name: 'land_ramp',
        category: 'resource_generation', 
        confidence: 0.95,
        evidence,
        priority: 8
      });
      
      // Specific land ramp types
      if (text.includes('basic land')) tags.push({name: 'basic_land_ramp', category: 'resource_generation', confidence: 0.98, evidence, priority: 7});
      if (text.includes('additional land')) tags.push({name: 'extra_land_drop', category: 'resource_generation', confidence: 0.95, evidence, priority: 7});
      if (text.includes('tapped')) tags.push({name: 'ramp_enters_tapped', category: 'resource_generation', confidence: 0.9, evidence, priority: 5});
    }
    
    // CARD DRAW - All forms
    if (text.includes('draw') && text.includes('card')) {
      const evidence = this.extractEvidence(text, ['draw.*card', 'draw a card', 'draw cards']);
      tags.push({
        name: 'card_draw',
        category: 'resource_generation',
        confidence: 0.95,
        evidence,
        priority: 8
      });
      
      // Conditional vs unconditional
      if (text.includes('whenever') || text.includes('when')) {
        tags.push({name: 'conditional_card_draw', category: 'resource_generation', confidence: 0.9, evidence, priority: 7});
      } else if (text.includes('draw a card') && !text.includes('may')) {
        tags.push({name: 'guaranteed_card_draw', category: 'resource_generation', confidence: 0.95, evidence, priority: 8});
      }
      
      // Card draw amount
      if (text.includes('draw two cards') || text.includes('draw 2 cards')) {
        tags.push({name: 'multi_card_draw', category: 'resource_generation', confidence: 0.98, evidence, priority: 8});
      }
    }
    
    // CARD SELECTION/ADVANTAGE
    if ((text.includes('look at') && text.includes('card')) ||
        text.includes('scry') ||
        text.includes('surveil') ||
        (text.includes('reveal') && text.includes('card'))) {
      tags.push({
        name: 'card_selection',
        category: 'resource_generation',
        confidence: 0.85,
        evidence: this.extractEvidence(text, ['look at.*card', 'scry', 'surveil', 'reveal.*card']),
        priority: 6
      });
    }
    
    // TUTORING
    if ((text.includes('search your library') && !text.includes('land')) ||
        text.includes('tutor')) {
      tags.push({
        name: 'tutoring',
        category: 'resource_generation',
        confidence: 0.95,
        evidence: this.extractEvidence(text, ['search your library', 'tutor']),
        priority: 9
      });
    }
    
    // LIFE GAIN
    if (text.includes('gain') && text.includes('life')) {
      tags.push({
        name: 'life_gain',
        category: 'resource_generation',
        confidence: 0.9,
        evidence: this.extractEvidence(text, ['gain.*life']),
        priority: 5
      });
    }
    
    // ENERGY GENERATION
    if (text.includes('energy counter') || text.includes('{e}')) {
      tags.push({
        name: 'energy_generation',
        category: 'resource_generation',
        confidence: 0.95,
        evidence: this.extractEvidence(text, ['energy counter', '{e}']),
        priority: 6
      });
    }
    
    // Token creation with nuanced detection
    if (text.includes('create') && text.includes('token')) {
      const evidence = this.extractEvidence(text, ['create.*token', 'token creature']);
      const isRepeatable = text.includes('whenever') || text.includes('at the beginning');
      
      // Base token creation tag
      tags.push({
        name: 'token_creation',
        category: 'resource_generation',
        confidence: 0.9,
        evidence,
        priority: isRepeatable ? 8 : 6
      });
      
      // Specific token type detection
      if (text.includes('treasure token')) {
        tags.push({
          name: 'treasure_token_creation',
          category: 'resource_generation',
          confidence: 0.95,
          evidence: this.extractEvidence(text, ['treasure token']),
          priority: 7
        });
      }
      if (text.includes('clue token')) {
        tags.push({
          name: 'clue_token_creation',
          category: 'resource_generation',
          confidence: 0.95,
          evidence: this.extractEvidence(text, ['clue token']),
          priority: 6
        });
      }
      if (text.includes('food token')) {
        tags.push({
          name: 'food_token_creation',
          category: 'resource_generation',
          confidence: 0.95,
          evidence: this.extractEvidence(text, ['food token']),
          priority: 5
        });
      }
      
      // Detect creature type of tokens - IMPROVED PATTERNS
      const tokenPatterns = [
        // "create a 1/1 green Saproling creature token"
        /create.*?(?:\d+\/\d+|\w+)\s+(?:\w+\s+)*?(\w+)\s+creature tokens?/gi,
        // "put a 1/1 green Saproling creature token onto the battlefield"
        /put.*?(?:\d+\/\d+|\w+)\s+(?:\w+\s+)*?(\w+)\s+creature tokens?/gi,
        // "create X 1/1 green Saproling creature tokens"
        /create.*?(?:\d+\/\d+|\w+)\s+(?:\w+\s+)*?(\w+)\s+creature tokens?/gi,
        // "create a Saproling token" (short form)
        /create.*?(\w+)\s+tokens?/gi,
        // "put a Saproling token onto the battlefield"
        /put.*?(\w+)\s+tokens?/gi
      ];
      
      for (const pattern of tokenPatterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const creatureType = match[1].toLowerCase();
          
          // Skip common false positives
          if (['creature', 'token', 'tokens', 'the', 'a', 'an', 'onto', 'battlefield'].includes(creatureType)) {
            continue;
          }
          
          tags.push({
            name: `${creatureType}_token_creation`,
            category: 'tokens',
            confidence: 0.9,
            evidence: [match[0]],
            priority: 6
          });
        }
      }
    }
    
    // Conditional tribal token mechanics (e.g., "If that token is a Squirrel, instead...")
    const conditionalTribalPattern = /(?:if|when) (?:that )?token is (?:a |an )?(\w+)/gi;
    let conditionalMatch;
    while ((conditionalMatch = conditionalTribalPattern.exec(text)) !== null) {
      const creatureType = conditionalMatch[1].toLowerCase();
      
      // Skip common false positives
      if (['creature', 'token', 'copy', 'the', 'that'].includes(creatureType)) {
        continue;
      }
      
      tags.push({
        name: `${creatureType}_token_matters`,
        category: 'tokens',
        confidence: 0.95,
        evidence: [conditionalMatch[0]],
        priority: 8
      });
      
      // Also add tribal synergy tag
      tags.push({
        name: `${creatureType}_tribal`,
        category: 'tribal',
        confidence: 0.9,
        evidence: [conditionalMatch[0]],
        priority: 7
      });
    }
    
    // Detect creature types from type line for tribal tagging
    if (typeLine && typeLine.includes('Creature')) {
      const typeLineParts = typeLine.split('—');
      if (typeLineParts.length > 1) {
        const creatureTypes = typeLineParts[1].trim().split(' ');
        for (const creatureType of creatureTypes) {
          const lowerType = creatureType.toLowerCase().trim();
          if (lowerType && lowerType.length > 2) { // Avoid single letters/short words
            tags.push({
              name: `creature_type_${lowerType}`,
              category: 'type_creature',
              confidence: 1.0,
              evidence: [typeLine],
              priority: 6
            });
            
            // Add tribal tag for tribal-relevant creature types
            const tribalTypes = [
              // Major tribal types with lots of support
              'elf', 'goblin', 'zombie', 'vampire', 'dragon', 'angel', 'demon', 'human', 'soldier', 'warrior', 'wizard', 'knight', 'spirit', 'elemental', 'beast', 'merfolk', 'artifact',
              
              // Medium tribal types with some support
              'cat', 'dog', 'wolf', 'bird', 'fish', 'snake', 'spider', 'insect', 'squirrel', 'rat', 'bat', 'bear', 'boar', 'elk', 'ox', 'horse', 'goat', 'sheep',
              
              // Plane-specific and niche tribal types
              'dwarf', 'giant', 'troll', 'orc', 'ogre', 'minotaur', 'centaur', 'satyr', 'faerie', 'kithkin', 'kender', 'halfling', 'gnome',
              
              // Creature classes and professions
              'cleric', 'rogue', 'shaman', 'druid', 'monk', 'barbarian', 'berserker', 'scout', 'ranger', 'archer', 'assassin', 'pirate', 'ninja', 'samurai',
              
              // Mechanical and construct types
              'golem', 'construct', 'thopter', 'servo', 'myr',
              
              // Plant and nature types
              'treefolk', 'plant', 'fungus', 'saproling', 'dryad', 'nymph',
              
              // Undead and horror types
              'skeleton', 'wraith', 'specter', 'shade', 'horror', 'nightmare',
              
              // Mythological and legendary creatures
              'sphinx', 'hydra', 'phoenix', 'griffin', 'pegasus', 'unicorn', 'basilisk', 'cockatrice', 'manticore', 'chimera',
              
              // Planar beings
              'archon', 'avatar', 'incarnation',
              
              // Slivers and changelings (special tribal)
              'sliver', 'changeling',
              
              // Dinosaurs and prehistoric
              'dinosaur',
              
              // Vehicles and newer types
              'vehicle', 'equipment',
              
              // Tokens and temporary creatures
              'token', 'copy',
              
              // Phyrexian and faction-based
              'phyrexian', 'rebel', 'mercenary',
              
              // Weatherlight crew and story-specific
              'crew', 'ally',
              
              // Additional animals and creatures
              'turtle', 'crab', 'octopus', 'whale', 'shark', 'jellyfish', 'starfish', 'leech', 'slug', 'worm', 'lizard', 'crocodile', 'frog', 'salamander'
            ];
            if (tribalTypes.includes(lowerType)) {
              tags.push({
                name: `${lowerType}_tribal`,
                category: 'tribal',
                confidence: 0.8,
                evidence: [typeLine],
                priority: 6
              });
            }
          }
        }
      }
    }
    
    // Treasure creation
    if (text.includes('treasure')) {
      const evidence = this.extractEvidence(text, ['treasure', 'create.*treasure']);
      tags.push({
        name: 'treasure_generation',
        category: 'resource_generation',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Card draw
    if (text.includes('draw') && text.includes('card')) {
      const evidence = this.extractEvidence(text, ['draw.*card', 'draw \\d+ card']);
      const isRepeatable = text.includes('whenever') || text.includes('at the beginning');
      tags.push({
        name: 'card_draw',
        category: 'resource_generation',
        confidence: 0.9,
        evidence,
        priority: isRepeatable ? 9 : 7
      });
    }
    
    // Energy generation
    if (text.includes('energy')) {
      const evidence = this.extractEvidence(text, ['energy counter', 'get.*energy']);
      tags.push({
        name: 'energy_generation',
        category: 'resource_generation',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    return tags;
  }
  
  /**
   * Detect trigger-based mechanics
   */
  private detectTriggerMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === ETB TRIGGERS ===
    // Self ETB
    if (text.includes('enters the battlefield') || (text.includes('when') && text.includes('enters'))) {
      const evidence = this.extractEvidence(text, ['enters the battlefield', 'when.*enters']);
      tags.push({
        name: 'etb_trigger_self',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ENHANCED ETB DETECTION ===
    // CRITICAL DISTINCTION: ETB Payoffs vs Self-Triggers
    
    // ETB PAYOFF patterns - distinguish between generic and tribal-specific
    
    // GENERIC ETB PAYOFFS - trigger when ANY creature enters (perfect for Norin-style commanders)
    const genericETBPayoffPatterns = [
      'whenever another creature enters',
      'whenever a creature enters',
      'when another creature enters',
      'when a creature enters the battlefield',
      'whenever a creature you control enters',
      'when a creature you control enters',
      'whenever another creature you control enters',
      'another creature enters the battlefield'
    ];
    
    // TRIBAL ETB PAYOFF patterns - trigger when specific creature type enters
    const tribalTypes = ['dragon', 'elf', 'goblin', 'human', 'zombie', 'angel', 'demon', 'vampire', 'beast', 'wizard', 'warrior', 'knight', 'soldier', 'spirit', 'elemental', 'merfolk', 'faerie', 'giant', 'treefolk', 'hydra', 'phoenix', 'sphinx', 'minotaur', 'satyr', 'spider', 'dinosaur', 'pirate', 'ninja', 'samurai'];
    
    const tribalETBPayoffPatterns: string[] = [];
    for (const tribe of tribalTypes) {
      tribalETBPayoffPatterns.push(
        `whenever another ${tribe} enters`,
        `whenever a ${tribe} enters`,
        `when another ${tribe} enters`,
        `when a ${tribe} enters the battlefield`,
        `when a ${tribe} enters`,
        `whenever a ${tribe} you control enters`,
        `when a ${tribe} you control enters`,
        `whenever another ${tribe} you control enters`,
        `when another ${tribe} you control enters`
      );
    }
    
    // ETB SELF patterns - own ETB triggers
    const etbSelfPatterns = [
      'when.*enters the battlefield',
      'enters the battlefield.*',
      'as.*enters the battlefield'
    ];
    
    const lowerText = text.toLowerCase();
    let isGenericETBPayoff = false;
    let isTribalETBPayoff = false;
    let detectedTribe = '';
    let isETBSelf = false;
    
    // Check for GENERIC ETB payoff triggers (high priority for Norin-style commanders)
    for (const pattern of genericETBPayoffPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerText)) {
        // Check if this is actually a harmful ETB effect (damages your own creatures)
        const isHarmfulETB = (
          /deals \d+ damage to it/i.test(lowerText) ||
          /deals damage to it/i.test(lowerText) ||
          /deals \d+ damage to that creature/i.test(lowerText) ||
          /deals damage to that creature/i.test(lowerText) ||
          /deals \d+ damage to each creature/i.test(lowerText) ||
          /deals damage to each creature/i.test(lowerText) ||
          /deal \d+ damage to each creature/i.test(lowerText) ||
          /deal damage to each creature/i.test(lowerText) ||
          lowerText.includes('destroy it') ||
          lowerText.includes('sacrifice it') ||
          lowerText.includes('exile it')
        );
        
        if (!isHarmfulETB) {
          isGenericETBPayoff = true;
        } else {
          // Tag harmful ETB effects specifically
          tags.push({
            name: 'creature_hostile_etb',
            category: 'anti_synergy',
            confidence: 0.95,
            evidence: this.extractEvidence(text, ['deals damage to', 'destroy', 'sacrifice', 'exile']),
            priority: 9
          });
        }
        break;
      }
    }
    
    // Check for TRIBAL ETB payoff triggers (only good for matching tribal commanders)
    for (const pattern of tribalETBPayoffPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerText)) {
        isTribalETBPayoff = true;
        // Extract which tribe this is for
        for (const tribe of tribalTypes) {
          if (pattern.includes(tribe)) {
            detectedTribe = tribe;
            break;
          }
        }
        break;
      }
    }
    
    // Special case: Cards that trigger on any creature entering but only benefit specific tribes
    // Example: Marauding Raptor damages all creatures but only helps dinosaurs
    if (!isTribalETBPayoff && !isGenericETBPayoff) {
      for (const pattern of genericETBPayoffPatterns) {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(lowerText)) {
          // Check if it has tribal-specific benefits despite generic trigger
          for (const tribe of tribalTypes) {
            const tribeLower = tribe.toLowerCase();
            if (lowerText.includes(`if a ${tribeLower}`) || 
                lowerText.includes(`${tribeLower} is dealt damage`) ||
                lowerText.includes(`if a ${tribeLower} is dealt damage`)) {
              isTribalETBPayoff = true;
              detectedTribe = tribe;
              break;
            }
          }
          break;
        }
      }
    }
    
    // Check for self ETB triggers
    for (const pattern of etbSelfPatterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerText)) {
        isETBSelf = true;
        break;
      }
    }
    
    // Add GENERIC ETB payoff tag (ESSENTIAL for commanders like Norin)
    if (isGenericETBPayoff) {
      const evidence = this.extractEvidence(text, genericETBPayoffPatterns);
      tags.push({
        name: 'etb_payoff_generic',
        category: 'triggers',
        confidence: 0.98,
        evidence,
        priority: 10 // HIGHEST priority for generic ETB enabler commanders
      });
      
      // Also add the general ETB trigger tag for backwards compatibility
      tags.push({
        name: 'etb_trigger_creature',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Add TRIBAL ETB payoff tag (only good for matching tribal commanders)
    if (isTribalETBPayoff && detectedTribe) {
      const evidence = this.extractEvidence(text, tribalETBPayoffPatterns);
      tags.push({
        name: `etb_payoff_${detectedTribe}`,
        category: 'triggers',
        confidence: 0.98,
        evidence,
        priority: 8 // Lower priority than generic - only applies to specific tribes
      });
      
      // Also add tribal-specific tag
      tags.push({
        name: `${detectedTribe}_tribal_payoff`,
        category: 'tribal',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Add self ETB tag (normal ETB effects)
    if (isETBSelf && !isGenericETBPayoff && !isTribalETBPayoff) {
      const evidence = this.extractEvidence(text, etbSelfPatterns);
      tags.push({
        name: 'etb_trigger_creature',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // Continue with specific ETB effect detection if we found any ETB trigger
    if (isGenericETBPayoff || isTribalETBPayoff || isETBSelf) {
      const evidence = this.extractEvidence(text, [...genericETBPayoffPatterns, ...tribalETBPayoffPatterns, ...etbSelfPatterns]);
      
      // Specific ETB effect subcategories (lowerText already declared above)
      
      // ETB Damage (Purphoros, Impact Tremors, Agate Instigator, Molten Gatekeeper)
      if (lowerText.includes('damage') && (lowerText.includes('opponent') || lowerText.includes('player') || lowerText.includes('any target') || lowerText.includes('target player'))) {
        tags.push({
          name: 'etb_damage',
          category: 'etb_effects',
          confidence: 0.95,
          evidence: evidence.concat(['damage']),
          priority: 9
        });
      }
      
      // ETB Draw (card draw effects)
      if ((lowerText.includes('draw') && lowerText.includes('card')) || lowerText.includes('draws a card')) {
        tags.push({
          name: 'etb_draw',
          category: 'etb_effects',
          confidence: 0.95,
          evidence: evidence.concat(['draw']),
          priority: 8
        });
      }
      
      // ETB Destroy/Removal
      if (lowerText.includes('destroy') || lowerText.includes('exile') || lowerText.includes('return') && lowerText.includes('hand')) {
        tags.push({
          name: 'etb_destroy',
          category: 'etb_effects',
          confidence: 0.9,
          evidence: evidence.concat(['destroy', 'exile', 'removal']),
          priority: 8
        });
      }
      
      // ETB Token Creation
      if (lowerText.includes('create') && lowerText.includes('token')) {
        tags.push({
          name: 'etb_token_creation',
          category: 'etb_effects',
          confidence: 0.95,
          evidence: evidence.concat(['create', 'token']),
          priority: 8
        });
      }
      
      // ETB Ramp/Mana
      if ((lowerText.includes('add') && lowerText.includes('mana')) || (lowerText.includes('search') && lowerText.includes('land'))) {
        tags.push({
          name: 'etb_ramp',
          category: 'etb_effects',
          confidence: 0.9,
          evidence: evidence.concat(['mana', 'ramp']),
          priority: 7
        });
      }
      
      // ETB Counter Manipulation
      if (lowerText.includes('counter') && (lowerText.includes('put') || lowerText.includes('add') || lowerText.includes('remove'))) {
        tags.push({
          name: 'etb_counter_manipulation',
          category: 'etb_effects',
          confidence: 0.9,
          evidence: evidence.concat(['counter']),
          priority: 7
        });
      }
      
      // ETB Tutor/Search
      if (lowerText.includes('search') && (lowerText.includes('library') || lowerText.includes('deck'))) {
        tags.push({
          name: 'etb_tutor',
          category: 'etb_effects',
          confidence: 0.9,
          evidence: evidence.concat(['search', 'tutor']),
          priority: 7
        });
      }
      
      // ETB Mill/Graveyard
      if ((lowerText.includes('mill') || lowerText.includes('cards into') && lowerText.includes('graveyard')) || 
          (lowerText.includes('put') && lowerText.includes('graveyard') && lowerText.includes('library'))) {
        tags.push({
          name: 'etb_mill',
          category: 'etb_effects',
          confidence: 0.9,
          evidence: evidence.concat(['mill', 'graveyard']),
          priority: 7
        });
      }
      
      // ETB Scry/Manipulation
      if (lowerText.includes('scry') || (lowerText.includes('look at') && lowerText.includes('top'))) {
        tags.push({
          name: 'etb_scry',
          category: 'etb_effects',
          confidence: 0.9,
          evidence: evidence.concat(['scry', 'look']),
          priority: 6
        });
      }
      
      // Legacy compatibility - keep the old etb_damage_dealer tag for existing synergy rules
      if (lowerText.includes('damage') && (lowerText.includes('opponent') || lowerText.includes('player'))) {
        tags.push({
          name: 'etb_damage_dealer',
          category: 'triggers',
          confidence: 0.95,
          evidence: evidence.concat(['damage']),
          priority: 9
        });
      }
    }
    
    // Artifact ETB - more specific patterns to avoid false positives
    const artifactETBPatterns = [
      'whenever an artifact enters the battlefield',
      'when an artifact enters the battlefield',
      'whenever an artifact you control enters',
      'when an artifact you control enters',
      'whenever another artifact enters'
    ];
    
    const hasArtifactETB = artifactETBPatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    });
    
    if (hasArtifactETB) {
      const evidence = this.extractEvidence(text, artifactETBPatterns);
      tags.push({
        name: 'etb_trigger_artifact',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Enchantment ETB - more specific patterns to avoid false positives  
    const enchantmentETBPatterns = [
      'whenever an enchantment enters the battlefield',
      'when an enchantment enters the battlefield',
      'whenever an enchantment you control enters',
      'when an enchantment you control enters',
      'whenever another enchantment enters'
    ];
    
    const hasEnchantmentETB = enchantmentETBPatterns.some(pattern => {
      const regex = new RegExp(pattern, 'i');
      return regex.test(text);
    });
    
    if (hasEnchantmentETB) {
      const evidence = this.extractEvidence(text, enchantmentETBPatterns);
      tags.push({
        name: 'etb_trigger_enchantment',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === DEATH/LEAVE TRIGGERS ===
    // Self death
    if (text.includes('dies') || (text.includes('when') && (text.includes('destroyed') || text.includes('put into.*graveyard')))) {
      const evidence = this.extractEvidence(text, ['when.*dies', 'when.*destroyed', 'when.*put into.*graveyard']);
      tags.push({
        name: 'death_trigger_self',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Creature death
    if ((text.includes('whenever') || text.includes('when')) && text.includes('creature') && text.includes('dies')) {
      const evidence = this.extractEvidence(text, ['whenever.*creature.*dies', 'when.*creature.*dies']);
      tags.push({
        name: 'death_trigger_creature',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // Own creatures death
    if ((text.includes('whenever') || text.includes('when')) && text.includes('creature you control') && text.includes('dies')) {
      const evidence = this.extractEvidence(text, ['whenever.*creature you control.*dies']);
      tags.push({
        name: 'death_trigger_own_creatures',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Leaves battlefield
    if (text.includes('leaves the battlefield')) {
      const evidence = this.extractEvidence(text, ['leaves the battlefield']);
      tags.push({
        name: 'leaves_battlefield_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ATTACK TRIGGERS ===
    // Self attack
    if (text.includes('whenever') && text.includes('attacks')) {
      const evidence = this.extractEvidence(text, ['whenever.*attacks']);
      tags.push({
        name: 'attack_trigger_self',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Creature attack
    if (text.includes('whenever') && text.includes('creature') && text.includes('attack')) {
      const evidence = this.extractEvidence(text, ['whenever.*creature.*attacks']);
      tags.push({
        name: 'attack_trigger_creature',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Attack player
    if (text.includes('whenever') && text.includes('attack') && text.includes('player')) {
      const evidence = this.extractEvidence(text, ['whenever.*attacks.*player']);
      tags.push({
        name: 'attack_trigger_player',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === COMBAT DAMAGE TRIGGERS ===
    if (text.includes('whenever') && text.includes('combat damage')) {
      const evidence = this.extractEvidence(text, ['whenever.*combat damage']);
      tags.push({
        name: 'combat_damage_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === DAMAGE TRIGGERS ===
    if (text.includes('whenever') && text.includes('damage') && !text.includes('combat damage')) {
      const evidence = this.extractEvidence(text, ['whenever.*damage']);
      tags.push({
        name: 'damage_trigger',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === SPELL TRIGGERS ===
    // Cast spell
    if (text.includes('whenever you cast') || text.includes('whenever a player casts')) {
      const evidence = this.extractEvidence(text, ['whenever.*cast']);
      tags.push({
        name: 'spell_cast_trigger',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Instant/Sorcery cast
    if (text.includes('whenever you cast') && (text.includes('instant') || text.includes('sorcery'))) {
      const evidence = this.extractEvidence(text, ['whenever you cast.*instant', 'whenever you cast.*sorcery']);
      tags.push({
        name: 'instant_sorcery_cast_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Creature spell cast
    if (text.includes('whenever you cast') && text.includes('creature')) {
      const evidence = this.extractEvidence(text, ['whenever you cast.*creature']);
      tags.push({
        name: 'creature_cast_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === PHASE TRIGGERS ===
    // Upkeep
    if (text.includes('at the beginning of') && text.includes('upkeep')) {
      const evidence = this.extractEvidence(text, ['at the beginning of.*upkeep']);
      tags.push({
        name: 'upkeep_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // End step
    if (text.includes('at the beginning of') && text.includes('end step')) {
      const evidence = this.extractEvidence(text, ['at the beginning of.*end step']);
      tags.push({
        name: 'end_step_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Draw step
    if (text.includes('at the beginning of') && text.includes('draw step')) {
      const evidence = this.extractEvidence(text, ['at the beginning of.*draw step']);
      tags.push({
        name: 'draw_step_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Combat phase
    if (text.includes('at the beginning of') && text.includes('combat')) {
      const evidence = this.extractEvidence(text, ['at the beginning of.*combat']);
      tags.push({
        name: 'combat_phase_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === LANDFALL ===
    // Much more specific landfall detection to avoid false positives
    const landFallPatterns = [
      'landfall',
      'whenever a land enters the battlefield',
      'when a land enters the battlefield', 
      'whenever a land you control enters',
      'when a land you control enters',
      'whenever land enters the battlefield'
    ];
    
    const hasLandfall = text.includes('landfall') || 
      landFallPatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(text);
      });
    
    if (hasLandfall) {
      const evidence = this.extractEvidence(text, landFallPatterns);
      tags.push({
        name: 'landfall',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === CONSTELLATION ===
    // More specific constellation detection to avoid false positives
    const constellationPatterns = [
      'constellation',
      'whenever an enchantment enters the battlefield',
      'when an enchantment enters the battlefield',
      'whenever an enchantment you control enters',
      'when an enchantment you control enters'
    ];
    
    const hasConstellation = text.includes('constellation') ||
      constellationPatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(text);
      });
    
    if (hasConstellation) {
      const evidence = this.extractEvidence(text, constellationPatterns);
      tags.push({
        name: 'constellation',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === PROWESS ===
    if (text.includes('prowess') || (text.includes('whenever you cast') && text.includes('noncreature'))) {
      const evidence = this.extractEvidence(text, ['prowess', 'whenever you cast.*noncreature']);
      tags.push({
        name: 'prowess',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === THRESHOLD/DELIRIUM ===
    if (text.includes('threshold') || text.includes('delirium')) {
      const evidence = this.extractEvidence(text, ['threshold', 'delirium']);
      tags.push({
        name: 'graveyard_threshold_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === SPECIAL TRIGGERS ===
    // Lifegain trigger
    if (text.includes('whenever you gain life')) {
      const evidence = this.extractEvidence(text, ['whenever you gain life']);
      tags.push({
        name: 'lifegain_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Token creation trigger
    if (text.includes('whenever') && text.includes('token') && text.includes('created')) {
      const evidence = this.extractEvidence(text, ['whenever.*token.*created']);
      tags.push({
        name: 'token_creation_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Discard trigger
    if (text.includes('whenever') && text.includes('discard')) {
      const evidence = this.extractEvidence(text, ['whenever.*discard']);
      tags.push({
        name: 'discard_trigger',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Draw trigger
    if (text.includes('whenever you draw')) {
      const evidence = this.extractEvidence(text, ['whenever you draw']);
      tags.push({
        name: 'draw_trigger',
        category: 'triggers',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Sacrifice trigger
    if (text.includes('whenever') && text.includes('sacrifice')) {
      const evidence = this.extractEvidence(text, ['whenever.*sacrifice']);
      tags.push({
        name: 'sacrifice_trigger',
        category: 'triggers',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    return tags;
  }
  
  /**
   * Detect activated abilities
   */
  private detectActivatedAbilities(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === TAP ABILITIES ===
    // Basic tap ability
    if (/\{t\}/.test(text) || text.includes('tap:')) {
      const evidence = this.extractEvidence(text, ['\\{t\\}:', 'tap:']);
      tags.push({
        name: 'tap_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Tap for mana
    if (/\{t\}.*add/.test(text) || (text.includes('tap') && text.includes('add') && text.includes('mana'))) {
      const evidence = this.extractEvidence(text, ['\\{t\\}.*add', 'tap.*add.*mana']);
      tags.push({
        name: 'tap_for_mana',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Tap to draw
    if (/\{t\}.*draw/.test(text) || (text.includes('tap') && text.includes('draw'))) {
      const evidence = this.extractEvidence(text, ['\\{t\\}.*draw', 'tap.*draw']);
      tags.push({
        name: 'tap_to_draw',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === SACRIFICE ABILITIES ===
    // Sacrifice self
    if (text.includes('sacrifice') && text.includes(':') && !text.includes('sacrifice another')) {
      const evidence = this.extractEvidence(text, ['sacrifice.*:']);
      tags.push({
        name: 'sacrifice_self_ability',
        category: 'activated_abilities',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Sacrifice other permanents
    if ((text.includes('sacrifice a') || text.includes('sacrifice an') || text.includes('sacrifice another')) && text.includes(':')) {
      const evidence = this.extractEvidence(text, ['sacrifice a.*:', 'sacrifice an.*:', 'sacrifice another.*:']);
      tags.push({
        name: 'sacrifice_outlet',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Sacrifice creatures specifically
    if (text.includes('sacrifice') && text.includes('creature') && text.includes(':')) {
      const evidence = this.extractEvidence(text, ['sacrifice.*creature.*:']);
      tags.push({
        name: 'sacrifice_creature_outlet',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === PAYMENT ABILITIES ===
    // Pay life
    if (text.includes('pay') && text.includes('life') && text.includes(':')) {
      const evidence = this.extractEvidence(text, ['pay.*life.*:']);
      tags.push({
        name: 'pay_life_ability',
        category: 'activated_abilities',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Pay mana
    if (/\{.*\}.*:/.test(text) && !text.includes('add')) {
      const evidence = this.extractEvidence(text, ['\\{.*\\}.*:']);
      tags.push({
        name: 'mana_cost_ability',
        category: 'activated_abilities',
        confidence: 0.85,
        evidence,
        priority: 5
      });
    }
    
    // Discard as cost
    if (text.includes('discard') && text.includes(':') && !text.includes('draw')) {
      const evidence = this.extractEvidence(text, ['discard.*:']);
      tags.push({
        name: 'discard_cost_ability',
        category: 'activated_abilities',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Exile as cost
    if (text.includes('exile') && text.includes(':') && text.includes('from your')) {
      const evidence = this.extractEvidence(text, ['exile.*from your.*:']);
      tags.push({
        name: 'exile_cost_ability',
        category: 'activated_abilities',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === EQUIPMENT ABILITIES ===
    // Equip
    if (text.includes('equip')) {
      const evidence = this.extractEvidence(text, ['equip \\{.*\\}', 'equip']);
      tags.push({
        name: 'equip_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Reconfigure (for vehicles/equipment)
    if (text.includes('reconfigure')) {
      const evidence = this.extractEvidence(text, ['reconfigure']);
      tags.push({
        name: 'reconfigure_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === VEHICLE ABILITIES ===
    // Crew
    if (text.includes('crew')) {
      const evidence = this.extractEvidence(text, ['crew \\d+']);
      tags.push({
        name: 'crew_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === PLANESWALKER ABILITIES ===
    // Loyalty abilities (+ abilities)
    if (/[+]\d+:/.test(text)) {
      const evidence = this.extractEvidence(text, ['[+]\\d+:']);
      tags.push({
        name: 'loyalty_plus_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Loyalty abilities (- abilities)
    if (/-\d+:/.test(text)) {
      const evidence = this.extractEvidence(text, ['-\\d+:']);
      tags.push({
        name: 'loyalty_minus_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Ultimate abilities
    if (/-\d\d+:/.test(text) || text.includes('ultimate')) {
      const evidence = this.extractEvidence(text, ['-\\d\\d+:', 'ultimate']);
      tags.push({
        name: 'loyalty_ultimate_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === SPECIAL ABILITIES ===
    // Channel
    if (text.includes('channel')) {
      const evidence = this.extractEvidence(text, ['channel']);
      tags.push({
        name: 'channel_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Cycling
    if (text.includes('cycling')) {
      const evidence = this.extractEvidence(text, ['cycling']);
      tags.push({
        name: 'cycling_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Morph
    if (text.includes('morph')) {
      const evidence = this.extractEvidence(text, ['morph']);
      tags.push({
        name: 'morph_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Unearth
    if (text.includes('unearth')) {
      const evidence = this.extractEvidence(text, ['unearth']);
      tags.push({
        name: 'unearth_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Flashback
    if (text.includes('flashback')) {
      const evidence = this.extractEvidence(text, ['flashback']);
      tags.push({
        name: 'flashback_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Escape
    if (text.includes('escape')) {
      const evidence = this.extractEvidence(text, ['escape']);
      tags.push({
        name: 'escape_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Embalm/Eternalize
    if (text.includes('embalm') || text.includes('eternalize')) {
      const evidence = this.extractEvidence(text, ['embalm', 'eternalize']);
      tags.push({
        name: 'graveyard_activated_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === MODAL ABILITIES ===
    // Choose/modes
    if (text.includes('choose one') || text.includes('choose two') || text.includes('•')) {
      const evidence = this.extractEvidence(text, ['choose one', 'choose two', '•']);
      tags.push({
        name: 'modal_ability',
        category: 'activated_abilities',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === UNTAP ABILITIES ===
    if (/\{q\}/.test(text) || text.includes('untap:')) {
      const evidence = this.extractEvidence(text, ['\\{q\\}:', 'untap:']);
      tags.push({
        name: 'untap_ability',
        category: 'activated_abilities',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    return tags;
  }
  
  /**
   * Detect static abilities and continuous effects
   */
  private detectStaticAbilities(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // Anthem effects
    if (text.includes('creatures you control get +') || text.includes('other creatures you control get +')) {
      const evidence = this.extractEvidence(text, ['creatures you control get \\+', 'other creatures.*get \\+']);
      tags.push({
        name: 'anthem_effect',
        category: 'static_abilities',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Enhanced cost reduction with target detection
    if (text.includes('cost') && text.includes('less')) {
      const evidence = this.extractEvidence(text, ['cost.*less', 'spells.*cost.*less']);
      
      // Detect what types of cards get cost reduction
      const costReductionTargets = this.extractCostReductionTargets(text);
      
      if (costReductionTargets.length > 0) {
        // Create specific cost reduction tags for each target type
        costReductionTargets.forEach(target => {
          tags.push({
            name: `cost_reduction_${target}`,
            category: 'cost_reduction',
            confidence: 0.95,
            evidence,
            priority: 8
          });
        });
      } else {
        // Generic cost reduction
        tags.push({
          name: 'cost_reduction_generic',
          category: 'cost_reduction',
          confidence: 0.9,
          evidence,
          priority: 7
        });
      }
    }
    
    // Protection abilities
    if (text.includes('hexproof') || text.includes('shroud') || text.includes('protection')) {
      const evidence = this.extractEvidence(text, ['hexproof', 'shroud', 'protection from']);
      tags.push({
        name: 'protection_static',
        category: 'static_abilities',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Indestructible
    if (text.includes('indestructible')) {
      const evidence = this.extractEvidence(text, ['indestructible']);
      tags.push({
        name: 'indestructible',
        category: 'static_abilities',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Flying/evasion
    if (text.includes('flying') || text.includes('unblockable') || text.includes('can\'t be blocked')) {
      const evidence = this.extractEvidence(text, ['flying', 'unblockable', 'can\'t be blocked']);
      tags.push({
        name: 'evasion',
        category: 'static_abilities',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Damage amplification effects (like Torbran)
    if ((text.includes('would deal damage') && text.includes('instead')) ||
        (text.includes('deals') && text.includes('plus') && text.includes('damage')) ||
        (text.includes('damage') && text.includes('additional')) ||
        (text.includes('deals that much damage plus'))) {
      const evidence = this.extractEvidence(text, ['would deal damage.*instead', 'deals.*plus.*damage', 'additional.*damage']);
      tags.push({
        name: 'damage_amplification',
        category: 'static_abilities',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Color-specific source synergies (like Torbran caring about red sources)
    const colors = ['white', 'blue', 'black', 'red', 'green'];
    for (const color of colors) {
      if (text.includes(`${color} source`) || text.includes(`${color} spell`) || text.includes(`${color} permanent`)) {
        const evidence = this.extractEvidence(text, [`${color} source`, `${color} spell`, `${color} permanent`]);
        tags.push({
          name: `color_matters_${color}`,
          category: 'color_identity',
          confidence: 0.9,
          evidence,
          priority: 7
        });
      }
    }
    
    // Replacement effects
    if (text.includes('instead') && (text.includes('would') || text.includes('if'))) {
      const evidence = this.extractEvidence(text, ['instead', 'would.*instead', 'if.*instead']);
      tags.push({
        name: 'replacement_effect',
        category: 'static_abilities',
        confidence: 0.85,
        evidence,
        priority: 6
      });
    }
    
    // Doubling effects
    if (text.includes('double') || text.includes('twice')) {
      const evidence = this.extractEvidence(text, ['double', 'twice']);
      tags.push({
        name: 'doubling_effect',
        category: 'static_abilities',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    return tags;
  }
  
  /**
   * Detect targeting and removal mechanics
   */
  private detectTargetingMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === REMOVAL EFFECTS ===
    // Creature destruction
    if (text.includes('destroy target creature')) {
      const evidence = this.extractEvidence(text, ['destroy target creature']);
      tags.push({
        name: 'creature_removal',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Artifact/Enchantment destruction
    if ((text.includes('destroy target') && text.includes('artifact')) || 
        (text.includes('destroy target') && text.includes('enchantment'))) {
      const evidence = this.extractEvidence(text, ['destroy target.*artifact', 'destroy target.*enchantment']);
      tags.push({
        name: 'permanent_removal',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Generic spot removal
    if (text.includes('destroy target') || text.includes('exile target')) {
      const evidence = this.extractEvidence(text, ['destroy target', 'exile target']);
      tags.push({
        name: 'spot_removal',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === DAMAGE EFFECTS ===
    // Direct damage to creature
    if (text.includes('damage to target creature')) {
      const evidence = this.extractEvidence(text, ['damage to target creature']);
      tags.push({
        name: 'creature_damage',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Direct damage to player
    if (text.includes('damage to target player') || text.includes('damage to any target')) {
      const evidence = this.extractEvidence(text, ['damage to target player', 'damage to any target']);
      tags.push({
        name: 'player_damage',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // General damage dealing
    if (text.includes('deal') && text.includes('damage to')) {
      const evidence = this.extractEvidence(text, ['deal.*damage to']);
      tags.push({
        name: 'damage_dealing',
        category: 'targeting',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === BOARD WIPES ===
    // Destroy all creatures
    if (text.includes('destroy all creatures')) {
      const evidence = this.extractEvidence(text, ['destroy all creatures']);
      tags.push({
        name: 'creature_board_wipe',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Destroy all artifacts/enchantments
    if (text.includes('destroy all artifacts') || text.includes('destroy all enchantments')) {
      const evidence = this.extractEvidence(text, ['destroy all artifacts', 'destroy all enchantments']);
      tags.push({
        name: 'permanent_board_wipe',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Generic board wipe
    if (text.includes('destroy all') || text.includes('exile all')) {
      const evidence = this.extractEvidence(text, ['destroy all', 'exile all']);
      tags.push({
        name: 'board_wipe',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // === COUNTERSPELLS ===
    // Specific counter spell
    if (text.includes('counter target spell')) {
      const evidence = this.extractEvidence(text, ['counter target spell']);
      tags.push({
        name: 'counterspell',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Counter noncreature
    if (text.includes('counter target') && text.includes('noncreature')) {
      const evidence = this.extractEvidence(text, ['counter target.*noncreature']);
      tags.push({
        name: 'noncreature_counter',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Counter creature spell
    if (text.includes('counter target') && text.includes('creature')) {
      const evidence = this.extractEvidence(text, ['counter target.*creature']);
      tags.push({
        name: 'creature_counter',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === BOUNCE EFFECTS ===
    // Return to hand
    if (text.includes('return') && text.includes('to its owner\'s hand')) {
      const evidence = this.extractEvidence(text, ['return.*to.*hand']);
      tags.push({
        name: 'bounce_effect',
        category: 'targeting',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Return target to hand
    if (text.includes('return target') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['return target.*hand']);
      tags.push({
        name: 'targeted_bounce',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === TEMPORARY EFFECTS ===
    // Tap target
    if (text.includes('tap target')) {
      const evidence = this.extractEvidence(text, ['tap target']);
      tags.push({
        name: 'tap_target',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 5
      });
    }
    
    // Untap target
    if (text.includes('untap target')) {
      const evidence = this.extractEvidence(text, ['untap target']);
      tags.push({
        name: 'untap_target',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 5
      });
    }
    
    // === BUFF/DEBUFF EFFECTS ===
    // Target gets +N/+N
    if (text.includes('target') && text.includes('gets +')) {
      const evidence = this.extractEvidence(text, ['target.*gets \\+']);
      tags.push({
        name: 'target_buff',
        category: 'targeting',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Target gets -N/-N
    if (text.includes('target') && text.includes('gets -')) {
      const evidence = this.extractEvidence(text, ['target.*gets -']);
      tags.push({
        name: 'target_debuff',
        category: 'targeting',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === CONTROL EFFECTS ===
    // Gain control
    if (text.includes('gain control of target')) {
      const evidence = this.extractEvidence(text, ['gain control of target']);
      tags.push({
        name: 'control_magic',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === PROTECTIVE TARGETING ===
    // Target gains protection
    if (text.includes('target') && text.includes('protection')) {
      const evidence = this.extractEvidence(text, ['target.*protection']);
      tags.push({
        name: 'target_protection',
        category: 'targeting',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Target gains indestructible
    if (text.includes('target') && text.includes('indestructible')) {
      const evidence = this.extractEvidence(text, ['target.*indestructible']);
      tags.push({
        name: 'target_protection',
        category: 'targeting',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === MULTICAST TARGETING ===
    // Multiple targets
    if (text.includes('up to') && text.includes('target')) {
      const evidence = this.extractEvidence(text, ['up to.*target']);
      tags.push({
        name: 'multitarget',
        category: 'targeting',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Choose targets
    if (text.includes('choose') && text.includes('target')) {
      const evidence = this.extractEvidence(text, ['choose.*target']);
      tags.push({
        name: 'selective_targeting',
        category: 'targeting',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === GENERIC TARGETING ===
    // Any targeting ability
    if (text.includes('target')) {
      const evidence = this.extractEvidence(text, ['target']);
      tags.push({
        name: 'targeting_ability',
        category: 'targeting',
        confidence: 0.8,
        evidence,
        priority: 4
      });
    }
    
    return tags;
  }
  
  /**
   * Detect movement and zone-change mechanics
   */
  private detectMovementMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // Flicker/blink
    if ((text.includes('exile') && text.includes('return')) || text.includes('flicker')) {
      const evidence = this.extractEvidence(text, ['exile.*return', 'flicker']);
      tags.push({
        name: 'flicker_effect',
        category: 'movement',
        confidence: 0.9,
        evidence,
        priority: 7
      });
      
      // ENHANCED: For cards that repeatedly enter/leave (like Norin), they enable ETB synergies
      if (text.includes('return') && text.includes('battlefield') && 
          (text.includes('end step') || text.includes('next end step'))) {
        tags.push({
          name: 'etb_enabler',
          category: 'synergy_enabler',
          confidence: 0.95,
          evidence: evidence.concat(['return.*battlefield', 'end step']),
          priority: 8
        });
      }
    }
    
    // Reanimation
    if (text.includes('return') && text.includes('graveyard') && text.includes('battlefield')) {
      const evidence = this.extractEvidence(text, ['return.*graveyard.*battlefield']);
      tags.push({
        name: 'reanimation',
        category: 'movement',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Graveyard to hand
    if (text.includes('return') && text.includes('graveyard') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['return.*graveyard.*hand']);
      tags.push({
        name: 'graveyard_recursion',
        category: 'movement',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Cheating into play
    if (text.includes('put') && text.includes('battlefield') && !text.includes('token')) {
      const evidence = this.extractEvidence(text, ['put.*battlefield']);
      tags.push({
        name: 'cheat_into_play',
        category: 'movement',
        confidence: 0.8,
        evidence,
        priority: 8
      });
    }
    
    return tags;
  }
  
  /**
   * Detect counter mechanics
   */
  private detectCounterMechanics(text: string, typeLine: string, name: string = ''): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // +1/+1 counters
    if (text.includes('+1/+1 counter')) {
      const evidence = this.extractEvidence(text, ['\\+1/\\+1 counter']);
      tags.push({
        name: 'plus_one_counters',
        category: 'counters',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Counter manipulation
    if (text.includes('proliferate') || text.includes('counter') && (text.includes('add') || text.includes('remove'))) {
      const evidence = this.extractEvidence(text, ['proliferate', 'add.*counter', 'remove.*counter']);
      tags.push({
        name: 'counter_manipulation',
        category: 'counters',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // SPECIFIC CARD DETECTION for nuanced tagging
    // Doubling Season - doubles BOTH tokens and counters (including planeswalker loyalty)
    if (name.includes('doubling season')) {
      tags.push({
        name: 'token_doubling',
        category: 'tokens',
        confidence: 1.0,
        evidence: ['If an effect would create one or more tokens', 'that many of those tokens instead'],
        priority: 10
      });
      tags.push({
        name: 'counter_doubling_all_types',
        category: 'counters',
        confidence: 1.0,
        evidence: ['If an effect would put one or more counters', 'twice that many of those counters instead'],
        priority: 10
      });
      tags.push({
        name: 'planeswalker_loyalty_doubling',
        category: 'planeswalkers',
        confidence: 1.0,
        evidence: ['counters on a permanent', 'includes loyalty counters'],
        priority: 10
      });
    }
    // Parallel Lives - ONLY doubles tokens
    else if (name.includes('parallel lives')) {
      tags.push({
        name: 'token_doubling',
        category: 'tokens',
        confidence: 1.0,
        evidence: ['If an effect would create one or more tokens', 'twice that many of those tokens instead'],
        priority: 10
      });
      // NO counter doubling tag for Parallel Lives
    }
    // Primal Vigor - doubles tokens AND +1/+1 counters (not other counter types)
    else if (name.includes('primal vigor')) {
      tags.push({
        name: 'token_doubling',
        category: 'tokens',
        confidence: 1.0,
        evidence: ['If one or more tokens would be created', 'twice that many tokens are created instead'],
        priority: 10
      });
      tags.push({
        name: 'counter_doubling_plus_one_only',
        category: 'counters',
        confidence: 1.0,
        evidence: ['If one or more +1/+1 counters', 'twice that many +1/+1 counters'],
        priority: 10
      });
    }
    // Branching Evolution - ONLY doubles +1/+1 counters on creatures
    else if (name.includes('branching evolution')) {
      tags.push({
        name: 'counter_doubling_creature_plus_one',
        category: 'counters',
        confidence: 1.0,
        evidence: ['one or more +1/+1 counters would be put on a creature', 'twice that many instead'],
        priority: 10
      });
      // NO token doubling, NO planeswalker loyalty doubling
    }
    // Anointed Procession - ONLY doubles tokens (white version of Parallel Lives)
    else if (name.includes('anointed procession')) {
      tags.push({
        name: 'token_doubling',
        category: 'tokens',
        confidence: 1.0,
        evidence: ['If an effect would create one or more tokens', 'twice that many of those tokens instead'],
        priority: 10
      });
    }
    // Generic counter doubling detection
    else if ((text.includes('double') && text.includes('counter')) ||
             (text.includes('twice') && text.includes('counter')) ||
             (text.includes('puts twice that many') && text.includes('counter'))) {
      const evidence = this.extractEvidence(text, ['double.*counter', 'twice.*counter', 'puts twice that many.*counter']);
      
      // Try to determine what type of counters
      if (text.includes('+1/+1 counter')) {
        tags.push({
          name: 'counter_doubling_plus_one_only',
          category: 'counters',
          confidence: 0.9,
          evidence,
          priority: 9
        });
      } else {
        tags.push({
          name: 'counter_doubling_general',
          category: 'counters',
          confidence: 0.8,
          evidence,
          priority: 8
        });
      }
    }
    // Single counter addition (good but not as powerful)
    else if ((text.includes('additional +1/+1 counter') && !text.includes('double')) ||
             (text.includes('an additional +1/+1 counter')) ||
             (text.includes('enters with an additional +1/+1 counter')) ||
             name.includes('hardened scales') ||
             name.includes('long list of the ents')) {
      const evidence = this.extractEvidence(text, ['additional.*\\+1/\\+1 counter', 'an additional.*counter']);
      tags.push({
        name: 'counter_addition_single',
        category: 'counters',
        confidence: 0.9,
        evidence,
        priority: 6  // Lower priority for single additions
      });
    }
    
    // Experience counters
    if (text.includes('experience counter')) {
      const evidence = this.extractEvidence(text, ['experience counter']);
      tags.push({
        name: 'experience_counters',
        category: 'counters',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    return tags;
  }
  
  /**
   * Detect tribal mechanics - ONLY for cards that interact with specific creature types
   */
  private detectTribalMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // Comprehensive list of creature types to check for tribal interactions
    const tribalTypes = [
      'angel', 'demon', 'dragon', 'hydra', 'phoenix', 'sphinx', 'elemental', 'horror',
      'human', 'elf', 'dwarf', 'goblin', 'merfolk', 'vampire', 'werewolf', 'zombie', 'orc', 'giant', 'troll',
      'faerie', 'kithkin', 'kor', 'vedalken', 'leonin', 'wizard', 'cleric', 'warrior', 'rogue',
      'knight', 'soldier', 'shaman', 'druid', 'berserker', 'monk', 'ninja', 'samurai', 'pirate',
      'sliver', 'ally', 'eldrazi', 'dinosaur', 'cat', 'wolf', 'beast', 'bird', 'spider', 'snake',
      'spirit', 'skeleton', 'minotaur', 'centaur', 'satyr', 'treefolk', 'fungus', 'saproling',
      'artifact', 'enchantment', 'planeswalker', 'legendary' // Non-creature types that matter
    ];
    
    // Check for each tribal type - ONLY if the card mentions it in a way that shows interaction
    for (const tribe of tribalTypes) {
      // ENHANCED: Handle proper pluralization (elf->elves, etc.)
      const tribePlural = tribe === 'elf' ? 'elves' : 
                         tribe === 'dwarf' ? 'dwarves' : 
                         tribe + 's';
      
      const tribeRegex = new RegExp(`(${tribe}s?\\s+(you control|card|creature|spell|permanent)|${tribePlural}\\s+(you control|card|creature|spell|permanent)|other\\s+${tribe}s?|other\\s+${tribePlural}|create.*${tribe}.*token|choose.*${tribe}|${tribe}s?\\s+get|${tribePlural}\\s+get|${tribe}s?\\s+have|${tribePlural}\\s+have|${tribe}s?\\s+gain|each\\s+${tribe}|all\\s+${tribe}s?|number of\\s+${tribe}s?|number of\\s+${tribePlural}|${tribe}s?\\s+cost.*less|whenever.*${tribe}.*enters|where\\s+x\\s+is.*${tribe}s?|where\\s+x\\s+is.*${tribePlural}|draw.*${tribe}.*you\\s+control|draw.*${tribePlural}.*you\\s+control)`, 'i');
      
      if (tribeRegex.test(text)) {
        const evidence = this.extractEvidence(text, [tribe]);
        
        // ENHANCED: Determine if this is a positive interaction (tribal support) or just mentioning
        const isPositiveInteraction = 
          text.includes(`${tribe} get`) || text.includes(`${tribe}s get`) || text.includes(`${tribe} creatures get`) ||
          text.includes(`${tribe} have`) || text.includes(`${tribe}s have`) || text.includes(`${tribe} creatures have`) ||
          text.includes(`${tribe} gain`) || text.includes(`${tribe}s gain`) || text.includes(`${tribe} creatures gain`) ||
          text.includes(`other ${tribe}`) || text.includes(`other ${tribe}s`) || text.includes(`another ${tribe}`) ||
          text.includes(`${tribe} you control`) || text.includes(`${tribe}s you control`) || text.includes(`${tribe} creatures you control`) ||
          text.includes(`${tribe} cost`) || text.includes(`${tribe}s cost`) || text.includes(`${tribe} spells cost`) ||
          text.includes(`create`) && text.includes(`${tribe}`) && text.includes('token') ||
          text.includes(`number of ${tribe}`) || text.includes(`number of ${tribe}s`) || text.includes(`for each ${tribe}`) ||
          text.includes(`whenever`) && text.includes(`${tribe}`) && text.includes('enters') ||
          // NEW: "Caring about" patterns like Voja (where X is the number of Elves you control)
          text.includes(`where x is the number of ${tribe}`) || text.includes(`where x is.*${tribe}`) ||
          text.includes(`equal to the number of ${tribe}`) || 
          text.includes(`for each ${tribe} you control`) ||
          text.includes(`number of ${tribe}s you control`) || text.includes(`number of ${tribePlural} you control`) ||
          // NEW: Fixed pattern for Voja-style text
          text.includes(`${tribe}s you control`) || text.includes(`${tribePlural} you control`) ||
          // NEW: Draw/effect per tribe member (like Voja's card draw for Wolves)
          (text.includes(`draw`) && text.includes(`${tribe}`) && text.includes(`you control`)) ||
          (text.includes(`draw`) && text.includes(`${tribePlural}`) && text.includes(`you control`));
        
        if (isPositiveInteraction) {
          tags.push({
            name: `tribal_${tribe}`,
            category: 'tribal',
            confidence: 0.95,
            evidence,
            priority: 8
          });
          
          // ENHANCED: Also add a "X matters" tag for cards that scale with tribe count
          if (text.includes(`where x is`) && (text.includes(`${tribe}`) || text.includes(`${tribePlural}`)) ||
              text.includes(`for each ${tribe}`) || text.includes(`for each ${tribePlural}`) ||
              text.includes(`number of ${tribe}`) || text.includes(`number of ${tribePlural}`) ||
              text.includes(`${tribe}s you control`) || text.includes(`${tribePlural} you control`) ||
              (text.includes(`draw`) && text.includes(`${tribe}`) && text.includes(`you control`)) ||
              (text.includes(`draw`) && text.includes(`${tribePlural}`) && text.includes(`you control`))) {
            tags.push({
              name: `${tribe}_matters`,
              category: 'tribal_scaling',
              confidence: 0.95,
              evidence,
              priority: 9 // Higher priority for scaling effects
            });
          }
        }
      }
    }
    
    // Special case: "choose a creature type" cards (like Metallic Mimic, Adaptive Automaton)
    if (text.includes('choose a creature type') || text.includes('as') && text.includes('enters') && text.includes('choose')) {
      tags.push({
        name: 'tribal_choose_type',
        category: 'tribal',
        confidence: 0.9,
        evidence: this.extractEvidence(text, ['choose a creature type', 'choose a']),
        priority: 7
      });
    }
    
    // Lords that buff all creatures (not type-specific)
    if ((text.includes('creatures you control get') || text.includes('creatures you control have')) &&
        !tribalTypes.some(t => text.includes(`${t} creatures`) || text.includes(`${t}s`))) {
      tags.push({
        name: 'tribal_all_creatures',
        category: 'tribal',
        confidence: 0.8,
        evidence: this.extractEvidence(text, ['creatures you control']),
        priority: 6
      });
    }
    
    // COAT OF ARMS EFFECT - tribal anthem based on shared creature types
    if ((text.includes('shares') && text.includes('creature type')) ||
        (text.includes('same') && text.includes('creature type')) ||
        (text.includes('each other') && text.includes('creature') && text.includes('type'))) {
      const evidence = this.extractEvidence(text, ['shares.*creature type', 'same.*creature type', 'each other.*creature.*type']);
      tags.push({
        name: 'tribal_anthem_shared',
        category: 'tribal',
        confidence: 0.95,
        evidence,
        priority: 8
      });
      
      // Also add general tribal anthem tag
      tags.push({
        name: 'lord_effect',
        category: 'tribal',
        confidence: 0.9,
        evidence,
        priority: 7
      });
      
      // Global effect (affects all creatures, not just yours)
      if (text.includes('each creature') || !text.includes('you control')) {
        tags.push({
          name: 'global_anthem',
          category: 'global_effects',
          confidence: 0.9,
          evidence,
          priority: 6
        });
      }
    }
    
    // Conditional reveal requirements (cards that need specific types to function well)
    const revealPattern = /reveal.*?(\w+)\s+(?:card|creature)/gi;
    let match;
    while ((match = revealPattern.exec(text)) !== null) {
      const potentialType = match[1].toLowerCase();
      const creatureTypes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit',
        'wizard', 'warrior', 'soldier', 'beast', 'cat', 'vampire', 'merfolk', 'elemental', 'giant', 
        'dwarf', 'orc', 'treefolk', 'spider', 'snake', 'bird', 'fish', 'wolf', 'bear', 'elephant', 
        'horse', 'minotaur', 'hydra'];
      
      if (creatureTypes.includes(potentialType)) {
        const evidence = this.extractEvidence(text, [`reveal.*${potentialType}`]);
        tags.push({
          name: `requires_${potentialType}`,
          category: 'conditional_requirements',
          confidence: 0.95,
          evidence,
          priority: 8
        });
      }
    }
    
    return tags;
  }
  
  /**
   * Detect combat mechanics
   */
  private detectCombatMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === COMBAT KEYWORDS ===
    const combatKeywords = [
      'first strike', 'double strike', 'deathtouch', 'lifelink', 'trample', 
      'vigilance', 'haste', 'menace', 'intimidate', 'flying', 'reach',
      'hexproof', 'shroud', 'indestructible', 'protection'
    ];
    
    for (const keyword of combatKeywords) {
      if (text.includes(keyword)) {
        const evidence = this.extractEvidence(text, [keyword]);
        tags.push({
          name: keyword.replace(' ', '_'),
          category: 'combat',
          confidence: 0.95,
          evidence,
          priority: 6
        });
      }
    }
    
    // === EVASION ABILITIES ===
    // Flying
    if (text.includes('flying')) {
      const evidence = this.extractEvidence(text, ['flying']);
      tags.push({
        name: 'evasion_flying',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Unblockable
    if (text.includes('unblockable') || text.includes('can\'t be blocked')) {
      const evidence = this.extractEvidence(text, ['unblockable', 'can\'t be blocked']);
      tags.push({
        name: 'evasion_unblockable',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Shadow
    if (text.includes('shadow')) {
      const evidence = this.extractEvidence(text, ['shadow']);
      tags.push({
        name: 'evasion_shadow',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Horsemanship
    if (text.includes('horsemanship')) {
      const evidence = this.extractEvidence(text, ['horsemanship']);
      tags.push({
        name: 'evasion_horsemanship',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === COMBAT DAMAGE EFFECTS ===
    // Combat damage triggers
    if (text.includes('combat damage')) {
      const evidence = this.extractEvidence(text, ['combat damage']);
      tags.push({
        name: 'combat_damage_trigger',
        category: 'combat',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Combat damage to player
    if (text.includes('combat damage to a player')) {
      const evidence = this.extractEvidence(text, ['combat damage to a player']);
      tags.push({
        name: 'combat_damage_player_trigger',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === FIGHT MECHANICS ===
    // Fight
    if (text.includes('fight') || text.includes('fights')) {
      const evidence = this.extractEvidence(text, ['fight', 'fights']);
      tags.push({
        name: 'fight_mechanic',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ATTACK/BLOCK MANIPULATION ===
    // Must attack
    if (text.includes('must attack') || text.includes('attacks each')) {
      const evidence = this.extractEvidence(text, ['must attack', 'attacks each']);
      tags.push({
        name: 'forced_attack',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 5
      });
    }
    
    // Can't attack
    if (text.includes('can\'t attack')) {
      const evidence = this.extractEvidence(text, ['can\'t attack']);
      tags.push({
        name: 'attack_restriction',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 5
      });
    }
    
    // Can't block
    if (text.includes('can\'t block')) {
      const evidence = this.extractEvidence(text, ['can\'t block']);
      tags.push({
        name: 'block_restriction',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 5
      });
    }
    
    // Must be blocked
    if (text.includes('must be blocked')) {
      const evidence = this.extractEvidence(text, ['must be blocked']);
      tags.push({
        name: 'forced_block',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === COMBAT PHASES ===
    // Extra combat steps
    if (text.includes('extra combat') || text.includes('additional combat')) {
      const evidence = this.extractEvidence(text, ['extra combat', 'additional combat']);
      tags.push({
        name: 'extra_combat',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Skip combat
    if (text.includes('skip') && text.includes('combat')) {
      const evidence = this.extractEvidence(text, ['skip.*combat']);
      tags.push({
        name: 'skip_combat',
        category: 'combat',
        confidence: 0.9,
        evidence,
        priority: 5
      });
    }
    
    // === POWER/TOUGHNESS MODIFICATION ===
    // Gets +X/+X until end of turn
    if (text.includes('gets +') && text.includes('until end of turn')) {
      const evidence = this.extractEvidence(text, ['gets \\+.*until end of turn']);
      tags.push({
        name: 'temporary_pump',
        category: 'combat',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Power equals something
    if (text.includes('power is equal to') || text.includes('power and toughness are each equal to')) {
      const evidence = this.extractEvidence(text, ['power.*equal to', 'power and toughness.*equal to']);
      tags.push({
        name: 'variable_power_toughness',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === DAMAGE PREVENTION/REDIRECTION ===
    // Damage prevention
    if (text.includes('prevent') && text.includes('damage')) {
      const evidence = this.extractEvidence(text, ['prevent.*damage']);
      tags.push({
        name: 'damage_prevention',
        category: 'combat',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Damage redirection
    if (text.includes('instead') && text.includes('damage')) {
      const evidence = this.extractEvidence(text, ['instead.*damage']);
      tags.push({
        name: 'damage_redirection',
        category: 'combat',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === COMBAT TRIGGERS ===
    // Attack triggers
    if (text.includes('whenever') && text.includes('attacks')) {
      const evidence = this.extractEvidence(text, ['whenever.*attacks']);
      tags.push({
        name: 'attack_trigger',
        category: 'combat',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Block triggers
    if (text.includes('whenever') && text.includes('blocks')) {
      const evidence = this.extractEvidence(text, ['whenever.*blocks']);
      tags.push({
        name: 'block_trigger',
        category: 'combat',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Becomes blocked trigger
    if (text.includes('whenever') && text.includes('becomes blocked')) {
      const evidence = this.extractEvidence(text, ['whenever.*becomes blocked']);
      tags.push({
        name: 'becomes_blocked_trigger',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === SPECIAL COMBAT ABILITIES ===
    // Bushido
    if (text.includes('bushido')) {
      const evidence = this.extractEvidence(text, ['bushido']);
      tags.push({
        name: 'bushido',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Rampage
    if (text.includes('rampage')) {
      const evidence = this.extractEvidence(text, ['rampage']);
      tags.push({
        name: 'rampage',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Flanking
    if (text.includes('flanking')) {
      const evidence = this.extractEvidence(text, ['flanking']);
      tags.push({
        name: 'flanking',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Provoke
    if (text.includes('provoke')) {
      const evidence = this.extractEvidence(text, ['provoke']);
      tags.push({
        name: 'provoke',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Banding
    if (text.includes('banding')) {
      const evidence = this.extractEvidence(text, ['banding']);
      tags.push({
        name: 'banding',
        category: 'combat',
        confidence: 0.95,
        evidence,
        priority: 5
      });
    }
    
    return tags;
  }
  
  /**
   * Detect spell-related mechanics
   */
  private detectSpellMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === SPELL COPYING ===
    // Generic spell copy
    if (text.includes('copy') && (text.includes('spell') || text.includes('instant') || text.includes('sorcery'))) {
      const evidence = this.extractEvidence(text, ['copy.*spell', 'copy.*instant', 'copy.*sorcery']);
      tags.push({
        name: 'spell_copying',
        category: 'spells',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // Copy target spell
    if (text.includes('copy target') && text.includes('spell')) {
      const evidence = this.extractEvidence(text, ['copy target.*spell']);
      tags.push({
        name: 'targeted_spell_copy',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === STORM AND CASCADING ===
    // Storm
    if (text.includes('storm')) {
      const evidence = this.extractEvidence(text, ['storm']);
      tags.push({
        name: 'storm',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Cascade
    if (text.includes('cascade')) {
      const evidence = this.extractEvidence(text, ['cascade']);
      tags.push({
        name: 'cascade',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Ripple
    if (text.includes('ripple')) {
      const evidence = this.extractEvidence(text, ['ripple']);
      tags.push({
        name: 'ripple',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === SPELL RECURSION ===
    // Flashback
    if (text.includes('flashback')) {
      const evidence = this.extractEvidence(text, ['flashback']);
      tags.push({
        name: 'flashback',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Jump-start
    if (text.includes('jump-start')) {
      const evidence = this.extractEvidence(text, ['jump-start']);
      tags.push({
        name: 'jump_start',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Retrace
    if (text.includes('retrace')) {
      const evidence = this.extractEvidence(text, ['retrace']);
      tags.push({
        name: 'retrace',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Escape
    if (text.includes('escape')) {
      const evidence = this.extractEvidence(text, ['escape']);
      tags.push({
        name: 'escape',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === COST REDUCTION ===
    // Spell cost reduction
    if ((text.includes('instant') || text.includes('sorcery')) && text.includes('cost') && text.includes('less')) {
      const evidence = this.extractEvidence(text, ['instant.*cost.*less', 'sorcery.*cost.*less']);
      tags.push({
        name: 'spell_cost_reduction',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === SPELL TRIGGERS ===
    // Spells cast trigger
    if (text.includes('whenever you cast') && (text.includes('instant') || text.includes('sorcery'))) {
      const evidence = this.extractEvidence(text, ['whenever you cast.*instant', 'whenever you cast.*sorcery']);
      tags.push({
        name: 'spell_cast_trigger',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Noncreature spell trigger
    if (text.includes('whenever you cast') && text.includes('noncreature')) {
      const evidence = this.extractEvidence(text, ['whenever you cast.*noncreature']);
      tags.push({
        name: 'noncreature_spell_trigger',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === ALTERNATIVE COSTS ===
    // Overload
    if (text.includes('overload')) {
      const evidence = this.extractEvidence(text, ['overload']);
      tags.push({
        name: 'overload',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Kicker
    if (text.includes('kicker') || text.includes('multikicker')) {
      const evidence = this.extractEvidence(text, ['kicker', 'multikicker']);
      tags.push({
        name: 'kicker',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Buyback
    if (text.includes('buyback')) {
      const evidence = this.extractEvidence(text, ['buyback']);
      tags.push({
        name: 'buyback',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Entwine
    if (text.includes('entwine')) {
      const evidence = this.extractEvidence(text, ['entwine']);
      tags.push({
        name: 'entwine',
        category: 'spells',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === SPELL INTERACTION ===
    // Spell counter
    if (text.includes('counter') && text.includes('spell')) {
      const evidence = this.extractEvidence(text, ['counter.*spell']);
      tags.push({
        name: 'counterspell',
        category: 'spells',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // Spell redirect
    if (text.includes('change the target') || (text.includes('target') && text.includes('spell') && text.includes('instead'))) {
      const evidence = this.extractEvidence(text, ['change the target', 'target.*spell.*instead']);
      tags.push({
        name: 'spell_redirect',
        category: 'spells',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === SPELL ADVANTAGE ===
    // Draw cards on spell cast
    if ((text.includes('whenever you cast') || text.includes('when you cast')) && text.includes('draw')) {
      const evidence = this.extractEvidence(text, ['whenever you cast.*draw', 'when you cast.*draw']);
      tags.push({
        name: 'spell_card_advantage',
        category: 'spells',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Spell velocity
    if (text.includes('you may cast') && (text.includes('instant') || text.includes('sorcery'))) {
      const evidence = this.extractEvidence(text, ['you may cast.*instant', 'you may cast.*sorcery']);
      tags.push({
        name: 'spell_velocity',
        category: 'spells',
        confidence: 0.85,
        evidence,
        priority: 6
      });
    }
    
    // === X SPELLS ===
    if (text.includes('{x}') || text.includes('x is')) {
      const evidence = this.extractEvidence(text, ['\\{x\\}', 'x is']);
      tags.push({
        name: 'x_spell',
        category: 'spells',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    return tags;
  }
  
  /**
   * Detect artifact-specific mechanics
   */
  private detectArtifactMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === ARTIFACT TYPES ===
    if (typeLine.includes('artifact')) {
      // Equipment
      if (typeLine.includes('equipment')) {
        tags.push({
          name: 'equipment',
          category: 'artifacts',
          confidence: 0.95,
          evidence: ['Equipment'],
          priority: 7
        });
      }
      
      // Vehicles
      if (typeLine.includes('vehicle')) {
        tags.push({
          name: 'vehicle',
          category: 'artifacts',
          confidence: 0.95,
          evidence: ['Vehicle'],
          priority: 6
        });
      }
      
      // Treasure tokens
      if (typeLine.includes('treasure') || text.includes('treasure')) {
        const evidence = this.extractEvidence(text, ['treasure']);
        tags.push({
          name: 'treasure_artifact',
          category: 'artifacts',
          confidence: 0.95,
          evidence,
          priority: 7
        });
      }
      
      // Food tokens
      if (typeLine.includes('food') || text.includes('food')) {
        const evidence = this.extractEvidence(text, ['food']);
        tags.push({
          name: 'food_artifact',
          category: 'artifacts',
          confidence: 0.95,
          evidence,
          priority: 6
        });
      }
      
      // Clue tokens
      if (typeLine.includes('clue') || text.includes('clue')) {
        const evidence = this.extractEvidence(text, ['clue']);
        tags.push({
          name: 'clue_artifact',
          category: 'artifacts',
          confidence: 0.95,
          evidence,
          priority: 6
        });
      }
      
      // Blood tokens
      if (typeLine.includes('blood') || text.includes('blood')) {
        const evidence = this.extractEvidence(text, ['blood']);
        tags.push({
          name: 'blood_artifact',
          category: 'artifacts',
          confidence: 0.95,
          evidence,
          priority: 6
        });
      }
      
      // Powerstone tokens
      if (typeLine.includes('powerstone') || text.includes('powerstone')) {
        const evidence = this.extractEvidence(text, ['powerstone']);
        tags.push({
          name: 'powerstone_artifact',
          category: 'artifacts',
          confidence: 0.95,
          evidence,
          priority: 6
        });
      }
    }
    
    // === ARTIFACT INTERACTIONS ===
    // Artifact cost reduction
    if (text.includes('artifact') && text.includes('cost') && text.includes('less')) {
      const evidence = this.extractEvidence(text, ['artifact.*cost.*less']);
      tags.push({
        name: 'artifact_cost_reduction',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Artifact creation/tokens
    if (text.includes('create') && text.includes('artifact')) {
      const evidence = this.extractEvidence(text, ['create.*artifact']);
      tags.push({
        name: 'artifact_token_creation',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Artifact sacrifice
    if (text.includes('sacrifice') && text.includes('artifact')) {
      const evidence = this.extractEvidence(text, ['sacrifice.*artifact']);
      tags.push({
        name: 'artifact_sacrifice',
        category: 'artifacts',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Artifact recursion/return
    if (text.includes('return') && text.includes('artifact') && (text.includes('hand') || text.includes('battlefield'))) {
      const evidence = this.extractEvidence(text, ['return.*artifact.*hand', 'return.*artifact.*battlefield']);
      tags.push({
        name: 'artifact_recursion',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === ARTIFACT SYNERGIES ===
    // Artifacts you control
    if (text.includes('artifacts you control')) {
      const evidence = this.extractEvidence(text, ['artifacts you control']);
      tags.push({
        name: 'artifact_controller_synergy',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Artifact ETB triggers - handled in detectTriggerMechanics() to avoid duplication
    
    // Artifact count matters
    if (text.includes('number of artifacts') || (text.includes('for each artifact') && text.includes('you control'))) {
      const evidence = this.extractEvidence(text, ['number of artifacts', 'for each artifact.*you control']);
      tags.push({
        name: 'artifact_count_matters',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === METALCRAFT ===
    if (text.includes('metalcraft') || (text.includes('three or more artifacts') && text.includes('you control'))) {
      const evidence = this.extractEvidence(text, ['metalcraft', 'three or more artifacts.*you control']);
      tags.push({
        name: 'metalcraft',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === AFFINITY ===
    if (text.includes('affinity for artifacts')) {
      const evidence = this.extractEvidence(text, ['affinity for artifacts']);
      tags.push({
        name: 'affinity_artifacts',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === IMPROVISE ===
    if (text.includes('improvise')) {
      const evidence = this.extractEvidence(text, ['improvise']);
      tags.push({
        name: 'improvise',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ARTIFACT DESTRUCTION ===
    // Destroy artifacts
    if (text.includes('destroy') && text.includes('artifact')) {
      const evidence = this.extractEvidence(text, ['destroy.*artifact']);
      tags.push({
        name: 'artifact_destruction',
        category: 'artifacts',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === MODULAR ===
    if (text.includes('modular')) {
      const evidence = this.extractEvidence(text, ['modular']);
      tags.push({
        name: 'modular',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === LIVING WEAPON ===
    if (text.includes('living weapon')) {
      const evidence = this.extractEvidence(text, ['living weapon']);
      tags.push({
        name: 'living_weapon',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === FORTIFY ===
    if (text.includes('fortify')) {
      const evidence = this.extractEvidence(text, ['fortify']);
      tags.push({
        name: 'fortify',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === ARTIFACT TUTORING ===
    if (text.includes('search') && text.includes('library') && text.includes('artifact')) {
      const evidence = this.extractEvidence(text, ['search.*library.*artifact']);
      tags.push({
        name: 'artifact_tutor',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === MANA ARTIFACTS ===
    if (typeLine.includes('artifact') && (text.includes('add') && (text.includes('mana') || /\{[wubrg]\}/.test(text)))) {
      const evidence = this.extractEvidence(text, ['add.*mana', 'add.*\\{[wubrg]\\}']);
      tags.push({
        name: 'mana_artifact',
        category: 'artifacts',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ARTIFACT ANIMATION ===
    if (text.includes('becomes') && text.includes('creature') && (typeLine.includes('artifact') || text.includes('artifact'))) {
      const evidence = this.extractEvidence(text, ['becomes.*creature']);
      tags.push({
        name: 'artifact_animation',
        category: 'artifacts',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === GENERIC ARTIFACT SYNERGY ===
    if (text.includes('artifact') && !typeLine.includes('artifact')) {
      const evidence = this.extractEvidence(text, ['artifact']);
      tags.push({
        name: 'artifact_synergy',
        category: 'artifacts',
        confidence: 0.8,
        evidence,
        priority: 6
      });
    }
    
    return tags;
  }
  
  /**
   * Detect land-specific mechanics
   */
  private detectLandMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === LAND TYPES ===
    if (typeLine.includes('land')) {
      // Basic lands
      const basicTypes = ['plains', 'island', 'swamp', 'mountain', 'forest'];
      if (basicTypes.some(basic => typeLine.includes(basic))) {
        tags.push({
          name: 'basic_land',
          category: 'lands',
          confidence: 0.95,
          evidence: ['Basic Land'],
          priority: 5
        });
      } else {
        tags.push({
          name: 'nonbasic_land',
          category: 'lands',
          confidence: 0.95,
          evidence: ['Nonbasic Land'],
          priority: 6
        });
      }
      
      // Dual lands (produces two or more colors)
      if (text.includes('add') && (text.match(/\{[wubrg]\}/g) || []).length >= 2) {
        const evidence = this.extractEvidence(text, ['add.*\\{[wubrg]\\}.*\\{[wubrg]\\}']);
        tags.push({
          name: 'dual_land',
          category: 'lands',
          confidence: 0.9,
          evidence,
          priority: 7
        });
      }
      
      // Fetchlands
      if (text.includes('search') && text.includes('library') && (text.includes('basic') || text.includes('land'))) {
        const evidence = this.extractEvidence(text, ['search.*library.*basic', 'search.*library.*land']);
        tags.push({
          name: 'fetchland',
          category: 'lands',
          confidence: 0.95,
          evidence,
          priority: 8
        });
      }
      
      // Enters tapped
      if (text.includes('enters the battlefield tapped') || text.includes('enters tapped')) {
        const evidence = this.extractEvidence(text, ['enters.*tapped']);
        tags.push({
          name: 'enters_tapped_land',
          category: 'lands',
          confidence: 0.95,
          evidence,
          priority: 5
        });
      }
      
      // Utility lands (non-mana abilities)
      if ((text.includes('{t}:') || text.includes('tap:')) && !text.includes('add')) {
        const evidence = this.extractEvidence(text, ['\\{t\\}:', 'tap:']);
        tags.push({
          name: 'utility_land',
          category: 'lands',
          confidence: 0.9,
          evidence,
          priority: 7
        });
      }
      
      // Man-lands (becomes creature)
      if (text.includes('becomes') && text.includes('creature')) {
        const evidence = this.extractEvidence(text, ['becomes.*creature']);
        tags.push({
          name: 'manland',
          category: 'lands',
          confidence: 0.95,
          evidence,
          priority: 7
        });
      }
    }
    
    // === LANDFALL ===
    // Landfall detection moved to detectTriggerMechanics() to avoid duplication
    
    // === LAND RAMP ===
    // Put land onto battlefield
    if (text.includes('put') && text.includes('land') && text.includes('battlefield')) {
      const evidence = this.extractEvidence(text, ['put.*land.*battlefield']);
      tags.push({
        name: 'land_ramp',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Search for lands
    if (text.includes('search') && text.includes('library') && text.includes('land')) {
      const evidence = this.extractEvidence(text, ['search.*library.*land']);
      tags.push({
        name: 'land_tutor',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === LAND COUNT MATTERS ===
    if (text.includes('number of lands') || (text.includes('for each land') && text.includes('you control'))) {
      const evidence = this.extractEvidence(text, ['number of lands', 'for each land.*you control']);
      tags.push({
        name: 'land_count_matters',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === DOMAIN ===
    if (text.includes('domain') || text.includes('basic land types')) {
      const evidence = this.extractEvidence(text, ['domain', 'basic land types']);
      tags.push({
        name: 'domain',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === LAND DESTRUCTION ===
    if (text.includes('destroy') && text.includes('land')) {
      const evidence = this.extractEvidence(text, ['destroy.*land']);
      tags.push({
        name: 'land_destruction',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === LAND RETURN ===
    if (text.includes('return') && text.includes('land') && (text.includes('hand') || text.includes('battlefield'))) {
      const evidence = this.extractEvidence(text, ['return.*land.*hand', 'return.*land.*battlefield']);
      tags.push({
        name: 'land_recursion',
        category: 'lands',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === LAND SACRIFICE ===
    if (text.includes('sacrifice') && text.includes('land')) {
      const evidence = this.extractEvidence(text, ['sacrifice.*land']);
      tags.push({
        name: 'land_sacrifice',
        category: 'lands',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === EXTRA LAND DROPS ===
    if (text.includes('additional land') || text.includes('extra land') || text.includes('may play an additional')) {
      const evidence = this.extractEvidence(text, ['additional land', 'extra land', 'may play an additional']);
      tags.push({
        name: 'extra_land_drops',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === LANDS MATTER ===
    // Lands you control
    if (text.includes('lands you control')) {
      const evidence = this.extractEvidence(text, ['lands you control']);
      tags.push({
        name: 'lands_you_control_matters',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Land ETB triggers
    if ((text.includes('whenever') || text.includes('when')) && text.includes('land') && text.includes('enters')) {
      const evidence = this.extractEvidence(text, ['whenever.*land.*enters', 'when.*land.*enters']);
      tags.push({
        name: 'land_etb_trigger',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === SPECIFIC LAND TYPES ===
    // Desert lands
    if (typeLine.includes('desert') || text.includes('desert')) {
      const evidence = this.extractEvidence(text, ['desert']);
      tags.push({
        name: 'desert_land',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // Gate lands
    if (typeLine.includes('gate') || text.includes('gate')) {
      const evidence = this.extractEvidence(text, ['gate']);
      tags.push({
        name: 'gate_land',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === LAND TYPES MATTER ===
    // Basic land types
    const basicLandTypes = ['plains', 'island', 'swamp', 'mountain', 'forest'];
    for (const landType of basicLandTypes) {
      if (text.includes(landType) && !typeLine.includes(landType)) {
        const evidence = this.extractEvidence(text, [landType]);
        tags.push({
          name: `${landType}_matters`,
          category: 'lands',
          confidence: 0.8,
          evidence,
          priority: 6
        });
      }
    }
    
    // === BOUNCE LANDS ===
    if (text.includes('return') && text.includes('untapped') && text.includes('land')) {
      const evidence = this.extractEvidence(text, ['return.*untapped.*land']);
      tags.push({
        name: 'bounce_land',
        category: 'lands',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === CHANNEL ===
    if (text.includes('channel') && typeLine.includes('land')) {
      const evidence = this.extractEvidence(text, ['channel']);
      tags.push({
        name: 'channel_land',
        category: 'lands',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === GENERIC LAND SYNERGY ===
    if (text.includes('land') && !typeLine.includes('land')) {
      const evidence = this.extractEvidence(text, ['land']);
      tags.push({
        name: 'land_synergy',
        category: 'lands',
        confidence: 0.8,
        evidence,
        priority: 6
      });
    }
    
    return tags;
  }
  
  /**
   * Detect graveyard mechanics
   */
  private detectGraveyardMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === MILL/SELF-MILL ===
    // Basic mill
    if (text.includes('mill') || (text.includes('put') && text.includes('library') && text.includes('graveyard'))) {
      const evidence = this.extractEvidence(text, ['mill', 'put.*library.*graveyard']);
      tags.push({
        name: 'mill',
        category: 'graveyard',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Self-mill specifically
    if ((text.includes('put') && text.includes('your library') && text.includes('graveyard')) || 
        (text.includes('mill') && text.includes('yourself'))) {
      const evidence = this.extractEvidence(text, ['put.*your library.*graveyard', 'mill.*yourself']);
      tags.push({
        name: 'self_mill',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === REANIMATION ===
    // Return creature from graveyard to battlefield
    if (text.includes('return') && text.includes('graveyard') && text.includes('battlefield') && text.includes('creature')) {
      const evidence = this.extractEvidence(text, ['return.*creature.*graveyard.*battlefield']);
      tags.push({
        name: 'creature_reanimation',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Return any card from graveyard to battlefield
    if (text.includes('return') && text.includes('graveyard') && text.includes('battlefield')) {
      const evidence = this.extractEvidence(text, ['return.*graveyard.*battlefield']);
      tags.push({
        name: 'reanimation',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === GRAVEYARD TO HAND ===
    // Return to hand
    if (text.includes('return') && text.includes('graveyard') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['return.*graveyard.*hand']);
      tags.push({
        name: 'graveyard_recursion',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === GRAVEYARD TRIGGERS ===
    // When something enters graveyard
    if ((text.includes('whenever') || text.includes('when')) && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['whenever.*graveyard', 'when.*graveyard']);
      tags.push({
        name: 'graveyard_trigger',
        category: 'graveyard',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === GRAVEYARD COUNT MATTERS ===
    // Cards in graveyard
    if (text.includes('cards in') && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['cards in.*graveyard']);
      tags.push({
        name: 'graveyard_count_matters',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // For each card in graveyard
    if (text.includes('for each') && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['for each.*graveyard']);
      tags.push({
        name: 'graveyard_size_matters',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === THRESHOLD/DELIRIUM ===
    // Threshold
    if (text.includes('threshold') || (text.includes('seven or more cards') && text.includes('graveyard'))) {
      const evidence = this.extractEvidence(text, ['threshold', 'seven or more cards.*graveyard']);
      tags.push({
        name: 'threshold',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Delirium
    if (text.includes('delirium') || (text.includes('four or more') && text.includes('card types') && text.includes('graveyard'))) {
      const evidence = this.extractEvidence(text, ['delirium', 'four or more.*card types.*graveyard']);
      tags.push({
        name: 'delirium',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === DREDGE ===
    if (text.includes('dredge')) {
      const evidence = this.extractEvidence(text, ['dredge']);
      tags.push({
        name: 'dredge',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === FLASHBACK ===
    if (text.includes('flashback')) {
      const evidence = this.extractEvidence(text, ['flashback']);
      tags.push({
        name: 'flashback',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === DELVE ===
    if (text.includes('delve')) {
      const evidence = this.extractEvidence(text, ['delve']);
      tags.push({
        name: 'delve',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ESCAPE ===
    if (text.includes('escape')) {
      const evidence = this.extractEvidence(text, ['escape']);
      tags.push({
        name: 'escape',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === UNDERGROWTH ===
    if (text.includes('undergrowth') || (text.includes('creature cards') && text.includes('graveyard'))) {
      const evidence = this.extractEvidence(text, ['undergrowth', 'creature cards.*graveyard']);
      tags.push({
        name: 'undergrowth',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === EMBALM/ETERNALIZE ===
    if (text.includes('embalm') || text.includes('eternalize')) {
      const evidence = this.extractEvidence(text, ['embalm', 'eternalize']);
      tags.push({
        name: 'graveyard_token_creation',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === UNEARTH ===
    if (text.includes('unearth')) {
      const evidence = this.extractEvidence(text, ['unearth']);
      tags.push({
        name: 'unearth',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === GRAVEYARD HATE ===
    // Exile graveyard
    if (text.includes('exile') && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['exile.*graveyard']);
      tags.push({
        name: 'graveyard_hate',
        category: 'graveyard',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Exile cards from graveyards
    if (text.includes('exile') && text.includes('card') && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['exile.*card.*graveyard']);
      tags.push({
        name: 'targeted_graveyard_hate',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === GRAVEYARD SHUFFLE ===
    if (text.includes('shuffle') && text.includes('graveyard') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['shuffle.*graveyard.*library']);
      tags.push({
        name: 'graveyard_shuffle',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === MADNESS ===
    if (text.includes('madness')) {
      const evidence = this.extractEvidence(text, ['madness']);
      tags.push({
        name: 'madness',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === GRAVEYARD CAST ===
    // Cast from graveyard
    if (text.includes('cast') && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['cast.*graveyard']);
      tags.push({
        name: 'graveyard_casting',
        category: 'graveyard',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === DISTURB ===
    if (text.includes('disturb')) {
      const evidence = this.extractEvidence(text, ['disturb']);
      tags.push({
        name: 'disturb',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === RETRACE ===
    if (text.includes('retrace')) {
      const evidence = this.extractEvidence(text, ['retrace']);
      tags.push({
        name: 'retrace',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === JUMP-START ===
    if (text.includes('jump-start')) {
      const evidence = this.extractEvidence(text, ['jump-start']);
      tags.push({
        name: 'jump_start',
        category: 'graveyard',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === GENERIC GRAVEYARD SYNERGY ===
    if (text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['graveyard']);
      tags.push({
        name: 'graveyard_synergy',
        category: 'graveyard',
        confidence: 0.8,
        evidence,
        priority: 6
      });
    }
    
    return tags;
  }
  
  /**
   * Detect library mechanics
   */
  private detectLibraryMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === TUTORING ===
    // Generic tutoring
    if (text.includes('search your library for') || text.includes('search their library for')) {
      const evidence = this.extractEvidence(text, ['search.*library for']);
      tags.push({
        name: 'tutor',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Creature tutoring
    if (text.includes('search') && text.includes('library') && text.includes('creature')) {
      const evidence = this.extractEvidence(text, ['search.*library.*creature']);
      tags.push({
        name: 'creature_tutor',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Land tutoring
    if (text.includes('search') && text.includes('library') && text.includes('land')) {
      const evidence = this.extractEvidence(text, ['search.*library.*land']);
      tags.push({
        name: 'land_tutor',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Instant/Sorcery tutoring
    if (text.includes('search') && text.includes('library') && (text.includes('instant') || text.includes('sorcery'))) {
      const evidence = this.extractEvidence(text, ['search.*library.*instant', 'search.*library.*sorcery']);
      tags.push({
        name: 'spell_tutor',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Artifact tutoring
    if (text.includes('search') && text.includes('library') && text.includes('artifact')) {
      const evidence = this.extractEvidence(text, ['search.*library.*artifact']);
      tags.push({
        name: 'artifact_tutor',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Enchantment tutoring
    if (text.includes('search') && text.includes('library') && text.includes('enchantment')) {
      const evidence = this.extractEvidence(text, ['search.*library.*enchantment']);
      tags.push({
        name: 'enchantment_tutor',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === LIBRARY MANIPULATION ===
    // Scry
    if (text.includes('scry')) {
      const evidence = this.extractEvidence(text, ['scry']);
      tags.push({
        name: 'scry',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Surveil
    if (text.includes('surveil')) {
      const evidence = this.extractEvidence(text, ['surveil']);
      tags.push({
        name: 'surveil',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Look at top of library
    if (text.includes('look at') && text.includes('top') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['look at.*top.*library']);
      tags.push({
        name: 'library_peek',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Reveal top of library
    if (text.includes('reveal') && text.includes('top') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['reveal.*top.*library']);
      tags.push({
        name: 'library_reveal',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === LIBRARY ORDERING ===
    // Put on top of library
    if (text.includes('put') && text.includes('top') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['put.*top.*library']);
      tags.push({
        name: 'library_top_manipulation',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Put on bottom of library
    if (text.includes('put') && text.includes('bottom') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['put.*bottom.*library']);
      tags.push({
        name: 'library_bottom_manipulation',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Shuffle library
    if (text.includes('shuffle') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['shuffle.*library']);
      tags.push({
        name: 'library_shuffle',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 5
      });
    }
    
    // === MIRACLE ===
    if (text.includes('miracle')) {
      const evidence = this.extractEvidence(text, ['miracle']);
      tags.push({
        name: 'miracle',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === FATESEAL ===
    if (text.includes('fateseal')) {
      const evidence = this.extractEvidence(text, ['fateseal']);
      tags.push({
        name: 'fateseal',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === LIBRARY EXILE ===
    // Exile from library
    if (text.includes('exile') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['exile.*library']);
      tags.push({
        name: 'library_exile',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === LIBRARY COUNT MATTERS ===
    // Cards in library
    if (text.includes('cards in') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['cards in.*library']);
      tags.push({
        name: 'library_count_matters',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === TOP DECK MATTERS ===
    // If top card is
    if (text.includes('if') && text.includes('top card') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['if.*top card.*library']);
      tags.push({
        name: 'top_deck_matters',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === LIBRARY TRIGGERS ===
    // When you draw
    if ((text.includes('whenever') || text.includes('when')) && text.includes('draw')) {
      const evidence = this.extractEvidence(text, ['whenever.*draw', 'when.*draw']);
      tags.push({
        name: 'draw_trigger',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === CARD DRAW ===
    // Draw cards
    if (text.includes('draw') && text.includes('card')) {
      const evidence = this.extractEvidence(text, ['draw.*card']);
      tags.push({
        name: 'card_draw',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Draw additional cards
    if (text.includes('draw') && (text.includes('additional') || text.includes('extra'))) {
      const evidence = this.extractEvidence(text, ['draw.*additional', 'draw.*extra']);
      tags.push({
        name: 'extra_card_draw',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === LIBRARY REPLACEMENT ===
    // Instead of drawing
    if (text.includes('instead of drawing')) {
      const evidence = this.extractEvidence(text, ['instead of drawing']);
      tags.push({
        name: 'draw_replacement',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === LIBRARY CAST ===
    // Play/cast from library
    if ((text.includes('play') || text.includes('cast')) && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['play.*library', 'cast.*library']);
      tags.push({
        name: 'library_casting',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === EXPLORE ===
    if (text.includes('explore')) {
      const evidence = this.extractEvidence(text, ['explore']);
      tags.push({
        name: 'explore',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === TRANSMUTE ===
    if (text.includes('transmute')) {
      const evidence = this.extractEvidence(text, ['transmute']);
      tags.push({
        name: 'transmute',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === HIDEAWAY ===
    if (text.includes('hideaway')) {
      const evidence = this.extractEvidence(text, ['hideaway']);
      tags.push({
        name: 'hideaway',
        category: 'library',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === GENERIC LIBRARY SYNERGY ===
    if (text.includes('library')) {
      const evidence = this.extractEvidence(text, ['library']);
      tags.push({
        name: 'library_synergy',
        category: 'library',
        confidence: 0.8,
        evidence,
        priority: 5
      });
    }
    
    return tags;
  }
  
  /**
   * Detect hand mechanics
   */
  private detectHandMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === DISCARD EFFECTS ===
    // Self discard
    if (text.includes('discard') && (text.includes('you') || text.includes('your'))) {
      const evidence = this.extractEvidence(text, ['discard.*you', 'discard.*your']);
      tags.push({
        name: 'self_discard',
        category: 'hand',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Forced discard (opponents)
    if (text.includes('discard') && (text.includes('target') || text.includes('each opponent') || text.includes('all players'))) {
      const evidence = this.extractEvidence(text, ['discard.*target', 'discard.*opponent', 'discard.*player']);
      tags.push({
        name: 'forced_discard',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Random discard
    if (text.includes('discard') && text.includes('random')) {
      const evidence = this.extractEvidence(text, ['discard.*random']);
      tags.push({
        name: 'random_discard',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Generic discard
    if (text.includes('discard')) {
      const evidence = this.extractEvidence(text, ['discard']);
      tags.push({
        name: 'discard',
        category: 'hand',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === HAND SIZE MATTERS ===
    // Cards in hand
    if (text.includes('cards in') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['cards in.*hand']);
      tags.push({
        name: 'hand_size_matters',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // For each card in hand
    if (text.includes('for each card') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['for each card.*hand']);
      tags.push({
        name: 'hand_count_scaling',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === HAND LIMIT ===
    // No maximum hand size
    if (text.includes('no maximum hand size') || text.includes('unlimited hand size')) {
      const evidence = this.extractEvidence(text, ['no maximum hand size', 'unlimited hand size']);
      tags.push({
        name: 'unlimited_hand_size',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Maximum hand size
    if (text.includes('maximum hand size')) {
      const evidence = this.extractEvidence(text, ['maximum hand size']);
      tags.push({
        name: 'hand_size_modification',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === HAND REVEAL ===
    // Reveal hand
    if (text.includes('reveal') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['reveal.*hand']);
      tags.push({
        name: 'hand_reveal',
        category: 'hand',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Look at hand
    if (text.includes('look at') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['look at.*hand']);
      tags.push({
        name: 'hand_peek',
        category: 'hand',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === MADNESS ===
    if (text.includes('madness')) {
      const evidence = this.extractEvidence(text, ['madness']);
      tags.push({
        name: 'madness',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === CYCLING ===
    if (text.includes('cycling')) {
      const evidence = this.extractEvidence(text, ['cycling']);
      tags.push({
        name: 'cycling',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === DISCARD TRIGGERS ===
    // When you discard
    if ((text.includes('whenever') || text.includes('when')) && text.includes('discard')) {
      const evidence = this.extractEvidence(text, ['whenever.*discard', 'when.*discard']);
      tags.push({
        name: 'discard_trigger',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === HAND RETURN ===
    // Return to hand
    if (text.includes('return') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['return.*hand']);
      tags.push({
        name: 'return_to_hand',
        category: 'hand',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === HAND ADVANTAGES ===
    // Draw cards
    if (text.includes('draw') && text.includes('card')) {
      const evidence = this.extractEvidence(text, ['draw.*card']);
      tags.push({
        name: 'card_advantage',
        category: 'hand',
        confidence: 0.85,
        evidence,
        priority: 6
      });
    }
    
    // === HELLBENT ===
    if (text.includes('hellbent') || (text.includes('no cards') && text.includes('hand'))) {
      const evidence = this.extractEvidence(text, ['hellbent', 'no cards.*hand']);
      tags.push({
        name: 'hellbent',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === HAND MANIPULATION ===
    // Choose cards from hand
    if (text.includes('choose') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['choose.*hand']);
      tags.push({
        name: 'hand_selection',
        category: 'hand',
        confidence: 0.85,
        evidence,
        priority: 5
      });
    }
    
    // === SUSPEND ===
    if (text.includes('suspend')) {
      const evidence = this.extractEvidence(text, ['suspend']);
      tags.push({
        name: 'suspend',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === FLASHBACK ===
    if (text.includes('flashback')) {
      const evidence = this.extractEvidence(text, ['flashback']);
      tags.push({
        name: 'flashback_hand',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === FORECAST ===
    if (text.includes('forecast')) {
      const evidence = this.extractEvidence(text, ['forecast']);
      tags.push({
        name: 'forecast',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === HAND COST REDUCTION ===
    // Cost less if in hand
    if (text.includes('cost') && text.includes('less') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['cost.*less.*hand']);
      tags.push({
        name: 'hand_cost_reduction',
        category: 'hand',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === CHANNEL ===
    if (text.includes('channel')) {
      const evidence = this.extractEvidence(text, ['channel']);
      tags.push({
        name: 'channel',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === EVOKE ===
    if (text.includes('evoke')) {
      const evidence = this.extractEvidence(text, ['evoke']);
      tags.push({
        name: 'evoke',
        category: 'hand',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === HAND SYNERGY GENERIC ===
    if (text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['hand']);
      tags.push({
        name: 'hand_synergy',
        category: 'hand',
        confidence: 0.75,
        evidence,
        priority: 5
      });
    }
    
    return tags;
  }
  
  /**
   * Detect exile mechanics
   */
  private detectExileMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === EXILE REMOVAL ===
    // Exile target
    if (text.includes('exile target')) {
      const evidence = this.extractEvidence(text, ['exile target']);
      tags.push({
        name: 'exile_removal',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Exile permanents
    if (text.includes('exile') && (text.includes('permanent') || text.includes('creature') || text.includes('artifact') || text.includes('enchantment'))) {
      const evidence = this.extractEvidence(text, ['exile.*permanent', 'exile.*creature', 'exile.*artifact', 'exile.*enchantment']);
      tags.push({
        name: 'permanent_exile',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === TEMPORARY EXILE ===
    // Flicker/blink effects
    if ((text.includes('exile') && text.includes('return')) || text.includes('flicker') || text.includes('blink')) {
      const evidence = this.extractEvidence(text, ['exile.*return', 'flicker', 'blink']);
      tags.push({
        name: 'flicker_effect',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Exile until end of turn
    if (text.includes('exile') && text.includes('until end of turn')) {
      const evidence = this.extractEvidence(text, ['exile.*until end of turn']);
      tags.push({
        name: 'temporary_exile',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === EXILE FROM ZONES ===
    // Exile from graveyard
    if (text.includes('exile') && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['exile.*graveyard']);
      tags.push({
        name: 'graveyard_exile',
        category: 'exile',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Exile from library
    if (text.includes('exile') && text.includes('library')) {
      const evidence = this.extractEvidence(text, ['exile.*library']);
      tags.push({
        name: 'library_exile',
        category: 'exile',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // Exile from hand
    if (text.includes('exile') && text.includes('hand')) {
      const evidence = this.extractEvidence(text, ['exile.*hand']);
      tags.push({
        name: 'hand_exile',
        category: 'exile',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === EXILE CASTING ===
    // Cast from exile
    if ((text.includes('cast') || text.includes('play')) && text.includes('exile')) {
      const evidence = this.extractEvidence(text, ['cast.*exile', 'play.*exile']);
      tags.push({
        name: 'exile_casting',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Exile and may cast
    if (text.includes('exile') && text.includes('may cast')) {
      const evidence = this.extractEvidence(text, ['exile.*may cast']);
      tags.push({
        name: 'exile_may_cast',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === SUSPEND ===
    if (text.includes('suspend')) {
      const evidence = this.extractEvidence(text, ['suspend']);
      tags.push({
        name: 'suspend',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === IMPRINT ===
    if (text.includes('imprint')) {
      const evidence = this.extractEvidence(text, ['imprint']);
      tags.push({
        name: 'imprint',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === HIDEAWAY ===
    if (text.includes('hideaway')) {
      const evidence = this.extractEvidence(text, ['hideaway']);
      tags.push({
        name: 'hideaway',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ADVENTURE ===
    if (text.includes('adventure')) {
      const evidence = this.extractEvidence(text, ['adventure']);
      tags.push({
        name: 'adventure',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === FORETELL ===
    if (text.includes('foretell')) {
      const evidence = this.extractEvidence(text, ['foretell']);
      tags.push({
        name: 'foretell',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === EXILE TRIGGERS ===
    // When exiled
    if ((text.includes('whenever') || text.includes('when')) && text.includes('exile')) {
      const evidence = this.extractEvidence(text, ['whenever.*exile', 'when.*exile']);
      tags.push({
        name: 'exile_trigger',
        category: 'exile',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === EXILE COUNT MATTERS ===
    // Cards in exile
    if (text.includes('cards') && text.includes('exile')) {
      const evidence = this.extractEvidence(text, ['cards.*exile']);
      tags.push({
        name: 'exile_count_matters',
        category: 'exile',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === EXILE AS COST ===
    // Exile as additional cost
    if (text.includes('exile') && (text.includes('additional cost') || text.includes('as an additional cost'))) {
      const evidence = this.extractEvidence(text, ['exile.*additional cost']);
      tags.push({
        name: 'exile_cost',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === DELVE ===
    if (text.includes('delve')) {
      const evidence = this.extractEvidence(text, ['delve']);
      tags.push({
        name: 'delve',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ESCAPE ===
    if (text.includes('escape')) {
      const evidence = this.extractEvidence(text, ['escape']);
      tags.push({
        name: 'escape',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === EXILE RETURN ===
    // Return from exile
    if (text.includes('return') && text.includes('exile')) {
      const evidence = this.extractEvidence(text, ['return.*exile']);
      tags.push({
        name: 'exile_return',
        category: 'exile',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === EXILE FACE DOWN ===
    if (text.includes('exile') && text.includes('face down')) {
      const evidence = this.extractEvidence(text, ['exile.*face down']);
      tags.push({
        name: 'exile_face_down',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === EXILE WITH COUNTERS ===
    if (text.includes('exile') && text.includes('counter')) {
      const evidence = this.extractEvidence(text, ['exile.*counter']);
      tags.push({
        name: 'exile_with_counters',
        category: 'exile',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === MANIFEST ===
    if (text.includes('manifest')) {
      const evidence = this.extractEvidence(text, ['manifest']);
      tags.push({
        name: 'manifest',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === MORPH ===
    if (text.includes('morph')) {
      const evidence = this.extractEvidence(text, ['morph']);
      tags.push({
        name: 'morph',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === EXILE ZONE INTERACTION ===
    // Exile zone matters
    if (text.includes('exiled') || (text.includes('exile') && text.includes('zone'))) {
      const evidence = this.extractEvidence(text, ['exiled', 'exile.*zone']);
      tags.push({
        name: 'exile_zone_matters',
        category: 'exile',
        confidence: 0.85,
        evidence,
        priority: 6
      });
    }
    
    // === SPLIT SECOND ===
    if (text.includes('split second')) {
      const evidence = this.extractEvidence(text, ['split second']);
      tags.push({
        name: 'split_second',
        category: 'exile',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === EXILE REPLACEMENT ===
    // Instead of going to graveyard, exile
    if (text.includes('instead') && text.includes('exile')) {
      const evidence = this.extractEvidence(text, ['instead.*exile']);
      tags.push({
        name: 'exile_replacement',
        category: 'exile',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === GENERIC EXILE SYNERGY ===
    if (text.includes('exile')) {
      const evidence = this.extractEvidence(text, ['exile']);
      tags.push({
        name: 'exile_synergy',
        category: 'exile',
        confidence: 0.8,
        evidence,
        priority: 5
      });
    }
    
    return tags;
  }
  
  /**
   * Detect win condition mechanics
   */
  private detectWinConditions(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === DIRECT WIN CONDITIONS ===
    // You win the game
    if (text.includes('you win the game')) {
      const evidence = this.extractEvidence(text, ['you win the game']);
      tags.push({
        name: 'win_condition_direct',
        category: 'win_conditions',
        confidence: 0.95,
        evidence,
        priority: 10
      });
    }
    
    // Opponent loses the game
    if (text.includes('loses the game') || text.includes('lose the game')) {
      const evidence = this.extractEvidence(text, ['loses the game', 'lose the game']);
      tags.push({
        name: 'lose_condition_direct',
        category: 'win_conditions',
        confidence: 0.95,
        evidence,
        priority: 10
      });
    }
    
    // === ALTERNATE WIN CONDITIONS ===
    // Laboratory Maniac style
    if ((text.includes('draw') && text.includes('empty library')) || text.includes('library has no cards')) {
      const evidence = this.extractEvidence(text, ['draw.*empty library', 'library has no cards']);
      tags.push({
        name: 'empty_library_win',
        category: 'win_conditions',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Poison/infect win
    if (text.includes('poison') || text.includes('infect')) {
      const evidence = this.extractEvidence(text, ['poison', 'infect']);
      tags.push({
        name: 'poison_win',
        category: 'win_conditions',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // Mill win condition
    if (text.includes('mill') || (text.includes('library') && text.includes('graveyard'))) {
      const evidence = this.extractEvidence(text, ['mill', 'library.*graveyard']);
      tags.push({
        name: 'mill_win',
        category: 'win_conditions',
        confidence: 0.8,
        evidence,
        priority: 7
      });
    }
    
    // === COMBAT WIN CONDITIONS ===
    // Commander damage
    if (text.includes('commander damage') || (text.includes('21') && text.includes('damage'))) {
      const evidence = this.extractEvidence(text, ['commander damage', '21.*damage']);
      tags.push({
        name: 'commander_damage_win',
        category: 'win_conditions',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // Voltron strategy
    if ((text.includes('equipped') && text.includes('gets +')) || 
        (text.includes('aura') && text.includes('gets +')) ||
        text.includes('double strike')) {
      const evidence = this.extractEvidence(text, ['equipped.*gets \\+', 'aura.*gets \\+', 'double strike']);
      tags.push({
        name: 'voltron_win',
        category: 'win_conditions',
        confidence: 0.8,
        evidence,
        priority: 7
      });
    }
    
    // === COMBO WIN CONDITIONS ===
    // Infinite combinations
    if (text.includes('infinite') || 
        (text.includes('untap') && text.includes('tap')) ||
        (text.includes('whenever') && text.includes('enters') && text.includes('create'))) {
      const evidence = this.extractEvidence(text, ['infinite', 'untap.*tap', 'whenever.*enters.*create']);
      tags.push({
        name: 'combo_enabler',
        category: 'win_conditions',
        confidence: 0.7,
        evidence,
        priority: 7
      });
    }
    
    // === LIFE TOTAL WIN CONDITIONS ===
    // Lifegain win
    if ((text.includes('life') && text.includes('40')) || 
        (text.includes('lifegain') && text.includes('win'))) {
      const evidence = this.extractEvidence(text, ['life.*40', 'lifegain.*win']);
      tags.push({
        name: 'lifegain_win',
        category: 'win_conditions',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // Burn/damage win
    if (text.includes('deal') && text.includes('damage') && 
        (text.includes('each opponent') || text.includes('all opponents'))) {
      const evidence = this.extractEvidence(text, ['deal.*damage.*opponent']);
      tags.push({
        name: 'burn_win',
        category: 'win_conditions',
        confidence: 0.8,
        evidence,
        priority: 7
      });
    }
    
    // === THRESHOLD WIN CONDITIONS ===
    // Creature count win
    if ((text.includes('creatures') && text.includes('you control') && text.includes('10')) ||
        text.includes('overrun')) {
      const evidence = this.extractEvidence(text, ['creatures.*you control.*10', 'overrun']);
      tags.push({
        name: 'creature_swarm_win',
        category: 'win_conditions',
        confidence: 0.8,
        evidence,
        priority: 7
      });
    }
    
    // Artifact count win
    if (text.includes('artifacts') && text.includes('you control') && 
        (text.includes('20') || text.includes('15'))) {
      const evidence = this.extractEvidence(text, ['artifacts.*you control.*(20|15)']);
      tags.push({
        name: 'artifact_count_win',
        category: 'win_conditions',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // === CARD SPECIFIC WIN CONDITIONS ===
    // Door to Nothingness style
    if (text.includes('target player loses the game')) {
      const evidence = this.extractEvidence(text, ['target player loses the game']);
      tags.push({
        name: 'targeted_player_loss',
        category: 'win_conditions',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Coalition Victory style
    if (text.includes('each basic land type') && text.includes('win')) {
      const evidence = this.extractEvidence(text, ['each basic land type.*win']);
      tags.push({
        name: 'domain_win',
        category: 'win_conditions',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Test of Endurance style
    if (text.includes('50 or more life')) {
      const evidence = this.extractEvidence(text, ['50 or more life']);
      tags.push({
        name: 'high_life_win',
        category: 'win_conditions',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // Mortal Combat style
    if (text.includes('20 or more creature cards') && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['20 or more creature cards.*graveyard']);
      tags.push({
        name: 'graveyard_count_win',
        category: 'win_conditions',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    // === STAX/CONTROL WIN CONDITIONS ===
    // Prison effects
    if (text.includes('can\'t') && (text.includes('cast') || text.includes('attack') || text.includes('activate'))) {
      const evidence = this.extractEvidence(text, ['can\'t.*cast', 'can\'t.*attack', 'can\'t.*activate']);
      tags.push({
        name: 'prison_effect',
        category: 'win_conditions',
        confidence: 0.7,
        evidence,
        priority: 6
      });
    }
    
    // Resource denial
    if (text.includes('destroy all lands') || text.includes('sacrifice all lands')) {
      const evidence = this.extractEvidence(text, ['destroy all lands', 'sacrifice all lands']);
      tags.push({
        name: 'resource_denial',
        category: 'win_conditions',
        confidence: 0.8,
        evidence,
        priority: 6
      });
    }
    
    // === PLANESWALKER WIN CONDITIONS ===
    // Planeswalker ultimate
    if ((text.includes('-') && text.includes(':')) && 
        (text.includes('win') || text.includes('emblem'))) {
      const evidence = this.extractEvidence(text, ['-.*:.*win', '-.*:.*emblem']);
      tags.push({
        name: 'planeswalker_ultimate_win',
        category: 'win_conditions',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // === TOKEN WIN CONDITIONS ===
    // Mass token creation
    if (text.includes('create') && text.includes('token') && 
        (text.includes('X') || text.includes('equal to'))) {
      const evidence = this.extractEvidence(text, ['create.*token.*(X|equal to)']);
      tags.push({
        name: 'token_swarm_win',
        category: 'win_conditions',
        confidence: 0.7,
        evidence,
        priority: 6
      });
    }
    
    // === DAMAGE MULTIPLIERS ===
    // Damage doubling
    if (text.includes('double') && text.includes('damage')) {
      const evidence = this.extractEvidence(text, ['double.*damage']);
      tags.push({
        name: 'damage_amplification',
        category: 'win_conditions',
        confidence: 0.8,
        evidence,
        priority: 7
      });
    }
    
    // Extra combat steps
    if (text.includes('additional combat') || text.includes('extra combat')) {
      const evidence = this.extractEvidence(text, ['additional combat', 'extra combat']);
      tags.push({
        name: 'extra_combat_win',
        category: 'win_conditions',
        confidence: 0.8,
        evidence,
        priority: 7
      });
    }
    
    // === SPECIFIC MECHANICS ===
    // Storm win
    if (text.includes('storm')) {
      const evidence = this.extractEvidence(text, ['storm']);
      tags.push({
        name: 'storm_win',
        category: 'win_conditions',
        confidence: 0.8,
        evidence,
        priority: 7
      });
    }
    
    // Cascade win
    if (text.includes('cascade')) {
      const evidence = this.extractEvidence(text, ['cascade']);
      tags.push({
        name: 'cascade_win',
        category: 'win_conditions',
        confidence: 0.7,
        evidence,
        priority: 6
      });
    }
    
    return tags;
  }
  
  /**
   * Detect protection and prevention mechanics
   */
  private detectProtectionMechanics(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === PROTECTION ABILITIES ===
    // Protection from color
    if (text.includes('protection from')) {
      const evidence = this.extractEvidence(text, ['protection from']);
      tags.push({
        name: 'protection',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
      
      // Specific color protection
      const colors = ['white', 'blue', 'black', 'red', 'green'];
      for (const color of colors) {
        if (text.includes(`protection from ${color}`)) {
          const evidence = this.extractEvidence(text, [`protection from ${color}`]);
          tags.push({
            name: `protection_from_${color}`,
            category: 'protection',
            confidence: 0.95,
            evidence,
            priority: 8
          });
        }
      }
      
      // Protection from everything
      if (text.includes('protection from everything')) {
        const evidence = this.extractEvidence(text, ['protection from everything']);
        tags.push({
          name: 'protection_from_everything',
          category: 'protection',
          confidence: 0.95,
          evidence,
          priority: 9
        });
      }
      
      // Protection from creatures
      if (text.includes('protection from creatures')) {
        const evidence = this.extractEvidence(text, ['protection from creatures']);
        tags.push({
          name: 'protection_from_creatures',
          category: 'protection',
          confidence: 0.95,
          evidence,
          priority: 8
        });
      }
    }
    
    // === HEXPROOF ===
    if (text.includes('hexproof')) {
      const evidence = this.extractEvidence(text, ['hexproof']);
      tags.push({
        name: 'hexproof',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Hexproof from color
    const colors = ['white', 'blue', 'black', 'red', 'green'];
    for (const color of colors) {
      if (text.includes(`hexproof from ${color}`)) {
        const evidence = this.extractEvidence(text, [`hexproof from ${color}`]);
        tags.push({
          name: `hexproof_from_${color}`,
          category: 'protection',
          confidence: 0.95,
          evidence,
          priority: 8
        });
      }
    }
    
    // === SHROUD ===
    if (text.includes('shroud')) {
      const evidence = this.extractEvidence(text, ['shroud']);
      tags.push({
        name: 'shroud',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === INDESTRUCTIBLE ===
    if (text.includes('indestructible')) {
      const evidence = this.extractEvidence(text, ['indestructible']);
      tags.push({
        name: 'indestructible',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Gains indestructible
    if (text.includes('gains indestructible') || text.includes('becomes indestructible')) {
      const evidence = this.extractEvidence(text, ['gains indestructible', 'becomes indestructible']);
      tags.push({
        name: 'grants_indestructible',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === DAMAGE PREVENTION ===
    // Prevent damage
    if (text.includes('prevent') && text.includes('damage')) {
      const evidence = this.extractEvidence(text, ['prevent.*damage']);
      tags.push({
        name: 'damage_prevention',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Prevent all damage
    if (text.includes('prevent all damage')) {
      const evidence = this.extractEvidence(text, ['prevent all damage']);
      tags.push({
        name: 'prevent_all_damage',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Prevent combat damage
    if (text.includes('prevent') && text.includes('combat damage')) {
      const evidence = this.extractEvidence(text, ['prevent.*combat damage']);
      tags.push({
        name: 'prevent_combat_damage',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === REDIRECTION ===
    // Damage redirection
    if (text.includes('instead') && text.includes('damage')) {
      const evidence = this.extractEvidence(text, ['instead.*damage']);
      tags.push({
        name: 'damage_redirection',
        category: 'protection',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === WARD ===
    if (text.includes('ward')) {
      const evidence = this.extractEvidence(text, ['ward']);
      tags.push({
        name: 'ward',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === REGENERATION ===
    if (text.includes('regenerate')) {
      const evidence = this.extractEvidence(text, ['regenerate']);
      tags.push({
        name: 'regeneration',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === IMMUNITY ===
    // Can't be targeted
    if (text.includes('can\'t be targeted')) {
      const evidence = this.extractEvidence(text, ['can\'t be targeted']);
      tags.push({
        name: 'untargetable',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Can't be destroyed
    if (text.includes('can\'t be destroyed')) {
      const evidence = this.extractEvidence(text, ['can\'t be destroyed']);
      tags.push({
        name: 'destruction_immunity',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Can't be countered
    if (text.includes('can\'t be countered')) {
      const evidence = this.extractEvidence(text, ['can\'t be countered']);
      tags.push({
        name: 'uncounterable',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === REPLACEMENT EFFECTS ===
    // If would be destroyed, instead
    if (text.includes('if') && text.includes('would be destroyed') && text.includes('instead')) {
      const evidence = this.extractEvidence(text, ['if.*would be destroyed.*instead']);
      tags.push({
        name: 'destruction_replacement',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // If would take damage, instead
    if (text.includes('if') && text.includes('would') && text.includes('damage') && text.includes('instead')) {
      const evidence = this.extractEvidence(text, ['if.*would.*damage.*instead']);
      tags.push({
        name: 'damage_replacement',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === TOTEM ARMOR ===
    if (text.includes('totem armor')) {
      const evidence = this.extractEvidence(text, ['totem armor']);
      tags.push({
        name: 'totem_armor',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === PHASING ===
    if (text.includes('phasing')) {
      const evidence = this.extractEvidence(text, ['phasing']);
      tags.push({
        name: 'phasing',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === SPELL IMMUNITY ===
    // Can't be the target of spells
    if (text.includes('can\'t be') && text.includes('target') && text.includes('spell')) {
      const evidence = this.extractEvidence(text, ['can\'t be.*target.*spell']);
      tags.push({
        name: 'spell_immunity',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === ABILITY IMMUNITY ===
    // Can't be the target of abilities
    if (text.includes('can\'t be') && text.includes('target') && text.includes('abilit')) {
      const evidence = this.extractEvidence(text, ['can\'t be.*target.*abilit']);
      tags.push({
        name: 'ability_immunity',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === SACRIFICE IMMUNITY ===
    // Can't be sacrificed
    if (text.includes('can\'t be sacrificed')) {
      const evidence = this.extractEvidence(text, ['can\'t be sacrificed']);
      tags.push({
        name: 'sacrifice_immunity',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === GRAVEYARD PROTECTION ===
    // Exile instead of graveyard
    if (text.includes('exile') && text.includes('instead') && text.includes('graveyard')) {
      const evidence = this.extractEvidence(text, ['exile.*instead.*graveyard']);
      tags.push({
        name: 'graveyard_replacement',
        category: 'protection',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === FLASH PROTECTION ===
    if (text.includes('flash')) {
      const evidence = this.extractEvidence(text, ['flash']);
      tags.push({
        name: 'flash_protection',
        category: 'protection',
        confidence: 0.8,
        evidence,
        priority: 6
      });
    }
    
    // === VIGILANCE (combat protection) ===
    if (text.includes('vigilance')) {
      const evidence = this.extractEvidence(text, ['vigilance']);
      tags.push({
        name: 'vigilance_protection',
        category: 'protection',
        confidence: 0.85,
        evidence,
        priority: 5
      });
    }
    
    // === FIRST STRIKE/DOUBLE STRIKE (combat protection) ===
    if (text.includes('first strike') || text.includes('double strike')) {
      const evidence = this.extractEvidence(text, ['first strike', 'double strike']);
      tags.push({
        name: 'strike_protection',
        category: 'protection',
        confidence: 0.8,
        evidence,
        priority: 6
      });
    }
    
    // === COUNTERSPELL PROTECTION ===
    // Spells can't be countered
    if (text.includes('spells') && text.includes('can\'t be countered')) {
      const evidence = this.extractEvidence(text, ['spells.*can\'t be countered']);
      tags.push({
        name: 'mass_uncounterable',
        category: 'protection',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === TEMPORARY PROTECTION ===
    // Until end of turn protection
    if (text.includes('until end of turn') && 
        (text.includes('protection') || text.includes('indestructible') || text.includes('hexproof'))) {
      const evidence = this.extractEvidence(text, ['until end of turn.*(protection|indestructible|hexproof)']);
      tags.push({
        name: 'temporary_protection',
        category: 'protection',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === CONDITIONAL PROTECTION ===
    // As long as you control
    if (text.includes('as long as you control') && 
        (text.includes('protection') || text.includes('indestructible') || text.includes('hexproof'))) {
      const evidence = this.extractEvidence(text, ['as long as you control.*(protection|indestructible|hexproof)']);
      tags.push({
        name: 'conditional_protection',
        category: 'protection',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    return tags;
  }
  
  // Helper methods
  private extractEvidence(text: string, patterns: string[]): string[] {
    const evidence: string[] = [];
    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'gi');
      const matches = text.match(regex);
      if (matches) {
        evidence.push(...matches);
      }
    }
    return evidence.slice(0, 3); // Limit evidence
  }
  
  private determinePrimaryType(typeLine: string): string {
    const type = typeLine.toLowerCase();
    if (type.includes('creature')) return 'creature';
    if (type.includes('artifact')) return 'artifact';
    if (type.includes('enchantment')) return 'enchantment';
    if (type.includes('instant')) return 'instant';
    if (type.includes('sorcery')) return 'sorcery';
    if (type.includes('planeswalker')) return 'planeswalker';
    if (type.includes('land')) return 'land';
    return 'other';
  }
  
  private determineFunctionalRoles(tags: MechanicTag[], typeLine: string): string[] {
    const roles: string[] = [];
    
    // Role mapping based on mechanics
    const roleMap: { [key: string]: string[] } = {
      'ramp': ['mana_generation', 'land_ramp', 'treasure_generation'],
      'draw': ['card_draw'],
      'removal': ['spot_removal', 'damage_dealing', 'counterspell'],
      'board_wipe': ['board_wipe'],
      'protection': ['protection_static', 'indestructible'],
      'tutor': ['tutor'],
      'graveyard_recursion': ['reanimation', 'graveyard_recursion'],
      'wincon': ['damage_trigger', 'attack_trigger'],
      'utility': ['bounce_effect', 'flicker_effect']
    };
    
    for (const tag of tags) {
      for (const [role, mechanics] of Object.entries(roleMap)) {
        if (mechanics.includes(tag.name)) {
          if (!roles.includes(role)) {
            roles.push(role);
          }
        }
      }
    }
    
    // Default to synergy if no specific role
    if (roles.length === 0) {
      roles.push('synergy');
    }
    
    return roles;
  }
  
  private generateSynergyKeywords(tags: MechanicTag[], text: string): string[] {
    const keywords = new Set<string>();
    
    // Add mechanic names as keywords
    tags.forEach(tag => {
      keywords.add(tag.name);
      keywords.add(tag.category);
    });
    
    // Add important text keywords
    const importantKeywords = [
      'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
      'token', 'counter', 'artifact', 'enchantment', 'instant', 'sorcery',
      'creature', 'land', 'graveyard', 'battlefield', 'library', 'hand'
    ];
    
    importantKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        keywords.add(keyword);
      }
    });
    
    return Array.from(keywords);
  }
  
  private estimatePowerLevel(card: ScryfallCard | LocalCardData, tags: MechanicTag[]): number {
    let powerLevel = 5; // Base power level
    const name = card.name.toLowerCase();
    
    // EDHREC rank adjustment
    if (card.edhrec_rank) {
      if (card.edhrec_rank <= 100) powerLevel = 10;
      else if (card.edhrec_rank <= 500) powerLevel = 9;
      else if (card.edhrec_rank <= 1000) powerLevel = 8;
      else if (card.edhrec_rank <= 2000) powerLevel = 7;
      else if (card.edhrec_rank <= 5000) powerLevel = 6;
      else if (card.edhrec_rank <= 10000) powerLevel = 5;
      else powerLevel = 4;
    }
    
    // High-priority mechanics boost power
    for (const tag of tags) {
      if (tag.priority >= 9) {
        powerLevel += 1.0;  // Strong mechanics
      } else if (tag.priority >= 7) {
        powerLevel += 0.5;  // Good mechanics
      }
    }
    
    // Premium counter doublers (extremely powerful)
    const premiumDoublers = [
      'doubling season', 'parallel lives', 'primal vigor', 'branching evolution', 
      'corpsejack menace', 'kalonian hydra', 'vorel of the hull clade'
    ];
    
    if (premiumDoublers.includes(name)) {
      powerLevel = Math.max(powerLevel, 9); // Minimum 9 for premium doublers
    }
    
    // Strong counter cards (powerful but not game-breaking)
    const strongCounterCards = [
      'hardened scales', 'the ozolith', 'hydras growth', 'solidarity of heroes',
      'pir, imaginative rascal', 'toothy, imaginary friend'
    ];
    
    if (strongCounterCards.includes(name)) {
      powerLevel = Math.max(powerLevel, 7); // Minimum 7 for strong counter cards
    }
    
    // Weak counter cards (limited impact)
    const weakCounterCards = [
      'long list of the ents', 'travel preparations', 'thrive', 'courage in crisis'
    ];
    
    if (weakCounterCards.includes(name)) {
      powerLevel = Math.min(powerLevel, 5); // Cap at 5 for weak counter cards
    }
    
    // Known staples
    const staples = [
      'sol ring', 'command tower', 'arcane signet', 'lightning greaves',
      'cyclonic rift', 'demonic tutor', 'vampiric tutor', 'mystical tutor',
      'rhystic study', 'smothering tithe', 'the great henge', 'bolas citadel'
    ];
    
    if (staples.includes(name)) {
      powerLevel = Math.max(powerLevel, 8); // Minimum 8 for staples
    }
    
    // Check for specific powerful tags
    if (tags.some(t => t.name === 'counter_doubling')) {
      powerLevel = Math.max(powerLevel, 8); // Counter doublers are always strong
    } else if (tags.some(t => t.name === 'counter_addition_single')) {
      powerLevel = Math.min(powerLevel, 6); // Single additions are weaker
    }
    
    return Math.min(10, Math.max(1, powerLevel));
  }
  
  private determineArchetypeRelevance(tags: MechanicTag[], typeLine: string): string[] {
    const archetypes: string[] = [];
    
    // Archetype mapping
    if (tags.some(t => t.name.includes('tribal'))) archetypes.push('tribal');
    if (tags.some(t => t.name === 'token_creation')) archetypes.push('tokens');
    if (tags.some(t => t.name === 'spell_trigger' || t.name === 'spell_copying')) archetypes.push('spellslinger');
    if (tags.some(t => t.name === 'artifact_synergy') || typeLine.includes('artifact')) archetypes.push('artifacts');
    if (tags.some(t => t.name === 'landfall')) archetypes.push('landfall');
    if (tags.some(t => t.name === 'reanimation' || t.name === 'graveyard_recursion')) archetypes.push('reanimator');
    if (tags.some(t => t.name === 'flicker_effect')) archetypes.push('blink');
    if (tags.some(t => t.name === 'plus_one_counters')) archetypes.push('counters');
    if (tags.some(t => t.name === 'equipment')) archetypes.push('voltron');
    if (tags.some(t => t.name === 'sacrifice_ability' || t.name === 'death_trigger')) archetypes.push('aristocrats');
    
    return archetypes;
  }
  
  private extractCreatureTypes(typeLine: string): string[] {
    const commonTribes = [
      'human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit',
      'wizard', 'warrior', 'soldier', 'beast', 'cat', 'vampire', 'merfolk',
      'elemental', 'giant', 'dwarf', 'orc', 'treefolk', 'spider', 'snake',
      'bird', 'fish', 'wolf', 'bear', 'elephant', 'horse', 'minotaur', 'hydra'
    ];
    
    return commonTribes.filter(tribe => 
      new RegExp(`\\b${tribe}\\b`, 'i').test(typeLine)
    );
  }

  /**
   * Extract what types of cards get cost reduction from card text
   */
  private extractCostReductionTargets(text: string): string[] {
    const targets: string[] = [];
    
    // Specific creature types (e.g., "Hydra spells cost less")
    const creatureTypePattern = /(\w+)\s+(?:spells?|creatures?)\s+(?:you cast\s+)?cost.*less/gi;
    let match;
    while ((match = creatureTypePattern.exec(text)) !== null) {
      const creatureType = match[1].toLowerCase();
      if (!targets.includes(creatureType)) {
        targets.push(creatureType);
      }
    }
    
    // Specific card types (e.g., "Artifact spells cost less", "Instant and sorcery spells cost less")
    const cardTypePatterns = [
      /artifact\s+(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i,
      /enchantment\s+(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i,
      /instant\s+(?:and\s+sorcery\s+)?(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i,
      /sorcery\s+(?:and\s+instant\s+)?(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i,
      /creature\s+(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i,
      /planeswalker\s+(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i
    ];
    
    cardTypePatterns.forEach((pattern, index) => {
      if (pattern.test(text)) {
        const types = ['artifact', 'enchantment', 'instant_sorcery', 'instant_sorcery', 'creature', 'planeswalker'];
        if (!targets.includes(types[index])) {
          targets.push(types[index]);
        }
      }
    });
    
    // Generic spell cost reduction
    if (/(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i.test(text) && targets.length === 0) {
      targets.push('spells');
    }
    
    return targets;
  }

  /**
   * Convert MTGJSON keyword analysis to mechanic tags
   */
  private convertKeywordsToTags(keywordAnalysis: any, text: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // Convert ability words
    for (const abilityWord of keywordAnalysis.abilityWords) {
      tags.push({
        name: abilityWord.toLowerCase().replace(/\s+/g, '_'),
        category: 'ability_words',
        confidence: 0.95,
        evidence: [abilityWord],
        priority: this.getKeywordPriority(abilityWord)
      });
    }
    
    // Convert keyword abilities  
    for (const keyword of keywordAnalysis.keywordAbilities) {
      tags.push({
        name: keyword.toLowerCase().replace(/\s+/g, '_'),
        category: 'keyword_abilities',
        confidence: 0.95,
        evidence: [keyword],
        priority: this.getKeywordPriority(keyword)
      });
    }
    
    // Convert keyword actions
    for (const action of keywordAnalysis.keywordActions) {
      tags.push({
        name: action.toLowerCase().replace(/\s+/g, '_'),
        category: 'keyword_actions',
        confidence: 0.9,
        evidence: [action],
        priority: this.getKeywordPriority(action)
      });
    }
    
    return tags;
  }

  /**
   * Detect comprehensive keywords and abilities - FINAL DETECTION METHOD
   * This covers all remaining keywords, abilities, and mechanics not covered by other methods
   */
  private detectKeywordsAndAbilities(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // === EVERGREEN KEYWORDS ===
    const evergreenKeywords = [
      'flying', 'first strike', 'double strike', 'deathtouch', 'haste',
      'hexproof', 'indestructible', 'lifelink', 'menace', 'reach',
      'trample', 'vigilance', 'defender', 'flash', 'prowess',
      'enchant', 'equip', 'protection', 'ward'
    ];
    
    for (const keyword of evergreenKeywords) {
      if (text.includes(keyword)) {
        const evidence = this.extractEvidence(text, [keyword]);
        tags.push({
          name: `keyword_${keyword.replace(/\s+/g, '_')}`,
          category: 'keywords',
          confidence: 0.95,
          evidence,
          priority: 7
        });
      }
    }
    
    // === DECIDUOUS KEYWORDS ===
    const deciduousKeywords = [
      'affinity', 'bloodthirst', 'bushido', 'buyback', 'cascade',
      'champion', 'convoke', 'cycling', 'delve', 'dredge',
      'echo', 'entwine', 'escape', 'evoke', 'exploit',
      'exalted', 'extort', 'fabricate', 'flashback', 'forecast',
      'graft', 'haunt', 'hideaway', 'imprint', 'kicker',
      'landfall', 'madness', 'morph', 'offering', 'persist',
      'phasing', 'provoke', 'prowl', 'rampage', 'recover',
      'reinforce', 'replicate', 'retrace', 'shroud', 'split second',
      'storm', 'sunburst', 'suspend', 'threshold', 'transmute',
      'unleash', 'unearth', 'wither',
      // ADDITIONAL MISSING KEYWORDS
      'absorb', 'aftermath', 'annihilator', 'ascend', 'bestow',
      'changeling', 'cipher', 'companion', 'dash', 'dethrone',
      'devour', 'encore', 'enlist', 'eternalize', 'evolve',
      'fading', 'flanking', 'frenzy', 'horsemanship', 'infect',
      'level up', 'living weapon', 'melee', 'miracle', 'multikicker',
      'partner', 'poisonous', 'rampage', 'rebuke', 'renown',
      'scavenge', 'soulbond', 'splice', 'totem armor', 'undying',
      'vanishing'
    ];
    
    for (const keyword of deciduousKeywords) {
      if (text.includes(keyword)) {
        const evidence = this.extractEvidence(text, [keyword]);
        tags.push({
          name: `keyword_${keyword.replace(/\s+/g, '_')}`,
          category: 'keywords',
          confidence: 0.95,
          evidence,
          priority: 8
        });
      }
    }
    
    // === RECENT MECHANICS ===
    const recentMechanics = [
      'adapt', 'addendum', 'afflict', 'afterlife', 'alliance',
      'amass', 'ascend', 'assist', 'battalion', 'battle cry',
      'bestow', 'bloodrush', 'boast', 'celebration', 'channel',
      'cipher', 'cleave', 'companion', 'connive', 'conspire',
      'crew', 'daybound', 'delirium', 'emerge', 'embalm',
      'enrage', 'eternalize', 'explore', 'fading', 'fateful hour',
      'ferocious', 'food', 'foretell', 'formidable', 'fuse',
      'historic', 'improvise', 'jump-start', 'learn', 'living weapon',
      'meld', 'mentor', 'metalcraft', 'miracle', 'modular',
      'mutate', 'ninjutsu', 'overload', 'partner', 'populate',
      'raid', 'rally', 'rebound', 'revolt', 'riot',
      'scry', 'spectacle', 'splice', 'surge', 'transform',
      'tribute', 'undergrowth', 'undying', 'vanishing', 'venture',
      // 2022-2024 NEWEST MECHANICS
      'backup', 'blitz', 'casualty', 'compleated', 'disturb',
      'exploit', 'hideaway', 'magecraft', 'reconfigure', 'training',
      'ward', 'daybound', 'nightbound', 'decayed', 'toxic',
      'prototype', 'unearth', 'demonstration', 'read ahead',
      'bargain', 'craft', 'doctor', 'time travel', 'paradox',
      'offspring', 'party', 'role token', 'adventure', 'void',
      'plot', 'spree', 'outlast', 'saddle', 'crimes',
      // MURDERS AT KARLOV MANOR (2024)
      'disguise', 'cloak', 'suspect', 'collect evidence', 'investigate', 'cases',
      // DUSKMOURN (2024)
      'manifest dread', 'eerie', 'survival', 'impending', 'rooms',
      // OTHER MISSING MECHANICS
      'finality counters', 'stun counters', 'shield counters', 'oil counters',
      'incubate', 'transform', 'meld', 'dungeon', 'venture',
      'foretell', 'boast', 'demonstrate', 'learn', 'lesson',
      // KEYWORD ACTIONS
      'fateseal', 'clash', 'planeswalk', 'set in motion', 'abandon',
      'detain', 'monstrosity', 'vote', 'bolster', 'support',
      'goad', 'exert', 'assemble', 'surveil', 'amass',
      'open an attraction', 'roll to visit your attractions', 'convert',
      'face a villainous choice', 'discover', 'forage'
    ];
    
    for (const mechanic of recentMechanics) {
      if (text.includes(mechanic)) {
        const evidence = this.extractEvidence(text, [mechanic]);
        tags.push({
          name: `mechanic_${mechanic.replace(/\s+/g, '_')}`,
          category: 'abilities',
          confidence: 0.9,
          evidence,
          priority: 7
        });
      }
    }
    
    // === SPELL TYPES ===
    const spellTypes = [
      'adventure', 'arcane', 'trap'
    ];
    
    for (const spellType of spellTypes) {
      if (text.includes(spellType) || typeLine.includes(spellType)) {
        const evidence = this.extractEvidence(text, [spellType]);
        tags.push({
          name: `spell_type_${spellType}`,
          category: 'types',
          confidence: 0.95,
          evidence,
          priority: 6
        });
      }
    }
    
    // === ABILITY WORDS ===
    const abilityWords = [
      'battalion', 'bloodrush', 'channel', 'chroma', 'cohort',
      'constellation', 'converge', 'council\'s dilemma', 'delirium',
      'domain', 'eminence', 'enrage', 'fateful hour', 'ferocious',
      'formidable', 'grandeur', 'hellbent', 'heroic', 'imprint',
      'inspired', 'join forces', 'kinship', 'landfall', 'lieutenant',
      'metalcraft', 'morbid', 'parley', 'radiance', 'raid',
      'rally', 'revolt', 'spell mastery', 'strive', 'sweep',
      'tempting offer', 'threshold', 'undergrowth', 'will of the council',
      // MISSING ABILITY WORDS
      'adamant', 'addendum', 'alliance', 'celebration', 'corrupted',
      'coven', 'eerie', 'fathomless descent',
      'magecraft', 'pack tactics', 'parade', 'paradox', 'survival',
      'valiant', 'will of the planeswalkers'
    ];
    
    for (const abilityWord of abilityWords) {
      if (text.includes(abilityWord)) {
        const evidence = this.extractEvidence(text, [abilityWord]);
        tags.push({
          name: `ability_word_${abilityWord.replace(/\s+/g, '_').replace(/'/g, '')}`,
          category: 'ability_words',
          confidence: 0.9,
          evidence,
          priority: 8
        });
      }
    }
    
    // === PLANESWALKER-SPECIFIC ===
    if (typeLine.includes('planeswalker')) {
      // Static abilities for planeswalkers
      if (text.includes('emblem')) {
        const evidence = this.extractEvidence(text, ['emblem']);
        tags.push({
          name: 'emblem_creation',
          category: 'planeswalker',
          confidence: 0.95,
          evidence,
          priority: 8
        });
      }
      
      // Planeswalker protection
      if (text.includes('damage that would be dealt to') && text.includes('planeswalker')) {
        const evidence = this.extractEvidence(text, ['damage.*dealt.*planeswalker']);
        tags.push({
          name: 'planeswalker_protection',
          category: 'planeswalker',
          confidence: 0.9,
          evidence,
          priority: 7
        });
      }
    }
    
    // === LEGENDARY MATTERS ===
    if (typeLine.includes('legendary')) {
      // Legendary supertype synergies
      if (text.includes('historic') || text.includes('legendary')) {
        const evidence = this.extractEvidence(text, ['historic', 'legendary']);
        tags.push({
          name: 'legendary_matters',
          category: 'legendary',
          confidence: 0.85,
          evidence,
          priority: 7
        });
      }
    }
    
    // === MODAL SPELLS ===
    if (text.includes('choose one') || text.includes('choose two') || text.includes('choose three')) {
      const evidence = this.extractEvidence(text, ['choose (one|two|three)']);
      tags.push({
        name: 'modal_spell',
        category: 'spell_mechanics',
        confidence: 0.95,
        evidence,
        priority: 6
      });
    }
    
    // === X SPELLS ===
    if (text.includes('{x}') || text.includes('where x is')) {
      const evidence = this.extractEvidence(text, ['\\{x\\}', 'where x is']);
      tags.push({
        name: 'x_spell',
        category: 'spell_mechanics',
        confidence: 0.9,
        evidence,
        priority: 6
      });
    }
    
    // === COLORLESS MATTERS ===
    if (text.includes('colorless') && (text.includes('spell') || text.includes('permanent'))) {
      const evidence = this.extractEvidence(text, ['colorless.*(spell|permanent)']);
      tags.push({
        name: 'colorless_matters',
        category: 'color_matters',
        confidence: 0.85,
        evidence,
        priority: 6
      });
    }
    
    // === MULTICOLORED MATTERS ===
    if (text.includes('multicolored') || text.includes('two or more colors')) {
      const evidence = this.extractEvidence(text, ['multicolored', 'two or more colors']);
      tags.push({
        name: 'multicolored_matters',
        category: 'color_matters',
        confidence: 0.85,
        evidence,
        priority: 6
      });
    }
    
    // === DEVOTION ===
    if (text.includes('devotion')) {
      const evidence = this.extractEvidence(text, ['devotion']);
      tags.push({
        name: 'devotion',
        category: 'color_matters',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === ENERGY ===
    if (text.includes('energy') || text.includes('{e}')) {
      const evidence = this.extractEvidence(text, ['energy', '\\{e\\}']);
      tags.push({
        name: 'energy_matters',
        category: 'counters',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === POISON ===
    if (text.includes('poison') || text.includes('infect')) {
      const evidence = this.extractEvidence(text, ['poison', 'infect']);
      tags.push({
        name: 'poison_strategy',
        category: 'alternate_win',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === MILL ===
    if (text.includes('mill') || (text.includes('library') && text.includes('graveyard'))) {
      const evidence = this.extractEvidence(text, ['mill', 'library.*graveyard']);
      tags.push({
        name: 'mill_strategy',
        category: 'library',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // === WHEELS ===
    if ((text.includes('each player') || text.includes('all players')) && 
        text.includes('discard') && text.includes('draw')) {
      const evidence = this.extractEvidence(text, ['(each player|all players).*discard.*draw']);
      tags.push({
        name: 'wheel_effect',
        category: 'hand',
        confidence: 0.9,
        evidence,
        priority: 8
      });
    }
    
    // === STATION MECHANICS ===
    // Station keyword mechanic (on Spacecraft)
    if (text.includes('station (') || text.includes('station ') && typeLine.includes('spacecraft')) {
      const evidence = this.extractEvidence(text, ['station \\(', 'station.*spacecraft']);
      tags.push({
        name: 'station_mechanic',
        category: 'keywords',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Station threshold abilities
    if (text.includes('station ') && /station \d+\+/.test(text)) {
      const evidence = this.extractEvidence(text, ['station \\d+\\+']);
      tags.push({
        name: 'station_threshold_ability',
        category: 'abilities',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === ROOM MECHANICS ===
    if (typeLine.includes('room') || text.includes('room')) {
      const evidence = this.extractEvidence(text, ['room']);
      tags.push({
        name: 'room_enchantment',
        category: 'enchantments',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === BATTLE MECHANICS ===
    if (typeLine.includes('battle')) {
      const evidence = this.extractEvidence(text, ['battle']);
      tags.push({
        name: 'battle_card',
        category: 'battles',
        confidence: 0.95,
        evidence,
        priority: 7
      });
      
      // Siege battles
      if (typeLine.includes('siege')) {
        const evidence = this.extractEvidence(text, ['siege']);
        tags.push({
          name: 'siege_battle',
          category: 'battles',
          confidence: 0.95,
          evidence,
          priority: 8
        });
      }
    }
    
    // === WARP MECHANICS ===
    // Warp keyword mechanic (alternative casting cost with temporary exile)
    if (text.includes('warp {') || text.includes('warp ') && text.includes('you may cast this')) {
      const evidence = this.extractEvidence(text, ['warp \\{', 'warp.*you may cast this']);
      tags.push({
        name: 'warp_mechanic',
        category: 'keywords',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === VOID MECHANICS ===
    // Void keyword mechanic (checks if nonland permanent left or spell was warped)
    if (text.includes('void —') || text.includes('void -') || 
        (text.includes('void') && (text.includes('nonland permanent left') || text.includes('spell was warped')))) {
      const evidence = this.extractEvidence(text, ['void —', 'void.*nonland permanent left', 'void.*spell was warped']);
      tags.push({
        name: 'void_mechanic',
        category: 'keywords',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === MISCELLANEOUS IMPORTANT MECHANICS ===
    // Devotion
    if (text.includes('devotion to')) {
      const evidence = this.extractEvidence(text, ['devotion to']);
      tags.push({
        name: 'devotion',
        category: 'miscellaneous',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // Historic
    if (text.includes('historic')) {
      const evidence = this.extractEvidence(text, ['historic']);
      tags.push({
        name: 'historic',
        category: 'miscellaneous',
        confidence: 0.9,
        evidence,
        priority: 7
      });
    }
    
    // Legendary matters
    if (text.includes('legendary') && (text.includes('spell') || text.includes('permanent'))) {
      const evidence = this.extractEvidence(text, ['legendary.*(spell|permanent)']);
      tags.push({
        name: 'legendary_matters',
        category: 'miscellaneous',
        confidence: 0.85,
        evidence,
        priority: 7
      });
    }
    
    // City's Blessing
    if (text.includes('city\'s blessing') || text.includes('cities blessing')) {
      const evidence = this.extractEvidence(text, ['city\'s blessing', 'cities blessing']);
      tags.push({
        name: 'citys_blessing',
        category: 'miscellaneous',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Day/Night
    if (text.includes('it becomes day') || text.includes('it becomes night') || 
        text.includes('daybound') || text.includes('nightbound')) {
      const evidence = this.extractEvidence(text, ['it becomes day', 'it becomes night', 'daybound', 'nightbound']);
      tags.push({
        name: 'day_night',
        category: 'miscellaneous',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // Initiative
    if (text.includes('initiative') || text.includes('take the initiative')) {
      const evidence = this.extractEvidence(text, ['initiative', 'take the initiative']);
      tags.push({
        name: 'initiative',
        category: 'miscellaneous',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // The Ring tempts you
    if (text.includes('the ring tempts you')) {
      const evidence = this.extractEvidence(text, ['the ring tempts you']);
      tags.push({
        name: 'ring_tempts',
        category: 'miscellaneous',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    // === VARIABLE NUMBER MECHANICS ===
    // Descend (with variable numbers)
    if (/descend \d+/i.test(text)) {
      const evidence = this.extractEvidence(text, ['descend \\d+']);
      tags.push({
        name: 'descend',
        category: 'ability_words',
        confidence: 0.95,
        evidence,
        priority: 7
      });
    }
    
    // === COMMANDER-SPECIFIC ===
    if (text.includes('command zone')) {
      const evidence = this.extractEvidence(text, ['command zone']);
      tags.push({
        name: 'command_zone_interaction',
        category: 'commander',
        confidence: 0.95,
        evidence,
        priority: 9
      });
    }
    
    if (text.includes('commander tax')) {
      const evidence = this.extractEvidence(text, ['commander tax']);
      tags.push({
        name: 'commander_tax_matters',
        category: 'commander',
        confidence: 0.95,
        evidence,
        priority: 8
      });
    }
    
    return tags;
  }

  /**
   * Enhanced keyword detection using our comprehensive keyword list
   */
  private detectEnhancedKeywords(text: string, typeLine: string): MechanicTag[] {
    const tags: MechanicTag[] = [];
    
    // Check for each category of enhanced keywords
    for (const [category, keywords] of Object.entries(ENHANCED_KEYWORDS)) {
      for (const keyword of keywords) {
        // Use simple string includes check instead of regex to avoid metacharacter issues
        if (text.includes(keyword.toLowerCase())) {
          tags.push({
            name: keyword.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            category: category,
            confidence: 0.8,
            evidence: [keyword],
            priority: this.getKeywordPriority(keyword)
          });
        }
      }
    }
    
    return tags;
  }

  /**
   * Get priority score for keywords based on their synergy importance
   */
  private getKeywordPriority(keyword: string): number {
    const lowKeyword = keyword.toLowerCase();
    
    // Premium mechanics (highest priority)
    if (['landfall', 'storm', 'cascade', 'affinity', 'dredge'].includes(lowKeyword)) {
      return 10;
    }
    
    // High synergy mechanics
    if (['proliferate', 'convoke', 'delve', 'flashback', 'threshold', 'metalcraft'].includes(lowKeyword)) {
      return 9;
    }
    
    // Important combat keywords
    if (['flying', 'trample', 'lifelink', 'deathtouch', 'haste'].includes(lowKeyword)) {
      return 8;
    }
    
    // Utility keywords  
    if (['scry', 'draw', 'tutor', 'ramp'].includes(lowKeyword)) {
      return 7;
    }
    
    return 5; // Default priority
  }
}

export const cardMechanicsTagger = new CardMechanicsTagger();
import { LocalCardData, CardMechanicsData, MechanicTag } from './types';
import { StrategyProfile, StrategyType } from './strategy-detection';

/**
 * Mechanical Recommendation Engine
 * 
 * Recommends cards based on actual mechanical synergies and interactions,
 * not hardcoded card names or generic themes
 */

export interface MechanicalSynergy {
  sourceCard: string;           // Card that provides the synergy
  targetMechanic: string;       // Mechanic that benefits
  synergyType: SynergyType;     // How they interact
  strength: number;             // 1-10 strength of interaction
  description: string;          // Human explanation
}

export type SynergyType = 
  | 'amplifies'      // Makes the mechanic stronger (doubling, anthems)
  | 'enables'        // Allows the mechanic to work (cost reduction, permission)
  | 'triggers'       // Causes the mechanic to activate (ETB triggers landfall)
  | 'protects'       // Prevents the mechanic from being disrupted
  | 'recurses'       // Brings back cards with the mechanic
  | 'tutors'         // Finds cards with the mechanic
  | 'converts'       // Changes one resource into the mechanic
  | 'repeats'        // Allows the mechanic to happen multiple times;

export interface RecommendationQuery {
  existingMechanics: Map<string, number>;  // What's already in the deck
  targetStrategy: StrategyType;            // What strategy we're building
  deckSlots: number;                       // How many slots to fill
  avoidMechanics?: string[];              // Mechanics to avoid
  priorityMechanics?: string[];           // Mechanics to prioritize
}

export interface RecommendationResult {
  recommendedCards: LocalCardData[];
  synergyExplanations: Map<string, string[]>; // Card name -> list of synergy explanations
  mechanicGaps: string[];                      // Missing mechanics that should be added
  overrepresented: string[];                   // Mechanics that have too many cards
}

export class MechanicalRecommendationEngine {
  
  /**
   * Synergy interaction rules based on mechanical relationships
   */
  private synergyRules: Array<{
    sourceMechanic: string;
    targetMechanic: string;
    synergyType: SynergyType;
    strength: number;
    description: string;
  }> = [
    // Token Synergies
    {
      sourceMechanic: 'doubling_effect',
      targetMechanic: 'token_creation',
      synergyType: 'amplifies',
      strength: 9,
      description: 'Doubles token production for exponential value'
    },
    {
      sourceMechanic: 'anthem_effect',
      targetMechanic: 'token_creation',
      synergyType: 'amplifies',
      strength: 8,
      description: 'Makes tokens larger and more threatening'
    },
    {
      sourceMechanic: 'sacrifice_ability',
      targetMechanic: 'token_creation',
      synergyType: 'converts',
      strength: 7,
      description: 'Converts tokens into other resources'
    },
    
    // ETB Synergies
    {
      sourceMechanic: 'flicker_effect',
      targetMechanic: 'etb_trigger',
      synergyType: 'repeats',
      strength: 9,
      description: 'Repeatedly triggers enter-the-battlefield abilities'
    },
    {
      sourceMechanic: 'reanimation',
      targetMechanic: 'etb_trigger',
      synergyType: 'repeats',
      strength: 8,
      description: 'Reanimates creatures to retrigger ETB abilities'
    },
    {
      sourceMechanic: 'bounce_effect',
      targetMechanic: 'etb_trigger',
      synergyType: 'repeats',
      strength: 6,
      description: 'Bounces creatures to hand for repeated ETB value'
    },
    
    // Spell Synergies
    {
      sourceMechanic: 'cost_reduction',
      targetMechanic: 'spell_trigger',
      synergyType: 'enables',
      strength: 8,
      description: 'Reduces spell costs to enable multiple casts per turn'
    },
    {
      sourceMechanic: 'spell_copying',
      targetMechanic: 'spell_trigger',
      synergyType: 'amplifies',
      strength: 9,
      description: 'Copies spells to multiply spell-based triggers'
    },
    {
      sourceMechanic: 'card_draw',
      targetMechanic: 'spell_trigger',
      synergyType: 'enables',
      strength: 7,
      description: 'Provides more spells to cast for triggers'
    },
    
    // Graveyard Synergies
    {
      sourceMechanic: 'mill',
      targetMechanic: 'reanimation',
      synergyType: 'enables',
      strength: 8,
      description: 'Fills graveyard with reanimation targets'
    },
    {
      sourceMechanic: 'sacrifice_ability',
      targetMechanic: 'reanimation',
      synergyType: 'enables',
      strength: 7,
      description: 'Puts creatures in graveyard for reanimation'
    },
    {
      sourceMechanic: 'death_trigger',
      targetMechanic: 'sacrifice_ability',
      synergyType: 'triggers',
      strength: 8,
      description: 'Sacrifice outlets trigger death abilities for value'
    },
    
    // Counter Synergies
    {
      sourceMechanic: 'proliferate',
      targetMechanic: 'plus_one_counters',
      synergyType: 'amplifies',
      strength: 9,
      description: 'Proliferate multiplies +1/+1 counter value'
    },
    {
      sourceMechanic: 'counter_manipulation',
      targetMechanic: 'plus_one_counters',
      synergyType: 'amplifies',
      strength: 8,
      description: 'Manipulates counters for additional value'
    },
    
    // Tribal Synergies
    {
      sourceMechanic: 'anthem_effect',
      targetMechanic: 'generic_tribal',
      synergyType: 'amplifies',
      strength: 8,
      description: 'Tribal anthems boost all creatures of the type'
    },
    {
      sourceMechanic: 'tutor',
      targetMechanic: 'generic_tribal',
      synergyType: 'tutors',
      strength: 7,
      description: 'Tutors find specific tribal pieces'
    },
    
    // Artifact Synergies
    {
      sourceMechanic: 'artifact_synergy',
      targetMechanic: 'mana_ability',
      synergyType: 'amplifies',
      strength: 7,
      description: 'Artifacts-matter effects boost mana rocks'
    },
    {
      sourceMechanic: 'sacrifice_ability',
      targetMechanic: 'artifact_synergy',
      synergyType: 'converts',
      strength: 6,
      description: 'Sacrifice artifacts for value and synergy'
    },
    
    // Protection Synergies
    {
      sourceMechanic: 'protection_static',
      targetMechanic: 'voltron',
      synergyType: 'protects',
      strength: 9,
      description: 'Protects voltron creatures from removal'
    },
    {
      sourceMechanic: 'counterspell',
      targetMechanic: 'combo',
      synergyType: 'protects',
      strength: 8,
      description: 'Protects combo pieces from disruption'
    },
    
    // Landfall Synergies
    {
      sourceMechanic: 'land_ramp',
      targetMechanic: 'landfall',
      synergyType: 'triggers',
      strength: 8,
      description: 'Extra land drops trigger landfall abilities'
    },
    {
      sourceMechanic: 'land_synergy',
      targetMechanic: 'landfall',
      synergyType: 'enables',
      strength: 7,
      description: 'Land synergies enable consistent landfall triggers'
    },
    
    // Card Advantage Synergies
    {
      sourceMechanic: 'tutor',
      targetMechanic: 'card_draw',
      synergyType: 'amplifies',
      strength: 6,
      description: 'Tutors provide virtual card advantage'
    },
    {
      sourceMechanic: 'graveyard_recursion',
      targetMechanic: 'card_draw',
      synergyType: 'amplifies',
      strength: 7,
      description: 'Recursion provides additional card advantage'
    }
  ];
  
  /**
   * Generate recommendations based on existing deck mechanics
   */
  generateRecommendations(
    query: RecommendationQuery,
    cardPool: LocalCardData[]
  ): RecommendationResult {
    
    console.log('🔧 Generating mechanical recommendations...');
    console.log(`📊 Existing mechanics: ${Array.from(query.existingMechanics.entries()).map(([m, c]) => `${m}(${c})`).join(', ')}`);
    
    // Analyze current synergies and gaps
    const synergyAnalysis = this.analyzeSynergyPotential(query.existingMechanics);
    
    // Score each card in the pool for synergy potential
    const scoredCards = cardPool.map(card => {
      const synergyScore = this.calculateCardSynergyScore(card, query.existingMechanics, query.targetStrategy);
      return { card, synergyScore };
    }).filter(scored => scored.synergyScore.totalScore > 0);
    
    // Sort by total synergy score
    scoredCards.sort((a, b) => b.synergyScore.totalScore - a.synergyScore.totalScore);
    
    // Select top cards up to deck slots
    const recommendedCards = scoredCards
      .slice(0, query.deckSlots)
      .map(scored => scored.card);
    
    // Generate explanations for each recommended card
    const synergyExplanations = new Map<string, string[]>();
    scoredCards.slice(0, query.deckSlots).forEach(scored => {
      synergyExplanations.set(scored.card.name, scored.synergyScore.explanations);
    });
    
    return {
      recommendedCards,
      synergyExplanations,
      mechanicGaps: synergyAnalysis.missingMechanics,
      overrepresented: synergyAnalysis.overrepresented
    };
  }
  
  /**
   * Calculate how well a card synergizes with existing deck mechanics
   */
  private calculateCardSynergyScore(
    card: LocalCardData,
    existingMechanics: Map<string, number>,
    targetStrategy: StrategyType
  ): { totalScore: number; explanations: string[] } {
    
    if (!card.mechanics) {
      return { totalScore: 0, explanations: [] };
    }
    
    let totalScore = 0;
    const explanations: string[] = [];
    
    // Score each mechanic on this card
    card.mechanics.mechanicTags.forEach(tag => {
      // Base score for having the mechanic
      let mechanicScore = tag.priority;
      
      // Bonus for synergizing with existing mechanics
      for (const [existingMechanic, count] of existingMechanics.entries()) {
        const synergy = this.findSynergyRule(tag.name, existingMechanic);
        if (synergy) {
          const synergyBonus = synergy.strength * count * 0.5;
          mechanicScore += synergyBonus;
          explanations.push(`${tag.name} ${synergy.synergyType} existing ${existingMechanic} (${count} cards): ${synergy.description}`);
        }
        
        // Check reverse synergy (this card helps existing mechanic)
        const reverseSynergy = this.findSynergyRule(existingMechanic, tag.name);
        if (reverseSynergy) {
          const synergyBonus = reverseSynergy.strength * count * 0.3;
          mechanicScore += synergyBonus;
          explanations.push(`Existing ${existingMechanic} (${count} cards) benefits from ${tag.name}: ${reverseSynergy.description}`);
        }
      }
      
      totalScore += mechanicScore;
    });
    
    // Strategy alignment bonus
    const strategyBonus = this.calculateStrategyAlignment(card.mechanics, targetStrategy);
    totalScore += strategyBonus;
    
    if (strategyBonus > 0) {
      explanations.push(`Aligns with ${targetStrategy} strategy (+${strategyBonus.toFixed(1)})`);
    }
    
    return { totalScore, explanations };
  }
  
  /**
   * Find synergy rule between two mechanics
   */
  private findSynergyRule(sourceMechanic: string, targetMechanic: string) {
    return this.synergyRules.find(rule => 
      rule.sourceMechanic === sourceMechanic && rule.targetMechanic === targetMechanic
    );
  }
  
  /**
   * Calculate how well a card aligns with target strategy
   */
  private calculateStrategyAlignment(mechanics: CardMechanicsData, targetStrategy: StrategyType): number {
    const strategyMechanics = this.getStrategyMechanics(targetStrategy);
    
    let alignmentScore = 0;
    mechanics.mechanicTags.forEach(tag => {
      if (strategyMechanics.includes(tag.name)) {
        alignmentScore += tag.priority * 0.5;
      }
    });
    
    return alignmentScore;
  }
  
  /**
   * Get mechanics that align with a strategy
   */
  private getStrategyMechanics(strategy: StrategyType): string[] {
    const mechanicsMap: Record<StrategyType, string[]> = {
      'token_swarm': ['token_creation', 'doubling_effect', 'anthem_effect', 'attack_trigger'],
      'voltron': ['equip_ability', 'protection_static', 'evasion', 'aura_synergy'],
      'combo': ['activated_abilities', 'alternative_cost', 'tutor', 'cost_reduction'],
      'burn': ['damage_dealing', 'damage_trigger', 'doubling_effect'],
      'mill': ['mill', 'library_manipulation'],
      'alternative_wincon': ['alternative_wincon'],
      'card_advantage': ['card_draw', 'scry', 'tutor', 'graveyard_recursion'],
      'etb_value': ['etb_trigger', 'flicker_effect', 'reanimation', 'bounce_effect'],
      'death_value': ['death_trigger', 'sacrifice_ability', 'token_creation'],
      'cast_value': ['spell_trigger', 'spell_copying', 'cost_reduction', 'storm'],
      'landfall_value': ['landfall', 'land_ramp', 'land_synergy'],
      'ramp': ['mana_generation', 'land_ramp', 'treasure_generation'],
      'artifact_ramp': ['mana_ability', 'artifact_synergy'],
      'land_ramp': ['land_ramp', 'land_synergy'],
      'ritual_combo': ['temporary_mana', 'storm'],
      'creature_tribal': ['generic_tribal', 'anthem_effect', 'tribal_synergy'],
      'type_matters': ['artifact_synergy', 'enchantment_synergy'],
      'permission': ['counterspell', 'instant_synergy'],
      'removal_control': ['spot_removal', 'board_wipe', 'bounce_effect'],
      'stax': ['resource_denial', 'tax_effects'],
      'prison': ['lock_effects', 'denial_effects'],
      'aggro': ['haste', 'low_cost', 'damage_dealing'],
      'midrange': ['versatile_threats', 'efficient_answers'],
      'tempo_control': ['efficient_threats', 'instant_synergy'],
      'graveyard_synergy': ['reanimation', 'graveyard_recursion', 'mill', 'dredge'],
      'artifact_synergy': ['artifact_synergy', 'mana_ability', 'sacrifice_ability'],
      'enchantment_synergy': ['enchantment_synergy', 'aura_synergy'],
      'instant_sorcery': ['spell_trigger', 'spell_copying', 'flashback'],
      'sacrifice_synergy': ['sacrifice_ability', 'death_trigger', 'token_creation'],
      'blink_synergy': ['flicker_effect', 'etb_trigger', 'bounce_effect'],
      'counter_synergy': ['plus_one_counters', 'proliferate', 'counter_manipulation'],
      'triggered_abilities': ['etb_trigger', 'attack_trigger', 'spell_trigger', 'landfall']
    };
    
    return mechanicsMap[strategy] || [];
  }
  
  /**
   * Analyze current synergy potential and identify gaps
   */
  private analyzeSynergyPotential(existingMechanics: Map<string, number>): {
    missingMechanics: string[];
    overrepresented: string[];
    synergyPotential: number;
  } {
    
    const missingMechanics: string[] = [];
    const overrepresented: string[] = [];
    
    // Look for mechanics that would synergize with existing ones but are missing
    for (const [mechanic, count] of existingMechanics.entries()) {
      const synergies = this.synergyRules.filter(rule => rule.targetMechanic === mechanic);
      
      synergies.forEach(synergy => {
        if (!existingMechanics.has(synergy.sourceMechanic) && synergy.strength >= 7) {
          if (!missingMechanics.includes(synergy.sourceMechanic)) {
            missingMechanics.push(synergy.sourceMechanic);
          }
        }
      });
      
      // Check for overrepresentation (more than 8 cards of same mechanic)
      if (count > 8) {
        overrepresented.push(mechanic);
      }
    }
    
    return {
      missingMechanics,
      overrepresented,
      synergyPotential: missingMechanics.length * 2
    };
  }
}

export const mechanicalRecommendationEngine = new MechanicalRecommendationEngine();
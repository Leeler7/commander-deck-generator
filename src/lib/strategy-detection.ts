import { CardMechanicsData, MechanicTag, LocalCardData } from './types';

/**
 * Strategy Detection System
 * 
 * Uses the comprehensive card mechanics tagging to identify deck strategies
 * based on actual mechanical interactions, not hardcoded card names
 */

export interface StrategyProfile {
  primary: StrategyType;
  secondary: StrategyType[];
  confidence: number;        // 0-1, how confident we are in this classification
  mechanicalBasis: string[]; // Which mechanic tags led to this classification
  synergyDensity: number;    // How many cards work together
  explanation: string;       // Human-readable strategy explanation
}

export type StrategyType = 
  // Win Condition Strategies
  | 'token_swarm'         // Create many tokens to overwhelm
  | 'voltron'             // Single large threat with protection
  | 'combo'               // Specific card combinations to win
  | 'burn'                // Direct damage to players
  | 'mill'                // Deck out opponents
  | 'alternative_wincon'  // Cards that say "you win the game"
  
  // Value Engine Strategies  
  | 'card_advantage'      // Draw extra cards, generate value
  | 'etb_value'           // Enter-the-battlefield triggers
  | 'death_value'         // Gain value when things die (aristocrats)
  | 'cast_value'          // Value from casting spells (spellslinger)
  | 'landfall_value'      // Value from playing lands
  
  // Resource Strategies
  | 'ramp'                // Accelerate mana to cast big spells
  | 'artifact_ramp'       // Mana rocks and artifact acceleration
  | 'land_ramp'           // Land-based acceleration
  | 'ritual_combo'        // Temporary mana for combo turns
  
  // Tribal Strategies
  | 'creature_tribal'     // Specific creature type synergies
  | 'type_matters'        // Non-creature type synergies (artifacts, enchantments)
  
  // Control Strategies
  | 'permission'          // Counterspells and prevention
  | 'removal_control'     // Destroy/exile threats
  | 'stax'                // Resource denial and lock pieces
  | 'prison'              // Prevent opponents from acting
  
  // Tempo Strategies
  | 'aggro'               // Fast pressure and low curve
  | 'midrange'            // Balanced threats and answers
  | 'tempo_control'       // Efficient threats + disruption
  
  // Synergy Strategies
  | 'graveyard_synergy'   // Use graveyard as resource
  | 'artifact_synergy'    // Artifacts-matter theme
  | 'enchantment_synergy' // Enchantments-matter theme
  | 'instant_sorcery'     // Spells-matter theme
  | 'sacrifice_synergy'   // Sacrifice for value
  | 'blink_synergy'       // Flicker/exile and return
  | 'counter_synergy'     // +1/+1 counters and proliferate
  | 'triggered_abilities' // Maximize triggered ability value;

export interface StrategyMechanicMapping {
  strategy: StrategyType;
  requiredMechanics: string[];     // Must have these mechanics
  supportingMechanics: string[];   // These mechanics boost confidence
  antiSynergies: string[];         // These mechanics reduce confidence
  minimumDensity: number;          // Minimum number of cards needed
  description: string;
}

export class StrategyDetector {
  
  private strategyMappings: StrategyMechanicMapping[] = [
    // Win Condition Strategies
    {
      strategy: 'token_swarm',
      requiredMechanics: ['token_creation'],
      supportingMechanics: ['doubling_effect', 'anthem_effect', 'token_creation', 'attack_trigger', 'etb_trigger'],
      antiSynergies: ['board_wipe'],
      minimumDensity: 8,
      description: 'Create numerous creature tokens to overwhelm opponents through combat'
    },
    {
      strategy: 'voltron',
      requiredMechanics: ['equip_ability'],
      supportingMechanics: ['protection_static', 'evasion', 'equip_ability', 'attach_aura', 'hexproof'],
      antiSynergies: ['board_wipe', 'token_creation'],
      minimumDensity: 6,
      description: 'Focus on making one creature extremely powerful and protecting it'
    },
    {
      strategy: 'combo',
      requiredMechanics: ['activated_abilities', 'alternative_cost'],
      supportingMechanics: ['tutor', 'cost_reduction', 'alternative_cost', 'activated_abilities', 'untap_abilities'],
      antiSynergies: [],
      minimumDensity: 4,
      description: 'Assemble specific card combinations for immediate victory'
    },
    {
      strategy: 'burn',
      requiredMechanics: ['damage_dealing'],
      supportingMechanics: ['damage_dealing', 'damage_trigger', 'doubling_effect', 'etb_trigger'],
      antiSynergies: ['board_wipe'],
      minimumDensity: 10,
      description: 'Deal direct damage to opponents to reduce their life totals'
    },
    
    // Value Engine Strategies
    {
      strategy: 'card_advantage',
      requiredMechanics: ['card_draw'],
      supportingMechanics: ['card_draw', 'scry', 'surveil', 'tutor', 'etb_trigger'],
      antiSynergies: [],
      minimumDensity: 12,
      description: 'Generate card advantage to outvalue opponents over time'
    },
    {
      strategy: 'etb_value',
      requiredMechanics: ['etb_trigger'],
      supportingMechanics: ['etb_trigger', 'flicker_effect', 'reanimation', 'bounce_effect'],
      antiSynergies: [],
      minimumDensity: 15,
      description: 'Repeatedly trigger enter-the-battlefield abilities for value'
    },
    {
      strategy: 'death_value',
      requiredMechanics: ['death_trigger', 'sacrifice_ability'],
      supportingMechanics: ['death_trigger', 'sacrifice_ability', 'token_creation', 'reanimation'],
      antiSynergies: [],
      minimumDensity: 10,
      description: 'Gain value when creatures die through sacrifice outlets and death triggers'
    },
    {
      strategy: 'cast_value',
      requiredMechanics: ['spell_trigger'],
      supportingMechanics: ['spell_trigger', 'spell_copying', 'cost_reduction', 'storm'],
      antiSynergies: [],
      minimumDensity: 8,
      description: 'Generate value by casting multiple spells per turn'
    },
    {
      strategy: 'landfall_value',
      requiredMechanics: ['landfall'],
      supportingMechanics: ['landfall', 'land_ramp', 'land_synergy', 'fetchlands'],
      antiSynergies: [],
      minimumDensity: 8,
      description: 'Trigger abilities by playing additional lands'
    },
    
    // Resource Strategies
    {
      strategy: 'ramp',
      requiredMechanics: ['mana_generation', 'land_ramp'],
      supportingMechanics: ['mana_generation', 'land_ramp', 'treasure_generation', 'cost_reduction'],
      antiSynergies: [],
      minimumDensity: 12,
      description: 'Accelerate mana development to cast expensive spells early'
    },
    {
      strategy: 'artifact_ramp',
      requiredMechanics: ['mana_ability'],
      supportingMechanics: ['mana_ability', 'artifact_synergy', 'cost_reduction'],
      antiSynergies: [],
      minimumDensity: 10,
      description: 'Use artifact mana sources for acceleration and synergy'
    },
    
    // Tribal Strategies
    {
      strategy: 'creature_tribal',
      requiredMechanics: ['generic_tribal'],
      supportingMechanics: ['generic_tribal', 'anthem_effect', 'tribal_synergy', 'creature_synergy'],
      antiSynergies: ['board_wipe'],
      minimumDensity: 20,
      description: 'Focus on a specific creature type with tribal synergies'
    },
    
    // Control Strategies
    {
      strategy: 'permission',
      requiredMechanics: ['counterspell'],
      supportingMechanics: ['counterspell', 'card_draw', 'instant_synergy'],
      antiSynergies: ['token_creation'],
      minimumDensity: 8,
      description: 'Control the game through counterspells and instant-speed interaction'
    },
    {
      strategy: 'removal_control',
      requiredMechanics: ['spot_removal', 'board_wipe'],
      supportingMechanics: ['spot_removal', 'board_wipe', 'bounce_effect', 'exile_effect'],
      antiSynergies: ['token_creation'],
      minimumDensity: 12,
      description: 'Control through destroying and removing threats'
    },
    
    // Synergy Strategies
    {
      strategy: 'graveyard_synergy',
      requiredMechanics: ['reanimation', 'graveyard_recursion'],
      supportingMechanics: ['reanimation', 'graveyard_recursion', 'mill', 'dredge', 'death_trigger'],
      antiSynergies: ['graveyard_hate'],
      minimumDensity: 8,
      description: 'Use the graveyard as an extension of your hand'
    },
    {
      strategy: 'artifact_synergy',
      requiredMechanics: ['artifact_synergy'],
      supportingMechanics: ['artifact_synergy', 'mana_ability', 'sacrifice_ability'],
      antiSynergies: [],
      minimumDensity: 15,
      description: 'Build around artifacts-matter synergies and interactions'
    },
    {
      strategy: 'blink_synergy',
      requiredMechanics: ['flicker_effect'],
      supportingMechanics: ['flicker_effect', 'etb_trigger', 'bounce_effect'],
      antiSynergies: [],
      minimumDensity: 8,
      description: 'Repeatedly exile and return permanents for value'
    },
    {
      strategy: 'counter_synergy',
      requiredMechanics: ['plus_one_counters', 'counter_manipulation'],
      supportingMechanics: ['plus_one_counters', 'counter_manipulation', 'proliferate'],
      antiSynergies: ['board_wipe'],
      minimumDensity: 10,
      description: 'Build around +1/+1 counters and proliferate effects'
    }
  ];
  
  /**
   * Analyze a deck's strategy based on card mechanics
   */
  analyzeStrategy(cards: LocalCardData[], commander: LocalCardData): StrategyProfile {
    // Get all mechanic tags from the deck
    const allMechanics = this.extractDeckMechanics(cards, commander);
    
    // Score each potential strategy
    const strategyScores = this.strategyMappings.map(mapping => {
      const score = this.scoreStrategy(allMechanics, mapping);
      return { mapping, score };
    }).filter(result => result.score.meetsMinimum);
    
    // Sort by confidence and synergy density
    strategyScores.sort((a, b) => {
      const confidenceDiff = b.score.confidence - a.score.confidence;
      if (Math.abs(confidenceDiff) < 0.1) {
        return b.score.synergyDensity - a.score.synergyDensity;
      }
      return confidenceDiff;
    });
    
    if (strategyScores.length === 0) {
      return this.createFallbackStrategy(allMechanics);
    }
    
    const primary = strategyScores[0];
    const secondary = strategyScores.slice(1, 3).map(s => s.mapping.strategy);
    
    return {
      primary: primary.mapping.strategy,
      secondary,
      confidence: primary.score.confidence,
      mechanicalBasis: primary.score.mechanicalBasis,
      synergyDensity: primary.score.synergyDensity,
      explanation: this.generateStrategyExplanation(primary.mapping, primary.score, allMechanics)
    };
  }
  
  /**
   * Extract all mechanics from deck cards
   */
  private extractDeckMechanics(cards: LocalCardData[], commander: LocalCardData): Map<string, number> {
    const mechanicsCount = new Map<string, number>();
    
    // Include commander mechanics
    if (commander.mechanics) {
      commander.mechanics.mechanicTags.forEach(tag => {
        mechanicsCount.set(tag.name, (mechanicsCount.get(tag.name) || 0) + 1);
      });
    }
    
    // Count mechanics across all cards
    cards.forEach(card => {
      if (card.mechanics) {
        card.mechanics.mechanicTags.forEach(tag => {
          mechanicsCount.set(tag.name, (mechanicsCount.get(tag.name) || 0) + 1);
        });
      }
    });
    
    return mechanicsCount;
  }
  
  /**
   * Score how well a deck fits a strategy
   */
  private scoreStrategy(mechanics: Map<string, number>, mapping: StrategyMechanicMapping): {
    confidence: number;
    synergyDensity: number;
    mechanicalBasis: string[];
    meetsMinimum: boolean;
  } {
    
    let confidence = 0;
    let totalCards = 0;
    const mechanicalBasis: string[] = [];
    
    // Check required mechanics
    const hasAllRequired = mapping.requiredMechanics.every(mechanic => {
      const count = mechanics.get(mechanic) || 0;
      if (count > 0) {
        mechanicalBasis.push(`${mechanic}(${count})`);
        totalCards += count;
        confidence += 0.4; // Required mechanics give big confidence boost
      }
      return count > 0;
    });
    
    if (!hasAllRequired) {
      return { confidence: 0, synergyDensity: 0, mechanicalBasis: [], meetsMinimum: false };
    }
    
    // Add supporting mechanics
    mapping.supportingMechanics.forEach(mechanic => {
      const count = mechanics.get(mechanic) || 0;
      if (count > 0) {
        mechanicalBasis.push(`${mechanic}(${count})`);
        totalCards += count;
        confidence += Math.min(0.15, count * 0.03); // Diminishing returns
      }
    });
    
    // Subtract for anti-synergies
    mapping.antiSynergies.forEach(mechanic => {
      const count = mechanics.get(mechanic) || 0;
      if (count > 0) {
        confidence -= count * 0.05;
      }
    });
    
    // Check minimum density
    const meetsMinimum = totalCards >= mapping.minimumDensity;
    if (!meetsMinimum) {
      confidence *= 0.5; // Heavily penalize below minimum
    }
    
    // Calculate synergy density
    const synergyDensity = totalCards / Math.max(1, mechanicalBasis.length);
    
    return {
      confidence: Math.max(0, Math.min(1, confidence)),
      synergyDensity,
      mechanicalBasis,
      meetsMinimum
    };
  }
  
  /**
   * Create fallback strategy for unclear decks
   */
  private createFallbackStrategy(mechanics: Map<string, number>): StrategyProfile {
    // Look for the most common mechanic categories
    const categories = new Map<string, number>();
    
    for (const [mechanic, count] of mechanics.entries()) {
      // Group by mechanic category (rough categorization)
      let category = 'midrange';
      if (mechanic.includes('token') || mechanic.includes('tribal')) category = 'tribal';
      else if (mechanic.includes('draw') || mechanic.includes('tutor')) category = 'value';
      else if (mechanic.includes('damage') || mechanic.includes('attack')) category = 'aggro';
      else if (mechanic.includes('counter') || mechanic.includes('removal')) category = 'control';
      
      categories.set(category, (categories.get(category) || 0) + count);
    }
    
    const topCategory = Array.from(categories.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      primary: 'midrange',
      secondary: [],
      confidence: 0.3,
      mechanicalBasis: Array.from(mechanics.keys()).slice(0, 5),
      synergyDensity: 1.0,
      explanation: `Balanced midrange strategy with ${topCategory?.[0] || 'varied'} elements`
    };
  }
  
  /**
   * Generate human-readable strategy explanation
   */
  private generateStrategyExplanation(
    mapping: StrategyMechanicMapping, 
    score: any, 
    mechanics: Map<string, number>
  ): string {
    const keyMechanics = score.mechanicalBasis.slice(0, 3).join(', ');
    const density = score.synergyDensity.toFixed(1);
    
    return `${mapping.description}. Key mechanics: ${keyMechanics}. Synergy density: ${density} cards per mechanic.`;
  }
}

export const strategyDetector = new StrategyDetector();
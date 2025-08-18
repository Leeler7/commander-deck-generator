import { CommanderProfile } from './commander-profiler';
import { CardTypeWeights } from './types';

/**
 * Policy Selection System
 * Converts commander profile and user preferences into concrete deck building targets
 */

export interface DeckPolicy {
  // Core composition targets
  composition: RoleComposition;
  
  // Curve and speed targets
  curve: CurvePolicy;
  
  // Constraint enforcement
  constraints: PolicyConstraints;
  
  // Power level adjustments
  powerLevel: PowerLevelPolicy;
}

export interface RoleComposition {
  // Core functional roles (exact card counts)
  lands: { min: number; max: number; target: number };
  ramp: { min: number; max: number; target: number };
  draw: { min: number; max: number; target: number };
  removal: { min: number; max: number; target: number };
  boardWipes: { min: number; max: number; target: number };
  protection: { min: number; max: number; target: number };
  tutors: { min: number; max: number; target: number };
  graveyardRecursion: { min: number; max: number; target: number };
  graveyardHate: { min: number; max: number; target: number };
  wincons: { min: number; max: number; target: number };
  
  // Synergy fill (remaining slots)
  synergyFill: number;
  
  // Card type multipliers from user weights
  typeMultipliers: CardTypeWeights;
}

export interface CurvePolicy {
  targetAvgMv: number;           // Ideal average mana value
  earlyGameSlots: number;        // How many 1-2 MV cards
  midGameSlots: number;          // How many 3-5 MV cards  
  lateGameSlots: number;         // How many 6+ MV cards
  multiSpellPriority: number;    // 1-10, importance of casting multiple spells
}

export interface PolicyConstraints {
  maxBudgetPerCard: number;      // Budget cap per individual card
  totalBudget?: number;          // Total deck budget cap
  bannedCategories: string[];    // Categories to exclude (combo, stax, etc.)
  mandatoryCategories: string[]; // Categories that must be included
  diversityMinimum: number;      // Minimum number of different mechanics
}

export interface PowerLevelPolicy {
  level: number;                 // 1-10 power level
  tutorAllowance: number;        // How many tutors allowed
  fastManaAllowance: number;     // How many fast mana sources allowed
  comboTolerance: number;        // 0-10, how accepting of combos
  staplesPriority: number;       // 1-10, priority for format staples
}

export class PolicySelector {
  
  /**
   * Generate a deck policy from commander profile and user preferences
   */
  generatePolicy(
    commanderProfile: CommanderProfile,
    userWeights: CardTypeWeights,
    powerLevel: number = 7,
    totalBudget?: number,
    maxCardBudget?: number
  ): DeckPolicy {
    
    const composition = this.calculateRoleComposition(commanderProfile, userWeights);
    const curve = this.calculateCurvePolicy(commanderProfile);
    const constraints = this.calculateConstraints(powerLevel, totalBudget, maxCardBudget);
    const powerPolicy = this.calculatePowerLevelPolicy(powerLevel, commanderProfile);
    
    return {
      composition,
      curve,
      constraints,
      powerLevel: powerPolicy
    };
  }
  
  /**
   * Calculate role composition targets based on commander and archetype
   */
  private calculateRoleComposition(
    profile: CommanderProfile,
    userWeights: CardTypeWeights
  ): RoleComposition {
    
    // Base EDH targets (robust defaults)
    const baseTargets = {
      lands: 36,
      ramp: 12,
      draw: 10,
      removal: 6,
      boardWipes: 3,
      protection: 4,
      tutors: 2,
      graveyardRecursion: 2,
      graveyardHate: 1,
      wincons: 2
    };
    
    // Adjust based on commander profile
    const adjustedTargets = { ...baseTargets };
    
    // Ramp adjustments
    if (profile.cmc >= 5) {
      adjustedTargets.ramp += 2; // High CMC commanders need more ramp
    } else if (profile.cmc <= 2) {
      adjustedTargets.ramp -= 2; // Low CMC can run less ramp
    }
    
    // Plan hint adjustments
    const hints = profile.planHints;
    adjustedTargets.ramp = Math.round(adjustedTargets.ramp * (hints.rampPriority / 5.0));
    adjustedTargets.draw = Math.round(adjustedTargets.draw * (hints.drawPriority / 5.0));
    adjustedTargets.protection = Math.round(adjustedTargets.protection * (hints.protectionPriority / 5.0));
    adjustedTargets.removal = Math.round(adjustedTargets.removal * (hints.interactionPriority / 5.0));
    
    // Archetype-specific adjustments
    if (profile.primaryArchetype === 'aggro') {
      adjustedTargets.removal -= 2;
      adjustedTargets.boardWipes -= 1;
      adjustedTargets.protection -= 1;
    } else if (profile.primaryArchetype === 'control') {
      adjustedTargets.removal += 2;
      adjustedTargets.boardWipes += 1;
      adjustedTargets.draw += 2;
    } else if (profile.primaryArchetype === 'combo') {
      adjustedTargets.tutors += 2;
      adjustedTargets.protection += 2;
      adjustedTargets.draw += 1;
    }
    
    // Wincon focus adjustments
    if (hints.winconFocus === 'wide') {
      adjustedTargets.wincons += 1; // Token decks need more wincons
      adjustedTargets.boardWipes -= 1; // Don't wipe your own board
    } else if (hints.winconFocus === 'tall') {
      adjustedTargets.protection += 2; // Voltron needs protection
      adjustedTargets.wincons -= 1; // Commander is the wincon
    } else if (hints.winconFocus === 'combo') {
      adjustedTargets.tutors += 2; // Need to find pieces
      adjustedTargets.wincons += 1; // Multiple combo lines
    }
    
    // Calculate synergy fill (remaining slots after functional roles)
    const totalFunctional = Object.values(adjustedTargets).reduce((sum, val) => sum + val, 0);
    const synergyFill = 99 - totalFunctional; // 99 cards in deck (excluding commander)
    
    // Create ranges (±1 for flexibility, ±2 for high-variance roles)
    const createRange = (target: number, variance: number = 1) => ({
      min: Math.max(0, target - variance),
      max: target + variance,
      target
    });
    
    return {
      lands: createRange(adjustedTargets.lands, 2),
      ramp: createRange(adjustedTargets.ramp, 2),
      draw: createRange(adjustedTargets.draw, 2),
      removal: createRange(adjustedTargets.removal, 2),
      boardWipes: createRange(adjustedTargets.boardWipes, 1),
      protection: createRange(adjustedTargets.protection, 1),
      tutors: createRange(adjustedTargets.tutors, 1),
      graveyardRecursion: createRange(adjustedTargets.graveyardRecursion, 1),
      graveyardHate: createRange(adjustedTargets.graveyardHate, 1),
      wincons: createRange(adjustedTargets.wincons, 1),
      synergyFill: Math.max(15, synergyFill), // Ensure minimum synergy slots
      typeMultipliers: userWeights
    };
  }
  
  /**
   * Calculate curve policy based on commander and archetype
   */
  private calculateCurvePolicy(profile: CommanderProfile): CurvePolicy {
    const hints = profile.curveHints;
    
    // Base distribution for 60 non-land cards
    let earlyGameSlots = 18;  // 30% at 1-2 MV
    let midGameSlots = 30;    // 50% at 3-5 MV  
    let lateGameSlots = 12;   // 20% at 6+ MV
    
    // Adjust based on curve hints
    if (hints.earlyGamePriority >= 8) {
      earlyGameSlots += 6;
      lateGameSlots -= 3;
      midGameSlots -= 3;
    } else if (hints.earlyGamePriority <= 3) {
      earlyGameSlots -= 6;
      midGameSlots += 3;
      lateGameSlots += 3;
    }
    
    if (hints.lateGameTolerance >= 8) {
      lateGameSlots += 4;
      midGameSlots -= 2;
      earlyGameSlots -= 2;
    } else if (hints.lateGameTolerance <= 3) {
      lateGameSlots -= 4;
      midGameSlots += 2;
      earlyGameSlots += 2;
    }
    
    // Ensure positive values and proper distribution
    earlyGameSlots = Math.max(8, earlyGameSlots);
    lateGameSlots = Math.max(4, lateGameSlots);
    midGameSlots = 60 - earlyGameSlots - lateGameSlots;
    
    return {
      targetAvgMv: hints.preferredAvgMv,
      earlyGameSlots,
      midGameSlots,
      lateGameSlots,
      multiSpellPriority: hints.multiSpellTurns ? 8 : 4
    };
  }
  
  /**
   * Calculate policy constraints
   */
  private calculateConstraints(
    powerLevel: number,
    totalBudget?: number,
    maxCardBudget?: number
  ): PolicyConstraints {
    
    const bannedCategories: string[] = [];
    const mandatoryCategories: string[] = ['ramp', 'draw', 'removal'];
    
    // Power level restrictions
    if (powerLevel <= 4) {
      bannedCategories.push('infinite_combos', 'fast_mana', 'stax');
      mandatoryCategories.push('basic_lands');
    } else if (powerLevel <= 7) {
      bannedCategories.push('infinite_combos');
    }
    
    // Budget constraints
    const budgetPerCard = maxCardBudget || this.calculateBudgetPerCard(powerLevel, totalBudget);
    
    return {
      maxBudgetPerCard: budgetPerCard,
      totalBudget,
      bannedCategories,
      mandatoryCategories,
      diversityMinimum: Math.max(3, powerLevel - 2) // Higher power = more diversity
    };
  }
  
  /**
   * Calculate power level policy
   */
  private calculatePowerLevelPolicy(
    powerLevel: number,
    profile: CommanderProfile
  ): PowerLevelPolicy {
    
    // Base allowances scale with power level
    let tutorAllowance = Math.max(0, powerLevel - 4);      // 0-6 tutors
    let fastManaAllowance = Math.max(0, powerLevel - 6);   // 0-4 fast mana
    let comboTolerance = Math.max(0, powerLevel - 3);      // 0-7 combo tolerance
    let staplesPriority = Math.min(10, powerLevel + 2);    // Higher power = more staples
    
    // Archetype adjustments
    if (profile.primaryArchetype === 'combo') {
      tutorAllowance += 2;
      comboTolerance += 3;
    } else if (profile.primaryArchetype === 'control') {
      tutorAllowance += 1;
      staplesPriority += 1;
    } else if (profile.primaryArchetype === 'aggro') {
      tutorAllowance -= 1;
      fastManaAllowance += 1;
    }
    
    return {
      level: powerLevel,
      tutorAllowance: Math.max(0, Math.min(10, tutorAllowance)),
      fastManaAllowance: Math.max(0, Math.min(6, fastManaAllowance)),
      comboTolerance: Math.max(0, Math.min(10, comboTolerance)),
      staplesPriority: Math.max(1, Math.min(10, staplesPriority))
    };
  }
  
  /**
   * Calculate reasonable budget per card based on power level and total budget
   */
  private calculateBudgetPerCard(powerLevel: number, totalBudget?: number): number {
    if (totalBudget) {
      // Distribute budget with Pareto principle: 20% of cards get 80% of budget
      const expensiveCardCount = Math.ceil(99 * 0.2); // ~20 cards
      const budgetForExpensive = totalBudget * 0.8;
      return budgetForExpensive / expensiveCardCount;
    }
    
    // Default per-card budget based on power level
    const budgetMap: { [key: number]: number } = {
      1: 2,    // Ultra budget
      2: 5,    // Budget 
      3: 10,   // Budget+
      4: 20,   // Casual
      5: 35,   // Casual+
      6: 50,   // Focused
      7: 75,   // Optimized
      8: 150,  // High power
      9: 300,  // cEDH
      10: 500  // No budget cEDH
    };
    
    return budgetMap[powerLevel] || 50;
  }
  
  /**
   * Validate that a policy is achievable and internally consistent
   */
  validatePolicy(policy: DeckPolicy): { isValid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    // Check that role targets sum to reasonable deck size
    const comp = policy.composition;
    const totalMinimum = comp.lands.min + comp.ramp.min + comp.draw.min + 
                        comp.removal.min + comp.boardWipes.min + comp.protection.min +
                        comp.tutors.min + comp.graveyardRecursion.min + 
                        comp.graveyardHate.min + comp.wincons.min + comp.synergyFill;
    
    if (totalMinimum > 99) {
      warnings.push(`Minimum role targets exceed deck size: ${totalMinimum}/99`);
    }
    
    const totalTarget = comp.lands.target + comp.ramp.target + comp.draw.target + 
                       comp.removal.target + comp.boardWipes.target + comp.protection.target +
                       comp.tutors.target + comp.graveyardRecursion.target + 
                       comp.graveyardHate.target + comp.wincons.target + comp.synergyFill;
    
    if (totalTarget !== 99) {
      warnings.push(`Target role counts don't sum to 99: ${totalTarget}/99`);
    }
    
    // Check curve distribution
    const curveTotal = policy.curve.earlyGameSlots + policy.curve.midGameSlots + policy.curve.lateGameSlots;
    const nonLandCards = 99 - comp.lands.target;
    
    if (Math.abs(curveTotal - nonLandCards) > 5) {
      warnings.push(`Curve distribution doesn't match non-land count: ${curveTotal} vs ${nonLandCards}`);
    }
    
    // Check budget consistency
    if (policy.constraints.totalBudget && policy.constraints.maxBudgetPerCard) {
      const maxPossibleSpend = policy.constraints.maxBudgetPerCard * 99;
      if (maxPossibleSpend < policy.constraints.totalBudget) {
        warnings.push(`Per-card budget too low for total budget: ${maxPossibleSpend} < ${policy.constraints.totalBudget}`);
      }
    }
    
    return {
      isValid: warnings.length === 0,
      warnings
    };
  }
}

export const policySelector = new PolicySelector();
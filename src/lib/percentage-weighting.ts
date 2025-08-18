import { CardTypeWeights, LocalCardData } from './types';

/**
 * Percentage-Based Card Type Weighting System
 * 
 * Converts slider values (0-10) to percentage maximums of deck representation.
 * - 0 = exclude entirely (0% maximum)
 * - 1-10 = percentage of deck slots that type can fill
 * 
 * This ensures proportional representation and proper exclusion.
 */

export interface PercentageWeights {
  creatures: number;      // 0-100% maximum representation in deck
  artifacts: number;      // 0-100% maximum representation in deck
  enchantments: number;   // 0-100% maximum representation in deck
  instants: number;       // 0-100% maximum representation in deck
  sorceries: number;      // 0-100% maximum representation in deck
  planeswalkers: number;  // 0-100% maximum representation in deck
}

export interface TypeQuotas {
  creatures: { min: number; max: number; target: number };
  artifacts: { min: number; max: number; target: number };
  enchantments: { min: number; max: number; target: number };
  instants: { min: number; max: number; target: number };
  sorceries: { min: number; max: number; target: number };
  planeswalkers: { min: number; max: number; target: number };
}

export class PercentageWeightingSystem {
  
  /**
   * Convert slider weights (0-10) to percentage maximums
   */
  calculatePercentageWeights(sliderWeights: CardTypeWeights): PercentageWeights {
    console.log('🎚️ Converting slider weights to percentages:', sliderWeights);
    
    // Convert each slider value to percentage maximum
    const percentages: PercentageWeights = {
      creatures: this.sliderToPercentage(sliderWeights.creatures),
      artifacts: this.sliderToPercentage(sliderWeights.artifacts),
      enchantments: this.sliderToPercentage(sliderWeights.enchantments),
      instants: this.sliderToPercentage(sliderWeights.instants),
      sorceries: this.sliderToPercentage(sliderWeights.sorceries),
      planeswalkers: this.sliderToPercentage(sliderWeights.planeswalkers)
    };
    
    console.log('📊 Percentage maximums:', percentages);
    return percentages;
  }
  
  /**
   * Convert slider value (0-10) to percentage maximum
   */
  private sliderToPercentage(sliderValue: number): number {
    if (sliderValue === 0) return 0;      // Complete exclusion
    if (sliderValue === 1) return 5;      // Very low (5% max)
    if (sliderValue === 2) return 10;     // Low (10% max)
    if (sliderValue === 3) return 15;     // Below average (15% max)
    if (sliderValue === 4) return 20;     // Somewhat low (20% max)
    if (sliderValue === 5) return 30;     // Average (30% max)
    if (sliderValue === 6) return 40;     // Above average (40% max)
    if (sliderValue === 7) return 50;     // High (50% max)
    if (sliderValue === 8) return 60;     // Very high (60% max)
    if (sliderValue === 9) return 75;     // Extremely high (75% max)
    if (sliderValue === 10) return 100;   // Maximum (100% max)
    
    return 30; // Default to average
  }
  
  /**
   * Calculate card type quotas for deck building based on proportional distribution
   */
  calculateTypeQuotas(
    sliderWeights: CardTypeWeights,
    nonLandSlots: number = 60  // Typically ~60 non-land cards in EDH
  ): TypeQuotas {
    
    console.log(`🎯 Calculating proportional quotas for ${nonLandSlots} non-land slots`);
    console.log(`🎚️ Input weights:`, sliderWeights);
    
    // Calculate total weight points (sum of all sliders)
    const totalWeightPoints = sliderWeights.creatures + sliderWeights.artifacts + 
                             sliderWeights.enchantments + sliderWeights.instants + 
                             sliderWeights.sorceries + sliderWeights.planeswalkers;
    
    console.log(`📊 Total weight points: ${totalWeightPoints}`);
    
    // Calculate proportional targets
    const quotas: TypeQuotas = {
      creatures: this.calculateProportionalQuota(sliderWeights.creatures, totalWeightPoints, nonLandSlots, 'creatures'),
      artifacts: this.calculateProportionalQuota(sliderWeights.artifacts, totalWeightPoints, nonLandSlots, 'artifacts'),
      enchantments: this.calculateProportionalQuota(sliderWeights.enchantments, totalWeightPoints, nonLandSlots, 'enchantments'),
      instants: this.calculateProportionalQuota(sliderWeights.instants, totalWeightPoints, nonLandSlots, 'instants'),
      sorceries: this.calculateProportionalQuota(sliderWeights.sorceries, totalWeightPoints, nonLandSlots, 'sorceries'),
      planeswalkers: this.calculateProportionalQuota(sliderWeights.planeswalkers, totalWeightPoints, nonLandSlots, 'planeswalkers')
    };
    
    // Validate and adjust quotas to ensure they sum to exactly nonLandSlots
    this.adjustQuotasToFitTotal(quotas, nonLandSlots);
    
    console.log('📋 Final proportional quotas:', quotas);
    return quotas;
  }
  
  /**
   * Calculate proportional quota for a specific card type
   */
  private calculateProportionalQuota(
    weight: number,
    totalWeightPoints: number, 
    totalSlots: number, 
    typeName: string
  ): { min: number; max: number; target: number } {
    
    if (weight === 0) {
      console.log(`❌ ${typeName}: Excluded (weight = 0)`);
      return { min: 0, max: 0, target: 0 };
    }
    
    // Calculate proportion of total weights
    const proportion = weight / totalWeightPoints;
    const percentage = (proportion * 100).toFixed(1);
    
    // Calculate target based on proportion
    const target = Math.round(proportion * totalSlots);
    
    // Set min/max with some flexibility
    const min = Math.max(0, target - 2);
    const max = target + 3;
    
    console.log(`🎯 ${typeName}: weight=${weight}/${totalWeightPoints} (${percentage}%) → target=${target}, range=${min}-${max}`);
    
    return {
      min,
      max,
      target
    };
  }
  
  /**
   * Adjust quotas to ensure they sum to exactly the total slots
   */
  private adjustQuotasToFitTotal(quotas: TypeQuotas, totalSlots: number): void {
    const currentTotal = Object.values(quotas).reduce((sum, quota) => sum + quota.target, 0);
    const difference = totalSlots - currentTotal;
    
    console.log(`📊 Current target total: ${currentTotal}, needed: ${totalSlots}, difference: ${difference}`);
    
    if (difference === 0) return; // Perfect fit
    
    // Get all non-zero quotas sorted by target size (largest first for adding, smallest first for removing)
    const adjustableQuotas = Object.entries(quotas)
      .filter(([_, quota]) => quota.target > 0)
      .sort(([_, a], [__, b]) => difference > 0 ? b.target - a.target : a.target - b.target);
    
    let remaining = Math.abs(difference);
    let index = 0;
    
    while (remaining > 0 && index < adjustableQuotas.length) {
      const [typeName, quota] = adjustableQuotas[index];
      
      if (difference > 0) {
        // Need to add cards
        quota.target += 1;
        quota.max += 1;
        console.log(`📈 Increased ${typeName} target to ${quota.target}`);
      } else {
        // Need to remove cards
        if (quota.target > 1) {
          quota.target -= 1;
          quota.min = Math.max(0, quota.min - 1);
          console.log(`📉 Decreased ${typeName} target to ${quota.target}`);
        }
      }
      
      remaining--;
      index = (index + 1) % adjustableQuotas.length;
    }
    
    const finalTotal = Object.values(quotas).reduce((sum, quota) => sum + quota.target, 0);
    console.log(`✅ Adjusted quotas to total: ${finalTotal}/${totalSlots}`);
  }
  
  /**
   * Validate that quotas don't exceed available deck slots
   */
  private validateQuotas(quotas: TypeQuotas, totalSlots: number): void {
    const totalTargets = Object.values(quotas).reduce((sum, quota) => sum + quota.target, 0);
    const totalMaximums = Object.values(quotas).reduce((sum, quota) => sum + quota.max, 0);
    
    console.log(`📊 Quota validation: ${totalTargets} targets, ${totalMaximums} maximums for ${totalSlots} slots`);
    
    if (totalTargets > totalSlots) {
      console.warn(`⚠️  Target quotas exceed deck slots: ${totalTargets} > ${totalSlots}`);
      
      // Proportionally reduce targets
      const scaleFactor = totalSlots / totalTargets;
      Object.keys(quotas).forEach(type => {
        const quota = quotas[type as keyof TypeQuotas];
        quota.target = Math.floor(quota.target * scaleFactor);
        quota.min = Math.min(quota.min, quota.target);
      });
      
      console.log('📉 Scaled down quotas to fit deck slots');
    }
  }
  
  /**
   * Apply quotas to strictly enforce card type limits
   */
  applyQuotasToCardPool(
    cards: LocalCardData[],
    quotas: TypeQuotas
  ): { 
    filteredCards: LocalCardData[];
    typeDistribution: Record<string, number>;
  } {
    
    console.log(`🔍 Applying quotas to ${cards.length} candidate cards`);
    
    // Categorize cards by type
    const cardsByType: Record<string, LocalCardData[]> = {
      creatures: [],
      artifacts: [],
      enchantments: [],
      instants: [],
      sorceries: [],
      planeswalkers: [],
      lands: [],
      other: []
    };
    
    cards.forEach(card => {
      const type = this.getCardPrimaryType(card);
      cardsByType[type].push(card);
    });
    
    console.log('📊 Card pool distribution:', Object.fromEntries(
      Object.entries(cardsByType).map(([type, cards]) => [type, cards.length])
    ));
    
    // Apply quotas to each type
    const filteredCards: LocalCardData[] = [];
    const typeDistribution: Record<string, number> = {};
    
    // Process each type with strict quota enforcement
    Object.entries(quotas).forEach(([typeName, quota]) => {
      const typeCards = cardsByType[typeName] || [];
      
      if (quota.max === 0) {
        console.log(`❌ Excluding all ${typeName} (quota max = 0)`);
        typeDistribution[typeName] = 0;
        return;
      }
      
      // Sort by quality (EDHREC rank, power level, etc.)
      const sortedCards = this.sortCardsByQuality(typeCards);
      
      // Take exactly the target number of cards (not maximum)
      const targetCards = Math.min(quota.target, sortedCards.length);
      const selectedCards = sortedCards.slice(0, targetCards);
      filteredCards.push(...selectedCards);
      typeDistribution[typeName] = selectedCards.length;
      
      console.log(`✅ ${typeName}: Selected ${selectedCards.length}/${typeCards.length} cards (target: ${quota.target})`);
    });
    
    // Always include lands and other types (they don't count against quotas)
    filteredCards.push(...cardsByType.lands);
    filteredCards.push(...cardsByType.other);
    typeDistribution.lands = cardsByType.lands.length;
    typeDistribution.other = cardsByType.other.length;
    
    console.log(`🎯 Final filtered pool: ${filteredCards.length} cards`);
    console.log('📈 Type distribution:', typeDistribution);
    
    return {
      filteredCards,
      typeDistribution
    };
  }
  
  /**
   * Get primary type of a card for quota application
   */
  private getCardPrimaryType(card: LocalCardData): string {
    const typeLine = card.type_line.toLowerCase();
    
    // Check in priority order (some cards have multiple types)
    if (typeLine.includes('land')) return 'lands';
    if (typeLine.includes('creature')) return 'creatures';
    if (typeLine.includes('planeswalker')) return 'planeswalkers';
    if (typeLine.includes('artifact')) return 'artifacts';
    if (typeLine.includes('enchantment')) return 'enchantments';
    if (typeLine.includes('instant')) return 'instants';
    if (typeLine.includes('sorcery')) return 'sorceries';
    
    return 'other';
  }
  
  /**
   * Sort cards by quality for selection - prioritize mechanics and synergy over popularity
   */
  private sortCardsByQuality(cards: LocalCardData[]): LocalCardData[] {
    return cards.sort((a, b) => {
      // Primary sort: Power level from mechanics analysis
      const aPower = a.mechanics?.powerLevel || 5;
      const bPower = b.mechanics?.powerLevel || 5;
      
      if (aPower !== bPower) {
        return bPower - aPower; // Higher power is better
      }
      
      // Secondary sort: efficiency (good stats/effects for cost)
      const aEfficiency = this.calculateEfficiency(a);
      const bEfficiency = this.calculateEfficiency(b);
      
      if (aEfficiency !== bEfficiency) {
        return bEfficiency - aEfficiency;
      }
      
      // Tertiary sort: versatility (cards that do multiple things)
      const aVersatility = this.calculateVersatility(a);
      const bVersatility = this.calculateVersatility(b);
      
      if (aVersatility !== bVersatility) {
        return bVersatility - aVersatility;
      }
      
      // Quaternary sort: Rarity (mythic > rare > uncommon > common)
      const rarityOrder = { mythic: 4, rare: 3, uncommon: 2, common: 1, special: 3, bonus: 2 };
      const aRarity = rarityOrder[a.rarity] || 1;
      const bRarity = rarityOrder[b.rarity] || 1;
      
      return bRarity - aRarity;
    });
  }
  
  /**
   * Calculate efficiency score for a card (stats/effects vs mana cost)
   */
  private calculateEfficiency(card: LocalCardData): number {
    const cmc = card.cmc || 0;
    if (cmc === 0) return 10; // Free spells are very efficient
    
    let efficiency = 5.0; // Base efficiency
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();
    
    // Creatures: check power/toughness efficiency
    if (type.includes('creature')) {
      const power = parseInt(card.power || '0');
      const toughness = parseInt(card.toughness || '0');
      const statTotal = power + toughness;
      
      if (statTotal >= cmc * 2.5) efficiency += 3; // Very efficient stats
      else if (statTotal >= cmc * 2) efficiency += 2;
      else if (statTotal >= cmc * 1.5) efficiency += 1;
    }
    
    // Low-cost high-impact effects
    if (cmc <= 2) {
      if (text.includes('destroy') || text.includes('counter') || text.includes('draw')) {
        efficiency += 3;
      }
    }
    
    // Multi-purpose cards
    let purposes = 0;
    if (text.includes('draw')) purposes++;
    if (text.includes('destroy') || text.includes('exile')) purposes++;
    if (text.includes('add') && text.includes('mana')) purposes++;
    if (text.includes('search')) purposes++;
    
    if (purposes >= 2) efficiency += 2;
    
    return Math.min(10, efficiency);
  }
  
  /**
   * Calculate versatility score (how many different things a card can do)
   */
  private calculateVersatility(card: LocalCardData): number {
    const text = (card.oracle_text || '').toLowerCase();
    let versatility = 0;
    
    // Count different types of effects
    if (text.includes('draw')) versatility++;
    if (text.includes('destroy') || text.includes('exile')) versatility++;
    if (text.includes('add') && text.includes('mana')) versatility++;
    if (text.includes('search')) versatility++;
    if (text.includes('return') && text.includes('graveyard')) versatility++;
    if (text.includes('prevent') || text.includes('protection')) versatility++;
    if (text.includes('counter') && text.includes('spell')) versatility++;
    if (text.includes('whenever') || text.includes('when')) versatility++; // Triggered abilities
    if (text.includes('tap:') || text.includes('activated ability')) versatility++; // Activated abilities
    
    // Bonus for modal spells
    if (text.includes('choose one') || text.includes('choose two') || text.includes('choose three')) {
      versatility += 2;
    }
    
    return versatility;
  }
  
  /**
   * Check if current deck meets quota requirements
   */
  validateDeckAgainstQuotas(
    deck: LocalCardData[],
    quotas: TypeQuotas
  ): { isValid: boolean; violations: string[]; recommendations: string[] } {
    
    const violations: string[] = [];
    const recommendations: string[] = [];
    
    // Count current deck composition
    const currentCounts: Record<string, number> = {
      creatures: 0,
      artifacts: 0,
      enchantments: 0,
      instants: 0,
      sorceries: 0,
      planeswalkers: 0
    };
    
    deck.forEach(card => {
      const type = this.getCardPrimaryType(card);
      if (currentCounts.hasOwnProperty(type)) {
        currentCounts[type]++;
      }
    });
    
    console.log('📊 Current deck composition:', currentCounts);
    
    // Check each quota
    Object.entries(quotas).forEach(([typeName, quota]) => {
      const current = currentCounts[typeName] || 0;
      
      if (current > quota.max) {
        violations.push(`Too many ${typeName}: ${current}/${quota.max} (exceeds maximum)`);
        recommendations.push(`Remove ${current - quota.max} ${typeName} cards`);
      } else if (current < quota.min) {
        violations.push(`Too few ${typeName}: ${current}/${quota.min} (below minimum)`);
        recommendations.push(`Add ${quota.min - current} more ${typeName} cards`);
      } else if (current < quota.target) {
        recommendations.push(`Consider adding ${quota.target - current} more ${typeName} for optimal balance`);
      }
    });
    
    return {
      isValid: violations.length === 0,
      violations,
      recommendations
    };
  }
}

export const percentageWeightingSystem = new PercentageWeightingSystem();
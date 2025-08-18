import { ScryfallCard, LocalCardData, DeckCard, CardTypeWeights, GenerationConstraints } from './types';
import { commanderProfiler } from './commander-profiler';
import { policySelector } from './policy-selection';
import { candidatePoolBuilder } from './candidate-pools';
import { synergyAnalyzer } from './synergy-graph';
import { percentageWeightingSystem } from './percentage-weighting';
import { serverCardDatabase } from './server-card-database';
import { isColorIdentityValid, isCardLegalInCommander } from './rules';

/**
 * Enhanced Deck Generation System
 * Integrates all improvements: percentage weighting, mechanics tagging, and systematic deck building
 */

export interface EnhancedGenerationOptions {
  commander: ScryfallCard;
  constraints: GenerationConstraints;
  powerLevel?: number;
  totalBudget?: number;
  maxCardBudget?: number;
}

export interface EnhancedDeckResult {
  commander: DeckCard;
  nonlandCards: DeckCard[];
  lands: DeckCard[];
  totalPrice: number;
  
  // Enhanced analytics
  typeDistribution: Record<string, number>;
  mechanicsBreakdown: Record<string, number>;
  synergyScore: number;
  powerLevel: number;
  
  // Validation
  quotaCompliance: {
    isValid: boolean;
    violations: string[];
    recommendations: string[];
  };
  
  // Explanations
  deckExplanation: string;
  strategyAnalysis: string;
  improvements: string[];
}

export class EnhancedDeckGenerator {
  private verbose = process.env.NODE_ENV === 'development';

  private log(message: string): void {
    if (this.verbose) {
      this.log(message);
    }
  }
  
  /**
   * Generate a complete deck using the enhanced system
   */
  async generateDeck(options: EnhancedGenerationOptions): Promise<EnhancedDeckResult> {
    this.log('🚀 Starting enhanced deck generation...');
    this.log('👑 Commander:', options.commander.name);
    this.log('🎯 Power Level:', options.powerLevel || 7);
    this.log('💰 Budget:', options.totalBudget || 'Unlimited');
    this.log('🎚️ Weights:', options.constraints.card_type_weights);
    
    // Step 1: Commander Profiling
    this.log('\n📊 Step 1: Analyzing commander...');
    const commanderProfile = commanderProfiler.profile(options.commander);
    this.log(`✅ Commander profile complete: ${commanderProfile.primaryArchetype} with ${commanderProfile.tags.length} mechanical tags`);
    
    // Step 2: Policy Selection
    this.log('\n🎯 Step 2: Setting deck policy...');
    const userWeights = options.constraints.card_type_weights || {
      creatures: 5, artifacts: 5, enchantments: 5,
      instants: 5, sorceries: 5, planeswalkers: 5
    };
    
    const policy = policySelector.generatePolicy(
      commanderProfile,
      userWeights,
      options.powerLevel || 7,
      options.totalBudget,
      options.maxCardBudget
    );
    
    this.log('✅ Policy generated with role targets and curve hints');
    
    // Step 3: Calculate Percentage Weights and Quotas
    this.log('\n📐 Step 3: Calculating type quotas...');
    const percentageWeights = percentageWeightingSystem.calculatePercentageWeights(userWeights);
    const typeQuotas = percentageWeightingSystem.calculateTypeQuotas(percentageWeights, 60);
    
    // Step 4: Build Candidate Pools
    this.log('\n🏗️ Step 4: Building candidate pools...');
    const candidatePools = await candidatePoolBuilder.buildPools(
      options.commander,
      commanderProfile,
      policy
    );
    
    this.log(`✅ Built ${Object.keys(candidatePools.pools).length} role pools with ${candidatePools.allCandidates.length} total candidates`);
    
    // Step 5: Apply Percentage Quotas to Pool
    this.log('\n🎚️ Step 5: Applying percentage quotas...');
    const { filteredCards, typeDistribution } = percentageWeightingSystem.applyQuotasToCardPool(
      candidatePools.allCandidates,
      typeQuotas
    );
    
    this.log(`✅ Filtered to ${filteredCards.length} cards respecting quotas`);
    
    // Step 6: Role-Based Selection
    this.log('\n🎪 Step 6: Selecting cards by role...');
    const selectedCards = await this.selectCardsByRole(
      filteredCards,
      candidatePools,
      policy,
      typeQuotas
    );
    
    this.log(`✅ Selected ${selectedCards.length} non-land cards`);
    
    // Step 7: Manabase Generation
    this.log('\n🏞️ Step 7: Generating manabase...');
    const manabase = await this.generateManabase(
      options.commander,
      selectedCards,
      policy,
      options.constraints
    );
    
    this.log(`✅ Generated ${manabase.length}-card manabase`);
    
    // Step 8: Synergy Analysis
    this.log('\n🔗 Step 8: Analyzing synergies...');
    const allSelectedCards = [...selectedCards, ...manabase];
    const synergyGraph = synergyAnalyzer.buildSynergyGraph(
      allSelectedCards.map(card => ({ ...card, roleScores: {}, synergyScore: 0, powerScore: 0, budgetScore: 0, curveScore: 0, totalScore: 0, roleRelevance: [], selectionPriority: 0 })),
      options.commander,
      commanderProfile
    );
    
    const cohesion = synergyAnalyzer.calculateDeckCohesion(synergyGraph, allSelectedCards.map(card => ({ ...card, roleScores: {}, synergyScore: 0, powerScore: 0, budgetScore: 0, curveScore: 0, totalScore: 0, roleRelevance: [], selectionPriority: 0 })));
    
    this.log(`✅ Synergy analysis complete: ${cohesion.overallCohesion.toFixed(1)}/10 cohesion`);
    
    // Step 9: Convert to DeckCards
    this.log('\n📋 Step 9: Finalizing deck...');
    const commanderCard = this.convertToDeckCard(options.commander, 'Commander', 'The deck\'s leader and main synergy focus');
    const nonlandCards = selectedCards.map(card => 
      this.convertToDeckCard(card, this.determineCardRole(card), this.generateSynergyNotes(card, commanderProfile))
    );
    const landCards = manabase.map(card => 
      this.convertToDeckCard(card, 'Land', 'Mana base support')
    );
    
    // Step 10: Validation and Analysis
    this.log('\n✅ Step 10: Validation and final analysis...');
    const quotaCompliance = percentageWeightingSystem.validateDeckAgainstQuotas(
      allSelectedCards,
      typeQuotas
    );
    
    const totalPrice = this.calculateTotalPrice([commanderCard, ...nonlandCards, ...landCards]);
    const mechanicsBreakdown = this.analyzeMechanicsBreakdown(allSelectedCards);
    const averagePowerLevel = this.calculateAveragePowerLevel(allSelectedCards);
    
    const result: EnhancedDeckResult = {
      commander: commanderCard,
      nonlandCards,
      lands: landCards,
      totalPrice,
      typeDistribution,
      mechanicsBreakdown,
      synergyScore: cohesion.overallCohesion,
      powerLevel: averagePowerLevel,
      quotaCompliance,
      deckExplanation: this.generateDeckExplanation(commanderProfile, policy, cohesion),
      strategyAnalysis: this.generateStrategyAnalysis(commanderProfile, cohesion),
      improvements: this.generateImprovementSuggestions(quotaCompliance, cohesion)
    };
    
    this.log('\n🎉 Enhanced deck generation complete!');
    this.log(`📊 Final stats: ${result.nonlandCards.length + result.lands.length + 1} total cards, $${result.totalPrice.toFixed(2)}, ${result.synergyScore.toFixed(1)}/10 synergy`);
    
    return result;
  }
  
  /**
   * Select cards by role using role pools and quotas
   */
  private async selectCardsByRole(
    candidateCards: LocalCardData[],
    candidatePools: any,
    policy: any,
    typeQuotas: any
  ): Promise<LocalCardData[]> {
    
    const selectedCards: LocalCardData[] = [];
    const roleTargets = policy.composition;
    
    // Track selections by type to enforce quotas
    const typeSelections: Record<string, number> = {
      creatures: 0,
      artifacts: 0,
      enchantments: 0,
      instants: 0,
      sorceries: 0,
      planeswalkers: 0
    };
    
    // Role priority order (most important first)
    const rolePriority = [
      'ramp', 'draw', 'removal', 'wincon', 'protection', 
      'boardWipe', 'tutor', 'graveyardRecursion', 'graveyardHate', 'synergy'
    ];
    
    for (const role of rolePriority) {
      const pool = candidatePools.pools[role];
      if (!pool) continue;
      
      const target = roleTargets[role]?.target || 0;
      if (target === 0) continue;
      
      this.log(`🎯 Selecting ${target} cards for ${role}...`);
      
      let selected = 0;
      for (const candidate of pool.candidates) {
        if (selected >= target) break;
        
        // Check if this card type is within quota
        const cardType = this.getCardType(candidate);
        const currentTypeCount = typeSelections[cardType] || 0;
        const typeQuota = typeQuotas[cardType];
        
        if (typeQuota && currentTypeCount >= typeQuota.max) {
          this.log(`⚠️ Skipping ${candidate.name} - ${cardType} quota exceeded (${currentTypeCount}/${typeQuota.max})`);
          continue;
        }
        
        // Avoid duplicates
        if (selectedCards.some(card => card.name === candidate.name)) {
          continue;
        }
        
        selectedCards.push(candidate);
        if (typeSelections[cardType] !== undefined) {
          typeSelections[cardType]++;
        }
        selected++;
        
        this.log(`✅ Selected ${candidate.name} for ${role} (${cardType}: ${typeSelections[cardType]}/${typeQuota?.max || '∞'})`);
      }
      
      this.log(`📊 ${role}: Selected ${selected}/${target} cards`);
    }
    
    // Fill remaining slots with best available cards (up to quotas)
    const remainingSlots = 60 - selectedCards.length; // Assuming 60 non-land cards
    if (remainingSlots > 0) {
      this.log(`🔄 Filling ${remainingSlots} remaining slots...`);
      
      const availableCards = candidateCards.filter(card => 
        !selectedCards.some(selected => selected.name === card.name)
      );
      
      // Sort by power level and EDHREC rank
      const sortedAvailable = availableCards.sort((a, b) => {
        const aPower = a.mechanics?.powerLevel || 5;
        const bPower = b.mechanics?.powerLevel || 5;
        const aRank = a.edhrec_rank || 999999;
        const bRank = b.edhrec_rank || 999999;
        
        if (aPower !== bPower) return bPower - aPower;
        return aRank - bRank;
      });
      
      let filled = 0;
      for (const card of sortedAvailable) {
        if (filled >= remainingSlots) break;
        
        const cardType = this.getCardType(card);
        const currentTypeCount = typeSelections[cardType] || 0;
        const typeQuota = typeQuotas[cardType];
        
        if (typeQuota && currentTypeCount >= typeQuota.max) {
          continue;
        }
        
        selectedCards.push(card);
        if (typeSelections[cardType] !== undefined) {
          typeSelections[cardType]++;
        }
        filled++;
      }
      
      this.log(`✅ Filled ${filled} additional slots`);
    }
    
    this.log('📊 Final type distribution:', typeSelections);
    return selectedCards;
  }
  
  /**
   * Generate manabase for the deck
   */
  private async generateManabase(
    commander: ScryfallCard,
    nonlandCards: LocalCardData[],
    policy: any,
    constraints: GenerationConstraints
  ): Promise<LocalCardData[]> {
    
    const manabase: LocalCardData[] = [];
    const landTarget = policy.composition.lands.target;
    const colorIdentity = commander.color_identity;
    
    this.log(`🏞️ Generating ${landTarget}-card manabase for ${colorIdentity.join('')} identity`);
    
    // Search for lands matching color identity
    const candidateLands = serverCardDatabase.searchByFilters({
      colorIdentity,
      types: ['land'],
      legal_in_commander: true
    }, 200);
    
    // Basic lands (ensure at least some)
    const basicLands = candidateLands.filter(land => 
      land.type_line.toLowerCase().includes('basic')
    );
    
    // Nonbasic lands
    const nonbasicLands = candidateLands.filter(land => 
      !land.type_line.toLowerCase().includes('basic')
    );
    
    // Sort nonbasics by quality and budget
    const maxBudget = constraints.per_card_cap || 50;
    const affordableNonbasics = nonbasicLands
      .filter(land => parseFloat(land.prices?.usd || '0') <= maxBudget)
      .sort((a, b) => {
        const aRank = a.edhrec_rank || 999999;
        const bRank = b.edhrec_rank || 999999;
        return aRank - bRank;
      });
    
    // Add premium lands first (up to budget)
    const premiumLandCount = Math.min(Math.floor(landTarget * 0.4), affordableNonbasics.length);
    manabase.push(...affordableNonbasics.slice(0, premiumLandCount));
    
    // Fill rest with basics
    const remainingSlots = landTarget - manabase.length;
    const basicsNeeded = Math.min(remainingSlots, basicLands.length);
    
    if (colorIdentity.length === 1) {
      // Mono-color: just basic lands
      manabase.push(...basicLands.slice(0, basicsNeeded));
    } else {
      // Multi-color: distribute basics proportionally
      const basicsPerColor = Math.floor(basicsNeeded / colorIdentity.length);
      const remainder = basicsNeeded % colorIdentity.length;
      
      for (let i = 0; i < colorIdentity.length; i++) {
        const color = colorIdentity[i];
        const colorBasic = basicLands.find(land => 
          land.type_line.toLowerCase().includes(this.colorToBasicName(color))
        );
        
        if (colorBasic) {
          const count = basicsPerColor + (i < remainder ? 1 : 0);
          for (let j = 0; j < count; j++) {
            manabase.push(colorBasic);
          }
        }
      }
    }
    
    this.log(`✅ Generated ${manabase.length}-card manabase (${premiumLandCount} nonbasic, ${manabase.length - premiumLandCount} basic)`);
    return manabase.slice(0, landTarget);
  }
  
  // Helper methods
  private getCardType(card: LocalCardData): string {
    const typeLine = card.type_line.toLowerCase();
    if (typeLine.includes('creature')) return 'creatures';
    if (typeLine.includes('artifact')) return 'artifacts';
    if (typeLine.includes('enchantment')) return 'enchantments';
    if (typeLine.includes('instant')) return 'instants';
    if (typeLine.includes('sorcery')) return 'sorceries';
    if (typeLine.includes('planeswalker')) return 'planeswalkers';
    return 'other';
  }
  
  private colorToBasicName(color: string): string {
    const colorMap: { [key: string]: string } = {
      'W': 'plains', 'U': 'island', 'B': 'swamp', 'R': 'mountain', 'G': 'forest'
    };
    return colorMap[color] || 'plains';
  }
  
  private convertToDeckCard(card: LocalCardData | ScryfallCard, role: string, notes: string): DeckCard {
    return {
      ...card,
      role: role as any,
      synergy_notes: notes,
      price_used: parseFloat(card.prices?.usd || '0')
    };
  }
  
  private determineCardRole(card: LocalCardData): string {
    if (!card.mechanics) return 'Synergy/Wincon';
    
    const roles = card.mechanics.functionalRoles;
    if (roles.includes('ramp')) return 'Ramp';
    if (roles.includes('draw')) return 'Draw/Advantage';
    if (roles.includes('removal')) return 'Removal/Interaction';
    if (roles.includes('board_wipe')) return 'Board Wipe';
    if (roles.includes('tutor')) return 'Tutor';
    if (roles.includes('protection')) return 'Protection';
    
    return 'Synergy/Wincon';
  }
  
  private generateSynergyNotes(card: LocalCardData, profile: any): string {
    if (!card.mechanics) return 'Provides deck support';
    
    const relevantTags = card.mechanics.mechanicTags
      .filter(tag => tag.priority >= 7)
      .slice(0, 2);
    
    if (relevantTags.length === 0) return 'Supports deck strategy';
    
    return relevantTags.map(tag => `${tag.name.replace('_', ' ')}`).join(', ');
  }
  
  private calculateTotalPrice(cards: DeckCard[]): number {
    return cards.reduce((total, card) => total + card.price_used, 0);
  }
  
  private analyzeMechanicsBreakdown(cards: LocalCardData[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    
    cards.forEach(card => {
      if (!card.mechanics) return;
      
      card.mechanics.mechanicTags.forEach(tag => {
        breakdown[tag.category] = (breakdown[tag.category] || 0) + 1;
      });
    });
    
    return breakdown;
  }
  
  private calculateAveragePowerLevel(cards: LocalCardData[]): number {
    const levels = cards
      .map(card => card.mechanics?.powerLevel || 5)
      .filter(level => level > 0);
    
    return levels.length > 0 ? levels.reduce((sum, level) => sum + level, 0) / levels.length : 5;
  }
  
  private generateDeckExplanation(profile: any, policy: any, cohesion: any): string {
    return `This ${profile.primaryArchetype} deck focuses on ${profile.tags.slice(0, 2).map((t: any) => t.name).join(' and ')} strategies. ` +
           `The deck has ${cohesion.overallCohesion.toFixed(1)}/10 synergy with ${cohesion.synergyDensity.toFixed(1)} synergies per card.`;
  }
  
  private generateStrategyAnalysis(profile: any, cohesion: any): string {
    const primaryTag = profile.tags[0];
    if (!primaryTag) return 'Balanced strategy with multiple win conditions.';
    
    return `Strategy centers around ${primaryTag.name.replace('_', ' ')} with supporting ${profile.secondaryArchetypes.join(' and ')} elements.`;
  }
  
  private generateImprovementSuggestions(quotaCompliance: any, cohesion: any): string[] {
    const suggestions: string[] = [];
    
    if (!quotaCompliance.isValid) {
      suggestions.push(...quotaCompliance.recommendations);
    }
    
    if (cohesion.overallCohesion < 6) {
      suggestions.push('Consider adding more synergistic cards to improve cohesion');
    }
    
    if (cohesion.weakestLinks.length > 0) {
      suggestions.push(`Consider replacing low-synergy cards: ${cohesion.weakestLinks.slice(0, 2).join(', ')}`);
    }
    
    return suggestions;
  }
}

export const enhancedDeckGenerator = new EnhancedDeckGenerator();
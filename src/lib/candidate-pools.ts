import { ScryfallCard, LocalCardData } from './types';
import { CommanderProfile } from './commander-profiler';
import { DeckPolicy } from './policy-selection';
import { serverCardDatabase } from './server-card-database';
import { isColorIdentityValid, isCardLegalInCommander } from './rules';

/**
 * Candidate Pool System
 * Builds role-based candidate pools with proper scoring and filtering
 */

export interface CandidateCard extends LocalCardData {
  // Scoring metrics
  roleScores: Record<string, number>;      // How well this fits each role (0-10)
  synergyScore: number;                    // How well this synergizes with commander (0-10)
  powerScore: number;                      // Raw card power level (0-10)
  budgetScore: number;                     // Budget efficiency (0-10)
  curveScore: number;                      // How well this fits curve policy (0-10)
  
  // Composite scores
  totalScore: number;                      // Weighted total of all scores
  roleRelevance: string[];                 // Which roles this card can fill
  
  // Metadata
  assignedRole?: string;                   // Role this card was selected for
  selectionPriority: number;               // Final selection priority
}

export interface RolePool {
  role: string;
  candidates: CandidateCard[];
  targetCount: number;
  minCount: number;
  maxCount: number;
}

export interface CandidatePools {
  pools: Record<string, RolePool>;
  allCandidates: CandidateCard[];
  poolingStats: {
    totalCandidates: number;
    averageCandidatesPerRole: number;
    roles: string[];
  };
}

export class CandidatePoolBuilder {
  
  /**
   * Build comprehensive candidate pools for all roles
   */
  async buildPools(
    commander: ScryfallCard,
    profile: CommanderProfile,
    policy: DeckPolicy
  ): Promise<CandidatePools> {
    
    console.log('🏗️ Building candidate pools...');
    
    // Initialize database
    // Step 1: Get base candidate set (color identity + legality filtered)
    const baseCandidates = await this.getBaseCandidates(commander);
    console.log(`📋 Base candidates: ${baseCandidates.length} cards`);
    
    // Step 2: Score all candidates across multiple dimensions
    const scoredCandidates = this.scoreAllCandidates(baseCandidates, commander, profile, policy);
    console.log(`📊 Scored ${scoredCandidates.length} candidates`);
    
    // Step 3: Build role-specific pools
    const pools = this.buildRolePools(scoredCandidates, policy);
    
    // Step 4: Apply additional filtering and optimization
    const optimizedPools = this.optimizePools(pools, policy);
    
    const stats = this.calculatePoolStats(optimizedPools);
    
    return {
      pools: optimizedPools,
      allCandidates: scoredCandidates,
      poolingStats: stats
    };
  }
  
  /**
   * Get base candidate set filtered by color identity and legality
   */
  private async getBaseCandidates(commander: ScryfallCard): Promise<LocalCardData[]> {
    // Search database for cards matching commander's color identity
    const candidates = await database.searchByFilters({
      colorIdentity: commander.color_identity,
      legal_in_commander: true
    }, 10000); // Large limit to get comprehensive pool
    
    // Additional filtering
    return candidates.filter(card => {
      // Color identity check
      if (!isColorIdentityValid(card, commander.color_identity)) {
        return false;
      }
      
      // Legality check
      if (!isCardLegalInCommander(card)) {
        return false;
      }
      
      // Exclude commander itself
      if (card.name === commander.name) {
        return false;
      }
      
      // Exclude basic lands (handled separately in manabase)
      const basicLands = ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'];
      if (basicLands.includes(card.name.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Score all candidates across multiple dimensions
   */
  private scoreAllCandidates(
    candidates: LocalCardData[],
    commander: ScryfallCard,
    profile: CommanderProfile,
    policy: DeckPolicy
  ): CandidateCard[] {
    
    const scoredCandidates: CandidateCard[] = [];
    
    for (const candidate of candidates) {
      const roleScores = this.calculateRoleScores(candidate);
      const synergyScore = this.calculateSynergyScore(candidate, commander, profile);
      const powerScore = this.calculatePowerScore(candidate);
      const budgetScore = this.calculateBudgetScore(candidate, policy);
      const curveScore = this.calculateCurveScore(candidate, policy);
      
      // Determine which roles this card can meaningfully fill
      const roleRelevance = Object.entries(roleScores)
        .filter(([_, score]) => score >= 5.0)
        .map(([role, _]) => role);
      
      // Calculate weighted total score
      const totalScore = this.calculateTotalScore({
        roleScores,
        synergyScore,
        powerScore,
        budgetScore,
        curveScore
      }, policy);
      
      const scoredCandidate: CandidateCard = {
        ...candidate,
        roleScores,
        synergyScore,
        powerScore,
        budgetScore,
        curveScore,
        totalScore,
        roleRelevance,
        selectionPriority: totalScore // Initial priority
      };
      
      scoredCandidates.push(scoredCandidate);
    }
    
    return scoredCandidates;
  }
  
  /**
   * Calculate how well a card fits each functional role
   */
  private calculateRoleScores(card: LocalCardData): Record<string, number> {
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();
    const name = card.name.toLowerCase();
    const cmc = card.cmc;
    
    const scores: Record<string, number> = {
      land: 0,
      ramp: 0,
      draw: 0,
      removal: 0,
      boardWipe: 0,
      protection: 0,
      tutor: 0,
      graveyardRecursion: 0,
      graveyardHate: 0,
      wincon: 0,
      synergy: 0
    };
    
    // Land scoring
    if (type.includes('land')) {
      scores.land = 10;
      return scores; // Lands are primarily lands
    }
    
    // Ramp scoring
    if (text.includes('add') && (text.includes('mana') || /\{[wubrgc]\}/.test(text))) {
      scores.ramp = 8;
    }
    if (text.includes('search your library for') && text.includes('land')) {
      scores.ramp = 7;
    }
    if (name.includes('signet') || name.includes('talisman') || name === 'sol ring') {
      scores.ramp = 9;
    }
    if (type.includes('artifact') && text.includes('tap') && text.includes('add')) {
      scores.ramp = 7;
    }
    
    // Draw/Advantage scoring
    if (text.includes('draw') && text.includes('card')) {
      const drawCount = this.extractNumberFromText(text, 'draw');
      scores.draw = Math.min(10, 5 + drawCount * 1.5);
    }
    if (text.includes('scry') || text.includes('surveil')) {
      scores.draw = 6;
    }
    if (text.includes('whenever') && text.includes('draw')) {
      scores.draw = 8; // Repeatable draw
    }
    
    // Removal scoring
    if (text.includes('destroy target') || text.includes('exile target')) {
      if (text.includes('creature')) scores.removal = 8;
      if (text.includes('permanent') || text.includes('nonland')) scores.removal = 9;
      if (text.includes('artifact') || text.includes('enchantment')) scores.removal = 7;
    }
    if (text.includes('deal') && text.includes('damage to') && text.includes('target')) {
      scores.removal = 7;
    }
    if (text.includes('counter target spell')) {
      scores.removal = 8;
    }
    
    // Board wipe scoring
    if (text.includes('destroy all') || text.includes('exile all')) {
      if (text.includes('creatures')) scores.boardWipe = 9;
      if (text.includes('nonland permanents')) scores.boardWipe = 10;
    }
    if (name.includes('wrath') || name.includes('damnation')) {
      scores.boardWipe = 9;
    }
    if (text.includes('deal') && text.includes('damage to all')) {
      scores.boardWipe = 7;
    }
    
    // Protection scoring
    if (text.includes('hexproof') || text.includes('shroud')) {
      scores.protection = 8;
    }
    if (text.includes('indestructible')) {
      scores.protection = 9;
    }
    if (text.includes('counter target spell that targets')) {
      scores.protection = 8;
    }
    if (text.includes('prevent') && text.includes('damage')) {
      scores.protection = 6;
    }
    
    // Tutor scoring
    if (text.includes('search your library for') && !text.includes('land')) {
      if (text.includes('any card')) scores.tutor = 10;
      else if (text.includes('creature') || text.includes('instant') || text.includes('sorcery')) {
        scores.tutor = 8;
      } else {
        scores.tutor = 7;
      }
    }
    
    // Graveyard recursion scoring
    if (text.includes('return') && text.includes('from your graveyard')) {
      if (text.includes('to your hand')) scores.graveyardRecursion = 7;
      if (text.includes('to the battlefield')) scores.graveyardRecursion = 9;
    }
    if (text.includes('reanimate') || text.includes('animate dead')) {
      scores.graveyardRecursion = 9;
    }
    
    // Graveyard hate scoring
    if (text.includes('exile') && text.includes('graveyard')) {
      scores.graveyardHate = 8;
    }
    if (text.includes('graveyard') && text.includes('can\'t')) {
      scores.graveyardHate = 9;
    }
    
    // Wincon scoring (creatures with evasion/power, combo pieces, alt wincons)
    if (type.includes('creature')) {
      const power = parseInt(card.power || '0');
      const toughness = parseInt(card.toughness || '0');
      
      if (power >= 6 || (power >= 4 && (text.includes('flying') || text.includes('trample')))) {
        scores.wincon = 7;
      }
      if (text.includes('commander damage') || text.includes('infect')) {
        scores.wincon = 8;
      }
      if (power >= 8) {
        scores.wincon = 8;
      }
    }
    
    if (text.includes('you win the game') || text.includes('target player loses')) {
      scores.wincon = 10;
    }
    
    if (text.includes('infinite') || (text.includes('untap') && text.includes('all'))) {
      scores.wincon = 8; // Combo pieces
    }
    
    // Synergy is catch-all for cards that don't fit functional roles
    if (Object.values(scores).every(score => score < 5)) {
      scores.synergy = 7; // Default synergy value
    }
    
    return scores;
  }
  
  /**
   * Calculate synergy score with commander and deck theme
   */
  private calculateSynergyScore(
    card: LocalCardData,
    commander: ScryfallCard,
    profile: CommanderProfile
  ): number {
    let synergyScore = 5.0; // Base synergy
    
    const cardText = (card.oracle_text || '').toLowerCase();
    const cardType = card.type_line.toLowerCase();
    const commanderText = (commander.oracle_text || '').toLowerCase();
    
    // Tag-based synergy
    for (const tag of profile.tags) {
      if (this.cardMatchesTag(card, tag.name)) {
        synergyScore += tag.priority * 0.3; // High priority tags contribute more
      }
    }
    
    // Archetype synergy
    synergyScore += this.calculateArchetypeSynergy(card, profile.primaryArchetype);
    for (const archetype of profile.secondaryArchetypes) {
      synergyScore += this.calculateArchetypeSynergy(card, archetype) * 0.5;
    }
    
    // Enhanced ETB/LTB synergy detection
    if (commanderText.includes('exile') || commanderText.includes('enters') || 
        commanderText.includes('leaves') || commanderText.includes('return')) {
      
      // Perfect synergy: ETB triggers
      if (cardText.includes('whenever a creature enters') ||
          cardText.includes('when a creature enters')) {
        synergyScore += 3.0; // High synergy boost
      }
      
      // Good synergy: Token creation
      if (cardText.includes('create') && cardText.includes('token') && cardText.includes('creature')) {
        synergyScore += 2.0;
      }
      
      // Specific Norin synergy cards
      const cardName = card.name.toLowerCase();
      const norinCards = ['impact tremors', 'genesis chamber', 'outpost siege', 'purphoros'];
      if (norinCards.some(name => cardName.includes(name))) {
        synergyScore += 2.5;
      }
    }
    
    // Direct text synergy with commander
    const sharedKeywords = this.findSharedKeywords(cardText, commanderText);
    synergyScore += sharedKeywords.length * 0.5;
    
    // Color synergy (multicolor cards in commander's colors)
    if (card.colors.length > 1 && card.colors.every(c => commander.color_identity.includes(c))) {
      synergyScore += 1.0;
    }
    
    return Math.min(10, Math.max(0, synergyScore));
  }
  
  /**
   * Calculate raw power level score based on card features and known staples
   */
  private calculatePowerScore(card: LocalCardData): number {
    let powerScore = 5.0; // Base power
    
    // Power scoring based on card features, not popularity
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();
    const cmc = card.cmc;
    
    // Efficient cards (good stats for cost)
    if (type.includes('creature')) {
      const power = parseInt(card.power || '0');
      const toughness = parseInt(card.toughness || '0');
      const statTotal = power + toughness;
      
      if (statTotal >= cmc * 2.5) powerScore += 2; // Efficient stats
      else if (statTotal >= cmc * 2) powerScore += 1;
    }
    
    // Multi-purpose cards (do more than one thing)
    let purposes = 0;
    if (text.includes('draw')) purposes++;
    if (text.includes('destroy') || text.includes('exile')) purposes++;
    if (text.includes('add') && text.includes('mana')) purposes++;
    if (text.includes('search')) purposes++;
    
    if (purposes >= 2) powerScore += 1.5;
    else if (purposes >= 1) powerScore += 0.5;
    
    // Low-cost high-impact cards
    if (cmc <= 2 && (text.includes('destroy') || text.includes('counter') || text.includes('draw'))) {
      powerScore += 2;
    }
    
    // Rarity bonus
    if (card.rarity === 'mythic') powerScore += 1;
    else if (card.rarity === 'rare') powerScore += 0.5;
    
    // Known staples bonus
    const staples = [
      'sol ring', 'command tower', 'arcane signet', 'lightning greaves',
      'cyclonic rift', 'demonic tutor', 'vampiric tutor', 'mystical tutor',
      'swords to plowshares', 'path to exile', 'counterspell', 'rhystic study'
    ];
    
    if (staples.includes(card.name.toLowerCase())) {
      powerScore += 2;
    }
    
    return Math.min(10, Math.max(0, powerScore));
  }
  
  /**
   * Calculate budget efficiency score
   */
  private calculateBudgetScore(card: LocalCardData, policy: DeckPolicy): number {
    const price = parseFloat(card.prices?.usd || '0');
    const maxBudget = policy.constraints.maxBudgetPerCard;
    
    if (price === 0) return 8; // Free cards are great
    if (price > maxBudget) return 0; // Over budget
    
    // Score inversely based on price (cheaper = better budget score)
    const budgetRatio = price / maxBudget;
    return Math.max(1, 10 - (budgetRatio * 9));
  }
  
  /**
   * Calculate curve fit score
   */
  private calculateCurveScore(card: LocalCardData, policy: DeckPolicy): number {
    const cmc = card.cmc;
    const curve = policy.curve;
    
    let curveScore = 5.0;
    
    // Score based on how well CMC fits desired curve
    if (cmc <= 2 && curve.earlyGameSlots > 15) {
      curveScore += 2; // Deck wants early game
    } else if (cmc >= 6 && curve.lateGameSlots > 15) {
      curveScore += 2; // Deck wants late game
    } else if (cmc >= 3 && cmc <= 5) {
      curveScore += 1; // Midgame is always useful
    }
    
    // Multi-spell consideration
    if (curve.multiSpellPriority >= 7 && cmc <= 3) {
      curveScore += 1.5; // Low CMC for multi-spelling
    }
    
    // Penalize cards that don't fit curve at all
    if (cmc >= 7 && curve.lateGameSlots <= 8) {
      curveScore -= 2; // Too expensive for this deck
    }
    
    return Math.min(10, Math.max(0, curveScore));
  }
  
  /**
   * Calculate weighted total score
   */
  private calculateTotalScore(
    scores: {
      roleScores: Record<string, number>;
      synergyScore: number;
      powerScore: number;
      budgetScore: number;
      curveScore: number;
    },
    policy: DeckPolicy
  ): number {
    
    // Get the highest role score (how well this card fits its best role)
    const bestRoleScore = Math.max(...Object.values(scores.roleScores));
    
    // Weights based on power level and deck policy
    const powerLevel = policy.powerLevel.level;
    
    const weights = {
      role: 0.3,        // How well it fills a needed role
      synergy: 0.25,    // How well it synergizes with commander
      power: powerLevel >= 7 ? 0.25 : 0.15,  // Raw power matters more at high power
      budget: powerLevel <= 5 ? 0.15 : 0.05, // Budget matters more at low power
      curve: 0.1        // Curve fit
    };
    
    return (
      bestRoleScore * weights.role +
      scores.synergyScore * weights.synergy +
      scores.powerScore * weights.power +
      scores.budgetScore * weights.budget +
      scores.curveScore * weights.curve
    );
  }
  
  /**
   * Build role-specific candidate pools
   */
  private buildRolePools(candidates: CandidateCard[], policy: DeckPolicy): Record<string, RolePool> {
    const pools: Record<string, RolePool> = {};
    const comp = policy.composition;
    
    // Define role pool configurations
    const roleConfigs = [
      { role: 'land', target: comp.lands.target, min: comp.lands.min, max: comp.lands.max },
      { role: 'ramp', target: comp.ramp.target, min: comp.ramp.min, max: comp.ramp.max },
      { role: 'draw', target: comp.draw.target, min: comp.draw.min, max: comp.draw.max },
      { role: 'removal', target: comp.removal.target, min: comp.removal.min, max: comp.removal.max },
      { role: 'boardWipe', target: comp.boardWipes.target, min: comp.boardWipes.min, max: comp.boardWipes.max },
      { role: 'protection', target: comp.protection.target, min: comp.protection.min, max: comp.protection.max },
      { role: 'tutor', target: comp.tutors.target, min: comp.tutors.min, max: comp.tutors.max },
      { role: 'graveyardRecursion', target: comp.graveyardRecursion.target, min: comp.graveyardRecursion.min, max: comp.graveyardRecursion.max },
      { role: 'graveyardHate', target: comp.graveyardHate.target, min: comp.graveyardHate.min, max: comp.graveyardHate.max },
      { role: 'wincon', target: comp.wincons.target, min: comp.wincons.min, max: comp.wincons.max },
      { role: 'synergy', target: comp.synergyFill, min: comp.synergyFill - 5, max: comp.synergyFill + 5 }
    ];
    
    for (const config of roleConfigs) {
      // Get candidates who can fill this role (score >= 5.0)
      const roleCandidates = candidates
        .filter(card => (card.roleScores[config.role] || 0) >= 5.0)
        .sort((a, b) => (b.roleScores[config.role] || 0) - (a.roleScores[config.role] || 0))
        .slice(0, config.max * 3); // Keep top candidates (3x target for selection flexibility)
      
      pools[config.role] = {
        role: config.role,
        candidates: roleCandidates,
        targetCount: config.target,
        minCount: config.min,
        maxCount: config.max
      };
    }
    
    return pools;
  }
  
  /**
   * Optimize pools by applying card type weights and removing duplicates
   */
  private optimizePools(pools: Record<string, RolePool>, policy: DeckPolicy): Record<string, RolePool> {
    const optimized = { ...pools };
    const typeWeights = policy.composition.typeMultipliers;
    
    // Apply card type weight filtering to each pool
    for (const [roleName, pool] of Object.entries(optimized)) {
      let filteredCandidates = [...pool.candidates];
      
      // Apply type weight multipliers
      filteredCandidates.forEach(card => {
        const typeMultiplier = this.getCardTypeMultiplier(card, typeWeights);
        card.selectionPriority = card.totalScore * typeMultiplier;
      });
      
      // Re-sort by adjusted priority and limit pool size
      filteredCandidates = filteredCandidates
        .sort((a, b) => b.selectionPriority - a.selectionPriority)
        .slice(0, pool.maxCount * 2); // Keep reasonable pool size
      
      optimized[roleName] = {
        ...pool,
        candidates: filteredCandidates
      };
    }
    
    return optimized;
  }
  
  /**
   * Calculate card type multiplier based on user weights
   */
  private getCardTypeMultiplier(card: LocalCardData, weights: CardTypeWeights): number {
    const type = card.type_line.toLowerCase();
    
    // Map card to primary type
    let primaryType: keyof CardTypeWeights;
    if (type.includes('creature')) primaryType = 'creatures';
    else if (type.includes('artifact')) primaryType = 'artifacts';
    else if (type.includes('enchantment')) primaryType = 'enchantments';
    else if (type.includes('instant')) primaryType = 'instants';
    else if (type.includes('sorcery')) primaryType = 'sorceries';
    else if (type.includes('planeswalker')) primaryType = 'planeswalkers';
    else return 1.0; // Other types not affected by weights
    
    const weight = weights[primaryType];
    
    // Convert weight to multiplier (0=0x, 1=0.1x, 5=1x, 10=2x)
    if (weight === 0) return 0.0;
    return 0.1 + (weight * 0.19); // 0.1 to 2.0 range
  }
  
  // Helper methods
  private extractNumberFromText(text: string, keyword: string): number {
    const pattern = new RegExp(`${keyword}\\s+(\\d+)`, 'i');
    const match = pattern.exec(text);
    return match ? parseInt(match[1]) : 1;
  }
  
  private cardMatchesTag(card: LocalCardData, tagName: string): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();
    
    switch (tagName) {
      case 'tokens':
        return text.includes('token') || text.includes('create');
      case 'landfall':
        return text.includes('landfall') || (text.includes('land') && text.includes('enters'));
      case 'spellslinger':
        return text.includes('instant') || text.includes('sorcery') || text.includes('noncreature spell');
      case 'artifacts':
        return type.includes('artifact') || text.includes('artifact');
      case 'counters':
        return text.includes('+1/+1') || text.includes('counter');
      default:
        return text.includes(tagName.replace('_', ' '));
    }
  }
  
  private calculateArchetypeSynergy(card: LocalCardData, archetype: string): number {
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();
    
    switch (archetype) {
      case 'tokens':
        return text.includes('token') ? 2.0 : 0;
      case 'spellslinger':
        return (text.includes('instant') || text.includes('sorcery')) ? 2.0 : 0;
      case 'artifacts':
        return type.includes('artifact') ? 2.0 : 0;
      case 'voltron':
        return (text.includes('equip') || text.includes('aura')) ? 2.0 : 0;
      case 'tribal':
        return type.includes('creature') ? 1.0 : 0;
      default:
        return 0;
    }
  }
  
  private findSharedKeywords(text1: string, text2: string): string[] {
    const keywords = ['flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 'first strike'];
    return keywords.filter(keyword => text1.includes(keyword) && text2.includes(keyword));
  }
  
  private calculatePoolStats(pools: Record<string, RolePool>): {
    totalCandidates: number;
    averageCandidatesPerRole: number;
    roles: string[];
  } {
    const totalCandidates = Object.values(pools).reduce((sum, pool) => sum + pool.candidates.length, 0);
    const roles = Object.keys(pools);
    
    return {
      totalCandidates,
      averageCandidatesPerRole: totalCandidates / roles.length,
      roles
    };
  }
}

export const candidatePoolBuilder = new CandidatePoolBuilder();
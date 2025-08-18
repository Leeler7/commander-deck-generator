import { ScryfallCard, DeckCard, GenerationConstraints, CardRole } from './types';
import { extractCardPrice } from './pricing';

interface RoleQuota {
  role: string;
  target: number;
  minimum: number;
  current: number;
  cards: DeckCard[];
}

interface BudgetOptimizationResult {
  finalDeck: DeckCard[];
  totalCost: number;
  replacements: Array<{
    removed: ScryfallCard;
    added: ScryfallCard;
    reason: string;
  }>;
  warnings: string[];
}

export class BudgetOptimizer {
  private constraints: GenerationConstraints;
  private commanderPrice: number;

  constructor(constraints: GenerationConstraints, commanderPrice: number) {
    this.constraints = constraints;
    this.commanderPrice = commanderPrice;
  }

  optimizeDeckForBudget(
    allCandidates: ScryfallCard[],
    roleTargets: Record<string, number>,
    targetCardCount: number = 99,
    typeQuotas?: Record<string, {target: number, current: number}>
  ): BudgetOptimizationResult {
    // Remove duplicates first
    const uniqueCandidates = this.removeDuplicates(allCandidates);
    
    // Sort candidates by synergy network effects (inspired by Commander Spellbook)
    const sortedCandidates = this.sortCandidatesByNetworkSynergy(uniqueCandidates);
    
    // Initialize role tracking
    const roleQuotas = this.initializeRoleQuotas(roleTargets);
    
    // Use provided type quotas or calculate them based on user weights
    const cardTypeQuotas = typeQuotas || this.initializeCardTypeQuotas(targetCardCount);
    
    // Phase 1: Fill essential roles with budget-friendly cards
    const phase1Deck = this.fillEssentialRoles(sortedCandidates, roleQuotas, cardTypeQuotas);
    
    // Phase 2: Add remaining cards to reach target total
    const phase2Deck = this.fillRemainingSlots(sortedCandidates, phase1Deck, roleQuotas, cardTypeQuotas, targetCardCount);
    
    // Phase 3: Optimize within budget if over
    const optimizedResult = this.optimizeWithinBudget(phase2Deck, sortedCandidates, roleQuotas, targetCardCount);
    
    return optimizedResult;
  }

  private removeDuplicates(cards: ScryfallCard[]): ScryfallCard[] {
    const seen = new Set<string>();
    const unique: ScryfallCard[] = [];
    
    // Sort by quality metrics first to keep the best version of each card
    const sorted = [...cards].sort((a, b) => {
      // Prefer lower mana cost for efficiency
      if (a.cmc !== b.cmc) return a.cmc - b.cmc;
      
      // Prefer higher power level from mechanics analysis
      const aPower = a.mechanics?.powerLevel || 5;
      const bPower = b.mechanics?.powerLevel || 5;
      if (aPower !== bPower) return bPower - aPower;
      
      // Prefer cards with more abilities (versatility)
      const aText = (a.oracle_text || '').length;
      const bText = (b.oracle_text || '').length;
      return bText - aText;
    });
    
    for (const card of sorted) {
      // Allow multiple copies of basic lands (Plains, Island, Swamp, Mountain, Forest, Wastes)
      const isBasicLand = card.type_line.toLowerCase().includes('basic') && 
                         card.type_line.toLowerCase().includes('land');
      
      if (isBasicLand || !seen.has(card.name)) {
        if (!isBasicLand) {
          seen.add(card.name);
        }
        unique.push(card);
      }
    }
    
    return unique;
  }

  private sortCandidatesByNetworkSynergy(cards: ScryfallCard[]): ScryfallCard[] {
    // First pass: Calculate individual synergy scores
    const cardScores = new Map<string, number>();
    
    for (const card of cards) {
      let score = this.calculateSynergyScore(card);
      
      // Boost score based on cross-card synergies within the candidate pool
      score += this.calculateCrossCardSynergy(card, cards);
      
      cardScores.set(card.name, score);
    }
    
    return cards.sort((a, b) => {
      const priceA = extractCardPrice(a, this.constraints.prefer_cheapest);
      const priceB = extractCardPrice(b, this.constraints.prefer_cheapest);
      
      // 1. First priority: cards within per-card budget
      const aWithinBudget = priceA <= this.constraints.per_card_cap;
      const bWithinBudget = priceB <= this.constraints.per_card_cap;
      
      if (aWithinBudget && !bWithinBudget) return -1;
      if (!aWithinBudget && bWithinBudget) return 1;
      
      // 2. Second priority: SYNERGY SCORES (most important for commander-focused deck)
      const baseScoreA = cardScores.get(a.name) || 0;
      const baseScoreB = cardScores.get(b.name) || 0;
      
      // Significant synergy difference should override other considerations
      if (Math.abs(baseScoreA - baseScoreB) >= 3) {
        return baseScoreB - baseScoreA; // Higher synergy first
      }
      
      // 3. Third priority: EDH staples (only when synergy is similar)
      const aIsStaple = this.isEDHStaple(a);
      const bIsStaple = this.isEDHStaple(b);
      
      if (aIsStaple && !bIsStaple) return -1;
      if (!aIsStaple && bIsStaple) return 1;
      
      // 3. Third priority: Apply user card type weight multipliers (but not to staples)
      const weightMultiplierA = aIsStaple ? 1.0 : this.getCardTypeWeightMultiplier(a);
      const weightMultiplierB = bIsStaple ? 1.0 : this.getCardTypeWeightMultiplier(b);
      
      // 4. Fourth priority: network synergy score (adjusted by user weights)
      // baseScoreA and baseScoreB already declared above
      const adjustedScoreA = baseScoreA * weightMultiplierA;
      const adjustedScoreB = baseScoreB * weightMultiplierB;
      
      if (Math.abs(adjustedScoreA - adjustedScoreB) > 1) {
        return adjustedScoreB - adjustedScoreA; // Higher weighted synergy first
      }
      
      // 5. Fifth priority: cost efficiency
      if (aWithinBudget && bWithinBudget && Math.abs(priceA - priceB) > 1) {
        return priceA - priceB;
      }
      
      // 6. Last priority: card efficiency as tiebreaker (CMC then versatility)
      if (a.cmc !== b.cmc) return a.cmc - b.cmc; // Prefer lower CMC
      
      // Final tiebreaker: card complexity (more abilities = better)
      const aComplexity = (a.oracle_text || '').split(/[.,;]/).length;
      const bComplexity = (b.oracle_text || '').split(/[.,;]/).length;
      return bComplexity - aComplexity;
    });
  }

  private calculateCrossCardSynergy(targetCard: ScryfallCard, allCards: ScryfallCard[]): number {
    let synergyBonus = 0;
    const targetText = (targetCard.oracle_text || '').toLowerCase();
    const targetTypes = targetCard.type_line.toLowerCase();
    
    // Count potential synergy partners in the candidate pool
    for (const otherCard of allCards) {
      if (otherCard.name === targetCard.name) continue;
      
      const otherText = (otherCard.oracle_text || '').toLowerCase();
      const otherTypes = otherCard.type_line.toLowerCase();
      
      // Detect common synergy patterns (inspired by Commander Spellbook approach)
      
      // Token synergies
      if ((targetText.includes('token') || targetText.includes('create')) && 
          (otherText.includes('sacrifice') || otherText.includes('whenever') && otherText.includes('dies'))) {
        synergyBonus += 3;
      }
      
      // Artifact synergies
      if (targetTypes.includes('artifact') && 
          (otherText.includes('artifact') || otherText.includes('metalcraft') || otherText.includes('affinity'))) {
        synergyBonus += 2;
      }
      
      // Graveyard synergies
      if ((targetText.includes('graveyard') || targetText.includes('mill')) &&
          (otherText.includes('graveyard') || otherText.includes('flashback') || otherText.includes('delve'))) {
        synergyBonus += 2;
      }
      
      // Enchantment synergies
      if (targetTypes.includes('enchantment') && 
          (otherText.includes('enchantment') || otherText.includes('constellation'))) {
        synergyBonus += 2;
      }
      
      // +1/+1 counter synergies
      if (targetText.includes('+1/+1') && otherText.includes('+1/+1')) {
        synergyBonus += 2;
      }
      
      // Tribal synergies
      const tribes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit'];
      for (const tribe of tribes) {
        if (targetTypes.includes(tribe) && 
            (otherTypes.includes(tribe) || otherText.includes(tribe))) {
          synergyBonus += 4; // Higher bonus for tribal
        }
      }
      
      // Combo enabler detection (inspired by Commander Spellbook)
      if (this.detectComboSynergy(targetCard, otherCard)) {
        synergyBonus += 5; // High bonus for combo pieces
      }
    }
    
    // Cap the cross-synergy bonus to prevent runaway scoring
    return Math.min(synergyBonus, 15);
  }
  
  private detectComboSynergy(cardA: ScryfallCard, cardB: ScryfallCard): boolean {
    const textA = (cardA.oracle_text || '').toLowerCase();
    const textB = (cardB.oracle_text || '').toLowerCase();
    
    // Detect common infinite combo patterns
    
    // Infinite mana combos
    if ((textA.includes('untap') || textA.includes('doesn\'t untap')) &&
        (textB.includes('mana') || textB.includes('add'))) {
      return true;
    }
    
    // Infinite creature combos
    if ((textA.includes('whenever') && textA.includes('enters')) &&
        (textB.includes('return') || textB.includes('put') && textB.includes('battlefield'))) {
      return true;
    }
    
    // Sacrifice/recursion loops
    if ((textA.includes('sacrifice') && textA.includes('return')) ||
        (textA.includes('sacrifice') && textB.includes('return'))) {
      return true;
    }
    
    return false;
  }

  private sortCandidatesByValue(cards: ScryfallCard[]): ScryfallCard[] {
    return cards.sort((a, b) => {
      const priceA = extractCardPrice(a, this.constraints.prefer_cheapest);
      const priceB = extractCardPrice(b, this.constraints.prefer_cheapest);
      
      // 1. First priority: cards within per-card budget
      const aWithinBudget = priceA <= this.constraints.per_card_cap;
      const bWithinBudget = priceB <= this.constraints.per_card_cap;
      
      if (aWithinBudget && !bWithinBudget) return -1;
      if (!aWithinBudget && bWithinBudget) return 1;
      
      // 2. Second priority: synergy score (based on EDHREC rank - lower is better)
      const synA = this.calculateSynergyScore(a);
      const synB = this.calculateSynergyScore(b);
      if (synA !== synB) return synB - synA; // Higher synergy first
      
      // 3. Third priority: cost efficiency (prefer cheaper within budget)
      if (aWithinBudget && bWithinBudget) {
        if (Math.abs(priceA - priceB) > 1) return priceA - priceB;
      }
      
      // 4. Last priority: efficiency as tiebreaker (CMC then versatility)
      if (a.cmc !== b.cmc) return a.cmc - b.cmc; // Prefer lower CMC
      
      // Final tiebreaker: card complexity (more abilities = better)
      const aComplexity = (a.oracle_text || '').split(/[.,;]/).length;
      const bComplexity = (b.oracle_text || '').split(/[.,;]/).length;
      return bComplexity - aComplexity;
    });
  }

  private calculateSynergyScore(card: ScryfallCard): number {
    let score = 0;
    
    // Base score for card efficiency (stats vs cost)
    const cmc = card.cmc || 0;
    if (cmc <= 2) score += 3; // Low-cost cards are flexible
    else if (cmc <= 4) score += 2;
    else if (cmc <= 6) score += 1;
    
    // Power level from mechanics analysis
    const powerLevel = card.mechanics?.powerLevel || 5;
    score += powerLevel;
    
    // Bonus for cards with synergistic abilities
    const text = (card.oracle_text || '').toLowerCase();
    if (text.includes('whenever') || text.includes('when')) score += 3;
    if (text.includes('token') || text.includes('counter')) score += 2;
    if (text.includes('graveyard') || text.includes('library')) score += 2;
    if (text.includes('draw') && text.includes('card')) score += 2;
    
    // Multi-purpose bonus
    let purposes = 0;
    if (text.includes('draw')) purposes++;
    if (text.includes('destroy') || text.includes('exile')) purposes++;
    if (text.includes('add') && text.includes('mana')) purposes++;
    if (text.includes('search')) purposes++;
    
    if (purposes >= 2) score += 3;
    
    return score;
  }

  private initializeRoleQuotas(roleTargets: Record<string, number>): Record<string, RoleQuota> {
    const quotas: Record<string, RoleQuota> = {};
    
    for (const [role, target] of Object.entries(roleTargets)) {
      quotas[role] = {
        role,
        target,
        minimum: Math.floor(target * 0.7), // Allow 30% flexibility
        current: 0,
        cards: []
      };
    }
    
    return quotas;
  }

  private initializeCardTypeQuotas(targetCardCount: number): Record<string, {target: number, current: number}> {
    const weights = this.constraints.card_type_weights;
    if (!weights) {
      return {}; // No type limits if no weights specified
    }

    // DIRECT PROPORTIONAL CALCULATION based on user weights
    // Simple approach: weight directly correlates to percentage of deck
    
    const totalWeightPoints = weights.creatures + weights.artifacts + weights.enchantments + 
                             weights.instants + weights.sorceries + weights.planeswalkers;
    
    const calculateTypeTarget = (weight: number): number => {
      if (weight === 0) return 0; // Exclude completely
      if (totalWeightPoints === 0) return Math.floor(targetCardCount / 6); // Equal distribution if all weights are 0
      
      // Direct proportional calculation: weight/total * available slots
      const proportion = weight / totalWeightPoints;
      const target = Math.round(proportion * targetCardCount);
      
      // Ensure minimum of 1 for non-zero weights, but don't inflate small weights
      return weight > 0 ? Math.max(1, target) : 0;
    };

    const quotas = {
      artifacts: { target: calculateTypeTarget(weights.artifacts), current: 0 },
      creatures: { target: calculateTypeTarget(weights.creatures), current: 0 },
      enchantments: { target: calculateTypeTarget(weights.enchantments), current: 0 },
      instants: { target: calculateTypeTarget(weights.instants), current: 0 },
      sorceries: { target: calculateTypeTarget(weights.sorceries), current: 0 },
      planeswalkers: { target: calculateTypeTarget(weights.planeswalkers), current: 0 }
    };

    console.log(`💎 Card type targets based on weights:`, {
      artifacts: `${quotas.artifacts.target} (weight: ${weights.artifacts})`,
      creatures: `${quotas.creatures.target} (weight: ${weights.creatures})`,
      enchantments: `${quotas.enchantments.target} (weight: ${weights.enchantments})`,
      instants: `${quotas.instants.target} (weight: ${weights.instants})`,
      sorceries: `${quotas.sorceries.target} (weight: ${weights.sorceries})`,
      planeswalkers: `${quotas.planeswalkers.target} (weight: ${weights.planeswalkers})`
    });

    return quotas;
  }

  private fillEssentialRoles(
    candidates: ScryfallCard[], 
    roleQuotas: Record<string, RoleQuota>,
    cardTypeQuotas: Record<string, {target: number, current: number}>
  ): DeckCard[] {
    const deck: DeckCard[] = [];
    const usedCards = new Set<string>();
    let currentCost = this.commanderPrice;
    
    // Prioritize essential roles first (based on guide priorities)
    const essentialRoles = ['Land', 'Ramp', 'Draw/Advantage', 'Removal/Interaction', 'Protection'];
    
    for (const essentialRole of essentialRoles) {
      const quota = roleQuotas[essentialRole];
      if (!quota) continue;
      
      for (const candidate of candidates) {
        if (usedCards.has(candidate.name)) continue;
        if (quota.current >= quota.target) break;
        
        const candidateRole = this.determineCardRole(candidate);
        if (candidateRole !== essentialRole) continue;
        
        // Check card type quota limits
        if (!this.canAddCardType(candidate, cardTypeQuotas)) continue;
        
        const price = extractCardPrice(candidate, this.constraints.prefer_cheapest);
        
        // Check if we can afford this card
        if (currentCost + price > this.constraints.total_budget) continue;
        if (price > this.constraints.per_card_cap) continue;
        
        const deckCard = this.createDeckCard(candidate, candidateRole, price);
        deck.push(deckCard);
        quota.current++;
        quota.cards.push(deckCard);
        usedCards.add(candidate.name);
        currentCost += price;
        
        // Update card type quota
        this.updateCardTypeQuota(candidate, cardTypeQuotas);
      }
    }
    
    return deck;
  }

  private fillRemainingSlots(
    candidates: ScryfallCard[],
    currentDeck: DeckCard[],
    roleQuotas: Record<string, RoleQuota>,
    cardTypeQuotas: Record<string, {target: number, current: number}>,
    targetCardCount: number = 99
  ): DeckCard[] {
    const deck = [...currentDeck];
    const usedCards = new Set(deck.map(card => card.name));
    let currentCost = this.commanderPrice + deck.reduce((sum, card) => sum + card.price_used, 0);
    
    // Fill remaining slots to reach target card count
    for (const candidate of candidates) {
      if (deck.length >= targetCardCount) break;
      if (usedCards.has(candidate.name)) continue;
      
      const candidateRole = this.determineCardRole(candidate);
      const price = extractCardPrice(candidate, this.constraints.prefer_cheapest);
      
      // Check card type quota limits
      if (!this.canAddCardType(candidate, cardTypeQuotas)) continue;
      
      // Check budget constraints
      if (currentCost + price > this.constraints.total_budget) {
        // Try to find a cheaper alternative for this role
        const cheaperAlternative = this.findCheaperAlternative(
          candidates, 
          candidateRole, 
          this.constraints.total_budget - currentCost,
          usedCards
        );
        
        if (cheaperAlternative) {
          const altPrice = extractCardPrice(cheaperAlternative, this.constraints.prefer_cheapest);
          const deckCard = this.createDeckCard(cheaperAlternative, candidateRole, altPrice);
          deck.push(deckCard);
          usedCards.add(cheaperAlternative.name);
          currentCost += altPrice;
          
          const quota = roleQuotas[candidateRole];
          if (quota) {
            quota.current++;
            quota.cards.push(deckCard);
          }
        }
        continue;
      }
      
      if (price > this.constraints.per_card_cap) continue;
      
      const deckCard = this.createDeckCard(candidate, candidateRole, price);
      deck.push(deckCard);
      usedCards.add(candidate.name);
      currentCost += price;
      
      const quota = roleQuotas[candidateRole];
      if (quota) {
        quota.current++;
        quota.cards.push(deckCard);
      }
      
      // Update card type quota
      this.updateCardTypeQuota(candidate, cardTypeQuotas);
    }
    
    return deck;
  }

  private findCheaperAlternative(
    candidates: ScryfallCard[],
    targetRole: string,
    maxPrice: number,
    usedCards: Set<string>
  ): ScryfallCard | null {
    const roleCards = candidates.filter(card => {
      if (usedCards.has(card.name)) return false;
      const role = this.determineCardRole(card);
      if (role !== targetRole) return false;
      
      const price = extractCardPrice(card, this.constraints.prefer_cheapest);
      return price <= maxPrice && price <= this.constraints.per_card_cap;
    });
    
    // Sort by value (efficiency and power level)
    roleCards.sort((a, b) => {
      const priceA = extractCardPrice(a, this.constraints.prefer_cheapest);
      const priceB = extractCardPrice(b, this.constraints.prefer_cheapest);
      
      // Prefer cheaper cards first
      if (Math.abs(priceA - priceB) > 0.5) return priceA - priceB;
      
      // Then prefer higher power level
      const powerA = a.mechanics?.powerLevel || 5;
      const powerB = b.mechanics?.powerLevel || 5;
      if (powerA !== powerB) return powerB - powerA;
      
      // Finally prefer lower CMC for efficiency
      return a.cmc - b.cmc;
    });
    
    return roleCards[0] || null;
  }

  private optimizeWithinBudget(
    deck: DeckCard[],
    allCandidates: ScryfallCard[],
    roleQuotas: Record<string, RoleQuota>,
    targetCardCount: number
  ): BudgetOptimizationResult {
    const finalDeck = [...deck];
    const replacements: Array<{removed: ScryfallCard; added: ScryfallCard; reason: string}> = [];
    const warnings: string[] = [];
    
    let totalCost = this.commanderPrice + finalDeck.reduce((sum, card) => sum + card.price_used, 0);
    
    // If over budget, replace expensive cards with cheaper alternatives
    while (totalCost > this.constraints.total_budget && finalDeck.length > 90) {
      const expensiveCard = this.findMostExpensiveReplaceableCard(finalDeck, roleQuotas);
      if (!expensiveCard) break;
      
      const usedNames = new Set(finalDeck.map(c => c.name));
      const replacement = this.findCheaperAlternative(
        allCandidates,
        expensiveCard.role,
        expensiveCard.price_used - 1,
        usedNames
      );
      
      if (replacement) {
        const newPrice = extractCardPrice(replacement, this.constraints.prefer_cheapest);
        const newDeckCard = this.createDeckCard(replacement, expensiveCard.role, newPrice);
        
        // Replace in deck
        const index = finalDeck.findIndex(c => c.name === expensiveCard.name);
        if (index !== -1) {
          finalDeck[index] = newDeckCard;
          totalCost = totalCost - expensiveCard.price_used + newPrice;
          
          replacements.push({
            removed: expensiveCard,
            added: replacement,
            reason: `Budget optimization: replaced $${expensiveCard.price_used.toFixed(2)} card with $${newPrice.toFixed(2)} alternative`
          });
        }
      } else {
        // No cheaper alternative found, just remove the card
        const index = finalDeck.findIndex(c => c.name === expensiveCard.name);
        if (index !== -1) {
          finalDeck.splice(index, 1);
          totalCost -= expensiveCard.price_used;
          warnings.push(`Removed ${expensiveCard.name} due to budget constraints - no suitable replacement found`);
        }
      }
    }
    
    // CRITICAL: Ensure we always have exactly targetCardCount cards  
    while (finalDeck.length < targetCardCount) {
      const usedNames = new Set(finalDeck.map(c => c.name));
      const remainingBudget = this.constraints.total_budget - totalCost;
      
      // Find the cheapest available card that fits our constraints
      const availableCards = allCandidates
        .filter(card => {
          if (usedNames.has(card.name)) return false;
          const price = extractCardPrice(card, this.constraints.prefer_cheapest);
          return price <= this.constraints.per_card_cap;
        })
        .sort((a, b) => {
          const priceA = extractCardPrice(a, this.constraints.prefer_cheapest);
          const priceB = extractCardPrice(b, this.constraints.prefer_cheapest);
          return priceA - priceB; // Cheapest first
        });
      
      let addedCard = false;
      
      // Try to find a card within remaining budget first
      for (const card of availableCards) {
        const price = extractCardPrice(card, this.constraints.prefer_cheapest);
        if (price <= remainingBudget) {
          const role = this.determineCardRole(card);
          const deckCard = this.createDeckCard(card, role, price);
          finalDeck.push(deckCard);
          totalCost += price;
          addedCard = true;
          break;
        }
      }
      
      // If no card fits in budget, we need to make room by replacing expensive cards
      if (!addedCard && availableCards.length > 0) {
        const cheapestAvailable = availableCards[0];
        const cheapPrice = extractCardPrice(cheapestAvailable, this.constraints.prefer_cheapest);
        const neededBudget = cheapPrice - remainingBudget;
        
        // Find an expensive card to replace
        const expensiveCard = finalDeck
          .sort((a, b) => b.price_used - a.price_used)
          .find(card => card.price_used > cheapPrice + neededBudget);
        
        if (expensiveCard) {
          // Replace expensive card with cheaper alternative
          const index = finalDeck.findIndex(c => c.name === expensiveCard.name);
          if (index !== -1) {
            const role = this.determineCardRole(cheapestAvailable);
            const deckCard = this.createDeckCard(cheapestAvailable, role, cheapPrice);
            
            totalCost = totalCost - expensiveCard.price_used + cheapPrice;
            finalDeck[index] = deckCard;
            
            replacements.push({
              removed: expensiveCard,
              added: cheapestAvailable,
              reason: `Replaced expensive card to ensure ${targetCardCount}-card deck within budget`
            });
            addedCard = true;
          }
        }
      }
      
      // If still can't add a card, add the cheapest available regardless of budget
      if (!addedCard && availableCards.length > 0) {
        const cheapestCard = availableCards[0];
        const price = extractCardPrice(cheapestCard, this.constraints.prefer_cheapest);
        const role = this.determineCardRole(cheapestCard);
        const deckCard = this.createDeckCard(cheapestCard, role, price);
        
        finalDeck.push(deckCard);
        totalCost += price;
        warnings.push(`Added ${cheapestCard.name} over budget to ensure ${targetCardCount}-card deck`);
      }
      
      // Safety check to avoid infinite loop
      if (availableCards.length === 0) {
        warnings.push(`Insufficient unique cards available. Deck has ${finalDeck.length} cards instead of target ${targetCardCount}.`);
        break;
      }
    }
    
    // Final validation - this should never happen now
    if (finalDeck.length !== targetCardCount) {
      warnings.push(`CRITICAL: Final deck has ${finalDeck.length} cards instead of ${targetCardCount}. This should not occur.`);
    }
    
    return {
      finalDeck,
      totalCost,
      replacements,
      warnings
    };
  }

  private findMostExpensiveReplaceableCard(
    deck: DeckCard[],
    roleQuotas: Record<string, RoleQuota>
  ): DeckCard | null {
    // Find the most expensive card that we can replace without going below minimum role requirements
    const replaceableCards = deck.filter(card => {
      const quota = roleQuotas[card.role];
      return quota && quota.current > quota.minimum;
    });
    
    if (replaceableCards.length === 0) {
      // If no cards are replaceable due to role minimums, just find the most expensive
      return deck.sort((a, b) => b.price_used - a.price_used)[0] || null;
    }
    
    return replaceableCards.sort((a, b) => b.price_used - a.price_used)[0];
  }

  private createDeckCard(card: ScryfallCard, role: string, price: number): DeckCard {
    return {
      ...card,
      role: role as CardRole,
      synergy_notes: this.generateSynergyNotes(card, role),
      price_used: price
    };
  }

  private generateSynergyNotes(card: ScryfallCard, role: string): string {
    const notes: string[] = [];
    
    // Add role-based note
    notes.push(`${role} support`);
    
    // Add cost efficiency note
    const price = extractCardPrice(card, this.constraints.prefer_cheapest);
    if (price <= 1) {
      notes.push('budget-friendly');
    } else if (price >= 10) {
      notes.push('premium option');
    }
    
    // Add power level note
    const powerLevel = card.mechanics?.powerLevel || 5;
    if (powerLevel >= 8) {
      notes.push('high power');
    } else if (powerLevel >= 7) {
      notes.push('strong choice');
    }
    
    return notes.join(', ');
  }

  private determineCardRole(card: ScryfallCard): string {
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();
    
    if (type.includes('land')) return 'Land';
    
    // Ramp detection
    if (text.includes('add') && text.includes('mana')) return 'Ramp';
    if (text.includes('search your library for') && text.includes('land')) return 'Ramp';
    
    // Card draw detection
    if (text.includes('draw') && text.includes('card')) return 'Draw/Advantage';
    
    // Removal detection
    if (text.includes('destroy target') || text.includes('exile target')) return 'Removal/Interaction';
    if (text.includes('counter target')) return 'Removal/Interaction';
    
    // Board wipe detection
    if (text.includes('destroy all') || text.includes('exile all')) return 'Board Wipe';
    
    // Tutor detection
    if (text.includes('search your library for') && !text.includes('land')) return 'Tutor';
    
    // Protection detection (new per guide)
    if (text.includes('hexproof') || text.includes('indestructible') || 
        text.includes('protection from') || text.includes('shroud') ||
        text.includes('regenerate') || text.includes('prevent all damage') ||
        text.includes('return') && text.includes('to your hand') ||
        text.includes('flicker') || text.includes('blink')) return 'Protection';
    
    // Equipment that provides protection
    if (type.includes('equipment') && 
        (text.includes('hexproof') || text.includes('shroud') || 
         text.includes('indestructible') || card.name.toLowerCase().includes('boots') ||
         card.name.toLowerCase().includes('greaves'))) return 'Protection';
    
    return 'Synergy/Wincon';
  }

  private isEDHStaple(card: ScryfallCard): boolean {
    const name = card.name.toLowerCase();
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();
    
    // Essential ramp that should override user artifact preferences
    const rampStaples = [
      'sol ring',
      'arcane signet', 
      'command tower',
      'commander\'s sphere',
      'fellwar stone',
      'mind stone',
      'cultivate',
      'kodama\'s reach',
      'rampant growth',
      'farseek'
    ];
    
    // Essential draw/advantage
    const drawStaples = [
      'rhystic study',
      'mystic remora', 
      'smothering tithe',
      'phyrexian arena',
      'sylvan library'
    ];
    
    // Essential removal
    const removalStaples = [
      'swords to plowshares',
      'path to exile',
      'generous gift',
      'beast within',
      'chaos warp',
      'counterspell',
      'negate',
      'swan song'
    ];
    
    // Essential protection
    const protectionStaples = [
      'heroic intervention',
      'teferi\'s protection',
      'boros charm',
      'malakir rebirth',
      'snakeskin veil'
    ];
    
    const allStaples = [...rampStaples, ...drawStaples, ...removalStaples, ...protectionStaples];
    
    // Check exact name match
    if (allStaples.some(staple => name === staple)) {
      return true;
    }
    
    // Special case: Very low CMC efficient cards in their category
    if (card.cmc <= 2) {
      // Low CMC ramp artifacts
      if (type.includes('artifact') && 
          (text.includes('{t}: add') || text.includes('add one mana'))) {
        return true;
      }
      
      // Low CMC efficient removal
      if ((type.includes('instant') || type.includes('sorcery')) &&
          (text.includes('destroy target') || text.includes('exile target') || 
           text.includes('counter target'))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Check if we can add a card of this type based on quotas
   */
  private canAddCardType(card: ScryfallCard, cardTypeQuotas: Record<string, {target: number, current: number}>): boolean {
    if (Object.keys(cardTypeQuotas).length === 0) return true; // No limits if no quotas set
    
    const cardType = this.getCardType(card);
    const quota = cardTypeQuotas[cardType];
    
    if (!quota) return true; // No limit for this type
    
    // STRICT ENFORCEMENT: Only allow critical staples to exceed quota by 1
    if (this.isCriticalStaple(card) && quota.current < quota.target + 1) {
      return true;
    }
    
    return quota.current < quota.target;
  }

  /**
   * Only the most essential cards (Sol Ring level) can override quotas
   */
  private isCriticalStaple(card: ScryfallCard): boolean {
    const name = card.name.toLowerCase();
    const criticalStaples = [
      'sol ring',           // Universal fast mana
      'command tower',      // Universal fixing
      'arcane signet'       // Universal ramp
    ];
    
    return criticalStaples.includes(name);
  }

  /**
   * Update card type quota count when a card is added
   */
  private updateCardTypeQuota(card: ScryfallCard, cardTypeQuotas: Record<string, {target: number, current: number}>): void {
    if (Object.keys(cardTypeQuotas).length === 0) return;
    
    const cardType = this.getCardType(card);
    const quota = cardTypeQuotas[cardType];
    
    if (quota) {
      quota.current++;
      console.log(`💎 Added ${cardType}: ${card.name} (${quota.current}/${quota.target})`);
    }
  }

  /**
   * Determine primary card type for quota tracking
   */
  private getCardType(card: ScryfallCard): string {
    const typeLine = card.type_line.toLowerCase();
    
    // Prioritize creature type (since many types can be creatures)
    if (typeLine.includes('creature')) return 'creatures';
    if (typeLine.includes('artifact')) return 'artifacts';
    if (typeLine.includes('enchantment')) return 'enchantments';
    if (typeLine.includes('instant')) return 'instants';
    if (typeLine.includes('sorcery')) return 'sorceries';
    if (typeLine.includes('planeswalker')) return 'planeswalkers';
    
    return 'other'; // For lands and other types
  }

  private getCardTypeWeightMultiplier(card: ScryfallCard): number {
    const weights = this.constraints.card_type_weights;
    if (!weights) return 1.0; // Neutral if no weights specified
    
    const cardType = card.type_line.toLowerCase();
    let userWeightScore = 5; // Default neutral weight
    
    // Determine the card's primary type weight
    if (cardType.includes('creature')) {
      userWeightScore = weights.creatures;
    } else if (cardType.includes('artifact') && !cardType.includes('creature')) {
      userWeightScore = weights.artifacts;
    } else if (cardType.includes('enchantment') && !cardType.includes('creature')) {
      userWeightScore = weights.enchantments;
    } else if (cardType.includes('instant')) {
      userWeightScore = weights.instants;
    } else if (cardType.includes('sorcery')) {
      userWeightScore = weights.sorceries;
    } else if (cardType.includes('planeswalker')) {
      userWeightScore = weights.planeswalkers;
    }
    
    // Convert weight to multiplier - make low weights much more aggressive
    if (userWeightScore === 0) {
      return 0.01; // Nearly exclude (should have been filtered out earlier)
    } else if (userWeightScore === 1) {
      return 0.05; // Extreme de-prioritization
    } else if (userWeightScore === 2) {
      return 0.15; // Very heavy de-prioritization
    } else if (userWeightScore === 3) {
      return 0.4; // Heavy de-prioritization
    } else if (userWeightScore === 4) {
      return 0.7; // Moderate de-prioritization
    } else if (userWeightScore === 5) {
      return 1.0; // Neutral
    } else if (userWeightScore === 6) {
      return 1.3; // Slight prioritization
    } else if (userWeightScore === 7) {
      return 1.8; // Moderate prioritization
    } else if (userWeightScore === 8) {
      return 2.5; // High prioritization  
    } else if (userWeightScore === 9) {
      return 3.5; // Very high prioritization
    } else {
      return 5.0; // Maximum prioritization
    }
  }
}
import { ScryfallCard, DeckCard, GeneratedDeck, GenerationConstraints, CardRole, CardTypeWeights } from './types';
import { scryfallClient } from './scryfall';
import { ServerCardDatabase } from './server-card-database';
import { 
  isColorIdentityValid, 
  applyConstraintFilters, 
  categorizeCardRole, 
  isCardLegalInCommander,
  validateDeckComposition 
} from './rules';
import { 
  getPowerLevelConfig, 
  adjustDeckCompositionForCommander, 
  calculateInteractionSuite,
  getTutorSuite,
  getFastManaSuite 
} from './power';
import { extractCardPrice } from './pricing';
import { BudgetOptimizer } from './budget-optimizer';
import { percentageWeightingSystem, TypeQuotas } from './percentage-weighting';
import { strategyDetector } from './strategy-detection';
import { mechanicalRecommendationEngine } from './mechanical-recommendation';
import { cardMechanicsTagger } from './card-mechanics-tagger';

export class DeckGenerator {
  private scryfallClient = scryfallClient;
  private localDatabase = new ServerCardDatabase();

  async generateDeck(
    commanderName: string,
    constraints: GenerationConstraints
  ): Promise<GeneratedDeck> {
    try {
      // Initialize local database for performance
      await this.localDatabase.initialize();
      // Step 1: Validate and get commander
      const commanderValidation = await this.scryfallClient.validateCommander(commanderName);
      if (!commanderValidation.isValid || !commanderValidation.card) {
        throw new Error(commanderValidation.error || 'Invalid commander');
      }
      
      const commander = commanderValidation.card;
      const colorIdentity = commander.color_identity;
      
      // Step 2: Get power level configuration and merge with constraints
      const powerConfig = getPowerLevelConfig(constraints.power_level);
      const enhancedConstraints: GenerationConstraints = {
        ...constraints,
        combo_tolerance: powerConfig.combo_tolerance
      };
      
      // Generate non-lands first to calculate proper land count
      const tempDeckComposition = adjustDeckCompositionForCommander(
        powerConfig.deck_composition,
        commander.cmc,
        colorIdentity
      );
      
      // Generate non-land pools to analyze for land formula
      const tempNonLandPools = await this.generateNonLandCardPools(commander, enhancedConstraints, tempDeckComposition);
      const tempSelectedNonLandCards = await this.selectNonLandCards(tempNonLandPools, tempDeckComposition, enhancedConstraints, colorIdentity);
      
      // Apply budget optimization to get representative non-land deck
      const tempBudgetOptimizer = new BudgetOptimizer(enhancedConstraints, extractCardPrice(commander, enhancedConstraints.prefer_cheapest));
      const tempNonLandResult = tempBudgetOptimizer.optimizeDeckForBudget(
        tempSelectedNonLandCards,
        this.convertCompositionToNonLandRoleTargets(tempDeckComposition, enhancedConstraints),
        75 // Assume ~75 non-lands for calculation
      );
      
      // Calculate optimal land count using Frank Karsten's formula
      const optimalLandCount = this.calculateOptimalLandCount(tempNonLandResult.finalDeck);
      
      // Update deck composition with calculated land count
      const deckComposition = {
        ...tempDeckComposition,
        lands: optimalLandCount
      };
      
      // Step 3: Generate NON-LAND card pools only
      const nonLandPools = await this.generateNonLandCardPools(commander, enhancedConstraints, deckComposition);
      
      // Step 4: Select non-land cards based on roles and constraints
      const selectedNonLandCards = await this.selectNonLandCards(nonLandPools, deckComposition, enhancedConstraints, colorIdentity);
      
      // Check if we have enough cards to make a deck - need at least 60 for good optimization
      if (selectedNonLandCards.length < 60) {
        throw new Error(`Unable to find enough legal non-land cards for this commander. Found only ${selectedNonLandCards.length} cards. Need at least 60 unique cards for proper deck optimization. Try adjusting your constraints or budget.`);
      }
      
      // Step 5: Apply budget optimization to non-land cards (target: 99 - land_count)
      const commanderPrice = extractCardPrice(commander, enhancedConstraints.prefer_cheapest);
      const targetNonLandCount = 99 - deckComposition.lands;
      
      // Convert percentage weighting quotas to budget optimizer format (for actual deck size, not pool size)
      const actualQuotas = percentageWeightingSystem.calculateTypeQuotas(enhancedConstraints.card_type_weights, targetNonLandCount);
      const budgetQuotas = this.convertQuotasToBudgetFormat(actualQuotas);
      
      console.log(`🎯 Final deck quotas (${targetNonLandCount} non-land cards):`, {
        creatures: budgetQuotas.creatures.target,
        artifacts: budgetQuotas.artifacts.target,
        enchantments: budgetQuotas.enchantments.target,
        instants: budgetQuotas.instants.target,
        sorceries: budgetQuotas.sorceries.target,
        planeswalkers: budgetQuotas.planeswalkers.target
      });
      
      const budgetOptimizer = new BudgetOptimizer(enhancedConstraints, commanderPrice);
      const nonLandOptimizationResult = budgetOptimizer.optimizeDeckForBudget(
        selectedNonLandCards,
        this.convertCompositionToNonLandRoleTargets(deckComposition, enhancedConstraints),
        targetNonLandCount,
        budgetQuotas
      );
      
      // Step 6: Generate proper manabase based on final non-land cards
      const finalLands = await this.generateOptimalManabase(
        commander,
        nonLandOptimizationResult.finalDeck,
        deckComposition.lands,
        enhancedConstraints
      );
      
      console.log(`Generated ${finalLands.length} lands (target was ${deckComposition.lands})`);
      
      // Step 7: Combine final deck and enforce exact count
      let finalNonLandCards = [...nonLandOptimizationResult.finalDeck];
      const finalLandCards = [...finalLands];
      
      // Adjust deck size to exactly 99 cards
      const totalCards = finalNonLandCards.length + finalLandCards.length;
      if (totalCards > 99) {
        const excessCards = totalCards - 99;
        console.warn(`Deck has ${totalCards} cards, removing ${excessCards} least synergistic non-land cards`);
        
        // Sort non-land cards by synergy score (lowest first) and trim
        finalNonLandCards = this.trimLeastSynergisticCards(finalNonLandCards, commander, excessCards, enhancedConstraints);
      } else if (totalCards < 99) {
        const neededCards = 99 - totalCards;
        console.warn(`Deck has only ${totalCards} cards, need to add ${neededCards} more non-land cards`);
        
        // Add more non-land cards from the original pool
        const usedNames = new Set([...finalNonLandCards, ...finalLandCards].map(card => card.name));
        const unusedCandidates = selectedNonLandCards.filter(card => !usedNames.has(card.name));
        
        // Sort by synergy and take the best remaining cards
        const scoredCandidates = unusedCandidates.map(card => ({
          card,
          synergyScore: this.calculateCardSynergy(card, commander, [...finalNonLandCards, ...finalLandCards], enhancedConstraints)
        })).sort((a, b) => b.synergyScore - a.synergyScore);
        
        // Add the needed cards
        for (let i = 0; i < Math.min(neededCards, scoredCandidates.length); i++) {
          finalNonLandCards.push(scoredCandidates[i].card);
        }
        
        console.log(`Added ${Math.min(neededCards, scoredCandidates.length)} cards. Pool had ${unusedCandidates.length} unused candidates.`);
      }
      
      console.log(`Final deck composition: ${finalNonLandCards.length} non-lands + ${finalLandCards.length} lands = ${finalNonLandCards.length + finalLandCards.length} total`);
      
      // Rebuild final deck
      let finalDeck = [...finalNonLandCards, ...finalLandCards];
      
      // Step 8: Remove any illegal cards and replace them
      finalDeck = await this.removeIllegalCardsAndReplace(finalDeck, commander, enhancedConstraints);
      
      // Ensure exactly 99 cards (excluding commander)
      console.log(`🎯 Final deck composition before size check: ${finalDeck.length} cards (${finalNonLandCards.length} non-lands + ${finalLandCards.length} lands)`);
      if (finalDeck.length !== 99) {
        console.warn(`🚨 Deck size mismatch: ${finalDeck.length} cards instead of 99. Adjusting...`);
        if (finalDeck.length < 99) {
          console.log(`📈 Need to add ${99 - finalDeck.length} more cards. Available candidates: ${selectedNonLandCards.length}`);
          // Add more cards from unused candidates
          finalDeck = await this.fillToExactCount(finalDeck, selectedNonLandCards, commander, enhancedConstraints, 99);
        } else if (finalDeck.length > 99) {
          console.log(`📉 Need to remove ${finalDeck.length - 99} cards`);
          // Remove least synergistic cards to get to exactly 99
          finalDeck = this.trimLeastSynergisticCards(finalDeck, commander, finalDeck.length - 99, enhancedConstraints);
        }
        console.log(`✅ After adjustment: ${finalDeck.length} cards`);
      } else {
        console.log(`✅ Perfect deck size: ${finalDeck.length} cards`);
      }

      const { nonlandCards, lands } = this.separateCardTypes(finalDeck);
      const validation = validateDeckComposition(commander, finalDeck);
      
      // Calculate total price and enforce budget
      const landsCost = finalLandCards.reduce((sum, land) => 
        sum + extractCardPrice(land, enhancedConstraints.prefer_cheapest), 0);
      const totalPrice = nonLandOptimizationResult.totalCost + landsCost;
      
      // If over budget, replace expensive lands with basics
      if (totalPrice > enhancedConstraints.total_budget) {
        const overage = totalPrice - enhancedConstraints.total_budget;
        console.warn(`Deck over budget by $${overage.toFixed(2)}, replacing expensive lands with basics`);
        console.log(`Land count before budget adjustment: ${finalLandCards.length}`);
        
        // Replace most expensive utility lands with basics until under budget
        finalLandCards.sort((a, b) => extractCardPrice(b, enhancedConstraints.prefer_cheapest) - 
                                     extractCardPrice(a, enhancedConstraints.prefer_cheapest));
        
        let currentOverage = overage;
        for (let i = 0; i < finalLandCards.length && currentOverage > 0; i++) {
          const land = finalLandCards[i];
          const landPrice = extractCardPrice(land, enhancedConstraints.prefer_cheapest);
          
          // Only replace non-basic lands
          const basicLandNames = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];
          if (!basicLandNames.includes(land.name) && landPrice > 0.5) {
            // Replace with cheapest basic for the commander's colors
            const basicName = this.getCheapestBasicForColors(colorIdentity);
            if (basicName) {
              try {
                const basicLand = await this.scryfallClient.getCardByName(basicName);
                finalLandCards[i] = {
                  ...basicLand,
                  role: 'Land',
                  synergy_notes: `Basic ${basicName.replace(/s$/, '')} mana source`,
                  price_used: extractCardPrice(basicLand, enhancedConstraints.prefer_cheapest)
                };
                currentOverage -= landPrice - extractCardPrice(basicLand, enhancedConstraints.prefer_cheapest);
              } catch (error) {
                console.error(`Error fetching basic land ${basicName}:`, error);
              }
            }
          }
        }
        
        console.log(`Land count after budget adjustment: ${finalLandCards.length}`);
        // Lands were updated, final deck will be recalculated below
      }
      
      // Recalculate final total price consistently with budget checking logic
      const finalLandsCost = finalLandCards.reduce((sum, land) => 
        sum + extractCardPrice(land, enhancedConstraints.prefer_cheapest), 0);
      
      // Use the actual optimized cost from budget optimizer for non-lands
      // This ensures consistency with the budget checks performed earlier
      const finalTotalPrice = nonLandOptimizationResult.totalCost + finalLandsCost + commanderPrice;
      
      // Final budget validation
      const budgetWarnings: string[] = [];
      if (finalTotalPrice > enhancedConstraints.total_budget) {
        const overage = finalTotalPrice - enhancedConstraints.total_budget;
        budgetWarnings.push(`BUDGET WARNING: Final deck costs $${finalTotalPrice.toFixed(2)}, exceeding budget of $${enhancedConstraints.total_budget} by $${overage.toFixed(2)}`);
        console.warn(`Final budget validation failed: $${finalTotalPrice.toFixed(2)} > $${enhancedConstraints.total_budget}`);
      }
      
      // Validate individual card prices against per-card cap
      const expensiveCards = finalDeck.filter(card => {
        const cardPrice = extractCardPrice(card, enhancedConstraints.prefer_cheapest);
        return cardPrice > enhancedConstraints.per_card_cap;
      });
      
      if (expensiveCards.length > 0) {
        const expensiveCardNames = expensiveCards.map(card => {
          const price = extractCardPrice(card, enhancedConstraints.prefer_cheapest);
          return `${card.name} ($${price.toFixed(2)})`;
        }).join(', ');
        budgetWarnings.push(`PER-CARD BUDGET WARNING: ${expensiveCards.length} cards exceed per-card limit of $${enhancedConstraints.per_card_cap}: ${expensiveCardNames}`);
        console.warn(`Per-card budget validation failed: ${expensiveCards.length} cards exceed $${enhancedConstraints.per_card_cap} limit`);
      }
      
      return {
        commander: {
          ...commander,
          role: 'Commander',
          synergy_notes: 'Deck commander',
          price_used: commanderPrice
        },
        nonland_cards: nonlandCards,
        lands: lands,
        total_price: finalTotalPrice,
        role_breakdown: this.calculateRoleBreakdown(finalDeck),
        warnings: [...validation.errors, ...nonLandOptimizationResult.warnings, ...budgetWarnings],
        generation_notes: this.generateNotes(commander, enhancedConstraints, nonLandOptimizationResult),
        deck_explanation: ''
      };
      
    } catch (error) {
      console.error('Deck generation failed:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred during deck generation. Please try again with different constraints.');
    }
  }

  private async generateNonLandCardPools(
    commander: ScryfallCard,
    constraints: GenerationConstraints,
    composition: any
  ): Promise<Record<string, ScryfallCard[]>> {
    // Use the new structured pipeline approach
    return await this.generateStructuredCardPools(commander, constraints, composition);
  }

  /**
   * Structured Pipeline Approach for Card Selection:
   * 1. Color filtering first
   * 2. Keyword synergies second  
   * 3. User weights applied third
   * 4. EDH ratio-based filtering fourth
   */
  private async generateStructuredCardPools(
    commander: ScryfallCard,
    constraints: GenerationConstraints,
    composition: any
  ): Promise<Record<string, ScryfallCard[]>> {
    const colorIdentity = commander.color_identity;
    console.log(`🎯 Starting structured pipeline for ${commander.name} with colors [${colorIdentity.join(', ')}]`);
    
    // PHASE 1: COLOR FILTERING - Get all cards in commander's color identity
    console.log('📋 Phase 1: Color Filtering');
    const colorFilteredCards = await this.getCardsInColorIdentity(colorIdentity, constraints, commander);
    console.log(`   Found ${colorFilteredCards.length} cards in color identity`);
    
    // PHASE 2: KEYWORD SYNERGIES - Analyze commander and find synergistic keywords
    console.log('🔍 Phase 2: Keyword Synergy Analysis');
    const keywordSynergyCards = await this.applyKeywordSynergyFiltering(
      colorFilteredCards, 
      commander, 
      constraints
    );
    console.log(`   Identified ${keywordSynergyCards.length} cards with keyword synergies`);
    
    // PHASE 3: USER WEIGHTS - Apply card type preferences and theme weights
    console.log('⚖️ Phase 3: User Weight Application');
    const userWeightedCards = await this.applyUserWeightFiltering(
      keywordSynergyCards,
      commander,
      constraints
    );
    console.log(`   ${userWeightedCards.length} cards after user weight filtering`);
    
    // PHASE 4: EDH RATIO FILTERING - Apply deck building conventions
    console.log('🏗️ Phase 4: EDH Ratio-Based Role Assignment');
    const roleBasedPools = await this.applyEDHRatioFiltering(
      userWeightedCards,
      commander,
      constraints,
      composition
    );
    
    console.log('✅ Structured pipeline complete');
    return roleBasedPools;
  }

  /**
   * PHASE 1: COLOR FILTERING
   * Get all cards that are legal in the commander's color identity
   */
  private async getCardsInColorIdentity(
    colorIdentity: string[],
    constraints: GenerationConstraints,
    commander: ScryfallCard
  ): Promise<ScryfallCard[]> {
    const allCards: ScryfallCard[] = [];
    
    // Build color identity query string
    const colorQuery = colorIdentity.length > 0 
      ? `color<=${colorIdentity.join('')}` 
      : 'colorless';
    
    // Base query for all legal cards in color identity
    const baseQuery = `${colorQuery} legal:commander -type:land`;
    
    try {
      console.log(`   Searching with query: ${baseQuery}`);
      const searchResults = await this.searchCardsLocally(baseQuery, colorIdentity, 10000);
      
      if (searchResults && searchResults.length > 0) {
        // Apply basic constraint filters (ban list, un-sets, etc.)
        const filteredCards = applyConstraintFilters(searchResults, constraints, commander);
        allCards.push(...filteredCards);
        
        console.log(`   Added ${filteredCards.length} cards from base search`);
      }
      
      // Also search for colorless artifacts and utility cards
      if (colorIdentity.length > 0) {
        const colorlessQuery = 'color:colorless legal:commander -type:land (type:artifact OR oracle:"any color")';
        console.log(`   Searching colorless cards: ${colorlessQuery}`);
        
        const colorlessResults = await this.searchCardsLocally(colorlessQuery, colorIdentity, 10000);
        if (colorlessResults && colorlessResults.length > 0) {
          const filteredColorless = applyConstraintFilters(colorlessResults, constraints, commander);
          allCards.push(...filteredColorless);
          console.log(`   Added ${filteredColorless.length} colorless cards`);
        }
      }
      
    } catch (error) {
      console.error('Error in color filtering phase:', error);
      // Fallback to empty array, next phases will handle this gracefully
    }
    
    // Remove duplicates based on name
    const uniqueCards = this.removeDuplicateCards(allCards);
    console.log(`   Total unique cards after color filtering: ${uniqueCards.length}`);
    
    return uniqueCards;
  }

  /**
   * PHASE 2: KEYWORD SYNERGY FILTERING
   * Analyze commander abilities and enhance cards that synergize with them
   */
  private async applyKeywordSynergyFiltering(
    cards: ScryfallCard[],
    commander: ScryfallCard,
    constraints: GenerationConstraints
  ): Promise<ScryfallCard[]> {
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderType = commander.type_line.toLowerCase();
    const commanderKeywords = commander.keywords || [];
    
    // Analyze commander for key synergy themes
    const synergyThemes = this.analyzeCommanderSynergies(commander);
    console.log(`   Commander synergy themes: ${synergyThemes.map(t => t.theme).join(', ')}`);
    
    // Score each card based on how well it synergizes with the commander
    const scoredCards = cards.map(card => {
      let synergyScore = 0;
      const cardText = (card.oracle_text || '').toLowerCase();
      const cardType = card.type_line.toLowerCase();
      const cardKeywords = card.keywords || [];
      
      // Keyword synergies
      for (const keyword of commanderKeywords) {
        if (cardKeywords.includes(keyword) || cardText.includes(keyword.toLowerCase())) {
          synergyScore += 15; // High bonus for shared keywords
        }
      }
      
      // Theme-based synergies
      for (const theme of synergyThemes) {
        if (this.cardMatchesTheme(card, theme)) {
          synergyScore += theme.priority;
        }
      }
      
      // Tribal synergies (enhanced with plural detection)
      const commanderCreatureTypes = this.extractCreatureTypes(commanderType);
      for (const creatureType of commanderCreatureTypes) {
        const plural = this.getCreatureTypePlural(creatureType);
        
        if (cardType.includes(creatureType) || 
            cardText.includes(creatureType) || 
            cardText.includes(plural)) {
          synergyScore += 20; // High bonus for tribal synergy
        }
      }
      
      // Functional synergies (e.g., ETB effects, tokens, +1/+1 counters)
      if (commanderText.includes('enters the battlefield') && cardText.includes('enters the battlefield')) {
        synergyScore += 10;
      }
      if (commanderText.includes('token') && cardText.includes('token')) {
        synergyScore += 12;
      }
      if (commanderText.includes('+1/+1') && cardText.includes('+1/+1')) {
        synergyScore += 12;
      }
      
      return { card, synergyScore };
    });
    
    // Sort by synergy score and return enhanced list
    scoredCards.sort((a, b) => b.synergyScore - a.synergyScore);
    
    // Keep cards with meaningful synergy (score > 0) and ensure type diversity
    const synergyCards = scoredCards.filter(sc => sc.synergyScore > 0);
    
    // CRITICAL FIX: Preserve card type diversity in non-synergy cards
    const nonSynergyCards = scoredCards.filter(sc => sc.synergyScore === 0);
    const nonSynergyByType: Record<string, typeof scoredCards> = {
      creatures: [],
      artifacts: [],
      enchantments: [],
      instants: [],
      sorceries: [],
      planeswalkers: [],
      other: []
    };
    
    // Categorize non-synergy cards by type
    for (const sc of nonSynergyCards) {
      const type = sc.card.type_line.toLowerCase();
      if (type.includes('creature')) nonSynergyByType.creatures.push(sc);
      else if (type.includes('artifact')) nonSynergyByType.artifacts.push(sc);
      else if (type.includes('enchantment')) nonSynergyByType.enchantments.push(sc);
      else if (type.includes('instant')) nonSynergyByType.instants.push(sc);
      else if (type.includes('sorcery')) nonSynergyByType.sorceries.push(sc);
      else if (type.includes('planeswalker')) nonSynergyByType.planeswalkers.push(sc);
      else nonSynergyByType.other.push(sc);
    }
    
    // Keep a diverse selection of non-synergy cards (preserve all enchantments, instants, sorceries)
    const topNonSynergyCards = [
      ...nonSynergyByType.creatures.slice(0, 300),
      ...nonSynergyByType.artifacts.slice(0, 200),
      ...nonSynergyByType.enchantments, // Keep ALL enchantments
      ...nonSynergyByType.instants,     // Keep ALL instants  
      ...nonSynergyByType.sorceries,    // Keep ALL sorceries
      ...nonSynergyByType.planeswalkers.slice(0, 20),
      ...nonSynergyByType.other.slice(0, 50)
    ];
    
    const finalCards = [...synergyCards, ...topNonSynergyCards].map(sc => sc.card);
    
    console.log(`   High synergy cards: ${synergyCards.length}, Generic cards: ${topNonSynergyCards.length}`);
    return finalCards;
  }

  private cardMatchesTheme(card: ScryfallCard, theme: { theme: string; keywords: string[]; priority: number }): boolean {
    const cardText = (card.oracle_text || '').toLowerCase();
    const cardType = card.type_line.toLowerCase();
    
    return theme.keywords.some(keyword => 
      cardText.includes(keyword) || cardType.includes(keyword)
    );
  }

  /**
   * PHASE 3: USER WEIGHT FILTERING
   * Apply user preferences for card types and themes based on sliders
   */
  private async applyUserWeightFiltering(
    cards: ScryfallCard[],
    commander: ScryfallCard,
    constraints: GenerationConstraints
  ): Promise<ScryfallCard[]> {
    const weights = constraints.card_type_weights;
    if (!weights) {
      console.log('   No user weights specified, keeping all cards');
      return cards;
    }
    
    console.log(`🎚️ Applying NEW percentage-based weights: creatures=${weights.creatures}, artifacts=${weights.artifacts}, enchantments=${weights.enchantments}, instants=${weights.instants}, sorceries=${weights.sorceries}, planeswalkers=${weights.planeswalkers}`);
    
    // Convert ScryfallCard[] to LocalCardData[] for percentage system compatibility
    const localCards = cards.map(card => ({
      ...card,
      set_code: card.set || '',
      set_name: card.set_name || '',
      rarity: (card.rarity || 'common') as any,
      collector_number: card.collector_number || '',
      legalities: card.legalities,
      prices: card.prices,
      last_updated: new Date().toISOString(),
      scryfall_uri: card.scryfall_uri || `https://scryfall.com/card/${card.set}/${card.id}`,
      flavor_text: '',
      power: '',
      toughness: '',
      loyalty: ''
    }));
    
    // Calculate quotas for a proportionally larger pool but maintain user weight intentions
    // Instead of 3x multiplier, use 2x to reduce selection while maintaining proportions
    const poolMultiplier = 2; 
    const quotas = percentageWeightingSystem.calculateTypeQuotas(weights, 60 * poolMultiplier);
    
    // Apply quotas to get filtered cards with proper distribution
    const { filteredCards, typeDistribution } = percentageWeightingSystem.applyQuotasToCardPool(
      localCards,
      quotas
    );
    
    console.log(`✅ Percentage system applied: ${Object.entries(typeDistribution).map(([type, count]) => `${type}=${count}`).join(', ')}`);
    console.log(`📊 Filtered pool: ${filteredCards.length} cards (${poolMultiplier}x target for selection flexibility)`);
    
    // Convert back to ScryfallCard[] for compatibility
    return filteredCards.map(card => ({
      id: card.id,
      name: card.name,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      type_line: card.type_line,
      oracle_text: card.oracle_text,
      color_identity: card.color_identity,
      colors: card.colors,
      legalities: card.legalities,
      prices: card.prices,
      edhrec_rank: card.edhrec_rank,
      keywords: card.keywords,
      set: card.set_code,
      set_name: card.set_name,
      image_uris: card.image_uris
    }));
  }

  /**
   * PHASE 4: EDH RATIO-BASED FILTERING  
   * Create a comprehensive pool and let the budget optimizer handle final selection
   */
  private async applyEDHRatioFiltering(
    cards: ScryfallCard[],
    commander: ScryfallCard,
    constraints: GenerationConstraints,
    composition: any
  ): Promise<Record<string, ScryfallCard[]>> {
    console.log(`   Creating comprehensive card pool for budget optimizer`);
    
    // Filter out cards that make no sense in EDH singleton format
    const filteredCards = cards.filter(card => {
      const cardText = (card.oracle_text || '').toLowerCase();
      const cardName = card.name.toLowerCase();
      
      // Exception: Cards that explicitly allow multiples override singleton rule
      if (cardText.includes('any number of cards named') || 
          cardText.includes('you may have any number') ||
          cardText.includes('a deck can have any number')) {
        return true; // Allow cards like Relentless Rats, Shadowborn Apostle, etc.
      }
      
      // Remove cards that rely on having multiples in your deck
      const multipleReliantPatterns = [
        // Storm cards that scale with spell count
        'storm',
        // Cards that count copies of themselves
        'for each card named',
        'for each creature named', 
        'for each ' + cardName.replace(/[^a-z\s]/g, ''), // Self-referencing
        // Ritual spells that build off each other
        'add.*for each.*in your graveyard',
        // Cards that reference "other cards with the same name"
        'other.*with the same name',
        'another.*with the same name'
      ];
      
      // Specific problematic cards that only work with multiples
      const singletonProblems = [
        'rite of flame',      // Adds R for each Rite of Flame in graveyard
        'seething song',      // Storm enabler, useless alone
        'desperate ritual',   // Storm enabler, useless alone
        'pyretic ritual',     // Storm enabler, useless alone
        'cabal ritual',       // Threshold/storm, but marginal alone
        'dark ritual',        // Fast mana that's only good in very fast combo
        'lotus petal',        // Similar to dark ritual in most EDH contexts
        'manamorphose',       // Card filtering that requires specific deck construction
        'gitaxian probe',     // Free spell that only matters for storm/count
        'street wraith',      // Free cycle only matters for storm/count
        'mishra\'s bauble',   // Artifact that only helps storm
        'tormod\'s crypt',    // Zero cost only matters for storm usually
        'chromatic sphere',   // Mana fixing artifact mainly for storm
        'chromatic star'      // Similar to chromatic sphere
      ];
      
      // Check text patterns first
      if (multipleReliantPatterns.some(pattern => cardText.includes(pattern))) {
        console.log(`   Filtering out multiple-reliant card: ${card.name} (pattern: ${multipleReliantPatterns.find(p => cardText.includes(p))})`);
        return false;
      }
      
      // Check specific problematic cards
      if (singletonProblems.some(problem => cardName.includes(problem))) {
        console.log(`   Filtering out singleton-problematic card: ${card.name}`);
        return false;
      }
      
      return true;
    });
    
    // Return all filtered cards as one big pool - let the budget optimizer handle role-based selection
    // The budget optimizer will use EDH ratios and user weights to make the final decisions
    console.log(`   Final pool size: ${filteredCards.length} cards`);
    
    return {
      all_cards: filteredCards  // Single pool containing all viable cards
    };
  }

  private mapRoleToCategory(role: string): string | null {
    const roleMap: Record<string, string> = {
      'Ramp': 'ramp',
      'Draw/Advantage': 'draw', 
      'Removal/Interaction': 'removal',
      'Board Wipe': 'removal', // Board wipes count as removal
      'Protection': 'protection',
      'Tutor': 'tutors',
      'Synergy/Wincon': 'synergy'
    };
    
    return roleMap[role] || 'synergy'; // Default to synergy if unknown
  }

  private optimizeRolePool(
    cards: ScryfallCard[],
    config: { min: number; max: number; priority: string },
    constraints: GenerationConstraints
  ): ScryfallCard[] {
    if (cards.length === 0) return [];
    
    // Sort cards based on the priority criteria
    let sortedCards: ScryfallCard[];
    
    switch (config.priority) {
      case 'efficiency':
        // For ramp: prioritize low CMC and good value
        sortedCards = cards.sort((a, b) => {
          const cmcDiff = a.cmc - b.cmc;
          if (cmcDiff !== 0) return cmcDiff;
          return (a.cmc || 0) - (b.cmc || 0); // Prefer lower cost if equal
        });
        break;
        
      case 'value':
        // For card draw: prioritize card advantage and low CMC
        sortedCards = cards.sort((a, b) => {
          // Prefer cards with card advantage text, then lower CMC
          const aHasAdvantage = (a.oracle_text || '').toLowerCase().includes('draw');
          const bHasAdvantage = (b.oracle_text || '').toLowerCase().includes('draw');
          if (aHasAdvantage && !bHasAdvantage) return -1;
          if (!aHasAdvantage && bHasAdvantage) return 1;
          return (a.cmc || 0) - (b.cmc || 0);
        });
        break;
        
      case 'versatility':
        // For removal: prioritize flexible answers
        sortedCards = cards.sort((a, b) => {
          const aVersatile = (a.oracle_text || '').toLowerCase().includes('any target') ||
                            (a.oracle_text || '').toLowerCase().includes('permanent');
          const bVersatile = (b.oracle_text || '').toLowerCase().includes('any target') ||
                            (b.oracle_text || '').toLowerCase().includes('permanent');
          
          if (aVersatile && !bVersatile) return -1;
          if (!aVersatile && bVersatile) return 1;
          return (a.cmc || 0) - (b.cmc || 0); // Prefer lower cost if equal versatility
        });
        break;
        
      case 'cost':
        // For protection: prioritize low cost options
        sortedCards = cards.sort((a, b) => a.cmc - b.cmc);
        break;
        
      case 'speed':
        // For tutors: prioritize speed and efficiency
        sortedCards = cards.sort((a, b) => {
          const cmcDiff = a.cmc - b.cmc;
          if (cmcDiff !== 0) return cmcDiff;
          // Secondary sort: prefer cards with instant speed or uncounterable
          const aSpeed = (a.oracle_text?.includes('instant speed') || a.type_line.includes('Instant')) ? 0 : 1;
          const bSpeed = (b.oracle_text?.includes('instant speed') || b.type_line.includes('Instant')) ? 0 : 1;
          return aSpeed - bSpeed;
        });
        break;
        
      case 'synergy':
      default:
        // For synergy: maintain existing order (already sorted by synergy in previous phases)
        sortedCards = cards;
        break;
    }
    
    // Return appropriate number of cards based on config
    const targetCount = Math.min(config.max, Math.max(config.min, Math.floor(sortedCards.length * 0.8)));
    return sortedCards.slice(0, targetCount);
  }

  private removeDuplicateCards(cards: ScryfallCard[]): ScryfallCard[] {
    const seen = new Set<string>();
    const unique: ScryfallCard[] = [];
    
    for (const card of cards) {
      if (!seen.has(card.name)) {
        seen.add(card.name);
        unique.push(card);
      }
    }
    
    return unique;
  }

  private analyzeCommanderSynergies(commander: ScryfallCard): Array<{ theme: string; keywords: string[]; priority: number }> {
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderType = commander.type_line.toLowerCase();
    const themes: Array<{ theme: string; keywords: string[]; priority: number }> = [];

    // ETB/enters triggers
    if (commanderText.includes('enters the battlefield') || commanderText.includes('when') && commanderText.includes('enters')) {
      themes.push({
        theme: 'ETB Effects',
        keywords: ['enters the battlefield', 'when', 'enters', 'flicker', 'blink'],
        priority: 15
      });
    }

    // Token creation/synergy
    if (commanderText.includes('token') || commanderText.includes('create')) {
      themes.push({
        theme: 'Token Synergy',
        keywords: ['token', 'create', 'populate', 'sacrifice'],
        priority: 12
      });
    }

    // +1/+1 counters
    if (commanderText.includes('+1/+1') || commanderText.includes('counter')) {
      themes.push({
        theme: 'Counter Synergy', 
        keywords: ['+1/+1', 'counter', 'proliferate', 'evolve'],
        priority: 12
      });
    }

    // Damage/ping effects (important for Norin)
    if (commanderText.includes('damage') || commanderText.includes('deals')) {
      themes.push({
        theme: 'Damage Synergy',
        keywords: ['damage', 'deals', 'whenever', 'each opponent'],
        priority: 18
      });
    }

    // Artifact synergies
    if (commanderType.includes('artifact') || commanderText.includes('artifact')) {
      themes.push({
        theme: 'Artifact Synergy',
        keywords: ['artifact', 'metalcraft', 'affinity'],
        priority: 10
      });
    }

    // Enchantment synergies
    if (commanderType.includes('enchantment') || commanderText.includes('enchantment')) {
      themes.push({
        theme: 'Enchantment Synergy', 
        keywords: ['enchantment', 'constellation', 'aura'],
        priority: 10
      });
    }

    // Graveyard synergies
    if (commanderText.includes('graveyard') || commanderText.includes('dies')) {
      themes.push({
        theme: 'Graveyard Synergy',
        keywords: ['graveyard', 'dies', 'mill', 'flashback', 'delve'],
        priority: 8
      });
    }

    return themes;
  }

  private extractCreatureTypes(typeString: string): string[] {
    const types: string[] = [];
    
    // Common creature types to look for
    const commonTypes = [
      'human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'beast',
      'spirit', 'wizard', 'warrior', 'soldier', 'knight', 'vampire', 'wolf',
      'cat', 'bird', 'snake', 'spider', 'elemental', 'giant', 'dwarf',
      'merfolk', 'treefolk', 'construct', 'golem', 'horror', 'devil'
    ];
    
    for (const type of commonTypes) {
      if (typeString.includes(type)) {
        types.push(type);
      }
    }
    
    return types;
  }

  private async selectNonLandCards(
    pools: Record<string, ScryfallCard[]>,
    composition: any,
    constraints: GenerationConstraints,
    colorIdentity: string[]
  ): Promise<ScryfallCard[]> {
    // Get the comprehensive pool from the structured pipeline
    const allCards = pools.all_cards || [];
    console.log(`   Processing ${allCards.length} cards from comprehensive pool`);
    
    // Remove duplicates
    const seenCards = new Set<string>();
    const uniqueCards = allCards.filter(card => {
      if (seenCards.has(card.name)) {
        return false;
      }
      seenCards.add(card.name);
      return true;
    });
    
    console.log(`   Total unique cards available: ${uniqueCards.length}`);
    return uniqueCards;
  }

  private convertCompositionToNonLandRoleTargets(
    composition: any, 
    constraints?: GenerationConstraints
  ): Record<string, number> {
    // Base EDH targets
    let targets = {
      'Ramp': composition.ramp,
      'Draw/Advantage': composition.draw,
      'Removal/Interaction': composition.removal,
      'Board Wipe': composition.board_wipes || 0,
      'Tutor': composition.tutors,
      'Protection': composition.protection,
      'Synergy/Wincon': composition.synergy
    };

    // MAJOR IMPROVEMENT: Directly translate card type preferences into role composition
    if (constraints?.card_type_weights) {
      const weights = constraints.card_type_weights;
      console.log(`   Translating user weights into role targets: creatures=${weights.creatures}, artifacts=${weights.artifacts}, enchantments=${weights.enchantments}, instants=${weights.instants}, sorceries=${weights.sorceries}`);
      
      // Convert 0-10 weights to multipliers (0=0.2x, 5=1.0x, 10=2.0x)
      const creatureMultiplier = Math.max(0.2, weights.creatures / 5.0);
      const artifactMultiplier = Math.max(0.2, weights.artifacts / 5.0); 
      const enchantmentMultiplier = Math.max(0.2, weights.enchantments / 5.0);
      const instantMultiplier = Math.max(0.2, weights.instants / 5.0);
      const sorceryMultiplier = Math.max(0.2, weights.sorceries / 5.0);
      
      // Store original targets for logging
      const originalTargets = { ...targets };
      
      // Map card types to the roles they primarily occupy:
      
      // Artifacts heavily influence Ramp (Sol Ring, Signets, Talismans, etc.)
      targets['Ramp'] = Math.round(originalTargets['Ramp'] * artifactMultiplier);
      
      // Instants/Sorceries influence Removal and Draw
      const spellMultiplier = (instantMultiplier + sorceryMultiplier) / 2.0;
      targets['Removal/Interaction'] = Math.round(originalTargets['Removal/Interaction'] * spellMultiplier);
      targets['Draw/Advantage'] = Math.round(originalTargets['Draw/Advantage'] * sorceryMultiplier);
      
      // Enchantments influence Protection (many protection effects are enchantments)
      targets['Protection'] = Math.round(originalTargets['Protection'] * enchantmentMultiplier);
      
      // Creatures heavily influence Synergy/Wincon (most synergy pieces are creatures)
      targets['Synergy/Wincon'] = Math.round(originalTargets['Synergy/Wincon'] * creatureMultiplier);
      
      // Maintain minimum EDH requirements regardless of user preferences
      targets['Ramp'] = Math.max(4, targets['Ramp']);
      targets['Draw/Advantage'] = Math.max(4, targets['Draw/Advantage']);
      targets['Removal/Interaction'] = Math.max(4, targets['Removal/Interaction']);
      targets['Protection'] = Math.max(1, targets['Protection']);
      targets['Synergy/Wincon'] = Math.max(6, targets['Synergy/Wincon']);
      
      console.log(`   Role target transformations based on card type weights:`);
      console.log(`     Ramp: ${originalTargets['Ramp']} → ${targets['Ramp']} (artifact weight: ${weights.artifacts}, multiplier: ${artifactMultiplier.toFixed(2)})`);
      console.log(`     Removal: ${originalTargets['Removal/Interaction']} → ${targets['Removal/Interaction']} (spell avg: ${((weights.instants + weights.sorceries)/2).toFixed(1)}, multiplier: ${spellMultiplier.toFixed(2)})`);
      console.log(`     Protection: ${originalTargets['Protection']} → ${targets['Protection']} (enchantment weight: ${weights.enchantments}, multiplier: ${enchantmentMultiplier.toFixed(2)})`);
      console.log(`     Synergy: ${originalTargets['Synergy/Wincon']} → ${targets['Synergy/Wincon']} (creature weight: ${weights.creatures}, multiplier: ${creatureMultiplier.toFixed(2)})`);
      console.log(`     Draw: ${originalTargets['Draw/Advantage']} → ${targets['Draw/Advantage']} (sorcery weight: ${weights.sorceries}, multiplier: ${sorceryMultiplier.toFixed(2)})`);
    }
    
    return targets;
  }

  private async generateOptimalManabase(
    commander: ScryfallCard,
    nonLandCards: DeckCard[],
    landCount: number,
    constraints: GenerationConstraints
  ): Promise<DeckCard[]> {
    const colorIdentity = commander.color_identity;
    const manabase: DeckCard[] = [];
    
    // Step 1: Calculate color requirements from non-land cards
    const colorRequirements = this.calculateColorRequirements(nonLandCards, colorIdentity);
    
    // Step 2: Determine basic land distribution
    const basicLandCounts = this.calculateBasicLandDistribution(colorRequirements, landCount);
    
    // Step 3: Add basic lands
    const basicLandNames: Record<string, string> = {
      'W': 'Plains',
      'U': 'Island',
      'B': 'Swamp', 
      'R': 'Mountain',
      'G': 'Forest'
    };

    for (const [color, count] of Object.entries(basicLandCounts)) {
      const landName = basicLandNames[color];
      if (landName && count > 0) {
        try {
          const basicLand = await this.scryfallClient.getCardByName(landName);
          for (let i = 0; i < count; i++) {
            manabase.push({
              ...basicLand,
              role: 'Land',
              synergy_notes: `Basic ${color} mana source`,
              price_used: extractCardPrice(basicLand, constraints.prefer_cheapest)
            });
          }
        } catch (error) {
          console.error(`Error fetching basic land ${landName}:`, error);
        }
      }
    }
    
    // Step 4: Add utility lands to fill remaining slots
    const remainingSlots = landCount - manabase.length;
    if (remainingSlots > 0) {
      const utilityLands = await this.generateAppropriateNonBasicLands(colorIdentity);
      // Filter to ensure color identity compliance
      const colorLegalUtility = utilityLands.filter(land => isColorIdentityValid(land, colorIdentity));
      const selectedUtility = colorLegalUtility.slice(0, remainingSlots);
      
      for (const land of selectedUtility) {
        manabase.push({
          ...land,
          role: 'Land',
          synergy_notes: 'Utility land for fixing and synergy',
          price_used: extractCardPrice(land, constraints.prefer_cheapest)
        });
      }
    }
    
    return manabase;
  }

  private calculateColorRequirements(cards: DeckCard[], colorIdentity: string[]): Record<string, number> {
    const requirements: Record<string, number> = {};
    
    // Initialize color requirements
    for (const color of colorIdentity) {
      requirements[color] = 0;
    }
    
    // Count color symbols in mana costs
    for (const card of cards) {
      if (card.mana_cost) {
        for (const color of colorIdentity) {
          const colorSymbol = `{${color}}`;
          const hybridSymbol = `{${color}/`;
          const count = (card.mana_cost.match(new RegExp(colorSymbol, 'g')) || []).length +
                       (card.mana_cost.match(new RegExp(hybridSymbol, 'g')) || []).length;
          requirements[color] += count;
        }
      }
    }
    
    return requirements;
  }

  private calculateBasicLandDistribution(colorRequirements: Record<string, number>, totalLands: number): Record<string, number> {
    const distribution: Record<string, number> = {};
    const colors = Object.keys(colorRequirements);
    
    if (colors.length === 0) {
      return {};
    }
    
    // Calculate total requirement weight
    const totalRequirement = Object.values(colorRequirements).reduce((sum, req) => sum + req, 0);
    
    if (totalRequirement === 0) {
      // Equal distribution if no specific requirements
      const basicCount = Math.floor(totalLands * 0.6); // 60% basics minimum
      const perColor = Math.floor(basicCount / colors.length);
      for (const color of colors) {
        distribution[color] = perColor;
      }
    } else {
      // Weighted distribution based on color requirements
      const basicCount = Math.floor(totalLands * 0.65); // 65% basics recommended
      
      for (const color of colors) {
        const ratio = colorRequirements[color] / totalRequirement;
        distribution[color] = Math.max(1, Math.floor(basicCount * ratio));
      }
    }
    
    return distribution;
  }

  private getCheapestBasicForColors(colorIdentity: string[]): string | null {
    const basicLandNames: Record<string, string> = {
      'W': 'Plains',
      'U': 'Island',
      'B': 'Swamp', 
      'R': 'Mountain',
      'G': 'Forest'
    };

    // Return the first basic land for the commander's colors
    for (const color of colorIdentity) {
      if (basicLandNames[color]) {
        return basicLandNames[color];
      }
    }
    
    // Fallback to Wastes for colorless
    return 'Wastes';
  }

  private calculateOptimalLandCount(nonLandCards: DeckCard[]): number {
    // Frank Karsten's formula: Landsrec = round(31.42 + (3.13 × CMCavg) − (0.28 × (Producers + Cantrips + Searchers)))
    
    // Calculate average CMC of non-land cards
    const totalCmc = nonLandCards.reduce((sum, card) => sum + card.cmc, 0);
    const avgCmc = nonLandCards.length > 0 ? totalCmc / nonLandCards.length : 2.75;
    
    // Count mana producers (ramp spells, mana rocks) - be more specific to avoid false positives
    const producers = nonLandCards.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      const type = card.type_line.toLowerCase();
      const name = card.name.toLowerCase();
      
      return (
        // Artifact mana rocks (must have both conditions)
        (type.includes('artifact') && 
         (text.includes('add') && (text.includes('{w}') || text.includes('{u}') || text.includes('{b}') || text.includes('{r}') || text.includes('{g}') || text.includes('{c}') || text.includes('mana of any color')))) ||
        // Land ramp spells
        (text.includes('search your library for') && text.includes('land')) ||
        // Specific mana artifacts (safer patterns)
        text.includes('{t}: add') ||
        text.includes('add one mana') ||
        text.includes('add two mana') ||
        text.includes('add three mana') ||
        // Known mana producers by name
        name.includes('signet') ||
        name.includes('talisman') ||
        name === 'sol ring' ||
        name === 'arcane signet' ||
        name === 'command tower' ||
        name.includes('mox')
      );
    }).length;
    
    // Count cantrips (cheap card draw)
    const cantrips = nonLandCards.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      return (
        card.cmc <= 2 &&
        (text.includes('draw a card') || text.includes('draw cards')) &&
        !text.includes('may draw') // Exclude optional effects
      );
    }).length;
    
    // Count searchers (tutors and deck manipulation)
    const searchers = nonLandCards.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      return (
        text.includes('search your library') && !text.includes('land') ||
        text.includes('scry') ||
        text.includes('surveil')
      );
    }).length;
    
    // Apply Frank Karsten's formula
    const baseFormula = 31.42 + (3.13 * avgCmc) - (0.28 * (producers + cantrips + searchers));
    
    // Round and clamp to reasonable bounds for Commander (30-42 lands typical)
    const recommendedLands = Math.round(Math.max(30, Math.min(42, baseFormula)));
    
    console.log(`Land calculation: avgCMC=${avgCmc.toFixed(2)}, producers=${producers}, cantrips=${cantrips}, searchers=${searchers}, recommended=${recommendedLands}`);
    
    return recommendedLands;
  }

  private trimLeastSynergisticCards(cards: DeckCard[], commander: ScryfallCard, trimCount: number, constraints?: GenerationConstraints): DeckCard[] {
    if (trimCount <= 0) return cards;
    
    // Calculate synergy scores for each card
    const scoredCards = cards.map(card => ({
      card,
      synergyScore: this.calculateCardSynergy(card, commander, cards, constraints)
    }));
    
    // Sort by synergy score (lowest first) and remove the least synergistic
    scoredCards.sort((a, b) => a.synergyScore - b.synergyScore);
    
    // Remove the lowest scoring cards
    const trimmedCards = scoredCards.slice(trimCount).map(scored => scored.card);
    
    console.log(`Trimmed cards: ${scoredCards.slice(0, trimCount).map(s => s.card.name).join(', ')}`);
    
    return trimmedCards;
  }

  private calculateCardSynergy(card: DeckCard, commander: ScryfallCard, allCards: DeckCard[], constraints?: GenerationConstraints): number {
    // Use the new advanced scoring system if constraints with weights are provided
    if (constraints?.card_type_weights) {
      const advancedScore = this.calculateAdvancedCardScore(card, commander, constraints, allCards);
      console.log(`Advanced score for ${card.name}: ${advancedScore.toFixed(1)} points`);
      return advancedScore;
    }
    
    // Fallback to legacy system for backwards compatibility
    let synergyScore = 0;
    
    // Deep analyze both the card and commander
    const cardAbilities = this.analyzeCardAbilities(card);
    const commanderAbilities = this.analyzeCommanderAbilities(commander);
    
    // Bidirectional synergy analysis
    synergyScore += this.calculateBidirectionalSynergy(card, commander, cardAbilities, commanderAbilities);
    
    // Multi-card interaction analysis
    synergyScore += this.calculateMultiCardInteractions(card, allCards);
    
    // Creature type synergies (enhanced)
    synergyScore += this.calculateCreatureTypeSynergies(card, commander, allCards);
    
    // Mechanical synergies (enhanced) 
    synergyScore += this.calculateMechanicalSynergies(card, commander, allCards);
    
    // Role importance (some roles are more critical)
    const roleImportance: Record<string, number> = {
      'Ramp': 4,
      'Draw/Advantage': 4,
      'Removal/Interaction': 3,
      'Board Wipe': 2,
      'Tutor': 3,
      'Protection': 3,
      'Synergy/Wincon': 2
    };
    
    synergyScore += roleImportance[card.role] || 1;
    
    return synergyScore;
  }

  private analyzeCardAbilities(card: DeckCard): Array<{type: string, keywords: string[], priority: number, context?: string}> {
    // Apply the same deep analysis to regular cards as we do to commanders
    // Enhanced to detect more combo pieces and synergistic interactions
    const abilities: Array<{type: string, keywords: string[], priority: number, context?: string}> = [];
    const text = (card.oracle_text || '').toLowerCase();
    const typeLine = card.type_line.toLowerCase();
    
    // Use the same parsing methods as commander analysis
    const complexAbilities = this.parseComplexAbilities(text);
    abilities.push(...complexAbilities);
    
    const oracleTribes = this.extractCreatureTypesFromText(text);
    const typeLineTribes = this.extractCreatureTypesFromTypeLine(typeLine);
    const allTribes = Array.from(new Set([...oracleTribes, ...typeLineTribes]));
    
    if (allTribes.length > 0) {
      abilities.push({
        type: 'tribal',
        keywords: allTribes,
        priority: 8, // Lower priority for non-commander cards
        context: 'card_types_and_oracle'
      });
    }
    
    const triggeredAbilities = this.parseTriggeredAbilities(text);
    abilities.push(...triggeredAbilities);
    
    const activatedAbilities = this.parseActivatedAbilities(text);
    abilities.push(...activatedAbilities);
    
    const staticAbilities = this.parseStaticAbilities(text);
    abilities.push(...staticAbilities);
    
    return abilities;
  }

  private calculateBidirectionalSynergy(
    card: DeckCard, 
    commander: ScryfallCard, 
    cardAbilities: Array<{type: string, keywords: string[], priority: number, context?: string}>,
    commanderAbilities: Array<{type: string, keywords: string[], priority: number, context?: string}>
  ): number {
    let synergyScore = 0;
    
    // How well does this card work WITH the commander?
    for (const commanderAbility of commanderAbilities) {
      for (const cardAbility of cardAbilities) {
        
        // Creature type matching (bidirectional)
        const sharedTribes = commanderAbility.keywords.filter(tribe => 
          cardAbility.keywords.includes(tribe) || 
          this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase()).includes(tribe)
        );
        
        if (sharedTribes.length > 0) {
          synergyScore += sharedTribes.length * 5; // High score for tribal matches
        }
        
        // ETB synergy matching
        if (commanderAbility.type.includes('creature_etb') && cardAbility.type === 'etb_trigger') {
          synergyScore += 8; // Card has ETB, commander cares about ETBs
        }
        
        // Counter synergy
        if ((commanderAbility.keywords.includes('+1/+1') || commanderAbility.keywords.includes('counter')) &&
            (cardAbility.keywords.includes('+1/+1') || cardAbility.keywords.includes('counter'))) {
          synergyScore += 6;
        }
        
        // Draw synergy
        if ((commanderAbility.keywords.includes('draw') || commanderAbility.keywords.includes('card')) &&
            (cardAbility.keywords.includes('draw') || cardAbility.keywords.includes('card'))) {
          synergyScore += 5;
        }
        
        // Token synergy
        if ((commanderAbility.keywords.includes('token') || commanderAbility.keywords.includes('create')) &&
            (cardAbility.keywords.includes('token') || cardAbility.keywords.includes('create'))) {
          synergyScore += 4;
        }
      }
    }
    
    // Direct text analysis for specific interactions
    const cardText = (card.oracle_text || '').toLowerCase();
    const commanderText = (commander.oracle_text || '').toLowerCase();
    
    // Card directly mentions creature types that commander cares about
    const commanderTribes = this.extractCreatureTypesFromText(commanderText);
    const cardTribes = this.extractCreatureTypesFromText(cardText);
    const sharedDirectTribes = commanderTribes.filter(tribe => cardTribes.includes(tribe));
    synergyScore += sharedDirectTribes.length * 3;
    
    // Card is a creature type that commander specifically triggers on
    const cardCreatureTypes = this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase());
    for (const commanderAbility of commanderAbilities) {
      if (commanderAbility.type.includes('creature_etb') || commanderAbility.type.includes('tribal')) {
        const triggeredTypes = commanderAbility.keywords.filter(keyword => 
          cardCreatureTypes.includes(keyword)
        );
        synergyScore += triggeredTypes.length * 10; // Very high score for direct trigger matching
      }
    }
    
    return synergyScore;
  }

  /**
   * Analyze deck holistically for combo potential and cross-card synergies
   */
  private analyzeDeckCombos(deck: DeckCard[], commander: ScryfallCard): string[] {
    const combos: string[] = [];
    const cards = [{ ...commander, role: 'Commander' as CardRole }, ...deck];
    
    // Detect common combo patterns
    const hasInfiniteMana = cards.some(card => 
      (card.oracle_text || '').toLowerCase().includes('infinite mana') ||
      ((card.oracle_text || '').toLowerCase().includes('untap') && 
       (card.oracle_text || '').toLowerCase().includes('add'))
    );
    
    const hasETBTriggers = cards.filter(card =>
      (card.oracle_text || '').toLowerCase().includes('enters the battlefield')
    );
    
    const hasFlicker = cards.some(card =>
      (card.oracle_text || '').toLowerCase().includes('exile') &&
      ((card.oracle_text || '').toLowerCase().includes('return') ||
       (card.oracle_text || '').toLowerCase().includes('battlefield'))
    );
    
    // ETB + Flicker combo
    if (hasETBTriggers.length >= 3 && hasFlicker) {
      combos.push(`ETB Value Engine: ${hasETBTriggers.length} cards with enter-the-battlefield effects combined with flicker effects create repeatable value`);
    }
    
    // Damage doubling combos
    const hasDamageDoubler = cards.some(card =>
      (card.oracle_text || '').toLowerCase().includes('double') &&
      (card.oracle_text || '').toLowerCase().includes('damage')
    );
    
    const hasDamageSource = cards.filter(card =>
      (card.oracle_text || '').toLowerCase().includes('deal') &&
      (card.oracle_text || '').toLowerCase().includes('damage')
    );
    
    if (hasDamageDoubler && hasDamageSource.length >= 2) {
      combos.push(`Damage Amplification: Damage doublers multiply the effectiveness of ${hasDamageSource.length} damage sources`);
    }
    
    // Token synergies
    const hasTokenCreators = cards.filter(card =>
      (card.oracle_text || '').toLowerCase().includes('create') &&
      ((card.oracle_text || '').toLowerCase().includes('token') ||
       (card.oracle_text || '').toLowerCase().includes('creature'))
    );
    
    const hasTokenPayoffs = cards.filter(card =>
      (card.oracle_text || '').toLowerCase().includes('creatures you control') ||
      ((card.oracle_text || '').toLowerCase().includes('whenever') &&
       (card.oracle_text || '').toLowerCase().includes('creature'))
    );
    
    if (hasTokenCreators.length >= 2 && hasTokenPayoffs.length >= 2) {
      combos.push(`Token Synergy Engine: ${hasTokenCreators.length} token creators with ${hasTokenPayoffs.length} payoff cards create exponential value`);
    }
    
    return combos;
  }

  private calculateMultiCardInteractions(targetCard: DeckCard, allCards: DeckCard[]): number {
    let interactionScore = 0;
    const targetText = (targetCard.oracle_text || '').toLowerCase();
    const targetTypes = targetCard.type_line.toLowerCase();
    const targetTribes = this.extractCreatureTypesFromTypeLine(targetTypes);
    
    for (const otherCard of allCards) {
      if (otherCard.id === targetCard.id) continue;
      
      const otherText = (otherCard.oracle_text || '').toLowerCase();
      const otherTypes = otherCard.type_line.toLowerCase();
      const otherTribes = this.extractCreatureTypesFromTypeLine(otherTypes);
      
      // Tribal synergies between cards
      const sharedTribes = targetTribes.filter(tribe => otherTribes.includes(tribe));
      interactionScore += sharedTribes.length * 2;
      
      // ETB chain reactions
      if (targetText.includes('enters the battlefield') && otherText.includes('whenever') && otherText.includes('enters')) {
        interactionScore += 4;
      }
      
      // Sacrifice synergies
      if ((targetText.includes('sacrifice') && otherText.includes('when') && otherText.includes('dies')) ||
          (otherText.includes('sacrifice') && targetText.includes('when') && targetText.includes('dies'))) {
        interactionScore += 3;
      }
      
      // Token generation + token payoffs
      if ((targetText.includes('create') && targetText.includes('token') && 
           otherText.includes('whenever') && otherText.includes('creature') && otherText.includes('enters')) ||
          (otherText.includes('create') && otherText.includes('token') &&
           targetText.includes('whenever') && targetText.includes('creature') && targetText.includes('enters'))) {
        interactionScore += 4;
      }
      
      // Counter synergies between cards
      if ((targetText.includes('+1/+1') && otherText.includes('+1/+1')) ||
          (targetText.includes('counter') && otherText.includes('counter'))) {
        interactionScore += 3;
      }
      
      // Artifact synergies
      if (targetTypes.includes('artifact') && 
          (otherText.includes('artifact') || otherText.includes('metalcraft'))) {
        interactionScore += 2;
      }
      
      // Enchantment synergies
      if (targetTypes.includes('enchantment') && 
          (otherText.includes('enchantment') || otherText.includes('constellation'))) {
        interactionScore += 2;
      }
      
      // Graveyard synergies
      if ((targetText.includes('graveyard') || targetText.includes('mill')) &&
          (otherText.includes('graveyard') || otherText.includes('mill') || otherText.includes('flashback'))) {
        interactionScore += 2;
      }
    }
    
    return Math.min(interactionScore, 15); // Cap multi-card bonus
  }

  private calculateCreatureTypeSynergies(card: DeckCard, commander: ScryfallCard, allCards: DeckCard[]): number {
    let tribalScore = 0;
    
    const cardTribes = this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase());
    const commanderTribes = this.extractCreatureTypesFromTypeLine(commander.type_line.toLowerCase());
    const cardText = (card.oracle_text || '').toLowerCase();
    
    // Card shares creature types with commander
    const sharedTribes = cardTribes.filter(tribe => commanderTribes.includes(tribe));
    tribalScore += sharedTribes.length * 3;
    
    // Card mentions creature types that commander is
    const mentionedTribes = this.extractCreatureTypesFromText(cardText);
    const commanderTypeMentions = mentionedTribes.filter(tribe => commanderTribes.includes(tribe));
    tribalScore += commanderTypeMentions.length * 4;
    
    // Card provides tribal support for the deck's creatures
    let tribalSupport = 0;
    if (cardText.includes('all') || cardText.includes('each') || cardText.includes('other')) {
      for (const tribe of commanderTribes) {
        if (cardText.includes(tribe)) {
          tribalSupport += 5; // Lord effects
        }
      }
    }
    tribalScore += tribalSupport;
    
    // Count how many other creatures in deck share types with this card
    let tribalMass = 0;
    for (const otherCard of allCards) {
      if (otherCard.id === card.id) continue;
      const otherTribes = this.extractCreatureTypesFromTypeLine(otherCard.type_line.toLowerCase());
      const sharedWithOthers = cardTribes.filter(tribe => otherTribes.includes(tribe));
      tribalMass += sharedWithOthers.length;
    }
    tribalScore += Math.min(tribalMass, 8); // Cap tribal mass bonus
    
    return tribalScore;
  }

  private calculateMechanicalSynergies(card: DeckCard, commander: ScryfallCard, allCards: DeckCard[]): number {
    let mechanicalScore = 0;
    
    const cardText = (card.oracle_text || '').toLowerCase();
    const commanderText = (commander.oracle_text || '').toLowerCase();
    
    // Shared mechanics between card and commander
    const mechanics = [
      'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch',
      'first strike', 'double strike', 'hexproof', 'indestructible', 'menace',
      '+1/+1', 'counter', 'token', 'create', 'draw', 'damage', 'sacrifice',
      'graveyard', 'mill', 'scry', 'surveil', 'flashback', 'raid', 'landfall'
    ];
    
    for (const mechanic of mechanics) {
      if (cardText.includes(mechanic) && commanderText.includes(mechanic)) {
        mechanicalScore += 2;
      }
    }
    
    // Mechanical support patterns
    if (commanderText.includes('whenever') && commanderText.includes('enters') &&
        cardText.includes('enters the battlefield')) {
      mechanicalScore += 6; // Direct ETB synergy
    }
    
    if (commanderText.includes('whenever') && commanderText.includes('attacks') &&
        (cardText.includes('when') || cardText.includes('whenever')) && cardText.includes('attacks')) {
      mechanicalScore += 4; // Attack synergy
    }
    
    return mechanicalScore;
  }

  private calculateCrossCardSynergy(targetCard: DeckCard, allCards: DeckCard[]): number {
    let synergy = 0;
    const targetText = (targetCard.oracle_text || '').toLowerCase();
    const targetTypes = targetCard.type_line.toLowerCase();
    
    for (const otherCard of allCards) {
      if (otherCard.id === targetCard.id) continue;
      
      const otherText = (otherCard.oracle_text || '').toLowerCase();
      const otherTypes = otherCard.type_line.toLowerCase();
      
      // Token synergies
      if ((targetText.includes('token') || targetText.includes('create')) && 
          (otherText.includes('sacrifice') || otherText.includes('whenever') && otherText.includes('dies'))) {
        synergy += 1;
      }
      
      // Artifact synergies
      if (targetTypes.includes('artifact') && 
          (otherText.includes('artifact') || otherText.includes('metalcraft'))) {
        synergy += 1;
      }
      
      // Graveyard synergies
      if ((targetText.includes('graveyard') || targetText.includes('mill')) &&
          (otherText.includes('graveyard') || otherText.includes('flashback'))) {
        synergy += 1;
      }
    }
    
    return Math.min(synergy, 5); // Cap cross-synergy bonus
  }

  private identifyTokenEngines(deck: DeckCard[]): DeckCard[] {
    return deck.filter(card => {
      const oracleText = (card.oracle_text || '').toLowerCase();
      const name = card.name.toLowerCase();
      
      // Skip lands and one-time token effects
      if (card.type_line.toLowerCase().includes('land')) return false;
      
      // Look for repeatable token generation patterns
      const isRepeatable = 
        // Activated abilities (can be used multiple times)
        oracleText.includes(': create') ||
        oracleText.includes(', {t}: create') ||
        oracleText.includes('pay') && oracleText.includes('create') ||
        
        // Triggered abilities that happen frequently
        oracleText.includes('whenever') && oracleText.includes('create') ||
        oracleText.includes('at the beginning') && oracleText.includes('create') ||
        oracleText.includes('when') && oracleText.includes('enters') && oracleText.includes('create') ||
        
        // Spells that create multiple tokens at once
        oracleText.includes('create') && (
          oracleText.includes('two ') || oracleText.includes('three ') || 
          oracleText.includes('four ') || oracleText.includes('x ') ||
          oracleText.includes('equal to') || oracleText.includes('for each')
        ) ||
        
        // Enchantments that continuously generate tokens
        card.type_line.toLowerCase().includes('enchantment') && oracleText.includes('create') ||
        
        // Artifacts that tap for tokens
        card.type_line.toLowerCase().includes('artifact') && oracleText.includes('create') ||
        
        // Creatures that make tokens when they attack/damage
        card.type_line.toLowerCase().includes('creature') && 
        (oracleText.includes('create') && (oracleText.includes('attack') || oracleText.includes('damage')));
      
      // Exclude one-time effects
      const isOneTime = 
        oracleText.includes('when') && oracleText.includes('enters the battlefield') && 
        !oracleText.includes('whenever') && !oracleText.includes('at the beginning') &&
        !oracleText.includes('for each') && !oracleText.includes('equal to') &&
        !(oracleText.includes('create') && (oracleText.includes('two ') || oracleText.includes('three ')));
      
      return isRepeatable && !isOneTime && oracleText.includes('token');
    });
  }

  private async generateLandPool(colorIdentity: string[], landCount: number): Promise<ScryfallCard[]> {
    const lands: ScryfallCard[]  = [];
    
    try {
      // Basic lands first - ensure we have plenty as budget options
      const basicLandNames = this.getBasicLandNames(colorIdentity);
      for (const landName of basicLandNames) {
        const land = await this.scryfallClient.getCardByName(landName);
        // Add many basics as budget-friendly options
        for (let i = 0; i < 15; i++) {
          lands.push(land);
        }
      }
      
      // Add colorless basics
      try {
        const wastesCard = await this.scryfallClient.getCardByName('Wastes');
        for (let i = 0; i < 10; i++) {
          lands.push(wastesCard);
        }
      } catch (error) {
        // Ignore if Wastes not found
      }
      
      // Fetch lands that produce ONLY the commander's colors
      const appropriateLands = await this.generateAppropriateNonBasicLands(colorIdentity);
      lands.push(...appropriateLands);
      
    } catch (error) {
      console.error('Error generating land pool:', error);
    }
    
    return lands;
  }

  private async generateRampPool(commander: ScryfallCard, colorIdentity: string[], constraints: GenerationConstraints): Promise<ScryfallCard[]> {
    const rampCards: ScryfallCard[] = [];
    
    try {
      // Get fast mana if allowed (but respect card type weights)
      const fastManaNames = getFastManaSuite(constraints.power_level, !constraints.no_fast_mana);
      for (const name of fastManaNames) {
        try {
          const card = await this.scryfallClient.getCardByName(name);
          if (isColorIdentityValid(card, colorIdentity)) {
            // Apply card filtering (type weights + Un-set exclusion)
            if (this.shouldIncludeCard(card, constraints)) {
              rampCards.push(card);
            } else {
              console.log(`Skipping ${name} due to card filtering`);
            }
          }
        } catch (error) {
          console.warn(`Could not find fast mana card: ${name}`);
        }
      }
      
      // Search for common ramp cards with simpler queries (respect type preferences)
      const rampQueries = [
        'o:"search your library for" o:"land"',
        'o:"rampant growth"',
      ];
      
      // Only add artifact ramp if artifacts aren't disabled
      if (!constraints.card_type_weights || constraints.card_type_weights.artifacts > 0) {
        rampQueries.push('o:"add" o:"mana" t:artifact');
      }
      
      for (const query of rampQueries) {
        const results = await this.scryfallClient.searchCardsByColorIdentity(colorIdentity, query, 'edhrec');
        const filteredResults = results.filter(card => this.shouldIncludeCard(card, constraints));
        rampCards.push(...filteredResults.slice(0, 20)); // Increased for more options
      }
      
      // Add commander-appropriate generic ramp (not just artifacts)
      const commanderAbilities = this.analyzeCommanderAbilities(commander);
      const commanderText = (commander.oracle_text || '').toLowerCase();
      const hasArtifactSynergy = commanderText.includes('artifact') || 
                                commander.type_line.toLowerCase().includes('artifact') ||
                                commanderAbilities.some(ability => ability.keywords.includes('artifact'));
      
      // Only add artifact ramp if commander actually synergizes with artifacts
      const genericRamp = ['Sol Ring', 'Arcane Signet', 'Command Tower']; // Core staples
      if (hasArtifactSynergy) {
        genericRamp.push('Mind Stone', 'Thought Vessel', 'Thran Dynamo', 'Gilded Lotus');
      } else {
        // Prefer creature/spell-based ramp for non-artifact decks
        const creatureRamp = ['Llanowar Elves', 'Birds of Paradise', 'Rampant Growth', 'Nature\'s Lore'];
        for (const name of creatureRamp) {
          if (colorIdentity.includes('G')) { // Only add if green is in identity
            try {
              const card = await this.scryfallClient.getCardByName(name);
              if (this.shouldIncludeCard(card, constraints)) {
                rampCards.push(card);
              }
            } catch (error) {
              // Ignore missing cards
            }
          }
        }
      }
      
      for (const name of genericRamp) {
        try {
          const card = await this.scryfallClient.getCardByName(name);
          if (this.shouldIncludeCard(card, constraints)) {
            rampCards.push(card);
          } else {
            console.log(`Skipping ${name} due to card filtering (likely artifact weight = 0)`);
          }
        } catch (error) {
          // Ignore missing cards
        }
      }
      
    } catch (error) {
      console.error('Error generating ramp pool:', error);
    }
    
    return applyConstraintFilters(rampCards, constraints, commander);
  }

  private async generateCardDrawPool(commander: ScryfallCard, colorIdentity: string[], constraints: GenerationConstraints): Promise<ScryfallCard[]> {
    const drawCards: ScryfallCard[] = [];
    
    try {
      const queries = [
        'o:"draw" o:"card"',
        'o:"scry"',
        'o:"card advantage"'
      ];
      
      for (const baseQuery of queries) {
        const results = await this.scryfallClient.searchCardsByColorIdentity(
          colorIdentity, 
          baseQuery, 
          'edhrec'
        );
        drawCards.push(...results.slice(0, 25)); // More options for budget optimization
      }
      
      // Add some generic card draw options
      const genericDraw = ['Divination', 'Sign in Blood', 'Read the Bones', 'Night\'s Whisper'];
      for (const name of genericDraw) {
        try {
          const card = await this.scryfallClient.getCardByName(name);
          if (isColorIdentityValid(card, colorIdentity)) {
            drawCards.push(card);
          }
        } catch (error) {
          // Ignore missing cards
        }
      }
      
    } catch (error) {
      console.error('Error generating card draw pool:', error);
    }
    
    return applyConstraintFilters(drawCards, constraints, commander);
  }

  private async generateRemovalPool(commander: ScryfallCard, colorIdentity: string[], constraints: GenerationConstraints): Promise<ScryfallCard[]> {
    const removalCards: ScryfallCard[] = [];
    
    try {
      const interactionSuite = calculateInteractionSuite(constraints.power_level, colorIdentity);
      
      const queries = [
        'o:"destroy target"',
        'o:"exile target"',
        'o:"counter target"',
        'o:"remove" o:"from play"'
      ];
      
      for (const query of queries) {
        const results = await this.scryfallClient.searchCardsByColorIdentity(colorIdentity, query, 'edhrec');
        removalCards.push(...results.slice(0, 20)); // More removal options
      }
      
      // Add some generic removal based on colors
      const colorBasedRemoval: Record<string, string[]> = {
        'W': ['Swords to Plowshares', 'Path to Exile', 'Wrath of God'],
        'U': ['Counterspell', 'Negate', 'Return to Hand'],
        'B': ['Murder', 'Doom Blade', 'Terror'],
        'R': ['Lightning Bolt', 'Shock', 'Pyroclasm'],
        'G': ['Beast Within', 'Naturalize', 'Krosan Grip']
      };
      
      for (const color of colorIdentity) {
        const spells = colorBasedRemoval[color] || [];
        for (const name of spells) {
          try {
            const card = await this.scryfallClient.getCardByName(name);
            removalCards.push(card);
          } catch (error) {
            // Ignore missing cards
          }
        }
      }
      
    } catch (error) {
      console.error('Error generating removal pool:', error);
    }
    
    return applyConstraintFilters(removalCards, constraints, commander);
  }

  private async generateTutorPool(commander: ScryfallCard, colorIdentity: string[], constraints: GenerationConstraints): Promise<ScryfallCard[]> {
    const tutorCards: ScryfallCard[] = [];
    
    try {
      const tutorNames = getTutorSuite(constraints.power_level, colorIdentity);
      
      for (const name of tutorNames) {
        try {
          const card = await this.scryfallClient.getCardByName(name);
          if (isColorIdentityValid(card, colorIdentity)) {
            tutorCards.push(card);
          }
        } catch (error) {
          console.warn(`Could not find tutor: ${name}`);
        }
      }
      
      // Search for additional tutors
      const tutorQueries = [
        'o:"search your library"',
        'o:"tutor"'
      ];
      
      for (const query of tutorQueries) {
        const results = await this.scryfallClient.searchCardsByColorIdentity(colorIdentity, query, 'edhrec');
        tutorCards.push(...results.slice(0, 10));
      }
      
    } catch (error) {
      console.error('Error generating tutor pool:', error);
    }
    
    return applyConstraintFilters(tutorCards, constraints, commander);
  }

  private async generateProtectionPool(commander: ScryfallCard, colorIdentity: string[], constraints: GenerationConstraints): Promise<ScryfallCard[]> {
    const protectionCards: ScryfallCard[] = [];
    
    try {
      // Based on guide: 3-5 protection effects per deck
      const protectionQueries = [
        'o:"hexproof"', // Hexproof effects
        'o:"indestructible"', // Indestructible effects
        'o:"protection from"', // Protection abilities
        'o:"shroud"', // Shroud effects
        'o:"regenerate"', // Regeneration
        'o:"return" o:"to your hand"', // Bounce protection
        'o:"flicker" OR o:"blink"', // Flicker effects
        'o:"prevent all damage"', // Damage prevention
        'o:"can\'t be blocked"' // Unblockable
      ];
      
      for (const query of protectionQueries) {
        const results = await this.scryfallClient.searchCardsByColorIdentity(
          colorIdentity,
          query,
          'edhrec'
        );
        protectionCards.push(...results.slice(0, 15)); // Get options from each category
      }
      
      // Add some staple protection cards by color
      const colorProtection: Record<string, string[]> = {
        'W': ['Teferi\'s Protection', 'Flawless Maneuver', 'Heroic Intervention', 'Ghostway', 'Eerie Interlude'],
        'U': ['Cyclonic Rift', 'Teferi\'s Time Twist', 'Essence Flux', 'Ghostly Flicker'],
        'B': ['Malakir Rebirth', 'Supernatural Stamina', 'Undying Evil'],
        'R': ['Boros Charm', 'Heroic Intervention', 'Snakeskin Veil'],
        'G': ['Heroic Intervention', 'Snakeskin Veil', 'Veil of Summer', 'Blossoming Defense']
      };
      
      // Generic protection (artifacts/colorless)
      const genericProtection = [
        'Lightning Greaves', 'Swiftfoot Boots', 'Whispersilk Cloak', 
        'Darksteel Plate', 'Shield of Kaldra', 'Spear of Heliod'
      ];
      
      for (const color of colorIdentity) {
        const spells = colorProtection[color] || [];
        for (const name of spells) {
          try {
            const card = await this.scryfallClient.getCardByName(name);
            protectionCards.push(card);
          } catch (error) {
            // Ignore missing cards
          }
        }
      }
      
      // Add generic protection
      for (const name of genericProtection) {
        try {
          const card = await this.scryfallClient.getCardByName(name);
          protectionCards.push(card);
        } catch (error) {
          // Ignore missing cards
        }
      }
      
    } catch (error) {
      console.error('Error generating protection pool:', error);
    }
    
    return applyConstraintFilters(protectionCards, constraints, commander);
  }

  private async generateSynergyPool(commander: ScryfallCard, constraints: GenerationConstraints): Promise<ScryfallCard[]> {
    const synergyCards: ScryfallCard[] = [];
    const colorIdentity = commander.color_identity;
    
    try {
      // Analyze commander for deep synergy analysis
      const commanderText = (commander.oracle_text || '').toLowerCase();
      const commanderTypes = commander.type_line.toLowerCase();
      const commanderName = commander.name.toLowerCase();
      
      const synergyQueries: Array<{query: string, priority: number}> = [];
      
      // KEYWORD FOCUS: Add user-specified themes/keywords with high priority
      if (constraints.keyword_focus && constraints.keyword_focus.length > 0) {
        console.log(`Adding keyword focus queries for: ${constraints.keyword_focus.join(', ')}`);
        for (const keyword of constraints.keyword_focus) {
          const focusQueries = this.buildKeywordFocusQueries(keyword.toLowerCase());
          synergyQueries.push(...focusQueries.map(q => ({ ...q, priority: q.priority + 5 }))); // Boost priority by +5
        }
      }
      
      // DYNAMIC COMMANDER ABILITY ANALYSIS: Parse commander abilities and build synergies
      const commanderAbilities = this.analyzeCommanderAbilities(commander);
      console.log(`Analyzing ${commander.name} abilities:`, commanderAbilities);
      
      // Build synergy queries based on detected abilities
      for (const ability of commanderAbilities) {
        synergyQueries.push(...this.buildSynergyQueriesForAbility(ability));
      }
      
      // If no specific abilities detected, fall back to general analysis
      if (commanderAbilities.length === 0) {
        // HIGH PRIORITY: Tribal synergies
        const allTribes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit', 'wizard', 'warrior', 'soldier', 'beast', 'cat', 'vampire', 'merfolk', 'sliver', 'elemental'];
        for (const tribe of allTribes) {
          if (commanderTypes.includes(tribe) || commanderText.includes(tribe)) {
            synergyQueries.push({query: `t:${tribe}`, priority: 10});
            synergyQueries.push({query: `o:"${tribe}"`, priority: 9});
          }
        }
        
        // HIGH PRIORITY: Specific mechanic synergies - only include artifacts if commander actually cares about them
        const mechanicPatterns = [
          {pattern: /\+1\/\+1/g, query: 'o:"+1/+1"', priority: 10},
          {pattern: /graveyard/g, query: 'o:"graveyard"', priority: 9},
          {pattern: /token/g, query: 'o:"token"', priority: 8},
          {pattern: /enchantment/g, query: 't:enchantment', priority: 8},
          {pattern: /instant.*sorcery|sorcery.*instant/g, query: 'o:"instant" o:"sorcery"', priority: 8},
          {pattern: /landfall/g, query: 'o:"landfall"', priority: 10},
          {pattern: /enters.*battlefield|etb/g, query: 'o:"enters the battlefield"', priority: 7},
          {pattern: /dies|death/g, query: 'o:"dies"', priority: 7},
          {pattern: /sacrifice/g, query: 'o:"sacrifice"', priority: 7}
        ];
        
        for (const {pattern, query, priority} of mechanicPatterns) {
          if (pattern.test(commanderText)) {
            synergyQueries.push({query, priority});
          }
        }
        
        // Add artifact synergies ONLY if commander has meaningful artifact interaction
        const hasDeepArtifactSynergy = commanderText.includes('artifact enters') ||
                                      commanderText.includes('artifacts you control') ||
                                      commanderText.includes('metalcraft') ||
                                      commanderText.includes('improvise') ||
                                      commanderText.includes('affinity') ||
                                      commander.type_line.toLowerCase().includes('artifact') ||
                                      commanderText.includes('sacrifice an artifact') ||
                                      commanderText.includes('whenever you cast an artifact');
        
        if (hasDeepArtifactSynergy) {
          synergyQueries.push(
            // Lower priority - artifacts should support, not dominate
            {query: 't:artifact', priority: 6},
            {query: 'o:"artifact"', priority: 5}
          );
        }
        
        // MEDIUM PRIORITY: Keyword abilities
        const keywords = ['flying', 'trample', 'lifelink', 'deathtouch', 'haste', 'vigilance', 'hexproof', 'indestructible', 'menace', 'reach', 'first strike', 'double strike'];
        for (const keyword of keywords) {
          if (commanderText.includes(keyword)) {
            synergyQueries.push({query: `o:"${keyword}"`, priority: 6});
          }
        }
        
        // MEDIUM PRIORITY: Color-specific strategies
        const colorStrategies = {
          'W': [{query: 'o:"lifegain"', priority: 5}, {query: 'o:"token"', priority: 5}],
          'U': [{query: 'o:"draw"', priority: 5}, {query: 'o:"counter"', priority: 5}],
          'B': [{query: 'o:"graveyard"', priority: 5}, {query: 'o:"sacrifice"', priority: 5}],
          'R': [{query: 'o:"damage"', priority: 5}, {query: 'o:"haste"', priority: 5}],
          'G': [{query: 'o:"ramp"', priority: 5}, {query: 'o:"+1/+1"', priority: 5}]
        };
        
        for (const color of colorIdentity) {
          const strategies = colorStrategies[color as keyof typeof colorStrategies] || [];
          synergyQueries.push(...strategies);
        }
      } // End of fallback analysis
      
      // Sort synergy queries by priority (highest first)
      synergyQueries.sort((a, b) => b.priority - a.priority);
      
      // Execute synergy searches with priority ordering
      const highPriorityQueries = synergyQueries.filter(q => q.priority >= 8).slice(0, 4);
      const mediumPriorityQueries = synergyQueries.filter(q => q.priority >= 6 && q.priority < 8).slice(0, 3);
      const lowPriorityQueries = synergyQueries.filter(q => q.priority < 6).slice(0, 2);
      
      const allQueries = [...highPriorityQueries, ...mediumPriorityQueries, ...lowPriorityQueries];
      
      for (const {query} of allQueries) {
        const results = await this.scryfallClient.searchCardsByColorIdentity(
          colorIdentity, 
          query, 
          'edhrec' // This ensures EDHREC popularity, not alphabetical
        );
        synergyCards.push(...results.slice(0, 50)); // More options per query
      }
      
      // Add specific interaction packages (inspired by Commander Spellbook)
      synergyCards.push(...await this.generateInteractionPackages(commander, colorIdentity));
      
      // Add generic powerful cards if not enough synergy found
      if (synergyCards.length < 100) {
        const genericQueries = [
          't:creature',
          'o:"enters the battlefield"',
          't:instant',
          't:sorcery'
        ];
        
        for (const query of genericQueries) {
          const results = await this.scryfallClient.searchCardsByColorIdentity(
            colorIdentity,
            query,
            'edhrec'
          );
          synergyCards.push(...results.slice(0, 30));
          if (synergyCards.length >= 200) break; // Don't go overboard
        }
      }
      
    } catch (error) {
      console.error('Error generating synergy pool:', error);
    }
    
    // Sort the final synergy pool by synergy relevance, not alphabetically
    const sortedSynergyCards = this.sortCardsBySynergy(synergyCards, commander);
    
    return applyConstraintFilters(sortedSynergyCards, constraints, commander);
  }

  private sortCardsBySynergy(cards: ScryfallCard[], commander: ScryfallCard): ScryfallCard[] {
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderTypes = commander.type_line.toLowerCase();
    
    return cards.sort((a, b) => {
      const scoreA = this.calculateCommanderSynergy(a, commanderText, commanderTypes);
      const scoreB = this.calculateCommanderSynergy(b, commanderText, commanderTypes);
      
      if (scoreA !== scoreB) return scoreB - scoreA; // Higher synergy first
      
      // Tiebreaker: prefer lower CMC for efficiency
      if (a.cmc !== b.cmc) return a.cmc - b.cmc;
      
      // Final tiebreaker: card versatility (more types/abilities = better)
      const aVersatility = (a.oracle_text || '').split(/[.,;]/).length;
      const bVersatility = (b.oracle_text || '').split(/[.,;]/).length;
      return bVersatility - aVersatility;
    });
  }

  private calculateCommanderSynergy(card: ScryfallCard, commanderText: string, commanderTypes: string): number {
    const cardText = (card.oracle_text || '').toLowerCase();
    const cardTypes = card.type_line.toLowerCase();
    let synergyScore = 0;
    
    // High synergy: Tribal matches
    const tribes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit', 'wizard', 'warrior'];
    for (const tribe of tribes) {
      if (commanderTypes.includes(tribe) && (cardTypes.includes(tribe) || cardText.includes(tribe))) {
        synergyScore += 15;
      }
    }
    
    // High synergy: Shared keywords/mechanics
    const keywords = ['+1/+1', 'artifact', 'graveyard', 'token', 'landfall', 'sacrifice', 'dies', 'enters the battlefield'];
    for (const keyword of keywords) {
      if (commanderText.includes(keyword) && cardText.includes(keyword)) {
        synergyScore += 10;
      }
    }
    
    // Medium synergy: Similar abilities
    const abilities = ['flying', 'trample', 'lifelink', 'deathtouch', 'haste', 'vigilance'];
    for (const ability of abilities) {
      if (commanderText.includes(ability) && cardText.includes(ability)) {
        synergyScore += 5;
      }
    }
    
    // Low synergy: General goodstuff
    if (cardText.includes('draw') && cardText.includes('card')) synergyScore += 2;
    if (cardText.includes('destroy target') || cardText.includes('exile target')) synergyScore += 2;
    
    // Penalty for off-theme cards (expensive, narrow, or very situational)
    if (synergyScore === 0) {
      const isExpensive = card.cmc >= 7;
      const isNarrow = cardText.includes('if you control') || cardText.includes('only if');
      const isVanilla = !cardText.includes('when') && !cardText.includes('whenever') && !cardText.includes(':');
      
      if (isExpensive || isNarrow || (isVanilla && card.cmc >= 4)) {
        synergyScore = -1;
      }
    }
    
    return synergyScore;
  }
  
  private async generateInteractionPackages(commander: ScryfallCard, colorIdentity: string[]): Promise<ScryfallCard[]> {
    const packageCards: ScryfallCard[] = [];
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderTypes = commander.type_line.toLowerCase();
    
    try {
      // Token package (if commander creates/cares about tokens)
      if (commanderText.includes('token') || commanderText.includes('create')) {
        const tokenQueries = [
          'o:"sacrifice" o:"creature"', // Sacrifice outlets
          'o:"whenever" o:"creature" o:"dies"', // Death triggers
          'o:"creature" o:"token"', // Token creators
          'o:"populate"' // Token multipliers
        ];
        
        for (const query of tokenQueries) {
          const results = await this.scryfallClient.searchCardsByColorIdentity(colorIdentity, query, 'edhrec');
          packageCards.push(...results.slice(0, 10));
        }
      }
      
      // Artifact package - only if commander has deep artifact synergy
      const hasDeepArtifactSynergy = commanderText.includes('artifact enters') ||
                                    commanderText.includes('artifacts you control') ||
                                    commanderText.includes('metalcraft') ||
                                    commanderText.includes('improvise') ||
                                    commanderText.includes('affinity') ||
                                    commanderTypes.includes('artifact') ||
                                    commanderText.includes('sacrifice an artifact') ||
                                    commanderText.includes('whenever you cast an artifact');
      
      if (hasDeepArtifactSynergy) {
        const artifactQueries = [
          'o:"artifacts" o:"cost"', // Cost reduction
          'o:"whenever" o:"artifact" o:"enters"', // Artifact ETB triggers
          'o:"sacrifice" o:"artifact"', // Artifact sacrifice
          'o:"metalcraft" OR o:"improvise" OR o:"affinity"' // Artifact mechanics
        ];
        
        for (const query of artifactQueries) {
          const results = await this.scryfallClient.searchCardsByColorIdentity(colorIdentity, query, 'edhrec');
          packageCards.push(...results.slice(0, 8));
        }
      }
      
      // Graveyard package
      if (commanderText.includes('graveyard') || commanderText.includes('mill')) {
        const graveyardQueries = [
          'o:"return" o:"graveyard" o:"battlefield"', // Recursion
          'o:"mill" OR o:"put" o:"graveyard"', // Self-mill
          'o:"flashback" OR o:"escape" OR o:"delve"', // Graveyard value
          'o:"whenever" o:"creature" o:"graveyard"' // Graveyard triggers
        ];
        
        for (const query of graveyardQueries) {
          const results = await this.scryfallClient.searchCardsByColorIdentity(colorIdentity, query, 'edhrec');
          packageCards.push(...results.slice(0, 8));
        }
      }
      
      // Enchantment package
      if (commanderText.includes('enchantment') || commanderTypes.includes('enchantment')) {
        const enchantmentQueries = [
          'o:"constellation"', // Enchantment triggers
          'o:"enchantment" o:"enters"', // Enchantment ETBs
          'o:"aura" o:"enchanted"' // Aura synergies
        ];
        
        for (const query of enchantmentQueries) {
          const results = await this.scryfallClient.searchCardsByColorIdentity(colorIdentity, query, 'edhrec');
          packageCards.push(...results.slice(0, 8));
        }
      }
      
    } catch (error) {
      console.error('Error generating interaction packages:', error);
    }
    
    return packageCards;
  }

  private async selectCards(
    cardPools: Record<string, ScryfallCard[]>,
    composition: any,
    constraints: GenerationConstraints
  ): Promise<ScryfallCard[]> {
    const selectedCards: ScryfallCard[] = [];
    
    // Select from each pool based on composition with expanded pools for budget optimization
    const selections = [
      { pool: 'lands', count: Math.max(composition.lands, 35) }, // Ensure enough lands
      { pool: 'ramp', count: Math.max(composition.ramp * 2, 20) }, // Double ramp pool for options
      { pool: 'draw', count: Math.max(composition.draw * 2, 20) }, // More draw options
      { pool: 'removal', count: Math.max(composition.removal * 2, 15) }, // More removal options
      { pool: 'tutors', count: Math.max(composition.tutors * 2, 10) }, // More tutor options
      { pool: 'protection', count: Math.max(composition.protection * 3, 15) }, // Protection options
      { pool: 'synergy', count: Math.max(composition.synergy * 2, 50) } // Many more synergy options
    ];
    
    for (const selection of selections) {
      const pool = cardPools[selection.pool] || [];
      const uniquePool = this.removeDuplicates(pool);
      // Take more cards from each pool to give the optimizer more options
      selectedCards.push(...uniquePool.slice(0, selection.count));
    }
    
    return selectedCards;
  }

  private removeDuplicates(cards: ScryfallCard[]): ScryfallCard[] {
    const seen = new Set<string>();
    return cards.filter(card => {
      // Allow multiple copies of basic lands
      const isBasicLand = card.type_line.toLowerCase().includes('basic') && 
                         card.type_line.toLowerCase().includes('land');
      
      if (isBasicLand) {
        return true; // Always allow basic lands
      }
      
      if (seen.has(card.name)) {
        return false;
      }
      seen.add(card.name);
      return true;
    });
  }

  private separateCardTypes(cards: DeckCard[]): { nonlandCards: DeckCard[]; lands: DeckCard[] } {
    const nonlandCards: DeckCard[] = [];
    const lands: DeckCard[] = [];
    
    for (const card of cards) {
      if (card.type_line.toLowerCase().includes('land')) {
        lands.push(card);
      } else {
        nonlandCards.push(card);
      }
    }
    
    return { nonlandCards, lands };
  }

  private calculateRoleBreakdown(cards: DeckCard[]): Record<CardRole, number> {
    const breakdown: Record<CardRole, number> = {
      'Commander': 1,
      'Ramp': 0,
      'Draw/Advantage': 0,
      'Removal/Interaction': 0,
      'Board Wipe': 0,
      'Tutor': 0,
      'Protection': 0,
      'Synergy/Wincon': 0,
      'Land': 0
    };
    
    for (const card of cards) {
      breakdown[card.role]++;
    }
    
    return breakdown;
  }

  private convertCompositionToRoleTargets(composition: any): Record<string, number> {
    return {
      'Land': composition.lands,
      'Ramp': composition.ramp,
      'Draw/Advantage': composition.draw,
      'Removal/Interaction': composition.removal,
      'Board Wipe': composition.board_wipes,
      'Tutor': composition.tutors,
      'Protection': composition.protection,
      'Synergy/Wincon': composition.synergy
    };
  }

  private generateNotes(
    commander: ScryfallCard,
    constraints: GenerationConstraints,
    optimizationResult: any
  ): string[] {
    const notes: string[] = [];
    
    notes.push(`Generated deck for ${commander.name} at power level ${constraints.power_level}`);
    notes.push(`Total budget: $${constraints.total_budget}, per-card cap: $${constraints.per_card_cap}`);
    notes.push(`Final deck: ${optimizationResult.finalDeck.length + 1} cards, $${optimizationResult.totalCost.toFixed(2)} total cost`);
    
    if (constraints.no_infinite_combos) notes.push('Infinite combos excluded');
    if (constraints.no_land_destruction) notes.push('Land destruction excluded');
    if (constraints.no_extra_turns) notes.push('Extra turns excluded');
    if (constraints.no_stax) notes.push('Stax effects excluded');
    if (constraints.no_fast_mana) notes.push('Fast mana excluded');
    
    if (optimizationResult.replacements && optimizationResult.replacements.length > 0) {
      notes.push(`${optimizationResult.replacements.length} cards replaced with budget alternatives`);
    }
    
    return notes;
  }

  private generateDeckExplanation(commander: ScryfallCard, finalDeck: DeckCard[], constraints: GenerationConstraints): string {
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderTypes = commander.type_line.toLowerCase();
    
    // Analyze the deck for key synergies and themes
    const deckAnalysis = this.analyzeDeckThemes(finalDeck, commander);
    const gameplan = this.analyzeGameplan(finalDeck, commander, constraints);
    
    // Analyze deck combos and cross-card synergies
    const combos = this.analyzeDeckCombos(finalDeck, commander);
    
    let explanation = `**${commander.name} - Power Level ${constraints.power_level}**\n\n` +
      `**Core Synergies:** ${deckAnalysis.synergies.join(', ')}. ` +
      `${deckAnalysis.synergyExplanation}\n\n`;
      
    // Add combo analysis if combos were found
    if (combos.length > 0) {
      explanation += `**Win Condition Combos:** ${combos.join('. ')}\n\n`;
    }
    
    explanation +=
      `**Early Game (Turns 1-3):** ${gameplan.earlyGame}\n\n` +
      `**Mid Game (Turns 4-6):** ${gameplan.midGame}\n\n` +
      `**Late Game (Turns 7+):** ${gameplan.lateGame}\n\n` +
      `**Win Conditions:** ${gameplan.winConditions.join(', ')}. ${gameplan.winExplanation}`;
    
    return explanation;
  }
  
  private analyzeDeckThemes(deck: DeckCard[], commander: ScryfallCard): {
    synergies: string[];
    synergyExplanation: string;
  } {
    const synergies: string[] = [];
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderTypes = commander.type_line.toLowerCase();
    const commanderName = commander.name.toLowerCase();
    
    // DYNAMIC COMMANDER ABILITY ANALYSIS: Build explanation based on commander abilities
    const commanderAbilities = this.analyzeCommanderAbilities(commander);
    if (commanderAbilities.length > 0) {
      const dynamicAnalysis = this.buildDynamicSynergyExplanation(deck, commander, commanderAbilities);
      if (dynamicAnalysis.synergies.length > 0) {
        return dynamicAnalysis;
      }
    }
    
    // Count synergy patterns using improved analysis for other commanders
    const tokenEngines = this.identifyTokenEngines(deck);
    const tokenCards = tokenEngines.length;
    
    const artifactCards = deck.filter(card => 
      card.type_line.toLowerCase().includes('artifact') ||
      (card.oracle_text || '').toLowerCase().includes('artifact')
    ).length;
    
    const graveyardCards = deck.filter(card => 
      (card.oracle_text || '').toLowerCase().includes('graveyard')
    ).length;
    
    const commanderTribes = this.extractCreatureTypesFromTypeLine(commanderTypes);
    const tribalCards = deck.filter(card => {
      const cardTribes = this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase());
      const cardText = (card.oracle_text || '').toLowerCase();
      
      return commanderTribes.some(tribe => 
        cardTribes.includes(tribe) || cardText.includes(tribe)
      );
    }).length;
    
    const counterCards = deck.filter(card => 
      (card.oracle_text || '').toLowerCase().includes('+1/+1')
    ).length;
    
    // Build synergy list based on what's prevalent
    if (tribalCards >= 8) {
      const mainTribe = commanderTribes[0]; // Use first/primary tribe
      if (mainTribe) synergies.push(`${mainTribe} tribal`);
    }
    
    if (tokenCards >= 6) synergies.push('token generation');
    if (artifactCards >= 10) synergies.push('artifact synergies');
    if (graveyardCards >= 6) synergies.push('graveyard value');
    if (counterCards >= 6) synergies.push('+1/+1 counters');
    
    // Add commander-specific synergies
    if (commanderText.includes('whenever') && commanderText.includes('enter')) {
      synergies.push('ETB value');
    }
    if (commanderText.includes('landfall')) {
      synergies.push('landfall triggers');
    }
    if (commanderText.includes('spells') && commanderText.includes('instant')) {
      synergies.push('spellslinger');
    }
    
    if (synergies.length === 0) {
      synergies.push('goodstuff value');
    }
    
    // Generate explanation with specific card examples
    let explanation = '';
    if (synergies.includes('token generation')) {
      const tokenExamples = tokenEngines.slice(0, 3).map(card => card.name);
      explanation += `The deck creates multiple tokens to overwhelm opponents and enable sacrifice synergies`;
      if (tokenExamples.length > 0) {
        explanation += ` through cards like ${tokenExamples.join(', ')}`;
      }
      explanation += '. ';
    }
    if (synergies.some(s => s.includes('tribal'))) {
      const tribalExamples = deck.filter(card => {
        const tribes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit'];
        return tribes.some(tribe => 
          commanderTypes.includes(tribe) && 
          (card.type_line.toLowerCase().includes(tribe) || 
           (card.oracle_text || '').toLowerCase().includes(tribe))
        );
      }).slice(0, 3).map(card => card.name);
      explanation += `Tribal synergies provide anthem effects and lord bonuses to create powerful board states`;
      if (tribalExamples.length > 0) {
        explanation += ` with creatures like ${tribalExamples.join(', ')}`;
      }
      explanation += '. ';
    }
    if (synergies.includes('artifact synergies')) {
      const artifactExamples = deck.filter(card => 
        card.type_line.toLowerCase().includes('artifact') ||
        (card.oracle_text || '').toLowerCase().includes('artifact')
      ).slice(0, 3).map(card => card.name);
      explanation += `Artifact synergies provide cost reduction, card advantage, and combo potential`;
      if (artifactExamples.length > 0) {
        explanation += ` through cards like ${artifactExamples.join(', ')}`;
      }
      explanation += '. ';
    }
    if (synergies.includes('graveyard value')) {
      const graveyardExamples = deck.filter(card => 
        (card.oracle_text || '').toLowerCase().includes('graveyard')
      ).slice(0, 3).map(card => card.name);
      explanation += `Graveyard strategies enable recursion and value engines for long-term advantage`;
      if (graveyardExamples.length > 0) {
        explanation += ` using cards like ${graveyardExamples.join(', ')}`;
      }
      explanation += '. ';
    }
    
    return { synergies, synergyExplanation: explanation.trim() };
  }
  
  private analyzeGameplan(deck: DeckCard[], commander: ScryfallCard, constraints: GenerationConstraints): {
    earlyGame: string;
    midGame: string;
    lateGame: string;
    winConditions: string[];
    winExplanation: string;
  } {
    const commanderAbilities = this.analyzeCommanderAbilities(commander);
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderCmc = commander.cmc;
    
    const rampCards = deck.filter(card => card.role === 'Ramp').length;
    const drawCards = deck.filter(card => card.role === 'Draw/Advantage').length;
    const avgCmc = deck.reduce((sum, card) => sum + card.cmc, 0) / deck.length;
    const highCostCards = deck.filter(card => card.cmc >= 6).length;
    
    // Determine commander strategy type
    const strategyType = this.identifyCommanderStrategy(commander, commanderAbilities);
    
    // Commander-specific early game analysis
    let earlyGame = '';
    const lowCostCards = deck.filter(card => card.cmc <= 2 && card.role !== 'Land').slice(0, 3);
    const rampExamples = deck.filter(card => card.role === 'Ramp').slice(0, 3);
    
    switch (strategyType) {
      case 'tribal':
        const tribes = this.extractCreatureTypesFromText(commanderText);
        const tribalCards = deck.filter(card => 
          tribes.some(tribe => 
            this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase()).includes(tribe) ||
            this.extractCreatureTypesFromText(card.oracle_text || '').includes(tribe)
          )
        ).slice(0, 3);
        earlyGame = `Deploy early ${tribes.join('/')} creatures to build tribal synergies`;
        if (tribalCards.length > 0) {
          earlyGame += ` with cards like ${tribalCards.map(c => c.name).join(', ')}`;
        }
        earlyGame += `. Focus on establishing a tribal foundation before casting ${commander.name}.`;
        break;
        
      case 'combo':
        const tutorCards = deck.filter(card => card.role === 'Tutor').slice(0, 2);
        earlyGame = `Prioritize card selection and mana development to assemble combo pieces`;
        if (tutorCards.length > 0) {
          earlyGame += ` using tutors like ${tutorCards.map(c => c.name).join(', ')}`;
        }
        earlyGame += `. Protect key pieces and maintain a low profile until ready to execute.`;
        break;
        
      case 'value_engine':
        const etbCards = deck.filter(card => 
          (card.oracle_text || '').toLowerCase().includes('enters the battlefield')
        ).slice(0, 3);
        earlyGame = `Set up value engines and card advantage pieces before deploying ${commander.name}`;
        if (etbCards.length > 0) {
          earlyGame += ` with ETB creatures like ${etbCards.map(c => c.name).join(', ')}`;
        }
        earlyGame += `. Focus on incremental advantage rather than aggressive plays.`;
        break;
        
      case 'aggressive':
        const fastCards = deck.filter(card => card.cmc <= 3 && card.type_line.toLowerCase().includes('creature')).slice(0, 3);
        earlyGame = `Apply early pressure with efficient threats`;
        if (fastCards.length > 0) {
          earlyGame += ` such as ${fastCards.map(c => c.name).join(', ')}`;
        }
        earlyGame += `. Deploy ${commander.name} to enhance your aggressive strategy.`;
        break;
        
      case 'control':
        const controlCards = deck.filter(card => 
          card.role === 'Removal/Interaction' || 
          (card.oracle_text || '').toLowerCase().includes('counter')
        ).slice(0, 3);
        earlyGame = `Control the early game with interaction and card selection`;
        if (controlCards.length > 0) {
          earlyGame += ` using tools like ${controlCards.map(c => c.name).join(', ')}`;
        }
        earlyGame += `. Delay deploying ${commander.name} until you can protect it effectively.`;
        break;
        
      case 'ramp':
        earlyGame = `Accelerate your mana base to deploy ${commander.name} ahead of schedule`;
        if (rampExamples.length > 0) {
          earlyGame += ` with ramp spells like ${rampExamples.map(c => c.name).join(', ')}`;
        }
        earlyGame += `. Prioritize mana development over early threats.`;
        break;
        
      default:
        // Analyze commander's actual abilities for specific strategy
        if (commanderCmc <= 3) {
          earlyGame = `Deploy ${commander.name} early to begin leveraging its abilities`;
          if (lowCostCards.length > 0) {
            earlyGame += ` alongside support cards like ${lowCostCards.map(c => c.name).join(', ')}`;
          }
        } else if (commanderCmc >= 6) {
          earlyGame = `Build toward casting ${commander.name} with setup cards`;
          if (rampExamples.length > 0) {
            earlyGame += ` including mana acceleration like ${rampExamples.map(c => c.name).join(', ')}`;
          }
        } else {
          earlyGame = `Prepare the battlefield for ${commander.name}'s arrival`;
          if (lowCostCards.length > 0) {
            earlyGame += ` with supporting pieces like ${lowCostCards.map(c => c.name).join(', ')}`;
          }
        }
        earlyGame += '.';
    }
    
    // Commander-specific mid game analysis
    let midGame = '';
    switch (strategyType) {
      case 'tribal':
        midGame = `Deploy ${commander.name} to enhance your tribal synergies and apply significant pressure. Use anthem effects and tribal support to overwhelm opponents.`;
        break;
      case 'combo':
        midGame = `Assemble combo pieces while using ${commander.name} to enable or protect your win condition. Maintain interaction to prevent opponent disruption.`;
        break;
      case 'value_engine':
        midGame = `Leverage ${commander.name}'s abilities to generate card advantage and incremental value. Build an engine that outresources opponents.`;
        break;
      case 'aggressive':
        midGame = `Use ${commander.name} to enhance your aggro strategy and close out games quickly. Maintain pressure while protecting key threats.`;
        break;
      case 'control':
        midGame = `Deploy ${commander.name} as a win condition while maintaining control of the game. Use interaction to protect your board state.`;
        break;
      case 'ramp':
        midGame = `Cast ${commander.name} early and leverage the mana advantage to deploy multiple threats per turn or protect your strategy.`;
        break;
      default:
        midGame = `Execute ${commander.name}'s primary strategy while adapting to board state and opponent responses.`;
    }
    
    // Commander-specific late game analysis
    let lateGame = '';
    if (highCostCards >= 8) {
      lateGame = `Deploy powerful finishers and use ${commander.name} to support your end-game strategy. Focus on closing out games efficiently.`;
    } else if (strategyType === 'value_engine') {
      lateGame = `Use accumulated card advantage and resources to overwhelm opponents. ${commander.name} should have generated significant value by this point.`;
    } else {
      lateGame = `Leverage the advantage generated by ${commander.name} throughout the game to secure victory through your preferred win conditions.`;
    }
    
    if (constraints.power_level >= 6) {
      lateGame += 'Look for combo opportunities or overwhelming board states.';
    } else {
      lateGame += 'Focus on incremental advantage and defensive plays.';
    }
    
    // Win condition analysis
    const winConditions: string[] = [];
    let winExplanation = '';
    
    const comboPieces = deck.filter(card => 
      (card.oracle_text || '').toLowerCase().includes('infinite') ||
      (card.oracle_text || '').toLowerCase().includes('combo')
    ).length;
    
    if (constraints.combo_tolerance === 'open' && comboPieces >= 3) {
      const comboExamples = deck.filter(card => 
        (card.oracle_text || '').toLowerCase().includes('infinite') ||
        (card.oracle_text || '').toLowerCase().includes('combo')
      ).slice(0, 2).map(card => card.name);
      winConditions.push('infinite combos');
      winExplanation += `Execute infinite combinations for immediate wins`;
      if (comboExamples.length > 0) {
        winExplanation += ` with cards like ${comboExamples.join(' and ')}`;
      }
      winExplanation += '. ';
    }
    
    const bigCreatures = deck.filter(card => 
      card.type_line.toLowerCase().includes('creature') && card.cmc >= 6
    );
    
    if (bigCreatures.length >= 5) {
      const bigCreatureExamples = bigCreatures.slice(0, 3).map(card => card.name);
      winConditions.push('large creatures');
      winExplanation += `Deploy massive threats to deal lethal damage`;
      if (bigCreatureExamples.length > 0) {
        winExplanation += ` with creatures like ${bigCreatureExamples.join(', ')}`;
      }
      winExplanation += '. ';
    }
    
    const tokenEngines = this.identifyTokenEngines(deck);
    
    if (tokenEngines.length >= 4) {
      const tokenExamples = tokenEngines.slice(0, 3).map(card => card.name);
      winConditions.push('token swarms');
      winExplanation += `Overwhelm opponents with numerous creatures`;
      if (tokenExamples.length > 0) {
        winExplanation += ` generated by cards like ${tokenExamples.join(', ')}`;
      }
      winExplanation += '. ';
    }
    
    // Damage-over-time analysis (pings, burn, ETB damage)
    const damageEngines = deck.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      return (text.includes('deal') && text.includes('damage')) ||
             (text.includes('whenever') && text.includes('enters') && text.includes('damage')) ||
             (text.includes('ping') || text.includes('shock')) ||
             (text.includes('damage') && (text.includes('each') || text.includes('all')));
    });
    
    if (damageEngines.length >= 3) {
      const damageExamples = damageEngines.slice(0, 3).map(card => card.name);
      winConditions.push('damage-over-time');
      winExplanation += `Accumulate small amounts of damage over time to eliminate opponents`;
      if (damageExamples.length > 0) {
        winExplanation += ` using cards like ${damageExamples.join(', ')}`;
      }
      winExplanation += '. ';
    }
    
    // Voltron/Commander damage analysis
    const voltronPieces = deck.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      const type = card.type_line.toLowerCase();
      return type.includes('equipment') ||
             (type.includes('enchantment') && text.includes('enchant creature')) ||
             (text.includes('equipped creature') || text.includes('enchanted creature'));
    });
    
    if (voltronPieces.length >= 4) {
      const voltronExamples = voltronPieces.slice(0, 3).map(card => card.name);
      winConditions.push('voltron/commander damage');
      winExplanation += `Enhance ${commander.name} with equipment and auras for lethal commander damage`;
      if (voltronExamples.length > 0) {
        winExplanation += ` using cards like ${voltronExamples.join(', ')}`;
      }
      winExplanation += '. ';
    }
    
    if (winConditions.length === 0) {
      winConditions.push('commander damage', 'incremental advantage');
      winExplanation = 'Win through sustained pressure and card advantage.';
    }
    
    return {
      earlyGame: earlyGame.trim(),
      midGame: midGame.trim(), 
      lateGame: lateGame.trim(),
      winConditions,
      winExplanation: winExplanation.trim()
    };
  }

  private async generateAppropriateNonBasicLands(colorIdentity: string[]): Promise<ScryfallCard[]> {
    const appropriateLands: ScryfallCard[] = [];
    
    try {
      // Always include Command Tower and Arcane Signet lands
      const staples = ['Command Tower', 'Reflecting Pool'];
      for (const name of staples) {
        try {
          const card = await this.scryfallClient.getCardByName(name);
          appropriateLands.push(card);
        } catch (error) {
          // Ignore if not found
        }
      }
      
      if (colorIdentity.length === 0) {
        // Colorless deck lands
        const colorlessLands = ['Wastes', 'Cavern of Souls', 'Eldrazi Temple'];
        for (const name of colorlessLands) {
          try {
            const card = await this.scryfallClient.getCardByName(name);
            appropriateLands.push(card);
          } catch (error) {
            // Ignore if not found
          }
        }
      } else if (colorIdentity.length === 1) {
        // Mono-color utility lands
        const utilityQueries = [
          `t:land o:"add {${colorIdentity[0]}}"`, // Lands that add the specific color
          't:land o:"enters the battlefield untapped"' // Fast lands
        ];
        
        for (const query of utilityQueries) {
          const results = await this.scryfallClient.searchCardsByColorIdentity([], query, 'edhrec');
          appropriateLands.push(...results.slice(0, 5));
        }
      } else {
        // Multi-color: fetch specific dual land combinations
        appropriateLands.push(...await this.generateMultiColorLands(colorIdentity));
      }
      
    } catch (error) {
      console.error('Error generating appropriate lands:', error);
    }
    
    return appropriateLands;
  }
  
  private async generateMultiColorLands(colorIdentity: string[]): Promise<ScryfallCard[]> {
    const multiLands: ScryfallCard[] = [];
    
    // Generate all 2-color combinations from the commander's colors
    const colorPairs: string[][] = [];
    for (let i = 0; i < colorIdentity.length; i++) {
      for (let j = i + 1; j < colorIdentity.length; j++) {
        colorPairs.push([colorIdentity[i], colorIdentity[j]]);
      }
    }
    
    try {
      // Search for dual lands that match our specific color pairs
      for (const pair of colorPairs) {
        const dualLandQuery = `t:land (o:"add {${pair[0]}}" OR o:"add {${pair[1]}}") (o:"add {${pair[0]}}" AND o:"add {${pair[1]}}")`;
        const results = await this.scryfallClient.searchCards(dualLandQuery, 1, 'edhrec');
        
        // Filter to only lands that produce EXACTLY our colors (no extra colors)
        const appropriateResults = results.data.filter(land => {
          const landText = (land.oracle_text || '').toLowerCase();
          // Check if land only produces colors in our identity
          const producesExtraColors = ['w', 'u', 'b', 'r', 'g'].some(color => {
            if (colorIdentity.includes(color.toUpperCase())) return false;
            return landText.includes(`{${color}}`) || landText.includes(`add ${color}`);
          });
          return !producesExtraColors;
        });
        
        multiLands.push(...appropriateResults.slice(0, 3)); // Limit per color pair
      }
      
      // Add appropriate fetch lands and shock lands
      if (colorIdentity.length >= 2) {
        const fetchLandQueries = [
          't:land o:"search your library for" o:"land"', // Fetch lands
          't:land o:"enters the battlefield tapped unless"' // Shock lands
        ];
        
        for (const query of fetchLandQueries) {
          const results = await this.scryfallClient.searchCards(query, 1, 'edhrec');
          // Filter for appropriate colors only
          const appropriateResults = results.data.filter(land => {
            const landColors = land.color_identity || [];
            return landColors.every(color => colorIdentity.includes(color)) &&
                   landColors.length <= colorIdentity.length;
          });
          multiLands.push(...appropriateResults.slice(0, 5));
        }
      }
      
    } catch (error) {
      console.error('Error generating multi-color lands:', error);
    }
    
    return multiLands;
  }

  private getBasicLandNames(colorIdentity: string[]): string[] {
    const landMap: Record<string, string> = {
      'W': 'Plains',
      'U': 'Island',
      'B': 'Swamp',
      'R': 'Mountain',
      'G': 'Forest'
    };
    
    return colorIdentity.map(color => landMap[color]).filter(Boolean);
  }

  private analyzeCommanderAbilities(commander: ScryfallCard): Array<{type: string, keywords: string[], priority: number, context?: string}> {
    const abilities: Array<{type: string, keywords: string[], priority: number, context?: string}> = [];
    const text = (commander.oracle_text || '').toLowerCase();
    const typeLine = commander.type_line.toLowerCase();
    
    // Uncomment for detailed debugging: console.log(`Deep analyzing ${commander.name} oracle text:`, commander.oracle_text);
    
    // DEEP ORACLE TEXT PARSING: Extract complex multi-synergy abilities
    const complexAbilities = this.parseComplexAbilities(text);
    abilities.push(...complexAbilities);
    
    // Special commander-specific strategy detection based on successful archetypes
    this.detectSpecificCommanderStrategies(commander, abilities);
    
    // Extract creature types mentioned in oracle text (not just type line)
    const oracleTribes = this.extractCreatureTypesFromText(text);
    const typeLineTribes = this.extractCreatureTypesFromTypeLine(typeLine);
    const allTribes = Array.from(new Set([...oracleTribes, ...typeLineTribes]));
    
    if (allTribes.length > 0) {
      abilities.push({
        type: 'tribal',
        keywords: allTribes,
        priority: 9,
        context: 'commander_types_and_oracle'
      });
    }
    
    // Enhanced triggered ability parsing with creature-type-specific conditions
    const triggeredAbilities = this.parseTriggeredAbilities(text);
    abilities.push(...triggeredAbilities);
    
    // Self-exile/blink abilities (like Norin)
    if (text.includes('exile') && text.includes('return')) {
      abilities.push({
        type: 'self_blink',
        keywords: ['exile', 'return', 'flicker', 'blink'],
        priority: 15,
        context: 'self_protection'
      });
    }
    
    // Activated abilities with enhanced parsing
    const activatedAbilities = this.parseActivatedAbilities(text);
    abilities.push(...activatedAbilities);
    
    // Static abilities with creature type awareness
    const staticAbilities = this.parseStaticAbilities(text);
    abilities.push(...staticAbilities);
    
    console.log(`Commander ${commander.name} deep abilities detected:`, abilities);
    return abilities;
  }

  /**
   * Convert LocalCardData to ScryfallCard format for compatibility
   */
  private convertLocalToScryfall(localCard: any): ScryfallCard {
    return {
      id: localCard.id,
      name: localCard.name,
      mana_cost: localCard.mana_cost,
      cmc: localCard.cmc,
      type_line: localCard.type_line,
      oracle_text: localCard.oracle_text,
      color_identity: localCard.color_identity,
      colors: localCard.colors,
      legalities: localCard.legalities,
      prices: localCard.prices,
      edhrec_rank: localCard.edhrec_rank,
      keywords: localCard.keywords,
      set: localCard.set_code,
      set_name: localCard.set_name,
      image_uris: localCard.image_uris
    };
  }
  
  /**
   * Enhanced card search using local database with fallback to API
   */
  private async searchCardsLocally(query: string, colorIdentity: string[], limit = 500): Promise<ScryfallCard[]> {
    try {
      // For broad color identity searches, use local database without complex query parsing
      if (query.includes('legal:commander') && query.includes('-type:land')) {
        console.log(`🚀 Searching local database for color identity: ${colorIdentity.join('')}`);
        
        // Get all legal cards in color identity (no land types)
        const localResults = this.localDatabase.searchByFilters({
          colorIdentity: colorIdentity.length > 0 ? colorIdentity : undefined,
          legal_in_commander: true
        }, limit);
        
        // Filter out lands
        const nonLandResults = localResults.filter(card => !card.type_line.toLowerCase().includes('land'));
        
        if (nonLandResults.length > 0) {
          console.log(`🚀 Found ${nonLandResults.length} non-land cards in local database`);
          return nonLandResults.map(card => this.convertLocalToScryfall(card));
        }
      }
      
      // For colorless artifact searches
      if (query.includes('color:colorless') && query.includes('type:artifact')) {
        console.log(`🚀 Searching local database for colorless artifacts within color identity: ${colorIdentity.join('')}`);
        
        const localResults = this.localDatabase.searchByFilters({
          legal_in_commander: true
        }, limit);
        
        // Filter for colorless artifacts and mana fixers that fit color identity
        const colorlessResults = localResults.filter(card => {
          const isColorless = card.color_identity.length === 0;
          const isArtifact = card.type_line.toLowerCase().includes('artifact');
          const isLand = card.type_line.toLowerCase().includes('land');
          const hasAnyColor = (card.oracle_text || '').toLowerCase().includes('any color');
          
          // CRITICAL: Ensure card fits within commander's color identity
          const fitsColorIdentity = isColorIdentityValid(this.convertLocalToScryfall(card), colorIdentity);
          
          return !isLand && (isColorless || hasAnyColor) && (isArtifact || hasAnyColor) && fitsColorIdentity;
        });
        
        if (colorlessResults.length > 0) {
          console.log(`🚀 Found ${colorlessResults.length} colorless artifacts in local database`);
          return colorlessResults.map(card => this.convertLocalToScryfall(card));
        }
      }
      
      // Fallback to API for complex queries
      console.log(`⚠️ Falling back to API for complex query: ${query}`);
      const apiResponse = await this.scryfallClient.searchCards(query);
      return apiResponse.data || [];
      
    } catch (error) {
      console.error(`Error searching cards locally: ${error}`);
      // Fallback to API
      const apiResponse = await this.scryfallClient.searchCards(query);
      return apiResponse.data || [];
    }
  }

  private detectSpecificCommanderStrategies(commander: ScryfallCard, abilities: Array<{type: string, keywords: string[], priority: number, context?: string}>): void {
    console.log(`🔧 Performing mechanical analysis for commander: ${commander.name}`);
    
    // Convert commander to LocalCardData format for mechanical analysis
    const commanderData = {
      id: commander.id,
      name: commander.name,
      oracle_text: commander.oracle_text || '',
      type_line: commander.type_line,
      mana_cost: commander.mana_cost || '',
      cmc: commander.cmc,
      color_identity: commander.color_identity,
      keywords: commander.keywords || [],
      mechanics: undefined // Will be populated by mechanical analysis
    };
    
    // Perform comprehensive mechanical analysis on the commander
    const commanderMechanics = cardMechanicsTagger.analyzeCard(commanderData);
    commanderData.mechanics = commanderMechanics;
    
    // Use strategy detector to identify commander's strategy profile
    const strategyProfile = strategyDetector.analyzeStrategy([commanderData], commanderData);
    
    console.log(`📊 Detected strategy: ${strategyProfile.primary} (confidence: ${strategyProfile.confidence.toFixed(2)})`);
    console.log(`🔧 Mechanical basis: ${strategyProfile.mechanicalBasis.join(', ')}`);
    
    // Convert strategy profile to abilities format for compatibility with existing system
    if (strategyProfile.confidence > 0.5) {
      abilities.push({
        type: strategyProfile.primary,
        keywords: strategyProfile.mechanicalBasis,
        priority: Math.round(strategyProfile.confidence * 20), // Convert 0-1 to 0-20 scale
        context: strategyProfile.explanation
      });
    }
    
    // Add secondary strategies if they're strong enough
    strategyProfile.secondary.forEach(secondaryStrategy => {
      abilities.push({
        type: secondaryStrategy,
        keywords: strategyProfile.mechanicalBasis,
        priority: Math.round(strategyProfile.confidence * 15), // Slightly lower priority
        context: `Secondary strategy: ${secondaryStrategy}`
      });
    });
    
    console.log(`✅ Added ${1 + strategyProfile.secondary.length} mechanical strategies for ${commander.name}`);
  }

  private extractKeywordsFromText(text: string, context?: string): string[] {
    const keywords: string[] = [];
    const lowercaseText = text.toLowerCase();
    
    // Game mechanics
    const mechanics = [
      'token', 'create', 'sacrifice', 'destroy', 'exile', 'return', 'draw', 'discard',
      'damage', 'life', 'counter', '+1/+1', '-1/-1', 'tap', 'untap', 'search',
      'mill', 'graveyard', 'battlefield', 'hand', 'library', 'flash', 'haste',
      'flying', 'trample', 'lifelink', 'deathtouch', 'vigilance', 'hexproof',
      'indestructible', 'menace', 'reach', 'first strike', 'double strike',
      'landfall', 'raid', 'prowess', 'devotion', 'constellation', 'metalcraft'
    ];
    
    for (const mechanic of mechanics) {
      if (lowercaseText.includes(mechanic)) {
        keywords.push(mechanic);
      }
    }
    
    // Card types
    const cardTypes = ['artifact', 'creature', 'enchantment', 'instant', 'sorcery', 'land', 'planeswalker'];
    for (const type of cardTypes) {
      if (lowercaseText.includes(type)) {
        keywords.push(type);
      }
    }
    
    return Array.from(new Set(keywords)); // Remove duplicates
  }

  private buildSynergyQueriesForAbility(ability: {type: string, keywords: string[], priority: number, context?: string}): Array<{query: string, priority: number}> {
    const queries: Array<{query: string, priority: number}> = [];
    
    switch (ability.type) {
      // Enhanced creature-type-specific ETB abilities
      case 'creature_etb_draw':
        const drawCreatureType = ability.keywords[0];
        queries.push(
          {query: `t:${drawCreatureType}`, priority: ability.priority + 1},
          {query: `o:"${drawCreatureType}" o:"enters"`, priority: ability.priority},
          {query: 'o:"enters the battlefield" o:"draw"', priority: ability.priority},
          {query: 'o:"panharmonicon"', priority: ability.priority + 1}, // ETB doubler
          {query: 'o:"conjurer\'s closet" OR o:"flickerwisp"', priority: ability.priority - 1}, // Flicker for more ETBs
          {query: `o:"${drawCreatureType}" -t:land`, priority: ability.priority - 1}
        );
        break;
        
      case 'creature_etb_counters':
        const counterCreatureType = ability.keywords[0];
        queries.push(
          {query: `t:${counterCreatureType}`, priority: ability.priority + 1},
          {query: `o:"${counterCreatureType}" o:"enters"`, priority: ability.priority},
          {query: 'o:"enters the battlefield" o:"+1/+1"', priority: ability.priority},
          {query: 'o:"+1/+1" o:"counter"', priority: ability.priority - 1},
          {query: 'o:"panharmonicon"', priority: ability.priority + 1},
          {query: `o:"${counterCreatureType}" -t:land`, priority: ability.priority - 1}
        );
        break;
        
      case 'creature_etb_damage':
        const damageCreatureType = ability.keywords[0];
        queries.push(
          {query: `t:${damageCreatureType}`, priority: ability.priority + 1},
          {query: `o:"${damageCreatureType}" o:"enters"`, priority: ability.priority},
          {query: 'o:"enters the battlefield" o:"damage"', priority: ability.priority},
          {query: 'o:"impact tremors" OR o:"purphoros"', priority: ability.priority},
          {query: 'o:"panharmonicon"', priority: ability.priority + 1},
          // DAMAGE AMPLIFIERS - Critical for ETB damage strategies
          {query: 'o:"furnace of rath" OR o:"dictate of the twin gods"', priority: ability.priority + 1}, // Double damage
          {query: 'o:"damage" o:"double" OR o:"twice as much damage"', priority: ability.priority},
          {query: 'o:"damage" o:"additional" OR o:"deals 1 more damage"', priority: ability.priority - 1},
          {query: 'o:"whenever" o:"damage" o:"dealt"', priority: ability.priority - 1}, // Damage synergies
          {query: `o:"${damageCreatureType}" -t:land`, priority: ability.priority - 1}
        );
        break;
        
      case 'creature_etb_token':
        const tokenCreatureType = ability.keywords[0];
        queries.push(
          {query: `t:${tokenCreatureType}`, priority: ability.priority + 1},
          {query: `o:"${tokenCreatureType}" o:"enters"`, priority: ability.priority},
          {query: 'o:"enters the battlefield" o:"create"', priority: ability.priority},
          {query: 'o:"create" o:"token"', priority: ability.priority - 1},
          {query: 'o:"panharmonicon"', priority: ability.priority + 1},
          {query: `o:"${tokenCreatureType}" -t:land`, priority: ability.priority - 1}
        );
        break;
        
      case 'creature_etb_lifegain':
        const lifegainCreatureType = ability.keywords[0];
        queries.push(
          {query: `t:${lifegainCreatureType}`, priority: ability.priority + 1},
          {query: `o:"${lifegainCreatureType}" o:"enters"`, priority: ability.priority},
          {query: 'o:"enters the battlefield" o:"gain" o:"life"', priority: ability.priority},
          {query: 'o:"soul warden" OR o:"soul\'s attendant"', priority: ability.priority},
          {query: 'o:"panharmonicon"', priority: ability.priority + 1},
          {query: `o:"${lifegainCreatureType}" -t:land`, priority: ability.priority - 1}
        );
        break;
        
      case 'tribal_lord':
        // Handle multiple tribes for lord effects
        for (const tribe of ability.keywords.filter(k => !['anthem', 'boost', '+1/+1', 'flying', 'haste', 'vigilance'].includes(k))) {
          queries.push(
            {query: `t:${tribe}`, priority: ability.priority + 2},
            {query: `o:"${tribe}" o:"you control"`, priority: ability.priority + 1},
            {query: `o:"other ${tribe}s"`, priority: ability.priority},
            {query: `o:"${tribe}" -t:land`, priority: ability.priority - 1}
          );
        }
        // Add anthem/boost support
        if (ability.keywords.includes('+1/+1')) {
          queries.push({query: 'o:"anthem" OR o:"all creatures" o:"get +1/+1"', priority: ability.priority - 1});
        }
        break;
        
      case 'creature_action_trigger':
        const actionCreatureType = ability.keywords[0];
        const action = ability.keywords[1];
        queries.push(
          {query: `t:${actionCreatureType}`, priority: ability.priority + 1},
          {query: `o:"${actionCreatureType}" o:"${action}"`, priority: ability.priority},
          {query: `o:"whenever" o:"${action}"`, priority: ability.priority - 1},
          {query: `o:"${actionCreatureType}" -t:land`, priority: ability.priority - 1}
        );
        break;
        
      // Keep existing cases for backwards compatibility
      case 'etb':
        queries.push(
          {query: 'o:"enters the battlefield" -t:land', priority: ability.priority},
          {query: 'o:"whenever" o:"enters"', priority: ability.priority - 1},
          {query: 'o:"panharmonicon"', priority: ability.priority} // Doubles ETB triggers
        );
        
        // Add specific ETB payoffs based on keywords
        if (ability.keywords.includes('token')) {
          queries.push({query: 'o:"enters" o:"create" o:"token"', priority: ability.priority - 1});
        }
        if (ability.keywords.includes('damage')) {
          queries.push({query: 'o:"enters" o:"deal" o:"damage"', priority: ability.priority - 1});
        }
        if (ability.keywords.includes('draw')) {
          queries.push({query: 'o:"enters" o:"draw"', priority: ability.priority - 1});
        }
        break;
        
      case 'self_blink':
        queries.push(
          {query: 'o:"enters the battlefield" -t:land', priority: ability.priority},
          {query: 'o:"flicker" OR o:"blink"', priority: ability.priority - 1},
          {query: 'o:"exile" o:"return" o:"battlefield"', priority: ability.priority - 2},
          {query: 'o:"whenever" o:"creature" o:"enters"', priority: ability.priority - 1},
          {query: 'o:"impact tremors" OR o:"purphoros"', priority: ability.priority - 2}
        );
        break;
        
      // NEW STRATEGY TYPES based on successful deck analysis
      case 'etb_value':
        // Use mechanical patterns for ETB strategies instead of hardcoded names
        queries.push(
          {query: 'o:"enters the battlefield" o:"damage"', priority: ability.priority + 2},
          {query: 'o:"whenever" o:"creature" o:"enters"', priority: ability.priority + 2},
          {query: 'o:"double" o:"triggered abilities"', priority: ability.priority + 1}, // Panharmonicon effects
          {query: 'o:"enters the battlefield" o:"draw"', priority: ability.priority + 1},
          {query: 'o:"enters the battlefield" o:"create"', priority: ability.priority + 1},
          {query: 'o:"exile" o:"return"', priority: ability.priority}, // Flicker
          {query: 'o:"flicker" OR o:"blink"', priority: ability.priority},
          {query: 'o:"enters the battlefield" o:"target"', priority: ability.priority - 1},
          {query: 'o:"when" o:"enters"', priority: ability.priority - 1}
        );
        break;
        
      case 'token_swarm':
        // Use mechanical patterns instead of hardcoded card names
        queries.push(
          {query: 'o:"create" o:"token"', priority: ability.priority + 2},
          {query: 'o:"token" o:"you control"', priority: ability.priority + 1},
          {query: 'o:"double" o:"token"', priority: ability.priority + 2}, // Doubling effects
          {query: 'o:"double" o:"create"', priority: ability.priority + 2},
          {query: 'o:"creatures you control get"', priority: ability.priority + 1}, // Anthems
          {query: 'o:"tokens you control"', priority: ability.priority + 1},
          {query: 'o:"whenever" o:"token" o:"enters"', priority: ability.priority},
          {query: 'o:"populate"', priority: ability.priority},
          {query: 'o:"whenever" o:"creature enters"', priority: ability.priority - 1}
        );
        break;
        
      case 'creature_tribal':
        // Extract actual creature types from keywords, ignoring hardcoded card names
        const tribalTypes = ability.keywords.filter(k => 
          !k.includes('tribal') && !k.includes('door of') && !k.includes('banner') && 
          !k.includes('coat of') && !k.includes('unity')
        );
        for (const tribe of tribalTypes) {
          queries.push(
            {query: `t:${tribe}`, priority: ability.priority + 2},
            {query: `o:"${tribe}" o:"you control"`, priority: ability.priority + 1},
            {query: `o:"${tribe}" o:"get"`, priority: ability.priority + 1}, // Tribal lords
            {query: `o:"other ${tribe}s"`, priority: ability.priority + 1},
            {query: `o:"${tribe}" o:"creature"`, priority: ability.priority},
            {query: 'o:"choose a creature type"', priority: ability.priority}, // Generic tribal support
            {query: 'o:"creatures you control get"', priority: ability.priority - 1} // General anthems
          );
        }
        break;

      // Additional mechanical strategy types from strategy-detection.ts
      case 'voltron':
        queries.push(
          {query: 'o:"equip"', priority: ability.priority + 2},
          {query: 'o:"attach" o:"aura"', priority: ability.priority + 2},
          {query: 'o:"gets +"', priority: ability.priority + 1}, // Stat boosts
          {query: 'o:"protection"', priority: ability.priority + 1},
          {query: 'o:"hexproof" OR o:"shroud"', priority: ability.priority + 1},
          {query: 'o:"equipped creature"', priority: ability.priority},
          {query: 'o:"enchanted creature"', priority: ability.priority},
          {query: 'o:"unblockable" OR o:"can\'t be blocked"', priority: ability.priority - 1}
        );
        break;

      case 'combo':
        queries.push(
          {query: 'o:"activated abilities" o:"cost"', priority: ability.priority + 2},
          {query: 'o:"without paying"', priority: ability.priority + 2}, // Alternative costs
          {query: 'o:"search" o:"library"', priority: ability.priority + 1}, // Tutors
          {query: 'o:"untap"', priority: ability.priority + 1},
          {query: 'o:"infinite"', priority: ability.priority}, // Combo pieces
          {query: 'o:"may activate" o:"any time"', priority: ability.priority}
        );
        break;

      case 'card_advantage':
        queries.push(
          {query: 'o:"draw" o:"card"', priority: ability.priority + 2},
          {query: 'o:"scry"', priority: ability.priority + 1},
          {query: 'o:"look at" o:"top"', priority: ability.priority + 1},
          {query: 'o:"search" o:"library"', priority: ability.priority + 1}, // Tutors
          {query: 'o:"return" o:"from" o:"graveyard"', priority: ability.priority},
          {query: 'o:"whenever" o:"draw"', priority: ability.priority - 1}
        );
        break;

      case 'ramp':
        queries.push(
          {query: 'o:"add" o:"mana"', priority: ability.priority + 2},
          {query: 'o:"search" o:"land"', priority: ability.priority + 2},
          {query: 'o:"put" o:"land" o:"battlefield"', priority: ability.priority + 1},
          {query: 'o:"additional land"', priority: ability.priority + 1},
          {query: 't:artifact o:"mana"', priority: ability.priority}, // Mana rocks
          {query: 'o:"treasure"', priority: ability.priority}
        );
        break;

      case 'artifact_synergy':
        queries.push(
          {query: 'o:"artifact" o:"you control"', priority: ability.priority + 2},
          {query: 'o:"whenever" o:"artifact" o:"enters"', priority: ability.priority + 2},
          {query: 'o:"metalcraft"', priority: ability.priority + 1},
          {query: 'o:"improvise"', priority: ability.priority + 1},
          {query: 'o:"affinity"', priority: ability.priority + 1},
          {query: 't:artifact', priority: ability.priority}
        );
        break;

      case 'graveyard_synergy':
        queries.push(
          {query: 'o:"return" o:"graveyard" o:"battlefield"', priority: ability.priority + 2},
          {query: 'o:"mill"', priority: ability.priority + 1},
          {query: 'o:"put" o:"graveyard"', priority: ability.priority + 1},
          {query: 'o:"flashback"', priority: ability.priority + 1},
          {query: 'o:"whenever" o:"dies"', priority: ability.priority},
          {query: 'o:"dredge"', priority: ability.priority}
        );
        break;
        
      case 'triggered':
        for (const keyword of ability.keywords) {
          if (keyword === 'sacrifice') {
            queries.push(
              {query: 'o:"sacrifice" o:"draw"', priority: ability.priority},
              {query: 'o:"whenever" o:"sacrifice"', priority: ability.priority - 1}
            );
          } else if (keyword === 'token') {
            queries.push(
              {query: 'o:"create" o:"token"', priority: ability.priority},
              {query: 'o:"populate"', priority: ability.priority - 1}
            );
          } else if (keyword === 'damage') {
            queries.push(
              {query: 'o:"deal" o:"damage"', priority: ability.priority},
              {query: 'o:"whenever" o:"damage"', priority: ability.priority - 1},
              // DAMAGE AMPLIFIERS for any damage-dealing strategy
              {query: 'o:"furnace of rath" OR o:"dictate of the twin gods"', priority: ability.priority},
              {query: 'o:"damage" o:"double" OR o:"twice as much"', priority: ability.priority - 1},
              {query: 'o:"damage" o:"additional" OR o:"deals 1 more"', priority: ability.priority - 2}
            );
          } else {
            queries.push({query: `o:"${keyword}"`, priority: ability.priority - 2});
          }
        }
        break;
        
      case 'activated':
        for (const keyword of ability.keywords) {
          if (keyword === 'tap') {
            queries.push({query: 'o:"untap"', priority: ability.priority - 1});
          } else if (keyword === 'sacrifice') {
            queries.push({query: 'o:"sacrifice" o:"target"', priority: ability.priority});
          } else {
            queries.push({query: `o:"${keyword}"`, priority: ability.priority - 2});
          }
        }
        break;
        
      case 'static':
        for (const keyword of ability.keywords) {
          if (keyword === 'creature') {
            queries.push(
              {query: 'o:"all creatures" OR o:"creatures you control"', priority: ability.priority},
              {query: 't:creature', priority: ability.priority - 2}
            );
          } else {
            queries.push({query: `o:"${keyword}"`, priority: ability.priority - 1});
          }
        }
        break;
        
      case 'tribal':
        // Handle multiple tribes (e.g., Cat Elf gets both cat and elf synergies)
        for (const tribe of ability.keywords) {
          queries.push(
            {query: `t:${tribe}`, priority: ability.priority + 1},
            {query: `o:"${tribe}"`, priority: ability.priority},
            {query: `o:"${tribe}s" OR o:"${tribe} you control"`, priority: ability.priority - 1}
          );
        }
        // Add general tribal support
        queries.push({query: 'o:"tribal" OR o:"lord" OR o:"choose a creature type"', priority: ability.priority - 1});
        break;
    }
    
    return queries;
  }

  private buildDynamicSynergyExplanation(deck: DeckCard[], commander: ScryfallCard, abilities: Array<{type: string, keywords: string[], priority: number}>): {synergies: string[], synergyExplanation: string} {
    const synergies: string[] = [];
    let explanation = '';
    
    const commanderText = (commander.oracle_text || '').toLowerCase();
    
    // Analyze deck for each detected ability with enhanced understanding
    for (const ability of abilities) {
      switch (ability.type) {
        case 'creature_etb_draw':
          const drawCreatureType = ability.keywords[0];
          const drawETBCards = deck.filter(card => 
            this.extractCreatureTypesFromText(card.oracle_text || '').includes(drawCreatureType) ||
            this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase()).includes(drawCreatureType) ||
            ((card.oracle_text || '').toLowerCase().includes('enters the battlefield') && (card.oracle_text || '').toLowerCase().includes('draw'))
          );
          
          if (drawETBCards.length >= 6) {
            synergies.push(`${drawCreatureType} card draw engine`);
            const examples = drawETBCards.slice(0, 3).map(card => card.name);
            explanation += `${commander.name} creates a powerful card draw engine by triggering whenever ${drawCreatureType}s enter the battlefield. The deck includes multiple ${drawCreatureType} creatures`;
            if (examples.length > 0) {
              explanation += ` such as ${examples.join(', ')}`;
            }
            explanation += ` to consistently draw extra cards and maintain hand size. `;
          }
          break;
          
        case 'creature_etb_counters':
          const counterCreatureType = ability.keywords[0];
          const counterETBCards = deck.filter(card => 
            this.extractCreatureTypesFromText(card.oracle_text || '').includes(counterCreatureType) ||
            this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase()).includes(counterCreatureType) ||
            ((card.oracle_text || '').toLowerCase().includes('enters the battlefield') && (card.oracle_text || '').toLowerCase().includes('+1/+1'))
          );
          
          if (counterETBCards.length >= 6) {
            synergies.push(`${counterCreatureType} +1/+1 counter engine`);
            const examples = counterETBCards.slice(0, 3).map(card => card.name);
            explanation += `${commander.name} builds board presence by placing +1/+1 counters whenever ${counterCreatureType}s enter the battlefield. The deck features numerous ${counterCreatureType} creatures`;
            if (examples.length > 0) {
              explanation += ` including ${examples.join(', ')}`;
            }
            explanation += ` to grow threats and apply consistent pressure. `;
          }
          break;
          
        case 'creature_etb_damage':
          const damageCreatureType = ability.keywords[0];
          const damageETBCards = deck.filter(card => 
            this.extractCreatureTypesFromText(card.oracle_text || '').includes(damageCreatureType) ||
            this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase()).includes(damageCreatureType) ||
            ((card.oracle_text || '').toLowerCase().includes('enters the battlefield') && (card.oracle_text || '').toLowerCase().includes('damage'))
          );
          
          if (damageETBCards.length >= 6) {
            synergies.push(`${damageCreatureType} damage engine`);
            const examples = damageETBCards.slice(0, 3).map(card => card.name);
            explanation += `${commander.name} creates a damage engine by dealing damage whenever ${damageCreatureType}s enter the battlefield. The deck includes multiple ${damageCreatureType} creatures`;
            if (examples.length > 0) {
              explanation += ` such as ${examples.join(', ')}`;
            }
            explanation += ` to pressure opponents and clear small threats. `;
          }
          break;
          
        case 'tribal_lord':
          const lordTribes = ability.keywords.filter(k => !['anthem', 'boost', '+1/+1', 'flying', 'haste', 'vigilance'].includes(k));
          if (lordTribes.length > 0) {
            const tribalCards = deck.filter(card => 
              lordTribes.some(tribe => 
                this.extractCreatureTypesFromText(card.oracle_text || '').includes(tribe) ||
                this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase()).includes(tribe)
              )
            );
            
            if (tribalCards.length >= 10) {
              const tribesText = lordTribes.length > 1 ? 
                `${lordTribes.slice(0, -1).join(', ')} and ${lordTribes.slice(-1)[0]}` : 
                lordTribes[0];
              synergies.push(`${tribesText} tribal lords`);
              explanation += `${commander.name} provides anthem effects for ${tribesText} creatures, making the entire tribal strategy more powerful. The deck features a strong ${tribesText} tribal base to maximize these bonuses. `;
            }
          }
          break;
          
        case 'creature_action_trigger':
          const actionType = ability.keywords[0];
          const action = ability.keywords[1];
          const actionCards = deck.filter(card => 
            this.extractCreatureTypesFromText(card.oracle_text || '').includes(actionType) ||
            this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase()).includes(actionType)
          );
          
          if (actionCards.length >= 8) {
            synergies.push(`${actionType} ${action} triggers`);
            explanation += `${commander.name} rewards ${actionType} creatures for ${action}, creating value from aggressive strategies and encouraging proactive play. `;
          }
          break;
          
        // Keep existing cases for backwards compatibility
        case 'etb':
          const etbCards = deck.filter(card => 
            (card.oracle_text || '').toLowerCase().includes('enters the battlefield') ||
            ((card.oracle_text || '').toLowerCase().includes('whenever') && (card.oracle_text || '').toLowerCase().includes('enters'))
          );
          
          if (etbCards.length >= 8) {
            synergies.push('ETB value engines');
            const etbExamples = etbCards.slice(0, 3).map(card => card.name);
            explanation += `${commander.name} leverages enter-the-battlefield effects to generate consistent value. The deck includes multiple ETB payoffs`;
            if (etbExamples.length > 0) {
              explanation += ` such as ${etbExamples.join(', ')}`;
            }
            explanation += ' to maximize each time creatures enter the battlefield. ';
          }
          break;
          
        case 'self_blink':
          const blinkCards = deck.filter(card => 
            (card.oracle_text || '').toLowerCase().includes('flicker') ||
            (card.oracle_text || '').toLowerCase().includes('blink') ||
            ((card.oracle_text || '').toLowerCase().includes('exile') && (card.oracle_text || '').toLowerCase().includes('return'))
          );
          
          synergies.push('blink synergies');
          explanation += `${commander.name} utilizes self-exile and return mechanics to repeatedly trigger enter-the-battlefield effects. `;
          if (blinkCards.length >= 4) {
            synergies.push('flicker effects');
            explanation += `Additional flicker effects enable even more ETB value. `;
          }
          break;
          
        case 'triggered':
          if (ability.keywords.includes('sacrifice')) {
            const sacrificeCards = deck.filter(card => 
              (card.oracle_text || '').toLowerCase().includes('sacrifice') &&
              ((card.oracle_text || '').toLowerCase().includes('draw') || (card.oracle_text || '').toLowerCase().includes('damage'))
            );
            
            if (sacrificeCards.length >= 6) {
              synergies.push('sacrifice value');
              explanation += `${commander.name}'s triggered abilities create sacrifice synergies that convert resources into card advantage or damage. `;
            }
          }
          
          if (ability.keywords.includes('token')) {
            const tokenCards = deck.filter(card => 
              (card.oracle_text || '').toLowerCase().includes('create') && (card.oracle_text || '').toLowerCase().includes('token')
            );
            
            if (tokenCards.length >= 8) {
              synergies.push('token generation');
              explanation += `The deck creates numerous tokens to fuel ${commander.name}'s triggered abilities and overwhelm opponents. `;
            }
          }
          break;
          
        case 'tribal':
          // Handle multiple tribes (e.g., Cat Elf Warrior gets all three)
          const tribalSynergies: string[] = [];
          for (const tribe of ability.keywords) {
            const tribalCards = deck.filter(card => 
              this.extractCreatureTypesFromTypeLine(card.type_line.toLowerCase()).includes(tribe) ||
              (card.oracle_text || '').toLowerCase().includes(tribe)
            );
            
            if (tribalCards.length >= 8) { // Lower threshold for multi-tribal
              tribalSynergies.push(`${tribe} tribal`);
            }
          }
          
          if (tribalSynergies.length > 0) {
            synergies.push(...tribalSynergies);
            const tribesText = ability.keywords.length > 1 ? 
              `${ability.keywords.slice(0, -1).join(', ')} and ${ability.keywords.slice(-1)[0]}` : 
              ability.keywords[0];
            explanation += `${commander.name} leads a ${tribesText} tribal strategy, with creatures and tribal support cards providing anthem effects and synergistic value across multiple creature types. `;
          }
          break;
          
        case 'static':
          if (ability.keywords.includes('creature')) {
            synergies.push('creature synergies');
            explanation += `${commander.name} provides static benefits to creatures, making the deck's creature base more threatening and resilient. `;
          }
          break;
          
        case 'activated':
          if (ability.keywords.includes('tap')) {
            const untapCards = deck.filter(card => 
              (card.oracle_text || '').toLowerCase().includes('untap')
            );
            
            if (untapCards.length >= 4) {
              synergies.push('tap/untap synergies');
              explanation += `The deck includes untap effects to repeatedly activate ${commander.name}'s powerful activated abilities. `;
            }
          }
          break;
      }
    }
    
    // If no specific synergies found, build generic explanation
    if (synergies.length === 0) {
      synergies.push('commander synergies');
      explanation = `${commander.name} provides unique capabilities that the deck is built to maximize. `;
    }
    
    // Add specific closing based on commander's primary ability and keywords
    const primaryAbility = abilities[0];
    if (primaryAbility && primaryAbility.keywords.length > 0) {
      const keywordContext = primaryAbility.keywords.slice(0, 2).join(' and ');
      switch (primaryAbility.type) {
        case 'creature_etb_draw':
        case 'creature_etb_counters':
        case 'creature_etb_damage':
          explanation += `This ${keywordContext} engine generates consistent advantage each turn, scaling with the number of relevant creatures deployed.`;
          break;
        case 'triggered':
          if (primaryAbility.keywords.some(k => k.includes('attack') || k.includes('combat'))) {
            explanation += `These combat-based triggers reward aggressive gameplay and create explosive attack phases.`;
          } else {
            explanation += `These triggered abilities create powerful chains of effects that build momentum throughout the game.`;
          }
          break;
        case 'tribal':
          explanation += `The ${keywordContext} tribal strategy creates exponential power growth as more synergistic creatures enter the battlefield.`;
          break;
        case 'static':
        case 'lord_effect':
          explanation += `These continuous effects provide persistent advantages that improve every aspect of the deck's performance.`;
          break;
        case 'activated':
          explanation += `The ability to repeatedly activate these effects provides significant flexibility and late-game inevitability.`;
          break;
        default:
          explanation += `This ${keywordContext}-focused strategy leverages the commander's unique capabilities for consistent performance.`;
      }
    } else if (primaryAbility) {
      explanation += `This strategy maximizes the commander's core strengths while maintaining tactical flexibility.`;
    }
    
    return { synergies, synergyExplanation: explanation.trim() };
  }

  private extractCreatureTypesFromTypeLine(typeLine: string): string[] {
    // Comprehensive list of all Magic creature types (324 total as of 2025)
    // Based on Scryfall API and Magic Comprehensive Rules 205.3m
    const allCreatureTypes = [
      'advisor', 'aetherborn', 'alien', 'ally', 'angel', 'antelope', 'ape', 'archer', 'archon', 'armadillo', 
      'army', 'artificer', 'assassin', 'assembly-worker', 'astartes', 'atog', 'aurochs', 'automaton', 'avatar', 'azra',
      'badger', 'balloon', 'barbarian', 'bard', 'basilisk', 'bat', 'bear', 'beast', 'beaver', 'beeble', 
      'beholder', 'berserker', 'bird', 'bison', 'blinkmoth', 'boar', 'brainiac', 'bringer', 'brushwagg',
      'camarid', 'camel', 'capybara', 'caribou', 'carrier', 'cat', 'centaur', 'chicken', 'child', 'chimera', 
      'citizen', 'cleric', 'clown', 'cockatrice', 'construct', 'coward', 'coyote', 'crab', 'crocodile', 'custodes', 
      'cyberman', 'cyclops', 'dalek', 'dauthi', 'demigod', 'demon', 'deserter', 'detective', 'devil', 'dinosaur', 
      'djinn', 'doctor', 'dog', 'dragon', 'drake', 'dreadnought', 'drix', 'drone', 'druid', 'dryad', 'dwarf',
      'echidna', 'efreet', 'egg', 'elder', 'eldrazi', 'elemental', 'elephant', 'elf', 'elk', 'employee', 'eye',
      'faerie', 'ferret', 'fish', 'flagbearer', 'fox', 'fractal', 'frog', 'fungus',
      'gamer', 'gargoyle', 'germ', 'giant', 'gith', 'glimmer', 'gnoll', 'gnome', 'goat', 'goblin', 'god', 'golem', 
      'gorgon', 'graveborn', 'gremlin', 'griffin', 'guest',
      'hag', 'halfling', 'hamster', 'harpy', 'head', 'hedgehog', 'hellion', 'hero', 'hippo', 'hippogriff', 
      'homarid', 'homunculus', 'hornet', 'horror', 'horse', 'human', 'hydra', 'hyena',
      'illusion', 'imp', 'incarnation', 'inkling', 'inquisitor', 'insect', 'jackal', 'jellyfish', 'juggernaut',
      'kavu', 'kirin', 'kithkin', 'knight', 'kobold', 'kor', 'kraken',
      'lamia', 'lammasu', 'leech', 'leviathan', 'lhurgoyf', 'licid', 'lizard', 'llama',
      'manticore', 'masticore', 'mercenary', 'merfolk', 'metathran', 'minion', 'minotaur', 'mite', 'mole', 'monger', 
      'mongoose', 'monk', 'monkey', 'moonfolk', 'mount', 'mouse', 'mutant', 'myr',
      'mystic', 'naga', 'nautilus', 'necron', 'nephilim', 'nightmare', 'nightstalker', 'ninja', 'noble', 'noggle', 
      'nomad', 'nymph', 'octopus', 'ogre', 'ooze', 'orb', 'orc', 'orgg', 'otter', 'ouphe', 'ox',
      'oyster', 'pangolin', 'peasant', 'pegasus', 'pentavite', 'performer', 'pest', 'phelddagrif', 'phoenix', 
      'phyrexian', 'pilot', 'pincher', 'pirate', 'plant', 'praetor', 'primarch', 'prism', 'processor', 'rabbit',
      'raccoon', 'ranger', 'rat', 'rebel', 'reflection', 'rhino', 'rigger', 'robot', 'rogue', 'sable', 'salamander', 
      'samurai', 'sand', 'saproling', 'satyr', 'scarecrow', 'scion', 'scorpion', 'scout', 'sculpture', 'serf',
      'serpent', 'servo', 'shade', 'shaman', 'shapeshifter', 'shark', 'sheep', 'siren', 'skeleton', 'slith', 
      'sliver', 'slug', 'snake', 'soldier', 'soltari', 'spawn', 'specter', 'spellshaper', 'sphinx', 'spider',
      'spike', 'spirit', 'splinter', 'sponge', 'squid', 'squirrel', 'starfish', 'surrakar', 'survivor',
      'tentacle', 'tetravite', 'thalakos', 'thopter', 'thrull', 'treefolk', 'trilobite', 'triskelavite', 'troll', 
      'turtle', 'tyranid', 'unicorn', 'vampire', 'vedalken', 'viashino', 'volver', 'wall', 'walrus', 'warlock', 
      'warrior', 'weird', 'werewolf', 'whale', 'wizard', 'wolf', 'wolverine', 'wombat', 'worm', 'wraith', 'wurm',
      'yeti', 'zombie', 'zubera'
    ];

    const lowerTypeLine = typeLine.toLowerCase();
    const foundTypes: string[] = [];

    // Handle special multi-word types
    if (lowerTypeLine.includes('time lord')) {
      foundTypes.push('time lord');
    }

    // Extract all single-word creature types from the type line
    for (const creatureType of allCreatureTypes) {
      if (lowerTypeLine.includes(creatureType)) {
        // Make sure it's a whole word match, not part of another word
        const regex = new RegExp(`\\b${creatureType}\\b`, 'i');
        if (regex.test(lowerTypeLine)) {
          foundTypes.push(creatureType);
        }
      }
    }

    return foundTypes;
  }

  private parseComplexAbilities(text: string): Array<{type: string, keywords: string[], priority: number, context?: string}> {
    const abilities: Array<{type: string, keywords: string[], priority: number, context?: string}> = [];
    
    // Pattern: "Whenever a [CREATURE_TYPE] enters the battlefield, [EFFECT]"
    const creatureETBPattern = /whenever (?:a|an) (\w+) (?:enters the battlefield|enters), ([^.]+)/gi;
    let match;
    
    while ((match = creatureETBPattern.exec(text)) !== null) {
      const creatureType = match[1].toLowerCase();
      const effect = match[2].toLowerCase();
      
      // Determine effect type and build keywords
      const keywords = [creatureType];
      let abilityType = 'creature_etb';
      let priority = 15;
      
      if (effect.includes('draw') && effect.includes('card')) {
        keywords.push('draw', 'card', 'advantage');
        abilityType = 'creature_etb_draw';
        priority = 16; // Higher priority for card draw engines
      } else if (effect.includes('+1/+1') && effect.includes('counter')) {
        keywords.push('+1/+1', 'counter', 'growth');
        abilityType = 'creature_etb_counters';
        priority = 15;
      } else if (effect.includes('damage')) {
        keywords.push('damage', 'burn');
        abilityType = 'creature_etb_damage';
        priority = 14;
      } else if (effect.includes('create') && effect.includes('token')) {
        keywords.push('create', 'token');
        abilityType = 'creature_etb_token';
        priority = 14;
      } else if (effect.includes('gain') && effect.includes('life')) {
        keywords.push('gain', 'life');
        abilityType = 'creature_etb_lifegain';
        priority = 12;
      }
      
      abilities.push({
        type: abilityType,
        keywords,
        priority,
        context: `${creatureType}_triggers_${effect.split(' ').slice(0, 3).join('_')}`
      });
    }
    
    // Pattern: "[CREATURE_TYPES] you control get/have [EFFECT]"  
    const lordPattern = /([\w\s]+) you control (?:get|have) ([^.]+)/gi;
    while ((match = lordPattern.exec(text)) !== null) {
      const creatureTypes = match[1].toLowerCase();
      const effect = match[2].toLowerCase();
      
      // Extract creature types from the lord effect
      const typesInEffect = this.extractCreatureTypesFromText(creatureTypes);
      if (typesInEffect.length > 0) {
        const keywords = [...typesInEffect];
        
        if (effect.includes('+1/+1')) {
          keywords.push('+1/+1', 'anthem', 'boost');
        }
        if (effect.includes('flying')) keywords.push('flying');
        if (effect.includes('haste')) keywords.push('haste');
        if (effect.includes('vigilance')) keywords.push('vigilance');
        
        abilities.push({
          type: 'tribal_lord',
          keywords,
          priority: 13,
          context: `lord_effect_for_${typesInEffect.join('_and_')}`
        });
      }
    }
    
    // Pattern: "Whenever [CREATURE_TYPE] you control [ACTION], [EFFECT]"
    const creatureActionPattern = /whenever (\w+) you control (attacks?|dies?|deals? damage|becomes? tapped), ([^.]+)/gi;
    while ((match = creatureActionPattern.exec(text)) !== null) {
      const creatureType = match[1].toLowerCase();
      const action = match[2].toLowerCase();
      const effect = match[3].toLowerCase();
      
      const keywords = [creatureType, action];
      if (effect.includes('draw')) keywords.push('draw', 'card');
      if (effect.includes('+1/+1')) keywords.push('+1/+1', 'counter');
      if (effect.includes('damage')) keywords.push('damage');
      
      abilities.push({
        type: 'creature_action_trigger',
        keywords,
        priority: 13,
        context: `${creatureType}_${action}_triggers_${effect.split(' ').slice(0, 2).join('_')}`
      });
    }
    
    return abilities;
  }

  private getCreatureTypePlural(type: string): string {
    // Handle common irregular plurals for creature types
    const irregularPlurals: Record<string, string> = {
      'elf': 'elves',
      'wolf': 'wolves', 
      'dwarf': 'dwarves',
      'ox': 'oxen',
      'mouse': 'mice',
      'goose': 'geese',
      'foot': 'feet', // for things like "rabbit foot"
      'man': 'men', // for "human" -> but we use 'human' directly
      'woman': 'women',
      'child': 'children',
      'sheep': 'sheep', // same singular/plural
      'deer': 'deer',
      'fish': 'fish',
      'moose': 'moose'
    };
    
    if (irregularPlurals[type]) {
      return irregularPlurals[type];
    }
    
    // Handle regular plurals
    if (type.endsWith('y')) {
      return type.slice(0, -1) + 'ies'; // fairy -> fairies
    } else if (type.endsWith('s') || type.endsWith('sh') || type.endsWith('ch') || type.endsWith('x') || type.endsWith('z')) {
      return type + 'es'; // fox -> foxes, witch -> witches
    } else {
      return type + 's'; // most regular plurals
    }
  }

  private extractCreatureTypesFromText(text: string): string[] {
    const foundTypes: string[] = [];
    const lowerText = text.toLowerCase();
    
    // Use the comprehensive creature type list
    const allCreatureTypes = [
      'advisor', 'aetherborn', 'alien', 'ally', 'angel', 'antelope', 'ape', 'archer', 'archon', 'armadillo', 
      'army', 'artificer', 'assassin', 'assembly-worker', 'astartes', 'atog', 'aurochs', 'automaton', 'avatar', 'azra',
      'badger', 'balloon', 'barbarian', 'bard', 'basilisk', 'bat', 'bear', 'beast', 'beaver', 'beeble', 
      'beholder', 'berserker', 'bird', 'bison', 'blinkmoth', 'boar', 'brainiac', 'bringer', 'brushwagg',
      'camarid', 'camel', 'capybara', 'caribou', 'carrier', 'cat', 'centaur', 'chicken', 'child', 'chimera', 
      'citizen', 'cleric', 'clown', 'cockatrice', 'construct', 'coward', 'coyote', 'crab', 'crocodile', 'custodes', 
      'cyberman', 'cyclops', 'dalek', 'dauthi', 'demigod', 'demon', 'deserter', 'detective', 'devil', 'dinosaur', 
      'djinn', 'doctor', 'dog', 'dragon', 'drake', 'dreadnought', 'drix', 'drone', 'druid', 'dryad', 'dwarf',
      'echidna', 'efreet', 'egg', 'elder', 'eldrazi', 'elemental', 'elephant', 'elf', 'elk', 'employee', 'eye',
      'faerie', 'ferret', 'fish', 'flagbearer', 'fox', 'fractal', 'frog', 'fungus',
      'gamer', 'gargoyle', 'germ', 'giant', 'gith', 'glimmer', 'gnoll', 'gnome', 'goat', 'goblin', 'god', 'golem', 
      'gorgon', 'graveborn', 'gremlin', 'griffin', 'guest',
      'hag', 'halfling', 'hamster', 'harpy', 'head', 'hedgehog', 'hellion', 'hero', 'hippo', 'hippogriff', 
      'homarid', 'homunculus', 'hornet', 'horror', 'horse', 'human', 'hydra', 'hyena',
      'illusion', 'imp', 'incarnation', 'inkling', 'inquisitor', 'insect', 'jackal', 'jellyfish', 'juggernaut',
      'kavu', 'kirin', 'kithkin', 'knight', 'kobold', 'kor', 'kraken',
      'lamia', 'lammasu', 'leech', 'leviathan', 'lhurgoyf', 'licid', 'lizard', 'llama',
      'manticore', 'masticore', 'mercenary', 'merfolk', 'metathran', 'minion', 'minotaur', 'mite', 'mole', 'monger', 
      'mongoose', 'monk', 'monkey', 'moonfolk', 'mount', 'mouse', 'mutant', 'myr',
      'mystic', 'naga', 'nautilus', 'necron', 'nephilim', 'nightmare', 'nightstalker', 'ninja', 'noble', 'noggle', 
      'nomad', 'nymph', 'octopus', 'ogre', 'ooze', 'orb', 'orc', 'orgg', 'otter', 'ouphe', 'ox',
      'oyster', 'pangolin', 'peasant', 'pegasus', 'pentavite', 'performer', 'pest', 'phelddagrif', 'phoenix', 
      'phyrexian', 'pilot', 'pincher', 'pirate', 'plant', 'praetor', 'primarch', 'prism', 'processor', 'rabbit',
      'raccoon', 'ranger', 'rat', 'rebel', 'reflection', 'rhino', 'rigger', 'robot', 'rogue', 'sable', 'salamander', 
      'samurai', 'sand', 'saproling', 'satyr', 'scarecrow', 'scion', 'scorpion', 'scout', 'sculpture', 'serf',
      'serpent', 'servo', 'shade', 'shaman', 'shapeshifter', 'shark', 'sheep', 'siren', 'skeleton', 'slith', 
      'sliver', 'slug', 'snake', 'soldier', 'soltari', 'spawn', 'specter', 'spellshaper', 'sphinx', 'spider',
      'spike', 'spirit', 'splinter', 'sponge', 'squid', 'squirrel', 'starfish', 'surrakar', 'survivor',
      'tentacle', 'tetravite', 'thalakos', 'thopter', 'thrull', 'treefolk', 'trilobite', 'triskelavite', 'troll', 
      'turtle', 'tyranid', 'unicorn', 'vampire', 'vedalken', 'viashino', 'volver', 'wall', 'walrus', 'warlock', 
      'warrior', 'weird', 'werewolf', 'whale', 'wizard', 'wolf', 'wolverine', 'wombat', 'worm', 'wraith', 'wurm',
      'yeti', 'zombie', 'zubera'
    ];
    
    // Handle special multi-word types
    if (lowerText.includes('time lord')) {
      foundTypes.push('time lord');
    }
    
    // Extract creature types mentioned in text
    for (const creatureType of allCreatureTypes) {
      // Look for the creature type as a standalone word or with common pluralization
      const patterns = [
        new RegExp(`\\b${creatureType}\\b`, 'i'),
        new RegExp(`\\b${creatureType}s\\b`, 'i'), // Plural form
      ];
      
      for (const pattern of patterns) {
        if (pattern.test(lowerText)) {
          foundTypes.push(creatureType);
          break; // Don't add duplicates
        }
      }
    }
    
    return Array.from(new Set(foundTypes)); // Remove duplicates
  }

  private parseTriggeredAbilities(text: string): Array<{type: string, keywords: string[], priority: number, context?: string}> {
    const abilities: Array<{type: string, keywords: string[], priority: number, context?: string}> = [];
    
    // More sophisticated triggered ability parsing
    const triggerPatterns = [
      /whenever ([^,]+), ([^.]+)/gi,
      /at the beginning of ([^,]+), ([^.]+)/gi,
      /when ([^,]+), ([^.]+)/gi
    ];
    
    for (const pattern of triggerPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const trigger = match[1].toLowerCase();
        const effect = match[2].toLowerCase();
        
        const keywords = this.extractKeywordsFromText(trigger + ' ' + effect);
        const creatureTypes = this.extractCreatureTypesFromText(trigger);
        keywords.push(...creatureTypes);
        
        // Classify trigger type
        let triggerType = 'triggered';
        let priority = 12;
        
        if (trigger.includes('enters the battlefield') || trigger.includes('enters')) {
          triggerType = 'etb_trigger';
          priority = 14;
        } else if (trigger.includes('attacks') || trigger.includes('attack')) {
          triggerType = 'attack_trigger';
          priority = 13;
        } else if (trigger.includes('dies') || trigger.includes('die')) {
          triggerType = 'death_trigger';
          priority = 13;
        } else if (trigger.includes('upkeep') || trigger.includes('end step')) {
          triggerType = 'step_trigger';
          priority = 11;
        }
        
        abilities.push({
          type: triggerType,
          keywords,
          priority,
          context: `${trigger.replace(/\s+/g, '_')}_causes_${effect.split(' ').slice(0, 3).join('_')}`
        });
      }
    }
    
    return abilities;
  }

  private parseActivatedAbilities(text: string): Array<{type: string, keywords: string[], priority: number, context?: string}> {
    const abilities: Array<{type: string, keywords: string[], priority: number, context?: string}> = [];
    
    // Pattern: [COST]: [EFFECT]
    const activatedPattern = /([^:]+): ([^.]+)/gi;
    let match;
    
    while ((match = activatedPattern.exec(text)) !== null) {
      const cost = match[1].toLowerCase();
      const effect = match[2].toLowerCase();
      
      const keywords = this.extractKeywordsFromText(cost + ' ' + effect);
      const creatureTypes = this.extractCreatureTypesFromText(effect);
      keywords.push(...creatureTypes);
      
      abilities.push({
        type: 'activated',
        keywords,
        priority: 10,
        context: `${cost.replace(/\s+/g, '_')}_for_${effect.split(' ').slice(0, 3).join('_')}`
      });
    }
    
    return abilities;
  }

  private parseStaticAbilities(text: string): Array<{type: string, keywords: string[], priority: number, context?: string}> {
    const abilities: Array<{type: string, keywords: string[], priority: number, context?: string}> = [];
    
    // Pattern: "Other [CREATURES] you control get/have [EFFECT]"
    const lordPattern = /(other )?([^you]+) you control (?:get|have) ([^.]+)/gi;
    let match;
    
    while ((match = lordPattern.exec(text)) !== null) {
      const isLord = !!match[1]; // "other" indicates lord effect
      const creatures = match[2].toLowerCase();
      const effect = match[3].toLowerCase();
      
      const keywords = this.extractKeywordsFromText(creatures + ' ' + effect);
      const creatureTypes = this.extractCreatureTypesFromText(creatures);
      keywords.push(...creatureTypes);
      
      abilities.push({
        type: isLord ? 'lord_effect' : 'static_boost',
        keywords,
        priority: isLord ? 13 : 11,
        context: `${creatures.replace(/\s+/g, '_')}_get_${effect.replace(/\s+/g, '_')}`
      });
    }
    
    // Pattern: "All [CREATURES] have [ABILITY]"
    const globalPattern = /all ([^have]+) have ([^.]+)/gi;
    while ((match = globalPattern.exec(text)) !== null) {
      const creatures = match[1].toLowerCase();
      const ability = match[2].toLowerCase();
      
      const keywords = this.extractKeywordsFromText(creatures + ' ' + ability);
      const creatureTypes = this.extractCreatureTypesFromText(creatures);
      keywords.push(...creatureTypes);
      
      abilities.push({
        type: 'global_effect',
        keywords,
        priority: 12,
        context: `all_${creatures.replace(/\s+/g, '_')}_have_${ability.replace(/\s+/g, '_')}`
      });
    }
    
    return abilities;
  }

  private buildKeywordFocusQueries(keyword: string): Array<{query: string, priority: number}> {
    const queries: Array<{query: string, priority: number}> = [];
    
    switch (keyword) {
      case 'tokens':
        queries.push(
          { query: 'o:"create" o:"token"', priority: 12 },
          { query: 'o:"token" o:"creature"', priority: 11 },
          { query: 'o:"populate" OR o:"convoke"', priority: 10 }
        );
        break;
        
      case 'counters':
        queries.push(
          { query: 'o:"+1/+1"', priority: 12 },
          { query: 'o:"counter" o:"put"', priority: 11 },
          { query: 'o:"proliferate" OR o:"modular"', priority: 10 }
        );
        break;
        
      case 'tribal':
        queries.push(
          { query: 'o:"lord" OR o:"tribal"', priority: 12 },
          { query: 'o:"creature type" OR o:"choose a creature type"', priority: 11 },
          { query: 'o:"creatures you control get" OR o:"all creatures"', priority: 10 }
        );
        break;
        
      case 'artifacts':
        queries.push(
          // Reduced priority - artifacts support other strategies, don't dominate
          { query: 't:artifact', priority: 8 },
          { query: 'o:"artifact" o:"enters"', priority: 7 },
          { query: 'o:"metalcraft" OR o:"improvise" OR o:"affinity"', priority: 7 },
          { query: 'o:"artifacts you control"', priority: 6 }
        );
        break;
        
      case 'enchantments':
        queries.push(
          { query: 't:enchantment', priority: 12 },
          { query: 'o:"enchantment" o:"enters"', priority: 11 },
          { query: 'o:"constellation" OR o:"enchantment creatures"', priority: 10 }
        );
        break;
        
      case 'graveyard':
        queries.push(
          { query: 'o:"graveyard" o:"return"', priority: 12 },
          { query: 'o:"mill" OR o:"self-mill"', priority: 11 },
          { query: 'o:"flashback" OR o:"unearth" OR o:"dredge"', priority: 11 },
          { query: 'o:"dies" o:"graveyard"', priority: 10 }
        );
        break;
        
      case 'sacrifice':
        queries.push(
          { query: 'o:"sacrifice" o:"target"', priority: 12 },
          { query: 'o:"dies" o:"when"', priority: 11 },
          { query: 'o:"death" OR o:"sacrificed"', priority: 10 }
        );
        break;
        
      case 'etb':
      case 'enters':
        queries.push(
          { query: 'o:"enters the battlefield"', priority: 12 },
          { query: 'o:"when" o:"enters"', priority: 11 },
          { query: 'o:"whenever" o:"creature enters"', priority: 10 }
        );
        break;
        
      case 'blink':
      case 'flicker':
        queries.push(
          { query: 'o:"exile" o:"return" o:"battlefield"', priority: 12 },
          { query: 'o:"flicker" OR o:"blink"', priority: 11 },
          { query: 'o:"leaves the battlefield"', priority: 10 }
        );
        break;
        
      case 'voltron':
      case 'equipment':
        queries.push(
          { query: 't:equipment', priority: 12 },
          { query: 'o:"attach" OR o:"equipped"', priority: 11 },
          { query: 'o:"aura" t:enchantment', priority: 11 },
          { query: 'o:"target creature" o:"gets" o:"until end of turn"', priority: 10 }
        );
        break;
        
      case 'infect':
        queries.push(
          { query: 'o:"infect"', priority: 12 },
          { query: 'o:"poison"', priority: 11 },
          { query: 'o:"-1/-1" o:"counter"', priority: 10 }
        );
        break;
        
      case 'mill':
        queries.push(
          { query: 'o:"mill"', priority: 12 },
          { query: 'o:"library" o:"graveyard"', priority: 11 },
          { query: 'o:"top" o:"library" o:"put"', priority: 10 }
        );
        break;
        
      case 'landfall':
        queries.push(
          { query: 'o:"landfall"', priority: 12 },
          { query: 'o:"land enters"', priority: 11 },
          { query: 'o:"lands you control" OR o:"basic land"', priority: 10 }
        );
        break;
        
      case 'spellslinger':
        queries.push(
          { query: 'o:"instant" o:"sorcery"', priority: 12 },
          { query: 'o:"cast" o:"spell"', priority: 11 },
          { query: 'o:"prowess" OR o:"magecraft"', priority: 11 },
          { query: 'o:"copy" o:"target"', priority: 10 }
        );
        break;
        
      case 'aristocrats':
        queries.push(
          { query: 'o:"sacrifice" o:"creature"', priority: 12 },
          { query: 'o:"dies" o:"whenever"', priority: 11 },
          { query: 'o:"creature token" o:"create"', priority: 10 }
        );
        break;
        
      case 'combo':
        queries.push(
          { query: 'o:"infinite" OR o:"copy"', priority: 12 },
          { query: 'o:"untap" OR o:"extra turn"', priority: 11 },
          { query: 'o:"tutor" OR o:"search"', priority: 10 }
        );
        break;
        
      case 'control':
        queries.push(
          { query: 'o:"counter" t:instant', priority: 12 },
          { query: 'o:"destroy" o:"target"', priority: 11 },
          { query: 'o:"draw" o:"card"', priority: 10 }
        );
        break;
        
      case 'aggro':
      case 'aggressive':
        queries.push(
          { query: 'o:"haste" OR o:"trample"', priority: 12 },
          { query: 'o:"attack" o:"damage"', priority: 11 },
          { query: 't:creature cmc<=3', priority: 10 }
        );
        break;
        
      default:
        // Generic keyword matching for custom keywords
        queries.push(
          { query: `o:"${keyword}"`, priority: 10 },
          { query: `t:${keyword}`, priority: 9 }
        );
        break;
    }
    
    return queries;
  }

  private calculateKeywordFocusBonus(card: DeckCard, keywordFocus: string[]): number {
    let bonus = 0;
    const cardText = (card.oracle_text || '').toLowerCase();
    const cardType = card.type_line.toLowerCase();
    const cardName = card.name.toLowerCase();
    
    for (const keyword of keywordFocus) {
      const keywordLower = keyword.toLowerCase();
      
      switch (keywordLower) {
        case 'tokens':
          if (cardText.includes('token') || cardText.includes('create')) {
            bonus += 8;
          }
          break;
          
        case 'counters':
          if (cardText.includes('+1/+1') || cardText.includes('counter')) {
            bonus += 8;
          }
          break;
          
        case 'tribal':
          if (cardText.includes('lord') || cardText.includes('tribal') || 
              cardText.includes('creatures you control') || cardText.includes('choose a creature type')) {
            bonus += 8;
          }
          break;
          
        case 'artifacts':
          if (cardType.includes('artifact') || cardText.includes('artifact')) {
            bonus += 8;
          }
          break;
          
        case 'enchantments':
          if (cardType.includes('enchantment') || cardText.includes('enchantment')) {
            bonus += 8;
          }
          break;
          
        case 'graveyard':
          if (cardText.includes('graveyard') || cardText.includes('mill') || 
              cardText.includes('flashback') || cardText.includes('unearth')) {
            bonus += 8;
          }
          break;
          
        case 'sacrifice':
          if (cardText.includes('sacrifice') || cardText.includes('dies')) {
            bonus += 8;
          }
          break;
          
        case 'etb':
        case 'enters':
          if (cardText.includes('enters the battlefield') || cardText.includes('when') && cardText.includes('enters')) {
            bonus += 8;
          }
          break;
          
        case 'blink':
        case 'flicker':
          if (cardText.includes('exile') && cardText.includes('return') || 
              cardText.includes('flicker') || cardText.includes('blink')) {
            bonus += 8;
          }
          break;
          
        case 'voltron':
        case 'equipment':
          if (cardType.includes('equipment') || cardText.includes('attach') || 
              cardText.includes('equipped') || (cardType.includes('enchantment') && cardText.includes('enchant creature'))) {
            bonus += 8;
          }
          break;
          
        case 'infect':
          if (cardText.includes('infect') || cardText.includes('poison')) {
            bonus += 8;
          }
          break;
          
        case 'mill':
          if (cardText.includes('mill') || (cardText.includes('library') && cardText.includes('graveyard'))) {
            bonus += 8;
          }
          break;
          
        case 'landfall':
          if (cardText.includes('landfall') || cardText.includes('land enters')) {
            bonus += 8;
          }
          break;
          
        case 'spellslinger':
          if (cardText.includes('instant') && cardText.includes('sorcery') || 
              cardText.includes('prowess') || cardText.includes('magecraft') ||
              cardText.includes('cast') && cardText.includes('spell')) {
            bonus += 8;
          }
          break;
          
        case 'aristocrats':
          if ((cardText.includes('sacrifice') && cardText.includes('creature')) ||
              (cardText.includes('dies') && cardText.includes('whenever')) ||
              (cardText.includes('creature token') && cardText.includes('create'))) {
            bonus += 8;
          }
          break;
          
        case 'combo':
          if (cardText.includes('infinite') || cardText.includes('copy') ||
              cardText.includes('untap') || cardText.includes('tutor')) {
            bonus += 8;
          }
          break;
          
        case 'control':
          if ((cardType.includes('instant') && cardText.includes('counter')) ||
              cardText.includes('destroy target') || cardText.includes('draw card')) {
            bonus += 8;
          }
          break;
          
        case 'aggro':
        case 'aggressive':
          if (cardText.includes('haste') || cardText.includes('trample') ||
              cardText.includes('attack') || (cardType.includes('creature') && card.cmc <= 3)) {
            bonus += 8;
          }
          break;
          
        default:
          // Generic keyword matching
          if (cardText.includes(keywordLower) || cardType.includes(keywordLower) || cardName.includes(keywordLower)) {
            bonus += 5;
          }
          break;
      }
    }
    
    // Additional bonus for creature-based solutions over artifacts (unless specifically artifact-focused)
    const isArtifactFocused = keywordFocus.some(k => k.toLowerCase().includes('artifact') || k.toLowerCase().includes('equipment'));
    if (!isArtifactFocused && cardType.includes('creature')) {
      bonus += 3; // Prefer creatures over artifacts when not specifically asking for artifacts
    }
    
    return Math.min(bonus, 20); // Cap keyword focus bonus
  }

  /**
   * Check if a card should be included based on filtering rules
   */
  private shouldIncludeCard(card: ScryfallCard | DeckCard, constraints: GenerationConstraints): boolean {
    // Exclude Un-sets (joke sets like Unfinity, Unglued, Unstable, etc.)
    const setCode = ('set' in card) ? card.set : card.set_code;
    const unSets = ['ust', 'ugl', 'unh', 'unf', 'und']; // Unstable, Unglued, Unhinged, Unfinity, Underdark (not a joke set, but sometimes unwanted)
    if (setCode && unSets.includes(setCode.toLowerCase())) {
      console.log(`Excluding ${card.name} from Un-set: ${setCode}`);
      return false;
    }
    
    // Apply card type weighting
    const shouldInclude = this.shouldIncludeCardByType(card, constraints);
    
    // Debug logging for artifacts when they should be excluded
    if (!shouldInclude && card.type_line.toLowerCase().includes('artifact')) {
      console.log(`🚫 EXCLUDING ARTIFACT: ${card.name} (type: ${card.type_line}) due to card type filtering`);
    } else if (shouldInclude && card.type_line.toLowerCase().includes('artifact')) {
      console.log(`✅ ALLOWING ARTIFACT: ${card.name} (type: ${card.type_line})`);
    }
    
    return shouldInclude;
  }

  /**
   * Check if a card should be included based on type weighting (excludes cards with weight 0)
   */
  private shouldIncludeCardByType(card: ScryfallCard | DeckCard, constraints: GenerationConstraints): boolean {
    if (!constraints.card_type_weights) return true;
    
    const cardType = card.type_line.toLowerCase();
    const weights = constraints.card_type_weights;
    
    // Exclude cards with weight 0 (user completely disabled this type)
    if (cardType.includes('artifact') && !cardType.includes('creature') && weights.artifacts === 0) {
      return false;
    }
    if (cardType.includes('creature') && weights.creatures === 0) {
      return false;
    }
    if (cardType.includes('enchantment') && !cardType.includes('creature') && weights.enchantments === 0) {
      return false;
    }
    if (cardType.includes('instant') && weights.instants === 0) {
      return false;
    }
    if (cardType.includes('sorcery') && weights.sorceries === 0) {
      return false;
    }
    if (cardType.includes('planeswalker') && weights.planeswalkers === 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate comprehensive card score using multi-dimensional weighting system
   */
  private calculateAdvancedCardScore(
    card: DeckCard, 
    commander: ScryfallCard,
    constraints: GenerationConstraints,
    allCards: DeckCard[]
  ): number {
    let totalScore = 0;
    const weights = constraints.card_type_weights;
    
    if (!weights) return 0;

    // 1. CARD TYPE SCORING (0-50 points possible)
    totalScore += this.calculateCardTypeScore(card, weights);
    
    // 2. FUNCTIONAL ROLE SCORING (0-100 points possible) 
    totalScore += this.calculateFunctionalScore(card, commander, allCards);
    
    // 3. SYNERGY SCORING (0-100 points possible)
    totalScore += this.calculateSynergyScore(card, commander, allCards);
    
    // 4. MANA CURVE SCORING (0-30 points possible)
    totalScore += this.calculateManaCurveScore(card, constraints);
    
    // 5. POWER LEVEL APPROPRIATENESS (0-20 points possible)
    totalScore += this.calculatePowerLevelScore(card, constraints.power_level);
    
    return totalScore;
  }

  private calculateCardTypeScore(card: DeckCard, weights: CardTypeWeights): number {
    const cardType = card.type_line.toLowerCase();
    let typeScore = 0;
    
    // Convert 0-10 slider to -25 to +25 point range for strong influence
    const convertWeight = (weight: number) => {
      if (weight === 0) return -50; // Strong exclusion
      return (weight - 5) * 5; // -25 to +25 range
    };
    
    if (cardType.includes('creature')) {
      typeScore += convertWeight(weights.creatures);
    }
    if (cardType.includes('artifact') && !cardType.includes('creature')) {
      typeScore += convertWeight(weights.artifacts);
    }
    if (cardType.includes('enchantment') && !cardType.includes('creature')) {
      typeScore += convertWeight(weights.enchantments);
    }
    if (cardType.includes('instant')) {
      typeScore += convertWeight(weights.instants);
    }
    if (cardType.includes('sorcery')) {
      typeScore += convertWeight(weights.sorceries);
    }
    if (cardType.includes('planeswalker')) {
      typeScore += convertWeight(weights.planeswalkers);
    }
    
    return Math.max(typeScore, -50); // Cap minimum penalty
  }

  private calculateFunctionalScore(card: DeckCard, commander: ScryfallCard, allCards: DeckCard[]): number {
    let functionalScore = 0;
    const cardText = (card.oracle_text || '').toLowerCase();
    
    // Identify card functions and apply EDH-appropriate scoring
    
    // Win Conditions (high value in EDH)
    if (this.isWinCondition(card)) {
      functionalScore += 40;
    }
    
    // Ramp (essential in EDH)
    if (this.isRampCard(card)) {
      functionalScore += 35;
    }
    
    // Card Draw (essential in EDH)  
    if (this.isCardDrawCard(card)) {
      functionalScore += 35;
    }
    
    // Removal (necessary interaction)
    if (this.isRemovalCard(card)) {
      functionalScore += 30;
    }
    
    // Board Wipes (important in multiplayer)
    if (this.isBoardWipeCard(card)) {
      functionalScore += 25;
    }
    
    // Protection (valuable but situational)
    if (this.isProtectionCard(card)) {
      functionalScore += 20;
    }
    
    // Tutors (powerful but varies by power level)
    if (this.isTutorCard(card)) {
      functionalScore += 15;
    }
    
    return functionalScore;
  }

  private calculateSynergyScore(card: DeckCard, commander: ScryfallCard, allCards: DeckCard[]): number {
    // Use existing synergy calculation but with adjusted weights
    return this.calculateBidirectionalSynergy(card, commander, 
      this.analyzeCardAbilities(card), 
      this.analyzeCommanderAbilities(commander)
    ) + this.calculateMultiCardInteractions(card, allCards) * 0.5;
  }

  private calculateManaCurveScore(card: DeckCard, constraints: GenerationConstraints): number {
    const cmc = card.cmc;
    let curveScore = 0;
    
    // Default curve preferences (can be made configurable later)
    const lowCMCPref = 6;   // Slight preference for 1-3 CMC
    const midCMCPref = 5;   // Neutral for 4-6 CMC
    const highCMCPref = 4;  // Slight penalty for 7+ CMC
    
    if (cmc <= 3) {
      curveScore += (lowCMCPref - 5) * 3;
    } else if (cmc <= 6) {
      curveScore += (midCMCPref - 5) * 3;
    } else {
      curveScore += (highCMCPref - 5) * 3;
    }
    
    return curveScore;
  }

  private calculatePowerLevelScore(card: DeckCard, powerLevel: number): number {
    const cardText = (card.oracle_text || '').toLowerCase();
    let powerScore = 0;
    
    // High-powered cards get bonus at higher power levels
    const isPowerfulCard = cardText.includes('infinite') || 
                          cardText.includes('extra turn') ||
                          cardText.includes('tutor') ||
                          (card.prices?.usd && parseFloat(card.prices.usd) > 20);
    
    if (isPowerfulCard) {
      powerScore += (powerLevel - 5) * 2; // More powerful cards better at higher power levels
    }
    
    return powerScore;
  }

  // Helper methods for functional identification
  private isWinCondition(card: DeckCard): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    return text.includes('win the game') || 
           text.includes('wins the game') ||
           text.includes('lose the game') ||
           text.includes('loses the game') ||
           (text.includes('damage') && text.includes('each opponent')) ||
           text.includes('infinite');
  }

  private isRampCard(card: DeckCard): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    return text.includes('add') && text.includes('mana') ||
           text.includes('search your library for') && text.includes('land') ||
           text.includes('mana cost') && text.includes('less') ||
           card.type_line.toLowerCase().includes('artifact') && text.includes('add');
  }

  private isCardDrawCard(card: DeckCard): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    return text.includes('draw') && text.includes('card') ||
           text.includes('draw a card') ||
           text.includes('draw two cards') ||
           text.includes('draw three cards');
  }

  private isRemovalCard(card: DeckCard): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    return text.includes('destroy target') ||
           text.includes('exile target') ||
           text.includes('counter target') ||
           text.includes('return target') && text.includes('hand');
  }

  private isBoardWipeCard(card: DeckCard): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    return text.includes('destroy all') ||
           text.includes('exile all') ||
           text.includes('all creatures') && (text.includes('destroy') || text.includes('exile'));
  }

  private isProtectionCard(card: DeckCard): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    return text.includes('hexproof') ||
           text.includes('shroud') ||
           text.includes('indestructible') ||
           text.includes('protection from') ||
           text.includes('counter target spell');
  }

  private isTutorCard(card: DeckCard): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    return text.includes('search your library') && !text.includes('land') ||
           text.includes('tutor');
  }

  private identifyCommanderStrategy(commander: ScryfallCard, abilities: Array<{type: string, keywords: string[], priority: number}>): string {
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderTypes = commander.type_line.toLowerCase();
    
    // Analyze commander's abilities to determine primary strategy
    // Enhanced tribal detection - look for creature type buffs and synergies
    const creatureTypesInText = this.extractCreatureTypesFromText(commanderText);
    console.log(`Tribal analysis for ${commander.name}: found creature types: [${creatureTypesInText.join(', ')}]`);
    
    const hasTribalAbilities = abilities.some(ability => ability.type === 'tribal') ||
                              abilities.some(ability => ability.type === 'lord_effect') ||
                              (commanderText.includes('creatures you control') && commanderText.includes('get +')) ||
                              (commanderText.includes('lord') || commanderText.includes('tribal')) ||
                              // Look for specific creature type buffs (handle both singular and plural)
                              creatureTypesInText.some(type => {
                                const plural = this.getCreatureTypePlural(type);
                                const hasTypeBonus = 
                                  // Plural forms: "elves get +", "wolves have trample"
                                  commanderText.includes(`${plural} get +`) ||
                                  commanderText.includes(`${plural} you control get +`) ||
                                  commanderText.includes(`${plural} have `) ||
                                  commanderText.includes(`${plural} you control have `) ||
                                  commanderText.includes(`${plural} creatures`) ||
                                  // Singular forms: "each elf", "whenever a wolf"  
                                  commanderText.includes(`each ${type}`) ||
                                  commanderText.includes(`whenever a ${type}`) ||
                                  commanderText.includes(`${type} creatures`) ||
                                  // Alternative patterns: "elf and wolf", "elves and wolves"
                                  commanderText.includes(`${type} and `) ||
                                  commanderText.includes(`${plural} and `);
                                if (hasTypeBonus) {
                                  console.log(`✅ Detected tribal synergy for ${type}/${plural} in ${commander.name}`);
                                }
                                return hasTypeBonus;
                              }) ||
                              // Multi-tribal detection (affects 2+ creature types)
                              (creatureTypesInText.length >= 2 && 
                               (commanderText.includes('each') || commanderText.includes('all')));
                               
    if (hasTribalAbilities) {
      console.log(`🏴 ${commander.name} identified as tribal commander`);
    }
    
    const hasComboElements = commanderText.includes('infinite') ||
                            commanderText.includes('untap') ||
                            commanderText.includes('extra turn') ||
                            commanderText.includes('copy') ||
                            abilities.some(ability => ability.keywords.some(k => k.includes('untap') || k.includes('copy')));
    
    const hasValueElements = abilities.some(ability => ability.type.includes('draw')) ||
                            abilities.some(ability => ability.type.includes('creature_etb')) ||
                            commanderText.includes('draw') ||
                            commanderText.includes('scry') ||
                            commanderText.includes('whenever a creature enters') ||
                            commanderText.includes('whenever another creature enters');
    
    const hasAggressiveElements = commanderText.includes('attack') ||
                                 commanderText.includes('combat') ||
                                 commanderText.includes('haste') ||
                                 commanderText.includes('damage') ||
                                 commander.cmc <= 3;
    
    const hasControlElements = commanderText.includes('counter') ||
                              commanderText.includes('exile') ||
                              commanderText.includes('destroy') ||
                              commanderText.includes('return') ||
                              abilities.some(ability => ability.keywords.includes('counter'));
    
    const hasRampElements = commanderText.includes('add') && commanderText.includes('mana') ||
                           commanderText.includes('lands') ||
                           commander.cmc >= 6;
    
    // Determine primary strategy based on strongest indicators
    // Tribal must be CLEARLY the primary focus, not just incidental
    if (hasTribalAbilities && !hasValueElements && !hasComboElements && 
        this.extractCreatureTypesFromText(commanderText).length > 0) {
      return 'tribal';
    } else if (hasComboElements) {
      return 'combo';
    } else if (hasValueElements && !hasAggressiveElements) {
      return 'value_engine';
    } else if (hasAggressiveElements && commander.cmc <= 4) {
      return 'aggressive';
    } else if (hasControlElements) {
      return 'control';
    } else if (hasRampElements || commander.cmc >= 6) {
      return 'ramp';
    } else {
      return 'midrange';
    }
  }

  private async removeIllegalCardsAndReplace(deck: DeckCard[], commander: ScryfallCard, constraints: GenerationConstraints): Promise<DeckCard[]> {
    const illegalCards: DeckCard[] = [];
    const legalCards: DeckCard[] = [];
    
    // Separate legal and illegal cards
    for (const card of deck) {
      if (!isCardLegalInCommander(card) || !isColorIdentityValid(card, commander.color_identity)) {
        illegalCards.push(card);
        console.warn(`Removing illegal card: ${card.name} - ${!isCardLegalInCommander(card) ? 'Banned/Not Legal' : 'Color Identity Violation'}`);
      } else {
        legalCards.push(card);
      }
    }
    
    // If no illegal cards, return original deck
    if (illegalCards.length === 0) {
      return deck;
    }
    
    // Find replacements for each illegal card
    const replacements: DeckCard[] = [];
    for (const illegalCard of illegalCards) {
      console.log(`Finding replacement for illegal card: ${illegalCard.name} (Role: ${illegalCard.role})`);
      
      try {
        // Generate search queries based on the illegal card's role and type
        const searchQueries = this.generateReplacementQueries(illegalCard, commander);
        const colorIdentity = commander.color_identity;
        
        let foundReplacement = false;
        for (const query of searchQueries) {
          const candidates = await this.scryfallClient.searchCardsByColorIdentity(colorIdentity, query, 'edhrec');
          
          // Filter out cards already in deck and find first legal one
          for (const candidate of candidates) {
            const isDuplicate = legalCards.some(card => card.name === candidate.name) ||
                               replacements.some(card => card.name === candidate.name);
            
            if (!isDuplicate && isCardLegalInCommander(candidate) && isColorIdentityValid(candidate, colorIdentity)) {
              const replacementCard: DeckCard = {
                ...candidate,
                role: illegalCard.role,
                synergy_score: await this.calculateCardSynergy(candidate, commander, [...legalCards, ...replacements], constraints),
                synergy_notes: `Replacement for ${illegalCard.name} - ${illegalCard.role} card`
              };
              
              replacements.push(replacementCard);
              console.log(`Found replacement: ${candidate.name} for ${illegalCard.name}`);
              foundReplacement = true;
              break;
            }
          }
          
          if (foundReplacement) break;
        }
        
        if (!foundReplacement) {
          console.warn(`Could not find suitable replacement for ${illegalCard.name}, deck may be short cards`);
        }
      } catch (error) {
        console.error(`Error finding replacement for ${illegalCard.name}:`, error);
      }
    }
    
    return [...legalCards, ...replacements];
  }

  private generateReplacementQueries(illegalCard: DeckCard, commander: ScryfallCard): string[] {
    const queries: string[] = [];
    const cardType = illegalCard.type_line.toLowerCase();
    const role = illegalCard.role;
    const cmc = illegalCard.cmc;
    
    // Generate queries based on card role
    switch (role) {
      case 'Ramp':
        queries.push(
          'o:"add" o:"mana"',
          'o:"search your library" o:"land"',
          't:artifact o:"add"',
          't:creature o:"add"'
        );
        break;
        
      case 'Draw/Advantage':
        queries.push(
          'o:"draw" o:"card"',
          'o:"scry"',
          'o:"surveil"',
          't:enchantment o:"draw"'
        );
        break;
        
      case 'Removal/Interaction':
        queries.push(
          'o:"destroy target"',
          'o:"exile target"',
          'o:"deal" o:"damage"',
          't:instant o:"target"'
        );
        break;
        
      case 'Board Wipe':
        queries.push(
          'o:"destroy all"',
          'o:"exile all"',
          'o:"wrath"'
        );
        break;
        
      case 'Tutor':
        queries.push(
          'o:"search your library"',
          'o:"tutor"'
        );
        break;
        
      case 'Synergy/Wincon':
        // Use commander abilities to find synergistic replacements
        const commanderAbilities = this.analyzeCommanderAbilities(commander);
        for (const ability of commanderAbilities) {
          for (const keyword of ability.keywords) {
            queries.push(`o:"${keyword}"`);
          }
        }
        queries.push(`cmc<=${cmc + 1}`, 't:creature', 't:artifact');
        break;
        
      case 'Land':
        queries.push(
          't:land',
          'o:"enters the battlefield untapped"',
          'o:"add"'
        );
        break;
        
      default:
        queries.push(`cmc<=${cmc + 1}`, 't:creature');
    }
    
    // Add type-based queries as fallback
    if (cardType.includes('creature')) {
      queries.push('t:creature');
    } else if (cardType.includes('artifact')) {
      queries.push('t:artifact');
    } else if (cardType.includes('enchantment')) {
      queries.push('t:enchantment');
    } else if (cardType.includes('instant')) {
      queries.push('t:instant');
    } else if (cardType.includes('sorcery')) {
      queries.push('t:sorcery');
    }
    
    return queries;
  }

  /**
   * Fill deck to exact card count by adding unused cards
   */
  private async fillToExactCount(
    currentDeck: DeckCard[],
    allCandidates: DeckCard[],
    commander: ScryfallCard,
    constraints: GenerationConstraints,
    targetCount: number
  ): Promise<DeckCard[]> {
    
    const usedNames = new Set(currentDeck.map(card => card.name));
    const unusedCandidates = allCandidates.filter(card => !usedNames.has(card.name));
    
    // Sort unused candidates by synergy with commander
    const scoredCandidates = unusedCandidates.map(card => ({
      card,
      synergyScore: this.calculateCardSynergy(card, commander, currentDeck, constraints)
    })).sort((a, b) => b.synergyScore - a.synergyScore);
    
    const finalDeck = [...currentDeck];
    
    // Add cards until we reach target count
    for (const {card} of scoredCandidates) {
      if (finalDeck.length >= targetCount) break;
      finalDeck.push(card);
    }
    
    console.log(`🔧 Filled deck from ${currentDeck.length} to ${finalDeck.length} cards. Had ${unusedCandidates.length} unused candidates available.`);
    
    if (finalDeck.length < targetCount) {
      console.warn(`⚠️ Could not fill to target count ${targetCount}. Only reached ${finalDeck.length} cards. Need ${targetCount - finalDeck.length} more candidates.`);
    }
    
    return finalDeck;
  }

  /**
   * Convert TypeQuotas from PercentageWeightingSystem to BudgetOptimizer format
   */
  private convertQuotasToBudgetFormat(quotas: TypeQuotas): Record<string, {target: number, current: number}> {
    return {
      artifacts: { target: quotas.artifacts.target, current: 0 },
      creatures: { target: quotas.creatures.target, current: 0 },
      enchantments: { target: quotas.enchantments.target, current: 0 },
      instants: { target: quotas.instants.target, current: 0 },
      sorceries: { target: quotas.sorceries.target, current: 0 },
      planeswalkers: { target: quotas.planeswalkers.target, current: 0 }
    };
  }
}
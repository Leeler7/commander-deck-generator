import { ScryfallCard, DeckCard, GeneratedDeck, GenerationConstraints, CardTypeWeights, BracketEstimate } from './types';
import { scryfallClient } from './scryfall';
import {
  isColorIdentityValid,
  isCardLegalInCommander,
  validateDeckComposition
} from './rules';
import { extractCardPrice, extractCardPriceWithSource, extractBatchCardPrices } from './pricing';
import { calculateEnhancedKeywordSynergy, mtgjsonKeywords } from './mtgjson-keywords';
import { edhrecClient } from './edhrec';
import { spellbookClient } from './combos';
import { EDHRECCardRecommendation } from './types';
import { determineArchetype, CURVE_ARCHETYPES, analyzeManaCurve, performManaCurveAnalysis } from './mana-curve-optimizer';

/**
 * New Generation Pipeline following user's 8-step specification:
 * 1. Color match the commander
 * 2. Determine synergy score based on the commander  
 * 3. Consider additional keywords from the user and increase the synergy score
 * 4. Narrow the card pool down to the recommended ratios based on the sliders
 * 5. Check the price of the cards
 * 6. Substitute cards over the threshold for individual card prices
 * 7. Check to see if the deck is 100 cards
 * 8. Fill empty slots with cards with synergy
 */

export interface ScoredCard extends ScryfallCard {
  synergyScore: number;
  finalScore: number;
  priceScore: number;
  isAffordable: boolean;
  assignedSlot?: string;
  price_used?: number;
  price_source?: string;
}

export class NewDeckGenerator {
  private scryfallClient = scryfallClient;
  private verbose = process.env.NODE_ENV === 'development';

  // EDHREC data cached for the current generation run
  private edhrecRecs: Map<string, EDHRECCardRecommendation> = new Map();
  private edhrecTotalDecks = 0;
  private _currentCommanderName: string | null = null;

  private log(message: string, ...args: any[]): void {
    // Reduce logging in production to avoid Railway rate limits
    if (this.verbose && process.env.NODE_ENV === 'development') {
      console.log(message, ...args);
    }
  }

  async generateDeck(
    commanderName: string,
    constraints: GenerationConstraints
  ): Promise<GeneratedDeck> {
    try {
      console.log('🎯 NEW PIPELINE: Starting deck generation for', commanderName);
      console.log(`💰 Budget constraints: total=$${constraints.total_budget ?? 'none'}, max_card=$${constraints.max_card_price ?? 'none'}, prefer_cheapest=${constraints.prefer_cheapest}`);

      // Validate and get commander
      const commanderValidation = await this.scryfallClient.validateCommander(commanderName);
      if (!commanderValidation.isValid || !commanderValidation.card) {
        throw new Error(commanderValidation.error || 'Invalid commander');
      }

      const commander = commanderValidation.card;
      this.log(`🎯 NEW PIPELINE: Generating deck for ${commander.name}`);

      // 🎲 FEATURE: Add randomized tags for spice variety (0-10 spice level)
      await this.addRandomizedTags(constraints, commander.name);

      // Pre-load EDHREC recommendations (used by step2 and step3)
      await this.loadEDHRECData(commander.name);

      // STEP 1: Color match the commander (inverted pool: keyword-first, then EDHREC broad, then fallback)
      this.log('📋 STEP 1: Building card pool (keyword-first, inverted logic)');
      const colorMatchedCards = await this.step1_ColorMatchCommander(commander, constraints);
      this.log(`✅ Found ${colorMatchedCards.length} color-matched cards`);

      // Critical check: If no cards found, throw an error to prevent land-only decks
      if (colorMatchedCards.length === 0) {
        console.error(`❌ CRITICAL ERROR: No cards found matching commander ${commander.name}'s color identity`);
        throw new Error(`Unable to find cards matching ${commander.name}'s color identity. Please try again.`);
      }

      // STEP 2: Determine synergy score based on the commander
      this.log('🔍 STEP 2: Calculating synergy scores');
      const synergyScored = await this.step2_ScoreSynergy(colorMatchedCards, commander);
      this.log(`✅ Scored ${synergyScored.length} cards for synergy`);

      // STEP 2b: Boost combo-completing cards discovered in the scored pool
      this.log('🔗 STEP 2b: Combo-aware scoring boost');
      const comboScored = await this.step2b_ComboAwareScoring(synergyScored, commander);
      this.log(`✅ Combo scoring done`);

      // STEP 3: Consider additional keywords from user and increase synergy score
      this.log('🏷️ STEP 3: Applying user theme bonuses');
      const themeEnhanced = await this.step3_ApplyUserThemes(comboScored, constraints);
      this.log(`✅ Applied theme bonuses to ${themeEnhanced.length} cards`);

      // STEP 4: Narrow card pool to recommended ratios based on sliders
      this.log('⚖️ STEP 4: Applying ratio constraints');
      const ratioFiltered = await this.step4_ApplyRatios(themeEnhanced, constraints.card_type_weights || {
        creatures: 5,
        artifacts: 5, 
        enchantments: 5,
        instants: 5,
        sorceries: 5,
        planeswalkers: 1
      }, colorMatchedCards, commander);
      this.log(`✅ Filtered to ${ratioFiltered.length} cards based on ratios`);

      // STEP 5: Check price of cards
      this.log('💰 STEP 5: Evaluating card prices');
      const priceEvaluated = await this.step5_EvaluatePrices(ratioFiltered, constraints);
      this.log(`✅ Evaluated prices for ${priceEvaluated.length} cards`);

      // STEP 6: Hard-filter cards over the per-card price cap
      this.log('💸 STEP 6: Enforcing per-card price cap');
      const budgetOptimized = await this.step6_SubstituteExpensiveCards(priceEvaluated, constraints);

      // STEP 7: Check if deck is 100 cards (99 + commander)
      this.log('📊 STEP 7: Validating deck size');
      const deckSizeValidated = await this.step7_ValidateDeckSize(budgetOptimized, commander, constraints.card_type_weights);
      this.log(`✅ Deck validated: ${deckSizeValidated.length} cards + commander = ${deckSizeValidated.length + 1} total`);

      // STEP 8: Fill empty slots with synergy cards
      this.log('🎯 STEP 8: Filling gaps with synergy cards');
      const finalDeck = await this.step8_FillWithSynergy(deckSizeValidated, commander, themeEnhanced, constraints);
      this.log(`✅ Final deck: ${finalDeck.length} cards + commander = ${finalDeck.length + 1} total`);

      // Safety check: Ensure we have cards to work with
      if (finalDeck.length === 0) {
        console.error(`❌ CRITICAL ERROR: No cards in final deck for ${commander.name}`);
        throw new Error(`Failed to generate deck for ${commander.name}. No cards passed through the generation pipeline. Please check your filters and try again.`);
      }

      // Separate lands from non-lands
      const nonlandCards: DeckCard[] = [];
      const landCards: DeckCard[] = [];
      
      for (const card of finalDeck) {
        // Determine role based on card type
        let role = 'synergy';
        const type = (card.type_line || '').toLowerCase();
        if (type.includes('creature')) role = 'creature';
        else if (type.includes('artifact')) role = 'artifact';
        else if (type.includes('enchantment')) role = 'enchantment';
        else if (type.includes('instant')) role = 'instant';
        else if (type.includes('sorcery')) role = 'sorcery';
        else if (type.includes('planeswalker')) role = 'planeswalker';
        else if (type.includes('land')) role = 'land';
        
        const deckCard: DeckCard = {
          ...card,
          quantity: 1,
          role: role,
          tags: [],
          price_used: (card as any).price_used || extractCardPrice(card, constraints?.prefer_cheapest || false),
          price_source: (card as any).price_source || 'Scryfall'
        };
        
        // Only basic lands and utility lands should go in lands section
        // Most artifacts, creatures, etc. should be non-lands even if they mention "land" in text
        const typeLine = (card.type_line || '').toLowerCase();
        if (typeLine.includes('land') && !typeLine.includes('creature') && !typeLine.includes('artifact')) {
          landCards.push(deckCard);
        } else {
          nonlandCards.push(deckCard);
        }
      }

      // Critical check: Ensure we have non-land cards
      if (nonlandCards.length === 0) {
        console.error(`❌ CRITICAL ERROR: No non-land cards found for ${commander.name}`);
        console.error(`  Land cards: ${landCards.length}`);
        console.error(`  Final deck had ${finalDeck.length} cards`);
        throw new Error(`Failed to generate deck for ${commander.name}. All cards were filtered out as lands. This indicates a critical issue with card filtering or database queries.`);
      }

      // Generate additional basic lands if needed to reach reasonable land count
      const targetLandCount = 35; // Standard target for land count
      const additionalLands = await this.generateBasicLands(commander, nonlandCards, targetLandCount - landCards.length, landCards);
      const allLands = [...landCards, ...additionalLands];

      // Create commander card
      // Get enhanced pricing for commander
      const commanderPricing = await extractCardPriceWithSource(commander, constraints?.prefer_cheapest || false);
      const commanderCard: DeckCard = { 
        ...commander, 
        quantity: 1, 
        role: 'commander', 
        tags: [],
        price_used: commanderPricing.price,
        price_source: commanderPricing.source
      };
      
      if (commanderPricing.source.startsWith('MTGJSON')) {
        this.log(`👑 Commander enhanced pricing: ${commander.name} = $${commanderPricing.price.toFixed(2)} (${commanderPricing.source})`);
      }

      // Final adjustment to ensure exactly 99 cards
      let finalNonlands = nonlandCards;
      let finalLands = allLands;
      const currentTotal = finalNonlands.length + finalLands.length;
      const targetTotal = 99;
      
      
      if (currentTotal !== targetTotal) {
        this.log(`🔧 Adjusting deck size from ${currentTotal} to ${targetTotal}`);
        
        if (currentTotal > targetTotal) {
          // Remove excess cards (prefer removing lands first, then lowest score non-lands)
          const excess = currentTotal - targetTotal;
          if (finalLands.length > 34 && excess <= finalLands.length - 34) {
            // Can trim just lands
            finalLands = finalLands.slice(0, finalLands.length - excess);
            this.log(`🔧 Trimmed ${excess} lands to reach target size`);
          } else {
            // Need to trim both lands and nonlands
            const landReduction = Math.max(0, finalLands.length - 34);
            const nonlandReduction = excess - landReduction;
            finalLands = finalLands.slice(0, finalLands.length - landReduction);
            
            // PRESERVE PLANESWALKERS and maintain type ratios during trimming
            const planeswalkers = finalNonlands.filter(c => c.type_line.toLowerCase().includes('planeswalker'));
            const nonPlaneswalkers = finalNonlands.filter(c => !c.type_line.toLowerCase().includes('planeswalker'));
            
            // Group non-planeswalkers by type
            const byType: Record<string, typeof nonPlaneswalkers> = {
              creature: [],
              artifact: [],
              enchantment: [],
              instant: [],
              sorcery: [],
              other: []
            };
            
            for (const card of nonPlaneswalkers) {
              const type = (card.type_line || '').toLowerCase();
              if (type.includes('creature')) byType.creature.push(card);
              else if (type.includes('artifact')) byType.artifact.push(card);
              else if (type.includes('enchantment')) byType.enchantment.push(card);
              else if (type.includes('instant')) byType.instant.push(card);
              else if (type.includes('sorcery')) byType.sorcery.push(card);
              else byType.other.push(card);
            }
            
            // Sort each type by score
            for (const typeCards of Object.values(byType)) {
              typeCards.sort((a, b) => ((b as any).finalScore || 0) - ((a as any).finalScore || 0));
            }
            
            // Calculate how many to trim from each type proportionally
            const totalNonPW = nonPlaneswalkers.length;
            let cardsToKeep = totalNonPW - nonlandReduction;
            const trimmedNonPW: typeof nonPlaneswalkers = [];
            
            // First pass: Calculate proportional targets
            const targetsByType: Record<string, number> = {};
            let totalTargets = 0;
            
            for (const [typeName, typeCards] of Object.entries(byType)) {
              if (typeCards.length === 0) continue;
              const typeProportion = typeCards.length / totalNonPW;
              const target = Math.floor(typeProportion * cardsToKeep);
              targetsByType[typeName] = target;
              totalTargets += target;
            }
            
            // Distribute any remainder to maintain exact count
            let remainder = cardsToKeep - totalTargets;
            if (remainder > 0) {
              // Add remainder to types with the most cards
              const sortedTypes = Object.entries(byType)
                .filter(([_, cards]) => cards.length > 0)
                .sort(([_, a], [__, b]) => b.length - a.length);
              
              for (let i = 0; i < remainder && i < sortedTypes.length; i++) {
                targetsByType[sortedTypes[i][0]]++;
              }
            }
            
            // Keep cards based on calculated targets
            for (const [typeName, typeCards] of Object.entries(byType)) {
              if (typeCards.length === 0) continue;
              
              const typeToKeep = targetsByType[typeName] || 0;
              const typeReduction = typeCards.length - typeToKeep;
              
              // Keep the highest scoring cards of this type
              const kept = typeCards.slice(0, typeToKeep);
              trimmedNonPW.push(...kept);
              
              if (typeReduction > 0) {
                this.log(`  Trimmed ${typeReduction} ${typeName}(s) from ${typeCards.length} to ${kept.length}`);
              }
            }
            
            // Recombine, preserving all planeswalkers
            finalNonlands = [...planeswalkers, ...trimmedNonPW];
            
            this.log(`🔧 Trimmed ${landReduction} lands and ${nonlandReduction} nonlands proportionally (preserved ${planeswalkers.length} planeswalkers)`);
          }
        } else {
          // Add more basic lands to reach target
          const needed = targetTotal - currentTotal;
          const additionalBasics = await this.generateBasicLands(commander, finalNonlands, needed, finalLands);
          finalLands = [...finalLands, ...additionalBasics];
        }
      }
      
      const finalTotal = finalNonlands.length + finalLands.length;
      this.log(`📊 Final deck composition: ${finalNonlands.length} non-lands + ${finalLands.length} lands = ${finalTotal} total + commander = ${finalTotal + 1}`);

      // ── Soft budget enforcement ───────────────────────────────────────────
      if (constraints.total_budget) {
        const currentCost = this.calculateTotalPrice([...finalNonlands, ...finalLands], constraints);
        const overFraction = (currentCost - constraints.total_budget) / constraints.total_budget;
        if (overFraction > 0.5) {
          console.log(`💰 BUDGET: $${currentCost.toFixed(2)} vs target $${constraints.total_budget} (${(overFraction * 100).toFixed(0)}% over) — swapping aggressively`);
          const usedNames = new Set(finalNonlands.map(c => c.name));
          const perCardBudget = constraints.total_budget / finalNonlands.length;
          // Cheap candidates not already in deck, sorted by score desc
          const cheapCandidates = themeEnhanced
            .filter(c => !usedNames.has(c.name) &&
              extractCardPrice(c, constraints.prefer_cheapest) <= perCardBudget * 1.2 &&
              extractCardPrice(c, constraints.prefer_cheapest) <= (constraints.max_card_price ?? 50))
            .sort((a, b) => b.finalScore - a.finalScore);
          // Sort nonlands by price desc (most expensive first)
          const byPrice = [...finalNonlands]
            .sort((a, b) => extractCardPrice(b, constraints.prefer_cheapest) - extractCardPrice(a, constraints.prefer_cheapest));
          let swaps = 0;
          const maxSwaps = Math.ceil(finalNonlands.length * 0.2);
          for (const expensive of byPrice) {
            if (swaps >= maxSwaps) break;
            const expPrice = extractCardPrice(expensive, constraints.prefer_cheapest);
            if (expPrice <= perCardBudget * 1.5) break; // Already within reasonable range
            const sub = cheapCandidates.find(c => !usedNames.has(c.name));
            if (!sub) break;
            const subPrice = extractCardPrice(sub, constraints.prefer_cheapest);
            if (subPrice >= expPrice) continue;
            finalNonlands = finalNonlands.filter(c => c.name !== expensive.name);
            finalNonlands.push({ ...sub, quantity: 1, role: 'synergy', tags: [], price_used: subPrice, price_source: 'Scryfall' } as DeckCard);
            usedNames.delete(expensive.name);
            usedNames.add(sub.name);
            cheapCandidates.splice(cheapCandidates.indexOf(sub), 1);
            swaps++;
            console.log(`💰 BUDGET: Swapped ${expensive.name} ($${expPrice.toFixed(2)}) → ${sub.name} ($${subPrice.toFixed(2)})`);
          }
          const newCost = this.calculateTotalPrice([...finalNonlands, ...finalLands], constraints);
          console.log(`💰 BUDGET: After ${swaps} swaps: $${newCost.toFixed(2)}`);
        } else if (overFraction > 0.2) {
          console.log(`💰 BUDGET: $${currentCost.toFixed(2)} vs target $${constraints.total_budget} (${(overFraction * 100).toFixed(0)}% over) — within tolerance, keeping deck quality`);
        }
      }

      // Analyze mana curve
      const curveAnalysis = performManaCurveAnalysis(finalNonlands, commander);
      const commanderArchetype = determineArchetype(commander);
      this.log(`📈 MANA CURVE ANALYSIS:`);
      this.log(`  Archetype: ${commanderArchetype}`);
      this.log(`  Average CMC: ${(finalNonlands.reduce((sum, c) => sum + (c.cmc || 0), 0) / finalNonlands.length).toFixed(2)}`);
      this.log(`  Distribution: 0=${curveAnalysis.current[0]}, 1=${curveAnalysis.current[1]}, 2=${curveAnalysis.current[2]}, 3=${curveAnalysis.current[3]}, 4=${curveAnalysis.current[4]}, 5=${curveAnalysis.current[5]}, 6+=${curveAnalysis.current[6]}`);
      if (curveAnalysis.recommendations.length > 0) {
        this.log(`  Recommendations:`, curveAnalysis.recommendations);
      }

      // Final validation (after deck size adjustment)
      const finalAllCards = [...finalNonlands, ...finalLands];
      const validation = validateDeckComposition(commander, finalAllCards);
      if (!validation.isValid) {
        console.warn('⚠️ Deck validation warnings:', validation.errors);
      }

      // Calculate role breakdown
      const roleBreakdown: Record<string, number> = {};
      finalAllCards.forEach(card => {
        const role = String(card.role);
        roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
      });

      // ── Commander Spellbook: combos + bracket estimation ──────────────────
      const spiceLevel = constraints.random_tag_count ?? 0;
      const allCardNames = finalAllCards.map(c => c.name);
      let bracketEstimate: BracketEstimate | undefined;

      // Always estimate bracket
      try {
        const bracket = await spellbookClient.estimateBracket(commander.name, allCardNames);
        if (bracket) bracketEstimate = bracket;
      } catch {
        // Spellbook is optional — fail silently
      }

      // ── Bracket targeting: remove combo cards if deck exceeds targetBracket ─
      if (constraints.targetBracket && bracketEstimate && bracketEstimate.bracket > constraints.targetBracket) {
        console.log(`🎯 BRACKET: Estimated bracket ${bracketEstimate.bracket} exceeds target ${constraints.targetBracket} — removing combo cards`);
        // Collect all card names involved in any detected combo
        const comboCardNames = new Set(bracketEstimate.combos.flatMap(c => c.cards));
        // Remove combo cards from nonlands, replace with next-best non-combo cards from themeEnhanced
        const usedNames = new Set(finalNonlands.map(c => c.name));
        const replacements = themeEnhanced
          .filter(c => !usedNames.has(c.name) && !comboCardNames.has(c.name) &&
            extractCardPrice(c, constraints.prefer_cheapest) <= (constraints.max_card_price ?? 50))
          .sort((a, b) => b.finalScore - a.finalScore);
        const removed: string[] = [];
        finalNonlands = finalNonlands.filter(c => {
          if (comboCardNames.has(c.name)) { removed.push(c.name); return false; }
          return true;
        });
        for (const r of replacements.slice(0, removed.length)) {
          finalNonlands.push({ ...r, quantity: 1, role: 'synergy', tags: [], price_used: extractCardPrice(r, constraints.prefer_cheapest), price_source: 'Scryfall' } as DeckCard);
        }
        console.log(`🎯 BRACKET: Removed ${removed.length} combo cards (${removed.join(', ')}), added ${Math.min(removed.length, replacements.length)} replacements`);
        // Re-estimate bracket once after removal
        try {
          const updatedNames = [...finalNonlands, ...finalLands].map(c => c.name);
          const reBracket = await spellbookClient.estimateBracket(commander.name, updatedNames);
          if (reBracket) {
            bracketEstimate = reBracket;
            console.log(`🎯 BRACKET: Re-estimated bracket after removal: ${reBracket.bracket}`);
          }
        } catch {
          // fail silently
        }
      }

      // Inject one combo package when power level is >= 7 and combos are allowed
      if (spiceLevel >= 7 && !constraints.no_infinite_combos) {
        try {
          const combos = await spellbookClient.findCombos(commander.name, allCardNames);
          if (combos.length > 0) {
            // Pick the first combo and inject missing pieces into the non-land section
            const combo = combos[0];
            const presentNames = new Set(allCardNames);
            const missingPieces = combo.cards.filter(n => !presentNames.has(n));
            if (missingPieces.length > 0 && missingPieces.length <= 3) {
              // Sort nonlands by lowest synergy score to find swap targets
              const swapTargets = [...finalNonlands]
                .sort((a, b) => ((a as any).finalScore ?? 0) - ((b as any).finalScore ?? 0))
                .slice(0, missingPieces.length);
              const swapNames = new Set(swapTargets.map(c => c.name));
              finalNonlands = finalNonlands.filter(c => !swapNames.has(c.name));
              // Attempt to fetch the missing combo pieces from Scryfall
              for (const pieceName of missingPieces) {
                try {
                  const res = await scryfallClient.searchCards(`!"${pieceName}" f:commander`, 1, 'name');
                  if (res.data.length > 0) {
                    const pieceCard = res.data[0];
                    const deckPiece: DeckCard = {
                      ...pieceCard,
                      quantity: 1,
                      role: 'Synergy/Wincon',
                      tags: ['combo'],
                      synergy_notes: `Combo piece: ${combo.results.join(', ')}`,
                      price_used: extractCardPrice(pieceCard, constraints.prefer_cheapest),
                      price_source: 'Scryfall',
                    };
                    finalNonlands.push(deckPiece);
                  }
                } catch {
                  // Piece not found — skip silently
                }
              }
              this.log(`🔗 Injected combo package (${combo.cards.join(', ')})`);
            }
          }
        } catch {
          // Combos are optional — fail silently
        }
      }

      return {
        commander: commanderCard,
        nonland_cards: finalNonlands,
        lands: finalLands,
        total_price: this.calculateTotalPrice([...finalNonlands, ...finalLands], constraints),
        role_breakdown: roleBreakdown,
        warnings: validation.errors,
        generation_notes: [
          `Generated ${finalNonlands.length} non-land cards and ${finalLands.length} lands`,
          `Total synergy-focused cards: ${finalNonlands.filter(c => c.role === 'synergy').length}`,
          `Average synergy score: ${(finalDeck.reduce((sum, card) => sum + card.finalScore, 0) / finalDeck.length).toFixed(1)}`,
          ...(bracketEstimate ? [`⚡ Estimated bracket: ${bracketEstimate.bracket}`] : []),
          ...(constraints.random_tags && constraints.random_tags.length > 0 ? [`🎲 Random tags: ${constraints.random_tags.join(', ')}`] : [])
        ],
        deck_explanation: `This deck focuses on synergy with ${commander.name}, prioritizing cards that work well with the commander's abilities and strategy.`,
        random_tags: constraints.random_tags || [],
        bracketEstimate
      };

    } catch (error) {
      console.error('❌ Deck generation failed:', error);
      throw error;
    }
  }

  /**
   * STEP 1: Build card pool using inverted logic
   *
   * Priority order:
   *   1. Targeted Scryfall oracle-text searches for user keywords/themes (highest priority)
   *   2. Broad EDHREC-sorted Scryfall color-identity search (fallback)
   *
   * Spice level (0-10) controls the ratio:
   *   - 0 → pure broad (5 pages broad, keyword searches only if manually entered)
   *   - 5 → balanced (3 pages broad, 2 pages per keyword)
   *   - 10 → keyword-dominant (2 pages broad, 3 pages per keyword)
   */
  private async step1_ColorMatchCommander(commander: ScryfallCard, constraints?: GenerationConstraints): Promise<ScryfallCard[]> {
    const colorQuery = commander.color_identity.length > 0
      ? `id<=${commander.color_identity.sort().join('')}`
      : 'id:c';
    const broadQuery = `${colorQuery} f:commander -type:basic`;

    const spiceLevel = constraints?.random_tag_count ?? 0;
    // At spice 0: only explicitly user-typed keywords (keyword_focus) trigger oracle searches.
    // Injected themes (keywords) and random tags only activate at spice >= 1.
    const userKeywords = spiceLevel === 0
      ? [...(constraints?.keyword_focus || [])]
      : [
          ...(constraints?.keyword_focus || []),
          ...(constraints?.keywords || []),
          ...(constraints?.random_tags || [])
        ];

    const seenIds = new Set<string>();
    const allCards: ScryfallCard[] = [];

    // ── FIRST: Targeted keyword oracle-text searches ─────────────────────────
    // Manual keywords always trigger 1 page minimum; spice level adds more pages
    const pagesPerKeyword = 1 + Math.floor(spiceLevel / 5); // 1→1, 5→2, 10→3
    const keywordSearchKeywords = userKeywords.slice(0, 6); // cap at 6 to limit API calls

    if (keywordSearchKeywords.length > 0) {
      for (const keyword of keywordSearchKeywords) {
        // Use oracle-text search with color identity constraint
        const kwQuery = `o:"${keyword}" ${colorQuery} f:commander -type:basic`;
        for (let page = 1; page <= pagesPerKeyword; page++) {
          try {
            const res = await this.scryfallClient.searchCards(kwQuery, page, 'edhrec');
            for (const card of res.data) {
              if (!seenIds.has(card.id)) {
                seenIds.add(card.id);
                allCards.push(card);
              }
            }
            if (!res.has_more) break;
          } catch {
            break;
          }
        }
      }
      this.log(`🔍 STEP1: keyword pool = ${allCards.length} cards from ${keywordSearchKeywords.length} keyword searches (${pagesPerKeyword} pages each)`);
    }

    // ── FOURTH: Broad EDHREC-sorted fallback ─────────────────────────────────
    // More spice → fewer broad pages (keyword pool dominates)
    const broadPages = Math.max(2, 5 - Math.floor(spiceLevel / 3)); // spice 0→5, spice 6→3, spice 9→2
    const broadStart = allCards.length;
    for (let page = 1; page <= broadPages; page++) {
      try {
        const response = await this.scryfallClient.searchCards(broadQuery, page, 'edhrec');
        for (const card of response.data) {
          if (!seenIds.has(card.id)) {
            seenIds.add(card.id);
            allCards.push(card);
          }
        }
        if (!response.has_more) break;
      } catch {
        break;
      }
    }
    this.log(`📋 STEP1: broad pool added ${allCards.length - broadStart} new cards (${broadPages} pages)`);
    this.log(`📋 STEP1: total pool = ${allCards.length} candidates`);

    return allCards.filter(card => {
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
      
      // Exclude basic lands (handled separately)
      const basicLands = ['plains', 'island', 'swamp', 'mountain', 'forest', 'wastes'];
      if (card.name && basicLands.includes(card.name.toLowerCase())) {
        return false;
      }

      // Exclude Un-sets (joke sets) using multiple methods
      const unSets = ['unk', 'ulst', 'sunf', 'unf', 'und', 'ust', 'unh', 'ugl'];
      const setCode = (card.set || '').toLowerCase();
      const setName = (card.set_name || '').toLowerCase();
      const cardName = (card.name || '').toLowerCase();
      const typeLine = (card.type_line || '').toLowerCase();
      
      // Method 1: Check set codes
      if (unSets.includes(setCode)) {
        this.log(`🚫 STEP1: Excluding Un-set card: ${card.name} from set ${card.set}`);
        return false;
      }
      
      // Method 2: Check set names for Un-set indicators
      const unSetNames = ['unfinity', 'unhinged', 'unstable', 'unglued'];
      if (unSetNames.some(unSetName => setName.includes(unSetName))) {
        this.log(`🚫 STEP1: Excluding Un-set card: ${card.name} from set name ${card.set_name}`);
        return false;
      }
      
      // Method 3: Check for Stickers type (Un-set mechanic)
      if (typeLine === 'stickers' || typeLine.includes('sticker')) {
        this.log(`🚫 STEP1: Excluding Stickers card: ${card.name}`);
        return false;
      }
      
      // Method 4: Additional Un-set card name detection (very specific patterns)
      const unSetKeywords = ['_____', 'gotcha', 'awol'];
      if (unSetKeywords.some(keyword => cardName.includes(keyword))) {
        this.log(`🚫 STEP1: Excluding likely Un-set card by name: ${card.name}`);
        return false;
      }
      
      return true;
    });
  }

  /**
   * Load EDHREC data for a commander and cache it for this generation run.
   * Falls back gracefully if EDHREC has no data.
   */
  private async loadEDHRECData(commanderName: string): Promise<void> {
    this.edhrecRecs.clear();
    this.edhrecTotalDecks = 0;
    this._currentCommanderName = commanderName;

    try {
      const recs = await edhrecClient.getThemedRecommendations(commanderName);
      if (recs.length === 0) {
        this.log(`⚠️ EDHREC: no recommendations for ${commanderName}, will use fallback scoring`);
        return;
      }

      for (const rec of recs) {
        this.edhrecRecs.set(rec.name.toLowerCase(), rec);
      }

      // Determine total deck count from the first rec that has it
      const firstWithTotal = recs.find(r => r.potentialDecks > 0);
      this.edhrecTotalDecks = firstWithTotal?.potentialDecks ?? 0;

      this.log(`✅ EDHREC: loaded ${recs.length} recommendations for ${commanderName} (${this.edhrecTotalDecks} total decks sampled)`);
    } catch (err) {
      console.error('[EDHREC] loadEDHRECData failed:', err);
    }
  }

  /**
   * STEP 2: Determine synergy score based on the commander.
   * Uses EDHREC synergy + inclusion data when available (≥50 decks).
   * Falls back to keyword-based text analysis for unknown/fringe commanders.
   */
  private async step2_ScoreSynergy(cards: ScryfallCard[], commander: ScryfallCard): Promise<ScoredCard[]> {
    const useEDHREC = this.edhrecTotalDecks >= 50;
    this.log(`🎯 SYNERGY SOURCE: ${useEDHREC ? `EDHREC (${this.edhrecTotalDecks} decks)` : 'fallback text analysis'}`);

    // Pre-load MTGJSON keywords for fallback scoring
    await mtgjsonKeywords.getKeywordCategories();

    const scoredCards = await Promise.all(cards.map(async card => {
      let synergyScore: number;
      let synergy_notes: string | undefined;

      const edhrecEntry = this.edhrecRecs.get(card.name.toLowerCase());

      if (useEDHREC && edhrecEntry) {
        // inclusion is now 0-1 (num_decks/potential_decks).
        // Synergy dominates so commander-specific cards beat generic goodstuff:
        //   inclusion contributes max 20 pts (card in 100% of decks)
        //   synergy  contributes max 80 pts (synergy = 1.0, very rare)
        const inclusionScore = edhrecEntry.inclusion * 20;
        const synergyBonus = edhrecEntry.synergy * 80;
        synergyScore = Math.max(0, inclusionScore + synergyBonus);

        const pct = Math.round(edhrecEntry.inclusion * 100);
        const syn = (edhrecEntry.synergy >= 0 ? '+' : '') + (edhrecEntry.synergy * 100).toFixed(0) + '%';
        synergy_notes = `EDHREC: ${syn} synergy, in ${pct}% of decks`;

        if (synergyScore >= 30) {
          this.log(`🎯 HIGH SYNERGY: ${card.name} = ${synergyScore.toFixed(1)} (${synergy_notes})`);
        }
      } else if (useEDHREC && !edhrecEntry) {
        // Card not found in EDHREC recommendations → capped low score so EDHREC cards dominate.
        // Max 15 means these only fill slots that genuinely EDHREC-recommended cards can't.
        const kw = await calculateEnhancedKeywordSynergy(commander.oracle_text || '', card.oracle_text || '');
        synergyScore = Math.min(15, Math.max(2, kw.score));
        synergy_notes = kw.score > 0 ? `Keyword match (no EDHREC data): ${kw.analysis}` : undefined;
      } else {
        // EDHREC data insufficient — full fallback
        const basicScore = this.calculateCommanderSynergy(card, commander);
        const kw = await calculateEnhancedKeywordSynergy(commander.oracle_text || '', card.oracle_text || '');
        synergyScore = basicScore + kw.score;
        synergy_notes = kw.score > 0 ? `Keyword: ${kw.analysis}` : undefined;
      }

      return {
        ...card,
        synergyScore,
        finalScore: synergyScore,
        priceScore: 5,
        isAffordable: true,
        synergy_notes,
      } as ScoredCard;
    }));

    const withScore = scoredCards.filter(c => c.synergyScore > 0).length;
    this.log(`📊 SYNERGY SUMMARY: ${withScore}/${scoredCards.length} cards with positive synergy`);

    // Debug: print top 20 by synergy score so we can verify EDHREC data quality
    const top20 = [...scoredCards]
      .sort((a, b) => b.synergyScore - a.synergyScore)
      .slice(0, 20);
    console.log(`\n🏆 STEP2 TOP 20 by synergy score for ${commander.name}:`);
    top20.forEach((c, i) => {
      const entry = this.edhrecRecs.get(c.name.toLowerCase());
      const syn = entry ? `synergy=${entry.synergy.toFixed(2)} inclusion=${(entry.inclusion * 100).toFixed(0)}%` : 'no EDHREC data';
      console.log(`  ${String(i + 1).padStart(2)}. ${c.name.padEnd(40)} score=${c.synergyScore.toFixed(1).padStart(6)}  [${syn}]`);
    });
    console.log();

    return scoredCards;
  }

  /**
   * STEP 2b: Combo-aware scoring boost.
   * Finds combos that can assemble from the top-30 pool, then boosts any combo-completing
   * cards that are present in the wider pool but scored low.
   */
  private async step2b_ComboAwareScoring(cards: ScoredCard[], commander: ScryfallCard): Promise<ScoredCard[]> {
    try {
      const top30Names = [...cards]
        .sort((a, b) => b.synergyScore - a.synergyScore)
        .slice(0, 30)
        .map(c => c.name);

      const combos = await spellbookClient.findCombos(commander.name, top30Names);
      if (combos.length === 0) {
        this.log(`🔗 STEP2b: No combos found in top-30 pool`);
        return cards;
      }

      this.log(`🔗 STEP2b: Found ${combos.length} potential combos — boosting combo pieces`);

      // Build a set of all combo card names that are present anywhere in the pool
      const poolNames = new Set(cards.map(c => c.name));
      const boostMap = new Map<string, { bonus: number; note: string }>();

      for (const combo of combos) {
        const result = combo.results[0] ?? 'combo';
        for (const pieceName of combo.cards) {
          if (poolNames.has(pieceName)) {
            const existing = boostMap.get(pieceName);
            const note = `Completes combo: ${combo.cards.join(' + ')} → ${result}`;
            if (!existing || existing.bonus < 25) {
              boostMap.set(pieceName, { bonus: 25, note });
            }
          }
        }
      }

      if (boostMap.size === 0) {
        this.log(`🔗 STEP2b: Combo pieces not found in card pool`);
        return cards;
      }

      this.log(`🔗 STEP2b: Boosting ${boostMap.size} combo pieces by +25`);

      return cards.map(card => {
        const boost = boostMap.get(card.name);
        if (!boost) return card;
        const newScore = card.synergyScore + boost.bonus;
        this.log(`  ⚡ ${card.name}: ${card.synergyScore.toFixed(1)} → ${newScore.toFixed(1)} (${boost.note})`);
        return {
          ...card,
          synergyScore: newScore,
          finalScore: newScore,
          synergy_notes: boost.note,
        };
      });
    } catch {
      // Combos are optional — fail silently
      return cards;
    }
  }

  /**
   * Calculate base synergy between card and commander
   */
  private calculateCommanderSynergy(card: ScryfallCard, commander: ScryfallCard): number {
    let synergy = 0;
    
    const cardText = (card.oracle_text || '').toLowerCase();
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const cardType = (card.type_line || '').toLowerCase();
    const commanderType = (commander.type_line || '').toLowerCase();
    const cardName = (card.name || '').toLowerCase();
    const commanderName = (commander.name || '').toLowerCase();
    
    // ETB/LTB synergy for flicker/exile commanders (like Norin)
    if (commanderText.includes('exile') || commanderText.includes('enters') || 
        commanderText.includes('leaves') || commanderText.includes('return')) {
      
      // Perfect synergy: Cards that trigger on ANY creature entering
      if (cardText.includes('whenever a creature enters the battlefield') ||
          cardText.includes('whenever a creature enters') ||
          cardText.includes('when a creature enters the battlefield') ||
          cardText.includes('when a creature enters')) {
        synergy += 15; // Maximum synergy for ETB triggers
      }
      
      // High synergy: Cards that trigger on creatures you control entering
      if (cardText.includes('whenever a creature you control enters') ||
          cardText.includes('when a creature you control enters')) {
        synergy += 12;
      }
      
      // Good synergy: Cards that create tokens (more ETB triggers)
      if (cardText.includes('create') && cardText.includes('token') && cardText.includes('creature')) {
        synergy += 10;
      }
      
      // Specific high-synergy cards for Norin and similar commanders
      const etbSynergyCards = [
        'impact tremors',
        'purphoros, god of the forge', 
        'genesis chamber',
        'outpost siege',
        'goblin bombardment',
        'altar of the brood',
        'pandemonium',
        'warstorm surge',
        'where ancients tread',
        'elemental bond',
        'terror of the peaks',
        'rage thrower'
      ];
      
      if (etbSynergyCards.some(name => cardName.includes(name))) {
        synergy += 17; // Very high synergy for known combo pieces
      }
    }
    
    // Commander-specific tribal detection and heavy boosting
    const commanderTribalBonuses = this.detectCommanderTribalBonuses(commander);
    
    // Apply massive synergy bonuses for commander's tribal types
    for (const tribalType of commanderTribalBonuses) {
      if (cardType.includes(tribalType) || cardText.includes(tribalType)) {
        synergy += 20; // Massive bonus for commander's primary tribal types
        this.log(`🎯 TRIBAL BOOST: ${card.name} gets +20 synergy for ${tribalType} tribal`);
      }
    }
    
    // Legacy tribal synergy (smaller bonuses)
    if (commanderText.includes('goblin') && (cardText.includes('goblin') || cardType.includes('goblin'))) {
      synergy += 8;
    }
    
    // Enhanced synergy detection for cards that buff other creatures/permanents
    if (cardText.includes('other creatures you control get') ||
        cardText.includes('creatures you control get') ||
        cardText.includes('other creatures get') ||
        cardText.includes('permanents you control get') ||
        cardText.includes('other permanents you control get')) {
      synergy += 6; // Cards that enhance other permanents
    }
    
    // Anthem effects (global buffs)
    if (cardText.includes('+1/+1') && 
        (cardText.includes('creatures get') || cardText.includes('creatures you control'))) {
      synergy += 7; // Anthem effects
    }
    
    // Lord effects (type-specific buffs)
    const lordPatterns = [
      'wolves you control get',
      'elves you control get', 
      'goblins you control get',
      'humans you control get',
      'soldiers you control get'
    ];
    
    if (lordPatterns.some(pattern => cardText.includes(pattern))) {
      synergy += 8; // Lord effects for tribal synergy
    }
    
    // Token creation synergy
    if (cardText.includes('create') && cardText.includes('token') && 
        (cardText.includes('wolf') || cardText.includes('elf'))) {
      synergy += 9; // Token creation with tribal relevance
    }
    
    // LAND-BASED SYNERGIES (for commanders like Karametra)
    // Detect commanders that put lands into play or care about lands
    if (commanderText.includes('search your library for a') && commanderText.includes('land') ||
        commanderText.includes('put') && commanderText.includes('land') && commanderText.includes('battlefield') ||
        commanderText.includes('play an additional land') ||
        commanderText.includes('lands enter the battlefield') ||
        commanderName.includes('karametra') ||
        commanderName.includes('azusa') ||
        commanderName.includes('tatyova') ||
        commanderName.includes('omnath') ||
        commanderName.includes('gitrog')) {
      
      // LANDFALL - Perfect synergy with land ramp commanders
      if (cardText.includes('landfall') ||
          cardText.includes('whenever a land enters the battlefield') ||
          cardText.includes('whenever a land you control enters') ||
          cardText.includes('when a land enters the battlefield')) {
        synergy += 20; // Maximum synergy for landfall cards
        this.log(`🏔️ LANDFALL SYNERGY: ${card.name} gets +20 synergy for landfall mechanics`);
      }
      
      // Land matters cards - High synergy
      if (cardText.includes('number of lands you control') ||
          cardText.includes('for each land you control') ||
          cardText.includes('equal to the number of lands') ||
          cardText.includes('lands you control have')) {
        synergy += 15; // High synergy for land count matters
        this.log(`🌍 LAND COUNT: ${card.name} gets +15 synergy for caring about land count`);
      }
      
      // Ramping cards - Good synergy (but not as high as landfall)
      if (cardText.includes('search your library for a') && cardText.includes('land') ||
          cardText.includes('you may put a land card from your hand onto the battlefield') ||
          cardText.includes('put a land card from your hand onto the battlefield') ||
          cardText.includes('rampant growth') ||
          cardText.includes('cultivate') ||
          cardText.includes('kodama\'s reach')) {
        synergy += 12; // Good synergy for ramp spells
        this.log(`🌱 RAMP SYNERGY: ${card.name} gets +12 synergy for land ramp`);
      }
      
      // Extra land drops - Great synergy
      if (cardText.includes('you may play an additional land') ||
          cardText.includes('play an additional land') ||
          cardText.includes('additional land each turn') ||
          cardText.includes('extra land')) {
        synergy += 18; // Very high synergy for extra land drops
        this.log(`🏞️ EXTRA LANDS: ${card.name} gets +18 synergy for additional land drops`);
      }
      
      // Specific high-synergy landfall cards
      const landfallSynergyCards = [
        'scute swarm',
        'avenger of zendikar',
        'lotus cobra',
        'omnath, locus of rage',
        'roil elemental',
        'rampaging baloths',
        'zendikar\'s roil',
        'retreat to coralhelm',
        'retreat to kazandu',
        'retreat to hagra',
        'retreat to emeria',
        'retreat to valakut',
        'courser of kruphix',
        'oracle of mul daya',
        'azusa, lost but seeking',
        'ramunap excavator',
        'tireless tracker',
        'titania, protector of argoth',
        'life from the loam',
        'crucible of worlds',
        'exploration',
        'burgeoning'
      ];
      
      if (landfallSynergyCards.some(name => cardName.includes(name))) {
        synergy += 22; // Maximum synergy for known landfall combo pieces
        this.log(`🎯 PREMIUM LANDFALL: ${card.name} gets +22 synergy as premium landfall card`);
      }
    }

    // ENHANCED LAND-SPECIFIC SYNERGIES
    if (cardType.includes('land')) {
      
      // Fetchlands for landfall commanders (triggers landfall twice)
      if ((cardText.includes('search your library for a') && cardText.includes('land') && cardText.includes('put it onto the battlefield')) ||
          cardName.includes('fetchland') || cardName.includes('misty rainforest') || cardName.includes('scalding tarn') ||
          cardName.includes('verdant catacombs') || cardName.includes('marsh flats') || cardName.includes('arid mesa') ||
          cardName.includes('bloodstained mire') || cardName.includes('flooded strand') || cardName.includes('polluted delta') ||
          cardName.includes('windswept heath') || cardName.includes('wooded foothills') || cardName.includes('evolving wilds') ||
          cardName.includes('terramorphic expanse') || cardName.includes('fabled passage')) {
        
        if (commanderText.includes('landfall') || commanderText.includes('whenever a land enters') ||
            commanderName.includes('omnath') || commanderName.includes('tatyova') || 
            commanderText.includes('lands enter the battlefield')) {
          synergy += 15; // Fetchlands are premium for landfall
          this.log(`🎯 FETCHLAND SYNERGY: ${card.name} gets +15 synergy for landfall triggering`);
        }
      }

      // Sacrifice lands for graveyard/sacrifice commanders
      if (cardText.includes('sacrifice') && cardText.includes('add') ||
          cardName.includes('high market') || cardName.includes('phyrexian tower') || 
          cardName.includes('diamond valley') || cardName.includes('city of shadows')) {
        
        if (commanderText.includes('sacrifice') || commanderText.includes('dies') ||
            commanderText.includes('graveyard') || commanderName.includes('meren') ||
            commanderName.includes('karador') || commanderName.includes('gitrog')) {
          synergy += 12; // Sacrifice lands for sacrifice strategies
          this.log(`🎯 SACRIFICE LAND: ${card.name} gets +12 synergy for sacrifice synergy`);
        }
      }

      // Artifact lands for artifact commanders
      if (cardType.includes('artifact') && cardType.includes('land')) {
        if (commanderText.includes('artifact') || commanderName.includes('daretti') ||
            commanderName.includes('saheeli') || commanderName.includes('urza') ||
            commanderName.includes('jhoira') || commanderName.includes('breya')) {
          synergy += 10; // Artifact lands for artifact synergy
          this.log(`🎯 ARTIFACT LAND: ${card.name} gets +10 synergy for artifact synergy`);
        }
      }

      // Utility lands with activated abilities
      if (cardText.includes('tap:') && !cardText.includes('add')) {
        synergy += 6; // Base utility land bonus
        this.log(`🎯 UTILITY LAND: ${card.name} gets +6 synergy for utility abilities`);
        
        // Extra synergy for specific utility types
        if (cardText.includes('draw a card') && commanderText.includes('draw')) {
          synergy += 6; // Card draw lands for draw commanders
          this.log(`🎯 DRAW UTILITY: ${card.name} gets +6 extra synergy for draw utility`);
        }
        if (cardText.includes('destroy target') && commanderText.includes('destroy')) {
          synergy += 6; // Removal lands for removal commanders
          this.log(`🎯 REMOVAL UTILITY: ${card.name} gets +6 extra synergy for removal utility`);
        }
      }

      // Creature lands for aggressive commanders
      if (cardType.includes('creature') || cardText.includes('becomes a') && cardText.includes('creature')) {
        if (commanderText.includes('attack') || commanderText.includes('creature') ||
            commanderText.includes('power') && commanderText.includes('toughness')) {
          synergy += 8; // Creature lands for creature-focused strategies
          this.log(`🎯 CREATURE LAND: ${card.name} gets +8 synergy for creature synergy`);
        }
      }

      // Tribal lands
      const tribalLandPatterns = [
        { pattern: 'goblin', tribes: ['goblin'] },
        { pattern: 'elf', tribes: ['elf'] },
        { pattern: 'human', tribes: ['human'] },
        { pattern: 'wizard', tribes: ['wizard'] },
        { pattern: 'soldier', tribes: ['soldier'] },
        { pattern: 'ancient ziggurat', tribes: ['creature'] }
      ];

      tribalLandPatterns.forEach(({ pattern, tribes }) => {
        if (cardName.includes(pattern) || cardText.includes(pattern)) {
          tribes.forEach(tribe => {
            if (commanderText.includes(tribe) || commanderType.includes(tribe)) {
              synergy += 8; // Tribal land synergy
              this.log(`🎯 TRIBAL LAND: ${card.name} gets +8 synergy for ${tribe} tribal`);
            }
          });
        }
      });

      // Multi-color fixing for multicolor commanders
      const colorCount = commander.color_identity.length;
      if (colorCount >= 3) {
        if (cardText.includes('any color') || cardText.includes('any one color') ||
            cardName.includes('command tower') || cardName.includes('city of brass') ||
            cardName.includes('mana confluence') || cardName.includes('exotic orchard') ||
            cardName.includes('reflecting pool')) {
          synergy += 8; // Premium fixing for 3+ color decks
          this.log(`🎯 PREMIUM FIXING: ${card.name} gets +8 synergy for multicolor fixing`);
        }
      }

      // Anti-synergy for lands that enter tapped without benefits
      if (cardText.includes('enters the battlefield tapped') && 
          !cardText.includes('unless') && !cardText.includes('if') &&
          !cardText.includes('scry') && !cardText.includes('gain') && 
          !cardText.includes('draw') && !cardText.includes('search')) {
        synergy -= 3; // Penalize pure tap lands slightly
        this.log(`🚫 TAP LAND PENALTY: ${card.name} gets -3 synergy for entering tapped`);
      }

      // Bonus for lands that come in untapped with conditions we can meet
      if (cardText.includes('enters the battlefield tapped unless') ||
          cardText.includes('enters tapped unless')) {
        synergy += 4; // Bonus for conditional untapped lands
        this.log(`🎯 CONDITIONAL UNTAPPED: ${card.name} gets +4 synergy for conditional untapped`);
      }
    }

    // +1/+1 COUNTER SYNERGIES (for commanders like Animar, Marchesa, etc.)
    if (commanderText.includes('+1/+1 counter') || commanderText.includes('put a +1/+1 counter') ||
        commanderText.includes('gets +1/+1') && commanderText.includes('for each') ||
        commanderName.includes('animar') ||
        commanderName.includes('marchesa') ||
        commanderName.includes('ezuri') ||
        commanderName.includes('vorel') ||
        commanderName.includes('gargos')) { // Gargos cares about Hydras which use +1/+1 counters
      
      if (cardText.includes('+1/+1 counter') ||
          cardText.includes('put a +1/+1 counter') ||
          cardText.includes('gets +1/+1') ||
          cardText.includes('proliferate')) {
        synergy += 18;
        this.log(`🎯 +1/+1 COUNTER SYNERGY: ${card.name} gets +18 synergy for counter mechanics`);
      }
      
      // Hydra-specific counter synergies (Hydras typically enter with counters)
      if (commanderName.includes('gargos') || commanderText.includes('hydra')) {
        // BEST: Counter doubling/multiplying effects are especially good with Hydras
        if ((cardText.includes('double') && cardText.includes('+1/+1 counter')) ||
            (cardText.includes('twice that many') && cardText.includes('counter')) ||
            (cardText.includes('twice as many') && cardText.includes('counter')) ||
            cardName.includes('doubling season') ||
            cardName.includes('parallel lives') ||
            cardName.includes('primal vigor') ||
            cardName.includes('branching evolution')) {
          synergy += 35; // Maximum synergy for counter doublers - these are the best cards
          this.log(`🐍 HYDRA COUNTER DOUBLER: ${card.name} gets +35 synergy for counter doubling with Hydras`);
        }
        // GOOD: Adding exactly one additional counter (weaker than doubling)
        else if ((cardText.includes('additional +1/+1 counter') && !cardText.includes('double')) ||
                 (cardText.includes('an additional +1/+1 counter')) ||
                 (cardText.includes('plus one +1/+1 counter')) ||
                 cardName.includes('hardened scales') ||
                 cardName.includes('long list of the ents')) {
          // These add only 1 extra counter, much weaker than doubling
          synergy += 12; // Lower synergy for single counter additions
          this.log(`🐍 HYDRA COUNTER ADDER: ${card.name} gets +12 synergy for adding single counters`);
        }
        
        // Cards that care about creatures with counters (but not "encounter" or other false positives)
        if (cardText.includes('creature') && cardText.includes('+1/+1 counter') && 
            (cardText.includes('with') || cardText.includes('has')) &&
            !cardText.includes('encounter')) {
          synergy += 15;
          this.log(`🎯 COUNTER MATTERS: ${card.name} gets +15 synergy for caring about creatures with counters`);
        }
        
        // Penalty for enchantments that create non-Hydra creatures without broader utility
        if (cardType.includes('enchantment') && 
            (cardText.includes('create') && cardText.includes('token')) &&
            !cardText.includes('hydra') && !cardText.includes('+1/+1') && 
            !cardText.includes('counter') && !cardText.includes('fight')) {
          // Check if it creates specific creature types that don't synergize
          if (cardText.includes('ent ') || cardText.includes('treefolk') ||
              cardText.includes('army') || cardText.includes('human') ||
              cardText.includes('soldier') || cardText.includes('knight')) {
            synergy -= 8; // Penalty for creating irrelevant creature types
            this.log(`🐍 HYDRA MISMATCH: ${card.name} gets -8 synergy for creating non-synergistic creatures`);
          }
        }
      }
    }

    // ARTIFACT SYNERGIES (for commanders like Jhoira, Breya, etc.)
    if (commanderText.includes('artifact') ||
        commanderName.includes('jhoira') ||
        commanderName.includes('breya') ||
        commanderName.includes('daretti') ||
        commanderName.includes('saheeli')) {
      
      if (cardType.includes('artifact') && !cardType.includes('land')) {
        synergy += 12;
        this.log(`⚙️ ARTIFACT SYNERGY: ${card.name} gets +12 synergy for being an artifact`);
      }
      
      if (cardText.includes('artifact') && 
          (cardText.includes('whenever you cast') || cardText.includes('artifact enters'))) {
        synergy += 15;
        this.log(`🔧 ARTIFACT MATTERS: ${card.name} gets +15 synergy for artifact synergy`);
      }
    }

    // COST REDUCTION SYNERGIES (e.g., Gargos making Hydras cost less)
    // Check if commander has cost reduction effects and if this card benefits
    if (commanderText.includes('cost') && commanderText.includes('less')) {
      const costReductionSynergy = this.calculateCostReductionSynergy(card, commander, cardText, commanderText);
      if (costReductionSynergy > 0) {
        synergy += costReductionSynergy;
        this.log(`💰 COST REDUCTION SYNERGY: ${card.name} gets +${costReductionSynergy} synergy from ${commander.name}'s cost reduction`);
      }
    }

    // CONDITIONAL REVEAL MECHANICS - Penalize cards that require unsupported creature types
    const conditionalPenalty = this.calculateConditionalRevealPenalty(card, commander, cardText, commanderText);
    if (conditionalPenalty > 0) {
      synergy -= conditionalPenalty;
      this.log(`🚫 CONDITIONAL PENALTY: ${card.name} loses -${conditionalPenalty} synergy for requiring unsupported creature types`);
    }

    // Shared keywords and mechanics
    const sharedKeywords = this.findSharedKeywords(cardText, commanderText);
    synergy += sharedKeywords.length * 3;
    
    // Universal good cards
    const universalStaples = [
      'sol ring', 'arcane signet', 'command tower', 'lightning greaves',
      'swiftfoot boots', 'skullclamp', 'rhystic study', 'mystic remora'
    ];
    
    if (universalStaples.includes(cardName)) {
      synergy += 8; // Universal staples
    }
    
    // Color identity and synergy matching
    if (card.color_identity.length === 0) {
      // Colorless cards - check for actual synergy, not just compatibility
      if (commanderText.includes('colorless') || commanderText.includes('artifact') ||
          cardText.includes('colorless') && commanderText.includes('colorless')) {
        synergy += 5; // Genuine colorless synergy
      } else {
        synergy += 1; // Minimal bonus for colorless cards (they fit but may not synergize)
      }
    } else if (card.color_identity.every(c => commander.color_identity.includes(c))) {
      synergy += 2; // Cards in commander's colors
    } else {
      // Cards outside commander's color identity should get negative synergy
      synergy -= 5; // Penalty for color identity violations
    }
    
    // Enhanced planeswalker synergy detection
    if (cardType.includes('planeswalker')) {
      const planeswalkerName = cardName;
      
      // Ugin checks - should be penalized for non-colorless strategies
      if (planeswalkerName.includes('ugin')) {
        if (!commanderText.includes('colorless') && commander.color_identity.length > 0) {
          synergy -= 8; // Heavy penalty for Ugin in colored decks without colorless synergy
          this.log(`🚫 ANTI-SYNERGY: ${card.name} penalized for poor color synergy in ${commander.name} deck`);
        }
      } else {
        // Give thematic bonuses for planeswalkers that fit color identity strategies
        const commanderColors = commander.color_identity;
        
        // Red planeswalker synergies
        if (commanderColors.includes('R')) {
          // Direct damage dealers (great for red aggro)
          if (cardText.includes('damage to any target') || cardText.includes('damage to target') ||
              cardText.includes('deals damage') || cardText.includes('damage to each') ||
              planeswalkerName.includes('chandra')) {
            synergy += 8;
            this.log(`🔥 RED SYNERGY: ${card.name} gets +8 synergy for red damage effects`);
          }
          
          // Mana and land synergies (good for red ramp/acceleration)
          if (cardText.includes('add') && cardText.includes('mana') ||
              cardText.includes('mountain') || cardText.includes('red mana') ||
              planeswalkerName.includes('koth')) {
            synergy += 7;
            this.log(`⛰️ MANA SYNERGY: ${card.name} gets +7 synergy for mana/mountain synergy`);
          }
          
          // Artifact synergies (good for red artifact strategies)
          if (cardText.includes('artifact') && (cardText.includes('create') || cardText.includes('return')) ||
              planeswalkerName.includes('daretti')) {
            synergy += 7;
            this.log(`⚙️ ARTIFACT SYNERGY: ${card.name} gets +7 synergy for artifact synergy`);
          }
        }
        
        // Black planeswalker synergies
        if (commanderColors.includes('B')) {
          // Sacrifice and graveyard synergies
          if (cardText.includes('sacrifice') || cardText.includes('graveyard') ||
              cardText.includes('return') && cardText.includes('graveyard') ||
              planeswalkerName.includes('liliana')) {
            synergy += 8;
            this.log(`💀 BLACK SYNERGY: ${card.name} gets +8 synergy for sacrifice/graveyard effects`);
          }
        }
        
        // White planeswalker synergies
        if (commanderColors.includes('W')) {
          // Token creation and anthem effects
          if (cardText.includes('create') && cardText.includes('token') ||
              cardText.includes('creatures you control get') ||
              planeswalkerName.includes('elspeth') || planeswalkerName.includes('ajani')) {
            synergy += 8;
            this.log(`👼 WHITE SYNERGY: ${card.name} gets +8 synergy for token/anthem effects`);
          }
        }
        
        // Green planeswalker synergies
        if (commanderColors.includes('G')) {
          // Prioritize creature buffs and +1/+1 counter synergies for creature-based commanders like Gargos
          if (commanderName.includes('gargos') || commanderText.includes('creature') || commanderText.includes('fight')) {
            // Generic creature buffs (like Garruk making creatures bigger)
            if (cardText.includes('creatures get +') || 
                cardText.includes('creature gets +') ||
                cardText.includes('+1/+1 counter') ||
                cardText.includes('creature token') ||
                planeswalkerName.includes('garruk')) {
              synergy += 15; // Higher synergy for generic creature support
              this.log(`🌿 CREATURE SYNERGY: ${card.name} gets +15 synergy for creature buffs/tokens`);
            }
            
            // Penalty for tribal-specific planeswalkers that don't fit the strategy
            if ((cardText.includes('wolf') && !cardText.includes('creature')) ||
                (cardText.includes('beast') && !cardText.includes('creature'))) {
              synergy -= 5; // Reduce synergy for specific tribal that doesn't match
              this.log(`🌿 TRIBAL PENALTY: ${card.name} gets -5 synergy for mismatched tribal focus`);
            }
          }
          
          // General creature and land synergies (lower priority)
          if (cardText.includes('creature') && (cardText.includes('search') || cardText.includes('put')) ||
              cardText.includes('land') && cardText.includes('search') ||
              planeswalkerName.includes('nissa')) {
            synergy += 6; // Lower than creature buffs
            this.log(`🌿 GREEN SYNERGY: ${card.name} gets +6 synergy for creature/land effects`);
          }
        }
        
        // Blue planeswalker synergies
        if (commanderColors.includes('U')) {
          // Card draw and spell synergies
          if (cardText.includes('draw') && cardText.includes('card') ||
              cardText.includes('instant') || cardText.includes('sorcery') ||
              planeswalkerName.includes('jace') || planeswalkerName.includes('teferi')) {
            synergy += 8;
            this.log(`🌊 BLUE SYNERGY: ${card.name} gets +8 synergy for card draw/spell effects`);
          }
        }
        
        // Generic planeswalker baseline - all planeswalkers get some value
        if (synergy < 5) {
          synergy += 4; // Baseline synergy for any reasonable planeswalker
          this.log(`📜 PLANESWALKER BASELINE: ${card.name} gets +4 baseline planeswalker synergy`);
        }
      }
    }
    
    return Math.max(0, synergy);
  }

  /**
   * STEP 3: Consider additional keywords from user and boost synergy scores.
   * Matches user keywords to EDHREC themes; falls back to text matching.
   */
  private async step3_ApplyUserThemes(cards: ScoredCard[], constraints: GenerationConstraints): Promise<ScoredCard[]> {
    const userKeywords = [...(constraints.keyword_focus || []), ...(constraints.keywords || [])];

    this.log(`🏷️ THEME PROCESSING: ${userKeywords.length} user keyword(s): ${userKeywords.join(', ') || 'none'}`);

    // If no themes specified, return cards unchanged
    if (userKeywords.length === 0) {
      return cards.map(card => ({ ...card, finalScore: card.synergyScore }));
    }
    
    // ── Try to match user keywords to EDHREC themes ──────────────────────────
    // Build a map from themed EDHREC recs: card name → theme bonus score
    const themedBonuses = new Map<string, number>();

    // We need the commander name — derive it from any existing rec or from generateDeck context.
    // We'll attempt themed recs for each user keyword that looks like an EDHREC theme slug.
    // Use the cached commander page to find available themes.
    // NOTE: commanderName is not directly available here, but the edhrecRecs map was populated
    // in loadEDHRECData — if it's non-empty, we can infer the commander was found.
    if (this.edhrecTotalDecks >= 50) {
      // Find commander name from the first rec (not possible directly); instead we use
      // the edhrecClient directly with the commander's name which we pass in via context.
      // We store it on the class during loadEDHRECData for convenience.
      const themes = this._currentCommanderName
        ? await edhrecClient.getCommanderThemes(this._currentCommanderName)
        : [];

      for (const keyword of userKeywords) {
        const kwLower = keyword.toLowerCase();
        // Match keyword to EDHREC theme (substring match on name or slug)
        const matchedTheme = themes.find(t =>
          t.name.toLowerCase().includes(kwLower) ||
          kwLower.includes(t.name.toLowerCase()) ||
          t.slug.includes(kwLower) ||
          kwLower.includes(t.slug)
        );

        if (matchedTheme && this._currentCommanderName) {
          this.log(`🏷️ Matched keyword "${keyword}" → EDHREC theme "${matchedTheme.name}" (${matchedTheme.count} decks)`);
          const themedRecs = await edhrecClient.getThemedRecommendations(
            this._currentCommanderName,
            matchedTheme.slug
          );
          for (const rec of themedRecs) {
            const key = rec.name.toLowerCase();
            const bonus = Math.max(themedBonuses.get(key) ?? 0, Math.round(rec.synergy * 200 + rec.inclusion * 100));
            themedBonuses.set(key, bonus);
          }
        }
      }
    }

    const enhancedCards: ScoredCard[] = [];

    for (const card of cards) {
      let themeBonus = 0;

      // 1. EDHREC themed bonus (primary)
      const edhrecBonus = themedBonuses.get(card.name.toLowerCase());
      if (edhrecBonus) {
        themeBonus += edhrecBonus;
        this.log(`🏷️ EDHREC THEME BOOST: ${card.name} +${edhrecBonus}`);
      }

      // 2. Text-match fallback for keywords not matched to a theme
      {
        const cardText = (card.oracle_text || '').toLowerCase();
        const cardType = (card.type_line || '').toLowerCase();
        const cardNameLower = card.name.toLowerCase();
        let textMatches = 0;

        for (const keyword of userKeywords) {
          const kwLower = keyword.toLowerCase();
          if (cardText.includes(kwLower) || cardType.includes(kwLower) || cardNameLower.includes(kwLower)) {
            themeBonus += 300;
            textMatches++;
            this.log(`📝 TEXT MATCH: ${card.name} +300 for "${keyword}"`);
          }
        }

        if (textMatches >= 2) {
          const multiBonus = textMatches * 150;
          themeBonus += multiBonus;
          this.log(`🌟 MULTI-TEXT BONUS: ${card.name} +${multiBonus} for ${textMatches} text matches`);
        }
      }

      
      enhancedCards.push({
        ...card,
        finalScore: card.synergyScore + themeBonus
      });
    }
    
    return enhancedCards;
  }

  /**
   * STEP 4: Narrow the card pool down to the recommended ratios based on the sliders
   * Apply proportional filtering based on card type weights
   */
  private async step4_ApplyRatios(cards: ScoredCard[], weights: CardTypeWeights, allColorMatched?: ScryfallCard[], commander?: ScryfallCard): Promise<ScoredCard[]> {
    // Group cards by type
    const cardsByType: Record<string, ScoredCard[]> = {
      creatures: [],
      artifacts: [],
      enchantments: [],
      instants: [],
      sorceries: [],
      planeswalkers: [],
      lands: [],
      other: []
    };
    
    for (const card of cards) {
      const type = (card.type_line || '').toLowerCase();
      
      if (type.includes('creature')) {
        cardsByType.creatures.push(card);
      } else if (type.includes('artifact')) {
        cardsByType.artifacts.push(card);
      } else if (type.includes('enchantment')) {
        cardsByType.enchantments.push(card);
      } else if (type.includes('instant')) {
        cardsByType.instants.push(card);
      } else if (type.includes('sorcery')) {
        cardsByType.sorceries.push(card);
      } else if (type.includes('planeswalker')) {
        cardsByType.planeswalkers.push(card);
      } else if (type.includes('land')) {
        cardsByType.lands.push(card);
      } else {
        cardsByType.other.push(card);
      }
    }
    
    // Calculate proportional distribution based on weights
    const filtered: ScoredCard[] = [];
    
    // Calculate total weight (excluding planeswalkers which are exact count)
    const totalWeight = weights.creatures + weights.artifacts + weights.enchantments + 
                        weights.instants + weights.sorceries;
    
    // Target approximately 65 non-land cards (rest will be lands)
    const targetNonLandCards = 65;
    
    // Determine target mana curve for this commander (fallback to midrange if no commander)
    const archetype = commander ? determineArchetype(commander) : 'midrange';
    const targetCurve = CURVE_ARCHETYPES[archetype];
    this.log(`🎯 Commander archetype: ${archetype}`);
    
    const applyProportionalFilter = (typeCards: ScoredCard[], weight: number, typeName: string): ScoredCard[] => {
      if (weight === 0) {
        this.log(`🚫 Excluding all ${typeName}s (weight = 0)`);
        return [];
      }
      
      // Calculate target cards for this type based on proportional weight
      const proportionalTarget = Math.round((weight / totalWeight) * targetNonLandCards);
      
      // Sort cards with mana curve considerations
      const sortedCards = typeCards.sort((a, b) => {
        // Primary: Sort by synergy score
        if (Math.abs(b.finalScore - a.finalScore) > 0.1) {
          return b.finalScore - a.finalScore;
        }
        
        // Tiebreaker 1: Prefer cards that fit our target curve
        const aCmc = Math.min(6, Math.floor(a.cmc || 0));
        const bCmc = Math.min(6, Math.floor(b.cmc || 0));
        const aCurveBonus = targetCurve[aCmc as keyof typeof targetCurve] || 0;
        const bCurveBonus = targetCurve[bCmc as keyof typeof targetCurve] || 0;
        if (aCurveBonus !== bCurveBonus) {
          return bCurveBonus - aCurveBonus; // Higher curve target = better
        }
        
        // Tiebreaker 2: Power level from comprehensive mechanics
        const aPower = (a as any).comprehensiveMechanics?.powerLevel || 5;
        const bPower = (b as any).comprehensiveMechanics?.powerLevel || 5;
        if (aPower !== bPower) {
          return bPower - aPower;
        }
        
        // Tiebreaker 3: EDHREC rank (lower is better)
        const aRank = a.edhrec_rank || 99999;
        const bRank = b.edhrec_rank || 99999;
        return aRank - bRank;
      });
      
      // Take exactly the target number of cards (best synergy first)
      const result = sortedCards.slice(0, proportionalTarget);
      
      // Count how many high-synergy cards we're including
      const highSynergyIncluded = result.filter(card => card.finalScore >= 50).length;
      
      this.log(`📊 Including ${result.length}/${typeCards.length} ${typeName}s (weight=${weight}, target=${proportionalTarget}, high-synergy included=${highSynergyIncluded})`);
      
      // Special logging for tribal creatures and high-value types
      if (typeName === 'creature' && highSynergyIncluded > 0) {
        const tribalCards = result.filter(card => card.finalScore >= 80);
        if (tribalCards.length > 0) {
          this.log(`  🎯 Tribal/high-value ${typeName}s:`, tribalCards.slice(0, 5).map(c => `${c.name} (${c.finalScore})`));
        }
      }
      
      return result;
    };
    
    filtered.push(...applyProportionalFilter(cardsByType.creatures, weights.creatures, 'creature'));
    filtered.push(...applyProportionalFilter(cardsByType.artifacts, weights.artifacts, 'artifact'));
    filtered.push(...applyProportionalFilter(cardsByType.enchantments, weights.enchantments, 'enchantment'));
    filtered.push(...applyProportionalFilter(cardsByType.instants, weights.instants, 'instant'));
    filtered.push(...applyProportionalFilter(cardsByType.sorceries, weights.sorceries, 'sorcery'));
    
    // Special handling for planeswalkers - treat as exact count, not ratio
    const planeswalkerCount = weights.planeswalkers;
    this.log(`🎯 PLANESWALKER DEBUG: Requested ${planeswalkerCount}, available ${cardsByType.planeswalkers.length}`);
    
    if (planeswalkerCount > 0) {
      let availablePlaneswalkers = cardsByType.planeswalkers;
      
      // For planeswalker requests > 5, always expand the search to ensure we have enough options
      // This addresses the issue where high planeswalker counts fail due to limited pool
      if ((planeswalkerCount > 5 || availablePlaneswalkers.length < planeswalkerCount) && allColorMatched) {
        this.log(`🔍 Expanding planeswalker search to original color-matched pool (requested: ${planeswalkerCount}, filtered: ${availablePlaneswalkers.length})`);
        const allPlaneswalkers = allColorMatched.filter(card => 
          (card.type_line || '').toLowerCase().includes('planeswalker')
        );
        
        this.log(`🔍 Found ${allPlaneswalkers.length} total planeswalkers in color-matched pool`);
        
        // Merge and deduplicate by ID
        const pwMap = new Map<string, ScoredCard>();
        availablePlaneswalkers.forEach(pw => pwMap.set(pw.id, pw));
        allPlaneswalkers.forEach(pw => {
          if (!pwMap.has(pw.id)) {
            // For expanded planeswalkers, give them a baseline synergy score if they have none
            const scored = pw as unknown as ScoredCard;
            if (!scored.finalScore || scored.finalScore <= 0) {
              scored.finalScore = 2; // Baseline score for expanded planeswalkers
              scored.synergyScore = 2;
              scored.priceScore = 5;
              scored.isAffordable = true;
            }
            pwMap.set(pw.id, scored);
          }
        });
        
        availablePlaneswalkers = Array.from(pwMap.values());
        this.log(`🎯 Expanded planeswalker pool from ${cardsByType.planeswalkers.length} to ${availablePlaneswalkers.length}`);
      }
      
      if (availablePlaneswalkers.length > 0) {
        const sortedPlaneswalkers = availablePlaneswalkers.sort((a, b) => b.finalScore - a.finalScore);
        
        // Debug: Show top planeswalkers and their scores
        this.log(`🎯 PLANESWALKER CANDIDATES (top 5):`);
        sortedPlaneswalkers.slice(0, Math.min(5, sortedPlaneswalkers.length)).forEach((pw, i) => {
          this.log(`  ${i + 1}. ${pw.name} (score: ${pw.finalScore}, affordable: ${pw.isAffordable})`);
        });
        
        const selectedPlaneswalkers = sortedPlaneswalkers.slice(0, Math.min(planeswalkerCount, sortedPlaneswalkers.length));
        filtered.push(...selectedPlaneswalkers);
        this.log(`🎯 Including exactly ${selectedPlaneswalkers.length} planeswalkers (requested: ${planeswalkerCount})`);
        selectedPlaneswalkers.forEach(pw => {
          this.log(`  ✅ Selected: ${pw.name} (score: ${pw.finalScore})`);
        });
      } else {
        this.log(`🚫 No planeswalkers available`);
      }
    }
    
    // Enhanced land filtering based on synergy scores
    const landCount = 36; // Target around 36 lands for a 99-card deck
    if (cardsByType.lands.length > 0) {
      // Separate basic lands from non-basic lands
      const basicLands = cardsByType.lands.filter(land => {
        const typeLine = land.type_line.toLowerCase();
        const name = land.name.toLowerCase();
        
        // True basic lands
        if (typeLine.includes('basic land')) return true;
        
        // Basic land types by name (for cards like "Snow-Covered Mountain")
        const basicNames = ['swamp', 'island', 'mountain', 'forest', 'plains'];
        const isBasicByName = basicNames.some(basicName => 
          name === basicName || name.includes(`snow-covered ${basicName}`) || name.includes(`${basicName} -`)
        );
        
        return isBasicByName && !typeLine.includes('legendary');
      });
      
      const nonBasicLands = cardsByType.lands.filter(land => !basicLands.includes(land));
      
      // Always include basic lands (user can adjust counts later)
      filtered.push(...basicLands);
      
      // Sort non-basic lands by synergy score and select the best ones
      const sortedNonBasics = nonBasicLands.sort((a, b) => b.finalScore - a.finalScore);
      const maxNonBasics = Math.max(0, landCount - basicLands.length);
      const selectedNonBasics = sortedNonBasics.slice(0, maxNonBasics);
      
      filtered.push(...selectedNonBasics);
      
      this.log(`🏞️ Land selection: ${basicLands.length} basic + ${selectedNonBasics.length}/${nonBasicLands.length} non-basic lands`);
      if (selectedNonBasics.length > 0) {
        this.log(`🎯 Top non-basic lands:`, selectedNonBasics.slice(0, 5).map(land => 
          `${land.name} (score: ${land.finalScore})`
        ));
      }
    }
    
    filtered.push(...cardsByType.other); // Always include other types
    
    return filtered;
  }

  /**
   * STEP 5: Check the price of the cards
   * Evaluate price information and mark cards that exceed the per-card cap.
   */
  private async step5_EvaluatePrices(cards: ScoredCard[], constraints: GenerationConstraints): Promise<ScoredCard[]> {
    const maxPrice = constraints.max_card_price ?? 50;
    this.log(`💰 Getting enhanced pricing data (max_card_price=$${maxPrice})...`);
    const cardPricings = await extractBatchCardPrices(cards, constraints.prefer_cheapest, 'tcgplayer');

    let overCapCount = 0;
    const result = cardPricings.map(({ card, price, source }) => {
      const scored = card as unknown as ScoredCard;
      const affordable = price <= maxPrice;
      if (!affordable) overCapCount++;
      const enhancedCard: ScoredCard = {
        ...scored,
        priceScore: affordable ? Math.max(1, 10 - (price / maxPrice) * 9) : 0,
        isAffordable: affordable,
        price_used: price,
        price_source: source
      };
      if (source.startsWith('MTGJSON')) {
        this.log(`💎 Enhanced pricing: ${card.name} = $${price.toFixed(2)} (${source})`);
      }
      return enhancedCard;
    });

    console.log(`💰 Step5 pricing: ${overCapCount} cards over $${maxPrice} cap (will be substituted in step6)`);
    return result;
  }

  /**
   * STEP 6: Substitute cards over the threshold for individual card prices
   * Replace expensive cards with cheaper alternatives when possible
   */
  private async step6_SubstituteExpensiveCards(cards: ScoredCard[], constraints: GenerationConstraints): Promise<ScoredCard[]> {
    const maxPrice = constraints.max_card_price || 50;
    
    // Temporarily exclude planeswalkers from budget filtering to test synergy selection
    const planeswalkers = cards.filter(card => (card.type_line || '').toLowerCase().includes('planeswalker'));
    const nonPlaneswalkers = cards.filter(card => !(card.type_line || '').toLowerCase().includes('planeswalker'));
    
    const affordableCards = nonPlaneswalkers.filter(card => card.isAffordable);
    const expensiveCards = nonPlaneswalkers.filter(card => !card.isAffordable);
    
    this.log(`💰 Found ${expensiveCards.length} expensive non-planeswalker cards to substitute`);
    this.log(`🎯 Preserving ${planeswalkers.length} planeswalkers regardless of budget`);
    
    // For each expensive card, try to find a cheaper alternative with similar function
    const substituted: ScoredCard[] = [...affordableCards, ...planeswalkers];
    
    for (const expensive of expensiveCards) {
      // Find similar cheaper cards
      const alternatives = affordableCards.filter(alt => 
        this.areSimilarCards(expensive, alt) && 
        !substituted.includes(alt)
      );
      
      if (alternatives.length > 0) {
        // Pick the best alternative
        const bestAlt = alternatives.sort((a, b) => b.finalScore - a.finalScore)[0];
        substituted.push(bestAlt);
        this.log(`🔄 Substituted ${expensive.name} ($${expensive.price_used?.toFixed(2) || 'N/A'}) with ${bestAlt.name} ($${bestAlt.price_used?.toFixed(2) || 'N/A'})`);
      } else {
        // No affordable substitute found — drop the card; step8 will fill the slot from affordable pool
        this.log(`🗑️ Dropped over-budget card (no substitute): ${expensive.name} ($${expensive.price_used?.toFixed(2) || 'N/A'})`);
      }
    }
    
    return substituted;
  }

  /**
   * STEP 7: Check to see if the deck is 100 cards
   * Ensure we have exactly 64 non-land cards while preserving type ratios
   */
  private async step7_ValidateDeckSize(cards: ScoredCard[], commander: ScryfallCard, originalWeights?: CardTypeWeights): Promise<ScoredCard[]> {
    const targetSize = 72; // Target 72 cards to account for some being lands (aiming for ~66 non-lands)
    
    if (cards.length === targetSize) {
      this.log(`✅ Perfect deck size: ${cards.length} cards`);
      return cards;
    }
    
    if (cards.length > targetSize) {
      // Trim proportionally by type to preserve ratios
      const cardsByType: Record<string, ScoredCard[]> = {
        creatures: [],
        artifacts: [],
        enchantments: [],
        instants: [],
        sorceries: [],
        planeswalkers: [],
        other: []
      };
      
      // Group cards by type
      for (const card of cards) {
        const type = (card.type_line || '').toLowerCase();
        if (type.includes('creature')) cardsByType.creatures.push(card);
        else if (type.includes('artifact')) cardsByType.artifacts.push(card);
        else if (type.includes('enchantment')) cardsByType.enchantments.push(card);
        else if (type.includes('instant')) cardsByType.instants.push(card);
        else if (type.includes('sorcery')) cardsByType.sorceries.push(card);
        else if (type.includes('planeswalker')) cardsByType.planeswalkers.push(card);
        else cardsByType.other.push(card);
      }
      
      // Calculate proportions and trim each type
      const totalCards = cards.length;
      const trimmed: ScoredCard[] = [];
      
      for (const [typeName, typeCards] of Object.entries(cardsByType)) {
        if (typeCards.length === 0) continue;
        
        // Calculate how many of this type to keep based on original weights if available
        let targetForType: number;
        
        if (originalWeights) {
          if (typeName === 'planeswalkers') {
            // For planeswalkers, use the weight as an exact count (not proportion)
            const requestedCount = originalWeights.planeswalkers || 0;
            targetForType = Math.min(requestedCount, typeCards.length);
            this.log(`🎯 STEP7 ${typeName}: targeting exactly ${targetForType} cards (requested: ${requestedCount}, available: ${typeCards.length})`);
            this.log(`🎯 STEP7 Available planeswalkers:`, typeCards.map(pw => pw.name));
          } else {
            // Use original weights to determine target proportions for other types
            const totalWeight = Object.values(originalWeights).reduce((sum, w, i, arr) => {
              // Exclude planeswalkers from total weight calculation since they're not proportional
              const key = Object.keys(originalWeights)[i];
              return key === 'planeswalkers' ? sum : sum + w;
            }, 0);
            const typeWeight = originalWeights[typeName as keyof CardTypeWeights] || 1;
            const weightProportion = typeWeight / totalWeight;
            targetForType = Math.round(weightProportion * targetSize);
            
            // Ensure we don't exceed available cards
            targetForType = Math.min(targetForType, typeCards.length);
            
            this.log(`🎯 ${typeName}: weight=${typeWeight}/${totalWeight} (${(weightProportion*100).toFixed(1)}%) -> target=${targetForType}/${typeCards.length}`);
          }
        } else {
          if (typeName === 'planeswalkers') {
            // If no original weights, keep all planeswalkers proportionally
            const proportion = typeCards.length / totalCards;
            targetForType = Math.round(proportion * targetSize);
          } else {
            // Fallback to proportional based on current counts
            const proportion = typeCards.length / totalCards;
            targetForType = Math.round(proportion * targetSize);
          }
        }
        
        // Sort by score and take the best ones (with tiebreakers)
        const sortedType = typeCards.sort((a, b) => {
          // Primary: Sort by synergy score
          if (Math.abs(b.finalScore - a.finalScore) > 0.1) {
            return b.finalScore - a.finalScore;
          }
          
          // Tiebreaker 1: Power level
          const aPower = (a as any).comprehensiveMechanics?.powerLevel || 5;
          const bPower = (b as any).comprehensiveMechanics?.powerLevel || 5;
          if (aPower !== bPower) {
            return bPower - aPower;
          }
          
          // Tiebreaker 2: EDHREC rank (lower is better)
          const aRank = a.edhrec_rank || 99999;
          const bRank = b.edhrec_rank || 99999;
          return aRank - bRank;
        });
        const keptCards = sortedType.slice(0, targetForType);
        
        trimmed.push(...keptCards);
        this.log(`✂️ Kept ${keptCards.length}/${typeCards.length} ${typeName}s`);
      }
      
      // If we're still over target, trim by lowest score overall but protect planeswalkers
      if (trimmed.length > targetSize) {
        const planeswalkers = trimmed.filter(card => (card.type_line || '').toLowerCase().includes('planeswalker'));
        const nonPlaneswalkers = trimmed.filter(card => !(card.type_line || '').toLowerCase().includes('planeswalker'));
        
        // Sort non-planeswalkers by score and trim them if needed
        const sortedNonPW = nonPlaneswalkers.sort((a, b) => b.finalScore - a.finalScore);
        const targetNonPW = Math.max(0, targetSize - planeswalkers.length);
        const keptNonPW = sortedNonPW.slice(0, targetNonPW);
        
        const finalTrimmed = [...planeswalkers, ...keptNonPW];
        this.log(`✂️ Final trim from ${trimmed.length} to ${finalTrimmed.length} cards (protected ${planeswalkers.length} planeswalkers)`);
        return finalTrimmed;
      }
      
      this.log(`✂️ Proportionally trimmed deck from ${cards.length} to ${trimmed.length} cards`);
      return trimmed;
    }
    
    // Too few cards - we'll fill in step 8
    this.log(`📊 Deck has ${cards.length} cards, need ${targetSize - cards.length} more`);
    return cards;
  }

  /**
   * STEP 8: Fill empty slots with cards with synergy with the commander
   * Add more synergy cards to reach exactly 64 non-land cards
   */
  private async step8_FillWithSynergy(
    currentDeck: ScoredCard[], 
    commander: ScryfallCard, 
    allScoredCards: ScoredCard[],
    constraints: GenerationConstraints
  ): Promise<ScoredCard[]> {
    const targetSize = 72; // Target 72 total cards
    const currentSize = currentDeck.length;
    
    if (currentSize >= targetSize) {
      return currentDeck.slice(0, targetSize);
    }
    
    const needed = targetSize - currentSize;
    this.log(`🎯 Need ${needed} more cards to reach ${targetSize} total`);
    
    // Count current cards by type to maintain proportions
    const currentByType: Record<string, number> = {
      creatures: 0,
      artifacts: 0,
      enchantments: 0,
      instants: 0,
      sorceries: 0,
      planeswalkers: 0
    };
    
    for (const card of currentDeck) {
      const type = (card.type_line || '').toLowerCase();
      if (type.includes('creature')) currentByType.creatures++;
      else if (type.includes('artifact')) currentByType.artifacts++;
      else if (type.includes('enchantment')) currentByType.enchantments++;
      else if (type.includes('instant')) currentByType.instants++;
      else if (type.includes('sorcery')) currentByType.sorceries++;
      else if (type.includes('planeswalker')) currentByType.planeswalkers++;
    }
    
    const weights = constraints.card_type_weights || {
      creatures: 5,
      artifacts: 5,
      enchantments: 5,
      instants: 5,
      sorceries: 5,
      planeswalkers: 1
    };
    
    // Calculate total weight (excluding planeswalkers)
    const totalWeight = weights.creatures + weights.artifacts + weights.enchantments + 
                        weights.instants + weights.sorceries;
    
    // Calculate ideal targets for each type
    const idealTargets: Record<string, number> = {
      creatures: Math.round((weights.creatures / totalWeight) * targetSize),
      artifacts: Math.round((weights.artifacts / totalWeight) * targetSize),
      enchantments: Math.round((weights.enchantments / totalWeight) * targetSize),
      instants: Math.round((weights.instants / totalWeight) * targetSize),
      sorceries: Math.round((weights.sorceries / totalWeight) * targetSize),
      planeswalkers: weights.planeswalkers // Exact count for planeswalkers
    };
    
    // Calculate how many more of each type we need
    const neededByType: Record<string, number> = {
      creatures: Math.max(0, idealTargets.creatures - currentByType.creatures),
      artifacts: Math.max(0, idealTargets.artifacts - currentByType.artifacts),
      enchantments: Math.max(0, idealTargets.enchantments - currentByType.enchantments),
      instants: Math.max(0, idealTargets.instants - currentByType.instants),
      sorceries: Math.max(0, idealTargets.sorceries - currentByType.sorceries),
      planeswalkers: Math.max(0, idealTargets.planeswalkers - currentByType.planeswalkers)
    };
    
    this.log(`📊 STEP8 Current distribution:`, currentByType);
    this.log(`📊 STEP8 Ideal targets:`, idealTargets);
    this.log(`📊 STEP8 Needed by type:`, neededByType);
    
    // Get unused cards and group by type
    const usedCardNames = new Set(currentDeck.map(card => card.name));
    const availableByType: Record<string, ScoredCard[]> = {
      creatures: [],
      artifacts: [],
      enchantments: [],
      instants: [],
      sorceries: [],
      planeswalkers: []
    };
    
    const maxPrice = constraints.max_card_price ?? 50;
    for (const card of allScoredCards) {
      if (usedCardNames.has(card.name)) continue;
      // Skip cards that are already known to be over budget
      const cardPrice = extractCardPrice(card, constraints.prefer_cheapest ?? false);
      if (cardPrice > maxPrice) continue;

      const type = (card.type_line || '').toLowerCase();
      if (type.includes('creature')) availableByType.creatures.push(card);
      else if (type.includes('artifact')) availableByType.artifacts.push(card);
      else if (type.includes('enchantment')) availableByType.enchantments.push(card);
      else if (type.includes('instant')) availableByType.instants.push(card);
      else if (type.includes('sorcery')) availableByType.sorceries.push(card);
      else if (type.includes('planeswalker')) availableByType.planeswalkers.push(card);
    }
    
    // Sort each type by synergy score
    for (const typeCards of Object.values(availableByType)) {
      typeCards.sort((a, b) => b.finalScore - a.finalScore);
    }
    
    // Add cards according to needed proportions
    const toAdd: ScoredCard[] = [];
    
    for (const [typeName, needCount] of Object.entries(neededByType)) {
      if (needCount > 0) {
        const available = availableByType[typeName];
        const cardsToAdd = available.slice(0, needCount);
        toAdd.push(...cardsToAdd);
        this.log(`🎯 Adding ${cardsToAdd.length} ${typeName}s (needed ${needCount})`);
      }
    }
    
    // If we still need more cards after filling proportional needs, add highest synergy cards
    if (toAdd.length < needed) {
      const remainingNeeded = needed - toAdd.length;
      const allAvailable = Object.values(availableByType).flat()
        .filter(card => !toAdd.includes(card))
        .sort((a, b) => b.finalScore - a.finalScore);
      
      const additionalCards = allAvailable.slice(0, remainingNeeded);
      toAdd.push(...additionalCards);
      
      if (additionalCards.length > 0) {
        this.log(`🎯 Adding ${additionalCards.length} additional high-synergy cards`);
      }
      
      // If we STILL can't reach the target (colorless commander issue), log a warning
      if (toAdd.length < needed) {
        const shortfall = needed - toAdd.length;
        console.warn(`⚠️ WARNING: Only found ${toAdd.length} cards to add, needed ${needed}. Short by ${shortfall} cards.`);
        console.warn(`⚠️ This typically happens with colorless commanders due to limited card pool.`);
        this.log(`📊 Available cards by type:`, Object.entries(availableByType).map(([type, cards]) => `${type}: ${cards.length}`));
      }
    }
    
    this.log(`🎯 Total adding ${toAdd.length} cards to reach target (attempted ${targetSize}, actual will be ${currentDeck.length + toAdd.length})`);
    
    return [...currentDeck, ...toAdd];
  }

  /**
   * Detect which creature types the commander specifically cares about
   */
  private detectCommanderTribalBonuses(commander: ScryfallCard): string[] {
    const commanderText = (commander.oracle_text || '').toLowerCase();
    const commanderName = commander.name.toLowerCase();
    const tribalTypes: string[] = [];
    
    // Voja specifically cares about Elves and Wolves
    if (commanderName.includes('voja')) {
      tribalTypes.push('elf', 'wolf');
      this.log(`🎯 TRIBAL: Voja detected - boosting Elves and Wolves heavily`);
      return tribalTypes;
    }
    
    // Generic detection for other commanders
    const creatureTypes = [
      'angel', 'demon', 'dragon', 'beast', 'goblin', 'elf', 'human', 'zombie', 
      'vampire', 'soldier', 'knight', 'warrior', 'wizard', 'cleric', 'rogue',
      'wolf', 'cat', 'bird', 'snake', 'spider', 'treefolk', 'elemental',
      'spirit', 'artifact', 'construct', 'thopter'
    ];
    
    for (const type of creatureTypes) {
      // Look for explicit tribal text like "wolves you control" or "each wolf"
      if (commanderText.includes(`${type}s you control`) || 
          commanderText.includes(`each ${type}`) ||
          commanderText.includes(`other ${type}s`) ||
          commanderText.includes(`${type} creatures`)) {
        tribalTypes.push(type);
        this.log(`🎯 TRIBAL: ${commander.name} detected tribal bonus for ${type}`);
      }
    }
    
    return tribalTypes;
  }

  // Helper methods
  private findSharedKeywords(text1: string, text2: string): string[] {
    const keywords = [
      'flying', 'trample', 'haste', 'vigilance', 'lifelink', 'deathtouch', 
      'first strike', 'double strike', 'hexproof', 'menace', 'reach',
      'enters', 'leaves', 'exile', 'token', 'sacrifice', 'destroy'
    ];
    return keywords.filter(keyword => text1.includes(keyword) && text2.includes(keyword));
  }

  private areSimilarCards(card1: ScryfallCard, card2: ScryfallCard): boolean {
    // Check if cards have similar function based on type and text
    const type1 = card1.type_line.toLowerCase();
    const type2 = card2.type_line.toLowerCase();
    const text1 = (card1.oracle_text || '').toLowerCase();
    const text2 = (card2.oracle_text || '').toLowerCase();
    
    // Same primary type
    const types = ['creature', 'artifact', 'enchantment', 'instant', 'sorcery', 'planeswalker'];
    const primaryType1 = types.find(t => type1.includes(t));
    const primaryType2 = types.find(t => type2.includes(t));
    
    if (primaryType1 !== primaryType2) return false;
    
    // Similar function keywords
    const functions = ['draw', 'destroy', 'counter', 'search', 'exile', 'create', 'add', 'mana'];
    const sharedFunctions = functions.filter(fn => text1.includes(fn) && text2.includes(fn));
    
    return sharedFunctions.length >= 1;
  }

  private async generateBasicLands(commander: ScryfallCard, nonLandCards: DeckCard[], targetCount: number = 35, existingLands: DeckCard[] = []): Promise<DeckCard[]> {
    const lands: DeckCard[] = [];
    const colorIdentity = commander.color_identity;
    
    // Add Command Tower if multicolored and not already present
    const hasCommandTower = existingLands.some(land => land.name === 'Command Tower');
    if (colorIdentity.length > 1 && !hasCommandTower) {
      lands.push({
        id: 'command-tower',
        name: 'Command Tower',
        mana_cost: '',
        cmc: 0,
        type_line: 'Land',
        oracle_text: '{T}: Add one mana of any color in your commander\'s color identity.',
        colors: [],
        color_identity: [],
        legalities: { commander: 'legal' },
        set: 'cmd',
        rarity: 'common',
        prices: { usd: '1.00' },
        quantity: 1,
        role: 'land',
        tags: [],
        price_used: 1.00,
        price_source: 'fixed-estimate'
      } as DeckCard);
      this.log(`🏔️ LAND: Added Command Tower`);
    } else if (hasCommandTower) {
      this.log(`🏔️ LAND: Command Tower already exists, skipping`);
    }
    
    // Analyze actual color requirements from the deck
    const colorRequirements = this.analyzeColorRequirements([...nonLandCards, commander as unknown as DeckCard]);
    const totalColorSymbols = Object.values(colorRequirements).reduce((sum, count) => sum + count, 0);
    
    this.log(`🏔️ MANA: Color requirements:`, colorRequirements, `(total: ${totalColorSymbols})`);
    
    // Use the provided target count
    const landCount = Math.max(0, targetCount);
    const availableLandSlots = landCount - lands.length;
    
    const basicLandNames: Record<string, string> = {
      'W': 'Plains',
      'U': 'Island', 
      'B': 'Swamp',
      'R': 'Mountain',
      'G': 'Forest'
    };
    
    // Special handling for colorless commanders
    if (colorIdentity.length === 0) {
      this.log(`🏔️ COLORLESS: Generating ${availableLandSlots} Wastes for colorless commander`);
      for (let i = 0; i < availableLandSlots; i++) {
        lands.push(this.createBasicLand('Wastes', 'C'));
      }
    }
    // If no colored mana symbols, fall back to even distribution
    else if (totalColorSymbols === 0) {
      const landsPerColor = Math.floor(availableLandSlots / colorIdentity.length);
      for (const color of colorIdentity) {
        const landName = basicLandNames[color];
        if (landName) {
          for (let i = 0; i < landsPerColor; i++) {
            lands.push(this.createBasicLand(landName, color));
          }
        }
      }
    } else {
      // Distribute based on actual color requirements
      for (const color of colorIdentity) {
        const colorCount = colorRequirements[color] || 0;
        const proportion = colorCount / totalColorSymbols;
        const landsForColor = Math.round(proportion * availableLandSlots);
        
        this.log(`🏔️ MANA: ${color} needs ${colorCount} symbols (${(proportion * 100).toFixed(1)}%) -> ${landsForColor} lands`);
        
        const landName = basicLandNames[color];
        if (landName) {
          for (let i = 0; i < landsForColor; i++) {
            lands.push(this.createBasicLand(landName, color));
          }
        }
      }
    }
    
    return lands;
  }
  
  /**
   * Analyze the actual color requirements from mana costs in the deck
   */
  private analyzeColorRequirements(cards: DeckCard[]): Record<string, number> {
    const colorCounts: Record<string, number> = {
      'W': 0,
      'U': 0,
      'B': 0,
      'R': 0,
      'G': 0
    };
    
    for (const card of cards) {
      const manaCost = card.mana_cost || '';
      
      // Count colored mana symbols (including devotion/hybrid costs)
      const matches = manaCost.match(/\{[WUBRG]\}/g) || [];
      for (const match of matches) {
        const color = match.charAt(1); // Extract W, U, B, R, or G
        if (colorCounts[color] !== undefined) {
          colorCounts[color]++;
        }
      }
      
      // Also count hybrid mana (e.g., {W/G})
      const hybridMatches = manaCost.match(/\{[WUBRG]\/[WUBRG]\}/g) || [];
      for (const hybridMatch of hybridMatches) {
        const colors = hybridMatch.match(/[WUBRG]/g) || [];
        // For hybrid, count 0.5 for each color (we'll round later)
        for (const color of colors) {
          if (colorCounts[color] !== undefined) {
            colorCounts[color] += 0.5;
          }
        }
      }
    }
    
    // Round the hybrid contributions
    for (const color in colorCounts) {
      colorCounts[color] = Math.round(colorCounts[color]);
    }
    
    return colorCounts;
  }
  
  /**
   * Create a basic land card
   */
  private createBasicLand(landName: string, color: string): DeckCard {
    const land = {
      id: `${landName.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: landName,
      mana_cost: '',
      cmc: 0,
      type_line: 'Basic Land',
      oracle_text: `({T}: Add {${color.toLowerCase()}}.})`,
      colors: [],
      color_identity: [],
      legalities: { commander: 'legal' },
      set: 'basic',
      rarity: 'common', 
      prices: { usd: '0.25' },
      quantity: 1,
      role: 'land',
      tags: [],
      price_used: 0.25,
      price_source: 'fixed-estimate'
    } as DeckCard;
    return land;
  }

  private calculateTotalPrice(cards: DeckCard[], constraints: GenerationConstraints): number {
    return cards.reduce((total, card) => {
      const price = extractCardPrice(card, constraints.prefer_cheapest);
      return total + price;
    }, 0);
  }

  /**
   * Calculate synergy bonus for cards that benefit from commander's cost reduction effects
   */
  private calculateCostReductionSynergy(card: ScryfallCard, commander: ScryfallCard, cardText: string, commanderText: string): number {
    let synergy = 0;
    
    // Extract what the commander makes cheaper
    const costReductionTargets = this.extractCommanderCostReductionTargets(commanderText);
    
    for (const target of costReductionTargets) {
      // Check if this card matches the cost reduction target
      if (this.cardMatchesCostReductionTarget(card, target, cardText)) {
        // Heavy synergy bonus for cards that directly benefit from cost reduction
        synergy += 20;
        this.log(`💰 DIRECT BENEFIT: ${card.name} benefits from ${commander.name}'s ${target} cost reduction`);
      }
    }
    
    return synergy;
  }

  /**
   * Extract what types of cards the commander makes cheaper
   */
  private extractCommanderCostReductionTargets(commanderText: string): string[] {
    const targets: string[] = [];
    
    // Specific creature types (e.g., "Hydra spells cost {4} less")
    const creatureTypePattern = /(\w+)\s+(?:spells?|creatures?)\s+(?:you cast\s+)?cost.*less/gi;
    let match;
    while ((match = creatureTypePattern.exec(commanderText)) !== null) {
      const creatureType = match[1].toLowerCase();
      if (!targets.includes(creatureType)) {
        targets.push(creatureType);
      }
    }
    
    // Specific card types
    if (/artifact\s+(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i.test(commanderText)) {
      targets.push('artifact');
    }
    if (/enchantment\s+(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i.test(commanderText)) {
      targets.push('enchantment');
    }
    if (/instant\s+(?:and\s+sorcery\s+)?(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i.test(commanderText)) {
      targets.push('instant', 'sorcery');
    }
    if (/creature\s+(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i.test(commanderText)) {
      targets.push('creature');
    }
    if (/planeswalker\s+(?:spells?|cards?)\s+(?:you cast\s+)?cost.*less/i.test(commanderText)) {
      targets.push('planeswalker');
    }
    
    return targets;
  }

  /**
   * Check if a card matches a cost reduction target
   */
  private cardMatchesCostReductionTarget(card: ScryfallCard, target: string, cardText: string): boolean {
    const cardTypeLine = (card.type_line || '').toLowerCase();
    const cardName = card.name.toLowerCase();
    
    // Check for creature type matches (e.g., "hydra" matches Hydra creatures)
    if (cardTypeLine.includes('creature') && cardTypeLine.includes(target)) {
      return true;
    }
    
    // Check for card type matches
    if (cardTypeLine.includes(target)) {
      return true;
    }
    
    // Special case for instant/sorcery cost reduction
    if ((target === 'instant' || target === 'sorcery') && 
        (cardTypeLine.includes('instant') || cardTypeLine.includes('sorcery'))) {
      return true;
    }
    
    return false;
  }

  /**
   * Calculate penalty for cards that require revealing or having specific creature types that aren't supported
   */
  private calculateConditionalRevealPenalty(card: ScryfallCard, commander: ScryfallCard, cardText: string, commanderText: string): number {
    let penalty = 0;
    
    // Extract what creature types the commander and deck strategy support
    const supportedTypes = this.extractSupportedCreatureTypes(commander, commanderText);
    
    // Extract what creature types this card requires
    const requiredTypes = this.extractRequiredCreatureTypes(cardText);
    
    // Penalize if the card requires types that aren't supported
    for (const requiredType of requiredTypes) {
      if (!supportedTypes.includes(requiredType)) {
        penalty += 20; // Heavy penalty for unsupported conditional requirements
        this.log(`🚫 UNSUPPORTED REQUIREMENT: ${card.name} requires ${requiredType} but deck supports ${supportedTypes.join(', ')}`);
      }
    }
    
    return penalty;
  }

  /**
   * Extract creature types that the commander and strategy support
   */
  private extractSupportedCreatureTypes(commander: ScryfallCard, commanderText: string): string[] {
    const supportedTypes: string[] = [];
    const commanderTypeLine = (commander.type_line || '').toLowerCase();
    const commanderName = commander.name.toLowerCase();
    
    // Add commander's own creature types
    const creatureTypes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit',
      'wizard', 'warrior', 'soldier', 'beast', 'cat', 'vampire', 'merfolk', 'elemental', 'giant', 
      'dwarf', 'orc', 'treefolk', 'spider', 'snake', 'bird', 'fish', 'wolf', 'bear', 'elephant', 
      'horse', 'minotaur', 'hydra'];
    
    for (const type of creatureTypes) {
      if (commanderTypeLine.includes(type)) {
        supportedTypes.push(type);
      }
    }
    
    // Add types mentioned in commander text or that the commander cares about
    for (const type of creatureTypes) {
      if (commanderText.includes(type)) {
        supportedTypes.push(type);
      }
    }
    
    // Special case mappings
    if (commanderName.includes('gargos')) {
      supportedTypes.push('hydra'); // Gargos specifically cares about Hydras
    }
    
    return [...new Set(supportedTypes)]; // Remove duplicates
  }

  /**
   * Extract creature types that a card requires for optimal function
   */
  private extractRequiredCreatureTypes(cardText: string): string[] {
    const requiredTypes: string[] = [];
    
    // Pattern: "reveal a [CreatureType] card" or "reveal [CreatureType] cards"
    const revealPattern = /reveal.*?(\w+)\s+(?:card|creature)/gi;
    let match;
    while ((match = revealPattern.exec(cardText)) !== null) {
      const potentialType = match[1].toLowerCase();
      // Check if it's a known creature type
      const creatureTypes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit',
        'wizard', 'warrior', 'soldier', 'beast', 'cat', 'vampire', 'merfolk', 'elemental', 'giant', 
        'dwarf', 'orc', 'treefolk', 'spider', 'snake', 'bird', 'fish', 'wolf', 'bear', 'elephant', 
        'horse', 'minotaur', 'hydra'];
      
      if (creatureTypes.includes(potentialType)) {
        requiredTypes.push(potentialType);
      }
    }
    
    // Pattern: "as long as you control a [CreatureType]" 
    const controlPattern = /as long as you control.*?(\w+)/gi;
    while ((match = controlPattern.exec(cardText)) !== null) {
      const potentialType = match[1].toLowerCase();
      const creatureTypes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'spirit',
        'wizard', 'warrior', 'soldier', 'beast', 'cat', 'vampire', 'merfolk', 'elemental', 'giant', 
        'dwarf', 'orc', 'treefolk', 'spider', 'snake', 'bird', 'fish', 'wolf', 'bear', 'elephant', 
        'horse', 'minotaur', 'hydra'];
      
      if (creatureTypes.includes(potentialType)) {
        requiredTypes.push(potentialType);
      }
    }
    
    return [...new Set(requiredTypes)]; // Remove duplicates
  }

  /**
   * 🎲 Spice Level: How weird do you want this deck?
   * 0 = "Play it safe"  →  10 = "Maximum chaos"
   * Pulls real themes from EDHREC first; falls back to curated spicy mechanics.
   */
  private async addRandomizedTags(constraints: GenerationConstraints, commanderName?: string): Promise<void> {
    const spiceLevel = constraints.random_tag_count ?? 0;
    if (spiceLevel === 0) return;

    // Curated fallback list of spicy Commander mechanics
    const SPICY_MECHANICS = [
      'tokens','graveyard','draw','ramp','removal','counters','+1/+1 counters',
      'tribal','artifacts','enchantments','sacrifice','lifegain','lifelink',
      'flying','trample','haste','deathtouch','vigilance','hexproof',
      'mill','reanimator','combo','aggro','control','storm','voltron',
      'landfall','spellslinger','treasure','food','clue','blood','energy',
      'proliferate','infect','anthem','aura','equipment','recursion',
      'flicker','blink','copy','steal','chaos','politics','group-hug',
    ];

    let themePool: string[] = [];

    // Try EDHREC first for commander-specific themes
    if (commanderName) {
      try {
        const edhrecThemes = await edhrecClient.getCommanderThemes(commanderName);
        if (edhrecThemes.length > 0) {
          themePool = edhrecThemes.map(t => t.name);
          this.log(`🎲 Loaded ${themePool.length} EDHREC themes for ${commanderName}`);
        }
      } catch {
        // EDHREC unavailable — fall back to curated list
      }
    }

    // Fall back to curated spicy mechanics if EDHREC returned nothing
    if (themePool.length === 0) {
      themePool = SPICY_MECHANICS;
    }

    // Higher spice level → pick more themes and weight toward unusual picks
    const shuffled = [...themePool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(spiceLevel, shuffled.length));

    constraints.random_tags = selected;
    constraints.keywords = [...(constraints.keywords || []), ...selected];
    console.log(`🌶️ Spice level ${spiceLevel}/10 — added ${selected.length} themes: ${selected.join(', ')}`);
  }
}

export const newDeckGenerator = new NewDeckGenerator();
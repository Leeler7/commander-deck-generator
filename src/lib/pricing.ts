import { ScryfallCard, DeckCard, GenerationConstraints } from './types';
import { extractCardPriceEnhanced, extractBatchCardPrices } from './mtgjson-pricing';
import { fetchScryfallPrice } from './scryfall-pricing';

// Re-export the enhanced pricing functions for convenience
export { extractBatchCardPrices } from './mtgjson-pricing';

export interface PriceAnalysis {
  card: ScryfallCard;
  price: number;
  print_used: 'cheapest' | 'preferred';
  available_prints?: { price: number; set: string }[];
}

export interface BudgetFitResult {
  cards: DeckCard[];
  total_cost: number;
  over_budget: boolean;
  excluded_cards: { card: ScryfallCard; reason: string; suggested_replacement?: ScryfallCard }[];
  budget_breakdown: {
    commander: number;
    lands: number;
    nonlands: number;
  };
}

export function extractCardPrice(card: ScryfallCard, preferCheapest = false): number {
  const usdPrice = card.prices?.usd;
  const usdFoilPrice = card.prices?.usd_foil;
  
  if (!usdPrice && !usdFoilPrice) {
    // Return reasonable estimate for missing price data based on rarity
    console.log(`⚠️ No price data for ${card.name} - using rarity-based estimate`);
    
    // Rarity-based price estimates (conservative estimates)
    switch (card.rarity?.toLowerCase()) {
      case 'mythic': return 5.00;
      case 'rare': return 1.50;
      case 'uncommon': return 0.25;
      case 'common': return 0.10;
      default: return 0.50; // Unknown rarity fallback
    }
  }
  
  const prices = [usdPrice, usdFoilPrice]
    .filter((price): price is string => price !== null && price !== undefined)
    .map(price => parseFloat(price))
    .filter(price => !isNaN(price) && price > 0);
  
  if (prices.length === 0) {
    // Even if we have price objects but they're all null/invalid, use rarity estimates
    switch (card.rarity?.toLowerCase()) {
      case 'mythic': return 5.00;
      case 'rare': return 1.50;
      case 'uncommon': return 0.25;
      case 'common': return 0.10;
      default: return 0.50;
    }
  }
  
  return preferCheapest ? Math.min(...prices) : prices[0];
}

// Enhanced version that uses MTGJSON pricing first, falls back to Scryfall API
export async function extractCardPriceWithSource(
  card: ScryfallCard, 
  preferCheapest = false
): Promise<{ price: number; source: string }> {
  try {
    // Try MTGJSON first
    const mtgjsonResult = await extractCardPriceEnhanced(card, preferCheapest, 'tcgplayer');
    if (mtgjsonResult.price > 0) {
      return mtgjsonResult;
    }
  } catch (error) {
    console.log(`MTGJSON price fetch failed for ${card.name}, trying Scryfall API...`);
  }
  
  // Try Scryfall API if MTGJSON fails or returns 0
  try {
    const scryfallPrice = await fetchScryfallPrice(card, preferCheapest);
    if (scryfallPrice > 0) {
      return { price: scryfallPrice, source: 'Scryfall-API' };
    }
  } catch (error) {
    console.error(`Scryfall API price fetch failed for ${card.name}:`, error);
  }
  
  // Fall back to local Scryfall data
  const localPrice = extractCardPrice(card, preferCheapest);
  return { price: localPrice, source: 'Scryfall-local' };
}

export async function findCheapestPrinting(
  cardName: string,
  scryfallClient: any
): Promise<{ card: ScryfallCard; price: number }> {
  try {
    // Search for all printings of this card
    const searchResponse = await scryfallClient.searchCards(`!"${cardName}" unique:prints`);
    
    if (!searchResponse.data || searchResponse.data.length === 0) {
      throw new Error(`No printings found for ${cardName}`);
    }
    
    // Find the cheapest printing
    let cheapestCard = searchResponse.data[0];
    let cheapestPrice = extractCardPrice(cheapestCard, true);
    
    for (const printing of searchResponse.data) {
      const price = extractCardPrice(printing, true);
      if (price > 0 && (cheapestPrice === 0 || price < cheapestPrice)) {
        cheapestCard = printing;
        cheapestPrice = price;
      }
    }
    
    return {
      card: cheapestCard,
      price: cheapestPrice
    };
  } catch (error) {
    console.error(`Error finding cheapest printing for ${cardName}:`, error);
    throw error;
  }
}

export function sortCardsByBudgetPriority(
  cards: ScryfallCard[],
  commander: ScryfallCard,
  constraints: GenerationConstraints
): ScryfallCard[] {
  return cards.sort((a, b) => {
    const priceA = extractCardPrice(a, constraints.prefer_cheapest);
    const priceB = extractCardPrice(b, constraints.prefer_cheapest);
    
    // Prioritize cards that fit within per-card budget
    const aFitsPerCard = priceA <= constraints.per_card_cap;
    const bFitsPerCard = priceB <= constraints.per_card_cap;
    
    if (aFitsPerCard && !bFitsPerCard) return -1;
    if (!aFitsPerCard && bFitsPerCard) return 1;
    
    // If both fit or both don't fit, prioritize by EDHREC rank (lower is better)
    const rankA = a.edhrec_rank || 999999;
    const rankB = b.edhrec_rank || 999999;
    
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    
    // Finally, sort by price (cheaper first)
    return priceA - priceB;
  });
}

export async function fitCardsIntoBudget(
  candidateCards: ScryfallCard[],
  commander: ScryfallCard,
  targetRoles: Record<string, number>,
  constraints: GenerationConstraints
): Promise<BudgetFitResult> {
  const result: BudgetFitResult = {
    cards: [],
    total_cost: 0,
    over_budget: false,
    excluded_cards: [],
    budget_breakdown: {
      commander: 0,
      lands: 0,
      nonlands: 0
    }
  };
  
  // Start with commander cost using enhanced pricing
  const commanderPricing = await extractCardPriceWithSource(commander, constraints.prefer_cheapest);
  result.budget_breakdown.commander = commanderPricing.price;
  result.total_cost += commanderPricing.price;
  
  // Sort candidates by budget priority
  const sortedCandidates = sortCardsByBudgetPriority(candidateCards, commander, constraints);
  
  // Track role quotas
  const roleCount: Record<string, number> = {};
  const roleTargets = { ...targetRoles };
  
  // Get batch pricing for all candidates for better performance
  console.log('🔍 Getting enhanced pricing for candidate cards...');
  const cardPricings = await extractBatchCardPrices(sortedCandidates, constraints.prefer_cheapest, 'tcgplayer');
  
  for (const { card, price, source } of cardPricings) {
    // Check per-card budget constraint
    if (price > constraints.per_card_cap) {
      result.excluded_cards.push({
        card,
        reason: `Exceeds per-card budget of $${constraints.per_card_cap} (costs $${price.toFixed(2)})`
      });
      continue;
    }
    
    // Check if adding this card would exceed total budget
    if (result.total_cost + price > constraints.total_budget) {
      // Try to find a cheaper alternative if we haven't filled this role quota
      const cardRole = determineCardRole(card);
      const currentRoleCount = roleCount[cardRole] || 0;
      const targetRoleCount = roleTargets[cardRole] || 0;
      
      if (currentRoleCount < targetRoleCount) {
        result.excluded_cards.push({
          card,
          reason: `Would exceed total budget of $${constraints.total_budget}`
        });
      }
      continue;
    }
    
    // Determine card role and check if we need more of this role
    const cardRole = determineCardRole(card);
    const currentRoleCount = roleCount[cardRole] || 0;
    const targetRoleCount = roleTargets[cardRole] || 0;
    
    if (currentRoleCount >= targetRoleCount) {
      // We have enough of this role, skip unless it's significantly better
      continue;
    }
    
    // Add the card with enhanced pricing information
    const deckCard: DeckCard = {
      ...card,
      quantity: 1,
      tags: [],
      role: cardRole as any,
      synergy_notes: generateSynergyNotes(card, commander),
      price_used: price,
      price_source: source
    };
    
    result.cards.push(deckCard);
    result.total_cost += price;
    roleCount[cardRole] = (roleCount[cardRole] || 0) + 1;
    
    // Update budget breakdown
    if (card.type_line.toLowerCase().includes('land')) {
      result.budget_breakdown.lands += price;
    } else {
      result.budget_breakdown.nonlands += price;
    }
  }
  
  result.over_budget = result.total_cost > constraints.total_budget;
  
  return result;
}

function determineCardRole(card: ScryfallCard): string {
  const text = (card.oracle_text || '').toLowerCase();
  const type = card.type_line.toLowerCase();
  const name = card.name.toLowerCase();
  
  if (type.includes('land')) return 'Land';
  
  // Ramp detection
  if (text.includes('add') && (text.includes('mana') || /\{[wubrg]\}/.test(text))) {
    return 'Ramp';
  }
  if (text.includes('search your library for a') && text.includes('land')) {
    return 'Ramp';
  }
  
  // Card draw detection
  if (text.includes('draw') && text.includes('card')) {
    return 'Draw/Advantage';
  }
  
  // Removal detection
  if (text.includes('destroy target') || text.includes('exile target')) {
    return 'Removal/Interaction';
  }
  
  // Board wipe detection
  if (text.includes('destroy all') || text.includes('exile all')) {
    return 'Board Wipe';
  }
  
  // Tutor detection
  if (text.includes('search your library for') && !text.includes('land')) {
    return 'Tutor';
  }
  
  return 'Synergy/Wincon';
}

function generateSynergyNotes(card: ScryfallCard, commander: ScryfallCard): string {
  const cardText = (card.oracle_text || '').toLowerCase();
  const commanderText = (commander.oracle_text || '').toLowerCase();
  const cardTypes = card.type_line.toLowerCase();
  const commanderTypes = commander.type_line.toLowerCase();
  
  const notes: string[] = [];
  
  // Check for tribal synergies
  const tribes = ['human', 'elf', 'goblin', 'zombie', 'dragon', 'angel', 'demon', 'beast', 'artifact'];
  for (const tribe of tribes) {
    if (commanderTypes.includes(tribe) && (cardText.includes(tribe) || cardTypes.includes(tribe))) {
      notes.push(`${tribe} tribal synergy`);
      break;
    }
  }
  
  // Check for keyword synergies
  const keywords = ['flying', 'trample', 'lifelink', 'deathtouch', 'haste', 'vigilance'];
  for (const keyword of keywords) {
    if (commanderText.includes(keyword) && cardText.includes(keyword)) {
      notes.push(`${keyword} synergy`);
    }
  }
  
  // Check for +1/+1 counter synergies
  if (commanderText.includes('+1/+1') && cardText.includes('+1/+1')) {
    notes.push('+1/+1 counter synergy');
  }
  
  // Check for artifact synergies
  if (commanderText.includes('artifact') && (cardTypes.includes('artifact') || cardText.includes('artifact'))) {
    notes.push('artifact synergy');
  }
  
  // Check for graveyard synergies
  if (commanderText.includes('graveyard') && cardText.includes('graveyard')) {
    notes.push('graveyard synergy');
  }
  
  // Default role-based note
  if (notes.length === 0) {
    const role = determineCardRole(card);
    notes.push(`${role.toLowerCase()} support`);
  }
  
  return notes.join(', ');
}

export function calculatePriceTrends(cards: DeckCard[]): {
  average_price: number;
  median_price: number;
  price_distribution: { range: string; count: number }[];
  most_expensive: DeckCard[];
} {
  const prices = cards.map(card => card.price_used).sort((a, b) => a - b);
  const total = prices.reduce((sum, price) => sum + price, 0);
  
  const average_price = total / prices.length;
  const median_price = prices.length % 2 === 0
    ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
    : prices[Math.floor(prices.length / 2)];
  
  // Price distribution
  const ranges = [
    { min: 0, max: 1, label: '$0-1' },
    { min: 1, max: 5, label: '$1-5' },
    { min: 5, max: 10, label: '$5-10' },
    { min: 10, max: 25, label: '$10-25' },
    { min: 25, max: 50, label: '$25-50' },
    { min: 50, max: Infinity, label: '$50+' }
  ];
  
  const price_distribution = ranges.map(range => ({
    range: range.label,
    count: prices.filter(price => price >= range.min && price < range.max).length
  }));
  
  // Most expensive cards (top 5)
  const most_expensive = cards
    .sort((a, b) => b.price_used - a.price_used)
    .slice(0, 5);
  
  return {
    average_price,
    median_price,
    price_distribution,
    most_expensive
  };
}
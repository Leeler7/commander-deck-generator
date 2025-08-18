import { ScryfallCard } from './types';

// Tribe size classifications based on typical card pools
const TRIBE_SIZES: Record<string, 'common' | 'uncommon' | 'rare' | 'mythic'> = {
  // Common tribes (100+ creatures typically)
  'human': 'common',
  'elf': 'common',
  'goblin': 'common',
  'zombie': 'common',
  'soldier': 'common',
  'wizard': 'common',
  'warrior': 'common',
  'spirit': 'common',
  'beast': 'common',
  'artifact': 'common', // Artifact creatures
  
  // Uncommon tribes (50-100 creatures)
  'vampire': 'uncommon',
  'dragon': 'uncommon',
  'angel': 'uncommon',
  'demon': 'uncommon',
  'merfolk': 'uncommon',
  'knight': 'uncommon',
  'cleric': 'uncommon',
  'rogue': 'uncommon',
  'shaman': 'uncommon',
  'elemental': 'uncommon',
  'bird': 'uncommon',
  'cat': 'uncommon',
  'wolf': 'uncommon',
  'snake': 'uncommon',
  'fungus': 'uncommon',
  'saproling': 'uncommon',
  
  // Rare tribes (20-50 creatures)
  'faerie': 'rare',
  'sphinx': 'rare',
  'giant': 'rare',
  'treefolk': 'rare',
  'hydra': 'rare',
  'phoenix': 'rare',
  'minotaur': 'rare',
  'satyr': 'rare',
  'spider': 'rare',
  'dinosaur': 'rare',
  'pirate': 'rare',
  'ninja': 'rare',
  'samurai': 'rare',
  
  // Mythic tribes (under 20 creatures)
  'elder': 'mythic',
  'praetor': 'mythic',
  'god': 'mythic',
  'avatar': 'mythic',
  'archon': 'mythic',
  'kraken': 'mythic',
  'leviathan': 'mythic',
  'whale': 'mythic',
  'octopus': 'mythic',
  'crab': 'mythic',
  'scarecrow': 'mythic',
  'myr': 'mythic',
  'sliver': 'mythic',
  'ally': 'mythic'
};

// Dynamic bonus calculation based on tribe rarity
export function calculateTribalBonus(
  tribalType: string,
  availableCreatures: number = 0
): { baseBonus: number; doubleBonus: number; threshold: number } {
  const tribeSize = TRIBE_SIZES[tribalType.toLowerCase()] || 'uncommon';
  
  // If we know the actual available creature count, use that for more accurate scoring
  let adjustedSize = tribeSize;
  if (availableCreatures > 0) {
    if (availableCreatures >= 100) adjustedSize = 'common';
    else if (availableCreatures >= 50) adjustedSize = 'uncommon';
    else if (availableCreatures >= 20) adjustedSize = 'rare';
    else adjustedSize = 'mythic';
  }
  
  switch (adjustedSize) {
    case 'common':
      // Common tribes need higher bonuses to stand out from the large pool
      return {
        baseBonus: 120,
        doubleBonus: 50,
        threshold: 50 // High threshold since many will qualify
      };
      
    case 'uncommon':
      // Balanced bonuses for medium-sized tribes
      return {
        baseBonus: 100,
        doubleBonus: 40,
        threshold: 40
      };
      
    case 'rare':
      // Lower bonuses but lower threshold for smaller tribes
      return {
        baseBonus: 80,
        doubleBonus: 30,
        threshold: 30
      };
      
    case 'mythic':
      // Minimal bonuses for very rare tribes, but very low threshold
      return {
        baseBonus: 60,
        doubleBonus: 20,
        threshold: 20
      };
      
    default:
      return {
        baseBonus: 100,
        doubleBonus: 40,
        threshold: 40
      };
  }
}

// Analyze available tribal creatures in a card pool
export function analyzeTribalPool(
  cards: ScryfallCard[],
  tribalType: string
): {
  count: number;
  quality: 'high' | 'medium' | 'low';
  suggestedBonus: { baseBonus: number; doubleBonus: number; threshold: number };
} {
  const tribalCreatures = cards.filter(card => {
    const typeLine = card.type_line.toLowerCase();
    const isCreature = typeLine.includes('creature');
    const hasType = typeLine.includes(tribalType.toLowerCase());
    return isCreature && hasType;
  });
  
  const count = tribalCreatures.length;
  
  // Assess quality based on rarity distribution and EDHREC ranks
  const avgEdhrecRank = tribalCreatures.reduce((sum, card) => {
    return sum + (card.edhrec_rank || 50000);
  }, 0) / (tribalCreatures.length || 1);
  
  let quality: 'high' | 'medium' | 'low';
  if (avgEdhrecRank < 10000) quality = 'high';
  else if (avgEdhrecRank < 30000) quality = 'medium';
  else quality = 'low';
  
  const suggestedBonus = calculateTribalBonus(tribalType, count);
  
  return {
    count,
    quality,
    suggestedBonus
  };
}

// Get tribal synergy score with dynamic thresholds
export function getDynamicTribalScore(
  card: ScryfallCard,
  tribalType: string,
  availableCount: number = 0
): number {
  const typeLine = card.type_line.toLowerCase();
  if (!typeLine.includes('creature') || !typeLine.includes(tribalType.toLowerCase())) {
    return 0;
  }
  
  const { baseBonus } = calculateTribalBonus(tribalType, availableCount);
  return baseBonus;
}

// Check if a commander is tribal and what type
export function detectTribalCommander(commander: ScryfallCard): string[] {
  const text = (commander.oracle_text || '').toLowerCase();
  const name = commander.name.toLowerCase();
  const types: string[] = [];
  
  // Check all known tribe types
  for (const tribe of Object.keys(TRIBE_SIZES)) {
    const tribePattern = new RegExp(`${tribe}s?\\s+(you\\s+control|creature|spell|card)`, 'i');
    const namePattern = new RegExp(`${tribe}`, 'i');
    
    if (tribePattern.test(text) || 
        text.includes(`${tribe} creatures`) ||
        text.includes(`other ${tribe}s`) ||
        text.includes(`${tribe}s you control`) ||
        (namePattern.test(name) && text.includes('creature'))) {
      types.push(tribe);
    }
  }
  
  // Special cases
  if (name.includes('voja')) {
    if (!types.includes('elf')) types.push('elf');
    if (!types.includes('wolf')) types.push('wolf');
  }
  
  if (name.includes('gargos')) {
    if (!types.includes('hydra')) types.push('hydra');
  }
  
  if (name.includes('slimefoot')) {
    if (!types.includes('saproling')) types.push('saproling');
    if (!types.includes('fungus')) types.push('fungus');
  }
  
  return types;
}
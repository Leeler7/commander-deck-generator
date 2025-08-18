'use client';

import { GeneratedDeck, DeckCard } from '@/lib/types';
import ManaCost from './ManaCost';

interface DeckAnalysisProps {
  deck: GeneratedDeck;
}

// Helper function to create Scryfall URL
const getScryfallUrl = (cardName: string): string => {
  return `https://scryfall.com/search?q=!"${encodeURIComponent(cardName)}"`;
};

// Helper function to extract subtypes from type line
const getSubtypes = (typeLine: string): string => {
  if (typeLine.includes('—')) {
    return typeLine.split('—')[1].trim();
  }
  return '';
};

interface TypeGroup {
  type: string;
  cards: DeckCard[];
  cardQuantities: CardQuantity[];
  count: number;
}

export default function DeckAnalysis({ deck }: DeckAnalysisProps) {
  const allCards = [deck.commander, ...deck.nonland_cards, ...deck.lands];
  
  // Group cards by primary type
  const groupedCards = groupCardsByType(allCards);
  
  // Calculate statistics
  const avgCmc = calculateAverageCMC(deck.nonland_cards);
  const colorDistribution = calculateColorDistribution(allCards);
  
  return (
    <div className="space-y-6">
      {/* Cards by Type */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cards by Type</h3>
        <div className="space-y-4">
          {groupedCards.map((group) => (
            <div key={group.type} className="border-b border-gray-100 pb-4 last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">
                  {group.type} ({group.count})
                </h4>
                <span className="text-sm text-gray-500">
                  {((group.count / allCards.length) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                {group.cardQuantities.map((cardQty, index) => (
                  <div key={`${cardQty.card.id}-${index}`} className="flex items-center justify-between">
                    <a 
                      href={getScryfallUrl(cardQty.card.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 hover:underline truncate"
                    >
                      {getSubtypes(cardQty.card.type_line) ? `${getSubtypes(cardQty.card.type_line)} - ` : ''}{cardQty.card.name} x{cardQty.quantity}
                    </a>
                    <ManaCost manaCost={cardQty.card.mana_cost} className="ml-2" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Deck Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mana Curve */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Mana Curve</h3>
          <ManaCurveChart cards={deck.nonland_cards} />
          <div className="mt-4 text-sm text-gray-600">
            <p>Average CMC: {avgCmc.toFixed(2)}</p>
            <p>Non-land cards: {deck.nonland_cards.length}</p>
          </div>
        </div>
        
        {/* Color Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Color Distribution</h3>
          <ColorDistributionChart distribution={colorDistribution} />
        </div>
      </div>
    </div>
  );
}

interface CardQuantity {
  card: DeckCard;
  quantity: number;
}

function groupCardsByType(cards: DeckCard[]): TypeGroup[] {
  const groups: { [key: string]: CardQuantity[] } = {};
  
  // First, count quantities of each card by name
  const cardCounts: { [name: string]: { card: DeckCard; count: number } } = {};
  cards.forEach(card => {
    if (cardCounts[card.name]) {
      cardCounts[card.name].count++;
    } else {
      cardCounts[card.name] = { card, count: 1 };
    }
  });
  
  // Then group by type
  Object.values(cardCounts).forEach(({ card, count }) => {
    let primaryType = 'Other';
    const typeLine = card.type_line.toLowerCase();
    
    if (typeLine.includes('land')) {
      primaryType = 'Lands';
    } else if (typeLine.includes('creature')) {
      primaryType = 'Creatures';
    } else if (typeLine.includes('instant')) {
      primaryType = 'Instants';
    } else if (typeLine.includes('sorcery')) {
      primaryType = 'Sorceries';
    } else if (typeLine.includes('artifact')) {
      primaryType = 'Artifacts';
    } else if (typeLine.includes('enchantment')) {
      primaryType = 'Enchantments';
    } else if (typeLine.includes('planeswalker')) {
      primaryType = 'Planeswalkers';
    }
    
    if (!groups[primaryType]) {
      groups[primaryType] = [];
    }
    groups[primaryType].push({ card, quantity: count });
  });
  
  // Sort groups by total count and convert to array
  return Object.entries(groups)
    .map(([type, cardQuantities]) => ({
      type,
      cards: cardQuantities
        .sort((a, b) => a.card.cmc - b.card.cmc) // Sort by CMC within type
        .map(cq => cq.card), // Convert back to DeckCard[] for compatibility
      cardQuantities, // Add quantities for display
      count: cardQuantities.reduce((sum, cq) => sum + cq.quantity, 0) // Total count including quantities
    }))
    .sort((a, b) => b.count - a.count); // Sort by count descending
}

function calculateAverageCMC(cards: DeckCard[]): number {
  if (cards.length === 0) return 0;
  const totalCmc = cards.reduce((sum, card) => sum + card.cmc, 0);
  return totalCmc / cards.length;
}

function calculateColorDistribution(cards: DeckCard[]): { [color: string]: number } {
  const distribution: { [color: string]: number } = {
    'W': 0, 'U': 0, 'B': 0, 'R': 0, 'G': 0, 'C': 0
  };
  
  cards.forEach(card => {
    if (card.color_identity.length === 0) {
      distribution['C']++;
    } else {
      card.color_identity.forEach(color => {
        distribution[color]++;
      });
    }
  });
  
  return distribution;
}

function ManaCurveChart({ cards }: { cards: DeckCard[] }) {
  const cmcCounts: { [cmc: number]: number } = {};
  const maxCmc = Math.max(...cards.map(c => c.cmc), 7);
  
  // Initialize all CMCs to 0
  for (let i = 0; i <= maxCmc; i++) {
    cmcCounts[i] = 0;
  }
  
  // Count cards by CMC
  cards.forEach(card => {
    const cmc = Math.min(card.cmc, 7); // Cap at 7+ for display
    cmcCounts[cmc]++;
  });
  
  const maxCount = Math.max(...Object.values(cmcCounts));
  
  return (
    <div className="space-y-2">
      {Object.entries(cmcCounts).map(([cmc, count]) => (
        <div key={cmc} className="flex items-center space-x-2">
          <div className="w-8 text-sm text-gray-600">{cmc === '7' ? '7+' : cmc}</div>
          <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
            <div 
              className="bg-blue-500 h-4 rounded-full transition-all duration-300"
              style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}
            />
            {count > 0 && (
              <span className="absolute inset-0 flex items-center justify-center text-xs text-white font-medium">
                {count}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ColorDistributionChart({ distribution }: { distribution: { [color: string]: number } }) {
  const colorMap = {
    'W': { name: 'White', color: 'bg-yellow-400' },
    'U': { name: 'Blue', color: 'bg-blue-500' },
    'B': { name: 'Black', color: 'bg-gray-800' },
    'R': { name: 'Red', color: 'bg-red-500' },
    'G': { name: 'Green', color: 'bg-green-500' },
    'C': { name: 'Colorless', color: 'bg-gray-400' }
  };
  
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  const maxCount = Math.max(...Object.values(distribution));
  
  return (
    <div className="space-y-3">
      {Object.entries(distribution).map(([color, count]) => {
        if (count === 0) return null;
        const colorInfo = colorMap[color as keyof typeof colorMap];
        const percentage = total > 0 ? (count / total) * 100 : 0;
        
        return (
          <div key={color} className="flex items-center space-x-3">
            <div className={`w-4 h-4 rounded-full ${colorInfo.color}`} />
            <div className="flex-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">{colorInfo.name}</span>
                <span className="text-gray-500">{count} ({percentage.toFixed(1)}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div 
                  className={`h-2 rounded-full ${colorInfo.color} transition-all duration-300`}
                  style={{ width: `${maxCount > 0 ? (count / maxCount) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
'use client';

import { DeckCard } from '@/lib/types';
import { useState } from 'react';

interface PriceBarProps {
  cards: DeckCard[];
  totalPrice: number;
  budgetLimit?: number; // Make optional for backwards compatibility
}

export default function PriceBar({ cards, totalPrice, budgetLimit = 100 }: PriceBarProps) {
  // Budget tracking removed - keeping variable for compatibility but not displaying
  
  // Calculate price distribution
  const priceRanges = [
    { min: 0, max: 1, label: '$0-1', color: 'bg-green-400' },
    { min: 1, max: 5, label: '$1-5', color: 'bg-blue-400' },
    { min: 5, max: 10, label: '$5-10', color: 'bg-yellow-400' },
    { min: 10, max: 25, label: '$10-25', color: 'bg-orange-400' },
    { min: 25, max: 50, label: '$25-50', color: 'bg-red-400' },
    { min: 50, max: Infinity, label: '$50+', color: 'bg-purple-400' }
  ];

  const distribution = priceRanges.map(range => ({
    ...range,
    count: cards.filter(card => 
      (card.price_used || 0) >= range.min && (card.price_used || 0) < range.max
    ).length,
    total: cards
      .filter(card => (card.price_used || 0) >= range.min && (card.price_used || 0) < range.max)
      .reduce((sum, card) => sum + (card.price_used || 0), 0)
  }));

  const sortedCards = [...cards]
    .sort((a, b) => (b.price_used || 0) - (a.price_used || 0));
  
  const [showAllCards, setShowAllCards] = useState(false);
  const cardsToShow = showAllCards ? sortedCards : sortedCards.slice(0, 5);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Cost Analysis</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-gray-900">
            ${totalPrice.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">
            Total Deck Cost
          </div>
        </div>
      </div>


      {/* Price Distribution */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Price Distribution</h4>
        <div className="space-y-2">
          {distribution.filter(range => range.count > 0).map((range, index) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded ${range.color}`} />
                <span className="text-sm text-gray-600">{range.label}</span>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-900">{range.count} cards</span>
                <span className="text-sm font-medium text-gray-900">${range.total.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card Price List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">
            {showAllCards ? 'All Cards by Price' : 'Most Expensive Cards'}
          </h4>
          <button
            onClick={() => setShowAllCards(!showAllCards)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showAllCards ? 'Show Top 5' : 'Show All Cards'}
          </button>
        </div>
        <div className={`space-y-1 ${
          showAllCards ? 'max-h-64 overflow-y-auto border border-gray-200 rounded p-2' : ''
        }`}>
          {cardsToShow.map((card, index) => {
            const actualIndex = showAllCards ? index : sortedCards.findIndex(c => c.id === card.id);
            return (
              <div key={card.id} className="flex items-center justify-between py-1 hover:bg-gray-50 px-1 rounded">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <span className="text-xs text-gray-500 w-6 flex-shrink-0">#{actualIndex + 1}</span>
                  <span className="text-sm text-gray-900 truncate" title={card.name}>{card.name}</span>
                  <span className="text-xs text-gray-500 capitalize flex-shrink-0">({card.role})</span>
                  {card.price_source && card.price_source.startsWith('MTGJSON') && (
                    <span className="text-xs text-green-600 font-medium flex-shrink-0 ml-1">TCG</span>
                  )}
                </div>
                <span className="text-sm font-medium text-gray-900 flex-shrink-0 ml-2">
                  ${(card.price_used || 0).toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
        {showAllCards && (
          <div className="text-xs text-gray-500 mt-2 text-center">
            {sortedCards.length} cards total • Scroll to see more
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-gray-900">
              ${(totalPrice / cards.length).toFixed(2)}
            </div>
            <div className="text-xs text-gray-600">Avg. per Card</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              ${(sortedCards[0]?.price_used || 0).toFixed(2)}
            </div>
            <div className="text-xs text-gray-600">Most Expensive</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-gray-900">
              {cards.filter(card => (card.price_used || 0) <= 1).length}
            </div>
            <div className="text-xs text-gray-600">Cards Under $1</div>
          </div>
        </div>
      </div>
    </div>
  );
}
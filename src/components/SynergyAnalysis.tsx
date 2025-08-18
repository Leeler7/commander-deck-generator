'use client';

import { DeckCard } from '@/lib/types';
import { useState } from 'react';

interface SynergyAnalysisProps {
  cards: DeckCard[];
  commander: DeckCard;
}

interface KeywordSynergyInfo {
  sharedKeywords: string[];
  analysis: string;
  score: number;
}

export default function SynergyAnalysis({ cards, commander }: SynergyAnalysisProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  // Extract cards with keyword synergies
  const cardsWithKeywordSynergy = cards.filter(card => 
    (card as any).keywordSynergy && (card as any).keywordSynergy.score > 0
  );

  // Group cards by synergy score
  const highSynergyCards = cardsWithKeywordSynergy.filter(card => 
    (card as any).keywordSynergy.score >= 10
  );
  
  const mediumSynergyCards = cardsWithKeywordSynergy.filter(card => 
    (card as any).keywordSynergy.score >= 5 && (card as any).keywordSynergy.score < 10
  );
  
  const lowSynergyCards = cardsWithKeywordSynergy.filter(card => 
    (card as any).keywordSynergy.score < 5
  );

  // Removed pricing source distribution calculation

  const totalCards = cards.length;
  const avgSynergyScore = cards.reduce((sum, card) => 
    sum + ((card as any).synergyScore || 0), 0
  ) / totalCards;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Synergy Analysis</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-blue-600 hover:text-blue-800 underline"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-600">
            {cardsWithKeywordSynergy.length}
          </div>
          <div className="text-xs text-gray-600">Keyword Synergies</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-600">
            {highSynergyCards.length}
          </div>
          <div className="text-xs text-gray-600">High Synergy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {avgSynergyScore.toFixed(1)}
          </div>
          <div className="text-xs text-gray-600">Avg. Synergy</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-600">
            {totalCards}
          </div>
          <div className="text-xs text-gray-600">Total Cards</div>
        </div>
      </div>


      {showDetails && (
        <>
          {/* High Synergy Cards */}
          {highSynergyCards.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-green-700 mb-3">
                High Synergy Cards ({highSynergyCards.length})
              </h4>
              <div className="space-y-2">
                {highSynergyCards.map((card) => {
                  const synergy = (card as any).keywordSynergy as KeywordSynergyInfo;
                  return (
                    <div key={card.id} className="bg-green-50 border border-green-200 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-gray-900">{card.name}</span>
                          <span className="text-sm text-gray-600 ml-2">({card.role})</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-green-600">
                            +{synergy.score} synergy
                          </span>
                          {card.price_source && card.price_source.startsWith('MTGJSON') && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                              TCG
                            </span>
                          )}
                        </div>
                      </div>
                      {synergy.sharedKeywords.length > 0 && (
                        <div className="mt-2 text-sm text-gray-700">
                          <strong>Shared Keywords:</strong> {synergy.sharedKeywords.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Medium Synergy Cards */}
          {mediumSynergyCards.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-yellow-700 mb-3">
                Medium Synergy Cards ({mediumSynergyCards.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {mediumSynergyCards.map((card) => {
                  const synergy = (card as any).keywordSynergy as KeywordSynergyInfo;
                  return (
                    <div key={card.id} className="bg-yellow-50 border border-yellow-200 rounded p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">{card.name}</span>
                        <span className="text-xs text-yellow-600">+{synergy.score}</span>
                      </div>
                      {synergy.sharedKeywords.length > 0 && (
                        <div className="text-xs text-gray-600 mt-1">
                          {synergy.sharedKeywords.slice(0, 3).join(', ')}
                          {synergy.sharedKeywords.length > 3 && '...'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Commander Keywords */}
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Commander Analysis</h4>
            <div className="bg-purple-50 border border-purple-200 rounded p-3">
              <div className="font-medium text-gray-900 mb-2">{commander.name}</div>
              <div className="text-sm text-gray-700">
                <strong>Oracle Text:</strong> {commander.oracle_text?.substring(0, 150)}
                {commander.oracle_text && commander.oracle_text.length > 150 && '...'}
              </div>
              {commander.price_source && (
                <div className="mt-2 text-xs text-gray-600">
                  Pricing: {commander.price_source} (${(commander.price_used || 0).toFixed(2)})
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {cardsWithKeywordSynergy.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-lg">No keyword synergies detected</div>
          <div className="text-sm">Cards may still have thematic or mechanical synergies</div>
        </div>
      )}
    </div>
  );
}
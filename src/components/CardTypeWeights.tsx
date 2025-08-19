'use client';

import { CardTypeWeights } from '@/lib/types';

interface CardTypeWeightsProps {
  weights: CardTypeWeights;
  onChange: (weights: CardTypeWeights) => void;
}

const defaultWeights: CardTypeWeights = {
  creatures: 5,
  artifacts: 5,
  enchantments: 5,
  instants: 5,
  sorceries: 5,
  planeswalkers: 1
};

export default function CardTypeWeightsComponent({ weights, onChange }: CardTypeWeightsProps) {
  const updateWeight = (cardType: keyof CardTypeWeights, value: number) => {
    onChange({ ...weights, [cardType]: value });
  };

  const resetToDefaults = () => {
    onChange(defaultWeights);
  };

  const cardTypeDisplayNames = {
    creatures: 'Creatures',
    artifacts: 'Artifacts', 
    enchantments: 'Enchantments',
    instants: 'Instants',
    sorceries: 'Sorceries',
    planeswalkers: 'Planeswalkers'
  };

  const cardTypeDescriptions = {
    creatures: 'Creature cards and tribal support',
    artifacts: 'Artifact cards and artifact synergies',
    enchantments: 'Enchantment cards and enchantment synergies', 
    instants: 'Instant spells and reactive cards',
    sorceries: 'Sorcery spells and proactive effects',
    planeswalkers: 'Exact number of planeswalker cards to include'
  };

  const getWeightDescription = (weight: number, cardType: keyof CardTypeWeights): string => {
    if (cardType === 'planeswalkers') {
      if (weight === 0) return 'No planeswalkers';
      if (weight === 1) return '1 planeswalker';
      return `${weight} planeswalkers`;
    }
    
    if (weight === 0) return 'None - Exclude completely';
    if (weight <= 2) return 'Very Low - Minimal inclusion';
    if (weight <= 4) return 'Low - Reduced inclusion';
    if (weight === 5) return 'Balanced - Default weighting';
    if (weight <= 7) return 'High - Increased inclusion';
    if (weight <= 9) return 'Very High - Heavy emphasis';
    return 'Maximum - Extreme emphasis';
  };

  const getWeightColor = (weight: number): string => {
    if (weight === 0) return 'text-red-600';
    if (weight <= 2) return 'text-orange-600';
    if (weight <= 4) return 'text-yellow-600';
    if (weight === 5) return 'text-gray-600';
    if (weight <= 7) return 'text-blue-600';
    if (weight <= 9) return 'text-green-600';
    return 'text-purple-600';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Card Type Preferences</h3>
        <button
          onClick={resetToDefaults}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          Reset to Defaults
        </button>
      </div>
      
      <p className="text-xs text-gray-500">
        Adjust how heavily each card type should be weighted in recommendations. 5 is balanced, 0 excludes the type entirely, 10 maximizes inclusion.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {(Object.keys(weights) as Array<keyof CardTypeWeights>).map((cardType) => (
          <div key={cardType} className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={`weight-${cardType}`} className="text-sm font-medium text-gray-700">
                {cardTypeDisplayNames[cardType]}
              </label>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-bold text-gray-900 min-w-[1ch]">
                  {weights[cardType]}
                </span>
              </div>
            </div>

            <input
              id={`weight-${cardType}`}
              type="range"
              min="0"
              max={cardType === 'planeswalkers' ? "20" : "10"}
              step="1"
              value={weights[cardType]}
              onChange={(e) => updateWeight(cardType, parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />

            <div className="flex justify-between text-xs text-gray-400">
              <span>0</span>
              <span>{cardType === 'planeswalkers' ? '10' : '5'}</span>
              <span>{cardType === 'planeswalkers' ? '20' : '10'}</span>
            </div>

            <div className="text-xs">
              <p className="text-gray-600 mb-1">{cardTypeDescriptions[cardType]}</p>
              <p className={`font-medium ${getWeightColor(weights[cardType])}`}>
                {getWeightDescription(weights[cardType], cardType)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-blue-50 rounded-md">
        <h4 className="text-sm font-medium text-blue-800 mb-1">How This Works</h4>
        <div className="text-xs text-blue-700 space-y-2">
          <div>
            <p className="font-medium mb-1">Card Type Ratios (Creatures, Artifacts, Enchantments, Instants, Sorceries):</p>
            <ul className="space-y-1">
              <li>• <strong>0:</strong> Completely exclude this card type from recommendations</li>
              <li>• <strong>1-4:</strong> Reduce the likelihood of including this card type</li>
              <li>• <strong>5:</strong> Default balanced weighting (normal inclusion)</li>
              <li>• <strong>6-9:</strong> Increase the likelihood of including this card type</li>
              <li>• <strong>10:</strong> Maximum emphasis on this card type</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">Planeswalkers (Exact Count):</p>
            <ul className="space-y-1">
              <li>• <strong>0:</strong> No planeswalkers in the deck</li>
              <li>• <strong>1-20:</strong> Exactly that many planeswalkers will be included</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { GenerationConstraints, CardTypeWeights } from '@/lib/types';
import { useState } from 'react';
import CardTypeWeightsComponent from './CardTypeWeights';

interface BudgetPowerControlsProps {
  constraints: GenerationConstraints;
  onChange: (constraints: GenerationConstraints) => void;
}

const defaultCardTypeWeights: CardTypeWeights = {
  creatures: 8,
  artifacts: 2,
  enchantments: 2,
  instants: 3,
  sorceries: 3,
  planeswalkers: 2
};

export default function BudgetPowerControls({ constraints, onChange }: BudgetPowerControlsProps) {
  const [keywordInput, setKeywordInput] = useState('');

  const updateConstraint = <K extends keyof GenerationConstraints>(
    key: K,
    value: GenerationConstraints[K]
  ) => {
    onChange({ ...constraints, [key]: value });
  };

  const handleCardTypeWeightsChange = (weights: CardTypeWeights) => {
    updateConstraint('card_type_weights', weights);
  };

  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return;
    const current = constraints.keyword_focus || [];
    if (!current.includes(trimmed)) {
      updateConstraint('keyword_focus', [...current, trimmed]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (index: number) => {
    const current = constraints.keyword_focus || [];
    const next = current.filter((_, i) => i !== index);
    updateConstraint('keyword_focus', next.length > 0 ? next : undefined);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword(keywordInput);
    }
  };

  return (
    <div className="space-y-6">

      {/* Spice Level Slider */}
      <div>
        <label htmlFor="random-tag-count" className="block text-sm font-medium text-gray-700 mb-2">
          🌶️ Spice Level: How weird do you want this deck? — {constraints.random_tag_count || 0}/10
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Low spice = EDHREC-proven cards. High spice = rare/niche keyword searches dominate the pool.
        </p>
        <input
          id="random-tag-count"
          type="range"
          min="0"
          max="10"
          step="1"
          value={constraints.random_tag_count || 0}
          onChange={(e) => updateConstraint('random_tag_count', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0 — Play it safe</span>
          <span>5 — Balanced</span>
          <span>10 — Maximum chaos</span>
        </div>
      </div>

      {/* Budget Controls */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Budget (Optional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="total-budget" className="block text-xs text-gray-600 mb-1">
              Budget Target ($)
            </label>
            <p className="text-xs text-gray-400 mb-2">
              We&apos;ll aim for this price while keeping the deck playable. Cards may exceed this if cheaper alternatives don&apos;t exist.
            </p>
            <input
              id="total-budget"
              type="number"
              min="10"
              max="10000"
              step="10"
              value={constraints.total_budget ?? ''}
              placeholder="e.g. 100"
              onChange={(e) => updateConstraint('total_budget', parseFloat(e.target.value) || 100)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label htmlFor="max-card-price" className="block text-xs text-gray-600 mb-1">
              Max Price Per Card ($)
            </label>
            <input
              id="max-card-price"
              type="number"
              min="1"
              max="1000"
              step="1"
              value={constraints.max_card_price ?? ''}
              placeholder="e.g. 20"
              onChange={(e) => updateConstraint('max_card_price', parseFloat(e.target.value) || 20)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        <label className="flex items-center mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={constraints.prefer_cheapest ?? false}
            onChange={(e) => updateConstraint('prefer_cheapest', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">Prefer cheapest printing</span>
        </label>
      </div>


      {/* Target Bracket */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Target Bracket (Optional)</h3>
        <p className="text-xs text-gray-500 mb-3">
          Sets the power level for the entire deck — changes how cards are scored, which combos are allowed, and how many lands to run.
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { value: undefined, label: 'Any', sub: 'No limit' },
            { value: 1, label: '1', sub: 'Exhibition' },
            { value: 2, label: '2', sub: 'Core' },
            { value: 3, label: '3', sub: 'Upgraded' },
            { value: 4, label: '4', sub: 'Optimized' },
            { value: 5, label: '5', sub: 'cEDH' },
          ].map(({ value, label, sub }) => (
            <button
              key={label}
              type="button"
              onClick={() => updateConstraint('targetBracket', value as GenerationConstraints['targetBracket'])}
              className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                constraints.targetBracket === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              <span className="font-medium">{label}</span>
              <span className="block text-xs opacity-70">{sub}</span>
            </button>
          ))}
        </div>
        {/* Bracket description based on selection */}
        {constraints.targetBracket && (
          <div className="mt-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600">
            {constraints.targetBracket === 1 && 'Theme-focused, no combos, no Game Changers, no fast mana. Games go long — higher mana curve OK.'}
            {constraints.targetBracket === 2 && 'Precon-level, balanced. No infinite combos, no Game Changers. Standard staples, splashy turns.'}
            {constraints.targetBracket === 3 && 'Optimized synergy, up to 3 Game Changers, late-game combos OK. Efficient mana curve.'}
            {constraints.targetBracket === 4 && 'Full power — all combos, all Game Changers, fast mana prioritized. Explosive starts, lower land count.'}
            {constraints.targetBracket === 5 && 'Competitive — fastest combos, maximum interaction, tutors essential. Win turns 1-3. Avg CMC under 2.5.'}
          </div>
        )}
      </div>

      {/* Add Keywords */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Add Keywords (Optional)</h3>
        <p className="text-xs text-gray-500 mb-3">
          Type any mechanic or theme — cards matching these in their oracle text get priority. e.g. cascade, proliferate, landfall, infect
        </p>

        {/* Selected keywords */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(constraints.keyword_focus || []).map((keyword, index) => (
            <div
              key={`keyword-${keyword}-${index}`}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 border border-blue-200"
            >
              <span>{keyword}</span>
              <button
                onClick={() => removeKeyword(index)}
                className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g. cascade, tokens, graveyard..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <button
            onClick={() => addKeyword(keywordInput)}
            disabled={!keywordInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            type="button"
          >
            Add
          </button>
        </div>
      </div>

      {/* Card Type Weights */}
      <div>
        <CardTypeWeightsComponent
          weights={constraints.card_type_weights || defaultCardTypeWeights}
          onChange={handleCardTypeWeightsChange}
        />
      </div>

    </div>
  );
}
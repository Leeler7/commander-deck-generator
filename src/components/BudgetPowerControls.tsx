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

      {/* Budget Controls - DISABLED: Budget filtering has been removed */}
      {/* 
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="total-budget" className="block text-sm font-medium text-gray-700 mb-2">
            Total Budget ($)
          </label>
          <input
            id="total-budget"
            type="number"
            min="10"
            max="10000"
            step="10"
            value={constraints.total_budget}
            onChange={(e) => updateConstraint('total_budget', parseFloat(e.target.value) || 50)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label htmlFor="per-card-cap" className="block text-sm font-medium text-gray-700 mb-2">
            Per Card Cap ($)
          </label>
          <input
            id="per-card-cap"
            type="number"
            min="1"
            max="1000"
            step="1"
            value={constraints.per_card_cap}
            onChange={(e) => updateConstraint('per_card_cap', parseFloat(e.target.value) || 20)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      */}


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

      {/* Budget Summary - DISABLED: Budget filtering has been removed */}
      {/*
      <div className="mt-6 p-4 bg-gray-50 rounded-md">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Budget Summary</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Total Budget:</span>
            <span className="ml-2 font-medium">${constraints.total_budget}</span>
          </div>
          <div>
            <span className="text-gray-600">Per Card:</span>
            <span className="ml-2 font-medium">${constraints.per_card_cap}</span>
          </div>
          <div>
            <span className="text-gray-600">Est. Cards:</span>
            <span className="ml-2 font-medium">99 + Commander</span>
          </div>
          <div>
            <span className="text-gray-600">Avg. Per Card:</span>
            <span className="ml-2 font-medium">${(constraints.total_budget / 100).toFixed(2)}</span>
          </div>
        </div>
      </div>
      */}
    </div>
  );
}
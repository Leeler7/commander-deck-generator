'use client';

import { GenerationConstraints, CardTypeWeights } from '@/lib/types';
import { useState, useEffect } from 'react';
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
  const [availableTags, setAvailableTags] = useState<{allTagNames: string[], tagsByCategory: Record<string, Array<{name: string; count: number}>>}>({allTagNames: [], tagsByCategory: {}});
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tagSearchTerm, setTagSearchTerm] = useState('');

  const updateConstraint = <K extends keyof GenerationConstraints>(
    key: K,
    value: GenerationConstraints[K]
  ) => {
    onChange({ ...constraints, [key]: value });
  };

  const handleCardTypeWeightsChange = (weights: CardTypeWeights) => {
    updateConstraint('card_type_weights', weights);
  };

  // Fetch available tags on component mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        console.log('🏷️ Fetching available tags...');
        const response = await fetch('/api/admin/database-tags');
        console.log('🏷️ API response status:', response.status);
        if (response.ok) {
          const data = await response.json();
          console.log('🏷️ Available tags data:', data);
          
          // Ensure dice is included if it's missing
          if (!data.allTagNames.includes('dice')) {
            console.log('🎲 Adding dice tag manually as it was missing from API');
            data.allTagNames.push('dice');
            if (!data.tagsByCategory.manual) {
              data.tagsByCategory.manual = [];
            }
            data.tagsByCategory.manual.push({ name: 'dice', count: 1 });
          }
          
          setAvailableTags(data);
        } else {
          console.error('🏷️ API error:', response.status, await response.text());
        }
      } catch (error) {
        console.error('Error fetching available tags:', error);
      }
    };
    fetchTags();
  }, []);

  const addKeyword = (keyword: string) => {
    if (keyword.trim()) {
      const currentKeywords = constraints.keyword_focus || [];
      const newKeywords = [...currentKeywords, keyword.trim().toLowerCase()];
      updateConstraint('keyword_focus', newKeywords);
      setKeywordInput('');
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim()) {
      const currentTags = constraints.keywords || [];
      if (!currentTags.includes(tag)) {
        const newTags = [...currentTags, tag];
        updateConstraint('keywords', newTags);
      }
    }
  };

  const removeTag = (index: number) => {
    const currentTags = constraints.keywords || [];
    const newTags = currentTags.filter((_, i) => i !== index);
    updateConstraint('keywords', newTags.length > 0 ? newTags : undefined);
  };

  const removeKeyword = (index: number) => {
    const currentKeywords = constraints.keyword_focus || [];
    const newKeywords = currentKeywords.filter((_, i) => i !== index);
    updateConstraint('keyword_focus', newKeywords.length > 0 ? newKeywords : undefined);
  };

  const handleKeywordInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword(keywordInput);
    }
  };

  // Convert tag to natural language display
  const formatTagDisplay = (tag: string): string => {
    return tag
      .replace(/_/g, ' ')           // Replace underscores with spaces
      .replace(/\b\w/g, l => l.toUpperCase()) // Capitalize first letter of each word
      .replace(/\bEtb\b/g, 'ETB')   // Special cases
      .replace(/\bLtb\b/g, 'LTB')
      .replace(/\bCmc\b/g, 'CMC')
      .replace(/\bUsd\b/g, 'USD')
      .replace(/\+1\/\+1/g, '+1/+1'); // Fix counter notation
  };

  // Filter tags based on search and category
  const getFilteredTags = () => {
    let tags: string[] = [];
    
    if (selectedCategory === 'all') {
      tags = availableTags.allTagNames || [];
    } else {
      const categoryTags = availableTags.tagsByCategory[selectedCategory] || [];
      tags = categoryTags.map(tag => tag.name);
    }
    
    if (tagSearchTerm) {
      tags = tags.filter(tag => 
        tag.toLowerCase().includes(tagSearchTerm.toLowerCase()) ||
        formatTagDisplay(tag).toLowerCase().includes(tagSearchTerm.toLowerCase())
      );
    }
    
    // Exclude already selected tags
    const selectedTags = constraints.keywords || [];
    tags = tags.filter(tag => !selectedTags.includes(tag));
    
    return tags;
  };

  // Common keyword suggestions
  const keywordSuggestions = [
    'tokens', 'counters', 'tribal', 'artifacts', 'enchantments', 'graveyard',
    'sacrifice', 'etb', 'blink', 'voltron', 'equipment', 'infect', 'mill',
    'landfall', 'spellslinger', 'aristocrats', 'combo', 'control', 'aggro'
  ];

  return (
    <div className="space-y-6">

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


      {/* Tag-Based Theme Focus */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Theme Focus (Optional)</h3>
        <p className="text-xs text-gray-500 mb-3">
          Select specific mechanics and themes to emphasize in deck building.
        </p>
        
        {/* Selected Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {(constraints.keywords || []).map((tag, index) => (
            <div
              key={`tag-${tag}-${index}`}
              className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 border border-green-200"
            >
              <span>{formatTagDisplay(tag)}</span>
              <button
                onClick={() => removeTag(index)}
                className="ml-2 text-green-600 hover:text-green-800 focus:outline-none"
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Tag Browser */}
        <div className="space-y-3">
          {/* Category Filter */}
          <div className="flex gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="all">All Categories</option>
              <option value="manual">Manual Tags</option>
              <option value="tribal">Tribal</option>
              <option value="tokens">Tokens</option>
              <option value="resource_generation">Card Draw & Ramp</option>
              <option value="combat_abilities">Combat Abilities</option>
              <option value="removal_interaction">Removal & Interaction</option>
              <option value="triggers_abilities">Triggers & Abilities</option>
              <option value="synergy_themes">Synergy Themes</option>
              <option value="counters_manipulation">Counters</option>
              <option value="win_conditions">Win Conditions</option>
              <option value="card_types">Card Types</option>
              <option value="other">Other</option>
            </select>
            
            <input
              type="text"
              value={tagSearchTerm}
              onChange={(e) => setTagSearchTerm(e.target.value)}
              placeholder="Search tags..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Available Tags */}
          <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md p-2">
            <div className="text-xs text-gray-500 mb-2">
              Available: {availableTags.allTagNames?.length || 0} total, {getFilteredTags().length} filtered
            </div>
            <div className="flex flex-wrap gap-1">
              {getFilteredTags().slice(0, 20).map((tag) => (
                <button
                  key={tag}
                  onClick={() => addTag(tag)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-blue-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  type="button"
                >
                  {formatTagDisplay(tag)}
                </button>
              ))}
            </div>
            {getFilteredTags().length === 0 && availableTags.allTagNames?.length > 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No tags found for current filter</p>
            )}
            {(!availableTags.allTagNames || availableTags.allTagNames.length === 0) && (
              <p className="text-xs text-gray-500 text-center py-2">Loading tags...</p>
            )}
          </div>
        </div>

        {/* Legacy Keyword Support */}
        <details className="mt-4">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Advanced: Add Custom Keywords</summary>
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap gap-2">
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
                onKeyPress={handleKeywordInputKeyPress}
                placeholder="Add custom keyword..."
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
        </details>
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
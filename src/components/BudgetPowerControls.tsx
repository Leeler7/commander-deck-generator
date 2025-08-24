'use client';

import { GenerationConstraints, CardTypeWeights } from '@/lib/types';
import { useState, useEffect, useRef } from 'react';
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
  const [searchResults, setSearchResults] = useState<Array<{name: string; displayName: string; category: string; description?: string; count: number}>>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [tagSearchTerm, setTagSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [categories, setCategories] = useState<Array<{value: string; label: string}>>([]);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const updateConstraint = <K extends keyof GenerationConstraints>(
    key: K,
    value: GenerationConstraints[K]
  ) => {
    onChange({ ...constraints, [key]: value });
  };

  const handleCardTypeWeightsChange = (weights: CardTypeWeights) => {
    updateConstraint('card_type_weights', weights);
  };

  // Load categories on component mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/admin/tag-categories');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    
    loadCategories();
  }, []);

  // Hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search for tags as user types or when category changes
  useEffect(() => {
    const searchTags = async () => {
      // Show results if we have a search term OR a specific category selected
      const hasSearchTerm = tagSearchTerm.length >= 2;
      const hasCategory = selectedCategory && selectedCategory !== 'all';
      
      if (!hasSearchTerm && !hasCategory) {
        setSearchResults([]);
        setShowSuggestions(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q: tagSearchTerm || '', // Empty query is fine when filtering by category
          limit: '25'
        });
        
        if (selectedCategory && selectedCategory !== 'all') {
          params.set('category', selectedCategory);
        }

        const response = await fetch(`/api/admin/search-tags?${params}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.tags || []);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error searching tags:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const debounceTimer = setTimeout(searchTags, 300); // Debounce search
    return () => clearTimeout(debounceTimer);
  }, [tagSearchTerm, selectedCategory]);

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
      // Clear search after adding
      setTagSearchTerm('');
      setShowSuggestions(false);
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

  // Filter search results to exclude already selected tags
  const getFilteredSearchResults = () => {
    const selectedTags = constraints.keywords || [];
    return searchResults.filter(tag => !selectedTags.includes(tag.name));
  };

  // Common keyword suggestions
  const keywordSuggestions = [
    'tokens', 'counters', 'tribal', 'artifacts', 'enchantments', 'graveyard',
    'sacrifice', 'etb', 'blink', 'voltron', 'equipment', 'infect', 'mill',
    'landfall', 'spellslinger', 'aristocrats', 'combo', 'control', 'aggro'
  ];

  return (
    <div className="space-y-6">

      {/* Random Tags Slider */}
      <div>
        <label htmlFor="random-tag-count" className="block text-sm font-medium text-gray-700 mb-2">
          🎲 Random Tags: {constraints.random_tag_count || 0}
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Add 0-10 random themes for variety. Higher numbers create more experimental decks.
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
          <span>0 (None)</span>
          <span>5 (Balanced)</span>
          <span>10 (Chaos)</span>
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


      {/* Tag-Based Theme Focus */}
      <div ref={searchContainerRef}>
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
              {categories.map(category => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
            
            <input
              type="text"
              value={tagSearchTerm}
              onChange={(e) => setTagSearchTerm(e.target.value)}
              placeholder="Search tags..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Search Results */}
          {showSuggestions && (
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-md p-2 bg-white shadow-sm">
              {isSearching && (
                <div className="text-xs text-gray-500 mb-2 flex items-center">
                  <svg className="animate-spin h-3 w-3 mr-1" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Searching...
                </div>
              )}
              
              {!isSearching && (
                <>
                  <div className="text-xs text-gray-500 mb-2">
                    Found: {getFilteredSearchResults().length} tags
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {getFilteredSearchResults().map((tag) => (
                      <button
                        key={tag.name}
                        onClick={() => addTag(tag.name)}
                        className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-blue-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                        type="button"
                        title={`${tag.displayName || formatTagDisplay(tag.name)} (${tag.category})${tag.description ? ' - ' + tag.description : ''}`}
                      >
                        <span className="font-medium">{tag.displayName || formatTagDisplay(tag.name)}</span>
                      </button>
                    ))}
                  </div>
                  
                  {getFilteredSearchResults().length === 0 && searchResults.length > 0 && (
                    <p className="text-xs text-gray-500 text-center py-2">All matching tags already selected</p>
                  )}
                  {searchResults.length === 0 && !isSearching && (
                    <p className="text-xs text-gray-500 text-center py-2">No tags found</p>
                  )}
                </>
              )}
            </div>
          )}
          
          {/* Help text when not searching */}
          {!showSuggestions && tagSearchTerm.length < 2 && (
            <div className="text-xs text-gray-500 text-center py-2 border border-gray-200 rounded-md bg-gray-50">
              <div className="mb-2">Type at least 2 characters to search for tags</div>
              <div className="text-xs">Try: "flying", "tokens", "tribal", "artifacts", "graveyard"</div>
            </div>
          )}
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
'use client';

import { useState, useEffect, useRef } from 'react';
import { ScryfallCard } from '@/lib/types';

// Helper function to create Scryfall URL
const getScryfallUrl = (cardName: string): string => {
  return `https://scryfall.com/search?q=!"${encodeURIComponent(cardName)}"`;
};

interface CommanderInputProps {
  value: string;
  onChange: (value: string) => void;
  onCommanderSelect: (commander: ScryfallCard | null) => void;
  error?: string;
}

export default function CommanderInput({ value, onChange, onCommanderSelect, error }: CommanderInputProps) {
  const [suggestions, setSuggestions] = useState<ScryfallCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const searchCommanders = async () => {
      if (value.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`/api/commanders/search?q=${encodeURIComponent(value)}`);
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.commanders || []);
          setShowSuggestions(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Error searching commanders:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchCommanders, 300);
    return () => clearTimeout(debounceTimer);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          selectCommander(suggestions[selectedIndex]);
        } else if (suggestions.length === 1) {
          selectCommander(suggestions[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const selectCommander = (commander: ScryfallCard) => {
    onChange(commander.name);
    onCommanderSelect(commander);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (newValue !== value) {
      onCommanderSelect(null);
    }
  };

  return (
    <div className="relative">
      <label htmlFor="commander-input" className="block text-sm font-medium text-gray-700 mb-2">
        Commander Name
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="commander-input"
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Type a commander name..."
          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            error ? 'border-red-300 text-red-900 placeholder-red-300' : 'border-gray-300'
          }`}
          aria-describedby={error ? 'commander-error' : undefined}
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
        />
        
        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {suggestions.map((commander, index) => (
            <div
              key={commander.id}
              role="option"
              aria-selected={index === selectedIndex}
              className={`px-3 py-2 cursor-pointer flex items-center space-x-3 ${
                index === selectedIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'
              }`}
              onClick={() => selectCommander(commander)}
            >
              {commander.image_uris && (
                <img
                  src={commander.image_uris.small}
                  alt={commander.name}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  <a 
                    href={getScryfallUrl(commander.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                    title={`View ${commander.name} on Scryfall`}
                    onClick={(e) => e.stopPropagation()} // Prevent commander selection when clicking link
                  >
                    {commander.name}
                  </a>
                </div>
                <div className="text-sm text-gray-500 truncate">{commander.type_line}</div>
                <div className="flex items-center space-x-2 mt-1">
                  <div className="flex space-x-1">
                    {commander.color_identity.map((color) => (
                      <span
                        key={color}
                        className={`w-3 h-3 rounded-full border ${getColorClass(color)}`}
                        title={getColorName(color)}
                      />
                    ))}
                    {commander.color_identity.length === 0 && (
                      <span className="w-3 h-3 rounded-full border border-gray-400 bg-gray-200" title="Colorless" />
                    )}
                  </div>
                  <span className="text-xs text-gray-400">CMC {commander.cmc}</span>
                  {commander.prices.usd && (
                    <span className="text-xs text-green-600">${commander.prices.usd}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p id="commander-error" className="mt-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      
      <p className="mt-2 text-sm text-gray-500">
        Search for a legal commander by typing their name. Only legendary creatures and planeswalkers that can be commanders will appear.
      </p>
    </div>
  );
}

function getColorClass(color: string): string {
  const colorMap: Record<string, string> = {
    'W': 'bg-yellow-100 border-yellow-400',
    'U': 'bg-blue-100 border-blue-400',
    'B': 'bg-gray-800 border-gray-600',
    'R': 'bg-red-100 border-red-400',
    'G': 'bg-green-100 border-green-400'
  };
  return colorMap[color] || 'bg-gray-100 border-gray-400';
}

function getColorName(color: string): string {
  const colorMap: Record<string, string> = {
    'W': 'White',
    'U': 'Blue',
    'B': 'Black',
    'R': 'Red',
    'G': 'Green'
  };
  return colorMap[color] || 'Colorless';
}
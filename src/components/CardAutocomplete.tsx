'use client';

import { useState, useEffect, useRef } from 'react';

interface CardSuggestion {
  id: string;
  name: string;
  type_line: string;
  mana_cost?: string;
  image_uris?: { small: string };
  prices: { usd?: string | null; usd_foil?: string | null };
}

interface CardAutocompleteProps {
  onAdd: (cardName: string) => void;
  placeholder?: string;
  existingCards?: string[];
  colorIdentity?: string[];
  disabled?: boolean;
  disabledMessage?: string;
}

export default function CardAutocomplete({ onAdd, placeholder, existingCards = [], colorIdentity, disabled, disabledMessage }: CardAutocompleteProps) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<CardSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const colorKey = colorIdentity?.join('') ?? '';

  useEffect(() => {
    const searchCards = async () => {
      if (disabled || input.length < 2) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      setIsLoading(true);
      try {
        const colorParam = colorKey ? `&colors=${encodeURIComponent(colorKey)}` : '';
        const response = await fetch(`/api/cards?search=${encodeURIComponent(input)}&limit=8${colorParam}`);
        if (response.ok) {
          const data = await response.json();
          const filtered = (data.cards || []).filter(
            (card: CardSuggestion) => !existingCards.some(c => c.toLowerCase() === card.name.toLowerCase())
          );
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
          setSelectedIndex(-1);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    };

    const debounceTimer = setTimeout(searchCards, 300);
    return () => clearTimeout(debounceTimer);
  }, [input, existingCards, colorKey, disabled]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectCard = (card: CardSuggestion) => {
    onAdd(card.name);
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleSubmit = () => {
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      selectCard(suggestions[selectedIndex]);
    } else if (suggestions.length === 1) {
      selectCard(suggestions[0]);
    } else if (input.trim()) {
      onAdd(input.trim());
      setInput('');
      setSuggestions([]);
      setShowSuggestions(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
      return;
    }

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
        handleSubmit();
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={disabled ? (disabledMessage || placeholder) : placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
            disabled ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed' : ''
          }`}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-haspopup="listbox"
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
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto"
          role="listbox"
        >
          {suggestions.map((card, index) => (
            <div
              key={card.id}
              role="option"
              aria-selected={index === selectedIndex}
              className={`px-3 py-2 cursor-pointer flex items-center space-x-3 ${
                index === selectedIndex
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              onClick={() => selectCard(card)}
            >
              {card.image_uris && (
                <img
                  src={card.image_uris.small}
                  alt={card.name}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm">
                  {card.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{card.type_line}</div>
                {card.prices.usd && (
                  <span className="text-xs text-green-600 dark:text-green-400">${card.prices.usd}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

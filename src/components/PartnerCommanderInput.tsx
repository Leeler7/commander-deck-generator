'use client';

import { useState, useEffect, useRef } from 'react';
import { ScryfallCard } from '@/lib/types';

interface PartnerCommanderInputProps {
  commander: ScryfallCard;
  partnerType: string;
  onPartnerSelect: (partner: ScryfallCard | null) => void;
  selectedPartner: ScryfallCard | null;
}

export default function PartnerCommanderInput({
  commander,
  partnerType,
  onPartnerSelect,
  selectedPartner,
}: PartnerCommanderInputProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<ScryfallCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when commander changes
  useEffect(() => {
    setQuery('');
    setSuggestions([]);
  }, [commander.name]);

  // Search for valid partners
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/commanders/partners?commander=${encodeURIComponent(commander.name)}&q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setSuggestions(data.partners || []);
        setShowSuggestions(true);
        setSelectedIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, commander.name, partnerType]);

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
          selectPartner(suggestions[selectedIndex]);
        } else if (suggestions.length === 1) {
          selectPartner(suggestions[0]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const selectPartner = (partner: ScryfallCard) => {
    onPartnerSelect(partner);
    setQuery(partner.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const clearPartner = () => {
    onPartnerSelect(null);
    setQuery('');
    setSuggestions([]);
  };

  const labelMap: Record<string, string> = {
    'partner': 'Partner Commander',
    'partner-named': 'Partner Commander',
    'friends-forever': 'Friends Forever Partner',
    'choose-background': 'Background',
    'background': 'Commander (Choose a Background)',
    'doctors-companion': 'The Doctor',
    'doctor': "Doctor's Companion",
  };

  const label = labelMap[partnerType] || 'Partner Commander';

  if (selectedPartner) {
    const imageUrl = selectedPartner.image_uris?.small;
    return (
      <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-indigo-700">{label}</span>
          <button
            onClick={clearPartner}
            className="text-xs text-indigo-600 hover:text-indigo-800 underline"
          >
            Change
          </button>
        </div>
        <div className="flex items-center space-x-3">
          {imageUrl && (
            <img src={imageUrl} alt={selectedPartner.name} className="w-10 h-10 rounded object-cover" />
          )}
          <div>
            <a
              href={`https://scryfall.com/search?q=!"${encodeURIComponent(selectedPartner.name)}"`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              title={`View ${selectedPartner.name} on Scryfall`}
            >
              {selectedPartner.name}
            </a>
            <div className="flex items-center space-x-2 mt-0.5">
              <div className="flex space-x-1">
                {selectedPartner.color_identity.map(c => (
                  <i key={c} className={`ms ms-cost ms-${c.toLowerCase()}`} />
                ))}
              </div>
              {selectedPartner.prices.usd && (
                <span className="text-xs text-green-600">${selectedPartner.prices.usd}</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
        <label className="block text-sm font-medium text-indigo-700 mb-2">
          {label}
        </label>
        <p className="text-xs text-indigo-600 mb-2">
          This commander can have a partner. Search for a valid second commander below, or skip to use just one.
        </p>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              if (e.target.value === '') onPartnerSelect(null);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={`Search for a ${label.toLowerCase()}...`}
            className="w-full px-3 py-2 border border-indigo-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            autoComplete="off"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
            </div>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="mt-1 bg-white border border-indigo-200 rounded-md shadow-lg max-h-48 overflow-auto z-10 relative">
            {suggestions.map((partner, index) => (
              <div
                key={partner.id}
                className={`px-3 py-2 cursor-pointer flex items-center space-x-3 ${
                  index === selectedIndex ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-gray-50'
                }`}
                onClick={() => selectPartner(partner)}
              >
                {partner.image_uris?.small && (
                  <img src={partner.image_uris.small} alt={partner.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{partner.name}</div>
                  <div className="text-xs text-gray-500 truncate">{partner.type_line}</div>
                  <div className="flex items-center space-x-1 mt-0.5">
                    {partner.color_identity.map(c => (
                      <i key={c} className={`ms ms-cost ms-${c.toLowerCase()}`} style={{ fontSize: '0.65rem' }} />
                    ))}
                    {partner.prices.usd && (
                      <span className="text-xs text-green-600 ml-1">${partner.prices.usd}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

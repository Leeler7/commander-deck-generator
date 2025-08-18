'use client';

import { GeneratedDeck, DeckCard, CardRole } from '@/lib/types';
import { useState } from 'react';
import ManaCost from './ManaCost';

interface DeckListProps {
  deck: GeneratedDeck;
}

export default function DeckList({ deck }: DeckListProps) {
  const [selectedRole, setSelectedRole] = useState<CardRole | 'all'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'cmc' | 'price' | 'role'>('role');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Separate commander from other cards
  const nonCommanderCards = [...deck.nonland_cards, ...deck.lands];
  const allCards = [deck.commander, ...nonCommanderCards];
  
  const filteredCards = selectedRole === 'all' 
    ? nonCommanderCards 
    : selectedRole === 'Commander' 
    ? [deck.commander]
    : nonCommanderCards.filter(card => card.role === selectedRole);

  const sortedCards = [...filteredCards].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || '').localeCompare(b.name || '');
      case 'cmc':
        return (a.cmc || 0) - (b.cmc || 0);
      case 'price':
        return (b.price_used || 0) - (a.price_used || 0);
      case 'role':
        if ((a.role || '') !== (b.role || '')) {
          return (a.role || '').localeCompare(b.role || '');
        }
        return (a.name || '').localeCompare(b.name || '');
      default:
        return 0;
    }
  });

  const roleColors: Record<CardRole, string> = {
    'Commander': 'bg-purple-100 text-purple-800 border-purple-200',
    'Ramp': 'bg-green-100 text-green-800 border-green-200',
    'Draw/Advantage': 'bg-blue-100 text-blue-800 border-blue-200',
    'Removal/Interaction': 'bg-red-100 text-red-800 border-red-200',
    'Board Wipe': 'bg-orange-100 text-orange-800 border-orange-200',
    'Tutor': 'bg-indigo-100 text-indigo-800 border-indigo-200',
    'Protection': 'bg-emerald-100 text-emerald-800 border-emerald-200',
    'Synergy/Wincon': 'bg-pink-100 text-pink-800 border-pink-200',
    'Land': 'bg-yellow-100 text-yellow-800 border-yellow-200'
  };

  // Helper function to create Scryfall URL
  const getScryfallUrl = (cardName: string): string => {
    return `https://scryfall.com/search?q=!"{${encodeURIComponent(cardName)}}"`;
  };

  // Helper function to extract subtypes from type line
  const getSubtypes = (typeLine: string): string => {
    // Remove supertype and main type, keep only subtypes
    // Format: "Supertype MainType — Subtypes" -> "Subtypes"
    // Or: "MainType — Subtypes" -> "Subtypes"
    if (typeLine.includes('—')) {
      return typeLine.split('—')[1].trim();
    }
    // If no subtypes (no em dash), return empty string
    return '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {deck.commander.name} - Generated Deck
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {allCards.length} cards • ${deck.total_price.toFixed(2)} total
          </p>
        </div>
        
        <div className="flex items-center space-x-2 mt-4 sm:mt-0">
          <button
            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {viewMode === 'list' ? 'Grid View' : 'List View'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Role
          </label>
          <select
            id="role-filter"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value as CardRole | 'all')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Cards ({allCards.length})</option>
            {Object.entries(deck.role_breakdown).map(([role, count]) => (
              <option key={role} value={role}>
                {role} ({count})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">
            Sort by
          </label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'cmc' | 'price' | 'role')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="role">Role</option>
            <option value="name">Name</option>
            <option value="cmc">Mana Cost</option>
            <option value="price">Price</option>
          </select>
        </div>
      </div>

      {/* Commander Display */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Commander</h3>
        {viewMode === 'list' ? (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              <CardListItem key={deck.commander.id} card={deck.commander} roleColors={roleColors} getScryfallUrl={getScryfallUrl} getSubtypes={getSubtypes} />
            </ul>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <CardGridItem key={deck.commander.id} card={deck.commander} roleColors={roleColors} getScryfallUrl={getScryfallUrl} getSubtypes={getSubtypes} />
          </div>
        )}
      </div>

      {/* Other Cards Display */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          {selectedRole === 'all' ? 'Deck Cards' : 
           selectedRole === 'Commander' ? 'Commander' : 
           `${selectedRole} Cards`} ({selectedRole === 'Commander' ? 1 : sortedCards.length})
        </h3>
        {selectedRole !== 'Commander' && (
          viewMode === 'list' ? (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <ul className="divide-y divide-gray-200">
                {sortedCards.map((card) => (
                  <CardListItem key={card.id} card={card} roleColors={roleColors} getScryfallUrl={getScryfallUrl} getSubtypes={getSubtypes} />
                ))}
              </ul>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedCards.map((card) => (
                <CardGridItem key={card.id} card={card} roleColors={roleColors} getScryfallUrl={getScryfallUrl} getSubtypes={getSubtypes} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CardListItem({ 
  card, 
  roleColors,
  getScryfallUrl,
  getSubtypes
}: { 
  card: DeckCard; 
  roleColors: Record<CardRole, string>;
  getScryfallUrl: (cardName: string) => string;
  getSubtypes: (typeLine: string) => string;
}) {
  return (
    <li className="px-6 py-4 hover:bg-gray-50">
      <div className="flex items-center space-x-4">
        {card.image_uris && (
          <img
            src={card.image_uris.small}
            alt={card.name}
            className="w-12 h-12 rounded object-cover flex-shrink-0"
          />
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className="text-sm font-medium text-gray-900 truncate">
              <a 
                href={getScryfallUrl(card.name)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                title={`View ${card.name} on Scryfall`}
              >
                {card.name}
              </a>
            </h3>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${roleColors[card.role]}`}>
              {card.role}
            </span>
          </div>
          
          {getSubtypes(card.type_line) && (
            <p className="text-sm text-gray-500 truncate mt-1">
              {getSubtypes(card.type_line)}
            </p>
          )}
          
          <div className="flex items-center space-x-4 mt-2">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Cost:</span>
              <ManaCost manaCost={card.mana_cost} />
            </div>
            
            <div className="flex space-x-1">
              {card.color_identity.map((color) => (
                <span
                  key={color}
                  className={`w-4 h-4 rounded-full border ${getColorClass(color)}`}
                  title={getColorName(color)}
                />
              ))}
              {card.color_identity.length === 0 && (
                <span className="w-4 h-4 rounded-full border border-gray-400 bg-gray-200" title="Colorless" />
              )}
            </div>
            
            {card.price_used !== undefined && (
              <span className="text-sm font-medium text-green-600">
                ${card.price_used.toFixed(2)}
              </span>
            )}
          </div>
          
          {card.synergy_notes && (
            <p className="text-xs text-gray-500 mt-1 italic">
              {card.synergy_notes}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function CardGridItem({ 
  card, 
  roleColors,
  getScryfallUrl,
  getSubtypes
}: { 
  card: DeckCard; 
  roleColors: Record<CardRole, string>;
  getScryfallUrl: (cardName: string) => string;
  getSubtypes: (typeLine: string) => string;
}) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {card.image_uris && (
        <img
          src={card.image_uris.normal}
          alt={card.name}
          className="w-full h-48 object-cover"
        />
      )}
      
      <div className="p-4">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-medium text-gray-900 truncate flex-1">
            <a 
              href={getScryfallUrl(card.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
              title={`View ${card.name} on Scryfall`}
            >
              {card.name}
            </a>
          </h3>
          <ManaCost manaCost={card.mana_cost} className="ml-2" />
        </div>
        
        <div className="mt-2">
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${roleColors[card.role]}`}>
            {card.role}
          </span>
          {getSubtypes(card.type_line) && (
            <p className="text-xs text-gray-500 mt-1">
              {getSubtypes(card.type_line)}
            </p>
          )}
        </div>
        
        <div className="flex items-center justify-between mt-3">
          <div className="flex space-x-1">
            {card.color_identity.map((color) => (
              <span
                key={color}
                className={`w-3 h-3 rounded-full border ${getColorClass(color)}`}
                title={getColorName(color)}
              />
            ))}
            {card.color_identity.length === 0 && (
              <span className="w-3 h-3 rounded-full border border-gray-400 bg-gray-200" title="Colorless" />
            )}
          </div>
          
          {card.price_used !== undefined && (
            <span className="text-sm font-medium text-green-600">
              ${card.price_used.toFixed(2)}
            </span>
          )}
        </div>
        
        {card.synergy_notes && (
          <p className="text-xs text-gray-500 mt-2 italic line-clamp-2">
            {card.synergy_notes}
          </p>
        )}
      </div>
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
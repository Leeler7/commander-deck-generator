'use client';

import { useState } from 'react';
import { ScryfallCard, GeneratedDeck, GenerationConstraints } from '@/lib/types';

// Helper function to create Scryfall URL
const getScryfallUrl = (cardName: string): string => {
  return `https://scryfall.com/search?q=!"${encodeURIComponent(cardName)}"`;
};
import CommanderInput from '@/components/CommanderInput';
import BudgetPowerControls from '@/components/BudgetPowerControls';
import DeckList from '@/components/DeckList';
import RoleBreakdown from '@/components/RoleBreakdown';
import PriceBar from '@/components/PriceBar';
import Warnings from '@/components/Warnings';
import ExportOptions from '@/components/ExportOptions';
import DeckAnalysis from '@/components/DeckAnalysis';
import ManaCost from '@/components/ManaCost';
import BuyDeck from '@/components/BuyDeck';

export default function Home() {
  const [commanderName, setCommanderName] = useState('');
  const [selectedCommander, setSelectedCommander] = useState<ScryfallCard | null>(null);
  const [constraints, setConstraints] = useState<GenerationConstraints>({
    total_budget: 100,
    max_card_price: 20,
    prefer_cheapest: false,
    card_type_weights: {
      creatures: 8,
      artifacts: 2,
      enchantments: 2,
      instants: 3,
      sorceries: 3,
      planeswalkers: 2
    }
  });
  
  const [generatedDeck, setGeneratedDeck] = useState<GeneratedDeck | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomizeTypeBalance, setRandomizeTypeBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedCommander) {
      setError('Please select a valid commander first.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      // Apply randomize type balance if checked
      let finalConstraints = constraints;
      if (randomizeTypeBalance) {
        const randomWeights = {
          creatures: Math.floor(Math.random() * 9) + 1,
          artifacts: Math.floor(Math.random() * 9) + 1,
          enchantments: Math.floor(Math.random() * 9) + 1,
          instants: Math.floor(Math.random() * 9) + 1,
          sorceries: Math.floor(Math.random() * 9) + 1,
          planeswalkers: Math.floor(Math.random() * 9) + 1
        };
        
        finalConstraints = {
          ...constraints,
          card_type_weights: randomWeights
        };
        
        // Update UI to show the random weights
        setConstraints(finalConstraints);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commander: selectedCommander.name,
          constraints: finalConstraints
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate deck');
      }

      setGeneratedDeck(data.deck);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRandomCommander = async () => {
    setIsRandomizing(true);
    setError(null);
    
    try {
      // Get a random commander
      const response = await fetch('/api/commanders/random');
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get random commander');
      }

      // Set the random commander
      setSelectedCommander(data.commander);
      setCommanderName(data.commander.name);

      // Auto-generate deck with the random commander
      console.log(`🎲 Auto-generating deck for random commander: ${data.commander.name}`);
      await generateDeckForCommander(data.commander);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsRandomizing(false);
    }
  };

  // Helper function to generate deck for a given commander
  const generateDeckForCommander = async (commander: ScryfallCard) => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // Apply randomize type balance if checked
      let finalConstraints = constraints;
      if (randomizeTypeBalance) {
        const randomWeights = {
          creatures: Math.floor(Math.random() * 9) + 1,
          artifacts: Math.floor(Math.random() * 9) + 1,
          enchantments: Math.floor(Math.random() * 9) + 1,
          instants: Math.floor(Math.random() * 9) + 1,
          sorceries: Math.floor(Math.random() * 9) + 1,
          planeswalkers: Math.floor(Math.random() * 9) + 1
        };
        
        finalConstraints = {
          ...constraints,
          card_type_weights: randomWeights
        };
        
        // Update UI to show the random weights
        setConstraints(finalConstraints);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commander: commander.name,
          constraints: finalConstraints
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate deck');
      }

      setGeneratedDeck(data.deck);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const allCards = generatedDeck 
    ? [generatedDeck.commander, ...generatedDeck.nonland_cards, ...generatedDeck.lands]
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Big Deck Energy
            </h1>
            <p className="mt-2 text-lg text-gray-600">
              A Commander Deck Generator
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!generatedDeck ? (
          /* Generation Form */
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Build Your Deck
                </h2>
                
                {/* Commander Input */}
                <div className="mb-8">
                  <CommanderInput
                    value={commanderName}
                    onChange={setCommanderName}
                    onCommanderSelect={setSelectedCommander}
                    error={error && !selectedCommander ? 'Please select a valid commander' : undefined}
                  />
                </div>

                {/* Selected Commander Display */}
                {selectedCommander && (
                  <div className="mb-8 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-4">
                      {selectedCommander.image_uris && (
                        <img
                          src={selectedCommander.image_uris.small}
                          alt={selectedCommander.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          <a 
                            href={getScryfallUrl(selectedCommander.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                            title={`View ${selectedCommander.name} on Scryfall`}
                          >
                            {selectedCommander.name}
                          </a>
                        </h3>
                        <p className="text-sm text-gray-600">
                          {selectedCommander.type_line}
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className="text-sm text-gray-600">CMC: {selectedCommander.cmc}</span>
                          <div className="flex space-x-1">
                            {selectedCommander.color_identity.map((color) => (
                              <span
                                key={color}
                                className={`w-4 h-4 rounded-full border ${getColorClass(color)}`}
                                title={getColorName(color)}
                              />
                            ))}
                          </div>
                          {selectedCommander.prices.usd && (
                            <span className="text-sm text-green-600">
                              ${selectedCommander.prices.usd}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Budget and Power Controls */}
                <BudgetPowerControls
                  constraints={constraints}
                  onChange={setConstraints}
                />
              </div>

              {/* Random Commander Section */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex items-center justify-center space-x-4 mb-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={randomizeTypeBalance}
                      onChange={(e) => setRandomizeTypeBalance(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Randomize Type Balance?</span>
                  </label>
                  
                  <button
                    onClick={handleRandomCommander}
                    disabled={isRandomizing || isGenerating}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      isRandomizing || isGenerating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
                    }`}
                  >
                    {isRandomizing || isGenerating ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>
                          {isRandomizing ? 'Finding Commander...' : 'Generating Deck...'}
                        </span>
                      </div>
                    ) : (
                      '🎲 Random Deck'
                    )}
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleGenerate}
                  disabled={!selectedCommander || isGenerating}
                  className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                    !selectedCommander || isGenerating
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                  }`}
                >
                  {isGenerating ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Generating Deck...</span>
                    </div>
                  ) : (
                    'Generate Deck'
                  )}
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800">{error}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Generated Deck Display */
          <div className="space-y-8">
            {/* Back Button */}
            <div>
              <button
                onClick={() => {
                  setGeneratedDeck(null);
                  setError(null);
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Generate Another Deck
              </button>
            </div>

            {/* Warnings and Notes */}
            <Warnings 
              warnings={generatedDeck.warnings} 
              notes={generatedDeck.generation_notes} 
            />


            {/* Commander and Settings Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Commander Display (moved here) */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Your Commander</h3>
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Card Image */}
                  <div className="flex-shrink-0">
                    {generatedDeck.commander.image_uris ? (
                      <img
                        src={generatedDeck.commander.image_uris.large || generatedDeck.commander.image_uris.normal}
                        alt={generatedDeck.commander.name}
                        className="w-48 h-auto rounded-lg shadow-md mx-auto lg:mx-0"
                      />
                    ) : (
                      <div className="w-48 h-72 bg-gray-200 rounded-lg flex items-center justify-center mx-auto lg:mx-0">
                        <span className="text-gray-500">No image available</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Card Details */}
                  <div className="flex-1 space-y-3">
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">
                        <a 
                          href={getScryfallUrl(generatedDeck.commander.name)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          title={`View ${generatedDeck.commander.name} on Scryfall`}
                        >
                          {generatedDeck.commander.name}
                        </a>
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        {generatedDeck.commander.type_line}
                      </p>
                    </div>

                    {/* Mana Cost and Colors */}
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-gray-700">Mana Cost:</span>
                        <ManaCost manaCost={generatedDeck.commander.mana_cost} />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-medium text-gray-700">Colors:</span>
                        <div className="flex space-x-1">
                          {generatedDeck.commander.color_identity.map((color) => (
                            <span
                              key={color}
                              className={`w-4 h-4 rounded-full border-2 ${getColorClass(color)}`}
                              title={getColorName(color)}
                            />
                          ))}
                          {generatedDeck.commander.color_identity.length === 0 && (
                            <span className="w-4 h-4 rounded-full border-2 border-gray-400 bg-gray-200" title="Colorless" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-center p-2 bg-gray-50 rounded-lg">
                        <div className="text-sm font-semibold text-gray-900">{generatedDeck.commander.cmc}</div>
                        <div className="text-xs text-gray-600">Mana Value</div>
                      </div>
                      {generatedDeck.commander.power && (
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <div className="text-sm font-semibold text-gray-900">
                            {generatedDeck.commander.power}/{generatedDeck.commander.toughness}
                          </div>
                          <div className="text-xs text-gray-600">Power/Toughness</div>
                        </div>
                      )}
                      {generatedDeck.commander.loyalty && (
                        <div className="text-center p-2 bg-gray-50 rounded-lg">
                          <div className="text-sm font-semibold text-gray-900">{generatedDeck.commander.loyalty}</div>
                          <div className="text-xs text-gray-600">Loyalty</div>
                        </div>
                      )}
                      <div className="text-center p-2 bg-green-50 rounded-lg">
                        <div className="text-sm font-semibold text-green-700">
                          ${(generatedDeck.commander.price_used || 0).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-600">Price</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Generation Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Generation Settings</h3>
                <div className="space-y-4">
                  {/* Card Type Weights */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Card Type Balance</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Creatures:</span>
                        <span className="font-medium">{constraints.card_type_weights?.creatures || 5}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Artifacts:</span>
                        <span className="font-medium">{constraints.card_type_weights?.artifacts || 5}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Enchantments:</span>
                        <span className="font-medium">{constraints.card_type_weights?.enchantments || 5}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Instants:</span>
                        <span className="font-medium">{constraints.card_type_weights?.instants || 5}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Sorceries:</span>
                        <span className="font-medium">{constraints.card_type_weights?.sorceries || 5}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Planeswalkers:</span>
                        <span className="font-medium">{constraints.card_type_weights?.planeswalkers || 5}</span>
                      </div>
                    </div>
                  </div>

                  {/* Theme Focus */}
                  {constraints.keywords && constraints.keywords.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Theme Focus</h4>
                      <div className="flex flex-wrap gap-1">
                        {constraints.keywords.slice(0, 6).map((tag, index) => (
                          <span
                            key={`result-tag-${tag}-${index}`}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200"
                          >
                            {tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        ))}
                        {constraints.keywords.length > 6 && (
                          <span className="text-xs text-gray-500">+{constraints.keywords.length - 6} more</span>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RoleBreakdown 
                roleBreakdown={generatedDeck.role_breakdown}
                totalCards={allCards.length}
              />
              <PriceBar 
                cards={allCards}
                totalPrice={generatedDeck.total_price}
                budgetLimit={constraints.total_budget}
              />
            </div>

            {/* Export Options */}
            <ExportOptions deck={generatedDeck} />

            {/* Buy Deck Options */}
            <BuyDeck deck={generatedDeck} />

            {/* Deck Analysis */}
            <DeckAnalysis deck={generatedDeck} />

            {/* Deck List */}
            <DeckList deck={generatedDeck} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            <p>
              Powered by{' '}
              <a 
                href="https://scryfall.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-500"
              >
                Scryfall API
              </a>
              {' '}• Generated decks follow official{' '}
              <a 
                href="https://mtgcommander.net/index.php/rules/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-500"
              >
                Commander rules
              </a>
            </p>
            <p className="mt-2">
              This tool is not affiliated with Wizards of the Coast. Magic: The Gathering is a trademark of Wizards of the Coast LLC.
            </p>
          </div>
        </div>
      </footer>
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
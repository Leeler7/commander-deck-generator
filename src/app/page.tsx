'use client';

import { useState, useEffect } from 'react';
import { ScryfallCard, GeneratedDeck, GenerationConstraints, CardTypeWeights } from '@/lib/types';

// Helper function to create Scryfall URL
const getScryfallUrl = (cardName: string): string => {
  return `https://scryfall.com/search?q=!"${encodeURIComponent(cardName)}"`;
};

// Helper function to get card image (handles double-faced cards)
const getCardImageUrl = (card: any): string | null => {
  // For double-faced cards, check card_faces first
  if (card.card_faces && Array.isArray(card.card_faces) && card.card_faces.length > 0) {
    const frontFace = card.card_faces[0]; // Always use front face
    if (frontFace.image_uris) {
      return frontFace.image_uris.large || frontFace.image_uris.normal || frontFace.image_uris.small;
    }
  }
  
  // For single-faced cards, use the regular image_uris
  if (card.image_uris) {
    return card.image_uris.large || card.image_uris.normal || card.image_uris.small;
  }
  
  return null;
};
import CommanderInput from '@/components/CommanderInput';
import PartnerCommanderInput from '@/components/PartnerCommanderInput';
import BudgetPowerControls from '@/components/BudgetPowerControls';
import ThemeSelector from '@/components/ThemeSelector';
import BracketEstimate from '@/components/BracketEstimate';
import ComboDisplay from '@/components/ComboDisplay';
import DeckList from '@/components/DeckList';
import RoleBreakdown from '@/components/RoleBreakdown';
import PriceBar from '@/components/PriceBar';
import Warnings from '@/components/Warnings';
import ShareButton from '@/components/ShareButton';
import ExportOptions from '@/components/ExportOptions';
import DeckAnalysis from '@/components/DeckAnalysis';
import CommanderAnalysis from '@/components/CommanderAnalysis';
import ManaCost from '@/components/ManaCost';
import BuyDeck from '@/components/BuyDeck';
import HeaderMenu from '@/components/HeaderMenu';

type PartnerType = 'none' | 'partner' | 'partner-with' | 'partner-named' | 'friends-forever' | 'choose-background' | 'background' | 'doctors-companion' | 'doctor';

function getPartnerType(card: ScryfallCard): PartnerType {
  const keywords = card.keywords || [];
  const oracle = card.oracle_text || '';
  const typeLine = card.type_line || '';

  if (typeLine.includes('Background')) return 'background';
  if (oracle.includes('Choose a Background')) return 'choose-background';
  if (keywords.includes("Doctor's companion")) return 'doctors-companion';
  if (typeLine.includes('—')) {
    const subtypes = typeLine.split('—')[1] || '';
    if (/\bDoctor\b/.test(subtypes)) return 'doctor';
  }
  if (oracle.includes('Friends forever')) return 'friends-forever';
  // "Partner with X" is a tutor/search ETB effect, NOT a two-commander mechanic — skip it
  if (/Partner with [A-Z]/.test(oracle)) return 'none';
  if (/Partner—(?!Friends forever)/.test(oracle)) return 'partner-named';
  if (keywords.includes('Partner')) return 'partner';
  return 'none';
}

export default function Home() {
  const [commanderName, setCommanderName] = useState('');
  const [selectedCommander, setSelectedCommander] = useState<ScryfallCard | null>(null);
  const [partnerCommander, setPartnerCommander] = useState<ScryfallCard | null>(null);
  
  const [constraints, setConstraints] = useState<GenerationConstraints>({
    total_budget: 100,
    max_card_price: 20,
    prefer_cheapest: false,
    maxRarity: 'mythic',
  });
  
  const [generatedDeck, setGeneratedDeck] = useState<GeneratedDeck | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRandomizing, setIsRandomizing] = useState(false);
  const [randomizeTypeBalance, setRandomizeTypeBalance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeUnreleased, setIncludeUnreleased] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cmdr = params.get('commander');
    if (!cmdr) return;

    setCommanderName(cmdr);
    if (params.get('unreleased') === '1') setIncludeUnreleased(true);

    const parsed: Partial<GenerationConstraints> = {};
    if (params.has('budget')) parsed.total_budget = Number(params.get('budget'));
    if (params.has('maxCard')) parsed.max_card_price = Number(params.get('maxCard'));
    if (params.get('cheap') === '1') parsed.prefer_cheapest = true;
    if (params.has('bracket')) parsed.targetBracket = Number(params.get('bracket'));
    if (params.has('lands')) parsed.landCount = Number(params.get('lands'));
    if (params.has('nonBasic')) parsed.nonBasicLandCount = Number(params.get('nonBasic'));
    if (params.has('spice')) parsed.random_tag_count = Number(params.get('spice'));
    if (params.has('pacing')) parsed.pacing = params.get('pacing') as GenerationConstraints['pacing'];
    if (params.get('hyperFocus') === '1') parsed.hyperFocus = true;
    if (params.has('gameChangers')) {
      const gc = params.get('gameChangers')!;
      parsed.gameChangerLimit = gc === 'none' || gc === 'unlimited' ? gc : Number(gc);
    }
    if (params.has('rarity')) parsed.maxRarity = params.get('rarity') as GenerationConstraints['maxRarity'];
    if (params.has('combos')) parsed.comboCount = Number(params.get('combos'));
    if (params.has('keywords')) parsed.keywords = params.get('keywords')!.split(',');
    if (params.has('include')) parsed.mustIncludeCards = params.get('include')!.split(',');
    if (params.has('exclude')) parsed.excludedCards = params.get('exclude')!.split(',');
    if (params.get('noInfinite') === '1') parsed.no_infinite_combos = true;
    if (params.get('noLandDestroy') === '1') parsed.no_land_destruction = true;
    if (params.get('noExtraTurns') === '1') parsed.no_extra_turns = true;
    if (params.get('noStax') === '1') parsed.no_stax = true;
    if (params.get('noFastMana') === '1') parsed.no_fast_mana = true;
    if (params.has('weights')) {
      try { parsed.card_type_weights = JSON.parse(params.get('weights')!) as CardTypeWeights; } catch {}
    }

    const mergedConstraints = { total_budget: 100, max_card_price: 20, prefer_cheapest: false, maxRarity: 'mythic' as const, ...parsed };
    setConstraints(mergedConstraints);

    fetch(`/api/commanders/search?q=${encodeURIComponent(cmdr)}`)
      .then(res => res.json())
      .then(async (data) => {
        const match = data.commanders?.find(
          (c: ScryfallCard) => c.name.toLowerCase() === cmdr.toLowerCase()
        );
        if (!match) return;
        setSelectedCommander(match);
        setIsGenerating(true);
        try {
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commander: match.name, constraints: mergedConstraints }),
          });
          const deck = await response.json();
          if (!response.ok) throw new Error(deck.error || 'Failed to generate deck');
          setGeneratedDeck(deck.deck);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
          setIsGenerating(false);
        }
      })
      .catch(() => {});

    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const isUnreleasedCommander = selectedCommander && selectedCommander.legalities?.commander !== 'legal';

  const handleGenerate = async () => {
    if (!selectedCommander) {
      setError('Please select a valid commander first.');
      return;
    }

    if (!includeUnreleased && isUnreleasedCommander) {
      setError(`${selectedCommander.name} is not yet legal in Commander. Enable "Include unreleased cards" to use this commander.`);
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
          ...(partnerCommander ? { partnerCommander: partnerCommander.name } : {}),
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
      const response = await fetch(`/api/commanders/random${includeUnreleased ? '?unreleased=1' : ''}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get random commander');
      }

      // Set the random commander
      setSelectedCommander(data.commander);
      setCommanderName(data.commander.name);

      // Build fully randomized constraints for a random deck
      const pacingOptions: GenerationConstraints['pacing'][] = [
        'aggressive-early', 'fast-tempo', 'balanced', 'midrange', 'late-game'
      ];
      const gameChangerOptions: GenerationConstraints['gameChangerLimit'][] = [
        'none', 3, 6, 'unlimited'
      ];
      const budgetOptions = [25, 50, 100, 200, 500];
      const bracketOptions = [1, 2, 3, 4, 5];

      const randomConstraints: GenerationConstraints = {
        total_budget: 500,
        max_card_price: 25,
        prefer_cheapest: Math.random() > 0.5,
        card_type_weights: {
          creatures: Math.floor(Math.random() * 9) + 1,
          artifacts: Math.floor(Math.random() * 9) + 1,
          enchantments: Math.floor(Math.random() * 9) + 1,
          instants: Math.floor(Math.random() * 9) + 1,
          sorceries: Math.floor(Math.random() * 9) + 1,
          planeswalkers: Math.floor(Math.random() * 9) + 1,
        },
        random_tag_count: Math.floor(Math.random() * 11),
        targetBracket: bracketOptions[Math.floor(Math.random() * bracketOptions.length)],
        pacing: pacingOptions[Math.floor(Math.random() * pacingOptions.length)],
        gameChangerLimit: gameChangerOptions[Math.floor(Math.random() * gameChangerOptions.length)],
        hyperFocus: Math.random() > 0.7,
        landCount: 33 + Math.floor(Math.random() * 7), // 33-39
        nonBasicLandCount: 10 + Math.floor(Math.random() * 21), // 10-30
      };

      // Update UI to show randomized settings
      setConstraints(randomConstraints);

      // Auto-generate deck with the random commander and random constraints
      console.log(`🎲 Auto-generating deck for random commander: ${data.commander.name}`);
      await generateDeckForCommander(data.commander, randomConstraints);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsRandomizing(false);
    }
  };

  // Helper function to generate deck for a given commander
  const generateDeckForCommander = async (commander: ScryfallCard, overrideConstraints?: GenerationConstraints) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Use override constraints (from random deck) or current constraints
      let finalConstraints = overrideConstraints || constraints;

      // Apply randomize type balance if checked and no overrides provided
      if (!overrideConstraints && randomizeTypeBalance) {
        const randomWeights = {
          creatures: Math.floor(Math.random() * 9) + 1,
          artifacts: Math.floor(Math.random() * 9) + 1,
          enchantments: Math.floor(Math.random() * 9) + 1,
          instants: Math.floor(Math.random() * 9) + 1,
          sorceries: Math.floor(Math.random() * 9) + 1,
          planeswalkers: Math.floor(Math.random() * 9) + 1,
        };

        finalConstraints = {
          ...constraints,
          card_type_weights: randomWeights,
        };

        setConstraints(finalConstraints);
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commander: commander.name,
          constraints: finalConstraints,
        }),
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
    ? [generatedDeck.commander, ...(generatedDeck.partnerCommander ? [generatedDeck.partnerCommander] : []), ...generatedDeck.nonland_cards, ...generatedDeck.lands]
    : [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header - Fixed/Non-scrollable */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="font-brand text-5xl text-black dark:text-white">
              Big Deck Energy
            </h1>
            <p className="font-flavor mt-2 text-xl text-gray-600 dark:text-gray-200">
              Build a mediocre deck for free at instant speed.
            </p>

            <HeaderMenu />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!generatedDeck ? (
          /* Generation Form */
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 space-y-8">
              <div>
                <h2 className="text-3xl text-black dark:text-white mb-6" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                  BUILD YOUR DECK
                </h2>

                <div className="mb-6">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeUnreleased}
                      onChange={(e) => setIncludeUnreleased(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Include unreleased cards</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
                    Allow upcoming cards that aren&apos;t released yet. Prices may be missing or inaccurate.
                  </p>
                </div>

                {/* Commander Input */}
                <div className="mb-8">
                  <CommanderInput
                    value={commanderName}
                    onChange={setCommanderName}
                    onCommanderSelect={(cmdr) => {
                      setSelectedCommander(cmdr);
                      setPartnerCommander(null);
                    }}
                    error={error && !selectedCommander ? 'Please select a valid commander' : undefined}
                    includeUnreleased={includeUnreleased}
                  />
                </div>

                {/* Selected Commander Display */}
                {selectedCommander && (() => {
                  const pType = getPartnerType(selectedCommander);
                  const mergedColors = partnerCommander
                    ? [...new Set([...selectedCommander.color_identity, ...partnerCommander.color_identity])]
                    : selectedCommander.color_identity;

                  return (
                    <div className="mb-8">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-4">
                          {getCardImageUrl(selectedCommander) && (
                            <img
                              src={getCardImageUrl(selectedCommander)!}
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
                                {mergedColors.map((color) => (
                                  <i
                                    key={color}
                                    className={`ms ms-cost ms-${color.toLowerCase()}`}
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

                      {pType !== 'none' && (
                        <PartnerCommanderInput
                          commander={selectedCommander}
                          partnerType={pType}
                          onPartnerSelect={setPartnerCommander}
                          selectedPartner={partnerCommander}
                        />
                      )}
                    </div>
                  );
                })()}

                {!includeUnreleased && isUnreleasedCommander && (
                  <div className="mb-6 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-md">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      <strong>{selectedCommander?.name}</strong> is not yet legal in Commander. Enable &quot;Include unreleased cards&quot; above to generate a deck with this commander.
                    </p>
                  </div>
                )}

                {/* EDHREC Theme Selector */}
                {selectedCommander && (
                  <div className="mb-6">
                    <ThemeSelector
                      commanderName={selectedCommander.name}
                      constraints={constraints}
                      onChange={setConstraints}
                    />
                  </div>
                )}

                {/* Budget and Power Controls */}
                <BudgetPowerControls
                  constraints={constraints}
                  onChange={setConstraints}
                  commanderColorIdentity={selectedCommander?.color_identity}
                />
              </div>

              {/* Actions: generate with your settings, OR roll the dice */}
              <div className="pt-6 border-t border-gray-200">
                <div className="flex flex-col items-center gap-4">
                  <button
                    onClick={handleGenerate}
                    disabled={!selectedCommander || isGenerating}
                    title={!selectedCommander ? "You gotta pick a commander first." : "Generate a deck with your current settings."}
                    className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                      !selectedCommander || isGenerating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
                    }`}
                  >
                    {isGenerating ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        <span className="font-brand uppercase">GENERATING DECK...</span>
                      </div>
                    ) : (
                      <span className="font-brand text-lg">GENERATE DECK</span>
                    )}
                  </button>

                  <div className="flex items-center gap-3 w-full max-w-xs">
                    <span className="flex-1 border-t border-gray-300" />
                    <span className="font-brand text-sm text-gray-500 tracking-widest">OR</span>
                    <span className="flex-1 border-t border-gray-300" />
                  </div>

                  <button
                    onClick={handleRandomCommander}
                    disabled={isRandomizing || isGenerating}
                    title="Roll the dice. Random commander with random settings."
                    className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                      isRandomizing || isGenerating
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-purple-600 text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2'
                    }`}
                  >
                    {isRandomizing || isGenerating ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span className="font-brand uppercase">
                          {isRandomizing ? 'FINDING COMMANDER...' : 'GENERATING DECK...'}
                        </span>
                      </div>
                    ) : (
                      <span className="font-brand text-lg">🎲 BIG DECK ENERGY</span>
                    )}
                  </button>
                  <p className="text-sm text-gray-500 -mt-1">
                    Random commander, random settings — no picking required.
                  </p>

                  {constraints.card_type_weights && (
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={randomizeTypeBalance}
                        onChange={(e) => setRandomizeTypeBalance(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm text-gray-700">Randomize Type Balance?</span>
                    </label>
                  )}
                </div>
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
                <span style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>Generate Another Deck</span>
              </button>
            </div>

            {/* Share Button */}
            <div>
              <ShareButton commanderName={generatedDeck.commander.name} constraints={constraints} includeUnreleased={includeUnreleased} />
            </div>

            {/* Warnings and Notes */}
            <Warnings
              warnings={generatedDeck.warnings}
              notes={generatedDeck.generation_notes}
              dashboardWarnings={generatedDeck.dashboardWarnings}
            />


            {/* Commander and Settings Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Commander Display (moved here) */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-2xl text-black mb-4" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                  {generatedDeck.partnerCommander ? 'YOUR COMMANDERS' : 'YOUR COMMANDER'}
                </h3>
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Card Image */}
                  <div className="flex-shrink-0">
                    {getCardImageUrl(generatedDeck.commander) ? (
                      <img
                        src={getCardImageUrl(generatedDeck.commander)!}
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
                            <i
                              key={color}
                              className={`ms ms-cost ms-${color.toLowerCase()}`}
                              title={getColorName(color)}
                            />
                          ))}
                          {generatedDeck.commander.color_identity.length === 0 && (
                            <i className="ms ms-cost ms-c" title="Colorless" />
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

                {/* Partner Commander Display */}
                {generatedDeck.partnerCommander && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-lg text-black mb-3" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>PARTNER COMMANDER</h4>
                    <div className="flex flex-col lg:flex-row gap-4">
                      <div className="flex-shrink-0">
                        {getCardImageUrl(generatedDeck.partnerCommander) ? (
                          <img
                            src={getCardImageUrl(generatedDeck.partnerCommander)!}
                            alt={generatedDeck.partnerCommander.name}
                            className="w-36 h-auto rounded-lg shadow-md mx-auto lg:mx-0"
                          />
                        ) : (
                          <div className="w-36 h-52 bg-gray-200 rounded-lg flex items-center justify-center mx-auto lg:mx-0">
                            <span className="text-gray-500 text-xs">No image</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <h5 className="text-lg font-bold text-gray-900">
                          <a
                            href={getScryfallUrl(generatedDeck.partnerCommander.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                          >
                            {generatedDeck.partnerCommander.name}
                          </a>
                        </h5>
                        <p className="text-sm text-gray-600">{generatedDeck.partnerCommander.type_line}</p>
                        <div className="flex items-center space-x-3">
                          <ManaCost manaCost={generatedDeck.partnerCommander.mana_cost} />
                          <div className="flex space-x-1">
                            {generatedDeck.partnerCommander.color_identity.map((color) => (
                              <i key={color} className={`ms ms-cost ms-${color.toLowerCase()}`} title={getColorName(color)} />
                            ))}
                          </div>
                          <span className="text-sm text-green-600">
                            ${(generatedDeck.partnerCommander.price_used || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Generation Settings */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-2xl text-black mb-4" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>GENERATION SETTINGS</h3>
                <div className="space-y-4">
                  {/* Card Type Weights — only show when custom weights are active */}
                  {constraints.card_type_weights && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Card Type Balance</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Creatures:</span>
                          <span className="font-medium">{constraints.card_type_weights.creatures}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Artifacts:</span>
                          <span className="font-medium">{constraints.card_type_weights.artifacts}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Enchantments:</span>
                          <span className="font-medium">{constraints.card_type_weights.enchantments}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Instants:</span>
                          <span className="font-medium">{constraints.card_type_weights.instants}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Sorceries:</span>
                          <span className="font-medium">{constraints.card_type_weights.sorceries}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Planeswalkers:</span>
                          <span className="font-medium">{constraints.card_type_weights.planeswalkers}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Target Bracket */}
                  {constraints.targetBracket && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Target Bracket</h4>
                      <div className="text-xs">
                        <span className="text-gray-600">Max bracket: </span>
                        <span className="font-medium">{constraints.targetBracket} — {['Exhibition', 'Core', 'Upgraded', 'cEDH'][constraints.targetBracket - 1]}</span>
                      </div>
                    </div>
                  )}

                  {/* Budget Settings */}
                  {(constraints.total_budget || constraints.max_card_price) && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Budget</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Budget Target:</span>
                          <span className="font-medium">{constraints.total_budget ? `$${constraints.total_budget}` : 'No limit'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max Card Price:</span>
                          <span className="font-medium">{constraints.max_card_price ? `$${constraints.max_card_price}` : 'No limit'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Deck Functions */}
                  {generatedDeck.functionalCoverage && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Deck Functions</h4>
                      <div className="space-y-2">
                        {[
                          { label: 'Ramp', key: 'ramp', min: 10, subtypeKey: 'ramp' as const },
                          { label: 'Card Draw', key: 'card_draw', min: 8, subtypeKey: 'cardDraw' as const },
                          { label: 'Removal', key: 'removal', min: 7, subtypeKey: 'removal' as const },
                          { label: 'Board Wipes', key: 'board_wipe', min: 2, subtypeKey: 'boardwipe' as const },
                          { label: 'Protection', key: 'protection', min: 0, subtypeKey: 'protection' as const },
                          { label: 'Tutors', key: 'tutor', min: 0, subtypeKey: null },
                        ].map(({ label, key, min, subtypeKey }) => {
                          const count = generatedDeck.functionalCoverage![key as keyof typeof generatedDeck.functionalCoverage];
                          const color = min === 0 ? 'text-gray-600' : count >= min ? 'text-green-600' : count >= Math.ceil(min * 0.7) ? 'text-yellow-600' : 'text-red-600';
                          const subtypes = subtypeKey ? generatedDeck.subtypeCounts?.[subtypeKey] : undefined;
                          const hasSubtypes = subtypes && Object.keys(subtypes).length > 0;
                          return (
                            <div key={key}>
                              <div className="flex justify-between text-xs">
                                <span className="text-gray-600">{label}:</span>
                                <span className={`font-medium ${color}`}>{count}{min > 0 ? `/${min}` : ''}</span>
                              </div>
                              {hasSubtypes && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {Object.entries(subtypes!).map(([subtype, subCount]) => (
                                    <span key={subtype} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                      {subCount} {subtype.replace(/-/g, ' ')}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Trimmed cards — explain what was cut when the deck was over-full */}
                  {generatedDeck.trimCuts && generatedDeck.trimCuts.length > 0 && (
                    <details className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                        Trimmed to size — {generatedDeck.trimCuts.length} card{generatedDeck.trimCuts.length !== 1 ? 's' : ''} cut
                      </summary>
                      <ul className="mt-3 space-y-1.5">
                        {generatedDeck.trimCuts.map((cut, i) => (
                          <li key={`trim-${cut.name}-${i}`} className="flex items-start gap-2 text-xs">
                            <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-gray-200 text-gray-700 font-medium">
                              {cut.reasonLabel}
                            </span>
                            <span className="text-gray-900 font-medium">{cut.name}</span>
                            <span className="text-gray-500">— {cut.reasonText}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {/* Selected Keywords & Theme Tags */}
                  {((constraints.keyword_focus && constraints.keyword_focus.length > 0) ||
                    (constraints.keywords && constraints.keywords.length > 0)) && (
                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-200">
                      <div className="flex items-center mb-3">
                        <h4 className="text-lg text-black" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>🎯 SELECTED THEMES & KEYWORDS</h4>
                        <span className="ml-2 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          HEAVILY PRIORITIZED
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {/* Display Keywords */}
                        {(constraints.keyword_focus || []).map((keyword, index) => (
                          <span
                            key={`result-keyword-${keyword}-${index}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md border"
                          >
                            🔍 {keyword.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        ))}
                        {/* Display Tags */}
                        {(constraints.keywords || []).slice(0, 8).map((tag, index) => (
                          <span
                            key={`result-tag-${tag}-${index}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-green-600 to-blue-600 text-white shadow-md border"
                          >
                            ✨ {tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        ))}
                        {(constraints.keywords || []).length > 8 && (
                          <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg border">
                            +{(constraints.keywords || []).length - 8} more themes
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-2 italic">
                        Keywords and tags matching these themes receive very strong synergy bonuses with high selection priority.
                      </p>
                    </div>
                  )}

                  {/* Random Tags Display */}
                  {generatedDeck.random_tags && generatedDeck.random_tags.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border-2 border-purple-200">
                      <div className="flex items-center mb-3">
                        <h4 className="text-lg text-black" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>🎲 RANDOM TAGS</h4>
                        <span className="ml-2 text-xs font-medium text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                          VARIETY BOOST
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {generatedDeck.random_tags.map((tag, index) => (
                          <span
                            key={`random-tag-${tag}-${index}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md border"
                          >
                            🎲 {tag.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-600 mt-2 italic">
                        These randomly selected themes add variety and experimental elements to your deck.
                      </p>
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* Bracket Estimate + Detected Combos side by side */}
            {generatedDeck.bracketEstimate && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <BracketEstimate bracketEstimate={generatedDeck.bracketEstimate} targetBracket={constraints.targetBracket} />
                {generatedDeck.bracketEstimate.combos.length > 0 && (
                  <ComboDisplay
                    combos={generatedDeck.bracketEstimate.combos}
                    targetBracket={constraints.targetBracket}
                  />
                )}
              </div>
            )}

            {/* Deck Analysis (Cards by Type) */}
            <DeckAnalysis deck={generatedDeck} />

            {/* Commander Analysis */}
            {generatedDeck.commanderAnalysis && (
              <CommanderAnalysis
                commanderName={generatedDeck.commander.name}
                wantsDescription={generatedDeck.commanderAnalysis.wantsDescription}
                producesDescription={generatedDeck.commanderAnalysis.producesDescription}
                activationDescription={generatedDeck.commanderAnalysis.activationDescription}
              />
            )}

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

            {/* Deck List */}
            <DeckList deck={generatedDeck} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-600">
            <p className="mb-4 text-gray-700">
              Big Deck Energy is a free online MTG Commander (EDH) deck generator. Unlike traditional deck builders, 
              it's designed for spontaneity and humor, generating casual, fun, and often hilariously bad decks instantly. 
              If you're looking for an easy way to build a Magic: The Gathering Commander deck online, Big Deck Energy is the tool for you.
            </p>
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
                Commander/EDH rules
              </a>
              {' '}•{' '}
              <a
                href="/faq"
                className="text-blue-600 hover:text-blue-500"
              >
                FAQ
              </a>
              {' '}•{' '}
              <a
                href="/stuff"
                className="text-blue-600 hover:text-blue-500"
              >
                Stuff
              </a>
              {' '}•{' '}
              <a
                href="/disclosure"
                className="text-blue-600 hover:text-blue-500"
              >
                Disclosure
              </a>
            </p>
            <p className="mt-2">
              Deck engine by{' '}
              <a
                href="https://github.com/20q2/mtg-commander-deck-generator"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-500"
              >
                20q2
              </a>
              {' '}(MIT licensed) •{' '}
              <a
                href="https://www.patreon.com/cw/ShadowMonk598"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-500"
              >
                Support the engine developer on Patreon
              </a>
            </p>
            <p className="mt-2">
              This EDH deck builder is not affiliated with Wizards of the Coast. Magic: The Gathering is a trademark of Wizards of the Coast LLC.
            </p>
            <p className="mt-4">
              <a 
                href="/contact" 
                className="inline-flex items-center text-blue-600 hover:text-blue-500"
              >
                <img 
                  src="/tap.png" 
                  alt="Tap" 
                  className="inline-block h-5 w-5 mr-1"
                  style={{verticalAlign: 'middle'}}
                />
                : Contact target admin.
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
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

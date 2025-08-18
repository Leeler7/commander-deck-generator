'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';

interface CardData {
  id: string;
  name: string;
  type_line: string;
  mana_cost: string;
  cmc: number;
  oracle_text: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  edhrec_rank?: number;
  rarity: string;
  set_name: string;
  set_code?: string;
  mechanics?: {
    primaryType: string;
    functionalRoles: string[];
    powerLevel: number;
    archetypeRelevance: string[];
    mechanicTags: Array<{
      name: string;
      category: string;
      priority: number;
      confidence: number;
      evidence: string[];
    }>;
  };
}

interface SynergyResult {
  cardName: string;
  cardId?: string;
  totalScore: number;
  breakdown: {
    tagBasedSynergy: number;
    basicSynergy: number;
    keywordSynergy: number;
    keywordDetails: any;
    primarySource: string;
  };
  synergyDetails: any;
  cardMechanics: {
    primaryType: string;
    powerLevel: number;
    topTags: string[];
  };
  error?: string;
}

export default function SynergyCalculatorPage() {
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [designatedCommander, setDesignatedCommander] = useState<CardData | null>(null);
  const [synergyCards, setSynergyCards] = useState<(CardData | null)[]>([null, null, null]);
  const [synergyResults, setSynergyResults] = useState<SynergyResult[] | null>(null);
  const [synergyLoading, setSynergyLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Card search states
  const [commanderSearchTerm, setCommanderSearchTerm] = useState('');
  const [synergySearchTerms, setSynergySearchTerms] = useState<string[]>(['', '', '']);
  const [commanderDropdownOpen, setCommanderDropdownOpen] = useState(false);
  const [synergyDropdownOpen, setSynergyDropdownOpen] = useState<number | null>(null);

  useEffect(() => {
    const loadCards = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/cards/list');
        if (!response.ok) throw new Error('Failed to load cards');
        const data = await response.json();
        setAllCards(data.cards || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cards');
      } finally {
        setLoading(false);
      }
    };
    
    loadCards();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) {
        setCommanderDropdownOpen(false);
        setSynergyDropdownOpen(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const getCommanderSearchResults = () => {
    if (!commanderSearchTerm || commanderSearchTerm.length < 2) return [];
    return allCards
      .filter(card => card.name.toLowerCase().includes(commanderSearchTerm.toLowerCase()))
      .slice(0, 10);
  };

  const getSynergySearchResults = (index: number) => {
    const term = synergySearchTerms[index];
    if (!term || term.length < 2) return [];
    
    return allCards
      .filter(card => card.name.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 10);
  };

  const selectCommander = (card: CardData) => {
    setDesignatedCommander(card);
    setCommanderSearchTerm(card.name);
    setCommanderDropdownOpen(false);
    setSynergyResults(null); // Clear previous results
  };

  const clearCommander = () => {
    setDesignatedCommander(null);
    setCommanderSearchTerm('');
    setSynergyResults(null);
  };

  const updateSynergySearchTerm = (index: number, value: string) => {
    const newTerms = [...synergySearchTerms];
    newTerms[index] = value;
    setSynergySearchTerms(newTerms);
    
    // Clear the selected card if search changes
    if (synergyCards[index] && !synergyCards[index]?.name.toLowerCase().includes(value.toLowerCase())) {
      const newCards = [...synergyCards];
      newCards[index] = null;
      setSynergyCards(newCards);
    }
  };

  const selectSynergyCard = (index: number, card: CardData) => {
    const newCards = [...synergyCards];
    newCards[index] = card;
    setSynergyCards(newCards);
    
    const newTerms = [...synergySearchTerms];
    newTerms[index] = card.name;
    setSynergySearchTerms(newTerms);
    
    setSynergyDropdownOpen(null);
  };

  const addSynergyCardSlot = () => {
    setSynergyCards([...synergyCards, null]);
    setSynergySearchTerms([...synergySearchTerms, '']);
  };

  const removeSynergyCardSlot = (index: number) => {
    if (synergyCards.length > 1) {
      const newCards = synergyCards.filter((_, i) => i !== index);
      const newTerms = synergySearchTerms.filter((_, i) => i !== index);
      setSynergyCards(newCards);
      setSynergySearchTerms(newTerms);
    }
  };

  const calculateSynergy = async () => {
    if (!designatedCommander) {
      setError('Please designate a commander first');
      return;
    }
    
    const validCards = synergyCards.filter(card => card !== null);
    if (validCards.length === 0) {
      setError('Please select at least one card to compare');
      return;
    }
    
    try {
      setSynergyLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/synergy-calculator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commanderName: designatedCommander.name,
          cardNames: validCards.map(card => card!.name)
        })
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to calculate synergy: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setSynergyResults(data.results);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate synergy');
    } finally {
      setSynergyLoading(false);
    }
  };

  const panelStyle = {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px',
    minHeight: '400px'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    marginBottom: '10px'
  };

  const buttonStyle = {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '8px'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    color: '#2563eb',
    border: '1px solid #2563eb'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                SYNERGY CALCULATOR
              </h1>
              <p className="text-gray-600">Calculate synergy scores between commanders and cards</p>
            </div>
            <Link 
              href="/admin"
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back to Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Setup Panel */}
          <div style={panelStyle}>
            <h2 className="text-lg font-semibold mb-4">Setup Synergy Test</h2>
            
            {/* Commander Selection */}
            <div className="mb-6">
              <h3 className="text-md font-medium mb-3">Commander</h3>
              <div className="search-container relative">
                <input
                  type="text"
                  placeholder="Search for commander..."
                  value={commanderSearchTerm}
                  onChange={(e) => setCommanderSearchTerm(e.target.value)}
                  onFocus={() => setCommanderDropdownOpen(true)}
                  style={{
                    ...inputStyle,
                    backgroundColor: designatedCommander ? '#f0f8ff' : 'white',
                    borderColor: designatedCommander ? '#4caf50' : '#ccc'
                  }}
                />
                
                {/* Commander search dropdown */}
                {commanderDropdownOpen && commanderSearchTerm.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-lg max-height-200 overflow-y-auto z-50 shadow-lg">
                    {getCommanderSearchResults().map((card) => (
                      <div
                        key={card.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectCommander(card);
                        }}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                      >
                        <div className="font-medium">{card.name}</div>
                        <div className="text-sm text-gray-600">{card.type_line}</div>
                      </div>
                    ))}
                    {getCommanderSearchResults().length === 0 && (
                      <div className="p-3 text-gray-500 text-sm">
                        No commanders found matching "{commanderSearchTerm}"
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {designatedCommander && (
                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{designatedCommander.name}</div>
                      <div className="text-sm text-gray-600">{designatedCommander.type_line}</div>
                      <div className="text-sm text-gray-500">CMC: {designatedCommander.cmc}</div>
                    </div>
                    <button onClick={clearCommander} style={secondaryButtonStyle}>
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {/* Card Selection */}
            <div className="mb-6">
              <h3 className="text-md font-medium mb-3">Cards to Test</h3>
              {synergyCards.map((card, index) => (
                <div key={index} className="search-container relative mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        placeholder={`Search for card ${index + 1}...`}
                        value={synergySearchTerms[index]}
                        onChange={(e) => updateSynergySearchTerm(index, e.target.value)}
                        onFocus={() => setSynergyDropdownOpen(index)}
                        style={{
                          ...inputStyle,
                          marginBottom: 0,
                          backgroundColor: card ? '#f0f8ff' : 'white',
                          borderColor: card ? '#4caf50' : '#ccc'
                        }}
                      />
                      
                      {/* Search results dropdown */}
                      {synergyDropdownOpen === index && synergySearchTerms[index].length >= 2 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-300 rounded-b-lg max-height-200 overflow-y-auto z-50 shadow-lg">
                          {getSynergySearchResults(index).map((searchCard) => (
                            <div
                              key={searchCard.id}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                selectSynergyCard(index, searchCard);
                              }}
                              className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100"
                            >
                              <div className="font-medium">{searchCard.name}</div>
                              <div className="text-sm text-gray-600">{searchCard.type_line}</div>
                            </div>
                          ))}
                          {getSynergySearchResults(index).length === 0 && (
                            <div className="p-3 text-gray-500 text-sm">
                              No cards found matching "{synergySearchTerms[index]}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {card && (
                      <button
                        onClick={() => {
                          const newCards = [...synergyCards];
                          newCards[index] = null;
                          setSynergyCards(newCards);
                          const newTerms = [...synergySearchTerms];
                          newTerms[index] = '';
                          setSynergySearchTerms(newTerms);
                        }}
                        style={secondaryButtonStyle}
                      >
                        Clear
                      </button>
                    )}
                    
                    {synergyCards.length > 1 && (
                      <button
                        onClick={() => removeSynergyCardSlot(index)}
                        style={{
                          ...secondaryButtonStyle,
                          borderColor: '#dc3545',
                          color: '#dc3545'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  {/* Selected card display */}
                  {card && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                      <div className="font-medium">{card.name}</div>
                      <div className="text-gray-600">{card.type_line} • CMC {card.cmc}</div>
                    </div>
                  )}
                </div>
              ))}
              
              <button onClick={addSynergyCardSlot} style={secondaryButtonStyle}>
                Add Another Card
              </button>
            </div>
            
            {/* Calculate Button */}
            <button
              onClick={calculateSynergy}
              style={buttonStyle}
              disabled={!designatedCommander || synergyLoading}
              className="w-full"
            >
              {synergyLoading ? 'Calculating...' : 'Calculate Synergy'}
            </button>
          </div>
          
          {/* Results Panel */}
          <div style={panelStyle}>
            <h2 className="text-lg font-semibold mb-4">Synergy Results</h2>
            
            {synergyResults ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {synergyResults.map((result, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${
                    result.error ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className={`font-semibold ${result.error ? 'text-red-800' : 'text-gray-900'}`}>
                        {result.cardName}
                      </h3>
                      {!result.error && (
                        <div className={`text-lg font-bold ${
                          result.totalScore >= 50 ? 'text-green-600' : 
                          result.totalScore >= 20 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {result.totalScore.toFixed(1)}
                        </div>
                      )}
                    </div>
                    
                    {result.error ? (
                      <div className="text-red-700">{result.error}</div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm">
                          <strong>Breakdown:</strong> Tag: {result.breakdown.tagBasedSynergy} | 
                          Basic: {result.breakdown.basicSynergy} | 
                          Keyword: {result.breakdown.keywordSynergy}
                        </div>
                        
                        <div className="text-sm">
                          <strong>Primary Source:</strong> {result.breakdown.primarySource}
                        </div>
                        
                        {result.cardMechanics.topTags.length > 0 && (
                          <div className="text-sm">
                            <strong>Top Tags:</strong> {result.cardMechanics.topTags.join(', ')}
                          </div>
                        )}
                        
                        {result.breakdown.keywordDetails.sharedKeywords?.length > 0 && (
                          <div className="text-sm">
                            <strong>Shared Keywords:</strong> {result.breakdown.keywordDetails.sharedKeywords.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <h3 className="text-lg mb-2">No Results Yet</h3>
                <p>Set a commander and enter card names to calculate synergy scores.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
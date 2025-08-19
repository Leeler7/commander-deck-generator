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

export default function DatabaseExplorerPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load cards on component mount
  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/cards?limit=50000');
      if (!response.ok) {
        throw new Error(`Failed to load cards: ${response.statusText}`);
      }
      const data = await response.json();
      setCards(data.cards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  };

  const loadCardDetails = async (cardName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/details?name=${encodeURIComponent(cardName)}`);
      if (!response.ok) {
        throw new Error(`Failed to load card details: ${response.statusText}`);
      }
      const cardDetails = await response.json();
      setSelectedCard(cardDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card details');
    } finally {
      setLoading(false);
    }
  };

  // Filter cards based on search term
  const filteredCards = useMemo(() => {
    if (!searchTerm) return cards.slice(0, 50); // Limit to first 50 for performance
    
    const term = searchTerm.toLowerCase();
    return cards.filter(card => 
      card.name.toLowerCase().includes(term) ||
      card.type_line.toLowerCase().includes(term) ||
      card.oracle_text?.toLowerCase().includes(term)
    ).slice(0, 50);
  }, [cards, searchTerm]);

  const panelStyle = {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px',
    minHeight: '500px'
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    marginBottom: '15px'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                DATABASE EXPLORER
              </h1>
              <p className="text-gray-600">Search and explore the card database</p>
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
        <div style={{ display: 'flex', gap: '20px', minHeight: '600px' }}>
          
          {/* Left Panel - Card Search */}
          <div style={{ ...panelStyle, flex: '1' }}>
            <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Search Cards</h2>
            
            <input
              type="text"
              placeholder="Search cards by name, type, or text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={inputStyle}
            />
            
            <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>
              {loading ? 'Loading all cards from database...' : 
                `Showing ${filteredCards.length} of ${cards.length} total cards`}
              {searchTerm && !loading && ` matching "${searchTerm}"`}
            </p>
            
            <div style={{maxHeight: '400px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px'}}>
              {loading && !selectedCard && (
                <div style={{textAlign: 'center', padding: '20px'}}>Loading cards...</div>
              )}
              
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => loadCardDetails(card.name)}
                  style={{
                    padding: '12px',
                    borderBottom: '1px solid #f0f0f0',
                    cursor: 'pointer',
                    backgroundColor: selectedCard?.name === card.name ? '#f0f8ff' : 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (selectedCard?.name !== card.name) {
                      e.currentTarget.style.backgroundColor = '#f8f9fa';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedCard?.name !== card.name) {
                      e.currentTarget.style.backgroundColor = 'white';
                    }
                  }}
                >
                  <div style={{fontWeight: 'bold', color: '#333'}}>
                    {card.name}
                    {card.set_code && (
                      <span style={{fontSize: '10px', color: '#999', marginLeft: '8px'}}>
                        [{card.set_code.toUpperCase()}]
                      </span>
                    )}
                  </div>
                  <div style={{fontSize: '12px', color: '#666'}}>{card.type_line}</div>
                  <div style={{fontSize: '12px', color: '#999'}}>{card.mana_cost} • CMC {card.cmc}</div>
                </div>
              ))}
              
              {!loading && filteredCards.length === 0 && (
                <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                  No cards found matching your search.
                </div>
              )}
            </div>
          </div>
          
          {/* Right Panel - Card Details */}
          <div style={{ ...panelStyle, flex: '1' }}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
              <h2 style={{fontSize: '18px', margin: 0}}>Card Details</h2>
            </div>
            
            {loading && selectedCard && (
              <div style={{textAlign: 'center', padding: '20px'}}>Loading card details...</div>
            )}
            
            {error && (
              <div style={{
                backgroundColor: '#fff5f5',
                border: '1px solid #fed7d7',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '15px',
                color: '#c53030'
              }}>
                {error}
              </div>
            )}
            
            {selectedCard ? (
              <div style={{maxHeight: '500px', overflowY: 'auto'}}>
                <h3 style={{fontSize: '20px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#333'}}>
                  {selectedCard.name}
                </h3>
                <p style={{fontSize: '14px', color: '#666', margin: '5px 0'}}>{selectedCard.type_line}</p>
                <p style={{fontSize: '14px', color: '#666', margin: '5px 0'}}>
                  {selectedCard.mana_cost} • CMC {selectedCard.cmc}
                </p>
                
                {selectedCard.power && selectedCard.toughness && (
                  <p style={{fontSize: '14px', color: '#666', margin: '5px 0'}}>
                    Power/Toughness: {selectedCard.power}/{selectedCard.toughness}
                  </p>
                )}
                
                {selectedCard.loyalty && (
                  <p style={{fontSize: '14px', color: '#666', margin: '5px 0'}}>
                    Loyalty: {selectedCard.loyalty}
                  </p>
                )}
                
                <div style={{margin: '15px 0'}}>
                  <strong style={{fontSize: '14px', color: '#333'}}>Oracle Text:</strong>
                  <div style={{
                    backgroundColor: '#f9f9f9',
                    border: '1px solid #e0e0e0',
                    borderRadius: '4px',
                    padding: '12px',
                    marginTop: '5px',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-line'
                  }}>
                    {selectedCard.oracle_text || 'No oracle text available.'}
                  </div>
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', margin: '15px 0'}}>
                  <div>
                    <strong style={{fontSize: '12px', color: '#666'}}>Rarity:</strong>
                    <div style={{fontSize: '13px'}}>{selectedCard.rarity}</div>
                  </div>
                  <div>
                    <strong style={{fontSize: '12px', color: '#666'}}>Set:</strong>
                    <div style={{fontSize: '13px'}}>{selectedCard.set_name}</div>
                  </div>
                  {selectedCard.edhrec_rank && (
                    <>
                      <div>
                        <strong style={{fontSize: '12px', color: '#666'}}>EDHREC Rank:</strong>
                        <div style={{fontSize: '13px'}}>#{selectedCard.edhrec_rank}</div>
                      </div>
                    </>
                  )}
                </div>
                
                {selectedCard.mechanics && (
                  <div style={{margin: '20px 0'}}>
                    <strong style={{fontSize: '14px', color: '#333'}}>Mechanics Analysis:</strong>
                    
                    <div style={{margin: '10px 0'}}>
                      <strong style={{fontSize: '12px', color: '#666'}}>Primary Type:</strong>
                      <div style={{fontSize: '13px'}}>{selectedCard.mechanics.primaryType}</div>
                    </div>
                    
                    <div style={{margin: '10px 0'}}>
                      <strong style={{fontSize: '12px', color: '#666'}}>Power Level:</strong>
                      <div style={{fontSize: '13px'}}>{selectedCard.mechanics.powerLevel}/10</div>
                    </div>
                    
                    {selectedCard.mechanics.functionalRoles.length > 0 && (
                      <div style={{margin: '10px 0'}}>
                        <strong style={{fontSize: '12px', color: '#666'}}>Functional Roles:</strong>
                        <div style={{fontSize: '13px'}}>
                          {selectedCard.mechanics.functionalRoles.join(', ')}
                        </div>
                      </div>
                    )}
                    
                    {selectedCard.mechanics.mechanicTags.length > 0 && (
                      <div style={{margin: '15px 0'}}>
                        <strong style={{fontSize: '12px', color: '#666'}}>Mechanic Tags:</strong>
                        <div style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '8px', marginTop: '5px'}}>
                          {selectedCard.mechanics.mechanicTags.map((tag, index) => (
                            <div key={index} style={{
                              fontSize: '11px',
                              margin: '3px 0',
                              padding: '4px 8px',
                              backgroundColor: '#f0f8ff',
                              borderRadius: '3px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <span>
                                <strong>{tag.name}</strong> ({tag.category})
                              </span>
                              <span style={{color: '#666'}}>
                                P:{tag.priority} C:{tag.confidence.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{textAlign: 'center', padding: '60px', color: '#999'}}>
                <h3 style={{fontSize: '18px', marginBottom: '10px'}}>Select a card</h3>
                <p>Click on a card from the list to view its details and mechanics analysis.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
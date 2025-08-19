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
  primary_type?: string;
  functional_roles?: string[];
  power_level?: number;
  archetype_relevance?: string[];
  mechanic_tags?: Array<{
    name: string;
    category: string;
    priority: number;
    confidence: number;
    evidence: string[];
    is_manual: boolean;
  }>;
}

export default function DatabaseExplorerPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingProgress, setLoadingProgress] = useState<string>('');

  // Load cards on component mount
  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    setLoading(true);
    setError(null);
    setLoadingProgress('Starting to load cards...');
    
    try {
      setLoadingProgress('Fetching cards from database...');
      const response = await fetch('/api/cards?limit=50000');
      if (!response.ok) {
        throw new Error(`Failed to load cards: ${response.statusText}`);
      }
      
      setLoadingProgress('Processing card data...');
      const data = await response.json();
      const cardsData = data.cards || [];
      
      setLoadingProgress(`Loaded ${cardsData.length} cards successfully!`);
      setCards(cardsData);
      
      // Clear loading progress after a brief delay
      setTimeout(() => setLoadingProgress(''), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cards');
      setLoadingProgress('');
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
    if (!searchTerm) return cards.slice(0, 100); // Show first 100 cards by default
    
    const term = searchTerm.toLowerCase();
    return cards.filter(card => 
      card.name.toLowerCase().includes(term) ||
      card.type_line.toLowerCase().includes(term) ||
      card.oracle_text?.toLowerCase().includes(term)
    ).slice(0, 100); // Show up to 100 search results
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
              {loading ? (
                <span style={{color: '#3b82f6', fontWeight: 'bold'}}>
                  {loadingProgress || 'Loading all cards from database...'}
                </span>
              ) : (
                `Showing ${filteredCards.length} of ${cards.length} total cards`
              )}
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
                
                <div style={{margin: '20px 0'}}>
                  <strong style={{fontSize: '14px', color: '#333'}}>Mechanics Analysis:</strong>
                  
                  {selectedCard.primary_type && (
                    <div style={{margin: '10px 0'}}>
                      <strong style={{fontSize: '12px', color: '#666'}}>Primary Type:</strong>
                      <div style={{fontSize: '13px'}}>{selectedCard.primary_type}</div>
                    </div>
                  )}
                  
                  {selectedCard.power_level !== undefined && (
                    <div style={{margin: '10px 0'}}>
                      <strong style={{fontSize: '12px', color: '#666'}}>Power Level:</strong>
                      <div style={{fontSize: '13px'}}>{selectedCard.power_level}/10</div>
                    </div>
                  )}
                  
                  {selectedCard.functional_roles && selectedCard.functional_roles.length > 0 && (
                    <div style={{margin: '10px 0'}}>
                      <strong style={{fontSize: '12px', color: '#666'}}>Functional Roles:</strong>
                      <div style={{fontSize: '13px'}}>
                        {selectedCard.functional_roles.join(', ')}
                      </div>
                    </div>
                  )}
                  
                  {selectedCard.mechanic_tags && selectedCard.mechanic_tags.length > 0 && (
                    <div style={{margin: '15px 0'}}>
                      <strong style={{fontSize: '12px', color: '#666'}}>Mechanic Tags ({selectedCard.mechanic_tags.length}):</strong>
                      <div style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '8px', marginTop: '5px'}}>
                        {selectedCard.mechanic_tags.map((tag, index) => (
                          <div key={index} style={{
                            fontSize: '11px',
                            margin: '3px 0',
                            padding: '4px 8px',
                            backgroundColor: tag.is_manual ? '#e6ffed' : '#f0f8ff',
                            borderRadius: '3px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <span>
                              <strong>{tag.name}</strong> ({tag.category})
                              {tag.is_manual && <span style={{color: '#00aa00', fontWeight: 'bold'}}> ✓</span>}
                            </span>
                            <span style={{color: '#666'}}>
                              P:{tag.priority} C:{tag.confidence.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {(!selectedCard.mechanic_tags || selectedCard.mechanic_tags.length === 0) && (
                    <div style={{margin: '15px 0', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px'}}>
                      <span style={{fontSize: '12px', color: '#666', fontStyle: 'italic'}}>
                        No mechanic tags available for this card.
                      </span>
                    </div>
                  )}
                </div>
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
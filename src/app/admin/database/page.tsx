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
    id?: string;
    card_id?: string;
    tag_name: string;
    tag_category: string;
    priority: number;
    confidence: number;
    evidence: string[];
    is_manual: boolean;
    created_at?: string;
    // Legacy support
    name?: string;
    category?: string;
  }>;
}

export default function DatabaseExplorerPage() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [availableTags, setAvailableTags] = useState<any>(null);
  const [selectedTagsToAdd, setSelectedTagsToAdd] = useState<string[]>([]);
  const [selectedTagsToRemove, setSelectedTagsToRemove] = useState<string[]>([]);
  const [isEditingTags, setIsEditingTags] = useState(false);

  // Load cards and available tags on component mount
  useEffect(() => {
    loadCards();
    loadAvailableTags();
  }, []);

  // Handle search with debouncing
  useEffect(() => {
    if (!searchTerm.trim()) {
      // No search term - show all cards (limited)
      setCards(allCards);
      return;
    }

    // Debounce search
    const timeoutId = setTimeout(() => {
      performSearch(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, allCards]);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setCards(allCards);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards?search=${encodeURIComponent(query)}&limit=100`);
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      const data = await response.json();
      setCards(data.cards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      // Fallback to client-side filtering
      const term = query.toLowerCase();
      const filtered = allCards.filter(card => 
        card.name.toLowerCase().includes(term) ||
        card.type_line.toLowerCase().includes(term) ||
        card.oracle_text?.toLowerCase().includes(term)
      );
      setCards(filtered);
    } finally {
      setLoading(false);
    }
  };

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
      setAllCards(cardsData); // Store all cards
      setCards(cardsData);    // Display cards
      
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
      // Reset tag editing state when loading a new card
      setSelectedTagsToAdd([]);
      setSelectedTagsToRemove([]);
      setIsEditingTags(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card details');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTags = async () => {
    try {
      const response = await fetch('/api/admin/available-tags');
      if (response.ok) {
        const data = await response.json();
        setAvailableTags(data);
      }
    } catch (error) {
      console.error('Error loading available tags:', error);
    }
  };

  const updateCardTags = async () => {
    if (!selectedCard || (selectedTagsToAdd.length === 0 && selectedTagsToRemove.length === 0)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardName: selectedCard.name,
          tagsToAdd: selectedTagsToAdd,
          tagsToRemove: selectedTagsToRemove
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to update tags: ${response.statusText}`);
      }

      // Refresh the card details to show updated tags
      await loadCardDetails(selectedCard.name);
      setSelectedTagsToAdd([]);
      setSelectedTagsToRemove([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tags');
    } finally {
      setLoading(false);
    }
  };

  const toggleTagForAddition = (tag: string) => {
    setSelectedTagsToAdd(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const toggleTagForRemoval = (tag: string) => {
    setSelectedTagsToRemove(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Display limited cards for performance
  const displayedCards = useMemo(() => {
    return cards.slice(0, 100); // Show up to 100 cards
  }, [cards]);

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
              <p className="text-gray-600">Search, explore, and edit card tags</p>
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
                  {loadingProgress || 'Loading...'}
                </span>
              ) : (
                `Showing ${displayedCards.length} of ${allCards.length} total cards`
              )}
              {searchTerm && !loading && ` matching "${searchTerm}"`}
            </p>
            
            <div style={{maxHeight: '400px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px'}}>
              {loading && !selectedCard && (
                <div style={{textAlign: 'center', padding: '20px'}}>Loading cards...</div>
              )}
              
              {displayedCards.map((card) => (
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
              
              {!loading && displayedCards.length === 0 && (
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
              {selectedCard && (
                <button
                  onClick={() => setIsEditingTags(!isEditingTags)}
                  style={{
                    backgroundColor: isEditingTags ? '#dc2626' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {isEditingTags ? 'Cancel Edit' : 'Edit Tags'}
                </button>
              )}
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
                      <strong style={{fontSize: '12px', color: '#666'}}>
                        Mechanic Tags ({selectedCard.mechanic_tags.length}):
                        {isEditingTags && <span style={{color: '#dc2626', fontSize: '10px', marginLeft: '8px'}}>Click to remove</span>}
                      </strong>
                      <div style={{maxHeight: '200px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '8px', marginTop: '5px'}}>
                        {selectedCard.mechanic_tags.map((tag, index) => {
                          const tagName = tag.tag_name || tag.name;
                          const isSelectedForRemoval = selectedTagsToRemove.includes(tagName);
                          
                          return (
                            <div 
                              key={index} 
                              style={{
                                fontSize: '11px',
                                margin: '3px 0',
                                padding: '4px 8px',
                                backgroundColor: 
                                  isSelectedForRemoval ? '#fecaca' :
                                  tag.is_manual ? '#e6ffed' : '#f0f8ff',
                                borderRadius: '3px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: isEditingTags ? 'pointer' : 'default',
                                border: isSelectedForRemoval ? '1px solid #dc2626' : 'none'
                              }}
                              onClick={() => isEditingTags && toggleTagForRemoval(tagName)}
                            >
                              <span>
                                <strong>{tagName}</strong> ({tag.tag_category || tag.category})
                                {tag.is_manual && <span style={{color: '#00aa00', fontWeight: 'bold'}}> ✓</span>}
                                {isSelectedForRemoval && <span style={{color: '#dc2626', fontWeight: 'bold'}}> ✕</span>}
                              </span>
                              <span style={{color: '#666'}}>
                                P:{tag.priority} C:{typeof tag.confidence === 'number' ? tag.confidence.toFixed(2) : tag.confidence}
                              </span>
                            </div>
                          );
                        })}
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

                  {/* Tag Editing Interface */}
                  {isEditingTags && (
                    <div style={{margin: '20px 0', borderTop: '1px solid #e0e0e0', paddingTop: '15px'}}>
                      <h3 style={{fontSize: '16px', marginBottom: '15px'}}>Edit Tags</h3>
                      
                      {/* Tags to Add/Remove Summary */}
                      {(selectedTagsToAdd.length > 0 || selectedTagsToRemove.length > 0) && (
                        <div style={{marginBottom: '15px'}}>
                          {selectedTagsToAdd.length > 0 && (
                            <div style={{marginBottom: '8px', padding: '8px', backgroundColor: '#f0f9ff', borderRadius: '4px'}}>
                              <strong style={{fontSize: '12px', color: '#0369a1'}}>Tags to Add ({selectedTagsToAdd.length}):</strong>
                              <div style={{marginTop: '4px'}}>
                                {selectedTagsToAdd.map(tag => (
                                  <span key={tag} style={{
                                    display: 'inline-block',
                                    margin: '2px',
                                    padding: '2px 6px',
                                    backgroundColor: '#bae6fd',
                                    color: '#0c4a6e',
                                    borderRadius: '3px',
                                    fontSize: '11px'
                                  }}>
                                    +{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {selectedTagsToRemove.length > 0 && (
                            <div style={{marginBottom: '8px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '4px'}}>
                              <strong style={{fontSize: '12px', color: '#dc2626'}}>Tags to Remove ({selectedTagsToRemove.length}):</strong>
                              <div style={{marginTop: '4px'}}>
                                {selectedTagsToRemove.map(tag => (
                                  <span key={tag} style={{
                                    display: 'inline-block',
                                    margin: '2px',
                                    padding: '2px 6px',
                                    backgroundColor: '#fecaca',
                                    color: '#991b1b',
                                    borderRadius: '3px',
                                    fontSize: '11px'
                                  }}>
                                    -{tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <div style={{display: 'flex', gap: '8px', marginTop: '10px'}}>
                            <button
                              onClick={updateCardTags}
                              disabled={loading}
                              style={{
                                backgroundColor: '#16a34a',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '12px',
                                opacity: loading ? 0.5 : 1
                              }}
                            >
                              {loading ? 'Updating...' : 'Update Tags'}
                            </button>
                            <button
                              onClick={() => {
                                setSelectedTagsToAdd([]);
                                setSelectedTagsToRemove([]);
                              }}
                              style={{
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Available Tags */}
                      {availableTags && (
                        <div>
                          <strong style={{fontSize: '12px', color: '#666'}}>Available Tags by Category:</strong>
                          <div style={{maxHeight: '250px', overflowY: 'auto', marginTop: '8px', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '8px'}}>
                            {Object.entries(availableTags.tagsByCategory).map(([category, tags]) => (
                              <div key={category} style={{marginBottom: '10px'}}>
                                <h4 style={{fontSize: '11px', color: '#374151', marginBottom: '4px', textTransform: 'capitalize'}}>
                                  {category.replace(/_/g, ' ')} ({tags.length})
                                </h4>
                                <div style={{display: 'flex', flexWrap: 'wrap', gap: '3px'}}>
                                  {tags.slice(0, 15).map(tag => {
                                    const isCurrentTag = selectedCard.mechanic_tags?.some(t => (t.tag_name || t.name) === tag);
                                    const isSelectedToAdd = selectedTagsToAdd.includes(tag);
                                    const isSelectedToRemove = selectedTagsToRemove.includes(tag);
                                    
                                    return (
                                      <button
                                        key={tag}
                                        onClick={() => {
                                          if (isCurrentTag) {
                                            toggleTagForRemoval(tag);
                                          } else {
                                            toggleTagForAddition(tag);
                                          }
                                        }}
                                        style={{
                                          padding: '2px 6px',
                                          fontSize: '10px',
                                          border: '1px solid #d1d5db',
                                          borderRadius: '3px',
                                          cursor: 'pointer',
                                          backgroundColor: 
                                            isSelectedToRemove ? '#fecaca' :
                                            isSelectedToAdd ? '#bbf7d0' :
                                            isCurrentTag ? '#e5e7eb' : '#f9fafb',
                                          color:
                                            isSelectedToRemove ? '#991b1b' :
                                            isSelectedToAdd ? '#166534' :
                                            isCurrentTag ? '#374151' : '#6b7280'
                                        }}
                                      >
                                        {isSelectedToRemove ? '−' : isSelectedToAdd ? '+' : ''}
                                        {tag}
                                      </button>
                                    );
                                  })}
                                  {tags.length > 15 && (
                                    <span style={{fontSize: '10px', color: '#9ca3af', padding: '2px 4px'}}>
                                      +{tags.length - 15} more...
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
'use client';

import { useState, useEffect, useMemo } from 'react';

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

interface AvailableTags {
  allTags: string[];
  tagsByCategory: Record<string, string[]>;
  totalCount: number;
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

export default function EnhancedAdminPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [allCards, setAllCards] = useState<CardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Tag editing state
  const [availableTags, setAvailableTags] = useState<AvailableTags | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [selectedTagsToAdd, setSelectedTagsToAdd] = useState<string[]>([]);
  const [selectedTagsToRemove, setSelectedTagsToRemove] = useState<string[]>([]);
  
  // Commander and synergy state
  const [designatedCommander, setDesignatedCommander] = useState<CardData | null>(null);
  const [synergyCards, setSynergyCards] = useState<(CardData | null)[]>([null, null, null]);
  const [synergyResults, setSynergyResults] = useState<SynergyResult[] | null>(null);
  const [synergyLoading, setSynergyLoading] = useState(false);
  
  // Card search states for synergy calculator
  const [synergySearchTerms, setSynergySearchTerms] = useState<string[]>(['', '', '']);
  const [synergyDropdownOpen, setSynergyDropdownOpen] = useState<number | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'browse' | 'tags' | 'synergy'>('browse');

  useEffect(() => {
    const loadCardNames = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/cards/list');
        if (!response.ok) throw new Error('Failed to load cards');
        const data = await response.json();
        
        // Deduplicate cards by ID to prevent duplicate key errors
        const cards = data.cards || [];
        const uniqueCards = cards.filter((card: CardData, index: number, self: CardData[]) => 
          index === self.findIndex((c: CardData) => c.id === card.id)
        );
        
        setAllCards(uniqueCards);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load cards');
      } finally {
        setLoading(false);
      }
    };
    
    const loadAvailableTags = async () => {
      try {
        const response = await fetch('/api/admin/available-tags');
        if (!response.ok) throw new Error('Failed to load available tags');
        const data = await response.json();
        setAvailableTags(data);
      } catch (err) {
        console.error('Failed to load available tags:', err);
      }
    };

    loadCardNames();
    loadAvailableTags();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Don't close if clicking inside a dropdown or input
      if (!target.closest('.synergy-search-container')) {
        setSynergyDropdownOpen(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const filteredCards = useMemo(() => {
    if (!searchTerm) return allCards.slice(0, 50);
    
    // Filter cards and ensure uniqueness
    const filtered = allCards.filter(card => 
      card.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Additional deduplication to handle edge cases
    const uniqueFiltered = filtered.filter((card, index, self) => 
      index === self.findIndex((c) => c.id === card.id)
    );
    
    return uniqueFiltered.slice(0, 50);
  }, [searchTerm, allCards]);

  const loadCardDetails = async (cardName: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/debug/card-analysis?card=${encodeURIComponent(cardName)}`);
      if (!response.ok) throw new Error('Failed to load card details');
      const data = await response.json();
      
      const cardData: CardData = {
        ...data.card,
        mechanics: data.mechanics
      };
      setSelectedCard(cardData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card details');
    } finally {
      setLoading(false);
    }
  };
  
  const updateCardTags = async () => {
    if (!selectedCard || (selectedTagsToAdd.length === 0 && selectedTagsToRemove.length === 0)) {
      setError('No tags to update');
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch('/api/admin/update-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardName: selectedCard.name,
          tagsToAdd: selectedTagsToAdd,
          tagsToRemove: selectedTagsToRemove
        })
      });
      
      if (!response.ok) throw new Error('Failed to update tags');
      const data = await response.json();
      
      // Update the selected card with new mechanics
      setSelectedCard({
        ...selectedCard,
        mechanics: data.updatedMechanics
      });
      
      // Reset selections
      setSelectedTagsToAdd([]);
      setSelectedTagsToRemove([]);
      setEditingTags(false);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tags');
    } finally {
      setLoading(false);
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
      
      console.log('🎯 FRONTEND: Calculating synergy for:', {
        commander: designatedCommander.name,
        cards: validCards.map(card => card!.name)
      });
      
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
        console.error('Synergy API error:', errorData);
        throw new Error(`Failed to calculate synergy: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🎯 FRONTEND: Synergy results:', data);
      
      setSynergyResults(data.results);
      
    } catch (err) {
      console.error('Synergy calculation error:', err);
      setError(err instanceof Error ? err.message : 'Failed to calculate synergy');
    } finally {
      setSynergyLoading(false);
    }
  };
  
  const designateAsCommander = () => {
    if (selectedCard) {
      setDesignatedCommander(selectedCard);
      setActiveTab('synergy');
    }
  };
  
  const clearCommander = () => {
    setDesignatedCommander(null);
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
  
  const getSynergySearchResults = (index: number) => {
    const term = synergySearchTerms[index];
    if (!term || term.length < 2) return [];
    
    // Filter and deduplicate
    const filtered = allCards
      .filter(card => card.name.toLowerCase().includes(term.toLowerCase()));
    
    const uniqueFiltered = filtered.filter((card, idx, self) => 
      idx === self.findIndex((c) => c.id === card.id)
    );
    
    return uniqueFiltered.slice(0, 10);
  };

  const containerStyle = {
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  };

  const headerStyle = {
    fontSize: '24px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#333'
  };

  const tabStyle = {
    display: 'flex',
    marginBottom: '20px',
    borderBottom: '2px solid #e0e0e0'
  };

  const tabButtonStyle = (isActive: boolean) => ({
    padding: '10px 20px',
    border: 'none',
    backgroundColor: isActive ? '#007bff' : 'transparent',
    color: isActive ? 'white' : '#007bff',
    cursor: 'pointer',
    borderRadius: '4px 4px 0 0',
    fontWeight: 'bold'
  });

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    maxWidth: '1400px',
    margin: '0 auto'
  };

  const panelStyle = {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '1px solid #e0e0e0'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    marginBottom: '15px'
  };

  const buttonStyle = {
    padding: '8px 16px',
    margin: '5px',
    border: '1px solid #007bff',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: 'white',
    cursor: 'pointer',
    fontSize: '12px'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    color: '#007bff'
  };

  const tagStyle = {
    display: 'inline-block',
    padding: '4px 8px',
    margin: '2px',
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    borderRadius: '12px',
    fontSize: '12px',
    border: '1px solid #bbdefb'
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'browse':
        return (
          <div style={gridStyle}>
            <div style={panelStyle}>
              <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Search Cards</h2>
              
              <input
                type="text"
                placeholder="Type card name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={inputStyle}
              />
              
              <p style={{fontSize: '12px', color: '#666', marginBottom: '15px'}}>
                Showing {filteredCards.length} cards
                {searchTerm && ` matching "${searchTerm}"`}
              </p>
              
              <div style={{maxHeight: '400px', overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: '4px'}}>
                {loading && !selectedCard && (
                  <div style={{textAlign: 'center', padding: '20px'}}>Loading cards...</div>
                )}
                
                {filteredCards.map((card, index) => (
                  <div
                    key={`card-${card.id}-${index}-${searchTerm.replace(/[^a-zA-Z0-9]/g, '')}`}
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
            
            <div style={panelStyle}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h2 style={{fontSize: '18px', margin: 0}}>Card Details</h2>
                {selectedCard && (
                  <div>
                    <button onClick={designateAsCommander} style={buttonStyle}>
                      Set as Commander
                    </button>
                    <button onClick={() => setActiveTab('tags')} style={secondaryButtonStyle}>
                      Edit Tags
                    </button>
                  </div>
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
                  
                  <div style={{margin: '15px 0'}}>
                    <h4 style={{fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0'}}>Oracle Text</h4>
                    <div style={{
                      backgroundColor: '#f8f9fa',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '13px',
                      whiteSpace: 'pre-line',
                      border: '1px solid #e9ecef'
                    }}>
                      {selectedCard.oracle_text || 'No oracle text'}
                    </div>
                  </div>
                  
                  {selectedCard.mechanics && (
                    <div style={{margin: '15px 0'}}>
                      <h4 style={{fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0'}}>
                        Mechanic Tags ({selectedCard.mechanics.mechanicTags.length})
                      </h4>
                      <div style={{maxHeight: '200px', overflowY: 'auto'}}>
                        {selectedCard.mechanics.mechanicTags
                          .sort((a, b) => b.priority - a.priority)
                          .map((tag, index) => (
                          <div key={`${tag.name}-${index}`} style={{
                            border: '1px solid #e0e0e0',
                            borderRadius: '4px',
                            padding: '8px',
                            margin: '5px 0',
                            fontSize: '12px',
                            backgroundColor: '#fafafa'
                          }}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'}}>
                              <span style={{fontWeight: 'bold'}}>{tag.name}</span>
                              <span style={{backgroundColor: '#f5f5f5', color: '#666', padding: '2px 6px', borderRadius: '4px', fontSize: '10px'}}>
                                P{tag.priority}
                              </span>
                            </div>
                            <div style={{fontSize: '11px', color: '#666', marginBottom: '4px'}}>
                              Category: {tag.category} | Confidence: {(tag.confidence * 100).toFixed(0)}%
                            </div>
                            {tag.evidence.length > 0 && (
                              <div style={{fontSize: '11px', color: '#888'}}>
                                Evidence: {tag.evidence.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{textAlign: 'center', padding: '60px 20px', color: '#999'}}>
                  Select a card from the list to view its details and comprehensive tagging analysis.
                </div>
              )}
            </div>
          </div>
        );

      case 'tags':
        return (
          <div style={gridStyle}>
            <div style={panelStyle}>
              <h2 style={{fontSize: '18px', marginBottom: '15px'}}>
                Tag Editor
                {selectedCard && ` - ${selectedCard.name}`}
              </h2>
              
              {!selectedCard ? (
                <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                  Select a card from the Browse tab to edit its tags.
                </div>
              ) : (
                <div>
                  <div style={{marginBottom: '20px'}}>
                    <h3 style={{fontSize: '16px', marginBottom: '10px'}}>Current Tags</h3>
                    <div style={{maxHeight: '150px', overflowY: 'auto', border: '1px solid #e0e0e0', padding: '10px', borderRadius: '4px'}}>
                      {selectedCard.mechanics?.mechanicTags.map((tag, index) => (
                        <span key={index} style={tagStyle} onClick={() => {
                          if (!selectedTagsToRemove.includes(tag.name)) {
                            setSelectedTagsToRemove([...selectedTagsToRemove, tag.name]);
                          }
                        }}>
                          {tag.name} 
                          {selectedTagsToRemove.includes(tag.name) && ' ❌'}
                        </span>
                      ))}
                    </div>
                    <p style={{fontSize: '12px', color: '#666', marginTop: '5px'}}>
                      Click tags to mark for removal
                    </p>
                  </div>
                  
                  <div style={{marginBottom: '20px'}}>
                    <h3 style={{fontSize: '16px', marginBottom: '10px'}}>Add Tags</h3>
                    {availableTags && Object.entries(availableTags.tagsByCategory).map(([category, tags]) => (
                      <div key={category} style={{marginBottom: '15px'}}>
                        <h4 style={{fontSize: '14px', marginBottom: '5px', textTransform: 'capitalize'}}>
                          {category.replace('_', ' ')}
                        </h4>
                        <div style={{maxHeight: '100px', overflowY: 'auto', border: '1px solid #e0e0e0', padding: '5px', borderRadius: '4px'}}>
                          {tags.filter(tag => !selectedCard.mechanics?.mechanicTags.some(t => t.name === tag)).map(tag => (
                            <span
                              key={tag}
                              style={{
                                ...tagStyle,
                                backgroundColor: selectedTagsToAdd.includes(tag) ? '#c8e6c9' : '#e3f2fd',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                if (selectedTagsToAdd.includes(tag)) {
                                  setSelectedTagsToAdd(selectedTagsToAdd.filter(t => t !== tag));
                                } else {
                                  setSelectedTagsToAdd([...selectedTagsToAdd, tag]);
                                }
                              }}
                            >
                              {tag} {selectedTagsToAdd.includes(tag) && '✓'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button onClick={updateCardTags} style={buttonStyle} disabled={loading}>
                      {loading ? 'Updating...' : 'Apply Changes'}
                    </button>
                    <button onClick={() => {
                      setSelectedTagsToAdd([]);
                      setSelectedTagsToRemove([]);
                    }} style={secondaryButtonStyle}>
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <div style={panelStyle}>
              <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Tag Summary</h2>
              {selectedTagsToAdd.length > 0 && (
                <div style={{marginBottom: '15px'}}>
                  <h3 style={{fontSize: '14px', color: '#2e7d32'}}>Tags to Add ({selectedTagsToAdd.length})</h3>
                  <div>
                    {selectedTagsToAdd.map(tag => (
                      <span key={tag} style={{...tagStyle, backgroundColor: '#c8e6c9'}}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {selectedTagsToRemove.length > 0 && (
                <div style={{marginBottom: '15px'}}>
                  <h3 style={{fontSize: '14px', color: '#d32f2f'}}>Tags to Remove ({selectedTagsToRemove.length})</h3>
                  <div>
                    {selectedTagsToRemove.map(tag => (
                      <span key={tag} style={{...tagStyle, backgroundColor: '#ffcdd2'}}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {availableTags && (
                <div>
                  <h3 style={{fontSize: '14px', marginBottom: '10px'}}>Available Tag Categories</h3>
                  {Object.entries(availableTags.tagsByCategory).map(([category, tags]) => (
                    <div key={category} style={{fontSize: '12px', margin: '5px 0'}}>
                      <strong>{category.replace('_', ' ')}:</strong> {tags.length} tags
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case 'synergy':
        return (
          <div style={gridStyle}>
            <div style={panelStyle}>
              <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Synergy Calculator</h2>
              
              <div style={{marginBottom: '20px'}}>
                <h3 style={{fontSize: '16px', marginBottom: '10px'}}>Commander</h3>
                {designatedCommander ? (
                  <div style={{padding: '10px', border: '2px solid #4caf50', borderRadius: '4px', backgroundColor: '#f1f8e9'}}>
                    <div style={{fontWeight: 'bold'}}>{designatedCommander.name}</div>
                    <div style={{fontSize: '12px', color: '#666'}}>{designatedCommander.type_line}</div>
                    <button onClick={clearCommander} style={{...secondaryButtonStyle, marginTop: '5px'}}>
                      Clear Commander
                    </button>
                  </div>
                ) : (
                  <div style={{padding: '20px', border: '2px dashed #ccc', borderRadius: '4px', textAlign: 'center', color: '#666'}}>
                    No commander designated. Select a card from Browse tab and click "Set as Commander".
                  </div>
                )}
              </div>
              
              <div style={{marginBottom: '20px'}}>
                <h3 style={{fontSize: '16px', marginBottom: '10px'}}>Cards to Compare</h3>
                {synergyCards.map((card, index) => (
                  <div key={index} className="synergy-search-container" style={{position: 'relative', marginBottom: '10px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <div style={{flex: 1, position: 'relative'}}>
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
                          <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            right: 0,
                            backgroundColor: 'white',
                            border: '1px solid #ccc',
                            borderTop: 'none',
                            borderRadius: '0 0 4px 4px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            zIndex: 1000,
                            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                          }}>
                            {getSynergySearchResults(index).map((searchCard, cardIndex) => (
                              <div
                                key={`synergy-${searchCard.id}-${index}-${cardIndex}-${synergySearchTerms[index].replace(/[^a-zA-Z0-9]/g, '')}`}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent input blur
                                  selectSynergyCard(index, searchCard);
                                }}
                                style={{
                                  padding: '8px 12px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f0f0f0',
                                  fontSize: '14px'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'white';
                                }}
                              >
                                <div style={{fontWeight: 'bold'}}>{searchCard.name}</div>
                                <div style={{fontSize: '12px', color: '#666'}}>{searchCard.type_line}</div>
                              </div>
                            ))}
                            {getSynergySearchResults(index).length === 0 && (
                              <div style={{padding: '12px', color: '#999', fontSize: '14px'}}>
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
                          style={{
                            ...secondaryButtonStyle,
                            margin: 0,
                            padding: '6px 12px',
                            fontSize: '12px'
                          }}
                        >
                          Clear
                        </button>
                      )}
                      
                      {synergyCards.length > 1 && (
                        <button
                          onClick={() => removeSynergyCardSlot(index)}
                          style={{
                            ...secondaryButtonStyle,
                            margin: 0,
                            padding: '6px 12px',
                            fontSize: '12px',
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
                      <div style={{
                        marginTop: '5px',
                        padding: '8px',
                        backgroundColor: '#f0f8ff',
                        border: '1px solid #4caf50',
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}>
                        <div style={{fontWeight: 'bold'}}>{card.name}</div>
                        <div style={{color: '#666'}}>{card.type_line} • CMC {card.cmc}</div>
                      </div>
                    )}
                  </div>
                ))}
                
                <button
                  onClick={addSynergyCardSlot}
                  style={secondaryButtonStyle}
                >
                  Add Another Card
                </button>
              </div>
              
              <button
                onClick={calculateSynergy}
                style={buttonStyle}
                disabled={!designatedCommander || synergyLoading}
              >
                {synergyLoading ? 'Calculating...' : 'Calculate Synergy'}
              </button>
            </div>
            
            <div style={panelStyle}>
              <h2 style={{fontSize: '18px', marginBottom: '15px'}}>Synergy Results</h2>
              
              {synergyResults ? (
                <div style={{maxHeight: '600px', overflowY: 'auto'}}>
                  {synergyResults.map((result, index) => (
                    <div key={index} style={{
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      padding: '15px',
                      margin: '10px 0',
                      backgroundColor: result.error ? '#fff5f5' : '#fafafa'
                    }}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
                        <h3 style={{fontSize: '16px', margin: 0, color: result.error ? '#c53030' : '#333'}}>
                          {result.cardName}
                        </h3>
                        {!result.error && (
                          <div style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: result.totalScore >= 50 ? '#2e7d32' : result.totalScore >= 20 ? '#f57c00' : '#d32f2f'
                          }}>
                            {result.totalScore.toFixed(1)}
                          </div>
                        )}
                      </div>
                      
                      {result.error ? (
                        <div style={{color: '#c53030'}}>{result.error}</div>
                      ) : (
                        <div>
                          <div style={{fontSize: '12px', marginBottom: '8px'}}>
                            <strong>Breakdown:</strong> Tag-based: {result.breakdown.tagBasedSynergy} | 
                            Basic: {result.breakdown.basicSynergy} | 
                            Keyword: {result.breakdown.keywordSynergy}
                          </div>
                          
                          <div style={{fontSize: '12px', marginBottom: '8px'}}>
                            <strong>Primary Source:</strong> {result.breakdown.primarySource}
                          </div>
                          
                          {result.cardMechanics.topTags.length > 0 && (
                            <div style={{fontSize: '12px'}}>
                              <strong>Top Tags:</strong> {result.cardMechanics.topTags.join(', ')}
                            </div>
                          )}
                          
                          {result.breakdown.keywordDetails.sharedKeywords?.length > 0 && (
                            <div style={{fontSize: '12px', marginTop: '5px'}}>
                              <strong>Shared Keywords:</strong> {result.breakdown.keywordDetails.sharedKeywords.join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{textAlign: 'center', padding: '40px', color: '#999'}}>
                  Set a commander and enter card names to calculate synergy scores.
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>Enhanced Card Database Explorer</h1>
      
      <div style={tabStyle}>
        <button
          style={tabButtonStyle(activeTab === 'browse')}
          onClick={() => setActiveTab('browse')}
        >
          Browse Cards
        </button>
        <button
          style={tabButtonStyle(activeTab === 'tags')}
          onClick={() => setActiveTab('tags')}
        >
          Edit Tags
        </button>
        <button
          style={tabButtonStyle(activeTab === 'synergy')}
          onClick={() => setActiveTab('synergy')}
        >
          Synergy Calculator
        </button>
      </div>
      
      {renderTabContent()}
    </div>
  );
}
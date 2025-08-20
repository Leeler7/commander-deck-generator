'use client';

import { useState, useEffect, useRef } from 'react';

interface TagData {
  id: number;
  name: string;
  category: string;
  description?: string;
  synergy_weight: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface CardData {
  id: string;
  name: string;
  type_line: string;
  mana_cost?: string;
}

export default function TagManagerPage() {
  const [tags, setTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTag, setEditingTag] = useState<TagData | null>(null);
  const [viewingCards, setViewingCards] = useState<{ tag: TagData; cards: CardData[] } | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  const [categories, setCategories] = useState<Array<{value: string; label: string}>>([]);
  const [categoryInput, setCategoryInput] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const [newTag, setNewTag] = useState({
    name: '',
    category: '',
    description: '',
    synergy_weight: 1.0,
    is_active: true
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Load categories on mount
  useEffect(() => {
    loadCategories();
  }, []);

  // Search for tags when search term or filters change
  useEffect(() => {
    const searchTimer = setTimeout(() => {
      searchTags();
    }, 300); // Debounce search

    return () => clearTimeout(searchTimer);
  }, [searchTerm, selectedCategory, showActiveOnly]);

  // Hide category suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryInputRef.current && !categoryInputRef.current.contains(event.target as Node)) {
        setShowCategorySuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadCategories = async () => {
    try {
      const response = await fetch('/api/admin/tag-categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const searchTags = async () => {
    // Show results if we have a search term OR a specific category selected OR showing all
    const hasSearchTerm = searchTerm.length >= 2;
    const hasCategory = selectedCategory && selectedCategory !== 'all';
    
    if (!hasSearchTerm && !hasCategory && searchTerm.length > 0) {
      // Don't search if search term is too short
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchTerm || '',
        limit: '50'
      });
      
      if (selectedCategory && selectedCategory !== 'all') {
        params.set('category', selectedCategory);
      }

      const response = await fetch(`/api/admin/search-tags?${params}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      let filteredTags = data.tags || [];
      
      // Apply active filter on client side
      if (showActiveOnly) {
        filteredTags = filteredTags.filter((tag: any) => tag.is_active !== false);
      }
      
      // Map the response to our TagData format
      const formattedTags = filteredTags.map((tag: any) => ({
        ...tag,
        id: tag.id || 0,
        synergy_weight: tag.synergy_weight || 1.0,
        is_active: tag.is_active !== false,
        usage_count: tag.count || 0,
        created_at: tag.created_at || new Date().toISOString(),
        updated_at: tag.updated_at || new Date().toISOString()
      }));
      
      setTags(formattedTags);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to search tags');
    } finally {
      setLoading(false);
    }
  };

  const loadCardsForTag = async (tag: TagData) => {
    setLoadingCards(true);
    try {
      const response = await fetch(`/api/admin/cards-by-tag?tag=${encodeURIComponent(tag.name)}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      setViewingCards({ tag, cards: data.cards || [] });
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load cards for tag');
    } finally {
      setLoadingCards(false);
    }
  };

  const handleCreateTag = async () => {
    try {
      const response = await fetch('/api/admin/manage-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTag)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      setNewTag({ name: '', category: '', description: '', synergy_weight: 1.0, is_active: true });
      setCategoryInput('');
      setShowAddForm(false);
      await searchTags();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create tag');
    }
  };

  const handleUpdateTag = async (tag: TagData) => {
    try {
      const response = await fetch('/api/admin/manage-tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tag)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      setEditingTag(null);
      await searchTags();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update tag');
    }
  };

  const handleDeleteTag = async (id: number) => {
    if (!confirm('Are you sure you want to delete this tag?')) return;
    
    try {
      const response = await fetch(`/api/admin/manage-tags?id=${id}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      await searchTags();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to delete tag');
    }
  };

  const getFilteredCategories = (input: string) => {
    const inputLower = input.toLowerCase();
    return categories.filter(cat => 
      cat.label.toLowerCase().includes(inputLower) || 
      cat.value.toLowerCase().includes(inputLower)
    );
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Normalized Tag Manager</h1>
      
      {error && (
        <div style={{ background: '#ffebee', color: '#c62828', padding: '10px', marginBottom: '20px', borderRadius: '4px' }}>
          {error}
          <button onClick={() => setError(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Search and Filter Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 250px' }}>
          <input
            type="text"
            placeholder="Search tags..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: '1px solid #ddd', 
              borderRadius: '4px' 
            }}
          />
        </div>
        
        <div>
          <label>Category: </label>
          <select 
            value={selectedCategory} 
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label>
            <input 
              type="checkbox" 
              checked={showActiveOnly} 
              onChange={e => setShowActiveOnly(e.target.checked)} 
            /> Active Tags Only
          </label>
        </div>
        
        <button 
          onClick={() => setShowAddForm(true)}
          style={{ background: '#2196f3', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Add New Tag
        </button>
      </div>

      {/* Add New Tag Form */}
      {showAddForm && (
        <div style={{ background: '#f5f5f5', padding: '15px', marginBottom: '20px', borderRadius: '8px' }}>
          <h3>Add New Tag</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
            <input
              placeholder="Tag Name"
              value={newTag.name}
              onChange={e => setNewTag({...newTag, name: e.target.value})}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <div style={{ position: 'relative' }} ref={categoryInputRef}>
              <input
                placeholder="Category (type to search or add new)"
                value={categoryInput}
                onChange={e => {
                  setCategoryInput(e.target.value);
                  setNewTag({...newTag, category: e.target.value});
                  setShowCategorySuggestions(true);
                }}
                onFocus={() => setShowCategorySuggestions(true)}
                style={{ 
                  width: '100%',
                  padding: '8px', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px' 
                }}
              />
              {showCategorySuggestions && categoryInput && (
                <div style={{ 
                  position: 'absolute', 
                  top: '100%', 
                  left: 0, 
                  right: 0, 
                  background: 'white', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px', 
                  maxHeight: '200px', 
                  overflowY: 'auto',
                  zIndex: 1000,
                  marginTop: '2px'
                }}>
                  {getFilteredCategories(categoryInput).length > 0 ? (
                    getFilteredCategories(categoryInput).map(cat => (
                      <div 
                        key={cat.value}
                        onClick={() => {
                          setCategoryInput(cat.value);
                          setNewTag({...newTag, category: cat.value});
                          setShowCategorySuggestions(false);
                        }}
                        style={{ 
                          padding: '8px', 
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      >
                        {cat.label} ({cat.value})
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '8px', color: '#666' }}>
                      Press Enter to create new category: "{categoryInput}"
                    </div>
                  )}
                </div>
              )}
            </div>
            <input
              placeholder="Description (optional)"
              value={newTag.description}
              onChange={e => setNewTag({...newTag, description: e.target.value})}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <input
              type="number"
              step="0.1"
              placeholder="Synergy Weight"
              value={newTag.synergy_weight}
              onChange={e => setNewTag({...newTag, synergy_weight: parseFloat(e.target.value) || 1.0})}
              style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>
              <input 
                type="checkbox" 
                checked={newTag.is_active} 
                onChange={e => setNewTag({...newTag, is_active: e.target.checked})} 
              /> Active
            </label>
          </div>
          <button onClick={handleCreateTag} style={{ marginRight: '10px', background: '#4caf50', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Create Tag
          </button>
          <button onClick={() => {
            setShowAddForm(false);
            setCategoryInput('');
            setNewTag({ name: '', category: '', description: '', synergy_weight: 1.0, is_active: true });
          }} style={{ background: '#f44336', color: 'white', padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Cancel
          </button>
        </div>
      )}

      {/* Cards View Modal */}
      {viewingCards && (
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(0,0,0,0.5)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          zIndex: 2000 
        }}>
          <div style={{ 
            background: 'white', 
            padding: '20px', 
            borderRadius: '8px', 
            maxWidth: '800px', 
            maxHeight: '80vh', 
            overflow: 'auto',
            width: '90%'
          }}>
            <h2>Cards using "{viewingCards.tag.name}"</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>
              {viewingCards.cards.length} cards found
            </p>
            {loadingCards ? (
              <div>Loading cards...</div>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {viewingCards.cards.map(card => (
                  <div key={card.id} style={{ 
                    padding: '10px', 
                    borderBottom: '1px solid #eee',
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <strong>{card.name}</strong>
                      <div style={{ fontSize: '14px', color: '#666' }}>
                        {card.type_line}
                      </div>
                    </div>
                    {card.mana_cost && (
                      <div style={{ color: '#666' }}>{card.mana_cost}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <button 
              onClick={() => setViewingCards(null)}
              style={{ 
                marginTop: '20px', 
                background: '#2196f3', 
                color: 'white', 
                padding: '8px 16px', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer' 
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Tags List */}
      <div style={{ background: 'white', border: '1px solid #ddd', borderRadius: '8px' }}>
        <div style={{ padding: '15px', borderBottom: '1px solid #eee', background: '#f9f9f9', fontWeight: 'bold' }}>
          {loading ? 'Searching...' : `${tags.length} Tags Found`}
          {searchTerm && <span style={{ fontWeight: 'normal', marginLeft: '10px' }}>
            (searching for "{searchTerm}")
          </span>}
        </div>
        
        {!loading && (
          <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {tags.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
                {searchTerm ? 'No tags found matching your search' : 'No tags found'}
              </div>
            ) : (
              tags.map(tag => (
                <div key={tag.id || tag.name} style={{ padding: '15px', borderBottom: '1px solid #eee' }}>
                  {editingTag?.id === tag.id ? (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                        <input
                          value={editingTag.name}
                          onChange={e => setEditingTag({...editingTag, name: e.target.value})}
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <input
                          value={editingTag.category}
                          onChange={e => setEditingTag({...editingTag, category: e.target.value})}
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <input
                          value={editingTag.description || ''}
                          onChange={e => setEditingTag({...editingTag, description: e.target.value})}
                          placeholder="Description"
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                        <input
                          type="number"
                          step="0.1"
                          value={editingTag.synergy_weight}
                          onChange={e => setEditingTag({...editingTag, synergy_weight: parseFloat(e.target.value) || 1.0})}
                          style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ marginBottom: '10px' }}>
                        <label>
                          <input 
                            type="checkbox" 
                            checked={editingTag.is_active} 
                            onChange={e => setEditingTag({...editingTag, is_active: e.target.checked})} 
                          /> Active
                        </label>
                      </div>
                      <button onClick={() => handleUpdateTag(editingTag)} style={{ marginRight: '10px', background: '#4caf50', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Save
                      </button>
                      <button onClick={() => setEditingTag(null)} style={{ background: '#f44336', color: 'white', padding: '6px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 8px 0', color: tag.is_active ? '#333' : '#999' }}>
                            {tag.name}
                            {!tag.is_active && <span style={{ color: '#f44336', marginLeft: '8px' }}>(INACTIVE)</span>}
                          </h4>
                          <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                            <strong>Category:</strong> {tag.category} | 
                            <strong> Weight:</strong> {tag.synergy_weight} | 
                            <strong> Usage:</strong> {tag.usage_count} cards
                          </div>
                          {tag.description && (
                            <div style={{ fontSize: '14px', color: '#555', marginTop: '8px' }}>
                              {tag.description}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginLeft: '15px', flexWrap: 'wrap' }}>
                          <button 
                            onClick={() => loadCardsForTag(tag)}
                            style={{ background: '#9c27b0', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            View Cards
                          </button>
                          <button 
                            onClick={() => setEditingTag(tag)}
                            style={{ background: '#2196f3', color: 'white', padding: '4px 8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteTag(tag.id)}
                            disabled={tag.usage_count > 0}
                            style={{ 
                              background: tag.usage_count > 0 ? '#ccc' : '#f44336', 
                              color: 'white', 
                              padding: '4px 8px', 
                              border: 'none', 
                              borderRadius: '4px', 
                              cursor: tag.usage_count > 0 ? 'not-allowed' : 'pointer',
                              fontSize: '12px'
                            }}
                            title={tag.usage_count > 0 ? `Cannot delete: used by ${tag.usage_count} cards` : 'Delete tag'}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
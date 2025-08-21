'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface CardData {
  id: string;
  name: string;
  type_line: string;
  mechanic_tags?: Array<{
    tag_name: string;
    tag_category: string;
    priority: number;
    confidence: number;
    name: string; // Legacy support
    category: string; // Legacy support
  }>;
}

interface AvailableTags {
  allTags: string[];
  tagsByCategory: Record<string, string[]>;
  totalCount: number;
}

export default function TagEditorPage() {
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null);
  const [availableTags, setAvailableTags] = useState<AvailableTags | null>(null);
  const [selectedTagsToAdd, setSelectedTagsToAdd] = useState<string[]>([]);
  const [selectedTagsToRemove, setSelectedTagsToRemove] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Load available tags on mount
  useEffect(() => {
    loadAvailableTags();
  }, []);

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

  const loadCardDetails = async (cardName: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/details?name=${encodeURIComponent(cardName)}`);
      if (!response.ok) {
        throw new Error(`Failed to load card: ${response.statusText}`);
      }
      const cardDetails = await response.json();
      setSelectedCard(cardDetails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load card');
    } finally {
      setLoading(false);
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

      // Refresh the card details
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

  const panelStyle = {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px',
    minHeight: '500px'
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
                TAG EDITOR
              </h1>
              <p className="text-gray-600">Edit and manage card tags and mechanics</p>
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
          
          {/* Card Selection */}
          <div style={panelStyle}>
            <h2 className="text-lg font-semibold mb-4">Select Card to Edit</h2>
            
            <input
              type="text"
              placeholder="Enter card name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={inputStyle}
            />
            
            <button
              onClick={() => searchTerm.trim() && loadCardDetails(searchTerm.trim())}
              style={buttonStyle}
              disabled={!searchTerm.trim() || loading}
            >
              {loading ? 'Loading...' : 'Load Card'}
            </button>

            {selectedCard && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold text-lg">{selectedCard.name}</h3>
                <p className="text-gray-600">{selectedCard.type_line}</p>
                
                {selectedCard.mechanic_tags && selectedCard.mechanic_tags.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-semibold mb-2">Current Tags:</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedCard.mechanic_tags.map((tag, index) => (
                        <span
                          key={index}
                          className={`px-2 py-1 text-xs rounded-md cursor-pointer border ${
                            selectedTagsToRemove.includes(tag.tag_name || tag.name)
                              ? 'bg-red-100 border-red-300 text-red-700'
                              : 'bg-blue-100 border-blue-300 text-blue-700'
                          }`}
                          onClick={() => toggleTagForRemoval(tag.tag_name || tag.name)}
                        >
                          {tag.tag_name || tag.name} (P:{tag.priority}, C:{tag.confidence.toFixed(2)})
                          {selectedTagsToRemove.includes(tag.tag_name || tag.name) && ' ❌'}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Click on tags to mark them for removal
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tag Management */}
          <div style={panelStyle}>
            <h2 className="text-lg font-semibold mb-4">Manage Tags</h2>
            
            {selectedTagsToAdd.length > 0 && (
              <div className="mb-4 p-3 bg-green-50 rounded-lg">
                <h3 className="font-semibold text-green-800 mb-2">Tags to Add ({selectedTagsToAdd.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTagsToAdd.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-green-200 text-green-800 text-xs rounded-md">
                      +{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedTagsToRemove.length > 0 && (
              <div className="mb-4 p-3 bg-red-50 rounded-lg">
                <h3 className="font-semibold text-red-800 mb-2">Tags to Remove ({selectedTagsToRemove.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTagsToRemove.map(tag => (
                    <span key={tag} className="px-2 py-1 bg-red-200 text-red-800 text-xs rounded-md">
                      -{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {availableTags && (
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Available Tags by Category</h3>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {Object.entries(availableTags.tagsByCategory).map(([category, tags]) => (
                    <div key={category} className="border rounded-lg p-3">
                      <h4 className="font-medium text-sm text-gray-700 mb-2">
                        {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} ({tags.length})
                      </h4>
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 20).map(tag => (
                          <button
                            key={tag}
                            onClick={() => toggleTagForAddition(tag)}
                            className={`px-2 py-1 text-xs rounded-md border cursor-pointer transition-colors ${
                              selectedTagsToAdd.includes(tag)
                                ? 'bg-green-100 border-green-300 text-green-700'
                                : selectedCard?.mechanic_tags?.some(t => (t.tag_name || t.name) === tag)
                                ? 'bg-gray-100 border-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300'
                            }`}
                            disabled={selectedCard?.mechanic_tags?.some(t => (t.tag_name || t.name) === tag)}
                          >
                            {selectedTagsToAdd.includes(tag) ? `✓ ${tag}` : tag}
                          </button>
                        ))}
                        {tags.length > 20 && (
                          <span className="px-2 py-1 text-xs text-gray-500">
                            +{tags.length - 20} more...
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedCard && (selectedTagsToAdd.length > 0 || selectedTagsToRemove.length > 0) && (
              <div className="flex gap-2">
                <button
                  onClick={updateCardTags}
                  style={buttonStyle}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Updating...' : 'Update Tags'}
                </button>
                <button
                  onClick={() => {
                    setSelectedTagsToAdd([]);
                    setSelectedTagsToRemove([]);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear Changes
                </button>
              </div>
            )}

            {!selectedCard && (
              <div className="text-center py-12 text-gray-500">
                <h3 className="text-lg mb-2">No Card Selected</h3>
                <p>Enter a card name above to start editing tags.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
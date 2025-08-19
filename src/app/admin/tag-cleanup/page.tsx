'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TagStats {
  tag: string;
  count: number;
  percentage: number;
}

interface CardWithTags {
  id: string;
  name: string;
  tags: string[];
}

export default function TagCleanupPage() {
  const [loading, setLoading] = useState(false);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [blacklistedTags, setBlacklistedTags] = useState<Set<string>>(new Set());
  const [customBlacklist, setCustomBlacklist] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterThreshold, setFilterThreshold] = useState(30);
  const [previewMode, setPreviewMode] = useState(false);
  const [affectedCards, setAffectedCards] = useState<CardWithTags[]>([]);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);

  useEffect(() => {
    loadTagStatistics();
    loadBlacklist();
  }, []);

  const loadTagStatistics = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/tag-statistics');
      if (!response.ok) throw new Error('Failed to load tag statistics');
      const data = await response.json();
      setTagStats(data.tags);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load tag statistics' });
    } finally {
      setLoading(false);
    }
  };

  const loadBlacklist = async () => {
    try {
      const response = await fetch('/api/admin/tag-blacklist');
      if (!response.ok) throw new Error('Failed to load blacklist');
      const data = await response.json();
      setBlacklistedTags(new Set(data.blacklist));
    } catch (error) {
      console.error('Failed to load blacklist:', error);
    }
  };

  const saveBlacklist = async (newBlacklist: Set<string>) => {
    try {
      const response = await fetch('/api/admin/tag-blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blacklist: Array.from(newBlacklist) })
      });
      if (!response.ok) throw new Error('Failed to save blacklist');
      setMessage({ type: 'success', text: 'Blacklist saved. Will auto-remove on next sync.' });
    } catch (error) {
      console.error('Failed to save blacklist:', error);
    }
  };

  const toggleTag = (tag: string) => {
    const newSelected = new Set(selectedTags);
    if (newSelected.has(tag)) {
      newSelected.delete(tag);
    } else {
      newSelected.add(tag);
    }
    setSelectedTags(newSelected);
  };

  const selectOverusedTags = () => {
    const overused = tagStats
      .filter(t => t.percentage > filterThreshold)
      .map(t => t.tag);
    setSelectedTags(new Set(overused));
    setMessage({ type: 'info', text: `Selected ${overused.length} tags over ${filterThreshold}% usage` });
  };

  const selectBlacklistedTags = () => {
    const blacklisted = tagStats
      .filter(t => blacklistedTags.has(t.tag))
      .map(t => t.tag);
    setSelectedTags(new Set(blacklisted));
    setMessage({ type: 'info', text: `Selected ${blacklisted.length} blacklisted tags` });
  };

  const addToBlacklist = async () => {
    const tags = customBlacklist.split(',').map(t => t.trim()).filter(t => t);
    const newBlacklist = new Set([...blacklistedTags, ...tags]);
    setBlacklistedTags(newBlacklist);
    setCustomBlacklist('');
    await saveBlacklist(newBlacklist);
    setMessage({ type: 'success', text: `Added ${tags.length} tags to blacklist. Will auto-remove on sync.` });
  };

  const previewChanges = async () => {
    if (selectedTags.size === 0) {
      setMessage({ type: 'error', text: 'No tags selected' });
      return;
    }
    
    setProcessing(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/preview-tag-removal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: Array.from(selectedTags) })
      });
      
      if (!response.ok) throw new Error('Failed to preview changes');
      const data = await response.json();
      setAffectedCards(data.affectedCards);
      setPreviewMode(true);
      setMessage({ type: 'info', text: `Preview: ${data.affectedCards.length} cards would be affected` });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to preview changes' });
    } finally {
      setProcessing(false);
    }
  };

  const applyChanges = async () => {
    if (selectedTags.size === 0) {
      setMessage({ type: 'error', text: 'No tags selected' });
      return;
    }

    if (!confirm(`Remove ${selectedTags.size} tags from the database? This will affect ${affectedCards.length} cards.`)) {
      return;
    }
    
    setProcessing(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/bulk-remove-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: Array.from(selectedTags) })
      });
      
      if (!response.ok) throw new Error('Failed to remove tags');
      const data = await response.json();
      
      setMessage({ type: 'success', text: `Successfully removed ${selectedTags.size} tags from ${data.cardsModified} cards` });
      setSelectedTags(new Set());
      setPreviewMode(false);
      setAffectedCards([]);
      await loadTagStatistics();
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove tags' });
    } finally {
      setProcessing(false);
    }
  };

  const filteredTags = tagStats.filter(t => 
    t.tag.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTagColor = (percentage: number) => {
    if (percentage > 50) return 'text-red-600 bg-red-50';
    if (percentage > 30) return 'text-orange-600 bg-orange-50';
    if (percentage > 15) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                TAG CLEANUP TOOL
              </h1>
              <p className="text-gray-600">Bulk manage and remove generic or overused tags</p>
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
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-800' :
            message.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' :
            'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
              <div>
                <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
                
                <div className="space-y-3">
                  <button
                    onClick={selectOverusedTags}
                    className="w-full bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                    disabled={processing}
                  >
                    Select Tags Over {filterThreshold}%
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="10"
                      max="50"
                      value={filterThreshold}
                      onChange={(e) => setFilterThreshold(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-12">{filterThreshold}%</span>
                  </div>
                  
                  <button
                    onClick={selectBlacklistedTags}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    disabled={processing}
                  >
                    Select Blacklisted Tags
                  </button>
                  
                  <button
                    onClick={() => setSelectedTags(new Set())}
                    className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                    disabled={processing}
                  >
                    Clear Selection
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-md font-semibold mb-3">Tag Blacklist</h3>
                <div className="mb-3 p-3 bg-gray-50 rounded max-h-32 overflow-y-auto">
                  {Array.from(blacklistedTags).map(tag => (
                    <span key={tag} className="inline-block m-1 px-2 py-1 bg-gray-200 rounded text-xs">
                      {tag}
                      <button
                        onClick={() => {
                          const newBlacklist = new Set(blacklistedTags);
                          newBlacklist.delete(tag);
                          setBlacklistedTags(newBlacklist);
                        }}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={customBlacklist}
                    onChange={(e) => setCustomBlacklist(e.target.value)}
                    placeholder="tag1, tag2, tag3..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addToBlacklist}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div>
                <h3 className="text-md font-semibold mb-3">Selected: {selectedTags.size} tags</h3>
                <div className="space-y-2">
                  <button
                    onClick={previewChanges}
                    className="w-full bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                    disabled={processing || selectedTags.size === 0}
                  >
                    Preview Changes
                  </button>
                  
                  <button
                    onClick={applyChanges}
                    className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    disabled={processing || selectedTags.size === 0}
                  >
                    Apply Changes
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tag List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="mb-4">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tags..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading tag statistics...</p>
                </div>
              ) : previewMode ? (
                <div>
                  <h3 className="text-lg font-semibold mb-4">Affected Cards Preview</h3>
                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg p-4">
                    {affectedCards.map(card => (
                      <div key={card.id} className="mb-3 p-3 bg-gray-50 rounded">
                        <div className="font-medium">{card.name}</div>
                        <div className="text-sm text-gray-600">
                          Removing: {card.tags.filter(t => selectedTags.has(t)).join(', ')}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Remaining: {card.tags.filter(t => !selectedTags.has(t)).join(', ') || 'none'}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setPreviewMode(false);
                      setAffectedCards([]);
                    }}
                    className="mt-4 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Back to Tags
                  </button>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredTags.map(tagStat => (
                    <div
                      key={tagStat.tag}
                      onClick={() => toggleTag(tagStat.tag)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedTags.has(tagStat.tag) 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:bg-gray-50'
                      } ${blacklistedTags.has(tagStat.tag) ? 'opacity-75' : ''}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            checked={selectedTags.has(tagStat.tag)}
                            onChange={() => {}}
                            className="rounded border-gray-300 text-blue-600"
                          />
                          <span className="font-medium">{tagStat.tag}</span>
                          {blacklistedTags.has(tagStat.tag) && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">BLACKLISTED</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-600">{tagStat.count} cards</span>
                          <span className={`text-sm font-medium px-2 py-1 rounded ${getTagColor(tagStat.percentage)}`}>
                            {tagStat.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
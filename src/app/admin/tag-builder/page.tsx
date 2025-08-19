'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PreviewCard {
  id: string;
  name: string;
  oracle_text: string;
  colors: string[];
  color_identity: string[];
  type_line: string;
  currentTags: string[];
}

export default function TagBuilderPage() {
  const [newTagName, setNewTagName] = useState('');
  const [searchMode, setSearchMode] = useState<'text' | 'color' | 'type'>('text');
  const [textQuery, setTextQuery] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [typeQuery, setTypeQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [exactMatch, setExactMatch] = useState(false);
  const [previewCards, setPreviewCards] = useState<PreviewCard[]>([]);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  const [stats, setStats] = useState<{ matching: number; total: number } | null>(null);

  const colorOptions = [
    { code: 'W', name: 'White', bgColor: 'bg-yellow-100', borderColor: 'border-yellow-400' },
    { code: 'U', name: 'Blue', bgColor: 'bg-blue-100', borderColor: 'border-blue-400' },
    { code: 'B', name: 'Black', bgColor: 'bg-gray-800', borderColor: 'border-gray-600' },
    { code: 'R', name: 'Red', bgColor: 'bg-red-100', borderColor: 'border-red-400' },
    { code: 'G', name: 'Green', bgColor: 'bg-green-100', borderColor: 'border-green-400' }
  ];

  const multiColorCombos = [
    { colors: ['W', 'U'], name: 'Azorius', tag: 'multi_azorius' },
    { colors: ['W', 'B'], name: 'Orzhov', tag: 'multi_orzhov' },
    { colors: ['W', 'R'], name: 'Boros', tag: 'multi_boros' },
    { colors: ['W', 'G'], name: 'Selesnya', tag: 'multi_selesnya' },
    { colors: ['U', 'B'], name: 'Dimir', tag: 'multi_dimir' },
    { colors: ['U', 'R'], name: 'Izzet', tag: 'multi_izzet' },
    { colors: ['U', 'G'], name: 'Simic', tag: 'multi_simic' },
    { colors: ['B', 'R'], name: 'Rakdos', tag: 'multi_rakdos' },
    { colors: ['B', 'G'], name: 'Golgari', tag: 'multi_golgari' },
    { colors: ['R', 'G'], name: 'Gruul', tag: 'multi_gruul' },
    { colors: ['W', 'U', 'B'], name: 'Esper', tag: 'multi_esper' },
    { colors: ['W', 'U', 'R'], name: 'Jeskai', tag: 'multi_jeskai' },
    { colors: ['W', 'U', 'G'], name: 'Bant', tag: 'multi_bant' },
    { colors: ['W', 'B', 'R'], name: 'Mardu', tag: 'multi_mardu' },
    { colors: ['W', 'B', 'G'], name: 'Abzan', tag: 'multi_abzan' },
    { colors: ['W', 'R', 'G'], name: 'Naya', tag: 'multi_naya' },
    { colors: ['U', 'B', 'R'], name: 'Grixis', tag: 'multi_grixis' },
    { colors: ['U', 'B', 'G'], name: 'Sultai', tag: 'multi_sultai' },
    { colors: ['U', 'R', 'G'], name: 'Temur', tag: 'multi_temur' },
    { colors: ['B', 'R', 'G'], name: 'Jund', tag: 'multi_jund' },
    { colors: ['W', 'U', 'B', 'R'], name: '4-Color (no G)', tag: 'multi_nongreen' },
    { colors: ['W', 'U', 'B', 'G'], name: '4-Color (no R)', tag: 'multi_nonred' },
    { colors: ['W', 'U', 'R', 'G'], name: '4-Color (no B)', tag: 'multi_nonblack' },
    { colors: ['W', 'B', 'R', 'G'], name: '4-Color (no U)', tag: 'multi_nonblue' },
    { colors: ['U', 'B', 'R', 'G'], name: '4-Color (no W)', tag: 'multi_nonwhite' },
    { colors: ['W', 'U', 'B', 'R', 'G'], name: '5-Color', tag: 'multi_wubrg' }
  ];

  const toggleColor = (color: string) => {
    setSelectedColors(prev => 
      prev.includes(color) 
        ? prev.filter(c => c !== color)
        : [...prev, color].sort()
    );
  };

  const selectGuildColors = (colors: string[]) => {
    setSelectedColors(colors);
    // Auto-suggest tag name
    const combo = multiColorCombos.find(c => 
      c.colors.length === colors.length && 
      c.colors.every(color => colors.includes(color))
    );
    if (combo) {
      setNewTagName(combo.tag);
    }
  };

  const previewTag = async () => {
    if (!newTagName.trim()) {
      setMessage({ type: 'error', text: 'Please enter a tag name' });
      return;
    }

    if (searchMode === 'text' && !textQuery.trim()) {
      setMessage({ type: 'error', text: 'Please enter text to search for' });
      return;
    }

    if (searchMode === 'color' && selectedColors.length === 0) {
      setMessage({ type: 'error', text: 'Please select at least one color' });
      return;
    }

    if (searchMode === 'type' && !typeQuery.trim()) {
      setMessage({ type: 'error', text: 'Please enter a type to search for' });
      return;
    }

    setProcessing(true);
    setMessage(null);
    
    try {
      const searchCriteria = {
        mode: searchMode,
        textQuery: searchMode === 'text' ? textQuery : undefined,
        colors: searchMode === 'color' ? selectedColors : undefined,
        typeQuery: searchMode === 'type' ? typeQuery : undefined,
        caseSensitive,
        exactMatch
      };

      const response = await fetch('/api/admin/preview-tag-addition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tagName: newTagName.trim(),
          criteria: searchCriteria
        })
      });

      if (!response.ok) throw new Error('Failed to preview tag addition');
      
      const data = await response.json();
      setPreviewCards(data.matchingCards);
      setStats({ matching: data.totalMatching, total: data.totalCards });
      setMessage({ 
        type: 'info', 
        text: `Found ${data.totalMatching} cards matching criteria (showing first ${Math.min(50, data.totalMatching)})` 
      });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to preview changes' });
    } finally {
      setProcessing(false);
    }
  };

  const applyTag = async () => {
    if (previewCards.length === 0) {
      setMessage({ type: 'error', text: 'No cards to tag' });
      return;
    }

    if (!confirm(`Add "${newTagName}" tag to ${stats?.matching || 0} cards?`)) {
      return;
    }

    setProcessing(true);
    setMessage(null);

    try {
      const searchCriteria = {
        mode: searchMode,
        textQuery: searchMode === 'text' ? textQuery : undefined,
        colors: searchMode === 'color' ? selectedColors : undefined,
        typeQuery: searchMode === 'type' ? typeQuery : undefined,
        caseSensitive,
        exactMatch
      };

      const response = await fetch('/api/admin/apply-tag-addition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tagName: newTagName.trim(),
          criteria: searchCriteria
        })
      });

      if (!response.ok) throw new Error('Failed to add tag');
      
      const data = await response.json();
      setMessage({ 
        type: 'success', 
        text: `Successfully added "${newTagName}" tag to ${data.cardsModified} cards` 
      });
      
      // Reset form
      setPreviewCards([]);
      setStats(null);
      setNewTagName('');
      setTextQuery('');
      setSelectedColors([]);
      setTypeQuery('');
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to apply tag' });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                TAG BUILDER
              </h1>
              <p className="text-gray-600">Add tags to cards based on text, colors, or type</p>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Tag Name
                </label>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="e.g., target_creature, multi_golgari"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Mode
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="text"
                      checked={searchMode === 'text'}
                      onChange={(e) => setSearchMode(e.target.value as 'text')}
                      className="mr-2"
                    />
                    <span>Oracle Text Contains</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="color"
                      checked={searchMode === 'color'}
                      onChange={(e) => setSearchMode(e.target.value as 'color')}
                      className="mr-2"
                    />
                    <span>Color Identity</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="type"
                      checked={searchMode === 'type'}
                      onChange={(e) => setSearchMode(e.target.value as 'type')}
                      className="mr-2"
                    />
                    <span>Type Line Contains</span>
                  </label>
                </div>
              </div>

              {searchMode === 'text' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Text
                    </label>
                    <input
                      type="text"
                      value={textQuery}
                      onChange={(e) => setTextQuery(e.target.value)}
                      placeholder='e.g., "target creature" or "draw a card"'
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={caseSensitive}
                        onChange={(e) => setCaseSensitive(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">Case Sensitive</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={exactMatch}
                        onChange={(e) => setExactMatch(e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm">Exact Match Only</span>
                    </label>
                  </div>
                </div>
              )}

              {searchMode === 'color' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Colors
                    </label>
                    <div className="flex space-x-2 mb-3">
                      {colorOptions.map(color => (
                        <button
                          key={color.code}
                          onClick={() => toggleColor(color.code)}
                          className={`w-10 h-10 rounded-full border-2 ${color.bgColor} ${color.borderColor} ${
                            selectedColors.includes(color.code) ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title={color.name}
                        />
                      ))}
                    </div>
                    <div className="text-sm text-gray-600">
                      Selected: {selectedColors.join(', ') || 'None'}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick Select Guild/Shard
                    </label>
                    <select
                      onChange={(e) => {
                        const combo = multiColorCombos.find(c => c.tag === e.target.value);
                        if (combo) selectGuildColors(combo.colors);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value=""
                    >
                      <option value="">Choose preset...</option>
                      {multiColorCombos.map(combo => (
                        <option key={combo.tag} value={combo.tag}>
                          {combo.name} ({combo.colors.join('')})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {searchMode === 'type' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type Line Text
                  </label>
                  <input
                    type="text"
                    value={typeQuery}
                    onChange={(e) => setTypeQuery(e.target.value)}
                    placeholder='e.g., "Legendary Creature", "Artifact"'
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="space-y-2">
                <button
                  onClick={previewTag}
                  disabled={processing || !newTagName.trim()}
                  className="w-full bg-yellow-600 text-white px-4 py-3 rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-gray-400"
                >
                  Preview Matching Cards
                </button>
                
                {previewCards.length > 0 && (
                  <button
                    onClick={applyTag}
                    disabled={processing}
                    className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                  >
                    Apply Tag to {stats?.matching || 0} Cards
                  </button>
                )}
              </div>

              {stats && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm text-gray-600">
                    <div>Matching Cards: <span className="font-bold">{stats.matching}</span></div>
                    <div>Total Cards: {stats.total}</div>
                    <div>Coverage: {((stats.matching / stats.total) * 100).toFixed(1)}%</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Preview Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Preview Cards</h2>
              
              {previewCards.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No preview available. Configure your search criteria and click "Preview Matching Cards"</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {previewCards.map(card => (
                    <div key={card.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-medium text-gray-900">{card.name}</div>
                          <div className="text-xs text-gray-600">{card.type_line}</div>
                        </div>
                        <div className="flex space-x-1">
                          {(card.color_identity || []).map(color => (
                            <span
                              key={color}
                              className={`w-5 h-5 rounded-full border-2 ${
                                colorOptions.find(c => c.code === color)?.bgColor || 'bg-gray-300'
                              } ${
                                colorOptions.find(c => c.code === color)?.borderColor || 'border-gray-500'
                              }`}
                              title={colorOptions.find(c => c.code === color)?.name || color}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {searchMode === 'text' && (
                        <div className="text-sm text-gray-700 mb-2 p-2 bg-white rounded border border-gray-200">
                          {card.oracle_text.substring(0, 150)}
                          {card.oracle_text.length > 150 && '...'}
                        </div>
                      )}
                      
                      <div className="text-xs">
                        <span className="text-gray-500">Current tags: </span>
                        <span className="text-gray-700">
                          {card.currentTags.length > 0 ? card.currentTags.slice(0, 5).join(', ') : 'none'}
                          {card.currentTags.length > 5 && ` +${card.currentTags.length - 5} more`}
                        </span>
                      </div>
                      
                      <div className="text-xs mt-1">
                        <span className="text-green-600 font-medium">
                          Will add: "{newTagName}"
                        </span>
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
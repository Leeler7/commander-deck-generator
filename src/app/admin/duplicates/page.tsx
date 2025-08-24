'use client';

import React, { useState, useEffect } from 'react';

interface DuplicateGroup {
  name: string;
  count: number;
  instances?: CardInstance[];
}

interface CardInstance {
  id: string;
  name: string;
  set_name: string;
  set: string;
  released_at: string;
  rarity: string;
  created_at: string;
}

interface DuplicateAnalysis {
  analysis: {
    totalCards: number;
    uniqueCardNames: number;
    duplicateGroups: number;
    estimatedDuplicateCards: number;
    potentialSpaceSaving: string;
  };
  topDuplicates: DuplicateGroup[];
  duplicateDetails: Array<{
    name: string;
    count: number;
    instances: CardInstance[];
  }>;
  recommendation: string;
}

export default function DuplicatesPage() {
  const [analysis, setAnalysis] = useState<DuplicateAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [deduplicating, setDeduplicating] = useState(false);
  const [showDetails, setShowDetails] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadDuplicateAnalysis();
  }, []);

  const loadDuplicateAnalysis = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/deduplicate-cards-simple');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load duplicate analysis');
      console.error('Error loading duplicates:', err);
    } finally {
      setLoading(false);
    }
  };

  const runDeduplication = async (dryRun: boolean = true) => {
    try {
      setDeduplicating(true);
      setError(null);
      
      const response = await fetch('/api/admin/deduplicate-cards-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        alert(`${dryRun ? 'DRY RUN' : 'DEDUPLICATION'} completed!\n\n${result.results.message}`);
        
        // Reload the analysis after actual deduplication
        if (!dryRun) {
          await loadDuplicateAnalysis();
        }
      } else {
        throw new Error(result.error || 'Deduplication failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Deduplication failed';
      setError(errorMsg);
      console.error('Deduplication error:', err);
    } finally {
      setDeduplicating(false);
    }
  };

  const toggleDetails = (cardName: string) => {
    setShowDetails(prev => ({
      ...prev,
      [cardName]: !prev[cardName]
    }));
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Card Duplicates Management</h1>
        <div className="flex items-center justify-center py-12">
          <div className="text-lg">Loading duplicate analysis...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Card Duplicates Management</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
        <button
          onClick={loadDuplicateAnalysis}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Card Duplicates Management</h1>
        <div className="text-gray-500">No analysis data available.</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Card Duplicates Management</h1>
      
      {/* Summary Stats */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Database Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{analysis.analysis.totalCards.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Total Cards</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{analysis.analysis.uniqueCardNames.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Unique Names</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{analysis.analysis.duplicateGroups.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Duplicate Groups</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{analysis.analysis.estimatedDuplicateCards.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Duplicate Cards</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{analysis.analysis.potentialSpaceSaving}</div>
            <div className="text-sm text-gray-600">Space Saving</div>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 rounded">
          <strong>Recommendation:</strong> {analysis.recommendation}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="flex gap-4">
          <button
            onClick={() => runDeduplication(true)}
            disabled={deduplicating}
            className="bg-blue-500 text-white px-6 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {deduplicating ? 'Processing...' : 'Preview Deduplication (Dry Run)'}
          </button>
          <button
            onClick={() => {
              if (confirm('Are you sure you want to permanently delete duplicate cards? This cannot be undone!')) {
                runDeduplication(false);
              }
            }}
            disabled={deduplicating || analysis.analysis.duplicateGroups === 0}
            className="bg-red-500 text-white px-6 py-2 rounded hover:bg-red-600 disabled:opacity-50"
          >
            {deduplicating ? 'Processing...' : 'Run Actual Deduplication'}
          </button>
          <button
            onClick={loadDuplicateAnalysis}
            disabled={deduplicating}
            className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 disabled:opacity-50"
          >
            Refresh Analysis
          </button>
        </div>
      </div>

      {/* Top Duplicates */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Most Duplicated Cards</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Card Name</th>
                <th className="px-4 py-2 text-left">Copies</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {analysis.topDuplicates.map((duplicate, index) => (
                <tr key={index} className="border-b">
                  <td className="px-4 py-2 font-medium">{duplicate.name}</td>
                  <td className="px-4 py-2">
                    <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                      {duplicate.count} copies
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => toggleDetails(duplicate.name)}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      {showDetails[duplicate.name] ? 'Hide Details' : 'View Details'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Examples */}
      {analysis.duplicateDetails.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Duplicate Examples</h2>
          {analysis.duplicateDetails.map((detail, index) => (
            <div key={index} className="mb-6 border-b pb-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium">
                  {detail.name} ({detail.count} copies)
                </h3>
                <button
                  onClick={() => toggleDetails(detail.name)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  {showDetails[detail.name] ? 'Hide' : 'Show'} Instances
                </button>
              </div>
              
              {showDetails[detail.name] && (
                <div className="grid gap-2">
                  {detail.instances.map((instance, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                      <div>
                        <span className="font-medium">{instance.set_name}</span>
                        <span className="text-gray-600 ml-2">({instance.set})</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${
                          idx === 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {idx === 0 ? 'KEEP' : 'DELETE'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(instance.released_at)} • {instance.rarity}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
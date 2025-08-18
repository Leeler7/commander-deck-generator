'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SystemStats {
  database: {
    totalCards: number;
    commanderCards: number;
    cardsWithMechanics: number;
    totalTags: number;
    avgTagsPerCard: number;
    topTags: Array<{ name: string; count: number }>;
    databaseSize: string;
    lastUpdated: string;
  };
}

export default function SystemStatsPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, []);

  // Handle auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(loadStats, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
    } else if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
    };
  }, [autoRefresh]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/system-stats');
      if (!response.ok) {
        throw new Error(`Failed to load stats: ${response.statusText}`);
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system stats');
    } finally {
      setLoading(false);
    }
  };


  const panelStyle = {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px'
  };

  const statCardStyle = {
    backgroundColor: '#f8f9fa',
    border: '1px solid #e9ecef',
    borderRadius: '6px',
    padding: '16px',
    textAlign: 'center' as const
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                SYSTEM STATISTICS
              </h1>
              <p className="text-gray-600">Real database statistics and metrics</p>
            </div>
            <div className="flex items-center space-x-4">
              <label className="flex items-center text-sm">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 mr-2"
                />
                Auto-refresh (30s)
              </label>
              <Link 
                href="/admin"
                className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
              >
                ← Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Control Panel */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button 
              onClick={loadStats}
              style={buttonStyle}
              disabled={loading}
            >
              {loading ? 'Refreshing...' : 'Refresh Stats'}
            </button>
          </div>
          {stats && (
            <div className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          )}
        </div>

        {loading && !stats ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading system statistics...</p>
          </div>
        ) : stats ? (
          <div className="space-y-8">
            
            {/* Database Stats */}
            <div style={panelStyle}>
              <h2 className="text-xl font-semibold mb-6 text-gray-900">Database Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div style={statCardStyle}>
                  <div className="text-2xl font-bold text-blue-600">{stats.database.totalCards.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Total Cards</div>
                </div>
                <div style={statCardStyle}>
                  <div className="text-2xl font-bold text-green-600">{stats.database.commanderCards.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Commanders</div>
                </div>
                <div style={statCardStyle}>
                  <div className="text-2xl font-bold text-purple-600">{stats.database.totalTags.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Total Tags</div>
                </div>
                <div style={statCardStyle}>
                  <div className="text-2xl font-bold text-orange-600">{stats.database.avgTagsPerCard.toFixed(1)}</div>
                  <div className="text-sm text-gray-600">Avg Tags/Card</div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Most Popular Tags</h3>
                  <div className="space-y-2">
                    {stats.database.topTags.slice(0, 8).map((tag, index) => (
                      <div key={tag.name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{tag.name}</span>
                        <span className="text-sm text-gray-600">{tag.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-3">Database Info</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Database Size:</span>
                      <span className="text-sm font-medium">{stats.database.databaseSize}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Last Updated:</span>
                      <span className="text-sm font-medium">{new Date(stats.database.lastUpdated).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Cards with Mechanics:</span>
                      <span className="text-sm font-medium">{stats.database.cardsWithMechanics.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Future Analytics Note */}
            <div style={{...panelStyle, backgroundColor: '#f8f9fa', border: '1px dashed #dee2e6'}}>
              <h2 className="text-xl font-semibold mb-4 text-gray-700">Analytics Coming Soon</h2>
              <p className="text-gray-600 mb-4">
                Real-time analytics for deck generation, user activity, and performance metrics will be added in a future update. 
                Currently showing only verified database statistics.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-50">
                <div className="text-center p-4 bg-white rounded border-2 border-dashed border-gray-300">
                  <div className="text-lg font-bold text-gray-400">📊</div>
                  <div className="text-sm text-gray-500 mt-2">Generation Analytics</div>
                </div>
                <div className="text-center p-4 bg-white rounded border-2 border-dashed border-gray-300">
                  <div className="text-lg font-bold text-gray-400">👥</div>
                  <div className="text-sm text-gray-500 mt-2">User Activity</div>
                </div>
                <div className="text-center p-4 bg-white rounded border-2 border-dashed border-gray-300">
                  <div className="text-lg font-bold text-gray-400">⚡</div>
                  <div className="text-sm text-gray-500 mt-2">Performance Metrics</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>Unable to load system statistics</p>
          </div>
        )}
      </main>
    </div>
  );
}
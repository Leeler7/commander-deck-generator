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
  generation: {
    totalGenerations: number;
    avgGenerationTime: number;
    popularCommanders: Array<{ name: string; count: number }>;
    avgBudget: number;
    successRate: number;
  };
  performance: {
    uptime: string;
    memoryUsage: string;
    responseTime: number;
    errorRate: number;
  };
  usage: {
    dailyUsers: number;
    weeklyUsers: number;
    monthlyUsers: number;
    peakHour: string;
    topPages: Array<{ path: string; views: number }>;
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

  const exportStats = async () => {
    try {
      const response = await fetch('/api/admin/export-stats');
      if (!response.ok) {
        throw new Error('Failed to export stats');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `system-stats-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export stats');
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
              <p className="text-gray-600">Monitor system performance and usage analytics</p>
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
            <button 
              onClick={exportStats}
              style={buttonStyle}
              disabled={loading}
            >
              Export Data
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

            {/* Generation Stats */}
            <div style={panelStyle}>
              <h2 className="text-xl font-semibold mb-6 text-gray-900">Deck Generation Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div style={statCardStyle}>
                  <div className="text-2xl font-bold text-blue-600">{stats.generation.totalGenerations.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Total Generations</div>
                </div>
                <div style={statCardStyle}>
                  <div className="text-2xl font-bold text-green-600">{stats.generation.avgGenerationTime.toFixed(2)}s</div>
                  <div className="text-sm text-gray-600">Avg Gen Time</div>
                </div>
                <div style={statCardStyle}>
                  <div className="text-2xl font-bold text-purple-600">${stats.generation.avgBudget.toFixed(0)}</div>
                  <div className="text-sm text-gray-600">Avg Budget</div>
                </div>
                <div style={statCardStyle}>
                  <div className="text-2xl font-bold text-orange-600">{(stats.generation.successRate * 100).toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium mb-3">Popular Commanders</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stats.generation.popularCommanders.slice(0, 10).map((commander, index) => (
                    <div key={commander.name} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm font-medium">{commander.name}</span>
                      <span className="text-sm text-gray-600">{commander.count} decks</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance & Usage Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Performance */}
              <div style={panelStyle}>
                <h2 className="text-xl font-semibold mb-6 text-gray-900">Performance Metrics</h2>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium">System Uptime</span>
                    <span className="text-sm text-gray-600">{stats.performance.uptime}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium">Memory Usage</span>
                    <span className="text-sm text-gray-600">{stats.performance.memoryUsage}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium">Avg Response Time</span>
                    <span className="text-sm text-gray-600">{stats.performance.responseTime}ms</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <span className="text-sm font-medium">Error Rate</span>
                    <span className={`text-sm font-medium ${stats.performance.errorRate < 0.05 ? 'text-green-600' : 'text-red-600'}`}>
                      {(stats.performance.errorRate * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Usage Stats */}
              <div style={panelStyle}>
                <h2 className="text-xl font-semibold mb-6 text-gray-900">Usage Analytics</h2>
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div style={statCardStyle}>
                    <div className="text-lg font-bold text-blue-600">{stats.usage.dailyUsers}</div>
                    <div className="text-xs text-gray-600">Daily Users</div>
                  </div>
                  <div style={statCardStyle}>
                    <div className="text-lg font-bold text-green-600">{stats.usage.weeklyUsers}</div>
                    <div className="text-xs text-gray-600">Weekly Users</div>
                  </div>
                  <div style={statCardStyle}>
                    <div className="text-lg font-bold text-purple-600">{stats.usage.monthlyUsers}</div>
                    <div className="text-xs text-gray-600">Monthly Users</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Peak Hour:</span>
                    <span className="text-sm text-gray-600">{stats.usage.peakHour}</span>
                  </div>
                  
                  <div>
                    <h3 className="text-sm font-medium mb-2">Top Pages</h3>
                    {stats.usage.topPages.map((page, index) => (
                      <div key={page.path} className="flex justify-between items-center text-sm py-1">
                        <span className="text-gray-600">{page.path}</span>
                        <span className="font-medium">{page.views}</span>
                      </div>
                    ))}
                  </div>
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
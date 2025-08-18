'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface SyncStatus {
  lastSync?: string;
  totalCards?: number;
  databaseSource?: string;
  isLoading?: boolean;
  chunks?: {
    total: number;
    loaded: number;
    current?: string;
  };
}

export default function DatabaseSyncPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Load current sync status on mount
  useEffect(() => {
    loadSyncStatus();
  }, []);

  const loadSyncStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/admin/sync-status');
      if (response.ok) {
        const data = await response.json();
        setSyncStatus(data);
      } else {
        setError('Failed to load sync status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sync status');
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    try {
      setLoading(true);
      setError(null);
      setLogs(['Starting database sync...']);
      
      const response = await fetch('/api/admin/trigger-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Sync failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLogs(prev => [...prev, 'Sync completed successfully!']);
      setSyncStatus(data.status);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Sync failed';
      setError(errorMsg);
      setLogs(prev => [...prev, `Error: ${errorMsg}`]);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = async () => {
    try {
      setLoading(true);
      setError(null);
      setLogs(['Clearing database cache...']);
      
      const response = await fetch('/api/admin/clear-cache', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Cache clear failed: ${response.statusText}`);
      }
      
      setLogs(prev => [...prev, 'Cache cleared successfully!']);
      await loadSyncStatus(); // Reload status
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Cache clear failed';
      setError(errorMsg);
      setLogs(prev => [...prev, `Error: ${errorMsg}`]);
    } finally {
      setLoading(false);
    }
  };

  const checkDatabaseHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      setLogs(['Checking database health...']);
      
      const response = await fetch('/api/admin/database-health');
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setLogs(prev => [
        ...prev, 
        `Health check completed:`,
        `- Total cards: ${data.totalCards}`,
        `- Valid cards: ${data.validCards}`,
        `- Cards with mechanics: ${data.cardsWithMechanics}`,
        `- Database size: ${data.databaseSize || 'Unknown'}`
      ]);
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Health check failed';
      setError(errorMsg);
      setLogs(prev => [...prev, `Error: ${errorMsg}`]);
    } finally {
      setLoading(false);
    }
  };

  const panelStyle = {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px',
    minHeight: '400px'
  };

  const buttonStyle = {
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '12px',
    marginBottom: '8px'
  };

  const warningButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#dc3545'
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#6c757d'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                DATABASE SYNC
              </h1>
              <p className="text-gray-600">Manage database synchronization and updates</p>
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
          
          {/* Status Panel */}
          <div style={panelStyle}>
            <h2 className="text-lg font-semibold mb-4">Current Status</h2>
            
            {loading && !syncStatus ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading status...</p>
              </div>
            ) : syncStatus ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Total Cards</div>
                    <div className="text-lg font-bold text-gray-900">
                      {syncStatus.totalCards?.toLocaleString() || 'Unknown'}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-gray-700">Database Source</div>
                    <div className="text-sm text-gray-900">
                      {syncStatus.databaseSource || 'Unknown'}
                    </div>
                  </div>
                </div>
                
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm font-medium text-blue-700">Last Sync</div>
                  <div className="text-sm text-blue-900">
                    {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}
                  </div>
                </div>
                
                {syncStatus.chunks && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm font-medium text-green-700">Chunk Loading Status</div>
                    <div className="text-sm text-green-900">
                      {syncStatus.chunks.loaded} / {syncStatus.chunks.total} chunks loaded
                    </div>
                    {syncStatus.chunks.current && (
                      <div className="text-xs text-green-700 mt-1">
                        Current: {syncStatus.chunks.current}
                      </div>
                    )}
                    <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300"
                        style={{width: `${(syncStatus.chunks.loaded / syncStatus.chunks.total) * 100}%`}}
                      ></div>
                    </div>
                  </div>
                )}
                
                {syncStatus.isLoading && (
                  <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                      <span className="text-yellow-800 text-sm">Database operation in progress...</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Unable to load sync status</p>
              </div>
            )}
            
            <div className="mt-6 pt-4 border-t border-gray-200">
              <button 
                onClick={loadSyncStatus}
                style={secondaryButtonStyle}
                disabled={loading}
              >
                {loading ? 'Refreshing...' : 'Refresh Status'}
              </button>
            </div>
          </div>
          
          {/* Actions Panel */}
          <div style={panelStyle}>
            <h2 className="text-lg font-semibold mb-4">Database Actions</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-md font-medium mb-2">Sync Operations</h3>
                <div className="space-y-2">
                  <button 
                    onClick={triggerSync}
                    style={buttonStyle}
                    disabled={loading}
                  >
                    {loading ? 'Syncing...' : 'Force Full Sync'}
                  </button>
                  <p className="text-sm text-gray-600">
                    Downloads and processes the latest card data from external sources.
                  </p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-md font-medium mb-2">Cache Management</h3>
                <div className="space-y-2">
                  <button 
                    onClick={clearCache}
                    style={warningButtonStyle}
                    disabled={loading}
                  >
                    {loading ? 'Clearing...' : 'Clear Cache'}
                  </button>
                  <p className="text-sm text-gray-600">
                    Clears all cached data and forces fresh loading from source.
                  </p>
                </div>
              </div>
              
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-md font-medium mb-2">Health Check</h3>
                <div className="space-y-2">
                  <button 
                    onClick={checkDatabaseHealth}
                    style={secondaryButtonStyle}
                    disabled={loading}
                  >
                    {loading ? 'Checking...' : 'Run Health Check'}
                  </button>
                  <p className="text-sm text-gray-600">
                    Validates database integrity and reports statistics.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Logs Panel */}
        {logs.length > 0 && (
          <div className="mt-6">
            <div style={panelStyle}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Operation Logs</h2>
                <button 
                  onClick={() => setLogs([])}
                  className="text-sm text-gray-600 hover:text-gray-800"
                >
                  Clear Logs
                </button>
              </div>
              
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-64 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
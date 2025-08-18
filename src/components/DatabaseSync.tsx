'use client';

import { useState, useEffect, useCallback } from 'react';
import { DatabaseSyncStatus } from '@/lib/types';

export default function DatabaseSync() {
  const [syncStatus, setSyncStatus] = useState<DatabaseSyncStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const checkSyncStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/database/status');
      const status = await response.json();
      setSyncStatus(status);
      
      // Show sync panel if database needs sync
      if (status.total_cards === 0 || needsSync(status)) {
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Error checking sync status:', error);
    }
  }, []);

  useEffect(() => {
    checkSyncStatus();
  }, [checkSyncStatus]);

  const startSync = async () => {
    if (!syncStatus) return;
    
    try {
      setSyncStatus({ ...syncStatus, sync_in_progress: true, sync_progress: 0 });
      
      const response = await fetch('/api/database/sync', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Sync failed');
      }
      
      // Poll for updates during sync
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch('/api/database/status');
        const status = await statusResponse.json();
        setSyncStatus(status);
        
        if (!status.sync_in_progress) {
          clearInterval(pollInterval);
          if (status.last_error) {
            alert(`Sync failed: ${status.last_error}`);
          } else {
            setTimeout(() => setIsVisible(false), 2000); // Hide after success
          }
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error starting sync:', error);
      alert('Failed to start database sync');
      if (syncStatus) {
        setSyncStatus({ ...syncStatus, sync_in_progress: false });
      }
    }
  };

  const needsSync = (status: DatabaseSyncStatus): boolean => {
    if (status.total_cards === 0) return true;
    if (!status.last_full_sync) return true;
    
    const lastSync = new Date(status.last_full_sync);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return lastSync < weekAgo;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (!isVisible || !syncStatus) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-sm bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Card Database</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      {syncStatus.sync_in_progress ? (
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Syncing database...</span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${syncStatus.sync_progress}%` }}
            ></div>
          </div>
          
          <p className="text-xs text-gray-500">
            {syncStatus.sync_progress.toFixed(0)}% complete
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            <div className="flex justify-between">
              <span>Total cards:</span>
              <span className="font-medium">{syncStatus.total_cards.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Last sync:</span>
              <span className="font-medium">{formatDate(syncStatus.last_full_sync)}</span>
            </div>
          </div>

          {needsSync(syncStatus) && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
              {syncStatus.total_cards === 0 
                ? 'Server database initializing. This will happen automatically.'
                : 'Database is outdated. Sync will update with latest cards.'
              }
            </div>
          )}

          <button
            onClick={startSync}
            disabled={syncStatus.sync_in_progress}
            className={`w-full px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              needsSync(syncStatus)
                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {syncStatus.total_cards === 0 ? 'Initialize Database' : 'Update Database'}
          </button>

          <p className="text-xs text-gray-500 text-center">
            Server database syncs automatically with Scryfall
          </p>
        </div>
      )}
    </div>
  );
}
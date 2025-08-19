'use client';

import { useState, useEffect } from 'react';

export default function DatabaseSwitchPage() {
  const [currentDb, setCurrentDb] = useState<string>('file');
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean;
    cardCount?: number;
    error?: string;
  }>({ connected: false });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check current database type from server
    checkCurrentDatabase();
    
    // Check Supabase connection
    checkSupabaseStatus();
  }, []);

  const checkCurrentDatabase = async () => {
    try {
      const response = await fetch('/api/admin/current-db');
      const data = await response.json();
      setCurrentDb(data.currentDatabase);
    } catch (error) {
      console.error('Failed to check current database:', error);
      setCurrentDb('file'); // fallback
    }
  };

  const checkSupabaseStatus = async () => {
    try {
      const response = await fetch('/api/admin/supabase-status');
      const data = await response.json();
      setSupabaseStatus(data);
    } catch (error) {
      setSupabaseStatus({ 
        connected: false, 
        error: 'Failed to check Supabase status' 
      });
    }
  };

  const switchDatabase = async (newDbType: string) => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/switch-database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ databaseType: newDbType })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setCurrentDb(newDbType);
        alert(`Successfully switched to ${newDbType === 'file' ? 'File-based' : 'Supabase'} database!`);
        
        // Refresh the page to load the new database
        window.location.reload();
      } else {
        if (result.instructions) {
          alert(`Production Environment Detected:\n\n${result.error}\n\nInstructions:\n${result.instructions.join('\n')}`);
        } else {
          alert(`Failed to switch database: ${result.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      alert(`Error switching database: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Database Configuration</h1>
      
      {/* Current Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Current Database</h2>
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-3 h-3 rounded-full ${
            currentDb === 'supabase' ? 'bg-green-500' : 'bg-blue-500'
          }`}></span>
          <span className="font-medium">
            {currentDb === 'supabase' ? 'Supabase (PostgreSQL)' : 'File-based (JSON)'}
          </span>
        </div>
        <p className="text-sm text-gray-600">
          {currentDb === 'supabase' 
            ? 'Using Supabase as the primary database with real-time sync capabilities'
            : 'Using local JSON files with GitHub-based persistence'
          }
        </p>
      </div>

      {/* Supabase Status */}
      <div className="bg-white border rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Supabase Status</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${
              supabaseStatus.connected ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            <span className="font-medium">
              {supabaseStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {supabaseStatus.connected && supabaseStatus.cardCount && (
            <p className="text-sm text-gray-600">
              📊 Cards in Supabase: {supabaseStatus.cardCount.toLocaleString()}
            </p>
          )}
          
          {supabaseStatus.error && (
            <p className="text-sm text-red-600">
              ❌ {supabaseStatus.error}
            </p>
          )}
          
          <button 
            onClick={checkSupabaseStatus}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
          >
            🔄 Refresh Status
          </button>
        </div>
      </div>

      {/* Database Switching */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Switch Database</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* File Database */}
          <div className={`p-4 border-2 rounded-lg ${
            currentDb === 'file' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <h3 className="font-semibold mb-2">📁 File-based Database</h3>
            <ul className="text-sm text-gray-600 mb-4 space-y-1">
              <li>• Local JSON files</li>
              <li>• GitHub-based persistence</li>
              <li>• Proven stability</li>
              <li>• Manual sync process</li>
            </ul>
            
            {currentDb !== 'file' && (
              <button 
                onClick={() => switchDatabase('file')}
                disabled={isLoading}
                className={`w-full px-4 py-2 rounded transition-colors ${
                  isLoading 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {isLoading ? 'Switching...' : 'Switch to File Database'}
              </button>
            )}
            
            {currentDb === 'file' && (
              <div className="text-center text-blue-600 font-medium">
                ✓ Currently Active
              </div>
            )}
          </div>

          {/* Supabase Database */}
          <div className={`p-4 border-2 rounded-lg ${
            currentDb === 'supabase' 
              ? 'border-green-500 bg-green-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}>
            <h3 className="font-semibold mb-2">🗄️ Supabase Database</h3>
            <ul className="text-sm text-gray-600 mb-4 space-y-1">
              <li>• PostgreSQL database</li>
              <li>• Real-time capabilities</li>
              <li>• Advanced queries</li>
              <li>• Centralized management</li>
            </ul>
            
            {currentDb !== 'supabase' && (
              <button 
                onClick={() => switchDatabase('supabase')}
                disabled={isLoading || !supabaseStatus.connected}
                className={`w-full px-4 py-2 rounded transition-colors ${
                  isLoading || !supabaseStatus.connected
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {isLoading ? 'Switching...' : 
                 !supabaseStatus.connected ? 'Not Available' : 
                 'Switch to Supabase'}
              </button>
            )}
            
            {currentDb === 'supabase' && (
              <div className="text-center text-green-600 font-medium">
                ✓ Currently Active
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">⚠️ Important Notes:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• Switching databases will reload the application</li>
            <li>• Make sure data is synced between both systems before switching</li>
            <li>• File database changes require manual GitHub commits</li>
            <li>• Supabase provides instant persistence and better query capabilities</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import Link from 'next/link';

interface OperationResult {
  success: boolean;
  message: string;
  cardsDownloaded?: number;
  totalCards?: number;
  totalChunks?: number;
  results?: any[];
  error?: string;
  details?: string;
}

export default function DatabaseManagerPage() {
  const [loading, setLoading] = useState(false);
  const [currentOperation, setCurrentOperation] = useState('');
  const [lastResult, setLastResult] = useState<OperationResult | null>(null);
  const [commitMessage, setCommitMessage] = useState('Update database with tag changes');
  const [pushToGitHub, setPushToGitHub] = useState(true);

  const handleDownload = async () => {
    setLoading(true);
    setCurrentOperation('Downloading database from GitHub...');
    setLastResult(null);
    
    try {
      const response = await fetch('/api/admin/database-download', {
        method: 'POST'
      });
      
      const result = await response.json();
      setLastResult(result);
      
      if (result.success) {
        setCurrentOperation('');
      } else {
        setCurrentOperation('Download failed');
      }
    } catch (error) {
      setLastResult({
        success: false,
        message: 'Failed to download database',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setCurrentOperation('Download failed');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setLoading(true);
    setCurrentOperation('Exporting database to public directory...');
    setLastResult(null);
    
    try {
      const response = await fetch('/api/admin/database-export', {
        method: 'POST'
      });
      
      const result = await response.json();
      setLastResult(result);
      
      if (result.success) {
        setCurrentOperation('');
      } else {
        setCurrentOperation('Export failed');
      }
    } catch (error) {
      setLastResult({
        success: false,
        message: 'Failed to export database',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setCurrentOperation('Export failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      setLastResult({
        success: false,
        message: 'Please enter a commit message'
      });
      return;
    }
    
    setLoading(true);
    setCurrentOperation(pushToGitHub ? 'Committing and pushing to GitHub...' : 'Committing changes...');
    setLastResult(null);
    
    try {
      const response = await fetch('/api/admin/database-commit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: commitMessage,
          push: pushToGitHub
        })
      });
      
      const result = await response.json();
      setLastResult(result);
      
      if (result.success) {
        setCurrentOperation('');
        // Reset commit message after successful commit
        setCommitMessage('Update database with tag changes');
      } else {
        setCurrentOperation('Git operation failed');
      }
    } catch (error) {
      setLastResult({
        success: false,
        message: 'Failed to commit changes',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setCurrentOperation('Git operation failed');
    } finally {
      setLoading(false);
    }
  };

  const panelStyle = {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px'
  };

  const buttonStyle = {
    padding: '10px 20px',
    borderRadius: '6px',
    border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'all 0.2s',
    opacity: loading ? 0.6 : 1
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#3b82f6',
    color: 'white'
  };

  const successButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#10b981',
    color: 'white'
  };

  const warningButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#f59e0b',
    color: 'white'
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase'}}>
                DATABASE MANAGER
              </h1>
              <p className="text-gray-600">Download, modify, and deploy database changes</p>
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
        {/* Workflow Steps */}
        <div style={panelStyle}>
          <h2 style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '20px'}}>Database Management Workflow</h2>
          
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px'}}>
            {/* Step 1: Download */}
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#3b82f6', marginBottom: '10px'}}>1</div>
              <h3 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '10px'}}>Download Database</h3>
              <p style={{fontSize: '14px', color: '#666', marginBottom: '15px'}}>
                Get the latest database from GitHub to work with locally
              </p>
              <button 
                onClick={handleDownload}
                disabled={loading}
                style={primaryButtonStyle}
              >
                {loading && currentOperation.includes('Download') ? 'Downloading...' : 'Download from GitHub'}
              </button>
            </div>

            {/* Step 2: Modify */}
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#10b981', marginBottom: '10px'}}>2</div>
              <h3 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '10px'}}>Modify Database</h3>
              <p style={{fontSize: '14px', color: '#666', marginBottom: '15px'}}>
                Use admin tools to add/remove tags and manage cards
              </p>
              <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                <Link 
                  href="/admin/tag-builder"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  style={{textDecoration: 'none'}}
                >
                  Tag Builder
                </Link>
                <Link 
                  href="/admin/tag-cleanup"
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                  style={{textDecoration: 'none'}}
                >
                  Tag Cleanup
                </Link>
              </div>
            </div>

            {/* Step 3: Export & Deploy */}
            <div style={{textAlign: 'center'}}>
              <div style={{fontSize: '24px', fontWeight: 'bold', color: '#f59e0b', marginBottom: '10px'}}>3</div>
              <h3 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '10px'}}>Export & Deploy</h3>
              <p style={{fontSize: '14px', color: '#666', marginBottom: '15px'}}>
                Export changes and push to GitHub for deployment
              </p>
              <button 
                onClick={handleExport}
                disabled={loading}
                style={warningButtonStyle}
              >
                {loading && currentOperation.includes('Export') ? 'Exporting...' : 'Export to Public'}
              </button>
            </div>
          </div>

          {/* Git Operations */}
          <div style={{borderTop: '1px solid #e0e0e0', paddingTop: '20px'}}>
            <h3 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '15px'}}>Git Operations</h3>
            
            <div style={{display: 'flex', gap: '15px', alignItems: 'flex-end'}}>
              <div style={{flex: 1}}>
                <label style={{display: 'block', fontSize: '14px', color: '#666', marginBottom: '5px'}}>
                  Commit Message
                </label>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Describe your changes..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
              </div>
              
              <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                <label style={{display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer'}}>
                  <input
                    type="checkbox"
                    checked={pushToGitHub}
                    onChange={(e) => setPushToGitHub(e.target.checked)}
                    style={{marginRight: '5px'}}
                  />
                  Push to GitHub
                </label>
              </div>
              
              <button 
                onClick={handleCommit}
                disabled={loading || !commitMessage.trim()}
                style={successButtonStyle}
              >
                {loading && currentOperation.includes('Commit') 
                  ? 'Processing...' 
                  : pushToGitHub ? 'Commit & Push' : 'Commit Locally'}
              </button>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {currentOperation && (
          <div style={{
            ...panelStyle,
            backgroundColor: '#fef3c7',
            borderColor: '#fbbf24'
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
              <div className="animate-spin" style={{
                width: '20px',
                height: '20px',
                border: '3px solid #fbbf24',
                borderTopColor: 'transparent',
                borderRadius: '50%'
              }}></div>
              <span style={{fontSize: '14px', color: '#92400e'}}>{currentOperation}</span>
            </div>
          </div>
        )}

        {/* Results */}
        {lastResult && (
          <div style={{
            ...panelStyle,
            backgroundColor: lastResult.success ? '#d1fae5' : '#fee2e2',
            borderColor: lastResult.success ? '#10b981' : '#ef4444'
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: 'bold',
              marginBottom: '10px',
              color: lastResult.success ? '#065f46' : '#991b1b'
            }}>
              {lastResult.success ? '✅ Success' : '❌ Error'}
            </h3>
            
            <p style={{fontSize: '14px', marginBottom: '10px'}}>
              {lastResult.message}
            </p>
            
            {lastResult.cardsDownloaded !== undefined && (
              <p style={{fontSize: '14px', color: '#666'}}>
                Cards downloaded: {lastResult.cardsDownloaded}
              </p>
            )}
            
            {lastResult.totalCards !== undefined && (
              <p style={{fontSize: '14px', color: '#666'}}>
                Total cards: {lastResult.totalCards} in {lastResult.totalChunks} chunks
              </p>
            )}
            
            {lastResult.error && (
              <pre style={{
                backgroundColor: 'white',
                padding: '10px',
                borderRadius: '4px',
                fontSize: '12px',
                marginTop: '10px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {lastResult.error}
                {lastResult.details && `\n\nDetails: ${lastResult.details}`}
              </pre>
            )}
            
            {lastResult.results && lastResult.results.length > 0 && (
              <div style={{marginTop: '15px'}}>
                <h4 style={{fontSize: '14px', fontWeight: 'bold', marginBottom: '10px'}}>Git Output:</h4>
                {lastResult.results.map((result, index) => (
                  <div key={index} style={{marginBottom: '10px'}}>
                    <strong style={{fontSize: '12px', color: '#666'}}>{result.step}:</strong>
                    <pre style={{
                      backgroundColor: 'white',
                      padding: '8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      marginTop: '5px',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}>
                      {result.output || '(no output)'}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div style={panelStyle}>
          <h3 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '15px'}}>📚 Instructions</h3>
          
          <ol style={{fontSize: '14px', lineHeight: '1.8', paddingLeft: '20px'}}>
            <li><strong>Download:</strong> Get the latest database from GitHub to ensure you're working with current data</li>
            <li><strong>Modify:</strong> Use the Tag Builder to add tags or Tag Cleanup to remove them</li>
            <li><strong>Export:</strong> Package your changes into chunks for GitHub storage</li>
            <li><strong>Commit & Push:</strong> Save changes to Git and push to GitHub (Railway will auto-deploy)</li>
          </ol>
          
          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            fontSize: '13px'
          }}>
            <strong>💡 Tips:</strong>
            <ul style={{marginTop: '10px', paddingLeft: '20px'}}>
              <li>Always download the latest database before making changes</li>
              <li>Export your changes before committing to ensure they're packaged correctly</li>
              <li>Use descriptive commit messages to track what tags were added/removed</li>
              <li>The database will be available in production after Railway finishes deploying</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
'use client';

import { GeneratedDeck } from '@/lib/types';
import { deckExporter } from '@/lib/export';
import { useState } from 'react';

interface ExportOptionsProps {
  deck: GeneratedDeck;
}

export default function ExportOptions({ deck }: ExportOptionsProps) {
  const [exportFormat, setExportFormat] = useState<'text' | 'csv' | 'json'>('text');
  const [copied, setCopied] = useState(false);

  const handleExport = () => {
    let content = '';
    let filename = '';
    
    switch (exportFormat) {
      case 'text':
        content = deckExporter.exportToText(deck);
        filename = `${deck.commander.name.replace(/[^a-z0-9]/gi, '_')}_deck.txt`;
        break;
      case 'csv':
        content = deckExporter.exportToCSV(deck);
        filename = `${deck.commander.name.replace(/[^a-z0-9]/gi, '_')}_deck.csv`;
        break;
      case 'json':
        content = JSON.stringify(deckExporter.generateMoxfieldDeckData(deck), null, 2);
        filename = `${deck.commander.name.replace(/[^a-z0-9]/gi, '_')}_deck.json`;
        break;
    }

    // Create and download file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyToClipboard = async () => {
    let content = '';
    
    switch (exportFormat) {
      case 'text':
        content = deckExporter.exportToText(deck);
        break;
      case 'csv':
        content = deckExporter.exportToCSV(deck);
        break;
      case 'json':
        content = JSON.stringify(deckExporter.generateMoxfieldDeckData(deck), null, 2);
        break;
    }

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const copyForArchidekt = async () => {
    // Copy deck list formatted for Archidekt
    const deckList = deckExporter.exportToText(deck);
    try {
      await navigator.clipboard.writeText(deckList);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy deck list. Please try again.');
    }
  };

  const copyForMoxfield = async () => {
    // Copy deck list formatted for Moxfield
    const deckList = deckExporter.exportToText(deck);
    try {
      await navigator.clipboard.writeText(deckList);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy deck list. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Export Deck</h3>
      
      {/* Export Format Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Export Format
        </label>
        <div className="flex space-x-2">
          {[
            { value: 'text', label: 'Text' },
            { value: 'csv', label: 'CSV' },
            { value: 'json', label: 'JSON' }
          ].map((format) => (
            <button
              key={format.value}
              onClick={() => setExportFormat(format.value as 'text' | 'csv' | 'json')}
              className={`px-4 py-2 text-sm font-medium rounded-md border ${
                exportFormat === format.value
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {format.label}
            </button>
          ))}
        </div>
      </div>

      {/* Export Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <button
          onClick={handleExport}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Download File
        </button>
        
        <button
          onClick={handleCopyToClipboard}
          className={`w-full px-4 py-2 text-sm font-medium rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            copied
              ? 'bg-green-50 border-green-500 text-green-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
      </div>

      {/* Deck Site Integration */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">Import to Deck Sites</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={copyForArchidekt}
            className={`w-full px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
              copied
                ? 'bg-green-50 border border-green-500 text-green-700'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            }`}
          >
            {copied ? 'Copied!' : 'Copy for Archidekt'}
          </button>
          
          <button
            onClick={copyForMoxfield}
            className={`w-full px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
              copied
                ? 'bg-green-50 border border-green-500 text-green-700'
                : 'bg-orange-600 text-white hover:bg-orange-700'
            }`}
          >
            {copied ? 'Copied!' : 'Copy for Moxfield'}
          </button>
        </div>
        
        <p className="text-xs text-gray-500 mt-2">
          Deck list will be copied to your clipboard. Paste it into the deck builder on either site.
        </p>
      </div>

      {/* Quick Preview */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
        <div className="bg-gray-50 rounded-md p-3 max-h-32 overflow-y-auto">
          <pre className="text-xs text-gray-600 whitespace-pre-wrap">
            {exportFormat === 'text' && deckExporter.exportToText(deck).substring(0, 300)}
            {exportFormat === 'csv' && deckExporter.exportToCSV(deck).substring(0, 300)}
            {exportFormat === 'json' && JSON.stringify(deckExporter.generateMoxfieldDeckData(deck), null, 2).substring(0, 300)}
            {((exportFormat === 'text' && deckExporter.exportToText(deck).length > 300) ||
              (exportFormat === 'csv' && deckExporter.exportToCSV(deck).length > 300) ||
              (exportFormat === 'json' && JSON.stringify(deckExporter.generateMoxfieldDeckData(deck), null, 2).length > 300)) && '...'}
          </pre>
        </div>
      </div>
    </div>
  );
}
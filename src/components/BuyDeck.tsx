'use client';

import { GeneratedDeck } from '@/lib/types';
import { purchaseUrlGenerator } from '@/lib/export';
import { useState } from 'react';

interface BuyDeckProps {
  deck: GeneratedDeck;
}

export default function BuyDeck({ deck }: BuyDeckProps) {
  const [copiedList, setCopiedList] = useState(false);
  const [showOptimized, setShowOptimized] = useState(false);

  const priceEstimate = purchaseUrlGenerator.estimatePurchasePrice(deck);
  
  const handleCopyDeckList = async () => {
    const deckList = purchaseUrlGenerator.generateUniversalDeckList(deck);
    try {
      await navigator.clipboard.writeText(deckList);
      setCopiedList(true);
      setTimeout(() => setCopiedList(false), 2000);
    } catch (error) {
      console.error('Failed to copy deck list:', error);
    }
  };

  const handleOpenStore = (store: 'tcgplayer' | 'cardkingdom' | 'scg' | 'tcgoptimized') => {
    let url: string;
    
    switch (store) {
      case 'tcgplayer':
        url = showOptimized 
          ? purchaseUrlGenerator.generateTCGPlayerOptimizerUrl(deck)
          : purchaseUrlGenerator.generateTCGPlayerUrl(deck);
        break;
      case 'tcgoptimized':
        url = purchaseUrlGenerator.generateTCGPlayerOptimizerUrl(deck);
        break;
      case 'cardkingdom':
        url = purchaseUrlGenerator.generateCardKingdomUrl(deck);
        break;
      case 'scg':
        // For SCG, copy the deck list first since they don't have direct import
        handleCopyDeckList();
        alert('Deck list copied! You can paste it into StarCityGames\' search or use their deck builder.');
        url = 'https://starcitygames.com/';
        break;
      default:
        return;
    }
    
    window.open(url, '_blank');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Buy This Deck</h3>
        <div className="flex items-center space-x-2">
          <label className="flex items-center text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showOptimized}
              onChange={(e) => setShowOptimized(e.target.checked)}
              className="mr-2 rounded border-gray-300"
            />
            Find cheapest versions
          </label>
        </div>
      </div>

      {/* Price Estimates */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              ${priceEstimate.tcgLow.toFixed(2)}
            </div>
            <div className="text-xs text-gray-600">Est. Low Price</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              ${priceEstimate.tcgMarket.toFixed(2)}
            </div>
            <div className="text-xs text-gray-600">Market Price</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              ${deck.total_price.toFixed(2)}
            </div>
            <div className="text-xs text-gray-600">Generated Price</div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-3 text-center">
          {priceEstimate.disclaimer}
        </p>
      </div>

      {/* Store Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* TCGPlayer Button */}
          <button
            onClick={() => handleOpenStore('tcgplayer')}
            className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
            </svg>
            <div className="text-left">
              <div className="font-semibold">TCGPlayer</div>
              <div className="text-xs opacity-90">
                {showOptimized ? 'Optimized prices' : 'Direct import'}
              </div>
            </div>
          </button>

          {/* Card Kingdom Button */}
          <button
            onClick={() => handleOpenStore('cardkingdom')}
            className="flex items-center justify-center px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M5 12l5 5L20 7"/>
            </svg>
            <div className="text-left">
              <div className="font-semibold">Card Kingdom</div>
              <div className="text-xs opacity-90">Single vendor</div>
            </div>
          </button>

          {/* StarCityGames Button */}
          <button
            onClick={() => handleOpenStore('scg')}
            className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            <div className="text-left">
              <div className="font-semibold">StarCityGames</div>
              <div className="text-xs opacity-90">Premium singles</div>
            </div>
          </button>

          {/* TCGPlayer Optimizer Button */}
          {!showOptimized && (
            <button
              onClick={() => handleOpenStore('tcgoptimized')}
              className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
              </svg>
              <div className="text-left">
                <div className="font-semibold">TCGPlayer Optimizer</div>
                <div className="text-xs opacity-90">Find cheapest versions</div>
              </div>
            </button>
          )}
        </div>

        {/* Copy Deck List Button */}
        <button
          onClick={handleCopyDeckList}
          className={`w-full px-4 py-3 rounded-lg border transition-colors ${
            copiedList
              ? 'bg-green-50 border-green-500 text-green-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
        >
          {copiedList ? (
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Deck List Copied!
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy Deck List for Any Store
            </div>
          )}
        </button>
      </div>

      {/* Additional Info */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">Shopping Tips:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• TCGPlayer aggregates prices from multiple sellers for the best deals</li>
          <li>• Card Kingdom ships from a single location for faster delivery</li>
          <li>• Check the "Find cheapest versions" box to optimize your purchase price</li>
          <li>• Consider buying played condition cards to save money</li>
          <li>• Some basic lands may be available for free at your local game store</li>
        </ul>
      </div>
    </div>
  );
}
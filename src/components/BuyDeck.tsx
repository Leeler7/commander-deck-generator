'use client';

import { GeneratedDeck } from '@/lib/types';
import { deckExporter, purchaseUrlGenerator } from '@/lib/export';
import { useState } from 'react';

interface BuyDeckProps {
  deck: GeneratedDeck;
}

export default function BuyDeck({ deck }: BuyDeckProps) {
  const [copiedFor, setCopiedFor] = useState<string | null>(null);

  const priceEstimate = purchaseUrlGenerator.estimatePurchasePrice(deck);

  const handleTCGPlayer = () => {
    const url = deckExporter.buildTCGPlayerUrl(deck);
    window.open(url, '_blank');
  };

  const handleCardKingdom = async () => {
    const deckList = deckExporter.exportToText(deck);
    try {
      await navigator.clipboard.writeText(deckList);
      setCopiedFor('cardkingdom');
      setTimeout(() => setCopiedFor(null), 3000);
      window.open('https://www.cardkingdom.com/builder', '_blank');
    } catch (error) {
      console.error('Failed to copy deck list:', error);
    }
  };

  const handleCopyDeckList = async () => {
    const deckList = deckExporter.exportToText(deck);
    try {
      await navigator.clipboard.writeText(deckList);
      setCopiedFor('clipboard');
      setTimeout(() => setCopiedFor(null), 2000);
    } catch (error) {
      console.error('Failed to copy deck list:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Buy This Deck</h3>

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
          {/* TCGPlayer - direct URL import */}
          <button
            onClick={handleTCGPlayer}
            className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <div className="text-left">
              <div className="font-semibold">TCGPlayer</div>
              <div className="text-xs opacity-90">Loads into Mass Entry</div>
            </div>
          </button>

          {/* Card Kingdom - clipboard + open */}
          <button
            onClick={handleCardKingdom}
            className={`flex items-center justify-center px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition-colors ${
              copiedFor === 'cardkingdom'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            <div className="text-left">
              <div className="font-semibold">
                {copiedFor === 'cardkingdom' ? 'Copied! Opening...' : 'Card Kingdom'}
              </div>
              <div className="text-xs opacity-90">Copies list, then paste</div>
            </div>
          </button>
        </div>

        {/* Copy Deck List Button */}
        <button
          onClick={handleCopyDeckList}
          className={`w-full px-4 py-3 rounded-lg border transition-colors ${
            copiedFor === 'clipboard'
              ? 'bg-green-50 border-green-500 text-green-700'
              : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
          } focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
        >
          <div className="flex items-center justify-center">
            {copiedFor === 'clipboard' ? (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Deck List Copied!
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Deck List Only
              </>
            )}
          </div>
        </button>
      </div>

      {/* Tips */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">How it works:</h4>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>&bull; TCGPlayer loads the deck list directly into Mass Entry</li>
          <li>&bull; Card Kingdom copies the list to your clipboard — paste it into their deck builder</li>
          <li>&bull; Consider buying played condition cards to save money</li>
        </ul>
      </div>

      {/* Affiliate Disclosure */}
      <p className="mt-3 text-xs text-gray-400 text-center">
        As a TCGPlayer affiliate, we earn from qualifying purchases.{' '}
        <a href="/disclosure" className="underline hover:text-gray-600">Learn more</a>
      </p>
    </div>
  );
}

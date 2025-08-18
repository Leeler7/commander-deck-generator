'use client';

import { useState, useEffect } from 'react';
import { mtgjsonComprehensive } from '@/lib/mtgjson-comprehensive';
import { mtgjsonPricing } from '@/lib/mtgjson-pricing';
import { mtgjsonKeywords } from '@/lib/mtgjson-keywords';

interface DataStatus {
  atomicCards: { loaded: boolean; count: number; lastFetch?: string };
  allPrintings: { loaded: boolean; setCount: number; cardCount: number; lastFetch?: string };
  setList: { loaded: boolean; count: number; lastFetch?: string };
  pricing: { isAvailable: boolean; lastFetchDate: string | null; cardCount: number; isToday: boolean };
  keywords: { date: string; version: string; totalKeywords: number } | null;
}

export default function MTGJSONDataManager() {
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    loadDataStatus();
  }, []);

  const loadDataStatus = async () => {
    try {
      const [comprehensiveStatus, pricingStatus, keywordsStatus] = await Promise.all([
        mtgjsonComprehensive.getDataStatus(),
        mtgjsonPricing.getDataStatus(),
        mtgjsonKeywords.getKeywordsMetadata().catch(() => null)
      ]);

      setDataStatus({
        ...comprehensiveStatus,
        pricing: pricingStatus,
        keywords: keywordsStatus
      });
    } catch (error) {
      console.error('Error loading data status:', error);
    }
  };

  const loadAtomicCards = async () => {
    setIsLoading(true);
    setLoadingProgress('Loading AtomicCards.json...');
    try {
      await mtgjsonComprehensive.fetchAtomicCards();
      setLoadingProgress('✅ AtomicCards loaded successfully');
      await loadDataStatus();
    } catch (error) {
      setLoadingProgress('❌ Failed to load AtomicCards');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSetList = async () => {
    setIsLoading(true);
    setLoadingProgress('Loading SetList.json...');
    try {
      await mtgjsonComprehensive.fetchSetList();
      setLoadingProgress('✅ SetList loaded successfully');
      await loadDataStatus();
    } catch (error) {
      setLoadingProgress('❌ Failed to load SetList');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllPrintings = async () => {
    setIsLoading(true);
    setLoadingProgress('Loading AllPrintings.json (this may take several minutes - large file)...');
    try {
      await mtgjsonComprehensive.fetchAllPrintings();
      setLoadingProgress('✅ AllPrintings loaded successfully');
      await loadDataStatus();
    } catch (error) {
      setLoadingProgress('❌ Failed to load AllPrintings - consider downloading locally');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPricingData = async () => {
    setIsLoading(true);
    setLoadingProgress('Loading pricing data...');
    try {
      await mtgjsonPricing.getDataStatus();
      setLoadingProgress('✅ Pricing data loaded successfully');
      await loadDataStatus();
    } catch (error) {
      setLoadingProgress('❌ Failed to load pricing data');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadKeywords = async () => {
    setIsLoading(true);
    setLoadingProgress('Loading keywords data...');
    try {
      await mtgjsonKeywords.getKeywordCategories();
      setLoadingProgress('✅ Keywords loaded successfully');
      await loadDataStatus();
    } catch (error) {
      setLoadingProgress('❌ Failed to load keywords');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllCache = () => {
    mtgjsonComprehensive.clearCache();
    mtgjsonPricing.clearCache();
    mtgjsonKeywords.clearCache();
    setDataStatus(null);
    setLoadingProgress('🗑️ All caches cleared');
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg text-sm"
        >
          MTGJSON Data Manager
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white rounded-lg shadow-2xl border border-gray-200 w-96 max-h-96 overflow-y-auto">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
        <h3 className="font-medium">MTGJSON Data Manager</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-white hover:text-gray-200"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Loading Status */}
        {(isLoading || loadingProgress) && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <div className="text-sm">
              {isLoading && <div className="animate-pulse text-blue-600">⏳ Loading...</div>}
              <div className="text-gray-700 mt-1">{loadingProgress}</div>
            </div>
          </div>
        )}

        {/* Data Status */}
        {dataStatus && (
          <div className="space-y-3">
            {/* AtomicCards */}
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div>
                <div className="text-sm font-medium">AtomicCards</div>
                <div className="text-xs text-gray-600">
                  {dataStatus.atomicCards.loaded ? 
                    `${dataStatus.atomicCards.count.toLocaleString()} cards` : 
                    'Not loaded'
                  }
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  dataStatus.atomicCards.loaded ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <button
                  onClick={loadAtomicCards}
                  disabled={isLoading}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Load
                </button>
              </div>
            </div>

            {/* SetList */}
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div>
                <div className="text-sm font-medium">SetList</div>
                <div className="text-xs text-gray-600">
                  {dataStatus.setList.loaded ? 
                    `${dataStatus.setList.count} sets` : 
                    'Not loaded'
                  }
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  dataStatus.setList.loaded ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <button
                  onClick={loadSetList}
                  disabled={isLoading}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Load
                </button>
              </div>
            </div>

            {/* AllPrintings */}
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div>
                <div className="text-sm font-medium">AllPrintings</div>
                <div className="text-xs text-gray-600">
                  {dataStatus.allPrintings.loaded ? 
                    `${dataStatus.allPrintings.setCount} sets, ${dataStatus.allPrintings.cardCount.toLocaleString()} cards` : 
                    'Not loaded (large file)'
                  }
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  dataStatus.allPrintings.loaded ? 'bg-green-500' : 'bg-yellow-400'
                }`} />
                <button
                  onClick={loadAllPrintings}
                  disabled={isLoading}
                  className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700 disabled:opacity-50"
                >
                  Load
                </button>
              </div>
            </div>

            {/* Pricing */}
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div>
                <div className="text-sm font-medium">Pricing Data</div>
                <div className="text-xs text-gray-600">
                  {dataStatus.pricing.isAvailable ? 
                    `${dataStatus.pricing.cardCount.toLocaleString()} cards${dataStatus.pricing.isToday ? ' (today)' : ''}` : 
                    'Not loaded'
                  }
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  dataStatus.pricing.isAvailable && dataStatus.pricing.isToday ? 'bg-green-500' : 
                  dataStatus.pricing.isAvailable ? 'bg-yellow-500' : 'bg-gray-400'
                }`} />
                <button
                  onClick={loadPricingData}
                  disabled={isLoading}
                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Load
                </button>
              </div>
            </div>

            {/* Keywords */}
            <div className="flex items-center justify-between bg-gray-50 p-2 rounded">
              <div>
                <div className="text-sm font-medium">Keywords</div>
                <div className="text-xs text-gray-600">
                  {dataStatus.keywords ? 
                    `${dataStatus.keywords.totalKeywords} keywords` : 
                    'Not loaded'
                  }
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  dataStatus.keywords ? 'bg-green-500' : 'bg-gray-400'
                }`} />
                <button
                  onClick={loadKeywords}
                  disabled={isLoading}
                  className="text-xs bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  Load
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <button
            onClick={loadDataStatus}
            disabled={isLoading}
            className="w-full text-sm bg-gray-600 text-white px-3 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            Refresh Status
          </button>
          <button
            onClick={clearAllCache}
            disabled={isLoading}
            className="w-full text-sm bg-red-600 text-white px-3 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            Clear All Cache
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-500 border-t border-gray-200 pt-2">
          <div>💡 AtomicCards & SetList are lightweight and fast to load</div>
          <div>⚠️ AllPrintings is 500MB+ and may take several minutes</div>
          <div>🔄 Data refreshes daily automatically</div>
        </div>
      </div>
    </div>
  );
}
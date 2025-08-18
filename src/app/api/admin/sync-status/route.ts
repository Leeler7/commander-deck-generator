import { NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET() {
  try {
    console.log('🔍 API: Loading sync status...');
    
    await serverCardDatabase.initialize();
    
    const status = serverCardDatabase.getStatus();
    const totalCards = serverCardDatabase.getAllCards().length;
    const databaseSource = 'Server Database';
    const lastSync = status.last_full_sync || status.last_incremental_sync;
    
    // For chunk information, we'll use mock data since server database doesn't expose this
    const chunks = totalCards > 0 ? {
      total: 8,
      loaded: 8,
      current: null
    } : null;
    
    console.log(`✅ API: Sync status - ${totalCards} cards loaded`);
    
    return NextResponse.json({
      lastSync,
      totalCards,
      databaseSource,
      isLoading: false,
      chunks
    });
    
  } catch (error) {
    console.error('Error loading sync status:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load sync status', 
        details: error instanceof Error ? error.message : 'Unknown error',
        lastSync: null,
        totalCards: 0,
        databaseSource: 'Error',
        isLoading: false,
        chunks: null
      },
      { status: 500 }
    );
  }
}
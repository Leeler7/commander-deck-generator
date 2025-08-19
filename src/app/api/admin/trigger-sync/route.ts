import { NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function POST() {
  try {
    console.log('🔄 API: Triggering manual sync...');
    
    // Trigger a full sync
    await database.performFullSync();
    
    const finalStatus = await database.getStatus();
    const totalCards = await database.getAllCards().length;
    
    console.log(`✅ API: Sync completed - ${totalCards} cards loaded`);
    
    return NextResponse.json({
      success: true,
      message: 'Database sync completed successfully',
      status: {
        lastSync: finalStatus.last_full_sync,
        totalCards: totalCards,
        databaseSource: 'Server Database',
        isLoading: false
      }
    });
    
  } catch (error) {
    console.error('Error triggering sync:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to trigger sync', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
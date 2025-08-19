import { NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function POST() {
  try {
    console.log('🔄 FORCE SYNC: Starting manual database sync...');
    
    // Initialize database first
    // Force a full sync
    console.log('🔄 Starting full sync...');
    await database.performFullSync();
    
    const finalCount = await database.getAllCards().length;
    console.log(`✅ Sync completed: ${finalCount} cards loaded`);
    
    return NextResponse.json({
      success: true,
      message: 'Manual sync completed successfully',
      cardCount: finalCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Force sync failed:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Force sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
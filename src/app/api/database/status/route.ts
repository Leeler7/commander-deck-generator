import { NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET() {
  try {
    // Initialize database if not already done
    await serverCardDatabase.initialize();
    
    const status = serverCardDatabase.getStatus();
    const totalCards = serverCardDatabase.getAllCards().length;
    
    // Check if running on Vercel
    const isVercel = process.env.VERCEL === '1';
    const environment = isVercel ? 'Vercel Production' : 'Local Development';
    
    // Get memory usage info (useful for debugging on Vercel)
    const memoryUsage = process.memoryUsage();
    const memoryInfo = {
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`
    };
    
    return NextResponse.json({
      success: true,
      environment,
      database: {
        initialized: totalCards > 0,
        totalCards,
        needsSync: serverCardDatabase.needsSync(),
        lastFullSync: status.last_full_sync,
        lastIncrementalSync: status.last_incremental_sync,
        syncInProgress: status.sync_in_progress,
        syncProgress: status.sync_progress,
        dataDirectory: isVercel ? '/tmp/commander-deck-data' : 'local data/'
      },
      memory: memoryInfo,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting database status:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get database status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
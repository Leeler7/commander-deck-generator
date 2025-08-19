import { NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function POST() {
  try {
    // Initialize database if not already done
    // Check if sync is already in progress
    const status = await database.getStatus();
    if (status.sync_in_progress) {
      return NextResponse.json(
        { error: 'Sync already in progress' },
        { status: 409 }
      );
    }
    
    // Start sync in background (don't await - let it run async)
    await database.performFullSync().catch(error => {
      console.error('Background sync failed:', error);
    });
    
    return NextResponse.json({ message: 'Sync started' });
  } catch (error) {
    console.error('Error starting database sync:', error);
    
    return NextResponse.json(
      { error: 'Failed to start sync' },
      { status: 500 }
    );
  }
}
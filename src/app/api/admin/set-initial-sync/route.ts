import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function POST() {
  try {
    console.log('📅 Setting initial sync record...');
    
    // Set yesterday's date as the last sync
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0); // Set to noon yesterday
    
    const { error: upsertError } = await database.supabase
      .from('sync_metadata')
      .upsert({
        sync_type: 'incremental',
        last_sync: yesterday.toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (upsertError) {
      throw new Error(`Failed to set initial sync: ${upsertError.message}`);
    }
    
    console.log(`✅ Set last sync to: ${yesterday.toISOString()}`);
    
    // Verify by getting status
    const status = await database.getStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Initial sync record created',
      lastSync: yesterday.toISOString(),
      status: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error setting initial sync:', error);
    return NextResponse.json(
      { error: 'Failed to set initial sync: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
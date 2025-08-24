import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function POST() {
  try {
    console.log('🔧 Fixing sync status...');
    
    // First check what's in the sync_metadata table
    const { data: existingRecords, error: selectError } = await database.supabase
      .from('sync_metadata')
      .select('*')
      .order('updated_at', { ascending: false });
    
    console.log('Existing sync records:', existingRecords);
    
    // If no incremental sync record exists, create one with current timestamp
    const hasIncremental = existingRecords?.some(record => record.sync_type === 'incremental');
    
    if (!hasIncremental) {
      console.log('No incremental sync record found, creating one...');
      
      const { error: insertError } = await database.supabase
        .from('sync_metadata')
        .insert({
          sync_type: 'incremental',
          last_sync: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Failed to insert sync record:', insertError);
        return NextResponse.json(
          { error: 'Failed to create sync record: ' + insertError.message },
          { status: 500 }
        );
      }
      
      console.log('✅ Created incremental sync record');
    }
    
    // Now test the getStatus function
    const status = await database.getStatus();
    console.log('Status after fix:', status);
    
    // Get updated records to confirm
    const { data: updatedRecords } = await database.supabase
      .from('sync_metadata')
      .select('*')
      .order('updated_at', { ascending: false });
    
    return NextResponse.json({
      success: true,
      message: 'Sync status fixed',
      before: {
        existingRecords: existingRecords || [],
        hadIncremental: hasIncremental
      },
      after: {
        status: status,
        updatedRecords: updatedRecords || []
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fixing sync status:', error);
    return NextResponse.json(
      { error: 'Failed to fix sync status: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Just check current sync status
    const { data: syncRecords } = await database.supabase
      .from('sync_metadata')
      .select('*')
      .order('updated_at', { ascending: false });
    
    const status = await database.getStatus();
    
    return NextResponse.json({
      syncRecords: syncRecords || [],
      status: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get sync status: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
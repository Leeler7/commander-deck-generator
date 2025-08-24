import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET() {
  // Just redirect GET to POST for convenience
  return await POST();
}

export async function POST() {
  try {
    console.log('📝 Directly inserting sync record...');
    
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(12, 0, 0, 0);
    
    console.log(`Setting last sync to: ${yesterday.toISOString()}`);
    
    // Direct SQL insert/update
    const { data, error } = await database.supabase
      .rpc('exec', {
        query: `
          INSERT INTO sync_metadata (sync_type, last_sync, updated_at) 
          VALUES ('incremental', '${yesterday.toISOString()}', NOW())
          ON CONFLICT (sync_type) 
          DO UPDATE SET 
            last_sync = '${yesterday.toISOString()}',
            updated_at = NOW()
        `
      });
    
    if (error) {
      console.error('RPC failed, trying direct upsert:', error);
      
      // Fallback to direct upsert
      const { error: upsertError } = await database.supabase
        .from('sync_metadata')
        .upsert({
          sync_type: 'incremental',
          last_sync: yesterday.toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'sync_type'
        });
      
      if (upsertError) {
        throw new Error(`Both methods failed: ${upsertError.message}`);
      }
    }
    
    console.log('✅ Sync record inserted/updated');
    
    // Verify the record exists
    const { data: verifyData, error: verifyError } = await database.supabase
      .from('sync_metadata')
      .select('*')
      .eq('sync_type', 'incremental')
      .single();
    
    // Test the status function
    const status = await database.getStatus();
    
    return NextResponse.json({
      success: true,
      message: 'Sync record created successfully',
      yesterday: yesterday.toISOString(),
      verifyData: verifyData,
      verifyError: verifyError?.message || null,
      status: status,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error inserting sync record:', error);
    return NextResponse.json(
      { error: 'Failed to insert sync record: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET() {
  try {
    console.log('🔍 DEBUG: Checking sync_metadata table...');
    
    // Check if sync_metadata table exists and has data
    const { data: syncData, error: syncError } = await database.supabase
      .from('sync_metadata')
      .select('*')
      .order('updated_at', { ascending: false });
    
    console.log('Sync metadata query result:', { syncData, syncError });
    
    // Check card count
    const { count: cardCount, error: countError } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    console.log('Card count query result:', { cardCount, countError });
    
    // Test the getStatus method
    const status = await database.getStatus();
    console.log('getStatus result:', status);
    
    return NextResponse.json({
      syncData,
      syncError: syncError?.message || null,
      cardCount,
      countError: countError?.message || null,
      status
    });
    
  } catch (error) {
    console.error('Debug sync error:', error);
    return NextResponse.json(
      { error: 'Debug failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
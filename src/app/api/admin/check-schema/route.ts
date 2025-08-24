import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET() {
  try {
    console.log('🔍 Checking cards table schema...');
    
    // Get a sample card to see what columns exist
    const { data: sampleCards, error } = await database.supabase
      .from('cards')
      .select('*')
      .limit(1);
    
    if (error) {
      throw new Error(`Failed to fetch sample card: ${error.message}`);
    }
    
    const columns = sampleCards && sampleCards.length > 0 ? 
      Object.keys(sampleCards[0]) : [];
    
    return NextResponse.json({
      availableColumns: columns.sort(),
      sampleCard: sampleCards?.[0] || null,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error checking schema:', error);
    return NextResponse.json(
      { error: 'Failed to check schema: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';
import { isCardLegalInCommander } from '@/lib/rules';

export async function GET(request: NextRequest) {
  try {
    console.log('🎲 Random commander endpoint called');
    
    // Get all legal commanders efficiently using database query
    const commanders = await database.getAllCommanders();
    console.log(`✅ Found ${commanders.length} legal commanders via database query`);
    
    if (commanders.length === 0) {
      return NextResponse.json(
        { error: 'No legal commanders found in local database' },
        { status: 404 }
      );
    }
    
    // Pick a random commander
    const randomIndex = Math.floor(Math.random() * commanders.length);
    const randomCommander = commanders[randomIndex];
    
    console.log(`🎲 Random commander selected: ${randomCommander.name} (from ${commanders.length} total commanders)`);
    
    return NextResponse.json({
      commander: randomCommander,
      totalEligible: commanders.length,
      method: 'local database'
    });
    
  } catch (error) {
    console.error('Error getting random commander:', error);
    
    return NextResponse.json(
      { error: 'Failed to get random commander', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
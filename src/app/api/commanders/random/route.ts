import { NextRequest, NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';
import { isCardLegalInCommander } from '@/lib/rules';

export async function GET(request: NextRequest) {
  try {
    console.log('🎲 Random commander endpoint called');
    
    // Initialize and ensure database is loaded
    await serverCardDatabase.initialize();
    console.log('✅ Database initialized');
    
    // Get all cards from local database
    const allCards = serverCardDatabase.getAllCards();
    console.log(`🎲 Searching through ${allCards.length} local cards for commanders`);
    
    // Filter for legal commanders from local database
    const commanders = allCards.filter(card => {
      // Must be legendary creature
      if (!card.type_line.toLowerCase().includes('legendary') || 
          !card.type_line.toLowerCase().includes('creature')) {
        return false;
      }
      
      // Must be legal in commander format
      if (!isCardLegalInCommander(card)) {
        return false;
      }
      
      // Skip backgrounds and partners (they're not primary commanders)
      if (card.type_line.toLowerCase().includes('background')) {
        return false;
      }
      
      return true;
    });
    
    console.log(`✅ Found ${commanders.length} legal commanders in local database`);
    
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
import { NextRequest, NextResponse } from 'next/server';
import { scryfallClient } from '@/lib/scryfall';

export async function GET(request: NextRequest) {
  try {
    console.log('🎲 Random commander endpoint called');
    
    // Use Scryfall API for fast random commander selection
    const randomCommander = await scryfallClient.getRandomCommander();
    
    if (!randomCommander) {
      return NextResponse.json(
        { error: 'Failed to get random commander from Scryfall' },
        { status: 404 }
      );
    }
    
    console.log(`🎲 Random commander selected: ${randomCommander.name} via Scryfall API`);
    
    return NextResponse.json({
      commander: randomCommander,
      method: 'scryfall api'
    });
    
  } catch (error) {
    console.error('Error getting random commander:', error);
    
    return NextResponse.json(
      { error: 'Failed to get random commander', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
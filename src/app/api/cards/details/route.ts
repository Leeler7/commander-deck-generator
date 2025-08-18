import { NextRequest, NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardName = searchParams.get('name');
    
    if (!cardName) {
      return NextResponse.json(
        { error: 'Card name is required' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 API: Loading details for card: ${cardName}`);
    
    await serverCardDatabase.initialize();
    
    // Find exact match first
    let card = serverCardDatabase.getCardByName(cardName);
    
    if (!card) {
      // Try search by name (partial match)
      const searchResults = serverCardDatabase.searchByName(cardName, 1);
      card = searchResults.length > 0 ? searchResults[0] : null;
    }
    
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }
    
    console.log(`✅ API: Found card details for: ${card.name}`);
    
    return NextResponse.json(card);
    
  } catch (error) {
    console.error('Error loading card details:', error);
    return NextResponse.json(
      { error: 'Failed to load card details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
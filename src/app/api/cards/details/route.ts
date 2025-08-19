import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

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
    
    // Find exact match first
    let card;
    try {
      card = await database.getCardById ? await database.getCardById(cardName) : null;
    } catch (error) {
      // If getCardById fails or doesn't exist, try search by name
      const searchResults = await database.searchByName(cardName, 1);
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
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
    
    // Find exact match first using getCardByName
    let card;
    try {
      // Use getCardByName if available, otherwise fallback to search
      if (database.getCardByName) {
        card = await database.getCardByName(cardName);
      } else {
        // Fallback to search by name
        const searchResults = await database.searchByName(cardName, 1);
        card = searchResults.find((c: any) => c.name === cardName) || null;
      }
    } catch (error) {
      console.error('Error in card lookup:', error);
      // If both methods fail, try search by name as last resort
      const searchResults = await database.searchByName(cardName, 1);
      card = searchResults.find((c: any) => c.name === cardName) || null;
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
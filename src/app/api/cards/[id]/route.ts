import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cardId = params.id;
    
    if (!cardId) {
      return NextResponse.json(
        { error: 'Card ID is required' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 API: Loading card by ID: ${cardId}`);
    
    // Try to get card by ID
    let card;
    try {
      card = await database.getCardById(cardId);
    } catch (error) {
      console.error('Error getting card by ID:', error);
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }
    
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }
    
    console.log(`✅ API: Found card by ID: ${card.name}`);
    
    return NextResponse.json(card);
    
  } catch (error) {
    console.error('Error loading card by ID:', error);
    return NextResponse.json(
      { error: 'Failed to load card', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
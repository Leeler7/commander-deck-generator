import { NextRequest, NextResponse } from 'next/server';
import { scryfallClient } from '@/lib/scryfall';
import { extractCardPrice } from '@/lib/pricing';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardIds = searchParams.get('ids');
    const preferCheapest = searchParams.get('prefer_cheapest') === 'true';
    
    if (!cardIds) {
      return NextResponse.json(
        { error: 'Card IDs are required. Provide as comma-separated list in "ids" parameter.' },
        { status: 400 }
      );
    }

    const idsArray = cardIds.split(',').map(id => id.trim()).filter(Boolean);
    
    if (idsArray.length === 0) {
      return NextResponse.json(
        { error: 'At least one valid card ID is required.' },
        { status: 400 }
      );
    }

    if (idsArray.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 card IDs allowed per request.' },
        { status: 400 }
      );
    }

    // Fetch cards from Scryfall
    const cards = await scryfallClient.getCardsByIds(idsArray);
    
    // Extract pricing information
    const priceData = cards.map(card => ({
      id: card.id,
      name: card.name,
      price: extractCardPrice(card, preferCheapest),
      prices: card.prices,
      set: card.set || 'unknown',
      set_name: card.set_name || 'Unknown Set'
    }));

    return NextResponse.json({
      success: true,
      prices: priceData,
      prefer_cheapest: preferCheapest,
      total_cards: priceData.length,
      total_value: priceData.reduce((sum, card) => sum + card.price, 0),
      fetched_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Price fetching error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Rate limit') || 
          error.message.includes('429')) {
        return NextResponse.json(
          { error: 'External API rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        );
      }
      
      if (error.message.includes('No printings found') ||
          error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'One or more card IDs were not found.' },
          { status: 404 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'An error occurred while fetching prices. Please try again.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use GET to fetch prices.',
      usage: {
        method: 'GET',
        parameters: {
          ids: 'string - Comma-separated list of Scryfall card IDs',
          prefer_cheapest: 'boolean - Optional, use cheapest printing (default: false)'
        },
        example: '/api/prices?ids=card1,card2,card3&prefer_cheapest=true'
      }
    },
    { status: 405 }
  );
}
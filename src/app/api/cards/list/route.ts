import { NextRequest, NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET(request: NextRequest) {
  try {
    await serverCardDatabase.initialize();
    
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50000');
    const query = searchParams.get('q') || '';
    
    let cards;
    if (query) {
      // Search by name if query provided
      cards = serverCardDatabase.searchByName(query, limit);
    } else {
      // Get all cards (limited for performance)
      cards = serverCardDatabase.searchByFilters({}, limit);
    }
    
    // Return simplified card list for the browser
    const cardList = cards.map(card => ({
      id: card.id,
      name: card.name,
      type_line: card.type_line,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      rarity: card.rarity,
      set_name: card.set_name,
      set_code: card.set_code,
      edhrec_rank: card.edhrec_rank
    }));
    
    return NextResponse.json({
      count: cardList.length,
      cards: cardList
    });
    
  } catch (error) {
    console.error('Error listing cards:', error);
    
    return NextResponse.json(
      { error: 'Failed to list cards', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
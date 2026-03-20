import { NextRequest, NextResponse } from 'next/server';
import { scryfallClient } from '@/lib/scryfall';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '175'), 175);

  try {
    if (!query) {
      return NextResponse.json({ cards: [], total: 0 });
    }

    const response = await scryfallClient.searchCards(`${query} f:commander`, 1, 'name');
    const cards = response.data.slice(0, limit).map(card => ({
      id: card.id,
      name: card.name,
      mana_cost: card.mana_cost,
      cmc: card.cmc,
      type_line: card.type_line,
      color_identity: card.color_identity,
      prices: card.prices,
    }));

    return NextResponse.json({ cards, total: response.total_cards });
  } catch (error: any) {
    console.error('Cards list API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

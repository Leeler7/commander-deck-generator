import { NextRequest, NextResponse } from 'next/server';
import { scryfallClient } from '@/lib/scryfall';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '175'), 175);

  const colors = searchParams.get('colors') || '';

  try {
    if (!search) {
      return NextResponse.json({ cards: [], total: 0 });
    }

    const colorFilter = colors ? ` id<=${colors}` : '';
    const response = await scryfallClient.searchCards(`"${search}" f:commander${colorFilter}`, 1, 'name');
    const cards = response.data.slice(0, limit);

    return NextResponse.json({ cards, total: response.total_cards });
  } catch (error: any) {
    console.error('Cards API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

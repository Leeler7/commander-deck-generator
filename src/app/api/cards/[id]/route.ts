import { NextRequest, NextResponse } from 'next/server';
import { scryfallClient } from '@/lib/scryfall';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cardId = params.id;

  if (!cardId) {
    return NextResponse.json({ error: 'Card ID is required' }, { status: 400 });
  }

  try {
    const cards = await scryfallClient.getCardsByIds([cardId]);
    if (!cards.length) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }
    return NextResponse.json({ card: cards[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { scryfallClient } from '@/lib/scryfall';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cardName = searchParams.get('name');

  if (!cardName) {
    return NextResponse.json({ error: 'Card name is required' }, { status: 400 });
  }

  try {
    const card = await scryfallClient.getCardByName(cardName, true);
    return NextResponse.json({ card });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
}

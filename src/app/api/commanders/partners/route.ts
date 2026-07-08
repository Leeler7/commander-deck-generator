import { NextRequest, NextResponse } from 'next/server';
import { getCardByName, searchValidPartners } from '@/lib/engine/scryfall-client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const commanderName = searchParams.get('commander');
  const query = searchParams.get('q') || '';

  if (!commanderName) {
    return NextResponse.json(
      { error: 'Commander name is required. Use "commander" parameter.' },
      { status: 400 }
    );
  }

  try {
    const commander = await getCardByName(commanderName, true);
    if (!commander) {
      return NextResponse.json(
        { error: `Commander not found: ${commanderName}` },
        { status: 404 }
      );
    }

    const partners = await searchValidPartners(commander, query);
    const limited = partners.slice(0, 20);

    return NextResponse.json({
      success: true,
      partners: limited,
      commander: commanderName,
      total: limited.length,
      has_more: partners.length > 20,
    });
  } catch (error) {
    console.error('Partner search error:', error);

    if (error instanceof Error && (error.message.includes('Rate limit') || error.message.includes('429'))) {
      return NextResponse.json(
        { error: 'External API rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }

    return NextResponse.json({
      success: true,
      partners: [],
      commander: commanderName,
      total: 0,
    });
  }
}

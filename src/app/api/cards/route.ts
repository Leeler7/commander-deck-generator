import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '5000'), 50000);
    const search = searchParams.get('search') || '';
    
    console.log(`📋 API: Loading cards with limit=${limit}, search="${search}"`);
    
    let cards;
    if (search) {
      // Search by name/text if query provided
      cards = await database.searchByName(search, limit);
    } else {
      // Get all cards (limited for performance)
      cards = await database.searchByFilters({}, limit);
    }
    
    console.log(`✅ API: Returning ${cards.length} cards`);
    
    return NextResponse.json({
      cards: cards,
      total: cards.length,
      limit: limit,
      search: search
    });
    
  } catch (error) {
    console.error('Error loading cards:', error);
    return NextResponse.json(
      { error: 'Failed to load cards', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
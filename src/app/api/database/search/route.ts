import { NextRequest, NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET(request: NextRequest) {
  try {
    // Initialize database if not already done
    await serverCardDatabase.initialize();
    
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }
    
    const results = serverCardDatabase.searchByName(query, 10);
    
    return NextResponse.json({
      query,
      count: results.length,
      cards: results.map(card => ({
        name: card.name,
        type_line: card.type_line,
        mana_cost: card.mana_cost,
        cmc: card.cmc
      }))
    });
  } catch (error) {
    console.error('Error searching database:', error);
    
    return NextResponse.json(
      { error: 'Failed to search database' },
      { status: 500 }
    );
  }
}
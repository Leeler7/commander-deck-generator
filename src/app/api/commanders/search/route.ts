import { NextRequest, NextResponse } from 'next/server';
import { scryfallClient } from '@/lib/scryfall';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  try {
    
    if (!query) {
      return NextResponse.json(
        { error: 'Search query is required. Use "q" parameter.' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        commanders: [],
        query,
        total: 0
      });
    }

    // Search for commanders using Scryfall
    const commanders = await scryfallClient.searchLegalCommanders(query);
    
    // Limit results to prevent overwhelming the UI
    const limitedCommanders = commanders.slice(0, 20);
    
    return NextResponse.json({
      success: true,
      commanders: limitedCommanders,
      query,
      total: limitedCommanders.length,
      has_more: commanders.length > 20,
      searched_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Commander search error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Rate limit') || 
          error.message.includes('429')) {
        return NextResponse.json(
          { error: 'External API rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        );
      }
    }
    
    // If no results found, return empty array instead of error
    return NextResponse.json({
      success: true,
      commanders: [],
      query,
      total: 0,
      searched_at: new Date().toISOString()
    });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use GET to search commanders.',
      usage: {
        method: 'GET',
        parameters: {
          q: 'string - Search query for commander name'
        },
        example: '/api/commanders/search?q=atraxa'
      }
    },
    { status: 405 }
  );
}
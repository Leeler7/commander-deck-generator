import { NextRequest, NextResponse } from 'next/server';
import { SupabaseCardDatabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');

    const database = new SupabaseCardDatabase();
    
    // If no query, return empty results to avoid loading everything
    if (!query || query.length < 2) {
      return NextResponse.json({
        tags: [],
        message: 'Enter at least 2 characters to search'
      });
    }

    const tags = await database.searchTags(query, category, limit);
    
    return NextResponse.json({
      tags: tags.map(tag => ({
        name: tag.name,
        category: tag.category,
        description: tag.description,
        count: 1 // Placeholder - could be actual usage count if needed
      }))
    });

  } catch (error) {
    console.error('Tag search error:', error);
    return NextResponse.json(
      { error: 'Failed to search tags' },
      { status: 500 }
    );
  }
}
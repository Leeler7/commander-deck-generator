import { NextRequest, NextResponse } from 'next/server';
import { SupabaseCardDatabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '20');

    const database = new SupabaseCardDatabase();
    
    // If no query and no category, return empty results to avoid loading everything
    if ((!query || query.length < 2) && !category) {
      return NextResponse.json({
        tags: [],
        message: 'Enter at least 2 characters to search or select a category'
      });
    }

    const tags = await database.searchTags(query, category, limit);
    
    // Helper function to clean up tag display names
    const formatTagName = (rawName: string): string => {
      // Remove prefixes like "ability_keyword_", "keyword_", etc.
      return rawName
        .replace(/^(ability_keyword_|ability_word_|keyword_|mechanic_)/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/\bEtb\b/g, 'ETB')
        .replace(/\bLtb\b/g, 'LTB')
        .replace(/\bCmc\b/g, 'CMC');
    };
    
    return NextResponse.json({
      tags: tags.map(tag => ({
        name: tag.name, // Keep original for backend
        displayName: formatTagName(tag.name), // Clean version for display
        category: tag.category,
        description: tag.description,
        count: 1
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
import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET(request: NextRequest) {
  try {
    console.log('🏷️ Loading available tags from tags table...');
    
    // Get all available tags directly from the tags table
    const availableTags = await database.getAvailableTags();
    
    console.log(`🏷️ Found ${availableTags.length} tags in database`);
    
    // Group tags by category from the database
    const tagsByCategory: Record<string, string[]> = {};
    const allTagNames: string[] = [];
    
    availableTags.forEach(tag => {
      const category = tag.category || 'other';
      if (!tagsByCategory[category]) {
        tagsByCategory[category] = [];
      }
      tagsByCategory[category].push(tag.name);
      allTagNames.push(tag.name);
    });

    // Sort each category and the complete list
    Object.keys(tagsByCategory).forEach(category => {
      tagsByCategory[category].sort();
    });
    allTagNames.sort();

    console.log(`🏷️ Organized tags into ${Object.keys(tagsByCategory).length} categories`);

    return NextResponse.json({
      allTags: allTagNames,
      tagsByCategory,
      totalCount: allTagNames.length
    });
    
  } catch (error) {
    console.error('Error fetching available tags:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch available tags', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
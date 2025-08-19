import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function GET(request: NextRequest) {
  try {
    console.log('📋 Fetching tags from database...');
    
    // Get available tags from the database
    const tags = await database.getAvailableTags();
    
    console.log(`✅ Found ${tags.length} unique tags in database`);
    
    // Group tags by category
    const tagsByCategory: Record<string, Array<{ name: string; count: number }>> = {};
    
    for (const tag of tags) {
      const category = tag.tag_category || 'uncategorized';
      if (!tagsByCategory[category]) {
        tagsByCategory[category] = [];
      }
      tagsByCategory[category].push({
        name: tag.tag_name,
        count: tag.count
      });
    }
    
    // Get all tag names for easy access
    const allTagNames = tags.map(t => t.tag_name);
    
    return NextResponse.json({
      tags: tags,
      tagsByCategory: tagsByCategory,
      allTagNames: allTagNames,
      totalCount: tags.length,
      totalTaggedCards: tags.reduce((sum, tag) => sum + tag.count, 0)
    });
    
  } catch (error) {
    console.error('Error fetching database tags:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch database tags', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
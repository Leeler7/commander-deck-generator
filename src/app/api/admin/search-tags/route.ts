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
    
    // Get usage counts for all tags efficiently with timeout protection
    const tagIds = tags.filter(t => t.id).map(t => t.id);
    const tagNames = tags.map(t => t.name);
    
    let usageCounts: Record<string | number, number> = {};
    
    try {
      // Set a timeout for the count operation
      const countPromise = database.getTagUsageCounts(tagIds, tagNames);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Count timeout')), 2000)
      );
      
      usageCounts = await Promise.race([countPromise, timeoutPromise]) as Record<string | number, number>;
    } catch (error) {
      console.log('Usage count timed out, proceeding without counts:', error);
      // Use empty counts object - will default to 0
    }
    
    // Map tags with their usage counts
    const tagsWithCounts = tags.map(tag => {
      const count = usageCounts[tag.id] || usageCounts[tag.name] || 0;
      
      return {
        name: tag.name, // Keep original for backend
        displayName: formatTagName(tag.name), // Clean version for display
        category: tag.category,
        description: tag.description,
        count: count,
        id: tag.id,
        synergy_weight: tag.synergy_weight,
        is_active: tag.is_active
      };
    });
    
    return NextResponse.json({
      tags: tagsWithCounts
    });

  } catch (error) {
    console.error('Tag search error:', error);
    return NextResponse.json(
      { error: 'Failed to search tags' },
      { status: 500 }
    );
  }
}
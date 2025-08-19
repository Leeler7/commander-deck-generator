import { NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function GET() {
  try {
    console.log('📊 Loading tag statistics for cleanup...');
    
    const allCards = await database.getAllCards();
    
    // Count tag occurrences
    const tagCounts = new Map<string, number>();
    let totalCardsWithTags = 0;
    
    allCards.forEach(card => {
      if (card.mechanics?.mechanicTags && card.mechanics.mechanicTags.length > 0) {
        totalCardsWithTags++;
        card.mechanics.mechanicTags.forEach(tag => {
          // Handle both string tags and object tags
          const tagName = typeof tag === 'string' ? tag : (tag?.name || String(tag));
          tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
        });
      }
    });
    
    // Convert to array with statistics
    const tagStats = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({
        tag,
        count,
        percentage: totalCardsWithTags > 0 ? (count / totalCardsWithTags) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count);
    
    return NextResponse.json({
      tags: tagStats,
      totalCards: allCards.length,
      totalCardsWithTags,
      totalUniqueTags: tagCounts.size
    });
    
  } catch (error) {
    console.error('Error loading tag statistics:', error);
    return NextResponse.json(
      { error: 'Failed to load tag statistics' },
      { status: 500 }
    );
  }
}
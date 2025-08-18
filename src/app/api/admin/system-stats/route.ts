import { NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET() {
  try {
    console.log('📊 API: Loading system statistics...');
    
    await serverCardDatabase.initialize();
    
    const allCards = serverCardDatabase.getAllCards();
    
    // Calculate real database statistics
    const commanders = allCards.filter(card => 
      card.type_line?.includes('Legendary') && card.type_line?.includes('Creature')
    );
    
    const cardsWithMechanics = allCards.filter(card => 
      card.mechanics && card.mechanics.mechanicTags?.length > 0
    );
    
    // Calculate tag statistics
    const tagCounts = new Map<string, number>();
    let totalTagsOnCards = 0;
    
    cardsWithMechanics.forEach(card => {
      if (card.mechanics?.mechanicTags) {
        totalTagsOnCards += card.mechanics.mechanicTags.length;
        card.mechanics.mechanicTags.forEach(tag => {
          // Handle both string tags and object tags
          const tagName = typeof tag === 'string' ? tag : (tag?.name || String(tag));
          tagCounts.set(tagName, (tagCounts.get(tagName) || 0) + 1);
        });
      }
    });
    
    const topTags = Array.from(tagCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    const avgTagsPerCard = cardsWithMechanics.length > 0 
      ? totalTagsOnCards / cardsWithMechanics.length 
      : 0;
    
    // Estimate database size (rough calculation)
    const estimatedSizeBytes = allCards.length * 2000; // ~2KB per card estimate
    const databaseSize = estimatedSizeBytes > 1024 * 1024 
      ? `${(estimatedSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${(estimatedSizeBytes / 1024).toFixed(1)} KB`;
    
    const realStats = {
      database: {
        totalCards: allCards.length,
        commanderCards: commanders.length,
        cardsWithMechanics: cardsWithMechanics.length,
        totalTags: tagCounts.size,
        avgTagsPerCard: Number(avgTagsPerCard.toFixed(1)),
        topTags,
        databaseSize,
        lastUpdated: new Date().toISOString()
      }
    };
    
    console.log('✅ API: System statistics loaded');
    
    return NextResponse.json(realStats);
    
  } catch (error) {
    console.error('Error loading system stats:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load system stats', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
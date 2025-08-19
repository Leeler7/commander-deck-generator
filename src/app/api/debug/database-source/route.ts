import { NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET() {
  try {
    await serverCardDatabase.initialize();
    
    // Get a sample card to check its data
    const allCards = serverCardDatabase.getAllCards();
    const sampleCard = allCards[0];
    
    // Check if any cards have dice tags
    let cardsWithDice = 0;
    for (const card of allCards.slice(0, 1000)) { // Check first 1000 cards
      if (card.mechanics?.mechanicTags) {
        const tags = card.mechanics.mechanicTags.map(tag => 
          typeof tag === 'string' ? tag : tag.name
        );
        if (tags.includes('dice')) {
          cardsWithDice++;
        }
      }
    }
    
    const baseUrl = 'https://raw.githubusercontent.com/Leeler7/commander-deck-generator/main/public';
    
    // Test manifest accessibility
    const manifestResponse = await fetch(`${baseUrl}/database/chunks/manifest.json`);
    const manifestAccessible = manifestResponse.ok;
    let manifest = null;
    if (manifestAccessible) {
      manifest = await manifestResponse.json();
    }
    
    return NextResponse.json({
      totalCards: allCards.length,
      cardsWithDice,
      sampleCard: {
        name: sampleCard?.name,
        id: sampleCard?.id,
        lastUpdated: sampleCard?.last_updated,
        hasDiceTag: sampleCard?.mechanics?.mechanicTags ? 
          sampleCard.mechanics.mechanicTags.some((tag: any) => 
            (typeof tag === 'string' ? tag : tag.name) === 'dice'
          ) : false
      },
      databaseSource: {
        expectedUrl: `${baseUrl}/database/chunks/manifest.json`,
        manifestAccessible,
        manifest
      }
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
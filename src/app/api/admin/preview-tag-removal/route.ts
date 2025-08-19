import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    const { tags } = await request.json();
    
    if (!tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'Invalid tags array' },
        { status: 400 }
      );
    }
    
    console.log(`📋 Previewing removal of ${tags.length} tags...`);
    
    const allCards = await database.getAllCards();
    
    // Find affected cards
    const affectedCards = [];
    
    for (const card of allCards) {
      if (card.mechanics?.mechanicTags && card.mechanics.mechanicTags.length > 0) {
        const cardTags = card.mechanics.mechanicTags.map(tag => 
          typeof tag === 'string' ? tag : (tag?.name || String(tag))
        );
        
        const hasTargetTags = cardTags.some(tag => tags.includes(tag));
        
        if (hasTargetTags) {
          affectedCards.push({
            id: card.id,
            name: card.name,
            tags: cardTags
          });
        }
      }
    }
    
    // Limit preview to first 100 cards for performance
    const previewCards = affectedCards.slice(0, 100);
    
    return NextResponse.json({
      affectedCards: previewCards,
      totalAffected: affectedCards.length,
      message: affectedCards.length > 100 ? 
        `Showing first 100 of ${affectedCards.length} affected cards` : 
        `${affectedCards.length} cards will be affected`
    });
    
  } catch (error) {
    console.error('Error previewing tag removal:', error);
    return NextResponse.json(
      { error: 'Failed to preview changes' },
      { status: 500 }
    );
  }
}
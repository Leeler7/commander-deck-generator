import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

export async function POST(request: NextRequest) {
  try {
    const { tagName, criteria } = await request.json();
    
    if (!tagName || !criteria) {
      return NextResponse.json(
        { error: 'Tag name and criteria are required' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 Previewing tag addition: "${tagName}" with criteria:`, criteria);
    
    const allCards = await database.getAllCards();
    
    let matchingCards = [];
    
    // Filter cards based on criteria
    for (const card of allCards) {
      let matches = false;
      
      if (criteria.mode === 'text' && criteria.textQuery) {
        // Search in oracle text
        const text = card.oracle_text || '';
        const query = criteria.textQuery;
        
        if (criteria.exactMatch) {
          matches = criteria.caseSensitive 
            ? text.includes(query)
            : text.toLowerCase().includes(query.toLowerCase());
        } else {
          // Fuzzy match - all words must be present
          const words = query.toLowerCase().split(/\s+/);
          const cardText = text.toLowerCase();
          matches = words.every(word => cardText.includes(word));
        }
      } 
      else if (criteria.mode === 'color' && criteria.colors) {
        // Match color identity exactly
        const cardColors = card.color_identity || [];
        matches = criteria.colors.length === cardColors.length &&
                 criteria.colors.every(color => cardColors.includes(color));
      }
      else if (criteria.mode === 'type' && criteria.typeQuery) {
        // Search in type line
        const typeLine = card.type_line || '';
        const query = criteria.typeQuery;
        
        matches = criteria.caseSensitive 
          ? typeLine.includes(query)
          : typeLine.toLowerCase().includes(query.toLowerCase());
      }
      
      if (matches) {
        const currentTags = card.mechanics?.mechanicTags?.map(tag => 
          typeof tag === 'string' ? tag : (tag?.name || String(tag))
        ) || [];
        
        matchingCards.push({
          id: card.id,
          name: card.name,
          oracle_text: card.oracle_text || '',
          colors: card.colors || [],
          color_identity: card.color_identity || [],
          type_line: card.type_line || '',
          currentTags
        });
      }
    }
    
    // Limit preview to first 50 cards
    const previewCards = matchingCards.slice(0, 50);
    
    return NextResponse.json({
      matchingCards: previewCards,
      totalMatching: matchingCards.length,
      totalCards: allCards.length,
      message: matchingCards.length > 50 
        ? `Showing first 50 of ${matchingCards.length} matching cards`
        : `Found ${matchingCards.length} matching cards`
    });
    
  } catch (error) {
    console.error('Error previewing tag addition:', error);
    return NextResponse.json(
      { error: 'Failed to preview tag addition' },
      { status: 500 }
    );
  }
}
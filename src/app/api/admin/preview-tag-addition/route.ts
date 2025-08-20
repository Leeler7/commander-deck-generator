import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';

// Simple in-memory cache to avoid repeated database calls
let cachedCards: any[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
    
    // Use cached cards if available and fresh
    let allCards: any[];
    const now = Date.now();
    
    if (cachedCards && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Using cached cards for consistency');
      allCards = cachedCards;
    } else {
      console.log('🔄 Loading fresh cards from database');
      allCards = await database.getAllCards();
      // Cache the results
      cachedCards = allCards;
      cacheTimestamp = now;
    }
    
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
        const cardColors = card.color_identity || [];
        
        if (criteria.colorMatchMode === 'contains') {
          // Match cards that contain all selected colors (may have additional colors)
          matches = criteria.colors.every(color => cardColors.includes(color));
        } else {
          // Exact match - card must have exactly the selected colors (default behavior)
          matches = criteria.colors.length === cardColors.length &&
                   criteria.colors.every(color => cardColors.includes(color));
        }
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
    
    // Deduplicate matching cards by ID to prevent duplicate key errors
    const uniqueMatchingCards = matchingCards.filter((card, index, self) => 
      index === self.findIndex((c) => c.id === card.id)
    );
    
    // Limit preview to first 50 cards
    const previewCards = uniqueMatchingCards.slice(0, 50);
    
    return NextResponse.json({
      matchingCards: previewCards,
      totalMatching: uniqueMatchingCards.length,
      totalCards: allCards.length,
      message: uniqueMatchingCards.length > 50 
        ? `Showing first 50 of ${uniqueMatchingCards.length} matching cards`
        : `Found ${uniqueMatchingCards.length} matching cards`
    });
    
  } catch (error) {
    console.error('Error previewing tag addition:', error);
    return NextResponse.json(
      { error: 'Failed to preview tag addition' },
      { status: 500 }
    );
  }
}
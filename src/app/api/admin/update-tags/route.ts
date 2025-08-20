import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';
import { CardMechanicsTagger } from '@/lib/card-mechanics-tagger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cardName, tagsToAdd, tagsToRemove } = body;

    if (!cardName) {
      return NextResponse.json(
        { error: 'Card name is required' },
        { status: 400 }
      );
    }

    // Initialize the database
    // Find the card
    const cards = await database.searchByName(cardName, 1);
    if (cards.length === 0) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    const card = cards[0];
    
    // Get current mechanics analysis
    const tagger = new CardMechanicsTagger();
    const currentMechanics = await tagger.analyzeCardEnhanced(card);
    
    // Create new tags array with modifications
    let updatedTags = [...currentMechanics.mechanicTags];
    
    // Remove specified tags
    if (tagsToRemove && Array.isArray(tagsToRemove)) {
      updatedTags = updatedTags.filter(tag => !tagsToRemove.includes(tag.name));
    }
    
    // Add new tags
    if (tagsToAdd && Array.isArray(tagsToAdd)) {
      for (const tagName of tagsToAdd) {
        // Check if tag already exists
        if (!updatedTags.some(tag => tag.name === tagName)) {
          updatedTags.push({
            name: tagName,
            category: 'manual', // Mark as manually added
            priority: 5, // Medium priority for manual tags
            synergy_weight: 1.0 // Default synergy weight for manual tags
          });
        }
      }
    }
    
    // Try to persist to database if using Supabase
    let persistedToDatabase = false;
    try {
      if (database && typeof database.addTagToCards === 'function' && typeof database.removeTagFromCards === 'function') {
        // Add tags to database
        if (tagsToAdd && tagsToAdd.length > 0) {
          for (const tagName of tagsToAdd) {
            await (database as any).addTagToCards(tagName, [card.id]);
          }
        }
        
        // Remove tags from database
        if (tagsToRemove && tagsToRemove.length > 0) {
          for (const tagName of tagsToRemove) {
            await (database as any).removeTagFromCards(tagName, [card.id]);
          }
        }
        
        persistedToDatabase = true;
      }
    } catch (dbError) {
      console.error('Failed to persist tag changes to database:', dbError);
      // Continue with in-memory response even if database update failed
    }
    
    const updatedMechanics = {
      ...currentMechanics,
      mechanicTags: updatedTags
    };

    return NextResponse.json({
      success: true,
      cardName,
      updatedMechanics,
      tagsAdded: tagsToAdd || [],
      tagsRemoved: tagsToRemove || [],
      persistedToDatabase,
      message: persistedToDatabase 
        ? 'Tags updated successfully and persisted to database' 
        : 'Tags updated successfully (in-memory only - database persistence failed or unavailable)'
    });
    
  } catch (error) {
    console.error('Error updating card tags:', error);
    
    return NextResponse.json(
      { error: 'Failed to update card tags', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
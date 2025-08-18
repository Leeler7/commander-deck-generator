import { NextRequest, NextResponse } from 'next/server';
import { serverCardDatabase } from '@/lib/server-card-database';
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
    await serverCardDatabase.initialize();
    
    // Find the card
    const cards = serverCardDatabase.searchByName(cardName, 1);
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
            confidence: 1.0, // Full confidence for manual tags
            evidence: ['Manual addition'],
            priority: 5 // Medium priority for manual tags
          });
        }
      }
    }
    
    // For now, we'll return the updated analysis without persisting to database
    // In a full implementation, you'd want to store these manual overrides
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
      message: 'Tags updated successfully (in-memory only - not persisted to database)'
    });
    
  } catch (error) {
    console.error('Error updating card tags:', error);
    
    return NextResponse.json(
      { error: 'Failed to update card tags', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
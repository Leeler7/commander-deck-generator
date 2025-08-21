import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

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

    console.log(`🏷️ Updating tags for card: ${cardName}`);
    console.log(`Tags to add: [${tagsToAdd?.join(', ') || 'none'}]`);
    console.log(`Tags to remove: [${tagsToRemove?.join(', ') || 'none'}]`);

    // Get the card
    const card = await database.getCardByName(cardName);
    if (!card) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // Get all available tags to validate tag names
    const availableTags = await database.getAvailableTags();
    const validTagNames = new Set(availableTags.map(tag => tag.name));
    
    // Validate tags to add
    if (tagsToAdd && Array.isArray(tagsToAdd)) {
      const invalidTags = tagsToAdd.filter(tagName => !validTagNames.has(tagName));
      if (invalidTags.length > 0) {
        return NextResponse.json(
          { error: `Invalid tag names: ${invalidTags.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Get current tag IDs
    const currentTagIds = card.tag_ids || [];
    
    // Convert tag names to tag IDs
    const tagNameToId = new Map(availableTags.map(tag => [tag.name, tag.id]));
    
    let updatedTagIds = [...currentTagIds];
    
    // Remove specified tags
    if (tagsToRemove && Array.isArray(tagsToRemove)) {
      const tagIdsToRemove = tagsToRemove
        .map(tagName => tagNameToId.get(tagName))
        .filter(id => id !== undefined);
      
      updatedTagIds = updatedTagIds.filter(id => !tagIdsToRemove.includes(id));
      console.log(`Removing tag IDs: [${tagIdsToRemove.join(', ')}]`);
    }
    
    // Add new tags
    if (tagsToAdd && Array.isArray(tagsToAdd)) {
      const tagIdsToAdd = tagsToAdd
        .map(tagName => tagNameToId.get(tagName))
        .filter(id => id !== undefined && !updatedTagIds.includes(id));
      
      updatedTagIds.push(...tagIdsToAdd);
      console.log(`Adding tag IDs: [${tagIdsToAdd.join(', ')}]`);
    }

    // Update the card in the database using addTagsToCard and removeTagsFromCard
    let success = true;
    if (tagsToAdd && tagsToAdd.length > 0) {
      const tagIdsToAdd = tagsToAdd
        .map(tagName => tagNameToId.get(tagName))
        .filter(id => id !== undefined);
      
      if (tagIdsToAdd.length > 0) {
        success = success && await database.addTagsToCard(card.id, tagIdsToAdd);
      }
    }
    
    if (tagsToRemove && tagsToRemove.length > 0) {
      const tagIdsToRemove = tagsToRemove
        .map(tagName => tagNameToId.get(tagName))
        .filter(id => id !== undefined);
      
      if (tagIdsToRemove.length > 0) {
        success = success && await database.removeTagsFromCard(card.id, tagIdsToRemove);
      }
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update card tags in database' },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully updated tags for ${cardName}`);

    return NextResponse.json({
      success: true,
      cardName,
      tagsAdded: tagsToAdd || [],
      tagsRemoved: tagsToRemove || [],
      message: 'Tags updated successfully in database'
    });
    
  } catch (error) {
    console.error('Error updating card tags:', error);
    
    return NextResponse.json(
      { error: 'Failed to update card tags', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
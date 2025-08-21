import { NextRequest, NextResponse } from 'next/server';
import { database, supabase } from '@/lib/supabase-updated';

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

    // Get current tag IDs first
    const currentTagIds = card.tag_ids || [];
    
    // Get all available tags to validate tag names (for adding)
    const availableTags = await database.getAvailableTags();
    const validTagNames = new Set(availableTags.map(tag => tag.name));
    
    // Get specific tags needed for removal by their IDs
    // First, collect all tag IDs from the card that we might need to look up
    const neededTagIds = [...currentTagIds];
    
    const { data: neededTags, error: neededTagsError } = await supabase
      .from('tags')
      .select('*')
      .in('id', neededTagIds);
      
    if (neededTagsError) {
      console.error('Error fetching needed tags:', neededTagsError);
      return NextResponse.json(
        { error: 'Failed to fetch needed tag data' },
        { status: 500 }
      );
    }
    
    console.log(`🔍 Fetched ${neededTags?.length || 0} needed tags for current card`);
    
    // Also get all active tags for validation (for adding)
    const { data: allActiveTags, error: allActiveTagsError } = await supabase
      .from('tags')
      .select('*')
      .eq('is_active', true);
      
    if (allActiveTagsError) {
      console.error('Error fetching active tags:', allActiveTagsError);
    }
    
    // Combine the two sets of tags
    const allTags = [...(neededTags || []), ...(allActiveTags || [])];
    const uniqueTags = allTags.filter((tag, index, self) => 
      index === self.findIndex(t => t.id === tag.id)
    );
    
    console.log(`🔍 Total unique tags available: ${uniqueTags.length}`);
    
    // Check if tag ID 1203 exists (should be "play")
    const tag1203 = uniqueTags.find(tag => tag.id === 1203);
    if (tag1203) {
      console.log(`🔍 Found tag ID 1203: name="${tag1203.name}", active: ${tag1203.is_active}`);
    } else {
      console.log(`🚨 Tag ID 1203 NOT FOUND in fetched tags!`);
      // Show which tag IDs we got for this card
      const tagIds = neededTagIds.sort((a, b) => a - b);
      console.log(`🔍 Card's tag IDs we looked up: [${tagIds.join(', ')}]`);
      const foundTagIds = (neededTags || []).map(t => t.id).sort((a, b) => a - b);
      console.log(`🔍 Tag IDs found in database: [${foundTagIds.join(', ')}]`);
    }
    
    // Check if "play" tag exists in the results
    const playTag = uniqueTags.find(tag => tag.name === 'play');
    if (playTag) {
      console.log(`🔍 Found "play" tag: ID ${playTag.id}, active: ${playTag.is_active}`);
    } else {
      console.log(`🚨 "play" tag NOT FOUND in tags table!`);
      // Search for similar tags
      const similarTags = uniqueTags.filter(tag => tag.name.toLowerCase().includes('play'));
      console.log(`🔍 Tags containing "play": [${similarTags.map(t => t.name).join(', ')}]`);
    }
    
    // Validate tags to add (only active tags can be added)
    if (tagsToAdd && Array.isArray(tagsToAdd)) {
      const invalidTags = tagsToAdd.filter(tagName => !validTagNames.has(tagName));
      if (invalidTags.length > 0) {
        return NextResponse.json(
          { error: `Invalid tag names: ${invalidTags.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // Convert tag names to tag IDs using all available tags (including inactive ones for this card)
    const tagNameToId = new Map(uniqueTags.map(tag => [tag.name, tag.id]));
    
    console.log(`🔍 Available tag names for lookup: [${Array.from(tagNameToId.keys()).slice(0, 10).join(', ')}...] (showing first 10 of ${tagNameToId.size})`);
    
    // Debug: specifically look for "play" in the map
    console.log(`🔍 Direct lookup for "play": ${tagNameToId.get('play')}`);
    console.log(`🔍 Keys containing "play": [${Array.from(tagNameToId.keys()).filter(key => key.includes('play')).join(', ')}]`);
    console.log(`🔍 Does map have "play"? ${tagNameToId.has('play')}`);
    
    let updatedTagIds = [...currentTagIds];
    
    // Remove specified tags
    if (tagsToRemove && Array.isArray(tagsToRemove)) {
      console.log(`🔍 Step 1: Tag to be removed identified: [${tagsToRemove.join(', ')}]`);
      console.log(`🔍 Step 1: Current card tag_ids: [${currentTagIds.join(', ')}]`);
      
      const tagIdsToRemove = tagsToRemove
        .map(tagName => {
          const tagId = tagNameToId.get(tagName);
          console.log(`🔍 Step 2: Tag "${tagName}" -> ID: ${tagId || 'NOT FOUND'}`);
          if (tagId && currentTagIds.includes(tagId)) {
            console.log(`✅ Step 2: Tag ID ${tagId} found in card's tag_ids - will remove`);
          } else if (tagId) {
            console.log(`⚠️ Step 2: Tag ID ${tagId} not in card's current tag_ids`);
          }
          return tagId;
        })
        .filter(id => id !== undefined);
      
      console.log(`🔍 Step 3: Tag IDs to remove from tag_ids column: [${tagIdsToRemove.join(', ')}]`);
      
      // Remove by tag IDs  
      const beforeRemoval = [...updatedTagIds];
      updatedTagIds = updatedTagIds.filter(id => !tagIdsToRemove.includes(id));
      
      console.log(`🔍 Step 3: Before removal: [${beforeRemoval.join(', ')}]`);
      console.log(`🔍 Step 3: After removal: [${updatedTagIds.join(', ')}]`);
      console.log(`🔍 Step 3: Successfully removed ${beforeRemoval.length - updatedTagIds.length} tag IDs`);
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
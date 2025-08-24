import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';
import { CardMechanicsTagger } from '@/lib/card-mechanics-tagger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit = 100, onlyUntagged = false } = body; // Changed default to false
    
    console.log(`🏷️ Starting auto-tagging process (limit: ${limit}, onlyUntagged: ${onlyUntagged})`);
    
    const tagger = new CardMechanicsTagger();
    
    // Get cards that need tagging
    let cards;
    if (onlyUntagged) {
      // Get cards with null tag_ids (removed legality filter to avoid timeout)
      const { data, error } = await database.supabase
        .from('cards')
        .select('id, name, type_line, oracle_text, mana_cost, cmc, colors, color_identity, keywords, power, toughness, loyalty, tag_ids')
        .is('tag_ids', null)
        .limit(limit);
        
      if (error) {
        throw new Error(`Failed to fetch untagged cards: ${error.message}`);
      }
      cards = data || [];
    } else {
      // Get any cards for re-tagging (just use simple select)
      const { data, error } = await database.supabase
        .from('cards')
        .select('id, name, type_line, oracle_text, mana_cost, cmc, colors, color_identity, keywords, power, toughness, loyalty, tag_ids')
        .limit(limit);
      
      if (error) {
        throw new Error(`Failed to fetch cards: ${error.message}`);
      }
      cards = data || [];
    }
    
    console.log(`📊 Found ${cards.length} cards to process`);
    
    if (cards.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No cards need tagging',
        stats: { processed: 0, tagged: 0, skipped: 0 }
      });
    }
    
    let processed = 0;
    let tagged = 0;
    let skipped = 0;
    
    for (const card of cards) {
      try {
        console.log(`🔍 Processing: ${card.name}`);
        
        // Generate mechanics analysis
        const mechanics = await tagger.analyzeCard(card);
        
        if (mechanics.mechanicTags.length === 0) {
          console.log(`⚠️ No mechanics found for: ${card.name}`);
          skipped++;
          processed++;
          continue;
        }
        
        // Convert mechanic tags to existing tag IDs only
        const tagIds = await getExistingTagIds(mechanics.mechanicTags);
        
        if (tagIds.length === 0) {
          console.log(`⚠️ No matching tags found for: ${card.name}`);
          skipped++;
        } else {
          // Add tags to card (this will merge with existing tags)
          const success = await database.addTagsToCard(card.id, tagIds);
          
          if (success) {
            console.log(`✅ Tagged ${card.name} with ${tagIds.length} tags`);
            tagged++;
          } else {
            console.error(`❌ Failed to tag: ${card.name}`);
            skipped++;
          }
        }
        
        processed++;
        
        // Progress logging
        if (processed % 10 === 0) {
          console.log(`📈 Progress: ${processed}/${cards.length} (${tagged} tagged, ${skipped} skipped)`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing ${card.name}:`, error);
        skipped++;
        processed++;
      }
    }
    
    console.log(`✅ Auto-tagging completed: ${processed} processed, ${tagged} tagged, ${skipped} skipped`);
    
    return NextResponse.json({
      success: true,
      message: `Auto-tagging completed`,
      stats: {
        processed,
        tagged,
        skipped
      }
    });
    
  } catch (error) {
    console.error('❌ Auto-tagging failed:', error);
    return NextResponse.json(
      { error: 'Auto-tagging failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * Convert mechanic tags to existing tag IDs only
 * This is conservative - only uses tags we already have
 */
async function getExistingTagIds(mechanicTags: any[]): Promise<number[]> {
  const tagIds: number[] = [];
  
  for (const mechanic of mechanicTags) {
    try {
      // Search for exact matches first
      let existingTags = await database.searchTags(mechanic.name, mechanic.category, 5);
      
      // If no exact match, try broader search
      if (existingTags.length === 0) {
        existingTags = await database.searchTags(mechanic.name, null, 5);
      }
      
      if (existingTags.length > 0) {
        // Use the first (best) match
        const tag = existingTags[0];
        if (!tagIds.includes(tag.id)) {
          tagIds.push(tag.id);
        }
      }
      
    } catch (error) {
      console.error(`Error looking up tag for ${mechanic.name}:`, error);
    }
  }
  
  return tagIds;
}

export async function GET(request: NextRequest) {
  try {
    // Simple approach - get basic stats without complex JSON queries for now
    const { data: totalData, error: totalError } = await database.supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('legalities->>commander', 'legal');
      
    if (totalError) {
      throw new Error(`Failed to count total cards: ${totalError.message}`);
    }
    
    // For now, return basic info - more detailed stats can be added later
    return NextResponse.json({
      stats: {
        totalCards: totalData || 0,
        untaggedCards: 'Unknown - requires analysis',
        taggedCards: 'Unknown - requires analysis'
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to get auto-tagging stats:', error);
    return NextResponse.json(
      { error: 'Failed to get stats: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
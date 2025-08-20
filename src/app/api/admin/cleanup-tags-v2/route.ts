import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🧹 Starting comprehensive tag cleanup...');
    
    // Step 1: Get all tags from the tags table (no limit to get all)
    const { data: allTags, error: tagsError } = await supabase
      .from('tags')
      .select('id, name, category')
      .eq('is_active', true)
      .order('name')
      .limit(10000); // Get more tags to ensure we find all mechanic_ tags
    
    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }
    
    if (!allTags || allTags.length === 0) {
      return NextResponse.json({ error: 'No tags found' }, { status: 404 });
    }
    
    console.log(`📊 Found ${allTags.length} total tags`);
    
    // Step 2: Identify overlapping mechanic_ and ability_keyword_ tags
    const mechanicTags = allTags.filter(tag => tag.name.startsWith('mechanic_'));
    const abilityKeywordTags = allTags.filter(tag => tag.name.startsWith('ability_keyword_'));
    
    console.log(`🔧 Found ${mechanicTags.length} mechanic_ tags`);
    console.log(`⚡ Found ${abilityKeywordTags.length} ability_keyword_ tags`);
    
    const overlaps = [];
    const mechanicIdsToDelete = [];
    const tagIdMapping: Record<number, number> = {}; // Maps mechanic ID to ability_keyword ID
    
    for (const mechanicTag of mechanicTags) {
      const baseName = mechanicTag.name.replace('mechanic_', '');
      const correspondingAbilityTag = abilityKeywordTags.find(tag => 
        tag.name === `ability_keyword_${baseName}`
      );
      
      if (correspondingAbilityTag) {
        overlaps.push({
          baseName,
          mechanicTag: {
            id: mechanicTag.id,
            name: mechanicTag.name
          },
          abilityTag: {
            id: correspondingAbilityTag.id,
            name: correspondingAbilityTag.name
          }
        });
        
        mechanicIdsToDelete.push(mechanicTag.id);
        tagIdMapping[mechanicTag.id] = correspondingAbilityTag.id;
        
        console.log(`🔄 Will replace ${mechanicTag.name} (ID: ${mechanicTag.id}) with ${correspondingAbilityTag.name} (ID: ${correspondingAbilityTag.id})`);
      }
    }
    
    console.log(`⚠️ Found ${overlaps.length} overlapping tag pairs to clean up`);
    
    if (mechanicIdsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No overlapping tags found to clean up',
        summary: {
          totalTags: allTags.length,
          mechanicTags: mechanicTags.length,
          abilityKeywordTags: abilityKeywordTags.length,
          overlapsFound: 0,
          tagsDeleted: 0,
          cardsUpdated: 0
        }
      });
    }
    
    // Step 3: Check if cards table has tag_ids column
    const { data: columnsData, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'cards' });
    
    let hasTagIdsColumn = false;
    if (!columnsError && columnsData) {
      hasTagIdsColumn = columnsData.some((col: any) => col.column_name === 'tag_ids');
    }
    
    let cardsUpdated = 0;
    
    if (hasTagIdsColumn) {
      console.log('✅ Cards table has tag_ids column, updating directly...');
      
      // Step 4a: Update cards with tag_ids column
      const { data: affectedCards, error: cardsError } = await supabase
        .from('cards')
        .select('id, tag_ids')
        .overlaps('tag_ids', mechanicIdsToDelete);
      
      if (!cardsError && affectedCards) {
        console.log(`📝 Found ${affectedCards.length} cards to update`);
        
        for (const card of affectedCards) {
          // Replace mechanic IDs with ability_keyword IDs
          const updatedTagIds = card.tag_ids.map((id: number) => 
            tagIdMapping[id] || id
          );
          
          // Remove duplicates
          const uniqueTagIds = [...new Set(updatedTagIds)];
          
          const { error: updateError } = await supabase
            .from('cards')
            .update({ tag_ids: uniqueTagIds })
            .eq('id', card.id);
          
          if (!updateError) {
            cardsUpdated++;
          } else {
            console.error(`Failed to update card ${card.id}:`, updateError);
          }
        }
        
        console.log(`✅ Updated ${cardsUpdated} cards with new tag IDs`);
      }
    } else {
      console.log('⚠️ Cards table does not have tag_ids column, checking card_tags table...');
      
      // Step 4b: Update card_tags table (legacy structure)
      for (const mechanicId of mechanicIdsToDelete) {
        const abilityId = tagIdMapping[mechanicId];
        
        // Update card_tags entries
        const { error: updateError, count } = await supabase
          .from('card_tags')
          .update({ tag_id: abilityId })
          .eq('tag_id', mechanicId);
        
        if (!updateError && count) {
          cardsUpdated += count;
          console.log(`Updated ${count} card_tags entries from tag ${mechanicId} to ${abilityId}`);
        }
      }
    }
    
    // Step 5: Delete the redundant mechanic_ tags
    const { error: deleteError, count: deleteCount } = await supabase
      .from('tags')
      .delete()
      .in('id', mechanicIdsToDelete);
    
    if (deleteError) {
      console.error('Error deleting redundant tags:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete redundant tags',
        details: deleteError.message 
      }, { status: 500 });
    }
    
    console.log(`🗑️ Successfully deleted ${deleteCount} redundant mechanic_ tags`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${overlaps.length} overlapping tags`,
      summary: {
        totalTags: allTags.length,
        mechanicTags: mechanicTags.length,
        abilityKeywordTags: abilityKeywordTags.length,
        overlapsFound: overlaps.length,
        tagsDeleted: deleteCount || mechanicIdsToDelete.length,
        cardsUpdated: cardsUpdated
      },
      overlaps: overlaps.slice(0, 10), // Show first 10 for review
      hasTagIdsColumn
    });
    
  } catch (error) {
    console.error('Error during tag cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to clean up tags', details: String(error) },
      { status: 500 }
    );
  }
}

// Helper endpoint to check database structure
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get column information for cards table
    const { data: columnsData, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'cards' });
    
    // Get sample data
    const { data: sampleCard } = await supabase
      .from('cards')
      .select('*')
      .limit(1)
      .single();
    
    const { data: sampleTags } = await supabase
      .from('tags')
      .select('*')
      .limit(5);
    
    return NextResponse.json({
      cardsTableColumns: columnsData || [],
      hasTagIdsColumn: columnsData?.some((col: any) => col.column_name === 'tag_ids') || false,
      sampleCard: sampleCard ? Object.keys(sampleCard) : [],
      sampleTags: sampleTags || []
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
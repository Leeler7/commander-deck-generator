import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🧹 Starting cleanup of overlapping mechanic_ and ability_keyword_ tags...');
    
    // Step 1: Get all mechanic_ tags
    let allMechanicTags = [];
    let offset = 0;
    const limit = 1000;
    
    while (true) {
      const { data: batch } = await supabase
        .from('tags')
        .select('id, name')
        .eq('is_active', true)
        .like('name', 'mechanic_%')
        .range(offset, offset + limit - 1);
      
      if (!batch || batch.length === 0) break;
      allMechanicTags.push(...batch);
      if (batch.length < limit) break;
      offset += limit;
    }
    
    console.log(`🔧 Found ${allMechanicTags.length} mechanic_ tags`);
    
    // Step 2: Get all ability_keyword_ tags
    let allAbilityTags = [];
    offset = 0;
    
    while (true) {
      const { data: batch } = await supabase
        .from('tags')
        .select('id, name')
        .eq('is_active', true)
        .like('name', 'ability_keyword_%')
        .range(offset, offset + limit - 1);
      
      if (!batch || batch.length === 0) break;
      allAbilityTags.push(...batch);
      if (batch.length < limit) break;
      offset += limit;
    }
    
    console.log(`⚡ Found ${allAbilityTags.length} ability_keyword_ tags`);
    
    // Step 3: Find overlaps and create mapping
    const overlaps = [];
    const tagIdMapping: Record<number, number> = {};
    const mechanicIdsToDelete = [];
    
    for (const mechanicTag of allMechanicTags) {
      const baseName = mechanicTag.name.replace('mechanic_', '');
      const correspondingAbility = allAbilityTags.find(t => 
        t.name === `ability_keyword_${baseName}`
      );
      
      if (correspondingAbility) {
        overlaps.push({
          mechanicTag,
          abilityTag: correspondingAbility,
          baseName
        });
        
        tagIdMapping[mechanicTag.id] = correspondingAbility.id;
        mechanicIdsToDelete.push(mechanicTag.id);
        
        console.log(`🔄 Mapping: ${mechanicTag.name} (${mechanicTag.id}) → ${correspondingAbility.name} (${correspondingAbility.id})`);
      }
    }
    
    console.log(`⚠️ Found ${overlaps.length} overlapping tag pairs to clean up`);
    
    if (overlaps.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No overlapping tags found',
        summary: {
          mechanicTags: allMechanicTags.length,
          abilityTags: allAbilityTags.length,
          overlaps: 0
        }
      });
    }
    
    // Step 4: Update all cards to replace mechanic IDs with ability_keyword IDs
    console.log('📝 Updating cards to replace mechanic tag IDs with ability_keyword tag IDs...');
    
    let cardsUpdated = 0;
    const batchSize = 100;
    offset = 0;
    
    while (true) {
      // Get cards that have any of the mechanic tag IDs
      const { data: cards } = await supabase
        .from('cards')
        .select('id, tag_ids')
        .overlaps('tag_ids', mechanicIdsToDelete)
        .range(offset, offset + batchSize - 1);
      
      if (!cards || cards.length === 0) break;
      
      // Update each card
      for (const card of cards) {
        const originalTagIds = card.tag_ids || [];
        const updatedTagIds = originalTagIds.map(id => tagIdMapping[id] || id);
        
        // Remove duplicates and sort
        const uniqueTagIds = [...new Set(updatedTagIds)].sort((a, b) => a - b);
        
        // Only update if there were changes
        if (JSON.stringify(originalTagIds.sort()) !== JSON.stringify(uniqueTagIds)) {
          const { error } = await supabase
            .from('cards')
            .update({ tag_ids: uniqueTagIds })
            .eq('id', card.id);
          
          if (!error) {
            cardsUpdated++;
          } else {
            console.error(`Failed to update card ${card.id}:`, error);
          }
        }
      }
      
      console.log(`📊 Updated ${cardsUpdated} cards so far...`);
      
      if (cards.length < batchSize) break;
      offset += batchSize;
    }
    
    console.log(`✅ Updated ${cardsUpdated} cards total`);
    
    // Step 5: Delete the redundant mechanic_ tags
    console.log(`🗑️ Deleting ${mechanicIdsToDelete.length} redundant mechanic_ tags...`);
    
    // Delete in batches to avoid query size limits
    const deleteResults = [];
    for (let i = 0; i < mechanicIdsToDelete.length; i += 50) {
      const batch = mechanicIdsToDelete.slice(i, i + 50);
      const { error, count } = await supabase
        .from('tags')
        .delete()
        .in('id', batch);
      
      if (error) {
        console.error('Error deleting batch:', error);
        deleteResults.push({ batch: i / 50 + 1, error: error.message });
      } else {
        deleteResults.push({ batch: i / 50 + 1, deleted: count });
      }
    }
    
    const totalDeleted = deleteResults.reduce((sum, r) => sum + (r.deleted || 0), 0);
    
    console.log(`✅ Successfully deleted ${totalDeleted} redundant mechanic_ tags`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${overlaps.length} overlapping tags`,
      summary: {
        mechanicTagsFound: allMechanicTags.length,
        abilityTagsFound: allAbilityTags.length,
        overlappingPairs: overlaps.length,
        cardsUpdated,
        tagsDeleted: totalDeleted
      },
      overlaps: overlaps.slice(0, 10).map(o => ({
        mechanic: o.mechanicTag.name,
        ability: o.abilityTag.name,
        baseName: o.baseName
      })),
      deleteResults
    });
    
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json(
      { error: 'Cleanup failed', details: String(error) },
      { status: 500 }
    );
  }
}
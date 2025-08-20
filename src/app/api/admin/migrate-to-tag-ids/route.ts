import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🚀 Starting migration to tag_ids column structure...');
    
    // Step 1: Add tag_ids column to cards table
    console.log('📝 Adding tag_ids column to cards table...');
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE cards 
        ADD COLUMN IF NOT EXISTS tag_ids INTEGER[] DEFAULT '{}';
      `
    });
    
    if (alterError) {
      // Try alternative approach if exec_sql doesn't exist
      console.log('⚠️ Could not add column via RPC, column may need to be added manually');
      console.log('Please run this SQL in Supabase SQL Editor:');
      console.log('ALTER TABLE cards ADD COLUMN IF NOT EXISTS tag_ids INTEGER[] DEFAULT \'{}\';');
    } else {
      console.log('✅ tag_ids column added successfully');
    }
    
    // Step 2: Get all card_tags relationships
    console.log('📊 Fetching existing card-tag relationships...');
    const { data: cardTags, error: fetchError } = await supabase
      .from('card_tags')
      .select('card_id, tag_id')
      .not('tag_id', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching card_tags:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch card_tags',
        details: fetchError.message 
      }, { status: 500 });
    }
    
    if (!cardTags || cardTags.length === 0) {
      console.log('⚠️ No card_tags relationships found to migrate');
      return NextResponse.json({
        success: true,
        message: 'tag_ids column added but no data to migrate',
        summary: {
          cardsUpdated: 0,
          relationshipsMigrated: 0
        }
      });
    }
    
    console.log(`📦 Found ${cardTags.length} card-tag relationships to migrate`);
    
    // Step 3: Group tag IDs by card ID
    const cardTagMap: Record<string, number[]> = {};
    for (const relation of cardTags) {
      if (!cardTagMap[relation.card_id]) {
        cardTagMap[relation.card_id] = [];
      }
      cardTagMap[relation.card_id].push(relation.tag_id);
    }
    
    console.log(`🎯 Updating ${Object.keys(cardTagMap).length} cards with tag arrays...`);
    
    // Step 4: Update cards with their tag arrays
    let successCount = 0;
    let errorCount = 0;
    const batchSize = 100;
    const cardIds = Object.keys(cardTagMap);
    
    for (let i = 0; i < cardIds.length; i += batchSize) {
      const batch = cardIds.slice(i, i + batchSize);
      const updates = batch.map(cardId => ({
        id: cardId,
        tag_ids: [...new Set(cardTagMap[cardId])].sort() // Remove duplicates and sort
      }));
      
      // Update each card in the batch
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('cards')
          .update({ tag_ids: update.tag_ids })
          .eq('id', update.id);
        
        if (updateError) {
          console.error(`Failed to update card ${update.id}:`, updateError);
          errorCount++;
        } else {
          successCount++;
        }
      }
      
      console.log(`📊 Progress: ${Math.min(i + batchSize, cardIds.length)}/${cardIds.length} cards processed`);
    }
    
    console.log(`✅ Migration complete: ${successCount} cards updated, ${errorCount} errors`);
    
    // Step 5: Verify migration
    const { data: sampleCard, error: sampleError } = await supabase
      .from('cards')
      .select('id, name, tag_ids')
      .not('tag_ids', 'is', null)
      .limit(1)
      .single();
    
    return NextResponse.json({
      success: true,
      message: `Successfully migrated ${successCount} cards to use tag_ids column`,
      summary: {
        cardsUpdated: successCount,
        errors: errorCount,
        totalRelationships: cardTags.length,
        uniqueCards: Object.keys(cardTagMap).length
      },
      sampleCard: sampleCard || null,
      nextSteps: [
        'Run the cleanup-tags-v2 endpoint to remove duplicate mechanic_ tags',
        'Update application code to use tag_ids column instead of card_tags table',
        'Consider dropping the card_tags table after verification'
      ]
    });
    
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: String(error) },
      { status: 500 }
    );
  }
}

// GET endpoint to check migration status
export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Check if tag_ids column exists and has data
    // Note: We need to check for non-empty arrays properly
    const { data: cardsWithTags, error: checkError, count } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .filter('tag_ids', 'not.is', null);
    
    // Get total cards count
    const { count: totalCards } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true });
    
    // Get card_tags count for comparison
    const { count: cardTagsCount } = await supabase
      .from('card_tags')
      .select('id', { count: 'exact', head: true });
    
    return NextResponse.json({
      migrationStatus: {
        cardsWithTagIds: count || 0,
        totalCards: totalCards || 0,
        percentageMigrated: totalCards ? ((count || 0) / totalCards * 100).toFixed(2) + '%' : '0%',
        legacyCardTagsEntries: cardTagsCount || 0,
        readyForCleanup: (count || 0) > 0
      }
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
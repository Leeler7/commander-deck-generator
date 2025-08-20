import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function POST() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🧹 Starting cleanup of overlapping mechanic_ tags...');
    
    // Get all active tags
    const { data: tags, error } = await supabase
      .from('tags')
      .select('id, name, category, synergy_weight')
      .eq('is_active', true)
      .order('name');
    
    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
    }
    
    if (!tags) {
      return NextResponse.json({ error: 'No tags found' }, { status: 404 });
    }
    
    console.log(`📊 Found ${tags.length} total tags`);
    
    // Find overlaps between mechanic_ and ability_keyword_ tags
    const mechanicTags = tags.filter(tag => tag.name.startsWith('mechanic_'));
    const abilityKeywordTags = tags.filter(tag => tag.name.startsWith('ability_keyword_'));
    
    console.log(`🔧 Found ${mechanicTags.length} mechanic_ tags`);
    console.log(`⚡ Found ${abilityKeywordTags.length} ability_keyword_ tags`);
    
    const tagsToDelete = [];
    const overlaps = [];
    
    for (const mechanicTag of mechanicTags) {
      // Extract the base name (remove 'mechanic_' prefix)
      const baseName = mechanicTag.name.replace('mechanic_', '');
      
      // Look for corresponding ability_keyword_ tag
      const correspondingAbilityTag = abilityKeywordTags.find(tag => 
        tag.name === `ability_keyword_${baseName}`
      );
      
      if (correspondingAbilityTag) {
        overlaps.push({
          baseName,
          mechanicTag: mechanicTag.name,
          abilityKeywordTag: correspondingAbilityTag.name,
          mechanicSynergyWeight: mechanicTag.synergy_weight || 1.0,
          abilitySynergyWeight: correspondingAbilityTag.synergy_weight || 1.0
        });
        
        tagsToDelete.push(mechanicTag.id);
        console.log(`🗑️ Marking for deletion: ${mechanicTag.name} (will keep ${correspondingAbilityTag.name})`);
      }
    }
    
    console.log(`⚠️ Found ${overlaps.length} overlapping tag pairs`);
    console.log(`🗑️ Will delete ${tagsToDelete.length} mechanic_ tags`);
    
    if (tagsToDelete.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No overlapping tags found to clean up',
        overlaps: [],
        deletedCount: 0
      });
    }
    
    // Delete the overlapping mechanic_ tags
    const { error: deleteError } = await supabase
      .from('tags')
      .delete()
      .in('id', tagsToDelete);
    
    if (deleteError) {
      console.error('Error deleting tags:', deleteError);
      return NextResponse.json({ error: 'Failed to delete overlapping tags' }, { status: 500 });
    }
    
    console.log(`✅ Successfully deleted ${tagsToDelete.length} overlapping mechanic_ tags`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up ${tagsToDelete.length} overlapping mechanic_ tags`,
      overlaps,
      deletedCount: tagsToDelete.length,
      summary: `Removed ${tagsToDelete.length} mechanic_ tags that had ability_keyword_ equivalents`
    });
    
  } catch (error) {
    console.error('Error cleaning up mechanic tags:', error);
    return NextResponse.json(
      { error: 'Failed to clean up mechanic tags' },
      { status: 500 }
    );
  }
}
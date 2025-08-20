import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    console.log('🔍 Analyzing tag overlaps in Supabase database...');
    
    // Get all normalized tags
    const { data: tags, error } = await supabase
      .from('normalized_tags')
      .select('id, name, category, usage_count')
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
          mechanicTag: {
            id: mechanicTag.id,
            name: mechanicTag.name,
            category: mechanicTag.category,
            usageCount: mechanicTag.usage_count || 0
          },
          abilityKeywordTag: {
            id: correspondingAbilityTag.id,
            name: correspondingAbilityTag.name,
            category: correspondingAbilityTag.category,
            usageCount: correspondingAbilityTag.usage_count || 0
          }
        });
      }
    }
    
    console.log(`⚠️ Found ${overlaps.length} overlapping tag pairs`);
    
    // Sort by total usage (mechanic + ability_keyword combined)
    overlaps.sort((a, b) => {
      const totalUsageA = a.mechanicTag.usageCount + a.abilityKeywordTag.usageCount;
      const totalUsageB = b.mechanicTag.usageCount + b.abilityKeywordTag.usageCount;
      return totalUsageB - totalUsageA;
    });
    
    // Also find mechanic_ tags that don't have ability_keyword_ counterparts
    const mechanicOnlyTags = mechanicTags.filter(mechanicTag => {
      const baseName = mechanicTag.name.replace('mechanic_', '');
      return !abilityKeywordTags.some(tag => tag.name === `ability_keyword_${baseName}`);
    }).map(tag => ({
      id: tag.id,
      name: tag.name,
      baseName: tag.name.replace('mechanic_', ''),
      category: tag.category,
      usageCount: tag.usage_count || 0
    }));
    
    return NextResponse.json({
      success: true,
      summary: {
        totalTags: tags.length,
        mechanicTags: mechanicTags.length,
        abilityKeywordTags: abilityKeywordTags.length,
        overlappingPairs: overlaps.length,
        mechanicOnlyTags: mechanicOnlyTags.length
      },
      overlaps,
      mechanicOnlyTags: mechanicOnlyTags.slice(0, 20) // Limit to first 20 for display
    });
    
  } catch (error) {
    console.error('Error analyzing tag overlap:', error);
    return NextResponse.json(
      { error: 'Failed to analyze tag overlap' },
      { status: 500 }
    );
  }
}
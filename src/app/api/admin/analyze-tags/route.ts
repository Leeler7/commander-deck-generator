import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get total count of tags
    const { count: totalTags } = await supabase
      .from('tags')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    
    // Get mechanic_ tags with pagination
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
    
    // Get ability_keyword_ tags with pagination
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
    
    // Find overlaps
    const overlaps = [];
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
      }
    }
    
    return NextResponse.json({
      totalTags,
      mechanicTagsCount: allMechanicTags.length,
      abilityTagsCount: allAbilityTags.length,
      overlapsCount: overlaps.length,
      mechanicTagsSample: allMechanicTags.slice(0, 10),
      abilityTagsSample: allAbilityTags.slice(0, 10),
      overlapsSample: overlaps.slice(0, 10)
    });
    
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Get a sample card to see its structure
    const { data: sampleCard, error: cardError } = await supabase
      .from('cards')
      .select('id, name, tag_ids')
      .limit(1)
      .single();
    
    // Get some cards with tag_ids
    const { data: cardsWithTags, error: taggedError } = await supabase
      .from('cards')
      .select('id, name, tag_ids')
      .not('tag_ids', 'is', null)
      .limit(5);
    
    // Get count of cards with non-null tag_ids
    const { count: withTagIds } = await supabase
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .not('tag_ids', 'is', null);
    
    // Get count of cards where tag_ids has at least one element
    let cardsWithNonEmptyTags = 0;
    if (cardsWithTags) {
      const { data: nonEmpty } = await supabase
        .from('cards')
        .select('id, tag_ids')
        .not('tag_ids', 'is', null)
        .limit(100);
      
      if (nonEmpty) {
        cardsWithNonEmptyTags = nonEmpty.filter(c => 
          c.tag_ids && Array.isArray(c.tag_ids) && c.tag_ids.length > 0
        ).length;
      }
    }
    
    // Check mechanic_ vs ability_keyword_ tags
    const { data: mechanicTags } = await supabase
      .from('tags')
      .select('id, name')
      .like('name', 'mechanic_%')
      .limit(10);
    
    const { data: abilityTags } = await supabase
      .from('tags')
      .select('id, name')
      .like('name', 'ability_keyword_%')
      .limit(10);
    
    return NextResponse.json({
      sampleCard,
      cardsWithTags: cardsWithTags || [],
      counts: {
        cardsWithTagIds: withTagIds,
        cardsWithNonEmptyTags,
        mechanicTagsFound: mechanicTags?.length || 0,
        abilityKeywordTagsFound: abilityTags?.length || 0
      },
      mechanicTagsSample: mechanicTags || [],
      abilityTagsSample: abilityTags || []
    });
    
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
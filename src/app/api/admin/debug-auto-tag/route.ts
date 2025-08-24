import { NextResponse } from 'next/server';
import { database } from '@/lib/supabase-updated';

export async function GET() {
  try {
    console.log('🔍 Debugging auto-tag query...');
    
    // Test the exact query used in auto-tag
    const { data: untaggedCards, error: untaggedError } = await database.supabase
      .from('cards')
      .select('id, name, type_line, oracle_text, mana_cost, cmc, colors, color_identity, keywords, power, toughness, loyalty, tag_ids')
      .is('tag_ids', null)
      .limit(10);
    
    console.log(`Found ${untaggedCards?.length || 0} cards with null tag_ids`);
    
    // Also check for cards with empty arrays
    const { data: emptyArrayCards, error: emptyError } = await database.supabase
      .from('cards')
      .select('id, name, tag_ids')
      .eq('tag_ids', '[]')
      .limit(10);
    
    console.log(`Found ${emptyArrayCards?.length || 0} cards with empty tag_ids arrays`);
    
    // Check total card count
    const { count: totalCards, error: countError } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    // Check cards with any tag_ids (not null)
    const { count: taggedCards, error: taggedError } = await database.supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .not('tag_ids', 'is', null);
    
    // Sample some cards to see their tag_ids structure
    const { data: sampleCards, error: sampleError } = await database.supabase
      .from('cards')
      .select('id, name, tag_ids')
      .limit(10);
    
    return NextResponse.json({
      queries: {
        untaggedCards: {
          count: untaggedCards?.length || 0,
          error: untaggedError?.message || null,
          sample: untaggedCards?.slice(0, 3) || []
        },
        emptyArrayCards: {
          count: emptyArrayCards?.length || 0,
          error: emptyError?.message || null,
          sample: emptyArrayCards || []
        },
        totals: {
          totalCards: totalCards || 0,
          taggedCards: taggedCards || 0,
          untaggedEstimate: (totalCards || 0) - (taggedCards || 0)
        }
      },
      sampleCards: sampleCards?.map(card => ({
        id: card.id,
        name: card.name,
        tag_ids: card.tag_ids,
        tag_ids_type: typeof card.tag_ids,
        is_null: card.tag_ids === null,
        is_empty_array: Array.isArray(card.tag_ids) && card.tag_ids.length === 0
      })) || [],
      errors: {
        countError: countError?.message || null,
        taggedError: taggedError?.message || null,
        sampleError: sampleError?.message || null
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error debugging auto-tag:', error);
    return NextResponse.json(
      { error: 'Debug failed: ' + (error as Error).message },
      { status: 500 }
    );
  }
}
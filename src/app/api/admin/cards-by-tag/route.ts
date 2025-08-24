import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-updated';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tagName = searchParams.get('tag');
    
    if (!tagName) {
      return NextResponse.json(
        { error: 'Tag name is required' },
        { status: 400 }
      );
    }

    // First get the tag ID from the tags table
    const { data: tagData, error: tagError } = await supabase
      .from('tags')
      .select('id')
      .eq('name', tagName)
      .single();
    
    let cards = [];
    
    if (tagData && !tagError) {
      // New structure - use tag_id
      const { data: cardTags, error: cardTagsError } = await supabase
        .from('card_tags')
        .select('card_id')
        .eq('tag_id', tagData.id)
        .limit(100);
      
      if (cardTags && cardTags.length > 0) {
        const cardIds = cardTags.map(ct => ct.card_id);
        
        // Get card details
        const { data: cardsData, error: cardsError } = await supabase
          .from('cards')
          .select('id, name, type_line, mana_cost')
          .in('id', cardIds)
          .order('name');
        
        if (!cardsError) {
          cards = cardsData || [];
        }
      }
    }
    
    // If no cards found with new structure, try legacy structure
    if (cards.length === 0) {
      const { data: legacyCardTags, error: legacyError } = await supabase
        .from('card_tags')
        .select('card_id')
        .eq('tag_name', tagName)
        .limit(100);
      
      if (legacyCardTags && legacyCardTags.length > 0) {
        const cardIds = legacyCardTags.map(ct => ct.card_id);
        
        // Get card details
        const { data: cardsData, error: cardsError } = await supabase
          .from('cards')
          .select('id, name, type_line, mana_cost')
          .in('id', cardIds)
          .order('name');
        
        if (!cardsError) {
          cards = cardsData || [];
        }
      }
    }
    
    return NextResponse.json({ 
      cards,
      count: cards.length,
      tag: tagName
    });
    
  } catch (error) {
    console.error('Error getting cards by tag:', error);
    return NextResponse.json(
      { error: 'Failed to get cards for tag' },
      { status: 500 }
    );
  }
}
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Return popular/common tags that users might want to search for
    const popularTags = [
      { name: 'flying', category: 'keyword_abilities', description: 'Creatures with flying' },
      { name: 'trample', category: 'keyword_abilities', description: 'Creatures with trample' },
      { name: 'tokens', category: 'mechanics', description: 'Token generation and synergies' },
      { name: 'counters', category: 'mechanics', description: 'Counter-based strategies' },
      { name: 'tribal', category: 'mechanics', description: 'Creature type tribal synergies' },
      { name: 'artifacts', category: 'mechanics', description: 'Artifact-focused strategies' },
      { name: 'enchantments', category: 'mechanics', description: 'Enchantment-based themes' },
      { name: 'graveyard', category: 'mechanics', description: 'Graveyard interaction' },
      { name: 'sacrifice', category: 'mechanics', description: 'Sacrifice-based strategies' },
      { name: 'etb_effects', category: 'mechanics', description: 'Enter the battlefield effects' },
      { name: 'card_draw', category: 'mechanics', description: 'Card advantage engines' },
      { name: 'ramp', category: 'mechanics', description: 'Mana acceleration' },
    ];

    return NextResponse.json({
      tags: popularTags,
      message: 'Popular tags for quick selection'
    });

  } catch (error) {
    console.error('Popular tags error:', error);
    return NextResponse.json(
      { error: 'Failed to get popular tags' },
      { status: 500 }
    );
  }
}
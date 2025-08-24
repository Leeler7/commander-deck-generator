import { NextRequest, NextResponse } from 'next/server';
import { NewDeckGenerator } from '@/lib/new-generation-pipeline';
import { GenerationConstraints } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const { commander, constraints } = body;
    
    if (!commander || typeof commander !== 'string') {
      return NextResponse.json(
        { error: 'Commander name is required and must be a string' },
        { status: 400 }
      );
    }

    if (!constraints) {
      return NextResponse.json(
        { error: 'Generation constraints are required' },
        { status: 400 }
      );
    }

    // Validate constraints
    const validatedConstraints: GenerationConstraints = {
      total_budget: Math.max(10, constraints.total_budget || 100),
      max_card_price: Math.max(1, constraints.max_card_price || constraints.per_card_cap || 50),
      prefer_cheapest: Boolean(constraints.prefer_cheapest),
      keywords: constraints.keywords || [],
      keyword_focus: constraints.keyword_focus || [],
      card_type_weights: constraints.card_type_weights || {
        creatures: 5,
        artifacts: 5,
        enchantments: 5,
        instants: 5,
        sorceries: 5,
        planeswalkers: 5
      },
      random_tag_count: Math.max(0, Math.min(10, constraints.random_tag_count || 0)) // Clamp to 0-10
    };

    // Debug: Check if card type weights are being passed (uncomment for debugging)
    // console.log('Card type weights received:', validatedConstraints.card_type_weights);

    // Generate deck using NEW PIPELINE
    const generator = new NewDeckGenerator();
    const deck = await generator.generateDeck(commander.trim(), validatedConstraints);
    
    return NextResponse.json({
      success: true,
      deck,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Deck generation error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('Invalid commander') || 
          error.message.includes('not legal') ||
          error.message.includes('Could not find card')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        );
      }
      
      if (error.message.includes('Rate limit') || 
          error.message.includes('429')) {
        return NextResponse.json(
          { error: 'External API rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        );
      }
      
      // Include actual error message in development
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
          { error: `Generation failed: ${error.message}`, stack: error.stack },
          { status: 500 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'An error occurred while generating the deck. Please try again.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Method not allowed. Use POST to generate a deck.',
      usage: {
        method: 'POST',
        body: {
          commander: 'string - Name of the commander',
          constraints: {
            total_budget: 'number - Total budget in USD',
            max_card_price: 'number - Maximum price per card',
            prefer_cheapest: 'boolean - Use cheapest printing',
            card_type_weights: 'object - Ratios for different card types'
          }
        }
      }
    },
    { status: 405 }
  );
}
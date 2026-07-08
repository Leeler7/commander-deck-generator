import { NextRequest, NextResponse } from 'next/server';
import { GenerationConstraints } from '@/lib/types';
import { generateDeck } from '@/lib/engine/deckGenerator';
import { getCardByName } from '@/lib/engine/scryfall-client';
import { fetchCommanderThemes } from '@/lib/engine/edhrec-client';
import { bdeToCustomization, buildGenerationContext, engineDeckToBde } from '@/lib/engine/adapter';
import { areValidPartners } from '@/lib/engine/partnerUtils';
import type { ThemeResult } from '@/lib/engine/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { commander, partnerCommander: partnerName, constraints } = body;

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
      random_tag_count: Math.max(0, Math.min(10, constraints.random_tag_count || 0)),
      ...(constraints.targetBracket ? { targetBracket: Math.min(5, Math.max(1, constraints.targetBracket)) } : {}),
      ...(constraints.no_infinite_combos ? { no_infinite_combos: true } : {}),
      ...(constraints.no_land_destruction ? { no_land_destruction: true } : {}),
      ...(constraints.no_extra_turns ? { no_extra_turns: true } : {}),
      ...(constraints.no_stax ? { no_stax: true } : {}),
      ...(constraints.no_fast_mana ? { no_fast_mana: true } : {}),
      ...(constraints.landCount ? { landCount: constraints.landCount } : {}),
      ...(constraints.nonBasicLandCount !== undefined ? { nonBasicLandCount: constraints.nonBasicLandCount } : {}),
      ...(constraints.pacing ? { pacing: constraints.pacing } : {}),
      ...(constraints.gameChangerLimit !== undefined ? { gameChangerLimit: constraints.gameChangerLimit } : {}),
      ...(constraints.hyperFocus !== undefined ? { hyperFocus: constraints.hyperFocus } : {}),
      ...(constraints.mustIncludeCards ? { mustIncludeCards: constraints.mustIncludeCards } : {}),
      ...(constraints.excludedCards ? { excludedCards: constraints.excludedCards } : {}),
      ...(constraints.maxRarity !== undefined ? { maxRarity: constraints.maxRarity } : {}),
      ...(constraints.comboCount !== undefined ? { comboCount: constraints.comboCount } : {}),
    };

    // Step 1: Fetch commander card from Scryfall
    console.log(`[Generate] Fetching commander: ${commander.trim()}`);
    const commanderCard = await getCardByName(commander.trim());

    if (!commanderCard) {
      return NextResponse.json(
        { error: `Could not find card: ${commander}` },
        { status: 400 }
      );
    }

    // Step 1b: Fetch and validate partner commander if provided
    let partnerCard = null;
    if (partnerName && typeof partnerName === 'string') {
      console.log(`[Generate] Fetching partner commander: ${partnerName.trim()}`);
      partnerCard = await getCardByName(partnerName.trim());
      if (!partnerCard) {
        return NextResponse.json(
          { error: `Could not find partner card: ${partnerName}` },
          { status: 400 }
        );
      }
      if (!areValidPartners(commanderCard, partnerCard)) {
        return NextResponse.json(
          { error: `${commanderCard.name} and ${partnerCard.name} are not a valid partner pair` },
          { status: 400 }
        );
      }
    }

    // Step 2: Convert BDE constraints to 20q2 Customization
    const customization = bdeToCustomization(validatedConstraints);

    // Step 3: Fetch themes from EDHREC and map keywords to theme selections
    let selectedThemes: ThemeResult[] | undefined;
    try {
      const edhrecThemes = await fetchCommanderThemes(commanderCard.name);
      if (edhrecThemes.length > 0) {
        const keywords = validatedConstraints.keywords || validatedConstraints.keyword_focus || [];
        selectedThemes = edhrecThemes
          .filter(t => {
            // Auto-select themes that match user keywords, or use top themes
            if (keywords.length > 0) {
              return keywords.some(k =>
                t.name.toLowerCase().includes(k.toLowerCase()) ||
                k.toLowerCase().includes(t.name.toLowerCase())
              );
            }
            return false;
          })
          .map(t => ({
            name: t.name,
            source: 'edhrec' as const,
            slug: t.slug,
            deckCount: t.count,
            isSelected: true,
          }));

        // If no keyword match, select the most popular theme
        if (selectedThemes.length === 0 && edhrecThemes.length > 0) {
          const topTheme = edhrecThemes[0];
          selectedThemes = [{
            name: topTheme.name,
            source: 'edhrec' as const,
            slug: topTheme.slug,
            deckCount: topTheme.count,
            isSelected: true,
          }];
        }
      }
    } catch (err) {
      console.log(`[Generate] EDHREC themes fetch failed (non-fatal):`, err);
    }

    // Step 4: Build context and generate
    console.log(`[Generate] Starting deck generation for ${commanderCard.name}${partnerCard ? ` + ${partnerCard.name}` : ''}`);
    const context = buildGenerationContext(commanderCard, customization, selectedThemes, partnerCard);
    const engineDeck = await generateDeck(context);

    // Step 5: Convert engine output to BDE format
    const bdeDeck = engineDeckToBde(engineDeck, commanderCard, partnerCard);

    console.log(`[Generate] Deck generated: ${bdeDeck.nonland_cards.length} nonland cards, ${bdeDeck.lands.length} lands, $${bdeDeck.total_price}`);

    return NextResponse.json({
      success: true,
      deck: bdeDeck,
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Deck generation error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

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

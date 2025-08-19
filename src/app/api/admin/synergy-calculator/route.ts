import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';
import { CardMechanicsTagger } from '@/lib/card-mechanics-tagger';
import { TagBasedSynergyScorer } from '@/lib/tag-based-synergy';
import { calculateEnhancedKeywordSynergy } from '@/lib/mtgjson-keywords';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commanderName, cardNames } = body;
    
    console.log('🎯 SYNERGY API: Received request:', { commanderName, cardNames });

    if (!commanderName) {
      return NextResponse.json(
        { error: 'Commander name is required' },
        { status: 400 }
      );
    }

    if (!cardNames || !Array.isArray(cardNames) || cardNames.length === 0) {
      return NextResponse.json(
        { error: 'At least one card name is required for comparison' },
        { status: 400 }
      );
    }

    // Initialize the database
    // Find the commander
    const commanderCards = await database.searchByName(commanderName, 1);
    if (commanderCards.length === 0) {
      return NextResponse.json(
        { error: 'Commander not found' },
        { status: 404 }
      );
    }
    const commander = commanderCards[0];
    
    // Analyze commander
    const tagger = new CardMechanicsTagger();
    const commanderMechanics = await tagger.analyzeCardEnhanced(commander);
    const tagSynergyScorer = new TagBasedSynergyScorer();
    const commanderProfile = tagSynergyScorer.analyzeCommander(commander, commanderMechanics);
    
    console.log(`🎯 SYNERGY CALC: Analyzing commander ${commander.name}`);
    console.log(`   Tags: ${commanderProfile.tags.join(', ')}`);
    console.log(`   Strategies: ${commanderProfile.strategies.join(', ')}`);

    // Analyze each card and calculate synergy
    const results = [];
    
    for (const cardName of cardNames) {
      const cards = await database.searchByName(cardName, 1);
      if (cards.length === 0) {
        results.push({
          cardName,
          error: 'Card not found',
          synergy: null
        });
        continue;
      }
      
      const card = cards[0];
      
      // Get card mechanics
      const cardMechanics = await tagger.analyzeCardEnhanced(card);
      
      // Calculate tag-based synergy
      const tagBasedSynergy = tagSynergyScorer.calculateTagSynergy(commanderProfile, cardMechanics);
      
      // Calculate keyword synergy  
      const keywordSynergy = await calculateEnhancedKeywordSynergy(
        commander.oracle_text || '', 
        card.oracle_text || ''
      );
      
      // Calculate basic synergy (legacy system)
      const basicSynergy = calculateBasicSynergy(card, commander);
      
      // Combined score
      const primarySynergy = tagBasedSynergy > 0 ? tagBasedSynergy : basicSynergy;
      const totalScore = primarySynergy + keywordSynergy.score;
      
      // Get detailed breakdown
      const synergyBreakdown = tagSynergyScorer.getDetailedSynergyBreakdown(commanderProfile, cardMechanics);
      
      results.push({
        cardName: card.name,
        cardId: card.id,
        totalScore,
        breakdown: {
          tagBasedSynergy,
          basicSynergy,
          keywordSynergy: keywordSynergy.score,
          keywordDetails: keywordSynergy,
          primarySource: tagBasedSynergy > 0 ? 'tag-based' : 'basic'
        },
        synergyDetails: synergyBreakdown,
        cardMechanics: {
          primaryType: cardMechanics.primaryType,
          powerLevel: cardMechanics.powerLevel,
          topTags: cardMechanics.mechanicTags
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 5)
            .map(tag => `${tag.name}(P${tag.priority})`)
        }
      });
    }
    
    // Sort results by total score descending
    results.sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

    return NextResponse.json({
      commander: {
        name: commander.name,
        id: commander.id,
        profile: commanderProfile,
        mechanics: {
          primaryType: commanderMechanics.primaryType,
          powerLevel: commanderMechanics.powerLevel,
          topTags: commanderMechanics.mechanicTags
            .sort((a, b) => b.priority - a.priority)
            .slice(0, 8)
            .map(tag => `${tag.name}(P${tag.priority})`)
        }
      },
      results,
      totalCards: results.length,
      validCards: results.filter(r => !r.error).length
    });
    
  } catch (error) {
    console.error('Error calculating synergy:', error);
    
    return NextResponse.json(
      { error: 'Failed to calculate synergy', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Basic synergy calculation (legacy system)
function calculateBasicSynergy(card: any, commander: any): number {
  const cardText = (card.oracle_text || '').toLowerCase();
  const commanderText = (commander.oracle_text || '').toLowerCase();
  let synergy = 0;
  
  // Color identity bonus
  if (card.color_identity && commander.color_identity) {
    const cardColors = new Set(card.color_identity);
    const commanderColors = new Set(commander.color_identity);
    const overlap = [...cardColors].filter(color => commanderColors.has(color));
    synergy += overlap.length * 2;
  }
  
  // Type synergy
  if (cardText.includes('creature') && commanderText.includes('creature')) synergy += 3;
  if (cardText.includes('artifact') && commanderText.includes('artifact')) synergy += 3;
  if (cardText.includes('enchantment') && commanderText.includes('enchantment')) synergy += 3;
  
  // Basic keyword synergy
  const keywords = ['flying', 'trample', 'lifelink', 'deathtouch', 'haste'];
  for (const keyword of keywords) {
    if (cardText.includes(keyword) && commanderText.includes(keyword)) {
      synergy += 2;
    }
  }
  
  return Math.max(0, synergy);
}
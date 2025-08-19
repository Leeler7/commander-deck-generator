import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database-factory';
import { CardMechanicsTagger } from '@/lib/card-mechanics-tagger';
import { tagSynergyScorer, CommanderProfile } from '@/lib/tag-based-synergy';

const tagger = new CardMechanicsTagger();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cardName = searchParams.get('card');
    const commanderName = searchParams.get('commander');
    
    if (!cardName) {
      return NextResponse.json(
        { error: 'Card name parameter "card" is required' },
        { status: 400 }
      );
    }
    
    // Get card from database
    const card = await database.getCardByName(cardName);
    
    if (!card) {
      return NextResponse.json(
        { error: `Card "${cardName}" not found in database` },
        { status: 404 }
      );
    }
    
    // Analyze card mechanics
    const mechanics = await tagger.analyzeCardEnhanced(card);
    
    // If commander is specified, calculate synergy
    let synergyInfo = null;
    if (commanderName) {
      const commander = await database.getCardByName(commanderName);
      
      if (commander) {
        const commanderMechanics = await tagger.analyzeCardEnhanced(commander);
        const commanderProfile = tagSynergyScorer.analyzeCommander(commander, commanderMechanics);
        const synergyScore = tagSynergyScorer.calculateTagSynergy(commanderProfile, mechanics);
        const applicableRules = tagSynergyScorer.getApplicableRules(commanderProfile);
        
        synergyInfo = {
          commander: commanderName,
          commanderTags: commanderProfile.tags,
          commanderStrategies: commanderProfile.strategies,
          synergyScore,
          applicableRules: applicableRules.map(r => ({
            cardTag: r.cardTag,
            score: r.score,
            description: r.description
          }))
        };
      }
    }
    
    // Format response
    const response = {
      card: {
        name: card.name,
        type_line: card.type_line,
        mana_cost: card.mana_cost,
        cmc: card.cmc,
        oracle_text: card.oracle_text,
        power: card.power,
        toughness: card.toughness,
        loyalty: card.loyalty,
        rarity: card.rarity,
        set_name: card.set_name,
        edhrec_rank: card.edhrec_rank
      },
      mechanics: {
        primaryType: mechanics.primaryType,
        functionalRoles: mechanics.functionalRoles || [],
        powerLevel: mechanics.powerLevel,
        archetypeRelevance: mechanics.archetypeRelevance || [],
        synergyKeywords: mechanics.synergyKeywords || [],
        mechanicTags: (mechanics.mechanicTags || []).map(tag => ({
          name: tag.name,
          category: tag.category,
          priority: tag.priority,
          confidence: tag.confidence,
          evidence: tag.evidence || []
        }))
      },
      synergy: synergyInfo
    };
    
    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
  } catch (error) {
    console.error('Error analyzing card:', error);
    
    return NextResponse.json(
      { error: 'Failed to analyze card', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper endpoint to list all tags for a given commander
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commander: commanderName, cards: cardNames } = body;
    
    if (!commanderName || !cardNames || !Array.isArray(cardNames)) {
      return NextResponse.json(
        { error: 'Commander name and cards array are required' },
        { status: 400 }
      );
    }
    
    const commander = await database.getCardByName(commanderName);
    if (!commander) {
      return NextResponse.json(
        { error: `Commander "${commanderName}" not found` },
        { status: 404 }
      );
    }
    
    const commanderMechanics = await tagger.analyzeCardEnhanced(commander);
    const commanderProfile = tagSynergyScorer.analyzeCommander(commander, commanderMechanics);
    
    // Analyze all cards
    const results = [];
    for (const cardName of cardNames) {
      const card = await database.getCardByName(cardName);
      if (!card) continue;
      
      const mechanics = await tagger.analyzeCardEnhanced(card);
      const synergyScore = tagSynergyScorer.calculateTagSynergy(commanderProfile, mechanics);
      
      results.push({
        name: card.name,
        powerLevel: mechanics.powerLevel,
        synergyScore,
        mainTags: mechanics.mechanicTags
          .filter(t => t.priority >= 7)
          .map(t => `${t.name} (P${t.priority})`),
        roles: mechanics.functionalRoles
      });
    }
    
    // Sort by synergy score
    results.sort((a, b) => b.synergyScore - a.synergyScore);
    
    return NextResponse.json({
      commander: commanderName,
      commanderProfile,
      cardAnalysis: results
    });
    
  } catch (error) {
    console.error('Error analyzing cards:', error);
    
    return NextResponse.json(
      { error: 'Failed to analyze cards', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
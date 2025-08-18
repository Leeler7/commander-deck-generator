import { NextRequest, NextResponse } from 'next/server';
import { CardMechanicsTagger } from '@/lib/card-mechanics-tagger';
import { serverCardDatabase } from '@/lib/server-card-database';

export async function GET(request: NextRequest) {
  try {
    // Get all available tags by analyzing the tag generation system
    const tagger = new CardMechanicsTagger();
    await serverCardDatabase.initialize();
    
    // Get a representative sample of cards to extract all possible tags
    const sampleCards = serverCardDatabase.searchByFilters({}, 200); // Get up to 200 cards
    const allTagsSet = new Set<string>();
    
    console.log(`🏷️ Analyzing ${sampleCards.length} sample cards to extract available tags...`);
    
    // Analyze a sample of cards to discover all possible tags
    for (let i = 0; i < Math.min(50, sampleCards.length); i++) {
      const card = sampleCards[i];
      try {
        const mechanics = await tagger.analyzeCardEnhanced(card);
        mechanics.mechanicTags.forEach(tag => allTagsSet.add(tag.name));
      } catch (error) {
        // Skip cards that can't be analyzed
        continue;
      }
    }
    
    // ALL official MTG creature types for comprehensive tribal support
    const allCreatureTypes = [
      // Major tribes with extensive support
      'human', 'elf', 'goblin', 'zombie', 'vampire', 'dragon', 'angel', 'demon', 'wizard', 'warrior', 'knight', 'soldier', 'spirit', 'elemental', 'beast', 'merfolk',
      
      // Popular tribes with good support  
      'cat', 'dog', 'wolf', 'bird', 'snake', 'spider', 'insect', 'squirrel', 'rat', 'bat', 'bear', 'boar', 'elk', 'ox', 'horse', 'goat', 'sheep', 'dinosaur', 'pirate', 'ninja',
      
      // Fantasy humanoids
      'dwarf', 'giant', 'troll', 'orc', 'ogre', 'minotaur', 'centaur', 'satyr', 'faerie', 'kithkin', 'kender', 'halfling', 'gnome', 'kor', 'vedalken', 'leonin', 'rhox', 'loxodon',
      
      // Classes and professions
      'cleric', 'rogue', 'berserker', 'barbarian', 'archer', 'scout', 'shaman', 'druid', 'monk', 'artificer', 'advisor', 'assassin', 'mercenary', 'rebel', 'ally',
      
      // Magical creatures
      'sphinx', 'hydra', 'phoenix', 'unicorn', 'pegasus', 'hippogriff', 'griffin', 'manticore', 'basilisk', 'cockatrice', 'chimera', 'gorgon', 'harpy', 'naga', 'lamia',
      
      // Undead and horror
      'skeleton', 'wraith', 'specter', 'shade', 'horror', 'nightmare', 'demon', 'devil', 'imp', 'gargoyle', 'lich', 'mummy',
      
      // Artificial beings
      'golem', 'construct', 'homunculus', 'scarecrow', 'thopter', 'servo', 'drone', 'myr', 'robot', 'cyborg',
      
      // Plants and fungi
      'treefolk', 'dryad', 'ent', 'plant', 'fungus', 'saproling', 'spore',
      
      // Aquatic creatures
      'fish', 'whale', 'octopus', 'crab', 'turtle', 'shark', 'jellyfish', 'leviathan', 'kraken', 'serpent',
      
      // Unique tribes
      'sliver', 'changeling', 'shapeshifter', 'avatar', 'incarnation', 'atog', 'brushwagg', 'camel', 'ferret', 'frog', 'monkey', 'ape', 'lizard', 'crocodile', 'rhino', 'hippo'
    ];

    // Add common tags that might not appear in the sample
    const commonTags = [
      // Type tags
      'type_creature', 'type_artifact', 'type_enchantment', 'type_instant', 'type_sorcery', 
      'type_planeswalker', 'type_land', 'type_tribal',
      
      // Supertype tags
      'supertype_legendary', 'supertype_basic', 'supertype_snow',
      
      // ALL creature type tags for tribal support
      ...allCreatureTypes.map(type => `creature_type_${type}`),
      ...allCreatureTypes.map(type => `${type}_tribal`),
      ...allCreatureTypes.map(type => `${type}_token_creation`),
      ...allCreatureTypes.map(type => `${type}_token_matters`),
      ...allCreatureTypes.map(type => `${type}_matters`),
      
      // Affinity and type-matters mechanics for ALL card types
      'affinity_artifacts', 'affinity_enchantments', 'affinity_creatures', 'affinity_lands', 'affinity_instants', 'affinity_sorceries', 'affinity_planeswalkers',
      'artifact_matters', 'enchantment_matters', 'creature_matters', 'land_matters', 'instant_matters', 'sorcery_matters', 'planeswalker_matters',
      'artifacts_cost_reduction', 'enchantments_cost_reduction', 'creatures_cost_reduction', 'lands_cost_reduction', 'instants_cost_reduction', 'sorceries_cost_reduction',
      
      // Specific artifact subtypes that matter
      'equipment_matters', 'vehicle_matters', 'treasure_matters', 'clue_matters', 'food_matters', 'blood_matters', 'powerstone_matters',
      
      // Spell type synergies
      'instant_sorcery_matters', 'noncreature_spell_matters', 'historic_matters', 'legendary_matters',
      
      // Mana value / CMC matters
      'cmc_matters', 'cmc_0_matters', 'cmc_1_matters', 'cmc_2_matters', 'cmc_3_matters', 'cmc_4_matters', 'cmc_5_matters', 'cmc_6_plus_matters',
      'even_cmc_matters', 'odd_cmc_matters',
      
      // Color matters
      'white_matters', 'blue_matters', 'black_matters', 'red_matters', 'green_matters', 'colorless_matters', 'multicolor_matters', 'monocolored_matters',
      
      // Power/toughness matters  
      'power_matters', 'toughness_matters', 'high_power_matters', 'low_power_matters', 'power_4_or_greater', 'defender_matters',
      
      // Resource generation core
      'mana_generation', 'card_draw', 'multi_card_draw', 'card_selection', 'tutoring', 
      'life_gain', 'energy_generation', 'token_creation', 'treasure_token_creation',
      'clue_token_creation', 'food_token_creation',
      
      // Combat abilities
      'flying', 'trample', 'haste', 'vigilance', 'deathtouch', 'lifelink', 'menace',
      'first_strike', 'double_strike', 'hexproof', 'indestructible', 'reach',
      
      // Common mechanics
      'etb_trigger', 'sacrifice_outlet', 'counterspell', 'board_wipe', 'spot_removal',
      'landfall', 'prowess', 'flash', 'equipment', 'artifact_matters', 'enchantment_matters'
    ];
    
    commonTags.forEach(tag => allTagsSet.add(tag));
    
    const availableTags = Array.from(allTagsSet).sort();
    console.log(`🏷️ Found ${availableTags.length} unique tags from analysis`);

    const tagsByCategory = {
      'card_types': availableTags.filter(tag => tag.startsWith('type_')),
      'supertypes': availableTags.filter(tag => tag.startsWith('supertype_')),
      'tribal': availableTags.filter(tag => 
        tag.includes('_tribal') || tag.includes('creature_type_') || tag.endsWith('_token_matters')
      ),
      'tokens': availableTags.filter(tag => 
        tag.includes('token') && !tag.endsWith('_token_matters')
      ),
      'resource_generation': availableTags.filter(tag => 
        tag.includes('mana_') || tag.includes('card_draw') || tag.includes('tutoring') || 
        tag.includes('life_gain') || tag.includes('energy_') || tag.includes('ramp') ||
        tag === 'card_selection' || tag === 'multi_card_draw'
      ),
      'combat_abilities': availableTags.filter(tag => 
        ['flying', 'trample', 'haste', 'vigilance', 'deathtouch', 'lifelink', 'menace',
         'first_strike', 'double_strike', 'hexproof', 'indestructible', 'reach', 'evasion'].includes(tag) ||
        tag.includes('combat_') || tag.includes('attack_') || tag.includes('damage_')
      ),
      'removal_interaction': availableTags.filter(tag => 
        tag.includes('removal') || tag.includes('counterspell') || tag.includes('disruption') ||
        tag.includes('board_wipe') || tag.includes('bounce_') || tag.includes('destroy') ||
        tag === 'spot_removal' || tag === 'creature_removal' || tag === 'permanent_removal'
      ),
      'triggers_abilities': availableTags.filter(tag =>
        tag.includes('_trigger') || tag.includes('etb_') || tag.includes('ltb_') ||
        tag.includes('landfall') || tag.includes('prowess') || tag.includes('constellation')
      ),
      'synergy_themes': availableTags.filter(tag => 
        tag.includes('_matters') || tag.includes('_synergy') || tag.includes('_effect') ||
        tag.includes('artifact_') || tag.includes('enchantment_') || tag.includes('spell_')
      ),
      'counters_manipulation': availableTags.filter(tag =>
        tag.includes('counter') && !tag.includes('counterspell')
      ),
      'win_conditions': availableTags.filter(tag => 
        tag.includes('win_condition') || tag.includes('alternate_win')
      )
    };

    // Add "other" category after all other categories are defined
    const categorizedTags = new Set<string>();
    Object.values(tagsByCategory).forEach(categoryTags => {
      categoryTags.forEach(tag => categorizedTags.add(tag));
    });
    
    tagsByCategory.other = availableTags.filter(tag => !categorizedTags.has(tag));

    return NextResponse.json({
      allTags: availableTags,
      tagsByCategory,
      totalCount: availableTags.length
    });
    
  } catch (error) {
    console.error('Error fetching available tags:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch available tags', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
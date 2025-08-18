import { ScryfallCard, DeckCard, GenerationConstraints, CardTypeWeights } from './types';

/**
 * Calculate basic synergy between a card and commander
 * This is a lightweight version for constraint filtering
 */
function calculateBasicSynergy(card: ScryfallCard, commander: ScryfallCard): number {
  let synergy = 0;
  
  const cardText = (card.oracle_text || '').toLowerCase();
  const commanderText = (commander.oracle_text || '').toLowerCase();
  const cardType = card.type_line.toLowerCase();
  const cardName = card.name.toLowerCase();
  
  // Enhanced ETB/LTB synergy detection for flicker/exile commanders
  if (commanderText.includes('exile') || commanderText.includes('enters') || 
      commanderText.includes('leaves') || commanderText.includes('return')) {
    
    // Perfect synergy: Cards that trigger on ANY creature entering
    if (cardText.includes('whenever a creature enters the battlefield') ||
        cardText.includes('whenever a creature enters') ||
        cardText.includes('when a creature enters the battlefield') ||
        cardText.includes('when a creature enters')) {
      synergy += 10; // Maximum synergy for ETB triggers
    }
    
    // High synergy: Cards that trigger on creatures you control entering
    if (cardText.includes('whenever a creature you control enters') ||
        cardText.includes('when a creature you control enters')) {
      synergy += 8;
    }
    
    // Good synergy: Cards that create tokens (more ETB triggers)
    if (cardText.includes('create') && cardText.includes('token') && cardText.includes('creature')) {
      synergy += 6;
    }
    
    // Moderate synergy: Cards that care about creatures leaving
    if (cardText.includes('whenever a creature leaves') ||
        cardText.includes('when a creature leaves') ||
        cardText.includes('whenever a creature dies')) {
      synergy += 5;
    }
    
    // Specific high-synergy cards for Norin and similar commanders
    const norinSynergyCards = [
      'impact tremors',
      'purphoros, god of the forge', 
      'genesis chamber',
      'outpost siege',
      'goblin bombardment',
      'altar of the brood',
      'pandemonium',
      'warstorm surge',
      'where ancients tread',
      'elemental bond'
    ];
    
    if (norinSynergyCards.some(name => cardName.includes(name))) {
      synergy += 9; // Very high synergy for known combo pieces
    }
  }
  
  // Color identity synergy
  if (card.color_identity.length === 0) {
    synergy += 2; // Colorless cards fit in any deck
  } else if (card.color_identity.every(c => commander.color_identity.includes(c))) {
    synergy += 1; // Cards in commander's colors
  }
  
  // Artifact synergy for artifact strategies
  if (commanderText.includes('artifact') && cardType.includes('artifact')) {
    synergy += 3;
  }
  
  // Universal good cards
  if (card.name === 'Sol Ring' || 
      card.name === 'Arcane Signet' ||
      card.name === 'Command Tower') {
    synergy += 5; // Universal staples
  }
  
  return synergy;
}

// Official Commander ban list - should be updated via API call in production
const COMMANDER_BAN_LIST = [
  'Ancestral Recall',
  'Balance',
  'Biorhythm',
  'Black Lotus',
  'Braids, Cabal Minion',
  'Chaos Orb',
  'Coalition Victory',
  'Channel',
  'Emrakul, the Aeons Torn',
  'Erayo, Soratami Ascendant',
  'Falling Star',
  'Fastbond',
  'Flash',
  'Gifts Ungiven',
  'Griselbrand',
  'Hullbreacher',
  'Iona, Shield of Emeria',
  'Karakas',
  'Leovold, Emissary of Trest',
  'Library of Alexandria',
  'Limited Resources',
  'Lutri, the Spellchaser',
  'Mox Emerald',
  'Mox Jet',
  'Mox Pearl',
  'Mox Ruby',
  'Mox Sapphire',
  'Painter\'s Servant',
  'Panoptic Mirror',
  'Primeval Titan',
  'Prophet of Kruphix',
  'Recurring Nightmare',
  'Rofellos, Llanowar Emissary',
  'Shahrazad',
  'Sundering Titan',
  'Sway of the Stars',
  'Sylvan Primordial',
  'Time Vault',
  'Time Walk',
  'Tinker',
  'Tolarian Academy',
  'Trade Secrets',
  'Upheaval',
  'Worldfire',
  'Yawgmoth\'s Bargain'
];

export function isColorIdentityValid(card: ScryfallCard, commanderColorIdentity: string[]): boolean {
  // A card's color identity must be a subset of the commander's color identity
  return card.color_identity.every(color => commanderColorIdentity.includes(color));
}

export function isCommanderLegal(card: ScryfallCard): boolean {
  // Check basic legality
  if (card.legalities.commander !== 'legal') {
    return false;
  }
  
  // Check ban list
  if (COMMANDER_BAN_LIST.includes(card.name)) {
    return false;
  }
  
  // Check if it can actually be a commander
  const isLegendaryCreature = card.type_line.includes('Legendary') && card.type_line.includes('Creature');
  const isPlaneswalkerCommander = card.type_line.includes('Planeswalker') && 
    (card.oracle_text?.includes('can be your commander') || false);
  
  return isLegendaryCreature || isPlaneswalkerCommander;
}

export function isCardLegalInCommander(card: ScryfallCard): boolean {
  // Check basic legality
  if (card.legalities.commander !== 'legal') {
    return false;
  }
  
  // Check ban list
  if (COMMANDER_BAN_LIST.includes(card.name)) {
    return false;
  }
  
  return true;
}

export function validateDeckComposition(
  commander: ScryfallCard,
  cards: DeckCard[]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check total card count (100 cards including commander)
  if (cards.length !== 99) {
    errors.push(`Deck must contain exactly 99 cards plus commander (found ${cards.length})`);
  }
  
  // Check singleton rule (excluding basic lands)
  const basicLandNames = ['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes'];
  const nonBasicCards = cards.filter(card => !basicLandNames.includes(card.name));
  const cardNames = nonBasicCards.map(card => card.name);
  const duplicates = cardNames.filter((name, index) => cardNames.indexOf(name) !== index);
  if (duplicates.length > 0) {
    errors.push(`Duplicate non-basic cards found: ${Array.from(new Set(duplicates)).join(', ')}`);
  }
  
  // Check color identity
  const commanderColorIdentity = commander.color_identity;
  const invalidColorCards = cards.filter(card => !isColorIdentityValid(card, commanderColorIdentity));
  if (invalidColorCards.length > 0) {
    errors.push(`Cards violate color identity: ${invalidColorCards.map(c => c.name).join(', ')}`);
  }
  
  // Check legality
  const illegalCards = cards.filter(card => !isCardLegalInCommander(card));
  if (illegalCards.length > 0) {
    errors.push(`Illegal cards found: ${illegalCards.map(c => c.name).join(', ')}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function applyConstraintFilters(
  cards: ScryfallCard[],
  constraints: GenerationConstraints,
  commander?: ScryfallCard
): ScryfallCard[] {
  let filteredCards = [...cards];
  
  if (constraints.no_infinite_combos) {
    // This would require integration with Commander Spellbook API
    // For now, we'll filter some obvious combo pieces
    const comboKeywords = [
      'infinite',
      'untap all',
      'extra turn',
      'infinite mana',
      'enters the battlefield untapped'
    ];
    
    filteredCards = filteredCards.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      return !comboKeywords.some(keyword => text.includes(keyword));
    });
  }
  
  if (constraints.no_land_destruction) {
    const landDestructionKeywords = [
      'destroy target land',
      'destroy all lands',
      'sacrifice a land',
      'nonbasic lands',
    ];
    
    filteredCards = filteredCards.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      return !landDestructionKeywords.some(keyword => text.includes(keyword));
    });
  }
  
  if (constraints.no_extra_turns) {
    filteredCards = filteredCards.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      return !text.includes('extra turn') && !text.includes('additional turn');
    });
  }
  
  if (constraints.no_stax) {
    const staxKeywords = [
      'players can\'t',
      'spells cost',
      'additional cost',
      'enters the battlefield tapped',
      'can\'t untap',
      'skip their',
      'tax'
    ];
    
    filteredCards = filteredCards.filter(card => {
      const text = (card.oracle_text || '').toLowerCase();
      const name = card.name.toLowerCase();
      
      // Known stax pieces
      const staxCards = ['winter orb', 'static orb', 'sphere of resistance', 'thorn of amethyst'];
      if (staxCards.some(stax => name.includes(stax))) {
        return false;
      }
      
      return !staxKeywords.some(keyword => text.includes(keyword));
    });
  }
  
  if (constraints.no_fast_mana) {
    const fastManaCards = [
      'mana crypt',
      'mana vault',
      'jeweled lotus',
      'chrome mox',
      'mox diamond',
      'lotus petal',
      'dark ritual',
      'cabal ritual',
      'desperate ritual',
      'pyretic ritual',
      'seething song',
      'rite of flame'
    ];
    
    filteredCards = filteredCards.filter(card => {
      const name = card.name.toLowerCase();
      // Allow Sol Ring unless specifically disabled
      if (name === 'sol ring') return true;
      return !fastManaCards.some(fast => name.includes(fast));
    });
  }
  
  // Exclude Un-sets (joke sets like Unfinity, Unglued, Unstable, etc.)
  const unSets = ['ust', 'ugl', 'unh', 'unf', 'und']; // Unstable, Unglued, Unhinged, Unfinity
  filteredCards = filteredCards.filter(card => {
    const setCode = card.set?.toLowerCase();
    const cardName = card.name.toLowerCase();
    
    // Check set code
    if (setCode && unSets.includes(setCode)) {
      console.log(`🚫 applyConstraintFilters: Excluding ${card.name} from Un-set: ${setCode}`);
      return false;
    }
    
    // Additional check for specific Unfinity cards that might slip through
    const unfinitnameKeywords = ['acrobat', 'toast', 'piecing together'];
    if (unfinitnameKeywords.some(keyword => cardName.includes(keyword))) {
      console.log(`🚫 applyConstraintFilters: Excluding likely Un-set card: ${card.name}`);
      return false;
    }
    
    return true;
  });
  
  // Apply proportional card type weight filtering
  if (constraints.card_type_weights) {
    const weights = constraints.card_type_weights;
    
    // Create weighted pools for each card type  
    const cardsByType: Record<string, ScryfallCard[]> = {
      artifacts: [],
      creatures: [],
      enchantments: [],
      instants: [],
      sorceries: [],
      planeswalkers: [],
      other: []
    };
    
    // Categorize all cards by primary type
    for (const card of filteredCards) {
      const cardType = card.type_line.toLowerCase();
      
      if (cardType.includes('creature')) {
        cardsByType.creatures.push(card);
      } else if (cardType.includes('artifact')) {
        cardsByType.artifacts.push(card);
      } else if (cardType.includes('enchantment')) {
        cardsByType.enchantments.push(card);
      } else if (cardType.includes('instant')) {
        cardsByType.instants.push(card);
      } else if (cardType.includes('sorcery')) {
        cardsByType.sorceries.push(card);
      } else if (cardType.includes('planeswalker')) {
        cardsByType.planeswalkers.push(card);
      } else {
        cardsByType.other.push(card);
      }
    }
    
    // Apply proportional filtering based on weights (0=exclude, 1-10=proportional inclusion)
    const filteredByWeight: ScryfallCard[] = [];
    
    const applyWeightFilter = (cards: ScryfallCard[], weight: number, typeName: string) => {
      if (weight === 0) {
        console.log(`🚫 applyConstraintFilters: Excluding all ${typeName}s (weight = 0)`);
        return [];
      }
      
      // CRITICAL FIX: Always include high-synergy cards regardless of weight
      const highSynergyCards: ScryfallCard[] = [];
      const normalCards: ScryfallCard[] = [];
      
      for (const card of cards) {
        const synergyScore = commander ? calculateBasicSynergy(card, commander) : 0;
        if (synergyScore >= 8) {
          // Always include high synergy cards (Impact Tremors, Terror of the Peaks, etc)
          highSynergyCards.push(card);
        } else {
          normalCards.push(card);
        }
      }
      
      // Calculate how many normal cards to include based on weight
      // More generous rates to ensure sufficient card pool
      // 1=50%, 2=60%, 3=70%, 4=80%, 5=85%, 6=90%, 7=95%, 8=98%, 9=99%, 10=100%
      const inclusionRate = Math.max(0.5, Math.min(1.0, 0.4 + (weight * 0.06)));
      const maxNormalCards = Math.ceil(normalCards.length * inclusionRate);
      
      // Sort normal cards by efficiency
      const sortedNormal = normalCards.sort((a, b) => {
        const cmcA = a.cmc || 0;
        const cmcB = b.cmc || 0;
        return cmcA - cmcB;
      });
      
      const included = [...highSynergyCards, ...sortedNormal.slice(0, maxNormalCards)];
      
      console.log(`📊 applyConstraintFilters: Including ${included.length}/${cards.length} ${typeName}s (weight=${weight}, rate=${(inclusionRate*100).toFixed(0)}%)`);
      return included;
    };
    
    filteredByWeight.push(...applyWeightFilter(cardsByType.artifacts, weights.artifacts, 'artifact'));
    filteredByWeight.push(...applyWeightFilter(cardsByType.creatures, weights.creatures, 'creature'));
    filteredByWeight.push(...applyWeightFilter(cardsByType.enchantments, weights.enchantments, 'enchantment'));
    filteredByWeight.push(...applyWeightFilter(cardsByType.instants, weights.instants, 'instant'));
    filteredByWeight.push(...applyWeightFilter(cardsByType.sorceries, weights.sorceries, 'sorcery'));
    filteredByWeight.push(...applyWeightFilter(cardsByType.planeswalkers, weights.planeswalkers, 'planeswalker'));
    filteredByWeight.push(...cardsByType.other); // Always include other types
    
    filteredCards = filteredByWeight;
    console.log(`📊 applyConstraintFilters: Final pool after weight filtering: ${filteredCards.length} cards`);
  }
  
  return filteredCards;
}

export function categorizeCardRole(card: ScryfallCard): string[] {
  const roles: string[] = [];
  const text = (card.oracle_text || '').toLowerCase();
  const type = card.type_line.toLowerCase();
  const name = card.name.toLowerCase();
  
  // Land detection
  if (type.includes('land')) {
    roles.push('Land');
    return roles; // Lands are primarily lands
  }
  
  // Ramp detection
  if (text.includes('add') && (text.includes('mana') || text.includes('{') && text.includes('}'))) {
    roles.push('Ramp');
  }
  if (text.includes('search your library for a') && text.includes('land')) {
    roles.push('Ramp');
  }
  if (name.includes('signet') || name.includes('talisman') || name === 'sol ring') {
    roles.push('Ramp');
  }
  
  // Card draw detection
  if (text.includes('draw') && text.includes('card')) {
    roles.push('Draw/Advantage');
  }
  if (text.includes('scry') || text.includes('surveil')) {
    roles.push('Draw/Advantage');
  }
  
  // Removal detection
  if (text.includes('destroy target') || text.includes('exile target')) {
    if (text.includes('creature') || text.includes('permanent') || text.includes('artifact') || text.includes('enchantment')) {
      roles.push('Removal/Interaction');
    }
  }
  if (text.includes('deal') && text.includes('damage')) {
    roles.push('Removal/Interaction');
  }
  
  // Board wipe detection
  if (text.includes('destroy all') || text.includes('exile all')) {
    roles.push('Board Wipe');
  }
  if (text.includes('wrath') || name.includes('wrath')) {
    roles.push('Board Wipe');
  }
  
  // Tutor detection
  if (text.includes('search your library for') && !text.includes('land')) {
    roles.push('Tutor');
  }
  
  // If no specific role found, it's likely synergy/wincon
  if (roles.length === 0) {
    roles.push('Synergy/Wincon');
  }
  
  return roles;
}

export async function fetchCommanderBanList(): Promise<string[]> {
  try {
    // In a real implementation, this would fetch from mtgcommander.net
    // For now, return the static list
    return COMMANDER_BAN_LIST;
  } catch (error) {
    console.error('Failed to fetch ban list, using cached version:', error);
    return COMMANDER_BAN_LIST;
  }
}
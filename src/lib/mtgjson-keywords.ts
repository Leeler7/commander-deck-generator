interface MTGJSONKeywords {
  meta: {
    date: string;
    version: string;
  };
  data: {
    abilityWords: string[];
    keywordAbilities: string[];
    keywordActions: string[];
  };
}

// Comprehensive static fallback for all MTG keywords and mechanics
const STATIC_KEYWORDS = {
  abilityWords: [
    'Landfall', 'Metalcraft', 'Threshold', 'Hellbent', 'Fateful hour', 'Morbid', 'Bloodrush',
    'Battalion', 'Channel', 'Chroma', 'Domain', 'Grandeur', 'Hellbent', 'Heroic', 'Imprint',
    'Join forces', 'Kinship', 'Landfall', 'Metalcraft', 'Morbid', 'Parley', 'Radiance', 'Raid',
    'Rally', 'Spell mastery', 'Strive', 'Sweep', 'Tempting offer', 'Threshold', 'Undergrowth',
    'Will of the council', 'Addendum', 'Enrage', 'Ferocious', 'Formidable', 'Inspired', 'Magecraft',
    'Revolt', 'Spectacle', 'Adamant', 'Constellation', 'Converge', 'Delirium', 'Emerge', 'Improvise',
    'Metalcraft', 'Undergrowth', 'Ascend', 'Historic', 'Kicker', 'Multikicker'
  ],
  keywordAbilities: [
    // Evergreen keywords
    'Deathtouch', 'Defender', 'Double strike', 'Enchant', 'Equip', 'First strike', 'Flash', 
    'Flying', 'Haste', 'Hexproof', 'Indestructible', 'Lifelink', 'Menace', 'Protection', 
    'Prowess', 'Reach', 'Trample', 'Vigilance',
    // Non-evergreen keywords
    'Absorb', 'Affinity', 'Amplify', 'Annihilator', 'Banding', 'Battle cry', 'Bestow', 
    'Bloodthirst', 'Bushido', 'Buyback', 'Cascade', 'Champion', 'Changeling', 'Cipher', 
    'Convoke', 'Crew', 'Cumulative upkeep', 'Cycling', 'Dash', 'Delve', 'Detain', 'Devour', 
    'Dredge', 'Echo', 'Embalm', 'Emerge', 'Entwine', 'Epic', 'Escape', 'Eternalize', 'Evoke', 
    'Evolve', 'Exalted', 'Exert', 'Exploit', 'Explore', 'Extort', 'Fabricate', 'Fading', 
    'Fear', 'Flanking', 'Flashback', 'Forecast', 'Fortify', 'Frenzy', 'Graft', 'Gravestorm', 
    'Haste', 'Haunt', 'Hideaway', 'Horsemanship', 'Infect', 'Intimidate', 'Kicker', 'Landwalk', 
    'Level up', 'Living weapon', 'Madness', 'Manifest', 'Megamorph', 'Meld', 'Miracle', 
    'Modular', 'Monstrosity', 'Morph', 'Multikicker', 'Mutate', 'Ninjutsu', 'Offering', 
    'Overload', 'Persist', 'Phasing', 'Poisonous', 'Populate', 'Prowl', 'Rampage', 'Rebound', 
    'Recover', 'Reinforce', 'Renown', 'Replicate', 'Retrace', 'Riot', 'Ripple', 'Scavenge', 
    'Shadow', 'Shroud', 'Skulk', 'Soulbond', 'Soulshift', 'Splice', 'Split second', 'Storm', 
    'Sunburst', 'Suspend', 'Totem armor', 'Transfigure', 'Transform', 'Transmute', 'Tribute', 
    'Undaunted', 'Undying', 'Unearth', 'Unleash', 'Vanishing', 'Wither'
  ],
  keywordActions: [
    'Attach', 'Counter', 'Exile', 'Fight', 'Mill', 'Sacrifice', 'Scry',
    'Destroy', 'Search', 'Shuffle', 'Reveal', 'Draw', 'Discard', 'Put', 'Return',
    'Cast', 'Play', 'Activate', 'Trigger', 'Regenerate', 'Transform', 'Fateseal', 'Clash',
    'Proliferate', 'Populate', 'Detain', 'Cipher', 'Evolve', 'Extort', 'Fuse', 'Scavenge',
    'Overload', 'Unleash', 'Miracle', 'Soulbond', 'Undying', 'Fateful hour', 'Join forces',
    'Morbid', 'Metalcraft', 'Threshold', 'Hellbent', 'Domain', 'Chroma', 'Imprint', 'Landfall'
  ]
};

class MTGJSONKeywordService {
  private keywordsData: MTGJSONKeywords | null = null;
  private lastFetchDate: string | null = null;
  private isLoading = false;

  private async fetchKeywords(): Promise<MTGJSONKeywords> {
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have today's data
    if (this.keywordsData && this.lastFetchDate === today) {
      return this.keywordsData;
    }

    // Prevent multiple simultaneous fetches
    if (this.isLoading) {
      while (this.isLoading) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return this.keywordsData || { meta: { date: '', version: '' }, data: { abilityWords: [], keywordAbilities: [], keywordActions: [] } };
    }

    this.isLoading = true;
    
    try {
      console.log('📥 Fetching MTGJSON keywords data...');
      const response = await fetch('https://mtgjson.com/api/v5/Keywords.json', {
        headers: {
          'User-Agent': 'Commander-Deck-Generator/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !data.data) {
        throw new Error('Invalid MTGJSON keywords data format');
      }

      this.keywordsData = data;
      this.lastFetchDate = today;
      
      const totalKeywords = data.data.abilityWords.length + 
                           data.data.keywordAbilities.length + 
                           data.data.keywordActions.length;
      
      console.log(`✅ MTGJSON keywords loaded: ${totalKeywords} total keywords`);
      console.log(`  - ${data.data.abilityWords.length} ability words`);
      console.log(`  - ${data.data.keywordAbilities.length} keyword abilities`);
      console.log(`  - ${data.data.keywordActions.length} keyword actions`);
      
      return this.keywordsData;
    } catch (error) {
      console.error('❌ Failed to fetch MTGJSON keywords:', error);
      console.log('🔄 Falling back to comprehensive static keyword list...');
      // Return static fallback with comprehensive keywords
      this.keywordsData = { 
        meta: { date: new Date().toISOString(), version: 'static-fallback' }, 
        data: STATIC_KEYWORDS 
      };
      this.lastFetchDate = today;
      return this.keywordsData;
    } finally {
      this.isLoading = false;
    }
  }

  async getKeywordCategories(): Promise<{
    abilityWords: string[];
    keywordAbilities: string[];
    keywordActions: string[];
  }> {
    const data = await this.fetchKeywords();
    return data.data;
  }

  async analyzeCardKeywords(cardText: string): Promise<{
    abilityWords: string[];
    keywordAbilities: string[];
    keywordActions: string[];
    totalKeywords: number;
  }> {
    if (!cardText) {
      return { abilityWords: [], keywordAbilities: [], keywordActions: [], totalKeywords: 0 };
    }

    const keywords = await this.getKeywordCategories();
    const lowerCardText = cardText.toLowerCase();
    
    const foundAbilityWords = keywords.abilityWords.filter(word => 
      lowerCardText.includes(word.toLowerCase())
    );
    
    const foundKeywordAbilities = keywords.keywordAbilities.filter(ability => 
      lowerCardText.includes(ability.toLowerCase())
    );
    
    const foundKeywordActions = keywords.keywordActions.filter(action => 
      lowerCardText.includes(action.toLowerCase())
    );
    
    // Add more specific keyword detection for overly broad terms
    const specificKeywords = this.detectSpecificKeywords(cardText);
    foundKeywordActions.push(...specificKeywords);

    return {
      abilityWords: foundAbilityWords,
      keywordAbilities: foundKeywordAbilities,
      keywordActions: foundKeywordActions,
      totalKeywords: foundAbilityWords.length + foundKeywordAbilities.length + foundKeywordActions.length
    };
  }

  /**
   * Detect specific keywords with more nuanced context
   * This replaces overly broad detection of Tap, Untap, Create
   */
  private detectSpecificKeywords(cardText: string): string[] {
    const lowerText = cardText.toLowerCase();
    const specificKeywords: string[] = [];
    
    // TAP MECHANICS - More specific detection
    if (lowerText.includes('tap:') || lowerText.includes('{t}:')) {
      specificKeywords.push('Tap Ability');
    }
    if (lowerText.includes('tap an untapped') || lowerText.includes('tap target')) {
      specificKeywords.push('Tap Target');
    }
    if (lowerText.includes('becomes tapped') || lowerText.includes('enters tapped')) {
      specificKeywords.push('Enters Tapped');
    }
    if (lowerText.includes('tap it') && lowerText.includes('when') || lowerText.includes('whenever')) {
      specificKeywords.push('Conditional Tap');
    }
    
    // UNTAP MECHANICS - More specific detection
    if (lowerText.includes('untap:') || lowerText.includes('untap all') || lowerText.includes('untap target')) {
      specificKeywords.push('Untap Effect');
    }
    if (lowerText.includes('does not untap') || lowerText.includes("doesn't untap")) {
      specificKeywords.push('Prevent Untap');
    }
    if (lowerText.includes('untap step')) {
      specificKeywords.push('Untap Step Matters');
    }
    
    // CREATE MECHANICS - Token-specific detection only
    if (lowerText.includes('create a') && lowerText.includes('token')) {
      // Further categorize by token type
      if (lowerText.includes('treasure token')) {
        specificKeywords.push('Create Treasure');
      } else if (lowerText.includes('creature token')) {
        specificKeywords.push('Create Creature Token');
      } else if (lowerText.includes('artifact token')) {
        specificKeywords.push('Create Artifact Token');
      } else {
        specificKeywords.push('Create Token');
      }
    }
    
    return specificKeywords;
  }

  async calculateKeywordSynergy(
    commanderText: string, 
    cardText: string
  ): Promise<{
    score: number;
    sharedKeywords: string[];
    analysis: string;
  }> {
    const commanderKeywords = await this.analyzeCardKeywords(commanderText);
    const cardKeywords = await this.analyzeCardKeywords(cardText);
    
    // Find shared keywords across all categories
    const sharedAbilityWords = commanderKeywords.abilityWords.filter(word => 
      cardKeywords.abilityWords.includes(word)
    );
    
    const sharedKeywordAbilities = commanderKeywords.keywordAbilities.filter(ability => 
      cardKeywords.keywordAbilities.includes(ability)
    );
    
    const sharedKeywordActions = commanderKeywords.keywordActions.filter(action => 
      cardKeywords.keywordActions.includes(action)
    );
    
    const allSharedKeywords = [
      ...sharedAbilityWords,
      ...sharedKeywordAbilities, 
      ...sharedKeywordActions
    ];

    // Calculate synergy score with comprehensive mechanics
    let score = 0;
    
    // Define keyword synergy categories with specific scores
    const keywordScoring = {
      // Extremely high synergy mechanics (20+ points)
      premium: [
        'landfall', 'storm', 'cascade', 'affinity', 'dredge', 'flashback', 'threshold'
      ],
      
      // Very high synergy mechanics (15+ points)
      veryHigh: [
        'convoke', 'delve', 'emerge', 'exploit', 'evolve', 'extort', 'populate', 'proliferate',
        'scavenge', 'undying', 'persist', 'modular', 'sunburst', 'devour', 'graft'
      ],
      
      // High-value keyword abilities (10+ points)
      high: [
        'flying', 'trample', 'lifelink', 'deathtouch', 'vigilance', 'haste', 'hexproof', 
        'indestructible', 'menace', 'reach', 'first strike', 'double strike', 'annihilator',
        'infect', 'wither', 'shroud', 'fear', 'intimidate', 'protection'
      ],
      
      // ETB/LTB synergies (12+ points) 
      etbLtb: [
        'enters the battlefield', 'when', 'whenever', 'leaves the battlefield', 'dies', 
        'destroy', 'sacrifice', 'put', 'return', 'flicker', 'exile', 'bounce'
      ],
      
      // Token/creature synergies (8+ points) - More specific token mechanics
      tokens: [
        'Create Creature Token', 'Create Treasure', 'Create Artifact Token', 'populate', 
        'embalm', 'eternalize', 'manifest', 'morph', 'megamorph'
      ],
      
      // Graveyard synergies (10+ points)
      graveyard: [
        'dredge', 'flashback', 'unearth', 'delve', 'escape', 'threshold', 'delirium', 
        'undergrowth', 'morbid', 'recover', 'retrace', 'scavenge'
      ],
      
      // Artifact synergies (8+ points) 
      artifacts: [
        'affinity', 'imprint', 'living weapon', 'equip', 'fortify', 'crew', 'metalcraft', 'improvise'
      ],
      
      // Counter synergies (8+ points)
      counters: [
        'proliferate', 'modular', '+1/+1 counter', 'sunburst', 'graft', 'evolve', 'adapt', 
        'monstrosity', 'renown', 'bolster', 'support', 'fabricate'
      ],
      
      // Spell synergies (7+ points)
      spells: [
        'prowess', 'storm', 'replicate', 'overload', 'buyback', 'flashback', 'rebound',
        'cascade', 'epic', 'splice', 'suspend', 'miracle', 'madness'
      ],
      
      // Tap/Untap synergies (6+ points) - Specific context matters
      tapUntap: [
        'Tap Ability', 'Tap Target', 'Untap Effect', 'Untap Step Matters'
      ],
      
      // Lower value mechanics (3+ points) - Generic or common effects
      generic: [
        'Enters Tapped', 'Conditional Tap', 'Prevent Untap', 'Create Token'
      ]
    };

    for (const keyword of allSharedKeywords) {
      const lowerKeyword = keyword.toLowerCase();
      let keywordScored = false;
      
      // Check premium mechanics first
      if (keywordScoring.premium.some(k => lowerKeyword.includes(k))) {
        score += 20;
        keywordScored = true;
      } 
      // Very high synergy mechanics
      else if (keywordScoring.veryHigh.some(k => lowerKeyword.includes(k))) {
        score += 15;
        keywordScored = true;
      }
      // Graveyard synergies
      else if (keywordScoring.graveyard.some(k => lowerKeyword.includes(k))) {
        score += 10;
        keywordScored = true;
      }
      // ETB/LTB synergies
      else if (keywordScoring.etbLtb.some(k => lowerKeyword.includes(k))) {
        score += 12;
        keywordScored = true;
      }
      // High-value combat keywords
      else if (keywordScoring.high.some(k => lowerKeyword.includes(k))) {
        score += 10;
        keywordScored = true;
      }
      // Artifact synergies
      else if (keywordScoring.artifacts.some(k => lowerKeyword.includes(k))) {
        score += 8;
        keywordScored = true;
      }
      // Counter synergies
      else if (keywordScoring.counters.some(k => lowerKeyword.includes(k))) {
        score += 8;
        keywordScored = true;
      }
      // Token synergies
      else if (keywordScoring.tokens.some(k => lowerKeyword.includes(k))) {
        score += 8;
        keywordScored = true;
      }
      // Spell synergies
      else if (keywordScoring.spells.some(k => lowerKeyword.includes(k))) {
        score += 7;
        keywordScored = true;
      }
      // Tap/Untap synergies
      else if (keywordScoring.tapUntap.some(k => lowerKeyword.includes(k))) {
        score += 6;
        keywordScored = true;
      }
      // Generic/Common mechanics
      else if (keywordScoring.generic.some(k => lowerKeyword.includes(k))) {
        score += 3;
        keywordScored = true;
      }
      
      // Default scoring for unmatched keywords - REDUCED
      if (!keywordScored) {
        score += 1; // Minimal score for generic keyword matches
      }
    }

    // Bonus for multiple shared keywords
    if (allSharedKeywords.length > 1) {
      score += allSharedKeywords.length * 2;
    }

    let analysis = '';
    if (allSharedKeywords.length > 0) {
      analysis = `Shared keywords: ${allSharedKeywords.join(', ')}`;
    } else {
      analysis = 'No shared keywords found';
    }

    return {
      score: Math.min(score, 35), // Increased cap to 35 points for premium mechanics
      sharedKeywords: allSharedKeywords,
      analysis
    };
  }

  // Helper method to check for specific keyword synergies
  async hasKeywordSynergy(commanderText: string, cardText: string, targetKeywords: string[]): Promise<boolean> {
    const commanderKeywords = await this.analyzeCardKeywords(commanderText);
    const cardKeywords = await this.analyzeCardKeywords(cardText);
    
    const allCommanderKeywords = [
      ...commanderKeywords.abilityWords,
      ...commanderKeywords.keywordAbilities,
      ...commanderKeywords.keywordActions
    ].map(k => k.toLowerCase());
    
    const allCardKeywords = [
      ...cardKeywords.abilityWords,
      ...cardKeywords.keywordAbilities,
      ...cardKeywords.keywordActions
    ].map(k => k.toLowerCase());
    
    return targetKeywords.some(keyword => 
      allCommanderKeywords.some(ck => ck.includes(keyword.toLowerCase())) &&
      allCardKeywords.some(cardK => cardK.includes(keyword.toLowerCase()))
    );
  }

  // Get meta information about the keywords data
  async getKeywordsMetadata(): Promise<{ date: string; version: string; totalKeywords: number }> {
    const data = await this.fetchKeywords();
    const totalKeywords = data.data.abilityWords.length + 
                         data.data.keywordAbilities.length + 
                         data.data.keywordActions.length;
    
    return {
      date: data.meta.date,
      version: data.meta.version,
      totalKeywords
    };
  }

  // Clear cached data
  clearCache(): void {
    this.keywordsData = null;
    this.lastFetchDate = null;
    console.log('🗑️ MTGJSON keywords cache cleared');
  }
}

// Export singleton instance
export const mtgjsonKeywords = new MTGJSONKeywordService();

// Helper function for easy integration
export async function calculateEnhancedKeywordSynergy(
  commanderText: string,
  cardText: string
): Promise<{
  score: number;
  sharedKeywords: string[];
  analysis: string;
}> {
  return await mtgjsonKeywords.calculateKeywordSynergy(commanderText, cardText);
}
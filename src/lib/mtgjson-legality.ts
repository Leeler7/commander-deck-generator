// MTGJSON Legality values
type LegalityStatus = 'legal' | 'not_legal' | 'banned' | 'restricted';

interface MTGJSONLegalities {
  alchemy?: LegalityStatus;
  brawl?: LegalityStatus;
  commander?: LegalityStatus;
  duel?: LegalityStatus;
  explorer?: LegalityStatus;
  future?: LegalityStatus;
  gladiator?: LegalityStatus;
  historic?: LegalityStatus;
  historicbrawl?: LegalityStatus;
  legacy?: LegalityStatus;
  modern?: LegalityStatus;
  oathbreaker?: LegalityStatus;
  oldschool?: LegalityStatus;
  pauper?: LegalityStatus;
  paupercommander?: LegalityStatus;
  penny?: LegalityStatus;
  pioneer?: LegalityStatus;
  predh?: LegalityStatus;
  premodern?: LegalityStatus;
  standard?: LegalityStatus;
  standardbrawl?: LegalityStatus;
  timeless?: LegalityStatus;
  vintage?: LegalityStatus;
}

interface LegalityAnalysis {
  isCommanderLegal: boolean;
  restrictedFormats: string[];
  bannedFormats: string[];
  legalFormats: string[];
  warnings: string[];
  recommendations: string[];
}

class MTGJSONLegalityService {
  
  /**
   * Analyze a card's legality across all formats
   */
  analyzeCardLegality(legalities: MTGJSONLegalities): LegalityAnalysis {
    const analysis: LegalityAnalysis = {
      isCommanderLegal: false,
      restrictedFormats: [],
      bannedFormats: [],
      legalFormats: [],
      warnings: [],
      recommendations: []
    };

    // Check Commander legality specifically
    analysis.isCommanderLegal = legalities.commander === 'legal';
    
    // Analyze all formats
    for (const [format, status] of Object.entries(legalities)) {
      if (!status) continue;
      
      const formatName = this.formatDisplayName(format);
      
      switch (status) {
        case 'legal':
          analysis.legalFormats.push(formatName);
          break;
        case 'banned':
          analysis.bannedFormats.push(formatName);
          break;
        case 'restricted':
          analysis.restrictedFormats.push(formatName);
          break;
        case 'not_legal':
          // Don't add to any list - just not legal
          break;
      }
    }

    // Generate warnings and recommendations
    if (!analysis.isCommanderLegal) {
      if (legalities.commander === 'banned') {
        analysis.warnings.push('This card is banned in Commander format');
      } else if (legalities.commander === 'restricted') {
        analysis.warnings.push('This card is restricted in Commander format');
      } else {
        analysis.warnings.push('This card is not legal in Commander format');
      }
    }

    // Check for problematic cards across formats
    if (analysis.bannedFormats.length > 3) {
      analysis.warnings.push('This card is banned in multiple formats - may be very powerful');
    }

    if (analysis.restrictedFormats.length > 0) {
      analysis.warnings.push(`Card is restricted in: ${analysis.restrictedFormats.join(', ')}`);
    }

    // Recommendations
    if (analysis.isCommanderLegal && analysis.legalFormats.includes('Legacy') && analysis.legalFormats.includes('Vintage')) {
      analysis.recommendations.push('Powerful staple card legal across many formats');
    }

    if (analysis.isCommanderLegal && !analysis.legalFormats.includes('Modern')) {
      analysis.recommendations.push('Legacy/Commander-only card - likely from older set');
    }

    return analysis;
  }

  /**
   * Check if a card is legal for Commander play
   */
  isCommanderLegal(legalities: MTGJSONLegalities): boolean {
    return legalities.commander === 'legal';
  }

  /**
   * Validate an entire deck's legality
   */
  validateDeckLegality(cards: Array<{ name: string; legalities: MTGJSONLegalities }>): {
    isLegal: boolean;
    illegalCards: Array<{ name: string; reason: string }>;
    warnings: string[];
    summary: string;
  } {
    const illegalCards: Array<{ name: string; reason: string }> = [];
    const warnings: string[] = [];
    
    for (const card of cards) {
      const analysis = this.analyzeCardLegality(card.legalities);
      
      if (!analysis.isCommanderLegal) {
        let reason = 'Not legal in Commander';
        if (card.legalities.commander === 'banned') {
          reason = 'Banned in Commander';
        } else if (card.legalities.commander === 'restricted') {
          reason = 'Restricted in Commander';
        }
        
        illegalCards.push({
          name: card.name,
          reason
        });
      }

      // Add warnings for potentially problematic cards
      if (analysis.warnings.length > 0) {
        warnings.push(`${card.name}: ${analysis.warnings.join(', ')}`);
      }
    }

    const isLegal = illegalCards.length === 0;
    
    let summary = '';
    if (isLegal) {
      summary = `All ${cards.length} cards are legal in Commander format`;
    } else {
      summary = `${illegalCards.length} of ${cards.length} cards are not legal in Commander format`;
    }

    return {
      isLegal,
      illegalCards,
      warnings,
      summary
    };
  }

  /**
   * Get format-friendly display names
   */
  private formatDisplayName(format: string): string {
    const displayNames: Record<string, string> = {
      'commander': 'Commander',
      'legacy': 'Legacy',
      'vintage': 'Vintage',
      'modern': 'Modern',
      'pioneer': 'Pioneer',
      'standard': 'Standard',
      'pauper': 'Pauper',
      'historic': 'Historic',
      'brawl': 'Brawl',
      'alchemy': 'Alchemy',
      'timeless': 'Timeless',
      'explorer': 'Explorer',
      'gladiator': 'Gladiator',
      'historicbrawl': 'Historic Brawl',
      'standardbrawl': 'Standard Brawl',
      'oathbreaker': 'Oathbreaker',
      'paupercommander': 'Pauper Commander',
      'predh': 'PreDH',
      'premodern': 'Premodern',
      'oldschool': 'Old School',
      'penny': 'Penny Dreadful',
      'duel': 'Duel Commander',
      'future': 'Future'
    };

    return displayNames[format.toLowerCase()] || format;
  }

  /**
   * Filter cards to only those legal in Commander
   */
  filterCommanderLegal<T extends { legalities: MTGJSONLegalities }>(cards: T[]): T[] {
    return cards.filter(card => this.isCommanderLegal(card.legalities));
  }

  /**
   * Get legality statistics for a card pool
   */
  getLegalityStats(cards: Array<{ legalities: MTGJSONLegalities }>): {
    commanderLegal: number;
    bannedInCommander: number;
    restrictedInCommander: number;
    notLegalInCommander: number;
    totalCards: number;
    legalPercentage: number;
  } {
    let commanderLegal = 0;
    let bannedInCommander = 0;
    let restrictedInCommander = 0;
    let notLegalInCommander = 0;

    for (const card of cards) {
      switch (card.legalities.commander) {
        case 'legal':
          commanderLegal++;
          break;
        case 'banned':
          bannedInCommander++;
          break;
        case 'restricted':
          restrictedInCommander++;
          break;
        default:
          notLegalInCommander++;
          break;
      }
    }

    const totalCards = cards.length;
    const legalPercentage = totalCards > 0 ? (commanderLegal / totalCards) * 100 : 0;

    return {
      commanderLegal,
      bannedInCommander,
      restrictedInCommander,
      notLegalInCommander,
      totalCards,
      legalPercentage
    };
  }
}

// Export singleton instance
export const mtgjsonLegality = new MTGJSONLegalityService();

// Helper functions for easy integration
export function isCommanderLegal(legalities: MTGJSONLegalities): boolean {
  return mtgjsonLegality.isCommanderLegal(legalities);
}

export function analyzeCardLegality(legalities: MTGJSONLegalities): LegalityAnalysis {
  return mtgjsonLegality.analyzeCardLegality(legalities);
}

export function validateDeckLegality(cards: Array<{ name: string; legalities: MTGJSONLegalities }>) {
  return mtgjsonLegality.validateDeckLegality(cards);
}

export type { MTGJSONLegalities, LegalityAnalysis };
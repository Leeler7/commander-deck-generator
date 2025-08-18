import { GeneratedDeck, DeckCard, ExportFormats } from './types';

export class DeckExporter {
  exportToText(deck: GeneratedDeck): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`Commander: ${deck.commander.name}`);
    lines.push(`Total Price: $${deck.total_price.toFixed(2)}`);
    lines.push('');
    
    // Commander section
    lines.push('COMMANDER:');
    lines.push(`1 ${deck.commander.name}`);
    lines.push('');
    
    // Group cards by role
    const cardsByRole = this.groupCardsByRole([...deck.nonland_cards, ...deck.lands]);
    
    for (const [role, cards] of Object.entries(cardsByRole)) {
      if (cards.length === 0) continue;
      
      lines.push(`${role.toUpperCase()}:`);
      const sortedCards = cards.sort((a, b) => a.name.localeCompare(b.name));
      
      for (const card of sortedCards) {
        lines.push(`1 ${card.name}`);
      }
      lines.push('');
    }
    
    // Total count
    const totalCards = 1 + deck.nonland_cards.length + deck.lands.length;
    lines.push(`Total: ${totalCards} cards`);
    
    return lines.join('\n');
  }

  exportToCSV(deck: GeneratedDeck): string {
    const rows: string[] = [];
    
    // Header
    rows.push('Name,Quantity,Role,Mana Value,Price,Synergy Notes');
    
    // Commander
    rows.push(`"${deck.commander.name}",1,"Commander",${deck.commander.cmc},"$${(deck.commander.price_used || 0).toFixed(2)}","${deck.commander.synergy_notes || ''}"`); 
    
    // All other cards
    const allCards = [...deck.nonland_cards, ...deck.lands];
    const sortedCards = allCards.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const card of sortedCards) {
      const escapedName = `"${card.name.replace(/"/g, '""')}"`;
      const escapedNotes = `"${(card.synergy_notes || '').replace(/"/g, '""')}"`;
      rows.push(`${escapedName},1,"${card.role}",${card.cmc},"$${(card.price_used || 0).toFixed(2)}",${escapedNotes}`);
    }
    
    return rows.join('\n');
  }

  generateArchidektImportUrl(deck: GeneratedDeck): string {
    const deckList = this.generateSimpleDecklist(deck);
    
    // Archidekt doesn't have a direct import URL with cards
    // Instead, open to new deck page and user can paste the deck list
    const baseUrl = 'https://archidekt.com/decks/new';
    const params = new URLSearchParams({
      format: 'commander'
    });
    
    return `${baseUrl}?${params.toString()}`;
  }

  generateMoxfieldImportUrl(deck: GeneratedDeck): string {
    const deckList = this.generateSimpleDecklist(deck);
    const encodedDecklist = encodeURIComponent(deckList);
    
    // Moxfield doesn't have a direct import URL, but we can create a shareable format
    // This would typically require API integration for full functionality
    const baseUrl = 'https://www.moxfield.com/decks/new';
    
    return baseUrl; // User would need to manually paste the decklist
  }

  generateMoxfieldDeckData(deck: GeneratedDeck): any {
    const commanders = {
      [deck.commander.name]: {
        quantity: 1,
        boardType: 'commanders'
      }
    };
    
    const mainboard: Record<string, any> = {};
    
    for (const card of [...deck.nonland_cards, ...deck.lands]) {
      mainboard[card.name] = {
        quantity: 1,
        boardType: 'mainboard'
      };
    }
    
    return {
      name: `${deck.commander.name} - Generated Deck`,
      description: `Generated at power level ${deck.generation_notes[0] || 'Unknown'}`,
      format: 'commander',
      commanders,
      mainboard,
      sideboard: {},
      maybeboard: {},
      tokens: {},
      publicNotes: deck.generation_notes.join('\n'),
      privateNotes: `Total Price: $${deck.total_price.toFixed(2)}\n\nRole Breakdown:\n${this.formatRoleBreakdown(deck.role_breakdown)}`,
    };
  }

  generateTappedOutFormat(deck: GeneratedDeck): string {
    const lines: string[] = [];
    
    // TappedOut format requires specific syntax
    lines.push(`// ${deck.commander.name} - Generated Commander Deck`);
    lines.push(`// Total Price: $${deck.total_price.toFixed(2)}`);
    lines.push('');
    
    // Commander
    lines.push('// Commander');
    lines.push(`1 ${deck.commander.name} *CMDR*`);
    lines.push('');
    
    // Group by role and format
    const cardsByRole = this.groupCardsByRole([...deck.nonland_cards, ...deck.lands]);
    
    for (const [role, cards] of Object.entries(cardsByRole)) {
      if (cards.length === 0) continue;
      
      lines.push(`// ${role}`);
      const sortedCards = cards.sort((a, b) => a.name.localeCompare(b.name));
      
      for (const card of sortedCards) {
        lines.push(`1 ${card.name}`);
      }
      lines.push('');
    }
    
    return lines.join('\n');
  }

  exportAllFormats(deck: GeneratedDeck): ExportFormats {
    return {
      text: this.exportToText(deck),
      csv: this.exportToCSV(deck),
      archidekt_url: this.generateArchidektImportUrl(deck),
      moxfield_url: this.generateMoxfieldImportUrl(deck)
    };
  }

  generateDeckStatistics(deck: GeneratedDeck): {
    total_cards: number;
    total_price: number;
    average_cmc: number;
    color_distribution: Record<string, number>;
    type_breakdown: Record<string, number>;
    price_breakdown: Record<string, number>;
    role_breakdown: Record<string, number>;
  } {
    const allCards = [deck.commander, ...deck.nonland_cards, ...deck.lands];
    
    // Total cards and price
    const total_cards = allCards.length;
    const total_price = deck.total_price;
    
    // Average CMC (excluding lands)
    const nonLandCards = [deck.commander, ...deck.nonland_cards];
    const average_cmc = nonLandCards.reduce((sum, card) => sum + card.cmc, 0) / nonLandCards.length;
    
    // Color distribution
    const color_distribution: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    for (const card of allCards) {
      if (card.color_identity.length === 0) {
        color_distribution.C++;
      } else {
        for (const color of card.color_identity) {
          color_distribution[color]++;
        }
      }
    }
    
    // Type breakdown
    const type_breakdown: Record<string, number> = {};
    for (const card of allCards) {
      const mainType = this.extractMainType(card.type_line);
      type_breakdown[mainType] = (type_breakdown[mainType] || 0) + 1;
    }
    
    // Price breakdown by role
    const price_breakdown: Record<string, number> = {};
    for (const card of allCards) {
      const role = card.role || 'Other';
      const price = card.price_used || 0;
      price_breakdown[role] = (price_breakdown[role] || 0) + price;
    }
    
    // Role breakdown (count)
    const role_breakdown: Record<string, number> = {};
    for (const card of allCards) {
      const role = card.role || 'Other';
      role_breakdown[role] = (role_breakdown[role] || 0) + 1;
    }
    
    return {
      total_cards,
      total_price,
      average_cmc,
      color_distribution,
      type_breakdown,
      price_breakdown,
      role_breakdown
    };
  }

  generateShareableLink(deck: GeneratedDeck, baseUrl: string): string {
    // Create a shareable link with deck data encoded
    const deckData = {
      commander: deck.commander.name,
      cards: [...deck.nonland_cards, ...deck.lands].map(card => card.name),
      total_price: deck.total_price,
      generation_notes: deck.generation_notes
    };
    
    const encodedData = btoa(JSON.stringify(deckData));
    return `${baseUrl}/deck/${encodedData}`;
  }

  private generateSimpleDecklist(deck: GeneratedDeck): string {
    const lines: string[] = [];
    
    // Commander
    lines.push(`1 ${deck.commander.name}`);
    
    // All other cards
    const allCards = [...deck.nonland_cards, ...deck.lands];
    const sortedCards = allCards.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const card of sortedCards) {
      lines.push(`1 ${card.name}`);
    }
    
    return lines.join('\n');
  }

  private groupCardsByRole(cards: DeckCard[]): Record<string, DeckCard[]> {
    const grouped: Record<string, DeckCard[]> = {};
    
    for (const card of cards) {
      const role = card.role;
      if (!grouped[role]) {
        grouped[role] = [];
      }
      grouped[role].push(card);
    }
    
    return grouped;
  }

  private extractMainType(typeLine: string): string {
    const types = typeLine.split('—')[0].trim().split(' ');
    
    // Priority order for main types
    const typeMap: Record<string, string> = {
      'Creature': 'Creature',
      'Planeswalker': 'Planeswalker',
      'Instant': 'Instant',
      'Sorcery': 'Sorcery',
      'Artifact': 'Artifact',
      'Enchantment': 'Enchantment',
      'Land': 'Land'
    };
    
    for (const type of types) {
      if (typeMap[type]) {
        return typeMap[type];
      }
    }
    
    return types[0] || 'Other';
  }

  private formatRoleBreakdown(roleBreakdown: Record<string, number>): string {
    return Object.entries(roleBreakdown)
      .map(([role, count]) => `${role}: ${count}`)
      .join('\n');
  }
}

export class PurchaseUrlGenerator {
  /**
   * Generate TCGPlayer mass entry URL
   * TCGPlayer accepts a list in the format: "1 Card Name"
   */
  generateTCGPlayerUrl(deck: GeneratedDeck): string {
    const cards = [
      `1 ${deck.commander.name}`,
      ...deck.nonland_cards.map(card => `1 ${card.name}`),
      ...deck.lands.map(card => `1 ${card.name}`)
    ];
    
    const deckList = cards.join('\n');
    const encodedList = encodeURIComponent(deckList);
    
    return `https://www.tcgplayer.com/massentry?productline=magic&c=${encodedList}`;
  }

  /**
   * Generate Card Kingdom URL
   * Card Kingdom uses a specific format for their cart
   */
  generateCardKingdomUrl(deck: GeneratedDeck): string {
    const allCards = [deck.commander, ...deck.nonland_cards, ...deck.lands];
    
    // Card Kingdom uses a specific URL structure
    // Format: https://www.cardkingdom.com/builder?partner=PARTNER&deckcontents=ENCODED_LIST
    const deckList = allCards.map(card => `1 ${card.name}`).join('\n');
    const encodedList = encodeURIComponent(deckList);
    
    return `https://www.cardkingdom.com/builder?deckcontents=${encodedList}`;
  }

  /**
   * Generate StarCityGames URL
   * SCG uses their own deck builder format
   */
  generateStarCityGamesUrl(deck: GeneratedDeck): string {
    const allCards = [deck.commander, ...deck.nonland_cards, ...deck.lands];
    
    // StarCityGames format - they accept a simple list
    const deckList = allCards.map(card => `1 ${card.name}`).join('\n');
    const encodedList = encodeURIComponent(deckList);
    
    // SCG doesn't have a direct mass entry URL, so we'll use their search
    // Users will need to manually add cards, but we can provide a formatted list
    return `https://starcitygames.com/search/?search_query=${encodedList.slice(0, 200)}`; // Limit URL length
  }

  /**
   * Generate TCGPlayer Optimizer URL (tries to find cheapest versions)
   */
  generateTCGPlayerOptimizerUrl(deck: GeneratedDeck): string {
    const cards = [
      `1 ${deck.commander.name}`,
      ...deck.nonland_cards.map(card => `1 ${card.name}`),
      ...deck.lands.map(card => `1 ${card.name}`)
    ];
    
    const deckList = cards.join('\n');
    const encodedList = encodeURIComponent(deckList);
    
    // Add optimizer flag to get best prices
    return `https://www.tcgplayer.com/massentry?productline=magic&optimized=true&c=${encodedList}`;
  }

  /**
   * Generate a shareable deck list that can be copied for any retailer
   */
  generateUniversalDeckList(deck: GeneratedDeck): string {
    const lines: string[] = [];
    
    // Commander
    lines.push(`1 ${deck.commander.name}`);
    
    // Sort other cards alphabetically for easy checking
    const allOtherCards = [...deck.nonland_cards, ...deck.lands]
      .sort((a, b) => a.name.localeCompare(b.name));
    
    for (const card of allOtherCards) {
      lines.push(`1 ${card.name}`);
    }
    
    return lines.join('\n');
  }

  /**
   * Calculate estimated purchase price from different vendors
   */
  estimatePurchasePrice(deck: GeneratedDeck): {
    tcgLow: number;
    tcgMarket: number;
    estimated: number;
    disclaimer: string;
  } {
    const allCards = [deck.commander, ...deck.nonland_cards, ...deck.lands];
    
    // Use the prices we already have from generation
    const totalPrice = allCards.reduce((sum, card) => sum + (card.price_used || 0), 0);
    
    return {
      tcgLow: totalPrice * 0.85, // Estimate 15% lower for TCG low
      tcgMarket: totalPrice,
      estimated: totalPrice,
      disclaimer: 'Prices are estimates based on data at generation time. Actual prices may vary.'
    };
  }
}

export const deckExporter = new DeckExporter();
export const purchaseUrlGenerator = new PurchaseUrlGenerator();
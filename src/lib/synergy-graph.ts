import { CandidateCard } from './candidate-pools';
import { CommanderProfile } from './commander-profiler';
import { ScryfallCard } from './types';

/**
 * Synergy Graph System
 * Calculates explicit cross-card synergies and deck cohesion
 */

export interface SynergyEdge {
  cardA: string;          // Card name A
  cardB: string;          // Card name B
  synergyType: SynergyType;
  strength: number;       // 0-10, how strong the synergy is
  description: string;    // Human-readable explanation
  bidirectional: boolean; // Does the synergy work both ways?
}

export type SynergyType = 
  | 'combo'           // Cards that combo together
  | 'amplifies'       // A makes B better
  | 'enables'         // A enables B to work
  | 'protects'        // A protects B
  | 'recurses'        // A brings back B
  | 'tutors'          // A finds B
  | 'tribal'          // Tribal synergy
  | 'thematic'        // Share same theme/archetype
  | 'curve'           // Good curve relationship
  | 'utility';        // General utility synergy

export interface SynergyGraph {
  edges: SynergyEdge[];
  nodes: Set<string>;        // All card names in the graph
  adjacencyList: Map<string, SynergyEdge[]>; // Quick lookup
}

export interface DeckCohesion {
  overallCohesion: number;      // 0-10, how well deck fits together
  synergyDensity: number;       // Average synergies per card
  clusteringCoefficient: number; // How interconnected synergies are
  criticalPaths: string[][];     // Important synergy chains
  weakestLinks: string[];       // Cards with fewest synergies
  synergyBreakdown: {
    combo: number;
    tribal: number;
    thematic: number;
    utility: number;
    protection: number;
  };
}

export class SynergyAnalyzer {
  
  /**
   * Build synergy graph from a set of cards
   */
  buildSynergyGraph(
    cards: CandidateCard[], 
    commander: ScryfallCard,
    profile: CommanderProfile
  ): SynergyGraph {
    
    const edges: SynergyEdge[] = [];
    const nodes = new Set<string>();
    
    // Add commander as a node
    nodes.add(commander.name);
    
    // Add all cards as nodes
    cards.forEach(card => nodes.add(card.name));
    
    // Calculate synergies between all pairs of cards
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const cardA = cards[i];
        const cardB = cards[j];
        
        const synergies = this.calculatePairSynergy(cardA, cardB, profile);
        edges.push(...synergies);
      }
      
      // Calculate synergies with commander
      const commanderSynergies = this.calculateCommanderSynergy(cards[i], commander, profile);
      edges.push(...commanderSynergies);
    }
    
    // Build adjacency list for quick lookup
    const adjacencyList = new Map<string, SynergyEdge[]>();
    for (const node of nodes) {
      adjacencyList.set(node, []);
    }
    
    for (const edge of edges) {
      adjacencyList.get(edge.cardA)?.push(edge);
      if (edge.bidirectional) {
        adjacencyList.get(edge.cardB)?.push({
          ...edge,
          cardA: edge.cardB,
          cardB: edge.cardA
        });
      }
    }
    
    return {
      edges,
      nodes,
      adjacencyList
    };
  }
  
  /**
   * Calculate synergy between two cards
   */
  private calculatePairSynergy(
    cardA: CandidateCard, 
    cardB: CandidateCard, 
    profile: CommanderProfile
  ): SynergyEdge[] {
    
    const synergies: SynergyEdge[] = [];
    
    // Combo detection
    const comboSynergy = this.detectComboSynergy(cardA, cardB);
    if (comboSynergy) synergies.push(comboSynergy);
    
    // Amplification detection (A makes B better)
    const amplificationSynergy = this.detectAmplificationSynergy(cardA, cardB);
    if (amplificationSynergy) synergies.push(amplificationSynergy);
    
    // Enablement detection (A enables B)
    const enablementSynergy = this.detectEnablementSynergy(cardA, cardB);
    if (enablementSynergy) synergies.push(enablementSynergy);
    
    // Protection detection
    const protectionSynergy = this.detectProtectionSynergy(cardA, cardB);
    if (protectionSynergy) synergies.push(protectionSynergy);
    
    // Recursion detection
    const recursionSynergy = this.detectRecursionSynergy(cardA, cardB);
    if (recursionSynergy) synergies.push(recursionSynergy);
    
    // Tutor detection
    const tutorSynergy = this.detectTutorSynergy(cardA, cardB);
    if (tutorSynergy) synergies.push(tutorSynergy);
    
    // Tribal detection
    const tribalSynergy = this.detectTribalSynergy(cardA, cardB, profile);
    if (tribalSynergy) synergies.push(tribalSynergy);
    
    // Thematic detection
    const thematicSynergy = this.detectThematicSynergy(cardA, cardB, profile);
    if (thematicSynergy) synergies.push(thematicSynergy);
    
    // Curve synergy
    const curveSynergy = this.detectCurveSynergy(cardA, cardB);
    if (curveSynergy) synergies.push(curveSynergy);
    
    return synergies;
  }
  
  /**
   * Calculate synergy between card and commander
   */
  private calculateCommanderSynergy(
    card: CandidateCard, 
    commander: ScryfallCard, 
    profile: CommanderProfile
  ): SynergyEdge[] {
    
    const synergies: SynergyEdge[] = [];
    
    // Commander-specific synergies based on profile tags
    for (const tag of profile.tags) {
      const tagSynergy = this.detectTagSynergy(card, commander, tag);
      if (tagSynergy) synergies.push(tagSynergy);
    }
    
    // General commander synergies
    const generalSynergy = this.detectGeneralCommanderSynergy(card, commander);
    if (generalSynergy) synergies.push(generalSynergy);
    
    return synergies;
  }
  
  /**
   * Detect combo synergies between cards
   */
  private detectComboSynergy(cardA: CandidateCard, cardB: CandidateCard): SynergyEdge | null {
    const textA = (cardA.oracle_text || '').toLowerCase();
    const textB = (cardB.oracle_text || '').toLowerCase();
    
    // Infinite combo patterns
    if (textA.includes('untap') && textB.includes('tap') && textB.includes('add')) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'combo',
        strength: 9,
        description: 'Infinite mana combo',
        bidirectional: true
      };
    }
    
    // Flicker combo
    if ((textA.includes('exile') && textA.includes('return')) && 
        (textB.includes('enters the battlefield') || textB.includes('etb'))) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'combo',
        strength: 7,
        description: 'Flicker combo for repeated ETB triggers',
        bidirectional: false
      };
    }
    
    // Sacrifice + recursion combo
    if (textA.includes('sacrifice') && 
        (textB.includes('return') && textB.includes('graveyard'))) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'combo',
        strength: 8,
        description: 'Sacrifice and recursion engine',
        bidirectional: true
      };
    }
    
    return null;
  }
  
  /**
   * Detect amplification synergies (A makes B better)
   */
  private detectAmplificationSynergy(cardA: CandidateCard, cardB: CandidateCard): SynergyEdge | null {
    const textA = (cardA.oracle_text || '').toLowerCase();
    const textB = (cardB.oracle_text || '').toLowerCase();
    const typeB = cardB.type_line.toLowerCase();
    
    // Damage amplification
    if (textA.includes('double') && textA.includes('damage') && 
        (textB.includes('damage') || textB.includes('ping'))) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'amplifies',
        strength: 8,
        description: 'Damage amplification',
        bidirectional: false
      };
    }
    
    // Token amplification
    if ((textA.includes('double') || textA.includes('parallel')) && textA.includes('token') && 
        textB.includes('token')) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'amplifies',
        strength: 9,
        description: 'Token doubling',
        bidirectional: false
      };
    }
    
    // Cost reduction
    if (textA.includes('cost') && textA.includes('less') && 
        (typeB.includes('instant') || typeB.includes('sorcery') || typeB.includes('artifact'))) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'amplifies',
        strength: 6,
        description: 'Cost reduction',
        bidirectional: false
      };
    }
    
    // Anthem effects for creatures
    if (textA.includes('creatures you control get +') && typeB.includes('creature')) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'amplifies',
        strength: 5,
        description: 'Anthem effect',
        bidirectional: false
      };
    }
    
    return null;
  }
  
  /**
   * Detect enablement synergies (A enables B to work)
   */
  private detectEnablementSynergy(cardA: CandidateCard, cardB: CandidateCard): SynergyEdge | null {
    const textA = (cardA.oracle_text || '').toLowerCase();
    const textB = (cardB.oracle_text || '').toLowerCase();
    
    // Ramp enables expensive cards
    if ((textA.includes('add') && textA.includes('mana')) && cardB.cmc >= 6) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'enables',
        strength: 5,
        description: 'Ramp enables expensive spell',
        bidirectional: false
      };
    }
    
    // Card draw enables hand-size matters
    if (textA.includes('draw') && textA.includes('card') && 
        (textB.includes('hand') || textB.includes('cards in hand'))) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'enables',
        strength: 7,
        description: 'Card draw enables hand-size synergy',
        bidirectional: false
      };
    }
    
    // Graveyard filling enables graveyard strategies
    if ((textA.includes('mill') || textA.includes('discard')) && 
        (textB.includes('graveyard') && textB.includes('return'))) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'enables',
        strength: 8,
        description: 'Graveyard setup enables recursion',
        bidirectional: false
      };
    }
    
    return null;
  }
  
  /**
   * Detect protection synergies
   */
  private detectProtectionSynergy(cardA: CandidateCard, cardB: CandidateCard): SynergyEdge | null {
    const textA = (cardA.oracle_text || '').toLowerCase();
    const typeB = cardB.type_line.toLowerCase();
    
    // Hexproof/shroud protection
    if ((textA.includes('hexproof') || textA.includes('shroud')) && 
        typeB.includes('creature')) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'protects',
        strength: 7,
        description: 'Hexproof protection',
        bidirectional: false
      };
    }
    
    // Counterspell protection
    if (textA.includes('counter target spell') && 
        (cardB.cmc >= 4 || typeB.includes('planeswalker'))) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'protects',
        strength: 6,
        description: 'Counterspell protection for key piece',
        bidirectional: false
      };
    }
    
    // Indestructible protection
    if (textA.includes('indestructible') && typeB.includes('creature')) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'protects',
        strength: 8,
        description: 'Indestructible protection',
        bidirectional: false
      };
    }
    
    return null;
  }
  
  /**
   * Detect recursion synergies
   */
  private detectRecursionSynergy(cardA: CandidateCard, cardB: CandidateCard): SynergyEdge | null {
    const textA = (cardA.oracle_text || '').toLowerCase();
    const typeB = cardB.type_line.toLowerCase();
    
    // Return from graveyard
    if (textA.includes('return') && textA.includes('graveyard') && 
        (typeB.includes('creature') || typeB.includes('artifact') || typeB.includes('enchantment'))) {
      const strength = textA.includes('battlefield') ? 9 : 7; // Battlefield > hand
      
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'recurses',
        strength,
        description: 'Graveyard recursion',
        bidirectional: false
      };
    }
    
    return null;
  }
  
  /**
   * Detect tutor synergies
   */
  private detectTutorSynergy(cardA: CandidateCard, cardB: CandidateCard): SynergyEdge | null {
    const textA = (cardA.oracle_text || '').toLowerCase();
    const typeB = cardB.type_line.toLowerCase();
    
    // Tutor effects
    if (textA.includes('search your library for')) {
      let strength = 6;
      let description = 'Tutor effect';
      
      // Specific tutors
      if (textA.includes('creature') && typeB.includes('creature')) {
        strength = 8;
        description = 'Creature tutor';
      } else if (textA.includes('instant') && typeB.includes('instant')) {
        strength = 8;
        description = 'Instant tutor';
      } else if (textA.includes('artifact') && typeB.includes('artifact')) {
        strength = 8;
        description = 'Artifact tutor';
      } else if (textA.includes('any card')) {
        strength = 9;
        description = 'Universal tutor';
      }
      
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'tutors',
        strength,
        description,
        bidirectional: false
      };
    }
    
    return null;
  }
  
  /**
   * Detect tribal synergies
   */
  private detectTribalSynergy(
    cardA: CandidateCard, 
    cardB: CandidateCard, 
    profile: CommanderProfile
  ): SynergyEdge | null {
    
    const tribalTags = profile.tags.filter(tag => tag.name.includes('_tribal'));
    if (tribalTags.length === 0) return null;
    
    const typeA = cardA.type_line.toLowerCase();
    const typeB = cardB.type_line.toLowerCase();
    const textA = (cardA.oracle_text || '').toLowerCase();
    
    // Check if both cards share tribal type
    for (const tag of tribalTags) {
      const tribe = tag.name.replace('_tribal', '');
      
      if ((typeA.includes(tribe) || textA.includes(tribe)) && typeB.includes(tribe)) {
        return {
          cardA: cardA.name,
          cardB: cardB.name,
          synergyType: 'tribal',
          strength: Math.round(tag.priority * 0.8),
          description: `${tribe} tribal synergy`,
          bidirectional: true
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect thematic synergies based on archetypes
   */
  private detectThematicSynergy(
    cardA: CandidateCard, 
    cardB: CandidateCard, 
    profile: CommanderProfile
  ): SynergyEdge | null {
    
    // Check if both cards fit the same archetype
    const archetypes = [profile.primaryArchetype, ...profile.secondaryArchetypes];
    
    for (const archetype of archetypes) {
      const aFits = this.cardFitsArchetype(cardA, archetype);
      const bFits = this.cardFitsArchetype(cardB, archetype);
      
      if (aFits && bFits) {
        return {
          cardA: cardA.name,
          cardB: cardB.name,
          synergyType: 'thematic',
          strength: 5,
          description: `${archetype} archetype synergy`,
          bidirectional: true
        };
      }
    }
    
    return null;
  }
  
  /**
   * Detect curve synergies
   */
  private detectCurveSynergy(cardA: CandidateCard, cardB: CandidateCard): SynergyEdge | null {
    const cmcDiff = Math.abs(cardA.cmc - cardB.cmc);
    
    // Good curve progression (1-2 CMC difference)
    if (cmcDiff === 1 || cmcDiff === 2) {
      return {
        cardA: cardA.name,
        cardB: cardB.name,
        synergyType: 'curve',
        strength: 3,
        description: 'Good curve progression',
        bidirectional: true
      };
    }
    
    return null;
  }
  
  /**
   * Detect tag-specific synergies with commander
   */
  private detectTagSynergy(
    card: CandidateCard, 
    commander: ScryfallCard, 
    tag: any
  ): SynergyEdge | null {
    
    const cardText = (card.oracle_text || '').toLowerCase();
    
    // Tag-specific synergy detection
    switch (tag.name) {
      case 'tokens':
        if (cardText.includes('token')) {
          return {
            cardA: card.name,
            cardB: commander.name,
            synergyType: 'thematic',
            strength: tag.priority,
            description: 'Token strategy synergy',
            bidirectional: true
          };
        }
        break;
        
      case 'landfall':
        if (cardText.includes('landfall') || (cardText.includes('land') && cardText.includes('enters'))) {
          return {
            cardA: card.name,
            cardB: commander.name,
            synergyType: 'thematic',
            strength: tag.priority,
            description: 'Landfall synergy',
            bidirectional: true
          };
        }
        break;
        
      case 'spellslinger':
        if (cardText.includes('instant') || cardText.includes('sorcery')) {
          return {
            cardA: card.name,
            cardB: commander.name,
            synergyType: 'thematic',
            strength: tag.priority,
            description: 'Spellslinger synergy',
            bidirectional: true
          };
        }
        break;
    }
    
    return null;
  }
  
  /**
   * Detect general commander synergies
   */
  private detectGeneralCommanderSynergy(
    card: CandidateCard, 
    commander: ScryfallCard
  ): SynergyEdge | null {
    
    const cardText = (card.oracle_text || '').toLowerCase();
    const commanderText = (commander.oracle_text || '').toLowerCase();
    
    // Protection for commander
    if ((cardText.includes('hexproof') || cardText.includes('shroud')) && 
        commander.type_line.includes('Creature')) {
      return {
        cardA: card.name,
        cardB: commander.name,
        synergyType: 'protects',
        strength: 8,
        description: 'Protects commander',
        bidirectional: false
      };
    }
    
    // Equipment/Aura synergy with creature commanders
    if ((card.type_line.includes('Equipment') || card.type_line.includes('Aura')) && 
        commander.type_line.includes('Creature')) {
      return {
        cardA: card.name,
        cardB: commander.name,
        synergyType: 'amplifies',
        strength: 7,
        description: 'Equipment/Aura synergy with commander',
        bidirectional: false
      };
    }
    
    return null;
  }
  
  /**
   * Calculate deck cohesion metrics
   */
  calculateDeckCohesion(graph: SynergyGraph, cards: CandidateCard[]): DeckCohesion {
    const totalCards = cards.length + 1; // +1 for commander
    const totalEdges = graph.edges.length;
    
    // Synergy density: average synergies per card
    const synergyDensity = totalEdges / totalCards;
    
    // Calculate synergy breakdown by type
    const synergyBreakdown = {
      combo: 0,
      tribal: 0,
      thematic: 0,
      utility: 0,
      protection: 0
    };
    
    graph.edges.forEach(edge => {
      switch (edge.synergyType) {
        case 'combo':
          synergyBreakdown.combo += edge.strength;
          break;
        case 'tribal':
          synergyBreakdown.tribal += edge.strength;
          break;
        case 'thematic':
          synergyBreakdown.thematic += edge.strength;
          break;
        case 'protects':
          synergyBreakdown.protection += edge.strength;
          break;
        default:
          synergyBreakdown.utility += edge.strength;
      }
    });
    
    // Normalize breakdown by total edges
    Object.keys(synergyBreakdown).forEach(key => {
      synergyBreakdown[key as keyof typeof synergyBreakdown] = 
        synergyBreakdown[key as keyof typeof synergyBreakdown] / Math.max(1, totalEdges);
    });
    
    // Calculate clustering coefficient (how interconnected the synergies are)
    const clusteringCoefficient = this.calculateClusteringCoefficient(graph);
    
    // Find critical paths (chains of high-strength synergies)
    const criticalPaths = this.findCriticalPaths(graph);
    
    // Find weakest links (cards with fewest synergies)
    const weakestLinks = this.findWeakestLinks(graph, cards);
    
    // Overall cohesion score
    const overallCohesion = Math.min(10, 
      synergyDensity * 2 +           // Density weight
      clusteringCoefficient * 3 +    // Clustering weight
      (totalEdges > 20 ? 2 : 1)      // Bonus for having many synergies
    );
    
    return {
      overallCohesion,
      synergyDensity,
      clusteringCoefficient,
      criticalPaths,
      weakestLinks,
      synergyBreakdown
    };
  }
  
  private calculateClusteringCoefficient(graph: SynergyGraph): number {
    let totalTriangles = 0;
    let totalPossibleTriangles = 0;
    
    // For each node, count triangles it participates in
    for (const node of graph.nodes) {
      const neighbors = graph.adjacencyList.get(node) || [];
      const neighborNames = neighbors.map(edge => edge.cardB);
      
      // Check all pairs of neighbors to see if they're connected
      for (let i = 0; i < neighborNames.length; i++) {
        for (let j = i + 1; j < neighborNames.length; j++) {
          totalPossibleTriangles++;
          
          const neighA = neighborNames[i];
          const neighB = neighborNames[j];
          const neighAEdges = graph.adjacencyList.get(neighA) || [];
          
          if (neighAEdges.some(edge => edge.cardB === neighB)) {
            totalTriangles++;
          }
        }
      }
    }
    
    return totalPossibleTriangles > 0 ? totalTriangles / totalPossibleTriangles : 0;
  }
  
  private findCriticalPaths(graph: SynergyGraph): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();
    
    // Find paths of high-strength synergies (strength >= 7)
    for (const edge of graph.edges) {
      if (edge.strength >= 7 && !visited.has(edge.cardA)) {
        const path = this.traceSynergyPath(graph, edge.cardA, visited, 7);
        if (path.length >= 3) { // Only keep paths with 3+ cards
          paths.push(path);
        }
      }
    }
    
    return paths.slice(0, 5); // Return top 5 critical paths
  }
  
  private traceSynergyPath(
    graph: SynergyGraph, 
    startNode: string, 
    visited: Set<string>, 
    minStrength: number
  ): string[] {
    
    const path = [startNode];
    visited.add(startNode);
    
    const edges = graph.adjacencyList.get(startNode) || [];
    const highStrengthEdges = edges.filter(edge => 
      edge.strength >= minStrength && !visited.has(edge.cardB)
    );
    
    if (highStrengthEdges.length > 0) {
      // Follow the strongest synergy
      const bestEdge = highStrengthEdges.reduce((best, edge) => 
        edge.strength > best.strength ? edge : best
      );
      
      const continuedPath = this.traceSynergyPath(graph, bestEdge.cardB, visited, minStrength);
      path.push(...continuedPath.slice(1)); // Avoid duplicating the connection point
    }
    
    return path;
  }
  
  private findWeakestLinks(graph: SynergyGraph, cards: CandidateCard[]): string[] {
    const synergyCount = new Map<string, number>();
    
    // Count synergies for each card
    for (const card of cards) {
      synergyCount.set(card.name, 0);
    }
    
    for (const edge of graph.edges) {
      synergyCount.set(edge.cardA, (synergyCount.get(edge.cardA) || 0) + 1);
      if (edge.bidirectional) {
        synergyCount.set(edge.cardB, (synergyCount.get(edge.cardB) || 0) + 1);
      }
    }
    
    // Find cards with fewest synergies
    const sorted = Array.from(synergyCount.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(0, 5) // Top 5 weakest
      .map(([name, _]) => name);
    
    return sorted;
  }
  
  private cardFitsArchetype(card: CandidateCard, archetype: string): boolean {
    const text = (card.oracle_text || '').toLowerCase();
    const type = card.type_line.toLowerCase();
    
    switch (archetype) {
      case 'tokens':
        return text.includes('token') || text.includes('create');
      case 'spellslinger':
        return text.includes('instant') || text.includes('sorcery') || text.includes('noncreature spell');
      case 'artifacts':
        return type.includes('artifact') || text.includes('artifact');
      case 'voltron':
        return text.includes('equip') || text.includes('aura') || type.includes('equipment');
      case 'aristocrats':
        return text.includes('sacrifice') || text.includes('dies') || text.includes('death');
      case 'tribal':
        return type.includes('creature');
      case 'ramp':
        return text.includes('land') || (text.includes('add') && text.includes('mana'));
      default:
        return false;
    }
  }
}

export const synergyAnalyzer = new SynergyAnalyzer();
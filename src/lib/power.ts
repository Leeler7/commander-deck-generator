import { PowerLevelConfig, DeckComposition } from './types';

// Based on EDH community conventions and competitive analysis
export const POWER_LEVEL_CONFIGS: Record<number, PowerLevelConfig> = {
  1: {
    tutors_allowed: 0,
    fast_mana_allowed: false,
    combo_tolerance: 'none',
    avg_mv_target: 3.8, // Very casual - slow games
    interaction_density: 0.12,
    deck_composition: {
      lands: 38, // Higher for casual
      ramp: 10, // Light ramp package  
      draw: 8, // Conservative card draw
      removal: 5, // Minimal removal
      board_wipes: 2, // Few wipes
      tutors: 0,
      protection: 2, // Light protection
      synergy: 34 // Lots of theme cards
    }
  },
  2: {
    tutors_allowed: 0,
    fast_mana_allowed: false,
    combo_tolerance: 'none',
    avg_mv_target: 3.6,
    interaction_density: 0.15,
    deck_composition: {
      lands: 37,
      ramp: 11,
      draw: 9,
      removal: 6,
      board_wipes: 2,
      tutors: 0,
      protection: 3,
      synergy: 31
    }
  },
  3: {
    tutors_allowed: 1,
    fast_mana_allowed: false,
    combo_tolerance: 'soft',
    avg_mv_target: 3.4,
    interaction_density: 0.18,
    deck_composition: {
      lands: 37,
      ramp: 12,
      draw: 10,
      removal: 7,
      board_wipes: 3,
      tutors: 1,
      protection: 3,
      synergy: 26
    }
  },
  4: {
    tutors_allowed: 2,
    fast_mana_allowed: false,
    combo_tolerance: 'soft',
    avg_mv_target: 3.2,
    interaction_density: 0.20,
    deck_composition: {
      lands: 36,
      ramp: 12,
      draw: 11,
      removal: 8,
      board_wipes: 3,
      tutors: 2,
      protection: 3,
      synergy: 24
    }
  },
  5: {
    tutors_allowed: 3,
    fast_mana_allowed: false, // Sol Ring only
    combo_tolerance: 'soft',
    avg_mv_target: 3.0,
    interaction_density: 0.22,
    deck_composition: {
      lands: 36,
      ramp: 13,
      draw: 11,
      removal: 8,
      board_wipes: 3,
      tutors: 3,
      protection: 4,
      synergy: 21
    }
  },
  6: {
    tutors_allowed: 4,
    fast_mana_allowed: true, // Sol Ring + some fast mana
    combo_tolerance: 'open',
    avg_mv_target: 2.8, // High-power starts here
    interaction_density: 0.25,
    deck_composition: {
      lands: 35,
      ramp: 14,
      draw: 12,
      removal: 9,
      board_wipes: 4,
      tutors: 4,
      protection: 4,
      synergy: 17
    }
  },
  7: {
    tutors_allowed: 5,
    fast_mana_allowed: true,
    combo_tolerance: 'open',
    avg_mv_target: 2.6,
    interaction_density: 0.28,
    deck_composition: {
      lands: 34,
      ramp: 15,
      draw: 13,
      removal: 10,
      board_wipes: 4,
      tutors: 5,
      protection: 4,
      synergy: 14
    }
  },
  8: {
    tutors_allowed: 6,
    fast_mana_allowed: true,
    combo_tolerance: 'open',
    avg_mv_target: 2.4,
    interaction_density: 0.32,
    deck_composition: {
      lands: 33,
      ramp: 16,
      draw: 14,
      removal: 11,
      board_wipes: 4,
      tutors: 6,
      protection: 4,
      synergy: 11
    }
  },
  9: {
    tutors_allowed: 8,
    fast_mana_allowed: true,
    combo_tolerance: 'open',
    avg_mv_target: 2.2,
    interaction_density: 0.36,
    deck_composition: {
      lands: 32,
      ramp: 17,
      draw: 15,
      removal: 12,
      board_wipes: 3,
      tutors: 8,
      protection: 4,
      synergy: 8
    }
  },
  10: {
    tutors_allowed: 12, // cEDH level - many tutors for consistency
    fast_mana_allowed: true,
    combo_tolerance: 'open',
    avg_mv_target: 2.0, // cEDH avg MV ≤2.2 per guide
    interaction_density: 0.40,
    deck_composition: {
      lands: 31, // Minimal lands, maximum efficiency
      ramp: 18, // 16-20 in cEDH per guide
      draw: 16, // Heavy card selection
      removal: 13, // Lots of interaction
      board_wipes: 2, // Few wipes in cEDH
      tutors: 12, // Consistency is paramount in cEDH
      protection: 4,
      synergy: 3 // Minimal synergy, maximum efficiency
    }
  }
};

export function getPowerLevelConfig(powerLevel: number): PowerLevelConfig {
  const clampedLevel = Math.max(1, Math.min(10, Math.round(powerLevel)));
  return POWER_LEVEL_CONFIGS[clampedLevel];
}

// Based on guide: -1 land for every 2 ramp sources, adjust for colors and curve
export function adjustDeckCompositionForCommander(
  baseComposition: DeckComposition,
  commanderCmc: number,
  commanderColorIdentity: string[]
): DeckComposition {
  const adjusted = { ...baseComposition };
  const colorCount = commanderColorIdentity.length;
  
  // Guide: Start at baseline, then adjust
  let landAdjustment = 0;
  let rampAdjustment = 0;
  
  // Adjust for color identity (more colors = more fixing needed)
  if (colorCount >= 5) {
    // Five-color: need more fixing
    landAdjustment += 2;
    rampAdjustment += 2; // More ramp for fixing
  } else if (colorCount >= 4) {
    landAdjustment += 1;
    rampAdjustment += 1;
  } else if (colorCount >= 3) {
    rampAdjustment += 1; // 3-color needs fixing
  } else if (colorCount === 1) {
    // Mono-color can run fewer lands
    landAdjustment -= 1;
  }
  
  // Adjust for commander CMC (high curve needs more ramp)
  if (commanderCmc >= 7) {
    rampAdjustment += 3; // Expensive commanders need lots of ramp
    landAdjustment += 1;
  } else if (commanderCmc >= 5) {
    rampAdjustment += 2;
  } else if (commanderCmc >= 4) {
    rampAdjustment += 1;
  } else if (commanderCmc <= 2) {
    // Cheap commanders need less ramp
    rampAdjustment -= 1;
    landAdjustment -= 1;
  }
  
  // Apply adjustments
  adjusted.lands += landAdjustment;
  adjusted.ramp += rampAdjustment;
  
  // Guide rule: -1 land for every 2 ramp sources above baseline
  const rampAboveBaseline = Math.max(0, adjusted.ramp - 12);
  const landsToReduce = Math.floor(rampAboveBaseline / 2);
  adjusted.lands -= landsToReduce;
  
  // Adjust synergy to maintain 99 total
  const totalOtherCards = adjusted.lands + adjusted.ramp + 
    adjusted.draw + adjusted.removal + adjusted.board_wipes + 
    adjusted.tutors + adjusted.protection;
  
  adjusted.synergy = 99 - totalOtherCards;
  
  // Ensure reasonable bounds
  adjusted.lands = Math.max(30, Math.min(42, adjusted.lands));
  adjusted.ramp = Math.max(8, Math.min(20, adjusted.ramp));
  adjusted.synergy = Math.max(3, adjusted.synergy);
  
  return adjusted;
}

export function calculateInteractionSuite(
  powerLevel: number,
  colorIdentity: string[]
): {
  spot_removal: number;
  board_wipes: number;
  counterspells: number;
  protection: number;
} {
  const config = getPowerLevelConfig(powerLevel);
  const hasBlue = colorIdentity.includes('U');
  const hasWhite = colorIdentity.includes('W');
  const hasBlack = colorIdentity.includes('B');
  const hasRed = colorIdentity.includes('R');
  
  const totalInteraction = Math.round(99 * config.interaction_density);
  
  let spot_removal = Math.floor(totalInteraction * 0.6);
  let board_wipes = Math.floor(totalInteraction * 0.2);
  let counterspells = hasBlue ? Math.floor(totalInteraction * 0.15) : 0;
  let protection = Math.floor(totalInteraction * 0.05);
  
  // Adjust based on color access
  if (hasWhite) {
    board_wipes += 1; // White gets more board wipes
    spot_removal -= 1;
  }
  
  if (hasBlack) {
    spot_removal += 1; // Black gets more targeted removal
  }
  
  if (hasRed) {
    if (!hasWhite) {
      // Red needs damage-based removal in non-white decks
      spot_removal += 1;
    }
  }
  
  if (hasBlue && powerLevel >= 6) {
    counterspells += 1; // More counterspells at higher power
    spot_removal -= 1;
  }
  
  return {
    spot_removal: Math.max(1, spot_removal),
    board_wipes: Math.max(hasWhite ? 1 : 0, board_wipes),
    counterspells: Math.max(0, counterspells),
    protection: Math.max(0, protection)
  };
}

export function getTutorSuite(powerLevel: number, colorIdentity: string[]): string[] {
  const config = getPowerLevelConfig(powerLevel);
  const tutors: string[] = [];
  
  if (config.tutors_allowed === 0) return tutors;
  
  const hasBlack = colorIdentity.includes('B');
  const hasGreen = colorIdentity.includes('G');
  const hasWhite = colorIdentity.includes('W');
  const hasBlue = colorIdentity.includes('U');
  
  // Priority order for tutors based on power level and colors
  const tutorPriorities = [
    // Green tutors (generally more fair)
    { name: 'Worldly Tutor', colors: ['G'], power_min: 5 },
    { name: 'Green Sun\'s Zenith', colors: ['G'], power_min: 6 },
    { name: 'Chord of Calling', colors: ['G'], power_min: 6 },
    { name: 'Natural Order', colors: ['G'], power_min: 7 },
    
    // White tutors
    { name: 'Enlightened Tutor', colors: ['W'], power_min: 6 },
    { name: 'Idyllic Tutor', colors: ['W'], power_min: 5 },
    
    // Blue tutors
    { name: 'Mystical Tutor', colors: ['U'], power_min: 7 },
    { name: 'Personal Tutor', colors: ['U'], power_min: 6 },
    
    // Black tutors (most powerful)
    { name: 'Vampiric Tutor', colors: ['B'], power_min: 7 },
    { name: 'Diabolic Tutor', colors: ['B'], power_min: 5 },
    { name: 'Demonic Tutor', colors: ['B'], power_min: 8 },
    { name: 'Imperial Seal', colors: ['B'], power_min: 9 },
    
    // Generic tutors
    { name: 'Gamble', colors: ['R'], power_min: 6 },
    { name: 'Scheming Symmetry', colors: ['B'], power_min: 5 }
  ];
  
  let tutorsAdded = 0;
  for (const tutor of tutorPriorities) {
    if (tutorsAdded >= config.tutors_allowed) break;
    
    if (powerLevel >= tutor.power_min && 
        tutor.colors.some(color => colorIdentity.includes(color))) {
      tutors.push(tutor.name);
      tutorsAdded++;
    }
  }
  
  return tutors;
}

export function getFastManaSuite(powerLevel: number, allowFastMana: boolean): string[] {
  if (!allowFastMana) {
    return ['Sol Ring']; // Sol Ring is almost always acceptable
  }
  
  const fastMana: string[] = ['Sol Ring'];
  
  if (powerLevel >= 6) {
    fastMana.push('Arcane Signet');
  }
  
  if (powerLevel >= 7) {
    fastMana.push('Mana Crypt');
  }
  
  if (powerLevel >= 8) {
    fastMana.push('Mana Vault', 'Chrome Mox');
  }
  
  if (powerLevel >= 9) {
    fastMana.push('Mox Diamond', 'Jeweled Lotus');
  }
  
  return fastMana;
}

export function getPowerLevelDescription(powerLevel: number): {
  name: string;
  description: string;
  characteristics: string[];
} {
  const descriptions = {
    1: {
      name: 'Casual/Precon',
      description: 'Preconstructed deck power level with minimal optimization',
      characteristics: ['No tutors', 'No fast mana', 'High mana curve', 'Basic synergies']
    },
    2: {
      name: 'Casual+',
      description: 'Slightly upgraded precon with some improvements',
      characteristics: ['Better mana base', 'Some staples', 'Focused theme', 'Still casual pace']
    },
    3: {
      name: 'Focused Casual',
      description: 'Cohesive strategy with good card choices',
      characteristics: ['Clear game plan', 'Efficient removal', 'Some expensive cards', 'Soft synergies']
    },
    4: {
      name: 'Optimized Casual',
      description: 'Well-tuned deck with strong synergies',
      characteristics: ['Consistent strategy', 'Quality mana base', 'Efficient spells', 'Good card draw']
    },
    5: {
      name: 'Mid Power',
      description: 'Competitive casual with some powerful effects',
      characteristics: ['Some tutors', 'Efficient threats', 'Strong interaction', 'Focused win conditions']
    },
    6: {
      name: 'Focused/Tuned',
      description: 'Highly synergistic with powerful cards',
      characteristics: ['Multiple tutors', 'Fast mana', 'Low curve', 'Consistent execution']
    },
    7: {
      name: 'High Power',
      description: 'Competitive deck with strong plays',
      characteristics: ['Efficient combos', 'Strong interaction suite', 'Fast wins possible', 'Optimized mana']
    },
    8: {
      name: 'Very High Power',
      description: 'Near-cEDH with powerful interactions',
      characteristics: ['Multiple win lines', 'Dense interaction', 'Fast mana package', 'Consistent turn 4-6 wins']
    },
    9: {
      name: 'Fringe cEDH',
      description: 'Competitive viable but not tier 1',
      characteristics: ['cEDH viable', 'Multiple tutors', 'Full fast mana', 'Turn 3-4 wins possible']
    },
    10: {
      name: 'cEDH',
      description: 'Maximum power competitive play',
      characteristics: ['Tier 1 competitive', 'All available tutors', 'Turn 1-3 wins', 'Maximum efficiency']
    }
  };
  
  const level = Math.max(1, Math.min(10, Math.round(powerLevel)));
  return descriptions[level as keyof typeof descriptions];
}
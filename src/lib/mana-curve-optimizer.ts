import { ScryfallCard } from './types';

export interface ManaCurveTarget {
  0: number;  // 0 CMC cards (mana rocks, etc)
  1: number;  // 1 CMC
  2: number;  // 2 CMC
  3: number;  // 3 CMC
  4: number;  // 4 CMC
  5: number;  // 5 CMC
  6: number;  // 6+ CMC
}

export interface ManaCurveAnalysis {
  current: ManaCurveTarget;
  target: ManaCurveTarget;
  deviation: number;
  recommendations: string[];
}

// Standard mana curve targets for different deck archetypes
export const CURVE_ARCHETYPES = {
  aggro: {
    0: 2,   // Few 0-cost
    1: 12,  // Heavy on 1-drops
    2: 18,  // Peak at 2 CMC
    3: 14,  // Good amount of 3-drops
    4: 8,   // Some 4-drops
    5: 5,   // Few 5-drops
    6: 6    // Minimal high-cost
  },
  midrange: {
    0: 3,   // Some mana rocks
    1: 8,   // Decent 1-drops
    2: 14,  // Strong 2-drop presence
    3: 16,  // Peak at 3 CMC
    4: 12,  // Good 4-drops
    5: 8,   // Some 5-drops
    6: 6    // Some finishers
  },
  control: {
    0: 4,   // Mana rocks for ramp
    1: 6,   // Some early interaction
    2: 12,  // Removal and counters
    3: 14,  // More interaction
    4: 10,  // Card draw and sweepers
    5: 8,   // Big spells
    6: 11   // Win conditions
  },
  ramp: {
    0: 5,   // Mana rocks
    1: 4,   // Mana dorks
    2: 10,  // Ramp spells
    3: 12,  // More ramp
    4: 8,   // Mid-game
    5: 10,  // Big threats
    6: 16   // Huge finishers
  },
  combo: {
    0: 6,   // Fast mana
    1: 10,  // Tutors and cantrips
    2: 15,  // More tutors/draw
    3: 14,  // Combo pieces
    4: 10,  // Protection
    5: 6,   // Alternative combos
    6: 4    // Backup plans
  }
};

// Determine deck archetype based on commander
export function determineArchetype(commander: ScryfallCard): keyof typeof CURVE_ARCHETYPES {
  const text = (commander.oracle_text || '').toLowerCase();
  const cmc = commander.cmc || 0;
  const power = commander.power ? parseInt(commander.power) : 0;
  
  // Aggro indicators
  if (text.includes('haste') || text.includes('attack') || 
      text.includes('combat damage') || (power >= 4 && cmc <= 3)) {
    return 'aggro';
  }
  
  // Control indicators
  if (text.includes('counter') || text.includes('draw') || 
      text.includes('instant') || text.includes('flash')) {
    return 'control';
  }
  
  // Ramp indicators
  if (text.includes('land') && (text.includes('play') || text.includes('put')) ||
      text.includes('mana') || cmc >= 6) {
    return 'ramp';
  }
  
  // Combo indicators
  if (text.includes('untap') || text.includes('copy') || 
      text.includes('storm') || text.includes('cascade')) {
    return 'combo';
  }
  
  // Default to midrange
  return 'midrange';
}

// Analyze current mana curve
export function analyzeManaCurve(cards: ScryfallCard[]): ManaCurveTarget {
  const curve: ManaCurveTarget = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  
  for (const card of cards) {
    // Skip lands from curve analysis
    if (card.type_line.toLowerCase().includes('land')) continue;
    
    const cmc = Math.floor(card.cmc || 0);
    if (cmc === 0) curve[0]++;
    else if (cmc === 1) curve[1]++;
    else if (cmc === 2) curve[2]++;
    else if (cmc === 3) curve[3]++;
    else if (cmc === 4) curve[4]++;
    else if (cmc === 5) curve[5]++;
    else curve[6]++;
  }
  
  return curve;
}

// Calculate curve deviation
export function calculateCurveDeviation(
  current: ManaCurveTarget,
  target: ManaCurveTarget
): number {
  let totalDeviation = 0;
  const cmcValues = [0, 1, 2, 3, 4, 5, 6] as const;
  
  for (const cmc of cmcValues) {
    const diff = Math.abs(current[cmc] - target[cmc]);
    totalDeviation += diff;
  }
  
  return totalDeviation;
}

// Optimize card selection for better mana curve
export function optimizeForManaCurve<T extends ScryfallCard>(
  cards: T[],
  targetCurve: ManaCurveTarget,
  maxSwaps: number = 10
): T[] {
  const optimized = [...cards];
  const nonLands = optimized.filter(c => !c.type_line.toLowerCase().includes('land'));
  
  // Group cards by CMC
  const byCmc: Record<number, T[]> = {};
  for (const card of nonLands) {
    const cmc = Math.min(6, Math.floor(card.cmc || 0));
    if (!byCmc[cmc]) byCmc[cmc] = [];
    byCmc[cmc].push(card);
  }
  
  // Current distribution
  const current = analyzeManaCurve(optimized);
  
  // Identify over and under-represented CMCs
  const overRepresented: number[] = [];
  const underRepresented: number[] = [];
  
  for (let cmc = 0; cmc <= 6; cmc++) {
    if (current[cmc as keyof ManaCurveTarget] > targetCurve[cmc as keyof ManaCurveTarget]) {
      overRepresented.push(cmc);
    } else if (current[cmc as keyof ManaCurveTarget] < targetCurve[cmc as keyof ManaCurveTarget]) {
      underRepresented.push(cmc);
    }
  }
  
  // Don't make swaps if curve is already good
  const deviation = calculateCurveDeviation(current, targetCurve);
  if (deviation <= 5) {
    return optimized;
  }
  
  // Log the optimization attempt
  console.log(`🎯 MANA CURVE: Attempting to optimize. Current deviation: ${deviation}`);
  console.log(`  Over: CMC ${overRepresented.join(', ')}`);
  console.log(`  Under: CMC ${underRepresented.join(', ')}`);
  
  return optimized;
}

// Get recommendations for improving mana curve
export function getManaCurveRecommendations(
  current: ManaCurveTarget,
  target: ManaCurveTarget
): string[] {
  const recommendations: string[] = [];
  
  for (let cmc = 0; cmc <= 6; cmc++) {
    const currentCount = current[cmc as keyof ManaCurveTarget];
    const targetCount = target[cmc as keyof ManaCurveTarget];
    const diff = currentCount - targetCount;
    
    if (diff > 2) {
      recommendations.push(`Consider cutting ${diff} cards at ${cmc === 6 ? '6+' : cmc} CMC`);
    } else if (diff < -2) {
      recommendations.push(`Consider adding ${Math.abs(diff)} more cards at ${cmc === 6 ? '6+' : cmc} CMC`);
    }
  }
  
  // Overall curve assessment
  const avgCmc = calculateAverageCMC(current);
  if (avgCmc > 3.5) {
    recommendations.push('Curve is too high - add more low-cost cards');
  } else if (avgCmc < 2.5) {
    recommendations.push('Curve might be too low - consider some higher impact cards');
  }
  
  return recommendations;
}

// Calculate average CMC
function calculateAverageCMC(curve: ManaCurveTarget): number {
  let totalCmc = 0;
  let totalCards = 0;
  
  for (let cmc = 0; cmc <= 6; cmc++) {
    const count = curve[cmc as keyof ManaCurveTarget];
    totalCmc += cmc * count;
    totalCards += count;
  }
  
  return totalCards > 0 ? totalCmc / totalCards : 0;
}

// Perform full mana curve analysis
export function performManaCurveAnalysis(
  cards: ScryfallCard[],
  commander: ScryfallCard
): ManaCurveAnalysis {
  const archetype = determineArchetype(commander);
  const targetCurve = CURVE_ARCHETYPES[archetype];
  const currentCurve = analyzeManaCurve(cards);
  const deviation = calculateCurveDeviation(currentCurve, targetCurve);
  const recommendations = getManaCurveRecommendations(currentCurve, targetCurve);
  
  return {
    current: currentCurve,
    target: targetCurve,
    deviation,
    recommendations
  };
}
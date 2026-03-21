/**
 * Structured Synergy Evaluator
 *
 * Given a CommanderProfile (computed once) and a candidate card's oracle text / type line,
 * produces a numeric score and human-readable reasons explaining WHY the card is (or isn't)
 * synergistic with this specific commander.
 *
 * This replaces the shallow keyword matching in engine-interaction.ts with a system
 * that understands MTG mechanical structure.
 */

import { CommanderProfile } from './commander-parser';

export interface SynergyEvaluation {
  score: number;
  reasons: string[];
}

// ────────────────────────────────────────────────────────────────────────────
// Self-reference detection
// ────────────────────────────────────────────────────────────────────────────

/** Returns true if a verb in the oracle text targets the card itself (not other permanents). */
function isSelfTarget(text: string, verb: string, cardName: string): boolean {
  const idx = text.indexOf(verb);
  if (idx === -1) return false;
  const after = text.slice(idx + verb.length, idx + verb.length + 50);
  const nameLower = cardName.toLowerCase();
  return after.includes(nameLower) || after.includes('~');
}

// ────────────────────────────────────────────────────────────────────────────
// Main evaluator
// ────────────────────────────────────────────────────────────────────────────

export function evaluateSynergy(
  profile: CommanderProfile,
  candidateOracle: string,
  candidateTypeLine: string,
  candidateName: string,
): SynergyEvaluation {
  const t = (candidateOracle || '').toLowerCase();
  const ty = (candidateTypeLine || '').toLowerCase();
  let score = 0;
  const reasons: string[] = [];

  const w = profile.wants;
  const p = profile.produces;

  // ── UNTAP EFFECTS ───────────────────────────────────────────────────────
  if (w.untapEffects) {
    const untapsFriendly =
      t.includes('untap target creature you control') ||
      t.includes('untap target permanent you control') ||
      t.includes('untap another target') ||
      t.includes('untap another creature') ||
      t.includes('untap all creatures you control') ||
      t.includes('untap each creature you control') ||
      t.includes('untap up to') ||
      t.includes('untap equipped') ||
      t.includes('untap enchanted');
    const selfUntap = isSelfTarget(t, 'untap ', candidateName);
    if (untapsFriendly && !selfUntap) {
      score += 25;
      reasons.push('Untaps commander for repeated activation');
    }
  }

  // ── HASTE ENABLERS ──────────────────────────────────────────────────────
  if (w.hasteEnablers) {
    // Grants haste to others (not just self)
    if (
      (t.includes('creatures you control') && t.includes('haste')) ||
      (t.includes('other creatures') && t.includes('haste')) ||
      (ty.includes('creature') && profile.relevantTypes.some(rt =>
        t.includes(rt.toLowerCase()) && t.includes('haste'),
      ))
    ) {
      score += 20;
      reasons.push('Grants haste for immediate commander activation');
    }
  }

  // ── TRIBAL PIECES ───────────────────────────────────────────────────────
  if (w.tribalPieces.length > 0) {
    for (const tribe of w.tribalPieces) {
      const tribeLower = tribe.toLowerCase();
      // Type line match: this creature IS a Goblin/Zombie/etc.
      if (ty.includes(tribeLower)) {
        score += 20;
        reasons.push(`${tribe} tribal — feeds commander scaling`);
        break; // Only score tribal once
      }
      // Oracle reference: "other Goblins", "each Goblin", lord effects
      const oracleTribalRe = new RegExp(
        `(?:other|each|all)\\s+${tribeLower}s?\\b|${tribeLower}s?\\s+(?:you control|creature)`,
        'i',
      );
      if (oracleTribalRe.test(t)) {
        score += 20;
        reasons.push(`${tribe} tribal synergy`);
        break;
      }
    }
  }

  // ── TOKEN PAYOFFS ───────────────────────────────────────────────────────
  if (w.tokenPayoffs) {
    // Triggers from tokens/creatures entering
    if (
      t.includes('whenever a creature enters') ||
      t.includes('whenever one or more creatures enter') ||
      t.includes('whenever a token') ||
      (t.includes('whenever another creature') && t.includes('enters'))
    ) {
      score += 20;
      reasons.push('Triggers from commander\'s token production');
    }
  }

  // ── SACRIFICE OUTLETS ───────────────────────────────────────────────────
  if (w.sacrificeOutlets) {
    // "Sacrifice a creature:" as an ACTIVATED COST (not effect)
    const isSacOutlet =
      t.includes('sacrifice a creature') ||
      t.includes('sacrifice another creature') ||
      t.includes('sacrifice any number') ||
      t.includes('sacrifice up to');
    const isSelfSac =
      isSelfTarget(t, 'sacrifice ', candidateName) &&
      !isSacOutlet;
    if (isSacOutlet && !isSelfSac) {
      score += 18;
      reasons.push('Converts commander\'s tokens into value');
    }
  }

  // ── ANTHEM EFFECTS ──────────────────────────────────────────────────────
  if (w.anthemEffects) {
    const isAnthem =
      (t.includes('creatures you control') && t.includes('get +')) ||
      (t.includes('tokens you control') && (t.includes('get +') || t.includes('haste') || t.includes('trample'))) ||
      (t.includes('creature tokens') && t.includes('get +'));
    // Type-specific anthem
    const isTribalAnthem = w.tribalPieces.some(tribe => {
      const tl = tribe.toLowerCase();
      return t.includes(`${tl}s you control get +`) ||
             t.includes(`${tl} creatures you control get +`) ||
             t.includes(`other ${tl}s`) && t.includes('get +');
    });
    if (isTribalAnthem) {
      score += 22;
      reasons.push('Tribal anthem — buffs commander\'s token output');
    } else if (isAnthem) {
      score += 18;
      reasons.push('Anthem effect — buffs commander\'s creatures');
    }
  }

  // ── ETB TRIGGERS ────────────────────────────────────────────────────────
  if (w.etkTriggers) {
    // Specifically death triggers (good with expendable tokens)
    if (
      t.includes('whenever a creature dies') ||
      t.includes('whenever another creature dies') ||
      t.includes('whenever a creature you control dies')
    ) {
      score += 15;
      reasons.push('Payoff for creatures dying (expendable tokens)');
    }
  }

  // ── GO-WIDE PAYOFFS ─────────────────────────────────────────────────────
  if (w.goWidePayoffs) {
    if (
      t.includes('for each creature you control') ||
      t.includes('equal to the number of creatures') ||
      t.includes('creatures you control deal') ||
      t.includes('for each token') ||
      t.includes('number of creatures') ||
      t.includes('populate')
    ) {
      score += 15;
      reasons.push('Scales with commander\'s board presence');
    }

    // Check for scaling with matching type
    if (p.tokens && p.tokens.tokenTypes.length > 0) {
      for (const tokenType of p.tokens.tokenTypes) {
        const typeLower = tokenType.toLowerCase();
        if (
          t.includes(`number of ${typeLower}s`) ||
          t.includes(`each ${typeLower}`) ||
          t.includes(`for each ${typeLower}`)
        ) {
          score += 15;
          reasons.push(`Scales with ${tokenType} count`);
          break;
        }
      }
    }
  }

  // ── COST REDUCTION ──────────────────────────────────────────────────────
  if (w.costReduction) {
    if (
      t.includes('costs {') && t.includes('less to cast') ||
      t.includes('cost {') && t.includes('less') ||
      t.includes('reduce the cost') ||
      t.includes('convoke') ||
      t.includes('affinity')
    ) {
      score += 12;
      reasons.push('Reduces activation/casting costs');
    }
  }

  // ── SELF-MILL / DISCARD SYNERGY ─────────────────────────────────────────
  if (w.selfMillOrDiscard) {
    if (
      t.includes('mill') ||
      t.includes('from your graveyard') ||
      t.includes('flashback') ||
      t.includes('unearth') ||
      t.includes('escape') ||
      t.includes('dredge') ||
      t.includes('madness') ||
      t.includes('whenever you discard')
    ) {
      score += 15;
      reasons.push('Fuels graveyard / discard strategy');
    }
  }

  // ── COUNTER SYNERGY ─────────────────────────────────────────────────────
  if (w.counterSynergy) {
    if (
      t.includes('proliferate') ||
      t.includes('+1/+1 counter') ||
      t.includes('for each counter') ||
      t.includes('evolve') ||
      t.includes('adapt')
    ) {
      score += 15;
      reasons.push('Amplifies counter strategy');
    }
  }

  // ── TOP-OF-LIBRARY ──────────────────────────────────────────────────────
  if (w.topOfLibrary) {
    if (
      t.includes('scry') ||
      t.includes('top of your library') ||
      t.includes('look at the top') ||
      t.includes('surveil')
    ) {
      score += 12;
      reasons.push('Library top manipulation');
    }
  }

  // ── DAMAGE AMPLIFIERS ───────────────────────────────────────────────────
  if (w.damageAmplifiers) {
    if (
      t.includes('if a source you control would deal') ||
      (t.includes('damage') && t.includes('twice')) ||
      t.includes('damage dealt by sources you control') ||
      t.includes('whenever a source you control deals damage')
    ) {
      score += 22;
      reasons.push('Amplifies commander\'s damage output');
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // NEGATIVE SCORING — mechanical mismatches
  // ────────────────────────────────────────────────────────────────────────

  // Wrong tribal synergy
  if (w.tribalPieces.length > 0) {
    const commanderTribes = new Set(w.tribalPieces.map(t => t.toLowerCase()));
    // Check if candidate references a DIFFERENT tribe mechanically
    const wrongTribalRe = /whenever (?:a|an) (\w+)|(\w+) creature tokens?|other (\w+)s you control/gi;
    let match;
    while ((match = wrongTribalRe.exec(t)) !== null) {
      const mentionedType = (match[1] || match[2] || match[3])?.toLowerCase();
      if (
        mentionedType &&
        !commanderTribes.has(mentionedType) &&
        // Only penalize actual creature types, not generic words
        ['goblin', 'zombie', 'vampire', 'elf', 'merfolk', 'soldier', 'human',
         'dragon', 'angel', 'demon', 'spirit', 'elemental', 'beast', 'knight',
         'warrior', 'wizard', 'dinosaur', 'cat', 'wolf', 'bird', 'snake',
         'insect', 'rat', 'squirrel', 'sliver', 'pirate', 'faerie', 'dwarf',
         'giant', 'phyrexian', 'horror', 'skeleton'].includes(mentionedType)
      ) {
        score -= 20;
        reasons.push(
          `Wrong tribal (${mentionedType} vs ${w.tribalPieces.join('/')})`,
        );
        break;
      }
    }
  }

  // Triggers on something the commander doesn't produce
  if (!p.cardDraw && t.includes('whenever you draw a card') && !t.includes('draw a card')) {
    score -= 15;
    reasons.push('Triggers on card draw but commander doesn\'t draw');
  }

  if (
    (!p.damage || p.damage.type === 'combat') &&
    (t.includes('if a source you control would deal noncombat') ||
     t.includes('whenever a source you control deals noncombat'))
  ) {
    score -= 15;
    reasons.push('Triggers on noncombat damage but commander doesn\'t deal noncombat damage');
  }

  // Life gain triggers without life gain
  const commanderGainsLife =
    profile.keywords.includes('lifelink') ||
    (profile.produces.damage && profile.produces.damage.type === 'combat' && profile.keywords.includes('lifelink'));
  if (!commanderGainsLife && t.includes('whenever you gain life')) {
    score -= 10;
    reasons.push('Life-gain trigger (commander doesn\'t gain life)');
  }

  // Non-matching creature type in a tribal deck with no other relevant abilities
  if (w.tribalPieces.length > 0 && ty.includes('creature')) {
    const commanderTribes = w.tribalPieces.map(t => t.toLowerCase());
    const isMatchingTribe = commanderTribes.some(tribe => ty.includes(tribe));
    if (!isMatchingTribe) {
      // Check if the creature has other relevant abilities (ramp, draw, removal, etc.)
      const hasRelevantAbility =
        t.includes('draw') || t.includes('destroy') || t.includes('exile target') ||
        t.includes('add {') || t.includes('search your library') ||
        t.includes('sacrifice a creature') || t.includes('whenever a creature');
      if (!hasRelevantAbility) {
        score -= 10;
        reasons.push(
          `Non-${w.tribalPieces.join('/')} creature dilutes tribal count`,
        );
      }
    }
  }

  return { score, reasons };
}

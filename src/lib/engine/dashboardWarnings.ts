// Structured deck-health warnings. Unlike the flat string list the generator
// pushes for legality/budget/gap messages, these carry a severity so the UI can
// rank and colour them, and they read off the computed DeckAnalysis (mana-base
// verdict, card count). Ported from the upstream (Manafoundry) dashboardWarnings.
//
// Upstream also attaches a `navigateTo` deep-link to a dashboard tab; this fork's
// result view is a single scroll with no tabs, so that field is omitted rather
// than shipped dead.

import type { DeckAnalysis } from './deckAnalyzer';

export type WarningSeverity = 'info' | 'warn' | 'error';

export interface DashboardWarning {
  id: string;
  severity: WarningSeverity;
  message: string;
}

export interface DashboardWarningInputs {
  analysis: DeckAnalysis;
  /** Non-commander card count (nonland + land). */
  cardCount: number;
  /** Deck-size target excluding commander(s) (e.g. 99 for standard Commander). */
  deckTarget: number;
  /** True when the commander has thin EDHREC data, so some analysis is weaker. */
  limitedData?: boolean;
}

export function buildDashboardWarnings(inputs: DashboardWarningInputs): DashboardWarning[] {
  const { analysis, cardCount, deckTarget, limitedData } = inputs;
  const out: DashboardWarning[] = [];

  // Card count
  if (cardCount > deckTarget) {
    out.push({
      id: 'count-over',
      severity: 'warn',
      message: `${cardCount - deckTarget} card${cardCount - deckTarget !== 1 ? 's' : ''} over target.`,
    });
  } else if (cardCount < deckTarget) {
    out.push({
      id: 'count-under',
      severity: 'warn',
      message: `${deckTarget - cardCount} card${deckTarget - cardCount !== 1 ? 's' : ''} under target.`,
    });
  }

  // Mana base
  const { verdict, currentLands, adjustedSuggestion } = analysis.manaBase;
  if (verdict === 'critically-low') {
    out.push({
      id: 'mana-starved',
      severity: 'error',
      message: `Mana base is starved — ${currentLands} lands, deck wants ${adjustedSuggestion}+.`,
    });
  } else if (verdict === 'low' || verdict === 'slightly-low') {
    out.push({
      id: 'mana-low',
      severity: 'warn',
      message: `Mana may be light — ${currentLands} lands vs target ${adjustedSuggestion}.`,
    });
  } else if (verdict === 'high') {
    out.push({
      id: 'mana-high',
      severity: 'info',
      message: `Running heavy on lands (${currentLands}, deck wants ~${adjustedSuggestion}).`,
    });
  }

  // Limited data
  if (limitedData) {
    out.push({
      id: 'limited-data',
      severity: 'info',
      message: 'Limited EDHREC data for this commander — analysis is approximate.',
    });
  }

  return out;
}

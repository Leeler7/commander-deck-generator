// Explainable trim reasons. When the deck is over-full and cards are cut, each
// cut carries a typed, human-readable reason so the user sees *why* a card was
// dropped beyond raw popularity. Ported from the upstream (Manafoundry)
// deckTrimmer reason system, minus the `isolated` (lift-connectivity) reason,
// which depends on the not-yet-ported lift-graph layer.

export type TrimReasonKey =
  | 'low-fit'
  | 'off-curve'
  | 'redundant-role'
  | 'type-overflow'
  | 'anti-synergy'
  | 'lowest-relevancy'
  | 'combo-near-miss';

export interface TrimCut {
  name: string;
  reasonKey: TrimReasonKey;
  reasonLabel: string;
  reasonText: string;
}

export const TRIM_REASON_LABELS: Record<TrimReasonKey, string> = {
  'low-fit': 'Low fit',
  'off-curve': 'Off-curve',
  'redundant-role': 'Redundant',
  'type-overflow': 'Type-heavy',
  'anti-synergy': 'Anti-synergy',
  'lowest-relevancy': 'Lowest',
  'combo-near-miss': 'Combo piece',
};

const TYPE_KEYS = ['creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'planeswalker'] as const;

export interface TrimReasonContext {
  /** Current count of cards in each CMC bucket (0..7, 7 = 7+). */
  cmcBuckets: Record<number, number>;
  /** Current count of cards of each primary type. */
  typeCounts: Record<string, number>;
  /** Target cards per CMC bucket (EDHREC-derived). */
  edhrecCurve: Record<number, number>;
  /** Target cards per primary type (EDHREC-derived). */
  edhrecTypes: Record<string, number>;
  roleCounts: Record<string, number>;
  roleTargets: Record<string, number>;
  /** Per-card EDHREC inclusion percentage (0..100). */
  inclusionMap: Record<string, number>;
  /** Per-card EDHREC synergy score. */
  synergyMap: Record<string, number>;
}

/** Minimal card shape the reason picker needs — decoupled from ScryfallCard. */
export interface TrimReasonCardInput {
  name: string;
  cmc: number;
  typeLine: string;
  role: string | null;
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

function classifyType(typeLine: string): string | null {
  const t = typeLine.toLowerCase();
  for (const k of TYPE_KEYS) if (t.includes(k)) return k;
  return null;
}

/**
 * Pick the single most-explanatory reason a card is being cut. Priority order
 * mirrors upstream: low-fit → off-curve → redundant-role → type-overflow →
 * anti-synergy → lowest-relevancy (fallback). Callers handle `combo-near-miss`
 * separately, since combo protection is baked into the relevancy score.
 */
export function pickTrimReason(
  card: TrimReasonCardInput,
  ctx: TrimReasonContext,
): { key: TrimReasonKey; text: string } {
  // Only claim "low fit" when we actually have EDHREC inclusion data for this card.
  // A card absent from the map (e.g. a staple injected outside the commander's
  // EDHREC pool) has unknown inclusion, not 0% — don't mislabel it.
  const hasIncl = card.name in ctx.inclusionMap;
  const incl = ctx.inclusionMap[card.name] ?? 0;
  const syn = ctx.synergyMap[card.name] ?? 0;

  if (hasIncl && incl < 5 && syn <= 0) {
    return { key: 'low-fit', text: `Only ${incl.toFixed(0)}% of decks run this; no synergy bonus.` };
  }

  const cmcBucket = Math.min(Math.floor(card.cmc ?? 0), 7);
  const actualBucket = ctx.cmcBuckets[cmcBucket] ?? 0;
  const targetBucket = ctx.edhrecCurve[cmcBucket] ?? 0;
  if (targetBucket >= 2 && actualBucket > targetBucket * 1.5) {
    return {
      key: 'off-curve',
      text: `Curve already heavy at CMC ${cmcBucket} (you have ${actualBucket}, average is ${targetBucket}).`,
    };
  }

  // Only fire redundant-role when a real positive target exists — a target of 0
  // usually means "no role-target data in this path," not "you want zero."
  const role = card.role;
  const roleTarget = role ? (ctx.roleTargets[role] ?? 0) : 0;
  if (role && roleTarget > 0 && (ctx.roleCounts[role] ?? 0) > roleTarget) {
    return {
      key: 'redundant-role',
      text: `${ordinal(ctx.roleCounts[role])} ${role} card — target is ${roleTarget}.`,
    };
  }

  const type = classifyType(card.typeLine);
  if (type) {
    const actualType = ctx.typeCounts[type] ?? 0;
    const targetType = ctx.edhrecTypes[type] ?? 0;
    if (targetType >= 5 && actualType >= targetType * 1.3) {
      return {
        key: 'type-overflow',
        text: `${type.charAt(0).toUpperCase() + type.slice(1)} slot is full (${actualType} vs. average of ${targetType}).`,
      };
    }
  }

  if (syn < -5) {
    return { key: 'anti-synergy', text: `Synergy score ${syn} — pulls against the commander's themes.` };
  }

  return { key: 'lowest-relevancy', text: 'Lowest relevancy score among remaining cards.' };
}

/** Build a full TrimCut for a card, honoring the combo-near-miss special case. */
export function buildTrimCut(
  card: TrimReasonCardInput,
  ctx: TrimReasonContext,
  isNearMissCombo: boolean,
): TrimCut {
  const { key, text } = isNearMissCombo
    ? { key: 'combo-near-miss' as TrimReasonKey, text: 'Piece of a one-away combo — cutting widens the gap.' }
    : pickTrimReason(card, ctx);
  return { name: card.name, reasonKey: key, reasonLabel: TRIM_REASON_LABELS[key], reasonText: text };
}

// Deck-wide lift discovery. Each deck card is a seed; EDHREC's card page lists every card played
// alongside it with a real `lift` (how many × more often it co-occurs than baseline predicts) and a
// co-occurrence %. We aggregate those into per-candidate "edges" — one per deck card that lifts the
// candidate — so every result is anchored to cards you actually run. Surfaces two extremes: bombs
// (one very high single-card lift) and clusters (lifted by several of your cards), plus per-card
// deck-internal connectivity (cards weakly tied to the rest of the deck are off-package outliers).
//
// Ported from upstream (Manafoundry). Pure reuse of fetchCardLiftPool + getCardsByNames.
//
// NOTE: this fetches one EDHREC card page PER SEED, so it is an on-demand analysis (not part of deck
// generation). Callers should bound the seed count (see maxSeeds) to stay a good EDHREC citizen.

import type { ScryfallCard } from './types';
import { fetchCardLiftPool, type CardLiftEntry } from './edhrec-client';
import { getCardsByNames, getFrontFaceTypeLine } from './scryfall-client';

function isLand(card: ScryfallCard): boolean {
  return getFrontFaceTypeLine(card).toLowerCase().includes('land');
}

/** One deck card's lift relationship to a candidate. */
export interface LiftEdge { seed: string; lift: number; coPct: number; numDecks: number; }

export interface LiftCandidate {
  card: ScryfallCard;
  edges: LiftEdge[];
  connectionCount: number; // how many of your cards list it
  bestLift: number;
  bestCoPct: number;
  bestNumDecks: number;
}

export type LiftCandidateAgg = Omit<LiftCandidate, 'card'> & { name: string };

const RESOLVE_CAP = 150;
const MIN_CONNECTIONS = 1;

function inIdentity(card: ScryfallCard, identity: string[]): boolean {
  return (card.color_identity ?? []).every(c => identity.includes(c));
}

/**
 * Pure: fold each seed's lift pool into per-candidate edges. Excludes owned names; keeps candidates
 * with >= minConnections. Sorted by connection count desc then best lift.
 */
export function aggregateLiftCandidates(
  poolsBySeed: { seed: string; pool: CardLiftEntry[] }[],
  excludeNames: Set<string>,
  minConnections: number = MIN_CONNECTIONS,
): LiftCandidateAgg[] {
  const map = new Map<string, LiftCandidateAgg>();
  for (const { seed, pool } of poolsBySeed) {
    for (const entry of pool) {
      if (excludeNames.has(entry.name)) continue;
      let agg = map.get(entry.name);
      if (!agg) {
        agg = { name: entry.name, edges: [], connectionCount: 0, bestLift: 0, bestCoPct: 0, bestNumDecks: 0 };
        map.set(entry.name, agg);
      }
      agg.edges.push({ seed, lift: entry.lift, coPct: entry.coPct, numDecks: entry.numDecks });
      agg.connectionCount = agg.edges.length;
      agg.bestLift = Math.max(agg.bestLift, entry.lift);
      agg.bestCoPct = Math.max(agg.bestCoPct, entry.coPct);
      agg.bestNumDecks = Math.max(agg.bestNumDecks, entry.numDecks);
    }
  }
  return [...map.values()]
    .filter(a => a.connectionCount >= minConnections)
    .sort((a, b) => (b.connectionCount - a.connectionCount) || (b.bestLift - a.bestLift) || a.name.localeCompare(b.name));
}

// Composite relevance: lift × co-occurrence, damped by sample size. A card must be both surprising
// (lift) AND actually played (coPct); the confidence factor lets a signal from many shared decks
// outweigh one from few.
const CONFIDENCE_K = 50;

export function edgeScore(e: LiftEdge): number {
  return e.lift * e.coPct * (e.numDecks / (e.numDecks + CONFIDENCE_K));
}

/** A "bomb": the single strongest lift×inclusion connection to one of your cards. */
export function bombScore(c: { edges: LiftEdge[] }): number {
  return c.edges.reduce((m, e) => Math.max(m, edgeScore(e)), 0);
}

/** A "cluster": summed strength across the cards that lift it — rewards breadth. */
export function clusterScore(c: { edges: LiftEdge[] }): number {
  return c.edges.reduce((s, e) => s + edgeScore(e), 0);
}

// ── Deck-internal connectivity ──────────────────────────────────────────
const CONNECTIVITY_MIN_LIFT = 1.5;

/**
 * Per-deck-card synergy connectivity: the summed strength of lift ties from a card to the OTHER cards
 * you run. Built from the same seed pools (no extra fetching). Every seed starts at 0, so a card with
 * no meaningful co-play surfaces as a genuine outlier (0), not undefined. Each unordered pair counted
 * once, credited to both endpoints. This is the signal the trim uses to flag off-package cards.
 */
export function computeDeckConnectivity(
  poolsBySeed: { seed: string; pool: CardLiftEntry[] }[],
  seedNames: string[],
): Record<string, number> {
  const deckSet = new Set(seedNames);
  const pairs = new Map<string, { lift: number; coPct: number; numDecks: number }>();
  for (const { seed, pool } of poolsBySeed) {
    for (const e of pool) {
      if (e.name === seed || !deckSet.has(e.name) || e.lift < CONNECTIVITY_MIN_LIFT) continue;
      const key = seed < e.name ? `${seed}|${e.name}` : `${e.name}|${seed}`;
      const prev = pairs.get(key);
      if (!prev || e.coPct > prev.coPct) pairs.set(key, { lift: e.lift, coPct: e.coPct, numDecks: e.numDecks });
    }
  }
  const conn: Record<string, number> = {};
  for (const name of seedNames) conn[name] = 0;
  for (const [key, e] of pairs) {
    const [a, b] = key.split('|');
    const s = edgeScore({ seed: a, lift: e.lift, coPct: e.coPct, numDecks: e.numDecks });
    conn[a] = (conn[a] ?? 0) + s;
    conn[b] = (conn[b] ?? 0) + s;
  }
  return conn;
}

export interface LiftScanResult {
  candidates: LiftCandidate[];
  connectivity: Record<string, number>;
}

// Selection thresholds — mirror upstream.
const PICK_HIGH_LIFT = 5;
const PICK_CLUSTER_MIN_CONN = 2;

/** Pick the single strongest bomb and cluster from a scan (bombs win ties over clusters). */
export function selectTopLiftPicks(candidates: LiftCandidate[]): { bomb: LiftCandidate | null; cluster: LiftCandidate | null } {
  const bomb = candidates
    .filter(c => c.bestLift >= PICK_HIGH_LIFT)
    .map(c => ({ c, s: bombScore(c) }))
    .sort((a, b) => b.s - a.s)[0]?.c ?? null;
  const cluster = candidates
    .filter(c => c.connectionCount >= PICK_CLUSTER_MIN_CONN && c.card.name !== bomb?.card.name)
    .map(c => ({ c, s: clusterScore(c) }))
    .sort((a, b) => b.s - a.s)[0]?.c ?? null;
  return { bomb, cluster };
}

/** Resolve seed/exclude/identity inputs for a deck scan. */
export function buildLiftScanInputs(opts: {
  commanderName: string;
  partnerCommanderName?: string;
  currentCards: ScryfallCard[];
  colorIdentity: string[];
}): { seedNames: string[]; excludeNames: Set<string>; identity: string[] } {
  const { commanderName, partnerCommanderName, currentCards, colorIdentity } = opts;
  const excludeNames = new Set<string>([
    ...currentCards.map(c => c.name),
    commanderName,
    ...(partnerCommanderName ? [partnerCommanderName] : []),
  ]);
  const seedNames = [...new Set<string>([
    commanderName,
    ...(partnerCommanderName ? [partnerCommanderName] : []),
    ...currentCards.filter(c => !isLand(c)).map(c => c.name),
  ])];
  return { seedNames, excludeNames, identity: colorIdentity };
}

export interface ScanArgs {
  seedNames: string[];
  identity: string[];
  excludeNames: Set<string>;
  /** Hard cap on how many seeds to fetch (EDHREC citizen budget). Extra seeds are skipped. */
  maxSeeds?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Scan each seed's lift pool, aggregate edges, resolve the most-connected candidates via Scryfall,
 * and filter to in-identity, commander-legal, non-land. Bounded by maxSeeds.
 */
export async function scanLiftCandidates(args: ScanArgs): Promise<LiftScanResult> {
  const { seedNames, identity, excludeNames, maxSeeds = 100, onProgress } = args;
  const seeds = seedNames.slice(0, maxSeeds);

  const poolsBySeed: { seed: string; pool: CardLiftEntry[] }[] = [];
  for (let i = 0; i < seeds.length; i++) {
    poolsBySeed.push({ seed: seeds[i], pool: await fetchCardLiftPool(seeds[i]) });
    onProgress?.(i + 1, seeds.length);
  }

  const candidates = await buildCandidates(poolsBySeed, excludeNames, identity);
  const connectivity = computeDeckConnectivity(poolsBySeed, seeds);
  return { candidates, connectivity };
}

/** Aggregate → resolve → filter to in-identity, commander-legal non-lands. */
async function buildCandidates(
  poolsBySeed: { seed: string; pool: CardLiftEntry[] }[],
  excludeNames: Set<string>,
  identity: string[],
): Promise<LiftCandidate[]> {
  const aggs = aggregateLiftCandidates(poolsBySeed, excludeNames, MIN_CONNECTIONS);
  if (aggs.length === 0) return [];

  const topByCoPct = [...aggs].sort((a, b) => b.bestCoPct - a.bestCoPct).slice(0, RESOLVE_CAP);
  const topByLift = [...aggs].sort((a, b) => b.bestLift - a.bestLift).slice(0, RESOLVE_CAP);
  const selected = new Set([...topByCoPct, ...topByLift].map(a => a.name));
  const cardMap = await getCardsByNames([...selected]);

  const out: LiftCandidate[] = [];
  for (const agg of aggs) {
    if (!selected.has(agg.name)) continue;
    const card = cardMap.get(agg.name);
    if (!card) continue;
    if (!inIdentity(card, identity)) continue;
    if (card.legalities?.commander !== 'legal') continue;
    if (isLand(card)) continue;
    out.push({ card, edges: agg.edges, connectionCount: agg.connectionCount, bestLift: agg.bestLift, bestCoPct: agg.bestCoPct, bestNumDecks: agg.bestNumDecks });
  }
  return out;
}

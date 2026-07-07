import { promises as fs } from 'fs';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface FastManaLists {
  rocks: Set<string>;
  rituals: Set<string>;
  dorks: Set<string>;
  /** rocks + rituals combined (the bracket signal) */
  bracketSignal: Set<string>;
  version: string;
}

export interface FreeInteractionList {
  cards: Set<string>;
  version: string;
}

export interface GameChangerList {
  cards: Set<string>;
  version: string;
}

// ── Internal state ─────────────────────────────────────────────────────────

let fastMana: FastManaLists | null = null;
let freeInteraction: FreeInteractionList | null = null;
let gameChangers: GameChangerList | null = null;

// ── Loaders ────────────────────────────────────────────────────────────────

async function loadJsonFile<T>(relativePath: string): Promise<T> {
  const fullPath = path.join(process.cwd(), relativePath);
  const raw = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(raw);
}

export async function loadFastManaLists(): Promise<FastManaLists> {
  if (fastMana) return fastMana;

  try {
    const data = await loadJsonFile<{
      snapshot_version: string;
      rocks: { cards: string[] };
      rituals: { cards: string[] };
      dorks: { cards: string[] };
    }>('data/fast-mana-lists.json');

    const rocks = new Set(data.rocks.cards);
    const rituals = new Set(data.rituals.cards);
    const dorks = new Set(data.dorks.cards);
    const bracketSignal = new Set([...rocks, ...rituals]);

    fastMana = { rocks, rituals, dorks, bracketSignal, version: data.snapshot_version };
    console.log(`[CuratedLists] Fast mana: ${rocks.size} rocks, ${rituals.size} rituals, ${dorks.size} dorks (v${data.snapshot_version})`);
    return fastMana;
  } catch (err) {
    console.error('[CuratedLists] Failed to load fast-mana-lists.json, using empty sets:', err);
    fastMana = {
      rocks: new Set(),
      rituals: new Set(),
      dorks: new Set(),
      bracketSignal: new Set(),
      version: 'unavailable',
    };
    return fastMana;
  }
}

export async function loadFreeInteractionList(): Promise<FreeInteractionList> {
  if (freeInteraction) return freeInteraction;

  try {
    const data = await loadJsonFile<{
      snapshot_version: string;
      cards: string[];
    }>('data/free-interaction-list.json');

    freeInteraction = {
      cards: new Set(data.cards),
      version: data.snapshot_version,
    };
    console.log(`[CuratedLists] Free interaction: ${freeInteraction.cards.size} cards (v${data.snapshot_version})`);
    return freeInteraction;
  } catch (err) {
    console.error('[CuratedLists] Failed to load free-interaction-list.json, using empty set:', err);
    freeInteraction = { cards: new Set(), version: 'unavailable' };
    return freeInteraction;
  }
}

export async function loadGameChangerList(): Promise<GameChangerList> {
  if (gameChangers) return gameChangers;

  try {
    const data = await loadJsonFile<{
      snapshot_version: string;
      cards: string[];
    }>('data/game-changers-snapshot.json');

    const cards = new Set(data.cards);
    // Index front face of DFCs
    for (const name of data.cards) {
      if (name.includes(' // ')) {
        cards.add(name.split(' // ')[0]);
      }
    }

    gameChangers = { cards, version: data.snapshot_version };
    console.log(`[CuratedLists] Game changers: ${data.cards.length} cards (v${data.snapshot_version})`);
    return gameChangers;
  } catch (err) {
    console.error('[CuratedLists] Failed to load game-changers-snapshot.json:', err);
    gameChangers = { cards: new Set(), version: 'unavailable' };
    return gameChangers;
  }
}

/**
 * Preload all curated lists. Call during server startup or before first generation.
 */
export async function preloadAllLists(): Promise<void> {
  await Promise.all([
    loadFastManaLists(),
    loadFreeInteractionList(),
    loadGameChangerList(),
  ]);
}

/**
 * Force reload all lists (e.g., after updating list files).
 */
export function invalidateLists(): void {
  fastMana = null;
  freeInteraction = null;
  gameChangers = null;
}

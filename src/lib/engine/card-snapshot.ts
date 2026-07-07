import { promises as fs } from 'fs';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CardSnapshotEntry {
  name: string;
  type_line: string;
  cmc: number;
  oracle_text: string;
  color_identity: string[];
  keywords: string[];
  is_gamechanger: boolean;
  edhrec_rank?: number;
  prices?: {
    usd?: string;
    usd_foil?: string;
  };
}

export interface SnapshotMetadata {
  version: string;
  cardCount: number;
  gameChangerCount: number;
  dbSyncDate: string;
  gcSnapshotDate: string;
}

// ── Internal state ─────────────────────────────────────────────────────────

let cardIndex: Map<string, CardSnapshotEntry> | null = null;
let metadata: SnapshotMetadata | null = null;
let loadPromise: Promise<void> | null = null;

// ── Loading ────────────────────────────────────────────────────────────────

async function loadSnapshot(): Promise<void> {
  if (cardIndex) return;
  if (loadPromise) {
    await loadPromise;
    return;
  }

  loadPromise = (async () => {
    const dbDir = path.join(process.cwd(), 'public', 'database', 'chunks');
    const manifestPath = path.join(dbDir, 'manifest.json');
    const gcPath = path.join(process.cwd(), 'data', 'game-changers-snapshot.json');
    const syncStatusPath = path.join(process.cwd(), 'public', 'database', 'sync-status.json');

    // Load manifest
    let manifest: { version: string; totalCards: number; totalChunks: number };
    try {
      const raw = await fs.readFile(manifestPath, 'utf-8');
      manifest = JSON.parse(raw);
    } catch {
      console.error('[CardSnapshot] Failed to load manifest.json — snapshot unavailable');
      cardIndex = new Map();
      metadata = {
        version: 'unavailable',
        cardCount: 0,
        gameChangerCount: 0,
        dbSyncDate: 'unknown',
        gcSnapshotDate: 'unknown',
      };
      return;
    }

    // Load game changers frozen list
    let gcNames: Set<string>;
    let gcSnapshotDate: string;
    try {
      const raw = await fs.readFile(gcPath, 'utf-8');
      const gc = JSON.parse(raw);
      gcNames = new Set<string>(gc.cards);
      gcSnapshotDate = gc.snapshot_version ?? 'unknown';
      // Also index front face of DFCs
      for (const name of gc.cards) {
        if (name.includes(' // ')) {
          gcNames.add(name.split(' // ')[0]);
        }
      }
    } catch {
      console.warn('[CardSnapshot] Failed to load game-changers-snapshot.json — GC flags unavailable');
      gcNames = new Set();
      gcSnapshotDate = 'unknown';
    }

    // Load sync status for date
    let dbSyncDate = 'unknown';
    try {
      const raw = await fs.readFile(syncStatusPath, 'utf-8');
      const status = JSON.parse(raw);
      dbSyncDate = status.last_full_sync ?? 'unknown';
    } catch { /* non-fatal */ }

    // Load all chunks into index
    const index = new Map<string, CardSnapshotEntry>();
    for (let i = 0; i < manifest.totalChunks; i++) {
      const chunkPath = path.join(dbDir, `cards-chunk-${i}.json`);
      try {
        const raw = await fs.readFile(chunkPath, 'utf-8');
        const chunk: Record<string, {
          name: string;
          type_line: string;
          cmc: number;
          oracle_text?: string;
          color_identity: string[];
          keywords?: string[];
          edhrec_rank?: number;
          prices?: { usd?: string; usd_foil?: string };
          legalities?: { commander?: string };
        }> = JSON.parse(raw);

        for (const card of Object.values(chunk)) {
          // Only index commander-legal cards
          if (card.legalities?.commander !== 'legal') continue;
          // Dedupe by name — keep first encountered (lower chunk = more recent)
          if (index.has(card.name)) continue;

          index.set(card.name, {
            name: card.name,
            type_line: card.type_line,
            cmc: card.cmc,
            oracle_text: card.oracle_text ?? '',
            color_identity: card.color_identity,
            keywords: card.keywords ?? [],
            is_gamechanger: gcNames.has(card.name),
            edhrec_rank: card.edhrec_rank,
            prices: card.prices ? { usd: card.prices.usd, usd_foil: card.prices.usd_foil } : undefined,
          });

          // Also index front face of DFCs
          if (card.name.includes(' // ')) {
            const front = card.name.split(' // ')[0];
            if (!index.has(front)) {
              index.set(front, {
                name: card.name,
                type_line: card.type_line,
                cmc: card.cmc,
                oracle_text: card.oracle_text ?? '',
                color_identity: card.color_identity,
                keywords: card.keywords ?? [],
                is_gamechanger: gcNames.has(card.name) || gcNames.has(front),
                edhrec_rank: card.edhrec_rank,
                prices: card.prices ? { usd: card.prices.usd, usd_foil: card.prices.usd_foil } : undefined,
              });
            }
          }
        }
      } catch (err) {
        console.error(`[CardSnapshot] Failed to load chunk ${i}:`, err);
      }
    }

    cardIndex = index;
    metadata = {
      version: `${manifest.version}-db${dbSyncDate.slice(0, 10)}-gc${gcSnapshotDate}`,
      cardCount: index.size,
      gameChangerCount: [...index.values()].filter(c => c.is_gamechanger).length,
      dbSyncDate,
      gcSnapshotDate,
    };

    console.log(`[CardSnapshot] Loaded ${index.size} cards, ${metadata.gameChangerCount} game changers (v${metadata.version})`);
  })();

  await loadPromise;
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function getSnapshotMetadata(): Promise<SnapshotMetadata> {
  await loadSnapshot();
  return metadata!;
}

export async function lookupCard(name: string): Promise<CardSnapshotEntry | undefined> {
  await loadSnapshot();
  return cardIndex!.get(name);
}

export async function lookupCards(names: string[]): Promise<Map<string, CardSnapshotEntry>> {
  await loadSnapshot();
  const result = new Map<string, CardSnapshotEntry>();
  for (const name of names) {
    const card = cardIndex!.get(name);
    if (card) result.set(name, card);
  }
  return result;
}

export async function getGameChangerNamesFromSnapshot(): Promise<Set<string>> {
  await loadSnapshot();
  const names = new Set<string>();
  for (const [name, card] of cardIndex!) {
    if (card.is_gamechanger) names.add(name);
  }
  return names;
}

export async function isGameChanger(name: string): Promise<boolean> {
  await loadSnapshot();
  return cardIndex!.get(name)?.is_gamechanger ?? false;
}

export async function getSnapshotVersion(): Promise<string> {
  await loadSnapshot();
  return metadata!.version;
}

/**
 * Check coverage: what fraction of the given card names exist in the snapshot.
 * Returns names that are NOT in the snapshot (untagged/missing cards).
 */
export async function checkCoverage(names: string[]): Promise<{
  covered: number;
  missing: string[];
  coverageRatio: number;
}> {
  await loadSnapshot();
  const missing: string[] = [];
  for (const name of names) {
    if (!cardIndex!.has(name)) missing.push(name);
  }
  return {
    covered: names.length - missing.length,
    missing,
    coverageRatio: names.length > 0 ? (names.length - missing.length) / names.length : 1,
  };
}

/**
 * Force reload the snapshot (e.g., after a database sync).
 */
export function invalidateSnapshot(): void {
  cardIndex = null;
  metadata = null;
  loadPromise = null;
}

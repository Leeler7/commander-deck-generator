import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gunzip = promisify(zlib.gunzip);

export async function POST() {
  try {
    const DATA_DIR = path.join(process.cwd(), 'data');
    const CARDS_FILE = path.join(DATA_DIR, 'cards.json');
    const NAME_INDEX_FILE = path.join(DATA_DIR, 'name-index.json');
    const STATUS_FILE = path.join(DATA_DIR, 'sync-status.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    const baseUrl = 'https://raw.githubusercontent.com/Leeler7/commander-deck-database/main';
    
    // Download manifest
    console.log('📥 Downloading database from GitHub...');
    const manifestResponse = await fetch(`${baseUrl}/database/chunks/manifest.json`);
    if (!manifestResponse.ok) {
      throw new Error(`Failed to download manifest: ${manifestResponse.status}`);
    }
    const manifest = await manifestResponse.json();
    
    // Download sync status
    const statusResponse = await fetch(`${baseUrl}/database/sync-status.json`);
    if (statusResponse.ok) {
      const syncStatus = await statusResponse.json();
      fs.writeFileSync(STATUS_FILE, JSON.stringify(syncStatus, null, 2));
    }
    
    // Download name index
    const indexResponse = await fetch(`${baseUrl}/database/name-index.json.gz`);
    if (indexResponse.ok) {
      const compressedBuffer = Buffer.from(await indexResponse.arrayBuffer());
      const decompressedBuffer = await gunzip(compressedBuffer);
      fs.writeFileSync(NAME_INDEX_FILE, decompressedBuffer);
    }
    
    // Download and merge all chunks
    const allCards: any = {};
    
    for (let i = 0; i < manifest.totalChunks; i++) {
      const chunkUrl = `${baseUrl}/database/chunks/cards-chunk-${i}.json.gz`;
      const chunkResponse = await fetch(chunkUrl);
      
      if (!chunkResponse.ok) {
        console.error(`Failed to download chunk ${i}: ${chunkResponse.status}`);
        continue;
      }
      
      const compressedBuffer = Buffer.from(await chunkResponse.arrayBuffer());
      const decompressedBuffer = await gunzip(compressedBuffer);
      const chunkData = JSON.parse(decompressedBuffer.toString());
      
      Object.assign(allCards, chunkData);
    }
    
    // Write to local database
    fs.writeFileSync(CARDS_FILE, JSON.stringify(allCards, null, 2));
    
    // Force database reinitialization
    const { serverCardDatabase } = await import('@/lib/server-card-database');
    (serverCardDatabase as any).initialized = false;
    await serverCardDatabase.initialize();
    
    return NextResponse.json({
      success: true,
      cardsDownloaded: Object.keys(allCards).length,
      message: 'Database downloaded successfully from GitHub'
    });
    
  } catch (error) {
    console.error('Download failed:', error);
    return NextResponse.json(
      { error: 'Failed to download database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
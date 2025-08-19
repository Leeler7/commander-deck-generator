import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);

const CHUNK_SIZE = 5000;

export async function POST() {
  try {
    const DATA_DIR = path.join(process.cwd(), 'data');
    const PUBLIC_DB_DIR = path.join(process.cwd(), 'public', 'database');
    const CHUNKS_DIR = path.join(PUBLIC_DB_DIR, 'chunks');
    const CARDS_FILE = path.join(DATA_DIR, 'cards.json');
    const NAME_INDEX_FILE = path.join(DATA_DIR, 'name-index.json');
    const STATUS_FILE = path.join(DATA_DIR, 'sync-status.json');
    
    // Check if local database exists
    if (!fs.existsSync(CARDS_FILE)) {
      return NextResponse.json(
        { error: 'No local database found. Download the database first.' },
        { status: 400 }
      );
    }
    
    // Load local database
    const cardsData = fs.readFileSync(CARDS_FILE, 'utf8');
    const cards = JSON.parse(cardsData);
    
    // Ensure directories exist
    if (!fs.existsSync(CHUNKS_DIR)) {
      fs.mkdirSync(CHUNKS_DIR, { recursive: true });
    }
    
    const cardEntries = Object.entries(cards);
    const totalCards = cardEntries.length;
    const totalChunks = Math.ceil(totalCards / CHUNK_SIZE);
    
    // Create manifest
    const manifest = {
      version: '1.0',
      created: new Date().toISOString(),
      totalCards,
      totalChunks,
      chunkSize: CHUNK_SIZE
    };
    
    // Create chunks
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, totalCards);
      const chunkEntries = cardEntries.slice(start, end);
      const chunkData = Object.fromEntries(chunkEntries);
      
      const chunkFile = path.join(CHUNKS_DIR, `cards-chunk-${i}.json`);
      const chunkGzFile = `${chunkFile}.gz`;
      
      // Write uncompressed chunk (for debugging)
      fs.writeFileSync(chunkFile, JSON.stringify(chunkData));
      
      // Write compressed chunk
      const compressed = await gzip(JSON.stringify(chunkData));
      fs.writeFileSync(chunkGzFile, compressed);
    }
    
    // Write manifest
    fs.writeFileSync(
      path.join(CHUNKS_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );
    
    // Compress name index
    if (fs.existsSync(NAME_INDEX_FILE)) {
      const indexData = fs.readFileSync(NAME_INDEX_FILE, 'utf8');
      const compressed = await gzip(indexData);
      fs.writeFileSync(path.join(PUBLIC_DB_DIR, 'name-index.json.gz'), compressed);
    }
    
    // Copy sync status
    if (fs.existsSync(STATUS_FILE)) {
      fs.copyFileSync(STATUS_FILE, path.join(PUBLIC_DB_DIR, 'sync-status.json'));
    }
    
    return NextResponse.json({
      success: true,
      totalCards,
      totalChunks,
      message: `Exported ${totalCards} cards to ${totalChunks} chunks`
    });
    
  } catch (error) {
    console.error('Export failed:', error);
    return NextResponse.json(
      { error: 'Failed to export database', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const { execSync } = require('child_process');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const PUBLIC_DB_DIR = path.join(process.cwd(), 'public', 'database');
const CHUNKS_DIR = path.join(PUBLIC_DB_DIR, 'chunks');
const CARDS_FILE = path.join(DATA_DIR, 'cards.json');
const NAME_INDEX_FILE = path.join(DATA_DIR, 'name-index.json');
const STATUS_FILE = path.join(DATA_DIR, 'sync-status.json');

// Chunk size (5000 cards per chunk)
const CHUNK_SIZE = 5000;

async function loadLocalDatabase() {
  console.log('📖 Loading local database...');
  
  if (!fs.existsSync(CARDS_FILE)) {
    console.error('❌ No local database found at', CARDS_FILE);
    console.log('💡 Run the application locally and perform a sync first');
    process.exit(1);
  }
  
  const cardsData = fs.readFileSync(CARDS_FILE, 'utf8');
  const cards = JSON.parse(cardsData);
  
  console.log(`✅ Loaded ${Object.keys(cards).length} cards from local database`);
  return cards;
}

async function createChunks(cards) {
  console.log('📦 Creating database chunks...');
  
  // Ensure directories exist
  if (!fs.existsSync(CHUNKS_DIR)) {
    fs.mkdirSync(CHUNKS_DIR, { recursive: true });
  }
  
  const cardEntries = Object.entries(cards);
  const totalCards = cardEntries.length;
  const totalChunks = Math.ceil(totalCards / CHUNK_SIZE);
  
  console.log(`📊 Splitting ${totalCards} cards into ${totalChunks} chunks`);
  
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
    
    console.log(`✅ Created chunk ${i + 1}/${totalChunks} (${chunkEntries.length} cards)`);
  }
  
  // Write manifest
  fs.writeFileSync(
    path.join(CHUNKS_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('✅ Chunks created successfully');
}

async function compressIndexFiles() {
  console.log('🗂️ Compressing index files...');
  
  // Compress name index
  if (fs.existsSync(NAME_INDEX_FILE)) {
    const indexData = fs.readFileSync(NAME_INDEX_FILE, 'utf8');
    const compressed = await gzip(indexData);
    fs.writeFileSync(path.join(PUBLIC_DB_DIR, 'name-index.json.gz'), compressed);
    console.log('✅ Compressed name index');
  }
  
  // Copy sync status
  if (fs.existsSync(STATUS_FILE)) {
    fs.copyFileSync(STATUS_FILE, path.join(PUBLIC_DB_DIR, 'sync-status.json'));
    console.log('✅ Copied sync status');
  }
}

async function exportDatabase() {
  console.log('🚀 Starting database export...\n');
  
  try {
    // Load local database
    const cards = await loadLocalDatabase();
    
    // Create chunks
    await createChunks(cards);
    
    // Compress index files
    await compressIndexFiles();
    
    console.log('\n✅ Database export complete!');
    console.log('📁 Files exported to:', PUBLIC_DB_DIR);
    console.log('\n📤 Next steps:');
    console.log('1. Review the changes: git status');
    console.log('2. Commit the changes: git add public/database && git commit -m "Update database with new tags"');
    console.log('3. Push to GitHub: git push');
    console.log('4. Railway will automatically deploy and use the new database');
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

async function importDatabase() {
  console.log('📥 Starting database import from public files...\n');
  
  try {
    const manifestPath = path.join(CHUNKS_DIR, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      console.error('❌ No database chunks found in public/database/chunks');
      console.log('💡 Make sure you have the latest code from GitHub');
      process.exit(1);
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`📦 Found database with ${manifest.totalCards} cards in ${manifest.totalChunks} chunks`);
    
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    // Load and merge all chunks
    const allCards = {};
    
    for (let i = 0; i < manifest.totalChunks; i++) {
      const chunkGzFile = path.join(CHUNKS_DIR, `cards-chunk-${i}.json.gz`);
      
      if (fs.existsSync(chunkGzFile)) {
        const compressed = fs.readFileSync(chunkGzFile);
        const decompressed = await gunzip(compressed);
        const chunkData = JSON.parse(decompressed.toString());
        Object.assign(allCards, chunkData);
        console.log(`✅ Loaded chunk ${i + 1}/${manifest.totalChunks}`);
      }
    }
    
    // Write to local data directory
    fs.writeFileSync(CARDS_FILE, JSON.stringify(allCards, null, 2));
    console.log(`✅ Wrote ${Object.keys(allCards).length} cards to local database`);
    
    // Import name index
    const nameIndexGz = path.join(PUBLIC_DB_DIR, 'name-index.json.gz');
    if (fs.existsSync(nameIndexGz)) {
      const compressed = fs.readFileSync(nameIndexGz);
      const decompressed = await gunzip(compressed);
      fs.writeFileSync(NAME_INDEX_FILE, decompressed);
      console.log('✅ Imported name index');
    }
    
    // Import sync status
    const syncStatusPublic = path.join(PUBLIC_DB_DIR, 'sync-status.json');
    if (fs.existsSync(syncStatusPublic)) {
      fs.copyFileSync(syncStatusPublic, STATUS_FILE);
      console.log('✅ Imported sync status');
    }
    
    console.log('\n✅ Database import complete!');
    console.log('📁 Database imported to:', DATA_DIR);
    console.log('\n🎯 You can now:');
    console.log('1. Run the app locally: npm run dev');
    console.log('2. Use the admin tools to manage tags');
    console.log('3. Export the database when done: npm run db:export');
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];
  
  if (command === 'export') {
    await exportDatabase();
  } else if (command === 'import') {
    await importDatabase();
  } else {
    console.log('📚 Database Management Tool\n');
    console.log('Usage:');
    console.log('  npm run db:export - Export local database to public/database for GitHub');
    console.log('  npm run db:import - Import database from public/database to local');
    console.log('\nWorkflow:');
    console.log('1. Import: npm run db:import (get latest from GitHub)');
    console.log('2. Run locally: npm run dev');
    console.log('3. Manage tags in admin panel');
    console.log('4. Export: npm run db:export');
    console.log('5. Commit and push to GitHub');
  }
}

main().catch(console.error);
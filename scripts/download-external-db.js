#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gunzip = promisify(zlib.gunzip);

// Paths
const DATA_DIR = path.join(process.cwd(), 'data');
const CARDS_FILE = path.join(DATA_DIR, 'cards.json');
const NAME_INDEX_FILE = path.join(DATA_DIR, 'name-index.json');
const STATUS_FILE = path.join(DATA_DIR, 'sync-status.json');

async function downloadExternalDatabase() {
  console.log('🌐 Downloading database from GitHub repository...\n');
  
  try {
    // Ensure data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    const baseUrl = 'https://raw.githubusercontent.com/Leeler7/commander-deck-database/main';
    
    // Download manifest
    console.log('📥 Downloading manifest...');
    const manifestResponse = await fetch(`${baseUrl}/database/chunks/manifest.json`);
    if (!manifestResponse.ok) {
      throw new Error(`Failed to download manifest: ${manifestResponse.status}`);
    }
    const manifest = await manifestResponse.json();
    
    console.log(`📦 Database has ${manifest.totalCards} cards in ${manifest.totalChunks} chunks`);
    
    // Download sync status
    console.log('📥 Downloading sync status...');
    const statusResponse = await fetch(`${baseUrl}/database/sync-status.json`);
    if (statusResponse.ok) {
      const syncStatus = await statusResponse.json();
      fs.writeFileSync(STATUS_FILE, JSON.stringify(syncStatus, null, 2));
      console.log('✅ Downloaded sync status');
    }
    
    // Download name index
    console.log('📥 Downloading name index...');
    const indexResponse = await fetch(`${baseUrl}/database/name-index.json.gz`);
    if (indexResponse.ok) {
      const compressedBuffer = Buffer.from(await indexResponse.arrayBuffer());
      const decompressedBuffer = await gunzip(compressedBuffer);
      fs.writeFileSync(NAME_INDEX_FILE, decompressedBuffer);
      console.log('✅ Downloaded name index');
    }
    
    // Download and merge all chunks
    const allCards = {};
    
    for (let i = 0; i < manifest.totalChunks; i++) {
      const chunkUrl = `${baseUrl}/database/chunks/cards-chunk-${i}.json.gz`;
      console.log(`📥 Downloading chunk ${i + 1}/${manifest.totalChunks}...`);
      
      const chunkResponse = await fetch(chunkUrl);
      if (!chunkResponse.ok) {
        console.error(`❌ Failed to download chunk ${i}: ${chunkResponse.status}`);
        continue;
      }
      
      // Decompress the gzipped chunk
      const compressedBuffer = Buffer.from(await chunkResponse.arrayBuffer());
      const decompressedBuffer = await gunzip(compressedBuffer);
      const chunkData = JSON.parse(decompressedBuffer.toString());
      
      // Add cards to collection
      Object.assign(allCards, chunkData);
      
      console.log(`✅ Downloaded chunk ${i + 1}: ${Object.keys(chunkData).length} cards`);
    }
    
    // Write to local database
    console.log(`\n💾 Writing ${Object.keys(allCards).length} cards to local database...`);
    fs.writeFileSync(CARDS_FILE, JSON.stringify(allCards, null, 2));
    
    console.log('\n✅ Database download complete!');
    console.log(`📁 Database saved to: ${DATA_DIR}`);
    console.log('\n🎯 You can now:');
    console.log('1. Run the app locally: npm run dev');
    console.log('2. Use the admin tools to manage tags');
    console.log('3. Export the database when done: npm run db:export');
    console.log('4. Commit and push changes to GitHub');
    
  } catch (error) {
    console.error('❌ Download failed:', error.message);
    process.exit(1);
  }
}

downloadExternalDatabase().catch(console.error);
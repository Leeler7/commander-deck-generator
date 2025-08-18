#!/usr/bin/env node

/**
 * New Card Fetcher Tool
 * 
 * This executable checks Scryfall for new cards that aren't in the local database
 * and downloads their basic information (name, oracle text, metadata) without
 * running the tagging system. The tagging can be done separately with retag-database.js
 * 
 * Usage: node fetch-new-cards.js [options]
 * 
 * Options:
 *   --help, -h      Show help
 *   --verbose, -v   Show detailed progress
 *   --dry-run       Show what would be done without making changes
 *   --set=CODE      Only fetch cards from specific set (e.g., --set=otj)
 *   --limit=N       Limit number of new cards to fetch (for testing)
 */

const fs = require('fs');
const path = require('path');

// Data file paths
const dataDir = path.join(process.cwd(), 'data');
const cardsFile = path.join(dataDir, 'cards.json');
const statusFile = path.join(dataDir, 'sync-status.json');

// Command line argument parsing
const args = process.argv.slice(2);
const options = {
  help: args.includes('--help') || args.includes('-h'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
  set: args.find(arg => arg.startsWith('--set='))?.split('=')[1],
  limit: parseInt(args.find(arg => arg.startsWith('--limit='))?.split('=')[1]) || null
};

function showHelp() {
  console.log(`
New Card Fetcher Tool

This tool checks Scryfall for new cards that aren't in your local database
and downloads their basic information without running the tagging system.

Usage: node fetch-new-cards.js [options]

Options:
  --help, -h        Show this help message
  --verbose, -v     Show detailed progress information
  --dry-run         Show what would be done without making changes
  --set=CODE        Only fetch cards from specific set (e.g., --set=otj for Outlaws)
  --limit=N         Limit number of new cards to fetch (useful for testing)

Examples:
  node fetch-new-cards.js                     # Check for all new cards
  node fetch-new-cards.js --verbose           # Show detailed progress
  node fetch-new-cards.js --set=otj           # Only fetch Outlaws of Thunder Junction cards
  node fetch-new-cards.js --limit=10 --dry-run # Test with first 10 new cards

Workflow:
  1. Run this tool to fetch new card data from Scryfall
  2. Run retag-database.js to apply comprehensive tagging to all cards

Note: This tool works directly with the database files and Scryfall API.
      It does not require the Next.js server to be running.
`);
}

async function loadLocalDatabase() {
  if (!fs.existsSync(cardsFile)) {
    console.log('📝 No local database found. All cards will be considered new.');
    return new Map();
  }
  
  if (options.verbose) console.log('📖 Loading local database...');
  
  try {
    const data = fs.readFileSync(cardsFile, 'utf8');
    const cardObject = JSON.parse(data);
    const cardMap = new Map(Object.entries(cardObject));
    
    if (options.verbose) {
      console.log(`   Loaded ${cardMap.size.toLocaleString()} cards from local database`);
    }
    
    return cardMap;
  } catch (error) {
    throw new Error(`Failed to load local database: ${error.message}`);
  }
}

async function fetchScryfallBulkData() {
  const fetch = (await import('node-fetch')).default;
  
  if (options.verbose) console.log('🌐 Fetching Scryfall bulk data info...');
  
  try {
    const response = await fetch('https://api.scryfall.com/bulk-data');
    if (!response.ok) {
      throw new Error(`Scryfall API error: ${response.status} ${response.statusText}`);
    }
    
    const bulkData = await response.json();
    const oracleData = bulkData.data.find(bulk => bulk.type === 'oracle_cards');
    
    if (!oracleData) {
      throw new Error('Oracle cards bulk data not found');
    }
    
    if (options.verbose) {
      console.log(`   Found oracle cards data: ${oracleData.name}`);
      console.log(`   Size: ${(oracleData.size / 1024 / 1024).toFixed(1)} MB`);
      console.log(`   Updated: ${new Date(oracleData.updated_at).toLocaleString()}`);
    }
    
    return oracleData.download_uri;
  } catch (error) {
    throw new Error(`Failed to fetch Scryfall bulk data info: ${error.message}`);
  }
}

async function fetchAllScryfallCards(downloadUri) {
  const fetch = (await import('node-fetch')).default;
  
  if (options.verbose) console.log('📥 Downloading all Scryfall cards...');
  
  try {
    const response = await fetch(downloadUri);
    if (!response.ok) {
      throw new Error(`Failed to download bulk data: ${response.status} ${response.statusText}`);
    }
    
    const cards = await response.json();
    
    if (options.verbose) {
      console.log(`   Downloaded ${cards.length.toLocaleString()} cards from Scryfall`);
    }
    
    return cards;
  } catch (error) {
    throw new Error(`Failed to download Scryfall cards: ${error.message}`);
  }
}

function filterNewCards(scryfallCards, localCards) {
  if (options.verbose) console.log('🔍 Identifying new cards...');
  
  let newCards = scryfallCards.filter(card => {
    // Skip if card already exists in local database
    if (localCards.has(card.id)) return false;
    
    // Filter by set if specified
    if (options.set && card.set !== options.set.toLowerCase()) return false;
    
    // Only include legal Magic cards
    if (!card.legalities?.commander || card.legalities.commander === 'not_legal') return false;
    
    return true;
  });
  
  // Apply limit if specified
  if (options.limit) {
    newCards = newCards.slice(0, options.limit);
  }
  
  if (options.verbose) {
    console.log(`   Found ${newCards.length.toLocaleString()} new cards to add`);
    if (options.set) {
      console.log(`   Filtered to set: ${options.set.toUpperCase()}`);
    }
    if (options.limit) {
      console.log(`   Limited to: ${options.limit} cards`);
    }
  }
  
  return newCards;
}

function convertScryfallToLocal(scryfallCard) {
  return {
    id: scryfallCard.id,
    name: scryfallCard.name,
    mana_cost: scryfallCard.mana_cost || '',
    cmc: scryfallCard.cmc || 0,
    type_line: scryfallCard.type_line || '',
    oracle_text: scryfallCard.oracle_text || '',
    flavor_text: scryfallCard.flavor_text || '',
    power: scryfallCard.power || '',
    toughness: scryfallCard.toughness || '',
    loyalty: scryfallCard.loyalty || '',
    color_identity: scryfallCard.color_identity || [],
    colors: scryfallCard.colors || [],
    keywords: scryfallCard.keywords || [],
    set_code: scryfallCard.set || '',
    set_name: scryfallCard.set_name || '',
    rarity: scryfallCard.rarity || 'common',
    collector_number: scryfallCard.collector_number || '',
    legalities: scryfallCard.legalities || {},
    prices: scryfallCard.prices || {},
    edhrec_rank: scryfallCard.edhrec_rank || null,
    image_uris: scryfallCard.image_uris || {},
    last_updated: new Date().toISOString(),
    scryfall_uri: scryfallCard.scryfall_uri || `https://scryfall.com/card/${scryfallCard.set}/${scryfallCard.id}`,
    // NOTE: mechanics will be null - use retag-database.js to add comprehensive tagging
    mechanics: null
  };
}

async function saveNewCards(localCards, newCards) {
  if (options.dryRun) {
    console.log('🧪 DRY RUN - Cards that would be added:');
    newCards.slice(0, 10).forEach(card => {
      console.log(`   • ${card.name} (${card.set_name})`);
    });
    if (newCards.length > 10) {
      console.log(`   ... and ${newCards.length - 10} more`);
    }
    return;
  }
  
  if (options.verbose) console.log('💾 Saving updated database...');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Add new cards to local database
  newCards.forEach(scryfallCard => {
    const localCard = convertScryfallToLocal(scryfallCard);
    localCards.set(localCard.id, localCard);
  });
  
  // Save updated database
  const cardObject = Object.fromEntries(localCards);
  fs.writeFileSync(cardsFile, JSON.stringify(cardObject));
  
  // Update status
  const status = {
    last_full_sync: new Date().toISOString(),
    last_incremental_sync: null,
    total_cards: localCards.size,
    sync_in_progress: false,
    sync_progress: 100,
    last_new_card_fetch: new Date().toISOString(),
    new_cards_added: newCards.length
  };
  fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
  
  if (options.verbose) {
    console.log(`   Database saved with ${localCards.size.toLocaleString()} total cards`);
  }
}

async function fetchNewCards() {
  console.log('🆕 New Card Fetcher Tool');
  console.log('==========================');
  console.log('');
  
  if (options.help) {
    showHelp();
    return;
  }
  
  const startTime = Date.now();
  
  try {
    // Load local database
    const localCards = await loadLocalDatabase();
    
    // Get Scryfall bulk data info
    const downloadUri = await fetchScryfallBulkData();
    
    // Download all Scryfall cards
    const scryfallCards = await fetchAllScryfallCards(downloadUri);
    
    // Identify new cards
    const newCards = filterNewCards(scryfallCards, localCards);
    
    if (newCards.length === 0) {
      console.log('✅ No new cards found. Database is up to date!');
      return;
    }
    
    console.log('');
    console.log(`📊 Summary:`);
    console.log(`   Local cards: ${localCards.size.toLocaleString()}`);
    console.log(`   Scryfall cards: ${scryfallCards.length.toLocaleString()}`);
    console.log(`   New cards found: ${newCards.length.toLocaleString()}`);
    console.log('');
    
    // Show sample of new cards
    if (options.verbose && newCards.length > 0) {
      console.log('📋 Sample new cards:');
      newCards.slice(0, 5).forEach(card => {
        console.log(`   • ${card.name} (${card.set_name})`);
      });
      if (newCards.length > 5) {
        console.log(`   ... and ${newCards.length - 5} more`);
      }
      console.log('');
    }
    
    // Save new cards
    await saveNewCards(localCards, newCards);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    if (!options.dryRun) {
      console.log('✅ New cards fetched successfully!');
      console.log(`   Cards added: ${newCards.length.toLocaleString()}`);
      console.log(`   Total cards: ${(localCards.size + newCards.length).toLocaleString()}`);
      console.log(`   Duration: ${duration.toFixed(1)} seconds`);
      console.log('');
      console.log('📝 Next steps:');
      console.log('   1. Run "node tools/retag-database.js" to apply comprehensive tagging');
      console.log('   2. Restart your development server to use the updated database');
    }
    
  } catch (error) {
    console.error('');
    console.error('❌ Failed to fetch new cards:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('⏹️  Process interrupted. Fetch stopped.');
  process.exit(1);
});

// Run the tool
fetchNewCards().catch(error => {
  console.error('❌ Unexpected error:', error.message);
  if (options.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});
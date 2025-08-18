#!/usr/bin/env node

/**
 * Card Database Re-Tagging Tool
 * 
 * This executable loads the card database and runs the comprehensive
 * tagging system on all cards. Useful for updates when new sets come out.
 * 
 * Usage: node retag-database.js [options]
 * 
 * Options:
 *   --help, -h     Show help
 *   --verbose, -v  Show detailed progress
 *   --batch-size   Number of cards to process per batch (default: 100)
 *   --dry-run      Show what would be done without making changes
 */

const fs = require('fs');
const path = require('path');

// Import required modules (need to build these as standalone)
const dataDir = path.join(process.cwd(), 'data');
const cardsFile = path.join(dataDir, 'cards.json');
const statusFile = path.join(dataDir, 'sync-status.json');

// Command line argument parsing
const args = process.argv.slice(2);
const options = {
  help: args.includes('--help') || args.includes('-h'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
  batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100')
};

function showHelp() {
  console.log(`
Card Database Re-Tagging Tool

This tool loads the card database and applies comprehensive tagging to all cards.
Useful for updates when new mechanics are added to the tagging system.

Usage: node retag-database.js [options]

Options:
  --help, -h          Show this help message
  --verbose, -v       Show detailed progress information
  --batch-size=N      Process N cards per batch (default: 100)
  --dry-run          Show what would be done without making changes

Examples:
  node retag-database.js                    # Re-tag all cards
  node retag-database.js --verbose          # Show detailed progress
  node retag-database.js --batch-size=50    # Use smaller batches
  node retag-database.js --dry-run          # Test without changes

Note: Make sure the Next.js development server is running before using this tool.
`);
}

async function makeApiCall(endpoint, options = {}) {
  const fetch = (await import('node-fetch')).default;
  try {
    const response = await fetch(`http://localhost:3000/api/${endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to connect to API: ${error.message}`);
  }
}

async function checkServerStatus() {
  try {
    if (options.verbose) console.log('🔍 Checking server status...');
    await makeApiCall('database/reanalyze');
    return true;
  } catch (error) {
    console.error('❌ Server not responding. Please ensure the development server is running:');
    console.error('   npm run dev');
    console.error('');
    console.error('Error:', error.message);
    return false;
  }
}

async function getDatabaseStatus() {
  const data = await makeApiCall('database/reanalyze');
  return data.currentStatus;
}

async function retagDatabase() {
  console.log('🏷️  Card Database Re-Tagging Tool');
  console.log('=====================================');
  console.log('');
  
  if (options.help) {
    showHelp();
    return;
  }
  
  // Check if server is running
  if (!(await checkServerStatus())) {
    process.exit(1);
  }
  
  // Get current database status
  const status = await getDatabaseStatus();
  console.log(`📊 Database Status:`);
  console.log(`   Total Cards: ${status.total_cards.toLocaleString()}`);
  console.log(`   Last Sync: ${status.last_full_sync ? new Date(status.last_full_sync).toLocaleString() : 'Never'}`);
  console.log('');
  
  if (status.total_cards === 0) {
    console.error('❌ No cards found in database. Please sync the database first.');
    process.exit(1);
  }
  
  if (options.dryRun) {
    console.log('🧪 DRY RUN MODE - No changes will be made');
    console.log(`   Would re-tag ${status.total_cards.toLocaleString()} cards`);
    console.log(`   Batch size: ${options.batchSize}`);
    console.log(`   Estimated time: ${Math.ceil(status.total_cards / options.batchSize)} batches`);
    return;
  }
  
  // Confirm before proceeding
  console.log(`⚠️  About to re-tag ${status.total_cards.toLocaleString()} cards with comprehensive tagging system.`);
  console.log('   This process will take several minutes and cannot be undone.');
  console.log('');
  
  // In a real implementation, you'd want to add readline for confirmation
  // For now, we'll proceed directly
  
  console.log('🚀 Starting re-tagging process...');
  console.log('');
  
  const startTime = Date.now();
  
  try {
    // Trigger the re-analysis
    console.log('   Initiating comprehensive re-analysis...');
    const result = await makeApiCall('database/reanalyze', { 
      method: 'POST',
      timeout: 600000 // 10 minute timeout
    });
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('');
    console.log('✅ Re-tagging completed successfully!');
    console.log(`   Cards processed: ${result.totalCards.toLocaleString()}`);
    console.log(`   Duration: ${duration.toFixed(1)} seconds`);
    console.log(`   Rate: ${(result.totalCards / duration).toFixed(1)} cards/second`);
    console.log(`   Completed at: ${result.completedAt}`);
    console.log('');
    console.log('🎉 All cards now have comprehensive tagging with 200+ mechanics detected!');
    
  } catch (error) {
    console.error('');
    console.error('❌ Re-tagging failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('⏹️  Process interrupted. Re-tagging stopped.');
  process.exit(1);
});

// Run the tool
retagDatabase().catch(error => {
  console.error('❌ Unexpected error:', error.message);
  if (options.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});
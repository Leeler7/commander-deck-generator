#!/usr/bin/env node

/**
 * Scryfall Tagger Tag Fetcher
 *
 * Fetches community tag data from Scryfall's public search API using otag: syntax.
 * Produces a tagger-tags.json file compatible with the deck engine's tagger-client.ts.
 *
 * Usage: node fetch-tagger-tags.js [options]
 *
 * Options:
 *   --help, -h          Show help
 *   --verbose, -v       Show detailed progress (per-page counts)
 *   --dry-run           Fetch page 1 of each tag to show estimates, don't write file
 *   --tags=a,b,c        Fetch only specific tags (comma-separated)
 *   --output=PATH       Override output file path (default: data/tagger-tags.json)
 */

const fs = require('fs');
const path = require('path');

// Resolve paths relative to project root (one level up from tools/)
const projectRoot = path.resolve(__dirname, '..');

// All 20 tags expected by tagger-client.ts
const ALL_TAGS = [
  // Roles
  'boardwipe', 'removal', 'protection',
  // Ramp subtypes
  'ramp', 'cost-reducer', 'mana-dork', 'mana-rock',
  // Card draw subtypes
  'card-advantage', 'tutor', 'draw', 'wheel', 'looting', 'cantrip',
  // Protection / removal subtypes
  'counterspell', 'bounce', 'spot-removal',
  // Land tags
  'utility-land', 'tapland',
  // Special mechanics
  'mass-land-denial', 'extra-turn',
];

const SCRYFALL_SEARCH_URL = 'https://api.scryfall.com/cards/search';
const REQUEST_DELAY_MS = 150;
const TAG_DELAY_MS = 300;
const RATE_LIMIT_BACKOFF_MS = 2000;
const MAX_RETRIES = 3;

// CLI argument parsing
const args = process.argv.slice(2);
const options = {
  help: args.includes('--help') || args.includes('-h'),
  verbose: args.includes('--verbose') || args.includes('-v'),
  dryRun: args.includes('--dry-run'),
  tags: args.find(a => a.startsWith('--tags='))?.split('=')[1]?.split(',').filter(Boolean) || null,
  output: args.find(a => a.startsWith('--output='))?.split('=')[1] || null,
};

function showHelp() {
  console.log(`
Scryfall Tagger Tag Fetcher

Fetches community tag data from Scryfall's search API for all 19 tags
used by the deck engine's role classification system.

Usage: node fetch-tagger-tags.js [options]

Options:
  --help, -h          Show this help message
  --verbose, -v       Show detailed progress (per-page counts)
  --dry-run           Fetch page 1 of each tag to show estimates, don't write file
  --tags=a,b,c        Fetch only specific tags (comma-separated)
  --output=PATH       Override output file path (default: data/tagger-tags.json)

Available tags (${ALL_TAGS.length}):
  ${ALL_TAGS.join(', ')}

Examples:
  node fetch-tagger-tags.js --verbose
  node fetch-tagger-tags.js --dry-run
  node fetch-tagger-tags.js --tags=boardwipe,removal --verbose
  node fetch-tagger-tags.js --output=../public/tagger-tags.json
`);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let interrupted = false;
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Interrupted — no file written.');
  interrupted = true;
  process.exit(1);
});

async function fetchWithRetry(url, fetchFn, retries = 0) {
  const res = await fetchFn(url, {
    headers: {
      'User-Agent': 'BigDeckEnergy/1.0 (commander deck generator)',
      'Accept': 'application/json',
    },
  });

  if (res.status === 429) {
    if (retries >= MAX_RETRIES) {
      throw new Error(`Rate limited after ${MAX_RETRIES} retries on ${url}`);
    }
    const wait = RATE_LIMIT_BACKOFF_MS * (retries + 1);
    console.log(`  ⏳ Rate limited, waiting ${wait}ms (retry ${retries + 1}/${MAX_RETRIES})...`);
    await sleep(wait);
    return fetchWithRetry(url, fetchFn, retries + 1);
  }

  return res;
}

async function fetchTagCards(tag, fetchFn, dryRun) {
  const cards = [];
  let page = 1;
  let url = `${SCRYFALL_SEARCH_URL}?q=otag%3A${encodeURIComponent(tag)}&unique=cards&order=name`;

  while (url && !interrupted) {
    const res = await fetchWithRetry(url, fetchFn);

    // 404 means no cards have this tag
    if (res.status === 404) {
      console.log(`  ⚠️  Tag "${tag}" returned no results (404)`);
      return cards;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} fetching tag "${tag}" page ${page}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const pageCards = (data.data || []).map(card => card.name);
    cards.push(...pageCards);

    if (options.verbose) {
      console.log(`    Page ${page}: ${pageCards.length} cards (${cards.length} total)`);
    }

    // In dry-run mode, only fetch page 1 and use total_cards for estimate
    if (dryRun) {
      return { cards, totalEstimate: data.total_cards || cards.length };
    }

    if (data.has_more && data.next_page) {
      url = data.next_page;
      page++;
      await sleep(REQUEST_DELAY_MS);
    } else {
      url = null;
    }
  }

  return cards;
}

async function main() {
  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('');
  console.log('🏷️  Scryfall Tagger Tag Fetcher');
  console.log('─'.repeat(40));

  // Dynamic import for ESM node-fetch
  const { default: fetch } = await import('node-fetch');

  const tagsToFetch = options.tags || ALL_TAGS;
  const outputPath = options.output
    ? path.resolve(options.output)
    : path.join(projectRoot, 'data', 'tagger-tags.json');

  // Validate --tags filter
  if (options.tags) {
    const invalid = options.tags.filter(t => !ALL_TAGS.includes(t));
    if (invalid.length) {
      console.error(`❌ Unknown tags: ${invalid.join(', ')}`);
      console.error(`   Valid tags: ${ALL_TAGS.join(', ')}`);
      process.exit(1);
    }
    console.log(`📋 Fetching ${tagsToFetch.length} of ${ALL_TAGS.length} tags: ${tagsToFetch.join(', ')}`);
  } else {
    console.log(`📋 Fetching all ${tagsToFetch.length} tags`);
  }

  if (options.dryRun) {
    console.log('🔍 Dry run — fetching page 1 of each tag for estimates\n');
  } else {
    console.log(`📁 Output: ${outputPath}\n`);
  }

  const startTime = Date.now();
  const results = {};
  let totalCards = 0;

  for (let i = 0; i < tagsToFetch.length; i++) {
    if (interrupted) break;

    const tag = tagsToFetch[i];
    const progress = `[${i + 1}/${tagsToFetch.length}]`;

    if (options.dryRun) {
      const result = await fetchTagCards(tag, fetch, true);
      const estimate = result.totalEstimate || result.cards?.length || 0;
      console.log(`  ${progress} otag:${tag} — ~${estimate} cards`);
      totalCards += estimate;
    } else {
      process.stdout.write(`  ${progress} otag:${tag}...`);
      const cards = await fetchTagCards(tag, fetch, false);
      results[tag] = cards;
      totalCards += cards.length;
      // Clear the "..." line and print final count
      process.stdout.write(`\r  ${progress} otag:${tag} — ${cards.length} cards\n`);
    }

    // Delay between tags
    if (i < tagsToFetch.length - 1) {
      await sleep(TAG_DELAY_MS);
    }
  }

  if (interrupted) return;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (options.dryRun) {
    console.log(`\n✅ Dry run complete — ~${totalCards} total card entries across ${tagsToFetch.length} tags (${elapsed}s)`);
    console.log('   Run without --dry-run to generate the file.');
    return;
  }

  // Build output
  const taggerData = {
    generatedAt: new Date().toISOString(),
    tags: results,
  };

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  // Write file
  const json = JSON.stringify(taggerData, null, 2);
  fs.writeFileSync(outputPath, json, 'utf-8');

  const fileSizeMB = (Buffer.byteLength(json) / (1024 * 1024)).toFixed(2);

  console.log('');
  console.log('─'.repeat(40));
  console.log(`✅ Done! ${tagsToFetch.length} tags, ${totalCards} total card entries (${elapsed}s)`);
  console.log(`📁 Written to ${outputPath} (${fileSizeMB} MB)`);

  // Summary table
  if (options.verbose) {
    console.log('\nTag summary:');
    for (const [tag, cards] of Object.entries(results)) {
      console.log(`  ${tag.padEnd(20)} ${cards.length} cards`);
    }
  }
}

main().catch(err => {
  console.error(`\n❌ Error: ${err.message}`);
  if (options.verbose) console.error(err.stack);
  process.exit(1);
});

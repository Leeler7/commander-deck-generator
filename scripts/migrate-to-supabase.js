#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local if present
try {
  const envLocal = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocal)) {
    const envContent = fs.readFileSync(envLocal, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, value] = line.split('=');
      if (key && value && !process.env[key]) {
        process.env[key] = value;
      }
    });
  }
} catch (e) {
  // Ignore env loading errors
}

// Configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const DATA_DIR = path.join(process.cwd(), 'data');
const CARDS_FILE = path.join(DATA_DIR, 'cards.json');

async function migrateToSupabase() {
  console.log('🚀 Starting migration to Supabase...\n');
  
  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
    console.log('💡 Get your service key from: https://supabase.com/dashboard/project/bykbnagijmxtfpkaflae/settings/api');
    console.log('💡 Then run: SUPABASE_SERVICE_KEY=your_key_here node scripts/migrate-to-supabase.js');
    process.exit(1);
  }
  
  // Initialize Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  
  try {
    // Load local database
    if (!fs.existsSync(CARDS_FILE)) {
      console.error('❌ No local database found at', CARDS_FILE);
      console.log('💡 Run: npm run db:download first');
      process.exit(1);
    }
    
    console.log('📖 Loading local database...');
    const cardsData = fs.readFileSync(CARDS_FILE, 'utf8');
    const cardsObject = JSON.parse(cardsData);
    const cards = Object.values(cardsObject);
    
    console.log(`✅ Loaded ${cards.length} cards from local database`);
    
    // Clear existing data (fresh start)
    console.log('🗑️ Clearing existing data...');
    await supabase.from('card_tags').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('cards').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // Migrate cards in batches
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalTags = 0;
    
    for (let i = 0; i < cards.length; i += BATCH_SIZE) {
      const batch = cards.slice(i, i + BATCH_SIZE);
      const progress = Math.round((i / cards.length) * 100);
      
      console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${progress}%)...`);
      
      // Prepare card records
      const cardRecords = batch.map(card => ({
        id: card.id,
        name: card.name,
        mana_cost: card.mana_cost || null,
        cmc: Math.round(Number(card.cmc)) || 0,
        type_line: card.type_line || '',
        oracle_text: card.oracle_text || '',
        flavor_text: card.flavor_text || '',
        power: card.power || '',
        toughness: card.toughness || '',
        loyalty: card.loyalty || '',
        color_identity: card.color_identity || [],
        colors: card.colors || [],
        keywords: card.keywords || [],
        set_code: card.set_code || '',
        set_name: card.set_name || '',
        rarity: card.rarity || 'common',
        collector_number: card.collector_number || '',
        legalities: card.legalities || {},
        prices: card.prices || {},
        edhrec_rank: card.edhrec_rank ? Number(card.edhrec_rank) : null,
        image_uris: card.image_uris || {},
        last_updated: card.last_updated || new Date().toISOString(),
        scryfall_uri: card.scryfall_uri || '',
        primary_type: card.mechanics?.primaryType || '',
        functional_roles: card.mechanics?.functionalRoles || [],
        synergy_keywords: card.mechanics?.synergyKeywords || [],
        power_level: card.mechanics?.powerLevel || 5,
        archetype_relevance: card.mechanics?.archetypeRelevance || [],
        last_analyzed: card.mechanics?.lastAnalyzed || null
      }));
      
      // Insert cards
      const { data: insertedCards, error: cardError } = await supabase
        .from('cards')
        .insert(cardRecords)
        .select('id');
      
      if (cardError) {
        console.error('❌ Error inserting cards:', cardError);
        throw cardError;
      }
      
      totalInserted += insertedCards.length;
      
      // Prepare and insert tags
      const tagRecords = [];
      batch.forEach(card => {
        if (card.mechanics?.mechanicTags && Array.isArray(card.mechanics.mechanicTags)) {
          card.mechanics.mechanicTags.forEach(tag => {
            if (typeof tag === 'string') {
              // Simple string tag (manually added)
              tagRecords.push({
                card_id: card.id,
                tag_name: tag,
                tag_category: 'manual',
                confidence: 1.0,
                priority: 5,
                evidence: [],
                is_manual: true
              });
            } else if (tag && tag.name) {
              // Structured tag (from analysis)
              tagRecords.push({
                card_id: card.id,
                tag_name: tag.name,
                tag_category: tag.category || 'unknown',
                confidence: tag.confidence || 1.0,
                priority: tag.priority ? Number(tag.priority) : 5,
                evidence: tag.evidence || [],
                is_manual: false
              });
            }
          });
        }
      });
      
      if (tagRecords.length > 0) {
        const { error: tagError } = await supabase
          .from('card_tags')
          .insert(tagRecords);
        
        if (tagError) {
          console.error('❌ Error inserting tags:', tagError);
          throw tagError;
        }
        
        totalTags += tagRecords.length;
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update sync status
    await supabase
      .from('database_sync_status')
      .update({
        last_full_sync: new Date().toISOString(),
        total_cards: totalInserted,
        sync_in_progress: false,
        sync_progress: 100
      })
      .eq('id', (await supabase.from('database_sync_status').select('id').single()).data.id);
    
    console.log('\n✅ Migration completed successfully!');
    console.log(`📊 Cards inserted: ${totalInserted}`);
    console.log(`🏷️ Tags inserted: ${totalTags}`);
    console.log(`🗄️ Database URL: https://supabase.com/dashboard/project/bykbnagijmxtfpkaflae/editor`);
    
    // Verify migration
    console.log('\n🔍 Verifying migration...');
    const { count: cardCount } = await supabase
      .from('cards')
      .select('*', { count: 'exact', head: true });
    
    const { count: tagCount } = await supabase
      .from('card_tags')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Verified: ${cardCount} cards, ${tagCount} tags in database`);
    
    // Check for dice tags specifically
    const { count: diceCount } = await supabase
      .from('card_tags')
      .select('*', { count: 'exact', head: true })
      .eq('tag_name', 'dice');
    
    console.log(`🎲 Found ${diceCount} cards with 'dice' tag`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  migrateToSupabase().catch(console.error);
}

module.exports = { migrateToSupabase };
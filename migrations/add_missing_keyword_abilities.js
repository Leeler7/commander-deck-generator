const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5a2JuYWdpam14dGZwa2FmbGFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxNDk3NiwiZXhwIjoyMDcxMTkwOTc2fQ.6jXdlBNL8ek3N8uLKdCDmApOTdTz7p5kopbQ6w7DXo4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Complete list of MTG keyword abilities
const keywordAbilities = [
  // Evergreen abilities
  'Deathtouch', 'Defender', 'Double Strike', 'Enchant', 'Equip', 'First Strike', 
  'Flash', 'Flying', 'Haste', 'Hexproof', 'Indestructible', 'Lifelink', 'Menace', 
  'Protection', 'Reach', 'Trample', 'Vigilance', 'Ward',
  
  // Non-evergreen abilities (A-C)
  'Absorb', 'Affinity', 'Afflict', 'Afterlife', 'Aftermath', 'Amplify', 'Annihilator', 
  'Ascend', 'Assist', 'Aura Swap', 'Awaken', 'Backup', 'Banding', 'Bargain', 
  'Battle Cry', 'Bestow', 'Blitz', 'Bloodthirst', 'Boast', 'Bushido', 'Buyback', 
  'Cascade', 'Casualty', 'Champion', 'Changeling', 'Cipher', 'Cleave', 'Companion', 
  'Compleated', 'Conspire', 'Convoke', 'Craft', 'Crew', 'Cumulative Upkeep', 'Cycling',
  
  // D-F
  'Dash', 'Daybound', 'Decayed', 'Delve', 'Demonstrate', 'Dethrone', 'Devoid', 
  'Devour', 'Disguise', 'Disturb', 'Dredge', 'Echo', 'Embalm', 'Emerge', 'Encore', 
  'Enlist', 'Entwine', 'Epic', 'Escalate', 'Escape', 'Eternalize', 'Evoke', 'Evolve', 
  'Exalted', 'Exploit', 'Extort', 'Fabricate', 'Fading', 'Fear', 'Flanking', 
  'Flashback', 'Forecast', 'Foretell', 'Fortify', 'For Mirrodin!', 'Freerunning', 
  'Frenzy', 'Fuse',
  
  // G-L
  'Graft', 'Gravestorm', 'Haunt', 'Hidden Agenda', 'Hideaway', 'Horsemanship', 
  'Impending', 'Improvise', 'Infect', 'Ingest', 'Intimidate', 'Jump-Start', 'Kicker', 
  'Landwalk', 'Level Up', 'Living Metal', 'Living Weapon',
  
  // M-P
  'Madness', 'Melee', 'Mentor', 'Miracle', 'Modular', 'More Than Meets the Eye', 
  'Morph', 'Mutate', 'Myriad', 'Ninjutsu', 'Offering', 'Offspring', 'Outlast', 
  'Overload', 'Partner', 'Persist', 'Phasing', 'Plot', 'Poisonous', 'Prowess', 
  'Prowl',
  
  // R-S
  'Raid', 'Rally', 'Rampage', 'Ravenous', 'Read ahead', 'Rebound', 'Reconfigure', 
  'Recover', 'Reinforce', 'Renown', 'Replicate', 'Retrace', 'Riot', 'Ripple', 
  'Scavenge', 'Shadow', 'Shroud', 'Skulk', 'Solved', 'Soulbond', 'Soulshift', 
  'Space sculptor', 'Spectacle', 'Splice', 'Split second', 'Spree', 'Squad',
  
  // S-Z (continued)
  'Storm', 'Strive', 'Sunburst', 'Support', 'Surge', 'Suspend', 'Threshold', 
  'Toxic', 'Training', 'Transform', 'Transmute', 'Treasure', 'Tribute', 'Undaunted', 
  'Unearth', 'Unleash', 'Vanishing', 'Venture into the dungeon', 'Vigilance', 
  'Wither'
];

async function addMissingKeywordAbilities() {
  console.log('🏷️ Adding missing keyword abilities to tags table...\n');
  
  try {
    // First, get existing tags to avoid duplicates
    console.log('📋 Checking existing tags...');
    const { data: existingTags, error: fetchError } = await supabase
      .from('tags')
      .select('name')
      .ilike('name', 'ability_keyword_%');
    
    if (fetchError) {
      throw fetchError;
    }
    
    const existingNames = new Set(existingTags.map(tag => tag.name.toLowerCase()));
    console.log(`✅ Found ${existingNames.size} existing ability_keyword_ tags`);
    
    // Prepare new tags to insert
    const newTags = [];
    const skippedTags = [];
    
    keywordAbilities.forEach(keyword => {
      const tagName = `ability_keyword_${keyword.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      
      if (!existingNames.has(tagName.toLowerCase())) {
        newTags.push({
          name: tagName,
          category: 'ability_words',
          description: `Magic keyword ability: ${keyword}`,
          synergy_weight: 1.2, // Keyword abilities get higher synergy weight
          is_active: true
        });
      } else {
        skippedTags.push(tagName);
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total keyword abilities: ${keywordAbilities.length}`);
    console.log(`   New tags to add: ${newTags.length}`);
    console.log(`   Already existing: ${skippedTags.length}`);
    
    if (newTags.length === 0) {
      console.log('\n✅ All keyword abilities already exist in the database!');
      return;
    }
    
    console.log(`\n🔄 Adding ${newTags.length} new keyword ability tags...`);
    
    // Insert in batches of 50 to avoid size limits
    const batchSize = 50;
    let insertedCount = 0;
    
    for (let i = 0; i < newTags.length; i += batchSize) {
      const batch = newTags.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('tags')
        .insert(batch);
      
      if (insertError) {
        console.error(`❌ Error inserting batch ${Math.floor(i/batchSize) + 1}:`, insertError);
        throw insertError;
      }
      
      insertedCount += batch.length;
      console.log(`   ✅ Inserted batch ${Math.floor(i/batchSize) + 1}: ${insertedCount}/${newTags.length} tags`);
    }
    
    console.log(`\n✅ Successfully added ${insertedCount} new keyword ability tags!`);
    console.log('\n📋 Sample new tags:');
    newTags.slice(0, 10).forEach(tag => {
      console.log(`   ${tag.name} - "${tag.description}"`);
    });
    
    if (newTags.length > 10) {
      console.log(`   ... and ${newTags.length - 10} more`);
    }
    
  } catch (error) {
    console.error('\n❌ Failed to add keyword abilities:', error);
    process.exit(1);
  }
}

addMissingKeywordAbilities();
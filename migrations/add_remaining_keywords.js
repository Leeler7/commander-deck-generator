const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5a2JuYWdpam14dGZwa2FmbGFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxNDk3NiwiZXhwIjoyMDcxMTkwOTc2fQ.6jXdlBNL8ek3N8uLKdCDmApOTdTz7p5kopbQ6w7DXo4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Keywords that appear to be missing based on the list
const missingKeywords = [
  'Space sculptor', 'Spectacle', 'Split second', 'Spree', 'Squad', 'Storm', 
  'Strive', 'Sunburst', 'Support', 'Surge', 'Suspend', 'Threshold', 'Toxic', 
  'Training', 'Transform', 'Transmute', 'Treasure', 'Tribute', 'Undaunted', 
  'Unearth', 'Unleash', 'Vanishing', 'Venture into the dungeon', 'Wither'
];

async function addRemainingKeywords() {
  console.log('🏷️ Adding remaining keyword abilities...\n');
  
  try {
    // Get existing ability_keyword_ tags to check what we actually need
    const { data: existing, error: fetchError } = await supabase
      .from('tags')
      .select('name')
      .like('name', 'ability_keyword_%');
    
    if (fetchError) throw fetchError;
    
    const existingSet = new Set(existing.map(tag => tag.name.toLowerCase()));
    
    const tagsToAdd = [];
    missingKeywords.forEach(keyword => {
      const tagName = `ability_keyword_${keyword.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      
      if (!existingSet.has(tagName.toLowerCase())) {
        tagsToAdd.push({
          name: tagName,
          category: 'ability_words',
          description: `Magic keyword ability: ${keyword}`,
          synergy_weight: 1.2,
          is_active: true
        });
      }
    });
    
    if (tagsToAdd.length === 0) {
      console.log('✅ All keyword abilities are already present!');
      return;
    }
    
    console.log(`📋 Adding ${tagsToAdd.length} missing keyword abilities:`);
    tagsToAdd.forEach(tag => console.log(`   ${tag.name}`));
    
    const { error: insertError } = await supabase
      .from('tags')
      .insert(tagsToAdd);
    
    if (insertError) throw insertError;
    
    console.log(`\n✅ Successfully added ${tagsToAdd.length} keyword abilities!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

addRemainingKeywords();
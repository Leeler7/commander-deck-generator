const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5a2JuYWdpam14dGZwa2FmbGFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxNDk3NiwiZXhwIjoyMDcxMTkwOTc2fQ.6jXdlBNL8ek3N8uLKdCDmApOTdTz7p5kopbQ6w7DXo4';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkExistingAbilities() {
  try {
    // Get all tags that might be ability-related
    const { data: allTags, error } = await supabase
      .from('tags')
      .select('name, category')
      .or('name.ilike.%ability%,name.ilike.%keyword%,name.ilike.%vigilance%,name.ilike.%flying%,name.ilike.%trample%')
      .order('name');
    
    if (error) {
      throw error;
    }
    
    console.log(`🔍 Found ${allTags.length} existing ability-related tags:\n`);
    
    allTags.forEach(tag => {
      console.log(`   ${tag.name} (${tag.category || 'no category'})`);
    });
    
    console.log('\n📊 Categories:');
    const categories = {};
    allTags.forEach(tag => {
      const cat = tag.category || 'no category';
      categories[cat] = (categories[cat] || 0) + 1;
    });
    
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`   ${category}: ${count} tags`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkExistingAbilities();
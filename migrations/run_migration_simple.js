const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5a2JuYWdpam14dGZwa2FmbGFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxNDk3NiwiZXhwIjoyMDcxMTkwOTc2fQ.6jXdlBNL8ek3N8uLKdCDmApOTdTz7p5kopbQ6w7DXo4';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  console.log('Set it with: set SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function step1_createTagsTable() {
  console.log('🔄 Step 1: Creating tags table...');
  
  // We'll run this manually via Supabase SQL editor, but let's prepare the data migration
  const { data, error } = await supabase.rpc('sql', {
    query: `
      -- This would be run manually in Supabase SQL editor
      SELECT 'Run the SQL files manually in Supabase SQL editor first' as message;
    `
  });
  
  console.log('ℹ️  Please run 001_create_normalized_tags.sql in your Supabase SQL editor first');
}

async function step2_populateTagsFromCardTags() {
  console.log('🔄 Step 2: Analyzing current tag structure...');
  
  try {
    // Get unique tags from current structure
    const { data: uniqueTags, error } = await supabase
      .from('card_tags')
      .select('tag_name, tag_category')
      .not('tag_name', 'is', null);
    
    if (error) {
      throw error;
    }
    
    // Group by unique tag_name, tag_category combinations
    const tagMap = new Map();
    
    uniqueTags.forEach(row => {
      const key = `${row.tag_name}:${row.tag_category || 'uncategorized'}`;
      if (!tagMap.has(key)) {
        tagMap.set(key, {
          name: row.tag_name,
          category: row.tag_category || 'uncategorized',
          count: 0
        });
      }
      tagMap.get(key).count++;
    });
    
    const uniqueTagsList = Array.from(tagMap.values());
    
    console.log(`📊 Analysis complete:`);
    console.log(`   Total tag records: ${uniqueTags.length}`);
    console.log(`   Unique tags: ${uniqueTagsList.length}`);
    console.log(`   Storage reduction: ${Math.round((1 - uniqueTagsList.length / uniqueTags.length) * 100)}%`);
    
    // Show top categories
    const categoryCount = {};
    uniqueTagsList.forEach(tag => {
      categoryCount[tag.category] = (categoryCount[tag.category] || 0) + 1;
    });
    
    console.log('\n📈 Top tag categories:');
    Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([category, count]) => {
        console.log(`   ${category}: ${count} tags`);
      });
    
    // Show sample tags
    console.log('\n🏷️  Sample tags:');
    uniqueTagsList.slice(0, 10).forEach(tag => {
      console.log(`   ${tag.name} (${tag.category}) - used ${tag.count} times`);
    });
    
    return uniqueTagsList;
    
  } catch (error) {
    console.error('❌ Error analyzing tags:', error);
    throw error;
  }
}

async function step3_verifyMigration() {
  console.log('🔍 Step 3: Verifying migration...');
  
  try {
    // Check if tags table exists and has data
    const { data: tags, error: tagsError, count: tagsCount } = await supabase
      .from('tags')
      .select('*', { count: 'exact', head: true });
    
    if (tagsError && tagsError.code === '42P01') {
      console.log('⚠️  Tags table does not exist yet. Run the SQL migration first.');
      return false;
    } else if (tagsError) {
      throw tagsError;
    }
    
    console.log(`✅ Tags table: ${tagsCount} unique tags`);
    
    // Check card_tags table has tag_id column
    const { data: sampleCardTags, error: cardTagsError } = await supabase
      .from('card_tags')
      .select('card_id, tag_id, tag_name, tag_category')
      .limit(5);
    
    if (cardTagsError) {
      console.error('❌ Error checking card_tags:', cardTagsError);
      return false;
    }
    
    const hasTagId = sampleCardTags.some(row => row.tag_id !== null);
    const hasOldFields = sampleCardTags.some(row => row.tag_name !== null);
    
    console.log(`✅ Card tags sample retrieved`);
    console.log(`   Has tag_id: ${hasTagId}`);
    console.log(`   Still has old tag_name: ${hasOldFields}`);
    
    if (hasTagId && hasOldFields) {
      console.log('✅ Migration appears successful - both old and new structures present');
      return true;
    } else if (!hasTagId) {
      console.log('⚠️  Migration incomplete - tag_id not populated yet');
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Error verifying migration:', error);
    return false;
  }
}

async function main() {
  console.log('🚀 Tag Structure Migration Analysis\n');
  
  try {
    // Analyze current structure
    const uniqueTags = await step2_populateTagsFromCardTags();
    
    // Check if migration has been run
    const migrationComplete = await step3_verifyMigration();
    
    if (!migrationComplete) {
      console.log('\n📋 Migration Steps:');
      console.log('1. Run 001_create_normalized_tags.sql in Supabase SQL Editor');
      console.log('2. Run this script again to verify');
      console.log('3. Update application code to use new structure');
      console.log('4. Run 002_cleanup_legacy_structure.sql to cleanup');
    } else {
      console.log('\n✅ Migration appears complete!');
      console.log('Next: Update application code to use the new tag structure');
    }
    
  } catch (error) {
    console.error('\n❌ Analysis failed:', error);
    process.exit(1);
  }
}

main();
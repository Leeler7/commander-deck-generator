const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function testCurrentStructure() {
  console.log('🔍 Testing current database structure...\n');
  
  try {
    // Test 1: Check if tags table exists
    console.log('📋 Test 1: Checking if tags table exists...');
    const { data: tagsData, error: tagsError } = await supabase
      .from('tags')
      .select('*')
      .limit(1);
    
    if (tagsError && tagsError.code === '42P01') {
      console.log('❌ Tags table does not exist - migration needed');
      console.log('   Need to manually create tags table in Supabase SQL Editor');
    } else if (tagsError) {
      console.log('❌ Error accessing tags table:', tagsError);
    } else {
      console.log('✅ Tags table exists and is accessible');
    }
    
    // Test 2: Check card_tags structure
    console.log('\n📋 Test 2: Checking card_tags structure...');
    const { data: cardTagsData, error: cardTagsError } = await supabase
      .from('card_tags')
      .select('card_id, tag_name, tag_category, tag_id')
      .limit(3);
    
    if (cardTagsError) {
      console.log('❌ Error accessing card_tags:', cardTagsError);
      if (cardTagsError.message.includes('tag_id')) {
        console.log('   tag_id column does not exist yet - migration needed');
      }
    } else {
      console.log('✅ card_tags accessible');
      if (cardTagsData && cardTagsData.length > 0) {
        const sample = cardTagsData[0];
        console.log(`   Sample: ${sample.tag_name} (${sample.tag_category})`);
        console.log(`   Has tag_id: ${sample.tag_id !== null ? 'Yes' : 'No'}`);
      }
    }
    
    // Test 3: Get current tag statistics
    console.log('\n📋 Test 3: Current tag statistics...');
    const { data: allTags, error: statsError } = await supabase
      .from('card_tags')
      .select('tag_name, tag_category');
    
    if (statsError) {
      console.log('❌ Error getting tag statistics:', statsError);
    } else {
      const tagMap = new Map();
      allTags.forEach(tag => {
        const key = `${tag.tag_name}:${tag.tag_category || 'uncategorized'}`;
        tagMap.set(key, (tagMap.get(key) || 0) + 1);
      });
      
      console.log(`✅ Current statistics:`);
      console.log(`   Total tag records: ${allTags.length}`);
      console.log(`   Unique tag combinations: ${tagMap.size}`);
      console.log(`   Potential storage reduction: ${Math.round((1 - tagMap.size / allTags.length) * 100)}%`);
    }
    
    // Test 4: Test the application's current getAvailableTags method
    console.log('\n📋 Test 4: Testing current getAvailableTags...');
    try {
      // This simulates what our application does
      const { data, error } = await supabase
        .from('card_tags')
        .select('tag_name, tag_category')
        .limit(100);
      
      if (error) {
        console.log('❌ Error with current method:', error);
      } else {
        console.log(`✅ Current method works: ${data.length} sample records`);
        const categories = [...new Set(data.map(t => t.tag_category))];
        console.log(`   Categories found: ${categories.slice(0, 5).join(', ')}${categories.length > 5 ? '...' : ''}`);
      }
    } catch (error) {
      console.log('❌ Error testing current method:', error);
    }
    
    console.log('\n📋 Summary:');
    console.log('1. To complete migration, run SQL scripts manually in Supabase SQL Editor');
    console.log('2. Current application will continue to work with backward compatibility');
    console.log('3. After migration, new structure will provide enhanced performance');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

testCurrentStructure();
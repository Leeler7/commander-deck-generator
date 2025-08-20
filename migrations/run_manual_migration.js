const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5a2JuYWdpam14dGZwa2FmbGFlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTYxNDk3NiwiZXhwIjoyMDcxMTkwOTc2fQ.6jXdlBNL8ek3N8uLKdCDmApOTdTz7p5kopbQ6w7DXo4';

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runManualMigration() {
  console.log('🚀 Starting manual tag normalization migration...\n');
  
  try {
    // Step 1: Create tags table
    console.log('📋 Step 1: Creating tags table...');
    const createTagsTable = await supabase.rpc('sql', {
      query: `
        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) UNIQUE NOT NULL,
            category VARCHAR(50),
            description TEXT,
            synergy_weight FLOAT DEFAULT 1.0,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
        CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
        CREATE INDEX IF NOT EXISTS idx_tags_active ON tags(is_active);
      `
    });
    
    if (createTagsTable.error) {
      console.error('❌ Error creating tags table:', createTagsTable.error);
      throw createTagsTable.error;
    }
    
    console.log('✅ Tags table created successfully');
    
    // Step 2: Get unique tags from card_tags
    console.log('📋 Step 2: Getting unique tags from card_tags...');
    const { data: uniqueTags, error: uniqueError } = await supabase
      .from('card_tags')
      .select('tag_name, tag_category')
      .not('tag_name', 'is', null);
    
    if (uniqueError) {
      throw uniqueError;
    }
    
    // Group by unique combinations
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
    console.log(`📊 Found ${uniqueTagsList.length} unique tags from ${uniqueTags.length} records`);
    
    // Step 3: Insert unique tags into tags table
    console.log('📋 Step 3: Inserting unique tags...');
    const tagInserts = uniqueTagsList.map(tag => ({
      name: tag.name,
      category: tag.category,
      synergy_weight: 1.0,
      description: `Auto-generated tag for ${tag.category} category`,
      is_active: true
    }));
    
    // Insert in batches to avoid size limits
    const batchSize = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < tagInserts.length; i += batchSize) {
      const batch = tagInserts.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from('tags')
        .insert(batch);
      
      if (insertError) {
        console.error('❌ Error inserting batch:', insertError);
        throw insertError;
      }
      
      insertedCount += batch.length;
      console.log(`   Inserted ${insertedCount}/${tagInserts.length} tags...`);
    }
    
    console.log('✅ All unique tags inserted successfully');
    
    // Step 4: Add tag_id column to card_tags
    console.log('📋 Step 4: Adding tag_id column to card_tags...');
    const addColumnResult = await supabase.rpc('sql', {
      query: `
        ALTER TABLE card_tags ADD COLUMN IF NOT EXISTS tag_id INTEGER;
        CREATE INDEX IF NOT EXISTS idx_card_tags_tag_id ON card_tags(tag_id);
      `
    });
    
    if (addColumnResult.error) {
      console.error('❌ Error adding tag_id column:', addColumnResult.error);
      throw addColumnResult.error;
    }
    
    console.log('✅ tag_id column added successfully');
    
    // Step 5: Update card_tags with tag_id references
    console.log('📋 Step 5: Updating card_tags with tag_id references...');
    const updateResult = await supabase.rpc('sql', {
      query: `
        UPDATE card_tags 
        SET tag_id = tags.id 
        FROM tags 
        WHERE card_tags.tag_name = tags.name 
        AND COALESCE(card_tags.tag_category, 'uncategorized') = tags.category;
      `
    });
    
    if (updateResult.error) {
      console.error('❌ Error updating tag_id references:', updateResult.error);
      throw updateResult.error;
    }
    
    console.log('✅ tag_id references updated successfully');
    
    // Step 6: Verify the migration
    console.log('📋 Step 6: Verifying migration...');
    const { count: tagsCount } = await supabase
      .from('tags')
      .select('*', { count: 'exact', head: true });
    
    const { count: withIdCount } = await supabase
      .from('card_tags')
      .select('*', { count: 'exact', head: true })
      .not('tag_id', 'is', null);
    
    const { count: withoutIdCount } = await supabase
      .from('card_tags')
      .select('*', { count: 'exact', head: true })
      .is('tag_id', null);
    
    console.log(`📊 Migration verification:`);
    console.log(`   Tags table: ${tagsCount} unique tags`);
    console.log(`   Card tags with tag_id: ${withIdCount} records`);
    console.log(`   Card tags without tag_id: ${withoutIdCount} records`);
    
    if (withoutIdCount > 0) {
      console.warn(`⚠️  Warning: ${withoutIdCount} card_tags records don't have tag_id set`);
    }
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📋 Next steps:');
    console.log('1. Test the application with the new structure');
    console.log('2. Run cleanup migration to remove redundant columns when ready');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runManualMigration();
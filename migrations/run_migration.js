const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase configuration
const SUPABASE_URL = 'https://bykbnagijmxtfpkaflae.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required');
  console.log('Set it with: set SUPABASE_SERVICE_KEY=your_service_key');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration(migrationFile) {
  console.log(`🔄 Running migration: ${migrationFile}`);
  
  try {
    const sqlContent = fs.readFileSync(path.join(__dirname, migrationFile), 'utf8');
    
    // Split the SQL file into individual statements (simple split on semicolon)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'));
    
    console.log(`📝 Found ${statements.length} SQL statements`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (!statement || statement.startsWith('--') || statement.startsWith('/*')) {
        continue;
      }
      
      console.log(`   Executing statement ${i + 1}/${statements.length}...`);
      
      const { data, error } = await supabase.rpc('exec_sql', {
        query: statement + ';'
      });
      
      if (error) {
        console.error(`❌ Error in statement ${i + 1}:`, error);
        console.error(`Statement: ${statement.substring(0, 100)}...`);
        throw error;
      }
    }
    
    console.log(`✅ Migration ${migrationFile} completed successfully`);
    
  } catch (error) {
    console.error(`❌ Migration ${migrationFile} failed:`, error);
    throw error;
  }
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...');
  
  try {
    // Check tags table
    const { data: tagsCount } = await supabase
      .from('tags')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Tags table: ${tagsCount} unique tags`);
    
    // Check card_tags with tag_id
    const { data: cardTagsWithId, count: withIdCount } = await supabase
      .from('card_tags')
      .select('*', { count: 'exact', head: true })
      .not('tag_id', 'is', null);
    
    console.log(`📊 Card tags with tag_id: ${withIdCount} records`);
    
    // Check card_tags without tag_id
    const { data: cardTagsWithoutId, count: withoutIdCount } = await supabase
      .from('card_tags')
      .select('*', { count: 'exact', head: true })
      .is('tag_id', null);
    
    console.log(`📊 Card tags without tag_id: ${withoutIdCount} records`);
    
    if (withoutIdCount > 0) {
      console.warn(`⚠️  Warning: ${withoutIdCount} card_tags records don't have tag_id set`);
    }
    
    // Sample the new structure
    const { data: sampleData, error } = await supabase
      .from('card_tags')
      .select(`
        card_id,
        tag_id,
        confidence,
        priority,
        tags (
          name,
          category,
          synergy_weight
        )
      `)
      .not('tag_id', 'is', null)
      .limit(5);
    
    if (error) {
      console.error('❌ Error sampling new structure:', error);
    } else {
      console.log('✅ Sample of new structure:', JSON.stringify(sampleData, null, 2));
    }
    
    console.log('✅ Migration verification completed');
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error);
    throw error;
  }
}

async function main() {
  console.log('🚀 Starting tag structure migration...\n');
  
  try {
    // Step 1: Run the main migration
    await runMigration('001_create_normalized_tags.sql');
    
    // Step 2: Verify the migration
    await verifyMigration();
    
    console.log('\n✅ Migration completed successfully!');
    console.log('📋 Next steps:');
    console.log('1. Review the verification results above');
    console.log('2. Test the application to ensure it works with the new structure');
    console.log('3. Run 002_cleanup_legacy_structure.sql when ready to cleanup');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Allow running specific functions for testing
if (process.argv[2] === 'verify') {
  verifyMigration();
} else {
  main();
}
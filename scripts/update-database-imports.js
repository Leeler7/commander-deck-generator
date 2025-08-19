#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to update (from the grep results)
const filesToUpdate = [
  'src/app/api/admin/available-tags/route.ts',
  'src/app/api/debug/database-source/route.ts', 
  'src/app/api/admin/bulk-remove-tags/route.ts',
  'src/app/api/admin/apply-tag-addition/route.ts',
  'src/app/api/cards/route.ts',
  'src/app/api/admin/preview-tag-addition/route.ts',
  'src/app/api/admin/preview-tag-removal/route.ts',
  'src/app/api/admin/tag-statistics/route.ts',
  'src/app/api/admin/system-stats/route.ts',
  'src/app/api/admin/export-stats/route.ts',
  'src/app/api/admin/database-health/route.ts',
  'src/app/api/admin/trigger-sync/route.ts',
  'src/app/api/admin/sync-status/route.ts',
  'src/app/api/cards/details/route.ts',
  'src/lib/new-generation-pipeline.ts',
  'src/lib/enhanced-deck-generation.ts',
  'src/app/api/commanders/random/route.ts',
  'src/app/api/force-sync/route.ts',
  'src/app/api/test-sync/route.ts',
  'src/app/api/database/status/route.ts',
  'src/app/api/admin/synergy-calculator/route.ts',
  'src/app/api/admin/update-tags/route.ts',
  'src/app/api/cards/list/route.ts',
  'src/app/api/debug/card-analysis/route.ts',
  'src/app/api/database/reanalyze/route.ts',
  'src/lib/generation.ts',
  'src/lib/candidate-pools.ts',
  'src/app/api/database/search/route.ts',
  'src/lib/scheduled-sync.ts',
  'src/app/api/database/sync/route.ts'
];

// Skip the database-factory file itself
const skipFiles = ['src/lib/database-factory.ts'];

function updateFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ File not found: ${filePath}`);
    return false;
  }
  
  try {
    let content = fs.readFileSync(fullPath, 'utf8');
    let updated = false;
    
    // Replace the import statement
    const oldImportPattern = /import\s+{[^}]*}\s+from\s+['"]@\/lib\/server-card-database['"]/g;
    if (content.match(oldImportPattern)) {
      content = content.replace(oldImportPattern, "import { database } from '@/lib/database-factory'");
      updated = true;
      console.log(`✅ Updated import in: ${filePath}`);
    }
    
    // Replace serverCardDatabase references
    if (content.includes('serverCardDatabase')) {
      // Replace serverCardDatabase.initialize() calls - remove them since database factory handles this
      content = content.replace(/await\s+serverCardDatabase\.initialize\(\);?\s*/g, '');
      content = content.replace(/serverCardDatabase\.initialize\(\);?\s*/g, '');
      
      // Replace other serverCardDatabase calls with database calls, making them async where needed
      content = content.replace(/serverCardDatabase\./g, 'await database.');
      
      // Fix double awaits that might have been created
      content = content.replace(/await\s+await\s+database\./g, 'await database.');
      
      updated = true;
      console.log(`✅ Updated serverCardDatabase references in: ${filePath}`);
    }
    
    if (updated) {
      fs.writeFileSync(fullPath, content);
      return true;
    } else {
      console.log(`ℹ️ No changes needed in: ${filePath}`);
      return false;
    }
    
  } catch (error) {
    console.error(`❌ Error updating ${filePath}:`, error.message);
    return false;
  }
}

console.log('🚀 Starting database import updates...\n');

let updatedCount = 0;
let totalFiles = filesToUpdate.filter(f => !skipFiles.includes(f)).length;

for (const filePath of filesToUpdate) {
  if (skipFiles.includes(filePath)) {
    console.log(`⏭️ Skipping: ${filePath}`);
    continue;
  }
  
  if (updateFile(filePath)) {
    updatedCount++;
  }
  console.log(''); // Add spacing
}

console.log(`\n🎉 Database import update complete!`);
console.log(`📊 Updated ${updatedCount} out of ${totalFiles} files`);
console.log('\n💡 Next steps:');
console.log('1. Test the application with file-based database (current setting)');
console.log('2. Use /admin/database-switch to switch to Supabase');
console.log('3. Test all functionality with Supabase database');
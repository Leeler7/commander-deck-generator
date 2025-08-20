-- Migration: Cleanup Legacy Tag Structure
-- Date: 2025-08-20
-- Purpose: Remove redundant columns after successful migration
-- IMPORTANT: Only run this after verifying the migration worked correctly!

-- Step 1: Verify migration completed successfully
-- Run these checks before proceeding:
/*
SELECT 
    (SELECT COUNT(*) FROM tags) as total_unique_tags,
    (SELECT COUNT(*) FROM card_tags WHERE tag_id IS NOT NULL) as migrated_relationships,
    (SELECT COUNT(*) FROM card_tags WHERE tag_id IS NULL) as unmigrated_relationships;
*/

-- Step 2: Add foreign key constraints (run only after verification)
-- ALTER TABLE card_tags ADD CONSTRAINT fk_card_tags_tag_id 
--     FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE;

-- ALTER TABLE card_tags ADD CONSTRAINT fk_card_tags_card_id 
--     FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE;

-- Step 3: Remove old columns (DANGEROUS - backup first!)
-- Uncomment these lines only after confirming everything works:

-- Remove the redundant tag_name column
-- ALTER TABLE card_tags DROP COLUMN IF EXISTS tag_name;

-- Remove the redundant tag_category column  
-- ALTER TABLE card_tags DROP COLUMN IF EXISTS tag_category;

-- Step 4: Create final optimized indexes
CREATE INDEX IF NOT EXISTS idx_card_tags_confidence ON card_tags(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_card_tags_priority ON card_tags(priority DESC);
CREATE INDEX IF NOT EXISTS idx_card_tags_manual ON card_tags(is_manual);

-- Step 5: Update table constraints
-- ALTER TABLE card_tags ALTER COLUMN tag_id SET NOT NULL;

-- Step 6: Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_card_tags_card_confidence ON card_tags(card_id, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_tags_category_weight ON tags(category, synergy_weight DESC);

-- Verification: Check the final structure
/*
-- Should show significantly reduced storage:
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename IN ('card_tags', 'tags', 'cards')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Should show clean data:
SELECT t.category, COUNT(*) as tag_count, AVG(synergy_weight) as avg_weight
FROM tags t
GROUP BY t.category
ORDER BY tag_count DESC;
*/
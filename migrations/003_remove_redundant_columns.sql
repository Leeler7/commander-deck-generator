-- Migration: Remove Redundant Columns from card_tags
-- Date: 2025-08-20
-- Purpose: Clean up card_tags table by removing evidence, is_manual, and confidence columns
-- These are no longer needed with the normalized tag structure and synergy weights

-- Step 1: Verify the normalized structure exists
-- Run these checks before proceeding:
/*
SELECT 
    (SELECT COUNT(*) FROM tags) as total_tags,
    (SELECT COUNT(*) FROM card_tags WHERE tag_id IS NOT NULL) as normalized_relationships,
    (SELECT COUNT(*) FROM card_tags WHERE tag_id IS NULL) as legacy_relationships;
*/

-- Step 2: Remove redundant columns from card_tags table
-- IMPORTANT: Only run this after confirming the migration to normalized structure is complete!

-- Remove the evidence column (was used for debugging tag application)
-- ALTER TABLE card_tags DROP COLUMN IF EXISTS evidence;

-- Remove the is_manual column (no longer needed with proper tag management)
-- ALTER TABLE card_tags DROP COLUMN IF EXISTS is_manual;

-- Remove the confidence column (replaced by synergy_weight in tags table)
-- ALTER TABLE card_tags DROP COLUMN IF EXISTS confidence;

-- Step 3: Update indexes after column removal
-- Drop any indexes that referenced the removed columns
DROP INDEX IF EXISTS idx_card_tags_confidence;
DROP INDEX IF EXISTS idx_card_tags_manual;

-- Create optimized indexes for the cleaned structure
CREATE INDEX IF NOT EXISTS idx_card_tags_card_priority ON card_tags(card_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_card_tags_tag_priority ON card_tags(tag_id, priority DESC);

-- Step 4: Add constraints to ensure data integrity
-- Ensure priority is within a reasonable range
-- ALTER TABLE card_tags ADD CONSTRAINT chk_card_tags_priority 
--     CHECK (priority >= 1 AND priority <= 10);

-- Verification: Check the cleaned structure
/*
-- Should show a clean, normalized structure:
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'card_tags' 
ORDER BY ordinal_position;

-- Should show the expected columns: id, card_id, tag_id, priority, created_at, (legacy: tag_name, tag_category)
-- Removed columns: evidence, is_manual, confidence
*/
-- Migration: Create Normalized Tag Structure
-- Date: 2025-08-20
-- Purpose: Replace the current card_tags structure with normalized tags table

-- Step 1: Create the new tags table
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

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_category ON tags(category);
CREATE INDEX IF NOT EXISTS idx_tags_active ON tags(is_active);

-- Step 3: Populate tags table with unique tags from card_tags
-- This extracts all unique tag_name, tag_category combinations
INSERT INTO tags (name, category, description, synergy_weight)
SELECT DISTINCT 
    tag_name,
    COALESCE(tag_category, 'uncategorized'),
    CASE 
        WHEN tag_category = 'keyword_abilities' THEN 'Magic keyword abilities like Flying, Trample, etc.'
        WHEN tag_category = 'tribal' THEN 'Creature type tribal synergies'
        WHEN tag_category = 'mechanics' THEN 'Game mechanics and interactions'
        WHEN tag_category = 'resource_generation' THEN 'Cards that generate resources like mana, cards, tokens'
        WHEN tag_category = 'targeting' THEN 'Cards with targeting abilities'
        WHEN tag_category = 'combat' THEN 'Combat-related abilities and mechanics'
        ELSE 'Auto-generated tag from legacy system'
    END,
    CASE 
        WHEN tag_category = 'keyword_abilities' THEN 1.2
        WHEN tag_category = 'tribal' THEN 1.5
        WHEN tag_category = 'mechanics' THEN 1.0
        ELSE 0.8
    END
FROM card_tags 
WHERE tag_name IS NOT NULL 
AND tag_name != ''
ON CONFLICT (name) DO NOTHING;

-- Step 4: Add tag_id column to existing card_tags table
ALTER TABLE card_tags ADD COLUMN IF NOT EXISTS tag_id INTEGER;

-- Step 5: Create foreign key relationship (but don't enforce yet)
-- We'll add the constraint after data migration

-- Step 6: Update card_tags with tag_id values
UPDATE card_tags 
SET tag_id = tags.id
FROM tags 
WHERE card_tags.tag_name = tags.name;

-- Step 7: Create indexes on the new structure
CREATE INDEX IF NOT EXISTS idx_card_tags_tag_id ON card_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_card_tags_card_tag ON card_tags(card_id, tag_id);

-- Verification queries (run these to check migration)
-- SELECT COUNT(*) as total_tags FROM tags;
-- SELECT COUNT(*) as card_tags_with_tag_id FROM card_tags WHERE tag_id IS NOT NULL;
-- SELECT COUNT(*) as card_tags_without_tag_id FROM card_tags WHERE tag_id IS NULL;

-- Example query to see the new structure:
-- SELECT c.name as card_name, t.name as tag_name, t.category, ct.confidence, ct.priority
-- FROM card_tags ct
-- JOIN cards c ON ct.card_id = c.id
-- JOIN tags t ON ct.tag_id = t.id
-- LIMIT 10;
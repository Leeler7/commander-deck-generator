-- Migration: Add tag_ids column to cards table and migrate from card_tags
-- This consolidates tags directly into the cards table for better performance

-- Step 1: Add tag_ids column to cards table if it doesn't exist
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS tag_ids INTEGER[] DEFAULT '{}';

-- Step 2: Create an index on tag_ids for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_tag_ids ON cards USING GIN (tag_ids);

-- Step 3: Populate tag_ids from existing card_tags relationships
-- This aggregates all tag_ids for each card into an array
UPDATE cards c
SET tag_ids = (
    SELECT ARRAY_AGG(DISTINCT ct.tag_id ORDER BY ct.tag_id)
    FROM card_tags ct
    WHERE ct.card_id = c.id
    AND ct.tag_id IS NOT NULL
)
WHERE EXISTS (
    SELECT 1 
    FROM card_tags ct 
    WHERE ct.card_id = c.id 
    AND ct.tag_id IS NOT NULL
);

-- Step 4: Add a comment to document the column
COMMENT ON COLUMN cards.tag_ids IS 'Array of tag IDs from the tags table that apply to this card';

-- Step 5: Create a function to get tag details for a card
CREATE OR REPLACE FUNCTION get_card_tags(card_id_param UUID)
RETURNS TABLE (
    tag_id INTEGER,
    tag_name TEXT,
    tag_category TEXT,
    synergy_weight NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.category,
        t.synergy_weight
    FROM tags t
    WHERE t.id = ANY(
        SELECT unnest(tag_ids) 
        FROM cards 
        WHERE id = card_id_param
    )
    AND t.is_active = true
    ORDER BY t.category, t.name;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create a view for cards with expanded tag information
CREATE OR REPLACE VIEW cards_with_tag_details AS
SELECT 
    c.*,
    ARRAY(
        SELECT jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'category', t.category,
            'synergy_weight', t.synergy_weight
        )
        FROM tags t
        WHERE t.id = ANY(c.tag_ids)
        AND t.is_active = true
        ORDER BY t.category, t.name
    ) AS tag_details
FROM cards c;

-- Verification query to check the migration
SELECT 
    COUNT(*) as total_cards,
    COUNT(tag_ids) as cards_with_tags,
    SUM(array_length(tag_ids, 1)) as total_tag_associations
FROM cards
WHERE tag_ids IS NOT NULL AND array_length(tag_ids, 1) > 0;
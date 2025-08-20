-- ========================================
-- Migration: Add tag_ids column to cards table
-- This consolidates 482,586 card_tags entries into arrays within cards
-- ========================================

-- Step 1: Add the tag_ids column to cards table
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS tag_ids INTEGER[] DEFAULT '{}';

-- Step 2: Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_cards_tag_ids ON cards USING GIN (tag_ids);

-- Step 3: Populate tag_ids from the existing card_tags table
-- This aggregates all tag_ids for each card into an array
DO $$
DECLARE
    batch_size INTEGER := 1000;
    offset_val INTEGER := 0;
    total_cards INTEGER;
    cards_processed INTEGER := 0;
BEGIN
    -- Get total number of unique cards with tags
    SELECT COUNT(DISTINCT card_id) INTO total_cards FROM card_tags WHERE tag_id IS NOT NULL;
    
    RAISE NOTICE 'Starting migration of % cards', total_cards;
    
    -- Process in batches
    LOOP
        -- Update a batch of cards
        WITH card_batch AS (
            SELECT DISTINCT card_id 
            FROM card_tags 
            WHERE tag_id IS NOT NULL
            ORDER BY card_id
            LIMIT batch_size
            OFFSET offset_val
        ),
        card_tag_arrays AS (
            SELECT 
                cb.card_id,
                ARRAY_AGG(DISTINCT ct.tag_id ORDER BY ct.tag_id) AS tag_array
            FROM card_batch cb
            JOIN card_tags ct ON cb.card_id = ct.card_id
            WHERE ct.tag_id IS NOT NULL
            GROUP BY cb.card_id
        )
        UPDATE cards c
        SET tag_ids = cta.tag_array
        FROM card_tag_arrays cta
        WHERE c.id = cta.card_id;
        
        -- Check if we processed any rows
        GET DIAGNOSTICS cards_processed = ROW_COUNT;
        
        EXIT WHEN cards_processed = 0;
        
        offset_val := offset_val + batch_size;
        
        -- Progress update
        RAISE NOTICE 'Processed % cards out of %', LEAST(offset_val, total_cards), total_cards;
    END LOOP;
    
    RAISE NOTICE 'Migration completed successfully';
END $$;

-- Step 4: Verify the migration
SELECT 
    'Migration Summary' as info,
    COUNT(*) as total_cards,
    COUNT(CASE WHEN tag_ids IS NOT NULL AND array_length(tag_ids, 1) > 0 THEN 1 END) as cards_with_tags,
    SUM(COALESCE(array_length(tag_ids, 1), 0)) as total_tag_associations,
    (SELECT COUNT(*) FROM card_tags WHERE tag_id IS NOT NULL) as original_card_tags_count
FROM cards;

-- Step 5: Show sample of migrated data
SELECT 
    name,
    array_length(tag_ids, 1) as tag_count,
    tag_ids[1:5] as first_5_tag_ids
FROM cards
WHERE tag_ids IS NOT NULL 
AND array_length(tag_ids, 1) > 0
ORDER BY array_length(tag_ids, 1) DESC
LIMIT 10;
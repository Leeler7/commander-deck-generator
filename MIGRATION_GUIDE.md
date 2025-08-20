# Database Migration Guide: Streamlining Tag Storage

## Current Problem
- **482,586 entries** in `card_tags` table (one record per card-tag relationship)
- Inefficient queries requiring JOINs for every tag lookup
- Duplicate storage of mechanic_ and ability_keyword_ tags

## New Structure
- **Single `tag_ids` column** in `cards` table containing an array of tag IDs
- **35,590 cards** with embedded tag arrays (from 482,586 separate records!)
- **~93% reduction** in database records

## Migration Steps

### 1. Add tag_ids Column to Cards Table
Run the SQL script in Supabase SQL Editor:
```sql
-- File: migrations/add_tag_ids_column.sql
ALTER TABLE cards 
ADD COLUMN IF NOT EXISTS tag_ids INTEGER[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_cards_tag_ids ON cards USING GIN (tag_ids);
```

### 2. Migrate Data from card_tags to tag_ids
The SQL script will:
- Process cards in batches of 1000
- Aggregate all tag IDs for each card
- Store them as an array in the new column
- Show progress updates

### 3. Clean Up Duplicate Tags
After migration, run the cleanup endpoint:
```bash
curl -X POST "http://localhost:3010/api/admin/cleanup-tags-v2"
```

This will:
- Find overlapping mechanic_ and ability_keyword_ tags
- Update card tag_ids to use only ability_keyword_ versions
- Delete redundant mechanic_ tags

### 4. Update Application Code
The codebase needs to be updated to use the new structure:
- ✅ Created `supabase-updated.ts` with new database interface
- ✅ Created migration endpoints
- 🔄 Need to replace old `card_tags` references with new structure

## Benefits

### Before (card_tags table)
```
card_tags table:
- 482,586 rows
- Each row: card_id, tag_id, tag_name, tag_category
- Requires JOIN for every query
- Massive storage overhead
```

### After (tag_ids array)
```
cards table with tag_ids column:
- 35,590 cards
- Each card: tag_ids = [827, 828, 829]
- Direct array access, no JOINs needed
- 93% reduction in records
```

## Example Queries

### Old Way (with card_tags table)
```sql
-- Get tags for a card (requires JOIN)
SELECT t.* FROM tags t
JOIN card_tags ct ON t.id = ct.tag_id
WHERE ct.card_id = 'some-card-id';
```

### New Way (with tag_ids array)
```sql
-- Get tags for a card (direct array lookup)
SELECT * FROM tags 
WHERE id = ANY(
  SELECT unnest(tag_ids) FROM cards WHERE id = 'some-card-id'
);

-- Or even simpler - cards with specific tags
SELECT * FROM cards 
WHERE tag_ids @> ARRAY[827, 828]; -- Has both tags
```

## Performance Improvements
- **93% fewer database records** (482,586 → 35,590)
- **No JOINs required** for basic tag queries
- **GIN index** on array column for fast lookups
- **Smaller database size** and faster backups

## Next Steps
1. Run the migration SQL in Supabase
2. Run the cleanup endpoint to remove duplicate tags
3. Update all code to use the new structure
4. Verify everything works
5. Consider dropping the old card_tags table

## Verification
Check migration status:
```bash
curl -X GET "http://localhost:3010/api/admin/migrate-to-tag-ids"
```

Expected result after migration:
```json
{
  "migrationStatus": {
    "cardsWithTagIds": 35590,
    "totalCards": 35590,
    "percentageMigrated": "100%",
    "legacyCardTagsEntries": 482586,
    "readyForCleanup": true
  }
}
```
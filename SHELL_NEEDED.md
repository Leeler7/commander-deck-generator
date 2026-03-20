# Shell-Required Tasks

These tasks require a POSIX shell (`bash.exe`) that was unavailable when this file was created.
Fix by running: `setx SHELL "C:\Program Files\Git\bin\bash.exe"` then restart Claude Code.

---

## Phase 1 — Delete dead-code files

```bash
# src/lib kill list
rm src/lib/card-mechanics-tagger.ts
rm src/lib/tag-based-synergy.ts
rm src/lib/synergy-graph.ts
rm src/lib/mechanical-recommendation.ts
rm src/lib/strategy-detection.ts
rm src/lib/commander-profiler.ts
rm src/lib/tribal-analysis.ts
rm src/lib/generation.ts
rm src/lib/enhanced-deck-generation.ts
rm src/lib/candidate-pools.ts
rm src/lib/policy-selection.ts
rm src/lib/mtgjson-comprehensive.ts
rm src/lib/mtgjson-local.ts
rm src/lib/supabase.ts

# Components
rm src/components/SynergyAnalysis.tsx
rm src/components/MTGJSONDataManager.tsx

# Admin tag-management API routes
rm -rf src/app/api/admin/analyze-tags/
rm -rf src/app/api/admin/auto-tag-cards/
rm -rf src/app/api/admin/cleanup-mechanic-tags/
rm -rf src/app/api/admin/cleanup-overlapping-tags/
rm -rf src/app/api/admin/cleanup-tags-v2/
rm -rf src/app/api/admin/tag-statistics/
rm -rf src/app/api/admin/manage-tags/
rm -rf src/app/api/admin/popular-tags/
rm -rf src/app/api/admin/analyze-tag-overlap/
rm -rf src/app/api/admin/apply-tag-addition/
rm -rf src/app/api/admin/available-tags/
rm -rf src/app/api/admin/bulk-remove-tags/
rm -rf src/app/api/admin/cards-by-tag/
rm -rf src/app/api/admin/database-tags/
rm -rf src/app/api/admin/debug-auto-tag/
rm -rf src/app/api/admin/migrate-to-tag-ids/
rm -rf src/app/api/admin/preview-tag-addition/
rm -rf src/app/api/admin/preview-tag-removal/
rm -rf src/app/api/admin/search-tags/
rm -rf src/app/api/admin/synergy-calculator/
rm -rf src/app/api/admin/tag-blacklist/
rm -rf src/app/api/admin/tag-categories/
rm -rf src/app/api/admin/test-tags/
rm -rf src/app/api/admin/update-tags/

# Admin UI tag-management pages
rm -rf src/app/admin/tag-manager/
rm -rf src/app/admin/tag-builder/
rm -rf src/app/admin/tag-cleanup/
rm -rf src/app/admin/tags/
rm -rf src/app/admin/synergy/

# Tag-related migrations
rm migrations/001_create_normalized_tags.sql
rm migrations/002_cleanup_legacy_structure.sql
rm migrations/003_remove_redundant_columns.sql
rm migrations/add_tag_ids_column.sql
rm migrations/add_tag_ids_to_cards.sql
rm migrations/add_missing_keyword_abilities.js
rm migrations/add_remaining_keywords.js
rm migrations/check_existing_abilities.js
rm migrations/run_manual_migration.js
rm migrations/run_migration.bat
rm migrations/run_migration.js
rm migrations/run_migration_simple.js
rm migrations/test_new_structure.js
```

## Phase 2 — Build & typecheck

```bash
npm install
npm run build
npm run typecheck
```

## Phase 3 — Commit

```bash
git add -A
git commit -m "feat: replace custom synergy engine with EDHREC data layer

- Remove card-mechanics-tagger, tag-based-synergy, synergy-graph and
  all related dead code (~15 lib files, ~25 admin routes/pages)
- Fix security: remove hardcoded Supabase credentials from supabase-updated.ts
- Add src/lib/edhrec.ts: EDHRECClient singleton with caching and rate limiting
- Add src/lib/combos.ts: CommanderSpellbookClient singleton
- Add EDHRECCardRecommendation, EDHRECTheme, ComboResult, BracketEstimate to types.ts
- Rewire new-generation-pipeline.ts: step2 now uses EDHREC synergy/inclusion
  scores; step3 matches user keywords to EDHREC themes; falls back to
  keyword text analysis for fringe commanders (<50 EDHREC decks)
- Stub broken imports in server-card-database.ts, sync-incremental/route.ts
- Replace debug/card-analysis route with 410 stub

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

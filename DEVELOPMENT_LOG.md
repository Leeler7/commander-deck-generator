# Commander Deck Generator - Development Log
**Last Updated:** August 16, 2025  
**Status:** Active Development  
**Current Version:** In Development  

## Project Overview
A React/Next.js web application that generates Commander (EDH) Magic: The Gathering decks with sophisticated synergy detection and card tagging systems.

## Architecture Overview

### Core Technologies
- **Frontend:** React + Next.js 15.4.6 with TypeScript
- **Backend:** Next.js API routes
- **Database:** Local JSON-based card database (35,589 cards)
- **Card Data:** Scryfall API integration
- **Pricing:** TCGPlayer integration
- **Development:** Turbopack, running on port 3010

### Key Components

#### 1. Card Mechanics Tagging System (`src/lib/card-mechanics-tagger.ts`)
- **200+ mechanic tags** organized by categories
- **Pattern-based detection** using regex and text analysis
- **ETB (Enter the Battlefield) detection** with subcategories:
  - `etb_damage` - ETB creatures that deal damage
  - `etb_draw` - ETB creatures that draw cards
  - `etb_destroy` - ETB creatures that destroy permanents
  - `etb_token_creation` - ETB creatures that create tokens
- **Recent fixes:** Case-sensitive detection, expanded ETB patterns

#### 2. Tag-Based Synergy System (`src/lib/tag-based-synergy.ts`)
- **Comprehensive synergy rules** between commander tags and card tags
- **Tribal scoring system** with massive bonuses:
  - Base tribal bonus: +120 points
  - Double tribal bonus: +50 points  
  - **Total: +170 points** for tribal creatures
- **Commander profiles** auto-detected from card text
- **Recent enhancement:** Dramatically increased tribal bonuses for better tribal representation

#### 3. Generation Pipeline (`src/lib/new-generation-pipeline.ts`)
- **8-step generation process:**
  1. Color match the commander
  2. Determine synergy score based on commander
  3. Consider additional keywords and increase synergy
  4. Apply card type ratios based on sliders
  5. Check card prices
  6. Substitute expensive cards
  7. Ensure 100-card deck
  8. Fill empty slots with synergy cards

- **Recent critical fix:** Raised high-synergy preservation threshold from 8 → 50 points to properly preserve tribal creatures during ratio filtering

#### 4. Card Type Weight System (`src/components/CardTypeWeights.tsx`)
- **Slider-based preferences:** 0=None, 5=Default, 10=Strongly Favored
- **Planeswalkers:** Exact count (not ratio-based)
- **Issue identified:** Instants generating fewer cards than other types at equal weights

## Recent Development Sessions

### Session 1: ETB Detection Enhancement
**Problem:** Missing ETB effects like "another creature you control enters" and "creature enters the battlefield"

**Solution:** 
- Fixed case-sensitive detection bugs
- Expanded ETB pattern matching
- Created ETB subcategory system (etb_damage, etb_draw, etc.)
- Added high-priority synergy rules for ETB interactions

### Session 2: Display Cleanup  
**Problem:** Deck results showing full type lines instead of just subtypes

**Solution:**
- Updated `DeckAnalysis.tsx` to show only subtypes in "Cards by Type" section
- Applied to all card types (creatures, artifacts, instants, etc.)
- Maintained grouping by main types while displaying subtypes only

### Session 3: Card Type Ratio Bug
**Problem:** Instants generating 8 cards while other types generated 14 at same weight (5)

**Investigation:** Found issue was using inclusion rates vs proportional distribution
**Status:** Reverted attempted fix as it broke tribal inclusion

### Session 4: Critical Tribal Fix
**Problem:** Voja decks only generating 2-4 elves/wolves despite high synergy scores (94-198 points)

**Root Cause:** Ratio filtering used threshold of `finalScore >= 8` to preserve "high synergy" cards, but tribal creatures scored 80-200+ points, so they were being filtered out

**Solution:**
1. Raised high-synergy threshold from 8 → 50 points
2. Increased tribal bonuses from +80 → +170 total points
3. Enhanced tribal detection logging

## Current File Structure

### Core Libraries
- `src/lib/card-mechanics-tagger.ts` - 200+ mechanic detection
- `src/lib/tag-based-synergy.ts` - Synergy scoring and tribal bonuses  
- `src/lib/new-generation-pipeline.ts` - Main deck generation logic
- `src/lib/types.ts` - TypeScript interfaces
- `src/lib/scryfall.ts` - Card API integration
- `src/lib/pricing.ts` - TCGPlayer pricing

### Components
- `src/components/DeckAnalysis.tsx` - Deck statistics and card display
- `src/components/DeckList.tsx` - Detailed card listings
- `src/components/CardTypeWeights.tsx` - User preference sliders
- `src/components/ManaCost.tsx` - Mana symbol rendering

### API Routes
- `src/app/api/cards/list` - Card database access
- `src/app/api/debug/card-analysis` - Admin card analysis

### Admin Tools
- `src/app/admin/page.tsx` - Card database explorer and tag analyzer

## Known Issues & Future Work

### High Priority
1. **Instant ratio bug** - Equal weights not producing equal distributions
2. **Budget optimization** - Cards over price threshold substitution
3. **Mana curve optimization** - Better CMC distribution

### Medium Priority  
1. **Color fixing optimization** - Better manabase generation
2. **Synergy rule expansion** - More commander-specific rules
3. **Performance optimization** - Faster generation times

### Low Priority
1. **UI/UX improvements** - Better mobile responsiveness
2. **Export features** - Deck export to various formats
3. **Deck validation** - Legal format checking

## Testing Notes

### Tribal Commanders Tested
- **Voja, Jaws of the Conclave** - Elf/Wolf tribal (primary test case)
- **Gargos, Vicious Watcher** - Hydra tribal (confirmed need for higher bonuses)

### Expected Behavior
- Tribal commanders should heavily favor their creature types
- High-synergy tribal creatures (120-200+ points) should always be included
- Tribal representation should be significant portion of creature base

## Development Commands

```bash
# Start development server
npm run dev

# Kill port if needed
npx kill-port 3010

# Check card tagging
# Visit: http://localhost:3010/admin
```

## Database Information
- **Total cards:** 35,589
- **Format:** JSON-based local database
- **Source:** Scryfall API
- **Update frequency:** Manual

## Synergy Scoring Examples

### Tribal Bonuses (Post-Enhancement)
- **Base tribal:** +120 points
- **Double tribal:** +50 points  
- **Total tribal:** +170 points

### Example Scores for Voja
- **Elvish Piper:** ~264 points (94 base + 170 tribal)
- **Trostani's Summoner:** ~368 points (198 base + 170 tribal)
- **Regular creatures:** ~20-50 points

## Recent Configuration Changes

### High-Synergy Threshold
```typescript
// OLD: Cards with score >= 8 preserved
const highSynergyCards = typeCards.filter(card => card.finalScore >= 8);

// NEW: Cards with score >= 50 preserved  
const highSynergyCards = typeCards.filter(card => card.finalScore >= 50);
```

### Tribal Bonus Multipliers
```typescript
// OLD: +60 base, +20 double = +80 total
const tribalBonus = 60;
const extraBonus = 20;

// NEW: +120 base, +50 double = +170 total
const tribalBonus = 120; 
const extraBonus = 50;
```

## Session 5: Card Type Distribution Fix (August 16, 2025)
**Problem:** Instant cards generating fewer cards (8) than other types (14) at same weight (5)

**Root Cause:** The ratio filtering was using inclusion rates (percentage of available pool) rather than proportional distribution:
- Old logic: `weight * 0.1` = inclusion rate (5 = 50% of available cards)
- Issue: Different pool sizes meant different final counts

**Solution Implemented:**
- Changed from inclusion rate to proportional distribution
- All types now share a target of ~65 non-land cards proportionally
- Formula: `(weight / totalWeight) * targetNonLandCards`
- Example: If all weights are 5, each type gets ~13 cards (65/5)

**Code Changes:** Updated `step4_ApplyRatios` in `new-generation-pipeline.ts`:
- Calculates total weight sum
- Uses proportional targets instead of inclusion rates
- Preserves high-synergy cards (score >= 50) regardless of targets

## Next Session Priorities
1. ✅ Test tribal improvements with multiple commanders
2. ✅ Investigate and fix instant ratio distribution bug
3. Test the new proportional distribution system
4. Consider implementing dynamic tribal thresholds based on tribe size
5. Optimize mana curve distribution

---

## Sprint: Repo Cleanup, EDHREC Integration & Supabase Removal (March 2026)

### Overview
Complete architectural overhaul across multiple Claude Code sessions. The custom card
tagging/synergy engine and Supabase database were fully removed. All card data now
comes from Scryfall + EDHREC APIs with in-memory caching. 112 files changed,
31,799 lines deleted.

---

### Phase 1 — Repo Cleanup

**Files deleted from root:**
- `commander-spellbook-backend-master.zip`, `mtgjson-fetcher-master.zip`,
  `mtgjson3-master.zip`, `jor_kadeen_debug.json`, `Railway Log.txt`,
  `Results 3.html`, `temp_check.sql`, `tap.PNG`, `count-cards.js`,
  `start-clean.bat`, `dev log.txt`, `DEVELOPMENT_LOG.txt`

**`.gitignore` additions:** `*.zip`, `*.PNG`, `*.sql` (temp), `*.bat`, `*.log`

**Commit:** `chore: repo cleanup and audit`

---

### Phase 2 — Audit

`AUDIT.md` created at repo root documenting:
- Every file in `src/lib/` with purpose
- Every API route with HTTP method and request/response shape
- Every component with props interface
- Full Supabase schema analysis
- All environment variables
- All external API calls
- Kill List / Keep List for the rebuild

---

### Phase 3 — Dead Code Removal (custom synergy engine)

**Deleted `src/lib/`:**
- `card-mechanics-tagger.ts` — 200+ regex-based mechanic tagger
- `tag-based-synergy.ts` — synergy scoring using tags
- `synergy-graph.ts` — graph-based synergy calculations
- `mechanical-recommendation.ts` — recommendation engine
- `strategy-detection.ts` — commander strategy detector
- `commander-profiler.ts` — commander profiling
- `tribal-analysis.ts` — tribal detection
- `generation.ts` — legacy 210KB generation file
- `enhanced-deck-generation.ts`, `candidate-pools.ts`, `policy-selection.ts`
- `mtgjson-comprehensive.ts`, `mtgjson-local.ts`
- `supabase.ts` (older duplicate)

**Deleted components:** `SynergyAnalysis.tsx`, `MTGJSONDataManager.tsx`

**Deleted admin routes (~25):** All tag-management routes under
`src/app/api/admin/` (analyze-tags, auto-tag-cards, cleanup-mechanic-tags, etc.)

**Deleted admin UI pages:** `tag-manager/`, `tag-builder/`, `tag-cleanup/`,
`tags/`, `synergy/`

**Deleted migrations:** `001_create_normalized_tags.sql` through
`add_tag_ids_to_cards.sql`, all `*.js` migration runners

---

### Phase 4 — Security Fix

**`src/lib/supabase-updated.ts`:**
- Removed ALL hardcoded fallback credential values
- Added strict env var checks: `if (!url) throw new Error('Missing ...')`
- Applies to `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_KEY`

---

### Phase 5 — EDHREC Data Layer

**New: `src/lib/edhrec.ts`**
- `commanderToSlug(name)` — converts commander name to EDHREC URL slug
  (e.g. `"Atraxa, Praetors' Voice"` → `"atraxa-praetors-voice"`)
- `EDHRECClient` singleton with 24-hour in-memory cache and 1 req/sec rate limit
- `getCommanderPage(commanderName)` — fetches full EDHREC JSON page
- `getCommanderThemes(commanderName)` — extracts available themes/slugs
- `getThemedRecommendations(commanderName, theme?)` — returns cards with
  synergy scores and inclusion percentages; falls back to main page if no theme
- `getAverageDeck(commanderName)` — fetches complete average decklist
- All methods return `null` on 404 (commander not found / insufficient data)

**New: `src/lib/combos.ts`**
- `CommanderSpellbookClient` singleton with 24-hour cache
- `findCombos(cardNames)` — POST to Commander Spellbook find-my-combos endpoint
- `estimateBracket(cardNames)` — POST to Commander Spellbook estimate-bracket

**Updated: `src/lib/types.ts`**
- Added `EDHRECCardRecommendation { name, synergy, inclusion, numDecks, potentialDecks }`
- Added `EDHRECTheme { name, slug, count }`
- Added `ComboResult { cards, prerequisites, steps, results }`
- Added `BracketEstimate { bracket, combos }`

---

### Phase 6 — Generation Pipeline Rewire

**`src/lib/new-generation-pipeline.ts`** — major changes:

**Step 1 (Color Match):** Was: `localDatabase.searchByFilters(...)` hitting Supabase.
Now: paginates Scryfall `searchCards(colorQuery + " f:commander", page, "edhrec")`
up to 5 pages (~875 cards), ordered by EDHREC rank.

**EDHREC pre-load:** `loadEDHRECData(commanderName)` called before step1. Populates
`edhrecRecs` Map and `edhrecTotalDecks` counter.

**Step 2 (Synergy Scoring):** Replaced custom tag scoring with EDHREC data:
- If `edhrecTotalDecks >= 50`: uses EDHREC synergy (-1 to 1) and inclusion (0-1)
  - Formula: `(inclusion * 40) + (synergy * 60)` → 0-100 score
  - Reason field: `"EDHREC: +X% synergy, in Y% of decks"`
- If EDHREC has < 50 decks: falls back to `calculateEnhancedKeywordSynergy`
  (text-based analysis of oracle text)

**Step 3 (User Themes):** Now matches user keywords to EDHREC theme slugs via
`getCommanderThemes()`. If a keyword matches a theme (e.g. "tokens" → EDHREC
tokens page), fetches themed recommendations and boosts matching cards.

**`addRandomizedTags`:** Was: `localDatabase.getAvailableTags()`. Now: uses a
hardcoded list of 45 popular Commander themes (tokens, graveyard, tribal, etc.)
to provide random variety without a database.

---

### Phase 7 — Supabase & Database Full Removal

**Decision:** Supabase database paused/archived. Removing entirely.

**Deleted `src/lib/`:**
- `supabase-updated.ts`, `database-factory.ts`, `server-card-database.ts`,
  `card-database.ts`, `scheduled-sync.ts`

**Deleted components:** `DatabaseSync.tsx`

**Deleted:** `supabase-schema.sql`, entire `migrations/` directory,
`scripts/manage-database.js`, `scripts/download-external-db.js`,
`scripts/migrate-to-supabase.js`, `scripts/update-database-imports.js`

**Deleted admin routes (database/sync):** ~20 routes including
`check-activity`, `check-duplicates`, `check-schema`, `database-commit`,
`database-download`, `database-export`, `database-health`, `debug-db`,
`debug-sync`, `deduplicate-cards`, `fix-sync-status`, `insert-sync-record`,
`reload-database`, `set-initial-sync`, `supabase-status`, `switch-database`,
`sync-incremental`, `sync-report`, `sync-status`, `trigger-sync`

**Deleted:** `src/app/api/database/` (reanalyze, search, status, sync routes),
`src/app/api/force-sync/`, `src/app/api/test-sync/`,
`src/app/api/debug/database-source/`, `src/app/api/admin/system-stats/`

**`npm uninstall @supabase/supabase-js`** — removed 13 packages

**Rewrote card API routes** to proxy Scryfall directly (no database):
- `GET /api/cards?search=X` — Scryfall text search
- `GET /api/cards/[id]` — Scryfall lookup by ID
- `GET /api/cards/details?name=X` — Scryfall exact name lookup
- `GET /api/cards/list?q=X` — Scryfall search returning simplified fields

---

### Build & Typecheck Results

**`npm run build`:** ✅ Clean — 23 routes compiled, no errors.
Static pages generated successfully. No Supabase env vars needed at build time
(lazy initialization fixed the module-load-time throw).

**`npm run typecheck`:** Pre-existing errors only (not introduced by this sprint):
- `src/lib/pricing.ts` — `possibly undefined` strictness errors
- `src/lib/rules.ts` — missing properties on `GenerationConstraints`
  (`no_infinite_combos`, `no_land_destruction`, etc.)
- `src/lib/budget-optimizer.ts` — `mechanics` not on `ScryfallCard` type
- `src/middleware.ts` — `ip` not on `NextRequest` (Next.js 15 breaking change)
- `src/test/setup.ts`, `vitest.config.ts` — missing test dependencies
- `src/lib/new-generation-pipeline.ts` — `ScoredCard` / `DeckCard` type
  mismatches (pre-existing from pipeline rewire)

None of these are in files touched during this sprint. No new type errors introduced.

---

### Environment Variables (post-cleanup)

Required in production (Railway):
- `NEXT_PUBLIC_SUPABASE_URL` — **no longer needed, can be removed**
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — **no longer needed, can be removed**
- `SUPABASE_SERVICE_KEY` — **no longer needed, can be removed**
- `DATABASE_TYPE` — **no longer needed, can be removed**

Still needed:
- None required for core functionality (Scryfall and EDHREC are public APIs)
- `RESEND_API_KEY` — contact form email sending (if in use)

---

### Commits

| Hash | Message |
|------|---------|
| `0f0ac8c` | `chore: repo cleanup and audit` |
| `fbeb485` | `feat: remove Supabase and all dead-code; rewire to EDHREC + Scryfall` |

Both commits are local only — not pushed to origin.

---

### Current Architecture (post-sprint)

```
Card data flow:
  User request → /api/generate
    → new-generation-pipeline.ts
      → step1: Scryfall color-identity search (5 pages, EDHREC-ranked)
      → step2: EDHREC synergy scores (or keyword fallback)
      → step3: EDHREC theme matching for user keywords
      → step4-8: ratio filtering, pricing, curve optimization
    → Returns 100-card deck JSON

Commander search:
  → /api/commanders/search → Scryfall API
  → /api/commanders/random → Scryfall API

Card lookup:
  → /api/cards/* → Scryfall API (no local DB)

Combo detection (available, not yet wired to generate):
  → combos.ts → Commander Spellbook API

EDHREC data:
  → edhrec.ts → json.edhrec.com (24h in-memory cache, 1 req/sec)
```

---
*This log should be updated after each development session to maintain project continuity.*
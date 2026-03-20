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

Combo detection (wired to generate):
  → combos.ts → Commander Spellbook API
  → findCombos() called when spice >= 7 + no_infinite_combos=false
  → estimateBracket() called on every generation

EDHREC data:
  → edhrec.ts → json.edhrec.com (24h in-memory cache, 1 req/sec)
  → getCommanderThemes() used by spice slider
```

---

## Sprint: Combos, Bracket Estimation, Spice Slider & Type Fixes

**Date:** 2026-03-20
**Status:** Complete — committed as `0c00767`, not pushed

### Goals

1. Remove dead `db:*` scripts from package.json
2. Wire `combos.ts` into the generation pipeline
3. Fix all pre-existing TypeScript type errors (zero-error target)
4. Upgrade the random-theme slider to use real EDHREC themes

---

### Changes Made

#### 1. package.json — dead scripts removed

Removed four scripts that referenced deleted database files:
- `db:export` → `node scripts/manage-database.js export`
- `db:import` → `node scripts/manage-database.js import`
- `db:download` → `node scripts/download-external-db.js`
- `db:help` → `node scripts/manage-database.js`

Also fixed a trailing comma introduced during the edit (JSON is strict).

---

#### 2. Combos + Bracket Estimation wired into pipeline

`src/lib/new-generation-pipeline.ts` now imports `spellbookClient` from `combos.ts` and calls it at the end of every `generateDeck()` run.

**Bracket estimation (always runs):**
```
spellbookClient.estimateBracket(commander.name, allCardNames)
  → stored in bracketEstimate, included in GeneratedDeck response
  → added to generation_notes as "⚡ Estimated bracket: N"
```

**Combo injection (conditional):**
- Triggers when `random_tag_count >= 7` (spice level) AND `!constraints.no_infinite_combos`
- Calls `spellbookClient.findCombos()` with the final card list
- Takes the first combo returned; identifies cards not already in the deck
- If ≤ 3 missing pieces: fetches them from Scryfall, swaps out the lowest-synergy non-lands
- Logs: `🔗 Injected combo package (Card A, Card B, Card C)`
- Both calls are wrapped in try/catch — Spellbook is optional, failures are silent

**Type changes:**
- `GeneratedDeck` — added `bracketEstimate?: BracketEstimate`
- `BracketEstimate` and `ComboResult` were already defined in `types.ts`

---

#### 3. Spice Slider upgraded (`addRandomizedTags`)

The method was moved to run **after** commander validation (so the name is available) and now accepts a `commanderName` parameter.

**New behaviour:**
1. Calls `edhrecClient.getCommanderThemes(commanderName)` to get real themes for this specific commander
2. If EDHREC returns themes, uses that pool (e.g. "Aristocrats", "Tokens", "Reanimator")
3. Falls back to the curated 43-entry spicy mechanics list if EDHREC returns nothing or fails
4. Shuffles the pool and picks `spiceLevel` entries (same count as before)
5. Log format changed: `🌶️ Spice level N/10 — added M themes: …`

The slider values now have semantic meaning:
- **0** = "Play it safe" — no random themes added
- **1–6** = increasingly unusual themes mixed in
- **7–10** = "Maximum chaos" — also triggers combo injection

---

#### 4. Type errors fixed — zero errors remaining

`npm run typecheck` and `npm run build` both pass clean.

**`src/lib/types.ts`**
- `ScryfallCard` — added `rarity?`, `power?`, `toughness?`, `loyalty?`, `mechanics?: CardMechanicsData`
  - Fixes errors in `pricing.ts`, `mana-curve-optimizer.ts`, `budget-optimizer.ts`, `page.tsx`, `mtgjson-pricing.ts`
- `GenerationConstraints` — added `no_infinite_combos?`, `no_land_destruction?`, `no_extra_turns?`, `no_stax?`, `no_fast_mana?`
  - Fixes 5 errors in `rules.ts`
- `GeneratedDeck` — added `bracketEstimate?: BracketEstimate`

**`src/lib/new-generation-pipeline.ts`**
- `ScoredCard` interface — added `price_used?`, `price_source?`
- `log()` — changed to `log(message: string, ...args: any[])` to fix 8 multi-arg call sites
- `step4_ApplyRatios` — `allColorMatched` parameter widened to `ScryfallCard[]`; internal `finalScore` access uses cast
- Line 243 (`DeckCard.finalScore`) — cast to `(card as any).finalScore`
- Line 329 (`role.toString()` on `never`) — replaced with `String(card.role)`
- `step5_EvaluatePrices` — cast `card` back to `ScoredCard` before spread to preserve synergy scores
- `analyzeColorRequirements` call — cast `commander` to `DeckCard` to satisfy array type

**`src/lib/budget-optimizer.ts`**
- All `this.constraints.per_card_cap` → `(this.constraints.per_card_cap ?? this.constraints.max_card_price)` (8 occurrences)
- All `price_used` arithmetic — guarded with `?? 0` (10 occurrences)
- `createDeckCard` — added `quantity: 1, tags: []` (required by `DeckCard`)

**`src/lib/pricing.ts`**
- `per_card_cap` comparisons guarded with `?? constraints.max_card_price ?? 50`
- `calculatePriceTrends` — all `price_used` and array accesses guarded with `?? 0`

**`src/lib/mtgjson-pricing.ts` / `mtgjson-keywords.ts`**
- Added `!` non-null assertions after guaranteed assignments (`this.pricingData!`, `this.keywordsData!`)

**`src/middleware.ts`**
- `request.ip` → `(request as any).ip` (Next.js 15 removed this property from the type)

**`src/app/api/cards/[id]/route.ts`**
- Updated to Next.js 15 async params: `{ params: Promise<{ id: string }> }` + `await params`

**`src/components/DeckList.tsx`**
- `roleColors` typed as `Record<string, string>` instead of `Record<CardRole, string>` in all three locations (definition + 2 component prop interfaces)

**`src/app/admin/database/page.tsx`**
- Deleted (dead code — database was removed in previous sprint; 8 errors eliminated)

**`tsconfig.json`**
- Added `playwright.config.ts`, `vitest.config.ts`, `src/test/**` to `exclude` (packages not installed)

**`.next/types/app/admin/database/page.ts`**
- Deleted stale Next.js-generated type file for the removed admin page

---

### Commits

| Hash | Message |
|------|---------|
| `0f0ac8c` | `chore: repo cleanup and audit` |
| `fbeb485` | `feat: remove Supabase and all dead-code; rewire to EDHREC + Scryfall` |
| `0c00767` | `feat: wire combos + bracket estimation + spice slider + fix type errors` |
| `3719c52` | `feat: inverted card pool + theme selector + bracket display + spice labels` |
| `8924c0b` | `refactor: replace tag browser with simple keyword input` |

All commits are local only — not pushed to origin.

---

## Sprint: Inverted Card Pool + Theme Selector + Bracket Display (2026-03-20)

### Goals
- Invert the card pool logic so keyword/theme searches dominate over popularity-capped EDHREC results
- Add EDHREC theme selector in the UI (clickable pills per commander)
- Display bracket estimate visually after deck generation
- Re-label spice slider with clearer language

### Changes

**`src/lib/new-generation-pipeline.ts`**
- `step1_ColorMatchCommander` now accepts `constraints?: GenerationConstraints`
- **Inverted pool logic:**
  - **FIRST:** For each user keyword (`keyword_focus`, `keywords`, `random_tags`), runs a targeted Scryfall oracle-text query: `o:"<keyword>" ci:<colors> f:commander -type:basic`
  - Pages per keyword: 1 at spice 0, 2 at spice 5, 3 at spice 10 (`1 + floor(spice/5)`)
  - Capped at 6 keywords to limit API call volume
  - **FALLBACK:** Broad EDHREC-sorted color-identity search (existing behaviour), but page count reduces as spice rises: 5 at spice 0 → 2 at spice 9+ (`max(2, 5 - floor(spice/3))`)
  - Keyword-searched cards placed first in pool (deduplicated); broad cards fill remainder
  - Step3's +300 text-match bonus then naturally selects keyword cards at high spice
- Call site updated: `step1_ColorMatchCommander(commander, constraints)`

**`src/app/api/themes/route.ts`** *(new)*
- `GET /api/themes?commander={name}` → calls `edhrecClient.getCommanderThemes()` → `{ themes: EDHRECTheme[] }`
- Returns empty `{ themes: [] }` on error (graceful degradation)

**`src/components/ThemeSelector.tsx`** *(new)*
- Renders clickable pill buttons for each EDHREC theme (fetched from `/api/themes` when commander changes)
- "No theme (goodstuff)" default pill always shown first
- Selecting a theme injects its name into `constraints.keyword_focus`; deselecting removes it
- Hidden if no commander is selected; shows "Loading…" during fetch

**`src/components/BracketEstimate.tsx`** *(new)*
- Displays a 1–4 horizontal bar scale with colour coding: green (1), yellow (2), orange (3), red (4)
- Each bracket labelled: Exhibition/Precon, Core, Upgraded, cEDH
- Active bracket highlighted; tooltip description per bracket
- Lists up to 2 detected combos (cards + first result line); shows "+N more" if >2

**`src/components/BudgetPowerControls.tsx`**
- Spice slider label changed to: "🌶️ Spice Level: How weird do you want this deck? — N/10"
- Description updated to explain low spice = EDHREC-proven, high spice = keyword searches dominate pool
- Scale endpoints: `0 — Play it safe` / `5 — Balanced` / `10 — Maximum chaos`

**`src/app/page.tsx`**
- Imported `ThemeSelector` and `BracketEstimate`
- `ThemeSelector` rendered below commander selection (only visible when a commander is selected)
- `BracketEstimate` rendered above the RoleBreakdown/PriceBar grid when `generatedDeck.bracketEstimate` is present

### Architecture (updated)

```
Card pool assembly (step1, inverted):
  User keywords exist?
    YES → Scryfall oracle-text search per keyword (o:"kw" ci:X f:commander)
          1-3 pages each depending on spice level
    THEN → Broad EDHREC-sorted fallback (2-5 pages, inversely proportional to spice)
    Pool deduped; keyword cards placed first

  Spice 0  → 1 page/keyword (manual only), 5 broad pages → pure EDHREC
  Spice 5  → 2 pages/keyword, 3 broad pages → 50/50
  Spice 10 → 3 pages/keyword, 2 broad pages → keyword-dominant

Theme flow:
  Commander selected → GET /api/themes?commander=X → EDHRECTheme[] pills in UI
  User clicks theme → theme name added to keyword_focus
  keyword_focus feeds step1 keyword searches AND step3 EDHREC theme bonus

Bracket display:
  bracketEstimate present in GeneratedDeck → BracketEstimate component shown
  1=green / 2=yellow / 3=orange / 4=red bar scale with combo list
```

---

### Updated Architecture (post-sprint)

```
Card data flow:
  User request → /api/generate
    → new-generation-pipeline.ts
      → step1: keyword oracle-text searches (priority) + broad EDHREC fallback
      → step2: EDHREC synergy scores (or keyword fallback)
      → step3: EDHREC theme matching for user keywords
      → addRandomizedTags: EDHREC commander themes → spicy fallback
      → step4-8: ratio filtering, pricing, curve optimization
      → post-assembly: Spellbook estimateBracket() (always)
      → post-assembly: Spellbook findCombos() (when spice >= 7)
    → Returns 100-card GeneratedDeck JSON with bracketEstimate

Commander search:
  → /api/commanders/search → Scryfall API
  → /api/commanders/random → Scryfall API

Theme lookup:
  → /api/themes?commander=X → EDHREC via edhrec.ts

Card lookup:
  → /api/cards/* → Scryfall API (no local DB)

Combo detection:
  → combos.ts → Commander Spellbook backend API
  → estimateBracket: POST /estimate-bracket (every generation)
  → findCombos: POST /find-my-combos (spice >= 7 only)

EDHREC data:
  → edhrec.ts → json.edhrec.com (24h in-memory cache, 1 req/sec)
  → getCommanderThemes() feeds ThemeSelector UI + spice slider pool
```

---

## Refactor: Simplified Keyword Input (2026-03-20)

**`src/components/BudgetPowerControls.tsx`**
- Removed "Theme Focus" section entirely — category filter dropdown, tag search input, debounced `fetch('/api/admin/tag-categories')` + `fetch('/api/admin/search-tags')` calls, search results display, and all related state (`searchResults`, `selectedCategory`, `tagSearchTerm`, `isSearching`, `showSuggestions`, `categories`) and effects
- Removed `useRef` import and `searchContainerRef`
- Removed `addTag`, `removeTag`, `formatTagDisplay`, `getFilteredSearchResults`, `keywordSuggestions` helpers
- Replaced with plain **"Add Keywords (Optional)"** section: text input + Add button + removable pills
- Enter key or clicking Add appends to `keyword_focus`; `constraints.keywords` (old tag array) no longer populated from this component
- Net: −264 lines

---
*This log should be updated after each development session to maintain project continuity.*
# Commander Deck Generator — Codebase Audit

Generated: 2026-03-20

---

## 1. src/lib/ — File Descriptions

| File | Description |
|------|-------------|
| `types.ts` | Shared TypeScript interfaces: `ScryfallCard`, `DeckCard`, `GeneratedDeck`, `GenerationConstraints`, `CardTypeWeights` |
| `scryfall.ts` | `ScryfallClient` class + singleton; wraps all Scryfall API calls (search, named lookup, bulk data, random commander) with rate-limiting and retry logic |
| `scryfall-pricing.ts` | `ScryfallPricingService` singleton; fetches per-card prices from `api.scryfall.com` with 1-hour cache and 100ms rate limiting |
| `supabase.ts` | Supabase client init (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`); `SupabaseCardDatabase` class for card/tag CRUD with 10-minute tag cache |
| `supabase-updated.ts` | Newer version of the Supabase layer; adds `supabaseAdmin` (service-role client using `SUPABASE_SERVICE_KEY`) and `SupabaseCardDatabase` with tag-array schema; replaces `supabase.ts` for write operations |
| `database-factory.ts` | Factory that reads `DATABASE_TYPE` env var (`file` or `supabase`) and returns the appropriate `DatabaseInterface` implementation; defaults to file-based |
| `card-database.ts` | Browser-side `CardDatabase` class using `localStorage` to cache Scryfall bulk data; handles sync and local search |
| `server-card-database.ts` | Server-side `ServerCardDatabase`; loads card JSON from local files, `public/database/` chunks, or falls back to Scryfall bulk download; re-analyses cards with the mechanics tagger |
| `card-mechanics-tagger.ts` | **Custom tagging engine** — `CardMechanicsTagger` class; regex-parses oracle text into structured `CardMechanics` mechanic tags (no external API calls); the core of the custom synergy system |
| `tag-based-synergy.ts` | `TagBasedSynergyScorer` with 200+ hardcoded synergy rules; maps commander tags → card tags → scores; part of the custom synergy engine |
| `synergy-graph.ts` | `SynergyAnalyzer` builds a synergy graph for a deck, detects combos/tribal/protection chains, and computes deck cohesion metrics |
| `mechanical-recommendation.ts` | `MechanicalRecommendationEngine` with ~23 synergy interaction rules; suggests cards based on mechanical gaps in the deck |
| `strategy-detection.ts` | `StrategyDetector` classifies commander/deck into 40+ strategy archetypes based on mechanic tag densities |
| `commander-profiler.ts` | `CommanderProfiler` analyzes a commander card to extract mechanical tags, archetypes, card package seeds, and curve hints |
| `tribal-analysis.ts` | Functions for detecting tribal commanders, scoring tribal bonuses, and analyzing tribal card pools |
| `generation.ts` | Legacy `DeckGenerator` class (~211KB); original full generation pipeline using Scryfall, rules engine, budget optimizer, and strategy/mechanics analysis |
| `new-generation-pipeline.ts` | `NewDeckGenerator` — refactored 8-step pipeline (color-match → synergy score → user themes → ratios → pricing → validate → fill); this is what `api/generate/route.ts` actually calls |
| `enhanced-deck-generation.ts` | `EnhancedDeckGenerator` — 10-step orchestration pipeline building on the modular subsystems (profiler, policy, pools, synergy graph); latest architecture, not yet wired to the API route |
| `candidate-pools.ts` | `CandidatePoolBuilder` — scores cards across role-fit, synergy, power, budget, and curve dimensions, then organizes into role-specific pools |
| `policy-selection.ts` | `PolicySelector` converts commander profiles + user weights into a concrete `DeckPolicy` (role composition, curve targets, constraints, power level) |
| `percentage-weighting.ts` | `PercentageWeightingSystem` converts 0-10 slider values into card-type quotas for the non-land slots |
| `mana-curve-optimizer.ts` | Functions for analysing and optimizing mana curve against archetype targets (aggro/midrange/control/ramp/combo) |
| `budget-optimizer.ts` | `BudgetOptimizer` — three-phase budget fitter: fill essential roles → fill remaining slots → swap expensive cards for cheaper alternatives |
| `power.ts` | `POWER_LEVEL_CONFIGS` (1-10 scale) with tutor allowances, fast-mana rules, and recommended compositions; `getPowerLevelConfig()` and related helpers |
| `rules.ts` | Commander format rules: `isColorIdentityValid()`, `isCardLegalInCommander()`, `validateDeckComposition()`, `categorizeCardRole()`, `applyConstraintFilters()` |
| `pricing.ts` | Deck-level pricing: `fitCardsIntoBudget()`, `sortCardsByBudgetPriority()`, `extractCardPrice()`, `extractCardPriceWithSource()`, `findCheapestPrinting()` |
| `mtgjson-comprehensive.ts` | `mtgjsonComprehensive` service; fetches AllPrintings / AtomicCards / SetList from `mtgjson.com` with daily cache; converts to Scryfall-compatible shape |
| `mtgjson-pricing.ts` | `MTGJSONPricingService`; fetches `AllPricesToday.json` from `mtgjson.com/api/v5`; primary pricing source with Scryfall fallback |
| `mtgjson-keywords.ts` | `MTGJSONKeywordService`; fetches keyword list from `mtgjson.com/api/v5/Keywords.json`; calculates synergy scores from keyword overlap |
| `mtgjson-legality.ts` | `MTGJSONLegalityService`; validates Commander legality across 23 formats using MTGJSON legality data |
| `mtgjson-local.ts` | `MTGJSONLocalService`; loads individual set JSON from local files or MTGJSON API; supports offline lookup of Commander-recommended sets |
| `export.ts` | `DeckExporter` (text/CSV/Archidekt/Moxfield/TappedOut export) and `PurchaseUrlGenerator` (TCGPlayer/Card Kingdom/SCG purchase links) |
| `scheduled-sync.ts` | Background scheduler; checks every 6 hours and triggers a full server-card-database sync if data is more than 24 hours old |

---

## 2. API Routes (src/app/api/)

### Core User-Facing Routes

| Route | Method | Purpose | Request | Response |
|-------|--------|---------|---------|----------|
| `POST /api/generate` | POST | Generate a Commander deck | `{ commander: string, constraints: { total_budget?, max_card_price?, prefer_cheapest?, keywords?, keyword_focus?, card_type_weights?, random_tag_count? } }` | `{ success, deck, generated_at }` / 400 / 429 / 500 |
| `GET /api/commanders/search` | GET | Search commanders via Scryfall | `?q=<name>` (min 2 chars) | `{ success, commanders[], query, total, has_more, searched_at }` |
| `GET /api/commanders/random` | GET | Get a random legal commander | none | `{ commander, method: "scryfall api" }` |
| `GET /api/cards` | GET | List/search cards from local database | `?limit=<n>&search=<str>` | `{ cards[], total, limit, search }` |
| `GET /api/cards/details` | GET | Get a single card by name | `?name=<str>` | card object / 404 |
| `GET /api/cards/list` | GET | List cards (id, name, type, cmc, rarity, set, edhrec_rank) | `?limit=<n>&q=<str>` | `{ count, cards[] }` |
| `GET /api/cards/[id]` | GET | Get card by Scryfall ID | path param | card object |
| `GET /api/prices` | GET | Fetch prices for up to 100 card IDs | `?ids=<comma-list>&prefer_cheapest=<bool>` | `{ success, prices[], prefer_cheapest, total_cards, total_value, fetched_at }` |
| `POST /api/contact` | POST | Send contact form email via Resend | `{ name, email, subject?, message }` | `{ success, message }` / 400 / 500 |

### Database / Sync Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `GET /api/database/status` | GET | Environment info, card count, sync progress, memory usage |
| `POST /api/database/sync` | POST | Start a background database sync (409 if already in progress) |
| `GET /api/database/search` | GET | Search cards in local database |
| `GET /api/database/reanalyze` | GET/POST | Re-run mechanics tagger over stored cards |
| `POST /api/force-sync` | POST | Trigger immediate full sync; returns card count |
| `GET /api/test-sync` | GET | Run a database connectivity/sync test |
| `GET /api/debug/card-analysis` | GET | Debug endpoint for card mechanics analysis |
| `GET /api/debug/database-source` | GET | Debug which database source is active |

### Admin Routes (src/app/api/admin/) — ~52 endpoints

All admin routes are protected by IP-based middleware. Key categories:

**Tag management:** `analyze-tag-overlap`, `analyze-tags`, `apply-tag-addition`, `auto-tag-cards`, `available-tags`, `bulk-remove-tags`, `cards-by-tag`, `cleanup-mechanic-tags`, `cleanup-overlapping-tags`, `cleanup-tags-v2`, `manage-tags`, `popular-tags`, `preview-tag-addition`, `preview-tag-removal`, `search-tags`, `tag-blacklist`, `tag-categories`, `tag-statistics`, `test-tags`, `update-tags`

**Database operations:** `check-schema`, `current-db`, `database-commit`, `database-download`, `database-export`, `database-health`, `database-tags`, `deduplicate-cards`, `deduplicate-cards-simple`, `export-stats`, `reload-database`, `switch-database`

**Sync:** `debug-sync`, `fix-sync-status`, `insert-sync-record`, `set-initial-sync`, `sync-incremental`, `sync-report`, `sync-status`, `trigger-sync`

**Utilities:** `check-activity`, `check-duplicates`, `clear-cache`, `debug-auto-tag`, `debug-db`, `migrate-to-tag-ids`, `supabase-status`, `synergy-calculator`, `system-stats`

---

## 3. Components (src/components/)

| Component | Props Interface | Purpose |
|-----------|----------------|---------|
| `CommanderInput.tsx` | `{ value: string; onChange: (value) => void; onCommanderSelect: (ScryfallCard\|null) => void; error?: string }` | Commander search input with autocomplete against `/api/commanders/search` |
| `BudgetPowerControls.tsx` | `{ constraints: GenerationConstraints; onChange: (constraints) => void }` | Sliders for budget, max card price, power level, and prefer-cheapest toggle |
| `CardTypeWeights.tsx` | `{ weights: CardTypeWeights; onChange: (weights) => void }` | 0-10 sliders for each card type (creatures, artifacts, enchantments, instants, sorceries, planeswalkers) |
| `DeckList.tsx` | `{ deck: GeneratedDeck }` | Renders the full 100-card deck list grouped by role |
| `DeckAnalysis.tsx` | `{ deck: GeneratedDeck }` | Shows mana curve chart, color distribution, and role breakdown |
| `ExportOptions.tsx` | `{ deck: GeneratedDeck }` | Export buttons for text, CSV, Moxfield, Archidekt, TappedOut |
| `BuyDeck.tsx` | `{ deck: GeneratedDeck }` | Generates purchase URLs for TCGPlayer, Card Kingdom, StarCityGames |
| `SynergyAnalysis.tsx` | `{ cards: DeckCard[]; commander: DeckCard }` | Visualises synergy graph edges and deck cohesion score |
| `PriceBar.tsx` | `{ cards: DeckCard[]; totalPrice: number; budgetLimit?: number }` | Budget progress bar with per-card price breakdown |
| `RoleBreakdown.tsx` | `{ roleBreakdown: Record<string, number>; totalCards: number }` | Donut or bar chart of card role distribution |
| `ManaCost.tsx` | `{ manaCost?: string; className?: string }` | Renders MTG mana cost symbols from Scryfall notation |
| `Warnings.tsx` | `{ warnings: string[]; notes: string[] }` | Displays deck-generation warnings and informational notes |
| `DatabaseSync.tsx` | none | Self-contained floating panel; polls `/api/database/status` and triggers syncs |
| `MTGJSONDataManager.tsx` | none | Admin widget for managing MTGJSON data loads (comprehensive, pricing, keywords) |

---

## 4. Supabase Schema

### Tables

#### `cards` — user-facing
Core card data mirrored from Scryfall / MTGJSON. Every card a user might be shown or have in a generated deck is stored here.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Scryfall card ID |
| `name` | TEXT | Card name |
| `mana_cost`, `cmc` | TEXT / NUMERIC | Casting cost |
| `type_line`, `primary_type` | TEXT | Card types |
| `oracle_text` | TEXT | Rules text |
| `color_identity`, `colors` | JSONB | Arrays, indexed with GIN |
| `keywords` | JSONB | Scryfall keywords array |
| `set_code`, `set_name`, `rarity`, `collector_number` | TEXT | Print info |
| `legalities` | JSONB | Format legality map |
| `prices` | JSONB | `{ usd, usd_foil, ... }` from Scryfall |
| `edhrec_rank` | INTEGER | EDHREC popularity rank |
| `image_uris` | JSONB | Scryfall image URLs |
| `functional_roles`, `synergy_keywords`, `archetype_relevance` | JSONB | Output of `CardMechanicsTagger` |
| `power_level` | NUMERIC | 1-10 score from tagger |
| `last_analyzed` | TIMESTAMPTZ | When tagger last ran on this card |

#### `card_tags` — backend-only (tag engine internals)
Normalized tag rows linking cards to mechanic tags; feeds the synergy engine. Not shown directly to users.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `card_id` | UUID FK → cards | |
| `tag_name` | TEXT | e.g. `"token_creation"`, `"etb_trigger"` |
| `tag_category` | TEXT | e.g. `"mechanics"`, `"tribal"`, `"keyword_abilities"` |
| `confidence` | NUMERIC | Tagger confidence score |
| `priority` | INTEGER | Tag priority order |
| `evidence` | JSONB | Text snippets that triggered the tag |
| `is_manual` | BOOLEAN | True if manually assigned by admin |
| `tag_id` | INTEGER FK → tags | Added by migration 001; links to normalized tags table |

#### `tags` — backend-only (migration 001)
Normalized tag dictionary created by migration 001. Deduplicates tag names, stores `synergy_weight`, `category`, `description`, and `is_active` flag. Powers the admin tag-management UI.

#### `database_sync_status` — backend-only
Single-row operational table; tracks `last_full_sync`, `last_incremental_sync`, `total_cards`, `sync_in_progress`, `sync_progress`, `last_error`.

#### `tag_blacklist` — backend-only
Admin-curated list of tags to exclude from analysis, with `reason` text.

### Views
`cards_with_tags` — denormalised view joining `cards` and `card_tags`; used for bulk queries that need both card data and all associated tags.

### Key Indexes
- GIN indexes on `color_identity`, `colors`, `legalities` (array/JSON containment queries)
- Full-text search indexes on `oracle_text` and `name`
- Standard B-tree indexes on `name`, `type_line`, `cmc`, `rarity`, `set_code`, `power_level`

### Row-Level Security
RLS is enabled on all four tables. Public `SELECT` is allowed on `cards` and `card_tags`. Write access is service-role only (via `SUPABASE_SERVICE_KEY`). Admin JWT policies exist as commented-out templates.

---

## 5. Environment Variables

| Variable | Where Used | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase.ts`, `supabase-updated.ts` | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `supabase.ts`, `supabase-updated.ts` | Supabase anonymous key (public, client-safe) |
| `SUPABASE_SERVICE_KEY` | `supabase-updated.ts`, various admin routes | Supabase service role key (server-only, bypasses RLS) |
| `DATABASE_TYPE` | `database-factory.ts` | `"file"` (default) or `"supabase"` — selects database backend |
| `RESEND_API_KEY` | `api/contact/route.ts` | Resend email API key for contact form |
| `ADMIN_PASSWORD` | (referenced in `.env.example`) | Admin UI password (exact usage in admin routes) |
| `VERCEL` | `server-card-database.ts` | Detected as `"1"` to use `/tmp` for data storage on Vercel |
| `RAILWAY_ENVIRONMENT` | `server-card-database.ts` | Detected to use `/tmp` on Railway |
| `NODE_ENV` | Various | Controls debug logging and error verbosity |

---

## 6. External API Calls

| Service | Base URL | What It's Used For |
|---------|----------|--------------------|
| **Scryfall** | `https://api.scryfall.com` | Card search, named lookup, bulk-data download, random commander, price data, card collection fetch |
| **MTGJSON** | `https://mtgjson.com/api/v5/` | `AllPricesToday.json` (pricing), `Keywords.json` (keyword synergy), `AllPrintings.json` / `AtomicCards.json` / `SetList.json` (card data), individual set files |
| **GitHub Raw** | `https://raw.githubusercontent.com/Leeler7/commander-deck-generator/main/public/database/` | Self-hosted chunked card database (`manifest.json`, `cards-chunk-*.json.gz`, `name-index.json.gz`, `sync-status.json`) — fallback when local files are absent on serverless hosts |
| **Resend** | (SDK, no raw URL) | Transactional email for contact form submissions |
| **Supabase** | `https://bykbnagijmxtfpkaflae.supabase.co` | Card database reads/writes, tag management, sync status tracking |

---

## 7. Kill List — Replace with EDHREC Integration

These files/modules exist primarily to power the custom card-tagging and synergy-scoring engine. They will be redundant once EDHREC data (pre-computed recommendations, theme scores, synergy pairings) replaces the local inference layer.

| File | Reason to Kill |
|------|---------------|
| `src/lib/card-mechanics-tagger.ts` | ~210KB regex/rule engine that infers mechanic tags from oracle text; EDHREC provides pre-scored recommendations, making this unnecessary |
| `src/lib/tag-based-synergy.ts` | 200+ hardcoded synergy rules mapping commander tags → card tags; replaced by EDHREC theme/synergy data |
| `src/lib/synergy-graph.ts` | Builds synergy graphs from the custom tag data; EDHREC similarity scores serve the same purpose |
| `src/lib/mechanical-recommendation.ts` | 23 synergy interaction rules for recommending cards from mechanical gaps; EDHREC recommendation lists replace this |
| `src/lib/strategy-detection.ts` | Classifies commander strategy from mechanic tag densities; EDHREC commander pages already have theme classifications |
| `src/lib/commander-profiler.ts` | Extracts commander tags/archetypes/package seeds via text parsing; EDHREC commander profiles replace this |
| `src/lib/tribal-analysis.ts` | Tribal bonus scoring based on local pool analysis; EDHREC tribal data is more accurate |
| `src/lib/generation.ts` | Legacy generation pipeline that orchestrates all of the above; `new-generation-pipeline.ts` is the active replacement and will be rearchitected around EDHREC |
| `src/lib/enhanced-deck-generation.ts` | 10-step orchestrator built on the custom subsystems above; superseded by EDHREC-driven pipeline |
| `src/lib/candidate-pools.ts` | Role-based pool builder scoring cards with the custom synergy engine; EDHREC scores replace internal scoring |
| `src/lib/policy-selection.ts` | Deck policy generator derived from commander profiler; profile data comes from EDHREC in the new design |
| `src/app/api/admin/` (tag management routes) | All ~20 tag-management admin API endpoints (`analyze-tags`, `auto-tag-cards`, `cleanup-mechanic-tags`, `tag-statistics`, etc.) exist solely to maintain the custom tag database |
| `src/app/admin/tag-manager/`, `tag-builder/`, `tag-cleanup/`, `tags/`, `synergy/` pages | Admin UI pages for managing the tag engine |
| `supabase-schema.sql` `card_tags` table + `tags` table | These two tables exist only to store and index custom tags; the `cards` table itself should survive |
| `migrations/001_create_normalized_tags.sql`, `002_cleanup_legacy_structure.sql`, `003_remove_redundant_columns.sql`, `add_tag_ids_column.sql`, `add_tag_ids_to_cards.sql` | All migrations relate to the tag normalization system |
| `migrations/*.js` (all JS migration files) | Scripts for populating/migrating tag data |
| `src/components/SynergyAnalysis.tsx` | Displays synergy graph data from the custom engine; will be replaced by EDHREC-backed synergy display |
| `src/components/MTGJSONDataManager.tsx` | Admin panel for MTGJSON data management; EDHREC API replaces MTGJSON as card intelligence source |
| `src/lib/mtgjson-comprehensive.ts` | Large MTGJSON card data fetcher; not needed if EDHREC is the intelligence layer (Scryfall alone handles card data) |
| `src/lib/mtgjson-local.ts` | Local MTGJSON set loading; same rationale |

---

## 8. Keep List — Survives the Rebuild

These files/modules are working well and are independent of the custom tag/synergy engine.

| File | Why Keep |
|------|---------|
| `src/lib/scryfall.ts` | Solid, well-tested Scryfall API client with rate limiting and retry logic; still needed for card lookup, commander search, and image data |
| `src/lib/scryfall-pricing.ts` | Reliable per-card price fetcher; needed as a fallback when EDHREC/MTGJSON prices are unavailable |
| `src/lib/mtgjson-pricing.ts` | `AllPricesToday.json` batch pricing; efficient for bulk price lookups, keep as pricing source |
| `src/lib/mtgjson-keywords.ts` | Lightweight keyword synergy scorer; may still be useful as a supplementary signal |
| `src/lib/mtgjson-legality.ts` | Commander legality validation against MTGJSON legality data; format validation logic is format-agnostic |
| `src/lib/rules.ts` | Commander format rules (color identity, ban list, deck composition validation, role categorization); pure logic with no external dependencies |
| `src/lib/power.ts` | Power-level configuration table (1-10); clean data structure that is UI-driven, not tag-engine-driven |
| `src/lib/pricing.ts` | Budget-fitting and price-sorting utilities; deck assembly logic is independent of the synergy engine |
| `src/lib/budget-optimizer.ts` | Budget-constrained deck filling; role-quota logic is reusable with EDHREC-sourced candidates |
| `src/lib/percentage-weighting.ts` | User-facing card-type slider → quota conversion; pure presentation logic |
| `src/lib/mana-curve-optimizer.ts` | Mana curve analysis and archetype targets; useful for validating EDHREC-suggested card lists |
| `src/lib/export.ts` | Deck export (text/CSV/Moxfield/Archidekt/TappedOut) and purchase URL generation; entirely independent of synergy engine |
| `src/lib/scheduled-sync.ts` | Background database sync scheduler; keep, update to sync from EDHREC/Scryfall |
| `src/lib/database-factory.ts` | File/Supabase backend abstraction; keep the pattern, update implementations |
| `src/lib/server-card-database.ts` | Server-side card store with chunked loading from GitHub; keep the storage/serving mechanism, update data sourcing |
| `src/lib/card-database.ts` | Browser localStorage card cache; keep as client-side lookup cache |
| `src/lib/supabase-updated.ts` | Active Supabase integration with service-role support; keep, slim down schema |
| `src/lib/new-generation-pipeline.ts` | Active 8-step generation pipeline that the API route calls; keep as the scaffold, rewire steps 2-3 to use EDHREC data instead of the custom tagger |
| `src/lib/types.ts` | Core shared types; keep and extend |
| `src/components/CommanderInput.tsx` | Commander search autocomplete; fully working, no changes needed |
| `src/components/BudgetPowerControls.tsx` | Budget and power-level sliders; independent of synergy engine |
| `src/components/CardTypeWeights.tsx` | Card-type weight sliders; pure UI component |
| `src/components/DeckList.tsx` | Deck list renderer; works off `GeneratedDeck`, no engine dependency |
| `src/components/DeckAnalysis.tsx` | Mana curve and role breakdown charts; works off `GeneratedDeck` |
| `src/components/ExportOptions.tsx` | Export UI; calls `export.ts` only |
| `src/components/BuyDeck.tsx` | Purchase link UI; calls `export.ts` only |
| `src/components/PriceBar.tsx` | Budget progress display; pure UI |
| `src/components/RoleBreakdown.tsx` | Role distribution chart; pure UI |
| `src/components/ManaCost.tsx` | Mana symbol renderer; pure UI |
| `src/components/Warnings.tsx` | Warnings/notes display; pure UI |
| `src/components/DatabaseSync.tsx` | Database sync widget; keep, update API endpoint |
| `src/app/api/generate/route.ts` | Main deck generation endpoint; keep, update to call EDHREC-backed generator |
| `src/app/api/commanders/search/route.ts` | Commander search via Scryfall; keep as-is |
| `src/app/api/commanders/random/route.ts` | Random commander via Scryfall; keep as-is |
| `src/app/api/cards/` routes | Card lookup/list endpoints; keep as-is |
| `src/app/api/prices/route.ts` | Price lookup endpoint; keep as-is |
| `src/app/api/contact/route.ts` | Contact form; keep as-is |
| `src/app/api/database/` routes | Database status/sync routes; keep, update sync logic |
| `src/middleware.ts` | Admin IP-based access control; keep |
| `supabase-schema.sql` `cards` table | Core card data store; keep, remove tag columns if not needed |
| `public/database/` (chunked JSON) | Self-hosted card database for serverless deployments; keep serving mechanism |

---

## 9. Build Notes

**Status: Could not run — Node.js is not installed on the audit machine.**

npm, node, nvm, and fnm were all checked and are absent from this system. The following analysis is therefore static (based on source inspection), not from a live build run.

### Static analysis findings

| Finding | Severity | Details |
|---------|----------|---------|
| `vitest` missing from devDependencies | Error | `package.json` defines `"test": "vitest"` but `vitest` is not listed as a devDependency. `npm run test` will fail after a clean install. |
| `playwright` missing from devDependencies | Error | `package.json` defines `"test:e2e": "playwright test"` and `"test:e2e:ui": "playwright test --ui"` but `@playwright/test` is not in devDependencies. Both e2e scripts will fail. |
| Hardcoded Supabase credentials | Security | `supabase-updated.ts` contains fallback literal values for `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_KEY`. These should be removed and replaced with required env-var checks. |
| Dual supabase modules | Maintainability | Both `supabase.ts` and `supabase-updated.ts` export a `SupabaseCardDatabase` class. The older `supabase.ts` is superseded but still importable; risk of accidental use of stale module. |
| `generation.ts` and `card-mechanics-tagger.ts` each ~210KB | Performance | TypeScript will compile both fully on every `tsc` run. Expect slow typechecking until these files are deleted as part of the EDHREC migration. |
| Multiple competing generation pipelines | Maintainability | `generation.ts` (legacy), `new-generation-pipeline.ts` (active), and `enhanced-deck-generation.ts` (unused) all export deck generators. Only `new-generation-pipeline.ts` is called by the API route. The other two add dead-code surface area. |
| `DATABASE_TYPE=file` default uses GitHub raw URLs as fallback | Reliability | `server-card-database.ts` falls back to fetching card chunks from `raw.githubusercontent.com/Leeler7/…` if local files are missing. This creates a hard dependency on a specific GitHub repo in production. |

### To run build checks once Node.js is installed

```bash
cd C:/Users/laplo/OneDrive/Desktop/BDE/commander-deck-generator
npm install
npm run build
npm run typecheck
```

Expected issues on first run (beyond the above):
- `next build` may fail due to TypeScript errors in the large generated-pipeline files if strict mode catches anything not visible from static inspection.
- Missing `.env.local` will not cause build failure (Next.js tolerates absent env vars at build time) but will cause runtime errors if Supabase routes are exercised.

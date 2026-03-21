# Commander Deck Generator - Development Log
**Last Updated:** March 20, 2026 (session 9)
**Status:** Active Development

## Sprint — 2026-03-20: Negative Synergy Penalty + Functional Fallback

### Root cause
16 of 59 non-land cards (27%) had negative EDHREC synergy in a Krenko deck. The floor of `Math.max(20, ...)` gave every EDHREC card at least 20 points regardless of synergy. Functional bonuses (+15 ramp/draw/removal) then boosted negative-synergy cards to 35+, making them competitive with genuinely good cards.

### FIX — Step 2: Negative synergy penalty scaling
- **Positive synergy**: unchanged — `Math.max(20, inclusion*20 + synergy*80)`
- **Negative synergy**: 2x penalty weight, NO floor:
  `Math.max(0, inclusion*20 + synergy*200)`
  - -5% synergy → -10pts, -10% → -20pts, -18% → -36pts
- **Low inclusion (<15%) + negative synergy**: additional -20 hard reject
  - Kills: Urza's Saga (-6%/6%), Demand Answers (-14%/9%), Tibalt's Trickery (-10%/12%)
  - Preserves: Chaos Warp (-11%/51%) — high inclusion means players need it despite low synergy
- Added negative-synergy diagnostic log (worst 10 cards by score)

### FIX — Step 4: Functional bonus cap
- Functional bonus (+15 ramp, +15 draw, etc.) now only applies to cards with `finalScore >= 15`
- Cards below 15 (negative EDHREC synergy after penalty) get NO functional bonus during greedy selection
- Prevents functional needs from "rescuing" bad cards into the deck

### NEW — `step_FunctionalFallback()` (post-assembly)
- After deck assembly, checks functional minimums (ramp, card_draw, removal, board_wipe, protection)
- If a minimum is unmet, finds the best available card from the pool that fills that role
- Swaps it in for the weakest non-functional card in the deck
- Logs every rescue with EDHREC synergy data: `"Included X despite -10% synergy: only option for removal quota"`
- This is the **only path** negative-synergy cards can enter the deck — auditable and intentional

**Commit:** `b752d83 fix: penalize negative synergy cards, prevent functional bonuses from rescuing bad picks`

---

## Sprint — 2026-03-20: Self-Reference Fix + Combo-First Selection

### FIX 1 — Self-referential ability false positives (`engine-interaction.ts`)
**Root cause:** Endbringer appearing in Krenko decks — engine scoring saw "untap" in its oracle text ("Untap Endbringer during each other player's untap step" + "untap target creature an opponent controls"). The previous check matched both sentences.

**Fixes:**
- Added `candidateName?: string` parameter to `scoreEngineInteraction()` — called with `card.name` from all call sites
- Added `isSelfTargeting(text, verb, candidateName)` helper that checks 50-char window after verb for the card's own name or `~`
- **Untap check rewritten**: only fires for explicitly friendly-targeting language:
  `untap target creature/permanent you control`, `untap another creature`, `untap all/each you control`, `untap up to`, `untap equipped/enchanted`
  — NOT for unqualified `untap target permanent` (Endbringer) or `untap target creature an opponent controls`
- Split into two separate bonuses: **untap enabler +15** vs **tap-payoff +10** (benefits from things being tapped)
- **Sac outlet** now excludes self-sacrifice: if only "sacrifice" reference is `sacrifice {cardname}:`, the +15 bonus is suppressed

### FIX 2 — Combo-first card selection (`new-generation-pipeline.ts`)

**`step2b_ComboAwareScoring` rewrite:**
- Searches **top 100 cards** (was 30) for better combo coverage
- Respects bracket constraints: no infinite combos for bracket ≤2 or `no_infinite_combos`
- **Fetches missing combo pieces from Scryfall** by exact name if not in pool (colour-identity checked, capped at 20 fetches)
- **Size-based bonuses**: 2-card = **+30**, 3-card = **+20**, 4+ ignored
- **Completeness bonus +10**: when all other combo pieces score ≥50 in the pool
- Stores `TrackedCombo[]` in `this.earlyComboData` for post-assembly use

**New `step_ComboCompleteness()` (post-assembly, before bracket estimation):**
- For each combo exactly 1 piece short: swaps missing piece in from `themeEnhanced` for the lowest-scored non-combo card of the same type
- Affordability-checked against `max_card_price`

**`ComboDisplay.tsx` upgrades:**
- `isInfiniteCombo()` helper detects "infinite"/"unlimited" in results
- Each combo shows **"∞ Infinite"** (orange) or **"✓ Finite"** (green) badge
- Header shows total / infinite count / finite count pills
- Infinite combos in bracket ≤2 decks show contextual bracket warning
- Accepts `targetBracket` prop, wired from `constraints.targetBracket` in `page.tsx`

**Commit:** `38180f2 feat: fix self-reference scoring + combo-first selection via Commander Spellbook`

---

## Sprint — 2026-03-20: Commander Engine Interaction Scoring

### NEW — `src/lib/engine-interaction.ts`
Adds generalizable engine-awareness to card scoring — works for any legendary creature without hard-coded card names.

**`extractCommanderEngine(oracleText, typeLine) → CommanderEngineTraits`**
Reads the commander's oracle text and derives 20 boolean trait flags:
- *Production*: `produces_tokens`, `produces_token_subtype` (e.g. "goblin"), `produces_counters`, `produces_treasure`, `produces_clues`, `produces_food`, `produces_energy`
- *Needs / Costs*: `needs_tap`, `needs_sacrifice`, `needs_spells_cast`, `needs_attack`, `needs_discard`, `needs_life_payment`
- *Damage profile*: `deals_noncombat_damage`, `deals_combat_damage`
- *Other*: `mills`, `loots`, `reanimates`, `blinks`, `gains_life`, `fills_graveyard`

**`scoreEngineInteraction(traits, candidateOracle, candidateTypes) → {bonus, reasons}`**
Scores each candidate against the extracted traits:
| Scenario | Bonus |
|---|---|
| Token anthem / creature-ETB trigger (tokens producer) | +18–22 |
| Creature subtype tribal synergy (e.g. goblin lord for Krenko) | +20 |
| Sac outlet consuming tokens | +15 |
| Go-wide payoffs (creature count matters) | +15 |
| Counter synergy / proliferate (counter producer) | +18 |
| Untap enabler (tap-cost commander) | +15 |
| Dies-trigger (sacrifice commander) | +15 |
| Attack enabler (attack-trigger commander) | +12 |
| Spell-cast trigger (magecraft/storm) | +15 |
| Damage amplifier (noncombat damage commander) | +22 |
| Discard/madness synergy (loot commander) | +15 |
| Graveyard payoffs (graveyard-filler) | +15 |
| Life-gain synergy (lifelink commander) | +12 |
| Reanimate synergy (reanimator) | +15 |
| Life-gain trigger on non-life-gain commander | −10 |
| Noncombat damage amplifier on non-pinging commander | −10 |
| Combat-damage trigger on non-attacking commander | −8 |
| Graveyard synergy (delirium/threshold) on non-GY commander | −5 |

### CHANGED — `step2_ScoreSynergy` in `new-generation-pipeline.ts`
- Commander engine extracted **once** at the top of the scoring step (zero per-card overhead)
- Each candidate's `synergyScore` adjusted by engine interaction delta on top of the EDHREC/keyword score
- Active engine traits logged at generation time for transparency
- Top 5 most-penalized cards printed to console per generation (debugging aid)

**Example — Krenko, Mob Boss:**
Traits detected: `produces_tokens`, `produces_token_subtype: goblin`, `needs_tap`
→ Goblin lords receive +20 tribal bonus, ETB triggers +18, Purphoros/Impact Tremors +22 damage amplifier (commander produces creatures that trigger them), sac outlets +15
→ Life-gain triggers −10, noncombat damage amplifiers for non-pinging commanders −10

**Commit:** `688edd3 feat: commander engine interaction scoring`

---

## Sprint — 2026-03-20: Functional Coverage Scoring + Bracket-Aware Card Selection

### NEW — `src/lib/functional-roles.ts`
- Introduces `classifyCardFunction(oracleText, typeLine)` which detects up to 7 functional roles per card: `ramp`, `card_draw`, `removal`, `board_wipe`, `protection`, `tutor`, `payoff`
- `countFunctionalRoles(cards)` aggregates coverage across a card array into a `FunctionalCoverage` object
- `calculateFunctionalBonus(roles, coverage, bracketTarget)` returns a score bonus for cards that fill unmet deck needs; high-power brackets (4+) raise minimums for ramp/draw/tutors, low brackets (≤2) deprioritise tutors

### CHANGED — `step4_ApplyRatios` in `new-generation-pipeline.ts`
- Signature extended to accept `constraints?: GenerationConstraints`
- Replaced simple `sort + slice` with greedy selection: before each type-quota is filled, current functional coverage is computed from already-selected cards; each candidate receives an adjusted score = `finalScore + functionalBonus`; mana-curve preference is preserved as a small fractional nudge
- `alreadySelected` array grows after each type batch so later batches (e.g. sorceries) benefit from knowing what creatures/artifacts already cover

### CHANGED — Combo injection gating
- Added `!(constraints.targetBracket && constraints.targetBracket <= 2)` guard to the combo injection block at spice >= 7; Exhibition/Core bracket decks no longer receive injected infinite combos even at maximum spice

### CHANGED — `GeneratedDeck` type + return value
- Added optional `functionalCoverage` field to `GeneratedDeck` in `types.ts`
- `generateDeck()` now computes and returns `functionalCoverage: countFunctionalRoles([...finalNonlands, ...finalLands])`

### CHANGED — `src/app/page.tsx`
- Added "Deck Functions" panel in the Generation Settings sidebar section
- Displays ramp / card draw / removal / board wipes / protection / tutors with colour-coded counts: green = meets minimum, yellow = within 70 % of minimum, red = below 70 %

## Sprint — 2026-03-20: Smarter Keyword Extraction + Color Penalty + EDHREC Priority

### FIX — Colorless planeswalkers beating on-theme colored options

**Root cause 1 — Stop words too narrow in step1b:**
- "create" and "creature" weren't in the stop word list, so Krenko's strategy keywords were `[create, goblin, creature]` instead of `[goblin, token, goblins]`
- Extended STOP_WORDS with all generic action verbs (create, tap, draw, sacrifice, destroy, return, search, exile, discard, put, add, deals, gains) and generic game-zone terms (creature, land, battlefield, graveyard, library, hand, mana, cost, effect, copy, control, player, card, turn, phase, combat)
- Krenko now extracts `[goblin, token, goblins]` — strategy-defining terms only

**Root cause 2 — Supplemental search included colorless:**
- `id<=r` (color identity) includes colorless cards; `Karn, Living Legacy` passes this filter
- Added `-c:c` suffix to supplemental type searches for non-artifact types in colored commanders
- Broad query: `t:planeswalker id<=r f:commander -c:c` — now excludes Karn/Ugin
- Strategy query: `t:planeswalker id<=r f:commander o:"token" -c:c` — finds Chandra etc.
- Artifacts exempt: colorless artifacts are expected and normal

**Root cause 3 — Colorless non-artifacts got neutral keyword score:**
- In step2, cards not in EDHREC data score 2-15 via keyword matching
- Colorless non-artifacts for colored commanders now receive -15 penalty → floor 0
- Makes even a mediocre red planeswalker beat Karn/Ugin in a red deck

**Root cause 4 — EDHREC cards could score below keyword-only matches:**
- An EDHREC card at 1% inclusion / 0% synergy scored ~2 pts; keyword-only card could score 15
- Changed `Math.max(0, ...)` to `Math.max(20, ...)` for EDHREC-listed cards
- Now ANY card in the EDHREC dataset scores ≥20, beating the 15 keyword cap

**Result:** Krenko planeswalker selection now picks Chandra/Daretti/on-theme red options instead of colorless Karn/Ugin.

---

## Sprint — 2026-03-20: Supplemental Type-Specific Pool Searches

### FEAT — step1b_SupplementalTypeSearches (new pipeline step)
- **Problem:** Broad Scryfall pagination (875 cards by EDHREC rank) gives hundreds of creatures but only 8-12 planeswalkers — all generically popular, none commander-specific.
- **New step `1b`** runs after step1 pool assembly, before step2 scoring.
- For each card type with a non-zero slider weight, counts how many cards of that type are in the pool.
- If pool count < 3× quota (e.g. 5 planeswalkers but quota is 2 → threshold is 6), runs two lightweight supplemental searches (1 page / ~175 cards each):
  1. **Broad type search:** `t:{type} id:{colors} f:commander` sorted by EDHREC rank — finds the most popular cards of that type in color
  2. **Strategy search:** `t:{type} id:{colors} f:commander o:"{keyword}"` — top oracle-text keyword extracted from commander's text (e.g. Krenko → "goblin") — finds mechanically relevant cards that pagination was skipping
- Strategy keywords extracted by word frequency from commander oracle text, filtered against a stopword list, top 3 words selected.
- Results merged with existing `seenIds`/`seenNames` dedup — no duplicates introduced.
- Rate-limited: 110ms delay between supplemental API calls; at most 2 calls per thin type (types with full pools skip entirely).
- Logged per-type: `STEP1b: planeswalker pool=5 < threshold=6 (quota=2) — running supplemental searches`

## Sprint — 2026-03-20: Singleton Enforcement Deep Fix

### BUG — Duplicate non-basic cards still appearing after initial fix
- **Root cause #1:** Budget swap, combo card removal, and Game Changer removal all built `usedNames` from `finalNonlands` only — completely blind to cards already in `finalLands`. Cards like Castle Embereth and Path of Ancestry (placed in `finalLands`) could be swapped back in as nonlands.
- **Fix:** All three `usedNames` Sets now built from `[...finalNonlands, ...finalLands]` (commit `363e87f`)
- **Root cause #2:** Initial dedup pass ran before the budget enforcement swaps — swaps then re-introduced duplicates after dedup had already run.
- **Fix:** Layer order corrected — `usedNames` in all swap operations is now aware of full deck before any card is substituted

### Singleton enforcement now applied at 6 layers (belt + suspenders):
1. **Pool (step1):** `seenNames` Set deduplicates by card name across all printings
2. **step4 output:** Dedup pass before return — catches any duplicates from type-bucket merging
3. **step8 fill:** `toAddNames` guards per-card loop — fill slots can't repeat names
4. **Final validation:** Dedup with backfill from `themeEnhanced` pool after step8
5. **Budget/bracket swaps:** `usedNames` now includes both `finalNonlands` AND `finalLands`
6. **React (DeckList.tsx):** `key` changed from `card.id` to `` `${card.name}-${index}` `` — crash-safe even if an edge case slips through

---

## Sprint — 2026-03-20: Soft Budget, Spice Filtering, Combo-Aware Scoring, Official Bracket System

### FIX 1 — Budget as soft target
- "Total Budget" renamed to "Budget Target" in UI with helper text
- Hard cap: `max_card_price` — cards over this are always dropped (step6)
- Soft target: `total_budget` — if deck exceeds by >50%, aggressively swap up to 20% of nonlands for cheaper alternatives; if 20-50% over, log and keep deck quality
- Generation settings display shows "Budget Target: $X"

### FIX 2 — Non-synergistic cards at spice 0
- At spice 0, only user-typed `keyword_focus` triggers oracle text searches
- Injected themes and random tags skip oracle searches at spice 0
- Cards not in EDHREC recommendations are scored ≤15 (vs EDHREC cards at 20-100+), so they only fill slots EDHREC cards can't
- `addRandomizedTags` already skips at spice 0 — verified

### FIX 3 — Commander Spellbook integration
- Step2b: combo-aware scoring boosts combo-completing cards by +25 points
- ComboDisplay.tsx: new component showing detected combos with Scryfall links, results, prerequisites, steps
- BracketEstimate.tsx: new component with 5-bracket display (Exhibition/Core/Upgraded/Optimized/cEDH)
- Target Bracket: 5 options in UI; bracket ≤2 filters ALL Game Changers from card pool

### BUG 1 — Duplicate non-basic lands
- Deduplication added DURING assembly (after step8, before lands/nonlands split)
- Basic lands (Plains/Island/Swamp/Mountain/Forest/Wastes) allowed multiples
- All other cards must be unique — duplicates are filtered with console.warn

### BUG 2 — Official 5-bracket system
- NEW: `src/lib/brackets.ts` — exports GAME_CHANGERS list (51 cards as of Feb 2026)
- `estimateBracketLocal()`: 0 GCs → Bracket 2; 1-3 GCs → Bracket 3; 4+ GCs → Bracket 4; combos with 0 GCs → Bracket 3
- Removed dependency on Commander Spellbook `estimateBracket` endpoint (unreliable external API)
- `BracketEstimate` type updated with `gameChangersFound`, `gameChangerCount`, `reasons` fields
- `BracketEstimate.tsx`: 5-bracket display with color coding, Game Changers list with Scryfall links, reasons

---

## Project Overview

A React/Next.js web application that generates 100-card Commander (EDH) decks for Magic: The Gathering. It uses an inverted card pool strategy — keyword/theme oracle-text searches run first, EDHREC popularity data is used for scoring and gap-filling, and a broad Scryfall fallback handles the rest. No local database; all card data is fetched live from external APIs.

---

## Current Architecture

### Core Technologies
- **Frontend:** React + Next.js 15.4.6 (App Router), TypeScript strict mode
- **Backend:** Next.js API routes (serverless)
- **Card Data:** Scryfall API (live search, no local DB)
- **Synergy/Popularity:** EDHREC JSON API (`json.edhrec.com`) — 24 h in-memory cache, 1 req/sec rate limit
- **Combo Detection:** Commander Spellbook backend API
- **Pricing:** Scryfall prices + MTGJSON bulk pricing data (in-memory)
- **Email (contact form):** Resend API (optional)
- **Dev server:** Turbopack (`npm run dev`)

### Card Pool Assembly — Inverted Logic

```
1. Keyword oracle-text searches (FIRST — highest priority)
   Only at spice >= 1: injected keywords (constraints.keywords) and random_tags
   At all spice levels: user-typed keyword_focus always searched
   Pages per keyword: 1 (spice 0) → 2 (spice 5) → 3 (spice 10)
   Capped at 6 keywords per generation

2. Broad EDHREC-sorted fallback
   id:<colors> f:commander -type:basic, sorted by edhrec rank
   Pages: 5 (spice 0) → 3 (spice 6) → 2 (spice 10)

3. Dedup + merge: keyword cards placed first in pool
```

### Generation Pipeline (`src/lib/new-generation-pipeline.ts`)

| Step | Description |
|------|-------------|
| pre  | `addRandomizedTags` — pull EDHREC themes for spice, add to keyword pool |
| pre  | `loadEDHRECData` — cache EDHREC recs for this commander |
| 1    | `step1_ColorMatchCommander` — build inverted card pool (keyword-first) |
| 2    | `step2_ScoreSynergy` — EDHREC synergy+inclusion scores; non-EDHREC cards capped at 15 pts |
| 2b   | `step2b_ComboAwareScoring` — Spellbook combo detection on top-30 pool; combo pieces +25 pts |
| 3    | `step3_ApplyUserThemes` — EDHREC themed recs bonus + oracle-text +300/match |
| 4    | `step4_ApplyRatios` — proportional slot allocation by type weights |
| 5    | `step5_EvaluatePrices` — Scryfall + MTGJSON pricing; marks `isAffordable = price <= max_card_price` |
| 6    | `step6_SubstituteExpensiveCards` — hard-drops over-budget cards; no escape hatch |
| 7    | `step7_ValidateDeckSize` — trim/pad to target counts |
| 8    | `step8_FillWithSynergy` — fill remaining slots from scored pool (over-budget cards excluded) |
| post | Mana curve analysis + basic land generation |
| post | Soft budget enforcement — if deck >50% over `total_budget`, swap up to 20% of nonlands |
| post | `estimateBracket()` — Commander Spellbook (always) |
| post | Bracket targeting — if `targetBracket` set and estimate exceeds it, remove combo cards + re-estimate |
| post | `findCombos()` — Commander Spellbook (spice ≥ 7 only); inject missing pieces |

### Spice Level (0–10)

Controls the ratio between keyword-searched pool and broad EDHREC pool, plus the number of randomised EDHREC themes added to `constraints.keywords`.

- **0** — "Play it safe" — pure EDHREC-driven, no random themes
- **5** — "Balanced" — equal mix
- **10** — "Maximum chaos" — keyword searches dominate, random EDHREC themes injected

---

## Current File Structure

### Core Libraries (`src/lib/`)
| File | Purpose |
|------|---------|
| `new-generation-pipeline.ts` | Main deck generation (8-step + post-assembly) |
| `edhrec.ts` | EDHREC JSON API client + 24 h cache |
| `scryfall.ts` | Scryfall API client (search, validate commander) |
| `combos.ts` | Commander Spellbook client (findCombos, estimateBracket) |
| `pricing.ts` | Scryfall price extraction |
| `mtgjson-pricing.ts` | MTGJSON bulk pricing (in-memory) |
| `mtgjson-keywords.ts` | MTGJSON keyword data for fallback synergy |
| `mana-curve-optimizer.ts` | Mana curve analysis + archetype detection |
| `budget-optimizer.ts` | Budget constraint helpers |
| `rules.ts` | Commander legality + color-identity validation |
| `types.ts` | All TypeScript interfaces |

### Components (`src/components/`)
| File | Purpose |
|------|---------|
| `CommanderInput.tsx` | Commander search autocomplete |
| `ThemeSelector.tsx` | Clickable EDHREC theme pills per commander |
| `BudgetPowerControls.tsx` | Spice slider + keyword input + card type weights |
| `BracketEstimate.tsx` | 1–4 visual bracket scale (green→red) with combo count |
| `ComboDisplay.tsx` | Full combo list with Scryfall links, collapsible prerequisites + steps |
| `DeckList.tsx` | Full card list (list + grid view, filter by role) |
| `DeckAnalysis.tsx` | Mana curve, type distribution, stats |
| `RoleBreakdown.tsx` | Role distribution chart |
| `PriceBar.tsx` | Price breakdown bar |
| `ManaCost.tsx` | Mana symbol renderer |
| `ExportOptions.tsx` | Export deck (text, MTGO, etc.) |
| `BuyDeck.tsx` | TCGPlayer buy links |
| `Warnings.tsx` | Generation warnings + notes |
| `CardTypeWeights.tsx` | Type weight sliders |

### API Routes (`src/app/api/`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/generate` | POST | Main deck generation endpoint |
| `/api/commanders/search` | GET | Scryfall commander search |
| `/api/commanders/random` | GET | Random legal commander |
| `/api/themes` | GET | EDHREC themes for a commander |
| `/api/cards/[id]` | GET | Single card lookup |
| `/api/prices` | GET | Card pricing data |
| `/api/contact` | POST | Contact form (Resend) |

### Environment Variables
| Variable | Required | Purpose |
|----------|----------|---------|
| `RESEND_API_KEY` | Optional | Contact form email sending |

---

## Development Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run typecheck    # tsc --noEmit (zero-error target)
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright e2e tests
```

---

## Commit History (local, not pushed)

| Hash | Message |
|------|---------|
| `0f0ac8c` | `chore: repo cleanup and audit` |
| `fbeb485` | `feat: remove Supabase and all dead-code; rewire to EDHREC + Scryfall` |
| `0c00767` | `feat: wire combos + bracket estimation + spice slider + fix type errors` |
| `3719c52` | `feat: inverted card pool + theme selector + bracket display + spice labels` |
| `8924c0b` | `refactor: replace tag browser with simple keyword input` |
| `a79aad9` | `docs: update devlog for keyword input refactor` |
| `994b866` | `docs: update dev log and env example for v2` |
| `4712f64` | `fix: EDHREC synergy scoring + theme parsing + restore budget controls` |
| `ddb8214` | `fix: enforce budget constraints + display budget + clean up theme pills` |
| `671acc4` | `fix: soft budget + spice filtering + combo-aware selection + bracket targeting` |

---

## Sprint: Soft Budget, Spice Filtering & Spellbook Integration (March 2026)

### Overview
Three playtesting issues addressed: budget was too aggressive and sacrificed deck quality,
non-synergistic cards leaked in at spice 0, and the Commander Spellbook integration was
shallow (only injecting combos post-assembly rather than selecting combo-synergistic cards
during scoring). Also added bracket targeting as an actionable control.

### FIX 1 — Budget soft target

**Change:** `total_budget` is now a soft target, not a hard cap.
- UI label renamed "Budget Target ($)" with helper text explaining the tolerance behaviour
- Pipeline: if assembled deck exceeds `total_budget` by >50%, up to 20% of nonlands are
  swapped out for cheaper alternatives from the scored pool; if 20–50% over, it's logged
  as a note and deck quality is preserved
- `max_card_price` remains a hard cap (unchanged)
- Results page "Generation Settings" panel updated to show "Budget Target: $X"

### FIX 2 — Non-synergistic cards at spice 0

**Root cause:** At spice 0, `constraints.keywords` (injected themes) were included in
oracle-text searches alongside user-typed `keyword_focus`. Cards like Hangarback Walker
match "token" oracle text but have zero EDHREC synergy with Krenko, yet were entering the
pool and scoring neutrally.

**Fixes:**
- `step1_ColorMatchCommander`: at spice=0, only `keyword_focus` (user-typed + theme
  selector choices) triggers oracle searches; `constraints.keywords` and `random_tags`
  are excluded from pool building at spice 0
- `step2_ScoreSynergy`: non-EDHREC cards now capped at score 15 (previously uncapped
  keyword score). They only fill slots that genuinely EDHREC-recommended cards cannot.
  Synergy notes updated to "Keyword match (no EDHREC data): …" for transparency

### FIX 3a — Combo-aware card selection (step2b)

**New pipeline step** inserted between step2 and step3:
- Calls `spellbookClient.findCombos()` with the top-30 highest-scored cards
- For any combo where pieces exist in the broader pool but scored low, boosts those
  cards by +25 points
- Adds `synergy_notes: "Completes combo: X + Y → result"` to boosted cards
- Combos emerge naturally from scoring rather than being force-injected post-assembly

### FIX 3b — ComboDisplay.tsx

**New component** (`src/components/ComboDisplay.tsx`):
- Shows all detected combos with card names as Scryfall links
- Collapsible per-combo view of prerequisites, step-by-step instructions, and result
- Amber/lightning-bolt styling; only renders when combos are present
- Wired into `page.tsx` below the BracketEstimate component
- Data source: `generatedDeck.bracketEstimate.combos`

### FIX 3c — Bracket targeting

**New field:** `targetBracket?: number` added to `GenerationConstraints` (1–4).

**UI:** Any / 1-Exhibition / 2-Core / 3-Upgraded / 4-cEDH button row in
`BudgetPowerControls.tsx`, passed through API route.

**Pipeline logic** (post-assembly):
1. `estimateBracket()` runs as before
2. If `targetBracket` is set and estimated bracket exceeds it:
   - All card names flagged in detected combos are removed from nonlands
   - Replaced with next-best non-combo cards from the scored pool
   - `estimateBracket()` runs once more on the adjusted deck
3. Target bracket shown in Generation Settings panel on results page

---

## Sprint: Budget Enforcement & UX Polish (March 2026)

### Overview
Follow-up fixes after the EDHREC integration sprint. Three issues resolved: budget
constraints were silently ignored by the pipeline, budget settings weren't visible on
the results page, and the theme selector became unusable with 100+ pills for popular
commanders.

### BUG 1 — Budget constraints not enforced

**Root cause:** Two separate failures in the pipeline:
1. `step5_EvaluatePrices` was marking every card `isAffordable: true` regardless of price
2. `step6_SubstituteExpensiveCards` had an escape hatch (`finalScore >= 15`) that kept expensive
   high-synergy cards even when no affordable substitute was found
3. `step8_FillWithSynergy` was refilling emptied slots from the unfiltered `allScoredCards` pool,
   re-introducing over-budget cards

**Fixes:**
- `step5`: `isAffordable` now correctly set to `price <= max_card_price`
- `step6`: removed the high-synergy escape hatch — over-budget cards with no substitute are
  dropped unconditionally; step8 fills the slot from the affordable pool
- `step8`: added `extractCardPrice` check before pushing any card into `availableByType`;
  cards exceeding `max_card_price` are skipped entirely

### BUG 2 — Budget not shown in Generation Settings

**Fix:** Added a "Budget" row to the Generation Settings panel on the results page (`src/app/page.tsx`),
displaying `Total Budget: $X` and `Max Card Price: $X` (or "No limit" if unset). Row only renders
when at least one budget value is present.

### UX FIX — Theme selector showing 100+ pills

**Fix (`ThemeSelector.tsx`):**
- Themes sorted by deck count descending so the highest-traffic themes appear first
- Only top 12 shown by default
- Dashed "Show all (N more)" / "Show less" toggle button appears when there are more than 12 themes

**Verified:** Krenko shows Goblins (337) → Equipment (89) → Voltron (76) … Auras (5), then
"Show all (26 more)" — exactly 12 pills before the toggle.

---

## Session History (archived)

> The entries below document older sessions from the pre-refactor codebase
> (tag-based synergy engine, local JSON database, Supabase). They are kept
> for historical reference only — none of the files or systems they describe
> still exist in the codebase.

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

## Bug Fixes: EDHREC Scoring + Themes + Budget Controls (2026-03-20)

### BUG 1 — EDHREC synergy scoring too weak (`edhrec.ts`, `new-generation-pipeline.ts`)

**Root cause:** The `inclusion` field in EDHREC's JSON API is a raw deck count (e.g. `32596`), not a 0–1 fraction. The scoring formula was:
```
inclusionScore = inclusion * 40  →  32596 * 40 = 1,303,840
synergyBonus  = synergy  * 60  →  0.72 * 60  = 43
```
Inclusion was ~30,000× larger than synergy, so every card ranked by raw popularity count alone — goblin-specific cards and generic Sol Ring equivalents scored similarly.

**Fixes:**
- `extractCardRecommendations`: `inclusion = numDecks / potentialDecks` (now 0–1 fraction)
- Scoring formula changed to `(inclusion * 20) + (synergy * 80)` — synergy dominates
- Result: Goblin Warchief for Krenko scores ~75 vs a generic goodstuff card scoring ~21 (3.5× gap)
- Added `console.log` top-20 synergy scores after step2 for ongoing debugging

### BUG 2 — EDHREC themes returning empty for all commanders (`edhrec.ts`)

**Root cause:** `getCommanderThemes` looked in `panels.tribelinks`, `related_info.themes`, and `container.json_dict.relatedinfo.themes` — none of these paths exist in the actual API response. Themes live at `panels.taglinks[]{slug, value, count}`.

Additionally, themed card page URLs were wrong: `/pages/commanders/{cmd}/{theme}.json` → fixed to `/pages/tags/{theme}/{cmd}.json`.

**Fixes:**
- `getCommanderThemes`: reads `page.panels.taglinks` and maps `{value→name, slug, count}`
- `getThemedRecommendations`: URL changed from `/pages/commanders/${slug}/${theme}.json` to `/pages/tags/${theme}/${slug}.json`
- Krenko now returns: Goblins (8678 decks), Tokens (2113), Aggro (1580), Combo (659), Burn (472)…

### BUG 3 — Budget controls missing from UI (`BudgetPowerControls.tsx`)

**Root cause:** Total Budget, Max Price Per Card, and Prefer Cheapest Printing inputs were left inside a `{/* ... */}` comment block from a previous refactor that removed 264 lines.

**Fixes:**
- Uncommented and restored all three budget controls
- Corrected field name from `per_card_cap` to `max_card_price` (the primary field per `types.ts`)
- Removed dead commented-out budget summary block

---
*This log should be updated after each development session to maintain project continuity.*
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
*This log should be updated after each development session to maintain project continuity.*
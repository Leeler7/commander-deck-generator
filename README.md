# Big Deck Energy

A free online MTG Commander (EDH) deck generator that builds casual, fun, and chaotic decks instantly. Live at [bigdeckenergy.org](https://bigdeckenergy.org).

## What It Does

Enter a legal commander, tweak some settings, and get a complete 100-card Commander deck in seconds. The decks are intentionally casual and embrace the jank — this isn't an optimizer, it's a chaos engine for fun Commander nights.

### Features

- **Commander Search**: Autocomplete with legal commander validation (legendary creatures and eligible planeswalkers)
- **EDHREC Theme Integration**: Choose from themes pulled from EDHREC (tribal, voltron, tokens, etc.) to guide card selection
- **Build Modes**: Classic (balanced across themes) or Hyper Focus (maximize theme synergy, cut generic cards)
- **Speed / Pacing**: Slider from Aggro to Late Game that shapes the mana curve
- **Spice Level**: 0 (EDHREC staples) to 10 (maximum chaos with rare/niche keyword searches)
- **Budget Controls**: Total deck budget and per-card price caps
- **Game Changers**: Control how many high-impact cards (Sol Ring, Mana Crypt, etc.) are allowed (None / Up to 3 / Up to 6 / Unlimited)
- **Lands**: Adjustable total land count and non-basic land ratio
- **Card Type Weights**: Optional fine-tuning of creature, instant, sorcery, enchantment, artifact, and planeswalker ratios
- **Max Rarity**: Cap card rarity (Common through Mythic)
- **Must-Include / Excluded Cards**: Force specific cards in or out of the deck
- **BIG DECK ENERGY Button**: Picks a random commander and randomizes all settings for maximum chaos
- **Dark Mode**: Toggle between light and dark themes, persists across sessions

### Results Page

- **Power Bracket Estimate**: Estimates the deck's Commander bracket (1-4) based on card composition
- **Detected Combos**: Identifies combos in the deck via Commander Spellbook with direct links
- **Deck Analysis**: Cards by type, mana curve, average CMC, color distribution
- **Commander Analysis**: Commander-specific synergy breakdown
- **Role Breakdown**: Visual breakdown of card roles (ramp, removal, draw, etc.)
- **Price Analysis**: Deck cost with per-card breakdown
- **Collapsible Deck List**: Consolidated view with duplicate grouping (e.g., "Forest x18")
- **Export**: Download as text file or copy for Moxfield/Archidekt import
- **Buy This Deck**: Direct import to TCGPlayer Mass Entry, clipboard copy for Card Kingdom

### Pages

- **Home** (`/`): Deck generator and results
- **FAQ** (`/faq`): Frequently asked questions
- **Contact** (`/contact`): Contact form

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 with class-based dark mode
- **Deck Engine**: [20q2's mtg-commander-deck-generator](https://github.com/20q2/mtg-commander-deck-generator) (MIT licensed)
- **Data Sources**: Scryfall API (cards, prices, legality), EDHREC (themes), Commander Spellbook (combos)
- **Deployment**: Vercel

## Quick Start

```bash
git clone https://github.com/Leeler7/commander-deck-generator.git
cd commander-deck-generator
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Project Structure

```
/src
  /app
    /api
      /generate/route.ts            # Deck generation endpoint
      /commanders/search/route.ts   # Commander autocomplete search
      /commanders/random/route.ts   # Random commander selection
      /themes/route.ts              # EDHREC theme fetching
      /prices/route.ts              # Card price lookup
      /cards/route.ts               # Card data endpoints
      /contact/route.ts             # Contact form submission
    /faq/page.tsx                   # FAQ page
    /contact/page.tsx               # Contact page
    page.tsx                        # Main generator + results page
    layout.tsx                      # Root layout with ThemeProvider
    globals.css                     # Global styles + dark mode overrides
  /lib
    /engine/                        # 20q2 deck generation engine + adapter
      adapter.ts                    # BDE types <-> engine types
      deckGenerator.ts              # Core generation logic
      bracketEstimator.ts           # Power bracket estimation
      themeDetector.ts              # Theme/synergy detection
      ...
    export.ts                       # Export formats + purchase URL builders
    types.ts                        # BDE TypeScript interfaces
    scryfall.ts                     # Scryfall API client
  /components
    CommanderInput.tsx              # Commander autocomplete search
    ThemeSelector.tsx               # EDHREC theme picker
    BudgetPowerControls.tsx         # Budget + speed + spice controls
    CardTypeWeights.tsx             # Card type ratio sliders
    BracketEstimate.tsx             # Power bracket display
    ComboDisplay.tsx                # Detected combos (collapsible)
    DeckAnalysis.tsx                # Cards by type, curve, colors
    CommanderAnalysis.tsx           # Commander synergy breakdown
    RoleBreakdown.tsx               # Role distribution chart
    PriceBar.tsx                    # Price analysis
    DeckList.tsx                    # Collapsible deck list
    ExportOptions.tsx               # Download + copy export
    BuyDeck.tsx                     # TCGPlayer + Card Kingdom purchase
    ThemeProvider.tsx               # Dark mode context + persistence
    DarkModeToggle.tsx              # Dark mode toggle button
```

## Data Sources

- **[Scryfall API](https://scryfall.com/docs/api)**: Card data, prices, legality, search. Rate limited to 10 req/s with exponential backoff.
- **[EDHREC](https://edhrec.com)**: Commander themes and popular card recommendations.
- **[Commander Spellbook](https://commanderspellbook.com)**: Combo detection and linking.

## Disclaimer

This application is not affiliated with Wizards of the Coast. Magic: The Gathering is a trademark of Wizards of the Coast LLC. Card data provided by [Scryfall](https://scryfall.com). Deck engine by [20q2](https://github.com/20q2/mtg-commander-deck-generator) (MIT licensed).

## License

MIT

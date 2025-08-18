# Commander Deck Generator

A production-grade web application that generates power level and budget aware Magic: The Gathering Commander (EDH) decks with synergy explanations and export capabilities.

## Features

### ✨ Core Functionality
- **Commander Validation**: Autocomplete search with legal commander verification
- **Power Level Scaling**: 1-10 power system with role quotas and interaction density
- **Budget Constraints**: Total budget and per-card caps with cheapest printing options
- **Synergy Analysis**: AI-driven card selection with explanations for each inclusion
- **Multiple Export Formats**: Text, CSV, JSON, and direct links to Archidekt/Moxfield

### 🔒 Legal & Compliance
- **Color Identity Enforcement**: Cards must match commander's color identity
- **Official Ban List**: Real-time checking against the Commander Rules Committee ban list
- **Format Legality**: Only Commander-legal cards included
- **Singleton Rule**: Enforced 100-card singleton deck construction

### ⚡ Performance & UX
- **Rate Limiting**: Respects Scryfall API guidelines (100ms delay, exponential backoff)
- **Real-time Search**: Debounced commander search with autocomplete
- **Responsive Design**: Mobile-first Tailwind CSS implementation
- **Loading States**: Progress indicators and error handling

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **API Layer**: Next.js Route Handlers
- **Data Sources**: Scryfall API (primary), Commander Spellbook API (combo detection)
- **Testing**: Vitest (unit) + Playwright (E2E)
- **Deployment**: Vercel-ready with free tier optimization

## Quick Start

```bash
# Clone and install
git clone <repository-url>
cd commander-deck-generator
npm install

# Development
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Production server

# Testing
npm run test         # Unit tests
npm run test:e2e     # E2E tests
npm run typecheck    # TypeScript validation
npm run lint         # ESLint checks
```

Visit [http://localhost:3000](http://localhost:3000) to use the application.

## API Reference

### POST /api/generate

Generate a complete Commander deck.

**Request Body:**
```json
{
  "commander": "Atraxa, Praetors' Voice",
  "constraints": {
    "power_level": 7,
    "total_budget": 200,
    "per_card_cap": 25,
    "prefer_cheapest": true,
    "no_infinite_combos": false,
    "no_land_destruction": true,
    "no_extra_turns": false,
    "no_stax": true,
    "no_fast_mana": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "deck": {
    "commander": { /* ScryfallCard + role info */ },
    "nonland_cards": [ /* Array of DeckCard */ ],
    "lands": [ /* Array of DeckCard */ ],
    "total_price": 187.42,
    "role_breakdown": { /* Card counts by role */ },
    "warnings": [ /* Array of warning messages */ ],
    "generation_notes": [ /* Array of generation notes */ ]
  },
  "generated_at": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/commanders/search

Search for legal commanders.

**Query Parameters:**
- `q` (string): Search query (minimum 2 characters)

**Response:**
```json
{
  "success": true,
  "commanders": [ /* Array of ScryfallCard */ ],
  "total": 15,
  "has_more": false
}
```

### GET /api/prices

Fetch current prices for specific cards.

**Query Parameters:**
- `ids` (string): Comma-separated Scryfall card IDs
- `prefer_cheapest` (boolean): Use cheapest printing (optional)

## Project Structure

```
/src
  /app
    /api
      /generate/route.ts       # POST: commander + constraints → deck
      /prices/route.ts         # GET: card IDs → price data
      /commanders/search/route.ts  # GET: search commanders
    /page.tsx                  # Main application page
  /lib
    scryfall.ts               # Scryfall API client + rate limiting
    rules.ts                  # Commander legality + color identity
    generation.ts             # Deck generation algorithm
    pricing.ts                # Budget constraints + price logic
    power.ts                  # Power level system + role quotas
    export.ts                 # Export formats + deck site integration
    types.ts                  # TypeScript interfaces
  /components
    CommanderInput.tsx        # Autocomplete commander search
    BudgetPowerControls.tsx   # Power level + budget sliders
    DeckList.tsx             # Generated deck display
    RoleBreakdown.tsx        # Role distribution visualization
    PriceBar.tsx             # Budget analysis chart
    Warnings.tsx             # Error and warning display
    ExportOptions.tsx        # Export and sharing options
```

## Power Level System

The application uses a 1-10 power level system that affects:

| Level | Name | Tutors | Fast Mana | Combo Tolerance | Avg CMC | Interaction |
|-------|------|--------|-----------|----------------|---------|-------------|
| 1-2   | Casual | 0 | No | None | 4.5+ | 15-18% |
| 3-4   | Focused | 0-1 | No | Soft | 3.8-4.0 | 20-22% |
| 5-6   | Mid Power | 1-2 | Limited | Soft | 3.3-3.5 | 25-28% |
| 7-8   | High Power | 3-4 | Yes | Open | 2.8-3.0 | 30-35% |
| 9-10  | cEDH | 6-8 | Yes | Open | 2.0-2.5 | 40-45% |

## Data Sources & Rate Limits

### Scryfall API
- **Rate Limit**: 10 requests/second (100ms delay enforced)
- **Retry Policy**: Exponential backoff on 429 responses
- **Bulk Data**: Daily refresh for card database
- **Documentation**: [https://scryfall.com/docs/api](https://scryfall.com/docs/api)

### Commander Rules Committee
- **Ban List**: [https://mtgcommander.net/index.php/banned-list/](https://mtgcommander.net/index.php/banned-list/)
- **Rules**: [https://mtgcommander.net/index.php/rules/](https://mtgcommander.net/index.php/rules/)
- **Philosophy**: [https://mtgcommander.net/index.php/the-philosophy-of-commander/](https://mtgcommander.net/index.php/the-philosophy-of-commander/)

### Commander Spellbook (Optional)
- **API**: [https://backend.commanderspellbook.com/schema/swagger/](https://backend.commanderspellbook.com/schema/swagger/)
- **Usage**: Combo detection and filtering
- **Documentation**: [https://spacecowmedia.github.io/commander-spellbook-backend/](https://spacecowmedia.github.io/commander-spellbook-backend/)

## Algorithm Overview

### 1. Commander Validation
```typescript
// Validate commander legality
const validation = await scryfallClient.validateCommander(commanderName);
if (!validation.isValid) throw new Error(validation.error);
```

### 2. Power Level Configuration
```typescript
// Get role quotas based on power level
const powerConfig = getPowerLevelConfig(constraints.power_level);
const composition = adjustDeckCompositionForCommander(
  powerConfig.deck_composition,
  commander.cmc,
  commander.color_identity
);
```

### 3. Card Pool Generation
```typescript
// Generate candidate pools for each role
const cardPools = await Promise.all([
  generateLandPool(colorIdentity, composition.lands),
  generateRampPool(colorIdentity, constraints),
  generateRemovalPool(colorIdentity, constraints),
  generateSynergyPool(commander, constraints)
]);
```

### 4. Budget Optimization
```typescript
// Fit cards within budget constraints
const budgetResult = fitCardsIntoBudget(
  candidateCards,
  commander,
  roleTargets,
  constraints
);
```

## Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables
```bash
# Optional: For future API integrations
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## Testing

### Unit Tests (Vitest)
```bash
npm run test                 # Run all unit tests
npm run test -- --watch      # Watch mode
npm run test -- --coverage   # Coverage report
```

### E2E Tests (Playwright)
```bash
npm run test:e2e            # Run E2E tests
npm run test:e2e:ui         # Interactive UI mode
```

### Test Coverage
- ✅ Commander validation logic
- ✅ Color identity enforcement
- ✅ Budget constraint solving
- ✅ Power level role quotas
- ✅ Export format generation
- ✅ API endpoint responses
- ✅ Critical user flows (E2E)

## Contributing

1. **Code Style**: ESLint + Prettier with strict TypeScript
2. **Commits**: Conventional commit format
3. **Testing**: Unit tests required for logic, E2E for flows
4. **Security**: No API keys in code, validate all inputs

### Development Workflow
```bash
# Create feature branch
git checkout -b feature/card-synergy-improvements

# Make changes with tests
npm run test
npm run lint
npm run typecheck

# Commit and push
git commit -m "feat: improve tribal synergy detection"
git push origin feature/card-synergy-improvements
```

## Limitations & Future Enhancements

### Current Limitations
- No user accounts or deck saving
- Limited combo detection (basic keyword filtering)
- No real-time price updates (24h Scryfall staleness)
- English cards only

### Roadmap
- [ ] User authentication and deck library
- [ ] Enhanced combo detection via Commander Spellbook
- [ ] Real-time TCGplayer price integration
- [ ] Mobile app (React Native)
- [ ] "Upgrade path" suggestions
- [ ] Playgroup meta analysis
- [ ] Custom ban lists and house rules

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Disclaimer

This application is not affiliated with Wizards of the Coast. Magic: The Gathering is a trademark of Wizards of the Coast LLC. All card data is provided by [Scryfall](https://scryfall.com) under their data licensing terms.

---

**Built with ❤️ for the Commander community**
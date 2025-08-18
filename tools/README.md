# Commander Deck Generator - Administration Tools

This directory contains standalone administration tools for managing the Commander Deck Generator application.

## Tools Overview

### 1. 🌐 Browser-Based Card Database Explorer
**Location**: `http://localhost:3000/admin` (when dev server is running)

A web interface for browsing and exploring the card database with comprehensive tagging information.

**Features**:
- Real-time search with auto-filtering
- Detailed card information display
- Complete mechanics analysis with all tags
- Oracle text, metadata, and tagging evidence
- Sort tags by priority and category

**Usage**:
1. Start the development server: `npm run dev`
2. Open `http://localhost:3000/admin` in your browser
3. Type card names to search and click to view detailed analysis

### 2. 🏷️ Database Re-Tagging Tool
**File**: `retag-database.js`

Re-applies the comprehensive tagging system to all cards in the database. Useful when new mechanics are added to the tagging system.

**Usage**:
```bash
# Basic re-tagging
node retag-database.js

# Show detailed progress
node retag-database.js --verbose

# Test without making changes
node retag-database.js --dry-run

# Show help
node retag-database.js --help
```

**Requirements**: Development server must be running (`npm run dev`)

### 3. 🆕 New Card Fetcher Tool
**File**: `fetch-new-cards.js`

Checks Scryfall for new cards not in the local database and downloads their basic information (without tagging).

**Usage**:
```bash
# Fetch all new cards
node fetch-new-cards.js

# Fetch only from specific set
node fetch-new-cards.js --set=otj

# Show what would be fetched (dry run)
node fetch-new-cards.js --dry-run --verbose

# Limit number of cards (for testing)
node fetch-new-cards.js --limit=10

# Show help
node fetch-new-cards.js --help
```

**Requirements**: Internet connection (connects directly to Scryfall API)

## Workflow for New Set Releases

When a new Magic set is released:

1. **Fetch new cards**:
   ```bash
   node fetch-new-cards.js --set=NEW_SET_CODE --verbose
   ```

2. **Re-tag all cards** (to apply comprehensive tagging to new cards):
   ```bash
   node retag-database.js --verbose
   ```

3. **Restart development server** to use updated database:
   ```bash
   # Stop server (Ctrl+C), then restart
   npm run dev
   ```

4. **Verify results** using the browser tool at `http://localhost:3000/admin`

## Installation

1. Install dependencies for tools:
   ```bash
   cd tools
   npm install
   ```

2. Make scripts executable (optional, on Unix systems):
   ```bash
   chmod +x retag-database.js
   chmod +x fetch-new-cards.js
   ```

## Common Use Cases

### Adding New Mechanics
When new mechanics are added to the tagging system:
```bash
node retag-database.js --verbose
```

### Checking for New Cards Weekly
```bash
node fetch-new-cards.js --verbose
# If new cards found:
node retag-database.js
```

### Debugging Card Analysis
Use the browser tool at `http://localhost:3000/admin` to:
- Search for specific cards
- View all detected tags with evidence
- Check tag priorities and categories
- Verify comprehensive mechanic detection

### Testing Changes
```bash
# Test fetching without changes
node fetch-new-cards.js --dry-run --limit=5

# Test re-tagging without changes  
node retag-database.js --dry-run
```

## File Locations

- **Database files**: `../data/cards.json`, `../data/sync-status.json`
- **Web interface**: `../src/app/admin/page.tsx`
- **API endpoints**: `../src/app/api/cards/list/route.ts`, `../src/app/api/database/reanalyze/route.ts`

## Error Handling

All tools include comprehensive error handling and will display helpful error messages. Common issues:

- **Server not running**: Start with `npm run dev` (for retag tool)
- **Network issues**: Check internet connection (for fetch tool)
- **Permission errors**: Ensure write access to `data/` directory
- **Memory issues**: Use smaller batch sizes with `--batch-size=50`

## Support

For help with any tool, use the `--help` flag:
```bash
node retag-database.js --help
node fetch-new-cards.js --help
```
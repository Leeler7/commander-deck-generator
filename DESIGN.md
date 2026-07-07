# Design System — Big Deck Energy ("Mana Modes")

## Product Context
- **What this is:** A free online MTG Commander (EDH) deck generator that builds casual, fun, intentionally janky decks instantly. The 🎲 BIG DECK ENERGY button (random commander + random settings) is the signature feature.
- **Who it's for:** Casual Commander players and the MTGTok crowd. The brand voice is irreverent and fun, but the interface plays it straight — the humor lives in the product copy and the decks themselves, never in interface gimmicks.
- **Space/industry:** MTG deck tools (Moxfield, Archidekt, EDHREC). They all ship neutral database chrome and borrow color from card art. BDE differentiates by making the UI itself carry Magic's color identity.
- **Project type:** Web app (Next.js 15, Tailwind CSS v4, single-page generator + results).

## Aesthetic Direction
- **Direction:** "Mana Modes" — the theme system IS the design. Six complete themes keyed to Magic's color pie, chosen from a bar of real mana pips. The visual language borrows the anatomy of the card itself: framed surfaces, flavor-text taglines, mana pips as data.
- **Decoration level:** Intentional — card-frame surface treatment (soft outer frame halo on cards), real mana symbols, flavor-text styling. No gradients-as-decoration, no stamps, no jokes in the chrome.
- **Mood:** Confident, warm, unmistakably Magic. A first-time visitor should think "this was made by someone who plays."
- **The memorable thing:** you pick your color the way you pick your deck. Nobody else in the category has this.

## Mana Modes (the six themes)
One structure, six CSS-variable skins on `html[data-theme]`. White is the light mode, Black is the dark mode; the rest are full first-class themes. Choice persists in `localStorage` (`bde-theme`); legacy values migrate (`light`→`white`, `dark`→`black`).

| Mode | Land | data-theme | --bg | --surface | --frame | --text | --muted | --accent | --accent-deep | --on-accent |
|------|------|-----------|------|-----------|---------|--------|---------|----------|---------------|-------------|
| White | Plains (light) | `white` | #F5F1E3 | #FDFBF2 | #EAE2C8 | #2A2620 | #7A7260 | #C9A227 | #8A6D14 | #2A2620 |
| Blue | Island | `blue` | #0B1D2E | #132A40 | #1B3A57 | #D8E8F4 | #7FA3BD | #3E9DD8 | #7FC4EE | #06121D |
| Black | Swamp (dark) | `black` | #121014 | #1C1820 | #2A2430 | #E2DCD4 | #8E8494 | #A08FB8 | #C4B2DC | #14101A |
| Red | Mountain | `red` | #1E0F0C | #2C1713 | #40201A | #F2E2D8 | #B08D80 | #E04A38 | #F9AA8F | #1E0A07 |
| Green | Forest | `green` | #0D1A12 | #14261A | #1D3626 | #DCEADD | #86A78E | #3FA867 | #9BD3AE | #06130B |
| Colorless | Wastes | `colorless` | #1A1B1D | #242628 | #313436 | #DEE0E2 | #909498 | #A8ADB4 | #CCD1D6 | #17181A |

Each theme also defines semantic text tokens: `--success`, `--error`, `--warn`, `--info` (dark-legible tints on dark modes, deep tones on White).

**WUBRG data colors are constant across all themes** (they are data, not theme): W #F8F6D8 · U #0E68AB · B #2B253A · R #D3202A · G #00733E · C #B3AFA6. They appear only in mana symbols, color-identity indicators, and semantic accents — never as page/section backgrounds.

## Mana Symbols
- **Real symbols via [mana-font](https://mana.andrewgioia.com/)** (`mana-font` npm package; font SIL OFL 1.1, CSS MIT, symbol art © Wizards of the Coast under the Fan Content Policy — the site is free and carries the required non-affiliation disclaimer in the footer).
- Usage: `<i className="ms ms-cost ms-w" />` etc. Scryfall brace syntax maps by lowercasing and dropping `/`: `{W/U}`→`ms-wu`, `{2/W}`→`ms-2w`, `{W/P}`→`ms-wp`, `{X}`→`ms-x`, `{C}`→`ms-c`, `{T}`→`ms-tap`.
- The theme switcher is a pip bar of the six mode symbols (W U B R G C) rendered with mana-font, in the header on every page.
- Never hand-draw mana symbols (colored circles with letters) — that's what this replaces.

## Typography
- **Brand/Headers/Buttons:** Marcellus (Google Fonts, 400) — carved, incised, the closest legally-clean face to Magic's Beleren. Replaces Impact everywhere. Do NOT use actual Beleren: it has no public license; circulating files are unauthorized.
- **Flavor text/Taglines:** Crimson Pro italic — reads as MTG card flavor text (MPlantin-adjacent). Taglines are set in quotes, italic, muted.
- **Body/UI:** Instrument Sans — replaces Arial. All controls, labels, paragraphs.
- **Data/Deck lists/Prices:** IBM Plex Mono (tabular) — card names with dot-leader prices, counts, stats.
- **Loading:** all via `next/font/google` in `src/app/layout.tsx` (variables `--font-brand`, `--font-flavor`, `--font-sans`, `--font-mono`). mana-font CSS imported in layout.
- **Scale:** brand h1 clamp(2.6rem–5.2rem); section headers 28–34px Marcellus; body 16px; data 13–14px mono.

## Color
- **Approach:** Balanced-restrained per theme: one accent + neutrals from the theme; WUBRG constants for data; semantic tokens for status.
- **Semantic:** success = Forest green family, error = Mountain red family, warn = gold, info = Island blue — mana-true in every mode.
- **Implementation note:** the app's markup uses stock Tailwind utilities (`bg-white`, `text-gray-900`, `bg-blue-600`…). Theming is applied by a remap layer in `globals.css` that maps those utilities to theme variables under `[data-theme]` (this replaced the old `.dark { !important }` hack). Long-term, prefer semantic classes/tokens in new markup; the remap keeps legacy markup themed.

## Spacing
- **Base unit:** 4px. **Density:** comfortable. Existing Tailwind spacing conventions stand.

## Layout
- **Approach:** grid-disciplined app layout (dense controls need discipline). Max content width 7xl (existing).
- **Card-frame surface:** white/surface cards get a soft outer frame halo (`box-shadow: 0 0 0 4px var(--frame)`) + 1px edge — the card-frame feel without markup changes.
- **Border radius:** md 8px (inputs, buttons), lg 12–14px (cards).

## Motion
- **Approach:** minimal-functional + one signature: buttons translate down 2px on `:active` (press feel); theme change cross-fades at ~300ms. Nothing else animates decoratively.

## Voice (interface copy)
Straight and factual. The humor belongs to product copy (tagline, deck names) — the chrome never does bits. No insults, no fake stamps, no fourth-wall jokes in UI states.

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-07 | Initial system created | /design-consultation: research (Archidekt, EDHREC, Moxfield) + outside design voice + 3 user iterations |
| 2026-07-07 | Rejected: zine/scratch-off direction | User: too campy and adversarial |
| 2026-07-07 | Rejected: editorial paper direction | User: too editorial, not leaning into Magic |
| 2026-07-07 | Adopted: six mana-mode themes (user's idea) + card-frame language | Leans fully into Magic; theming = the brand |
| 2026-07-07 | Real mana symbols via mana-font; lookalike fonts (Marcellus/Crimson Pro) | Symbols are Fan-Content-Policy-safe and industry standard; Beleren/MPlantin are not licensable for web use |

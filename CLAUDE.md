# Big Deck Energy — project instructions

## Design System
Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

Key rules that come up constantly:
- Theming is six mana modes on `html[data-theme]` (white/blue/black/red/green/colorless) — never reintroduce a binary light/dark toggle or the old `.dark` class remap.
- Mana symbols are always real symbols via `mana-font` (`ms ms-cost ms-*`) — never hand-drawn colored circles.
- Headers/buttons use Marcellus (never Impact/Arial Black); flavor text uses Crimson Pro italic; body is Instrument Sans; deck data is IBM Plex Mono.
- Interface copy plays it straight — no jokes in UI chrome, empty states, or errors.

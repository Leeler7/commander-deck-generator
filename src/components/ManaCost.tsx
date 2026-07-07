'use client';

import React from 'react';

interface ManaCostProps {
  manaCost?: string;
  className?: string;
}

/**
 * Renders a Scryfall mana cost string (e.g. "{2}{W/U}{G}") as real MTG mana
 * symbols via mana-font (https://mana.andrewgioia.com/).
 *
 * Scryfall brace syntax maps to mana-font classes by lowercasing and
 * dropping the slash: {W}→ms-w, {10}→ms-10, {W/U}→ms-wu, {2/W}→ms-2w,
 * {W/P}→ms-wp, {X}→ms-x, {C}→ms-c, {S}→ms-s, {T}→ms-tap.
 */
export default function ManaCost({ manaCost, className = '' }: ManaCostProps) {
  if (!manaCost) return null;

  const symbols = parseManaCost(manaCost);
  if (symbols.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {symbols.map((symbol, index) => (
        <ManaSymbol key={`${symbol}-${index}`} symbol={symbol} />
      ))}
    </span>
  );
}

function parseManaCost(manaCost: string): string[] {
  const symbols: string[] = [];
  const regex = /\{([^}]+)\}/g;
  let match;

  while ((match = regex.exec(manaCost)) !== null) {
    symbols.push(match[1]);
  }

  return symbols;
}

const KNOWN_SYMBOLS = new Set([
  'w', 'u', 'b', 'r', 'g', 'c', 'x', 'y', 'z', 's', 'e', 'tap', 'untap',
  ...Array.from({ length: 21 }, (_, i) => String(i)),
  // Hybrid
  'wu', 'wb', 'ub', 'ur', 'br', 'bg', 'rg', 'rw', 'gw', 'gu',
  // Two-brid
  '2w', '2u', '2b', '2r', '2g',
  // Phyrexian (incl. hybrid phyrexian)
  'p', 'wp', 'up', 'bp', 'rp', 'gp',
  'wup', 'wbp', 'ubp', 'urp', 'brp', 'bgp', 'rgp', 'rwp', 'gwp', 'gup',
]);

function scryfallToManaFont(content: string): string | null {
  let cls = content.toLowerCase().replace(/\//g, '');
  if (cls === 't') cls = 'tap';
  if (cls === 'q') cls = 'untap';
  return KNOWN_SYMBOLS.has(cls) ? cls : null;
}

function ManaSymbol({ symbol }: { symbol: string }) {
  const cls = scryfallToManaFont(symbol);

  if (!cls) {
    // Unknown symbol — render the raw text rather than a wrong icon.
    return <span className="text-xs font-medium text-gray-600">{`{${symbol}}`}</span>;
  }

  return (
    <i
      className={`ms ms-cost ms-shadow ms-${cls}`}
      title={`{${symbol.toUpperCase()}}`}
      aria-label={`{${symbol.toUpperCase()}}`}
    />
  );
}

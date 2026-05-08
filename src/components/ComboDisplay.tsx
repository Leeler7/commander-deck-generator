'use client';

import { ComboResult } from '@/lib/types';
import { useState } from 'react';

interface ComboDisplayProps {
  combos: ComboResult[];
  /** Target bracket chosen by the user (1-5). Used to warn when an infinite combo is present. */
  targetBracket?: number;
}

function ScryfallLink({ name }: { name: string }) {
  const url = `https://scryfall.com/search?q=%21%22${encodeURIComponent(name)}%22`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-blue-700 hover:text-blue-900 underline underline-offset-2"
    >
      {name}
    </a>
  );
}

function isInfiniteCombo(combo: ComboResult): boolean {
  return combo.results.some(r =>
    r.toLowerCase().includes('infinite') || r.toLowerCase().includes('unlimited'),
  );
}

function getSpellbookUrl(combo: ComboResult): string | null {
  if (combo.comboId) {
    return `https://commanderspellbook.com/combo/${combo.comboId}`;
  }
  // Fallback: search by card names
  const query = combo.cards.map(c => `card="${c}"`).join(' ');
  return `https://commanderspellbook.com/search/?q=${encodeURIComponent(query)}`;
}

function ComboCard({
  combo,
  targetBracket,
}: {
  combo: ComboResult;
  targetBracket?: number;
}) {
  const infinite = isInfiniteCombo(combo);
  const showBracketWarning = infinite && targetBracket !== undefined && targetBracket <= 2;
  const spellbookUrl = getSpellbookUrl(combo);

  return (
    <div
      className={`border rounded-lg p-4 ${
        infinite ? 'border-orange-300 bg-orange-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      {/* Header: card names + result + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                infinite
                  ? 'text-orange-700 bg-orange-100 border-orange-300'
                  : 'text-green-700 bg-green-100 border-green-300'
              }`}
            >
              {infinite ? '\u221E Infinite' : '\u2713 Finite'}
            </span>
            <span className="text-xs text-gray-500">
              {combo.cards.length}-card combo
            </span>
          </div>

          {/* Card names */}
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {combo.cards.map((name, i) => (
              <span key={name} className="flex items-center gap-1">
                <ScryfallLink name={name} />
                {i < combo.cards.length - 1 && <span className="text-gray-400">+</span>}
              </span>
            ))}
          </div>

          {/* Result */}
          {combo.results.length > 0 && (
            <p className="text-xs text-amber-800 mt-1">
              &rarr; {combo.results.join('; ')}
            </p>
          )}

          {/* Bracket warning */}
          {showBracketWarning && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-orange-800 bg-orange-100 border border-orange-300 rounded px-2 py-1.5">
              <span className="shrink-0">Warning:</span>
              <span>
                This infinite combo may push your deck above your target bracket (
                {targetBracket === 1 ? 'Exhibition' : 'Core'}). Consider removing it to stay on-bracket.
              </span>
            </div>
          )}
        </div>

        {/* Link to Commander Spellbook */}
        {spellbookUrl && (
          <a
            href={spellbookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-amber-700 hover:text-amber-900 whitespace-nowrap border border-amber-300 rounded px-2 py-0.5 shrink-0 hover:bg-amber-100 transition-colors"
          >
            View on Spellbook &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

export default function ComboDisplay({ combos, targetBracket }: ComboDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (combos.length === 0) return null;

  const infiniteCount = combos.filter(isInfiniteCombo).length;
  const finiteCount = combos.length - infiniteCount;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <h3
            className="text-2xl text-black"
            style={{ fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase' }}
          >
            Detected Combos
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
              {combos.length} combo{combos.length !== 1 ? 's' : ''}
            </span>
            {infiniteCount > 0 && (
              <span className="text-sm font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
                {infiniteCount} {'\u221E'} infinite
              </span>
            )}
            {finiteCount > 0 && (
              <span className="text-sm font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
                {finiteCount} {'\u2713'} finite
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-6 h-6 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6">
          <div className="max-h-64 overflow-y-auto space-y-3">
            {combos.map((combo, i) => (
              <ComboCard key={i} combo={combo} targetBracket={targetBracket} />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3 italic">
            Combo data from Commander Spellbook. Click card names for Scryfall, or &ldquo;View on Spellbook&rdquo; for full prerequisites, steps, and results.
          </p>
        </div>
      )}
    </div>
  );
}

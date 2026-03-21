'use client';

import { ComboResult } from '@/lib/types';
import { useState } from 'react';

interface ComboDisplayProps {
  combos: ComboResult[];
  /** Target bracket chosen by the user (1–5). Used to warn when an infinite combo is present. */
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

function ComboCard({
  combo,
  index,
  targetBracket,
}: {
  combo: ComboResult;
  index: number;
  targetBracket?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const infinite = isInfiniteCombo(combo);
  const showBracketWarning = infinite && targetBracket !== undefined && targetBracket <= 2;

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
              {infinite ? '∞ Infinite' : '✓ Finite'}
            </span>
            <span className="text-xs text-gray-500">
              {combo.cards.length}-card combo
            </span>
          </div>

          {/* Card names */}
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <span className="text-amber-600 font-bold text-base">⚡</span>
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
              → {combo.results.join('; ')}
            </p>
          )}

          {/* Bracket warning */}
          {showBracketWarning && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-orange-800 bg-orange-100 border border-orange-300 rounded px-2 py-1.5">
              <span className="shrink-0">⚠️</span>
              <span>
                This infinite combo may push your deck above your target bracket (
                {targetBracket === 1 ? 'Exhibition' : 'Core'}). Consider removing it to stay on-bracket.
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap border border-gray-300 rounded px-2 py-0.5 shrink-0"
        >
          {expanded ? 'Hide steps' : 'Show steps'}
        </button>
      </div>

      {/* Expanded: prerequisites + steps */}
      {expanded && (
        <div className="mt-3 space-y-2 text-xs text-gray-700 border-t border-amber-200 pt-3">
          {combo.prerequisites.length > 0 && (
            <div>
              <p className="font-semibold text-gray-600 mb-1">Prerequisites</p>
              <ul className="list-disc list-inside space-y-0.5">
                {combo.prerequisites.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}
          {combo.steps.length > 0 && (
            <div>
              <p className="font-semibold text-gray-600 mb-1">Steps</p>
              <ol className="list-decimal list-inside space-y-0.5">
                {combo.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ComboDisplay({ combos, targetBracket }: ComboDisplayProps) {
  if (combos.length === 0) return null;

  const infiniteCount = combos.filter(isInfiniteCombo).length;
  const finiteCount = combos.length - infiniteCount;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h3
          className="text-2xl text-black"
          style={{ fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase' }}
        >
          ⚡ Detected Combos
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
            {combos.length} combo{combos.length !== 1 ? 's' : ''}
          </span>
          {infiniteCount > 0 && (
            <span className="text-sm font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full border border-orange-200">
              {infiniteCount} ∞ infinite
            </span>
          )}
          {finiteCount > 0 && (
            <span className="text-sm font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-200">
              {finiteCount} ✓ finite
            </span>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {combos.map((combo, i) => (
          <ComboCard key={i} combo={combo} index={i} targetBracket={targetBracket} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3 italic">
        Combo data from Commander Spellbook. Click any card name to view on Scryfall.
      </p>
    </div>
  );
}

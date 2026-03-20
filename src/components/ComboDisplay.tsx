'use client';

import { ComboResult } from '@/lib/types';
import { useState } from 'react';

interface ComboDisplayProps {
  combos: ComboResult[];
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

function ComboCard({ combo, index }: { combo: ComboResult; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-amber-200 rounded-lg bg-amber-50 p-4">
      {/* Header: card names + result */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <span className="text-amber-600 font-bold text-base">⚡</span>
            {combo.cards.map((name, i) => (
              <span key={name} className="flex items-center gap-1">
                <ScryfallLink name={name} />
                {i < combo.cards.length - 1 && <span className="text-gray-400">+</span>}
              </span>
            ))}
          </div>
          {combo.results.length > 0 && (
            <p className="text-xs text-amber-800 mt-1">
              → {combo.results.join('; ')}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 whitespace-nowrap border border-gray-300 rounded px-2 py-0.5"
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

export default function ComboDisplay({ combos }: ComboDisplayProps) {
  if (combos.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3
          className="text-2xl text-black"
          style={{ fontFamily: 'Impact, "Arial Black", sans-serif', textTransform: 'uppercase' }}
        >
          ⚡ Detected Combos
        </h3>
        <span className="text-sm font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
          {combos.length} combo{combos.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="space-y-3">
        {combos.map((combo, i) => (
          <ComboCard key={i} combo={combo} index={i} />
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-3 italic">
        Combo data from Commander Spellbook. Click any card name to view on Scryfall.
      </p>
    </div>
  );
}

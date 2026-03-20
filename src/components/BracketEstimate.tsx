'use client';

import { BracketEstimate as BracketEstimateType } from '@/lib/types';

const BRACKET_CONFIG = [
  { n: 1, name: 'Exhibition', color: 'bg-green-100 text-green-800 border-green-300' },
  { n: 2, name: 'Core',       color: 'bg-green-200 text-green-900 border-green-400' },
  { n: 3, name: 'Upgraded',   color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { n: 4, name: 'Optimized',  color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { n: 5, name: 'cEDH',       color: 'bg-red-100 text-red-800 border-red-300' },
];

interface Props { bracketEstimate: BracketEstimateType; }

export default function BracketEstimate({ bracketEstimate }: Props) {
  const { bracket, gameChangersFound = [], reasons = [], combos = [] } = bracketEstimate;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Power Bracket</h3>

      {/* Bracket pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        {BRACKET_CONFIG.map(b => (
          <span
            key={b.n}
            className={`px-3 py-1 rounded-full border text-sm font-medium transition-all ${
              b.n === bracket
                ? b.color + ' ring-2 ring-offset-1 ring-current'
                : 'bg-gray-50 text-gray-400 border-gray-200'
            }`}
          >
            {b.n} — {b.name}
          </span>
        ))}
      </div>

      {/* Reasons */}
      {reasons.length > 0 && (
        <ul className="text-sm text-gray-600 space-y-1 mb-3">
          {reasons.map((r, i) => <li key={i}>• {r}</li>)}
        </ul>
      )}

      {/* Combos summary when no reasons */}
      {reasons.length === 0 && combos.length > 0 && (
        <p className="text-sm text-gray-600 mb-3">
          {combos.length} infinite combo{combos.length !== 1 ? 's' : ''} detected
        </p>
      )}

      {/* Game Changers found */}
      {gameChangersFound.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Game Changers in this deck:</p>
          <div className="flex flex-wrap gap-1">
            {gameChangersFound.map(gc => (
              <a
                key={gc}
                href={`https://scryfall.com/search?q=${encodeURIComponent(gc)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded hover:bg-orange-100"
              >
                {gc}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

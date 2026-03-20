'use client';

import { BracketEstimate as BracketEstimateType } from '@/lib/types';

interface BracketEstimateProps {
  bracketEstimate: BracketEstimateType;
}

const BRACKET_CONFIG = [
  {
    label: 'Bracket 1',
    sublabel: 'Exhibition / Precon',
    description: 'Casual preconstructed-level decks. No tutors, low synergy, weak combos.',
    color: 'bg-green-500',
    textColor: 'text-green-700',
    borderColor: 'border-green-400',
    bgLight: 'bg-green-50',
  },
  {
    label: 'Bracket 2',
    sublabel: 'Core',
    description: 'Upgraded precons and focused casual decks. Some synergy, limited fast mana.',
    color: 'bg-yellow-400',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-400',
    bgLight: 'bg-yellow-50',
  },
  {
    label: 'Bracket 3',
    sublabel: 'Upgraded',
    description: 'Optimized synergy decks with tutors and good mana. Can win consistently.',
    color: 'bg-orange-500',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-400',
    bgLight: 'bg-orange-50',
  },
  {
    label: 'Bracket 4',
    sublabel: 'cEDH',
    description: 'Highly optimized combo decks. Fast mana, infinite combos, multiple win lines.',
    color: 'bg-red-500',
    textColor: 'text-red-700',
    borderColor: 'border-red-400',
    bgLight: 'bg-red-50',
  },
];

export default function BracketEstimate({ bracketEstimate }: BracketEstimateProps) {
  const { bracket, combos } = bracketEstimate;
  const bracketIdx = Math.min(Math.max(bracket - 1, 0), 3);
  const config = BRACKET_CONFIG[bracketIdx];

  return (
    <div className={`rounded-lg border-2 ${config.borderColor} ${config.bgLight} p-4`}>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Power Bracket Estimate</h3>

      {/* Visual 1-4 scale */}
      <div className="flex gap-1 mb-3">
        {BRACKET_CONFIG.map((b, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`h-6 w-full rounded transition-all ${
                i + 1 === bracket ? b.color + ' shadow-md' : 'bg-gray-200'
              }`}
              title={b.description}
            />
            <span className={`text-xs font-medium ${i + 1 === bracket ? b.textColor : 'text-gray-400'}`}>
              {i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* Active bracket label */}
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-lg font-bold ${config.textColor}`}>{config.label}</span>
        <span className="text-sm text-gray-500">— {config.sublabel}</span>
      </div>
      <p className="text-xs text-gray-600 mb-2">{config.description}</p>

      {/* Combos found */}
      {combos.length > 0 && (
        <div className="mt-3 border-t border-gray-200 pt-2">
          <p className="text-xs font-semibold text-gray-600 mb-1">
            {combos.length} combo{combos.length !== 1 ? 's' : ''} detected
          </p>
          {combos.slice(0, 2).map((combo, i) => (
            <div key={i} className="text-xs text-gray-500 mb-1">
              <span className="font-medium">{combo.cards.join(' + ')}</span>
              {combo.results.length > 0 && (
                <span className="ml-1">→ {combo.results[0]}</span>
              )}
            </div>
          ))}
          {combos.length > 2 && (
            <p className="text-xs text-gray-400">+{combos.length - 2} more…</p>
          )}
        </div>
      )}
    </div>
  );
}

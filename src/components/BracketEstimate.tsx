'use client';

import { BracketEstimate as BracketEstimateType } from '@/lib/types';

const BRACKET_CONFIG = [
  { n: 1, name: 'Exhibition', color: 'bg-green-100 text-green-800 border-green-300' },
  { n: 2, name: 'Core',       color: 'bg-green-200 text-green-900 border-green-400' },
  { n: 3, name: 'Upgraded',   color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { n: 4, name: 'Optimized',  color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { n: 5, name: 'cEDH',       color: 'bg-red-100 text-red-800 border-red-300' },
];

interface Props {
  bracketEstimate: BracketEstimateType;
  targetBracket?: number;
}

export default function BracketEstimate({ bracketEstimate, targetBracket }: Props) {
  const { bracket, gameChangersFound = [], reasons = [], combos = [], diagnostics, bracketRestrictions = [] } = bracketEstimate;

  // Target vs generated comparison
  const hasTarget = targetBracket !== undefined && targetBracket !== null;
  const matchesTarget = hasTarget && bracket === targetBracket;
  const belowTarget = hasTarget && bracket < targetBracket!;
  const aboveTarget = hasTarget && bracket > targetBracket!;

  // Build detailed mismatch info for below-target using measured medians
  const buildMismatchDetails = (): string[] => {
    if (!belowTarget || !diagnostics) return [];
    const details: string[] = [];
    const target = targetBracket!;
    const rockCount = diagnostics.fastManaRockCount ?? diagnostics.fastManaCount;
    const freeCount = diagnostics.freeInteractionCount ?? 0;

    if (target >= 4) {
      // Measured B4/B5 medians: ~14 GC, ~12 fast rocks, ~4 free interaction
      if (diagnostics.gameChangerCount < 4) {
        details.push(`Game Changers: have ${diagnostics.gameChangerCount}, need 4+`);
      }
      if (rockCount < 8) {
        details.push(`Fast mana rocks: have ${rockCount}, need 8+`);
      }
      if (freeCount < 2) {
        details.push(`Free interaction: have ${freeCount}, need 2+`);
      }
    }

    if (target >= 5) {
      if (diagnostics.gameChangerCount < 10) {
        details.push(`Game Changers: have ${diagnostics.gameChangerCount}, need 10+`);
      }
      if (diagnostics.averageCMC >= 2.5) {
        details.push(`Avg CMC: ${diagnostics.averageCMC.toFixed(2)}, need < 2.5`);
      }
      if (rockCount < 12) {
        details.push(`Fast mana rocks: have ${rockCount}, need 12+`);
      }
      if (diagnostics.infiniteComboCount < 2) {
        details.push(`Combo lines: have ${diagnostics.infiniteComboCount}, need 2+`);
      }
      if (freeCount < 4) {
        details.push(`Free interaction: have ${freeCount}, need 4+`);
      }
    }

    return details;
  };

  const mismatchDetails = buildMismatchDetails();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Power Bracket</h3>

      {/* Bracket pills */}
      <div className="flex gap-2 flex-wrap mb-4">
        {BRACKET_CONFIG.map(b => {
          const isGenerated = b.n === bracket;
          const isTarget = hasTarget && b.n === targetBracket;
          return (
            <span
              key={b.n}
              className={`px-3 py-1 rounded-full border text-sm font-medium transition-all relative ${
                isGenerated
                  ? b.color + ' ring-2 ring-offset-1 ring-current'
                  : isTarget
                    ? 'bg-gray-100 text-gray-600 border-gray-400 ring-2 ring-offset-1 ring-blue-400 ring-dashed'
                    : 'bg-gray-50 text-gray-400 border-gray-200'
              }`}
            >
              {b.n} — {b.name}
              {isTarget && !isGenerated && (
                <span className="absolute -top-1.5 -right-1.5 text-[10px] bg-blue-500 text-white rounded-full w-4 h-4 flex items-center justify-center">T</span>
              )}
            </span>
          );
        })}
      </div>

      {/* Target vs generated comparison */}
      {hasTarget && (
        <div className={`text-sm px-3 py-2 rounded-md mb-3 ${
          matchesTarget
            ? 'bg-green-50 text-green-700 border border-green-200'
            : belowTarget
              ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
              : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {matchesTarget && (
            <span>&#10003; Deck matches target Bracket {targetBracket}</span>
          )}
          {belowTarget && (
            <div>
              <span>&#9888; Target: Bracket {targetBracket} | Generated: Bracket {bracket}</span>
              {mismatchDetails.length > 0 && (
                <div className="mt-1 text-xs">
                  <span className="font-medium">Missing:</span>{' '}
                  {mismatchDetails.join(' | ')}
                </div>
              )}
              {bracketRestrictions.length > 0 && (
                <div className="mt-2 text-xs">
                  <span className="font-medium">Why it fell short:</span>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    {bracketRestrictions.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {mismatchDetails.length === 0 && bracketRestrictions.length === 0 && (
                <span className="block mt-1 text-xs">Budget or card pool may be limiting higher-power options</span>
              )}
            </div>
          )}
          {aboveTarget && (
            <span>&#9888; Deck exceeds target Bracket {targetBracket} (estimated: {bracket})</span>
          )}
        </div>
      )}

      {/* Diagnostics summary */}
      {diagnostics && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-3">
          <div className="text-center px-2 py-1 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-500">Avg CMC</div>
            <div className="text-gray-900 font-semibold">{diagnostics.averageCMC.toFixed(2)}</div>
          </div>
          <div className="text-center px-2 py-1 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-500">Mana Rocks</div>
            <div className="text-gray-900 font-semibold">{diagnostics.fastManaRockCount ?? diagnostics.fastManaCount}</div>
          </div>
          <div className="text-center px-2 py-1 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-500">Free Intxn</div>
            <div className="text-gray-900 font-semibold">{diagnostics.freeInteractionCount ?? 0}</div>
          </div>
          <div className="text-center px-2 py-1 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-500">Game Ch.</div>
            <div className="text-gray-900 font-semibold">{diagnostics.gameChangerCount}</div>
          </div>
          <div className="text-center px-2 py-1 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-500">Combos</div>
            <div className="text-gray-900 font-semibold">{diagnostics.compactWinLines ?? diagnostics.infiniteComboCount}</div>
          </div>
          <div className="text-center px-2 py-1 bg-gray-50 rounded text-xs">
            <div className="font-medium text-gray-500">Tutors</div>
            <div className="text-gray-900 font-semibold">{diagnostics.tutorCount}</div>
          </div>
        </div>
      )}

      {/* Reasons */}
      {reasons.length > 0 && (
        <ul className="text-sm text-gray-600 space-y-1 mb-3">
          {reasons.map((r, i) => <li key={i}>&bull; {r}</li>)}
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

'use client';

import { GenerationConstraints, CardTypeWeights } from '@/lib/types';
import { useState } from 'react';
import CardTypeWeightsComponent from './CardTypeWeights';
import CardAutocomplete from './CardAutocomplete';

interface BudgetPowerControlsProps {
  constraints: GenerationConstraints;
  onChange: (constraints: GenerationConstraints) => void;
  commanderColorIdentity?: string[];
}

const defaultCardTypeWeights: CardTypeWeights = {
  creatures: 8,
  artifacts: 2,
  enchantments: 2,
  instants: 3,
  sorceries: 3,
  planeswalkers: 2
};

// Best-practice defaults per bracket, derived from engine-config.json generation_targets
// and cross-bracket analysis. Applied when the user switches brackets.
const BRACKET_DEFAULTS: Record<number, Partial<GenerationConstraints>> = {
  1: {
    landCount: 38,
    nonBasicLandCount: 11,
    total_budget: 100,
    max_card_price: 10,
    gameChangerLimit: 'none' as const,
    pacing: 'late-game' as const,
    no_infinite_combos: true,
    no_land_destruction: true,
    no_extra_turns: true,
    no_fast_mana: true,
  },
  2: {
    landCount: 37,
    nonBasicLandCount: 11,
    total_budget: 200,
    max_card_price: 25,
    gameChangerLimit: 'none' as const,
    pacing: 'balanced' as const,
    no_infinite_combos: true,
    no_land_destruction: true,
    no_extra_turns: false,
    no_fast_mana: false,
  },
  3: {
    landCount: 35,
    nonBasicLandCount: 11,
    total_budget: 500,
    max_card_price: 50,
    comboCount: 1,
    gameChangerLimit: 3,
    pacing: 'balanced' as const,
    no_infinite_combos: false,
    no_land_destruction: true,
    no_extra_turns: false,
    no_fast_mana: false,
  },
  4: {
    landCount: 32,
    nonBasicLandCount: 24,
    total_budget: 1000,
    max_card_price: 125,
    comboCount: 2,
    gameChangerLimit: 'unlimited' as const,
    pacing: 'fast-tempo' as const,
    no_infinite_combos: false,
    no_land_destruction: false,
    no_extra_turns: false,
    no_fast_mana: false,
  },
  5: {
    landCount: 28,
    nonBasicLandCount: 24,
    total_budget: 2500,
    max_card_price: 300,
    comboCount: 3,
    gameChangerLimit: 'unlimited' as const,
    pacing: 'aggressive-early' as const,
    random_tag_count: 0,
    no_infinite_combos: false,
    no_land_destruction: false,
    no_extra_turns: false,
    no_fast_mana: false,
  },
};

export default function BudgetPowerControls({ constraints, onChange, commanderColorIdentity }: BudgetPowerControlsProps) {
  const [keywordInput, setKeywordInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateConstraint = <K extends keyof GenerationConstraints>(
    key: K,
    value: GenerationConstraints[K]
  ) => {
    onChange({ ...constraints, [key]: value });
  };

  const handleCardTypeWeightsChange = (weights: CardTypeWeights) => {
    updateConstraint('card_type_weights', weights);
  };

  const addKeyword = (keyword: string) => {
    const trimmed = keyword.trim().toLowerCase();
    if (!trimmed) return;
    const current = constraints.keyword_focus || [];
    if (!current.includes(trimmed)) {
      updateConstraint('keyword_focus', [...current, trimmed]);
    }
    setKeywordInput('');
  };

  const removeKeyword = (index: number) => {
    const current = constraints.keyword_focus || [];
    const next = current.filter((_, i) => i !== index);
    updateConstraint('keyword_focus', next.length > 0 ? next : undefined);
  };

  const addMustInclude = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = constraints.mustIncludeCards || [];
    if (!current.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      updateConstraint('mustIncludeCards', [...current, trimmed]);
    }
  };

  const removeMustInclude = (index: number) => {
    const current = constraints.mustIncludeCards || [];
    updateConstraint('mustIncludeCards', current.filter((_, i) => i !== index));
  };

  const addExclude = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = constraints.excludedCards || [];
    if (!current.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      updateConstraint('excludedCards', [...current, trimmed]);
    }
  };

  const removeExclude = (index: number) => {
    const current = constraints.excludedCards || [];
    updateConstraint('excludedCards', current.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">

      {/* ── Build Mode Toggle ─────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Build Mode</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateConstraint('hyperFocus', false)}
            className={`px-4 py-3 rounded-lg border text-sm transition-colors ${
              !constraints.hyperFocus
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
            }`}
          >
            <span className="font-medium block">Classic</span>
            <span className="text-xs opacity-70">Balanced card selection across themes</span>
          </button>
          <button
            type="button"
            onClick={() => updateConstraint('hyperFocus', true)}
            className={`px-4 py-3 rounded-lg border text-sm transition-colors ${
              constraints.hyperFocus
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
            }`}
          >
            <span className="font-medium block">Hyper Focus</span>
            <span className="text-xs opacity-70">Maximize theme synergy, cut generic cards</span>
          </button>
        </div>
      </div>

      {/* ── Speed / Tempo ─────────────────────────────────────────────── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Speed — {
            constraints.pacing === 'aggressive-early' ? 'Aggressive (fast wins)' :
            constraints.pacing === 'fast-tempo' ? 'Fast Tempo' :
            constraints.pacing === 'midrange' ? 'Midrange' :
            constraints.pacing === 'late-game' ? 'Late Game (big spells)' :
            'Balanced'
          }
        </label>
        <input
          type="range"
          min="0"
          max="4"
          step="1"
          value={
            constraints.pacing === 'aggressive-early' ? 0 :
            constraints.pacing === 'fast-tempo' ? 1 :
            constraints.pacing === 'midrange' ? 3 :
            constraints.pacing === 'late-game' ? 4 : 2
          }
          onChange={(e) => {
            const pacings: GenerationConstraints['pacing'][] = [
              'aggressive-early', 'fast-tempo', 'balanced', 'midrange', 'late-game'
            ];
            updateConstraint('pacing', pacings[parseInt(e.target.value)]);
          }}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>Aggro</span>
          <span>Balanced</span>
          <span>Late Game</span>
        </div>
      </div>

      {/* ── Spice Level ───────────────────────────────────────────────── */}
      <div>
        <label htmlFor="random-tag-count" className="block text-sm font-medium text-gray-700 mb-2">
          Spice Level — {constraints.random_tag_count || 0}/10
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Low spice = EDHREC-proven cards. High spice = rare/niche keyword searches dominate the pool.
        </p>
        <input
          id="random-tag-count"
          type="range"
          min="0"
          max="10"
          step="1"
          value={constraints.random_tag_count || 0}
          onChange={(e) => updateConstraint('random_tag_count', parseInt(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0 — Play it safe</span>
          <span>5 — Balanced</span>
          <span>10 — Maximum chaos</span>
        </div>
      </div>

      {/* ── Budget Controls ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Budget</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="total-budget" className="block text-xs text-gray-600 mb-1">
              Budget Target ($)
            </label>
            <input
              id="total-budget"
              type="number"
              min="0"
              max="10000"
              step="10"
              value={constraints.total_budget ?? ''}
              placeholder="No limit"
              onChange={(e) => {
                const val = e.target.value;
                updateConstraint('total_budget', val === '' ? undefined : parseFloat(val));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label htmlFor="max-card-price" className="block text-xs text-gray-600 mb-1">
              Max Price Per Card ($)
            </label>
            <input
              id="max-card-price"
              type="number"
              min="0"
              max="1000"
              step="1"
              value={constraints.max_card_price ?? ''}
              placeholder="No limit"
              onChange={(e) => {
                const val = e.target.value;
                updateConstraint('max_card_price', val === '' ? undefined : parseFloat(val));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
        <label className="flex items-center mt-3 cursor-pointer">
          <input
            type="checkbox"
            checked={constraints.prefer_cheapest ?? false}
            onChange={(e) => updateConstraint('prefer_cheapest', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
          />
          <span className="ml-2 text-sm text-gray-700">Prefer cheapest printing</span>
        </label>
      </div>

      {/* ── Target Bracket ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Target Bracket</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { value: undefined, label: 'Any', sub: 'No limit' },
            { value: 1, label: '1', sub: 'Exhibition' },
            { value: 2, label: '2', sub: 'Core' },
            { value: 3, label: '3', sub: 'Upgraded' },
            { value: 4, label: '4', sub: 'Optimized' },
            { value: 5, label: '5', sub: 'cEDH' },
          ].map(({ value, label, sub }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                const defaults = value ? BRACKET_DEFAULTS[value] : {};
                onChange({
                  ...constraints,
                  ...defaults,
                  targetBracket: value as GenerationConstraints['targetBracket'],
                });
              }}
              className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                constraints.targetBracket === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              <span className="font-medium">{label}</span>
              <span className="block text-xs opacity-70">{sub}</span>
            </button>
          ))}
        </div>
        {constraints.targetBracket && (
          <div className="mt-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600">
            {constraints.targetBracket === 1 && 'Theme-focused, no combos, no Game Changers, no fast mana. Games go long.'}
            {constraints.targetBracket === 2 && 'Precon-level, balanced. No infinite combos, no Game Changers.'}
            {constraints.targetBracket === 3 && 'Optimized synergy, up to 3 Game Changers, late-game combos OK.'}
            {constraints.targetBracket === 4 && 'Full power — all combos, all Game Changers, fast mana prioritized.'}
            {constraints.targetBracket === 5 && 'Competitive — fastest combos, maximum interaction, tutors essential.'}
          </div>
        )}
      </div>

      {/* ── B3 Sub-Target ──────────────────────────────────────────────── */}
      {constraints.targetBracket === 3 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Bracket 3 Flavor</h3>
          <p className="text-xs text-gray-500 mb-3">
            B3 spans a wide range — choose where on the spectrum
          </p>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'casual' as const, label: 'Casual B3', tip: 'Minimal fast mana, few Game Changers. Focused upgrades over a precon.' },
              { value: 'high' as const, label: 'High B3', tip: 'Up to 3 Game Changers, 2 fast rocks. Tuned but no combos before turn 6.' },
            ]).map(({ value, label, tip }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateConstraint('b3SubTarget', value)}
                className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                  (constraints.b3SubTarget ?? 'high') === value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                <span className="font-medium">{label}</span>
                <span className="block text-xs opacity-70 mt-0.5">{tip}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Deck Posture (B4-B5 only) ─────────────────────────────────── */}
      {(constraints.targetBracket === 4 || constraints.targetBracket === 5) && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">Deck Posture</h3>
          <p className="text-xs text-gray-500 mb-3">
            How the deck wins — shapes card selection for high-bracket decks
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {([
              { value: 'adaptive', label: 'Adaptive', tip: 'Plays to the table' },
              { value: 'turbo', label: 'Turbo', tip: 'Wins fast' },
              { value: 'midrange', label: 'Midrange', tip: 'Grinds value' },
              { value: 'control', label: 'Control', tip: 'Answers everything' },
              { value: 'stax', label: 'Stax', tip: 'Slows opponents' },
            ] as const).map(({ value, label, tip }) => (
              <button
                key={value}
                type="button"
                onClick={() => updateConstraint('posture', value)}
                title={tip}
                className={`px-1.5 sm:px-3 py-2 rounded-md border text-xs sm:text-sm transition-colors truncate ${
                  constraints.posture === value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {constraints.posture && (
            <div className="mt-3 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-xs text-gray-600">
              {constraints.posture === 'adaptive' && 'Balanced across strategies. Includes answers, threats, and card advantage — adjusts to whatever the table throws at you.'}
              {constraints.posture === 'turbo' && 'All-in on speed. Maximizes fast mana, tutors, and compact win combos to close the game before opponents can set up.'}
              {constraints.posture === 'midrange' && 'Grinds value over time. Prioritizes card advantage engines, resilient threats, and flexible answers to out-resource the table.'}
              {constraints.posture === 'control' && 'Reactive and patient. Heavy on counterspells, removal, and board wipes — wins after neutralizing all threats.'}
              {constraints.posture === 'stax' && 'Locks the table down. Tax effects, resource denial, and asymmetric hate pieces slow opponents while you pull ahead.'}
            </div>
          )}
        </div>
      )}

      {/* ── Game Changers ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Game Changers Allowed</h3>
        <p className="text-xs text-gray-500 mb-3">
          Game Changers are high-impact cards that define power level (Sol Ring, Mana Crypt, etc.)
        </p>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {[
            { value: 'none' as const, label: 'None' },
            { value: 3, label: 'Up to 3' },
            { value: 6, label: 'Up to 6' },
            { value: 'unlimited' as const, label: 'Unlimited' },
          ].map(({ value, label }) => (
            <button
              key={String(value)}
              type="button"
              onClick={() => updateConstraint('gameChangerLimit', value)}
              className={`px-1.5 sm:px-3 py-2 rounded-md border text-xs sm:text-sm transition-colors truncate ${
                (constraints.gameChangerLimit ?? 'unlimited') === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Lands ─────────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">Lands</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Total Lands — {constraints.landCount ?? 36}
            </label>
            <input
              type="range"
              min="28"
              max="42"
              step="1"
              value={constraints.landCount ?? 36}
              onChange={(e) => updateConstraint('landCount', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>28 (cEDH)</span>
              <span>36</span>
              <span>42 (casual)</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Non-Basic Lands — {constraints.nonBasicLandCount ?? 20}
            </label>
            <input
              type="range"
              min="0"
              max={constraints.landCount ?? 36}
              step="1"
              value={constraints.nonBasicLandCount ?? 20}
              onChange={(e) => updateConstraint('nonBasicLandCount', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0 (all basics)</span>
              <span>{constraints.landCount ?? 36} (no basics)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Max Rarity ────────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Max Rarity</h3>
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {[
            { value: 'common' as const, label: 'Common' },
            { value: 'uncommon' as const, label: 'Uncommon' },
            { value: 'rare' as const, label: 'Rare' },
            { value: 'mythic' as const, label: 'Mythic' },
          ].map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => updateConstraint('maxRarity', value)}
              className={`px-1.5 sm:px-3 py-2 rounded-md border text-xs sm:text-sm transition-colors truncate ${
                constraints.maxRarity === value
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Must Include Cards ────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Must Include Cards</h3>
        <p className="text-xs text-gray-500 mb-3">
          These cards will always be included in the deck if they fit the color identity.
        </p>
        {(constraints.mustIncludeCards || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(constraints.mustIncludeCards || []).map((card, index) => (
              <div
                key={`must-${card}-${index}`}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 border border-green-200"
              >
                <span>{card}</span>
                <button
                  onClick={() => removeMustInclude(index)}
                  className="ml-2 text-green-600 hover:text-green-800 focus:outline-none"
                  type="button"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
        <CardAutocomplete
          onAdd={addMustInclude}
          placeholder="e.g. Sol Ring, Demonic Tutor..."
          existingCards={constraints.mustIncludeCards || []}
          colorIdentity={commanderColorIdentity}
          disabled={!commanderColorIdentity}
          disabledMessage="Select a commander first"
        />
      </div>

      {/* ── Excluded Cards ────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Excluded Cards</h3>
        <p className="text-xs text-gray-500 mb-3">
          These cards will never appear in the generated deck.
        </p>
        {(constraints.excludedCards || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(constraints.excludedCards || []).map((card, index) => (
              <div
                key={`excl-${card}-${index}`}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 border border-red-200"
              >
                <span>{card}</span>
                <button
                  onClick={() => removeExclude(index)}
                  className="ml-2 text-red-600 hover:text-red-800 focus:outline-none"
                  type="button"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
        <CardAutocomplete
          onAdd={addExclude}
          placeholder="e.g. Cyclonic Rift, Rhystic Study..."
          existingCards={constraints.excludedCards || []}
          colorIdentity={commanderColorIdentity}
          disabled={!commanderColorIdentity}
          disabledMessage="Select a commander first"
        />
      </div>

      {/* ── Add Keywords ──────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Add Keywords</h3>
        <p className="text-xs text-gray-500 mb-3">
          Cards matching these in their oracle text get priority. e.g. cascade, proliferate, landfall
        </p>
        {(constraints.keyword_focus || []).length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {(constraints.keyword_focus || []).map((keyword, index) => (
              <div
                key={`keyword-${keyword}-${index}`}
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 border border-blue-200"
              >
                <span>{keyword}</span>
                <button
                  onClick={() => removeKeyword(index)}
                  className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
                  type="button"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword(keywordInput); } }}
            placeholder="e.g. cascade, tokens, graveyard..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
          <button
            onClick={() => addKeyword(keywordInput)}
            disabled={!keywordInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium"
            type="button"
          >
            Add
          </button>
        </div>
      </div>

      {/* ── Advanced: Card Type Weights (opt-in toggle) ────────────────── */}
      <div>
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={!!constraints.card_type_weights}
            onChange={(e) => {
              if (e.target.checked) {
                updateConstraint('card_type_weights', defaultCardTypeWeights);
                setShowAdvanced(true);
              } else {
                updateConstraint('card_type_weights', undefined);
                setShowAdvanced(false);
              }
            }}
            className="rounded border-gray-300 text-blue-600 shadow-sm focus:ring-blue-500"
          />
          <span className="ml-2 text-sm font-medium text-gray-700">Use custom Card Type Weights</span>
        </label>
        <p className="text-xs text-gray-500 mt-1 ml-6">
          Off = engine decides type distribution automatically. On = you control how many creatures, artifacts, etc.
        </p>
        {constraints.card_type_weights && (
          <div className="mt-3">
            <CardTypeWeightsComponent
              weights={constraints.card_type_weights}
              onChange={handleCardTypeWeightsChange}
            />
          </div>
        )}
      </div>

    </div>
  );
}

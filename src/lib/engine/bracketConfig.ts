import engineConfig from './engine-config.json';

// ── Typed config surface read from engine-config.json ──────────────────────
// Every threshold the engine uses MUST come from here so the retune job
// can update one file. Exact numeric values are PROVISIONAL (n=1-4 per
// bracket, MEASURED_UNDERSAMPLED) — gated behind config so they can be
// swapped after the n>=8 backfill.

export interface HardConstraints {
  game_changers_max: number | null;
  mass_land_denial: boolean;
  intentional_two_card_combos?: boolean;
  early_two_card_combos?: boolean;
  combos?: string;
}

export interface GenerationTarget {
  fast_mana_rocks: number;
  free_interaction: number;
  compact_win_lines: number;
  game_changer_count: number;
  avg_mana_value: number;
  land_count: number;
  card_advantage_engines: number;
  tutor_count?: number;
  mana_dork_count?: number | string;
  hard: HardConstraints;
}

export type Posture = 'turbo' | 'control' | 'stax' | 'midrange' | 'adaptive';

export interface PostureConfig {
  posture_selector: 'hidden' | 'hidden_or_locked_midrange' | 'full';
  options?: Posture[];
  reason?: string;
  confidence?: string;
}

export const POSTURE_LABELS: Record<Posture, string> = engineConfig.ui_contract.posture_labels_user_facing as Record<Posture, string>;

// ── Soft score weights (four discriminators) ───────────────────────────────
export const SOFT_SCORE_WEIGHTS = engineConfig.bracket_classifier.power_package_score.inputs_and_weights as {
  fast_mana_rocks: number;
  free_interaction: number;
  compact_win_lines: number;
  game_changer_count: number;
};

// ── GC gate rules ──────────────────────────────────────────────────────────
export type Band = 'low' | 'high';

export interface GCGateRule {
  if_gc: number | string;
  band: Band;
  candidate_brackets: number[];
}

export const GC_GATE_RULES: GCGateRule[] =
  engineConfig.bracket_classifier.primary_hard_gate.rules as GCGateRule[];

// ── Generation targets per bracket ─────────────────────────────────────────
// B1 has no quantitative targets.
const raw = engineConfig.generation_targets;

export const GENERATION_TARGETS: Record<number, GenerationTarget | null> = {
  1: null,
  2: {
    fast_mana_rocks: (raw['2'] as any).fast_mana_rocks,
    free_interaction: (raw['2'] as any).free_interaction,
    compact_win_lines: (raw['2'] as any).compact_win_lines,
    game_changer_count: (raw['2'] as any).game_changer_count,
    avg_mana_value: (raw['2'] as any).avg_mana_value,
    land_count: (raw['2'] as any).land_count,
    card_advantage_engines: (raw['2'] as any).card_advantage_engines,
    mana_dork_count: (raw['2'] as any).mana_dork_count,
    hard: (raw['2'] as any).hard,
  },
  3: {
    fast_mana_rocks: (raw['3'] as any).fast_mana_rocks,
    free_interaction: (raw['3'] as any).free_interaction,
    compact_win_lines: 0,
    game_changer_count: (raw['3'] as any).game_changer_count,
    avg_mana_value: (raw['3'] as any).avg_mana_value,
    land_count: (raw['3'] as any).land_count,
    card_advantage_engines: (raw['3'] as any).card_advantage_engines,
    hard: (raw['3'] as any).hard,
  },
  4: {
    ...(raw['4_5_shared'] as any),
    hard: (raw['4_5_shared'] as any).hard,
  },
  5: {
    ...(raw['4_5_shared'] as any),
    hard: (raw['4_5_shared'] as any).hard,
  },
};

// ── Posture map per bracket ────────────────────────────────────────────────
const postureMap = engineConfig.ui_contract.selectable_posture_map;
export const POSTURE_MAP: Record<number, PostureConfig> = {
  1: postureMap['1'] as PostureConfig,
  2: postureMap['2'] as PostureConfig,
  3: postureMap['3'] as PostureConfig,
  4: postureMap['4'] as PostureConfig,
  5: postureMap['5'] as PostureConfig,
};

// ── Tuple coherence ────────────────────────────────────────────────────────
export const TUPLE_COHERENCE_DISABLE: string[] = engineConfig.ui_contract.tuple_coherence_disable;
export const TUPLE_COHERENCE_WARN: string[] = engineConfig.ui_contract.tuple_coherence_warn;

// ── Hard constraint lookup ─────────────────────────────────────────────────
export function getHardConstraints(bracket: number): HardConstraints {
  const target = GENERATION_TARGETS[bracket];
  if (!target) {
    return { game_changers_max: 0, mass_land_denial: false, intentional_two_card_combos: false };
  }
  return target.hard;
}

// ── B4/B5 policy ───────────────────────────────────────────────────────────
export const B4_B5_POLICY = engineConfig.b4_b5_policy;

// ── Config version for retune tracking ─────────────────────────────────────
export const CONFIG_VERSION = engineConfig.config_version;

/**
 * Retune hook entrypoint — allows the retune job to update engine-config.json
 * values without touching code. Validates incoming patches against the config
 * schema before applying.
 *
 * Trigger conditions (from retune_policy):
 *   - WotC ban-list / Game-Changers update
 *   - Major set release
 *
 * Usage: POST /api/retune with a partial config patch.
 */

import type { GenerationTarget, Posture } from './bracketConfig';

// ── Patch schema ──────────────────────────────────────────────────────────

export interface RetunePatch {
  generation_targets?: {
    '2'?: Partial<GenerationTarget>;
    '3'?: Partial<GenerationTarget>;
    '4_5_shared'?: Partial<GenerationTarget>;
  };
  soft_score_weights?: {
    fast_mana_rocks?: number;
    free_interaction?: number;
    compact_win_lines?: number;
    game_changer_count?: number;
  };
  posture_map?: Record<string, {
    posture_selector?: 'hidden' | 'hidden_or_locked_midrange' | 'full';
    options?: Posture[];
  }>;
  config_version?: string;
}

export interface RetuneResult {
  success: boolean;
  applied: string[];
  errors: string[];
  newVersion: string | null;
}

// ── Validation ────────────────────────────────────────────────────────────

function validateWeights(weights: Record<string, number>): string[] {
  const errors: string[] = [];
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  if (Math.abs(total - 1.0) > 0.01) {
    errors.push(`Soft score weights must sum to 1.0, got ${total.toFixed(3)}`);
  }
  for (const [key, val] of Object.entries(weights)) {
    if (val < 0 || val > 1) {
      errors.push(`Weight ${key} must be 0-1, got ${val}`);
    }
  }
  return errors;
}

function validateGenerationTarget(bracket: string, patch: Partial<GenerationTarget>): string[] {
  const errors: string[] = [];
  if (patch.fast_mana_rocks !== undefined && patch.fast_mana_rocks < 0) {
    errors.push(`${bracket}.fast_mana_rocks must be >= 0`);
  }
  if (patch.free_interaction !== undefined && patch.free_interaction < 0) {
    errors.push(`${bracket}.free_interaction must be >= 0`);
  }
  if (patch.avg_mana_value !== undefined && (patch.avg_mana_value < 1.0 || patch.avg_mana_value > 5.0)) {
    errors.push(`${bracket}.avg_mana_value must be 1.0-5.0`);
  }
  if (patch.land_count !== undefined && (patch.land_count < 20 || patch.land_count > 45)) {
    errors.push(`${bracket}.land_count must be 20-45`);
  }
  if (patch.game_changer_count !== undefined && patch.game_changer_count < 0) {
    errors.push(`${bracket}.game_changer_count must be >= 0`);
  }
  return errors;
}

// ── Apply ─────────────────────────────────────────────────────────────────

export function validateRetunePatch(patch: RetunePatch): string[] {
  const errors: string[] = [];

  if (patch.soft_score_weights) {
    const currentKeys = ['fast_mana_rocks', 'free_interaction', 'compact_win_lines', 'game_changer_count'];
    const extra = Object.keys(patch.soft_score_weights).filter(k => !currentKeys.includes(k));
    if (extra.length > 0) {
      errors.push(`Unknown weight keys: ${extra.join(', ')}`);
    }
    errors.push(...validateWeights(patch.soft_score_weights as Record<string, number>));
  }

  if (patch.generation_targets) {
    for (const [bracket, target] of Object.entries(patch.generation_targets)) {
      if (!['2', '3', '4_5_shared'].includes(bracket)) {
        errors.push(`Invalid generation target bracket: ${bracket}`);
        continue;
      }
      if (target) {
        errors.push(...validateGenerationTarget(bracket, target));
      }
    }
  }

  return errors;
}

export function buildRetuneResult(
  patch: RetunePatch,
  currentConfig: Record<string, unknown>,
): RetuneResult {
  const errors = validateRetunePatch(patch);
  if (errors.length > 0) {
    return { success: false, applied: [], errors, newVersion: null };
  }

  const applied: string[] = [];

  if (patch.soft_score_weights) {
    applied.push('soft_score_weights');
  }

  if (patch.generation_targets) {
    for (const bracket of Object.keys(patch.generation_targets)) {
      applied.push(`generation_targets.${bracket}`);
    }
  }

  if (patch.posture_map) {
    applied.push('posture_map');
  }

  const newVersion = patch.config_version ??
    `${(currentConfig.config_version as string || '1.0')}-retune-${new Date().toISOString().slice(0, 10)}`;

  return {
    success: true,
    applied,
    errors: [],
    newVersion,
  };
}

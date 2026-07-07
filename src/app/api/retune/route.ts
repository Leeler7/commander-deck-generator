import { NextRequest, NextResponse } from 'next/server';
import { validateRetunePatch, buildRetuneResult } from '@/lib/engine/retune';
import type { RetunePatch } from '@/lib/engine/retune';
import engineConfig from '@/lib/engine/engine-config.json';

export async function POST(request: NextRequest) {
  try {
    const patch: RetunePatch = await request.json();

    const errors = validateRetunePatch(patch);
    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, errors },
        { status: 400 },
      );
    }

    const result = buildRetuneResult(patch, engineConfig as Record<string, unknown>);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { success: false, errors: ['Invalid JSON payload'] },
      { status: 400 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    config_version: engineConfig.config_version,
    retune_policy: engineConfig.retune_policy,
    current_targets: engineConfig.generation_targets,
    current_weights: engineConfig.bracket_classifier.power_package_score.inputs_and_weights,
  });
}

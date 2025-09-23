import { AbilityNow, StatKey } from './types';
import { MAX_STAT, MIN_STAT, STAT_KEYS } from './constants';

export function clampStatValue(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_STAT;
  }
  const rounded = Math.round(value);
  return Math.max(MIN_STAT, Math.min(MAX_STAT, rounded));
}

export function clampConfidence(confidence: number): number {
  if (Number.isNaN(confidence)) {
    return 0;
  }
  return Math.max(0, Math.min(1, confidence));
}

export function calculateAbility(
  stats: Record<StatKey, number>,
  confidences?: Record<StatKey, number>
): AbilityNow {
  const normalizedStats = {} as Record<StatKey, number>;
  const normalizedConfidence = {} as Record<StatKey, number>;
  let total = 0;

  for (const key of STAT_KEYS) {
    const stat = clampStatValue(stats[key]);
    normalizedStats[key] = stat;
    total += stat;
    normalizedConfidence[key] = clampConfidence(confidences?.[key] ?? 0.5);
  }

  const average = total / STAT_KEYS.length;
  const level0to100 = Math.floor(average);
  const progress01 = average - level0to100;

  return {
    stats: normalizedStats,
    confidence: normalizedConfidence,
    total,
    level0to100,
    progress01
  };
}

export function makeAbilityFromValues(values: Record<StatKey, number>, confidences?: Record<StatKey, number>): AbilityNow {
  const normalizedStats = {} as Record<StatKey, number>;
  const normalizedConfidence = {} as Record<StatKey, number>;

  for (const key of STAT_KEYS) {
    normalizedStats[key] = clampStatValue(values[key]);
    normalizedConfidence[key] = clampConfidence(confidences?.[key] ?? 0.5);
  }

  return calculateAbility(normalizedStats, normalizedConfidence);
}

import { AbilityNow, StatKey, StatSnapshot } from './types';
import { MAX_STAT, MIN_STAT, MAX_TOTAL, MIN_TOTAL, STAT_KEYS } from './constants';

export function clampStatValue(value: number): number {
  if (Number.isNaN(value)) {
    return MIN_STAT;
  }
  return Math.max(MIN_STAT, Math.min(MAX_STAT, value));
}

export function clampConfidence(confidence: number): number {
  if (Number.isNaN(confidence)) {
    return 0;
  }
  return Math.max(0, Math.min(1, confidence));
}

export function calculateAbility(stats: Record<StatKey, StatSnapshot>): AbilityNow {
  let total = 0;
  for (const key of STAT_KEYS) {
    total += stats[key].value;
  }
  total = Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, total));
  const normalized = (total - MIN_TOTAL) / (MAX_TOTAL - MIN_TOTAL);
  const scaled = normalized * 100;
  const level0to100 = Math.floor(scaled);
  const progress01 = scaled - level0to100;
  return {
    stats,
    total,
    level0to100,
    progress01
  };
}

export function makeAbilityFromValues(values: Record<StatKey, number>, confidences?: Record<StatKey, number>): AbilityNow {
  const snapshots: Record<StatKey, StatSnapshot> = {
    pwr: { value: clampStatValue(values.pwr), confidence: clampConfidence(confidences?.pwr ?? 0.5) },
    acc: { value: clampStatValue(values.acc), confidence: clampConfidence(confidences?.acc ?? 0.5) },
    grt: { value: clampStatValue(values.grt), confidence: clampConfidence(confidences?.grt ?? 0.5) },
    cog: { value: clampStatValue(values.cog), confidence: clampConfidence(confidences?.cog ?? 0.5) },
    pln: { value: clampStatValue(values.pln), confidence: clampConfidence(confidences?.pln ?? 0.5) },
    soc: { value: clampStatValue(values.soc), confidence: clampConfidence(confidences?.soc ?? 0.5) }
  };
  return calculateAbility(snapshots);
}

import {
  AbilityNow,
  RecalibrationComputationInput,
  RecalibrationResult,
  StatKey,
  StatSnapshot,
  TickInput,
  UserDynamics
} from './types';
import { CONFIDENCE_DECAY, DEFAULT_DYNAMICS, DEFAULT_HALF_LIFE_SAFEGUARD, STAT_KEYS } from './constants';
import { calculateAbility, clampConfidence, clampStatValue } from './ability';
import { updateLegacy } from './legacy';

export interface TickComputationState {
  stats: Record<StatKey, StatSnapshot>;
  dynamics: UserDynamics;
  legacyScore: number;
}

interface QualityAggregation {
  average: number;
  byStat: Partial<Record<StatKey, number>>;
}

function aggregateQuality(tokens: TickInput['tokens']): QualityAggregation {
  if (!tokens || tokens.length === 0) {
    return { average: 0.4, byStat: {} };
  }

  let sum = 0;
  const byStat: Partial<Record<StatKey, { total: number; weight: number }>> = {};

  for (const token of tokens) {
    const quality = Math.max(0, Math.min(1, token.quality));
    sum += quality;
    if (token.statHint) {
      const bucket = byStat[token.statHint] || { total: 0, weight: 0 };
      bucket.total += quality;
      bucket.weight += 1;
      byStat[token.statHint] = bucket;
    }
  }

  const average = sum / tokens.length;
  const normalized: Partial<Record<StatKey, number>> = {};
  for (const key of Object.keys(byStat) as StatKey[]) {
    const bucket = byStat[key]!;
    normalized[key] = bucket.total / Math.max(1, bucket.weight);
  }
  return { average, byStat: normalized };
}

function computeMaintenanceThreshold(statValue: number, params: { tl0: number; beta: number; sfloor: number }): number {
  const adjusted = Math.max(0, statValue - params.sfloor);
  return params.tl0 + params.beta * adjusted;
}

function computeEffectiveTau(statValue: number, params: { tau0: number; alpha: number; sfloor: number }): number {
  const adjusted = Math.max(0, statValue - params.sfloor);
  const divisor = 1 + params.alpha * adjusted;
  const tau = params.tau0 / Math.max(0.5, divisor);
  return Math.max(1, Math.min(DEFAULT_HALF_LIFE_SAFEGUARD, tau));
}

function deriveQualitySignal(stat: StatKey, aggregation: QualityAggregation): number {
  const statSpecific = aggregation.byStat[stat];
  const blended = statSpecific !== undefined ? 0.7 * statSpecific + 0.3 * aggregation.average : aggregation.average;
  return Math.max(0, Math.min(1, blended || 0));
}

export interface TickComputationResult {
  ability: AbilityNow;
  updatedStats: Record<StatKey, StatSnapshot>;
  legacy: ReturnType<typeof updateLegacy>['state'];
  legacyDetail: ReturnType<typeof updateLegacy>;
}

export function tickStats(state: TickComputationState, input: TickInput): TickComputationResult {
  const { stats: prevStats, dynamics, legacyScore } = state;
  const aggregation = aggregateQuality(input.tokens);
  const updated: Record<StatKey, StatSnapshot> = { ...prevStats } as Record<StatKey, StatSnapshot>;

  for (const key of STAT_KEYS) {
    const prev = prevStats[key];
    const params = dynamics[key] || DEFAULT_DYNAMICS[key];
    const load = input.trainingLoad[key] ?? 0;
    const qualitySignal = deriveQualitySignal(key, aggregation);

    const maintenance = computeMaintenanceThreshold(prev.value, params);
    const loadAbove = Math.max(0, load - maintenance);
    const taper = 1 / (1 + params.gamma * Math.max(0, prev.value - 10));
    const qualityFactor = 0.25 + 0.75 * qualitySignal;
    const gain = loadAbove * params.eta0 * taper * qualityFactor;

    const effectiveTau = computeEffectiveTau(prev.value, params);
    const baseDecay = (prev.value - params.sfloor) * (1 - Math.pow(0.5, 1 / effectiveTau));

    const maintenanceGap = maintenance > 0 ? (maintenance - load) / maintenance : 0;
    let decay = baseDecay;
    if (loadAbove > 0) {
      decay *= 1 - Math.min(0.7, loadAbove / (maintenance + 1) * 0.6);
    } else if (maintenanceGap > 0) {
      decay *= 1 + Math.min(0.8, maintenanceGap);
    }

    if (input.injuryOrIllness) {
      decay *= qualitySignal > 0.4 ? 0.55 : 0.75;
    }

    let value = prev.value + gain - decay;
    value = Math.max(params.sfloor, value);
    value = clampStatValue(value);

    const confidence = clampConfidence(
      prev.confidence * CONFIDENCE_DECAY + qualitySignal * 0.5 + Math.min(0.1, loadAbove / 50)
    );

    updated[key] = {
      value,
      confidence
    };
  }

  const ability = calculateAbility(updated);
  const legacyResult = updateLegacy({
    abilityHistory: [calculateAbility(prevStats), ability],
    trainingLoad: [input.trainingLoad],
    tokens: input.tokens,
    prEvents: [],
    streaks: [],
    badges: [],
    previousScore: legacyScore,
    previousLevel: 0
  });

  return {
    ability,
    updatedStats: updated,
    legacy: legacyResult.state,
    legacyDetail: legacyResult
  };
}

export function recalibrateDynamics(input: RecalibrationComputationInput): RecalibrationResult {
  const { previousAbility, recentAbility, observations, prevDynamics } = input;
  const notes: string[] = [];
  const updated: UserDynamics = { ...prevDynamics } as UserDynamics;

  for (const observation of observations) {
    const params = prevDynamics[observation.stat] || DEFAULT_DYNAMICS[observation.stat];
    const qualityWeight = Math.max(0.1, Math.min(1, observation.quality));
    const observedTrend = observation.observedDelta / Math.max(1, observation.days);

    // Adjust eta0 based on gain effectiveness
    if (observation.averageLoad > observation.maintenanceGuess) {
      const desiredGain = observedTrend;
      const loadAbove = observation.averageLoad - observation.maintenanceGuess;
      const taper = 1 / (1 + params.gamma * Math.max(0, recentAbility.stats[observation.stat].value - 10));
      const impliedEta = desiredGain / Math.max(0.001, loadAbove * taper);
      const blendedEta = params.eta0 * (1 - 0.3 * qualityWeight) + impliedEta * 0.3 * qualityWeight;
      updated[observation.stat] = {
        ...params,
        eta0: Math.max(0.1, Math.min(2.5, blendedEta))
      };
      notes.push(`Eta recalibrated for ${observation.stat} → ${updated[observation.stat].eta0.toFixed(2)}`);
    }

    // Adjust tau0 when decay observed
    if (observation.averageLoad <= observation.maintenanceGuess && observation.observedDelta < 0) {
      const targetTau = Math.max(5, Math.min(180, Math.log(0.5) / Math.log(1 + observation.observedDelta / Math.max(1, previousAbility.stats[observation.stat].value))));
      const blendedTau = params.tau0 * (1 - 0.2 * qualityWeight) + targetTau * 0.2 * qualityWeight;
      updated[observation.stat] = {
        ...updated[observation.stat],
        tau0: Math.max(5, Math.min(DEFAULT_HALF_LIFE_SAFEGUARD, blendedTau))
      };
      notes.push(`Tau recalibrated for ${observation.stat} → ${updated[observation.stat].tau0.toFixed(1)}`);
    }
  }

  const ability = recentAbility;
  return {
    dynamics: updated,
    ability,
    notes
  };
}

import {
  LegacyComputationInput,
  LegacyComputationResult,
  LegacyComponentBreakdown,
  LegacyState,
  StatKey
} from './types';
import {
  LEGACY_LEVEL_ALPHA,
  LEGACY_LEVEL_BASE,
  LEGACY_WEIGHTS,
  STAT_KEYS
} from './constants';

function areaUnderCurve(abilityTotals: number[]): number {
  if (abilityTotals.length <= 1) {
    return abilityTotals[0] ?? 0;
  }

  let sum = 0;
  for (let i = 1; i < abilityTotals.length; i += 1) {
    const prev = abilityTotals[i - 1];
    const curr = abilityTotals[i];
    sum += (prev + curr) / 2;
  }
  return sum;
}

function computeWorkAboveMaintenance(trainingLoad: LegacyComputationInput['trainingLoad']): number {
  let total = 0;
  for (const day of trainingLoad) {
    for (const key of Object.keys(day) as StatKey[]) {
      const load = day[key] ?? 0;
      const maintenance = 1; // heuristic until personalized thresholds are persisted client-side
      total += Math.max(0, load - maintenance);
    }
  }
  return total;
}

function computePRIndex(events: LegacyComputationInput['prEvents']): number {
  const now = Date.now();
  let score = 0;
  for (const event of events) {
    const timestamp = new Date(event.timestamp).getTime();
    const ageDays = Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
    const recencyWeight = Math.exp(-ageDays / 120);
    score += recencyWeight * (event.weight ?? 1);
  }
  return score;
}

function computeConsistency(abilityHistory: LegacyComputationInput['abilityHistory']): number {
  if (abilityHistory.length === 0) {
    return 0;
  }
  const window = abilityHistory.slice(-90);
  const totals = window.map(entry => entry.total);
  const avg = totals.reduce((acc, value) => acc + value, 0) / totals.length;
  const variance = totals.reduce((acc, value) => acc + Math.pow(value - avg, 2), 0) / totals.length;
  const std = Math.sqrt(variance);
  return Math.max(0, avg - std);
}

function computeBadgeValue(badges: LegacyComputationInput['badges']): number {
  return badges.reduce((acc, badge) => acc + Math.max(0, badge.value), 0);
}

function computePerStatShares(input: LegacyComputationInput, components: LegacyComponentBreakdown): Record<StatKey, number> {
  const totals: Partial<Record<StatKey, number>> = {};
  const latestAbility = input.abilityHistory[input.abilityHistory.length - 1];
  const latestStats = latestAbility?.stats;
  const latestTotal = latestAbility?.total ?? 0;

  for (const key of STAT_KEYS) {
    const base = latestStats ? latestStats[key].value : 0;
    const load = input.trainingLoad.reduce((acc, day) => acc + (day[key] ?? 0), 0);
    const tokenQuality = input.tokens
      .filter(token => !token.statHint || token.statHint === key)
      .reduce((acc, token) => acc + token.quality, 0);
    const prs = input.prEvents.filter(event => event.stat === key).length;
    const badge = input.badges.filter(b => b.stat === key).reduce((acc, b) => acc + b.value, 0);

    const totalForRatio = Math.max(1, latestTotal || base || 1);
    const baseRatio = base / totalForRatio;
    const legacyContribution =
      components.auc * baseRatio * 0.3 +
      components.work * (load / Math.max(1, input.trainingLoad.length)) * 0.25 +
      components.pr * prs * 0.2 +
      components.consistency * (tokenQuality / Math.max(1, input.tokens.length)) * 0.15 +
      components.badges * badge * 0.1;

    totals[key] = legacyContribution;
  }

  const values = STAT_KEYS.map(key => totals[key] ?? 0);
  const max = Math.max(...values, 1);
  const normalized: Record<StatKey, number> = {
    pwr: ((totals.pwr ?? 0) / max) * 100,
    acc: ((totals.acc ?? 0) / max) * 100,
    grt: ((totals.grt ?? 0) / max) * 100,
    cog: ((totals.cog ?? 0) / max) * 100,
    pln: ((totals.pln ?? 0) / max) * 100,
    soc: ((totals.soc ?? 0) / max) * 100
  };

  return normalized;
}

export function updateLegacy(input: LegacyComputationInput): LegacyComputationResult {
  const abilityTotals = input.abilityHistory.map(entry => entry.total);
  const components: LegacyComponentBreakdown = {
    auc: areaUnderCurve(abilityTotals),
    work: computeWorkAboveMaintenance(input.trainingLoad),
    pr: computePRIndex(input.prEvents),
    consistency: computeConsistency(input.abilityHistory),
    badges: computeBadgeValue(input.badges)
  };

  const weightedGain =
    components.auc * LEGACY_WEIGHTS.auc +
    components.work * LEGACY_WEIGHTS.work +
    components.pr * LEGACY_WEIGHTS.pr +
    components.consistency * LEGACY_WEIGHTS.consistency +
    components.badges * LEGACY_WEIGHTS.badges;

  const score = Math.max(input.previousScore, input.previousScore + weightedGain);
  const level = Math.floor(LEGACY_LEVEL_ALPHA * Math.sqrt(score / LEGACY_LEVEL_BASE));
  const perkPoints = Math.floor(level / 5);
  const state: LegacyState = { score, level, perkPoints };
  const perStatShares = computePerStatShares(input, components);

  return {
    state,
    components,
    perStatShares
  };
}

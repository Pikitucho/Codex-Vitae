import { AbilityNow, LegacyPerStat, LegacyState, StatKey } from './types';
import { STAT_KEYS } from './constants';
import { calculateAbility } from './ability';

export const LEGACY_ROLLOVER_THRESHOLD = 1000;

function makeEmptyLegacyPerStat(): LegacyPerStat {
  return { counter: 0, level: 0, totalEarned: 0 };
}

function sanitizeProgressAmount(amount: number): number {
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.max(0, Math.floor(amount));
}

function sanitizeLegacyPerStat(stat?: LegacyPerStat): LegacyPerStat {
  if (!stat) {
    return makeEmptyLegacyPerStat();
  }

  const level = Number.isFinite(stat.level) ? Math.max(0, Math.floor(stat.level)) : 0;
  const counter = Number.isFinite(stat.counter)
    ? Math.max(0, Math.min(LEGACY_ROLLOVER_THRESHOLD - 1, Math.floor(stat.counter)))
    : 0;
  const totalEarned = Number.isFinite(stat.totalEarned)
    ? Math.max(0, Math.floor(stat.totalEarned))
    : level * LEGACY_ROLLOVER_THRESHOLD + counter;

  return { counter, level, totalEarned };
}

export function createEmptyLegacyState(): LegacyState {
  const stats = {} as Record<StatKey, LegacyPerStat>;
  for (const key of STAT_KEYS) {
    stats[key] = makeEmptyLegacyPerStat();
  }
  return {
    stats,
    totalLevels: 0,
    totalEarned: 0,
    perkPoints: 0
  };
}

export function normalizeLegacyState(state?: LegacyState): LegacyState {
  if (!state) {
    return createEmptyLegacyState();
  }

  const stats = {} as Record<StatKey, LegacyPerStat>;
  let totalLevels = 0;
  let totalEarned = 0;

  for (const key of STAT_KEYS) {
    const normalized = sanitizeLegacyPerStat(state.stats[key]);
    stats[key] = normalized;
    totalLevels += normalized.level;
    totalEarned += normalized.totalEarned;
  }

  const perkPoints = Math.floor(totalLevels / 5);

  return {
    stats,
    totalLevels,
    totalEarned,
    perkPoints
  };
}

export interface AddLegacyProgressInput {
  legacy?: LegacyState;
  ability: AbilityNow;
  stat: StatKey;
  amount: number;
}

export interface AddLegacyProgressResult {
  legacy: LegacyState;
  ability: AbilityNow;
  levelsGained: number;
}

export function addLegacyProgress(input: AddLegacyProgressInput): AddLegacyProgressResult {
  const baseLegacy = normalizeLegacyState(input.legacy);
  const amount = sanitizeProgressAmount(input.amount);

  if (amount <= 0) {
    return {
      legacy: baseLegacy,
      ability: input.ability,
      levelsGained: 0
    };
  }

  const prevStat = baseLegacy.stats[input.stat];
  const rawCounter = prevStat.counter + amount;
  const levelsGained = Math.floor(rawCounter / LEGACY_ROLLOVER_THRESHOLD);
  const counter = rawCounter % LEGACY_ROLLOVER_THRESHOLD;
  const level = prevStat.level + levelsGained;
  const totalEarned = prevStat.totalEarned + amount;

  const updatedStat: LegacyPerStat = { counter, level, totalEarned };
  const updatedStats: Record<StatKey, LegacyPerStat> = { ...baseLegacy.stats, [input.stat]: updatedStat };

  let totalLevels = 0;
  let totalEarnedAll = 0;
  for (const key of STAT_KEYS) {
    totalLevels += updatedStats[key].level;
    totalEarnedAll += updatedStats[key].totalEarned;
  }

  const perkPoints = Math.floor(totalLevels / 5);
  const legacy: LegacyState = {
    stats: updatedStats,
    totalLevels,
    totalEarned: totalEarnedAll,
    perkPoints
  };

  if (levelsGained <= 0) {
    return {
      legacy,
      ability: input.ability,
      levelsGained
    };
  }

  const updatedAbilityStats: Record<StatKey, number> = {
    ...input.ability.stats,
    [input.stat]: input.ability.stats[input.stat] + levelsGained
  };
  const ability = calculateAbility(updatedAbilityStats, input.ability.confidence);

  return {
    legacy,
    ability,
    levelsGained
  };
}

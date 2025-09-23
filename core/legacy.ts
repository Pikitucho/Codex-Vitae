import {
  AbilityNow,
  ActivityLog,
  ActivityLogEntry,
  CharacterProgress,
  LegacyPerStat,
  LegacyState,
  PerkCurrency,
  PerkLedgerEntry,
  PerkLedgerReason,
  PerkState,
  StatKey
} from './types';
import { STAT_KEYS } from './constants';
import { calculateAbility } from './ability';
import { reconcilePerkActivity } from './perks';

export const LEGACY_ROLLOVER_THRESHOLD = 1000;
export const STAT_POINTS_PER_LEVEL = 10;
export const CHARACTER_LEVEL_MILESTONES = [10, 25, 50, 75, 100];
export const QUARTERLY_ACTIVITY_DAYS_REQUIRED = 65;
export const ANNUAL_ACTIVITY_DAYS_REQUIRED = 250;

type DateParts = { year: number; month: number; day: number; iso: string };

const LEDGER_REASONS: PerkLedgerReason[] = ['level', 'quarterly', 'annual', 'manual'];

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

function cloneMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }
  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return undefined;
  }
  const cloned: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    cloned[key] = value;
  }
  return cloned;
}

function sanitizeTimestamp(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }
  }
  return new Date().toISOString();
}

function sanitizeLedgerEntry(entry?: PerkLedgerEntry): PerkLedgerEntry | null {
  if (!entry) {
    return null;
  }
  const id = typeof entry.id === 'string' ? entry.id.trim() : '';
  if (!id) {
    return null;
  }
  const reason = LEDGER_REASONS.includes(entry.reason) ? entry.reason : 'manual';
  const points = Number.isFinite(entry.points) ? Math.trunc(entry.points) : 0;
  if (points === 0) {
    return null;
  }

  return {
    id,
    reason,
    points,
    occurredAt: sanitizeTimestamp(entry.occurredAt),
    metadata: cloneMetadata(entry.metadata)
  };
}

function appendPerkLedgerEntry(wallet: PerkCurrency, entry: PerkLedgerEntry): PerkCurrency {
  const sanitized = sanitizeLedgerEntry(entry);
  if (!sanitized) {
    return wallet;
  }
  if (wallet.ledger.some(existing => existing.id === sanitized.id)) {
    return wallet;
  }
  const ledger = [...wallet.ledger, sanitized];
  const perkPoints = ledger.reduce((sum, item) => sum + item.points, 0);
  return { perkPoints, ledger };
}

function parseDateParts(value: string): DateParts | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed) {
    return null;
  }
  const directMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  let year: number;
  let month: number;
  let day: number;
  if (directMatch) {
    year = Number(directMatch[1]);
    month = Number(directMatch[2]);
    day = Number(directMatch[3]);
  } else {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    year = parsed.getUTCFullYear();
    month = parsed.getUTCMonth() + 1;
    day = parsed.getUTCDate();
  }
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
  return { year, month, day, iso };
}

function sanitizeActivityLogEntry(entry?: ActivityLogEntry): ActivityLogEntry | null {
  if (!entry) {
    return null;
  }
  const parts = parseDateParts(entry.date);
  if (!parts) {
    return null;
  }
  const stat = STAT_KEYS.includes(entry.stat as StatKey) ? (entry.stat as StatKey) : undefined;
  const amount = Number.isFinite(entry.amount) ? Number(entry.amount) : undefined;
  const sanitized: ActivityLogEntry = { date: parts.iso };
  if (stat) {
    sanitized.stat = stat;
  }
  if (amount !== undefined) {
    sanitized.amount = amount;
  }
  return sanitized;
}

function getQuarterFromMonth(month: number): number {
  if (!Number.isFinite(month)) {
    return 1;
  }
  const normalized = Math.max(1, Math.min(12, Math.floor(month)));
  return Math.max(1, Math.min(4, Math.floor((normalized - 1) / 3) + 1));
}

function formatQuarterId(year: number, quarter: number): string {
  return `${year.toString().padStart(4, '0')}-Q${Math.max(1, Math.min(4, Math.floor(quarter)))}`;
}

function computeUniqueDays(entries: ActivityLogEntry[], predicate: (parts: DateParts) => boolean): number {
  const seen = new Set<string>();
  for (const entry of entries) {
    const parts = parseDateParts(entry.date);
    if (!parts) {
      continue;
    }
    if (!predicate(parts)) {
      continue;
    }
    seen.add(parts.iso);
  }
  return seen.size;
}

export function createEmptyLegacyState(): LegacyState {
  const stats = {} as Record<StatKey, LegacyPerStat>;
  for (const key of STAT_KEYS) {
    stats[key] = makeEmptyLegacyPerStat();
  }
  return {
    stats,
    totalEarned: 0
  };
}

export function normalizeLegacyState(state?: LegacyState): LegacyState {
  if (!state) {
    return createEmptyLegacyState();
  }

  const stats = {} as Record<StatKey, LegacyPerStat>;
  let totalEarned = 0;

  for (const key of STAT_KEYS) {
    const normalized = sanitizeLegacyPerStat(state.stats?.[key]);
    stats[key] = normalized;
    totalEarned += normalized.totalEarned;
  }

  return {
    stats,
    totalEarned
  };
}

export function createEmptyCharacterProgress(): CharacterProgress {
  return { characterLevel: 1, totalStatPointsEarned: 0, lastMilestoneLevel: 0 };
}

export function deriveCharacterLevel(totalStatPointsEarned: number): number {
  if (!Number.isFinite(totalStatPointsEarned) || totalStatPointsEarned <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(totalStatPointsEarned / STAT_POINTS_PER_LEVEL) + 1);
}

export function normalizeCharacterProgress(progress?: CharacterProgress): CharacterProgress {
  if (!progress) {
    return createEmptyCharacterProgress();
  }
  const total = Number.isFinite(progress.totalStatPointsEarned)
    ? Math.max(0, Math.floor(progress.totalStatPointsEarned))
    : 0;
  const characterLevel = deriveCharacterLevel(total);
  const lastMilestone = Number.isFinite(progress.lastMilestoneLevel)
    ? Math.max(0, Math.min(characterLevel, Math.floor(progress.lastMilestoneLevel)))
    : 0;
  return {
    characterLevel,
    totalStatPointsEarned: total,
    lastMilestoneLevel: lastMilestone
  };
}

export function createEmptyPerkCurrency(): PerkCurrency {
  return { perkPoints: 0, ledger: [] };
}

export function normalizePerkCurrency(wallet?: PerkCurrency): PerkCurrency {
  if (!wallet) {
    return createEmptyPerkCurrency();
  }
  const ledgerInput = Array.isArray(wallet.ledger) ? wallet.ledger : [];
  const normalizedLedger: PerkLedgerEntry[] = [];
  const seen = new Set<string>();

  for (const entry of ledgerInput) {
    const sanitized = sanitizeLedgerEntry(entry);
    if (!sanitized) {
      continue;
    }
    if (seen.has(sanitized.id)) {
      continue;
    }
    seen.add(sanitized.id);
    normalizedLedger.push(sanitized);
  }

  let total = normalizedLedger.reduce((sum, item) => sum + item.points, 0);
  const fallbackPoints = Number.isFinite(wallet.perkPoints) ? Math.trunc(wallet.perkPoints) : 0;

  if (normalizedLedger.length === 0 && fallbackPoints > 0) {
    const migrationEntry: PerkLedgerEntry = {
      id: `migration:legacy-credit:${fallbackPoints}`,
      reason: 'manual',
      points: fallbackPoints,
      occurredAt: new Date().toISOString()
    };
    normalizedLedger.push(migrationEntry);
    total += fallbackPoints;
  }

  return {
    perkPoints: total,
    ledger: normalizedLedger
  };
}

export function createEmptyActivityLog(): ActivityLog {
  return { entries: [] };
}

export function normalizeActivityLog(log?: ActivityLog): ActivityLog {
  if (!log) {
    return createEmptyActivityLog();
  }
  const entries: ActivityLogEntry[] = [];
  if (Array.isArray(log.entries)) {
    for (const entry of log.entries) {
      const sanitized = sanitizeActivityLogEntry(entry);
      if (sanitized) {
        entries.push(sanitized);
      }
    }
  }
  return { entries };
}

export interface AddLegacyProgressInput {
  legacy?: LegacyState;
  ability: AbilityNow;
  stat: StatKey;
  amount: number;
  progress?: CharacterProgress;
  perkCurrency?: PerkCurrency;
  activityLog?: ActivityLog;
  perks?: PerkState[];
  now?: Date;
}

export interface AddLegacyProgressResult {
  legacy: LegacyState;
  ability: AbilityNow;
  levelsGained: number;
  progress: CharacterProgress;
  perkCurrency: PerkCurrency;
  triggeredLevelMilestones: number[];
  quarterlyAwarded: boolean;
  annualAwarded: boolean;
  perks?: PerkState[];
}

export function addLegacyProgress(input: AddLegacyProgressInput): AddLegacyProgressResult {
  const baseLegacy = normalizeLegacyState(input.legacy);
  const amount = sanitizeProgressAmount(input.amount);
  const baseProgress = normalizeCharacterProgress(input.progress);
  let wallet = normalizePerkCurrency(input.perkCurrency);
  const activityLog = normalizeActivityLog(input.activityLog);

  let legacy = baseLegacy;
  let ability = input.ability;
  let levelsGained = 0;
  let progress = baseProgress;

  if (amount > 0) {
    const prevStat = baseLegacy.stats[input.stat];
    const rawCounter = prevStat.counter + amount;
    levelsGained = Math.floor(rawCounter / LEGACY_ROLLOVER_THRESHOLD);
    const counter = rawCounter % LEGACY_ROLLOVER_THRESHOLD;
    const level = prevStat.level + levelsGained;
    const totalEarned = prevStat.totalEarned + amount;

    const updatedStat: LegacyPerStat = { counter, level, totalEarned };
    const updatedStats: Record<StatKey, LegacyPerStat> = { ...baseLegacy.stats, [input.stat]: updatedStat };

    let totalEarnedAll = 0;
    for (const key of STAT_KEYS) {
      totalEarnedAll += updatedStats[key].totalEarned;
    }

    legacy = {
      stats: updatedStats,
      totalEarned: totalEarnedAll
    };

    if (levelsGained > 0) {
      const updatedAbilityStats: Record<StatKey, number> = {
        ...input.ability.stats,
        [input.stat]: input.ability.stats[input.stat] + levelsGained
      };
      ability = calculateAbility(updatedAbilityStats, input.ability.confidence);

      const totalStatPointsEarned = baseProgress.totalStatPointsEarned + levelsGained;
      progress = normalizeCharacterProgress({
        characterLevel: deriveCharacterLevel(totalStatPointsEarned),
        totalStatPointsEarned,
        lastMilestoneLevel: baseProgress.lastMilestoneLevel
      });
    }
  }

  let triggeredLevelMilestones: number[] = [];
  if (progress.lastMilestoneLevel < progress.characterLevel) {
    const milestoneResult = onCharacterLevelMilestone(progress, wallet, { now: input.now });
    progress = milestoneResult.progress;
    wallet = milestoneResult.wallet;
    triggeredLevelMilestones = milestoneResult.triggeredMilestones;
  }

  let quarterlyAwarded = false;
  let annualAwarded = false;

  if (activityLog.entries.length > 0) {
    const quarterlyResult = recomputeQuarterlyPerkPoint(activityLog, wallet, { now: input.now });
    wallet = quarterlyResult.wallet;
    quarterlyAwarded = quarterlyResult.awarded;

    const annualResult = recomputeAnnualPerkPoint(activityLog, wallet, { now: input.now });
    wallet = annualResult.wallet;
    annualAwarded = annualResult.awarded;
  }

  let evaluatedPerks: PerkState[] | undefined;
  if (input.perks) {
    const evaluation = evaluatePerkActivation(input.perks, ability.stats, wallet);
    evaluatedPerks = evaluation.perks;
    wallet = evaluation.wallet;
  }

  return {
    legacy,
    ability,
    levelsGained,
    progress,
    perkCurrency: wallet,
    triggeredLevelMilestones,
    quarterlyAwarded,
    annualAwarded,
    perks: evaluatedPerks
  };
}

export interface LevelMilestoneOptions {
  now?: Date;
  milestones?: number[];
}

export interface LevelMilestoneResult {
  progress: CharacterProgress;
  wallet: PerkCurrency;
  triggeredMilestones: number[];
}

export function onCharacterLevelMilestone(
  progressInput?: CharacterProgress,
  walletInput?: PerkCurrency,
  options?: LevelMilestoneOptions
): LevelMilestoneResult {
  let progress = normalizeCharacterProgress(progressInput);
  let wallet = normalizePerkCurrency(walletInput);
  const nowIso = (options?.now ?? new Date()).toISOString();
  const milestones = (options?.milestones ?? CHARACTER_LEVEL_MILESTONES).slice().sort((a, b) => a - b);

  const triggered: number[] = [];
  let highestMilestone = progress.lastMilestoneLevel;

  for (const rawMilestone of milestones) {
    const milestone = Math.max(1, Math.floor(rawMilestone));
    if (milestone <= progress.lastMilestoneLevel) {
      continue;
    }
    if (milestone > progress.characterLevel) {
      break;
    }
    const ledgerId = `level:${milestone}`;
    if (wallet.ledger.some(entry => entry.id === ledgerId)) {
      highestMilestone = Math.max(highestMilestone, milestone);
      continue;
    }
    wallet = appendPerkLedgerEntry(wallet, {
      id: ledgerId,
      reason: 'level',
      points: 1,
      occurredAt: nowIso,
      metadata: { milestone }
    });
    triggered.push(milestone);
    highestMilestone = Math.max(highestMilestone, milestone);
  }

  progress = {
    ...progress,
    lastMilestoneLevel: Math.max(progress.lastMilestoneLevel, highestMilestone)
  };

  return { progress, wallet, triggeredMilestones: triggered };
}

export interface PerkPointComputationOptions {
  now?: Date;
  requiredDays?: number;
}

export interface PerkPointComputationResult {
  wallet: PerkCurrency;
  awarded: boolean;
  uniqueDays: number;
}

export function recomputeQuarterlyPerkPoint(
  activityLog?: ActivityLog,
  walletInput?: PerkCurrency,
  options?: PerkPointComputationOptions
): PerkPointComputationResult {
  const log = normalizeActivityLog(activityLog);
  let wallet = normalizePerkCurrency(walletInput);
  const referenceDate = options?.now ?? new Date();
  const refParts =
    parseDateParts(referenceDate.toISOString()) ||
    ({
      year: referenceDate.getUTCFullYear(),
      month: referenceDate.getUTCMonth() + 1,
      day: referenceDate.getUTCDate(),
      iso: referenceDate.toISOString().split('T')[0]
    } as DateParts);
  const quarter = getQuarterFromMonth(refParts.month);
  const quarterId = formatQuarterId(refParts.year, quarter);
  const ledgerId = `quarterly:${quarterId}`;
  const requiredDays = Number.isFinite(options?.requiredDays)
    ? Math.max(1, Math.floor(options!.requiredDays!))
    : QUARTERLY_ACTIVITY_DAYS_REQUIRED;

  const uniqueDays = computeUniqueDays(log.entries, parts => {
    return parts.year === refParts.year && getQuarterFromMonth(parts.month) === quarter;
  });

  if (wallet.ledger.some(entry => entry.id === ledgerId)) {
    return { wallet, awarded: false, uniqueDays };
  }

  if (uniqueDays < requiredDays) {
    return { wallet, awarded: false, uniqueDays };
  }

  wallet = appendPerkLedgerEntry(wallet, {
    id: ledgerId,
    reason: 'quarterly',
    points: 1,
    occurredAt: referenceDate.toISOString(),
    metadata: { quarter: quarterId, uniqueDays }
  });

  return { wallet, awarded: true, uniqueDays };
}

export function recomputeAnnualPerkPoint(
  activityLog?: ActivityLog,
  walletInput?: PerkCurrency,
  options?: PerkPointComputationOptions
): PerkPointComputationResult {
  const log = normalizeActivityLog(activityLog);
  let wallet = normalizePerkCurrency(walletInput);
  const referenceDate = options?.now ?? new Date();
  const refParts =
    parseDateParts(referenceDate.toISOString()) ||
    ({
      year: referenceDate.getUTCFullYear(),
      month: referenceDate.getUTCMonth() + 1,
      day: referenceDate.getUTCDate(),
      iso: referenceDate.toISOString().split('T')[0]
    } as DateParts);
  const ledgerId = `annual:${refParts.year}`;
  const requiredDays = Number.isFinite(options?.requiredDays)
    ? Math.max(1, Math.floor(options!.requiredDays!))
    : ANNUAL_ACTIVITY_DAYS_REQUIRED;

  const uniqueDays = computeUniqueDays(log.entries, parts => parts.year === refParts.year);

  if (wallet.ledger.some(entry => entry.id === ledgerId)) {
    return { wallet, awarded: false, uniqueDays };
  }

  if (uniqueDays < requiredDays) {
    return { wallet, awarded: false, uniqueDays };
  }

  wallet = appendPerkLedgerEntry(wallet, {
    id: ledgerId,
    reason: 'annual',
    points: 1,
    occurredAt: referenceDate.toISOString(),
    metadata: { year: refParts.year, uniqueDays }
  });

  return { wallet, awarded: true, uniqueDays };
}

export function evaluatePerkActivation(
  perks: PerkState[],
  stats: Record<StatKey, number>,
  walletInput?: PerkCurrency
): { perks: PerkState[]; wallet: PerkCurrency } {
  const normalizedWallet = normalizePerkCurrency(walletInput);
  const safePerks = Array.isArray(perks) ? perks : [];
  const updatedPerks = reconcilePerkActivity(safePerks, stats);
  return { perks: updatedPerks, wallet: normalizedWallet };
}

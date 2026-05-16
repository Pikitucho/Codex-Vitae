export const STAT_TYPES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const;
export type StatType = (typeof STAT_TYPES)[number];

export const STAR_STATES = ['LOCKED', 'AVAILABLE', 'OWNED', 'ACTIVE', 'PAUSED'] as const;
export type StarState = (typeof STAR_STATES)[number];

export const ABILITY_NOW_MIN = 0;
export const ABILITY_NOW_MAX = 100;
export const LEGACY_FRAGMENTS_PER_STAT_POINT = 1000;
export const STAT_POINTS_PER_CHARACTER_LEVEL = 10;

export interface StatTrack {
  type: StatType;
  abilityNow: number;
  legacyPoints: number;
  permanentStatPoints: number;
  fragments: number;
  lastActivityAt?: string;
  decayStatus?: 'STABLE' | 'AT_RISK' | 'DECAYING' | 'RECOVERING';
  maintenanceThreshold?: number;
}

export interface UserCharacter {
  id: string;
  userId: string;
  displayName: string;
  level: number;
  totalStatPoints: number;
  stats: Record<StatType, StatTrack>;
  perkPoints: number;
  ownedStarIds: string[];
  activeStarIds: string[];
  verifiedCredentialStarIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type StarType = 'MILESTONE' | 'APEX' | 'CREDENTIAL';

export interface StarRequirements {
  requiredStats?: Partial<Record<StatType, number>>;
  prerequisiteStarIds?: string[];
  requiredEvidenceTypes?: string[];
  perkPointCost?: number;
}

export interface StarDefinition {
  id: string;
  constellationId: string;
  name: string;
  description: string;
  starType: StarType;
  requirements?: StarRequirements;
  activationRequirements?: StarRequirements;
  brandLinks?: string[];
}

export interface StarEvaluationContext {
  abilityNow: Partial<Record<StatType, number>>;
  ownedStarIds?: string[];
  activeStarIds?: string[];
  verifiedCredentialStarIds?: string[];
  verifiedEvidenceTypes?: string[];
  availablePerkPoints?: number;
}

export interface RequirementFailure {
  type: 'STAT' | 'PREREQUISITE_STAR' | 'EVIDENCE' | 'PERK_POINT';
  stat?: StatType;
  required?: number;
  current?: number;
  starId?: string;
  evidenceType?: string;
  requiredPoints?: number;
  availablePoints?: number;
}

export interface StarEvaluationResult {
  state: StarState;
  owned: boolean;
  active: boolean;
  unmetUnlockRequirements: RequirementFailure[];
  unmetActivationRequirements: RequirementFailure[];
}

const LEGACY_STAT_ALIASES: Record<string, StatType> = {
  STRENGTH: 'STR',
  STR: 'STR',
  DEXTERITY: 'DEX',
  DEX: 'DEX',
  CONSTITUTION: 'CON',
  CON: 'CON',
  INTELLIGENCE: 'INT',
  INT: 'INT',
  WISDOM: 'WIS',
  WIS: 'WIS',
  CHARISMA: 'CHA',
  CHA: 'CHA'
};

export function normalizeStatType(value: string): StatType | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toUpperCase();
  return LEGACY_STAT_ALIASES[normalized] ?? null;
}

export function clampAbilityNow(value: number): number {
  if (!Number.isFinite(value)) {
    return ABILITY_NOW_MIN;
  }
  return Math.max(ABILITY_NOW_MIN, Math.min(ABILITY_NOW_MAX, Math.round(value)));
}

export function normalizeFragments(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(LEGACY_FRAGMENTS_PER_STAT_POINT - 1, Math.floor(value)));
}

export function createStatTrack(type: StatType, overrides: Partial<StatTrack> = {}): StatTrack {
  return {
    type,
    abilityNow: clampAbilityNow(overrides.abilityNow ?? 0),
    legacyPoints: Math.max(0, Math.floor(overrides.legacyPoints ?? 0)),
    permanentStatPoints: Math.max(0, Math.floor(overrides.permanentStatPoints ?? 0)),
    fragments: normalizeFragments(overrides.fragments ?? 0),
    lastActivityAt: overrides.lastActivityAt,
    decayStatus: overrides.decayStatus,
    maintenanceThreshold: Number.isFinite(overrides.maintenanceThreshold)
      ? Math.max(0, Number(overrides.maintenanceThreshold))
      : undefined
  };
}

export function createEmptyStatMap(defaultAbilityNow = 0): Record<StatType, StatTrack> {
  return STAT_TYPES.reduce((stats, type) => {
    stats[type] = createStatTrack(type, { abilityNow: defaultAbilityNow });
    return stats;
  }, {} as Record<StatType, StatTrack>);
}

export function deriveCharacterLevel(totalStatPoints: number): number {
  if (!Number.isFinite(totalStatPoints) || totalStatPoints <= 0) {
    return 1;
  }
  return Math.floor(totalStatPoints / STAT_POINTS_PER_CHARACTER_LEVEL) + 1;
}

export function addLegacyFragments(track: StatTrack, amount: number): { track: StatTrack; statPointsGained: number } {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
  const rawFragments = normalizeFragments(track.fragments) + safeAmount;
  const statPointsGained = Math.floor(rawFragments / LEGACY_FRAGMENTS_PER_STAT_POINT);
  const fragments = rawFragments % LEGACY_FRAGMENTS_PER_STAT_POINT;
  const legacyPoints = Math.max(0, Math.floor(track.legacyPoints || 0)) + safeAmount;
  const permanentStatPoints = Math.max(0, Math.floor(track.permanentStatPoints || 0)) + statPointsGained;

  return {
    statPointsGained,
    track: createStatTrack(track.type, {
      ...track,
      fragments,
      legacyPoints,
      permanentStatPoints
    })
  };
}

function evaluateRequirements(
  requirements: StarRequirements | undefined,
  context: StarEvaluationContext,
  options: { includePerkCost: boolean; includeEvidence: boolean }
): RequirementFailure[] {
  const failures: RequirementFailure[] = [];
  const req = requirements ?? {};
  const ownedStarIds = new Set(context.ownedStarIds ?? []);
  const verifiedEvidenceTypes = new Set(context.verifiedEvidenceTypes ?? []);

  for (const [rawStat, requiredValue] of Object.entries(req.requiredStats ?? {})) {
    const stat = normalizeStatType(rawStat);
    if (!stat || requiredValue === undefined) {
      continue;
    }
    const required = Math.max(0, Number(requiredValue));
    const current = clampAbilityNow(context.abilityNow[stat] ?? 0);
    if (current < required) {
      failures.push({ type: 'STAT', stat, required, current });
    }
  }

  for (const starId of req.prerequisiteStarIds ?? []) {
    if (!ownedStarIds.has(starId)) {
      failures.push({ type: 'PREREQUISITE_STAR', starId });
    }
  }

  if (options.includeEvidence) {
    for (const evidenceType of req.requiredEvidenceTypes ?? []) {
      if (!verifiedEvidenceTypes.has(evidenceType)) {
        failures.push({ type: 'EVIDENCE', evidenceType });
      }
    }
  }

  if (options.includePerkCost && Number.isFinite(req.perkPointCost) && Number(req.perkPointCost) > 0) {
    const requiredPoints = Math.max(0, Math.floor(Number(req.perkPointCost)));
    const availablePoints = Math.max(0, Math.floor(context.availablePerkPoints ?? 0));
    if (availablePoints < requiredPoints) {
      failures.push({ type: 'PERK_POINT', requiredPoints, availablePoints });
    }
  }

  return failures;
}

export function evaluateStarState(star: StarDefinition, context: StarEvaluationContext): StarEvaluationResult {
  const ownedStarIds = new Set(context.ownedStarIds ?? []);
  const activeStarIds = new Set(context.activeStarIds ?? []);
  const owned = ownedStarIds.has(star.id);

  const unmetUnlockRequirements = evaluateRequirements(star.requirements, context, {
    includePerkCost: true,
    includeEvidence: true
  });

  if (!owned) {
    return {
      state: unmetUnlockRequirements.length === 0 ? 'AVAILABLE' : 'LOCKED',
      owned: false,
      active: false,
      unmetUnlockRequirements,
      unmetActivationRequirements: []
    };
  }

  const activationRequirements = star.activationRequirements ?? star.requirements;
  const unmetActivationRequirements = evaluateRequirements(activationRequirements, context, {
    includePerkCost: false,
    includeEvidence: false
  });
  const active = unmetActivationRequirements.length === 0;

  if (!activationRequirements || Object.keys(activationRequirements).length === 0) {
    return {
      state: activeStarIds.has(star.id) ? 'ACTIVE' : 'OWNED',
      owned: true,
      active: activeStarIds.has(star.id),
      unmetUnlockRequirements: [],
      unmetActivationRequirements: []
    };
  }

  return {
    state: active ? 'ACTIVE' : 'PAUSED',
    owned: true,
    active,
    unmetUnlockRequirements: [],
    unmetActivationRequirements
  };
}

export interface GamePassportExport {
  userId: string;
  characterId: string;
  displayName: string;
  level: number;
  sharedStats: Record<StatType, { abilityNow: number; permanentStatPoints: number }>;
  sharedStars: string[];
  sharedPerks: string[];
  permissions: string[];
  exportedAt: string;
}

export function createReadOnlyGamePassportExport(
  character: UserCharacter,
  permissions: string[] = []
): GamePassportExport {
  const sharedStats = STAT_TYPES.reduce((stats, type) => {
    const track = character.stats[type] ?? createStatTrack(type);
    stats[type] = {
      abilityNow: clampAbilityNow(track.abilityNow),
      permanentStatPoints: Math.max(0, Math.floor(track.permanentStatPoints || 0))
    };
    return stats;
  }, {} as GamePassportExport['sharedStats']);

  return {
    userId: character.userId,
    characterId: character.id,
    displayName: character.displayName,
    level: deriveCharacterLevel(character.totalStatPoints),
    sharedStats,
    sharedStars: [...character.ownedStarIds],
    sharedPerks: [...character.activeStarIds],
    permissions: [...permissions],
    exportedAt: new Date().toISOString()
  };
}

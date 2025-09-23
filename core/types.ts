export type StatKey = 'pwr' | 'acc' | 'grt' | 'cog' | 'pln' | 'soc';

export interface AbilityNow {
  stats: Record<StatKey, number>;
  confidence: Record<StatKey, number>;
  total: number; // 0..600
  level0to100: number; // 0..100
  progress01: number; // 0..1
}

export interface LegacyPerStat {
  counter: number; // 0..1000 before rollover
  level: number; // >= 0
  totalEarned: number; // lifetime points contributed to this stat
}

export interface LegacyState {
  stats: Record<StatKey, LegacyPerStat>;
  totalLevels: number;
  totalEarned: number;
  perkPoints: number;
}

export interface DynamicsParams {
  tau0: number;
  alpha: number;
  tl0: number;
  beta: number;
  eta0: number;
  gamma: number;
  sfloor: number;
}

export type UserDynamics = Record<StatKey, DynamicsParams>;

export type EvidenceSource =
  | 'camera'
  | 'wearable'
  | 'minitest'
  | 'speech'
  | 'social'
  | 'calendar'
  | 'fit';

export interface EvidenceToken {
  id: string;
  source: EvidenceSource;
  startedAt: string;
  endedAt: string;
  quality: number;
  payloadRef: string;
  statHint?: StatKey;
}

export interface TickInput {
  trainingLoad: Partial<Record<StatKey, number>>;
  tokens: EvidenceToken[];
  injuryOrIllness?: boolean;
}

export interface TickResult {
  ability: AbilityNow;
  legacy: LegacyState;
  updatedStats: Record<StatKey, number>;
  updatedConfidence: Record<StatKey, number>;
}

export interface RecalibrationResult {
  dynamics: UserDynamics;
  ability: AbilityNow;
  notes: string[];
}

export interface DynamicsObservation {
  stat: StatKey;
  averageLoad: number;
  maintenanceGuess: number;
  observedDelta: number;
  days: number;
  quality: number;
}

export interface RecalibrationComputationInput {
  previousAbility: AbilityNow;
  recentAbility: AbilityNow;
  observations: DynamicsObservation[];
  prevDynamics: UserDynamics;
}

export interface PerkDefinition {
  id: string;
  name: string;
  gates: Partial<Record<StatKey, number>>;
}

export interface PerkState {
  perk: PerkDefinition;
  owned: boolean;
  active: boolean;
}

export interface PerkAssignmentResult {
  ok: boolean;
  perkPointsLeft: number;
  state: PerkState[];
}

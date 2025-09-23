export type StatKey = 'pwr' | 'acc' | 'grt' | 'cog' | 'pln' | 'soc';

export interface StatSnapshot {
  value: number; // 1..20
  confidence: number; // 0..1
}

export interface AbilityNow {
  stats: Record<StatKey, StatSnapshot>;
  total: number; // 6..120
  level0to100: number; // 0..100
  progress01: number; // 0..1
}

export interface LegacyState {
  score: number;
  level: number;
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
  updatedStats: Record<StatKey, StatSnapshot>;
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

export interface LegacyComponentBreakdown {
  auc: number;
  work: number;
  pr: number;
  consistency: number;
  badges: number;
}

export interface LegacyComputationInput {
  abilityHistory: AbilityNow[];
  trainingLoad: Partial<Record<StatKey, number>>[];
  tokens: EvidenceToken[];
  prEvents: { stat: StatKey; timestamp: string; weight?: number }[];
  streaks: { stat: StatKey; days: number }[];
  badges: { stat: StatKey; value: number }[];
  previousScore: number;
  previousLevel: number;
}

export interface LegacyComputationResult {
  state: LegacyState;
  components: LegacyComponentBreakdown;
  perStatShares: Record<StatKey, number>;
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

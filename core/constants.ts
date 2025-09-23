import { UserDynamics } from './types';

export const STAT_KEYS = ['pwr', 'acc', 'grt', 'cog', 'pln', 'soc'] as const;
export const MIN_STAT = 1;
export const MAX_STAT = 20;
export const MIN_TOTAL = 6;
export const MAX_TOTAL = 120;
export const DEFAULT_HALF_LIFE_SAFEGUARD = 180; // days

export const DEFAULT_DYNAMICS: UserDynamics = {
  pwr: { tau0: 28, alpha: 0.08, tl0: 1.0, beta: 0.5, eta0: 1.0, gamma: 0.1, sfloor: 8 },
  acc: { tau0: 21, alpha: 0.07, tl0: 1.0, beta: 0.4, eta0: 0.95, gamma: 0.08, sfloor: 8 },
  grt: { tau0: 35, alpha: 0.06, tl0: 1.0, beta: 0.5, eta0: 0.85, gamma: 0.08, sfloor: 8 },
  cog: { tau0: 60, alpha: 0.05, tl0: 1.0, beta: 0.3, eta0: 0.8, gamma: 0.06, sfloor: 8 },
  pln: { tau0: 45, alpha: 0.05, tl0: 1.0, beta: 0.3, eta0: 0.85, gamma: 0.06, sfloor: 8 },
  soc: { tau0: 30, alpha: 0.07, tl0: 1.0, beta: 0.4, eta0: 0.9, gamma: 0.08, sfloor: 8 }
};

export const LEGACY_WEIGHTS = {
  auc: 0.4,
  work: 0.25,
  pr: 0.15,
  consistency: 0.1,
  badges: 0.1
} as const;

export const LEGACY_LEVEL_ALPHA = 4.5;
export const LEGACY_LEVEL_BASE = 1000;

export const LEGACY_DECAY_FLOOR = 0;

export const CONFIDENCE_DECAY = 0.92;

export const QUALITY_CONFIDENCE_WEIGHT = 0.6;

import { DEFAULT_DYNAMICS } from '../core/constants';
import { tickStats, TickComputationState, recalibrateDynamics } from '../core/dynamics';
import { makeAbilityFromValues } from '../core/ability';
import { RecalibrationComputationInput } from '../core/types';

function makeStats(value: number): TickComputationState['stats'] {
  return {
    pwr: { value, confidence: 0.8 },
    acc: { value, confidence: 0.8 },
    grt: { value, confidence: 0.8 },
    cog: { value, confidence: 0.8 },
    pln: { value, confidence: 0.8 },
    soc: { value, confidence: 0.8 }
  };
}

describe('tickStats decay and maintenance behaviour', () => {
  it('higher stat loses more than lower stat when idle', () => {
    const highState: TickComputationState = {
      stats: makeStats(16),
      dynamics: DEFAULT_DYNAMICS,
      legacyScore: 0
    };
    const lowState: TickComputationState = {
      stats: makeStats(8),
      dynamics: DEFAULT_DYNAMICS,
      legacyScore: 0
    };

    let high = highState;
    let low = lowState;
    for (let day = 0; day < 7; day += 1) {
      high = {
        ...high,
        stats: tickStats(high, { trainingLoad: {}, tokens: [] }).updatedStats
      };
      low = {
        ...low,
        stats: tickStats(low, { trainingLoad: {}, tokens: [] }).updatedStats
      };
    }

    const highLoss = 16 - high.stats.pwr.value;
    const lowLoss = 8 - low.stats.pwr.value;

    expect(highLoss).toBeGreaterThan(lowLoss);
  });

  it('maintenance load keeps stats stable while extra load nudges upward', () => {
    const params = DEFAULT_DYNAMICS.pwr;
    const baseValue = 12;
    const maintenance = params.tl0 + params.beta * Math.max(0, baseValue - params.sfloor);

    let maintenanceState: TickComputationState = {
      stats: makeStats(baseValue),
      dynamics: DEFAULT_DYNAMICS,
      legacyScore: 0
    };
    let overloadState: TickComputationState = {
      stats: makeStats(baseValue),
      dynamics: DEFAULT_DYNAMICS,
      legacyScore: 0
    };

    for (let day = 0; day < 7; day += 1) {
      maintenanceState = {
        ...maintenanceState,
        stats: tickStats(maintenanceState, {
          trainingLoad: { pwr: maintenance },
          tokens: []
        }).updatedStats
      };
      overloadState = {
        ...overloadState,
        stats: tickStats(overloadState, {
          trainingLoad: { pwr: maintenance * 1.5 },
          tokens: []
        }).updatedStats
      };
    }

    const maintenanceDelta = maintenanceState.stats.pwr.value - baseValue;
    const overloadDelta = overloadState.stats.pwr.value - baseValue;

    expect(Math.abs(maintenanceDelta)).toBeLessThan(0.6);
    expect(overloadDelta).toBeGreaterThan(0);
  });
});

describe('recalibrateDynamics', () => {
  it('nudges eta0 and tau0 toward observed behaviour', () => {
    const previousAbility = makeAbilityFromValues({ pwr: 12, acc: 12, grt: 12, cog: 12, pln: 12, soc: 12 });
    const recentAbility = makeAbilityFromValues({ pwr: 13, acc: 12, grt: 12, cog: 12, pln: 12, soc: 12 });

    const input: RecalibrationComputationInput = {
      previousAbility,
      recentAbility,
      prevDynamics: DEFAULT_DYNAMICS,
      observations: [
        {
          stat: 'pwr',
          averageLoad: 8,
          maintenanceGuess: 6,
          observedDelta: 1,
          days: 14,
          quality: 0.8
        },
        {
          stat: 'acc',
          averageLoad: 1,
          maintenanceGuess: 3,
          observedDelta: -1,
          days: 14,
          quality: 0.7
        }
      ]
    };

    const result = recalibrateDynamics(input);
    expect(result.dynamics.pwr.eta0).toBeLessThanOrEqual(2.5);
    expect(result.dynamics.pwr.eta0).toBeGreaterThan(DEFAULT_DYNAMICS.pwr.eta0 - 0.01);
    expect(result.dynamics.acc.tau0).toBeLessThanOrEqual(DEFAULT_DYNAMICS.acc.tau0);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});

import { DEFAULT_DYNAMICS } from '../core/constants';
import { tickStats, TickComputationState, recalibrateDynamics } from '../core/dynamics';
import { makeAbilityFromValues } from '../core/ability';
import { RecalibrationComputationInput } from '../core/types';

function makeStats(value: number): TickComputationState['stats'] {
  return {
    pwr: value,
    acc: value,
    grt: value,
    cog: value,
    pln: value,
    soc: value
  };
}

function makeConfidence(value = 0.8): TickComputationState['confidence'] {
  return {
    pwr: value,
    acc: value,
    grt: value,
    cog: value,
    pln: value,
    soc: value
  };
}

describe('tickStats decay and maintenance behaviour', () => {
  it('higher stat loses more than lower stat when idle', () => {
    const highState: TickComputationState = {
      stats: makeStats(80),
      confidence: makeConfidence(),
      dynamics: DEFAULT_DYNAMICS,
      legacyScore: 0
    };
    const lowState: TickComputationState = {
      stats: makeStats(40),
      confidence: makeConfidence(),
      dynamics: DEFAULT_DYNAMICS,
      legacyScore: 0
    };

    let high = highState;
    let low = lowState;
    for (let day = 0; day < 7; day += 1) {
      const highTick = tickStats(high, { trainingLoad: {}, tokens: [] });
      high = {
        ...high,
        stats: highTick.updatedStats,
        confidence: highTick.updatedConfidence
      };
      const lowTick = tickStats(low, { trainingLoad: {}, tokens: [] });
      low = {
        ...low,
        stats: lowTick.updatedStats,
        confidence: lowTick.updatedConfidence
      };
    }

    const highLoss = 80 - high.stats.pwr;
    const lowLoss = 40 - low.stats.pwr;

    expect(highLoss).toBeGreaterThan(lowLoss);
  });

  it('maintenance load keeps stats stable while extra load nudges upward', () => {
    const params = DEFAULT_DYNAMICS.pwr;
    const baseValue = 60;
    const maintenance = params.tl0 + params.beta * Math.max(0, baseValue - params.sfloor);

    let maintenanceState: TickComputationState = {
      stats: makeStats(baseValue),
      confidence: makeConfidence(),
      dynamics: DEFAULT_DYNAMICS,
      legacyScore: 0
    };
    let overloadState: TickComputationState = {
      stats: makeStats(baseValue),
      confidence: makeConfidence(),
      dynamics: DEFAULT_DYNAMICS,
      legacyScore: 0
    };

    for (let day = 0; day < 7; day += 1) {
      const maintenanceTick = tickStats(maintenanceState, {
        trainingLoad: { pwr: maintenance },
        tokens: []
      });
      maintenanceState = {
        ...maintenanceState,
        stats: maintenanceTick.updatedStats,
        confidence: maintenanceTick.updatedConfidence
      };
      const overloadTick = tickStats(overloadState, {
        trainingLoad: { pwr: maintenance * 1.5 },
        tokens: []
      });
      overloadState = {
        ...overloadState,
        stats: overloadTick.updatedStats,
        confidence: overloadTick.updatedConfidence
      };
    }

    const maintenanceDelta = maintenanceState.stats.pwr - baseValue;
    const overloadDelta = overloadState.stats.pwr - baseValue;

    expect(maintenanceDelta).toBeLessThan(0);
    expect(overloadDelta).toBeLessThan(0);
    expect(Math.abs(overloadDelta)).toBeLessThan(Math.abs(maintenanceDelta));
  });
});

describe('recalibrateDynamics', () => {
  it('nudges eta0 and tau0 toward observed behaviour', () => {
    const previousAbility = makeAbilityFromValues({ pwr: 60, acc: 60, grt: 60, cog: 60, pln: 60, soc: 60 });
    const recentAbility = makeAbilityFromValues({ pwr: 65, acc: 60, grt: 60, cog: 60, pln: 60, soc: 60 });

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
    expect(result.dynamics.pwr.eta0).toBeGreaterThan(DEFAULT_DYNAMICS.pwr.eta0 - 0.2);
    expect(result.dynamics.acc.tau0).toBeLessThanOrEqual(DEFAULT_DYNAMICS.acc.tau0 * 1.2);
    expect(result.notes.length).toBeGreaterThan(0);
  });
});

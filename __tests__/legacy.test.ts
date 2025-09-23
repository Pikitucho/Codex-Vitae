import { makeAbilityFromValues } from '../core/ability';
import {
  addLegacyProgress,
  createEmptyLegacyState,
  LEGACY_ROLLOVER_THRESHOLD,
  normalizeLegacyState
} from '../core/legacy';
import { LegacyState } from '../core/types';

function cloneLegacyState(state: LegacyState): LegacyState {
  return normalizeLegacyState({ ...state, stats: { ...state.stats } });
}

describe('Legacy progression (Acceptance Tests §9.1–§9.4)', () => {
  const baseAbility = makeAbilityFromValues({ pwr: 10, acc: 10, grt: 10, cog: 10, pln: 10, soc: 10 });

  it('§9.1 increments a stat counter without rollover', () => {
    const legacy = createEmptyLegacyState();

    const result = addLegacyProgress({ legacy, ability: baseAbility, stat: 'pwr', amount: 250 });

    expect(result.levelsGained).toBe(0);
    expect(result.legacy.stats.pwr).toEqual({ counter: 250, level: 0, totalEarned: 250 });
    expect(result.legacy.totalEarned).toBe(250);
    expect(result.legacy.totalLevels).toBe(0);
    expect(result.ability).toBe(baseAbility);
    expect(legacy.stats.pwr.counter).toBe(0);
  });

  it('§9.2 rolls over at 1000 and bumps the matching Ability stat', () => {
    const legacy = createEmptyLegacyState();
    legacy.stats.pwr = { counter: 950, level: 1, totalEarned: 1950 };
    const seededLegacy = normalizeLegacyState(legacy);
    const ability = makeAbilityFromValues({ pwr: 15, acc: 11, grt: 11, cog: 11, pln: 11, soc: 11 });

    const result = addLegacyProgress({ legacy: seededLegacy, ability, stat: 'pwr', amount: 75 });

    expect(result.levelsGained).toBe(1);
    expect(result.legacy.stats.pwr).toEqual({ counter: 25, level: 2, totalEarned: 2025 });
    expect(result.legacy.totalLevels).toBe(2);
    expect(result.legacy.totalEarned).toBe(2025);
    expect(result.legacy.perkPoints).toBe(Math.floor(result.legacy.totalLevels / 5));
    expect(result.ability.stats.pwr).toBe(ability.stats.pwr + 1);
    expect(result.ability.total).toBe(ability.total + 1);
  });

  it('§9.3 supports multi-level rollover with carryover preserved', () => {
    const legacy = createEmptyLegacyState();
    legacy.stats.pwr = { counter: LEGACY_ROLLOVER_THRESHOLD - 100, level: 2, totalEarned: 2 * LEGACY_ROLLOVER_THRESHOLD + (LEGACY_ROLLOVER_THRESHOLD - 100) };
    const seededLegacy = normalizeLegacyState(legacy);
    const ability = makeAbilityFromValues({ pwr: 20, acc: 12, grt: 12, cog: 12, pln: 12, soc: 12 });

    const result = addLegacyProgress({ legacy: seededLegacy, ability, stat: 'pwr', amount: 2500 });

    const expectedCounter = (LEGACY_ROLLOVER_THRESHOLD - 100 + 2500) % LEGACY_ROLLOVER_THRESHOLD;
    const expectedLevels = 2 + Math.floor((LEGACY_ROLLOVER_THRESHOLD - 100 + 2500) / LEGACY_ROLLOVER_THRESHOLD);
    const expectedTotalEarned = seededLegacy.stats.pwr.totalEarned + 2500;

    expect(result.levelsGained).toBe(Math.floor((LEGACY_ROLLOVER_THRESHOLD - 100 + 2500) / LEGACY_ROLLOVER_THRESHOLD));
    expect(result.legacy.stats.pwr).toEqual({ counter: expectedCounter, level: expectedLevels, totalEarned: expectedTotalEarned });
    expect(result.legacy.totalLevels).toBe(expectedLevels);
    expect(result.legacy.totalEarned).toBe(expectedTotalEarned);
    expect(result.legacy.perkPoints).toBe(Math.floor(expectedLevels / 5));
    expect(result.ability.stats.pwr).toBe(ability.stats.pwr + result.levelsGained);
  });

  it('§9.4 isolates overflow to the targeted stat and updates atomically', () => {
    const legacy = createEmptyLegacyState();
    legacy.stats.pwr = { counter: 100, level: 0, totalEarned: 100 };
    legacy.stats.acc = { counter: 400, level: 2, totalEarned: 2400 };
    legacy.stats.grt = { counter: 10, level: 1, totalEarned: 1010 };
    const seededLegacy = normalizeLegacyState(legacy);
    const snapshotBefore = cloneLegacyState(seededLegacy);
    const ability = makeAbilityFromValues({ pwr: 12, acc: 13, grt: 14, cog: 10, pln: 10, soc: 10 });

    const result = addLegacyProgress({ legacy: seededLegacy, ability, stat: 'pwr', amount: 1800 });

    expect(result.levelsGained).toBe(Math.floor((100 + 1800) / LEGACY_ROLLOVER_THRESHOLD));
    expect(result.legacy.stats.acc).toEqual(snapshotBefore.stats.acc);
    expect(result.legacy.stats.grt).toEqual(snapshotBefore.stats.grt);
    expect(result.legacy.totalEarned).toBe(snapshotBefore.totalEarned + 1800);
    expect(result.legacy.totalLevels).toBe(snapshotBefore.totalLevels + result.levelsGained);
    expect(result.ability.stats.acc).toBe(ability.stats.acc);
    expect(result.ability.stats.grt).toBe(ability.stats.grt);
    expect(result.ability.stats.pwr).toBe(ability.stats.pwr + result.levelsGained);
    expect(seededLegacy.stats.pwr.counter).toBe(snapshotBefore.stats.pwr.counter);
  });
});

import { makeAbilityFromValues } from '../core/ability';

describe('Ability level mapping', () => {
  it.each([
    [{ pwr: 1, acc: 1, grt: 1, cog: 1, pln: 1, soc: 1 }, 6, 0],
    [{ pwr: 10, acc: 10, grt: 10, cog: 10, pln: 10, soc: 10 }, 60, 47],
    [{ pwr: 15, acc: 15, grt: 15, cog: 15, pln: 15, soc: 15 }, 90, 73],
    [{ pwr: 20, acc: 20, grt: 20, cog: 20, pln: 20, soc: 20 }, 120, 100]
  ])('maps totals to expected 0-100 levels', (values, expectedTotal, expectedLevel) => {
    const ability = makeAbilityFromValues(values);
    expect(ability.total).toBe(expectedTotal);
    expect(ability.level0to100).toBe(expectedLevel);
  });
});

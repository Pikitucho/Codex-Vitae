import { makeAbilityFromValues } from '../core/ability';

describe('Ability level mapping', () => {
  it.each([
    [{ pwr: 0, acc: 0, grt: 0, cog: 0, pln: 0, soc: 0 }, 0, 0],
    [{ pwr: 50, acc: 50, grt: 50, cog: 50, pln: 50, soc: 50 }, 300, 50],
    [{ pwr: 75, acc: 75, grt: 75, cog: 75, pln: 75, soc: 75 }, 450, 75],
    [{ pwr: 100, acc: 100, grt: 100, cog: 100, pln: 100, soc: 100 }, 600, 100]
  ])('maps totals to expected 0-100 levels', (values, expectedTotal, expectedLevel) => {
    const ability = makeAbilityFromValues(values);
    expect(ability.total).toBe(expectedTotal);
    expect(ability.level0to100).toBe(expectedLevel);
  });
});

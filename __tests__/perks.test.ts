import { assignPerk, gatesMet, reconcilePerkActivity, togglePerk } from '../core/perks';
import { PerkDefinition, PerkState } from '../core/types';

describe('perk gating', () => {
  const perk: PerkDefinition = {
    id: 'focus-aura',
    name: 'Focus Aura',
    gates: { acc: 14, cog: 12 }
  };

  it('prevents activation when gates unmet and resumes when met', () => {
    const statsLow = { pwr: 10, acc: 12, grt: 10, cog: 10, pln: 10, soc: 10 };
    const statsHigh = { ...statsLow, acc: 15, cog: 13 };

    let state: PerkState[] = [];
    const assignment = assignPerk(perk, state, 2, statsLow);
    state = assignment.state;
    expect(assignment.ok).toBe(true);
    expect(state[0].active).toBe(false);

    state = togglePerk(perk.id, true, state, statsLow);
    expect(state[0].active).toBe(false);

    state = reconcilePerkActivity(state, statsHigh);
    expect(state[0].active).toBe(true);

    state = reconcilePerkActivity(state, statsLow);
    expect(state[0].active).toBe(false);
  });
});

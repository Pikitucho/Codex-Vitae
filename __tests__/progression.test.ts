import {
  createEmptyPerkCurrency,
  evaluatePerkActivation,
  recomputeAnnualPerkPoint,
  recomputeQuarterlyPerkPoint
} from '../core/legacy';
import { PerkDefinition, PerkState } from '../core/types';

describe('Progression milestone currency recomputation', () => {
  it('awards a quarterly perk point once per quarter when threshold met', () => {
    const activityLog = {
      entries: [
        { date: '2024-04-01' },
        { date: '2024-04-15' },
        { date: '2024-05-20' }
      ]
    };

    let wallet = createEmptyPerkCurrency();
    const first = recomputeQuarterlyPerkPoint(activityLog, wallet, {
      now: new Date('2024-05-30T12:00:00Z'),
      requiredDays: 3
    });

    expect(first.awarded).toBe(true);
    expect(first.uniqueDays).toBe(3);
    expect(first.wallet.perkPoints).toBe(1);
    expect(first.wallet.ledger).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'quarterly:2024-Q2', reason: 'quarterly' })])
    );

    const second = recomputeQuarterlyPerkPoint(activityLog, first.wallet, {
      now: new Date('2024-05-30T12:00:00Z'),
      requiredDays: 3
    });

    expect(second.awarded).toBe(false);
    expect(second.uniqueDays).toBe(3);
    expect(second.wallet.perkPoints).toBe(1);
  });

  it('grants annual perk points based on unique yearly activity and prevents duplicates', () => {
    const activityLog = {
      entries: [
        { date: '2024-01-10' },
        { date: '2024-03-05' },
        { date: '2024-07-19' }
      ]
    };

    let wallet = createEmptyPerkCurrency();
    const first = recomputeAnnualPerkPoint(activityLog, wallet, {
      now: new Date('2024-12-31T08:00:00Z'),
      requiredDays: 3
    });

    expect(first.awarded).toBe(true);
    expect(first.uniqueDays).toBe(3);
    expect(first.wallet.perkPoints).toBe(1);
    expect(first.wallet.ledger).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'annual:2024', reason: 'annual' })])
    );

    const second = recomputeAnnualPerkPoint(activityLog, first.wallet, {
      now: new Date('2024-12-31T08:00:00Z'),
      requiredDays: 3
    });

    expect(second.awarded).toBe(false);
    expect(second.uniqueDays).toBe(3);
    expect(second.wallet.perkPoints).toBe(1);
  });
});

describe('evaluatePerkActivation', () => {
  it('normalizes the perk wallet while reconciling perk activation states', () => {
    const perk: PerkDefinition = { id: 'focus-aura', name: 'Focus Aura', gates: { cog: 12 } };
    const perks: PerkState[] = [{ perk, owned: true, active: false }];
    const stats = { pwr: 10, acc: 11, grt: 9, cog: 13, pln: 8, soc: 7 };

    const evaluation = evaluatePerkActivation(perks, stats, { perkPoints: 2, ledger: [] });

    expect(evaluation.perks[0].active).toBe(true);
    expect(evaluation.wallet.perkPoints).toBe(2);
    expect(evaluation.wallet.ledger).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'migration:legacy-credit:2', points: 2 })])
    );
  });
});

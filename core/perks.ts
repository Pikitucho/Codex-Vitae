import { PerkAssignmentResult, PerkDefinition, PerkState, StatKey } from './types';

export function gatesMet(perk: PerkDefinition, stats: Record<StatKey, number>): boolean {
  for (const [key, value] of Object.entries(perk.gates)) {
    const statKey = key as StatKey;
    if (value === undefined) {
      continue;
    }
    if ((stats[statKey] ?? 0) < value) {
      return false;
    }
  }
  return true;
}

export function assignPerk(
  perk: PerkDefinition,
  current: PerkState[],
  perkPoints: number,
  stats: Record<StatKey, number>
): PerkAssignmentResult {
  const alreadyOwned = current.find(entry => entry.perk.id === perk.id);
  if (alreadyOwned?.owned) {
    return { ok: true, perkPointsLeft: perkPoints, state: current };
  }
  if (perkPoints <= 0) {
    return { ok: false, perkPointsLeft: perkPoints, state: current };
  }

  const meetsGates = gatesMet(perk, stats);
  const nextState: PerkState[] = current.filter(entry => entry.perk.id !== perk.id);
  nextState.push({ perk, owned: true, active: meetsGates });

  return {
    ok: true,
    perkPointsLeft: perkPoints - 1,
    state: nextState
  };
}

export function togglePerk(perkId: string, desiredActive: boolean, current: PerkState[], stats: Record<StatKey, number>): PerkState[] {
  return current.map(entry => {
    if (entry.perk.id !== perkId) {
      return entry;
    }
    if (!entry.owned) {
      return entry;
    }
    const meetsGates = gatesMet(entry.perk, stats);
    return {
      ...entry,
      active: desiredActive && meetsGates
    };
  });
}

export function reconcilePerkActivity(perks: PerkState[], stats: Record<StatKey, number>): PerkState[] {
  return perks.map(entry => {
    if (!entry.owned) {
      return entry;
    }
    const meetsGates = gatesMet(entry.perk, stats);
    if (!meetsGates && entry.active) {
      return { ...entry, active: false };
    }
    if (meetsGates && !entry.active) {
      return { ...entry, active: true };
    }
    return entry;
  });
}

import {
  addLegacyFragments,
  createEmptyStatMap,
  createReadOnlyGamePassportExport,
  createStatTrack,
  deriveCharacterLevel,
  evaluateStarState,
  normalizeStatType,
  StarDefinition,
  UserCharacter
} from '../core/virtualMe';

describe('Virtual Me canonical stat model', () => {
  it('normalizes canonical stat names and legacy full names', () => {
    expect(normalizeStatType('STR')).toBe('STR');
    expect(normalizeStatType('strength')).toBe('STR');
    expect(normalizeStatType('dexterity')).toBe('DEX');
    expect(normalizeStatType('charisma')).toBe('CHA');
    expect(normalizeStatType('unknown')).toBeNull();
  });

  it('rolls 1,000 fragments into permanent stat points without losing legacy', () => {
    const starting = createStatTrack('STR', { fragments: 990, legacyPoints: 990, permanentStatPoints: 2 });
    const result = addLegacyFragments(starting, 25);

    expect(result.statPointsGained).toBe(1);
    expect(result.track.fragments).toBe(15);
    expect(result.track.legacyPoints).toBe(1015);
    expect(result.track.permanentStatPoints).toBe(3);
  });

  it('derives character level from each 10 total permanent stat points', () => {
    expect(deriveCharacterLevel(0)).toBe(1);
    expect(deriveCharacterLevel(9)).toBe(1);
    expect(deriveCharacterLevel(10)).toBe(2);
    expect(deriveCharacterLevel(25)).toBe(3);
  });
});

describe('Virtual Me star state evaluator', () => {
  const star: StarDefinition = {
    id: 'basic-fitness',
    constellationId: 'body.fitness',
    name: 'Basic Fitness',
    description: 'Foundational strength habit.',
    starType: 'MILESTONE',
    requirements: {
      requiredStats: { STR: 40 },
      prerequisiteStarIds: ['warmup'],
      perkPointCost: 1
    }
  };

  it('returns LOCKED when unlock requirements are unmet', () => {
    const evaluation = evaluateStarState(star, {
      abilityNow: { STR: 35 },
      ownedStarIds: ['warmup'],
      availablePerkPoints: 1
    });

    expect(evaluation.state).toBe('LOCKED');
    expect(evaluation.unmetUnlockRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'STAT', stat: 'STR' })])
    );
  });

  it('returns AVAILABLE when requirements are met but the star is not owned', () => {
    const evaluation = evaluateStarState(star, {
      abilityNow: { STR: 41 },
      ownedStarIds: ['warmup'],
      availablePerkPoints: 1
    });

    expect(evaluation.state).toBe('AVAILABLE');
    expect(evaluation.owned).toBe(false);
  });

  it('returns ACTIVE for owned stars that currently satisfy activation requirements', () => {
    const evaluation = evaluateStarState(star, {
      abilityNow: { STR: 41 },
      ownedStarIds: ['warmup', 'basic-fitness'],
      availablePerkPoints: 0
    });

    expect(evaluation.state).toBe('ACTIVE');
    expect(evaluation.owned).toBe(true);
    expect(evaluation.active).toBe(true);
  });

  it('returns PAUSED for owned stars when Ability Now drops below activation requirements', () => {
    const evaluation = evaluateStarState(star, {
      abilityNow: { STR: 20 },
      ownedStarIds: ['warmup', 'basic-fitness'],
      availablePerkPoints: 0
    });

    expect(evaluation.state).toBe('PAUSED');
    expect(evaluation.owned).toBe(true);
    expect(evaluation.active).toBe(false);
    expect(evaluation.unmetActivationRequirements).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'STAT', stat: 'STR' })])
    );
  });

  it('keeps credential stars LOCKED until required evidence is verified', () => {
    const credentialStar: StarDefinition = {
      id: 'bachelors-degree',
      constellationId: 'mind.academics',
      name: 'Bachelors Degree',
      description: 'Verified degree credential.',
      starType: 'CREDENTIAL',
      requirements: {
        requiredStats: { INT: 50 },
        requiredEvidenceTypes: ['degree-document']
      }
    };

    expect(
      evaluateStarState(credentialStar, {
        abilityNow: { INT: 60 },
        verifiedEvidenceTypes: []
      }).state
    ).toBe('LOCKED');

    expect(
      evaluateStarState(credentialStar, {
        abilityNow: { INT: 60 },
        verifiedEvidenceTypes: ['degree-document']
      }).state
    ).toBe('AVAILABLE');
  });

  it('returns OWNED for owned stars with no activation requirements unless explicitly active', () => {
    const passiveStar: StarDefinition = {
      id: 'profile-badge',
      constellationId: 'identity.badges',
      name: 'Profile Badge',
      description: 'A permanent identity marker.',
      starType: 'MILESTONE'
    };

    const evaluation = evaluateStarState(passiveStar, {
      abilityNow: {},
      ownedStarIds: ['profile-badge']
    });

    expect(evaluation.state).toBe('OWNED');
    expect(evaluation.owned).toBe(true);
    expect(evaluation.active).toBe(false);
  });
});

describe('Game Passport export', () => {
  it('creates a read-only passport export from character state', () => {
    const stats = createEmptyStatMap(10);
    stats.STR = createStatTrack('STR', { abilityNow: 55, permanentStatPoints: 4 });
    const character: UserCharacter = {
      id: 'character-1',
      userId: 'user-1',
      displayName: 'Ezio Tester',
      level: 1,
      totalStatPoints: 12,
      stats,
      perkPoints: 2,
      ownedStarIds: ['basic-fitness'],
      activeStarIds: ['basic-fitness'],
      verifiedCredentialStarIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z'
    };

    const passport = createReadOnlyGamePassportExport(character, ['stats:read', 'stars:read']);

    expect(passport.userId).toBe('user-1');
    expect(passport.characterId).toBe('character-1');
    expect(passport.level).toBe(2);
    expect(passport.sharedStats.STR).toEqual({ abilityNow: 55, permanentStatPoints: 4 });
    expect(passport.sharedStars).toEqual(['basic-fitness']);
    expect(passport.sharedPerks).toEqual(['basic-fitness']);
    expect(passport.permissions).toEqual(['stats:read', 'stars:read']);
  });
});

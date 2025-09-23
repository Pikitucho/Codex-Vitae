// js/skill-tree-data.js

const DEFAULT_LAYOUT = {
    galaxies: {
        radius: 920,
        vertical: 72,
        jitter: 64,
        radialJitter: 140,
        method: 'grid',
        verticalFrequency: 1.25,
        verticalJitter: 26
    },
    constellations: {
        radius: 360,
        vertical: 46,
        jitter: 28,
        radialJitter: 80,
        method: 'spiral',
        verticalFrequency: 2.4,
        verticalJitter: 16
    },
    starSystems: {
        radius: 110,
        vertical: 28,
        jitter: 16,
        radialJitter: 26,
        method: 'spiral',
        verticalFrequency: 2.8,
        verticalJitter: 8
    },
    stars: {
        radius: 32,
        vertical: 12,
        jitter: 8,
        radialJitter: 10,
        method: 'spiral',
        verticalFrequency: 3.8,
        verticalJitter: 5
    }
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function hashSeed(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value >>> 0;
    }
    if (typeof value !== 'string') {
        return 0;
    }
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) >>> 0;
    }
    return hash >>> 0;
}

function createRandomGenerator(seedValue) {
    let seed = hashSeed(seedValue) >>> 0;
    return function nextRandom() {
        seed = (seed + 0x6d2b79f5) >>> 0;
        let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function mergeLayout(base, overrides = {}) {
    const merged = {};
    for (const key of Object.keys(base)) {
        merged[key] = { ...base[key], ...(overrides[key] || {}) };
    }
    return merged;
}

function buildLayoutOptions(entry, seed) {
    const safeEntry = entry && typeof entry === 'object' ? entry : {};
    return {
        seed,
        method: safeEntry.method,
        jitter: safeEntry.jitter,
        radialJitter: safeEntry.radialJitter,
        verticalFrequency: safeEntry.verticalFrequency,
        verticalJitter: safeEntry.verticalJitter
    };
}

function createCircularPosition(index, total, radius, verticalAmplitude = 0, options = {}) {
    const safeTotal = Math.max(total || 0, 1);
    const config = options && typeof options === 'object' ? options : {};
    const method = config.method === 'spiral'
        ? 'spiral'
        : config.method === 'grid'
            ? 'grid'
            : 'ring';
    const seedInput = config.seed !== undefined ? config.seed : index;
    const rng = createRandomGenerator(seedInput);

    const normalizedIndex = safeTotal > 1 ? index / Math.max(safeTotal - 1, 1) : 0.5;
    const radialJitter = Number.isFinite(config.radialJitter) ? config.radialJitter : 0;
    const jitter = Number.isFinite(config.jitter) ? config.jitter : 0;
    const verticalJitter = Number.isFinite(config.verticalJitter) ? config.verticalJitter : (jitter * 0.5);
    const verticalFrequency = Number.isFinite(config.verticalFrequency) ? config.verticalFrequency : 2;

    if (method === 'grid') {
        const columns = Math.ceil(Math.sqrt(safeTotal));
        const rows = Math.ceil(safeTotal / columns);
        const columnIndex = index % columns;
        const rowIndex = Math.floor(index / columns);
        const centerColumn = (columns - 1) / 2;
        const centerRow = (rows - 1) / 2;
        const xSpacing = columns > 1 ? (radius * 2) / (columns - 1) : 0;
        const zSpacing = rows > 1 ? (radius * 2) / (rows - 1) : 0;

        let x = columns > 1 ? (columnIndex - centerColumn) * xSpacing : 0;
        let z = rows > 1 ? (rowIndex - centerRow) * zSpacing : 0;

        const jitterAngle = rng() * Math.PI * 2;
        if (radialJitter > 0) {
            const radialOffset = rng() * radialJitter;
            x += Math.cos(jitterAngle) * radialOffset;
            z += Math.sin(jitterAngle) * radialOffset;
        }

        if (jitter > 0) {
            x += (rng() - 0.5) * 2 * jitter;
            z += (rng() - 0.5) * 2 * jitter;
        }

        const phase = safeTotal > 0 ? (index / safeTotal) * Math.PI * 2 : 0;
        const baseY = verticalAmplitude ? Math.sin(phase * verticalFrequency) * verticalAmplitude : 0;
        const y = baseY + (rng() - 0.5) * 2 * verticalJitter;

        return { x, y, z };
    }

    const baseAngle = method === 'spiral'
        ? index * GOLDEN_ANGLE
        : (index % safeTotal) / safeTotal * Math.PI * 2;

    let distance = radius;
    if (method === 'spiral') {
        distance = radius * Math.sqrt(Math.max(0, Math.min(1, normalizedIndex)));
    }

    if (radialJitter > 0) {
        distance += (rng() - 0.5) * 2 * radialJitter;
    }

    const x = Math.cos(baseAngle) * distance + (rng() - 0.5) * 2 * jitter;
    const z = Math.sin(baseAngle) * distance + (rng() - 0.5) * 2 * jitter;
    const baseY = verticalAmplitude ? Math.sin(baseAngle * verticalFrequency) * verticalAmplitude : 0;
    const y = baseY + (rng() - 0.5) * 2 * verticalJitter;

    return { x, y, z };
}

function toFiniteNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
}

function ensureVector3(position, fallback = { x: 0, y: 0, z: 0 }) {
    const base = position && typeof position === 'object' ? position : {};
    const safeFallback = fallback && typeof fallback === 'object' ? fallback : { x: 0, y: 0, z: 0 };
    return {
        x: toFiniteNumber(base.x, toFiniteNumber(safeFallback.x, 0)),
        y: toFiniteNumber(base.y, toFiniteNumber(safeFallback.y, 0)),
        z: toFiniteNumber(base.z, toFiniteNumber(safeFallback.z, 0))
    };
}

function applyPosition(entity, fallback, force = false) {
    if (!entity || typeof entity !== 'object') {
        return ensureVector3(null, fallback);
    }
    if (force) {
        entity.position = ensureVector3(fallback, fallback);
        return entity.position;
    }
    entity.position = ensureVector3(entity.position, fallback);
    return entity.position;
}

function migrateConstellation(constellationName, source) {
    const base = source && typeof source === 'object' ? { ...source } : {};
    const existingStarSystems = base.starSystems && typeof base.starSystems === 'object'
        ? base.starSystems
        : null;

    if (existingStarSystems) {
        const clonedSystems = {};
        for (const [systemName, systemData] of Object.entries(existingStarSystems)) {
            const normalizedSystem = systemData && typeof systemData === 'object' ? { ...systemData } : {};
            normalizedSystem.stars = normalizedSystem.stars && typeof normalizedSystem.stars === 'object'
                ? { ...normalizedSystem.stars }
                : {};
            clonedSystems[systemName] = normalizedSystem;
        }
        base.starSystems = clonedSystems;
    } else {
        const stars = base.stars && typeof base.stars === 'object' ? base.stars : {};
        const hasStars = Object.keys(stars).length > 0;
        if (hasStars) {
            const systemName = `${constellationName || 'Constellation'} Prime`;
            base.starSystems = {
                [systemName]: {
                    type: 'starSystem',
                    stars: { ...stars }
                }
            };
        } else {
            base.starSystems = {};
        }
    }

    delete base.stars;
    return base;
}

function normalizeSkillTreeStructure(tree, options = {}) {
    const {
        clone = false,
        layout: layoutOverrides = {},
        forceLayout = false
    } = options;

    const layout = mergeLayout(DEFAULT_LAYOUT, layoutOverrides);
    const source = tree && typeof tree === 'object' ? tree : {};
    const root = clone ? JSON.parse(JSON.stringify(source)) : source;

    const galaxyEntries = Object.entries(root);
    galaxyEntries.forEach(([galaxyName, galaxyData], gIndex) => {
        const normalizedGalaxy = galaxyData && typeof galaxyData === 'object' ? { ...galaxyData } : {};
        normalizedGalaxy.type = normalizedGalaxy.type || 'galaxy';
        applyPosition(
            normalizedGalaxy,
            createCircularPosition(
                gIndex,
                galaxyEntries.length,
                layout.galaxies.radius,
                layout.galaxies.vertical,
                buildLayoutOptions(layout.galaxies, `${galaxyName || 'galaxy'}-${gIndex}`)
            ),
            forceLayout
        );

        const rawConstellations = normalizedGalaxy.constellations && typeof normalizedGalaxy.constellations === 'object'
            ? normalizedGalaxy.constellations
            : {};
        const constellationEntries = Object.entries(rawConstellations);
        const normalizedConstellations = {};

        constellationEntries.forEach(([constellationName, rawConstellation], cIndex) => {
            const migratedConstellation = migrateConstellation(constellationName, rawConstellation);
            migratedConstellation.type = migratedConstellation.type || 'constellation';
            applyPosition(
                migratedConstellation,
                createCircularPosition(
                    cIndex,
                    constellationEntries.length,
                    layout.constellations.radius,
                    layout.constellations.vertical,
                    buildLayoutOptions(layout.constellations, `${galaxyName || 'galaxy'}|${constellationName || 'constellation'}-${cIndex}`)
                ),
                forceLayout
            );

            const rawStarSystems = migratedConstellation.starSystems && typeof migratedConstellation.starSystems === 'object'
                ? migratedConstellation.starSystems
                : {};
            const systemEntries = Object.entries(rawStarSystems);
            const normalizedStarSystems = {};

            systemEntries.forEach(([systemName, rawSystem], sIndex) => {
                const systemData = rawSystem && typeof rawSystem === 'object' ? { ...rawSystem } : {};
                systemData.type = systemData.type || 'starSystem';
                applyPosition(
                    systemData,
                    createCircularPosition(
                        sIndex,
                        systemEntries.length,
                        layout.starSystems.radius,
                        layout.starSystems.vertical,
                        buildLayoutOptions(layout.starSystems, `${galaxyName || 'galaxy'}|${constellationName || 'constellation'}|${systemName || 'system'}-${sIndex}`)
                    ),
                    forceLayout
                );

                const rawStars = systemData.stars && typeof systemData.stars === 'object' ? systemData.stars : {};
                const starEntries = Object.entries(rawStars);
                const normalizedStars = {};

                starEntries.forEach(([starName, rawStar], starIndex) => {
                    const starData = rawStar && typeof rawStar === 'object' ? { ...rawStar } : {};
                    starData.type = starData.type || 'star';
                    applyPosition(
                        starData,
                        createCircularPosition(
                            starIndex,
                            starEntries.length,
                            layout.stars.radius,
                            layout.stars.vertical,
                            buildLayoutOptions(layout.stars, `${galaxyName || 'galaxy'}|${constellationName || 'constellation'}|${systemName || 'system'}|${starName || 'star'}-${starIndex}`)
                        ),
                        forceLayout
                    );
                    normalizedStars[starName] = starData;
                });

                systemData.stars = normalizedStars;
                normalizedStarSystems[systemName] = systemData;
            });

            migratedConstellation.starSystems = normalizedStarSystems;
            normalizedConstellations[constellationName] = migratedConstellation;
        });

        normalizedGalaxy.constellations = normalizedConstellations;
        root[galaxyName] = normalizedGalaxy;
    });

    return root;
}

function generateProceduralLayout(tree, options = {}) {
    const {
        clone = true,
        forceLayout = false,
        layout = {}
    } = options;

    return normalizeSkillTreeStructure(tree, {
        clone,
        forceLayout,
        layout
    });
}

function getConstellationStarSystems(constellationData, constellationName = '') {
    if (!constellationData || typeof constellationData !== 'object') {
        return {};
    }

    if (constellationData.starSystems && typeof constellationData.starSystems === 'object' && Object.keys(constellationData.starSystems).length > 0) {
        return constellationData.starSystems;
    }

    if (constellationData.stars && typeof constellationData.stars === 'object') {
        const systemName = `${constellationName || 'Constellation'} Prime`;
        return {
            [systemName]: {
                type: 'starSystem',
                stars: { ...constellationData.stars }
            }
        };
    }

    return {};
}

function buildStarMapFromSystems(starSystems) {
    const map = {};
    for (const systemData of Object.values(starSystems || {})) {
        if (!systemData || typeof systemData !== 'object') {
            continue;
        }
        const stars = systemData.stars && typeof systemData.stars === 'object' ? systemData.stars : {};
        for (const [starName, starData] of Object.entries(stars)) {
            map[starName] = starData;
        }
    }
    return map;
}

function getConstellationStarsMap(constellationData, constellationName = '') {
    if (!constellationData || typeof constellationData !== 'object') {
        return {};
    }

    const starSystems = getConstellationStarSystems(constellationData, constellationName);
    if (Object.keys(starSystems).length > 0) {
        return buildStarMapFromSystems(starSystems);
    }

    if (constellationData.stars && typeof constellationData.stars === 'object') {
        return { ...constellationData.stars };
    }

    return {};
}

function getConstellationStarEntries(constellationData, constellationName = '') {
    if (!constellationData || typeof constellationData !== 'object') {
        return [];
    }

    const starSystems = getConstellationStarSystems(constellationData, constellationName);
    const entries = [];

    if (Object.keys(starSystems).length > 0) {
        for (const [systemName, systemData] of Object.entries(starSystems)) {
            const stars = systemData && typeof systemData.stars === 'object' ? systemData.stars : {};
            for (const [starName, starData] of Object.entries(stars)) {
                entries.push({
                    starSystemName: systemName,
                    starSystem: systemData,
                    starName,
                    starData
                });
            }
        }
        return entries;
    }

    if (constellationData.stars && typeof constellationData.stars === 'object') {
        for (const [starName, starData] of Object.entries(constellationData.stars)) {
            entries.push({
                starSystemName: null,
                starSystem: null,
                starName,
                starData
            });
        }
    }

    return entries;
}

function hasConstellationStar(constellationData, starName, constellationName = '') {
    if (typeof starName !== 'string' || !starName) {
        return false;
    }

    const stars = getConstellationStarsMap(constellationData, constellationName);
    return Object.prototype.hasOwnProperty.call(stars, starName);
}

function findStarInConstellation(constellationData, starName, constellationName = '') {
    if (!constellationData || typeof starName !== 'string' || !starName) {
        return null;
    }

    const starSystems = getConstellationStarSystems(constellationData, constellationName);
    for (const [systemName, systemData] of Object.entries(starSystems)) {
        const stars = systemData && typeof systemData.stars === 'object' ? systemData.stars : {};
        if (Object.prototype.hasOwnProperty.call(stars, starName)) {
            return {
                starData: stars[starName],
                starSystemName: systemName,
                starSystem: systemData
            };
        }
    }

    if (constellationData.stars && Object.prototype.hasOwnProperty.call(constellationData.stars, starName)) {
        return {
            starData: constellationData.stars[starName],
            starSystemName: null,
            starSystem: null
        };
    }

    return null;
}

function migrateConstellationToStarSystems(constellationName, constellationData, options = {}) {
    const { clone = true, layout, forceLayout = false } = options;
    const wrapper = {
        __temp__: {
            type: 'galaxy',
            constellations: {
                [constellationName]: constellationData
            }
        }
    };

    const normalized = normalizeSkillTreeStructure(wrapper, { clone, layout, forceLayout });
    const migrated = normalized.__temp__ && normalized.__temp__.constellations
        ? normalized.__temp__.constellations[constellationName]
        : { type: 'constellation', starSystems: {} };

    return migrated;
}

const rawSkillTree = {
    'Mind': {
        type: 'galaxy',
        description: 'Skills of logic, learning, and creativity.',
        constellations: {
            'Academics': {
                type: 'constellation',
                starSystems: {
                    'Academics Prime': {
                        type: 'starSystem',
                        stars: {
                            'Active Learner': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 12 }, description: 'A passive bonus to all Stat Fragment gains from Intelligence-based chores.' },
                            'Critical Thinker': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 15 }, description: 'Unlocks the ability to occasionally receive double fragments from a completed task.' },
                            'Polymath': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 20 }, description: 'Reduces the stat requirements for all non-Intelligence perks by 1.' },
                            'Bachelors Degree': { unlock_type: 'credential', type: 'star', requires: { proof: 'Document Upload' }, description: 'Submit a diploma for a Bachelors degree or higher.' }
                        }
                    }
                }
            },
            'Creativity': {
                type: 'constellation',
                starSystems: {
                    'Creativity Prime': {
                        type: 'starSystem',
                        stars: {
                            'Doodler': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 11 }, description: 'A small, consistent bonus to Charisma fragment gains.' },
                            'Storyteller': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 14 }, description: 'Improves outcomes in social interactions.' },
                            'Published Work': { unlock_type: 'credential', type: 'star', requires: { proof: 'URL Link' }, description: 'Provide a link to a published creative work (book, article, portfolio).' }
                        }
                    }
                }
            },
            'Logic & Strategy': {
                type: 'constellation',
                starSystems: {
                    'Logic & Strategy Prime': {
                        type: 'starSystem',
                        stars: {
                            'Problem Solver': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 15 }, description: 'Occasionally, a difficult task will award bonus fragments.' },
                            'Strategic Planner': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 18 }, description: 'Setting and completing a Goal provides a bonus fragment reward.' },
                            'Chess Master': { unlock_type: 'credential', type: 'star', requires: { proof: 'Skill Verification' }, description: 'Achieve a verified rating in a competitive strategy game.' }
                        }
                    }
                }
            },
            'Memory': {
                type: 'constellation',
                starSystems: {
                    'Memory Prime': {
                        type: 'starSystem',
                        stars: {
                            'Method of Loci': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 14 }, description: 'Improves recall, occasionally finding "lost" items in connected games.' },
                            'Eidetic Memory': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 22 }, description: 'Perfect recall of details and conversations.' }
                        }
                    }
                }
            },
            'Linguistics': {
                type: 'constellation',
                starSystems: {
                    'Linguistics Prime': {
                        type: 'starSystem',
                        stars: {
                            'Bilingual': { unlock_type: 'credential', type: 'star', requires: { proof: 'Language Test' }, description: 'Pass a recognized test for fluency in a second language.' },
                            'Polyglot': { unlock_type: 'credential', type: 'star', requires: { proof: 'Language Test' }, description: 'Pass a recognized test for fluency in three or more languages.' }
                        }
                    }
                }
            },
            'Innovation & Design': {
                type: 'constellation',
                starSystems: {
                    'Innovation Prime': {
                        type: 'starSystem',
                        stars: {
                            'Design Thinker': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 16 }, description: 'Unlocks creative problem-solving prompts in planning tools.' },
                            'Prototype Engineer': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 18 }, description: 'Doubles progress recorded during build or experimentation chores.' },
                            'Patent Strategist': { unlock_type: 'credential', type: 'star', requires: { proof: 'Patent Filing' }, description: 'Submit proof of being listed on a filed or granted patent.' }
                        }
                    }
                }
            },
            'Technology & Data': {
                type: 'constellation',
                starSystems: {
                    'Engineering Core': {
                        type: 'starSystem',
                        stars: {
                            'Code Artisan': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 17 }, description: 'Unlocks advanced automation chores with bonus fragment rewards.' },
                            'System Integrator': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 19 }, description: 'Improves reliability of long-running build or deploy tasks.' },
                            'Certified Developer': { unlock_type: 'credential', type: 'star', requires: { proof: 'Certificate Upload' }, description: 'Upload proof of a professional development certification.' }
                        }
                    },
                    'Data Insights': {
                        type: 'starSystem',
                        stars: {
                            'Data Analyst': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 18 }, description: 'Unlocks data review chores that award extra Wisdom fragments.' },
                            'Machine Learning Specialist': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 22 }, description: 'Occasionally doubles rewards from lengthy analysis sessions.' },
                            'Data Steward': { unlock_type: 'credential', type: 'star', requires: { proof: 'Portfolio Link' }, description: 'Provide a portfolio demonstrating responsible data governance.' }
                        }
                    }
                }
            },
            'Research & Insights': {
                type: 'constellation',
                starSystems: {
                    'Research Prime': {
                        type: 'starSystem',
                        stars: {
                            'Field Researcher': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 16 }, description: 'Gain extra insights from logged interviews or observations.' },
                            'White Paper Author': { unlock_type: 'credential', type: 'star', requires: { proof: 'Document Upload' }, description: 'Submit an original research publication or white paper.' },
                            'Grant Winner': { unlock_type: 'credential', type: 'star', requires: { proof: 'Award Verification' }, description: 'Provide proof of a successful grant or research award.' }
                        }
                    }
                }
            },
            'Systems & Optimization': {
                type: 'constellation',
                starSystems: {
                    'Systems Prime': {
                        type: 'starSystem',
                        stars: {
                            'Process Architect': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 15 }, description: 'Unlocks workflow templates that reduce chore setup time.' },
                            'Optimization Specialist': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 18 }, description: 'Provides a chance to reroll low fragment rewards.' },
                            'Continuous Improvement Lead': { unlock_type: 'credential', type: 'star', requires: { proof: 'Case Study Upload' }, description: 'Share a detailed case study demonstrating sustained improvements.' }
                        }
                    }
                }
            }
        }
    },
    'Body': {
        type: 'galaxy',
        description: 'Skills of strength, endurance, and physical prowess.',
        constellations: {
            'Fitness': {
                type: 'constellation',
                starSystems: {
                    'Fitness Prime': {
                        type: 'starSystem',
                        stars: {
                            'Basic Fitness': { unlock_type: 'perk', type: 'star', requires: { stat: 'strength', value: 12 }, description: 'Grants a small bonus to Constitution fragment gains.' },
                            'Athlete': { unlock_type: 'perk', type: 'star', requires: { stat: 'strength', value: 18 }, description: 'Unlocks advanced physical activities in other connected games.' },
                            'Run a Marathon': { unlock_type: 'credential', type: 'star', requires: { proof: 'Event Verification' }, description: 'Provide proof of completing a marathon or other major endurance event.' }
                        }
                    }
                }
            },
            'Resilience': {
                type: 'constellation',
                starSystems: {
                    'Resilience Prime': {
                        type: 'starSystem',
                        stars: {
                            'Toughness': { unlock_type: 'perk', type: 'star', requires: { stat: 'constitution', value: 14 }, description: 'Monthly Milestone requires one less day to complete (24 instead of 25).' },
                            'Iron Will': { unlock_type: 'perk', type: 'star', requires: { stat: 'constitution', value: 20 }, description: 'Provides a chance to maintain a weekly streak even if you miss one day.' }
                        }
                    }
                }
            },
            'Craftsmanship': {
                type: 'constellation',
                starSystems: {
                    'Craftsmanship Prime': {
                        type: 'starSystem',
                        stars: {
                            'Handyman': { unlock_type: 'perk', type: 'star', requires: { stat: 'dexterity', value: 12 }, description: 'Grants a small bonus to Dexterity fragment gains.' },
                            'Artisan': { unlock_type: 'perk', type: 'star', requires: { stat: 'dexterity', value: 16 }, description: 'Unlocks the ability to craft higher quality items in connected games.' },
                            'Masterwork': { unlock_type: 'credential', type: 'star', requires: { proof: 'Image Upload' }, description: 'Submit photos of a complex, hand-made project (e.g., furniture, clothing).' }
                        }
                    }
                }
            },
            'Coordination': {
                type: 'constellation',
                starSystems: {
                    'Coordination Prime': {
                        type: 'starSystem',
                        stars: {
                            'Ambidextrous': { unlock_type: 'perk', type: 'star', requires: { stat: 'dexterity', value: 18 }, description: 'Removes off-hand penalties in connected games.' },
                            'Sleight of Hand': { unlock_type: 'perk', type: 'star', requires: { stat: 'dexterity', value: 15 }, description: 'Increases chance of success on fine motor skill tasks.' },
                            'Dancer': { unlock_type: 'credential', type: 'star', requires: { proof: 'Video Upload' }, description: 'Demonstrate proficiency in a recognized form of dance.' }
                        }
                    }
                }
            },
            'Survival': {
                type: 'constellation',
                starSystems: {
                    'Survival Prime': {
                        type: 'starSystem',
                        stars: {
                            'Forager': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 13 }, description: 'Ability to identify useful plants and materials.' },
                            'First Aid Certified': { unlock_type: 'credential', type: 'star', requires: { proof: 'Certificate Upload' }, description: 'Upload a valid First Aid/CPR certification.' }
                        }
                    }
                }
            },
            'Nutrition & Wellness': {
                type: 'constellation',
                starSystems: {
                    'Nutrition Prime': {
                        type: 'starSystem',
                        stars: {
                            'Meal Planner': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 13 }, description: 'Log balanced meal plans to gain extra Constitution fragments.' },
                            'Macro Strategist': { unlock_type: 'perk', type: 'star', requires: { stat: 'constitution', value: 16 }, description: 'Boosts recovery bonuses from endurance-focused chores.' },
                            'Certified Nutritionist': { unlock_type: 'credential', type: 'star', requires: { proof: 'License Upload' }, description: 'Provide a copy of an accredited nutrition or dietetics license.' }
                        }
                    }
                }
            },
            'Combat Arts': {
                type: 'constellation',
                starSystems: {
                    'Combat Arts Prime': {
                        type: 'starSystem',
                        stars: {
                            'Martial Artist': { unlock_type: 'perk', type: 'star', requires: { stat: 'strength', value: 16 }, description: 'Unlocks combo training chores with improved fragment rewards.' },
                            'Weapon Specialist': { unlock_type: 'perk', type: 'star', requires: { stat: 'dexterity', value: 17 }, description: 'Provides bonus progress on precision or sparring activities.' },
                            'Black Belt': { unlock_type: 'credential', type: 'star', requires: { proof: 'Rank Verification' }, description: 'Submit documentation of achieving an advanced martial arts rank.' }
                        }
                    }
                }
            },
            'Outdoor Exploration': {
                type: 'constellation',
                starSystems: {
                    'Exploration Prime': {
                        type: 'starSystem',
                        stars: {
                            'Trailblazer': { unlock_type: 'perk', type: 'star', requires: { stat: 'constitution', value: 15 }, description: 'Earn extra rewards for logging long-distance hikes.' },
                            'Mountaineer': { unlock_type: 'credential', type: 'star', requires: { proof: 'Summit Log' }, description: 'Provide proof of summiting a notable peak or expedition.' },
                            'Wilderness Guide': { unlock_type: 'credential', type: 'star', requires: { proof: 'Certification Upload' }, description: 'Upload proof of a certified outdoor or wilderness guide credential.' }
                        }
                    }
                }
            },
            'Recovery & Mobility': {
                type: 'constellation',
                starSystems: {
                    'Recovery Prime': {
                        type: 'starSystem',
                        stars: {
                            'Stretching Guru': { unlock_type: 'perk', type: 'star', requires: { stat: 'dexterity', value: 14 }, description: 'Reduces fatigue penalties after intense physical chores.' },
                            'Rehab Specialist': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 15 }, description: 'Unlocks targeted recovery plans with bonus healing progress.' },
                            'Therapeutic Coach': { unlock_type: 'credential', type: 'star', requires: { proof: 'Certification Upload' }, description: 'Provide proof of a physical therapy or mobility coaching certification.' }
                        }
                    }
                }
            }
        }
    },
    'Soul': {
        type: 'galaxy',
        description: 'Skills of discipline, charisma, and inner strength.',
        constellations: {
            'Discipline': {
                type: 'constellation',
                starSystems: {
                    'Discipline Prime': {
                        type: 'starSystem',
                        stars: {
                            'Early Riser': { unlock_type: 'perk', type: 'star', requires: { stat: 'constitution', value: 12 }, description: 'Gain bonus fragments for the first chore completed each day.' },
                            'Focused Mind': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 15 }, description: 'Doubles the fragments gained from "Reflection" or "Study" chores.' },
                            'Unwavering': { unlock_type: 'perk', type: 'star', requires: { stat: 'constitution', value: 18 }, description: 'High resistance to abandoning long-term goals.' }
                        }
                    }
                }
            },
            'Leadership': {
                type: 'constellation',
                starSystems: {
                    'Leadership Prime': {
                        type: 'starSystem',
                        stars: {
                            'Persuasion': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 15 }, description: 'Unlocks new dialogue options in connected games.' },
                            'Inspirational': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 20 }, description: 'Provides a small bonus to all fragment gains for your party in a connected game.' }
                        }
                    }
                }
            },
            'Finance': {
                type: 'constellation',
                starSystems: {
                    'Finance Prime': {
                        type: 'starSystem',
                        stars: {
                            'Budgeter': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 13 }, description: 'Unlocks a "Wealth" tracker on your main dashboard.' },
                            'Investor': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 16 }, description: 'Unlocks passive "investment" activities that can be logged.' },
                            'Debt-Free': { unlock_type: 'credential', type: 'star', requires: { proof: 'Verification' }, description: 'Achieve and verify a state of being free from non-mortgage debt.' }
                        }
                    }
                }
            },
            'Mindfulness': {
                type: 'constellation',
                starSystems: {
                    'Mindfulness Prime': {
                        type: 'starSystem',
                        stars: {
                            'Meditator': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 14 }, description: 'Grants a small bonus to Wisdom fragment gains.' },
                            'Patient': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 17 }, description: 'Reduces the chance of negative outcomes from rushed decisions.' }
                        }
                    }
                }
            },
            'Artistry': {
                type: 'constellation',
                starSystems: {
                    'Artistry Prime': {
                        type: 'starSystem',
                        stars: {
                            'Musician': { unlock_type: 'credential', type: 'star', requires: { proof: 'Video Upload' }, description: 'Demonstrate proficiency with a musical instrument.' },
                            'Painter': { unlock_type: 'credential', type: 'star', requires: { proof: 'Image Upload' }, description: 'Submit a portfolio of original artwork.' }
                        }
                    }
                }
            },
            'Emotional Intelligence': {
                type: 'constellation',
                starSystems: {
                    'Empathy Prime': {
                        type: 'starSystem',
                        stars: {
                            'Empath': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 15 }, description: 'Provides bonus rapport when supporting allies in connected games.' },
                            'Conflict Mediator': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 18 }, description: 'Unlocks diplomatic dialogue options during tense encounters.' },
                            'Emotional Strategist': { unlock_type: 'credential', type: 'star', requires: { proof: 'Certification Upload' }, description: 'Submit proof of advanced emotional intelligence or coaching training.' }
                        }
                    }
                }
            },
            'Spiritual Journey': {
                type: 'constellation',
                starSystems: {
                    'Spiritual Prime': {
                        type: 'starSystem',
                        stars: {
                            'Pilgrim': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 14 }, description: 'Gain additional insight fragments from reflective journaling chores.' },
                            'Retreat Leader': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 16 }, description: 'Improves morale rewards for group wellness activities.' },
                            'Community Chaplain': { unlock_type: 'credential', type: 'star', requires: { proof: 'Ordination Proof' }, description: 'Provide documentation of ordination or recognized spiritual leadership.' }
                        }
                    }
                }
            },
            'Narrative & Lore': {
                type: 'constellation',
                starSystems: {
                    'Narrative Prime': {
                        type: 'starSystem',
                        stars: {
                            'Story Sage': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 17 }, description: 'Unlocks narrative planning tools with bonus inspiration fragments.' },
                            'World Builder': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 18 }, description: 'Allows crafting of campaign settings that boost allied progress.' },
                            'Lorekeeper': { unlock_type: 'credential', type: 'star', requires: { proof: 'Publication Link' }, description: 'Share a published work documenting a fictional or historical setting.' }
                        }
                    }
                }
            },
            'Legacy & Purpose': {
                type: 'constellation',
                starSystems: {
                    'Legacy Prime': {
                        type: 'starSystem',
                        stars: {
                            'Vision Architect': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 17 }, description: 'Set long-term goals with improved chance of milestone success.' },
                            'Life Coach': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 19 }, description: 'Provides bonus support fragments when mentoring others.' },
                            'Philanthropist': { unlock_type: 'credential', type: 'star', requires: { proof: 'Donation Verification' }, description: 'Document a sustained philanthropic commitment or foundation.' }
                        }
                    }
                }
            }
        }
    },
    'Community': {
        type: 'galaxy',
        description: 'Skills related to social structures, collaboration, and civic engagement.',
        constellations: {
            'Collaboration': {
                type: 'constellation',
                starSystems: {
                    'Collaboration Prime': {
                        type: 'starSystem',
                        stars: {
                            'Team Player': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 13 }, description: 'Improves efficiency of group tasks.' },
                            'Project Manager': { unlock_type: 'credential', type: 'star', requires: { proof: 'Certificate Upload' }, description: 'Upload a PMP or similar project management certification.' }
                        }
                    }
                }
            },
            'Civics': {
                type: 'constellation',
                starSystems: {
                    'Civics Prime': {
                        type: 'starSystem',
                        stars: {
                            'Informed Voter': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 12 }, description: 'Demonstrate knowledge of local and national political systems.' },
                            'Volunteer': { unlock_type: 'credential', type: 'star', requires: { proof: 'Hours Log' }, description: 'Log a significant number of verified volunteer hours.' }
                        }
                    }
                }
            },
            'Mentorship': {
                type: 'constellation',
                starSystems: {
                    'Mentorship Prime': {
                        type: 'starSystem',
                        stars: {
                            'Tutor': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 16 }, description: 'Unlocks the ability to help other users in a future update.' },
                            'Mentor': { unlock_type: 'credential', type: 'star', requires: { proof: 'Testimonial' }, description: 'Receive a verified testimonial from a mentee.' }
                        }
                    }
                }
            },
            'Entrepreneurship': {
                type: 'constellation',
                starSystems: {
                    'Startup Prime': {
                        type: 'starSystem',
                        stars: {
                            'Idea Founder': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 16 }, description: 'Unlocks venture planning chores with bonus Inspiration fragments.' },
                            'Pitch Champion': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 18 }, description: 'Improves success odds when presenting proposals or pitches.' },
                            'Business Owner': { unlock_type: 'credential', type: 'star', requires: { proof: 'Business Registration' }, description: 'Upload proof of owning or co-founding a registered business.' }
                        }
                    }
                }
            },
            'Advocacy & Activism': {
                type: 'constellation',
                starSystems: {
                    'Advocacy Prime': {
                        type: 'starSystem',
                        stars: {
                            'Cause Organizer': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 15 }, description: 'Boosts the impact of mobilizing volunteers or supporters.' },
                            'Policy Advocate': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 16 }, description: 'Unlocks policy research chores with bonus Civic fragments.' },
                            'Change Maker': { unlock_type: 'credential', type: 'star', requires: { proof: 'Impact Report' }, description: 'Document measurable change driven by an advocacy initiative.' }
                        }
                    }
                }
            },
            'Education Outreach': {
                type: 'constellation',
                starSystems: {
                    'Education Prime': {
                        type: 'starSystem',
                        stars: {
                            'Workshop Host': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 17 }, description: 'Award bonus fragments for teaching live sessions or workshops.' },
                            'Curriculum Designer': { unlock_type: 'perk', type: 'star', requires: { stat: 'intelligence', value: 17 }, description: 'Unlocks curriculum planning templates that accelerate prep work.' },
                            'Community Professor': { unlock_type: 'credential', type: 'star', requires: { proof: 'Syllabus Upload' }, description: 'Share a syllabus or course plan taught to a community audience.' }
                        }
                    }
                }
            },
            'Global Citizenship': {
                type: 'constellation',
                starSystems: {
                    'Global Prime': {
                        type: 'starSystem',
                        stars: {
                            'Language Exchange Host': { unlock_type: 'perk', type: 'star', requires: { stat: 'charisma', value: 16 }, description: 'Gain bonus rewards when organizing cross-cultural meetups.' },
                            'Cultural Ambassador': { unlock_type: 'perk', type: 'star', requires: { stat: 'wisdom', value: 18 }, description: 'Unlocks diplomacy-oriented quests with increased fragment gains.' },
                            'International Project Lead': { unlock_type: 'credential', type: 'star', requires: { proof: 'Project Verification' }, description: 'Provide verification of leading an international or cross-border project.' }
                        }
                    }
                }
            }
        }
    }
};

const skillTree = generateProceduralLayout(rawSkillTree, { forceLayout: true });

if (window.skillTree && typeof window.skillTree === 'object') {
    window.skillTree = generateProceduralLayout(window.skillTree, { clone: true });
} else {
    window.skillTree = skillTree;
}

window.SkillTreeUtils = Object.assign({}, window.SkillTreeUtils, {
    DEFAULT_LAYOUT,
    normalizeSkillTreeStructure,
    generateProceduralLayout,
    migrateLegacySkillTree: (legacyTree, options = {}) => generateProceduralLayout(legacyTree, { ...options, clone: true }),
    migrateConstellationToStarSystems,
    getConstellationStarSystems,
    getConstellationStarsMap,
    getConstellationStarEntries,
    hasConstellationStar,
    findStarInConstellation
});

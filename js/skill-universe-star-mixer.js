(function initializeSkillUniverseStarMixer(global) {
    'use strict';

    const DEFAULT_LIBRARY = {
        metals: [
            {
                id: 'ambientcg_brushed_metal_steel',
                name: 'Brushed Steel - AmbientCG',
                provider: 'AmbientCG',
                url: 'https://ambientcg.com/view?id=MetalBrushed018',
                license: 'CC0',
                color: 0xb8c1d1,
                emissive: 0x8fb2ff
            },
            {
                id: 'ambientcg_copper_scratched',
                name: 'Scratched Copper - AmbientCG',
                provider: 'AmbientCG',
                url: 'https://ambientcg.com/view?id=MetalScratched002',
                license: 'CC0',
                color: 0xc9784a,
                emissive: 0xffb46a
            }
        ],
        gases: [
            {
                id: 'polyhaven_nebula_01',
                name: 'Nebula 01 - Poly Haven',
                provider: 'Poly Haven',
                url: 'https://polyhaven.com/a/nebula_01',
                license: 'CC0',
                color: 0x4250b7,
                emissive: 0x91a5ff
            },
            {
                id: 'polyhaven_nebula_03',
                name: 'Nebula 03 - Poly Haven',
                provider: 'Poly Haven',
                url: 'https://polyhaven.com/a/nebula_03',
                license: 'CC0',
                color: 0x732a79,
                emissive: 0xdf86ff
            }
        ],
        organics: [
            {
                id: 'sharetextures_fantasy_wood',
                name: 'Fantasy Wood 002 - ShareTextures',
                provider: 'ShareTextures',
                url: 'https://www.sharetextures.com/texture/wood-fantasy-002/',
                license: 'CC0 (account required)',
                color: 0x6f6042,
                emissive: 0x9de673
            },
            {
                id: 'ambientcg_water_coarse',
                name: 'Water Coarse 002 - AmbientCG',
                provider: 'AmbientCG',
                url: 'https://ambientcg.com/view?id=WaterCoarse002',
                license: 'CC0',
                color: 0x3a6c7a,
                emissive: 0x7dd6ff
            }
        ],
        minerals: [
            {
                id: 'ambientcg_crystal_rough',
                name: 'Rough Crystal 001 - AmbientCG',
                provider: 'AmbientCG',
                url: 'https://ambientcg.com/view?id=Crystal001',
                license: 'CC0',
                color: 0x8bd5ff,
                emissive: 0xc9f8ff
            },
            {
                id: 'ambientcg_volcanic_rock',
                name: 'Volcanic Rock 018 - AmbientCG',
                provider: 'AmbientCG',
                url: 'https://ambientcg.com/view?id=VolcanicRock018',
                license: 'CC0',
                color: 0x4a3d3a,
                emissive: 0xff7a3d
            }
        ],
        other: [
            {
                id: 'kenney_fantasy_glow',
                name: 'Fantasy VFX Glow - Kenney',
                provider: 'Kenney',
                url: 'https://www.kenney.nl/assets/fantasy-vfx',
                license: 'CC0',
                color: 0x94faff,
                emissive: 0xd9ffff
            },
            {
                id: 'polyhaven_plasma_ball',
                name: 'Plasma Ball - Poly Haven',
                provider: 'Poly Haven',
                url: 'https://polyhaven.com/a/plasma_ball',
                license: 'CC0',
                color: 0xff66c4,
                emissive: 0xffc7f1
            }
        ],
        noise: [
            {
                id: '3dtextures_perlin_noise',
                name: 'Perlin Noise 001 - 3DTextures',
                provider: '3DTextures',
                url: 'https://3dtextures.me/2018/05/26/noise-perlin-001/',
                license: 'CC0',
                color: 0x7f7f7f,
                emissive: 0xcfcfcf
            },
            {
                id: '3dtextures_flowmap_noise',
                name: 'Flow Noise 001 - 3DTextures',
                provider: '3DTextures',
                url: 'https://3dtextures.me/2019/01/14/noise-flow-001/',
                license: 'CC0',
                color: 0x5f6a7d,
                emissive: 0x9fb6d9
            }
        ]
    };

    const STAT_CATEGORY_PREFERENCES = {
        strength: ['metals', 'other', 'minerals'],
        constitution: ['organics', 'minerals', 'metals'],
        intelligence: ['minerals', 'metals', 'gases'],
        wisdom: ['gases', 'minerals', 'organics'],
        charisma: ['organics', 'other', 'gases'],
        dexterity: ['metals', 'gases', 'other'],
        spirit: ['gases', 'other', 'organics'],
        perception: ['gases', 'metals', 'minerals']
    };

    const STAR_TYPE_RECIPES = {
        support_star: [0.68, 0.32],
        star: [0.5, 0.3, 0.2],
        apex_star: [0.4, 0.28, 0.2, 0.12]
    };

    const DEFAULT_STATUS_INTENSITY = {
        unlocked: 0.68,
        available: 0.45,
        locked: 0.26
    };

    const DEFAULT_CATEGORY_FALLBACK = ['metals', 'minerals', 'gases', 'organics', 'other'];

    const MAP_TYPE_ALIASES = {
        map: 'map',
        albedo: 'map',
        basecolor: 'map',
        basecolour: 'map',
        base_colour: 'map',
        colour: 'map',
        color: 'map',
        diffuse: 'map',
        primary: 'map',
        normal: 'normalMap',
        normaldx: 'normalMap',
        normalgl: 'normalMap',
        normalmap: 'normalMap',
        roughness: 'roughnessMap',
        glossiness: 'roughnessMap',
        metalness: 'metalnessMap',
        metallic: 'metalnessMap',
        metalnessmap: 'metalnessMap',
        emission: 'emissiveMap',
        emissive: 'emissiveMap',
        emissivecolor: 'emissiveMap',
        glow: 'emissiveMap'
    };

    function slugify(value, fallback) {
        if (typeof value !== 'string') {
            return fallback || 'item';
        }
        const slug = value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');
        if (!slug && fallback) {
            return slugify(fallback);
        }
        return slug || (fallback || 'item');
    }

    function sanitizeColor(input, fallback) {
        if (typeof input === 'number' && Number.isFinite(input)) {
            return Math.max(0, Math.min(0xffffff, input >>> 0));
        }
        if (typeof input === 'string') {
            const trimmed = input.trim();
            const hexMatch = trimmed.match(/^#?([0-9a-f]{6})$/i);
            if (hexMatch) {
                return parseInt(hexMatch[1], 16);
            }
        }
        if (Array.isArray(input) && input.length >= 3) {
            const [r, g, b] = input;
            if ([r, g, b].every((channel) => Number.isFinite(channel))) {
                const red = Math.max(0, Math.min(255, Math.round(r)));
                const green = Math.max(0, Math.min(255, Math.round(g)));
                const blue = Math.max(0, Math.min(255, Math.round(b)));
                return (red << 16) | (green << 8) | blue;
            }
        }
        if (fallback !== undefined) {
            return sanitizeColor(fallback, 0xffffff);
        }
        return 0xffffff;
    }

    function joinPaths() {
        const segments = Array.from(arguments)
            .filter((segment) => typeof segment === 'string' && segment.length);
        if (!segments.length) {
            return '';
        }
        return segments
            .map((segment, index) => {
                const normalized = segment.replace(/\\/g, '/');
                if (index === 0) {
                    return normalized.replace(/\/+$/g, '');
                }
                return normalized.replace(/^\/+/, '').replace(/\/+$/g, '');
            })
            .join('/');
    }

    function resolveMaps(rawMaps, folderPath) {
        if (!rawMaps || typeof rawMaps !== 'object') {
            return null;
        }
        const resolved = {};
        Object.entries(rawMaps).forEach(([mapType, fileName]) => {
            if (typeof fileName !== 'string' || !fileName.length) {
                return;
            }
            if (/^(https?:)?\/\//i.test(fileName) || fileName.startsWith('data:')) {
                resolved[mapType] = fileName;
                return;
            }
            const combined = joinPaths(folderPath, fileName);
            if (combined) {
                resolved[mapType] = combined;
            }
        });
        return Object.keys(resolved).length ? resolved : null;
    }

    function normalizeMapKey(mapKey) {
        if (typeof mapKey !== 'string') {
            return null;
        }
        const normalized = mapKey
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '');
        if (!normalized.length) {
            return null;
        }
        return MAP_TYPE_ALIASES[normalized] || null;
    }

    function resolveNoiseOverlayUrl(item) {
        if (!item || typeof item !== 'object') {
            return '';
        }
        const maps = item.maps && typeof item.maps === 'object' ? item.maps : null;
        if (maps) {
            const priorities = ['mask', 'blend', 'noise', 'alpha', 'height', 'displacement', 'roughness', 'albedo', 'primary'];
            for (let i = 0; i < priorities.length; i += 1) {
                const key = priorities[i];
                if (typeof maps[key] === 'string' && maps[key].length) {
                    return maps[key];
                }
            }
            const mapKeys = Object.keys(maps);
            if (mapKeys.length) {
                const fallbackKey = mapKeys.find((key) => typeof maps[key] === 'string' && maps[key].length);
                if (fallbackKey) {
                    return maps[fallbackKey];
                }
            }
        }
        if (typeof item.preview === 'string' && item.preview.length) {
            return item.preview;
        }
        return '';
    }

    function selectNoiseOverlays(library, rng, layerSummary) {
        const layers = layerSummary || {};
        const layerKeys = Object.keys(layers);
        const blendLayerCount = layerKeys.reduce((count, key) => {
            const layerEntries = layers[key];
            if (Array.isArray(layerEntries) && layerEntries.length > 1) {
                return count + 1;
            }
            return count;
        }, 0);
        const requiresBlend = blendLayerCount > 0;
        if (!requiresBlend) {
            return [];
        }

        const noisePool = Array.isArray(library?.noise) ? library.noise.filter((entry) => entry && typeof entry === 'object') : [];
        if (!noisePool.length) {
            return [];
        }

        const desiredCount = Math.min(2, noisePool.length, blendLayerCount);
        if (desiredCount <= 0) {
            return [];
        }

        const shuffled = noisePool.slice();
        for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(rng() * (i + 1));
            const tmp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = tmp;
        }

        const overlays = [];
        for (let index = 0; index < shuffled.length && overlays.length < desiredCount; index += 1) {
            const candidate = shuffled[index];
            const url = resolveNoiseOverlayUrl(candidate);
            if (!url) {
                continue;
            }
            overlays.push({
                id: candidate.id || candidate.name || `noise-${index}`,
                name: candidate.name || candidate.id || `Noise ${index + 1}`,
                category: 'noise',
                url
            });
        }

        if (!overlays.length) {
            return [];
        }

        const normalizedWeight = 1 / overlays.length;
        return overlays.map((entry) => Object.assign({}, entry, { weight: normalizedWeight }));
    }

    function aggregateIngredientMaps(ingredients, library, rng) {
        const layers = {};
        if (!Array.isArray(ingredients) || !ingredients.length) {
            return { blendMasks: [] };
        }

        ingredients.forEach((ingredient) => {
            if (!ingredient || typeof ingredient !== 'object' || !ingredient.maps) {
                return;
            }
            const weight = Math.max(0, Number(ingredient.weight) || 0);
            if (weight <= 0) {
                return;
            }
            Object.entries(ingredient.maps).forEach(([mapKey, url]) => {
                if (typeof url !== 'string' || !url.length) {
                    return;
                }
                const normalizedKey = normalizeMapKey(mapKey);
                if (!normalizedKey) {
                    return;
                }
                if (!layers[normalizedKey]) {
                    layers[normalizedKey] = [];
                }
                layers[normalizedKey].push({
                    url,
                    weight,
                    ingredientId: ingredient.id || null,
                    ingredientName: ingredient.name || null,
                    originalType: mapKey
                });
            });
        });

        const payload = { blendMasks: [] };
        Object.keys(layers).forEach((layerKey) => {
            const entries = layers[layerKey];
            if (!entries || !entries.length) {
                return;
            }
            const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
            if (totalWeight <= 0) {
                return;
            }
            const normalizedEntries = entries
                .map((entry) => ({
                    url: entry.url,
                    weight: entry.weight / totalWeight,
                    originalWeight: entry.weight,
                    ingredientId: entry.ingredientId,
                    ingredientName: entry.ingredientName,
                    mapType: entry.originalType
                }))
                .sort((a, b) => b.weight - a.weight);
            payload[layerKey] = {
                totalWeight,
                entries: normalizedEntries
            };
        });

        payload.blendMasks = selectNoiseOverlays(library, rng, layers);
        return payload;
    }

    function normalizeLibraryItem(rawItem, context) {
        if (!rawItem || typeof rawItem !== 'object') {
            return null;
        }
        const opts = context || {};
        const category = typeof opts.category === 'string' ? opts.category : rawItem.category;
        const id = typeof rawItem.id === 'string' && rawItem.id.length
            ? rawItem.id
            : slugify(rawItem.name || (category ? `${category}-ingredient` : 'ingredient'));
        const name = typeof rawItem.name === 'string' && rawItem.name.length ? rawItem.name : id;
        const provider = typeof rawItem.provider === 'string' && rawItem.provider.length
            ? rawItem.provider
            : (typeof rawItem.source === 'string' ? rawItem.source : 'Local import');
        const license = typeof rawItem.license === 'string' && rawItem.license.length
            ? rawItem.license
            : (opts.defaultLicense || 'Unspecified');
        const url = typeof rawItem.url === 'string' ? rawItem.url : '';
        const tags = Array.isArray(rawItem.tags)
            ? rawItem.tags.filter((tag) => typeof tag === 'string' && tag.length)
            : [];
        const defaultColor = typeof opts.defaultColor !== 'undefined' ? opts.defaultColor : 0xffffff;
        const color = sanitizeColor(rawItem.color, defaultColor);
        const emissive = sanitizeColor(rawItem.emissive, color);
        const relativePath = typeof rawItem.relativePath === 'string' ? rawItem.relativePath : '';
        const basePath = typeof opts.basePath === 'string' ? opts.basePath : '';
        const folderPath = joinPaths(basePath, relativePath);
        const maps = resolveMaps(rawItem.maps, folderPath);
        const preview = typeof rawItem.preview === 'string' && rawItem.preview.length
            ? (/^(https?:)?\/\//i.test(rawItem.preview)
                ? rawItem.preview
                : joinPaths(folderPath, rawItem.preview))
            : (maps && maps.albedo ? maps.albedo : '');

        return {
            id,
            name,
            provider,
            license,
            url,
            color,
            emissive,
            tags,
            maps: maps || undefined,
            relativePath: relativePath || undefined,
            preview: preview || undefined
        };
    }

    function mergeLibraryData(target, additions, options) {
        const library = target || {};
        if (!additions || typeof additions !== 'object') {
            return library;
        }
        const opts = options || {};
        Object.entries(additions).forEach(([category, items]) => {
            if (!Array.isArray(items)) {
                if (!library[category]) {
                    library[category] = [];
                }
                return;
            }
            if (!library[category]) {
                library[category] = [];
            }
            const existingIndex = new Map();
            library[category].forEach((entry, index) => {
                if (entry && typeof entry.id === 'string') {
                    existingIndex.set(entry.id, index);
                }
            });
            items.forEach((rawItem) => {
                const normalized = normalizeLibraryItem(rawItem, {
                    category,
                    basePath: opts.basePath,
                    defaultLicense: opts.defaultLicense,
                    defaultColor: opts.defaultColor
                });
                if (!normalized) {
                    return;
                }
                if (existingIndex.has(normalized.id)) {
                    const idx = existingIndex.get(normalized.id);
                    const current = library[category][idx] || {};
                    const mergedMaps = Object.assign({}, current.maps || {}, normalized.maps || {});
                    library[category][idx] = Object.assign({}, current, normalized, {
                        maps: Object.keys(mergedMaps).length ? mergedMaps : undefined
                    });
                } else {
                    library[category].push(normalized);
                    existingIndex.set(normalized.id, library[category].length - 1);
                }
            });
        });
        return library;
    }

    function deepCloneLibrary(library) {
        return JSON.parse(JSON.stringify(library || {}));
    }

    function createBaseLibrary() {
        return mergeLibraryData({}, DEFAULT_LIBRARY);
    }

    let libraryCache = createBaseLibrary();
    let inventoryLoadPromise = null;

    function getCurrentLibrary() {
        return deepCloneLibrary(libraryCache);
    }

    function resetLibrary() {
        libraryCache = createBaseLibrary();
        return getCurrentLibrary();
    }

    function injectLibraryData(libraryData, options) {
        if (!libraryData) {
            return getCurrentLibrary();
        }
        const categories = libraryData.categories || libraryData;
        libraryCache = mergeLibraryData(libraryCache, categories, options);
        return getCurrentLibrary();
    }

    function loadLibraryFromUrl(url, options) {
        if (typeof fetch !== 'function') {
            return Promise.reject(new Error('fetch is not available in this environment'));
        }
        const requestUrl = typeof url === 'string' && url.length
            ? url
            : 'assets/skill-universe/ingredient-library.json';
        const fetchOptions = Object.assign({ cache: 'no-store' }, options && options.fetchOptions);
        return fetch(requestUrl, fetchOptions)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`Failed to load ingredient library (${response.status})`);
                }
                return response.json();
            })
            .then((data) => {
                const basePath = (options && options.basePath)
                    || (typeof data.basePath === 'string' ? data.basePath : requestUrl.replace(/[^/]+$/, ''));
                const defaultLicense = (options && options.defaultLicense) || data.defaultLicense;
                const categories = data.categories || data;
                injectLibraryData(categories, { basePath, defaultLicense });
                return getCurrentLibrary();
            });
    }

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

    function createRandom(seedValue) {
        let seed = hashSeed(seedValue) >>> 0;
        return function nextRandom() {
            seed = (seed + 0x6d2b79f5) >>> 0;
            let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function hexToRgb(hex) {
        const value = Number.isFinite(hex) ? hex : 0xffffff;
        return {
            r: (value >> 16) & 0xff,
            g: (value >> 8) & 0xff,
            b: value & 0xff
        };
    }

    function rgbToHex({ r, g, b }) {
        const clampChannel = (channel) => Math.max(0, Math.min(255, Math.round(channel)));
        const red = clampChannel(r);
        const green = clampChannel(g);
        const blue = clampChannel(b);
        return (red << 16) | (green << 8) | blue;
    }

    function lerpColor(fromHex, toHex, factor) {
        const t = Math.max(0, Math.min(1, Number.isFinite(factor) ? factor : 0));
        const from = hexToRgb(fromHex);
        const to = hexToRgb(toHex);
        return rgbToHex({
            r: from.r + (to.r - from.r) * t,
            g: from.g + (to.g - from.g) * t,
            b: from.b + (to.b - from.b) * t
        });
    }

    function weightedMix(ingredients) {
        if (!Array.isArray(ingredients) || !ingredients.length) {
            return 0xffffff;
        }
        let totalWeight = 0;
        let accum = { r: 0, g: 0, b: 0 };
        ingredients.forEach((entry) => {
            const weight = Number.isFinite(entry.weight) ? Math.max(entry.weight, 0) : 0;
            if (!weight) {
                return;
            }
            const rgb = hexToRgb(entry.color);
            accum.r += rgb.r * weight;
            accum.g += rgb.g * weight;
            accum.b += rgb.b * weight;
            totalWeight += weight;
        });
        if (totalWeight <= 0) {
            return 0xffffff;
        }
        return rgbToHex({
            r: accum.r / totalWeight,
            g: accum.g / totalWeight,
            b: accum.b / totalWeight
        });
    }

    function normalizeRecipeWeights(weights) {
        if (!Array.isArray(weights) || !weights.length) {
            return [1];
        }
        const positive = weights.map((value) => Math.max(0, Number(value) || 0));
        const total = positive.reduce((sum, value) => sum + value, 0);
        if (total <= 0) {
            const fallbackWeight = 1 / positive.length;
            return positive.map(() => fallbackWeight);
        }
        return positive.map((value) => value / total);
    }

    function selectFromCategory(category, rng, library) {
        const available = library && typeof library === 'object' ? library : {};
        const directList = Array.isArray(available[category]) ? available[category] : null;
        if (directList && directList.length) {
            const directIndex = Math.floor(rng() * directList.length) % directList.length;
            return {
                item: directList[directIndex],
                category
            };
        }

        const fallbackCategories = Object.entries(available)
            .filter(([, items]) => Array.isArray(items) && items.length)
            .map(([key, items]) => ({ key, items }));

        if (!fallbackCategories.length) {
            return { item: null, category };
        }

        const fallbackEntry = fallbackCategories[Math.floor(rng() * fallbackCategories.length) % fallbackCategories.length];
        const pool = fallbackEntry.items;
        const poolIndex = Math.floor(rng() * pool.length) % pool.length;
        return {
            item: pool[poolIndex],
            category: fallbackEntry.key
        };
    }

    function flattenRequirements(requirements) {
        if (!requirements) {
            return [];
        }
        if (Array.isArray(requirements)) {
            return requirements;
        }
        return [requirements];
    }

    function extractStatSignals(starData) {
        const stats = {};
        if (!starData || typeof starData !== 'object') {
            return stats;
        }
        const addStat = (statName, weight = 1) => {
            if (typeof statName !== 'string') {
                return;
            }
            const key = statName.trim().toLowerCase();
            if (!key) {
                return;
            }
            stats[key] = (stats[key] || 0) + weight;
        };

        const requirements = flattenRequirements(starData.requires);
        requirements.forEach((req) => {
            if (!req || typeof req !== 'object') {
                return;
            }
            if (typeof req.stat === 'string') {
                addStat(req.stat, 1.5);
            }
            if (req.stats && typeof req.stats === 'object') {
                Object.keys(req.stats).forEach((name) => addStat(name, 1));
            }
            if (Array.isArray(req.perks)) {
                addStat('wisdom', 0.25 * req.perks.length);
            }
            if (req.proof) {
                addStat('charisma', 0.5);
                addStat('intelligence', 0.5);
            }
        });

        if (typeof starData.primary_stat === 'string') {
            addStat(starData.primary_stat, 2);
        }
        if (Array.isArray(starData.tags)) {
            starData.tags.forEach((tag) => addStat(tag, 0.4));
        }

        return stats;
    }

    function resolveCategoryPriority(statSignals, libraryCategories) {
        const entries = Object.entries(statSignals || {});
        const priorities = [];
        const availableCategories = Array.isArray(libraryCategories) && libraryCategories.length
            ? libraryCategories.filter((category) => typeof category === 'string' && category.length)
            : DEFAULT_CATEGORY_FALLBACK;

        if (entries.length) {
            entries.sort((a, b) => b[1] - a[1]);
            entries.forEach(([stat]) => {
                const preferred = STAT_CATEGORY_PREFERENCES[stat] || [];
                preferred.forEach((category) => {
                    if (category && !priorities.includes(category) && availableCategories.includes(category)) {
                        priorities.push(category);
                    }
                });
            });
        }

        availableCategories.forEach((category) => {
            if (!priorities.includes(category)) {
                priorities.push(category);
            }
        });

        return priorities.length ? priorities : DEFAULT_CATEGORY_FALLBACK.slice();
    }

    function buildRecipe(context, library) {
        const starType = typeof context?.starData?.type === 'string'
            ? context.starData.type
            : 'support_star';
        const baseWeights = STAR_TYPE_RECIPES[starType] || STAR_TYPE_RECIPES.support_star;
        const weights = normalizeRecipeWeights(baseWeights);
        const statSignals = extractStatSignals(context?.starData);
        const categoryKeys = Object.keys(library || {});
        const categories = resolveCategoryPriority(statSignals, categoryKeys);
        const rng = createRandom(context.seed || 'skill-universe-star');

        const usedCategories = [];
        const ingredients = weights.map((weight, index) => {
            const category = categories[index % categories.length];
            const selection = selectFromCategory(category, rng, library);
            const chosen = selection?.item || null;
            const resolvedCategory = selection?.category || category;
            if (!chosen) {
                return {
                    id: `${resolvedCategory}-placeholder`,
                    name: `${resolvedCategory} placeholder`,
                    category: resolvedCategory,
                    weight,
                    color: 0xffffff,
                    emissive: 0xffffff,
                    url: '',
                    license: 'CC0'
                };
            }
            usedCategories.push(resolvedCategory);
            const color = sanitizeColor(chosen.color, 0xffffff);
            const emissive = sanitizeColor(chosen.emissive, color);
            return Object.assign({}, chosen, {
                category: resolvedCategory,
                weight,
                color,
                emissive
            });
        });

        const textureMaps = aggregateIngredientMaps(ingredients, library, rng);

        const baseColor = weightedMix(ingredients.map((item) => ({
            color: item.color,
            weight: item.weight
        })));

        const accentColor = weightedMix(ingredients.map((item, index) => ({
            color: lerpColor(item.color, item.emissive, 0.65 - (index * 0.12)),
            weight: item.weight
        })));

        const emissiveColor = lerpColor(baseColor, accentColor, 0.6);

        return {
            starType,
            weights,
            ingredients,
            usedCategories,
            maps: textureMaps,
            colors: {
                albedo: baseColor,
                highlight: accentColor,
                emissive: emissiveColor
            }
        };
    }

    function generateStarMaterial(context = {}, options = {}) {
        const library = options.library
            ? mergeLibraryData(createBaseLibrary(), options.library, options.libraryOptions || {})
            : libraryCache;
        const galaxy = context.galaxyName || context.galaxy;
        const constellation = context.constellationName || context.constellation;
        const system = context.starSystemName || context.starSystem;
        const star = context.starName || context.star;
        const pathSeed = [galaxy, constellation, system, star]
            .filter((part) => typeof part === 'string' && part.length)
            .join('|');
        const seed = pathSeed || context.seed || 'skill-universe-star';
        const recipe = buildRecipe({
            starData: context.starData || null,
            seed,
            status: context.status
        }, library);

        const status = typeof context.status === 'string' ? context.status : 'locked';
        const emissiveIntensity = Number.isFinite(options.emissiveIntensity)
            ? options.emissiveIntensity
            : DEFAULT_STATUS_INTENSITY[status] ?? DEFAULT_STATUS_INTENSITY.locked;

        return {
            seed,
            status,
            recipe,
            maps: recipe.maps,
            colors: {
                albedo: recipe.colors.albedo,
                highlight: recipe.colors.highlight,
                emissive: recipe.colors.emissive,
                emissiveIntensity
            }
        };
    }

    function listMissingAssets() {
        const summary = [];
        const categories = Object.keys(libraryCache || {});
        categories.forEach((category) => {
            if (category === 'noise') {
                return;
            }
            const items = Array.isArray(libraryCache[category]) ? libraryCache[category] : [];
            if (!items.length) {
                summary.push({
                    category,
                    status: 'empty',
                    message: 'No packs detected. Drop textures into the folder and regenerate the manifest.'
                });
                return;
            }
            const unresolved = items.filter((item) => !item.maps || !item.maps.albedo);
            if (unresolved.length === items.length) {
                summary.push({
                    category,
                    status: 'placeholders',
                    message: 'Only fallback palette entries detected. Add real textures and rerun the generator.'
                });
            }
        });
        return summary;
    }

    if (global && global.SkillUniverseAssetLibrary) {
        try {
            const assetLibrary = global.SkillUniverseAssetLibrary;
            injectLibraryData(assetLibrary.categories || assetLibrary, {
                basePath: assetLibrary.basePath || assetLibrary.rootPath,
                defaultLicense: assetLibrary.defaultLicense
            });
        } catch (error) {
            if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                console.warn('SkillUniverseStarMixer: failed to merge global asset library', error);
            }
        }
    }

    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
        try {
            // eslint-disable-next-line import/no-dynamic-require, global-require
            const inventory = require('../assets/skill-universe/ingredient-library.json');
            if (inventory) {
                injectLibraryData(inventory.categories || inventory, {
                    basePath: inventory.basePath || 'assets/skill-universe',
                    defaultLicense: inventory.defaultLicense
                });
            }
        } catch (error) {
            // Ignore missing manifest when running in environments without assets.
        }
    }

    if (!inventoryLoadPromise) {
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
            inventoryLoadPromise = loadLibraryFromUrl('assets/skill-universe/ingredient-library.json').catch((error) => {
                if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                    console.warn('SkillUniverseStarMixer: unable to auto-load ingredient library', error);
                }
                return getCurrentLibrary();
            });
        } else {
            inventoryLoadPromise = Promise.resolve(getCurrentLibrary());
        }
    }

    const api = {
        getLibrary: getCurrentLibrary,
        generateStarMaterial,
        listMissingAssets,
        injectLibrary: injectLibraryData,
        loadLibraryFromUrl,
        resetLibrary,
        ready() {
            return inventoryLoadPromise
                ? inventoryLoadPromise.then(() => getCurrentLibrary())
                : Promise.resolve(getCurrentLibrary());
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    if (global) {
        global.SkillUniverseStarMixer = api;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

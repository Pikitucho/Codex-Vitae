#!/usr/bin/env node
/**
 * Generate a JSON manifest for the Skill Universe material pantry.
 *
 * The script scans the `assets/skill-universe/material-ingredients` folder,
 * collects per-category assets, estimates representative colors, and stores
 * texture map filenames so the renderer/mixer can surface everything in DevTools.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const INGREDIENT_ROOT = path.join(PROJECT_ROOT, 'assets/skill-universe/material-ingredients');
const OUTPUT_FILE = path.join(PROJECT_ROOT, 'assets/skill-universe/ingredient-library.json');
const BASE_PATH = 'assets/skill-universe';
const GASES_ROOT = path.join(INGREDIENT_ROOT, 'gases');
const NOISE_ROOT = path.join(INGREDIENT_ROOT, 'noise');
const ABSOLUTE_PREFIX = path.join('assets', 'skill-universe', 'material-ingredients');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.tif', '.tiff', '.webp', '.exr', '.hdr']);

const MAP_PATTERNS = {
    albedo: /(albedo|basecolor|diffuse|color)/i,
    normal: /normal/i,
    roughness: /rough/i,
    metalness: /(metalness|metallic)/i,
    ao: /(ambientocclusion|ao)/i,
    height: /(height|displacement)/i,
    emissive: /emissive|emission/i,
    opacity: /(opacity|alpha)/i,
    specular: /specular/i,
    gloss: /gloss/i
};

const CATEGORY_HUES = {
    metals: 210,
    minerals: 40,
    organics: 125,
    gases: 200,
    other: 285
};

const KEYWORD_COLOR_OVERRIDES = [
    { pattern: /gold/i, color: '#f5c86c', emissive: '#ffeab3' },
    { pattern: /copper|bronze/i, color: '#c97945', emissive: '#ffb787' },
    { pattern: /steel|metal|nickel|titanium|iron|platinum/i, color: '#a7b2c4', emissive: '#aee2ff' },
    { pattern: /black/i, color: '#1f2228', emissive: '#495f7f' },
    { pattern: /lava|magma|volcan/i, color: '#7a1d0b', emissive: '#ff6a2a' },
    { pattern: /plasma|glass/i, color: '#66ccff', emissive: '#c4f2ff' },
    { pattern: /nebula|gas|cloud/i, color: '#4a6bff', emissive: '#b6c9ff' },
    { pattern: /snow|ice|frozen|frost/i, color: '#d8f2ff', emissive: '#bff6ff' },
    { pattern: /sand|desert|dune|pebble/i, color: '#caa374', emissive: '#ffe0a6' },
    { pattern: /crystal|jewel|gem/i, color: '#74e0ff', emissive: '#bef6ff' },
    { pattern: /marble|onyx/i, color: '#cbd2de', emissive: '#f2f5ff' },
    { pattern: /rock|cliff|stone/i, color: '#6c665d', emissive: '#a7a39d' },
    { pattern: /grass|moss/i, color: '#3a8031', emissive: '#71e37a' },
    { pattern: /wood|bark|plank|plywood/i, color: '#6f4a2c', emissive: '#b17c4c' },
    { pattern: /dirt|soil|mud/i, color: '#5d3b26', emissive: '#a96b39' },
    { pattern: /cloth|fabric|carpet/i, color: '#7c5186', emissive: '#d5a4e2' }
];

const NOISE_TAG_HINTS = [
    { pattern: /perlin/i, tag: 'perlin' },
    { pattern: /voronoi|worley/i, tag: 'voronoi' },
    { pattern: /fbm|fractal/i, tag: 'fbm' },
    { pattern: /simplex/i, tag: 'simplex' },
    { pattern: /cell|cellular/i, tag: 'cellular' },
    { pattern: /value/i, tag: 'value' },
    { pattern: /gauss|gaussian/i, tag: 'gaussian' },
    { pattern: /cloud/i, tag: 'cloud' },
    { pattern: /ridge/i, tag: 'ridge' }
];

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
}

function toPrettyName(value) {
    return value
        .replace(/[_.-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b([a-z])/g, (match, letter) => letter.toUpperCase())
        .trim();
}

function toPosixPath(value) {
    return value.replace(/\\/g, '/');
}

function walkFiles(root) {
    if (!fs.existsSync(root)) {
        return [];
    }

    const stack = [root];
    const files = [];

    while (stack.length) {
        const current = stack.pop();
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name.startsWith('.')) {
                continue;
            }
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(entryPath);
            } else if (entry.isFile()) {
                files.push(entryPath);
            }
        }
    }

    return files;
}

function createRng(seed) {
    let state = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i += 1) {
        state ^= seed.charCodeAt(i);
        state = Math.imul(state, 16777619) >>> 0;
    }
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), state | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hslToHex(h, s, l) {
    const hue = (h % 360 + 360) % 360 / 360;
    const saturation = Math.max(0, Math.min(1, s));
    const lightness = Math.max(0, Math.min(1, l));

    if (saturation === 0) {
        const gray = Math.round(lightness * 255);
        const value = (gray << 16) | (gray << 8) | gray;
        return `#${value.toString(16).padStart(6, '0')}`;
    }

    const q = lightness < 0.5
        ? lightness * (1 + saturation)
        : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;

    const hueToChannel = (t) => {
        let temp = t;
        if (temp < 0) temp += 1;
        if (temp > 1) temp -= 1;
        if (temp < 1 / 6) return p + (q - p) * 6 * temp;
        if (temp < 1 / 2) return q;
        if (temp < 2 / 3) return p + (q - p) * (2 / 3 - temp) * 6;
        return p;
    };

    const r = Math.round(hueToChannel(hue + 1 / 3) * 255);
    const g = Math.round(hueToChannel(hue) * 255);
    const b = Math.round(hueToChannel(hue - 1 / 3) * 255);
    const value = (r << 16) | (g << 8) | b;
    return `#${value.toString(16).padStart(6, '0')}`;
}

function deriveColors(category, itemName) {
    const lower = itemName.toLowerCase();
    for (const override of KEYWORD_COLOR_OVERRIDES) {
        if (override.pattern.test(lower)) {
            return {
                color: override.color,
                emissive: override.emissive
            };
        }
    }

    const rng = createRng(`${category}:${itemName}`);
    const baseHue = CATEGORY_HUES[category] ?? 200;
    const hue = baseHue + (rng() - 0.5) * 70;
    const saturation = 0.45 + rng() * 0.25;
    const lightness = 0.45 + rng() * 0.18;
    const emissiveHue = hue + (rng() - 0.5) * 20;
    const emissiveLightness = Math.min(0.92, lightness + 0.22);

    return {
        color: hslToHex(hue, saturation, lightness),
        emissive: hslToHex(emissiveHue, Math.min(1, saturation + 0.18), emissiveLightness)
    };
}

function categorizeFiles(files) {
    const maps = {};
    for (const fileName of files) {
        const ext = path.extname(fileName).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) {
            continue;
        }
        for (const [mapType, pattern] of Object.entries(MAP_PATTERNS)) {
            if (!maps[mapType] && pattern.test(fileName)) {
                maps[mapType] = fileName;
            }
        }
        if (!Object.keys(maps).some((key) => maps[key] === fileName)) {
            if ((ext === '.hdr' || ext === '.exr') && !maps.environment) {
                maps.environment = fileName;
            } else if ((ext === '.tif' || ext === '.tiff') && !maps.albedo) {
                maps.albedo = fileName;
            } else if (!maps.primary) {
                maps.primary = fileName;
            }
        }
    }
    return maps;
}

function detectProvider(files) {
    if (files.some((name) => name.includes('_4K-JPG'))) {
        return 'AmbientCG (imported)';
    }
    if (files.some((name) => name.includes('-1K'))) {
        return 'CC0 texture pack';
    }
    return 'Local import';
}

function mergeEntry(existing, incoming) {
    if (!existing) {
        return { ...incoming };
    }

    const merged = { ...existing };

    if (incoming.maps) {
        merged.maps = { ...(existing.maps || {}), ...incoming.maps };
    }

    if (incoming.tags) {
        const tags = new Set([...(existing.tags || []), ...incoming.tags]);
        merged.tags = Array.from(tags);
    }

    for (const [key, value] of Object.entries(incoming)) {
        if (key === 'maps' || key === 'tags') {
            continue;
        }
        if (value === undefined || value === null) {
            continue;
        }
        if ((key === 'provider' || key === 'license')
            && value === 'Unknown'
            && existing[key]
            && existing[key] !== 'Unknown') {
            continue;
        }
        merged[key] = value;
    }

    return merged;
}

function upsertEntries(target, entries) {
    const list = Array.isArray(target) ? target.slice() : [];
    const index = new Map(list.map((entry, position) => [entry.id, position]));

    for (const incoming of entries) {
        if (index.has(incoming.id)) {
            const existingIndex = index.get(incoming.id);
            list[existingIndex] = mergeEntry(list[existingIndex], incoming);
        } else {
            index.set(incoming.id, list.length);
            list.push({ ...incoming });
        }
    }

    return list;
}

function gatherNebulaEntries(existingGases) {
    if (!fs.existsSync(GASES_ROOT)) {
        return [];
    }

    const existingBySlug = new Map(
        (existingGases || []).map((item) => [item.id, item])
    );

    const files = walkFiles(GASES_ROOT).filter((file) => path.extname(file).toLowerCase() === '.hdr');
    const nebulae = [];

    for (const filePath of files) {
        const relativePath = toPosixPath(path.relative(GASES_ROOT, filePath));
        const baseName = path.parse(filePath).name;
        const prettyName = toPrettyName(baseName);
        const slug = slugify(prettyName);
        const id = `nebula_${slug}`;

        const environmentPath = toPosixPath(path.join(ABSOLUTE_PREFIX, 'gases', relativePath));
        const folder = path.dirname(filePath);
        const candidateBase = path.join(folder, baseName);
        let platePath;
        for (const ext of ['.tif', '.tiff', '.png']) {
            const candidate = `${candidateBase}${ext}`;
            if (fs.existsSync(candidate)) {
                platePath = toPosixPath(path.join(
                    ABSOLUTE_PREFIX,
                    'gases',
                    path.relative(GASES_ROOT, candidate)
                ));
                break;
            }
        }

        const sourceMetadata = existingBySlug.get(slug) || null;
        const provider = sourceMetadata?.provider || 'Unknown';
        const license = sourceMetadata?.license || 'Unknown';

        const entry = {
            id,
            name: prettyName,
            type: 'nebula',
            provider,
            license,
            maps: {
                environment: environmentPath
            },
            tags: ['gas', 'nebula', 'hdr']
        };

        if (platePath) {
            entry.maps.plate = platePath;
        }

        nebulae.push(entry);
    }

    return nebulae;
}

function gatherNoiseEntries() {
    if (!fs.existsSync(NOISE_ROOT)) {
        return [];
    }

    const files = walkFiles(NOISE_ROOT).filter((file) => path.extname(file).toLowerCase() === '.png');
    const noises = [];

    for (const filePath of files) {
        const relativePath = toPosixPath(path.relative(NOISE_ROOT, filePath));
        const baseName = path.parse(filePath).name;
        const prettyName = toPrettyName(baseName);
        const slug = slugify(prettyName);
        const maskPath = toPosixPath(path.join(ABSOLUTE_PREFIX, 'noise', relativePath));

        const lower = baseName.toLowerCase();
        const hint = NOISE_TAG_HINTS.find((item) => item.pattern.test(lower));
        const detailTag = hint ? hint.tag : 'custom';

        noises.push({
            id: `noise_${slug}`,
            name: prettyName,
            type: 'noise',
            maps: {
                mask: maskPath
            },
            format: 'L8',
            tags: ['noise', 'mask', detailTag]
        });
    }

    return noises;
}

function gatherCategory(categoryName) {
    const categoryPath = path.join(INGREDIENT_ROOT, categoryName);
    if (!fs.existsSync(categoryPath)) {
        return [];
    }

    const entries = fs.readdirSync(categoryPath).filter((entry) => !entry.startsWith('.'));
    const libraryEntries = [];

    for (const entry of entries) {
        const entryPath = path.join(categoryPath, entry);
        const stat = fs.statSync(entryPath);
        let files = [];
        let displayName = entry;
        let relativeBasePath;

        if (stat.isDirectory()) {
            files = fs.readdirSync(entryPath).filter((file) => !file.startsWith('.'));
            if (!files.length) {
                continue;
            }
            relativeBasePath = path.join('material-ingredients', categoryName, entry);
        } else if (stat.isFile()) {
            const ext = path.extname(entry).toLowerCase();
            if (!IMAGE_EXTENSIONS.has(ext)) {
                continue;
            }
            files = [entry];
            displayName = path.parse(entry).name;
            relativeBasePath = path.join('material-ingredients', categoryName);
        } else {
            continue;
        }

        const maps = categorizeFiles(files);
        const colors = deriveColors(categoryName, displayName);
        const provider = detectProvider(files);
        const tags = displayName
            .replace(/[_-]+/g, ' ')
            .split(/\s+/)
            .map((token) => token.replace(/[^a-z0-9-]/gi, ''))
            .filter(Boolean);

        libraryEntries.push({
            id: slugify(displayName),
            name: displayName,
            relativePath: relativeBasePath.replace(/\\/g, '/'),
            maps,
            color: colors.color,
            emissive: colors.emissive,
            provider,
            license: provider.startsWith('AmbientCG') ? 'CC0 (AmbientCG)' : 'Verify before sharing',
            tags
        });
    }

    libraryEntries.sort((a, b) => a.name.localeCompare(b.name));
    return libraryEntries;
}

function buildLibrary() {
    const categories = ['metals', 'minerals', 'organics', 'gases', 'other'];
    const results = {};

    for (const category of categories) {
        results[category] = gatherCategory(category);
    }

    const nebulaEntries = gatherNebulaEntries(results.gases);
    if (nebulaEntries.length) {
        results.gases = upsertEntries(results.gases, nebulaEntries).sort((a, b) => a.name.localeCompare(b.name));
    }

    const noiseEntries = gatherNoiseEntries();
    if (noiseEntries.length) {
        results.noise = upsertEntries(results.noise, noiseEntries).sort((a, b) => a.name.localeCompare(b.name));
    }

    return {
        generatedAt: new Date().toISOString(),
        basePath: BASE_PATH,
        defaultLicense: 'Verify before distribution',
        categories: results
    };
}

function main() {
    if (!fs.existsSync(INGREDIENT_ROOT)) {
        console.error('Ingredient directory not found:', INGREDIENT_ROOT);
        process.exitCode = 1;
        return;
    }

    const library = buildLibrary();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(library, null, 2));

    const summary = Object.entries(library.categories)
        .map(([category, items]) => `${category}: ${items.length}`)
        .join(', ');

    console.log('✓ Skill Universe library generated →', path.relative(PROJECT_ROOT, OUTPUT_FILE));
    console.log('   Contents:', summary);
}

main();

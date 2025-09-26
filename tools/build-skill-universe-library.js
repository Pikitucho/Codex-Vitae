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

function slugify(value) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
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

function gatherCategory(categoryName) {
    const categoryPath = path.join(INGREDIENT_ROOT, categoryName);
    if (!fs.existsSync(categoryPath)) {
        return [];
    }

    const entries = fs.readdirSync(categoryPath).filter((entry) => !entry.startsWith('.'));
    const libraryEntries = [];

    for (const entry of entries) {
        const entryPath = path.join(categoryPath, entry);
        if (!fs.statSync(entryPath).isDirectory()) {
            continue;
        }
        const files = fs.readdirSync(entryPath).filter((file) => !file.startsWith('.'));
        if (!files.length) {
            continue;
        }

        const maps = categorizeFiles(files);
        const colors = deriveColors(categoryName, entry);
        const provider = detectProvider(files);
        const tags = entry
            .split(/\s+/)
            .map((token) => token.replace(/[^a-z0-9-]/gi, ''))
            .filter(Boolean);

        libraryEntries.push({
            id: slugify(entry),
            name: entry,
            relativePath: path.join('material-ingredients', categoryName, entry).replace(/\\/g, '/'),
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

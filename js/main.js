// js/main.js

(() => {
    'use strict';

// --- CONFIGURATION ---
// Sensitive configuration values are now injected via config.js which
// should define window.__CODEX_CONFIG__.
function displayConfigurationError(message, details) {
    const authScreenElement = document.getElementById('auth-screen');
    if (!authScreenElement) {
        return;
    }

    const extraDetails = details
        ? `<p class="config-error-details">${details}</p>`
        : '';

    authScreenElement.innerHTML = `
        <h1>Codex Vitae</h1>
        <p class="config-error-message">${message}</p>
        ${extraDetails}
        <p>Please copy <code>config.example.js</code> to <code>config.js</code> and fill in your Firebase project values.</p>
    `;
}

const codexConfig = window.__CODEX_CONFIG__;

if (!codexConfig || typeof codexConfig !== 'object') {
    displayConfigurationError(
        'Codex Vitae configuration is missing.',
        'Define <code>window.__CODEX_CONFIG__</code> in config.js before loading the app.'
    );
    console.error('Codex Vitae configuration is missing. Define window.__CODEX_CONFIG__ in config.js.');
    return;
}

const firebaseConfig = codexConfig.firebaseConfig;
const REQUIRED_FIREBASE_CONFIG_KEYS = Object.freeze([
    'apiKey',
    'authDomain',
    'projectId',
    'appId'
]);

function validateFirebaseConfig(config) {
    if (!config || typeof config !== 'object') {
        return { isValid: false, missingKeys: [...REQUIRED_FIREBASE_CONFIG_KEYS] };
    }

    const missingKeys = REQUIRED_FIREBASE_CONFIG_KEYS.filter(key => {
        const value = config[key];
        return typeof value !== 'string' || value.trim() === '';
    });

    return { isValid: missingKeys.length === 0, missingKeys };
}

const { isValid: firebaseConfigIsValid, missingKeys: firebaseConfigMissingKeys } =
    validateFirebaseConfig(firebaseConfig);
if (!firebaseConfigIsValid) {
    const missingKeysHtml = firebaseConfigMissingKeys
        .map(key => `<code>${key}</code>`)
        .join(', ');
    const details = missingKeysHtml
        ? `Missing values for ${missingKeysHtml}. Update <code>config.js</code> with your Firebase project credentials.`
        : 'Update <code>config.js</code> with your Firebase project credentials.';
    displayConfigurationError('Firebase configuration is incomplete.', details);
    console.error('Firebase configuration is incomplete. Update config.js with Firebase project credentials.', {
        missingKeys: firebaseConfigMissingKeys
    });
    return;
}
const BACKEND_SERVER_URL =
    typeof codexConfig.backendUrl === 'string' ? codexConfig.backendUrl.trim() : '';
const AI_FEATURES_AVAILABLE = BACKEND_SERVER_URL.length > 0;
const AVATAR_ASSETS = Object.freeze({
    modelSrc: 'assets/avatars/codex-vitae-avatar.gltf',
    modelExtensions: Object.freeze(['.glb', '.gltf'])
});
const DEFAULT_AVATAR_MODEL_SRC = 'assets/avatars/codex-vitae-avatar.gltf';
const AVATAR_MODEL_EXTENSIONS = ['.glb', '.gltf'];

if (!firebaseConfig || typeof firebaseConfig !== 'object') {
    displayConfigurationError(
        'Firebase configuration is missing or invalid.',
        'Ensure config.js assigns your Firebase project credentials to <code>firebaseConfig</code>.'
    );
    console.error('Firebase configuration is missing. Ensure config.js exports firebaseConfig.');
    return;
}

if (!AI_FEATURES_AVAILABLE) {
    console.warn(
        'Codex Vitae backendUrl is not configured. AI-powered features will be disabled until it is set.'
    );
}

// --- Firebase Initialization ---
const firebaseApp = (firebase.apps && firebase.apps.length)
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig);
const auth = firebaseApp.auth();
const db = firebaseApp.firestore();
let storage = null;
if (firebaseConfig.storageBucket && typeof firebaseConfig.storageBucket === 'string' && firebaseConfig.storageBucket.trim()) {
    try {
        storage = firebase.storage(firebaseApp);
    } catch (error) {
        console.warn('Firebase Storage could not be initialized:', error);
    }
} else {
    console.warn('Skipping Firebase Storage initialization because no storageBucket was provided in config.js');
}

// --- Get references to HTML elements ---
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const skillsModal = document.getElementById('skills-modal');
const skillTreeTitle = document.getElementById('skill-tree-title');
const skillBackBtn = document.getElementById('skill-back-btn');
const skillSearchForm = document.getElementById('skill-search-form');
const skillSearchInput = document.getElementById('skill-search-input');
const skillTreePanControls = document.getElementById('skill-tree-pan-controls');
const skillPanLeftBtn = document.getElementById('skill-pan-left');
const skillPanRightBtn = document.getElementById('skill-pan-right');
const authEmailInput = document.getElementById('email-input');
const authPasswordInput = document.getElementById('password-input');
const loginButton = document.getElementById('login-btn');
const signupButton = document.getElementById('signup-btn');

const STAT_KEY_METADATA = {
    pwr: { legacyKey: 'strength', label: 'PWR • Force', shortLabel: 'PWR' },
    acc: { legacyKey: 'dexterity', label: 'ACC • Precision', shortLabel: 'ACC' },
    grt: { legacyKey: 'constitution', label: 'GRT • Resilience', shortLabel: 'GRT' },
    cog: { legacyKey: 'intelligence', label: 'COG • Intellect', shortLabel: 'COG' },
    pln: { legacyKey: 'wisdom', label: 'PLN • Foresight', shortLabel: 'PLN' },
    soc: { legacyKey: 'charisma', label: 'SOC • Influence', shortLabel: 'SOC' }
};

const STAT_KEYS = Object.keys(STAT_KEY_METADATA);
const LEGACY_ROLLOVER_THRESHOLD = 1000;
const MAX_MAJOR_STAT_VALUE = 100;
const STATS_PER_PERK_POINT = 10;
const QUARTERLY_MILESTONE_GOAL = 60;
const CAMERA_ORBIT_AZIMUTH_STEP = Math.PI / 24;
const CAMERA_ORBIT_POLAR_STEP = Math.PI / 40;

function getQuarterIdentifier(date) {
    const reference = date instanceof Date ? date : new Date(date);
    if (!(reference instanceof Date) || Number.isNaN(reference.getTime())) {
        return null;
    }
    const quarterIndex = Math.floor(reference.getMonth() / 3) + 1;
    return `${reference.getFullYear()}-Q${quarterIndex}`;
}

function convertMonthStringToQuarter(monthString) {
    if (typeof monthString !== 'string') {
        return null;
    }
    const parts = monthString.split('-');
    if (parts.length < 2) {
        return null;
    }
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
        return null;
    }
    const normalizedMonth = Math.max(1, Math.min(12, Math.floor(month)));
    const quarterIndex = Math.floor((normalizedMonth - 1) / 3) + 1;
    return `${year}-Q${quarterIndex}`;
}

function getStatKeyFromAny(statKey) {
    if (typeof statKey !== 'string') {
        return null;
    }
    const trimmed = statKey.trim();
    if (!trimmed) {
        return null;
    }
    const normalized = trimmed.toLowerCase();
    if (STAT_KEYS.includes(normalized)) {
        return normalized;
    }
    const metadata = getModernStatMetadataFromLegacyKey(normalized);
    return metadata ? metadata.modernKey : null;
}

function getStatMetadata(statKeyOrLegacy) {
    const modernKey = getStatKeyFromAny(statKeyOrLegacy);
    if (!modernKey) {
        return null;
    }
    return { modernKey, ...STAT_KEY_METADATA[modernKey] };
}

function clampMajorStatValue(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.min(MAX_MAJOR_STAT_VALUE, value));
}

function createEmptyPerStatMap(initialValue = 0) {
    const result = {};
    STAT_KEYS.forEach(key => {
        result[key] = typeof initialValue === 'function' ? initialValue(key) : initialValue;
    });
    return result;
}

function extractNumericStatValue(rawStats, modernKey, legacyKey) {
    if (!rawStats || typeof rawStats !== 'object') {
        return null;
    }
    const modernEntry = rawStats[modernKey];
    if (typeof modernEntry === 'number' && Number.isFinite(modernEntry)) {
        return modernEntry;
    }
    if (modernEntry && typeof modernEntry === 'object') {
        if (typeof modernEntry.value === 'number' && Number.isFinite(modernEntry.value)) {
            return modernEntry.value;
        }
        if (typeof modernEntry.score === 'number' && Number.isFinite(modernEntry.score)) {
            return modernEntry.score;
        }
    }
    if (typeof legacyKey === 'string' && legacyKey) {
        const legacyEntry = rawStats[legacyKey];
        if (typeof legacyEntry === 'number' && Number.isFinite(legacyEntry)) {
            return legacyEntry;
        }
        if (legacyEntry && typeof legacyEntry === 'object' && typeof legacyEntry.value === 'number' && Number.isFinite(legacyEntry.value)) {
            return legacyEntry.value;
        }
    }
    return null;
}

function normalizePerStatNumericMap(rawMap, options = {}) {
    const { defaultValue = 0, clamp } = options;
    const normalized = createEmptyPerStatMap(defaultValue);
    if (!rawMap || typeof rawMap !== 'object') {
        return normalized;
    }
    Object.entries(rawMap).forEach(([rawKey, rawValue]) => {
        const statKey = getStatKeyFromAny(rawKey);
        if (!statKey) {
            return;
        }
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
            return;
        }
        const processed = typeof clamp === 'function' ? clamp(rawValue, statKey) : rawValue;
        normalized[statKey] = processed;
    });
    return normalized;
}

function normalizeCharacterStats(rawStats, defaultValue = 8) {
    const normalized = {};
    STAT_KEYS.forEach(key => {
        const metadata = STAT_KEY_METADATA[key];
        const rawValue = extractNumericStatValue(rawStats, key, metadata.legacyKey);
        const fallback = typeof defaultValue === 'function' ? defaultValue(key) : defaultValue;
        const safeValue = clampMajorStatValue(rawValue !== null ? rawValue : fallback);
        normalized[key] = safeValue;
    });
    return normalized;
}

function createEmptyLegacyStat() {
    return { counter: 0, legacyCounter: 0, level: 0, totalEarned: 0 };
}

function getLegacyCounterValue(stat) {
    if (!stat || typeof stat !== 'object') {
        return 0;
    }
    const legacyCounter = typeof stat.legacyCounter === 'number' && Number.isFinite(stat.legacyCounter)
        ? stat.legacyCounter
        : null;
    if (legacyCounter !== null) {
        return Math.max(0, Math.floor(legacyCounter));
    }
    const counter = typeof stat.counter === 'number' && Number.isFinite(stat.counter)
        ? stat.counter
        : 0;
    return Math.max(0, Math.floor(counter));
}

function setLegacyCounterValue(stat, value) {
    if (!stat || typeof stat !== 'object') {
        return 0;
    }
    const sanitized = Math.max(0, Math.min(LEGACY_ROLLOVER_THRESHOLD - 1, Math.floor(value)));
    stat.counter = sanitized;
    stat.legacyCounter = sanitized;
    return sanitized;
}

function createDefaultLegacyState() {
    const stats = {};
    STAT_KEYS.forEach(key => {
        stats[key] = createEmptyLegacyStat();
    });
    return {
        stats,
        totalLevels: 0,
        totalEarned: 0,
        perkPoints: 0
    };
}

function normalizeLegacyState(legacyState) {
    if (!legacyState || typeof legacyState !== 'object') {
        return createDefaultLegacyState();
    }

    const stats = {};
    let totalLevels = 0;
    let totalEarned = 0;

    STAT_KEYS.forEach(key => {
        const raw = legacyState.stats && typeof legacyState.stats === 'object' ? legacyState.stats[key] : null;
        const rawCounter = getLegacyCounterValue(raw);
        const rawLevel = raw && typeof raw.level === 'number' && Number.isFinite(raw.level)
            ? raw.level
            : 0;
        const rawTotalEarned = raw && typeof raw.totalEarned === 'number' && Number.isFinite(raw.totalEarned)
            ? raw.totalEarned
            : rawLevel * LEGACY_ROLLOVER_THRESHOLD + rawCounter;

        const counter = Math.max(0, Math.min(LEGACY_ROLLOVER_THRESHOLD - 1, Math.floor(rawCounter)));
        const level = Math.max(0, Math.floor(rawLevel));
        const totalEarnedValue = Math.max(0, Math.floor(rawTotalEarned));

        const normalizedStat = createEmptyLegacyStat();
        normalizedStat.level = level;
        normalizedStat.totalEarned = totalEarnedValue;
        setLegacyCounterValue(normalizedStat, counter);
        stats[key] = normalizedStat;
        totalLevels += level;
        totalEarned += totalEarnedValue;
    });

    const fallbackLevel = typeof legacyState.totalLevels === 'number' && Number.isFinite(legacyState.totalLevels)
        ? Math.max(totalLevels, Math.floor(legacyState.totalLevels))
        : totalLevels;
    const fallbackEarned = typeof legacyState.totalEarned === 'number' && Number.isFinite(legacyState.totalEarned)
        ? Math.max(totalEarned, Math.floor(legacyState.totalEarned))
        : totalEarned;
    const legacyLevel = typeof legacyState.level === 'number' && Number.isFinite(legacyState.level)
        ? Math.max(fallbackLevel, Math.floor(legacyState.level))
        : fallbackLevel;
    const legacyScore = typeof legacyState.score === 'number' && Number.isFinite(legacyState.score)
        ? Math.max(fallbackEarned, Math.floor(legacyState.score))
        : fallbackEarned;

    const perkPoints = typeof legacyState.perkPoints === 'number' && Number.isFinite(legacyState.perkPoints)
        ? Math.max(0, Math.floor(legacyState.perkPoints))
        : Math.floor(legacyLevel / 5);

    return {
        stats,
        totalLevels: legacyLevel,
        totalEarned: legacyScore,
        perkPoints
    };
}

function sanitizeShardAmount(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.round(value));
}

function extractShardAmount(value) {
    if (typeof value === 'number') {
        return sanitizeShardAmount(value);
    }
    if (!value || typeof value !== 'object') {
        return 0;
    }
    const candidates = ['amount', 'value', 'shards', 'total'];
    for (let index = 0; index < candidates.length; index += 1) {
        const key = candidates[index];
        if (typeof value[key] === 'number' && Number.isFinite(value[key])) {
            return sanitizeShardAmount(value[key]);
        }
    }
    return 0;
}

function extractShardBreakdown(suggestion) {
    if (typeof suggestion === 'number') {
        const amount = sanitizeShardAmount(suggestion);
        return { primary: amount, secondary: 0, total: amount };
    }
    if (Array.isArray(suggestion)) {
        const primary = sanitizeShardAmount(suggestion[0]);
        const secondary = sanitizeShardAmount(suggestion[1]);
        return { primary, secondary, total: primary + secondary };
    }
    if (!suggestion || typeof suggestion !== 'object') {
        return { primary: 0, secondary: 0, total: 0 };
    }

    const primaryCandidates = [
        suggestion.primary,
        suggestion.primaryAmount,
        suggestion.primary_stat,
        suggestion.primary_shards,
        suggestion.main,
        suggestion.focus
    ];
    let primary = 0;
    for (let index = 0; index < primaryCandidates.length && primary === 0; index += 1) {
        primary = extractShardAmount(primaryCandidates[index]);
    }

    const secondaryCandidates = [
        suggestion.secondary,
        suggestion.secondaryAmount,
        suggestion.secondary_stat,
        suggestion.secondary_shards,
        suggestion.offhand
    ];
    let secondary = 0;
    for (let index = 0; index < secondaryCandidates.length && secondary === 0; index += 1) {
        secondary = extractShardAmount(secondaryCandidates[index]);
    }

    const total = sanitizeShardAmount(
        suggestion.total
        ?? suggestion.sum
        ?? suggestion.amount
        ?? suggestion.total_shards
        ?? suggestion.totalShards
    );

    return { primary, secondary, total };
}

function deriveLevelFromTotalStatIncreases(totalStatIncreases) {
    if (!Number.isFinite(totalStatIncreases) || totalStatIncreases <= 0) {
        return 1;
    }
    return Math.max(1, Math.floor(totalStatIncreases / STATS_PER_PERK_POINT) + 1);
}

function getModernStatMetadataFromLegacyKey(legacyKey) {
    if (typeof legacyKey !== 'string') {
        return null;
    }
    const normalizedLegacyKey = legacyKey.trim().toLowerCase();
    const entries = Object.entries(STAT_KEY_METADATA);
    for (let index = 0; index < entries.length; index += 1) {
        const [modernKey, metadata] = entries[index];
        if (metadata.legacyKey === normalizedLegacyKey) {
            return { modernKey, ...metadata };
        }
    }
    return null;
}

function getModernStatShortLabel(statKeyOrLegacy) {
    const metadata = getStatMetadata(statKeyOrLegacy);
    if (metadata && metadata.shortLabel) {
        return metadata.shortLabel;
    }
    if (typeof statKeyOrLegacy === 'string' && statKeyOrLegacy.length > 0) {
        return statKeyOrLegacy.slice(0, 3).toUpperCase();
    }
    return 'STAT';
}

const DEFAULT_DYNAMICS_PARAMS = {
    pwr: { tau0: 28, alpha: 0.08, tl0: 1.0, beta: 0.5, eta0: 1.0, gamma: 0.1, sfloor: 8 },
    acc: { tau0: 21, alpha: 0.07, tl0: 1.0, beta: 0.4, eta0: 0.95, gamma: 0.08, sfloor: 8 },
    grt: { tau0: 35, alpha: 0.06, tl0: 1.0, beta: 0.5, eta0: 0.85, gamma: 0.08, sfloor: 8 },
    cog: { tau0: 60, alpha: 0.05, tl0: 1.0, beta: 0.3, eta0: 0.8, gamma: 0.06, sfloor: 8 },
    pln: { tau0: 45, alpha: 0.05, tl0: 1.0, beta: 0.3, eta0: 0.85, gamma: 0.06, sfloor: 8 },
    soc: { tau0: 30, alpha: 0.07, tl0: 1.0, beta: 0.4, eta0: 0.9, gamma: 0.08, sfloor: 8 }
};

const ABILITY_TOTAL_MIN = 6;
const ABILITY_TOTAL_MAX = 120;

function ensureStatConfidence() {
    if (!characterData.statConfidence) {
        characterData.statConfidence = {};
    }
    Object.keys(STAT_KEY_METADATA).forEach(key => {
        if (typeof characterData.statConfidence[key] !== 'number') {
            characterData.statConfidence[key] = 0.6;
        }
    });
}

function deriveStatSnapshots(rawStats) {
    const normalizedStats = normalizeCharacterStats(rawStats);
    const snapshots = {};
    ensureStatConfidence();
    Object.entries(STAT_KEY_METADATA).forEach(([key]) => {
        const value = typeof normalizedStats[key] === 'number'
            ? normalizedStats[key]
            : 0;
        snapshots[key] = {
            value,
            confidence: characterData.statConfidence?.[key] ?? 0.6
        };
    });
    return snapshots;
}

function calculateAbilitySnapshot(stats) {
    let total = 0;
    Object.values(stats).forEach(snapshot => {
        total += snapshot.value;
    });
    const clampedTotal = Math.max(ABILITY_TOTAL_MIN, Math.min(ABILITY_TOTAL_MAX, total));
    const normalized = (clampedTotal - ABILITY_TOTAL_MIN) / (ABILITY_TOTAL_MAX - ABILITY_TOTAL_MIN);
    const scaled = normalized * 100;
    const level0to100 = Math.floor(scaled);
    const progress01 = scaled - level0to100;
    return {
        stats,
        total: clampedTotal,
        level0to100,
        progress01,
        normalized
    };
}

function updateLegacyCard(legacyState) {
    const normalized = normalizeLegacyState(legacyState);
    const level = normalized.totalLevels;
    const score = Math.max(0, Math.round(normalized.totalEarned));
    const perkPoints = normalized.perkPoints;

    const levelElement = document.getElementById('legacy-level');
    if (levelElement) {
        levelElement.textContent = level.toString();
    }

    const scoreElement = document.getElementById('legacy-score');
    if (scoreElement) {
        scoreElement.textContent = score.toLocaleString();
    }

    const progressText = document.getElementById('legacy-progress-text');
    if (progressText) {
        if (level > 0) {
            progressText.textContent = `Legacy Level ${level} • Infinite progression`;
        } else {
            progressText.textContent = 'Begin your Legacy journey.';
        }
    }

    const progressFill = document.getElementById('legacy-progress-fill');
    if (progressFill) {
        const animationSpeed = Math.max(6, 16 - Math.min(level, 12));
        progressFill.style.setProperty('--legacy-progress-speed', `${animationSpeed}s`);
    }

    const perkPointsElement = document.getElementById('perk-points-available');
    if (perkPointsElement) {
        const availablePerkPoints = typeof characterData?.skillPoints === 'number' && Number.isFinite(characterData.skillPoints)
            ? Math.max(0, Math.floor(characterData.skillPoints))
            : perkPoints;
        perkPointsElement.textContent = availablePerkPoints.toString();
    }

    updatePerkProgressionMeters({ score });
}

function setPerkProgressMeter(barId, textId, current, goal, textFormatter) {
    const safeCurrent = typeof current === 'number' && Number.isFinite(current) ? current : 0;
    const safeGoal = typeof goal === 'number' && goal > 0 ? goal : 1;
    const percent = Math.max(0, Math.min(1, safeCurrent / safeGoal));

    const bar = document.getElementById(barId);
    if (bar) {
        const percentageValue = Math.round(percent * 100);
        bar.style.width = `${percentageValue}%`;
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-valuenow', percentageValue.toString());
    }

    const textElement = document.getElementById(textId);
    if (textElement) {
        if (typeof textFormatter === 'function') {
            textElement.textContent = textFormatter(safeCurrent, safeGoal);
        } else {
            textElement.textContent = `${Math.round(safeCurrent)} / ${Math.round(safeGoal)}`;
        }
    }
}

function updatePerkProgressionMeters(summary) {
    const normalizedLegacy = normalizeLegacyState(characterData?.legacy);
    const totalStatIncreases = typeof characterData?.totalStatIncreases === 'number' && Number.isFinite(characterData.totalStatIncreases)
        ? Math.max(0, Math.floor(characterData.totalStatIncreases))
        : Math.max(0, Math.floor(normalizedLegacy.totalLevels));
    const characterLevel = deriveLevelFromTotalStatIncreases(totalStatIncreases);
    characterData.level = characterLevel;
    const levelElement = document.getElementById('perk-character-level');
    if (levelElement) {
        levelElement.textContent = characterLevel.toString();
    }

    const statsTowardPerk = totalStatIncreases % STATS_PER_PERK_POINT;
    const statsProgressElement = document.getElementById('perk-stats-to-next');
    if (statsProgressElement) {
        statsProgressElement.textContent = `${statsTowardPerk} / ${STATS_PER_PERK_POINT}`;
    }

    if (!characterData || typeof characterData.choreProgress !== 'object') {
        characterData.choreProgress = createEmptyPerStatMap(0);
    }
    STAT_KEYS.forEach(statKey => {
        const legacyStat = normalizedLegacy.stats[statKey] || createEmptyLegacyStat();
        characterData.choreProgress[statKey] = getLegacyCounterValue(legacyStat);
    });

    const shardProgress = (() => {
        let leadingStat = null;
        let leadingValue = 0;
        Object.entries(normalizedLegacy.stats).forEach(([statKey, legacyStat]) => {
            const counter = getLegacyCounterValue(legacyStat);
            if (counter > leadingValue) {
                leadingValue = counter;
                leadingStat = statKey;
            }
        });
        return { statKey: leadingStat, value: leadingValue };
    })();

    const leadingStatLabel = shardProgress.statKey
        ? getModernStatShortLabel(shardProgress.statKey)
        : null;
    const leadingStatElement = document.getElementById('perk-leading-stat');
    if (leadingStatElement) {
        if (leadingStatLabel) {
            const shardValue = Math.round(shardProgress.value);
            leadingStatElement.textContent = `${leadingStatLabel} • ${shardValue.toLocaleString()} / ${LEGACY_ROLLOVER_THRESHOLD.toLocaleString()}`;
        } else {
            leadingStatElement.textContent = '--';
        }
    }

    const shardGoal = LEGACY_ROLLOVER_THRESHOLD;
    setPerkProgressMeter(
        'perk-progress-legacy-bar',
        'perk-progress-legacy-text',
        shardProgress.value,
        shardGoal,
        (current, goal) => {
            const shardProgressText = leadingStatLabel
                ? `${Math.round(current)} / ${goal.toLocaleString()} legacy shards toward next ${leadingStatLabel} stat.`
                : `${Math.round(current)} / ${goal.toLocaleString()} legacy shards logged.`;
            const perkProgressText = `${statsTowardPerk} / ${STATS_PER_PERK_POINT} stat increases counted toward next perk point.`;
            return `${shardProgressText} ${perkProgressText}`;
        }
    );

    const currentQuarterId = getQuarterIdentifier(new Date());
    const hasQuarterData = currentQuarterId
        ? characterData?.activityLogQuarter === currentQuarterId
        : false;
    const quarterlyActivityLog = hasQuarterData && Array.isArray(characterData?.quarterlyActivityLog)
        ? characterData.quarterlyActivityLog
        : [];
    setPerkProgressMeter(
        'perk-progress-quarterly-bar',
        'perk-progress-quarterly-text',
        quarterlyActivityLog.length,
        QUARTERLY_MILESTONE_GOAL,
        (current, goal) => `${current} / ${goal} days logged this quarter.`
    );

    const yearlyGoal = 12000;
    const score = typeof summary?.score === 'number' ? Math.max(0, Math.round(summary.score)) : 0;
    setPerkProgressMeter(
        'perk-progress-yearly-bar',
        'perk-progress-yearly-text',
        score,
        yearlyGoal,
        (current, goal) => `${current.toLocaleString()} / ${goal.toLocaleString()} legacy score this year.`
    );
}

function updateStatRows(stats, legacyState) {
    const normalizedLegacy = normalizeLegacyState(legacyState);

    Object.entries(STAT_KEY_METADATA).forEach(([key, metadata]) => {
        const snapshot = stats[key] || { value: 0, confidence: 0 };
        const abilityValue = clampMajorStatValue(snapshot.value);
        const majorFill = document.getElementById(`${key}-major-bar`);
        const valueElement = document.getElementById(`${key}-value`);
        const majorText = document.getElementById(`${key}-major-text`);
        const confidenceElement = document.getElementById(`${key}-confidence`);
        if (majorFill) {
            majorFill.style.width = `${abilityValue}%`;
            const majorContainer = majorFill.parentElement;
            if (majorContainer) {
                majorContainer.setAttribute('aria-valuenow', abilityValue.toFixed(1));
            }
        }
        if (valueElement) {
            valueElement.textContent = abilityValue.toFixed(1);
        }
        if (majorText) {
            majorText.textContent = `${metadata.shortLabel} ${abilityValue.toFixed(1)}`;
        }
        if (confidenceElement) {
            confidenceElement.textContent = `Q ${snapshot.confidence.toFixed(2)}`;
        }

        const statLegacy = normalizedLegacy.stats[key] || createEmptyLegacyStat();
        const counterValue = getLegacyCounterValue(statLegacy);
        const levelValue = typeof statLegacy.level === 'number' && Number.isFinite(statLegacy.level)
            ? Math.max(0, Math.floor(statLegacy.level))
            : 0;
        const counterForFill = LEGACY_ROLLOVER_THRESHOLD > 0
            ? Math.min(counterValue, LEGACY_ROLLOVER_THRESHOLD)
            : counterValue;
        const fillPercent = LEGACY_ROLLOVER_THRESHOLD > 0
            ? Math.max(0, Math.min(100, (counterForFill / LEGACY_ROLLOVER_THRESHOLD) * 100))
            : 0;

        const legacyFill = document.getElementById(`${key}-legacy-bar`);
        if (legacyFill) {
            legacyFill.style.width = `${fillPercent}%`;
            const legacyContainer = legacyFill.parentElement;
            if (legacyContainer) {
                legacyContainer.setAttribute('aria-valuenow', Math.round(counterValue).toString());
            }
        }

        const legacyText = document.getElementById(`${key}-legacy-text`);
        if (legacyText) {
            legacyText.textContent = `Lvl ${levelValue}`;
        }

        const legacyCounterElement = document.getElementById(`${key}-legacy-counter`);
        if (legacyCounterElement) {
            legacyCounterElement.textContent = `${Math.round(counterValue)} / ${LEGACY_ROLLOVER_THRESHOLD}`;
        }
    });
}

function updateMaintenanceHint(stats) {
    const messageElement = document.getElementById('maintenance-message');
    if (!messageElement) {
        return;
    }
    let leadingStatKey = 'pwr';
    let leadingValue = -Infinity;
    Object.entries(stats).forEach(([key, snapshot]) => {
        if (snapshot.value > leadingValue) {
            leadingValue = snapshot.value;
            leadingStatKey = key;
        }
    });
    const params = DEFAULT_DYNAMICS_PARAMS[leadingStatKey];
    const maintenanceThreshold = params.tl0 + params.beta * Math.max(0, leadingValue - params.sfloor);
    const recommendedMin = Math.max(1, Math.round(maintenanceThreshold * 6));
    const recommendedMax = Math.max(recommendedMin, Math.round(maintenanceThreshold * 8));
    const recentLoad = characterData.recentTrainingLoad?.[leadingStatKey] ?? 0;
    const missingMin = Math.max(0, recommendedMin - recentLoad);
    const missingMax = Math.max(0, recommendedMax - recentLoad);
    messageElement.innerHTML = `At your <strong>${STAT_KEY_METADATA[leadingStatKey].shortLabel} ${leadingValue.toFixed(0)}</strong>, aim for <strong>${recommendedMin}–${recommendedMax} hard sets</strong> this week to maintain. Logged: ${recentLoad}. Missing approximately ${missingMin}–${missingMax}.`;
}

function updatePerkPanel() {
    const container = document.getElementById('perk-chips');
    if (!container) {
        return;
    }
    container.innerHTML = '';
    const unlocked = Array.isArray(characterData.unlockedPerks) ? characterData.unlockedPerks : [];
    if (unlocked.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'No perks yet. Earn Legacy points to unlock them.';
        container.appendChild(empty);
        return;
    }

    unlocked.forEach(perkName => {
        const chip = document.createElement('span');
        chip.className = 'perk-chip';
        chip.dataset.state = 'active';
        chip.innerHTML = `<span>${perkName}</span><small>Active</small>`;
        container.appendChild(chip);
    });
}
function updateCapturedPhotoElement(element, imageSrc) {
    if (!element) {
        return;
    }

    const stageElement = typeof element.closest === 'function'
        ? element.closest('.avatar-stage')
        : (element.parentElement && element.parentElement.classList && element.parentElement.classList.contains('avatar-stage'))
            ? element.parentElement
            : null;

    const applyStageState = (isPlaceholder) => {
        if (!stageElement) {
            return;
        }

        if (isPlaceholder) {
            stageElement.classList.add('is-placeholder');
        } else {
            stageElement.classList.remove('is-placeholder');
        }
    };

    const ensureElementTag = (node, tagName) => {
        if (!node) {
            return null;
        }

        const desiredTag = tagName.toUpperCase();
        if (node.tagName === desiredTag) {
            return node;
        }

        const replacement = document.createElement(tagName.toLowerCase());
        if (node.id) {
            replacement.id = node.id;
        }

        replacement.className = node.className || '';

        if (node.dataset) {
            for (const [key, value] of Object.entries(node.dataset)) {
                replacement.dataset[key] = value;
            }
        }

        const inlineStyle = node.getAttribute && node.getAttribute('style');
        if (inlineStyle) {
            replacement.setAttribute('style', inlineStyle);
        }

        if (typeof node.replaceWith === 'function') {
            node.replaceWith(replacement);
        } else if (node.parentNode) {
            node.parentNode.insertBefore(replacement, node);
            node.parentNode.removeChild(node);
        }

        return replacement;
    };

    const trimmedSrc = typeof imageSrc === 'string' ? imageSrc.trim() : '';
    const hasCustomValue = trimmedSrc.length > 0;
    const lowerSrc = trimmedSrc.toLowerCase();
    const srcWithoutParams = lowerSrc.split(/[?#]/)[0];
    const isModelSrc = hasCustomValue && (
        AVATAR_ASSETS.modelExtensions.some(extension => srcWithoutParams.endsWith(extension))
        || lowerSrc.startsWith('data:model/gltf')
    );
    const usingCustomImage = hasCustomValue && !isModelSrc;

    let activeElement = element;

    if (!hasCustomValue) {
        activeElement = ensureElementTag(activeElement, 'IMG');
        if (!activeElement) {
            return;
        }

        activeElement.classList.remove('avatar-circle', 'avatar-viewer');
        activeElement.classList.add('hidden');
        activeElement.removeAttribute('src');
        activeElement.setAttribute('alt', '');
        applyStageState(true);
        return;
    }

    if (usingCustomImage) {
        activeElement = ensureElementTag(activeElement, 'IMG');
        if (!activeElement) {
            return;
        }

        if (activeElement.getAttribute('src') !== trimmedSrc) {
            activeElement.setAttribute('src', trimmedSrc);
        }

        activeElement.setAttribute('alt', 'Your Avatar');
        activeElement.classList.remove('avatar-circle');
        activeElement.classList.add('avatar-viewer');
        activeElement.classList.remove('hidden');
        applyStageState(false);
        return;
    }

    activeElement = ensureElementTag(activeElement, 'MODEL-VIEWER');
    if (!activeElement) {
        return;
    }

    const viewerSrc = isModelSrc ? trimmedSrc : AVATAR_ASSETS.modelSrc;
    if (activeElement.getAttribute('src') !== viewerSrc) {
        activeElement.setAttribute('src', viewerSrc);
    }

    const emptyAttributes = ['camera-controls', 'auto-rotate'];
    for (const attribute of emptyAttributes) {
        if (activeElement.getAttribute(attribute) !== '') {
            activeElement.setAttribute(attribute, '');
        }
    }

    const enforcedAttributes = [
        ['alt', 'Your Avatar'],
        ['interaction-prompt', 'none'],
        ['camera-target', '0 1.4 0'],
        ['camera-orbit', '0deg 80deg 2.9m'],
        ['min-camera-orbit', '-120deg 60deg 2.6m'],
        ['max-camera-orbit', '120deg 100deg 3.4m'],
        ['field-of-view', '28deg'],
        ['shadow-intensity', '0.65'],
        ['exposure', '1.1']
    ];

    for (const [attribute, value] of enforcedAttributes) {
        if (activeElement.getAttribute(attribute) !== value) {
            activeElement.setAttribute(attribute, value);
        }
    }

    activeElement.removeAttribute('poster');
    activeElement.removeAttribute('reveal');
    activeElement.removeAttribute('disable-zoom');
    activeElement.classList.remove('avatar-circle');
    activeElement.classList.add('avatar-viewer');
    activeElement.classList.remove('hidden');
    applyStageState(false);
}

const skillTreeUtils = window.SkillTreeUtils || {};
const resolveConstellationStarsMap = typeof skillTreeUtils.getConstellationStarsMap === 'function'
    ? (constellationData, constellationName) => skillTreeUtils.getConstellationStarsMap(constellationData, constellationName)
    : (constellationData) => {
        if (!constellationData || typeof constellationData !== 'object') {
            return {};
        }

        if (constellationData.starSystems && typeof constellationData.starSystems === 'object') {
            const aggregated = {};
            for (const system of Object.values(constellationData.starSystems)) {
                if (!system || typeof system !== 'object') {
                    continue;
                }
                const stars = system.stars && typeof system.stars === 'object' ? system.stars : {};
                for (const [starName, starData] of Object.entries(stars)) {
                    aggregated[starName] = starData;
                }
            }
            return aggregated;
        }

        return { ...(constellationData.stars || {}) };
    };

const resolveConstellationStarSystems = typeof skillTreeUtils.getConstellationStarSystems === 'function'
    ? (constellationData, constellationName) => skillTreeUtils.getConstellationStarSystems(constellationData, constellationName)
    : (constellationData, constellationName) => {
        if (!constellationData || typeof constellationData !== 'object') {
            return {};
        }

        if (constellationData.starSystems && typeof constellationData.starSystems === 'object') {
            return constellationData.starSystems;
        }

        if (constellationData.stars && typeof constellationData.stars === 'object') {
            const systemName = `${constellationName || 'Constellation'} Prime`;
            return {
                [systemName]: {
                    type: 'starSystem',
                    stars: { ...(constellationData.stars || {}) }
                }
            };
        }

        return {};
    };

const resolveConstellationStarEntries = typeof skillTreeUtils.getConstellationStarEntries === 'function'
    ? (constellationData, constellationName) => skillTreeUtils.getConstellationStarEntries(constellationData, constellationName)
    : (constellationData, constellationName) => {
        if (!constellationData || typeof constellationData !== 'object') {
            return [];
        }

        const starSystems = resolveConstellationStarSystems(constellationData, constellationName);
        const entries = [];

        if (starSystems && typeof starSystems === 'object' && Object.keys(starSystems).length > 0) {
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

        const stars = constellationData.stars && typeof constellationData.stars === 'object'
            ? constellationData.stars
            : {};
        for (const [starName, starData] of Object.entries(stars)) {
            entries.push({
                starSystemName: null,
                starSystem: null,
                starName,
                starData
            });
        }

        return entries;
    };

const findStarInConstellationSafe = typeof skillTreeUtils.findStarInConstellation === 'function'
    ? (constellationData, starName, constellationName) => skillTreeUtils.findStarInConstellation(constellationData, starName, constellationName)
    : (constellationData, starName) => {
        if (!constellationData || typeof constellationData !== 'object' || typeof starName !== 'string') {
            return null;
        }

        if (constellationData.starSystems && typeof constellationData.starSystems === 'object') {
            for (const [systemName, systemData] of Object.entries(constellationData.starSystems)) {
                const stars = systemData && typeof systemData.stars === 'object' ? systemData.stars : {};
                if (Object.prototype.hasOwnProperty.call(stars, starName)) {
                    return {
                        starData: stars[starName],
                        starSystemName: systemName,
                        starSystem: systemData
                    };
                }
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
    };

const hasConstellationStarSafe = typeof skillTreeUtils.hasConstellationStar === 'function'
    ? (constellationData, starName, constellationName) => skillTreeUtils.hasConstellationStar(constellationData, starName, constellationName)
    : (constellationData, starName) => {
        if (typeof starName !== 'string') {
            return false;
        }
        const stars = resolveConstellationStarsMap(constellationData);
        return Object.prototype.hasOwnProperty.call(stars, starName);
    };

function createStarDetailController() {
    const panel = document.getElementById('star-detail-panel');
    const titleEl = document.getElementById('star-detail-title');
    const locationEl = document.getElementById('star-detail-location');
    const artEl = document.getElementById('star-detail-art');
    const descriptionEl = document.getElementById('star-detail-description');
    const requirementsEl = document.getElementById('star-detail-requirements');
    const unlockBtn = document.getElementById('star-unlock-btn');
    const proofBtn = document.getElementById('star-proof-btn');
    const closeBtn = document.getElementById('star-detail-close');

    if (!panel || !titleEl || !artEl || !descriptionEl || !requirementsEl || !unlockBtn || !proofBtn || !closeBtn) {
        console.warn('Star detail panel elements are missing from the DOM.');
        return {
            show: () => {},
            hide: () => {},
            refresh: () => {}
        };
    }

    let activeStar = null;

    const formatStatName = (stat) => {
        if (!stat || typeof stat !== 'string') {
            return '';
        }
        return stat.charAt(0).toUpperCase() + stat.slice(1);
    };

    const computeInitials = (name) => {
        if (!name) {
            return '★';
        }
        const initials = name
            .split(/\s+/)
            .filter(Boolean)
            .map(part => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();
        return initials || '★';
    };

    const buildLocationLabel = (star) => {
        const parts = [];
        if (star?.galaxy) {
            parts.push(star.galaxy);
        }
        if (star?.constellation) {
            parts.push(star.constellation);
        }
        if (star?.starSystem) {
            parts.push(star.starSystem);
        }
        return parts.join(' • ');
    };

    const refreshCanvas = () => {
        if (skillRenderer && typeof skillRenderer.refreshStars === 'function') {
            skillRenderer.refreshStars();
        }
    };

    const updateStatus = () => {
        if (!activeStar) {
            return;
        }
        activeStar.status = determineStarStatus(activeStar.name, activeStar.data);
        if (activeStar.status) {
            panel.dataset.status = activeStar.status;
        } else {
            delete panel.dataset.status;
        }
    };

    const renderActions = () => {
        if (!activeStar) {
            requirementsEl.innerHTML = '';
            unlockBtn.classList.add('hidden');
            proofBtn.classList.add('hidden');
            return;
        }

        const { data, status } = activeStar;

        if (data.unlock_type === 'perk') {
            unlockBtn.classList.remove('hidden');
            proofBtn.classList.add('hidden');
            const requires = data.requires || {};
            const statName = formatStatName(requires.stat);
            const requiredValue = typeof requires.value === 'number' ? requires.value : null;
            const currentValue = requires.stat ? characterData.stats?.[requires.stat] ?? 0 : null;
            const availablePoints = characterData.skillPoints || 0;

            const requirementLines = [];
            if (requires.stat && requiredValue !== null) {
                let line = `<strong>Requires:</strong> ${requiredValue} ${statName}`;
                if (currentValue !== null) {
                    line += ` (Current: ${currentValue})`;
                }
                requirementLines.push(`<p>${line}</p>`);
            } else {
                requirementLines.push('<p><strong>Requires:</strong> No stat requirement</p>');
            }

            if (requires.skill_points) {
                requirementLines.push(`<p><strong>Perk Points Needed:</strong> ${requires.skill_points}</p>`);
            }

            if (requires.perks && Array.isArray(requires.perks) && requires.perks.length > 0) {
                requirementLines.push(`<p><strong>Requires Unlocking:</strong> ${requires.perks.join(', ')}</p>`);
            }

            if (availablePoints > 0) {
                requirementLines.push(`<p>You have ${availablePoints} Perk Point${availablePoints === 1 ? '' : 's'} available.</p>`);
            }

            requirementsEl.innerHTML = requirementLines.join('');
            unlockBtn.disabled = availablePoints <= 0;
            unlockBtn.dataset.starName = activeStar.name;
        } else if (data.unlock_type === 'credential') {
            proofBtn.classList.remove('hidden');
            unlockBtn.classList.add('hidden');
            const requires = data.requires || {};
            const requirementLines = [];

            if (requires.proof) {
                requirementLines.push(`<p><strong>Proof Needed:</strong> ${requires.proof}</p>`);
            } else {
                requirementLines.push('<p><strong>Proof Needed:</strong> Credential verification required.</p>');
            }

            if (requires.description) {
                requirementLines.push(`<p>${requires.description}</p>`);
            }

            if (status === 'unlocked') {
                requirementLines.push('<p class="success">Credential verified!</p>');
                proofBtn.disabled = true;
            } else {
                proofBtn.disabled = false;
            }

            requirementsEl.innerHTML = requirementLines.join('');
            proofBtn.dataset.starName = activeStar.name;
        } else {
            unlockBtn.classList.add('hidden');
            proofBtn.classList.add('hidden');
            requirementsEl.innerHTML = '<p>No unlock actions available.</p>';
        }
    };

    const renderPanel = () => {
        if (!activeStar) {
            return;
        }

        const { name, data } = activeStar;
        panel.classList.remove('hidden');
        panel.setAttribute('aria-hidden', 'false');

        titleEl.textContent = name;
        locationEl.textContent = buildLocationLabel(data);
        descriptionEl.textContent = data.description || 'No description provided yet.';
        panel.dataset.status = activeStar.status || '';

        if (data.image) {
            artEl.style.backgroundImage = `url(${data.image})`;
            artEl.textContent = '';
        } else {
            artEl.style.backgroundImage = '';
            artEl.textContent = computeInitials(name);
        }

        renderActions();
    };

    const showPanel = (star) => {
        if (!star || !star.data) {
            hidePanel();
            return;
        }

        activeStar = {
            name: star.name,
            data: star.data,
            status: star.status || determineStarStatus(star.name, star.data)
        };

        renderPanel();
    };

    const hidePanel = () => {
        const wasVisible = !panel.classList.contains('hidden');
        panel.classList.add('hidden');
        panel.setAttribute('aria-hidden', 'true');
        delete panel.dataset.status;
        if (skillRenderer && typeof skillRenderer.clearStarFocus === 'function') {
            skillRenderer.clearStarFocus();
        }
        activeStar = null;
        unlockBtn.disabled = false;
        proofBtn.disabled = false;
        proofBtn.classList.add('hidden');
        if (wasVisible) {
            refreshCanvas();
        }
    };

    closeBtn.addEventListener('click', hidePanel);

    unlockBtn.addEventListener('click', () => {
        if (!activeStar || activeStar.data.unlock_type !== 'perk') {
            return;
        }

        const unlocked = unlockPerk(activeStar.name, activeStar.data);
        updateStatus();
        if (unlocked) {
            hidePanel();
        } else {
            renderActions();
        }
    });

    proofBtn.addEventListener('click', () => {
        if (!activeStar || activeStar.data.unlock_type !== 'credential') {
            return;
        }

        if (activeStar.status === 'unlocked') {
            return;
        }

        const proofRequirement = activeStar.data.requires?.proof || 'Credential proof';
        showToast(`To verify this credential, provide: ${proofRequirement}. Submission support is coming soon.`);
    });

    return {
        show: showPanel,
        hide: hidePanel,
        refresh() {
            updateStatus();
            renderActions();
        }
    };
}


const starDetailController = createStarDetailController();

if (!AI_FEATURES_AVAILABLE) {
    const scanFaceButton = document.getElementById('scan-face-btn');
    if (scanFaceButton) {
        scanFaceButton.title = 'Configure backendUrl in config.js to enable AI avatar generation.';
    }
}

window.handleStarSelection = function(star) {
    starDetailController.show(star);
};

// --- Global Data Variables ---
let characterData = {};
let gameManager = {};
let currentSkillPath = [];
let listenersInitialized = false;
let lastAuthAction = null;
let authRequestInFlight = false;
let skillRenderer = null;
const SKILL_TREE_READY_EVENT = 'skillTreeDataReady';

function getCurrentSkillTree() {
    const tree = window.skillTree;
    return tree && typeof tree === 'object' ? tree : null;
}

function skillTreeHasGalaxies(skillTree = getCurrentSkillTree()) {
    if (!skillTree) {
        return false;
    }
    return Object.keys(skillTree).length > 0;
}

function ensureSkillTreeLayout(forceLayout = false) {
    if (!window.SkillTreeUtils || typeof window.SkillTreeUtils.generateProceduralLayout !== 'function') {
        return false;
    }

    const currentTree = getCurrentSkillTree();
    if (!currentTree) {
        return false;
    }

    const updatedTree = window.SkillTreeUtils.generateProceduralLayout(currentTree, {
        clone: true,
        forceLayout
    });

    if (updatedTree && typeof updatedTree === 'object') {
        window.skillTree = updatedTree;
        return true;
    }

    return false;
}

function rebuildSkillUniverseIfReady(options = {}) {
    const { force = false } = options;
    ensureSkillTreeLayout(force);
    if (!skillRenderer || typeof skillRenderer.rebuildUniverse !== 'function') {
        return false;
    }
    if (!skillTreeHasGalaxies()) {
        return false;
    }
    if (!force && !skillRenderer.needsUniverseBuild) {
        return false;
    }
    skillRenderer.rebuildUniverse();
    return true;
}

function handleSkillTreeDataReady(event) {
    const forceRebuild = Boolean(event?.detail?.forceRebuild);
    rebuildSkillUniverseIfReady({ force: forceRebuild });
}

function dispatchSkillTreeDataReady(options = {}) {
    const { force = false } = options;
    ensureSkillTreeLayout(force);
    if (!skillTreeHasGalaxies()) {
        return false;
    }

    const detail = { forceRebuild: force };
    let readyEvent;
    if (typeof window.CustomEvent === 'function') {
        readyEvent = new CustomEvent(SKILL_TREE_READY_EVENT, { detail });
    } else {
        readyEvent = document.createEvent('CustomEvent');
        readyEvent.initCustomEvent(SKILL_TREE_READY_EVENT, false, false, detail);
    }

    window.dispatchEvent(readyEvent);
    return true;
}

window.addEventListener(SKILL_TREE_READY_EVENT, handleSkillTreeDataReady);

// --- Manager Logic ---
function computeChoreShardPlan(source, fallback = {}) {
    const normalizedSource = source && typeof source === 'object' ? source : {};
    const normalizedFallback = fallback && typeof fallback === 'object' ? fallback : {};

    const fallbackStat = normalizedFallback.stat ?? normalizedSource.stat;
    const fallbackEffort = normalizedFallback.effort ?? normalizedSource.effort;
    const fallbackTotal = (() => {
        const sanitized = sanitizeShardAmount(fallbackEffort);
        return sanitized > 0 ? sanitized : 10;
    })();

    let primaryStatKey = getStatKeyFromAny(
        normalizedSource.primary_stat
        ?? normalizedSource.primaryStat
        ?? normalizedFallback.primary_stat
        ?? fallbackStat
    );
    if (!primaryStatKey) {
        primaryStatKey = 'grt';
    }
    const secondaryStatKey = getStatKeyFromAny(
        normalizedSource.secondary_stat
        ?? normalizedSource.secondaryStat
        ?? normalizedFallback.secondary_stat
        ?? normalizedFallback.secondaryStat
    );

    const suggestion = normalizedSource.suggested_shards
        ?? normalizedSource.shards
        ?? normalizedFallback.suggested_shards;
    const breakdown = extractShardBreakdown(suggestion);

    let primaryAmount = breakdown.primary;
    let secondaryAmount = breakdown.secondary;
    let desiredTotal = breakdown.total;

    if (primaryAmount <= 0) {
        const fallbackFromEffort = sanitizeShardAmount(normalizedSource.effort ?? fallbackEffort);
        primaryAmount = fallbackFromEffort > 0 ? fallbackFromEffort : fallbackTotal;
    }
    if (primaryAmount <= 0) {
        primaryAmount = fallbackTotal;
    }

    if (secondaryAmount < 0) {
        secondaryAmount = 0;
    }

    const explicitTotal = sanitizeShardAmount(
        normalizedSource.totalShards
        ?? normalizedSource.total_shards
        ?? normalizedFallback.totalShards
    );
    if (explicitTotal > 0) {
        desiredTotal = explicitTotal;
    }

    if (secondaryStatKey && secondaryAmount <= 0 && desiredTotal > primaryAmount) {
        secondaryAmount = Math.max(0, desiredTotal - primaryAmount);
    }

    let totalShards = primaryAmount;
    if (secondaryStatKey && secondaryAmount > 0) {
        totalShards += secondaryAmount;
    }

    if (desiredTotal > 0) {
        if (totalShards === 0) {
            primaryAmount = desiredTotal;
            secondaryAmount = 0;
            totalShards = desiredTotal;
        } else if (totalShards < desiredTotal) {
            if (secondaryStatKey) {
                secondaryAmount = Math.max(0, desiredTotal - primaryAmount);
                totalShards = primaryAmount + secondaryAmount;
            } else {
                primaryAmount = desiredTotal;
                totalShards = desiredTotal;
            }
        }
    }

    if (totalShards <= 0) {
        primaryAmount = Math.max(1, fallbackTotal);
        secondaryAmount = 0;
        totalShards = primaryAmount;
    }

    const plan = {
        primary: { stat: primaryStatKey, amount: primaryAmount },
        secondary: null,
        total: totalShards
    };

    if (secondaryStatKey && secondaryAmount > 0) {
        plan.secondary = { stat: secondaryStatKey, amount: secondaryAmount };
        plan.total = primaryAmount + secondaryAmount;
    } else {
        plan.total = primaryAmount;
    }

    return plan;
}

function formatChoreShardDetails(shards) {
    if (!shards || typeof shards !== 'object') {
        return '';
    }
    const segments = [];
    const primary = shards.primary;
    if (primary && typeof primary === 'object') {
        const amount = sanitizeShardAmount(primary.amount);
        if (amount > 0) {
            const statLabel = getModernStatShortLabel(primary.stat);
            segments.push(`+${amount} ${statLabel}`);
        }
    }
    const secondary = shards.secondary;
    if (secondary && typeof secondary === 'object') {
        const amount = sanitizeShardAmount(secondary.amount);
        if (amount > 0) {
            const statLabel = getModernStatShortLabel(secondary.stat);
            segments.push(`+${amount} ${statLabel}`);
        }
    }
    return segments.join(' • ');
}

function getChoreShardEntries(chore) {
    if (!chore || typeof chore !== 'object') {
        return [];
    }

    const entries = [];
    const shards = chore.shards && typeof chore.shards === 'object' ? chore.shards : null;

    if (shards && shards.primary && typeof shards.primary === 'object') {
        const primaryStatKey = getStatKeyFromAny(shards.primary.stat ?? chore.stat) || 'grt';
        let primaryAmount = sanitizeShardAmount(shards.primary.amount);
        if (primaryAmount <= 0) {
            primaryAmount = sanitizeShardAmount(shards.primary.value);
        }
        if (primaryAmount <= 0) {
            primaryAmount = sanitizeShardAmount(shards.primary.shards);
        }
        if (primaryAmount <= 0) {
            primaryAmount = sanitizeShardAmount(chore.effort ?? chore.totalShards);
        }
        if (primaryAmount > 0) {
            entries.push({ stat: primaryStatKey, amount: primaryAmount });
        }
    }

    if (shards && shards.secondary && typeof shards.secondary === 'object') {
        const secondaryStatKey = getStatKeyFromAny(shards.secondary.stat);
        let secondaryAmount = sanitizeShardAmount(shards.secondary.amount);
        if (secondaryAmount <= 0) {
            secondaryAmount = sanitizeShardAmount(shards.secondary.value);
        }
        if (secondaryAmount <= 0) {
            secondaryAmount = sanitizeShardAmount(shards.secondary.shards);
        }
        if (secondaryStatKey && secondaryAmount > 0) {
            entries.push({ stat: secondaryStatKey, amount: secondaryAmount });
        }
    }

    if (entries.length === 0) {
        const fallbackStatKey = getStatKeyFromAny(chore.stat) || 'grt';
        let fallbackAmount = sanitizeShardAmount(chore.effort ?? chore.totalShards);
        if (fallbackAmount <= 0) {
            fallbackAmount = 10;
        }
        entries.push({ stat: fallbackStatKey, amount: fallbackAmount });
    }

    return entries;
}

function normalizeStoredChore(chore) {
    if (!chore || typeof chore !== 'object') {
        return null;
    }

    const text = typeof chore.text === 'string' ? chore.text : '';
    if (!text) {
        return null;
    }

    const shardPlan = computeChoreShardPlan(chore, {
        stat: chore.stat ?? chore.primary_stat,
        effort: chore.effort ?? chore.totalShards
    });
    const primaryShard = {
        stat: shardPlan.primary.stat,
        amount: sanitizeShardAmount(shardPlan.primary.amount) || 0
    };
    const secondaryShard = shardPlan.secondary
        ? {
            stat: shardPlan.secondary.stat,
            amount: sanitizeShardAmount(shardPlan.secondary.amount) || 0
        }
        : null;
    const totalShards = (() => {
        const total = sanitizeShardAmount(shardPlan.total);
        const computed = primaryShard.amount + (secondaryShard ? secondaryShard.amount : 0);
        const fallback = computed > 0 ? computed : sanitizeShardAmount(chore.effort ?? chore.totalShards);
        return total > 0 ? total : (fallback > 0 ? fallback : 10);
    })();

    const identifier = typeof chore.id === 'number' && Number.isFinite(chore.id)
        ? chore.id
        : Date.now() + Math.floor(Math.random() * 1000);

    return {
        id: identifier,
        text,
        stat: primaryShard.stat,
        effort: totalShards,
        totalShards,
        shards: {
            primary: primaryShard,
            secondary: secondaryShard
        },
        completed: Boolean(chore.completed)
    };
}

let choreManager = {
    chores: [],
    addChore: async function(text) {
        if (!text) return;

        const classification = await getAIChoreClassification(text);
        const shardPlan = computeChoreShardPlan(classification, {
            stat: classification?.stat,
            effort: classification?.effort
        });
        const primaryShard = {
            stat: shardPlan.primary.stat,
            amount: sanitizeShardAmount(shardPlan.primary.amount) || 0
        };
        const secondaryShard = shardPlan.secondary
            ? {
                stat: shardPlan.secondary.stat,
                amount: sanitizeShardAmount(shardPlan.secondary.amount) || 0
            }
            : null;
        const totalShards = (() => {
            const total = sanitizeShardAmount(shardPlan.total);
            const computed = primaryShard.amount + (secondaryShard ? secondaryShard.amount : 0);
            const fallback = computed > 0 ? computed : sanitizeShardAmount(classification?.effort);
            return total > 0 ? total : (fallback > 0 ? fallback : 10);
        })();

        const newChore = {
            id: Date.now(),
            text: text,
            stat: primaryShard.stat,
            effort: totalShards,
            totalShards,
            shards: {
                primary: primaryShard,
                secondary: secondaryShard
            },
            completed: false
        };
        this.chores.push(newChore);
        updateDashboard();
    },
    applyShards: function(choreId) {
        const choreIndex = this.chores.findIndex(c => c.id === choreId);
        if (choreIndex === -1) return;

        const chore = this.chores[choreIndex];
        const shardEntries = getChoreShardEntries(chore);
        if (!Array.isArray(shardEntries) || shardEntries.length === 0) {
            this.chores.splice(choreIndex, 1);
            updateDashboard();
            return;
        }

        if (!characterData.choreProgress || typeof characterData.choreProgress !== 'object') {
            characterData.choreProgress = createEmptyPerStatMap(0);
        }

        if (!characterData.stats || typeof characterData.stats !== 'object') {
            characterData.stats = normalizeCharacterStats({});
        }

        const normalizedLegacy = normalizeLegacyState(characterData.legacy);
        const baseLegacyLevels = Math.max(0, Math.floor(normalizedLegacy.totalLevels));
        const baseLegacyEarned = Math.max(0, Math.floor(normalizedLegacy.totalEarned));
        characterData.legacy = normalizedLegacy;

        let totalShardsAwarded = 0;
        let totalStatIncreasesGained = 0;

        shardEntries.forEach(entry => {
            const statKey = getStatKeyFromAny(entry.stat) || 'grt';
            const shardGain = sanitizeShardAmount(entry.amount);
            if (shardGain <= 0) {
                return;
            }

            totalShardsAwarded += shardGain;

            const legacyStat = normalizedLegacy.stats[statKey] || createEmptyLegacyStat();
            normalizedLegacy.stats[statKey] = legacyStat;

            const currentCounter = getLegacyCounterValue(legacyStat);
            let updatedCounter = currentCounter + shardGain;
            let rollovers = 0;
            while (updatedCounter >= LEGACY_ROLLOVER_THRESHOLD) {
                updatedCounter -= LEGACY_ROLLOVER_THRESHOLD;
                rollovers += 1;
            }

            setLegacyCounterValue(legacyStat, updatedCounter);
            const statLabel = getModernStatShortLabel(statKey);
            showToast(`+${shardGain} Legacy shards • ${statLabel}`);

            legacyStat.totalEarned = Math.max(0, Math.floor(legacyStat.totalEarned || 0)) + shardGain;
            characterData.choreProgress[statKey] = getLegacyCounterValue(legacyStat);

            if (rollovers > 0) {
                const currentLevel = typeof legacyStat.level === 'number' && Number.isFinite(legacyStat.level)
                    ? Math.max(0, Math.floor(legacyStat.level))
                    : 0;
                legacyStat.level = currentLevel + rollovers;
                totalStatIncreasesGained += rollovers;

                const currentStatValue = typeof characterData.stats[statKey] === 'number' && Number.isFinite(characterData.stats[statKey])
                    ? characterData.stats[statKey]
                    : 0;
                const updatedStatValue = clampMajorStatValue(currentStatValue + rollovers);
                characterData.stats[statKey] = updatedStatValue;

                const plural = rollovers === 1 ? 'level' : 'levels';
                showToast(`Legacy milestone! +${rollovers} ${statLabel} ${plural}.`);
            }
        });

        normalizedLegacy.totalLevels = baseLegacyLevels + totalStatIncreasesGained;
        normalizedLegacy.totalEarned = baseLegacyEarned + totalShardsAwarded;

        const existingTotalStatIncreases = typeof characterData.totalStatIncreases === 'number' && Number.isFinite(characterData.totalStatIncreases)
            ? Math.max(0, Math.floor(characterData.totalStatIncreases))
            : baseLegacyLevels;
        const updatedTotalStatIncreases = existingTotalStatIncreases + totalStatIncreasesGained;
        characterData.totalStatIncreases = updatedTotalStatIncreases;

        const previousLevel = deriveLevelFromTotalStatIncreases(existingTotalStatIncreases);
        const nextLevel = deriveLevelFromTotalStatIncreases(updatedTotalStatIncreases);
        characterData.level = nextLevel;

        if (!Number.isFinite(characterData.skillPoints)) {
            characterData.skillPoints = 0;
        }

        if (nextLevel > previousLevel) {
            const levelsGained = nextLevel - previousLevel;
            const perkPlural = levelsGained === 1 ? 'Perk Point' : 'Perk Points';
            characterData.skillPoints = Math.max(0, Math.floor(characterData.skillPoints)) + levelsGained;
            showToast(`Level up! Level ${nextLevel}. +${levelsGained} ${perkPlural}.`);
            refreshStarAvailability();
        } else {
            characterData.skillPoints = Math.max(0, Math.floor(characterData.skillPoints));
        }

        this.chores.splice(choreIndex, 1);
        logQuarterlyActivity();
        updateDashboard();
    }
};

// --- AUTHENTICATION & DATA FUNCTIONS ---
function sanitizeEmail(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function getFriendlyAuthError(error, mode) {
    if (!error) {
        return 'Something went wrong. Please try again.';
    }

    const normalizedCode = typeof error.code === 'string' ? error.code.toLowerCase() : '';
    const fallbackMessage = typeof error.message === 'string' && error.message.trim()
        ? error.message
        : 'Unable to complete the request. Please try again.';

    const messageByCode = {
        'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
        'auth/invalid-email': 'Enter a valid email address before continuing.',
        'auth/operation-not-allowed': 'Email and password sign-in is disabled for this project.',
        'auth/weak-password': 'Choose a password that is at least 6 characters long.',
        'auth/user-disabled': 'This account has been disabled. Contact support for help.',
        'auth/user-not-found': 'No account found for that email. Double-check the address or sign up.',
        'auth/wrong-password': 'Incorrect password. Please try again.'
    };

    if (normalizedCode === 'auth/missing-password') {
        return mode === 'signup'
            ? 'Create a password that is at least 6 characters long to finish signing up.'
            : 'Enter your password to log in.';
    }

    return messageByCode[normalizedCode] || fallbackMessage;
}

function setButtonState(button, isLoading, loadingLabel) {
    if (!button) {
        return;
    }

    if (isLoading) {
        if (!button.dataset.originalLabel) {
            button.dataset.originalLabel = button.textContent;
        }
        button.disabled = true;
        if (loadingLabel) {
            button.textContent = loadingLabel;
        }
    } else {
        button.disabled = false;
        if (button.dataset.originalLabel) {
            button.textContent = button.dataset.originalLabel;
            delete button.dataset.originalLabel;
        }
    }
}

function toggleAuthButtons(isSubmitting, mode) {
    const activeButton = mode === 'signup' ? signupButton : loginButton;
    const passiveButton = mode === 'signup' ? loginButton : signupButton;
    const loadingLabel = mode === 'signup' ? 'Creating Account…' : 'Logging In…';

    setButtonState(activeButton, isSubmitting, loadingLabel);
    setButtonState(passiveButton, isSubmitting);
}

async function submitEmailAuth(mode) {
    if (authRequestInFlight) {
        return;
    }

    const email = sanitizeEmail(authEmailInput ? authEmailInput.value : '');
    const password = authPasswordInput ? authPasswordInput.value : '';

    if (!email) {
        showToast('Enter your email address to continue.');
        if (authEmailInput) {
            authEmailInput.focus();
        }
        return;
    }

    if (!password || password.length < 6) {
        showToast('Enter a password that is at least 6 characters long.');
        if (authPasswordInput) {
            authPasswordInput.focus();
        }
        return;
    }

    authRequestInFlight = true;
    lastAuthAction = mode;
    toggleAuthButtons(true, mode);

    try {
        if (mode === 'signup') {
            await auth.createUserWithEmailAndPassword(email, password);
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
    } catch (error) {
        console.error('Authentication error:', error);
        showToast(getFriendlyAuthError(error, mode));
    } finally {
        authRequestInFlight = false;
        toggleAuthButtons(false, mode);
    }
}

function handleSignUp(event) {
    if (event) {
        event.preventDefault();
    }
    submitEmailAuth('signup');
}

function handleLogin(event) {
    if (event) {
        event.preventDefault();
    }
    submitEmailAuth('login');
}

function handleLogout() {
    lastAuthAction = null;
    auth.signOut();
}

async function saveData() {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    characterData.chores = choreManager.chores;
    const userRef = db.collection('users').doc(userId);
    const dataToSave = { characterData, gameManager };
    await userRef.set(dataToSave, { merge: true });
    console.log("Data saved to Firestore!");
}

async function loadData(userId) {
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();

        if (!doc.exists) {
            characterData = {};
            gameManager = {};
            choreManager.chores = [];
            return false;
        }

        const loadedData = doc.data() || {};
        const loadedCharacterData = loadedData.characterData;

        if (!loadedCharacterData || !loadedCharacterData.stats) {
            characterData = {};
            gameManager = {};
            choreManager.chores = [];
            return false;
        }

        if (loadedCharacterData.onboardingComplete === false) {
            characterData = {};
            gameManager = {};
            choreManager.chores = [];
            return false;
        }

        const now = new Date();
        const defaultQuarter = getQuarterIdentifier(now) || `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
        const quarterlyActivityLog = Array.isArray(loadedCharacterData.quarterlyActivityLog)
            ? loadedCharacterData.quarterlyActivityLog
            : Array.isArray(loadedCharacterData.monthlyActivityLog)
                ? loadedCharacterData.monthlyActivityLog
                : [];
        const storedQuarter = loadedCharacterData.activityLogQuarter
            || convertMonthStringToQuarter(loadedCharacterData.activityLogMonth)
            || defaultQuarter;
        const quarterlyPerkClaimed = typeof loadedCharacterData.quarterlyPerkClaimed === 'boolean'
            ? loadedCharacterData.quarterlyPerkClaimed
            : Boolean(loadedCharacterData.monthlyPerkClaimed);

        const sanitizedLoadedData = { ...loadedCharacterData };
        delete sanitizedLoadedData.monthlyActivityLog;
        delete sanitizedLoadedData.activityLogMonth;
        delete sanitizedLoadedData.monthlyPerkClaimed;
        delete sanitizedLoadedData.legacyStatProgress;
        delete sanitizedLoadedData.statCounter;
        delete sanitizedLoadedData.statProgress;
        delete sanitizedLoadedData.statsToNextLevel;

        const normalizedLegacy = normalizeLegacyState(loadedCharacterData.legacy);
        const normalizedStats = normalizeCharacterStats(loadedCharacterData.stats);
        const normalizedTrainingLoad = normalizePerStatNumericMap(
            loadedCharacterData.recentTrainingLoad,
            { defaultValue: 0, clamp: value => Math.max(0, value) }
        );
        const normalizedStatConfidence = normalizePerStatNumericMap(
            loadedCharacterData.statConfidence,
            { defaultValue: 0.6, clamp: value => Math.max(0, Math.min(1, value)) }
        );
        const normalizedChoreProgress = createEmptyPerStatMap(statKey => {
            const legacyStat = normalizedLegacy.stats[statKey] || createEmptyLegacyStat();
            return getLegacyCounterValue(legacyStat);
        });
        const normalizedChores = Array.isArray(loadedCharacterData.chores)
            ? loadedCharacterData.chores
                .map(normalizeStoredChore)
                .filter(chore => chore && typeof chore === 'object')
            : [];

        const storedTotalStatIncreases = typeof sanitizedLoadedData.totalStatIncreases === 'number' && Number.isFinite(sanitizedLoadedData.totalStatIncreases)
            ? Math.max(0, Math.floor(sanitizedLoadedData.totalStatIncreases))
            : null;
        const normalizedTotalStatIncreases = storedTotalStatIncreases !== null
            ? storedTotalStatIncreases
            : Math.max(0, Math.floor(normalizedLegacy.totalLevels));
        const normalizedSkillPoints = typeof loadedCharacterData.skillPoints === 'number' && Number.isFinite(loadedCharacterData.skillPoints)
            ? Math.max(0, Math.floor(loadedCharacterData.skillPoints))
            : 0;

        characterData = {
            ...sanitizedLoadedData,
            level: deriveLevelFromTotalStatIncreases(normalizedTotalStatIncreases),
            totalStatIncreases: normalizedTotalStatIncreases,
            skillPoints: normalizedSkillPoints,
            legacy: normalizedLegacy,
            stats: normalizedStats,
            statConfidence: normalizedStatConfidence,
            recentTrainingLoad: normalizedTrainingLoad,
            unlockedPerks: Array.isArray(loadedCharacterData.unlockedPerks)
                ? loadedCharacterData.unlockedPerks
                : [],
            quarterlyActivityLog,
            activityLogQuarter: storedQuarter,
            quarterlyPerkClaimed,
            skillSearchTarget: loadedCharacterData.skillSearchTarget || null,
            choreProgress: normalizedChoreProgress,
            chores: normalizedChores,
            verifiedCredentials: Array.isArray(loadedCharacterData.verifiedCredentials)
                ? loadedCharacterData.verifiedCredentials
                : [],
            verifiedProofs: Array.isArray(loadedCharacterData.verifiedProofs)
                ? loadedCharacterData.verifiedProofs
                : [],
            onboardingComplete: true
        };

        gameManager = loadedData.gameManager || {};
        choreManager.chores = characterData.chores;

        const capturedPhoto = document.getElementById('captured-photo');
        const webcamFeed = document.getElementById('webcam-feed');
        const scanButton = document.getElementById('scan-face-btn');
        updateCapturedPhotoElement(capturedPhoto, characterData.avatarUrl);
        if (webcamFeed) {
            webcamFeed.classList.add('hidden');
        }
        if (scanButton) {
            scanButton.textContent = characterData.avatarUrl ? 'Update Avatar' : 'Scan Your Face & Body';
        }

        syncSkillSearchInputWithTarget(characterData.skillSearchTarget);

        dispatchSkillTreeDataReady({ force: true });
        return true;
    } catch (error) {
        console.error('Failed to load character data:', error);
        return false;
    }
}

// --- CORE FUNCTIONS ---

// --- AI Functions ---
async function getAIChoreClassification(text) {
    if (!AI_FEATURES_AVAILABLE) {
        console.info('AI classification skipped because backendUrl is not configured.');
        return { primary_stat: 'constitution', stat: 'constitution', suggested_shards: { primary: 10 }, effort: 10 };
    }

    try {
        const response = await fetch(`${BACKEND_SERVER_URL}/classify-chore`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${errorText}`);
        }

        const data = await response.json();
        if (!data || typeof data !== 'object') {
            return { primary_stat: 'constitution', stat: 'constitution', suggested_shards: { primary: 10 }, effort: 10 };
        }
        return data;
    } catch (error) {
        console.error("AI classification failed:", error);
        showToast("AI classification failed. Assigning a default chore.");
        return { primary_stat: 'constitution', stat: 'constitution', suggested_shards: { primary: 10 }, effort: 10 };
    }
}


function logQuarterlyActivity() {
    if (!characterData.quarterlyActivityLog) { characterData.quarterlyActivityLog = []; }
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentQuarter = getQuarterIdentifier(now);
    if (!currentQuarter) { return; }
    if (characterData.activityLogQuarter !== currentQuarter) {
        characterData.activityLogQuarter = currentQuarter;
        characterData.quarterlyActivityLog = [];
        characterData.quarterlyPerkClaimed = false;
    }
    if (characterData.quarterlyPerkClaimed) { return; }
    if (!characterData.quarterlyActivityLog.includes(today)) {
        characterData.quarterlyActivityLog.push(today);
        if (characterData.quarterlyActivityLog.length >= QUARTERLY_MILESTONE_GOAL) {
            characterData.skillPoints++;
            characterData.quarterlyPerkClaimed = true;
            showToast("Quarterly Milestone! You earned a Perk Point for your consistency!");
            refreshStarAvailability();
        }
    }
}

function calculateStartingStats() {
    const exerciseValue = parseInt(document.getElementById('exercise-freq').value, 10) || 0;
    const studyValue = parseInt(document.getElementById('study-habit').value, 10) || 0;
    const now = new Date();
    const baseStats = {
        pwr: 8 + exerciseValue,
        acc: 8,
        grt: 8 + exerciseValue,
        cog: 8 + studyValue,
        pln: 8 + studyValue,
        soc: 8
    };
    const statConfidence = createEmptyPerStatMap(() => 0.6);
    const normalizedStats = normalizeCharacterStats(baseStats, key => baseStats[key]);
    const emptyPerStat = createEmptyPerStatMap(0);
    const normalizedLegacy = normalizeLegacyState();

    characterData = {
        level: 1,
        totalStatIncreases: 0,
        stats: normalizedStats,
        statConfidence,
        legacy: normalizedLegacy,
        recentTrainingLoad: { ...emptyPerStat },
        choreProgress: { ...emptyPerStat },
        avatarUrl: '',
        skillPoints: 0,
        unlockedPerks: [],
        verifiedProofs: [],
        verifiedCredentials: [],
        quarterlyActivityLog: [],
        activityLogQuarter: getQuarterIdentifier(now) || `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`,
        quarterlyPerkClaimed: false,
        skillSearchTarget: null,
        chores: [],
        onboardingComplete: true
    };
}

async function handleOnboarding(event) {
    event.preventDefault();

    calculateStartingStats();
    choreManager.chores = [];
    document.getElementById('onboarding-modal').classList.add('hidden');

    updateDashboard();

    try {
        await saveData();
    } catch (error) {
        console.error('Failed to save character data after onboarding:', error);
        showToast('There was a problem saving your character. Please try again.');
    }
}

async function handleFaceScan() {
    if (!AI_FEATURES_AVAILABLE) {
        showToast('Avatar generation is currently disabled. Configure backendUrl in config.js to enable it.');
        return;
    }

    const webcamFeed = document.getElementById('webcam-feed');
    const capturedPhoto = document.getElementById('captured-photo');
    const canvas = document.getElementById('photo-canvas');
    const scanButton = document.getElementById('scan-face-btn');

    if (!webcamFeed.srcObject || !webcamFeed.srcObject.active) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            webcamFeed.srcObject = stream;
            webcamFeed.classList.remove('hidden');
            capturedPhoto.classList.add('hidden');
            scanButton.textContent = 'Capture';
        } catch (error) {
            console.error('Webcam access error:', error);
            alert("Could not access webcam. Please ensure you've given permission.");
        }
        return;
    }

    const context = canvas.getContext('2d');
    canvas.width = webcamFeed.videoWidth;
    canvas.height = webcamFeed.videoHeight;
    context.drawImage(webcamFeed, 0, 0, canvas.width, canvas.height);

    webcamFeed.srcObject.getTracks().forEach(track => track.stop());
    webcamFeed.srcObject = null;

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

    scanButton.textContent = 'Generating Avatar...';
    scanButton.disabled = true;

    try {
        const response = await fetch(`${BACKEND_SERVER_URL}/generate-avatar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                imageBase64,
                prompt: 'Create a stylized RPG avatar that keeps the subject recognizable with heroic lighting.'
            })
        });

        if (!response.ok) {
            throw new Error(await response.text());
        }

        const { imageUrl } = await response.json();
        characterData.avatarUrl = imageUrl;
        updateDashboard();
    } catch (error) {
        console.error('Avatar generation failed:', error);
        alert('Avatar generation failed. Try again later.');
    } finally {
        if (webcamFeed) {
            webcamFeed.classList.add('hidden');
            webcamFeed.srcObject = null;
        }
        updateCapturedPhotoElement(capturedPhoto, characterData.avatarUrl);
        if (scanButton) {
            scanButton.textContent = characterData.avatarUrl ? 'Update Avatar' : 'Scan Your Face & Body';
            scanButton.disabled = false;
        }
    }
}

function updateDashboard() {
    if (!characterData || !characterData.stats) return;

    const statSnapshots = deriveStatSnapshots(characterData.stats);
    const ability = calculateAbilitySnapshot(statSnapshots);
    characterData.abilityNow = ability;
    updateLegacyCard(characterData.legacy);
    updateStatRows(statSnapshots, characterData.legacy);
    updateMaintenanceHint(statSnapshots);
    updatePerkPanel();

    const choreList = document.getElementById('chore-list');
    if (choreList) {
        choreList.innerHTML = '';
        choreManager.chores.forEach(chore => {
            const li = document.createElement('li');
            li.className = 'chore-item';
            const detailText = formatChoreShardDetails(chore.shards);
            const detailMarkup = detailText
                ? `<span class="chore-details">(${detailText})</span>`
                : '';
            li.innerHTML = `
                <span>${chore.text}</span>
                ${detailMarkup}
                <button class="complete-chore-btn">✓</button>
            `;
            li.querySelector('.complete-chore-btn').addEventListener('click', () => choreManager.applyShards(chore.id));
            choreList.appendChild(li);
        });
    }

    const capturedPhoto = document.getElementById('captured-photo');
    const webcamFeed = document.getElementById('webcam-feed');
    const scanButton = document.getElementById('scan-face-btn');
    updateCapturedPhotoElement(capturedPhoto, characterData.avatarUrl);
    if (webcamFeed) {
        webcamFeed.classList.add('hidden');
    }
    if (scanButton) {
        scanButton.textContent = characterData.avatarUrl ? 'Update Avatar' : 'Scan Your Face & Body';
    }

    if (auth.currentUser) saveData();
}

function unlockPerk(perkName, perkData) {
    const availableSkillPoints = characterData.skillPoints || 0;
    const hasSkillPoint = availableSkillPoints > 0;
    const requiresSkillPoint = perkData?.unlock_type === 'perk';
    const stats = characterData.stats || {};
    const verifiedProofs = Array.isArray(characterData.verifiedProofs)
        ? characterData.verifiedProofs
        : [];
    characterData.unlockedPerks = characterData.unlockedPerks || [];
    const unlockedPerks = characterData.unlockedPerks;

    const requires = perkData?.requires || {};
    const requiredValue = requires.value;
    const requiredStatKey = getStatKeyFromAny(requires.stat);
    const hasStatRequirement = requiredStatKey && typeof requiredValue === 'number' && Number.isFinite(requiredValue);
    const statValue = hasStatRequirement ? stats[requiredStatKey] : null;
    const meetsStatRequirement = !hasStatRequirement
        || (typeof statValue === 'number' && Number.isFinite(statValue) && statValue >= requiredValue);

    const requiredProof = requires.proof;
    const hasProofRequirement = typeof requiredProof === 'string' && requiredProof.trim().length > 0;
    const hasSubmittedProof = verifiedProofs.includes(perkName);
    const meetsProofRequirement = !hasProofRequirement || hasSubmittedProof;

    if (requiresSkillPoint && !hasSkillPoint) {
        showToast("Not enough Perk Points!");
        return;
    }
    if (unlockedPerks.includes(perkName)) {
        showToast("Perk already unlocked!");
        return;
    }
    if (!meetsStatRequirement) {
        showToast("Stat requirements not met!");
        return;
    }
    if (hasProofRequirement && !meetsProofRequirement) {
        showToast("Required proof not submitted yet!");
        return;
    }

    if (requiresSkillPoint) {
        characterData.skillPoints = Math.max(availableSkillPoints - 1, 0);
    }
    unlockedPerks.push(perkName);
    showToast(`Perk Unlocked: ${perkName}!`);

    refreshStarAvailability();
    updateDashboard();
}

function refreshStarAvailability() {
    if (skillRenderer && typeof skillRenderer.refreshStars === 'function') {
        skillRenderer.refreshStars();
    }
}

function renderSkillTreeBreadcrumbs(breadcrumbs) {
    const container = document.getElementById('skill-tree-breadcrumbs');
    if (!container) {
        return;
    }

    container.innerHTML = '';
    if (!Array.isArray(breadcrumbs) || breadcrumbs.length === 0) {
        return;
    }

    breadcrumbs.forEach((crumb, index) => {
        const crumbObject = crumb && typeof crumb === 'object' ? crumb : { label: String(crumb || '') };
        const label = typeof crumbObject.label === 'string' ? crumbObject.label.trim() : '';
        if (!label) {
            return;
        }

        const isLast = index === breadcrumbs.length - 1;
        const path = crumbObject && typeof crumbObject.path === 'object' ? crumbObject.path : null;
        const isNavigable = !!(path && !isLast);
        const element = document.createElement(isNavigable ? 'button' : 'span');
        element.className = 'skill-breadcrumb' + (isNavigable ? ' skill-breadcrumb--clickable' : '');
        element.textContent = label;

        if (isNavigable) {
            element.type = 'button';
            element.addEventListener('click', () => {
                requestSkillPath(path);
            });
        }

        container.appendChild(element);

        if (!isLast) {
            const separator = document.createElement('span');
            separator.className = 'skill-breadcrumb-separator';
            separator.textContent = ' › ';
            container.appendChild(separator);
        }
    });
}

function updateSkillTreeUI(title, breadcrumbs, showBack) {
    skillTreeTitle.textContent = title;
    renderSkillTreeBreadcrumbs(breadcrumbs);
    skillBackBtn.classList.toggle('hidden', !showBack);
}

function deriveSkillPathType(path) {
    if (!path || typeof path !== 'object') {
        return null;
    }

    if (path.type === 'galaxy' || path.type === 'constellation' || path.type === 'starSystem' || path.type === 'star') {
        return path.type;
    }

    if (path.star) {
        return 'star';
    }
    if (path.starSystem) {
        return 'starSystem';
    }
    if (path.constellation) {
        return 'constellation';
    }
    if (path.galaxy) {
        return 'galaxy';
    }

    return null;
}

function buildSkillPathLabel(path) {
    if (!path || typeof path !== 'object') {
        return '';
    }

    const parts = [];
    if (typeof path.galaxy === 'string' && path.galaxy) {
        parts.push(path.galaxy);
    }
    if (typeof path.constellation === 'string' && path.constellation) {
        parts.push(path.constellation);
    }
    if (typeof path.starSystem === 'string' && path.starSystem) {
        parts.push(path.starSystem);
    }
    if (typeof path.star === 'string' && path.star) {
        parts.push(path.star);
    }

    return parts.join(' › ');
}

function clonePositionVector(source, fallback = { x: 0, y: 0, z: 0 }) {
    const base = source && typeof source === 'object' ? source : {};
    const safeFallback = fallback && typeof fallback === 'object' ? fallback : { x: 0, y: 0, z: 0 };
    const toFinite = (value, alt) => (Number.isFinite(value) ? value : alt);
    return {
        x: toFinite(base.x, toFinite(safeFallback.x, 0)),
        y: toFinite(base.y, toFinite(safeFallback.y, 0)),
        z: toFinite(base.z, toFinite(safeFallback.z, 0))
    };
}

function isValidSkillPath(path) {
    const pathType = deriveSkillPathType(path);
    if (!pathType) {
        return false;
    }

    const galaxyName = path.galaxy;
    if (typeof galaxyName !== 'string' || !skillTree[galaxyName]) {
        return false;
    }

    if (pathType === 'galaxy') {
        return true;
    }

    const constellationName = path.constellation;
    const constellationData = skillTree[galaxyName]?.constellations?.[constellationName];
    if (typeof constellationName !== 'string' || !constellationData) {
        return false;
    }

    if (pathType === 'constellation') {
        return true;
    }

    const starSystems = resolveConstellationStarSystems(constellationData, constellationName);

    if (pathType === 'starSystem') {
        const starSystemName = path.starSystem;
        return typeof starSystemName === 'string' && Object.prototype.hasOwnProperty.call(starSystems, starSystemName);
    }

    if (pathType === 'star') {
        const starName = path.star;
        if (typeof starName !== 'string') {
            return false;
        }

        const targetSystemName = typeof path.starSystem === 'string' ? path.starSystem : null;

        if (targetSystemName && Object.prototype.hasOwnProperty.call(starSystems, targetSystemName)) {
            const targetSystem = starSystems[targetSystemName];
            const stars = targetSystem?.stars && typeof targetSystem.stars === 'object' ? targetSystem.stars : {};
            return Object.prototype.hasOwnProperty.call(stars, starName);
        }

        return hasConstellationStarSafe(constellationData, starName, constellationName);
    }

    return false;
}

function syncSkillSearchInputWithTarget(target = characterData?.skillSearchTarget) {
    if (!skillSearchInput) {
        return;
    }

    if (document.activeElement === skillSearchInput) {
        return;
    }

    if (target?.query) {
        skillSearchInput.value = target.query;
    } else if (target?.label) {
        skillSearchInput.value = target.label;
    } else {
        skillSearchInput.value = '';
    }

    if (target?.matchQuality === 'partial') {
        skillSearchInput.setAttribute('title', `Showing closest match: ${target.label}`);
    } else if (skillSearchInput.title) {
        skillSearchInput.removeAttribute('title');
    }
}

function restoreSkillSearchTargetNavigation() {
    if (!characterData?.skillSearchTarget) {
        return;
    }

    syncSkillSearchInputWithTarget(characterData.skillSearchTarget);
    const restored = requestSkillPath(characterData.skillSearchTarget);
    if (!restored) {
        if (skillSearchInput) {
            skillSearchInput.value = '';
            skillSearchInput.removeAttribute('title');
        }
        characterData.skillSearchTarget = null;
        if (auth.currentUser) {
            saveData();
        }
    } else {
        const { focusCoordinates: _unusedFocus, ...pathData } = restored;
        characterData.skillSearchTarget = {
            ...characterData.skillSearchTarget,
            ...pathData
        };
        syncSkillSearchInputWithTarget(characterData.skillSearchTarget);
    }
}

function openSkillsModal() {
    if (!skillTreeHasGalaxies()) {
        showToast('Skill tree data is still loading. Please try again in a moment.');
        return;
    }

    rebuildSkillUniverseIfReady();

    starDetailController.hide();

    skillsModal.classList.remove('hidden');
    const canHandleModalInit = skillRenderer && typeof skillRenderer.onModalOpened === 'function';

    if (canHandleModalInit) {
        skillRenderer.onModalOpened();
    } else if (skillRenderer && typeof skillRenderer.handleResize === 'function') {
        skillRenderer.handleResize();
    } else if (skillRenderer && typeof skillRenderer.refreshStars === 'function') {
        skillRenderer.refreshStars();
    }

    syncSkillSearchInputWithTarget();
    restoreSkillSearchTargetNavigation();

    if (skillRenderer && typeof skillRenderer.handleResize === 'function') {
        const schedule = typeof requestAnimationFrame === 'function'
            ? requestAnimationFrame
            : (fn) => setTimeout(fn, 0);
        schedule(() => {
            if (skillRenderer && typeof skillRenderer.handleResize === 'function') {
                skillRenderer.handleResize();
            }
        });
    }
}

function updateSkillTreeUI(title, breadcrumbs, showBack) {
    skillTreeTitle.textContent = title;
    renderSkillTreeBreadcrumbs(breadcrumbs);
    skillBackBtn.classList.toggle('hidden', !showBack);
}

function showToast(message) {
    alert(message);
}

function findSkillTreePath(query) {
    if (!query || typeof query !== 'string') {
        return null;
    }

    const rawQuery = query.trim();
    const normalized = rawQuery.toLowerCase();
    if (!normalized) {
        return null;
    }

    const hasHierarchyDelimiters = /(?:->|>|\/)/.test(rawQuery);

    const pickBestMatch = (names, segment) => {
        const exactMatches = [];
        const partialMatches = [];
        const normalizedSegment = segment.toLowerCase();

        for (const name of names) {
            const normalizedName = name.toLowerCase();
            if (normalizedName === normalizedSegment) {
                exactMatches.push(name);
            } else if (normalizedName.includes(normalizedSegment)) {
                partialMatches.push(name);
            }
        }

        if (exactMatches.length > 0) {
            return { name: exactMatches[0], matchQuality: 'exact' };
        }
        if (partialMatches.length > 0) {
            return { name: partialMatches[0], matchQuality: 'partial' };
        }
        return null;
    };

    const tryResolveHierarchicalQuery = () => {
        if (!hasHierarchyDelimiters) {
            return null;
        }

        const segments = rawQuery
            .split(/(?:->|>|\/)/)
            .map(segment => segment.trim())
            .filter(Boolean);

        if (!segments.length) {
            return null;
        }

        const galaxyMatch = pickBestMatch(Object.keys(skillTree), segments[0]);
        if (!galaxyMatch) {
            return null;
        }

        let matchQuality = galaxyMatch.matchQuality;
        let result = {
            type: 'galaxy',
            galaxy: galaxyMatch.name,
            matchQuality,
            label: buildSkillPathLabel({ galaxy: galaxyMatch.name })
        };

        if (segments.length === 1) {
            return result;
        }

        const constellations = skillTree[galaxyMatch.name]?.constellations || {};
        const constellationMatch = pickBestMatch(Object.keys(constellations), segments[1]);
        if (!constellationMatch) {
            return null;
        }

        matchQuality = matchQuality === 'partial' || constellationMatch.matchQuality === 'partial'
            ? 'partial'
            : 'exact';
        result = {
            type: 'constellation',
            galaxy: galaxyMatch.name,
            constellation: constellationMatch.name,
            matchQuality,
            label: buildSkillPathLabel({ galaxy: galaxyMatch.name, constellation: constellationMatch.name })
        };

        if (segments.length === 2) {
            return result;
        }

        const constellationData = constellations[constellationMatch.name] || {};
        const starSystems = resolveConstellationStarSystems(constellationData, constellationMatch.name);
        const starEntries = resolveConstellationStarEntries(constellationData, constellationMatch.name);

        if (segments.length === 3) {
            if (Object.keys(starSystems).length > 0) {
                const starSystemMatch = pickBestMatch(Object.keys(starSystems), segments[2]);
                if (starSystemMatch) {
                    const nextQuality = starSystemMatch.matchQuality === 'partial' || matchQuality === 'partial' ? 'partial' : 'exact';
                    return {
                        type: 'starSystem',
                        galaxy: galaxyMatch.name,
                        constellation: constellationMatch.name,
                        starSystem: starSystemMatch.name,
                        matchQuality: nextQuality,
                        label: buildSkillPathLabel({
                            galaxy: galaxyMatch.name,
                            constellation: constellationMatch.name,
                            starSystem: starSystemMatch.name
                        })
                    };
                }
            }

            const starMatch = pickBestMatch(starEntries.map(entry => entry.starName), segments[2]);
            if (!starMatch) {
                return null;
            }
            const matchedEntry = starEntries.find(entry => entry.starName === starMatch.name) || null;
            const nextQuality = starMatch.matchQuality === 'partial' || matchQuality === 'partial' ? 'partial' : 'exact';
            return {
                type: 'star',
                galaxy: galaxyMatch.name,
                constellation: constellationMatch.name,
                starSystem: matchedEntry?.starSystemName || null,
                star: starMatch.name,
                matchQuality: nextQuality,
                label: buildSkillPathLabel({
                    galaxy: galaxyMatch.name,
                    constellation: constellationMatch.name,
                    starSystem: matchedEntry?.starSystemName || null,
                    star: starMatch.name
                })
            };
        }

        const starSystemMatch = pickBestMatch(Object.keys(starSystems), segments[2]);
        if (!starSystemMatch) {
            return null;
        }

        const starsInSystem = starSystems[starSystemMatch.name]?.stars || {};
        const starMatch = pickBestMatch(Object.keys(starsInSystem), segments[3]);
        if (!starMatch) {
            return null;
        }

        const finalQuality = matchQuality === 'partial'
            || starSystemMatch.matchQuality === 'partial'
            || starMatch.matchQuality === 'partial'
            ? 'partial'
            : 'exact';

        return {
            type: 'star',
            galaxy: galaxyMatch.name,
            constellation: constellationMatch.name,
            starSystem: starSystemMatch.name,
            star: starMatch.name,
            matchQuality: finalQuality,
            label: buildSkillPathLabel({
                galaxy: galaxyMatch.name,
                constellation: constellationMatch.name,
                starSystem: starSystemMatch.name,
                star: starMatch.name
            })
        };
    };

    const hierarchicalResult = tryResolveHierarchicalQuery();
    if (hierarchicalResult) {
        return hierarchicalResult;
    }

    const matches = {
        starExact: [],
        starPartial: [],
        starSystemExact: [],
        starSystemPartial: [],
        constellationExact: [],
        constellationPartial: [],
        galaxyExact: [],
        galaxyPartial: []
    };

    for (const [galaxyName, galaxyData] of Object.entries(skillTree)) {
        const galaxyNormalized = galaxyName.toLowerCase();
        if (galaxyNormalized === normalized) {
            matches.galaxyExact.push({
                type: 'galaxy',
                galaxy: galaxyName,
                label: buildSkillPathLabel({ galaxy: galaxyName }),
                matchQuality: 'exact'
            });
        } else if (galaxyNormalized.includes(normalized)) {
            matches.galaxyPartial.push({
                type: 'galaxy',
                galaxy: galaxyName,
                label: buildSkillPathLabel({ galaxy: galaxyName }),
                matchQuality: 'partial'
            });
        }

        const constellationEntries = Object.entries(galaxyData.constellations || {});
        for (const [constellationName, constellationData] of constellationEntries) {
            const constellationNormalized = constellationName.toLowerCase();
            if (constellationNormalized === normalized) {
                matches.constellationExact.push({
                    type: 'constellation',
                    galaxy: galaxyName,
                    constellation: constellationName,
                    label: buildSkillPathLabel({ galaxy: galaxyName, constellation: constellationName }),
                    matchQuality: 'exact'
                });
            } else if (constellationNormalized.includes(normalized)) {
                matches.constellationPartial.push({
                    type: 'constellation',
                    galaxy: galaxyName,
                    constellation: constellationName,
                    label: buildSkillPathLabel({ galaxy: galaxyName, constellation: constellationName }),
                    matchQuality: 'partial'
                });
            }

            const starSystems = resolveConstellationStarSystems(constellationData, constellationName);
            for (const [systemName] of Object.entries(starSystems)) {
                const normalizedSystem = (systemName || '').toLowerCase();
                if (!systemName) {
                    continue;
                }
                if (normalizedSystem === normalized) {
                    matches.starSystemExact.push({
                        type: 'starSystem',
                        galaxy: galaxyName,
                        constellation: constellationName,
                        starSystem: systemName,
                        label: buildSkillPathLabel({
                            galaxy: galaxyName,
                            constellation: constellationName,
                            starSystem: systemName
                        }),
                        matchQuality: 'exact'
                    });
                } else if (normalizedSystem.includes(normalized)) {
                    matches.starSystemPartial.push({
                        type: 'starSystem',
                        galaxy: galaxyName,
                        constellation: constellationName,
                        starSystem: systemName,
                        label: buildSkillPathLabel({
                            galaxy: galaxyName,
                            constellation: constellationName,
                            starSystem: systemName
                        }),
                        matchQuality: 'partial'
                    });
                }
            }

            const starEntries = resolveConstellationStarEntries(constellationData, constellationName);
            for (const entry of starEntries) {
                const starName = entry.starName;
                const starNormalized = starName.toLowerCase();
                const starSystemName = entry.starSystemName || null;
                const baseLabel = buildSkillPathLabel({
                    galaxy: galaxyName,
                    constellation: constellationName,
                    starSystem: starSystemName,
                    star: starName
                });

                if (starNormalized === normalized) {
                    matches.starExact.push({
                        type: 'star',
                        galaxy: galaxyName,
                        constellation: constellationName,
                        starSystem: starSystemName,
                        star: starName,
                        label: baseLabel,
                        matchQuality: 'exact'
                    });
                } else if (starNormalized.includes(normalized)) {
                    matches.starPartial.push({
                        type: 'star',
                        galaxy: galaxyName,
                        constellation: constellationName,
                        starSystem: starSystemName,
                        star: starName,
                        label: baseLabel,
                        matchQuality: 'partial'
                    });
                }
            }
        }
    }

    const priorityOrder = [
        matches.starExact,
        matches.starSystemExact,
        matches.constellationExact,
        matches.galaxyExact,
        matches.starPartial,
        matches.starSystemPartial,
        matches.constellationPartial,
        matches.galaxyPartial
    ];

    for (const bucket of priorityOrder) {
        if (bucket.length > 0) {
            return bucket[0];
        }
    }

    return null;
}

function requestSkillPath(path) {
    if (!skillRenderer || typeof skillRenderer.navigateToPath !== 'function') {
        return null;
    }

    if (!isValidSkillPath(path)) {
        return null;
    }

    const normalizedPath = { ...path, type: deriveSkillPathType(path) };
    const galaxyName = normalizedPath.galaxy;
    const constellationName = normalizedPath.constellation;
    const starSystemName = typeof normalizedPath.starSystem === 'string' ? normalizedPath.starSystem : null;
    const starName = typeof normalizedPath.star === 'string' ? normalizedPath.star : null;

    const galaxyData = skillTree[galaxyName] || null;
    const constellationData = galaxyData?.constellations?.[constellationName] || null;
    const starSystems = constellationData ? resolveConstellationStarSystems(constellationData, constellationName) : {};

    if (normalizedPath.type === 'galaxy') {
        delete normalizedPath.constellation;
        delete normalizedPath.starSystem;
        delete normalizedPath.star;
    } else if (normalizedPath.type === 'constellation') {
        delete normalizedPath.starSystem;
        delete normalizedPath.star;
    } else if (normalizedPath.type === 'starSystem') {
        delete normalizedPath.star;
    } else if (normalizedPath.type === 'star' && !starSystemName) {
        const starInfo = constellationData ? findStarInConstellationSafe(constellationData, starName, constellationName) : null;
        if (starInfo && typeof starInfo.starSystemName === 'string') {
            normalizedPath.starSystem = starInfo.starSystemName;
        } else {
            normalizedPath.starSystem = null;
        }
    }

    const focusCoordinates = {};
    if (galaxyData) {
        focusCoordinates.galaxy = clonePositionVector(galaxyData.position);
    }

    let resolvedStarSystemName = typeof normalizedPath.starSystem === 'string' ? normalizedPath.starSystem : null;
    if (normalizedPath.type === 'starSystem' && !resolvedStarSystemName) {
        resolvedStarSystemName = starSystemName;
    }

    if (constellationData) {
        focusCoordinates.constellation = clonePositionVector(constellationData.position, focusCoordinates.galaxy);
    }

    let starSystemData = null;
    if (resolvedStarSystemName && Object.prototype.hasOwnProperty.call(starSystems, resolvedStarSystemName)) {
        starSystemData = starSystems[resolvedStarSystemName];
        focusCoordinates.starSystem = clonePositionVector(starSystemData?.position, focusCoordinates.constellation);
    }

    let starData = null;
    if (normalizedPath.type === 'star' && starName) {
        if (starSystemData && starSystemData.stars && typeof starSystemData.stars === 'object') {
            starData = starSystemData.stars[starName] || null;
        }

        if (!starData && constellationData) {
            const starInfo = findStarInConstellationSafe(constellationData, starName, constellationName);
            if (starInfo) {
                starData = starInfo.starData || null;
                if (!resolvedStarSystemName && starInfo.starSystemName) {
                    normalizedPath.starSystem = starInfo.starSystemName;
                    resolvedStarSystemName = starInfo.starSystemName;
                    if (starInfo.starSystem) {
                        focusCoordinates.starSystem = clonePositionVector(starInfo.starSystem.position, focusCoordinates.constellation);
                    }
                }
            }
        }

        if (starData) {
            focusCoordinates.star = clonePositionVector(starData.position, focusCoordinates.starSystem || focusCoordinates.constellation);
        }
    }

    normalizedPath.label = buildSkillPathLabel(normalizedPath);
    normalizedPath.focusCoordinates = focusCoordinates;

    const navigationSucceeded = !!skillRenderer.navigateToPath({ ...normalizedPath });
    return navigationSucceeded ? normalizedPath : null;
}

window.requestSkillPath = requestSkillPath;

function showToast(message) {
    alert(message);
}

function determineStarStatus(starName, starData) {
    if (!starData || !characterData) {
        return 'locked';
    }

    if (starData.unlock_type === 'perk') {
        if (Array.isArray(characterData.unlockedPerks) && characterData.unlockedPerks.includes(starName)) {
            return 'unlocked';
        }

        const requiredStat = starData.requires?.stat;
        const requiredValue = typeof starData.requires?.value === 'number' ? starData.requires.value : null;
        const currentValue = requiredStat ? characterData.stats?.[requiredStat] ?? 0 : null;

        if (requiredStat && requiredValue !== null && currentValue >= requiredValue) {
            return 'available';
        }

        return 'locked';
    }

    if (starData.unlock_type === 'credential') {
        if (Array.isArray(characterData.verifiedCredentials) && characterData.verifiedCredentials.includes(starName)) {
            return 'unlocked';
        }
        return 'locked';
    }

    return 'locked';
}


function setupEventListeners() {
    if (listenersInitialized) {
        return;
    }

    const choreInput = document.getElementById('chore-input');
    if (choreInput) {
        const handleAddChore = async () => {
            const text = choreInput.value.trim();
            if (!text) {
                return;
            }

            choreInput.disabled = true;
            try {
                await choreManager.addChore(text);
                choreInput.value = '';
            } finally {
                choreInput.disabled = false;
                choreInput.focus();
            }
        };

        choreInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                handleAddChore();
            }
        });
    }

    const codexModal = document.getElementById('codex-modal');
    const openCodexBtn = document.getElementById('open-codex-btn');
    const closeCodexBtn = document.getElementById('close-codex-btn');
    const codexSkillsBtn = document.getElementById('codex-skills-btn');
    const codexLogoutBtn = document.getElementById('codex-logout-btn');

    if (openCodexBtn && codexModal) {
        openCodexBtn.addEventListener('click', () => {
            codexModal.classList.remove('hidden');
        });
    }

    if (closeCodexBtn && codexModal) {
        closeCodexBtn.addEventListener('click', () => {
            codexModal.classList.add('hidden');
        });
    }

    if (codexSkillsBtn && codexModal) {
        codexSkillsBtn.addEventListener('click', () => {
            codexModal.classList.add('hidden');
            openSkillsModal();
        });
    }

    if (codexLogoutBtn) {
        codexLogoutBtn.addEventListener('click', handleLogout);
    }

    const closeSkillsBtn = document.getElementById('close-skills-btn');
    if (closeSkillsBtn) {
        closeSkillsBtn.addEventListener('click', () => {
            starDetailController.hide();
            skillsModal.classList.add('hidden');
        });
    }

    const nudgeConstellations = (delta) => {
        if (skillRenderer && typeof skillRenderer.adjustConstellationOffset === 'function') {
            skillRenderer.adjustConstellationOffset(delta);
        }
    };

    if (skillPanLeftBtn) {
        skillPanLeftBtn.addEventListener('click', () => nudgeConstellations(-CONSTELLATION_PAN_NUDGE));
    }

    if (skillPanRightBtn) {
        skillPanRightBtn.addEventListener('click', () => nudgeConstellations(CONSTELLATION_PAN_NUDGE));
    }

    if (skillBackBtn) {
        skillBackBtn.addEventListener('click', () => {
            starDetailController.hide();
            if (skillRenderer && typeof skillRenderer.goBack === 'function') {
                skillRenderer.goBack();
            }
        });
    }

    if (skillSearchForm && skillSearchInput) {
        const toggleSearchFocus = (isActive) => {
            skillSearchForm.classList.toggle('search-active', isActive);
        };

        skillSearchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const query = skillSearchInput.value.trim();

            if (!query) {
                skillSearchInput.value = '';
                characterData.skillSearchTarget = null;
                if (auth.currentUser) {
                    saveData();
                }
                skillSearchInput.removeAttribute('title');
                toggleSearchFocus(false);
                return;
            }

            const result = findSkillTreePath(query);

            if (!result) {
                showToast('No matching skill found.');
                skillSearchInput.removeAttribute('title');
                return;
            }

            const target = {
                ...result,
                query,
                timestamp: Date.now()
            };

            const navigationResult = requestSkillPath(target);
            if (!navigationResult) {
                showToast('Unable to navigate to the selected result.');
                return;
            }

            if (result.matchQuality === 'partial') {
                skillSearchInput.setAttribute('title', `Showing closest match: ${navigationResult.label || target.label}`);
            } else {
                skillSearchInput.removeAttribute('title');
            }

            const { focusCoordinates: _unusedFocus, ...pathData } = navigationResult;
            const enrichedTarget = {
                ...target,
                ...pathData
            };

            characterData.skillSearchTarget = enrichedTarget;
            if (auth.currentUser) {
                saveData();
            }

            skillSearchInput.blur();
            setTimeout(() => syncSkillSearchInputWithTarget(enrichedTarget), 0);
        });

        skillSearchInput.addEventListener('focus', () => toggleSearchFocus(true));
        skillSearchInput.addEventListener('blur', () => toggleSearchFocus(false));
        skillSearchInput.addEventListener('input', () => {
            if (skillSearchInput.title) {
                skillSearchInput.removeAttribute('title');
            }
        });
    }

    const scanFaceButton = document.getElementById('scan-face-btn');
    if (scanFaceButton) {
        scanFaceButton.addEventListener('click', handleFaceScan);
    }

    listenersInitialized = true;
}

// --- APP INITIALIZATION & AUTH STATE LISTENER ---
auth.onAuthStateChanged(async user => {
    if (user) {
        const hasData = await loadData(user.uid);
        const isFirstSignIn = user.metadata && user.metadata.creationTime === user.metadata.lastSignInTime;
        const shouldShowOnboarding = !hasData && (isFirstSignIn || lastAuthAction !== 'login');
        const onboardingModal = document.getElementById('onboarding-modal');
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        if (hasData) {
            onboardingModal.classList.add('hidden');
            updateDashboard();
        } else if (shouldShowOnboarding) {
            onboardingModal.classList.remove('hidden');
        } else {
            onboardingModal.classList.add('hidden');
        }
        setupEventListeners();
        lastAuthAction = null;
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        document.getElementById('onboarding-modal').classList.add('hidden');
        characterData = {};
        choreManager.chores = [];
        syncSkillSearchInputWithTarget(null);
        lastAuthAction = null;
    }
});

const authInputs = [authEmailInput, authPasswordInput].filter(Boolean);
authInputs.forEach(input => {
    input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        submitEmailAuth(event.shiftKey ? 'signup' : 'login');
    });
});

if (loginButton) {
    loginButton.addEventListener('click', handleLogin);
}

if (signupButton) {
    signupButton.addEventListener('click', handleSignUp);
}

const onboardingForm = document.getElementById('onboarding-form');
if (onboardingForm) {
    onboardingForm.addEventListener('submit', handleOnboarding);
}


const skillTreeContainer = document.getElementById('skill-tree-canvas-container');
if (typeof window.SkillUniverseRenderer === 'function') {
    skillRenderer = new window.SkillUniverseRenderer({
        container: skillTreeContainer,
        getSkillTree: () => window.skillTree || {},
        resolveStarStatus: (starName, starData) => determineStarStatus(starName, starData),
        onSelectStar: (starInfo) => {
            if (typeof handleStarSelection === 'function') {
                handleStarSelection(starInfo);
            }
        },
        onViewChange: ({ title, breadcrumbs, showBack }) => {
            updateSkillTreeUI(title, breadcrumbs, showBack);
        }
    });

    rebuildSkillUniverseIfReady();
} else {
    console.warn(
        'SkillUniverseRenderer is unavailable. Three.js failed to load, so the 3D skill tree will be disabled.'
    );
    if (skillTreeContainer) {
        skillTreeContainer.innerHTML =
            '<p class="skill-tree-unavailable">3D skill tree unavailable (offline or missing Three.js).</p>';
    }
}

})();


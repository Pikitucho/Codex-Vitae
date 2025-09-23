// js/main.js

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
    throw new Error(
        'Codex Vitae configuration is missing. Define window.__CODEX_CONFIG__ in config.js.'
    );
}

const firebaseConfig = codexConfig.firebaseConfig;
const BACKEND_SERVER_URL =
    typeof codexConfig.backendUrl === 'string' ? codexConfig.backendUrl.trim() : '';
const AI_FEATURES_AVAILABLE = BACKEND_SERVER_URL.length > 0;
const DEFAULT_AVATAR_MODEL_SRC = 'assets/avatars/codex-vitae-avatar.gltf';
const AVATAR_MODEL_EXTENSIONS = ['.glb', '.gltf'];

if (!firebaseConfig || typeof firebaseConfig !== 'object') {
    displayConfigurationError(
        'Firebase configuration is missing or invalid.',
        'Ensure config.js assigns your Firebase project credentials to <code>firebaseConfig</code>.'
    );
    throw new Error(
        'Firebase configuration is missing. Ensure config.js exports firebaseConfig.'
    );
}

if (!AI_FEATURES_AVAILABLE) {
    console.warn(
        'Codex Vitae backendUrl is not configured. AI-powered features will be disabled until it is set.'
    );
}

// --- Firebase Initialization ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let storage = null;
if (firebaseConfig.storageBucket && typeof firebaseConfig.storageBucket === 'string' && firebaseConfig.storageBucket.trim()) {
    try {
        storage = firebase.storage();
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

const STAT_KEY_METADATA = {
    pwr: { legacyKey: 'strength', label: 'PWR • Force', shortLabel: 'PWR' },
    acc: { legacyKey: 'dexterity', label: 'ACC • Precision', shortLabel: 'ACC' },
    grt: { legacyKey: 'constitution', label: 'GRT • Resilience', shortLabel: 'GRT' },
    cog: { legacyKey: 'intelligence', label: 'COG • Intellect', shortLabel: 'COG' },
    pln: { legacyKey: 'wisdom', label: 'PLN • Foresight', shortLabel: 'PLN' },
    soc: { legacyKey: 'charisma', label: 'SOC • Influence', shortLabel: 'SOC' }
};

function getModernStatMetadataFromLegacyKey(legacyKey) {
    const entries = Object.entries(STAT_KEY_METADATA);
    for (let index = 0; index < entries.length; index += 1) {
        const [modernKey, metadata] = entries[index];
        if (metadata.legacyKey === legacyKey) {
            return { modernKey, ...metadata };
        }
    }
    return null;
}

function getModernStatShortLabel(legacyKey) {
    const metadata = getModernStatMetadataFromLegacyKey(legacyKey);
    if (metadata && metadata.shortLabel) {
        return metadata.shortLabel;
    }
    if (typeof legacyKey === 'string' && legacyKey.length > 0) {
        return legacyKey.slice(0, 3).toUpperCase();
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
    const snapshots = {};
    ensureStatConfidence();
    Object.entries(STAT_KEY_METADATA).forEach(([key, metadata]) => {
        const legacyValue = typeof rawStats?.[metadata.legacyKey] === 'number'
            ? rawStats[metadata.legacyKey]
            : null;
        const modernValue = rawStats?.[key] && typeof rawStats[key] === 'object'
            ? rawStats[key].value
            : (typeof rawStats?.[key] === 'number' ? rawStats[key] : null);
        const value = typeof modernValue === 'number'
            ? modernValue
            : (typeof legacyValue === 'number' ? legacyValue : 8);
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
    const level = typeof legacyState?.level === 'number' ? legacyState.level : 0;
    const rawScore = typeof legacyState?.score === 'number' ? legacyState.score : 0;
    const score = Math.max(0, Math.round(rawScore));
    const perkPoints = typeof legacyState?.perkPoints === 'number'
        ? legacyState.perkPoints
        : (typeof characterData?.skillPoints === 'number' ? characterData.skillPoints : 0);

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
        perkPointsElement.textContent = perkPoints.toString();
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
    const totalChoreProgress = (() => {
        if (!characterData || typeof characterData.choreProgress !== 'object') {
            return 0;
        }
        return Object.values(characterData.choreProgress).reduce((sum, value) => {
            if (typeof value === 'number' && Number.isFinite(value)) {
                return sum + value;
            }
            return sum;
        }, 0);
    })();

    const trackedStats = characterData && characterData.choreProgress
        ? Object.keys(characterData.choreProgress).length
        : 0;
    const defaultStatsCount = Object.keys(STAT_KEY_METADATA).length;
    const choreGoal = Math.max(1, (trackedStats || defaultStatsCount) * 1000);
    setPerkProgressMeter(
        'perk-progress-chores-bar',
        'perk-progress-chores-text',
        totalChoreProgress,
        choreGoal,
        (current, goal) => `${Math.round(current)} / ${goal.toLocaleString()} legacy momentum logged from chores.`
    );

    const monthlyActivityLog = Array.isArray(characterData?.monthlyActivityLog)
        ? characterData.monthlyActivityLog
        : [];
    const monthlyGoal = 25;
    setPerkProgressMeter(
        'perk-progress-monthly-bar',
        'perk-progress-monthly-text',
        monthlyActivityLog.length,
        monthlyGoal,
        (current, goal) => `${current} / ${goal} days logged this month.`
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

function updateStatRows(stats, legacyShares) {
    Object.entries(STAT_KEY_METADATA).forEach(([key, metadata]) => {
        const snapshot = stats[key];
        const majorBar = document.getElementById(`${key}-major-bar`);
        const legacyBar = document.getElementById(`${key}-legacy-bar`);
        const valueElement = document.getElementById(`${key}-value`);
        const majorText = document.getElementById(`${key}-major-text`);
        const confidenceElement = document.getElementById(`${key}-confidence`);
        const legacyText = document.getElementById(`${key}-legacy-text`);
        if (majorBar) {
            const percent = Math.max(0, Math.min(100, (snapshot.value / 20) * 100));
            majorBar.style.width = `${percent}%`;
            majorBar.setAttribute('aria-valuenow', snapshot.value.toFixed(2));
        }
        if (valueElement) {
            valueElement.textContent = snapshot.value.toFixed(1);
        }
        if (majorText) {
            majorText.textContent = `${metadata.shortLabel} ${snapshot.value.toFixed(1)}`;
        }
        if (confidenceElement) {
            confidenceElement.textContent = `Q ${snapshot.confidence.toFixed(2)}`;
        }
        const legacyValue = Math.max(0, Math.min(100, legacyShares?.[key] ?? 0));
        if (legacyBar) {
            legacyBar.style.width = `${legacyValue}%`;
            legacyBar.setAttribute('aria-valuenow', legacyValue.toFixed(1));
        }
        if (legacyText) {
            legacyText.textContent = `Legacy ${legacyValue.toFixed(0)}`;
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
    const lowerSrc = trimmedSrc.toLowerCase();
    const srcWithoutParams = lowerSrc.split(/[?#]/)[0];
    const hasCustomValue = trimmedSrc.length > 0;
    const isModelSrc = hasCustomValue && (
        AVATAR_MODEL_EXTENSIONS.some(extension => srcWithoutParams.endsWith(extension))
        || lowerSrc.startsWith('data:model/gltf')
    );
    const usingCustomImage = hasCustomValue && !isModelSrc;

    let activeElement = element;

    if (usingCustomImage) {
        activeElement = ensureElementTag(activeElement, 'IMG');
        if (!activeElement) {
            return;
        }

        if (activeElement.getAttribute('src') !== trimmedSrc) {
            activeElement.setAttribute('src', trimmedSrc);
        }

        activeElement.setAttribute('alt', 'Your Avatar');
        activeElement.classList.remove('avatar-circle', 'avatar-placeholder');
        activeElement.classList.add('avatar-viewer');
        activeElement.classList.remove('hidden');
        return;
    }

    activeElement = ensureElementTag(activeElement, 'MODEL-VIEWER');
    if (!activeElement) {
        return;
    }

    const viewerSrc = isModelSrc ? trimmedSrc : DEFAULT_AVATAR_MODEL_SRC;
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
    activeElement.classList.remove('avatar-circle', 'avatar-placeholder');
    activeElement.classList.add('avatar-viewer');
    activeElement.classList.remove('hidden');
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

const CONSTELLATION_PAN_NUDGE = 80;

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
const levelManager = {
    gainStatProgress: function(amount) {
        if (!characterData) return;
        characterData.statProgress += amount;
        while (characterData.statProgress >= characterData.statsToNextLevel) {
            this.levelUp();
        }
        updateDashboard();
    },
    levelUp: function() {
        characterData.level++;
        characterData.statProgress -= characterData.statsToNextLevel;
        showToast(`Congratulations! You've reached Level ${characterData.level}!`);

        if (characterData.level % 10 === 0) {
            characterData.skillPoints++;
            showToast(`Level ${characterData.level} Milestone! You earned a Perk Point!`);
            refreshStarAvailability();
        }
    }
};

let choreManager = {
    chores: [],
    addChore: async function(text) {
        if (!text) return;
        
        const classification = await getAIChoreClassification(text);
        const stat = classification?.stat || 'constitution';
        const effort = typeof classification?.effort === 'number' ? classification.effort : 10;

        const newChore = {
            id: Date.now(),
            text: text,
            stat,
            effort,
            completed: false
        };
        this.chores.push(newChore);
        updateDashboard();
    },
    completeChore: function(choreId) {
        const choreIndex = this.chores.findIndex(c => c.id === choreId);
        if (choreIndex === -1) return;

        const chore = this.chores[choreIndex];
        
        characterData.choreProgress[chore.stat] += chore.effort;
        const statLabel = getModernStatShortLabel(chore.stat);
        showToast(`+${chore.effort} Legacy momentum • ${statLabel}`);

        if (characterData.choreProgress[chore.stat] >= 1000) {
            const pointsGained = Math.floor(characterData.choreProgress[chore.stat] / 1000);
            characterData.choreProgress[chore.stat] %= 1000;
            characterData.stats[chore.stat] += pointsGained;
            levelManager.gainStatProgress(pointsGained);
            const plural = pointsGained === 1 ? 'level' : 'levels';
            showToast(`Legacy milestone! +${pointsGained} ${statLabel} ${plural}.`);
        }

        this.chores.splice(choreIndex, 1);
        logMonthlyActivity();
        updateDashboard();
    }
};

// --- AUTHENTICATION & DATA FUNCTIONS ---
function handleSignUp() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    lastAuthAction = 'signup';
    auth.createUserWithEmailAndPassword(email, password).catch(error => alert(error.message));
}

function handleLogin() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    lastAuthAction = 'login';
    auth.signInWithEmailAndPassword(email, password).catch(error => alert(error.message));
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
        const defaultMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

        characterData = {
            ...loadedCharacterData,
            level: loadedCharacterData.level || 1,
            statProgress: loadedCharacterData.statProgress || 0,
            statsToNextLevel: loadedCharacterData.statsToNextLevel || 10,
            skillPoints: loadedCharacterData.skillPoints || 0,
            legacy: loadedCharacterData.legacy || { score: 0, level: 0, perkPoints: loadedCharacterData.skillPoints || 0, perStatShares: {} },
            statConfidence: loadedCharacterData.statConfidence || {},
            recentTrainingLoad: loadedCharacterData.recentTrainingLoad || {},
            unlockedPerks: Array.isArray(loadedCharacterData.unlockedPerks)
                ? loadedCharacterData.unlockedPerks
                : [],
            monthlyActivityLog: Array.isArray(loadedCharacterData.monthlyActivityLog)
                ? loadedCharacterData.monthlyActivityLog
                : [],
            activityLogMonth: loadedCharacterData.activityLogMonth || defaultMonth,
            monthlyPerkClaimed: Boolean(loadedCharacterData.monthlyPerkClaimed),
            skillSearchTarget: loadedCharacterData.skillSearchTarget || null,
            choreProgress: {
                strength: loadedCharacterData.choreProgress?.strength || 0,
                dexterity: loadedCharacterData.choreProgress?.dexterity || 0,
                constitution: loadedCharacterData.choreProgress?.constitution || 0,
                intelligence: loadedCharacterData.choreProgress?.intelligence || 0,
                wisdom: loadedCharacterData.choreProgress?.wisdom || 0,
                charisma: loadedCharacterData.choreProgress?.charisma || 0
            },
            chores: Array.isArray(loadedCharacterData.chores) ? loadedCharacterData.chores : [],
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
        return { stat: 'constitution', effort: 10 };
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
        return data; // { stat, effort }
    } catch (error) {
        console.error("AI classification failed:", error);
        showToast("AI classification failed. Assigning a default chore.");
        return { stat: 'constitution', effort: 10 };
    }
}


function logMonthlyActivity() {
    if (!characterData.monthlyActivityLog) { characterData.monthlyActivityLog = []; }
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentMonth = now.getFullYear() + '-' + (now.getMonth() + 1);
    if (characterData.activityLogMonth !== currentMonth) {
        characterData.activityLogMonth = currentMonth;
        characterData.monthlyActivityLog = [];
        characterData.monthlyPerkClaimed = false;
    }
    if (characterData.monthlyPerkClaimed) { return; }
    if (!characterData.monthlyActivityLog.includes(today)) {
        characterData.monthlyActivityLog.push(today);
        if (characterData.monthlyActivityLog.length >= 25) {
            characterData.skillPoints++;
            characterData.monthlyPerkClaimed = true;
            showToast("Monthly Milestone! You earned a Perk Point for your consistency!");
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
    const statConfidence = {};
    Object.keys(STAT_KEY_METADATA).forEach(key => {
        statConfidence[key] = 0.6;
    });

    characterData = {
        level: 1,
        statProgress: 0,
        statsToNextLevel: 10,
        stats: {
            strength: baseStats.pwr,
            dexterity: baseStats.acc,
            constitution: baseStats.grt,
            intelligence: baseStats.cog,
            wisdom: baseStats.pln,
            charisma: baseStats.soc
        },
        statConfidence,
        legacy: { score: 0, level: 0, perkPoints: 0, perStatShares: {} },
        recentTrainingLoad: {},
        choreProgress: {
            strength: 0,
            dexterity: 0,
            constitution: 0,
            intelligence: 0,
            wisdom: 0,
            charisma: 0
        },
        avatarUrl: '',
        skillPoints: 0,
        unlockedPerks: [],
        verifiedProofs: [],
        verifiedCredentials: [],
        monthlyActivityLog: [],
        activityLogMonth: `${now.getFullYear()}-${now.getMonth() + 1}`,
        monthlyPerkClaimed: false,
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
    updateStatRows(statSnapshots, characterData.legacy?.perStatShares);
    updateMaintenanceHint(statSnapshots);
    updatePerkPanel();

    const choreList = document.getElementById('chore-list');
    if (choreList) {
        choreList.innerHTML = '';
        choreManager.chores.forEach(chore => {
            const li = document.createElement('li');
            li.className = 'chore-item';
            li.innerHTML = `
                <span>${chore.text}</span>
                <span class="chore-details">(+${chore.effort} ${getModernStatShortLabel(chore.stat)})</span>
                <button class="complete-chore-btn">✓</button>
            `;
            li.querySelector('.complete-chore-btn').addEventListener('click', () => choreManager.completeChore(chore.id));
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
    const requiredStat = requires.stat;
    const requiredValue = requires.value;
    const hasStatRequirement = requiredStat && requiredValue !== undefined;
    const statValue = hasStatRequirement ? stats[requiredStat] : null;
    const meetsStatRequirement = !hasStatRequirement
        || (typeof statValue === 'number' && statValue >= requiredValue);

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

    if (skillTreePanControls) {
        const breadcrumbCount = Array.isArray(breadcrumbs) ? breadcrumbs.length : 0;
        const showPanControls = breadcrumbCount === 2;
        skillTreePanControls.classList.toggle('hidden', !showPanControls);
        skillTreePanControls.setAttribute('aria-hidden', showPanControls ? 'false' : 'true');
        if (skillPanLeftBtn) {
            skillPanLeftBtn.disabled = !showPanControls;
        }
        if (skillPanRightBtn) {
            skillPanRightBtn.disabled = !showPanControls;
        }
    }
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

document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('signup-btn').addEventListener('click', handleSignUp);
document.getElementById('onboarding-form').addEventListener('submit', handleOnboarding);


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


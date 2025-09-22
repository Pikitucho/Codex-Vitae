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

const activityManager = {
    activities: {
        strength: { stat: 'strength', points: 1 },
        dexterity: { stat: 'dexterity', points: 1 },
        constitution: { stat: 'constitution', points: 1 },
        intelligence: { stat: 'intelligence', points: 1 },
        wisdom: { stat: 'wisdom', points: 1 },
        charisma: { stat: 'charisma', points: 1 }
    },
    logActivity: function(activityKey) {
        if (this.activities[activityKey]) {
            const activity = this.activities[activityKey];
            characterData.stats[activity.stat] += activity.points;
            levelManager.gainStatProgress(activity.points);
            logMonthlyActivity();
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
        showToast(`+${chore.effort} ${chore.stat.slice(0,3).toUpperCase()} Fragments!`);

        if (characterData.choreProgress[chore.stat] >= 1000) {
            const pointsGained = Math.floor(characterData.choreProgress[chore.stat] / 1000);
            characterData.choreProgress[chore.stat] %= 1000;
            characterData.stats[chore.stat] += pointsGained;
            levelManager.gainStatProgress(pointsGained);
            showToast(`Mastery increased! +${pointsGained} ${chore.stat.toUpperCase()}`);
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
        if (characterData.avatarUrl) {
            capturedPhoto.src = characterData.avatarUrl;
            capturedPhoto.classList.remove('hidden');
        } else {
            capturedPhoto.src = '';
            capturedPhoto.classList.add('hidden');
        }

        syncSkillSearchInputWithTarget(characterData.skillSearchTarget);

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
    const exerciseValue = parseInt(document.getElementById('exercise-freq').value);
    const studyValue = parseInt(document.getElementById('study-habit').value);
    const now = new Date();
    characterData = {
        level: 1,
        statProgress: 0,
        statsToNextLevel: 10,
        stats: {
            strength: 8 + exerciseValue,
            dexterity: 8,
            constitution: 8 + exerciseValue,
            intelligence: 8 + studyValue,
            wisdom: 8 + studyValue,
            charisma: 8
        },
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
        monthlyActivityLog: [],
        activityLogMonth: `${now.getFullYear()}-${now.getMonth() + 1}`,
        monthlyPerkClaimed: false,
        skillSearchTarget: null,
        chores: [],
        onboardingComplete: true
    };
}

function calculateStartingStats() {
    const exerciseValue = parseInt(document.getElementById('exercise-freq').value);
    const studyValue = parseInt(document.getElementById('study-habit').value);
    const now = new Date();
    characterData = {
        level: 1,
        statProgress: 0,
        statsToNextLevel: 10,
        stats: {
            strength: 8 + exerciseValue,
            dexterity: 8,
            constitution: 8 + exerciseValue,
            intelligence: 8 + studyValue,
            wisdom: 8 + studyValue,
            charisma: 8
        },
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
        monthlyActivityLog: [],
        activityLogMonth: `${now.getFullYear()}-${now.getMonth() + 1}`,
        monthlyPerkClaimed: false,
        chores: [],
        verifiedCredentials: [],
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
        scanButton.textContent = 'Rescan Face';
        scanButton.disabled = false;
    }
}

function updateDashboard() {
    if (!characterData || !characterData.stats) return;

    document.getElementById('str-value').textContent = characterData.stats.strength;
    document.getElementById('dex-value').textContent = characterData.stats.dexterity;
    document.getElementById('con-value').textContent = characterData.stats.constitution;
    document.getElementById('int-value').textContent = characterData.stats.intelligence;
    document.getElementById('wis-value').textContent = characterData.stats.wisdom;
    document.getElementById('cha-value').textContent = characterData.stats.charisma;
    document.getElementById('level-value').textContent = characterData.level;
    document.getElementById('xp-text').textContent = `${characterData.statProgress} / ${characterData.statsToNextLevel} Stats`;
    document.getElementById('xp-bar').style.width = `${(characterData.statProgress / characterData.statsToNextLevel) * 100}%`;
    document.getElementById('pp-total').textContent = characterData.skillPoints || 0;
    const currentLevel = characterData.level || 1;
    const progressInTier = (currentLevel - 1) % 10;
    document.getElementById('level-milestone-bar').style.width = `${(progressInTier / 10) * 100}%`;
    document.getElementById('level-milestone-text').textContent = `${progressInTier} / 10`;
    const activeDays = characterData.monthlyActivityLog ? characterData.monthlyActivityLog.length : 0;
    document.getElementById('monthly-milestone-bar').style.width = `${(activeDays / 25) * 100}%`;
    document.getElementById('monthly-milestone-text').textContent = `${activeDays} / 25 Days`;

    for (const stat in characterData.choreProgress) {
        const progress = characterData.choreProgress[stat];
        document.getElementById(`${stat}-chore-bar`).style.width = `${(progress / 1000) * 100}%`;
        document.getElementById(`${stat}-chore-text`).textContent = `${progress} / 1000`;
    }
    
    const choreList = document.getElementById('chore-list');
    choreList.innerHTML = '';
    choreManager.chores.forEach(chore => {
        const li = document.createElement('li');
        li.className = 'chore-item';
        li.innerHTML = `
            <span>${chore.text}</span>
            <span class="chore-details">(+${chore.effort} ${chore.stat.slice(0,3).toUpperCase()})</span>
            <button class="complete-chore-btn">✓</button>
        `;
        li.querySelector('.complete-chore-btn').addEventListener('click', () => choreManager.completeChore(chore.id));
        choreList.appendChild(li);
    });

    const capturedPhoto = document.getElementById('captured-photo');
    if (characterData.avatarUrl) {
        capturedPhoto.src = characterData.avatarUrl;
        capturedPhoto.classList.remove('hidden');
        document.getElementById('webcam-feed').classList.add('hidden');
        document.getElementById('scan-face-btn').textContent = 'Update Avatar';
    } else {
        capturedPhoto.src = '';
        capturedPhoto.classList.add('hidden');
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

function updateSkillTreeUI(title, breadcrumbs, showBack) {
    skillTreeTitle.textContent = title;
    document.getElementById('skill-tree-breadcrumbs').textContent = breadcrumbs.join(' > ');
    skillBackBtn.classList.toggle('hidden', !showBack);
}

function deriveSkillPathType(path) {
    if (!path || typeof path !== 'object') {
        return null;
    }

    if (path.type === 'galaxy' || path.type === 'constellation' || path.type === 'star') {
        return path.type;
    }

    if (path.star) {
        return 'star';
    }
    if (path.constellation) {
        return 'constellation';
    }
    if (path.galaxy) {
        return 'galaxy';
    }

    return null;
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

    const starName = path.star;
    return typeof starName === 'string' && !!constellationData.stars?.[starName];
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
    }
}

function openSkillsModal() {
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
    document.getElementById('skill-tree-breadcrumbs').textContent = breadcrumbs.join(' > ');
    skillBackBtn.classList.toggle('hidden', !showBack);

    if (skillTreePanControls) {
        const showPanControls = Array.isArray(breadcrumbs) && breadcrumbs.length === 2;
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

        if (segments.length <= 1) {
            return null;
        }

        const galaxyMatch = pickBestMatch(Object.keys(skillTree), segments[0]);
        if (!galaxyMatch) {
            return null;
        }

        const result = {
            type: 'galaxy',
            galaxy: galaxyMatch.name,
            label: galaxyMatch.name,
            matchQuality: galaxyMatch.matchQuality
        };

        if (segments.length === 1) {
            return result;
        }

        const constellations = skillTree[galaxyMatch.name]?.constellations || {};
        const constellationMatch = pickBestMatch(Object.keys(constellations), segments[1]);
        if (!constellationMatch) {
            return null;
        }

        result.type = 'constellation';
        result.constellation = constellationMatch.name;
        result.label = constellationMatch.name;
        if (result.matchQuality === 'exact' && constellationMatch.matchQuality === 'partial') {
            result.matchQuality = 'partial';
        }

        if (segments.length === 2) {
            return result;
        }

        const stars = constellations[constellationMatch.name]?.stars || {};
        const starMatch = pickBestMatch(Object.keys(stars), segments[2]);
        if (!starMatch) {
            return null;
        }

        result.type = 'star';
        result.star = starMatch.name;
        result.label = starMatch.name;
        if (result.matchQuality === 'exact' && starMatch.matchQuality === 'partial') {
            result.matchQuality = 'partial';
        }

        return result;
    };

    const hierarchicalResult = tryResolveHierarchicalQuery();
    if (hierarchicalResult) {
        return hierarchicalResult;
    }

    const matches = {
        starExact: [],
        starPartial: [],
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
                label: galaxyName,
                matchQuality: 'exact'
            });
        } else if (galaxyNormalized.includes(normalized)) {
            matches.galaxyPartial.push({
                type: 'galaxy',
                galaxy: galaxyName,
                label: galaxyName,
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
                    label: constellationName,
                    matchQuality: 'exact'
                });
            } else if (constellationNormalized.includes(normalized)) {
                matches.constellationPartial.push({
                    type: 'constellation',
                    galaxy: galaxyName,
                    constellation: constellationName,
                    label: constellationName,
                    matchQuality: 'partial'
                });
            }

            const starEntries = Object.keys(constellationData.stars || {});
            for (const starName of starEntries) {
                const starNormalized = starName.toLowerCase();
                if (starNormalized === normalized) {
                    matches.starExact.push({
                        type: 'star',
                        galaxy: galaxyName,
                        constellation: constellationName,
                        star: starName,
                        label: starName,
                        matchQuality: 'exact'
                    });
                } else if (starNormalized.includes(normalized)) {
                    matches.starPartial.push({
                        type: 'star',
                        galaxy: galaxyName,
                        constellation: constellationName,
                        star: starName,
                        label: starName,
                        matchQuality: 'partial'
                    });
                }
            }
        }
    }

    const priorityOrder = [
        matches.starExact,
        matches.constellationExact,
        matches.galaxyExact,
        matches.starPartial,
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
        return false;
    }

    if (!isValidSkillPath(path)) {
        return false;
    }

    const normalizedPath = { ...path, type: deriveSkillPathType(path) };

    if (normalizedPath.type === 'galaxy') {
        delete normalizedPath.constellation;
        delete normalizedPath.star;
    } else if (normalizedPath.type === 'constellation') {
        delete normalizedPath.star;
    }

    return !!skillRenderer.navigateToPath(normalizedPath);
}

window.requestSkillPath = requestSkillPath;

function setupEventListeners() {
    if (listenersInitialized) {
        return;
    }
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

    const handleAddChore = async () => {
        const text = choreInput.value.trim();
        if(text) {
            choreInput.disabled = true;
            await choreManager.addChore(text);
            choreInput.value = '';
            choreInput.disabled = false;
            choreInput.focus();
        }
    };

    choreInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleAddChore();
        }
    });

    document.getElementById('log-activity-btn').addEventListener('click', () => {
        activityManager.logActivity(document.getElementById('activity-select').value);
    });
    
    const codexModal = document.getElementById('codex-modal');

    document.getElementById('open-codex-btn').addEventListener('click', () => {
        codexModal.classList.remove('hidden');
    });

    document.getElementById('close-codex-btn').addEventListener('click', () => {
        codexModal.classList.add('hidden');
    });

    document.getElementById('codex-skills-btn').addEventListener('click', () => {
        codexModal.classList.add('hidden');
        openSkillsModal();
    });

    document.getElementById('codex-logout-btn').addEventListener('click', handleLogout);

    document.getElementById('close-skills-btn').addEventListener('click', () => {
        skillsModal.classList.add('hidden');
    });
    
    skillBackBtn.addEventListener('click', () => {
        if (skillRenderer && typeof skillRenderer.goBack === 'function') {
            skillRenderer.goBack();
        }
    });

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

            const navigationStarted = requestSkillPath(target);
            if (!navigationStarted) {
                showToast('Unable to navigate to the selected result.');
                return;
            }

            if (result.matchQuality === 'partial') {
                skillSearchInput.setAttribute('title', `Showing closest match: ${target.label}`);
            } else {
                skillSearchInput.removeAttribute('title');
            }

            characterData.skillSearchTarget = target;
            if (auth.currentUser) {
                saveData();
            }

            skillSearchInput.blur();
            setTimeout(() => syncSkillSearchInputWithTarget(target), 0);
        });

        skillSearchInput.addEventListener('focus', () => toggleSearchFocus(true));
        skillSearchInput.addEventListener('blur', () => toggleSearchFocus(false));
        skillSearchInput.addEventListener('input', () => {
            if (skillSearchInput.title) {
                skillSearchInput.removeAttribute('title');
            }
        });
    }
    document.getElementById('scan-face-btn').addEventListener('click', handleFaceScan);

    listenersInitialized = true;
}
    document.getElementById('open-codex-btn').addEventListener('click', () => document.getElementById('codex-modal').classList.remove('hidden'));
    document.getElementById('close-codex-btn').addEventListener('click', () => document.getElementById('codex-modal').classList.add('hidden'));
    document.getElementById('codex-skills-btn').addEventListener('click', () => {
        document.getElementById('codex-modal').classList.add('hidden');
        openSkillsModal();
    });
    document.getElementById('codex-logout-btn').addEventListener('click', handleLogout);
    document.getElementById('close-skills-btn').addEventListener('click', () => document.getElementById('skills-modal').classList.add('hidden'));

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

    skillBackBtn.addEventListener('click', () => {
        if (skillRenderer && typeof skillRenderer.goBack === 'function') {
            skillRenderer.goBack();
        }
    });
    document.getElementById('codex-logout-btn').addEventListener('click', handleLogout);
    document.getElementById('close-skills-btn').addEventListener('click', () => {
        starDetailController.hide();
        document.getElementById('skills-modal').classList.add('hidden');
    });

    skillBackBtn.addEventListener('click', () => {
        starDetailController.hide();
        if (skillRenderer && typeof skillRenderer.goBack === 'function') {
            skillRenderer.goBack();
        }
     });
    document.getElementById('scan-face-btn').addEventListener('click', handleFaceScan);

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


skillRenderer = new SkillUniverseRenderer({
    container: document.getElementById('skill-tree-canvas-container'),
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


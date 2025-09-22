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
const BACKEND_SERVER_URL = codexConfig.backendUrl;

if (!firebaseConfig || typeof firebaseConfig !== 'object') {
    displayConfigurationError(
        'Firebase configuration is missing or invalid.',
        'Ensure config.js assigns your Firebase project credentials to <code>firebaseConfig</code>.'
    );
    throw new Error(
        'Firebase configuration is missing. Ensure config.js exports firebaseConfig.'
    );
}

if (typeof BACKEND_SERVER_URL !== 'string' || BACKEND_SERVER_URL.trim().length === 0) {
    displayConfigurationError(
        'Backend server URL is missing.',
        'Set the <code>backendUrl</code> value in config.js so Codex Vitae can reach your AI services.'
    );
    throw new Error(
        'Backend server URL is missing. Ensure config.js exports backendUrl.'
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

// --- Global Data Variables ---
let characterData = {};
let gameManager = {};
let currentSkillPath = [];
let listenersInitialized = false;
let lastAuthAction = null;

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

        const newChore = {
            id: Date.now(),
            text: text,
            stat: classification.stat,
            effort: classification.effort,
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

        characterData = {
            ...loadedCharacterData,
            level: loadedCharacterData.level || 1,
            statProgress: loadedCharacterData.statProgress || 0,
            statsToNextLevel: loadedCharacterData.statsToNextLevel || 10,
            skillPoints: loadedCharacterData.skillPoints || 0,
            unlockedPerks: loadedCharacterData.unlockedPerks || [],
            monthlyActivityLog: loadedCharacterData.monthlyActivityLog || [],
            activityLogMonth: loadedCharacterData.activityLogMonth || (new Date().getFullYear() + '-' + (new Date().getMonth() + 1)),
            monthlyPerkClaimed: loadedCharacterData.monthlyPerkClaimed || false,
            skillSearchTarget: loadedCharacterData.skillSearchTarget || null,
            choreProgress: {
                strength: loadedCharacterData.choreProgress?.strength || 0,
                dexterity: loadedCharacterData.choreProgress?.dexterity || 0,
                constitution: loadedCharacterData.choreProgress?.constitution || 0,
                intelligence: loadedCharacterData.choreProgress?.intelligence || 0,
                wisdom: loadedCharacterData.choreProgress?.wisdom || 0,
                charisma: loadedCharacterData.choreProgress?.charisma || 0
            },
            chores: loadedCharacterData.chores || [],
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
    if (characterData.skillPoints < 1) {
        showToast("Not enough Perk Points!");
        return;
    }
    if (characterData.unlockedPerks.includes(perkName)) {
        showToast("Perk already unlocked!");
        return;
    }
    if (characterData.stats[perkData.requires.stat] < perkData.requires.value) {
        showToast("Stat requirements not met!");
        return;
    }

    characterData.skillPoints--;
    characterData.unlockedPerks.push(perkName);
    showToast(`Perk Unlocked: ${perkName}!`);
    
    if (myp5) {
        myp5.prepareStarData();
    }
    updateDashboard();
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
    skillsModal.classList.remove('hidden');
    syncSkillSearchInputWithTarget();
    restoreSkillSearchTargetNavigation();
}

function updateSkillTreeUI(title, breadcrumbs, showBack) {
    skillTreeTitle.textContent = title;
    document.getElementById('skill-tree-breadcrumbs').textContent = breadcrumbs.join(' > ');
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
    if (!myp5 || typeof myp5.navigateToPath !== 'function') {
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

    return !!myp5.navigateToPath(normalizedPath);
}

window.requestSkillPath = requestSkillPath;

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
        if (myp5) {
            myp5.goBack();
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


let myp5 = new p5(sketch);


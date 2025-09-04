// js/main.js

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDqCT_iOBToHDR7sRQnH_mUmwN5V_RXj58",
    authDomain: "codex-vitae-app.firebaseapp.com",
    projectId: "codex-vitae-app",
    storageBucket: "codex-vitae-app.firebasestorage.app",
    messagingSenderId: "1078038224886",
    appId: "1:1078038224886:web:19a322f88fc529307371d7",
    measurementId: "G-DVGVB274T3"
};

// --- BACKEND SERVER URL ---
const AVATAR_GENERATION_URL = 'https://generate-avatar-393704011058.us-central1.run.app';

// --- Firebase Initialization ---
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// --- Get references to HTML elements ---
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const skillsModal = document.getElementById('skills-modal');
const skillTreeView = document.getElementById('skill-tree-view');
const skillTreeTitle = document.getElementById('skill-tree-title');
const skillBackBtn = document.getElementById('skill-back-btn');

// --- Global Data Variables ---
let characterData = {};
let gameManager = {};
let skillTree = {
    'Mind': {
        type: 'galaxy',
        description: 'Skills of logic, learning, and creativity.',
        constellations: {
            'Academics': { type: 'constellation', stars: { 'Active Learner': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 12 }, description: 'Gain more XP from reading and studying activities.' }, 'Critical Thinker': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 15 }, description: 'Increases success rate on logic-based challenges.' },'Polymath': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 20 }, description: 'Reduces the XP cost of learning new skills.' } } },
            'Creativity': { type: 'constellation', stars: { 'Doodler': { type: 'star', unlocked: false, requires: { stat: 'wisdom', value: 11 }, description: 'Unlocks the ability to generate simple creative works.' }, 'Storyteller': { type: 'star', unlocked: false, requires: { stat: 'charisma', value: 12 }, description: 'Improves outcomes in social interactions.' },'Improviser': { type: 'star', unlocked: false, requires: { stat: 'wisdom', value: 16 }, description: 'Provides new options in unexpected situations.' } } }
        }
    },
    'Body': {
        type: 'galaxy',
        description: 'Skills of strength, endurance, and physical prowess.',
        constellations: {
            'Fitness': { type: 'constellation', stars: { 'Basic Fitness': { type: 'star', unlocked: false, requires: { stat: 'strength', value: 12 }, description: 'Reduces chance of negative outcomes from physical exertion.' }, 'Resilience': { type: 'star', unlocked: false, requires: { stat: 'constitution', value: 14 }, description: 'Faster recovery from setbacks.' },'Athlete': { type: 'star', unlocked: false, requires: { stat: 'strength', value: 18 }, description: 'Unlocks advanced physical activities.' } } },
            'Craftsmanship': { type: 'constellation', stars: { 'Handyman': { type: 'star', unlocked: false, requires: { stat: 'dexterity', value: 12 }, description: 'Ability to perform basic repairs and crafting.' },'Artisan': { type: 'star', unlocked: false, requires: { stat: 'dexterity', value: 16 }, description: 'Craft higher quality items.' } } }
        }
    },
    'Soul': {
        type: 'galaxy',
        description: 'Skills of discipline, charisma, and inner strength.',
        constellations: {
            'Discipline': { type: 'constellation', stars: { 'Early Riser': { type: 'star', unlocked: false, requires: { stat: 'constitution', value: 12 }, description: 'Gain a small bonus for activities completed in the morning.' },'Focused Mind': { type: 'star', unlocked: false, requires: { stat: 'wisdom', value: 15 }, description: 'Reduces distractions, increasing efficiency of study.' },'Unwavering': { type: 'star', unlocked: false, requires: { stat: 'constitution', value: 18 }, description: 'High resistance to abandoning long-term goals.' } } },
            'Charisma': { type: 'constellation', stars: { 'Pleasantries': { type: 'star', unlocked: false, requires: { stat: 'charisma', value: 12 }, description: 'Improves initial reactions in social encounters.' },'Persuasion': { type: 'star', unlocked: false, requires: { stat: 'charisma', value: 15 }, description: 'Increases the chance of convincing others.' } } }
        }
    }
};
let currentSkillPath = [];

// --- Manager Logic ---
const levelManager = {
    gainStatProgress: function(amount) {
        characterData.statProgress += amount;
        while (characterData.statProgress >= characterData.statsToNextLevel) {
            this.levelUp();
        }
        updateDashboard();
    },
    levelUp: function() {
        characterData.level++;
        characterData.statProgress -= characterData.statsToNextLevel; // Carry over extra progress
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
        constitution: { stat: 'constitution', points: 1 },
        intelligence: { stat: 'intelligence', points: 1 },
        wisdom: { stat: 'wisdom', points: 1 }
    },
    logActivity: function(activityKey) {
        if (this.activities[activityKey]) {
            const activity = this.activities[activityKey];
            characterData.stats[activity.stat] += activity.points;
            levelManager.gainStatProgress(activity.points);
            logMonthlyActivity();
            checkAllSkillUnlocks();
        }
    }
};

let choreManager = {
    chores: [],
    addChore: function(text) {
        if (text) { this.chores.push({ text: text, completed: false }); return true; }
        return false;
    },
    completeChore: function(index) {
        if (this.chores[index] && !this.chores[index].completed) {
            this.chores[index].completed = true;
            showToast("Chore completed!");
            return true;
        }
        return false;
    }
};

let goalManager = {
    activeGoal: null,
    setGoal: function(stat, target) {
        if (stat && target > (characterData.stats[stat] || 0)) {
            this.activeGoal = { stat: stat, target: target };
            showToast(`New Goal Set: Reach ${target} ${stat}!`);
            return true;
        }
        alert("Invalid goal. Target must be higher than current stat.");
        return false;
    },
    checkGoal: function() {
        if (this.activeGoal && characterData.stats[this.activeGoal.stat] >= this.activeGoal.target) {
            showToast(`Goal Achieved! You reached ${this.activeGoal.target} ${this.activeGoal.stat}!`);
            this.activeGoal = null;
        }
    }
};

// --- AUTHENTICATION & DATA FUNCTIONS ---
function handleSignUp() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    auth.createUserWithEmailAndPassword(email, password).catch(error => alert(error.message));
}

function handleLogin() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    auth.signInWithEmailAndPassword(email, password).catch(error => alert(error.message));
}

function handleLogout() { auth.signOut(); }

async function saveData() {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const userRef = db.collection('users').doc(userId);
    const dataToSave = {
        characterData, gameManager, chores: choreManager.chores,
        activeGoal: goalManager.activeGoal, skillTree
    };
    await userRef.set(dataToSave);
    console.log("Data saved to Firestore!");
}

async function loadData(userId) {
    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();
    if (doc.exists) {
        const loadedData = doc.data();
        characterData = loadedData.characterData;
        gameManager = loadedData.gameManager;
        choreManager.chores = loadedData.chores || [];
        goalManager.activeGoal = loadedData.activeGoal || null;
        skillTree = loadedData.skillTree || skillTree;
        if (characterData.avatarUrl) {
            document.getElementById('captured-photo').src = characterData.avatarUrl;
        }
        return true;
    }
    return false;
}

// --- CORE FUNCTIONS ---
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
        avatarUrl: '',
        skillPoints: 0,
        unlockedPerks: [],
        monthlyActivityLog: [],
        activityLogMonth: new Date().getFullYear() + '-' + (new Date().getMonth() + 1),
        monthlyPerkClaimed: false
    };
    checkAllSkillUnlocks();
}

function handleOnboarding(event) {
    event.preventDefault();
    calculateStartingStats();
    gameManager.onboardingComplete = true;
    document.getElementById('onboarding-modal').classList.add('hidden');
    updateDashboard();
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
            return;
        } catch (error) {
            console.error("Webcam access error:", error);
            alert("Could not access webcam. Please ensure you've given permission.");
            return;
        }
    }

    const context = canvas.getContext('2d');
    canvas.width = webcamFeed.videoWidth;
    canvas.height = webcamFeed.videoHeight;
    context.drawImage(webcamFeed, 0, 0, canvas.width, canvas.height);

    webcamFeed.srcObject.getTracks().forEach(track => track.stop());
    webcamFeed.srcObject = null;
    scanButton.textContent = "Uploading...";
    scanButton.disabled = true;

    canvas.toBlob(async (blob) => {
        try {
            const storageRef = storage.ref();
            const avatarRef = storageRef.child(`avatars/${auth.currentUser.uid}.png`);
            await avatarRef.put(blob);
            const downloadURL = await avatarRef.getDownloadURL();
            characterData.avatarUrl = downloadURL;
            capturedPhoto.src = characterData.avatarUrl;
            capturedPhoto.classList.remove('hidden');
            webcamFeed.classList.add('hidden');
        } catch (error) {
            console.error("Error uploading image to Firebase Storage:", error);
            alert(`Failed to save photo. ${error.message}`);
        } finally {
            scanButton.textContent = 'Rescan Face';
            scanButton.disabled = false;
            updateDashboard();
        }
    }, 'image/png');
}

function updateDashboard() {
    if (!characterData || !characterData.stats) return;

    // --- Core Stats ---
    document.getElementById('str-value').textContent = characterData.stats.strength;
    document.getElementById('dex-value').textContent = characterData.stats.dexterity;
    document.getElementById('con-value').textContent = characterData.stats.constitution;
    document.getElementById('int-value').textContent = characterData.stats.intelligence;
    document.getElementById('wis-value').textContent = characterData.stats.wisdom;
    document.getElementById('cha-value').textContent = characterData.stats.charisma;

    // --- Stat Progression to Level Up ---
    document.getElementById('level-value').textContent = characterData.level;
    document.getElementById('xp-text').textContent = `${characterData.statProgress} / ${characterData.statsToNextLevel} Stats`;
    document.getElementById('xp-bar').style.width = `${(characterData.statProgress / characterData.statsToNextLevel) * 100}%`;

    // --- Perk Point Progression ---
    document.getElementById('pp-total').textContent = characterData.skillPoints || 0;

    // Calculate Level Milestone Progress
    const currentLevel = characterData.level || 1;
    const progressInTier = (currentLevel - 1) % 10;
    const levelProgress = (progressInTier / 10) * 100;
    document.getElementById('level-milestone-bar').style.width = `${levelProgress}%`;
    document.getElementById('level-milestone-text').textContent = `${progressInTier} / 10`;

    // Calculate Monthly Milestone Progress
    const activeDays = characterData.monthlyActivityLog ? characterData.monthlyActivityLog.length : 0;
    const monthlyProgress = (activeDays / 25) * 100;
    document.getElementById('monthly-milestone-bar').style.width = `${monthlyProgress}%`;
    document.getElementById('monthly-milestone-text').textContent = `${activeDays} / 25 Days`;

    // --- Chores ---
    const choreList = document.getElementById('chore-list');
    choreList.innerHTML = '';
    (choreManager.chores.length === 0 ? ['No chores added yet.'] : choreManager.chores).forEach((chore, index) => {
        const li = document.createElement('li');
        if (typeof chore === 'string') { 
            li.textContent = chore; 
            li.style.fontStyle = 'italic'; 
        } else {
            li.textContent = chore.text;
            if (chore.completed) li.classList.add('completed');
            li.addEventListener('click', () => { 
                if (choreManager.completeChore(index)) {
                    logMonthlyActivity();
                    updateDashboard(); // Refresh dashboard to show chore is completed
                }
            });
        }
        choreList.appendChild(li);
    });

    // --- Goals ---
    const activeGoalDisplay = document.getElementById('active-goal-display');
    if (goalManager.activeGoal) {
        const { stat, target } = goalManager.activeGoal;
        const current = characterData.stats[stat];
        document.getElementById('goal-text').textContent = `Goal: ${target} ${stat} (${current}/${target})`;
        activeGoalDisplay.classList.remove('hidden');
        goalManager.checkGoal();
    } else {
        activeGoalDisplay.classList.add('hidden');
    }

    // --- Avatar ---
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

    // --- Save Data ---
    if (auth.currentUser) saveData();
}

function checkAllSkillUnlocks() {
    if (!skillTree || !characterData.stats) return;
    console.log("Checking for skill unlocks...");
}

function renderSkillTree() {
    skillTreeView.innerHTML = '';
    const breadcrumbs = document.getElementById('skill-tree-breadcrumbs');
    breadcrumbs.innerHTML = '';
    let currentLevel = skillTree;
    let path = [...currentSkillPath];
    let breadcrumbPath = ['Galaxies'];
    while (path.length > 0) {
        let key = path.shift();
        currentLevel = currentLevel[key]?.constellations || currentLevel[key]?.stars || currentLevel[key];
        breadcrumbPath.push(key);
    }
    skillTreeTitle.textContent = currentSkillPath.length > 0 ? currentSkillPath[currentSkillPath.length - 1] : "Skill Galaxies";
    breadcrumbs.textContent = breadcrumbPath.join(' > ');
    skillBackBtn.classList.toggle('hidden', currentSkillPath.length === 0);
    for (const key in currentLevel) {
        const item = currentLevel[key];
        const div = document.createElement('div');
        div.textContent = key;
        div.className = item.type;
        let hoverTitle = item.description || '';
        if (item.type === 'star') {
            const unlocked = characterData.stats[item.requires.stat] >= item.requires.value;
            div.classList.add(unlocked ? 'unlocked' : 'locked');
            if (!unlocked) {
                hoverTitle += `\n(Requires ${item.requires.value} ${item.requires.stat})`;
            }
        }
        div.title = hoverTitle.trim();
        if (item.type !== 'star') {
            div.addEventListener('click', () => {
                currentSkillPath.push(key);
                renderSkillTree();
            });
        }
        skillTreeView.appendChild(div);
    }
}

function openSkillsModal() { 
    currentSkillPath = [];
    skillsModal.classList.remove('hidden');
    renderSkillTree();
}

function showToast(message) { 
    alert(message);
}

function setupEventListeners() {
    document.getElementById('add-chore-btn').addEventListener('click', () => {
        const choreInput = document.getElementById('chore-input');
        if (choreManager.addChore(choreInput.value.trim())) { 
            choreInput.value = ''; 
            updateDashboard(); 
        }
    });
    document.getElementById('set-goal-btn').addEventListener('click', () => {
        const stat = document.getElementById('goal-stat-select').value;
        const target = parseInt(document.getElementById('goal-value-input').value);
        if (goalManager.setGoal(stat, target)) {
            updateDashboard();
        }
    });
    document.getElementById('log-activity-btn').addEventListener('click', () => {
        activityManager.logActivity(document.getElementById('activity-select').value);
    });
    const codexModal = document.getElementById('codex-modal');
    document.getElementById('open-codex-btn').addEventListener('click', () => codexModal.classList.remove('hidden'));
    document.getElementById('close-codex-btn').addEventListener('click', () => codexModal.classList.add('hidden'));
    document.getElementById('codex-skills-btn').addEventListener('click', () => {
        codexModal.classList.add('hidden');
        openSkillsModal();
    });
    document.getElementById('codex-logout-btn').addEventListener('click', handleLogout);
    document.getElementById('close-skills-btn').addEventListener('click', () => skillsModal.classList.add('hidden'));
    skillBackBtn.addEventListener('click', () => {
        currentSkillPath.pop();
        renderSkillTree();
    });
    document.getElementById('scan-face-btn').addEventListener('click', handleFaceScan);
}

// --- APP INITIALIZATION & AUTH STATE LISTENER ---
auth.onAuthStateChanged(async user => {
    if (user) {
        const hasData = await loadData(user.uid);
        authScreen.classList.add('hidden');
        appScreen.classList.remove('hidden');
        if (hasData) {
            updateDashboard();
        } else {
            document.getElementById('onboarding-modal').classList.remove('hidden');
        }
        setupEventListeners();
    } else {
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
        characterData = {};
    }
});

document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('signup-btn').addEventListener('click', handleSignUp);
document.getElementById('onboarding-form').addEventListener('submit', handleOnboarding);
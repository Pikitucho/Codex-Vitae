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
    characterData.chores = choreManager.chores;
    const userRef = db.collection('users').doc(userId);
    const dataToSave = { characterData, gameManager, skillTree };
    await userRef.set(dataToSave, { merge: true });
    console.log("Data saved to Firestore!");
}

async function loadData(userId) {
    const userRef = db.collection('users').doc(userId);
    const doc = await userRef.get();
    if (doc.exists) {
        const loadedData = doc.data();
        characterData = loadedData.characterData;
        gameManager = loadedData.gameManager;
        choreManager.chores = characterData.chores || [];
        // skillTree is loaded from the separate file now, so we don't load it from save.
        if (characterData.avatarUrl) {
            document.getElementById('captured-photo').src = characterData.avatarUrl;
        }
        return true;
    }
    return false;
}

// --- CORE FUNCTIONS ---
async function getAIChoreClassification(text) {
    console.log(`(Simulating AI classification for: "${text}")`);
    await new Promise(resolve => setTimeout(resolve, 500)); 
    const lowerCaseText = text.toLowerCase();
    
    // Effort Tier Simulation
    let effort = 25; // Standard
    if (lowerCaseText.includes('major') || lowerCaseText.includes('project') ||  lowerCaseText.includes('deep clean')) effort = 250;
    if (lowerCaseText.includes('minor') || lowerCaseText.includes('quick')) effort = 10;
    if (lowerCaseText.includes('trivial') || lowerCaseText.includes('brush teeth')) effort = 1;
    if (lowerCaseText.includes('epic') || lowerCaseText.includes('marathon')) effort = 1000;

    // Stat Category Simulation
    if (lowerCaseText.includes('gym') || lowerCaseText.includes('lift') || lowerCaseText.includes('mow')) return { stat: 'strength', effort: effort };
    if (lowerCaseText.includes('run') || lowerCaseText.includes('clean') || lowerCaseText.includes('dishes') || lowerCaseText.includes('laundry')) return { stat: 'constitution', effort: effort };
    if (lowerCaseText.includes('read') || lowerCaseText.includes('study') || lowerCaseText.includes('budget') || lowerCaseText.includes('taxes')) return { stat: 'intelligence', effort: effort };
    if (lowerCaseText.includes('meditate') || lowerCaseText.includes('plan') || lowerCaseText.includes('journal')) return { stat: 'wisdom', effort: effort };
    if (lowerCaseText.includes('call') || lowerCaseText.includes('talk') || lowerCaseText.includes('meeting')) return { stat: 'charisma', effort: effort };
    if (lowerCaseText.includes('practice') || lowerCaseText.includes('draw') || lowerCaseText.includes('build')) return { stat: 'dexterity', effort: effort };

    const stats = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];
    return { stat: stats[Math.floor(Math.random() * stats.length)], effort: 10 };
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
            strength: 0, dexterity: 0, constitution: 0,
            intelligence: 0, wisdom: 0, charisma: 0
        },
        avatarUrl: '',
        skillPoints: 0,
        unlockedPerks: [],
        monthlyActivityLog: [],
        activityLogMonth: new Date().getFullYear() + '-' + (new Date().getMonth() + 1),
        monthlyPerkClaimed: false
    };
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

    // --- Update all stat displays ---
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

    // --- Chore Effort Progress ---
    for (const stat in characterData.choreProgress) {
        const progress = characterData.choreProgress[stat];
        const progressPercent = (progress / 1000) * 100;
        document.getElementById(`${stat}-chore-bar`).style.width = `${progressPercent}%`;
        document.getElementById(`${stat}-chore-text`).textContent = `${progress} / 1000`;
    }
    
    // --- Active Chore List ---
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

    if (auth.currentUser) saveData();
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
    const choreInput = document.getElementById('chore-input');
    const addChoreBtn = document.getElementById('add-chore-btn');

    const handleAddChore = async () => {
        const text = choreInput.value.trim();
        if(text) {
            addChoreBtn.disabled = true;
            choreInput.disabled = true;
            await choreManager.addChore(text);
            choreInput.value = '';
            addChoreBtn.disabled = false;
            choreInput.disabled = false;
            choreInput.focus();
        }
    };

    addChoreBtn.addEventListener('click', handleAddChore);
    choreInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            handleAddChore();
        }
    });

    document.getElementById('log-activity-btn').addEventListener('click', () => {
        activityManager.logActivity(document.getElementById('activity-select').value);
    });
    
    // --- Other Listeners ---
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('signup-btn').addEventListener('click', handleSignUp);
    document.getElementById('onboarding-form').addEventListener('submit', handleOnboarding);
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
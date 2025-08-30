// --- Firebase Initialization ---
const firebaseConfig = {
    apiKey: "AIzaSyDqCT_iOBToHDR7sRQnH_mUmwN5V_RXj58",
    authDomain: "codex-vitae-app.firebaseapp.com",
    projectId: "codex-vitae-app",
    storageBucket: "codex-vitae-app.firebasestorage.app",
    messagingSenderId: "1078038224886",
    appId: "1:1078038224886:web:19a322f88fc529307371d7",
    measurementId: "G-DVGVB274T3"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

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
let choreManager = { chores: [] };
let goalManager = { activeGoal: null };
let skillTree = {
    'Mind': {
        type: 'galaxy',
        constellations: {
            'Academics': {
                type: 'constellation',
                stars: { 'Active Learner': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 12 } }, 'Critical Thinker': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 15 } } }
            },
            'Creativity': {
                type: 'constellation',
                stars: { 'Doodler': { type: 'star', unlocked: false, requires: { stat: 'wisdom', value: 11 } }, 'Storyteller': { type: 'star', unlocked: false, requires: { stat: 'charisma', value: 12 } } }
            }
        }
    },
    'Body': {
        type: 'galaxy',
        constellations: {
            'Fitness': {
                type: 'constellation',
                stars: { 'Basic Fitness': { type: 'star', unlocked: false, requires: { stat: 'strength', value: 12 } }, 'Resilience': { type: 'star', unlocked: false, requires: { stat: 'constitution', value: 12 } } }
            }
        }
    }
};
let currentSkillPath = [];

// --- Manager Logic ---
const levelManager = {
    gainXp: function(amount) {
        if (!characterData.xp) characterData.xp = 0;
        characterData.xp += amount;
        if (characterData.xp >= characterData.xpToNextLevel) {
            this.levelUp();
        }
        updateDashboard();
    },
    levelUp: function() {
        characterData.level++;
        characterData.xp -= characterData.xpToNextLevel;
        characterData.xpToNextLevel = Math.floor(characterData.xpToNextLevel * 1.5);
        showToast(`Congratulations! You've reached Level ${characterData.level}!`);
    }
};

const activityManager = {
    activities: {
        strength: { stat: 'strength', points: 1, xp: 15 },
        constitution: { stat: 'constitution', points: 1, xp: 15 },
        intelligence: { stat: 'intelligence', points: 1, xp: 10 },
        wisdom: { stat: 'wisdom', points: 1, xp: 10 }
    },
    logActivity: function(activityKey) {
        if (this.activities[activityKey]) {
            const activity = this.activities[activityKey];
            characterData.stats[activity.stat] += activity.points;
            levelManager.gainXp(activity.xp);
            checkAllSkillUnlocks();
        }
    }
};

// --- AUTHENTICATION & DATA FUNCTIONS ---
function handleSignUp() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    auth.createUserWithEmailAndPassword(email, password)
        .catch(error => alert(error.message));
}

function handleLogin() {
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    auth.signInWithEmailAndPassword(email, password)
        .catch(error => alert(error.message));
}

function handleLogout() {
    auth.signOut();
}

async function saveData() {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    const userRef = db.collection('users').doc(userId);
    const dataToSave = {
        characterData: characterData,
        gameManager: gameManager,
        chores: choreManager.chores,
        activeGoal: goalManager.activeGoal,
        skillTree: skillTree
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
        return true;
    }
    return false;
}

// --- ONBOARDING & CORE FUNCTIONS ---
function calculateStartingStats() {
    const exerciseValue = parseInt(document.getElementById('exercise-freq').value);
    const studyValue = parseInt(document.getElementById('study-habit').value);
    characterData = {
        skills: [],
        level: 1,
        xp: 0,
        xpToNextLevel: 100,
        stats: {
            strength: 8 + exerciseValue,
            dexterity: 8,
            constitution: 8 + exerciseValue,
            intelligence: 8 + studyValue,
            wisdom: 8 + studyValue,
            charisma: 8
        }
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

function updateDashboard() {
    if (!characterData || !characterData.stats) return; // Safety check

    document.getElementById('str-value').textContent = characterData.stats.strength;
    document.getElementById('dex-value').textContent = characterData.stats.dexterity;
    document.getElementById('con-value').textContent = characterData.stats.constitution;
    document.getElementById('int-value').textContent = characterData.stats.intelligence;
    document.getElementById('wis-value').textContent = characterData.stats.wisdom;
    document.getElementById('cha-value').textContent = characterData.stats.charisma;

    document.getElementById('level-value').textContent = characterData.level;
    document.getElementById('xp-text').textContent = `${characterData.xp} / ${characterData.xpToNextLevel} XP`;
    const xpPercentage = (characterData.xp / characterData.xpToNextLevel) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercentage}%`;

    const choreList = document.getElementById('chore-list');
    choreList.innerHTML = '';
    if (choreManager.chores.length === 0) {
        choreList.innerHTML = `<li>No chores added yet.</li>`;
    } else {
        choreManager.chores.forEach((chore, index) => {
            const li = document.createElement('li');
            li.textContent = chore.text;
            if (chore.completed) { li.classList.add('completed'); }
            li.addEventListener('click', () => {
                if (choreManager.completeChore(index)) {
                    levelManager.gainXp(10);
                }
            });
            choreList.appendChild(li);
        });
    }

    const activeGoalDisplay = document.getElementById('active-goal-display');
    if (goalManager.activeGoal) {
        const goal = goalManager.activeGoal;
        const current = characterData.stats[goal.stat];
        document.getElementById('goal-text').textContent = `Goal: ${goal.target} ${goal.stat} (${current}/${goal.target})`;
        activeGoalDisplay.classList.remove('hidden');
        goalManager.checkGoal();
    } else {
        activeGoalDisplay.classList.add('hidden');
    }

    if (auth.currentUser) {
        saveData();
    }
}

function showToast(message) {
    // Implement a simple alert for now, or use your CSS toast logic
    alert(message);
}

function renderSkillTree() {
    skillTreeView.innerHTML = '';
    if (currentSkillPath.length === 0) {
        skillTreeTitle.textContent = 'Skill Galaxy';
        skillBackBtn.classList.add('hidden');
        for (const galaxyName in skillTree) {
            const galaxyDiv = document.createElement('div');
            galaxyDiv.className = 'galaxy';
            galaxyDiv.textContent = galaxyName;
            galaxyDiv.onclick = () => {
                currentSkillPath.push(galaxyName);
                renderSkillTree();
            };
            skillTreeView.appendChild(galaxyDiv);
        }
    } else if (currentSkillPath.length === 1) {
        const galaxyName = currentSkillPath[0];
        skillTreeTitle.textContent = galaxyName;
        skillBackBtn.classList.remove('hidden');
        const constellations = skillTree[galaxyName].constellations;
        for (const constName in constellations) {
            const constDiv = document.createElement('div');
            constDiv.className = 'constellation';
            constDiv.textContent = constName;
            constDiv.onclick = () => {
                currentSkillPath.push(constName);
                renderSkillTree();
            };
            skillTreeView.appendChild(constDiv);
        }
    } else if (currentSkillPath.length === 2) {
        const [galaxyName, constName] = currentSkillPath;
        skillTreeTitle.textContent = constName;
        skillBackBtn.classList.remove('hidden');
        const stars = skillTree[galaxyName].constellations[constName].stars;
        for (const starName in stars) {
            const star = stars[starName];
            const starDiv = document.createElement('div');
            starDiv.className = `star ${star.unlocked ? 'unlocked' : 'locked'}`;
            starDiv.textContent = starName;
            skillTreeView.appendChild(starDiv);
        }
    }
}

function checkAllSkillUnlocks() {
    if (!characterData.stats) return;
    for (const galaxyName in skillTree) {
        for (const constName in skillTree[galaxyName].constellations) {
            for (const starName in skillTree[galaxyName].constellations[constName].stars) {
                const star = skillTree[galaxyName].constellations[constName].stars[starName];
                if (!star.unlocked && characterData.stats[star.requires.stat] >= star.requires.value) {
                    star.unlocked = true;
                }
            }
        }
    }
}

function openSkillsModal() {
    checkAllSkillUnlocks();
    currentSkillPath = [];
    renderSkillTree();
    skillsModal.classList.remove('hidden');
}

async function handleFaceScan() {
    // ... This is where your full handleFaceScan function goes
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
        const selectedActivity = document.getElementById('activity-select').value;
        activityManager.logActivity(selectedActivity);
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
    }
});

// These listeners are for the auth screen, so they need to be active on page load
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('signup-btn').addEventListener('click', handleSignUp);
document.getElementById('onboarding-form').addEventListener('submit', handleOnboarding);
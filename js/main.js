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
const STABILITY_API_KEY = "sk-yjemGIKgIaJAeTy1sASe42RUNkSDGA5QsbNEErfzPT7KeKIt";

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

// --- Skill Tree Data Structure ---
let skillTree = {
    'Mind': {
        type: 'galaxy',
        constellations: {
            'Academics': { type: 'constellation', stars: { 'Active Learner': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 12 } }, 'Critical Thinker': { type: 'star', unlocked: false, requires: { stat: 'intelligence', value: 15 } } } },
            'Creativity': { type: 'constellation', stars: { 'Doodler': { type: 'star', unlocked: false, requires: { stat: 'wisdom', value: 11 } }, 'Storyteller': { type: 'star', unlocked: false, requires: { stat: 'charisma', value: 12 } } } }
        }
    },
    'Body': {
        type: 'galaxy',
        constellations: {
            'Fitness': { type: 'constellation', stars: { 'Basic Fitness': { type: 'star', unlocked: false, requires: { stat: 'strength', value: 12 } }, 'Resilience': { type: 'star', unlocked: false, requires: { stat: 'constitution', value: 12 } } } }
        }
    }
};
let currentSkillPath = [];

// --- Manager Logic ---
const levelManager = {
    gainXp: function(amount) {
        if (!characterData) return;
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

const choreManager = {
    chores: [],
    addChore: function(text) {
        if (text) {
            this.chores.push({ text, completed: false });
            return true;
        }
        return false;
    },
    completeChore: function(index) {
        if (this.chores[index] && !this.chores[index].completed) {
            this.chores[index].completed = true;
            return true; // Indicates XP should be awarded
        }
        return false;
    }
};

const goalManager = {
    activeGoal: null,
    setGoal: function(stat, target) {
        if (!stat || isNaN(target) || target <= (characterData.stats[stat] || 0)) {
            showToast("Invalid goal. Target must be higher than current stat.");
            return false;
        }
        this.activeGoal = { stat, target };
        showToast("New goal set!");
        return true;
    },
    checkGoal: function() {
        if (this.activeGoal && characterData.stats[this.activeGoal.stat] >= this.activeGoal.target) {
            showToast(`Goal Achieved! Reached ${this.activeGoal.target} ${this.activeGoal.stat}! +100 XP`);
            levelManager.gainXp(100);
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
        return true;
    }
    return false;
}


// --- ONBOARDING, FACE SCAN, & CORE FUNCTIONS ---
function calculateStartingStats() {
    const exerciseValue = parseInt(document.getElementById('exercise-freq').value);
    const studyValue = parseInt(document.getElementById('study-habit').value);
    characterData = {
        skills: [], level: 1, xp: 0, xpToNextLevel: 100,
        stats: {
            strength: 8 + exerciseValue, dexterity: 8, constitution: 8 + exerciseValue,
            intelligence: 8 + studyValue, wisdom: 8 + studyValue, charisma: 8
        },
        avatarUrl: ''
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
        } catch (error) { alert("Could not access webcam."); return; }
    }

    const context = canvas.getContext('2d');
    canvas.width = webcamFeed.videoWidth;
    canvas.height = webcamFeed.videoHeight;
    context.drawImage(webcamFeed, 0, 0, canvas.width, canvas.height);

    webcamFeed.srcObject.getTracks().forEach(track => track.stop());
    webcamFeed.srcObject = null;
    scanButton.textContent = "Generating...";
    scanButton.disabled = true;

    canvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('init_image', blob, 'avatar.png');
        formData.append('init_image_mode', "IMAGE_STRENGTH");
        formData.append('image_strength', 0.45);
        formData.append('text_prompts[0][text]', 'A beautiful, Ghibli-inspired digital painting of the person, rpg fantasy character portrait, cinematic, stunning');
        formData.append('cfg_scale', 7);
        formData.append('samples', 1);
        formData.append('steps', 30);
        formData.append('style_preset', 'fantasy-art');

        try {
            const response = await fetch("https://api.stability.ai/v1/generation/stable-diffusion-v1-6/image-to-image", {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${STABILITY_API_KEY}` },
                body: formData,
            });
            if (!response.ok) throw new Error(`API Error: ${await response.text()}`);

            const data = await response.json();
            const imageUrl = `data:image/png;base64,${data.artifacts[0].base64}`;
            
            characterData.avatarUrl = imageUrl; // For immediate display
            capturedPhoto.src = imageUrl;
            capturedPhoto.classList.remove('hidden');
            webcamFeed.classList.add('hidden');
            
            const generatedBlob = await (await fetch(imageUrl)).blob();
            const storageRef = storage.ref();
            const avatarRef = storageRef.child(`avatars/${auth.currentUser.uid}.png`);
            await avatarRef.put(generatedBlob);
            characterData.avatarUrl = await avatarRef.getDownloadURL();
            
        } catch (error) {
            console.error(error);
            alert("Failed to generate avatar. Please check API key/credits.");
        } finally {
            scanButton.textContent = 'Rescan Face';
            scanButton.disabled = false;
            updateDashboard();
        }
    }, 'image/png');
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
    document.getElementById('xp-text').textContent = `${characterData.xp} / ${characterData.xpToNextLevel} XP`;
    document.getElementById('xp-bar').style.width = `${(characterData.xp / characterData.xpToNextLevel) * 100}%`;

    const choreList = document.getElementById('chore-list');
    choreList.innerHTML = '';
    (choreManager.chores.length === 0 ? ['No chores added yet.'] : choreManager.chores).forEach((chore, index) => {
        const li = document.createElement('li');
        if (typeof chore === 'string') { // Handle legacy string-only chores
             li.textContent = chore; li.style.fontStyle = 'italic';
             li.classList.add('completed');
        } else {
            li.textContent = chore.text;
            if (chore.completed) li.classList.add('completed');
            li.addEventListener('click', () => { 
                if (choreManager.completeChore(index)) levelManager.gainXp(10); 
            });
        }
        choreList.appendChild(li);
    });

    const activeGoalDisplay = document.getElementById('active-goal-display');
    if (goalManager.activeGoal) {
        const { stat, target } = goalManager.activeGoal;
        const current = characterData.stats[stat];
        document.getElementById('goal-text').textContent = `Goal: ${target} ${stat.charAt(0).toUpperCase() + stat.slice(1)} (${current}/${target})`;
        activeGoalDisplay.classList.remove('hidden');
        goalManager.checkGoal();
    } else {
        activeGoalDisplay.classList.add('hidden');
    }

    const capturedPhoto = document.getElementById('captured-photo');
    if (characterData.avatarUrl) {
        capturedPhoto.src = characterData.avatarUrl;
        capturedPhoto.classList.remove('hidden');
        document.getElementById('webcam-feed').classList.add('hidden');
    }

    if (auth.currentUser) saveData();
}

// --- NEW/IMPLEMENTED FUNCTIONS ---
function renderSkillTree() {
    skillTreeView.innerHTML = '';
    let currentLevel = skillTree;
    let pathSegment = '';
    for (const key of currentSkillPath) {
        pathSegment = key;
        currentLevel = currentLevel[key].constellations || currentLevel[key].stars;
    }

    if (currentSkillPath.length === 0) {
        skillTreeTitle.textContent = "Skill Galaxies";
        skillBackBtn.classList.add('hidden');
    } else {
        skillTreeTitle.textContent = pathSegment;
        skillBackBtn.classList.remove('hidden');
    }

    for (const key in currentLevel) {
        const item = currentLevel[key];
        const element = document.createElement('div');
        element.textContent = key;
        element.classList.add(item.type); // galaxy, constellation, or star

        if (item.type === 'star') {
            element.classList.add(item.unlocked ? 'unlocked' : 'locked');
        } else {
            element.addEventListener('click', () => {
                currentSkillPath.push(key);
                renderSkillTree();
            });
        }
        skillTreeView.appendChild(element);
    }
}

function checkAllSkillUnlocks() {
    if (!characterData.stats) return;
    for (const galaxyName in skillTree) {
        const galaxy = skillTree[galaxyName];
        for (const constName in galaxy.constellations) {
            const constellation = galaxy.constellations[constName];
            for (const starName in constellation.stars) {
                const star = constellation.stars[starName];
                const req = star.requires;
                if (characterData.stats[req.stat] >= req.value) {
                    star.unlocked = true;
                }
            }
        }
    }
}

function openSkillsModal() {
    currentSkillPath = [];
    renderSkillTree();
    skillsModal.classList.remove('hidden');
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = 'var(--color-primary)';
    toast.style.color = 'white';
    toast.style.padding = '12px 20px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    toast.style.zIndex = '1001';
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';

    document.body.appendChild(toast);
    
    setTimeout(() => { toast.style.opacity = '1'; }, 10); // Fade in
    setTimeout(() => { 
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300); // Fade out and remove
    }, 3000);
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
    // This button currently just closes the modal
    document.getElementById('codex-goals-btn').addEventListener('click', () => {
        codexModal.classList.add('hidden');
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
        characterData = {}; // Clear data on logout
        authScreen.classList.remove('hidden');
        appScreen.classList.add('hidden');
    }
});

document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('signup-btn').addEventListener('click', handleSignUp);
document.getElementById('onboarding-form').addEventListener('submit', handleOnboarding);
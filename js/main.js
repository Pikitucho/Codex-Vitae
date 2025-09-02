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
// Replace this with the URL of your deployed Express.js server
const AVATAR_GENERATION_URL = 'YOUR_SERVER_URL_HERE'; 

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
let choreManager = { chores: [] };
let goalManager = { activeGoal: null };
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
        characterData.xp += amount;
        if (characterData.xp >= characterData.xpToNextLevel) this.levelUp();
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

    // Part 1: Capture image from webcam
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

    // Part 2: Draw image to canvas and prepare for sending
    const context = canvas.getContext('2d');
    canvas.width = webcamFeed.videoWidth;
    canvas.height = webcamFeed.videoHeight;
    context.drawImage(webcamFeed, 0, 0, canvas.width, canvas.height);

    webcamFeed.srcObject.getTracks().forEach(track => track.stop());
    webcamFeed.srcObject = null;
    scanButton.textContent = "Generating...";
    scanButton.disabled = true;

    // Get the image data as a base64 string, removing the header
    const imageBase64 = canvas.toDataURL('image/jpeg').split(',')[1];

    // Part 3: Call your secure backend server
    try {
        if (AVATAR_GENERATION_URL === 'YOUR_SERVER_URL_HERE') {
            throw new Error("Avatar generation URL is not set in main.js!");
        }

        // Securely call your backend server, which will then call Vertex AI
        const response = await fetch(AVATAR_GENERATION_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageBase64 }) 
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server Error: ${errorText}`);
        }

        const data = await response.json();
        // The server returns the generated image as a base64 string
        const imageUrl = `data:image/png;base64,${data.base64Image}`;

        // Part 4: Display and Save the new image to Firebase Storage
        capturedPhoto.src = imageUrl;
        capturedPhoto.classList.remove('hidden');
        webcamFeed.classList.add('hidden');

        // Convert the base64 URL back to a blob for uploading
        const generatedBlob = await (await fetch(imageUrl)).blob();
        const storageRef = storage.ref();
        const avatarRef = storageRef.child(`avatars/${auth.currentUser.uid}.png`);
        
        await avatarRef.put(generatedBlob);
        
        // Get the permanent URL from Storage and save it to the database
        characterData.avatarUrl = await avatarRef.getDownloadURL();

    } catch (error) {
        console.error(error);
        alert(`Failed to generate avatar. ${error.message}`);
        // Reset to a default state if something fails
        capturedPhoto.classList.add('hidden');
        webcamFeed.classList.add('hidden'); 
    } finally {
        scanButton.textContent = 'Create Avatar';
        scanButton.disabled = false;
        updateDashboard(); // This will save the new avatarUrl
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
    document.getElementById('xp-text').textContent = `${characterData.xp} / ${characterData.xpToNextLevel} XP`;
    document.getElementById('xp-bar').style.width = `${(characterData.xp / characterData.xpToNextLevel) * 100}%`;

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
            li.addEventListener('click', () => { if (choreManager.completeChore(index)) levelManager.gainXp(10); });
        }
        choreList.appendChild(li);
    });

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

    const capturedPhoto = document.getElementById('captured-photo');
    if (characterData.avatarUrl) {
        capturedPhoto.src = characterData.avatarUrl;
        capturedPhoto.classList.remove('hidden');
        document.getElementById('webcam-feed').classList.add('hidden');
        document.getElementById('scan-face-btn').textContent = 'Update Avatar';
    } else {
        capturedPhoto.src = ''; // Clear if no URL
        capturedPhoto.classList.add('hidden');
    }

    if (auth.currentUser) saveData();
}

// NOTE: These functions need to be implemented fully
function renderSkillTree() { 
    console.log("Rendering skill tree...");
    // Add logic to display galaxies, constellations, and stars
}
function checkAllSkillUnlocks() { 
    console.log("Checking skill unlocks...");
    // Add logic to iterate through skillTree and check requirements
}
function openSkillsModal() { 
    console.log("Opening skills modal...");
    skillsModal.classList.remove('hidden');
    renderSkillTree();
}
function showToast(message) { alert(message); } // Simple placeholder

function setupEventListeners() {
    document.getElementById('add-chore-btn').addEventListener('click', () => {
        const choreInput = document.getElementById('chore-input');
        // This assumes choreManager.addChore is implemented elsewhere
        // if (choreManager.addChore(choreInput.value.trim())) { choreInput.value = ''; updateDashboard(); }
        alert("Chore functionality not fully implemented.");
    });
    document.getElementById('set-goal-btn').addEventListener('click', () => {
        const stat = document.getElementById('goal-stat-select').value;
        const target = parseInt(document.getElementById('goal-value-input').value);
        // This assumes goalManager.setGoal is implemented elsewhere
        // if (goalManager.setGoal(stat, target)) updateDashboard();
        alert("Goal functionality not fully implemented.");
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
        // Clear data when logged out
        characterData = {};
    }
});

document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('signup-btn').addEventListener('click', handleSignUp);
document.getElementById('onboarding-form').addEventListener('submit', handleOnboarding);

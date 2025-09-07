// js/skill-tree-sketch.js

function sketch(p) {
    // --- State Management ---
    let currentView = 'galaxies'; // Can be 'galaxies', 'constellations', or 'stars'
    let selectedGalaxy = null;

    // --- Data Holders ---
    let galaxies = [];
    let constellations = [];

    // --- Setup: Runs once when the sketch starts ---
    p.setup = function() {
      const canvas = p.createCanvas(340, 400);
      canvas.parent('skill-tree-canvas-container');
      prepareGalaxyData();
    };
  
    // --- Draw: Runs continuously in a loop ---
    p.draw = function() {
      p.background(45, 52, 54); 

      if (currentView === 'galaxies') {
        drawGalaxies();
        updateSkillTreeUI("Skill Galaxies", ["Galaxies"], false);
      } else if (currentView === 'constellations') {
        drawConstellations();
        updateSkillTreeUI(selectedGalaxy, ["Galaxies", selectedGalaxy], true);
      }
    };

    // --- Interaction ---
    p.mousePressed = function() {
        if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) {
            return; // Ignore clicks outside the canvas
        }

        if (currentView === 'galaxies') {
            for (const galaxy of galaxies) {
                let distance = p.dist(p.mouseX, p.mouseY, galaxy.x, galaxy.y);
                if (distance < galaxy.size / 2) {
                    currentView = 'constellations';
                    selectedGalaxy = galaxy.name;
                    prepareConstellationData();
                    break;
                }
            }
        }
    };

    // --- Drawing Functions ---
    function drawGalaxies() {
        for (const galaxy of galaxies) {
            drawCelestialBody(galaxy);
        }
    }

    function drawConstellations() {
        for (const constellation of constellations) {
            drawCelestialBody(constellation);
        }
    }

    function drawCelestialBody(body) {
        let distance = p.dist(p.mouseX, p.mouseY, body.x, body.y);
        if (distance < body.size / 2) { p.cursor(p.HAND); } else { p.cursor(p.ARROW); }
        
        p.noStroke();
        p.fill(240, 147, 43, 50); // Glow
        p.ellipse(body.x, body.y, body.size + 15);
        p.fill(72, 52, 212, 150); // Main Body
        p.stroke(245, 246, 250);
        p.strokeWeight(2);
        p.ellipse(body.x, body.y, body.size);
        p.noStroke();
        p.fill(245, 246, 250);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(16);
        p.text(body.name, body.x, body.y);
    }

    // --- Data Preparation ---
    function prepareGalaxyData() {
        galaxies = [];
        const galaxyNames = Object.keys(skillTree);
        const positions = [ { x: p.width * 0.25, y: p.height * 0.25 }, { x: p.width * 0.75, y: p.height * 0.25 }, { x: p.width * 0.25, y: p.height * 0.75 }, { x: p.width * 0.75, y: p.height * 0.75 } ];
        for (let i = 0; i < galaxyNames.length; i++) {
            galaxies.push({ name: galaxyNames[i], x: positions[i].x, y: positions[i].y, size: 120 });
        }
    }

    function prepareConstellationData() {
        const constellationData = skillTree[selectedGalaxy].constellations;
        const constellationNames = Object.keys(constellationData);
        constellations = [];
        for (let i = 0; i < constellationNames.length; i++) {
            constellations.push({ name: constellationNames[i], x: 80 + i * 120, y: p.height / 2, size: 100 });
        }
    }

    // --- Public function for the back button in main.js to call ---
    p.goBack = function() {
        if (currentView === 'constellations') {
            currentView = 'galaxies';
            selectedGalaxy = null;
        }
    }
}
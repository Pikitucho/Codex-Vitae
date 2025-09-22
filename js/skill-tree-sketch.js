// js/skill-tree-sketch.js

function sketch(p) {
    // --- State Management ---
    let currentView = 'galaxies';
    let selectedGalaxy = null;
    let selectedConstellation = null;

    // --- Data Holders ---
    let galaxies = [];
    let constellations = [];
    let stars = [];

    p.setup = function() {
      const canvas = p.createCanvas(340, 400);
      canvas.parent('skill-tree-canvas-container');
      p.textFont('Segoe UI');
      prepareGalaxyData();
    };
  
    p.draw = function() {
      p.background(45, 52, 54); 

      // State machine for drawing
      if (currentView === 'galaxies') {
        drawGalaxies();
        updateSkillTreeUI("Skill Galaxies", ["Galaxies"], false);
      } else if (currentView === 'constellations') {
        drawConstellations();
        updateSkillTreeUI(selectedGalaxy, ["Galaxies", selectedGalaxy], true);
      } else if (currentView === 'stars') {
        drawStars();
        updateSkillTreeUI(selectedConstellation, ["Galaxies", selectedGalaxy, selectedConstellation], true);
      }
    };

    p.mousePressed = function() {
        if (p.mouseX < 0 || p.mouseX > p.width || p.mouseY < 0 || p.mouseY > p.height) {
            return; // Ignore clicks outside the canvas
        }

        if (currentView === 'galaxies') {
            for (const galaxy of galaxies) {
                if (p.dist(p.mouseX, p.mouseY, galaxy.x, galaxy.y) < galaxy.size / 2) {
                    currentView = 'constellations';
                    selectedGalaxy = galaxy.name;
                    prepareConstellationData();
                    break;
                }
            }
        } else if (currentView === 'constellations') {
            for (const constellation of constellations) {
                if (p.dist(p.mouseX, p.mouseY, constellation.x, constellation.y) < constellation.size / 2) {
                    currentView = 'stars';
                    selectedConstellation = constellation.name;
                    p.prepareStarData(); // Use public function
                    break;
                }
            }
        } else if (currentView === 'stars') {
            for (const star of stars) {
                const distance = p.dist(p.mouseX, p.mouseY, star.x, star.y);
                if (distance < star.size / 2) {
                    if (typeof handleStarSelection === 'function') {
                        handleStarSelection({
                            name: star.name,
                            data: star.data,
                            status: star.status,
                            constellation: selectedConstellation,
                            galaxy: selectedGalaxy
                        });
                    }
                    break;
                }
            }
        }
    };

    // --- Drawing Functions ---
    function drawGalaxies() {
        for (const galaxy of galaxies) {
            drawCelestialBody(galaxy.name, galaxy.x, galaxy.y, galaxy.size, 'galaxy');
        }
    }

    function drawConstellations() {
        for (const constellation of constellations) {
            drawCelestialBody(constellation.name, constellation.x, constellation.y, constellation.size, 'constellation');
        }
    }

    function drawStars() {
        // Draw connecting lines first to make it look like a constellation
        p.stroke(245, 246, 250, 50); // Faint, off-white lines
        p.strokeWeight(1);
        for(let i = 0; i < stars.length; i++) {
            let nextIndex = (i + 1) % stars.length; // Connect to the next star, wrapping around
            p.line(stars[i].x, stars[i].y, stars[nextIndex].x, stars[nextIndex].y);
        }

        // Then draw the stars on top
        for (const star of stars) {
            drawCelestialBody(star.name, star.x, star.y, star.size, 'star', star.status);
        }
    }

    function drawCelestialBody(name, x, y, size, type, status = 'locked') {
        let distance = p.dist(p.mouseX, p.mouseY, x, y);
        
        // Determine if the cursor should be a hand
        let isClickable = (type !== 'star') || (distance < size / 2);
        if (isClickable && distance < size / 2) {
            p.cursor(p.HAND);
        } else {
            p.cursor(p.ARROW);
        }
        
        // Default styles
        let glowColor = p.color(240, 147, 43, 50);
        let bodyColor = p.color(72, 52, 212, 150);
        let borderColor = p.color(245, 246, 250);

        if (type === 'star') {
            if (status === 'unlocked') {
                bodyColor = p.color(0, 184, 148, 200); // Success color
                glowColor = p.color(0, 184, 148, 80);
            } else if (status === 'available') {
                bodyColor = p.color(45, 52, 54); // Dark background, so the border pops
            } else { // locked
                bodyColor = p.color(45, 52, 54, 150);
                glowColor = p.color(109, 76, 65, 50); // Muted glow
            }
        }
        
        p.noStroke();
        p.fill(glowColor);
        p.ellipse(x, y, size + 15);

        p.fill(bodyColor);
        p.stroke(borderColor);
        p.strokeWeight(2);

        if (type === 'star' && status === 'available') {
            p.stroke(240, 147, 43); // Accent color for border
            p.strokeWeight(3);
        }

        p.ellipse(x, y, size);

        p.noStroke();
        p.fill(borderColor);
        p.textAlign(p.CENTER, p.CENTER);
        p.textSize(type === 'star' ? 12 : 16);
        p.text(name, x, y);
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

    p.prepareStarData = function() {
        const starData = skillTree[selectedGalaxy].constellations[selectedConstellation].stars;
        const starNames = Object.keys(starData);
        stars = [];
        for (let i = 0; i < starNames.length; i++) {
            const name = starNames[i];
            const data = starData[name];
            let status = 'locked';

            if (typeof determineStarStatus === 'function') {
                status = determineStarStatus(name, data);
            } else if (characterData.unlockedPerks && characterData.unlockedPerks.includes(name)) {
                status = 'unlocked';
            } else if (data.unlock_type === 'perk' && characterData.stats && characterData.stats[data.requires.stat] >= data.requires.value) {
                status = 'available';
            }

            const angle = p.TWO_PI / starNames.length * i - p.HALF_PI;
            const radius = 100;
            const x = p.width / 2 + radius * p.cos(angle);
            const y = p.height / 2 + radius * p.sin(angle);

            stars.push({ name: name, data: data, status: status, x: x, y: y, size: 80 });
        }
    }

    // --- Public function for the back button ---
    p.goBack = function() {
        if (currentView === 'stars') {
            currentView = 'constellations';
        } else if (currentView === 'constellations') {
            currentView = 'galaxies';
        }
    }
}
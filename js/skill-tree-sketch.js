// js/skill-tree-sketch.js

function sketch(p) {
    // --- State Management ---
    let currentView = 'galaxies';
    let selectedGalaxy = null;
    let selectedConstellation = null;

    // --- Data Holders ---
    let galaxies = [];
    let constellations = [];
    let constellationOffsetX = 0;
    let constellationOffsetBounds = { min: 0, max: 0 };
    let pointerDownInfo = null;
    let isDraggingConstellations = false;

    const CONSTELLATION_SPACING = 160;
    const CONSTELLATION_VISIBLE_MARGIN = 100;
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
        if (!isMouseInsideCanvas()) {
            pointerDownInfo = null;
            return;
        }

        pointerDownInfo = { view: currentView };
        isDraggingConstellations = false;

        if (currentView === 'galaxies') {
            for (const galaxy of galaxies) {
                if (p.dist(p.mouseX, p.mouseY, galaxy.x, galaxy.y) < galaxy.size / 2) {
                    currentView = 'constellations';
                    selectedGalaxy = galaxy.name;
                    prepareConstellationData();
                    break;
                }
            }
        } else if (currentView === 'stars') {
            for (const star of stars) {
                if (star.status === 'available' && p.dist(p.mouseX, p.mouseY, star.x, star.y) < star.size / 2) {
                    unlockPerk(star.name, star.data); // Call the function in main.js
                    break;
                }
            }
        }
    };

    p.mouseReleased = function() {
        if (!pointerDownInfo) {
            return;
        }

        if (pointerDownInfo.view === 'constellations' && !isDraggingConstellations && isMouseInsideCanvas()) {
            for (const constellation of constellations) {
                if (p.dist(p.mouseX, p.mouseY, constellation.x, constellation.y) < constellation.size / 2) {
                    currentView = 'stars';
                    selectedConstellation = constellation.name;
                    p.prepareStarData(); // Use public function
                    break;
                }
            }
        }

        pointerDownInfo = null;
        isDraggingConstellations = false;
    };

    p.mouseDragged = function() {
        if (!pointerDownInfo || pointerDownInfo.view !== 'constellations') {
            return;
        }

        const deltaX = p.mouseX - p.pmouseX;
        if (deltaX === 0) {
            return;
        }

        isDraggingConstellations = true;
        setConstellationOffset(constellationOffsetX + deltaX, true);
        return false;
    };

    // --- Drawing Functions ---
    function drawGalaxies() {
        for (const galaxy of galaxies) {
            drawCelestialBody(galaxy.name, galaxy.x, galaxy.y, galaxy.size, 'galaxy');
        }
    }

    function drawConstellations() {
        applyConstellationOffset();
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
        let isClickable = (type !== 'star' || status === 'available');
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
        constellationOffsetX = 0;

        const beltCenterX = p.width / 2;
        const centerOffset = (constellationNames.length - 1) / 2;

        for (let i = 0; i < constellationNames.length; i++) {
            const baseX = beltCenterX + (i - centerOffset) * CONSTELLATION_SPACING;
            constellations.push({ name: constellationNames[i], baseX: baseX, x: baseX, y: p.height / 2, size: 100 });
        }

        recalculateConstellationBounds();
        setConstellationOffset(constellationOffsetX, true);
    }

    p.prepareStarData = function() {
        const starData = skillTree[selectedGalaxy].constellations[selectedConstellation].stars;
        const starNames = Object.keys(starData);
        stars = [];
        for (let i = 0; i < starNames.length; i++) {
            const name = starNames[i];
            const data = starData[name];
            let status = 'locked';

            if (characterData.unlockedPerks && characterData.unlockedPerks.includes(name)) {
                status = 'unlocked';
            } else if (data.unlock_type === 'perk' && characterData.stats[data.requires.stat] >= data.requires.value) {
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

    p.adjustConstellationOffset = function(delta) {
        if (currentView !== 'constellations' || !constellations.length || typeof delta !== 'number' || delta === 0) {
            return;
        }
        setConstellationOffset(constellationOffsetX + delta, true);
    };

    function setConstellationOffset(newOffset, forceRedraw = false) {
        if (!constellations.length) {
            return;
        }

        const previousOffset = constellationOffsetX;
        constellationOffsetX = newOffset;
        applyConstellationOffset();
        if (forceRedraw || constellationOffsetX !== previousOffset) {
            p.redraw();
        }
    }

    function applyConstellationOffset() {
        if (!constellations.length) {
            return;
        }

        constellationOffsetX = clampOffsetValue(constellationOffsetX);
        for (const constellation of constellations) {
            constellation.x = constellation.baseX + constellationOffsetX;
        }
    }

    function clampOffsetValue(value) {
        if (!constellations.length) {
            return 0;
        }

        const min = constellationOffsetBounds.min;
        const max = constellationOffsetBounds.max;
        if (typeof min !== 'number' || typeof max !== 'number') {
            return value;
        }
        return p.constrain(value, min, max);
    }

    function recalculateConstellationBounds() {
        if (!constellations.length) {
            constellationOffsetBounds = { min: 0, max: 0 };
            return;
        }

        const basePositions = constellations.map(constellation => constellation.baseX);
        const minBaseX = Math.min(...basePositions);
        const maxBaseX = Math.max(...basePositions);

        constellationOffsetBounds = {
            min: -CONSTELLATION_VISIBLE_MARGIN - maxBaseX,
            max: p.width + CONSTELLATION_VISIBLE_MARGIN - minBaseX
        };
    }

    function isMouseInsideCanvas() {
        return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    }
}

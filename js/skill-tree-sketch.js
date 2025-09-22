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
    let navigationToken = 0;
    let pendingNavigationTimeouts = [];
    let galaxies = [];
    let constellations = [];
    let constellationOffsetX = 0;
    let constellationOffsetBounds = { min: 0, max: 0 };
    let pointerDownInfo = null;
    let isDraggingConstellations = false;

    const CONSTELLATION_SPACING = 160;
    const CONSTELLATION_VISIBLE_MARGIN = 100;
    const DRAG_ACTIVATION_THRESHOLD = 4;
    const WHEEL_PAN_MULTIPLIER = 0.5;
    let stars = [];

    p.setup = function() {
      const canvas = p.createCanvas(340, 400);
      canvas.parent('skill-tree-canvas-container');
      p.textFont('Segoe UI');
      p.noLoop();
      prepareGalaxyData();
      p.redraw();
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

        pointerDownInfo = {
            view: currentView,
            startX: p.mouseX
        };
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
                    unlockPerk(star.name, star.data);
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
                    p.prepareStarData();
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

        if (!isDraggingConstellations) {
            const travel = Math.abs(p.mouseX - pointerDownInfo.startX);
            if (travel < DRAG_ACTIVATION_THRESHOLD) {
                return;
            }
            isDraggingConstellations = true;
        }

        setConstellationOffset(constellationOffsetX + deltaX);
        return false;
    };

    p.mouseWheel = function(event) {
        if (currentView !== 'constellations' || !constellations.length || !isMouseInsideCanvas()) {
            return;
        }

        let delta = 0;
        if (event) {
            if (typeof event.deltaX === 'number' && Math.abs(event.deltaX) > Math.abs(delta)) {
                delta = event.deltaX;
            }
            if (typeof event.deltaY === 'number' && Math.abs(event.deltaY) > Math.abs(delta)) {
                delta = event.deltaY;
            }
            if (delta === 0 && typeof event.delta === 'number') {
                delta = event.delta;
            }
        }

        if (delta === 0) {
            return;
        }

        setConstellationOffset(constellationOffsetX - delta * WHEEL_PAN_MULTIPLIER);
        return false;
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
        const searchTarget = characterData?.skillSearchTarget;
        for (const galaxy of galaxies) {
            const isTarget = !!searchTarget && searchTarget.galaxy === galaxy.name;
            drawCelestialBody(galaxy.name, galaxy.x, galaxy.y, galaxy.size, 'galaxy', 'locked', isTarget);
        }
    }

    function drawConstellations() {
        const searchTarget = characterData?.skillSearchTarget;
        for (const constellation of constellations) {
            const isTarget = !!searchTarget
                && searchTarget.galaxy === selectedGalaxy
                && searchTarget.constellation === constellation.name;
            drawCelestialBody(constellation.name, constellation.x, constellation.y, constellation.size, 'constellation', 'locked', isTarget);
        }
    }

    function drawStars() {
        const searchTarget = characterData?.skillSearchTarget;
        // Draw connecting lines first to make it look like a constellation
        p.stroke(245, 246, 250, 50); // Faint, off-white lines
        p.strokeWeight(1);
        for(let i = 0; i < stars.length; i++) {
            let nextIndex = (i + 1) % stars.length; // Connect to the next star, wrapping around
            p.line(stars[i].x, stars[i].y, stars[nextIndex].x, stars[nextIndex].y);
        }

        // Then draw the stars on top
        for (const star of stars) {
            const isTarget = !!searchTarget
                && searchTarget.galaxy === selectedGalaxy
                && searchTarget.constellation === selectedConstellation
                && searchTarget.star === star.name;
            drawCelestialBody(star.name, star.x, star.y, star.size, 'star', star.status, isTarget);
        }
    }

    function drawCelestialBody(name, x, y, size, type, status = 'locked', isTarget = false) {
        let distance = p.dist(p.mouseX, p.mouseY, x, y);

        // Determine if the cursor should be a hand
        let isClickable = (type !== 'star' || status === 'available');
        if (isClickable && distance < size / 2) {
            p.cursor(p.HAND); 
        } else { 
            p.cursor(p.ARROW); 

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
        let outlineWeight = 2;

        if (type === 'star') {
            if (status === 'unlocked') {
                bodyColor = p.color(0, 184, 148, 200); // Success color
                glowColor = p.color(0, 184, 148, 80);
            } else if (status === 'available') {
                bodyColor = p.color(45, 52, 54); // Dark background, so the border pops
                outlineWeight = 3;
            } else { // locked
                bodyColor = p.color(45, 52, 54, 150);
                glowColor = p.color(109, 76, 65, 50); // Muted glow
            }
        }

        if (isTarget) {
            glowColor = p.color(255, 200, 124, 120);
            borderColor = p.color(255, 214, 160);
            outlineWeight = Math.max(outlineWeight, 4);
        }

        p.noStroke();
        p.fill(glowColor);
        p.ellipse(x, y, size + 15);

        p.fill(bodyColor);
        p.stroke(borderColor);
        p.strokeWeight(outlineWeight);

        if (type === 'star' && status === 'available') {
            p.stroke(240, 147, 43); // Accent color for border
            p.strokeWeight(3);
        }

        if (isTarget) {
            p.strokeWeight(Math.max(outlineWeight, 4));
            p.stroke(p.color(255, 214, 160));
        }

        p.ellipse(x, y, size);

        if (isTarget) {
            p.noFill();
            p.stroke(p.color(255, 214, 160, 180));
            p.strokeWeight(2);
            p.ellipse(x, y, size + 18);
        }

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
        if (!selectedGalaxy || !skillTree[selectedGalaxy]) {
            constellations = [];
            return;
        }

        const constellationData = skillTree[selectedGalaxy].constellations;
        const constellationNames = Object.keys(constellationData);
        constellations = [];
        for (let i = 0; i < constellationNames.length; i++) {
            constellations.push({ name: constellationNames[i], x: 80 + i * 120, y: p.height / 2, size: 100 });
        }
    }

    p.prepareStarData = function() {
        if (!selectedGalaxy || !selectedConstellation) {
            stars = [];
            return;
        }

        const galaxy = skillTree[selectedGalaxy];
        const constellation = galaxy?.constellations?.[selectedConstellation];

        if (!constellation || !constellation.stars) {
            stars = [];
            return;
        }

        const starData = constellation.stars;
        const starNames = Object.keys(starData);
        const unlockedPerks = Array.isArray(characterData?.unlockedPerks)
            ? characterData.unlockedPerks
            : [];
        const stats = characterData?.stats || {};

        stars = [];
        for (let i = 0; i < starNames.length; i++) {
            const name = starNames[i];
            const data = starData[name];
            let status = 'locked';

            if (unlockedPerks.includes(name)) {
                status = 'unlocked';
            } else if (data.unlock_type === 'perk') {
                const requiredStat = data.requires?.stat;
                const requiredValue = data.requires?.value;
                const statValue = requiredStat && typeof stats[requiredStat] === 'number'
                    ? stats[requiredStat]
                    : null;

                if (statValue !== null && typeof requiredValue === 'number' && statValue >= requiredValue) {
                    status = 'available';
                }
            }

            const angle = p.TWO_PI / starNames.length * i - p.HALF_PI;
            const radius = 100;
            const x = p.width / 2 + radius * p.cos(angle);
            const y = p.height / 2 + radius * p.sin(angle);

            stars.push({ name: name, data: data, status: status, x: x, y: y, size: 80 });
        }
    }

    function resetNavigationQueue() {
        if (pendingNavigationTimeouts.length > 0) {
            for (const timeoutId of pendingNavigationTimeouts) {
                clearTimeout(timeoutId);
            }
            pendingNavigationTimeouts = [];
        }
    }

    // --- Public function for the back button ---
    p.navigateToPath = function(path) {
        if (!path || !path.galaxy || !skillTree[path.galaxy]) {
            return false;
        }

        const wantsConstellation = !!path.constellation;
        const wantsStar = path.type === 'star' && !!path.star;
        const targetConstellationExists = wantsConstellation && !!skillTree[path.galaxy].constellations?.[path.constellation];
        const targetStarExists = wantsStar
            && targetConstellationExists
            && !!skillTree[path.galaxy].constellations[path.constellation].stars?.[path.star];

        if ((wantsConstellation && !targetConstellationExists) || (wantsStar && !targetStarExists)) {
            return false;
        }

        resetNavigationQueue();

        const steps = [];
        const stepDelay = 240;
        const currentToken = ++navigationToken;

        const scheduleStep = (fn) => {
            steps.push(() => {
                if (currentToken !== navigationToken) {
                    return;
                }
                fn();
                if (typeof p.redraw === 'function') {
                    p.redraw();
                }
            });
        };

        const zoomedIn = currentView === 'constellations' || currentView === 'stars';
        const changingGalaxy = !selectedGalaxy || selectedGalaxy !== path.galaxy;

        if (zoomedIn && changingGalaxy) {
            scheduleStep(() => {
                currentView = 'galaxies';
                selectedGalaxy = null;
                selectedConstellation = null;
                prepareGalaxyData();
            });
        }

        if (path.type === 'galaxy') {
            if (currentView !== 'galaxies' || selectedGalaxy !== path.galaxy) {
                scheduleStep(() => {
                    currentView = 'galaxies';
                    selectedGalaxy = path.galaxy;
                    selectedConstellation = null;
                    prepareGalaxyData();
                });
            }
        } else {
            scheduleStep(() => {
                currentView = 'constellations';
                if (selectedGalaxy !== path.galaxy) {
                    selectedGalaxy = path.galaxy;
                    selectedConstellation = null;
                }
                prepareConstellationData();
            });

            if (wantsConstellation && targetConstellationExists) {
                scheduleStep(() => {
                    selectedConstellation = path.constellation;
                });
            }

            if (wantsStar && targetStarExists) {
                scheduleStep(() => {
                    if (!selectedConstellation) {
                        selectedConstellation = path.constellation;
                    }
                    p.prepareStarData();
                    currentView = 'stars';
                });
            }
        }

        if (steps.length === 0) {
            if (typeof p.redraw === 'function') {
                p.redraw();
            }
            return true;
        }

        steps[0]();

        for (let i = 1; i < steps.length; i++) {
            const timeoutId = setTimeout(steps[i], i * stepDelay);
            pendingNavigationTimeouts.push(timeoutId);
        }

        return true;
    };

    p.goBack = function() {
        resetNavigationQueue();
        navigationToken++;
        if (currentView === 'stars') {
            currentView = 'constellations';
        } else if (currentView === 'constellations') {
            currentView = 'galaxies';
        }
    }
}

    function prepareConstellationData() {
        const galaxyData = skillTree[selectedGalaxy];
        const constellationData = galaxyData ? galaxyData.constellations : null;
        const constellationNames = constellationData ? Object.keys(constellationData) : [];
        constellations = [];
        selectedConstellation = null;
        constellationOffsetX = 0;

        if (!constellationNames.length) {
            constellationOffsetBounds = { min: 0, max: 0 };
            p.redraw();
            return;
        }

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
    function prepareConstellationData() {
        const constellationData = skillTree[selectedGalaxy].constellations;
        const constellationNames = Object.keys(constellationData);
        constellations = [];
        for (let i = 0; i < constellationNames.length; i++) {
            constellations.push({ name: constellationNames[i], x: 80 + i * 120, y: p.height / 2, size: 100 });
        }
    }

    p.prepareStarData = function() {
        if (!selectedGalaxy || !selectedConstellation) {
            return;
        }

        const galaxy = skillTree[selectedGalaxy];
        const constellation = galaxy?.constellations?.[selectedConstellation];
        const starData = constellation?.stars;

        if (!starData) {
            return;
        }

        const starNames = Object.keys(starData);
        const unlockedPerks = characterData.unlockedPerks || [];
        const stats = characterData.stats || {};
        const verifiedProofs = Array.isArray(characterData.verifiedProofs)
            ? characterData.verifiedProofs
            : [];
        const hasSkillPoints = (characterData.skillPoints || 0) > 0;

        stars = [];
      
    p.prepareStarData = function() {
        const starData = skillTree[selectedGalaxy].constellations[selectedConstellation].stars;
        const starNames = Object.keys(starData);
        stars = [];
        for (let i = 0; i < starNames.length; i++) {
            const name = starNames[i];
            const data = starData[name];
            let status = 'locked';

            const requires = data.requires || {};
            const requiredStat = requires.stat;
            const requiredValue = requires.value;
            const hasStatRequirement = requiredStat && requiredValue !== undefined;
            const statValue = hasStatRequirement ? stats[requiredStat] : null;
            const meetsStatRequirement = !hasStatRequirement
                || (typeof statValue === 'number' && statValue >= requiredValue);

            const requiredProof = requires.proof;
            const hasProofRequirement = typeof requiredProof === 'string' && requiredProof.trim().length > 0;
            const meetsProofRequirement = !hasProofRequirement || verifiedProofs.includes(name);

            const meetsAllRequirements = meetsStatRequirement && meetsProofRequirement;
            const requiresSkillPoint = data.unlock_type === 'perk';

            if (unlockedPerks.includes(name)) {
                status = 'unlocked';
            } else if (requiresSkillPoint) {
                if (meetsAllRequirements && hasSkillPoints) {
                    status = 'available';
                }
            } else if (meetsAllRequirements) {
              
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

        p.redraw();
    }

    // --- Public function for the back button ---
    p.goBack = function() {
        if (currentView === 'stars') {
            currentView = 'constellations';
            selectedConstellation = null;
            p.redraw();
        } else if (currentView === 'constellations') {
            currentView = 'galaxies';
            selectedGalaxy = null;
            selectedConstellation = null;
            constellations = [];
            constellationOffsetBounds = { min: 0, max: 0 };
            constellationOffsetX = 0;
            p.redraw();
        }
    }

    p.adjustConstellationOffset = function(delta) {
        if (currentView !== 'constellations' || !constellations.length || typeof delta !== 'number' || delta === 0) {
            return;
        }
        setConstellationOffset(constellationOffsetX + delta);
    };

    function setConstellationOffset(newOffset, forceUpdate = false) {
        if (!constellations.length) {
            return;
        }

        const clampedOffset = clampOffsetValue(newOffset);
        if (!forceUpdate && clampedOffset === constellationOffsetX) {
            return;
        }

        constellationOffsetX = clampedOffset;
        updateConstellationPositions();
        p.redraw();
    }

    function updateConstellationPositions() {
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

        const extents = constellations.map(constellation => ({
            min: constellation.baseX - constellation.size / 2,
            max: constellation.baseX + constellation.size / 2
        }));
        const minReach = Math.min(...extents.map(extent => extent.min));
        const maxReach = Math.max(...extents.map(extent => extent.max));

        const margin = Math.max(0, Math.min(CONSTELLATION_VISIBLE_MARGIN, p.width / 2));
        const minOffset = -maxReach + margin;
        const maxOffset = p.width - margin - minReach;

        if (minOffset > maxOffset) {
            const centeredOffset = (minOffset + maxOffset) / 2;
            constellationOffsetBounds = { min: centeredOffset, max: centeredOffset };
        } else {
            constellationOffsetBounds = { min: minOffset, max: maxOffset };
        }
    }

    function isMouseInsideCanvas() {
        return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    }
}

            stars.push({ name: name, data: data, status: status, x: x, y: y, size: 80 });
        }
    };

    p.refreshStars = function() {
        if (currentView === 'stars') {
            p.prepareStarData();
        }
    };

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

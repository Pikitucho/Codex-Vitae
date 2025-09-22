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
                if (star.status === 'available' && p.dist(p.mouseX, p.mouseY, star.x, star.y) < star.size / 2) {
                    unlockPerk(star.name, star.data); // Call the function in main.js
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
    p.navigateToPath = function(path) {
        if (!path || !path.galaxy || !skillTree[path.galaxy]) {
            return;
        }

        const wantsConstellation = !!path.constellation;
        const wantsStar = path.type === 'star' && !!path.star;
        const targetConstellationExists = wantsConstellation && !!skillTree[path.galaxy].constellations?.[path.constellation];
        const targetStarExists = wantsStar
            && targetConstellationExists
            && !!skillTree[path.galaxy].constellations[path.constellation].stars?.[path.star];

        const steps = [];
        const stepDelay = 240;

        const scheduleStep = (fn) => {
            steps.push(() => {
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
            scheduleStep(() => {
                currentView = 'galaxies';
                selectedGalaxy = path.galaxy;
                selectedConstellation = null;
                prepareGalaxyData();
            });
        } else {
            scheduleStep(() => {
                currentView = 'constellations';
                if (selectedGalaxy !== path.galaxy) {
                    selectedGalaxy = path.galaxy;
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
            return;
        }

        let accumulatedDelay = 0;
        steps.forEach(step => {
            setTimeout(step, accumulatedDelay);
            accumulatedDelay += stepDelay;
        });
    };

    p.goBack = function() {
        if (currentView === 'stars') {
            currentView = 'constellations';
        } else if (currentView === 'constellations') {
            currentView = 'galaxies';
        }
    }
}

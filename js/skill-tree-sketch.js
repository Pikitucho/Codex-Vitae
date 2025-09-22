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

    // --- Interaction State ---
    let constellationOffsetX = 0;
    let constellationOffsetBounds = { min: 0, max: 0 };
    let pointerDownInfo = null;
    let isDraggingConstellations = false;

    // --- Navigation Scheduling ---
    let navigationToken = 0;
    let pendingNavigationTimeouts = [];

    // --- Constants ---
    const CONSTELLATION_SPACING = 160;
    const CONSTELLATION_VISIBLE_MARGIN = 100;
    const DRAG_ACTIVATION_THRESHOLD = 4;
    const WHEEL_PAN_MULTIPLIER = 0.5;
    const STAR_RING_RADIUS = 100;

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
        p.cursor(p.ARROW);

        if (currentView === 'galaxies') {
            drawGalaxies();
            updateSkillTreeUI('Skill Galaxies', ['Galaxies'], false);
        } else if (currentView === 'constellations') {
            drawConstellations();
            updateSkillTreeUI(selectedGalaxy, ['Galaxies', selectedGalaxy], true);
        } else if (currentView === 'stars') {
            drawStars();
            updateSkillTreeUI(selectedConstellation, ['Galaxies', selectedGalaxy, selectedConstellation], true);
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
                    selectedConstellation = null;
                    prepareConstellationData();
                    p.redraw();
                    break;
                }
            }
        } else if (currentView === 'stars') {
            for (const star of stars) {
                if (p.dist(p.mouseX, p.mouseY, star.x, star.y) < star.size / 2) {
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

    p.mouseReleased = function() {
        if (!pointerDownInfo) {
            return;
        }

        if (
            pointerDownInfo.view === 'constellations' &&
            !isDraggingConstellations &&
            isMouseInsideCanvas()
        ) {
            for (const constellation of constellations) {
                if (p.dist(p.mouseX, p.mouseY, constellation.x, constellation.y) < constellation.size / 2) {
                    currentView = 'stars';
                    selectedConstellation = constellation.name;
                    focusConstellation(constellation.name);
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

        setConstellationOffset(constellationOffsetX + deltaX, true);
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

        setConstellationOffset(constellationOffsetX - delta * WHEEL_PAN_MULTIPLIER, true);
        return false;
    };

    // --- Drawing Helpers ---
    function drawGalaxies() {
        const searchTarget = characterData?.skillSearchTarget;
        for (const galaxy of galaxies) {
            const isTarget = searchTarget?.galaxy === galaxy.name;
            drawCelestialBody(galaxy.name, galaxy.x, galaxy.y, galaxy.size, 'galaxy', 'locked', isTarget);
        }
    }

    function drawConstellations() {
        const searchTarget = characterData?.skillSearchTarget;
        for (const constellation of constellations) {
            const isTarget =
                searchTarget?.galaxy === selectedGalaxy &&
                searchTarget?.constellation === constellation.name;
            drawCelestialBody(
                constellation.name,
                constellation.x,
                constellation.y,
                constellation.size,
                'constellation',
                'locked',
                isTarget
            );
        }
    }

    function drawStars() {
        const searchTarget = characterData?.skillSearchTarget;

        p.stroke(245, 246, 250, 50);
        p.strokeWeight(1);
        for (let i = 0; i < stars.length; i++) {
            const nextIndex = (i + 1) % stars.length;
            p.line(stars[i].x, stars[i].y, stars[nextIndex].x, stars[nextIndex].y);
        }

        for (const star of stars) {
            const isTarget =
                searchTarget?.galaxy === selectedGalaxy &&
                searchTarget?.constellation === selectedConstellation &&
                searchTarget?.star === star.name;
            drawCelestialBody(star.name, star.x, star.y, star.size, 'star', star.status, isTarget);
        }
    }

    function drawCelestialBody(name, x, y, size, type, status = 'locked', isTarget = false) {
        const distance = p.dist(p.mouseX, p.mouseY, x, y);
        const isClickable = type === 'star' || type === 'galaxy' || type === 'constellation';
        if (isClickable && distance < size / 2) {
            p.cursor(p.HAND);
        }

        let glowColor = p.color(240, 147, 43, 50);
        let bodyColor = p.color(72, 52, 212, 150);
        let borderColor = p.color(245, 246, 250);
        let outlineWeight = 2;

        if (type === 'star') {
            if (status === 'unlocked') {
                bodyColor = p.color(0, 184, 148, 200);
                glowColor = p.color(0, 184, 148, 80);
            } else if (status === 'available') {
                bodyColor = p.color(45, 52, 54);
                outlineWeight = 3;
            } else {
                bodyColor = p.color(45, 52, 54, 150);
                glowColor = p.color(109, 76, 65, 50);
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
        const tree = window.skillTree || {};
        const galaxyNames = Object.keys(tree);
        galaxies = [];

        if (!galaxyNames.length) {
            return;
        }

        const centerX = p.width / 2;
        const centerY = p.height / 2;
        const radius = Math.min(p.width, p.height) / 3;

        for (let i = 0; i < galaxyNames.length; i++) {
            const angle = (i / galaxyNames.length) * p.TWO_PI - p.HALF_PI;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            galaxies.push({ name: galaxyNames[i], x, y, size: 120 });
        }
    }

    function prepareConstellationData() {
        const galaxyData = (window.skillTree?.[selectedGalaxy]?.constellations) || {};
        const constellationNames = Object.keys(galaxyData);

        constellations = [];
        constellationOffsetX = 0;
        selectedConstellation = null;
        stars = [];

        if (!constellationNames.length) {
            recalculateConstellationBounds();
            return;
        }

        const beltCenterX = p.width / 2;
        const centerOffset = (constellationNames.length - 1) / 2;

        for (let i = 0; i < constellationNames.length; i++) {
            const baseX = beltCenterX + (i - centerOffset) * CONSTELLATION_SPACING;
            constellations.push({ name: constellationNames[i], baseX, x: baseX, y: p.height / 2, size: 100 });
        }

        recalculateConstellationBounds();
        setConstellationOffset(0, true);
    }

    function focusConstellation(constellationName) {
        const target = constellations.find(constellation => constellation.name === constellationName);
        if (!target) {
            return;
        }
        const desiredOffset = p.width / 2 - target.baseX;
        setConstellationOffset(desiredOffset, true);
    }

    p.prepareStarData = function() {
        if (!selectedGalaxy || !selectedConstellation) {
            stars = [];
            p.redraw();
            return;
        }

        const starData = window.skillTree?.[selectedGalaxy]?.constellations?.[selectedConstellation]?.stars;
        if (!starData) {
            stars = [];
            p.redraw();
            return;
        }

        const starNames = Object.keys(starData);
        const unlockedPerks = Array.isArray(characterData?.unlockedPerks) ? characterData.unlockedPerks : [];
        const stats = characterData?.stats || {};
        const verifiedProofs = Array.isArray(characterData?.verifiedProofs) ? characterData.verifiedProofs : [];
        const hasSkillPoints = (characterData?.skillPoints || 0) > 0;

        stars = [];

        for (let i = 0; i < starNames.length; i++) {
            const name = starNames[i];
            const data = starData[name];
            let status = 'locked';

            if (typeof determineStarStatus === 'function') {
                status = determineStarStatus(name, data);
            } else if (unlockedPerks.includes(name)) {
                status = 'unlocked';
            } else if (data.unlock_type === 'perk') {
                const requiredStat = data.requires?.stat;
                const requiredValue = data.requires?.value;
                const statValue = requiredStat && typeof stats[requiredStat] === 'number' ? stats[requiredStat] : null;
                if (
                    hasSkillPoints &&
                    requiredStat &&
                    typeof requiredValue === 'number' &&
                    statValue !== null &&
                    statValue >= requiredValue
                ) {
                    status = 'available';
                }
            } else if (data.unlock_type === 'credential') {
                const requiredProof = data.requires?.proof;
                if (requiredProof && verifiedProofs.includes(name)) {
                    status = 'unlocked';
                }
            }

            const angle = (i / starNames.length) * p.TWO_PI - p.HALF_PI;
            const x = p.width / 2 + STAR_RING_RADIUS * Math.cos(angle);
            const y = p.height / 2 + STAR_RING_RADIUS * Math.sin(angle);

            stars.push({ name, data, status, x, y, size: 80 });
        }

        p.redraw();
    };

    p.refreshStars = function() {
        if (currentView === 'stars') {
            p.prepareStarData();
        } else {
            p.redraw();
        }
    };

    function resetNavigationQueue() {
        if (pendingNavigationTimeouts.length) {
            for (const timeoutId of pendingNavigationTimeouts) {
                clearTimeout(timeoutId);
            }
            pendingNavigationTimeouts = [];
        }
    }

    p.navigateToPath = function(path) {
        if (!path || !path.galaxy || !window.skillTree?.[path.galaxy]) {
            return false;
        }

        const wantsConstellation = !!path.constellation;
        const wantsStar = path.type === 'star' && !!path.star;
        const targetConstellationExists = wantsConstellation && !!window.skillTree[path.galaxy].constellations?.[path.constellation];
        const targetStarExists = wantsStar && targetConstellationExists && !!window.skillTree[path.galaxy].constellations[path.constellation].stars?.[path.star];

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
                p.redraw();
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
                    focusConstellation(path.constellation);
                });
            }

            if (wantsStar && targetStarExists) {
                scheduleStep(() => {
                    if (!selectedConstellation) {
                        selectedConstellation = path.constellation;
                        focusConstellation(path.constellation);
                    }
                    currentView = 'stars';
                    p.prepareStarData();
                });
            }
        }

        if (!steps.length) {
            p.redraw();
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
            selectedConstellation = null;
            stars = [];
        } else if (currentView === 'constellations') {
            currentView = 'galaxies';
            selectedGalaxy = null;
            selectedConstellation = null;
            constellations = [];
            stars = [];
        }

        p.redraw();
    };

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

        const clampedOffset = clampOffsetValue(newOffset);
        if (!forceRedraw && clampedOffset === constellationOffsetX) {
            return;
        }

        constellationOffsetX = clampedOffset;
        updateConstellationPositions();

        if (forceRedraw || clampedOffset !== newOffset) {
            p.redraw();
        }
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
            const centered = (minOffset + maxOffset) / 2;
            constellationOffsetBounds = { min: centered, max: centered };
        } else {
            constellationOffsetBounds = { min: minOffset, max: maxOffset };
        }
    }

    function isMouseInsideCanvas() {
        return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    }
}

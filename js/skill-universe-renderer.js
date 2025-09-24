(function(global) {
    'use strict';

    if (!global || typeof global.THREE === 'undefined') {
        console.error('SkillUniverseRenderer requires Three.js to be loaded before this script.');
        return;
    }

    const THREE = global.THREE;

    // Support both legacy Geometry and newer BufferGeometry naming.
    const CircleGeometryClass = typeof THREE.CircleGeometry === 'function'
        ? THREE.CircleGeometry
        : (typeof THREE.CircleBufferGeometry === 'function' ? THREE.CircleBufferGeometry : null);

    const RingGeometryClass = typeof THREE.RingGeometry === 'function'
        ? THREE.RingGeometry
        : (typeof THREE.RingBufferGeometry === 'function' ? THREE.RingBufferGeometry : null);

    const CAMERA_LEVELS = {
        galaxies: { distance: 2150, height: 380, duration: 1500 },
        constellations: { distance: 920, height: 260, duration: 1200 },
        starSystems: { distance: 480, height: 170, duration: 1100 },
        stars: { distance: 180, height: 82, duration: 1200 }
    };

    const CAMERA_THRESHOLDS = {
        starToSystem: (CAMERA_LEVELS.starSystems.distance + CAMERA_LEVELS.stars.distance) / 2,
        systemToConstellation: (CAMERA_LEVELS.constellations.distance + CAMERA_LEVELS.starSystems.distance) / 2,
        constellationToGalaxy: (CAMERA_LEVELS.galaxies.distance + CAMERA_LEVELS.constellations.distance) / 2
    };

    const STATUS_COLORS = {
        unlocked: 0x00b894,
        available: 0xffc048,
        locked: 0x4b4b4b
    };

    const STAR_STATUS_LABELS = {
        unlocked: 'Unlocked',
        available: 'Available to Unlock',
        locked: 'Locked'
    };

    const GALAXY_RADIUS = 920;
    const CONSTELLATION_RADIUS = 360;
    const STAR_SYSTEM_RADIUS = 110;
    const STAR_ORBIT_RADIUS = 32;

    const STARFIELD_CONFIG = {
        count: 2400,
        radius: 4600,
        size: 1.9,
        opacity: 0.82
    };

    const LABEL_DEFAULTS = {
        fontSize: 48,
        padding: 18,
        scale: 1.0
    };

    const GALAXY_TEXTURE_SIZE = 1024;
    const galaxyTextureCache = new Map();

    function clamp01(value) {
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.max(0, Math.min(1, value));
    }

    if (THREE.Color && THREE.Color.prototype && typeof THREE.Color.prototype.lerp !== 'function') {
        THREE.Color.prototype.lerp = function lerp(targetColor, alpha) {
            const target = targetColor instanceof THREE.Color
                ? targetColor
                : new THREE.Color(targetColor ?? 0xffffff);
            const t = clamp01(Number.isFinite(alpha) ? alpha : 0);
            this.r += (target.r - this.r) * t;
            this.g += (target.g - this.g) * t;
            this.b += (target.b - this.b) * t;
            return this;
        };
    }

    function ensureColorInstance(input, fallbackHex = 0xffffff) {
        if (input instanceof THREE.Color) {
            return input;
        }
        const normalized = normalizeColorInput ? normalizeColorInput(input) : null;
        if (normalized !== null) {
            return new THREE.Color(normalized);
        }
        return new THREE.Color(fallbackHex);
    }

    function mixColors(colorA, colorB, alpha = 0.5) {
        const from = ensureColorInstance(colorA);
        const to = ensureColorInstance(colorB);
        const t = clamp01(Number.isFinite(alpha) ? alpha : 0);
        const mixed = new THREE.Color();
        mixed.r = from.r + (to.r - from.r) * t;
        mixed.g = from.g + (to.g - from.g) * t;
        mixed.b = from.b + (to.b - from.b) * t;
        return mixed;
    }

    function colorToRgbaString(color, alpha = 1) {
        if (!color || typeof color.r !== 'number') {
            return `rgba(255, 255, 255, ${clamp01(alpha)})`;
        }
        const r = Math.round(Math.max(0, Math.min(255, color.r * 255)));
        const g = Math.round(Math.max(0, Math.min(255, color.g * 255)));
        const b = Math.round(Math.max(0, Math.min(255, color.b * 255)));
        const a = clamp01(alpha);
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    function createGalaxyTexture(baseColorValue, emissiveColorValue) {
        const safeBase = Number.isFinite(baseColorValue) ? baseColorValue : 0x6c5ce7;
        const safeEmissive = Number.isFinite(emissiveColorValue) ? emissiveColorValue : 0x241563;
        const cacheKey = `${safeBase}|${safeEmissive}`;
        if (galaxyTextureCache.has(cacheKey)) {
            return galaxyTextureCache.get(cacheKey);
        }

        const canvas = document.createElement('canvas');
        canvas.width = GALAXY_TEXTURE_SIZE;
        canvas.height = GALAXY_TEXTURE_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, GALAXY_TEXTURE_SIZE, GALAXY_TEXTURE_SIZE);

        const half = GALAXY_TEXTURE_SIZE / 2;
        const baseColor = new THREE.Color(safeBase);
        const emissiveColor = new THREE.Color(safeEmissive);
        const white = new THREE.Color(0xffffff);
        const deepSpace = new THREE.Color(0x02030b);
        const coreColor = mixColors(baseColor, white, 0.55);
        const highlightColor = mixColors(emissiveColor, white, 0.4);
        const outerColor = mixColors(baseColor, deepSpace, 0.9);

        const gradient = ctx.createRadialGradient(half, half, GALAXY_TEXTURE_SIZE * 0.06, half, half, GALAXY_TEXTURE_SIZE * 0.5);
        gradient.addColorStop(0, colorToRgbaString(coreColor, 0.95));
        gradient.addColorStop(0.32, colorToRgbaString(baseColor, 0.85));
        gradient.addColorStop(0.62, colorToRgbaString(highlightColor, 0.45));
        gradient.addColorStop(1, colorToRgbaString(outerColor, 0));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GALAXY_TEXTURE_SIZE, GALAXY_TEXTURE_SIZE);

        ctx.save();
        ctx.translate(half, half);
        ctx.scale(1.18, 0.78);
        const spiralArms = 3;
        for (let arm = 0; arm < spiralArms; arm += 1) {
            ctx.save();
            ctx.rotate((Math.PI * 2 * arm) / spiralArms);
            ctx.beginPath();
            const segments = 220;
            for (let step = 0; step <= segments; step += 1) {
                const t = step / segments;
                const radius = Math.pow(t, 0.92) * half * 0.95;
                const angle = t * Math.PI * 1.9;
                const x = Math.cos(angle) * radius;
                const y = Math.sin(angle) * radius * 0.62;
                if (step === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.strokeStyle = colorToRgbaString(highlightColor, 0.18);
            ctx.lineWidth = GALAXY_TEXTURE_SIZE * 0.02;
            ctx.lineCap = 'round';
            ctx.shadowColor = colorToRgbaString(highlightColor, 0.45);
            ctx.shadowBlur = GALAXY_TEXTURE_SIZE * 0.05;
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();

        ctx.save();
        ctx.translate(half, half);
        ctx.scale(1.08, 0.82);
        const sparkleCount = 160;
        for (let i = 0; i < sparkleCount; i += 1) {
            const radius = Math.pow(Math.random(), 0.55) * half * 0.92;
            const angle = Math.random() * Math.PI * 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius * 0.7;
            const starSize = Math.pow(Math.random(), 1.8) * 7 + 1.2;
            const alpha = 0.12 + Math.random() * 0.35;
            const tint = Math.random() < 0.3
                ? mixColors(highlightColor, baseColor, 0.4)
                : white;
            ctx.beginPath();
            ctx.fillStyle = colorToRgbaString(tint, alpha);
            ctx.arc(x, y, starSize * 0.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        const coreGlow = ctx.createRadialGradient(half, half, GALAXY_TEXTURE_SIZE * 0.02, half, half, GALAXY_TEXTURE_SIZE * 0.12);
        coreGlow.addColorStop(0, colorToRgbaString(white, 0.9));
        coreGlow.addColorStop(0.65, colorToRgbaString(highlightColor, 0.4));
        coreGlow.addColorStop(1, colorToRgbaString(highlightColor, 0));
        ctx.fillStyle = coreGlow;
        ctx.beginPath();
        ctx.arc(half, half, GALAXY_TEXTURE_SIZE * 0.12, 0, Math.PI * 2);
        ctx.fill();

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.encoding = THREE.sRGBEncoding;
        texture.anisotropy = 4;
        texture.needsUpdate = true;

        galaxyTextureCache.set(cacheKey, texture);
        return texture;
    }

    function createLabelSprite(text, overrides = {}) {
        const options = { ...LABEL_DEFAULTS, ...overrides };
        const { fontSize, padding, scale } = options;
        const ratio = global.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontFamily = "600 " + fontSize + "px 'Segoe UI', 'Helvetica Neue', sans-serif";

        ctx.font = fontFamily;
        const metrics = ctx.measureText(text);
        const textWidth = metrics.width;
        const textHeight = fontSize;

        const width = (textWidth + padding * 2) * ratio;
        const height = (textHeight + padding * 2) * ratio;
        canvas.width = Math.max(1, Math.ceil(width));
        canvas.height = Math.max(1, Math.ceil(height));

        ctx.scale(ratio, ratio);
        ctx.font = fontFamily;
        ctx.fillStyle = 'rgba(10, 10, 10, 0.65)';
        ctx.fillRect(0, 0, textWidth + padding * 2, textHeight + padding * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(text, textWidth / 2 + padding, textHeight / 2 + padding);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.encoding = THREE.sRGBEncoding;
        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        });

        const sprite = new THREE.Sprite(material);
        const aspect = canvas.width / canvas.height;
        const baseScale = scale * 22;
        sprite.scale.set(baseScale * aspect, baseScale, 1);
        sprite.renderOrder = 2;
        return sprite;
    }

    const skillTreeUtils = global.SkillTreeUtils || {};

    const getConstellationStarSystems = typeof skillTreeUtils.getConstellationStarSystems === 'function'
        ? (constellationData, constellationName) => skillTreeUtils.getConstellationStarSystems(constellationData, constellationName)
        : (constellationData) => (constellationData && typeof constellationData.starSystems === 'object' ? constellationData.starSystems : {});

    const findStarInConstellation = typeof skillTreeUtils.findStarInConstellation === 'function'
        ? (constellationData, starName, constellationName) => skillTreeUtils.findStarInConstellation(constellationData, starName, constellationName)
        : (constellationData, starName) => {
            if (!constellationData || typeof starName !== 'string') {
                return null;
            }
            if (constellationData.stars && Object.prototype.hasOwnProperty.call(constellationData.stars, starName)) {
                return {
                    starData: constellationData.stars[starName],
                    starSystemName: null,
                    starSystem: null
                };
            }
            return null;
        };

    function createRadialPosition(index, total, radius, verticalAmplitude = 0) {
        const safeTotal = Math.max(total || 0, 1);
        const angle = (index % safeTotal) / safeTotal * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = verticalAmplitude ? Math.sin(angle * 2) * verticalAmplitude : 0;
        return { x, y, z };
    }

    function toVector3(position, fallback = { x: 0, y: 0, z: 0 }) {
        const base = position && typeof position === 'object' ? position : {};
        const safeFallback = fallback && typeof fallback === 'object' ? fallback : { x: 0, y: 0, z: 0 };
        const toFinite = (value, defaultValue) => (Number.isFinite(value) ? value : defaultValue);
        return {
            x: toFinite(base.x, toFinite(safeFallback.x, 0)),
            y: toFinite(base.y, toFinite(safeFallback.y, 0)),
            z: toFinite(base.z, toFinite(safeFallback.z, 0))
        };
    }

    function lerpVectors(start, end, t) {
        if (!start || !end) {
            return new THREE.Vector3();
        }
        const toFinite = (value) => (Number.isFinite(value) ? value : 0);
        const safeStart = start instanceof THREE.Vector3
            ? start
            : new THREE.Vector3(toFinite(start.x), toFinite(start.y), toFinite(start.z));
        const safeEnd = end instanceof THREE.Vector3
            ? end
            : new THREE.Vector3(toFinite(end.x), toFinite(end.y), toFinite(end.z));
        const factor = clamp01(Number.isFinite(t) ? t : 0);
        return new THREE.Vector3(
            safeStart.x + (safeEnd.x - safeStart.x) * factor,
            safeStart.y + (safeEnd.y - safeStart.y) * factor,
            safeStart.z + (safeEnd.z - safeStart.z) * factor
        );
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizeColorInput(input) {
        if (typeof input === 'number' && Number.isFinite(input)) {
            return input;
        }
        if (typeof input === 'string') {
            const trimmed = input.trim();
            if (!trimmed) {
                return null;
            }
            if (trimmed.startsWith('#')) {
                const parsed = parseInt(trimmed.slice(1), 16);
                return Number.isFinite(parsed) ? parsed : null;
            }
            if (/^0x/i.test(trimmed)) {
                const parsed = parseInt(trimmed, 16);
                return Number.isFinite(parsed) ? parsed : null;
            }
        }
        if (input && typeof input === 'object') {
            const { r, g, b } = input;
            if ([r, g, b].every((component) => Number.isFinite(component))) {
                const clampChannel = (channel) => Math.max(0, Math.min(255, Math.round(channel)));
                const red = clampChannel(r);
                const green = clampChannel(g);
                const blue = clampChannel(b);
                return (red << 16) | (green << 8) | blue;
            }
        }
        return null;
    }

    function resolveColor(input, fallback) {
        const normalized = normalizeColorInput(input);
        return normalized !== null ? normalized : fallback;
    }

    function resolveEntityColor(entity, fallback) {
        if (!entity || typeof entity !== 'object') {
            return fallback;
        }
        const direct = normalizeColorInput(entity.color ?? entity.tint);
        if (direct !== null) {
            return direct;
        }
        if (entity.appearance && typeof entity.appearance === 'object') {
            const appearanceColor = normalizeColorInput(entity.appearance.color ?? entity.appearance.tint);
            if (appearanceColor !== null) {
                return appearanceColor;
            }
        }
        return fallback;
    }

    function formatUnlockTypeLabel(type) {
        if (typeof type !== 'string') {
            return '';
        }
        const trimmed = type.trim();
        if (!trimmed) {
            return '';
        }
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }

    function buildStarLocationLabel(userData) {
        if (!userData || typeof userData !== 'object') {
            return '';
        }
        const parts = [];
        if (typeof userData.galaxy === 'string' && userData.galaxy.trim()) {
            parts.push(userData.galaxy.trim());
        }
        if (typeof userData.constellation === 'string' && userData.constellation.trim()) {
            parts.push(userData.constellation.trim());
        }
        if (typeof userData.starSystem === 'string' && userData.starSystem.trim()) {
            parts.push(userData.starSystem.trim());
        }
        return parts.join(' • ');
    }

    class SkillUniverseRenderer {
        constructor(options = {}) {
            this.container = options.container || document.getElementById('skill-tree-canvas-container');
            if (!this.container) {
                throw new Error('SkillUniverseRenderer requires a container element.');
            }

            this.getSkillTree = typeof options.getSkillTree === 'function'
                ? options.getSkillTree
                : () => global.skillTree || {};
            this.resolveStarStatus = typeof options.resolveStarStatus === 'function'
                ? options.resolveStarStatus
                : () => 'locked';
            this.onSelectStar = typeof options.onSelectStar === 'function'
                ? options.onSelectStar
                : null;
            this.onHoverStar = typeof options.onHoverStar === 'function'
                ? options.onHoverStar
                : null;
            this.onViewChange = typeof options.onViewChange === 'function'
                ? options.onViewChange
                : null;

            this.scene = new THREE.Scene();
            this.scene.fog = new THREE.FogExp2(0x04070d, 0.00085);
            this.starfield = null;

            const { width, height } = this._getContainerSize();
            this.camera = new THREE.PerspectiveCamera(55, width / height, 1, 9000);
            const initialHeight = CAMERA_LEVELS.galaxies.height * 1.15;
            const initialDistance = CAMERA_LEVELS.galaxies.distance + 420;
            this.camera.position.set(0, initialHeight, initialDistance);
            this.cameraTarget = new THREE.Vector3(0, 0, 0);

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.setSize(width, height, false);
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            this.renderer.domElement.style.display = 'block';
            this.renderer.setPixelRatio(global.devicePixelRatio || 1);
            this.renderer.setClearColor(0x02030b, 1);
            this.container.innerHTML = '';
            this.container.appendChild(this.renderer.domElement);
            this.starFocusOverlay = this._createStarFocusOverlay();
            this.starFocusOverlayKey = null;
            this.renderer.domElement.setAttribute('tabindex', '0');

            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.12;
            this.controls.screenSpacePanning = true;
            this.controls.minDistance = 120;
            this.controls.maxDistance = 4400;
            this.controls.enablePan = true;
            this.controls.enableZoom = true;
            this.controls.enableRotate = true;
            this.controls.rotateSpeed = 0.35;
            this.controls.zoomSpeed = 0.65;
            this.controls.panSpeed = 0.8;
            this.controls.target.copy(this.cameraTarget);
            this.controls.addEventListener('start', () => {
                this._cancelTween();
                if (this.currentSelection?.star) {
                    this._hideStarFocusOverlay();
                }
            });
            this.controls.addEventListener('change', () => this.render());

            this.raycaster = new THREE.Raycaster();
            this.pointer = new THREE.Vector2();

            this.rootGroup = new THREE.Group();
            this.scene.add(this.rootGroup);

            this._createStarfield();

            this.galaxyMap = new Map();
            this.constellationMap = new Map();
            this.starSystemMap = new Map();
            this.starMeshMap = new Map();
            this.pickableObjects = [];

            this.hoveredObject = null;
            this.activeHighlight = null;
            this.tweenState = null;
            this.pointerDownInfo = null;
            this.activeTouchPointers = new Set();

            this.currentView = 'galaxies';
            this.currentSelection = { galaxy: null, constellation: null, starSystem: null, star: null };

            this.needsUniverseBuild = false;

            this._setupLights();
            const initialSkillTree = this.getSkillTree() || {};
            if (Object.keys(initialSkillTree).length) {
                this._buildUniverse();
            } else {
                this.needsUniverseBuild = true;
            }
            this._bindEvents();
            this._updateViewUI();
            this._animate = this._animate.bind(this);
            this._animate();
        }

        rebuildUniverse() {
            this._buildUniverse();
            this.refreshStars();
        }

        refreshStars() {
            const skillTree = this.getSkillTree() || {};
            this.starMeshMap.forEach((mesh, key) => {
                const parts = key.split('|');
                if (parts.length !== 3) {
                    return;
                }
                const [galaxyName, constellationName, starName] = parts;
                const constellationData = skillTree?.[galaxyName]?.constellations?.[constellationName];
                const starInfo = findStarInConstellation(constellationData, starName, constellationName);
                const starData = starInfo?.starData;
                const status = this.resolveStarStatus(
                    starName,
                    starData,
                    galaxyName,
                    constellationName,
                    starInfo?.starSystemName
                ) || 'locked';
                mesh.userData.status = status;
                mesh.userData.data = starData;
                if (starInfo && Object.prototype.hasOwnProperty.call(starInfo, 'starSystemName')) {
                    mesh.userData.starSystem = starInfo.starSystemName || null;
                }
                this._applyStarMaterial(mesh, status);
                if (this.starFocusOverlayKey === key) {
                    this._updateStarFocusOverlay(mesh.userData);
                }
            });
            this.render();
        }

        prepareStarData() {
            this.refreshStars();
        }

        handleResize() {
            const { width, height } = this._getContainerSize();
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height, false);
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            this.render();
        }

        onModalOpened() {
            this.handleResize();
            this.renderer.domElement.focus({ preventScroll: true });
            this.render();
        }

        navigateToPath(path) {
            if (!path || !path.galaxy) {
                return false;
            }

            const galaxyInfo = this.galaxyMap.get(path.galaxy);
            if (!galaxyInfo) {
                return false;
            }

            const type = path.type || 'galaxy';
            const focusCoordinates = path.focusCoordinates || {};

            if (type === 'galaxy') {
                this._focusGalaxy(path.galaxy, focusCoordinates.galaxy);
                return true;
            }

            const constellationKey = `${path.galaxy}|${path.constellation}`;
            if (type === 'constellation') {
                if (!this.constellationMap.has(constellationKey)) {
                    return false;
                }
                this._focusConstellation(path.galaxy, path.constellation, focusCoordinates.constellation);
                return true;
            }

            if (type === 'starSystem') {
                if (!path.starSystem) {
                    return false;
                }
                const systemKey = `${path.galaxy}|${path.constellation}|${path.starSystem}`;
                if (!this.starSystemMap.has(systemKey)) {
                    return false;
                }
                this._focusStarSystem(path.galaxy, path.constellation, path.starSystem, focusCoordinates.starSystem);
                return true;
            }

            if (type === 'star') {
                const starKey = `${path.galaxy}|${path.constellation}|${path.star}`;
                const starMesh = this.starMeshMap.get(starKey);
                if (!starMesh) {
                    return false;
                }
                this._focusStar(path.galaxy, path.constellation, path.star, focusCoordinates.star);
                return true;
            }

            return false;
        }

        goBack() {
            const { galaxy, constellation, starSystem, star } = this.currentSelection;
            if (this.currentView === 'stars') {
                if (star && starSystem) {
                    this._focusStarSystem(galaxy, constellation, starSystem);
                } else if (starSystem) {
                    this._focusConstellation(galaxy, constellation);
                } else if (constellation) {
                    this._focusGalaxy(galaxy);
                } else {
                    this._focusUniverse();
                }
            } else if (this.currentView === 'starSystems') {
                if (galaxy) {
                    this._focusGalaxy(galaxy);
                } else {
                    this._focusUniverse();
                }
            } else if (this.currentView === 'constellations') {
                this._focusUniverse();
            } else {
                this._focusUniverse();
            }
        }

        adjustConstellationOffset(delta) {
            if (!this.currentSelection.galaxy) {
                return;
            }
            const galaxyInfo = this.galaxyMap.get(this.currentSelection.galaxy);
            if (!galaxyInfo || !galaxyInfo.orbitGroup) {
                return;
            }
            const rotationDelta = (typeof delta === 'number' ? delta : 0) * 0.0025;
            galaxyInfo.orbitGroup.rotation.y += rotationDelta;
            this.render();
        }

        render() {
            this.renderer.render(this.scene, this.camera);
        }

        destroy() {
            cancelAnimationFrame(this._animationFrame);
            if (this.starfield) {
                this.scene.remove(this.starfield);
                if (this.starfield.geometry) {
                    this.starfield.geometry.dispose();
                }
                if (this.starfield.material) {
                    this.starfield.material.dispose();
                }
                this.starfield = null;
            }
            this.controls.dispose();
            this.renderer.dispose();
            this.container.innerHTML = '';
            this.pickableObjects.length = 0;
            this.galaxyMap.clear();
            this.constellationMap.clear();
            this.starMeshMap.clear();
        }

        _createStarfield() {
            if (this.starfield) {
                this.scene.remove(this.starfield);
                if (this.starfield.geometry) {
                    this.starfield.geometry.dispose();
                }
                if (this.starfield.material) {
                    this.starfield.material.dispose();
                }
                this.starfield = null;
            }

            const count = STARFIELD_CONFIG.count;
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            const baseColor = new THREE.Color(0xffffff);

            for (let i = 0; i < count; i += 1) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(Math.max(-1, Math.min(1, (Math.random() * 2) - 1)));
                const radius = Math.pow(Math.random(), 0.42) * STARFIELD_CONFIG.radius;
                const sinPhi = Math.sin(phi);
                const x = sinPhi * Math.cos(theta) * radius;
                const z = sinPhi * Math.sin(theta) * radius;
                const y = Math.cos(phi) * STARFIELD_CONFIG.radius * 0.35 + (Math.random() - 0.5) * STARFIELD_CONFIG.radius * 0.25;

                const offset = i * 3;
                positions[offset] = x;
                positions[offset + 1] = y;
                positions[offset + 2] = z;

                const twinkle = 0.6 + Math.random() * 0.4;
                colors[offset] = baseColor.r * twinkle;
                colors[offset + 1] = baseColor.g * twinkle;
                colors[offset + 2] = baseColor.b * twinkle;
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const material = new THREE.PointsMaterial({
                size: STARFIELD_CONFIG.size,
                sizeAttenuation: true,
                transparent: true,
                opacity: STARFIELD_CONFIG.opacity,
                depthWrite: false,
                vertexColors: true
            });

            const starfield = new THREE.Points(geometry, material);
            starfield.renderOrder = -1;
            this.scene.add(starfield);
            this.starfield = starfield;
        }

        _setupLights() {
            const ambient = new THREE.AmbientLight(0x6e7fff, 0.4);
            this.scene.add(ambient);

            const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
            keyLight.position.set(420, 520, 260);
            this.scene.add(keyLight);

            const rimLight = new THREE.PointLight(0x2e5fff, 0.55, 2600);
            rimLight.position.set(-620, -260, -480);
            this.scene.add(rimLight);

            const fillLight = new THREE.PointLight(0xff7eb6, 0.35, 1800);
            fillLight.position.set(320, -160, -620);
            this.scene.add(fillLight);
        }

        _buildUniverse() {
            this._clearUniverse();
            const skillTree = this.getSkillTree() || {};
            const galaxyNames = Object.keys(skillTree);
            if (!galaxyNames.length) {
                this.needsUniverseBuild = true;
                return;
            }

            this.needsUniverseBuild = false;

            galaxyNames.forEach((galaxyName, index) => {
                const galaxyData = skillTree[galaxyName] || {};
                const fallbackGalaxyPosition = createRadialPosition(
                    index,
                    galaxyNames.length,
                    GALAXY_RADIUS,
                    0
                );
                const galaxyPosition = toVector3(galaxyData.position, fallbackGalaxyPosition);
                const galaxyColor = resolveEntityColor(galaxyData, 0x6c5ce7);
                const galaxyEmissive = resolveColor(galaxyData?.appearance?.emissive, 0x241563);
                const haloColor = resolveColor(galaxyData?.appearance?.halo, 0x8069ff);

                const constellations = galaxyData.constellations || {};
                const constellationNames = Object.keys(constellations);

                const group = new THREE.Group();
                group.name = `galaxy-${galaxyName}`;
                group.position.set(galaxyPosition.x, galaxyPosition.y, galaxyPosition.z);

                const configuredRadius = Number.isFinite(galaxyData?.appearance?.areaRadius)
                    ? galaxyData.appearance.areaRadius
                    : null;
                const baseAreaRadius = CONSTELLATION_RADIUS * 1.45;
                const dynamicRadius = baseAreaRadius * Math.sqrt(Math.max(1, constellationNames.length / 6));
                const areaRadius = configuredRadius && configuredRadius > 0 ? configuredRadius : dynamicRadius;

                const semiMajor = Math.max(areaRadius * 1.3, CONSTELLATION_RADIUS * 1.65);
                const semiMinor = Math.max(areaRadius * 0.92, CONSTELLATION_RADIUS * 1.35);

                const galaxyTexture = createGalaxyTexture(galaxyColor, galaxyEmissive);
                const areaMesh = new THREE.Mesh(
                    new THREE.PlaneGeometry(1, 1, 128, 128),
                    new THREE.MeshBasicMaterial({
                        map: galaxyTexture,
                        transparent: true,
                        opacity: 0.95,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        side: THREE.DoubleSide
                    })
                );
                areaMesh.scale.set(semiMajor * 2, semiMinor * 2, 1);
                areaMesh.rotation.x = -Math.PI / 2;
                areaMesh.position.y = -4;
                areaMesh.userData = { type: 'galaxy', galaxy: galaxyName };
                areaMesh.userData.originalScale = areaMesh.scale.clone();
                group.add(areaMesh);
                this.pickableObjects.push(areaMesh);

                const halo = new THREE.Mesh(
                    new THREE.PlaneGeometry(1, 1, 8, 8),
                    new THREE.MeshBasicMaterial({
                        color: haloColor,
                        transparent: true,
                        opacity: 0.18,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        side: THREE.DoubleSide
                    })
                );
                halo.scale.set(semiMajor * 2.8, semiMinor * 2.4, 1);
                halo.rotation.x = -Math.PI / 2;
                halo.position.y = -6;
                halo.renderOrder = -1;
                group.add(halo);

                const rimGeometry = RingGeometryClass
                    ? new RingGeometryClass(0.78, 1.02, 128)
                    : new THREE.PlaneGeometry(1, 1, 8, 8);

                const rim = new THREE.Mesh(
                    rimGeometry,
                    new THREE.MeshBasicMaterial({
                        color: haloColor,
                        transparent: true,
                        opacity: 0.32,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false,
                        side: THREE.DoubleSide
                    })
                );
                rim.scale.set(semiMajor, semiMinor, 1);
                rim.rotation.x = -Math.PI / 2;
                rim.position.y = -5;
                rim.renderOrder = 0;
                group.add(rim);

                const labelHeight = Math.max(72, semiMinor * 0.22 + 52);
                const labelOffset = Math.max(semiMajor * 0.78, CONSTELLATION_RADIUS * 1.1);
                const label = createLabelSprite(galaxyName, { scale: 1.0 });
                label.position.set(0, labelHeight, labelOffset);
                label.userData = Object.assign({}, label.userData || {}, {
                    offsetDistance: labelOffset,
                    height: labelHeight
                });
                group.add(label);

                const orbitGroup = new THREE.Group();
                orbitGroup.name = `constellations-${galaxyName}`;
                orbitGroup.position.y = 6;
                group.add(orbitGroup);

                this.rootGroup.add(group);

                const galaxyInfo = {
                    group,
                    mesh: areaMesh,
                    orbitGroup,
                    areaRadius,
                    constellationNames,
                    label,
                    labelOffset,
                    ellipse: { semiMajor, semiMinor }
                };

                constellationNames.forEach((constellationName, cIndex) => {
                    const constellationData = constellations[constellationName] || {};
                    const fallbackConstellationPosition = createRadialPosition(
                        cIndex,
                        constellationNames.length,
                        CONSTELLATION_RADIUS,
                        14
                    );
                    const constellationPosition = toVector3(constellationData.position, fallbackConstellationPosition);
                    const constellationColor = resolveEntityColor(constellationData, 0x45aaf2);
                    const constellationEmissive = resolveColor(constellationData?.appearance?.emissive, 0x0f3054);

                    const cGroup = new THREE.Group();
                    cGroup.name = `constellation-${constellationName}`;
                    cGroup.position.set(
                        constellationPosition.x,
                        constellationPosition.y,
                        constellationPosition.z
                    );

                    const cMesh = new THREE.Mesh(
                        new THREE.IcosahedronGeometry(14, 1),
                        new THREE.MeshStandardMaterial({
                            color: constellationColor,
                            emissive: constellationEmissive,
                            emissiveIntensity: 0.6,
                            transparent: true,
                            opacity: 0.95,
                            roughness: 0.35
                        })
                    );
                    cMesh.userData = {
                        type: 'constellation',
                        galaxy: galaxyName,
                        constellation: constellationName
                    };
                    cMesh.userData.originalScale = cMesh.scale.clone();
                    cGroup.add(cMesh);
                    this.pickableObjects.push(cMesh);

                    const cLabel = createLabelSprite(constellationName, { scale: 0.55 });
                    cLabel.position.set(0, 30, 0);
                    cGroup.add(cLabel);

                    const starOrbit = new THREE.Group();
                    starOrbit.name = `star-orbit-${constellationName}`;
                    cGroup.add(starOrbit);

                    orbitGroup.add(cGroup);

                    const starSystems = getConstellationStarSystems(constellationData, constellationName);
                    const starSystemEntries = Object.entries(starSystems);
                    let systemGroups = [];

                    if (starSystemEntries.length > 0) {
                        systemGroups = starSystemEntries.map(([systemName, systemData]) => ({
                            systemName,
                            systemData: systemData && typeof systemData === 'object' ? systemData : {},
                            stars: Object.entries(systemData && typeof systemData.stars === 'object' ? systemData.stars : {}).map(
                                ([starName, starData]) => ({ starName, starData: starData || {} })
                            )
                        }));
                    } else {
                        const legacyStars = Object.entries(constellationData.stars || {});
                        systemGroups = legacyStars.map(([starName, starData]) => ({
                            systemName: starName,
                            systemData: null,
                            stars: [{ starName, starData: starData || {} }]
                        }));
                    }

                    const validSystemGroups = systemGroups.filter(group => Array.isArray(group.stars) && group.stars.length > 0);
                    if (!validSystemGroups.length) {
                        return;
                    }

                    validSystemGroups.forEach((systemInfo, sIndex) => {
                        const { systemName, systemData, stars } = systemInfo;
                        const fallbackSystemPosition = createRadialPosition(
                            sIndex,
                            validSystemGroups.length,
                            STAR_SYSTEM_RADIUS,
                            12
                        );
                        const systemPosition = toVector3(systemData?.position, fallbackSystemPosition);
                        const systemColor = resolveEntityColor(systemData, constellationColor);
                        const orbitColor = resolveColor(systemData?.appearance?.orbit, systemColor);

                        const systemGroup = new THREE.Group();
                        const systemLabelName = systemName || `system-${sIndex}`;
                        const systemIdentifier = typeof systemName === 'string' && systemName ? systemName : systemLabelName;
                        systemGroup.name = `system-${constellationName}-${systemLabelName}`;
                        systemGroup.position.set(
                            systemPosition.x,
                            systemPosition.y,
                            systemPosition.z
                        );

                        const orbit = new THREE.Mesh(
                            new THREE.RingGeometry(10, 11.2, 32),
                            new THREE.MeshBasicMaterial({
                                color: orbitColor,
                                transparent: true,
                                opacity: 0.2,
                                side: THREE.DoubleSide
                            })
                        );
                        orbit.rotation.x = Math.PI / 2;
                        systemGroup.add(orbit);

                        systemGroup.userData = {
                            type: 'starSystem',
                            galaxy: galaxyName,
                            constellation: constellationName,
                            starSystem: systemIdentifier
                        };
                        systemGroup.userData.originalScale = systemGroup.scale.clone();

                        orbit.userData = {
                            type: 'starSystem',
                            galaxy: galaxyName,
                            constellation: constellationName,
                            starSystem: systemIdentifier
                        };
                        orbit.userData.originalScale = orbit.scale.clone();
                        this.pickableObjects.push(orbit);

                        const starSystemKey = `${galaxyName}|${constellationName}|${systemIdentifier}`;
                        this.starSystemMap.set(starSystemKey, {
                            group: systemGroup,
                            orbit,
                            systemName: systemIdentifier,
                            data: systemData
                        });

                        const totalStars = Math.max(stars.length, 1);
                        stars.forEach(({ starName, starData }, starIndex) => {
                            const fallbackStarPosition = createRadialPosition(
                                starIndex,
                                totalStars,
                                STAR_ORBIT_RADIUS,
                                6
                            );
                            const starPosition = toVector3(starData?.position, fallbackStarPosition);

                            const starMesh = new THREE.Mesh(
                                new THREE.SphereGeometry(6, 24, 24),
                                new THREE.MeshStandardMaterial({
                                    color: 0xffffff,
                                    emissive: 0x111111,
                                    emissiveIntensity: 0.4,
                                    roughness: 0.25,
                                    metalness: 0.2
                                })
                            );
                            starMesh.position.set(starPosition.x, starPosition.y, starPosition.z);
                            const status = this.resolveStarStatus(
                                starName,
                                starData,
                                galaxyName,
                                constellationName,
                                systemName
                            ) || 'locked';
                            starMesh.userData = {
                                type: 'star',
                                galaxy: galaxyName,
                                constellation: constellationName,
                                star: starName,
                                starSystem: systemIdentifier || null,
                                data: starData,
                                status
                            };
                            starMesh.userData.originalScale = starMesh.scale.clone();
                            this._applyStarMaterial(starMesh, status);
                            systemGroup.add(starMesh);
                            this.pickableObjects.push(starMesh);

                            const starLabel = createLabelSprite(starName, { scale: 0.4 });
                            starLabel.position.set(starPosition.x, starPosition.y + 18, starPosition.z);
                            systemGroup.add(starLabel);

                            const starKey = `${galaxyName}|${constellationName}|${starName}`;
                            this.starMeshMap.set(starKey, starMesh);
                        });

                        if (systemName && stars.length > 1) {
                            const systemLabel = createLabelSprite(systemName, { scale: 0.35 });
                            systemLabel.position.set(0, 26, 0);
                            systemGroup.add(systemLabel);
                        }

                        starOrbit.add(systemGroup);
                    });

                    const constellationKey = `${galaxyName}|${constellationName}`;
                    this.constellationMap.set(constellationKey, {
                        group: cGroup,
                        mesh: cMesh,
                        starOrbit
                    });
                });

                this.galaxyMap.set(galaxyName, galaxyInfo);
            });

            this._updateGalaxyLabels();
        }

        _clearUniverse() {
            this._hideStarFocusOverlay();
            while (this.rootGroup.children.length) {
                const child = this.rootGroup.children.pop();
                this.rootGroup.remove(child);
            }
            this.pickableObjects = [];
            this.galaxyMap.clear();
            this.constellationMap.clear();
            this.starSystemMap.clear();
            this.starMeshMap.clear();
        }

        _resolveFocusVector(focusOverride, fallbackVector) {
            const fallback = fallbackVector ? fallbackVector.clone() : new THREE.Vector3();
            if (!focusOverride || typeof focusOverride !== 'object') {
                return fallback;
            }
            const toNumber = (value, alt) => (Number.isFinite(value) ? value : alt);
            const x = toNumber(focusOverride.x, fallback.x);
            const y = toNumber(focusOverride.y, fallback.y);
            const z = toNumber(focusOverride.z, fallback.z);
            return new THREE.Vector3(x, y, z);
        }

        _updateGalaxyLabels() {
            if (!this.galaxyMap || !this.galaxyMap.size) {
                return;
            }

            const cameraPosition = this.camera.position;
            const worldCenter = new THREE.Vector3();
            const directionToCamera = new THREE.Vector3();
            const labelWorld = new THREE.Vector3();
            const labelLocal = new THREE.Vector3();

            this.galaxyMap.forEach((info) => {
                if (!info || !info.group || !info.label) {
                    return;
                }

                const label = info.label;
                const baseOffset = Number.isFinite(label.userData?.offsetDistance)
                    ? label.userData.offsetDistance
                    : Math.max(info.areaRadius || CONSTELLATION_RADIUS, CONSTELLATION_RADIUS);
                const height = Number.isFinite(label.userData?.height)
                    ? label.userData.height
                    : 80;

                info.group.getWorldPosition(worldCenter);
                directionToCamera.copy(cameraPosition).sub(worldCenter);
                const distance = directionToCamera.length();
                if (distance <= 1e-3) {
                    label.position.set(0, height, 0);
                    return;
                }

                directionToCamera.normalize();
                const desiredOffset = Math.max(48, baseOffset);
                const maxOffset = Math.max(24, distance - 60);
                const cappedOffset = Math.min(desiredOffset, maxOffset);
                const effectiveOffset = Math.min(cappedOffset, Math.max(12, distance * 0.85));

                labelWorld.copy(worldCenter).add(directionToCamera.multiplyScalar(effectiveOffset));
                labelWorld.y = worldCenter.y + height;
                labelLocal.copy(labelWorld).sub(worldCenter);
                const { scale } = info.group;
                if (scale && typeof scale === 'object') {
                    const safeAxis = (axis) => (Number.isFinite(axis) && axis !== 0 ? axis : 1);
                    const scaleX = safeAxis(scale.x);
                    const scaleY = safeAxis(scale.y);
                    const scaleZ = safeAxis(scale.z);
                    labelLocal.set(
                        labelLocal.x / scaleX,
                        labelLocal.y / scaleY,
                        labelLocal.z / scaleZ
                    );
                }
                label.position.copy(labelLocal);
            });
        }

        _maybeAutoAdjustView() {
            if (this.tweenState) {
                return;
            }

            const { galaxy, constellation, starSystem, star } = this.currentSelection;
            if (!galaxy) {
                return;
            }

            const distance = this.camera.position.distanceTo(this.controls.target);

            if (this.currentView === 'stars') {
                if (star && distance > CAMERA_THRESHOLDS.starToSystem) {
                    if (starSystem) {
                        this._focusStarSystem(galaxy, constellation, starSystem);
                    } else if (constellation) {
                        this._focusConstellation(galaxy, constellation);
                    } else {
                        this._focusGalaxy(galaxy);
                    }
                    return;
                }

                if (!star && starSystem && distance > CAMERA_THRESHOLDS.systemToConstellation) {
                    if (galaxy) {
                        this._focusGalaxy(galaxy);
                    } else {
                        this._focusUniverse();
                    }
                    return;
                }

                if (!star && !starSystem && distance > CAMERA_THRESHOLDS.constellationToGalaxy) {
                    if (galaxy) {
                        this._focusGalaxy(galaxy);
                    } else {
                        this._focusUniverse();
                    }
                    return;
                }
            } else if (this.currentView === 'starSystems') {
                if (distance > CAMERA_THRESHOLDS.systemToConstellation) {
                    if (galaxy) {
                        this._focusGalaxy(galaxy);
                    } else {
                        this._focusUniverse();
                    }
                    return;
                }
            } else if (this.currentView === 'constellations') {
                if (distance > CAMERA_THRESHOLDS.constellationToGalaxy) {
                    this._focusUniverse();
                }
            }
        }

        _applyStarMaterial(mesh, status) {
            const material = mesh.material;
            const color = STATUS_COLORS[status] || STATUS_COLORS.locked;
            material.color.setHex(color);
            if (status === 'unlocked') {
                material.emissive.setHex(color);
                material.emissiveIntensity = 0.65;
            } else if (status === 'available') {
                material.emissive.setHex(color);
                material.emissiveIntensity = 0.35;
            } else {
                material.emissive.setHex(0x111111);
                material.emissiveIntensity = 0.3;
            }
        }

        _createStarFocusOverlay() {
            const overlay = document.createElement('div');
            overlay.className = 'star-focus-overlay';
            overlay.setAttribute('aria-hidden', 'true');
            overlay.setAttribute('aria-live', 'polite');

            const titleEl = document.createElement('div');
            titleEl.className = 'star-focus-title';
            titleEl.setAttribute('role', 'heading');
            titleEl.setAttribute('aria-level', '3');
            overlay.appendChild(titleEl);

            const footer = document.createElement('div');
            footer.className = 'star-focus-footer';

            const statusEl = document.createElement('div');
            statusEl.className = 'star-focus-status';
            footer.appendChild(statusEl);

            const locationEl = document.createElement('div');
            locationEl.className = 'star-focus-location';
            footer.appendChild(locationEl);

            const descriptionEl = document.createElement('div');
            descriptionEl.className = 'star-focus-description';
            footer.appendChild(descriptionEl);

            overlay.appendChild(footer);
            this.container.appendChild(overlay);

            return {
                container: overlay,
                titleEl,
                statusEl,
                locationEl,
                descriptionEl
            };
        }

        _updateStarFocusOverlay(userData) {
            if (!this.starFocusOverlay || !userData) {
                return;
            }

            const { container, titleEl, statusEl, locationEl, descriptionEl } = this.starFocusOverlay;
            const starName = typeof userData.star === 'string' && userData.star.trim()
                ? userData.star.trim()
                : 'Unknown Star';
            titleEl.textContent = starName;

            const statusKey = typeof userData.status === 'string' ? userData.status : 'locked';
            const statusLabel = STAR_STATUS_LABELS[statusKey] || STAR_STATUS_LABELS.locked;
            const unlockLabel = formatUnlockTypeLabel(userData.data?.unlock_type);
            statusEl.textContent = unlockLabel ? `${statusLabel} • ${unlockLabel}` : statusLabel;

            const locationLabel = buildStarLocationLabel(userData);
            locationEl.textContent = locationLabel;

            const description = typeof userData.data?.description === 'string'
                ? userData.data.description.trim()
                : '';
            descriptionEl.textContent = description || 'No description provided yet.';

            container.dataset.status = statusKey;
        }

        _showStarFocusOverlay(userData, starKey) {
            if (!this.starFocusOverlay || !userData) {
                this._hideStarFocusOverlay();
                return;
            }

            if (typeof starKey === 'string') {
                this.starFocusOverlayKey = starKey;
            } else {
                this.starFocusOverlayKey = null;
            }

            this._updateStarFocusOverlay(userData);

            const { container } = this.starFocusOverlay;
            container.classList.add('is-visible');
            container.setAttribute('aria-hidden', 'false');
        }

        _hideStarFocusOverlay() {
            if (!this.starFocusOverlay) {
                return;
            }
            this.starFocusOverlayKey = null;
            const { container } = this.starFocusOverlay;
            container.classList.remove('is-visible');
            container.setAttribute('aria-hidden', 'true');
            delete container.dataset.status;
        }

        _focusUniverse() {
            this._hideStarFocusOverlay();
            this.currentView = 'galaxies';
            this.currentSelection = { galaxy: null, constellation: null, starSystem: null, star: null };
            this._setHighlight(null, null);
            this._tweenCameraTo(new THREE.Vector3(0, 0, 0), CAMERA_LEVELS.galaxies);
            this._updateViewUI();
        }

        _focusGalaxy(galaxyName, focusOverride) {
            this._hideStarFocusOverlay();
            const galaxyInfo = this.galaxyMap.get(galaxyName);
            if (!galaxyInfo) {
                return;
            }
            this.currentView = 'constellations';
            this.currentSelection = { galaxy: galaxyName, constellation: null, starSystem: null, star: null };
            this._setHighlight(galaxyInfo.mesh, 'galaxy');
            const fallback = this._getWorldPosition(galaxyInfo.group);
            const target = this._resolveFocusVector(focusOverride, fallback);
            this._tweenCameraTo(target, CAMERA_LEVELS.constellations);
            this._updateViewUI();
        }

        _focusConstellation(galaxyName, constellationName, focusOverride) {
            this._hideStarFocusOverlay();
            const constellationInfo = this.constellationMap.get(`${galaxyName}|${constellationName}`);
            if (!constellationInfo) {
                this._focusGalaxy(galaxyName);
                return;
            }
            this.currentView = 'starSystems';
            this.currentSelection = { galaxy: galaxyName, constellation: constellationName, starSystem: null, star: null };
            this._setHighlight(constellationInfo.mesh, 'constellation');
            const fallback = this._getWorldPosition(constellationInfo.group);
            const target = this._resolveFocusVector(focusOverride, fallback);
            this._tweenCameraTo(target, CAMERA_LEVELS.starSystems);
            this._updateViewUI();
        }

        _focusStarSystem(galaxyName, constellationName, starSystemName, focusOverride) {
            this._hideStarFocusOverlay();
            const systemKey = `${galaxyName}|${constellationName}|${starSystemName}`;
            const systemInfo = this.starSystemMap.get(systemKey);
            if (!systemInfo) {
                this._focusConstellation(galaxyName, constellationName);
                return;
            }
            this.currentView = 'stars';
            this.currentSelection = { galaxy: galaxyName, constellation: constellationName, starSystem: starSystemName, star: null };
            this._setHighlight(systemInfo.group, 'starSystem');
            const fallback = this._getWorldPosition(systemInfo.group);
            const target = this._resolveFocusVector(focusOverride, fallback);
            this._tweenCameraTo(target, CAMERA_LEVELS.starSystems);
            this._updateViewUI();
        }

        _focusStar(galaxyName, constellationName, starName, focusOverride) {
            const starMesh = this.starMeshMap.get(`${galaxyName}|${constellationName}|${starName}`);
            if (!starMesh) {
                this._focusConstellation(galaxyName, constellationName);
                return;
            }
            this.currentView = 'stars';
            let starSystemName = starMesh.userData?.starSystem || null;
            if (!starSystemName) {
                const skillTree = this.getSkillTree();
                const constellationData = skillTree?.[galaxyName]?.constellations?.[constellationName];
                const starInfo = findStarInConstellation(constellationData, starName, constellationName);
                if (starInfo && starInfo.starSystemName) {
                    starSystemName = starInfo.starSystemName;
                }
            }
            this.currentSelection = { galaxy: galaxyName, constellation: constellationName, starSystem: starSystemName || null, star: starName };
            this._setHighlight(starMesh, 'star');
            const fallback = this._getWorldPosition(starMesh);
            const target = this._resolveFocusVector(focusOverride, fallback);
            this._tweenCameraTo(target, CAMERA_LEVELS.stars);
            const starKey = `${galaxyName}|${constellationName}|${starName}`;
            this._showStarFocusOverlay(starMesh.userData, starKey);
            this._updateViewUI();
        }

        clearStarFocus() {
            if (!this.currentSelection.star) {
                this._hideStarFocusOverlay();
                return;
            }

            const { galaxy, constellation, starSystem } = this.currentSelection;
            if (!galaxy || !constellation) {
                this._hideStarFocusOverlay();
                this._focusUniverse();
                return;
            }

            if (starSystem) {
                this._focusStarSystem(galaxy, constellation, starSystem);
            } else {
                this._focusConstellation(galaxy, constellation);
            }
        }

        _getWorldPosition(object3D) {
            return object3D.getWorldPosition(new THREE.Vector3());
        }

        _setHighlight(object, type) {
            if (this.activeHighlight && this.activeHighlight.object) {
                const prev = this.activeHighlight.object;
                if (prev.userData) {
                    delete prev.userData.highlightMultiplier;
                }
                this._applyScaledSize(prev, 1);
            }

            if (!object) {
                this.activeHighlight = null;
                return;
            }

            const scaleMultiplier = type === 'star'
                ? 2.2
                : type === 'starSystem'
                    ? 1.35
                    : type === 'constellation'
                        ? 1.25
                        : 1.2;
            if (!object.userData) {
                object.userData = {};
            }
            object.userData.highlightMultiplier = scaleMultiplier;
            this._applyScaledSize(object, scaleMultiplier);

            this.activeHighlight = { object, type };
        }

        _applyScaledSize(object, multiplier = 1) {
            if (object && object.userData && object.userData.originalScale) {
                const newScale = object.userData.originalScale.clone().multiplyScalar(multiplier);
                object.scale.copy(newScale);
            }
        }

        _bindEvents() {
            const domElement = this.renderer.domElement;
            domElement.addEventListener('pointermove', (event) => this._onPointerMove(event));
            domElement.addEventListener('pointerdown', (event) => this._onPointerDown(event));
            domElement.addEventListener('pointerup', (event) => this._onPointerUp(event));
            domElement.addEventListener('pointercancel', (event) => this._onPointerCancel(event));
            domElement.addEventListener('click', (event) => this._onClick(event));
        }

        _onPointerDown(event) {
            if (event.pointerType === 'touch') {
                this.activeTouchPointers.add(event.pointerId);
                if (this.activeTouchPointers.size > 1) {
                    this.pointerDownInfo = null;
                    return;
                }
            } else {
                this.activeTouchPointers.clear();
            }
            this.pointerDownInfo = {
                x: event.clientX,
                y: event.clientY,
                time: performance.now(),
                pointerId: event.pointerId,
                pointerType: event.pointerType || 'mouse'
            };
        }

        _onPointerUp(event) {
            if (event.pointerType === 'touch') {
                this.activeTouchPointers.delete(event.pointerId);
            }
            const downInfo = this.pointerDownInfo;
            if (!downInfo || downInfo.pointerId !== event.pointerId) {
                if (!this.activeTouchPointers.size) {
                    this.pointerDownInfo = null;
                }
                return;
            }
            if (event.pointerType === 'touch' && this.activeTouchPointers.size > 0) {
                this.pointerDownInfo = null;
                return;
            }
            const distance = Math.hypot(event.clientX - downInfo.x, event.clientY - downInfo.y);
            const elapsed = performance.now() - downInfo.time;
            if (distance < 6 && elapsed < 400) {
                this._handleSelection(event);
            }
            this.pointerDownInfo = null;
        }

        _onPointerCancel(event) {
            if (event.pointerType === 'touch') {
                this.activeTouchPointers.delete(event.pointerId);
            }
            if (this.pointerDownInfo && this.pointerDownInfo.pointerId === event.pointerId) {
                this.pointerDownInfo = null;
            }
        }

        _onClick(event) {
            // Prevent default click bubbling for navigation when we already handled pointerup
            event.preventDefault();
        }

        _onPointerMove(event) {
            if (event.pointerType === 'touch' && this.activeTouchPointers.size > 1) {
                return;
            }
            const rect = this.renderer.domElement.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                return;
            }
            this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            this.raycaster.setFromCamera(this.pointer, this.camera);
            const intersects = this.raycaster.intersectObjects(this.pickableObjects, false);
            const first = intersects.length ? this._findSelectable(intersects[0].object) : null;
            this._updateHover(first);
        }

        _findSelectable(object) {
            let current = object;
            while (current) {
                if (current.userData && current.userData.type) {
                    return current;
                }
                current = current.parent;
            }
            return null;
        }

        _updateHover(object) {
            if (this.hoveredObject === object) {
                return;
            }

            if (this.hoveredObject && this.hoveredObject.userData && this.hoveredObject.userData.originalScale) {
                const baseMultiplier = this.hoveredObject.userData.highlightMultiplier || 1;
                this._applyScaledSize(this.hoveredObject, baseMultiplier);
            }

            this.hoveredObject = object;
            if (object && object.userData && object.userData.originalScale) {
                const baseMultiplier = object.userData.highlightMultiplier || 1;
                const isActiveHighlight = this.activeHighlight && this.activeHighlight.object === object;
                const hoverMultiplier = isActiveHighlight
                    ? 1
                    : object.userData.type === 'star'
                        ? 1.35
                        : 1.2;
                this._applyScaledSize(object, hoverMultiplier * baseMultiplier);
                this.container.style.cursor = 'pointer';
                if (this.onHoverStar && object.userData.type === 'star') {
                    const { star, galaxy, constellation, data, status, starSystem } = object.userData;
                    this.onHoverStar({
                        name: star,
                        galaxy,
                        constellation,
                        data,
                        status,
                        starSystem: starSystem || null
                    });
                }
            } else {
                this.container.style.cursor = 'default';
                if (this.onHoverStar) {
                    this.onHoverStar(null);
                }
            }
        }

        _handleSelection(event) {
            const rect = this.renderer.domElement.getBoundingClientRect();
            if (!rect.width || !rect.height) {
                return;
            }
            const pointer = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );
            this.raycaster.setFromCamera(pointer, this.camera);
            const intersects = this.raycaster.intersectObjects(this.pickableObjects, false);
            if (!intersects.length) {
                return;
            }
            const selected = this._findSelectable(intersects[0].object);
            if (!selected || !selected.userData) {
                return;
            }

            const data = selected.userData;
            if (data.type === 'galaxy') {
                this._focusGalaxy(data.galaxy);
            } else if (data.type === 'constellation') {
                this._focusConstellation(data.galaxy, data.constellation);
            } else if (data.type === 'starSystem') {
                if (data.starSystem) {
                    this._focusStarSystem(data.galaxy, data.constellation, data.starSystem);
                } else {
                    this._focusConstellation(data.galaxy, data.constellation);
                }
            } else if (data.type === 'star') {
                this._focusStar(data.galaxy, data.constellation, data.star);
                if (this.onSelectStar) {
                    const starInfo = {
                        name: data.star,
                        galaxy: data.galaxy,
                        constellation: data.constellation,
                        data: data.data,
                        status: data.status,
                        starSystem: data.starSystem || null
                    };
                    this.onSelectStar(starInfo);
                }
            }
        }

        _tweenCameraTo(targetPosition, levelConfig) {
            const config = levelConfig || CAMERA_LEVELS.galaxies;
            const distance = config.distance;
            const height = config.height;
            const duration = config.duration;

            const horizontalTarget = new THREE.Vector3(targetPosition.x, 0, targetPosition.z);
            const horizontalCamera = new THREE.Vector3(this.camera.position.x, 0, this.camera.position.z);
            const offsetDirection = horizontalTarget.sub(horizontalCamera);
            if (!offsetDirection.lengthSq()) {
                offsetDirection.set(0, 0, 1);
            } else {
                offsetDirection.normalize();
            }

            const endPosition = targetPosition.clone();
            endPosition.y += height;
            endPosition.sub(offsetDirection.clone().multiplyScalar(distance));

            const startPosition = this.camera.position.clone();
            const startTarget = this.controls.target.clone();
            const endTarget = targetPosition.clone();

            this.tweenState = {
                startPosition,
                endPosition,
                startTarget,
                endTarget,
                startTime: performance.now(),
                duration
            };

            this.controls.enabled = false;
        }

        _cancelTween() {
            if (this.tweenState) {
                this.tweenState = null;
                this.controls.enabled = true;
            }
        }

        _animate() {
            this._animationFrame = global.requestAnimationFrame(this._animate);

            if (this.tweenState) {
                const now = performance.now();
                const { startTime, duration, startPosition, endPosition, startTarget, endTarget } = this.tweenState;
                const elapsed = now - startTime;
                const t = clamp(elapsed / duration, 0, 1);
                const eased = t * (2 - t); // easeOutQuad
                const cameraPos = lerpVectors(startPosition, endPosition, eased);
                const targetPos = lerpVectors(startTarget, endTarget, eased);
                this.camera.position.copy(cameraPos);
                this.controls.target.copy(targetPos);
                if (t >= 1) {
                    this.tweenState = null;
                    this.controls.enabled = true;
                }
            }

            this.controls.update();
            this._updateGalaxyLabels();
            this._maybeAutoAdjustView();
            this.render();
        }

        _updateViewUI() {
            if (!this.onViewChange) {
                return;
            }
            const { galaxy, constellation, starSystem, star } = this.currentSelection;
            const breadcrumbs = [{ label: 'Skill Universe' }];

            if (galaxy) {
                breadcrumbs.push({
                    label: galaxy,
                    path: { type: 'galaxy', galaxy }
                });
            }

            if (constellation) {
                breadcrumbs.push({
                    label: constellation,
                    path: { type: 'constellation', galaxy, constellation }
                });
            }

            if (starSystem) {
                breadcrumbs.push({
                    label: starSystem,
                    path: { type: 'starSystem', galaxy, constellation, starSystem }
                });
            }

            if (star) {
                breadcrumbs.push({
                    label: star,
                    path: { type: 'star', galaxy, constellation, starSystem, star }
                });
            }

            let title = 'Skill Universe';
            if (star) {
                title = star;
            } else if (starSystem) {
                title = starSystem;
            } else if (constellation) {
                title = constellation;
            } else if (galaxy) {
                title = galaxy;
            }

            let viewName = this.currentView;
            if (viewName === 'stars' && starSystem && !star) {
                viewName = 'starSystems';
            }

            this.onViewChange({
                view: viewName,
                title,
                breadcrumbs,
                showBack: breadcrumbs.length > 1
            });
        }

        _getContainerSize() {
            const rect = this.container.getBoundingClientRect();
            let width = Math.floor(rect.width);
            let height = Math.floor(rect.height);
            if (!width || !height) {
                width = Math.max(this.container.clientWidth, 640);
                height = Math.max(this.container.clientHeight, 480);
            }
            if (!width || !height) {
                width = 640;
                height = 480;
            }
            return { width, height };
        }
    }

    SkillUniverseRenderer.VERSION = '2024.06.10';

    if (typeof console !== 'undefined' && console.info) {
        const lerpExists = !!(THREE && THREE.Color && THREE.Color.prototype && typeof THREE.Color.prototype.lerp === 'function');
        console.info('SkillUniverseRenderer', SkillUniverseRenderer.VERSION, 'Color.lerp available:', lerpExists);
    }

    SkillUniverseRenderer.VERSION = '2024.06.02';
    global.SkillUniverseRenderer = SkillUniverseRenderer;
})(typeof window !== 'undefined' ? window : this);

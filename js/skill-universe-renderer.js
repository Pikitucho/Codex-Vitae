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
        galaxies: { distance: 2350, height: 420, duration: 1600 },
        constellations: { distance: 780, height: 240, duration: 1250 },
        starSystems: { distance: 340, height: 150, duration: 1100 },
        stars: { distance: 130, height: 65, duration: 1200 }
    };

    const GALAXY_LABEL_VISIBILITY = (() => {
        const galaxyViewDistance = Math.sqrt(
            (CAMERA_LEVELS.galaxies.distance ** 2) + (CAMERA_LEVELS.galaxies.height ** 2)
        );
        const constellationViewDistance = Math.sqrt(
            (CAMERA_LEVELS.constellations.distance ** 2) + (CAMERA_LEVELS.constellations.height ** 2)
        );
        const fullyTransparentDistance = Math.max(320, constellationViewDistance * 0.92);
        const minimumSeparation = 240;
        const fullyVisibleDistance = Math.max(
            fullyTransparentDistance + minimumSeparation,
            galaxyViewDistance * 1.08
        );
        return { fullyTransparentDistance, fullyVisibleDistance };
    })();

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
        count: 4200,
        radius: 6400,
        size: 1.35,
        opacity: 0.9
    };

    const LABEL_DEFAULTS = {
        fontSize: 48,
        padding: 18,
        scale: 1.0,
        backgroundColor: 'rgba(10, 10, 20, 0.72)',
        textColor: 'rgba(255, 255, 255, 0.97)',
        borderColor: null,
        borderWidth: 0,
        borderRadius: 12,
        shadowColor: 'rgba(0, 0, 0, 0.55)',
        shadowBlur: 8,
        shadowOffsetX: 0,
        shadowOffsetY: 3
    };

    const GALAXY_TEXTURE_SIZE = 1024;
    const galaxyTextureCache = new Map();
    const StarMixer = global.SkillUniverseStarMixer || null;

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

    function drawRoundedRect(ctx, x, y, width, height, radius) {
        const clampedRadius = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
        ctx.beginPath();
        ctx.moveTo(x + clampedRadius, y);
        ctx.lineTo(x + width - clampedRadius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
        ctx.lineTo(x + width, y + height - clampedRadius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
        ctx.lineTo(x + clampedRadius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
        ctx.lineTo(x, y + clampedRadius);
        ctx.quadraticCurveTo(x, y, x + clampedRadius, y);
        ctx.closePath();
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
        const coreColor = mixColors(baseColor, white, 0.4);
        const highlightColor = mixColors(emissiveColor, white, 0.25);
        const outerColor = mixColors(baseColor, deepSpace, 0.9);

        const gradient = ctx.createRadialGradient(half, half, GALAXY_TEXTURE_SIZE * 0.06, half, half, GALAXY_TEXTURE_SIZE * 0.5);
        gradient.addColorStop(0, colorToRgbaString(coreColor, 0.75));
        gradient.addColorStop(0.32, colorToRgbaString(baseColor, 0.6));
        gradient.addColorStop(0.62, colorToRgbaString(highlightColor, 0.28));
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
            ctx.strokeStyle = colorToRgbaString(highlightColor, 0.12);
            ctx.lineWidth = GALAXY_TEXTURE_SIZE * 0.02;
            ctx.lineCap = 'round';
            ctx.shadowColor = colorToRgbaString(highlightColor, 0.28);
            ctx.shadowBlur = GALAXY_TEXTURE_SIZE * 0.04;
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
            const starSize = Math.pow(Math.random(), 1.8) * 6 + 1.1;
            const alpha = 0.08 + Math.random() * 0.24;
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
        coreGlow.addColorStop(0, colorToRgbaString(white, 0.6));
        coreGlow.addColorStop(0.65, colorToRgbaString(highlightColor, 0.3));
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
        const {
            fontSize,
            padding,
            scale,
            backgroundColor,
            textColor,
            borderColor,
            borderWidth,
            borderRadius,
            shadowColor,
            shadowBlur,
            shadowOffsetX,
            shadowOffsetY
        } = options;
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
        ctx.save();
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = shadowOffsetX;
        ctx.shadowOffsetY = shadowOffsetY;
        drawRoundedRect(ctx, 0, 0, textWidth + padding * 2, textHeight + padding * 2, borderRadius);
        ctx.fillStyle = backgroundColor;
        ctx.fill();
        if (borderWidth > 0 && borderColor) {
            ctx.lineWidth = borderWidth;
            ctx.strokeStyle = borderColor;
            drawRoundedRect(ctx, borderWidth / 2, borderWidth / 2, textWidth + padding * 2 - borderWidth, textHeight + padding * 2 - borderWidth, Math.max(0, borderRadius - borderWidth / 2));
            ctx.stroke();
        }
        ctx.restore();
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillStyle = textColor;
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
        const aspect = canvas.width / canvas.height || 1;
        const baseScale = scale * 22;
        sprite.scale.set(baseScale * aspect, baseScale, 1);
        sprite.userData = Object.assign({}, sprite.userData, {
            baseScale,
            aspectRatio: aspect
        });
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

    function hashToUnit(value) {
        const x = Math.sin(value * 127.1) * 43758.5453123;
        return x - Math.floor(x);
    }

    function createRadialPosition(index, total, radius, verticalAmplitude = 0) {
        const safeTotal = Math.max(total || 0, 1);
        const angle = (index % safeTotal) / safeTotal * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        let y = 0;
        if (verticalAmplitude) {
            const wave = Math.sin(angle * 1.7) * verticalAmplitude * 0.6;
            const scatter = (hashToUnit(index + safeTotal * 0.618) - 0.5) * 2 * verticalAmplitude * 0.4;
            y = wave + scatter;
        }
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
            this.scene.fog = new THREE.FogExp2(0x01040a, 0.00038);
            this.starfieldGroup = null;
            this._farStars = null;
            this._midStars = null;
            this._fogPoints = null;
            this._nebulaPlanes = [];
            this._nebulaTextures = [];
            this._nebulaLayer = null;
            this._spriteStars = null;
            this._spriteStarsMat = null;
            this._lightRig = null;
            this._lightRigLights = [];
            this._environmentTarget = null;
            this._environmentMap = null;
            this._rgbeLoader = null;
            this._debugUIPanel = null;
            this._diagnosticsPanel = null;
            this._diagnosticsFields = null;
            this._diagnosticsInterval = null;
            this._environmentName = null;
            // modern pipeline handles (created only when fx=on)
            this._glRenderer = null;
            this._composer = null;
            this._clock = this._clock || (typeof THREE.Clock === 'function' ? new THREE.Clock() : null); // reuse existing clock if available

            const { width, height } = this._getContainerSize();
            this._width = width;
            this._height = height;
            this.camera = new THREE.PerspectiveCamera(57, width / height, 1, 9000);
            const initialHeight = CAMERA_LEVELS.galaxies.height * 1.12;
            const initialDistance = CAMERA_LEVELS.galaxies.distance + 620;
            this.camera.position.set(0, initialHeight, initialDistance);
            this.cameraTarget = new THREE.Vector3(0, 0, 0);

            if (this.container && typeof this.container.innerHTML !== 'undefined') {
                this.container.innerHTML = '';
            }

            const useModern = !!(global.CVPipeline && global.CVPipeline.enabled);
            if (useModern && global.THREE && global.CVTextures && global.CVPipeline.createComposer) {
                this._glRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
                this._glRenderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
                this._glRenderer.setSize(this._width, this._height, false);
                this._glRenderer.physicallyCorrectLights = true;
                this._glRenderer.outputColorSpace = THREE.SRGBColorSpace;
                this._glRenderer.toneMapping = THREE.ACESFilmicToneMapping;
                this._glRenderer.toneMappingExposure = 1.0;

                const mount = global.document?.getElementById('skill-universe-canvas-container') || this.container || global.document?.body;
                if (mount && typeof mount.appendChild === 'function' && !mount.contains(this._glRenderer.domElement)) {
                    mount.appendChild(this._glRenderer.domElement);
                }

                try {
                    global.CVTextures.init?.(this._glRenderer);
                } catch (initError) {
                    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                        console.warn('SkillUniverseRenderer: CVTextures.init failed:', initError);
                    }
                }

                try {
                    this._composer = global.CVPipeline.createComposer(
                        this._glRenderer,
                        this.scene,
                        this.camera,
                        { bloom: true, grade: true }
                    );
                } catch (composerError) {
                    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                        console.warn('SkillUniverseRenderer: createComposer failed; falling back to legacy renderer.', composerError);
                    }
                    if (this._glRenderer && typeof this._glRenderer.dispose === 'function') {
                        this._glRenderer.dispose();
                    }
                    if (this._glRenderer?.domElement && typeof this._glRenderer.domElement.remove === 'function') {
                        this._glRenderer.domElement.remove();
                    }
                    this._glRenderer = null;
                    this._composer = null;
                }

                if (this._glRenderer && this._composer) {
                    this.renderer = this._glRenderer;

                    const shouldShowDebugPanel =
                        useModern &&
                        typeof global.location?.search === 'string' &&
                        global.location.search.includes('debug') &&
                        global.document &&
                        typeof global.document.createElement === 'function';

                    if (shouldShowDebugPanel) {
                        try {
                            const doc = global.document;
                            const debugPanel = doc.getElementById('cv-debug') || doc.createElement('div');
                            debugPanel.id = 'cv-debug';
                            debugPanel.style.cssText = [
                                'position:fixed',
                                'top:8px',
                                'right:8px',
                                'z-index:9999',
                                'background:rgba(12,16,28,0.88)',
                                'color:#fff',
                                'padding:8px 10px',
                                'min-width:180px',
                                'max-width:220px',
                                'font-family:system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                                'font-size:12px',
                                'line-height:1.4',
                                'border-radius:6px',
                                'box-shadow:0 6px 18px rgba(0,0,0,0.35)',
                                'backdrop-filter:blur(6px)'
                            ].join(';');
                            debugPanel.innerHTML = '';

                            const title = doc.createElement('div');
                            title.textContent = 'FX Debug';
                            title.style.cssText = 'font-weight:600;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.06em;';
                            debugPanel.appendChild(title);

                            const slider = (label, min, max, step, get, set, formatter = (v) => v.toFixed(2)) => {
                                const row = doc.createElement('label');
                                row.style.cssText = 'display:block;margin:6px 0;';

                                const labelSpan = doc.createElement('span');
                                labelSpan.textContent = label;
                                labelSpan.style.cssText = 'display:inline-block;margin-bottom:2px;';
                                row.appendChild(labelSpan);

                                const input = doc.createElement('input');
                                input.type = 'range';
                                input.min = String(min);
                                input.max = String(max);
                                input.step = String(step);
                                const current = get();
                                input.value = Number.isNaN(current) ? String(min) : String(current);
                                input.style.width = '100%';

                                const valueReadout = doc.createElement('div');
                                valueReadout.textContent = formatter(parseFloat(input.value));
                                valueReadout.style.cssText = 'font-size:11px;opacity:0.72;margin-top:2px;text-align:right;';

                                input.addEventListener('input', () => {
                                    const value = parseFloat(input.value);
                                    if (!Number.isNaN(value)) {
                                        set(value);
                                        valueReadout.textContent = formatter(value);
                                    }
                                });

                                row.appendChild(input);
                                row.appendChild(valueReadout);
                                debugPanel.appendChild(row);
                            };

                            slider(
                                'Exposure',
                                0.1,
                                2.5,
                                0.01,
                                () => this._glRenderer.toneMappingExposure,
                                (value) => {
                                    this._glRenderer.toneMappingExposure = value;
                                }
                            );

                            const bloom = this._composer.__bloom;
                            if (bloom) {
                                slider('Bloom Strength', 0.0, 2.0, 0.01, () => bloom.strength, (value) => {
                                    bloom.strength = value;
                                });
                                slider('Bloom Threshold', 0.0, 1.5, 0.01, () => bloom.threshold, (value) => {
                                    bloom.threshold = value;
                                });
                                slider('Bloom Radius', 0.0, 1.5, 0.01, () => bloom.radius, (value) => {
                                    bloom.radius = value;
                                });
                            }

                            const grade = this._composer.__grade;
                            if (grade?.uniforms) {
                                const { uniforms } = grade;
                                const monoVecSlider = (label, key, min, max, step) => {
                                    if (!uniforms[key]?.value) {
                                        return;
                                    }
                                    slider(
                                        label,
                                        min,
                                        max,
                                        step,
                                        () => uniforms[key].value.x ?? 0,
                                        (value) => {
                                            if (typeof uniforms[key].value.set === 'function') {
                                                uniforms[key].value.set(value, value, value);
                                            }
                                        }
                                    );
                                };

                                monoVecSlider('Lift', -0.3, 0.3, 0.005);
                                monoVecSlider('Gamma', 0.5, 2.0, 0.01);
                                monoVecSlider('Gain', 0.5, 1.6, 0.01);

                                if (uniforms.uVignetteStrength) {
                                    slider(
                                        'Vignette',
                                        0.0,
                                        0.6,
                                        0.01,
                                        () => uniforms.uVignetteStrength.value ?? 0,
                                        (value) => {
                                            uniforms.uVignetteStrength.value = value;
                                        }
                                    );
                                }

                                if (uniforms.uCAStrength) {
                                    slider(
                                        'Chromatic Aberration',
                                        0.0,
                                        0.02,
                                        0.0005,
                                        () => uniforms.uCAStrength.value ?? 0,
                                        (value) => {
                                            uniforms.uCAStrength.value = value;
                                        },
                                        (value) => value.toFixed(4)
                                    );
                                }
                            }

                            if (!debugPanel.parentElement) {
                                doc.body.appendChild(debugPanel);
                            }
                            this._debugUIPanel = debugPanel;

                            const diag = doc.getElementById('cv-diag') || doc.createElement('div');
                            diag.id = 'cv-diag';
                            diag.style.cssText = [
                                'position:fixed',
                                'top:8px',
                                'left:8px',
                                'z-index:9998',
                                'background:rgba(6,10,20,0.82)',
                                'color:#d8f1ff',
                                'padding:6px 8px',
                                'font-family:"IBM Plex Mono", SFMono-Regular, Menlo, Monaco, monospace',
                                'font-size:11px',
                                'line-height:1.45',
                                'border-radius:4px',
                                'pointer-events:none',
                                'user-select:none',
                                'box-shadow:0 4px 12px rgba(0,0,0,0.35)',
                                'max-width:220px'
                            ].join(';');
                            diag.innerHTML = '';

                            const createRow = (label, key) => {
                                const row = doc.createElement('div');
                                row.style.cssText = 'display:flex;gap:6px;justify-content:space-between;';
                                const labelSpan = doc.createElement('span');
                                labelSpan.textContent = `${label}:`;
                                labelSpan.style.cssText = 'opacity:0.7;';
                                const valueSpan = doc.createElement('span');
                                valueSpan.dataset.field = key;
                                valueSpan.textContent = '…';
                                row.appendChild(labelSpan);
                                row.appendChild(valueSpan);
                                diag.appendChild(row);
                                return valueSpan;
                            };

                            this._diagnosticsFields = {
                                pipeline: createRow('Pipeline', 'pipeline'),
                                passes: createRow('Composer', 'passes'),
                                tone: createRow('Tone mapping', 'tone'),
                                ibl: createRow('IBL', 'ibl'),
                                nebula: createRow('Nebula planes', 'nebula'),
                                sprites: createRow('Sprite stars', 'sprites'),
                                pbr: createRow('PBR stars', 'pbr')
                            };

                            if (!diag.parentElement) {
                                doc.body.appendChild(diag);
                            }
                            this._diagnosticsPanel = diag;
                            this._updateDiagnostics();
                            if (this._diagnosticsInterval && typeof global.clearInterval === 'function') {
                                global.clearInterval(this._diagnosticsInterval);
                            }
                            if (typeof global.setInterval === 'function') {
                                this._diagnosticsInterval = global.setInterval(() => {
                                    this._updateDiagnostics();
                                }, 1000);
                            }
                        } catch (debugError) {
                            if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                                console.warn('SkillUniverseRenderer: debug panel failed to initialize', debugError);
                            }
                        }
                    }
                } else if (this._glRenderer && !this._composer) {
                    if (typeof this._glRenderer.dispose === 'function') {
                        this._glRenderer.dispose();
                    }
                    if (this._glRenderer.domElement && typeof this._glRenderer.domElement.remove === 'function') {
                        this._glRenderer.domElement.remove();
                    }
                    this._glRenderer = null;
                }
                this._setDefaultEnvironment();
                if (this._glRenderer && this._composer && global.NebulaLayer && typeof global.NebulaLayer === 'function' && this.scene) {
                    try {
                        this._nebulaLayer = new global.NebulaLayer(this.scene, { intensity: 0.7, layers: 3 });
                        const initPromise = this._nebulaLayer.initFromManifest();
                        if (initPromise && typeof initPromise.catch === 'function') {
                            initPromise.catch((nebulaInitError) => {
                                if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                                    console.warn('[SkillUniverse] NebulaLayer manifest load skipped:', nebulaInitError);
                                }
                            });
                        }
                    } catch (nebulaError) {
                        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                            console.warn('[SkillUniverse] NebulaLayer setup skipped:', nebulaError);
                        }
                        if (this._nebulaLayer && typeof this._nebulaLayer.dispose === 'function') {
                            this._nebulaLayer.dispose();
                        }
                        this._nebulaLayer = null;
                    }
                } else {
                    this._disposeNebulaLayer();
                }
                if (this._glRenderer && this._composer) {
                    this._createSpriteStars();
                } else {
                    this._disposeSpriteStars();
                }
            }

            if (!this.renderer) {
                this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                if (typeof this.renderer.physicallyCorrectLights !== 'undefined') {
                    this.renderer.physicallyCorrectLights = true;
                }
                if (typeof this.renderer.toneMapping !== 'undefined' && typeof THREE.ACESFilmicToneMapping !== 'undefined') {
                    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
                }
                if (typeof this.renderer.toneMappingExposure === 'number') {
                    this.renderer.toneMappingExposure = 1.1;
                }
                if (typeof this.renderer.outputColorSpace !== 'undefined' && typeof THREE.SRGBColorSpace !== 'undefined') {
                    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
                } else if (typeof this.renderer.outputEncoding !== 'undefined' && typeof THREE.sRGBEncoding !== 'undefined') {
                    this.renderer.outputEncoding = THREE.sRGBEncoding;
                }
                this.renderer.setSize(width, height, false);
                this.renderer.setPixelRatio(global.devicePixelRatio || 1);
            }

            if (this.renderer?.domElement) {
                this.renderer.domElement.style.width = '100%';
                this.renderer.domElement.style.height = '100%';
                this.renderer.domElement.style.display = 'block';
                this.renderer.domElement.style.touchAction = 'none';
                this.renderer.setClearColor(0x01020a, 1);
                if (this.container && typeof this.container.appendChild === 'function') {
                    this.container.appendChild(this.renderer.domElement);
                }
                if (typeof this.renderer.autoClear === 'boolean') {
                    this.renderer.autoClear = true;
                }
            }
            this.starFocusOverlay = this._createStarFocusOverlay();
            this.starFocusOverlayKey = null;
            this.renderer.domElement.setAttribute('tabindex', '0');

            this.composer = null;
            this.renderPass = null;
            this._bloomPass = null;
            this._colorGradePass = null;
            if (!this._composer) {
                this._initPostProcessing(width, height);
            }
            this._loadEnvironmentMap();

            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.14;
            this.controls.dampingFactor = 0.12;
            this.controls.screenSpacePanning = false;
            this.controls.dampingFactor = 0.1;
            this.controls.screenSpacePanning = true;
            this.controls.minDistance = 120;
            this.controls.maxDistance = 5600;
            this.controls.enablePan = true;
            this.controls.enableZoom = true;
            this.controls.enableRotate = true;
            this.controls.rotateSpeed = 0.32;
            this.controls.zoomSpeed = 0.6;
            this.controls.panSpeed = 0.8;
            if (typeof this.controls.zoomToCursor === 'boolean') {
                this.controls.zoomToCursor = true;
            this.controls.rotateSpeed = 0.35;
            this.controls.zoomSpeed = 0.45;
            this.controls.panSpeed = 0.55;
            if (typeof this.controls.zoomToCursor === 'boolean') {
                this.controls.zoomToCursor = true;
            }
            this.controls.rotateSpeed = 0.42;
            this.controls.zoomSpeed = 0.5;
            this.controls.panSpeed = 0.6;
            if (THREE?.MOUSE) {
                this.controls.mouseButtons = {
                    LEFT: THREE.MOUSE.ROTATE,
                    MIDDLE: THREE.MOUSE.DOLLY,
                    RIGHT: THREE.MOUSE.PAN
                };
            }
            if (THREE?.TOUCH) {
                this.controls.touches = {
                    ONE: THREE.TOUCH.ROTATE,
                    TWO: THREE.TOUCH.DOLLY_PAN
                };
            }
            this.controls.mouseButtons = {
                LEFT: 'ROTATE',
                MIDDLE: 'DOLLY',
                RIGHT: 'PAN'
            };
            this.controls.touches = {
                ONE: 'ROTATE',
                TWO: 'DOLLY_PAN'
            };
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

            if (THREE.Cache && typeof THREE.Cache.enabled !== 'undefined') {
                THREE.Cache.enabled = true;
            }
            if (typeof THREE.TextureLoader === 'function') {
                this._textureLoader = new THREE.TextureLoader();
            } else {
                this._textureLoader = null;
                if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                    console.warn(
                        'SkillUniverseRenderer: TextureLoader is unavailable; star materials will use flat colors.'
                    );
                }
            }
            this._textureCache = new Map();
            this._maxAnisotropy = (this.renderer && this.renderer.capabilities && typeof this.renderer.capabilities.getMaxAnisotropy === 'function')
                ? this.renderer.capabilities.getMaxAnisotropy()
                : 1;

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

        _ensureRGBELoader() {
            if (this._rgbeLoader || typeof THREE.RGBELoader !== 'function') {
                return this._rgbeLoader;
            }
            try {
                this._rgbeLoader = new THREE.RGBELoader();
            } catch (error) {
                console.warn('Unable to instantiate RGBELoader. HDR assets will be skipped.', error);
                this._rgbeLoader = null;
            }
            return this._rgbeLoader;
        }

        _initPostProcessing(width, height) {
            if (!this.renderer || typeof THREE.EffectComposer !== 'function' || typeof THREE.RenderPass !== 'function') {
                this.composer = null;
                this.renderPass = null;
                this._bloomPass = null;
                this._colorGradePass = null;
                return;
            }

            const pixelRatio = this.renderer.getPixelRatio
                ? this.renderer.getPixelRatio()
                : (global.devicePixelRatio || 1);

            this.composer = new THREE.EffectComposer(this.renderer);
            if (typeof this.composer.setPixelRatio === 'function') {
                this.composer.setPixelRatio(pixelRatio);
            }
            if (typeof this.composer.setSize === 'function') {
                this.composer.setSize(width, height);
            }

            this.renderPass = new THREE.RenderPass(this.scene, this.camera);
            this.composer.addPass(this.renderPass);

            if (typeof THREE.UnrealBloomPass === 'function' && typeof THREE.Vector2 === 'function') {
                this._bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(width, height), 0.75, 0.85, 0.25);
                this._bloomPass.strength = 0.85;
                this._bloomPass.radius = 0.82;
                this._bloomPass.threshold = 0.18;
                this.composer.addPass(this._bloomPass);
            } else {
                this._bloomPass = null;
            }

            if (typeof THREE.ShaderPass === 'function') {
                const shader = this._createColorGradeShader();
                this._colorGradePass = new THREE.ShaderPass(shader);
                if (typeof this._colorGradePass.renderToScreen !== 'undefined') {
                    this._colorGradePass.renderToScreen = true;
                }
                this.composer.addPass(this._colorGradePass);
            } else {
                this._colorGradePass = null;
            }
        }

        _createColorGradeShader() {
            const tint = new THREE.Vector3(0.96, 0.99, 1.05);
            return {
                uniforms: {
                    tDiffuse: { value: null },
                    exposure: { value: 1.05 },
                    offset: { value: 0.015 },
                    tint: { value: tint },
                    vignetteStrength: { value: 0.48 },
                    vignetteFeather: { value: 0.42 }
                },
                vertexShader: `varying vec2 vUv;\n` +
                    `void main() {\n` +
                    `    vUv = uv;\n` +
                    `    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n` +
                    `}`,
                fragmentShader: `uniform sampler2D tDiffuse;\n` +
                    `uniform float exposure;\n` +
                    `uniform float offset;\n` +
                    `uniform vec3 tint;\n` +
                    `uniform float vignetteStrength;\n` +
                    `uniform float vignetteFeather;\n` +
                    `varying vec2 vUv;\n` +
                    `void main() {\n` +
                    `    vec4 color = texture2D(tDiffuse, vUv);\n` +
                    `    color.rgb = (color.rgb + offset) * exposure;\n` +
                    `    color.rgb *= tint;\n` +
                    `    float radius = distance(vUv, vec2(0.5));\n` +
                    `    float inner = vignetteStrength;\n` +
                    `    float outer = vignetteStrength + vignetteFeather;\n` +
                    `    float vignette = smoothstep(inner, outer, radius);\n` +
                    `    color.rgb *= mix(1.0, 1.0 - vignette, 0.78);\n` +
                    `    gl_FragColor = vec4(color.rgb, color.a);\n` +
                    `}`
            };
        }

        _resizePostProcessing(width, height) {
            if (this._glRenderer) {
                const deviceRatio = Math.min(global.devicePixelRatio || 1, 2);
                this._glRenderer.setPixelRatio(deviceRatio);
                this._glRenderer.setSize(width, height, false);
                if (this._composer && typeof this._composer.setPixelRatio === 'function') {
                    this._composer.setPixelRatio(deviceRatio);
                }
                if (this._composer && typeof this._composer.setSize === 'function') {
                    this._composer.setSize(width, height);
                }
                return;
            }
            if (!this.renderer) {
                return;
            }
            this.renderer.setSize(width, height, false);
            const pixelRatio = this.renderer.getPixelRatio
                ? this.renderer.getPixelRatio()
                : (global.devicePixelRatio || 1);
            if (this.composer && typeof this.composer.setPixelRatio === 'function') {
                this.composer.setPixelRatio(pixelRatio);
            }
            if (this.composer && typeof this.composer.setSize === 'function') {
                this.composer.setSize(width, height);
            }
            if (this._bloomPass && typeof this._bloomPass.setSize === 'function') {
                this._bloomPass.setSize(width, height);
            }
        }

        _createSpriteStars() {
            if (!this.scene || !THREE || !this._glRenderer) {
                this._disposeSpriteStars();
                return;
            }
            this._disposeSpriteStars();

            const COUNT = 1000;
            const baseSize = 10;
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(COUNT * 3);
            const baseSizes = new Float32Array(COUNT);
            const sizeFactors = new Float32Array(COUNT);

            for (let i = 0; i < COUNT; i += 1) {
                const radius = 45000 + (Math.random() * 15000);
                const theta = Math.acos((2 * Math.random()) - 1);
                const phi = 2 * Math.PI * Math.random();
                const sinTheta = Math.sin(theta);
                const cosTheta = Math.cos(theta);
                const sinPhi = Math.sin(phi);
                const cosPhi = Math.cos(phi);
                const offset = i * 3;
                positions[offset] = radius * sinTheta * cosPhi;
                positions[offset + 1] = radius * sinTheta * sinPhi;
                positions[offset + 2] = radius * cosTheta;

                const starSize = 6 + (Math.random() * 10);
                baseSizes[i] = starSize;
                sizeFactors[i] = starSize / baseSize;
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('aSize', new THREE.BufferAttribute(sizeFactors, 1));

            const circle = global.document && typeof global.document.createElement === 'function'
                ? global.document.createElement('canvas')
                : null;
            if (!circle) {
                geometry.dispose();
                return;
            }
            circle.width = 64;
            circle.height = 64;
            const ctx = circle.getContext('2d');
            if (!ctx) {
                geometry.dispose();
                return;
            }
            const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(255,255,255,1)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(32, 32, 32, 0, Math.PI * 2);
            ctx.fill();

            if (typeof THREE.CanvasTexture !== 'function') {
                geometry.dispose();
                return;
            }
            const spriteTex = new THREE.CanvasTexture(circle);
            if (typeof THREE.SRGBColorSpace !== 'undefined') {
                spriteTex.colorSpace = THREE.SRGBColorSpace;
            } else if (typeof THREE.sRGBEncoding !== 'undefined') {
                spriteTex.encoding = THREE.sRGBEncoding;
            }
            spriteTex.needsUpdate = true;

            const material = new THREE.PointsMaterial({
                map: spriteTex,
                size: baseSize,
                transparent: true,
                depthWrite: false,
                blending: typeof THREE.AdditiveBlending !== 'undefined' ? THREE.AdditiveBlending : undefined,
                sizeAttenuation: true
            });

            material.onBeforeCompile = (shader) => {
                shader.vertexShader = shader.vertexShader.replace(
                    'void main() {',
                    'attribute float aSize;\nvoid main() {'
                );
                shader.vertexShader = shader.vertexShader.replace(
                    'gl_PointSize = size;',
                    'gl_PointSize = size * aSize;'
                );
            };
            material.needsUpdate = true;

            const points = new THREE.Points(geometry, material);
            points.frustumCulled = false;
            points.renderOrder = -4.2;
            this.scene.add(points);

            points.userData._baseSizes = baseSizes;
            points.userData._sizeScale = baseSize;
            points.userData._sizeAttribute = geometry.getAttribute('aSize');

            this._spriteStars = points;
            this._spriteStarsMat = material;
        }

        _disposeSpriteStars() {
            if (!this._spriteStars) {
                this._spriteStarsMat = null;
                return;
            }
            if (this.scene && typeof this.scene.remove === 'function') {
                this.scene.remove(this._spriteStars);
            }
            const geometry = this._spriteStars.geometry;
            const material = this._spriteStars.material;
            if (geometry && typeof geometry.dispose === 'function') {
                geometry.dispose();
            }
            if (material) {
                if (material.map && typeof material.map.dispose === 'function') {
                    material.map.dispose();
                }
                if (typeof material.dispose === 'function') {
                    material.dispose();
                }
            }
            this._spriteStars = null;
            this._spriteStarsMat = null;
        }

        _disposeNebulaLayer() {
            if (this._nebulaLayer && typeof this._nebulaLayer.dispose === 'function') {
                this._nebulaLayer.dispose();
            }
            this._nebulaLayer = null;
        }

        _loadEnvironmentMap() {
            if (!this.renderer || !this.scene) {
                return;
            }
            const loader = this._ensureRGBELoader();
            if (!loader) {
                return;
            }

            const hdrUrl = 'assets/skill-universe/material-ingredients/gases/HDR_rich_multi_nebulae_2.hdr';
            loader.load(
                hdrUrl,
                (hdrTexture) => {
                    if (!hdrTexture) {
                        return;
                    }
                    try {
                        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
                        if (typeof pmremGenerator.compileEquirectangularShader === 'function') {
                            pmremGenerator.compileEquirectangularShader();
                        }
                        const target = pmremGenerator.fromEquirectangular(hdrTexture);
                        pmremGenerator.dispose();
                        hdrTexture.dispose();

                        if (this._environmentTarget && typeof this._environmentTarget.dispose === 'function') {
                            if (this._environmentTarget.texture && typeof this._environmentTarget.texture.dispose === 'function') {
                                this._environmentTarget.texture.dispose();
                            }
                            this._environmentTarget.dispose();
                        }

                        this._environmentTarget = target;
                        this._environmentMap = target.texture;
                        if (this._environmentMap && typeof this._environmentMap.mapping !== 'undefined' && typeof THREE.EquirectangularReflectionMapping !== 'undefined') {
                            this._environmentMap.mapping = THREE.EquirectangularReflectionMapping;
                        }
                        this._environmentName = hdrUrl;
                        if (this.scene) {
                            this.scene.environment = this._environmentMap;
                            this.scene.background = this._environmentMap;
                        }
                        this.render();
                    } catch (error) {
                        console.warn('Failed to process HDR environment map:', error);
                    }
                },
                undefined,
                (error) => {
                    console.warn('Failed to load HDR environment map:', hdrUrl, error);
                }
            );
        }

        _loadHDRTexture(url, onLoad, { track = false } = {}) {
            if (!url || typeof onLoad !== 'function') {
                return;
            }
            const loader = this._ensureRGBELoader();
            if (!loader) {
                return;
            }
            loader.load(
                url,
                (texture) => {
                    if (!texture) {
                        return;
                    }
                    if (typeof texture.colorSpace !== 'undefined' && typeof THREE.LinearSRGBColorSpace !== 'undefined') {
                        texture.colorSpace = THREE.LinearSRGBColorSpace;
                    } else if (typeof texture.encoding !== 'undefined' && typeof THREE.LinearEncoding !== 'undefined') {
                        texture.encoding = THREE.LinearEncoding;
                    }
                    if (track) {
                        this._nebulaTextures.push(texture);
                    }
                    texture.needsUpdate = true;
                    onLoad(texture);
                    this.render();
                },
                undefined,
                (error) => {
                    console.warn('Failed to load HDR texture:', url, error);
                }
            );
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
            this._width = width;
            this._height = height;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this._resizePostProcessing(width, height);
            if (this.renderer?.domElement) {
                this.renderer.domElement.style.width = '100%';
                this.renderer.domElement.style.height = '100%';
            }
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

        render(delta = null) {
            if (this._composer && this._glRenderer) {
                if (typeof delta === 'number') {
                    this._composer.render(delta);
                } else {
                    this._composer.render();
                }
                return;
            }
            // Legacy path (unchanged)
            if (this.composer) {
                if (typeof delta === 'number') {
                    this.composer.render(delta);
                } else {
                    this.composer.render();
                }
                return;
            }
            if (this.renderer) {
                this.renderer.render(this.scene, this.camera);
            }
        }

        _updateDiagnostics() {
            if (!this._diagnosticsPanel || !this._diagnosticsFields) {
                return;
            }

            const fields = this._diagnosticsFields;
            const pipelineActive = (this._glRenderer && this._composer) ? 'Modern WebGL' : 'Legacy';
            fields.pipeline.textContent = pipelineActive;

            if (this._composer) {
                const bloomPass = this._composer.__bloom;
                const gradePass = this._composer.__grade;
                const bloomState = bloomPass && bloomPass.enabled === false ? 'off' : (bloomPass ? 'on' : 'missing');
                const gradeState = gradePass && gradePass.enabled === false ? 'off' : (gradePass ? 'on' : 'missing');
                fields.passes.textContent = `Render • Bloom: ${bloomState} • Grade: ${gradeState}`;
            } else {
                fields.passes.textContent = 'n/a';
            }

            const renderer = this._glRenderer || this.renderer || null;
            if (renderer && typeof renderer.toneMapping !== 'undefined') {
                let toneLabel = 'Custom';
                if (renderer.toneMapping === THREE.ACESFilmicToneMapping) {
                    toneLabel = 'ACES';
                }
                const exposure = typeof renderer.toneMappingExposure === 'number'
                    ? renderer.toneMappingExposure.toFixed(2)
                    : null;
                fields.tone.textContent = exposure ? `${toneLabel} (exp ${exposure})` : toneLabel;
            } else {
                fields.tone.textContent = 'n/a';
            }

            const environmentLabel = (() => {
                if (typeof this._environmentName === 'string' && this._environmentName.length) {
                    const parts = this._environmentName.split(/[/\\]/);
                    const base = parts[parts.length - 1] || this._environmentName;
                    return base;
                }
                if (this.scene?.environment) {
                    return this.scene.environment.name || 'active';
                }
                return 'none';
            })();
            fields.ibl.textContent = environmentLabel;

            const nebulaCount = Array.isArray(this._nebulaPlanes) ? this._nebulaPlanes.length : 0;
            const dynamicLayerCount = (this._nebulaLayer && typeof this._nebulaLayer.getPlaneCount === 'function')
                ? Number(this._nebulaLayer.getPlaneCount()) || 0
                : 0;
            fields.nebula.textContent = dynamicLayerCount
                ? `${nebulaCount} + ${dynamicLayerCount}`
                : String(nebulaCount);

            let spriteCount = 0;
            const spritePoints = this._spriteStars;
            if (spritePoints?.geometry?.getAttribute) {
                const attr = spritePoints.geometry.getAttribute('position');
                if (attr && typeof attr.count === 'number') {
                    spriteCount = attr.count;
                }
            }
            fields.sprites.textContent = String(spriteCount);

            let totalStars = 0;
            let pbrStars = 0;
            if (this.starMeshMap && typeof this.starMeshMap.forEach === 'function') {
                this.starMeshMap.forEach((mesh) => {
                    if (!mesh) {
                        return;
                    }
                    totalStars += 1;
                    if (mesh.userData && mesh.userData.usesPBR) {
                        pbrStars += 1;
                    }
                });
            }
            const fallbackStars = totalStars - pbrStars;
            fields.pbr.textContent = totalStars
                ? `${pbrStars}/${totalStars} using PBR • ${fallbackStars} fallback`
                : '0 using PBR • 0 fallback';
        }

        destroy() {
            cancelAnimationFrame(this._animationFrame);
            if (this._diagnosticsInterval && typeof global.clearInterval === 'function') {
                global.clearInterval(this._diagnosticsInterval);
            }
            this._diagnosticsInterval = null;
            if (this._diagnosticsPanel && this._diagnosticsPanel.parentElement) {
                this._diagnosticsPanel.parentElement.removeChild(this._diagnosticsPanel);
            }
            this._diagnosticsPanel = null;
            this._diagnosticsFields = null;
            if (this._debugUIPanel && this._debugUIPanel.parentElement) {
                this._debugUIPanel.parentElement.removeChild(this._debugUIPanel);
            }
            this._debugUIPanel = null;
            if (this.starMeshMap && this.starMeshMap.size) {
                this.starMeshMap.forEach((mesh) => {
                    this._applyTextureLayers(mesh, null);
                    if (mesh.material && typeof mesh.material.dispose === 'function') {
                        mesh.material.dispose();
                    }
                    if (mesh.geometry && typeof mesh.geometry.dispose === 'function') {
                        mesh.geometry.dispose();
                    }
                    if (mesh.parent && typeof mesh.parent.remove === 'function') {
                        mesh.parent.remove(mesh);
                    }
                });
            }
            if (this.starfieldGroup) {
                this.scene.remove(this.starfieldGroup);
                this._disposeStarfieldGroup(this.starfieldGroup);
                this.starfieldGroup = null;
            }
            this._farStars = null;
            this._midStars = null;
            this._fogPoints = null;
            if (Array.isArray(this._nebulaTextures) && this._nebulaTextures.length) {
                this._nebulaTextures.forEach((texture) => {
                    if (texture && typeof texture.dispose === 'function') {
                        texture.dispose();
                    }
                });
            }
            this._nebulaTextures = [];
            this._nebulaPlanes = [];
            this._disposeNebulaLayer();
            this._disposeSpriteStars();
            if (Array.isArray(this._lightRigLights) && this._lightRigLights.length) {
                this._lightRigLights.forEach((light) => {
                    if (light && light.parent && typeof light.parent.remove === 'function') {
                        light.parent.remove(light);
                    }
                });
            }
            this._lightRigLights = [];
            this._lightRig = null;
            if (this._composer) {
                if (typeof this._composer.dispose === 'function') {
                    this._composer.dispose();
                }
                this._composer = null;
            }
            if (this._glRenderer) {
                if (typeof this._glRenderer.dispose === 'function') {
                    this._glRenderer.dispose();
                }
                if (this._glRenderer.domElement && typeof this._glRenderer.domElement.remove === 'function') {
                    this._glRenderer.domElement.remove();
                }
                if (this.renderer === this._glRenderer) {
                    this.renderer = null;
                }
                this._glRenderer = null;
            }
            if (this.composer && typeof this.composer.dispose === 'function') {
                this.composer.dispose();
            }
            this.composer = null;
            this.renderPass = null;
            this._bloomPass = null;
            this._colorGradePass = null;
            if (this._environmentTarget) {
                const targetTexture = this._environmentTarget.texture;
                if (targetTexture && typeof targetTexture.dispose === 'function') {
                    targetTexture.dispose();
                }
                if (typeof this._environmentTarget.dispose === 'function') {
                    this._environmentTarget.dispose();
                }
                if (targetTexture && targetTexture === this._environmentMap) {
                    this._environmentMap = null;
                }
                this._environmentTarget = null;
            }
            if (this._environmentMap && typeof this._environmentMap.dispose === 'function') {
                this._environmentMap.dispose();
            }
            this._environmentMap = null;
            this._environmentName = null;
            if (this.scene) {
                this.scene.environment = null;
                this.scene.background = null;
            }
            if (this.controls) {
                this.controls.dispose();
            }
            if (this.renderer) {
                this.renderer.dispose();
            }
            this.container.innerHTML = '';
            this.pickableObjects.length = 0;
            this.galaxyMap.clear();
            this.constellationMap.clear();
            this.starMeshMap.clear();
            if (this._textureCache) {
                this._textureCache.forEach((record) => {
                    if (record && record.texture && typeof record.texture.dispose === 'function') {
                        record.texture.dispose();
                    }
                });
                this._textureCache.clear();
            }
            this._textureLoader = null;
        }

        _disposeStarfieldGroup(group) {
            if (!group) {
                return;
            }
            const geometries = new Set();
            const materials = new Set();
            group.traverse((child) => {
                if (child.geometry && typeof child.geometry.dispose === 'function') {
                    geometries.add(child.geometry);
                }
                const { material } = child;
                if (Array.isArray(material)) {
                    material.forEach((mat) => {
                        if (mat) {
                            materials.add(mat);
                        }
                    });
                } else if (material) {
                    materials.add(material);
                }
            });
            geometries.forEach((geometry) => {
                if (geometry && typeof geometry.dispose === 'function') {
                    geometry.dispose();
                }
            });
            materials.forEach((material) => {
                if (material && material.map && Array.isArray(this._nebulaTextures) && this._nebulaTextures.includes(material.map)) {
                    material.map = null;
                }
                if (material && typeof material.dispose === 'function') {
                    material.dispose();
                }
            });
            if (typeof group.clear === 'function') {
                group.clear();
            }
        }

        _createStarfield() {
            if (this.starfieldGroup) {
                this.scene.remove(this.starfieldGroup);
                this._disposeStarfieldGroup(this.starfieldGroup);
                this.starfieldGroup = null;
            }
            if (Array.isArray(this._nebulaTextures) && this._nebulaTextures.length) {
                this._nebulaTextures.forEach((texture) => {
                    if (texture && typeof texture.dispose === 'function') {
                        texture.dispose();
                    }
                });
            }
            this._nebulaTextures = [];
            this._nebulaPlanes = [];

            const group = new THREE.Group();
            group.name = 'skill-universe-sky';
            group.renderOrder = -5;

            const farCount = Math.floor(STARFIELD_CONFIG.count * 0.55);
            const farPositions = new Float32Array(farCount * 3);
            const farColors = new Float32Array(farCount * 3);
            const farGeometry = new THREE.BufferGeometry();
            const farRadius = STARFIELD_CONFIG.radius * 1.45;
            const farVertical = STARFIELD_CONFIG.radius * 0.42;
            const farBaseColor = new THREE.Color(0xaecbff);
            const farWarmColor = new THREE.Color(0xffe7c7);
            const farTempColor = new THREE.Color();

            for (let i = 0; i < farCount; i += 1) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                const radius = farRadius * (0.72 + Math.pow(Math.random(), 0.4));
                const sinPhi = Math.sin(phi);
                const offset = i * 3;
                farPositions[offset] = Math.cos(theta) * sinPhi * radius;
                farPositions[offset + 1] = (Math.cos(phi) * farVertical) + ((Math.random() - 0.5) * farVertical * 0.4);
                farPositions[offset + 2] = Math.sin(theta) * sinPhi * radius;

                const hueMix = Math.pow(Math.random(), 1.8) * 0.65;
                farTempColor.copy(farBaseColor).lerp(farWarmColor, hueMix);
                const brightness = 0.55 + Math.random() * 0.45;
                farColors[offset] = farTempColor.r * brightness;
                farColors[offset + 1] = farTempColor.g * brightness;
                farColors[offset + 2] = farTempColor.b * brightness;
            }

            farGeometry.setAttribute('position', new THREE.BufferAttribute(farPositions, 3));
            farGeometry.setAttribute('color', new THREE.BufferAttribute(farColors, 3));

            const farMaterial = new THREE.PointsMaterial({
                size: STARFIELD_CONFIG.size * 1.6,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.92,
                depthWrite: false,
                vertexColors: true
            });
            if (typeof THREE.AdditiveBlending !== 'undefined') {
                farMaterial.blending = THREE.AdditiveBlending;
            }
            farMaterial.toneMapped = true;

            const farStars = new THREE.Points(farGeometry, farMaterial);
            farStars.name = 'sky-far-stars';
            farStars.frustumCulled = false;
            farStars.renderOrder = -5;
            group.add(farStars);
            this._farStars = farStars;

            const midCount = Math.floor(STARFIELD_CONFIG.count * 0.35);
            const midPositions = new Float32Array(midCount * 3);
            const midColors = new Float32Array(midCount * 3);
            const midGeometry = new THREE.BufferGeometry();
            const midRadius = STARFIELD_CONFIG.radius * 0.98;
            const midVertical = STARFIELD_CONFIG.radius * 0.32;
            const midBaseColor = new THREE.Color(0x9fb7ff);
            const midAccentColor = new THREE.Color(0xffaef5);

            for (let i = 0; i < midCount; i += 1) {
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos((Math.random() * 2) - 1);
                const radius = midRadius * (0.45 + Math.pow(Math.random(), 0.65));
                const sinPhi = Math.sin(phi);
                const offset = i * 3;
                midPositions[offset] = Math.cos(theta) * sinPhi * radius;
                midPositions[offset + 1] = (Math.cos(phi) * midVertical) + ((Math.random() - 0.5) * midVertical * 0.8);
                midPositions[offset + 2] = Math.sin(theta) * sinPhi * radius;

                const hueMix = Math.pow(Math.random(), 1.4) * 0.55;
                const brightness = 0.65 + Math.random() * 0.4;
                const color = farTempColor.copy(midBaseColor).lerp(midAccentColor, hueMix);
                midColors[offset] = color.r * brightness;
                midColors[offset + 1] = color.g * brightness;
                midColors[offset + 2] = color.b * brightness;
            }

            midGeometry.setAttribute('position', new THREE.BufferAttribute(midPositions, 3));
            midGeometry.setAttribute('color', new THREE.BufferAttribute(midColors, 3));

            const midMaterial = new THREE.PointsMaterial({
                size: STARFIELD_CONFIG.size * 2.6,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.78,
                depthWrite: false,
                vertexColors: true
            });
            if (typeof THREE.AdditiveBlending !== 'undefined') {
                midMaterial.blending = THREE.AdditiveBlending;
            }
            midMaterial.toneMapped = true;

            const midStars = new THREE.Points(midGeometry, midMaterial);
            midStars.name = 'sky-mid-stars';
            midStars.frustumCulled = false;
            midStars.renderOrder = -4.5;
            group.add(midStars);
            this._midStars = midStars;

            const nebulaConfigs = [
                {
                    url: 'assets/skill-universe/material-ingredients/gases/HDR_rich_multi_nebulae_1.hdr',
                    position: [-2100, 520, -1480],
                    rotation: [0.12, Math.PI * 0.18, 0.26],
                    scale: [3600, 2200],
                    opacity: 0.58
                },
                {
                    url: 'assets/skill-universe/material-ingredients/gases/HDR_rich_multi_nebulae_2.hdr',
                    position: [1880, 340, -980],
                    rotation: [-0.08, -Math.PI * 0.26, -0.18],
                    scale: [3400, 2100],
                    opacity: 0.52
                },
                {
                    url: 'assets/skill-universe/material-ingredients/gases/HDR_subdued_multi_nebulae.hdr',
                    position: [0, -220, 1860],
                    rotation: [0.02, Math.PI, 0.04],
                    scale: [4200, 2600],
                    opacity: 0.45
                },
                {
                    url: 'assets/skill-universe/material-ingredients/gases/HDR_hazy_nebulae.hdr',
                    position: [-1480, -120, 1620],
                    rotation: [-0.16, Math.PI * 0.62, 0.2],
                    scale: [3200, 2000],
                    opacity: 0.38
                }
            ];

            nebulaConfigs.forEach((config, index) => {
                const nebulaMaterial = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: true,
                    opacity: config.opacity * 0.2,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                    blending: typeof THREE.AdditiveBlending !== 'undefined' ? THREE.AdditiveBlending : undefined
                });
                nebulaMaterial.toneMapped = true;
                const nebulaGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
                const nebulaPlane = new THREE.Mesh(nebulaGeometry, nebulaMaterial);
                nebulaPlane.name = `sky-nebula-${index}`;
                nebulaPlane.position.set(config.position[0], config.position[1], config.position[2]);
                nebulaPlane.rotation.set(config.rotation[0], config.rotation[1], config.rotation[2]);
                nebulaPlane.scale.set(config.scale[0], config.scale[1], 1);
                nebulaPlane.renderOrder = -4 + (index * 0.01);
                nebulaPlane.frustumCulled = false;
                nebulaPlane.userData.baseRotation = {
                    x: config.rotation[0],
                    y: config.rotation[1],
                    z: config.rotation[2]
                };
                nebulaPlane.userData.wobblePhase = Math.random() * Math.PI * 2;
                nebulaPlane.userData.wobbleSpeed = 0.035 + Math.random() * 0.035;
                this._nebulaPlanes.push(nebulaPlane);
                group.add(nebulaPlane);

                this._loadHDRTexture(
                    config.url,
                    (texture) => {
                        if (typeof THREE.LinearFilter !== 'undefined') {
                            if (typeof texture.minFilter !== 'undefined') {
                                texture.minFilter = THREE.LinearFilter;
                            }
                            if (typeof texture.magFilter !== 'undefined') {
                                texture.magFilter = THREE.LinearFilter;
                            }
                        }
                        texture.generateMipmaps = false;
                        nebulaMaterial.map = texture;
                        nebulaMaterial.opacity = config.opacity;
                        nebulaMaterial.needsUpdate = true;
                    },
                    { track: true }
                );
            });

            const fogCount = 900;
            const fogPositions = new Float32Array(fogCount * 3);
            const fogColors = new Float32Array(fogCount * 3);
            const fogGeometry = new THREE.BufferGeometry();
            const fogRadius = STARFIELD_CONFIG.radius * 0.9;
            const fogVertical = STARFIELD_CONFIG.radius * 0.5;
            const fogColorA = new THREE.Color(0x4a6bd6);
            const fogColorB = new THREE.Color(0xff7abf);

            for (let i = 0; i < fogCount; i += 1) {
                const theta = Math.random() * Math.PI * 2;
                const radius = Math.pow(Math.random(), 0.6) * fogRadius;
                const offset = i * 3;
                fogPositions[offset] = Math.cos(theta) * radius;
                fogPositions[offset + 1] = (Math.random() - 0.5) * fogVertical;
                fogPositions[offset + 2] = Math.sin(theta) * radius;

                const mix = Math.pow(Math.random(), 2.2) * 0.35;
                const color = farTempColor.copy(fogColorA).lerp(fogColorB, mix);
                const brightness = 0.08 + Math.random() * 0.12;
                fogColors[offset] = color.r * brightness;
                fogColors[offset + 1] = color.g * brightness;
                fogColors[offset + 2] = color.b * brightness;
            }

            fogGeometry.setAttribute('position', new THREE.BufferAttribute(fogPositions, 3));
            fogGeometry.setAttribute('color', new THREE.BufferAttribute(fogColors, 3));

            const fogMaterial = new THREE.PointsMaterial({
                size: STARFIELD_CONFIG.size * 18,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.22,
                depthWrite: false,
                vertexColors: true
            });
            if (typeof THREE.AdditiveBlending !== 'undefined') {
                fogMaterial.blending = THREE.AdditiveBlending;
            }
            fogMaterial.toneMapped = true;

            const fogPoints = new THREE.Points(fogGeometry, fogMaterial);
            fogPoints.name = 'sky-fog';
            fogPoints.frustumCulled = false;
            fogPoints.renderOrder = -3.8;
            group.add(fogPoints);
            this._fogPoints = fogPoints;

            this.scene.add(group);
            this.starfieldGroup = group;
            this.render();
        }

        _setupLights() {
            if (Array.isArray(this._lightRigLights) && this._lightRigLights.length) {
                this._lightRigLights.forEach((light) => {
                    if (light && light.parent && typeof light.parent.remove === 'function') {
                        light.parent.remove(light);
                    }
                });
            }
            this._lightRigLights = [];

            const rig = {};
            const missingLights = [];

            if (typeof THREE.HemisphereLight === 'function') {
                const hemiLight = new THREE.HemisphereLight(0x6d9bff, 0x04030c, 0.28);
                this.scene.add(hemiLight);
                this._lightRigLights.push(hemiLight);
                rig.hemi = hemiLight;
            } else {
                missingLights.push('HemisphereLight');
            }

            if (typeof THREE.DirectionalLight === 'function' && typeof THREE.Object3D === 'function') {
                const keyLight = new THREE.DirectionalLight(0xfff1de, 18);
                keyLight.position.set(640, 820, 420);
                keyLight.userData.baseIntensity = keyLight.intensity;
                keyLight.userData.basePosition = keyLight.position.clone();
                if (typeof keyLight.castShadow !== 'undefined') {
                    keyLight.castShadow = false;
                }
                const keyTarget = new THREE.Object3D();
                keyTarget.position.set(0, 40, 0);
                this.scene.add(keyTarget);
                keyLight.target = keyTarget;
                this.scene.add(keyLight);
                this._lightRigLights.push(keyLight, keyTarget);
                rig.keyLight = keyLight;
            } else {
                missingLights.push('DirectionalLight');
            }

            if (typeof THREE.PointLight === 'function') {
                const rimLight = new THREE.PointLight(0x7aa9ff, 260, 0, 2);
                rimLight.position.set(-960, -260, -840);
                rimLight.userData.baseIntensity = rimLight.intensity;
                rimLight.userData.basePosition = rimLight.position.clone();
                if (typeof rimLight.decay === 'number') {
                    rimLight.decay = 2;
                }
                this.scene.add(rimLight);
                this._lightRigLights.push(rimLight);
                rig.rimLight = rimLight;

                const fillLight = new THREE.PointLight(0xff8ad6, 140, 0, 2);
                fillLight.position.set(520, -320, -1080);
                fillLight.userData.baseIntensity = fillLight.intensity;
                fillLight.userData.basePosition = fillLight.position.clone();
                if (typeof fillLight.decay === 'number') {
                    fillLight.decay = 2;
                }
                this.scene.add(fillLight);
                this._lightRigLights.push(fillLight);
                rig.fillLight = fillLight;

                const accentLight = new THREE.PointLight(0x9affff, 95, 0, 2);
                accentLight.position.set(-380, 420, 960);
                accentLight.userData.baseIntensity = accentLight.intensity;
                accentLight.userData.basePosition = accentLight.position.clone();
                if (typeof accentLight.decay === 'number') {
                    accentLight.decay = 1.8;
                }
                this.scene.add(accentLight);
                this._lightRigLights.push(accentLight);
                rig.accentLight = accentLight;

                const horizonGlow = new THREE.PointLight(0xffe6a1, 70, 0, 1.6);
                horizonGlow.position.set(0, 260, 0);
                horizonGlow.userData.baseIntensity = horizonGlow.intensity;
                horizonGlow.userData.basePosition = horizonGlow.position.clone();
                if (typeof horizonGlow.decay === 'number') {
                    horizonGlow.decay = 2;
                }
                this.scene.add(horizonGlow);
                this._lightRigLights.push(horizonGlow);
                rig.horizonGlow = horizonGlow;
            } else {
                missingLights.push('PointLight');
            }

            if (missingLights.length && typeof console !== 'undefined' && typeof console.warn === 'function') {
                console.warn(
                    'SkillUniverseRenderer: Some Three.js light types are unavailable and will be skipped:',
                    missingLights.join(', ')
                );
            }

            this._lightRig = rig;
        }

        _updateLights(elapsedTime = 0) {
            if (!this._lightRig) {
                return;
            }

            const keyLight = this._lightRig.keyLight;
            if (keyLight && keyLight.userData) {
                const basePos = keyLight.userData.basePosition;
                if (basePos) {
                    keyLight.position.x = basePos.x + Math.cos(elapsedTime * 0.045) * 60;
                    keyLight.position.y = basePos.y + Math.sin(elapsedTime * 0.05) * 45;
                    keyLight.position.z = basePos.z + Math.sin(elapsedTime * 0.035) * 40;
                }
                if (typeof keyLight.intensity === 'number' && keyLight.userData.baseIntensity) {
                    keyLight.intensity = keyLight.userData.baseIntensity * (1 + 0.08 * Math.sin(elapsedTime * 0.25));
                }
            }

            const rimLight = this._lightRig.rimLight;
            if (rimLight && rimLight.userData) {
                const basePos = rimLight.userData.basePosition;
                if (basePos) {
                    rimLight.position.x = basePos.x + Math.sin(elapsedTime * 0.18) * 140;
                    rimLight.position.z = basePos.z + Math.cos(elapsedTime * 0.21) * 160;
                }
                if (typeof rimLight.intensity === 'number' && rimLight.userData.baseIntensity) {
                    rimLight.intensity = rimLight.userData.baseIntensity * (0.82 + 0.18 * Math.sin(elapsedTime * 0.6 + Math.PI / 4));
                }
            }

            const fillLight = this._lightRig.fillLight;
            if (fillLight && fillLight.userData) {
                const basePos = fillLight.userData.basePosition;
                if (basePos) {
                    fillLight.position.y = basePos.y + Math.sin(elapsedTime * 0.32) * 55;
                }
                if (typeof fillLight.intensity === 'number' && fillLight.userData.baseIntensity) {
                    fillLight.intensity = fillLight.userData.baseIntensity * (0.9 + 0.1 * Math.sin(elapsedTime * 0.42));
                }
            }

            const accentLight = this._lightRig.accentLight;
            if (accentLight && accentLight.userData) {
                const basePos = accentLight.userData.basePosition;
                if (basePos) {
                    accentLight.position.x = basePos.x + Math.cos(elapsedTime * 0.25) * 120;
                    accentLight.position.z = basePos.z + Math.sin(elapsedTime * 0.27) * 90;
                }
                if (typeof accentLight.intensity === 'number' && accentLight.userData.baseIntensity) {
                    const pulse = 0.65 + 0.35 * ((Math.sin(elapsedTime * 0.95) + 1) * 0.5);
                    accentLight.intensity = accentLight.userData.baseIntensity * pulse;
                }
            }

            const horizonGlow = this._lightRig.horizonGlow;
            if (horizonGlow && horizonGlow.userData && horizonGlow.userData.baseIntensity) {
                horizonGlow.intensity = horizonGlow.userData.baseIntensity * (0.85 + 0.15 * Math.sin(elapsedTime * 0.52 + Math.PI / 3));
            }

            if (this._lightRig.hemi && typeof this._lightRig.hemi.intensity === 'number') {
                this._lightRig.hemi.intensity = 0.26 + 0.03 * Math.sin(elapsedTime * 0.2);
            }
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
                    GALAXY_RADIUS * 0.22
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
                        opacity: 0.68,
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

                const labelHeight = Math.max(96, semiMinor * 0.24 + 68);
                const labelOffset = Math.max(semiMajor * 0.85, CONSTELLATION_RADIUS * 1.22);
                const label = createLabelSprite(galaxyName, {
                    scale: 2.05,
                    fontSize: 72,
                    padding: 28,
                    backgroundColor: 'rgba(36, 20, 62, 0.9)',
                    textColor: 'rgba(255, 228, 166, 0.98)',
                    borderColor: 'rgba(255, 196, 116, 0.9)',
                    borderWidth: 4,
                    borderRadius: 18,
                    shadowColor: 'rgba(10, 0, 40, 0.85)',
                    shadowBlur: 18,
                    shadowOffsetX: 0,
                    shadowOffsetY: 6
                });
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
                        CONSTELLATION_RADIUS * 0.18
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
                            STAR_SYSTEM_RADIUS * 0.32
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
                                STAR_ORBIT_RADIUS * 0.42
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
            const { fullyTransparentDistance, fullyVisibleDistance } = GALAXY_LABEL_VISIBILITY;
            const fadeRange = Math.max(1, fullyVisibleDistance - fullyTransparentDistance);

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
                    if (label.material && typeof label.material.opacity === 'number') {
                        label.material.opacity = 0;
                    }
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

                const baseScale = Number.isFinite(label.userData?.baseScale)
                    ? label.userData.baseScale
                    : label.scale.y;
                const fallbackScaleY = Number.isFinite(label.scale?.y) ? label.scale.y : 1;
                const computedAspect = fallbackScaleY !== 0 ? label.scale.x / fallbackScaleY : 1;
                const aspectRatio = Number.isFinite(label.userData?.aspectRatio) && label.userData.aspectRatio > 0
                    ? label.userData.aspectRatio
                    : (Number.isFinite(computedAspect) && computedAspect > 0 ? computedAspect : 1);
                const comfortableDistance = CAMERA_LEVELS.galaxies.distance + 360;
                const visibilityFactor = clamp(
                    (distance - fullyTransparentDistance) / fadeRange,
                    0,
                    1
                );
                const distanceScale = clamp(
                    distance / Math.max(comfortableDistance, 1),
                    0.6,
                    2.6
                );
                const emphasisScale = 0.85 + visibilityFactor * 1.15;
                const scaleMultiplier = clamp(distanceScale * emphasisScale, 0.65, 2.75);
                const finalScale = baseScale * scaleMultiplier;
                label.scale.set(finalScale * aspectRatio, finalScale, 1);

                if (label.material && typeof label.material.opacity === 'number') {
                    const emphasis = visibilityFactor * visibilityFactor;
                    label.material.opacity = emphasis;
                }
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

        _configureTextureForSlot(texture, slot, { forceUpdate = true } = {}) {
            if (!texture) {
                return;
            }
            if (slot === 'map' || slot === 'emissiveMap') {
                if (typeof texture.colorSpace !== 'undefined' && THREE.SRGBColorSpace) {
                    texture.colorSpace = THREE.SRGBColorSpace;
                } else if (typeof texture.encoding !== 'undefined' && THREE.sRGBEncoding) {
                    texture.encoding = THREE.sRGBEncoding;
                }
            } else if (typeof texture.colorSpace !== 'undefined' && THREE.LinearSRGBColorSpace) {
                texture.colorSpace = THREE.LinearSRGBColorSpace;
            } else if (typeof texture.encoding !== 'undefined' && THREE.LinearEncoding) {
                texture.encoding = THREE.LinearEncoding;
            }
            if (typeof THREE.RepeatWrapping !== 'undefined') {
                if (typeof texture.wrapS !== 'undefined') {
                    texture.wrapS = THREE.RepeatWrapping;
                }
                if (typeof texture.wrapT !== 'undefined') {
                    texture.wrapT = THREE.RepeatWrapping;
                }
            }
            if (Number.isFinite(this._maxAnisotropy) && this._maxAnisotropy > 1 && typeof texture.anisotropy === 'number') {
                texture.anisotropy = this._maxAnisotropy;
            }
            if (forceUpdate) {
                const image = texture.image || texture.source?.data || null;
                const hasDimensions = image && typeof image === 'object'
                    && (typeof image.width === 'number' || typeof image.height === 'number')
                    && (image.width > 0 || image.height > 0);
                const hasArrayData = (image && typeof image === 'object' && 'data' in image && image.data)
                    || (typeof ArrayBuffer !== 'undefined' && image && ArrayBuffer.isView && ArrayBuffer.isView(image));
                if (hasDimensions || hasArrayData) {
                    texture.needsUpdate = true;
                }
            }
        }

        _acquireTexture(url, slot) {
            if (!url) {
                return null;
            }
            if (!this._textureLoader) {
                if (typeof THREE.TextureLoader === 'function') {
                    this._textureLoader = new THREE.TextureLoader();
                } else {
                    return null;
                }
            }
            if (!this._textureCache) {
                this._textureCache = new Map();
            }
            if (this._textureCache.has(url)) {
                const existing = this._textureCache.get(url);
                if (existing) {
                    existing.refCount = (existing.refCount || 0) + 1;
                    if (existing.texture) {
                        this._configureTextureForSlot(existing.texture, slot);
                        return existing.texture;
                    }
                }
            }

            try {
                const texture = this._textureLoader.load(
                    url,
                    (loadedTexture) => {
                        try {
                            const resolvedTexture = loadedTexture || texture;
                            this._configureTextureForSlot(resolvedTexture, slot);
                            this.render();
                        } catch (renderError) {
                            console.warn('Texture load render update failed:', renderError);
                        }
                    },
                    undefined,
                    (error) => {
                        console.warn('Failed to load texture for star material:', url, error);
                        if (this._textureCache && this._textureCache.has(url)) {
                            const record = this._textureCache.get(url);
                            if (record && record.texture && typeof record.texture.dispose === 'function') {
                                record.texture.dispose();
                            }
                            this._textureCache.delete(url);
                        }
                    }
                );
                this._configureTextureForSlot(texture, slot, { forceUpdate: false });
                this._textureCache.set(url, { texture, refCount: 1 });
                return texture;
            } catch (loadError) {
                console.warn('Texture load threw an exception for URL:', url, loadError);
            }
            return null;
        }

        _releaseTexture(url) {
            if (!url || !this._textureCache || !this._textureCache.has(url)) {
                return;
            }
            const record = this._textureCache.get(url);
            if (!record) {
                return;
            }
            record.refCount = (record.refCount || 0) - 1;
            if (record.refCount <= 0) {
                if (record.texture && typeof record.texture.dispose === 'function') {
                    record.texture.dispose();
                }
                this._textureCache.delete(url);
            }
        }

        _syncMaterialTextures(mesh, assignments = {}) {
            if (!mesh || !mesh.material) {
                return;
            }
            const mapProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
            const userData = mesh.userData || (mesh.userData = {});
            const previous = userData.assignedTextureUrls || {};
            const nextAssignments = {};

            mapProps.forEach((prop) => {
                const prevUrl = typeof previous[prop] === 'string' ? previous[prop] : null;
                const nextUrl = typeof assignments[prop] === 'string' ? assignments[prop] : null;
                if (prevUrl && prevUrl !== nextUrl) {
                    this._releaseTexture(prevUrl);
                }
                if (nextUrl) {
                    if (prevUrl === nextUrl && mesh.material[prop]) {
                        nextAssignments[prop] = nextUrl;
                        this._configureTextureForSlot(mesh.material[prop], prop);
                    } else {
                        const texture = this._acquireTexture(nextUrl, prop);
                        if (texture) {
                            nextAssignments[prop] = nextUrl;
                            mesh.material[prop] = texture;
                        } else {
                            mesh.material[prop] = null;
                        }
                    }
                } else {
                    mesh.material[prop] = null;
                }
            });

            userData.assignedTextureUrls = nextAssignments;
            mesh.material.needsUpdate = true;
        }

        _applyTextureLayers(mesh, recipe) {
            if (!mesh || !mesh.material) {
                return null;
            }
            const material = mesh.material;
            const assignments = {};
            const influence = {
                map: 0,
                normalMap: 0,
                roughnessMap: 0,
                metalnessMap: 0,
                emissiveMap: 0
            };

            if (recipe && recipe.maps) {
                const maps = recipe.maps;
                const mapProps = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
                mapProps.forEach((prop) => {
                    const mapInfo = maps[prop];
                    if (!mapInfo || !Array.isArray(mapInfo.entries) || !mapInfo.entries.length) {
                        return;
                    }
                    const primary = mapInfo.entries[0];
                    if (!primary || typeof primary.url !== 'string' || !primary.url.length) {
                        return;
                    }
                    assignments[prop] = primary.url;
                    influence[prop] = Math.max(0, Number(mapInfo.totalWeight) || 0);
                });

                this._syncMaterialTextures(mesh, assignments);

                material.userData = Object.assign({}, material.userData, {
                    textureLayers: maps,
                    blendMasks: Array.isArray(maps.blendMasks) ? maps.blendMasks.slice() : [],
                    textureInfluence: influence
                });
                return influence;
            }

            this._syncMaterialTextures(mesh, {});
            if (material.userData) {
                material.userData = Object.assign({}, material.userData);
                material.userData.textureInfluence = influence;
                delete material.userData.textureLayers;
                delete material.userData.blendMasks;
            } else {
                material.userData = { textureInfluence: influence };
            }
            return influence;
        }

        async _applyStarMaterial(mesh, status) {
            const originalMaterial = mesh.material;
            if (!originalMaterial) {
                return;
            }

            const descriptor = StarMixer && typeof StarMixer.generateStarMaterial === 'function'
                ? StarMixer.generateStarMaterial({
                    galaxyName: mesh.userData?.galaxy,
                    constellationName: mesh.userData?.constellation,
                    starSystemName: mesh.userData?.starSystem,
                    starName: mesh.userData?.star,
                    starData: mesh.userData?.data,
                    status
                })
                : null;

            const applyLegacyMaterial = (mixerResult) => {
                const material = mesh.material;
                if (!material) {
                    return;
                }
                const defaultColor = STATUS_COLORS[status] || STATUS_COLORS.locked;
                let baseColorHex = defaultColor;
                let highlightHex = null;
                let emissiveHex = defaultColor;
                let emissiveIntensity = status === 'unlocked'
                    ? 0.65
                    : status === 'available'
                        ? 0.38
                        : 0.26;
                let roughness = Number.isFinite(material.roughness) ? material.roughness : 0.32;
                let metalness = Number.isFinite(material.metalness) ? material.metalness : 0.18;
                let recipeFromMixer = null;

                if (mixerResult && mixerResult.colors && mixerResult.recipe) {
                    baseColorHex = mixerResult.colors.albedo ?? baseColorHex;
                    highlightHex = mixerResult.colors.highlight ?? null;
                    emissiveHex = mixerResult.colors.emissive ?? emissiveHex;
                    if (Number.isFinite(mixerResult.colors.emissiveIntensity)) {
                        emissiveIntensity = mixerResult.colors.emissiveIntensity;
                    }

                    const categoryWeights = {};
                    mixerResult.recipe.ingredients.forEach((ingredient) => {
                        if (!ingredient || !ingredient.category) {
                            return;
                        }
                        const weight = Number.isFinite(ingredient.weight) ? ingredient.weight : 0;
                        if (weight <= 0) {
                            return;
                        }
                        categoryWeights[ingredient.category] = (categoryWeights[ingredient.category] || 0) + weight;
                    });

                    if (categoryWeights.metals) {
                        metalness += categoryWeights.metals * 0.42;
                        roughness -= categoryWeights.metals * 0.18;
                    }
                    if (categoryWeights.minerals) {
                        metalness += categoryWeights.minerals * 0.18;
                        roughness += categoryWeights.minerals * 0.12;
                    }
                    if (categoryWeights.organics) {
                        roughness += categoryWeights.organics * 0.25;
                    }
                    if (categoryWeights.gases) {
                        roughness -= categoryWeights.gases * 0.22;
                        emissiveIntensity += categoryWeights.gases * 0.18;
                    }
                    if (categoryWeights.other) {
                        emissiveIntensity += categoryWeights.other * 0.24;
                        highlightHex = highlightHex || emissiveHex;
                    }

                    recipeFromMixer = mixerResult.recipe;
                }

                const previousRecipe = mesh.userData?.materialRecipe || null;
                const effectiveRecipe = recipeFromMixer || previousRecipe || null;
                const textureInfluence = this._applyTextureLayers(mesh, effectiveRecipe) || {};
                mesh.userData.materialRecipe = effectiveRecipe;

                const roughnessInfluence = clamp(Number(textureInfluence.roughnessMap) || 0, 0, 1);
                const metalnessInfluence = clamp(Number(textureInfluence.metalnessMap) || 0, 0, 1);
                const emissiveInfluence = clamp(Number(textureInfluence.emissiveMap) || 0, 0, 1);
                const normalInfluence = clamp(Number(textureInfluence.normalMap) || 0, 0, 1);
                const blendMaskInfluence = effectiveRecipe && effectiveRecipe.maps && Array.isArray(effectiveRecipe.maps.blendMasks)
                    ? effectiveRecipe.maps.blendMasks.reduce((sum, entry) => sum + (Number(entry.weight) || 0), 0)
                    : 0;

                if (roughnessInfluence > 0) {
                    roughness = clamp(roughness * (0.7 + roughnessInfluence * 0.45), 0.05, 1);
                }
                if (metalnessInfluence > 0) {
                    metalness = clamp(metalness * (0.65 + metalnessInfluence * 0.5), 0.02, 1);
                }
                if (normalInfluence > 0) {
                    roughness = clamp(roughness * (0.9 - normalInfluence * 0.25), 0.05, 1);
                }
                if (emissiveInfluence > 0) {
                    emissiveIntensity = clamp(emissiveIntensity * (0.78 + emissiveInfluence * 0.65), 0.05, 2.1);
                }
                if (blendMaskInfluence > 0) {
                    emissiveIntensity += blendMaskInfluence * 0.08;
                }

                roughness = clamp(roughness, 0.12, 0.85);
                metalness = clamp(metalness, 0.05, 0.95);
                emissiveIntensity = clamp(emissiveIntensity, 0.15, 1.1);

                const baseColor = ensureColorInstance(baseColorHex, defaultColor);
                if (status === 'available' && highlightHex !== null) {
                    baseColor.lerp(ensureColorInstance(highlightHex, baseColorHex), 0.25);
                } else if (status === 'unlocked') {
                    baseColor.lerp(new THREE.Color(0xffffff), 0.12);
                } else {
                    baseColor.lerp(new THREE.Color(0x06080d), 0.38);
                }
                material.color.copy(baseColor);

                const emissiveColor = ensureColorInstance(emissiveHex, defaultColor);
                if (status === 'locked') {
                    emissiveColor.lerp(baseColor, 0.7);
                    emissiveIntensity = Math.min(emissiveIntensity, 0.32);
                }
                material.emissive.copy(emissiveColor);
                material.emissiveIntensity = emissiveIntensity;
                material.roughness = roughness;
                material.metalness = metalness;
                mesh.userData = Object.assign({}, mesh.userData, { usesPBR: false });
                this._updateDiagnostics();
            };

            const texturesApi = global.CVTextures || (typeof window !== 'undefined' ? window.CVTextures : null);
            if (!texturesApi || !descriptor) {
                applyLegacyMaterial(descriptor);
                return;
            }

            const availableMapKeys = descriptor.maps
                ? Object.keys(descriptor.maps).filter((key) => descriptor.maps[key] && descriptor.maps[key].url)
                : [];
            if (!availableMapKeys.length) {
                applyLegacyMaterial(descriptor);
                return;
            }

            try {
                const m = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(descriptor.color || '#ffffff'),
                    emissive: new THREE.Color(descriptor.emissive || '#000000'),
                    roughness: ('roughness' in descriptor) ? descriptor.roughness : 0.8,
                    metalness: ('metalness' in descriptor) ? descriptor.metalness : 0.0
                });
                if (typeof descriptor.emissiveIntensity === 'number') {
                    m.emissiveIntensity = descriptor.emissiveIntensity;
                }

                const maps = descriptor.maps || {};
                const loadMap = async (slot, key) => {
                    const d = maps[key];
                    if (!d || !d.url) {
                        return;
                    }
                    const tex = await texturesApi.getTexture(d.url, {
                        srgb: !!d.srgb,
                        repeat: Array.isArray(d.repeat) ? d.repeat : undefined,
                        offset: Array.isArray(d.offset) ? d.offset : undefined
                    });
                    if (!tex) {
                        return;
                    }
                    m[slot] = tex;
                    if (key === 'normal' && Array.isArray(d.normalScale)) {
                        m.normalScale = new THREE.Vector2(d.normalScale[0], d.normalScale[1]);
                    }
                    if (key === 'emissive' && typeof d.intensity === 'number') {
                        m.emissiveIntensity = d.intensity;
                    }
                };

                await Promise.all([
                    loadMap('map', 'albedo'),
                    loadMap('normalMap', 'normal'),
                    loadMap('roughnessMap', 'roughness'),
                    loadMap('metalnessMap', 'metalness'),
                    loadMap('aoMap', 'ao'),
                    loadMap('emissiveMap', 'emissive')
                ]);

                const compositeMask = async (baseTex, noiseLayers) => {
                    if (!baseTex || !noiseLayers || !noiseLayers.length) {
                        return null;
                    }
                    const img = baseTex.image;
                    const W = (img && img.width) || 1024;
                    const H = (img && img.height) || 1024;
                    if (!W || !H) {
                        return null;
                    }
                    const cvs = document.createElement('canvas');
                    cvs.width = W;
                    cvs.height = H;
                    const ctx = cvs.getContext('2d');
                    if (!ctx) {
                        return null;
                    }
                    if (img) {
                        ctx.drawImage(img, 0, 0, W, H);
                    }
                    for (const layer of noiseLayers) {
                        if (!layer || !layer.url) {
                            continue;
                        }
                        const mask = await new Promise((resolve, reject) => {
                            const im = new Image();
                            im.crossOrigin = 'anonymous';
                            im.onload = () => resolve(im);
                            im.onerror = reject;
                            im.src = layer.url;
                        }).catch(() => null);
                        if (!mask) {
                            continue;
                        }
                        ctx.globalCompositeOperation = (layer.mode === 'screen') ? 'screen' : 'multiply';
                        ctx.globalAlpha = (typeof layer.amount === 'number') ? layer.amount : 0.5;
                        ctx.drawImage(mask, 0, 0, W, H);
                    }
                    ctx.globalCompositeOperation = 'source-over';
                    ctx.globalAlpha = 1;
                    const out = new THREE.CanvasTexture(cvs);
                    if (baseTex.colorSpace) {
                        out.colorSpace = baseTex.colorSpace;
                    }
                    if (typeof baseTex.wrapS !== 'undefined') {
                        out.wrapS = baseTex.wrapS;
                    }
                    if (typeof baseTex.wrapT !== 'undefined') {
                        out.wrapT = baseTex.wrapT;
                    }
                    if (baseTex.repeat && out.repeat) {
                        out.repeat.copy(baseTex.repeat);
                    }
                    if (baseTex.offset && out.offset) {
                        out.offset.copy(baseTex.offset);
                    }
                    if (typeof baseTex.anisotropy === 'number') {
                        out.anisotropy = baseTex.anisotropy;
                    }
                    out.needsUpdate = true;
                    return out;
                };

                const noiseLayers = Array.isArray(descriptor.noise) ? descriptor.noise.filter((layer) => layer && layer.url) : null;
                if (noiseLayers && (m.map || m.emissiveMap)) {
                    if (m.map) {
                        const cm = await compositeMask(m.map, noiseLayers);
                        if (cm) {
                            m.map = cm;
                        }
                    }
                    if (m.emissiveMap) {
                        const cm = await compositeMask(m.emissiveMap, noiseLayers);
                        if (cm) {
                            m.emissiveMap = cm;
                        }
                    }
                }
                if (!m.map && !m.normalMap && !m.roughnessMap && !m.metalnessMap && !m.aoMap && !m.emissiveMap) {
                    m.dispose();
                    applyLegacyMaterial(descriptor);
                    return;
                }

                mesh.userData.materialRecipe = descriptor.recipe || null;
                if (originalMaterial && typeof originalMaterial.dispose === 'function') {
                    originalMaterial.dispose();
                }
                mesh.material = m;
                mesh.material.needsUpdate = true;
                mesh.userData = Object.assign({}, mesh.userData, { usesPBR: true });
                this._updateDiagnostics();
            } catch (err) {
                applyLegacyMaterial(descriptor);
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

        nudgeOrbit(deltaAzimuth = 0, deltaPolar = 0) {
            if (!this.controls || !this.camera) {
                return;
            }

            this._cancelTween();

            const target = this.controls.target.clone();
            const offset = this.camera.position.clone().sub(target);
            if (!offset.lengthSq()) {
                return;
            }

            const spherical = new THREE.Spherical();
            spherical.setFromVector3(offset);

            const epsilon = 0.001;
            const minPolar = typeof this.controls.minPolarAngle === 'number'
                ? this.controls.minPolarAngle + epsilon
                : epsilon;
            const maxPolar = typeof this.controls.maxPolarAngle === 'number'
                ? this.controls.maxPolarAngle - epsilon
                : Math.PI - epsilon;

            spherical.theta += Number.isFinite(deltaAzimuth) ? deltaAzimuth : 0;
            spherical.phi = clamp(
                spherical.phi + (Number.isFinite(deltaPolar) ? deltaPolar : 0),
                Math.max(epsilon, minPolar),
                Math.min(Math.PI - epsilon, maxPolar)
            );

            offset.setFromSpherical(spherical);
            this.camera.position.copy(target.clone().add(offset));

            if (typeof this.controls.update === 'function') {
                this.controls.update();
            }

            this.render();
        }

        resetOrbit() {
            if (!this.controls || !this.camera) {
                return;
            }

            this._cancelTween();

            const target = this.controls.target.clone();
            const currentOffset = this.camera.position.clone().sub(target);
            const currentRadius = currentOffset.length();
            const level = CAMERA_LEVELS[this.currentView] || CAMERA_LEVELS.galaxies;
            const defaultVector = new THREE.Vector3(0, level.height, level.distance);
            if (!defaultVector.lengthSq()) {
                defaultVector.set(0, level.height || 1, level.distance || 1);
            }

            const minRadius = Math.max(1, this.controls.minDistance || 1);
            const maxRadius = this.controls.maxDistance && Number.isFinite(this.controls.maxDistance)
                ? this.controls.maxDistance
                : currentRadius || defaultVector.length();
            const baselineRadius = defaultVector.length() || minRadius;
            const targetRadius = clamp(
                Number.isFinite(currentRadius) && currentRadius > 0 ? currentRadius : baselineRadius,
                minRadius,
                Math.max(minRadius, maxRadius)
            );

            const direction = defaultVector.clone().normalize().multiplyScalar(targetRadius);
            this.camera.position.copy(target.clone().add(direction));

            if (typeof this.controls.update === 'function') {
                this.controls.update();
            }

            this.render();
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
            const passivePointerOptions = { passive: true };
            domElement.addEventListener('pointermove', (event) => this._onPointerMove(event), passivePointerOptions);
            domElement.addEventListener('pointerdown', (event) => this._onPointerDown(event), passivePointerOptions);
            domElement.addEventListener('pointerup', (event) => this._onPointerUp(event), passivePointerOptions);
            domElement.addEventListener('pointercancel', (event) => this._onPointerCancel(event), passivePointerOptions);
            domElement.addEventListener('click', (event) => this._onClick(event));
            domElement.addEventListener('keydown', (event) => this._onKeyDown(event));
            domElement.addEventListener('contextmenu', (event) => {
                event.preventDefault();
            });
        }

        _onPointerDown(event) {
            if (event.pointerType === 'touch') {
                this.activeTouchPointers.add(event.pointerId);
                if (!event.isPrimary || this.activeTouchPointers.size > 1) {
                    this.pointerDownInfo = null;
                    return;
                }
            } else {
                this.activeTouchPointers.clear();
                const isPrimary = event.isPrimary !== false;
                const button = typeof event.button === 'number' ? event.button : 0;
                const isLeftClick = button === 0;
                if (!isPrimary || !isLeftClick) {
                    this.pointerDownInfo = null;
                    return;
                }
            }
            this.pointerDownInfo = {
                x: event.clientX,
                y: event.clientY,
                time: performance.now(),
                pointerId: event.pointerId,
                pointerType: event.pointerType || 'mouse',
                button: typeof event.button === 'number' ? event.button : 0
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
            if (downInfo.pointerType === 'mouse' && downInfo.button !== 0) {
                this.pointerDownInfo = null;
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

        _onKeyDown(event) {
            if (!event) {
                return;
            }

            const targetElement = this.renderer?.domElement || null;
            if (!targetElement || event.target !== targetElement) {
                return;
            }

            const azimuthStep = Math.PI / 24; // ~7.5° per tap
            const polarStep = Math.PI / 40; // ~4.5° per tap
            let handled = false;

            switch (event.key) {
                case 'ArrowLeft':
                    this.nudgeOrbit(-azimuthStep, 0);
                    handled = true;
                    break;
                case 'ArrowRight':
                    this.nudgeOrbit(azimuthStep, 0);
                    handled = true;
                    break;
                case 'ArrowUp':
                    this.nudgeOrbit(0, -polarStep);
                    handled = true;
                    break;
                case 'ArrowDown':
                    this.nudgeOrbit(0, polarStep);
                    handled = true;
                    break;
                case 'Home':
                    this.resetOrbit();
                    handled = true;
                    break;
                default:
                    break;
            }

            if (handled) {
                event.preventDefault();
            }
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

            const delta = this._clock ? this._clock.getDelta() : 0;
            const elapsedTime = this._clock ? this._clock.elapsedTime : 0;

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
            this._updateLights(elapsedTime);

            if (this.starfieldGroup) {
                this.starfieldGroup.rotation.y += delta * 0.0025;
            }
            if (this._farStars) {
                this._farStars.rotation.y -= delta * 0.0012;
            }
            if (this._midStars) {
                this._midStars.rotation.y += delta * 0.0016;
            }
            if (this._fogPoints) {
                this._fogPoints.rotation.y += delta * 0.0009;
            }
            if (Array.isArray(this._nebulaPlanes) && this._nebulaPlanes.length) {
                this._nebulaPlanes.forEach((plane) => {
                    if (!plane || !plane.userData || !plane.userData.baseRotation) {
                        return;
                    }
                    const phase = plane.userData.wobblePhase || 0;
                    const speed = plane.userData.wobbleSpeed || 0.04;
                    const base = plane.userData.baseRotation;
                    plane.rotation.x = base.x + Math.sin(elapsedTime * speed + phase) * 0.05;
                    plane.rotation.y = base.y + Math.cos(elapsedTime * speed * 0.8 + phase * 0.5) * 0.04;
                    plane.rotation.z = base.z + Math.sin(elapsedTime * speed * 0.65 + phase * 1.2) * 0.03;
                });
            }

            this._updateGalaxyLabels();
            this._maybeAutoAdjustView();

            if (this._composer && this._glRenderer) {
                if (this._nebulaLayer && typeof this._nebulaLayer.update === 'function') {
                    this._nebulaLayer.update(delta);
                }
                const spritePoints = this._spriteStars;
                if (spritePoints && spritePoints.geometry) {
                    const attribute = spritePoints.userData ? spritePoints.userData._sizeAttribute : null;
                    const base = spritePoints.userData ? spritePoints.userData._baseSizes : null;
                    if (attribute && base) {
                        const timeSource = (typeof performance !== 'undefined' && typeof performance.now === 'function')
                            ? performance.now() * 0.001
                            : elapsedTime;
                        const scale = spritePoints.userData._sizeScale || 1;
                        const safeScale = scale === 0 ? 1 : scale;
                        for (let i = 0; i < attribute.count; i += 1) {
                            const wobble = 0.85 + (0.15 * Math.sin((timeSource * 1.3) + (i * 3.7)));
                            attribute.array[i] = (base[i] * wobble) / safeScale;
                        }
                        attribute.needsUpdate = true;
                    }
                }
                this._composer.render(delta);
            } else {
                this.render(delta);
            }
        }

        async _setDefaultEnvironment() {
            const fetchFn = typeof global.fetch === 'function' ? global.fetch.bind(global) : (typeof fetch === 'function' ? fetch : null);
            if (!fetchFn || !global.CVTextures || typeof global.CVTextures.getEnvironmentFromHDR !== 'function' || !this.scene) {
                return;
            }
            try {
                const res = await fetchFn('assets/skill-universe/ingredient-library.json', { cache: 'no-store' });
                if (!res || !res.ok) {
                    return;
                }
                const lib = await res.json();
                if (!Array.isArray(lib)) {
                    return;
                }
                const neb = lib.find((e) => e && e.type === 'nebula' && e.maps && e.maps.environment && /\.hdr$/i.test(e.maps.environment));
                if (!neb) {
                    return;
                }
                const hdrUrl = neb.maps.environment;
                const envTex = await global.CVTextures.getEnvironmentFromHDR(hdrUrl);
                if (envTex) {
                    this._environmentName = hdrUrl;
                    this.scene.environment = envTex;
                }
            } catch (err) {
                if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                    console.warn('[SkillUniverse] Environment HDR load skipped:', err);
                }
            }
        }

        async _setDefaultEnvironment() {
            const fetchFn = typeof global.fetch === 'function' ? global.fetch.bind(global) : (typeof fetch === 'function' ? fetch : null);
            if (!fetchFn || !global.CVTextures || typeof global.CVTextures.getEnvironmentFromHDR !== 'function' || !this.scene) {
                return;
            }
            try {
                const res = await fetchFn('assets/skill-universe/ingredient-library.json', { cache: 'no-store' });
                if (!res || !res.ok) {
                    return;
                }
                const lib = await res.json();
                if (!Array.isArray(lib)) {
                    return;
                }
                const neb = lib.find((e) => e && e.type === 'nebula' && e.maps && e.maps.environment && /\.hdr$/i.test(e.maps.environment));
                if (!neb) {
                    return;
                }
                const hdrUrl = neb.maps.environment;
                const envTex = await global.CVTextures.getEnvironmentFromHDR(hdrUrl);
                if (envTex) {
                    this._environmentName = hdrUrl;
                    this.scene.environment = envTex;
                }
            } catch (err) {
                if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                    console.warn('[SkillUniverse] Environment HDR load skipped:', err);
                }
            }
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

    SkillUniverseRenderer.VERSION = '2024.06.24';

    if (typeof console !== 'undefined' && console.info) {
        const lerpExists = !!(THREE && THREE.Color && THREE.Color.prototype && typeof THREE.Color.prototype.lerp === 'function');
        console.info('SkillUniverseRenderer', SkillUniverseRenderer.VERSION, 'Color.lerp available:', lerpExists);
    }
    global.SkillUniverseRenderer = SkillUniverseRenderer;
})(typeof window !== 'undefined' ? window : this);

(function(global) {
    'use strict';

    if (!global || typeof global.THREE === 'undefined') {
        console.error('SkillUniverseRenderer requires Three.js to be loaded before this script.');
        return;
    }

    const THREE = global.THREE;

    const CAMERA_LEVELS = {
        galaxies: { distance: 900, height: 260, duration: 900 },
        constellations: { distance: 520, height: 200, duration: 900 },
        stars: { distance: 260, height: 120, duration: 900 }
    };

    const STATUS_COLORS = {
        unlocked: 0x00b894,
        available: 0xffc048,
        locked: 0x4b4b4b
    };

    const GALAXY_RADIUS = 360;
    const CONSTELLATION_RADIUS = 140;
    const STAR_SYSTEM_RADIUS = 48;

    const LABEL_DEFAULTS = {
        fontSize: 48,
        padding: 18,
        scale: 1.0
    };

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

    function lerpVectors(start, end, t) {
        return start.clone().lerp(end, t);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
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
            this.scene.fog = new THREE.FogExp2(0x050505, 0.0012);

            const { width, height } = this._getContainerSize();
            this.camera = new THREE.PerspectiveCamera(55, width / height, 1, 4000);
            this.camera.position.set(0, 240, 820);
            this.cameraTarget = new THREE.Vector3(0, 0, 0);

            this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            this.renderer.outputEncoding = THREE.sRGBEncoding;
            this.renderer.setSize(width, height, false);
            this.renderer.setPixelRatio(global.devicePixelRatio || 1);
            this.renderer.setClearColor(0x000000, 0);
            this.container.innerHTML = '';
            this.container.appendChild(this.renderer.domElement);
            this.renderer.domElement.setAttribute('tabindex', '0');

            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.08;
            this.controls.screenSpacePanning = true;
            this.controls.minDistance = 120;
            this.controls.maxDistance = 1600;
            this.controls.enablePan = true;
            this.controls.enableZoom = true;
            this.controls.enableRotate = true;
            this.controls.addEventListener('start', () => this._cancelTween());
            this.controls.addEventListener('change', () => this.render());

            this.raycaster = new THREE.Raycaster();
            this.pointer = new THREE.Vector2();

            this.rootGroup = new THREE.Group();
            this.scene.add(this.rootGroup);

            this.galaxyMap = new Map();
            this.constellationMap = new Map();
            this.starMeshMap = new Map();
            this.pickableObjects = [];

            this.hoveredObject = null;
            this.activeHighlight = null;
            this.tweenState = null;
            this.pointerDownInfo = null;

            this.currentView = 'galaxies';
            this.currentSelection = { galaxy: null, constellation: null, star: null };

            this._setupLights();
            this._buildUniverse();
            this._bindEvents();
            this._updateViewUI();
            this._animate = this._animate.bind(this);
            this._animate();
        }

        refreshStars() {
            const skillTree = this.getSkillTree() || {};
            this.starMeshMap.forEach((mesh, key) => {
                const parts = key.split('|');
                if (parts.length !== 3) {
                    return;
                }
                const [galaxyName, constellationName, starName] = parts;
                const starData = skillTree?.[galaxyName]?.constellations?.[constellationName]?.stars?.[starName];
                const status = this.resolveStarStatus(starName, starData, galaxyName, constellationName) || 'locked';
                mesh.userData.status = status;
                this._applyStarMaterial(mesh, status);
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

            if (type === 'galaxy') {
                this._focusGalaxy(path.galaxy);
                return true;
            }

            const constellationKey = `${path.galaxy}|${path.constellation}`;
            if (type === 'constellation') {
                if (!this.constellationMap.has(constellationKey)) {
                    return false;
                }
                this._focusConstellation(path.galaxy, path.constellation);
                return true;
            }

            if (type === 'star') {
                const starKey = `${path.galaxy}|${path.constellation}|${path.star}`;
                const starMesh = this.starMeshMap.get(starKey);
                if (!starMesh) {
                    return false;
                }
                this._focusStar(path.galaxy, path.constellation, path.star);
                return true;
            }

            return false;
        }

        goBack() {
            if (this.currentView === 'stars' && this.currentSelection.galaxy) {
                this._focusConstellation(this.currentSelection.galaxy, this.currentSelection.constellation || null);
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
            this.controls.dispose();
            this.renderer.dispose();
            this.container.innerHTML = '';
            this.pickableObjects.length = 0;
            this.galaxyMap.clear();
            this.constellationMap.clear();
            this.starMeshMap.clear();
        }

        _setupLights() {
            const ambient = new THREE.AmbientLight(0x9fb3ff, 0.35);
            this.scene.add(ambient);

            const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
            keyLight.position.set(400, 500, 200);
            this.scene.add(keyLight);

            const rimLight = new THREE.PointLight(0x3b3bff, 0.6, 2000);
            rimLight.position.set(-500, -200, -400);
            this.scene.add(rimLight);
        }

        _buildUniverse() {
            this._clearUniverse();
            const skillTree = this.getSkillTree() || {};
            const galaxyNames = Object.keys(skillTree);
            if (!galaxyNames.length) {
                return;
            }

            galaxyNames.forEach((galaxyName, index) => {
                const galaxyData = skillTree[galaxyName] || {};
                const angle = (index / galaxyNames.length) * Math.PI * 2;
                const x = Math.cos(angle) * GALAXY_RADIUS;
                const z = Math.sin(angle) * GALAXY_RADIUS;

                const group = new THREE.Group();
                group.name = `galaxy-${galaxyName}`;
                group.position.set(x, 0, z);

                const mesh = new THREE.Mesh(
                    new THREE.SphereGeometry(28, 48, 48),
                    new THREE.MeshStandardMaterial({
                        color: 0x6c5ce7,
                        emissive: 0x241563,
                        emissiveIntensity: 0.6,
                        roughness: 0.2,
                        metalness: 0.1,
                        transparent: true,
                        opacity: 0.95
                    })
                );
                mesh.userData = { type: 'galaxy', galaxy: galaxyName };
                mesh.userData.originalScale = mesh.scale.clone();
                group.add(mesh);
                this.pickableObjects.push(mesh);

                const halo = new THREE.Mesh(
                    new THREE.RingGeometry(36, 40, 64),
                    new THREE.MeshBasicMaterial({ color: 0x8069ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
                );
                halo.rotation.x = Math.PI / 2;
                group.add(halo);

                const label = createLabelSprite(galaxyName, { scale: 0.9 });
                label.position.set(0, 52, 0);
                group.add(label);

                const orbitGroup = new THREE.Group();
                orbitGroup.name = `constellations-${galaxyName}`;
                group.add(orbitGroup);

                this.rootGroup.add(group);

                const galaxyInfo = {
                    group,
                    mesh,
                    orbitGroup,
                    constellationNames: []
                };

                const constellations = galaxyData.constellations || {};
                const constellationNames = Object.keys(constellations);
                galaxyInfo.constellationNames = constellationNames;

                constellationNames.forEach((constellationName, cIndex) => {
                    const constellationData = constellations[constellationName] || {};
                    const cAngle = (cIndex / Math.max(constellationNames.length, 1)) * Math.PI * 2;
                    const cGroup = new THREE.Group();
                    cGroup.name = `constellation-${constellationName}`;
                    cGroup.position.set(
                        Math.cos(cAngle) * CONSTELLATION_RADIUS,
                        Math.sin(cAngle * 2) * 14,
                        Math.sin(cAngle) * CONSTELLATION_RADIUS
                    );

                    const cMesh = new THREE.Mesh(
                        new THREE.IcosahedronGeometry(14, 1),
                        new THREE.MeshStandardMaterial({
                            color: 0x45aaf2,
                            emissive: 0x0f3054,
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

                    const starEntries = Object.entries(constellationData.stars || {});
                    starEntries.forEach(([starName, starData], sIndex) => {
                        const sAngle = (sIndex / Math.max(starEntries.length, 1)) * Math.PI * 2;
                        const systemGroup = new THREE.Group();
                        systemGroup.name = `system-${starName}`;
                        systemGroup.position.set(
                            Math.cos(sAngle) * STAR_SYSTEM_RADIUS,
                            Math.sin(sAngle) * 12,
                            Math.sin(sAngle) * STAR_SYSTEM_RADIUS
                        );

                        const orbit = new THREE.Mesh(
                            new THREE.RingGeometry(10, 11.2, 32),
                            new THREE.MeshBasicMaterial({
                                color: 0xffffff,
                                transparent: true,
                                opacity: 0.2,
                                side: THREE.DoubleSide
                            })
                        );
                        orbit.rotation.x = Math.PI / 2;
                        systemGroup.add(orbit);

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
                        const status = this.resolveStarStatus(starName, starData, galaxyName, constellationName) || 'locked';
                        starMesh.userData = {
                            type: 'star',
                            galaxy: galaxyName,
                            constellation: constellationName,
                            star: starName,
                            data: starData,
                            status
                        };
                        starMesh.userData.originalScale = starMesh.scale.clone();
                        this._applyStarMaterial(starMesh, status);
                        systemGroup.add(starMesh);
                        this.pickableObjects.push(starMesh);

                        const starLabel = createLabelSprite(starName, { scale: 0.4 });
                        starLabel.position.set(0, 18, 0);
                        systemGroup.add(starLabel);

                        starOrbit.add(systemGroup);

                        const starKey = `${galaxyName}|${constellationName}|${starName}`;
                        this.starMeshMap.set(starKey, starMesh);
                    });

                    const constellationKey = `${galaxyName}|${constellationName}`;
                    this.constellationMap.set(constellationKey, {
                        group: cGroup,
                        mesh: cMesh,
                        starOrbit
                    });
                });

                this.galaxyMap.set(galaxyName, {
                    group,
                    mesh,
                    orbitGroup
                });
            });
        }

        _clearUniverse() {
            while (this.rootGroup.children.length) {
                const child = this.rootGroup.children.pop();
                this.rootGroup.remove(child);
            }
            this.pickableObjects = [];
            this.galaxyMap.clear();
            this.constellationMap.clear();
            this.starMeshMap.clear();
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

        _focusUniverse() {
            this.currentView = 'galaxies';
            this.currentSelection = { galaxy: null, constellation: null, star: null };
            this._setHighlight(null, null);
            this._tweenCameraTo(new THREE.Vector3(0, 0, 0), CAMERA_LEVELS.galaxies);
            this._updateViewUI();
        }

        _focusGalaxy(galaxyName) {
            const galaxyInfo = this.galaxyMap.get(galaxyName);
            if (!galaxyInfo) {
                return;
            }
            this.currentView = 'constellations';
            this.currentSelection = { galaxy: galaxyName, constellation: null, star: null };
            this._setHighlight(galaxyInfo.mesh, 'galaxy');
            this._tweenCameraTo(this._getWorldPosition(galaxyInfo.group), CAMERA_LEVELS.constellations);
            this._updateViewUI();
        }

        _focusConstellation(galaxyName, constellationName) {
            const constellationInfo = this.constellationMap.get(`${galaxyName}|${constellationName}`);
            if (!constellationInfo) {
                this._focusGalaxy(galaxyName);
                return;
            }
            this.currentView = 'constellations';
            this.currentSelection = { galaxy: galaxyName, constellation: constellationName, star: null };
            this._setHighlight(constellationInfo.mesh, 'constellation');
            this._tweenCameraTo(this._getWorldPosition(constellationInfo.group), CAMERA_LEVELS.constellations);
            this._updateViewUI();
        }

        _focusStar(galaxyName, constellationName, starName) {
            const starMesh = this.starMeshMap.get(`${galaxyName}|${constellationName}|${starName}`);
            if (!starMesh) {
                this._focusConstellation(galaxyName, constellationName);
                return;
            }
            this.currentView = 'stars';
            this.currentSelection = { galaxy: galaxyName, constellation: constellationName, star: starName };
            this._setHighlight(starMesh, 'star');
            this._tweenCameraTo(this._getWorldPosition(starMesh), CAMERA_LEVELS.stars);
            this._updateViewUI();
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

            const scaleMultiplier = type === 'star' ? 1.6 : type === 'constellation' ? 1.3 : 1.2;
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
            domElement.addEventListener('click', (event) => this._onClick(event));
        }

        _onPointerDown(event) {
            this.pointerDownInfo = {
                x: event.clientX,
                y: event.clientY,
                time: performance.now()
            };
        }

        _onPointerUp(event) {
            if (!this.pointerDownInfo) {
                return;
            }
            const distance = Math.hypot(event.clientX - this.pointerDownInfo.x, event.clientY - this.pointerDownInfo.y);
            const elapsed = performance.now() - this.pointerDownInfo.time;
            if (distance < 6 && elapsed < 400) {
                this._handleSelection(event);
            }
            this.pointerDownInfo = null;
        }

        _onClick(event) {
            // Prevent default click bubbling for navigation when we already handled pointerup
            event.preventDefault();
        }

        _onPointerMove(event) {
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
                const hoverMultiplier = object.userData.type === 'star' ? 1.4 : 1.2;
                const baseMultiplier = object.userData.highlightMultiplier || 1;
                this._applyScaledSize(object, hoverMultiplier * baseMultiplier);
                this.container.style.cursor = 'pointer';
                if (this.onHoverStar && object.userData.type === 'star') {
                    const { star, galaxy, constellation, data, status } = object.userData;
                    this.onHoverStar({
                        name: star,
                        galaxy,
                        constellation,
                        data,
                        status
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
            } else if (data.type === 'star') {
                this._focusStar(data.galaxy, data.constellation, data.star);
                if (this.onSelectStar) {
                    const starInfo = {
                        name: data.star,
                        galaxy: data.galaxy,
                        constellation: data.constellation,
                        data: data.data,
                        status: data.status
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

            const worldDirection = targetPosition.clone().normalize();
            if (worldDirection.length() === 0) {
                worldDirection.set(0, 0, 1);
            }

            const offsetDirection = worldDirection.clone().negate().normalize();
            if (offsetDirection.length() === 0) {
                offsetDirection.set(0, 0, 1);
            }

            const endPosition = targetPosition.clone().add(offsetDirection.multiplyScalar(distance));
            endPosition.y += height;

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
            this.render();
        }

        _updateViewUI() {
            if (!this.onViewChange) {
                return;
            }
            const { galaxy, constellation } = this.currentSelection;
            if (this.currentView === 'galaxies') {
                this.onViewChange({
                    view: 'galaxies',
                    title: 'Skill Galaxies',
                    breadcrumbs: ['Galaxies'],
                    showBack: false
                });
            } else if (this.currentView === 'constellations') {
                const title = constellation || galaxy || 'Constellations';
                const crumbs = ['Galaxies'];
                if (galaxy) {
                    crumbs.push(galaxy);
                }
                if (constellation) {
                    crumbs.push(constellation);
                }
                this.onViewChange({
                    view: 'constellations',
                    title,
                    breadcrumbs: crumbs,
                    showBack: true
                });
            } else if (this.currentView === 'stars') {
                const crumbs = ['Galaxies'];
                if (galaxy) {
                    crumbs.push(galaxy);
                }
                if (constellation) {
                    crumbs.push(constellation);
                }
                this.onViewChange({
                    view: 'stars',
                    title: constellation || 'Star Systems',
                    breadcrumbs: crumbs,
                    showBack: true
                });
            }
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

    global.SkillUniverseRenderer = SkillUniverseRenderer;
})(typeof window !== 'undefined' ? window : this);

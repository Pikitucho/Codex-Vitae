(function(global) {
    const root = global || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {}));
    const THREE = root && root.THREE ? root.THREE : null;

    class NebulaLayer {
        constructor(scene, options = {}) {
            this.scene = scene;
            this.opts = Object.assign({ layers: 3, intensity: 0.7, scroll: [0.002, 0.0012, 0.0007] }, options);
            this._meshes = [];
            this._time = 0;
        }

        async initFromManifest(manifestUrl = 'assets/skill-universe/ingredient-library.json') {
            const fetchFn = (root && typeof root.fetch === 'function')
                ? root.fetch.bind(root)
                : (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
            if (!fetchFn || !this.scene || !THREE || !root || !root.CVTextures || typeof root.CVTextures.getTexture !== 'function') {
                return;
            }
            try {
                const res = await fetchFn(manifestUrl, { cache: 'no-store' });
                if (!res) {
                    return;
                }
                const lib = await res.json();
                const plates = Array.isArray(lib)
                    ? lib.filter((entry) => entry && entry.type === 'nebula' && entry.maps && (entry.maps.plate || entry.maps.environment))
                    : [];
                if (!plates.length) {
                    return;
                }
                const pick = plates.slice(0, this.opts.layers);
                for (let i = 0; i < pick.length; i += 1) {
                    const nebula = pick[i];
                    const url = nebula && nebula.maps ? nebula.maps.plate : null;
                    if (!url) {
                        continue;
                    }
                    let texture = null;
                    try {
                        texture = await root.CVTextures.getTexture(url, { srgb: true, repeat: [1, 1] });
                    } catch (textureError) {
                        texture = null;
                    }
                    if (!texture) {
                        continue;
                    }
                    if (typeof texture.wrapS !== 'undefined' && typeof texture.wrapT !== 'undefined' && typeof THREE.MirroredRepeatWrapping !== 'undefined') {
                        texture.wrapS = THREE.MirroredRepeatWrapping;
                        texture.wrapT = THREE.MirroredRepeatWrapping;
                    }
                    const material = new THREE.MeshBasicMaterial({
                        map: texture,
                        transparent: true,
                        opacity: this.opts.intensity,
                        depthWrite: false,
                        blending: typeof THREE.AdditiveBlending !== 'undefined' ? THREE.AdditiveBlending : undefined
                    });
                    material.toneMapped = true;
                    const geometry = new THREE.PlaneGeometry(1, 1);
                    const mesh = new THREE.Mesh(geometry, material);
                    const scale = 80000 * (1 + (i * 0.35));
                    mesh.position.set(0, 0, -20000 - (i * 5000));
                    mesh.scale.set(scale, scale, 1);
                    mesh.renderOrder = -10;
                    this.scene.add(mesh);
                    this._meshes.push({ mesh, speed: this.opts.scroll[i % this.opts.scroll.length] || 0 });
                }
            } catch (error) {
                if (typeof console !== 'undefined' && typeof console.warn === 'function') {
                    console.warn('[NebulaLayer] init skipped:', error);
                }
            }
        }

        update(dt) {
            const delta = Number.isFinite(dt) ? dt : 0;
            this._time += delta;
            for (let i = 0; i < this._meshes.length; i += 1) {
                const entry = this._meshes[i];
                if (!entry || !entry.mesh || !entry.mesh.material) {
                    continue;
                }
                const map = entry.mesh.material.map;
                if (!map) {
                    continue;
                }
                const speed = entry.speed || 0;
                map.offset.x = (map.offset.x + speed * delta) % 1;
                map.offset.y = (map.offset.y + speed * 0.61 * delta) % 1;
                map.needsUpdate = true;
            }
        }

        setIntensity(value) {
            const opacity = Number.isFinite(value) ? value : this.opts.intensity;
            for (let i = 0; i < this._meshes.length; i += 1) {
                const meshEntry = this._meshes[i];
                if (!meshEntry || !meshEntry.mesh || !meshEntry.mesh.material) {
                    continue;
                }
                meshEntry.mesh.material.opacity = opacity;
            }
        }

        dispose() {
            for (let i = 0; i < this._meshes.length; i += 1) {
                const entry = this._meshes[i];
                if (!entry || !entry.mesh) {
                    continue;
                }
                if (this.scene && typeof this.scene.remove === 'function') {
                    this.scene.remove(entry.mesh);
                }
                const material = entry.mesh.material;
                const geometry = entry.mesh.geometry;
                if (material) {
                    if (material.map && typeof material.map.dispose === 'function') {
                        material.map.dispose();
                    }
                    if (typeof material.dispose === 'function') {
                        material.dispose();
                    }
                }
                if (geometry && typeof geometry.dispose === 'function') {
                    geometry.dispose();
                }
            }
            this._meshes.length = 0;
        }
    }

    if (root) {
        root.NebulaLayer = NebulaLayer;
    }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

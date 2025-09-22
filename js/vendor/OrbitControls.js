(function(global){
    'use strict';

    const scope = global || (typeof window !== 'undefined' ? window : this);
    const THREE = scope && scope.THREE;
    if (!THREE) {
        throw new Error('OrbitControls requires THREE to be available on the global scope.');
    }

    const STATE = {
        NONE: -1,
        ROTATE: 0,
        PAN: 1
    };

    class OrbitControls extends THREE.EventDispatcher {
        constructor(object, domElement) {
            super();
            if (!object) {
                throw new Error('OrbitControls requires a camera object.');
            }
            this.object = object;
            this.domElement = domElement || (scope.document && scope.document.body) || null;
            if (!this.domElement) {
                throw new Error('OrbitControls requires a DOM element.');
            }

            this.enabled = true;
            this.enableDamping = false;
            this.dampingFactor = 0.05;
            this.enableZoom = true;
            this.zoomSpeed = 1.0;
            this.enableRotate = true;
            this.rotateSpeed = 0.8;
            this.enablePan = true;
            this.panSpeed = 1.0;
            this.screenSpacePanning = true;
            this.minDistance = 0;
            this.maxDistance = Infinity;
            this.minPolarAngle = 0;
            this.maxPolarAngle = Math.PI;
            this.minAzimuthAngle = -Infinity;
            this.maxAzimuthAngle = Infinity;

            this.target = new THREE.Vector3();

            this._state = STATE.NONE;
            this._spherical = new THREE.Spherical();
            this._sphericalDelta = new THREE.Spherical(0, 0, 0);
            this._scale = 1;
            this._panOffset = new THREE.Vector3();
            this._lastPosition = new THREE.Vector3();
            this._lastTarget = new THREE.Vector3();
            this._pointer = new THREE.Vector2();
            this._startPointer = new THREE.Vector2();

            this._onContextMenu = this._onContextMenu.bind(this);
            this._onMouseDown = this._onMouseDown.bind(this);
            this._onMouseMove = this._onMouseMove.bind(this);
            this._onMouseUp = this._onMouseUp.bind(this);
            this._onMouseWheel = this._onMouseWheel.bind(this);

            this.domElement.style.touchAction = this.domElement.style.touchAction || 'none';
            this.domElement.addEventListener('contextmenu', this._onContextMenu);
            this.domElement.addEventListener('mousedown', this._onMouseDown);
            this.domElement.addEventListener('wheel', this._onMouseWheel, { passive: false });
        }

        dispose() {
            if (!this.domElement) {
                return;
            }
            this.domElement.removeEventListener('contextmenu', this._onContextMenu);
            this.domElement.removeEventListener('mousedown', this._onMouseDown);
            this.domElement.removeEventListener('wheel', this._onMouseWheel);
            const doc = this.domElement.ownerDocument || scope.document;
            if (doc) {
                doc.removeEventListener('mousemove', this._onMouseMove);
                doc.removeEventListener('mouseup', this._onMouseUp);
            }
        }

        _onContextMenu(event) {
            event.preventDefault();
        }

        _onMouseDown(event) {
            if (!this.enabled) {
                return;
            }
            event.preventDefault();
            if (event.button === 0) {
                this._state = event.shiftKey ? STATE.PAN : STATE.ROTATE;
            } else if (event.button === 2) {
                this._state = STATE.PAN;
            } else {
                return;
            }
            this._startPointer.set(event.clientX, event.clientY);
            const doc = this.domElement.ownerDocument || scope.document;
            if (doc) {
                doc.addEventListener('mousemove', this._onMouseMove);
                doc.addEventListener('mouseup', this._onMouseUp);
            }
            this.dispatchEvent({ type: 'start' });
        }

        _onMouseMove(event) {
            if (!this.enabled || this._state === STATE.NONE) {
                return;
            }
            event.preventDefault();
            this._pointer.set(event.clientX, event.clientY);
            const deltaX = this._pointer.x - this._startPointer.x;
            const deltaY = this._pointer.y - this._startPointer.y;
            if (this._state === STATE.ROTATE && this.enableRotate) {
                this._handleRotate(deltaX, deltaY);
            } else if (this._state === STATE.PAN && this.enablePan) {
                this._handlePan(deltaX, deltaY);
            }
            this._startPointer.copy(this._pointer);
            this.dispatchEvent({ type: 'change' });
        }

        _onMouseUp(event) {
            event.preventDefault();
            this._state = STATE.NONE;
            const doc = this.domElement.ownerDocument || scope.document;
            if (doc) {
                doc.removeEventListener('mousemove', this._onMouseMove);
                doc.removeEventListener('mouseup', this._onMouseUp);
            }
            this.dispatchEvent({ type: 'end' });
        }

        _onMouseWheel(event) {
            if (!this.enabled || !this.enableZoom) {
                return;
            }
            event.preventDefault();
            const delta = event.deltaY;
            if (delta > 0) {
                this._dollyIn(Math.pow(0.95, this.zoomSpeed));
            } else if (delta < 0) {
                this._dollyOut(Math.pow(0.95, this.zoomSpeed));
            }
            this.dispatchEvent({ type: 'change' });
        }

        _handleRotate(deltaX, deltaY) {
            const element = this.domElement;
            const rotateDeltaTheta = (2 * Math.PI * deltaX / element.clientHeight) * this.rotateSpeed;
            const rotateDeltaPhi = (2 * Math.PI * deltaY / element.clientHeight) * this.rotateSpeed;
            this._sphericalDelta.theta -= rotateDeltaTheta;
            this._sphericalDelta.phi -= rotateDeltaPhi;
        }

        _handlePan(deltaX, deltaY) {
            const element = this.domElement;
            const offset = this.object.position.clone().sub(this.target);
            const targetDistance = offset.length();
            const fov = this.object.fov || 50;
            const distance = targetDistance * Math.tan((fov * Math.PI / 180) / 2);
            const panX = (2 * deltaX * distance / element.clientHeight) * this.panSpeed;
            const panY = (2 * deltaY * distance / element.clientHeight) * this.panSpeed;
            const forward = offset.clone().normalize().negate();
            const right = forward.clone().cross(this.object.up).normalize();
            if (right.lengthSq() === 0) {
                right.set(1, 0, 0);
            }
            if (this.screenSpacePanning) {
                this._panOffset.addScaledVector(right, -panX);
                const up = this.object.up.clone().normalize();
                this._panOffset.addScaledVector(up, panY);
            } else {
                const up = right.clone().cross(forward).normalize();
                this._panOffset.addScaledVector(right, -panX);
                this._panOffset.addScaledVector(up, panY);
            }
        }

        _dollyIn(scale) {
            this._scale /= scale;
        }

        _dollyOut(scale) {
            this._scale *= scale;
        }

        update() {
            this.object.__controlTarget = this.target;
            if (!this.enabled) {
                this._sphericalDelta.theta = 0;
                this._sphericalDelta.phi = 0;
                this._panOffset.set(0, 0, 0);
                this._scale = 1;
                return false;
            }
            const offset = this.object.position.clone().sub(this.target);
            this._spherical.setFromVector3(offset);

            this._spherical.theta += this._sphericalDelta.theta;
            this._spherical.phi += this._sphericalDelta.phi;
            this._spherical.makeSafe();

            this._spherical.theta = THREE.MathUtils.clamp(this._spherical.theta, this.minAzimuthAngle, this.maxAzimuthAngle);
            this._spherical.phi = THREE.MathUtils.clamp(this._spherical.phi, this.minPolarAngle, this.maxPolarAngle);

            this._spherical.radius *= this._scale;
            this._spherical.radius = THREE.MathUtils.clamp(this._spherical.radius, this.minDistance, this.maxDistance);

            this.target.add(this._panOffset);

            const sinPhiRadius = Math.sin(this._spherical.phi) * this._spherical.radius;
            const cosPhiRadius = Math.cos(this._spherical.phi) * this._spherical.radius;

            this.object.position.set(
                this.target.x + sinPhiRadius * Math.sin(this._spherical.theta),
                this.target.y + cosPhiRadius,
                this.target.z + sinPhiRadius * Math.cos(this._spherical.theta)
            );

            this.object.__controlTarget = this.target;

            if (this.enableDamping) {
                this._sphericalDelta.theta *= (1 - this.dampingFactor);
                this._sphericalDelta.phi *= (1 - this.dampingFactor);
                this._panOffset.multiplyScalar(1 - this.dampingFactor);
            } else {
                this._sphericalDelta.theta = 0;
                this._sphericalDelta.phi = 0;
                this._panOffset.set(0, 0, 0);
            }
            this._scale = 1;

            const positionChanged = this._lastPosition.distanceToSquared(this.object.position) > 1e-7;
            const targetChanged = this._lastTarget.distanceToSquared(this.target) > 1e-7;
            if (positionChanged || targetChanged) {
                this._lastPosition.copy(this.object.position);
                this._lastTarget.copy(this.target);
                return true;
            }
            return false;
        }
    }

    THREE.OrbitControls = OrbitControls;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

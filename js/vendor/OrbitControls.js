(function(global){
    const scope = global || (typeof window !== 'undefined' ? window : this);
    const THREE = scope && scope.THREE;
    if(!THREE){
        throw new Error('OrbitControls requires THREE to be available on the global scope.');
    }
    if(THREE.OrbitControls && THREE.OrbitControls.__CODEx_STUB__){
        return;
    }

    class OrbitControls extends THREE.EventDispatcher {
        constructor(object, domElement){
            super();
            this.object = object;
            this.domElement = domElement || (scope.document && scope.document.body) || null;

            this.enabled = true;
            this.enableDamping = false;
            this.dampingFactor = 0.05;
            this.screenSpacePanning = true;
            this.minDistance = 0;
            this.maxDistance = Infinity;
            this.enablePan = true;
            this.enableZoom = true;
            this.enableRotate = true;
            this.target = new THREE.Vector3();

            this._onPointerDown = () => {
                if(!this.enabled){
                    return;
                }
                this.dispatchEvent({ type: 'start' });
            };

            this._onPointerUp = () => {
                if(!this.enabled){
                    return;
                }
                this.dispatchEvent({ type: 'end' });
            };

            this._onPointerMove = () => {
                if(!this.enabled){
                    return;
                }
                this.dispatchEvent({ type: 'change' });
            };

            if(this.domElement && this.domElement.addEventListener){
                this.domElement.addEventListener('pointerdown', this._onPointerDown);
                this.domElement.addEventListener('pointerup', this._onPointerUp);
                this.domElement.addEventListener('pointermove', this._onPointerMove);
            }
        }

        update(){
            if(!this.enabled){
                return false;
            }
            return false;
        }

        dispose(){
            if(this.domElement && this.domElement.removeEventListener){
                this.domElement.removeEventListener('pointerdown', this._onPointerDown);
                this.domElement.removeEventListener('pointerup', this._onPointerUp);
                this.domElement.removeEventListener('pointermove', this._onPointerMove);
            }
            this.dispatchEvent({ type: 'dispose' });
        }
    }

    OrbitControls.__CODEx_STUB__ = true;

    THREE.OrbitControls = OrbitControls;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

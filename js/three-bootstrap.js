import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

const existingThree = typeof window.THREE === 'object' && window.THREE !== null
    ? window.THREE
    : null;

if (existingThree && existingThree !== THREE) {
    const revisionsDiffer = existingThree.REVISION && existingThree.REVISION !== THREE.REVISION;
    if (revisionsDiffer && typeof console !== 'undefined' && console.warn) {
        console.warn(
            'Codex Vitae: Replacing previously loaded Three.js revision %s with %s to avoid duplicates.',
            existingThree.REVISION,
            THREE.REVISION
        );
    }
}

window.THREE = THREE;
THREE.OrbitControls = OrbitControls;

const addons = Object.freeze({
    EffectComposer,
    RenderPass,
    UnrealBloomPass,
    ShaderPass,
    RGBELoader
});

window.__THREE_ADDONS__ = addons;

window.dispatchEvent(new CustomEvent('three-ready', { detail: { THREE, addons } }));

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const existingThree = typeof window.THREE === 'object' && window.THREE !== null
    ? window.THREE
    : {};

Object.assign(existingThree, THREE);
existingThree.OrbitControls = OrbitControls;

window.THREE = existingThree;
window.dispatchEvent(new CustomEvent('three-ready', { detail: { THREE: existingThree } }));

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js?module';

const existingThree = typeof window.THREE === 'object' && window.THREE !== null
    ? window.THREE
    : {};

Object.assign(existingThree, THREE);
existingThree.OrbitControls = OrbitControls;

window.THREE = existingThree;
window.dispatchEvent(new CustomEvent('three-ready', { detail: { THREE: existingThree } }));

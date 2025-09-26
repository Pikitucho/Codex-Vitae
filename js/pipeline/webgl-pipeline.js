import { EffectComposer } from 'https://unpkg.com/three@0.160/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://unpkg.com/three@0.160/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'https://unpkg.com/three@0.160/examples/jsm/postprocessing/ShaderPass.js';
import { RGBELoader } from 'https://unpkg.com/three@0.160/examples/jsm/loaders/RGBELoader.js';

window.CVPipeline = Object.assign(window.CVPipeline || {}, {
  EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, RGBELoader,
  createComposer(renderer, scene, camera, { bloom = true, grade = false } = {}) {
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    if (bloom) {
      const pass = new UnrealBloomPass(undefined, 0.9, 0.4, 0.8);
      composer.addPass(pass);
    }
    return composer;
  }
});

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

window.CVPipeline = Object.assign(window.CVPipeline || {}, {
  EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, RGBELoader,
  createComposer(renderer, scene, camera, { bloom = true, grade = true } = {}) {
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    if (bloom) {
      const pass = new UnrealBloomPass(undefined, 0.9, 0.4, 0.8);
      composer.addPass(pass);
      composer.__bloom = pass;
    }

    if (grade && window.CVGradeShader) {
      const gradePass = new ShaderPass(window.CVGradeShader);
      const originalSetSize = composer.setSize.bind(composer);
      composer.setSize = function setSize(w, h) {
        originalSetSize(w, h);
        if (gradePass.uniforms?.uResolution?.value?.set) {
          gradePass.uniforms.uResolution.value.set(w, h);
        }
      };
      if (gradePass.uniforms?.uResolution?.value) {
        if (typeof renderer.getSize === 'function') {
          renderer.getSize(gradePass.uniforms.uResolution.value);
        } else if (renderer.domElement) {
          gradePass.uniforms.uResolution.value.set(
            renderer.domElement.width || renderer.domElement.clientWidth || 1,
            renderer.domElement.height || renderer.domElement.clientHeight || 1
          );
        }
      }
      composer.addPass(gradePass);
      composer.__grade = gradePass;
    }

    composer.__renderPass = renderPass;
    return composer;
  }
});

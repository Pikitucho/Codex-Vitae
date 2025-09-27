import { EffectComposer } from 'https://unpkg.com/three@0.160/examples/jsm/postprocessing/EffectComposer.js?module';
import { RenderPass } from 'https://unpkg.com/three@0.160/examples/jsm/postprocessing/RenderPass.js?module';
import { UnrealBloomPass } from 'https://unpkg.com/three@0.160/examples/jsm/postprocessing/UnrealBloomPass.js?module';
import { ShaderPass } from 'https://unpkg.com/three@0.160/examples/jsm/postprocessing/ShaderPass.js?module';
import { RGBELoader } from 'https://unpkg.com/three@0.160/examples/jsm/loaders/RGBELoader.js?module';

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

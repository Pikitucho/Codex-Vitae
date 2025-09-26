(function(){
  const CVGradeShader = {
    uniforms: {
      tDiffuse: { value: null },
      uLift:    { value: new THREE.Vector3(0.00, 0.00, 0.00) },
      uGamma:   { value: new THREE.Vector3(1.00, 1.00, 1.00) },
      uGain:    { value: new THREE.Vector3(1.05, 1.05, 1.08) }, // slight pop
      uVignetteStrength: { value: 0.18 },
      uCAStrength: { value: 0.005 }, // very subtle
      uResolution: { value: new THREE.Vector2(1,1) }
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tDiffuse;
      uniform vec3 uLift, uGamma, uGain;
      uniform float uVignetteStrength, uCAStrength;
      uniform vec2 uResolution;

      vec3 liftGammaGain(vec3 c, vec3 lift, vec3 gamma, vec3 gain){
        c = (c + lift);
        c = pow(max(c, 0.0), 1.0 / max(gamma, vec3(0.001)));
        c = c * gain;
        return c;
      }

      vec3 vignette(vec3 c, vec2 uv, float k){
        if (k <= 0.0) return c;
        vec2 p = uv - 0.5;
        float v = smoothstep(0.9, 0.2, length(p)) * k; // darker toward edges
        return c * (1.0 - v);
      }

      vec3 chromaticAberration(vec2 uv, float s){
        if (s <= 0.0) return texture2D(tDiffuse, uv).rgb;
        vec2 dir = (uv - 0.5);
        vec2 off = dir * s;
        float r = texture2D(tDiffuse, uv + off).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - off).b;
        return vec3(r,g,b);
      }

      void main(){
        vec3 col = chromaticAberration(vUv, uCAStrength);
        col = liftGammaGain(col, uLift, uGamma, uGain);
        col = vignette(col, vUv, uVignetteStrength);
        gl_FragColor = vec4(col, 1.0);
      }
    `
  };
  window.CVGradeShader = CVGradeShader;
})();

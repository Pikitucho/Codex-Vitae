(function(){
  const cache = new Map();
  let pmremGen = null, rendererRef = null, rgbeLoader = null, texLoader = null;

  function key(u,o){ return u+'|'+JSON.stringify(o||{}); }

  window.CVTextures = {
    init(renderer){
      rendererRef = renderer;
      pmremGen = new THREE.PMREMGenerator(renderer);
      pmremGen.compileEquirectangularShader();
      texLoader = texLoader || new THREE.TextureLoader();
      // RGBELoader comes from module island
      rgbeLoader = rgbeLoader || new window.CVPipeline.RGBELoader();
    },
    async getTexture(url, opts={}){
      const k = key(url, opts);
      if (cache.has(k)) return cache.get(k);
      const t = await new Promise((res, rej)=>{
        texLoader.load(url, res, undefined, rej);
      });
      if (opts.srgb) t.colorSpace = THREE.SRGBColorSpace;
      if (opts.flipY !== undefined) t.flipY = opts.flipY;
      if (opts.repeat){ t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
      if (opts.offset){ t.offset.set(opts.offset[0], opts.offset[1]); }
      cache.set(k, t); return t;
    },
    async getHDR(url){
      const k = key(url, {hdr:true});
      if (cache.has(k)) return cache.get(k);
      const tex = await new Promise((res, rej)=>{ rgbeLoader.load(url, res, undefined, rej); });
      cache.set(k, tex); return tex;
    },
    async getEnvironmentFromHDR(url){
      const k = key(url, {env:true});
      if (cache.has(k)) return cache.get(k);
      const hdr = await this.getHDR(url);
      const env = pmremGen.fromEquirectangular(hdr).texture;
      hdr.dispose?.();
      cache.set(k, env); return env;
    }
  };
})();

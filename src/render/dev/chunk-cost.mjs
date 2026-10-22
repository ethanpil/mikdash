// perf-1: single-program compile latency of one lit material under chunk variants (ANGLE/D3D11 FXC cost structure).
//   node src/render/dev/session.mjs src/render/dev/chunk-cost.mjs --q low --out shots/perf-1/wip
// MAT=timber_rough (a ctx.mats key) | MAT=people (a live people figure batch); VARS=full,stockFog,...; REPS=2
// Each variant compiles alone (busted with a unique define) and is polled until linked: the latency of one program
// on one worker thread ≈ what a blocking first draw would cost.
export default async function (h) {
  const vars = (process.env.VARS || 'full,noRooms,stockInt,stockFog,stockTm,stockAll,noMk,full').split(',');
  const reps = +(process.env.REPS || 1);
  const matKey = process.env.MAT || 'timber_rough';
  await h.wait(2000);
  for (let rep = 0; rep < reps; rep++) {
    for (const name of vars) {
      const r = await h.ev(async ([name, matKey, process_env_SRC]) => {
        const c = globalThis.__mikdash, R = c.renderer;
        const THREE = await import('/node_modules/.vite/deps/three.js');
        const SC = THREE.ShaderChunk;
        const ig = await import('/src/env/interiors-glsl.js');
        if (!globalThis.__ccStock) {
          const stock = {};
          for (const k of ['fog_pars_vertex', 'fog_vertex', 'fog_pars_fragment', 'fog_fragment', 'tonemapping_fragment', 'tonemapping_pars_fragment']) {
            stock[k] = (await import(`/node_modules/three/src/renderers/shaders/ShaderChunk/${k}.glsl.js`)).default;
          }
          globalThis.__ccStock = stock;
          globalThis.__ccSaved = Object.fromEntries(Object.keys(stock).map((k) => [k, SC[k]]));
        }
        const stock = globalThis.__ccStock, saved = globalThis.__ccSaved;
        const restore = () => { for (const k of Object.keys(saved)) SC[k] = saved[k]; ig.setInteriorStage(SC, 3); };
        restore();
        let src = null;
        if (matKey === 'people') {
          c.scene.traverse((o) => { if (!src && o.isInstancedMesh && /people-/.test(o.material?.name) && new RegExp(process_env_SRC).test(Object.keys(o.material.defines || {}).join())) src = o; });
          if (!src) return { name, error: 'no people batch' };
        }
        const base = matKey === 'people' ? src.material : c.mats.get(matKey);
        // a twin that shares the original's onBeforeCompile / key (copy() drops them)
        const m = base.clone();
        m.onBeforeCompile = base.onBeforeCompile;
        m.customProgramCacheKey = base.customProgramCacheKey;
        if (base.userData) m.userData = base.userData;
        const tag = `${name}_${Math.random().toString(36).slice(2, 7)}`;
        m.defines = { ...(base.defines || {}), MK_CC: tag };
        if (name === 'noRooms') m.defines.MK_NO_ROOMS = '';
        // def:+A+B-C — add / remove material defines (people pattern groups, LOD switches)
        if (name.startsWith('def:')) for (const t of name.slice(4).match(/[+-][A-Z_]+/g) || []) { if (t[0] === '+') m.defines[t.slice(1)] = ''; else delete m.defines[t.slice(1)]; }
        if (name.startsWith('def:')) { const k = Object.keys(m.defines).sort().join(','); m.customProgramCacheKey = () => `cc:${k}`; }
        if (name === 'stockInt' || name === 'stockAll') ig.setInteriorStage(SC, 0);
        if (name === 'stockFog' || name === 'stockAll') for (const k of ['fog_pars_vertex', 'fog_vertex', 'fog_pars_fragment', 'fog_fragment']) SC[k] = stock[k];
        if (name === 'stockTm' || name === 'stockAll') { SC.tonemapping_fragment = stock.tonemapping_fragment; }
        if (name === 'stockFog') SC.tonemapping_fragment = stock.tonemapping_fragment;
        if (name.startsWith('optOff')) {
          const ob = m.onBeforeCompile;
          m.onBeforeCompile = function (sh, r) { ob?.call(this, sh, r); sh.fragmentShader = `#pragma optimize(off)
${sh.fragmentShader}`; if (name === 'optOffVS') sh.vertexShader = `#pragma optimize(off)
${sh.vertexShader}`; };
          const ok = m.customProgramCacheKey; m.customProgramCacheKey = () => `${ok?.call(m) || ''}|${tag}`;
        }
        if (name === 'noMk') { m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => `nomk${tag}`; }
        const geo = matKey === 'people' ? src.geometry : new THREE.BoxGeometry(1, 1, 1);
        const mesh = matKey === 'people' ? new THREE.InstancedMesh(geo, m, 1) : new THREE.Mesh(geo, m);
        const s = new THREE.Scene();
        s.add(mesh);
        const t0 = performance.now();
        R.compile(s, c.camera, c.scene);
        const prog = R.properties.get(m).currentProgram;
        const fsLen = prog ? 0 : -1;
        await new Promise((res) => { const poll = () => (prog.isReady() ? res() : setTimeout(poll, 5)); poll(); });
        const ms = performance.now() - t0;
        restore();
        return { name, ms: Math.round(ms), fsLen };
      }, [name, matKey, process.env.SRC || 'P_DETAIL']);
      h.log(JSON.stringify(r));
    }
  }
}

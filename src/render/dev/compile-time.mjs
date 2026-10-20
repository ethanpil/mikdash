// render-env-2: compile + first-draw time of every lit material with the stock chunks vs the interior patch, in one
// page (cache busted with a define). VARS=stock,full,noRoomCode,noProbe
//   node src/render/dev/session.mjs src/render/dev/compile-time.mjs --q medium
// variants: string edits on the patched envmap_physical_pars_fragment (each compiles once: ANGLE caches identical HLSL)
const EDITS = {
  noRoomCode: [['#define MK_INT\n', '#define MK_INT\n#define MK_NO_ROOMS\n']],
  noOcc: [['if ( ( ( mkFlags >> 8 ) & 1 ) != 0 ) {', 'if ( false ) {']],
  noAp: [['for ( int k = 0; k < mkNa; k ++ ) {', 'for ( int k = 0; k < 0; k ++ ) {']],
  noProbe: [['int np = min( mkFlags & MK_F_PROBES, 4 );', 'int np = 0;']],
  noPt: [['float mkPtOccL( int i ) {', 'float mkPtOccL( int i ) { return 1.0;']],
  noGrid: [['for ( int k = 0; k < 4; k ++ ) {\n    uint s =', 'for ( int k = 0; k < 1; k ++ ) {\n    uint s =']],
};
export default async function (h) {
  const vars = (process.env.VARS || 'stock,full,stock,full').split(',');
  await h.wait(3000);
  for (const name of vars) {
    const r = await h.ev(async ([name, EDITS]) => {
      const c = globalThis.__mikdash, gl = c.renderer.getContext();
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const mod = await import('/src/env/interiors-glsl.js');
      const SC = THREE.ShaderChunk;
      mod.setInteriorStage(SC, name === 'stock' ? 0 : 3);
      // render-env-2-fix: 'old' = render-env-2's patch (src/render/dev/old-interiors-glsl.js), generated into a copy
      if (name === 'old') {
        const KEYS = ['envmap_physical_pars_fragment', 'lights_fragment_begin', 'lights_fragment_maps'];
        mod.setInteriorStage(SC, 0);
        if (!globalThis.__ctOld) {
          const fake = Object.fromEntries(Object.keys(SC).filter((q) => !q.startsWith('__')).map((q) => [q, SC[q]]));
          const old = await import('/src/render/dev/old-interiors-glsl.js');
          const I = c.env.interiors;
          old.installInteriorChunks(fake, { probes: !!c.env.probes, origin: [I.origin.x, I.origin.y, I.origin.z], records: I.records });
          globalThis.__ctOld = Object.fromEntries(KEYS.map((q) => [q, fake[q]]));
        }
        for (const q of KEYS) SC[q] = globalThis.__ctOld[q];
      }
      if (EDITS[name]) {
        let t = SC.envmap_physical_pars_fragment;
        for (const [a, b] of EDITS[name]) { if (!t.includes(a)) return { name, error: `pattern ${a.slice(0, 40)}` }; t = t.replace(a, b); }
        SC.envmap_physical_pars_fragment = t;
      }
      const k = Math.random().toString(36).slice(2, 7);
      let n = 0;
      c.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (m.isMeshStandardMaterial) { m.defines = { ...(m.defines || {}), MK_CT: k }; m.needsUpdate = true; n++; } } });
      c.engine.stop();
      gl.finish();
      const t0 = performance.now();
      c.renderer.compile(c.scene, c.camera);
      c.engine.renderFn(1 / 60);
      gl.finish();
      const ms = performance.now() - t0;
      c.engine.start(c);
      return { name, ms: Math.round(ms), materials: n, programs: c.renderer.info.programs.length };
    }, [name, EDITS]);
    h.log(JSON.stringify(r));
  }
}

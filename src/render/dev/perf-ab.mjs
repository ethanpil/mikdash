// render-env-2-fix: GPU time of whole shader-chunk variants of the interior patch, alternated in one page (dev only).
//   VIEWS=court,kodesh VARS=full,stock,noDbg,full,stock,noDbg node src/render/dev/session.mjs src/render/dev/perf-ab.mjs --q medium --query fixedres=1
// A variant is a list of [chunk, regex source, replacement] edits on the patched chunks (null = three's stock chunks;
// 'old' = the chunks of src/render/dev/old-interiors-glsl.js when that file exists). Min / quartile of N frames.
const VIEWS = { court: [[238, 385], [200, 0]], facade: [[200, 300], [300, 15]], kodesh: [[136, 330.5], [270, 5]], mount: [[300, 250], [250, 5]], altar: [[190, 360], [140, 6]] };
const E = 'envmap_physical_pars_fragment', B = 'lights_fragment_begin', M = 'lights_fragment_maps';
export const VARIANTS = {
  full: [],
  stock: null,
  old: 'old',
  // the debug outputs dead (their values were live from mkSetup to the end of the shader)
  noDbg: [[E, 'vec3 mkDebugColor\\(\\) \\{', 'vec3 mkDebugColor() { return vec3( 1.0 );']],
  // the room path compiled out for every material
  noRoomCode: [[E, '#define MK_INT\\n', '#define MK_INT\n#define MK_NO_ROOMS\n']],
  // no probe loop
  noProbe: [[E, 'int np = min\\( mkFlags & MK_F_PROBES, \\d+ \\);', 'const int np = 0;']],
  // no fire occluder evaluation
  noOcc: [[E, 'if \\( \\( \\( mkFlags >> 8 \\) & 1 \\) != 0 \\) \\{', 'if ( false ) {']],
  // render-env-2-fix: pieces of the room path removed from the CODE (what their mere presence costs)
  noApCode: [[E, 'for \\( int k = 0; k < na; k \\+\\+ \\) \\{[\\s\\S]*?\\* open \\);\\n  \\}', '']],
  noOccCode: [[E, 'if \\( \\( \\( mkFlags >> 8 \\) & 1 \\) != 0 && mkVap[\\s\\S]*?mkFireOcc\\([^;]*;\\n  \\}', '']],
  noProbeCode: [[E, 'int np = [^;]*;', 'const int np = 0;']],
  // every block read of the room path and the probe loop constant-indexed (cost test only: correct in the Kodesh view,
  // where the camera's room is slot 0 and its apertures come first; wrong elsewhere)
  staticIdx: [
    [E, 'uvec4 GW = mkGrid\\[ gc >> 3 \\];', 'uvec4 GW = mkGrid[ 0 ];'],
    [E, 'uvec4 H = mkVolH\\[ i \\];', 'uvec4 H = mkVolH[ 0 ];'],
    [E, 'int bi = int\\( slot \\+ 0\\.5 \\);', 'const int bi = 0;'],
    [E, 'int bj = int\\( slot2 \\+ 0\\.5 \\);', 'const int bj = 1;'],
    [E, 'if \\( s2 > best \\) \\{ best = s2; bi = bj; A = A2; C = C2; hw = hw2; \\}', 'if ( s2 > best ) { best = s2; A = A2; C = C2; hw = hw2; }'],
    [E, 'for \\( int k = 0; k < na; k \\+\\+ \\) \\{\\n    uvec4 U = mkApU\\[ a0 \\+ k \\];', 'for ( int k = 0; k < 4; k ++ ) {\n    if ( k >= na ) break;\n    uvec4 U = mkApU[ k ];'],
    [E, 'mkVol = float\\( bi \\) \\+ 1\\.0;', 'mkVol = 1.0;'],
    [E, 'for \\( int k = k0; k < np; k \\+\\+ \\) \\{', 'for ( int k = 0; k < 4; k ++ ) {\n    if ( k < k0 || k >= np ) continue;'],
  ],
};
export default async function (h) {
  const views = (process.env.VIEWS || 'court,kodesh').split(',');
  const vars = (process.env.VARS || 'full,stock,noDbg,full,stock,noDbg').split(',');
  const N = +(process.env.FRAMES || 30);
  await h.ev((t) => { const T = globalThis.__mikdash.time; T.pause(true); T.set(T.parse(t)); }, process.env.T || 'n3');
  for (const view of views) {
    const [at, look] = VIEWS[view];
    await h.ev(([a, l]) => { const c = globalThis.__mikdash; c.player.setMode('walk'); c.player.teleport({ at: a }); c.player.setLook(l[0], l[1]); }, [at, look]);
    await h.wait(2500);
    const row = [];
    for (const name of vars) {
      const edits = VARIANTS[name];
      const r = await h.ev(async ([name, edits, N]) => {
        const c = globalThis.__mikdash, gl = c.renderer.getContext();
        const THREE = await import('/node_modules/.vite/deps/three.js');
        const mod = await import('/src/env/interiors-glsl.js');
        const SC = THREE.ShaderChunk;
        const KEYS = ['envmap_physical_pars_fragment', 'lights_fragment_begin', 'lights_fragment_maps'];
        if (!globalThis.__mkBase) { mod.setInteriorStage(SC, 3); globalThis.__mkBase = Object.fromEntries(KEYS.map((k) => [k, SC[k]])); }
        if (globalThis.__mkVar !== name) {
          if (edits === null) mod.setInteriorStage(SC, 0);
          else if (edits === 'old') {
            // the previous patch's chunks, generated into a copy of the stock chunks
            if (!globalThis.__mkOld) {
              mod.setInteriorStage(SC, 0);
              const fake = Object.fromEntries(Object.keys(SC).filter((k) => !k.startsWith("__")).map((k) => [k, SC[k]]));
              const old = await import('/src/render/dev/old-interiors-glsl.js');
              const I = c.env.interiors;
              old.installInteriorChunks(fake, { probes: !!c.env.probes, origin: [I.origin.x, I.origin.y, I.origin.z], records: I.records });
              globalThis.__mkOld = Object.fromEntries(KEYS.map((k) => [k, fake[k]]));
            }
            for (const k of KEYS) SC[k] = globalThis.__mkOld[k];
          } else {
            mod.setInteriorStage(SC, 3);
            for (const k of KEYS) SC[k] = globalThis.__mkBase[k];
            for (const [k, src, rep] of edits) { const re = new RegExp(src); if (!re.test(SC[k])) return { error: `pattern ${src.slice(0, 40)}` }; SC[k] = SC[k].replace(re, rep); }
          }
          globalThis.__mkVar = name;
          const key = Math.random().toString(36).slice(2, 7);
          c.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (m.isMeshStandardMaterial) { m.defines = { ...(m.defines || {}), MK_VAR: key }; m.needsUpdate = true; } } });
          for (let i = 0; i < 40; i++) await new Promise((res) => requestAnimationFrame(res));
        }
        const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        c.engine.stop();
        const res = [];
        for (let i = 0; i < N; i++) {
          for (const u of c.engine.updaters) u.fn(1 / 60, c);
          const q = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, q); c.engine.renderFn(1 / 60); gl.endQuery(ext.TIME_ELAPSED_EXT);
          await new Promise((ok) => { const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ok(); else setTimeout(poll, 4); }; poll(); });
          if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) res.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(q);
        }
        c.engine.start(c);
        res.sort((a, b) => a - b);
        return { min: +res[0].toFixed(1), q1: +res[res.length >> 2].toFixed(1), med: +res[res.length >> 1].toFixed(1) };
      }, [name, edits && edits !== 'old' ? edits : edits, N]);
      row.push(r.error ? `${name}:ERR ${r.error}` : `${name}:${r.min}/${r.q1}/${r.med}`);
      h.log(view, row[row.length - 1]);
    }
    h.log(view, row.join('  '));
  }
}

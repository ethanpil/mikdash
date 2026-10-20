// lighting-polish-fix: GPU time of shader-text variants of the interior patch (string edits on the patched
// envmap_physical_pars_fragment), alternated in one page. VIEWS=court,kodesh VARS=full,stock,noPt,noSetup,...
//   node src/render/dev/session.mjs src/render/dev/perf-var.mjs --q low
const VIEWS = { court: [[238, 385], [200, 0]], facade: [[200, 300], [300, 15]], kodesh: [[136, 330.5], [270, 5]], mount: [[300, 250], [250, 5]] };
const VARIANTS = {
  full: [],
  stock: null,
  noPt: [[/mkPtOcc\( mkPtVol\[ i \]\.xy \)/, '1.0']],
  noSetup: [[/void mkSetup\( vec3 viewPos, vec3 viewN \) \{/, 'void mkSetup( vec3 viewPos, vec3 viewN ) { return;']],
  afterUnion: [[/  mkP = mkIntP;\n  int n = int\( mkP\.x \+ 0\.5 \);/, '  return;\n  mkP = mkIntP;\n  int n = int( mkP.x + 0.5 );']],
  noRoomsLoop: [[/  int n = int\( mkP\.x \+ 0\.5 \);/, '  int n = 0;']],
  // the room path compiled but never taken at run time (the compiler cannot know mkInvW >= 0)
  neverRooms: [[/  if \( any\( lessThan\( mkWorldPos, UA\.xyz \) \) \|\| any\( greaterThan\( mkWorldPos, UB\.xyz \) \) \) return;/, '  if ( mkInvW > - 1.0 ) return;']],
  noProbeCode: [[/  int np = mkFlags & MK_F_PROBES;/, '  const int np = 0;']],
  noSecond: [[/  if \( best < 0\.5 && depth2 > 0\.0 \) \{/, '  if ( false ) {']],
  lite: [
    [/    hit = max\( hit, mkApHit\( mkWorldPos, Rw, rough, AA, AB \) \);/, ''],
    [/  if \( best < 0\.5 && depth2 > 0\.0 \) \{/, '  if ( false ) {'],
    [/  int np = mkFlags & MK_F_PROBES;/, '  const int np = 0;'],
  ],
  neverLite: [
    [/  if \( any\( lessThan\( mkWorldPos, UA\.xyz \) \) \|\| any\( greaterThan\( mkWorldPos, UB\.xyz \) \) \) return;/, '  if ( mkInvW > - 1.0 ) return;'],
    [/    hit = max\( hit, mkApHit\( mkWorldPos, Rw, rough, AA, AB \) \);/, ''],
    [/  if \( best < 0\.5 && depth2 > 0\.0 \) \{/, '  if ( false ) {'],
    [/  int np = mkFlags & MK_F_PROBES;/, '  const int np = 0;'],
  ],
  fastIBL: [[/  mkIrr = vec3\( 0\.0 \); mkRad = vec3\( 0\.0 \);\n/, `  mkIrr = vec3( 0.0 ); mkRad = vec3( 0.0 );
  if ( mkSlot < 0.0 && ( mkFlags & MK_F_PROBES ) == 0 ) {
    mkIrr = envMapIntensity * PI * mkTextureCubeUV( envMap, envMapRotation * Nw, 1.0, 0.0 );
    mkRad = envMapIntensity * mkTextureCubeUV( envMap, envMapRotation * Rw, roughness, 0.0 );
    return;
  }
`]],
};
export default async function (h) {
  const views = (process.env.VIEWS || 'court,kodesh').split(',');
  const vars = (process.env.VARS || 'full,stock,noPt,noSetup,fastIBL,full,stock,noPt,noSetup,fastIBL').split(',');
  await h.ev(() => { const t = globalThis.__mikdash.time; t.pause(true); t.set(t.fromZmani('night', 3)); });
  for (const view of views) {
    const [at, look] = VIEWS[view];
    await h.ev(([a, l]) => { const c = globalThis.__mikdash; c.player.teleport({ at: a }); c.player.setLook(l[0], l[1]); }, [at, look]);
    await h.wait(2500);
    const row = [];
    for (const name of vars) {
      const edits = VARIANTS[name];
      const r = await h.ev(async ([name, edits]) => {
        const c = globalThis.__mikdash, gl = c.renderer.getContext();
        const THREE = await import('/node_modules/.vite/deps/three.js');
        const mod = await import('/src/env/interiors-glsl.js');
        const SC = THREE.ShaderChunk;
        if (!globalThis.__mkBase) { mod.setInteriorStage(SC, 3); globalThis.__mkBase = SC.envmap_physical_pars_fragment; }
        if (globalThis.__mkVar !== name) {
          if (edits === null) mod.setInteriorStage(SC, 0); else {
            mod.setInteriorStage(SC, 3);
            let t = globalThis.__mkBase;
            for (const [src, flags, rep] of edits) { const re = new RegExp(src, flags); if (!re.test(t)) return { error: `pattern ${src.slice(0, 40)}` }; t = t.replace(re, rep); }
            SC.envmap_physical_pars_fragment = t;
          }
          globalThis.__mkVar = name;
          const k = Math.random().toString(36).slice(2, 7);
          c.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (m.isMeshStandardMaterial) { m.defines = { ...(m.defines || {}), MK_VAR: k }; m.needsUpdate = true; } } });
          for (let i = 0; i < 30; i++) await new Promise((res) => requestAnimationFrame(res));
        }
        const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        c.engine.stop();
        const res = [];
        for (let i = 0; i < 30; i++) {
          for (const u of c.engine.updaters) u.fn(1 / 60, c);
          const q = gl.createQuery();
          gl.beginQuery(ext.TIME_ELAPSED_EXT, q); c.engine.renderFn(1 / 60); gl.endQuery(ext.TIME_ELAPSED_EXT);
          await new Promise((ok) => { const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ok(); else setTimeout(poll, 4); }; poll(); });
          if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) res.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(q);
        }
        c.engine.start(c);
        res.sort((a, b) => a - b);
        return { q1: +res[0].toFixed(1), med: +res[res.length >> 2].toFixed(1), pt: c.env.interiors?.uniforms?.view('mkUnionA')[3] };
      }, [name, edits ? edits.map(([re, rep]) => [re.source, re.flags, rep]) : null]);
      row.push(r.error ? `${name}:ERR ${r.error}` : `${name}:${r.q1}/${r.med}`);
    }
    h.log(view, row.join('  '));
  }
}

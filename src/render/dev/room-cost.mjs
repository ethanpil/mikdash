// perf-fix-2: GPU cost of the parts of env's interior room path (string edits on the patched chunk, recompiled via a
// define; the frame timed with timer queries, engine stopped) — what a cheaper low-tier room path could save.
//   VARS=full,noRefHit,noSunHit,noAp,noFill,noOcc,full node src/render/dev/session.mjs src/render/dev/room-cost.mjs --q low --query "at=150,330.5,22&look=270,6&t=n3"
const VARIANTS = {
  full: [],
  stock: null,
  noRefHit: [[/if \( ! ownProbe \) hit = max\( hit, mkApHit\( d, Rw, 0\.05, rough, he, F \) \* w \);/, '']],
  noSunHit: [[/sun = max\( sun, mkApHit\( d, K\.xyz, K\.w, 0\.01, he, F \) \* open \);/, 'sun = 1.0;']],
  noHits: [[/if \( ! ownProbe \) hit = max\( hit, mkApHit\( d, Rw, 0\.05, rough, he, F \) \* w \);/, ''], [/sun = max\( sun, mkApHit\( d, K\.xyz, K\.w, 0\.01, he, F \) \* open \);/, 'sun = 1.0;']],
  noAp: [[/na = min\( na, (\d+) - a0 \);/, 'na = 0;']],
  noFill: [[/if \( mkFill > 0\.0 \) \{/, 'if ( false ) {']],
  noOcc: [[/if \( dot\( N, toL \) > - 0\.1 \* length\( toL \) \) mkOccV0 = mkFireOcc\( O\.xyz, P, bits & 3, 4\.0 \* \( O\.w - ip \) \);/, '']],
  noRoom: [[/  mkRoom\( UA, UB, viewPos, n, rough, P, N \);/, '']],
};
export default async function (h) {
  await h.wait(+(process.env.SETTLE || 8000));
  const order = (process.env.VARS || 'full,noRefHit,noSunHit,noAp,noFill,noOcc,full').split(',');
  for (const name of order) {
    const r = await h.ev(async ([name, edits, k]) => {
      const c = globalThis.__mikdash, gl = c.renderer.getContext();
      const THREE = await import('/node_modules/.vite/deps/three.js');
      const mod = await import('/src/env/interiors-glsl.js');
      const SC = THREE.ShaderChunk;
      if (!globalThis.__mkBase) { mod.setInteriorStage(SC, 3); globalThis.__mkBase = { e: SC.envmap_physical_pars_fragment, b: SC.lights_fragment_begin }; }
      if (edits === null) mod.setInteriorStage(SC, 0); else {
        mod.setInteriorStage(SC, 3);
        let t = globalThis.__mkBase.e, b = globalThis.__mkBase.b;
        for (const [re, rep] of edits) {
          const r2 = new RegExp(re.source, re.flags);
          if (r2.test(t)) t = t.replace(r2, rep); else if (r2.test(b)) b = b.replace(r2, rep); else return { name, error: 'pattern ' + re.source.slice(0, 50) };
        }
        SC.envmap_physical_pars_fragment = t; SC.lights_fragment_begin = b;
      }
      c.scene.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (m.isMeshStandardMaterial) { m.defines = { ...(m.defines || {}), MK_VAR: String(k) }; m.needsUpdate = true; } } });
      for (let i = 0; i < 40; i++) await new Promise((res) => requestAnimationFrame(res));
      await new Promise((res) => setTimeout(res, 1500));
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      c.engine.stop();
      const res = [];
      for (let i = 0; i < 20; i++) {
        for (const u of c.engine.updaters) u.fn(1 / 60, c);
        const q = gl.createQuery();
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q); c.engine.renderFn(1 / 60); gl.endQuery(ext.TIME_ELAPSED_EXT);
        await new Promise((ok) => { const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ok(); else setTimeout(poll, 4); }; poll(); });
        res.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q);
      }
      c.engine.start(c);
      res.sort((a, b) => a - b);
      return { name, min: +res[0].toFixed(2), q1: +res[5].toFixed(2), median: +res[10].toFixed(2) };
    }, [name, VARIANTS[name] ? VARIANTS[name].map(([re, rep]) => [{ source: re.source, flags: re.flags }, rep]) : VARIANTS[name], Math.random().toString(36).slice(2, 7)]);
    h.log(JSON.stringify(r));
  }
}

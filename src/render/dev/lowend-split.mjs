// lowend-visuals: GPU time of a steady frame with the new low / medium features switched off one at a time (one page,
// EXT_disjoint_timer_query_webgl2; interleaved). Not bundled.
//   node src/render/dev/session.mjs src/render/dev/lowend-split.mjs --q low --query "fixedres=1&..."
//   VARS=full,noFxaa,noAO,noShadow,full  (noShadow recompiles every lit program without the key light's map: slow)
export default async function (h) {
  await h.wait(+(process.env.SETTLE || 12000));
  await h.ev(() => globalThis.__mikdash.env.visibility?.aoReady());
  const vars = (process.env.VARS || 'full,noFxaa,noAO,full,noFxaa,noAO,full').split(',');
  const acc = {};
  for (const v of vars) {
    const r = await h.ev(async (v) => {
      const c = globalThis.__mikdash, e = c.engine, gl = c.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) return { v, error: 'no timer query' };
      const undo = [];
      if (v === 'noFxaa' && c.post.pipeline.fxaa) { const f = c.post.pipeline.fxaa; f.enabled = false; undo.push(() => { f.enabled = true; }); }
      if (v === 'fxaaCopy' && c.post.pipeline.fxaa) {
        const f = c.post.pipeline.fxaa, r = f.render;
        f.render = (renderer) => { const t = f.scene.visible; f.scene.visible = false; try { r.call(f, renderer); } finally { f.scene.visible = t; } };
        undo.push(() => { f.render = r; });
      }
      if (v === 'noAO' && c.env.visibility) { const vis = c.env.visibility; vis.aoEnabled = false; vis.snapAO(); undo.push(() => { vis.aoEnabled = true; vis.snapAO(); }); }
      if (v.startsWith('map')) {
        // the key light's map at another size (no recompile: a uniform); the static cache re-renders on the size change
        const k = c.env.keyLight, n = +v.slice(3), prev = k.shadow.mapSize.x;
        const set = (sz) => { k.shadow.mapSize.set(sz, sz); k.shadow.map?.dispose(); k.shadow.map = null; };
        set(n);
        undo.push(() => set(prev));
      }
      if (v === 'noShadow') {
        const k = c.env.keyLight; k.castShadow = false;
        undo.push(() => { k.castShadow = true; });
      }
      await new Promise((r) => setTimeout(r, v === 'noShadow' ? 25000 : 800));
      const gpu = [];
      const rf = e.renderFn;
      let busy = false;
      e.renderFn = (dt) => {
        let q = null;
        if (!busy) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); busy = true; }
        rf(dt);
        if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); busy = false; } else setTimeout(poll, 4); }; setTimeout(poll, 4); }
      };
      await new Promise((r) => setTimeout(r, 5000));
      e.renderFn = rf;
      for (const u of undo) u();
      if (v === 'noShadow') await new Promise((r) => setTimeout(r, 25000));
      gpu.sort((a, b) => a - b);
      return { v, n: gpu.length, median: gpu[Math.floor(gpu.length / 2)], p25: gpu[Math.floor(gpu.length / 4)] };
    }, v);
    (acc[v] ||= []).push(r.median);
    h.log(JSON.stringify({ v: r.v, n: r.n, medianMs: +r.median?.toFixed(2), p25: +r.p25?.toFixed(2), error: r.error }));
  }
  h.log('summary', JSON.stringify(Object.fromEntries(Object.entries(acc).map(([k, a]) => [k, +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2)]))));
}

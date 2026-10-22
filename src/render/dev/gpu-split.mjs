// perf-1: GPU time of a steady frame with parts of it switched off (one page, EXT_disjoint_timer_query_webgl2).
//   node src/render/dev/session.mjs src/render/dev/gpu-split.mjs --q low --query "..."   VARS=full,noPeople,…
export default async function (h) {
  await h.wait(+(process.env.SETTLE || 8000));
  const vars = (process.env.VARS || 'full,noPeople,noFx,noWorld,noShadow,noProbe,lowScale,full').split(',');
  for (const v of vars) {
    const r = await h.ev(async (v) => {
      const c = globalThis.__mikdash, e = c.engine, gl = c.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) return { v, error: 'no timer query' };
      const undo = [];
      const hide = (o) => { if (o && o.visible) { o.visible = false; undo.push(() => { o.visible = true; }); } };
      if (v === 'noPeople') hide(c.people?.root);
      if (v === 'noFx') hide(c.fx?.scene);
      if (v === 'noWorld') hide(c.world);
      if (v === 'noShadow') { const sm = c.renderer.shadowMap; const a = sm.autoUpdate; sm.autoUpdate = false; undo.push(() => { sm.autoUpdate = a; }); }
      if (v === 'noProbe' && c.env?.probes) { const p = c.env.probes, rr = p.render; p.render = () => {}; undo.push(() => { p.render = rr; }); }
      if (v === 'noCache' && c.post.shadowCache) { const sc = c.post.shadowCache; sc.enabled = false; undo.push(() => { sc.enabled = true; }); }
      if (v === 'noPre') { const p = c.post.pipeline.prepass; p.enabled = false; undo.push(() => { p.enabled = true; }); }
      if (v.startsWith('min:')) {
        const pp = await import('/src/render/prepass.js');
        c.world.traverse((o) => o.layers.disable(pp.PREPASS_LAYER));
        pp.markPrepass(c.world, +v.slice(4));
        undo.push(() => { c.world.traverse((o) => o.layers.disable(pp.PREPASS_LAYER)); pp.markPrepass(c.world); });
      }
      if (v === 'lowScale') { c.post.setScale(0.5); undo.push(() => c.post.setScale(null)); }
      if (v.startsWith('hide:')) c.scene.traverse((o) => { if (o.isMesh && new RegExp(v.slice(5)).test(o.material?.name || '')) hide(o); });
      await new Promise((r) => setTimeout(r, 600));
      const gpu = [];
      const rf = e.renderFn;
      let busy = false;
      let cpu = 0, frames = 0;
      e.renderFn = (dt) => {
        const t0 = performance.now();
        let q = null;
        if (!busy) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); busy = true; }
        rf(dt);
        cpu += performance.now() - t0; frames++;
        if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); busy = false; } else setTimeout(poll, 4); }; setTimeout(poll, 4); }
      };
      await new Promise((r) => setTimeout(r, 2500));
      e.renderFn = rf;
      undo.forEach((f) => f());
      gpu.sort((a, b) => a - b);
      return { v, gpuMs: +gpu[gpu.length >> 1].toFixed(1), n: gpu.length, cpuRenderMs: +(cpu / frames).toFixed(2), calls: c.renderer.info.render.calls };
    }, v);
    h.log(JSON.stringify(r));
  }
}

// perf-fix-2: GPU time of a steady low-tier frame with shader features switched off (one page, timer queries),
// interleaved: what the Kodesh's per-pixel cost is made of.
//   node src/render/dev/session.mjs src/render/dev/kodesh-split.mjs --q low --query "at=150,330.5,22&look=270,6&t=n3"
// VARS=full,noRooms,noPt,noPeople,noWorld,full  REPS=2
export default async function (h) {
  await h.wait(+(process.env.SETTLE || 8000));
  const vars = (process.env.VARS || 'full,noRooms,noPt,noPeople,noWorld,full').split(',');
  const reps = +(process.env.REPS || 1);
  for (let rep = 0; rep < reps; rep++) for (const v of vars) {
    const r = await h.ev(async (v) => {
      const c = globalThis.__mikdash, e = c.engine, gl = c.renderer.getContext();
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
      if (!ext) return { v, error: 'no timer query' };
      const undo = [];
      const hide = (o) => { if (o && o.visible) { o.visible = false; undo.push(() => { o.visible = true; }); } };
      const mats = new Set();
      c.world.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => mats.add(m)); });
      const define = (name, val = '') => {
        for (const m of mats) {
          if (!m.isMeshStandardMaterial || (m.defines && name in m.defines)) continue;
          m.defines = { ...(m.defines || {}), [name]: val }; m.needsUpdate = true;
          undo.push(() => { delete m.defines[name]; m.needsUpdate = true; });
        }
      };
      if (v === 'noRooms') define('MK_NO_ROOMS');
      if (v === 'noPt') c.scene.traverse((o) => { if (o.isPointLight) hide(o); });
      if (v === 'noPeople') hide(c.people?.root);
      if (v === 'noWorld') hide(c.world);
      if (v === 'noFx') hide(c.fx?.scene);
      if (v === 'noPre') { const p = c.post.pipeline.prepass; p.enabled = false; undo.push(() => { p.enabled = true; }); }
      if (v.startsWith('hide:')) c.scene.traverse((o) => { if (o.isMesh && new RegExp(v.slice(5)).test(o.material?.name || '')) hide(o); });
      // let recompiles finish
      for (let i = 0; i < 40; i++) await new Promise((r) => requestAnimationFrame(r));
      await new Promise((r) => setTimeout(r, 1500));
      const gpu = [];
      const rf = e.renderFn;
      let busy = false;
      e.renderFn = (dt) => {
        let q = null;
        if (!busy) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); busy = true; }
        rf(dt);
        if (q) { gl.endQuery(ext.TIME_ELAPSED_EXT); const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) { gpu.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q); busy = false; } else setTimeout(poll, 4); }; setTimeout(poll, 4); }
      };
      await new Promise((r) => setTimeout(r, 3000));
      e.renderFn = rf;
      const calls = c.renderer.info.render.calls;
      undo.forEach((f) => f());
      for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
      gpu.sort((a, b) => a - b);
      return { v, gpuMs: +gpu[gpu.length >> 1].toFixed(2), p25: +gpu[gpu.length >> 2].toFixed(2), n: gpu.length, calls };
    }, v);
    h.log(JSON.stringify(r));
  }
}

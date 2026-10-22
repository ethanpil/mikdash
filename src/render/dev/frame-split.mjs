// perf-1: where a steady frame goes — main-thread time per updater and in the render call (CPU submission), against
// the frame interval, and GPU time of the whole frame (EXT_disjoint_timer_query_webgl2 when exposed).
//   node src/render/dev/session.mjs src/render/dev/frame-split.mjs --q low --query "at=230,330.5,16&look=270,4&t=d3"
export default async function (h) {
  await h.wait(+(process.env.SETTLE || 8000));
  const r = await h.ev(async (frames) => {
    const c = globalThis.__mikdash, e = c.engine, gl = c.renderer.getContext();
    const names = new Map([[0, 'time'], [10, 'sim'], [20, 'people'], [30, 'player'], [40, 'env'], [50, 'fx'], [60, 'audio'], [70, 'ui'], [100, 'render']]);
    const acc = new Map();
    const orig = e.updaters.map((u) => u.fn);
    e.updaters.forEach((u, i) => {
      const f = orig[i], k = `${names.get(u.priority) ?? u.priority}#${i}`;
      u.fn = (dt, ctx) => { const t = performance.now(); f(dt, ctx); acc.set(k, (acc.get(k) || 0) + performance.now() - t); };
    });
    const rf = e.renderFn;
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const gpu = [];
    let q = null;
    e.renderFn = (dt) => {
      const t = performance.now();
      if (ext && !q) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q); var mine = q; }
      rf(dt);
      if (mine) { gl.endQuery(ext.TIME_ELAPSED_EXT); const qq = mine; const poll = () => { if (gl.getQueryParameter(qq, gl.QUERY_RESULT_AVAILABLE)) { gpu.push(gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(qq); q = null; } else setTimeout(poll, 5); }; setTimeout(poll, 5); }
      acc.set('render()', (acc.get('render()') || 0) + performance.now() - t);
    };
    const iv = [];
    let last = 0;
    await new Promise((done) => { const tick = (t) => { if (last) iv.push(t - last); last = t; if (iv.length < frames) requestAnimationFrame(tick); else done(); }; requestAnimationFrame(tick); });
    e.renderFn = rf;
    e.updaters.forEach((u, i) => { u.fn = orig[i]; });
    const n = iv.length;
    const mean = iv.reduce((a, b) => a + b, 0) / n;
    const per = [...acc].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(v / n).toFixed(2)}`);
    const cpu = [...acc.values()].reduce((a, b) => a + b, 0) / n;
    gpu.sort((a, b) => a - b);
    return { frameMs: +mean.toFixed(1), cpuMs: +cpu.toFixed(1), gpuMedMs: gpu.length ? +gpu[gpu.length >> 1].toFixed(1) : null, gpuN: gpu.length, per, calls: c.renderer.info.render.calls, scale: c.post.scale };
  }, +(process.env.FRAMES || 120));
  h.log(JSON.stringify(r));
}

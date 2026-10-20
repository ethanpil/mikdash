// GPU time of the full frame (render fn) via EXT_disjoint_timer_query_webgl2, median of N frames
export default async function (h) {
  const r = await h.ev(async () => {
    const c = globalThis.__mikdash, gl = c.renderer.getContext();
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    if (!ext) return { error: 'no timer query' };
    c.engine.stop();
    const res = [];
    for (let i = 0; i < 24; i++) {
      for (const u of c.engine.updaters) u.fn(1 / 60, c);
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      c.engine.renderFn(1 / 60);
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      await new Promise((ok) => { const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ok(); else setTimeout(poll, 5); }; poll(); });
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) res.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
    }
    c.engine.start(c);
    res.sort((a, b) => a - b);
    return { n: res.length, median: +res[res.length >> 1]?.toFixed(2), min: +res[0]?.toFixed(2), calls: c.renderer.info.render.calls };
  });
  h.log(JSON.stringify(r));
}

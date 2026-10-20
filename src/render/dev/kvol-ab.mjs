// GPU time vs number of interior volumes tested per fragment (uniform change only, no recompile)
export default async function (h) {
  const run = (k) => h.ev(async (k) => {
    const c = globalThis.__mikdash, gl = c.renderer.getContext();
    c.env.interiors.maxVolumes = k;
    for (let i = 0; i < 4; i++) await new Promise((res) => requestAnimationFrame(res));
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    c.engine.stop();
    const res = [];
    for (let i = 0; i < 12; i++) {
      for (const u of c.engine.updaters) u.fn(1 / 60, c);
      const q = gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q); c.engine.renderFn(1 / 60); gl.endQuery(ext.TIME_ELAPSED_EXT);
      await new Promise((ok) => { const poll = () => { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) ok(); else setTimeout(poll, 4); }; poll(); });
      res.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6); gl.deleteQuery(q);
    }
    c.engine.start(c);
    res.sort((a, b) => a - b);
    return { k, min: +res[0].toFixed(1), q1: +res[3].toFixed(1), median: +res[6].toFixed(1) };
  }, k);
  for (const k of (process.env.KS || "4,0,4,0,4,0").split(",").map(Number)) h.log(JSON.stringify(await run(k)));
}

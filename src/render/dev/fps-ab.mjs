// perf-1: real frame intervals (rAF) in ONE page with a switch toggled back and forth (the machine's load drifts between
// runs, so only interleaved samples compare). VARS=pre,noPre,pre,noPre,…  SECS per sample (default 4).
//   node src/render/dev/session.mjs src/render/dev/fps-ab.mjs --q low --query "..."
export default async function (h) {
  await h.wait(+(process.env.SETTLE || 9000));
  const secs = +(process.env.SECS || 4);
  const vars = (process.env.VARS || 'pre,noPre,pre,noPre,pre,noPre').split(',');
  const acc = {};
  for (const v of vars) {
    const r = await h.ev(async ([v, secs]) => {
      const c = globalThis.__mikdash;
      // perf-fix-1: VARS may also be cache / noCache (medium's key-light shadow cache, render/shadow-cache.js)
      const p = /cache/i.test(v) ? c.post.shadowCache : c.post.pipeline.prepass;
      p.enabled = v !== 'noPre' && v !== 'noCache';
      await new Promise((r) => setTimeout(r, 500));
      const d = [];
      let last = 0;
      const t0 = performance.now();
      await new Promise((done) => { const f = (t) => { if (last) d.push(t - last); last = t; if (t - t0 < secs * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
      p.enabled = true;
      const statics = c.post.shadowCache?.stats?.statics;
      return { v, statics, meanMs: d.reduce((a, b) => a + b, 0) / d.length, n: d.length };
    }, [v, secs]);
    (acc[r.v] ||= []).push(r.meanMs);
    h.log(JSON.stringify({ v: r.v, statics: r.statics, meanMs: +r.meanMs.toFixed(1), fps: +(1000 / r.meanMs).toFixed(1) }));
  }
  const sum = Object.fromEntries(Object.entries(acc).map(([k, a]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return [k, { meanMs: +m.toFixed(1), fps: +(1000 / m).toFixed(1) }]; }));
  h.log('summary', JSON.stringify(sum));
}

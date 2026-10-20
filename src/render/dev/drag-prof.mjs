// lighting-polish-fix: where does a time-panel drag spend its frames? Wraps every engine updater and the render
// function with timers, drags the clock (time.set every 90 ms, as ui/timepanel.js), and prints the worst frames'
// breakdown plus per-system totals. Run:
//   node src/render/dev/session.mjs src/render/dev/drag-prof.mjs --q medium --query "at=136,330.5&look=270,5&t=d6"
export default async function (h) {
  await h.ev(() => {
    const c = globalThis.__mikdash, e = c.engine;
    const g = (globalThis.__dp = { frames: [], cur: null, on: false });
    const names = new Map([[0, 'time'], [10, 'sim'], [20, 'people'], [30, 'player'], [40, 'env'], [50, 'fx'], [60, 'audio'], [70, 'ui']]);
    for (const u of e.updaters) {
      if (u.__wrapped) continue;
      const fn = u.fn, name = names.get(u.priority) || `p${u.priority}`;
      u.fn = (dt, ctx) => { const t0 = performance.now(); try { return fn(dt, ctx); } finally { if (g.on && g.cur) g.cur[name] = (g.cur[name] || 0) + performance.now() - t0; } };
      u.__wrapped = true;
    }
    const rf = e.renderFn;
    e.renderFn = (dt) => {
      const t0 = performance.now();
      const pr = c.env?.probes?.stats?.captures ?? 0;
      try { return rf(dt); } finally {
        if (g.on && g.cur) {
          g.cur.render = performance.now() - t0;
          g.cur.captures = (c.env?.probes?.stats?.captures ?? 0) - pr;
          g.frames.push(g.cur);
        }
        g.cur = g.on ? { at: performance.now() } : null;
      }
    };
    let last = performance.now();
    const raf = (now) => { if (g.on && g.frames.length) g.frames[g.frames.length - 1].dtFrame = now - last; last = now; requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  });
  await h.ev(() => { const t = globalThis.__mikdash.time; t.setSpeed(1); t.pause(false); });
  await h.wait(3000);
  for (const [lab, a, b] of [['day6->night10', ['day', 6], ['night', 10]], ['night10->day3', ['night', 10], ['day', 3]]]) {
    const t0 = await h.ev(([x, y]) => globalThis.__mikdash.time.fromZmani(x, y), a);
    let t1 = await h.ev(([x, y]) => globalThis.__mikdash.time.fromZmani(x, y), b);
    if (lab.startsWith('day')) t1 -= 1440;
    await h.ev((x) => globalThis.__mikdash.time.set(x), t0); await h.wait(2500);
    await h.ev(() => { const g = globalThis.__dp; g.frames = []; g.on = true; g.cur = { at: performance.now() }; });
    const N = 40;
    for (let i = 1; i <= N; i++) {
      const tt = t0 + (t1 - t0) * (i / N);
      await h.ev((x) => globalThis.__mikdash.time.set(((x % 1440) + 1440) % 1440), tt);
      await h.wait(90);
    }
    await h.wait(1500);
    const r = await h.ev(() => {
      const g = globalThis.__dp; g.on = false;
      const fr = g.frames;
      const keys = new Set(); for (const f of fr) for (const k of Object.keys(f)) if (!['at', 'dtFrame', 'captures'].includes(k)) keys.add(k);
      const tot = {}; for (const k of keys) tot[k] = +(fr.reduce((s, f) => s + (f[k] || 0), 0) / fr.length).toFixed(1);
      const worst = [...fr].sort((a, b) => (b.dtFrame || 0) - (a.dtFrame || 0)).slice(0, 6).map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'at').map(([k, v]) => [k, +(+v).toFixed(1)])));
      const dts = fr.map((f) => f.dtFrame || 0).sort((a, b) => a - b);
      return { n: fr.length, median: +dts[dts.length >> 1].toFixed(1), p95: +dts[Math.floor(dts.length * 0.95)].toFixed(1), max: +dts[dts.length - 1].toFixed(1), meanPerSystem: tot, captures: fr.reduce((s, f) => s + (f.captures || 0), 0), worst };
    });
    h.log(`[${lab}]`, JSON.stringify(r));
  }
}

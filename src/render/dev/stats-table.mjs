// lighting-polish-fix: accuracy of env's per-source statistics table (luts.estimate) against the GPU-measured
// statistics of the same LUT pass, over a day (sun and moon), plus the cost of a forced env update.
//   node src/render/dev/session.mjs src/render/dev/stats-table.mjs --q low --query "t=d3"
export default async function (h) {
  const r = await h.ev(async () => {
    const c = globalThis.__mikdash, env = c.env, luts = env._luts, time = c.time;
    if (!luts?.table) return { error: 'no table' };
    c.engine.stop();
    time.pause(true);
    const lum = (a, o = 0) => 0.2126 * a[o] + 0.7152 * a[o + 1] + 0.0722 * a[o + 2];
    const rows = [];
    let worstE = 0, worstH = 0, worstZ = 0;
    const z = time.zmanim;
    const ts = [];
    for (let t = z.alot - 90; t <= z.sunrise + 120; t += 6) ts.push(t);
    for (let t = z.sunset - 120; t <= z.tzeit + 90; t += 6) ts.push(t);
    for (const t of [z.chatzot, z.midnight, z.midnight + 120, z.chatzot + 200]) ts.push(t);
    for (const t of ts) {
      time.set(((t % 1440) + 1440) % 1440);
      for (const u of c.engine.updaters) u.fn(1 / 60, c); // env runs forced: the estimate becomes luts.stats
      const est = Float32Array.from(luts.stats);
      const meas = luts.readStatsSync();
      const e = lum(est), m = lum(meas);
      const rel = (a, b) => Math.abs(Math.log(Math.max(a, 1e-12) / Math.max(b, 1e-12)));
      const dE = rel(e, m), dH = Math.max(...[1, 2, 3, 4, 5, 6].map((k) => rel(lum(est, k * 4), lum(meas, k * 4)))), dZ = rel(lum(est, 28), lum(meas, 28));
      worstE = Math.max(worstE, dE); worstH = Math.max(worstH, dH); worstZ = Math.max(worstZ, dZ);
      rows.push(`${time.sun.altitude.toFixed(1)}°/${time.moon.altitude.toFixed(0)}°: E ${m.toPrecision(3)} ${(100 * (e / m - 1)).toFixed(1)}% hz ${(100 * dH).toFixed(1)}% zen ${(100 * dZ).toFixed(1)}%`);
    }
    // cost of a forced update (jump) with the table vs a synchronous read-back
    const gl = c.renderer.getContext();
    const cost = [];
    for (let i = 0; i < 6; i++) {
      time.set(i % 2 ? time.fromZmani('day', 0.3) : time.zmanim.alot - 6);
      gl.finish();
      const t0 = performance.now();
      for (const u of c.engine.updaters) if (u.priority === 40) u.fn(1 / 60, c);
      cost.push(+(performance.now() - t0).toFixed(1));
      c.engine.renderFn(1 / 60);
    }
    c.engine.start(c);
    time.pause(false);
    return { worst: { E: +(100 * worstE).toFixed(1), horizon: +(100 * worstH).toFixed(1), zenith: +(100 * worstZ).toFixed(1) }, envForcedUpdateMs: cost, rows };
  });
  h.log(JSON.stringify(r.worst), 'forced env update ms', JSON.stringify(r.envForcedUpdateMs));
  for (const row of r.rows || []) h.log(row);
  if (r.error) h.log(r.error);
}

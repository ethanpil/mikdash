// "Go" views (qa-r2 SIM-R2-2): every place the UI's "Go" stands the observer to watch something must be open floor
// with a clear view ahead. For every view of the day's events (the data's, src/data/schedule.js), of the dynamic rows
// (G4's sets and the circuit, G5's offerings in progress — sampled through the day) and of the live views (the officer's
// round), on a weekday, a Friday and a Shabbat:
//   1. floor  — a standable floor within 0.6 m of the view's Z (its datum floor when it gives none);
//   2. inside — the point 1 m over that floor is not inside a solid (physics.insideAt);
//   3. ahead  — a level ray from the eye (1.6 m) along the view's heading meets nothing within 4 m.
// Failures are listed by owner: 'sim' (dynamic rows and live views — src/sim) and 'data' (the events' own views).
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/views.js "t=d3"
const rt = ctx.schedule.runtime, time = ctx.time, ph = ctx.physics;
const { AMAH: AM } = await import('/src/core/units.js');
const EYE = 1.6, AHEAD = 4, FLOOR_TOL = 0.6;
const r2 = (x) => Math.round(x * 100) / 100;
const views = new Map();   // key -> { at, heading, who, owner }
const add = (v, who, owner) => {
  const p = v?.at;
  if (!p) return;
  let at = null;
  if (Array.isArray(p)) at = p;
  else if (p.el) { const b = ctx.elOpt?.(p.el)?.box; if (b) { const f = p.f || [0.5, 0.5, 1]; at = [0, 1].map((i) => b.min[i] + (b.max[i] - b.min[i]) * (f[i] ?? 0.5)); } }
  if (!at) return;
  const h = Number.isFinite(v.heading) ? v.heading : null;
  const key = `${r2(at[0])},${r2(at[1])},${Number.isFinite(at[2]) ? r2(at[2]) : '-'}|${h ?? '-'}`;
  if (!views.has(key)) views.set(key, { at, heading: h, who: new Set(), owner });
  const e = views.get(key);
  e.who.add(who);
  if (owner === 'sim') e.owner = 'sim';
};
for (const date of ['2026-11-02', '2026-11-06', '2026-11-07']) {
  time.setDate(date); await frames(3);
  for (const ev of ctx.schedule.events) {
    if (ev.dayTypes?.includes?.('occasional')) continue;
    // a live view (a getter) is the sim's; read it at a few moments of the event
    const d = Object.getOwnPropertyDescriptor(ev, 'view');
    if (d && d.get) {
      for (let k = 0; k < 6; k++) { time.set(ev.t0 + ((ev.t1 - ev.t0 + 1440) % 1440) * (k + 0.5) / 6); await frames(1); add(ev.view, `${ev.id}@${time.format(time.t)}`, 'sim'); }
    } else add(ev.view, ev.id, 'data');
  }
  // the dynamic rows through the day
  for (let t = 0; t < 1440; t += 3) for (const ev of ctx.schedule.dynamic(t)) add(ev.view, `${ev.parent || ''}/${ev.id}`.replace(/:\d+(\.\d+)?$/, ''), 'sim');
}
const bad = [];
const dir = { x: 0, y: 0, z: 0 };
let n = 0;
for (const [key, v] of views) {
  n++;
  const X = v.at[0], Y = v.at[1], x = X * AM, z = -Y * AM;
  const hasZ = Number.isFinite(v.at[2]);
  const f = hasZ ? ph.levelFloor(x, z, v.at[2] * AM) : ph.floorAt(x, z);
  const why = [];
  if (f == null || (hasZ && Math.abs(f - v.at[2] * AM) > FLOOR_TOL)) why.push(`no floor near Z ${hasZ ? r2(v.at[2]) : '-'} (floor ${f == null ? '-' : r2(f / AM)})`);
  const fy = f ?? (hasZ ? v.at[2] * AM : 0);
  if (ph.insideAt(x, fy + 1.0, z)) why.push('inside a solid at +1 m');
  if (v.heading != null) {
    const a = (v.heading * Math.PI) / 180;
    const o = new ctx.camera.position.constructor(x, fy + EYE, z);
    const d = new ctx.camera.position.constructor(Math.sin(a), 0, -Math.cos(a));
    const hit = ph.raycast(o, d, AHEAD);
    if (hit && hit.distance < AHEAD) why.push(`view blocked at ${r2(hit.distance)} m`);
  }
  if (why.length) bad.push({ owner: v.owner, at: key, why: why.join('; '), who: [...v.who].slice(0, 4).join(', ') });
}
const sim = bad.filter((b) => b.owner === 'sim'), data = bad.filter((b) => b.owner === 'data');
return { views: n, ok: sim.length === 0, sim, data };

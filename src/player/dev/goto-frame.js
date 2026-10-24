// goTo arrival framing (qa-r1 PLR-2): Go-instant to an event's view as the UI sends it, then report the arrival pitch,
// the nearest figure, whether a figure stands in the line of sight to the event, and a screenshot per case.
//   node src/sim/dev/run.mjs --q low --out shots/qa-r1-fix-player --script src/player/dev/goto-frame.js "date=2026-11-02&t=d4"
// URL extras: &cases=sanhedrin@d4,moked-night@n3,gate-levites@d4 (default) · &plook=1 adds the event position as
// `look` (what ui/data.js viewTarget and sim viewOf are asked to pass) · &pspeed=walk walks instead of teleporting.
const q = new URLSearchParams(location.search);
const cases = (q.get('cases') || 'sanhedrin@d4,moked-night@n3,gate-levites@d4').split(',').map((s) => s.split('@'));
const withLook = q.get('plook') === '1', speed = q.get('pspeed') || 'instant';
const { w2m, EYE_HEIGHT } = await import('/src/core/units.js');
const s = ctx.schedule, time = ctx.time, P = ctx.player;
const r2 = (v) => Math.round(v * 100) / 100;

/** every drawn figure: world feet + height, lying flag (same reading as the player's own check) */
function figures() {
  const out = [];
  for (const a of ctx.people?.actors || []) {
    if (!a.visible || a.disposed || a.kind === 'prop' || !a.object3D?.parent) continue;
    const e = a.object3D.matrixWorld.elements;
    out.push({ x: e[12], y: e[13], z: e[14], h: (a.arch?.H || 1.7) * (a.scale || 1), pose: a.poseName, role: a.role });
  }
  for (const c of ctx.people?.system?.crowds || []) {
    if (!c.visible) continue;
    for (let i = 0; i < c.count; i++) if (c.fadeM[i] > 0.004) out.push({ x: c.x[i], y: c.y[i], z: c.z[i], h: c.arch[i].H * c.sc[i], pose: c.poseName, role: c.role[i] });
  }
  return out;
}

const res = {};
for (const [id, when] of cases) {
  const ev = s.byId(id);
  if (!ev) { res[id] = 'missing'; continue; }
  time.pause(true); time.set(time.parse(when)); await frames(4);
  P.teleport('start'); P.setLook(270, 10); await frames(2); // the spawn's look, as the QA run had it
  const v = s.viewOf(ev);
  const target = { ...v };
  const pos = s.positionOf(ev);
  if (withLook && pos) { const m = w2m(pos); target.look = [m.X, m.Y, m.Z]; }
  if (speed !== 'instant') {
    // a short walk in: from 4 m behind the instant arrival (the walk's own arrival check runs at its end)
    await P.goTo(target, 'instant');
    const h = P.heading * Math.PI / 180, b = P.position.clone();
    b.x -= Math.sin(h) * 4; b.z += Math.cos(h) * 4;
    const st = ctx.physics.findStand(b, 3);
    if (st) P.teleport(st);
    await frames(2);
  }
  const t0 = performance.now();
  const ok = await P.goTo(target, speed);
  const ms = performance.now() - t0;
  await frames(6);
  const f = P.position, eye = P.eye;
  const figs = figures();
  let near = null, nd = Infinity, block = null;
  for (const g of figs) {
    if (Math.abs(g.y - f.y) > 1.2) continue;
    const d = Math.hypot(g.x - f.x, g.z - f.z);
    if (d < nd) { nd = d; near = g; }
  }
  if (pos) {
    // a standing figure's body within 6° of the sight line (eye -> event + 0.5 m), short of the last 1.5 m
    const ax = pos.x - eye.x, ay = pos.y + 0.5 - eye.y, az = pos.z - eye.z, L = Math.hypot(ax, az);
    for (const g of figs) {
      if (['sleep', 'lie', 'prostrate'].includes(g.pose)) continue;
      const t = Math.max(0, Math.min((L - 1.5) / L, ((g.x - eye.x) * ax + (g.z - eye.z) * az) / (L * L)));
      const d = Math.hypot(eye.x + ax * t - g.x, eye.z + az * t - g.z), y = eye.y + ay * t;
      if (d < 0.3 + t * L * Math.tan(6 * Math.PI / 180) && y > g.y && y < g.y + g.h) { block = { role: g.role, pose: g.pose, at: r2(t * L) }; break; }
    }
  }
  const site = w2m(f);
  res[id] = {
    ok, ms: Math.round(ms), view: v, look: target.look ?? null,
    feet: [r2(site.X), r2(site.Y), r2(site.Z)], heading: r2(P.heading), pitch: r2(P.pitch),
    eventDist: pos ? r2(Math.hypot(pos.x - f.x, pos.z - f.z)) : null,
    nearestFigure: near ? { d: r2(nd), role: near.role, pose: near.pose } : null, sightBlockedBy: block,
  };
  await shot(`go-${id}-${when}${withLook ? '-look' : ''}${speed === 'instant' ? '' : '-' + speed}`);
}
return res;

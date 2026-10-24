// The climb to the aliyah roof (qa-r1 PLR-3; nav/climbs.js): the route nav plans to the 'roof' zone stand, then a
// goTo up from the ta'im roofs and back down, with shots on the climb.
//   node src/sim/dev/run.mjs --q low --out shots/qa-r1-fix-player/climb --script src/player/dev/climb.js "t=d3"
// URL extras: &pspeed=fast (default) · &pfrom=X,Y,Z (site; default the taim-roofs stand) · &ptrip=0 plans only
const q = new URLSearchParams(location.search);
const speed = q.get('pspeed') || 'fast';
const from = (q.get('pfrom') || '105,309.5,55').split(',').map(Number);
const { w2m, m2w } = await import('/src/core/units.js');
await ctx.nav.ready;
const P = ctx.player, nav = ctx.nav;
const r2 = (v) => Math.round(v * 100) / 100;
const site = (v) => { const m = w2m(v); return [r2(m.X), r2(m.Y), r2(m.Z)]; };
const ROOF = [170, ctx.site.axisY, 112];
const out = {};

// the plan from the spawn and from the Azarah (what tools/nav-coverage.mjs asks)
const roofW = m2w(...ROOF); roofW.y = ctx.physics.nearestFloor(roofW.x, roofW.z, roofW.y);
for (const [name, pt] of [['start', ctx.anchors.get('start').pos], ['azarah', m2w(225, 370, 16)]]) {
  const s = pt.clone(); s.y = ctx.physics.nearestFloor(s.x, s.z, s.y + 0.5) ?? s.y;
  const p = nav.findPath(s, roofW);
  out['plan-' + name] = p && { n: p.length, end: site(p[p.length - 1]), climb: p.climb ? { ...p.climb, foot: site(p[p.climb.i0]), top: site(p[p.climb.i1]) } : null, ms: r2(nav.lastQueryMs) };
}

async function trip(label, target, shotsEvery = 0) {
  const t0 = performance.now();
  let n = 0, phases = new Set(), lastShot = 0;
  const done = P.goTo(target, speed);
  let finished = false;
  done.then(() => { finished = true; });
  while (!finished && performance.now() - t0 < 240000) {
    await frames(1);
    const ph = P.mode === 'auto' ? 'auto' : P.mode;
    phases.add(ph);
    if (shotsEvery && performance.now() - lastShot > shotsEvery && ctx.player.position.y > 31) { lastShot = performance.now(); await shot(`${label}-${String(++n).padStart(2, '0')}`); }
  }
  const ok = await done;
  await frames(4);
  await shot(`${label}-end`);
  return { ok, s: r2((performance.now() - t0) / 1000), feet: site(P.position), heading: r2(P.heading), pitch: r2(P.pitch), mode: P.mode };
}

if (q.get('ptrip') === '0') return out; // the plans only (e.g. under &amah=chazonish)
P.teleport({ at: from }); await frames(3);
out.up = await trip('up', { at: ROOF }, 2500);
out.down = await trip('down', { at: from }, 0);
return out;

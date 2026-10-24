// Floors (qa-r2 SIM-R2-3, SIM-R2-8, SIM-R2-10): what the figures walk and stand on, against the physics.
//   1. ways — G4's authored lines with their own heights (g4/mount.js GATES and SPURS: the Chuldah passages and stairs,
//      the chel steps; courts-daily's mourner, the stoa's and the plaza's ways), sampled every 0.3 m against the floor
//      nearest their height (standFloor exact): none more than 0.3 amah off. Run once per amah standard — the Chuldah
//      passages' depth in amot changes with it:
//        node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/floors.js "t=d3"                (Naeh)
//        node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/floors.js "t=d3&amah=feinstein"
//        node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/floors.js "t=d3&amah=chazonish"
//   2. tracks — every G5 offering's and G4 set's HOLD and WALK segments at authored heights (not the physics-placed
//      'near' ones, not the carried), on 2026-11-02 and the day's G4 sets: none more than 0.25 amah off the floor.
//   3. sweep — every wanted G4 / G5 figure each 10 minutes 06:00–18:00 (2026-11-02): none inside a solid at +1 m and
//      none more than 0.15 m off the floor at its level (seated, lying and carried figures aside).
const rt = ctx.schedule.runtime, time = ctx.time, ph = ctx.physics;
const { AMAH: AM } = await import('/src/core/units.js');   // (the amah standard of this boot: ?amah=)
const r2 = (x) => Math.round(x * 100) / 100;
const floor = (X, Y, Z) => { const y = ph.standFloor(X * AM, -Y * AM, Z * AM, true); return Number.isFinite(y) ? y / AM : null; };
const res = { amah: ctx.params?.amah ?? new URLSearchParams(location.search).get('amah') ?? 'naeh' };

// ---- 1. ways
const M = await import('/src/sim/choreo/g4/mount.js');
const C = await import('/src/sim/choreo/g4/crowd.js');
const routes = [];
for (const [id, g] of Object.entries(M.GATES)) routes.push([`gate:${id}:in`, g.in], [`gate:${id}:out`, g.out]);
for (const [id, sp] of Object.entries(M.SPURS)) routes.push([`spur:${id}:in`, sp.in], [`spur:${id}:out`, sp.out]);
routes.push(['stoa:in', C.STOA_IN], ['stoa:out', C.STOA_OUT], ['mourner:in', M.chuldahLine(167)], ['mourner:out', M.chuldahLine(333, false)]);
routes.push(['plaza:in', M.chuldahLine(165)], ['plaza:out', M.chuldahLine(335, false)]);
const wayBad = [];
let waySamples = 0;
for (const [name, pts] of routes) {
  let worst = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) * AM;
    for (let d = 0; d <= L; d += 0.3) {
      const k = L > 0 ? d / L : 0;
      const X = a[0] + (b[0] - a[0]) * k, Y = a[1] + (b[1] - a[1]) * k, Z = (a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * k;
      // (beyond the Mount's west wall Kiponus' bridge deck; out in the city: no floor to check)
      if (X < -1 || Y < -6) continue;
      waySamples++;
      const f = floor(X, Y, Z);
      const off = f == null ? Infinity : Z - f;
      if (Math.abs(off) > 0.3 && (!worst || Math.abs(off) > Math.abs(worst.off))) worst = { off, at: `${r2(X)},${r2(Y)},${r2(Z)} floor ${f == null ? '-' : r2(f)}` };
    }
  }
  if (worst) wayBad.push(`${name}: ${worst.at} (${r2(worst.off)})`);
}
res.ways = { samples: waySamples, bad: wayBad.length, list: wayBad.slice(0, 20), chuldah: M.CHULDAH };

// ---- 2. tracks (G5's offerings and G4's sets) at their authored heights
time.setDate('2026-11-02'); await frames(3);
time.set(time.parse('d3')); await frames(3);
const tracks = [];
const g5 = rt.choreo('private-offerings')?.state?.plan;
for (const inst of g5?.insts || []) for (const tr of inst.tracks) tracks.push([`g5:${inst.type}:${tr.role}`, tr]);
for (const id of ['chambers-daily', 'nikanor-stations']) for (const B of rt.choreo(id)?.state?.plan?.sets || []) for (const tr of B.tracks) tracks.push([`${id}:${B.type}:${tr.role}`, tr]);
const trBad = new Map();
let trSamples = 0;
for (const [name, tr] of tracks) {
  for (const s of tr.segs) {
    if (s.kind === 0 && !s.near) {
      trSamples++;
      const f = floor(s.X, s.Y, s.Z);
      if (f == null || Math.abs(s.Z - f) > 0.25) { const k = `${name} hold`; if (!trBad.has(k)) trBad.set(k, `${k} @${r2(s.X)},${r2(s.Y)},${r2(s.Z)} floor ${f == null ? '-' : r2(f)} ${s.pose}`); }
    } else if (s.kind === 1) {
      const P = s.path, L = P.length;
      for (let d = 0; d <= L; d += 0.3) {
        const q = P.sample(d, {});
        const near = !!(s.nearPts && (s.nearPts[q.seg] || s.nearPts[q.seg + 1]));
        if (near || !Number.isFinite(q.Z)) continue;
        trSamples++;
        const f = floor(q.X, q.Y, q.Z);
        if (f == null || Math.abs(q.Z - f) > 0.25) {
          // a seam between two colliders (the floor right before and after it is there)
          if ([-0.1, 0.1].every((e) => { const r = P.sample(d + e, {}); const g = floor(r.X, r.Y, r.Z); return g != null && Math.abs(g - r.Z) <= 0.25; })) continue;
          // an open channel stepped over (the amah's, 1 amah wide): the floor at its own height a pace either side
          if (f != null && f < q.Z && [[1.3, 0], [0, 1.3]].some(([dx, dy]) => [1, -1].every((sg) => { const g = floor(q.X + sg * dx, q.Y + sg * dy, q.Z); return g != null && Math.abs(g - q.Z) <= 0.25; }))) continue;
          const k = `${name} walk`;
          if (!trBad.has(k)) trBad.set(k, `${k} @${r2(q.X)},${r2(q.Y)},${r2(q.Z)} floor ${f == null ? '-' : r2(f)} ${s.pose} seg ${q.seg}: ${s.path.points.slice(Math.max(0, q.seg - 1), q.seg + 3).map((p) => `${r2(p.X)},${r2(p.Y)},${r2(p.Z)}`).join(' → ')}`);
        }
      }
    }
  }
}
res.tracks = { tracks: tracks.length, samples: trSamples, bad: trBad.size, list: [...trBad.values()].slice(0, 20) };

// ---- 3. sweep: wanted figures of G4 / G5 inside a solid or off the floor
const IDS = ['private-offerings', 'courts-daily', 'chambers-daily', 'nikanor-stations', 'sanhedrin', 'beit-avtinas'];
const sweep = new Map();
let figs = 0;
for (let t = 360; t <= 1080; t += 10) {
  time.set(t); await frames(2);
  for (const id of IDS) {
    const e = rt.choreo(id);
    if (!e?.relevant) continue;
    for (const p of e.pools) for (const s of p.slots) {
      if (!s.want || !s.actor) continue;
      if (/^(sit|sleep|lie|bound|bound_tied|struggle)/.test(s._pose || '')) continue;
      const o = s.actor.object3D.position;
      figs++;
      const inside = ph.insideAt(o.x, o.y + 1.0, o.z);
      const f = ph.levelFloor(o.x, o.z, o.y);
      const off = f == null ? NaN : o.y - f;
      // (a figure carried in the arms is off the floor on purpose: people's carried animals ride their carrier)
      if (!inside && Math.abs(off) <= 0.15) continue;
      if (!inside && p.spec.animal && off > 0.15) continue;
      const k = `${id}/${p.name}`;
      const l = sweep.get(k) || { n: 0, ex: [] };
      l.n++;
      if (l.ex.length < 3) l.ex.push(`${time.format(t)} #${s.index} ${r2(o.x / AM)},${r2(-o.z / AM)},${r2(o.y / AM)} ${inside ? 'INSIDE ' : ''}off ${Number.isNaN(off) ? '-' : r2(off)} m ${s._pose}`);
      sweep.set(k, l);
    }
  }
}
res.sweep = { figures: figs, bad: [...sweep.values()].reduce((a, l) => a + l.n, 0), list: Object.fromEntries([...sweep].map(([k, l]) => [k, `${l.n}: ${l.ex.join(' | ')}`])) };
res.ok = res.ways.bad === 0 && res.tracks.bad === 0 && res.sweep.bad === 0;
return res;

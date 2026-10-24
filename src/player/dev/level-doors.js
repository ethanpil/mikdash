// Player dev check (player-3, player-3-fix): standFloor(x, z, nearY, true) keeps to nearY's level; findPath's shut-door
// options. Body of an async function with `ctx`, `frames`, `sleep` in scope; run it with the sim harness:
//   node src/sim/dev/run.mjs --q low --script src/player/dev/level-doors.js "date=2026-11-02&t=02:30"
// Returns { ok, failures, floors, sweep, ways, doors }. Site points in amot.
for (let i = 0; i < 400 && !ctx.nav?.isReady; i++) await new Promise((r) => setTimeout(r, 250));
const { AMAH: A } = await import('/src/core/units.js');
const ph = ctx.physics, nav = ctx.nav, E = ctx.site.elements;
const failures = [];
const r2 = (v) => (v == null ? null : Math.round((v / A) * 100) / 100);
const lvl = (X, Y, Z) => r2(ph.standFloor(X * A, -Y * A, Z * A, true));
const W = (X, Y, Z) => ({ x: X * A, y: Z * A, z: -Y * A });

// ---- 1. floors: [name, X, Y, near Z, expected range]
const floorCases = [
  ['Gazit column (plinth, not the roof 36)', 82.5, 375.5, 16, [16, 16.5]],
  ['nanas (pavement, not the cedar cap 20)', 203, 383.75, 16, [16, 16.5]],
  ['open Azarah', 180, 300, 16, [16, 16]],
  ['hint 0 over the solid court', 180, 300, 0, [16, 16]],
  ['Ulam steps, chord under a tread', 187.5, 330, 19.68, [20.5, 20.5]],
  ['Ulam steps, buried face under the tread', 184, 325, 20.64, [21.5, 21.5]],
  ['Heichal, near the floor', 140, 330, 22, [22, 22]],
  ['aliyah', 140, 330, 67, [67, 67]],
  // the sim's own calls (player-3-review record, weekday 2026-11-02)
  ['G5 walker on the 15 steps 09:19 (tread 7)', 276.03, 334.65, 6, [7, 7]],
  ['G5 walker on the 15 steps 09:19 (tread 8)', 275.29, 334.18, 6, [8, 8]],
  ['G2 walker on the Ulam steps 14:05 (tread 18.5)', 193.38, 338.6, 17.5, [18.5, 18.5]],
  ['G2 at 05:31, 1.93 under the Ulam head (22, not 16)', 181.81, 338.6, 20.07, [22, 22]],
  ['night-watch torch on the NE corner stair (1.5 tread)', 496.88, 494.49, 0, [1.5, 1.5]],
  // a hint just under a floor never drops to a level far below
  ['Korban gate flight (9.5 tread, not the underpass 0)', 161.5, 410, 6.5, [9.5, 9.5]],
  ['Heichal roof (112, not the Heichal floor 22)', 160.37, 330.41, 110.1, [112, 112]],
  ['15 steps buried face (7.4)', 392.37, 280.41, 5.9, [7.4, 7.4]],
  ['EN chamber raised floor (8.8)', 391.37, 360.41, 6.9, [8.8, 8.8]],
  // things a figure at the court's level overlaps: stay on the pavement
  ['marble table (pavement under it)', 203, 373.5, 16, [16, 16]],
  ['silver table by the kevesh (pavement)', 205.5, 281, 16, [16, 16]],
  ['Shulchan (Heichal floor)', 130.33, 337.58, 22, [22, 22]],
  ['golden altar (its base plinth)', 132.33, 330.5, 22, [22, 22.1]],
  ['kiyor base (pavement beside it, not 2 or 22)', 190, 317, 16, [16, 16]],
  ['altar top beside the wood pile (25, not the pile 26.8)', 223.84, 317.86, 25, [25, 25.05]],
  // a chord over a tread: never the height of the next step up in mid-air (the night-watch officer's route)
  ['officer over a 13 tread, hint 15.5', 112.25, 254.55, 15.5, [13, 13]],
  ['officer on the 15 steps, hint 12.97 over the 10 tread', 273.56, 330.5, 12.97, [10, 10]],
];
const floors = {};
for (const [name, X, Y, Z, [lo, hi]] of floorCases) {
  const y = lvl(X, Y, Z);
  floors[name] = y;
  if (y == null || y < lo - 0.01 || y > hi + 0.01) failures.push(`floor ${name}: ${y}, want ${lo}..${hi}`);
}
// the player's own rule is unchanged
if (r2(ph.nearestFloor(82.5 * A, -375.5 * A, 16 * A)) !== 36) failures.push('nearestFloor in the Gazit column is no longer the roof (36)');

// ---- 2. chord sweeps across the whole width of the Ulam steps and the 15 steps: a straight chord from foot to head
// (and one amah under or over it) gives the tread under the walker, never the court under or inside the stair
const sweep = { samples: 0, bad: 0, edge: 0, byOffset: { '0': 0, '-1': 0, '1': 0 }, worst: [] };
const treadAt = (x, z, top) => { const fl = ph.floorsAt(x, z).filter((y) => y <= top + 0.01); return fl.length ? fl[fl.length - 1] : null; };
// base: the court beside the stair, also right for a hint under the chord within 1 amah of the stair's side edge
const chord = (X, Y, Zc, top, what, base = null) => {
  const x = X * A, z = -Y * A, want = treadAt(x, z, top * A);
  if (want == null) return;
  for (const dz of [0, -1, 1]) {
    sweep.samples++;
    const got = ph.standFloor(x, z, (Zc + dz) * A, true);
    if (got != null && Math.abs(got - want) < 0.01) continue;
    if (dz < 0 && base != null && got != null && Math.abs(got - base * A) < 0.01) { sweep.edge++; continue; }
    sweep.bad++;
    sweep.byOffset[dz]++;
    if (sweep.worst.length < 12) sweep.worst.push(`${what} (${X.toFixed(2)}, ${Y.toFixed(2)}) hint ${(Zc + dz).toFixed(2)}: ${r2(got)}, tread ${r2(want)}`);
  }
};
{
  const u = E['altar.ulam-steps'], pr = u.params.profile, foot = pr[0].riserX, last = pr[pr.length - 1], head = last.riserX - last.tread;
  const z0 = u.box.min[2], z1 = u.box.max[2];
  for (let Y = u.box.min[1] + 0.05; Y <= u.box.max[1] - 0.05; Y += 0.5) {
    for (let X = foot - 0.1; X > head + 0.1; X -= 0.25) chord(X, Y, z0 + ((z1 - z0) * (foot - X)) / (foot - head), z1, 'Ulam', Y < u.box.min[1] + 1 || Y > u.box.max[1] - 1 ? z0 : null);
  }
  const s = E['en.steps15'], p = s.params, [cx, cy] = p.center, R0 = p.outerRadius, R1 = p.landingRadius;
  const zf = s.box.min[2], zh = s.box.max[2];
  for (let th = -80; th <= 80; th += 10) {
    const c = Math.cos((th * Math.PI) / 180), sn = Math.sin((th * Math.PI) / 180);
    for (let r = R0 - 0.1; r > R1 + 0.1; r -= 0.25) chord(cx + r * c, cy + r * sn, zf + ((zh - zf) * (R0 - r)) / (R0 - R1), zh, `15 steps radial ${th}°`);
  }
  for (let dy = -(R1 - 0.5); dy <= R1 - 0.5; dy += 1) {
    const xf = cx + Math.sqrt(R0 * R0 - dy * dy), xh = cx + Math.sqrt(R1 * R1 - dy * dy);
    for (let X = xf - 0.1; X > xh + 0.1; X -= 0.25) chord(X, cy + dy, zf + ((zh - zf) * (xf - X)) / (xf - xh), zh, `15 steps E-W dy ${dy}`);
  }
}
if (sweep.bad) failures.push(`chord sweep: ${sweep.bad} of ${sweep.samples} samples off the tread (${sweep.worst[0]})`);

// ---- 3. ways (stands in for g2.js §2 until G2 reads nearestFloor): G2's exact-Z legs against the nearest floor on any
// level, so a leg through a table, pile or pillar shows as the obstruction's top
const ways = { samples: 0, bad: [], known: [] };
{
  const rt = ctx.schedule?.runtime;
  const IDS = ['terumat-hadeshen', 'barkai', 'tamid-morning', 'tamid-afternoon', 'gazit-shema'];
  const t0 = ctx.time.t;
  for (const s of ['alot-50', 'sunrise+10', 'sunrise+40', 'd9']) { ctx.time.set(ctx.time.parse(s)); await frames(2); }
  const scriptsOf = (id) => {
    const P = rt?.choreo(id)?.state?.plan; if (!P) return [];
    const out = [], seen = new Set();
    const push = (x) => { if (!x || seen.has(x)) return; if (Array.isArray(x)) { x.forEach(push); return; } if (x.steps) { seen.add(x); out.push(x); return; } if (typeof x === 'object' && !x.isVector3) for (const k of Object.keys(x)) if (k !== 'P') push(x[k]); };
    push(P);
    return out;
  };
  const head = rt?.choreo('tamid-morning')?.state?.P?.ramp?.head;
  const seenKey = new Set();
  for (const id of IDS) for (const S of scriptsOf(id)) S.steps.forEach((st, k) => {
    if (!st.zx) return;
    const test = (X, Y, Z, what) => {
      if (head != null && Math.abs(Y - head) < 0.25 && Z > 24) return; // the ramp's seam at the altar (Zevachim 62b)
      ways.samples++;
      const f = r2(ph.nearestFloor(X * A, -Y * A, Z * A));
      if (f != null && Math.abs(f - Z) <= 0.25) return;
      const key = `${id}/${S.name}#${k} ${what}`;
      if (seenKey.has(key) || /\/lamb#/.test(key)) return;
      seenKey.add(key);
      const row = `${key} @${X.toFixed(1)},${Y.toFixed(1)} Z${Z.toFixed(2)} floor ${f ?? '-'}`;
      // G1's third-lottery circle: places on the Gazit column plinths (roof 36 over them); filed to G1 in player-3
      if (id === 'gazit-shema' && f != null && f > 30) ways.known.push(row); else ways.bad.push(row);
    };
    if (st.kind === 'walk') for (let d = 0; d <= st.L; d += 0.25) { const p = st.path.sample(d, {}); test(p.X, p.Y, p.Z, 'walk'); }
    else if (st.kind === 'act' && st.d > 0.02) test(st.pos[0], st.pos[1], st.pos[2], st.pose);
  });
  ctx.time.set(t0); await frames(3);
  if (!ways.samples) failures.push('ways: no G2 scripts found');
  for (const b of ways.bad) failures.push(`ways: ${b}`);
}

// ---- 4. doors
const V3 = ctx.camera.position.constructor;
const len = (p) => p.reduce((s, q, i) => (i ? s + Math.hypot(q.x - p[i - 1].x, q.z - p[i - 1].z) : 0), 0);
const crossesBoxes = (p, boxes) => {
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.05));
    for (let s = 0; s <= n; s++) {
      const x = a.x + ((b.x - a.x) * s) / n, y = a.y + ((b.y - a.y) * s) / n + 0.5, z = a.z + ((b.z - a.z) * s) / n;
      if (boxes.some((q) => x >= q.min.x && x <= q.max.x && z >= q.min.z && z <= q.max.z && y >= q.min.y && y <= q.max.y)) return true;
    }
  }
  return false;
};
const through = (p, ids) => crossesBoxes(p, ids.flatMap((id) => nav.doorFootprint(id) || []));
// does the path go from one side of a shut leaf to the other within its span (a start inside the leaf may leave it)?
const passes = (p, ids) => {
  for (const b of ids.flatMap((id) => nav.doorFootprint(id) || [])) {
    const thinX = b.max.x - b.min.x < b.max.z - b.min.z, mid = thinX ? (b.min.x + b.max.x) / 2 : (b.min.z + b.max.z) / 2;
    const half = (thinX ? b.max.x - b.min.x : b.max.z - b.min.z) / 2;
    let prev = null, ps = 0;
    for (const q of p) {
      const u = (thinX ? q.x : q.z) - mid, s = Math.abs(u) <= half ? 0 : Math.sign(u);
      if (s === 0) continue;
      if (prev && s !== ps) {
        const pu = (thinX ? prev.x : prev.z) - mid, t = pu / (pu - u), pv = thinX ? prev.z : prev.x;
        const v = pv + t * ((thinX ? q.z : q.x) - pv), y = prev.y + t * (q.y - prev.y) + 0.5;
        if (v >= (thinX ? b.min.z : b.min.x) && v <= (thinX ? b.max.z : b.max.x) && y >= b.min.y && y <= b.max.y) return true;
      }
      prev = q; ps = s;
    }
  }
  return false;
};
const doors = {};
const timed = (from, to, opts) => { const t0 = performance.now(); const p = nav.findPath(from, to, opts); return { p, ms: performance.now() - t0 }; };
const run = (name, from, to, opts, check) => {
  const { p, ms } = timed(from.x !== undefined ? from : W(...from), to.x !== undefined ? to : W(...to), opts);
  doors[name] = p ? `${len(p).toFixed(1)} m, ${ms.toFixed(1)} ms` : `null, ${ms.toFixed(1)} ms`;
  const bad = check(p, ms);
  if (bad) failures.push(`doors ${name}: ${bad}`);
  return p;
};
const footprints = [...ctx.movables.keys()].filter((k) => k.startsWith('door:') && nav.doorFootprint(k)).length;
doors.footprints = footprints;
if (footprints < 40) failures.push(`only ${footprints} doors have a footprint`);
const EN = [330, 330, 6], AZ = [225, 370, 16];
const nik = ['azarah.gate.nikanor', 'azarah.gate.nikanor.wicket-n', 'azarah.gate.nikanor.wicket-s'];
const plain = nav.findPath(W(...EN), W(...AZ));
run('default (unchanged)', EN, AZ, null, (p) => (!p ? 'no path' : Math.abs(len(p) - len(plain)) > 1e-6 ? 'differs' : null));
run('Nikanor and wickets blocked', EN, AZ, { blockedDoors: nik }, (p) => (!p ? 'no path' : through(p, nik) ? 'passes a blocked door' : null));
run('Heichal great gate + north wicket blocked', AZ, [140, 330.5, 22], { blockedDoors: ['heichal.gate.great', 'heichal.gate.wicket-n'] },
  (p, ms) => (p ? 'found a way through' : ms > 100 ? `slow (${ms.toFixed(0)} ms)` : null));
// in the passage, west of the leaves: since world-4 they hang at the gate's east face (X 259.47–260.04), so the old
// point (X 259.75) was inside the shut leaves themselves, which have no "own side" to step back to (qa-r1-player.md)
run('start in the shut Nikanor doorway', [257.5, 330.5, 13.5], EN, { blockedDoors: nik }, (p) => (!p ? 'no path out' : passes(p, nik) ? 'walks through the leaves' : null));

// every door: from just in front of its shut leaves to just behind them, blocked (with the wickets in it) — never
// through the leaves
const per = { doors: 0, maxMs: 0, worst: '' };
const doorKeys = [...ctx.movables.keys()].filter((q) => q.startsWith('door:'));
for (const k of doorKeys) {
  const fb = nav.doorFootprint(k);
  if (!fb) continue;
  const ids = [k, ...doorKeys.filter((q) => q.startsWith(`${k}.`))];
  const U = fb[0].clone(); fb.forEach((b) => U.union(b));
  const c = U.getCenter(new V3()), sz = U.getSize(new V3()), thinX = sz.x < sz.z, off = (thinX ? sz.x : sz.z) / 2 + 1.0;
  for (const back of [false, true]) {
    const pa = c.clone(), pb = c.clone();
    if (thinX) { pa.x -= off; pb.x += off; } else { pa.z -= off; pb.z += off; }
    pa.y = ph.floorAt(pa.x, pa.z, U.min.y + 0.6, 0.3, 1.5) ?? U.min.y;
    pb.y = ph.floorAt(pb.x, pb.z, U.min.y + 0.6, 0.3, 1.5) ?? U.min.y;
    const [f, t] = back ? [pb, pa] : [pa, pb];
    const { p, ms } = timed(f, t, { blockedDoors: ids });
    per.doors++;
    if (ms > per.maxMs) { per.maxMs = ms; per.worst = `${k}${back ? ' (back)' : ''}`; }
    if (p && crossesBoxes(p, fb)) failures.push(`doors ${k}${back ? ' (back)' : ''}: blocked path crosses its leaves`);
  }
}
per.maxMs = +per.maxMs.toFixed(1);
doors.perDoor = per;

// the Moked gate shut with its pishpash open: the night way in (Tamid 1:3)
{
  const mg = ctx.movables.get('door:azarah.gate.moked'), pp = ctx.movables.get('door:azarah.gate.moked.pishpash');
  const keep = [mg.userData.openAmount, pp.userData.openAmount];
  const pk = E['azarah.gate.moked'].params.pishpash.box;
  const inP = [210.8, 386.1, 16], hall = [210.8, 394.4, 16];
  const viaWicket = (p) => {
    // where the path crosses the gate's plane, it is within the wicket's opening
    const zc = -((pk.min[1] + pk.max[1]) / 2) * A;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      if ((a.z - zc) * (b.z - zc) > 0) continue;
      const x = a.x + ((b.x - a.x) * (zc - a.z)) / (b.z - a.z || 1e-9);
      if (x < pk.min[0] * A || x > pk.max[0] * A) return false;
    }
    return true;
  };
  mg.userData.open(0); pp.userData.open(1);
  run('pishpash open, gate shut, closedDoors', inP, hall, { closedDoors: true }, (p) => (!p ? 'no way through the open pishpash' : !viaWicket(p) ? 'crosses the gate outside the wicket' : null));
  if (!nav.lastCut.includes('door:azarah.gate.moked.pishpash')) failures.push('doors pishpash: not reported in lastCut');
  run('gate named, pishpash not named', hall, inP, { blockedDoors: ['azarah.gate.moked'] }, (p) => (!p ? 'no way through the pishpash' : !viaWicket(p) ? 'crosses the gate outside the wicket' : null));
  run('gate and pishpash named', inP, hall, { blockedDoors: ['azarah.gate.moked', 'azarah.gate.moked.pishpash'] }, (p) => (p && crossesBoxes(p, nav.doorFootprint('azarah.gate.moked')) ? 'passes the shut gate' : null));
  pp.userData.open(0);
  run('pishpash shut, closedDoors', inP, hall, { closedDoors: true }, (p) => (p && crossesBoxes(p, nav.doorFootprint('azarah.gate.moked')) ? 'passes the shut pishpash' : null));
  mg.userData.open(keep[0]); pp.userData.open(keep[1]);
}

// a start that snaps into a doorway band must not be let through the leaves (the Tadi gate, ground 2 amot lower outside)
run('Tadi blocked, start 1 amah outside at Z 0', [210.8, 506.6, 0], [210.8, 501.7, 0], { blockedDoors: ['mount.gate.tadi'] },
  (p) => (p && passes(p, ['mount.gate.tadi']) ? 'walks through the leaves' : null));

// cut ways come back at once; long detours are steered by the door-aware coarse graph
{
  const t0 = ctx.time.t;
  ctx.time.set(ctx.time.parse('02:30')); await frames(4);
  const fl = (X, Y) => { const w = W(X, Y, 0); w.y = ph.standFloor(w.x, w.z) ?? 0; return w; };
  run('02:30 closedDoors start -> Kidron (cut)', fl(410, 330), fl(700, 330), { closedDoors: true }, (p, ms) => (p ? 'found a way out of the shut Mount' : ms > 100 ? `slow (${ms.toFixed(0)} ms)` : null));
  run('02:30 closedDoors EN -> Azarah (cut)', W(...EN), W(...AZ), { closedDoors: true }, (p, ms) => (p && through(p, nik) ? 'passes Nikanor' : ms > 100 ? `slow (${ms.toFixed(0)} ms)` : null));
  const sh = nav.doorFootprint('mount.gate.shushan'), U = sh[0].clone(); sh.forEach((b) => U.union(b));
  const c = U.getCenter(new V3()), out = c.clone(); out.x += 2.5; out.y = ph.floorAt(out.x, out.z, U.min.y + 0.6, 0.3, 3) ?? U.min.y;
  run('Shushan blocked, from outside it -> the Mount (detour)', out, fl(400, 330), { blockedDoors: ['mount.gate.shushan'] },
    (p, ms) => (p && through(p, ['mount.gate.shushan']) ? 'passes the Shushan gate' : ms > 400 ? `slow (${ms.toFixed(0)} ms)` : null));
  ctx.time.set(t0); await frames(3);
}

// a late (re)measure leaves a door as it found it: the great gate's outer and inner pairs at different amounts (as
// gates.js drives them) keep their poses and openAmount, and the footprint is the one measured at init (r2)
{
  const { createDoors } = await import('/src/player/nav/doors.js');
  const key = 'door:heichal.gate.great', g = ctx.movables.get(key), ud = g.userData;
  const sets = g.parent.children.filter((c) => c.isInstancedMesh && c !== g);
  const f0 = ud.openAmount, orig = sets.map((m) => m.instanceMatrix.array.slice());
  ud.openGroup('outer', 0.3); ud.openGroup('inner', 0.8);
  const before = sets.map((m) => m.instanceMatrix.array.slice()), amt = ud.openAmount;
  const fresh = createDoors(ctx).footprint(key) || [];
  const moved = sets.filter((m, i) => m.instanceMatrix.array.some((v, j) => v !== before[i][j])).map((m) => m.name);
  const init = nav.doorFootprint(key) || [];
  const same = fresh.length === init.length && fresh.every((b, i) => b.min.distanceTo(init[i].min) < 1e-6 && b.max.distanceTo(init[i].max) < 1e-6);
  doors.remeasure = { leafSetsChanged: moved, openAmount: [amt, ud.openAmount], boxes: fresh.length, sameAsInit: same };
  if (moved.length || ud.openAmount !== amt) failures.push(`great gate re-measure moved its leaves: ${moved.join(', ') || `openAmount ${amt} -> ${ud.openAmount}`}`);
  if (!same) failures.push('great gate re-measure: footprint differs from the one measured at init');
  ud.open(f0);
  sets.forEach((m, i) => { m.instanceMatrix.array.set(orig[i]); m.instanceMatrix.needsUpdate = true; });
}
return { ok: failures.length === 0, failures, floors, sweep, ways: { samples: ways.samples, bad: ways.bad.length, known: ways.known }, doors };

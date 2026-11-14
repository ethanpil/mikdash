// Rosh Chodesh (docs/decisions/rosh-chodesh.md): the occasion, its musaf and an ordinary day untouched. THROWS (the
// harness exits 1) on a failure.
//   1. calendar — 2026-11-11 (1 Kislev) is Rosh Chodesh, 2026-11-10 (30 Cheshvan) and 2026-11-02 are not; the next after
//      2026-11-02 is 2026-11-11; 1 Tishrei is not shown as Rosh Chodesh.
//   2. schedule — on 2026-11-11 the five rc-* events run and the individuals' offerings start after the musaf's song; on
//      2026-11-02 / 2026-11-06 none do and every event has the window it had before (BASE, from the pre-change build).
//   3. figures — the plan's crews (Yoma 2:5–7: bulls 24 + 24, ram 11, lambs 7 × 8) and animals (2 bulls, 1 ram, 7 lambs,
//      1 goat); every animal at its ring before the slaughter; each procession's carriers on the altar's top together
//      (a bull's 18 parts, the ram's 7 …); every slot of each crew shown at some moment.
//   4. sweep — every 0.5 min through the musaf: no figure of the module inside a solid at +1 m, off its floor (> 0.15 m;
//      lying and carried aside), or within 0.3 m of another of its figures (a figure inside another); none in the
//      altar's body below the sovev.
//   5. determinism — the pose at six moments is the same after jumping away and back, and after a date round trip.
// Run: node src/sim/dev/run.mjs --q low --timeout 900 --script src/sim/dev/tests/rosh-chodesh.js "date=2026-11-11&t=sunrise+100"
const rt = ctx.schedule.runtime, time = ctx.time, ph = ctx.physics, S = ctx.schedule;
const { AMAH: AM } = await import('/src/core/units.js');
const r2 = (x) => Math.round(x * 100) / 100;
const fails = [];
const out = {};
const errs = [];
const oe = console.error;
console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 300)); oe.apply(console, a); };
window.addEventListener('error', (e) => errs.push(`window: ${e.message}`));

// ---------------------------------------------------------------------------------------------- 1. calendar
time.setDate('2026-11-10'); await frames(2);
const rc10 = time.roshChodesh;
time.setDate('2026-09-12'); await frames(1);                // 1 Tishrei 5787
const rh = { rc: time.roshChodesh, occ: time.occasions.join(',') };
time.setDate('2026-11-02'); await frames(2);
const next = time.nextOccasion('rosh-chodesh');
out.calendar = { '2026-11-10': rc10, '2026-11-02': time.roshChodesh, next, '1 Tishrei 2026-09-12': rh };
if (rc10 || time.roshChodesh || next !== '2026-11-11' || rh.rc) fails.push(`calendar ${JSON.stringify(out.calendar)}`);

// ---------------------------------------------------------------------------------------------- 2. schedule
// the windows before this change (baseline browser run, 2026-11-02 / -06 with { dynamic: false }); samples
const BASE = {
  '2026-11-02': ['private-offerings@07:42-13:28', 'song-weekday@07:28-07:42', 'altar-limbs@07:56-13:33', 'tenufah@08:01-13:33', 'notar-burning@07:42-08:12', 'metzora@08:39-09:34'],
  '2026-11-06': ['private-offerings@07:45-13:26', 'song-friday@07:31-07:45', 'altar-limbs@07:59-13:32', 'tenufah@08:04-13:32', 'notar-burning@07:45-08:15', 'metzora@08:41-09:35'],
};
const ids = (d) => S.events.map((e) => e.id);
for (const date of ['2026-11-02', '2026-11-06']) {
  time.setDate(date); await frames(2);
  const rcIds = ids().filter((i) => i.startsWith('rc-'));
  if (rcIds.length) fails.push(`${date}: Rosh Chodesh events on an ordinary day ${rcIds}`);
  for (const w of BASE[date] || []) {
    const [id, span] = w.split('@');
    const e = S.byId(id);
    const got = e ? `${time.format(e.t0)}-${time.format(e.t1)}` : '-';
    if (got !== span) fails.push(`${date} ${id}: ${got}, was ${span}`);
  }
}
time.setDate('2026-11-11'); await frames(3);
const z = time.zmanim;
const rcEv = ['rc-musaf-slaughter', 'rc-goat-chatat', 'rc-musaf-flaying', 'rc-musaf-limbs', 'rc-musaf-song'].map((id) => S.byId(id));
out.schedule = { roshChodesh: time.roshChodesh, dayType: time.dayType, events: S.events.length, rc: rcEv.map((e) => e && `${e.id} ${time.format(e.t0)}-${time.format(e.t1)}`) };
if (!time.roshChodesh || rcEv.some((e) => !e)) fails.push('2026-11-11: not Rosh Chodesh or rc events missing');
const po = S.byId('private-offerings'), song = S.byId('rc-musaf-song');
out.schedule.private = `${time.format(po?.t0)} (sunrise+${Math.round(po.t0 - z.sunrise)})`;
if (!(po && song && po.t0 >= song.t1 - 0.01)) fails.push(`private offerings ${time.format(po?.t0)} before the musaf's song ends ${time.format(song?.t1)}`);

// ---------------------------------------------------------------------------------------------- 3. figures
const e = rt.choreo('rosh-chodesh-musaf');
time.set(rcEv[0].t0 - 2); await frames(3);
const P = e.state.plan;
if (!P) throw new Error('no Rosh Chodesh plan');
const crews = Object.fromEntries(Object.entries(P.scripts).map(([k, l]) => [k, l.filter(Boolean).length]));
const animals = Object.fromEntries(Object.entries(P.animals).map(([k, l]) => [k, l.filter(Boolean).length]));
out.plan = { crews, animals, warn: P.warn, procs: P.procs.map((p) => `${p.key} n${p.n} row ${time.format(p.row)} top ${time.format(p.top[0])}–${time.format(p.top[1])}`) };
const want = { bullA: 24, bullB: 24, ram: 11, lambs: 56, goat: 2, teams: 6 };
for (const [k, n] of Object.entries(want)) if (crews[k] !== n) fails.push(`crew ${k}: ${crews[k]} scripts, want ${n}`);
for (const [k, n] of Object.entries({ bulls: 2, ram: 1, lambs: 7, goat: 1 })) if (animals[k] !== n) fails.push(`animals ${k}: ${animals[k]}, want ${n}`);
if (P.warn.length) fails.push(`plan warnings: ${P.warn.slice(0, 5).join(' · ')}`);
const shownOf = (pool) => pool ? pool.slots.filter((s) => s.want).length : 0;
// every animal at its ring before the first cut
time.set(P.t.cut.bullA - 0.7); await frames(3);
const st = e.state;
const atRings = Object.fromEntries(Object.entries(st.animals).map(([k, p]) => [k, shownOf(p)]));
out.atRings = atRings;
for (const [k, n] of Object.entries({ bulls: 2, ram: 1, lambs: 7, goat: 1 })) if (atRings[k] !== n) fails.push(`at ${time.format(time.t)} ${atRings[k]} ${k} shown, want ${n}`);
// on the altar's top together: each procession's flesh carriers, laid out between the horns
const onTop = {};
for (const p of P.procs) {
  time.set(p.top[1] + 0.05); await frames(2);
  const crew = { bullA: 'bullA', bullB: 'bullB', ram: 'ram' }[p.key] || 'lambs';
  let n = 0;
  for (const s of st.crews[crew].slots) {
    if (!s.want || !s.actor) continue;
    const o = s.actor.object3D.position;
    if (o.y / AM > 24.5 && Math.abs(o.x / AM - 229.3) < 0.8) n++;
  }
  onTop[p.key] = n;
  if (n !== p.flesh) fails.push(`${p.key}: ${n} carriers on the east walk at ${time.format(time.t)}, want ${p.flesh}`);
}
out.onTop = onTop;

// ---------------------------------------------------------------------------------------------- 4. sweep
const everShown = Object.fromEntries(Object.keys(want).map((k) => [k, new Set()]));
const bad = new Map();
const note = (k, msg) => { const l = bad.get(k) || { n: 0, ex: [] }; l.n++; if (l.ex.length < 3) l.ex.push(msg); bad.set(k, l); };
const body = { min: [202, 306.5], max: [232, 336.5] };
let figs = 0;
const t0 = rcEv[0].t0 - 8.5, t1 = rcEv[4].t0 + 1;
for (let t = t0; t <= t1; t += 0.5) {
  time.set(t); await frames(1);
  const fig = [];
  for (const [k, pool] of [...Object.entries(st.crews), ...Object.entries(st.animals).map(([k, p]) => [`animal:${k}`, p])]) {
    for (const s of pool.slots) {
      if (!s.want || !s.actor) continue;
      if (everShown[k]) everShown[k].add(s.index);
      const o = s.actor.object3D.position;
      figs++;
      const X = o.x / AM, Y = -o.z / AM, Zs = o.y / AM;
      const pose = s._pose || '';
      fig.push({ k, i: s.index, x: o.x, z: o.z, y: o.y, pose, animal: !!pool.spec.animal });
      if (X > body.min[0] && X < body.max[0] && Y > body.min[1] && Y < body.max[1] && Zs < 21.8) note(`${k} in the altar`, `${time.format(t)} #${s.index} ${r2(X)},${r2(Y)},${r2(Zs)} ${pose}`);
      if (/^(bound|struggle|lie)/.test(pose) && pool.spec.animal) continue;
      const inside = ph.insideAt(o.x, o.y + 1.0, o.z);
      const f = ph.levelFloor(o.x, o.z, o.y);
      const off = f == null ? NaN : o.y - f;
      if (inside) note(`${k} inside a solid`, `${time.format(t)} #${s.index} ${r2(X)},${r2(Y)},${r2(Zs)} ${pose}`);
      else if (!(Math.abs(off) <= 0.15) && !(pool.spec.animal && off > 0.15)) note(`${k} off the floor`, `${time.format(t)} #${s.index} ${r2(X)},${r2(Y)},${r2(Zs)} off ${Number.isNaN(off) ? '-' : r2(off)} ${pose}`);
    }
  }
  // two figures in one place (a led animal is 0.6 m behind its man — the threshold is below that)
  for (let a = 0; a < fig.length; a++) for (let b = a + 1; b < fig.length; b++) {
    const A = fig[a], B = fig[b];
    if (Math.abs(A.y - B.y) > 0.6) continue;
    const d = Math.hypot(A.x - B.x, A.z - B.z);
    const lim = A.animal || B.animal ? 0.35 : 0.3;
    if (d < lim) note(`overlap ${A.k}/${B.k}`, `${time.format(t)} #${A.i}/#${B.i} ${r2(d)} m at ${r2(A.x / AM)},${r2(-A.z / AM)} ${A.pose}/${B.pose}`);
  }
}
for (const [k, n] of Object.entries(want)) if (everShown[k].size !== n) fails.push(`crew ${k}: ${everShown[k].size} of ${n} slots ever shown`);
out.sweep = { figures: figs, bad: Object.fromEntries([...bad].map(([k, l]) => [k, `${l.n}: ${l.ex.join(' | ')}`])) };
if (bad.size) fails.push(`sweep: ${[...bad.keys()].join(', ')}`);

// ---------------------------------------------------------------------------------------------- 5. determinism
const snap = () => {
  const o = [];
  for (const pool of [...Object.values(st.crews), ...Object.values(st.animals)]) for (const s of pool.slots) if (s.want && s.actor) { const p = s.actor.object3D.position; o.push(`${pool.name}${s.index}:${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}:${s._pose}`); }
  return o.sort().join('|');
};
const moments = [P.t.cut.bullA + 0.2, P.t.blood.goat?.[1], P.procs[0].top[1], P.procs[8].top[1] + 0.1, P.t.goatFats, rcEv[4].t0 + 2].filter(Number.isFinite);
const first = [];
for (const m of moments) { time.set(m); await frames(2); first.push(snap()); }
time.set(z.sunset + 30); await frames(2);
time.setDate('2026-11-02'); await frames(3);
time.setDate('2026-11-11'); await frames(3);
const diff = [];
for (let i = moments.length - 1; i >= 0; i--) { time.set(moments[i]); await frames(2); if (snap() !== first[i]) diff.push(time.format(moments[i])); }
out.determinism = { moments: moments.map((m) => time.format(m)), differ: diff };
if (diff.length) fails.push(`re-pose differs at ${diff}`);

out.errors = errs;
if (errs.length) fails.push(`console errors: ${errs.length}`);
out.fails = fails;
console.error = oe;
if (fails.length) throw new Error(`rosh-chodesh: ${fails.length} failure(s)\n${JSON.stringify(out, null, 1).slice(0, 6000)}`);
return out;

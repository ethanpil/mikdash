// Shared fire wants (sim.fireWant → lib/world.js FireBoard, resolved once per frame after every choreo's update):
//   1. arbitration (unit, a fake fx): the largest want wins; several wants of one owner in one update → its largest; a
//      fire nobody wants goes back to its builder's level (the spec's intensity); fx.setFire only on a change;
//   2. the live board: after jumps to times across a weekday and a Shabbat, every fire on the board holds the largest
//      of its wants (or its builder's level) and fx holds the same target; the same t reached by three jump orders
//      gives the same levels (determinism); after a jump fx is snapped (its current level = target × its schedule);
//   3. the hand-overs that used time-window hacks: the great pile at the night → dawn seam (altar-night → terumat-
//      hadeshen at muchni − 0.5), the kitchen hearth wanted by courts-daily and private-offerings at once (max-wins),
//      the fires nobody wants at midday (builder's levels);
//   4. cost: the runtime's per-frame cost (low tier) while playing at 60× through the dawn service, and the board's
//      resolve() alone.
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/fires.js "t=n3"
const rt = ctx.schedule.runtime, time = ctx.time;
const { FireBoard } = await import('/src/sim/lib/world.js');
const r3 = (x) => Math.round(x * 1000) / 1000;
const W = (t) => ((t % 1440) + 1440) % 1440;
const res = { unit: {}, live: {}, seams: {}, cost: {} };

// ---------------------------------------------------------------------------------------------- 1. unit
{
  const recs = new Map([['a', { spec: { intensity: 1 }, target: 1 }], ['b', { spec: { intensity: 0 }, target: 0 }], ['c', { spec: {}, target: 0.4 }]]);
  let calls = 0;
  const fx = { fires: recs, setFire(id, v) { calls++; recs.get(id).target = v; } };
  const B = new FireBoard({ fx });
  const w1 = B.slot('a', 'm1'), w2 = B.slot('a', 'm2'), w3 = B.slot('b', 'm1'), w4 = B.slot('c', 'm2'), w5 = B.slot('zzz', 'm1');
  const out = [];
  const step = (label, f) => { f(); B.resolve(); out.push(`${label}: a=${r3(recs.get('a').target)} b=${r3(recs.get('b').target)} c=${r3(recs.get('c').target)} calls=${calls}`); };
  step('no wants', () => {});
  step('a 0.3 / 0.7', () => { w1.v = 0.3; w2.v = 0.7; });
  step('a 0.3 only', () => { w2.v = NaN; });
  step('b 0.5, c 0', () => { w3.v = 0.5; w4.v = 0; w5.v = 1; });
  step('same again', () => {});
  step('all dropped', () => { w1.v = w3.v = w4.v = w5.v = NaN; });
  const expect = [
    'no wants: a=1 b=0 c=0.4 calls=0', 'a 0.3 / 0.7: a=0.7 b=0 c=0.4 calls=1', 'a 0.3 only: a=0.3 b=0 c=0.4 calls=2',
    'b 0.5, c 0: a=0.3 b=0.5 c=0 calls=4', 'same again: a=0.3 b=0.5 c=0 calls=4', 'all dropped: a=1 b=0 c=0.4 calls=7',
  ];
  // one owner calling twice in one update keeps its largest (runtime sim.fireWant)
  const e = rt.choreo('beit-avtinas');            // occasional: never relevant on the clock, so its wants persist
  e.sim.fireWant('altar.kitchen.fire', 0.2); e.sim.fireWant('altar.kitchen.fire', 0.9); e.sim.fireWant('altar.kitchen.fire', 0.4);
  const mine = rt.fires.state('altar.kitchen.fire')?.wants.find((x) => x.owner === 'beit-avtinas')?.v;
  for (const x of e.fireWants) x.v = NaN;          // drop it again
  res.unit = { ok: out.every((x, i) => x === expect[i]) && mine === 0.9, steps: out, ownerLargest: mine };
}

// ---------------------------------------------------------------------------------------------- 2. the live board
const fxRec = (id) => ctx.fx?.fires?.get?.(id);
function boardSnap() {
  const lines = [], bad = [];
  for (const F of rt.fires.list) {
    const rec = fxRec(F.id);
    if (!rec) continue;
    let v = NaN;
    for (const w of F.wants) if (w.v === w.v && !(w.v <= v)) v = w.v;
    const want = v === v ? Math.max(0, v) : F.def;
    if (Math.abs(want - F.value) > 1e-6) bad.push(`${F.id} board ${r3(F.value)} ≠ ${r3(want)}`);
    if (Math.abs(rec.target - F.value) > 1e-4) bad.push(`${F.id} fx ${r3(rec.target)} ≠ board ${r3(F.value)}`);
    // a fire nobody wants at its builder's level is the same as one not (yet) on the board: not listed
    const wl = F.wants.filter((w) => w.v === w.v);
    if (wl.length || Math.abs(F.value - F.def) > 1e-6) lines.push(`${F.id}=${r3(F.value)}[${wl.map((w) => `${w.owner}:${r3(w.v)}`).join(',')}]`);
  }
  return { lines, bad };
}
const at = async (t) => { time.set(W(t)); await frames(3); return boardSnap(); };
for (const [label, date] of [['weekday', '2026-11-02'], ['shabbat', '2026-11-07']]) {
  time.setDate(date); await frames(4);
  const z = time.zmanim;
  const mu = ctx.schedule.byId('muchni'), sp = ctx.schedule.byId('second-pile');
  const ts = [15, 120, mu.t0 - 9.5, mu.t0 - 3, mu.t0 - 0.6, mu.t0 - 0.4, mu.t0 + 1, sp.t1 - 1, sp.t1 + 1, z.sunrise + 63, z.sunrise + 66,
    time.resolve({ dayHour: 3 }), time.resolve({ dayHour: 5.5 }), time.resolve({ dayHour: 9.2 }), time.resolve({ dayHour: 9.4 }), z.sunset + 30, z.tzeit + 90, 1395];
  const A = {}, B = {}, C = {}, bad = [];
  // a first pass puts every fire some choreo wants on the board (an entry is made on its first want)
  for (const t of ts) await at(t);
  for (const t of ts) { A[t] = await at(t); bad.push(...A[t].bad.map((x) => `${time.format(W(t))} ${x}`)); }
  for (const t of [...ts].reverse()) B[t] = await at(t);
  for (const t of ts) { await at(t + 600); C[t] = await at(t); }
  const diffs = [];
  for (const t of ts) {
    const a = A[t].lines.join(' '), b = B[t].lines.join(' '), c = C[t].lines.join(' ');
    if (a !== b || a !== c) diffs.push({ t: time.format(W(t)), a: A[t].lines.find((x, i) => x !== B[t].lines[i] || x !== C[t].lines[i]), b: B[t].lines.find((x, i) => x !== A[t].lines[i]), c: C[t].lines.find((x, i) => x !== A[t].lines[i]) });
  }
  // after a jump fx is snapped: its current level is the target (× its schedule factor) in the frame after
  time.set(W(mu.t0 - 3)); await frames(2);
  const g = fxRec('altar.maarachah.great');
  const snapped = g ? Math.abs(g.cur - g.target) < 1e-3 : null;
  res.live[label] = {
    fires: rt.fires.list.length, consistent: bad.length === 0, bad: bad.slice(0, 6), deterministic: diffs.length === 0, diffs: diffs.slice(0, 4), snapped,
    sample: Object.fromEntries(ts.slice(0, 6).map((t) => [time.format(W(t)), A[t].lines.filter((l) => /maarachah|kitchen|lamp-0|lamp-1/.test(l)).join(' ')])),
  };
}

// ---------------------------------------------------------------------------------------------- 3. the seams
{
  time.setDate('2026-11-02'); await frames(4);
  const mu = ctx.schedule.byId('muchni');
  const level = (id) => rt.fires.state(id)?.value;
  // the great pile through the night → dawn seam, every 0.05 min: no step over 0.05 (fx eases, but the wants must not jump)
  const seam = [];
  let prev = null, maxStep = 0;
  for (let t = mu.t0 - 1.5; t <= mu.t0 + 0.6 + 1e-9; t += 0.05) {
    time.set(W(t)); await frames(2);
    const v = [level('altar.maarachah.great'), level('altar.maarachah.great.inner'), level('altar.maarachah.incense'), level('altar.maarachah.kiyum')];
    const own = rt.fires.state('altar.maarachah.great')?.wants.map((w) => w.owner).join('+') || 'builder';
    if (prev) maxStep = Math.max(maxStep, ...v.map((x, i) => Math.abs(x - prev[i])));
    prev = v;
    seam.push(`${time.format(W(t))}:${t.toFixed(2).slice(-5)} ${v.map(r3).join('/')} ${own}`);
  }
  // the kitchen hearth: every minute of the day where both courts-daily and private-offerings want it
  const both = [];
  let checked = 0, wrong = 0;
  for (let t = 0; t < 1440; t += 1) {
    time.set(t); await frames(1);
    const s = rt.fires.state('altar.kitchen.fire');
    if (!s) continue;
    const owners = s.wants.map((w) => w.owner);
    if (owners.includes('courts-daily') && owners.includes('private-offerings')) {
      checked++;
      const m = Math.max(...s.wants.map((w) => w.v));
      if (Math.abs(s.value - m) > 1e-6) wrong++;
      if (both.length < 4) both.push(`${time.format(t)} ${s.wants.map((w) => `${w.owner}:${r3(w.v)}`).join(',')} → ${r3(s.value)}`);
    }
  }
  // midday on a weekday: the great pile and the incense pile are nobody's: the builder's levels
  time.set(time.resolve({ dayHour: 5 })); await frames(3);
  const mid = ['altar.maarachah.great', 'altar.maarachah.great.inner', 'altar.maarachah.incense', 'altar.maarachah.kiyum'].map((id) => { const s = rt.fires.state(id); return `${id.split('.').pop()} ${r3(s?.value)} (builder ${r3(s?.def)}, wants ${s?.wants.length})`; });
  res.seams = { dawn: { maxStep: r3(maxStep), ok: maxStep < 0.05, around: seam.filter((_, i) => i % 6 === 0 || /0\.4|0\.5|0\.6/.test(seam[i])).slice(0, 16) }, kitchen: { minutesBoth: checked, wrong, examples: both }, midday: mid };
}

// ---------------------------------------------------------------------------------------------- 4. cost
{
  time.setDate('2026-11-02'); await frames(3);
  const z = time.zmanim;
  ctx.player.teleport({ at: [230, 300] }); await frames(5);
  time.set(W(z.alot - 55)); await frames(3);
  time.setSpeed(60); time.pause(false);
  const ms = [];
  const until = W(z.alot - 5);
  let resolveMs = [];
  for (let i = 0; i < 2000; i++) {
    await frames(1);
    if (i >= 30) ms.push(rt.stats.last);        // (the first frames rebuild the date's plans: not per-frame work)
    if (i % 25 === 0) { const a = performance.now(); for (let k = 0; k < 200; k++) rt.fires.resolve(); resolveMs.push((performance.now() - a) / 200); }
    if (W(time.t - until) < 2) break;
  }
  time.pause(true);
  ms.sort((a, b) => a - b); resolveMs.sort((a, b) => a - b);
  res.cost = { frames: ms.length, avg: r3(ms.reduce((a, b) => a + b, 0) / ms.length), p50: r3(ms[Math.floor(ms.length / 2)]), p95: r3(ms[Math.floor(ms.length * 0.95)]), max: r3(ms[ms.length - 1]),
    resolveMs: r3(resolveMs[Math.floor(resolveMs.length / 2)] ?? NaN), fires: rt.fires.list.length };
}
res.ok = res.unit.ok && Object.values(res.live).every((x) => x.consistent && x.deterministic && x.snapped !== false) && res.seams.dawn.ok && res.seams.kitchen.wrong === 0;
return res;

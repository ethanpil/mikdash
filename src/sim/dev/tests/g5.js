// G5 — the individuals' offerings (choreo 'private-offerings'):
//   determinism: the same t by different jump orders gives identical figures, free props and fires;
//   cues: continuous play at 120x fires every planned cue in the played span exactly once, jumps fire none;
//   cost: the module's own update time per frame while playing;
//   schedule: dynamic sub-events in active()/at()/byId(), not in upcoming() unless asked;
//   graph: every authored corridor checked against nav (a much longer nav path means the straight leg is blocked).
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/g5.js "t=sunrise+150"
const rt = ctx.schedule.runtime, time = ctx.time, sch = ctx.schedule;
const e = rt.choreo('private-offerings');
if (!e) return { error: 'no private-offerings choreo' };
time.set(time.parse('sunrise+150')); await frames(3);
const S = e.state, P = S.plan;
if (!P?.ok) return { error: 'no plan', debug: e.mod.debug(S) };
const r3 = (x) => Math.round(x * 1000) / 1000;
const out = { debug: e.mod.debug(S), planMs: r3(P.ms), insts: P.insts.length, missing: P.missing, dropped: P.dropped };

// ---------------------------------------------------------------- determinism
function snap() {
  const figs = [];
  for (const p of e.pools) for (const s of p.slots) {
    if (!s.want) continue;
    const o = s.actor?.object3D;
    figs.push(`${p.name}#${s.index} ${r3(o.position.x)},${r3(o.position.y)},${r3(o.position.z)} h${r3(s._heading)} ${s._pose}${Number.isNaN(s._phase) ? '' : '@' + r3(s._phase)} ${s._pkey || ''} ${s._lead ? 'lead' : ''}`);
  }
  const props = [];
  const F = S.free;
  for (const n in F.hung) F.hung[n].forEach((f, i) => f?.on && props.push(`${n}#${i} ${r3(f.a.object3D.position.x)},${r3(f.a.object3D.position.z)}`));
  for (const n in F.cage) F.cage[n].forEach((f, i) => f?.on && props.push(`${n}#${i} ${r3(f.a.object3D.position.x)},${r3(f.a.object3D.position.z)}`));
  if (F.basket[0]?.on) props.push('basket');
  // the fires this module wants at t (a pure function of t; what it last wrote depends on the jump history)
  const fires = [...S.fires].sort().map(([k, v]) => `${k}=${r3(Math.max(0, v))}`);
  return { figs, props, fires };
}
const T = [];
const pickAt = (inst, f) => inst.t0 + f * (inst.t1 - inst.t0);
for (const k of [0, 3, 7, 12, 20, 33, 47, 60, 75, 90, 110, 130, 150]) { const inst = P.insts[Math.min(k, P.insts.length - 1)]; T.push(pickAt(inst, 0.11 + (k % 7) * 0.12)); }
// moments inside particular stages: the binding, the carry to the hook, the sovev, a toss on the pile, a bird nipped
for (const id of ['shechitah', 'hefshet', 'matanot', 'haalaah', 'melikah', 'tenufah', 'kemitzah', 'notar']) {
  const inst = P.insts.find((x) => x.steps.some((s) => s.id === id));
  const st = inst?.steps.find((s) => s.id === id);
  if (st) T.push(st.t0 + 0.37 * (st.t1 - st.t0));
}
const tOf = (x) => ((x % 1440) + 1440) % 1440;
const at = async (x) => { time.set(tOf(x)); await frames(3); return snap(); };
const A = {}, B = {}, C = {};
for (const x of T) A[x] = await at(x);
for (const x of [...T].reverse()) B[x] = await at(x);
for (const x of T) { await at(time.parse('d6.5')); C[x] = await at(x); }
const diffs = [];
for (const x of T) {
  const a = JSON.stringify(A[x]), b = JSON.stringify(B[x]), c = JSON.stringify(C[x]);
  if (a !== b || a !== c) diffs.push({ t: time.format(tOf(x)), a: A[x].figs.length, b: B[x].figs.length, c: C[x].figs.length, firstA: A[x].figs.find((f, i) => f !== B[x].figs[i] || f !== C[x].figs[i]), firstB: B[x].figs.find((f, i) => f !== A[x].figs[i]), firstC: C[x].figs.find((f, i) => f !== A[x].figs[i]), props: JSON.stringify(A[x].props) === JSON.stringify(C[x].props) && JSON.stringify(A[x].props) === JSON.stringify(B[x].props) ? '' : JSON.stringify([A[x].props, B[x].props, C[x].props]), fires: `${A[x].fires}|${B[x].fires}|${C[x].fires}` });
}
out.determinism = { times: T.length, deterministic: diffs.length === 0, diffs: diffs.slice(0, 5), figuresAt: T.map((x) => `${time.format(tOf(x))}:${A[x].figs.length}/${A[x].props.length}`).join(' ') };

// ---------------------------------------------------------------- cues at 120x (and the cost per frame)
const calls = [], caps = [];
const audio = ctx.audio, oc = audio.cue;
audio.cue = (id, pos, o) => { calls.push({ id, t: +time.t.toFixed(3), pos: Array.isArray(pos) ? pos.map((v) => +v.toFixed(1)).join(',') : '' }); return oc.call(audio, id, pos, o); };
ctx.bus.on('caption', (c) => caps.push({ id: c.id, t: +time.t.toFixed(2) }));
ctx.player.teleport({ at: [238, 345, 16] });
const SPEED = +(globalThis.__simSpeed || 120);
const start = P.win.a + 4, playMin = +(globalThis.__playMin || 70);
time.pause(true); time.set(start); await frames(3);
const firedBefore = new Set(e.handle.fired.keys());
const orig = e.mod.update;
const ms = [];
const rebuilt = [];
e.mod.update = function (...args) {
  const p0 = e.state.plan, t0 = performance.now(); const r = orig.apply(this, args); const d = performance.now() - t0;
  ms.push(d);
  if (e.state.plan !== p0) rebuilt.push({ t: time.format(time.t), ms: +d.toFixed(1), gen: e.state.planGen });
  return r;
};
time.setSpeed(SPEED); time.pause(false);
let played = 0, prev = time.t;
while (played < playMin) { await frames(1); played += ((time.t - prev) + 1440) % 1440; prev = time.t; }
time.pause(true);
e.mod.update = orig;
const end = time.t;
const planned = P.cues.filter((c) => c.t > start && c.t <= end);
const firedKeys = [...e.handle.fired.keys()].filter((k) => !firedBefore.has(k));
const plannedKeys = new Set(planned.map((c) => `${c.key || c.id}:${c.inst.id}`));
const missingCues = [...plannedKeys].filter((k) => !firedKeys.includes(k));
const dup = [];
const seen = new Map();
for (const c of calls) { const k = `${c.id}@${c.pos}`; const l = seen.get(k); if (l !== undefined && Math.abs(c.t - l) < 0.05) dup.push(c); seen.set(k, c.t); }
// jumps across cue moments fire nothing
const before = calls.length + caps.length;
for (const c of P.cues.slice(5, 12)) { time.set(c.t - 0.05); await frames(2); time.set(c.t + 0.05); await frames(2); }
const jumpFired = calls.length + caps.length - before;
ms.sort((a, b) => a - b);
const pct = (p) => +(ms[Math.min(ms.length - 1, Math.floor(p * ms.length))] || 0).toFixed(3);
out.cues = { speed: SPEED, played: `${time.format(start)}–${time.format(end)}`, planned: planned.length, fired: firedKeys.length, missing: missingCues.slice(0, 6), uniqueFired: new Set(firedKeys).size,
  sounds: calls.length, captions: caps.filter((c) => String(c.id).startsWith('g5-')).length, doubles: dup.slice(0, 4), jumpFired };
out.cost = { rebuilt, updates: ms.length, avg: +(ms.reduce((a, b) => a + b, 0) / Math.max(1, ms.length)).toFixed(3), p50: pct(0.5), p95: pct(0.95), max: pct(1), ema: +e.ms.toFixed(3) };

// ---------------------------------------------------------------- the schedule API
const tq = P.insts[40] ? pickAt(P.insts[40], 0.4) : start + 30;
time.set(tq); await frames(2);
const act = sch.active(tq), dyn = act.filter((x) => x.dynamic);
const parents = new Set(sch.events.map((x) => x.id));
out.schedule = {
  t: time.format(tq), active: act.length, dynamic: dyn.length, staticFirst: act.findIndex((x) => x.dynamic) >= act.filter((x) => !x.dynamic).length,
  uniqueIds: new Set(dyn.map((x) => x.id)).size === dyn.length, parentsKnown: dyn.every((x) => parents.has(x.parent)),
  views: dyn.every((x) => Array.isArray(x.view?.at)), zones: [...new Set(dyn.map((x) => x.zone))].join(','),
  sample: dyn.slice(0, 4).map((x) => `${x.title.en} | ${x.summary} | ${x.zone} | ${x.parent}`),
  atSlaughter: sch.at('slaughter-zone', tq).filter((x) => x.dynamic).length, atNoDyn: sch.at('slaughter-zone', tq, { dynamic: false }).filter((x) => x.dynamic).length,
  byId: !!(dyn[0] && sch.byId(dyn[0].id) === dyn[0]), upcoming: sch.upcoming(tq, 6).some((x) => x.dynamic), upcomingDyn: sch.upcoming(tq, 6, { dynamic: true }).filter((x) => x.dynamic).length,
  dynamicOnly: sch.dynamic(tq).length,
};

// ---------------------------------------------------------------- the watchable rows: live only while a step is, zones on the altar
{
  const bad = [];
  let n = 0;
  for (let x = P.win.a; x < P.win.endAll; x += 3) {
    // this module's rows only (other modules register dynamic sources too: G4's sets as 'set:…')
    for (const ev of sch.dynamic(x)) {
      const inst = P.insts.find((i) => i.id === ev.id);
      if (!inst) continue;
      n++;
      const st = inst.steps[ev.stepIndex];
      if (!(x < inst.tEnd)) bad.push(`${time.format(x)} ${ev.id} after its last step`);
      else if (ev.pos && ev.pos[2] > 19.5 && st && ev.zone !== st.zone) bad.push(`${time.format(x)} ${ev.id} ${st.id} at Z ${ev.pos[2].toFixed(1)} zone ${ev.zone} ≠ ${st.zone}`);
      else if (!ev.summary || !ev.view?.at) bad.push(`${time.format(x)} ${ev.id} no summary/view`);
    }
  }
  out.rows = { checked: n, ok: bad.length === 0, bad: bad.slice(0, 6) };
}

// ---------------------------------------------------------------- the plan's rules, and nobody standing in anybody, on several dates
const { segAt, sampleSeg } = await import('/src/sim/choreo/g5/track.js');
const ANIMAL = new Set(['lamb', 'ram', 'goat']);
/** every G5 figure at every 0.04 min: pairs closer than 0.85 amah (41 cm between body centres) */
function sweep(P2, thr = 0.85, step = 0.04) {
  const hum = P2.tracks.filter((tr) => tr.slot >= 0 && !ANIMAL.has(tr.pool)).sort((a, b) => a.t0 - b.t0);
  const found = new Map(), o = {}, tmp = {};
  let idx = 0, active = [];
  const T1 = Math.max(...hum.map((h) => h.t1));
  for (let x = hum[0].t0; x < T1; x += step) {
    while (idx < hum.length && hum[idx].t0 <= x) active.push(hum[idx++]);
    active = active.filter((tr) => tr.t1 > x);
    const pts = [];
    for (const tr of active) {
      const k = segAt(tr.segs, x);
      if (k < 0) continue;
      const q = sampleSeg(tr.segs[k], x, o, tmp);
      pts.push({ tr, X: q.X, Y: q.Y, Z: q.Z, walk: tr.segs[k].kind === 1 });
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if (Math.abs(a.Z - b.Z) > 2 || Math.hypot(a.X - b.X, a.Y - b.Y) >= thr) continue;
      const kind = !a.walk && !b.walk ? 'stand' : a.walk && b.walk ? 'cross' : 'walkby';
      const key = `${kind}|${a.tr.inst === b.tr.inst ? 'same' : 'diff'}|${a.tr.inst.id}/${a.tr.role}|${b.tr.inst.id}/${b.tr.role}`;
      if (!found.has(key)) found.set(key, `${time.format(x)} ${a.X.toFixed(1)},${a.Y.toFixed(1)}`);
    }
  }
  const count = {};
  for (const k of found.keys()) { const c = k.split('|').slice(0, 2).join('|'); count[c] = (count[c] || 0) + 1; }
  return { count, stand: [...found].filter(([k]) => k.startsWith('stand')).slice(0, 5).map(([k, v]) => `${k} ${v}`) };
}
const dateNow = time.dateString;
out.rules = {};
for (const date of [dateNow, '2026-11-06', '2026-06-15']) {
  if (time.dateString !== date) { time.setDate(date); await frames(3); }
  time.set(time.parse('sunrise+150')); await frames(2);
  const P2 = e.state.plan;
  if (!P2?.ok) { out.rules[date] = 'no plan'; continue; }
  // the mother's bird chatat is offered before her lamb olah comes in (Zevachim 90a)
  const yol = P2.insts.filter((x) => x.kind === 'bird' && x.job?.linked);
  const yolBad = yol.filter((x) => {
    const mel = x.steps.find((s) => s.id === 'melikah'), lamb = P2.insts.find((y) => y.id === x.link);
    return !lamb || !mel || mel.t1 > lamb.steps[0].t0;
  }).map((x) => x.id);
  const sw = sweep(P2);
  out.rules[date] = {
    offerings: P2.insts.length, planMs: Math.round(P2.ms), missing: P2.missing,
    yoledet: `${yol.length - yolBad.length}/${yol.length} chatat first`, yolBad,
    ashamNotRam: P2.insts.filter((x) => x.type === 'asham' && x.species !== 'ram').length,
    goatMostHoly: P2.insts.filter((x) => x.species === 'goat' && ['olah', 'chatat', 'asham'].includes(x.type)).length,
    goatFleece: P2.props.filter((p) => p.kind === 'hung' && p.name !== 'carcass_hung' && p.inst.species === 'goat').length,
    birdsUnbrought: P2.insts.filter((x) => x.kind === 'bird' && !x.job?.set && x.job?.source === 'bringer' && !x.tracks.some((tr) => tr.role === 'O')).length,
    birdSources: P2.insts.filter((x) => x.kind === 'bird').reduce((m, x) => { m[x.job?.source] = (m[x.job?.source] || 0) + 1; return m; }, {}),
    overlaps: sw.count, standing: sw.stand,
  };
}
if (time.dateString !== dateNow) { time.setDate(dateNow); await frames(3); }

// ---------------------------------------------------------------- the authored corridors against nav
for (let i = 0; i < 160 && !ctx.nav?.isReady; i++) await sleep(250);
const { m2w, AMAH } = await import('/src/core/units.js');
const G = S.G, bad = [];
let checked = 0;
if (ctx.nav?.isReady) {
  const seen2 = new Set();
  for (const a of Object.keys(G.N)) {
    for (const b of Object.keys(G.N)) {
      if (a >= b) continue;
      const r = G.route(a, b);
      if (r.ids.length !== 2) continue;          // direct edges only
      if (seen2.has(`${a}|${b}`)) continue;
      seen2.add(`${a}|${b}`);
      const A2 = G.N[a], B2 = G.N[b];
      if (A2.Z > 21 || B2.Z > 21) continue;       // the altar top, sovev and upper ramp: nav is not the authority there
      const p = ctx.nav.findPath(m2w(A2.X, A2.Y, A2.Z), m2w(B2.X, B2.Y, B2.Z));
      checked++;
      const straight = Math.hypot(A2.X - B2.X, A2.Y - B2.Y) * AMAH;
      let len = 0;
      if (p) for (let k = 1; k < p.length; k++) len += Math.hypot(p[k].x - p[k - 1].x, p[k].z - p[k - 1].z);
      if (!p || len > straight * 1.3 + 1.5) bad.push(`${a}-${b} straight ${straight.toFixed(1)} m nav ${p ? len.toFixed(1) : 'none'}`);
    }
  }
}
out.graph = { navReady: !!ctx.nav?.isReady, edgesChecked: checked, suspect: bad };
return out;

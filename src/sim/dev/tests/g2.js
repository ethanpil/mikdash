// Group G2 (dawn altar and both temidim): terumat-hadeshen, barkai, tamid-morning, tamid-afternoon, gazit-shema.
//   1. determinism — the same t reached by different jump orders gives identical figures (position, heading, pose,
//      phase, props), free props, the kiyor, the silver pan, the two logs and the Moked's wicket;
//   2. ways — every leg a figure walks at its authored Z (Script.exact) is sampled against the physics floor: a
//      mismatch means a table, pile, pillar, wall or channel in the way (stairs legs query the floor and are skipped);
//   3. faces — no man (pool seed × slot, any module) wanted in two places at once, through the dawn, the Shema, the
//      limbs and the afternoon;
//   4. hand-over — the tamid's men walk into the Gazit and are never missing between tamid-morning and gazit-shema;
//      nobody in the Gazit stands above its floor;
//   5. cues — continuous play at 120× through the dawn service and the afternoon tamid: every cue key fires once,
//      no sound twice at the same moment, none on jumps;
//   6. cost — the five modules' update time per frame (runtime EMA per entry, summed) during that play.
// run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/g2.js "date=2026-11-02&t=alot-60"   (and a Shabbat date)
const rt = ctx.schedule.runtime;
const IDS = ['terumat-hadeshen', 'barkai', 'tamid-morning', 'tamid-afternoon', 'gazit-shema'];
const E = IDS.map((id) => rt.choreo(id));
if (E.some((e) => !e || e.failed)) return { error: 'module missing or failed', ids: IDS.map((id) => `${id}:${!!rt.choreo(id)}:${rt.choreo(id)?.failed}`) };
const AM = 0.48;
const r3 = (x) => Math.round(x * 1000) / 1000;
const tOf = (s) => (typeof s === 'number' ? ((s % 1440) + 1440) % 1440 : ctx.time.parse(s));
const fmt = (t) => `${ctx.time.format(t)}+${(t % 1).toFixed(2)}`;
const dayType = ctx.time.dayType;

function snap() {
  const figs = [];
  for (const e of E) for (const p of e.pools) for (const s of p.slots) {
    if (!s.want) continue;
    const o = s.actor.object3D.position;
    figs.push(`${e.id}/${p.name}#${s.index} ${r3(o.x)},${r3(o.y)},${r3(o.z)} h${r3(s._heading)} ${s._pose}${Number.isNaN(s._phase) ? '' : '@' + r3(s._phase)} ${s._g2r || ''}/${s._g2l || ''}`);
  }
  const props = [];
  for (const e of E) {
    const fp = e.state?.props;
    if (!fp) continue;
    for (const it of fp.items) if (it.slot.vis) props.push(`${e.id}:${it.name} ${r3(it.slot.X)},${r3(it.slot.Y)},${r3(it.slot.Z)} h${r3(it.slot.h)}`);
  }
  const mv = (id) => ctx.movables.get(id);
  return {
    figs, props,
    kiyor: r3(mv('altar.kiyor')?.userData?.raised?.() ?? -1), pan: !!mv('altar.machtah')?.visible, logs: !!mv('altar.two-logs')?.visible,
    wicket: r3(mv('door:azarah.gate.moked.pishpash')?.userData?.openAmount ?? -1),
  };
}
const at = async (s) => { ctx.time.set(tOf(s)); await frames(3); return snap(); };

// ---- 1. determinism
const T = ['alot-52', 'alot-49.3', 'alot-46', 'alot-43.3', 'alot-40.1', 'alot-38.2', 'alot-35', 'alot-30', 'alot-24', 'alot-21.5', 'alot-17', 'alot-13', 'alot-11.2',
  'alot+6', 'alot+8.2', 'alot+13', 'alot+15.5', 'alot+19', 'sunrise-30', 'sunrise-21', 'sunrise-15', 'sunrise-11.5', 'sunrise-3', 'sunrise+0.2', 'sunrise+1.7', 'sunrise+5.2',
  'sunrise+6.4', 'sunrise+9', 'sunrise+14.5', 'sunrise+19', 'sunrise+24', 'sunrise+27.6', 'sunrise+30', 'sunrise+36', 'sunrise+41', 'sunrise+72', 'sunrise+77', 'sunrise+83', 'sunrise+90',
  'd8.25', 'd8.45', 'd8.52', 'd8.7', 'd8.95', 'd9.2', 'd9.53', 'd9.62', 'd9.75', 'd9.9', 'tzeit-14', 'tzeit-12.5', 'n3'];
const A = {}, B = {}, C = {};
for (const s of T) A[s] = await at(s);
for (const s of [...T].reverse()) B[s] = await at(s);
for (const s of T) { await at('d4'); C[s] = await at(s); }
const diffs = [];
for (const s of T) {
  const a = JSON.stringify(A[s]), b = JSON.stringify(B[s]), c = JSON.stringify(C[s]);
  if (a !== b || a !== c) {
    const fa = A[s].figs, fb = B[s].figs, fc = C[s].figs;
    diffs.push({ t: s, n: [fa.length, fb.length, fc.length], fig: fa.find((x, i) => x !== fb[i] || x !== fc[i]), figB: fb.find((x, i) => x !== fa[i]), figC: fc.find((x, i) => x !== fa[i]),
      props: A[s].props.join('|') === B[s].props.join('|') && A[s].props.join('|') === C[s].props.join('|') ? 'same' : 'DIFF', mv: [A[s].kiyor, B[s].kiyor, C[s].kiyor, A[s].pan, B[s].pan, C[s].pan, A[s].logs, B[s].logs, C[s].logs, A[s].wicket, B[s].wicket, C[s].wicket].join(',') });
  }
}
const summary = {};
for (const s of T) {
  const count = {};
  for (const f of A[s].figs) { const k = f.split('#')[0]; count[k] = (count[k] || 0) + 1; }
  summary[s] = `${ctx.time.format(tOf(s))} ${JSON.stringify(count)} props ${A[s].props.length} kiyor ${A[s].kiyor} pan ${A[s].pan} logs ${A[s].logs}`;
}

// ---- 2. the ways: exact-Z legs against the physics floor
const ph = ctx.physics;
const floor = (X, Y, Z) => { const y = ph.standFloor(X * AM, -Y * AM, Z * AM, true); return Number.isFinite(y) ? y / AM : null; };
const scriptsOf = (id) => {
  const st = rt.choreo(id)?.state; const P = st?.plan; if (!P) return [];
  const out = [], seen = new Set();
  const push = (x) => { if (!x || seen.has(x)) return; if (Array.isArray(x)) { x.forEach(push); return; } if (x.steps) { seen.add(x); out.push(x); return; } if (typeof x === 'object' && !x.isVector3) for (const k of Object.keys(x)) if (k !== 'P') push(x[k]); };
  push(P);
  return out;
};
const ways = new Map();
let waySamples = 0;
for (const id of IDS) for (const S of scriptsOf(id)) S.steps.forEach((st, k) => {
  if (!st.zx) return;
  const head = rt.choreo('tamid-morning').state.P.ramp.head;
  const test = (X, Y, Z, what) => {
    // the ramp stands a hair's breadth off the altar (Zevachim 62b): its seam at the head is not a step
    if (Math.abs(Y - head) < 0.25 && Z > 24) return;
    waySamples++;
    const f = floor(X, Y, Z);
    if (f == null || Math.abs(f - Z) > 0.25) {
      const key = `${id}/${S.name}#${k} ${what}`;
      if (!ways.has(key)) ways.set(key, `${key} @${X.toFixed(1)},${Y.toFixed(1)} Z${Z.toFixed(2)} floor ${f == null ? '-' : f.toFixed(2)}`);
    }
  };
  if (st.kind === 'walk') for (let d = 0; d <= st.L; d += 0.25) { const p = st.path.sample(d, {}); test(p.X, p.Y, p.Z, 'walk'); }
  else if (st.kind === 'act' && st.d > 0.02) test(st.pos[0], st.pos[1], st.pos[2], st.pose);
});
// the dead lamb carried before the flayer's chest is meant to be off the floor
const wayBad = [...ways.values()].filter((v) => !/\/lamb#/.test(v));

// ---- 3. faces: no man in two places (every module's pools, kohanic roles)
const faceOf = (p, s) => `${p.spec.role || p.spec.animal}:${((p.spec.seed ?? 1) * 7919 + s.index * 104729) >>> 0}`;
const twice = new Map();
async function faces(a, b, step) {
  const t0 = tOf(a), len = (tOf(b) - t0 + 1440) % 1440;
  for (let d = 0; d <= len; d += step) {
    const t = (t0 + d) % 1440;
    ctx.time.set(t); await frames(1);
    const where = new Map();
    for (const e of rt.entries) for (const p of e.pools || []) {
      if (p.spec.animal) continue;
      for (const s of p.slots) {
        if (!s.want) continue;
        const k = faceOf(p, s), here = `${e.id}/${p.name}#${s.index}`;
        if (where.has(k)) { const key = `${where.get(k)} & ${here}`; if (!twice.has(key)) twice.set(key, fmt(t)); } else where.set(k, here);
      }
    }
  }
}
await faces('alot-55', 'sunrise+50', 0.25);
await faces('sunrise+66', 'sunrise+100', 0.25);
await faces('d8.15', 'd10.1', 0.25);

// ---- 4. the Gazit hand-over, and the Gazit's floor
const tm = rt.choreo('tamid-morning'), gs = rt.choreo('gazit-shema');
const gIn = tm.state.plan.M.t.gazitIn;
const sr = ctx.time.zmanim.sunrise;
const gap = [], high = [];
const crewPool = (e) => e.pools.find((p) => p.name === 'crew' || p.name === 'tamid-crew');
{
  const lo = Math.min(...gIn.filter(Number.isFinite)) - 1, hi = Math.max(...gIn.filter(Number.isFinite)) + 1.5;
  const lastSeen = new Map();
  for (let t = lo; t <= hi; t += 0.02) {
    ctx.time.set(((t % 1440) + 1440) % 1440); await frames(1);
    const a = crewPool(tm), b = crewPool(gs);
    for (const slot of [0, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const v = a.slots[slot].want || b.slots[slot].want;
      if (t > gIn[slot] - 0.6 && t < gIn[slot] + 1 && !v) gap.push(`crew#${slot} missing ${fmt(t)} (gazitIn ${fmt(gIn[slot])})`);
      if (a.slots[slot].want && b.slots[slot].want) gap.push(`crew#${slot} twice ${fmt(t)}`);
      lastSeen.set(slot, v);
    }
    for (const e of [gs]) for (const p of e.pools) for (const s of p.slots) {
      if (!s.want) continue;
      const o = s.actor.object3D.position, X = o.x / AM, Y = -o.z / AM, Z = o.y / AM;
      if (X < 92 && Z > 16.3) high.push(`${e.id}/${p.name}#${s.index} ${fmt(t)} @${X.toFixed(1)},${Y.toFixed(1)},${Z.toFixed(2)}`);
    }
  }
  void sr;
}

// ---- 5. cues at 120x (dawn: muchni → limbs up; afternoon: fetch → limbs) + 6. cost
const SPEED = +(globalThis.__simSpeed || 120);
const calls = [], caps = [];
const audio = ctx.audio;
const origCue = audio.cue;
const slowCue = [];
audio.cue = (id, pos, opts) => {
  calls.push({ id, t: +ctx.time.t.toFixed(3), pos: Array.isArray(pos) ? pos.map((v) => +v.toFixed(1)).join(',') : '' });
  const u = performance.now(); const r = origCue.call(audio, id, pos, opts); const ms = performance.now() - u;
  if (ms > 1) slowCue.push(`${ctx.time.format(ctx.time.t)} ${id} ${ms.toFixed(1)} ms`);
  return r;
};
const offCap = ctx.bus.on?.('caption', (e) => caps.push({ id: e.id, t: +ctx.time.t.toFixed(2) }));
const fired = {};
const cost = [], spikes = [];
async function play(from, to, stand) {
  ctx.player.teleport({ at: stand });
  ctx.time.set(tOf(from)); await frames(3);
  for (const e of E) e.handle.fired.clear();
  ctx.time.setSpeed(SPEED); ctx.time.pause(false);
  const len = (tOf(to) - tOf(from) + 1440) % 1440;
  let prev = ctx.time.t, played = 0;
  while (played < len) {
    await frames(1);
    const t = ctx.time.t;
    played += (t - prev + 1440) % 1440; prev = t;
    let sum = 0;
    for (const e of E) sum += e.relevant ? e.ms : 0;
    cost.push(sum);
    if (sum > 0.45) spikes.push(`${ctx.time.format(t)} ${sum.toFixed(3)} ${E.filter((e) => e.relevant).map((e) => `${e.id}:${e.ms.toFixed(2)}`).join(' ')}`);
  }
  ctx.time.pause(true);
  for (const e of E) for (const k of e.handle.fired.keys()) fired[`${e.id}/${k}`] = (fired[`${e.id}/${k}`] || 0) + 1;
}
await play('alot-53', 'sunrise+92', [216, 330]);
await play('d8.15', 'd9.9', [222, 330]);
// the Gazit's lines with the player there
await play('sunrise+24', 'sunrise+45', [80, 381]);
ctx.time.setSpeed(1);
// jumps across cue moments fire nothing
const before = calls.length, capsBefore = caps.length;
const th = rt.choreo('terumat-hadeshen').state.plan;
for (const s of [th.tWheel - 0.3, th.tWheel + 0.3, th.tPour + 0.2, 'alot+7.4', 'alot+7.8', 'sunrise+0.4', 'sunrise+0.8']) { ctx.time.set(tOf(s)); await frames(2); }
const jumpCalls = calls.length - before, jumpCaps = caps.length - capsBefore;
offCap?.();
const count = {};
for (const c of calls) count[c.id] = (count[c.id] || 0) + 1;
const dup = [];
const seen = new Map();
for (const c of calls) { const k = `${c.id}@${c.pos}`; const last = seen.get(k); if (last !== undefined && Math.abs(c.t - last) < 0.05) dup.push(c); seen.set(k, c.t); }
// the same caption twice within 0.05 sim minutes = a double fire
const capDup = [];
const capSeen = new Map();
for (const c of caps) { const last = capSeen.get(c.id); if (last !== undefined && Math.abs(c.t - last) < 0.05) capDup.push(c); capSeen.set(c.id, c.t); }
cost.sort((a, b) => a - b);
const pct = (p) => +(cost[Math.min(cost.length - 1, Math.floor(p * cost.length))] || 0).toFixed(3);
const warns = IDS.map((id) => rt.choreo(id).mod.debug?.(rt.choreo(id).state) || '').filter((x) => x.includes('⚠'));
return {
  dayType, deterministic: diffs.length === 0, diffs: diffs.slice(0, 6), summary,
  ways: { samples: waySamples, bad: wayBad.length, list: wayBad.slice(0, 40) },
  faces: { twice: twice.size, list: [...twice.entries()].slice(0, 20).map(([k, v]) => `${v} ${k}`) },
  handover: { gaps: gap.length, list: gap.slice(0, 12), high: high.length, highList: high.slice(0, 8) },
  cues: { sounds: count, captions: caps.map((c) => `${ctx.time.format(c.t)} ${c.id}`), captionDoubles: capDup.slice(0, 5), keys: Object.keys(fired).length, doubles: dup.slice(0, 5), jumpCalls, jumpCaps },
  spikes: { n: spikes.length, first: spikes.slice(0, 8), slowAudioCues: slowCue.slice(0, 8) },
  costMs: { frames: cost.length, avg: +(cost.reduce((a, b) => a + b, 0) / Math.max(1, cost.length)).toFixed(3), p50: pct(0.5), p95: pct(0.95), max: pct(1) },
  perModule: E.map((e) => `${e.id}:${e.ms.toFixed(3)}`).join(' '),
  warns,
};

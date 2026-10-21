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
//   6. cost — the five modules' update time per frame (runtime EMA per entry, summed) during that play;
//   7. adopted assets (choreo-adopt) — the muchni's windlass_raise / windlass with the pose's phase on the wheel's angle,
//      'kiddush' at the kiyor, the great pile cleared and rebuilt (build) and the tapuach heaped (grow), branches on the
//      shoulder, the slain lamb carried in the arms, 'rinse' at the marble table.
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
    pile: r3(mv('altar.maarachah.great.pile')?.userData?.amount ?? -1), tapuach: r3(mv('altar.tapuach')?.userData?.amount ?? -1),
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
  // the kiyor's bronze platform covers its well when it is raised (part of the kiyor movable, not of the static
  // colliders): the men sanctifying under the spigots stand on it (Z 16) — choreo-adopt
  const well = ctx.el('altar.kiyor.muchni')?.params?.well;
  const onPlatform = (X, Y, Z) => well && Math.abs(Z - 16) < 0.05 && X >= well.min[0] && X <= well.max[0] && Y >= well.min[1] && Y <= well.max[1];
  const test = (X, Y, Z, what) => {
    // the ramp stands a hair's breadth off the altar (Zevachim 62b): its seam at the head is not a step
    if (Math.abs(Y - head) < 0.25 && Z > 24) return;
    if (onPlatform(X, Y, Z)) return;
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
// ---- 7. the adopted assets
const adopt = {};
let kiddushClearance = '';
{
  const ok = (k, v, info) => { adopt[k] = v ? true : `FAIL ${info ?? ''}`; };
  const TH = rt.choreo('terumat-hadeshen'), P = TH.state.plan;
  const slots = (e, pool) => (e.pools.find((p) => p.name === pool)?.slots || []).filter((x) => x.want);
  const mv = (id) => ctx.movables.get(id);
  const wheel = () => mv('wheel:altar.kiyor.muchni')?.rotation?.x ?? NaN;
  const st = ctx.people?.stations;
  const phErr = (s, station) => { const d = Math.abs(s._phase - station.phaseAt(wheel())); return Math.min(d, 1 - d); };
  // the dawn raising: windlass_raise on the north side, the pose's phase on the wheel's angle
  let n = 0, worst = 0;
  for (let k = 0.2; k < 1.6; k += 0.35) {
    ctx.time.set((P.tWheel + k + 1440) % 1440); await frames(3);
    const w = slots(TH, 'winner')[0];
    if (w?._pose === 'windlass_raise') { n++; worst = Math.max(worst, phErr(w, st.windlassRaise)); }
  }
  ok('windlass_raise on the wheel', n >= 3 && worst < 0.02, `n ${n} worst ${worst.toFixed(3)}`);
  ok('winner scale 1', slots(TH, 'winner')[0]?.actor?.scale === 1, slots(TH, 'winner')[0]?.actor?.scale);
  // the evening lowering: windlass on the south side
  n = 0; worst = 0;
  for (let k = 0.3; k < 1.6; k += 0.4) {
    ctx.time.set((P.tLower + k + 1440) % 1440); await frames(3);
    const w = slots(TH, 'kiyor-lowerer')[0];
    if (w?._pose === 'windlass') { n++; worst = Math.max(worst, phErr(w, st.windlass)); }
  }
  ok('windlass (lowering) on the wheel', n >= 3 && worst < 0.02, `n ${n} worst ${worst.toFixed(3)}`);
  // kiddush at the kiyor (the winner, then the brothers)
  let kid = 0;
  for (let t = P.TH[0]; t < P.CL[1] + 2; t += 0.05) {
    ctx.time.set(((t % 1440) + 1440) % 1440); await frames(2);
    for (const pn of ['winner', 'brothers']) for (const s2 of slots(TH, pn)) if (s2._pose === 'kiddush') kid++;
    if (kid > 6) break;
  }
  ok('kiddush', kid > 0, kid);
  // ... and clear of the laver (choreo-adopt-fix): people's joints for each man in 'kiddush' (his phase, his size)
  // carried to the site by his figure's matrix, against world's kiyor (world/altar/kiyor.js: the bowl's profile, the
  // twelve spigot pipes r 1.86–2.3 at 1.52 amot, the nozzle hanging at r 2.3): the head off the bowl and the pipes,
  // the shoulders off the pipes and nozzles, the right hand under a nozzle
  {
    const { getRig } = await import('/src/people/rig.js');
    const { PoseBuilder } = await import('/src/people/pose.js');
    const { HUMAN_CLIPS } = await import('/src/people/clips.js');
    const { w2m, AMAH } = await import('/src/core/units.js');
    const kel = ctx.el('altar.kiyor'), KC = kel.params.center, KR = kel.params.diameter / 2, KH = kel.box.max[2] - kel.box.min[2];
    const sc = KR / 2;
    const prof = [[1.32, 0], [1.36, 0.05], [1.3, 0.11], [1.12, 0.17], [0.86, 0.3], [0.72, 0.52], [0.66, 0.78], [0.7, 0.86], [0.92, 0.95],
      [1.25, 1.03], [1.62, 1.2], [1.86, 1.52], [1.95, 2.0], [1.95, 2.74], [1.99, 2.8], [2.0, 2.92], [1.96, 3.0]].map(([r, z]) => [r * sc, 0.02 + z * KH / 3]);
    const bowlR = (z) => { if (z <= prof[0][1]) return prof[0][0]; for (let i = 1; i < prof.length; i++) if (z <= prof[i][1]) { const [r0, z0] = prof[i - 1], [r1, z1] = prof[i]; return r0 + (r1 - r0) * (z - z0) / (z1 - z0); } return 0; };
    const zSp = 0.02 + 1.5 * KH / 3, rIn = 1.86 * sc, rOut = 2.3 * sc;
    const spig = Array.from({ length: 12 }, (_, i) => (i + 0.5) * Math.PI / 6);
    // metres from a site point (amot) to the nearest pipe (a segment) and to the nearest nozzle (a short vertical)
    const toPipe = (q) => Math.min(...spig.map((a) => { const u = (q.X - KC[0]) * Math.cos(a) + (q.Y - KC[1]) * Math.sin(a), v = -(q.X - KC[0]) * Math.sin(a) + (q.Y - KC[1]) * Math.cos(a);
      return Math.hypot(u - Math.min(rOut, Math.max(rIn, u)), v, q.Z - KC[2] - zSp) * AMAH; }));
    const toNozzle = (q, flat = false) => Math.min(...spig.map((a) => { const dx = q.X - KC[0] - Math.cos(a) * rOut, dy = q.Y - KC[1] - Math.sin(a) * rOut;
      const z = q.Z - KC[2], dz = flat ? 0 : z - Math.min(zSp - 0.08 + 0.09, Math.max(zSp - 0.08 - 0.09, z));
      return Math.hypot(dx, dy, dz) * AMAH; }));
    const offBowl = (q) => (Math.hypot(q.X - KC[0], q.Y - KC[1]) - bowlR(q.Z - KC[2])) * AMAH;
    const rig = getRig('man'), PB = new PoseBuilder(rig);
    const res = [];
    let n2 = 0;
    for (let t = P.TH[0]; t < P.CL[1] + 2 && n2 < 9; t += 0.05) {
      ctx.time.set(((t % 1440) + 1440) % 1440); await frames(2);
      for (const pn of ['winner', 'brothers']) for (const s2 of slots(TH, pn)) {
        if (s2._pose !== 'kiddush' || !s2.actor || res.some((r) => r.who === `${pn}#${s2.index}`)) continue;
        n2++;
        PB.reset();
        HUMAN_CLIPS.kiddush.fn(PB, rig, Number.isFinite(s2._phase) ? s2._phase : 0.5);
        const o3 = s2.actor.object3D, k = s2.actor.scale;
        o3.updateMatrixWorld();
        const J = (name) => w2m(PB.worldPos(name).multiplyScalar(k).applyMatrix4(o3.matrixWorld));
        // the skull's centre ≈ 9 cm on from the head bone along the neck (the head bowed over the feet)
        const hb = PB.worldPos('head'), nk = PB.worldPos('neck');
        const hc = w2m(hb.clone().add(hb.clone().sub(nk).setLength(0.09)).multiplyScalar(k).applyMatrix4(o3.matrixWorld));
        const head = J('head'), sh = [J('uarm_l'), J('uarm_r')], hand = J('hand_r'), fing = J('fing_r');
        const r = {
          who: `${pn}#${s2.index}`, scale: k,
          headBowl: +Math.min(offBowl(head), offBowl(hc)).toFixed(3), headPipe: +Math.min(toPipe(head), toPipe(hc)).toFixed(3),
          shoulderPipe: +Math.min(...sh.map(toPipe), ...sh.map((q) => toNozzle(q))).toFixed(3),
          handNozzle: +Math.min(toNozzle(hand, true), toNozzle(fing, true)).toFixed(3),
        };
        r.ok = r.headBowl > 0.13 && r.headPipe > 0.13 && r.shoulderPipe > 0.07 && r.handNozzle < 0.12;
        res.push(r);
      }
    }
    ok('kiddush clear of the kiyor', res.length >= 5 && res.every((r) => r.ok), JSON.stringify(res.filter((r) => !r.ok).slice(0, 3)) + ` of ${res.length}`);
    // under the muchni's axle (world/altar/kiyor.js: 2.6 amot up, r 0.16) the winner's head and shoulders stay below it
    const wb = ctx.el('altar.kiyor.muchni').params.wheel, yAx = (wb.min[1] + wb.max[1]) / 2, zUnder = wb.min[2] + 2.6 - 0.16;
    let under = 0, worstTop = -9;
    for (let t = P.tWheel - 0.6; t < P.tWheel + 0.1; t += 0.005) {
      ctx.time.set(((t % 1440) + 1440) % 1440); await frames(1);
      const w = slots(TH, 'winner')[0];
      if (!w?.actor) continue;
      const q = w2m(w.actor.object3D.position);
      if (Math.abs(q.Y - yAx) > 0.5 || Math.abs(q.X - (wb.max[0] - 0.45 - 0.41 - 1.146)) > 0.6) continue;
      under++;
      PB.reset();
      const clip = HUMAN_CLIPS[w._pose];
      if (!clip) continue;
      clip.fn(PB, rig, Number.isFinite(w._phase) ? w._phase : 0.5);
      const o3 = w.actor.object3D; o3.updateMatrixWorld();
      const top = Math.max(...['head', 'neck', 'uarm_l', 'uarm_r'].map((n) => w2m(PB.worldPos(n).multiplyScalar(w.actor.scale).applyMatrix4(o3.matrixWorld)).Z + (n === 'head' ? 0.14 : 0.06) / AMAH));
      worstTop = Math.max(worstTop, top);
    }
    ok('under the axle: head below it', under >= 3 && worstTop < zUnder, `${under} samples, top ${worstTop.toFixed(2)} vs underside ${zUnder.toFixed(2)} amot`);
    kiddushClearance = res.map((r) => `${r.who} s${r.scale.toFixed(3)} head ${r.headBowl}/${r.headPipe} shoulder ${r.shoulderPipe} hand ${r.handNozzle}`).join('; ');
  }
  // the great pile cleared and rebuilt; the tapuach heaped
  const amt = async (t) => { ctx.time.set(((t % 1440) + 1440) % 1440); await frames(3); return [mv('altar.maarachah.great.pile')?.userData?.amount, mv('altar.tapuach')?.userData?.amount]; };
  const [p0] = await amt(P.MU[0] - 1);
  const [p1, g1] = await amt(P.TP[1] + 0.05);
  const [p2, g2] = await amt(P.SP[1] + 1);
  const [, g0] = await amt(P.TP[0] - 0.2);
  ok('pile built at night', p0 > 0.99, p0);
  ok('pile cleared after the tapuach', p1 < 0.05, p1);
  ok('pile rebuilt by the second pile', p2 > 0.99, p2);
  ok('tapuach heaped', g0 < g1 && g1 > 0.99 && g2 > 0.99, `${g0} ${g1} ${g2}`);
  let mid = null;
  for (let t = P.GP[0]; t < P.GP[1] + 2; t += 0.25) { const [a] = await amt(t); if (a > 0.05 && a < 0.95) { mid = a; break; } }
  ok('pile grows load by load', mid != null, mid);
  // branches on the shoulder (Tamid 2:3)
  let br = false;
  for (let t = P.GP[0] - 1; t < P.GP[1] && !br; t += 0.1) {
    ctx.time.set(((t % 1440) + 1440) % 1440); await frames(2);
    br = slots(TH, 'brothers').some((s2) => s2._g2r === 'gizrin_branch' || s2._g2r === 'branch_bundle');
  }
  ok('gizrin branches carried', br);
  // the slain lamb in the arms; the innards rinsed
  const TM = rt.choreo('tamid-morning');
  let lamb = false, rinse = false;
  for (let off = 2; off <= 40 && !(lamb && rinse); off += 0.5) {
    ctx.time.set(tOf(`sunrise+${off}`)); await frames(2);
    for (const p of TM.pools) for (const s2 of p.slots) if (s2.want) {
      if (s2._g2r === 'lamb_slain' && /carry_lamb/.test(s2._pose)) lamb = true;
      if (s2._pose === 'rinse') rinse = true;
    }
  }
  ok('lamb_slain carried', lamb); ok('rinse', rinse);
  // never a moment without the lamb: in the flayer's arms until it hangs, on the hook from then (choreo-adopt-fix)
  {
    const hang = TM.state.plan?.M?.t?.cuts?.hang;
    const inArms = async (x) => { ctx.time.set(tOf(x)); await frames(2); return TM.pools.some((p) => p.slots.some((s2) => s2.want && s2._g2r === 'lamb_slain')); };
    const onHook = () => !!TM.state.props.items.find((i) => i.name === 'lamb_hung')?.slot?.vis;
    const a = Number.isFinite(hang) && await inArms(hang - 0.02);
    const b = Number.isFinite(hang) && (await inArms(hang + 0.02), onHook());
    ok('lamb in arms until it hangs', a && b, `${hang} arms ${a} hook ${b}`);
  }
}
return {
  adopt, adoptOk: Object.values(adopt).every((v) => v === true), kiddushClearance,
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

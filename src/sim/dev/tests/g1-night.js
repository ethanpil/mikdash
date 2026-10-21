// G1 night & pre-dawn choreos (moked-night + locking-up + moked-dawn, altar-night, lotteries, torch-inspection):
//  1. determinism: the same t reached by different jump orders (forward, reverse, from far away) gives identical figures,
//     doors, free props and fire level — on a weekday, a Friday and a Shabbat;
//  2. hand-overs: the same man (pool seed + index) across EVERY choreo, sampled through the night's critical windows on
//     the three dates (the Friday crew coming in at sunset, the locking, the keri, the 00:00 wrap, the immersions, the
//     inspection → terumat-hadeshen, the officer → the second lottery, the third lottery's attendants): no pops, no one
//     shown twice; appearances and vanishings listed with where they happen (doors / gates / interiors);
//  3. cues once: continuous play at 120x through the evening and the small hours — every planned cue in the played span
//     fires exactly once, none fires on jumps;
//  4. cost: the G1 modules' update time per frame while playing;
//  6. adopted assets (choreo-adopt): Gevini's call, the knock, the mitre lifted and put back (headgear), the lock at the
//     gates, the keys slab and keys, the elders as kohen_elder, the immersions in the wrap (bathe), sitting on the floor,
//     the breeches at the niches, charred limbs on the pile, the Ish Har HaBayit's staff and strike.
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/g1-night.js "t=n3"
const rt = ctx.schedule.runtime, time = ctx.time;
const IDS = ['moked-night', 'altar-night', 'lotteries', 'torch-inspection'];
const E = Object.fromEntries(IDS.map((id) => [id, rt.choreo(id)]));
const res = { failed: IDS.filter((id) => !E[id] || E[id].failed), dates: {}, handover: {}, cues: {}, cost: {} };
const r3 = (x) => Math.round(x * 1000) / 1000;
const W = (t) => ((t % 1440) + 1440) % 1440;
const { nightPlan } = await import('/src/sim/choreo/g1/plan.js');

function snap() {
  const figs = [];
  for (const id of IDS) {
    const e = E[id];
    for (const p of e.pools) for (const s of p.slots) {
      if (!s.want) continue;
      const o = s.actor?.object3D;
      figs.push(`${id}/${p.name}#${s.index} ${o ? `${r3(o.position.x)},${r3(o.position.y)},${r3(o.position.z)}` : '-'} h${r3(s._heading)} ${s._pose}${Number.isNaN(s._phase) ? '' : '@' + r3(s._phase)} ${s._prop || ''}${s._p2r !== undefined ? `[${s._p2r},${s._p2l}]` : ''} drawn:${s.actor?.prop?.name || ''}/${s.actor?.prop2?.name || ''}${s._hg ? '' : ' bare'}`);
    }
  }
  const props = [];
  for (const id of IDS) for (const L of E[id].state?.props?.live || []) if (L.vis) props.push(`${id}:${L.name}@${L.it?.at?.map((v) => r3(v)).join(',')}`);
  const doors = ['azarah.moked.door-chel', 'azarah.gate.moked.pishpash', 'azarah.moked.chamber.tevilah-descent', 'azarah.moked.chamber.altar-stones'].map((d) => `${d}=${r3(ctx.movables.get(`door:${d}`)?.userData?.openAmount ?? -1)}`);
  const slab = ctx.movables.get('azarah.moked.keys-slab')?.userData;
  if (slab) doors.push(`slab=${r3(slab.amount ?? -1)} keys=${(slab.keysOn || []).length}`);
  // the great pile's fire where altar-night owns it ([sunset, muchni − 0.5]); terumat-hadeshen drives it after that
  const fx = ctx.fx?.fires?.get?.('altar.maarachah.great');
  const fw = E['altar-night'].state?.fireWin?.w;
  const mine = fw && ((time.t - fw[0] + 1440) % 1440) < ((fw[1] - fw[0] + 1440) % 1440);
  return { figs, props, doors, fire: mine ? r3(fx?.target ?? fx?.intensity ?? -1) : 'n/a', fireAny: r3(fx?.target ?? fx?.intensity ?? -1) };
}
const at = async (t) => { time.set(W(t)); await frames(3); return snap(); };

const DATES = { weekday: '2026-11-02', friday: '2026-11-06', shabbat: '2026-11-07' };
for (const [dt, date] of Object.entries(DATES)) {
  time.setDate(date); await frames(3);
  const z = time.zmanim;
  const Pl = nightPlan(ctx, E['moked-night'].sim), T = Pl.T;
  const ev = (id) => ctx.schedule.byId(id);
  const l34 = ev('third-fourth-lottery'), l2 = ev('second-lottery');
  const ts = [z.tzeit - 14, T.lock[0] + 0.62, T.lock[0] + 7.4, T.lock[0] + 9.8, z.sunset - 50, z.sunset + 20, T.eve ? T.eve.t0 + 30 : 900, T.eve ? T.eve.t1 + 1.2 : 1000,
    T.keri ? T.keri[0] + 3 : 1405, T.keri ? T.keri[0] + 12 : 1415, 1420, 15, 95, T.imm[0] + 2.3, T.imm[0] + 9.1, T.imm[0] + 17.5, T.gev[0] + 0.55, T.knock[0] + 0.9, T.first[0] + 1.6, T.first[0] + 3.4,
    T.insp[0] + 0.6, T.insp[0] + 1.2, T.insp[0] + 4, Pl.meet.t + 0.4, Pl.meet.t + 3.0, T.handG2 - 0.2, l2 ? l2.t0 - 9 : z.alot - 17, T.mokedGateOpen + 1.0, z.alot + 1,
    l34 ? l34.t0 + 5.3 : z.sunrise + 49, time.resolve({ dayHour: 8.3 }), time.resolve({ dayHour: 10.5 })];
  const A = {}, B = {}, C = {};
  for (const t of ts) A[t] = await at(t);
  for (const t of [...ts].reverse()) B[t] = await at(t);
  for (const t of ts) { await at(t + 600); C[t] = await at(t); }
  const diffs = [];
  const count = {};
  for (const t of ts) {
    const key = (x) => JSON.stringify({ ...x, fireAny: undefined });
    const a = key(A[t]), b = key(B[t]), c = key(C[t]);
    if (A[t].fireAny !== B[t].fireAny || A[t].fireAny !== C[t].fireAny) (res.fireOutside ||= []).push(`${dt} ${time.format(W(t))} ${A[t].fireAny}/${B[t].fireAny}/${C[t].fireAny}`);
    if (a !== b || a !== c) diffs.push({ t: time.format(W(t)), firstA: A[t].figs.find((x, i) => x !== B[t].figs[i] || x !== C[t].figs[i]), firstB: B[t].figs.find((x, i) => x !== A[t].figs[i]), firstC: C[t].figs.find((x, i) => x !== A[t].figs[i]), props: a === b ? '' : [A[t].props.join(' '), B[t].props.join(' ')], doors: [A[t].doors.join(' '), B[t].doors.join(' '), C[t].doors.join(' ')], fire: [A[t].fire, B[t].fire, C[t].fire] });
    const n = {};
    for (const f of A[t].figs) { const k = f.split('#')[0]; n[k] = (n[k] || 0) + 1; }
    count[time.format(W(t))] = `${A[t].figs.length} ${JSON.stringify(n)} props ${A[t].props.length} fire ${A[t].fire}`;
  }
  res.dates[dt] = { deterministic: diffs.length === 0, diffs: diffs.slice(0, 6), count };

  // ---- 2. hand-overs: every choreo's wanted slots keyed by (pool seed, index) — the same man in any module
  const G1SEEDS = new Set([0x7468, 0x7469, 0x6261, 0x6745, 0x6743, 0x6740, 0x6741, 0x6742, 0x6744, 0x6746]);
  const who = () => {
    const m = new Map();
    for (const e of rt.entries) {
      if (!e.relevant || !e.pools) continue;
      for (const p of e.pools) {
        const seed = p.spec?.seed;
        if (!G1SEEDS.has(seed)) continue;
        for (const s of p.slots) {
          if (!s.want) continue;
          const k = `${seed.toString(16)}#${s.index}`;
          const v = { id: e.id, pool: p.name, at: s._site.slice(), pose: s._pose };
          if (m.has(k)) m.get(k).dup = v; else m.set(k, v);
        }
      }
    }
    return m;
  };
  const wins = [];
  if (T.eve) wins.push([T.eve.t0 - 3, T.eve.t0 + 1.5, 0.05]);
  if (T.eve?.friday) wins.push([T.eve.t1 - 1, T.eve.t1 + 26, 0.1]);
  wins.push([T.lock[0] - 4, T.lock[1] + 1, 0.1]);
  if (T.keri) wins.push([T.keri[0] - 2, T.keri[0] + 3, 0.05], [T.keri[1] - 2, T.keri[1] + 4, 0.1]);
  wins.push([1439.0, 1440.6, 0.02], [T.imm[0] - 4, T.knock[1] + 1, 0.1], [T.insp[1] - 1.5, T.handG2 + 2, 0.05]);
  if (l2) wins.push([l2.t0 - 6, l2.t0 - 3.5, 0.05]);
  if (l34) wins.push([l34.t0 + 4.4, l34.t1 + 3.5, 0.1]);
  const evs = [];
  let dupN = 0;
  for (const [a0, a1, step] of wins) {
    let prev = null, prevT = null;
    for (let t = a0; t <= a1 + 1e-6; t += step) {
      time.set(W(t)); await frames(2);
      const cur = who();
      for (const [k, v] of cur) if (v.dup && dupN++ < 8) evs.push(`DUP ${time.format(W(t))} ${k} ${v.id}/${v.pool} & ${v.dup.id}/${v.dup.pool}`);
      if (prev) {
        for (const [k, v] of cur) {
          const p = prev.get(k);
          if (!p) { evs.push(`APPEAR ${time.format(W(t))} ${k} ${v.id}/${v.pool} ${v.pose} @${v.at.map((x) => x.toFixed(1))}`); continue; }
          const dm = Math.hypot(v.at[0] - p.at[0], v.at[1] - p.at[1]) * 0.48;
          if (dm > 3.0 * step * 60 + 0.3) evs.push(`POP ${time.format(W(t))} ${k} ${p.id}->${v.id} ${dm.toFixed(2)} m @${p.at.map((x) => x.toFixed(1))}→${v.at.map((x) => x.toFixed(1))}`);
        }
        for (const [k, p] of prev) if (!cur.has(k)) evs.push(`VANISH ${time.format(W(t))} ${k} ${p.id}/${p.pool} ${p.pose} @${p.at.map((x) => x.toFixed(1))}`);
      }
      prev = cur; prevT = t;
    }
  }
  res.handover[dt] = { pops: evs.filter((x) => x.startsWith('POP')).length, dups: evs.filter((x) => x.startsWith('DUP')).length, events: evs.slice(0, 80) };
}

// ---- 3. cues once, at 120x
time.setDate(DATES.weekday); await frames(3);
const calls = [], caps = [];
const audio = ctx.audio, origCue = audio.cue;
audio.cue = (id, pos, opts) => { calls.push({ id, t: +time.t.toFixed(3) }); return origCue.call(audio, id, pos, opts); };
ctx.bus.on?.('caption', (e) => caps.push({ id: e.id, t: +time.t.toFixed(2), en: (e.text?.en || '').slice(0, 60) }));
const costs = Object.fromEntries(IDS.map((id) => [id, []]));
const cueKeys = () => { const s = new Set(); for (const id of IDS) for (const k of E[id].handle.fired.keys()) s.add(`${id}:${k}`); return s; };
async function play(from, to, speed, near) {
  time.set(W(from)); await frames(3);
  if (near) { ctx.player.teleport({ at: near }); await frames(3); }
  time.setSpeed(speed); time.pause(false);
  let played = 0, prev = time.t;
  const len = W(to - from);
  const fired = new Set();
  while (played < len) {
    await frames(1);
    const t = time.t;
    played += W(t - prev); prev = t;
    for (const id of IDS) costs[id].push(E[id].relevant ? E[id].ms : 0);
    for (const k of cueKeys()) fired.add(k);
  }
  time.pause(true);
  return fired;
}
const z = time.zmanim;
const Pl = nightPlan(ctx, E['moked-night'].sim);
// the observer by the Moked (captions are range-limited: the caption check covers the Moked's and the lotteries')
const firedEve = await play(z.tzeit - 20, W(z.midnight + 30), 120, [210.75, 398, 16]);
const callsEve = calls.length, capsEve = caps.length;
const firedDawn = await play(Pl.T.imm[0] - 3, W(z.alot + 14), 120, [210.75, 398, 16]);
const inSpan = (t, a, b) => W(t - a) <= W(b - a);
const planned = [];
for (const c of Pl.cues) if (inSpan(c.t, z.tzeit - 20, z.midnight + 30) || inSpan(c.t, Pl.T.imm[0] - 3, z.alot + 14)) planned.push(`${c.owner}:${c.key}`);
const firedAll = new Set([...firedEve, ...firedDawn]);
const ownerMod = { moked: 'moked-night', insp: 'torch-inspection', lot: 'lotteries', altar: 'altar-night' };
const missing = planned.filter((k) => { const [o, ...rest] = k.split(':'); return !firedAll.has(`${ownerMod[o]}:${rest.join(':')}`); });
const dup = [];
const seen = new Map();
for (const c of calls) { const last = seen.get(c.id); if (last !== undefined && Math.abs(c.t - last) < 0.05) dup.push(c); seen.set(c.id, c.t); }
const before = calls.length;
for (const c of Pl.cues.slice(0, 10)) { time.set(W(c.t - 0.2)); await frames(2); time.set(W(c.t + 0.2)); await frames(2); }
res.cues = {
  calls: calls.length, eveCalls: callsEve, captions: caps.length, eveCaptions: capsEve,
  byId: calls.reduce((m, c) => ((m[c.id] = (m[c.id] || 0) + 1), m), {}),
  fired: firedAll.size, planned: planned.length, missing, duplicates: dup.slice(0, 6), jumpCalls: calls.length - before,
  captionList: caps.map((c) => `${time.format(c.t)} ${c.id}: ${c.en}`).slice(0, 40),
};
audio.cue = origCue;
// ---- 4. cost
for (const id of IDS) {
  const v = costs[id].filter((x) => x > 0).sort((a, b) => a - b);
  res.cost[id] = v.length ? { n: v.length, p50: r3(v[Math.floor(v.length / 2)]), p95: r3(v[Math.floor(v.length * 0.95)]), max: r3(v[v.length - 1]) } : null;
}
res.cost.simTotal = { ms: r3(rt.stats.ms), peak: r3(rt.stats.msPeak) };

// ---- 5. the Ish Har HaBayit across Beit HaMoked (night-watch): round the hearth's west and south between the mats —
// every leg of his circuit inside the hall against the hearth (its keep radius) and every mat's and seat's body
{
  const { footprint } = await import('/src/sim/choreo/g1/places.js');
  const nw = rt.choreo('night-watch');
  const Pl = nightPlan(ctx, E['moked-night'].sim), M = Pl.M, F = Pl.floor;
  const inHall = (s) => s.X > M.i.min[0] && s.X < M.i.max[0] && s.Y > M.i.min[1] && s.Y < M.i.max[1] + 0.5 && Math.abs((s.Z ?? 16) - M.Z) < 1;
  const st = nw.state.stops || [];
  const segs = [];
  for (let i = 0; i + 1 < st.length; i++) if (inHall(st[i]) && inHall(st[i + 1])) segs.push([st[i], st[i + 1]]);
  const segPt = (a, b, p) => { const dx = b.X - a.X, dy = b.Y - a.Y, L = dx * dx + dy * dy || 1e-9; const u = Math.max(0, Math.min(1, ((p[0] - a.X) * dx + (p[1] - a.Y) * dy) / L)); return Math.hypot(a.X + dx * u - p[0], a.Y + dy * u - p[1]); };
  const inPoly = (P, p) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
  let hearth = Infinity, body = Infinity, near = '';
  for (const [a, b] of segs) {
    hearth = Math.min(hearth, segPt(a, b, M.hearth) - M.keep.hearthR);
    for (const [k, m] of Object.entries({ ...F.mats, ...F.seats })) {
      const fp = footprint(m.pose, m.at, m.h, 'body').pts;
      let d = Infinity;
      for (let u = 0; u <= 1.0001; u += 0.02) { const p = [a.X + (b.X - a.X) * u, a.Y + (b.Y - a.Y) * u]; if (inPoly(fp, p)) d = 0; else for (let i = 0; i < 4; i++) d = Math.min(d, segPt({ X: fp[i][0], Y: fp[i][1] }, { X: fp[(i + 1) % 4][0], Y: fp[(i + 1) % 4][1] }, p)); }
      if (d < body) { body = d; near = k; }
    }
  }
  res.mokedRoute = { legs: segs.length, waypoints: [...new Set(segs.flat().map((s) => `${s.X.toFixed(2)},${s.Y.toFixed(2)}`))], hearthClear: r3(hearth), bodyClear: r3(body), nearest: near, ok: segs.length >= 4 && hearth > 0.3 && body > 0.3 };
}

// ---- 6. the adopted assets (choreo-adopt), on the weekday
{
  time.setDate(DATES.weekday); await frames(3);
  const Pl = nightPlan(ctx, E['moked-night'].sim), T = Pl.T;
  const A = {};
  const ok = (k, v, info) => { A[k] = v ? true : `FAIL ${info ?? ''}`; };
  const slots = (id, pool) => (E[id].pools.find((p) => p.name === pool)?.slots || []).filter((s) => s.want);
  const any = (id, pool, f) => slots(id, pool).some(f);
  const seeAt = async (t) => { time.set(W(t)); await frames(3); };
  const nwE = rt.choreo('night-watch');
  // Gevini's call; the officer's knock
  await seeAt(Pl.gevini.tCall + 0.03);
  ok('gevini call', any('moked-night', 'gevini:levi', (s) => s._pose === 'call'), slots('moked-night', 'gevini:levi').map((s) => s._pose).join());
  await seeAt(T.knock[0] + 0.52);
  ok('officer knock', any('moked-night', 'officer:k', (s) => s._pose === 'knock'), slots('moked-night', 'officer:k').map((s) => s._pose).join());
  // the mitre: lifted from the first man of the count, in the officer's hand during the count, back on before the torches
  const L1 = Pl.lot1, tgtPool = L1.target === 'winner' ? 'slab:k' : 'young:k', tgtIdx = L1.target === 'winner' ? 0 : +L1.target[1];
  const tgt = () => E.lotteries.pools.find((p) => p.name === tgtPool)?.slots[tgtIdx];
  await seeAt(T.first[0] + 0.6);
  ok('lift_mitre pose', any('lotteries', 'officer:k', (s) => s._pose === 'lift_mitre'), slots('lotteries', 'officer:k').map((s) => s._pose).join());
  await seeAt(T.first[0] + 1.5);
  ok('mitre off (count)', tgt()?.want && tgt()._hg === false && tgt().actor?.headgear === false, `${tgt()?.want} ${tgt()?._hg}`);
  ok('migbaat in hand', any('lotteries', 'officer:k', (s) => s.actor?.prop2?.name === 'migbaat' || s.actor?.prop?.name === 'migbaat'));
  await seeAt(T.first[0] + 3.0);
  ok('mitre back on', tgt()?.want && tgt()._hg === true && tgt().actor?.headgear === true, `${tgt()?._hg}`);
  // the locking: the keys slab raised, the keys off the chain, the lock turned at the Korban and Moked gates
  const slab = ctx.movables.get('azarah.moked.keys-slab')?.userData;
  const w0 = Pl.slab[0];
  await seeAt((w0[1] + w0[2]) / 2);
  ok('slab lifted (locking)', slab && slab.amount > 0.5, slab?.amount);
  await seeAt(Pl.keysWin[0][0] + 0.5);
  ok('keys taken (locking)', slab && (slab.keysOn || []).length === 0, (slab?.keysOn || []).length);
  await seeAt(Pl.lock.tLockK);
  ok('lock (Korban gate)', any('moked-night', 'slab:off', (s) => s._pose === 'lock'), slots('moked-night', 'slab:off').map((s) => s._pose).join());
  // the tablet out of its place until the keys are back (Middot 1:9 "returned the keys … and the tablet to its place")
  ok('slab open while he locks', slab && slab.amount > 0.95, slab?.amount);
  await seeAt(Pl.lock.tLockM);
  ok('lock (Moked gate)', any('moked-night', 'slab:off', (s) => s._pose === 'lock'));
  await seeAt(Pl.lock.tBack + 1);
  ok('keys back, slab down', slab && slab.keys === true && slab.amount < 0.01, `${slab?.keys} ${slab?.amount}`);
  const kd = Pl.keysWin.find((w) => w[2] === 7);
  if (kd) { await seeAt(kd[0] + 0.3); ok('wicket key taken (dawn)', slab && (slab.keysOn || []).length === 7, (slab?.keysOn || []).length); }
  await seeAt(Pl.insp.tUnlock - 0.1);
  ok('wicket unlocked (lock pose)', any('torch-inspection', 'officer:k', (s) => s._pose === 'lock'), slots('torch-inspection', 'officer:k').map((s) => s._pose).join());
  // the elders asleep as kohen_elder on the ledges
  await seeAt(60);
  ok('elders kohen_elder lie', slots('moked-night', 'elders:elder').length === 6 && slots('moked-night', 'elders:elder').every((s) => s._pose === 'lie' && s.actor?.role === 'kohen_elder'), slots('moked-night', 'elders:elder').map((s) => `${s._pose}/${s.actor?.role}`).join());
  // the immersions in the wrap; the impure kohen sitting on the floor
  let bathe = false, wrap = false;
  for (let t = T.imm[0]; t < T.imm[1] && !bathe; t += 0.03) {
    await seeAt(t);
    for (const pn of ['young:bath', 'slab:bath']) for (const s of slots('moked-night', pn)) { wrap = true; if (s._pose === 'bathe') bathe = true; }
  }
  ok('immersion in the wrap', wrap); ok('bathe pose', bathe);
  if (T.keri) { await seeAt(T.keri[1] + 6); ok('keri sit_floor', any('moked-night', 'keri:off', (s) => s._pose === 'sit_floor' || s._pose === 'kneel'), slots('moked-night', 'keri:off').map((s) => s._pose).join()); }
  // charred limbs on the pile in the small hours
  await seeAt(90);
  const ch = (E['altar-night'].state?.props?.live || []).filter((L) => L.vis && /_charred$/.test(L.name || ''));
  ok('charred limbs on the pile', ch.length > 0, ch.length);
  // the breeches at the niches (Tamid 5:3)
  const l34 = ctx.schedule.byId('third-fourth-lottery');
  if (l34) { await seeAt(l34.t1 + 0.6); ok('breeches after the lottery', slots('lotteries', 'gazit:br').length > 0, slots('lotteries', 'gazit:br').length); }
  // the Ish Har HaBayit's staff; the strike on the sleeping guard
  const sg = ctx.schedule.byId('sleeping-guard'), ih = ctx.schedule.byId('ish-har-habayit');
  if (ih) {
    await seeAt(ih.t0 + 30);
    const o = nwE.state.officer.slot(0);
    ok('staff in hand', o.want && o._prop === 'staff' && /^staff/.test(o._pose), `${o._prop} ${o._pose}`);
  }
  if (sg) {
    const Ln = W(sg.t1 - sg.t0 - 0.5);
    await seeAt(sg.t0 + 0.5 + Ln * 0.07);
    const o = nwE.state.officer.slot(0);
    ok('strike', o._pose === 'strike', o._pose);
  }
  res.adopt = A;
  res.adoptOk = Object.values(A).every((v) => v === true);
}
return res;

// Group G4 (courts-daily, nikanor-stations, sanhedrin, chambers-daily, beit-avtinas):
//   1. determinism — the same t reached by different jump orders (forward, reverse, from far away) gives identical
//      figures (visibility, position, heading, pose, phase, prop), fires, the Golah wheel and the doors, on a weekday,
//      a Friday and a Shabbat (the nazir's and the metzora's offerings among the times);
//   2. the day's sets follow private-offerings' counts (nazir, metzora), and each is staged;
//   3. overlaps — every G4 figure shown, sampled through the day: no two closer than 0.32 m (0.5 m when one lies
//      prostrate), no kohen in the holy garments on the Mount or in the city (Z < 5.5 amot);
//   4. watchable rows — the circuit's and the sets' rows in "Happening now" carry a view;
//   5. cues — continuous play at 120× through the morning and the evening: every planned cue key fires exactly once,
//      none on jumps;
//   6. cost — per-frame update time of the five modules at 1× at busy hours, the observer at the scenes.
// Run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/g4.js "t=d3"
const rt = ctx.schedule.runtime;
const IDS = ['courts-daily', 'nikanor-stations', 'sanhedrin', 'chambers-daily', 'beit-avtinas'];
const E = IDS.map((id) => rt.choreo(id)).filter(Boolean);
const r3 = (x) => Math.round(x * 1000) / 1000;
const AM = 0.48;
const snap = () => {
  const figs = [];
  for (const e of E) for (const p of e.pools) for (const s of p.slots) {
    if (!s.shown) continue;
    const o = s.actor.object3D.position;
    figs.push(`${e.id}/${p.name}#${s.index} ${r3(o.x)},${r3(o.y)},${r3(o.z)} h${r3(s._heading)} ${s._pose}${Number.isNaN(s._phase) ? '' : '@' + r3(s._phase)} ${s._prop || ''}${s._p2 ? '+' + s._p2 : ''}`);
  }
  const st = (id) => rt.choreo(id)?.state || {};
  // the fires as the runtime's shared board applied them (every G4 want, and private-offerings' on the kitchen hearth)
  const fires = ['altar.kitchen.fire', 'courts.en.nazirites.hearth', 'sim.chambers.nazirites.0', 'sim.chambers.nazirites.2', 'sim.chambers.chavitin']
    .map((id) => `${id}=${r3(Math.max(0, rt.fires.state(id)?.value ?? 0))}`);   // (not yet on the board = its level 0)
  const wheel = ctx.movables?.get?.('wheel:azarah.chamber.golah')?.userData?.angle;
  const doors = ['door:azarah.gate.moked.pishpash', 'door:azarah.moked.door-chel'].map((id) => { const n = ctx.movables?.get?.(id); return `${id}=${r3(+(n?.userData?.openAmount ?? 0))}`; });
  return { figs, fires, wheel: r3(wheel ?? 0), doors };
};
const tOf = (s) => (typeof s === 'number' ? ((s % 1440) + 1440) % 1440 : ctx.time.parse(s));
const at = async (s) => { ctx.time.set(tOf(s)); await frames(3); return snap(); };
const out = {};
const cd = rt.choreo('courts-daily'), ns = rt.choreo('nikanor-stations'), ch = rt.choreo('chambers-daily'), g5 = rt.choreo('private-offerings');

// ---------------------------------------------------------------------------------------------- 1. determinism
async function determinism(date, T) {
  ctx.time.setDate(date); await frames(4);
  const A = {}, B = {}, C = {};
  for (const s of T) A[s] = await at(s);
  for (const s of [...T].reverse()) B[s] = await at(s);
  for (const s of T) { await at('n3'); C[s] = await at(s); }
  const diffs = [], summary = {};
  for (const s of T) {
    const a = JSON.stringify(A[s]), b = JSON.stringify(B[s]), c = JSON.stringify(C[s]);
    if (a !== b || a !== c) {
      const fa = A[s].figs, fb = B[s].figs, fc = C[s].figs;
      diffs.push({ t: s, n: [fa.length, fb.length, fc.length], a: fa.find((x, i) => x !== fb[i] || x !== fc[i]), b: fb.find((x, i) => x !== fa[i]), c: fc.find((x, i) => x !== fa[i]), fires: [A[s].fires.join(' '), B[s].fires.join(' ')], wheel: [A[s].wheel, B[s].wheel, C[s].wheel], doors: [A[s].doors.join(' '), B[s].doors.join(' ')] });
    }
    const count = {};
    for (const f of A[s].figs) { const k = f.split('#')[0]; count[k] = (count[k] || 0) + 1; }
    summary[s] = `${ctx.time.format(tOf(s))} ${A[s].figs.length} figs ${JSON.stringify(count)} ${A[s].fires.join(' ')} wheel ${A[s].wheel}`;
  }
  return { deterministic: diffs.length === 0, diffs: diffs.slice(0, 6), summary };
}
ctx.time.setDate('2026-11-02'); await frames(3);
ctx.time.set(ctx.time.parse('d3')); await frames(3);
const greet = cd.state.plan?.greets?.[1]?.at;
const M = ns.state.plan?.M;
const naz = ch.state.plan?.naz?.[0];
const nazT = naz ? [naz.t0 + 2.5, naz.t0 + 9, naz.t0 + 24, naz.t0 + 40] : ['d4.1', 'd4.2', 'd4.3', 'd4.4'];
const wave = naz?.wave ? naz.wave.s + naz.wave.sync.tW + 0.5 : 'd5.1';
out.weekday = await determinism('2026-11-02', ['sunrise-100', 'sunrise+57', 'sunrise+66', 'd2', M ? M.t0 + 16.5 : 'd3.1', M ? M.t0 + 21 : 'd3.2', M ? M.t0 + 25 : 'd3.3', M ? M.t0 + 33 : 'd3.6', M ? M.t0 + 40 : 'd3.7',
  ...nazT, wave, 'd4.5', greet ? greet + 0.2 : 'd5', 'd6', 'd7.9', 'd8.35', 'd8.45', 'd10.2', 'sunset+5', 'n2.5', 'n5.75', 'n5.95']);
out.friday = await determinism('2026-11-06', ['d2.5', 'd4', 'd5.5', 'sunset-10', 'sunset+20', 'n3']);
out.shabbat = await determinism('2026-11-07', ['sunrise+90', 'd2.4', 'd5', 'd8.2', 'd8.5']);

// ---------------------------------------------------------------------------------------------- 2. the sets
async function sets(date) {
  ctx.time.setDate(date); await frames(3);
  ctx.time.set(ctx.time.parse('d3')); await frames(3);
  const P5 = g5?.state?.plan, cp = ch.state.plan, np = ns.state.plan;
  const nz = cp.naz || [];
  return {
    date, g5: { nazir: P5?.counts?.nazir ?? null, metzora: P5?.counts?.metzora ?? null },
    nazir: { counted: cp.nNaz, staged: nz.length, at: nz.map((n) => ctx.time.format(n.t0)), steps: nz[0] ? nz[0].set.steps.map((s) => s.id).join(' ') : '', waving: nz.filter((n) => n.wave).length },
    metzora: { counted: np.nMetzora ?? null, staged: !!np.M, chatatOlah: !!np.M?.set, steps: np.M?.set ? np.M.set.steps.map((s) => s.id).join(' ') : '', leans: (np.M?.leans || []).map(([a]) => ctx.time.format(a)), inside: np.M ? ctx.time.format(np.M.inside) : null },
    figuresOverPools: [ch.state.cast?.missing ?? 0, ns.state.cast?.missing ?? 0],
    // the chatat's blood before the olah's (Zevachim 10:2); each blood at the altar within ~2 min of its slaughter
    bloodOrder: [...nz.map((n) => n.set), ...(np.M?.set ? [np.M.set] : [])].map((B) => {
      const st = B.steps;
      const cB = st.find((x) => x.id === 'matanot'), oB = st.find((x) => x.id === 'zerikah' && /olah/.test(x.label));
      const sh = st.filter((x) => x.id === 'shechitah'), bl = st.filter((x) => x.id === 'matanot' || x.id === 'zerikah');
      const waits = sh.map((x, i) => (bl[i] ? bl[i].t0 - x.t1 : NaN));
      return `${B.role}: chatat ${cB ? ctx.time.format(cB.t1) : '-'} < olah ${oB ? ctx.time.format(oB.t0) : '-'} ${cB && oB && cB.t1 <= oB.t0 + 1e-6 ? 'ok' : 'WRONG'}; max wait ${Math.max(...waits).toFixed(2)} min`;
    }),
  };
}
out.sets = [await sets('2026-11-02'), await sets('2026-11-03'), await sets('2026-11-06')];

// ---------------------------------------------------------------------------------------------- 3. overlaps
async function sweep(date, t0, t1, step) {
  ctx.time.setDate(date); await frames(3);
  const pairs = new Map(), kohen = [];
  let n = 0, maxFigs = 0;
  for (let t = tOf(t0); t < tOf(t1); t += step) {
    ctx.time.set(t); await frames(2);
    const pts = [];
    for (const e of E) for (const p of e.pools) for (const s of p.slots) {
      if (!s.shown || !s.actor) continue;
      const o = s.actor.object3D.position;
      pts.push({ who: `${e.id}/${p.name}#${s.index}`, x: o.x, y: o.y, z: o.z, pose: s._pose, role: s.actor.role });
    }
    maxFigs = Math.max(maxFigs, pts.length);
    for (const q of pts) if (q.role === 'kohen' && q.y / AM < 5.5) kohen.push(`${ctx.time.format(t)} ${q.who} Z${r3(q.y / AM)}`);
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const a = pts[i], b = pts[j];
      if (Math.abs(a.y - b.y) > 0.7) continue;
      const d = Math.hypot(a.x - b.x, a.z - b.z);
      const lim = a.pose === 'prostrate' || b.pose === 'prostrate' ? 0.5 : 0.32;
      if (d < lim) { const k = `${a.who} x ${b.who}`; if (!pairs.has(k)) pairs.set(k, `${ctx.time.format(t)} ${r3(d)}m ${a.pose}/${b.pose}`); }
    }
    n++;
  }
  return { date, samples: n, maxFigures: maxFigs, closePairs: pairs.size, pairs: [...pairs].slice(0, 12).map(([k, v]) => `${v} ${k}`), kohenOnMount: kohen.length, kohenFirst: kohen.slice(0, 4) };
}
out.overlaps = [await sweep('2026-11-02', 'sunrise-20', 'sunset+10', 3), await sweep('2026-11-06', 'd1.5', 'sunset', 6)];

// ---------------------------------------------------------------------------------------------- 4. watchable rows
ctx.time.setDate('2026-11-02'); await frames(3);
const rows = [];
for (const s of ['d2.2', 'd3', 'd4.2', naz ? naz.t0 + 9 : 'd4.4', M ? M.t0 + 33 : 'd3.6', 'd6']) {
  ctx.time.set(tOf(s)); await frames(2);
  const dyn = ctx.schedule.dynamic?.(tOf(s)) || [];
  const mine = dyn.filter((ev) => ev.id.startsWith('g4:') || ev.id.startsWith('set:'));
  rows.push(`${ctx.time.format(tOf(s))}: ${mine.map((ev) => `${ev.id} [${ev.parent}] ${ev.view ? 'view' : 'NO VIEW'} "${(ev.title?.en || '').slice(0, 60)}"`).join(' | ') || '-'}`);
}
out.rows = rows;

// ---------------------------------------------------------------------------------------------- 5. cues at 120×
ctx.time.setDate('2026-11-02'); await frames(4);
async function play(from, to, speed) {
  for (const e of E) e.handle.fired.clear();
  ctx.time.set(tOf(from)); await frames(3);
  ctx.time.setSpeed(speed); ctx.time.pause(false);
  const t0 = tOf(from), len = ((tOf(to) - t0) + 1440) % 1440;
  let played = 0, prev = ctx.time.t;
  const fired = [];
  const seen = new Map();
  while (played < len) {
    await frames(1);
    const t = ctx.time.t;
    played += ((t - prev) + 1440) % 1440; prev = t;
    for (const e of E) for (const [k, v] of e.handle.fired) if (!seen.has(`${e.id}|${k}`)) { seen.set(`${e.id}|${k}`, v); fired.push(`${e.id}|${k}`); }
  }
  ctx.time.pause(true);
  return { fired, t0, len };
}
function plannedKeys(t0, len) {
  const keys = [];
  const inWin = (x) => Number.isFinite(x) && (((x - t0) + 1440) % 1440) > 0 && (((x - t0) + 1440) % 1440) <= len;
  const cp = cd.state.plan;
  for (const g of cp.greets) if (inWin(g.at + 0.06)) keys.push(`courts-daily|${g.key}`);
  if (cp.keyBreak && inWin(cp.breakAt)) keys.push(`courts-daily|${cp.keyBreak}`);
  const np = ns.state.plan;
  for (const c of np.cueKeys) if (inWin(c.at)) keys.push(`nikanor-stations|${c.key}`);
  for (const h of np.handovers) if (inWin(h.t + 0.1)) keys.push(`nikanor-stations|${h.key}`);
  for (const B of np.sets || []) for (const c of B.cues) if (inWin(c.t)) keys.push(`nikanor-stations|set:${B.role}:${c.key || c.id}:${Math.round(c.t * 10)}`);
  const chp = ch.state.plan;
  for (const c of chp.cues) if (inWin(c.at)) keys.push(`chambers-daily|${c.key}`);
  for (const B of chp.sets || []) for (const c of B.cues) if (inWin(c.t)) keys.push(`chambers-daily|set:${B.role}:${c.key || c.id}:${Math.round(c.t * 10)}`);
  const sp = rt.choreo('sanhedrin').state.plan;
  for (const c of sp.cues) if (inWin(c.at)) keys.push(`sanhedrin|${c.key}`);
  return keys;
}
const cueRuns = [];
for (const [a, b] of [['sunrise+50', 'd4.6'], ['d4.6', 'd10.8'], ['n4.8', 'n6.1']]) {
  const r = await play(a, b, 120);
  const want = plannedKeys(r.t0, r.len);
  const missing = want.filter((k) => !r.fired.includes(k));
  const extra = r.fired.filter((k) => !want.includes(k));
  cueRuns.push({ window: `${ctx.time.format(r.t0)}+${Math.round(r.len)}m`, planned: want.length, fired: r.fired.length, missing: missing.slice(0, 8), extra: extra.slice(0, 8) });
}
for (const e of E) e.handle.fired.clear();
const cp = cd.state.plan, np = ns.state.plan;
const jumpTs = [cp.greets[0]?.at, np.cueKeys[0]?.at, np.handovers[3]?.t].filter(Number.isFinite);
for (const x of jumpTs) { ctx.time.set(x - 0.2); await frames(2); ctx.time.set(x + 0.3); await frames(2); }
out.cues = { runs: cueRuns, jumpFired: E.reduce((s, e) => s + e.handle.fired.size, 0) };

// ---------------------------------------------------------------------------------------------- 6. cost
const wrapUp = new Map();
for (const e of E) {
  const u = e.mod.update;
  const rec = { ms: [] };
  wrapUp.set(e.id, rec);
  e.mod.update = function (...a) { const t0 = performance.now(); try { return u.apply(this, a); } finally { rec.cur = (rec.cur || 0) + performance.now() - t0; } };
  e._origUpdate = u;
}
const cost = {};
const nazAt = naz ? naz.t0 + 8 : 'd4.2';
for (const [name, T, pos, look] of [['mount', 'd3.2', [290, 228, 0], [300, -3]], ['en', 'd3.2', [365, 330.5, 6], [270, 0]], ['gazit', 'd5', [46, 381, 16], [90, 0]], ['meal', 'd4', [240, 288, 16], [350, -6]], ['nazir-rings', nazAt, [238, 366, 16], [265, -4]]]) {
  ctx.time.set(tOf(T)); ctx.player.teleport({ at: pos }); ctx.player.setLook(look[0], look[1]); await frames(5);
  ctx.time.setSpeed(1); ctx.time.pause(false);
  const per = [];
  const mod = {};
  for (let f = 0; f < 150; f++) {
    for (const r of wrapUp.values()) r.cur = 0;
    await frames(1);
    let sum = 0; for (const [id, r] of wrapUp) { sum += r.cur || 0; mod[id] = (mod[id] || 0) + (r.cur || 0) / 150; }
    per.push(sum);
  }
  ctx.time.pause(true);
  per.sort((a, b) => a - b);
  const avg = per.reduce((a, b) => a + b, 0) / per.length;
  cost[name] = { avg: r3(avg), p50: r3(per[75]), p95: r3(per[142]), max: r3(per[149]), byModule: Object.fromEntries(Object.entries(mod).map(([k, v]) => [k, r3(v)])), figures: rt.stats.figures, simMs: r3(rt.stats.ms) };
}
for (const e of E) e.mod.update = e._origUpdate;
out.cost = cost;

// ---------------------------------------------------------------------------------------------- the metzora's corners
// nikanor-stations publishes the minutes its vessel kohen holds the altar's NE and SW corners (plan.M.neBlood /
// swBlood); private-offerings books exactly those (its P.hot 'ne' / 'sw'), read through the documented sim.planOf
{
  ctx.time.setDate('2026-11-02'); await frames(3);
  ctx.time.set(ctx.time.parse('d3')); await frames(3);
  const P5 = rt.planOf('private-offerings'), PN = rt.planOf('nikanor-stations');
  const M = PN?.M;
  const book = (id, iv) => { const h = P5?.hot?.find((x) => x.id === id)?.book; if (!h || !iv) return null; for (let i = 0; i < h.s.length; i++) if (Math.abs(h.s[i] - iv[0]) < 1e-9 && Math.abs(h.e[i] - iv[1]) < 1e-9) return true; return false; };
  const hms = (x) => { const s = Math.round((((x % 1440) + 1440) % 1440) * 60); return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':'); };
  const fmt = (iv) => (iv ? `${iv.map(hms).join('–')} (${(iv[1] - iv[0]).toFixed(2)} min)` : null);
  out.metzoraCorners = {
    planOf: { g5: !!P5, nikanor: !!PN },
    counted: P5?.counts?.metzora ?? null,
    sw: fmt(M?.swBlood), ne: fmt(M?.neBlood), g5: P5?.metzoraBlood ? { sw: fmt(P5.metzoraBlood.sw), ne: fmt(P5.metzoraBlood.ne) } : null,
    bookedExactly: M ? { sw: book('sw', M.swBlood), ne: book('ne', M.neBlood) } : 'no metzora today',
    setIds: (ctx.schedule.dynamic?.(M ? M.t0 + 33 : ctx.time.t) || []).map((ev) => ev.id).filter((id) => !id.startsWith('offering:')).slice(0, 6),
  };
  out.metzoraCorners.ok = !!P5 && !!PN && (!M || (out.metzoraCorners.bookedExactly.sw === true && out.metzoraCorners.bookedExactly.ne === true));
}
// the plans' build time for a fresh date (all four Mount modules, warm code)
const tp0 = performance.now();
ctx.time.setDate('2026-11-04'); await frames(1);
ctx.time.set(ctx.time.parse('d3')); await frames(2);
out.planMs = r3(performance.now() - tp0);
return out;

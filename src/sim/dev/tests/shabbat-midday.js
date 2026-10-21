// Shabbat between the services (2026-11-07): showbread-eaten (shabbat-mishmar: the Kohen Gadol's loaves) and
// shabbat-altar-day (altar-night: the pile tended now and then), staged with the same rules as the other modules:
//   1. determinism — the same t by three jump orders gives identical figures (position, heading, pose, phase, props)
//      and the great pile's levels;
//   2. alive — every 2 min through showbread-eaten the Kohen Gadol is there with at least two others; through
//      shabbat-altar-day, how often someone tends the pile (figures on the altar top) and the visits planned;
//   3. the stacks — the Kohen Gadol's half comes off each stack first: the leader alone, then he and the Kohen Gadol's
//      man each holding one through the shares, then the man alone after the leader's own share;
//   4. spacing — every 0.1 min through the window no two figures of these modules (and the division's groups) closer
//      than 0.5 amah (0.24 m), and the Kohen Gadol (seed 0x6b67) wanted by one module at a time from the morning on;
//   5. cues — continuous play at 120× through the window: every planned key once, none on jumps;
//   6. cost — the two modules' update time per frame (runtime EMA) during the play; shots of the group and the pile.
// Run: node src/sim/dev/run.mjs --q low --out shots/sim-core-2 --script src/sim/dev/tests/shabbat-midday.js "t=d4"
const rt = ctx.schedule.runtime, time = ctx.time;
const IDS = ['shabbat-mishmar', 'altar-night'];
const E = Object.fromEntries(IDS.map((id) => [id, rt.choreo(id)]));
const r3 = (x) => Math.round(x * 1000) / 1000;
const W = (t) => ((t % 1440) + 1440) % 1440;
const res = { failed: IDS.filter((id) => !E[id] || E[id].failed) };
time.setDate('2026-11-07'); await frames(4);
const z = time.zmanim;
const ev = (id) => ctx.schedule.byId(id);
const eaten = ev('showbread-eaten'), day = ev('shabbat-altar-day'), div = ev('showbread-divided');
res.windows = { divided: [div?.t0, div?.t1].map((t) => time.format(t)), eaten: [eaten?.t0, eaten?.t1].map((t) => time.format(t)), altarDay: [day?.t0, day?.t1].map((t) => time.format(t)) };
const B = E['shabbat-mishmar'].state.plan, A = E['altar-night'].state.plan?.altar?.day;
res.plan = { kg: !!B?.kg, visitsKg: B?.kg?.t.visits.length, half: time.format(B?.kg?.t.half), sharesN: [B?.t.startN, B?.t.endN].map((t) => time.format(t)), sharesS: [B?.t.startS, B?.t.endS].map((t) => time.format(t)), take: time.format(B?.kg?.t.take), share: time.format(B?.kg?.t.share), end: time.format(B?.kg?.t.end), altarVisits: A?.visits.length, altarVisitTimes: A?.visits.slice(0, 8).map((v) => `${time.format(v.t0)}+${(v.t1 - v.t0).toFixed(1)} ${v.who.join('/')}`), warn: B?.warn?.slice(0, 6) };

function figs(ids = IDS) {
  const out = [];
  for (const id of ids) {
    const e = rt.choreo(id);
    if (!e?.relevant) continue;
    for (const p of e.pools) for (const s of p.slots) {
      if (!s.want) continue;
      const o = s.actor?.object3D?.position;
      // (site X, Y as placed; Z from the world position: a floor-snapped slot keeps a cache key in _site[2])
      out.push({ k: `${id}/${p.name}#${s.index}`, seed: p.spec?.seed, i: s.index, X: s._site?.[0], Y: s._site?.[1], Z: s.pos.y / 0.48,
        line: `${id}/${p.name}#${s.index} ${o ? `${r3(o.x)},${r3(o.y)},${r3(o.z)}` : '-'} h${r3(s._heading)} ${s._pose}${Number.isNaN(s._phase) ? '' : '@' + r3(s._phase)} ${s._g2r ?? s._prop ?? ''}/${s._g2l ?? ''}`,
        pr: s._g2r ?? s._prop ?? null, pose: s._pose });
    }
  }
  return out;
}
const fire = () => ['altar.maarachah.great', 'altar.maarachah.great.inner'].map((id) => r3(ctx.fx?.fires?.get?.(id)?.target ?? -1)).join('/');
const snap = () => ({ figs: figs().map((f) => f.line), fire: fire() });
const at = async (t) => { time.set(W(t)); await frames(3); return snap(); };

// ---- 1. determinism
{
  const ts = [div.t0 - 2, ...(B?.t.hand ? [B.t.hand.N.t + 0.06, B.t.hand.S.split + 0.05] : []), div.t0 + 6.4, div.t0 + 7.0, B?.kg ? B.kg.t.take + 0.1 : div.t0 + 8, div.t1 + 1, eaten.t0 + 30, eaten.t0 + 61.3, time.resolve({ dayHour: 6 }), time.resolve({ dayHour: 7 }),
    ...(A?.visits || []).slice(0, 3).map((v) => (v.t0 + v.t1) / 2), eaten.t1 - 5, eaten.t1 - 3];
  const S1 = {}, S2 = {}, S3 = {};
  for (const t of ts) S1[t] = await at(t);
  for (const t of [...ts].reverse()) S2[t] = await at(t);
  for (const t of ts) { await at(t + 500); S3[t] = await at(t); }
  const diffs = [];
  for (const t of ts) {
    const a = JSON.stringify(S1[t]), b = JSON.stringify(S2[t]), c = JSON.stringify(S3[t]);
    if (a !== b || a !== c) diffs.push({ t: time.format(W(t)), a: S1[t].figs.find((x, i) => x !== S2[t].figs[i] || x !== S3[t].figs[i]), b: S2[t].figs.find((x, i) => x !== S1[t].figs[i]), fire: [S1[t].fire, S2[t].fire, S3[t].fire] });
  }
  res.determinism = { ok: diffs.length === 0, n: ts.length, diffs: diffs.slice(0, 5), counts: Object.fromEntries(ts.map((t) => [time.format(W(t)), `${S1[t].figs.length} fire ${S1[t].fire}`])) };
}

// ---- 2. alive
{
  const gaps = [];
  let n = 0, kgOk = 0;
  for (let t = eaten.t0; t < eaten.t1 - 6; t += 2) {
    time.set(W(t)); await frames(2);
    const f = figs(['shabbat-mishmar']);
    const kg = f.some((x) => x.k.includes('kohen-gadol'));
    n++;
    if (kg && f.length >= 3) kgOk++; else gaps.push(`${time.format(W(t))} kg ${kg} n ${f.length}`);
  }
  let tend = 0, m = 0;
  for (let t = day.t0; t < day.t1; t += 1) {
    time.set(W(t)); await frames(1);
    m++;
    if (figs(['altar-night']).some((x) => x.Z > 21)) tend++;
  }
  res.alive = { eaten: { samples: n, withKgAndTwo: kgOk, ok: kgOk === n, gaps: gaps.slice(0, 6) }, altarDay: { minutes: m, tendedOnTop: tend, share: r3(tend / Math.max(1, m)) } };
}

// ---- 3. the stacks at the hand-overs: the Kohen Gadol's half comes off first (Yoma 1:2, 17b; MK 10:18), so the leader
// holds the stack alone until his man has received it (split), then each holds one through the shares, until the
// leader takes his own share last and the watch's bread is gone (at gone, his kemitzah); the half stays with his man
{
  const sides = [];
  for (const side of ['N', 'S']) {
    const H = B.t.hand?.[side];
    if (!B.kg || !H || !Number.isFinite(H.t)) continue;
    // this side's stack: its leader (the incoming's slot 0 in the north, the outgoing's in the south), and the
    // Kohen Gadol's man of that side (kg-kohanim#1 north, #0 south)
    const lead = side === 'N' ? 'shabbat-mishmar/incoming#0' : 'shabbat-mishmar/outgoing#0';
    const man = side === 'N' ? 'shabbat-mishmar/kg-kohanim#1' : 'shabbat-mishmar/kg-kohanim#0';
    const want = (t) => (t < H.split ? lead : t < H.gone ? `${lead}+${man}` : man);
    const near = (t) => [H.split, H.gone].some((b) => Math.abs(t - b) < 0.011);
    const holders = [];
    let bad = 0, n = 0;
    for (let t = H.t - 0.6; t <= H.gone + 0.8; t += 0.02) {
      if (near(t)) continue;
      time.set(W(t)); await frames(1);
      n++;
      const got = figs(['shabbat-mishmar']).filter((x) => x.pr === 'loaves_todah' && (x.k === lead || x.k === man)).map((x) => x.k).sort().join('+');
      if (got !== want(t).split('+').sort().join('+')) bad++;
      if (holders[holders.length - 1] !== got) holders.push(got);
    }
    sides.push({ side, tHand: time.format(W(H.t)), sharesFrom: time.format(W(side === 'N' ? B.t.startN : B.t.startS)), gone: time.format(W(H.gone)), samples: n, holders, samplesWrong: bad });
  }
  res.stacks = { ok: sides.length === 2 && sides.every((s) => s.samplesWrong === 0), sides };
}

// ---- 4. spacing and the one Kohen Gadol
{
  const close = [];
  let minD = Infinity, samples = 0, dupKg = 0;
  for (let t = div.t0 - 3.5; t < eaten.t1; t += (t > div.t1 + 6 ? 0.5 : 0.1)) {
    time.set(W(t)); await frames(1);
    samples++;
    const f = figs().filter((x) => Number.isFinite(x.X) && x.Z < 21);
    // pairs with at least one of the new figures (the Kohen Gadol's group, the day's tenders): the division's own
    // groups are G6's (g6.js)
    const isNew = (x) => /kohen-gadol|kg-kohanim|altar-night/.test(x.k);
    for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) {
      if (!isNew(f[i]) && !isNew(f[j])) continue;
      const d = Math.hypot(f[i].X - f[j].X, f[i].Y - f[j].Y);
      if (d < minD) minD = d;
      if (d < 0.5 && close.length < 8) close.push(`${time.format(W(t))} ${f[i].k} ${f[j].k} ${d.toFixed(2)}`);
    }
    let kg = 0;
    for (const e of rt.entries) if (e.relevant) for (const p of e.pools) if (p.spec?.seed === 0x6b67) for (const s of p.slots) if (s.want) kg++;
    if (kg > 1) dupKg++;
  }
  res.spacing = { ok: close.length === 0 && dupKg === 0, samples, minAmot: r3(minD), close, dupKg };
}

// ---- 5. cues at 120×, 6. cost
{
  const calls = [];
  const capt = [];
  ctx.bus.on?.('caption', (e) => capt.push(`${time.format(time.t)} ${e.id}`));
  const keys = () => { const s = new Set(); for (const id of IDS) for (const k of E[id].handle.fired.keys()) s.add(`${id}:${k}`); return s; };
  const costs = Object.fromEntries(IDS.map((id) => [id, []]));
  async function play(from, to, speed, near) {
    time.set(W(from)); await frames(3);
    if (near) { ctx.player.teleport({ at: near }); await frames(3); }
    time.setSpeed(speed); time.pause(false);
    const fired = new Set();
    let played = 0, prev = time.t;
    while (played < W(to - from)) {
      await frames(1);
      played += W(time.t - prev); prev = time.t;
      for (const id of IDS) costs[id].push(E[id].relevant ? E[id].ms : 0);
      for (const k of keys()) fired.add(k);
    }
    time.pause(true);
    return fired;
  }
  for (const id of IDS) E[id].handle.fired.clear();
  const fired = await play(div.t0 - 4, div.t1 + 8, 60, [241, 346]);
  const fired2 = await play(eaten.t0 + 0.25, eaten.t0 + 3, 20, [240, 349]);   // the UI's jump-to-event landing
  const all = [...fired, ...fired2].filter((k) => /mm-kg|altar/.test(k));
  const before = capt.length;
  for (const tt of [E['shabbat-mishmar'].state.cue.kgHalf, eaten.t0 + 0.7]) { time.set(W(tt - 0.2)); await frames(2); time.set(W(tt + 0.2)); await frames(2); }
  res.cues = { kg: all, captions: capt.filter((c) => /showbread-kg/.test(c)), jumpCaptions: capt.length - before, ok: all.some((k) => k.includes('mm-kg-half')) && all.some((k) => k.includes('mm-kg-eat')) && capt.length === before };
  res.cost = Object.fromEntries(IDS.map((id) => { const v = costs[id].filter((x) => x > 0).sort((a, b) => a - b); return [id, v.length ? { n: v.length, p50: r3(v[Math.floor(v.length / 2)]), p95: r3(v[Math.floor(v.length * 0.95)]), max: r3(v[v.length - 1]) } : null]; }));
  res.cost.simTotal = { ms: r3(rt.stats.ms), peak: r3(rt.stats.msPeak) };
}

// ---- shots: the Kohen Gadol's group from the event's view; the pile tended from the ramp's top
{
  time.set(W(eaten.t0 + 40)); await frames(4);
  ctx.player.teleport({ at: [240, 350], heading: 200 }); ctx.player.setLook?.(200, -6); await frames(30); await sleep(1500);
  await shot('shabbat-kg-loaves');
  ctx.player.teleport({ at: [240, 336.5], heading: 180 }); ctx.player.setLook?.(180, -10); await frames(30); await sleep(1500);
  await shot('shabbat-kg-loaves-near');
  const v = A?.visits?.[1] || A?.visits?.[0];
  if (v) {
    time.set(W(v.t0 + (v.t1 - v.t0) * 0.55)); await frames(4);
    ctx.player.teleport({ at: [217, 303, 23.7], heading: 0 }); ctx.player.setLook?.(0, -8); await frames(30); await sleep(1500);
    await shot('shabbat-altar-day');
  }
}
res.ok = res.failed.length === 0 && res.determinism.ok && res.alive.eaten.ok && res.stacks.ok && res.spacing.ok && res.cues.ok;
return res;

// Source gaps staged (docs/decisions/source-gaps-staged.md). THROWS (the harness exits 1) on a failure.
//   1. gates — Tadi shut all day; the other Mount and Azarah gates open by day and shut at night; at the opening and the
//      shutting each gate's Levite of the night watch is on duty (pose 'lock' at the bar, or standing aside), a guard_levi.
//   2. ramp salt — the salter on the ramp with salt, casting it.
//   3. Friday — three wipers at the altar with cloths; the kanim kohen in the Heichal; the reeds out after his visit.
//   4. Sunday — the kanim kohen in the Heichal; the reeds back after his visit (out before it).
//   5. the afternoon call — the caller at the head of the fifteen steps, in 'call'.
//   6. the officer over the song on the duchan during the song (13 Levites).
//   7. Shabbat — the musaf's limbs on the ramp's EAST lower half (Rambam TuM 6:3).
//   8. sweep — the new figures (temple-duties, the gate Levites, the seals' buyers, kohanim and officers) not inside a
//      solid, not off the floor, not inside another figure; re-pose after jumps identical.
//   9. the seals by day (Shekalim 5:3–4) — a buyer for each libation the day stages, the right seal for its animal (a ram
//      "male", the rest of the flock "kid", the nazir "kid" and "male", the metzora "sinner"); at the desk: the money held
//      out to Yochanan, the seal to Achiyah, the wine received; the kohen with it at the silver table before its bearer
//      takes it up; the jug waiting on the table; none on Shabbat; the evening reckoning still staged.
// Run: node src/sim/dev/run.mjs --q low --timeout 900 --script src/sim/dev/tests/source-gaps.js "date=2026-11-06&t=sunrise"
const rt = ctx.schedule.runtime, time = ctx.time, ph = ctx.physics, S = ctx.schedule;
const { AMAH: AM } = await import('/src/core/units.js');
const r2 = (x) => Math.round(x * 100) / 100;
const fails = [], out = {};
const errs = [];
const oe = console.error;
console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 300)); oe.apply(console, a); };
const at = async (t) => { time.set(t); await frames(2); };
const shown = (entryId, pool) => { const e = rt.choreo(entryId); const p = e?.pools.find((q) => q.name === pool); return p ? p.slots.filter((s) => s.want && s.actor) : []; };
const door = (id) => ctx.movables?.get?.(`door:${id}`)?.userData?.openAmount ?? NaN;
const siteOf = (s) => { const o = s.actor.object3D.position; return [o.x / AM, -o.z / AM, o.y / AM]; };
const sweepBad = new Map();
const note = (k, m) => { const l = sweepBad.get(k) || { n: 0, ex: [] }; l.n++; if (l.ex.length < 3) l.ex.push(m); sweepBad.set(k, l); };
function sweep(label) {
  const figs = [];
  for (const e of rt.entries) for (const p of e.pools) for (const s of p.slots) if (s.want && s.actor) figs.push({ e: e.id, p: p.name, s, o: s.actor.object3D.position, animal: !!p.spec.animal });
  const mine = figs.filter((f) => f.e === 'temple-duties' || (f.e === 'night-watch' && f.p === 'guards') || (f.e === 'chambers-daily' && /^seal/.test(f.p)));
  for (const f of mine) {
    const pose = f.s._pose || '';
    if (/^(sleep|lie)/.test(pose)) continue;
    const inside = ph.insideAt(f.o.x, f.o.y + 1.0, f.o.z);
    const fl = ph.levelFloor(f.o.x, f.o.z, f.o.y);
    const off = fl == null ? NaN : f.o.y - fl;
    const [X, Y, Z] = siteOf(f.s);
    if (inside) note(`${f.e}/${f.p} inside a solid`, `${label} #${f.s.index} ${r2(X)},${r2(Y)},${r2(Z)} ${pose}`);
    else if (!(Math.abs(off) <= 0.15)) note(`${f.e}/${f.p} off the floor`, `${label} #${f.s.index} ${r2(X)},${r2(Y)},${r2(Z)} off ${r2(off)} ${pose}`);
    for (const g of figs) {
      if (g === f || Math.abs(g.o.y - f.o.y) > 0.6) continue;
      const d = Math.hypot(g.o.x - f.o.x, g.o.z - f.o.z);
      if (d < 0.3) note(`overlap ${f.e}/${f.p} ~ ${g.e}/${g.p}`, `${label} #${f.s.index}/#${g.s.index} ${r2(d)} m at ${r2(X)},${r2(Y)}`);
    }
  }
}
const ev = (id) => S.byId(id);
const win = (id) => { const e = ev(id); return e ? [e.t0, e.t1] : null; };

// ---------------------------------------------------------------------------------------------- weekday 2026-11-02
time.setDate('2026-11-02'); await frames(3);
const z = time.zmanim;
const G = { tadi: 'mount.gate.tadi', shushan: 'mount.gate.shushan', kiponus: 'mount.gate.kiponus', nikanor: 'azarah.gate.nikanor', mayim: 'azarah.gate.mayim' };
await at(z.chatzot);
out.noon = Object.fromEntries(Object.entries(G).map(([k, id]) => [k, r2(door(id))]));
if (!(out.noon.tadi < 0.01)) fails.push(`Tadi open at noon (${out.noon.tadi})`);
for (const k of ['shushan', 'kiponus', 'nikanor', 'mayim']) if (!(out.noon[k] > 0.9)) fails.push(`${k} not open at noon (${out.noon[k]})`);
// the opening: sample its window; count the gate Levites in 'lock' or aside (not at their post's stand)
const wo = win('gates-opened');
const duty = { lock: 0, walk: 0, max: 0 };
for (let t = wo[0]; t <= wo[1]; t += 0.15) {
  await at(t);
  const g = shown('night-watch', 'guards');
  const locks = g.filter((s) => s._pose === 'lock').length;
  duty.lock = Math.max(duty.lock, locks); duty.max = Math.max(duty.max, g.length);
  if (Math.round(t / 0.15) % 4 === 0) sweep(`open ${time.format(t)}`);
}
out.opening = duty;
if (duty.lock < 1) fails.push('no gate Levite at the bar during the opening');
const roles = new Set(shown('night-watch', 'guards').map((s) => s.actor.role));
out.guardRoles = [...roles];
await at(z.tzeit - 20);
out.dusk = Object.fromEntries(Object.entries(G).map(([k, id]) => [k, r2(door(id))]));
if (!(out.dusk.nikanor > 0.9 && out.dusk.shushan > 0.9)) fails.push(`gates shut before the Levites arrive: ${JSON.stringify(out.dusk)}`);
const ws = win('gates-shut');
let shutLocks = 0;
for (let t = ws[0]; t <= ws[1]; t += 0.2) { await at(t); shutLocks = Math.max(shutLocks, shown('night-watch', 'guards').filter((s) => s._pose === 'lock').length); if (Math.round(t / 0.2) % 4 === 0) sweep(`shut ${time.format(t)}`); }
await at(z.tzeit + 8);
out.night = Object.fromEntries(Object.entries(G).map(([k, id]) => [k, r2(door(id))]));
out.shutLocks = shutLocks;
if (shutLocks < 1) fails.push('no gate Levite barring at the shutting');
for (const k of Object.keys(G)) if (!(out.night[k] < 0.05)) fails.push(`${k} not shut at night (${out.night[k]})`);
// the salt
const wsa = win('ramp-salt');
let salted = 0, saltSeen = 0;
for (let t = wsa[0]; t <= wsa[1]; t += 0.4) { await at(t); const s = shown('temple-duties', 'salter'); saltSeen = Math.max(saltSeen, s.length); if (s.some((x) => x._pose === 'salt')) salted++; sweep(`salt ${time.format(t)}`); }
out.salt = { seen: saltSeen, salting: salted };
if (!saltSeen || !salted) fails.push(`salter ${JSON.stringify(out.salt)}`);
// the afternoon call
const wc = win('afternoon-call');
let called = 0;
for (let t = wc[0]; t <= wc[1]; t += 0.15) { await at(t); if (shown('temple-duties', 'caller').some((x) => x._pose === 'call')) called++; }
out.call = called;
if (!called) fails.push('no caller in "call" before the afternoon tamid');
// the officer over the song
const sw = win('song-weekday');
await at((sw[0] + sw[1]) / 2);
out.duchan = shown('ketoret-morning', 'levites').length;
if (out.duchan !== 13) fails.push(`${out.duchan} Levites on the duchan during the song, want 13 (12 and the officer)`);

// the seals by day (Shekalim 5:3–4)
{
  const cd = rt.choreo('chambers-daily');
  await at(win('seals-sale')[0] + 1);
  const P4 = cd?.state?.plan, SD = P4?.sealsDay;
  const P5 = ctx.schedule.runtime.choreo('private-offerings')?.state?.plan;
  out.seals = SD ? { n: SD.n, of: SD.of, dropped: SD.dropped, span: SD.span?.map((x) => time.format(x)), window: win('seals-sale').map((x) => time.format(x)) } : null;
  if (!SD || !SD.n) fails.push(`no seals sold on a weekday: ${JSON.stringify(out.seals)}`);
  else {
    if (SD.dropped > Math.max(2, 0.15 * SD.of)) fails.push(`seals: ${SD.dropped} of ${SD.of} libations without a buyer`);
    // the seal for each animal (Shekalim 5:3)
    const bad = [];
    for (const b of SD.buyers) {
      if (b.key.startsWith('set:nazir')) { if (b.seals.join() !== 'gedi,zachar') bad.push(`${b.key}:${b.seals}`); continue; }
      if (b.key.startsWith('set:metzora')) { if (b.seals.join() !== 'chotei') bad.push(`${b.key}:${b.seals}`); continue; }
      const inst = P5?.insts?.find((x) => x.id === b.key);
      if (!inst) { bad.push(`${b.key}: no offering`); continue; }
      if (!['olah', 'shelamim', 'todah'].includes(inst.type)) bad.push(`${b.key}: a ${inst.type} has no libations (Menachot 9:6)`);
      const want = inst.species === 'ram' ? 'zachar' : 'gedi';
      if (b.seals.join() !== want) bad.push(`${b.key} ${inst.species}: ${b.seals} want ${want}`);
      if (!(b.tSet < b.tPick)) bad.push(`${b.key}: on the table ${time.format(b.tSet)} after its bearer takes it ${time.format(b.tPick)}`);
    }
    // every staged libation of an olah, shelamim or todah has its buyer (but the kayitz olot, the public's)
    const libs = (P5?.insts || []).filter((x) => ['olah', 'shelamim', 'todah'].includes(x.type) && !x.job?.kayitz && x.tracks.some((tr) => /^N2b?$/.test(tr.role) && tr.slot >= 0));
    out.seals.g5Libations = libs.length;
    out.seals.kinds = SD.buyers.reduce((m, b) => { const k = b.seals.join('+'); m[k] = (m[k] || 0) + 1; return m; }, {});
    if (bad.length) fails.push(`seals: ${bad.slice(0, 5).join(' · ')}`);
    // one buyer through the desk: the money, the seal, the wine; the kohen at the line and at the table
    const b = SD.buyers[Math.floor(SD.buyers.length / 2)];
    const buyer = () => shown('chambers-daily', 'seal-buyers').find((s) => { const [X, Y] = siteOf(s); return X > 203 && X < 216 && Y > 400 && Y < 411; });
    const steps = {};
    for (let t = b.mark - 1.6; t <= b.mark + 0.1; t += 0.04) {
      await at(t);
      const s = buyer();
      if (!s) continue;
      if (s._pose === 'carry_limbs' && s._prop === 'coins') steps.money = steps.money || time.format(t);
      if (s._pose === 'point') steps.seal = steps.seal || time.format(t);
      if (/^carry/.test(s._pose) && s._prop === 'wine_jug') steps.wine = steps.wine || time.format(t);
      const off = shown('chambers-daily', 'seals');
      if (off.some((o) => o._pose === 'carry_limbs' && o._prop === 'coins')) steps.yochanan = steps.yochanan || time.format(t);
      if (off.some((o) => /^carry/.test(o._pose) && o._prop === 'wine_jug')) steps.achiyah = steps.achiyah || time.format(t);
      if (Math.round(t / 0.04) % 6 === 0) sweep(`seals ${time.format(t)}`);
    }
    out.seals.desk = steps;
    for (const k of ['money', 'seal', 'wine', 'yochanan', 'achiyah']) if (!steps[k]) fails.push(`seals: no "${k}" at the desk (${JSON.stringify(steps)})`);
    await at(b.mark + 0.2);
    const kh = shown('chambers-daily', 'seal-kohanim').filter((s) => s._prop === 'wine_jug');
    if (!kh.length) fails.push('seals: no kohen with the wine after the hand-over');
    await at(b.tSet - 0.05);
    const kt = shown('chambers-daily', 'seal-kohanim').map((s) => siteOf(s).map(r2));
    out.seals.kohenAtTable = kt;
    if (!kt.some(([X, Y]) => X > 204 && X < 209 && Y > 278 && Y < 284)) fails.push(`seals: no kohen at the silver table at ${time.format(b.tSet)}: ${JSON.stringify(kt)}`);
    await at((b.tSet + b.tPick) / 2);
    const jugs = (cd.state.free || []).filter((f) => f?.on && f.name === 'wine_jug').length;
    out.seals.jugsOnTable = jugs;
    if (!jugs) fails.push('seals: no wine waiting on the silver table');
    sweep('seals-table');
  }
  // the evening reckoning: the two officers
  const we = win('seals');
  await at((we[0] + we[1]) / 2);
  out.seals = { ...out.seals, evening: shown('chambers-daily', 'seals').length };
  if (out.seals.evening !== 2) fails.push(`the evening reckoning: ${out.seals.evening} officers, want 2`);
}

// ---------------------------------------------------------------------------------------------- Friday 2026-11-06
time.setDate('2026-11-06'); await frames(3);
const ww = win('altar-wiping');
let wipers = 0;
for (let t = ww[0]; t <= ww[1]; t += 3) { await at(t); const w = shown('temple-duties', 'wipers'); wipers = Math.max(wipers, w.filter((x) => x._pose === 'tend_lamp').length); sweep(`wipe ${time.format(t)}`); }
out.wipers = wipers;
if (wipers !== 3) fails.push(`${wipers} wipers at work, want 3`);
const ko = win('kanim-out');
const kanimOf = () => ctx.movables?.get?.('heichal.shulchan.bread')?.userData?.kanimShown;
await at((ko[0] + ko[1]) / 2 - 0.05);
out.kanimOutKohen = shown('temple-duties', 'kanim-kohen').map((s) => siteOf(s).map(r2));
if (!out.kanimOutKohen.length) fails.push('no kohen at the Shulchan for the kanim on Friday');
sweep('kanim-out');

// ---------------------------------------------------------------------------------------------- Sunday 2026-11-08
time.setDate('2026-11-08'); await frames(3);
const ki = win('kanim-in');
out.kanimIn = ki ? `${time.format(ki[0])}-${time.format(ki[1])}` : null;
if (!ki) fails.push('no kanim-in on Sunday');
else { await at((ki[0] + ki[1]) / 2 - 0.05); out.kanimInKohen = shown('temple-duties', 'kanim-kohen').length; if (!out.kanimInKohen) fails.push('no kohen for the kanim on Sunday'); sweep('kanim-in'); }
time.setDate('2026-11-09'); await frames(3);
if (S.byId('kanim-in')) fails.push('kanim-in on a Monday');

// ---------------------------------------------------------------------------------------------- Shabbat 2026-11-07
time.setDate('2026-11-07'); await frames(3);
if (S.byId('seals-sale')) fails.push('seals-sale on Shabbat');
{ await at(time.zmanim.chatzot); const p = rt.choreo('chambers-daily')?.state?.plan; if (p?.sealsDay?.n) fails.push(`${p.sealsDay.n} seals sold on Shabbat`); if (shown('chambers-daily', 'seal-buyers').length) fails.push('a seal buyer on Shabbat'); }
{ const w = win('shabbat-musaf'); await at(w[0] + 20); }          // (the module plans when it becomes relevant)
const sm = rt.choreo('shabbat-musaf');
const M = sm?.state?.plan;
if (!M) fails.push('no Shabbat musaf plan');
else {
  const P = (await import('/src/sim/choreo/g2/places.js')).places(ctx);
  const limbs = M.items.filter((it) => it.part);
  const xs = limbs.map((it) => it.keys[0].X);
  out.musafLimbsX = [r2(Math.min(...xs)), r2(Math.max(...xs)), 'ramp mid', r2(P.ramp.mid)];
  if (!xs.length || Math.min(...xs) <= P.ramp.mid) fails.push(`Shabbat musaf limbs not on the ramp's east half: x ${out.musafLimbsX}`);
  if (M.warn.length) fails.push(`Shabbat musaf plan warnings: ${M.warn.slice(0, 4).join(' · ')}`);
}

// ---------------------------------------------------------------------------------------------- determinism
time.setDate('2026-11-06'); await frames(3);
const snap = () => { const o = []; for (const e of rt.entries) if (e.id === 'temple-duties' || e.id === 'night-watch' || e.id === 'chambers-daily') for (const p of e.pools) for (const s of p.slots) if (s.want && s.actor && (e.id !== 'chambers-daily' || /^seal/.test(p.name))) { const q = s.actor.object3D.position; o.push(`${p.name}${s.index}:${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}:${s._pose}`); } return o.sort().join('|'); };
const moments = [win('gates-opened')[0] + 1, win('ramp-salt')[0] + 1.5, win('altar-wiping')[0] + 5, win('kanim-out')[0] + 0.1, win('gates-shut')[0] + 1, win('afternoon-call')[0] + 0.4,
  ...(() => { const b = rt.choreo('chambers-daily')?.state?.plan?.sealsDay?.buyers || []; return b.length ? [b[0].mark - 0.5, b[Math.floor(b.length / 2)].mark + 0.1, b[b.length - 1].tSet - 0.1] : []; })()];
const first = [];
for (const m of moments) { await at(m); first.push(snap()); }
time.setDate('2026-11-02'); await frames(3); time.setDate('2026-11-06'); await frames(3);
const differ = [];
for (let i = moments.length - 1; i >= 0; i--) { await at(moments[i]); if (snap() !== first[i]) differ.push(time.format(moments[i])); }
out.determinism = differ;
if (differ.length) fails.push(`re-pose differs at ${differ}`);

out.sweep = Object.fromEntries([...sweepBad].map(([k, l]) => [k, `${l.n}: ${l.ex.join(' | ')}`]));
if (sweepBad.size) fails.push(`sweep: ${[...sweepBad.keys()].join(', ')}`);
out.errors = errs;
if (errs.length) fails.push(`console errors ${errs.length}`);
out.fails = fails;
console.error = oe;
if (fails.length) throw new Error(`source-gaps: ${fails.length} failure(s)\n${JSON.stringify(out, null, 1).slice(0, 6000)}`);
return out;

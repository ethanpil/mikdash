// Source gaps staged (docs/decisions/source-gaps-staged.md). THROWS (the harness exits 1) on a failure.
//   1. gates — Tadi shut all day; the other Mount and Azarah gates open by day and shut at night; at the opening and the
//      shutting each gate's Levite of the night watch is on duty (pose 'lock' at the bar, or standing aside), a guard_levi.
//   2. ramp salt — the salter on the ramp with salt, casting it.
//   3. Friday — three wipers at the altar with cloths; the kanim kohen in the Heichal; the reeds out after his visit.
//   4. Sunday — the kanim kohen in the Heichal; the reeds back after his visit (out before it).
//   5. the afternoon call — the caller at the head of the fifteen steps, in 'call'.
//   6. the officer over the song on the duchan during the song (13 Levites).
//   7. Shabbat — the musaf's limbs on the ramp's EAST lower half (Rambam TuM 6:3).
//   8. sweep — the new figures (temple-duties, the gate Levites) not inside a solid, not off the floor, not inside
//      another figure; re-pose after jumps identical.
// Run: node src/sim/dev/run.mjs --q low --timeout 900 --script src/sim/dev/tests/source-gaps.js "date=2026-11-06&t=sunrise"
const rt = ctx.schedule.runtime, time = ctx.time, ph = ctx.physics, S = ctx.schedule;
const { AMAH: AM } = await import('/src/core/units.js');
const r2 = (x) => Math.round(x * 100) / 100;
const fails = [], out = {};
const errs = [];
const oe = console.error;
console.error = (...a) => { errs.push(a.map(String).join(' ').slice(0, 300)); oe.apply(console, a); };
const at = async (t) => { time.set(t); await frames(3); };
const shown = (entryId, pool) => { const e = rt.choreo(entryId); const p = e?.pools.find((q) => q.name === pool); return p ? p.slots.filter((s) => s.want && s.actor) : []; };
const door = (id) => ctx.movables?.get?.(`door:${id}`)?.userData?.openAmount ?? NaN;
const siteOf = (s) => { const o = s.actor.object3D.position; return [o.x / AM, -o.z / AM, o.y / AM]; };
const sweepBad = new Map();
const note = (k, m) => { const l = sweepBad.get(k) || { n: 0, ex: [] }; l.n++; if (l.ex.length < 3) l.ex.push(m); sweepBad.set(k, l); };
function sweep(label) {
  const figs = [];
  for (const e of rt.entries) for (const p of e.pools) for (const s of p.slots) if (s.want && s.actor) figs.push({ e: e.id, p: p.name, s, o: s.actor.object3D.position, animal: !!p.spec.animal });
  const mine = figs.filter((f) => f.e === 'temple-duties' || (f.e === 'night-watch' && f.p === 'guards'));
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
for (let t = wo[0]; t <= wo[1]; t += 0.1) {
  await at(t);
  const g = shown('night-watch', 'guards');
  const locks = g.filter((s) => s._pose === 'lock').length;
  duty.lock = Math.max(duty.lock, locks); duty.max = Math.max(duty.max, g.length);
  if (Math.round(t * 10) % 5 === 0) sweep(`open ${time.format(t)}`);
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
for (let t = ws[0]; t <= ws[1]; t += 0.1) { await at(t); shutLocks = Math.max(shutLocks, shown('night-watch', 'guards').filter((s) => s._pose === 'lock').length); if (Math.round(t * 10) % 5 === 0) sweep(`shut ${time.format(t)}`); }
await at(z.tzeit + 8);
out.night = Object.fromEntries(Object.entries(G).map(([k, id]) => [k, r2(door(id))]));
out.shutLocks = shutLocks;
if (shutLocks < 1) fails.push('no gate Levite barring at the shutting');
for (const k of Object.keys(G)) if (!(out.night[k] < 0.05)) fails.push(`${k} not shut at night (${out.night[k]})`);
// the salt
const wsa = win('ramp-salt');
let salted = 0, saltSeen = 0;
for (let t = wsa[0]; t <= wsa[1]; t += 0.25) { await at(t); const s = shown('temple-duties', 'salter'); saltSeen = Math.max(saltSeen, s.length); if (s.some((x) => x._pose === 'salt')) salted++; sweep(`salt ${time.format(t)}`); }
out.salt = { seen: saltSeen, salting: salted };
if (!saltSeen || !salted) fails.push(`salter ${JSON.stringify(out.salt)}`);
// the afternoon call
const wc = win('afternoon-call');
let called = 0;
for (let t = wc[0]; t <= wc[1]; t += 0.1) { await at(t); if (shown('temple-duties', 'caller').some((x) => x._pose === 'call')) called++; }
out.call = called;
if (!called) fails.push('no caller in "call" before the afternoon tamid');
// the officer over the song
const sw = win('song-weekday');
await at((sw[0] + sw[1]) / 2);
out.duchan = shown('ketoret-morning', 'levites').length;
if (out.duchan !== 13) fails.push(`${out.duchan} Levites on the duchan during the song, want 13 (12 and the officer)`);

// ---------------------------------------------------------------------------------------------- Friday 2026-11-06
time.setDate('2026-11-06'); await frames(3);
const ww = win('altar-wiping');
let wipers = 0;
for (let t = ww[0]; t <= ww[1]; t += 1) { await at(t); const w = shown('temple-duties', 'wipers'); wipers = Math.max(wipers, w.filter((x) => x._pose === 'tend_lamp').length); sweep(`wipe ${time.format(t)}`); }
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
const snap = () => { const o = []; for (const e of rt.entries) if (e.id === 'temple-duties' || e.id === 'night-watch') for (const p of e.pools) for (const s of p.slots) if (s.want && s.actor) { const q = s.actor.object3D.position; o.push(`${p.name}${s.index}:${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}:${s._pose}`); } return o.sort().join('|'); };
const moments = [win('gates-opened')[0] + 1, win('ramp-salt')[0] + 1.5, win('altar-wiping')[0] + 5, win('kanim-out')[0] + 0.1, win('gates-shut')[0] + 1, win('afternoon-call')[0] + 0.4];
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

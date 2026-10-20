// Group G6 (Shabbat and Friday): shabbat-musaf, shabbat-showbread, shabbat-mishmar, shabbat-eve.
//   1. determinism — the same t reached by different jump orders gives identical figures (position, heading, pose,
//      phase, props) and free props, on Shabbat (2026-11-07) and on Friday (2026-11-06);
//   2. cues — continuous play at 120× through the musaf → the division, and through the Friday blasts: every cue key
//      once, no sound or caption twice at the same moment, none on jumps;
//   3. cost — the four modules' update time per frame (runtime EMA per entry, summed) during that play, with the
//      costliest frames (time, per module);
//   4. the hand-overs — shabbat-showbread → shabbat-mishmar at the division's start: the figure is in the same place;
//      nothing of G6 on a weekday;
//   5. the musaf's fallback plan (libation-song not staging the pour): built without warnings, with its pourer.
// run: node src/sim/dev/run.mjs --q low --script src/sim/dev/tests/g6.js "date=2026-11-07&t=07:30"
const rt = ctx.schedule.runtime;
const IDS = ['shabbat-musaf', 'shabbat-showbread', 'shabbat-mishmar', 'shabbat-eve'];
const E = IDS.map((id) => rt.choreo(id));
if (E.some((e) => !e || e.failed)) return { error: 'module missing or failed', ids: IDS.map((id) => `${id}:${!!rt.choreo(id)}:${rt.choreo(id)?.failed}`) };
const r3 = (x) => Math.round(x * 1000) / 1000;
const tOf = (s) => (typeof s === 'number' ? ((s % 1440) + 1440) % 1440 : ctx.time.parse(s));

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
  return { figs, props };
}
const at = async (s) => { ctx.time.set(tOf(s)); await frames(3); return snap(); };
const out = {};

async function determinism(date, T) {
  ctx.time.setDate(date); await frames(3);
  const A = {}, B = {}, C = {};
  for (const s of T) A[s] = await at(s);
  for (const s of [...T].reverse()) B[s] = await at(s);
  for (const s of T) { await at('d10'); C[s] = await at(s); }
  const diffs = [];
  for (const s of T) {
    const a = JSON.stringify(A[s]), b = JSON.stringify(B[s]), c = JSON.stringify(C[s]);
    if (a !== b || a !== c) {
      const fa = A[s].figs, fb = B[s].figs, fc = C[s].figs;
      diffs.push({ t: s, n: [fa.length, fb.length, fc.length], fig: fa.find((x, i) => x !== fb[i] || x !== fc[i]), figB: fb.find((x, i) => x !== fa[i]), figC: fc.find((x, i) => x !== fa[i]), props: A[s].props.join('|') === B[s].props.join('|') && A[s].props.join('|') === C[s].props.join('|') ? 'same' : 'DIFF' });
    }
  }
  const summary = {};
  for (const s of T) {
    const count = {};
    for (const f of A[s].figs) { const k = f.split('#')[0]; count[k] = (count[k] || 0) + 1; }
    summary[s] = `${ctx.time.format(tOf(s))} ${JSON.stringify(count)} props ${A[s].props.length}`;
  }
  return { deterministic: diffs.length === 0, diffs: diffs.slice(0, 6), summary };
}

// ---- 1. determinism on Shabbat and Friday
out.shabbat = await determinism('2026-11-07', ['sunrise+103.4', 'sunrise+104.6', 'sunrise+105.4', 'sunrise+104', 'sunrise+106.3', 'sunrise+108', 'sunrise+109.2', 'sunrise+112.1', 'sunrise+117', 'sunrise+121.5', 'sunrise+127',
  'sunrise+132', 'sunrise+136.2', 'sunrise+139', 'sunrise+141.5', 'sunrise+146', 'sunrise+144.5', 'sunrise+148.5', 'sunrise+150.3', 'sunrise+151.4', 'sunrise+152.2',
  'sunrise+154', 'sunrise+157.6', 'sunrise+160.4', 'sunrise+162.3', 'sunrise+165.99', 'sunrise+166.01', 'sunrise+167', 'sunrise+169', 'sunrise+172', 'sunrise+176', 'sunrise+182', 'sunrise+188']);
out.friday = await determinism('2026-11-06', ['sunset-43', 'sunset-41', 'sunset-39.4', 'sunset-38', 'sunset-36', 'sunset-6', 'sunset-3.5', 'sunset-2', 'sunset+0.5', 'sunset+2']);

// ---- 4a. the hand-over at the division's start: showbread's last pose = mishmar's first
ctx.time.setDate('2026-11-07'); await frames(3);
{
  const B = rt.choreo('shabbat-showbread').state.plan, D0 = B.div[0];
  const pos = (id, pool, i) => { const s = rt.choreo(id).pools.find((p) => p.name === pool).slots[i]; return s.want ? s.actor.object3D.position.clone() : null; };
  ctx.time.set(((D0 - 0.002) % 1440 + 1440) % 1440); await frames(3);
  const before = [0, 1, 2, 3].map((i) => pos('shabbat-showbread', 'outgoing', i));
  ctx.time.set(((D0 + 0.002) % 1440 + 1440) % 1440); await frames(3);
  const after = [0, 1, 2, 3].map((i) => pos('shabbat-mishmar', 'outgoing', i));
  out.handover = before.map((b, i) => (b && after[i] ? +b.distanceTo(after[i]).toFixed(3) : `missing ${!!b}/${!!after[i]}`));
}

// ---- 2. cues at 120x + 3. cost
const SPEED = +(globalThis.__simSpeed || 120);
const calls = [], caps = [];
const audio = ctx.audio;
const origCue = audio.cue, origLib = audio.libation;
audio.cue = (id, pos, opts) => { calls.push({ id, t: +ctx.time.t.toFixed(3), pos: Array.isArray(pos) ? pos.map((v) => +v.toFixed(1)).join(',') : '' }); return origCue.call(audio, id, pos, opts); };
audio.libation = (opts) => { calls.push({ id: 'LIBATION', t: +ctx.time.t.toFixed(3), pos: '' }); return origLib.call(audio, opts); };
const offCap = ctx.bus.on?.('caption', (e) => caps.push({ id: e.id, t: +ctx.time.t.toFixed(2) }));
const fired = {};
const cost = [], top = [];
async function play(date, from, to, stand) {
  ctx.time.setDate(date); await frames(2);
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
    if (sum > (top[top.length - 1]?.sum ?? 0) || top.length < 6) {
      top.push({ sum: +sum.toFixed(3), t: ctx.time.format(ctx.time.t), per: E.map((e) => (e.relevant ? `${e.id}:${e.ms.toFixed(3)}` : '')).filter(Boolean).join(' ') });
      top.sort((a, b) => b.sum - a.sum); top.length = Math.min(top.length, 6);
    }
  }
  ctx.time.pause(true);
  for (const e of E) for (const k of e.handle.fired.keys()) fired[`${e.id}/${k}`] = (fired[`${e.id}/${k}`] || 0) + 1;
}
await play('2026-11-07', 'sunrise+102.5', 'sunrise+150', [225, 346]);
await play('2026-11-07', 'sunrise+150', 'sunrise+166.3', [150, 331, 22]);
await play('2026-11-07', 'sunrise+166.3', 'sunrise+190', [240, 330]);
await play('2026-11-06', 'sunset-44', 'sunset+3', [231, 292]);
ctx.time.setSpeed(1);
// jumps across cue moments fire nothing
const before = calls.length, capsBefore = caps.length;
ctx.time.setDate('2026-11-07'); await frames(2);
for (const s of ['sunrise+106.3', 'sunrise+106.8', 'sunrise+108.9', 'sunrise+109.1', 'sunrise+150.4', 'sunrise+150.9', 'sunrise+166.3', 'sunrise+166.8']) { ctx.time.set(tOf(s)); await frames(2); }
ctx.time.setDate('2026-11-06'); await frames(2);
for (const s of ['sunset-39.6', 'sunset-39.3', 'sunset-3.6', 'sunset-3.3']) { ctx.time.set(tOf(s)); await frames(2); }
const jumpCalls = calls.length - before, jumpCaps = caps.length - capsBefore;
offCap?.();
audio.cue = origCue; audio.libation = origLib;
const count = {};
for (const c of calls) count[c.id] = (count[c.id] || 0) + 1;
const dup = [];
const seen = new Map();
for (const c of calls) { const k = `${c.id}@${c.pos}`; const last = seen.get(k); if (last !== undefined && Math.abs(c.t - last) < 0.05) dup.push(c); seen.set(k, c.t); }
const capDup = [];
const capSeen = new Map();
for (const c of caps) { const last = capSeen.get(c.id); if (last !== undefined && Math.abs(c.t - last) < 0.05) capDup.push(c); capSeen.set(c.id, c.t); }
cost.sort((a, b) => a - b);
const pct = (p) => +(cost[Math.min(cost.length - 1, Math.floor(p * cost.length))] || 0).toFixed(3);

// ---- 4b. a weekday has nothing of G6
ctx.time.setDate('2026-11-04'); ctx.time.set(tOf('sunrise+130')); await frames(3);
const weekday = snap();

out.cues = { sounds: count, captions: caps.filter((c) => !c.id || /^(mu|musaf|showbread|bread|bazichin|bilgah|friday|sb|mm)/.test(c.id)).map((c) => `${ctx.time.format(c.t)} ${c.id}`), captionDoubles: capDup.slice(0, 5), keys: Object.keys(fired), doubles: dup.slice(0, 5), jumpCalls, jumpCaps };
out.costMs = { frames: cost.length, avg: +(cost.reduce((a, b) => a + b, 0) / Math.max(1, cost.length)).toFixed(3), p50: pct(0.5), p95: pct(0.95), max: pct(1), top };
out.perModule = E.map((e) => `${e.id}:${e.ms.toFixed(3)}`).join(' ');
out.debug = E.map((e) => `${e.id}: ${e.mod.debug?.(e.state)}`);
out.weekday = { figs: weekday.figs.length, props: weekday.props.length };

// ---- 5. the musaf's fallback plan (its own pourer, trumpeters and audio)
ctx.time.setDate('2026-11-07'); await frames(3);
{
  const mm = await import('/src/sim/choreo/g6/musaf.js');
  const fb = mm.musafPlan(ctx, rt.choreo('shabbat-musaf').sim, false);
  const cl = mm.musafPlan(ctx, rt.choreo('shabbat-musaf').sim, true);
  const f = (m) => ctx.time.format(((m % 1440) + 1440) % 1440);
  out.fallback = fb ? { warn: fb.warn, pourer: !!fb.pourer, pick: f(fb.t.pickW), pour: f(fb.t.pour), claimedPick: f(cl.t.pickW), claimedPour: f(cl.t.pour), flourUp: f(fb.t.tossF) } : 'no plan';
}
return out;

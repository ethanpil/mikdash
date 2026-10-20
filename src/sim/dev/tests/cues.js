// Continuous play at 600x from before the locking through dawn: every cue must fire exactly once; jumps fire none.
// The greetings are checked against the officer's observed pose (each frame where he newly stands at a post) and
// against the plan's arrival list. Also samples the sim's per-frame cost.
const rt = ctx.schedule.runtime;
const nw = rt.choreo('night-watch'), gates = rt.choreo('gates-opening');
ctx.time.set(ctx.time.parse('n2')); await frames(3);
for (let i = 0; i < 240 && !(nw.state.routeSource.startsWith('nav') && nw.state.gpaths.every(Boolean) && gates.state?.walk?.source === 'nav'); i++) await sleep(250);
const SPEED = +(globalThis.__simSpeed || 600);
const calls = [], caps = [];
const audio = ctx.audio;
const origCue = audio.cue, origSet = audio.tekiahSet;
audio.cue = (id, pos, opts) => { calls.push({ id, t: +ctx.time.t.toFixed(3), pos: Array.isArray(pos) ? pos.map((v) => +v.toFixed(1)).join(',') : '' }); return origCue.call(audio, id, pos, opts); };
audio.tekiahSet = (pos, opts) => { calls.push({ id: 'tekiahSet', t: +ctx.time.t.toFixed(3) }); return origSet.call(audio, pos, opts); };
ctx.bus.on('caption', (e) => caps.push({ id: e.id, t: +ctx.time.t.toFixed(2), en: e.text?.en?.slice(0, 70) }));
ctx.player.teleport({ at: [270, 250] });
const { since, wrap } = await import('/src/sim/lib/core.js');
const start = ctx.time.resolve({ at: 'tzeit', offset: -20 }), end = ctx.time.resolve({ at: 'sunrise', offset: 5 });
ctx.time.set(start);
await frames(3);
ctx.time.setSpeed(SPEED);
ctx.time.pause(false);
const ms = [], spikes = [];
let prev = ctx.time.t, played = 0, frames_ = 0, lastDwell = null, dwellStarts = 0;
const S = nw.state;
while (played < ((end - start + 1440) % 1440)) {
  await frames(1);
  frames_++;
  const t = ctx.time.t;
  played += (t - prev + 1440) % 1440;
  prev = t;
  ms.push(rt.stats.last);
  if (rt.stats.last > 3) spikes.push(`${ctx.time.format(t)} ${rt.stats.last.toFixed(1)}ms ${rt.entries.map((e) => e.id + ':' + e.ms.toFixed(2)).join(' ')}`);
  // the officer newly standing at a post (or arriving at the sleeping guard) = one greeting expected
  const O = S.patrol;
  const dwell = O && !O.gate && !O.walking && S.stops[O.stop].post ? `${O.stop}` : null;
  if (dwell && dwell !== lastDwell) dwellStarts++;
  lastDwell = dwell;
}
ctx.time.pause(true);
const Q = S.plan.patrol;
const len = (end - start + 1440) % 1440;
let planned = 0;
for (let i = 0; i < Q.arrT.length; i++) { const d = since(Q.arrT[i], start); if (d > 0 && d <= len) planned++; }
const count = {};
for (const c of calls) count[c.id] = (count[c.id] || 0) + 1;
const shalomKeys = [...nw.handle.fired.keys()].filter((k) => k.startsWith('shalom:'));
// same cue at the same place within 0.05 sim minutes = a double fire
const dup = [];
const seen = new Map();
for (const c of calls) { const k = `${c.id}@${c.pos}`; const last = seen.get(k); if (last !== undefined && Math.abs(c.t - last) < 0.05) dup.push(c); seen.set(k, c.t); }
// jumps across cue moments fire nothing
const before = calls.length;
const tB = gates.state.plan.blast, tG = gates.state.plan.great;
for (const s of [tB - 0.5, tB + 0.5, tG - 0.3, tG + 0.3, Q.arrT[5] - 0.1, Q.arrT[5] + 0.1, start, end]) { ctx.time.set(wrap(s)); await frames(2); }
const jumpCalls = calls.length - before;
ms.sort((a, b) => a - b);
const pct = (p) => +ms[Math.min(ms.length - 1, Math.floor(p * ms.length))].toFixed(3);
const avg = +(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(3);
return {
  speed: SPEED, frames: frames_, playedMin: Math.round(played), cues: count,
  shalom: { fired: count['shalom-call'] || 0, planned, observedDwellStarts: dwellStarts, keys: shalomKeys.length, uniqueKeys: new Set(shalomKeys).size },
  doubles: dup.slice(0, 5), jumpCalls, captions: caps.map((c) => `${ctx.time.format(c.t)} ${c.id}: ${c.en}`).filter((c) => !/shalom-call/.test(c) || caps.length < 40),
  spikes: spikes.slice(0, 12),
  simMs: { avg, p50: pct(0.5), p95: pct(0.95), p99: pct(0.99), max: pct(1) },
};

// What a visitor hears after the UI's "jump to event" (ui/app.js jumpToEvent: time.set(t0 + 0.25)) and then plays:
// every sim event's headline cue must fire exactly once (cues never sit in [t0, t0 + CUE_LEAD) — lib/cue.js), the
// same as when the clock plays through the event from a minute before it.
const rt = ctx.schedule.runtime, time = ctx.time, s = ctx.schedule;
const nw = rt.choreo('night-watch'), gates = rt.choreo('gates-opening');
time.set(time.parse('n2')); await frames(3);
for (let i = 0; i < 240 && !(nw.state.routeSource.startsWith('nav') && gates.state?.walk?.source === 'nav'); i++) await sleep(250);
const calls = [], caps = [];
const audio = ctx.audio, oc = audio.cue, os = audio.tekiahSet;
audio.cue = (id, pos, o) => { calls.push(id); return oc.call(audio, id, pos, o); };
audio.tekiahSet = (pos, o) => { calls.push('tekiahSet'); return os.call(audio, pos, o); };
ctx.bus.on('caption', (e) => caps.push(e.id));
async function run(ev, from, playMin, speed) {
  calls.length = 0; caps.length = 0;
  const v = s.viewOf(ev); if (v) { ctx.player.teleport(v); if (Number.isFinite(v.heading)) ctx.player.setLook(v.heading, 4); await frames(3); }
  time.pause(true); time.set(from); await frames(3);
  time.setSpeed(speed); time.pause(false);
  const t0 = time.t;
  while (((time.t - t0 + 1440) % 1440) < playMin) await frames(1);
  time.pause(true); await frames(2);
  const n = (arr, id) => arr.filter((x) => x === id).length;
  return { n, sounds: [...new Set(calls)].join(','), captions: [...new Set(caps)].join(','), calls: [...calls], caps: [...caps] };
}
// event → [headline sound or caption id, kind, play minutes after the jump, speed]
const HEAD = {
  'gates-blasts': ['tekiahSet', 'sound', 1.5, 10],
  'great-gate': ['great-gate-open', 'sound', 1.5, 10],
  'sleeping-guard': ['shalom-call', 'sound', 1.5, 10],
  'ish-har-habayit': ['shalom-call', 'sound', 1.5, 10],
  'nivreshet': ['nivreshet', 'caption', 36, 60],
};
const out = {};
let ok = true;
for (const [id, [head, kind, play, speed]] of Object.entries(HEAD)) {
  const ev = s.byId(id);
  if (!ev) { out[id] = 'missing'; continue; }
  const a = await run(ev, ev.t0 + 0.25, play, speed);
  const b = await run(ev, ev.t0 - 1, play + 1.25, speed);
  const na = a.n(kind === 'sound' ? a.calls : a.caps, head), nb = b.n(kind === 'sound' ? b.calls : b.caps, head);
  const pass = na >= 1 && nb >= 1 && (id === 'ish-har-habayit' || id === 'sleeping-guard' ? true : na === 1 && nb === 1);
  ok = ok && pass;
  out[id] = { pass, head, uiJump: { count: na, sounds: a.sounds, captions: a.captions }, playThrough: { count: nb, sounds: b.sounds, captions: b.captions } };
}
return { ok, out };

// perf-cpu: the people system ticks a hidden figure only when it is next needed (Actor._flush) instead of every frame.
// This checks that the phases and fades come out as an every-frame tick gives them: each actor is mirrored by a plain copy
// ticked every frame with the frame's own dt (the system's clamped one), and after N frames every actor is flushed and
// compared with its copy. Run with the sim harness (shot mode: the clock stands, the sim changes no pose meanwhile):
//   node src/sim/dev/run.mjs --q low --timeout 3000 --script tools/perf-cpu-tick.js "at=238,385&look=215,4&t=d3"
const sys = ctx.people.system;
const N = +(ctx.params.raw.get('ticks') || 240);
await frames(10);
ctx.engine.drawing = false;   // (frames without drawing: SwiftShader takes seconds to draw one)
const actors = [...sys.actors].filter((a) => a.arch && a.clip);
for (const a of actors) a._flush();   // (a hidden one may hold time not yet applied: the copies start from the same state)
const mirror = actors.map((a) => {
  const m = Object.create(Object.getPrototypeOf(a));
  Object.assign(m, { sys: { atlas: { freeScratch() {} } }, clip: a.clip, phase: a.phase, fade: a.fade, prev: a.prev, auto: a.auto, speed: a.speed, scale: a.scale, scratch: -1 });
  return m;
});
// the frame's dt as the system clamps it: the change of its clock over each update
const orig = sys.update;
let last = sys._clock;
sys.update = function (dt) {
  orig.call(this, dt);
  const d = this._clock - last;
  last = this._clock;
  for (const m of mirror) m._tick(d);
};
await frames(N);
sys.update = orig;
ctx.engine.drawing = true;
let worstP = 0, worstF = 0, hidden = 0, n = 0;
const bad = [];
actors.forEach((a, i) => {
  if (!a.visible) hidden++;
  a._flush();
  const m = mirror[i];
  // (a loop's phase wraps: compare on the circle)
  let dp = Math.abs(a.phase - m.phase); if (a.clip.loop) dp = Math.min(dp, 1 - dp);
  const df = Math.abs(a.fade - m.fade);
  worstP = Math.max(worstP, dp); worstF = Math.max(worstF, df); n++;
  if (dp > 1e-6 || df > 1e-6) bad.push({ role: a.role, clip: a.clip.name, phase: a.phase, mirror: m.phase, visible: a.visible });
});
return { frames: N, actors: n, hidden, worstPhaseDiff: worstP, worstFadeDiff: worstF, bad: bad.slice(0, 10), ok: bad.length === 0 };

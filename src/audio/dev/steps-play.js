// The visitor's own footsteps in play (ambience.js updateSteps), with the real controller and the real frame loop:
//   node src/sim/dev/run.mjs --q low --timeout 900 --keep-ui --script src/audio/dev/steps-play.js ""
// (--keep-ui: shot mode turns audio off, params.js)
// Boots at the foot of the Chel steps (the default spawn, facing west) and counts the `footsteps` cues and their
// `surface` while (b) climbing the twelve steps, (a) walking and running on the Mount's level pavement, (c) standing,
// (d) teleporting, (e) flying, (f) an auto-walk (goTo). Expected: about one cue per 0.72 m (0.9 m running) on the
// level with no 'stair' cue, mostly 'stair' on the flight, none in c, d, e. The page runs with
// --autoplay-policy=no-user-gesture-required, so ctx.audio.unlock() starts the AudioContext without a gesture.
// the welcome card holds the player's input off until it is dismissed: enable it as a dismissal would
ctx.player.setInputEnabled(true);
document.activeElement?.blur?.();
const ok = await ctx.audio.unlock();
const eng = ctx.audio.engine;
let cues = [];
const real = eng.cue.bind(eng);
eng.cue = (id, pos, o) => { if (id === 'footsteps') cues.push(o?.surface || 'level'); return real(id, pos, o); };
const dts = [];
ctx.engine.onUpdate((dt) => { dts.push(dt); }, 9999);
const P = ctx.player, f = P.position;
const key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, key: code, bubbles: true }));
const r3 = (v) => Math.round(v * 1000) / 1000;
/** run n frames (or until stop()), returning the cues, the horizontal path walked, the rise and the frames' dt */
async function phase(name, n, stop = null) {
  cues = []; dts.length = 0;
  let px = f.x, pz = f.z, path = 0, notGrounded = 0, modes = new Set();
  const y0 = f.y;
  for (let i = 0; i < n; i++) {
    await frames(1);
    path += Math.hypot(f.x - px, f.z - pz); px = f.x; pz = f.z;
    if (!P.grounded) notGrounded++;
    modes.add(P.mode);
    if (stop?.()) break;
  }
  const dtMin = Math.min(...dts), dtMax = Math.max(...dts), dtMean = dts.reduce((a, b) => a + b, 0) / (dts.length || 1);
  const r = { name, frames: dts.length, path: r3(path), rise: r3(f.y - y0), cues: cues.length, stair: cues.filter((c) => c === 'stair').length,
    perM: path > 0 ? r3(cues.length / path) : null, notGrounded, modes: [...modes], dt: [r3(dtMin), r3(dtMean), r3(dtMax)] };
  log(`[test] ${JSON.stringify(r)}`);
  return r;
}
const out = { inputEnabled: P._input?.state?.enabled, active: document.activeElement?.tagName, unlocked: ok, state: ctx.audio.state, start: [r3(f.x), r3(f.y), r3(f.z)], heading: P.heading };
await frames(3);
// (b) the flight: W from the foot of the twelve steps (site.js mount.chel.steps.params.foot), west, until the feet are
// at the top (+6 amot = 2.88 m) or 40 frames
const foot = (ctx.elOpt?.('mount.chel.steps') || ctx.site.elements['mount.chel.steps']).params.foot;
P.teleport({ at: foot }); P.setLook(270, 0);
await frames(4);
const yb = f.y;
key('KeyW', true);
out.b = await phase('b-chel-steps', 40, () => f.y - yb > 2.85);
key('KeyW', false);
// (a) level: the Mount's plaza east of the complex, walking west
P.teleport({ at: [600, 330, 0] }); P.setLook(270, 0);
await frames(4);
key('KeyW', true);
out.a = await phase('a-level-walk', 30);
key('ShiftLeft', true);
out.aRun = await phase('a-level-run', 20);
key('ShiftLeft', false); key('KeyW', false);
// (c) standing
out.c = await phase('c-standing', 10);
// (d) teleports
cues = [];
let tc = 0;
for (const at of [[620, 300, 0], [600, 360, 0], [640, 330, 0]]) { P.teleport({ at }); await frames(2); tc += cues.length; cues = []; }
out.d = { name: 'd-teleports', cues: tc };
log(`[test] ${JSON.stringify(out.d)}`);
// (e) fly: F, then forward and up
key('KeyF', true); key('KeyF', false);
key('KeyW', true); key('Space', true);
out.e = await phase('e-fly', 10);
key('Space', false); key('KeyW', false);
key('KeyF', true); key('KeyF', false); // back to walk (lands)
out.eLand = await phase('e-landing', 12);
// (f) auto-walk: a goTo 12 m west on the plaza
P.teleport({ at: [640, 330, 0] }); await frames(4);
const done = P.goTo({ at: [634, 330, 0] }, 'walk');
let fin = false; done.then(() => { fin = true; }, () => { fin = true; });
out.f = await phase('f-goto-walk', 50, () => fin);
return out;

// "Barkai!" (Tamid 3:2; Yoma 3:1, 28b; report Part VIII §28 #4).
//
// Event served (choreo 'barkai'): after the second lottery the officer says "Go out and see whether the time for
// slaughtering has come." Two kohanim go out of Lishkat HaGazit to the Water Gate: one climbs to its roof walk and
// watches the eastern sky over the low east wall; the other waits on the pavement below (Yoma 28b — one on the roof,
// one on the ground). When the whole east is lit the watcher calls "Barkai!"; the man below asks, as Matya ben Shmuel
// has it, "Is the whole face of the east lit, as far as Hebron?" and he answers "Yes!" (Tamid 3:2). The man below goes
// back to tell the officer; the watcher comes down the stair and follows.
// Which roof is not stated; the schedule shows the Water Gate's (its roof walk by Beit Avtinas). Every pose is a pure
// function of t: two Scripts, rebuilt per date. The calls are cues (audio 'barkai', variant 'hebron'), once each in
// continuous play, with captions.
import { Script, runScripts, playerNear, win, SPEED, headingOf, wrap } from './g2/lib.js';
import { places, spiralUp } from './g2/places.js';
import { cueAt, crossed, CUE_LEAD } from '../lib/cue.js';

const SEED = 0x6261;
const CALL = 2.6;                // minutes after the event's start: the call ⚙
const ASK = 3.5;                 // … the question from below and the answer ⚙
const CAPTION_RANGE = 260;       // m — a call from the roof, heard over the courts

export default {
  id: 'barkai',
  lead: 2.5,
  lag: 6,
  importance: 3,

  init(ctx, events, sim) {
    const P = places(ctx);
    sim.setBounds([80, 255, 0], [230, 390, 45]);
    const state = {
      P,
      men: sim.pool({ name: 'watchers', role: 'kohen', count: 2, seed: SEED, importance: 3 }),
      plan: null, planGen: -1, out: {}, fns: [],
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
    // the per-date plan now, behind the loader (it is rebuilt on a new date)
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) return;
    runScripts(ctx, state.men, [P.watcher, P.asker], t, state.out, state.fns);
    const W = state.P.water;
    if (crossed(state, P.tCall)) {
      cueAt(state, P.keyCall, P.tCall, () => {
        sim.sound('barkai', W.roof, { caption: false });
        if (playerNear(ctx, W.roof, CAPTION_RANGE)) sim.caption({ en: '"Barkai!" — the whole east is alight: the time for slaughtering has come (Tamid 3:2)', he: 'בַּרְקַאי!' }, { id: 'barkai', duration: 6 });
      });
    }
    if (crossed(state, P.tAsk)) {
      cueAt(state, P.keyAsk, P.tAsk, () => {
        sim.sound('barkai', [(W.roof[0] + W.below[0]) / 2, (W.roof[1] + W.below[1]) / 2, 26], { variant: 'hebron', caption: false });
        if (playerNear(ctx, W.roof, CAPTION_RANGE)) sim.caption({ en: 'From below: "Is the whole face of the east lit, as far as Hebron?" — from the roof: "Yes!" (Tamid 3:2, Matya ben Shmuel; Yoma 28b)', he: 'הֵאִיר פְּנֵי כָל הַמִּזְרָח עַד שֶׁבְּחֶבְרוֹן? — הֵין!' }, { id: 'barkai-hebron', duration: 7 });
      });
    }
  },

  debug(s) {
    const P = s.plan, f = s.fmt;
    return P ? `out ${f(P.tOut)} · on the roof ${f(P.tRoof)} · call ${f(P.tCall)} · ask ${f(P.tAsk)}${P.warn.length ? ` ⚠ ${P.warn.join(' · ')}` : ''}` : 'no plan';
  },
};

function plan(ctx, sim, state) {
  if (state.plan && state.planGen === sim.generation) return state.plan;
  const z = ctx.time?.zmanim;
  const bw = win(sim, 'barkai') || [wrap((z?.alot ?? 280) + 5), wrap((z?.alot ?? 280) + 12)];
  const lot = win(sim, 'second-lottery');
  const P = state.P, W = P.water, Z = P.Z;
  const b0 = bw[0];
  const at = (x) => b0 + ((x - b0 + 2160) % 1440) - 720;        // unwrapped near b0
  // they go out when the officer sends them — when the second lottery is done (Tamid 3:1–2)
  const tOut = lot ? Math.min(at(lot[1]), b0 - 1.0) + 0.1 : b0 - 1.9;
  // round the north end of the amah's open channel and west of the tables (places.js way.westDown) to the Water Gate
  const fromGazit = [P.gazit.door, ...P.way.gazitToNW, [P.apronX, 321, Z], ...P.way.westDown, [212.8, 271.0, Z], W.front];
  const back = [...fromGazit].reverse().slice(1);
  const tCall = b0 + CALL, tAsk = b0 + ASK;
  // ---- the watcher: to the roof walk, the eastern sky, the call, the answer, down again
  // flat pavement and roof at their authored Z; the newel stair queries the floor
  const w = Script.from(tOut, P.gazit.inside, 90, 'watcher').exact();
  w.walk(fromGazit, { speed: 1.3 });
  w.walk([W.passage, W.roomDoor, W.stairFoot], { speed: SPEED.walk });
  w.walk(spiralUp(P), { speed: 0.55, zExact: false });            // the newel stair inside the gatehouse's east room ⚙
  w.walk([W.landing, W.roof], { speed: SPEED.slow });
  const tRoof = w.now();
  // he looks east over the low east wall of the courts — the sky over the Mount of Olives (Middot 2:4) — and scans south
  w.until(tCall - 0.05, { pose: 'stand', heading: 72, sway: 22, seed: SEED + 1 });
  w.act(0.45, { pose: 'point', heading: 78 });
  const toBelow = headingOf(W.roof[0], W.roof[1], W.below[0], W.below[1]);
  w.until(tAsk - 0.1, { pose: 'stand', heading: 75, sway: 10, seed: SEED + 2 });
  w.act(0.7, { pose: 'stand', heading: toBelow });
  // a last look at the east before he goes down ⚙
  w.until(tAsk + 1.7, { pose: 'stand', heading: 80, sway: 16, seed: SEED + 4 });
  w.walk([W.landing], { speed: SPEED.slow });
  w.walk([...spiralUp(P)].reverse(), { speed: 0.55, zExact: false });
  w.walk([W.stairFoot, W.roomDoor, W.passage, W.front], { speed: SPEED.walk });
  w.walk(back, { speed: SPEED.walk });
  // ---- the man below: with him to the gate, then waiting on the pavement, the question, back to the officer
  const a = Script.from(tOut + 0.05, P.gazit.inside, 90, 'asker').exact();
  a.walk([...fromGazit, W.below], { speed: 1.3 });
  const up = headingOf(W.below[0], W.below[1], W.roof[0], W.roof[1]);
  a.until(tAsk - 0.05, { pose: 'stand', heading: up, sway: 12, seed: SEED + 3 });
  a.act(0.35, { pose: 'point', heading: 95 });
  a.act(0.5, { pose: 'stand', heading: up });
  // back to the officer in Lishkat HaGazit with the answer ⚙
  a.walk([W.front, ...back], { speed: SPEED.walk });
  const warn = [...w.warn, ...a.warn];
  if (tRoof > tCall - 0.3) warn.push(`roof late ${(tRoof - tCall).toFixed(2)}`);
  state.plan = {
    watcher: w, asker: a, tOut: wrap(tOut), tRoof: wrap(tRoof), tCall: wrap(tCall), tAsk: wrap(tAsk), warn,
    keyCall: `barkai:${Math.round(tCall * 10)}`, keyAsk: `hebron:${Math.round(tAsk * 10)}`,
  };
  if (tCall - b0 < CUE_LEAD) state.plan.warn.push('call inside CUE_LEAD');
  state.planGen = sim.generation;
  return state.plan;
}

// Friday: the six blasts of Shabbat eve (Sukkah 5:5; report §33.1).
//
// Events served (choreo 'shabbat-eve'):
//   friday-blasts-work   "three to make the people stop their work" — two kohanim with the silver trumpets on the roof
//                        walk of the Water Gate, facing the city, blow teki'ah-teru'ah-teki'ah.
//   friday-blasts-holy   "three to separate the holy from the profane" — the same two, just before sunset.
// The Mishnah counts the blasts but gives neither hour nor place; the schedule shows a roof station (report §33.1) on the
// Water Gate's roof walk (Beit Avtinas is over the gate). They come out of Lishkat HaGazit (the officer sends them ⚙),
// cross the court, climb the newel stair in the gatehouse's east room and step out onto the walk; after the first three
// they go down and back in, and come up again for the last three. Every pose is a pure function of (t, date): one
// Script per trumpeter, rebuilt per date. The blasts are cues (the 'trumpet-set' cue), once each in continuous play.
import { Script, runScripts, win, SPEED } from './g2/lib.js';
import { spiralUp } from './g2/places.js';
import { CUE_LEAD } from '../lib/cue.js';
import { g6places, say, Z } from './g6/common.js';

const SEED = 0x6576;
const AT = CUE_LEAD + 0.02;      // the blasts: just past the jump-to-event moment (lib/cue.js)
const BLOW = 0.32;               // minutes the trumpets are at the lips for one teki'ah-teru'ah-teki'ah ⚙
const READY = 0.25;              // on the walk this long before the blasts ⚙
// outward over the south parapet, one toward the Upper City (south-west, over the mikveh's tank), one toward the Ophel
// and the fields of the Kidron (south, over the stair's well) ⚙ — the first blast is for those in the fields, the
// second for the city (Shabbat 35b); from Beit Avtinas's door (the view) one is seen three-quarter, one in profile
const FACE = [205, 170];
const CAPTION_RANGE = 320;       // m — heard over the whole Mount and the city below
const TEXT = {
  work: { en: 'Friday: three blasts from the roof — the people are to stop their work, Shabbat is near (Sukkah 5:5)', he: 'שָׁלֹשׁ לְהַבְטִיל אֶת הָעָם מִמְּלָאכָה' },
  holy: { en: 'Three more blasts at sundown: to separate the holy from the profane — the last trumpets of the week (Sukkah 5:5)', he: 'וְשָׁלֹשׁ לְהַבְדִּיל בֵּין קֹדֶשׁ לְחֹל' },
};

export default {
  id: 'shabbat-eve',
  lead: 4,          // they come out of the Gazit ~2 minutes before the first blast
  lag: 4,           // … and go down and back in after the last
  importance: 2,

  init(ctx, events, sim) {
    const G = g6places(ctx);
    sim.setBounds([85, 255, 0], [232, 392, 40]);
    const state = {
      G,
      men: sim.pool({ name: 'trumpeters', role: 'kohen', count: 2, seed: SEED, importance: 2, prop: 'trumpet' }),
      plan: null, planGen: -1, out: {}, fns: [],
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) return;
    runScripts(ctx, state.men, P.scripts, t, state.out, state.fns);
    for (const b of P.blasts) say(ctx, state, sim, b.key, b.t, P.roof, b.text, { id: b.key, dur: 7, range: CAPTION_RANGE, sound: ['trumpet-set', P.horn] });
  },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan (not a Friday)';
    const warn = P.scripts.flatMap((x) => x.warn);
    return `${P.blasts.map((b) => `${b.key} ${f(b.t)}`).join(' · ')} · up from ${f(P.scripts[0].t0)}${warn.length ? ` ⚠ ${warn.slice(0, 3).join(' · ')}` : ''}`;
  },
};

function plan(ctx, sim, state) {
  if (state.planGen === sim.generation) return state.plan;
  state.planGen = sim.generation;
  state.plan = null;
  const w1 = win(sim, 'friday-blasts-work'), w2 = win(sim, 'friday-blasts-holy');
  const sets = [w1, w2].filter(Boolean);
  if (!sets.length) return null;
  const G = state.G, P = G.P, W = P.water;
  // the roof walk: the first up goes on west along the walk to the mikveh's tank, the second stays on the stair's
  // landing, at its south parapet over the well ⚙ (from the court the walk's 2-amah parapet hides all but their heads;
  // the event's view is on the terrace, at Beit Avtinas's door)
  const spots = [[W.walkBox.min[0] + 3.85, W.roof[1] + 0.15, W.roof[2]], [W.landing[0] + 0.05, W.sc[1] + 1.1, W.roof[2]]];
  const fromGazit = [P.gazit.door, ...P.way.gazitToNW, [P.apronX, 321, Z], [199.6, 309.2, Z], [199.8, 303.6, Z], [202.6, 296, Z], [206.3, 274.3, Z], [212.8, 271.0, Z], W.front];
  const up = [W.passage, W.roomDoor, W.stairFoot];
  const spiral = spiralUp(P);
  const back = [...fromGazit].reverse().slice(1);
  const T = ['trumpet', null];
  const climb = (s, k) => {
    s.walk(fromGazit, { speed: SPEED.walk, props: T });
    s.walk(up, { speed: SPEED.walk, props: T });
    s.walk(spiral, { speed: 0.55, props: T });
    s.walk([W.landing, spots[k]], { speed: SPEED.slow, props: T });
  };
  // minutes from the Gazit to the spot on the walk (the same steps, dry-run)
  const climbMin = [0, 1].map((k) => { const s = Script.from(0, P.gazit.inside, 90); climb(s, k); return s.now(); });
  const blasts = sets.map((w) => ({ key: w === w1 ? 'friday-work' : 'friday-holy', t: w[0] + AT, text: w === w1 ? TEXT.work : TEXT.holy }));
  const scripts = [0, 1].map((k) => {
    let s = null;
    sets.forEach((w, j) => {
      const tB = w[0] + AT;
      const tStart = tB - READY - climbMin[k] - (k === 0 ? 0.15 : 0);   // the far man leads
      if (!s) s = Script.from(tStart, P.gazit.inside, 90, `trumpeter${k}`);
      else s.hide(tStart, P.gazit.inside, 90);
      climb(s, k);
      s.until(tB - 0.06, { pose: 'stand', heading: FACE[k], sway: 8, seed: SEED + 10 * j + k, props: T });
      s.act(0.06, { pose: 'blow_trumpet', phase: [0, 0.15], heading: FACE[k], props: T });
      s.act(BLOW, { pose: 'blow_trumpet', heading: FACE[k], props: T });
      // they stay a little, looking out over the city; after the last set until the sun is down ⚙
      const last = j === sets.length - 1 && w === w2;
      s.until(last ? Math.max(w[1] + 0.25, s.now() + 1.2) : s.now() + 1.4, { pose: 'stand', heading: FACE[k] + (k ? -12 : 12), sway: 14, seed: SEED + 20 + 10 * j + k, props: T });
      s.walk([W.landing], { speed: SPEED.slow, props: T });
      s.walk([...spiral].reverse(), { speed: 0.55, props: T });
      s.walk([W.stairFoot, W.roomDoor, W.passage, W.front], { speed: SPEED.walk, props: T });
      s.walk([...back, P.gazit.inside], { speed: SPEED.walk, props: T });
    });
    return s;
  });
  const roof = [(spots[0][0] + spots[1][0]) / 2, spots[0][1], spots[0][2]];
  state.plan = { scripts, blasts, roof, horn: [roof[0], roof[1], roof[2] + 3] };
  return state.plan;
}

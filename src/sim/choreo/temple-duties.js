// Small recurring duties the sources name and nothing else staged (docs/decisions/source-gaps-staged.md). Events served
// (choreo 'temple-duties'):
//   ramp-salt       salt cast over the ramp so the kohanim do not slip, even on Shabbat (Rambam TuM 6:3; Eruvin 10:14):
//                   one kohen up the ramp's east half and down its west, casting it ⚙ who and when.
//   altar-wiping    Friday: the altar's stones wiped with a cloth because of the blood (Middot 3:4, Rabbi; Bartenura):
//                   three kohanim with cloths at the NE corner, along the north face and at the SW corner ⚙, leaning over
//                   the yesod and wiping the wall in broad rounds (people 'wipe').
//   kanim-out       Friday: one kohen in the Heichal draws the kanim out of the showbread (Menachot 11:6);
//   kanim-in        Sunday: he puts them back between the loaves (Rambam TuM 5:11). The reeds' state itself is
//                   shabbat-showbread's (shulchan()), keyed on these events' windows.
//   afternoon-call  "Arise, kohanim, to the service…" before the afternoon tamid, by one of the men of the officer over the
//                   times (Rambam KhM 7:2) at the head of the fifteen steps ⚙ where and when.
// One plan of Scripts (g2/lib.js) per date, a pure function of the events' windows; poses and props of the existing set.
import { Script, SPEED, runScripts, walkMin } from './g2/lib.js';
import { places, rampDown } from './g2/places.js';
import { g6places } from './g6/common.js';
import { cueAt, crossed } from '../lib/cue.js';
import { playerNear } from './g2/lib.js';
import { duties as inspectHooks } from './describe/duties.js';

const Z = 16;
const POOLS = { salt: ['salter', 'kohen', 1, 0x7d00], wipers: ['wipers', 'kohen', 3, 0x7d01], kanim: ['kanim-kohen', 'kohen', 1, 0x7d02], caller: ['caller', 'levi', 1, 0x7d03] };

const TEXT = {
  salt: { en: 'Salt is thrown on the ramp "so that the kohanim do not slip and fall when they go up with the wood" — even on Shabbat; the walking is not a service, so the salt under their feet is no barrier (Rambam TuM 6:3; Eruvin 10:14)', he: 'וְזוֹרְקִין מֶלַח עַל גַּבֵּי הַכֶּבֶשׁ אֲפִלּוּ בְּשַׁבָּת כְּדֵי שֶׁלֹּא יַחְלִיק' },
  wipe: { en: 'Erev Shabbat: "they whiten it with a cloth because of the blood" — Rabbi\'s teaching; the first tanna has the whitewash twice a year, at Pesach and Sukkot (Middot 3:4)', he: 'כָּל עֶרֶב שַׁבָּת מְלַבְּנִים אוֹתוֹ בְמַפָּה מִפְּנֵי הַדָּמִים' },
  out: { en: 'Neither setting the kanim nor taking them out overrides Shabbat: on erev Shabbat he goes in, draws them out and lays them along the table (Menachot 11:6)', he: 'נִכְנָס מֵעֶרֶב שַׁבָּת וְשׁוֹמְטָן וְנוֹתְנָן לְאָרְכּוֹ שֶׁל שֻׁלְחָן' },
  in: { en: '"On the first day of the week he goes in and puts the kanim back between the loaves" (Rambam TuM 5:11)', he: 'וּבְאֶחָד בְּשַׁבָּת נִכְנָס וּמַכְנִיס אֶת הַקָּנִים בֵּין הַחַלּוֹת' },
  call: { en: '"Arise, kohanim, to the service; Levites, to the platform; Israel, to the ma\'amad!" — when the time of the offering comes, the officer over the times or one of his men cries it (Rambam KhM 7:2)', he: 'עִמְדוּ כֹּהֲנִים לָעֲבוֹדָה וּלְוִיִּם לַדּוּכָן וְיִשְׂרָאֵל לַמַּעֲמָד' },
};

export default {
  id: 'temple-duties',
  describe: inspectHooks.describe,
  locate: inspectHooks.locate,
  lead: 3,
  lag: 3,
  importance: 1,

  init(ctx, events, sim) {
    sim.setBounds([60, 262, 0], [275, 400, 30]);
    const pools = {};
    for (const [k, [name, role, n, seed]] of Object.entries(POOLS)) pools[k] = sim.pool({ name, role, count: n, seed, importance: k === 'caller' ? 2 : 1 });
    return { pools, plan: null, planGen: -1, out: {}, fns: {} };
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) return;
    for (const [k, list] of Object.entries(P.scripts)) runScripts(ctx, state.pools[k], list, t, state.out, state.fns[k] || (state.fns[k] = []));
    for (const c of P.cues) {
      if (!crossed(state, c.t)) continue;
      cueAt(state, c.key, c.t, () => {
        if (c.sound) sim.sound(c.sound, c.at);
        if (c.text && playerNear(ctx, c.at, c.range || 45)) sim.caption(c.text, { id: c.id, duration: 9 });
      });
    }
  },

  debug(s) {
    const P = s.plan;
    if (!P) return 'no plan';
    return Object.entries(P.scripts).map(([k, l]) => `${k} ${l.filter(Boolean).length}`).join(' · ') + (P.warn.length ? `\n   ⚠ ${P.warn.slice(0, 4).join(' · ')}` : '');
  },
};

/** an event's window unwrapped near `base` (the data's tPlan when retimed), or null when it does not run today */
function evWin(sim, id, base) {
  const e = sim.event?.(id);
  if (!e || !Number.isFinite(e.t0)) return null;
  const w = e.tPlan || [e.t0, e.t1];
  const t0 = base + ((w[0] - base + 2160) % 1440) - 720;
  return [t0, t0 + ((w[1] - w[0] + 1440) % 1440)];
}
const wrap = (t) => ((t % 1440) + 1440) % 1440;

function plan(ctx, sim, state) {
  if (state.planGen === sim.generation) return state.plan;
  state.planGen = sim.generation;
  let P = null;
  try { P = build(ctx, sim); } catch (e) { console.warn('[sim] temple-duties plan failed', e); }
  state.plan = P;
  return P;
}

/** the day's scripts and cues (absolute minutes near noon, wrapped at the end) */
function build(ctx, sim) {
  const base = 720;
  const G = places(ctx), R = G.ramp, A = G.altar, gz = G.gazit;
  const scripts = { salt: [null], wipers: [null, null, null], kanim: [null], caller: [null] };
  const cues = [], warn = [];
  const fromGazit = [gz.door, ...G.way.gazitToNW];                       // → the apron north of the altar
  const toGazit = [...[...G.way.gazitToNW].reverse(), gz.door, gz.inside];

  // ---- the salt on the ramp: up the east half casting it, across the top of the slope, down the west half ⚙
  const ws = evWin(sim, 'ramp-salt', base);
  if (ws) {
    const s = Script.from(ws[0] - 1.6, gz.inside, 90, 'salter');
    s.walk([...fromGazit, [G.apronX, 321, Z], ...G.way.westDown, [R.east, R.foot - 1.2, Z]], { speed: SPEED.walk, props: [null, 'salt'] });
    if (s.now() > ws[0] + 0.4) warn.push(`salter late ${(s.now() - ws[0]).toFixed(1)}`);
    const ys = [R.foot + 1.5, R.foot + 6, R.foot + 11, R.foot + 16, R.foot + 21, R.foot + 26];
    for (const y of ys) {
      s.walk([[R.east, y, R.kevZ(y)]], { speed: SPEED.ramp, props: [null, 'salt'] });
      s.act(0.14, { pose: 'salt', heading: 0, props: [null, 'salt'] });
    }
    const yTop = R.foot + 28;
    s.walk([[R.east, yTop, R.kevZ(yTop)], [R.west, yTop, R.kevZ(yTop)]], { speed: SPEED.slow, props: [null, 'salt'] });
    for (const y of [...ys].reverse()) {
      s.walk([[R.west, y, R.kevZ(y)]], { speed: SPEED.ramp, props: [null, 'salt'] });
      s.act(0.12, { pose: 'salt', heading: 180, props: [null, 'salt'] });
    }
    s.walk([[R.west, R.foot - 1.2, Z], [206.3, 274.3, Z], ...G.way.westUp.slice(1), [G.apronX, 321, Z], ...toGazit], { speed: SPEED.walk, props: [null, 'salt'] });
    scripts.salt[0] = s;
    cues.push({ key: `salt:${Math.round(ws[0])}`, t: wrap(ws[0] + 1.0), text: TEXT.salt, at: [R.east, R.foot + 10, 20], id: 'ramp-salt', range: 45 });
  }

  // ---- Friday: the altar wiped with cloths where the blood is thrown and poured (Middot 3:4; Zevachim 5:4) ⚙
  const ww = evWin(sim, 'altar-wiping', base);
  if (ww) {
    const y = A.yesod;
    // each man's stretch: points along the wall (standing 0.6 amah off the yesod, leaning over it: people's 'wipe' reaches
    // the wall 1.5 amot ahead), facing it
    const runs = [
      [[y.max[0] + 0.6, y.max[1] - 6, 270], [y.max[0] + 0.6, y.max[1] - 2.5, 270], [y.max[0] + 0.6, y.max[1] + 0.6, 225]],      // the east face to the NE corner
      [[y.max[0] - 3, y.max[1] + 0.6, 180], [y.max[0] - 8, y.max[1] + 0.6, 180], [y.max[0] - 13, y.max[1] + 0.6, 180]],         // the north face
      [[y.min[0] - 0.6, y.min[1] + 6, 90], [y.min[0] - 0.6, y.min[1] + 2.5, 90], [y.min[0] - 0.35, y.min[1] - 0.25, 45]],       // the west face to the SW corner
    ];
    runs.forEach((run, k) => {
      const s = Script.from(ww[0] - 1.8 + 0.25 * k, gz.inside, 90, `wiper${k}`);
      const approach = k === 2 ? [...fromGazit, [G.apronX, 321, Z], [199.6, 312, Z]] : k === 1 ? [...fromGazit, [G.apronX + 1.2, 343.6, Z], [run[0][0], 343.6, Z]] : [...fromGazit, [G.apronX + 1.2, 343.6, Z], [y.max[0] + 3, 343.6, Z], [y.max[0] + 3, y.max[1] - 6, Z]];
      s.walk([...approach, [run[0][0], run[0][1], Z]], { speed: SPEED.walk, props: ['sudar', null] });
      const per = (ww[1] - 0.6 - s.now()) / run.length;
      if (per < 1) warn.push(`wiper ${k}: ${per.toFixed(1)} min a stretch`);
      run.forEach(([X, Y, h], j) => {
        if (j) s.walk([[X, Y, Z]], { speed: SPEED.slow, props: ['sudar', null] });
        // the cloth folded into a pad under the palm, wiped in broad rounds (people clip 'wipe', prop wipe_cloth)
        s.until(s.now() + per - (j ? 0.1 : 0), { pose: 'wipe', heading: h, props: ['wipe_cloth', null], sway: 4, seed: 0x7d10 + 3 * k + j });
      });
      const back = k === 2 ? [[199.6, 312, Z], [G.apronX, 321, Z], [G.apronX, 340.2, Z]] : [[s.cur[0], 343.6, Z], [G.apronX + 1.2, 343.6, Z]];
      s.walk([...back, ...toGazit], { speed: SPEED.walk, props: ['sudar', null] });
      scripts.wipers[k] = s;
    });
    cues.push({ key: `wipe:${Math.round(ww[0])}`, t: wrap(ww[0] + 1.0), text: TEXT.wipe, at: [y.max[0], y.max[1], 16], id: 'altar-wiping', range: 50 });
  }

  // ---- the kanim: Friday out, Sunday in — one kohen up the Ulam steps, through the great gate to the Shulchan ⚙
  for (const [id, text] of [['kanim-out', TEXT.out], ['kanim-in', TEXT.in]]) {
    const wk = evWin(sim, id, base);
    if (!wk) continue;
    const H = g6places(ctx).heichal;
    const into = [...fromGazit, ...H.stepsN(335.5), H.gateE, H.gateW, ...H.toNorth, H.northE];
    const s = Script.from(wk[0] - walkMin(gz.inside, into, SPEED.walk) - 0.1, gz.inside, 90, id);
    s.walk(into, { speed: SPEED.walk });
    s.act(0.1, { pose: 'bow', phase: [0, 0.35], heading: 180 });
    s.until(wk[1] - 0.6, { pose: 'tend_lamp', heading: 180, sway: 3, seed: 0x7d20 });
    s.walk([...[...into].reverse().slice(1)], { speed: SPEED.walk });
    scripts.kanim[0] = s;
    cues.push({ key: `${id}:${Math.round(wk[0])}`, t: wrap(wk[0] + 0.7), text, at: [130.3, 337.6, 22], id, range: 30 });
    // the moment the reeds go (out) or come back (in): read by shabbat-showbread through the event's window ⚙
  }

  // ---- the call before the afternoon tamid: from Nikanor's gateway to the head of the fifteen steps and back ⚙
  const wc = evWin(sim, 'afternoon-call', base);
  if (wc) {
    const inG = [256.8, 332.6, 13.5], at = [263, 330.5, 13.5];
    const s = Script.from(wc[0] - 0.5, inG, 90, 'caller');
    s.walk([at], { speed: SPEED.slow });
    s.act(0.1, { pose: 'stand', heading: 90 });
    const tc = Math.max(s.now() + 0.05, wc[0] + 0.6);
    s.until(tc, { pose: 'stand', heading: 90 });
    s.act(0.35, { pose: 'call', heading: 90 });
    s.act(0.25, { pose: 'stand', heading: 90 });
    s.walk([inG], { speed: SPEED.slow });
    s.hide(s.now() + 0.01);
    scripts.caller[0] = s;
    cues.push({ key: `call:${Math.round(tc)}`, t: wrap(tc + 0.02), sound: 'gevini', text: TEXT.call, at: [at[0], at[1], at[2] + 2], id: 'afternoon-call', range: 400 });
  }
  for (const list of Object.values(scripts)) for (const s of list) if (s) warn.push(...s.warn);
  void rampDown;
  return { scripts, cues, warn };
}

// Daily life of the Mount and the outer courts (group G4). Events served (choreo 'courts-daily'):
//   entry-circuit        everyone who comes up enters by the right, goes round counter-clockwise (the courts on his
//                        left) and leaves by the left; opposite each of the thirteen repaired breaches of the soreg he
//                        prostrates (Middot 2:2–3). A mourner — or one under a ban — goes round to the left, against
//                        the stream, and those he meets stop: "Why do you go round to the left?" — "I am a mourner." —
//                        "May He who dwells in this House comfort you" (Middot 2:2).
//   women-court          women in the Ezrat Nashim, on its floor (the gezuztra was built for the Water-Drawing, Sukkah
//                        51b — not used on an ordinary Cheshvan day); men pass up the fifteen steps through Nikanor to
//                        stand in Ezrat Yisrael. Everyone comes from the Mount by the circuit, the chel steps and the
//                        court's east gate, and leaves the same way, going on round with the stream.
//   gate-levites         four Levite gatekeepers: two at Nikanor at the head of the fifteen steps, two inside the east
//                        gate of Ezrat Nashim; a fresh pair of each relieves them at midday ⚙ (report §61).
//   kodashim-meal(-night) male kohanim eating the most-holy portions standing, in the south-east of Ezrat Kohanim by
//                        the cooking place (Zevachim 5:3; Rambam BhB 7:6) — between the temidim and again after the
//                        afternoon service until midnight; a cook at the hearth ('altar.kitchen.fire', which this
//                        module lights). On Friday after sunset nothing is cooked.
//   scouring             before midnight (weekdays): a copper pot scoured with hot water and rinsed in cold, an
//                        earthenware one broken, in the court (Lev 6:21; Zevachim 11:4, 11:7).
// With them, an ordinary weekday's other visitors (qa-r1 SIM-1; how many by the tier: g4/crowd.js): families with their
// children in the stream and in Ezrat Nashim's open bands, people standing a while by the soreg to watch the courts,
// gatherings before the royal stoa, and private-offerings' owners on their way up the Mount with their animals, birds
// and meal-offerings and home again (g5Ways: the same figures as G5's). The day's plan is built at init and after a
// date change. Determinism: every figure runs episodes planned once per date (g4/lib.js Troupe); its pose is a pure function of
// (t, date, seed). Arrivals and departures are through the Chuldah tunnels and over Kiponus' bridge (the Mount),
// through the door of Pinchas' chamber (the kohanim by day) and Beit HaMoked's wicket (the kohanim at night).
import { clamp, smooth, rand, since, within, wrap } from '../lib/core.js';
import { crossed } from '../lib/cue.js';
import { AMAH, w2m } from '../../core/units.js';
import { SITE } from '../../data/site.js';
import { Itin, Troupe, Route, Follower, daySeed, tierCount, win, hm, observerNear, norm, arrivals, DEG } from './g4/lib.js';
import { LOOP, GATES, BREACHES, SPURS, NCOL, COL_DX, visit, visitStops, arrive, leave, bestEntry, walkLoop, enterGate, fwd, back, sOf, exitAfter, entryBefore, syncBreaches, fitAt, buildFrom, release, mpOf, SPEEDS, L as LOOP_L, chuldahLine } from './g4/mount.js';
import { POOLS as G5_POOLS, ANIMALS, poolSeed, WAY_POOLS, WAY_RES, wayEnds } from './g5/plan.js';
import { WALK } from './g5/track.js';
import { g4Book } from './g4/book.js';
import { mountSource } from './g4/watch.js';
import { densityOf, poolSize, poissonDisc, EN_BAND_SPOTS, enBandWay, bandColumn, FAMILY_OFF, SOREG_SITES, STOA_SPOTS, STOA_IN, STOA_OUT, STOA_LANE } from './g4/crowd.js';
import { courts as inspectHooks } from './describe/courts.js';

const SEED = 0x4c31;
const PISH = 'azarah.gate.moked.pishpash';
const KITCHEN_FIRE = 'altar.kitchen.fire';
const CAPTION_RANGE = 30;   // m

// ------------------------------------------------------------------------------------------------ places (site amot)
const EN_IN = [393, 332, 6], EN_OUT = [393, 329, 6];         // just inside the east gate of Ezrat Nashim
// gatekeepers: inside the EN east gate, flanking it; at Nikanor on the landing at the head of the fifteen steps ⚙
const POSTS = [
  { at: [392.4, 323.4, 6], face: 90, via: [] },
  { at: [392.4, 337.6, 6], face: 90, via: [] },
  { at: [262.4, 324.0, 13.5], face: 88, via: [[277.75, 329.4, 6], [270.25, 329.4, 13.5], [264.5, 326.5, 13.5]] },
  { at: [262.4, 337.0, 13.5], face: 92, via: [[277.75, 331.8, 6], [270.25, 331.8, 13.5], [264.5, 334.5, 13.5]] },
];
// the kohanim's meal: south-east of Ezrat Kohanim beside the cooking place (offerings.js STATIONS.meal / .kitchen) ⚙
// the cook tends the cauldron from the hearth's west side: its east side (offerings.js STATIONS.kitchen, the stoking
// mouth) is where private-offerings brings the meat and fries the meal-offerings ⚙
const COOK = [235.05, 295.3, 16];
const SERVE = [235.4, 297.5, 16];
const GROUPS_DAY = [{ c: [237.2, 301.6], n: 4 }, { c: [239.9, 305.4], n: 3 }, { c: [236.6, 309.0], n: 3 }];
const GROUPS_NIGHT = [{ c: [237.2, 301.6], n: 4 }, { c: [239.9, 305.4], n: 3 }, { c: [236.6, 309.2], n: 3 }, { c: [239.7, 313.4], n: 2 }];
// the way in and out by day: Pinchas' chamber (its door to Ezrat Yisrael) and up over the duchan ⚙
const PINCHAS_WAY = [[251.5, 341.5, 13.5], [246.6, 341.5, 13.5], [245.0, 338.8, 13.5], [244.4, 337.6, 13.5], [241.6, 335.8, 16], [239.6, 330, 16], [239.6, 318, 16]];
// …and at night: north along Ezrat Kohanim, west along the court to Beit HaMoked's gate and through its wicket ⚙
const MOKED_WAY = [[240.4, 318, 16], [240.6, 352, 16], [240.6, 387.4, 16], [216, 387.6, 16], [213.25, 388.8, 16], [213.25, 391.0, 16], [213.25, 395.5, 16]];
// the scouring, at the copper basin south of the hearth (build-altar kitchen.js) ⚙
const BASIN = [237.15, 292.95];
const SCOUR = [
  { at: [238.25, 292.45, 16], face: 285 },   // scours the copper pot at the basin
  { at: [236.6, 291.3, 16], face: 10 },      // pours hot water from the cauldron's ladle-jug
  { at: [235.1, 293.1, 16], face: 75 },      // the earthenware pot, broken
];

export default {
  id: 'courts-daily',
  // inspect hooks (console-design §6.2): who each figure is and what it is doing; no behaviour change
  describe: inspectHooks.describe,
  locate: inspectHooks.locate,
  planRank: 1,        // the boot's plan job, after private-offerings (g4/book.js ORDER: first of G4)
  lead: 30,
  lag: 12,
  importance: 1,

  init(ctx, events, sim) {
    syncBreaches(ctx);
    sim.setBounds([-200, 20, -30], [430, 470, 40]);
    const P = (name, role, count, seed, imp = 1, prop = null) => sim.pool({ name, role, count, seed: SEED + seed, importance: imp, prop });
    // the visitors' pools grow with the tier's density (g4/crowd.js: the rates scale with them) — qa-r1 SIM-1
    const N = (n, floor) => poolSize(ctx, n, floor);
    const state = {
      levites: P('gatekeepers', 'guard_levi', 8, 1),
      circMen: P('circuit-men', 'israelite', N(36), 2),
      circWomen: P('circuit-women', 'woman', N(18), 3),
      circKids: P('circuit-children', 'child', N(12, 0.6), 143),
      // the mourner and the one under a ban (Middot 2:2): people's roles mourner / menudeh — the head wrapped as the
      // atifah down to the beard, a fold over the mouth (Moed Katan 24a; Rambam Avel 5:19), dressed in black (people-4)
      mourner: P('mourner', 'mourner', 3, 139, 2),
      menudeh: P('menudeh', 'menudeh', 3, 141, 2),
      greeters: P('greeters', 'israelite', 4, 5, 2),
      enWomen: P('en-women', 'woman', N(30), 6),
      enMen: P('en-men', 'israelite', N(10), 7),
      enKids: P('en-children', 'child', N(22, 0.6), 145),
      // parties standing along the soreg, watching the courts
      watchMen: P('soreg-men', 'israelite', N(30, 0.55), 147),
      watchWomen: P('soreg-women', 'woman', N(10, 0.55), 149),
      watchKids: P('soreg-children', 'child', N(8, 0.55), 151),
      // gatherings before the royal stoa: talking, a teacher with his students, families
      stoaMen: P('stoa-men', 'israelite', N(18, 0.55), 153),
      stoaWomen: P('stoa-women', 'woman', N(5, 0.55), 155),
      stoaKids: P('stoa-children', 'child', N(6, 0.55), 157),
      stoaElders: P('stoa-teachers', 'elder', N(5, 0.55), 159),
      // people crossing the open Mount between the Chuldah stairs, stopping a while on it (qa-r2 SIM-R2-7)
      plazaMen: P('plaza-men', 'israelite', N(14, 0.55), 161),
      plazaWomen: P('plaza-women', 'woman', N(6, 0.55), 163),
      plazaKids: P('plaza-children', 'child', N(4, 0.55), 165),
      // private-offerings' owners and their animals on their way up the Mount and home: the same figures as its own
      ways: Object.fromEntries(WAY_POOLS.map((name) => [name, sim.pool({ name: `g5-ways-${name}`, ...(ANIMALS.has(name) ? { animal: name } : { role: name }),
        count: G5_POOLS[name], seed: poolSeed(name), importance: 2, prop: ANIMALS.has(name) ? undefined : null })])),
      // the meal, the cooking and the scouring are not avodah: the sha'atnez avnet is off (Rambam Klei HaMikdash 8:11;
      // docs/decisions/people.md) — qa-r2 SIM-R2-1
      meal: sim.pool({ name: 'meal', role: 'kohen', count: 12, seed: SEED + 8, importance: 1, prop: null, avnet: false }),
      cook: sim.pool({ name: 'cook', role: 'kohen', count: 1, seed: SEED + 9, importance: 1, prop: null, avnet: false }),
      plan: null, planGen: -1, troupes: [],
      sherds: undefined, sherdsOn: false,
      pish: sim.door(PISH),
      kfLevel: -1,
      fmt: (m) => ctx.time?.format?.(m) ?? hm(m),
      tmp: {},
    };
    // the circuit's watchable rows: someone prostrating opposite a breach now, the mourner going round to the left
    try { state.offSource = ctx.schedule?.addSource?.(mountSource(ctx, () => plan(ctx, state, sim))); } catch (e) { console.warn('[sim:g4] source failed', e); }
    // the day's plan: a step of the runtime's plan job, at boot and on every new date in play (planSteps, sliced between
    // frames — qa-r2 SIM-R2-12, gate-sim-data; hundreds of booked walkers: never in the frame the module wakes in)
    return state;
  },

  /** the day's plan (g4/book.js planBefore calls it for the modules planned after this one) */
  plan(ctx, state, sim) { return plan(ctx, state, sim); },
  /** the same, as an iterator yielding between its planners (the boot's plan job slices it) */
  planSteps(ctx, state, sim) { return planSteps(ctx, state, sim); },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, state, sim);
    if (!P) return;                       // (the boot's undrawn frames, before the plan job has built it)
    for (const tr of state.troupes) tr.update(ctx, sim, t, tr.cb);
    // Beit HaMoked's wicket opens for the kohanim going in to sleep after the night meal
    let pw = 0;
    for (const x of P.pishPass) { const d = t - x; if (d > -0.12 && d < 0.16) pw = Math.max(pw, smooth(-0.12, -0.06, d) * (1 - smooth(0.1, 0.16, d))); }
    if (pw > 0) state.pish.set(pw);
    kitchenFire(state, sim, t, P);
    sherds(ctx, state, P, t);
    cues(ctx, state, sim, t, P);
  },

  release(ctx, state) { state.kfLevel = 0; if (state.sherdsOn) { state.sherds?.setVisible(false); state.sherdsOn = false; } },

  debug(s) {
    const P = s.plan;
    if (!P) return 'no plan';
    const t = s.lastT ?? 0;
    return `plan ${JSON.stringify(P.ms || {})} · circuit ${P.nCirc} parties (${P.dropped} not seated) · EN ${P.nEn} · soreg ${P.nWatch ?? 0} · stoa ${P.nStoa ?? 0} · plaza ${P.nPlaza ?? 0} · owners' ways ${P.ways ? `${P.ways.in} in, ${P.ways.out} out, ${P.ways.skipped} skipped` : '-'} · mourners ${P.mourners.map((m) => `${s.fmt(m.t0)}${m.ban ? '(ban)' : ''}`).join(' ')} · meal ${P.W.meal ? s.fmt(P.W.meal[0]) : '-'}/${P.W.night ? s.fmt(P.W.night[0]) : '-'} · fire ${s.kfLevel.toFixed(2)}`;
  },
};

// ================================================================================================ the day's plan
// Planned first of the G4 modules (g4/book.js ORDER): its walkers book the Mount's prostration places and lanes before
// the judges, the chamber workers and the Nikanor people do.
const fresh = (ctx, state, sim) => state.plan && state.planGen === sim.generation && state.planDate === ctx.time?.dateString;
function plan(ctx, state, sim) {
  if (fresh(ctx, state, sim)) return state.plan;
  // not in the boot's undrawn frames (the plan job builds it); a drawn frame first finishes that job
  if (sim.planNow && !sim.planNow()) return null;
  if (fresh(ctx, state, sim)) return state.plan;
  for (const _ of planSteps(ctx, state, sim));     // eslint-disable-line no-unused-vars
  return state.plan;
}
/** the plan as an iterator: one planner per step (each a few tens to a few hundred ms on low) */
function* planSteps(ctx, state, sim) {
  if (fresh(ctx, state, sim)) return;
  const book = g4Book(ctx, sim);
  book.dropOwner(WHO);
  const seed = daySeed(ctx, SEED);
  const z = ctx.time?.zmanim || {};
  const W = {
    gate: win(sim, 'gate-levites'), women: win(sim, 'women-court'), circuit: win(sim, 'entry-circuit'),
    meal: win(sim, 'kodashim-meal'), night: win(sim, 'kodashim-meal-night'), scour: win(sim, 'scouring'),
  };
  const dayType = ctx.time?.dayType || 'weekday';
  const P = { W, seed, pishPass: [], mourners: [], greets: [], nCirc: 0, nEn: 0, dropped: 0, dayType, sunset: z.sunset, chatzot: z.chatzot,
    metzora: sim.schedule?.byId?.('metzora'), breakAt: NaN, keyBreak: '', watch: [], circEps: [], midIn: [], midOut: [] };
  // the mourners first (their greetings are fixed moments the greeters meet), then the stream, Ezrat Nashim and the
  // gatekeepers, each booking the Mount as it is planned
  const ms = P.ms = {};
  const timed = (k, f) => { const a = performance.now(); const r = f(); ms[k] = Math.round(performance.now() - a); return r; };
  // (built into a list of its own: state.troupes changes only when the whole plan is in)
  const troupes = [];
  // (the planners are iterators: a yield every few arrivals; their minutes counted while they run)
  function* timedG(k, g) { let t = 0, r; for (;;) { const a = performance.now(); r = g.next(); t += performance.now() - a; if (r.done) break; yield; } ms[k] = Math.round(t); return r.value; }
  troupes.push(...(yield* timedG('ways', g5Ways(state, P, seed, sim, book))));
  if (W.circuit) troupes.push(...(yield* timedG('circuit', circuit(state, P, seed, sim, book))));
  if (W.women) troupes.push(...(yield* timedG('en', courtVisitors(state, P, seed, sim, book))));
  if (W.circuit) troupes.push(...(yield* timedG('watch', soregWatchers(state, P, seed, sim, book))));
  if (W.circuit) troupes.push(...timed('stoa', () => stoaGatherings(state, P, seed, sim, book)));
  yield;
  if (W.circuit) troupes.push(...(yield* timedG('plaza', plazaWalkers(state, P, seed, sim, book))));
  if (W.gate) troupes.push(timed('gate', () => gatekeepers(state, P, seed, z, book)));
  // ---- the meal and the scouring (inside the court: no Mount)
  if (W.meal || W.night) troupes.push(...timed('meal', () => meal(state, P, seed, sim)));
  timed('replan', () => { for (const tr of troupes) tr.replan(sim.generation); });
  checkPlaces(ctx, state);
  state.troupes = troupes;
  state.plan = P;
  state.planGen = sim.generation;
  state.planDate = ctx.time?.dateString;
}
const WHO = 'courts-daily';

/**
 * Every fixed standing place of this module on the floor and in the open (qa-r2 SIM-R2-8): not inside a solid at +1 m,
 * within 0.15 m of the floor at its level. Warned once per world (the physics' version): a new collider or a moved
 * place shows up at plan time, not as a figure standing in a wall.
 */
function checkPlaces(ctx, state) {
  const ph = ctx.physics;
  if (!ph?.bvh || state.placesChecked === ph.version) return;
  state.placesChecked = ph.version;
  const pts = [];
  for (const c of EN_CLUSTERS) for (let j = 0; j < 3; j++) { const p = placeOf(c, j, false); pts.push([`en ${c}`, p[0], p[1], 6]); }
  for (const p of EY_SPOTS) pts.push(['ey', p[0], p[1], 13.5]);
  for (const p of POSTS) pts.push(['post', ...p.at]);
  for (const p of PLAZA_SPOTS) pts.push(['plaza', p[0], p[1], 0]);
  for (const p of STOA_SPOTS) pts.push(['stoa', p[0], p[1], 0]);
  for (const g of GROUPS_DAY) pts.push(['meal', g.c[0], g.c[1], 16]);
  pts.push(['cook', ...COOK], ...SCOUR.map((x) => ['scour', ...x.at]));
  const bad = [];
  for (const [what, X, Y, Z] of pts) {
    const x = X * AMAH, z = -Y * AMAH, y = Z * AMAH;
    const f = ph.levelFloor ? ph.levelFloor(x, z, y) : ph.floorAt(x, z);
    if (ph.insideAt(x, (f ?? y) + 1.0, z) || f == null || Math.abs(f - y) > 0.15) bad.push(`${what} @${X.toFixed(1)},${Y.toFixed(1)},${Z} (floor ${f == null ? '-' : (f / AMAH).toFixed(2)})`);
  }
  if (bad.length) console.warn(`[sim:g4] courts-daily: ${bad.length} standing places inside a solid or off the floor: ${bad.slice(0, 6).join('; ')}`);
}

// ------------------------------------------------------------------------------------------------ gatekeepers
function gatekeepers(state, P, seed, z, book) {
  const [w0, w1] = P.W.gate;
  // relief at midday (⚙): the second watch walks in to be at the posts as the first walks out
  const relief = Number.isFinite(z.chatzot) && within(z.chatzot, w0 + 60, w1 - 60) ? z.chatzot : w0 + (w1 - w0) / 2;
  const eps = [];
  for (let k = 0; k < 8; k++) {
    const post = POSTS[k % 4], shift = k < 4 ? 0 : 1;
    const tArr = shift === 0 ? w0 + 0.25 * (k % 4) : relief - 0.6 + 0.2 * (k % 4);
    const tLeave = shift === 0 ? relief + 0.3 + 0.15 * (k % 4) : w1 + 0.15 * (k % 4);
    const r = fitAt(book, WHO, tArr, (mp) => {
      const it = new Itin();
      it.mp = mp;
      visit(it, {
        gate: 'ce', spur: 'en', v: 1.25,
        build: (it) => {
          let left = Math.max(1, tLeave - tArr), n = 0;
          if (shift === 0) {
            it.walkTo([EN_IN, ...post.via, post.at], 1.25);
            it.mark = it.T;
          } else {
            // the relief stands beside the post until the man he relieves has stepped off it, then takes it
            const beside = [post.at[0] - 1.3, post.at[1] + (post.at[1] < 330.5 ? 1.0 : -1.0), post.at[2]];
            it.walkTo([EN_IN, ...post.via, beside], 1.25);
            it.mark = it.T;
            const tOff = relief + 0.3 + 0.15 * (k % 4) + 0.12;
            const w = Math.max(0.1, tOff - tArr);
            it.stand(w, post.face, {});
            it.walkTo([beside, post.at], 0.8);
            left -= w + 0.03;
          }
          // a watch: facing out, the gaze shifting now and then to who comes up (seeded) ⚙
          while (left > 0.05 && n < 2000) {
            const d = Math.min(left, 1.5 + 4 * rand(seed, 'gk', k, n));
            it.stand(d, post.face + (rand(seed, 'gh', k, n) - 0.5) * 50, { turn: true });
            left -= d; n++;
          }
          it.walkTo([post.at, ...[...post.via].reverse(), EN_OUT], 1.25);
        },
      }).done();
      return it;
    });
    eps.push([{ t0: r.t0, T: r.it.T, it: r.it }]);
  }
  return new Troupe(state.levites, { plan: (k) => eps[k], legs: (e) => e.it });
}

// ------------------------------------------------------------------------------------------------ the circuit
// People come up in small parties — alone, two or three together, a man and his wife, a family — through the Chuldah
// tunnels and over Kiponus' bridge, more in the morning after the tamid than at dawn or toward evening ⚙ (the sources
// give the rule of the circuit, not the numbers: an ordinary Cheshvan weekday, never a festival crowd). A party walks
// in file in one lane, each member a pace behind the one ahead (and prostrating a place behind his).
// Families come with their children (m, w, c = a man, a woman, a child) — qa-r1 SIM-1 ⚙ the shares
const PARTY_KINDS = [
  [['m'], 0.30], [['w'], 0.09], [['m', 'm'], 0.11], [['m', 'w'], 0.13], [['w', 'w'], 0.08],
  [['m', 'w', 'w'], 0.07], [['m', 'm', 'm'], 0.05], [['w', 'w', 'w'], 0.04],
  [['m', 'w', 'c'], 0.06], [['m', 'w', 'c', 'c'], 0.04], [['w', 'c'], 0.02], [['m', 'c'], 0.01],
];
const pickKind = (seed, key, i) => { let x = rand(seed, key, i, 'kind'); for (const [k, w] of PARTY_KINDS) { x -= w; if (x <= 0) return k; } return ['m']; };
/** the day's rhythm of arrivals on the Mount (0..1): few at dawn, most in the morning, tapering toward evening ⚙ */
const rhythm = (t, w0, w1) => (0.25 + 0.75 * smooth(w0, w0 + 70, t)) * (1 - 0.6 * smooth(w1 - 150, w1 - 20, t));
const FILE = 0.022;          // minutes between party members (≈ 1.5 m at their pace)
/**
 * When a party's next member sets off: FILE behind the one ahead of him, and after any wait that one made before
 * stepping into the circuit's lane (at the passage's outer end, or at the junction while the lane cleared) — built on
 * his own, he would otherwise walk into him where he waited (qa-r1: the g4 sweep at the eastern Chuldah junction).
 */
function memberStart(prev, j, leadT0, gate, cls) {
  const inDur = GATES[gate].inRoute.length / SPEEDS[cls] / 60;
  const waited = Number.isFinite(prev.it.tLane) ? Math.max(0, prev.it.tLane - inDur) : 0;
  return Math.max(leadT0 + FILE * j, prev.t0 + waited + FILE);
}

/** members' episodes into pool slots (each free over its whole episode); false when they do not all fit */
function seat(free, eps, members) {
  const pick = [];
  for (const m of members) {
    const f = free[m.pool];
    let k = -1;
    for (let i = 0; i < f.length; i++) if (f[i] < m.t0 - 0.6 && !pick.some((p) => p.pool === m.pool && p.k === i)) { k = i; break; }
    if (k < 0) return false;
    pick.push({ pool: m.pool, k });
  }
  members.forEach((m, j) => { const { pool, k } = pick[j]; free[pool][k] = m.t0 + m.T; eps[pool][k].push({ t0: m.t0, T: m.T, it: m.it }); });
  return true;
}

function* circuit(state, P, seed, sim, book) {
  const [w0, w1] = P.W.circuit;
  const out = [];
  // ---- the mourner / the one under a ban: three counter-circuits a day at seeded hours ⚙, four greetings each
  const span = w1 - w0;
  const mEps = [[], [], []], gEps = [[], [], [], []];
  for (let j = 0; j < 3; j++) {
    const t0 = w0 + span * (0.12 + 0.3 * j) + rand(seed, 'mt', j) * span * 0.12;
    const ban = rand(seed, 'ban', j) < 0.3;
    const m = mournerEpisode(t0, ban, seed, j, book);
    if (m.t0 + m.T > w1) { release(m.it.mp); continue; }
    mEps[j].push(m);
    P.mourners.push(m);
    P.watch.push({ kind: 'mourner', t0: m.t0, t1: m.t0 + m.T, it: m.it, ban });
    m.greets.forEach((g, i) => {
      const ge = greeterEpisode(g, seed, j, i, book);
      if (ge) { gEps[i].push(ge); P.greets.push({ ...g, ban, key: `greet:${Math.round(g.at * 10)}` }); }
    });
  }
  out.push(new Troupe(state.mourner, { plan: (k) => mEps[k].filter((m) => !m.ban), legs: (e) => e.it }));
  out.push(new Troupe(state.menudeh, { plan: (k) => mEps[k].filter((m) => m.ban), legs: (e) => e.it }));
  out.push(new Troupe(state.greeters, { plan: (k) => gEps[k].sort((a, b) => a.t0 - b.t0), legs: (e) => e.it }));
  // ---- the stream
  // the gates: most come up by the Chuldah passages, the western the more used ⚙ (Middot 1:3 names both "for entry and
  // exit"); a few over Kiponus' bridge from the Upper City
  const gatesW = [['cw', 0.55], ['ce', 0.3], ['k', 0.15]];
  const pickGate = (i) => { let x = rand(seed, 'g', i); for (const [g, w] of gatesW) { x -= w; if (x <= 0) return g; } return 'cw'; };
  // parties a minute at the peak: × the tier's density (g4/crowd.js; qa-r1 SIM-1)
  const peak = 1.25 * densityOf(sim.ctx);
  const times = arrivals(seed, 'circ', w0 + 0.5, w1 - 14, (t) => peak * rhythm(t, w0, w1), peak);
  const nM = state.circMen.count, nW = state.circWomen.count, nC = state.circKids.count;
  const free = { m: new Array(nM).fill(-1e9), w: new Array(nW).fill(-1e9), c: new Array(nC).fill(-1e9) };
  const eps = { m: Array.from({ length: nM }, () => []), w: Array.from({ length: nW }, () => []), c: Array.from({ length: nC }, () => []) };
  const minArc = 0.4 * LOOP_L;
  let kept = 0, dropped = 0;
  const one = (t, i) => {
    const kind = pickKind(seed, 'circ', i);
    const gate = pickGate(i);
    // a party with women or children goes at the slow pace; men alone at their own (the lane of that pace) ⚙
    const cls = kind.includes('w') || kind.includes('c') ? 0 : [0, 1, 1, 2][Math.floor(rand(seed, 'cls', i) * 4)];
    const build = (prev) => (mp) => { const it = new Itin(); it.mp = mp; visit(it, { gate, spur: null, cls, minArc, prev }).done(); return it; };
    // the leader first (his start slides a little while his lane is not clear), the others a pace behind each
    const lead = buildFrom(book, WHO, t, build(null), 2);
    const members = [{ pool: kind[0], t0: lead.t0, T: lead.it.T, it: lead.it }];
    for (let j = 1; j < kind.length; j++) {
      // (set off a moment later rather than stand at the junction where the next party comes up: buildFrom tries)
      const r = buildFrom(book, WHO, memberStart(members[j - 1], j, lead.t0, gate, cls), build(members[j - 1].it.cols), 1);
      members.push({ pool: kind[j], t0: r.t0, T: r.it.T, it: r.it });
    }
    if (members[0].t0 + members[0].T > w1 + 4 || !seat(free, eps, members)) {
      for (const m of members) release(m.it.mp);
      dropped++;
      return;
    }
    kept++;
  };
  // (the plan job slices it: a yield every second arrival — qa-r2 SIM-R2-12; gate-sim-data: every eighth made 70 ms slices)
  for (let i = 0; i < times.length; i++) { one(times[i], i); if ((i & 1) === 1) yield; }
  P.nCirc = kept;
  P.dropped = dropped;
  out.push(new Troupe(state.circMen, { plan: (k) => eps.m[k], legs: (e) => e.it }));
  out.push(new Troupe(state.circWomen, { plan: (k) => eps.w[k], legs: (e) => e.it }));
  out.push(new Troupe(state.circKids, { plan: (k) => eps.c[k], legs: (e) => e.it }));
  // the watchable rows (g4/watch.js): who is prostrating where
  P.circEps = [...eps.m.flat(), ...eps.w.flat(), ...eps.c.flat()].sort((a, b) => a.t0 - b.t0);
  return out;
}

// the mourner's way in by the western Chuldah gate turning LEFT, round against the stream, out by the eastern one
// (in on the right half of the tunnel like everyone, then left across the stream; out on the leaving half). He walks
// on the circuit's line itself — the stream's lanes on his left, the prostration places on his right.
const MOURN_IN = new Route([...chuldahLine(167), [167, 222, 0], [162.5, 231, 0], [156, 236, 0]], { round: 2.5 });
const MOURN_OUT = new Route([[339, 236, 0], [334.5, 231, 0], [333, 224, 0], ...chuldahLine(333, false)], { round: 2.5 });
const MOURN_V = 1.05, GREET_MIN = 0.5, GREET_LAT = 0.3, GREET_DS = 1.1;

/** is loop distance s among a station's prostration places (± a margin)? */
const nearPlaces = (s, m = 3) => BREACHES.some((b) => {
  const a = b.s + b.cols[0] - m, z = b.s + b.cols[NCOL - 1] + m;
  const x = ((s - a) % LOOP_L + LOOP_L) % LOOP_L;
  return x < z - a;
});

function mournerEpisode(t0, ban, seed, j, book) {
  const s0 = sOf(156, 236), s1 = sOf(339, 236);
  const arc = back(s0, s1);
  // four greetings, spread along his way, clear of the prostration places
  const greets = [];
  for (const f of [0.14, 0.38, 0.61, 0.84]) {
    let d = arc * (f + (rand(seed, 'gd', j, f) - 0.5) * 0.06);
    for (let k = 0; k < 40 && nearPlaces(((s0 - d) % LOOP_L + LOOP_L) % LOOP_L); k++) d += 1.5;
    greets.push({ d, s: ((s0 - d) % LOOP_L + LOOP_L) % LOOP_L });
  }
  const tmp = {};
  const stops = greets.map((g) => {
    LOOP.sample(g.s, tmp, 0, true);
    return { d: g.d, min: GREET_MIN, heading: norm(tmp.heading + 13), pose: 'stand' };
  });
  const it = new Itin();
  it.mp = mpOf(book, t0, WHO);
  it.walk(MOURN_IN, 0, MOURN_IN.length, MOURN_V, { side: 0.4 });
  walkLoop(it, s0, arc, { v: MOURN_V, line: true, dir: -1, stops });
  it.walk(MOURN_OUT, 0, MOURN_OUT.length, MOURN_V, { side: 0.4 });
  it.done();
  // the greeting moments (absolute minutes): his stand legs of exactly a greeting's length
  let gi = 0;
  for (const g of it.legs) {
    if (g.kind === 1 && g.pose === 'stand' && Math.abs(g.t1 - g.t0 - GREET_MIN) < 1e-6 && gi < greets.length) { greets[gi].at = t0 + g.t0; greets[gi].pos = [g.X, g.Y, 0]; gi++; }
  }
  return { t0, T: it.T, it, ban, greets };
}

/** a man with the stream who reaches the mourner's greeting spot as he stops there, steps out of his lane to face him,
 * speaks, and goes on */
function greeterEpisode(g, seed, j, i, book) {
  if (!(g.at > 0)) return null;
  const sMeet = (g.s - GREET_DS + LOOP_L) % LOOP_L;            // a pace short of him, facing him
  const en = entryBefore(sMeet, 25);
  const G = GATES[en.id];
  const cls = rand(seed, 'gc', j, i) < 0.5 ? 1 : 2, v = SPEEDS[cls];
  const tmp = {};
  LOOP.sample(sMeet, tmp, GREET_LAT);
  const at = [tmp.X, tmp.Y, 0];
  const face = norm(tmp.heading - 13);
  const dMeet = fwd(G.sIn, sMeet);
  const ex = exitAfter(sMeet, 40);
  const r = fitAt(book, WHO, g.at, (mp) => {
    const it = new Itin();
    it.mp = mp;
    enterGate(it, en.id, cls, {});
    walkLoop(it, G.sIn, dMeet + ex.arc, { cls, stops: [{ d: dMeet, min: GREET_MIN, heading: face, at, mark: true }] });
    it.walk(GATES[ex.id].outRoute, 0, GATES[ex.id].outRoute.length, v, { side: 0.55 });
    it.done();
    return it;
  });
  return { t0: r.t0, T: r.it.T, it: r.it };
}

// ------------------------------------------------------------------------------------------------ Ezrat Nashim
// Places where a party stands: the two fields either side of the way along the axis, clear of the corner chambers,
// the steps, the gate and the way to the wood store and the nazirites' chamber ⚙. One party at a time on each.
// The west column's two outer places stood inside the corner chambers of oil and of the lepers (X ≤ 302, Y ≤ 305 and
// Y ≥ 356): their row is clipped to the chambers' east faces plus an amah (qa-r2 SIM-R2-8) ⚙
const EN_CLEAR = (() => {
  const b = ['en.chamber.oil', 'en.chamber.lepers'].map((id) => SITE.elements[id]?.box).filter(Boolean);
  return { x: Math.max(302, ...b.map((x) => x.max[0])) + 1, y: [Math.max(305, ...b.filter((x) => x.min[1] < 330).map((x) => x.max[1])), Math.min(356, ...b.filter((x) => x.min[1] > 330).map((x) => x.min[1]))] };
})();
const EN_CLUSTERS = (() => {
  const s = [];
  // (a party's places reach 1.2 amot either side of its spot and 0.95 east of it: MEMBER_OFF)
  const inChamber = (y) => y - 1.2 < EN_CLEAR.y[0] + 0.6 || y + 1.2 > EN_CLEAR.y[1] - 0.6;
  for (const x of [300, 310, 320, 331, 342]) for (const y of [303.5, 313.5, 347.5, 357.5]) s.push([x < EN_CLEAR.x && inChamber(y) ? EN_CLEAR.x : x, y]);
  for (const x of [358, 368, 386]) for (const y of [312, 349]) s.push([x, y]);
  return s;
})();
const EY_SPOTS = [[251.6, 303], [248.2, 306.5], [251.4, 310.5], [247.6, 314.5], [251.0, 318.5], [246.8, 322.6], [250.4, 299], [247.4, 298.4]];
// the ways to those places: north–south aisles east of them (in nearer the wall, out beside it, ≈ 0.43 m apart), then
// west along the place's own row — moved off the row where it would pass within EY_CLEAR of another place ⚙
const EY_AISLE = [253.9, 253.0], EY_CLEAR = 1.4;
function eyWay(sp) {
  const segClear = (ax, ay, bx, by) => EY_SPOTS.every(([X, Y]) => {
    if (Math.abs(X - sp[0]) < 1e-6 && Math.abs(Y - sp[1]) < 1e-6) return true;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
    const k = L2 > 0 ? clamp(((X - ax) * dx + (Y - ay) * dy) / L2) : 0;
    return Math.hypot(ax + dx * k - X, ay + dy * k - Y) >= EY_CLEAR;
  });
  let row = sp[1];
  for (const dy of [0, -2, 2, -2.6, 2.6, -3.2, 3.2]) {
    const y = sp[1] + dy;
    if (segClear(EY_AISLE[0], y, sp[0], y) && segClear(sp[0], y, sp[0], sp[1])) { row = y; break; }
  }
  const at = [sp[0], sp[1], 13.5], via = row === sp[1] ? [] : [[sp[0], row, 13.5]];
  return [[[EY_AISLE[0], row, 13.5], ...via, at], [at, ...via, [EY_AISLE[1], row, 13.5]]];
}
const CHASHAIM = [327.5, 391.4, 6];   // before Lishkat Chasha'im's door (Shekalim 5:6)
// a party's places round its spot: the first facing the Sanctuary, the others beside and a little behind ⚙
const MEMBER_OFF = [[0, 0], [0.9, -1.15], [0.95, 1.2]];

function* courtVisitors(state, P, seed, sim, book) {
  const [w0, w1] = P.W.women;
  const metz = P.metzora && Number.isFinite(P.metzora.t0) ? [P.metzora.t0 - 5, P.metzora.t1 + 5] : null;
  const D = densityOf(sim.ctx);
  // no money is handled on Shabbat (muktzeh): the chests are visited on weekdays and Fridays only
  const coins = P.dayType !== 'shabbat' && shofarot(sim.ctx).length === 13;
  // women's parties (1–3, some with their children), men (alone or two) who go on up into Ezrat Yisrael, and families
  // (a man, his wife and their children) who stand together in Ezrat Nashim ⚙ rates (× the tier's density, qa-r1 SIM-1)
  const wT = arrivals(seed, 'enw', w0 + 0.5, w1 - 30, (t) => 0.4 * D * rhythm(t, w0, w1), 0.4 * D);
  const mT = arrivals(seed, 'enm', w0 + 0.5, w1 - 25, (t) => 0.1 * D * rhythm(t, w0, w1), 0.1 * D);
  const fT = arrivals(seed, 'enf', w0 + 0.5, w1 - 30, (t) => 0.12 * D * rhythm(t, w0, w1), 0.12 * D);
  const cand = [];
  wT.forEach((t, i) => cand.push({ t, i, kind: 'w' }));
  mT.forEach((t, i) => cand.push({ t, i, kind: 'm' }));
  fT.forEach((t, i) => cand.push({ t, i: 5000 + i, kind: 'f' }));
  cand.sort((a, b) => a.t - b.t);
  // the places: the court's original spots, then the open bands' (g4/crowd.js) — a party of four or five only there
  const SPOTS = [...EN_CLUSTERS.map((c) => ({ c, band: null })), ...EN_BAND_SPOTS.map((b) => ({ c: [b[0], b[1]], band: b }))];
  const clusterFree = new Array(SPOTS.length).fill(-1e9);
  const eySpotFree = new Array(EY_SPOTS.length).fill(-1e9);
  const pools = { w: state.enWomen.count, m: state.enMen.count, c: state.enKids.count };
  const free = {}, eps = {};
  for (const k in pools) { free[k] = new Array(pools[k]).fill(-1e9); eps[k] = Array.from({ length: pools[k] }, () => []); }
  // a party of four or five stands in the open bands; a smaller one anywhere (filling the original places first sent more
  // walkers on their diagonal ways past the parties standing in them)
  const pickSpot = (key, i, t, big) => {
    const order = SPOTS.map((_, q) => q).filter((q) => !big || SPOTS[q].band).sort((a, b) => rand(seed, key, i, a) - rand(seed, key, i, b));
    return order.find((x) => clusterFree[x] < t + 3);
  };
  let kept = 0;
  let nCand = 0;
  for (const c of cand) {
    if ((++nCand & 1) === 0) yield;      // (the plan job slices it — qa-r2 SIM-R2-12, gate-sim-data)
    const { t, i } = c;
    let spots, stay, talk = false, chashaim = false, inEY = false, cls = 0, shofar = null, roles;
    if (c.kind === 'w') {
      const r = rand(seed, 'enwk', i);
      const nw = r < 0.45 ? 1 : r < 0.82 ? 2 : 3;
      // some come with their children (one or two) ⚙
      const nc = rand(seed, 'enwc', i) < 0.4 ? 1 + (rand(seed, 'enwc2', i) < 0.4 ? 1 : 0) : 0;
      roles = [...Array(nw).fill('w'), ...Array(Math.min(nc, 5 - nw)).fill('c')];
      stay = 15 + 45 * rand(seed, 'enws', i);
      const q = pickSpot('cl', i, t, roles.length > 3);
      if (q == null) continue;
      talk = nw > 1 && rand(seed, 'talk', i) < 0.4;
      // on the original spots: a gift at Chasha'im or coins into a chest (not from the bands: their ways keep apart) ⚙
      if (!SPOTS[q].band && roles.length === 1) {
        chashaim = rand(seed, 'ch', i) < 0.18;
        // a woman alone puts money into one of the chests (Shekalim 6:5 — the kinnin's, the gozlei olah's, the gifts') ⚙
        if (!chashaim && coins && rand(seed, 'sho', i) < 0.55) shofar = 'w';
      }
      spots = roles.map((_, j) => placeOf(SPOTS[q].c, j, talk, roles.length));
      spots.cluster = q;
    } else if (c.kind === 'f') {
      // a man, his wife and one to three children, standing together ⚙
      const nc = 1 + Math.floor(rand(seed, 'enfc', i) * 3);
      roles = ['m', 'w', ...Array(nc).fill('c')];
      stay = 15 + 35 * rand(seed, 'enfs', i);
      const q = pickSpot('clf', i, t, roles.length > 3);
      if (q == null) continue;
      talk = rand(seed, 'talkf', i) < 0.3;
      spots = roles.map((_, j) => placeOf(SPOTS[q].c, j, talk, roles.length));
      spots.cluster = q;
    } else {
      const n = rand(seed, 'enmk', i) < 0.7 ? 1 : 2;
      roles = Array(n).fill('m');
      stay = 8 + 18 * rand(seed, 'enms', i);
      // men stand in Ezrat Yisrael, except while the metzora's rites fill Nikanor's gateway: then in Ezrat Nashim
      inEY = !(metz && t + 4 < metz[1] && t + stay + 8 > metz[0]);
      if (inEY) {
        const s = EY_SPOTS.map((_, q) => q).filter((q) => eySpotFree[q] < t + 2).slice(0, n);
        if (s.length < n) continue;
        spots = s.map((q) => EY_SPOTS[q]);
        spots.ey = s;
      } else {
        const q = pickSpot('clm', i, t, false);
        if (q == null) continue;
        spots = roles.map((_, j) => placeOf(SPOTS[q].c, j, false, n));
        spots.cluster = q;
        if (!SPOTS[q].band && coins && rand(seed, 'shm', i) < 0.45) shofar = 'm';     // the shekel, wood, frankincense, a gift ⚙
      }
      cls = rand(seed, 'enmc', i) < 0.5 ? 1 : 2;
    }
    const band = spots.cluster != null ? SPOTS[spots.cluster].band : null;
    // in a band the party comes along its row from a column (g4/crowd.js): the first takes the place farthest from it,
    // each next one a nearer one, and they leave the other way round — nobody walks through a place someone stands in
    if (band) { const c = bandColumn(band); spots.sort((p, q) => Math.abs(q[0] - c) - Math.abs(p[0] - c)); }
    const tag = c.kind === 'm' ? 'enm' : c.kind === 'f' ? 'enf' : 'enw';
    let members = [], lead = null, partyExtra = 0;
    // a build that would wait on the way out (the spur down, the lane at its foot) is built again staying longer up
    // there; the leader is set off a little later rather than wait where he comes up onto the circuit. A band party
    // leaves in its set order behind the leader, so a member who would wait moves the whole party's leaving instead.
    for (let attempt = 0; attempt < 2; attempt++) {
      members = []; lead = null;
      let need = 0;
      for (let j = 0; j < roles.length; j++) {
        const e = { k: i * 5 + j, i, cls, v: SPEEDS[cls], stay, spot: spots[j], band, talk, chashaim, men: roles[j] !== 'w', child: roles[j] === 'c', inEY, tag,
          shofar: j === 0 && shofar ? chestFor(sim.ctx, shofar, spots[j], seed, i) : null,
          leaveAbs: band && lead ? lead.t0 + lead.it.markLeave - 1.5 * FILE * j : NaN, extra: j === 0 ? partyExtra : 0 };
        const settle = (r, prevCols) => {
          for (let k = 0; k < 1 && r.it.leaveWait > 0 && !(band && j > 0); k++) {
            release(r.it.mp);
            e.extra = (e.extra || 0) + r.it.leaveWait;
            r = { t0: r.t0, it: enItin(e, seed, mpOf(book, r.t0, WHO), prevCols) };
          }
          return r;
        };
        if (j === 0) {
          lead = settle(buildFrom(book, WHO, t, (mp) => enItin(e, seed, mp, null), 2), null);
          members.push({ pool: roles[j], t0: lead.t0, T: lead.it.T, it: lead.it });
        } else {
          const prevCols = members[j - 1].it.cols;
          const r = settle(buildFrom(book, WHO, memberStart(members[j - 1], j, lead.t0, 'ce', cls), (mp) => enItin(e, seed, mp, prevCols), 1), prevCols);
          members.push({ pool: roles[j], t0: r.t0, T: r.it.T, it: r.it });
          if (band) need = Math.max(need, r.it.leaveWait || 0);
        }
      }
      if (!(need > 0)) break;
      for (const m of members) release(m.it.mp);
      partyExtra += need + 0.02;
      if (attempt === 1) members = null;
    }
    if (!members) continue;
    if (!seat(free, eps, members)) { for (const m of members) release(m.it.mp); continue; }
    // the place is free again once the last of the party has left it (they may have stayed longer: settle)
    const gone = Math.max(...members.map((m) => (Number.isFinite(m.it.markLeave) ? m.t0 + m.it.markLeave : lead.t0 + 5 + stay))) + 0.5;
    if (spots.cluster != null) clusterFree[spots.cluster] = Math.max(lead.t0 + 6 + stay, gone);
    if (spots.ey) for (const q of spots.ey) eySpotFree[q] = Math.max(lead.t0 + 5 + stay, gone);
    kept++;
  }
  P.nEn = kept;
  return [new Troupe(state.enWomen, { plan: (k) => eps.w[k], legs: (e) => e.it }), new Troupe(state.enMen, { plan: (k) => eps.m[k], legs: (e) => e.it }),
    new Troupe(state.enKids, { plan: (k) => eps.c[k], legs: (e) => e.it })];
}

/** a member's place at a party's spot: [X, Y, facing] — all toward the Sanctuary, or (talking) toward the middle; a
 * party of four or five takes the family places (g4/crowd.js) */
function placeOf(c, j, talk, n = 3) {
  const o = n > 3 ? FAMILY_OFF[j % 5] : MEMBER_OFF[j % 3];
  const X = c[0] + o[0], Y = c[1] + o[1];
  const mid = [c[0] + 0.62, c[1]];
  const face = talk ? norm(Math.atan2(mid[0] - X, mid[1] - Y) * 180 / Math.PI) : 270;
  return [X, Y, face];
}

// ------------------------------------------------------------------------------------------------ along the soreg
// Parties who come up to stand a while by the soreg and watch the courts — the smoke going straight up, the comings
// and goings at the gates, the song (⚙ an ordinary day's visitors, qa-r1 SIM-1): in by the gate before their site with
// the stream, round to it (g4/crowd.js), stepped out to the left of the line; standing, bowing now and then toward the
// Sanctuary, talking a little; then on with the stream to the first exit. A site's back row (nearest the soreg) is taken
// first and left last: the front row leaves WATCH_ROW_GAP before it (more than any wait for the lane), so nobody walks
// through a place someone stands in.
const WATCH_KINDS = [
  [['m'], 0.26], [['m', 'm'], 0.24], [['m', 'm', 'm'], 0.1], [['m', 'w'], 0.14], [['m', 'w', 'c'], 0.12],
  [['m', 'w', 'c', 'c'], 0.06], [['m', 'm', 'm', 'm'], 0.04], [['w', 'w'], 0.04],
];
const WATCH_ROW_GAP = 0.9;
const pickFrom = (list, x) => { for (const [k, w] of list) { x -= w; if (x <= 0) return k; } return list[0][0]; };

function* soregWatchers(state, P, seed, sim, book) {
  const [w0, w1] = P.W.circuit;
  const D = densityOf(sim.ctx);
  const times = arrivals(seed, 'watch', w0 + 5, w1 - 70, (t) => 0.2 * D * rhythm(t, w0, w1), 0.2 * D);
  const pools = { m: state.watchMen.count, w: state.watchWomen.count, c: state.watchKids.count };
  const free = {}, eps = {};
  for (const k in pools) { free[k] = new Array(pools[k]).fill(-1e9); eps[k] = Array.from({ length: pools[k] }, () => []); }
  const siteFree = new Array(SOREG_SITES.length).fill(-1e9);
  let kept = 0;
  const one = (t, i) => {
    const kind = pickFrom(WATCH_KINDS, rand(seed, 'wk', i));
    const stay = 20 + 60 * rand(seed, 'ws', i);
    const order = SOREG_SITES.map((_, q) => q).sort((a, b) => rand(seed, 'wq', i, a) - rand(seed, 'wq', i, b));
    const q = order.find((x) => siteFree[x] < t);
    if (q == null) return;
    const site = SOREG_SITES[q];
    const cls = kind.includes('w') || kind.includes('c') ? 0 : rand(seed, 'wc', i) < 0.5 ? 0 : 1;
    const gate = entryBefore(site.s, 30).id;
    const talk = kind.length > 1 && rand(seed, 'wt', i) < 0.5;
    const members = [];
    let lead = null, D0 = NaN;
    // leaveAbs: the clock minute he leaves his place (NaN: after `stay`)
    const build = (j, leaveAbs, prev, t0) => (mp) => {
      const it = new Itin();
      it.mp = mp;
      const leaveAt = Number.isFinite(leaveAbs) ? leaveAbs - (mp ? mp.t0 : t0) : NaN;
      const pl = site.places[j];
      const face = site.face + (talk ? 0 : (rand(seed, 'wf', i, j) - 0.5) * 20);
      const man = kind[j] !== 'w';
      visitStops(it, {
        gate, cls, prev,
        stops: [{ s: ((site.s + pl[3]) % LOOP_L + LOOP_L) % LOOP_L, at: [pl[0], pl[1], 0], heading: face, min: stay, leaveAt, mark: true,
          act: (it2, min) => (talk ? talkAt(it2, min, face, seed, 'wa', i * 7 + j) : prayAt(it2, min, face, seed, 'wa', i * 7 + j, i, man)) }],
      });
      return it.done();
    };
    for (let j = 0; j < kind.length; j++) {
      if (j === 0) {
        lead = buildFrom(book, WHO, t, build(0, NaN, null, t), 2);
        D0 = lead.t0 + lead.it.markOut;
        members.push({ pool: kind[0], t0: lead.t0, T: lead.it.T, it: lead.it });
      } else {
        const t0 = memberStart(members[j - 1], j, lead.t0, gate, cls);
        // back row (places 0, 1): the leader's minute, the second just after; front row (2, 3): a row-gap earlier
        const Dj = j < 2 ? D0 + 0.04 * j : D0 - WATCH_ROW_GAP + 0.04 * (j - 2);
        const r = buildFrom(book, WHO, t0, build(j, Dj, members[j - 1].it.cols, t0), 1);
        members.push({ pool: kind[j], t0: r.t0, T: r.it.T, it: r.it });
      }
    }
    if (!seat(free, eps, members)) { for (const m of members) release(m.it.mp); return; }
    siteFree[q] = D0 + 1;
    kept++;
  };
  // (the plan job slices it: a yield every second arrival — qa-r2 SIM-R2-12; gate-sim-data: every eighth made 70 ms slices)
  for (let i = 0; i < times.length; i++) { one(times[i], i); if ((i & 1) === 1) yield; }
  P.nWatch = kept;
  return [new Troupe(state.watchMen, { plan: (k) => eps.m[k], legs: (e) => e.it }), new Troupe(state.watchWomen, { plan: (k) => eps.w[k], legs: (e) => e.it }),
    new Troupe(state.watchKids, { plan: (k) => eps.c[k], legs: (e) => e.it })];
}

// ------------------------------------------------------------------------------------------------ by the royal stoa
// Gatherings on the plaza before the royal stoa (g4/crowd.js STOA_SPOTS; ⚙ an ordinary day's visitors, qa-r1 SIM-1): men
// talking, a teacher with his students round him (Sanhedrin 11b), a family resting. Up the western Chuldah passage by
// its middle, round its stair's parapet to the right along the stoa, and out by the left down the eastern passage's
// middle (Middot 2:2). Where they cross the circuit's way north from the western stair they keep out of the booked
// walkers' way (a moment later); in a party the first takes the place farthest from the way in and leaves last.
const STOA_KINDS = [['talk', 0.45], ['teach', 0.25], ['family', 0.3]];
const STOA_V = 1.1;               // m/s: the slow lane's pace ⚙
function stoaGatherings(state, P, seed, sim, book) {
  const [w0, w1] = P.W.circuit;
  const D = densityOf(sim.ctx);
  const times = arrivals(seed, 'stoa', w0 + 10, w1 - 90, (t) => 0.1 * D * rhythm(t, w0, w1), 0.1 * D);
  const pools = { m: state.stoaMen.count, w: state.stoaWomen.count, c: state.stoaKids.count, e: state.stoaElders.count };
  const free = {}, eps = {};
  for (const k in pools) { free[k] = new Array(pools[k]).fill(-1e9); eps[k] = Array.from({ length: pools[k] }, () => []); }
  const spotFree = new Array(STOA_SPOTS.length).fill(-1e9);
  // the crossing: the circuit's walkers come up the western stair and go north on its in-route; ours cross it at Y 75
  const cw = GATES.cw.inRoute, crossS = cw.at(2) + 3.25 * AMAH;
  const crossMin = (new Route(STOA_IN.slice(0, 4)).length + 1.0 * AMAH) / STOA_V / 60;
  const busy = (tc) => [0, 1, 2].some((c) => book.res.get(`gate:cw:${c}`)?.conflict(crossS, tc - 0.015, tc + 0.015));
  let kept = 0, lastIn = -1e9;
  times.forEach((t0, i) => {
    const kind = pickFrom(STOA_KINDS, rand(seed, 'sk', i));
    const q = STOA_SPOTS.map((_, k) => k).sort((a, b) => rand(seed, 'sq', i, a) - rand(seed, 'sq', i, b)).find((k) => spotFree[k] < t0);
    if (q == null) return;
    const [sx, sy] = STOA_SPOTS[q];
    let roles, places;
    if (kind === 'teach') {
      // the teacher with his back to the stoa, his students in an arc before him, turned to him ⚙
      const n = 3 + Math.floor(rand(seed, 'sn', i) * 4);
      const T = [sx, sy - 1.0];
      roles = ['e', ...Array(n).fill('m')];
      places = [[T[0], T[1], 0]];
      for (let j = 0; j < n; j++) {
        const b = (-55 + (110 * j) / Math.max(1, n - 1) + (rand(seed, 'sb', i, j) - 0.5) * 8) * DEG, r = 2.4 + (rand(seed, 'sr', i, j) - 0.5) * 0.4;
        const X = T[0] + Math.sin(b) * r, Y = T[1] + Math.cos(b) * r;
        places.push([X, Y, norm(Math.atan2(T[0] - X, T[1] - Y) / DEG)]);
      }
    } else {
      const n = kind === 'family' ? 3 + (rand(seed, 'sf', i) < 0.45 ? 1 : 0) : 2 + Math.floor(rand(seed, 'sn', i) * 4);
      roles = kind === 'family' ? ['m', 'w', ...Array(n - 2).fill('c')] : Array.from({ length: n }, (_, j) => (j === n - 1 && rand(seed, 'sw', i) < 0.15 ? 'w' : 'm'));
      const r = n <= 2 ? 0.75 : 1.45, a0 = rand(seed, 'sa', i) * 360;
      places = roles.map((_, j) => {
        const a = (a0 + (360 * j) / n) * DEG;
        const X = sx + Math.sin(a) * r, Y = sy + Math.cos(a) * r;
        return [X, Y, norm(Math.atan2(sx - X, sy - Y) / DEG)];
      });
    }
    // the first takes the place farthest from the way in (the stoa's side), the rest nearer; they leave the other way
    const ord = places.map((_, j) => j).sort((a, b) => places[a][1] - places[b][1]);
    roles = ord.map((j) => roles[j]); places = ord.map((j) => places[j]);
    const stay = 30 + 90 * rand(seed, 'ss', i);
    // in single file behind the party before (the passage's middle) and clear of the crossing
    let t = Math.max(t0, lastIn + 0.06);
    for (let k = 0; k < 40 && roles.some((_, j) => busy(t + FILE * j + crossMin)); k++) t += 0.03;
    const members = [];
    let D0 = NaN;
    for (let j = 0; j < roles.length; j++) {
      const tj = t + FILE * j, p = places[j];
      const at = [p[0], p[1], 0];
      const it = new Itin();
      it.walkTo([...STOA_IN, [sx - 3, STOA_LANE.in, 0], at], STOA_V);
      const min = j === 0 ? stay : Math.max(2, D0 - 0.06 * j - (tj + it.T));
      const tag = `st${kind[0]}`;
      if (roles[j] === 'e' || (kind === 'talk' && rand(seed, 'st', i, j) < 0.7)) talkAt(it, min, p[2], seed, tag, i * 9 + j);
      else prayAt(it, min, p[2], seed, tag, i * 9 + j, i, roles[j] !== 'w');
      if (j === 0) D0 = tj + it.T;
      it.walkTo([at, [sx + 3, STOA_LANE.out, 0], ...STOA_OUT], STOA_V);
      it.done();
      members.push({ pool: roles[j], t0: tj, T: it.T, it });
    }
    if (!seat(free, eps, members)) return;
    lastIn = t + FILE * roles.length;
    spotFree[q] = D0 + 1;
    // the passages' middle lines, shared with the plaza's walkers (plazaWalkers): when each starts up the western one and
    // reaches the foot of the eastern one
    for (const m of members) { P.midIn.push(m.t0); P.midOut.push(m.t0 + m.T); }
    kept++;
  });
  P.nStoa = kept;
  return [new Troupe(state.stoaMen, { plan: (k) => eps.m[k], legs: (e) => e.it }), new Troupe(state.stoaWomen, { plan: (k) => eps.w[k], legs: (e) => e.it }),
    new Troupe(state.stoaKids, { plan: (k) => eps.c[k], legs: (e) => e.it }), new Troupe(state.stoaElders, { plan: (k) => eps.e[k], legs: (e) => e.it })];
}

// ------------------------------------------------------------------------------------------------ across the Mount
// People crossing the open Mount south of the courts (qa-r2 SIM-R2-7: the ~240 m plaza between the Chuldah stairs and the
// soreg stood empty by day; the stream crosses it only on two straight lines from the stairs to the circuit). A party
// comes up the western passage by its middle (like the stoa's gatherings), goes right across the open pavement — "in by
// the right" — to a place on it, stands a while talking or looking toward the Sanctuary, sometimes moves on to a second,
// and leaves down the eastern passage's middle — "out by the left" (Middot 2:2) ⚙ who, how many, where they stand. They
// keep south of the circuit's lanes (no station passed: they do not go round), clear of each other (sampled), cross the
// stream's way up from the western stair only when it is clear (its passage booking, as the stoa's gatherings), and keep
// the passages' middle lines in file with the stoa's.
const PLAZA_SPOTS = poissonDisc([186, 96, 324, 212], 13, 0x9a1a).sort((a, b) => a[0] - b[0]);
const PLAZA_KINDS = [[['m'], 0.26], [['m', 'm'], 0.2], [['m', 'w'], 0.16], [['m', 'w', 'c'], 0.1], [['w', 'w'], 0.1], [['m', 'm', 'm'], 0.1], [['w', 'c'], 0.08]];
const PLAZA_IN = [...chuldahLine(165), [166, 75, 0], [176, 78.5, 0]];
const PLAZA_OUT = [[326, 79, 0], [335, 77, 0], ...chuldahLine(335, false)];
const PLAZA_SANCT = [130, 330];                 // toward the Sanctuary's front ⚙
const PLAZA_LEAVE = 0.045;                      // minutes between members setting off from a place (≈ 3 m at their pace)
const PLAZA_R = 1.2 / AMAH, PLAZA_DT = 0.065, PLAZA_CELL = 10;   // 1.2 m apart at least (closest approach between samples 4 s apart); hash cells (amot)

function* plazaWalkers(state, P, seed, sim, book) {
  const [w0, w1] = P.W.circuit;
  const D = densityOf(sim.ctx);
  // ⚙ the rate: about 6 on the plaza at a time on low, 15–20 on high, besides the stream's own
  const times = arrivals(seed, 'plaza', w0 + 4, w1 - 25, (t) => 1.1 * D * rhythm(t, w0, w1), 1.1 * D);
  const pools = { m: state.plazaMen.count, w: state.plazaWomen.count, c: state.plazaKids.count };
  const free = {}, eps = {};
  for (const k in pools) { free[k] = new Array(pools[k]).fill(-1e9); eps[k] = Array.from({ length: pools[k] }, () => []); }
  const spotFree = new Array(PLAZA_SPOTS.length).fill(-1e9);
  const cw = GATES.cw.inRoute, crossS = cw.at(2) + 3.25 * AMAH;
  const crossMin = (new Route(PLAZA_IN.slice(0, 4)).length + 1.0 * AMAH) / STOA_V / 60;
  const busy = (tc) => [0, 1, 2].some((c) => book.res.get(`gate:cw:${c}`)?.conflict(crossS, tc - 0.015, tc + 0.015));
  const near = (list, x, gap) => list.some((y) => Math.abs(y - x) < gap);
  // who is where on the plaza: a hash of (time bucket, cell) → [X, Y, vx, vy, party]; each party's itineraries are built once
  // (they do not depend on its start) and sampled over their part on the plaza only; a start that clashes is tried later
  const grid = new Map();
  // (keys small integers: cells of 10 amot over the Mount, 64 a side, offset by one for the neighbours)
  const cell = (X) => Math.max(0, Math.min(62, Math.floor(X / PLAZA_CELL) + 1));
  const key = (b, cx, cy) => (b << 12) | (cx << 6) | cy;
  const inMin = new Route(PLAZA_IN).length / STOA_V / 60, outMin = new Route(PLAZA_OUT.slice(1)).length / STOA_V / 60;
  const q = {};
  // samples [u, X, Y, vx, vy] (minutes from the member's start; amot; amot/minute) over his part on the plaza
  const relSamples = (it) => {
    const out = [], u0 = Math.max(0, inMin - 0.15), u1 = it.T - outMin + 0.1;
    let px = NaN, py = NaN;
    for (let u = u0; u <= u1; u += PLAZA_DT) {
      it.sample(u, q);
      out.push(u, q.X, q.Y, 0, 0);
      if (Number.isFinite(px)) { const k = out.length - 5; out[k - 2] = out[k + 3] = (q.X - px) / PLAZA_DT; out[k - 1] = out[k + 4] = (q.Y - py) / PLAZA_DT; }
      px = q.X; py = q.Y;
    }
    return out;
  };
  // the two closest within half a sample of each other's sample time (straight motion between samples)
  const closest = (dx, dy, dvx, dvy) => {
    const vv = dvx * dvx + dvy * dvy;
    const tau = vv > 1e-9 ? Math.max(-PLAZA_DT / 2, Math.min(PLAZA_DT / 2, -(dx * dvx + dy * dvy) / vv)) : 0;
    return Math.hypot(dx + dvx * tau, dy + dvy * tau);
  };
  const clash = (R, t0, id) => {
    for (let k = 0; k < R.length; k += 5) {
      const b = Math.round((t0 + R[k]) / PLAZA_DT), X = R[k + 1], Y = R[k + 2], cx = cell(X), cy = cell(Y);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const l = grid.get(key(b, cx + dx, cy + dy));
        if (l) for (let m = 0; m < l.length; m += 5) if (l[m + 4] !== id && closest(X - l[m], Y - l[m + 1], R[k + 3] - l[m + 2], R[k + 4] - l[m + 3]) < PLAZA_R) return true;
      }
    }
    return false;
  };
  const enter = (R, t0, id) => {
    for (let k = 0; k < R.length; k += 5) {
      const kk = key(Math.round((t0 + R[k]) / PLAZA_DT), cell(R[k + 1]), cell(R[k + 2]));
      let l = grid.get(kk);
      if (!l) grid.set(kk, (l = []));
      l.push(R[k + 1], R[k + 2], R[k + 3], R[k + 4], id);
    }
  };
  let kept = 0;
  const one = (tA, i) => {
    const kind = pickFrom(PLAZA_KINDS, rand(seed, 'pk', i));
    const order = PLAZA_SPOTS.map((_, k) => k).sort((a, b) => rand(seed, 'pq', i, a) - rand(seed, 'pq', i, b));
    const qa = order.find((k) => spotFree[k] < tA + 2);
    if (qa == null) return;
    // now and then on to a second place further east (the way out lies east) ⚙
    const qb = rand(seed, 'p2', i) < 0.3 ? order.find((k) => k !== qa && spotFree[k] < tA + 6 && PLAZA_SPOTS[k][0] > PLAZA_SPOTS[qa][0] + 8) : undefined;
    const stops = qb != null ? [qa, qb] : [qa];
    const n = kind.length;
    const talk = n > 1 && rand(seed, 'pt', i) < 0.55;
    const stay = stops.map((_, k) => 1.2 + 3.2 * rand(seed, 'ps', i, k));
    // a member's place round a spot and his facing: to the others while they talk, else toward the Sanctuary
    const placeAt = (sq, j) => {
      const [sx, sy] = PLAZA_SPOTS[sq];
      const a = (rand(seed, 'pa', i, sq) * 360 + (360 * j) / n) * DEG, r = n === 1 ? 0 : n === 2 ? 0.75 : 1.2;
      const X = sx + Math.sin(a) * r, Y = sy + Math.cos(a) * r;
      const face = talk ? norm(Math.atan2(sx - X, sy - Y) / DEG) : norm(Math.atan2(PLAZA_SANCT[0] - X, PLAZA_SANCT[1] - Y) / DEG);
      return [X, Y, face];
    };
    // the members' itineraries (from their own start) and their samples on the plaza
    const its = kind.map((who, j) => {
      const it = new Itin();
      const p0 = placeAt(stops[0], j);
      it.walkTo([...PLAZA_IN, [p0[0], p0[1], 0]], STOA_V);
      let from = [p0[0], p0[1], 0];
      stops.forEach((sq, k) => {
        const p = placeAt(sq, j);
        if (k > 0) { it.walkTo([from, [p[0], p[1], 0]], STOA_V); from = [p[0], p[1], 0]; }
        // the party moves on in file: each PLAZA_LEAVE after the one before him (they came up FILE apart; from places
        // under a metre apart, leaving together, their ways converged — qa-r2: the g4 sweep)
        const min = Math.max(0.4, stay[k] + (k === 0 ? (PLAZA_LEAVE - FILE) * j : 0));
        if (talk) talkAt(it, min, p[2], seed, `pz${k}`, i * 9 + j); else prayAt(it, min, p[2], seed, `pz${k}`, i * 9 + j, i, who !== 'w');
      });
      it.walkTo([from, ...PLAZA_OUT], STOA_V);
      it.done();
      return it;
    });
    const R = its.map(relSamples);
    let t = NaN;
    for (let attempt = 0; attempt < 6; attempt++) {
      const tt = tA + 0.12 * attempt;
      let ok = true;
      for (let j = 0; j < n && ok; j++) {
        const tj = tt + FILE * j;
        // in file up the western passage's middle and down the eastern one with the stoa's people; across the stream's
        // way up from the western stair only when it is clear; clear of everyone else crossing the plaza
        ok = !near(P.midIn, tj, 0.035) && !busy(tj + crossMin) && !near(P.midOut, tj + its[j].T, 0.035) && !clash(R[j], tj, i);
      }
      if (ok) { t = tt; break; }
    }
    if (!Number.isFinite(t)) return;
    const members = its.map((it, j) => ({ pool: kind[j], t0: t + FILE * j, T: it.T, it }));
    if (!seat(free, eps, members)) return;
    members.forEach((m, j) => enter(R[j], m.t0, i));
    for (const m of members) { P.midIn.push(m.t0); P.midOut.push(m.t0 + m.T); }
    const tGone = Math.max(...members.map((m) => m.t0 + m.T));
    for (const sq of stops) spotFree[sq] = tGone;
    kept++;
  };
  // (the plan job slices it: a yield every second arrival — qa-r2 SIM-R2-12; gate-sim-data: every eighth made 70 ms slices)
  for (let i = 0; i < times.length; i++) { one(times[i], i); if ((i & 1) === 1) yield; }
  P.nPlaza = kept;
  return [new Troupe(state.plazaMen, { plan: (k) => eps.m[k], legs: (e) => e.it }), new Troupe(state.plazaWomen, { plan: (k) => eps.w[k], legs: (e) => e.it }),
    new Troupe(state.plazaKids, { plan: (k) => eps.c[k], legs: (e) => e.it })];
}

// ------------------------------------------------------------------------------------------------ the owners' ways
// The owners of private offerings (private-offerings, G5) appear at the foot of the Korban gate's flight (the firstling's
// bringer at the Bechorot gate's, the bringers of birds, meal-offerings and bikkurim at the foot of the chel steps) with
// the animal on its rope or what they bring in their hands, and are gone from there when it is done. These are their
// walks: up from the city by the gate before that place, round to it with the stream, and home from it with the stream
// to the first exit (Middot 2:2), prostrating opposite the breaches like everyone (Middot 2:3), the animal on its rope
// behind. They are G5's own figures: these pools mirror its pools' roles and seeds, and G5 keeps a figure free for its
// walks (g5/plan.js WAY_RES), so the man who leads the lamb up the Mount is the man who leans on it ⚙ (qa-r1 SIM-1).
// Planned first of courts-daily's walkers: their minutes are fixed by the offerings; the stream plans round them.
const WAY_SPUR = { KOR_FOOT: 'korban', BECH_FOOT: 'bechorot', CHEL_FOOT: 'chel' };
const WAY_LAG = 1.0;                // m: G5's rope (g5/plan.js scriptAnimal: follow at 1.0)
const STILL_OF = { lead_walk: 'lead', carry_walk: 'carry', carry_shoulder_walk: 'carry_shoulder', walk: 'stand' };

/** an itinerary whose mark falls on clock minute `target` within half a second (g4 fitAt, tighter); `probe` = the
 * unbooked build's mark when known (the same for every walk of one kind) */
function fitTight(book, target, build, probe = NaN) {
  let t0 = target - (Number.isFinite(probe) ? probe : build(null).mark), it = null;
  for (let k = 0; k < 4; k++) {
    const mp = mpOf(book, t0, WHO);
    it = build(mp);
    const err = t0 + it.mark - target;
    if (Math.abs(err) < 0.006 || k === 3) break;
    release(mp);
    t0 -= err;
  }
  return { it, t0 };
}

function* g5Ways(state, P, seed, sim, book) {
  const P5 = sim.planOf?.('private-offerings');
  const eps = {};
  for (const name of WAY_POOLS) { eps[name] = Array.from({ length: state.ways[name].count }, () => []); }
  P.ways = { in: 0, out: 0, skipped: 0 };
  const probes = new Map();     // the unbooked walk's length by kind (gate, spur, pose, rope)
  if (P5?.ok) {
    let nInst = 0;
    for (const inst of P5.insts) {
      if ((++nInst & 1) === 0) yield;    // (the plan job slices it — qa-r2 SIM-R2-12, gate-sim-data)
      const owner = inst.tracks.find((tr) => tr.role === 'O' && tr.pool === 'israelite' && tr.slot >= 0);
      if (!owner) continue;
      const w = wayEnds(P5, owner);
      const animal = inst.tracks.find((tr) => ANIMALS.has(tr.pool) && tr.slot >= 0 && wayEnds(P5, tr).a);
      // ---- up from the city to the foot where G5 takes him on
      if (w.a) {
        const g = owner.segs.find((x) => x.kind === WALK) || owner.segs[0];
        const spur = WAY_SPUR[w.a], gate = bestEntry(spur);
        const pose = g.pose || 'walk', prop = g.prop ?? null, hand = g.hand || 'right';
        const build = (mp) => {
          const it = new Itin();
          it.mp = mp;
          arrive(it, { gate, spur, cls: 0, pose, prop, hand, lags: animal ? [WAY_LAG] : null });
          it.mark = it.T;
          return it.done();
        };
        const key = `${gate}|${spur}|${pose}|${animal ? 1 : 0}`;
        if (!probes.has(key)) probes.set(key, build(null).mark);
        const r = fitTight(book, owner.t0, build, probes.get(key));
        if (r.t0 >= owner.t0 - WAY_RES.pre) {
          // there exactly as G5 takes him on (a moment's stand at the foot if early)
          const early = owner.t0 - (r.t0 + r.it.T);
          if (early > 1e-3) { r.it.stand(early, r.it.end.heading, { pose: STILL_OF[pose] || 'stand', prop, hand }); r.it.done(); }
          eps.israelite[owner.slot].push({ t0: r.t0, T: owner.t0 - r.t0, it: r.it });
          if (animal) {
            const L = state.ways.israelite.slot(owner.slot);
            eps[animal.pool][animal.slot].push({ t0: r.t0, T: owner.t0 - r.t0, it: new Follower(r.it, WAY_LAG), leader: () => L.actor || null });
          }
          P.ways.in++;
        } else { release(r.it.mp); P.ways.skipped++; }
      }
      // ---- home from the foot where G5 leaves him, with the stream to the first exit
      if (w.b) {
        const g = [...owner.segs].reverse().find((x) => x.kind === WALK) || owner.segs[owner.segs.length - 1];
        const spur = WAY_SPUR[w.b], S = SPURS[spur];
        const pose = g.pose || 'walk', prop = g.prop ?? null, hand = g.hand || 'right';
        const h0 = norm(Math.atan2(S.out[1][0] - S.out[0][0], S.out[1][1] - S.out[0][1]) / DEG);
        const build = (pre) => {
          const it = new Itin();
          it.mp = mpOf(book, owner.t1, WHO);
          // the way down not clear: he stands a moment where G5 left him rather than in its way below
          if (pre > 0) it.stand(pre, h0, { pose: STILL_OF[pose] || 'stand', prop, hand, at: S.out[0] });
          leave(it, { spur, cls: 0, pose, prop, hand, flex: true });
          return it.done();
        };
        let pre = 0, it = build(0);
        for (let k = 0; k < 2 && it.leaveWait > 0; k++) { release(it.mp); pre += it.leaveWait; it = build(pre); }
        if (it.T <= WAY_RES.post) { eps.israelite[owner.slot].push({ t0: owner.t1, T: it.T, it }); P.ways.out++; } else { release(it.mp); P.ways.skipped++; }
      }
    }
  }
  const leadCb = (k, slot, s, e) => { const L = e.leader?.() || null; if (slot._lead !== L) { slot._lead = L; slot.actor?.setLead?.(L); } };
  return WAY_POOLS.map((name) => Object.assign(new Troupe(state.ways[name], { plan: (k) => eps[name][k], legs: (e) => e.it }), ANIMALS.has(name) ? { cb: leadCb } : {}));
}

function enItin(e, seed, mp, prev) {
  const { v, stay, k, i, tag } = e;
  const it = new Itin();
  it.mp = mp;
  const extra = e.extra || 0;     // minutes more up there: the way down was not clear (g4/mount.js leave, flex)
  return visit(it, {
    gate: 'ce', spur: 'en', cls: e.cls, prev, flex: true,
    build: (it) => {
      const sp = e.spot;
      const face = sp[2] + (e.talk ? 0 : (rand(seed, 'f', tag, k) - 0.5) * 16);
      if (e.men && e.inEY) {
        // up the fifteen steps and through Nikanor into Ezrat Yisrael (south lane up, north lane down) ⚙; inside, along
        // an aisle by the court's east wall and then along his own row, never past another man's place (qa-r1 SIM-4)
        const [inW, outW] = eyWay(sp);
        const up = [EN_IN, [277.75, 330.0, 6], [270.25, 330.0, 13.5], [261, 330.0, 13.5], [255.3, 330.0, 13.5], [EY_AISLE[0], 329.6, 13.5], ...inW];
        const down = [...outW, [EY_AISLE[1], 331.2, 13.5], [255.3, 331.0, 13.5], [261, 331.0, 13.5], [270.25, 331.0, 13.5], [277.75, 331.0, 6], EN_OUT];
        const t0 = it.T;
        it.walkTo(up, v);
        const tw = (it.T - t0) * 2;
        prayAt(it, Math.max(3, stay - tw) + extra, 270 + (rand(seed, 'fm', tag, k) - 0.5) * 16, seed, tag, k, i, true);
        it.markLeave = it.T;
        it.walkTo(down, v);
        return;
      }
      const a = [sp[0], sp[1], 6], b = e.chashaim ? CHASHAIM : e.shofar ? e.shofar.stand : a;
      // a spot in the open bands: by the aisles (g4/crowd.js), clear of the original spots' parties
      const [wIn, wOut] = e.band ? enBandWay(e.band, a, EN_IN, EN_OUT)
        : [[EN_IN, [a[0] + 4, a[1] + (a[1] < 330.5 ? 2 : -2), 6], a], [a, [a[0] + 4, a[1] + (a[1] < 330.5 ? 1 : -1), 6], EN_OUT]];
      const dIn = Math.hypot(a[0] - EN_IN[0], a[1] - EN_IN[1]), dAB = Math.hypot(b[0] - a[0], b[1] - a[1]) * 2, dOut = Math.hypot(EN_OUT[0] - a[0], EN_OUT[1] - a[1]);
      const walkMin = ((dIn + dAB + dOut) * AMAH) / v / 60;
      it.walkTo(wIn, v);
      // a band party's members after the first leave at their set minutes, the last come first
      const still = (Number.isFinite(e.leaveAbs) && it.mp ? Math.max(0.5, e.leaveAbs - (it.mp.t0 + it.T)) : Math.max(4, stay - walkMin)) + extra;
      if (e.talk) talkAt(it, still, face, seed, tag, k);
      // a child stands by his parents (no lifted hands; a bow now and then with them)
      else prayAt(it, still * (e.chashaim || e.shofar ? 0.9 : 1), face, seed, tag, k, i, e.men || e.child);
      if (e.shofar) {
        // the coins into the chest's narrow horn (Shekalim 6:5; people's coins in his fist, poured in at its mouth)
        it.walkTo([a, b], v);
        it.stand(0.08, e.shofar.face, { pose: 'stand', prop: 'coins' });
        it.stand(0.14, e.shofar.face, { pose: 'pour', phase: (q) => q, prop: 'coins' });
        it.stand(Math.max(0.05, still * 0.1 - 0.22), e.shofar.face, { pose: 'stand' });
        it.walkTo([b, a], v);
      }
      if (e.chashaim) {
        // a gift left in secret at Lishkat Chasha'im (Shekalim 5:6), on the way out
        it.walkTo([a, b], v);
        it.stand(still * 0.1, 0, { pose: 'point' });
        it.walkTo([b, a], v);
      }
      it.markLeave = it.T;
      it.walkTo(wOut, v);
    },
  }).done();
}

/** standing together and talking: turned to one another, now and then a gesture ⚙ */
function talkAt(it, min, face, seed, tag, k) {
  let left = min, n = 0;
  while (left > 0.05 && n < 400) {
    const r = rand(seed, 'tk', tag, k * 31 + n);
    const d = Math.min(left, 0.6 + 2.5 * rand(seed, 'td', tag, k * 31 + n));
    it.stand(d, face + (rand(seed, 'th', tag, k * 31 + n) - 0.5) * 24, { pose: r < 0.2 ? 'point' : r < 0.3 ? 'raise_hands_low' : 'stand', turn: true });
    left -= d; n++;
  }
}

/** standing in prayer facing the Sanctuary: still, with a bow now and then and hands lifted a while (seeded) ⚙ */
function prayAt(it, min, face, seed, tag, k, i, man) {
  let left = min, n = 0;
  while (left > 0.05 && n < 12) {
    const r = rand(seed, 'pr', tag, k * 97 + i * 13 + n);
    const d = Math.min(left, 1.2 + 4.5 * rand(seed, 'pd', tag, k * 97 + i * 13 + n));
    if (r < 0.18 && d > 0.3) {
      it.stand(0.22, face, { pose: 'bow', phase: (q) => q, turn: n === 0 });
      it.stand(Math.max(0.05, d - 0.22), face, { turn: false });
    } else if (r < 0.32 && !man) it.stand(d, face, { pose: 'raise_hands_low', turn: n === 0 });
    else it.stand(d, face, { turn: n === 0 });
    left -= d + (r < 0.18 && d > 0.3 ? 0 : 0);
    n++;
  }
  if (left > 0.05) it.stand(left, face, { turn: false });
}

// ------------------------------------------------------------------------------------------------ the meal
function meal(state, P, seed, sim) {
  const out = [];
  const isFri = P.dayType === 'friday';
  const legsOf = (e) => e.it;
  // the meal places: each kohen faces his group's middle
  const places = (groups) => {
    const r = [];
    for (const g of groups) for (let i = 0; i < g.n; i++) {
      const a = (i / g.n) * 2 * Math.PI + g.c[1] * 0.37;
      const X = g.c[0] + Math.cos(a) * 1.35, Y = g.c[1] + Math.sin(a) * 1.35 * 1.1;
      r.push({ at: [X, Y, 16], c: g.c, face: norm(Math.atan2(g.c[0] - X, g.c[1] - Y) * 180 / Math.PI) });
    }
    return r;
  };
  const dayP = places(GROUPS_DAY), nightP = places(GROUPS_NIGHT);
  // the three places before the cook, a pace apart, one kohan at a time at each
  const serveBook = [[], [], []];
  const serveFree = (q, a, b) => !serveBook[q].some(([x, y]) => a < y && b > x);
  const eatFor = (it, min, pl, k, tag, t0abs = -1e9, serveUntil = 1e9) => {
    // eating: the bowl held up, a pause, again; now and then to the cook for more while he is there ⚙ ('eat' gesture
    // requested)
    let left = min, n = 0;
    while (left > 0.05 && n < 1500) {
      const r = rand(seed, 'ea', tag, k * 131 + n);
      const q = k % 3;
      // only those standing on the cook's side of their group go to him (the others would walk through their fellows)
      const toCook = (pl.at[0] - pl.c[0]) * (SERVE[0] - pl.c[0]) + (pl.at[1] - pl.c[1]) * (SERVE[1] - pl.c[1]) > 0.3;
      if (toCook && r < 0.12 && left > 3 && t0abs + it.T < serveUntil - 2 && serveFree(q, t0abs + it.T, t0abs + it.T + 1.2)) {
        serveBook[q].push([t0abs + it.T, t0abs + it.T + 1.2]);
        const t0 = it.T;
        const sv = [SERVE[0] + (q - 1) * 1.3, SERVE[1] + 0.25, 16];
        it.walkTo([pl.at, sv], 1.0, { prop: 'bowl' });
        it.stand(0.35, 195, { pose: 'carry', prop: 'bowl' });
        it.walkTo([sv, pl.at], 1.0, { prop: 'bowl' });
        left -= it.T - t0;
      } else {
        const d = Math.min(left, 0.8 + 2.8 * rand(seed, 'ed', tag, k * 131 + n));
        it.stand(d, pl.face + (rand(seed, 'eh', tag, k * 7 + n) - 0.5) * 30, { pose: r < 0.7 ? 'carry' : 'stand', prop: 'bowl', at: pl.at, turn: true });
        left -= d;
      }
      n++;
    }
  };
  // by day: in from Pinchas' chamber over the duchan, eat, and out the same way
  if (P.W.meal) {
    const [w0, w1] = P.W.meal;
    const nDay = tierCount(sim, dayP.length, 4, 0.6);
    const planDay = (k) => {
      if (k >= nDay) return [];
      const pl = dayP[k];
      const arrive = w0 + 0.4 + k * 0.55 + rand(seed, 'da', k) * 3, leave = w1 - 0.2 - rand(seed, 'dl', k) * 4;
      const it = new Itin();
      it.walkTo([...PINCHAS_WAY, pl.at], 1.2, { prop: null });
      const mark = it.T;
      eatFor(it, Math.max(2, leave - arrive), pl, k, 'd', arrive - mark, w1 - 8);
      it.walkTo([pl.at, ...[...PINCHAS_WAY].reverse()], 1.2);
      it.done();
      return [{ t0: arrive - mark, T: it.T, it }];
    };
    out.push(Object.assign(new Troupe(state.meal, { plan: planDay, legs: legsOf }), { tag: 'day' }));
  }
  // the cook leaves the evening's hearth before Shabbat on Friday, else when the scouring begins
  const cookEndNight = !P.W.night ? 0 : isFri && Number.isFinite(P.sunset) ? P.sunset - 3 : (P.W.scour ? P.W.scour[0] - 2 : P.W.night[1] - 30);
  // the evening: in from Pinchas' chamber before the locking, then home to Beit HaMoked by its wicket, thinning out ⚙.
  // On weekdays the last three stay on to scour the pots before midnight (Zevachim 11:7).
  const nightTr = [];
  if (P.W.night) {
    const [w0, w1] = P.W.night;
    const nN = tierCount(sim, nightP.length, 4, 0.6);
    const sc = P.W.scour;
    if (sc) { P.breakAt = sc[0] + (sc[1] - sc[0]) * 0.38; P.keyBreak = `break:${Math.round(P.breakAt * 10)}`; }
    const planNight = (k) => {
      if (k >= nN) return [];
      const pl = nightP[k];
      const arrive = w0 + 0.5 + k * 0.6 + rand(seed, 'na', k) * 6;
      const scourer = sc && k < 3;
      // the others leave between about two hours after nightfall and midnight; the last ones stay to the end
      const late = k < 3 ? 1 : rand(seed, 'nl', k);
      const leave = scourer ? sc[0] + 0.3 * k : Math.min(w1 - 0.5 - 0.4 * k, w1 - 260 * (1 - late));
      const it = new Itin();
      it.walkTo([...PINCHAS_WAY, pl.at], 1.2);
      const mark = it.T;
      eatFor(it, Math.max(2, leave - arrive), pl, k, 'n', arrive - mark, cookEndNight);
      let from = pl.at;
      if (scourer) { scourAt(it, k, pl.at, sc, P, arrive - mark, seed); from = SCOUR[k].at; }
      const tOut = it.T;
      it.walkTo([from, [240.3, 300 + k, 16], ...MOKED_WAY], 1.15);
      it.done();
      const e = { t0: arrive - mark, T: it.T, it };
      P.pishPass.push(e.t0 + tOut + passTime(it, tOut));
      return [e];
    };
    nightTr.push(Object.assign(new Troupe(state.meal, { plan: planNight, legs: legsOf }), { tag: 'night' }));
  }
  // the day and night meals share the meal pool: one Troupe per window, the other's slots idle meanwhile
  if (nightTr.length && out.length) {
    const day = out[0], night = nightTr[0];
    const both = new Troupe(state.meal, {
      plan: (k) => [...day.planFn(k), ...night.planFn(k)],
      legs: legsOf,
    });
    out.length = 0;
    out.push(both);
  } else out.push(...nightTr);
  // the cook at the hearth, for both meals
  const cookEps = [];
  const cookIt = (a, b, night) => {
    const it = new Itin();
    it.walkTo([...PINCHAS_WAY, [239.6, 300.5, 16], [234.6, 298.4, 16], COOK], 1.2);
    const mark = it.T;
    let left = b - a, n = 0;
    while (left > 0.05 && n < 1500) {
      const d = Math.min(left, 1.5 + 3 * rand(seed, 'ck', night ? 1 : 0, n));
      const r = rand(seed, 'cp', night ? 1 : 0, n);
      it.stand(d, 90 + (r - 0.5) * 20, { pose: r < 0.55 ? 'stoke' : r < 0.8 ? 'stand' : 'pour', prop: r < 0.55 ? 'fork' : r < 0.8 ? null : 'bowl', at: COOK, turn: n === 0 });
      left -= d; n++;
    }
    const tOut = it.T;
    it.walkTo([COOK, [234.6, 298.4, 16], [239.6, 300.5, 16], ...(night ? MOKED_WAY.slice(0) : [...PINCHAS_WAY].reverse())], 1.2);
    it.done();
    const e = { t0: a - mark, T: it.T, it };
    if (night) P.pishPass.push(e.t0 + tOut + passTime(it, tOut));
    return e;
  };
  if (P.W.meal) cookEps.push(cookIt(P.W.meal[0] - 22, P.W.meal[1] - 8, false));
  if (P.W.night) {
    cookEps.push(cookIt(P.W.night[0] - 4, Math.max(P.W.night[0] + 10, cookEndNight), true));
  }
  out.push(new Troupe(state.cook, { plan: () => cookEps, legs: legsOf }));
  return out;
}

/**
 * The scouring (Zevachim 11:7), by the last three at the meal, at the copper basin south of the hearth, until the
 * window's end: k 0 scours the copper pot kneeling at the basin; k 1 pours hot water; k 2 holds the earthenware pot,
 * breaks it (P.breakAt) and sweeps up the sherds. e0 = the itinerary's start on the clock.
 */
function scourAt(it, k, from, sc, P, e0, seed) {
  const S = SCOUR[k];
  it.walkTo([from, S.at], 0.9);
  const end = sc[1] - 1.0 - 0.25 * k;       // clock minute they set off for the Moked
  const dur = Math.max(1, end - (e0 + it.T));
  if (k === 0) {
    it.stand(dur, S.face, { pose: 'kneel', prop: 'bowl', phase: (q, u) => (u < 0.35 ? (u / 0.35) * 0.5 : u > dur - 0.35 ? 0.5 + ((u - dur + 0.35) / 0.35) * 0.5 : 0.5) });
  } else if (k === 1) {
    let left = dur, n = 0;
    while (left > 0.05 && n < 300) { const d = Math.min(left, 1.2 + 2 * rand(seed, "sp", n)); it.stand(d, S.face, { pose: n % 2 ? 'stand' : 'pour', prop: 'wine_jug', turn: n === 0 }); left -= d; n++; }
  } else {
    // the earthenware pot (people's clay_pot, the period's Jerusalem cooking ware) thrown down and broken (Lev 6:21 —
    // in a holy place, Zevachim 11:4), its sherds swept up (clay_pot_broken where it fell, until swept) ⚙ who, how
    const tb = Math.max(0.3, P.breakAt - (e0 + it.T));
    it.stand(Math.max(0.2, tb - 0.25), S.face, { pose: 'carry', prop: 'clay_pot' });
    it.stand(0.25, S.face, { pose: 'toss', phase: (q) => q, prop: 'clay_pot', turn: false });
    const tSweep = it.T;
    it.stand(Math.max(0.2, dur - tb), S.face + 180, { pose: 'sweep', prop: null });
    const a = (S.face * Math.PI) / 180;
    P.sherds = { t0: P.breakAt, t1: e0 + tSweep + Math.max(0.2, dur - tb) * 0.85, at: [S.at[0] + Math.sin(a) * 0.9, S.at[1] + Math.cos(a) * 0.9, 16], h: S.face };
  }
}


/** minutes after tOut at which an itinerary's walk reaches the Moked wicket (Y 391) */
function passTime(it, tOut) {
  const s = {};
  for (let u = tOut; u <= it.T; u += 0.02) { it.sample(u, s); if (s.Y >= 390.9 && Math.abs(s.X - 213.25) < 1.5) return u - tOut; }
  return it.T - tOut;
}

// ------------------------------------------------------------------------------------------------ the kitchen fire
function kitchenFire(state, sim, t, P) {
  const W = P.W;
  let v = 0;
  if (P.dayType !== 'shabbat') {
    if (W.meal && within(t, W.meal[0] - 30, W.meal[1] + 1)) v = smooth(W.meal[0] - 25, W.meal[0] - 22, t) * (0.85 - 0.55 * smooth(W.meal[1] - 30, W.meal[1] - 15, t)) * (1 - smooth(W.meal[1] - 8, W.meal[1], t));
    if (W.night && within(t, W.night[0] - 6, W.night[1] + 1)) {
      const sc = W.scour;
      let n = smooth(W.night[0] - 5, W.night[0] - 2, t) * (0.8 - 0.5 * smooth(W.night[0] + 150, W.night[0] + 170, t));
      if (sc) n = Math.max(n * (1 - smooth(sc[0] - 6, sc[0] - 2, t)), smooth(sc[0] - 6, sc[0] - 2, t) * 0.7 * (1 - smooth(sc[1] - 12, sc[1] - 2, t)));
      else n *= 1 - smooth(W.night[1] - 40, W.night[1] - 20, t);
      // Shabbat comes in at sunset on Friday: the fire is let die before it
      if (P.dayType === 'friday' && Number.isFinite(P.sunset)) n *= 1 - smooth(P.sunset - 12, P.sunset - 3, t);
      v = Math.max(v, n);
    }
  }
  // the hearth is shared with private-offerings (meal-offerings fried, by day): a shared want, the larger wins
  state.kfLevel = v;
  if (v > 0) sim.fireWant(KITCHEN_FIRE, v);
}

// ------------------------------------------------------------------------------------------------ cues
function cues(ctx, state, sim, t, P) {
  state.lastT = t;
  const c = sim.crossing;
  if (!c.ok) return;
  for (const g of P.greets) {
    if (!(g.at > 0)) continue;
    const tc = g.at + 0.06;
    if (!crossed(state, tc)) continue;
    sim.cueAt(g.key, tc, () => {
      if (!observerNear(ctx, g.pos, CAPTION_RANGE)) return;
      sim.sound('footsteps', [g.pos[0], g.pos[1], 3], { steps: 4, pace: 0.7 });
      const text = g.ban
        ? { en: '"Why do you go round to the left?" — "I am under a ban." — "May He who dwells in this House put it in their hearts to bring you near" (R\' Meir; R\' Yosi: "…put it in your heart to listen to your colleagues, and they will bring you near") (Middot 2:2)', he: 'הַשּׁוֹכֵן בַּבַּיִת הַזֶּה יִתֵּן בְּלִבָּם וִיקָרְבוּךָ' }
        : { en: '"Why do you go round to the left?" — "I am a mourner." — "May He who dwells in this House comfort you" (Middot 2:2)', he: 'הַשּׁוֹכֵן בַּבַּיִת הַזֶּה יְנַחֶמְךָ' };
      sim.caption(text, { id: 'entry-circuit', duration: 7 });
    });
  }
  if (P.keyBreak && Number.isFinite(P.breakAt) && crossed(state, P.breakAt)) {
    sim.cueAt(P.keyBreak, P.breakAt, () => {
      // the sound of the pot breaking (audio's 'pot-break', render-audio-3)
      sim.sound('pot-break', P.sherds?.at || [235.9, 293.3, 16]);
      if (observerNear(ctx, [BASIN[0], BASIN[1], 16], CAPTION_RANGE)) {
        sim.caption({ en: 'An earthenware pot in which a sin-offering was cooked is broken (Lev 6:21; Zevachim 11:4); a copper one is scoured with hot water and rinsed with cold (Zevachim 11:7)', he: 'כְּלִי חֶרֶס יִשָּׁבֵר — וְאִם בִּכְלִי נְחֹשֶׁת, וּמֹרַק וְשֻׁטַּף' }, { id: 'scouring', duration: 6 });
      }
    });
  }
}

// ------------------------------------------------------------------------------------------------ the shofarot
/** the thirteen chests in Ezrat Nashim (world-4 anchors courts.en.shofar.1…13: the stand point outside the ring, facing
 *  the chest; Shekalim 6:5 order) — site [X, Y, Z] and heading, cached per world */
let SHOFAROT = null;
function shofarot(ctx) {
  if (SHOFAROT && SHOFAROT.ctx === ctx) return SHOFAROT.list;
  const list = [];
  for (let n = 1; n <= 13; n++) {
    const a = ctx.anchors?.get?.(`courts.en.shofar.${n}`);
    if (!a?.pos) continue;
    const p = w2m(a.pos);
    list.push({ n, stand: [p.X, p.Y, 6], face: a.heading ?? 0 });
  }
  SHOFAROT = { ctx, list };
  return list;
}
// which chests: a woman — the kinnin (3), the gozlei olah (4), the gifts (8–13); a man — the shekels (1, 2), the wood (5),
// the frankincense (6), the gold for the kaporet (7), the gifts (8–13) ⚙ who gave to which
const CHESTS = { w: [3, 4, 8, 9, 10, 11, 12, 13], m: [1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13] };
/** one of the three of a visitor's chests nearest his place (its stand on his side of the ring: a straight way there) */
function chestFor(ctx, who, spot, seed, i) {
  const list = shofarot(ctx).filter((c) => CHESTS[who].includes(c.n));
  if (!list.length) return null;
  list.sort((p, q) => Math.hypot(p.stand[0] - spot[0], p.stand[1] - spot[1]) - Math.hypot(q.stand[0] - spot[0], q.stand[1] - spot[1]));
  return list[Math.min(list.length - 1, Math.floor(rand(seed, 'chest', who, i) * 3))];
}

/** the sherds of the broken pot where it fell, until they are swept up (P.sherds) */
function sherds(ctx, state, P, t) {
  const S = P.sherds;
  const want = !!S && within(t, S.t0, S.t1);
  if (want && state.sherds === undefined) {
    try { state.sherds = ctx.people?.spawnProp?.('clay_pot_broken', { seed: SEED + 77 }) || null; state.sherds?.setVisible(false); } catch { state.sherds = null; }
  }
  if (!state.sherds) return;
  if (want && state.sherdsAt !== S) { state.sherdsAt = S; state.sherds.setSite(S.at[0], S.at[1], S.at[2]); state.sherds.setHeading(S.h); }
  if (want !== state.sherdsOn) { state.sherdsOn = want; state.sherds.setVisible(want); }
}

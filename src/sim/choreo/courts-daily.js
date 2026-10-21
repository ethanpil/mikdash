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
// Determinism: every figure runs episodes planned once per date (g4/lib.js Troupe); its pose is a pure function of
// (t, date, seed). Arrivals and departures are through the Chuldah tunnels and over Kiponus' bridge (the Mount),
// through the door of Pinchas' chamber (the kohanim by day) and Beit HaMoked's wicket (the kohanim at night).
import { clamp, smooth, rand, since, within, wrap } from '../lib/core.js';
import { crossed } from '../lib/cue.js';
import { AMAH, w2m } from '../../core/units.js';
import { Itin, Troupe, Route, daySeed, tierCount, win, hm, observerNear, norm, arrivals } from './g4/lib.js';
import { LOOP, GATES, BREACHES, NCOL, COL_DX, visit, walkLoop, enterGate, fwd, back, sOf, exitAfter, entryBefore, syncBreaches, fitAt, buildFrom, release, mpOf, SPEEDS, L as LOOP_L } from './g4/mount.js';
import { g4Book } from './g4/book.js';
import { mountSource } from './g4/watch.js';

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
  lead: 30,
  lag: 12,
  importance: 1,

  init(ctx, events, sim) {
    syncBreaches(ctx);
    sim.setBounds([-200, 20, -30], [430, 470, 40]);
    const P = (name, role, count, seed, imp = 1, prop = null) => sim.pool({ name, role, count, seed: SEED + seed, importance: imp, prop });
    const state = {
      levites: P('gatekeepers', 'guard_levi', 8, 1),
      circMen: P('circuit-men', 'israelite', 36, 2),
      circWomen: P('circuit-women', 'woman', 18, 3),
      // the mourner and the one under a ban (Middot 2:2): people's roles mourner / menudeh — the head wrapped as the
      // atifah down to the beard, a fold over the mouth (Moed Katan 24a; Rambam Avel 5:19), dressed in black (people-4)
      mourner: P('mourner', 'mourner', 3, 139, 2),
      menudeh: P('menudeh', 'menudeh', 3, 141, 2),
      greeters: P('greeters', 'israelite', 4, 5, 2),
      enWomen: P('en-women', 'woman', 20, 6),
      enMen: P('en-men', 'israelite', 6, 7),
      meal: P('meal', 'kohen', 12, 8),
      cook: P('cook', 'kohen', 1, 9),
      plan: null, planGen: -1, troupes: [],
      sherds: undefined, sherdsOn: false,
      pish: sim.door(PISH),
      kfLevel: -1,
      fmt: (m) => ctx.time?.format?.(m) ?? hm(m),
      tmp: {},
    };
    // the circuit's watchable rows: someone prostrating opposite a breach now, the mourner going round to the left
    try { state.offSource = ctx.schedule?.addSource?.(mountSource(ctx, () => plan(ctx, state, sim))); } catch (e) { console.warn('[sim:g4] source failed', e); }
    return state;
  },

  /** the day's plan (g4/book.js planBefore calls it for the modules planned after this one) */
  plan(ctx, state, sim) { return plan(ctx, state, sim); },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, state, sim);
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
    return `plan ${JSON.stringify(P.ms || {})} · circuit ${P.nCirc} parties (${P.dropped} not seated) · EN ${P.nEn} · mourners ${P.mourners.map((m) => `${s.fmt(m.t0)}${m.ban ? '(ban)' : ''}`).join(' ')} · meal ${P.W.meal ? s.fmt(P.W.meal[0]) : '-'}/${P.W.night ? s.fmt(P.W.night[0]) : '-'} · fire ${s.kfLevel.toFixed(2)}`;
  },
};

// ================================================================================================ the day's plan
// Planned first of the G4 modules (g4/book.js ORDER): its walkers book the Mount's prostration places and lanes before
// the judges, the chamber workers and the Nikanor people do.
function plan(ctx, state, sim) {
  if (state.plan && state.planGen === sim.generation && state.planDate === ctx.time?.dateString) return state.plan;
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
    metzora: sim.schedule?.byId?.('metzora'), breakAt: NaN, keyBreak: '', watch: [], circEps: [] };
  state.troupes = [];
  // the mourners first (their greetings are fixed moments the greeters meet), then the stream, Ezrat Nashim and the
  // gatekeepers, each booking the Mount as it is planned
  const ms = P.ms = {};
  const timed = (k, f) => { const a = performance.now(); const r = f(); ms[k] = Math.round(performance.now() - a); return r; };
  if (W.circuit) state.troupes.push(...timed('circuit', () => circuit(state, P, seed, sim, book)));
  if (W.women) state.troupes.push(...timed('en', () => courtVisitors(state, P, seed, sim, book)));
  if (W.gate) state.troupes.push(timed('gate', () => gatekeepers(state, P, seed, z, book)));
  // ---- the meal and the scouring (inside the court: no Mount)
  if (W.meal || W.night) state.troupes.push(...timed('meal', () => meal(state, P, seed, sim)));
  timed('replan', () => { for (const tr of state.troupes) tr.replan(sim.generation); });
  state.plan = P;
  state.planGen = sim.generation;
  state.planDate = ctx.time?.dateString;
  return P;
}
const WHO = 'courts-daily';

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
const PARTY_KINDS = [
  [['m'], 0.34], [['w'], 0.11], [['m', 'm'], 0.12], [['m', 'w'], 0.15], [['w', 'w'], 0.09],
  [['m', 'w', 'w'], 0.08], [['m', 'm', 'm'], 0.06], [['w', 'w', 'w'], 0.05],
];
const pickKind = (seed, key, i) => { let x = rand(seed, key, i, 'kind'); for (const [k, w] of PARTY_KINDS) { x -= w; if (x <= 0) return k; } return ['m']; };
/** the day's rhythm of arrivals on the Mount (0..1): few at dawn, most in the morning, tapering toward evening ⚙ */
const rhythm = (t, w0, w1) => (0.25 + 0.75 * smooth(w0, w0 + 70, t)) * (1 - 0.6 * smooth(w1 - 150, w1 - 20, t));
const FILE = 0.022;          // minutes between party members (≈ 1.5 m at their pace)

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

function circuit(state, P, seed, sim, book) {
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
  const f = Math.max(0.6, sim.crowdScale);
  const peak = 1.25 * f;
  const times = arrivals(seed, 'circ', w0 + 0.5, w1 - 14, (t) => peak * rhythm(t, w0, w1), peak);
  const nM = state.circMen.count, nW = state.circWomen.count;
  const free = { m: new Array(nM).fill(-1e9), w: new Array(nW).fill(-1e9) };
  const eps = { m: Array.from({ length: nM }, () => []), w: Array.from({ length: nW }, () => []) };
  const minArc = 0.4 * LOOP_L;
  let kept = 0, dropped = 0;
  times.forEach((t, i) => {
    const kind = pickKind(seed, 'circ', i);
    const gate = pickGate(i);
    // a party with women goes at the slow pace; men alone at their own (the lane of that pace) ⚙
    const cls = kind.includes('w') ? 0 : [0, 1, 1, 2][Math.floor(rand(seed, 'cls', i) * 4)];
    const build = (prev) => (mp) => { const it = new Itin(); it.mp = mp; visit(it, { gate, spur: null, cls, minArc, prev }).done(); return it; };
    // the leader first (his start slides a little while his lane is not clear), the others a pace behind each
    const lead = buildFrom(book, WHO, t, build(null));
    const members = [{ pool: kind[0], t0: lead.t0, T: lead.it.T, it: lead.it }];
    for (let j = 1; j < kind.length; j++) {
      const t0 = lead.t0 + FILE * j;
      const it = build(members[j - 1].it.cols)(mpOf(book, t0, WHO));
      members.push({ pool: kind[j], t0, T: it.T, it });
    }
    if (members[0].t0 + members[0].T > w1 + 4 || !seat(free, eps, members)) {
      for (const m of members) release(m.it.mp);
      dropped++;
      return;
    }
    kept++;
  });
  P.nCirc = kept;
  P.dropped = dropped;
  out.push(new Troupe(state.circMen, { plan: (k) => eps.m[k], legs: (e) => e.it }));
  out.push(new Troupe(state.circWomen, { plan: (k) => eps.w[k], legs: (e) => e.it }));
  // the watchable rows (g4/watch.js): who is prostrating where
  P.circEps = [...eps.m.flat(), ...eps.w.flat()].sort((a, b) => a.t0 - b.t0);
  return out;
}

// the mourner's way in by the western Chuldah gate turning LEFT, round against the stream, out by the eastern one
// (in on the right half of the tunnel like everyone, then left across the stream; out on the leaving half). He walks
// on the circuit's line itself — the stream's lanes on his left, the prostration places on his right.
const MOURN_IN = new Route([[167, 26, -27.083], [167, 44.75, -27.083], [167, 71.75, 0], [167, 222, 0], [162.5, 231, 0], [156, 236, 0]], { round: 2.5 });
const MOURN_OUT = new Route([[339, 236, 0], [334.5, 231, 0], [333, 224, 0], [333, 71.75, 0], [333, 44.75, -27.083], [333, 26, -27.083]], { round: 2.5 });
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
const EN_CLUSTERS = (() => {
  const s = [];
  for (const x of [300, 310, 320, 331, 342]) for (const y of [303.5, 313.5, 347.5, 357.5]) s.push([x, y]);
  for (const x of [358, 368, 386]) for (const y of [312, 349]) s.push([x, y]);
  return s;
})();
const EY_SPOTS = [[251.6, 303], [248.2, 306.5], [251.4, 310.5], [247.6, 314.5], [251.0, 318.5], [246.8, 322.6], [250.4, 299], [247.4, 298.4]];
const CHASHAIM = [327.5, 391.4, 6];   // before Lishkat Chasha'im's door (Shekalim 5:6)
// a party's places round its spot: the first facing the Sanctuary, the others beside and a little behind ⚙
const MEMBER_OFF = [[0, 0], [0.9, -1.15], [0.95, 1.2]];

function courtVisitors(state, P, seed, sim, book) {
  const [w0, w1] = P.W.women;
  const metz = P.metzora && Number.isFinite(P.metzora.t0) ? [P.metzora.t0 - 5, P.metzora.t1 + 5] : null;
  const f = Math.max(0.5, sim.crowdScale);
  // no money is handled on Shabbat (muktzeh): the chests are visited on weekdays and Fridays only
  const coins = P.dayType !== 'shabbat' && shofarot(sim.ctx).length === 13;
  // women's parties (1–3) and men (alone or two) who go on up into Ezrat Yisrael ⚙ rates
  const wT = arrivals(seed, 'enw', w0 + 0.5, w1 - 30, (t) => 0.3 * f * rhythm(t, w0, w1), 0.3 * f);
  const mT = arrivals(seed, 'enm', w0 + 0.5, w1 - 25, (t) => 0.1 * f * rhythm(t, w0, w1), 0.1 * f);
  const cand = [];
  wT.forEach((t, i) => cand.push({ t, i, men: false }));
  mT.forEach((t, i) => cand.push({ t, i, men: true }));
  cand.sort((a, b) => a.t - b.t);
  const clusterFree = new Array(EN_CLUSTERS.length).fill(-1e9);
  const eySpotFree = new Array(EY_SPOTS.length).fill(-1e9);
  const nW = state.enWomen.count, nM = state.enMen.count;
  const free = { w: new Array(nW).fill(-1e9), m: new Array(nM).fill(-1e9) };
  const eps = { w: Array.from({ length: nW }, () => []), m: Array.from({ length: nM }, () => []) };
  let kept = 0;
  for (const c of cand) {
    const { t, i } = c;
    let spots, n, stay, talk = false, chashaim = false, inEY = false, cls, shofar = null;
    if (!c.men) {
      const r = rand(seed, 'enwk', i);
      n = r < 0.45 ? 1 : r < 0.82 ? 2 : 3;
      stay = 12 + 38 * rand(seed, 'enws', i);
      // a free place for the whole stay (walk in ≈ 4 min)
      const order = EN_CLUSTERS.map((_, q) => q).sort((a, b) => rand(seed, 'cl', i, a) - rand(seed, 'cl', i, b));
      const q = order.find((x) => clusterFree[x] < t + 3);
      if (q == null) continue;
      talk = n > 1 && rand(seed, 'talk', i) < 0.4;
      chashaim = n === 1 && rand(seed, 'ch', i) < 0.18;
      // a woman alone puts money into one of the chests (Shekalim 6:5 — the kinnin's, the gozlei olah's, the gifts') ⚙
      if (n === 1 && !chashaim && coins && rand(seed, 'sho', i) < 0.32) shofar = 'w';
      spots = Array.from({ length: n }, (_, j) => placeOf(EN_CLUSTERS[q], j, talk));
      spots.cluster = q;
      cls = 0;
    } else {
      n = rand(seed, 'enmk', i) < 0.7 ? 1 : 2;
      stay = 8 + 18 * rand(seed, 'enms', i);
      // men stand in Ezrat Yisrael, except while the metzora's rites fill Nikanor's gateway: then in Ezrat Nashim
      inEY = !(metz && t + 4 < metz[1] && t + stay + 8 > metz[0]);
      if (inEY) {
        const s = EY_SPOTS.map((_, q) => q).filter((q) => eySpotFree[q] < t + 2).slice(0, n);
        if (s.length < n) continue;
        spots = s.map((q) => EY_SPOTS[q]);
        spots.ey = s;
      } else {
        const order = EN_CLUSTERS.map((_, q) => q).sort((a, b) => rand(seed, 'clm', i, a) - rand(seed, 'clm', i, b));
        const q = order.find((x) => clusterFree[x] < t + 3);
        if (q == null) continue;
        spots = [0, 1].slice(0, n).map((j) => placeOf(EN_CLUSTERS[q], j, false));
        spots.cluster = q;
        if (coins && rand(seed, 'shm', i) < 0.45) shofar = 'm';     // the shekel, wood, frankincense, a gift ⚙
      }
      cls = rand(seed, 'enmc', i) < 0.5 ? 1 : 2;
    }
    const tag = c.men ? 'enm' : 'enw';
    const pool = c.men ? 'm' : 'w';
    const members = [];
    let lead = null;
    for (let j = 0; j < n; j++) {
      const e = { k: i * 3 + j, i, cls, v: SPEEDS[cls], stay, spot: spots[j], talk, chashaim, men: c.men, inEY, tag, shofar: j === 0 && shofar ? chestFor(sim.ctx, shofar, spots[j], seed, i) : null };
      if (j === 0) {
        lead = buildFrom(book, WHO, t, (mp) => enItin(e, seed, mp, null));
        members.push({ pool, t0: lead.t0, T: lead.it.T, it: lead.it });
      } else {
        const t0 = lead.t0 + FILE * j;
        const it = enItin(e, seed, mpOf(book, t0, WHO), members[j - 1].it.cols);
        members.push({ pool, t0, T: it.T, it });
      }
    }
    if (!seat(free, eps, members)) { for (const m of members) release(m.it.mp); continue; }
    if (spots.cluster != null) clusterFree[spots.cluster] = lead.t0 + 6 + stay;
    if (spots.ey) for (const q of spots.ey) eySpotFree[q] = lead.t0 + 5 + stay;
    kept++;
  }
  P.nEn = kept;
  return [new Troupe(state.enWomen, { plan: (k) => eps.w[k], legs: (e) => e.it }), new Troupe(state.enMen, { plan: (k) => eps.m[k], legs: (e) => e.it })];
}

/** a member's place at a party's spot: [X, Y, facing] — all toward the Sanctuary, or (talking) toward the middle */
function placeOf(c, j, talk) {
  const o = MEMBER_OFF[j % 3];
  const X = c[0] + o[0], Y = c[1] + o[1];
  const mid = [c[0] + 0.62, c[1]];
  const face = talk ? norm(Math.atan2(mid[0] - X, mid[1] - Y) * 180 / Math.PI) : 270;
  return [X, Y, face];
}

function enItin(e, seed, mp, prev) {
  const { v, stay, k, i, tag } = e;
  const it = new Itin();
  it.mp = mp;
  return visit(it, {
    gate: 'ce', spur: 'en', cls: e.cls, prev,
    build: (it) => {
      const sp = e.spot;
      const face = sp[2] + (e.talk ? 0 : (rand(seed, 'f', tag, k) - 0.5) * 16);
      if (e.men && e.inEY) {
        // up the fifteen steps and through Nikanor into Ezrat Yisrael (south lane up, north lane down) ⚙
        const up = [EN_IN, [277.75, 330.0, 6], [270.25, 330.0, 13.5], [261, 330.0, 13.5], [255.3, 330.0, 13.5], [252.6, 329.6, 13.5], [sp[0], sp[1], 13.5]];
        const down = [[sp[0], sp[1], 13.5], [252.6, 331.2, 13.5], [255.3, 331.0, 13.5], [261, 331.0, 13.5], [270.25, 331.0, 13.5], [277.75, 331.0, 6], EN_OUT];
        const t0 = it.T;
        it.walkTo(up, v);
        const tw = (it.T - t0) * 2;
        prayAt(it, Math.max(3, stay - tw), 270 + (rand(seed, 'fm', tag, k) - 0.5) * 16, seed, tag, k, i, true);
        it.walkTo(down, v);
        return;
      }
      const a = [sp[0], sp[1], 6], b = e.chashaim ? CHASHAIM : e.shofar ? e.shofar.stand : a;
      const dIn = Math.hypot(a[0] - EN_IN[0], a[1] - EN_IN[1]), dAB = Math.hypot(b[0] - a[0], b[1] - a[1]) * 2, dOut = Math.hypot(EN_OUT[0] - a[0], EN_OUT[1] - a[1]);
      const walkMin = ((dIn + dAB + dOut) * AMAH) / v / 60;
      const still = Math.max(4, stay - walkMin);
      it.walkTo([EN_IN, [a[0] + 4, a[1] + (a[1] < 330.5 ? 2 : -2), 6], a], v);
      if (e.talk) talkAt(it, still, face, seed, tag, k);
      else prayAt(it, still * (e.chashaim || e.shofar ? 0.9 : 1), face, seed, tag, k, i, e.men);
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
      it.walkTo([a, [a[0] + 4, a[1] + (a[1] < 330.5 ? 1 : -1), 6], EN_OUT], v);
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

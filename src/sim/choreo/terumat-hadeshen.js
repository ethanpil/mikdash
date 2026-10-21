// Terumat hadeshen and the new fire (Tamid 1:4–2:5; Yoma 22a, 33a, 37a; report Part IV §10.8, §12, lock #17).
//
// Events served (choreo 'terumat-hadeshen'):
//   muchni            the winner of the first lottery goes alone, without a lamp, by the light of the altar fire (Tamid
//                     1:4 — "no one goes in with him"), and works Ben Katin's wheel: the kiyor rises from its well with the
//                     creak heard as far as Yericho; his waiting brothers say "the time has come" (Tamid 1:4, 3:8).
//   terumat-hadeshen  he sanctifies hands and feet at the kiyor, takes the silver pan from its niche between the ramp and the
//                     altar on the ramp's west, goes up the east half, clears the coals aside and scoops from the inner,
//                     consumed ones, goes round the top to the right and down the west half, turns north along the east
//                     of the ramp about ten amot and heaps the coals three tefachim from it (Tamid 1:4; Zevachim 6:3).
//   clearing-altar    seeing him come down, his brothers run, sanctify at the kiyor, take the shovels and forks and go up;
//                     the limbs left from the evening are pushed to the sides of the altar (Tamid 2:1).
//   tapuach           the ashes are raked up onto the tapuach in the middle of the altar (Tamid 2:2).
//   great-pile        logs are carried up; the winner builds the great pile on the east, its face east (Tamid 2:3–4; Yoma 22a).
//   second-pile       fig wood for the incense pile opposite the SW horn; the leftover limbs pushed back into the fire; the
//                     two logs (Yoma 22a, 33a); both piles lit; all go down to Lishkat HaGazit (Tamid 2:5).
// The module is `always`: it owns the kiyor's state all day — sunk in its well from the locking of the court ⚙ until the
// muchni raises it — the two logs on the great pile (morning and afternoon, Yoma 2:5, 22a), the wood stack by the ramp
// and the shovels and forks kept with the service vessels west of the ramp. Every pose is a pure function of (t, date):
// one Script per figure, rebuilt per date.
import { Script, runScripts, FreeProps, movableCall, playerNear, win, walkMin, jit, SPEED,
  since, within, wrap, smooth } from './g2/lib.js';
import { places, rampUp, rampDown, circuit } from './g2/places.js';
import { pmLogs } from './g2/tamid.js';
import { cueAt, crossed, CUE_LEAD } from '../lib/cue.js';
import { rand } from '../lib/core.js';

const SEED = 0x7468;
const NB = 8;                      // "his brothers" (Tamid 2:1) — the number is not given ⚙
const CARRIERS = [0, 1, 2, 3, 4, 6];   // carry logs (Tamid 2:3) ⚙
const TENDERS = [5, 7];            // tend the fire: the leftover limbs back into it (Tamid 2:5) ⚙
const FIG = [4, 6];                // their second load is the fig wood for the incense pile (Tamid 2:5) ⚙
const TRIPS = 2;                   // log trips per carrier ⚙
const LIFT = 1.7;                  // minutes the muchni takes to raise or sink the kiyor ⚙
const TWO_LOGS_BURN = 90;          // minutes the two thin gizrin stay visible on the great pile ⚙
const COALS_GLOW = 40;             // minutes the heaped coals glow at Beit HaDeshen ⚙
const LIMBS_BURN = 60;             // minutes the evening's leftover limbs stay visible once back in the fire ⚙
const WOOD_BURN = 420;             // minutes the morning's new wood shows on the piles, until the afternoon's two logs ⚙
const COALS_PEAK = 0.2;            // the heaped coals: a low red glow, small flickers (fx has no 'embers' kind yet) ⚙
const SHABBAT_INCENSE = 0.85;      // Shabbat: eight se'ah of coals in the incense pile, not five (Tamid 2:5) ⚙ level
const SHABBAT_INCENSE_EASE = 240;  // … burning down to the builder's level over the morning ⚙
const CAPTION_RANGE = 260;         // m — the muchni was heard as far as Yericho (Tamid 3:8)
const NEAR = 45;                   // m — spoken lines
const FIRES = { great: 'altar.maarachah.great', inner: 'altar.maarachah.great.inner', incense: 'altar.maarachah.incense', kiyum: 'altar.maarachah.kiyum' };
const FIRE_KEYS = Object.keys(FIRES);
const FIRE_DEFAULT = { great: 1, inner: 0.9, incense: 0.6, kiyum: 0.75 };   // as the altar builder lights them
/** the night's embers the clearer finds at the muchni ⚙ — altar-night's wants sink to them before this module's begin */
export const EMBERS = { great: 0.55, inner: 0.45 };
const COALS_FIRE = 'sim.g2.terumat-coals';
// the muchni's wheel as the operator's pose meets it (people's ctx.people.stations.windlass / windlassRaise): the
// kiyor's raise(f) turns the wheel to (1 − f)·drop/0.36 rad (world/altar/kiyor.js); the pose's phase is the station's
// phaseAt(angle) — these fallbacks repeat people's formulas when the people module is absent
const WINDLASS_FALLBACK = { phaseAt(a) { const p = (a - Math.PI / 12) / (Math.PI / 2); return p - Math.floor(p); } };
const WINDLASS_RAISE_FALLBACK = { phaseAt(a) { const p = (-Math.PI / 12 - a) / (Math.PI / 2); return p - Math.floor(p); } };
const DRUM_R = 0.36;               // amot: the rope drum the wheel turns (world/altar/kiyor.js)
// the tapuach (world: altar.tapuach grow(f), 1 = site.js's mound): the night's ash settles as it cools ⚙, and the morning's
// is raked up onto it (Tamid 2:2) — near 1 always (world-3-fix: its collider is the full mound)
const TAPUACH_LOW = 0.94;
// the evening's limb not consumed by dawn (Tamid 2:1): charred (altar-night's charred(); spelled out here, since
// altar-night imports this module — a top-level call through the cycle runs before it is defined)
const LIMB = 'limb_gerah_charred';
const BRANCH = 'gizrin_branch', BUNDLE = 'branch_bundle';   // the pile's wood (Tamid 2:3): fig, walnut, oil-wood

export default {
  id: 'terumat-hadeshen',
  always: true,
  importance: 3,

  init(ctx, events, sim) {
    const P = places(ctx);
    sim.setBounds([80, 266, 0], [245, 392, 40]);
    const state = {
      P,
      // the winner works the muchni's wheel: an operator at a fixture at scale 1 (people-4-fix), as in every G1 module
      winner: sim.pool({ name: 'winner', role: 'kohen', count: 1, seed: SEED, importance: 3, scale: 1 }),
      brothers: sim.pool({ name: 'brothers', role: 'kohen', count: NB, seed: SEED + 1, importance: 2 }),
      lowerer: sim.pool({ name: 'kiyor-lowerer', role: 'kohen', count: 1, seed: SEED + 2, importance: 1, scale: 1 }),
      wicket: sim.door('azarah.gate.moked.pishpash'),
      props: new FreeProps(ctx),
      plan: null, planGen: -1,
      out: {}, fW: [], fB: [], fL: [],
      coals: null, coalsLevel: 0,
      fmt: (m) => ctx.time?.format?.(m) ?? '--',
    };
    // the per-date plan now, behind the loader (it is rebuilt on a new date)
    try { plan(ctx, sim, state); } catch (e) { console.warn(`[sim] ${sim.id} plan at init failed`, e); }
    return state;
  },

  update(ctx, state, t, dt, sim) {
    const P = plan(ctx, sim, state);
    if (!P) return;
    const S = state;
    runScripts(ctx, S.winner, [P.W], t, S.out, S.fW);
    runScripts(ctx, S.brothers, P.B, t, S.out, S.fB);
    runScripts(ctx, S.lowerer, [P.L], t, S.out, S.fL);
    S.props.update(t);
    // the kiyor on the muchni: sunk overnight, raised at dawn (Yoma 37a; Tamid 1:4)
    movableCall(ctx, S, 'altar.kiyor', 'raise', kiyorQ(P, t));
    // the great pile cleared with the night's ash and built again log by log (Tamid 2:2–4); the tapuach heaped up
    movableCall(ctx, S, 'altar.maarachah.great.pile', 'build', Math.round(pileAt(P, t) * 1e4) / 1e4);
    movableCall(ctx, S, 'altar.tapuach', 'grow', Math.round(tapuachAt(P, t) * 1e4) / 1e4);
    // the silver pan in its niche (Tamid 1:4): out of it from his stoop until he puts it back ⚙
    movableCall(ctx, S, 'altar.machtah', 'visible', !within(t, P.panOut[0], P.panOut[1]));
    // the two logs on the great pile (Yoma 22a, 33a; afternoon: Yoma 2:5)
    let two = false;
    for (const w of P.twoLogs) if (within(t, w[0], w[1])) two = true;
    movableCall(ctx, S, 'altar.two-logs', 'visible', two);
    // the Moked's wicket open for those coming out (and the lowerer going in at the locking) ⚙
    let wk = 0;
    for (const [a, b] of P.wicket) if (within(t, a, b)) wk = Math.max(wk, smooth(0, 0.08, since(t, a)) * (1 - smooth(since(b, a) - 0.08, since(b, a), since(t, a))));
    if (wk > 0) S.wicket.set(wk);
    fires(P, t, sim);
    coals(ctx, S, P, t, sim);
    cues(ctx, S, P, sim);
  },

  /** the day's plan, for sim.planOf('terumat-hadeshen'): read by lotteries.js (W, B[i].tEnd — its men's arrival in the Gazit) */
  plan(ctx, state, sim) { return plan(ctx, sim, state); },

  debug(s) {
    const P = s.plan, f = s.fmt;
    if (!P) return 'no plan';
    const warn = [P.W, ...P.B, P.L].flatMap((x) => x?.warn || []);
    return `muchni ${f(P.tWheel)} · pan ${f(P.panOut[0])}–${f(P.panOut[1])} · pour ${f(P.tPour)} · run ${f(P.tRun)} · two logs ${f(P.twoLogs[0][0])} · light ${f(P.tLight)} · props ${s.props.shown}/${s.props.count}${warn.length ? `\n   ⚠ ${warn.slice(0, 3).join(' · ')}` : ''}`;
  },
};

// ------------------------------------------------------------------------------------------------ the day's plan

function windows(ctx, sim) {
  const z = ctx.time?.zmanim;
  const alot = z?.alot ?? 280;
  const w = (id, a, b) => win(sim, id) || [wrap(alot + a), wrap(alot + b)];
  const lock = win(sim, 'locking-up');
  return {
    MU: w('muchni', -50, -47), TH: w('terumat-hadeshen', -47, -39), CL: w('clearing-altar', -39, -34), TP: w('tapuach', -34, -26),
    GP: w('great-pile', -26, -19), SP: w('second-pile', -19, -10),
    lock: lock ? lock[0] : wrap((z?.tzeit ?? 1050) - 15),
    pm: win(sim, 'afternoon-limbs'),
    torch: sim.event('torch-inspection')?.pos || sim.event('lamp-inspection-shabbat')?.pos || [238.5, 319.5, 16],
    midnight: z?.midnight ?? 1400,
  };
}

/** the kiyor's height as the movable is given it (quantised: the pose's phase is computed from the same value) */
const kiyorQ = (P, t) => Math.round(kiyorAt(P, t) * 1e4) / 1e4;

/** the kiyor's height: 1 up … 0 sunk; sunk from the locking until the muchni raises it ⚙ */
function kiyorAt(P, t) {
  if (within(t, P.tLower, P.tWheel)) return 1 - smooth(0, LIFT, since(t, P.tLower));
  if (within(t, P.tWheel, wrap(P.tWheel + LIFT))) return smooth(0, LIFT, since(t, P.tWheel));
  return 1;
}

function plan(ctx, sim, state) {
  if (state.plan && state.planGen === sim.generation) return state.plan;
  const W = windows(ctx, sim);
  const P = state.P;
  // unwrapped minutes from the muchni: every morning time below is base + offset
  const b = W.MU[0];
  const at = (x) => b + since(x, b);
  const MU = [b, at(W.MU[1])], TH = [at(W.TH[0]), at(W.TH[1])], CL = [at(W.CL[0]), at(W.CL[1])];
  const TP = [at(W.TP[0]), at(W.TP[1])], GP = [at(W.GP[0]), at(W.GP[1])], SP = [at(W.SP[0]), at(W.SP[1])];
  const Z = P.Z, A = P.altar, R = P.ramp, K = P.kiyor;
  const ZT = A.ZT;
  const shabbat = ctx.time?.dayType === 'shabbat';
  const tap = A.tap.center;
  const tWheel = MU[0] + CUE_LEAD;        // the creak: the event's headline moment (CUE_LEAD after its start)
  const tools = toolSpots(P);
  const stack = stackSpots();
  const limbs = leftoverLimbs(A);
  const limbKeys = limbs.map((l) => [{ t: MU[0] - 2.5, ...l.pile }]);
  const limbBurn = limbs.map(() => SP[1]);

  // the ways (authored, along open pavement)
  const G = W.torch;
  // south of the ramp, west of the tables, round the north end of the amah's open channel (places.js way.westUp)
  const southRoute = [[G[0] - 3.5, 300, Z], [231.2, 273.2, Z], [206.3, 273.4, Z], ...P.way.westUp.slice(1, 5)];
  // into the muchni's frame from its open south side, between the trestles ⚙
  const intoFrame = [[196.4, 309.0, Z], [192.4, 308.7, Z], K.wheelStand];
  const outOfFrame = [[K.raiseStand[0] + 0.1, 314.9, Z]];
  // the wheel's angle and the operators' phases (ctx.people.stations — the wheel ↔ pose coupling)
  const drop = ctx.movables?.get?.('altar.kiyor')?.userData?.dropAmot ?? 4.8;
  const ST = ctx.people?.stations || {};
  const WL = ST.windlass?.phaseAt ? ST.windlass : WINDLASS_FALLBACK, WR = ST.windlassRaise?.phaseAt ? ST.windlassRaise : WINDLASS_RAISE_FALLBACK;
  const wheelAngle = (t) => ((1 - kiyorQ(state.plan, t)) * drop) / DRUM_R;
  const raisePhase = (t) => WR.phaseAt(wheelAngle(t)), lowerPhase = (t) => WL.phaseAt(wheelAngle(t));
  const footE = (x = R.east) => [x, R.foot - 1.2, Z];
  /** from a spot on the top to the head of the ramp's west half, going round to the right (Zevachim 6:3) */
  const toHeadW = (from) => {
    if (from[1] >= A.tap.center[1] + 3.5) return [[from[0], A.wk.N, ZT], [A.wk.W, A.wk.N, ZT], [A.wk.W, A.wk.S, ZT], [R.west, A.wk.S, ZT]];
    if (from[0] < 214) return [[208.5, from[1], ZT], [208.5, A.wk.S, ZT], [R.west, A.wk.S, ZT]];
    return [[from[0], A.wk.S, ZT], [R.west, A.wk.S, ZT]];
  };

  // ---------------------------------------------------------------------------------------------- the winner
  const groupSpot = (i) => [G[0] - 1.6 + (i >= 4 ? 1.7 : 0) + jit(SEED, 0.35, 'gx', i), G[1] - 3.2 + (i % 4) * 1.35 + jit(SEED, 0.3, 'gy', i), Z];
  const tGo = MU[0] - 0.6;               // the brothers' warning, then he goes alone (Tamid 1:4)
  const w = Script.from(MU[0] - 0.8, [G[0] - 2.4, G[1] - 0.6, Z], 270, 'winner').exact();
  w.until(tGo, { pose: 'stand', heading: 270 });
  // into the frame from its open south side; ducking under the axle (2.6 amot up) to the north of it, where he pulls the
  // north rim down hand over hand: the kiyor rises (people's windlass_raise, its phase from the wheel's angle) ⚙ side
  const [ua, ub] = K.underAxle;
  w.walkBy(tWheel - 0.2, [...southRoute, intoFrame[0], intoFrame[1], ua]);
  // the axle's underside is 1.17 m up: people's 'bow' keeps the head at 1.25 m (through the axle), so he stoops with
  // bent knees, a hand on his knee (pour_low's stoop, the jug's tilt not reached before phase 0.32: head 0.96 m), and
  // shuffles through; people have no stooped walk yet (requested) ⚙
  w.act(0.035, { pose: 'pour_low', phase: [0, 0.29], heading: 0 });
  w.shift(ub, 0.06, { pose: 'pour_low', phase: 0.3, heading: 0 });
  w.act(0.035, { pose: 'pour_low', phase: [0.78, 1], heading: 0 });
  w.shift(K.raiseStand, 0.03, { heading: 90 });
  w.until(tWheel, { pose: 'stand', heading: 90 });
  w.until(tWheel + LIFT, { pose: 'windlass_raise', phase: raisePhase, heading: 90 });
  w.until(TH[0], { pose: 'stand', heading: 75 });
  // the kiyor: right hand on the right foot, left on the left, under the spigot (Zevachim 19b)
  w.walk([...outOfFrame, K.east], { speed: SPEED.slow });
  sanctify(w, K.eastHeading, 0.6);
  // the pan's niche: up onto the small yesod ramp's level run, stoop for the pan in the pocket below it ⚙
  w.walk([[194.6, 315.6, Z], [196.4, 309.0, Z], [200.3, 306.4, Z], [200.3, 302.6, Z], P.pan.floor], { speed: SPEED.slow });
  w.shift(P.pan.ledge, 0.05, { pose: 'walk', heading: 0 });
  w.act(0.1, { pose: 'bow', phase: [0, 0.4], heading: 0 });
  const tPanUp = w.now() + 0.06;
  w.act(0.12, { pose: 'bow', phase: 0.45, heading: 0 });
  const PAN = ['machtah_silver', null];
  w.act(0.08, { pose: 'bow', phase: [0.7, 1], heading: 0, props: PAN });
  w.shift(P.pan.floor, 0.05, { pose: 'walk', heading: 180, props: PAN });
  // to the ramp's foot and up its east half — up on the right (Zevachim 6:3); the pan carried before him in both hands
  w.walk([[203.8, 297.5, Z], [203.8, 279, Z], [206.3, 274.3, Z], footE(), [R.east, R.foot, R.z(R.foot)]], { speed: SPEED.slow, pose: 'carry_walk', props: PAN });
  w.walk(rampUp(P), { speed: SPEED.ramp, pose: 'carry_walk', props: PAN });
  const scoopAt = [A.great.min[0] + 3.2, A.great.min[1] - 1.7, ZT];
  w.walk([[R.east + 2.6, A.wk.S, ZT], scoopAt], { speed: SPEED.slow, pose: 'carry_walk', props: PAN });
  // back from the end: the pour three tefachim from the ramp ends just before he is "seen coming down"
  const POUR = 0.35, tPourEnd = TH[1] - 0.05;
  const round = [[A.wk.E, scoopAt[1], ZT], ...circuit(P, 'se', 'sw').slice(1), [R.west, A.wk.S, ZT]];
  const down = rampDown(P);
  const east = [[P.deshen.stand[0], R.foot - 1.2, Z], P.deshen.stand];
  const tLeave = tPourEnd - POUR - 0.15 - walkMin(scoopAt, round, SPEED.slow) - walkMin(round[round.length - 1], down, SPEED.ramp) - walkMin(down[down.length - 1], east, SPEED.slow);
  // "he cleared the coals this way and that, and scooped from the inner, consumed ones" (Tamid 1:4)
  w.until(tLeave - 0.3, { pose: 'sweep', heading: 0, props: PAN });
  w.act(0.3, { pose: 'stoke', heading: 345, props: PAN });
  w.walk(round, { speed: SPEED.slow, pose: 'carry_walk', props: PAN });
  w.walk(down, { speed: SPEED.ramp, pose: 'carry_walk', props: PAN });
  // "he reached the pavement, turned his face to the north, went along the east of the ramp about ten amot"
  w.walk(east, { speed: SPEED.slow, pose: 'carry_walk', props: PAN });
  w.act(0.15, { pose: 'stand', heading: 270, props: PAN });
  const tPour = w.now() + POUR * 0.55;
  w.act(POUR, { pose: 'pour', phase: [0, 1], heading: 270, props: PAN });
  // the pan back to its niche ⚙ (the Mishnah does not say), then his fork from the vessels and up with his brothers
  w.walk([[P.deshen.stand[0], R.foot - 1.6, Z], ...P.way.westUp.slice(0, 3), P.pan.floor], { speed: SPEED.walk, pose: 'carry_walk', props: PAN });
  w.shift(P.pan.ledge, 0.05, { pose: 'walk', heading: 0, props: PAN });
  w.act(0.1, { pose: 'bow', phase: [0, 0.4], heading: 0, props: PAN });
  const tPanBack = w.now() + 0.05;
  w.act(0.1, { pose: 'bow', phase: 0.45, heading: 0 });
  w.act(0.08, { pose: 'bow', phase: [0.7, 1], heading: 0 });
  w.shift(P.pan.floor, 0.05, { pose: 'walk', heading: 180 });
  const wTool = tools[NB];
  pickTool(w, wTool);
  const WT = [wTool.name, null];
  w.walk([[203.8, 279, Z], [206.3, 274.3, Z], footE(), [R.east, R.foot, R.z(R.foot)]], { speed: SPEED.walk, props: WT });
  w.walk(rampUp(P), { speed: SPEED.ramp, props: WT });
  w.walk([[A.wk.E, A.wk.S, ZT], A.greatFace], { speed: SPEED.walk, props: WT });
  // the ash at the face of the pile, then the pile itself as the logs come: its face east, the inner ends touching the
  // tapuach, gaps for the kindling (Tamid 2:4) — he who won the clearing builds it (Yoma 22a)
  w.until(GP[0], { pose: 'stoke', heading: 270, props: WT });
  w.until(SP[0] + 0.5, { pose: 'stoke', heading: 270, sway: 10, seed: SEED + 7, props: WT });

  // ---------------------------------------------------------------------------------------------- the brothers
  const tRun = CL[0];
  const RK = [205, 238, 270, 302, 335, 190, 350, 222];
  const rakeH = (i, k) => RK[(i * 3 + k) % RK.length] + jit(SEED, 5, 'rk', i * 10 + k);
  const onRing = (deg) => { const h = deg / 57.2958, r = A.tap.radius + 1.6; return [tap[0] + Math.sin(h) * r, tap[1] + Math.cos(h) * r, ZT]; };
  // round the west half of the tapuach (the great pile is on its east); a shift every few minutes ⚙
  // from the mound's south (180°) or north (360°) foot round its west to his first raking place
  const toRing = (i, north) => {
    const a = north ? 360 : 180, b = rakeH(i, 0), n = Math.max(1, Math.ceil(Math.abs(b - a) / 20));
    return Array.from({ length: n + 1 }, (_, q) => onRing(a + ((b - a) * q) / n));
  };
  // from one raking place to the next round the mound's foot, never across the ash heap (all on its west half)
  const rakeArc = (i, k) => {
    const a = rakeH(i, k - 1), b = rakeH(i, k), n = Math.max(1, Math.ceil(Math.abs(b - a) / 20));
    return Array.from({ length: n }, (_, q) => onRing(a + ((b - a) * (q + 1)) / n));
  };
  // waiting on the north walkway, facing the fire ⚙
  const waitSpot = (n) => [207.2 + 2.5 * n, A.wk.N - 0.2, ZT];
  const B = [];
  const lay = [];
  let logK = 0;
  const wicketPass = [];
  for (let i = 0; i < NB; i++) {
    // brothers 0–3 come with the winner from the torch inspection (G1 hands them over here at muchni.t0 − 0.8); the
    // others come out of Beit HaMoked through the wicket as the clearing nears ⚙
    let s;
    if (i < 4) s = Script.from(MU[0] - 0.8, groupSpot(i), 270, `brother${i}`).exact();
    else {
      const t0 = CL[0] - 3.6 + 0.3 * (i - 4);
      s = Script.from(t0, P.moked.wicketIn, 180, `brother${i}`).exact();
      s.walk([P.moked.wicket, P.moked.wicketOut, [213.1, 386.6, Z], [P.way.eastLine, 385.4, Z], [P.way.eastLine, 345, Z], groupSpot(i)], { speed: SPEED.walk });
      wicketPass.push([t0 - 0.1, t0 + 0.25]);
    }
    s.until(tRun + jit(SEED, 0.05, 'rn', i) + 0.06, { pose: 'stand', heading: 270, sway: 10, seed: SEED + 31 * i });
    // they ran and came; they hurried and sanctified (Tamid 2:1)
    const kSpot = K.spots[i];
    const westSide = kSpot[0] < K.c[0];
    const route = [[G[0] - 3.5 + jit(SEED, 0.6, 'rx', i), 300, Z], [231.2, 273.2 + jit(SEED, 0.4, 'ry', i), Z], [206.3, 273.4 + jit(SEED, 0.4, 'rz', i), Z],
      ...P.way.westUp.slice(1, 5), ...(westSide ? [[196.0, 308.8, Z], [184.2, 308.9, Z], [184.0, kSpot[1], Z]] : [[196.4, 309.0, Z], [195.4, 315.7, Z]]), kSpot];
    void westSide;
    s.walk(route, { speed: SPEED.run, pose: 'run' });
    sanctify(s, K.spotHeadings[i], 0.7 + 0.3 * rand(SEED, 'sc', i));
    // the shovels and the forks, kept with the service vessels west of the ramp ⚙
    const tool = tools[i];
    s.walk([...(westSide ? [[184.0, kSpot[1], Z], [184.2, 308.9, Z], [196.0, 308.8, Z]] : [[195.4, 315.7, Z], [196.4, 309.0, Z]]), ...P.way.westDown.slice(1, 4)], { speed: 1.8 });
    pickTool(s, tool);
    const TOOL = [tool.name, null];
    const ux = R.east + jit(SEED, 0.6, 'ux', i);
    s.walk([[203.8, 279, Z], [206.3, 274.3, Z], footE(ux), [ux, R.foot, R.z(R.foot)]], { speed: 1.8, props: TOOL });
    s.walk(rampUp(P, ux), { speed: 1.2, props: TOOL });
    const fork = tool.name === 'fork';
    if (fork) {
      // the limbs and fats not consumed since evening pushed to the sides of the altar (Tamid 2:1)
      const fi = (i - 1) / 2;
      const l = limbs[fi];
      if (l) {
        s.walk([[A.wk.E, A.wk.S, ZT], [A.wk.E, A.wk.N, ZT], l.stand], { speed: SPEED.walk, props: TOOL });
        s.act(0.15, { pose: 'stoke', face: [l.pile.X, l.pile.Y], props: TOOL });
        limbKeys[fi].push({ t: s.now(), ...l.edge, lerp: true, dur: 0.35 });
        s.act(0.35, { pose: 'stoke', face: [l.pile.X, l.pile.Y], props: TOOL });
        s.until(CL[1], { pose: 'stoke', face: [l.edge.X, l.edge.Y], props: TOOL });
        // to the tapuach's foot from the north, round its west to his raking place
        s.walk([[tap[0] + 0.3, s.cur[1] - 0.2, ZT], ...toRing(i, true)], { speed: SPEED.walk, props: TOOL });
      } else {
        // the others spread the night's coals about the pile with their forks ⚙
        const f = [[A.wk.E - 0.6, A.great.min[1] + 1.4, ZT], [A.great.min[0] + 3, A.great.min[1] - 1.5, ZT], [A.wk.E - 0.6, A.great.max[1] - 1.4, ZT]][fi % 3];
        s.walk([[A.wk.E, A.wk.S, ZT], f], { speed: SPEED.walk, props: TOOL });
        s.until(CL[1], { pose: 'stoke', face: [A.great.min[0] + 3, (A.great.min[1] + A.great.max[1]) / 2], props: TOOL });
        // south of the great pile to the tapuach's foot, round its west to his raking place
        s.walk([[s.cur[0], A.great.min[1] - 2.0, ZT], ...toRing(i, false)], { speed: SPEED.walk, props: TOOL });
      }
    } else {
      s.walk([[R.east - 2, A.wk.S + 1.2, ZT], [tap[0], A.wk.S + 1.2, ZT], ...toRing(i, false)], { speed: SPEED.walk, props: TOOL });
      s.until(CL[1], { pose: 'sweep', face: tap, props: TOOL });
    }
    // the ashes heaped up onto the tapuach (Tamid 2:2), a shift round the mound every few minutes ⚙
    const tpEnd = CARRIERS.includes(i) ? GP[0] + 0.15 + CARRIERS.indexOf(i) * 0.32 : TP[1];
    for (let k = 1; k <= 3; k++) {
      s.walk(rakeArc(i, k), { speed: 0.8, props: TOOL });
      s.until(Math.min(tpEnd, TP[0] + ((TP[1] - TP[0]) * k) / 3), { pose: fork ? 'stoke' : 'sweep', face: tap, props: TOOL });
    }
    if (CARRIERS.includes(i)) {
      // the logs (Tamid 2:3)
      const c = CARRIERS.indexOf(i);
      for (let k = 0; k < TRIPS; k++) {
        s.until(GP[0] + 0.15 + c * 0.32 + k * 2.6, { pose: fork ? 'stoke' : 'sweep', face: tap, props: k === 0 ? TOOL : null });
        s.walk(toHeadW(s.cur), { speed: SPEED.walk, props: k === 0 ? TOOL : null });
        const dx = R.west + jit(SEED, 0.5, 'dx', i * 3 + k);
        s.walk(rampDown(P, dx), { speed: 1.1, props: k === 0 ? TOOL : null });
        if (k === 0) {
          // the tool laid back with the vessels, west of the ramp
          s.walk([[206.3, 274.3, Z], [203.8, 279, Z], tool.stand], { speed: SPEED.walk, props: TOOL });
          dropTool(s, tool);
          s.walk([[203.8, 279, Z], [206.3, 274.3, Z]], { speed: SPEED.walk });
        }
        const st = stack[logK++];
        s.walk([[R.west + 2.5, R.foot - 1.7, Z], [R.box.max[0] + 1.2, R.foot - 1.6, Z], st.stand], { speed: SPEED.walk });
        s.act(0.08, { pose: 'bow', phase: [0, 0.45], face: [st.X, st.Y] });
        st.pick = s.now();
        // a branch of the pile's wood on the shoulder (people's gizrin_branch → carry_log); the fig wood for the
        // incense pile as a bundle of fine branches (Tamid 2:5)
        const LOG = [FIG.includes(i) && k === TRIPS - 1 ? BUNDLE : BRANCH, null];
        st.name = LOG[0];
        s.act(0.1, { pose: 'bow', phase: [0.6, 1], face: [st.X, st.Y], props: LOG });
        const lx = R.east + jit(SEED, 0.5, 'lx', i * 3 + k);
        s.walk([footE(lx), [lx, R.foot, R.z(R.foot)]], { speed: SPEED.walk, pose: 'carry_shoulder_walk', props: LOG });
        s.walk(rampUp(P, lx), { speed: SPEED.ramp, pose: 'carry_shoulder_walk', props: LOG });
        if (FIG.includes(i) && k === TRIPS - 1) {
          // "they chose fine fig wood from there for the second pile, for the incense" (Tamid 2:5)
          s.walk([[A.wk.E, A.wk.S, ZT], ...circuit(P, 'ne', 'sw'), [A.incenseAt[0], A.wk.S, ZT], A.incenseAt], { speed: SPEED.walk, pose: 'carry_shoulder_walk', props: LOG });
          s.act(0.15, { pose: 'toss', phase: [0, 1], heading: 225, props: LOG });
          lay.push([s.now(), 'incense']);
          s.act(0.5, { pose: 'stoke', heading: 225 });
        } else {
          const face = [A.wk.E - 0.5, A.great.min[1] + 0.8 + ((c * 2 + k) % 6) * 1.25, ZT];
          s.walk([[A.wk.E, A.wk.S, ZT], face], { speed: SPEED.slow, pose: 'carry_shoulder_walk', props: LOG });
          s.act(0.15, { pose: 'toss', phase: [0, 1], heading: 270, props: LOG });
          lay.push([s.now(), 'great']);
          s.walk(circuit(P, 'ne', 'sw'), { speed: SPEED.walk });
        }
      }
      s.walk([[A.wk.W, s.cur[1], ZT], [A.wk.W, A.wk.N, ZT], waitSpot(c)], { speed: SPEED.walk });
    } else {
      // the tenders: the evening's limbs pushed back into the fire with the forks (Tamid 2:5)
      const n = TENDERS.indexOf(i);
      s.until(SP[0] + 0.3 + n * 0.6, { pose: 'stoke', face: tap, props: TOOL });
      for (let j = n; j < limbs.length; j += TENDERS.length) {
        const l = limbs[j];
        s.walk([...pathOnTop(A, s.cur, l.behind), l.behind], { speed: SPEED.walk, props: TOOL });
        s.act(0.12, { pose: 'stoke', face: [l.edge.X, l.edge.Y], props: TOOL });
        // the push: he walks behind it as it slides back to the pile's edge ⚙
        const t0 = s.now();
        s.walk([l.pushTo], { speed: 0.45, pose: 'walk', props: TOOL });
        const t1 = s.now();
        pushKeys(limbKeys[j], l, t0, t1);
        s.act(0.2, { pose: 'stoke', face: [l.pile.X, l.pile.Y], props: TOOL });
        limbKeys[j].push({ t: s.now(), ...l.pile, lerp: true, dur: 0.15 });
        limbBurn[j] = s.now();
      }
      s.walk([...pathOnTop(A, s.cur, waitSpot(6 + n)), waitSpot(6 + n)], { speed: SPEED.walk, props: TOOL });
    }
    B.push(s);
  }

  // ---- the winner: the two logs (Moshe's measure, an amah square and thin — Zevachim 62b; Yoma 22a, 33a)
  w.walk([[A.wk.E, A.wk.N, ZT], [A.wk.W, A.wk.N, ZT], [A.wk.W, A.wk.S, ZT], [R.west, A.wk.S, ZT]], { speed: SPEED.walk, props: WT });
  w.walk(rampDown(P), { speed: 1.1, props: WT });
  w.walk([[206.3, 274.3, Z], [203.8, 279, Z], wTool.stand], { speed: SPEED.walk, props: WT });
  dropTool(w, wTool);
  const two = [stack[CARRIERS.length * TRIPS + 1], stack[CARRIERS.length * TRIPS]];
  w.walk([[203.8, 279, Z], [206.3, 274.3, Z], [R.west + 2.5, R.foot - 1.7, Z], [R.box.max[0] + 1.2, R.foot - 1.6, Z], two[0].stand], { speed: SPEED.walk });
  w.act(0.1, { pose: 'bow', phase: [0, 0.45], face: [two[0].X, two[0].Y] });
  two[0].pick = w.now(); two[1].pick = w.now();
  const TWO = ['log', null];
  w.act(0.1, { pose: 'bow', phase: [0.6, 1], face: [two[0].X, two[0].Y], props: TWO });
  w.walk([footE(), [R.east, R.foot, R.z(R.foot)]], { speed: SPEED.walk, pose: 'carry_walk', props: TWO });
  w.walk(rampUp(P), { speed: SPEED.ramp, pose: 'carry_walk', props: TWO });
  w.walk([[A.wk.E, A.wk.S, ZT], A.greatFace], { speed: SPEED.slow, pose: 'carry_walk', props: TWO });
  w.act(0.15, { pose: 'toss', phase: [0, 1], heading: 270, props: TWO });
  const tTwoLogs = w.now();
  // fire for the kindling from the third pile, kept burning for that (R' Yosi, Yoma 45a; lock #17) ⚙
  const brandAt = [A.kiyum.max[0] + 1.3, A.kiyum.min[1] - 0.6, ZT];
  const BRAND = ['torch', null];
  w.walk([[A.wk.E, A.wk.S, ZT], [brandAt[0], A.wk.S, ZT], brandAt], { speed: SPEED.walk });
  const kc = [(A.kiyum.min[0] + A.kiyum.max[0]) / 2, (A.kiyum.min[1] + A.kiyum.max[1]) / 2];
  w.act(0.1, { pose: 'bow', phase: [0, 0.4], face: kc });
  w.act(0.08, { pose: 'bow', phase: [0.7, 1], face: kc, props: BRAND });
  w.walk([[brandAt[0], A.wk.S, ZT], [A.wk.E, A.wk.S, ZT], A.greatFace], { speed: SPEED.walk, pose: 'torch_walk', props: BRAND });
  // "they lit both piles" (Tamid 2:5) — the kindling in the gaps between the logs (Tamid 2:4)
  const tLight = Math.max(w.now() + 0.15, SP[1] - 3.0);
  w.until(tLight, { pose: 'torch', heading: 270, props: BRAND });
  w.act(1.0, { pose: 'stoke', heading: 270, props: BRAND });
  // the incense pile lit at the same time by the second tender
  {
    const s = B[TENDERS[1]];
    const tool = tools[TENDERS[1]];
    s.until(tLight - 1.0, { pose: 'stand', face: tap, props: [tool.name, null] });
    const bAt = [A.kiyum.min[0] - 1.1, A.kiyum.min[1] - 0.4, ZT];
    s.walk([[A.wk.W, A.wk.N, ZT], [A.wk.W, bAt[1], ZT], bAt], { speed: SPEED.walk, props: [tool.name, null] });
    const kc2 = [(A.kiyum.min[0] + A.kiyum.max[0]) / 2, (A.kiyum.min[1] + A.kiyum.max[1]) / 2];
    s.act(0.1, { pose: 'bow', phase: [0, 0.4], face: kc2, props: [tool.name, null] });
    s.act(0.08, { pose: 'bow', phase: [0.7, 1], face: kc2, props: ['torch', tool.name] });
    s.walk([A.incenseAt], { speed: SPEED.slow, pose: 'torch_walk', props: ['torch', tool.name] });
    s.until(tLight, { pose: 'torch', heading: 225, props: ['torch', tool.name] });
    s.act(1.0, { pose: 'stoke', heading: 225, props: ['torch', tool.name] });
  }
  // all go down and come to Lishkat HaGazit (Tamid 2:5)
  const tDown = SP[1] - 1.75;
  const toGazit = (s, k, tool) => {
    s.until(tDown + k * 0.12, { pose: 'stand', face: tap, sway: 7, seed: SEED + 91 * k, props: tool ? [tool.name, null] : null });
    s.walk(toHeadW(s.cur), { speed: SPEED.walk, props: tool ? [tool.name, null] : null });
    s.walk(rampDown(P, R.west + jit(SEED, 0.6, 'gx', k)), { speed: 1.15, props: tool ? [tool.name, null] : null });
    if (tool) {
      s.walk([[206.3, 274.3, Z], [203.8, 279, Z], tool.stand], { speed: SPEED.walk, props: [tool.name, null] });
      dropTool(s, tool);
      s.walk([[203.8, tool.stand[1], Z], ...P.way.westUp.slice(2)], { speed: SPEED.walk });
    } else s.walk([[206.3, 274.3, Z], ...P.way.westUp.slice(1)], { speed: SPEED.walk });
    s.walk([[P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), P.gazit.door, P.gazit.inside], { speed: SPEED.walk });
  };
  toGazit(w, 0, null);
  for (let i = 0; i < NB; i++) toGazit(B[i], i + 1, TENDERS.includes(i) ? tools[i] : null);

  // ---------------------------------------------------------------------------------------------- the lowering (evening)
  const L0 = W.lock;
  // the one who sinks it at the locking: out of Beit HaMoked by the wicket and back in ⚙
  const mk = P.moked;
  // he lowers it from the axle's south side: the south rim pulled down hand over hand (people's windlass, its phase from
  // the wheel's angle as the kiyor sinks)
  const toWheel = [mk.wicket, mk.wicketOut, [mk.wicketOut[0], 378.5, Z], [mk.wicketOut[0] - 0.2, 371, Z], [205, 346, Z], [P.apronX, 340.2, Z], [P.apronX, 321, Z], [199.6, 309.2, Z], intoFrame[0], intoFrame[1], K.lowerStand];
  const lo = Script.from(L0 - 0.15 - walkMin(mk.wicketIn, toWheel), mk.wicketIn, 180, 'lowerer').exact();
  wicketPass.push([lo.t0 - 0.05, lo.t0 + 0.3]);
  lo.walk(toWheel, { speed: SPEED.walk });
  lo.until(L0, { pose: 'stand', heading: 90 });
  lo.until(L0 + LIFT, { pose: 'windlass', phase: lowerPhase, heading: 90 });
  lo.act(0.05, { pose: 'stand', heading: 90 });
  lo.walk([...[...toWheel].reverse().slice(1), mk.wicketIn], { speed: SPEED.walk });
  wicketPass.push([lo.tEnd - 0.35, lo.tEnd + 0.05]);

  // ---------------------------------------------------------------------------------------------- free props
  const items = [];
  const ready = W.midnight;          // the wood is ready by the ramp from midnight ⚙
  const pmPick = pmLogs(W.pm)?.pick;
  stack.forEach((st, j) => {
    const end = j >= CARRIERS.length * TRIPS + 2 ? (pmPick ? pmPick[j - CARRIERS.length * TRIPS - 2] : wrap(SP[1] + 600)) : wrap(st.pick ?? SP[1]);
    items.push({ name: st.name, show: [ready, end], keys: [{ t: ready, X: st.X, Y: st.Y, Z: st.Z, h: st.h }] });
  });
  for (const tool of tools) {
    const rest = tool.drop ?? SP[1] + 2;
    items.push({ name: tool.name, show: [wrap(rest), wrap(tool.pick ?? MU[0])], keys: [{ t: wrap(rest), X: tool.at[0], Y: tool.at[1], Z: tool.at[2], h: tool.h }] });
  }
  limbs.forEach((l, j) => {
    const keys = limbKeys[j].slice().sort((x, y) => x.t - y.t).map((k) => ({ ...k, t: wrap(k.t) }));
    items.push({ name: l.name, show: [wrap(MU[0] - 2.5), wrap(limbBurn[j] + LIMBS_BURN)], keys });
  });
  // the new wood as each load is thrown on (Tamid 2:3–5): the great pile is the altar builder's movable, built again
  // load by load (pileAt below, its inner ends touching the tapuach, Tamid 2:4); the fig wood on the incense pile shows
  // as the bundles laid there ⚙
  const woodEnd = pmLogs(W.pm)?.lay;
  let ni = 0;
  const greatLays = [];
  for (const [tl, which] of lay.slice().sort((a, b) => a[0] - b[0])) {
    const end = Number.isFinite(woodEnd) ? woodEnd : wrap(tl + WOOD_BURN);
    if (which === 'great') greatLays.push(tl);
    else {
      const g = A.incense;
      items.push({ name: BUNDLE, show: [wrap(tl), end], keys: [{ t: wrap(tl), X: (g.min[0] + g.max[0]) / 2 + jit(SEED, 0.15, 'ix', ni), Y: g.min[1] + 0.6 + 0.8 * ni, Z: g.max[2] + 0.03 + 0.08 * ni, h: 90 + 25 * ni }] });
      ni++;
    }
  }
  state.props.setPlan(items);

  // the great pile (world: altar.maarachah.great.pile build(f)): the night's pile raked down with its embers once the
  // limbs are moved aside (Tamid 2:2 — through the clearing and the heaping of the tapuach), then built again: each
  // load's share of the billets laid as it lands, the builder arranging it ⚙ (Tamid 2:3–4; Yoma 22a)
  const pile = { down: [CL[1] - 0.2, TP[0] + 0.6 * (TP[1] - TP[0])], lays: greatLays, n: Math.max(1, greatLays.length) };
  // the tapuach: settling through the night from sunset, the morning's ash raked onto it through the tapuach event ⚙
  const tap2 = { settle0: ctx.time?.zmanim?.sunset ?? 1020, heap: [TP[0], TP[1]] };
  const out = {
    W: w, B, L: lo, MU, TH, CL, TP, GP, SP, pile, tap: tap2, base: b,
    tWheel: wrap(tWheel), tLower: wrap(L0), tPour: wrap(tPour), tRun: wrap(tRun), tLight: wrap(tLight), tGo: wrap(tGo),
    panOut: [wrap(tPanUp), wrap(tPanBack)],
    wicket: wicketPass.map(([a, b]) => [wrap(a), wrap(b)]),
    twoLogs: [[wrap(tTwoLogs), wrap(tTwoLogs + TWO_LOGS_BURN)]],
    coals: [wrap(tPour), wrap(tPour + COALS_GLOW)],
    fireWin: [wrap(MU[0] - 0.5), wrap(SP[1] + 0.5)],
    fireKeys: fireKeys(MU[0] - 0.5, CL, TP, GP, SP, tLight, shabbat),
    // Shabbat: the bigger incense pile burns down to the builder's level after the window (Tamid 2:5) ⚙
    incenseExt: shabbat ? [wrap(SP[1] + 0.5), wrap(SP[1] + 0.5 + SHABBAT_INCENSE_EASE)] : null,
    keys: { muchni: `muchni:${Math.round(tWheel * 10)}`, lower: `lower:${Math.round(L0 * 10)}`, warn: `warn:${Math.round(tGo * 10)}`, pour: `pour:${Math.round(tPour * 10)}`,
      run: `run:${Math.round(CL[0] * 10)}`, light: `light:${Math.round(tLight * 10)}` },
    G,
  };
  // the afternoon's two logs, taken from the stack and laid on the great pile by the two extra kohanim of the afternoon
  // tamid (Yoma 2:5) — the same times as tamid-afternoon's bearers (g2/tamid.js pmLogs)
  const pm = pmLogs(W.pm);
  if (pm) out.twoLogs.push([pm.lay, wrap(pm.lay + TWO_LOGS_BURN)]);
  state.plan = out;
  state.planGen = sim.generation;
  return out;
}

/** sanctifying hands and feet at the kiyor under a spigot: "he places his right hand on his right foot and his left
 *  hand on his left foot and sanctifies", standing (Zevachim 19b — people's 'kiddush', the water rubbed over them) */
function sanctify(s, heading, min = 0.55) {
  // turned into his stance standing, then down: he stands 50° off the radial (g2/places.js KID), not crouched as he turns
  s.act(0.06, { pose: 'stand', heading });
  s.act(Math.max(0.25, min) - 0.06, { pose: 'kiddush', phase: { cycle: 1 / 0.35 }, heading });
  s.act(0.05, { pose: 'stand', heading });
}

function pickTool(s, tool) {
  s.walk([tool.stand], { speed: SPEED.walk });
  s.act(0.1, { pose: 'bow', phase: [0, 0.45], heading: 270 });
  tool.pick = s.now();
  s.act(0.08, { pose: 'bow', phase: [0.7, 1], heading: 270, props: [tool.name, null] });
}

function dropTool(s, tool) {
  s.act(0.1, { pose: 'bow', phase: [0, 0.45], heading: 270, props: [tool.name, null] });
  tool.drop = s.now();
  s.act(0.08, { pose: 'bow', phase: [0.7, 1], heading: 270 });
}

/** the shovels and forks lying side by side on the pavement west of the tables and of the way past them, east of the
 *  amah's open channel — with the service vessels (Shekalim 6:4) ⚙; each taken up from the east */
function toolSpots(P) {
  const t = P.tables.silver;
  const out = [];
  const x0 = Math.max(200.8, t.min[0] - 4.05), y = t.max[1] + 0.6;
  for (let i = 0; i <= NB; i++) {
    const name = i === NB || i % 2 === 1 ? 'fork' : 'magrefah';
    const X = x0 + 0.19 * i;
    out.push({ name, at: [X, y, 16.02], h: jit(SEED, 4, 'th', i), stand: [203.3, y - 1.4 + 0.35 * i, 16], pick: null, drop: null });
  }
  return out;
}

/**
 * The wood east of the ramp's foot (⚙ place): two piles, each the two thin gizrin of Moshe's measure at the bottom — an
 * amah square, as thick as a se'ah's strickle (Zevachim 62b; the 'log' board), the morning's and the afternoon's
 * (Yoma 2:5) — and the pile's branches of fig, walnut and oil-wood on them (Tamid 2:3; people's gizrin_branch, r 6 cm),
 * three side by side in two layers, taken from the top.
 */
function stackSpots() {
  const out = [];
  const n = CARRIERS.length * TRIPS + 4;          // the carriers', the morning's two logs, the afternoon's two (Yoma 2:5)
  const per = Math.ceil(n / 2), nb = CARRIERS.length * TRIPS;
  const BOARD = 0.075, BR = 0.25;                 // amot: a board's thickness; a branch's (0.12 m)
  for (let j = 0; j < n; j++) {
    const pile = j % 2, level = per - 1 - Math.floor(j / 2);     // taken from the top
    const X = 230.9 + jit(SEED, 0.06, 'sx', j), Y0 = 276.7 + pile * 2.15 + jit(SEED, 0.06, 'sy', j);
    if (j >= nb) {
      out.push({ name: 'log', X, Y: Y0, Z: 16 + BOARD * level, h: 90 + jit(SEED, 7, 'sh', j), stand: [X - 1.3, Y0, 16], pick: null });
      continue;
    }
    const q = level - 2, layer = Math.floor(q / 3), pos = q % 3;   // above the two boards
    const Y = Y0 + (pos - 1) * 0.27 + (layer ? 0.135 : 0);
    out.push({ name: BRANCH, X, Y, Z: 16 + 2 * BOARD + layer * BR * 0.8, h: 90 + jit(SEED, 7, 'sh', j), stand: [X - 1.3, Y0, 16], pick: null });
  }
  return out;
}

/** the great pile at t (0 cleared … 1 built): 1 through the day and night; raked down over P.pile.down; rebuilt load by load */
function pileAt(P, t) {
  const b = P.base, u = b + since(t, b);
  const D = P.pile;
  if (u < D.down[0] || u >= b + 600) return 1;
  let f = 1 - smooth(D.down[0], D.down[1], u);
  if (u >= D.down[1]) {
    f = 0;
    for (let k = 0; k < D.lays.length; k++) f += smooth(D.lays[k], D.lays[k] + 0.6, u) / D.n;
  }
  return Math.max(0, Math.min(1, f));
}

/** the tapuach's size at t (world grow(f)): settled to TAPUACH_LOW from the evening to the morning ⚙; the ash raked up
 *  onto it again through the tapuach event (Tamid 2:2) */
function tapuachAt(P, t) {
  const T = P.tap, b = P.base, u = b + since(t, b);
  if (u < T.heap[0]) return TAPUACH_LOW;                          // from the muchni until the ash is raked up onto it
  if (u < b + 600) return TAPUACH_LOW + (1 - TAPUACH_LOW) * smooth(T.heap[0], T.heap[1], u);
  const len = wrap(b - T.settle0), e = since(t, T.settle0);       // overnight: from sunset to the muchni
  return e < len ? 1 - (1 - TAPUACH_LOW) * smooth(0, len, e) : 1;
}

/** the evening's limbs not consumed: on the pile, pushed to the sides, pushed back (Tamid 2:1, 2:5) ⚙ */
function leftoverLimbs(A) {
  const g = A.great, Zp = g.max[2] + 0.02, ZT = A.ZT + 0.04;
  const gx = (g.min[0] + g.max[0]) / 2, gy = (g.min[1] + g.max[1]) / 2;
  // the one limb still on the fire at dawn: altar-night's last small-hours limb, taken over at its spot ⚙
  const L = [
    { name: LIMB, pile: [gx - 1.6, gy + 2.2], h: 220, edge: [gx - 2.0, A.wk.N - 1.6], dir: [0, -1] },
    { name: 'limb', pile: [g.min[0] + 1.6, g.min[1] + 1.8], edge: [g.min[0] + 1.2, A.wk.S + 1.9], dir: [0, 1] },
    { name: 'limb_dofen', pile: [g.min[0] + 3.6, g.min[1] + 2.4], edge: [g.max[0] + 0.5, A.wk.S + 2.6], dir: [-0.4, 0.92] },
    { name: 'limb_foreleg', pile: [g.min[0] + 2.0, g.max[1] - 1.6], edge: [g.min[0] + 1.0, A.wk.N - 1.6], dir: [0, -1] },
    { name: 'limb', pile: [g.min[0] + 4.0, g.max[1] - 2.4], edge: [g.max[0] + 0.4, A.wk.N - 1.8], dir: [-0.4, -0.92] },
  ];
  return L.slice(0, 1).map((l, j) => {
    const [dx, dy] = l.dir;
    const pushTo = [l.edge[0] + dx * (Math.abs(l.pile[1] - l.edge[1]) - 2.6), l.edge[1] + dy * (Math.abs(l.pile[1] - l.edge[1]) - 2.6), ZT];
    return {
      name: l.name,
      pile: { X: l.pile[0], Y: l.pile[1], Z: Zp, h: l.h ?? 30 + 70 * j },
      edge: { X: l.edge[0], Y: l.edge[1], Z: ZT, h: 90 * j + 15 },
      // the fork-man stands across the limb from the pile while he pushes it out; behind it to push it back
      stand: [l.pile[0] + dx * 2.6, l.pile[1] - dy * 0.5 + (dy > 0 ? -3.4 : 3.4), ZT].map((v, q) => (q === 1 ? (dy > 0 ? Math.max(A.wk.S, v) : Math.min(A.wk.N, v)) : v)),
      behind: [l.edge[0] - dx * 1.4, l.edge[1] - dy * 1.4, ZT],
      pushTo: [pushTo[0] - dx * 1.4, pushTo[1] - dy * 1.4, ZT],
      dir: l.dir,
    };
  });
}

/** keyframes for a limb pushed ahead of the tender's fork from t0 to t1 (it slides from its edge spot toward the pile) */
function pushKeys(keys, l, t0, t1) {
  const n = 5;
  const a = l.edge, [dx, dy] = l.dir;
  const D = Math.hypot(l.pushTo[0] - l.behind[0], l.pushTo[1] - l.behind[1]);
  for (let q = 1; q <= n; q++) {
    const f = q / n;
    keys.push({ t: t0 + (t1 - t0) * f, X: a.X + dx * D * f, Y: a.Y + dy * D * f, Z: a.Z, h: a.h, lerp: true, dur: (t1 - t0) / n });
  }
}

/** a way across the altar top between two spots that keeps off the piles and the tapuach (along the walkway) ⚙ */
function pathOnTop(A, from, to) {
  const ZT = A.ZT;
  const north = (p) => p[1] > A.tap.center[1];
  if (north(from) === north(to)) return [[from[0], north(from) ? A.wk.N : A.wk.S, ZT], [to[0], north(to) ? A.wk.N : A.wk.S, ZT]];
  // across: by the east walkway
  return [[from[0], north(from) ? A.wk.N : A.wk.S, ZT], [A.wk.E, north(from) ? A.wk.N : A.wk.S, ZT], [A.wk.E, north(to) ? A.wk.N : A.wk.S, ZT], [to[0], north(to) ? A.wk.N : A.wk.S, ZT]];
}

// ------------------------------------------------------------------------------------------------ fires, coals, cues

/**
 * The fire's strength through the morning (keys on the clock unwrapped from the window's start, a0 = muchni.t0 − 0.5): the
 * night's embers, raked down, the new piles lit ⚙. Each curve starts at a0 from the level the fire has there — the
 * embers altar-night's wants sink to (EMBERS), the builder's levels of the two small piles — so nothing jumps.
 */
function fireKeys(a0, CL, TP, GP, SP, tLight, shabbat) {
  return {
    great: [[a0, EMBERS.great], [CL[0], EMBERS.great], [CL[1], 0.4], [TP[1], 0.3], [GP[1], 0.35], [tLight + 0.2, 0.35], [tLight + 1.4, 1]],
    inner: [[a0, EMBERS.inner], [CL[0], EMBERS.inner], [CL[1], 0.3], [TP[1], 0.22], [GP[1], 0.3], [tLight + 0.2, 0.3], [tLight + 1.4, 0.9]],
    // five se'ah of coals; on Shabbat eight, for the two bowls of frankincense (Tamid 2:5)
    incense: [[a0, FIRE_DEFAULT.incense], [CL[0], 0.25], [GP[1], 0.2], [tLight + 0.2, 0.2], [tLight + 1.4, shabbat ? SHABBAT_INCENSE : 0.6]],
    kiyum: [[a0, FIRE_DEFAULT.kiyum], [CL[0], 0.7], [SP[1], 0.75]],
  };
}

function curveAt(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (u <= keys[i][0]) {
      const [a, va] = keys[i - 1], [b, vb] = keys[i];
      return va + (vb - va) * smooth(a, b, u);
    }
  }
  return keys[keys.length - 1][1];
}

/** this module's fire wants (sim.fireWant): the four piles through its window; on Shabbat the incense pile after it */
function fires(P, t, sim) {
  if (within(t, P.fireWin[0], P.fireWin[1])) {
    // the keys' clock, unwrapped from the window's start (it begins half a minute before the muchni)
    const a0 = P.MU[0] - 0.5, u = a0 + since(t, a0);
    for (let i = 0; i < FIRE_KEYS.length; i++) sim.fireWant(FIRES[FIRE_KEYS[i]], curveAt(P.fireKeys[FIRE_KEYS[i]], u));
    return;
  }
  // Shabbat: the eight se'ah of the incense pile burn down slowly to the builder's level
  const X = P.incenseExt;
  if (X && within(t, X[0], X[1])) {
    sim.fireWant(FIRES.incense, FIRE_DEFAULT.incense + (SHABBAT_INCENSE - FIRE_DEFAULT.incense) * (1 - smooth(0, SHABBAT_INCENSE_EASE, since(t, X[0]))));
  }
}

/** the heaped coals glowing on the pavement east of the ramp (Tamid 1:4) — this module's own small fire (added at 0) */
function coals(ctx, S, P, t, sim) {
  let v = 0;
  if (within(t, P.coals[0], P.coals[1])) {
    const e = since(t, P.coals[0]);
    v = COALS_PEAK * smooth(0, 0.15, e) * (1 - smooth(0.15 * COALS_GLOW, COALS_GLOW, e));
  }
  S.coalsLevel = v;
  if (!(v > 0)) return;
  if (!S.coals && ctx.fx?.add) {
    const c = S.P.deshen.c;
    // a small hearth kept low: the coal bed glows, its tongues stay a few centimetres high ('embers' requested from fx)
    try { S.coals = ctx.fx.add({ id: COALS_FIRE, kind: 'hearth', pos: [c[0] - 0.2, c[1], c[2] + 0.5], size: 0.32, intensity: 0, schedule: 'always', smoke: true, light: false }); } catch { S.coals = null; }
  }
  sim.fireWant(COALS_FIRE, v);
}

function cues(ctx, S, P, sim) {
  const K = S.P.kiyor, A = S.P.altar;
  const say = (key, tc, text, at, range, id, dur = 6) => {
    if (!crossed(S, tc)) return;
    cueAt(S, key, tc, () => { if (playerNear(ctx, at, range)) sim.caption(text, { id, duration: dur }); });
  };
  if (crossed(S, P.tWheel)) {
    cueAt(S, P.keys.muchni, P.tWheel, () => {
      sim.sound('muchni', [K.c[0], K.axleY, 18]);
      if (playerNear(ctx, K.c, CAPTION_RANGE)) {
        sim.caption({ en: 'The wood of Ben Katin\'s muchni sounds as the kiyor rises from its well — the waiting kohanim say: "The time has come!" (Tamid 1:4; heard as far as Yericho, Tamid 3:8)', he: 'הִגִּיעַ עֵת' }, { id: 'muchni', duration: 7 });
      }
    });
  }
  if (crossed(S, P.tLower)) cueAt(S, P.keys.lower, P.tLower, () => sim.sound('muchni', [K.c[0], K.axleY, 18], { gain: 0.8 }));
  say(P.keys.warn, P.tGo, { en: '"Take care not to touch the vessel until you have sanctified your hands and feet at the kiyor — the pan is in the corner between the ramp and the altar, west of the ramp." No one goes with him, and he carries no lamp (Tamid 1:4)', he: 'הִזָּהֵר שֶׁמָּא תִגַּע בַּכְּלִי עַד שֶׁתְּקַדֵּשׁ יָדֶיךָ וְרַגְלֶיךָ מִן הַכִּיּוֹר' }, P.G, NEAR, 'terumat-warning', 8);
  say(P.keys.pour, P.tPour, { en: 'He heaps the coals on the pavement three tefachim from the ramp — where the birds\' crops and the ashes of the inner altar and the Menorah are put (Tamid 1:4)', he: 'צָבַר אֶת הַגֶּחָלִים עַל גַּבֵּי הָרִצְפָּה' }, S.P.deshen.c, NEAR, 'terumat-pour');
  const tR = wrap(P.CL[0] + CUE_LEAD);
  if (crossed(S, tR)) {
    cueAt(S, P.keys.run, tR, () => {
      sim.sound('footsteps', [P.G[0] - 4, 300, 16], { steps: 16, pace: 3 });
      if (playerNear(ctx, A.tap.center, 70)) sim.caption({ en: 'Seeing him come down, his brothers run: they hurry to sanctify at the kiyor, take the shovels and the forks and go up to the top of the altar (Tamid 2:1)', he: 'רָאוּהוּ אֶחָיו שֶׁיָּרַד, וְהֵם רָצוּ וּבָאוּ' }, { id: 'clearing-altar', duration: 7 });
    });
  }
  say(P.keys.light, P.tLight, { en: 'Both piles are lit; the evening\'s limbs are back in the fire — then they go down to Lishkat HaGazit (Tamid 2:5)', he: 'הִצִּיתוּ שְׁתֵּי הַמַּעֲרָכוֹת בָּאֵשׁ' }, A.tap.center, 70, 'second-pile');
}

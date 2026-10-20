// The showbread on Shabbat (Menachot 11:7, 11:9; Shekalim 6:4; Sukkah 5:7–8, 56b; Yoma 21a, 33a–34a; Tamid 2:5;
// Rambam Temidin uMusafin 4:9–12). One per-date plan shared by shabbat-showbread (the new bread brought in, the change at
// the Shulchan, the old bread on the gold table, the bazichin burned) and shabbat-mishmar (the division between the
// watches), so the eight kohanim of the change and the bread itself pass from one module to the other without a seam:
// a figure's Script in one module ends exactly where and when its Script in the other begins (same pool seeds).
//
// The eight (Menachot 11:7; TuM 5:4): four bring in — I0/I1 the two stacks, I2/I3 the two bowls of frankincense; four
// go in before them to take out — O0/O1 the stacks, O2/O3 the bowls. "Those bringing in stand on the north facing south,
// those taking out on the south facing north" — הַנִּכְנָסִין / הַיּוֹצְאִין there are the bringers and the takers, not the
// watches. ⚙ That the bringers are of the incoming watch and the takers of the outgoing is a reconstruction: the new
// week's bread is the incoming watch's service (the incoming do the bazichin and the afternoon tamid, Sukkah 56b), and
// at the division the incoming take the north "for they are ready for the service" (Sukkah 5:8; TuM 4:12) — the side
// the bringers-in stand on. The takers-out go in first; the bowls are lifted off, then the old stacks are
// drawn out as the new are slid on, "the handbreadth of one beside the handbreadth of the other"; then the new bowls are
// set on. The old bread and bowls go on the gold table in the Ulam (the new waited on the marble one). After the musafim
// (Abaye's order, Yoma 33a — the swap event already follows the musaf) two of the INCOMING carry the old bowls to the
// altar and burn them on the incense pile (Sukkah 56b; Rambam TuM 4:11), salting the frankincense (TuM 4:10); the empty
// bowls go back to Lishkat HaKelim ⚙. Only then is the bread eaten (TuM 4:10): the incoming divide their six loaves in
// the north, the outgoing their six in the south (Sukkah 5:8; TuM 4:12).
import { Script, SPEED, jit } from '../g2/lib.js';
import { rampUp, rampDown, circuit } from '../g2/places.js';
import { SEEDS } from '../g2/tamid.js';
import { g6places, evWin, Z, ZH, wrap } from './common.js';

/** pool seeds: slot i of a module's pool with this seed is the same man in both modules */
export const SEED_OUT = 0x6f75;           // the outgoing watch's men in these scenes ⚙
export const SEED_IN = SEEDS.shabbatIn;   // the incoming watch: the same faces as G2's Shabbat afternoon crew
export const N_SIDE = 15;                 // men in each group at the division (the schedule's 30 — a staging number)
const STACK = 'loaves_todah';             // stand-in for a stack of six showbread loaves (requested: 'showbread_stack')
const BOWL = 'bazach';                    // a bowl (bazach) of frankincense
const CARRY = 1.0;                        // m/s with the bread ⚙

/** the plan for the current date (null when it is not Shabbat); cached per runtime generation */
export function breadPlan(ctx, sim) {
  const key = sim.generation;
  const c = ctx.__g6bread;
  if (c && c.key === key) return c.plan;
  let plan = null;
  try { plan = build(ctx, sim); } catch (e) { console.warn('[sim] g6 bread plan failed', e); }
  ctx.__g6bread = { key, plan };
  return plan;
}

function build(ctx, sim) {
  const zm = ctx.time?.zmanim || {};
  const sr = zm.sunrise ?? 356;
  const sw = evWin(sim, 'showbread-swap', sr);
  if (!sw) return null;
  const T = sw[0];
  const warm = evWin(sim, 'bread-warm', sr) || [T + 7, T + 12];
  const baz = evWin(sim, 'bazichin', sr) || [T + 10, T + 16];
  const div = evWin(sim, 'showbread-divided', sr) || [T + 16, T + 40];
  const D0 = div[0], D1 = div[1];
  const G = g6places(ctx), P = G.P, H = G.heichal, B = G.bakery, K = P.kelim;
  const warn = [];

  // ---- recurring ways
  const gz = P.gazit;
  const gazitToApron = [gz.door, ...P.way.gazitToNW];                       // → the apron north of the Ulam steps
  const apronToGazit = [...P.way.gazitToNW].reverse().slice(1).concat([gz.door, gz.inside]);
  const intoUlamN = (y) => [...H.stepsN(y), [169, y, ZH]];
  const outOfUlam = (y) => [[169, y, ZH], ...[...H.stepsN(y)].reverse()];
  const throughGate = [H.gateE, H.gateW];
  const backThroughGate = [H.gateW, H.gateE];
  // around the Shulchan (its long axis E–W, 2½ amot off the north wall): F the front rows at its long sides (the stack-men
  // at the change); B where the second pair of each side waits — the outgoing stack-men 2 amot back on the south, the
  // incoming bowl-men out past the table's corners on the north (the wall is 2½ amot off); S where the bowl-men (south)
  // and the stack-men (north) step aside to, past the ends. Each man ≥ 1.2 amot from the next, so the two rows at the
  // table read from the east ⚙
  const sh = H.sh;
  const xW = sh.min[0] + 0.08, xE = sh.max[0] - 0.08;
  const N = { F: [[xW, sh.max[1] + 0.55, ZH], [xE, sh.max[1] + 0.55, ZH]], B: [[sh.min[0] - 0.95, sh.max[1] + 1.35, ZH], [sh.max[0] + 0.8, sh.max[1] + 1.45, ZH]], S: [[sh.min[0] - 1.3, sh.max[1] + 0.3, ZH], [sh.max[0] + 1.3, sh.max[1] + 0.3, ZH]] };
  const S = { F: [[xW, sh.min[1] - 0.5, ZH], [xE, sh.min[1] - 0.5, ZH]], B: [[xW, sh.min[1] - 2.0, ZH], [xE, sh.min[1] - 2.0, ZH]], S: [[sh.min[0] - 1.45, sh.min[1] - 1.2, ZH], [sh.max[0] + 1.45, sh.min[1] - 1.4, ZH]] };
  const DRAW = 0.8;                                           // amot the old stacks are drawn out to the south ⚙
  const stackX = [H.sxW, H.sxE];
  // the Ulam tables (against the Heichal's front wall): stand east of them / beside them ⚙
  const mt = H.marble, gt = H.gold;
  // at the marble table: the stack-men on its north and east, the bowl-men on its south and south-east corner,
  // >= 1.2 amot apart, each facing it; the one on the north (by the Heichal's wall) leaves past the one on the east ⚙
  const mSpots = [[mt.min[0] + 0.55, mt.max[1] + 1.0, ZH], [mt.max[0] + 0.8, mt.min[1] + 0.3, ZH], [mt.min[0] + 0.55, mt.min[1] - 1.0, ZH], [mt.max[0] + 0.7, mt.min[1] - 0.95, ZH]];
  const mC = [(mt.min[0] + mt.max[0]) / 2, (mt.min[1] + mt.max[1]) / 2];
  const mFace = mSpots.map((p) => ((Math.atan2(mC[0] - p[0], mC[1] - p[1]) * 57.2958) + 360) % 360);
  // at the gold table: O0 on its south (the west stack), O1 at its south-east corner (the east stack), O2 on its north
  // (the west bowl), O3 at its north-east corner; ≥ 1.6 amot apart, each facing the table, its east side open toward
  // the Ulam's open front (the view) ⚙
  const gSpots = [[gt.min[0] + 0.55, gt.min[1] - 1.0, ZH], [gt.max[0] + 0.45, gt.min[1] - 0.5, ZH], [gt.min[0] + 0.55, gt.max[1] + 1.0, ZH], [gt.max[0] + 0.7, gt.max[1] + 0.95, ZH]];
  const gC = [(gt.min[0] + gt.max[0]) / 2, (gt.min[1] + gt.max[1]) / 2];
  const gFace = gSpots.map((p) => ((Math.atan2(gC[0] - p[0], gC[1] - p[1]) * 57.2958) + 360) % 360);
  const onTable = (b, k) => [b.min[0] + (b.max[0] - b.min[0]) * [0.27, 0.73, 0.27, 0.73][k], (b.min[1] + b.max[1]) / 2 + [0.05, -0.05, 0.05, -0.05][k], b.max[2] + 0.005];
  // the bowls on top of the stacks on the Ulam tables: a stand-in tray's height ⚙
  const bowlOn = (b, k) => { const p = onTable(b, k - 2); return [p[0], p[1], p[2] + 0.17]; };

  // ================================================================== the incoming: the new bread brought in
  const items = { swap: [], div: [] };
  const I = [], O = [];
  const tLeaveI = T - 6.3;
  const hallWait = [[B.hall[0] - 0.4, B.hall[1] + 0.9, Z], [B.hall[0] - 1.6, B.hall[1] + 1.3, Z], [B.hall[0] + 0.6, B.hall[1] + 1.8, Z], [B.hall[0] - 2.6, B.hall[1] + 0.4, Z]];
  const toBakery = [gz.door, P.way.gazitToNW[0], P.way.gazitToNW[1], P.way.gazitToNW[2], [200, 386.6, Z], B.gateOut, B.gateIn];
  const doorway = [B.door[0], B.door[1] - 1.45, Z];                         // a step inside the chamber's door ⚙
  const tPick = [], tPlaceNew = [];
  for (let k = 0; k < 4; k++) {
    const s = Script.from(tLeaveI + 0.08 * k, gz.inside, 90, `in${k}`);
    s.walk([...toBakery, hallWait[k]], { speed: SPEED.walk });
    // one at a time through the chamber's door: the stacks, then the bowls, from Beit Garmu's table ⚙ (Yoma 38a)
    const t0 = T - 5.1 + 0.4 * k;
    s.until(t0, { pose: 'stand', face: B.door, sway: 10, seed: SEED_IN + k });
    s.walk([B.door, doorway], { speed: SPEED.slow });
    s.act(0.1, { pose: 'bow', phase: [0, 0.42], heading: 180 });
    tPick[k] = s.now();
    const props = [k < 2 ? STACK : BOWL, null];
    const pose = k < 2 ? 'carry' : 'stand';
    s.act(0.1, { pose: 'bow', phase: [0.7, 1], heading: 180, props });
    s.walk([B.door, hallWait[k]], { speed: SPEED.slow, pose: k < 2 ? 'carry_walk' : 'walk', props });
    s.until(T - 3.55 + 0.05 * k, { pose, heading: 230, sway: 6, seed: SEED_IN + 10 + k, props });
    // out through the Moked gate, along the west of the slaughterhouse, up the Ulam steps to the marble table
    const y = 336.2 + 0.7 * (k % 2) - 0.35 * (k >> 1);
    s.walk([B.gateIn, B.gateOut, [200, 386.6, Z], [197.6, 346, Z], [P.apronX, 341.2, Z], ...intoUlamN(y), ...(k === 0 ? [[mt.max[0] + 1.1, mt.max[1] + 1.3, ZH]] : []), mSpots[k]], { speed: CARRY, pose: k < 2 ? 'carry_walk' : 'walk', props });
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], face: k < 2 ? onTable(mt, k) : bowlOn(mt, k), props });
    tPlaceNew[k] = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], face: onTable(mt, k % 2) });
    I.push(s);
  }
  // they wait by the marble table; "four went in before them" — then take the bread up again and go in after them
  const tTakeNew = T - 0.95;
  const tPickNew = [];
  for (let k = 0; k < 4; k++) {
    const s = I[k];
    s.until(tTakeNew + 0.04 * k, { pose: 'stand', heading: mFace[k], sway: 12, seed: SEED_IN + 20 + k });
    s.act(0.1, { pose: 'bow', phase: [0, 0.42], face: onTable(mt, k % 2) });
    tPickNew[k] = s.now();
    const props = [k < 2 ? STACK : BOWL, null];
    s.act(0.1, { pose: 'bow', phase: [0.7, 1], face: onTable(mt, k % 2), props });
    const dest = k < 2 ? N.F[k] : N.B[k - 2];
    const behindRow = k === 2 ? [[sh.max[0] + 1.0, sh.max[1] + 1.85, ZH], [sh.min[0] - 0.2, sh.max[1] + 1.95, ZH]] : [];
    s.walk([...(k === 0 ? [[mt.max[0] + 1.0, mt.max[1] + 1.4, ZH]] : []), [168.6, 334.6 + 0.4 * k, ZH], ...throughGate, ...H.toNorth, ...behindRow, dest], { speed: SPEED.slow, pose: k < 2 ? 'carry_walk' : 'walk', props });
    s.until(T + 0.05, { pose: k < 2 ? 'carry' : 'stand', heading: 180, props });
  }
  // the new bread on the marble table from its placing until it is taken up
  for (let k = 0; k < 4; k++) {
    const at = k < 2 ? onTable(mt, k) : bowlOn(mt, k);
    items.swap.push({ name: k < 2 ? STACK : BOWL, show: [tPlaceNew[k], tPickNew[k]], keys: [{ t: tPlaceNew[k], X: at[0], Y: at[1], Z: at[2], h: 90 }] });
  }

  // ================================================================== the outgoing go in before them
  const tLeaveO = T - 2.75;
  for (let k = 0; k < 4; k++) {
    const s = Script.from(tLeaveO + 0.07 * k, gz.inside, 90, `out${k}`);
    // the stack-men behind, the bowl-men in front (the bowls come off first) ⚙
    const dest = k < 2 ? S.B[k] : S.F[k - 2];
    const y = 326.4 + 0.65 * (k % 2) + 0.3 * (k >> 1);
    s.walk([...gazitToApron, ...H.stepsS(y), [169, y, ZH], [164.6, 329.4, ZH], [H.gateW[0], 329.6, ZH], ...H.toSouth, dest], { speed: SPEED.walk });
    if (s.now() > T + 0.5) warn.push(`out${k} late at the table`);
    s.until(T + 0.6, { pose: 'stand', heading: 0, sway: 4, seed: SEED_OUT + k });
    O.push(s);
  }

  // ================================================================== the change (Menachot 11:7) ⚙ minutes
  const tLift = T + 0.6, tSlide = [T + 1.45, T + 2.25], tBowlsOn = T + 2.75, tOut = T + 3.05;
  // the outgoing bowl-men lift the bowls off the stacks and step aside
  for (let j = 0; j < 2; j++) {
    const s = O[2 + j], ph = [BOWL, null];
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], heading: 0 });
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 0, props: ph });
    s.shift(S.S[j], 0.18, { pose: 'walk', heading: 0, props: ph });
    s.until(tOut + 0.1 * j, { pose: 'stand', heading: j ? 330 : 30, props: ph });
  }
  // the outgoing stack-men step up, take hold, draw the old stacks out to the south
  for (let j = 0; j < 2; j++) {
    const s = O[j];
    s.until(tLift + 0.46, { pose: 'stand', heading: 0, sway: 3, seed: SEED_OUT + 5 + j });
    s.shift(S.F[j], 0.2, { pose: 'walk', heading: 0 });
    s.until(tSlide[0], { pose: 'semichah', heading: 0 });
    s.shift([S.F[j][0], S.F[j][1] - DRAW, ZH], tSlide[1] - tSlide[0], { pose: 'carry', heading: 0, props: [STACK, null] });
    s.until(tOut + 0.12 * j, { pose: 'carry', heading: 0, props: [STACK, null] });
  }
  // the incoming stack-men slide the new stacks on, from the north, as the old come off
  for (let j = 0; j < 2; j++) {
    const s = I[j];
    s.until(tSlide[0], { pose: 'carry', heading: 180, props: [STACK, null] });
    s.shift([N.F[j][0], N.F[j][1] - 0.3, ZH], tSlide[1] - tSlide[0], { pose: 'carry', heading: 180, props: [STACK, null] });
    s.act(0.12, { pose: 'bow', phase: [0.15, 0.4], heading: 180 });
    s.shift(N.S[j], 0.2, { pose: 'walk', heading: 180 });
    s.until(tOut + 0.25 + 0.08 * j, { pose: 'stand', heading: j ? 210 : 150 });
  }
  // the incoming bowl-men step up and set the new bowls on the stacks
  for (let j = 0; j < 2; j++) {
    const s = I[2 + j], ph = [BOWL, null];
    s.until(tSlide[1] + 0.36, { pose: 'stand', heading: 180, props: ph });
    s.shift([stackX[j] + (j ? 0.15 : -0.15), N.F[j][1], ZH], 0.2, { pose: 'walk', heading: 180, props: ph });
    s.act(0.12, { pose: 'bow', phase: [0, 0.38], heading: 180, props: ph });
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 180 });
    s.until(tOut + 0.2 + 0.08 * j, { pose: 'stand', heading: 180 });
  }
  if (I[2].now() > tOut + 0.4) warn.push('bowls late');

  // ================================================================== the old bread to the gold table (Menachot 11:7)
  const tPlaceOld = [];
  const goOrder = [0.12, 0.06, 0.18, 0];             // the nearest to the way out first ⚙
  for (let k = 0; k < 4; k++) {
    const s = O[k];
    const props = [k < 2 ? STACK : BOWL, null];
    const y = 327.6 - 0.55 * k;
    s.until(tOut + 0.14 + goOrder[k], { pose: k < 2 ? 'carry' : 'stand', heading: 0, props });
    const round = k === 0 ? [[167.6, 325.6, ZH], [167.6, 321.4, ZH], [165.0, 321.1, ZH]] : k === 1 ? [[167.3, 325.4, ZH], [166.9, 323.2, ZH]] : [];
    s.walk([[134.5, 335.0 - 0.3 * k, ZH], [141, 333.0 - 0.4 * k, ZH], [151.5, y, ZH], [164.8, y - 0.4, ZH], ...round, gSpots[k]], { speed: SPEED.slow, pose: k < 2 ? 'carry_walk' : 'walk', props });
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], face: k < 2 ? onTable(gt, k) : bowlOn(gt, k), props });
    tPlaceOld[k] = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], face: onTable(gt, k % 2) });
  }
  // the four who took the bread out stay by it (bread-warm: participants); one lays his hand on the loaves ⚙
  const tTouch = warm[0] + 0.6;
  const B0 = baz[0];
  const aside = [null, null, [gt.min[0] + 0.4, gt.max[1] + 2.9, ZH], [gt.max[0] + 1.5, gt.max[1] + 4.2, ZH]];
  for (let k = 0; k < 4; k++) {
    const s = O[k];
    let h = gFace[k];
    if (k === 0) {
      s.until(tTouch - 0.15, { pose: 'stand', heading: h, sway: 10, seed: SEED_OUT + 30 });
      s.act(0.45, { pose: 'semichah', face: onTable(gt, 0) });
      s.act(0.1, { pose: 'stand', face: onTable(gt, 0) });
    }
    if (aside[k]) {
      // make room at the table's north for the two of the incoming who come for the bowls ⚙
      s.until(Math.max(s.now(), B0 - 0.85), { pose: 'stand', heading: h, sway: 10, seed: SEED_OUT + 35 + k });
      s.shift(aside[k], 0.22, { pose: 'walk', heading: h });
      h = ((Math.atan2(gC[0] - aside[k][0], gC[1] - aside[k][1]) * 57.2958) + 360) % 360;
    }
    // idling: a few changes of stance and a small turn while they wait for the frankincense ⚙
    const tA = warm[0] + 2.2 + 0.7 * k;
    s.until(Math.max(s.now(), tA), { pose: 'stand', heading: h, sway: 12, seed: SEED_OUT + 40 + k });
    // (no sway at the hand-over to shabbat-mishmar's Script, which starts from this heading at D0)
    s.until(D0 - 0.3, { pose: 'stand', heading: h + (k % 2 ? 15 : -12), sway: 10, seed: SEED_OUT + 50 + k });
    s.until(D0, { pose: 'stand', heading: h + (k % 2 ? 15 : -12), turn: 0.2 });
  }

  // ================================================================== the incoming: two leave, two stay for the bowls
  for (let j = 0; j < 2; j++) {
    const s = I[j];
    const y = 334.8 + 0.7 * j;
    s.until(tOut + 0.45 + 0.1 * (1 - j), { pose: 'stand', heading: j ? 210 : 150 });
    s.walk([...H.toNorth.slice().reverse(), ...backThroughGate, ...outOfUlam(y), ...apronToGazit], { speed: SPEED.walk });
  }
  // I2, I3: in the Ulam by the gold table until the frankincense is to be burned after the musafim
  const ulamWait = [[165.6, 327.6, ZH], [169.6, 327.4, ZH]];
  for (let j = 0; j < 2; j++) {
    const s = I[2 + j];
    s.until(tOut + 0.55 + 0.1 * j, { pose: 'stand', heading: 180 });
    s.walk([...H.toNorth.slice().reverse(), ...backThroughGate, ulamWait[j]], { speed: SPEED.slow });
    s.until(B0 - 0.55 - 0.05 * j, { pose: 'stand', face: H.goldTop, sway: 14, seed: SEED_IN + 60 + j });
    s.walk([gSpots[2 + j]], { speed: SPEED.slow });
  }

  // ================================================================== the bazichin (Sukkah 56b; Rambam TuM 4:10–11)
  const tTakeBaz = [], tPour = [];
  const A = P.altar, R = P.ramp, ZT = A.ZT;
  const pileC = [(A.incense.min[0] + A.incense.max[0]) / 2, (A.incense.min[1] + A.incense.max[1]) / 2, ZT];
  const atPile = [[pileC[0] - 0.4, A.incense.max[1] + 1.6, ZT], [pileC[0] + 1.9, A.incense.max[1] + 1.35, ZT]];
  for (let j = 0; j < 2; j++) {
    const s = I[2 + j], ph = [BOWL, null];
    s.until(B0 + 0.05 + 0.08 * j, { pose: 'stand', face: bowlOn(gt, 2 + j) });
    s.act(0.1, { pose: 'bow', phase: [0, 0.42], face: bowlOn(gt, 2 + j) });
    tTakeBaz[j] = s.now();
    s.act(0.1, { pose: 'bow', phase: [0.7, 1], face: bowlOn(gt, 2 + j), props: ph });
    // out of the Ulam, down its steps, round the west and south of the altar to the ramp; up its east half; to the
    // right round the top (Zevachim 6:3) to the incense pile at the south-west ⚙
    const y = 325.8 - 0.7 * j;
    const ex = R.east + (j ? 0.55 : -0.45);
    s.walk([[169, y, ZH], ...[...H.stepsS(y)].reverse(), [199.7, 309.4, Z], [202.6, 296, Z], [206.3, 274.3, Z], [ex, R.foot - 1.2, Z], ...rampUp(P, ex)], { speed: SPEED.walk, props: ph });
    s.walk([...circuit(P, 'se', 'nw'), [A.wk.W + 0.2 + 0.9 * j, pileC[1] + 4.2, ZT], atPile[j]], { speed: SPEED.walk, props: ph });
    // the frankincense "requires salt like the other offerings" (TuM 4:10): a pinch from the salt kept on the top ⚙
    s.act(0.1, { pose: 'stand', face: pileC, props: ph });
    s.act(0.28, { pose: 'salt', face: pileC, props: ph });
    tPour[j] = s.now() + 0.12;
    s.act(0.34, { pose: 'pour', phase: [0, 1], face: pileC, props: ph });
    s.act(0.25, { pose: 'stand', face: pileC, props: ph });
    // on round the SW corner (west of the pile, along the edge walk) to the ramp's head, down its west half (Zevachim
    // 6:3); the empty bowls back to Lishkat HaKelim ⚙
    const wx = R.west + (j ? 0.55 : -0.45);
    const edgeX = A.wk.W - 0.1;
    s.walk([[edgeX, atPile[0][1] - 0.2, ZT], [edgeX, A.wk.S - 0.1 + 0.5 * j, ZT], [wx, A.wk.S + 0.3 * j, ZT], ...rampDown(P, wx).slice(1)], { speed: SPEED.walk, props: ph });
    s.walk([[R.box.max[0] + 1.5, R.foot - 1.6, Z], [231.2, 273.2 + 0.8 * j, Z], [P.way.eastLine, 300, Z], [P.way.eastLine, 372, Z], [241.4, 384.4 - 0.5 * j, Z], [243.0, 385.2, 15], [245.2, 386, K.ZY], K.out, K.door, [K.in[0] + (j ? 0.8 : -0.8), K.in[1], K.ZY]], { speed: SPEED.walk, props: ph });
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], heading: 0, props: ph });
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 0 });
  }
  // the bread on the gold table (and the bowls until they are taken)
  for (let k = 0; k < 4; k++) {
    const at = k < 2 ? onTable(gt, k) : bowlOn(gt, k);
    const end = k < 2 ? D0 : tTakeBaz[k - 2];
    items.swap.push({ name: k < 2 ? STACK : BOWL, show: [tPlaceOld[k], end], keys: [{ t: tPlaceOld[k], X: at[0], Y: at[1], Z: at[2], h: 90 }] });
  }

  // ================================================================== the division (Sukkah 5:8; Rambam TuM 4:12)
  const NC = [235.6, 343.4, Z], SC = [237.4, 312.8, Z];       // the groups' centres in Ezrat Kohanim ⚙
  const lead = { N: [NC[0] + 2.1, NC[1] + 0.3, Z], S: [SC[0] + 2.0, SC[1] - 0.2, Z] };
  // a loose horseshoe opening to the leader, two rows, seeded jitter, kept off the altar's base and the duchan
  const ring = (c, ld, seed, n, xMin) => {
    const out = [];
    const base = Math.atan2(ld[0] - c[0], ld[1] - c[1]) * 57.2958;
    for (let i = 0; i < n; i++) {
      const row = i < 9 ? 0 : 1, m = row ? i - 9 : i, cnt = row ? n - 9 : 9;
      const a = (base + 180 + (-120 + (240 * (m + 0.5)) / cnt) + jit(seed, 7, 'a', i)) / 57.2958;
      const r = (row ? 3.5 : 2.25) + jit(seed, 0.25, 'r', i);
      let X = c[0] + Math.sin(a) * r, Y = c[1] + Math.cos(a) * r;
      X = Math.max(xMin, Math.min(241.4, X));
      out.push([X, Y, Z]);
    }
    return out;
  };
  const spotsN = ring(NC, lead.N, SEED_IN, N_SIDE - 1, 229.5), spotsS = ring(SC, lead.S, SEED_OUT, N_SIDE - 1, 233.9);
  // who stands where: slot 0 leads; the other three of the change keep near him ⚙
  const divI = [], divO = [];
  const faceTo = (p, q) => Math.atan2(q[0] - p[0], q[1] - p[1]) * 57.2958;
  const hOf = (p, q) => ((faceTo(p, q) % 360) + 360) % 360;

  // ---- I2, I3 come back from Lishkat HaKelim to the north group (their swap Scripts end at their spots at D0)
  for (let j = 0; j < 2; j++) {
    const s = I[2 + j], sp = spotsN[1 + j];          // slot i of the division stands at spots[i − 1]
    s.walk([K.door, K.out, [245.2, 386, K.ZY], [243.0, 385.2, 15], [241.4, 384.4, Z], [239.6, 352 + j, Z], sp], { speed: SPEED.walk });
    s.until(D0, { pose: 'stand', face: lead.N, sway: 8, seed: SEED_IN + 70 + j });
    if (s.now() > D0 + 0.01) warn.push(`I${2 + j} late for the division`);
  }
  // ---- the bread fetched from the gold table: O0 (south) at D0; I0 with I1 from the Gazit
  const tTakeOld = [];
  {
    // O0..O3 continue (their swap Scripts end at D0 by the gold table)
    for (let k = 0; k < 4; k++) {
      const s = Script.from(D0, O[k].cur, O[k].h, `divO${k}`);
      const sp = k === 0 ? lead.S : spotsS[k - 1];
      if (k === 0) {
        s.act(0.08, { pose: 'stand', face: onTable(gt, 0) });
        s.act(0.1, { pose: 'bow', phase: [0, 0.42], face: onTable(gt, 0) });
        tTakeOld[0] = s.now();
        s.act(0.1, { pose: 'bow', phase: [0.7, 1], face: onTable(gt, 0), props: [STACK, null] });
      } else s.act(0.28 + 0.05 * k, { pose: 'stand', face: gSpots[0] });
      const y = 324.4 - 0.5 * (k % 2) + 0.4 * (k >> 1);
      const props = k === 0 ? [STACK, null] : null;
      s.walk([...(k === 0 ? [[gt.min[0] + 2.5, gt.min[1] - 2.1, ZH]] : []), [169, y, ZH], ...[...H.stepsS(y)].reverse(), [199.7, 309.4 - 0.3 * k, Z], [202.6, 296, Z], [206.3, 274.3 - 0.4 * k, Z], [231.2, 273.2 + 0.5 * k, Z], [P.way.eastLine + 4.0 - 0.6 * k, 299, Z], sp], { speed: k === 0 ? CARRY : SPEED.walk * 0.85, pose: k === 0 ? 'carry_walk' : 'walk', props });
      divO[k] = s;
    }
    // I0 and I1 come out of the Gazit, up into the Ulam, I0 takes the incoming's stack; to the north
    for (let j = 0; j < 2; j++) {
      const s = Script.from(D0 - 1.75 + 0.06 * j, gz.inside, 90, `divI${j}`);
      const y = 335.2 + 0.7 * j;
      // they wait in the Ulam until the outgoing four have stepped away from the table ⚙
      const wait = [168.6 + 0.8 * j, 326.6 + 1.0 * j, ZH];
      s.walk([...gazitToApron, ...intoUlamN(y), wait], { speed: SPEED.walk });
      if (j === 0) {
        s.until(Math.max(s.now(), D0 + 0.5), { pose: 'stand', face: H.goldTop, sway: 8, seed: SEED_IN + 80 });
        s.walk([gSpots[1]], { speed: SPEED.slow });
        s.act(0.1, { pose: 'bow', phase: [0, 0.42], face: onTable(gt, 1) });
        tTakeOld[1] = s.now();
        s.act(0.1, { pose: 'bow', phase: [0.7, 1], face: onTable(gt, 1), props: [STACK, null] });
      } else s.until(Math.max(s.now(), D0 + 0.75), { pose: 'stand', face: H.goldTop, sway: 8, seed: SEED_IN + 81 });
      const sp = j === 0 ? lead.N : spotsN[0];
      const props = j === 0 ? [STACK, null] : null;
      const y2 = 331.8 + 0.8 * j;
      s.walk([[169, y2, ZH], ...[...H.stepsN(y2)].reverse(), [P.apronX, 338.4 + 0.6 * j, Z], [205, 339.6 + 1.6 * j, Z], ...(j === 0 ? [[232.6, 339.3, Z], [239.0, 340.4, Z]] : [[232.5, 341.6, Z]]), sp], { speed: j === 0 ? CARRY : SPEED.walk * 0.85, pose: j === 0 ? 'carry_walk' : 'walk', props });
      divI[j] = s;
    }
    // I2, I3: their division Scripts take over at D0 where the swap left them
    for (let j = 0; j < 2; j++) divI[2 + j] = Script.from(D0, I[2 + j].cur, I[2 + j].h, `divI${2 + j}`);
  }
  // the bread on the gold table between D0 and its taking (the swap module shows it until D0)
  for (let k = 0; k < 2; k++) {
    const at = onTable(gt, k);
    items.div.push({ name: STACK, show: [D0, tTakeOld[k]], keys: [{ t: D0, X: at[0], Y: at[1], Z: at[2], h: 90 }] });
  }
  // ---- the rest of each watch out of the Gazit: the incoming to the north, the outgoing round the ramp to the south.
  // Their ways stay on the court's pavement, so they stand at the authored height (exact: no floor query per frame for
  // twenty-two walkers at once — the peak of these modules' cost)
  for (let i = 4; i < N_SIDE; i++) {
    const n = i - 4;
    const sN = Script.from(D0 - 1.5 + 0.1 * n + 0.06 * Math.sin(n * 2.3), gz.inside, 90, `N${i}`).exact();
    sN.walk([...gazitToApron, [P.apronX + 0.3 * (n % 3), 338.6 + 0.4 * (n % 2), Z], [205, 341.2 + 0.45 * (n % 3), Z], [232.5, 341.4 + 0.45 * (n % 3), Z], spotsN[i - 1]], { speed: SPEED.walk * (0.92 + 0.12 * ((n * 7) % 5) / 4) });
    divI[i] = sN;
    const sS = Script.from(D0 - 2.4 + 0.1 * n + 0.05 * Math.cos(n * 1.7), gz.inside, 90, `S${i}`).exact();
    sS.walk([...gazitToApron, [P.apronX - 0.2 * (n % 3), 321, Z], [199.7 + 0.3 * (n % 2), 309.4, Z], [202.6, 296, Z], [206.3, 274.3 - 0.4 * (n % 3), Z], [231.2, 273.2 + 0.4 * (n % 3), Z], [P.way.eastLine - 0.3 * (n % 2), 299, Z], spotsS[i - 1]], { speed: SPEED.walk * (0.94 + 0.12 * ((n * 3) % 5) / 4) });
    divO[i] = sS;
  }
  // ---- the division itself: the leader holds the stack; each in turn comes up and receives a piece; they eat ⚙
  const division = (scripts, ld, spots, c, start, seed, modest) => {
    // round the horseshoe, the near row first (the spots run by angle within each row); "the modest drew back their
    // hands" (Yoma 39a) — two in each group do not come up ⚙
    const order = [];
    for (let i = 1; i < N_SIDE; i++) if (!modest.includes(i)) order.push(i);
    // the leader: wait with the bread until everyone is there, then the shares
    const L = scripts[0];
    const tStart = start;
    const turn = 0.3;
    L.until(tStart, { pose: 'carry', face: c, props: [STACK, null], sway: 6, seed });
    const tEndShares = tStart + turn * order.length;
    for (let n = 0; n < order.length; n++) {
      const i = order[n], sp = spots[i - 1], s = scripts[i];
      const tT = tStart + turn * n;
      L.until(tT + 0.08, { pose: 'carry', face: sp, props: [STACK, null] });
      L.act(0.14, { pose: 'carry', face: sp, props: [STACK, null] });
      const near = [ld[0] + (sp[0] - ld[0]) * 0.42, ld[1] + (sp[1] - ld[1]) * 0.42, Z];
      s.until(tT - 0.02, { pose: 'stand', face: ld, sway: 9, seed: seed + 100 + i });
      s.walk([near], { speed: SPEED.slow });
      s.act(0.16, { pose: 'kemitzah', phase: [0, 1], face: ld });
      s.walk([sp], { speed: SPEED.slow });
      s.act(0.08, { pose: 'stand', heading: hOf(sp, ld) });
    }
    L.until(tEndShares + 0.1, { pose: 'carry', face: c, props: [STACK, null] });
    // the leader takes his own and the bread is gone ⚙
    L.act(0.16, { pose: 'kemitzah', phase: [0, 1], face: c });
    return tEndShares;
  };
  const startN = D0 + 2.3, startS = D0 + 2.7;
  const endN = division(divI, lead.N, spotsN, NC, startN, SEED_IN + 200, [6, 12]);
  const endS = division(divO, lead.S, spotsS, SC, startS, SEED_OUT + 200, [8, 13]);
  // eating where they stand (Menachot 11:7, 11:9; eaten in the court by male kohanim), then into the Gazit by turns ⚙
  const leave = (scripts, c, tFrom, seed, route) => {
    for (let i = 0; i < N_SIDE; i++) {
      const s = scripts[i];
      const tGo = tFrom + 0.22 * i + 0.4 * ((i * 5) % 3);
      s.until(Math.max(s.now(), tGo - 2.6), { pose: 'stand', face: c, sway: 14, seed: seed + 300 + i });
      s.until(Math.max(s.now(), tGo), { pose: 'stand', heading: (hOf(s.cur, c) + 40 * (((i * 7) % 3) - 1) + 360) % 360, sway: 16, seed: seed + 400 + i });
      s.walk(route(i), { speed: SPEED.walk * (0.9 + 0.1 * ((i * 3) % 4) / 3) });
    }
  };
  leave(divI, NC, Math.max(endN + 6, D1 - 9.5), SEED_IN, (i) => [[232.5, 341.4 + 0.4 * (i % 3), Z], [205, 341.2 + 0.4 * (i % 3), Z], [P.apronX + 0.2 * (i % 2), 338.6, Z], ...apronToGazit]);
  leave(divO, SC, Math.max(endS + 6, D1 - 9.0), SEED_OUT, (i) => [[P.way.eastLine - 0.3 * (i % 2), 299, Z], [231.2, 273.2 + 0.4 * (i % 3), Z], [206.3, 274.3 - 0.4 * (i % 3), Z], [202.6, 296, Z], [199.7 + 0.3 * (i % 2), 309.4, Z], [P.apronX, 321, Z], [P.apronX, 340.2, Z], ...apronToGazit]);
  for (const s of [...divI, ...divO]) if (s.now() > D1 + 4) warn.push(`${s.name} out late`);

  // ---- wrap every show window / key time for FreeProps
  for (const list of [items.swap, items.div]) for (const it of list) { it.show = it.show.map(wrap); it.keys = it.keys.map((k) => ({ ...k, t: wrap(k.t) })); }
  for (const s of [...I, ...O, ...divI, ...divO]) warn.push(...s.warn);

  return {
    T, warm, baz, div, swapI: I, swapO: O, divI, divO, items,
    t: {
      bringLeave: tLeaveI, newOnMarble: Math.min(...tPlaceNew), takeNew: tTakeNew, lift: tLift, slide: tSlide, bowlsOn: tBowlsOn, out: tOut,
      oldOnGold: Math.min(...tPlaceOld), touch: tTouch, takeBaz: tTakeBaz, pour: tPour, takeOld: tTakeOld, startN, startS, endN, endS,
    },
    at: { shulchan: [H.shC[0], H.shC[1], ZH], gold: H.goldTop, marble: H.marbleTop, pile: pileC, north: NC, south: SC, bakery: B.door },
    warn,
  };
}

// The tamid service, shared by tamid-morning and tamid-afternoon (Tamid 3:3–4:3, 7:3; Yoma 2:5, 33a; Pesachim 5:1;
// Middot 3:5, 4:7, 5:2; report Part IV §11, lock #16, #18). One builder lays out, per date, every figure's Script and
// every free prop's window for one lamb:
//   knives   the slaughterer takes the knives from Beit HaChalifot, the Ulam's north wing (Middot 4:7), lays the
//            flaying knife ready on a marble table ⚙ and puts both back when the flaying is done ⚙
//   fetch    two kohanim bring the lamb from the lamb chamber of Beit HaMoked through the wicket (Tamid 3:3)
//   water    it is given water from a gold cup and inspected again by torchlight (Tamid 3:4; afternoon: no torches)
//   draw     the slaughterer draws it to the slaughterhouse, the limb-winners after him (Tamid 3:5)
//   bind     bound akedah-fashion at the second ring (NW morning, NE afternoon), head south, face west, held by the
//            limb-winners; the slaughterer east of it facing west; slaughter; the receiver catches the blood (Tamid 4:1)
//   blood    NE corner (east and north), SW corner (west and south), the rest on the southern yesod (Tamid 4:1)
//   flay     hung by the hind leg pierced at the hock; flayed down to the breast; the parts cut in the Mishnah's order and
//            handed to their winners, who stand in a row; the innards rinsed on a marble table (Tamid 4:2–3)
//   carry    the nine in a row to the lower half of the ramp, west side; laid down and salted (Tamid 4:3)
//   up       later, up the ramp's east side onto the fire: limbs, then the minchah, then the chavitin (Yoma 33a); in the
//            afternoon eleven, two with logs (Yoma 2:5)
// Times are fractions of the schedule's windows; ⚙ = staging (logged in docs/decisions/choreo-g2-altar.md).
// Every Script here stands at its authored Z (Script.exact): the pavement, the ramp's slope and the altar top are
// exact; legs over stairs (the Ulam's steps, the duchan) query the floor.
import { Script, jit, SPEED, wrap, since, walkMin, seedFrom } from './lib.js';
import { rampUp, rampDown, circuit } from './places.js';
import { AMAH } from '../../../core/units.js';

/** crew slots: slaughterer (also flays ⚙), receiver/thrower, the six limb-winners, flour, chavitin, wine, two log bearers */
export const CREW = { S: 0, R: 1, L: [2, 3, 4, 5, 6, 7], F: 8, C: 9, WN: 10, LOGS: [11, 12] };
export const CREW_N = 13;
/** lotteries.js's Gazit men (g1/plan.js SEED.gazit): its slots 11–19 win the fourth lottery — the limbs up (Tamid 5:2) */
export const GAZIT_SEED = 0x6745;
export const SEEDS = {
  morning: 0x746d, afternoon: 0x746d,
  // Shabbat afternoon: the incoming mishmar (Sukkah 56b) — faces of its own, never the outgoing watch's (0x7468/0x7469)
  shabbatIn: 0x696e,
  lambs: 0x6c6d,
  // the fourth lottery's winners: slot i here = lotteries' Gazit man 11 + i (the six limbs, the flour, the chavitin)
  up: seedFrom(GAZIT_SEED, 11),
};
/** the incoming watch's men shown on Shabbat (gazit-shema, tamid-afternoon, G6): the afternoon crew 0–12, its lamb-fetchers 13–14 */
export const N_IN = 15;

/** Tamid 4:3 — the nine bearers' hands (people.tamid.carriers when present) */
export const CARRIERS_FALLBACK = [
  { right: 'limb_head', left: 'limb', pose: 'carry_limbs' }, { right: 'limb_foreleg', left: 'limb_foreleg', pose: 'carry_limbs' },
  { right: 'limb_oketz', left: 'limb', pose: 'carry_limbs' }, { right: 'limb_chazeh', left: 'limb_gerah', pose: 'carry_limbs' },
  { right: 'limb_dofen', left: 'limb_dofen', pose: 'carry_limbs' }, { right: 'entrails_bazach', left: null, pose: 'carry' },
  { right: 'solet', left: null, pose: 'carry' }, { right: 'chavitin', left: null, pose: 'carry' }, { right: 'wine_jug', left: null, pose: 'carry' },
];

/** the lamb chamber (Tamid 3:3; Arachin 2:5): the two tamid lambs of the day and six more ⚙ spots */
export function lambSpots(P) {
  const lc = P.moked.lambs;
  const x0 = lc.min[0] + 2.0, x1 = lc.min[0] + 3.6, y0 = lc.min[1] + 0.85;
  return {
    morning: [x1 - 0.2, y0 + 3.75, 16, 35],
    afternoon: [x0, y0 + 3.7, 16, 110],
    flock: [[x0, y0, 16, 268], [x1, y0 + 0.1, 16, 95], [x0 + 0.1, y0 + 1.25, 16, 262], [x1, y0 + 1.3, 16, 278], [x0, y0 + 2.5, 16, 85], [x1 + 0.1, y0 + 2.55, 16, 255]],
  };
}

/** the marble table where the slaughter vessels are set out ⚙ (table 4 from the west, between both tamid lanes) */
export function vesselTable(P) {
  const tb = P.slaughter.tables[4] || { min: [217.75, 372.75, 16], max: [220.25, 374.25, 17.5] };
  const cx = (tb.min[0] + tb.max[0]) / 2, cy = (tb.min[1] + tb.max[1]) / 2, z = tb.max[2];
  return {
    stand: [cx, tb.max[1] + 0.9, 16],
    cup_gold: [cx - 0.85, cy, z], mizrak_silver: [cx - 0.25, cy + 0.1, z], knife: [cx + 0.35, cy - 0.15, z + 0.02], knife_flay: [cx + 0.85, cy + 0.15, z + 0.02],
    bowl: [cx + 0.35, cy + 0.45, z],
  };
}

/** windows of the two tamid services for the current date (unwrapped around each service) */
export function tamidWindows(ctx, sim) {
  const z = ctx.time?.zmanim || {};
  const ev = (id) => { const e = sim.event(id); return e && Number.isFinite(e.t0) ? [e.t0, e.t1] : null; };
  const sr = z.sunrise ?? 356, alot = z.alot ?? 282, shaah = z.shaahDay ?? 54.4;
  const dh = (h) => wrap(sr + h * shaah);
  const unwrap = (w, base) => (w ? [base + ((w[0] - base + 2160) % 1440) - 720, base + ((w[0] - base + 2160) % 1440) - 720 + since(w[1], w[0])] : null);
  const mBase = wrap(sr);
  const m = {
    fetch: unwrap(ev('lamb-brought') || [wrap(alot + 12), wrap(alot + 24)], mBase),
    water: unwrap(ev('lamb-watered') || [wrap(sr - 22), wrap(sr - 12)], mBase),
    slaughter: unwrap(ev('tamid-slaughter') || [wrap(sr - 1), wrap(sr + 3)], mBase),
    blood: unwrap(ev('tamid-blood') || [wrap(sr + 4), wrap(sr + 8)], mBase),
    flay: unwrap(ev('flaying') || [wrap(sr + 8), wrap(sr + 26)], mBase),
    carry: unwrap(ev('limbs-to-ramp') || [wrap(sr + 26), wrap(sr + 31)], mBase),
    up: unwrap(ev('limbs-up') || [wrap(sr + 75), wrap(sr + 88)], mBase),
    wine: unwrap(ev('libation') || [wrap(sr + 88), wrap(sr + 92)], mBase),
  };
  const AT = ev('tamid-afternoon') || [dh(8.5), dh(8.65)];
  const aBase = AT[0];
  const AF = unwrap(ev('afternoon-flaying') || [dh(8.65), dh(9.1)], aBase);
  const a0 = aBase;
  const a = {
    fetch: [a0 - 17, a0 - 13], water: [a0 - 12, a0 - 5.6], slaughter: [a0, a0 + 2.5], blood: [a0 + 3, unwrap(AT, aBase)[1]],
    flay: [AF[0], AF[1] - 6.5], carry: [AF[1] - 6.5, AF[1]],
    up: unwrap(ev('afternoon-limbs') || [dh(9.5), dh(9.65)], aBase),
    wine: unwrap(ev('afternoon-song') || ev('afternoon-song-shabbat') || [dh(9.65), dh(9.95)], aBase),
  };
  return { m, a };
}

/** the afternoon's two logs: when they are taken from the stack and laid on the great pile — shared by
 *  terumat-hadeshen (the stack, the two logs on the pile) and tamid-afternoon (the bearers): one place decides */
export function pmLogs(up) {
  if (!up) return null;
  return { pick: [wrap(up[0] + 1.1), wrap(up[0] + 1.25)], lay: wrap(up[0] + 3.0) };
}

/** a lamb walking behind its leader: the leader's points with the last one drawn back `back` amot */
function behind(from, pts, back = 1.6) {
  const n = pts.length;
  const a = n > 1 ? pts[n - 2] : from, b = pts[n - 1];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [...pts.slice(0, n - 1), [b[0] - ((b[0] - a[0]) / L) * back, b[1] - ((b[1] - a[1]) / L) * back, b[2]]];
}

/**
 * To the knife niches of Beit HaChalifot and back to the apron's north end (Middot 4:7): up the Ulam's twelve steps
 * (stairs: the floor is queried), in at its open front, north to the wing; `take` / `put`: [right, left] before → after.
 */
export function chalifotTrip(s, P, before, after) {
  const w = P.way.toChalifot, ch = P.chalifot;
  s.walk([w[0], w[1]], { speed: SPEED.walk, props: before });
  s.walk([w[2]], { speed: 0.8, props: before, zExact: false });
  s.walk(w.slice(3), { speed: SPEED.walk, props: before });
  s.act(0.1, { pose: 'bow', phase: [0, 0.22], heading: 0, props: before });
  s.act(0.25, { pose: 'bow', phase: 0.22, heading: 0, props: before });
  s.act(0.1, { pose: 'bow', phase: [0.78, 1], heading: 0, props: after });
  s.walk([w[4], w[3]], { speed: SPEED.walk, props: after });
  s.walk([w[1]], { speed: 0.85, props: after, zExact: false });
  s.walk([w[0]], { speed: SPEED.walk, props: after });
  void ch;
  return s;
}

/**
 * Build one tamid's plan.
 * cfg: { kind, ring, pillar, rinseTable, W (windows), torches, after: 'gazit' | 'wait', carriers, lambFrom: [X,Y,Z,h],
 *        salt: [X,Y,Z], seed }
 */
export function buildTamid(ctx, P, cfg) {
  const Z = P.Z, R = P.ramp, A = P.altar, M = P.moked, SEED = cfg.seed;
  const W = cfg.W;
  const ring = cfg.ring;
  const hook = P.slaughter.hook(cfg.pillar);
  // the flayer at the carcass's south-west, facing north-east: the carcass stays in view from the south ⚙
  const hookStand = [hook[0] - 0.85, hook[1] - 1.15, Z];
  const FLAYH = 36;
  const tbl = P.slaughter.tables[cfg.rinseTable];
  const tblC = tbl ? [(tbl.min[0] + tbl.max[0]) / 2, (tbl.min[1] + tbl.max[1]) / 2, tbl.max[2]] : [hook[0], 373.5, 17.5];
  // before the table, its edge 0.25 m ahead (people's 'rinse': hands on a table 1½ amot high)
  const tblStand = [tblC[0], (tbl ? tbl.max[1] : 374.25) + 0.25 / AMAH + 0.02, Z];
  const VT = vesselTable(P);
  const gapX = hook[0] - 2;             // the lane between the marble tables and between the pillars ⚙
  const carriers = cfg.carriers?.length === 9 ? cfg.carriers : CARRIERS_FALLBACK;
  const t = {};
  const items = [];
  const use = { cup_gold: [], mizrak_silver: [] };
  const leads = [];
  const crew = Array.from({ length: CREW_N }, () => null);
  const gz = P.gazit;
  const NP = 386.4;                     // the passage north of the nanasin, under the Moked's wall ⚙
  const north = [gz.door, ...P.way.gazitToNW.slice(0, 3), [200, NP, Z]];         // the Gazit to the north of the court
  const toGazit = [...[...north].reverse(), gz.inside];
  // inside the Azarah by the Moked gate, in the gap between two dwarf pillars as seen from the schedule's view ⚙
  const waterAt = [M.wicketOut[0] - 3.4, M.wicketOut[1] - 1.0, Z];
  const lambWater = [waterAt[0] + 0.9, waterAt[1] - 0.2, Z];
  // from the north passage straight through a gap of the nanasin, then of the marble tables (never across a pillar)
  const lane = (x = gapX) => [[x, NP, Z], [x, 382.2, Z], [x, 376.2, Z]];
  const laneUp = (x = gapX) => [[x, 376.2, Z], [x, 382.2, Z], [x, NP, Z]];
  const toRing = [...lane(), [gapX, 371.0, Z], [ring[0] + 0.4, ring[1] + 4.2, Z]];
  const lambSpot = [ring[0] + 0.15, ring[1] + 1.05, Z];                             // its body N of the ring, neck at it ⚙
  const viaTable = (pts) => [...lane(), [VT.stand[0], VT.stand[1] + 0.3, Z], ...(pts || [])];
  const tableToApron = [[gapX, 376.2, Z], [gapX, 371, Z], [205, 345.5, Z], P.way.toChalifot[0]];
  const S0 = (t0, name) => Script.from(t0, gz.inside, 90, name).exact();

  // ------------------------------------------------------------------------------------------------ the fetch (Tamid 3:3)
  const fetch = [null, null];
  const [f0] = W.fetch;
  const lambIn = cfg.lambFrom;
  const outOfChamber = [M.lambDoor, [208.6, 396.2, Z], M.wicketIn, M.wicket, M.wicketOut];
  for (let k = 0; k < 2; k++) {
    const s = S0(f0 + 0.05 * k, `fetch${k}`);
    s.walk([...north, [M.wicketOut[0] - 1.2, 387.2, Z], M.wicketOut, M.wicket, M.wicketIn, [208.6, 396.2, Z], M.lambDoorOut], { speed: SPEED.walk });
    if (k === 0) {
      s.walk([M.lambDoor, [lambIn[0] + 0.9, lambIn[1] + 0.6, Z]], { speed: SPEED.slow });
      // choosing an inspected lamb from the chamber's (Arachin 2:5) ⚙
      s.act(0.12, { pose: 'bow', phase: [0, 0.4], face: lambIn });
      s.act(0.9, { pose: 'bow', phase: 0.45, face: lambIn });
      s.act(0.12, { pose: 'bow', phase: [0.7, 1], face: lambIn });
      t.leadOut = s.now() + 0.15;
      s.act(0.25, { pose: 'lead', face: M.lambDoor });
      t.ledFrom = s.now();
      s.walk([...outOfChamber, waterAt], { speed: SPEED.lamb, pose: 'lead_walk' });
      t.atWater = s.now();
      s.until(W.water[0] + 0.35, { pose: 'lead', face: lambWater, sway: 10, seed: SEED + 5 });
      t.handOver = s.now();
      s.act(0.1, { pose: 'stand', face: lambWater });
      s.walk([[M.wicketOut[0] - 1.2, 387.2, Z], ...toGazit], { speed: SPEED.walk });
    } else {
      s.walk([M.lambDoor], { speed: SPEED.slow });
      s.until(t.ledFrom, { pose: 'stand', face: lambIn, sway: 12, seed: SEED + 6 });
      s.walk([[208.6, 396.2, Z], M.wicketIn, M.wicket, M.wicketOut, [waterAt[0] + 1.2, waterAt[1] - 1.8, Z]], { speed: SPEED.lamb });
      s.act(0.6, { pose: 'stand', face: lambWater });
      s.walk([[M.wicketOut[0] - 1.2, 387.2, Z], ...toGazit], { speed: SPEED.walk });
    }
    fetch[k] = s;
  }
  leads.push([t.leadOut, t.handOver, 'fetch']);
  t.pass = [[t.ledFrom, t.atWater]];       // the wicket open as they pass (Middot 1:7)
  t.pass.unshift([f0 + 1.0, f0 + 1.9]);

  // ------------------------------------------------------------------------------------------------ the slaughterer: knives, water, draw, bind
  const [w0, w1] = W.water;
  const [s0, s1] = W.slaughter;
  const [b0, b1] = W.blood;
  const [fl0, fl1] = W.flay;
  const tBind = s0 - 4.0;
  // the cut inside the slaughter window but late enough that the blood is not held for long before its window ⚙
  const tCut = s0 + Math.max(0.6, Math.min(1.6, s1 - s0 - 1.6));
  const tStruggle = tCut - 0.25;
  t.water = [w0, w1]; t.bind = tBind; t.tCut = tCut;
  const S = S0(w0 - 5.2, 'slaughterer');
  S.walk([gz.door, ...P.way.gazitToNW], { speed: SPEED.walk });
  // the knives from Beit HaChalifot, "where they store the knives" (Middot 4:7)
  const KK = ['knife', 'knife_flay'];
  chalifotTrip(S, P, null, KK);
  // the flaying knife laid ready on the marble table where the vessels are set out ⚙
  S.walk([[205, 345.5, Z], [gapX, 371, Z], [gapX, 376.2, Z], [VT.stand[0] + 0.5, VT.stand[1] + 0.3, Z]], { speed: SPEED.walk, props: KK });
  S.act(0.08, { pose: 'bow', phase: [0, 0.35], face: VT.knife_flay, props: KK });
  const tLayKF = S.now();
  const KN = [null, 'knife'];
  S.act(0.08, { pose: 'bow', phase: [0.7, 1], face: VT.knife_flay, props: KN });
  S.walkAt(w0 + 0.3, [...laneUp(), [waterAt[0] - 1.3, waterAt[1] + 0.35, Z]], { props: KN, wait: { pose: 'stand', heading: 0, sway: 8, seed: SEED + 4, props: KN } });
  S.act(0.1, { pose: 'stand', face: lambWater, props: KN });
  S.until(w1 - 0.6, { pose: 'lead', face: lambWater, sway: 6, seed: SEED + 7, props: KN });
  // he draws it to the slaughterhouse, and those who won the limbs follow (Tamid 3:5)
  t.draw = S.now();
  S.walk(toRing, { speed: SPEED.lamb, pose: 'lead_walk', props: KN });
  const sStand = [ring[0] + 1.3, ring[1] + 0.6, Z];
  S.walk([sStand], { speed: SPEED.slow, pose: 'lead_walk', props: KN });
  S.until(tBind, { pose: 'lead', face: lambSpot, sway: 8, seed: SEED + 8, props: KN });
  leads.push([t.handOver, tBind + 0.2, 'S']);
  // bound, not tied: head to the south, face to the west; he stands on the east, facing west (Tamid 4:1)
  S.act(0.5, { pose: 'hold_legs', heading: 270 });
  S.until(tCut - 0.18, { pose: 'stand', heading: 270, props: ['knife', null] });
  S.act(0.68, { pose: 'slaughter', heading: 270, props: ['knife', null] });
  S.act(0.32, { pose: 'stand', heading: 270, props: ['knife', null] });
  t.knifeHand = S.now();
  S.act(0.15, { pose: 'stand', heading: 200 });

  // the lamb: the chamber, led out, held, drinking, drawn, bound, slaughtered
  const lamb = Script.from(t.leadOut - 2.2, lambIn, lambIn[3] ?? 0, 'lamb').exact();
  lamb.until(t.ledFrom + 0.04, { pose: 'stand', heading: lambIn[3] ?? 0 });
  lamb.walk(behind(lambIn, [...outOfChamber, lambWater], 0.2), { speed: SPEED.lamb * 0.97, pose: 'walk_led' });
  lamb.until(w0 + 0.55, { pose: 'stand_led', heading: 265, sway: 14, seed: SEED + 9 });
  // the gold cup (Tamid 3:4) held to its muzzle
  t.drink = [w0 + 0.55, w0 + 2.45];
  lamb.act(1.9, { pose: 'drink', heading: 265 });
  lamb.until(t.draw + 0.05, { pose: 'stand_led', heading: 265, sway: 8, seed: SEED + 10 });
  lamb.walk(behind(lambWater, [...toRing, sStand], 1.4), { speed: SPEED.lamb * 0.99, pose: 'walk_led' });
  lamb.walk([lambSpot], { speed: 0.4, pose: 'walk_led' });
  lamb.until(tBind + 0.25, { pose: 'stand_led', heading: 200 });
  lamb.act(0.1, { pose: 'struggle', heading: 180 });
  lamb.until(tStruggle, { pose: 'bound', heading: 180 });
  lamb.until(tCut + 0.35, { pose: 'struggle', heading: 180 });
  t.struggle = tStruggle;

  // ------------------------------------------------------------------------------------------------ the receiver and the blood
  const Rr = S0(s0 - 6.2, 'receiver');
  Rr.walk([...north, ...viaTable()], { speed: SPEED.walk });
  Rr.act(0.08, { pose: 'bow', phase: [0, 0.35], face: VT.mizrak_silver });
  use.mizrak_silver.push([Rr.now(), null]);
  const MZ = ['mizrak_silver', null];
  Rr.act(0.08, { pose: 'bow', phase: [0.7, 1], face: VT.mizrak_silver, props: MZ });
  const rStand = [ring[0] + 0.35, ring[1] - 0.95, Z];      // at the neck, south-east of it ⚙
  Rr.walk([[VT.stand[0] - 1.5, VT.stand[1] + 0.4, Z], [gapX, 376.2, Z], [gapX, 371, Z], [ring[0] + 2.4, ring[1] - 1.2, Z], rStand], { speed: SPEED.walk, props: MZ });
  Rr.until(tCut - 0.05, { pose: 'stand', face: lambSpot, props: MZ, sway: 6, seed: SEED + 11 });
  // "the slaughterer slaughtered and the receiver received" (Tamid 4:1)
  Rr.act(0.9, { pose: 'receive', heading: 330, props: MZ });
  // to the NE corner at once, and ready there as the blood's window opens (the schedule leaves a gap ⚙)
  const ne = [A.yesod.max[0] + 0.55, A.yesod.max[1] + 0.55, Z];
  const neFace = [A.yesod.max[0] - 0.5, A.yesod.max[1] - 0.5];
  Rr.walk([[ring[0] + 4, ring[1] - 4, Z], ne], { speed: SPEED.slow, props: MZ });
  const tNE = Math.max(Rr.now() + 0.25, b0 + 0.3);
  Rr.until(tNE - 0.2, { pose: 'stand', face: neFace, props: MZ, sway: 3, seed: SEED + 12 });
  // the NE corner: toward the east and the north, below the red line (Tamid 4:1; Middot 3:1)
  t.throw1 = Rr.now() + 0.2;
  Rr.act(0.45, { pose: 'throw', phase: [0, 1], face: neFace, props: MZ });
  Rr.act(0.25, { pose: 'stand', face: neFace, props: MZ });
  // round the north and the west of the altar to the SW corner: toward the west and the south
  const swC = [A.yesod.min[0] - 0.35, A.yesod.min[1] - 0.25, Z];
  const swFace = [A.yesod.min[0] + 0.5, A.yesod.min[1] + 0.5];
  Rr.walk([[A.yesod.max[0] - 1, A.yesod.max[1] + 1.5, Z], [P.apronX, A.yesod.max[1] + 0.6, Z], [P.apronX, 321, Z], [199.6, 309.2, Z], [200.3, 306.4, Z], swC], { speed: 0.85, props: MZ });
  Rr.act(0.1, { pose: 'stand', face: swFace, props: MZ });
  t.throw2 = Rr.now() + 0.2;
  Rr.act(0.45, { pose: 'throw', phase: [0, 1], face: swFace, props: MZ });
  // the rest poured out on the southern yesod (Tamid 4:1)
  const pourFace = [A.yesod.min[0] + 1.4, A.yesod.min[1] + 0.5];
  Rr.act(0.2, { pose: 'stand', face: pourFace, props: MZ });
  t.pour = Rr.now() + 0.25;
  Rr.act(0.5, { pose: 'pour', phase: [0, 1], face: pourFace, props: MZ });
  // the basin back to the marble table; he waits by the slaughterhouse ⚙
  Rr.walk([[200.3, 306.4, Z], [199.6, 309.2, Z], [P.apronX, 321, Z], [P.apronX, 338, Z], [205, 345.5, Z], [gapX, 371, Z], [gapX, 376.2, Z], [VT.stand[0] - 1.5, VT.stand[1] + 0.4, Z], VT.stand], { speed: SPEED.walk, props: MZ });
  Rr.act(0.08, { pose: 'bow', phase: [0, 0.35], face: VT.mizrak_silver, props: MZ });
  use.mizrak_silver[use.mizrak_silver.length - 1][1] = Rr.now();
  Rr.act(0.08, { pose: 'bow', phase: [0.7, 1], face: VT.mizrak_silver });
  crew[CREW.S] = S; crew[CREW.R] = Rr;
  void b1;

  // ------------------------------------------------------------------------------------------------ the limb-winners
  const D = fl1 - fl0;
  const F = (x) => fl0 + D * x;      // flaying fractions ⚙ (the Mishnah's order, not its minutes)
  const cut = {
    carry: F(0.0), hang: F(0.045), head: F(0.29), shanks: F(0.32), hide: F(0.5), forelegs: F(0.56), rleg: F(0.6), open: F(0.62), innards: F(0.645),
    breast: F(0.68), rflank: F(0.72), neck: F(0.76), lflank: F(0.8), tail: F(0.84), lleg: F(0.88), row: F(0.91),
  };
  t.cuts = cut;
  // the row: beside the flayer to the west, clear of the view of the hook from the south ⚙
  const rowAt = (i) => [hook[0] - 2.6 - 1.45 * i, hook[1] - 1.75 - 0.25 * (i % 2), Z];
  const ROWH = 75;
  const take = (i) => [hook[0] - 2.15, hook[1] - 1.35 - 0.35 * (i % 2), Z];    // beside the flayer, to the west ⚙
  // round the bound lamb (Tamid 4:1 "those who won the limbs hold it"): two kneel holding it from the north — one at
  // the bound hind legs, one over its hindquarters — the others stand by, 2½–3 amot back; its head (south), its face
  // (west) and the slaughterer on its east stay open to the south-west ⚙
  const hold = [
    [ring[0] + 1.05, ring[1] + 2.5, 215, 'hold_legs'], [ring[0] - 2.7, ring[1] + 2.9, 130, 'stand'],
    [ring[0] + 2.9, ring[1] + 3.5, 220, 'stand'], [ring[0] - 0.75, ring[1] + 2.25, 140, 'hold_legs'],
    [ring[0] - 0.6, ring[1] + 4.3, 170, 'stand'], [ring[0] - 2.7, ring[1] + 1.8, 95, 'stand'],
  ];
  // at the watering (Tamid 3:4): one holds the gold cup, one examines it, two hold torches (morning) ⚙
  const atW = [
    [lambWater[0] + 0.1, lambWater[1] - 1.35, 5, 'stand'], [lambWater[0] - 1.25, lambWater[1] - 0.55, 70, 'receive'],
    [lambWater[0] - 2.3, lambWater[1] - 1.6, 40, 'stand'], [lambWater[0] + 2.0, lambWater[1] - 1.1, 290, 'stand'],
    [lambWater[0] + 1.6, lambWater[1] - 2.0, 330, cfg.torches ? 'torch' : 'stand'], [lambWater[0] + 2.3, lambWater[1] + 0.6, 245, cfg.torches ? 'torch' : 'stand'],
  ];
  // what each receives in the Mishnah's order (Tamid 4:2); the sixth holds the shanks in his bazach until the innards
  // are put in it (Tamid 4:3 "the innards in a bazach and the shanks on top") — 'bazach' stands in for it ⚙
  const parts = [
    [['head', 'limb_head', null], ['rleg', 'limb_head', 'limb']],
    [['forelegs', 'limb_foreleg', 'limb_foreleg']],
    [['tail', 'limb_oketz', null], ['lleg', 'limb_oketz', 'limb']],
    [['breast', 'limb_chazeh', null], ['neck', 'limb_chazeh', 'limb_gerah']],
    [['rflank', 'limb_dofen', null], ['lflank', 'limb_dofen', 'limb_dofen']],
    [['shanks', 'bazach', null]],
  ];
  const holdPose = (pr) => (!pr ? 'stand' : /^limb/.test(pr[0] || '') || /^limb/.test(pr[1] || '') ? 'carry_limbs' : 'carry');
  const walkPose = (pr) => (!pr ? 'walk' : holdPose(pr) === 'carry_limbs' ? 'carry_limbs_walk' : 'carry_walk');
  let tKnifeDown = NaN;
  for (let i = 0; i < 6; i++) {
    const aw = atW[i];
    const TORCH = cfg.torches && (i === 4 || i === 5) ? ['torch', null] : null;
    // out of the Gazit just in time to walk to the watering at an ordinary pace (no one waits at its door)
    const toW = [...north, [M.wicketOut[0] - 1.2 - 0.5 * i, 386.8, Z], [aw[0], aw[1], Z]];
    const cupA = [...north, ...viaTable()], cupB = [...laneUp(), [aw[0], aw[1], Z]];
    const tOut = i === 1 ? w0 + 0.5 - walkMin(gz.inside, cupA) - walkMin(cupA[cupA.length - 1], cupB) - 0.4 : w0 + 0.45 + 0.1 * i - walkMin(gz.inside, toW) - 0.08;
    const s = S0(tOut, `limb${i + 1}`);
    if (i === 1) {
      // the gold cup from the marble table (Tamid 3:4); he holds it to the lamb's muzzle
      s.walk(cupA, { speed: SPEED.walk });
      s.act(0.08, { pose: 'bow', phase: [0, 0.35], face: VT.cup_gold });
      use.cup_gold.push([s.now(), null]);
      s.act(0.08, { pose: 'bow', phase: [0.7, 1], face: VT.cup_gold, props: ['cup_gold', null] });
      s.walkAt(w0 + 0.5, cupB, { props: ['cup_gold', null], wait: { pose: 'stand', heading: 0, sway: 8, seed: SEED + 13, props: ['cup_gold', null] } });
      s.until(w0 + 0.55, { pose: 'stand', heading: aw[2], props: ['cup_gold', null] });
      s.until(t.drink[1], { pose: 'receive', heading: aw[2], props: ['cup_gold', null] });
      s.until(w1 - 0.75, { pose: 'stand', heading: aw[2], props: ['cup_gold', null] });
    } else {
      s.walkAt(w0 + 0.45 + 0.1 * i, toW, { props: TORCH, wait: { pose: 'stand', heading: 90, sway: 10, seed: SEED + 14 + i, props: TORCH } });
      if (i === 0) {
        // the inspection by torchlight (Tamid 3:4): he goes round it on his knees ⚙ — fitted to the window
        const k = Math.max(0.35, Math.min(1.4, (w1 - 0.85 - (t.drink[1] + 0.05)) / 2.96));
        s.until(t.drink[1] + 0.05, { pose: 'stand', heading: aw[2] });
        s.act(0.15 * k, { pose: 'kneel', phase: [0, 0.35], heading: aw[2] });
        s.act(1.2 * k, { pose: 'kneel', phase: 0.5, heading: aw[2] });
        s.act(0.12 * k, { pose: 'kneel', phase: [0.7, 1], heading: aw[2] });
        s.shift([lambWater[0] - 1.1, lambWater[1] + 0.9, Z], 0.12 * k, { pose: 'walk', heading: 125 });
        s.act(0.15 * k, { pose: 'kneel', phase: [0, 0.35], heading: 125 });
        s.act(1.1 * k, { pose: 'kneel', phase: 0.5, heading: 125 });
        s.act(0.12 * k, { pose: 'kneel', phase: [0.7, 1], heading: 125 });
        s.until(w1 - 0.75, { pose: 'stand', face: lambWater, sway: 8, seed: SEED + 20 });
      } else {
        s.until(w1 - 0.75, { pose: aw[3], heading: aw[2], props: TORCH, sway: aw[3] === 'stand' ? 10 : 4, seed: SEED + 21 + i });
      }
    }
    // after him to the slaughterhouse (Tamid 3:5); the torches put out ⚙; the cup back on the table
    const h = hold[i];
    if (i === 1) {
      s.walk([...lane(), [VT.stand[0], VT.stand[1] + 0.3, Z]], { speed: SPEED.walk, props: ['cup_gold', null] });
      s.act(0.08, { pose: 'bow', phase: [0, 0.35], face: VT.cup_gold, props: ['cup_gold', null] });
      use.cup_gold[use.cup_gold.length - 1][1] = s.now();
      s.act(0.08, { pose: 'bow', phase: [0.7, 1], face: VT.cup_gold });
      s.walk([[gapX + 0.4, 376.2, Z], [gapX + 0.4, 371, Z], [h[0], h[1], Z]], { speed: SPEED.walk });
    } else {
      s.walk([[waterAt[0] + 0.4 - 0.7 * (i % 3), waterAt[1] - 1.0, Z], ...toRing.slice(0, 4), [h[0], h[1], Z]], { speed: SPEED.lamb * 0.95 });
    }
    s.until(tBind, { pose: 'stand', face: lambSpot, sway: 8, seed: SEED + 30 + i });
    s.act(0.4, { pose: h[3], heading: h[2] });
    s.until(tCut + 0.6, { pose: h[3], heading: h[2], ...(h[3] === 'stand' ? { face: lambSpot, sway: 4, seed: SEED + 35 + i } : {}) });
    s.act(0.15, { pose: 'stand', heading: h[2] });
    if (i === 2) {
      // the knife from the slaughterer, laid on the marble table ⚙
      s.until(t.knifeHand, { pose: 'stand', face: sStand });
      s.walk([[sStand[0] - 0.7, sStand[1] + 1.0, Z]], { speed: SPEED.slow });
      s.act(0.12, { pose: 'stand', face: sStand, props: ['knife', null] });
      s.walk([[gapX - 0.4, 371, Z], [gapX - 0.4, 376.2, Z], [VT.stand[0] - 1.2, VT.stand[1] + 0.3, Z], VT.stand], { speed: SPEED.walk, props: ['knife', null] });
      s.act(0.08, { pose: 'bow', phase: [0, 0.35], face: VT.knife, props: ['knife', null] });
      tKnifeDown = s.now();
      s.act(0.08, { pose: 'bow', phase: [0.7, 1], face: VT.knife });
      s.walk([[gapX - 0.4, 376.2, Z], [gapX - 0.4, 371, Z], [h[0], h[1] + 1, Z]], { speed: SPEED.walk });
    }
    // waiting through the blood; then after the slaughterer to the hook and into the row
    const ra = rowAt(i);
    s.until(cut.carry + 0.12 + 0.06 * i, { pose: 'stand', face: lambSpot, sway: 10, seed: SEED + 40 + i });
    s.walk([[ring[0] - 0.8 + 0.5 * i, ring[1] + 4.5, Z], [gapX + 0.35 * (i % 2), 371, Z], [gapX + 0.35 * (i % 2), 376.2, Z], ra], { speed: SPEED.slow });
    let props = null;
    for (const [ev, r, l] of parts[i]) {
      s.until(cut[ev] - 0.3, { pose: holdPose(props), heading: ROWH, props, sway: props ? 3 : 8, seed: SEED + 50 + i });
      s.walk([take(i)], { speed: SPEED.slow, pose: walkPose(props), props });
      s.act(0.3, { pose: holdPose(props), face: [hook[0], hook[1]], props });
      props = r || l ? [r, l] : null;
      s.walk([ra], { speed: SPEED.slow, pose: walkPose(props), props });
    }
    if (i === 5) {
      // the innards into his bazach, on the shanks, then rinsed three times on the marble tables (Tamid 4:2) ⚙ (the
      // stomach in the rinsers' chamber not shown)
      s.until(cut.innards - 0.25, { pose: 'carry', heading: ROWH, props, sway: 6, seed: SEED + 60 });
      s.walk([take(5)], { speed: SPEED.slow, pose: 'carry_walk', props });
      s.act(0.3, { pose: 'carry', face: [hook[0], hook[1]], props: ['entrails_bazach', null] });
      s.walk([[gapX + 2.2, 377.6, Z], tblStand], { speed: SPEED.slow, pose: 'carry_walk', props: ['entrails_bazach', null] });
      t.rinse = [s.now(), cut.row - 0.5];
      // the innards worked on the table with both hands (people's 'rinse'; Tamid 4:2 "rinsed them")
      s.until(cut.row - 0.5, { pose: 'rinse', phase: { cycle: 2 }, heading: 180 });
      s.act(0.15, { pose: 'carry', heading: 180, props: ['entrails_bazach', null] });
      s.walk([[gapX + 2.2, 377.6, Z], ra], { speed: SPEED.slow, pose: 'carry_walk', props: ['entrails_bazach', null] });
      props = ['entrails_bazach', null];
    }
    s.until(cut.row, { pose: carriers[i].pose, heading: ROWH, props, sway: 3, seed: SEED + 70 + i });
    crew[CREW.L[i]] = s;
  }

  // ------------------------------------------------------------------------------------------------ the flayer
  S.until(cut.carry - 0.15, { pose: 'stand', face: lambSpot, sway: 6, seed: SEED + 80 });
  S.act(0.15, { pose: 'bow', phase: [0, 0.45], face: lambSpot });
  // the slain lamb lifted from the ring into his arms, its back against him, the head hanging (people's lamb_slain in
  // carry_lamb — the cut across the throat, the fleece dark with blood about it) and carried to the hook ⚙
  const carryPath = [[ring[0] + 0.6, ring[1] + 3.0, Z], [gapX, 371, Z], [gapX, 376.0, Z], [hookStand[0] - 0.4, hookStand[1] - 0.4, Z], hookStand];
  const SLAIN = ['lamb_slain', null];
  t.lift = S.now();
  S.act(0.06, { pose: 'carry_lamb', face: lambSpot, props: SLAIN });
  S.walk(carryPath, { speed: 0.75, pose: 'carry_lamb_walk', props: SLAIN });
  // in his arms until the moment it hangs (lamb_hung shows from cut.hang: never a moment with no lamb)
  S.until(cut.hang, { pose: 'carry_lamb', heading: FLAYH, props: SLAIN });
  // "he pierced it at the hock and hung it by it" (Tamid 4:2)
  S.until(cut.hang + 0.15, { pose: 'flay', heading: FLAYH });
  // the flaying knife from the marble table, where he laid it ready ⚙
  S.walk([[VT.stand[0] - 1.0, VT.stand[1] + 1.2, Z], VT.stand], { speed: SPEED.walk });
  S.act(0.08, { pose: 'bow', phase: [0, 0.35], face: VT.knife_flay });
  const tTakeKF = S.now();
  const KF = ['knife_flay', null];
  S.act(0.08, { pose: 'bow', phase: [0.7, 1], face: VT.knife_flay, props: KF });
  S.walk([[VT.stand[0] - 1.0, VT.stand[1] + 1.2, Z], hookStand], { speed: SPEED.walk, props: KF });
  for (const ev of ['head', 'shanks', 'hide', 'forelegs', 'rleg', 'open', 'innards', 'breast', 'rflank', 'neck', 'lflank', 'tail', 'lleg']) {
    S.until(cut[ev] - 0.12, { pose: 'flay', heading: FLAYH, props: KF });
    S.act(0.24, { pose: 'flay', heading: FLAYH + (ev.length % 2 ? -12 : 10), props: KF });
  }
  S.until(cut.row + 0.2, { pose: 'stand', heading: FLAYH, props: KF });
  // both knives back to Beit HaChalifot ⚙ (when they were put back is not stated)
  S.walk([[VT.stand[0] - 1.0, VT.stand[1] + 1.2, Z], VT.stand], { speed: SPEED.walk, props: KF });
  S.act(0.08, { pose: 'bow', phase: [0, 0.35], face: VT.knife, props: KF });
  const tKnifePick = S.now();
  S.act(0.08, { pose: 'bow', phase: [0.7, 1], face: VT.knife, props: KK });
  S.walk(tableToApron, { speed: SPEED.walk, props: KK });
  chalifotTrip(S, P, KK, null);
  // the knives' places on the marble table between their uses
  const atTable = (name, a, b) => { if (Number.isFinite(a) && Number.isFinite(b) && b > a) items.push({ name, show: [a, b], keys: [{ t: a, X: VT[name][0], Y: VT[name][1], Z: VT[name][2], h: 90 }] }); };
  atTable('knife_flay', tLayKF, tTakeKF);
  atTable('knife', tKnifeDown, tKnifePick);
  // the lamb at the ring until he lifts it (then the carried prop, then the hook's states)
  {
    lamb.until(cut.carry, { pose: 'bound', phase: 0, heading: 180 });
    lamb.until(t.lift, { pose: 'bound', phase: 0, heading: 180 });
  }
  // the hook's states (free props, origin at the hook)
  const atHook = (tk) => [{ t: tk, X: hook[0], Y: hook[1], Z: hook[2], h: 0 }];
  items.push({ name: 'lamb_hung', show: [cut.hang, cut.head], keys: atHook(cut.hang) });
  items.push({ name: 'carcass_flaying', show: [cut.head, cut.open], keys: atHook(cut.head) });
  items.push({ name: 'carcass_hung', show: [cut.open, cut.lleg], keys: atHook(cut.open) });
  // the hide laid on the pavement by the pillar, then taken to Lishkat HaParvah where hides are salted (Middot 5:3) ⚙
  const hideAt = [hook[0] + 1.7, hook[1] - 0.95, Z + 0.02];
  t.hidePick = cut.row + 0.5;
  items.push({ name: 'hide', show: [cut.hide, t.hidePick], keys: [{ t: cut.hide, X: hideAt[0], Y: hideAt[1], Z: hideAt[2], h: 80 }] });
  // the innards spread on the marble table while they are rinsed (people's 'entrails') ⚙
  if (t.rinse) items.push({ name: 'entrails', show: [t.rinse[0], t.rinse[1]], keys: [{ t: t.rinse[0], X: tblC[0], Y: tblC[1] + 0.25, Z: tblC[2], h: 0 }] });

  // the receiver takes the hide to the Parvah ⚙ — round the south of the Ulam (its block reaches Y 280.5)
  Rr.until(t.hidePick - 0.35, { pose: 'stand', face: [hook[0], hook[1]], sway: 8, seed: SEED + 90 });
  Rr.walk([[hideAt[0] - 0.4, hideAt[1] - 1.1, Z]], { speed: SPEED.slow });
  Rr.act(0.1, { pose: 'bow', phase: [0, 0.45], face: hideAt });
  Rr.act(0.1, { pose: 'bow', phase: [0.7, 1], face: hideAt, props: ['hide', null] });
  const parvah = [130.2, 276.6, Z];
  Rr.walk([[gapX + 0.6, 376.0, Z], [gapX + 0.6, 371, Z], [205, 345.5, Z], [P.apronX, 338, Z], [P.apronX, 321, Z], [199.6, 309.2, Z], [190, 300, Z], [181, 277.6, Z], [176, 276.9, Z], parvah, [parvah[0], parvah[1] - 2.2, Z]],
    { speed: SPEED.walk, pose: 'carry_shoulder_walk', props: ['hide', null] });

  // ------------------------------------------------------------------------------------------------ flour, chavitin, wine
  // they come from the chamber of the chavitin makers by Nikanor (Middot 1:4) with the fine flour, the chavitin and the
  // wine ⚙ (where the flour and wine were made ready is not shown); the duchan's steps up from Ezrat Yisrael are stairs
  const chav = [251, 319.5, 13.5];
  for (const [k, slotI, name] of [[6, CREW.F, 'solet'], [7, CREW.C, 'chavitin'], [8, CREW.WN, 'wine_jug']]) {
    const s = Script.from(cut.row - 3.4 + 0.15 * (k - 6), [chav[0], chav[1] - 0.6 + 0.6 * (k - 6), chav[2]], 270, `bearer${k + 1}`).exact();
    const PR = { pose: 'carry_walk', props: [name, null] };
    s.walk([[246, 319.5 + 0.4 * (k - 6), 13.5]], PR);
    s.walk([[240.5, 320 + 0.4 * (k - 6), Z]], { ...PR, speed: 0.8, zExact: false });
    s.walkAt(cut.row - 0.3, [[P.way.eastLine, 330 + (k - 6), Z], [P.way.eastLine, 360, Z], [P.way.eastLine - 2, 376.6, Z], [rowAt(k)[0] + 0.5, 376.6, Z], rowAt(k)], { ...PR, wait: { pose: 'carry', heading: 0, props: [name, null] } });
    s.until(cut.row, { pose: 'carry', heading: ROWH, props: [name, null] });
    crew[slotI] = s;
  }

  // ------------------------------------------------------------------------------------------------ to the ramp (Tamid 4:3)
  const [c0] = W.carry;
  const Y0 = R.halfY - 1.9, DY = 1.33;       // the lower half of the ramp, west side: the first highest ⚙
  const placeX = [R.box.min[0] + 1.3, R.box.min[0] + 2.45];
  const spot = (k) => [placeX[1] + 1.15, Y0 - DY * k];
  const file = [[hook[0] - 7.5, 377.0, Z], [205.0, 376.6, Z], [205.0, 371, Z], [205, 345.5, Z], [P.apronX, 338, Z], [P.apronX, 321, Z], ...P.way.westDown, [spot(0)[0] + 0.3, R.foot - 1.0, Z]];
  const tLaid = [];
  const slotOf = (k) => (k < 6 ? CREW.L[k] : [CREW.F, CREW.C, CREW.WN][k - 6]);
  for (let k = 0; k < 9; k++) {
    const s = crew[slotOf(k)];
    const c = carriers[k];
    const props = [c.right, c.left];
    s.until(c0 + 0.12 + 0.035 * k, { pose: c.pose, heading: ROWH, props, sway: 3, seed: SEED + 100 + k });
    const wp = c.pose === 'carry_limbs' ? 'carry_limbs_walk' : 'carry_walk';
    const sp = spot(k);
    s.walk([...file, [sp[0], R.foot, Z], [sp[0], sp[1], R.kevZ(sp[1])]], { speed: 1.0, pose: wp, props });
    s.act(0.1, { pose: c.pose, heading: 270, props });
    // laid on the ramp, on its west ⚙ pose (bending to lay them down)
    s.act(0.14, { pose: 'bow', phase: [0, 0.42], heading: 270, props });
    tLaid[k] = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270 });
    const names = [c.right, c.left].filter(Boolean);
    names.forEach((nm, j) => {
      const y = sp[1] + (names.length > 1 ? (j === 0 ? 0.3 : -0.3) : 0);
      const x = names.length > 1 ? placeX[j] : (placeX[0] + placeX[1]) / 2;
      items.push({ name: nm, show: [tLaid[k], null], keys: [{ t: tLaid[k], X: x, Y: y, Z: R.kevZ(y) + 0.07, h: 90 + jit(SEED, 12, 'ph', k * 2 + j) }], part: k });
    });
  }
  // and salted them (Tamid 4:3 "and they salted them"): everything that goes on the altar is salted except the wine of
  // the libations, the blood and the wood (Rambam Isurei Mizbeach 5:11; Menachot 20b) — the limbs, the innards, the
  // flour and the chavitin, never the wine. The flour and the chavitin men take salt from the ramp's store (Menachot 21b ⚙)
  const saltAt = cfg.salt;
  let tSalted = 0;
  for (const k of [6, 7]) {
    const s = crew[slotOf(k)];
    const ys = saltAt[1] + 0.9;
    s.walk([[spot(k)[0], ys, R.kevZ(ys)]], { speed: SPEED.slow });
    s.act(0.1, { pose: 'bow', phase: [0, 0.4], face: saltAt });
    s.act(0.08, { pose: 'bow', phase: [0.7, 1], face: saltAt, props: [null, 'salt'] });
    const qs = k === 6 ? [3, 2, 1, 0] : [7, 6, 5, 4];
    for (const q of qs) {
      const sp = spot(q);
      s.walk([[sp[0], sp[1], R.kevZ(sp[1])]], { speed: SPEED.slow, props: [null, 'salt'] });
      s.act(0.2, { pose: 'salt', heading: 270, props: [null, 'salt'] });
    }
    tSalted = Math.max(tSalted, s.now());
  }
  t.salted = tSalted;
  // then they go down to Lishkat HaGazit to read the Shema (Tamid 4:3) / afternoon: they wait south-east of the ramp's
  // foot, a loose knot of men, clear of the amah's open channel ⚙
  const waitC = [R.box.max[0] + 5.2, R.foot - 5.6, Z];
  const waitSpot = (k) => {
    const a = (k * 37 + jit(SEED, 12, 'wa', k)) / 57.2958, r = 1.7 + 0.55 * (k % 3) + jit(SEED, 0.2, 'wr', k);
    return [waitC[0] + Math.sin(a) * r, waitC[1] + Math.cos(a) * r, Z];
  };
  for (let k = 0; k < 9; k++) {
    const s = crew[slotOf(k)];
    s.until(Math.max(s.now(), tSalted + 0.05 + 0.06 * k), { pose: 'stand', heading: 90, sway: 8, seed: SEED + 110 + k });
    s.walk([[R.west + 2.4, s.cur[1] - 1.0, R.kevZ(s.cur[1] - 1.0)], [R.west + 2.4, R.foot, R.z(R.foot)], [R.west + 1.8, R.foot - 1.4, Z]], { speed: SPEED.walk });
    if (cfg.after === 'gazit') s.walk([...P.way.westUp, [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk });
    else {
      s.walk([[R.mid + 1, R.foot - 1.6, Z], waitSpot(k)], { speed: SPEED.walk });
      s.act(0.1, { pose: 'stand', face: waitC });
    }
  }
  // the slaughterer, from Beit HaChalifot: to the Gazit / to wait with the others by the ramp
  if (cfg.after === 'gazit') S.walk([...[...P.way.gazitToNW].reverse(), gz.door, gz.inside], { speed: SPEED.walk });
  else {
    S.walk([[P.apronX, 321, Z], ...P.way.westDown, [R.mid + 1, R.foot - 1.6, Z], waitSpot(9)], { speed: SPEED.walk });
    S.act(0.1, { pose: 'stand', face: waitC });
  }
  t.laid = tLaid;
  // when each reaches the Gazit's door (before anything is appended to his script — gazit-shema takes them in there)
  t.gazitIn = crew.map((x) => (x ? x.tEnd : NaN));
  return { crew, fetch, lamb, leads, items, use, t, spot, placeX, carriers, hook, hookStand, waterAt, lambWater, ring, lambSpot, waitSpot, waitC, slotOf, after: cfg.after };
}

/**
 * Up onto the fire (Tamid 7:3; Yoma 33a): each bearer picks up what lies on the ramp's lower west half, crosses to the
 * east half, goes up, turns right to the great pile, puts his parts on the fire with a throw, goes round and down the
 * west half. scripts[k]: the bearer of part k; order: k in order of going up; times[n]: absolute minute he reaches his
 * part; from(k): waypoints to reach the foot of the ramp. Returns the pick and toss times.
 */
export function limbsUp(P, plan, scripts, order, times, from, into) {
  const Z = P.Z, R = P.ramp, A = P.altar, ZT = A.ZT;
  const picks = into?.picks || [], tossAt = into?.tossAt || [];
  order.forEach((k, n) => {
    const s = scripts[k];
    if (!s) return;
    const c = plan.carriers[k];
    const sp = plan.spot(k);
    const props = [c.right, c.left];
    const walkPose = c.pose === 'carry_limbs' ? 'carry_limbs_walk' : 'carry_walk';
    const pts = [...(from ? from(k) : []), [sp[0] + 0.3, R.foot - 1.2, Z], [sp[0] + 0.3, R.foot, Z], [sp[0] + 0.3, R.foot + 0.5, R.kevZ(R.foot + 0.5)], [sp[0], sp[1] - 0.6, R.kevZ(sp[1] - 0.6)], [sp[0], sp[1], R.kevZ(sp[1])]];
    // waiting where he is until it is time to walk to his part at an ordinary pace
    const go = times[n] - walkMin(s.cur, pts, SPEED.walk);
    if (go > s.now() + 0.02) s.until(go, { pose: 'stand', ...(plan.waitC && plan.after === 'wait' ? { face: plan.waitC } : { face: [R.mid, R.halfY] }), sway: 14, seed: 0x75 + 7 * k });
    s.walkBy(times[n], pts);
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], heading: 270 });
    picks[k] = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270, props });
    // across to the east half and up it (Zevachim 6:3), turning right to the great pile — the first of it he reaches
    // is its south side, toward the SE corner ⚙ (where on the pile is not stated)
    const ex = R.east + jit(0x75, 0.5, 'ex', k);
    const y1 = sp[1] + 1.2;
    const at = [A.great.min[0] + 0.9 + (n % 5) * 1.15, A.great.min[1] - 1.45, ZT];
    s.walk([[ex, y1, R.kevZ(y1)], [ex, R.head - 0.8, R.kevZ(R.head - 0.8)], [ex, R.head + 0.6, ZT], [Math.max(ex + 1, at[0] - 1.2), A.wk.S + 0.6, ZT], at], { speed: SPEED.ramp, pose: walkPose, props });
    s.act(0.1, { pose: c.pose, heading: 0, props });
    tossAt[k] = s.now() + 0.18;
    // put on the fire with a throw (Tamid 7:3 "zorkan"; Zevachim 62b) ⚙
    s.act(0.32, { pose: 'toss', phase: [0, 1], heading: 0, props });
    s.act(0.15, { pose: 'stand', heading: 0 });
    // on round to the right and down the west half (Zevachim 6:3)
    s.walk([[A.wk.E, A.wk.S, ZT], ...circuit(P, 'ne', 'sw'), [R.west, A.wk.S, ZT]], { speed: SPEED.walk });
    s.walk(rampDown(P, R.west + jit(0x75, 0.5, 'dw', k)), { speed: 1.05 });
  });
  return { picks, tossAt };
}

/**
 * The parts of a tamid on the great pile once thrown on (Tamid 7:3): each limb from its toss for `burn` minutes
 * (altar-night's LIMB_BURNS convention ⚙), spread over the east of the pile where they are thrown. The innards (their
 * bazach is not burnt), the flour and the chavitin are not shown on the fire. Keys: absolute (unwrapped) minutes.
 */
export function pileItems(P, plan, tossAt, burn = 240, salt = 0) {
  const g = P.altar.great, Zp = g.max[2] + 0.03;
  const out = [];
  let j = 0;
  for (let k = 0; k < 5; k++) {
    const ta = tossAt?.[k];
    if (!Number.isFinite(ta)) continue;
    const c = plan.carriers[k];
    for (const nm of [c.right, c.left]) {
      if (!nm) continue;
      // on the pile's south part, where they are thrown from (limbsUp), in front of the flames' heart ⚙
      const X = g.min[0] + 0.9 + 1.15 * (j % 5) + jit(0x7069 + salt, 0.2, 'px', j);
      const Y = g.min[1] + 0.75 + 0.5 * Math.floor(j / 5) + 0.22 * (j % 2) + jit(0x7069 + salt, 0.12, 'py', j);
      out.push({ name: nm, show: [ta + 0.1, ta + burn], keys: [{ t: ta + 0.1, X, Y, Z: Zp, h: (60 * j + 25 + salt * 37) % 360 }] });
      j++;
    }
  }
  return out;
}

/** the configuration of the morning or afternoon tamid for the current date (both modules build from this) */
export function cfgFor(kind, ctx, P, Wall) {
  const ls = lambSpots(P);
  const R = P.ramp;
  const carriers = ctx.people?.tamid?.carriers;
  // salt kept on the ramp (Menachot 21b: salt in three places — the salt chamber, on the ramp, on the altar top) ⚙ spot
  const salt = [R.box.min[0] + 0.85, R.foot + 1.7, R.kevZ(R.foot + 1.7) + 0.06];
  if (kind === 'morning') {
    // the inspection "by the light of torches" (Tamid 3:4) — but no light in hand on Shabbat night, as the night's
    // inspection (Rambam BhB 8:12; torch-inspection, night-watch) ⚙ analogy
    const shabbatNight = ctx.time?.dayType === 'shabbat';
    return { kind, ring: P.slaughter.ringM, pillar: 3, rinseTable: 3, W: Wall.m, torches: !shabbatNight, after: 'gazit', carriers, lambFrom: ls.morning, salt, seed: SEEDS.morning };
  }
  // the afternoon crew: on weekdays the morning's winners keep their tasks (Yoma 26a); on Shabbat the incoming mishmar
  const shabbat = ctx.time?.dayType === 'shabbat';
  return { kind, ring: P.slaughter.ringA, pillar: 5, rinseTable: 5, W: Wall.a, torches: false, after: 'wait', carriers, lambFrom: ls.afternoon, salt, seed: shabbat ? SEEDS.shabbatIn : SEEDS.afternoon };
}

/**
 * The afternoon tamid's whole plan (shared: tamid-afternoon stages it, tamid-morning — always relevant — keeps its
 * parts on the fire after the module's window): the crew, the two who bring the two logs (Yoma 2:5), the limbs up,
 * everyone's way back to the Gazit.
 */
export function planAfternoon(ctx, P, Wall) {
  const Z = P.Z, R = P.ramp;
  const A = buildTamid(ctx, P, cfgFor('afternoon', ctx, P, Wall));
  const [u0, u1] = Wall.a.up;
  const logs = pmLogs(Wall.a.up);
  const gz = P.gazit;
  const back = [...P.way.westUp, [P.apronX, 321, Z], ...[...P.way.gazitToNW].reverse(), gz.door, gz.inside];
  // the two who bring the two logs: they come from the Gazit as the others wait by the ramp ⚙
  for (let j = 0; j < 2; j++) {
    const s = Script.from(Wall.a.carry[1] - 2.2 + 0.1 * j, gz.inside, 90, `logs${j}`).exact();
    s.walk([gz.door, ...P.way.gazitToNW, [P.apronX, 321, Z], ...P.way.westDown, [R.mid + 1, R.foot - 1.6, Z], A.waitSpot(10 + j)], { speed: SPEED.walk });
    s.act(0.1, { pose: 'stand', face: A.waitC });
    A.crew[CREW.LOGS[j]] = s;
  }
  // up onto the fire (Yoma 2:5, 33a): the limbs, the two logs, the minchah, the chavitin
  const order = [0, 1, 2, 3, 4, 5, 6, 7];
  const scripts = order.map((k) => A.crew[A.slotOf(k)]);
  const times = [0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 4.1, 4.8].map((x) => u0 + x);
  const up = limbsUp(P, A, scripts, order, times, null);
  if (logs) {
    const tPick = [u0 + 1.1, u0 + 1.25], tLay = u0 + 3.0;
    for (let j = 0; j < 2; j++) {
      const s = A.crew[CREW.LOGS[j]];
      const st = stackPoint(j);
      // the logs from the stack east of the ramp's foot (kept with terumat-hadeshen's wood) ⚙
      s.until(tPick[j] - 0.3, { pose: 'stand', face: A.waitC, sway: 14, seed: 0x6c + j });
      s.walkBy(tPick[j] - 0.05, [[st[0] - 1.3, st[1], Z]]);
      s.act(0.05, { pose: 'bow', phase: [0, 0.45], face: st });
      s.act(0.1, { pose: 'bow', phase: [0.6, 1], face: st, props: ['log', null] });
      const ex = R.east + jit(0x6c, 0.4, 'lx', j);
      s.walk([[ex, R.foot - 1.2, Z], [ex, R.foot, R.z(R.foot)]], { speed: SPEED.walk, pose: 'carry_shoulder_walk', props: ['log', null] });
      s.walk(rampUp(P, ex), { speed: SPEED.ramp, pose: 'carry_shoulder_walk', props: ['log', null] });
      s.walkBy(tLay - 0.12, [[P.altar.wk.E, P.altar.wk.S, P.altar.ZT], [P.altar.greatFace[0], P.altar.greatFace[1] + (j ? 1.2 : -1.2), P.altar.ZT]], { pose: 'carry_shoulder_walk', props: ['log', null] });
      s.act(0.3, { pose: 'toss', phase: [0, 1], heading: 270, props: ['log', null] });
      s.walk([[P.altar.wk.E, P.altar.wk.N, P.altar.ZT], [P.altar.wk.W, P.altar.wk.N, P.altar.ZT], [P.altar.wk.W, P.altar.wk.S, P.altar.ZT], [R.west, P.altar.wk.S, P.altar.ZT]], { speed: SPEED.walk });
      s.walk(rampDown(P, R.west), { speed: 1.05 });
      s.walk(back, { speed: SPEED.walk });
    }
  }
  for (const k of order) scripts[k].walk([[R.west, R.foot - 2.2, Z], ...back], { speed: SPEED.walk });
  // the wine stays with the slaughterer's crew: its bearer and the slaughterer leave when the parts have gone up ⚙
  for (const slot of [CREW.WN, CREW.S]) {
    const s = A.crew[slot];
    s.until(u0 + 5.4 + (slot === CREW.S ? 0.2 : 0), { pose: 'stand', heading: 40, sway: 10, seed: 0x71 + slot });
    s.walk([[R.mid + 1, R.foot - 1.6, Z], ...back], { speed: SPEED.walk });
  }
  void u1;
  return { A, up, logs, order };
}

/** the stack boards the two afternoon log bearers take (terumat-hadeshen's spots 14, 15) — same arithmetic as there ⚙ */
export function stackPoint(j) {
  return [230.9, 276.7 + j * 2.15, 16];
}

/** the vessels brought out of Lishkat HaKelim (Tamid 3:4: ninety-three of silver and gold) — what is shown of them: per
 *  bearer, per trip, two in his hands; to the silver table west of the ramp (Shekalim 6:4) or the marble table ⚙ */
export const VESSEL_LOADS = [
  [{ to: 'silver', props: ['mizrak_gold', 'mizrak_gold'], q: [0, 1] }, { to: 'silver', props: ['mizrak_silver', 'mizrak_silver'], q: [2, 3] }],
  [{ to: 'silver', props: ['bowl', 'bowl'], q: [4, 5] }, { to: 'marble', props: ['bowl', null], q: ['bowl'] }],
  [{ to: 'marble', props: ['cup_gold', 'mizrak_silver'], q: ['cup_gold', 'mizrak_silver'] }],
];
/** … and taken back after the afternoon service, a pair a trip ⚙: per table, the slots of each trip */
export const RETURN_TRIPS = { marble: [['cup_gold', 'mizrak_silver'], ['bowl']], silver: [[0, 1], [2, 3], [4, 5]] };
/** a slot on the silver table (two rows of three) */
export function silverSlot(P, q) {
  const ts = P.tables.silver;
  return [ts.min[0] + (q % 2 ? 0.72 : 0.28), ts.min[1] + 0.35 + 0.65 * Math.floor(q / 2), ts.max[2]];
}

/**
 * The vessels taken back to Lishkat HaKelim when the afternoon service is done ⚙ (the Mishnah describes only taking
 * them out): one man the marble table's, one the silver table's, a pair a trip (RETURN_TRIPS). Shared: tamid-morning
 * hides the table props at the pick times, tamid-afternoon stages the two kohanim. Returns { scripts, pick: { marble:
 * [t per trip], silver: [...] } }.
 */
export function buildReturn(P, up1, extend) {
  const Z = P.Z, K = P.kelim, gz = P.gazit, VT = vesselTable(P), tb = P.tables;
  const north = [gz.door, ...P.way.gazitToNW.slice(0, 3), [200, 386.4, Z]];
  // the duchan's steps down to Ezrat Yisrael and the chamber: stairs (the floor is queried)
  const up = [[243.0, 380.2, 15], [245.2, 380.2, K.ZY], [K.out[0] - 1.5, K.out[1] - 1.2, K.ZY], K.out, K.door, K.in];
  const down = [K.door, K.out, [K.out[0] - 1.5, K.out[1] - 1.2, K.ZY], [245.2, 380.2, K.ZY], [243.0, 380.2, 15], [241.4, 380.2, Z]];
  const t0 = up1 + 1.5;
  // continue the given scripts (out of sight in the Gazit until then) or start new ones
  const start = (i, tt) => (extend?.[i] ? extend[i].hide(tt, gz.inside, 90) : Script.from(tt, gz.inside, 90, `return${i}`).exact());
  const trips = (s, list, toTable, fromTable, stand, heading, propsOf) => {
    const picks = [];
    list.forEach((load, j) => {
      s.walk(j === 0 ? toTable.first : toTable.again, { speed: SPEED.walk });
      s.act(0.1, { pose: 'bow', phase: [0, 0.4], heading });
      picks.push(s.now());
      const pr = propsOf(load);
      s.act(0.1, { pose: 'bow', phase: [0.7, 1], heading, props: pr });
      s.walk(fromTable, { speed: SPEED.walk, props: pr });
      s.walk(up, { speed: 0.9, props: pr, zExact: false });
      // set back on the shelves inside ⚙
      s.act(0.12, { pose: 'bow', phase: [0, 0.4], heading: 0, props: pr });
      s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 0 });
      if (j < list.length - 1) s.walk(down, { speed: 0.9, zExact: false });
    });
    void stand;
    return picks;
  };
  // the marble table's vessels
  const a = start(0, t0);
  const mStand = [VT.stand[0], VT.stand[1] + 0.3, Z];
  const pickM = trips(a, RETURN_TRIPS.marble,
    { first: [...north, [VT.stand[0] - 6, 386.4, Z], [VT.stand[0] - 6, 382.2, Z], [VT.stand[0] - 6, 376.4, Z], mStand], again: [[234.5, 378.8, Z], [VT.stand[0] + 3, 376.6, Z], mStand] },
    [[VT.stand[0] + 3, 376.6, Z], [234.5, 378.8, Z], [241.4, 380.2, Z]], mStand, 180, (load) => [load[0] || null, load[1] || null]);
  // the silver table's, round the south of the ramp and up the east of the court
  const b = start(1, t0 + 0.1);
  const sStand = tb.silverStand;
  const sBack = [[sStand[0] + 0.5, tb.silver.min[1] - 1.6, Z], [208.0, 273.4, Z], [231.2, 273.2, Z], ...[...P.way.eastBend].reverse(), [P.way.eastLine, 372, Z], [241.4, 380.2, Z]];
  const pickS = trips(b, RETURN_TRIPS.silver,
    { first: [gz.door, ...P.way.gazitToNW, [P.apronX, 321, Z], ...P.way.westDown.slice(0, -1), [sStand[0], tb.silver.min[1] - 1.6, Z], sStand], again: [...[...sBack].reverse().slice(1), sStand] },
    sBack, sStand, 270, (load) => (load[0] === 0 ? ['mizrak_gold', 'mizrak_gold'] : load[0] === 2 ? ['mizrak_silver', 'mizrak_silver'] : ['bowl', 'bowl']));
  return { scripts: [a, b], pick: { marble: pickM, silver: pickS }, pickM: pickM[0], pickS: pickS[0] };
}

/**
 * Shabbat: the Kohen Gadol offers the limbs (Tamid 7:3; Rambam KhM 5:12 — he offers on Shabbatot). He goes up the ramp
 * with the segan at his right; at its middle the segan takes him by the right hand and brings him up. The first bearer
 * hands him the head and the hind leg; he leans his hands on them and throws them on the fire. The second hands the
 * forelegs to the first, who gives them to him, and slips away — and so with all the limbs. Then he goes round the
 * altar from the SE corner to the NE, the NW and the SW, where the wine is given him to pour (libation-song's scene).
 * scripts[0..5]: the six bearers (positioned where they appear); upWin: limbs-up [t0, t1] (unwrapped).
 */
export function kohenGadol(P, plan, scripts, upWin, from) {
  const Z = P.Z, R = P.ramp, A = P.altar, ZT = A.ZT;
  const [u0, u1] = upWin;
  const head = R.head - 1.4;
  const at = (x, y) => [x, y, R.kevZ(y)];
  const kgAt = at(R.east - 0.3, head);                     // near the head of the ramp, its east half ⚙
  const sgAt = at(R.east + 1.1, head - 0.7);               // the segan at his right
  const firstAt = at(R.east - 1.8, head - 1.0);            // the first bearer at his left, handing up ⚙
  const nextAt = at(R.east - 2.3, head - 2.5);             // each next one behind the first
  const toFire = 18;                                       // heading of the throw: the great pile is north-north-east ⚙
  // G3 (g3/morning.js) brings them from the Ulam's steps to the apron's north end, its scripts ending at limbs-up t0;
  // at t1 its libation takes them over at the SW corner (g3/song.js). Ours start just after t0 and end just before t1,
  // so the same man is never drawn twice at the boundary instant
  const apron = [P.apronX, 339.0, Z];
  const kg = Script.from(u0 + 0.002, apron, 180, 'kohen-gadol').exact();
  const sg = Script.from(u0 + 0.002, [apron[0], apron[1] + 1.2, Z], 180, 'segan').exact();
  const way = [[P.apronX, 321, Z], ...P.way.westDown];
  kg.walkBy(u0 + 1.3, [...way, [R.east - 0.3, R.foot - 1.4, Z]], { speed: 0.8 });
  sg.walkBy(u0 + 1.3, [[P.apronX, 322.2, Z], ...P.way.westDown.map((p) => [p[0] + 0.45, p[1] - 0.9, p[2]]), [R.east + 1.1, R.foot - 1.6, Z]]);
  // up to the middle of the ramp, the segan at his right (Tamid 7:3)
  const mid = R.halfY;
  kg.walkBy(u0 + 1.95, [[R.east - 0.3, R.foot, R.z(R.foot)], at(R.east - 0.3, R.foot + 0.6), at(R.east - 0.3, mid)]);
  sg.walkBy(u0 + 1.95, [[R.east + 1.1, R.foot, R.z(R.foot)], at(R.east + 1.1, R.foot + 0.6), at(R.east + 1.1, mid)]);
  const tMid = kg.now();
  kg.act(0.2, { pose: 'stand', heading: 0 });
  sg.act(0.2, { pose: 'lead', heading: 300 });            // turning to him, his right hand in the segan's ⚙ pose
  kg.walkBy(u0 + 2.75, [kgAt]);
  sg.walkBy(u0 + 2.75, [sgAt], { pose: 'lead_walk' });
  // the handing: the head and leg first, then each part through the first's hands (⚙ minutes)
  const tH = [0, 1, 2, 3, 4, 5].map((k) => u0 + 3.4 + 0.95 * k);
  const picks = [], tossAt = [];
  for (let k = 0; k < 6; k++) {
    const s = scripts[k];
    const c = plan.carriers[k], sp = plan.spot(k);
    const props = [c.right, c.left];
    const walkPose = c.pose === 'carry_limbs' ? 'carry_limbs_walk' : 'carry_walk';
    const pts = [...(from ? from(k) : []), [sp[0] + 0.3, R.foot - 1.2, Z], [sp[0] + 0.3, R.foot, Z], at(sp[0] + 0.3, R.foot + 0.5), at(sp[0], sp[1] - 0.6), at(sp[0], sp[1])];
    const tAt = tH[k] - (k === 0 ? 1.15 : 1.5);
    const go = tAt - 0.25 - walkMin(s.cur, pts, SPEED.walk);
    if (go > s.now() + 0.02) s.until(go, { pose: 'stand', face: [R.mid, R.halfY], sway: 12, seed: 0x75 + 7 * k });
    s.walkBy(tAt - 0.25, pts);
    s.act(0.12, { pose: 'bow', phase: [0, 0.42], heading: 270 });
    picks[k] = s.now();
    s.act(0.12, { pose: 'bow', phase: [0.7, 1], heading: 270, props });
    const dest = k === 0 ? firstAt : nextAt;
    s.walkBy(tH[k] - (k === 0 ? 0.15 : 0.55), [at(R.east - 1.0, sp[1] + 1.2), at(dest[0], dest[1] - 1.2), dest], { pose: walkPose, props });
    if (k === 0) {
      s.until(tH[0], { pose: c.pose, face: kgAt, props });
      s.act(0.15, { pose: 'carry_limbs', face: kgAt });
    } else {
      // to the first, who passes them on (Tamid 7:3); then he slips away
      s.until(tH[k] - 0.42, { pose: c.pose, face: firstAt, props });
      s.act(0.12, { pose: 'carry_limbs', face: firstAt });
      s.act(0.1, { pose: 'stand', face: firstAt });
      s.walk([at(R.west, nextAt[1] - 1.5), ...rampDown(P).slice(2)], { speed: 1.0 });
    }
  }
  // the first: passing each part on to him
  {
    const s = scripts[0];
    for (let k = 1; k < 6; k++) {
      const c = plan.carriers[k];
      s.until(tH[k] - 0.42, { pose: 'stand', face: nextAt, sway: 5, seed: 0x76 + k });
      s.act(0.12, { pose: 'carry_limbs', face: nextAt, props: [c.right, c.left] });
      s.walk([firstAt], { speed: 0.5, pose: 'carry_limbs_walk', props: [c.right, c.left] });
      s.until(tH[k], { pose: c.pose, face: kgAt, props: [c.right, c.left] });
      s.act(0.15, { pose: 'carry_limbs', face: kgAt });
    }
    s.until(tH[5] + 0.6, { pose: 'stand', face: kgAt });
    s.walk([at(R.west, firstAt[1] - 1.0), ...rampDown(P).slice(2)], { speed: 1.0 });
  }
  // he leans on them and throws them (Tamid 7:3)
  for (let k = 0; k < 6; k++) {
    const c = plan.carriers[k];
    const props = [c.right, c.left];
    kg.until(tH[k], { pose: 'stand', heading: toFire - 25, sway: 6, seed: 0x77 + k });
    kg.act(0.12, { pose: 'carry_limbs', heading: toFire - 40, props });
    kg.act(0.28, { pose: 'semichah', heading: toFire, props });
    tossAt[k] = kg.now() + 0.15;
    kg.act(0.32, { pose: 'toss', phase: [0, 1], heading: toFire, props });
  }
  sg.until(tH[5] + 0.75, { pose: 'stand', face: kgAt, sway: 6, seed: 0x78 });
  // round the altar: SE, NE, NW, SW (Tamid 7:3); the segan with him
  const tRound = kg.now() + 0.1;
  const swAt = [A.wk.W + 0.4, A.wk.S + 0.6, ZT];
  kg.walk([[R.east + 1.5, R.head + 0.6, ZT], ...circuit(P, 'se', 'sw'), swAt], { speed: 0.7 });
  // the segan a few paces behind him on the same walkway (the west side passes the incense pile closely)
  sg.until(Math.max(sg.now(), tRound + 0.06), { pose: 'stand', face: kgAt, sway: 4, seed: 0x7b });
  sg.walk([[R.east + 2.4, R.head + 0.6, ZT], ...circuit(P, 'se', 'sw'), [swAt[0] + 1.2, swAt[1] + 0.3, ZT]], { speed: 0.7 });
  kg.until(u1 - 0.002, { pose: 'stand', heading: 225, sway: 4, seed: 0x79 });
  sg.until(u1 - 0.002, { pose: 'stand', face: swAt, sway: 4, seed: 0x7a });
  return { kg, segan: sg, up: { picks, tossAt }, cue: { mid: wrap(tMid + 0.05), first: wrap(tH[0] + 0.2), round: wrap(tRound) }, swAt };
}

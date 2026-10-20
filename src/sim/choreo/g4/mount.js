// Har HaBayit for group G4: the circuit everyone walks (Middot 2:2), its gates, the thirteen prostration stations
// opposite the repaired breaches of the soreg (Middot 2:3), and the spurs from the circuit up into the courts and
// chambers. Site amot; every vertex carries its exact floor height (the Mount at 0, the sourced stairs by their
// tread-midpoint lines), so walkers need no physics query.
//
// "All who enter Har HaBayit enter by the right, go round, and leave by the left — except one to whom something has
// happened, who goes round to the left" (Middot 2:2). Entering from the south facing north, the right is east: the
// stream goes round COUNTER-CLOCKWISE (seen from above), the courts on its left — south side eastward, east side
// northward, north side westward, west side southward. The mourner and the one under a ban go clockwise, against it.
//
// The circuit (⚙ its line): a rectangle round the soreg, clear of the gate flights that cross it (feet at Y 242 and
// Y 419 / 430), of the Gazit flight and the soreg's western jog (X 27–33) and of Beit HaEven (Y 432–447):
//   south Y 236 · east X 420 · north Y 452 · west X 25.
// Public gates: the two Chuldah gates (south, through their tunnels — "for entry and exit", Middot 1:3) and Kiponus
// (west, over its bridge — "for entry and exit"). Shushan is the Parah's and Tadi served nothing (Middot 1:3).
//
// Who walks where (so nobody walks through anybody — the review's sweep):
//   * the stream keeps to LANES right of the circuit line, one lane per walking speed (SPEEDS): walkers in a lane all
//     go at its speed, so none overtakes another inside it; a G4Book LaneBook keeps any two of them at least GAP apart
//     (a walker about to step into a lane where another is passing waits a moment);
//   * the mourner walks ON the line itself, against the stream, between the lanes and the prostration places;
//   * each prostration has its own place in a row LEFT of the line, between it and the soreg: eleven places 1.2 m
//     apart along the circuit at every station (the arms of a full-length prostration reach ±0.5 m), booked in the
//     G4Book — one figure per place, a party taking places one behind another.
import { AMAH } from '../../../core/units.js';
import { clamp } from '../../lib/core.js';
import { Route, Itin } from './lib.js';
import { LaneBook } from './book.js';

export const LOOP_PTS = [[25, 236, 0], [420, 236, 0], [420, 452, 0], [25, 452, 0]];
export const LOOP = new Route(LOOP_PTS, { loop: true, round: 5 });
export const L = LOOP.length;                       // metres
/** loop distance (m) of a point on the circuit line */
export function sOf(X, Y) {
  if (Math.abs(Y - 236) < 1e-6) return (X - 25) * AMAH;
  if (Math.abs(X - 420) < 1e-6) return (395 + (Y - 236)) * AMAH;
  if (Math.abs(Y - 452) < 1e-6) return (611 + (420 - X)) * AMAH;
  return (1006 + (452 - Y)) * AMAH;
}
export const fwd = (a, b) => ((((b - a) % L) + L) % L);   // counter-clockwise metres from a to b
export const back = (a, b) => fwd(b, a);                 // clockwise metres from a to b
const modL = (s) => ((s % L) + L) % L;

// ------------------------------------------------------------------------------------------------ lanes
/** the stream's walking speeds (m/s); a walker goes at the class nearest his own pace */
export const SPEEDS = [1.1, 1.25, 1.4];
export const classOf = (v) => (v < 1.175 ? 0 : v < 1.325 ? 1 : 2);
// metres right of the walking direction, per class. The west side is narrow (the west stoa's front at X ≈ 21, the
// soreg's jog and the Gazit flight at X 27): its lanes are pressed closer ⚙
const LANE = [0.75, 1.45, 2.15], LANE_W = [0.5, 0.95, 1.4];
const SIDE_END = [395, 611, 1006, 1222].map((a) => a * AMAH);     // loop distance where the S, E, N, W sides end
const sideIdx = (s) => { const m = modL(s); return m < SIDE_END[0] ? 0 : m < SIDE_END[1] ? 1 : m < SIDE_END[2] ? 2 : 3; };
export const laneSide = (s, cls) => (sideIdx(s) === 3 ? LANE_W : LANE)[cls];
/** minimal spacing (m) of two walkers' lines in one lane */
const GAP = 1.15;
// in the gate passages and up the spurs' stairs: a sub-lane per class too (the Chuldah passages are 10 wide, the in
// half on the right) ⚙
const GATE_SUB = [0.15, 0.55, 0.95];
export const SPUR_SUB = [-0.2, 0.2, 0.6];
const MAX_WAIT = 0.8;    // minutes a walker will stand aside for the lane to clear

/** the lanes of the day's register (made on first use) */
function lanesOf(book) {
  if (!book.lanes.length) for (let c = 0; c < SPEEDS.length; c++) book.lanes.push(new LaneBook(SPEEDS[c], L, GAP));
  return book.lanes;
}

// ------------------------------------------------------------------------------------------------ the thirteen stations
// mount.soreg.breaches params.stations (positions ⚙ — site.js spreads them by the gates view's side counts)
export const BREACHES = [
  { n: 1, at: [97.625, 248], side: 'S' }, { n: 2, at: [186.875, 248], side: 'S' }, { n: 3, at: [276.125, 248], side: 'S' }, { n: 4, at: [365.375, 248], side: 'S' },
  { n: 9, at: [410, 272.166667], side: 'E' }, { n: 10, at: [410, 296.333333], side: 'E' }, { n: 11, at: [410, 376.75], side: 'E' },
  { n: 8, at: [362.875, 413], side: 'N' }, { n: 7, at: [268.625, 413], side: 'N' }, { n: 6, at: [174.375, 413], side: 'N' }, { n: 5, at: [76, 413], side: 'N' },
  { n: 13, at: [33, 374], side: 'W' }, { n: 12, at: [53, 304.5], side: 'W' },
].map((b) => {
  const p = b.side === 'S' ? [b.at[0], 236] : b.side === 'N' ? [b.at[0], 452] : b.side === 'E' ? [420, b.at[1]] : [25, b.at[1]];
  return { ...b, loop: p, s: sOf(p[0], p[1]), face: { S: 0, E: 270, N: 180, W: 90 }[b.side] };
}).sort((a, b) => a.s - b.s);

// The prostration places: NCOL along the circuit, COL_DX apart, their standing point COL_LAT left of the line (the
// body lies forward toward the soreg: feet ≈ 0.6 m behind the standing point, hands ≈ 1.6 m ahead). A station's row
// is moved along where something stands in its way ⚙: no. 13 south of the Gazit's flight, no. 1 short of Sha'ar
// HaDelek's spur, no. 8 west of Beit HaEven.
export const NCOL = 11, COL_DX = 1.2, COL_LAT = 1.2;
const COL_SHIFT = { 13: 8, 1: -3, 8: 6 };
for (const b of BREACHES) {
  b.cols = Array.from({ length: NCOL }, (_, c) => (COL_SHIFT[b.n] || 0) + (c - (NCOL - 1) / 2) * COL_DX);
  // the places in order of preference: the middle of the row first
  b.order = b.cols.map((off, c) => ({ off, c })).sort((x, y) => Math.abs(x.off - (COL_SHIFT[b.n] || 0)) - Math.abs(y.off - (COL_SHIFT[b.n] || 0)) || x.c - y.c);
}
/** the standing point of a station's place at loop distance s (left of the line, i.e. toward the soreg) */
const colPoint = (s) => { const q = LOOP.sample(s, {}, -COL_LAT); return [q.X, q.Y, 0]; };
const linePoint = (s, side = 0, rev = false) => { const q = LOOP.sample(s, {}, side, rev); return [q.X, q.Y, 0]; };

/** read the stations from the site when it has them (same order rule) */
export function syncBreaches(ctx) {
  const st = ctx.elOpt?.('mount.soreg.breaches')?.params?.stations;
  if (!Array.isArray(st) || st.length !== 13) return;
  for (const b of BREACHES) {
    const s = st.find((x) => x.n === b.n);
    if (!s) continue;
    b.at = s.pos;
  }
}

// ------------------------------------------------------------------------------------------------ gates
// Each gate: `in` from where a figure appears (out of sight: deep in a Chuldah tunnel, far out on Kiponus' bridge) to
// its junction on the circuit (heading with the stream); `out` from the circuit to where it is gone. Lanes keep to the
// right: in on one half of the passage, out on the other.
const chuldah = (x) => ({
  in: [[x + 2, 26, -27.083], [x + 2, 44.75, -27.083], [x + 2, 71.75, 0], [x + 2, 226, 0], [x + 4.5, 232.5, 0], [x + 9, 236, 0]],
  out: [[x - 7, 236, 0], [x - 3.5, 232.5, 0], [x - 2, 226, 0], [x - 2, 71.75, 0], [x - 2, 44.75, -27.083], [x - 2, 26, -27.083]],
});
export const GATES = {
  cw: { name: 'the western Chuldah gate', ...chuldah(165) },
  ce: { name: 'the eastern Chuldah gate', ...chuldah(335) },
  k: {
    name: 'Kiponus',
    in: [[-190, 247.5, 0], [-2, 247.5, 0], [16, 247.5, 0], [22, 244, 0], [25, 238.5, 0]],
    out: [[25, 258, 0], [21, 253, 0], [14, 252.5, 0], [-2, 252.5, 0], [-190, 252.5, 0]],
  },
};
for (const g of Object.values(GATES)) {
  g.inRoute = new Route(g.in, { round: 2.5 });
  g.outRoute = new Route(g.out, { round: 2.5 });
  const a = g.in[g.in.length - 1], b = g.out[0];
  g.sIn = sOf(a[0], a[1]);          // where it joins the stream
  g.sOut = sOf(b[0], b[1]);         // where it leaves it
}
export const GATE_IDS = ['cw', 'ce', 'k'];

// ------------------------------------------------------------------------------------------------ spurs into the courts
// From the circuit (with the stream) up to a place, and back down to the circuit (continuing with the stream).
// Stairs by their tread-midpoint lines: the chel steps (12 × ½, Middot 2:3), the gates' 32-step flights, the Gazit's
// flight to its chol door, Beit HaMoked's flight to its chel door.
export const SPURS = {
  // the east entry of the soreg → the chel steps → the east gate of Ezrat Nashim
  en: {
    in: [[420, 327, 0], [414, 332, 0], [406.25, 332, 0], [399.75, 332, 6], [393, 332, 6]],
    out: [[393, 329, 6], [399.75, 329, 6], [406.25, 329, 0], [413, 329, 0], [420, 334, 0]],
  },
  // Sha'ar HaDelek's flight (south) into the Azarah
  delek: {
    in: [[104, 236, 0], [108, 239, 0], [113.5, 241, 0], [113.5, 241.75, 0], [113.5, 257.75, 16], [113.5, 266, 16]],
    out: [[110.75, 266, 16], [110.75, 257.75, 16], [110.75, 241.75, 0], [112, 239, 0], [118, 236, 0]],
  },
  // Sha'ar HaMayim's flight (south)
  mayim: {
    in: [[202.5, 236, 0], [206.5, 239, 0], [212, 241, 0], [212, 241.75, 0], [212, 257.75, 16], [212, 266, 16]],
    out: [[209.25, 266, 16], [209.25, 257.75, 16], [209.25, 241.75, 0], [210.5, 239, 0], [216.5, 236, 0]],
  },
  // the Gazit's flight (west) to its chol door
  gazit: {
    in: [[25, 386, 0], [26.75, 383.5, 0], [42.75, 383.5, 16], [46, 383.5, 16]],
    out: [[46, 379, 16], [42.75, 379, 16], [26.75, 379, 0], [25, 376, 0]],
  },
  // Sha'ar HaNitzotz's flight (north) into the Azarah's north-west (the Golah)
  nitzotz: {
    in: [[116, 452, 0], [114.5, 446, 0], [114.5, 419.25, 0], [114.5, 403.25, 16], [114.5, 396, 16]],
    out: [[110, 396, 16], [110, 403.25, 16], [110, 419.25, 0], [110, 446, 0], [107.5, 452, 0]],
  },
  // Sha'ar HaKorban's flight (north): to its foot on the chel (the flight itself is walked on private-offerings' graph)
  korban: {
    in: [[167.5, 452, 0], [164.5, 446, 0], [163.0, 424, 0], [161.5, 419.6, 0]],
    out: [[161.5, 419.6, 0], [159.5, 424, 0], [158.5, 446, 0], [155.5, 452, 0]],
  },
  // the foot of the Gazit's flight, stepping off the stream on the west side (the Shabbat court, its askers)
  flightFoot: {
    in: [[25, 385, 0], [24.6, 381.0, 0]],
    out: [[24.6, 381.0, 0], [25, 377, 0]],
  },
  // Beit HaMoked's flight (north) to its door to the chel and into the hall's chol half
  moked: {
    in: [[217, 452, 0], [214.5, 446, 0], [214.5, 430.25, 0], [214.5, 414.25, 16], [214.5, 409, 16]],
    out: [[207.5, 409, 16], [207.5, 414.25, 16], [207.5, 430.25, 0], [207.5, 446, 0], [204, 452, 0]],
  },
};
for (const sp of Object.values(SPURS)) {
  sp.inRoute = new Route(sp.in, { round: 1.6 });
  sp.outRoute = new Route(sp.out, { round: 1.6 });
  sp.sIn = sOf(sp.in[0][0], sp.in[0][1]);
  sp.sOut = sOf(sp.out[sp.out.length - 1][0], sp.out[sp.out.length - 1][1]);
}

/** metres from a loop point counter-clockwise to the first gate exit (≥ minArc), and that gate */
export function exitAfter(s, minArc = 30, allowed = GATE_IDS) {
  let best = null, bd = Infinity;
  for (const id of allowed) {
    const d = fwd(s, GATES[id].sOut);
    const dd = d < minArc ? d + L : d;
    if (dd < bd) { bd = dd; best = id; }
  }
  return { id: best, arc: bd };
}
/** the entry gate whose junction lies counter-clockwise closest before loop point s (≥ minArc of circuit first) */
export function entryBefore(s, minArc = 30, allowed = GATE_IDS) {
  let best = null, bd = Infinity;
  for (const id of allowed) {
    const d = fwd(GATES[id].sIn, s);
    const dd = d < minArc ? d + L : d;
    if (dd < bd) { bd = dd; best = id; }
  }
  return { id: best, arc: bd };
}

// ------------------------------------------------------------------------------------------------ booking context
/**
 * An itinerary built for real (not a timing probe) carries it.mp = { book, t0, who, taken: [] }: the day's G4Book,
 * the clock minute its minute 0 falls on, the booking module, and the bookings made (to undo). walkLoop books the
 * prostration places and the lane stretches it uses at their clock times (t0 + it.T as it is built).
 */
export function mpOf(book, t0, who) { return book ? { book, t0, who, taken: [] } : null; }
/** undo an itinerary's bookings */
export function release(mp) {
  if (!mp) return;
  for (const h of mp.taken) (h.lane || h.s).remove(h);
  mp.taken.length = 0;
}

/**
 * Build an itinerary so that its moment `it.mark` falls on clock minute `target`, with bookings (a probe build without
 * bookings first, then up to three booked builds, each shifted by the last one's error — waits before the mark move
 * it). build(mp) → Itin (it must set it.mp = mp before walking and it.mark). Returns { it, t0 }.
 */
export function fitAt(book, who, target, build) {
  const probe = build(null);
  let t0 = target - probe.mark;
  if (!book) return { it: probe, t0 };
  let it = null;
  for (let k = 0; k < 4; k++) {
    const mp = mpOf(book, t0, who);
    it = build(mp);
    const err = t0 + it.mark - target;
    if (Math.abs(err) < 0.02 || k === 3) break;
    release(mp);
    t0 -= err;
  }
  return { it, t0 };
}
/** a walker whose start is free: built from clock minute t0 (when his lane is not clear where he steps onto the
 * circuit he waits a moment at the junction); with `tries` > 0 rebuilt a little later instead. Returns { it, t0 }. */
export function buildFrom(book, who, t0, build, tries = 0) {
  let it = null;
  for (let k = 0; k <= tries; k++) {
    const mp = mpOf(book, t0, who);
    it = build(mp);
    if (!mp || !mp.waitedAtEntry || k === tries) break;
    release(mp);
    t0 += 0.035;
  }
  return { it, t0 };
}

// ------------------------------------------------------------------------------------------------ itinerary pieces
export const PROSTRATE_MIN = 0.42;                   // minutes at a station: turn, full-length prostration, turn back
const prostratePhase = (k, u) => Math.min(1, Math.max(0, (u - 0.05) / 0.32));
const STEP_OUT = 0.8;                                 // m along the circuit over which a walker steps to his place
/** minutes of a straight step between two site points at v m/s (as Itin.walkTo walks it) */
const stepMin = (a, b, v) => (Math.hypot(b[0] - a[0], b[1] - a[1]) * AMAH) / v / 60;

/** walk counter-clockwise in lane `cls` from loop distance a to b (a < b, unwrapped), side by side per circuit side,
 * booking the stretch (the caller has made sure the lane is clear: laneWait) */
function laneWalk(it, a, b, cls, wo) {
  if (b - a < 1e-3) return;
  const v = SPEEDS[cls];
  const mp = it.mp;
  if (mp && wo.lanes !== false) mp.taken.push(lanesOf(mp.book)[cls].add(a, mp.t0 + it.T, mp.t0 + it.T + (b - a) / v / 60, mp.who));
  let cur = a;
  while (cur < b - 1e-6) {
    const m = modL(cur), base = cur - m;
    const si = sideIdx(cur);
    const end = Math.min(b, base + SIDE_END[si]);
    const stop = end > cur + 1e-6 ? end : b;
    it.walk(LOOP, cur, stop, v, { pose: wo.pose, prop: wo.prop, hand: wo.hand, side: (si === 3 ? LANE_W : LANE)[cls] });
    cur = stop;
  }
}
/** minutes to wait (where he stands, out of the lane) so that the lane stretch a → b, entered `lead` minutes from now,
 * merges with nobody (0 on a probe build) */
function laneWait(it, a, b, cls, lead, wo) {
  const mp = it.mp;
  if (!mp || wo.lanes === false || b - a < 1e-3) return 0;
  const lane = lanesOf(mp.book)[cls], dur = (b - a) / SPEEDS[cls] / 60;
  let w = 0;
  while (w < MAX_WAIT && lane.conflict(a, mp.t0 + it.T + lead + w, mp.t0 + it.T + lead + w + dur)) w += 0.035;
  return w;
}

/**
 * Walk the circuit from loop distance s0 for `arc` metres (dir +1 with the stream, −1 against it), prostrating opposite
 * every repaired breach passed (Middot 2:3). opts { v (→ its speed class), cls, line (walk on the circuit line itself —
 * the one going against the stream; no lane), pose, prop, hand, prostrate (default true), stops: [{ d, min, heading,
 * pose, phase, at }] extra stops (`at`: stepped out of the lane to stand there), prev: Map station → the place offset
 * of the party member ahead (take a place behind his), lanes (false: no lane booking) }.
 * A walker never waits in a lane: where a lane is about to be entered while someone passes in it, he waits a moment
 * where he stands (at the junction, at his prostration place) before stepping in. Returns the itinerary;
 * it.cols = Map station → the place offset used.
 */
export function walkLoop(it, s0, arc, opts) {
  const dir = opts.dir ?? 1;
  const cls = opts.cls ?? classOf(opts.v ?? 1.25);
  const v = opts.line ? (opts.v ?? 1.05) : SPEEDS[cls];
  const stops = [];
  if (opts.prostrate !== false) {
    for (const b of BREACHES) {
      const d = dir > 0 ? fwd(s0, b.s) : back(s0, b.s);
      if (d > 0.5 && d < arc - 0.5) stops.push({ d, b });
    }
  }
  for (const x of opts.stops || []) stops.push(x);
  stops.sort((a, b) => a.d - b.d);
  const wo = { pose: opts.pose || 'walk', prop: opts.prop ?? null, hand: opts.hand, lanes: opts.lanes };
  const mv = { pose: wo.pose, prop: wo.prop, hand: wo.hand };
  it.cols = it.cols || new Map();
  let done = 0, first = true;
  // where the next lane stretch from `d` would end (the next stop's step-out, or the end of the walk)
  const stretchEnd = (d, i) => {
    for (let k = i; k < stops.length; k++) {
      const st = stops[k];
      const dn = st.d - (st.b || st.at ? STEP_OUT : 0);
      if (dn > d + 0.01) return dn;
    }
    return arc;
  };
  // stand aside until the lane is clear for the stretch from `d` (entered `lead` minutes from now)
  const clear = (d, i, lead, face) => {
    if (opts.line) return 0;
    const w = laneWait(it, s0 + d, s0 + stretchEnd(d, i), cls, lead, wo);
    if (w > 0) {
      it.stand(w, face ?? (it.end ? it.end.heading : 0), { pose: 'stand', prop: wo.prop, hand: wo.hand, turn: false });
      if (first && it.mp) it.mp.waitedAtEntry = true;
    }
    return w;
  };
  // walk on to `d` (metres along this walk)
  const go = (d) => {
    if (d <= done + 1e-3) return;
    if (opts.line) it.walk(LOOP, s0 + dir * done, s0 + dir * d, v, { ...wo, side: 0 });
    else laneWalk(it, s0 + done, s0 + d, cls, wo);
    done = d;
  };
  clear(0, 0, 0);
  first = false;
  for (let i = 0; i < stops.length; i++) {
    const st = stops[i];
    if (st.b) {
      // a prostration place: the free one nearest the station (behind the party member ahead of him, if any)
      const b = st.b;
      const sStation = s0 + dir * st.d;
      const pick = pickCol(it, b, sStation, dir, opts.prev, st.d, done, v);
      const dPlace = dir > 0 ? pick.s - s0 : s0 - pick.s;
      go(Math.max(done, dPlace - STEP_OUT));
      const at = colPoint(pick.s);
      const cur = () => [it.end.X, it.end.Y, it.end.Z];
      if (pick.wait > 0) {
        // every place taken: he waits a pace short of the one that frees first, then steps in
        const wp = [at[0] + (it.end.X - at[0]) * 0.55, at[1] + (it.end.Y - at[1]) * 0.55, 0];
        it.walkTo([cur(), wp], v * 0.8, mv);
        it.stand(pick.wait, b.face, { pose: 'stand', prop: wo.prop, hand: wo.hand });
        it.walkTo([wp, at], 0.6, mv);
      } else it.walkTo([cur(), at], v * 0.8, mv);
      const tIn = it.T;
      // what he carries is set down beside him while he lies full length
      it.stand(PROSTRATE_MIN, b.face, { pose: 'prostrate', phase: prostratePhase, prop: null });
      // back into the lane (or onto the line) a step further on — once it is clear
      const dOut = Math.min(arc, dPlace + STEP_OUT);
      const backPt = opts.line ? linePoint(s0 + dir * dOut, 0, dir < 0) : linePoint(s0 + dOut, laneSide(s0 + dOut, cls));
      clear(dOut, i + 1, stepMin(at, backPt, v * 0.8), b.face);
      if (it.mp && pick.slots) it.mp.taken.push(pick.slots.add(it.mp.t0 + tIn - 0.05, it.mp.t0 + it.T + 0.1, it.mp.who));
      it.cols.set(b.n, pick.off);
      it.walkTo([at, backPt], v * 0.8, mv);
      done = Math.max(done, dOut);
      continue;
    }
    // any other stop (a greeting): in place on the line, or stepped out of the lane to `at`
    if (st.at) {
      go(Math.max(done, st.d - STEP_OUT));
      it.walkTo([[it.end.X, it.end.Y, it.end.Z], st.at], v * 0.8, mv);
      if (st.mark) it.mark = it.T;
      it.stand(st.min, st.heading, { pose: st.pose || 'stand', phase: st.phase ?? null, prop: st.prop ?? wo.prop, hand: wo.hand });
      const dOut = Math.min(arc, st.d + STEP_OUT);
      const backPt = opts.line ? linePoint(s0 + dir * dOut, 0, dir < 0) : linePoint(s0 + dOut, laneSide(s0 + dOut, cls));
      clear(dOut, i + 1, stepMin(st.at, backPt, v * 0.8), st.heading);
      it.walkTo([st.at, backPt], v * 0.8, mv);
      done = Math.max(done, dOut);
    } else {
      go(st.d);
      if (st.mark) it.mark = it.T;
      it.stand(st.min, st.heading, { pose: st.pose || 'stand', phase: st.phase ?? null, prop: st.prop ?? wo.prop, hand: wo.hand });
    }
  }
  go(arc);
  return it;
}

/**
 * Choose a prostration place at station b (its loop distance sStation in this walk's unwrapped coordinates, dStation
 * metres along the walk) for a walker now `done` metres along at v m/s: the free place nearest the station's middle,
 * or behind the party member ahead of him; when every place is taken, the one that frees first (he waits beside it).
 * Returns { off, s (the place's loop distance, unwrapped), wait, slots (to book; null on a probe build) }.
 */
function pickCol(it, b, sStation, dir, prev, dStation, done, v) {
  let ahead = prev?.has(b.n) ? prev.get(b.n) : null;
  let order = b.order;
  if (ahead != null) {
    // the places behind the one ahead of him, nearest first (the row's places are COL_DX apart, in order)
    const ia = Math.round((ahead - b.cols[0]) / COL_DX);
    order = [];
    for (let k = 1; k < NCOL; k++) { const c = ia - dir * k; if (c >= 0 && c < NCOL) order.push({ off: b.cols[c], c }); }
    // he took the row's last place: any free place
    if (!order.length) { order = b.order; ahead = null; }
  }
  // the clock minute (itinerary minutes) he reaches a place: on along the lane, then the step out to it
  const arrive = (off) => it.T + (Math.max(0, dStation + dir * off - STEP_OUT - done) + STEP_OUT * 1.6) / v / 60;
  const out = (o, slots, wait) => ({ off: o.off, s: sStation + o.off, wait, slots });
  if (!it.mp) return out(order[0], null, 0);
  const book = it.mp.book;
  for (const o of order) {
    // a follower takes a place behind the one ahead of him, never past him
    if (ahead != null && dir * (o.off - ahead) > -0.5) continue;
    const slots = book.col(b.n, o.c);
    const t = it.mp.t0 + arrive(o.off);
    if (slots.free(t - 0.03, t + PROSTRATE_MIN + 0.12)) return out(o, slots, 0);
  }
  let best = null, bt = Infinity;
  for (const o of order) {
    const slots = book.col(b.n, o.c);
    const t = it.mp.t0 + arrive(o.off);
    const f = slots.nextFree(t - 0.03, PROSTRATE_MIN + 0.15) + 0.03;
    if (f < bt) { bt = f; best = out(o, slots, Math.max(0, f - t)); }
  }
  return best;
}

/**
 * Up a gate's passage onto the Mount (its in-route, in the class's sub-lane). Two walkers of one class coming up the
 * same passage keep apart: the passage is booked like a lane (G4Book, per gate and class), and one who would walk into
 * another waits a moment where he appears, at the passage's outer end.
 */
export function enterGate(it, gate, cls, o = {}) {
  const G = GATES[gate], v = SPEEDS[cls], R = G.inRoute;
  const mp = it.mp;
  if (mp) {
    const key = `gate:${gate}:${cls}`;
    let lb = mp.book.res.get(key);
    if (!lb) { lb = new LaneBook(v, 1e6, GAP); mp.book.res.set(key, lb); }
    const dur = R.length / v / 60;
    let w = 0;
    while (w < 2 && lb.conflict(0, mp.t0 + it.T + w, mp.t0 + it.T + w + dur)) w += 0.03;
    if (w > 0) it.stand(w, G.inRoute.hd[0] ?? 0, { at: R.P[0], pose: 'stand', prop: o.prop ?? null, hand: o.hand, turn: false });
    mp.taken.push(lb.add(0, mp.t0 + it.T, mp.t0 + it.T + dur, mp.who));
  }
  it.walk(R, 0, R.length, v, { side: o.side ?? GATE_SUB[cls], pose: o.pose, prop: o.prop, hand: o.hand });
  return it;
}

/** in by `gate` and with the stream to a spur's junction, then up the spur (ends where the spur's in-route ends) */
export function arrive(it, o) {
  const { gate, spur, pose, prop, hand, prostrate = true } = o;
  const cls = o.cls ?? classOf(o.v ?? 1.25), v = SPEEDS[cls];
  const G = GATES[gate], S = SPURS[spur];
  enterGate(it, gate, cls, { pose, prop, hand });
  walkLoop(it, G.sIn, fwd(G.sIn, S.sIn), { cls, pose, prop, hand, prostrate, prev: o.prev });
  it.walk(S.inRoute, 0, S.inRoute.length, v, { side: SPUR_SUB[cls], pose, prop, hand });
  return it;
}
/** down a spur (from where its out-route starts), on with the stream to the first exit, and out */
export function leave(it, o) {
  const { spur, pose, prop, hand, exits = GATE_IDS, prostrate = true } = o;
  const cls = o.cls ?? classOf(o.v ?? 1.25), v = SPEEDS[cls];
  const S = SPURS[spur];
  it.walk(S.outRoute, 0, S.outRoute.length, v, { side: SPUR_SUB[cls], pose, prop, hand });
  const ex = exitAfter(S.sOut, 20, exits);
  walkLoop(it, S.sOut, ex.arc, { cls, pose, prop, hand, prostrate, prev: o.prev });
  const X = GATES[ex.id];
  it.walk(X.outRoute, 0, X.outRoute.length, v, { side: GATE_SUB[cls], pose, prop, hand });
  it.exitGate = ex.id;
  return it;
}

/** a whole visit: in by `gate`, with the stream to loop point sTo (≥ minArc), then build(it) at the target, then on
 * with the stream to the first exit; out. spur: SPURS id taken between (its in / out routes), or null. Returns it. */
export function visit(it, o) {
  const { gate, spur, build, pose, prop, hand, minArc = 40, exits = GATE_IDS, prostrate = true } = o;
  if (spur) {
    arrive(it, o);
    build?.(it);
    leave(it, o);
    return it;
  }
  // a circuit only: round to the first exit at least minArc on (the strict reading of "go round")
  const cls = o.cls ?? classOf(o.v ?? 1.25), v = SPEEDS[cls];
  const G = GATES[gate];
  enterGate(it, gate, cls, { pose, prop, hand });
  const ex = exitAfter(G.sIn, minArc, exits);
  walkLoop(it, G.sIn, ex.arc, { cls, pose, prop, hand, prostrate, prev: o.prev });
  it.walk(GATES[ex.id].outRoute, 0, GATES[ex.id].outRoute.length, v, { side: GATE_SUB[cls], pose, prop, hand });
  it.exitGate = ex.id;
  return it;
}

/** the entry gate giving the shortest walk with the stream to a spur's junction */
export function bestEntry(spur, allowed = GATE_IDS) {
  const S = SPURS[spur];
  let best = null, bd = Infinity;
  for (const id of allowed) { const d = fwd(GATES[id].sIn, S.sIn); if (d < bd) { bd = d; best = id; } }
  return best;
}

/** minutes a whole visit takes, apart from what build() adds (for planning) */
export function visitMinutes(o) {
  const it = visit(new Itin(), { ...o, build: null });
  return it.T;
}

export { clamp };

// Group G4 — the ordinary weekday's people on Har HaBayit and in the outer courts (qa-r1 SIM-1): how many come, by
// quality tier; the places parties stand in Ezrat Nashim's open bands (Poisson-disc: spaced so that every spot holds one
// party — a cluster: a family, women with their children) and the ways to them past the court's other places; and the
// sites along the soreg where people stand a while and watch the courts.
//
// How many (⚙ reasoned from the research, docs/decisions/qa-r1-sim.md): an ordinary Cheshvan weekday, never a festival
// crowd. The report puts the day's baseline at "ma'amad + staff ≈ low hundreds" (§36.5); around it, through the day,
// come the owners of offerings, women bringing their birds, those paying vows and shekels at the chests, families, and
// people who come up to pray, to prostrate opposite the breaches (Middot 2:3) and to watch the service. DENSITY scales
// the rates and the pools of courts-daily's walkers together: high stages several hundred figures in the courts and on
// the Mount at the morning's peak, low about a hundred (the runtime's budget then draws the far ones as LOD3).
import { rand } from '../../lib/core.js';
import { AMAH } from '../../../core/units.js';
import { LOOP, BREACHES, SPURS, chuldahLine } from './mount.js';

export const DENSITY = { low: 0.55, medium: 0.9, high: 1.6, ultra: 2.0 };
export const densityOf = (ctx) => DENSITY[ctx?.quality?.key] ?? 0.9;
/** a pool's size at this tier: the base count × max(floor, density) */
export const poolSize = (ctx, n, floor = 1) => Math.max(1, Math.ceil(n * Math.max(floor, densityOf(ctx))));

// ------------------------------------------------------------------------------------------------ Poisson-disc
/** dart throwing in a rectangle [x0, y0, x1, y1] (amot) with a minimum spacing; keep(x, y) filters; deterministic */
export function poissonDisc(rect, minD, seed, keep, tries = 3000) {
  const pts = [];
  const [x0, y0, x1, y1] = rect;
  for (let k = 0; k < tries; k++) {
    const x = x0 + rand(seed, 'px', k) * (x1 - x0), y = y0 + rand(seed, 'py', k) * (y1 - y0);
    if (keep && !keep(x, y)) continue;
    let ok = true;
    for (let i = 0; i < pts.length; i++) if (Math.hypot(pts[i][0] - x, pts[i][1] - y) < minD) { ok = false; break; }
    if (ok) pts.push([x, y]);
  }
  return pts;
}

// ------------------------------------------------------------------------------------------------ Ezrat Nashim
// The court's open bands north and south of its middle, between the corner chambers (X 302–353) and clear of the
// timber stairs up to the gallery (X 302–304), Chasha'im's door (X 320–335 at the north wall) and the rows of
// courts-daily's original places (Y 303.5 … 357.5) ⚙
const EN_BANDS = [
  { rect: [307.5, 363.0, 349.5, 391.0], side: 'n' },
  { rect: [307.5, 269.5, 349.5, 298.0], side: 's' },
];
const EN_SPACING = 6.5;            // amot between spots: a party of up to five stands within ≈ 1.4 m of its spot

// The ways to the band spots from just inside the court's east gate: along an aisle north (Y 341.5 in, 343 out) or
// south (Y 319.5 in, 318 out) of the court's middle — clear of the axis the men going up to Nikanor, the bird bringers
// and the meat carriers use — west to a column between the original places' columns, up (or down) it to the spot's
// row, and along the row to it; out along the row to a column 1.4 amot east of it. No spot lies within COL_CLEAR of
// either column, so nobody walking a column passes through a party standing (qa-r1 review: the g4 sweep) ⚙
const COLS = [305.3, 315.3, 325.7, 336.6, 347.6];
const COL_OUT = 1.4, COL_CLEAR = 2.3;
const AISLE = { n: [341.5, 343.0], s: [319.5, 318.0] };
/** the in-column of a band spot (the nearest) */
export function bandColumn(spot) {
  let c = COLS[0];
  for (const x of COLS) if (Math.abs(x - spot[0]) < Math.abs(c - spot[0])) c = x;
  return c;
}
/** the band spots: [X, Y, band] sorted west → east, north band first (deterministic: built once) */
export const EN_BAND_SPOTS = (() => {
  const out = [];
  const offCols = (x) => COLS.every((c) => x < c - COL_CLEAR || x > c + COL_OUT + COL_CLEAR);
  EN_BANDS.forEach((b, bi) => {
    const keep = (x, y) => offCols(x) && !(b.side === 'n' && x > 322.5 && x < 332.5 && y > 383);     // the way to Chasha'im's door
    const pts = poissonDisc(b.rect, EN_SPACING, 0x45b0 + bi, keep);
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    for (const p of pts) out.push([p[0], p[1], b.side]);
  });
  return out;
})();
/**
 * [in points, out points] (site amot, floor 6) for a member's place `a` ([X, Y, Z]) at band spot `spot` ([X, Y, side]):
 * the column is the spot's (one for the whole party); from = just inside the gate, to = back there
 */
export function enBandWay(spot, a, from, to) {
  const side = spot[2], [yIn, yOut] = AISLE[side];
  const c = bandColumn(spot);
  const inW = [from, [388, yIn, 6], [c, yIn, 6], [c, a[1], 6], a];
  const outW = [a, [c + COL_OUT, a[1], 6], [c + COL_OUT, yOut, 6], [388, yOut, 6], to];
  return [inW, outW];
}
/** a member's place at a party's spot: up to five, ≥ 0.55 m apart (amot offsets; children nearest their mother) */
export const FAMILY_OFF = [[0, 0], [0.9, -1.15], [0.95, 1.2], [-0.9, -0.75], [-0.95, 0.8]];

// ------------------------------------------------------------------------------------------------ along the soreg
// Sites where a party stands between the circuit's line and the soreg, looking over it at the courts: on the south,
// east and north sides (the west side is too narrow: the stoa's front, the lanes and the prostration places fill it),
// away from the stations' rows of places (Middot 2:3), the gates' junctions, the spurs, the gate flights and the
// corners. Each site has four places: two along the line, two deep (the back row nearest the soreg) ⚙
const SIDE_LEN = [395, 216, 395].map((a) => a * AMAH);     // S, E, N side lengths (m)
const SIDE_S0 = [0, 395, 611].map((a) => a * AMAH);        // where each starts (loop distance, m)
const SIDE_FACE = [0, 270, 180];                            // facing the courts
// metres left of the line (toward the soreg) of the two rows: S strip 5.5 m to the soreg, E 4.6 m; the N strip (13.2 m)
// has room for a second line of sites deeper in
const ROWS = [[[3.85, 4.7]], [[2.85, 3.65]], [[5.0, 5.85], [9.2, 10.05]]];
const SITE_STEP = 6.5;                                      // metres between sites along a free stretch
const ALONG = [0.55, -0.55];                                // metres along the line of a row's two places
/** keep-out stretches along the loop (m, absolute): around each station's row of places, the spurs (they cross the
 * strip; the gates join the circuit from its outer side and leave the strip free), the gate flights and the corners */
function keepOuts() {
  const out = [];
  const add = (s, a, b) => out.push([s - a, s + b]);
  for (const b of BREACHES) add(b.s, -b.cols[0] + 2.5, b.cols[b.cols.length - 1] + 2.5);
  for (const sp of Object.values(SPURS)) { add(sp.sIn, 5, 5); add(sp.sOut, 5, 5); }
  // the south gate flights cross the strip (X 107–117, 156–167, 205–216 at Y 236 → loop m), Beit HaEven (north, X 365–385)
  const sS = (X) => (X - 25) * AMAH, sN = (X) => (611 + (420 - X)) * AMAH;
  for (const [x0, x1] of [[107.25, 117.25], [156.5, 166.5], [205.75, 215.75]]) out.push([sS(x0) - 2, sS(x1) + 2]);
  out.push([sN(385) - 2, sN(365) + 2]);
  // the north flights reach the strip at the Moked's (X 205.75–215.75 to Y 430); the corners
  out.push([sN(215.75) - 2, sN(205.75) + 2]);
  for (const c of [0, 395, 611, 1006]) add(c * AMAH, 10, 10);
  return out;
}
/** the sites: { s (loop m), side, face, places: [[X, Y, Z, along (m), row]] (back row first, leading place first) } */
export const SOREG_SITES = (() => {
  const ko = keepOuts();
  const free = (s) => !ko.some(([a, b]) => s > a && s < b);
  const siteFree = (s) => free(s - 1.6) && free(s) && free(s + 1.6);
  const sites = [];
  const q = {};
  const make = (s, side, rows) => {
    const places = [];
    for (let r = 1; r >= 0; r--) {
      for (const a of ALONG) {
        LOOP.sample(s + a, q, -rows[r]);
        places.push([q.X, q.Y, 0, a, r]);
      }
    }
    return { s, side, face: SIDE_FACE[side], places };
  };
  for (let side = 0; side < 3; side++) {
    const first = [];
    let last = -Infinity;
    for (let s = SIDE_S0[side] + 12; s < SIDE_S0[side] + SIDE_LEN[side] - 12; s += 0.5) {
      // the whole site (its places ± 1.5 m) must be free
      if (!siteFree(s) || s - last < SITE_STEP) continue;
      last = s;
      first.push(make(s, side, ROWS[side][0]));
    }
    sites.push(...first);
    // a deeper line (the north strip): midway between two neighbouring sites of the first, so its people walk in
    // between them
    if (ROWS[side][1]) {
      for (let i = 0; i + 1 < first.length; i++) {
        const a = first[i].s, b = first[i + 1].s;
        if (b - a <= SITE_STEP + 0.6 && siteFree((a + b) / 2)) sites.push(make((a + b) / 2, side, ROWS[side][1]));
      }
    }
  }
  return sites;
})();

// ------------------------------------------------------------------------------------------------ by the royal stoa
// Gatherings on the plaza before the royal stoa, between the two Chuldah stairs: men talking, a teacher with a few
// students round him (people sat and taught on the Mount: "Rabban Gamliel ... sitting on a step on Har HaBayit",
// Sanhedrin 11b), families resting a while. They come up the western Chuldah passage by its middle (the circuit's
// walkers keep to its two halves), go right along the stoa to their place, and leave by the left down the eastern
// passage's middle — in by the right, out by the left (Middot 2:2); they never reach the soreg's line, so they pass no
// station of the breaches ⚙
export const STOA_SPOTS = poissonDisc([184, 23.5, 316, 30.5], 9, 0x57a0).sort((a, b) => a[0] - b[0]);
/** up the western passage's middle, out at the head of its stair and round its parapet (X 170–171) toward the stoa (the
 * in-lane at Y 36) — across the circuit's way north from that stair (booked: courts-daily stoaGatherings) */
export const STOA_IN = [...chuldahLine(165), [166, 75, 0], [173.5, 75.5, 0], [178, 36, 0]];
/** from the out-lane (Y 40) round the eastern stair's parapet (X 329–330) to its head, down the passage's middle */
export const STOA_OUT = [[324, 40, 0], [326, 76, 0], [335, 76.5, 0], ...chuldahLine(335, false)];
export const STOA_LANE = { in: 36, out: 40 };

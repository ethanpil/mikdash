// The land around Har HaBayit as a height function of site (X, Y).
//
// Built ONLY from site.js context data: context.terrain.params.profilesMeters (meters outward from each Mount-wall
// face -> ground ASL), the Kidron thalweg line (context.terrain.params.kidronThalweg), the walls' footProfile
// (the ground meets every wall exactly along its foot) and the graded areas of terrain/plan.js. Everything finer
// (relief noise, the far hills beyond the context box, the meander of the Har HaMishchah ridge away from the
// Temple axis, the Tyropoeon fall) is reconstruction — docs/decisions/build-mount.md.
//
// Field construction (no seams): each exterior point is classified by the footprint rectangle.
//   east band (X > east face):  P_E(u) + T_K(Y)·b_K(u) + (1 − b_K(u))·ΔP_N|S(v|s)   — the Kidron runs N–S and keeps
//                               falling south with the Ophel / rising north with the plateau, except at its bed,
//                               which follows the site.js thalweg line
//   west band:                  P_W(w) + T_T(Y)·b_T(w) + (1 − b_T(w))·ΔP_N|S
//   south / north bands:        footProfile(X) + ΔP_S|N(d)
// which is continuous across every band boundary and equals the footProfile on the wall faces.
import { AMAH } from '../../core/units.js';
import { interp, smooth, clamp, lerp } from '../mount/kit.js';
import { makeNoise } from './noise.js';
import { landPlan, distToPolyline, rectDist } from './plan.js';

const memo = new WeakMap();
const D2R = Math.PI / 180;
/** far-field ridge-top elevation (m ASL) by azimuth from the Mount — generic, reconstruction: the ridges round the
 *  city rise to the north-west; east of Har HaMishchah the desert falls away. Valleys cut 120–170 m below. */
const FAR_BASE = [[0, 805], [45, 805], [90, 690], [135, 705], [180, 800], [225, 815], [270, 828], [315, 845]].map(([a, z]) => [a * D2R, z]);

/** The (cached) terrain field for this page. */
export function getTerrain(ctx) {
  if (!memo.has(ctx)) memo.set(ctx, createTerrain(ctx));
  return memo.get(ctx);
}

function createTerrain(ctx) {
  const A = AMAH;
  const tp = ctx.el('context.terrain').params;
  const TOPO = tp.profilesMeters, DATUM = tp.datumASL;
  const plan = landPlan(ctx);
  const { fp } = plan;
  const footS = ctx.el('mount.wall.south').params.footProfile.points;
  const footN = ctx.el('mount.wall.north').params.footProfile.points;
  const zA = (z) => DATUM + z * A;                     // site Z (amot) -> ASL m
  // the profiles pass exactly through every site.js point; between them a monotone cubic (no overshoot) instead of
  // straight segments, so slope breaks (the Kidron bed, the crest) are rounded as real ground is
  const PC = Object.fromEntries(Object.entries(TOPO).map(([k, pts]) => [k, pchip(pts)]));
  const P = (k, mm) => PC[k](mm);
  const dP = (k, mm) => PC[k](mm) - TOPO[k][0][1];
  const noise = makeNoise((ctx.params?.seed ?? 5786) + 11);
  const axisY = ctx.site.axisY;
  const tbox = ctx.el('context.terrain').box;

  // Kidron thalweg (site.js): Z by Y, linear (extrapolated) -> tilt relative to the E profile's bed
  const kt = tp.kidronThalweg;
  const thalM = (kt.x - fp.x1) * A;
  const [[ya, za], [yb, zb]] = kt.zByY;
  const thalZ = (Y) => za + (zb - za) * (Y - ya) / (yb - ya);
  const TK = (Y) => zA(thalZ(Y)) - P('E', thalM);
  const bK = (u) => smooth(55, 125, u) * (1 - smooth(300, 420, u));
  // Tyropoeon: its bed falls toward the south (the lower city) ⚙ 1.2 % — no number in the sources
  const TT = (Y) => (Y - 250) * A * 0.012;
  const bT = (w) => smooth(4, 40, w) * (1 - smooth(110, 210, w));
  // Kidron meander ⚙: zero along the Mount's frontage (the site.js thalweg is exact there), up to ±60 m beyond it;
  // it shifts only the valley (u ≈ 20–520 m), so the wall foot and the Har HaMishchah crest are untouched
  const cyM = (fp.y0 + fp.y1) / 2, halfM = (fp.y1 - fp.y0) / 2;
  const kMeander = (Y) => 60 * clamp(2.2 * noise.fbm(Y * A / 420 + 9.1, 2.3, 2), -1, 1) * smooth(80, 320, (Math.abs(Y - cyM) - halfM) * A);
  const wK = (u) => smooth(10, 150, u) * (1 - smooth(330, 560, u));   // ramps keep the warp monotone (slope < 1)

  // north and south of the Mount the rows shift sideways (±40 m, from 60 m out) so the corner blends of the N / S
  // wall feet and the band boundaries do not run on as ruler-straight N–S scarps ⚙ (zero against the walls)
  const rowShift = (Y) => {
    const v = (Y - fp.y1) * A, s2 = (fp.y0 - Y) * A;
    if (v > 0) return 40 / A * clamp(2 * noise.fbm(Y * A / 600 + 3.3, 1.1, 2), -1, 1) * smooth(60, 300, v);
    if (s2 > 0) return 40 / A * clamp(2 * noise.fbm(Y * A / 600 - 6.1, 4.7, 2), -1, 1) * smooth(60, 300, s2);
    return 0;
  };
  /** smooth macro ground (ASL m) from the profiles alone */
  function macro(X0, Y) {
    const X = X0 - rowShift(Y);
    const u = (X - fp.x1) * A, w = (fp.x0 - X) * A, s = (fp.y0 - Y) * A, v = (Y - fp.y1) * A;
    let h;
    if (u >= 0) {
      // the Har HaMishchah ridge meanders and dips away from the Temple axis (never on it: the crest stays 808 m there)
      const off = smooth(0, 180, Math.abs(Y - axisY) * A);
      const uu = u + off * 70 * noise.fbm(Y * A / 900 + 3.1, 0.7, 2) * smooth(300, 600, u) - kMeander(Y) * wK(u);
      h = P('E', uu) + TK(Y) * bK(uu) + off * smooth(450, 760, u) * 14 * noise.fbm(Y * A / 700, 5.3, 2);
      const b = bK(uu);
      if (v > 0) h += (1 - b) * dP('N', v);
      else if (s > 0) h += (1 - b) * dP('S', s);
    } else if (w >= 0) {
      const b = bT(w);
      h = P('W', w) + TT(Y) * b;
      if (v > 0) h += (1 - b) * dP('N', v);
      else if (s > 0) h += (1 - b) * dP('S', s);
    } else if (s >= 0) {
      h = zA(interp(footS, X)) + dP('S', s);
    } else if (v >= 0) {
      h = zA(interp(footN, X)) + dP('N', v);
    } else {
      return DATUM - 2 * A;                            // inside the Mount (no ground drawn)
    }
    // far field: beyond the context box the profiles hand over to generic hills (reconstruction)
    const dOut = Math.hypot(Math.max(tbox.min[0] - X, 0, X - tbox.max[0]), Math.max(tbox.min[1] - Y, 0, Y - tbox.max[1])) * A;
    if (dOut > 0) {
      // the ridges round the city rise to ~800 m west, north and south; east of Har HaMishchah the desert falls away
      const az = Math.atan2((X - (fp.x0 + fp.x1) / 2), (Y - (fp.y0 + fp.y1) / 2));
      let bw = 0, bs = 0;
      for (const [a, z] of FAR_BASE) { const w = Math.max(0, Math.cos(az - a)) ** 3; bw += w; bs += w * z; }
      // ridges and valleys: ridged noise at 3.4 km (valleys 130 m deep) and 1.4 km (35 m), so the horizon is a set of
      // layered ridgelines rather than a plain (Judean ridges ≈ 800–850 m, the wadis between 120–200 m lower)
      const x = X * A, y = Y * A;
      const r1 = (1 - Math.min(1, Math.abs(noise.fbm(x / 3400 - 3.1, y / 3400 + 8.4, 3)) * 2.2)) ** 1.5;
      const r2 = (1 - Math.min(1, Math.abs(noise.fbm(x / 1400 + 5.7, y / 1400 - 1.3, 3)) * 2.4)) ** 1.5;
      const dC = Math.hypot((X - (fp.x0 + fp.x1) / 2) * A, (Y - (fp.y0 + fp.y1) / 2) * A);
      const nw = Math.max(0, Math.cos(az - 315 * D2R)) * smooth(1800, 6500, dC) * 45;     // rising to the north-west
      // farther ridges stand a little higher (west half), so the ridgelines layer behind each other
      const layer = Math.max(0, -Math.sin(az)) * smooth(2000, 7000, dC) * 40;
      const desert = Math.max(0, Math.cos(az - 100 * D2R)) ** 2 * smooth(2000, 7000, dC) * 160; // falling to the east
      const far = bs / (bw || 1) + 25 - 130 * (1 - r1) - 35 * (1 - r2) + 10 * noise.fbm(x / 650, y / 650, 3) + nw + layer - desert;
      h = lerp(h, far, smooth(0, 1400, dOut));
    }
    return h;
  }

  /** distance (m) to the Mount footprint */
  const footDist = (X, Y) => Math.hypot(Math.max(fp.x0 - X, 0, X - fp.x1), Math.max(fp.y0 - Y, 0, Y - fp.y1)) * A;

  // graded areas & corridors
  const flats = plan.flats.map((f) => ({ ...f, zAsl: zA(f.z) - (f.drop ?? 0.32) }));   // the graded ground under the surface
  const corridors = [...plan.streets, plan.parahPath];

  /** full height (ASL m) and how much of it is graded (0..1) */
  function sample(X, Y) {
    let h = macro(X, Y);
    const fd = footDist(X, Y);
    if (fd <= 0) return { h, g: 1 };
    let g = 0;
    for (const c of corridors) {
      const q = distToPolyline(c.pts, X, Y);
      const dm = (q.d - c.half) * A;
      if (dm < 9) {
        const t = 1 - smooth(0, 9, dm);
        const hc = macro(q.x, q.y) - 0.12;           // the bed is level across the street, just under its paving
        h = lerp(h, hc, t);
        g = Math.max(g, t);
      }
    }
    for (const f of flats) {
      const dm = rectDist(f.rect, X, Y) * A;
      if (dm < f.margin) {
        const t = 1 - smooth(0, f.margin, dm);
        h = lerp(h, f.zAsl, t);
        g = Math.max(g, t);
      }
    }
    // relief: broad swells, small ledges and hollows; none against the walls (the footProfile is exact there)
    const amp = smooth(6, 70, fd) * (1 - g);
    if (amp > 0) {
      const x = X * A, y = Y * A;
      const n1 = noise.fbm(x / 140, y / 140, 4);
      const n2 = noise.fbm(x / 26 + 40, y / 26 - 13, 3);
      h += amp * (2.4 * n1 + 0.55 * n2);
    }
    // qa-r1-fix-world: micro-relief, only in the near field of the Har HaMishchah viewpoints, where the grid is fine
    // enough to carry it (plan.detail; 2.5–6 m cells)
    const wd = plan.inDetail(X, Y) * amp;
    if (wd > 0) h += wd * micro(X, Y, h);
    return { h, g };
  }

  /**
   * Micro-relief (m) ⚙: low hummocks, and broken limestone benches along the contours: the karst of the Judean hills
   * weathers into shelves a metre or so high, the soil lying on each shelf, a short rock step to the next. Benches come
   * in patches and only on sloping ground (not on the crest's flat, not on scarps the cells cannot resolve).
   */
  function micro(X, Y, h) {
    const x = X * A, y = Y * A;
    const hum = 0.2 * noise.fbm(x / 6.5 + 31, y / 6.5 - 7, 2);
    const e = 2 / A;
    const s = Math.hypot(macro(X + e, Y) - macro(X - e, Y), macro(X, Y + e) - macro(X, Y - e)) / 4;
    const k = smooth(0.04, 0.1, s) * (1 - smooth(0.36, 0.5, s)) * smooth(-0.15, 0.3, noise.fbm(x / 38 + 5.5, y / 38 - 3.1, 2));
    if (k <= 0) return hum;
    const S = 1.25, f = h / S - Math.floor(h / S);
    const bench = (smooth(0.62, 1, f) - f) * S;              // 0 at a riser's head, −0.62 S at the foot of the next riser
    return hum + 0.65 * k * bench;
  }

  function heightASL(X, Y) { return sample(X, Y).h; }
  function heightZ(X, Y) { return (sample(X, Y).h - DATUM) / A; }
  /** rock exposure mask in [0,1] (before slope) — karst outcrops */
  function rockiness(X, Y) {
    const x = X * A, y = Y * A;
    return clamp(0.5 + 0.9 * noise.fbm(x / 55 + 91, y / 55 - 37, 3), 0, 1);
  }

  /** site X of the Kidron bed at Y (the site.js thalweg line, meandering away from the Mount's frontage) */
  const thalwegX = (Y) => kt.x + kMeander(Y) * wK(thalM) / A + rowShift(Y);
  return { A, DATUM, fp, plan, macro, sample, heightASL, heightZ, footDist, rockiness, noise, thalM, thalwegX, zA };
}

/** Monotone piecewise-cubic Hermite interpolant (Fritsch–Carlson) through [[x, y], …], clamped beyond the ends. */
function pchip(pts) {
  const n = pts.length;
  const x = pts.map((p) => p[0]), y = pts.map((p) => p[1]);
  const d = [], m = new Array(n).fill(0);
  for (let i = 0; i + 1 < n; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
  for (let i = 1; i + 1 < n; i++) {
    if (d[i - 1] * d[i] <= 0) m[i] = 0;
    else { const w1 = 2 * (x[i + 1] - x[i]) + (x[i] - x[i - 1]), w2 = (x[i + 1] - x[i]) + 2 * (x[i] - x[i - 1]); m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
  }
  m[0] = n > 1 ? d[0] : 0;
  m[n - 1] = n > 1 ? 0 : 0;                              // flat beyond the last point (the profile is clamped there)
  return (t) => {
    if (t <= x[0]) return y[0];
    if (t >= x[n - 1]) return y[n - 1];
    let i = 0; while (t > x[i + 1]) i++;
    const h = x[i + 1] - x[i], s = (t - x[i]) / h;
    const h00 = 2 * s * s * s - 3 * s * s + 1, h10 = s * s * s - 2 * s * s + s, h01 = -2 * s * s * s + 3 * s * s, h11 = s * s * s - s * s;
    return h00 * y[i] + h10 * h * m[i] + h01 * y[i + 1] + h11 * h * m[i + 1];
  };
}

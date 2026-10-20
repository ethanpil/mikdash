// Paths in the site frame (amot) with floor heights from the physics, for figures that walk.
// A SitePath is immutable once built; sample(d) is a pure function of the distance — callers derive the distance
// from sim time, so a walker's position never depends on frame history.
import { Vector3 } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { clamp } from './core.js';

const DEG = 180 / Math.PI;
const _v = new Vector3();

/**
 * Walking floor at site (X, Y) as a site Z (amot), or null when physics is not ready.
 * nearZ given → the standable floor nearest that height on ANY level (upper rooms, tunnels, flights);
 * omitted → the walking floor on the site datums (never a roof).
 */
export function floorZ(ctx, X, Y, nearZ) {
  const ph = ctx.physics;
  if (!ph) return null;
  const w = m2w(X, Y, Number.isFinite(nearZ) ? nearZ : 0, _v);
  try {
    let y = null;
    if (typeof ph.standFloor === 'function') y = Number.isFinite(nearZ) ? ph.standFloor(w.x, w.z, w.y, true) : ph.standFloor(w.x, w.z);
    else if (typeof ph.floorAt === 'function') y = ph.floorAt(w.x, w.z);
    return Number.isFinite(y) ? y / AMAH : null;
  } catch { return null; }
}

/**
 * A walkable route through site waypoints [{X,Y,Z}] (amot): ctx.nav legs between consecutive points (one leg per
 * macrotask, so building never stalls a frame for long), straight legs where nav is unavailable or finds nothing.
 * Resolves { path: SitePath, at: [distance (m) of each waypoint], source, fallbacks }. loop: also return to the start.
 */
export async function navRoute(ctx, waypoints, { loop = false, wait = 25000 } = {}) {
  const nav = ctx.nav;
  // nav.ready is replaced when the colliders are rebuilt (the old promise may settle without a grid): keep waiting
  const until = performance.now() + wait;
  while (nav?.ready && !nav.isReady && performance.now() < until) {
    await Promise.race([nav.ready, new Promise((r) => setTimeout(r, Math.min(1000, until - performance.now())))]);
  }
  const usable = !!nav?.isReady;
  const pts = [], idx = [];
  let fallbacks = 0;
  const failed = [];
  const n = waypoints.length, legs = loop ? n : n - 1;
  for (let i = 0; i < legs; i++) {
    const a = waypoints[i], b = waypoints[(i + 1) % n];
    const wa = m2w(a.X, a.Y, a.Z ?? 0), wb = m2w(b.X, b.Y, b.Z ?? 0);
    let leg = null;
    if (usable && !a.straight) {
      await new Promise((r) => setTimeout(r, 0));
      try { leg = nav.findPath(wa, wb); } catch { leg = null; }
    }
    if (!leg || leg.length < 2) { if (usable && !a.straight) { fallbacks++; failed.push(i); } leg = [wa, wb]; }
    leg[0] = wa; leg[leg.length - 1] = wb;          // exactly at the waypoints (nav snaps to its grid)
    idx.push(pts.length ? pts.length - 1 : 0);
    for (let k = pts.length ? 1 : 0; k < leg.length; k++) pts.push(leg[k]);
  }
  if (!loop) idx.push(pts.length - 1);
  const path = new SitePath(pts);
  const at = idx.map((k) => path.cum[k]);
  if (loop) at.push(path.length);
  return { path, at, source: usable ? (fallbacks ? `nav (${fallbacks} straight)` : 'nav') : 'straight (no nav)', fallbacks, failed };
}

/**
 * The same result shape as navRoute, synchronously, from straight legs through the waypoints: the authored line a
 * walker follows until nav is ready (dense waypoints keep it walkable). Its leg lengths are nav-independent, so
 * timelines built on them do not change when nav refines the path.
 */
export function straightRoute(waypoints, { loop = false } = {}) {
  const path = new SitePath(waypoints.map((w) => [w.X, w.Y, w.Z ?? 0]), { loop });
  const at = waypoints.map((_, i) => path.cum[i]);
  if (loop) at.push(path.length);
  return { path, at, source: 'straight', fallbacks: 0, failed: [] };
}

/** heading (compass deg) from site (X0,Y0) toward (X1,Y1) */
export function headingTo(X0, Y0, X1, Y1) {
  const h = Math.atan2(X1 - X0, Y1 - Y0) * DEG;
  return h < 0 ? h + 360 : h;
}
/** shortest signed difference b − a in degrees */
export const angleDiff = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;
export const lerpAngle = (a, b, k) => { const h = a + angleDiff(a, b) * k; return ((h % 360) + 360) % 360; };

/**
 * Polyline in the plan. points: site [X,Y,Z?] arrays (amot) or world Vector3s (meters, e.g. ctx.nav paths).
 * Lengths are in METERS (plan distance), so walking speeds are physical. Z is interpolated when the points have
 * heights (nav paths always do); use it as the hint for floorZ on stairs and multi-level spots.
 */
export class SitePath {
  constructor(points, { loop = false } = {}) {
    const P = (points || []).map((p) => (p instanceof Vector3
      ? { X: p.x / AMAH, Y: -p.z / AMAH, Z: p.y / AMAH }
      : { X: p[0], Y: p[1], Z: Number.isFinite(p[2]) ? p[2] : NaN }));
    if (loop && P.length > 1) P.push({ ...P[0] });
    this.points = P;
    this.loop = loop;
    this.cum = new Float64Array(P.length);
    for (let i = 1; i < P.length; i++) this.cum[i] = this.cum[i - 1] + Math.hypot(P[i].X - P[i - 1].X, P[i].Y - P[i - 1].Y) * AMAH;
    this.length = P.length ? this.cum[P.length - 1] : 0;
  }

  /** index of the segment containing distance d (binary search) */
  _seg(d) {
    const c = this.cum;
    let lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
    return lo;
  }

  /** point at distance d (meters; looped paths wrap, open ones clamp) → out { X, Y, Z, heading, k } */
  sample(d, out = {}) {
    const P = this.points;
    if (!P.length) return null;
    if (P.length === 1 || this.length <= 0) { Object.assign(out, P[0], { heading: out.heading ?? 0, k: 1 }); return out; }
    d = this.loop ? ((d % this.length) + this.length) % this.length : clamp(d, 0, this.length);
    const i = Math.min(this._seg(d), P.length - 2);
    const a = P[i], b = P[i + 1];
    const L = this.cum[i + 1] - this.cum[i];
    const k = L > 1e-9 ? (d - this.cum[i]) / L : 0;
    out.X = a.X + (b.X - a.X) * k;
    out.Y = a.Y + (b.Y - a.Y) * k;
    out.Z = Number.isFinite(a.Z) && Number.isFinite(b.Z) ? a.Z + (b.Z - a.Z) * k : NaN;
    if (L > 1e-6) out.heading = headingTo(a.X, a.Y, b.X, b.Y);
    else if (out.heading == null) out.heading = 0;
    out.k = this.length ? d / this.length : 1;
    out.seg = i;
    return out;
  }

  /** like sample(), displaced `side` meters to the right of the direction of travel and `ahead` meters along it */
  offset(d, side = 0, ahead = 0, out = {}) {
    this.sample(d + ahead, out);
    if (side) {
      const r = (out.heading + 90) / DEG;
      out.X += (Math.sin(r) * side) / AMAH;
      out.Y += (Math.cos(r) * side) / AMAH;
    }
    return out;
  }
}

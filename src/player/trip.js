// Trips (docs/console-design.md §4.3, §4.5, §6.3.1): the bookkeeping of one goTo — its route as a polyline of world
// feet points, the places (zones) the route crosses, sampled every 0.5 m and with runs under 1 m merged so a wall or a
// gateway never flickers, and the crossings as the walker's distance along the route grows. Pure: no bus, no physics;
// goto.js feeds it and emits the travel:* events. Node-testable (src/player/dev/triptest.mjs runs its unit part).

/** pace multiplier bounds and the paces the UI offers */
export const PACE_MIN = 0.25, PACE_MAX = 10;
export const clampPace = (p) => {
  const v = Number(p);
  return Number.isFinite(v) && v > 0 ? Math.max(PACE_MIN, Math.min(PACE_MAX, v)) : 1;
};
/** route sampling step and the shortest run kept as its own place (m) */
export const SAMPLE_STEP = 0.5, MIN_RUN = 1.0;
/** a segment whose ends differ more than this in height (stairs, ramps) is sampled on the floor below it */
const SLOPE_SNAP = 0.3;

const len3 = (a, b) => Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);

/**
 * A route: pts (world feet points, {x, y, z}), air[k] (segment k → k+1 is flown or climbed: never snapped to a floor),
 * cum (3D distance to each point), total.
 */
export function makeRoute(pts, air = null) {
  const cum = new Float64Array(pts.length);
  for (let k = 1; k < pts.length; k++) cum[k] = cum[k - 1] + len3(pts[k - 1], pts[k]);
  const a = new Uint8Array(Math.max(0, pts.length - 1));
  if (air === true) a.fill(1);
  else if (air) for (let k = 0; k < a.length; k++) a[k] = air[k] ? 1 : 0;
  return { pts, air: a, cum, total: pts.length ? cum[pts.length - 1] : 0 };
}

/** segment index containing route distance s (the last segment for s ≥ total) */
export function segmentAt(R, s) {
  const n = R.pts.length;
  if (n < 2) return 0;
  let lo = 0, hi = n - 2;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R.cum[m] <= s) lo = m; else hi = m - 1; }
  return lo;
}

/** the point at route distance s into out ({x, y, z}); returns the segment index */
export function pointAt(R, s, out) {
  const n = R.pts.length;
  if (!n) return -1;
  if (n === 1 || s <= 0) { const p = R.pts[0]; out.x = p.x; out.y = p.y; out.z = p.z; return 0; }
  const k = segmentAt(R, Math.min(s, R.total));
  const A = R.pts[k], B = R.pts[k + 1], L = R.cum[k + 1] - R.cum[k];
  const f = L > 1e-9 ? Math.max(0, Math.min(1, (s - R.cum[k]) / L)) : 1;
  out.x = A.x + (B.x - A.x) * f; out.y = A.y + (B.y - A.y) * f; out.z = A.z + (B.z - A.z) * f;
  return k;
}

/**
 * Zone runs of route R from distance `from` on: [{ zone, s0, s1 }], sampled every `step` m. zoneAt(p) → id | null
 * (p: world feet point); snap(p) → floor y | null puts a sample on a stair or ramp segment on the floor under it (the
 * string-pulled path cuts the air above a flight). A boundary is placed midway between the two samples that differ.
 */
export function sampleRuns(R, zoneAt, { from = 0, step = SAMPLE_STEP, snap = null } = {}) {
  const runs = [];
  if (!R.pts.length) return runs;
  const p = { x: 0, y: 0, z: 0 };
  const zoneOf = (s) => {
    const k = pointAt(R, s, p);
    if (snap && k >= 0 && k < R.air.length && !R.air[k] && Math.abs(R.pts[k + 1].y - R.pts[k].y) > SLOPE_SNAP) {
      const y = snap(p);
      if (Number.isFinite(y) && Math.abs(y - p.y) < 1.5) p.y = y;
    }
    return zoneAt(p) ?? null;
  };
  let cur = null, prevS = from;
  for (let s = from; ; s += step) {
    const sc = Math.min(s, R.total);
    const z = zoneOf(sc);
    if (!cur) { cur = { zone: z, s0: from, s1: sc }; runs.push(cur); }
    else if (z !== cur.zone) {
      // the boundary to ~step/16 by bisection (a run's length decides whether it is merged)
      let lo = prevS, hi = sc;
      for (let i = 0; i < 4; i++) { const m = (lo + hi) / 2; if (zoneOf(m) === cur.zone) lo = m; else hi = m; }
      const b = (lo + hi) / 2;
      cur.s1 = b;
      cur = { zone: z, s0: b, s1: sc };
      runs.push(cur);
    } else cur.s1 = sc;
    prevS = sc;
    if (sc >= R.total) break;
  }
  return runs;
}

/** adjacent runs of the same zone joined (in place on a copy) */
function join(runs) {
  const out = [];
  for (const r of runs) {
    const last = out[out.length - 1];
    if (last && last.zone === r.zone) last.s1 = r.s1;
    else out.push({ ...r });
  }
  return out;
}

/**
 * Runs shorter than `min` m (and runs of no zone) merged into a neighbour, shortest first: into both neighbours when
 * they are the same place, else into the longer one. The first `locked` runs (already announced) are never removed,
 * though a short run after them may extend the last of them; the last run (the destination) is never merged away.
 */
export function mergeRuns(runs, min = MIN_RUN, locked = 0) {
  const out = join(runs);
  for (;;) {
    let bi = -1, bl = Infinity;
    for (let i = Math.max(locked, 0); i < out.length - 1; i++) {
      const L = out[i].zone == null ? -1 : out[i].s1 - out[i].s0;
      if (L < min && L < bl) { bl = L; bi = i; }
    }
    if (bi < 0) break;
    const r = out[bi], a = out[bi - 1], b = out[bi + 1];
    if (a && b && a.zone === b.zone) { a.s1 = b.s1; out.splice(bi, 2); continue; }
    const la = a ? a.s1 - a.s0 : -Infinity, lb = b.s1 - b.s0;
    if (a && la >= lb) a.s1 = r.s1; else b.s0 = r.s0;
    out.splice(bi, 1);
  }
  return join(out);
}

/** zone runs of a whole route (sampled, merged) */
export function routeZones(R, zoneAt, opts = {}) {
  return mergeRuns(sampleRuns(R, zoneAt, opts), opts.min ?? MIN_RUN, 1);
}

/**
 * One trip. opts: { id, label: { en }, way, pace, mps, zoneAt(p), snap?(p) }. setRoute() installs (or, mid-trip,
 * replaces from the current distance on) the route; advance(s) moves the distance on and returns the zone runs crossed
 * since the last call, in order, each { zone, prev, index, s, at: {x, y, z} } (a place is never announced twice in a
 * row, and the run the trip starts in is not announced).
 */
export class Trip {
  constructor(opts) {
    Object.assign(this, { id: opts.id, label: opts.label || null, way: opts.way, pace: opts.pace, mps: opts.mps, to: opts.to || null });
    this.zoneAt = opts.zoneAt;
    this.snap = opts.snap || null;
    this.route = null;
    this.zones = [];
    this.next = 1;         // the next run to announce
    this.s = 0;
    this.lastZone = null;  // the place last announced (or started in)
    this.effectivePace = this.pace;
    this.started = false;
  }

  get total() { return this.route ? this.route.total : 0; }
  get remaining() { return Math.max(0, this.total - this.s); }

  /**
   * Install the route pts (world feet points; air: true | per-segment flags), replacing the part after the current
   * distance; sample = false lists only the start and end places (a veiled hop: nothing between is crossed). Returns the
   * index of pts[0] in the trip's route.
   */
  setRoute(pts, { air = null, sample = true } = {}) {
    const old = this.route;
    let base = [], baseAir = [];
    if (old && this.s > 1e-6 && old.pts.length) {
      const k = segmentAt(old, this.s);
      base = old.pts.slice(0, k + 1);
      baseAir = Array.from(old.air.slice(0, k));
      const p = { x: 0, y: 0, z: 0 };
      pointAt(old, this.s, p);
      if (this.s - old.cum[k] > 1e-3) { base.push(p); baseAir.push(old.air[k] || 0); }
      baseAir.push(0); // the joint to the new part is walked
    }
    const segAir = air === true ? pts.map(() => 1).slice(1) : air ? Array.from(air) : pts.map(() => 0).slice(1);
    const all = base.concat(pts);
    const R = makeRoute(all, baseAir.concat(segAir));
    const idx0 = base.length;
    // the places: those already passed are kept as they were; the rest sampled from the current distance on
    const s0 = Math.min(this.s, R.total);
    const kept = this.zones.filter((r) => r.s0 < s0 - 1e-9).map((r) => ({ ...r }));
    if (kept.length) kept[kept.length - 1].s1 = s0;
    let fresh;
    if (!sample) {
      const p = { x: 0, y: 0, z: 0 };
      pointAt(R, s0, p);
      const za = this.zoneAt(p) ?? null;
      const end = R.pts[R.pts.length - 1];
      const zb = end ? this.zoneAt(end) ?? null : za;
      fresh = za === zb ? [{ zone: zb, s0, s1: R.total }] : [{ zone: za, s0, s1: s0 }, { zone: zb, s0, s1: R.total }];
    } else fresh = sampleRuns(R, this.zoneAt, { from: s0, snap: this.snap });
    if (!kept.length && fresh.length && this.lastZone == null) this.lastZone = fresh[0].zone;
    this.zones = mergeRuns(kept.concat(fresh), MIN_RUN, Math.max(1, Math.min(this.next, kept.length)));
    this.next = Math.max(1, Math.min(this.next, this.zones.length));
    this.route = R;
    return idx0;
  }

  /** move to distance s (never backwards); the runs crossed, in order */
  advance(s) {
    if (Number.isFinite(s) && s > this.s) this.s = Math.min(s, this.total);
    const out = [];
    while (this.next < this.zones.length && this.zones[this.next].s0 <= this.s + 1e-9) {
      const r = this.zones[this.next], i = this.next++;
      if (r.zone == null || r.zone === this.lastZone) continue;
      const at = { x: 0, y: 0, z: 0 };
      pointAt(this.route, r.s0, at);
      out.push({ zone: r.zone, prev: this.lastZone, index: i, s: r.s0, at });
      this.lastZone = r.zone;
    }
    return out;
  }

  /** the public snapshot (ctx.player.trip) */
  info(extra = {}) {
    return {
      id: this.id, label: this.label, way: this.way, pace: this.pace, effectivePace: this.effectivePace, mps: this.mps,
      s: this.s, total: this.total, remaining: this.remaining, to: this.to, zones: this.zones.map((r) => ({ ...r })), ...extra,
    };
  }
}

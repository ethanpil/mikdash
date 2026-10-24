// Group G4 (courts and chambers) — shared staging helpers. Everything here is a pure function of its arguments, so a
// figure's position, heading and pose are pure functions of (t, date, seed) (ARCHITECTURE §9).
//
//   Route   an authored polyline in the site frame with EXACT floor heights at its vertices (linear between them —
//           stairs are given by their tread-midpoint line), lengths in metres, headings blended round its corners.
//           Exact heights mean no physics query per frame (the walkers' floors are the datums and the sourced stairs).
//   Itin    one figure's itinerary as legs laid end to end in minutes: walks along routes (stride-matched phases from
//           the metres walked) and stands / acts in place (turning in and out smoothly). sample(u) → pose.
//   Troupe  a pool of figures, each running episodes [t0, t0 + T] planned once per date; the current episode's
//           itinerary is built lazily (allocation once per episode, not per frame).
import { AMAH } from '../../../core/units.js';
import { clamp, wrap, since, rand, hashStr, upperBound } from '../../lib/core.js';
import { headingTo, angleDiff } from '../../lib/path.js';

export const DEG = Math.PI / 180;
export const norm = (h) => ((h % 360) + 360) % 360;
export const lerpH = (a, b, k) => norm(a + angleDiff(a, b) * clamp(k));

/** a seed that changes with the civil date (per-date plans) */
export const daySeed = (ctx, base) => (hashStr(ctx.time?.dateString || '') ^ Math.imul(base, 0x9e3779b1)) >>> 0;

/** the day's quantile q in [0, 1] (OFFERING_RULES.frequency.counting: ONE seeded draw per date) */
export const dayQuantile = (ctx) => rand(hashStr(ctx.time?.dateString || ''), 'q-offerings');

/** minutes since local midnight → 'HH:MM' (debug) */
export const hm = (t) => `${String(Math.floor(wrap(t) / 60)).padStart(2, '0')}:${String(Math.floor(wrap(t) % 60)).padStart(2, '0')}`;

/** is the observer within `range` metres (plan) and 8 m (height) of site point p? */
export function observerNear(ctx, p, range) {
  const o = ctx.player?.position;
  if (!o || !p) return false;
  const x = p[0] * AMAH, z = -p[1] * AMAH, y = (p[2] ?? 0) * AMAH;
  return Math.hypot(o.x - x, o.z - z) < range && Math.abs(o.y - y) < 8;
}

// ------------------------------------------------------------------------------------------------ Route
export class Route {
  /**
   * pts: [[X, Y, Z], …] site amot with exact floor Z at each vertex. loop: closed. round: metres over which the
   * heading turns at each corner (half before, half after the vertex).
   */
  constructor(pts, { loop = false, round = 1.2 } = {}) {
    const P = pts.map((p) => [p[0], p[1], p[2] ?? 0]);
    if (loop) P.push([...P[0]]);
    this.P = P;
    this.loop = loop;
    this.round = round;
    const n = P.length;
    this.cum = new Float64Array(n);
    this.hd = new Float64Array(Math.max(1, n - 1));
    for (let i = 1; i < n; i++) {
      this.cum[i] = this.cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]) * AMAH;
      const h = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]) > 1e-6 ? headingTo(P[i - 1][0], P[i - 1][1], P[i][0], P[i][1]) : (i > 1 ? this.hd[i - 2] : 0);
      this.hd[i - 1] = h;
    }
    this.length = this.cum[n - 1] || 0;
  }
  /** distance (m) along the route of its vertex i */
  at(i) { return this.cum[Math.max(0, Math.min(this.cum.length - 1, i))]; }
  /** point at distance d (m) → out { X, Y, Z, heading }; side = metres to the right of the direction of travel */
  sample(d, out, side = 0, reverse = false) {
    const c = this.cum, P = this.P, n = P.length, L = this.length;
    if (n < 2 || L <= 0) { out.X = P[0][0]; out.Y = P[0][1]; out.Z = P[0][2]; out.heading = 0; return out; }
    d = this.loop ? ((d % L) + L) % L : clamp(d, 0, L);
    let i = upperBound(c, d) - 1;
    if (i < 0) i = 0;
    if (i > n - 2) i = n - 2;
    const s = c[i + 1] - c[i], k = s > 1e-9 ? (d - c[i]) / s : 0;
    const a = P[i], b = P[i + 1];
    out.X = a[0] + (b[0] - a[0]) * k;
    out.Y = a[1] + (b[1] - a[1]) * k;
    out.Z = a[2] + (b[2] - a[2]) * k;
    let h = this.hd[i];
    // turn smoothly through the corners: blend toward the neighbouring segment within round/2 of a vertex
    const r = this.round / 2;
    if (r > 0) {
      const toEnd = c[i + 1] - d, fromStart = d - c[i];
      if (toEnd < r && (i + 1 < n - 1 || this.loop)) {
        const hn = this.hd[i + 1 < n - 1 ? i + 1 : 0];
        h = lerpH(h, hn, 0.5 * (1 - toEnd / r));
      } else if (fromStart < r && (i > 0 || this.loop)) {
        const hp = this.hd[i > 0 ? i - 1 : n - 2];
        h = lerpH(hp, h, 0.5 + 0.5 * (fromStart / r));
      }
    }
    if (reverse) h = norm(h + 180);
    out.heading = h;
    if (side) {
      const q = (h + 90) * DEG;
      out.X += (Math.sin(q) * side) / AMAH;
      out.Y += (Math.cos(q) * side) / AMAH;
    }
    return out;
  }
}

/** a straight two-point route (same interface as Route, no arrays: the many short steps planned per day) */
export class LineRoute {
  constructor(a, b) {
    this.ax = a[0]; this.ay = a[1]; this.az = a[2] ?? 0; this.bx = b[0]; this.by = b[1]; this.bz = b[2] ?? 0;
    const dx = this.bx - this.ax, dy = this.by - this.ay;
    this.length = Math.hypot(dx, dy) * AMAH;
    this.h = Math.hypot(dx, dy) > 1e-6 ? headingTo(this.ax, this.ay, this.bx, this.by) : 0;
    this.loop = false;
  }
  sample(d, out, side = 0, reverse = false) {
    const k = this.length > 0 ? clamp(d / this.length) : 0;
    out.X = this.ax + (this.bx - this.ax) * k; out.Y = this.ay + (this.by - this.ay) * k; out.Z = this.az + (this.bz - this.az) * k;
    const h = reverse ? norm(this.h + 180) : this.h;
    out.heading = h;
    if (side) { const q = (h + 90) * DEG; out.X += (Math.sin(q) * side) / AMAH; out.Y += (Math.cos(q) * side) / AMAH; }
    return out;
  }
}

// ------------------------------------------------------------------------------------------------ Itin
const WALK = 0, STAND = 1;
/**
 * An itinerary: legs laid end to end in minutes from 0. Walk legs move along a Route between two distances at v m/s
 * (stride-matched phase from the metres walked so far); stand legs hold a place with a pose, turning in from the
 * previous heading and out to the next one over TURN minutes.
 */
export const TURN = 0.045;
const BLEND_M = 3.0, BLEND_H = 1.6;   // metres over which a walk leg merges from where the last leg ended
const _q0 = {}, _q1 = {};
export class Itin {
  constructor() { this.legs = []; this.T = 0; this.m = 0; this.end = null; }
  /**
   * walk route from d0 to d1 metres (d1 < d0 walks it backwards) at v m/s; opts { pose, prop, hand, left, side }.
   * The leg starts exactly where the previous one ended (position and heading) and merges into its own line over
   * BLEND_M metres — so lanes, junctions and corners never jump.
   */
  walk(route, d0, d1, v, opts = {}) {
    const len = Math.abs(d1 - d0);
    if (len < 1e-3) return this;
    const dur = len / v / 60;
    const rev = d1 < d0, side = opts.side || 0;
    const q0 = route.sample(d0, _q0, side, rev);
    const leg = { kind: WALK, t0: this.T, t1: this.T + dur, route, d0, d1, m0: this.m, side, rev,
      ox: 0, oy: 0, oz: 0, hPrev: NaN, hStart: NaN,   // (the heading it sets off on: done(), only after a stand)
      pose: opts.pose || 'walk', prop: opts.prop ?? null, hand: opts.hand || 'right', props2: opts.left ?? null };
    if (this.end) {
      leg.ox = this.end.X - q0.X; leg.oy = this.end.Y - q0.Y; leg.oz = this.end.Z - q0.Z;
      leg.hPrev = this.end.heading;
    }
    this.legs.push(leg);
    this.T += dur;
    this.m += len;
    this.end = this._walkAt(leg, len, {});
    leg.hEnd = this.end.heading;
    return this;
  }
  _walkAt(g, dist, out) {
    const d = g.d0 + (g.rev ? -dist : dist);
    g.route.sample(d, out, g.side, g.rev);
    const kb = 1 - clamp(dist / BLEND_M);
    if (kb > 0) {
      const e = kb * kb * (3 - 2 * kb);
      out.X += g.ox * e; out.Y += g.oy * e; out.Z += g.oz * e;
    }
    if (Number.isFinite(g.hPrev) && dist < BLEND_H) out.heading = lerpH(g.hPrev, out.heading, dist / BLEND_H);
    return out;
  }
  /** walk a fresh straight-line route through pts ([[X,Y,Z],…], the first = where the figure is) */
  walkTo(pts, v, opts) {
    const r = pts.length === 2 ? new LineRoute(pts[0], pts[1]) : new Route(pts, { round: opts?.round ?? 1.0 });
    return this.walk(r, 0, r.length, v, opts);
  }
  /**
   * stand / act for `min` minutes at (X, Y, Z) facing `heading`. opts { pose, phase: number | (k, u) => phase | null
   * (auto), prop, hand, left, turn: false to snap, at: [X,Y,Z] }. k = 0..1 through the leg, u = minutes into it.
   */
  stand(min, heading, opts = {}) {
    if (!(min > 0)) return this;
    const at = opts.at || (this.end ? [this.end.X, this.end.Y, this.end.Z] : [0, 0, 0]);
    // ease: minutes over which the figure moves from where it was to `at` (sitting down, stepping into place)
    const from = this.end && opts.ease > 0 ? [this.end.X, this.end.Y, this.end.Z] : null;
    const leg = { kind: STAND, t0: this.T, t1: this.T + min, X: at[0], Y: at[1], Z: at[2], h: heading, hIn: NaN, hOut: NaN, from, ease: opts.ease || 0,
      pose: opts.pose || 'stand', phase: opts.phase ?? null, prop: opts.prop ?? null, hand: opts.hand || 'right', props2: opts.left ?? null,
      turn: opts.turn !== false, m0: this.m };
    this.legs.push(leg);
    this.T += min;
    this.end = { X: at[0], Y: at[1], Z: at[2], heading };
    return this;
  }
  /** finish: link the stand legs' turn-in / turn-out headings to their neighbours */
  done() {
    const L = this.legs;
    for (let i = 0; i < L.length; i++) {
      const g = L[i];
      if (g.kind !== STAND || !g.turn) continue;
      const p = L[i - 1], n = L[i + 1];
      if (p) g.hIn = p.kind === STAND ? p.h : p.hEnd;
      if (n && n.kind === WALK) {
        if (!Number.isFinite(n.hStart)) n.hStart = n.route.sample(n.d0 + (n.rev ? -1 : 1) * Math.min(0.5, Math.abs(n.d1 - n.d0)), _q1, n.side, n.rev).heading;
        g.hOut = n.hStart; n.hPrev = n.hStart;   // turned already: the walk sets off straight
      }
    }
    return this;
  }
  /** the leg at minute u (clamped to the itinerary) */
  legAt(u) {
    const L = this.legs;
    let lo = 0, hi = L.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (L[m].t0 <= u) lo = m; else hi = m - 1; }
    return L[lo];
  }
  /** sample at minute u → out { X, Y, Z, heading, pose, phase (number | null), m (metres walked), walking, prop, hand, left, leg } */
  sample(u, out) {
    const g = this.legAt(clamp(u, 0, this.T));
    out.leg = g;
    out.prop = g.prop; out.hand = g.hand; out.left = g.props2;
    if (g.kind === WALK) {
      const k = clamp((u - g.t0) / (g.t1 - g.t0 || 1));
      const dist = Math.abs(g.d1 - g.d0) * k;
      this._walkAt(g, dist, out);
      out.m = g.m0 + dist;
      out.pose = g.pose; out.phase = null; out.walking = true; out.still = false;
      return out;
    }
    const v = u - g.t0, len = g.t1 - g.t0;
    out.X = g.X; out.Y = g.Y; out.Z = g.Z;
    // still: nothing about the figure changes from frame to frame (no phase curve, no turn or step in progress)
    out.still = typeof g.phase !== 'function' && !(g.from && v < g.ease)
      && !(g.turn && ((Number.isFinite(g.hIn) && v < TURN) || (Number.isFinite(g.hOut) && len - v < TURN)));
    if (g.from && v < g.ease) {
      const e = v / g.ease, k = e * e * (3 - 2 * e);
      out.X = g.from[0] + (g.X - g.from[0]) * k; out.Y = g.from[1] + (g.Y - g.from[1]) * k; out.Z = g.from[2] + (g.Z - g.from[2]) * k;
    }
    let h = g.h;
    if (g.turn) {
      const tt = Math.min(TURN, len / 3);
      if (Number.isFinite(g.hIn) && v < tt) h = lerpH(g.hIn, g.h, v / tt);
      else if (Number.isFinite(g.hOut) && len - v < tt) h = lerpH(g.h, g.hOut, 1 - (len - v) / tt);
    }
    out.heading = h;
    out.m = g.m0;
    out.pose = g.pose;
    out.phase = typeof g.phase === 'function' ? g.phase(clamp(v / (len || 1)), v) : g.phase;
    out.walking = false;
    return out;
  }
}

/**
 * An animal led on a rope: it keeps `lag` metres behind its leader along the very path the leader walks (his
 * itinerary's metres walked), so it stops when he stops and steps where he stepped; walking with him, standing at the
 * halter while he stands. Same sample() interface as Itin (a Troupe episode's `it`); out.lead = true.
 */
export class Follower {
  constructor(lead, lag, { walkPose = 'walk_led', standPose = 'stand_halter' } = {}) {
    this.lead = lead; this.lag = lag; this.walkPose = walkPose; this.standPose = standPose;
    this.T = lead.T;
    // the leader's walk legs by metres
    this.walks = lead.legs.filter((g) => g.kind === WALK);
    this.m0 = Float64Array.from(this.walks, (g) => g.m0);
    this._s = {}; this._legs = [{}, {}];
  }
  sample(u, out) {
    const s = this.lead.sample(u, this._s);
    const m = Math.max(0, s.m - this.lag);
    let i = upperBound(this.m0, m) - 1;
    if (i < 0) i = 0;
    const g = this.walks[i];
    if (!g) { out.X = s.X; out.Y = s.Y; out.Z = s.Z; out.heading = s.heading; out.pose = this.standPose; out.phase = null; out.walking = false; out.still = false; out.m = m; out.prop = null; out.left = null; out.leg = this; out.lead = true; return out; }
    const len = Math.abs(g.d1 - g.d0);
    this.lead._walkAt(g, Math.min(len, Math.max(0, m - g.m0)), out);
    // before the leader has gone a rope's length it stands that much behind his start, on the way he sets off (where
    // they come in together), not under him
    if (s.m < this.lag) {
      const h = (out.heading * Math.PI) / 180, b = (this.lag - s.m) / AMAH;
      out.X -= Math.sin(h) * b; out.Y -= Math.cos(h) * b;
    }
    out.m = m;
    out.walking = s.walking && s.m > this.lag;
    out.pose = out.walking ? this.walkPose : this.standPose;
    out.phase = null;
    out.still = false;
    out.prop = null; out.left = null; out.hand = 'right';
    // a fresh leg object each time the follower changes between walking and standing (Troupe's still-skip key)
    out.leg = this._legs[out.walking ? 0 : 1];
    out.lead = true;
    return out;
  }
}

/** stride-matched phase for a walking pose after `m` metres (people.util.phaseFor; a fallback stride otherwise) */
export function stride(ctx, slot, pose, m) {
  const f = ctx.people?.util?.phaseFor;
  if (f && slot.actor) return f(slot.actor, pose, Math.max(0, m));
  const p = Math.max(0, m) / 1.45;
  return p - Math.floor(p);
}

/** stand a Slot at an itinerary sample (exact Z — no floor query) */
export function applySample(ctx, slot, s) {
  // a slot g4/sets.js's SetCast posed last: forget its prop caches
  if (slot._by === 'set') { slot._by = 'itin'; slot._p2 = 'set'; slot._prop = undefined; slot._hand = null; }
  slot.place(s.X, s.Y, s.Z).heading(s.heading);
  if (s.walking) slot.pose(s.pose, stride(ctx, slot, s.pose, s.m));
  else slot.pose(s.pose, s.phase == null ? undefined : s.phase);
  // two props (people setProps(right, left)); setProp alone never clears the left hand, so going back to one prop
  // goes through setProps(right, null). The Slot's own cache is kept in step with the right hand.
  const key2 = s.left != null ? `${s.prop}|${s.left}` : null;
  if ((key2 || slot._p2) && slot.actor?.setProps) {
    if (slot._p2 !== key2) { slot._p2 = key2; slot.actor.setProps(s.prop || null, s.left ?? null); slot._prop = s.prop || null; slot._hand = 'right'; }
    if (!key2) slot.prop(s.prop, s.hand);
  } else slot.prop(s.prop, s.hand);
  slot.show();
}

// ------------------------------------------------------------------------------------------------ Troupe
const MID2 = 40 * 40;
/**
 * A pool whose slots each run a list of episodes { t0, T, …data } (minutes; t0 on the day's clock, ascending, no
 * overlap within a slot), planned once per date by plan(slotIndex) → episodes. legs(episode, slotIndex) → Itin
 * builds the current episode's itinerary on first use.
 */
export class Troupe {
  constructor(pool, { plan, legs, active = null }) {
    this.pool = pool;
    this.planFn = plan;
    this.legsFn = legs;
    this.active = active;     // slots in use at this tier (null = all)
    this.eps = [];
    this.starts = [];
    this.cur = new Array(pool.count).fill(null);
    this.curIdx = new Int32Array(pool.count).fill(-1);
    this.gen = -1;
    this.s = {};
  }
  get count() { return this.pool.count; }
  replan(gen) {
    if (this.gen === gen) return;
    this.gen = gen;
    const n = this.active ?? this.pool.count;
    this.eps = [];
    this.starts = [];
    for (let k = 0; k < this.pool.count; k++) {
      const list = k < n ? (this.planFn(k) || []) : [];
      list.sort((a, b) => a.t0 - b.t0);
      this.eps.push(list);
      this.starts.push(Float64Array.from(list, (e) => e.t0));
    }
    this.cur.fill(null);
    this.curIdx.fill(-1);
  }
  /** the episode of slot k at time t (minutes, the day's clock) and the minutes into it, or null */
  episodeAt(k, t) {
    const st = this.starts[k];
    if (!st?.length) return null;
    const i = upperBound(st, t) - 1;
    if (i < 0) return null;
    const e = this.eps[k][i];
    if (t > e.t0 + e.T) return null;
    if (this.curIdx[k] !== i) { this.curIdx[k] = i; this.cur[k] = this.legsFn(e, k); }
    return e;
  }
  /** pose every slot that is mid-episode at t; cb(k, slot, sample, episode) may adjust before it is applied */
  update(ctx, sim, t, cb) {
    const s = this.s;
    let n = 0;
    const pp = ctx.player?.position || null;
    const odd = (this._frame = (this._frame || 0) + 1) & 1;
    for (let k = 0; k < this.pool.count; k++) {
      const e = this.episodeAt(k, t);
      if (!e) continue;
      const slot = this.pool.slot(k);
      if (!sim.due(slot)) continue;
      // figures 40–120 m away are re-posed every other frame (beyond, the runtime's own LOD thins them further)
      if (!sim.forced && pp && slot.placed && ((k & 1) === odd) && slot._leg && slot.pos.distanceToSquared(pp) > MID2) { slot.show(); n++; continue; }
      const it = this.cur[k];
      it.sample(t - e.t0, s);
      if (cb && cb(k, slot, s, e) === false) continue;
      // a figure standing still on the same leg as last time is already posed: only keep it wanted
      if (s.still && slot._leg === s.leg && !sim.forced) { slot.show(); n++; continue; }
      slot._leg = s.leg;
      applySample(ctx, slot, s);
      n++;
    }
    return n;
  }
  /** the number of slots mid-episode at t (debug) */
  busy(t) { let n = 0; for (let k = 0; k < this.pool.count; k++) if (this.episodeAt(k, t)) n++; return n; }
}

/** seeded integer in [a, b] */
export const randInt = (seed, a, b, k0, k1, k2) => a + Math.floor(rand(seed, k0, k1, k2) * (b - a + 1));
/** seeded pick from an array */
export const pick = (seed, arr, k0, k1, k2) => arr[Math.min(arr.length - 1, Math.floor(rand(seed, k0, k1, k2) * arr.length))];

/** the slots a tier stages: max(min, round(n × crowdScale, floor at `low`)) */
export const tierCount = (sim, n, min = 1, low = 0.5) => Math.max(min, Math.min(n, Math.round(n * Math.max(low, sim.crowdScale))));

/** a window [t0, t1] of an event of this choreo (null when the date does not have it) */
export function win(sim, id) {
  const e = sim.events.find((x) => x.id === id) || null;
  return e && Number.isFinite(e.t0) && Number.isFinite(e.t1) ? [e.t0, e.t1] : null;
}

/** minutes from a to b on the cycle, but as a signed small offset when b is just before a */
export const ahead = (a, b) => { const d = since(b, a); return d > 720 ? d - 1440 : d; };

// ------------------------------------------------------------------------------------------------ parties
/**
 * Seeded arrival times over [a, b] at rate(t) per minute (a thinned stream: one uniform per arrival) — deterministic.
 * maxRate bounds rate(t). Returns ascending minutes.
 */
export function arrivals(seed, key, a, b, rate, maxRate) {
  const out = [];
  let t = a;
  for (let i = 0; i < 5000 && t < b; i++) {
    t += -Math.log(1 - rand(seed, key, i, 'dt') * 0.999999) / maxRate;
    if (t >= b) break;
    if (rand(seed, key, i, 'keep') * maxRate <= rate(t)) out.push(t);
  }
  return out;
}

/**
 * Give each party member a slot of its pool free over its whole episode. parties: [{ members: [{ pool, t0, T, it }] }]
 * (members with absolute t0); counts: { pool: n slots in use }. A party whose members do not all fit is dropped
 * whole. Returns { eps: { pool: [episodes per slot] }, dropped }.
 */
export function assignParties(parties, counts, margin = 0.6) {
  const free = {}, eps = {};
  for (const [k, n] of Object.entries(counts)) { free[k] = new Array(n).fill(-1e9); eps[k] = Array.from({ length: n }, () => []); }
  let dropped = 0;
  for (const p of parties) {
    const pick = [];
    const taken = {};
    let ok = true;
    for (const m of p.members) {
      const f = free[m.pool];
      if (!f) { ok = false; break; }
      let k = -1;
      for (let i = 0; i < f.length; i++) if (f[i] < m.t0 - margin && !(taken[m.pool] || []).includes(i)) { k = i; break; }
      if (k < 0) { ok = false; break; }
      (taken[m.pool] ||= []).push(k);
      pick.push(k);
    }
    if (!ok) { dropped++; continue; }
    p.members.forEach((m, j) => { free[m.pool][pick[j]] = m.t0 + m.T; eps[m.pool][pick[j]].push({ t0: m.t0, T: m.T, it: m.it, party: p }); });
  }
  return { eps, dropped };
}

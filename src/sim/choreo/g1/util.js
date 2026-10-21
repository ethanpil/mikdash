// Shared helpers for the G1 night & pre-dawn choreographies (locking-up / moked-night / moked-dawn, altar-night,
// lotteries, torch-inspection). Everything here is a pure function of its inputs: the modules stay pure functions of
// (t, date, seed).
//
// The itinerary engine: a person's night is a list of episodes; an episode starts at a clock time S and is a chain of
// legs laid end to end. A leg is a hold (a place, a heading, a pose — with an optional turn and a phase curve) or a walk
// (a SitePath between two distances, stride-matched). Each leg names its OWNER module, so several modules can stage
// one person in turn (same seed in each module's pool → the same face and body) without ever showing him twice.
import { wrap, since, clamp, smooth, lerp } from '../../lib/core.js';
import { SitePath, headingTo, angleDiff } from '../../lib/path.js';
import { m2w, AMAH as AMAH_M } from '../../../core/units.js';

export { SitePath };

/** an episode: { S (start, wrapped), legs, ends (cumulative minutes), total } */
export function episode(S, legs) {
  let c = 0;
  const ends = new Float64Array(legs.length);
  for (let i = 0; i < legs.length; i++) { c += Math.max(0, legs[i].dur); ends[i] = c; }
  return { S: wrap(S), legs, ends, total: c };
}

/** the leg of an episode at t → out { leg, local, i } | null (out reused: no allocation) */
export function legAt(ep, t, out) {
  if (!ep || !ep.total) return null;
  const e = since(t, ep.S);
  if (e >= ep.total) return null;
  const E = ep.ends;
  let lo = 0, hi = E.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (E[m] > e) hi = m; else lo = m + 1; }
  out.leg = ep.legs[lo];
  out.local = e - (E[lo] - ep.legs[lo].dur);
  out.i = lo;
  return out;
}

/** first episode of a person whose span contains t (episodes listed in priority order) */
export function personAt(eps, t, out) {
  for (let i = 0; i < eps.length; i++) if (legAt(eps[i], t, out)) return out;
  return null;
}

// ------------------------------------------------------------------------------------------------- legs
/**
 * hold at [X, Y, Z]: { at, h (heading), h0? (turn from), turn? (min), pose, phase?, prop?, hand?, props?, owner, role,
 * dur, exact? (Z is exact, not a floor hint) }. phase: undefined → the clip animates itself; number; fn(local, dur).
 */
export const hold = (o) => ({ kind: 'hold', ...o });
/** walk along path from d0 to d1 (metres): { path, d0, d1, pose ('walk'), prop, owner, role, dur | speed (m/s) } */
export function walk(o) {
  const len = Math.abs(o.d1 - o.d0);
  const dur = o.dur ?? (len / (o.speed || 1.2) / 60);
  return { kind: 'walk', pose: 'walk', ...o, dur, len };
}

/** a straight SitePath through site points [[X,Y,Z], …] */
export const line = (pts) => new SitePath(pts);

/** walk the whole of a path of points: returns the leg (and its end heading on leg.endH) */
export function walkPts(pts, o) {
  const path = line(pts);
  const leg = walk({ path, d0: 0, d1: path.length, ...o });
  const n = pts.length;
  leg.endH = headingTo(pts[n - 2][0], pts[n - 2][1], pts[n - 1][0], pts[n - 1][1]);
  leg.startH = headingTo(pts[0][0], pts[0][1], pts[1][0], pts[1][1]);
  return leg;
}

// ------------------------------------------------------------------------------------------------- phase curves
/** one-shot clips (kneel / bow / prostrate): down over tDown, held at 0.5, up over the last tUp (minutes) */
export const downHoldUp = (tDown = 0.05, tUp = 0.05, keepDown = false) => (local, dur) => {
  if (local < tDown) return 0.3 * (local / tDown);
  if (!keepDown && local > dur - tUp) return 0.7 + 0.3 * clamp((local - (dur - tUp)) / tUp);
  return 0.5;
};
/** a single action over its whole leg (toss, pour, throw) */
export const ramp = (a = 0, b = 1) => (local, dur) => lerp(a, b, clamp(local / (dur || 1)));
/** a looping clip played n whole cycles over the leg (knock, call, lock: a deterministic loop) */
export const cycles = (n = 1) => (local, dur) => { const p = n * clamp(local / (dur || 1)); return p - Math.floor(p); };
/** a phase curve shifted: the part of fn(local, total) that starts `shift` minutes into it (a leg split in two) */
export const shifted = (fn, shift, total) => (typeof fn === 'function' ? (local) => fn(local + shift, total) : fn);
/** circle_lot: hand forward at tUp, held, down over the leg's last tDown */
export const lotHand = (tUp = 0.06, tDown = 0.08, lower = true) => (local, dur) => {
  if (local < tUp) return 0.3 * (local / tUp);
  if (lower && local > dur - tDown) return 0.75 + 0.25 * clamp((local - (dur - tDown)) / tDown);
  return 0.5;
};

// ------------------------------------------------------------------------------------------------- applying
const _q = {}, _qa = {}, _qb = {};
const LOOK = 0.3; // m: walking heading from the path a little behind to a little ahead (turns over ≈0.6 m)

/** smoothed heading of a path at distance d (no pop at the corners) */
export function pathHeading(path, d) {
  const a = path.sample(d - LOOK, _qa), b = path.sample(d + LOOK, _qb);
  if (Math.hypot(b.X - a.X, b.Y - a.Y) < 1e-4) return path.sample(d, _q).heading;
  return headingTo(a.X, a.Y, b.X, b.Y);
}

/** stride-matched phase (people.util.phaseFor) */
export function stridePhase(ctx, slot, pose, meters) {
  const f = ctx.people?.util?.phaseFor;
  if (f && slot.actor) return f(slot.actor, pose, Math.max(0, meters));
  const p = Math.max(0, meters) / 1.45;
  return p - Math.floor(p);
}

/**
 * Pose a pool slot from a leg at local minutes. props: leg.props = [right, left] uses actor.setProps (cached on the
 * slot); else leg.prop / leg.hand.
 */
export function applyLeg(ctx, slot, leg, local) {
  const dur = leg.dur || 1e-6;
  if (leg.kind === 'follow') {
    // in file behind a leader: the leader's distance along the route at this moment, less this man's spacing
    const tl = leg.tl, t = leg.t0abs + local;
    let i = 0;
    while (i + 1 < tl.tS.length && tl.tS[i + 1] <= t) i++;
    const D = tl.dS[i] + tl.vS[i] * Math.max(0, t - tl.tS[i]);
    const d = Math.max(0, Math.min(tl.L, D) - leg.off);
    const moving = tl.vS[i] > 0 && D - leg.off > 0 && D < tl.L;
    const q = tl.path.sample(d, _q);
    const Z = Number.isFinite(q.Z) ? q.Z : 16;
    slot.placeNear(q.X, q.Y, Z);
    slot.heading(pathHeading(tl.path, d));
    if (moving) slot.pose(leg.pose, stridePhase(ctx, slot, leg.pose, d));
    else slot.pose(leg.idle || 'stand');
  } else if (leg.kind === 'walk') {
    const k = clamp(local / dur);
    const d = leg.d0 + (leg.d1 - leg.d0) * k;
    const q = leg.path.sample(d, _q);
    let h = pathHeading(leg.path, d);
    if (leg.d1 < leg.d0) h = (h + 180) % 360;
    if (leg.back) h = (h + 180) % 360;    // stepping backwards (walking out facing the holy — Yoma 53a)
    const Z = Number.isFinite(q.Z) ? q.Z : (leg.z ?? 0);
    if (leg.exact) slot.place(q.X, q.Y, Z); else slot.placeNear(q.X, q.Y, Z);
    slot.heading(h);
    slot.pose(leg.pose, stridePhase(ctx, slot, leg.pose, Math.abs(d - leg.d0) + (leg.m0 || 0)));
  } else {
    const a = leg.at;
    if (leg.exact) slot.place(a[0], a[1], a[2]); else slot.placeNear(a[0], a[1], a[2]);
    let h = leg.h;
    if (leg.h0 != null) h = (leg.h0 + angleDiff(leg.h0, leg.h) * smooth(0, leg.turn ?? 0.02, local) + 360) % 360;
    slot.heading(h);
    const ph = leg.phase;
    slot.pose(leg.pose || 'stand', typeof ph === 'function' ? ph(local, dur) : ph);
  }
  if (leg.props) setProps(slot, leg.props[0], leg.props[1]);
  else {
    if (slot._p2r !== undefined) {
      // back to one prop: people's setProp never clears the left hand, so the pair goes first (else the second torch
      // stays in his left hand after he lays both down)
      const a = slot.ensure();
      if (typeof a.setProps === 'function') a.setProps(null, null);
      slot._p2r = slot._p2l = undefined; slot._prop = undefined;
    }
    slot.prop(leg.prop ?? null, leg.hand || 'right');
  }
  // the mitre lifted off his head for the count (Yoma 25a): leg.bare = [from, to] local minutes of the leg
  const b = leg.bare;
  slot.headgear(!(b && local >= b[0] && local < b[1]));
  slot.show();
}

/** one prop per hand (actor.setProps), change-cached on the slot */
export function setProps(slot, right, left) {
  const r = right || null, l = left || null;
  if (slot._p2r === r && slot._p2l === l) return slot;
  slot._p2r = r; slot._p2l = l;
  slot._prop = undefined;              // Slot.prop's cache no longer describes the hands
  const a = slot.ensure();
  if (typeof a.setProps === 'function') a.setProps(r, l);
  else a.setProp(r, 'right');
  return slot;
}

// ------------------------------------------------------------------------------------------------- Track
/**
 * Builder of one episode: a cursor (place, heading, clock) and legs appended in order. Times are absolute minutes in
 * the episode's own unwrapped frame (S may be > 1440 is never used: evening episodes are clipped at 1440).
 *   tr.walk(points, { speed | until, pose, prop, props, exact }) · tr.hold(dur, o) · tr.until(t, o) · tr.at(point, h)
 * o: { pose, phase, h (heading; default: keep), face: [X, Y] (heading toward), prop, props, owner, role, exact }
 */
export class Track {
  constructor(S, at, h, owner, role) {
    this.S = S; this.u = 0; this.cur = [at[0], at[1], at[2]]; this.h = h ?? 0;
    this.owner = owner; this.role = role; this.legs = []; this.m = 0;
  }
  now() { return this.S + this.u; }
  set(o) { if (o.owner) this.owner = o.owner; if (o.role) this.role = o.role; return this; }
  _push(leg) {
    leg.owner = leg.owner || this.owner; leg.role = leg.role || this.role;
    this.legs.push(leg); this.u += leg.dur;
    return this;
  }
  hold(dur, o = {}) {
    if (!(dur > 1e-4)) return this;
    const h = o.face ? hTo(this.cur, o.face) : (o.h ?? this.h);
    const leg = hold({ at: o.at || this.cur, h, h0: Math.abs(angleDiff(this.h, h)) > 2 ? this.h : null, turn: o.turn, pose: o.pose || 'stand', phase: o.phase,
      prop: o.prop, props: o.props, hand: o.hand, owner: o.owner, role: o.role, exact: o.exact, dur });
    if (o.at) this.cur = [o.at[0], o.at[1], o.at[2]];
    this.h = h;
    return this._push(leg);
  }
  until(t, o = {}) { return this.hold(t - this.now(), o); }
  /** set place/heading without time (a pose change on the spot is a hold) */
  at(p, h) { this.cur = [p[0], p[1], p[2] ?? this.cur[2]]; if (h != null) this.h = h; return this; }
  walk(points, o = {}) {
    const pts = [this.cur, ...points.map((p) => [p[0], p[1], p[2] ?? this.cur[2]])];
    if (pts.length < 2) return this;
    const path = new SitePath(pts);
    if (path.length < 1e-3) { this.cur = pts[pts.length - 1]; return this; }
    let dur;
    if (Number.isFinite(o.until)) dur = Math.max(0.02, o.until - this.now());
    else dur = path.length / ((o.speed || 1.15) * 60);
    const leg = { kind: 'walk', path, d0: 0, d1: path.length, len: path.length, dur, pose: o.pose || 'walk', prop: o.prop, props: o.props,
      hand: o.hand, owner: o.owner, role: o.role, exact: o.exact, m0: this.m };
    this.m += path.length;
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    this.cur = [b[0], b[1], b[2]];
    this.h = headingTo(a[0], a[1], b[0], b[1]);
    return this._push(leg);
  }
  /**
   * In file behind a leader (timeline tl: { path, tS[], dS[], vS[] (m/min), L, tEnd }) from now until the leader stops,
   * `off` metres behind him; ends where he stands.
   */
  follow(tl, off, o = {}) {
    const t0 = this.now();
    const dur = Math.max(0.01, tl.tEnd - t0);
    this._push({ kind: 'follow', tl, off, t0abs: t0, dur, pose: o.pose || 'walk', idle: o.idle || 'stand', prop: o.prop, props: o.props, owner: o.owner, role: o.role });
    const q = tl.path.sample(Math.max(0, tl.L - off), {});
    this.cur = [q.X, q.Y, Number.isFinite(q.Z) ? q.Z : this.cur[2]];
    this.h = q.heading ?? this.h;
    return this;
  }
  /**
   * Mark the legs laid so far that overlap the absolute window [t0, t1) with leg[key] = [from, to] in the leg's own
   * minutes (applyLeg reads `bare`: the headgear off then). Call after the window's legs are laid.
   */
  mark(t0, t1, key = 'bare') {
    let s = this.S;
    for (const leg of this.legs) {
      const e = s + leg.dur;
      if (e > t0 && s < t1) leg[key] = [Math.max(0, t0 - s), Math.min(leg.dur, t1 - s) + (e <= t1 ? 1e-6 : 0)];
      s = e;
    }
    return this;
  }
  /** minutes a walk through points would take at speed */
  walkMin(points, speed = 1.15) {
    let L = 0, p = this.cur;
    for (const q of points) { L += Math.hypot(q[0] - p[0], q[1] - p[1]); p = q; }
    return (L * AMAH_M) / (speed * 60);
  }
  episode() { return episode(this.S, this.legs); }
}

/** plan length (m) of a polyline of site points */
export function polyLen(points) {
  let L = 0;
  for (let i = 1; i < points.length; i++) L += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return L * AMAH_M;
}

// ------------------------------------------------------------------------------------------------- misc
/** [t0, t1] of an event with resolved times, else null */
export const win = (ev) => (ev && Number.isFinite(ev.t0) && Number.isFinite(ev.t1) ? [ev.t0, ev.t1] : null);

/** the observer within range (metres, plan) of a site point (and within 12 m in height) */
export function near(ctx, X, Y, Z, range) {
  const p = ctx.player?.position;
  if (!p) return false;
  const w = m2w(X, Y, Z ?? 0, _w);
  return Math.hypot(p.x - w.x, p.z - w.z) < range && Math.abs(p.y - w.y) < 12;
}
const _w = m2w(0, 0, 0);

/** a point on a circle (site), angle in compass degrees from the centre */
export function onCircle(c, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [c[0] + Math.sin(a) * r, c[1] + Math.cos(a) * r, c[2]];
}

/** compass heading from point a to point b ([X, Y]) */
export const hTo = (a, b) => headingTo(a[0], a[1], b[0], b[1]);

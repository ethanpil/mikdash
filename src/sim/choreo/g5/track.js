// G5 role timelines. A Track is one figure's day inside one offering: an ordered list of segments (HOLD at a spot,
// WALK along an authored route, CARRIED on another figure's walk), built once per date by the plan and evaluated as a
// pure function of the sim time t. Times are minutes on the civil clock (no midnight wrap: the stream runs by day).
import { SitePath } from '../../lib/path.js';

export const HOLD = 0, WALK = 1, CARRIED = 2;
const AM = 0.48;

/** phase specs: undefined = the people system animates the loop; WALKPH = stride-matched; ONE = one-shot over the
 * segment (or over [a, b] minutes from its start); CYC = repeat every p minutes; FIX = held at v */
export const WALKPH = { k: 'walk' };
export const one = (a = 0, b = null) => ({ k: 'one', a, b });
export const cyc = (p, o = 0) => ({ k: 'cyc', p, o });
export const fix = (v) => ({ k: 'fix', v });

/**
 * The animal's states by kind (people-4): slain and unflayed in the arms (carry_lamb) — no ram (too heavy to carry so:
 * the live figure is carried as before ⚙); hung by the hock, being flayed, dressed (origin at the hook); its hide; its
 * fats in a silver basin (a goat has no alyah — Vayikra 3:9, 3:14–15). A flayed ewe or she-goat is drawn as the lamb's
 * or the goat's.
 */
export const CARCASS = {
  lamb: { slain: 'lamb_slain', hung: 'lamb_hung', flaying: 'carcass_flaying', dressed: 'carcass_hung', hide: 'hide', eimurim: 'eimurim' },
  ewe: { slain: 'ewe_slain', hung: 'ewe_hung', flaying: 'carcass_flaying_ewe', dressed: 'carcass_hung', hide: 'hide', eimurim: 'eimurim' },
  ram: { slain: null, hung: 'ram_hung', flaying: 'carcass_flaying_ram', dressed: 'carcass_hung_ram', hide: 'hide', eimurim: 'eimurim' },
  goat: { slain: 'goat_slain', hung: 'goat_hung', flaying: 'carcass_flaying_goat', dressed: 'carcass_hung_goat', hide: 'hide_goat', eimurim: 'eimurim_goat' },
  she_goat: { slain: 'she_goat_slain', hung: 'she_goat_hung', flaying: 'carcass_flaying_she_goat', dressed: 'carcass_hung_goat', hide: 'hide_goat', eimurim: 'eimurim_goat' },
};
export const carcassOf = (sp) => CARCASS[sp] || CARCASS.lamb;
/** people's 'wave' / 'wave_under' cycle (rate 0.4/s) in minutes: the tenufah pair share one phase */
export const WAVE_P = 1 / (0.4 * 60);

export class Track {
  /** role: 'O' | 'A' | 'K1' …; pool: the actor pool name; extra fields are kept (e.g. seed, label) */
  constructor(inst, role, pool, extra = {}) {
    this.inst = inst; this.role = role; this.pool = pool;
    this.segs = [];
    this.t = NaN; this.p = null; this.h = 0;
    this.slot = -1;
    Object.assign(this, extra);
  }
  get t0() { return this.segs.length ? this.segs[0].t0 : this.t; }
  get t1() { return this.segs.length ? this.segs[this.segs.length - 1].t1 : this.t; }

  /** appear at time t at point p (site amot) facing h */
  at(t, p, h = 0) { this.t = t; this.p = p.slice(); this.h = h; return this; }

  /** stay where it is until t1 (nothing when t1 ≤ now) */
  hold(t1, o = {}) {
    if (!(t1 > this.t + 1e-6)) return this;
    const h = o.h ?? this.h;
    const p = o.p || this.p;
    this.segs.push({ kind: HOLD, t0: this.t, t1, X: p[0], Y: p[1], Z: p[2], near: o.near ?? isNear(p[2]), h, pose: o.pose || 'stand', ph: o.ph,
      prop: o.prop ?? null, hand: o.hand || 'right', prop2: o.prop2 ?? null, lead: o.lead ?? null });
    this.t = t1; this.h = h;
    if (o.p) this.p = o.p.slice();
    return this;
  }
  holdFor(d, o) { return this.hold(this.t + d, o); }

  /** walk to `to` (point or node id) along the authored graph at `speed` m/s; o.route = a prebuilt route */
  walk(G, to, o = {}) {
    const r = o.route || G.route(this.p, to, o);
    return this.walkRoute(r, o);
  }
  walkRoute(r, o = {}) {
    const len = r.path.length;
    const speed = o.speed || 1.25;
    const dur = Math.max(o.minDur || 0, len / speed / 60);
    if (len < 0.02) {
      if (o.minDur) this.hold(this.t + o.minDur, { pose: o.pose === 'walk' ? 'stand' : o.pose, ph: o.ph || undefined, prop: o.prop, hand: o.hand, prop2: o.prop2, lead: o.lead });
      return this;
    }
    const seg = { kind: WALK, t0: this.t, t1: this.t + dur, path: r.path, nearPts: r.near, d0: 0, d1: len, pose: o.pose || 'walk', ph: o.ph !== undefined ? (o.ph || undefined) : WALKPH,
      prop: o.prop ?? null, hand: o.hand || 'right', prop2: o.prop2 ?? null, lag: o.lag || 0, side: o.side || 0, lead: o.lead ?? null, back: !!o.back };
    this.segs.push(seg);
    this.t = seg.t1;
    // a sideways offset fades out toward both ends of the walk (sideAt), so the walker arrives exactly at `to`
    const end = r.path.sample(Math.max(0, len - seg.lag), {});
    this.p = [end.X, end.Y, Number.isFinite(end.Z) ? end.Z : this.p[2]];
    this.h = o.back ? (end.heading + 180) % 360 : end.heading;
    this.lastWalk = seg;
    return this;
  }
  /** a short straight step (a turn into place, a few amot) */
  step(to, o = {}) {
    const path = new SitePath([this.p, to]);
    return this.walkRoute({ path, near: Uint8Array.from([isNear(this.p[2]) ? 1 : 0, isNear(to[2]) ? 1 : 0]), length: path.length }, { speed: 0.9, ...o });
  }
  /** follow a leader's walk segment `lag` metres behind (an animal on its rope): same path, same minutes */
  follow(seg, lag, o = {}) {
    const s = { ...seg, lag: (seg.lag || 0) + lag, pose: o.pose || 'walk_led', prop: null, prop2: null, lead: o.lead ?? null, side: o.side ?? 0 };
    this.t = Math.max(this.t, seg.t0);
    s.t0 = this.t;
    this.segs.push(s);
    this.t = s.t1;
    const end = seg.path.sample(Math.max(0, seg.d1 - s.lag), {});
    this.p = [end.X, end.Y, Number.isFinite(end.Z) ? end.Z : this.p[2]];
    this.h = end.heading;
    return this;
  }
  /** carried on a carrier's walk (a slain lamb over his shoulders): up metres above his floor, yaw offset */
  carried(seg, o = {}) {
    this.segs.push({ kind: CARRIED, t0: seg.t0, t1: seg.t1, ref: seg, up: o.up ?? 1.18, side: o.side ?? 0, fwd: o.fwd ?? 0, hOff: o.hOff ?? 90, pose: o.pose || 'bound', ph: o.ph });
    this.t = seg.t1;
    return this;
  }
  /** shift every time by dt (the plan builds an offering at a nominal start, then slides it into its lane) */
  shift(dt) {
    for (const s of this.segs) { s.t0 += dt; s.t1 += dt; }
    this.t += dt;
    return this;
  }
}

export const isNear = (z) => !(Math.abs(z - 16) < 1e-3 || Math.abs(z - 13.5) < 1e-3 || Math.abs(z - 6) < 1e-3 || Math.abs(z - 22) < 1e-3);

/**
 * The limb carriers round their table: four in the front row by the table, the rest in a row behind them, and the way
 * out behind both (north, to the corridor — g5/geo.js route). Carrier k goes k-th (the limbs' order); so that no one
 * walks through a man still standing, the first to go stand in the back row and come last. Returns the index of his
 * place (0–3 the front row, 4… the back row) and of his arrival.
 */
export function tableOrder(n, k) {
  const nb = Math.max(0, n - 4);
  return k < nb ? { spot: 4 + k, arrive: n - nb + k } : { spot: k - nb, arrive: k - nb };
}

/** a walk's sideways offset (metres) at d metres along a path of length len: full in the middle, eased to 0 over the
 * first and last 1.2 m so the walk starts and ends on its points */
function sideAt(side, d, len) {
  const e = Math.min(1, Math.max(0, d / 1.2), Math.max(0, (len - d) / 1.2));
  return side * e * e * (3 - 2 * e);
}

/** index of the segment holding t (segs sorted, contiguous or not); -1 when none */
export function segAt(segs, t) {
  let lo = 0, hi = segs.length - 1, k = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (segs[m].t0 <= t) { k = m; lo = m + 1; } else hi = m - 1; }
  if (k < 0 || t >= segs[k].t1) return -1;
  return k;
}

/**
 * Where a segment puts its figure at t: fills out { X, Y, Z, near, h, d } (d = metres walked, for the stride phase).
 */
export function sampleSeg(s, t, out, tmp) {
  if (s.kind === HOLD) {
    out.X = s.X; out.Y = s.Y; out.Z = s.Z; out.near = s.near; out.h = s.h; out.d = 0;
    return out;
  }
  if (s.kind === WALK) {
    const k = s.t1 > s.t0 ? Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0))) : 1;
    const d = s.d0 + k * (s.d1 - s.d0) - s.lag;
    const sd = s.side ? sideAt(s.side, Math.max(0, d), s.path.length) : 0;
    const q = sd ? s.path.offset(Math.max(0, d), sd, 0, tmp) : s.path.sample(Math.max(0, d), tmp);
    out.X = q.X; out.Y = q.Y; out.Z = Number.isFinite(q.Z) ? q.Z : 16;
    out.near = !!(s.nearPts && (s.nearPts[q.seg] || s.nearPts[q.seg + 1]));
    out.h = s.back ? (q.heading + 180) % 360 : q.heading;
    out.d = Math.max(0, d);
    return out;
  }
  // CARRIED: on the carrier's walk at the same moment
  const c = s.ref;
  sampleSeg(c, t, out, tmp);
  const hr = (out.h * Math.PI) / 180;
  if (s.fwd) { out.X += (Math.sin(hr) * s.fwd) / AM; out.Y += (Math.cos(hr) * s.fwd) / AM; }
  if (s.side) { out.X += (Math.cos(hr) * s.side) / AM; out.Y -= (Math.sin(hr) * s.side) / AM; }
  out.carrierNear = out.near;
  out.near = false;
  out.up = s.up / AM;
  out.h = (out.h + s.hOff + 360) % 360;
  return out;
}

/** the phase a segment asks for at t (undefined = let people animate it) */
export function phaseOf(s, t, walkPhase) {
  const ph = s.ph;
  if (!ph) return undefined;
  switch (ph.k) {
    case 'walk': return walkPhase;
    case 'one': {
      const a = s.t0 + (ph.a || 0), b = ph.b == null ? s.t1 : s.t0 + ph.b;
      return Math.min(1, Math.max(0, (t - a) / Math.max(1e-6, b - a)));
    }
    case 'cyc': { const x = (t - s.t0 + (ph.o || 0)) / ph.p; return x - Math.floor(x); }
    case 'fix': return ph.v;
    default: return undefined;
  }
}

// Group G2 (dawn altar and both temidim) — shared staging toolkit for terumat-hadeshen, barkai, tamid-morning,
// tamid-afternoon and gazit-shema. Not a choreo module itself (the runtime loads only src/sim/choreo/*.js).
//
// A Script is one figure's day as a list of steps laid end to end from an absolute start minute: walks along authored
// waypoints (straight legs, deterministic from boot — no nav), and actions in place (a pose, a held or progressing
// phase, a heading or a point to face, props in each hand). Steps are timed by length and speed or stretched to end at
// an absolute minute (`until`), so a figure's whole morning is a pure function of the clock: evaluate(t) → where he
// stands, which way he faces, what he does and holds. Plans are rebuilt once per date (sim.generation).
//
// FreeProps are vessels, limbs, logs and carcass states standing free in the world (people.spawnProp), each with a
// visibility window and keyframed positions. The altar fires this group drives are shared wants (sim.fireWant).
import { SitePath } from '../../lib/path.js';
import { clamp, since, within, wrap, rand, smooth } from '../../lib/core.js';
import { m2w, AMAH } from '../../../core/units.js';

export const SPEED = { walk: 1.2, slow: 0.9, carry: 1.0, ramp: 0.85, run: 3.0, lamb: 0.8 };   // m/s ⚙
const DEG = 180 / Math.PI;
const TURN = 0.05;      // minutes over which a figure turns to the heading of its next action ⚙
const LOOK = 0.35;      // m ahead/behind on the path for a walking heading (rounds the corners) ⚙

export const headingOf = (X0, Y0, X1, Y1) => { const h = Math.atan2(X1 - X0, Y1 - Y0) * DEG; return h < 0 ? h + 360 : h; };
const angDiff = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;
export const lerpH = (a, b, k) => { const h = a + angDiff(a, b) * k; return ((h % 360) + 360) % 360; };

// ------------------------------------------------------------------------------------------------ scripts

/**
 * One figure's timeline. Build with Script.from(t0, [X, Y, Z], heading) then chain walk / act / until / hold; every
 * step starts where the previous one ended. Times are absolute sim minutes; the script is evaluated with
 * since(t, t0), so it may run across midnight.
 */
export class Script {
  static from(t0, pos, heading = 0, name = '') {
    const s = new Script();
    s.t0 = t0; s.name = name;
    s.cur = [pos[0], pos[1], pos[2] ?? 16];
    s.h = heading;
    s.u = 0;            // minutes since t0 at the end of the last step
    s.dist = 0;         // metres walked so far (keeps the stride phase continuous across walks)
    s.steps = [];
    s.warn = [];
    s.exactZ = false;   // exact(): place on the authored Z (no floor query) unless a step says otherwise
    return s;
  }
  /**
   * Steps from here on stand at their authored Z by default (pass zExact: false on a leg over stairs). For flat
   * pavement, the ramp (kevZ) and the altar top: no physics query per frame, and no snapping onto a higher collider
   * passed overhead (a table top, the nanasin's cedar blocks, a roof) as placeNear can.
   */
  exact(b = true) { this.exactZ = !!b; return this; }
  get tEnd() { return this.t0 + this.u; }
  /** absolute time of the end of the script so far */
  now() { return this.t0 + this.u; }
  _push(st) {
    st.u0 = this.u; st.u1 = this.u + Math.max(0, st.d);
    st.hIn = this.h;
    this.u = st.u1;
    this.steps.push(st);
    return this;
  }
  /**
   * Walk from the current position through points [[X,Y,Z], ...]. opts: speed (m/s) | until (absolute minute to
   * arrive), pose ('walk' | 'run' | 'carry_walk' | 'carry_shoulder_walk' | 'carry_limbs_walk' | 'lead_walk' |
   * 'torch_walk'), props [right, left], back (walks facing backwards — not used for kohanim).
   */
  walk(points, opts = {}) {
    const pts = [this.cur, ...points.map((p) => [p[0], p[1], p[2] ?? this.cur[2]])];
    const path = new SitePath(pts);
    const L = path.length;
    let d;
    if (Number.isFinite(opts.until)) {
      d = opts.until - this.now();
      if (d < 0.02) { this.warn.push(`walk ${this.name}@${pts[1]} late ${d.toFixed(2)}`); d = Math.max(0.02, L / (SPEED.run * 60)); }
    } else d = L / ((opts.speed || SPEED.walk) * 60);
    const st = { kind: 'walk', d, path, L, pose: opts.pose || 'walk', props: opts.props || null, dist0: this.dist, zx: !!(opts.zExact ?? this.exactZ) };
    this.dist += L;
    const last = pts[pts.length - 1], prev = pts[pts.length - 2];
    this._push(st);
    this.cur = [last[0], last[1], last[2]];
    if (L > 1e-6) this.h = headingOf(prev[0], prev[1], last[0], last[1]);
    st.hOut = this.h;
    return this;
  }
  /** walk so as to arrive at an absolute minute */
  walkBy(tArrive, points, opts = {}) { return this.walk(points, { ...opts, until: tArrive }); }
  /**
   * Wait where he is (opts.wait: the act's options) until it is time to walk `points` at an ordinary pace
   * (opts.speed), arriving at tArrive — instead of stretching the whole walk into a crawl.
   */
  walkAt(tArrive, points, opts = {}) {
    const go = tArrive - walkMin(this.cur, points, opts.speed || SPEED.walk);
    if (go > this.now() + 0.01) this.until(go, opts.wait || { pose: 'stand', heading: this.h });
    return this.walk(points, { ...opts, until: tArrive });
  }
  /**
   * An action in place for `min` minutes. opts: pose, phase (number held | [a, b] progress over the step | null = the
   * people system animates it), heading | face [X, Y], props [right, left], sway (deg of idle turning).
   */
  act(min, opts = {}) {
    let h = this.h;
    if (opts.face) h = headingOf(this.cur[0], this.cur[1], opts.face[0], opts.face[1]);
    else if (Number.isFinite(opts.heading)) h = opts.heading;
    const st = { kind: 'act', d: min, pos: this.cur.slice(), pose: opts.pose || 'stand', phase: opts.phase ?? null, h, props: opts.props || null,
      sway: opts.sway ?? 0, seed: opts.seed ?? 0, turn: opts.turn ?? TURN, zx: !!(opts.zExact ?? this.exactZ) };
    this._push(st);
    this.h = h;
    st.hOut = h;
    return this;
  }
  /** an action held until an absolute minute (absorbs the slack in a timeline) */
  until(tAbs, opts = {}) {
    const d = tAbs - this.now();
    if (d < -1e-6) this.warn.push(`until ${this.name} late ${d.toFixed(2)} (${opts.pose || 'stand'})`);
    return this.act(Math.max(0, d), opts);
  }
  /** out of sight (inside a chamber, away) until an absolute minute, then on again from `pos` */
  hide(tAbs, pos, heading) {
    const d = tAbs - this.now();
    if (d < -1e-6) this.warn.push(`hide ${this.name} late ${d.toFixed(2)}`);
    const st = { kind: 'hide', d: Math.max(0, d), pos: this.cur.slice() };
    this._push(st);
    if (pos) this.cur = [pos[0], pos[1], pos[2] ?? this.cur[2]];
    if (Number.isFinite(heading)) this.h = heading;
    st.hOut = this.h;
    return this;
  }
  /** shift the position without walking (a step up onto a ledge; kneeling forward) over `min` minutes */
  shift(to, min, opts = {}) {
    const st = { kind: 'shift', d: min, a: this.cur.slice(), b: [to[0], to[1], to[2] ?? this.cur[2]], pose: opts.pose || 'walk', phase: opts.phase ?? null,
      props: opts.props || null, h: Number.isFinite(opts.heading) ? opts.heading : this.h, dist0: this.dist, zx: !!(opts.zExact ?? this.exactZ) };
    const L = Math.hypot(st.b[0] - st.a[0], st.b[1] - st.a[1]) * AMAH;
    st.L = L;
    this.dist += L;
    this._push(st);
    this.cur = st.b.slice();
    this.h = st.h;
    st.hOut = st.h;
    return this;
  }
}

const _q = {}, _q2 = {};
/**
 * The figure at time t → out { vis, X, Y, Z, h, pose, ph (number | undefined), pr, pl, k (step index) }.
 * phaseFor(pose, metres) gives the stride-matched phase for walking poses.
 */
export function evalScript(S, t, out, phaseFor) {
  out.vis = false;
  if (!S || !S.steps.length) return out;
  let u = since(t, S.t0);
  const total = S.u;
  if (u > total + 1e-9) return out;              // gone (or a time before the start)
  const steps = S.steps;
  let lo = 0, hi = steps.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (steps[m].u0 <= u) lo = m; else hi = m - 1; }
  const st = steps[lo];
  if (st.kind === 'hide') return out;
  const k = st.d > 1e-9 ? clamp((u - st.u0) / st.d) : 1;
  out.vis = true; out.k = lo; out.kk = k; out.zx = !!st.zx;
  out.pr = st.props ? st.props[0] ?? null : null;
  out.pl = st.props ? st.props[1] ?? null : null;
  if (st.kind === 'walk') {
    const d = k * st.L;
    const p = st.path.sample(d, _q);
    out.X = p.X; out.Y = p.Y; out.Z = p.Z;
    if (st.L > 2 * LOOK) {
      const a = st.path.sample(Math.max(0, d - LOOK), _q2);
      const ax = a.X, ay = a.Y;
      const b = st.path.sample(Math.min(st.L, d + LOOK), _q2);
      out.h = headingOf(ax, ay, b.X, b.Y);
    } else out.h = st.hOut;
    // turn from the previous heading over the first metre
    if (d < 1) out.h = lerpH(st.hIn, out.h, smooth(0, 1, d));
    out.pose = st.pose;
    out.ph = phaseFor ? phaseFor(st.pose, st.dist0 + d) : undefined;
    return out;
  }
  if (st.kind === 'shift') {
    out.X = st.a[0] + (st.b[0] - st.a[0]) * k; out.Y = st.a[1] + (st.b[1] - st.a[1]) * k; out.Z = st.a[2] + (st.b[2] - st.a[2]) * k;
    out.h = st.h;
    out.pose = st.pose;
    out.ph = st.phase != null ? phaseOf(st.phase, k, u - st.u0) : (phaseFor && /walk|run/.test(st.pose) ? phaseFor(st.pose, st.dist0 + k * st.L) : undefined);
    return out;
  }
  // act
  out.X = st.pos[0]; out.Y = st.pos[1]; out.Z = st.pos[2];
  let h = st.h;
  if (st.sway) h += st.sway * swayAt(st.seed, t);
  const el = u - st.u0;
  out.h = st.turn > 0 && el < st.turn ? lerpH(st.hIn, h, smooth(0, st.turn, el)) : ((h % 360) + 360) % 360;
  out.pose = st.pose;
  out.ph = phaseOf(st.phase, k, el);
  return out;
}

/** phase spec: null → undefined (animated by people); number → held; [a, b] → a..b over the step; { cycle: s, off } → loop */
function phaseOf(spec, k, elMin) {
  if (spec == null) return undefined;
  if (typeof spec === 'number') return spec;
  if (Array.isArray(spec)) return spec[0] + (spec[1] - spec[0]) * k;
  if (spec.cycle) { const p = (elMin * 60) / spec.cycle + (spec.off || 0); return p - Math.floor(p); }
  return undefined;
}

/** slow idle turning in [-1, 1] (two seeded sines; t in minutes) */
function swayAt(seed, t) {
  const a = rand(seed, 'sa') * 6.283, b = rand(seed, 'sb') * 6.283, p = 2.5 + 2 * rand(seed, 'sp');
  return 0.65 * Math.sin((t / p) * 6.283 + a) + 0.35 * Math.sin((t / (p * 1.7)) * 6.283 + b);
}

// ------------------------------------------------------------------------------------------------ applying to figures

/** the stride-matched phase for a slot's actor (feet planted); falls back to a nominal stride */
export function phaseFn(ctx, slot) {
  const f = ctx.people?.util?.phaseFor;
  return (pose, metres) => {
    if (f && slot.actor) return f(slot.actor, pose, Math.max(0, metres));
    const p = Math.max(0, metres) / (pose === 'run' ? 2.4 : 1.45);
    return p - Math.floor(p);
  };
}

/** right / left props through Actor.setProps (change-cached on the slot) */
export function setProps(slot, r, l) {
  r = r || null; l = l || null;
  if (slot._g2r === r && slot._g2l === l && slot.actor) return slot;
  slot._g2r = r; slot._g2l = l;
  const a = slot.ensure();
  if (a.setProps) a.setProps(r, l); else a.setProp(r, 'right');
  slot._prop = r; slot._hand = 'right';
  return slot;
}

/** pose a pooled human from a script output (placeNear keeps stairs, ramps and the altar top on their floors) */
export function applyFigure(slot, st) {
  if (!st.vis) return false;
  if (st.zx) slot.place(st.X, st.Y, st.Z); else slot.placeNear(st.X, st.Y, st.Z);
  slot.heading(st.h).pose(st.pose, st.ph);
  setProps(slot, st.pr, st.pl);
  slot.show();
  return true;
}

/** a script per slot: evaluate and apply; returns how many are shown */
export function runScripts(ctx, pool, scripts, t, out, fns) {
  let n = 0;
  for (let i = 0; i < scripts.length; i++) {
    const S = scripts[i];
    if (!S) continue;
    const slot = pool.slot(i);
    if (!fns[i]) fns[i] = phaseFn(ctx, slot);
    evalScript(S, t, out, fns[i]);
    if (applyFigure(slot, out)) n++;
  }
  return n;
}

/** animal lead rope (cached): lamb.setLead(human actor) */
export function setLead(animalSlot, humanSlot) {
  const h = humanSlot ? humanSlot.ensure() : null;
  if (animalSlot._g2lead === h && animalSlot.actor) return;
  animalSlot._g2lead = h;
  animalSlot.ensure().setLead?.(h, 'right');
}

// ------------------------------------------------------------------------------------------------ free props

/**
 * Free-standing props (people.spawnProp): spawned hidden at init. Each item: { name, show: [t0, t1] (absolute minutes,
 * cyclic), keys: [{ t, X, Y, Z, h, lerp? }] (position from the last key at or before t; `lerp` on a key eases from the
 * previous one) }. update(t) shows and places them; hideAll() on release.
 */
export class FreeProps {
  constructor(ctx) { this.ctx = ctx; this.items = []; this.byName = new Map(); }
  /** reserve a prop actor of this name (reused across plans) */
  get(name, i) {
    let list = this.byName.get(name);
    if (!list) { list = []; this.byName.set(name, list); }
    while (list.length <= i) {
      let a = null;
      try { a = this.ctx.people?.spawnProp?.(name, { seed: 0x6732 + list.length }) || null; } catch { a = null; }
      a?.setVisible(false);
      list.push({ a, vis: false, X: NaN, Y: NaN, Z: NaN, h: NaN });
    }
    return list[i];
  }
  /** replace the plan: items [{ name, show, keys }] */
  setPlan(items) {
    const count = new Map();
    this.items = items.map((it) => {
      const i = count.get(it.name) || 0;
      count.set(it.name, i + 1);
      return { ...it, slot: this.get(it.name, i) };
    });
    for (const [name, list] of this.byName) {
      for (let i = count.get(name) || 0; i < list.length; i++) this._vis(list[i], false);
    }
  }
  update(t) {
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i], s = it.slot;
      if (!s.a) continue;
      const on = it.show ? within(t, it.show[0], it.show[1]) : true;
      if (on) {
        const k = keyAt(it.keys, t, it.show ? it.show[0] : it.keys[0].t);
        if (k) this._place(s, k);
      }
      this._vis(s, on);
    }
  }
  hideAll() { for (const list of this.byName.values()) for (const s of list) this._vis(s, false); }
  _vis(s, on) { if (s.a && s.vis !== on) { s.vis = on; s.a.setVisible(on); } }
  _place(s, k) {
    // NaN-safe change cache (a fresh prop has no position yet)
    if (!(Math.abs(s.X - k.X) <= 1e-4 && Math.abs(s.Y - k.Y) <= 1e-4 && Math.abs(s.Z - k.Z) <= 1e-4)) {
      s.X = k.X; s.Y = k.Y; s.Z = k.Z;
      s.a.setSite(k.X, k.Y, k.Z);
    }
    if (!(Math.abs(s.h - k.h) <= 1e-4)) { s.h = k.h; s.a.setHeading(k.h); }
  }
  get count() { return this.items.length; }
  get shown() { let n = 0; for (const it of this.items) if (it.slot.vis) n++; return n; }
}

const _k = { X: 0, Y: 0, Z: 0, h: 0 };
/** keyframes [{ t, X, Y, Z, h, lerp, dur }] → the pose at t (keys ordered by time since `base`) */
function keyAt(keys, t, base) {
  if (!keys?.length) return null;
  const u = since(t, base);
  let i = 0;
  for (let j = 0; j < keys.length; j++) if (since(keys[j].t, base) <= u) i = j;
  const k = keys[i];
  if (k.lerp && i > 0 && k.dur > 0) {
    const p = keys[i - 1];
    const f = smooth(0, k.dur, u - since(k.t, base));
    _k.X = p.X + (k.X - p.X) * f; _k.Y = p.Y + (k.Y - p.Y) * f; _k.Z = p.Z + (k.Z - p.Z) * f; _k.h = lerpH(p.h, k.h, f);
    return _k;
  }
  // before the first key's time inside the window: the first key
  return k;
}

// ------------------------------------------------------------------------------------------------ movables

/** a movable's userData call, change-cached on the holder */
export function movableCall(ctx, holder, id, fn, v) {
  const node = ctx.movables?.get?.(id);
  if (!node) return;
  const key = `${id}:${fn}`;
  if (holder[key] === v) return;
  holder[key] = v;
  if (fn === 'visible') node.visible = !!v;
  else node.userData?.[fn]?.(v);
}

// ------------------------------------------------------------------------------------------------ misc

/** the player within `range` metres (plan distance) of a site point */
export function playerNear(ctx, p, range) {
  const pp = ctx.player?.position;
  if (!pp || !p) return false;
  const w = m2w(p[0], p[1], p[2] ?? 16);
  return Math.hypot(pp.x - w.x, pp.z - w.z) < range;
}

/** the window [t0, t1] of a schedule event by id (null when it does not run today) */
export function win(sim, id) {
  const e = sim.event(id);
  return e && Number.isFinite(e.t0) ? [e.t0, e.t1] : null;
}

/** minutes a walk takes over points from `from` */
export function walkMin(from, points, speed = SPEED.walk) {
  let L = 0, p = from;
  for (const q of points) { L += Math.hypot(q[0] - p[0], q[1] - p[1]) * AMAH; p = q; }
  return L / (speed * 60);
}

/**
 * The pool seed whose slot i is slot (k + i) of a pool seeded `base` (sim/lib/actors.js: a slot's face is
 * (seed × 7919 + i × 104729) mod 2³²; 7919 is odd, so it has an inverse mod 2³²). Lets a small pool continue men from
 * the middle of another module's pool — e.g. lotteries' Gazit men 11–18, who won the fourth lottery.
 */
export function seedFrom(base, k) {
  const M = 1n << 32n;
  let [r0, r1, s0, s1] = [M, 7919n, 0n, 1n];
  while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; }
  const inv = ((s0 % M) + M) % M;
  const target = (BigInt(base) * 7919n + BigInt(k) * 104729n) % M;
  return Number((target * inv) % M);
}

/** seeded jitter in [-a, a] */
export const jit = (seed, a, k0, k1) => (rand(seed, k0, k1) * 2 - 1) * a;

export { since, within, wrap, clamp, smooth };

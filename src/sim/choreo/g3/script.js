// Group G3 staging toolkit: one figure's timeline (Script), its evaluation at a clock time, and the free props.
//
// A Script is a list of steps laid end to end from an absolute minute: walks along authored waypoints (straight legs,
// deterministic from boot), actions in place (a pose with a held / progressing / cycling phase, a heading or a point to
// face, the props in each hand), shifts (a step up onto a ledge), and hidden stretches (inside a chamber). Props carry
// over from step to step until changed. evalScript(S, t) is a pure function of the clock, so a jump re-poses at once;
// walking phases come from the metres walked (feet planted). Heights come from the places' analytic floors.
import { SitePath } from '../../lib/path.js';
import { clamp, since, rand, smooth } from '../../lib/core.js';

const DEG = 180 / Math.PI;
const TURN = 0.05;      // minutes over which a figure turns to the heading of its next action ⚙
const LOOK = 0.35;      // m ahead/behind on the path for a walking heading (rounds the corners)

export const headingOf = (X0, Y0, X1, Y1) => { const h = Math.atan2(X1 - X0, Y1 - Y0) * DEG; return h < 0 ? h + 360 : h; };
const angDiff = (a, b) => ((((b - a) % 360) + 540) % 360) - 180;
export const lerpH = (a, b, k) => { const h = a + angDiff(a, b) * k; return ((h % 360) + 360) % 360; };

export class Script {
  /** a timeline starting at absolute minute t0 at pos [X, Y, Z] facing heading; props [right, left] */
  static from(t0, pos, heading = 0, name = '', props = null) {
    const s = new Script();
    s.t0 = t0; s.name = name;
    s.cur = [pos[0], pos[1], pos[2] ?? 16];
    s.h = heading;
    s.u = 0;
    s.dist = 0;
    s.props = props || [null, null];
    s.steps = [];
    s.warn = [];
    return s;
  }
  now() { return this.t0 + this.u; }
  _push(st) {
    st.u0 = this.u; st.u1 = this.u + Math.max(0, st.d);
    st.hIn = this.h;
    if (st.props === undefined) st.props = this.props;
    else if (st.props) this.props = st.props;
    else { st.props = [null, null]; this.props = st.props; }
    this.u = st.u1;
    this.steps.push(st);
    return this;
  }
  /**
   * Walk through points [[X,Y,Z], ...]. opts: speed (m/s) | until (absolute minute of arrival), pose ('walk' | 'run' |
   * 'carry_walk' | …), props ([right, left]; omitted = as before).
   */
  walk(points, opts = {}) {
    const pts = [this.cur, ...points.map((p) => [p[0], p[1], p[2] ?? this.cur[2]])];
    const path = new SitePath(pts);
    const L = path.length;
    let d;
    if (Number.isFinite(opts.until)) {
      d = opts.until - this.now();
      if (d < 0.01) { this.warn.push(`walk ${this.name} late ${d.toFixed(2)}`); d = Math.max(0.01, L / (3.2 * 60)); }
    } else d = L / ((opts.speed || 1.15) * 60);
    const st = { kind: 'walk', d, path, L, pose: opts.pose || 'walk', props: opts.props, dist0: this.dist };
    this.dist += L;
    const last = pts[pts.length - 1];
    this._push(st);
    this.cur = [last[0], last[1], last[2]];
    for (let i = pts.length - 1; i > 0; i--) {
      const a = pts[i - 1], b = pts[i];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-4) { this.h = headingOf(a[0], a[1], b[0], b[1]); break; }
    }
    st.hOut = this.h;
    return this;
  }
  walkBy(tArrive, points, opts = {}) { return this.walk(points, { ...opts, until: tArrive }); }
  /** minutes the walk through points would take at speed (m/s) */
  walkMin(points, speed = 1.15) {
    const pts = [this.cur, ...points];
    let L = 0;
    for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    return (L * 0.48) / speed / 60;
  }
  /**
   * An action in place for `min` minutes. opts: pose, phase (number held | [a, b] over the step | { cycle: s, off }
   * | null = people's own), heading | face [X, Y], props, sway (deg of idle turning), seed.
   */
  act(min, opts = {}) {
    let h = this.h;
    if (opts.face) h = headingOf(this.cur[0], this.cur[1], opts.face[0], opts.face[1]);
    else if (Number.isFinite(opts.heading)) h = opts.heading;
    const st = { kind: 'act', d: min, pos: this.cur.slice(), pose: opts.pose || 'stand', phase: opts.phase ?? null, h, props: opts.props,
      sway: opts.sway ?? 0, seed: opts.seed ?? 0, turn: opts.turn ?? TURN };
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
  /** out of sight (inside a chamber) until an absolute minute, then on again from pos */
  hide(tAbs, pos, heading) {
    const d = tAbs - this.now();
    if (d < -1e-6) this.warn.push(`hide ${this.name} late ${d.toFixed(2)}`);
    const st = { kind: 'hide', d: Math.max(0, d), pos: this.cur.slice(), props: undefined };
    this._push(st);
    if (pos) this.cur = [pos[0], pos[1], pos[2] ?? this.cur[2]];
    if (Number.isFinite(heading)) this.h = heading;
    st.hOut = this.h;
    return this;
  }
  /** move in place without striding (a step up onto a ledge or a stair) over `min` minutes */
  shift(to, min, opts = {}) {
    const st = { kind: 'shift', d: min, a: this.cur.slice(), b: [to[0], to[1], to[2] ?? this.cur[2]], pose: opts.pose || 'stand', phase: opts.phase ?? null,
      props: opts.props, h: Number.isFinite(opts.heading) ? opts.heading : this.h };
    this._push(st);
    this.cur = st.b.slice();
    this.h = st.h;
    st.hOut = st.h;
    return this;
  }
}

const _q = {}, _q2 = {};
/**
 * The figure at time t → out { vis, X, Y, Z, h, pose, ph, pr, pl }. walkPhase(pose, metres) gives the stride-matched
 * phase for walking poses; floorAt(X, Y, z) the analytic floor.
 */
export function evalScript(S, t, out, walkPhase, floorAt) {
  out.vis = false;
  if (!S || !S.steps.length) return out;
  const u = since(t, S.t0);
  if (u > S.u + 1e-9) return out;
  const steps = S.steps;
  let lo = 0, hi = steps.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (steps[m].u0 <= u) lo = m; else hi = m - 1; }
  const st = steps[lo];
  if (st.kind === 'hide') return out;
  const k = st.d > 1e-9 ? clamp((u - st.u0) / st.d) : 1;
  out.vis = true; out.k = lo;
  out.pr = st.props[0] ?? null;
  out.pl = st.props[1] ?? null;
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
    if (d < 1) out.h = lerpH(st.hIn, out.h, smooth(0, 1, d));
    out.pose = st.pose;
    out.ph = walkPhase ? walkPhase(st.pose, st.dist0 + d) : undefined;
  } else if (st.kind === 'shift') {
    out.X = st.a[0] + (st.b[0] - st.a[0]) * k; out.Y = st.a[1] + (st.b[1] - st.a[1]) * k; out.Z = st.a[2] + (st.b[2] - st.a[2]) * smooth(0, 1, k);
    out.h = lerpH(st.hIn, st.h, smooth(0, 1, k));
    out.pose = st.pose;
    out.ph = phaseOf(st.phase, k, (u - st.u0));
    if (floorAt) { out.Z = floorAt(out.X, out.Y, out.Z); }
    return out;
  } else {
    out.X = st.pos[0]; out.Y = st.pos[1]; out.Z = st.pos[2];
    let h = st.h;
    if (st.sway) h += st.sway * swayAt(st.seed, t);
    const el = u - st.u0;
    out.h = st.turn > 0 && el < st.turn ? lerpH(st.hIn, h, smooth(0, st.turn, el)) : ((h % 360) + 360) % 360;
    out.pose = st.pose;
    out.ph = phaseOf(st.phase, k, el);
  }
  if (floorAt) out.Z = floorAt(out.X, out.Y, out.Z);
  return out;
}

/** phase spec: null → undefined (people animates it); number → held; [a, b] → a..b over the step; { cycle: s, off } → loop */
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

/** the stride-matched phase function for a slot's actor */
export function walkPhaseFn(ctx, slot) {
  const f = ctx.people?.util?.phaseFor;
  return (pose, metres) => {
    if (!/walk|run/.test(pose)) return undefined;
    if (f && slot.actor) return f(slot.actor, pose, Math.max(0, metres));
    const p = Math.max(0, metres) / (pose === 'run' ? 2.2 : 1.45);
    return p - Math.floor(p);
  };
}

/** both hands' props, change-cached on the slot (Slot.prop() handles one hand only) */
export function setProps(slot, r, l) {
  if (slot._g3r === r && slot._g3l === l) return;
  slot._g3r = r; slot._g3l = l;
  const a = slot.ensure();
  if (a.setProps) a.setProps(r, l); else a.setProp?.(r || l, r ? 'right' : 'left');
}

/**
 * Run a pool's scripts at t: slot i follows the first visible script of lists[i] (a figure may have several
 * non-overlapping timelines in a day). fns caches each slot's walk-phase function.
 */
export function runScripts(ctx, pool, lists, t, out, fns, floorAt) {
  for (let i = 0; i < lists.length && i < pool.count; i++) {
    const list = lists[i];
    if (!list || !list.length) continue;
    const slot = pool.slot(i);
    const fn = fns[i] || (fns[i] = walkPhaseFn(ctx, slot));
    for (let j = 0; j < list.length; j++) {
      evalScript(list[j], t, out, fn, floorAt);
      if (!out.vis) continue;
      slot.place(out.X, out.Y, out.Z).heading(out.h).pose(out.pose, out.ph);
      setProps(slot, out.pr, out.pl);
      slot.show(true);
      slot._g3X = out.X; slot._g3Y = out.Y; slot._g3Z = out.Z; slot._g3h = out.h;
      break;
    }
  }
}

// ------------------------------------------------------------------------------------------------ free props

/**
 * Vessels standing free in the world (people.spawnProp): one actor per item, visible in its windows
 * [{ t0, t1, at: [X, Y, Z], h }] (absolute minutes, any order across midnight). Change-cached.
 */
export class FreeProps {
  constructor(ctx) { this.ctx = ctx; this.items = []; }
  /** names → items spawned now (hidden) */
  ensure(names) {
    for (const name of names) {
      if (this.items.some((it) => it.name === name)) continue;
      let a = null;
      try { a = this.ctx.people?.spawnProp?.(name) || null; } catch { a = null; }
      a?.setVisible?.(false);
      this.items.push({ name, a, wins: [], vis: false, key: '' });
    }
  }
  item(name) { return this.items.find((it) => it.name === name); }
  setWindows(name, wins) { const it = this.item(name); if (it) { it.wins = wins; it.key = ''; } }
  update(t) {
    for (const it of this.items) {
      let w = null;
      for (const x of it.wins) if (since(t, x.t0) < since(x.t1, x.t0)) { w = x; break; }
      const vis = !!w;
      if (vis) {
        const key = `${w.at[0]},${w.at[1]},${w.at[2]},${w.h}`;
        if (key !== it.key) { it.key = key; it.a?.setSite?.(w.at[0], w.at[1], w.at[2]); it.a?.setHeading?.(w.h ?? 0); }
      }
      if (vis !== it.vis) { it.vis = vis; it.a?.setVisible?.(vis); }
    }
  }
  hideAll() { for (const it of this.items) if (it.vis) { it.vis = false; it.a?.setVisible?.(false); } }
  dispose() { for (const it of this.items) it.a?.dispose?.(); this.items = []; }
}

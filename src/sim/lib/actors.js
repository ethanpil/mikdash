// Actor pools for choreographies: figures are spawned once (at the choreo's init), reused, and hidden whenever the
// choreo does not ask for them. A choreo only states what it WANTS each update (slot.place / pose / show); the
// runtime's budget pass decides what is drawn (quality.maxFigures, by importance and distance) and calls
// setVisible only on change. Every setter is change-cached, so calling them every frame costs almost nothing.
import { Vector3 } from 'three';
import { m2w } from '../../core/units.js';
import { floorZ } from './path.js';

const EPS = 1e-4;

export class Slot {
  constructor(pool, index) {
    this.pool = pool;
    this.index = index;
    this.actor = null;
    this.want = false;      // the choreo asked for it in its latest update
    this._wantPrev = false; // … and in the update before (sim.due keeps a skipped slot as it was)
    this._dueAt = 0;        // per-slot LOD: next update time (seconds) when far from the observer
    this.shown = false;     // what the people system currently has
    this._size = 1;         // figures it counts in the runtime's budget
    this.pos = new Vector3(); // world position (budget distances)
    this.placed = false;
    this._site = [NaN, NaN, NaN];
    this._heading = NaN;
    this._pose = null; this._phase = NaN;
    this._prop = undefined; this._hand = null;
  }
  get ctx() { return this.pool.sim.ctx; }

  /**
   * Stand the figure at site (X, Y). Z: number = exact site height; { near: Z } = the floor nearest Z on any level
   * (resolved here through the physics, so upper rooms / tunnels / flights work); omitted = the walking floor.
   */
  place(X, Y, Z) {
    if (Z && typeof Z === 'object') return this._place(X, Y, true, Z.near ?? 0);
    return this._place(X, Y, false, Z);
  }
  /** = place(X, Y, { near: Z }) without the object (for per-frame use) */
  placeNear(X, Y, Z) { return this._place(X, Y, true, Z); }
  _place(X, Y, isNear, Z) {
    // inputs are cached (with the physics version): a static figure placed every update costs no floor query
    const zKey = isNear ? -1e9 - Z : (Z === undefined ? NaN : Z);
    const ver = this.pool.sim.physVersion;
    const s = this._site;
    if (this.placed && this._ver === ver && Math.abs(s[0] - X) < EPS && Math.abs(s[1] - Y) < EPS
      && (Number.isNaN(zKey) ? Number.isNaN(s[2]) : Math.abs(s[2] - zKey) < EPS)) return this;
    s[0] = X; s[1] = Y; s[2] = zKey;
    this._ver = ver;
    let z = Z;
    if (isNear) {
      z = floorZ(this.ctx, X, Y, Z);
      if (z == null) z = Z;
    }
    const a = this.ensure();
    if (z === undefined) a.setSite(X, Y); else a.setSite(X, Y, z);
    this.pos.copy(a.object3D.position);
    this.placed = true;
    return this;
  }
  heading(deg) {
    // a tight tolerance: a coarser one would keep a stale heading that depends on the jump history
    if (Math.abs(this._heading - deg) < 1e-4) return this;
    this._heading = deg;
    this.ensure().setHeading(deg);
    return this;
  }
  /** phase omitted → the people system animates it on its own (idle breathing, sleeping) */
  pose(name, phase) {
    const p = phase == null ? NaN : phase;
    if (name === this._pose && (Number.isNaN(p) ? Number.isNaN(this._phase) : Math.abs(p - this._phase) < 1e-5)) return this;
    this._pose = name; this._phase = p;
    this.ensure().setPose(name, phase == null ? undefined : phase);
    return this;
  }
  prop(name, hand = 'right') {
    const n = name || null;
    if (n === this._prop && hand === this._hand) return this;
    this._prop = n; this._hand = hand;
    this.ensure().setProp(n, hand);
    return this;
  }
  show(b = true) { this.want = !!b; return this; }

  ensure() {
    if (this.actor) return this.actor;
    this.actor = this.pool.spawnOne(this.index);
    this.actor.setVisible(false);
    this.shown = false;
    return this.actor;
  }
  /** called by the runtime's budget pass only */
  _apply(visible) {
    if (visible === this.shown || !this.actor) return;
    this.shown = visible;
    this.actor.setVisible(visible);
  }
  dispose() { this.actor?.dispose?.(); this.actor = null; this.shown = false; }
}

export class ActorPool {
  /**
   * spec: { role (person role) | animal (kind), count, seed, importance (1..3), name, prop, hand, pose }
   * Figures are spawned eagerly by warm() (choreo init) so the first visible frame does not hitch.
   */
  constructor(sim, spec) {
    this.sim = sim;
    this.spec = spec;
    this.name = spec.name || spec.role || spec.animal || 'pool';
    this.importance = spec.importance ?? 1;
    this.slots = Array.from({ length: spec.count || 0 }, (_, i) => new Slot(this, i));
  }
  get count() { return this.slots.length; }
  slot(i) { return this.slots[i]; }
  spawnOne(i) {
    const people = this.sim.ctx.people;
    const s = this.spec;
    const seed = ((s.seed ?? 1) * 7919 + i * 104729) >>> 0;
    let a = null;
    if (people) {
      a = s.animal ? people.spawnAnimal(s.animal, { seed }) : people.spawn({ role: s.role || 'israelite', seed });
      if (a && s.prop !== undefined) a.setProp(s.prop, s.hand || 'right');
      if (a && s.pose) a.setPose(s.pose);
    }
    if (!a) a = nullActor();
    if (s.prop !== undefined) { this.slots[i]._prop = s.prop || null; this.slots[i]._hand = s.hand || 'right'; }
    return a;
  }
  /** spawn every figure now (hidden) */
  warm() { for (let i = 0; i < this.slots.length; i++) this.slots[i].ensure(); return this; }
  /** mark every slot as not wanted (the runtime does this before each update of the owning choreo) */
  clearWants() {
    for (let i = 0; i < this.slots.length; i++) { const s = this.slots[i]; s._wantPrev = s.want; s.want = false; }
  }
  dispose() { for (let i = 0; i < this.slots.length; i++) this.slots[i].dispose(); }
}

/** a stand-in when ctx.people is missing: the choreo logic still runs (and can be tested) */
function nullActor() {
  const o = { position: new Vector3(), updateMatrixWorld() {} };
  const a = {
    object3D: o, setVisible() { return a; }, setHeading() { return a; }, setPose() { return a; }, setProp() { return a; },
    setSite(X, Y, Z) { m2w(X, Y, Number.isFinite(Z) ? Z : 0, o.position); return a; }, setPosition(v) { o.position.copy(v); return a; }, dispose() {},
  };
  return a;
}

/**
 * Lazily created instanced crowd (ctx.people.crowd). spec as ctx.people.crowd.
 * show(b) toggles it; count is scaled by the quality tier (crowdScale) at creation.
 */
export class CrowdHandle {
  constructor(sim, spec) {
    this.sim = sim;
    this.spec = spec;
    this.crowd = null;
    this.want = false;
    this.shown = false;
    this._pose = null; this._phase = NaN;
    /** members at this tier (spec.count × crowdScale) — what it costs in the runtime's figure budget */
    this.count = Math.max(1, Math.round((spec.count || 1) * sim.crowdScale));
    this._size = this.count;
    this._n = this.count;   // members currently drawn (the budget may thin it)
    this.pos = crowdCentre(spec);
  }
  ensure() {
    if (this.crowd || !this.sim.ctx.people?.crowd) return this.crowd;
    this.crowd = this.sim.ctx.people.crowd({ ...this.spec, count: this.count });
    this.crowd?.setVisible(false);
    return this.crowd;
  }
  show(b = true) { this.want = !!b; return this; }
  pose(name, phase) {
    const p = phase == null ? NaN : phase;
    if (name === this._pose && (Number.isNaN(p) ? Number.isNaN(this._phase) : Math.abs(p - this._phase) < 1e-5)) return this;
    this._pose = name; this._phase = p;
    this.ensure()?.setPose(name, phase == null ? undefined : phase);
    return this;
  }
  /** called by the runtime's budget pass only: visible with n members (n < count when the budget is short) */
  _apply(visible, n = this.count) {
    if (visible) this.ensure();
    if (!this.crowd) return;
    if (visible && n !== this._n) { this._n = n; this.crowd.setCount?.(n); }
    if (visible === this.shown) return;
    this.shown = visible;
    this.crowd.setVisible(visible);
  }
  dispose() { this.crowd?.dispose?.(); this.crowd = null; }
}

/** world centre of a crowd's region / points (budget distances) */
function crowdCentre(spec) {
  const r = spec.region;
  if (r?.min && r?.max) return m2w((r.min[0] + r.max[0]) / 2, (r.min[1] + r.max[1]) / 2, r.z ?? r.near ?? 0);
  const pts = Array.isArray(spec.points) ? spec.points : [];
  let X = 0, Y = 0, Z = 0, n = 0;
  for (const p of pts) {
    const q = Array.isArray(p) ? p : p?.pos;
    if (!q) continue;
    X += q[0]; Y += q[1]; Z += Number.isFinite(q[2]) ? q[2] : (p.near ?? 0); n++;
  }
  return n ? m2w(X / n, Y / n, Z / n) : new Vector3();
}

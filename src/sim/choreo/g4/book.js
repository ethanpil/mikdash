// Group G4 — one booking register for the day, shared by the four G4 modules that put people on the Mount and work
// at the rings: the prostration places at the thirteen stations, the walking lanes of the circuit, and the rings,
// hooks and tables the nazir's and the metzora's animals use. Without it each module's walkers were planned blind to
// the others' (prostrating figures heaped on one spot, walkers merged into one another — the review's sweep).
//
// Determinism: a module's plan depends on the bookings of the modules planned before it, so the modules are always
// planned in one fixed order (ORDER), whatever order the runtime happens to update them in: before a module plans it
// asks every module ahead of it in ORDER to make sure its plan for this date and generation is built (planBefore). A
// module always plans its whole day at once (a new date or generation is a new register). nikanor-stations comes
// before chambers-daily: the metzora's rites are fixed to their window, the nazir's sets can wait for the gateway and
// the rings they leave free.
export const ORDER = ['courts-daily', 'sanhedrin', 'nikanor-stations', 'chambers-daily'];

/** intervals [a, b) with an owner tag, kept sorted by start with the running maximum of the ends, so "is [a, b)
 * free?" is a binary search (bookings arrive mostly in time order, so inserting is cheap) */
export class Slots {
  constructor() { this.a = []; this.b = []; this.m = []; this.who = []; }
  _hi(x) { const a = this.a; let lo = 0, hi = a.length; while (lo < hi) { const k = (lo + hi) >> 1; if (a[k] < x) lo = k + 1; else hi = k; } return lo; }
  free(a, b) { const hi = this._hi(b); return !(hi > 0 && this.m[hi - 1] > a); }
  /** the earliest time ≥ a at which [t, t + d) is free */
  nextFree(a, d) {
    let t = a;
    for (let guard = 0; guard < 400 && !this.free(t, t + d); guard++) {
      // the latest end among the bookings that overlap [t, t + d)
      let e = t;
      const hi = this._hi(t + d);
      for (let i = hi - 1; i >= 0 && this.m[i] > t; i--) if (this.b[i] > t) e = Math.max(e, this.b[i]);
      t = e > t ? e : t + 0.01;
    }
    return t;
  }
  add(a, b, who) {
    const i = this._hi(a + 1e-12);
    this.a.splice(i, 0, a); this.b.splice(i, 0, b); this.who.splice(i, 0, who); this.m.splice(i, 0, 0);
    this._fix(i);
    return { s: this, a, b, who };
  }
  _fix(i) { for (let k = Math.max(0, i); k < this.a.length; k++) this.m[k] = Math.max(k ? this.m[k - 1] : -Infinity, this.b[k]); }
  remove(h) {
    for (let i = 0; i < this.a.length; i++) if (this.a[i] === h.a && this.b[i] === h.b && this.who[i] === h.who) {
      this.a.splice(i, 1); this.b.splice(i, 1); this.who.splice(i, 1); this.m.splice(i, 1); this._fix(i); return;
    }
  }
  dropOwner(who) {
    let first = -1;
    for (let i = this.a.length - 1; i >= 0; i--) if (this.who[i] === who) { this.a.splice(i, 1); this.b.splice(i, 1); this.who.splice(i, 1); this.m.splice(i, 1); first = i; }
    if (first >= 0) this._fix(first);
  }
}

/**
 * One walking lane of the circuit (all walkers in it at the same speed, counter-clockwise): a walker's stretch along
 * it is the line pos(t) = c + 60·v·t (mod L). Two stretches overlapping in time conflict when their lines lie closer
 * than GAP metres — one would walk inside the other. Indexed by 2-minute bins for speed.
 */
const BIN = 2;
export class LaneBook {
  constructor(v, L, gap) { this.v = v; this.L = L; this.gap = gap; this.bins = new Map(); }
  _c(s, t) { const L = this.L; return ((s - 60 * this.v * t) % L + L) % L; }
  conflict(s, t0, t1) {
    const c = this._c(s, t0), L = this.L, g = this.gap;
    for (let k = Math.floor(t0 / BIN); k <= Math.floor(t1 / BIN); k++) {
      const list = this.bins.get(k);
      if (!list) continue;
      for (let i = 0; i < list.length; i++) {
        const e = list[i];
        if (!(t0 < e.t1 && t1 > e.t0)) continue;
        let d = Math.abs(c - e.c); if (d > L / 2) d = L - d;
        if (d < g) return true;
      }
    }
    return false;
  }
  add(s, t0, t1, who, c = null) {
    const e = { c: c ?? this._c(s, t0), t0, t1, who };
    const keys = [];
    for (let k = Math.floor(t0 / BIN); k <= Math.floor(t1 / BIN); k++) { let l = this.bins.get(k); if (!l) this.bins.set(k, (l = [])); l.push(e); keys.push(k); }
    return { lane: this, e, keys };
  }
  /** a second line `lag` metres behind a booked stretch (an animal led on a rope behind its walker) */
  shadow(h, lag, who) { return this.add(0, h.e.t0, h.e.t1, who, ((h.e.c - lag) % this.L + this.L) % this.L); }
  remove(h) { for (const k of h.keys) { const l = this.bins.get(k); const i = l ? l.indexOf(h.e) : -1; if (i >= 0) l.splice(i, 1); } }
  dropOwner(who) { for (const l of this.bins.values()) for (let i = l.length - 1; i >= 0; i--) if (l[i].who === who) l.splice(i, 1); }
}

/** the day's register: keyed by date and runtime generation */
export class G4Book {
  constructor(key) {
    this.key = key;
    this.cols = [];            // station × 16 + place → Slots
    this.lanes = [];           // per speed class: LaneBook (made by mount.js)
    this.res = new Map();      // altar resources (rings, hooks, tables, places): id → Slots
  }
  col(station, c) { const k = station * 16 + c; return this.cols[k] || (this.cols[k] = new Slots()); }
  resource(id) { let s = this.res.get(id); if (!s) this.res.set(id, (s = new Slots())); return s; }
  /** forget everything one module booked (it is about to plan again) */
  dropOwner(who) {
    for (const s of this.cols) s?.dropOwner(who);
    for (const l of this.lanes) l?.dropOwner(who);
    for (const s of this.res.values()) s.dropOwner(who);
  }
}

let BOOK = null;
/** the register for the current date and generation (a fresh one when either changed) */
export function g4Book(ctx, sim) {
  const key = `${ctx.time?.dateString || ''}|${sim.generation}`;
  if (!BOOK || BOOK.key !== key) BOOK = new G4Book(key);
  return BOOK;
}

/**
 * Make sure every G4 module ahead of `id` in ORDER has planned for this date and generation (each module exports
 * plan(ctx, state, sim), idempotent per generation; read through the runtime's sim.planOf, which initialises a module
 * not yet initialised). Call at the top of a module's own plan.
 */
export function planBefore(ctx, sim, id) {
  const i = ORDER.indexOf(id);
  if (!sim.planOf || i <= 0) return;
  for (let k = 0; k < i; k++) sim.planOf(ORDER[k]);
}

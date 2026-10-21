// Handles on the world the sim animates: movables registered by the builders (doors, curtains — ctx.movables),
// fires (FireBoard → ctx.fx.setFire), sounds (ctx.audio) and captions (bus 'caption'). All tolerate a missing target
// (a builder still in progress, audio disabled) and are change-cached so they can be driven every frame.
import { clamp, smooth, since, span } from './core.js';

/**
 * A door / curtain movable: id = 'door:<element id>' | 'curtain:<element id>' | a bare element id (→ door:).
 * userData.open(f) is the builders' contract (f 0 = shut … 1 = open); heichal doors also have openGroup(g, f).
 */
export function movable(ctx, id) {
  const key = ctx.movables?.has(id) ? id : `door:${id}`;
  const node = ctx.movables?.get(key) || null;
  const ud = node?.userData;
  const ok = typeof ud?.open === 'function';
  const last = new Map();
  const h = {
    id: key, node, exists: ok,
    /** the builder's amount when the handle was made (what the runtime restores when no choreo wants the door) */
    default: ok ? clamp(+(ud.openAmount ?? ud.amount ?? 0) || 0) : 0,
    /** current amount as the builder reports it */
    get amount() { return ok ? (ud.openAmount ?? ud.amount ?? last.get('*') ?? 0) : 0; },
    set(f) {
      if (!ok) return h;
      const v = clamp(+f || 0);
      if (Math.abs((last.get('*') ?? -1) - v) < 1e-4) return h;
      last.set('*', v);
      for (const g of last.keys()) if (g !== '*') last.delete(g);
      ud.open(v);
      return h;
    },
    /** one leaf group (heichal great gate: 'outer' | 'inner'); falls back to the whole door */
    setGroup(group, f) {
      if (!ok) return h;
      if (typeof ud.openGroup !== 'function') return h.set(f);
      const v = clamp(+f || 0);
      if (Math.abs((last.get(group) ?? -1) - v) < 1e-4) return h;
      last.set(group, v);
      last.delete('*');
      ud.openGroup(group, v);
      return h;
    },
    /** forget the cache (someone else moved it) */
    invalidate() { last.clear(); return h; },
  };
  return h;
}

/**
 * Door amount over the day as a pure function of t: opens over `swing` minutes from tOpen, stays open, shuts
 * over `swing` minutes from tClose, stays shut until tOpen (cyclic; either order across midnight).
 */
export function doorAmount(t, tOpen, tClose, swing = 0.4) {
  if (!Number.isFinite(tOpen) || !Number.isFinite(tClose)) return NaN;
  const d = since(t, tOpen), dayLen = span(tOpen, tClose);
  if (d < dayLen) return smooth(0, swing, d);
  return 1 - smooth(0, swing, d - dayLen);
}

/**
 * Shared fire levels (the runtime's sim.fireWant): like the doors, every owner states the level it wants for a fire
 * (ctx.fx id) in its update, and resolve() — once per frame, after every owner has stated its wants — applies the
 * largest. A fire nobody wants goes back to its builder's level: the intensity of its fx spec, which fx's own schedule
 * ('night', 'day', 'service', 'always') then modulates; a fire a module added itself returns to the intensity it was
 * added with (0 for the sim's own). Only fires someone has wanted are on the board; fx eases toward each new level, and
 * snaps on clock jumps, so a jump re-poses the fires with the figures.
 */
export class FireBoard {
  constructor(ctx) {
    this.ctx = ctx;
    this.byId = new Map();
    /** [{ id, wants: [{ v, owner }], value (applied), def (builder's level), rec (fx record) }] */
    this.list = [];
  }
  /** the board's record of fire id (made on first use) */
  entry(id) {
    let F = this.byId.get(id);
    if (!F) {
      F = { id, wants: [], value: NaN, def: NaN, rec: null };
      this.byId.set(id, F);
      this.list.push(F);
    }
    return F;
  }
  /** a want slot of `owner` for fire id: its owner sets w.v (NaN = no want) */
  slot(id, owner) {
    const F = this.entry(id);
    const w = { v: NaN, owner, F };
    F.wants.push(w);
    return w;
  }
  /** the level the board applies to F now: the largest want, else the builder's level */
  static levelOf(F) {
    let v = NaN;
    const W = F.wants;
    for (let k = 0; k < W.length; k++) { const x = W[k].v; if (x === x && !(x <= v)) v = x; }
    return v === v ? Math.max(0, v) : F.def;
  }
  /** apply every fire's level (fx.setFire only on a change against what fx holds) */
  resolve() {
    const fx = this.ctx.fx, fires = fx?.fires;
    if (!fires?.get) return;
    for (let i = 0; i < this.list.length; i++) {
      const F = this.list[i];
      const rec = fires.get(F.id);
      if (!rec) continue;                       // not added yet (a builder's spec fx has not consumed, a lazy fire)
      if (rec !== F.rec) {
        F.rec = rec;
        F.def = Number.isFinite(rec.spec?.intensity) ? Math.max(0, rec.spec.intensity) : (Number.isFinite(rec.target) ? rec.target : 1);
        F.value = NaN;
      }
      const v = FireBoard.levelOf(F);
      const held = typeof rec.target === 'number' ? rec.target : F.value;
      if (!(Math.abs(held - v) < 1e-4)) { try { fx.setFire(F.id, v); } catch { /* fx missing */ } }
      F.value = v;
    }
  }
  /** what the board holds for fire id: { value, def, wants: [{ owner, v }] } (debug, tests) */
  state(id) {
    const F = this.byId.get(id);
    return F ? { value: F.value, def: F.def, wants: F.wants.filter((w) => w.v === w.v).map((w) => ({ owner: w.owner, v: w.v })) } : null;
  }
}

/** one-shot sound (ctx.audio.cue); pos: [X,Y,Z] site | Vector3 | Object3D. Never throws. */
export function sound(ctx, id, pos, opts) {
  try { return ctx.audio?.cue?.(id, pos, opts) || null; } catch (e) { console.warn('[sim] audio cue failed', id, e); return null; }
}

/** subtitle line (bus 'caption' — the UI shows it): text = { en, he } | string */
export function caption(ctx, text, { id = 'sim', duration = 5, pos = null } = {}) {
  const t = typeof text === 'string' ? { en: text } : text;
  ctx.bus?.emit('caption', { id, text: t, duration, pos });
}

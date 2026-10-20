// Handles on the world the sim animates: movables registered by the builders (doors, curtains — ctx.movables),
// fires (ctx.fx.setFire), sounds (ctx.audio) and captions (bus 'caption'). All tolerate a missing target
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

/** a scheduled fire (ctx.fires / ctx.fx): set(0..1) eases there (fx) — no-op when the id is unknown */
export function fire(ctx, id) {
  let known = null, last = NaN;
  const h = {
    id,
    get exists() {
      if (known === null) {
        try { known = ctx.fx?.fires?.has ? ctx.fx.fires.has(id) : !!ctx.fx?.list?.().some?.((f) => f.id === id); } catch { known = false; }
      }
      return known;
    },
    set(v) {
      if (!h.exists || Math.abs(v - last) < 1e-3) return h;
      last = v;
      try { ctx.fx.setFire(id, v); } catch { /* fx missing */ }
      return h;
    },
  };
  return h;
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

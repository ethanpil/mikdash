// Staging the shared G1 plan in a module: pools keyed by (person group, role), each person's current leg if this module
// owns it, the module's cues (once, in continuous play — lib/cue.js), door wants and free props. Pure functions of t.
import { since, span, within, smooth, clamp } from '../../lib/core.js';
import { cueAt, crossed } from '../../lib/cue.js';
import { personAt, applyLeg, near } from './util.js';
import { SEED } from './plan.js';

/** pool specs by key 'group:role' (same seeds in every module: the same man looks the same wherever he is staged) */
export const POOLS = {
  'young:off': { role: 'kohen_offduty', count: 4, seed: SEED.brothers },
  'young:k': { role: 'kohen', count: 4, seed: SEED.brothers },
  'keri:off': { role: 'kohen_offduty', count: 1, seed: SEED.keri },
  'keri:k': { role: 'kohen', count: 1, seed: SEED.keri },
  'slab:off': { role: 'kohen_offduty', count: 1, seed: SEED.winner },
  'slab:k': { role: 'kohen', count: 1, seed: SEED.winner },
  'elders:elder': { role: 'elder', count: 6, seed: SEED.elders },
  'levite:guard': { role: 'guard_levi', count: 1, seed: SEED.levite, prop: null },
  'officer:k': { role: 'kohen', count: 1, seed: SEED.officer },
  'gevini:levi': { role: 'levi', count: 1, seed: SEED.gevini },
};

export function makePools(sim, keys, importance = 2, extra = {}) {
  const pools = {};
  for (const k of keys) {
    const s = POOLS[k];
    pools[k] = sim.pool({ name: k, role: s.role, count: s.count, seed: s.seed, importance: extra[k]?.importance ?? importance, prop: extra[k]?.prop ?? s.prop });
  }
  return pools;
}

/** the plan's people as a flat list (once per plan) */
export function peopleOf(P) {
  if (P._flat) return P._flat;
  const out = [];
  for (const v of Object.values(P.people)) { if (Array.isArray(v)) out.push(...v); else out.push(v); }
  P._flat = out;
  return out;
}

const _r = {};
/** pose every person whose current leg belongs to `owner` (pools missing for a role: skipped) */
export function stage(ctx, sim, pools, P, owner, t) {
  const list = peopleOf(P);
  let n = 0;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const r = personAt(p.eps, t, _r);
    if (!r || r.leg.owner !== owner) continue;
    const pool = pools[`${p.pool}:${r.leg.role}`];
    if (!pool) continue;
    const slot = pool.slot(p.idx);
    if (!slot) continue;
    if (!sim.due(slot)) continue;
    applyLeg(ctx, slot, r.leg, r.local);
    n++;
  }
  return n;
}

/** the module's cues: sound (ctx.audio via sim.sound) and/or caption, once each, when continuous play crosses them */
export function runCues(ctx, sim, state, cues, owner) {
  for (let i = 0; i < cues.length; i++) {
    const c = cues[i];
    if (c.owner !== owner || !crossed(state, c.t)) continue;
    cueAt(state, c.key, c.t, () => {
      if (c.id) sim.sound(c.id, c.at, c.opts);
      if (c.caption) {
        const ok = !c.at || !c.range || near(ctx, c.at[0], c.at[1], c.at[2] ?? 16, c.range);
        if (ok) sim.caption(c.caption, { id: c.capId || c.id || c.key.split(':')[0], duration: c.duration || 6 });
      }
    });
  }
}

/** a door's wanted amount from open windows [[t0, t1], …] (minutes; swing in minutes) — 0 outside them */
export function windowAmount(t, windows, swing = 0.25) {
  let a = 0;
  for (let i = 0; i < windows.length; i++) {
    const w = windows[i];
    const L = span(w[0], w[1]);
    const e = since(t, w[0]);
    if (e > L + swing) continue;
    const v = e <= L ? smooth(0, swing, e) : 1 - smooth(0, swing, e - L);
    if (v > a) a = v;
  }
  return a;
}

/**
 * Free props (ctx.people.spawnProp) shown in time windows: items [{ name, at:[X,Y,Z] (exact Z), h, show:[t0,t1] }].
 * Spawned lazily per (name, index) and reused; hidden when not wanted or when the module is released.
 */
export class FreeProps {
  constructor(ctx) { this.ctx = ctx; this.items = []; this.live = []; }
  set(items) {
    this.items = items;
    while (this.live.length < items.length) this.live.push({ a: null, name: null, vis: false, it: null });
  }
  update(t, far2 = Infinity, eye = null) {
    const P = this.ctx.people;
    for (let i = 0; i < this.live.length; i++) {
      const L = this.live[i], it = this.items[i];
      const want = !!it && within(t, it.show[0], it.show[1]);
      if (want && (!L.a || L.name !== it.name)) {
        L.a?.dispose?.();
        L.a = P?.spawnProp ? P.spawnProp(it.name, { seed: 0x6a00 + i }) : null;
        L.name = it.name; L.it = null;
        L.vis = false;
        L.a?.setVisible?.(false);
      }
      if (!L.a) continue;
      if (want && L.it !== it) { L.a.setSite(it.at[0], it.at[1], it.at[2]); L.a.setHeading(it.h || 0); L.it = it; }
      if (want !== L.vis) { L.a.setVisible(want); L.vis = want; }
    }
  }
  hide() { for (const L of this.live) if (L.a && L.vis) { L.a.setVisible(false); L.vis = false; } }
  dispose() { for (const L of this.live) L.a?.dispose?.(); this.live = []; }
}

export { clamp };

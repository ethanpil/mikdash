// The choreos' describe / locate hooks (console-design §6.2 "Describing people"): one helper every module uses, so a
// module states only WHO its pools are and WHAT each does at each of its events — no behaviour change: the hooks only
// read the module's state and the schedule, and are called by the inspect core, never by the runtime.
//
//   const { describe, locate } = describeWith({
//     id: 'tamid-morning',                     the module (subject keys default to `${id}:${pool}:${index}`)
//     prefixes?: ['g1:'],                      subject-key prefixes this module's locate answers (default [`${id}:`])
//     pools: { [poolName | 'prefix:*']: {
//       phrase: text,                          who the figure is ("one of the kohanim at the slaughter")
//       sub?: (who, state, sim, t) -> key,     a sub-role (the slaughterer, the receiver, …) — texts may be keyed by it
//       doing: { [eventId]: text, _?: text },  what he does at each event of the module he takes part in
//       why?: { [eventId]: { en, sources } },  a sourced why for that role (default: the event's summary and sources)
//       idle?: text,                           with none of his events near
//       key?: (who, state, sim, t) -> string,  a stable subject key (default `${id}:${pool}:${sub ?? index}`)
//       events?: [eventIds],                   the events he takes part in (default: the keys of doing)
//       custom?: (ctx, state, who, t, sim) -> hook result | null   the whole answer, for pools with their own logic
//     } },
//     crowd?: (ctx, state, who, t, sim) -> hook result | null,
//   })
// A text is a string, { en, he }, a function (ctx, state, who, t, ev, sub) -> text, or an object keyed by sub-role
// with '_' as its default. Before an event (up to LEAD minutes) or after it (up to LAG) a figure is "getting ready
// for" / "coming back from" it; texts for those moments may be given as doing['before:<id>'] / doing['after:<id>'].
import { within, since, wrap } from '../../lib/core.js';

export const LEAD = 12, LAG = 8;
const WALKING = /walk|run/;
const lc = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);

/** resolve a text spec */
export function textOf(x, ctx, state, who, t, ev, sub) {
  if (x == null) return null;
  if (typeof x === 'function') return textOf(x(ctx, state, who, t, ev, sub), ctx, state, who, t, ev, sub);
  if (typeof x === 'string') return { en: x };
  if (x.en) return x;
  if (typeof x === 'object') {
    if (sub != null && x[sub] !== undefined) return textOf(x[sub], ctx, state, who, t, ev, sub);
    if (x._ !== undefined) return textOf(x._, ctx, state, who, t, ev, sub);
  }
  return null;
}

/** the pooled ActorPools a module keeps in its state (own props and one level down), with their names */
export function poolsIn(state) {
  const out = [];
  const seen = new Set();
  const visit = (v, depth) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v.slots) && v.spec && typeof v.name === 'string') { out.push(v); return; }
    if (depth <= 0 || Array.isArray(v)) return;
    for (const k of Object.keys(v)) {
      const x = v[k];
      if (x && typeof x === 'object' && !(x instanceof Map) && !(x instanceof Set)) visit(x, depth - 1);
    }
  };
  for (const k of Object.keys(state || {})) visit(state[k], 2);
  return out;
}

/** a who for one slot of a pool */
export function whoOfSlot(pool, index) {
  const spec = pool.spec || {};
  const slot = pool.slots[index];
  return { kind: spec.animal ? 'animal' : 'person', poolName: pool.name, index, slot, role: spec.animal ? undefined : (slot?.actor?.role || spec.role), animal: spec.animal || undefined };
}

/** the module's events with their windows today */
function eventsOf(sim, ids) {
  const out = [];
  for (const id of ids) {
    const ev = sim.event(id);
    if (ev && Number.isFinite(ev.t0) && Number.isFinite(ev.t1) && ev.t1 !== ev.t0) out.push(ev);
  }
  return out;
}

/**
 * The event a figure is part of at t: active (those its pool has a text for first, then the nearest), else the next
 * within LEAD, else the last within LAG.
 */
export function pickEvent(sim, evs, t, pos, hasText = null) {
  let best = null, bd = Infinity;
  for (const ev of evs) {
    if (!within(t, ev.t0, ev.t1)) continue;
    let d = hasText && !hasText(ev) ? 1e6 : 0;
    if (pos && sim.schedule?.positionOf) { const p = sim.schedule.positionOf(ev); if (p) d += p.distanceTo(pos); }
    if (d < bd) { bd = d; best = ev; }
  }
  if (best) return { ev: best, phase: 'now' };
  let nb = null, nd = Infinity;
  for (const ev of evs) { const a = since(ev.t0, t) + (hasText && !hasText(ev) ? LEAD : 0); if (a <= LEAD && a < nd) { nd = a; nb = ev; } }
  if (nb) return { ev: nb, phase: 'before' };
  let lb = null, ld = Infinity;
  for (const ev of evs) { const a = since(t, ev.t1); if (a <= LAG && a < ld) { ld = a; lb = ev; } }
  if (lb) return { ev: lb, phase: 'after' };
  return null;
}

/** the next of these events after t, today */
function nextOf(evs, t) {
  let nb = null, nd = Infinity;
  for (const ev of evs) { if (ev.t0 <= t) continue; const a = ev.t0 - t; if (a < nd) { nd = a; nb = ev; } }
  return nb;
}

const stepOf = (ev) => ({ id: ev.id, label: ev.title, t0: ev.t0, t1: ev.t1 });
const whyOf = (ev) => (ev?.summary ? { en: typeof ev.summary === 'string' ? ev.summary : ev.summary.en, sources: ev.sources || [] } : null);

export function describeWith(spec) {
  const prefixes = spec.prefixes || [`${spec.id}:`];
  const poolSpec = (name) => {
    if (!name) return null;
    if (spec.pools[name]) return spec.pools[name];
    for (const k of Object.keys(spec.pools)) if (k.endsWith('*') && name.startsWith(k.slice(0, -1))) return spec.pools[k];
    return null;
  };

  function describe(ctx, state, who, t, sim) {
    if (who.kind === 'crowd') return spec.crowd ? spec.crowd(ctx, state, who, t, sim) : null;
    const ps = poolSpec(who.poolName);
    if (!ps) return null;
    if (ps.custom) {
      const r = ps.custom(ctx, state, who, t, sim);
      if (r !== undefined) return r;
    }
    const sub = ps.sub ? ps.sub(who, state, sim, t) : null;
    const ids = ps.events || Object.keys(ps.doing || {}).filter((k) => k !== '_' && !k.includes(':'));
    const evs = eventsOf(sim, ids);
    const pose = who.slot?.actor?.poseName || who.slot?._pose || '';
    const hasText = (ev) => !!textOf(ps.doing?.[ev.id], ctx, state, who, t, ev, sub);
    const pick = pickEvent(sim, evs, t, who.slot?.pos, hasText);
    const phrase = textOf(ps.phrase, ctx, state, who, t, pick?.ev, sub);
    const key = ps.key ? ps.key(who, state, sim, t) : `${spec.id}:${who.poolName}:${sub ?? who.index}`;
    if (!pick) {
      const nx = nextOf(evs, t);
      return {
        doing: textOf(ps.idle, ctx, state, who, t, null, sub) || { en: who.kind === 'animal' ? 'Waiting' : 'Between duties' },
        phrase, subjectKey: key,
        next: nx ? { t: nx.t0, label: textOf(ps.doing?.[nx.id], ctx, state, who, t, nx, sub) || nx.title, step: stepOf(nx) } : undefined,
      };
    }
    const { ev, phase } = pick;
    let doing = null;
    if (phase !== 'now') doing = textOf(ps.doing?.[`${phase}:${ev.id}`], ctx, state, who, t, ev, sub);
    if (!doing) {
      const main = textOf(ps.doing?.[ev.id], ctx, state, who, t, ev, sub) || textOf(ps.doing?._, ctx, state, who, t, ev, sub) || ev.title;
      if (phase === 'now') doing = main;
      else if (phase === 'before') doing = { en: `${WALKING.test(pose) ? 'On the way' : 'Getting ready'} — ${lc(main.en)}` };
      else doing = { en: `${WALKING.test(pose) ? 'Going back' : 'Done'} after: ${lc(main.en)}` };
    }
    const nx = phase === 'now' ? null : (phase === 'before' ? ev : nextOf(evs, t));
    const w = ps.why?.[ev.id];
    return {
      doing, phrase, eventId: ev.id, step: stepOf(ev),
      why: w?.en ? { en: w.en, sources: w.sources || [] } : whyOf(ev),
      subjectKey: key,
      next: nx ? { t: nx.t0, label: textOf(ps.doing?.[nx.id], ctx, state, who, t, nx, sub) || nx.title, step: stepOf(nx) } : undefined,
    };
  }

  /** the slot with this subject key at t — by the module's own pools (never a guessed figure) */
  function locate(ctx, state, key, t, sim) {
    if (!key || !prefixes.some((p) => key.startsWith(p))) return null;
    if (spec.locate) { const r = spec.locate(ctx, state, key, t, sim); if (r !== undefined) return r; }
    for (const pool of poolsIn(state)) {
      for (let i = 0; i < pool.slots.length; i++) {
        const slot = pool.slots[i];
        if (!slot.want && !slot.shown) continue;
        const d = describe(ctx, state, whoOfSlot(pool, i), t, sim);
        if (d?.subjectKey === key) return { slot };
      }
    }
    return null;
  }

  return { describe, locate };
}

export { within, since, wrap };

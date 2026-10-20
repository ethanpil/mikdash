// ctx.schedule (ARCHITECTURE §9): the day's events from src/data/schedule.js with their times resolved for the
// current date. Event objects are the data's own objects (t0/t1 written onto them), so active/upcoming/at return
// exactly what the data exports. Times are minutes on the cyclic clock; a window may wrap past midnight.
import { Vector3 } from 'three';
import { m2w } from '../core/units.js';
import { wrap, within, since, span } from './lib/core.js';

/** site point from [X,Y,Z] | { el, f } (f = fractions in the element box; default top centre) → [X,Y,Z] | null */
export function sitePoint(ctx, spec) {
  if (!spec) return null;
  if (Array.isArray(spec)) return spec.length >= 2 ? [spec[0], spec[1], spec[2]] : null;
  if (spec.el) {
    const b = ctx.elOpt?.(spec.el)?.box;
    if (!b) return null;
    const f = spec.f || [0.5, 0.5, 1];
    return [0, 1, 2].map((i) => b.min[i] + (b.max[i] - b.min[i]) * (f[i] ?? 0.5));
  }
  if (spec.at) return sitePoint(ctx, spec.at);
  return null;
}

export function createSchedule(ctx, mod, zones) {
  const time = ctx.time;
  const ALL = Array.isArray(mod?.EVENTS) ? mod.EVENTS : Array.isArray(mod?.default) ? mod.default : [];
  const eventsFor = typeof mod?.eventsFor === 'function' ? mod.eventsFor : null;
  const events = [];   // the stable array exposed as ctx.schedule.events
  const index = new Map();
  let warnedFor = false;

  function dayOk(ev) {
    const d = time?.dayType;
    return !ev.dayTypes || !d || ev.dayTypes.includes(d);
  }

  /** choose the events of the current date (eventsFor(dayType, time) when the data exports it) */
  function select() {
    let list = null;
    if (eventsFor) {
      try { list = eventsFor(time?.dayType, time); } catch (e) {
        if (!warnedFor) { warnedFor = true; console.warn('[sim] schedule eventsFor() failed — filtering EVENTS by dayTypes', e); }
      }
    }
    if (!Array.isArray(list)) list = ALL.filter(dayOk);
    events.length = 0;
    index.clear();
    for (const ev of list) {
      if (!ev || typeof ev !== 'object') continue;
      events.push(ev);
      if (ev.id != null && !index.has(ev.id)) index.set(ev.id, ev);
    }
    resolveTimes();
    return events;
  }

  /** t0 / t1 (minutes) for one event on the current date; a missing end = 15 minutes after the start */
  function resolveEvent(ev) {
    if (!time || !ev) return ev;
    const w = ev.when ?? {};
    let startSpec = typeof w === 'object' ? w.start : w;          // when: { start, end } | a single time spec
    if (startSpec == null && typeof w === 'object' && (w.at != null || w.dayHour != null || w.nightHour != null || w.clock != null)) startSpec = w;
    let t0 = startSpec != null ? time.resolve(startSpec) : (Number.isFinite(ev.t0) ? ev.t0 : NaN);
    let t1 = typeof w === 'object' && w.end != null ? time.resolve(w.end) : NaN;
    if (!Number.isFinite(t0)) t0 = NaN;
    if (!Number.isFinite(t1)) t1 = Number.isFinite(t0) ? wrap(t0 + (Number.isFinite(ev.duration) ? ev.duration : 15)) : NaN;
    ev.t0 = t0;
    ev.t1 = t1;
    return ev;
  }

  function resolveTimes() {
    for (const ev of events) resolveEvent(ev);
    return events;
  }

  const isActive = (ev, t) => Number.isFinite(ev.t0) && within(t, ev.t0, ev.t1);
  const byImportance = (a, b) => (b.importance || 1) - (a.importance || 1) || (a.t0 - b.t0);

  const schedule = {
    events,
    /** true when src/data/schedule.js is not available yet (choreos then run on their own fixtures) */
    get missing() { return !ALL.length && !eventsFor; },
    select,
    resolveTimes,
    resolveEvent,
    /** events in progress at t (cyclic windows), most important first */
    active(t = time?.t) {
      const out = [];
      for (const ev of events) if (isActive(ev, t)) out.push(ev);
      return out.sort(byImportance);
    },
    /** the next n events that start after t (not active now), soonest first */
    upcoming(t = time?.t, n = 5) {
      const out = [];
      for (const ev of events) if (Number.isFinite(ev.t0) && !isActive(ev, t)) out.push(ev);
      out.sort((a, b) => since(a.t0, t) - since(b.t0, t));
      return out.slice(0, n);
    },
    /** events active at t in a zone */
    at(zoneId, t = time?.t) {
      if (!zoneId) return [];
      return schedule.active(t).filter((ev) => ev.zone === zoneId || (Array.isArray(ev.zones) && ev.zones.includes(zoneId)));
    },
    byId(id) { return index.get(id) || null; },
    /** 0..1 progress through an event at t (NaN when not active) */
    progress(ev, t = time?.t) {
      if (!ev || !isActive(ev, t)) return NaN;
      return since(t, ev.t0) / (span(ev.t0, ev.t1) || 1);
    },
    /** where the event happens: world Vector3 (meters), or null */
    positionOf(ev, target = new Vector3()) {
      const p = sitePoint(ctx, ev?.pos) || sitePoint(ctx, ev?.view?.at) || zoneCentre(ev?.zone);
      return p ? m2w(p[0], p[1], p[2] ?? 0, target) : null;
    },
    /** a ctx.player.goTo target to watch the event: { at:[X,Y(,Z)], heading?, label } */
    viewOf(ev) {
      if (!ev) return null;
      const v = ev.view;
      let at = sitePoint(ctx, v?.at ?? (Array.isArray(v) ? v : null));
      if (!at) {
        const stand = zones?.info?.(ev.zone)?.stand;
        const p = sitePoint(ctx, stand) || sitePoint(ctx, ev.pos) || zoneCentre(ev.zone);
        at = p && [p[0], p[1]];
      } else if (v?.at && !Array.isArray(v.at)) at = [at[0], at[1]]; // an element point's Z is a surface, not a floor
      if (!at) return null;
      const target = { at: Number.isFinite(at[2]) ? [at[0], at[1], at[2]] : [at[0], at[1]] };
      if (Number.isFinite(v?.heading)) target.heading = v.heading;
      target.label = ev.title?.en || ev.id;
      return target;
    },
  };

  function zoneCentre(id) {
    const z = id && ctx.site?.zones?.[id];
    const b = z?.boxes?.[0];
    return b ? [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, z.floorZ ?? b[0][2]] : null;
  }

  select();
  return schedule;
}

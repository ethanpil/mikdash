// ctx.schedule (ARCHITECTURE §9): the day's events from src/data/schedule.js with their times resolved for the
// current date. Event objects are the data's own objects (t0/t1 written onto them), so active/upcoming/at return
// exactly what the data exports. Times are minutes on the cyclic clock; a window may wrap past midnight.
import { Vector3 } from 'three';
import { m2w } from '../core/units.js';
import { wrap, within, since, span, DAY } from './lib/core.js';
import { addDays, utcDayMs, computeZmanim, formatDate } from '../time/zmanim.js';

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
  // retime(id, fn): a choreo publishes the window it actually stages for an event (e.g. the blessing's raised hands);
  // fn(t0, t1) -> [t0, t1] on the data's resolved window, applied whenever the event is resolved
  const retimers = new Map();
  let rtVersion = 0;     // bumped when a retimer is added or removed (the next date's rows are re-resolved)
  // liveView(id, fn): a choreo supplies where to stand to watch a moving event (the officer on his round); fn(t) ->
  // { at, heading } | null (null = the data's view). Installed as a getter on the event's `view`, so every reader (the
  // UI's "Go", viewOf) gets it at the moment it asks
  const liveViews = new Map();
  const viewBase = new WeakMap();      // event object -> its own (data) view
  // setAutoView(fn): fn(ev, t, dataView) -> { at, heading } | null, asked after an event's own live view (gate-sim-data:
  // the data's view while it shows the event's figures, else a stand that does — src/sim/lib/watch.js)
  let autoView = null;
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
      if (liveViews.has(ev.id) || autoView) installView(ev);
    }
    resolveTimes();
    return events;
  }

  function installView(ev) {
    if ((!liveViews.has(ev.id) && !autoView) || viewBase.has(ev)) return;
    const d = Object.getOwnPropertyDescriptor(ev, 'view');
    if (d && !('value' in d)) return;             // an accessor someone else put there
    if (d && d.configurable === false) return;
    viewBase.set(ev, ev.view ?? null);
    Object.defineProperty(ev, 'view', {
      configurable: true, enumerable: true,
      get() {
        let v = null;
        const base = viewBase.get(ev);
        try { v = liveViews.get(ev.id)?.(time?.t) || null; } catch (e) { warnSrc(e); }
        if (!v && autoView) { try { v = autoView(ev, time?.t, base) || null; } catch (e) { warnSrc(e); } }
        return v || base;
      },
      set(v) { viewBase.set(ev, v); },
    });
  }
  function uninstallView(ev) {
    if (!viewBase.has(ev)) return;
    const base = viewBase.get(ev);
    viewBase.delete(ev);
    Object.defineProperty(ev, 'view', { value: base, writable: true, configurable: true, enumerable: true });
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
    const rt = ev.id != null ? retimers.get(ev.id) : null;
    if (rt && Number.isFinite(t0)) {
      // the data's window stays readable for the choreo that stages from it; the list, the map and the clock see the
      // staged one
      ev.tPlan = [t0, t1];
      try {
        const r = rt(t0, t1);
        if (r && Number.isFinite(r[0]) && Number.isFinite(r[1])) { t0 = wrap(r[0]); t1 = wrap(r[1]); }
      } catch (e) { warnSrc(e); }
    }
    ev.t0 = t0;
    ev.t1 = t1;
    return ev;
  }

  function resolveTimes() {
    for (const ev of events) resolveEvent(ev);
    return events;
  }

  const isActive = (ev, t) => Number.isFinite(ev.t0) && within(t, ev.t0, ev.t1);
  // dynamic sub-events (e.g. each individual's offering in progress) sort after the day's events of equal importance
  const byImportance = (a, b) => (b.importance || 1) - (a.importance || 1) || ((a.dynamic ? 1 : 0) - (b.dynamic ? 1 : 0)) || (a.t0 - b.t0);

  /**
   * Dynamic sources (additive): src = fn(t) -> events | { active(t) -> events, upcoming?(t, n) -> events, byId?(id) }.
   * Their events are event-like objects { id, parent, dynamic: true, title, summary, description, sources, zone, pos,
   * view, t0, t1, importance, layer } that are not in `events` (the day's order and the dial stay as they were);
   * active() and at() include them unless opts.dynamic === false, upcoming() only when opts.dynamic === true.
   */
  const sources = [];
  const srcActive = (s, t) => { try { return (typeof s === 'function' ? s(t) : s.active?.(t)) || []; } catch (e) { warnSrc(e); return []; } };
  let srcWarned = false;
  const warnSrc = (e) => { if (!srcWarned) { srcWarned = true; console.warn('[sim] schedule source failed', e); } };

  const schedule = {
    events,
    /** true when src/data/schedule.js is not available yet (choreos then run on their own fixtures) */
    get missing() { return !ALL.length && !eventsFor; },
    select,
    resolveTimes,
    resolveEvent,
    /** events in progress at t (cyclic windows), most important first; dynamic sub-events too unless opts.dynamic === false */
    active(t = time?.t, opts) {
      const out = [];
      for (const ev of events) if (isActive(ev, t)) out.push(ev);
      if (opts?.dynamic !== false) for (const s of sources) for (const ev of srcActive(s, t)) if (ev) out.push(ev);
      return out.sort(byImportance);
    },
    /**
     * The next n events that start after t (not active now), soonest first; dynamic ones only with opts.dynamic === true.
     * Today's events that start later today, then — past midnight — the NEXT civil date's own events with its zmanim
     * (qa-r2 SIM-R2-4: today's list wrapped round, so Friday night showed the weekday night-turning and Saturday night
     * Shabbat's dawn). A next-day row is a view of the event object (Object.create) with its own t0 / t1 and
     * nextDay: 'YYYY-MM-DD'; an event active now is not listed again for tomorrow.
     */
    upcoming(t = time?.t, n = 5, opts) {
      const out = [];
      const tt = wrap(t ?? 0);
      // (an empty window — a choreo's retime for something not staged today, e.g. no nazir — is not listed)
      for (const ev of events) if (Number.isFinite(ev.t0) && !isActive(ev, t) && ev.t0 > tt && ev.t1 !== ev.t0) out.push(ev);
      const activeIds = new Set();
      for (const ev of events) if (Number.isFinite(ev.t0) && isActive(ev, t)) activeIds.add(ev.id);
      for (const ev of nextDay()) if (!activeIds.has(ev.id) && ev.t1 !== ev.t0) out.push(ev);
      if (opts?.dynamic === true) for (const s of sources) { try { for (const ev of s.upcoming?.(t, n) || []) if (ev && !isActive(ev, t)) out.push(ev); } catch (e) { warnSrc(e); } }
      const ahead = (ev) => (ev.nextDay ? DAY - tt + ev.t0 : since(ev.t0, t));
      out.sort((a, b) => ahead(a) - ahead(b));
      return out.slice(0, n);
    },
    /** events active at t in a zone (dynamic ones too unless opts.dynamic === false) */
    at(zoneId, t = time?.t, opts) {
      if (!zoneId) return [];
      return schedule.active(t, opts).filter((ev) => ev.zone === zoneId || (Array.isArray(ev.zones) && ev.zones.includes(zoneId)));
    },
    byId(id) {
      const ev = index.get(id);
      if (ev || id == null) return ev || null;
      for (const s of sources) { try { const d = s.byId?.(id); if (d) return d; } catch (e) { warnSrc(e); } }
      return null;
    },
    /** only the dynamic sub-events in progress at t */
    dynamic(t = time?.t) {
      const out = [];
      for (const s of sources) for (const ev of srcActive(s, t)) if (ev) out.push(ev);
      return out;
    },
    /** register a dynamic source (see above); returns a function that removes it */
    addSource(src) {
      if (!src || sources.includes(src)) return () => {};
      sources.push(src);
      return () => { const i = sources.indexOf(src); if (i >= 0) sources.splice(i, 1); };
    },
    get sources() { return sources.slice(); },
    /**
     * Where to stand to watch a moving event: fn(t) -> { at: [X, Y, Z?], heading } | null (null = the data's view).
     * ev.view becomes a getter evaluated at the clock's time when read (the UI's "Go", viewOf), on this and later dates.
     * Returns a function that restores the data's view.
     */
    liveView(id, fn) {
      if (id == null || typeof fn !== 'function') return () => {};
      liveViews.set(id, fn);
      const ev = index.get(id);
      if (ev) installView(ev);
      return () => {
        if (liveViews.get(id) !== fn) return;
        liveViews.delete(id);
        if (!autoView) for (const e of events) if (e.id === id) uninstallView(e);
      };
    },
    /**
     * The fallback for every event's view after its own live view (fn(ev, t, dataView) -> view | null): installs the
     * view getter on all events, on this date and later ones.
     */
    /** does a choreo supply its own live view for event `id`? */
    hasLiveView(id) { return liveViews.has(id); },
    setAutoView(fn) {
      autoView = typeof fn === 'function' ? fn : null;
      if (autoView) for (const ev of events) installView(ev);
    },
    /**
     * Publish the window a choreo actually stages for event `id`: fn(t0, t1) -> [t0, t1] maps the data's resolved
     * window (kept on the event as tPlan) to the one active / upcoming / at and the UI report. Re-applied on every
     * resolve (new date). Returns a function that removes it.
     */
    retime(id, fn) {
      if (id == null || typeof fn !== 'function') return () => {};
      retimers.set(id, fn);
      rtVersion++;
      const ev = index.get(id);
      if (ev) resolveEvent(ev);
      return () => {
        if (retimers.get(id) !== fn) return;
        retimers.delete(id);
        rtVersion++;
        const e = index.get(id);
        if (e) { delete e.tPlan; resolveEvent(e); }
      };
    },
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

  /**
   * The next civil date's events (eventsFor its day type) with t0 / t1 resolved against its own zmanim — rows for
   * upcoming() after midnight. Cached per date (and re-resolved after a retime). Each is Object.create(event) carrying
   * t0, t1, tPlan and nextDay, so the data's object (and today's resolution of it) is never touched.
   */
  let nd = { key: '', list: [] };
  function nextDay() {
    if (!time?.date || !time.zmanim) return [];
    const key = `${time.dateString}|${retimers.size}|${rtVersion}`;
    if (nd.key === key) return nd.list;
    const date = addDays(time.date, 1);
    const wd = new Date(utcDayMs(date.y, date.m, date.d)).getUTCDay();
    const dayType = wd === 5 ? 'friday' : wd === 6 ? 'shabbat' : 'weekday';
    let list = null;
    if (eventsFor) { try { list = eventsFor(dayType, time); } catch { list = null; } }
    if (!Array.isArray(list)) list = ALL.filter((ev) => !ev.dayTypes || ev.dayTypes.includes(dayType));
    const out = [];
    // resolve with the next date's zmanim: time.resolve reads time.zmanim (synchronous; restored at once)
    const z0 = time.zmanim;
    try {
      time.zmanim = computeZmanim(date, time.geo);
      for (const ev of list) {
        if (!ev || typeof ev !== 'object' || ev.dayTypes?.includes?.('occasional')) continue;
        const w = ev.when ?? {};
        let s0 = typeof w === 'object' ? w.start : w;
        if (s0 == null && typeof w === 'object' && (w.at != null || w.dayHour != null || w.nightHour != null || w.clock != null)) s0 = w;
        let t0 = s0 != null ? time.resolve(s0) : NaN;
        let t1 = typeof w === 'object' && w.end != null ? time.resolve(w.end) : NaN;
        if (!Number.isFinite(t0)) continue;
        if (!Number.isFinite(t1)) t1 = wrap(t0 + (Number.isFinite(ev.duration) ? ev.duration : 15));
        const rt = ev.id != null ? retimers.get(ev.id) : null;
        const plan = [t0, t1];
        if (rt) {
          try {
            const r = rt(t0, t1, { nextDay: true });
            if (r && Number.isFinite(r[0]) && Number.isFinite(r[1])) { t0 = wrap(r[0]); t1 = wrap(r[1]); }
          } catch (e) { warnSrc(e); }
        }
        const x = Object.create(ev);
        const own = (value) => ({ value, enumerable: true, writable: true, configurable: true });
        Object.defineProperties(x, { t0: own(t0), t1: own(t1), tPlan: own(plan), nextDay: own(formatDate(date)) });
        out.push(x);
      }
    } finally { time.zmanim = z0; }
    nd = { key, list: out };
    return out;
  }

  function zoneCentre(id) {
    const z = id && ctx.site?.zones?.[id];
    const b = z?.boxes?.[0];
    return b ? [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, z.floorZ ?? b[0][2]] : null;
  }

  select();
  return schedule;
}

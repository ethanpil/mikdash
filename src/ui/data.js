// Read-side adapter over ctx.schedule (§9), ctx.zones (§8) and ctx.time (§6), with the UI fixtures as a fallback
// while those subsystems are still stubs. Everything here is a pure function of (date, t) + settings.
import { FIXTURE_EVENTS, FIXTURE_ZONES, ZONE_NAMES } from './fixtures.js';
import { zoneAtSite } from '../data/site.js';
import { w2m } from '../core/units.js';
import { wrap, prettyId } from './format.js';

/**
 * The ten sanctities (Kelim 1:6–9; Rambam BhB 7:12–22), as rungs 0..10. The report's §0.5 counts Eretz Yisrael
 * as 1 (Heichal = 10, Kodesh HaKodashim "above all"); the Rambam counts walled cities as 1 (KhK = 10). The data's
 * numbering is detected from Har HaBayit's value (report: 4, Rambam: 3).
 */
export const LADDER = [
  { en: 'Eretz Yisrael', he: 'ארץ ישראל', rule: 'The omer, bikkurim and the two loaves come only from it' },
  { en: 'Walled cities', he: 'עיירות המוקפות חומה', rule: 'Metzora\'im are sent out of them' },
  { en: 'Jerusalem', he: 'ירושלים', rule: 'Kodashim kalim and ma\'aser sheni are eaten within its wall' },
  { en: 'Har HaBayit', he: 'הר הבית', rule: 'No zav, zavah, niddah or yoledet' },
  { en: 'The Chel', he: 'החיל', rule: 'No gentile and no one impure from a corpse' },
  { en: 'Ezrat Nashim', he: 'עזרת נשים', rule: 'No tevul yom (rabbinic)' },
  { en: 'Ezrat Yisrael', he: 'עזרת ישראל', rule: 'No mechusar kippurim; karet for the impure' },
  { en: 'Ezrat Kohanim', he: 'עזרת כהנים', rule: 'Israelites only for semichah, slaughter or waving', src: 'Kelim 1:8' },
  { en: 'Between the Ulam and the Mizbeach', he: 'בין האולם ולמזבח', rule: 'No blemished kohen and none with grown hair', src: 'Kelim 1:9' },
  { en: 'The Heichal', he: 'ההיכל', rule: 'None without washed hands and feet', src: 'Kelim 1:9' },
  { en: 'Kodesh HaKodashim', he: 'קודש הקדשים', rule: 'The Kohen Gadol alone, on Yom Kippur', src: 'Kelim 1:9' },
];
/** first rung the visitor could not really enter as an Israelite (Ezrat Kohanim) */
export const RESTRICTED_RUNG = 7;
export const LADDER_SOURCES = ['Kelim 1:6–9', 'Rambam BhB 7:12–22'];

/** zones that are above or below the walking surface of the plan (skip in 2D lookups) */
const ALOFT = new Set(['aliyah', 'roof', 'taim-roofs', 'ulam-upper', 'en-gallery', 'beit-avtinas', 'beit-hanitzotz',
  'shushan-habirah', 'underground-passage', 'beit-hatevilah', 'outside']);

export function createData(ctx) {
  const timeCache = new Map();
  let cacheDate = '';
  const setting = (k) => { try { return ctx.settings?.get?.(k); } catch { return undefined; } };
  const unwrap = (r) => (r && r.event && !r.id ? r.event : r);

  const data = {
    /** true while the UI is showing sample events */
    get fixtureEvents() { return !(ctx.schedule?.events?.length); },
    get fixtureZones() { return !hasZoneContent(); },

    events() { return ctx.schedule?.events?.length ? ctx.schedule.events : FIXTURE_EVENTS; },

    /** { t0, t1 } minutes for an event on the current date (cached per date, by event id) */
    times(ev) {
      const time = ctx.time;
      if (!time || !ev) return null;
      // sim results may be fresh objects each call: precomputed numbers need no cache at all
      if (Number.isFinite(ev.t0)) return { t0: ev.t0, t1: Number.isFinite(ev.t1) ? ev.t1 : wrap(ev.t0 + 15) };
      const key = time.dateString || '';
      if (key !== cacheDate) { timeCache.clear(); cacheDate = key; }
      const id = ev.id ?? ev; // ids are stable across calls; objects without one are rare fixtures
      if (timeCache.has(id)) return timeCache.get(id);
      let t0 = time.resolve?.(ev.when?.start);
      let t1 = time.resolve?.(ev.when?.end);
      if (!Number.isFinite(t0)) t0 = NaN;
      if (!Number.isFinite(t1) && Number.isFinite(t0)) t1 = wrap(t0 + 15);
      const r = Number.isFinite(t0) ? { t0, t1 } : null;
      timeCache.set(id, r);
      return r;
    },

    dayOk(ev) { return !ev.dayTypes || !ctx.time?.dayType || ev.dayTypes.includes(ctx.time.dayType); },
    layerOk(ev) { return ev.layer !== 'aggadah' || setting('aggadah') !== false; },

    isActive(ev, t = ctx.time?.t) {
      const r = data.times(ev);
      if (!r) return false;
      const { t0, t1 } = r;
      return t1 >= t0 ? t >= t0 && t < t1 : t >= t0 || t < t1;
    },

    /** 0..1 progress through an active event */
    progress(ev, t = ctx.time?.t) {
      const r = data.times(ev);
      if (!r) return 0;
      const len = wrap(r.t1 - r.t0) || 1;
      return Math.min(1, wrap(t - r.t0) / len);
    },

    /** events in progress; with the schedule's dynamic sub-events (offerings in progress) unless opts.dynamic === false */
    active(t = ctx.time?.t, opts) {
      let list;
      if (ctx.schedule?.events?.length && typeof ctx.schedule.active === 'function') {
        try { list = (ctx.schedule.active(t, opts) || []).map(unwrap); } catch { list = null; }
      }
      if (!list) list = data.events().filter((ev) => data.dayOk(ev) && data.isActive(ev, t));
      return list.filter((ev) => ev && data.layerOk(ev)).sort((a, b) => (b.importance || 1) - (a.importance || 1));
    },

    upcoming(t = ctx.time?.t, n = 5) {
      let list;
      if (ctx.schedule?.events?.length && typeof ctx.schedule.upcoming === 'function') {
        try { list = (ctx.schedule.upcoming(t, n + 4) || []).map(unwrap); } catch { list = null; }
      }
      if (!list) {
        list = data.events().filter((ev) => data.dayOk(ev) && data.times(ev) && !data.isActive(ev, t))
          .sort((a, b) => wrap(data.times(a).t0 - t) - wrap(data.times(b).t0 - t));
      }
      return list.filter((ev) => ev && data.layerOk(ev)).slice(0, n);
    },

    /** events happening in a zone now (the dynamic sub-events only with opts.dynamic === true) */
    at(zoneId, t = ctx.time?.t, opts) {
      if (!zoneId) return [];
      const o = { dynamic: opts?.dynamic === true };
      if (ctx.schedule?.events?.length && typeof ctx.schedule.at === 'function') {
        try { return (ctx.schedule.at(zoneId, t, o) || []).map(unwrap).filter((e) => e && data.layerOk(e)); } catch { /* fall through */ }
      }
      return data.active(t, o).filter((ev) => ev.zone === zoneId);
    },

    /**
     * Split a list into the day's events and the dynamic sub-events (each individual's offering in progress), the
     * latter grouped by their parent event id: { stat: [...], groups: Map(parentId -> [...]) }.
     */
    group(list) {
      const stat = [], groups = new Map();
      for (const ev of list || []) {
        if (!ev) continue;
        if (!ev.dynamic) { stat.push(ev); continue; }
        const p = ev.parent || '';
        if (!groups.has(p)) groups.set(p, []);
        groups.get(p).push(ev);
      }
      return { stat, groups };
    },

    nextAt(zoneId, t = ctx.time?.t) {
      return data.upcoming(t, 60).find((ev) => ev.zone === zoneId) || null;
    },

    /** site point from [X,Y,Z] | { el, f } → [X,Y,Z] or null */
    point(spec) {
      if (!spec) return null;
      if (Array.isArray(spec)) return spec.length >= 2 ? [spec[0], spec[1], spec[2]] : null;
      if (spec.el) {
        const el = ctx.elOpt?.(spec.el);
        const b = el?.box;
        if (!b) return null;
        const f = spec.f || [0.5, 0.5, 1];
        return [0, 1, 2].map((i) => b.min[i] + (b.max[i] - b.min[i]) * (f[i] ?? 0.5));
      }
      if (Array.isArray(spec.at)) return data.point(spec.at);
      return null;
    },

    zoneCenter(id) {
      const z = ctx.site?.zones?.[id];
      const b = z?.boxes?.[0];
      if (!b) return null;
      return [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, z.floorZ ?? b[0][2]];
    },

    eventPos(ev) { return data.point(ev?.pos) || data.point(ev?.view?.at) || data.zoneCenter(ev?.zone); },

    /** goTo target for watching an event: { at:[X,Y(,Z)], heading, label } */
    viewTarget(ev) {
      const v = ev?.view;
      let at = data.point(v?.at);
      if (!at) {
        // no authored view: the zone's observer spot, else the event itself (plan position only — its Z is
        // the element's top, not a floor)
        const p = data.point(data.zone(ev?.zone)?.stand) || data.eventPos(ev);
        at = p && [p[0], p[1]];
      }
      if (!at) return null;
      const target = { at: Number.isFinite(at[2]) ? [at[0], at[1], at[2]] : [at[0], at[1]] };
      if (Number.isFinite(v?.heading)) target.heading = v.heading;
      target.label = ev?.title?.en || ev?.id;
      return target;
    },

    // ---------------- zones ----------------
    currentZoneId() {
      const c = ctx.zones?.current;
      if (c) return typeof c === 'string' ? c : (c.id ?? null);
      const p = ctx.player?.position;
      if (!p) return null;
      const s = w2m(p);
      return zoneAtSite(s.X, s.Y, s.Z + 0.4);
    },

    /** zone id at a plan point (ignores aloft/underground spaces) */
    zoneAt2D(X, Y) {
      let best = null, bp = -Infinity, bv = Infinity;
      for (const [id, z] of Object.entries(ctx.site?.zones || {})) {
        if (ALOFT.has(id) || z.floorZ > 30 || z.floorZ < -1) continue;
        for (const [mn, mx] of z.boxes) {
          if (X < mn[0] || X > mx[0] || Y < mn[1] || Y > mx[1]) continue;
          const v = (mx[0] - mn[0]) * (mx[1] - mn[1]);
          if (z.priority > bp || (z.priority === bp && v < bv)) { best = id; bp = z.priority; bv = v; }
        }
      }
      return best;
    },

    /** content for a zone (real ZONE_CONTENT, else fixture) merged with a fallback name */
    zone(id) {
      if (!id) return null;
      const real = realZone(id);
      if (real) return { id, ...real, name: { ...(ZONE_NAMES[id] || {}), ...(real.name || {}) }, fixture: false };
      if (!hasZoneContent() && FIXTURE_ZONES[id]) return { id, ...FIXTURE_ZONES[id], fixture: true };
      const n = ZONE_NAMES[id];
      return { id, name: n ? { ...n } : { en: prettyId(id) }, fixture: !hasZoneContent() };
    },

    /** rung index (0..10) on LADDER for a zone, or null */
    rung(id) {
      if (id === 'kodesh-hakodashim') return 10;
      const s = data.zone(id)?.sanctity;
      if (!Number.isFinite(s)) return null;
      const hb = data.zone('har-habayit')?.sanctity;
      const report = hb !== 3; // the report's §0.5 numbering unless Har HaBayit is 3 (Rambam's)
      const i = Math.round(report ? s - 1 : s);
      return i >= 0 ? Math.min(10, i) : null;
    },
  };

  function contentSource() {
    const z = ctx.zones;
    return z?.content || z?.ZONE_CONTENT || null;
  }
  function hasZoneContent() {
    const z = ctx.zones;
    if (!z) return false;
    if (contentSource() && Object.keys(contentSource()).length) return true;
    if (typeof z.info === 'function' || typeof z.get === 'function') return true;
    const l = z.list;
    return Array.isArray(l) ? l.some((o) => o && typeof o === 'object' && o.name) : !!(l && typeof l === 'object' && Object.keys(l).length);
  }
  function realZone(id) {
    const z = ctx.zones;
    if (!z) return null;
    let c = contentSource()?.[id];
    if (!c && typeof z.info === 'function') { try { c = z.info(id); } catch { c = null; } }
    if (!c && typeof z.get === 'function') { try { c = z.get(id); } catch { c = null; } }
    if (!c && z.list) c = Array.isArray(z.list) ? z.list.find((o) => o && typeof o === 'object' && o.id === id) : z.list[id];
    return c && typeof c === 'object' ? c : null;
  }

  return data;
}

// Simulation clock: Israel Standard Time on a fixed civil date at the Temple Mount.
// ctx.time (ARCHITECTURE.md §6): t (minutes since local midnight, cyclic), zmanim (GRA), seasonal-hour
// conversion, Hebrew date, sun/moon/planets for the sky. Pure function of (date, t) — no accumulated state.
//
// Wrap-around: the clock runs on ONE civil date. Past 24:00 it wraps to 00:00 of the SAME date (the date never
// advances by itself), so the service day loops seamlessly; change the date explicitly with setDate().
import { Vector3 } from 'three';
import { PRIORITY } from '../core/engine.js';
import {
  solarPosition, moonPosition, moonIlluminanceTOA, localSiderealTime, planetPositions, SITE_GEO,
} from './astro.js';
import { computeZmanim, hebrewDate, localMidnightUTC } from './zmanim.js';

export const DEFAULT_DATE = '2026-11-02'; // Monday, 22 Cheshvan 5787 — an ordinary weekday
export const DEFAULT_OFFSET_FROM_ALOT = -6; // "slightly before dawn"

/** Anchor names accepted by resolve()/parse() (case-insensitive; '_' ignored). */
const ANCHOR_ALIASES = {
  alot: 'alot', alothashachar: 'alot', dawn: 'alot',
  sunrise: 'sunrise', netz: 'sunrise', hanetz: 'sunrise',
  sofzmanshma: 'sofZmanShma', shma: 'sofZmanShma',
  sofzmantefillah: 'sofZmanTefillah',
  chatzot: 'chatzot', noon: 'chatzot', midday: 'chatzot',
  minchagedola: 'minchaGedola', minchaketana: 'minchaKetana',
  plag: 'plagHamincha', plaghamincha: 'plagHamincha',
  sunset: 'sunset', shkia: 'sunset', shkiah: 'sunset',
  tzeit: 'tzeit', nightfall: 'tzeit',
  midnight: 'midnight', chatzothalailah: 'midnight', chatzotlaila: 'midnight',
};

const wrap = (t) => ((t % 1440) + 1440) % 1440;
const ordinal = (n) => `${n}${(n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')}`;

function parseDate(str) {
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(str || '').trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const chk = new Date(Date.UTC(y, mo - 1, d));
  if (chk.getUTCMonth() !== mo - 1 || chk.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

function worldDir(altDeg, azDeg, target) {
  const a = altDeg * Math.PI / 180, z = azDeg * Math.PI / 180;
  return target.set(Math.sin(z) * Math.cos(a), Math.sin(a), -Math.cos(z) * Math.cos(a));
}

/** Build the clock (also usable headless, e.g. by tests or tools). */
export function createTime(bus, opts = {}) {
  const warned = new Set();
  const warnOnce = (k, msg) => { if (!warned.has(k)) { warned.add(k); console.warn(msg); } };

  const time = {
    t: 0,
    speed: 1,
    paused: false,
    /** sim minutes advanced during the last frame (0 on jumps / while paused) */
    frameDelta: 0,
    date: null, dateString: '', weekday: 0, dayType: 'weekday',
    hebrew: null, hebrewEvening: null,
    zmanim: null,
    /** UTC milliseconds of the current simulated instant */
    ms: 0,
    /** local sidereal time, degrees */
    lst: 0,
    geo: { ...SITE_GEO },
    sun: { altitude: 0, trueAltitude: 0, azimuth: 0, dir: new Vector3(0, 1, 0), distanceAU: 1 },
    moon: {
      altitude: 0, trueAltitude: 0, azimuth: 0, dir: new Vector3(0, 1, 0), phase: 0, illumination: 0,
      phaseAngle: 0, angularRadius: 0.26, distanceKm: 384400, illuminanceTOA: 0, ra: 0, dec: 0,
    },
    planets: [],

    set(t) {
      time.t = wrap(+t || 0);
      time.frameDelta = 0;
      updateSky(true);
      bus?.emit('time:jump', time.t);
    },
    setDate(str) {
      const d = typeof str === 'string' ? parseDate(str) : (str && str.y ? str : null);
      if (!d) { console.warn(`[time] bad date "${str}" (want YYYY-MM-DD)`); return false; }
      applyDate(d);
      updateSky(true);
      bus?.emit('time:date', { date: time.dateString });
      return true;
    },
    setSpeed(n) { const v = +n; if (Number.isFinite(v)) time.speed = v; },
    pause(on) { time.paused = on === undefined ? !time.paused : !!on; },

    /** t -> { half: 'day'|'night', hour (0..12, fractional), label } using GRA seasonal hours */
    toZmani(t = time.t) {
      const z = time.zmanim;
      const tt = wrap(t);
      if (tt >= z.sunrise && tt < z.sunset) {
        const hour = (tt - z.sunrise) / z.shaahDay;
        return { half: 'day', hour, label: `${ordinal(Math.min(12, Math.floor(hour) + 1))} hour of the day` };
      }
      const hour = wrap(tt - z.sunset) / z.shaahNight;
      return { half: 'night', hour, label: `${ordinal(Math.min(12, Math.floor(hour) + 1))} hour of the night` };
    },
    /** (half, hour) -> t */
    fromZmani(half, hour) {
      const z = time.zmanim;
      return half === 'night' ? wrap(z.sunset + hour * z.shaahNight) : wrap(z.sunrise + hour * z.shaahDay);
    },
    /**
     * spec: number | string (see parse) | { at: anchor, offset? } | { dayHour } | { nightHour } | { clock: 'HH:MM' }
     * Returns minutes in [0,1440), or NaN (with a console warning) for an unknown spec.
     */
    resolve(spec) {
      if (spec == null) return NaN;
      if (typeof spec === 'number') return wrap(spec);
      if (typeof spec === 'string') return time.parse(spec);
      if (spec.at !== undefined) {
        const key = ANCHOR_ALIASES[String(spec.at).toLowerCase().replace(/[_\s-]/g, '')];
        if (!key) { warnOnce(`a:${spec.at}`, `[time] unknown zman anchor "${spec.at}"`); return NaN; }
        return wrap(time.zmanim[key] + (+spec.offset || 0));
      }
      if (spec.dayHour !== undefined) return time.fromZmani('day', +spec.dayHour);
      if (spec.nightHour !== undefined) return time.fromZmani('night', +spec.nightHour);
      if (spec.clock !== undefined) return time.parse(String(spec.clock));
      warnOnce(`s:${JSON.stringify(spec)}`, `[time] cannot resolve time spec ${JSON.stringify(spec)}`);
      return NaN;
    },
    /**
     * URL ?t= forms: "HH:MM[:SS]" (IST) · zman anchor with optional minute offset ("alot-5", "sunrise+30",
     * "sunrise 30" — a '+' arrives as a space from a query string) · seasonal hours "d8.5" / "n11".
     */
    parse(str) {
      const s = String(str ?? '').trim();
      let m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
      if (m) return wrap(+m[1] * 60 + +m[2] + (+m[3] || 0) / 60);
      m = /^([dn])\s*(\d+(?:\.\d+)?)$/i.exec(s);
      if (m) return time.fromZmani(m[1].toLowerCase() === 'n' ? 'night' : 'day', +m[2]);
      m = /^([a-z_]+)\s*(?:([+-]?)\s*(\d+(?:\.\d+)?))?$/i.exec(s);
      if (m) {
        const off = m[3] ? (m[2] === '-' ? -1 : 1) * +m[3] : 0;
        return time.resolve({ at: m[1], offset: off });
      }
      warnOnce(`p:${s}`, `[time] cannot parse time "${s}"`);
      return NaN;
    },
    /** minutes -> "HH:MM" (IST) */
    format(t = time.t) {
      if (!Number.isFinite(t)) return '--:--';
      const tt = wrap(Math.round(t));
      return `${String(Math.floor(tt / 60) % 24).padStart(2, '0')}:${String(tt % 60).padStart(2, '0')}`;
    },
    /** Hebrew date in force at time t (the Hebrew day begins at sunset). */
    hebrewAt(t = time.t) { return wrap(t) >= time.zmanim.sunset ? time.hebrewEvening : time.hebrew; },
    /** advance the clock by dt real seconds (called by the engine loop) */
    tick(dt) {
      if (time.paused || !dt) { time.frameDelta = 0; return; }
      const dm = (dt * time.speed) / 60;
      time.frameDelta = dm;
      time.t = wrap(time.t + dm);
      updateSky(false);
    },
  };

  let lastPlanetMs = -Infinity;

  function applyDate(d) {
    time.date = { ...d };
    time.dateString = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    time.weekday = new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay();
    time.dayType = time.weekday === 5 ? 'friday' : time.weekday === 6 ? 'shabbat' : 'weekday';
    time.zmanim = computeZmanim(d, time.geo);
    time.hebrew = hebrewDate(d);
    const next = new Date(Date.UTC(d.y, d.m - 1, d.d + 1));
    time.hebrewEvening = hebrewDate({ y: next.getUTCFullYear(), m: next.getUTCMonth() + 1, d: next.getUTCDate() });
    lastPlanetMs = -Infinity;
  }

  function updateSky(force) {
    const ms = localMidnightUTC(time.date, time.geo.tzMinutes) + time.t * 60000;
    time.ms = ms;
    const { lat, lon } = time.geo;
    const s = solarPosition(ms, lat, lon);
    const sun = time.sun;
    sun.altitude = s.apparentAltitude; sun.trueAltitude = s.altitude; sun.azimuth = s.azimuth;
    sun.distanceAU = s.distanceAU; sun.ra = s.ra; sun.dec = s.decl;
    worldDir(sun.altitude, sun.azimuth, sun.dir);
    const mo = moonPosition(ms, lat, lon);
    const moon = time.moon;
    moon.altitude = mo.altitude; moon.trueAltitude = mo.trueAltitude; moon.azimuth = mo.azimuth;
    moon.phase = mo.phase; moon.illumination = mo.illumination; moon.phaseAngle = mo.phaseAngle;
    moon.angularRadius = mo.angularRadius; moon.distanceKm = mo.distanceKm; moon.ra = mo.ra; moon.dec = mo.dec;
    moon.illuminanceTOA = moonIlluminanceTOA(mo.phaseAngle, mo.distanceKm);
    worldDir(moon.altitude, moon.azimuth, moon.dir);
    time.lst = localSiderealTime(ms, lon);
    if (force || Math.abs(ms - lastPlanetMs) > 60000) {
      lastPlanetMs = ms;
      time.planets = planetPositions(ms, lat, lon).map((p) => ({ ...p, dir: worldDir(p.altitude, p.azimuth, new Vector3()) }));
    }
  }

  // ---- initial state
  applyDate(parseDate(opts.date) || (opts.date && console.warn(`[time] bad ?date=${opts.date}; using ${DEFAULT_DATE}`), parseDate(DEFAULT_DATE)));
  time.speed = Number.isFinite(opts.speed) ? opts.speed : 1;
  time.paused = !!opts.paused;
  let t0 = opts.t != null && opts.t !== '' ? time.parse(opts.t) : NaN;
  if (!Number.isFinite(t0)) t0 = wrap(time.zmanim.alot + DEFAULT_OFFSET_FROM_ALOT);
  time.t = t0;
  updateSky(true);
  return time;
}

export async function init(ctx) {
  const p = ctx.params;
  const time = createTime(ctx.bus, {
    date: p.date, t: p.t, speed: p.speed ?? 1, paused: !!p.pause || !!p.shot,
  });
  ctx.time = time;
  ctx.engine.onUpdate((dt) => time.tick(dt), PRIORITY.time);
}

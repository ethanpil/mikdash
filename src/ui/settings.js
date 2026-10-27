// ctx.settings = { get(key), set(key, value), all(), defs, define(def), isSet(key) } — persisted as localStorage
// 'mikdash.<key>' (raw strings, so core/quality.js and core/units.js can read 'mikdash.quality' / 'mikdash.amah'
// themselves). Emits bus 'settings:change' { key, value }. Values are cached: other systems call get() per mouse event.
// In screenshot mode (shot=1) stored values are ignored so renders stay deterministic.
// Module settings (console §5) are declared with define({ key: 'module.<id>.<key>', type, values?, min?, max?, default }).

const mq = (q) => { try { return globalThis.matchMedia?.(q).matches || false; } catch { return false; } };

export const PACES = [0.5, 1, 2, 5, 10];

export const SETTING_DEFS = {
  quality: { type: 'enum', values: ['auto', 'low', 'medium', 'high', 'ultra'], def: 'auto', reload: true },
  amah: { type: 'enum', values: ['naeh', 'feinstein', 'chazonish'], def: 'naeh', reload: true },
  volume: { type: 'number', min: 0, max: 1, def: 0.8 },
  captions: { type: 'bool', def: true },
  musicStyle: { type: 'enum', values: ['mishnah', 'sg1612'], def: 'mishnah' },
  mouseSensitivity: { type: 'number', min: 0.2, max: 3, def: 1 },
  invertY: { type: 'bool', def: false },
  fov: { type: 'number', min: 40, max: 95, def: 62 },
  headBob: { type: 'bool', def: (s) => !s.get('reducedMotion') },
  /** shown as "Activity markers" (console §3.6) */
  labels: { type: 'bool', def: true },
  aggadah: { type: 'bool', def: true },
  reducedMotion: { type: 'bool', def: () => mq('(prefers-reduced-motion: reduce)') },
  travelWay: { type: 'enum', values: ['instant', 'walk', 'run'], def: 'walk' },
  travelPace: { type: 'enum-num', values: PACES, def: 1 },
  /** read by the player: 'drag' never requests pointer lock */
  lookMode: { type: 'enum', values: ['lock', 'drag'], def: () => (mq('(pointer: fine)') ? 'lock' : 'drag') },
  quickChips: { type: 'enum', values: ['wake', 'always'], def: 'wake' },
  areaNames: { type: 'enum', values: ['always', 'travel', 'off'], def: 'always' },
  restrictedNotices: { type: 'bool', def: true },
};

/** travelSpeed (before the console) → travelWay + travelPace (console §4.3) */
const SPEED_MIGRATION = {
  instant: ['instant', 1], slow: ['walk', 0.5], walk: ['walk', 1], fast: ['walk', 2], run: ['run', 1],
};

function coerce(def, v) {
  if (v === undefined || v === null) return undefined;
  if (def.type === 'bool') {
    if (typeof v === 'boolean') return v;
    if (v === 'true' || v === '1' || v === 1) return true;
    if (v === 'false' || v === '0' || v === 0) return false;
    return undefined;
  }
  if (def.type === 'number') {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!Number.isFinite(n)) return undefined;
    return Math.min(def.max, Math.max(def.min, n));
  }
  if (def.type === 'enum') return def.values.includes(String(v)) ? String(v) : undefined;
  if (def.type === 'enum-num') { const n = +v; return def.values.includes(n) ? n : undefined; }
  if (def.type === 'select') return def.values.some(([k]) => String(k) === String(v)) ? String(v) : undefined;
  return v;
}

function parseLoose(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? n : raw;
}

export function createSettings(bus, { ignoreStorage = false } = {}) {
  const cache = new Map();
  const defs = { ...SETTING_DEFS };
  const read = (key) => {
    if (ignoreStorage) return null;
    try { return globalThis.localStorage?.getItem(`mikdash.${key}`) ?? null; } catch { return null; }
  };
  const write = (key, value) => {
    if (ignoreStorage) return;
    try { globalThis.localStorage?.setItem(`mikdash.${key}`, String(value)); } catch { /* storage unavailable */ }
  };
  const remove = (key) => { try { globalThis.localStorage?.removeItem(`mikdash.${key}`); } catch { /* ignore */ } };

  // one-time migration of the old travel speed (then it is removed)
  const old = read('travelSpeed');
  if (old !== null) {
    const m = SPEED_MIGRATION[old];
    if (m && read('travelWay') === null) { write('travelWay', m[0]); write('travelPace', m[1]); }
    remove('travelSpeed');
  }

  const settings = {
    defs,
    get(key) {
      if (cache.has(key)) return cache.get(key);
      const def = defs[key];
      const raw = read(key);
      let v;
      if (def) {
        v = coerce(def, raw);
        if (v === undefined) return typeof def.def === 'function' ? def.def(settings) : def.def; // dynamic defaults stay live
      } else v = raw === null ? undefined : parseLoose(raw);
      cache.set(key, v);
      return v;
    },
    set(key, value) {
      const def = defs[key];
      const v = def ? coerce(def, value) : value;
      if (v === undefined) return false;
      const prev = settings.get(key);
      cache.set(key, v);
      write(key, v);
      if (prev !== v) bus?.emit('settings:change', { key, value: v });
      // dependent default: head-bob follows reduced motion until the user sets it explicitly
      if (key === 'reducedMotion' && prev !== v && !cache.has('headBob') && read('headBob') === null) bus?.emit('settings:change', { key: 'headBob', value: !v });
      return true;
    },
    /** is a value stored (vs. a default)? */
    isSet(key) { return read(key) !== null || (cache.has(key) && !defs[key]); },
    all() { return Object.fromEntries(Object.keys(defs).map((k) => [k, settings.get(k)])); },
    /**
     * Declare a setting (modules: key 'module.<id>.<key>'). def: { key, type: 'bool'|'number'|'enum'|'select',
     * values? (enum: strings; select: [[value, label]]), min?, max?, default }. Returns an undefine function; the stored
     * value is kept.
     */
    define(def) {
      if (!def?.key) return () => {};
      const type = def.type === 'toggle' ? 'bool' : def.type || 'bool';
      defs[def.key] = { type, values: def.values, min: def.min ?? 0, max: def.max ?? 1, def: def.default ?? def.def, module: true, ...def, type };
      cache.delete(def.key);
      return () => { if (defs[def.key]?.module) delete defs[def.key]; cache.delete(def.key); };
    },
  };
  return settings;
}

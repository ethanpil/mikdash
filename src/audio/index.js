// Audio system (ARCHITECTURE.md §11): an entirely procedural Web Audio soundscape — no sample files.
//
// ctx.audio = {
//   unlock() → Promise<bool>          resume/create the AudioContext (call from a user gesture; also self-unlocks on any gesture)
//   cue(id, worldPos?, opts) → handle  one-shot; worldPos: Vector3 (world m) | [X,Y,Z] (site amot) | Object3D; omit = non-spatial
//        opts: { gain, levelDb, delay (s), rate, variant, area: {min:[X,Y,Z], max:[X,Y,Z]} | [boxes], follow: Object3D, people,
//                caption (false = no subtitle), psalm, section (0-2), style ('mishnah'|'sg1612'), fluteDay, steps, kind }
//        handle: { stop(fade), setPosition(p), setGain(g), ended: Promise<bool>, duration }
//   loop(id, worldPos?, opts) → { setGain(g, t), setPeople(n), setPosition(p), stop(fade), active }
//   setMaster(v 0..1)
//   tekiahSet(pos, opts)               teki'ah-teru'ah-teki'ah by two trumpeters (Tamid 7:3)
//   libation(opts) → { stop(), done }  the daily concert: 3 × (TaRaT + prostration) each before a psalm section;
//                                      cymbal at the pour (Tamid 7:3-4; Sukkah 5:5 — 9 blasts)
//   ambience: { hush(s), release(), setPopulation(n|null), setLayer(name, g), enabled }
//   state, prefetch(list), stopAll(), cues, loops, captions (bool)
// }
// Bus: listens 'audio:unlock', 'settings:change' {key:'volume'|'captions'|'musicStyle'}, 'time:jump', 'quality:change';
//      emits 'caption' { id, text: {en, he}, duration, pos }, 'audio:state' { state }, 'audio:space' { space, zone }.
import { PRIORITY } from '../core/engine.js';
import { AudioEngine } from './engine.js';
import { Ambience } from './ambience.js';
import { CUE_LIB, LOOP_LIB } from './library.js';
import { PSALM_BY_DAY } from './synth/meta.js';
import { AMAH } from '../core/units.js';

const NOOP_HANDLE = Object.freeze({ id: null, stop() {}, setPosition() {}, setGain() {}, setPeople() {}, ended: Promise.resolve(false), duration: null, active: false });

function noopApi(state) {
  return {
    state, unlock: async () => false, cue: () => NOOP_HANDLE, loop: () => NOOP_HANDLE, setMaster() {}, tekiahSet: () => NOOP_HANDLE,
    libation: () => ({ stop() {}, done: Promise.resolve(false) }), ambience: { hush() {}, release() {}, setPopulation() {}, setLayer() {}, enabled: false },
    prefetch() {}, stopAll() {}, cues: Object.keys(CUE_LIB), loops: Object.keys(LOOP_LIB), captions: false,
  };
}

export async function init(ctx) {
  const params = ctx.params || {};
  const debug = params.debug?.has?.('audio');
  if ((params.audio === false && !debug) || !globalThis.AudioContext) {
    ctx.audio = noopApi(globalThis.AudioContext ? 'disabled' : 'unsupported');
    return;
  }
  const engine = new AudioEngine(ctx);
  const amb = new Ambience(ctx, engine);
  const setting = (k) => { try { return ctx.settings?.get?.(k); } catch { return undefined; } };
  const vol = (v) => (Number.isFinite(+v) ? (+v > 1 ? +v / 100 : +v) : null);

  /** fill in musical options from the clock and settings (id already resolved from any alias) */
  const music = (id, opts) => {
    if (id !== 'choir-psalm' && id !== 'choir') return opts;
    const o = { ...opts };
    if (o.psalm === undefined) {
      const wd = ctx.time?.dayType === 'shabbat' ? 6 : ctx.time?.weekday;
      o.weekday = Number.isInteger(wd) ? wd : 1;
      o.psalm = PSALM_BY_DAY[o.weekday];
    }
    // explicit style always (idempotent: the same options give the same cached render)
    o.style = (o.style ?? setting('musicStyle')) === 'sg1612' ? 'sg1612' : 'mishnah';
    if (!o.fluteDay) delete o.fluteDay; // the chalil plays only on the 12 flute days (Arachin 2:3)
    return o;
  };

  /** pre-render a cue (variant 0, or all its variants) */
  const fetchCue = (id, opts = {}, priority = 2, allVariants = false) => {
    const def = CUE_LIB[id];
    if (!def) return;
    const o = music(id, opts);
    for (let v = 0; v < (allVariants ? def.variants || 1 : 1); v++) engine.renderer.get('cue', id, engine.synthOpts(def, o, v), engine.synthRate, { priority });
  };

  const el = (id) => ctx.elOpt?.(id) || ctx.site?.elements?.[id] || null;
  const center = (id, dz = 0) => { const e = el(id); return e?.box ? [(e.box.min[0] + e.box.max[0]) / 2, (e.box.min[1] + e.box.max[1]) / 2, e.box.max[2] + dz] : null; };

  let unlocking = null;
  const libations = new Set();
  const api = {
    get state() { return engine.ac ? engine.ac.state : 'locked'; },
    async unlock() {
      if (unlocking) return unlocking;
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* Safari only */ }
      unlocking = engine.unlock().then((ok) => {
        unlocking = null;
        if (ok) {
          const v = vol(setting('volume'));
          if (v !== null) engine.setVolume(v);
          amb.start();
          warm(false);
        }
        return ok;
      });
      return unlocking;
    },
    cue(id, pos, opts = {}) { const rid = engine.resolveId(id) || id; return engine.cue(rid, pos, music(rid, opts)) || NOOP_HANDLE; },
    loop(id, pos, opts = {}) { return engine.loop(id, pos, music(id, opts)) || NOOP_HANDLE; },
    setMaster(v) { engine.setVolume(+v || 0); },
    tekiahSet(pos, opts = {}) { return api.cue('trumpet-set', pos ?? center('altar.table.marble', 3), opts); },
    libation: (opts = {}) => libation(opts),
    ambience: {
      hush: (s) => amb.hush(s), release: () => amb.release(), setPopulation: (n) => amb.setPopulation(n), setLayer: (k, g) => amb.setLayer(k, g),
      get enabled() { return amb.enabled; }, set enabled(b) { amb.enabled = !!b; },
    },
    prefetch(list = []) {
      for (const it of list) {
        const [raw, o] = Array.isArray(it) ? it : [it, {}];
        const id = engine.resolveId(raw);
        if (id) fetchCue(id, o || {}, 2); else engine.warnOnce(`cue:${raw}`, `[audio] unknown cue "${raw}"`);
      }
    },
    stopAll: (fade) => engine.stopAll(fade),
    cues: Object.keys(CUE_LIB), loops: Object.keys(LOOP_LIB),
    get captions() { return engine.captionsOn; }, set captions(b) { engine.captionsOn = !!b; },
    engine,
  };
  ctx.audio = api;

  // The daily concert at the wine libation (Tamid 7:3-4). The two kohanim stand on the table of the fats and
  // blow teki'ah-teru'ah-teki'ah; then "they came and stood beside Ben Arza, one on his right and one on his
  // left"; the kohen bends to pour, the segan waves the flags, Ben Arza strikes the cymbal and the Levites sing;
  // "at each section a teki'ah, and at each teki'ah a prostration". Reading chosen: Sukkah 5:5 counts 9 blasts for
  // the tamid = three teki'ah-teru'ah-teki'ah sets, the opening one and one before each later section, every set
  // with the people's prostration (docs/decisions/audio.md).
  function libation(opts = {}) {
    const table = opts.trumpets ?? center('altar.table.marble', 3);
    const duchan = opts.duchan ?? center('azarah.duchan', 3);
    // Ben Arza with the Levites on the duchan; the trumpeters flank him, 1.5 amot to either side (one centred source)
    const benArza = opts.benArza ?? duchan;
    const walk = opts.walk ?? walkSeconds(table, benArza);
    const sg = (opts.style ?? setting('musicStyle')) === 'sg1612';
    const sections = [0, 1, 2];
    const choirOpts = (s) => music('choir-psalm', { ...opts, section: s, style: sg ? 'sg1612' : 'mishnah' });
    const sr = engine.synthRate;
    let stopped = false;
    const handles = [];
    const get = (id, o = {}) => engine.renderer.get('cue', id, engine.synthOpts(CUE_LIB[id], o, 0), sr, { priority: 20 });
    const self = { stop: () => { stopped = true; handles.forEach((h) => h?.stop?.(0.5)); } };
    libations.add(self);
    self.done = (async () => {
      const bufs = await Promise.all([get('trumpet-set'), get('cymbal'), get('crowd-prostrate'), ...sections.map((s) => get('choir-psalm', choirOpts(s)))]);
      if (stopped || !engine.running) return false;
      const set = bufs[0];
      let t = 0;
      for (const s of sections) {
        handles.push(api.cue('trumpet-set', s === 0 ? table : benArza, { delay: t, variant: 0 }));
        handles.push(api.cue('crowd-prostrate', opts.crowd ?? null, { delay: t + set.duration - 2.2, variant: 0, people: opts.people, area: opts.crowd ? undefined : crowdArea() }));
        t += set.duration - 0.2;
        if (s === 0) t += walk; // the trumpeters cross to Ben Arza; the pour
        if (s === 0 || sg) { handles.push(api.cue('cymbal', benArza, { delay: t, variant: 0 })); t += 0.9; }
        handles.push(api.cue('choir-psalm', duchan, { ...choirOpts(s), delay: t }));
        t += bufs[3 + s].duration - 2.6;
      }
      await new Promise((r) => setTimeout(r, t * 1000));
      return !stopped;
    })().finally(() => libations.delete(self));
    return self;
  }
  /** walking time between two site points at the 'walk' pace (1.4 m/s, ARCHITECTURE §12), 4–25 s */
  function walkSeconds(a, b) {
    if (!a || !b) return 8;
    return Math.max(4, Math.min(25, Math.hypot(a[0] - b[0], a[1] - b[1]) * AMAH / 1.4));
  }
  /** where the people prostrate: Ezrat Nashim and Ezrat Yisrael, each at its own floor */
  function crowdArea() {
    const boxes = ['en.floor', 'azarah.ezrat-yisrael'].map((id) => amb.slab(id)).filter(Boolean);
    return boxes.length ? boxes : undefined;
  }

  // ---- pre-rendering (Worker time): what is needed, shortly before it is needed
  /**
   * Beds and the common cues. Medium and up: everything at unlock (all variants of the cues that must start on
   * time), at low priority. Low (phones): only the beds and the sounds of the next scheduled events; the
   * Levites' song is fetched shortly before each libation (scheduled()).
   */
  let warmed = false;
  function warm(early) {
    if (warmed && !early) return;
    if (early && engine.tier === 'low') return;
    if (!early) warmed = true;
    const sr = engine.synthRate, R = engine.renderer;
    for (const [id, o] of amb.bedSpecs()) R.get('loop', id, o, sr, { priority: 4, pin: true });
    if (engine.tier === 'low') { scheduled(true); return; }
    for (const id of ['trumpet-set', 'trumpet-tekiah', 'gate-boom', 'magrefah', 'great-gate-open', 'cymbal', 'barkai', 'gevini', 'shalom-call', 'crowd-prostrate', 'knock', 'muchni']) fetchCue(id, {}, 2, true);
    if (!early) for (const s of [0, 1, 2]) fetchCue('choir-psalm', { section: s }, 1);
  }

  /** the day's libation set: trumpets, cymbal, prostration, the three sections of the psalm of the day */
  function prefetchLibation(priority) {
    for (const id of ['trumpet-set', 'cymbal', 'crowd-prostrate']) fetchCue(id, {}, priority);
    for (const s of [0, 1, 2]) fetchCue('choir-psalm', { section: s }, priority);
  }

  /**
   * Sounds of the scheduled events that start within the next ~5 real minutes (sim minutes scaled by the clock
   * speed); at unlock also the next three events' sounds. With no schedule data yet, low still gets the song
   * once, at idle priority, a minute after unlock.
   */
  let unlockedAt = 0, idleSong = false;
  function scheduled(atUnlock = false) {
    const time = ctx.time, sched = ctx.schedule;
    if (!engine.running || !time) return;
    if (atUnlock) unlockedAt = performance.now();
    const events = sched?.events;
    if (!Array.isArray(events) || !events.length) {
      if (engine.tier === 'low' && !idleSong && performance.now() - unlockedAt > 60000) { idleSong = true; prefetchLibation(0); }
      return;
    }
    const unwrap = (r) => (r?.event && !r.id ? r.event : r);
    let active = [], upcoming = [];
    try {
      active = (sched.active?.(time.t) || []).map(unwrap).filter(Boolean);
      upcoming = (sched.upcoming?.(time.t, 8) || []).map(unwrap).filter(Boolean);
    } catch { return; }
    const speed = time.paused ? 0 : Math.max(0, time.speed ?? 1);
    const ahead = Math.min(720, Math.max(3, 5 * speed)); // sim minutes in the next 5 real minutes
    let n = 0;
    for (const ev of [...active, ...upcoming]) {
      const t0 = Number.isFinite(ev.t0) ? ev.t0 : time.resolve?.(ev.when?.start);
      const mins = Number.isFinite(t0) ? (((t0 - time.t) % 1440) + 1440) % 1440 : 0;
      const soon = active.includes(ev) || mins <= ahead;
      for (const raw of ev.sounds || []) {
        const id = engine.resolveId(raw);
        if (!id) continue;
        if (id === 'choir-psalm') { if (soon) prefetchLibation(2); continue; }
        if (soon || (atUnlock && n < 3)) fetchCue(id, {}, soon ? 3 : 1, engine.tier !== 'low');
      }
      n++;
    }
  }

  // any user gesture (re)starts sound: the first unlock, and recovery after an iOS/Safari interruption
  // ('interrupted' / 'suspended' after a call or an app switch only resumes inside a gesture)
  const gesture = () => { if (!engine.ac || (engine.ac.state !== 'running' && !engine.hidden)) api.unlock(); };
  for (const t of ['pointerdown', 'keydown', 'touchend']) addEventListener(t, gesture, { capture: true, passive: true });
  ctx.bus.on('audio:unlock', () => api.unlock());
  document.addEventListener('visibilitychange', () => engine.setHidden(document.hidden));
  ctx.bus.on('settings:change', (e) => {
    if (e?.key === 'volume') { const v = vol(e.value); if (v !== null) engine.setVolume(v); }
    if (e?.key === 'captions') engine.captionsOn = e.value !== false;
  });
  let schedTimer = 0;
  ctx.bus.on('time:jump', () => {
    for (const l of [...libations]) l.stop();
    engine.stopAll(0.6);
    schedTimer = 0;
  });
  ctx.bus.on('quality:change', () => {
    const key = ctx.quality?.key;
    if (!key || key === engine.tier) return;
    engine.setTier(key);
    if (engine.running) { warmed = false; warm(false); }
  });
  ctx.bus.on('ready', () => setTimeout(() => warm(true), 4000));

  ctx.engine.onUpdate((dt) => {
    engine.update(dt);
    amb.update(dt);
    schedTimer -= dt;
    if (schedTimer <= 0) { schedTimer = 10; scheduled(); }
  }, PRIORITY.audio);

  if (debug) {
    const { installDebug } = await import('./debug.js');
    installDebug(ctx, engine, amb);
  }
}

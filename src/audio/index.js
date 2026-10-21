// Audio system (ARCHITECTURE.md §11): an entirely procedural Web Audio soundscape — no sample files.
//
// ctx.audio = {
//   unlock() → Promise<bool>          resume/create the AudioContext (call from a user gesture; also self-unlocks on any gesture)
//   cue(id, worldPos?, opts) → handle  one-shot; worldPos: Vector3 (world m) | [X,Y,Z] (site amot) | Object3D; omit = non-spatial
//        opts: { gain, levelDb, delay (s), rate, variant, area: {min:[X,Y,Z], max:[X,Y,Z]} | [boxes], follow: Object3D, people,
//                caption (false = no subtitle), psalm, song (+ week), section (0-2), style ('mishnah'|'sg1612'), fluteDay,
//                steps, kind, offset (s into the buffer), captionHeading (false), catchUp (false) }
//        handle: { stop(fade), setPosition(p), setGain(g), ended: Promise<bool>, duration }
//   loop(id, worldPos?, opts) → { setGain(g, t), setPeople(n), setPosition(p), stop(fade), active }
//        'choir': the section's buffer on its own clock (opts.offset); its verses captioned only with opts.caption: true
//   setMaster(v 0..1)
//   tekiahSet(pos, opts)               teki'ah-teru'ah-teki'ah by two trumpeters (Tamid 7:3)
//   libation(opts) → { stop(), done, timeline, started: Promise<{ perf (ms), sim (min) } | null> (when t = 0 sounds) }
//                                      the concert: 3 × (TaRaT + prostration) each before a section of the song;
//                                      cymbal at the pour (Tamid 7:3-4; Sukkah 5:5 — 9 blasts). opts.psalm | opts.song:
//                                      'haazinu-1'…'haazinu-6' (Shabbat musaf), 'az-yashir' | 'mi-chamocha' |
//                                      'az-yashir-yisrael' (Shabbat afternoon) — Rosh HaShanah 31a; or song 'haazinu' |
//                                      'shirah' with week
//   libationTimeline(opts) → the concert's schedule in seconds (timeline.js), as libation(opts) would play it here
//   sectionTiming(opts, section) → one sung section's duration and verse times
//   prefetchLibation(opts)             render the concert's sounds ahead (the song is minutes of audio); kept from
//                                      eviction for opts.holdS (default 600 s)
//   ambience: { hush(s), release(), setPopulation(n|null), setLayer(name, g), enabled }
//   state, prefetch(list), stopAll(), cues, loops, captions (bool)
// }
// Bus: listens 'audio:unlock', 'settings:change' {key:'volume'|'captions'|'musicStyle'}, 'time:jump', 'quality:change';
//      emits 'caption' { id, text: {en, he}, duration, pos, verse? ('Ps 24:1' — a sung verse) }, 'audio:state' { state },
//      'audio:space' { space, zone }.
// Module exports (pure, usable without ctx.audio, e.g. in node): libationTimeline, sectionTiming, sectionLyrics, D_SET,
// SET_BLASTS, SONGS, songId, resolveSong, shabbatSong, sectionVerses (src/audio/timeline.js, songs.js).
import { PRIORITY } from '../core/engine.js';
import { AudioEngine } from './engine.js';
import { Ambience } from './ambience.js';
import { CUE_LIB, LOOP_LIB } from './library.js';
import { PSALM_BY_DAY } from './synth/meta.js';
import { AMAH } from '../core/units.js';
import { libationTimeline, sectionTiming } from './timeline.js';
import { SONGS, resolveSong, shabbatSong, shabbatWeek } from './songs.js';

export { libationTimeline, sectionTiming, sectionLyrics, D_SET, SET_BLASTS } from './timeline.js';
export { SONGS, songId, resolveSong, shabbatSong, sectionVerses } from './songs.js';

const NOOP_HANDLE = Object.freeze({ id: null, stop() {}, setPosition() {}, setGain() {}, setPeople() {}, ended: Promise.resolve(false), duration: null, active: false });

function noopApi(state, ctx) {
  const C = concert(ctx, (k) => { try { return ctx.settings?.get?.(k); } catch { return undefined; } });
  return {
    state, unlock: async () => false, cue: () => NOOP_HANDLE, loop: () => NOOP_HANDLE, setMaster() {}, tekiahSet: () => NOOP_HANDLE,
    libation: (o = {}) => ({ stop() {}, done: Promise.resolve(false), started: Promise.resolve(null), timeline: libationTimeline(C.opts(o)) }), ambience: { hush() {}, release() {}, setPopulation() {}, setLayer() {}, enabled: false },
    prefetch() {}, prefetchLibation() {}, stopAll() {}, cues: Object.keys(CUE_LIB), loops: Object.keys(LOOP_LIB), captions: false,
    // the concert's clock is still there to stage by with sound off
    libationTimeline: (o = {}) => libationTimeline(C.opts(o)), sectionTiming: (o = {}, s) => sectionTiming(C.music(o), s ?? o.section ?? 0),
  };
}

/**
 * The concert's places and options from the site, the clock and the settings: where the trumpets, Ben Arza and the
 * Levites stand, how long the trumpeters' walk takes, and which song is sung today.
 */
function concert(ctx, setting) {
  const el = (id) => ctx.elOpt?.(id) || ctx.site?.elements?.[id] || null;
  const center = (id, dz = 0) => { const e = el(id); return e?.box ? [(e.box.min[0] + e.box.max[0]) / 2, (e.box.min[1] + e.box.max[1]) / 2, e.box.max[2] + dz] : null; };
  /** walking time between two site points at the 'walk' pace (1.4 m/s, ARCHITECTURE §12), 4–25 s */
  const walkSeconds = (a, b) => (!a || !b ? 8 : Math.max(4, Math.min(25, Math.hypot(a[0] - b[0], a[1] - b[1]) * AMAH / 1.4)));
  const warned = new Set();
  /** musical options: the psalm of the day unless a psalm or song is given; the style setting */
  const music = (opts = {}) => {
    const o = { ...opts };
    if (o.song !== undefined && o.song !== null) {
      // a cycle named without its week ('haazinu', 'shirah'): this Shabbat's part of it, counted as shabbatSong() counts
      const id = resolveSong(o.song, Number.isInteger(o.week) ? o.week : shabbatWeek(o.date ?? ctx.time?.date)), S = SONGS[id];
      if (!S) { if (!warned.has(o.song)) { warned.add(o.song); console.warn(`[audio] unknown song "${o.song}" — the psalm of the day is sung`); } delete o.song; }
      else if (S.kind === 'psalm') { o.psalm = S.psalm; delete o.song; } else { o.song = id; delete o.psalm; delete o.weekday; }
      delete o.week; delete o.date;
    }
    // tempo 1 is the default: left out, so it is one cache entry with a cue that does not name it
    if (!(o.tempo > 0) || +o.tempo === 1) delete o.tempo; else o.tempo = +o.tempo;
    if (o.psalm === undefined && o.song === undefined) {
      const wd = Number.isInteger(o.weekday) ? o.weekday : ctx.time?.dayType === 'shabbat' ? 6 : ctx.time?.weekday;
      o.psalm = PSALM_BY_DAY[wd] ?? PSALM_BY_DAY[1];
    }
    // the psalm or song is resolved: the weekday selects nothing more, and left in it would give the same section a
    // second cache key (the scheduler's prefetch without a psalm vs a choreography's cue that names it)
    delete o.weekday;
    o.style = (o.style ?? setting('musicStyle')) === 'sg1612' ? 'sg1612' : 'mishnah';
    return o;
  };
  const places = (opts = {}) => {
    const table = opts.trumpets ?? center('altar.table.marble', 3);
    const duchan = opts.duchan ?? center('azarah.duchan', 3);
    // Ben Arza with the Levites on the duchan; the trumpeters flank him, 1.5 amot to either side (one centred source)
    const benArza = opts.benArza ?? duchan;
    return { table, duchan, benArza, walk: opts.walk ?? walkSeconds(table, benArza) };
  };
  return { music, places, center, opts: (o = {}) => ({ ...music(o), walk: places(o).walk }) };
}

export async function init(ctx) {
  const params = ctx.params || {};
  const debug = params.debug?.has?.('audio');
  if ((params.audio === false && !debug) || !globalThis.AudioContext) {
    ctx.audio = noopApi(globalThis.AudioContext ? 'disabled' : 'unsupported', ctx);
    return;
  }
  const engine = new AudioEngine(ctx);
  const amb = new Ambience(ctx, engine);
  const setting = (k) => { try { return ctx.settings?.get?.(k); } catch { return undefined; } };
  const vol = (v) => (Number.isFinite(+v) ? (+v > 1 ? +v / 100 : +v) : null);
  const C = concert(ctx, setting);

  /** fill in musical options from the clock and settings (id already resolved from any alias) */
  const music = (id, opts) => {
    if (id !== 'choir-psalm' && id !== 'choir') return opts;
    const o = C.music(opts); // psalm or song, and an explicit style always (the same options give the same cached render)
    if (!o.fluteDay) delete o.fluteDay; // the chalil plays only on the 12 flute days (Arachin 2:3)
    return o;
  };

  /** pre-render a cue (variant 0, or all its variants; a sung section verse by verse, as it plays); hold:
   *  performance.now() ms until which it is not evicted */
  const fetchCue = (id, opts = {}, priority = 2, allVariants = false, hold = 0) => {
    const def = CUE_LIB[id];
    if (!def) return;
    const o = music(id, opts);
    if (def.lyrics) { engine.fetchSection(o, { priority, hold }); return; }
    for (let v = 0; v < (allVariants ? def.variants || 1 : 1); v++) engine.renderer.get('cue', id, engine.synthOpts(def, o, v), engine.rateFor(id), { priority, hold });
  };
  /** how long a fetched concert is kept from eviction when nothing says when it ends (real ms) */
  const HOLD_MS = 600000;
  const center = C.center;

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
    cue(id, pos, opts = {}) {
      const rid = engine.resolveId(id) || id, o = music(rid, opts);
      // a section is cued: the song's later sections render now, in the background, whichever song the caller chose
      // (the scheduler's prefetch is a guess; on Shabbat it fetches only the opening sections)
      if (rid === 'choir-psalm' && engine.running) for (let s = Math.max(0, o.section | 0) + 1; s < 3; s++) fetchCue(rid, { ...o, section: s }, 3, false, performance.now() + HOLD_MS);
      return engine.cue(rid, pos, o) || NOOP_HANDLE;
    },
    loop(id, pos, opts = {}) { return engine.loop(id, pos, music(id, opts)) || NOOP_HANDLE; },
    setMaster(v) { engine.setVolume(+v || 0); },
    tekiahSet(pos, opts = {}) { return api.cue('trumpet-set', pos ?? center('altar.table.marble', 3), opts); },
    libation: (opts = {}) => libation(opts),
    /** the concert's schedule (s from the first blast) exactly as libation(opts) plays it here (same defaults) */
    libationTimeline: (opts = {}) => libationTimeline(C.opts(opts)),
    /** one section's timing: { duration, singEnd, verses: [{ key, ref, he, en, t0, t1 }], heading } */
    sectionTiming: (opts = {}, section) => sectionTiming(C.music(opts), section ?? opts.section ?? 0),
    /** render a concert's sounds ahead of time (opts as libation; default: the psalm of the day), kept from eviction for
     *  opts.holdS real seconds (default 600) */
    prefetchLibation: (opts = {}, priority = 2) => prefetchLibation(priority, opts, performance.now() + (Number.isFinite(opts.holdS) ? opts.holdS * 1000 : HOLD_MS)),
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
  // with the people's prostration (docs/decisions/audio.md). Every moment comes from libationTimeline (timeline.js),
  // so a choreography staging by the timeline sees what is heard. opts.gap: a pause after section 1 / 2.
  function libation(opts = {}) {
    const P = C.places(opts);
    const base = music('choir-psalm', { ...opts, walk: undefined, gap: undefined });
    const T = libationTimeline({ ...base, walk: P.walk, gap: opts.gap });
    const choirOpts = (s) => ({ ...base, section: s });
    let stopped = false, startedResolve;
    const handles = [];
    // every part is kept from eviction until the concert is over (the render wait is a few seconds)
    const hold = performance.now() + (T.done + 120) * 1000;
    const get = (id, o = {}, priority = 20) => engine.renderer.get('cue', id, engine.synthOpts(CUE_LIB[id], o, 0), engine.rateFor(id), { priority, hold });
    const sing = (s, priority) => engine.fetchSection(choirOpts(s), { priority, hold });
    // started: when t = 0 (the first blast) sounds — { perf: performance.now() ms, sim: ctx.time.t (min) } — or null
    const started = new Promise((r) => { startedResolve = r; });
    const self = { stop: () => { stopped = true; handles.forEach((h) => h?.stop?.(0.5)); }, timeline: T, started };
    libations.add(self);
    self.done = (async () => {
      // the blasts and the first verse must be ready: the rest of the song renders verse by verse during the 15–40 s of
      // the first set, the walk and the pour (a verse that is late joins in progress)
      const first = [get('trumpet-set'), get('cymbal'), get('crowd-prostrate'), sing(0, 20)[0]];
      [1, 2].forEach((s) => sing(s, 19 - s)); // queued behind section 1 (same lane)
      await Promise.all(first);
      if (stopped || !engine.running) return false;
      // every part is ready (or joins in progress): each cue is placed at its delay from now, so t = 0 is now
      startedResolve({ perf: performance.now(), sim: Number.isFinite(ctx.time?.t) ? ctx.time.t : null });
      for (const c of T.cues) {
        if (c.id === 'trumpet-set') handles.push(api.cue('trumpet-set', c.at === 'table' ? P.table : P.benArza, { delay: c.t, variant: 0 }));
        else if (c.id === 'crowd-prostrate') handles.push(api.cue('crowd-prostrate', opts.crowd ?? null, { delay: c.t, variant: 0, people: opts.people, area: opts.crowd ? undefined : crowdArea() }));
        else if (c.id === 'cymbal') handles.push(api.cue('cymbal', P.benArza, { delay: c.t, variant: 0 }));
        else handles.push(api.cue('choir-psalm', P.duchan, { ...choirOpts(c.opts.section), delay: c.t }));
      }
      await new Promise((r) => setTimeout(r, T.done * 1000));
      return !stopped;
    })().finally(() => { libations.delete(self); startedResolve(null); });
    return self;
  }
  /** where the people prostrate: Ezrat Nashim and Ezrat Yisrael, each at its own floor */
  function crowdArea() {
    const boxes = ['en.floor', 'azarah.ezrat-yisrael'].map((id) => amb.slab(id)).filter(Boolean);
    return boxes.length ? boxes : undefined;
  }

  // ---- pre-rendering (Worker time): what is needed, shortly before it is needed
  /**
   * Beds and the common cues. Medium and up: everything at unlock (all variants of the cues that must start on
   * time), at low priority. Low (phones): only the beds and the sounds of the next scheduled events. Every tier: the
   * opening of the day's song at idle priority, and the whole concert shortly before each libation (scheduled()).
   */
  let warmed = false;
  function warm(early) {
    if (warmed && !early) return;
    if (early && engine.tier === 'low') return;
    if (!early) warmed = true;
    const sr = engine.synthRate, R = engine.renderer;
    for (const [id, o] of amb.bedSpecs()) R.get('loop', id, o, sr, { priority: 4, pin: true });
    // the opening of the day's song at idle priority, in the otherwise idle music Worker (started by it): on medium and
    // up the first section, as before audio-2; on low its first verse. A jump to the song then finds it ready.
    // scheduled() fetches the whole concert a few real minutes before it is due.
    if (!early) engine.fetchSection(music('choir-psalm', { section: 0 }), { priority: 0, first: engine.tier === 'low' ? 1 : Infinity });
    if (engine.tier === 'low') { scheduled(true); return; }
    for (const id of ['trumpet-set', 'trumpet-tekiah', 'gate-boom', 'magrefah', 'great-gate-open', 'cymbal', 'barkai', 'gevini', 'shalom-call', 'crowd-prostrate', 'knock', 'muchni']) fetchCue(id, {}, 2, true);
  }

  /**
   * A libation set: trumpets, cymbal, prostration and the song's sections (default: all three of the psalm of the day),
   * kept from eviction until `hold` (performance.now() ms) — a concert is up to ~25 MB at 32 kHz, more than a low-tier
   * cache holds beside the beds, and must not be evicted between its prefetch and its moment.
   */
  function prefetchLibation(priority, opts = {}, hold = performance.now() + HOLD_MS, sections = [0, 1, 2]) {
    for (const id of ['trumpet-set', 'cymbal', 'crowd-prostrate']) fetchCue(id, {}, priority, false, hold);
    for (const s of sections) fetchCue('choir-psalm', { ...opts, section: s }, priority, false, hold);
  }
  /**
   * What an event's concert will sing: [[opts, sections]]. Shabbat musaf / afternoon: Ha'azinu's section / the Shirah
   * of the week (shabbatSong) — but the choreographies (G3, G6) still sing Psalm 92 there as a stand-in, so only the
   * opening section of each is fetched ahead; the rest of whichever is cued follows on (api.cue). Otherwise the psalm of
   * the day, whole.
   */
  function songsFor(ev) {
    const id = ev?.id || '';
    const service = ctx.time?.dayType === 'shabbat' && ctx.time?.date ? (/musaf/.test(id) ? 'musaf' : /afternoon/.test(id) ? 'afternoon' : null) : null;
    if (service) return [[{}, [0]], [{ song: shabbatSong(service, ctx.time.date) }, [0]]];
    return [[{}, [0, 1, 2]]];
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
        if (id === 'choir-psalm') {
          if (!soon) continue;
          // kept until the event is over (real seconds at the clock's speed; re-held every 10 s while it is due)
          const t1 = Number.isFinite(ev.t1) ? ev.t1 : time.resolve?.(ev.when?.end);
          const toEnd = Number.isFinite(t1) ? (((t1 - time.t) % 1440) + 1440) % 1440 : 30;
          const hold = performance.now() + (Math.min(1800, speed > 0 ? (toEnd * 60) / speed : 1800) + 120) * 1000;
          for (const [o, sections] of songsFor(ev)) prefetchLibation(2, o, hold, sections);
          continue;
        }
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

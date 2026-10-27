// Search (docs/console-design.md §4.4, §6.3.2): createSearch(ctx) → one index over places, things, the day's rites and
// the live offerings, offering types, roles and words; the UI adds its Learn, Help, settings and command documents and
// the modules' through search.add(). Cheap to create: the documents are prepared in idle slices (≤ 8 ms each) after the
// first frame (the UI loads this module then), re-prepared for the rites on time:date. query() is synchronous.
// objects.js and people-info.js are optional (import.meta.glob): without them things are named from the site model and
// roles from the people roles.
import { createEngine } from './engine.js';
import { placeDocs, thingDocs, riteDocs, dynamicDocs, offeringDocs, roleDocs, wordDocs } from './sources.js';
import { ZONE_CONTENT } from '../data/zones-content.js';
import { SITE, zoneAtSite } from '../data/site.js';
import { EVENTS } from '../data/schedule.js';
import { OFFERING_TYPES } from '../data/offerings.js';
import { GLOSSARY } from '../data/glossary.js';
import { AMAH } from '../core/units.js';

const OPTIONAL = import.meta.glob(['../data/objects.js', '../data/people-info.js']);
const SLICE_MS = 8;

/** the UI's "recent" selections (console/search.js keeps them on this device): a small boost */
function readRecent() {
  try { return (JSON.parse(localStorage.getItem('mikdash.recent') || '[]') || []).map((r) => r?.id).filter(Boolean); } catch { return []; }
}

const idle = (fn) => (typeof requestIdleCallback === 'function'
  ? requestIdleCallback(fn, { timeout: 3000 })
  : setTimeout(() => fn({ timeRemaining: () => SLICE_MS, didTimeout: false }), 30));

export function createSearch(ctx) {
  const engine = createEngine({
    ctx,
    amah: AMAH,
    recent: readRecent,
    // the aggadah layer off: its rites are not found either
    filter: (d) => !(d.layer === 'aggadah' && ctx.settings?.get?.('aggadah') === false),
  });
  let resolveReady;
  const ready = new Promise((r) => { resolveReady = r; });
  let pumping = false, loaded = false;
  const stats = { slices: 0, ms: 0 };

  function pump(deadline) {
    const left = deadline?.timeRemaining?.();
    const budget = Math.max(2, Math.min(SLICE_MS, Number.isFinite(left) && left > 0 ? left : SLICE_MS));
    const t0 = performance.now();
    let done = false;
    try { done = engine.build(budget); } catch (e) { console.error('[search] build failed', e); done = true; }
    stats.slices++; stats.ms += performance.now() - t0;
    if (done && loaded) { pumping = false; resolveReady(); return; }
    idle(pump);
  }
  const kick = () => { if (!pumping) { pumping = true; idle(pump); } };

  // ---- the built-in sources ----
  const time = ctx.time;
  engine.add({ kind: 'place', label: { en: 'Places' }, docs: () => placeDocs({ ZONE_CONTENT, SITE }) });
  engine.add({ kind: 'rite', label: { en: 'Rites' }, dated: true, docs: () => riteDocs({ events: ctx.schedule?.events || [], EVENTS, SITE, ZONE_CONTENT, time }) });
  // the live offerings: asked again at most every 0.5 s of real time or 0.1 sim min (a burst of keystrokes reuses them)
  let dyn = null, dynAt = -1e9, dynT = NaN;
  engine.add({
    kind: 'rite', label: { en: 'Offerings now' }, live: true,
    docs: () => {
      const now = performance.now(), t = time?.t;
      if (!dyn || now - dynAt > 500 || !(Math.abs(t - dynT) < 0.1)) {
        dyn = dynamicDocs({ schedule: ctx.schedule, time, OFFERING_TYPES, SITE });
        dynAt = now; dynT = t;
      }
      return dyn;
    },
  });
  engine.add({ kind: 'offering', label: { en: 'Offerings' }, docs: () => offeringDocs({ OFFERING_TYPES }) });
  engine.add({ kind: 'word', label: { en: 'Words' }, docs: () => wordDocs({ GLOSSARY }) });
  kick();
  // the optional content modules: things and roles once they are known (feature-detected)
  (async () => {
    const opt = async (path) => { try { return OPTIONAL[path] ? await OPTIONAL[path]() : null; } catch (e) { console.warn(`[search] ${path} not loaded`, e); return null; } };
    const [objects, people] = await Promise.all([opt('../data/objects.js'), opt('../data/people-info.js')]);
    let roles = null;
    if (!people?.ROLES_INFO) { try { roles = (await import('../people/roles.js')).ROLES; } catch { /* none */ } }
    engine.add({ kind: 'thing', label: { en: 'Things' }, docs: () => thingDocs({ SITE, OBJECTS: objects?.OBJECTS || null, ZONE_CONTENT, zoneAtSite }) });
    engine.add({ kind: 'role', label: { en: 'People' }, docs: () => roleDocs({ ROLES_INFO: people?.ROLES_INFO || null, ROLES: roles, GLOSSARY }) });
    loaded = true;
    kick();
  })();

  // a new date: that day's rites
  ctx.bus?.on?.('time:date', () => { engine.invalidate((s) => s.dated); kick(); });

  return {
    /** resolves when the built-in sources are indexed */
    ready,
    /** source: { kind, label: { en }, docs: Doc[] | (ctx) => Doc[], live?: boolean } → remove() */
    add(src) {
      const off = engine.add(src);
      if (!src?.live) kick();
      return off;
    },
    /** Result[] best first; opts { scope?: kind | kind[], limit = 40, boost?: { kinds?, near?: [X, Y], zone?, recent? } } */
    query: (q, opts) => engine.query(q, opts),
    /** re-prepare every static source (the bus does it for the rites on time:date) */
    rebuild() { engine.invalidate(); kick(); },
    /** { he, latin, skeleton, layoutSwapped } */
    normalize: (q) => engine.normalize(q),
    /** build cost so far: { slices, ms } */
    get stats() { return { ...stats }; },
  };
}

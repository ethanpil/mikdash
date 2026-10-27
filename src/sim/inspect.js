// The inspect core (console-design §6.2): click or tap anyone or anything to learn what it is, what it is doing and
// why, and "see it in action". Installed by sim/index.js as ctx.inspect (not in shot mode unless ?inspect=1).
//
//   ctx.inspect = {
//     pick(clientX, clientY, opts?) -> Hit | null        CPU pick (inspect-pick.js); opts { tolerancePx = 8, maxDist = 150 }
//     pickCenter(opts?) -> Hit | null                    at the free area's centre (the reticle)
//     hover(clientX, clientY) -> { ref, label, kind } | null    cached per 2 px / 100 ms
//     describe(subject, t?) -> Card                      a Hit, a ref object { kind, id } or 'kind:id' (inspect-describe.js)
//     anchorOf(ref) -> Vector3 | null                    a live world point (feet / base centre) for the ring and framing
//     nearby(r = 15, { limit = 12 }?) -> NearbyItem[]    subjects near the observer, nearest first, with bearing words
//     thingsIn(zoneId) -> ThingItem[]                    the objects with content in a place
//     setViewInset({ left, right, top, bottom })         the console's free area (px from each edge)
//     frame(subject, { ms = 400 }?) -> Promise           turn the view to put the subject at the free area's centre
//     follow(subject | null)                             keep turning toward it until look / move input
//     seeInAction(action) -> ShowHandle                  run a card's see-in-action action (inspect-show.js)
//     run(steps, { label }) -> ShowHandle                director steps (tours, narration)
//     show, back(), canBack, backLabel                   the current show; restore the last show's Return snapshot
//     ready: Promise                                     the describer and its content are loaded (after 'firstFrame')
//   }
// The describer and its content (objects.js, people-info.js, the glossary) load in idle time after the first frame, so
// the cold boot does not carry them; until then describe() returns a short card from the pick's label.
import { createPicker, parseRef } from './inspect-pick.js';
import { createDirector } from './inspect-show.js';

const HOVER_PX = 2, HOVER_MS = 100;

export function createInspect(ctx, { schedule, runtime, zones }) {
  const picker = createPicker(ctx, { runtime, zones });
  const inset = { left: 0, right: 0, top: 0, bottom: 0 };
  let desc = null;           // the describer once loaded
  let readyResolve;
  const ready = new Promise((r) => { readyResolve = r; });
  let loading = null;
  function load() {
    if (loading) return loading;
    loading = import('./inspect-describe.js').then(async (m) => {
      const o = await import('../data/objects.js');
      picker.setObjects(o.OBJECTS);
      desc = m.createDescriber(ctx, { schedule, runtime, zones, picker, director });
      readyResolve(api);
      return desc;
    }).catch((e) => { console.error('[inspect] describer failed to load', e); readyResolve(api); return null; });
    return loading;
  }
  const idle = (f) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 2000 }) : setTimeout(f, 200));
  ctx.bus.on('firstFrame', () => idle(() => load()));

  // the director reads where things are through the describer (null until it is loaded)
  const view = {
    get viewInset() { return inset; },
    locate: (choreo, key, target) => desc?.locate(choreo, key, target) ?? null,
    anchorOf: (ref) => desc?.anchorOf(ref) ?? null,
    heightOf: (ref) => desc?.heightOf?.(ref) ?? 0,
  };
  const director = createDirector(ctx, { schedule, runtime, inspect: view });

  // figure labels: the short 'Role · doing' from the describer once it is loaded (the pick's pose verb until then),
  // cached per figure for a second (describing one costs ~0.1 ms; a hover re-asks at 10 Hz)
  const labels = new Map();
  ctx.bus.on('time:jump', () => labels.clear());
  ctx.bus.on('time:date', () => labels.clear());
  function relabel(h) {
    if (!h || !desc?.labelOf) return h;
    if (h.kind === 'person' || h.kind === 'animal') {
      const now = performance.now();
      let c = labels.get(h.ref);
      if (!c || now - c.at > 1000) {
        let l = null;
        try { l = desc.labelOf(h.ref); } catch { l = null; }
        if (labels.size > 400) labels.clear();
        labels.set(h.ref, c = { l, at: now });
      }
      if (c.l) h.label = c.l;
    }
    if (h.alternatives) h.alternatives.forEach(relabel);
    return h;
  }

  // hover cache
  let hx = -1e9, hy = -1e9, ht = -1e9, hres = null;
  function hover(x, y) {
    const now = performance.now();
    // at most 10 Hz; a pointer resting within 2 px keeps its answer a while longer (figures move: 3 × as long)
    const still = Math.abs(x - hx) <= HOVER_PX && Math.abs(y - hy) <= HOVER_PX;
    if (now - ht < (still ? 3 * HOVER_MS : HOVER_MS)) return hres;
    hx = x; hy = y; ht = now;
    const h = relabel(picker.pick(x, y));
    hres = h && h.kind !== 'place' ? { ref: h.ref, label: h.label, kind: h.kind } : null;
    return hres;
  }
  function center() {
    const r = ctx.renderer?.domElement?.getBoundingClientRect?.() || { left: 0, top: 0, width: globalThis.innerWidth || 1, height: globalThis.innerHeight || 1 };
    const w = Math.max(1, r.width - inset.left - inset.right), h = Math.max(1, r.height - inset.top - inset.bottom);
    return { x: r.left + inset.left + w / 2, y: r.top + inset.top + h / 2 };
  }

  function shortCard(subject) {
    const r = parseRef(subject?.ref ? subject.ref : subject);
    const kind = subject?.kind && !/^(actor|el|zone|crowd|fire)$/.test(subject.kind) ? subject.kind : ({ actor: 'person', el: 'object', zone: 'place', fire: 'object' })[r?.kind] || r?.kind;
    return { ref: r, kind, title: subject?.label || { en: r?.id || '' }, now: null, why: null, what: null, who: null, sources: [], actions: [], loading: true };
  }

  const api = {
    pick: (x, y, opts) => relabel(picker.pick(x, y, { ...opts })),
    pickCenter: (opts) => { const c = center(); return relabel(picker.pick(c.x, c.y, { ...opts })); },
    hover,
    describe(subject, t) {
      if (!desc) { load(); return shortCard(subject); }
      return desc.describe(subject, t);
    },
    anchorOf: (ref) => (desc ? desc.anchorOf(ref) : null),
    nearby: (r = 15, opts) => (desc ? desc.nearby(r, opts || {}) : []),
    thingsIn: (zoneId) => (desc ? desc.thingsIn(zoneId) : []),
    setViewInset(v = {}) {
      inset.left = +v.left || 0; inset.right = +v.right || 0; inset.top = +v.top || 0; inset.bottom = +v.bottom || 0;
    },
    get viewInset() { return { ...inset }; },
    frame: (subject, opts) => director.frame(subject, opts),
    follow: (subject) => director.follow(subject),
    seeInAction: (action) => director.seeInAction(action),
    run: (steps, opts) => director.run(steps, opts || {}),
    get show() { return director.show; },
    back: () => director.back(),
    get canBack() { return director.canBack; },
    get backLabel() { return director.backLabel; },
    ready,
    /** load the describer now (tests; a pick before the idle load does it too) */
    load,
    // debug / tests
    get picker() { return picker; },
    get describer() { return desc; },
  };
  return api;
}

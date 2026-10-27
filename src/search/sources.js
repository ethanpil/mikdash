// The built-in search sources (docs/console-design.md §6.3.2): places (ZONE_CONTENT), things (site elements of the
// pickable kinds plus objects.js titles and aka), the day's rites and the occasional ones, the live offerings in
// progress or coming (dynamic schedule events), offering types, roles and words (the glossary). Everything comes from the
// data modules handed in, so the same code runs in the app (index.js) and in node (dev/searchtest.mjs).
// Doc ids are the subject refs of §6.0: zone:, el:, fire:, event:, offering:, role:, term:.

/** the kinds of site element a person can point at (§6.2), and how much a match on each counts */
const THING_KINDS = { fixture: 1, curtain: 1, opening: 1, gate: 1, stair: 1, ramp: 1, chamber: 1, slab: 0.75, wall: 0.75 };
const first = (s, sep = ' — ') => (s == null ? s : String(s).split(sep)[0]);
const rest = (s, sep = ' — ') => { const i = String(s ?? '').indexOf(sep); return i >= 0 ? String(s).slice(i + sep.length) : null; };
const center = (box) => (box ? [(box.min[0] + box.max[0]) / 2, (box.min[1] + box.max[1]) / 2, box.min[2]] : null);
const words = (s, n) => String(s ?? '').split(/[\s,;:.()—–"“”]+/, n + 1).filter(Boolean).slice(0, n);
/** define a property computed on first read (zones and subtitles: only the documents shown or boosted need them) */
const lazy = (o, key, fn) => {
  Object.defineProperty(o, key, {
    enumerable: true, configurable: true,
    get() { const v = fn(); Object.defineProperty(o, key, { value: v, enumerable: true, writable: true }); return v; },
  });
  return o;
};
const oneLine = (s, n = 110) => { const t = String(s ?? '').split(/(?<=[.;])\s/)[0]; return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/** a zone's short English name ("The Azarah — the Temple court" → "The Azarah") */
export function zoneName(content, id) {
  return first(content?.[id]?.name?.en) || id;
}

/**
 * The zone a place sits in, one level up: of the zones whose boxes hold the place's stand (or box centre), the one
 * zoneAtSite would pick if the place itself were not there.
 */
function parentZone(SITE, id, p) {
  if (!p) return null;
  let best = null, bp = -Infinity, bv = Infinity;
  for (const [zid, z] of Object.entries(SITE.zones || {})) {
    if (zid === id) continue;
    for (const [mn, mx] of z.boxes || []) {
      if (p[0] < mn[0] || p[0] > mx[0] || p[1] < mn[1] || p[1] > mx[1] || p[2] + 0.4 < mn[2] || p[2] + 0.4 > mx[2]) continue;
      const v = (mx[0] - mn[0]) * (mx[1] - mn[1]) * (mx[2] - mn[2]);
      if (z.priority > bp || (z.priority === bp && v < bv)) { best = zid; bp = z.priority; bv = v; }
    }
  }
  return best;
}

export function placeDocs({ ZONE_CONTENT, SITE }) {
  const out = [];
  for (const [id, z] of Object.entries(ZONE_CONTENT || {})) {
    const n = z.name || {};
    const box = SITE?.zones?.[id]?.boxes?.[0];
    const p = Array.isArray(z.stand) ? z.stand : box ? [(box[0][0] + box[1][0]) / 2, (box[0][1] + box[1][1]) / 2, box[0][2]] : null;
    const d = {
      id: `zone:${id}`, kind: 'place',
      title: { en: first(n.en) || id, he: n.he },
      translit: n.translit,
      // the full name, its English descriptor, and the id (the ids are transliterations: "nikanor", "beit-hamoked")
      aka: [n.en, rest(n.en), id.replace(/-/g, ' ')].filter(Boolean),
      at: p, zone: id,
    };
    lazy(d, 'subtitle', () => { const parent = SITE ? parentZone(SITE, id, p) : null; return { en: parent ? zoneName(ZONE_CONTENT, parent) : rest(n.en) || '' }; });
    out.push(d);
  }
  return out;
}

export function thingDocs({ SITE, OBJECTS = null, ZONE_CONTENT = null, zoneAtSite = null }) {
  const out = [];
  const O = OBJECTS || {};
  const zoneOf = (o, p) => o?.zone || (p && zoneAtSite ? zoneAtSite(p[0], p[1], p[2] + 0.4) : null);
  const doc = (ref, o, el) => {
    const p = center(el?.box) || center(o?.pickBoxes?.[0]);
    const title = o?.title || el?.name || { en: ref };
    const aka = [...(o?.aka || [])];
    if (el?.name?.en && el.name.en !== title.en) aka.push(el.name.en);
    if (el?.name?.he && el.name.he !== title.he) aka.push(el.name.he);
    const d = {
      id: ref, kind: 'thing', title: { en: title.en, he: title.he }, aka,
      keywords: [o?.glossary, el?.kind].filter(Boolean),
      at: p,
      weight: (THING_KINDS[el?.kind] ?? 1) * (o ? 1 : 0.85),
    };
    lazy(d, 'zone', () => zoneOf(o, p));
    lazy(d, 'subtitle', () => ({ en: d.zone ? zoneName(ZONE_CONTENT, d.zone) : '' }));
    return d;
  };
  for (const [id, el] of Object.entries(SITE?.elements || {})) {
    if (!(el.kind in THING_KINDS)) continue;
    out.push(doc(`el:${id}`, O[id], el));
  }
  // things objects.js names that are no single site element (the shofarot chests, the fires)
  for (const [id, o] of Object.entries(O)) {
    if (SITE?.elements?.[id]) continue;
    out.push(doc(id.startsWith('fire:') ? id : `el:${id}`, o, null));
  }
  return out;
}

/** a schedule event's site position [X, Y, Z] ([X,Y,Z] or { el, f } on a site element) */
function eventAt(SITE, ev) {
  const p = ev?.pos;
  if (Array.isArray(p)) return p;
  if (p?.el && SITE?.elements?.[p.el]?.box) return center(SITE.elements[p.el].box);
  return null;
}

/**
 * The day's rites (ctx.schedule.events; their windows are resolved by the schedule) plus the occasional ones (EVENTS
 * with dayTypes 'occasional' that the day does not stage), flagged. `when` is live: the clock decides `active`.
 */
export function riteDocs({ events = [], EVENTS = [], SITE = null, ZONE_CONTENT = null, time = null }) {
  const out = [];
  const seen = new Set();
  const make = (ev, occasional) => {
    const d = {
      id: `event:${ev.id}`, kind: 'rite', title: { en: ev.title?.en || ev.id, he: ev.title?.he },
      keywords: [zoneName(ZONE_CONTENT, ev.zone), ev.zone, ev.choreo, occasional ? 'occasional' : null].filter(Boolean),
      subtitle: { en: occasional ? 'Occasional' : zoneName(ZONE_CONTENT, ev.zone) },
      at: eventAt(SITE, ev), zone: ev.zone, weight: occasional ? 0.9 : 1,
    };
    if (occasional) d.occasional = true;
    Object.defineProperty(d, 'when', { enumerable: true, get: () => when(ev, time) });
    Object.defineProperty(d, 'layer', { enumerable: false, value: ev.layer });
    return d;
  };
  for (const ev of events) { if (ev?.id == null || seen.has(ev.id)) continue; seen.add(ev.id); out.push(make(ev, false)); }
  for (const ev of EVENTS) {
    if (ev?.id == null || seen.has(ev.id) || !(ev.dayTypes || []).includes('occasional')) continue;
    seen.add(ev.id);
    out.push(make(ev, true));
  }
  return out;
}

/** { t0, t1, active } of an event at the clock's time (cyclic windows), or null */
function when(ev, time) {
  const t0 = ev.t0, t1 = ev.t1;
  if (!Number.isFinite(t0) || !Number.isFinite(t1)) return null;
  const t = time?.t;
  const active = Number.isFinite(t) && (t0 <= t1 ? t >= t0 && t < t1 : t >= t0 || t < t1);
  return { t0, t1, active };
}

/** the live offerings: in progress now, and the next ones (the schedule's dynamic sources) */
export function dynamicDocs({ schedule, time, OFFERING_TYPES = null, SITE = null }) {
  if (!schedule?.dynamic) return [];
  const t = time?.t;
  const list = [...(schedule.dynamic(t) || [])];
  try { for (const ev of schedule.upcoming?.(t, 40, { dynamic: true }) || []) if (ev?.dynamic) list.push(ev); } catch { /* optional */ }
  const out = [];
  const seen = new Set();
  for (const ev of list) {
    if (!ev?.id || seen.has(ev.id)) continue;
    seen.add(ev.id);
    const T = OFFERING_TYPES?.[ev.offering];
    const d = {
      id: `event:${ev.id}`, kind: 'rite',
      title: { en: ev.title?.en || ev.typeName?.en || ev.id, he: ev.title?.he || ev.typeName?.he },
      translit: T?.names?.translit,
      keywords: [ev.typeName?.en, T?.names?.en, T?.names?.he, ev.offering, ev.parentTitle?.en, ev.summary, 'offering', 'individual'].filter(Boolean),
      at: Array.isArray(ev.pos) ? ev.pos : eventAt(SITE, ev), zone: ev.zone, weight: 0.95,
    };
    Object.defineProperty(d, 'when', { enumerable: true, get: () => when(ev, time) });
    Object.defineProperty(d, 'layer', { enumerable: false, value: ev.layer });
    out.push(d);
  }
  return out;
}

export function offeringDocs({ OFFERING_TYPES }) {
  return Object.entries(OFFERING_TYPES || {}).map(([id, o]) => ({
    id: `offering:${id}`, kind: 'offering',
    title: { en: first(o.names?.en, ' (') || id, he: o.names?.he },
    translit: o.names?.translit,
    aka: [o.names?.en, id.replace(/-/g, ' ')].filter(Boolean),
    keywords: [o.category, o.form, 'offering', 'korban'].filter(Boolean),
    subtitle: { en: o.category || '' },
  }));
}

/** roles: ROLES_INFO (people-info.js) when present, else the people roles named through the glossary */
export function roleDocs({ ROLES_INFO = null, ROLES = null, GLOSSARY = {} }) {
  const out = [];
  if (ROLES_INFO) {
    for (const [id, r] of Object.entries(ROLES_INFO)) {
      const g = r.glossary ? GLOSSARY[r.glossary] : null;
      out.push({
        id: `role:${id}`, kind: 'role', title: { en: r.title?.en || id, he: r.title?.he },
        translit: g?.translit, aka: [...(g?.aka || []), r.glossary, id.replace(/_/g, ' ')].filter(Boolean),
        keywords: ['person', 'people', 'who'], subtitle: { en: oneLine(r.who?.en, 90) },
      });
    }
    return out;
  }
  for (const id of Object.keys(ROLES || {})) {
    const key = id.split('_')[0];
    const g = GLOSSARY[key] || GLOSSARY[id.replace(/_/g, ' ')];
    out.push({
      id: `role:${id}`, kind: 'role', title: { en: g?.translit ? g.translit[0].toUpperCase() + g.translit.slice(1) : id.replace(/_/g, ' '), he: g?.he },
      aka: [...(g?.aka || []), id.replace(/_/g, ' ')], keywords: ['person', 'people'],
    });
  }
  return out;
}

export function wordDocs({ GLOSSARY }) {
  return Object.entries(GLOSSARY || {}).map(([key, g]) => ({
    id: `term:${key}`, kind: 'word',
    title: { en: g.translit || key, he: g.he },
    translit: g.translit,
    aka: [key, ...(g.aka || [])],
    keywords: [words(g.en, 12).join(' ')],
    subtitle: { en: oneLine(g.en) },
  }));
}

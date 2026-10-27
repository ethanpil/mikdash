// Cards (console §6.2 Card): ctx.inspect.describe(ref) when the inspect core is installed; else (or when it returns
// nothing) the UI's own describer, built only from the existing data: zone content, the schedule, the glossary, the
// offering types and the site elements. Honest content: only sourced text, no invented individuals; less when unsourced.
import { clock, wrap, accessLead } from '../format.js';
import { LADDER } from '../data.js';
import { AMAH } from '../../core/units.js';

/** 'kind:id' | { kind, id } → { kind, id } (the id is everything after the first colon) */
export function parseRef(ref) {
  if (!ref) return null;
  if (typeof ref === 'object') {
    if (ref.ref) return parseRef(ref.ref); // a Hit or a Card
    return ref.kind ? { kind: ref.kind, id: String(ref.id) } : null;
  }
  const i = String(ref).indexOf(':');
  return i > 0 ? { kind: ref.slice(0, i), id: ref.slice(i + 1) } : null;
}
export const refStr = (r) => (r ? `${r.kind}:${r.id}` : '');

/** people roles: names for the role card and participants (singular, plural, glossary key) */
export const ROLE_NAMES = {
  kohen: ['Kohen', 'kohanim', 'kohen'], kohen_offduty: ['Kohen (off duty)', 'kohanim', 'kohen'], kohen_elder: ['Elder of the beit av', 'elders of the beit av', 'kohen'],
  kohen_gadol: ['Kohen Gadol', 'Kohanim Gedolim', 'kohen gadol'], kohen_gadol_white: ['Kohen Gadol (in white)', 'Kohanim Gedolim', 'kohen gadol'],
  segan: ['Segan', 'seganim', 'segan'], levi: ['Levite', 'Levites', 'levi'], levi_boy: ['Levite boy', 'Levite boys', 'levi'], guard_levi: ['Levite guard', 'Levite guards', 'levi'],
  israelite: ['Israelite', 'Israelites', 'yisrael'], woman: ['Woman', 'women', null], elder: ['Elder', 'elders', null], sanhedrin: ['Judge of the Sanhedrin', 'judges of the Sanhedrin', 'sanhedrin'],
  nazir: ['Nazir', 'nezirim', 'nazir'], child: ['Child', 'children', null], officer: ['Officer', 'officers', null],
};
export function participantText(p) {
  const [one, many] = ROLE_NAMES[p.role] || [p.role.replace(/_/g, ' '), `${p.role.replace(/_/g, ' ')}s`];
  const who = p.count ? `${p.count} ${p.count === 1 ? one.toLowerCase() : many}` : many[0].toUpperCase() + many.slice(1);
  return p.note ? `${who} — ${p.note}` : who;
}

const CONF = { explicit: 'explicit', derived: 'explicit', locked: 'explicit', ordering: 'ordering', reconstruction: 'reconstruction' };
const para = (s) => String(s || '').split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);

export function createDescriber(app) {
  const { ctx, data } = app;
  let seenIn = null; // term key -> refs (built once)

  function describe(subject, t = ctx.time?.t) {
    const r = parseRef(subject);
    if (!r) return null;
    // the inspect core first, for everything it knows
    if (ctx.inspect?.describe && !['learn', 'help', 'setting', 'cmd'].includes(r.kind)) {
      try {
        const c = ctx.inspect.describe(subject?.ref && subject.kind ? subject : refStr(r), t);
        if (c) return c;
      } catch (e) { warnOnce('describe', e); }
    }
    try {
      switch (r.kind) {
        case 'zone': return place(r.id, t);
        case 'event': return event(r.id, t);
        case 'term': return term(r.id);
        case 'offering': return offering(r.id);
        case 'role': return role(r.id, t);
        case 'el': return object(r.id);
        default: return null;
      }
    } catch (e) { warnOnce(`fallback ${r.kind}`, e); return null; }
  }
  const warned = new Set();
  function warnOnce(k, e) { if (warned.has(k)) return; warned.add(k); console.error(`[ui] ${k}`, e); }

  // ---------------- place ----------------
  function place(id) {
    const z = data.zone(id);
    if (!z) return null;
    const n = z.name || {};
    const r = data.rung(id);
    const sections = [];
    if (z.access) sections.push({ id: 'access', title: { en: 'Who may enter' }, lead: { en: accessLead(z.access) }, text: { en: z.access } });
    const services = Array.isArray(z.services) ? z.services : (z.services ? [z.services] : []);
    if (services.length) sections.push({ id: 'services', title: { en: 'What is done here' }, items: services.map((s) => ({ text: { en: typeof s === 'string' ? s : (s.en || s.title || '') } })) });
    if (z.description) sections.push({ id: 'about', title: { en: 'About' }, text: { en: z.description } });
    const levels = app.mapModel?.()?.otherLevels?.(id) || [];
    if (levels.length) sections.push({ id: 'levels', title: { en: 'Also here' }, refs: levels.map((o) => `zone:${o}`) });
    const stand = data.point(z.stand);
    const actions = [];
    if (z.stand !== null && (stand || app.mapModel?.()?.get(id))) {
      const p = stand || (() => { const m = app.mapModel().get(id); return [m.anchor?.[0] ?? (m.main[0][0] + m.main[1][0]) / 2, m.anchor?.[1] ?? (m.main[0][1] + m.main[1][1]) / 2, m.floorZ]; })();
      actions.push({ id: 'go', kind: 'go', label: { en: 'Go to this place' }, target: { at: Number.isFinite(p[2]) ? [p[0], p[1], p[2]] : [p[0], p[1]] }, goLabel: { en: n.en || id } });
    }
    actions.push({ id: 'map', kind: 'map', label: { en: 'Map' }, zone: id });
    return {
      ref: { kind: 'zone', id }, kind: 'place',
      title: { en: n.en || id, he: n.he }, translit: n.translit && !String(n.en || '').toLowerCase().includes(String(n.translit).toLowerCase()) ? n.translit : undefined,
      subtitle: r !== null ? { en: `Sanctity of ${LADDER[r].en.replace(/^The /, 'the ')}` } : undefined,
      rung: r,
      now: null,
      why: null, what: null, who: null,
      standless: z.stand === null,
      sections,
      sources: z.sources || [],
      confidence: CONF[z.confidence] || undefined, confidenceNote: z.confidenceNote,
      zone: id,
      actions,
    };
  }

  // ---------------- event ----------------
  function findEvent(id) {
    try { const e = ctx.schedule?.byId?.(id); if (e) return e; } catch { /* fall through */ }
    return data.events().find((e) => e.id === id) || null;
  }
  function eventNow(ev, t) {
    const r = data.times(ev);
    if (!r) return null;
    if (data.isActive(ev, t)) return { text: { en: `Now · ${Math.max(1, Math.round(wrap(r.t1 - t)))} min left` }, eventId: ev.id, progress: data.progress(ev, t), until: r.t1 };
    const d = wrap(r.t0 - t);
    return { text: { en: d < 60 ? `In ${Math.max(1, Math.round(d))} min, at ≈ ${clock(r.t0)}` : `At ≈ ${clock(r.t0)}–${clock(r.t1)}` }, eventId: ev.id, progress: 0 };
  }
  function event(id, t) {
    const ev = findEvent(id);
    if (!ev) return null;
    const r = data.times(ev);
    const zn = data.zone(ev.zone)?.name?.en || '';
    const sections = [];
    if (ev.summary) sections.push({ id: 'summary', text: { en: ev.summary } });
    if (ev.description) sections.push({ id: 'description', title: { en: 'What happens' }, text: { en: ev.description } });
    const parts = (ev.participants || []).filter((p) => p?.role);
    if (parts.length) sections.push({ id: 'who', title: { en: 'Who' }, items: parts.map((p) => ({ text: { en: participantText(p) }, ref: ROLE_NAMES[p.role] ? `role:${p.role}` : null })) });
    if (ev.timing?.note) sections.push({ id: 'timing', title: { en: 'Timing' }, text: { en: ev.timing.note } });
    if (ev.offerings?.length) sections.push({ id: 'offerings', title: { en: 'Offerings' }, refs: ev.offerings.map((o) => `offering:${o}`) });
    // an individual's offering at its step: the group of the same parent
    if (!ev.dynamic) {
      const inst = data.active(t).filter((e) => e.dynamic && e.parent === ev.id);
      if (inst.length) sections.push({ id: 'instances', title: { en: `Individual offerings now · ${inst.length}` }, refs: inst.map((e) => `event:${e.id}`) });
    }
    const actions = [];
    const target = data.viewTarget(ev);
    if (target) actions.push({ id: 'go', kind: 'go', label: { en: 'Go and watch' }, target, goLabel: { en: ev.title?.en || ev.id }, eventId: ev.id });
    if (r) actions.push({ id: 'time', kind: 'time', label: { en: `Set clock to start · ≈ ${clock(r.t0)}` }, tSet: r.t0 + 0.25, eventId: ev.id });
    if (ev.zone) actions.push({ id: 'map', kind: 'map', label: { en: 'Map' }, zone: ev.zone, eventId: ev.id });
    return {
      ref: { kind: 'event', id: ev.id }, kind: 'event',
      title: { en: ev.typeName?.en && ev.dynamic ? `${ev.typeName.en}` : (ev.title?.en || ev.id), he: ev.title?.he },
      subtitle: { en: [zn, r ? `≈ ${clock(r.t0)}–${clock(r.t1)}` : ''].filter(Boolean).join(' · ') },
      now: eventNow(ev, t),
      why: null, what: null, who: null,
      sections,
      sources: ev.sources || [],
      confidence: ev.timing?.confidence, confidenceNote: ev.timing?.note,
      importance: ev.importance || 1, layer: ev.layer,
      zone: ev.zone, at: data.eventPos(ev) || undefined,
      actions,
      event: ev,
    };
  }

  // ---------------- term ----------------
  function buildSeenIn() {
    seenIn = new Map();
    const G = app.content.glossary;
    if (!G) return;
    const keys = Object.entries(G).map(([k, v]) => [k, [k, ...(v.aka || [])].filter((s) => s && s.length >= 4).map((s) => s.toLowerCase())]);
    const scan = (ref, text) => {
      const low = String(text || '').toLowerCase();
      if (!low) return;
      for (const [k, words] of keys) {
        if (!words.some((w) => low.includes(w))) continue;
        if (!seenIn.has(k)) seenIn.set(k, []);
        const l = seenIn.get(k);
        if (!l.includes(ref) && l.length < 12) l.push(ref);
      }
    };
    for (const id of Object.keys(ctx.zones?.content || {})) { const z = ctx.zones.content[id]; scan(`zone:${id}`, `${z.name?.en} ${z.description || ''} ${(z.services || []).join(' ')}`); }
    for (const ev of data.events()) scan(`event:${ev.id}`, `${ev.title?.en} ${ev.summary || ''}`);
  }
  function term(key) {
    const G = app.content.glossary;
    const g = G?.[key];
    if (!g) return null;
    if (!seenIn) buildSeenIn();
    const tr = g.translit || key;
    return {
      ref: { kind: 'term', id: key }, kind: 'term',
      title: { en: tr[0].toUpperCase() + tr.slice(1), he: g.he },
      subtitle: g.aka?.length ? { en: `Also: ${g.aka.slice(0, 5).join(', ')}` } : undefined,
      now: null, why: null, who: null,
      what: { text: { en: g.en }, sources: g.sources || [] },
      sections: seenIn.get(key)?.length ? [{ id: 'seen', title: { en: 'Seen in' }, refs: seenIn.get(key) }] : [],
      sources: g.sources || [],
      actions: [],
    };
  }

  // ---------------- offering ----------------
  function offering(id) {
    const o = app.content.offerings?.[id];
    if (!o) return null;
    const ST = app.content.stations || {};
    const sections = [];
    if (o.broughtBy) sections.push({ id: 'who', title: { en: 'Who brings it' }, text: { en: o.broughtBy } });
    if (o.occasions?.length) sections.push({ id: 'occasions', title: { en: 'When' }, items: o.occasions.map((s) => ({ text: { en: s } })) });
    if (o.steps?.length) {
      sections.push({
        id: 'steps', title: { en: 'The steps' },
        items: o.steps.filter((s) => s && s.label).map((s) => {
          const at = Array.isArray(s.at) ? s.at[0] : s.at;
          const zone = ST[at]?.zone;
          return { text: { en: typeof s.label === 'string' ? s.label : (s.label.en || '') }, ref: zone ? `zone:${zone}` : null, sources: s.sources };
        }),
      });
    }
    if (o.frequency?.lo != null) sections.push({ id: 'freq', title: { en: 'How many' }, text: { en: `${o.frequency.lo}–${o.frequency.hi} ${o.frequency.unit || ''} (an estimate for this model)`.trim() } });
    if (o.notes) sections.push({ id: 'notes', title: { en: 'Notes' }, text: { en: o.notes } });
    const actions = [];
    const live = data.active(ctx.time?.t).find((e) => e.dynamic && (e.type === id || e.offering === id || String(e.id).includes(`:${id}:`)));
    if (live) {
      const target = data.viewTarget(live);
      if (target) actions.push({ id: 'go', kind: 'go', label: { en: 'Go and watch one' }, target, goLabel: { en: live.title?.en || o.names.en }, eventId: live.id });
    }
    return {
      ref: { kind: 'offering', id }, kind: 'offering',
      title: { en: o.names?.en || id, he: o.names?.he }, translit: o.names?.translit,
      subtitle: o.category ? { en: o.category } : undefined,
      now: live ? { text: { en: `Now: ${live.summary || live.title?.en || ''}` }, eventId: live.id } : null,
      why: null, who: null, what: null,
      sections,
      sources: o.sources || [],
      actions,
    };
  }

  // ---------------- role ----------------
  function role(id, t) {
    const info = app.content.rolesInfo?.[id];
    const names = ROLE_NAMES[id];
    const g = names?.[2] ? app.content.glossary?.[names[2]] : null;
    if (!info && !names) return null;
    const now = data.active(t).filter((e) => (e.participants || []).some((p) => p.role === id));
    const sections = [];
    if (info?.attire) sections.push({ id: 'attire', title: { en: 'Dress' }, text: { en: info.attire.en }, sources: info.attire.sources });
    if (now.length) sections.push({ id: 'now', title: { en: 'Where they are now' }, refs: now.slice(0, 8).map((e) => `event:${e.id}`) });
    const who = info?.who ? { text: { en: info.who.en }, sources: info.who.sources || [] } : g ? { text: { en: g.en }, sources: g.sources || [] } : null;
    return {
      ref: { kind: 'role', id }, kind: 'role',
      title: { en: info?.title?.en || names?.[0] || id, he: info?.title?.he || g?.he },
      now: null, why: null, what: null,
      who,
      sections,
      sources: [...(who?.sources || []), ...(info?.attire?.sources || [])],
      actions: [],
    };
  }

  // ---------------- object (site element) ----------------
  function object(id) {
    const e = ctx.elOpt?.(id) || ctx.site?.elements?.[id];
    if (!e) return null;
    const b = e.box;
    const measures = [];
    if (b) {
      const dx = b.max[0] - b.min[0], dy = b.max[1] - b.min[1], dz = b.max[2] - b.min[2];
      const m = (a) => Math.round(a * AMAH * 10) / 10;
      const r1 = (a) => Math.round(a * 10) / 10;
      measures.push({ label: { en: 'East–west' }, amot: r1(dx), m: m(dx), confidence: e.confidence });
      measures.push({ label: { en: 'North–south' }, amot: r1(dy), m: m(dy), confidence: e.confidence });
      if (dz > 0.05) measures.push({ label: { en: 'Height' }, amot: r1(dz), m: m(dz), confidence: e.confidence });
    }
    const c = b ? [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2]] : null;
    const zone = c ? ctx.zones?.atSite?.(c[0], c[1], c[2] + 0.5) : null;
    const actions = [];
    if (zone) actions.push({ id: 'map', kind: 'map', label: { en: 'Map' }, zone });
    return {
      ref: { kind: 'el', id }, kind: 'object',
      title: { en: e.name?.en || id, he: e.name?.he },
      subtitle: zone ? { en: data.zone(zone)?.name?.en?.split(' — ')[0] || '' } : undefined,
      now: null, why: null, who: null,
      what: null,
      measures,
      sections: e.notes ? [{ id: 'notes', title: { en: 'Notes' }, text: { en: e.notes } }] : [],
      sources: e.sources || [],
      confidence: CONF[e.confidence], zone, at: c || undefined,
      actions,
    };
  }

  /** a short title for a ref (chips, results) without building its card */
  function titleOf(ref) {
    const r = parseRef(ref);
    if (!r) return '';
    switch (r.kind) {
      case 'zone': return (data.zone(r.id)?.name?.en || r.id).split(' — ')[0];
      case 'event': { const e = findEvent(r.id); return e ? (e.dynamic && e.typeName?.en ? e.typeName.en : e.title?.en || r.id) : r.id; }
      case 'term': { const g = app.content.glossary?.[r.id]; return g ? (g.translit || r.id) : r.id; }
      case 'offering': return app.content.offerings?.[r.id]?.names?.en || r.id;
      case 'role': return app.content.rolesInfo?.[r.id]?.title?.en || ROLE_NAMES[r.id]?.[0] || r.id;
      case 'el': return (ctx.elOpt?.(r.id) || ctx.site?.elements?.[r.id])?.name?.en || r.id;
      default: return r.id;
    }
  }

  return { describe, titleOf, parseRef, refStr, place, event, paragraphs: para };
}

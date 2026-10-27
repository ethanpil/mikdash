// Card data for every kind of subject (console-design §4.1 step 4, §6.2 "Describing …"): one source of cards for the
// console — person, animal, crowd, object, place, event, offering, term and role. Content comes only from sourced data:
// the choreos' describe hooks, src/data/people-info.js, src/data/objects.js, the schedule, the zones content, the
// offerings and the glossary. Where nothing sourced exists, the card shows less.
//
//   createDescriber(ctx, { schedule, runtime, zones, picker, director }) -> {
//     describe(subject, t?) -> Card, anchorOf(ref) -> Vector3|null, nearby(r, {limit}) -> NearbyItem[],
//     thingsIn(zoneId) -> ThingItem[], locate(choreo, subjectKey, target) -> Vector3|null, actorOf(ref) -> {entry,pool,slot,index}|null,
//     hookCoverage -> per-module counts (tests)
//   }
import { Vector3 } from 'three';
import { m2w, w2m, AMAH } from '../core/units.js';
import { SITE, zoneGeometry } from '../data/site.js';
import { OBJECTS, ALIASES as OBJECT_ALIASES } from '../data/objects.js';
import { ROLES_INFO, ANIMALS_INFO, PROPS_INFO, ROLE_PARTICIPANTS } from '../data/people-info.js';
import { GLOSSARY } from '../data/glossary.js';
import { OFFERING_TYPES, STATIONS } from '../data/offerings.js';
import { parseRef, parseActorId, roleTitle, animalTitle, poseVerb } from './inspect-pick.js';
import { momentActions, hhmm } from './inspect-show.js';

const DAY = 1440;
const wrap = (t) => ((t % DAY) + DAY) % DAY;
const since = (t, t0) => wrap(t - t0);
const within = (t, a, b) => (a <= b ? t >= a && t < b : t >= a || t < b);
const dur = (m) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} h${r ? ` ${r}` : ''}` : `${r} min`; };
const uniq = (a) => [...new Set(a.filter(Boolean))];
const textOf = (x) => (x == null ? '' : typeof x === 'string' ? x : (x.en || ''));
const lang = (x) => (x == null ? null : typeof x === 'string' ? { en: x } : x);
const NEAR_KINDS = new Set(['fixture', 'curtain', 'opening', 'gate', 'stair', 'ramp', 'slab']);
const where = (words, d) => (d < 1.5 ? 'here' : `${words}, ${Math.round(d)} m`);
const BOXLESS = new Set(['wall', 'slab', 'floor', 'zone', 'ledge']);
const KIND_NAME = { fixture: 'fixture', gate: 'gate', chamber: 'chamber', curtain: 'curtain', stair: 'stair', ramp: 'ramp', opening: 'opening', slab: 'slab', wall: 'wall', floor: 'floor' };

// a short doing for a label: the clause before the first dash, comma or semicolon (no parentheses), at most `max` chars
const LC_FIRST = /^(?:[A-Z][a-z]*ing|In|At|On|With|Through|Between|Done|Led|Up|Down|Out|Into|From|To|Back|Asleep|Awake|Standing|Sitting|Lying|Kneeling|Waiting|Returning|Going|Coming|Getting|Bringing|Carrying)/;
export function shortDoing(text, max = 30) {
  let s = String(text || '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  const lead = s.match(/^(Getting ready|On the way|Coming in|Led in|Going back) — (.+)$/);
  if (!lead) s = s.split(' — ')[0];
  for (const sep of lead ? ['; ', ', '] : [' — ', '; ', ', ', ': ']) {
    if (s.length <= max) break;
    const i = s.indexOf(sep);
    if (i >= 8) s = s.slice(0, i);
  }
  if (s.length > max) s = `${s.slice(0, max - 1).replace(/[\s,;:—-]+\S*$/, '')}…`;
  return LC_FIRST.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}
/** 'Role · doing', at most 40 characters */
export function shortLabel(title, doing) {
  const t = String(title || '');
  const d = shortDoing(doing, Math.max(14, 40 - t.length - 3));
  return { en: d ? `${t} · ${d}` : t };
}

export function createDescriber(ctx, { schedule, runtime, zones, picker, director }) {
  const time = ctx.time;
  const warned = new Set();
  const warnOnce = (k, ...a) => { if (warned.has(k)) return; warned.add(k); console.warn(...a); };
  const coverage = {};              // per module: { hook, fallback }
  const content = zones?.content || {};
  const hb = content['har-habayit']?.sanctity;
  const rungOf = (s) => (Number.isFinite(s) ? Math.max(0, Math.min(10, Math.round(hb === 3 || hb == null ? s : s - 1))) : null);
  let SCALE = null;
  import('../data/zones-content.js').then((m) => { SCALE = m.SANCTITY_SCALE || null; }).catch(() => {});

  // ------------------------------------------------------------------------------------- figures
  function actorOf(id) {
    const a = parseActorId(id);
    if (!a) return null;
    const entry = runtime?.choreo?.(a.choreo);
    if (!entry) return null;
    const pool = entry.pools.find((p) => p.name === a.pool);
    const slot = pool?.slots?.[a.index];
    return slot ? { entry, pool, slot, index: a.index } : null;
  }
  function crowdOf(id) {
    const [choreo, ci] = String(id).split(':');
    const entry = runtime?.choreo?.(choreo);
    const c = entry?.crowds?.[+ci];
    return c ? { entry, crowd: c, index: +ci } : null;
  }
  function whoOf(x) {
    const spec = x.pool.spec || {};
    return {
      kind: spec.animal ? 'animal' : 'person', poolName: x.pool.name, index: x.index, slot: x.slot,
      role: spec.animal ? undefined : (x.slot.actor?.role || spec.role), animal: spec.animal || undefined,
    };
  }
  /** the choreo hook's description of a figure, or null */
  function hook(entry, who, t) {
    const fn = entry?.mod?.describe;
    if (typeof fn !== 'function' || !entry.inited) return null;
    try { return fn(ctx, entry.state, who, t, entry.sim) || null; } catch (e) { warnOnce(`hook:${entry.id}`, `[inspect] ${entry.id}.describe failed`, e); return null; }
  }
  /** the fallback: the choreo's event active at t nearest to the figure */
  function fallback(entry, who, t) {
    const pos = who.slot?.pos || who.crowd?.pos || null;
    let best = null, bd = Infinity;
    for (const ev of entry?.events || []) {
      if (!Number.isFinite(ev.t0) || !within(t, ev.t0, ev.t1)) continue;
      const p = pos ? schedule.positionOf(ev) : null;
      const d = p && pos ? p.distanceTo(pos) : 0;
      if (d < bd) { bd = d; best = ev; }
    }
    if (best) {
      return {
        doing: { en: `Taking part in: ${best.title?.en || best.id}` }, eventId: best.id,
        step: { id: best.id, label: best.title, t0: best.t0, t1: best.t1 },
        why: best.summary ? { en: textOf(best.summary), sources: best.sources || [] } : null,
      };
    }
    return { doing: { en: who.kind === 'animal' ? 'Waiting' : 'Between duties' } };
  }
  function describeFigure(entry, who, t) {
    const r = hook(entry, who, t);
    const c = (coverage[entry.id] ||= { hook: 0, fallback: 0 });
    if (r && r.doing) { c.hook++; return { ...r, hooked: true }; }
    c.fallback++;
    return { ...fallback(entry, who, t), hooked: false };
  }

  /** a figure's live world point (feet) */
  function figurePos(slot, target = new Vector3()) {
    if (!slot?.actor || !(slot.shown || slot.want || slot._wantPrev) || !slot.placed) return null;
    return target.copy(slot.actor.object3D.position);
  }

  /**
   * Where the figure with this subjectKey is now: its choreo's locate(), else a scan of that choreo's slots' keys, else
   * the other modules' locate() (the same man is staged by several modules: the night's people, an owner walking up the
   * Mount before his offering). Never a guessed figure: null when no module has him.
   */
  function locate(choreo, subjectKey, target = new Vector3()) {
    const entry = runtime?.choreo?.(choreo);
    if (!subjectKey) return null;
    const t = time?.t;
    let r = null;
    const ask = (e) => {
      if (typeof e.mod.locate !== 'function' || !e.inited || e.failed) return null;
      try { return e.mod.locate(ctx, e.state, subjectKey, t, e.sim) || null; } catch (err) { warnOnce(`loc:${e.id}`, `[inspect] ${e.id}.locate failed`, err); return null; }
    };
    if (entry) r = ask(entry);
    if (!r && entry) {
      // generic: the slot whose description carries this key (never a guessed figure)
      for (const pool of entry.pools) {
        for (let i = 0; i < pool.slots.length; i++) {
          const slot = pool.slots[i];
          if (!slot.want && !slot.shown) continue;
          const d = hook(entry, whoOf({ pool, slot, index: i }), t);
          if (d?.subjectKey === subjectKey) { r = { slot }; break; }
        }
        if (r) break;
      }
    }
    if (!r) for (const e of runtime?.entries || []) { if (e !== entry && (r = ask(e))) break; }
    if (!r) return null;
    if (r.slot) return figurePos(r.slot, target);
    if (Array.isArray(r.at)) return m2w(r.at[0], r.at[1], r.at[2] ?? 16, target);
    return null;
  }

  // ------------------------------------------------------------------------------------- anchors
  function elementBase(id, target = new Vector3()) {
    const e = ctx.elOpt?.(id);
    const pb = OBJECTS[id]?.pickBoxes?.[0];
    const b = e?.box || pb;
    if (!b) return null;
    return m2w((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2], target);
  }
  /** an element's height in metres (for framing its middle) */
  function heightOf(ref) {
    const r = parseRef(ref);
    if (r?.kind !== 'el') return 0;
    const id = OBJECT_ALIASES[r.id] || r.id;
    const b = ctx.elOpt?.(id)?.box || OBJECTS[id]?.pickBoxes?.[0];
    return b ? (b.max[2] - b.min[2]) * AMAH : 0;
  }
  function anchorOf(ref, target = new Vector3()) {
    const r = parseRef(ref);
    if (!r) return null;
    switch (r.kind) {
      case 'actor': { const x = actorOf(r.id); return x ? figurePos(x.slot, target) : null; }
      case 'crowd': { const x = crowdOf(r.id); return x && x.crowd.shown ? target.copy(x.crowd.pos) : null; }
      case 'el': return elementBase(OBJECT_ALIASES[r.id] || r.id, target);
      case 'fire': { const f = ctx.fx?.fires?.get?.(r.id); return f ? target.copy(f.pos) : null; }
      case 'zone': {
        const s = content[r.id]?.stand;
        if (Array.isArray(s)) return m2w(s[0], s[1], s[2] ?? zoneGeometry(r.id)?.floorZ ?? 0, target);
        const g = zoneGeometry(r.id);
        const b = g?.boxes?.[0];
        return b ? m2w((b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, g.floorZ ?? b[0][2], target) : null;
      }
      case 'event': { const ev = schedule.byId(r.id); return ev ? schedule.positionOf(ev, target) : null; }
      default: return null;
    }
  }

  // ------------------------------------------------------------------------------------- objects in zones
  let thingsByZone = null;
  function zoneOfElement(id) {
    const o = OBJECTS[id];
    if (o?.zone) return o.zone;
    const b = ctx.elOpt?.(id)?.box;
    if (!b) return null;
    return zones?.atSite?.((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, b.min[2] + 0.1) ?? null;
  }
  function buildThings() {
    thingsByZone = new Map();
    for (const id of Object.keys(OBJECTS)) {
      if (id.startsWith('fire:')) continue;
      const e = ctx.elOpt?.(id);
      if (!e && !OBJECTS[id].zone) continue;
      const zs = uniq([zoneOfElement(id), ...(OBJECTS[id].zones || [])]);
      for (const z of zs) {
        if (!thingsByZone.has(z)) thingsByZone.set(z, []);
        thingsByZone.get(z).push({ ref: `el:${id}`, title: objTitle(id), kind: e?.kind || 'fixture' });
      }
    }
    for (const id of Object.keys(OBJECTS)) {
      if (!id.startsWith('fire:') || !OBJECTS[id].zone) continue;
      const z = OBJECTS[id].zone;
      if (!thingsByZone.has(z)) thingsByZone.set(z, []);
      thingsByZone.get(z).push({ ref: id, title: objTitle(id), kind: 'fire' });
    }
  }
  function thingsIn(zoneId) {
    if (!thingsByZone) buildThings();
    return (thingsByZone.get(zoneId) || []).slice();
  }
  function objTitle(id) {
    const o = OBJECTS[id];
    const e = ctx.elOpt?.(id);
    return o?.title ? { ...o.title } : e?.name ? { en: e.name.en, he: e.name.he } : { en: id };
  }

  // ------------------------------------------------------------------------------------- nearby
  function bearingWords(fromHeading, dx, dz) {
    const b = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
    const a = ((b - fromHeading + 540) % 360) - 180;
    const s = Math.abs(a);
    const side = a > 0 ? 'right' : 'left';
    if (s <= 22.5) return 'ahead';
    if (s <= 67.5) return `ahead-${side}`;
    if (s <= 112.5) return `to the ${side}`;
    if (s <= 157.5) return `behind-${side}`;
    return 'behind';
  }
  function nearby(r = 15, { limit = 12 } = {}) {
    const p = ctx.player?.position;
    if (!p) return [];
    const h = ctx.player?.heading ?? 0;
    const out = [];
    const t = time?.t;
    for (const f of picker.figures()) {
      const q = f.slot.actor.object3D.position;
      const d = q.distanceTo(p);
      if (d > r) continue;
      const who = whoOf(f);
      const desc = describeFigure(f.entry, who, t);
      const title = who.animal ? lang(ANIMALS_INFO[who.animal]?.title) || { en: animalTitle(who.animal) } : lang(ROLES_INFO[who.role]?.title) || { en: roleTitle(who.role) };
      out.push({
        ref: `actor:${f.entry.id}:${f.pool.name}:${f.index}`, kind: who.kind, title,
        label: shortLabel(title.en, textOf(desc.doing) || poseVerb(f.slot.actor.poseName)),
        distance: d, bearing: { en: where(bearingWords(h, q.x - p.x, q.z - p.z), d) }, heading: (Math.atan2(q.x - p.x, -(q.z - p.z)) * 180 / Math.PI + 360) % 360,
      });
    }
    for (const entry of runtime?.entries || []) {
      entry.crowds.forEach((c, ci) => {
        if (!c.shown) return;
        const d = c.pos.distanceTo(p);
        if (d > r) return;
        const card = describeCrowd(entry, c, ci, t);
        out.push({ ref: `crowd:${entry.id}:${ci}`, kind: 'person', title: card.title, label: shortLabel(card.title.en, textOf(card.now?.text)), distance: d,
          bearing: { en: where(bearingWords(h, c.pos.x - p.x, c.pos.z - p.z), d) }, heading: (Math.atan2(c.pos.x - p.x, -(c.pos.z - p.z)) * 180 / Math.PI + 360) % 360 });
      });
    }
    for (const e of picker.elementBoxes) {
      // (not the vast ones one stands on or inside: the otem under the Heichal, a whole flight)
      if (!NEAR_KINDS.has(e.kind) || !OBJECTS[e.id] || e.vol > 2000) continue;
      const d = e.box3.distanceToPoint(p);
      if (d > r) continue;
      const c = e.box3.getCenter(new Vector3());
      out.push({ ref: `el:${e.id}`, kind: 'object', title: objTitle(e.id), label: { en: objTitle(e.id).en }, distance: d,
        bearing: { en: where(bearingWords(h, c.x - p.x, c.z - p.z), d) }, heading: (Math.atan2(c.x - p.x, -(c.z - p.z)) * 180 / Math.PI + 360) % 360 });
    }
    out.sort((a, b) => a.distance - b.distance);
    return out.slice(0, limit);
  }

  /** the short label of a figure or crowd for the hover tooltip, the reticle, the chooser and Nearby: 'Kohen · slaughtering' */
  function labelOf(ref, t = time?.t) {
    const r = parseRef(ref);
    if (r?.kind === 'actor') {
      const x = actorOf(r.id);
      if (!x) return null;
      const who = whoOf(x);
      const d = describeFigure(x.entry, who, t);
      const title = who.animal ? lang(ANIMALS_INFO[who.animal]?.title) || { en: animalTitle(who.animal) } : lang(ROLES_INFO[who.role]?.title) || { en: roleTitle(who.role) };
      return shortLabel(title.en, textOf(d.doing) || poseVerb(x.slot.actor?.poseName));
    }
    if (r?.kind === 'crowd') {
      const x = crowdOf(r.id);
      if (!x) return null;
      const card = describeCrowd(x.entry, x.crowd, x.index, t);
      return shortLabel(card.title.en, textOf(card.now?.text));
    }
    return null;
  }

  // ------------------------------------------------------------------------------------- common pieces
  const fmtNow = (ev, t) => {
    if (!ev || !Number.isFinite(ev.t0)) return null;
    if (within(t, ev.t0, ev.t1)) return { text: { en: `Now · ${dur(since(ev.t1, t))} left` }, eventId: ev.id, progress: since(t, ev.t0) / (since(ev.t1, ev.t0) || 1), until: ev.t1 };
    if (ev.t0 > t) return { text: { en: ev.t0 - t < 1 ? `Starting now (≈${hhmm(ev.t0)})` : `In ${dur(ev.t0 - t)} (≈${hhmm(ev.t0)})` }, eventId: ev.id };
    return { text: { en: `Earlier today (≈${hhmm(ev.t0)}–${hhmm(ev.t1)})` }, eventId: ev.id };
  };
  function goTo(at, heading, label) {
    if (!at) return null;
    return { id: 'go', kind: 'go', label: { en: 'Go ▸' }, target: { at: at.slice(0, 3), ...(Number.isFinite(heading) ? { heading } : {}) }, goLabel: label };
  }
  function eventView(ev) {
    const v = ev && schedule.viewOf(ev);
    return v ? { at: v.at, heading: v.heading } : null;
  }
  /** a stand 3 m from a world point, toward the observer, facing it */
  function standNear(w) {
    const p = ctx.player?.position;
    const dx = p ? p.x - w.x : 0, dz = p ? p.z - w.z : 3;
    const L = Math.hypot(dx, dz) || 1;
    const s = w2m({ x: w.x + dx / L * 3, y: w.y, z: w.z + dz / L * 3 });
    const heading = (Math.atan2(-dx, dz) * 180 / Math.PI + 360) % 360;
    return { at: [s.X, s.Y, s.Z], heading };
  }
  function eventMoments(ev, t, extra = {}) {
    if (!ev || !Number.isFinite(ev.t0)) return [];
    if (ev.dayTypes?.includes?.('occasional')) return [];
    return momentActions(ctx, { t0: ev.t0, t1: ev.t1, what: ev.title, eventId: ev.id, view: eventView(ev), dayTypes: ev.dayTypes, ...extra }, t);
  }
  function orderActions(list) {
    const rank = { 'see-in-action': 0, follow: 1, go: 2, time: 3, map: 4, learn: 5 };
    const seen = new Set();
    return list.filter(Boolean).filter((a) => { const k = a.id || `${a.kind}:${a.label?.en}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => (rank[a.kind] ?? 9) - (rank[b.kind] ?? 9));
  }

  // ------------------------------------------------------------------------------------- moments of figures
  const ENTER = 0.2;               // sim min: land this far into a figure's own window (he is there by then)
  const isDynamicId = (id) => /^(offering|set):/.test(String(id || ''));
  const typeWord = (type) => (OFFERING_TYPES[type]?.names?.translit || 'offering').toLowerCase();
  /** an individual's offering in the private offerings' plan (its steps and tracks), or null */
  function planInst(id) {
    try {
      const P = runtime?.choreo?.('private-offerings')?.state?.plan || runtime?.planOf?.('private-offerings');
      return P?.ok ? P.insts.find((x) => x.id === id) || null : null;
    } catch { return null; }
  }
  /** the window in which the figure with this key is staged: a troupe episode ('…@t0') or an offering's track */
  function ownWindow(key) {
    const k = String(key || '');
    const ep = k.match(/@(\d+(?:\.\d+)?)$/);
    if (ep) return { t0: +ep[1] };
    const m = k.match(/^(offering:[^#]+)#(.+)$/);
    const tr = m && planInst(m[1])?.tracks?.find((x) => x.role === m[2]);
    return tr && Number.isFinite(tr.t0) ? { t0: tr.t0, t1: tr.t1 } : null;
  }
  /** the same role in another offering, when it has one */
  function roleKey(instId, key) {
    const role = String(key || '').split('#')[1];
    return role && planInst(instId)?.tracks?.some((x) => x.role === role) ? `${instId}#${role}` : undefined;
  }
  // a step in the courts (not the walk in from the Mount or the gate): where an offering is worth showing
  const OUT_ZONES = new Set(['har-habayit', 'outside', 'chel', 'soreg', 'ezrat-nashim']);
  const inCourt = (st) => !!st && st.id !== 'arrive' && !OUT_ZONES.has(st.zone);
  /**
   * The moment to show one offering of a type: one in progress at a station in the courts, else the next step in the
   * courts of one in progress or to come today (its own stand: the plan's step view, never the walk up the Mount).
   * -> { ev, t0, t1, view?, live } | null
   */
  function watchMoment(type, t, exclude = null) {
    const match = (d) => d && d.id !== exclude && (d.offering === type || String(d.id).startsWith(`offering:${type}:`));
    const live = (schedule.dynamic?.(t) || []).filter(match);
    for (const d of live) {
      const st = planInst(d.id)?.steps?.find((x) => t >= x.t0 && t < x.t1);
      if (inCourt(st)) return { ev: d, t0: d.t0, t1: d.t1, live: true };
    }
    let up = [];
    try { up = (schedule.upcoming?.(t, 40, { dynamic: true }) || []).filter((d) => d.dynamic && match(d)); } catch { up = []; }
    for (const d of [...live, ...up]) {
      const st = planInst(d.id)?.steps?.find((x) => x.t0 > t && inCourt(x));
      // just inside the step: its figures are on their tracks by then (before it, nothing of it is staged yet)
      if (st) return { ev: d, t0: st.t0 + ENTER, t1: Math.max(st.t1, d.t1 ?? st.t1), view: st.view?.at ? { at: st.view.at.slice(), heading: st.view.heading } : null, live: false };
    }
    if (live[0]) return { ev: live[0], t0: live[0].t0, t1: live[0].t1, live: true };
    return up[0] ? { ev: up[0], t0: up[0].t0 + ENTER, t1: up[0].t1, live: false } : null;
  }

  // ------------------------------------------------------------------------------------- person / animal
  function describeActor(id, t) {
    const x = actorOf(id);
    if (!x) return missing({ kind: 'actor', id }, 'person', 'This figure is not in the scene now.');
    const who = whoOf(x);
    const d = describeFigure(x.entry, who, t);
    const slot = x.slot;
    const shown = !!(slot.shown && slot.actor);
    const at = shown ? (() => { const s = w2m(slot.actor.object3D.position); return [s.X, s.Y, s.Z]; })() : null;
    const ev = d.eventId ? schedule.byId(d.eventId) : null;
    const step = d.step || (ev ? { id: ev.id, label: ev.title, t0: ev.t0, t1: ev.t1 } : null);
    const now = {
      text: shown ? lang(d.doing) : { en: 'Out of sight' }, eventId: d.eventId, step,
      progress: step && Number.isFinite(step.t0) && within(t, step.t0, step.t1) ? since(t, step.t0) / (since(step.t1, step.t0) || 1) : undefined,
      until: step?.t1,
    };
    const sources = [];
    const why = d.why ? { text: { en: textOf(d.why) }, sources: d.why.sources || [] } : (ev?.summary ? { text: { en: textOf(ev.summary) }, sources: ev.sources || [] } : null);
    if (why) sources.push(...why.sources);
    const actions = [];
    // see in action: the subject's step now, its next moment, the event's window
    const subj = { subjectKey: d.subjectKey, choreo: x.entry.id, follow: true, focus: { kind: 'actor', id } };
    // an individual's offering (a dynamic instance) happens once: never "tomorrow"; once over, another of its kind
    const dyn = isDynamicId(d.eventId) || !!ev?.dynamic;
    // the figure's own presence (an episode's start, an offering track): "From the start" lands when he is there
    const own = ownWindow(d.subjectKey);
    if (step && Number.isFinite(step.t0)) {
      const spec = { t0: step.t0, t1: step.t1, what: step.label || ev?.title || d.doing, eventId: d.eventId, view: eventView(ev), dayTypes: dyn ? undefined : ev?.dayTypes, tomorrow: dyn ? false : undefined, stepT0: own ? own.t0 + ENTER : undefined, ...subj };
      if (dyn && !within(t, step.t0, step.t1) && step.t0 <= t) {
        const type = step.offering || ev?.offering;
        const m = type && OFFERING_TYPES[type] ? watchMoment(type, t, ev?.id || d.eventId) : null;
        if (m) spec.another = { t0: m.t0, t1: m.t1, eventId: m.ev.id, view: m.view || eventView(m.ev), subjectKey: roleKey(m.ev.id, d.subjectKey), label: { en: typeWord(type) } };
        else if (own && own.t0 >= step.t0 && own.t0 < t) spec.t0 = own.t0 + ENTER;
      }
      actions.push(...momentActions(ctx, spec, t).slice(0, 2));
    } else if (d.next && Number.isFinite(d.next.t)) actions.push(...momentActions(ctx, { t0: d.next.t, t1: d.next.step?.t1 ?? d.next.t + 5, what: d.next.label, eventId: d.eventId, tomorrow: dyn ? false : undefined, ...subj }, t).slice(0, 1));
    if (shown) actions.push({ id: 'follow', kind: 'follow', label: { en: '◎ Follow' }, ref: { kind: 'actor', id } });
    if (shown) { const sn = standNear(slot.actor.object3D.position); actions.push({ ...goTo(sn.at, sn.heading, { en: 'Go closer' }), label: { en: 'Go closer ▸' } }); }
    actions.push({ id: 'map', kind: 'map', label: { en: 'Map' }, zone: at ? zones?.atSite?.(at[0], at[1], at[2]) : ev?.zone, at });

    if (who.kind === 'animal') {
      const info = ANIMALS_INFO[who.animal] || null;
      if (info?.what?.sources) sources.push(...info.what.sources);
      actions.push(info?.glossary ? { id: 'learn', kind: 'learn', label: { en: `Learn: ${info.title?.en || who.animal} ›` }, ref: { kind: 'term', id: info.glossary } } : null);
      return {
        ref: { kind: 'actor', id }, kind: 'animal',
        title: lang(info?.title) || { en: animalTitle(who.animal) }, subtitle: d.phrase ? lang(d.phrase) : null,
        now, why, what: info?.what ? { text: { en: info.what.en }, sources: info.what.sources || [] } : null, who: null,
        sources: uniq(sources), confidence: ev?.timing?.confidence, confidenceNote: ev?.timing?.note,
        zone: at ? zones?.atSite?.(at[0], at[1], at[2]) : ev?.zone, at, subjectKey: d.subjectKey, choreo: x.entry.id, hooked: d.hooked,
        related: ev ? [{ ref: { kind: 'event', id: ev.id }, title: ev.title, kind: 'event' }] : [],
        actions: orderActions(actions),
      };
    }
    const role = who.role;
    const info = ROLES_INFO[role] || null;
    const whoText = info ? [info.who?.en, info.attire?.en].filter(Boolean).join(' ') : null;
    const whoSources = info ? [...(info.who?.sources || []), ...(info.attire?.sources || [])] : [];
    sources.push(...whoSources);
    const holding = [];
    const a = slot.actor;
    for (const p of uniq([a?.prop?.name, a?.prop2?.name, a?.shownProp?.name])) {
      const pi = PROPS_INFO[`${p}:${role}`] || PROPS_INFO[p];
      holding.push({ prop: p, title: lang(pi?.title) || { en: p.replace(/_/g, ' ') }, what: pi?.what ? { en: pi.what.en } : undefined });
      if (pi?.what?.sources) sources.push(...pi.what.sources);
    }
    const sections = [];
    if (info?.attire) sections.push({ id: 'attire', title: { en: 'Dress' }, text: { en: info.attire.en }, sources: info.attire.sources || [] });
    if (slot._avnet === false && /^kohen|segan/.test(role || '')) {
      sections.push({ id: 'avnet', title: { en: 'Avnet set aside' }, text: { en: 'The avnet is sha\'atnez (wool and linen), worn only in the avodah itself; outside it — eating, dividing the bread, waiting — he sets it aside (Rambam Klei HaMikdash 8:11).' }, sources: ['Rambam Klei HaMikdash 8:11', 'Yoma 12b'] });
    }
    actions.push({ id: 'learn', kind: 'learn', label: { en: `Learn: ${info?.title?.en || roleTitle(role)} ›` }, ref: { kind: 'role', id: role } });
    return {
      ref: { kind: 'actor', id }, kind: 'person',
      title: lang(info?.title) || { en: roleTitle(role) }, subtitle: d.phrase ? lang(d.phrase) : null,
      now, why, what: null, who: whoText ? { text: { en: whoText }, sources: whoSources } : null,
      holding: holding.length ? holding : undefined, sections,
      related: [{ ref: { kind: 'role', id: role }, title: lang(info?.title) || { en: roleTitle(role) }, kind: 'role' }, ...(ev ? [{ ref: { kind: 'event', id: ev.id }, title: ev.title, kind: 'event' }] : [])],
      sources: uniq(sources), confidence: ev?.timing?.confidence || (d.hooked ? undefined : 'reconstruction'), confidenceNote: ev?.timing?.note,
      zone: at ? zones?.atSite?.(at[0], at[1], at[2]) : ev?.zone, at, subjectKey: d.subjectKey, choreo: x.entry.id, hooked: d.hooked,
      actions: orderActions(actions),
    };
  }

  function describeCrowd(entry, c, ci, t) {
    const who = { kind: 'crowd', poolName: null, index: ci, crowd: c, role: crowdRole(c) };
    const d = describeFigure(entry, who, t);
    const ev = d.eventId ? schedule.byId(d.eventId) : null;
    const info = ROLES_INFO[who.role];
    const title = d.phrase ? { en: cap(textOf(d.phrase)) } : { en: `${info?.title?.en || roleTitle(who.role)}s` };
    const s = w2m(c.pos);
    const actions = ev ? eventMoments(ev, t).slice(0, 2) : [];
    actions.push({ id: 'map', kind: 'map', label: { en: 'Map' }, zone: ev?.zone, at: [s.X, s.Y, s.Z] });
    if (info) actions.push({ id: 'learn', kind: 'learn', label: { en: `Learn: ${info.title.en} ›` }, ref: { kind: 'role', id: who.role } });
    return {
      ref: { kind: 'crowd', id: `${entry.id}:${ci}` }, kind: 'person', crowd: true, title, subtitle: null,
      now: { text: lang(d.doing), eventId: d.eventId, step: d.step || null }, why: d.why ? { text: { en: textOf(d.why) }, sources: d.why.sources || [] } : (ev?.summary ? { text: { en: textOf(ev.summary) }, sources: ev.sources || [] } : null),
      what: null, who: info ? { text: { en: info.who.en }, sources: info.who.sources || [] } : null,
      sources: uniq([...(ev?.sources || []), ...(info?.who?.sources || [])]), zone: ev?.zone, at: [s.X, s.Y, s.Z],
      actions: orderActions(actions),
    };
  }
  const crowdRole = (c) => {
    const r = c.spec?.roles;
    if (typeof r === 'string') return r;
    if (Array.isArray(r)) return r[0];
    if (r && typeof r === 'object') return Object.entries(r).sort((a, b) => b[1] - a[1])[0]?.[0];
    return 'israelite';
  };
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  // ------------------------------------------------------------------------------------- objects
  /**
   * The measures row: the sourced figures objects.js gives (amot, with their confidence and sources), else the model's
   * outer box, labelled as such — never for walls, slabs and ledges, or a box that spans the site (the soreg's), whose
   * box is not the size of the thing named.
   */
  function measuresOf(e, o) {
    const r1 = (x) => Math.round(x * 100) / 100;
    if (Array.isArray(o?.measures)) return o.measures.map((x) => ({ label: lang(x.label), amot: x.amot, m: r1(x.amot * AMAH), confidence: x.confidence || 'explicit', sources: x.sources || [] }));
    const b = e?.box;
    if (!b || BOXLESS.has(e.kind)) return [];
    const conf = e.confidence || 'reconstruction';
    const ew = b.max[0] - b.min[0], ns = b.max[1] - b.min[1], h = b.max[2] - b.min[2];
    if (ew > 120 || ns > 120 || h < 0.05) return [];
    const out = [];
    if (ew > 0.05) out.push({ label: { en: 'East–west (model, outer)' }, amot: r1(ew), m: r1(ew * AMAH), confidence: conf });
    if (ns > 0.05) out.push({ label: { en: 'North–south (model, outer)' }, amot: r1(ns), m: r1(ns * AMAH), confidence: conf });
    out.push({ label: { en: 'Height (model, outer)' }, amot: r1(h), m: r1(h * AMAH), confidence: conf });
    return out;
  }
  /** the object's in-action moments: its events' windows today */
  function inActionOf(o, t) {
    const out = [];
    for (const ia of o?.inAction || []) {
      const ev = schedule.byId(ia.event);
      if (!ev || !Number.isFinite(ev.t0)) continue;
      out.push({ ia, ev, active: within(t, ev.t0, ev.t1) });
    }
    return out;
  }
  function describeObject(id, t, fire = false) {
    const key = fire ? `fire:${id}` : (OBJECT_ALIASES[id] || id);
    const o = OBJECTS[key] || null;
    const e = fire ? null : ctx.elOpt?.(key);
    if (!o && !e) return missing({ kind: fire ? 'fire' : 'el', id }, 'object', 'Nothing is recorded about this.');
    const title = objTitle(key);
    const sources = [...(o?.purpose?.sources || []), ...(o?.use?.sources || []), ...(o?.notes?.sources || []), ...(o?.sources || []), ...(e?.sources || [])];
    const ias = inActionOf(o, t);
    const items = ias.map(({ ia, ev, active }) => ({
      ref: { kind: 'event', id: ev.id }, title: lang(ia.label) || ev.title,
      when: { en: active ? 'now' : `≈${hhmm(ev.t0)}` }, active,
    }));
    const sections = [];
    if (o?.use) sections.push({ id: 'use', title: { en: 'How it was used' }, text: { en: o.use.en }, sources: o.use.sources || [] });
    if (items.length) sections.push({ id: 'in-action', title: { en: 'In action' }, items });
    if (o?.notes) sections.push({ id: 'notes', title: { en: 'More' }, text: { en: o.notes.en }, sources: o.notes.sources || [] });
    if (e?.notes && typeof e.notes === 'string') sections.push({ id: 'model', title: { en: 'In this model' }, text: { en: e.notes } });
    // actions: see it in action (an active entry first, else the next today, else the first)
    const actions = [];
    const pick = ias.find((x) => x.active) || ias.filter((x) => x.ev.t0 > t).sort((a, b) => a.ev.t0 - b.ev.t0)[0] || ias[0];
    let focus = fire ? { kind: 'fire', id } : { kind: 'el', id: key };
    if (pick && !fire) {
      // an event staged away from the thing itself (on a gate's roof, across the court): frame where it happens
      const ep = pick.ia.focus === 'element' ? null : schedule.positionOf(pick.ev);
      const ap = anchorOf(`el:${key}`);
      if (pick.ia.focus === 'event' || (ep && ap && (Math.hypot(ep.x - ap.x, ep.z - ap.z) > 8 || Math.abs(ep.y - ap.y) > 3))) focus = undefined;
    }
    if (pick) actions.push(...momentActions(ctx, { t0: pick.ev.t0, t1: pick.ev.t1, what: lang(pick.ia.label) || pick.ev.title, eventId: pick.ev.id, view: (focus ? o?.view : null) || eventView(pick.ev), dayTypes: pick.ev.dayTypes, focus }, t).slice(0, 2));
    const zone = fire ? o?.zone : zoneOfElement(key);
    const stand = o?.view || (zone && content[zone]?.stand ? { at: content[zone].stand } : null);
    const base = anchorOf(fire ? `fire:${id}` : `el:${key}`);
    const go = o?.view ? goTo(o.view.at, o.view.heading, title) : base ? (() => { const s = standNear(base); return goTo(s.at, s.heading, title); })() : stand ? goTo(stand.at, stand.heading, title) : null;
    actions.push(go);
    actions.push({ id: 'map', kind: 'map', label: { en: 'Map' }, zone, at: base ? (() => { const s = w2m(base); return [s.X, s.Y, s.Z]; })() : null });
    if (o?.glossary && GLOSSARY[o.glossary]) actions.push({ id: 'learn', kind: 'learn', label: { en: 'Learn ›' }, ref: { kind: 'term', id: o.glossary } });
    return {
      ref: { kind: fire ? 'fire' : 'el', id }, kind: 'object',
      title, translit: o?.translit, subtitle: o?.subtitle ? lang(o.subtitle) : (e ? { en: cap(KIND_NAME[e.kind] || e.kind) } : null),
      now: ias.find((x) => x.active) ? { text: lang(ias.find((x) => x.active).ia.label) || ias.find((x) => x.active).ev.title, eventId: ias.find((x) => x.active).ev.id } : null,
      why: null,
      what: o?.purpose ? { text: { en: o.purpose.en }, sources: o.purpose.sources || [] } : null,
      who: null,
      measures: fire ? [] : measuresOf(e, o),
      sections,
      related: [...(o?.related || []).map((r) => ({ ref: parseRef(r), title: refTitle(r), kind: parseRef(r)?.kind })),
        ...(o?.glossary && GLOSSARY[o.glossary] ? [{ ref: { kind: 'term', id: o.glossary }, title: { en: GLOSSARY[o.glossary].translit, he: GLOSSARY[o.glossary].he }, kind: 'term' }] : [])],
      sources: uniq(sources), confidence: o?.confidence || e?.confidence, confidenceNote: o?.confidenceNote,
      zone, at: base ? (() => { const s = w2m(base); return [s.X, s.Y, s.Z]; })() : null,
      actions: orderActions(actions),
    };
  }

  // ------------------------------------------------------------------------------------- places
  function storeysOf(id) {
    const g = zoneGeometry(id);
    const b = g?.boxes?.[0];
    if (!b) return [];
    const out = [];
    const area = (bb) => Math.max(0, bb[1][0] - bb[0][0]) * Math.max(0, bb[1][1] - bb[0][1]);
    const A = area(b) || 1;
    for (const [zid, z] of Object.entries(SITE.zones || {})) {
      if (zid === id || !z.boxes?.length) continue;
      if (Math.abs((z.floorZ ?? 0) - (g.floorZ ?? 0)) < 3) continue;
      for (const c of z.boxes) {
        const ix = Math.min(b[1][0], c[1][0]) - Math.max(b[0][0], c[0][0]);
        const iy = Math.min(b[1][1], c[1][1]) - Math.max(b[0][1], c[0][1]);
        if (ix > 0 && iy > 0 && (ix * iy) / A > 0.5 && (ix * iy) / (area(c) || 1) > 0.25) { out.push(zid); break; }
      }
    }
    return out;
  }
  function describePlace(id, t, at) {
    const z = content[id] || null;
    const g = zoneGeometry(id);
    if (!z && !g) return missing({ kind: 'zone', id }, 'place', 'Outside the precinct.');
    const name = z?.name || { en: id };
    const rung = rungOf(z?.sanctity);
    const L = rung != null && SCALE ? SCALE.find((s) => s.level === rung) : null;
    const sections = [];
    const here = (schedule.at(id, t) || []).filter((ev) => ev.layer !== 'aggadah' || ctx.settings?.get?.('aggadah') !== false);
    if (here.length) sections.push({ id: 'happening', title: { en: `Happening here · ${here.length}` }, items: here.map((ev) => ({ ref: { kind: 'event', id: ev.id }, title: ev.title, when: fmtNow(ev, t)?.text, progress: schedule.progress(ev, t) })) });
    const next = (schedule.upcoming(t, 60) || []).find((ev) => ev.zone === id || ev.zones?.includes?.(id));
    if (next) sections.push({ id: 'next', title: { en: 'Next here' }, items: [{ ref: { kind: 'event', id: next.id }, title: next.title, when: { en: next.nextDay ? `tomorrow ≈${hhmm(next.t0)}` : next.t0 - t < 1 ? `starting now (≈${hhmm(next.t0)})` : `in ${dur(next.t0 - t)} (≈${hhmm(next.t0)})` } }] });
    const things = thingsIn(id);
    if (things.length) sections.push({ id: 'things', title: { en: 'Things here' }, refs: things.map((x) => parseRef(x.ref)), items: things });
    if (z?.access) sections.push({ id: 'access', title: { en: 'Who may enter' }, text: { en: z.access }, lead: { en: accessLead(z.access) } });
    if (L) sections.push({ id: 'sanctity', title: { en: 'Sanctity' }, text: { en: `${L.en} (${L.he}): ${L.rule}.` }, sources: L.sources || ['Kelim 1:6–9', 'Rambam BhB 7:12–22'], rung });
    const services = Array.isArray(z?.services) ? z.services : z?.services ? [z.services] : [];
    if (services.length) sections.push({ id: 'services', title: { en: 'What is done here' }, items: services.map((s) => ({ text: { en: textOf(s) || s.title || '' } })) });
    if (z?.description) sections.push({ id: 'about', title: { en: 'About' }, text: { en: z.description } });
    const storeys = storeysOf(id).filter((s) => content[s]);
    if (storeys.length) sections.push({ id: 'storeys', title: { en: 'Also here' }, refs: storeys.map((s) => ({ kind: 'zone', id: s })), items: storeys.map((s) => ({ ref: { kind: 'zone', id: s }, title: content[s].name })) });
    const occasional = schedule.events.filter((ev) => ev.dayTypes?.includes?.('occasional') && ev.zone === id);
    if (occasional.length) sections.push({ id: 'occasional', title: { en: 'Also here, on its days' }, items: occasional.map((ev) => ({ ref: { kind: 'event', id: ev.id }, title: ev.title })) });
    const actions = [];
    const ev0 = here.find((e) => !e.dynamic) || here[0];
    if (ev0) actions.push(...eventMoments(ev0, t).slice(0, 1));
    if (Array.isArray(z?.stand)) actions.push({ ...goTo(z.stand, z.standHeading, name), label: { en: 'Go ▸' } });
    actions.push({ id: 'map', kind: 'map', label: { en: 'Map' }, zone: id });
    const term = glossaryFor(name);
    if (term) actions.push({ id: 'learn', kind: 'learn', label: { en: 'Learn ›' }, ref: { kind: 'term', id: term } });
    return {
      ref: { kind: 'zone', id }, kind: 'place', title: { en: name.en, he: name.he }, translit: name.translit,
      subtitle: L ? { en: `Sanctity of ${L.en}` } : null,
      now: here.length ? { text: { en: `${here.length} happening here now` }, eventId: here[0].id } : { text: { en: 'Nothing in the order of the day here now' } },
      why: null, what: z?.description ? { text: { en: firstSentence(z.description) }, sources: z.sources || [] } : null,
      who: z?.access ? { text: { en: accessLead(z.access) }, sources: [] } : null,
      sections, sources: uniq(z?.sources || []), confidence: z?.confidence, confidenceNote: z?.confidenceNote,
      zone: id, at: at || (Array.isArray(z?.stand) ? z.stand : null), rung, accessLead: z?.access ? accessLead(z.access) : null,
      actions: orderActions(actions),
    };
  }
  function accessLead(text) {
    const s = String(text || '').trim();
    const m = s.match(/^(.+?[.;])(\s|$)/);
    const first = m ? m[1] : s;
    if (first.length < 40) { const m2 = s.match(/^(.+?[.;].+?[.;])(\s|$)/); if (m2) return m2[1]; }
    return first;
  }
  const firstSentence = (s) => { const m = String(s || '').match(/^(.+?\.)(\s|$)/); return m ? m[1] : String(s || ''); };
  function glossaryFor(name) {
    const n = String(name?.translit || name?.en || '').toLowerCase().replace(/^the /, '');
    if (GLOSSARY[n]) return n;
    for (const [k, g] of Object.entries(GLOSSARY)) if (g.aka?.includes?.(n) || g.translit?.toLowerCase?.() === n) return k;
    return null;
  }

  // ------------------------------------------------------------------------------------- events
  function describeEvent(id, t) {
    const ev = schedule.byId(id);
    if (!ev) return missing({ kind: 'event', id }, 'event', 'Not in the order of this day.');
    const sections = [];
    if (ev.description) sections.push({ id: 'about', title: { en: 'What happens' }, text: { en: textOf(ev.description) } });
    if (Array.isArray(ev.participants) && ev.participants.length) {
      sections.push({ id: 'who', title: { en: 'Who' }, items: ev.participants.map((p) => ({ ref: ROLES_INFO[p.role] ? { kind: 'role', id: p.role } : null, text: { en: `${p.count ? `${p.count} × ` : ''}${ROLES_INFO[p.role]?.title?.en || roleTitle(p.role)}${p.note ? ` — ${p.note}` : ''}` } })) });
    }
    if (ev.timing) sections.push({ id: 'timing', title: { en: 'Timing' }, text: { en: `${cap(ev.timing.confidence || '')}${ev.timing.note ? `: ${ev.timing.note}` : ''}` } });
    if (Array.isArray(ev.offerings) && ev.offerings.length) sections.push({ id: 'offerings', title: { en: 'Offerings' }, refs: ev.offerings.map((o) => ({ kind: 'offering', id: o })), items: ev.offerings.map((o) => ({ ref: { kind: 'offering', id: o }, title: OFFERING_TYPES[o]?.names ? { en: OFFERING_TYPES[o].names.en, he: OFFERING_TYPES[o].names.he } : { en: o } })) });
    // a group: its dynamic instances in progress
    const kids = (schedule.dynamic?.(t) || []).filter((d) => d.parent === ev.id);
    if (kids.length) sections.push({ id: 'instances', title: { en: `${kids.length} in progress` }, items: kids.slice(0, 24).map((d) => ({ ref: { kind: 'event', id: d.id }, title: d.title, when: fmtNow(d, t)?.text })) });
    // an individual's offering already over: "Show me another <kind>" — the next of its type, else the first today
    let another = null;
    if (ev.dynamic && ev.offering && Number.isFinite(ev.t1) && !within(t, ev.t0, ev.t1) && ev.t0 < t) {
      const m = watchMoment(ev.offering, t, ev.id);
      if (m && Number.isFinite(m.t0)) another = { t0: m.t0, t1: m.t1, eventId: m.ev.id, view: m.view || eventView(m.ev), label: { en: typeWord(ev.offering) } };
    }
    const actions = [...eventMoments(ev, t, { ...(another ? { another } : {}), ...(ev.dynamic ? { tomorrow: false } : {}) }).slice(0, 2)];
    const v = eventView(ev);
    if (v) actions.push({ ...goTo(v.at, v.heading, ev.title), label: { en: 'Go ▸' } });
    if (Number.isFinite(ev.t0) && !ev.dayTypes?.includes?.('occasional')) actions.push({ id: 'time', kind: 'time', label: { en: `Set clock to start (≈${hhmm(ev.t0)})` }, tSet: ev.t0, eventId: ev.id });
    actions.push({ id: 'map', kind: 'map', label: { en: 'Map' }, zone: ev.zone, eventId: ev.id });
    const p = schedule.positionOf(ev);
    return {
      ref: { kind: 'event', id }, kind: 'event', title: ev.title, subtitle: ev.summary ? { en: textOf(ev.summary) } : null,
      now: fmtNow(ev, t), why: ev.summary ? { text: { en: textOf(ev.summary) }, sources: ev.sources || [] } : null,
      what: null, who: null, sections,
      related: [ev.zone ? { ref: { kind: 'zone', id: ev.zone }, title: content[ev.zone]?.name || { en: ev.zone }, kind: 'zone' } : null, ...(ev.parent ? [{ ref: { kind: 'event', id: ev.parent }, title: schedule.byId(ev.parent)?.title || { en: ev.parent }, kind: 'event' }] : [])].filter(Boolean),
      sources: uniq(ev.sources || []), confidence: ev.timing?.confidence, confidenceNote: ev.timing?.note,
      zone: ev.zone, at: p ? (() => { const s = w2m(p); return [s.X, s.Y, s.Z]; })() : null,
      window: Number.isFinite(ev.t0) ? { t0: ev.t0, t1: ev.t1 } : null, importance: ev.importance, layer: ev.layer, dynamic: !!ev.dynamic,
      actions: orderActions(actions),
    };
  }

  // ------------------------------------------------------------------------------------- offerings
  function describeOffering(id, t) {
    const o = OFFERING_TYPES[id];
    if (!o) return missing({ kind: 'offering', id }, 'offering', 'Unknown offering.');
    const steps = (o.steps || []).filter((s) => !s.ref).map((s) => {
      const st = Array.isArray(s.at) ? s.at[0] : s.at;
      const zone = STATIONS[st]?.zone;
      return { text: { en: textOf(s.label) }, ref: zone ? { kind: 'zone', id: zone } : null, sources: s.sources || [] };
    });
    const sections = [];
    if (o.broughtBy) sections.push({ id: 'who', title: { en: 'Who brings it' }, text: { en: textOf(o.broughtBy) } });
    if (Array.isArray(o.occasions) && o.occasions.length) sections.push({ id: 'occasions', title: { en: 'When' }, items: o.occasions.map((x) => ({ text: { en: textOf(x) } })) });
    if (steps.length) sections.push({ id: 'steps', title: { en: 'The steps' }, items: steps });
    const facts = [o.blood?.rite && `Blood: ${String(o.blood.rite).replace(/-/g, ' ')}${o.blood.level ? `, ${o.blood.level}` : ''}${o.blood.remainder ? `; the rest on the ${o.blood.remainder}` : ''}`,
      o.burned && `Burned: ${textOf(o.burned)}`, o.eaten && `Eaten: ${typeof o.eaten === 'string' ? o.eaten : `by ${o.eaten.by}, ${o.eaten.where}, ${o.eaten.until}`}`].filter(Boolean);
    if (facts.length) sections.push({ id: 'rite', title: { en: 'The rite' }, items: facts.map((f) => ({ text: { en: f } })) });
    if (o.frequency) sections.push({ id: 'frequency', title: { en: 'How many' }, text: { en: `${o.frequency.lo ?? ''}${o.frequency.hi != null ? `–${o.frequency.hi}` : ''} ${o.frequency.unit || ''} (reconstruction)`.trim() } });
    if (o.notes) sections.push({ id: 'notes', title: { en: 'Notes' }, text: { en: textOf(o.notes) } });
    // "Show me one": the next of this type in progress or to come today (the private offerings' plan)
    const actions = [];
    const m = watchMoment(id, t);
    const inst = m?.ev || null;
    if (m) actions.push(...momentActions(ctx, { t0: m.t0, t1: m.t1, what: { en: `a ${o.names?.en?.toLowerCase?.() || id}` }, eventId: inst.id, view: m.view || eventView(inst), tomorrow: false }, t).slice(0, 1).map((a) => ({ ...a, label: { en: a.mode === 'now' ? `▸ Show me one (now)` : a.label.en.replace('▸', '▸ Show me one:') } })));
    if (o.names?.translit && GLOSSARY[o.names.translit.toLowerCase()]) actions.push({ id: 'learn', kind: 'learn', label: { en: 'Learn ›' }, ref: { kind: 'term', id: o.names.translit.toLowerCase() } });
    return {
      ref: { kind: 'offering', id }, kind: 'offering', title: { en: o.names?.en || id, he: o.names?.he }, translit: o.names?.translit,
      subtitle: { en: [o.category, o.form].filter(Boolean).join(' · ') }, now: inst ? fmtNow(inst, t) : null,
      why: null, what: o.broughtBy ? { text: { en: textOf(o.broughtBy) }, sources: o.sources || [] } : null, who: null,
      sections, sources: uniq(o.sources || []), actions: orderActions(actions),
    };
  }
  // ------------------------------------------------------------------------------------- terms
  const seenCache = new Map();
  function seenIn(key) {
    if (seenCache.has(key)) return seenCache.get(key);
    const g = GLOSSARY[key];
    const words = uniq([key, g?.translit?.toLowerCase(), ...(g?.aka || [])]).filter((w) => w.length >= 3);
    const res = words.map((w) => new RegExp(`(^|[^a-z'])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i'));
    const hit = (s) => { const x = String(s || ''); return res.some((r) => r.test(x)); };
    const out = [];
    for (const [id, z] of Object.entries(content)) if (hit(z.name?.en) || hit(z.name?.translit) || hit(z.description)) out.push({ ref: { kind: 'zone', id }, title: z.name, kind: 'zone' });
    for (const ev of schedule.events) if (hit(ev.title?.en) || hit(ev.description)) out.push({ ref: { kind: 'event', id: ev.id }, title: ev.title, kind: 'event' });
    for (const [id, o] of Object.entries(OBJECTS)) if (o.glossary === key || hit(o.title?.en) || hit(o.purpose?.en)) out.push({ ref: { kind: id.startsWith('fire:') ? 'fire' : 'el', id: id.replace(/^fire:/, '') }, title: objTitle(id), kind: 'object' });
    seenCache.set(key, out);
    return out;
  }
  function describeTerm(key) {
    const g = GLOSSARY[key] || Object.entries(GLOSSARY).find(([, v]) => v.aka?.includes?.(key))?.[1];
    if (!g) return missing({ kind: 'term', id: key }, 'term', 'Not in the glossary.');
    const k = GLOSSARY[key] ? key : Object.keys(GLOSSARY).find((x) => GLOSSARY[x] === g);
    const seen = seenIn(k);
    const sections = [];
    if (g.aka?.length) sections.push({ id: 'aka', title: { en: 'Also' }, text: { en: g.aka.join(', ') } });
    if (seen.length) sections.push({ id: 'seen', title: { en: 'Seen in' }, items: seen.slice(0, 30), refs: seen.slice(0, 30).map((x) => x.ref) });
    return {
      ref: { kind: 'term', id: k }, kind: 'term', title: { en: g.translit || k, he: g.he }, translit: g.translit,
      now: null, why: null, what: { text: { en: g.en }, sources: g.sources || [] }, who: null, sections,
      related: seen.slice(0, 8), sources: uniq(g.sources || []), actions: [],
    };
  }

  // ------------------------------------------------------------------------------------- roles
  function describeRole(role, t) {
    const info = ROLES_INFO[role];
    if (!info) return missing({ kind: 'role', id: role }, 'role', 'Unknown role.');
    const match = new Set([role, ...(ROLE_PARTICIPANTS[role] || [])]);
    const now = (schedule.active(t) || []).filter((ev) => (ev.participants || []).some((p) => match.has(p.role)));
    const sections = [];
    if (info.attire) sections.push({ id: 'attire', title: { en: 'Dress' }, text: { en: info.attire.en }, sources: info.attire.sources || [] });
    if (info.notes) sections.push({ id: 'notes', title: { en: 'More' }, text: { en: info.notes.en }, sources: info.notes.sources || [] });
    if (now.length) sections.push({ id: 'where', title: { en: 'Where they are now' }, items: now.slice(0, 12).map((ev) => ({ ref: { kind: 'event', id: ev.id }, title: ev.title, when: fmtNow(ev, t)?.text })) });
    const actions = [];
    if (now[0]) actions.push(...eventMoments(now[0], t).slice(0, 1));
    if (info.glossary && GLOSSARY[info.glossary]) actions.push({ id: 'learn', kind: 'learn', label: { en: 'Learn ›' }, ref: { kind: 'term', id: info.glossary } });
    return {
      ref: { kind: 'role', id: role }, kind: 'role', title: lang(info.title), now: now.length ? { text: { en: `${now.length} ${now.length === 1 ? 'place' : 'places'} in the service now` }, eventId: now[0].id } : null,
      why: null, what: null, who: { text: { en: info.who.en }, sources: info.who.sources || [] }, sections,
      sources: uniq([...(info.who.sources || []), ...(info.attire?.sources || [])]), actions: orderActions(actions),
    };
  }

  function refTitle(r) {
    const x = parseRef(r);
    if (!x) return { en: '' };
    if (x.kind === 'el') return objTitle(x.id);
    if (x.kind === 'zone') return content[x.id]?.name || { en: x.id };
    if (x.kind === 'event') return schedule.byId(x.id)?.title || { en: x.id };
    if (x.kind === 'term') return GLOSSARY[x.id] ? { en: GLOSSARY[x.id].translit, he: GLOSSARY[x.id].he } : { en: x.id };
    if (x.kind === 'offering') return OFFERING_TYPES[x.id]?.names || { en: x.id };
    if (x.kind === 'role') return ROLES_INFO[x.id]?.title || { en: x.id };
    return { en: x.id };
  }
  function missing(ref, kind, text) {
    return { ref, kind, title: { en: refTitle(ref).en || ref.id }, now: null, why: null, what: { text: { en: text }, sources: [] }, who: null, sources: [], actions: [] };
  }

  // ------------------------------------------------------------------------------------- describe
  function describe(subject, t = time?.t) {
    const hit = subject && typeof subject === 'object' && subject.ref && !subject.kind?.match?.(/^(actor|el|zone)$/) ? subject : null;
    const r = parseRef(hit ? hit.ref : subject);
    if (!r) return null;
    switch (r.kind) {
      case 'actor': return describeActor(r.id, t);
      case 'crowd': { const x = crowdOf(r.id); return x ? describeCrowd(x.entry, x.crowd, x.index, t) : missing(r, 'person', 'This group is not in the scene now.'); }
      case 'el': return describeObject(r.id, t);
      case 'fire': return describeObject(r.id, t, true);
      case 'zone': return describePlace(r.id, t, hit?.at);
      case 'event': return describeEvent(r.id, t);
      case 'offering': return describeOffering(r.id, t);
      case 'term': return describeTerm(r.id);
      case 'role': return describeRole(r.id, t);
      default: return missing(r, r.kind, '');
    }
  }

  return {
    describe, anchorOf, heightOf, nearby, thingsIn, locate, actorOf, crowdOf, whoOf, describeFigure, labelOf,
    get hookCoverage() { return coverage; },
  };
}

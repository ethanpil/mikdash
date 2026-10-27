// The area banner (console §4.5): the place's name, calligraphic, in the upper third of the free area — ENTERING on foot
// (after a 0.8 s dwell, once per place per 60 s, ≥ 2 s apart) and during a trip (the travel core's travel:zone; quick
// successions swap the title in place and keep a "via A · B" breadcrumb), ARRIVED at the end of any trip. Places an
// Israelite could not enter (rung ≥ 7, entered from below) get the restricted variant with their own access rule and
// source; it replaces the old access notice (90 s per place) and has its own setting. A click opens the place's card.
import { h, he, setText } from '../dom.js';
import { LADDER, RESTRICTED_RUNG } from '../data.js';
import { accessLead, hasCitation, clock } from '../format.js';
import { runShow } from './eventrow.js';

const DWELL = 800, SAME_ZONE = 60000, GAP = 2000, SWAP = 1500, RESTRICTED_REPEAT = 90000, QUIET = 1000;
const MS = { normal: 3200, restricted: 4200 };

export function createBanner(app) {
  const { ctx, data } = app;
  const kicker = h('span.mk-banner__kick');
  const storey = h('span.mk-banner__storey', { hidden: true });
  const heEl = he('', 'mk-banner__he');
  const enEl = h('span.mk-banner__en');
  const rungs = h('span.mk-rungs.mk-banner__rungs', { 'aria-hidden': 'true' }, LADDER.map((_, i) => h('i', { style: { height: `${3 + i}px` } })));
  const rule = h('p.mk-banner__rule', { hidden: true });
  const via = h('span.mk-banner__via', { hidden: true });
  const more = h('span.mk-banner__more', 'More ›', h('span.mk-kbd.mk-chipcap', { 'data-cap': 'here' }));
  const main = h('button.mk-banner__main', { type: 'button', on: { click: () => open() } },
    h('span.mk-banner__top', kicker, storey), h('i.mk-banner__line', { 'aria-hidden': 'true' }), heEl, enEl,
    h('span.mk-banner__foot', rungs, via, more), rule);
  const showBtn = h('button.mk-btn.mk-btn--sm.mk-banner__show', { type: 'button', hidden: true }, 'Show me ▸');
  const modBtn = h('button.mk-btn.mk-btn--sm.mk-banner__mod', { type: 'button', hidden: true });
  const el = h('div.mk-banner.mk-live', { role: 'group', 'aria-label': 'Place', hidden: true }, main, h('div.mk-banner__acts', showBtn, modBtn));
  const live = h('div.sr-only', { 'aria-live': 'polite' });
  const wrap = h('div.mk-bannerwrap', el, live);

  const log = []; // the last 10: { zone, kind, text, t }
  const lastShown = new Map(); // zone -> ms
  const restrictedAt = new Map(); // zone -> ms
  let cur = null; // { zone, kind, shownAt, until, crumbs[] }
  let pend = null; // on foot: { zone, at }
  let held = null; // held while a full sheet is up / gap not over: { zone, kind, opts }
  let lastAt = -1e9, hideT = 0, prevRung = null, prevZone = null, hover = false, rectAt = 0, rectBox = null;

  const rungOf = (id) => data.rung(id);
  const nameOf = (id) => {
    const z = data.zone(id);
    return { en: (z?.name?.en || (id ? id : 'Outside the precinct')).split(' — ')[0], he: z?.name?.he?.split(' — ')[0] || '' };
  };
  const trip = () => app.travel?.trip;
  // a walk or run under way (whoever started it): the player names each place it crosses (travel:zone)
  let walking = null;
  // any trip under way (instant too, whoever started it): no on-foot banners during it, nor for the place it ended in
  // for QUIET ms after it (a late zone:change), so a trip shows its own banners and ARRIVED only. A real step into
  // another place just after a trip is still named
  let tripId = null, tripWay = null, quietUntil = 0, quietZone = null, tripLabel = null;
  const inTrip = () => tripId !== null || !!trip();
  const quiet = (id) => id === quietZone && performance.now() < quietUntil;
  const sameTrip = (cur0, id) => cur0 !== null && (id == null || cur0 === true || id === cur0);
  ctx.bus.on('travel:start', (e) => {
    walking = e?.way && e.way !== 'instant' ? e.id ?? true : null;
    tripId = e?.id ?? true;
    tripWay = e?.way || null;
    quietZone = null;
    tripLabel = typeof e?.label === 'string' ? e.label : e?.label?.en || null;
    pend = null;
    if (held && !held.opts?.travel) held = null;
  });
  ctx.bus.on('travel:end', (e) => {
    if (sameTrip(walking, e?.id)) walking = null;
    if (sameTrip(tripId, e?.id)) { tripId = null; quietZone = quietZone ?? data.currentZoneId(); quietUntil = performance.now() + QUIET; }
    // ARRIVED for any trip (the map's, the director's, a module's), once per trip: from its final travel:zone, else here
    if (e?.ok && (e.reason === 'arrived' || e.reason === 'skipped')) arriveFor(e.id, null);
  });
  // ARRIVED once per trip id; go.js only adds its context (the event watched, the place name) through its trip
  const arrivedIds = [];
  function arriveFor(id, zone) {
    if (id != null) {
      if (arrivedIds.includes(id)) return;
      arrivedIds.push(id);
      if (arrivedIds.length > 16) arrivedIds.shift();
    }
    const t = trip();
    const c = t && (t.cid == null || id == null || t.cid === id) ? t : null;
    arrive({ eventTitle: c?.evTitle || null, eventId: c?.eventId || null, label: c?.place || tripLabel, zone: zone ?? data.currentZoneId() });
  }

  /** should a place banner show now (settings, welcome)? kind 'enter' | 'arrive' | 'restricted' */
  function allowed(kind) {
    if (app.welcomeOpen?.()) return false;
    if (kind === 'restricted') return ctx.settings.get('restrictedNotices') !== false;
    const a = ctx.settings.get('areaNames') || 'always';
    if (a === 'off') return false;
    if (a === 'travel') return !!trip() || tripId !== null || kind === 'arrive';
    return true;
  }

  function restrictedLine(id) {
    const r = rungOf(id);
    const z = data.zone(id);
    const L = LADDER[r];
    const access = String(z?.access || '').trim();
    const lead = accessLead(access) || `${L.rule}.`;
    const src = L.src && !hasCitation(lead) ? ` (${L.src})` : '';
    return `${lead}${src}${r >= 9 ? ' You see it here as an observer.' : ''}`;
  }

  function render(id, kind, opts = {}) {
    const n = opts.text ? (typeof opts.text === 'string' ? { en: opts.text } : opts.text) : nameOf(id);
    const r = id ? rungOf(id) : null;
    const restricted = kind === 'restricted';
    setText(kicker, kind === 'arrive' ? (opts.eventTitle ? 'In place to watch' : 'Arrived') : 'Entering');
    setText(heEl, n.he || '');
    heEl.hidden = !n.he;
    setText(enEl, opts.eventTitle || n.en);
    rungs.hidden = r === null;
    if (r !== null) [...rungs.children].forEach((b, i) => { b.className = i === r ? 'cur' : (i < r ? 'on' : ''); });
    const lvl = id ? app.mapModel?.()?.get(id)?.level : null;
    const tag = lvl && lvl !== 'ground' ? { upper: 'Upper storey', roof: 'On the roof', below: 'Below ground' }[lvl] : '';
    setText(storey, tag);
    storey.hidden = !tag;
    rule.hidden = !restricted;
    // a whole sentence, not a fragment under the name: "Who may enter: Kohanim only… (Kelim 1:8)"
    if (restricted) setText(rule, `Who may enter: ${restrictedLine(id)}`);
    el.classList.toggle('is-restricted', restricted);
    more.hidden = !id;
    // ARRIVED at an event that has not begun: Show me its start
    const ev = opts.eventId ? ctx.schedule?.byId?.(opts.eventId) : null;
    const showable = !!(ev && ctx.inspect?.seeInAction && !data.isActive(ev));
    showBtn.hidden = !showable;
    showBtn.onclick = showable ? () => runShow(app, `event:${ev.id}`) : null;
    main.setAttribute('aria-label', `${kicker.textContent}: ${opts.eventTitle || n.en}. Open this place`);
  }

  function setCrumbs() {
    const c = cur?.crumbs || [];
    via.hidden = !c.length;
    setText(via, c.length ? `via ${c.join(' · ')}` : '');
  }

  function show(id, kind, opts = {}) {
    const now = performance.now();
    // a held full sheet keeps only the latest; shown on close if still there
    if (app.bannerHeld?.()) { held = { id, kind, opts }; return; }
    const quick = cur && !el.hidden && opts.travel && cur.travel && now - cur.shownAt < SWAP && kind !== 'arrive';
    if (quick) {
      // the title swaps in place; the previous name moves into the breadcrumb
      cur.crumbs = [...(cur.crumbs || []), nameOf(cur.zone).en].slice(-3);
      cur.zone = id; cur.kind = kind; cur.shownAt = now;
      render(id, kind, opts);
      setCrumbs();
    } else {
      cur = { zone: id, kind, shownAt: now, travel: !!opts.travel, crumbs: opts.keepCrumbs && cur ? cur.crumbs : [] };
      render(id, kind, opts);
      setCrumbs();
      el.hidden = false;
      el.classList.remove('in');
      void el.offsetWidth;
      el.classList.add('in');
    }
    lastAt = now;
    if (id) lastShown.set(id, now);
    const ms = kind === 'restricted' ? MS.restricted : MS.normal;
    cur.until = now + ms;
    clearTimeout(hideT);
    hideT = setTimeout(hideSoon, ms);
    const n = opts.eventTitle ? { en: opts.eventTitle } : (opts.text ? (typeof opts.text === 'string' ? { en: opts.text } : opts.text) : nameOf(id));
    const r = id ? rungOf(id) : null;
    const sanctSaid = id && data.split(id) ? ', half in kodesh and half in chol' : r !== null ? `, sanctity of ${LADDER[r].en.replace(/^The /, 'the ')}` : '';
    const said = `${kind === 'arrive' ? (opts.eventTitle ? 'In place to watch' : 'Arrived at') : 'Entering'} ${n.en}${kind !== 'arrive' ? sanctSaid : ''}${kind === 'restricted' ? `. ${restrictedLine(id)}` : ''}`;
    setText(live, '');
    requestAnimationFrame(() => setText(live, said));
    log.push({ zone: id, kind, text: n.en, t: ctx.time?.t ?? null, via: [...(cur.crumbs || [])] });
    while (log.length > 10) log.shift();
    // module hook: one action on the banner (the first module that offers it), e.g. "Narrate"
    const mb = id ? app.modules?.banner?.(id) : null;
    modBtn.hidden = !mb?.action;
    if (mb?.action) {
      modBtn.textContent = app.modules.t(mb.action.label) || 'More';
      modBtn.onclick = () => { try { mb.action.run(); } catch (e) { console.error('[ui] module banner action', e); } };
    }
  }
  function hideSoon() {
    if (hover) { hideT = setTimeout(hideSoon, 600); return; }
    el.classList.remove('in');
    setTimeout(() => { if (!el.classList.contains('in')) el.hidden = true; }, 260);
  }
  main.addEventListener('pointerenter', () => { hover = true; });
  main.addEventListener('pointerleave', () => { hover = false; });
  main.addEventListener('focus', () => { hover = true; });
  main.addEventListener('blur', () => { hover = false; });

  function open() {
    if (!cur?.zone) return;
    const here = data.currentZoneId() === cur.zone;
    app.open('here', { zone: cur.zone, pinned: true, passedAt: here ? null : clock(ctx.time?.t) });
  }

  /** a new place on foot: dwell, then show */
  function enter(id, prev) {
    const r = rungOf(id);
    const pr = prevZone === null ? null : rungOf(prevZone);
    prevZone = id;
    // (a chamber half in chol is not closed to an Israelite as a whole: no restricted variant)
    const restricted = r !== null && r >= RESTRICTED_RUNG && (pr === null || r > pr) && !data.split(id);
    pend = { zone: id, at: performance.now(), restricted, prev };
    prevRung = r;
  }
  function decide(p, travel) {
    const now = performance.now();
    if (p.restricted && allowed('restricted') && now - (restrictedAt.get(p.zone) ?? -1e9) >= RESTRICTED_REPEAT) {
      restrictedAt.set(p.zone, now);
      queue(p.zone, 'restricted', { travel });
      return;
    }
    if (!allowed('enter')) return;
    if (!travel && now - (lastShown.get(p.zone) ?? -1e9) < SAME_ZONE) return;
    queue(p.zone, 'enter', { travel });
  }
  function queue(id, kind, opts) {
    const now = performance.now();
    if (!opts.travel && now - lastAt < GAP) { held = { id, kind, opts, gap: true }; return; }
    show(id, kind, opts);
  }

  ctx.bus.on('zone:change', (e) => {
    const id = typeof e?.zone === 'string' ? e.zone : (e?.zone?.id ?? null);
    if (!id) return;
    // during a trip (and just after it), travel:zone names each place crossed (exact, no flicker) and ARRIVED the
    // last; zone:change is for on foot
    if (walking !== null || inTrip() || quiet(id)) { prevZone = id; prevRung = rungOf(id); pend = null; return; }
    enter(id, e?.prev);
  });
  ctx.bus.on('travel:zone', (e) => {
    if (!e?.zone) return;
    if (e.final) { quietZone = e.zone; arriveFor(e.id, e.zone); return; } // the final zone: ARRIVED
    // an instant hop names no place on the way (the travel core reports the one it lands in before arriving)
    if (tripWay === 'instant') { prevZone = e.zone; prevRung = rungOf(e.zone); return; }
    const r = rungOf(e.zone);
    const pr = e.prev ? rungOf(e.prev) : (prevZone ? rungOf(prevZone) : null);
    prevZone = e.zone;
    prevRung = r;
    pend = null;
    decide({ zone: e.zone, restricted: r !== null && r >= RESTRICTED_RUNG && (pr === null || r > pr) && !data.split(e.zone) }, true);
  });

  const caps = () => { for (const k of el.querySelectorAll('[data-cap]')) { const v = app.input.cap(k.dataset.cap); setText(k, v || ''); k.hidden = !v; } };
  app.input.on(caps);
  caps();

  /** end of a trip (walk, run or instant): ARRIVED with the destination, or "In place to watch: X" */
  function arrive({ eventTitle = null, label = null, zone = null, eventId = null } = {}) {
    pend = null;
    prevZone = zone;
    if (!allowed('arrive')) return;
    const keep = cur && !el.hidden && cur.travel;
    show(zone, 'arrive', { eventTitle, eventId, travel: true, keepCrumbs: keep, text: !zone && label ? label : null });
  }

  return {
    el: wrap,
    /** ARRIVED for a trip the travel core does not report (no travel:* events): go.js's fallback */
    arrive,
    /** ctx.ui.banner(zoneId | { en, he }, { kind }) */
    show(z, { kind = 'enter' } = {}) {
      if (typeof z === 'string') show(z, kind === 'arrive' ? 'arrive' : kind, {});
      else if (z) show(null, kind, { text: z });
    },
    tick() {
      const now = performance.now();
      if (pend && (inTrip() || quiet(pend.zone))) pend = null;
      if (held && !held.opts?.travel && (inTrip() || quiet(held.id))) held = null;
      if (pend && now - pend.at >= DWELL) {
        const p = pend;
        pend = null;
        if (data.currentZoneId() === p.zone) decide(p, !!trip());
      }
      if (held && !app.bannerHeld?.() && (!held.gap || now - lastAt >= GAP)) {
        const hd = held;
        held = null;
        if (hd.gap || data.currentZoneId() === hd.id || hd.kind === 'arrive') show(hd.id, hd.kind, hd.opts);
      }
    },
    get list() { return log.slice(); },
    get visible() { return !el.hidden; },
    /** the banner's box while it shows (client px; re-measured at most every 500 ms), else null: markers keep their
     * labels out of it */
    rect() {
      if (el.hidden || !el.classList.contains('in')) { rectAt = 0; return null; }
      const now = performance.now();
      if (!rectAt || now - rectAt > 500) { const r = el.getBoundingClientRect(); rectBox = { l: r.left, t: r.top, r: r.right, b: r.bottom }; rectAt = now; }
      return rectBox;
    },
  };
}

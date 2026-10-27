// Travel (console §3.3.7, §4.3): the one Go control (way Walk | Run | Instant, pace ½× 1× 2× 5× 10×; the choice becomes
// the default), the travel bar (label, distance, time left, pace, way, Skip, Stop), and the action runner for cards
// (go / see-in-action / follow / map / learn / time).
// Trips run on the player's travel API (goTo(target, { way, pace, label }), setPace, setWay, finishTrip) and its bus
// travel:* events (distance, progress, ETA, pace; docs/decisions/console-travel.md).
import { h, setText } from '../dom.js';
import { ico } from './icons.js';
import { w2m } from '../../core/units.js';
import { PACES } from '../settings.js';

const WAYS = [['walk', 'Walk'], ['run', 'Run'], ['instant', 'Instant']];
const PACE_LABEL = { 0.5: '½×', 1: '1×', 2: '2×', 5: '5×', 10: '10×' };
const VERB = { walk: 'Walking', run: 'Running', instant: 'Moving' };
const midSentence = (name) => String(name || 'that spot').replace(/^The /, 'the ');

export function createTravel(app) {
  const { ctx } = app;
  const S = ctx.settings;
  const P = () => ctx.player;

  const defaults = () => ({ way: S.get('travelWay') || 'walk', pace: S.get('travelPace') || 1 });
  function setDefaults(way, pace) {
    if (way) S.set('travelWay', way);
    if (pace) S.set('travelPace', pace);
  }
  const wayLabel = (way, pace) => (way === 'instant' ? 'Instant' : `${way === 'run' ? 'Run' : 'Walk'} · ${PACE_LABEL[pace] || `${pace}×`}`);

  // ---------------- the trip ----------------
  let trip = null; // { key, label, way, pace, to, event, distance, remaining, eta, pathSite, cid }
  let token = 0;
  const live = h('div.sr-only', { 'aria-live': 'polite' });
  const say = (t) => { setText(live, ''); requestAnimationFrame(() => setText(live, t)); };

  /**
   * target: goTo target ({ at:[X,Y(,Z)], heading?, look? } | anchor | Vector3). opts: { label (place name), event (title:
   * "watch: …"), eventId, way, pace }. Resolves true on arrival.
   */
  function start(target, opts = {}) {
    const d = defaults();
    const way = opts.way || d.way;
    const pace = opts.pace || d.pace;
    const evTitle = opts.event || null;
    const label = evTitle ? `watch: ${evTitle}` : midSentence(opts.label);
    const my = ++token;
    const at = Array.isArray(target?.at) ? target.at : null;
    trip = { key: my, label, place: opts.label || null, way, pace, to: at, eventId: opts.eventId || null, evTitle, distance: null, remaining: null, eta: null, pathSite: null, effectivePace: pace };
    app.onTripStart?.(trip);
    if (way !== 'instant') {
      showBar(true);
      // announced once the distance is known (travel:start)
      setTimeout(() => { if (trip?.key === my) say(`${VERB[way]} to ${label}${trip.distance ? `, ${Math.round(trip.distance)} metres` : ''}`); }, 350);
    }
    return new Promise((res) => res(P().goTo(target, { way, pace, label: { en: label } }))).then((ok) => {
      if (my !== token) return ok;
      const done = trip;
      trip = null;
      showBar(false);
      if (ok) {
        // ARRIVED is the banner's (from travel:zone final / travel:end, with this trip's event and place as context);
        // only a travel core that reports no trip (no travel:start) leaves it to us
        if (done?.cid == null) app.banner?.arrive({ eventTitle: evTitle, label: opts.label, zone: app.data.currentZoneId(), eventId: done?.eventId });
        if (way !== 'instant') say(evTitle ? `In place to watch: ${evTitle}` : `Arrived at ${label}`);
      }
      app.onTripEnd?.(ok);
      return ok;
    }).catch((e) => { if (my === token) { trip = null; showBar(false); app.onTripEnd?.(false); } console.error('[ui] goTo failed', e); return false; });
  }
  function goEvent(ev, opts = {}) {
    const target = app.data.viewTarget(ev);
    if (!target) { app.toast('No viewing place is given for this event'); return Promise.resolve(false); }
    return start(target, { ...opts, event: ev.title?.en || ev.id, eventId: ev.id });
  }
  function goZone(id, opts = {}) {
    const z = app.data.zone(id) || {};
    if (z.stand === null) { app.toast(`${(z.name?.en || id).split(' — ')[0]} has no floor to stand on; it is seen from the places around it.`); return Promise.resolve(false); }
    let p = app.data.point(z.stand);
    const m = app.mapModel?.()?.get(id);
    if (!p && m) p = [m.anchor?.[0] ?? (m.main[0][0] + m.main[1][0]) / 2, m.anchor?.[1] ?? (m.main[0][1] + m.main[1][1]) / 2, m.floorZ];
    if (!p) return Promise.resolve(false);
    return start(Number.isFinite(p[2]) ? { at: [p[0], p[1], p[2]] } : { at: [p[0], p[1]] }, { ...opts, label: z.name?.en?.split(' — ')[0] || id });
  }

  // ---------------- travel core events ----------------
  const mine = (e) => trip && (trip.cid == null || e?.id == null || e.id === trip.cid);
  ctx.bus.on('travel:start', (e) => {
    if (!trip) return;
    trip.cid = e?.id;
    if (Number.isFinite(e?.distance)) { trip.distance = e.distance; trip.remaining = e.distance; }
    if (Number.isFinite(e?.eta)) trip.eta = e.eta;
    paint(true);
  });
  ctx.bus.on('travel:progress', (e) => {
    if (!mine(e)) return;
    if (Number.isFinite(e.remaining)) trip.remaining = e.remaining;
    if (Number.isFinite(e.eta)) trip.eta = e.eta;
    if (Number.isFinite(e.effectivePace)) trip.effectivePace = e.effectivePace;
  });
  ctx.bus.on('travel:pace', (e) => {
    if (!mine(e)) return;
    if (Number.isFinite(e.pace)) trip.pace = e.pace;
    if (e.way) trip.way = e.way;
    paint(true);
  });

  function setPace(p) {
    if (!trip) return;
    const v = P().setPace(p);
    trip.pace = Number.isFinite(v) ? v : p;
    if (PACES.includes(trip.pace)) S.set('travelPace', trip.pace);
    paint(true);
    say(`Pace ${PACE_LABEL[trip.pace] || `${trip.pace}×`}`);
  }
  const step = (d) => {
    if (!trip) return false;
    const i = PACES.indexOf(PACES.reduce((a, b) => (Math.abs(b - trip.pace) < Math.abs(a - trip.pace) ? b : a)));
    const j = Math.max(0, Math.min(PACES.length - 1, i + d));
    if (j !== i) setPace(PACES[j]);
    return true;
  };
  function setWay(w) {
    if (!trip || trip.way === 'instant') return;
    P().setWay(w);
    trip.way = w;
    S.set('travelWay', w);
    paint(true);
  }
  function stop() { try { P()?.cancel?.(); } catch { /* ignore */ } }
  function skip() { if (trip) P().finishTrip(); }

  // ---------------- the bar ----------------
  const icoBox = h('span.mk-travel__ico');
  const txt = h('span.mk-travel__txt');
  const paceSeg = h('div.mk-seg.mk-travel__pace', { role: 'group', 'aria-label': 'Pace' }, PACES.map((p) => h('button', {
    type: 'button', 'data-pace': p, 'aria-pressed': 'false', on: { click: () => setPace(p) },
  }, PACE_LABEL[p])));
  const slower = h('button.mk-hbtn.mk-travel__step', { type: 'button', 'aria-label': 'Slower', on: { click: () => step(-1) } }, ico('minus'), h('span.mk-travel__lbl', 'Slower'), h('span.mk-kbd.mk-chipcap', { 'data-cap': 'slower' }));
  const faster = h('button.mk-hbtn.mk-travel__step', { type: 'button', 'aria-label': 'Faster', on: { click: () => step(1) } }, ico('plus'), h('span.mk-travel__lbl', 'Faster'), h('span.mk-kbd.mk-chipcap', { 'data-cap': 'faster' }));
  const waySeg = h('div.mk-seg.mk-travel__way', { role: 'group', 'aria-label': 'Way' },
    h('button', { type: 'button', 'data-way': 'walk', on: { click: () => setWay('walk') } }, 'Walk'),
    h('button', { type: 'button', 'data-way': 'run', on: { click: () => setWay('run') } }, 'Run'));
  const skipBtn = h('button.mk-hbtn', { type: 'button', on: { click: skip }, title: 'Arrive at once' }, ico('skip'), h('span', 'Skip'));
  const stopBtn = h('button.mk-hbtn.mk-travel__stop', { type: 'button', on: { click: stop } }, ico('stop'), h('span', 'Stop'));
  const bar = h('div.mk-travel.mk-glass.mk-live', { hidden: true, role: 'group', 'aria-label': 'Travelling' },
    h('div.mk-travel__line', icoBox, txt),
    h('div.mk-travel__ctl', paceSeg, h('div.mk-travel__steps', slower, faster), waySeg, skipBtn, stopBtn), live);
  const vignette = h('div.mk-vignette', { 'aria-hidden': 'true' });

  function showBar(on) {
    bar.hidden = !on;
    app.root.classList.toggle('mk-travelling', on);
    if (!on) { vignette.classList.remove('on'); setText(txt, ''); }
    paint(true);
  }
  let lastTxt = '', lastKey = '';
  function paint(force = false) {
    if (!trip) return;
    const key = `${trip.way}|${trip.pace}|${trip.effectivePace}`;
    if (force || key !== lastKey) {
      lastKey = key;
      icoBox.replaceChildren(ico(trip.way === 'run' ? 'run' : 'walk'));
      for (const b of paceSeg.children) b.setAttribute('aria-pressed', +b.dataset.pace === trip.pace ? 'true' : 'false');
      for (const b of waySeg.children) b.setAttribute('aria-pressed', b.dataset.way === trip.way ? 'true' : 'false');
      vignette.classList.toggle('on', (trip.effectivePace || trip.pace) >= 5 && trip.way !== 'instant');
    }
    const parts = [`${VERB[trip.way] || 'Walking'} to ${trip.label}`];
    if (Number.isFinite(trip.remaining)) parts.push(`${Math.max(1, Math.round(trip.remaining))} m`);
    if (Number.isFinite(trip.eta)) parts.push(`~${fmtEta(trip.eta)}`);
    const s = parts.join(' · ');
    if (s !== lastTxt) { lastTxt = s; setText(txt, s); }
  }
  const fmtEta = (s) => (s < 60 ? `${Math.max(1, Math.round(s))} s` : `${Math.round(s / 60)} min`);

  // the planned path in site amot (the route line on the minimap and the map)
  function pathSite() {
    const p = P()?.path;
    if (!Array.isArray(p) || p.length < 2) return null;
    return p.map((v) => { const s = w2m(v); return [s.X, s.Y]; });
  }
  let acc = 0;
  function tick(dt) {
    if (!trip) return;
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    const ps = pathSite();
    if (ps) trip.pathSite = ps;
    paint();
  }

  // ---------------- the Go control ----------------
  // one shared popover for every Go control (only one is open at a time)
  const wayRadios = h('div.mk-seg.mk-gomenu__way', { role: 'radiogroup', 'aria-label': 'How' }, WAYS.map(([v, l]) => h('button', {
    type: 'button', role: 'radio', 'data-way': v, 'aria-checked': 'false', on: { click: () => { setDefaults(v, null); paintMenu(); } },
  }, ico(v === 'instant' ? 'instant' : v), l)));
  const paceRow = h('div.mk-seg.mk-gomenu__pace', { role: 'radiogroup', 'aria-label': 'Pace' }, PACES.map((p) => h('button', {
    type: 'button', role: 'radio', 'data-pace': p, 'aria-checked': 'false', on: { click: () => { setDefaults(null, p); paintMenu(); } },
  }, PACE_LABEL[p])));
  const goNow = h('button.mk-btn.mk-btn--primary.mk-gomenu__go', { type: 'button', on: { click: () => { const fn = menuFor?.run; closeMenu(); fn?.(); } } }, ico('go'), 'Go');
  const menu = h('div.mk-pop.mk-gomenu.mk-live', { hidden: true, role: 'dialog', 'aria-label': 'How to go' },
    h('div.mk-gomenu__row', h('span.mk-gomenu__k', 'How'), wayRadios),
    h('div.mk-gomenu__row.mk-gomenu__pacerow', h('span.mk-gomenu__k', 'Pace'), paceRow),
    h('p.mk-gomenu__note', 'These become your defaults.'), goNow);
  let menuFor = null;
  function paintMenu() {
    const d = defaults();
    for (const b of wayRadios.children) b.setAttribute('aria-checked', b.dataset.way === d.way ? 'true' : 'false');
    for (const b of paceRow.children) { b.setAttribute('aria-checked', +b.dataset.pace === d.pace ? 'true' : 'false'); b.disabled = d.way === 'instant'; }
    repaintControls();
  }
  function openMenu(anchor, run) {
    if (menuFor?.anchor === anchor && !menu.hidden) { closeMenu(); return; }
    menuFor = { anchor, run };
    paintMenu();
    menu.hidden = false;
    const r = anchor.getBoundingClientRect();
    const w = Math.min(320, innerWidth - 16);
    menu.style.width = `${w}px`;
    const left = Math.max(8, Math.min(innerWidth - w - 8, r.left));
    const below = r.bottom + 6 + 170 < innerHeight;
    menu.style.left = `${left}px`;
    menu.style.top = below ? `${r.bottom + 6}px` : '';
    menu.style.bottom = below ? '' : `${innerHeight - r.top + 6}px`;
    anchor.setAttribute('aria-expanded', 'true');
    wayRadios.querySelector('[aria-checked=true]')?.focus();
  }
  function closeMenu() {
    if (menu.hidden) return;
    menu.hidden = true;
    menuFor?.anchor?.setAttribute('aria-expanded', 'false');
    menuFor = null;
  }
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('.mk-go__more')) closeMenu(); }, true);
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); const a = menuFor?.anchor; closeMenu(); a?.focus(); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const g = e.target.closest('[role=radiogroup]');
      if (!g) return;
      const bs = [...g.querySelectorAll('button:not([disabled])')];
      const i = bs.indexOf(e.target);
      const n = bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length];
      e.preventDefault();
      n.click();
      n.focus();
    }
  });
  // live Go controls are found in the page when they need a repaint (a way / pace / input change): nothing keeps a
  // detached card, event row or search result alive (a module-level set of them held every one ever made)
  const repaintControls = () => {
    for (const el of document.querySelectorAll('.mk-go')) { try { el._mkPaint?.(); } catch { /* ignore */ } }
  };

  /**
   * A Go split button. run(): starts the trip with the defaults. opts: { label = 'Go', primary = true, small }.
   * Returns the element; it repaints its "Walk · 2×" when the defaults change.
   */
  function control(run, opts = {}) {
    const sub = h('span.mk-go__sub');
    const main = h(`button.mk-btn${opts.primary === false ? '' : '.mk-btn--primary'}${opts.small ? '.mk-btn--sm' : ''}.mk-go__main`, {
      type: 'button', 'data-act': 'go', on: { click: () => { closeMenu(); run(); } },
    }, ico('go'), h('span.mk-go__lbl', opts.label || 'Go'), h('span.mk-kbd.mk-chipcap', { 'data-cap': 'go' }));
    const more = h(`button.mk-btn${opts.small ? '.mk-btn--sm' : ''}.mk-go__more`, {
      type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: 'How to go: walk, run or at once; pace',
      on: { click: (e) => { e.stopPropagation(); openMenu(more, run); } },
    }, sub, ico('down'));
    const el = h('span.mk-go', main, more);
    const paintOne = () => {
      const d = defaults();
      const t = wayLabel(d.way, d.pace);
      if (sub.textContent !== t) { setText(sub, t); more.setAttribute('aria-label', `How to go: ${t}. Change`); main.setAttribute('aria-label', `${opts.label || 'Go'}: ${t}`); }
      for (const k of el.querySelectorAll('[data-cap]')) { const v = app.input.cap(k.dataset.cap); setText(k, v || ''); k.hidden = !v; }
    };
    el._mkPaint = paintOne;
    paintOne();
    return el;
  }
  ctx.bus.on('settings:change', (e) => { if (e?.key === 'travelWay' || e?.key === 'travelPace') { repaintControls(); if (!menu.hidden) paintMenu(); } });
  app.input.on(() => { repaintControls(); for (const k of bar.querySelectorAll('[data-cap]')) { const v = app.input.cap(k.dataset.cap); setText(k, v || ''); k.hidden = !v; } });

  // ---------------- card actions ----------------
  function runAction(a, card) {
    if (!a) return;
    try {
      switch (a.kind) {
        case 'go': {
          if (a.target) return start(a.target, { label: a.goLabel?.en || card?.title?.en, event: a.eventId ? (a.goLabel?.en || card?.title?.en) : null, eventId: a.eventId });
          if (a.eventId) { const ev = ctx.schedule?.byId?.(a.eventId); if (ev) return goEvent(ev); }
          if (a.zone) return goZone(a.zone);
          return null;
        }
        case 'see-in-action': {
          if (!ctx.inspect?.seeInAction) return null;
          if (trip) stop();
          return ctx.inspect.seeInAction(a);
        }
        case 'follow': return ctx.inspect?.follow?.(a.ref || card?.ref || null);
        case 'map': return app.open('map', { zone: a.zone || card?.zone, event: a.eventId || null });
        case 'learn': return a.ref ? app.card(a.ref) : app.open('learn', a.section ? { section: a.section } : {});
        case 'time': {
          if (!ctx.time || !Number.isFinite(a.tSet)) return null;
          if (a.date && a.date !== ctx.time.dateString) ctx.time.setDate(a.date);
          ctx.time.set(a.tSet);
          app.announce?.(`Clock set to about ${String(Math.floor(a.tSet / 60)).padStart(2, '0')}:${String(Math.round(a.tSet % 60) % 60).padStart(2, '0')}`);
          return true;
        }
        default:
          if (typeof a.run === 'function') return a.run();
      }
    } catch (e) { console.error('[ui] action failed', a?.kind, e); }
    return null;
  }

  return {
    bar, vignette, menu,
    defaults, setDefaults, wayLabel,
    start, goEvent, goZone, stop, skip, setPace, setWay,
    faster: () => step(1), slower: () => step(-1),
    get trip() { return trip; },
    control, closeMenu, runAction,
    /** the trip's route in site amot (minimap, map), or null */
    routeSite() {
      if (!trip || trip.way === 'instant') return null;
      const ps = trip.pathSite || pathSite();
      const pos = P()?.position;
      if (!ps) return trip.to && pos ? [[w2m(pos).X, w2m(pos).Y], [trip.to[0], trip.to[1]]] : null;
      if (!pos) return ps;
      const s = w2m(pos);
      let bi = 0, bd = Infinity;
      ps.forEach((q, i) => { const d = (q[0] - s.X) ** 2 + (q[1] - s.Y) ** 2; if (d < bd) { bd = d; bi = i; } });
      return [[s.X, s.Y], ...ps.slice(bi + 1)];
    },
    routeKey: () => (trip ? String(trip.key) : ''),
    tick,
  };
}

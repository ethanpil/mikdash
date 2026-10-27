// The UI application (the Luach console, docs/console-design.md): the Menu beacon, the Menu (docked or a sheet) with
// its header and eight sections, cards, search, travel, the area banner, activity markers, pointing at people and
// things, captions, notices, the veil, the Welcome, the gamepad — one throttled ticker. Keyboard and pointer-lock rules
// per §2.2–2.4. The inspect core (ctx.inspect) is feature-detected: it is absent with ?inspect=0, and then cards for
// places, rites, words, offerings, roles and elements come from the UI's own describer (console/describe.js).
import './styles.css';
import './console/console.css';
import { PRIORITY } from '../core/engine.js';
import { h, he, setText } from './dom.js';
import { createData } from './data.js';
import { createModel } from './map/model.js';
import { createInputMode } from './console/inputmode.js';
import { createLayout } from './console/layout.js';
import { createContent } from './console/content.js';
import { createDescriber, parseRef, refStr } from './console/describe.js';
import { createModules } from './console/modules.js';
import { createSearchEngine, addUiSources, createSearchUI } from './console/search.js';
import { createTravel } from './console/go.js';
import { createBanner } from './console/banner.js';
import { createCaptions } from './console/captions.js';
import { createShowBar } from './console/showbar.js';
import { createMarkers } from './console/markers.js';
import { createPickUI } from './console/pickui.js';
import { createGamepad } from './console/gamepad.js';
import { createMinimapRaster } from './console/minimap.js';
import { createBeacon } from './console/beacon.js';
import { createConsole } from './console/console.js';
import { createWelcome } from './console/welcome.js';
import { eventRow, runShow } from './console/eventrow.js';
import { ico } from './console/icons.js';
import { hereSection } from './console/sections/here.js';
import { happeningSection } from './console/sections/happening.js';
import { mapSection } from './console/sections/map.js';
import { timeSection } from './console/sections/time.js';
import { learnSection } from './console/sections/learn.js';
import { listenSection } from './console/sections/listen.js';
import { settingsSection } from './console/sections/settings.js';
import { helpSection } from './console/sections/help.js';

const LEGACY = { info: 'here', about: 'learn' };
const KEYS = { KeyM: 'map', KeyT: 'time', KeyI: 'here', KeyG: 'settings' };

export function mountUi(ctx) {
  let root = document.getElementById('ui-root');
  if (!root) { root = h('div#ui-root'); document.body.append(root); }
  root.setAttribute('lang', 'en');
  const mq = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  const coarse = mq('(pointer: coarse)') && !mq('(pointer: fine)');
  const fine = mq('(pointer: fine)');

  const app = {
    ctx, root, coarse, fine,
    settings: ctx.settings,
    data: createData(ctx),
    flags: {},
    reducedMotion: () => !!ctx.settings.get('reducedMotion') || mq('(prefers-reduced-motion: reduce)'),
  };
  let model = null;
  app.mapModel = () => { if (!model) model = createModel(ctx, app.data); return model; };
  app.input = createInputMode(root, { coarse });
  app.layout = createLayout(app, { onChange: () => { menu?.updateFree(); menu?.applyInput(); } });
  app.content = createContent();
  const describer = createDescriber(app);
  app.describe = (ref, t) => describer.describe(ref, t);
  app.titleOf = (ref) => describer.titleOf(ref);
  /** the UI's own place card (Here falls back on its actions) */
  app.placeCard = (id) => describer.place(id);
  app.modules = createModules(app);
  app.searchEngine = createSearchEngine(app);
  app.minimapRaster = createMinimapRaster(app);
  app.eventRow = (ev, opts) => eventRow(app, ev, opts);
  app.runShow = (ref, fallback) => runShow(app, ref, fallback);
  const applyClasses = () => {
    root.classList.toggle('mk-blur', ['high', 'ultra'].includes(ctx.quality?.key));
    root.classList.toggle('mk-reduce', !!ctx.settings.get('reducedMotion'));
    // (the veil's text and the travel vignette live on <body>, outside #ui-root)
    document.body.classList.toggle('mk-reduce', !!ctx.settings.get('reducedMotion'));
    root.classList.toggle('mk-coarse', coarse);
  };
  applyClasses();

  // ---------------- notices (toasts) and the veil ----------------
  const notices = h('div.mk-notices', { 'aria-live': 'polite' });
  /** max 2, top centre of the free area, 3.2 s; opts.id replaces a notice with that id */
  function toast(msg, ms = 3200, { id } = {}) {
    const text = typeof msg === 'string' ? msg : (msg?.en || '');
    if (!text) return;
    if (id) for (const el of notices.querySelectorAll(`[data-toast="${id}"]`)) el.remove();
    const el = h('div.mk-toast.mk-glass', typeof msg === 'object' && msg.he ? [he(msg.he, 'mk-toast__he'), ' '] : null, text);
    if (id) el.dataset.toast = id;
    notices.append(el);
    while (notices.children.length > 2) notices.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, ms);
  }
  app.toast = toast;
  const veil = h('div.mk-veil', { 'aria-hidden': 'true' });
  document.body.append(veil);
  let veilAnim = null, veilSettle = null;
  /** fade(to 0..1, ms) — the player's contract; fade(ms) alone = dip to black, resolve when black, then lift. A fade
   * superseded by a newer one settles at once (its caller must never hang: the director and veiled teleports await it) */
  function fade(a, b) {
    let to, ms, dip = false;
    if (b === undefined && a > 1) { to = 1; ms = a; dip = true; } else { to = Math.max(0, Math.min(1, +a || 0)); ms = b ?? 300; }
    if (app.reducedMotion()) ms = Math.min(ms, 80);
    const from = +getComputedStyle(veil).opacity || 0;
    const prev = veilSettle;
    veilSettle = null;
    veilAnim?.cancel?.();
    prev?.();
    veil.style.opacity = String(from);
    return new Promise((resolve) => {
      const anim = veil.animate?.([{ opacity: from }, { opacity: to }], { duration: Math.max(1, ms), easing: 'ease-in-out', fill: 'forwards' });
      veilAnim = anim;
      let settled = false;
      const settle = () => { if (!settled) { settled = true; resolve(); } };
      veilSettle = settle;
      const done = () => {
        if (veilSettle === settle) veilSettle = null;
        veil.style.opacity = String(to);
        settle();
        if (dip) requestAnimationFrame(() => requestAnimationFrame(() => fade(0, ms * 1.4)));
      };
      if (anim) anim.onfinish = done; else done();
    });
  }
  const live = h('div.sr-only', { 'aria-live': 'polite' });
  app.announce = (t) => { setText(live, ''); requestAnimationFrame(() => setText(live, t)); };

  // ---------------- the parts ----------------
  app.travel = createTravel(app);
  app.captions = createCaptions(app);
  app.showbar = createShowBar(app);
  app.banner = createBanner(app);
  const markers = createMarkers(app);
  const pick = createPickUI(app);
  const pad = createGamepad(app);
  const beacon = createBeacon(app);
  app.beacon = beacon;
  let menu = null;
  menu = createConsole(app);
  app.menuEl = menu.el;
  const search = createSearchUI(app);
  menu.header.searchSlot.append(search.field);
  menu.searchView.append(search.view);
  const welcome = createWelcome(app);
  app.welcome = welcome;
  menu.welcomeView.append(welcome.el);
  addUiSources(app, app.searchEngine);

  // the travel bar: in the HUD, or inside the map while the map covers the world
  const travelSlot = h('div.mk-travelslot', app.travel.bar);
  app.hostTravelBar = (container) => { (container || travelSlot).append(app.travel.bar); };

  // touch flying: labelled Rise / Sink (the travel core's setVertical)
  const vbtn = (dir, icon, label) => {
    const b = h('button.mk-hbtn.mk-vert', { type: 'button', 'aria-label': label },
      ico(icon), h('span', label));
    const set = (v) => { try { ctx.player?.setVertical?.(v); } catch { /* ignore */ } };
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture?.(e.pointerId); set(dir); });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) b.addEventListener(t, () => set(0));
    return b;
  };
  const vert = h('div.mk-vertbar', { hidden: true }, vbtn(1, 'rise', 'Rise'), vbtn(-1, 'sink', 'Sink'));

  // layers, bottom to top (§3.1); the beacon is the first Tab stop
  root.append(beacon.el, markers.el, pick.el, app.captions.el, app.banner.el, travelSlot, app.showbar.bar, app.showbar.chip,
    vert, menu.el, notices, welcome.coach, welcome.ghosts, app.travel.menu, pick.chooser, live, app.showbar.live);
  document.body.append(app.travel.vignette, app.showbar.veilTxt);

  // the captions lane rides above whichever bar is at the bottom (the travel bar, the Show-me bar or its chip): their
  // height varies (one or two rows), so it is measured whenever one of them changes size or shows
  const bottomBars = [app.travel.bar, app.showbar.bar, app.showbar.chip];
  let capGap = -1;
  app.updateCaptionGap = () => {
    let top = Infinity;
    for (const b of bottomBars) { if (b.hidden || !b.isConnected) continue; const r = b.getBoundingClientRect(); if (r.height) top = Math.min(top, r.top); }
    const base = innerHeight - app.layout.free.b;
    const gap = Number.isFinite(top) && top < base ? Math.round(base - top + 6) : 0;
    if (gap !== capGap) { capGap = gap; root.style.setProperty('--mk-bottom-gap', `${gap}px`); }
  };
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => app.updateCaptionGap()); for (const b of bottomBars) ro.observe(b); }

  // ---------------- the Menu API ----------------
  app.menuOpen = () => menu.isOpen;
  app.welcomeOpen = () => welcome.open;
  app.bannerHeld = () => app.layout.isSheet && menu.isOpen && menu.detent === 'full';
  app.fullScreen = () => menu.fullScreen();
  app.openMenu = ({ from = null } = {}) => {
    const sec = app.layout.isSheet ? null : (menu.lastSection || 'here');
    return menu.open(sec, { from });
  };
  app.open = (name, opts = {}) => {
    if (welcome.open) welcome.enter(null, { lock: false });
    let id = LEGACY[name] || name;
    if (name === 'about' && opts.section === 'controls') { id = 'help'; opts = { ...opts, topic: 'controls' }; }
    if (name === 'info' && opts.zone) opts = { ...opts, pinned: true };
    if (!menu.sectionIds().includes(id)) return false;
    return menu.open(id, { from: opts.from || (document.activeElement && root.contains(document.activeElement) && document.activeElement !== document.body ? 'nav' : 'world'), ...opts });
  };
  app.close = (opts) => menu.close(opts);
  app.back = () => (menu.isOpen ? menu.back() : false);
  app.toggle = (name) => {
    const id = LEGACY[name] || name;
    const v = menu.view;
    if (menu.isOpen && v?.type === 'section' && v.id === id) return menu.close();
    return app.open(id, { from: 'world' });
  };
  Object.defineProperty(app, 'section', { get: () => (menu.isOpen && menu.view?.type === 'section' ? menu.view.id : null) });
  app.stepSection = (d) => {
    const ids = menu.sectionIds();
    const cur = menu.section || ids[0];
    const i = ids.indexOf(cur);
    app.open(ids[(i + d + ids.length) % ids.length], { from: 'nav' });
  };
  app.stepClock = (hrs) => app.stepClockFn?.(hrs);
  app.mapPan = (dx, dy) => app.mapPanel?.()?.pan(dx, dy);
  app.mapViewRect = () => app.mapPanel?.()?.viewRect?.();
  app.togglePause = () => { const t = ctx.time; if (t) { t.pause(!t.paused); app.announce(t.paused ? 'Clock paused' : 'Clock playing'); } };
  app.openAbout = () => {
    if (menu.isOpen && menu.view?.type === 'section' && menu.view.id === 'here') menu.sectionInst('here')?.show?.({ scrollTo: 'about' });
    else app.open('here', { from: 'nav', scrollTo: 'about' });
  };
  /** the section a search opened now would sit over (its scope follows it: Places over the Map) */
  const searchBase = () => (menu.isOpen && menu.view?.type === 'section' ? menu.view.id : null);
  app.showSearch = () => {
    if (!menu.isOpen || menu.view?.type !== 'search') {
      search.begin(searchBase());
      menu.pushView({ type: 'search' }, { detent: 'full', from: 'nav' });
    }
    search.render();
  };
  app.search = (q = null, { scope } = {}) => {
    if (welcome.open) welcome.enter(null, { lock: false });
    if (menu.view?.type !== 'search' || !menu.isOpen) search.begin(searchBase(), scope);
    else if (scope) search.setScope(scope);
    if (!menu.isOpen) app.openMenu({ from: 'world' });
    menu.pushView({ type: 'search' }, { detent: 'full', from: 'nav' });
    requestAnimationFrame(() => search.focus(q));
  };
  app.openWelcome = () => { menu.pushView({ type: 'welcome' }, { detent: 'full', from: 'nav' }); requestAnimationFrame(() => welcome.focus()); };
  app.closeWelcome = () => menu.close({ force: true });
  app.whatsAhead = () => pick.pickAt(NaN, NaN, { source: 'key', announceOnly: true });
  app.cardRef = () => (menu.isOpen && menu.view?.type === 'card' ? menu.view.ref : null);
  app.showBackChip = () => app.showbar.showBack();

  /** open the card for a subject: a ref ('kind:id' | { kind, id }) or a pick Hit */
  app.card = (subject, opts = {}) => {
    const r = parseRef(subject);
    if (!r) return false;
    if (welcome.open) welcome.enter(null, { lock: false });
    // places open as Here, pinned (one home for a place card); over a search or a card it is pushed, so Back returns there
    const over = menu.isOpen && (menu.view?.type === 'search' || menu.view?.type === 'card');
    if (r.kind === 'zone') return app.open('here', { zone: r.id, pinned: r.id !== app.data.currentZoneId(), from: 'nav', push: over });
    if (r.kind === 'learn') return app.open('learn', { section: r.id, from: 'nav' });
    if (r.kind === 'help') return app.open('help', { topic: r.id, from: 'nav' });
    if (r.kind === 'setting') { app.openSetting?.(r.id); return true; }
    const card = app.describe(subject?.ref && subject.kind ? subject : refStr(r));
    if (!card) { toast('Nothing is recorded about this yet'); return false; }
    // a card picked in the world with the dock closed is the Menu's only level: Back (Esc, B) returns to the world, not to
    // a section the visitor never opened. Phones keep the tiles under it ("‹ Menu")
    menu.openCard(card, { ...opts, alone: !!opts.fromWorld && !menu.isOpen && !app.layout.isSheet });
    ctx.bus.emit('ui:card', { ref: refStr(parseRef(card.ref)), card });
    // keep the subject in the free area (a 400 ms turn) when it is outside the free area the opened Menu leaves: a pick
    // hit's screen point, else (Nearby, Things here, search) the subject's live anchor projected now. The free area is
    // final once the card is shown (openCard sets it synchronously); a later change (a sheet detent) re-checks (onFree)
    if (FRAMABLE.test(r.kind)) {
      frameRef = refStr(r);
      scheduleFrame(subject?.screen || null);
    } else frameRef = null;
    return true;
  };
  // ---------------- keeping a card's subject in the free area (§4.1 step 3) ----------------
  const FRAMABLE = /^(actor|crowd|el|fire)$/;
  let frameRef = null, frameRaf = 0, framingUntil = 0, frameFreeKey = '';
  const freeKey = () => { const f = app.layout.free; return `${f.l},${f.r},${f.t},${f.b}`; };
  /** next frame: turn to the open card's subject when its point (pt, else its anchor now) is outside the free area.
   * Always by its ref string: the inspect core reads a pick Hit's kind ('person') as the ref's */
  function scheduleFrame(pt = null) {
    cancelAnimationFrame(frameRaf);
    frameRaf = requestAnimationFrame(() => {
      const ref = frameRef;
      frameFreeKey = freeKey();
      if (!ref || !ctx.inspect?.frame || app.cardRef() !== ref || menu.fullScreen()) return;
      const sh = ctx.inspect.show;
      if (sh && !['done', 'cancelled', 'failed'].includes(sh.phase)) return; // the director frames its own subject
      const s = pt || screenOf(ref);
      if (!s) return;
      const f = app.layout.free, m = 20;
      if (s.x >= f.l + m && s.x <= innerWidth - f.r - m && s.y >= f.t + m && s.y <= innerHeight - f.b - m) return;
      framingUntil = performance.now() + 450;
      try { ctx.inspect.frame(ref)?.catch?.(() => {}); } catch (e) { console.error('[ui] frame', e); }
    });
  }
  app.onCardClose = () => { frameRef = null; };
  /** the free area changed under an open card (a detent, the dock widening back): its subject is checked again */
  function refreshFrame() {
    if (!frameRef || performance.now() < framingUntil || freeKey() === frameFreeKey) return;
    scheduleFrame(null);
  }
  /** client px of a subject's anchor (chest height for figures); off screen or behind → a point outside the viewport */
  function screenOf(ref) {
    let p = null;
    try { p = ctx.inspect.anchorOf?.(ref); } catch { p = null; }
    if (!p || !ctx.camera) return null;
    const v = p.clone();
    if (/^(actor|crowd):/.test(ref)) v.y += 1.2;
    else { try { const hgt = ctx.inspect.describer?.heightOf?.(ref); if (hgt > 0) v.y += hgt / 2; } catch { /* base */ } }
    v.project(ctx.camera);
    if (v.z >= 1) return { x: -1e4, y: -1e4 };
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }

  // ---------------- pointer lock and the Menu (§2.2) ----------------
  let expectUntil = 0, lastFs = -1e9;
  app.expectUnlock = () => { expectUntil = performance.now() + 500; };
  document.addEventListener('fullscreenchange', () => { lastFs = performance.now(); });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) { beacon.wake('lock'); return; }
    // freed by the browser on Esc: open the Menu — but not when we freed it, on alt-tab or blur, or leaving fullscreen
    const t = performance.now();
    if (t < expectUntil || document.visibilityState !== 'visible' || t - lastFs < 300) return;
    requestAnimationFrame(() => {
      if (!document.hasFocus() || welcome.open || menu.isOpen || performance.now() - lastFs < 300) return;
      app.openMenu({ from: 'world' });
    });
  });
  // a click on a subject inspects instead of capturing the mouse; the Menu open never captures it
  ctx.player?.setLockFilter?.(() => !(menu.isOpen || !!pick.hover));

  // ---------------- taps and inspect ----------------
  function tapAt(x, y, pointerType) {
    if (welcome.open) return;
    const ev = markers.hitAt(x, y);
    if (ev) { app.card(`event:${ev.id}`, { fromWorld: true }); return; }
    if (!pick.pickAt(x, y, { source: 'click', pointerType, places: false, fromWorld: true }) && pointerType !== 'mouse') beacon.wake('tap');
  }
  ctx.bus.on('player:tap', (e) => tapAt(e?.x, e?.y, e?.pointerType || 'mouse'));
  ctx.bus.on('player:inspect', (e) => {
    if (welcome.open) return;
    // §2.3: with focus inside the Menu, letters do nothing but move (E is the player's whenever no text field has focus)
    const a = document.activeElement;
    if (e?.source === 'key' && a && a !== document.body && menu.el.contains(a)) return;
    pick.pickAt(e?.x ?? NaN, e?.y ?? NaN, { source: e?.source || 'key', fromWorld: true });
  });
  ctx.bus.on('player:intent', (e) => { if (e?.kind === 'look' || e?.kind === 'move') beacon.wake('move'); });
  // the mouse wakes the beacon (pointer free)
  let lastWake = 0, mx = null, my = null;
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return; // (not a phone's compatibility mouse events)
    const moved = mx === null ? 0 : Math.abs(e.clientX - mx) + Math.abs(e.clientY - my);
    mx = e.clientX; my = e.clientY;
    if (document.pointerLockElement || menu.isOpen) return;
    const t = performance.now();
    if (t - lastWake < 250 || moved < 3) return;
    lastWake = t;
    beacon.wake('mouse');
  }, { passive: true });
  ctx.bus.on('zone:change', () => { if (!menu.isOpen && !app.coarse) beacon.wake('zone'); });

  // ---------------- keyboard (§2.3, §2.4) ----------------
  const typing = (t) => !!t?.closest?.('input:not([type=range]):not([type=button]), textarea, select, [contenteditable=""], [contenteditable="true"]');
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
  function trapTab(e, el) {
    // only real Tab stops: a button kept out of the order (tabindex -1, e.g. a search row's) must not be the "last" one
    const list = [...el.querySelectorAll(FOCUSABLE)].filter((x) => x.tabIndex >= 0 && x.getClientRects().length && !x.closest('[inert], [hidden]'));
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1], a = document.activeElement;
    if (e.shiftKey ? (a === first || !el.contains(a)) : (a === last || !el.contains(a))) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
  }
  addEventListener('keydown', (e) => {
    if (welcome.open) {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON' && document.activeElement?.tagName !== 'A') { e.preventDefault(); welcome.enter(e); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); welcome.enter(e, { lock: false }); return; }
      if (e.key === 'Tab') trapTab(e, menu.el);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); app.search(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Tab' && menu.isOpen && menu.el.getAttribute('aria-modal') === 'true') { trapTab(e, menu.el); return; }
    if (e.key === 'Escape') {
      // a field with text clears itself; a popover closes itself (their own handlers)
      if (typing(e.target) && e.target.value) return;
      if (e.target.closest?.('.mk-pop:not([hidden])')) return;
      if (e.target.closest?.('.mk-sres__acts')) return; // a search row's button: Esc returns to the field (search.js)
      e.preventDefault();
      e.stopImmediatePropagation(); // never the player's: Esc does not cancel a walk
      if (menu.isOpen) { app.flags.closedByEsc = menu.stack.length <= 1; menu.back(); } else app.openMenu({ from: 'world' });
      return;
    }
    if (typing(e.target) || e.repeat) return;
    // pace during a trip (the map stage keeps + and − for its zoom)
    if (app.travel.trip && ['+', '=', '-', '_'].includes(e.key) && !e.target.closest?.('.mk-mapv__stage')) {
      if (app.travel[e.key === '+' || e.key === '=' ? 'faster' : 'slower']()) { e.preventDefault(); return; }
    }
    // "/" searches from anywhere
    if (e.key === '/') { e.preventDefault(); app.search(); return; }
    // letters work from the world only: inside the Menu they do nothing (the movement keys stay the player's)
    const a = document.activeElement;
    if (a && a !== document.body && menu.el.contains(a)) return;
    if (e.key === '?') { e.preventDefault(); app.toggle('help'); return; }
    if (e.code === 'KeyP') { e.preventDefault(); app.togglePause(); return; }
    const name = KEYS[e.code];
    if (name) { e.preventDefault(); app.toggle(name); }
  }, true);

  // ---------------- view changes ----------------
  app.onView = () => {
    beacon.setHidden(menu.isOpen);
    beacon.setExpanded(menu.isOpen);
    root.classList.toggle('mk-full', menu.fullScreen());
    requestAnimationFrame(() => app.updateCaptionGap());
  };
  app.onClose = () => {
    beacon.setHidden(false);
    beacon.setExpanded(false);
    root.classList.remove('mk-full');
    if (app.flags.closedByEsc) beacon.wake('esc-close');
    app.flags.closedByEsc = false;
    requestAnimationFrame(() => app.updateCaptionGap());
  };
  app.onFree = () => { root.classList.toggle('mk-full', menu.fullScreen()); requestAnimationFrame(() => app.updateCaptionGap()); refreshFrame(); };
  app.onTripStart = () => {
    app.showbar.noteTrip();
    if (app.layout.mode === 'sheet-portrait' && menu.isOpen) menu.setDetent('mini');
    else if (app.layout.mode === 'sheet-landscape' && menu.isOpen) menu.close();
  };
  app.onTripEnd = () => {};

  // ---------------- live settings ----------------
  ctx.bus.on('settings:change', (e) => {
    if (e?.key === 'reducedMotion') applyClasses();
    if (e?.key === 'labels' || e?.key === 'aggadah') markers.refresh();
  });
  ctx.bus.on('quality:change', applyClasses);
  ctx.bus.on('time:date', () => { markers.refresh(); beacon.refresh(); });

  // ---------------- boot ----------------
  let resume = false, resumeMenu = null;
  try {
    resume = sessionStorage.getItem('mikdash.resume') === '1';
    sessionStorage.removeItem('mikdash.resume');
    resumeMenu = sessionStorage.getItem('mikdash.resumeMenu');
    sessionStorage.removeItem('mikdash.resumeMenu');
  } catch { /* ignore */ }
  // The boot settles SETTLE_MS after the first frame (main.js 'warmup:issued'): until then the GPU process links the first
  // view's own late programs, and every frame that needs one waits for it. The GPU process also rasters each new DOM layer
  // and runs accelerated canvas work, so the UI's heavy first paint (the docked Welcome) and its non-view work (the map's
  // and the minimap's rasters, the search index, the card content) wait for 'settled' (cold medium boot: a 1.7 s frame
  // otherwise; docs/decisions/console-ui.md). The UI's ticker does nothing before the first frame.
  let booted = false, settled = false;
  const onSettled = [];
  app.afterSettle = (fn) => { if (settled) fn(); else onSettled.push(fn); };
  const settle = () => {
    if (settled) return;
    settled = true;
    for (const f of onSettled.splice(0)) { try { f(); } catch (e) { console.error('[ui] after settle', e); } }
  };
  ctx.bus.on('warmup:issued', settle);
  root.classList.add('mk-booting');
  // Until the boot's background compile queue has drained (main.js bootTimes.drained) no ambient animation runs: a
  // compositor animation (the minimap halo's pulse) keeps the GPU process drawing frames while this thread waits on a
  // program link, and every such wait grew by 0.5 s (cold medium boot: a 1.7 s frame; a 0.6 s second wait at +1 s).
  // The halo shows, static, meanwhile. (At most 4 min: the warm-up check's own drain limit.)
  root.classList.add('mk-quiet');
  let drained = false;
  const onDrained = [];
  /** fn() once the boot's background compile queue has drained (the UI's non-view work waits for it) */
  app.afterDrained = (fn) => { if (drained) fn(); else onDrained.push(fn); };
  const quietEnd = () => {
    if (drained) return;
    drained = true;
    root.classList.remove('mk-quiet');
    for (const f of onDrained.splice(0)) { try { f(); } catch (e) { console.error('[ui] after drain', e); } }
  };
  ctx.bus.on('firstFrame', () => {
    const t0 = performance.now();
    const poll = () => { if (ctx.bootTimes?.drained > 0 || performance.now() - t0 > 240000) quietEnd(); else setTimeout(poll, 1000); };
    setTimeout(poll, 1000);
  });
  ctx.bus.on('firstFrame', () => {
    booted = true;
    root.classList.remove('mk-booting');
    menu.rebuildNav();
    welcome.start({ resume });
    if (resume && resumeMenu) app.open(resumeMenu, { from: 'nav' });
    setTimeout(settle, 4000); // (no warm-up queue: a build without main.js's signal)
    // idle work once settled: the map's model and plan, the minimap raster, the search index, card content
    const idle = (fn, ms) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: ms }) : setTimeout(fn, ms / 2));
    // the minimap's plan 6 s after settling (it is always on screen; built at +2.4 s it landed on the frame where the
    // deferred queue's first programs link, a 0.3–0.4 s longer ultra frame); the map's prewarm, the search index and the
    // card content once the compile queue has drained (each also loads on first use: opening the Map, a query, Learn)
    app.afterSettle(() => setTimeout(() => idle(() => app.minimapRaster.build(), 4000), 6000));
    app.afterDrained(() => {
      idle(() => { try { app.mapPanel?.()?.prewarm?.(); } catch (e) { console.error('[ui] map prewarm failed', e); } }, 3000);
      idle(() => { app.content.load(); app.searchEngine.load(); }, 5000);
    });
  });

  // ---------------- built-in sections (through the registry, as modules will) ----------------
  for (const def of [hereSection(app), happeningSection(app), mapSection(app), timeSection(app), learnSection(app), listenSection(app), settingsSection(app), helpSection(app)]) app.modules.register(def);

  // ---------------- ticker ----------------
  const stats = { tickMs: 0, tickMax: 0, n: 0, parts: {} };
  let vertOn = null;
  const part = (name, fn) => {
    const t = performance.now();
    fn();
    const d = performance.now() - t;
    const p = stats.parts[name] || (stats.parts[name] = { ema: 0, max: 0 });
    p.ema = p.ema * 0.95 + d * 0.05;
    p.max = Math.max(p.max * 0.999, d);
  };
  ctx.engine.onUpdate((dt) => {
    if (!booted) return; // (the boot's discovery frames: nothing of the UI is on screen)
    const t0 = performance.now();
    part('pad', () => pad.tick(dt));
    part('beacon', () => beacon.tick(dt));
    part('menu', () => menu.tick(dt));
    part('travel', () => app.travel.tick(dt));
    part('banner', () => app.banner.tick(dt));
    part('captions', () => app.captions.tick(dt));
    part('showbar', () => app.showbar.tick(dt));
    part('markers', () => { markers.setHidden(menu.fullScreen() || welcome.open || app.showbar.active); markers.tick(dt); });
    part('pick', () => pick.tick(dt));
    const v = coarse && ctx.player?.mode === 'fly' && !!ctx.player?.setVertical && !menu.fullScreen();
    if (v !== vertOn) { vertOn = v; vert.hidden = !v; root.classList.toggle('mk-vert-on', v); }
    const ms = performance.now() - t0;
    stats.tickMs = stats.tickMs * 0.95 + ms * 0.05;
    stats.tickMax = Math.max(stats.tickMax * 0.999, ms);
    stats.n++;
  }, PRIORITY.ui);
  beacon.refresh();

  // ---------------- ctx.ui ----------------
  return {
    toast: (m, ms, o) => toast(m, ms, o),
    fade: (a, b) => fade(a, b),
    open: (name, opts) => app.open(name, opts),
    close: () => app.close(),
    toggle: (name) => app.toggle(name),
    get panel() { return menu.isOpen ? (menu.view?.type === 'section' ? menu.view.id : menu.section) : null; },
    /** the old hint bar is gone (keys are printed on the controls); kept for callers */
    hints() {},
    enter: () => welcome.enter(null, { lock: false }),
    /** debugging / tests: the map's view and selection (null until the map has been opened once) */
    get map() { return app.mapPanel?.()?.api || null; },
    card: (ref, opts) => app.card(ref, opts),
    search: (q, opts) => app.search(q, opts),
    banner: (z, opts) => app.banner.show(z, opts),
    modules: app.modules,
    announce: app.announce,
    console: {
      state: () => ({ open: menu.isOpen, layout: app.layout.mode, view: menu.view ? { type: menu.view.type, id: menu.view.id || menu.view.ref || null } : null, section: menu.section, detent: app.layout.isSheet ? menu.detent : null, welcome: welcome.open, stack: menu.stack.map((s) => s.type) }),
      results: () => search.results,
      card: () => (menu.view?.type === 'card' ? menu.view.card?.card || null : null),
      beacon: () => ({ name: beacon.name, expanded: beacon.expanded, rect: beacon.btn.getBoundingClientRect().toJSON() }),
      banners: () => app.banner.list,
      pick: (x, y) => { const hit = ctx.inspect?.pick?.(x, y) || null; if (hit) app.card(hit); return hit; },
      markers: () => markers.list(),
      free: () => ({ ...app.layout.free }),
      stats: () => JSON.parse(JSON.stringify(stats)),
      travel: () => (app.travel.trip ? { ...app.travel.trip, pathSite: undefined } : null),
      input: () => app.input.mode,
    },
  };
}

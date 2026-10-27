// The Menu (the console, לוח; console §3): one panel that never hides the world. Desktop and tablet landscape: docked on
// the right (560 px; the Map widens it), a labelled vertical rail of sections beside the content. Phones: a bottom
// sheet (detents mini / peek / full; drag the grabber) or, in landscape, a right sheet; the home screen is a 4×2 grid of
// labelled tiles and a section is a drill-down with "‹ Menu". Every view starts with the header (minimap, place, clock,
// search, actions). A view stack (section | card | search | welcome) with one history entry per level: the system
// back goes back one level; the entries are cleaned up on close.
import { h, fill, he, setText } from '../dom.js';
import { ico } from './icons.js';
import { createHeader, soundToggle, flyToggle } from './header.js';
import { sheetDrag } from './layout.js';
import { renderCard } from './card.js';
import { parseRef, refStr } from './describe.js';

const FULL_SECTIONS = new Set(['map', 'learn', 'settings', 'help', 'listen']);

export function createConsole(app) {
  const { ctx } = app;
  const header = createHeader(app);
  const grab = h('div.mk-menu__grab', { 'aria-hidden': 'true' });

  // ---------------- drill-down bar (sheets) ----------------
  const drillTitle = h('h2.mk-drill__title', { tabindex: '-1' });
  const drillBackTxt = h('span', 'Menu');
  const drillBack = h('button.mk-hbtn.mk-drill__back', { type: 'button', on: { click: () => back() } }, ico('prev'), drillBackTxt);
  const drillClose = h('button.mk-hbtn.mk-drill__close', { type: 'button', on: { click: () => close() } }, ico('close'), h('span', 'Close'));
  const drill = h('div.mk-drill', drillBack, drillTitle, drillClose);

  // ---------------- rail (dock) and tiles (sheets) ----------------
  const rail = h('nav.mk-rail', { role: 'tablist', 'aria-orientation': 'vertical', 'aria-label': 'Sections' });
  const tiles = h('ul.mk-tiles', { 'aria-label': 'Sections' });
  const homeHere = h('div.mk-home__here');
  const homeFly = h('button.mk-hbtn', { type: 'button', on: { click: () => { flyToggle(ctx); paintHomeActs(); } } });
  const homeSnd = h('button.mk-hbtn', { type: 'button', on: { click: () => { soundToggle(ctx); paintHomeActs(); } } });
  const homeView = h('div.mk-menu__view.mk-scroll.mk-home', { 'data-view': 'home' }, tiles, homeHere, h('div.mk-home__acts', homeFly, homeSnd));
  function paintHomeActs() {
    const fly = ctx.player?.mode === 'fly';
    homeFly.replaceChildren(ico(fly ? 'walk' : 'fly'), h('span', fly ? 'Walk' : 'Fly'));
    homeFly.hidden = !ctx.player?.setMode;
    const snd = ctx.settings.get('volume') > 0;
    homeSnd.replaceChildren(ico(snd ? 'soundOn' : 'soundOff'), h('span', snd ? 'Sound on' : 'Sound off'));
  }

  const cardView = h('div.mk-menu__view.mk-scroll.mk-cardview', { 'data-view': 'card' });
  const searchView = h('div.mk-menu__view.mk-scroll.mk-searchwrap', { 'data-view': 'search' });
  const welcomeView = h('div.mk-menu__view.mk-scroll.mk-welcomewrap', { 'data-view': 'welcome' });
  const main = h('div.mk-menu__main', homeView, cardView, searchView, welcomeView);
  const body = h('div.mk-menu__body', rail, main);
  const el = h('section.mk-menu.mk-glass.mk-live', { role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Menu', hidden: true, 'data-view': 'section' },
    grab, header.el, drill, body);

  // ---------------- sections (from the registry) ----------------
  const views = new Map(); // section id -> { rec, el, inst, tab, tile, micro }
  function rebuildNav() {
    const recs = app.modules.sections();
    const ids = new Set(recs.map((r) => r.def.section.id));
    for (const [id, v] of views) if (!ids.has(id)) { v.inst?.dispose?.(); v.el.remove(); views.delete(id); }
    rail.replaceChildren();
    tiles.replaceChildren();
    for (const rec of recs) {
      const s = rec.def.section;
      let v = views.get(s.id);
      if (!v) {
        const vel = h(`div.mk-menu__view${s.noScroll ? '' : '.mk-scroll'}`, { 'data-view': 'section', 'data-section': s.id, role: 'tabpanel', id: `mk-sec-${s.id}`, 'aria-labelledby': `mk-tab-${s.id}` });
        main.insertBefore(vel, cardView);
        v = { rec, el: vel, inst: null };
        views.set(s.id, v);
      }
      v.rec = rec;
      const label = app.modules.t(s.label);
      const micro = h('span.mk-tab__micro');
      const cap = s.key ? h('span.mk-kbd.mk-tab__cap', { 'data-cap': s.capName || null }, s.keyCap || s.key.replace(/^Key/, '')) : null;
      v.tab = h('button.mk-tab', {
        type: 'button', role: 'tab', id: `mk-tab-${s.id}`, 'aria-controls': `mk-sec-${s.id}`, 'aria-selected': 'false', tabindex: '-1', 'data-section': s.id,
        'aria-keyshortcuts': s.keyCap || (s.key ? s.key.replace(/^Key/, '') : null),
        on: { click: () => open(s.id, { from: 'nav' }) },
      }, ico(s.icon), h('span.mk-tab__txt', h('span.mk-tab__label', label), micro), cap);
      v.micro = micro;
      const tmicro = h('span.mk-tile__micro');
      v.tile = h('li', h('button.mk-tile', { type: 'button', 'data-section': s.id, on: { click: () => open(s.id, { from: 'nav' }) } },
        ico(s.icon), h('span.mk-tile__label', label), tmicro));
      v.tmicro = tmicro;
      rail.append(v.tab);
      tiles.append(v.tile);
    }
    tiles.classList.toggle('is-12', recs.length > 8);
    markTabs();
  }
  rail.addEventListener('keydown', (e) => {
    const tabs = [...rail.querySelectorAll('[role=tab]')];
    const i = tabs.indexOf(document.activeElement);
    let to = null;
    if (e.key === 'ArrowDown') to = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowUp') to = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') to = tabs[0];
    else if (e.key === 'End') to = tabs[tabs.length - 1];
    if (!to) return;
    e.preventDefault();
    e.stopPropagation();
    to.focus();
    open(to.dataset.section, { from: 'nav', keepFocus: true });
  });

  // ---------------- state ----------------
  let isOpen = false;
  let stack = []; // [{ type: 'home'|'section'|'card'|'search'|'welcome', id?, card? }]
  let section = null; // the current (or last) section id
  let lastSection = null; // the last one used this session
  let detent = 'peek';
  let invoker = null;
  const top = () => stack[stack.length - 1] || null;

  // ---------------- history: one entry per level ----------------
  // Traversals (back / go) are asynchronous: a pushState issued before the popstate of a pending back lands lands on
  // the wrong entry, and a later go(-n) would then leave the page. So every operation is queued and run in order, each
  // traversal waiting for its popstate (or 1 s) before the next. A popstate that is not ours is the system back.
  let depth = 0, busy = false, busyT = 0;
  const ops = [];
  function runOps() {
    while (!busy && ops.length) {
      const op = ops.shift();
      try {
        if (op === 'push') { history.pushState({ mk: depth + 1 }, ''); depth++; }
        else if (depth > 0) {
          const n = op === 'clear' ? depth : 1;
          depth -= n;
          busy = true;
          clearTimeout(busyT);
          busyT = setTimeout(() => { busy = false; runOps(); }, 1000);
          history.go(-n);
        }
      } catch { busy = false; }
    }
  }
  const hist = {
    push() { ops.push('push'); runOps(); },
    pop() { ops.push('pop'); runOps(); },
    clear() { ops.length = 0; ops.push('clear'); runOps(); },
  };
  addEventListener('popstate', () => {
    if (busy) { busy = false; clearTimeout(busyT); runOps(); return; }
    if (!isOpen) { depth = 0; return; }
    depth = Math.max(0, depth - 1);
    back({ fromHistory: true });
  });

  // ---------------- views ----------------
  function viewEl(entry) {
    if (!entry) return null;
    if (entry.type === 'home') return homeView;
    if (entry.type === 'card') return cardView;
    if (entry.type === 'search') return searchView;
    if (entry.type === 'welcome') return welcomeView;
    return views.get(entry.id)?.el || null;
  }
  function sectionInst(id) {
    const v = views.get(id);
    if (!v) return null;
    if (!v.inst) {
      const r = app.modules.call(v.rec, 'section.mount', v.rec.def.section.mount, v.el, v.rec.api);
      v.inst = r || {};
    }
    return v.inst;
  }
  let shownSection = null;
  function showTop(opts = {}) {
    const t = top();
    for (const v of main.children) v.classList.toggle('is-current', v === viewEl(t));
    el.dataset.view = t?.type || 'section';
    // the Map widens the dock (before its show hook, which fits the plan to its size)
    const wide = t?.type === 'section' && t.id === 'map';
    el.classList.toggle('is-wide', wide);
    app.root.classList.toggle('mk-menu-wide', isOpen && wide);
    // section show / hide hooks
    const sid = t?.type === 'section' ? t.id : null;
    if (shownSection && shownSection !== sid) { try { views.get(shownSection)?.inst?.hide?.(); } catch (e) { console.error('[ui] section hide', e); } }
    if (sid) {
      section = sid;
      lastSection = sid;
      const inst = sectionInst(sid);
      try { inst?.show?.(opts); } catch (e) { console.error('[ui] section show', e); }
    }
    shownSection = sid;
    el.dataset.section = (t?.type === 'section' ? t.id : (t?.type === 'card' || t?.type === 'search' ? section : '')) || '';
    markTabs();
    // drill-down title (sheets)
    const title = t?.type === 'section' ? app.modules.t(views.get(t.id)?.rec.def.section.label)
      : t?.type === 'card' ? (t.card?.card?.title?.en || 'About') : t?.type === 'search' ? 'Search' : t?.type === 'welcome' ? 'Welcome' : 'Menu';
    fill(drillTitle, t?.type === 'section' ? ico(views.get(t.id)?.rec.def.section.icon) : null, h('span', title));
    setText(drillBackTxt, stack.length > 2 || (stack.length === 2 && stack[0].type !== 'home') ? 'Back' : 'Menu');
    // sheets: the full detent for big sections
    if (app.layout.isSheet) {
      const wantFull = t?.type === 'welcome' || t?.type === 'search' || (t?.type === 'section' && (FULL_SECTIONS.has(t.id) || views.get(t.id)?.rec.def.section.fullDetent));
      setDetent(opts.detent || (wantFull ? 'full' : (detent === 'full' && t?.type !== 'home' && t?.type !== 'section') ? 'full' : 'peek'), true);
    }
    header.setDiscSize(discSize());
    header.update(true);
    // the header disc is the overview on the Map section
    header.disc.setMode(t?.type === 'section' && t.id === 'map' ? 'overview' : 'disc');
    updateFree();
    applyInput();
    app.onView?.(t);
  }
  function discSize() {
    if (!app.layout.isSheet) return 120;
    if (app.layout.mode === 'sheet-landscape') return 56;
    return top()?.type === 'home' || top()?.type === 'search' ? 72 : 56;
  }
  function markTabs() {
    for (const [id, v] of views) {
      const on = id === section && isOpen;
      v.tab?.setAttribute('aria-selected', on ? 'true' : 'false');
      if (v.tab) v.tab.tabIndex = id === (section || lastSection || 'here') ? 0 : -1;
      v.tile?.firstChild?.classList.toggle('is-current', on);
    }
  }

  // ---------------- detents (phone sheets) ----------------
  function stripHeight() { return Math.min(innerHeight, (header.el.offsetHeight || 110) + (drill.offsetHeight || 0) + 22); }
  function detentOffsets() {
    const H = el.offsetHeight || innerHeight;
    return { full: 0, peek: Math.max(0, H - innerHeight * 0.56), mini: Math.max(0, H - stripHeight()) };
  }
  function setDetent(d, quiet = false) {
    detent = d;
    el.dataset.detent = d;
    if (app.layout.mode === 'sheet-portrait') {
      const off = detentOffsets()[d] ?? 0;
      el.style.setProperty('--mk-sheet-off', `${Math.round(off)}px`);
    } else el.style.removeProperty('--mk-sheet-off');
    const modal = isOpen && app.layout.isSheet && d === 'full';
    el.setAttribute('aria-modal', modal ? 'true' : 'false');
    if (!quiet) { updateFree(); applyInput(); }
  }
  sheetDrag(el, [grab, drill, header.el], {
    axis: 'y',
    enabled: () => isOpen && app.layout.mode === 'sheet-portrait',
    detents: () => { const o = detentOffsets(); return [{ id: 'full', offset: o.full }, { id: 'peek', offset: o.peek }, { id: 'mini', offset: o.mini }]; },
    current: () => detent,
    set: (d) => setDetent(d),
    close: () => close(),
  });
  sheetDrag(el, [grab, drill], {
    axis: 'x',
    enabled: () => isOpen && app.layout.mode === 'sheet-landscape',
    detents: () => [{ id: 'full', offset: 0 }],
    current: () => 'full',
    set: () => {},
    close: () => close(),
  });

  // ---------------- free area ----------------
  function updateFree() {
    if (!isOpen) { app.layout.setFree({}); app.onFree?.(); return; }
    const mode = app.layout.mode;
    if (mode === 'dock') {
      const wide = el.classList.contains('is-wide');
      app.layout.setFree({ r: wide ? innerWidth : innerWidth - el.offsetLeft });
    } else if (mode === 'sheet-portrait') {
      const vis = detent === 'full' ? innerHeight : detent === 'mini' ? stripHeight() : innerHeight * 0.56;
      app.layout.setFree({ b: vis });
    } else {
      const wide = el.classList.contains('is-wide');
      app.layout.setFree({ r: wide ? innerWidth : el.offsetWidth + 8 });
    }
    app.onFree?.();
  }
  /** the Menu covers the whole screen (dock Map, full sheet, landscape Map) */
  const fullScreen = () => isOpen && (el.classList.contains('is-wide') || (app.layout.isSheet && detent === 'full'));

  // ---------------- player input alongside the Menu (§2.3) ----------------
  function applyInput() {
    const P = ctx.player;
    if (!P?.setInputEnabled) return;
    const sheetFull = isOpen && app.layout.isSheet && detent === 'full' && (top()?.type !== 'section' || FULL_SECTIONS.has(top()?.id) || top()?.type === 'welcome');
    const mapOpen = isOpen && top()?.type === 'section' && top().id === 'map';
    try {
      if (sheetFull || mapOpen || app.welcomeOpen?.()) {
        if (P.locked) app.expectUnlock();
        P.setInputEnabled(false);
      } else if (isOpen) {
        // the docked Menu is a HUD: walk on; no pointer lock (look by dragging), no pad (it drives the Menu)
        P.setInputEnabled({ keys: true, move: true, look: true, touch: true, pointerLock: !app.fine, pad: false });
        if (app.fine && P.locked) { app.expectUnlock(); P.unlock?.(); }
      } else P.setInputEnabled(true);
    } catch (e) { console.error('[ui] setInputEnabled', e); }
  }

  // ---------------- open / close / back ----------------
  function ensureOpen(opts = {}) {
    if (isOpen) return false;
    isOpen = true;
    const a = document.activeElement;
    invoker = (opts.from instanceof Element ? opts.from : null) || (a && a !== document.body && app.root.contains(a) ? a : null);
    el.hidden = false;
    el.classList.remove('is-in');
    void el.offsetWidth;
    el.classList.add('is-in');
    app.root.classList.add('mk-menu-open');
    stack = [];
    hist.push();
    if (ctx.player?.locked) { app.expectUnlock(); try { ctx.player.unlock?.(); } catch { /* ignore */ } }
    return true;
  }
  /** open at a section (or the home tiles on sheets, when no section is given) */
  function open(id, opts = {}) {
    // leaving the Welcome by any section (a rail tab, a tile) ends it, as the Welcome's own buttons do
    if (app.welcome?.open) app.welcome.enter(null, { lock: false });
    const fresh = ensureOpen(opts);
    if (id && !views.has(id)) id = 'here';
    const sheet = app.layout.isSheet;
    const entry = id ? { type: 'section', id } : (sheet ? { type: 'home' } : { type: 'section', id: lastSection || 'here' });
    if (fresh) {
      // phones: a section opened directly still has the tiles under it ("‹ Menu")
      stack = sheet && entry.type === 'section' ? [{ type: 'home' }, entry] : [entry];
      if (stack.length === 2) hist.push();
    } else {
      // from the rail (dock): replace the base; from the tiles (sheet): drill down from home; a place opened from a
      // search or a card (opts.push): on top of it, so Back returns to the results or the card
      if (opts.push && (top()?.type === 'search' || top()?.type === 'card')) { cover(top()); stack.push({ ...entry, state: { zone: opts.zone, pinned: opts.pinned } }); hist.push(); }
      else if (sheet && top()?.type === 'home' && entry.type === 'section') { stack.push(entry); hist.push(); }
      else if (sheet && entry.type === 'home') { while (stack.length > 1) { stack.pop(); hist.pop(); } stack[0] = entry; }
      else { while (stack.length > 1) { stack.pop(); hist.pop(); } if (sheet && stack[0]?.type === 'home' && entry.type === 'section') { stack.push(entry); hist.push(); } else stack[0] = entry; }
    }
    showTop(opts);
    afterOpen(fresh, opts);
    ctx.bus.emit('ui:menu', { open: true, section: top()?.type === 'section' ? top().id : null });
    return true;
  }
  function afterOpen(fresh, opts) {
    // focus: into the Menu when it was opened from the UI (the beacon, a tile, the keyboard); the world keeps it
    // when opened from the world (an accelerator, Esc after the pointer was freed), so its keys still work
    const intoMenu = opts.focus === true || (opts.focus !== false && (opts.from === 'nav' || (opts.from && opts.from !== 'world') || (fresh && invoker)));
    if (!intoMenu || opts.keepFocus) return;
    requestAnimationFrame(() => {
      const t = top();
      let f = null;
      if (t?.type === 'section') f = views.get(t.id)?.inst?.focusTarget?.() || (app.layout.isSheet ? drillTitle : views.get(t.id)?.tab);
      else if (t?.type === 'home') f = tiles.querySelector('button');
      else if (t?.type === 'card') f = t.card?.el.querySelector('.mk-card__title');
      else if (t?.type === 'welcome') f = welcomeView.querySelector('.mk-welcome__go');
      f?.focus?.({ preventScroll: true });
    });
  }
  /** a section view about to be covered by another level keeps its state (Here: the place shown, pinned or not), so
   * Back shows it as it was */
  function cover(entry) {
    if (entry?.type !== 'section') return;
    try { const s = views.get(entry.id)?.inst?.state?.(); if (s) entry.state = s; } catch { /* ignore */ }
  }
  function pushView(entry, opts = {}) {
    const fresh = ensureOpen(opts);
    if (fresh && opts.alone) {
      // the only level (a card picked in the world): Back closes the Menu (ensureOpen pushed its history entry)
      stack = [entry];
    } else {
      if (fresh) {
        const base = app.layout.isSheet ? { type: 'home' } : { type: 'section', id: lastSection || 'here' };
        stack = [base];
        if (base.type === 'section') { section = base.id; }
      }
      // a card over a card replaces it; search over search is the same view
      const t = top();
      if (t && t.type === entry.type && (entry.type === 'search' || entry.type === 'card' || entry.type === 'welcome')) stack[stack.length - 1] = entry;
      else { cover(t); stack.push(entry); hist.push(); }
    }
    showTop(opts);
    if (entry.type !== 'search') afterOpen(fresh, { ...opts, from: opts.from ?? (fresh ? null : 'nav') });
    ctx.bus.emit('ui:menu', { open: true, section: section });
  }
  function back({ fromHistory = false } = {}) {
    if (!isOpen) return false;
    const t = top();
    // a section may use Back first (the map's places list, a search scope)
    if (t?.type === 'section' && views.get(t.id)?.inst?.onEscape?.()) { if (fromHistory) hist.push(); return true; }
    if (t?.type === 'welcome') { app.welcome?.enter(null, { lock: false }); return true; }
    if (stack.length <= 1) { close({ fromHistory }); return true; }
    const was = stack.pop();
    if (!fromHistory) hist.pop();
    if (was.type === 'card') { was.card = null; cardView.replaceChildren(); app.onCardClose?.(); }
    // a card beneath? re-render it
    const nt = top();
    if (nt?.type === 'card') showCardEntry(nt);
    showTop({ back: true, state: nt?.state || null });
    requestAnimationFrame(() => {
      const f = nt?.type === 'section' ? (app.layout.isSheet ? drillTitle : views.get(nt.id)?.tab) : nt?.type === 'home' ? tiles.querySelector('.mk-tile') : null;
      if (app.root.contains(document.activeElement) || document.activeElement === document.body) f?.focus?.({ preventScroll: true });
    });
    ctx.bus.emit('ui:menu', { open: true, section });
    return true;
  }
  function close({ relock = false, fromHistory = false, force = false } = {}) {
    if (!isOpen) return false;
    // closing while the Welcome is up ends it (whatever view is on top), so its state can never be left behind
    if (app.welcome?.open && !force) { app.welcome.enter(null, { lock: relock }); return true; }
    isOpen = false;
    if (shownSection) { try { views.get(shownSection)?.inst?.hide?.(); } catch { /* ignore */ } shownSection = null; }
    const was = stack;
    stack = [];
    if (!fromHistory || depth > 0) hist.clear();
    if (was.some((e) => e.type === 'card')) { cardView.replaceChildren(); app.onCardClose?.(); }
    el.classList.remove('is-in', 'is-wide');
    app.root.classList.remove('mk-menu-open', 'mk-menu-wide');
    el.hidden = true;
    el.removeAttribute('data-detent');
    markTabs();
    updateFree();
    applyInput();
    header.disc.setMode('disc');
    app.onClose?.(); // the beacon shows again before focus can return to it
    // focus returns to where it came from
    const inv = invoker;
    invoker = null;
    if (el.contains(document.activeElement) || document.activeElement === document.body) {
      if (inv && inv.isConnected && inv.offsetParent !== null) inv.focus({ preventScroll: true });
      else document.activeElement?.blur?.();
    }
    // a click on Close re-locks the pointer (it is a user gesture)
    if (relock && app.fine && ctx.settings.get('lookMode') !== 'drag') {
      try { const p = ctx.renderer?.domElement?.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); } catch { /* ignore */ }
    }
    ctx.bus.emit('ui:menu', { open: false, section: null });
    return true;
  }

  // ---------------- cards ----------------
  // a card opens at its top (title, NOW, WHY): reset the scroll once the view is shown too, because a hidden view keeps
  // the offset an earlier card left
  const cardTop = () => { cardView.scrollTop = 0; requestAnimationFrame(() => { cardView.scrollTop = 0; }); };
  function showCardEntry(entry) {
    cardView.replaceChildren(entry.card.el);
    // (its Go controls were off the page while covered: they show the current way and pace again)
    for (const g of entry.card.el.querySelectorAll('.mk-go')) g._mkPaint?.();
    cardTop();
  }
  function openCard(card, opts = {}) {
    const r = renderCard(app, card, { onBack: () => back(), backLabel: 'Back', ...opts.cardOpts });
    const entry = { type: 'card', ref: refStr(parseRef(card.ref)), card: r };
    cardView.replaceChildren(r.el);
    pushView(entry, { ...opts, detent: opts.detent || 'peek' });
    cardTop();
    return r;
  }

  // ---------------- home: happening here ----------------
  let homeKey = '', homeRows = [];
  function updateHome() {
    if (top()?.type !== 'home') return;
    const id = app.data.currentZoneId();
    const here = app.data.at(id, ctx.time?.t);
    const key = `${id}|${here.map((e) => e.id).join()}`;
    if (key !== homeKey) {
      homeKey = key;
      homeRows = here.slice(0, 3).map((ev) => app.eventRow(ev, { place: false }));
      fill(homeHere, 
        h('div.mk-h', `Happening here · ${here.length}`, here.length ? h('button.mk-linkbtn.mk-h__more', { type: 'button', on: { click: () => open('happening', { from: 'nav', filter: 'here' }) } }, 'All ›') : null),
        ...(homeRows.length ? homeRows.map((r) => r.el) : [h('div.mk-empty', 'Nothing in the order of the day here at this hour.')]),
      );
    }
    for (const r of homeRows) r.update();
    paintHomeActs();
  }

  // ---------------- tick ----------------
  let slow = 1, badgeAcc = 1;
  function tick(dt) {
    if (!isOpen) return;
    header.tick(dt);
    const t = top();
    if (t?.type === 'section') views.get(t.id)?.inst?.tick?.(dt);
    slow += dt;
    badgeAcc += dt;
    if (slow >= 0.25) {
      slow = 0;
      header.update();
      if (t?.type === 'section') { try { views.get(t.id)?.inst?.update?.(); } catch (e) { console.error('[ui] section update', e); } }
      if (t?.type === 'card') t.card?.update();
      if (t?.type === 'home') updateHome();
    }
    if (badgeAcc >= 0.5) {
      badgeAcc = 0;
      for (const v of views.values()) {
        const b = app.modules.badge(v.rec);
        const s = b == null ? '' : String(b);
        if (v.micro && v.micro.textContent !== s) { setText(v.micro, s); setText(v.tmicro, s); }
      }
    }
  }

  app.modules.onChange(rebuildNav);
  addEventListener('resize', () => { if (isOpen) requestAnimationFrame(() => { setDetent(detent, true); header.setDiscSize(discSize()); updateFree(); }); });

  return {
    el, header,
    rebuildNav,
    open, close, back, pushView, openCard,
    tick,
    get isOpen() { return isOpen; },
    get section() { return section; },
    get lastSection() { return lastSection; },
    get detent() { return detent; },
    setDetent,
    get view() { return top(); },
    get stack() { return stack.slice(); },
    fullScreen,
    searchView, welcomeView, cardView,
    sectionInst,
    sectionIds: () => [...views.keys()],
    updateFree, applyInput,
    showSection(id, opts) { return open(id, opts); },
    /** scroll the current section to an element and focus it */
    reveal(elm) { elm?.scrollIntoView?.({ block: 'start', behavior: app.reducedMotion() ? 'auto' : 'smooth' }); },
    focusTitle() { drillTitle.focus(); },
    he,
  };
}

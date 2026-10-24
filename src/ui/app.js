// The UI application: HUD, panels (time / info / map / settings), intro, shortcuts, one throttled ticker.
import './styles.css';
import { PRIORITY } from '../core/engine.js';
import { h } from './dom.js';
import { createData } from './data.js';
import { createHud } from './hud.js';
import { createIntro } from './intro.js';
import { createTimePanel } from './timepanel.js';
import { createInfoPanel } from './infopanel.js';
import { createMapPanel } from './mappanel.js';
import { createSettingsPanel } from './settingspanel.js';
import { createAboutPanel } from './aboutpanel.js';
import { clock } from './format.js';

const FACTORIES = { time: createTimePanel, info: createInfoPanel, map: createMapPanel, settings: createSettingsPanel, about: createAboutPanel };
const KEYS = { KeyT: 'time', KeyI: 'info', KeyM: 'map', KeyG: 'settings' };

export function mountUi(ctx) {
  let root = document.getElementById('ui-root');
  if (!root) { root = h('div#ui-root'); document.body.append(root); }
  root.setAttribute('lang', 'en');
  const mq = (q) => { try { return matchMedia(q).matches; } catch { return false; } };
  const isPhone = () => mq('(max-width: 640px)');

  const app = {
    ctx,
    settings: ctx.settings,
    data: createData(ctx),
    reducedMotion: () => !!ctx.settings.get('reducedMotion') || mq('(prefers-reduced-motion: reduce)'),
  };
  const applyClasses = () => {
    root.classList.toggle('mk-blur', ['high', 'ultra'].includes(ctx.quality?.key));
    root.classList.toggle('mk-reduce', !!ctx.settings.get('reducedMotion'));
  };
  applyClasses();

  const hud = createHud(app);
  root.append(hud.root);
  const backdrop = h('div.mk-backdrop.mk-live', { 'aria-hidden': 'true', on: { click: () => app.close() } });
  root.append(backdrop);

  // ---------------- panels ----------------
  const panels = {};
  let current = null, lastFocus = null;
  app.panelOpen = () => !!current;
  app.openPanel = () => current?.name || null;
  const getPanel = (name) => {
    if (!FACTORIES[name]) return null;
    if (!panels[name]) { panels[name] = FACTORIES[name](app); root.append(panels[name].el); }
    return panels[name];
  };
  /**
   * HUD pieces under the open panel fade out and leave the tab order (no text ghosting through the glass, no
   * hidden buttons). Measured, not hard-coded per layout: drawers, cards and sheets differ by viewport. A
   * non-modal panel's open transform is `none` in every layout, so its layout box (offset*) is where it ends up,
   * even while it is still sliding in; the centred modal is measured as drawn.
   */
  function panelRect(p) {
    const el = p.el;
    if (p.modal) return el.getBoundingClientRect();
    return { left: el.offsetLeft, top: el.offsetTop, right: el.offsetLeft + el.offsetWidth, bottom: el.offsetTop + el.offsetHeight };
  }
  function cover() {
    for (const el of hud.coverable) el.classList.remove('mk-covered');
    if (!current) return;
    const r = panelRect(current), m = 6;
    for (const el of hud.coverable) {
      const b = el.getBoundingClientRect();
      if (b.width && b.right > r.left - m && b.left < r.right + m && b.bottom > r.top - m && b.top < r.bottom + m) el.classList.add('mk-covered');
    }
  }
  let coverRaf = 0;
  window.addEventListener('resize', () => { cancelAnimationFrame(coverRaf); coverRaf = requestAnimationFrame(cover); });
  const SIDES = ['right', 'left', 'card', 'modal', 'map'];
  function show(p, opts) {
    lastFocus = document.activeElement;
    p.el.classList.add('open');
    root.classList.add('mk-panel-open', `mk-open-${p.side}`);
    backdrop.classList.toggle('open', !!p.modal);
    hud.root.inert = !!p.modal; // a modal dialog: nothing behind it is reachable
    hud.setExpanded(p.name, true);
    try { ctx.player?.unlock?.(); } catch { /* ignore */ }
    p.onOpen?.(opts || {});
    cover();
    const f = p.focusTarget?.() || p.titleEl;
    requestAnimationFrame(() => f?.focus?.({ preventScroll: true }));
  }
  function hide(p) {
    p.el.classList.remove('open');
    p.onClose?.();
    root.classList.remove('mk-panel-open', ...SIDES.map((s) => `mk-open-${s}`));
    if (p.modal) backdrop.classList.remove('open');
    hud.root.inert = false;
    hud.setExpanded(p.name, false);
    // uncover the HUD first: focus() does nothing on a visibility:hidden button (the map button under the map)
    for (const el of hud.coverable) el.classList.remove('mk-covered');
    const lf = lastFocus;
    lastFocus = null;
    if (p.el.contains(document.activeElement)) {
      if (lf && lf !== document.body && root.contains(lf) && lf.offsetParent !== null) lf.focus({ preventScroll: true });
      else document.activeElement.blur?.();
    }
  }
  app.open = (name, opts) => {
    if (intro?.open) intro.enter();
    const p = getPanel(name);
    if (!p) return false;
    if (current && current !== p) hide(current);
    current = p;
    show(p, opts);
    return true;
  };
  app.close = () => { if (current) { hide(current); current = null; cover(); } };
  app.toggle = (name) => (current?.name === name ? app.close() : app.open(name));

  // ---------------- travel & clock actions ----------------
  const VERB = { instant: 'Moving', slow: 'Strolling', walk: 'Walking', fast: 'Hurrying', run: 'Running' };
  const midSentence = (name) => String(name).replace(/^The /, 'the ');
  let goToken = 0;
  /** the walk in progress, for the map's route line: { key, at: [X,Y(,Z)], label, speed, verb } | null */
  app.trip = null;
  /** label: a place name, or { event: title } when going to watch an event */
  app.goTo = (target, label = 'that spot', { speed, keepMap = false } = {}) => {
    speed = speed || ctx.settings.get('travelSpeed') || 'walk';
    hud.dismissAccess(); // the notice was about where you stood
    if (!(keepMap && current?.name === 'map' && !isPhone())) app.close();
    if (typeof ctx.player?.goTo !== 'function') { ctx.bus.emit('ui:goto', { target, speed }); return; }
    const token = ++goToken;
    const ev = typeof label === 'object' ? label.event : null;
    const at = Array.isArray(target?.at) ? target.at : null;
    app.trip = at ? { key: token, at, label: ev ? `watch: ${ev}` : midSentence(label), speed, verb: VERB[speed] || 'Walking' } : null;
    if (speed !== 'instant') hud.travel(ev ? `${VERB[speed] || 'Walking'} to watch: ${ev}` : `${VERB[speed] || 'Walking'} to ${midSentence(label)}`);
    // a synchronous throw becomes a rejection too, so the pill never outlives the walk
    new Promise((res) => res(ctx.player.goTo(target, speed))).then((ok) => {
      if (token !== goToken) return;
      app.trip = null;
      hud.travel(null);
      if (ok && speed !== 'instant') hud.toast(ev ? `In place to watch: ${ev}` : `Arrived at ${midSentence(label)}`, 2600);
    }).catch((e) => { if (token === goToken) { hud.travel(null); app.trip = null; } console.error('[ui] goTo failed', e); });
  };
  app.goToEvent = (ev, speed) => {
    const target = app.data.viewTarget(ev);
    if (!target) { hud.toast('No viewing place is given for this event'); return; }
    app.goTo(target, { event: ev.title?.en || ev.id }, { speed });
  };
  app.jumpToEvent = (ev) => {
    const r = app.data.times(ev);
    if (!r || !ctx.time) return;
    ctx.time.set(r.t0 + 0.25);
    hud.toast(`Clock set to ≈ ${clock(r.t0)} · ${ev.title?.en || ev.id}`, 2600);
    current?.update?.();
  };
  app.toast = (m, ms) => hud.toast(m, ms);

  // ---------------- intro ----------------
  let startPos = null;
  const intro = createIntro(app, {
    onEnter() {
      root.classList.remove('mk-intro-open');
      hud.showHints();
      startPos = ctx.player?.position?.clone?.() || null;
    },
  });
  // a settings reload (quality / amah) returns the visitor to where they stood: no second intro
  let resume = false;
  try { resume = sessionStorage.getItem('mikdash.resume') === '1'; sessionStorage.removeItem('mikdash.resume'); } catch { /* ignore */ }
  root.classList.add('mk-intro-open');
  root.append(intro.el);
  app.introOpen = () => intro.open;
  // perf-1: with the first drawn frame (main.js compiles the shaders between 'ready' and 'firstFrame')
  ctx.bus.on('firstFrame', () => {
    if (resume) intro.enter(); else intro.show();
    // build the map's model, list and plan in idle time, so the first M opens at once
    const warm = () => { try { getPanel('map')?.prewarm?.(); } catch (e) { console.error('[ui] map prewarm failed', e); } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(warm, { timeout: 3000 }); else setTimeout(warm, 1500);
  });

  // ---------------- keyboard ----------------
  const typing = (t) => !!t?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]');
  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
  /** keep Tab inside a modal panel (aria-modal) */
  function trapTab(e, el) {
    const list = [...el.querySelectorAll(FOCUSABLE)].filter((x) => x.getClientRects().length && !x.closest('[inert]'));
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1], a = document.activeElement;
    if (e.shiftKey ? (a === first || !el.contains(a)) : (a === last || !el.contains(a))) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (intro.open) {
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') { e.preventDefault(); intro.enter(e); }
      return;
    }
    if (e.key === 'Tab' && current?.modal) { trapTab(e, current.el); return; }
    if (e.key === 'Escape' && current) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!current.onEscape?.()) app.close(); // a panel may use Esc first (e.g. to clear the map's search box)
      return;
    }
    if (typing(e.target) || e.repeat) return;
    // '?' (by character, whatever the layout): About, at the controls
    if (e.key === '?') { e.preventDefault(); if (current?.name === 'about') app.close(); else app.open('about', { section: 'controls' }); return; }
    const name = KEYS[e.code];
    if (name) { e.preventDefault(); app.toggle(name); }
  }, true);

  // re-entering the world (pointer locked) puts the panels away; the plan card may stay
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement && current && current.name !== 'map') app.close();
  });

  // ---------------- live settings ----------------
  ctx.bus.on('settings:change', (e) => {
    if (e?.key === 'reducedMotion') applyClasses();
    if (e?.key === 'labels' || e?.key === 'aggadah') hud.refresh();
  });
  ctx.bus.on('quality:change', applyClasses);
  ctx.bus.on('time:date', () => hud.refresh());

  // ---------------- ticker ----------------
  let acc = 0;
  ctx.engine.onUpdate((dt) => {
    hud.tick(dt);
    if (current) {
      current.tick?.(dt);
      acc += dt;
      if (acc >= 0.1) { acc = 0; current.update?.(); }
    }
    if (startPos && ctx.player?.position && ctx.player.position.distanceTo(startPos) > 2.5) { startPos = null; setTimeout(() => hud.hideHints(), 2500); }
  }, PRIORITY.ui);
  hud.refresh();

  return {
    toast: (m, ms) => hud.toast(m, ms),
    fade: (a, b) => hud.fade(a, b),
    open: (name, opts) => app.open(name, opts),
    close: () => app.close(),
    toggle: (name) => app.toggle(name),
    get panel() { return current?.name || null; },
    /** debugging / tests: the map's view and selection (null until the map has been opened once) */
    get map() { return panels.map?.api || null; },
    hints: (on = true) => (on ? hud.showHints() : hud.hideHints()),
    enter: () => intro.enter(),
  };
}

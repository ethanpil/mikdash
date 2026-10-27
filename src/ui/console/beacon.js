// The Menu beacon (console §0, §3.3.1): the one control always on screen in play. A live minimap disc with the glowing
// dot, the place's Hebrew and English names, "Menu" and the active device's key cap. Desktop: top-left; touch:
// bottom-right. Moving the mouse (pointer free), tapping empty scenery, any pad button or a new place "wakes" it: one
// pulse and a row of labelled quick chips for 4 s (or always, Settings → Display → Quick chips).
import { h, he, setText } from '../dom.js';
import { ico } from './icons.js';
import { createMinimap } from './minimap.js';
import { seasonal, clock } from '../format.js';
import { LADDER, RESTRICTED_RUNG } from '../data.js';

const WAKE_MS = 4000;

export function createBeacon(app) {
  const { ctx, data } = app;
  const disc = createMinimap(app, { size: 40, beacon: true });
  const heEl = he('', 'mk-beacon__he');
  const enEl = h('span.mk-beacon__en');
  const cap = h('span.mk-kbd.mk-beacon__cap');
  const dot = h('span.mk-beacon__new', { hidden: true, title: 'Something new in this version: Help → What\'s new' });
  const btn = h('button.mk-beacon.mk-live', {
    type: 'button', 'aria-keyshortcuts': 'Escape', 'aria-haspopup': 'dialog', 'aria-expanded': 'false',
    on: { click: () => app.openMenu({ from: btn }) },
  },
  disc.el,
  h('span.mk-beacon__names', heEl, enEl),
  h('span.mk-beacon__menu', ico('menu'), h('span.mk-beacon__lbl', 'Menu')),
  cap, dot);

  // ---------------- wake row ----------------
  const chip = (icon, label, key, fn, cls = '') => {
    const k = key ? h('span.mk-kbd.mk-chipcap', { 'data-cap': key }) : null;
    const b = h(`button.mk-qchip.mk-live${cls}`, { type: 'button', on: { click: (e) => { e.stopPropagation(); fn(); } } }, ico(icon), h('span.mk-qchip__t', label), k);
    return b;
  };
  const hourTxt = h('span.mk-qchip__t');
  const hourChip = h('button.mk-qchip.mk-qchip--hour.mk-live', { type: 'button', on: { click: () => app.open('time') } }, ico('time'), hourTxt,
    h('span.mk-kbd.mk-chipcap', { 'data-cap': 'time' }));
  const backChip = chip('back', 'Back', null, () => ctx.inspect?.back?.(), '.mk-qchip--back');
  backChip.hidden = true;
  const lookHint = h('div.mk-qhint', { hidden: true }, 'Click the view to look around');
  const touch = app.coarse;
  const chips = touch
    ? [hourChip, chip('map', 'Map', 'map', () => app.open('map')), chip('search', 'Search', 'search', () => app.search()), backChip]
    : [hourChip, chip('map', 'Map', 'map', () => app.open('map')), chip('search', 'Search', 'search', () => app.search()), chip('help', 'Help', 'help', () => app.open('help')), backChip];
  const row = h('div.mk-wake', { role: 'group', 'aria-label': 'Quick chips' }, chips, lookHint);
  const el = h('div.mk-beaconwrap', btn, row);

  // (null: not yet set, so the first setAwake(false) takes the invisible chips out of the tab order)
  let awakeUntil = 0, awake = null, hidden = false;
  function setAwake(on) {
    if (on === awake) return;
    awake = on;
    row.classList.toggle('is-awake', on);
    app.root.classList.toggle('mk-awake', on); // (touch coach marks keep clear of the chips)
    // out of the tab order (and the accessibility tree) while invisible
    for (const c of row.querySelectorAll('button')) c.tabIndex = on ? 0 : -1;
    if (on) row.removeAttribute('aria-hidden'); else row.setAttribute('aria-hidden', 'true');
  }
  setAwake(false);
  function wake(reason) {
    if (hidden) return;
    awakeUntil = performance.now() + WAKE_MS;
    if (!awake) {
      setAwake(true);
      paintChips();
      if (!app.reducedMotion()) { btn.classList.remove('is-pulse'); void btn.offsetWidth; btn.classList.add('is-pulse'); }
    }
    if (reason === 'esc-close' && !app.flags.lookHintShown && !app.coarse) {
      app.flags.lookHintShown = true;
      lookHint.hidden = false;
      setTimeout(() => { lookHint.hidden = true; }, WAKE_MS);
    }
  }

  // ---------------- place ----------------
  let zoneId;
  function setZone(id) {
    if (id === zoneId) return;
    zoneId = id;
    const z = data.zone(id);
    const en = (z?.name?.en || (id ? '' : 'Outside the precinct')).split(' — ')[0];
    setText(heEl, z?.name?.he?.split(' — ')[0] || '');
    heEl.hidden = !z?.name?.he;
    setText(enEl, en);
    const r = data.rung(id);
    const split = data.split(id);
    btn.classList.toggle('is-restricted', r !== null && r >= RESTRICTED_RUNG && !split);
    const sanct = split ? ', half in kodesh and half in chol' : r !== null ? `, sanctity of ${LADDER[r].en.replace(/^The /, 'the ')}` : '';
    btn.setAttribute('aria-label', `Menu — ${en || 'unknown place'}${sanct}`);
    btn.title = `${en}${sanct} — open the Menu`;
  }

  // ---------------- key caps ----------------
  function caps() {
    const c = app.input.cap('menu');
    setText(cap, c || '');
    cap.hidden = !c;
    for (const k of row.querySelectorAll('[data-cap]')) {
      const v = app.input.cap(k.dataset.cap);
      setText(k, v || '');
      k.hidden = !v;
    }
  }
  app.input.on(caps);
  caps();
  paintChips(); // (their labels are there before the first wake)

  // ---------------- tick ----------------
  let slow = 1;
  function tick(dt) {
    if (hidden) return;
    disc.tick(dt);
    slow += dt;
    if (slow < 0.25) return;
    slow = 0;
    setZone(data.currentZoneId());
    const always = ctx.settings.get('quickChips') === 'always';
    if (always) setAwake(true);
    else if (awake && performance.now() > awakeUntil && !row.matches(':hover, :focus-within')) setAwake(false);
    if (awake) paintChips();
  }
  function paintChips() {
    {
      const tm = ctx.time;
      const i = tm?.zmanim ? seasonal(tm, tm.t) : null;
      const txt = i ? `${i.half === 'day' ? 'Day' : 'Night'} · hour ${i.hour} · ≈ ${clock(tm.t)}` : 'The hour';
      if (hourTxt.textContent !== txt) { setText(hourTxt, txt); hourChip.setAttribute('aria-label', `${txt}. Time`); }
      const back = !!ctx.inspect?.canBack && app.showBackChip?.();
      if (backChip.hidden === back) {
        backChip.hidden = !back;
        if (back) backChip.querySelector('.mk-qchip__t').textContent = ctx.inspect.backLabel?.en || 'Back';
      }
    }
  }

  return {
    el, btn, row, disc,
    tick, wake,
    refresh() { zoneId = undefined; setZone(data.currentZoneId()); },
    setHidden(v) {
      hidden = v;
      el.classList.toggle('is-hidden', v);
      btn.tabIndex = v ? -1 : 0;
      if (v) setAwake(false);
    },
    setExpanded(v) { btn.setAttribute('aria-expanded', v ? 'true' : 'false'); },
    setNew(v) { dot.hidden = !v; },
    get expanded() { return !!awake; },
    get name() { return enEl.textContent; },
  };
}

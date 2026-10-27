// Selection card (side card on desktop, bottom sheet on phones): the place's names, its rung of sanctity and who may
// enter, other storeys at the same spot, what is happening here now and next (the single event row, with Go and Show
// me), and the map's extras around the one Go control: "This spot" and "About" (the place card).
import { h, he, setText } from '../dom.js';
import { ico } from '../console/icons.js';
import { LADDER } from '../data.js';
import { seasonal, quarters, accessLead } from '../format.js';
import { shortName } from './model.js';
import { eventRow, dynGroup } from '../console/eventrow.js';

/** "day 2¼–2¾" — an event's span in seasonal hours (hours elapsed since sunrise / sunset) */
export function seasonalRange(time, t0, t1) {
  const a = seasonal(time, t0), b = seasonal(time, t1);
  if (!a) return '';
  if (!b || (a.half === b.half && quarters(a.elapsed) === quarters(b.elapsed))) return `${a.half} ${quarters(a.elapsed)} h`;
  if (a.half === b.half) return `${a.half} ${quarters(a.elapsed)}–${quarters(b.elapsed)} h`;
  return `${a.half} ${quarters(a.elapsed)} h – ${b.half} ${quarters(b.elapsed)} h`;
}

/**
 * opts: { model, onClose(), onGo(id), onSpot(), onInfo(id), onSelect(id) }
 */
export function createCard(app, opts) {
  const { ctx, data } = app;
  const { model } = opts;
  const heEl = he('', 'mk-mapcard__he');
  const enEl = h('h3.mk-mapcard__en', { tabindex: '-1' });
  const trEl = h('div.mk-mapcard__tr');
  const lvlEl = h('span.mk-mapcard__lvl');
  const close = h('button.mk-hbtn.mk-mapcard__x', { type: 'button', 'aria-label': 'Clear the selection', title: 'Clear the selection', on: { click: () => opts.onClose() } }, ico('close'), h('span.mk-mapcard__xt', 'Clear'));
  const rungs = h('span.mk-rungs', { 'aria-hidden': 'true' }, LADDER.map((_, i) => h('i', { style: { height: `${3 + i}px` } })));
  const rungText = h('span');
  const sanct = h('div.mk-mapcard__sanct', rungs, rungText);
  const access = h('p.mk-mapcard__access');
  const levels = h('div.mk-mapcard__levels');
  const nowBox = h('div.mk-mapcard__evs');
  const nextBox = h('div.mk-mapcard__evs');
  const nowH = h('h4.mk-h');
  const scroll = h('div.mk-mapcard__scroll', { 'data-scroll': '' },
    h('section.mk-mapcard__sec', nowH, nowBox),
    h('section.mk-mapcard__sec', h('h4.mk-h', 'Next here'), nextBox));

  // ---------------- go controls: the one Go control, plus the map's extras ----------------
  const goBox = h('span.mk-mapcard__go');
  const spotBtn = h('button.mk-btn', { type: 'button', title: 'Go to the exact spot you picked on the map', on: { click: () => opts.onSpot() } }, ico('pin'), h('span.mk-mapcard__lbl', 'This spot'));
  const infoBtn = h('button.mk-btn', { type: 'button', title: 'Everything about this place', on: { click: () => opts.onInfo(cur) } }, ico('here'), h('span.mk-mapcard__lbl', 'About'));
  const noStand = h('p.mk-mapcard__nostand', 'No floor to stand on here — it is seen from the places around it.');
  const foot = h('div.mk-mapcard__foot', h('div.mk-mapcard__acts', goBox, spotBtn, infoBtn), noStand);

  const grab = h('div.mk-mapcard__grab', { 'aria-hidden': 'true' });
  const el = h('section.mk-mapcard.mk-live', { 'aria-label': 'Selected place', hidden: true },
    grab,
    // the storey tag belongs to the name: it stays with it where short landscape moves the rest below the activity
    h('header.mk-mapcard__head', h('div.mk-mapcard__names', heEl, enEl, trEl, lvlEl), close),
    h('div.mk-mapcard__meta', sanct, access, levels),
    scroll, foot);

  // phones: drag the sheet down by its grabber to put it away (past a quarter of its height), else it springs back
  let y0 = null, dy = 0;
  grab.addEventListener('pointerdown', (e) => { y0 = e.clientY; dy = 0; grab.setPointerCapture?.(e.pointerId); el.style.transition = 'none'; });
  grab.addEventListener('pointermove', (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); el.style.transform = `translateY(${dy}px)`; });
  const release = () => {
    if (y0 === null) return;
    y0 = null;
    el.style.transition = '';
    el.style.transform = '';
    if (dy > el.offsetHeight * 0.25) opts.onClose();
  };
  grab.addEventListener('pointerup', release);
  grab.addEventListener('pointercancel', release);

  // ---------------- state ----------------
  let cur = null, spot = null, rows = [], listKey = '';
  function render() {
    const z = data.zone(cur) || { name: {} };
    const m = model.get(cur);
    const n = z.name || {};
    setText(heEl, n.he || '');
    heEl.hidden = !n.he;
    setText(enEl, n.en || cur);
    const tr = n.translit && !String(n.en || '').toLowerCase().includes(String(n.translit).toLowerCase()) ? n.translit : '';
    setText(trEl, tr);
    trEl.hidden = !tr;
    lvlEl.hidden = !m?.stacked;
    if (m?.stacked) { setText(lvlEl, { upper: 'Upper storey', roof: 'On the roof', below: 'Below ground' }[m.level] || m.level); lvlEl.dataset.level = m.level; }
    const r = data.rung(cur);
    sanct.hidden = r === null;
    if (r !== null) {
      [...rungs.children].forEach((b, i) => { b.className = i === r ? 'cur' : (i < r ? 'on' : ''); });
      setText(rungText, `Sanctity of ${LADDER[r].en.replace(/^The /, 'the ')}`);
      sanct.title = `${LADDER[r].en}: ${LADDER[r].rule}`;
    }
    const acc = accessLead(z.access);
    access.replaceChildren(acc ? h('b', 'Who may enter ') : '', acc || (r !== null ? LADDER[r].rule : ''));
    access.title = z.access || '';
    access.hidden = !acc && r === null;
    // other storeys at this spot
    const others = model.otherLevels(cur);
    levels.replaceChildren(...(others.length ? [h('span.mk-mapcard__lvlh', 'Also here'), ...others.map((id) => {
      const o = model.get(id);
      const on = model.nameOf(o);
      const arrow = o.level === 'below' ? '↓' : o.stacked ? '↑' : '·';
      return h('button.mk-chip2', { type: 'button', title: `Select ${on.short}`, on: { click: () => opts.onSelect(id) } }, h('span', { 'aria-hidden': 'true' }, arrow), on.short);
    })] : []));
    levels.hidden = !others.length;
    // go controls: zones with no walkable interior (stand: null in the zone content) cannot be gone to
    const standless = z.stand === null;
    goBox.replaceChildren(standless ? '' : app.travel.control(() => opts.onGo(cur), { label: 'Go there' }));
    noStand.hidden = !standless;
    spotBtn.hidden = !spot;
    listKey = '';
    update(true);
  }

  let dynOpen = false;
  function update(force = false) {
    if (!cur) return;
    const t = ctx.time?.t;
    // the day's events here, and the individuals' offerings now at this place (one expandable entry)
    const all = data.at(cur, t, { dynamic: true });
    const now = all.filter((e) => !e.dynamic), dyn = all.filter((e) => e.dynamic);
    const next = data.upcoming(t, 80).filter((ev) => ev.zone === cur || (Array.isArray(ev.zones) && ev.zones.includes(cur))).slice(0, 3);
    const key = `${now.map((e) => e.id).join()}|${dyn.map((e) => e.id).join()}|${next.map((e) => e.id).join()}`;
    if (force || key !== listKey) {
      listKey = key;
      rows = [];
      setText(nowH, all.length ? `Happening here now · ${all.length}` : 'Happening here now');
      const els = now.map((ev) => { const r = eventRow(app, ev, { place: false }); rows.push(r); return r.el; });
      if (dyn.length) {
        const g = dynGroup(app, dyn, { key: `card-${cur}`, title: `${dyn.length} individual offering${dyn.length === 1 ? '' : 's'} here`, open: dynOpen, onToggle: (on) => { dynOpen = on; } });
        rows.push(g);
        els.push(g.el);
      }
      nowBox.replaceChildren(...(els.length ? els : [h('div.mk-empty', 'Nothing in the order of the day here at this hour.')]));
      nextBox.replaceChildren(...(next.length ? next.map((ev) => { const r = eventRow(app, ev, { place: false }); rows.push(r); return r.el; })
        : [h('div.mk-empty', 'Nothing more here today.')]));
    }
    for (const r of rows) r.update(t);
  }

  return {
    el,
    get id() { return cur; },
    show(id, { spot: sp = null, expand = null } = {}) {
      const changed = id !== cur;
      cur = id;
      spot = sp;
      el.hidden = false;
      render();
      // a new place opens at its name (phones and short landscape scroll the whole sheet; desktop its middle)
      if (changed) { el.scrollTop = 0; scroll.scrollTop = 0; }
      if (expand) {
        const r = el.querySelector(`[data-ev="${CSS.escape(expand)}"]`);
        if (r) requestAnimationFrame(() => { r.classList.add('is-focus'); r.scrollIntoView({ block: 'nearest' }); });
      }
    },
    hide() { cur = null; spot = null; el.hidden = true; },
    update,
    focusTitle() { enEl.focus({ preventScroll: true }); },
    summary() {
      if (!cur) return '';
      const z = data.zone(cur) || {};
      const nm = z.name?.en || shortName(cur);
      const now = data.at(cur, ctx.time?.t);
      return `${nm}${model.get(cur)?.stacked ? ` (${model.get(cur).level} level)` : ''}. ${now.length ? `${now.length} ${now.length === 1 ? 'activity' : 'activities'} now: ${now.map((e) => e.title?.en || e.id).join('; ')}.` : 'Nothing happening here now.'} Press Enter to go there.`;
    },
  };
}

// Selection card (side card on desktop, bottom sheet on phones): the place's names, its rung of sanctity and who may
// enter, other storeys at the same spot, what is happening here now and next (seasonal hours; each expands to its
// summary and sources, with its own "Watch" button), and the Go controls with a remembered speed.
import { h, he, icon, setText } from '../dom.js';
import { sourcesEl, SPEEDS } from '../events.js';
import { LADDER } from '../data.js';
import { clock, seasonal, quarters, wrap, accessLead } from '../format.js';
import { shortName } from './model.js';
import { dynGroup } from '../timepanel.js';

const GO_VERB = { instant: 'Go there', slow: 'Stroll there', walk: 'Walk there', fast: 'Hurry there', run: 'Run there' };

/** "day 2¼–2¾" — an event's span in seasonal hours (hours elapsed since sunrise / sunset) */
export function seasonalRange(time, t0, t1) {
  const a = seasonal(time, t0), b = seasonal(time, t1);
  if (!a) return '';
  if (!b || (a.half === b.half && quarters(a.elapsed) === quarters(b.elapsed))) return `${a.half} ${quarters(a.elapsed)} h`;
  if (a.half === b.half) return `${a.half} ${quarters(a.elapsed)}–${quarters(b.elapsed)} h`;
  return `${a.half} ${quarters(a.elapsed)} h – ${b.half} ${quarters(b.elapsed)} h`;
}

/**
 * opts: { model, onClose(), onGo(id, speed), onSpot(speed), onInfo(id), onSelect(id), onWatch(ev, speed) }
 */
export function createCard(app, opts) {
  const { ctx, data } = app;
  const { model } = opts;
  const heEl = he('', 'mk-mapcard__he');
  const enEl = h('h3.mk-mapcard__en', { tabindex: '-1' });
  const trEl = h('div.mk-mapcard__tr');
  const lvlEl = h('span.mk-mapcard__lvl');
  const close = h('button.mk-close', { type: 'button', 'aria-label': 'Clear the selection', title: 'Clear the selection', on: { click: () => opts.onClose() } }, icon('close'));
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

  // ---------------- go controls ----------------
  let speed = app.settings?.get('travelSpeed') || 'walk';
  const seg = h('div.mk-seg.mk-mapcard__speed', { role: 'radiogroup', 'aria-label': 'Travel speed' }, SPEEDS.map(([v, l]) => h('button', {
    type: 'button', role: 'radio', 'data-speed': v, 'aria-checked': v === speed ? 'true' : 'false', tabindex: v === speed ? '0' : '-1',
    on: { click: () => setSpeed(v, true) },
  }, l)));
  seg.addEventListener('keydown', (e) => {
    const i = SPEEDS.findIndex(([v]) => v === speed);
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    setSpeed(SPEEDS[(i + d + SPEEDS.length) % SPEEDS.length][0], true);
    seg.querySelector(`[data-speed=${speed}]`)?.focus();
  });
  // short landscape phones show "Go" beside the speeds and the other two as icons (styles.css), so all fit one row
  const goText = h('span.mk-mapcard__golong');
  const goBtn = h('button.mk-btn.mk-btn--primary.mk-mapcard__go', { type: 'button', on: { click: () => opts.onGo(cur, speed) } }, icon('walk'), goText, h('span.mk-mapcard__goshort', 'Go'));
  const spotBtn = h('button.mk-btn', { type: 'button', title: 'Go to the exact spot you picked on the map', on: { click: () => opts.onSpot(speed) } }, icon('pin'), h('span.mk-mapcard__lbl', 'This spot'));
  const infoBtn = h('button.mk-btn', { type: 'button', title: 'Everything about this place (opens the place panel)', 'aria-label': 'About this place', on: { click: () => opts.onInfo(cur) } }, icon('info'), h('span.mk-mapcard__lbl', 'About'));
  const noStand = h('p.mk-mapcard__nostand', 'No floor to stand on here — it is seen from the places around it.');
  const foot = h('div.mk-mapcard__foot', seg, h('div.mk-mapcard__acts', goBtn, spotBtn, infoBtn), noStand);

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

  function setSpeed(v, user) {
    speed = v;
    for (const b of seg.children) {
      const on = b.dataset.speed === v;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
    }
    setText(goText, GO_VERB[v] || 'Go there');
    spotBtn.setAttribute('aria-label', `${(GO_VERB[v] || 'Go there').replace(/ there$/, '')} to this spot`);
    if (user) app.settings?.set('travelSpeed', v); // one remembered speed for the map, event rows and the card
  }
  setSpeed(speed, false);
  ctx.bus.on('settings:change', (e) => { if (e?.key === 'travelSpeed' && e.value !== speed) setSpeed(e.value, false); });

  // ---------------- event rows ----------------
  const open = new Set(); // expanded event ids
  function row(ev, mode) {
    const r = data.times(ev);
    const time = h('span.mk-mev__time.num');
    const moreId = `mk-mev-${String(ev.id || Math.random()).replace(/[^\w-]/g, '')}-${mode}`;
    const hit = h('button.mk-mev__hit', { type: 'button', 'aria-expanded': open.has(ev.id) ? 'true' : 'false', 'aria-controls': moreId },
      h('span.mk-mev__title', ev.title?.en || ev.id),
      ev.title?.he ? he(ev.title.he, 'mk-mev__he') : null,
      time);
    const watch = h('button.mk-btn.mk-btn--sm', { type: 'button', title: 'Go to a good spot to watch this', on: { click: () => opts.onWatch(ev, speed) } }, icon('walk'), 'Watch');
    const more = h('div.mk-mev__more', { id: moreId },
      ev.summary ? h('p.mk-mev__sum', ev.summary) : null,
      ev.sources?.length ? sourcesEl(ev.sources) : null,
      h('div.mk-mev__acts', watch, ev.layer === 'aggadah' ? h('span.mk-badge', 'Aggadah') : null));
    const el = h(`article.mk-mev${mode === 'now' ? '.is-now' : ''}.imp-${ev.importance || 1}`, { 'data-ev': ev.id }, hit, more);
    el.classList.toggle('is-open', open.has(ev.id));
    hit.addEventListener('click', () => {
      const on = !el.classList.contains('is-open');
      el.classList.toggle('is-open', on);
      hit.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) open.add(ev.id); else open.delete(ev.id);
    });
    const update = (t) => {
      if (!r) { setText(time, ''); return; }
      const range = `${seasonalRange(ctx.time, r.t0, r.t1)} · ≈ ${clock(r.t0)}–${clock(r.t1)}`;
      const left = Math.max(1, Math.round(wrap(r.t1 - t)));
      if (mode === 'now') setText(time, `${range} · ${left < 90 ? `${left} min` : `${Math.floor(left / 60)} h ${String(left % 60).padStart(2, '0')}`} left`);
      else {
        const d = wrap(r.t0 - t);
        setText(time, `${d < 60 ? `in ${Math.max(1, Math.round(d))} min` : `in ${Math.floor(d / 60)} h ${String(Math.round(d % 60)).padStart(2, '0')}`} · ${range}`);
      }
      time.title = 'Seasonal hours (sha\'ot zmaniyot) since sunrise or sunset; ≈ civil time';
    };
    update(ctx.time?.t);
    return { el, update };
  }

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
    goBtn.disabled = standless;
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
      const els = now.map((ev) => { const r = row(ev, 'now'); rows.push(r); return r.el; });
      if (dyn.length) {
        const g = dynGroup(app, dyn, { key: `card-${cur}`, title: "Individuals' offerings here", open: dynOpen, onToggle: (on) => { dynOpen = on; },
          verb: 'Watch', speed: () => speed, indent: false, hint: 'each at its current step — expand to watch one' });
        rows.push({ update: () => g.update() });
        els.push(g.el);
      }
      nowBox.replaceChildren(...(els.length ? els : [h('div.mk-empty', 'Nothing in the order of the day here at this hour.')]));
      nextBox.replaceChildren(...(next.length ? next.map((ev) => { const r = row(ev, 'next'); rows.push(r); return r.el; })
        : [h('div.mk-empty', 'Nothing more here today.')]));
    }
    for (const r of rows) r.update(t);
  }

  return {
    el,
    get id() { return cur; },
    get speed() { return speed; },
    show(id, { spot: sp = null, expand = null } = {}) {
      const changed = id !== cur;
      cur = id;
      spot = sp;
      if (changed) open.clear();
      if (expand) open.add(expand);
      el.hidden = false;
      render();
      // a new place opens at its name (phones and short landscape scroll the whole sheet; desktop its middle)
      if (changed) { el.scrollTop = 0; scroll.scrollTop = 0; }
      if (expand) {
        const r = el.querySelector(`[data-ev="${CSS.escape(expand)}"]`);
        if (r) requestAnimationFrame(() => r.scrollIntoView({ block: 'nearest' }));
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
      return `${nm}${model.get(cur)?.stacked ? ` (${model.get(cur).level} level)` : ''}. ${now.length ? `${now.length} ${now.length === 1 ? 'activity' : 'activities'} now: ${now.map((e) => e.title?.en || e.id).join('; ')}.` : 'Nothing happening here now.'} Press Enter to ${(GO_VERB[speed] || 'go there').toLowerCase()}.`;
    },
  };
}

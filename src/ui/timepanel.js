// TIME panel: the seasonal-hour dial (sha'ot zmaniyot, GRA: sunrise→sunset in 12 equal hours, the night likewise),
// play/pause and speed, the date, then "Happening now" and "Next" straight away; the zmanim and the explanation
// of the hours come after the lists.
import { h, he, icon, setText, clear, append } from './dom.js';
import { createPanel, section } from './panel.js';
import { eventRow } from './events.js';
import {
  seasonal, seasonalLabelHe, fromDial, clock, ordinal, quarters, hebrewAt, civilDate, civilShort, addDays,
  DAY_TYPE_LABEL, PSALM_OF_DAY, WEEKDAYS,
} from './format.js';
import { ZMAN_ANGLES } from '../time/zmanim.js';

const NS = 'http://www.w3.org/2000/svg';
const VB = 172; // viewBox half-size
const R = 118; // sky ring radius
const RW = 20; // ring width
const LANES = [137, 144, 151]; // event tracks, innermost first
const GLYPH_R = 162; // sunrise / midday / sunset / midnight glyphs and the dawn / nightfall diamonds
const LONG = 2; // events longer than this (seasonal hours) are drawn as a thin underlay
const TRIM = 0.04; // seasonal hours cut from both ends of an arc so neighbours stay apart
const MIN_SPAN = 0.1; // shortest drawn arc
const SPEEDS = [1, 10, 60, 600];

const svgEl = (tag, attrs = {}) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};
const phi = (s) => (s * 15 + 270) * Math.PI / 180;
const pt = (s, r) => [r * Math.sin(phi(s)), -r * Math.cos(phi(s))];
const f2 = (n) => n.toFixed(2);
function arcPath(s0, s1, r) {
  let span = s1 - s0;
  if (span <= 0) span += 24;
  span = Math.min(span, 23.999);
  const [x0, y0] = pt(s0, r), [x1, y1] = pt(s0 + span, r);
  return `M${f2(x0)} ${f2(y0)} A${r} ${r} 0 ${span > 12 ? 1 : 0} 1 ${f2(x1)} ${f2(y1)}`;
}
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const mix = (a, b, t) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
/** do two circular intervals [s, s+span] (mod 24) overlap, with a gap? */
const clash = (a, b, gap) => ((b.s0 - a.s0 + 24) % 24) < a.ext + gap || ((a.s0 - b.s0 + 24) % 24) < b.ext + gap;

/**
 * Greedy lane packing: events sorted by start; each goes to the first lane where it clashes with nothing. Long
 * events become an underlay on the innermost lane. With every lane taken, the least crowded lane is used.
 */
export function packLanes(items, nLanes = LANES.length, gap = 0.06) {
  const lanes = Array.from({ length: nLanes }, () => []);
  for (const it of [...items].sort((a, b) => a.s0 - b.s0)) {
    if (it.long) { it.lane = 0; continue; }
    let lane = lanes.findIndex((L) => !L.some((o) => clash(o, it, gap)));
    if (lane < 0) lane = lanes.reduce((best, L, i) => (L.filter((o) => clash(o, it, gap)).length < lanes[best].filter((o) => clash(o, it, gap)).length ? i : best), 0);
    it.lane = lane;
    lanes[lane].push(it);
  }
  return items;
}

/**
 * A parent event's dynamic sub-events (each individual's offering in progress at that stage of the stream) as one
 * expandable entry: a header with the count, and a row per offering — what it is, its current step, where, and a
 * Go / Watch button at the chosen speed. opts: { title, he, open, onToggle(open), verb, speed() }.
 * Returns { el, update(t), ev: null }.
 */
export function dynGroup(app, items, opts = {}) {
  const { data } = app;
  const count = h('span.mk-badge.mk-badge--gold');
  const moreId = `mk-dyn-${String(opts.key || opts.title || 'g').replace(/[^\w-]/g, '')}`;
  const hit = h('button.mk-mev__hit', { type: 'button', 'aria-expanded': opts.open ? 'true' : 'false', 'aria-controls': moreId },
    h('span.mk-mev__title', { style: { fontSize: '15px' } }, opts.title || 'Offerings in progress'),
    opts.he ? he(opts.he, 'mk-mev__he') : null,
    h('span.mk-mev__time', count, ' ', h('span.mk-muted', opts.hint || "individuals' offerings at this stage — expand to watch one")));
  const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '7px' } });
  const more = h('div.mk-mev__more', { id: moreId }, list);
  const el = h('article.mk-mev.is-now.mk-dyn', { 'data-dyn': opts.key || '', style: { marginLeft: opts.indent === false ? '0' : '14px' } }, hit, more);
  el.classList.toggle('is-open', !!opts.open);
  hit.addEventListener('click', () => {
    const on = !el.classList.contains('is-open');
    el.classList.toggle('is-open', on);
    hit.setAttribute('aria-expanded', on ? 'true' : 'false');
    opts.onToggle?.(on);
  });
  const rows = items.map((ev) => {
    const title = h('span', { style: { font: '600 14.5px/1.25 var(--mk-display)', color: 'var(--mk-ink)' } });
    const step = h('span', { style: { fontSize: '13.5px', lineHeight: '1.35', color: 'var(--mk-ink-2)' } });
    const place = h('span.mk-muted', { style: { fontSize: '12.5px' } });
    const go = h('button.mk-btn.mk-btn--sm', { type: 'button', title: 'Go to a good spot to watch this offering at its current step',
      on: { click: () => app.goToEvent(ev, opts.speed?.() || app.settings?.get('travelSpeed') || 'walk') } }, icon('walk'), opts.verb || 'Go');
    const row = h('div.mk-dyn__row', { 'data-ev': ev.id, style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderTop: '1px solid var(--mk-line-2)' } },
      h('div', { style: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '2px' } }, title, step, place), go);
    list.append(row);
    return { ev, title, step, place };
  });
  function update() {
    setText(count, `${items.length} now`);
    for (const r of rows) {
      const ev = r.ev;
      setText(r.title, ev.typeName?.en || ev.title?.en || ev.id);
      setText(r.step, ev.summary || '');
      const z = data.zone(ev.zone)?.name?.en || '';
      setText(r.place, `${ev.where ? `${ev.where} · ` : ''}${z}${Number.isFinite(ev.t1) ? ` · until ≈ ${clock(ev.t1)}` : ''}`);
    }
  }
  update();
  return { el, update, ev: null };
}

export function createTimePanel(app) {
  const { ctx, data } = app;
  const panel = createPanel(app, { name: 'time', title: 'The hour', heTitle: 'השעה', side: 'right' });
  const body = panel.body;
  const T = () => (ctx.time?.zmanim ? ctx.time : null);

  // ---------------- dial ----------------
  const svg = svgEl('svg', { viewBox: `${-VB} ${-VB} ${2 * VB} ${2 * VB}`, class: 'mk-dial' });
  const ring = svgEl('g', {
    class: 'mk-dial__ring', role: 'slider', tabindex: '0', 'aria-label': 'Seasonal-hour dial: drag or use the arrow keys to set the time',
    'aria-valuemin': '0', 'aria-valuemax': '24',
  });
  const gStatic = svgEl('g');
  const curHour = svgEl('path', { fill: 'none', stroke: 'rgba(255,244,214,.34)', 'stroke-width': RW + 4, 'pointer-events': 'none' });
  const focusRing = svgEl('circle', { r: R + RW / 2 + 4, fill: 'none', stroke: 'transparent', 'stroke-width': 1.5, class: 'mk-dial__focus' });
  const handle = svgEl('g', { 'pointer-events': 'none' });
  const handleGlow = svgEl('circle', { r: 17, fill: 'rgba(255,226,150,.25)' });
  const handleDisc = svgEl('circle', { r: 10.5, stroke: '#1a140d', 'stroke-width': 2 });
  handle.append(handleGlow, handleDisc);
  ring.append(gStatic, curHour, focusRing, handle);
  const gEvents = svgEl('g', { class: 'mk-dial__events', role: 'group', 'aria-label': 'Events of the day on the dial. Arrow keys move between them; Enter sets the clock.' });
  svg.append(ring, gEvents);

  const roHalf = h('div.mk-readout__half');
  const roHour = h('div.mk-readout__hour');
  const roOf = h('div.mk-readout__of');
  const roHe = he('', 'mk-readout__he');
  const roCivilT = h('span');
  const roCivil = h('div.mk-readout__civil.num', roCivilT, h('small', 'IST'));
  const peekWhen = h('div.mk-readout__half');
  const peekTitle = h('div.mk-readout__title');
  const peekTime = h('div.mk-readout__civil.num');
  const peekHint = h('div.mk-readout__hint');
  const readout = h('div.mk-readout', { 'aria-hidden': 'true' },
    h('div.mk-readout__now', roHalf, roHour, roOf, roHe, roCivil),
    h('div.mk-readout__peek', peekWhen, peekTitle, peekTime, peekHint));
  const dialWrap = h('div.mk-dialwrap', svg, readout);

  // ---------------- transport ----------------
  const playBtn = h('button.mk-play', { type: 'button', on: { click: () => { const t = T(); if (!t) return; t.pause(!t.paused); update(true); } } });
  const stepBack = h('button.mk-step', { type: 'button', 'aria-label': 'Back one seasonal hour', title: 'Back one seasonal hour', on: { click: () => stepHours(-1) } }, icon('back'));
  const stepFwd = h('button.mk-step', { type: 'button', 'aria-label': 'Forward one seasonal hour', title: 'Forward one seasonal hour', on: { click: () => stepHours(1) } }, icon('fwd'));
  const speedSeg = h('div.mk-seg', { role: 'group', 'aria-label': 'Clock speed' }, SPEEDS.map((n) => h('button', {
    type: 'button', 'data-speed': n, 'aria-pressed': 'false', title: n === 1 ? 'Real time' : `${n} times real time`,
    on: { click: () => { const t = T(); if (!t) return; t.setSpeed(n); t.pause(false); update(true); } },
  }, `${n}×`)));
  const transport = h('div.mk-transport', stepBack, playBtn, stepFwd, speedSeg);

  // ---------------- date (one compact row: ‹ Mon 2 Nov · כ״ב בחשון › + day type / psalm) ----------------
  const shiftDay = (n) => { const t = T(); if (t) t.setDate(addDays(t.dateString, n)); };
  const dayBtn = (n, ico, label) => h('button.mk-close', { type: 'button', 'aria-label': label, title: label, on: { click: () => shiftDay(n) } }, icon(ico));
  const dateEn = h('span.mk-daterow__en.num');
  const dateHe = he('', 'mk-daterow__he');
  const dateInput = h('input.mk-daterow__input', { type: 'date', tabindex: '-1', 'aria-hidden': 'true' });
  dateInput.addEventListener('change', () => { if (dateInput.value) T()?.setDate(dateInput.value); });
  const openPicker = () => { try { dateInput.showPicker(); } catch { dateInput.focus(); dateInput.click(); } };
  const dateMain = h('button.mk-daterow__main', { type: 'button', on: { click: openPicker } }, icon('cal'), dateEn, h('span.mk-daterow__dot', '·'), dateHe);
  const dateMeta = h('div.mk-daterow__meta');
  const dateRow = h('div.mk-daterow',
    h('div.mk-daterow__line', dayBtn(-1, 'prev', 'Previous day'), h('div.mk-daterow__pick', dateMain, dateInput), dayBtn(1, 'next', 'Next day')),
    dateMeta);

  // ---------------- events ----------------
  const nowList = h('div.mk-evs');
  const nextList = h('div.mk-evs');
  const sample = h('p.mk-sample', 'Sample schedule — the full daily order will replace these entries.');

  // ---------------- zmanim + explanation (after the lists) ----------------
  const zmanimEl = h('div.mk-zmanim');
  const teaser = h('p.mk-p.mk-muted.mk-teaser');
  const explainLead = h('p.mk-p');
  const explainMore = h('div');
  const explain = h('details.mk-explain', h('summary', 'How the hours are counted'), explainLead, explainMore);

  const noClock = h('div.mk-empty', { hidden: true }, 'The clock is unavailable: the time system did not start, so the hour cannot be shown or set.');
  const live = [
    section(null, dialWrap, transport, dateRow),
    section('Happening now', nowList),
    section('Next', nextList),
    section('Seasonal hours', zmanimEl, teaser, explain),
  ];
  body.append(noClock, ...live, sample);
  let clockShown = null;
  function showClock(ok) {
    if (ok === clockShown) return;
    clockShown = ok;
    noClock.hidden = ok;
    for (const el of live) el.hidden = !ok;
    if (!ok) sample.hidden = true; // rebuildLists() shows it again when the lists come back
    else listKey = '';
  }

  // ---------------- dial construction (per date) ----------------
  let built = '';
  function build() {
    const time = T();
    if (!time) return;
    const z = time.zmanim;
    const key = `${time.dateString}|${data.fixtureEvents}|${ctx.settings?.get('aggadah')}`;
    if (key === built) return;
    built = key;
    clear(gStatic);
    const sOf = (t) => seasonal(time, t).s;
    const sAlot = sOf(z.alot), sTzeit = sOf(z.tzeit);
    // sky colour around the ring
    const C = {
      deep: hex('#141c30'), mid: hex('#0f1626'), twi: hex('#4a4a6e'), rose: hex('#d8935e'), day: hex('#e6c788'), noon: hex('#f4e3b4'),
    };
    const stops = [[0, C.rose], [0.9, C.day], [6, C.noon], [11.1, C.day], [12, C.rose], [sTzeit, C.twi], [Math.max(sTzeit + 0.5, 15), C.deep],
      [18, C.mid], [Math.min(sAlot - 0.5, 21), C.deep], [sAlot, C.twi], [24, C.rose]].sort((a, b) => a[0] - b[0]);
    const colorAt = (s) => {
      for (let i = 1; i < stops.length; i++) {
        if (s <= stops[i][0]) {
          const [s0, c0] = stops[i - 1], [s1, c1] = stops[i];
          return mix(c0, c1, (s - s0) / Math.max(1e-6, s1 - s0));
        }
      }
      return mix(C.rose, C.rose, 0);
    };
    const N = 96;
    for (let i = 0; i < N; i++) {
      const s0 = (i / N) * 24, s1 = ((i + 1.08) / N) * 24;
      gStatic.append(svgEl('path', { d: arcPath(s0, s1, R), stroke: colorAt((s0 + s1) / 2), 'stroke-width': RW, fill: 'none' }));
    }
    // hour separators and numerals
    for (let k = 0; k < 24; k++) {
      const [x0, y0] = pt(k, R - RW / 2), [x1, y1] = pt(k, R + RW / 2);
      const major = k % 6 === 0;
      gStatic.append(svgEl('line', { x1: f2(x0), y1: f2(y0), x2: f2(x1), y2: f2(y1), stroke: major ? 'rgba(10,8,5,.75)' : 'rgba(10,8,5,.4)', 'stroke-width': major ? 1.6 : 1 }));
      const day = k < 12;
      const [tx, ty] = pt(k + 0.5, R - RW / 2 - 11);
      const t = svgEl('text', { x: f2(tx), y: f2(ty + 3.6), 'text-anchor': 'middle', 'font-size': 10.5, fill: day ? '#e9dcbc' : '#8e97ae' });
      t.textContent = String((k % 12) + 1);
      gStatic.append(t);
    }
    // the event band behind the lanes
    gStatic.append(svgEl('circle', { r: LANES[1], fill: 'none', stroke: 'rgba(241,232,212,.045)', 'stroke-width': LANES[2] - LANES[0] + 7 }));
    // zman glyphs outside the lanes: sunrise, midday, sunset, midnight; diamonds for alot & tzeit
    const glyph = (s, kind) => {
      const [x, y] = pt(s, GLYPH_R);
      const g = svgEl('g', { transform: `translate(${f2(x)} ${f2(y)})`, 'pointer-events': 'none' });
      if (kind === 'sun') g.innerHTML = '<circle r="3.6" fill="#f2d38a"/><g stroke="#f2d38a" stroke-width="1.1" stroke-linecap="round"><path d="M0 -6.6V-5.4M0 6.6V5.4M-6.6 0H-5.4M6.6 0H5.4M-4.7 -4.7l.85 .85M4.7 4.7l-.85 -.85M-4.7 4.7l.85 -.85M4.7 -4.7l-.85 .85"/></g>';
      else if (kind === 'rise' || kind === 'set') g.innerHTML = '<path d="M-5.5 1.6a5.5 5.5 0 0 1 11 0z" fill="#e0a067"/><path d="M-7.5 2.4H7.5" stroke="#e0a067" stroke-width="1.1"/>';
      else if (kind === 'moon') g.innerHTML = '<path d="M2.2 -4.6a5 5 0 1 0 2.6 8.4a4 4 0 1 1 -2.6 -8.4z" fill="#c9d3e8"/>';
      else g.innerHTML = '<rect x="-2.6" y="-2.6" width="5.2" height="5.2" transform="rotate(45)" fill="none" stroke="#b9b2cf" stroke-width="1.2"/>';
      gStatic.append(g);
    };
    glyph(0, 'rise'); glyph(6, 'sun'); glyph(12, 'set'); glyph(18, 'moon'); glyph(sAlot, 'dia'); glyph(sTzeit, 'dia');
    // inner hairline
    gStatic.append(svgEl('circle', { r: R - RW / 2 - 22, fill: 'none', stroke: 'rgba(212,166,64,.18)', 'stroke-width': 1 }));
    buildEvents();
    buildZmanim();
    explainText();
  }

  // ---------------- event arcs: lanes, preview in the centre, a single tab stop (arrow keys move) ----------------
  let arcs = [], arcsInTime = [], peekItem = null, peekSrc = null, lastPointer = 'mouse', activeKey = null;
  function buildEvents() {
    clear(gEvents);
    const time = T();
    const items = [];
    for (const ev of data.events()) {
      if (!data.dayOk(ev) || !data.layerOk(ev)) continue;
      const r = data.times(ev);
      if (!r) continue;
      const s0 = seasonal(time, r.t0).s;
      let span = (seasonal(time, r.t1).s - s0 + 24) % 24;
      if (span < 0.02) span = 0.02;
      items.push({ ev, r, s0, span, ext: Math.max(span, MIN_SPAN + 2 * TRIM), long: span > LONG });
    }
    packLanes(items);
    // underlays first so the short arcs above them win the pointer
    items.sort((a, b) => (b.long - a.long) || (a.s0 - b.s0));
    for (const it of items) {
      const imp = it.ev.importance || 1;
      const r = LANES[it.lane];
      const a0 = it.long ? it.s0 : it.s0 + TRIM;
      const a1 = it.long ? it.s0 + it.span : a0 + Math.max(MIN_SPAN, it.span - 2 * TRIM);
      const d = arcPath(a0, a1, r);
      const vis = svgEl('path', {
        d, fill: 'none', class: 'mk-ev-arc__vis', 'stroke-linecap': 'butt', 'pointer-events': 'none',
        stroke: imp >= 3 ? '#d4a640' : imp === 2 ? '#a08045' : '#7b7262', 'stroke-width': it.long ? 2.5 : imp >= 3 ? 4.5 : 4,
      });
      const hit = svgEl('path', { d, fill: 'none', class: 'mk-ev-arc__hit', stroke: 'transparent', 'stroke-width': it.long ? 5 : 7, 'pointer-events': 'stroke' });
      const g = svgEl('g', {
        class: `mk-ev-arc${it.long ? ' is-long' : ''}`, role: 'button', tabindex: '-1',
        'aria-label': `${it.ev.title?.en || it.ev.id}, about ${clock(it.r.t0)} to ${clock(it.r.t1)}. Enter sets the clock to its start.`,
      });
      g.append(hit, vis);
      it.g = g; it.vis = vis;
      g.addEventListener('pointerdown', (e) => { e.stopPropagation(); lastPointer = e.pointerType || 'mouse'; });
      g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') peek(it, 'hover'); });
      g.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') unpeek('hover'); });
      g.addEventListener('focus', () => { setRoving(it); peek(it, 'focus'); });
      g.addEventListener('blur', () => unpeek('focus'));
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        // touch: the first tap shows what the arc is, the second sets the clock
        if (lastPointer !== 'mouse' && !(peekItem === it && peekSrc === 'tap')) { peek(it, 'tap'); return; }
        jump(it);
      });
      g.addEventListener('keydown', (e) => {
        const i = arcsInTime.indexOf(it);
        let to = null;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); jump(it); return; }
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = arcsInTime[(i + 1) % arcsInTime.length];
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = arcsInTime[(i - 1 + arcsInTime.length) % arcsInTime.length];
        else if (e.key === 'Home') to = arcsInTime[0];
        else if (e.key === 'End') to = arcsInTime[arcsInTime.length - 1];
        if (!to) return;
        e.preventDefault();
        e.stopPropagation();
        to.g.focus();
      });
      gEvents.append(g);
    }
    arcs = items;
    arcsInTime = [...items].sort((a, b) => a.s0 - b.s0);
    if (arcsInTime.length) setRoving(arcsInTime[0]);
    activeKey = null;
    peekItem = null;
    readout.classList.remove('is-peek');
  }
  function setRoving(it) { for (const a of arcs) a.g.setAttribute('tabindex', a === it ? '0' : '-1'); }
  function peek(it, src) {
    if (peekItem && peekItem !== it) peekItem.g.classList.remove('is-peek');
    peekItem = it;
    peekSrc = src;
    it.g.classList.add('is-peek');
    const time = T();
    const si = seasonal(time, it.r.t0);
    setText(peekWhen, `${si.half === 'day' ? 'Day' : 'Night'} · hour ${si.hour}`);
    setText(peekTitle, it.ev.title?.en || it.ev.id);
    setText(peekTime, `≈ ${clock(it.r.t0)}–${clock(it.r.t1)}`);
    setText(peekHint, src === 'tap' ? 'Tap again to set the clock' : src === 'focus' ? 'Enter sets the clock' : 'Click to set the clock');
    readout.classList.add('is-peek');
  }
  function unpeek(src) {
    if (!peekItem || (src && src !== peekSrc)) return;
    peekItem.g.classList.remove('is-peek');
    peekItem = null;
    peekSrc = null;
    readout.classList.remove('is-peek');
  }
  function jump(it) {
    if (peekSrc !== 'focus') unpeek();
    app.jumpToEvent(it.ev);
  }

  function buildZmanim() {
    const z = T().zmanim;
    clear(zmanimEl);
    const items = [
      ['Dawn', 'עלות השחר', z.alot, `Alot hashachar — the sun ${Math.abs(ZMAN_ANGLES.alot)}° below the horizon`],
      ['Sunrise', 'הנץ', z.sunrise, 'Netz hachamah — the day\'s first seasonal hour begins'],
      ['Midday', 'חצות', z.chatzot, 'Chatzot — the end of the sixth hour of the day'],
      ['Sunset', 'שקיעה', z.sunset, 'Shkiah — the night\'s first seasonal hour begins'],
      ['Stars', 'צאת', z.tzeit, `Tzeit hakochavim — three medium stars, the sun ${Math.abs(ZMAN_ANGLES.tzeit)}° below`],
      ['Midnight', 'חצות הלילה', z.midnight, 'Chatzot halailah — the end of the sixth hour of the night'],
    ];
    for (const [en, heText, t, tip] of items) {
      zmanimEl.append(h('button.mk-zman', { type: 'button', title: `${heText} — ${tip}. Set the clock here.`, on: { click: () => setTime(t + 0.01) } },
        h('span', en), h('b', clock(t))));
    }
  }

  function explainText() {
    const time = T();
    const z = time.zmanim;
    const at = (hrs) => clock(time.fromZmani('day', hrs));
    teaser.textContent = `Day and night are each twelve equal hours, so their length follows the season: today a day hour is ${Math.round(z.shaahDay)} minutes and a night hour ${Math.round(z.shaahNight)}.`;
    explainLead.textContent = 'The Mishnah tells time in seasonal hours (sha\'ot zmaniyot): daylight, from sunrise to sunset, is divided into twelve equal hours, and the night, from sunset to sunrise, into twelve more — the reckoning of the Vilna Gaon. Their length follows the season.';
    clear(explainMore).append(
      h('p.mk-p', `On this date a day hour lasts ${Math.round(z.shaahDay)} minutes and a night hour ${Math.round(z.shaahNight)}. The afternoon Tamid was slaughtered at "eight and a half hours" and offered at "nine and a half" (Pesachim 5:1) — today about ${at(8.5)} and ${at(9.5)}.`),
      h('p.mk-p', `Dawn (alot hashachar) is taken when the sun is ${Math.abs(ZMAN_ANGLES.alot)}° below the horizon, and nightfall when three medium stars appear (${Math.abs(ZMAN_ANGLES.tzeit)}°). Sunrise and sunset are the visible ones at sea level. Clock times are Israel Standard Time for Jerusalem, shown with ≈ because the Mishnah counts hours, not minutes.`),
      h('p.mk-p', 'On the dial, day runs across the top from sunrise on the left to sunset on the right, and night across the bottom. The outer arcs are the events of the day, packed into three tracks; the long watches are the faint inner line. Point at an arc (or tap it once) to see what it is; click it (or tap again) to set the clock to its start.'),
    );
  }

  // ---------------- interaction ----------------
  let dragS = null, lastSet = 0, pendingT = null;
  function setTime(t) { T()?.set(t); update(true); }
  function stepHours(n) {
    const time = T();
    if (!time) return;
    const info = seasonal(time, time.t);
    setTime(fromDial(time, Math.floor(info.s + 1e-6) + n + Math.min(info.s % 1, 0.999)));
  }
  function sFromEvent(e) {
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 * VB - VB;
    const y = ((e.clientY - r.top) / r.height) * 2 * VB - VB;
    const a = (Math.atan2(x, -y) * 180) / Math.PI; // 0 = top, clockwise
    return { s: (((a - 270) / 15) % 24 + 24) % 24, r: Math.hypot(x, y) };
  }
  function applyDrag(s, final) {
    const time = T();
    if (!time) return;
    dragS = s;
    const t = fromDial(time, Math.round(s * 60) / 60); // one zmani minute
    pendingT = t;
    const now = performance.now();
    if (final || now - lastSet > 90) { lastSet = now; time.set(t); pendingT = null; }
    update(true);
  }
  svg.addEventListener('pointerdown', (e) => {
    unpeek('tap');
    const { s, r } = sFromEvent(e);
    if (r < R - RW / 2 - 26 || r > LANES[0] - 4) return; // the centre is the readout, the outside the event tracks
    e.preventDefault();
    svg.setPointerCapture?.(e.pointerId);
    ring.focus({ preventScroll: true });
    applyDrag(s, false);
  });
  svg.addEventListener('pointermove', (e) => { if (dragS !== null && svg.hasPointerCapture?.(e.pointerId)) applyDrag(sFromEvent(e).s, false); });
  const endDrag = () => { if (dragS === null) return; if (pendingT !== null) T()?.set(pendingT); pendingT = null; dragS = null; update(true); };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  ring.addEventListener('keydown', (e) => {
    const time = T();
    if (!time) return;
    const info = seasonal(time, time.t);
    let s = null;
    const step = e.shiftKey ? 1 : 1 / 12;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') s = info.s + step;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') s = info.s - step;
    else if (e.key === 'PageUp') s = info.s + 1;
    else if (e.key === 'PageDown') s = info.s - 1;
    else if (e.key === 'Home') s = 0.001;
    else if (e.key === 'End') s = 12.001;
    if (s === null) return;
    e.preventDefault();
    e.stopPropagation();
    setTime(fromDial(time, s));
  });

  // ---------------- lists ----------------
  let rows = [], listKey = '';
  const expanded = new Set(), openGroups = new Set();
  function rebuildLists(force) {
    const t = T().t;
    // the day's events, and each individual's offering in progress grouped under the event of its current stage
    const { stat: active, groups } = data.group(data.active(t));
    const next = data.upcoming(t, 5);
    const key = `${active.map((e) => e.id).join(',')}|${[...groups].map(([p, l]) => `${p}:${l.map((e) => e.id).join('+')}`).join(';')}|${next.map((e) => e.id).join(',')}`;
    if (!force && key === listKey) return false;
    listKey = key;
    const mk = (ev) => eventRow(app, ev, { expanded: expanded.has(ev.id), onToggle: (e, open) => (open ? expanded.add(e.id) : expanded.delete(e.id)) });
    const grp = (pid, list, parent) => dynGroup(app, list, {
      key: pid, open: openGroups.has(pid), onToggle: (on) => (on ? openGroups.add(pid) : openGroups.delete(pid)),
      title: parent ? `Offerings at this stage` : (list[0]?.parentTitle?.en || "Individuals' offerings in progress"), indent: !!parent,
    });
    rows = [];
    clear(nowList);
    clear(nextList);
    if (active.length || groups.size) {
      for (const ev of active) {
        const r = mk(ev); rows.push(r); nowList.append(r.el);
        const g = groups.get(ev.id);
        if (g) { const gr = grp(ev.id, g, ev); rows.push(gr); nowList.append(gr.el); groups.delete(ev.id); }
      }
      for (const [pid, g] of groups) { const gr = grp(pid, g, null); rows.push(gr); nowList.append(gr.el); }
    } else nowList.append(h('div.mk-empty', 'Nothing in the order of the day at this hour. The fires on the altar burn on.'));
    for (const ev of next) { const r = mk(ev); rows.push(r); nextList.append(r.el); }
    if (!next.length) nextList.append(h('div.mk-empty', 'Nothing further scheduled for this date.'));
    sample.hidden = !data.fixtureEvents;
    return true;
  }

  // ---------------- per-tick update ----------------
  let last = { hour: -1, half: '', date: '', speed: NaN, paused: null };
  function update(force = false) {
    const time = T();
    showClock(!!time);
    if (!time) return;
    build();
    const t = pendingT ?? time.t;
    const info = seasonal(time, t);
    const s = dragS ?? info.s;
    const [hx, hy] = pt(s, R);
    handle.setAttribute('transform', `translate(${f2(hx)} ${f2(hy)})`);
    if (info.half !== last.half) {
      handleDisc.setAttribute('fill', info.half === 'day' ? '#ffe08e' : '#e3e9f5');
      handleGlow.setAttribute('fill', info.half === 'day' ? 'rgba(255,214,120,.3)' : 'rgba(200,215,245,.22)');
    }
    if (info.hour !== last.hour || info.half !== last.half) {
      const s0 = (info.half === 'day' ? 0 : 12) + info.hour - 1;
      curHour.setAttribute('d', arcPath(s0 + 0.03, s0 + 0.97, R));
    }
    setText(roHalf, info.half === 'day' ? 'Day' : 'Night');
    setText(roHour, String(info.hour));
    setText(roOf, `${quarters(info.elapsed)} ${info.elapsed < 0.875 ? 'hour' : 'hours'} since ${info.half === 'day' ? 'sunrise' : 'sunset'}`);
    setText(roHe, seasonalLabelHe(info));
    setText(roCivilT, `≈ ${clock(t)}`);
    ring.setAttribute('aria-valuenow', info.s.toFixed(2));
    ring.setAttribute('aria-valuetext', `${ordinal(info.hour)} hour of the ${info.half} (hours of ${Math.round(info.lenMin)} minutes), about ${clock(t)}`);

    if (time.paused !== last.paused) {
      clear(playBtn).append(icon(time.paused ? 'play' : 'pause'));
      playBtn.setAttribute('aria-label', time.paused ? 'Play' : 'Pause');
      playBtn.title = time.paused ? 'Play' : 'Pause';
    }
    if (time.speed !== last.speed) for (const b of speedSeg.children) b.setAttribute('aria-pressed', +b.dataset.speed === time.speed ? 'true' : 'false');
    const evening = t >= time.zmanim.sunset;
    const dateKey = `${time.dateString}|${evening}`;
    if (dateKey !== last.date) {
      const hd = hebrewAt(time, t);
      setText(dateEn, civilShort(time));
      setText(dateHe, (hd?.he || '').split(' ').slice(0, 2).join(' '));
      const full = `${civilDate(time)}${hd?.en ? ` · ${hd.en}` : ''}`;
      dateMain.setAttribute('aria-label', `${full}. Choose another date`);
      dateMain.title = `${full}${hd?.he ? ` · ${hd.he}` : ''} — choose another date`;
      dateInput.value = time.dateString;
      append(clear(dateMeta), [
        h('span.mk-badge.mk-badge--gold', DAY_TYPE_LABEL[time.dayType] || time.dayType),
        h('span.mk-badge', { title: `The Levites' psalm for ${WEEKDAYS[time.weekday]} (Tamid 7:4)` }, `Psalm ${PSALM_OF_DAY[time.weekday]}`),
        evening ? h('span.mk-badge', { title: 'The Hebrew day begins at sunset' }, 'Evening: the Hebrew date has turned') : null,
      ]);
    }
    last = { hour: info.hour, half: info.half, date: dateKey, speed: time.speed, paused: time.paused };

    const active = new Set(data.active(t).map((e) => e.id));
    const aKey = [...active].join('|');
    if (aKey !== activeKey) {
      activeKey = aKey;
      for (const a of arcs) a.vis.setAttribute('stroke-opacity', active.has(a.ev.id) ? '1' : (a.long ? '0.32' : '0.62'));
    }
    rebuildLists(false);
    for (const r of rows) r.update(t);
  }

  ctx.bus.on('time:date', () => { built = ''; listKey = ''; });
  ctx.bus.on('settings:change', (e) => { if (e?.key === 'aggadah') { built = ''; listKey = ''; } });

  return {
    ...panel,
    onOpen(opts = {}) {
      built = '';
      listKey = '';
      update(true);
      if (opts.focusEvent && T()) {
        expanded.add(opts.focusEvent);
        listKey = '';
        rebuildLists(true);
        for (const r of rows) r.update();
        const el = body.querySelector(`[data-ev="${CSS.escape(opts.focusEvent)}"]`);
        if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: app.reducedMotion() ? 'auto' : 'smooth' }));
      }
    },
    update: () => update(false),
    focusTarget: () => (T() ? ring : panel.titleEl),
  };
}

// Event rows (time panel "Happening now / Next", info panel "Here now"): title, place, time, summary,
// Go + speed, jump-to-start; click to expand the full description with sources.
import { h, he, icon, setText } from './dom.js';
import { clock, seasonalShort, wrap } from './format.js';
import { parseSources } from './sources.js';

let rowSeq = 0;

export const SPEEDS = [
  ['instant', 'Instant'], ['slow', 'Slow'], ['walk', 'Walk'], ['fast', 'Fast'], ['run', 'Run'],
];

const CONFIDENCE = {
  explicit: ['Time sourced', 'mk-badge--gold'],
  ordering: ['Order sourced · minutes reconstructed', ''],
  reconstruction: ['Time reconstructed', 'mk-badge--recon'],
};

export function sourcesEl(list) {
  const items = parseSources(list);
  if (!items.length) return null;
  return h('div.mk-srcs', items.map((s) => (s.url
    ? h('a.mk-src', { href: s.url, target: '_blank', rel: 'noopener noreferrer', title: `Open ${s.text} on Sefaria (new tab)` }, s.text, icon('ext'))
    : h('span.mk-src', s.text))));
}

const ROLES = {
  kohen: ['kohen', 'kohanim'], kohen_gadol: ['Kohen Gadol', 'Kohanim Gedolim'], kohen_gadol_white: ['Kohen Gadol (in white)', 'Kohanim Gedolim'],
  segan: ['segan', 'seganim'], levi: ['Levite', 'Levites'], levi_boy: ['Levite boy', 'Levite boys'], guard_levi: ['Levite guard', 'Levite guards'],
  israelite: ['Israelite', 'Israelites'], woman: ['woman', 'women'], elder: ['elder', 'elders'], sanhedrin: ['judge of the Sanhedrin', 'judges of the Sanhedrin'],
  nazir: ['nazir', 'nezirim'], child: ['child', 'children'], officer: ['officer', 'officers'],
};
function participant(p) {
  const [one, many] = ROLES[p.role] || [p.role.replace(/_/g, ' '), `${p.role.replace(/_/g, ' ')}s`];
  const who = p.count ? `${p.count} ${p.count === 1 ? one : many}` : many[0].toUpperCase() + many.slice(1);
  return p.note ? `${who} — ${p.note}` : who;
}

function paragraphs(text) {
  return String(text || '').split(/\n\s*\n/).filter(Boolean).map((p) => h('p.mk-p', p.trim()));
}

function importance(n = 1) {
  return h('span.mk-imp', { title: ['', 'Minor', 'Notable', 'Headline'][n] || '', 'aria-label': `importance ${n} of 3` },
    [1, 2, 3].map((i) => h(`i${i <= n ? '.on' : ''}`)));
}

/**
 * app: { ctx, data, goToEvent(ev, speed), jumpToEvent(ev), settings }
 * opts: { expanded, onToggle(ev, open) }
 * returns { el, update(t) }
 */
export function eventRow(app, ev, opts = {}) {
  const { ctx, data } = app;
  const times = data.times(ev);
  const zoneName = data.zone(ev.zone)?.name?.en || '';
  const conf = CONFIDENCE[ev.timing?.confidence];
  const timeEl = h('span.mk-ev__time');
  const relEl = h('span.mk-muted.num');
  const prog = h('div.mk-ev__prog', { 'aria-hidden': 'true' });
  const moreId = `mk-ev${++rowSeq}-${String(ev.id || '').replace(/[^\w-]/g, '')}-more`;

  const hit = h('button.mk-ev__hit', { type: 'button', 'aria-expanded': opts.expanded ? 'true' : 'false', 'aria-controls': moreId },
    h('span.mk-ev__top', h('span.mk-ev__title', ev.title?.en || ev.id), timeEl),
    ev.title?.he ? he(ev.title.he, 'mk-ev__he') : null,
    h('span.mk-ev__meta', importance(ev.importance), zoneName ? h('span', zoneName) : null, relEl,
      ev.layer === 'aggadah' ? h('span.mk-badge', 'Aggadah') : null),
    ev.summary ? h('span.mk-ev__sum', ev.summary) : null);

  const speedSel = h('select.mk-select', { 'aria-label': 'Travel speed' },
    SPEEDS.map(([v, l]) => h('option', { value: v }, l)));
  speedSel.value = app.settings?.get('travelSpeed') || 'walk';
  speedSel.addEventListener('change', () => app.settings?.set('travelSpeed', speedSel.value));

  const acts = h('div.mk-ev__acts',
    h('button.mk-btn.mk-btn--sm.mk-btn--primary', { type: 'button', on: { click: () => app.goToEvent(ev, speedSel.value) }, title: 'Go and watch from a good spot' }, icon('walk'), 'Go'),
    speedSel,
    times ? h('button.mk-btn.mk-btn--sm', { type: 'button', on: { click: () => app.jumpToEvent(ev) }, title: 'Set the clock to its start' }, icon('clock'), 'Start') : null);

  const parts = (ev.participants || []).filter((p) => p?.role).map(participant);
  const more = h('div.mk-ev__more', { id: moreId },
    paragraphs(ev.description),
    parts.length ? h('div.mk-sec', h('h4.mk-h', 'Who'), h('ul.mk-list', parts.map((p) => h('li', p)))) : null,
    ev.timing?.note || conf ? h('div.mk-sec', h('h4.mk-h', 'Timing'),
      conf ? h('span', { class: `mk-badge ${conf[1]}` }, conf[0]) : null,
      ev.timing?.note ? h('p.mk-p', { style: { marginTop: '8px', fontSize: '15px' } }, ev.timing.note) : null) : null,
    ev.sources?.length ? h('div.mk-sec', h('h4.mk-h', 'Sources'), sourcesEl(ev.sources)) : null);

  const el = h(`article.mk-ev.imp-${ev.importance || 1}`, { 'data-ev': ev.id }, hit, acts, more, prog);
  if (opts.expanded) el.classList.add('is-open');
  hit.addEventListener('click', () => {
    const open = !el.classList.contains('is-open');
    el.classList.toggle('is-open', open);
    hit.setAttribute('aria-expanded', open ? 'true' : 'false');
    opts.onToggle?.(ev, open);
  });

  function update(t = ctx.time?.t) {
    if (!times) { setText(timeEl, ''); return; }
    setText(timeEl, `≈ ${clock(times.t0)}–${clock(times.t1)}`);
    timeEl.title = `seasonal: ${seasonalShort(ctx.time, times.t0)} → ${seasonalShort(ctx.time, times.t1)} hours`;
    const active = data.isActive(ev, t) || (opts.active && !data.times(ev));
    el.classList.toggle('is-active', !!active);
    if (active) {
      const p = data.progress(ev, t);
      prog.style.width = `${(p * 100).toFixed(1)}%`;
      setText(relEl, `now · ${Math.round(wrap(times.t1 - t))} min left`);
    } else {
      prog.style.width = '0';
      const d = wrap(times.t0 - t);
      setText(relEl, d < 60 ? `in ${Math.max(1, Math.round(d))} min` : `in ${Math.floor(d / 60)} h ${String(Math.round(d % 60)).padStart(2, '0')}`);
    }
  }
  update();
  return { el, update, ev };
}

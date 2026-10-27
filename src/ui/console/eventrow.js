// The single event row (console §3.5), used wherever events are listed: importance, title, Hebrew, place, "now · 12 min
// left" or "in 14 min", a progress bar, and exactly two buttons: Go ▸ and Show me ▸ (Show me needs the inspect core).
// A click on the row opens the event card. Individuals' offerings in progress collapse into one group per stage.
import { h, he, setText } from '../dom.js';
import { ico } from './icons.js';
import { clock, wrap } from '../format.js';

/** what a group of individuals' offerings is doing now, by its parent event (the stream's stages in g5/plan.js) */
const STAGES = {
  'private-offerings': (n) => `${n} individual offering${n === 1 ? '' : 's'} at the leaning and the slaughter`,
  'altar-blood': (n) => `${n} individual offering${n === 1 ? '' : 's'} at the blood on the altar`,
  'private-flaying': (n) => `${n} individual offering${n === 1 ? '' : 's'} at the flaying tables`,
  tenufah: (n) => `${n} individual offering${n === 1 ? '' : 's'} at the waving`,
  'altar-limbs': (n) => `${n} individual offering${n === 1 ? '' : 's'} going up the ramp to the altar`,
  'bird-offerings': (n) => `${n} bird offering${n === 1 ? '' : 's'} at the corners of the altar`,
  'meal-offerings': (n) => `${n} meal-offering${n === 1 ? '' : 's'} in progress`,
  'kayitz-hamizbeach': (n) => `${n} kayitz hamizbeach offering${n === 1 ? '' : 's'}`,
  'notar-burning': (n) => `${n} leftover${n === 1 ? '' : 's'} being burned`,
  'kodashim-meal': (n) => `${n} offering${n === 1 ? '' : 's'} eaten by the kohanim`,
  'bikkurim-late': (n) => `${n} bringing${n === 1 ? '' : 's'} of first fruits`,
  nazirites: (n) => (n === 1 ? '1 nazirite’s offerings' : `${n} nazirites’ offerings`),
  metzora: (n) => (n === 1 ? '1 metzora’s offerings' : `${n} metzora’im bringing their offerings`),
  'entry-circuit': (n) => `${n} on the circuit of the Mount`, // not offerings: prostrations at the breaches, a mourner (g4/watch.js)
};
/** "7 individual offerings at the blood on the altar"; an unknown stage by its event's title */
export function stageTitle(pid, parentTitle, n) {
  if (STAGES[pid]) return STAGES[pid](n);
  const what = `${n} individual offering${n === 1 ? '' : 's'}`;
  return parentTitle ? `${what} · ${parentTitle.replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase())}` : `${what} in progress`;
}

export const relTime = (ev, times, t) => {
  if (!times) return '';
  const d = wrap(times.t0 - t);
  return d < 60 ? `in ${Math.max(1, Math.round(d))} min` : `in ${Math.floor(d / 60)} h ${String(Math.round(d % 60)).padStart(2, '0')}`;
};

function importance(n = 1) {
  return h('span.mk-imp', { title: ['', 'Minor', 'Notable', 'Headline'][n] || '', 'aria-label': `importance ${n} of 3` },
    [1, 2, 3].map((i) => h(`i${i <= n ? '.on' : ''}`)));
}

/** the Show me action of an event (from the inspect core's card), or null */
export function showAction(app, ref) {
  const ins = app.ctx.inspect;
  if (!ins?.describe || !ins.seeInAction) return null;
  try {
    const c = ins.describe(ref);
    const acts = (c?.actions || []).filter((a) => a.kind === 'see-in-action');
    return acts.find((a) => a.primary) || acts[0] || null;
  } catch { return null; }
}

/**
 * Show me for a subject: its primary see-in-action. When the inspect core's describer is still loading (its cards are
 * placeholders without actions), wait for it once. fallback(): run when there is nothing to show (e.g. Go and watch).
 */
export async function runShow(app, ref, fallback = null) {
  const ins = app.ctx.inspect;
  let a = showAction(app, ref);
  if (!a && ins?.ready && !ins.describer) {
    try { ins.load?.(); await ins.ready; } catch { /* keep null */ }
    a = showAction(app, ref);
  }
  if (a) return app.travel.runAction(a);
  return fallback?.() ?? null;
}

/** opts: { place = true (show the place name), compact } → { el, update(t), ev } */
export function eventRow(app, ev, opts = {}) {
  const { ctx, data } = app;
  const times = data.times(ev);
  const zoneName = (data.zone(ev.zone)?.name?.en || '').split(' — ')[0];
  const relEl = h('span.mk-row__rel.num');
  const prog = h('i.mk-row__prog', { 'aria-hidden': 'true' });
  const title = ev.dynamic && ev.typeName?.en ? `${ev.typeName.en}${ev.summary ? ` · ${ev.summary}` : ''}` : (ev.title?.en || ev.id);
  const hit = h('button.mk-row__hit', { type: 'button', 'aria-label': `${title}${zoneName ? `, ${zoneName}` : ''}. Open its card`, on: { click: () => app.card(`event:${ev.id}`) } },
    h('span.mk-row__top', importance(ev.importance), h('span.mk-row__title', title)),
    ev.title?.he && !ev.dynamic ? he(ev.title.he, 'mk-row__he') : null,
    h('span.mk-row__meta', opts.place !== false && zoneName ? h('span', zoneName) : null, relEl, ev.layer === 'aggadah' ? h('span.mk-badge', 'Aggadah') : null));
  const go = app.travel.control(() => app.travel.goEvent(ev), { small: true });
  const show = h('button.mk-btn.mk-btn--sm.mk-row__show', {
    type: 'button', 'data-act': 'show', hidden: true,
    on: { click: () => runShow(app, `event:${ev.id}`) },
  }, ico('show'), 'Show me', h('span.mk-kbd.mk-chipcap', { 'data-cap': 'show' }));
  const el = h(`article.mk-row.imp-${ev.importance || 1}`, { 'data-ev': ev.id }, hit, h('div.mk-row__acts', go, show), prog);
  let lastShow = null;
  function update(t = ctx.time?.t) {
    const canShow = !!ctx.inspect?.seeInAction;
    if (canShow !== lastShow) { lastShow = canShow; show.hidden = !canShow; }
    const r = data.times(ev);
    if (!r) { setText(relEl, ''); return; }
    const active = data.isActive(ev, t);
    el.classList.toggle('is-active', active);
    if (active) {
      prog.style.transform = `scaleX(${data.progress(ev, t).toFixed(3)})`;
      setText(relEl, `now · ${Math.max(1, Math.round(wrap(r.t1 - t)))} min left`);
    } else {
      prog.style.transform = 'scaleX(0)';
      setText(relEl, `${relTime(ev, r, t)} · ≈ ${clock(r.t0)}`);
    }
  }
  const cap = (k) => { const v = app.input.cap(k.dataset.cap); setText(k, v || ''); k.hidden = !v; };
  for (const k of el.querySelectorAll('.mk-row__show [data-cap]')) cap(k);
  update();
  return { el, update, ev };
}

/**
 * A stage's individual offerings as one row: "7 individual offerings at the rings · Show me one ▸", expanding to a row
 * per offering. opts: { key, title, open, onToggle(open), parentTitle } → { el, update(t) }
 */
export function dynGroup(app, items, opts = {}) {
  const { ctx } = app;
  const count = h('span.mk-badge.mk-badge--gold');
  const moreId = `mk-dyn-${String(opts.key || 'g').replace(/[^\w-]/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
  const titleEl = h('span.mk-row__title');
  const hit = h('button.mk-row__hit.mk-dyn__hit', { type: 'button', 'aria-expanded': opts.open ? 'true' : 'false', 'aria-controls': moreId },
    h('span.mk-row__top', h('span.mk-dyn__chev', ico('next')), titleEl, count));
  const first = () => items.find((e) => app.data.isActive(e, ctx.time?.t)) || items[0];
  const showOne = h('button.mk-btn.mk-btn--sm.mk-row__show', {
    type: 'button', 'data-act': 'show',
    on: { click: () => { const ev = first(); if (ev) runShow(app, `event:${ev.id}`, () => app.travel.goEvent(ev)); } },
  }, ico('show'), ctx.inspect?.seeInAction ? 'Show me one' : 'Watch one');
  const list = h('div.mk-dyn__list', { id: moreId });
  const el = h('article.mk-row.mk-dyn', { 'data-dyn': opts.key || '' }, hit, h('div.mk-row__acts', showOne), list);
  el.classList.toggle('is-open', !!opts.open);
  const rows = items.map((ev) => eventRow(app, ev, { place: false }));
  for (const r of rows) list.append(r.el);
  hit.addEventListener('click', () => {
    const on = !el.classList.contains('is-open');
    el.classList.toggle('is-open', on);
    hit.setAttribute('aria-expanded', on ? 'true' : 'false');
    opts.onToggle?.(on);
  });
  function update(t = ctx.time?.t) {
    setText(titleEl, opts.title || stageTitle(opts.key, opts.parentTitle, items.length));
    setText(count, `${items.length} now`);
    if (el.classList.contains('is-open')) for (const r of rows) r.update(t);
  }
  update();
  return { el, update, ev: null };
}

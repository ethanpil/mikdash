// The Show-me bar (console §3.3.7, §4.1): what the inspect core's director is doing — "Skipping ahead 14 min",
// "Rewinding to ≈07:43", "Tomorrow, ≈07:40" — with progress (sim time in a warp; indeterminate in a jump), Skip and
// Cancel. After arrival a chip "Showing: X · ↶ Back to 08:39 at Ezrat Nashim" for 30 s; then the Back chip lives in the
// header's clock block and the beacon's wake row until the next trip or show, or for 10 min.
import { h, setText } from '../dom.js';
import { ico } from './icons.js';
import { clock, wrap } from '../format.js';

const CHIP_MS = 30000;
const BACK_MS = 600000;

/** a Show me on another day: 'Tomorrow' / 'Yesterday' for one day either way; otherwise the weekday and date
 * ("Wednesday 4 Nov") */
export function dayText(fromDate, toDate) {
  const d0 = Date.parse(`${fromDate}T12:00:00Z`), d1 = Date.parse(`${toDate}T12:00:00Z`);
  if (!Number.isFinite(d0) || !Number.isFinite(d1)) return 'Another day';
  const n = Math.round((d1 - d0) / 864e5);
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return new Date(d1).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function createShowBar(app) {
  const { ctx } = app;
  const title = h('span.mk-show__title');
  const mode = h('span.mk-show__mode');
  const fill = h('i.mk-show__fill');
  const track = h('span.mk-show__track', fill);
  const skip = h('button.mk-hbtn', { type: 'button', on: { click: () => ctx.inspect?.show?.skip?.() } }, ico('skip'), h('span', 'Skip'));
  const cancel = h('button.mk-hbtn', { type: 'button', on: { click: () => ctx.inspect?.show?.cancel?.() } }, ico('close'), h('span', 'Cancel'));
  const bar = h('div.mk-showbar.mk-glass.mk-live', { hidden: true, role: 'group', 'aria-label': 'Show me' },
    h('div.mk-show__line', ico('show'), title), h('div.mk-show__ctl', mode, track, skip, cancel));
  const chipTxt = h('span');
  const chipBack = h('span.mk-showchip__back', 'Back');
  const chip = h('div.mk-showchip.mk-glass.mk-live', { hidden: true },
    chipTxt, h('button.mk-hbtn', { type: 'button', on: { click: () => ctx.inspect?.back?.() } }, ico('back'), chipBack));
  const veilTxt = h('div.mk-veiltxt', { 'aria-hidden': 'true' }, h('span.mk-veiltxt__glyph', { html: '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="15" fill="none" stroke="#d4a640" stroke-width="1.5"/><path d="M20 20L20 8" stroke="#f2d38a" stroke-width="2" stroke-linecap="round"/><path d="M5 20h30" stroke="rgba(212,166,64,.4)"/></svg>' }), h('span.mk-veiltxt__t'));
  const live = h('div.sr-only', { 'aria-live': 'polite' });

  let phase = null, backUntil = 0, chipTimer = 0, lastLabel = '';
  const active = () => phase && !['done', 'cancelled', 'failed', 'showing'].includes(phase);

  function modeText(s) {
    if (!s) return '';
    const from = s.from || {}, to = s.target || {};
    if (to.date && from.date && to.date !== from.date) return `${dayText(from.date, to.date)}, ≈ ${clock(to.t)}`;
    if (s.mode === 'warp') return `Skipping ahead ${Math.max(1, Math.round(wrap((to.t ?? 0) - (from.t ?? 0))))} min`;
    if (s.mode === 'jump') return wrap((to.t ?? 0) - (from.t ?? 0)) > 720 ? `Rewinding to ≈ ${clock(to.t)}` : `Skipping to ≈ ${clock(to.t)}`;
    if (s.mode === 'now') return 'Watching now';
    return '';
  }

  ctx.bus.on('inspect:show', (e) => {
    const s = ctx.inspect?.show;
    const prev = phase;
    phase = e?.phase || s?.phase || null;
    const label = e?.label?.en || s?.label?.en || '';
    if (label) lastLabel = label;
    if (phase === 'showing') {
      bar.hidden = true;
      backUntil = performance.now() + BACK_MS;
      // "Showing: X · ↶ Back to 08:39 at Ezrat Nashim" (§4.1): the Back button carries the place and hour it returns to
      setText(chipTxt, `Showing: ${lastLabel}`);
      setText(chipBack, ctx.inspect?.backLabel?.en || 'Back');
      chip.hidden = !ctx.inspect?.canBack;
      clearTimeout(chipTimer);
      chipTimer = setTimeout(() => { chip.hidden = true; }, CHIP_MS);
      say(`Showing ${lastLabel}`);
    } else if (phase === 'done' || phase === 'cancelled' || phase === 'failed') {
      bar.hidden = true;
      if (phase !== 'done') { chip.hidden = true; }
      if (phase === 'failed') app.toast('That moment could not be shown');
    } else if (phase) {
      bar.hidden = false;
      chip.hidden = true;
      setText(title, label ? `Showing ${label.replace(/^([A-Z])(?=[a-z])/, (c) => c.toLowerCase())}` : 'Show me');
      setText(mode, modeText(s) || (e?.mode === 'warp' ? 'Skipping ahead' : ''));
      skip.hidden = !(s?.mode === 'warp' && typeof s.skip === 'function');
      if (prev !== phase && phase === 'warping') say(`${modeText(s)}: ${label}`);
      if (prev !== phase && phase === 'jumping') say(`Clock set to about ${clock(s?.target?.t)}, showing ${label}`);
    }
    app.root.classList.toggle('mk-showing', !!active());
    veil(phase === 'jumping' || phase === 'placing', s);
    paintProgress(e?.progress ?? s?.progress);
  });
  function paintProgress(p) {
    const ind = !Number.isFinite(p);
    track.classList.toggle('is-ind', ind);
    if (!ind) fill.style.transform = `scaleX(${Math.max(0, Math.min(1, p)).toFixed(3)})`;
  }
  function veil(on, s) {
    veilTxt.classList.toggle('on', on);
    if (on) {
      const newDay = s?.target?.date && s?.from?.date && s.target.date !== s.from.date;
      veilTxt.querySelector('.mk-veiltxt__t').textContent = newDay ? 'Preparing that day\'s service…' : (lastLabel || '');
    }
  }
  const say = (t) => { setText(live, ''); requestAnimationFrame(() => setText(live, t)); };
  // a new trip ends the Back chip's life
  ctx.bus.on('travel:start', () => { backUntil = 0; chip.hidden = true; });

  let acc = 0;
  return {
    bar, chip, veilTxt, live,
    get active() { return !!active(); },
    get phase() { return phase; },
    /** is the Back chip offered (header clock block, wake row)? */
    showBack: () => !!ctx.inspect?.canBack && performance.now() < backUntil && !app.travel?.trip,
    noteTrip() { backUntil = 0; chip.hidden = true; },
    tick(dt) {
      if (!active()) return;
      acc += dt;
      if (acc < 0.25) return;
      acc = 0;
      const s = ctx.inspect?.show;
      if (s) { paintProgress(s.progress); const m = modeText(s); if (m && mode.textContent !== m) setText(mode, m); }
    },
  };
}

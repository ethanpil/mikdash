// Captions (console §3.7, §4.2): the lane at the bottom centre of the free area (max 2, English and Hebrew), shown when
// Subtitles is on; every caption also goes to the Listen log (the last 50, with ≈ time and source), Subtitles or not.
// During a Show-me warp incoming captions are held (the last one is kept and shown when the warp ends).
import { h, he } from '../dom.js';
import { clock } from '../format.js';

export function createCaptions(app) {
  const { ctx } = app;
  const lane = h('div.mk-captions', { 'aria-live': 'polite' });
  const log = [];
  const subs = new Set();
  let held = null;

  function norm(e) {
    const t = e?.text;
    const en = typeof t === 'string' ? t : t?.en;
    const heText = typeof t === 'object' ? t?.he : null;
    return en || heText ? { en: en || '', he: heText || '', duration: e.duration, source: e.source || (e.id ? 'audio' : 'sim'), id: e.id || null } : null;
  }
  function show(c) {
    if (ctx.settings?.get('captions') === false) return;
    const el = h(`div.mk-cap${c.source === 'narration' ? '.mk-cap--narration' : ''}`, c.en ? h('span.mk-cap__en', c.en) : null, c.he ? he(c.he, 'mk-cap__he') : null);
    lane.append(el);
    while (lane.children.length > 2) lane.firstChild.remove();
    requestAnimationFrame(() => el.classList.add('in'));
    const ms = Math.max(2500, (c.duration || 4) * 1000);
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 400); }, ms);
  }
  ctx.bus.on('caption', (e) => {
    const c = norm(e);
    if (!c) return;
    const entry = { ...c, t: ctx.time?.t ?? null, at: Date.now() };
    log.unshift(entry);
    if (log.length > 50) log.length = 50;
    for (const f of subs) { try { f(entry); } catch { /* ignore */ } }
    if (app.showbar?.phase === 'warping') { held = c; return; }
    show(c);
  });

  return {
    el: lane,
    get log() { return log; },
    onLog(fn) { subs.add(fn); return () => subs.delete(fn); },
    /** show a logged caption again (Listen → Recent captions) */
    replay(entry) { show({ ...entry, duration: Math.max(4, entry.duration || 4) }); },
    timeOf: (entry) => (Number.isFinite(entry.t) ? `≈ ${clock(entry.t)}` : ''),
    tick() {
      if (held && app.showbar?.phase !== 'warping') { const c = held; held = null; show(c); }
    },
  };
}

// Reload the page where the visitor is: same place, look, sim time and date. Used when a build-time setting changes
// (quality, amah: ui/settingspanel.js) and when the graphics context is lost (main.js). After such a reload the UI goes
// straight to the view, without its intro (sessionStorage RESUME_KEY, read by ui/app.js).
import { w2m } from './units.js';

export const RESUME_KEY = 'mikdash.resume';

const pad2 = (n) => String(n).padStart(2, '0');
/** sim minutes → "HH:MM" (the ?t= clock form, core/params.js) */
function clock(t) {
  const m = Math.round(((t % 1440) + 1440) % 1440) % 1440;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/**
 * This page's URL with the visitor's eye position (pos, in place of pos / at), look, time and date in place of those it
 * was opened with. What is not known yet (a reload during the boot) keeps the URL's own value.
 */
export function resumeURL(ctx, href = globalThis.location.href) {
  const u = new URL(href);
  const q = u.searchParams;
  const eye = ctx?.player?.eye;
  if (eye) {
    const s = w2m(eye);
    q.delete('at');
    q.set('pos', [s.X, s.Y, s.Z].map((n) => n.toFixed(2)).join(','));
  }
  if (Number.isFinite(ctx?.player?.heading)) q.set('look', `${ctx.player.heading.toFixed(1)},${(ctx.player.pitch || 0).toFixed(1)}`);
  if (Number.isFinite(ctx?.time?.t)) q.set('t', clock(ctx.time.t));
  if (ctx?.time?.dateString) q.set('date', ctx.time.dateString);
  return u;
}

/**
 * Reload at resumeURL after `delay` ms; `edit(searchParams)` may change the URL first. `resume` (default: the visitor
 * is past the intro) lets the UI skip its intro after the reload.
 */
export function reloadHere(ctx, { edit = null, delay = 0, resume = null } = {}) {
  const u = resumeURL(ctx);
  edit?.(u.searchParams);
  const skipIntro = resume ?? (!!document.body?.classList.contains('booted') && !document.querySelector('.mk-intro-open'));
  try {
    if (skipIntro) sessionStorage.setItem(RESUME_KEY, '1');
  } catch { /* storage blocked: the intro shows again */ }
  setTimeout(() => globalThis.location.replace(u.toString()), delay);
  return u;
}

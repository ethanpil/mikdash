// Panel shell: a glass dialog with a title, a close button and a scrolling body.
// side: 'right' | 'left' | 'card' | 'modal' (desktop placement; phones turn every panel into a bottom sheet).
import { h, he, icon } from './dom.js';

let seq = 0;
const isSheet = () => { try { return matchMedia('(max-width: 640px)').matches; } catch { return false; } };

export function createPanel(app, { name, title, heTitle, side = 'right', modal = false }) {
  const id = `mk-panel-${name}-${++seq}`;
  const titleEl = h('h2.mk-panel__title', { id: `${id}-t`, tabindex: '-1' }, title, heTitle ? he(heTitle) : null);
  const closeBtn = h('button.mk-close', { type: 'button', 'aria-label': `Close ${title}`, title: 'Close (Esc)', on: { click: () => app.close() } }, icon('close'));
  const body = h('div.mk-panel__body');
  const grab = h('div.mk-panel__grab', { 'aria-hidden': 'true' });
  const head = h('div.mk-panel__head', titleEl, closeBtn);
  const el = h(`section.mk-panel.mk-glass.mk-live.mk-panel--${side}`, {
    role: 'dialog', 'aria-modal': modal ? 'true' : 'false', 'aria-labelledby': `${id}-t`, 'data-panel': name,
  }, grab, head, body);
  sheetDrag(app, el, [grab, head]);
  return { name, el, body, titleEl, modal, side };
}

/**
 * Phones: drag the sheet down by its grabber or header to dismiss it (past a quarter of its height), else it
 * springs back. Buttons and selects in the header keep their own taps.
 */
function sheetDrag(app, el, handles) {
  let y0 = null, dy = 0, pid = null;
  const set = (v) => (v === null ? el.style.removeProperty('transform') : el.style.setProperty('transform', `translateY(${v}px)`, 'important'));
  const down = (e) => {
    if (!isSheet() || e.button > 0 || e.target.closest('button, select, input, a')) return;
    y0 = e.clientY; dy = 0; pid = e.pointerId;
    e.currentTarget.setPointerCapture?.(pid);
    el.style.transition = 'none';
  };
  const move = (e) => {
    if (y0 === null || e.pointerId !== pid) return;
    dy = Math.max(0, e.clientY - y0);
    set(dy);
  };
  const up = (e) => {
    if (y0 === null || e.pointerId !== pid) return;
    y0 = null;
    el.style.transition = '';
    if (dy > el.offsetHeight * 0.25) {
      app.close(); // fades out where it is, then the transform is released
      setTimeout(() => set(null), 300);
    } else set(null);
  };
  for (const hd of handles) {
    hd.addEventListener('pointerdown', down);
    hd.addEventListener('pointermove', move);
    hd.addEventListener('pointerup', up);
    hd.addEventListener('pointercancel', up);
  }
}

/** a labelled section inside a panel body */
export function section(title, ...children) {
  return h('section.mk-sec', title ? h('h3.mk-h', title) : null, ...children);
}

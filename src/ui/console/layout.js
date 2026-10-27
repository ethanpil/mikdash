// Layout (console §3.2): breakpoints, the free area (the viewport minus the Menu) as CSS variables --mk-free-l/r/t/b
// and ctx.inspect.setViewInset, and the phone sheet's detents and drag.
//   dock             width ≥ 960 and height ≥ 560: the Menu docks on the right
//   sheet-portrait   otherwise, taller than wide: a bottom sheet (detents mini | peek | full)
//   sheet-landscape  otherwise: a right sheet

export const DOCK_MIN_W = 960;
export const DOCK_MIN_H = 560;

export function layoutFor(w, h) {
  if (w >= DOCK_MIN_W && h >= DOCK_MIN_H) return 'dock';
  return h > w ? 'sheet-portrait' : 'sheet-landscape';
}

export function createLayout(app, { onChange }) {
  const { root, ctx } = app;
  let mode = layoutFor(innerWidth, innerHeight);
  root.dataset.layout = mode;
  let free = { l: 0, r: 0, t: 0, b: 0 };
  let raf = 0, lastW = innerWidth, keptH = innerHeight;
  // a soft keyboard that resizes the layout viewport (Firefox Android, WebViews) only shortens it while a text field has
  // focus: the layout keeps its mode until the field lets go, so the Menu does not jump sides on every keyboard
  const typing = () => !!document.activeElement?.closest?.('#ui-root input:not([type=range]):not([type=button]), #ui-root textarea');
  function relayout() {
    const w = innerWidth, hgt = innerHeight;
    const keyboard = typing() && w === lastW && hgt < keptH;
    if (!keyboard) keptH = hgt;
    lastW = w;
    const m = keyboard ? mode : layoutFor(w, hgt);
    const changed = m !== mode;
    mode = m;
    root.dataset.layout = m;
    onChange?.(changed);
  }
  addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(relayout);
  });
  // the field let go with the keyboard still shrinking the view: now the layout may follow it
  root.addEventListener('focusout', () => { requestAnimationFrame(() => { if (!typing() && innerHeight !== keptH) relayout(); }); });
  return {
    get mode() { return mode; },
    get isSheet() { return mode !== 'dock'; },
    get free() { return free; },
    /** the free area's insets in px (from each viewport edge) */
    setFree(f) {
      const n = { l: Math.round(f.l || 0), r: Math.round(f.r || 0), t: Math.round(f.t || 0), b: Math.round(f.b || 0) };
      if (n.l === free.l && n.r === free.r && n.t === free.t && n.b === free.b) return;
      free = n;
      for (const k of ['l', 'r', 't', 'b']) root.style.setProperty(`--mk-free-${k}`, `${n[k]}px`);
      try { ctx.inspect?.setViewInset?.({ left: n.l, right: n.r, top: n.t, bottom: n.b }); } catch (e) { console.error('[ui] setViewInset', e); }
    },
    /** the centre of the free area (client px) */
    freeCenter() { return { x: (free.l + innerWidth - free.r) / 2, y: (free.t + innerHeight - free.b) / 2 }; },
  };
}

/**
 * Drag a sheet by its handles: follows the finger (translate only), then settles on the nearest detent or closes.
 * opts: { axis: 'y' | 'x', detents() -> [{ id, offset }] (px the sheet is moved out from fully open), current() -> id,
 *         set(id), close(), enabled() }
 */
export function sheetDrag(el, handles, opts) {
  let s = null;
  const pos = (e) => (opts.axis === 'x' ? e.clientX : e.clientY);
  const down = (e) => {
    if (!opts.enabled() || e.button > 0 || e.target.closest('button, select, input, a, [role=tab], [role=slider]')) return;
    const det = opts.detents();
    const cur = det.find((d) => d.id === opts.current()) || det[0];
    s = { id: e.pointerId, p0: pos(e), base: cur.offset, d: 0, moved: false, det };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!s || e.pointerId !== s.id) return;
    s.d = pos(e) - s.p0;
    if (!s.moved && Math.abs(s.d) < 6) return;
    if (!s.moved) { s.moved = true; el.classList.add('is-dragging'); }
    const off = Math.max(0, s.base + s.d);
    el.style.transform = opts.axis === 'x' ? `translateX(${off}px)` : `translateY(${off}px)`;
  };
  const up = (e) => {
    if (!s || e.pointerId !== s.id) return;
    const st = s;
    s = null;
    el.classList.remove('is-dragging');
    el.style.transform = '';
    if (!st.moved) return;
    const off = Math.max(0, st.base + st.d);
    const size = opts.axis === 'x' ? el.offsetWidth : el.offsetHeight;
    // past the last detent by a quarter of the sheet, or a fling down: close
    const last = st.det[st.det.length - 1];
    if (off > last.offset + size * 0.18 || (st.d > 0 && off > size * 0.7)) { opts.close(); return; }
    let best = st.det[0], bd = Infinity;
    for (const d of st.det) { const dd = Math.abs(d.offset - off); if (dd < bd) { bd = dd; best = d; } }
    opts.set(best.id);
  };
  for (const hd of handles) {
    hd.addEventListener('pointerdown', down);
    hd.addEventListener('pointermove', move);
    hd.addEventListener('pointerup', up);
    hd.addEventListener('pointercancel', up);
  }
}

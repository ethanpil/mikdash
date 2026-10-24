// Map view: centre (site amot) + scale k (css px per amah), north up. Continuous zoom about the pointer (wheel,
// trackpad pinch, touch pinch), drag to pan with a light fling, animated fits; taps and double taps are reported
// to the caller. Respects reduced motion (no easing, no fling).

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => 1 - (1 - u) ** 3;

/**
 * opts: { el, root (el's container with the overlays: claims late second taps), size() -> {W, H},
 *         insets() -> {l, t, r, b} (px covered by overlays), extent [[x0,y0],[x1,y1]],
 *         kMax, reduced() -> bool, onChange(), onTap(px, py, e), onDoubleTap(px, py, e), onHover(px, py, e), onLeave() }
 */
export function createView(opts) {
  const { el } = opts;
  const v = { cx: 250, cy: 250, k: 1 };
  let anim = null, fling = null;
  const kMax = opts.kMax || 36;

  function kMin() {
    const { W, H } = opts.size();
    const [[x0, y0], [x1, y1]] = opts.extent;
    return Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.92 || 0.05;
  }
  function clampView(s) {
    const [[x0, y0], [x1, y1]] = opts.extent;
    s.k = clamp(s.k, kMin(), kMax);
    s.cx = clamp(s.cx, x0, x1);
    s.cy = clamp(s.cy, y0, y1);
    return s;
  }
  function tf(s = v) {
    const { W, H } = opts.size();
    const { k, cx, cy } = s;
    return {
      k, W, H,
      x: (X) => (X - cx) * k + W / 2,
      y: (Y) => H / 2 - (Y - cy) * k,
      X: (px) => (px - W / 2) / k + cx,
      Y: (py) => cy - (py - H / 2) / k,
    };
  }
  /** the part of the canvas not covered by overlays (card, list, controls) */
  function visible() {
    const { W, H } = opts.size();
    const i = opts.insets?.() || { l: 0, t: 0, r: 0, b: 0 };
    return { l: i.l, t: i.t, r: W - i.r, b: H - i.b, cx: (i.l + W - i.r) / 2, cy: (i.t + H - i.b) / 2 };
  }

  function changed() { opts.onChange?.(); }
  function set(s, { animate = false, dur = 420 } = {}) {
    const to = clampView({ cx: s.cx ?? v.cx, cy: s.cy ?? v.cy, k: s.k ?? v.k });
    fling = null;
    if (!animate || opts.reduced()) { anim = null; Object.assign(v, to); changed(); return; }
    anim = { from: { ...v }, to, t: 0, dur };
    changed();
  }
  /** zoom by factor keeping the site point under (px, py) fixed */
  function zoomAt(px, py, factor, animate = false) {
    const base = anim ? anim.to : v;
    const k = clamp(base.k * factor, kMin(), kMax);
    const t = tf(base);
    const X = t.X(px), Y = t.Y(py);
    const { W, H } = opts.size();
    set({ k, cx: X - (px - W / 2) / k, cy: Y + (py - H / 2) / k }, { animate, dur: 160 });
  }
  function panBy(dx, dy) {
    anim = null;
    v.cx -= dx / v.k; v.cy += dy / v.k;
    clampView(v);
    changed();
  }
  /** centre a site point in the visible part of the canvas (optionally at scale k) */
  function centerOn(X, Y, k = v.k, animate = true) {
    const { W, H } = opts.size();
    const vis = visible();
    const kk = clamp(k, kMin(), kMax);
    set({ k: kk, cx: X - (vis.cx - W / 2) / kk, cy: Y + (vis.cy - H / 2) / kk }, { animate, dur: 480 });
  }
  /** fit a site rectangle into the visible part (pad: css px), clamped to [kLo, kHi] */
  function fit(rect, { pad = 24, kLo = 0, kHi = kMax, animate = true } = {}) {
    const vis = visible();
    const [[x0, y0], [x1, y1]] = rect;
    const k = clamp(Math.min((vis.r - vis.l - 2 * pad) / Math.max(1, x1 - x0), (vis.b - vis.t - 2 * pad) / Math.max(1, y1 - y0)), kLo, kHi);
    centerOn((x0 + x1) / 2, (y0 + y1) / 2, k, animate);
  }
  /** pan the least needed so a site point lies in the visible part (with a margin) */
  function ensureVisible(X, Y, margin = 48) {
    const t = tf(anim ? anim.to : v);
    const vis = visible();
    const px = t.x(X), py = t.y(Y);
    let dx = 0, dy = 0;
    if (px < vis.l + margin) dx = vis.l + margin - px; else if (px > vis.r - margin) dx = vis.r - margin - px;
    if (py < vis.t + margin) dy = vis.t + margin - py; else if (py > vis.b - margin) dy = vis.b - margin - py;
    if (!dx && !dy) return;
    const base = anim ? anim.to : v;
    set({ k: base.k, cx: base.cx - dx / base.k, cy: base.cy + dy / base.k }, { animate: true, dur: 360 });
  }

  /** advance animations; returns true while the view is moving */
  function step(dt) {
    if (anim) {
      anim.t += dt * 1000;
      const u = ease(Math.min(1, anim.t / anim.dur));
      const a = anim.from, b = anim.to;
      v.k = Math.exp(Math.log(a.k) + (Math.log(b.k) - Math.log(a.k)) * u);
      v.cx = a.cx + (b.cx - a.cx) * u;
      v.cy = a.cy + (b.cy - a.cy) * u;
      if (u >= 1) anim = null;
      return true;
    }
    if (fling) {
      const d = Math.exp(-dt / 0.28);
      fling.vx *= d; fling.vy *= d;
      v.cx -= (fling.vx * dt) / v.k; v.cy += (fling.vy * dt) / v.k;
      clampView(v);
      if (Math.hypot(fling.vx, fling.vy) < 12) fling = null;
      return true;
    }
    return false;
  }

  // ---------------- gestures ----------------
  const ptrs = new Map(); // pointerId -> { x, y, x0, y0, t0, type }
  let drag = null, pinch = null, lastTap = null, samples = [];
  const local = (e) => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  // when the input happened, not when it was handled: the first tap's work (opening the card) must not delay the
  // second past the double-tap window on a slow device
  const stamp = (e) => (e.timeStamp > 0 ? e.timeStamp : performance.now());
  const slop = (type) => (type === 'mouse' ? 5 : 10);

  /** a tap may pair with the last one into a double tap: by the events' own times, the first's up to this one's down */
  const pairs = (p, t) => !!lastTap && t - lastTap.t < 340 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 26;

  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    if (e.target.closest('button, input, select, a, [data-nodrag]')) return;
    down(e);
  });
  // The second tap of a double tap belongs to the map even if what the first tap opened (the card, a control sliding
  // aside) is under it by the time the event is handled: mappanel's tap guard lasts 380 ms from the first tap's handling,
  // and an event delivered late by a busy page or machine is hit-tested after that. Decided by the event's own time.
  opts.root?.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || ptrs.size || el.contains(e.target) || !pairs(local(e), stamp(e))) return;
    e.preventDefault();
    e.stopPropagation();
    down(e);
    // the click that follows still targets what was under the finger (a speed button, Go): it is not one
    const swallow = (c) => { c.preventDefault(); c.stopPropagation(); };
    opts.root.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => opts.root.removeEventListener('click', swallow, true), 700);
  }, true);
  function down(e) {
    const p = local(e);
    ptrs.set(e.pointerId, { ...p, x0: p.x, y0: p.y, t0: stamp(e), type: e.pointerType });
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    anim = null; fling = null;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const t = tf();
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: v.k, X: t.X(m.x), Y: t.Y(m.y) };
      drag = null;
    } else if (ptrs.size === 1) {
      drag = { moved: false, x: p.x, y: p.y };
      samples = [{ x: p.x, y: p.y, t: performance.now() }];
    }
  }
  el.addEventListener('pointermove', (e) => {
    const p = local(e);
    const q = ptrs.get(e.pointerId);
    if (!q) { if (e.pointerType === 'mouse') opts.onHover?.(p.x, p.y, e); return; }
    q.x = p.x; q.y = p.y;
    if (pinch && ptrs.size >= 2) {
      const [a, b] = [...ptrs.values()];
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const k = clamp(pinch.k0 * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d0, kMin(), kMax);
      const { W, H } = opts.size();
      v.k = k; v.cx = pinch.X - (m.x - W / 2) / k; v.cy = pinch.Y + (m.y - H / 2) / k;
      clampView(v);
      changed();
      return;
    }
    if (!drag) return;
    if (!drag.moved && Math.hypot(p.x - q.x0, p.y - q.y0) < slop(q.type)) return;
    if (!drag.moved) { drag.moved = true; el.classList.add('is-dragging'); }
    panBy(p.x - drag.x, p.y - drag.y);
    drag.x = p.x; drag.y = p.y;
    const now = performance.now();
    samples.push({ x: p.x, y: p.y, t: now });
    while (samples.length > 2 && now - samples[0].t > 90) samples.shift();
  });
  const end = (e) => {
    const q = ptrs.get(e.pointerId);
    if (!q) return;
    ptrs.delete(e.pointerId);
    try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    el.classList.remove('is-dragging');
    if (pinch) {
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 1) { const r = [...ptrs.values()][0]; drag = { moved: true, x: r.x, y: r.y }; samples = []; } else drag = null;
      return;
    }
    const d = drag;
    drag = null;
    if (e.type === 'pointercancel' || !d) return;
    if (d.moved) {
      const s0 = samples[0], s1 = samples[samples.length - 1];
      const dt = s1 && s0 ? (s1.t - s0.t) / 1000 : 0;
      if (dt > 0.01 && performance.now() - s1.t < 60 && !opts.reduced()) {
        const vx = (s1.x - s0.x) / dt, vy = (s1.y - s0.y) / dt;
        if (Math.hypot(vx, vy) > 280) fling = { vx: clamp(vx, -3000, 3000), vy: clamp(vy, -3000, 3000) };
      }
      return;
    }
    // a tap: a second one close in time and place is a double tap (timed from the first's up to its down, as the
    // platforms do, so a second touch held a little longer still counts)
    const p = local(e), now = stamp(e);
    if (now - q.t0 > 650) return;
    if (pairs(p, q.t0)) {
      // at the place the first tap named: the map may have begun to pan since (the card's reveal)
      const { X, Y } = lastTap, t = tf();
      lastTap = null;
      opts.onDoubleTap?.(t.x(X), t.y(Y), e);
      return;
    }
    const t = tf();
    lastTap = { x: p.x, y: p.y, t: now, X: t.X(p.x), Y: t.Y(p.y) };
    opts.onTap?.(p.x, p.y, e);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !ptrs.size) opts.onLeave?.(); });
  el.addEventListener('wheel', (e) => {
    if (e.target.closest('[data-scroll]')) return; // scrolling lists/cards over the map keep their own wheel
    e.preventDefault();
    const p = local(e);
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= opts.size().H;
    if (e.ctrlKey) { zoomAt(p.x, p.y, Math.exp(-dy * 0.012)); return; } // trackpad pinch
    const notch = e.deltaMode !== 0 || Math.abs(dy) >= 50;
    if (!notch && Math.abs(e.deltaX) > Math.abs(dy) * 0.6) { panBy(-e.deltaX, 0); return; } // two-finger sideways swipe
    zoomAt(p.x, p.y, Math.exp(-dy * 0.0016), notch);
  }, { passive: false });

  return {
    get state() { return { ...v }; },
    get target() { return { ...(anim ? anim.to : v) }; },
    get moving() { return !!anim || !!fling || ptrs.size > 0; },
    get kMin() { return kMin(); },
    kMax,
    tf, visible, set, zoomAt, panBy, centerOn, fit, ensureVisible, step,
    clamp() { clampView(v); },
    setExtent(ext) { opts.extent = ext; },
  };
}

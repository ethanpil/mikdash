// Activity markers (console §3.6), replacing the floating tags: at most 3, for active events whose place is within
// 80 m and in line of sight (one physics raycast per candidate at 2 Hz). Beyond 25 m a marker is a 10 px gold diamond;
// its label shows within 25 m, on hover, on keyboard focus or under the reticle — and never more than one label in the
// centre 40 % of the screen. A click or tap opens the event card. Positioned by transform (camera matrices, no WebGL).
import { Vector3 } from 'three';
import { h } from '../dom.js';
import { m2w } from '../../core/units.js';

const MAX = 3, RANGE = 80, NEAR = 25, LABEL_W = 220;

export function createMarkers(app) {
  const { ctx, data } = app;
  const layer = h('div.mk-markers', { 'aria-label': 'Activity nearby', role: 'group' });
  const items = new Map(); // ev.id -> { el, txt, ev, pos, on, … }
  const v = new Vector3(), dir = new Vector3();
  let hidden = false, slow = 1, hoverId = null;

  function make(ev, p) {
    const txt = h('span.mk-marker__t', ev.title?.en || ev.id);
    const el = h('button.mk-marker', {
      type: 'button', tabindex: '-1', 'aria-hidden': 'true', 'data-ev': ev.id,
      on: {
        click: () => app.card(`event:${ev.id}`),
        pointerenter: () => { hoverId = ev.id; }, pointerleave: () => { if (hoverId === ev.id) hoverId = null; },
        focus: () => { hoverId = ev.id; }, blur: () => { if (hoverId === ev.id) hoverId = null; },
      },
    }, h('span.mk-marker__d'), txt);
    el.setAttribute('aria-label', `${ev.title?.en || ev.id}: happening now. Open its card`);
    layer.append(el);
    return { el, txt, ev, pos: m2w(p[0], p[1], (p[2] ?? 16) + 3), on: false, vis: false, tf: '', lbl: null };
  }

  /** 2 Hz: which events get a marker (active, near, in sight; most important, then nearest) */
  function choose() {
    const on = ctx.settings.get('labels') !== false;
    const cam = ctx.camera;
    const want = [];
    if (on && cam) {
      const eye = cam.position;
      for (const ev of data.active(ctx.time?.t, { dynamic: false })) {
        const p = data.eventPos(ev);
        if (!p) continue;
        const pos = m2w(p[0], p[1], (p[2] ?? 16) + 3);
        const d = eye.distanceTo(pos);
        if (d > RANGE || d < 2) continue;
        // line of sight: the first collider along the ray must not stand well before the place
        dir.copy(pos).sub(eye).normalize();
        let seen = true;
        try { const hit = ctx.physics?.raycast?.(eye, dir, d); if (hit && hit.distance < d - 1.5) seen = false; } catch { /* no physics: assume seen */ }
        if (seen) want.push({ ev, d, imp: ev.importance || 1, p });
      }
      want.sort((a, b) => b.imp - a.imp || a.d - b.d);
      want.length = Math.min(want.length, MAX);
    }
    const ids = new Set(want.map((w) => w.ev.id));
    for (const [id, it] of items) if (!ids.has(id)) { it.el.remove(); items.delete(id); }
    for (const w of want) if (!items.has(w.ev.id)) items.set(w.ev.id, make(w.ev, w.p));
  }

  function place() {
    const cam = ctx.camera;
    if (!cam) return;
    const W = innerWidth, H = innerHeight;
    const fr = app.layout.free;
    const cx0 = W * 0.3, cx1 = W * 0.7, cy0 = H * 0.3, cy1 = H * 0.7;
    let centreLabel = false;
    const locked = !!ctx.player?.locked;
    const bn = app.banner?.rect?.() || null; // a label never runs under the area banner (it stays a diamond)
    // nearest first, so the nearest gets the centre's one label
    const list = [...items.values()].map((it) => ({ it, d: cam.position.distanceTo(it.pos) })).sort((a, b) => a.d - b.d);
    for (const { it, d } of list) {
      v.copy(it.pos).project(cam);
      const x = (v.x + 1) * 0.5 * W, y = (1 - v.y) * 0.5 * H;
      const vis = !hidden && v.z < 1 && x > fr.l + 4 && x < W - fr.r - 4 && y > fr.t + 4 && y < H - fr.b - 4;
      if (vis !== it.vis) {
        it.vis = vis;
        it.el.classList.toggle('is-on', vis);
        it.el.tabIndex = vis ? 0 : -1;
        if (vis) it.el.removeAttribute('aria-hidden'); else it.el.setAttribute('aria-hidden', 'true');
      }
      if (!vis) continue;
      const tf = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      if (tf !== it.tf) { it.tf = tf; it.el.style.transform = tf; }
      const inCentre = x > cx0 && x < cx1 && y > cy0 && y < cy1;
      const aimed = locked && Math.hypot(x - W / 2, y - H / 2) < 48;
      let lbl = d <= NEAR || hoverId === it.ev.id || aimed;
      if (lbl && inCentre && hoverId !== it.ev.id) { if (centreLabel) lbl = false; else centreLabel = true; }
      // the label runs to the right of its diamond: none where it would run under the Menu (the diamond stays)
      if (lbl && hoverId !== it.ev.id && x > W - fr.r - LABEL_W) lbl = false;
      if (lbl && bn && x - 10 < bn.r && x + LABEL_W > bn.l && y - 16 < bn.b && y + 16 > bn.t) lbl = false;
      if (lbl !== it.lbl) { it.lbl = lbl; it.el.classList.toggle('is-label', lbl); }
    }
  }

  return {
    el: layer,
    tick(dt) {
      slow += dt;
      if (slow >= 0.5) { slow = 0; choose(); }
      if (items.size) place();
    },
    setHidden(v2) { if (v2 === hidden) return; hidden = v2; layer.classList.toggle('is-hidden', v2); },
    refresh() { slow = 1; },
    /** the marker under a client point (touch taps), with a little slop */
    hitAt(x, y, slop = 14) {
      for (const it of items.values()) {
        if (!it.vis) continue;
        const r = it.el.getBoundingClientRect();
        if (x > r.left - slop && x < r.right + slop && y > r.top - slop && y < r.bottom + slop) return it.ev;
      }
      return null;
    },
    get count() { return [...items.values()].filter((i) => i.vis).length; },
    list: () => [...items.values()].map((i) => ({ id: i.ev.id, vis: i.vis, label: !!i.lbl })),
  };
}

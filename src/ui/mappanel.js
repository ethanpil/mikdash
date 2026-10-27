// MAP section (console §3.5): the plan of the Mount drawn from ctx.site, a label for every place (declutters with
// zoom), live activity (pulsing gold for what is happening now, a dashed ring for what starts within half an hour), the
// observer's position, the route of a trip, and select-and-go (a click selects, a double-click or Enter goes with the
// travel defaults). The places list is a browse list (the header search finds places); "Key" shows the legend. The
// Menu widens to the whole viewport for it on desktop and takes the full screen on phones.
//
// Layers: (1) base canvas = cached plan rasters (whole extent, the Mount, and the current view re-rastered at the exact
// scale once the view settles) + labels — redrawn only when the view, the labels' activity or the selection change;
// (2) dyn canvas = activity fills, selection, route, event markers, the observer — ≤ 15 fps while idle, every frame
// while the view moves. Nothing runs while the map is closed.
import { h, he, setText } from './dom.js';
import { ico } from './console/icons.js';
import { w2m, AMAH } from '../core/units.js';
import { wrap } from './format.js';
import { shortName } from './map/model.js';
import { renderPlan } from './map/plan.js';
import { createView } from './map/view.js';
import { layoutLabels, drawLabels, clearMeasureCache, warmLabel } from './map/labels.js';
import { createPlaces } from './map/places.js';
import { createCard } from './map/card.js';

const GOLD = [226, 184, 90];
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const SCALES = [2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
const DYN_HZ = 15;
const BIG_ZONE = 60; // amot: a click in a place at least this wide in both directions remembers the exact spot

export function createMapPanel(app) {
  const { ctx, data } = app;
  const isPhone = () => app.layout.isSheet;
  const body = h('div.mk-mapbody');
  const panel = { body, el: body };

  // ---------------- toolbar chips: Places (narrow screens) and Key (the legend) ----------------
  const placesBtn = h('button.mk-btn.mk-btn--sm.mk-placesbtn', { type: 'button', 'aria-expanded': 'false', on: { click: () => togglePlaces() } }, ico('menu'), 'Places');
  const keyBtn = h('button.mk-btn.mk-btn--sm.mk-keybtn', { type: 'button', 'aria-expanded': 'false', on: { click: () => toggleKey() } }, ico('help'), 'Key');

  // ---------------- viewport ----------------
  const base = h('canvas.mk-mapv__base', { 'aria-hidden': 'true' });
  const dyn = h('canvas.mk-mapv__dyn', { 'aria-hidden': 'true' });
  const tip = h('div.mk-mapv__tip', { 'aria-hidden': 'true' });
  const hintId = `mk-maphint-${Math.random().toString(36).slice(2, 7)}`;
  const stage = h('div.mk-mapv__stage', {
    tabindex: '0', role: 'application', 'aria-roledescription': 'map', 'aria-label': 'Plan of Har HaBayit and the Temple', 'aria-describedby': hintId,
  }, base, dyn, tip);
  const hint = h('p.sr-only', { id: hintId }, 'Arrow keys pan, plus and minus zoom, Enter goes to the selected place, slash searches, Escape closes the map.');
  const live = h('div.sr-only', { 'aria-live': 'polite' });
  // labelled (AC-5): the icon over a short visible label (vis), the full name in aria-label
  const zoomBtn = (lbl, ico, fn, title, vis = lbl) => h('button.mk-iconbtn.mk-mapv__btn', { type: 'button', 'aria-label': lbl, title, on: { click: fn } }, ico, h('span.mk-mapv__btnl', vis));
  const svgIcon = (body) => h('span.ico', { html: `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>` });
  const zoom = h('div.mk-mapv__zoom',
    h('div.mk-mapv__north', { 'aria-hidden': 'true', title: 'North is up' }, svgIcon('<path d="M12 3l4.5 11L12 11.6 7.5 14z" fill="currentColor"/>'), h('b', 'N')),
    zoomBtn('Zoom in', svgIcon('<path d="M12 6v12M6 12h12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'), () => zoomStep(1.7), 'Zoom in (+)', 'In'),
    zoomBtn('Zoom out', svgIcon('<path d="M6 12h12" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>'), () => zoomStep(1 / 1.7), 'Zoom out (−)', 'Out'),
    zoomBtn('Centre on me', svgIcon('<circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'), () => centerOnMe(), 'Centre on me', 'Me'));
  const presetSeg = h('div.mk-seg.mk-mapv__presets', { role: 'group', 'aria-label': 'Show' });
  const scaleBar = h('i');
  const scaleTxt = h('span.num');
  const scale = h('div.mk-mapv__scale', { 'aria-hidden': 'true' }, scaleBar, scaleTxt);
  const legend = h('div.mk-mapv__legend', { 'aria-label': 'Key', role: 'note' },
    h('span', h('i.lg-now'), 'Happening now'), h('span', h('i.lg-soon'), 'Within 30 min'),
    h('span', h('i.lg-up'), 'Upper storey'), h('span', h('i.lg-below'), 'Below ground'), h('span', h('i.lg-you'), 'You'));
  // the one travel bar (console/go.js) moves in here while the map covers the world (placeTravel)
  const travel = h('div.mk-mapv__travel', { hidden: true });
  const tools = h('div.mk-mapv__tools', presetSeg, placesBtn, keyBtn);
  const vp = h('div.mk-mapv', stage, tools, zoom, scale, legend, travel, hint, live);

  // ---------------- state ----------------
  let model = null, view = null, places = null, card = null;
  let W = 0, H = 0, dpr = 1;
  let needBase = true, needDyn = true, dynAcc = 0, lastChange = 0, isOpen = false, firstOpen = true;
  let sel = null; // { id, spot }
  let revealTimer = 0;
  let zoomW = 0; // px from the stage's right edge to the left of the zoom column (the off-screen marker keeps clear)
  let hover = null; // { kind, id, ev }
  let placed = [], markers = [], offscreen = null, blocked = [], controls = [];
  let markLaid = null; // where the off-screen "you" chevron stood when the labels were last laid out
  let guardTimer = 0;
  let warm = null; // the model being built ahead of the first open (prewarm)
  const fade = new Map(); // label id -> alpha
  let activity = { byZone: new Map(), soon: new Map(), events: [], key: '' };
  const rasters = { world: null, mount: null, detail: null };
  let trip = null; // { key, path: [[X,Y]...] | null, target: [X,Y] }
  const stats = { base: 0, dyn: 0, raster: 0, baseMs: 0, dynMs: 0, rasterMs: 0 }; // last-call timings, for tests

  function build() {
    model = app.mapModel(); // shared with the minimap; anchors are memoised: a part-warmed model just finishes on demand
    view = createView({
      el: stage,
      root: vp,
      size: () => ({ W, H }),
      insets,
      extent: padRect(model.extent(), 40),
      kMax: 36,
      reduced: () => app.reducedMotion(),
      onChange: () => { needBase = needDyn = true; lastChange = performance.now(); hideTip(); },
      onTap: (x, y) => tap(x, y, false),
      onDoubleTap: (x, y) => tap(x, y, true),
      onHover: (x, y) => hoverAt(x, y),
      onLeave: () => { hover = null; hideTip(); needDyn = true; },
    });
    for (const [k, p] of Object.entries(model.presets)) {
      presetSeg.append(h('button', { type: 'button', 'data-preset': k, 'aria-pressed': 'false', on: { click: () => view.fit(p.rect, { pad: 18 }) } }, p.label));
    }
    places = createPlaces({
      model,
      activity: () => activity,
      onSelect: (id, { fly }) => select(id, { fly, from: 'list' }),
      onGo: (id) => goZone(id),
    });
    card = createCard(app, {
      model,
      onClose: () => deselect(true),
      onGo: (id) => goZone(id),
      onSpot: () => goSpot(),
      onInfo: (id) => app.open('here', { zone: id, pinned: true }),
      onSelect: (id) => select(id, { fly: true }),
    });
    vp.append(card.el);
    // controls slide aside when the card opens: measure the label no-go areas where they come to rest
    zoom.addEventListener('transitionend', measureBlockedSoon);
    card.el.addEventListener('animationend', measureBlockedSoon);
    panel.body.append(places.el, vp);
    for (const z of model.list) { model.anchorOf(z); model.nameOf(z); }
    places.render();
    new ResizeObserver(() => { if (isOpen) resize(); }).observe(stage);
    if (document.fonts?.ready) document.fonts.ready.then(() => { clearMeasureCache(); needBase = true; });
  }
  const padRect = (r, p) => [[r[0][0] - p, r[0][1] - p], [r[1][0] + p, r[1][1] + p]];

  /** css px of the stage covered by the selection card: right on desktop / short landscape, bottom on phones */
  function cardInsets() {
    if (!card || card.el.hidden) return { r: 0, b: 0 };
    const sr = stage.getBoundingClientRect();
    const cr = card.el.getBoundingClientRect();
    if (cr.width >= sr.width * 0.9) return { r: 0, b: Math.max(0, sr.bottom - cr.top + 6) };
    return { r: Math.max(0, sr.right - cr.left + 6), b: 0 };
  }
  /** css px of the stage covered by the card and the top bar (presets, and the travel pill when it sits below them) */
  function insets() {
    const i = { l: 0, t: 0, ...cardInsets() };
    const sr = stage.getBoundingClientRect();
    for (const el of [tools, travel]) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (r.width) i.t = Math.max(i.t, r.bottom - sr.top + 4);
    }
    return i;
  }

  /**
   * The travel pill (route status + Stop): on the presets' row, right of them and centred on the visible map when it
   * fits there; else on a row of its own under them. Never over the presets or the card.
   */
  function placeTravel() {
    if (travel.hidden) return;
    const sr = stage.getBoundingClientRect(), pr = tools.getBoundingClientRect();
    const right = sr.width - cardInsets().r - 10, mid = (sr.width - cardInsets().r) / 2;
    const L = pr.width ? pr.right - sr.left + 10 : 10;
    travel.style.maxWidth = `${Math.max(140, right - 10)}px`;
    const w = travel.offsetWidth, th = travel.offsetHeight;
    let left, top;
    if (right - L >= w) { left = Math.min(right - w, Math.max(L, mid - w / 2)); top = pr.top - sr.top + (pr.height - th) / 2; }
    else { left = Math.max(10, Math.min(right - w, mid - w / 2)); top = (pr.width ? pr.bottom - sr.top : 0) + 8; }
    travel.style.left = `${Math.round(left)}px`;
    travel.style.top = `${Math.round(Math.max(4, top))}px`;
  }

  function measureBlocked() {
    placeTravel();
    const sr = stage.getBoundingClientRect();
    blocked = [];
    controls = [];
    for (const el of [tools, zoom, scale, legend, travel, card?.el]) {
      if (!el || el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || getComputedStyle(el).display === 'none') continue;
      blocked.push({ l: r.left - sr.left - 4, t: r.top - sr.top - 4, r: r.right - sr.left + 4, b: r.bottom - sr.top + 4 });
      // the observer's arrow hides under these (the card is outside the visible area already; the scale is see-through)
      if (el !== scale && el !== card?.el) controls.push({ l: r.left - sr.left, t: r.top - sr.top, r: r.right - sr.left, b: r.bottom - sr.top });
    }
    const zr = zoom.getBoundingClientRect();
    zoomW = zr.width ? sr.right - zr.left + 6 : 0;
    vp.style.setProperty('--mk-card-occ-r', `${insets().r}px`);
    vp.style.setProperty('--mk-card-occ-b', `${insets().b}px`);
  }

  function resize() {
    const w = stage.clientWidth, hh = stage.clientHeight;
    const nd = Math.min(2, devicePixelRatio || 1);
    if (!w || !hh) return;
    if (w !== W || hh !== H || nd !== dpr) {
      W = w; H = hh; dpr = nd;
      for (const c of [base, dyn]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      rasters.detail = null;
      view?.clamp();
    }
    measureBlocked();
    needBase = needDyn = true;
    lastChange = performance.now() - 1000; // re-raster right away
  }

  // ---------------- rasters ----------------
  function makeRaster(rect, k, d) {
    const [[x0, y0], [x1, y1]] = rect;
    const w = Math.ceil((x1 - x0) * k), hh = Math.ceil((y1 - y0) * k);
    return { k, x0, y1, w, h: hh, canvas: renderPlan(ctx, model, { k, x0, y1, w, h: hh, dpr: d }) };
  }
  function ensureCoarse() {
    if (!rasters.world) {
      const r = padRect(model.extent(), 40);
      const k = Math.min(1600 / (r[1][0] - r[0][0]), 1600 / (r[1][1] - r[0][1]));
      rasters.world = makeRaster(r, k, 1);
    }
    if (!rasters.mount) {
      const r = padRect(model.presets.mount.rect, 30);
      rasters.mount = makeRaster(r, Math.min(2.8, 1500 / (r[1][0] - r[0][0])), 1);
    }
  }
  /** the current view (+25 % each side) at its exact scale — rendered once the view has settled */
  function detailStale() {
    const d = rasters.detail;
    if (!d) return true;
    const T = view.tf();
    if (Math.abs(d.k / T.k - 1) > 0.004) return true;
    return T.X(0) < d.x0 || T.X(W) > d.x0 + d.w / d.k || T.Y(0) > d.y1 || T.Y(H) < d.y1 - d.h / d.k;
  }
  function renderDetail() {
    const t0 = performance.now();
    const T = view.tf();
    let m = 0.25;
    while (m > 0 && (W * (1 + 2 * m)) * (H * (1 + 2 * m)) * dpr * dpr > 8e6) m = Math.max(0, m - 0.05);
    const x0 = T.X(-W * m), y1 = T.Y(-H * m), x1 = T.X(W * (1 + m)), y0 = T.Y(H * (1 + m));
    rasters.detail = makeRaster([[x0, y0], [x1, y1]], T.k, dpr);
    stats.raster++; stats.rasterMs = performance.now() - t0;
  }

  // ---------------- activity ----------------
  const zonesOf = (ev) => [ev.zone, ...(Array.isArray(ev.zones) ? ev.zones : [])].filter((id) => id && model.get(id));
  function computeActivity() {
    const t = ctx.time?.t;
    if (!Number.isFinite(t)) return false;
    const events = data.active(t);
    const byZone = new Map();
    for (const ev of events) for (const id of zonesOf(ev)) { if (!byZone.has(id)) byZone.set(id, []); byZone.get(id).push(ev); }
    const soon = new Map();
    for (const ev of data.upcoming(t, 24)) {
      const r = data.times(ev);
      if (!r) continue;
      const d = wrap(r.t0 - t);
      if (d > 30) continue;
      for (const id of zonesOf(ev)) if (!byZone.has(id) && !(soon.get(id) <= d)) soon.set(id, d);
    }
    const key = `${[...byZone].map(([id, e]) => `${id}:${e.map((x) => x.id).join('+')}`).join()}|${[...soon].map(([id, d]) => `${id}${Math.round(d)}`).join()}`;
    const changed = key !== activity.key;
    activity = { byZone, soon, events, key };
    return changed;
  }

  // ---------------- labels ----------------
  function labelItems() {
    const cur = data.currentZoneId();
    const items = [];
    for (const z of model.list) {
      const evs = activity.byZone.get(z.id);
      const top = evs?.[0];
      items.push({
        id: z.id, tier: z.tier, level: z.level, stacked: z.stacked, name: z.name, anchor: z.anchor, room: z.room, main: z.main,
        slide: z.id !== 'outside' && z.area <= 1e6, // the city and the valleys are named at their observer spots only
        active: evs ? evs.length : 0, soon: evs ? null : (activity.soon.get(z.id) ?? null),
        callout: top ? (top.title?.en || top.id) : null,
        selected: sel?.id === z.id, current: cur === z.id,
        force: sel?.id === z.id || !!evs,
        score: (sel?.id === z.id ? 1e7 : 0) + (evs ? 1e6 + (Math.max(...evs.map((e) => e.importance || 1))) * 1e5 : 0)
          + (cur === z.id ? 5e4 : 0) + (activity.soon.has(z.id) ? 2e4 : 0) + z.tier * 1e3 - (z.stacked ? 600 : 0) + Math.log(1 + z.area) * 10,
      });
    }
    return items.sort((a, b) => b.score - a.score);
  }

  // ---------------- drawing ----------------
  const bg = base.getContext('2d');
  const dg = dyn.getContext('2d');
  let lastPlaced = new Set(), lastBase = performance.now(), firstFrame = true;
  function drawBase() {
    const t0 = performance.now();
    needBase = false;
    const T = view.tf();
    bg.setTransform(dpr, 0, 0, dpr, 0, 0);
    bg.clearRect(0, 0, W, H);
    const covers = (r) => r && T.x(r.x0) <= 0 && T.y(r.y1) <= 0 && T.x(r.x0) + r.w * (T.k / r.k) >= W && T.y(r.y1) + r.h * (T.k / r.k) >= H;
    const layers = [rasters.world, rasters.mount, rasters.detail].filter(Boolean);
    // start from the finest raster that covers the whole view; coarser ones fill in while it is being replaced
    let from = 0;
    for (let i = layers.length - 1; i >= 0; i--) if (covers(layers[i])) { from = i; break; }
    bg.imageSmoothingEnabled = true;
    layers.slice(from).forEach((r, i) => {
      const dx = T.x(r.x0), dy = T.y(r.y1), dw = r.w * (T.k / r.k), dh = r.h * (T.k / r.k);
      if (dx > W || dy > H || dx + dw < 0 || dy + dh < 0) return;
      if (i) bg.clearRect(Math.max(0, Math.floor(dx)), Math.max(0, Math.floor(dy)), Math.ceil(Math.min(W, dx + dw) - Math.max(0, dx)), Math.ceil(Math.min(H, dy + dh) - Math.max(0, dy)));
      bg.drawImage(r.canvas, dx, dy, dw, dh);
    });
    // labels: never over the overlays, nor over the event markers
    const dots = [];
    for (const ev of activity.events) {
      const p = data.eventPos(ev);
      if (!p) continue;
      const x = T.x(p[0]), y = T.y(p[1]);
      if (x > -10 && y > -10 && x < W + 10 && y < H + 10) dots.push({ l: x - 6, t: y - 6, r: x + 6, b: y + 6 });
    }
    // ... nor over the off-screen "you" chevron
    const pm = playerMark(T);
    markLaid = pm?.off ? [pm.x, pm.y] : null;
    if (markLaid) dots.push({ l: pm.x - 17, t: pm.y - 17, r: pm.x + 17, b: pm.y + 17 });
    placed = layoutLabels(bg, labelItems(), T, blocked.concat(dots), isPhone() ? 0.94 : 1, owns);
    const now = performance.now();
    const reduced = app.reducedMotion();
    let fading = false;
    const ids = new Set();
    for (const L of placed) {
      ids.add(L.id);
      let a = fade.get(L.id);
      if (!lastPlaced.has(L.id) && a === undefined) a = reduced || firstFrame ? 1 : 0;
      if (a === undefined) a = 1;
      a = reduced ? 1 : Math.min(1, a + (now - lastBase) / 200);
      fade.set(L.id, a);
      if (a < 1) fading = true;
    }
    for (const id of [...fade.keys()]) if (!ids.has(id)) fade.delete(id);
    lastPlaced = ids;
    lastBase = now;
    firstFrame = false;
    drawLabels(bg, placed, (id) => fade.get(id) ?? 1);
    if (fading) needBase = true;
    updateScale(T);
    stats.base++; stats.baseMs = performance.now() - t0;
  }
  /** a click at this site point would select that place (ground: the place on top there; storeys: any box) */
  function owns(id, X, Y) {
    const z = model.get(id);
    if (!z) return false;
    return z.stacked ? z.boxes.some((b) => X >= b[0][0] && X <= b[1][0] && Y >= b[0][1] && Y <= b[1][1]) : model.groundAt(X, Y) === id;
  }
  function boxesPath(g, boxes, T) {
    g.beginPath();
    for (const b of boxes) g.rect(T.x(b[0][0]), T.y(b[1][1]), (b[1][0] - b[0][0]) * T.k, (b[1][1] - b[0][1]) * T.k);
  }

  function drawDyn() {
    const t0 = performance.now();
    needDyn = false;
    const T = view.tf();
    const g = dg;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const reduced = app.reducedMotion();
    const now = performance.now() / 1000;
    const pulse = reduced ? 0.5 : 0.5 + 0.5 * Math.sin(now * Math.PI * 2 / 2.4);

    // 1. places with activity now: soft pulsing gold, and the observer's own place: a light tint. Lowest priority
    //    first; the higher-priority places inside a place are cut out of its fill (that area is theirs on the plan);
    //    storeys above / below are drawn last. Large places get a fainter fill so the plan stays readable.
    const curId = data.currentZoneId();
    const curZ = curId && curId !== 'outside' ? model.get(curId) : null;
    const regions = [...activity.byZone.keys()].map((id) => ({ z: model.get(id), act: true })).filter((r) => r.z);
    if (curZ) regions.push({ z: curZ, act: false });
    regions.sort((a, b) => (a.z.stacked - b.z.stacked) || a.z.priority - b.z.priority || b.z.area - a.z.area || a.act - b.act);
    for (const { z, act } of regions) {
      const big = Math.min(1, Math.max(0.25, Math.sqrt(4000 / z.area)));
      g.globalCompositeOperation = 'source-over';
      boxesPath(g, z.boxes, T);
      if (act) {
        g.fillStyle = rgba(GOLD, (reduced ? 0.17 : 0.07 + 0.14 * pulse) * big);
        g.fill();
        g.lineWidth = reduced ? 2 : 1.6;
        g.strokeStyle = rgba(GOLD, reduced ? 0.95 : 0.5 + 0.45 * pulse);
        g.setLineDash(z.stacked ? [5, 3] : []);
        g.stroke();
        g.setLineDash([]);
      } else {
        g.fillStyle = `rgba(241,232,212,${0.075 * big + 0.02})`;
        g.fill();
        if (z.area < 20000) {
          g.lineWidth = 3.5; g.strokeStyle = 'rgba(10,8,5,0.5)'; g.stroke();
          g.lineWidth = 1.5; g.strokeStyle = 'rgba(241,232,212,0.85)'; g.stroke();
        }
      }
      if (!z.stacked) {
        g.globalCompositeOperation = 'destination-out';
        g.fillStyle = '#000';
        for (const b of model.childrenOf(z)) g.fillRect(T.x(b[0][0]), T.y(b[1][1]), (b[1][0] - b[0][0]) * T.k, (b[1][1] - b[0][1]) * T.k);
      }
    }
    g.globalCompositeOperation = 'source-over';
    // 2. starting within ~30 minutes: a quiet dashed ring
    g.setLineDash([5, 4]);
    g.lineWidth = 1.3;
    g.strokeStyle = rgba(GOLD, 0.7);
    for (const id of activity.soon.keys()) { const z = model.get(id); if (z) { boxesPath(g, [z.main], T); g.stroke(); } }
    g.setLineDash([]);
    // 4. hover, 5. selection
    if (hover?.id && hover.id !== sel?.id && hover.id !== 'outside') {
      const z = model.get(hover.id);
      if (z) { boxesPath(g, z.boxes, T); g.lineWidth = 1.2; g.strokeStyle = 'rgba(241,232,212,0.55)'; g.stroke(); }
    }
    if (sel?.id) {
      const z = model.get(sel.id);
      if (z && sel.id !== 'outside') {
        boxesPath(g, z.boxes, T);
        g.fillStyle = 'rgba(255,240,200,0.08)';
        g.fill();
        g.save();
        g.shadowColor = 'rgba(242,211,138,0.85)'; g.shadowBlur = 10;
        g.lineWidth = 2.4; g.strokeStyle = '#f2d38a';
        if (z.stacked) g.setLineDash([6, 3]);
        g.stroke();
        g.restore();
      }
      if (sel.spot) pin(g, T.x(sel.spot[0]), T.y(sel.spot[1]));
    }
    // 6. the route of a walk in progress
    drawTrip(g, T, now, reduced);
    // 7. event markers
    markers = [];
    for (const ev of activity.events) {
      const p = data.eventPos(ev);
      if (!p) continue;
      const x = T.x(p[0]), y = T.y(p[1]);
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      markers.push({ x, y, ev });
      const ph = reduced ? 0.45 : (now * 0.6 + (ev.importance || 1) * 0.17) % 1;
      g.strokeStyle = `rgba(242,211,138,${(1 - ph) * 0.9})`;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y, 4 + ph * 12, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#d4a640'; g.strokeStyle = 'rgba(10,8,5,0.8)'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(x, y, (ev.importance || 1) >= 3 ? 4.5 : 3.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // 8. the observer: view cone + arrow; an edge marker when off screen
    drawPlayer(g, T);
    stats.dyn++; stats.dynMs = performance.now() - t0;
  }

  function pin(g, x, y) {
    g.save();
    g.translate(x, y);
    g.fillStyle = '#f2d38a'; g.strokeStyle = 'rgba(10,8,5,0.9)'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-6, -8, -6, -15, 0, -15); g.bezierCurveTo(6, -15, 6, -8, 0, 0); g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = '#1b1409'; g.beginPath(); g.arc(0, -10, 2, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function playerSite() {
    const pos = ctx.player?.position;
    if (!pos) return null;
    const s = w2m(pos);
    return [s.X, s.Y, s.Z];
  }

  /**
   * Where the observer is drawn: { off: false, x, y } on the visible map, or { off: true, x, y, ang } a chevron on the
   * edge of the visible area pointing toward them — also when their arrow would hide under a map control. The chevron
   * slides along its edge clear of the controls.
   */
  function playerMark(T) {
    const s = playerSite();
    if (!s) return null;
    const x = T.x(s[0]), y = T.y(s[1]);
    const vis = view.visible();
    const under = (px, py, R) => controls.some((c) => px + R > c.l && px - R < c.r && py + R > c.t && py - R < c.b);
    if (x >= vis.l + 6 && x <= vis.r - 6 && y >= vis.t + 6 && y <= vis.b - 6 && !under(x, y, 9)) return { off: false, x, y };
    const box = { l: vis.l + 22, r: Math.min(vis.r, W - zoomW) - 22, t: vis.t + 22, b: vis.b - 22 };
    if (box.r <= box.l || box.b <= box.t) return null;
    const cx = (box.l + box.r) / 2, cy = (box.t + box.b) / 2;
    const dx = x - cx, dy = y - cy;
    const fx = Math.abs((box.r - box.l) / 2 / (dx || 1e-6)), fy = Math.abs((box.b - box.t) / 2 / (dy || 1e-6));
    let ex = cx + dx * Math.min(fx, fy), ey = cy + dy * Math.min(fx, fy);
    // clear of the controls and of the event markers (as last drawn)
    const busy = (px, py) => under(px, py, 16) || markers.some((m) => Math.hypot(m.x - px, m.y - py) < 24);
    if (busy(ex, ey)) {
      const alongY = fx <= fy; // on the left / right edge: slide up or down; on the top / bottom edge: sideways
      for (let d = 8; d <= 640; d += 8) {
        const hit = [d, -d].map((s2) => (alongY ? [ex, Math.max(box.t, Math.min(box.b, ey + s2))] : [Math.max(box.l, Math.min(box.r, ex + s2)), ey]))
          .find(([px, py]) => !busy(px, py));
        if (hit) { [ex, ey] = hit; break; }
      }
    }
    return { off: true, x: ex, y: ey, ang: Math.atan2(y - ey, x - ex) };
  }

  function drawPlayer(g, T) {
    offscreen = null;
    const pm = playerMark(T);
    if (!pm) return;
    // the labels keep clear of the chevron: lay them out again when it has moved along the edge
    if (pm.off !== !!markLaid || (pm.off && Math.hypot(pm.x - markLaid[0], pm.y - markLaid[1]) > 6)) needBase = true;
    const { x, y } = pm;
    if (pm.off) {
      g.save();
      g.translate(x, y);
      g.rotate(pm.ang);
      g.fillStyle = 'rgba(10,8,5,0.75)'; g.beginPath(); g.arc(0, 0, 14, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(242,211,138,0.8)'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#f2d38a';
      g.beginPath(); g.moveTo(8, 0); g.lineTo(-4, -6); g.lineTo(-1, 0); g.lineTo(-4, 6); g.closePath(); g.fill();
      g.restore();
      offscreen = { x, y };
      return;
    }
    const hd = ((ctx.player.heading || 0) * Math.PI) / 180;
    const cam = ctx.camera;
    const hfov = cam ? 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect) : 1.6;
    g.save();
    g.translate(x, y);
    g.rotate(hd);
    const R = 52;
    const cone = g.createRadialGradient(0, 0, 0, 0, 0, R);
    cone.addColorStop(0, 'rgba(242,211,138,0.42)'); cone.addColorStop(1, 'rgba(242,211,138,0)');
    g.fillStyle = cone;
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -Math.PI / 2 - hfov / 2, -Math.PI / 2 + hfov / 2); g.closePath(); g.fill();
    g.fillStyle = 'rgba(10,8,5,0.5)'; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff2c4'; g.strokeStyle = '#1a140d'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(0, -9.5); g.lineTo(6.5, 6.5); g.lineTo(0, 3); g.lineTo(-6.5, 6.5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  // ---------------- trips (walks started from anywhere in the UI) ----------------
  /** the route of the trip in progress (the travel module's) and the one travel bar, hosted in here meanwhile */
  function syncTrip() {
    const t = app.travel.trip;
    const walking = !!t && t.way !== 'instant';
    if (!walking) {
      if (trip) { trip = null; needDyn = true; }
      if (!travel.hidden) { travel.hidden = true; app.hostTravelBar(null); measureBlockedSoon(); }
      return;
    }
    const route = app.travel.routeSite();
    const key = `${t.key}`;
    if (!trip || trip.key !== key) needDyn = true;
    trip = { key, target: t.to || route?.[route.length - 1] || null, path: route && route.length > 1 ? route : null };
    if (!trip.target) { trip = null; return; }
    const wasHidden = travel.hidden;
    const w0 = travel.offsetWidth;
    if (travel.firstChild !== app.travel.bar) app.hostTravelBar(travel);
    travel.hidden = false;
    if (wasHidden || Math.abs(travel.offsetWidth - w0) > 4) measureBlockedSoon();
    else placeTravel(); // the card may have come or gone since
  }
  let mbRaf = 0;
  function measureBlockedSoon() { cancelAnimationFrame(mbRaf); mbRaf = requestAnimationFrame(() => { measureBlocked(); needBase = true; }); }
  function nearestOnPath(path, s) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < path.length; i++) { const d = (path[i][0] - s[0]) ** 2 + (path[i][1] - s[1]) ** 2; if (d < bd) { bd = d; bi = i; } }
    return bi;
  }
  function drawTrip(g, T, now, reduced) {
    if (!trip) return;
    const s = playerSite();
    const pts = trip.path ? trip.path.slice(s ? nearestOnPath(trip.path, s) : 0) : [trip.target];
    if (s) pts.unshift([s[0], s[1]]);
    if (pts.length < 2) return;
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    pts.forEach(([X, Y], i) => (i ? g.lineTo(T.x(X), T.y(Y)) : g.moveTo(T.x(X), T.y(Y))));
    g.lineWidth = 5; g.strokeStyle = 'rgba(10,8,5,0.55)'; g.stroke();
    g.setLineDash([7, 6]);
    g.lineDashOffset = reduced ? 0 : -(now * 18) % 13;
    g.lineWidth = 2.2; g.strokeStyle = '#f2d38a'; g.stroke();
    g.restore();
    const [tx, ty] = trip.target;
    g.save();
    g.strokeStyle = '#f2d38a'; g.lineWidth = 2; g.fillStyle = 'rgba(242,211,138,0.25)';
    g.beginPath(); g.arc(T.x(tx), T.y(ty), 7, 0, Math.PI * 2); g.fill(); g.stroke();
    g.restore();
  }

  // ---------------- scale bar & header ----------------
  let scaleKey = '';
  function updateScale(T) {
    let L = SCALES[SCALES.length - 1];
    for (const s of SCALES) if (s * T.k >= 56) { L = s; break; }
    const key = `${L}|${Math.round(L * T.k)}`;
    if (key === scaleKey) return;
    scaleKey = key;
    scaleBar.style.width = `${Math.round(L * T.k)}px`;
    const m = L * AMAH;
    setText(scaleTxt, `${L} amot ≈ ${m >= 10 ? Math.round(m) : m.toFixed(1)} m`);
    // a preset reads as pressed while the visible part of the map shows (about) its extent
    const st = view.target, vis = view.visible();
    const T2 = view.tf(st);
    const vx = T2.X(vis.cx), vy = T2.Y(vis.cy);
    for (const b of presetSeg.children) {
      const r = model.presets[b.dataset.preset]?.rect;
      const on = !!r && Math.abs(vx - (r[0][0] + r[1][0]) / 2) < (r[1][0] - r[0][0]) * 0.2 && Math.abs(vy - (r[0][1] + r[1][1]) / 2) < (r[1][1] - r[0][1]) * 0.2
        && Math.abs(Math.log(st.k / fitK(r))) < 0.25;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  function fitK(r) {
    const vis = view.visible();
    return Math.min((vis.r - vis.l - 36) / (r[1][0] - r[0][0]), (vis.b - vis.t - 36) / (r[1][1] - r[0][1]));
  }
  // ---------------- hit testing, hover, tap ----------------
  function hitAt(x, y) {
    if (offscreen && Math.hypot(x - offscreen.x, y - offscreen.y) < 18) return { kind: 'me' };
    let best = null, bd = 13;
    for (const m of markers) { const d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m; } }
    if (best) return { kind: 'event', id: zonesOf(best.ev)[0] || null, ev: best.ev };
    for (let i = placed.length - 1; i >= 0; i--) {
      const r = placed[i].rect;
      if (x >= r.l && x <= r.r && y >= r.t && y <= r.b) return { kind: 'label', id: placed[i].id };
    }
    const T = view.tf();
    const X = T.X(x), Y = T.Y(y);
    return { kind: 'zone', id: model.groundAt(X, Y), spot: [X, Y], stacked: model.stackedAt(X, Y) };
  }

  function hoverAt(x, y) {
    const hit = hitAt(x, y);
    const id = hit.id || null;
    const feature = hit.kind !== 'zone' || (id && model.get(id)?.area < 20000);
    stage.style.cursor = feature ? 'pointer' : '';
    if (hover?.id !== id || hover?.kind !== hit.kind || hover?.ev !== hit.ev) { hover = { ...hit }; needDyn = true; }
    showTip(hit, x, y);
  }
  function showTip(hit, x, y) {
    if (hit.kind === 'me') { tip.replaceChildren(h('b', 'You'), ' — click to centre'); placeTip(x, y); return; }
    const id = hit.id;
    const z = id ? model.get(id) : null;
    if (!z) { hideTip(); return; }
    const n = z.name || model.nameOf(z);
    const evs = activity.byZone.get(id) || [];
    const lines = [h('div.mk-tip__name', h('span', n.short), n.he ? he(n.he) : null, z.stacked ? h('span.mk-tip__lvl', z.level) : null)];
    if (hit.kind === 'event') lines.push(h('div.mk-tip__ev', hit.ev.title?.en || hit.ev.id));
    else if (evs.length) lines.push(h('div.mk-tip__ev', `${evs.length} ${evs.length === 1 ? 'activity' : 'activities'} now · ${evs[0].title?.en || evs[0].id}`));
    else if (activity.soon.has(id)) lines.push(h('div.mk-tip__soon', `Starts in ${Math.max(1, Math.round(activity.soon.get(id)))} min`));
    const above = (hit.stacked || []).filter((s) => s !== id).map((s) => model.get(s)).filter(Boolean);
    if (above.length) lines.push(h('div.mk-tip__also', `Also here: ${above.map((o) => `${o.level === 'below' ? '↓' : '↑'} ${o.name?.short || o.id}`).join(', ')}`));
    tip.replaceChildren(...lines);
    placeTip(x, y);
  }
  function placeTip(x, y) {
    tip.classList.add('in');
    const tw = tip.offsetWidth || 180, th = tip.offsetHeight || 40;
    const vis = view.visible();
    const tx = Math.max(6, Math.min(x + 14, vis.r - tw - 8));
    const ty = y - th - 12 < 6 ? y + 18 : y - th - 12;
    tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
  }
  function hideTip() { tip.classList.remove('in'); }

  function tap(x, y, double) {
    const hit = hitAt(x, y);
    if (hit.kind === 'me') { centerOnMe(); return; }
    if (hit.kind === 'event') {
      if (double) { app.travel.goEvent(hit.ev); return; }
      if (hit.id) select(hit.id, { ev: hit.ev, from: 'tap' });
      return;
    }
    const id = hit.id;
    if (!id) { deselect(); return; }
    const z = model.get(id);
    const big = z && (z.main[1][0] - z.main[0][0]) >= BIG_ZONE && (z.main[1][1] - z.main[0][1]) >= BIG_ZONE;
    const spot = hit.kind === 'zone' && big ? hit.spot : null;
    if (double) {
      clearTimeout(revealTimer);
      if (sel?.id !== id) select(id, { spot, from: 'tap' });
      if (spot) goSpot(spot); else goZone(id);
      return;
    }
    select(id, { spot, from: 'tap' });
  }

  // ---------------- selection & going ----------------
  function select(id, { spot = null, ev = null, fly = false, from = 'map' } = {}) {
    const z = model.get(id);
    if (!z) { deselect(); return; }
    sel = { id, spot };
    // the card and the controls that slide aside may come to rest under the second tap of a double tap: let taps
    // fall through to the map until a double tap can no longer come (view.js: 340 ms)
    if (from === 'tap') {
      vp.classList.add('is-tapguard');
      clearTimeout(guardTimer);
      guardTimer = setTimeout(() => vp.classList.remove('is-tapguard'), 380);
    }
    card.show(id, { spot, expand: ev?.id || null });
    if (from !== 'list') places.setSelected(id);
    hover = null; hideTip();
    vp.classList.add('has-card');
    measureBlocked();
    // keep the place clear of the card that just opened; after a click, only once a second click (double = go)
    // can no longer come, so the map does not move under the pointer between the two clicks
    const reveal = () => { const p = spot || z.anchor; view.ensureVisible(p[0], p[1], 40); };
    clearTimeout(revealTimer);
    if (fly) flyToZone(z);
    else if (from === 'tap') revealTimer = setTimeout(() => { if (isOpen && sel?.id === id) reveal(); }, 360);
    else reveal();
    setText(live, `Selected: ${card.summary()}`);
    needBase = needDyn = true;
  }
  function deselect(focusMap = false) {
    if (!sel) return;
    sel = null;
    card.hide();
    places.setSelected(null);
    vp.classList.remove('has-card');
    measureBlocked();
    needBase = needDyn = true;
    if (focusMap) stage.focus({ preventScroll: true });
  }
  function flyToZone(z) {
    const [mn, mx] = z.main;
    const w = mx[0] - mn[0], hh = mx[1] - mn[1];
    if (w * hh > 1e6) { view.centerOn(z.anchor[0], z.anchor[1], view.state.k); return; }
    const p = Math.max(w, hh) * 0.9 + 6;
    view.fit([[mn[0] - p, mn[1] - p], [mx[0] + p, mx[1] + p]], { pad: 12, kHi: 9, kLo: view.kMin });
  }
  function goZone(id) {
    const z = data.zone(id) || {};
    // the card says so and its Go is disabled; this reaches Enter and double-click
    if (z.stand === null) { setText(live, `${z.name?.en || shortName(id)} has no floor to stand on; it is seen from the places around it.`); return; }
    app.travel.goZone(id);
  }
  function goSpot(spot = sel?.spot) {
    if (!spot) return;
    const m = sel?.id ? model.get(sel.id) : null;
    const X = Math.round(spot[0] * 10) / 10, Y = Math.round(spot[1] * 10) / 10;
    const target = Number.isFinite(m?.floorZ) ? { at: [X, Y, m.floorZ] } : { at: [X, Y] };
    app.travel.start(target, { label: 'the spot you picked' });
  }
  function centerOnMe(focus = true) {
    const s = playerSite();
    if (!s) return;
    view.centerOn(s[0], s[1], Math.max(view.target.k, 2.2));
    if (focus) stage.focus({ preventScroll: true });
  }
  function zoomStep(f) {
    const vis = view.visible();
    view.zoomAt(vis.cx, vis.cy, f, true);
  }

  // ---------------- places (phones / narrow: an overlay list) ----------------
  function togglePlaces(on = !panel.body.classList.contains('is-places'), focus = true) {
    panel.body.classList.toggle('is-places', on);
    placesBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (!focus) return;
    if (on) places.focus(); else stage.focus({ preventScroll: true });
  }
  function toggleKey(on = !vp.classList.contains('is-key')) {
    vp.classList.toggle('is-key', on);
    keyBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    measureBlockedSoon();
  }

  // ---------------- keyboard ----------------
  stage.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const step = e.shiftKey ? 240 : 80;
    const k = e.key;
    if (k === 'ArrowLeft') view.panBy(step, 0);
    else if (k === 'ArrowRight') view.panBy(-step, 0);
    else if (k === 'ArrowUp') view.panBy(0, step);
    else if (k === 'ArrowDown') view.panBy(0, -step);
    else if (k === '+' || k === '=') zoomStep(1.5);
    else if (k === '-' || k === '_') zoomStep(1 / 1.5);
    else if (k === 'Enter' && sel?.id) goZone(sel.id);
    else return;
    e.preventDefault();
  });
  // after choosing a place in the overlay list on a narrow screen, put the list away so the card shows
  panel.body.addEventListener('click', (e) => {
    if (panel.body.classList.contains('is-places') && e.target.closest('.mk-mapl__opt')) togglePlaces(false);
  });

  // ---------------- open / close / tick ----------------
  function initialView() {
    const s = playerSite();
    const zid = data.currentZoneId();
    const g = zid ? model.get(zid)?.group : null;
    const key = g === 'sanctuary' ? 'sanctuary' : ['en', 'azarah', 'chambers'].includes(g) || zid === 'chel' || zid === 'soreg' ? 'courts' : 'mount';
    const r = model.presets[key].rect;
    if (!s) { view.fit(r, { pad: 18, animate: false }); return; }
    // the preset and the observer together; if the observer is far away, the preset's scale centred on them
    const u = [[Math.min(r[0][0], s[0] - 30), Math.min(r[0][1], s[1] - 30)], [Math.max(r[1][0], s[0] + 30), Math.max(r[1][1], s[1] + 30)]];
    const grow = ((u[1][0] - u[0][0]) * (u[1][1] - u[0][1])) / ((r[1][0] - r[0][0]) * (r[1][1] - r[0][1]));
    if (grow <= 2.5) view.fit(u, { pad: 18, animate: false });
    else { view.fit(r, { pad: 18, animate: false }); view.centerOn(s[0], s[1], view.state.k, false); }
  }

  /**
   * Build the model (label anchors ≈ 70 ms on the HD 4600), the places list and the plan rasters in idle time after
   * 'ready', a few anchors per idle slice, so the first M opens at once. Opening first simply finishes the work.
   */
  function prewarm() {
    if (model || warm) return;
    // a frame that never leaves idle time (the scene on a slow GPU) still gets a bounded slice every second
    const idle = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(() => fn(null), 300));
    let i = 0;
    const step = (dl) => {
      if (model) return; // opened meanwhile: build() finished the work
      try {
        if (!warm) { warm = app.mapModel(); if (warm.list.length) warm.nameOf(warm.list[0]); idle(step); return; }
        const t0 = performance.now(), lim = dl && !dl.didTimeout ? Math.max(2, dl.timeRemaining() - 1) : 12;
        do warm.anchorOf(warm.list[i++]); while (i < warm.list.length && performance.now() - t0 < lim);
        if (i < warm.list.length) { idle(step); return; }
        // build() errors are not swallowed: they are the same as on open (where the map would be half built)
        idle(() => {
          if (model) return;
          build();
          let j = 0;
          const fonts = (d) => {
            const t1 = performance.now(), lim2 = d && !d.didTimeout ? Math.max(2, d.timeRemaining() - 1) : 12;
            try { do { const z = model.list[j++]; if (z) warmLabel(bg, z, isPhone() ? 0.94 : 1); } while (j < model.list.length && performance.now() - t1 < lim2); } catch { j = model.list.length; }
            if (j < model.list.length) { idle(fonts); return; }
            if (!isOpen) idle(() => { try { ensureCoarse(); } catch { /* retried on open */ } });
          };
          idle(fonts);
        });
      } catch { warm = null; /* anchors: the first open computes them (and shows any error) */ }
    };
    idle(step);
  }

  return {
    el: body,
    prewarm,
    focusTarget: () => stage,
    get open() { return isOpen; },
    get api() {
      return {
        select: (id, o) => select(id, { fly: true, ...o }), deselect, view: () => view?.state, setView: (s2, o) => view?.set(s2, o),
        fit: (k) => view?.fit(model.presets[k].rect, { pad: 18, animate: false }), labels: () => placed.map((p) => p.id), model: () => model, activity: () => activity,
        labelRects: () => placed.map((p) => ({ id: p.id, ...p.rect })), selected: () => sel?.id || null, trip: () => (trip ? { path: trip.path?.length || 0 } : null),
        stats: () => ({ ...stats }), siteToScreen: (X, Y) => { const T = view.tf(); return [T.x(X), T.y(Y)]; }, screenToSite: (x, y) => { const T = view.tf(); return [T.X(x), T.Y(y)]; },
        anchor: (id) => model?.get(id)?.anchor || null,
        marker: () => (view ? playerMark(view.tf()) : null), // { off, x, y } where "you" is drawn (stage css px)
        owns: (id, X, Y) => !!model && owns(id, X, Y),
        hit: (x, y) => { const r = hitAt(x, y); return { kind: r.kind, id: r.id || null, ev: r.ev?.id || null }; },
        places: (on) => togglePlaces(on),
        key: (on) => toggleKey(on),
      };
    },
    /** the visible part of the plan in site amot [[X0, Y0], [X1, Y1]] (the header disc's overview) */
    viewRect() {
      if (!view || !W) return null;
      const T = view.tf(), v = view.visible();
      return [[T.X(v.l), T.Y(v.b)], [T.X(v.r), T.Y(v.t)]];
    },
    pan(dx, dy) { view?.panBy(dx, dy); },
    show(opts = {}) {
      const was = isOpen;
      isOpen = true;
      if (!model) build();
      resize();
      ensureCoarse();
      computeActivity();
      places.render();
      if (firstOpen) { initialView(); firstOpen = false; }
      if (opts.zone && model.get(opts.zone)) select(opts.zone, { fly: true, ev: opts.event ? { id: opts.event } : null });
      else if (sel) card.show(sel.id, { spot: sel.spot });
      if (opts.centerMe) centerOnMe(false);
      if (!was) togglePlaces(false, false);
      requestAnimationFrame(() => { resize(); syncTrip(); if (opts.zone || opts.centerMe) needBase = true; });
    },
    hide() {
      if (!isOpen) return;
      isOpen = false;
      hideTip();
      hover = null;
      rasters.detail = null; // the big per-view raster is cheap to redo; keep memory low while closed
      if (!travel.hidden) { travel.hidden = true; app.hostTravelBar(null); }
    },
    onEscape() {
      if (panel.body.classList.contains('is-places')) { togglePlaces(false); return true; }
      if (vp.classList.contains('is-key') && isPhone()) { toggleKey(false); return true; }
      return false;
    },
    /** a place chosen in the search while the map is open: select it here */
    selectPlace(id) { if (!model) build(); select(id, { fly: true }); },
    tick(dt) {
      if (!isOpen || !W) return;
      const moving = view.step(dt);
      if (moving) { needBase = needDyn = true; lastChange = performance.now(); }
      if (!moving && detailStale() && performance.now() - lastChange > 140) { renderDetail(); needBase = true; }
      dynAcc += dt;
      if (needBase) drawBase();
      if (needDyn || moving || dynAcc >= 1 / DYN_HZ) { dynAcc = 0; drawDyn(); }
    },
    update() {
      if (!isOpen) return;
      if (computeActivity()) { needBase = true; places.update(); }
      card.update(false);
      syncTrip();
    },
  };
}

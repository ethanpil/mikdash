// Minimap discs (console §3.4.1): the beacon's 40 px disc and the header's 120 / 72 / 56 px disc. North up; the gold dot
// with its pulsing halo is "you", a cone shows the heading, the rim carries an N tick and a gold diamond toward the
// Kodesh HaKodashim; the current place is outlined in gold, activity within the radius shows as dots, a trip's route as
// a dashed line, and a storey badge tells another level. Radius by area: the Mount 140 m, the courts 60 m, rooms 30 m.
//
// One whole-Mount plan raster (map/plan.js, ≈ 0.5 m per px) is built in idle time once the boot has settled; each disc
// is a drawImage crop of it into a canvas 1.5× the disc, redrawn at ≤ 4 Hz, and moved by a CSS transform in between
// (≤ 15 Hz). No WebGL work; DOM writes only on change. All these canvases are software ones (willReadFrequently): an
// accelerated 2D canvas draws in the GPU process, where it competed with the first view's program links (it cost a
// 1.7 s frame on the medium boot); before the raster exists a disc draws nothing (its dark ground is CSS).
import { h, setText } from '../dom.js';
import { renderPlan } from '../map/plan.js';
import { w2m, AMAH } from '../../core/units.js';

const PAD = 300; // amot of plan around the Mount in the raster
const RASTER_MPP = 0.5; // metres per raster px

/** the shared plan raster: build() in idle time; ready once built */
export function createMinimapRaster(app) {
  const r = { ready: false, canvas: null, k: 0, x0: 0, y1: 0, building: false, subs: new Set() };
  r.build = () => {
    if (r.ready || r.building) return;
    r.building = true;
    const run = () => {
      try {
        const model = app.mapModel();
        const mb = model.get('har-habayit')?.main || [[0, 0], [500, 500]];
        const x0 = mb[0][0] - PAD, x1 = mb[1][0] + PAD, y0 = mb[0][1] - PAD, y1 = mb[1][1] + PAD;
        const k = AMAH / RASTER_MPP;
        const t0 = performance.now();
        r.canvas = renderPlan(app.ctx, model, { k, x0, y1, w: Math.ceil((x1 - x0) * k), h: Math.ceil((y1 - y0) * k), dpr: 1, cpu: true });
        Object.assign(r, { k, x0, y1, ready: true, ms: performance.now() - t0 });
        for (const f of r.subs) f();
      } catch (e) { console.error('[ui] minimap raster failed', e); }
      r.building = false;
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 4000 }); else setTimeout(run, 400);
  };
  r.onReady = (f) => { r.subs.add(f); return () => r.subs.delete(f); };
  return r;
}

const RADIUS = { wide: 140, courts: 60, room: 30 };

export function createMinimap(app, { size = 120, beacon = false } = {}) {
  const { ctx, data } = app;
  const raster = app.minimapRaster;
  const cv = h('canvas.mk-mini__map', { 'aria-hidden': 'true' });
  const g = cv.getContext('2d', { willReadFrequently: true });
  const cone = h('span.mk-mini__cone', { 'aria-hidden': 'true' });
  const khk = h('span.mk-mini__khk', { 'aria-hidden': 'true' }, h('i'));
  const storey = h('span.mk-mini__storey', { 'aria-hidden': 'true', hidden: true });
  const speed = beacon ? h('span.mk-mini__speed', { 'aria-hidden': 'true', hidden: true }) : null;
  const halo = h('span.mk-mini__halo'), dot = h('span.mk-mini__dot');
  const el = h(`span.mk-mini${beacon ? '.mk-mini--beacon' : ''}`, { 'aria-hidden': 'true' },
    h('span.mk-mini__clip', cv, cone),
    halo, dot,
    h('span.mk-mini__rim', h('i.mk-mini__n'), h('b.mk-mini__nl', 'N'), khk),
    storey, speed);

  let S = size, dpr = 1, Wc = 0;
  let R = 140, Rtarget = 140; // metres
  let drawn = null; // { X, Y, k, R } of the last full draw
  let mode = 'disc'; // 'disc' | 'overview'
  let need = true, slowAcc = 1, fastAcc = 1, lastTf = '', lastHd = '', lastKhk = '';
  let zoneId = null, zoneKey = '', actKey = '';
  const khkC = data.zoneCenter('kodesh-hakodashim');

  function setSize(px) {
    if (px === S && Wc) return;
    S = px;
    el.style.setProperty('--mk-mini', `${S}px`);
    resize();
  }
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    Wc = Math.round(S * 1.5);
    cv.width = Math.round(Wc * dpr);
    cv.height = Math.round(Wc * dpr);
    cv.style.width = cv.style.height = `${Wc}px`;
    cv.style.left = cv.style.top = `${-(Wc - S) / 2}px`;
    need = true;
  }
  el.style.setProperty('--mk-mini', `${S}px`);
  resize();
  raster?.onReady(() => { need = true; });

  function radiusFor(id) {
    if (!id || id === 'outside') return RADIUS.wide;
    const m = app.mapModel?.()?.get(id);
    if (!m) return RADIUS.wide;
    if (m.group === 'sanctuary' || m.group === 'chambers' || m.area < 2500) return RADIUS.room;
    if (m.group === 'en' || m.group === 'azarah' || id === 'chel' || id === 'soreg') return RADIUS.courts;
    return RADIUS.wide;
  }

  function site() {
    const p = ctx.player?.position;
    if (!p) return null;
    const s = w2m(p);
    return [s.X, s.Y, s.Z];
  }

  function draw(X, Y) {
    if (!raster?.ready) return; // (nothing to show yet: no canvas work during the boot)
    const k = S / 2 / (R / AMAH); // css px per amah
    const W = Wc;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#120d08';
    g.fillRect(0, 0, W, W);
    const T = { x: (x) => (x - X) * k + W / 2, y: (y) => W / 2 - (y - Y) * k };
    if (raster?.ready) {
      const rk = raster.k;
      const half = W / 2 / k; // amot
      const sx = (X - half - raster.x0) * rk, sy = (raster.y1 - (Y + half)) * rk, sw = 2 * half * rk;
      g.imageSmoothingEnabled = true;
      g.drawImage(raster.canvas, sx, sy, sw, sw, 0, 0, W, W);
    }
    // night: a cool tint so the gold dot stays the brightest thing
    const sunAlt = ctx.time?.sun?.altitude;
    if (Number.isFinite(sunAlt) && sunAlt < -2) { g.fillStyle = 'rgba(16,24,48,0.32)'; g.fillRect(0, 0, W, W); }
    // the current place, outlined in gold
    const z = zoneId && zoneId !== 'outside' ? app.mapModel?.()?.get(zoneId) : null;
    if (z && z.area < 1e6) {
      g.beginPath();
      for (const b of z.boxes) g.rect(T.x(b[0][0]), T.y(b[1][1]), (b[1][0] - b[0][0]) * k, (b[1][1] - b[0][1]) * k);
      g.lineWidth = beacon ? 1.2 : 1.6;
      g.strokeStyle = 'rgba(242,211,138,0.85)';
      g.stroke();
    }
    // the route of a trip
    const route = app.travel?.routeSite?.();
    if (route?.length > 1) {
      g.save();
      g.setLineDash([4, 3]);
      g.lineWidth = beacon ? 1.4 : 2;
      g.strokeStyle = '#f2d38a';
      g.beginPath();
      route.forEach(([x, y], i) => (i ? g.lineTo(T.x(x), T.y(y)) : g.moveTo(T.x(x), T.y(y))));
      g.stroke();
      g.restore();
    }
    // activity within the radius
    if (!beacon || S >= 40) {
      g.fillStyle = '#e2b85a';
      g.strokeStyle = 'rgba(10,8,5,0.8)';
      g.lineWidth = 1;
      const rr = (R / AMAH) * 1.5;
      for (const p of activity) {
        if (Math.hypot(p[0] - X, p[1] - Y) > rr) continue;
        g.beginPath(); g.arc(T.x(p[0]), T.y(p[1]), beacon ? 2 : 3, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    }
    drawn = { X, Y, k, R };
  }

  /** the whole Mount with the map's visible rectangle (the Map section's header) */
  function drawOverview() {
    if (!raster?.ready) return;
    const W = Wc;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, W);
    g.fillStyle = '#120d08';
    g.fillRect(0, 0, W, W);
    const mb = app.mapModel?.()?.get('har-habayit')?.main || [[0, 0], [500, 500]];
    const span = Math.max(mb[1][0] - mb[0][0], mb[1][1] - mb[0][1]) + 40;
    const k = S / span;
    const X = (mb[0][0] + mb[1][0]) / 2, Y = (mb[0][1] + mb[1][1]) / 2;
    const T = { x: (x) => (x - X) * k + W / 2, y: (y) => W / 2 - (y - Y) * k };
    if (raster?.ready) {
      const half = W / 2 / k, rk = raster.k;
      g.drawImage(raster.canvas, (X - half - raster.x0) * rk, (raster.y1 - (Y + half)) * rk, 2 * half * rk, 2 * half * rk, 0, 0, W, W);
    }
    const v = app.mapViewRect?.();
    if (v) {
      g.lineWidth = 1.5;
      g.strokeStyle = '#f2d38a';
      g.strokeRect(T.x(v[0][0]), T.y(v[1][1]), (v[1][0] - v[0][0]) * k, (v[1][1] - v[0][1]) * k);
    }
    // the gold dot and its halo stay "you": moved (by transform) to your spot on the Mount, kept inside the disc
    const s = site();
    if (s) {
      let dx = T.x(s[0]) - W / 2, dy = T.y(s[1]) - W / 2;
      const d = Math.hypot(dx, dy), max = S / 2 - 5;
      if (d > max) { dx *= max / d; dy *= max / d; }
      setDotTf(`translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`);
    }
    drawn = null;
    setTf('');
  }
  let lastDotTf = '';
  function setDotTf(tf) { if (tf !== lastDotTf) { lastDotTf = tf; dot.style.transform = tf; halo.style.transform = tf; } }

  let activity = [];
  function refreshActivity() {
    const list = data.active(ctx.time?.t);
    const pts = [];
    for (const ev of list) { const p = data.eventPos(ev); if (p) pts.push(p); }
    const key = pts.map((p) => `${p[0] | 0},${p[1] | 0}`).join(';');
    if (key !== actKey) { actKey = key; activity = pts; need = true; }
  }

  function setTf(tf) { if (tf !== lastTf) { lastTf = tf; cv.style.transform = tf; } }

  /** dt seconds; call every frame while visible */
  function tick(dt) {
    fastAcc += dt;
    slowAcc += dt;
    if (fastAcc < 1 / 15) return;
    const fdt = fastAcc;
    fastAcc = 0;
    const s = site();
    // heading cone and the diamond toward the Kodesh HaKodashim
    const hd = ctx.player?.heading;
    if (Number.isFinite(hd)) {
      const v = `rotate(${hd.toFixed(1)}deg)`;
      if (v !== lastHd) { lastHd = v; cone.style.transform = v; }
    }
    if (khkC && s) {
      const b = (Math.atan2(khkC[0] - s[0], khkC[1] - s[1]) * 180) / Math.PI;
      const v = `rotate(${b.toFixed(1)}deg)`;
      if (v !== lastKhk) { lastKhk = v; khk.style.transform = v; }
      khk.hidden = Math.hypot(khkC[0] - s[0], khkC[1] - s[1]) < 8; // inside it: no direction
    }
    if (speed) {
      const tm = ctx.time;
      const txt = tm?.paused ? '❚❚' : tm && tm.speed !== 1 ? `${tm.speed}×` : '';
      if (speed.textContent !== txt) { setText(speed, txt); speed.hidden = !txt; }
    }
    if (mode === 'overview') {
      if (slowAcc >= 0.25) { slowAcc = 0; drawOverview(); }
      return;
    }
    if (!s) return;
    // radius eases over ~400 ms
    if (Math.abs(R - Rtarget) > 0.2) { R += (Rtarget - R) * Math.min(1, fdt / 0.13); need = true; } else if (R !== Rtarget) { R = Rtarget; need = true; }
    const slow = slowAcc >= 0.25;
    if (slow) {
      slowAcc = 0;
      const id = data.currentZoneId();
      if (id !== zoneId) {
        zoneId = id;
        Rtarget = radiusFor(id);
        const lvl = app.mapModel?.()?.get(id)?.level;
        const tag = lvl && lvl !== 'ground' ? { upper: 'Upper', roof: 'Roof', below: 'Below' }[lvl] : '';
        if (storey.textContent !== tag) { setText(storey, tag); storey.hidden = !tag; }
        need = true;
      }
      refreshActivity();
      const rk = app.travel?.routeKey?.() || '';
      if (rk !== zoneKey) { zoneKey = rk; need = true; }
      if (rk) need = true; // the route shortens as you walk
    }
    if (drawn) {
      const dx = (s[0] - drawn.X) * drawn.k, dy = (s[1] - drawn.Y) * drawn.k;
      if (Math.hypot(dx, dy) > S * 0.125) need = true; // a quarter of the radius
      if (!need || !slow) { setTf(`translate(${(-dx).toFixed(1)}px, ${dy.toFixed(1)}px)`); if (!need) return; if (!slow) return; }
    }
    if (need && (slow || !drawn)) {
      need = false;
      draw(s[0], s[1]);
      setTf('');
    }
  }

  return {
    el,
    tick,
    setSize,
    setMode(m) { if (m !== mode) { mode = m; need = true; slowAcc = 1; el.classList.toggle('is-overview', m === 'overview'); if (m !== 'overview') setDotTf(''); } },
    invalidate() { need = true; slowAcc = 1; },
    get size() { return S; },
  };
}

// MAP panel: a plan drawn from ctx.site (element boxes, zone boxes, the soreg path, stair and stoa params) — never
// from the sample diagrams. The static plan is rendered once per view/size into an offscreen canvas; only the player
// arrow and the event markers are redrawn (≤ 15 fps, and only while the panel is open).
import { h, he, setText } from './dom.js';
import { createPanel } from './panel.js';
import { w2m, AMAH } from '../core/units.js';

const VIEWS = {
  mount: { label: 'Mount', c: [250, 252], span: 560 },
  courts: { label: 'Courts', c: [232, 330.5], span: 370 },
  sanctuary: { label: 'Sanctuary', c: [172, 330.5], span: 176 },
};
const GOTO = ['har-habayit', 'chel', 'ezrat-nashim', 'fifteen-steps', 'nikanor', 'ezrat-yisrael', 'ezrat-kohanim', 'mizbeach',
  'slaughter-zone', 'bein-haulam-lamizbeach', 'ulam', 'heichal', 'gazit', 'beit-hamoked'];

/**
 * Plan labels per view: zone id (ctx.site.zones), f = fractions within its first box ([0.5, 0.5] = centre),
 * d = offset in amot for labels set beside their place, rot = radians, fs = font size (px at 340 px).
 */
const LABELS = {
  mount: [
    { text: 'Har HaBayit', zone: 'har-habayit', d: [0, -112], fs: 13.5 },
    { text: 'Ezrat Nashim', zone: 'ezrat-nashim', f: [0.5, 0.27], fs: 12 },
    { text: 'Azarah', zone: 'azarah', f: [0.82, 0.06], fs: 11.5 },
    { text: 'Heichal', zone: 'heichal', fs: 11.5 },
    { text: 'Chel', zone: 'chel', f: [1, 1], d: [20, -3], fs: 11 },
  ],
  courts: [
    { text: 'Ezrat Nashim', zone: 'ezrat-nashim', f: [0.5, 0.25], fs: 14 },
    { text: 'Heichal', zone: 'heichal', f: [0.33, 1], d: [0, 21.5], fs: 13 },
    { text: 'Mizbeach', zone: 'mizbeach', f: [0.5, 0], d: [0, -7.5], fs: 12 },
    { text: 'Gazit', zone: 'gazit', fs: 11.5 },
    { text: 'Beit HaMoked', zone: 'beit-hamoked', f: [0.5, 1], d: [0, 7], fs: 11.5 },
    { text: 'Nikanor', zone: 'nikanor', f: [0.5, 0], d: [5.5, -9.5], fs: 11.5 },
    { text: 'Chel', zone: 'chel', f: [0.69, 0], d: [0, 4], fs: 11.5 },
    { text: 'Ezrat Yisrael', zone: 'ezrat-yisrael', f: [0.5, 0.75], rot: -Math.PI / 2, fs: 10 },
  ],
  sanctuary: [
    { text: 'Kodesh', zone: 'heichal', fs: 14 },
    { text: 'Kodesh\nHaKodashim', zone: 'kodesh-hakodashim', fs: 10.5 },
    { text: 'Ulam', zone: 'ulam', f: [0.5, 0.16], fs: 13 },
    { text: 'Mizbeach', zone: 'mizbeach', f: [0.5, 1], d: [0, 6.5], fs: 12.5 },
    { text: 'Ta\'im', zone: 'taim', fs: 11.5 },
    { text: 'Kiyor', zone: 'kiyor', f: [0.5, 0], d: [0, -4], fs: 11 },
  ],
};

const FLOOR_FILL =(z) => (z >= 21 ? 'rgba(232,206,152,0.30)' : z >= 13 ? 'rgba(226,201,150,0.23)' : z >= 5 ? 'rgba(214,190,145,0.17)' : 'rgba(201,180,138,0.10)');
const WALL = 'rgba(228,210,170,0.82)';
const GOLD = '#d4a640';

export function createMapPanel(app) {
  const { ctx, data } = app;
  const panel = createPanel(app, { name: 'map', title: 'Plan', heTitle: 'תבנית', side: 'card' });
  const canvas = h('canvas.mk-map__canvas', { role: 'img', 'aria-label': 'Plan of Har HaBayit and the Temple. Click a point to walk there.' });
  const tip = h('div.mk-map__tip', { 'aria-hidden': 'true' });
  const wrap = h('div.mk-map__canvaswrap', canvas, tip);
  let viewKey = 'mount';
  try { viewKey = localStorage.getItem('mikdash.mapView') || 'mount'; } catch { /* ignore */ }
  if (!VIEWS[viewKey]) viewKey = 'mount';
  const seg = h('div.mk-seg', { role: 'group', 'aria-label': 'Map extent' }, Object.entries(VIEWS).map(([k, v]) => h('button', {
    type: 'button', 'data-view': k, 'aria-pressed': k === viewKey ? 'true' : 'false', on: { click: () => setView(k) },
  }, v.label)));
  const scaleEl = h('span.mk-map__scale.num');
  const goSel = h('select.mk-select', { 'aria-label': 'Walk to a place' }, h('option', { value: '' }, 'Walk to…'));
  for (const id of GOTO) goSel.append(h('option', { value: id }, data.zone(id)?.name?.en || id));
  goSel.addEventListener('change', () => {
    const id = goSel.value;
    goSel.value = '';
    if (!id) return;
    const z = data.zone(id);
    const p = data.point(z?.stand) || data.zoneCenter(id);
    if (p) app.goTo({ at: [p[0], p[1]] }, z?.name?.en || id, { keepMap: true });
  });
  panel.body.style.padding = '0';
  wrap.append(scaleEl);
  const head = panel.el.querySelector('.mk-panel__head');
  head.insertBefore(goSel, head.lastChild);
  panel.body.append(wrap, h('div.mk-map__bar', seg));

  // ---------------- static plan ----------------
  const plans = new Map();
  let W = 0, dpr = 1;
  function view() { return VIEWS[viewKey]; }
  function tf(v, size) {
    const k = size / v.span;
    const x0 = v.c[0] - v.span / 2, y1 = v.c[1] + v.span / 2;
    return { k, x: (X) => (X - x0) * k, y: (Y) => (y1 - Y) * k, X: (px) => px / k + x0, Y: (py) => y1 - py / k };
  }

  function drawPlan(v, size) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.round(size * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const T = tf(v, size);
    const rect = (b, fill, stroke, lw = 1) => {
      const x = T.x(b.min[0]), y = T.y(b.max[1]), w = (b.max[0] - b.min[0]) * T.k, hh = (b.max[1] - b.min[1]) * T.k;
      if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, hh); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(x + 0.5 * lw, y + 0.5 * lw, Math.max(0, w - lw), Math.max(0, hh - lw)); }
    };
    const box = (mn, mx) => ({ min: mn, max: mx });

    // ground + 50-amah grid
    const bg = g.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.75);
    bg.addColorStop(0, '#1a140d'); bg.addColorStop(1, '#0c0906');
    g.fillStyle = bg; g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(241,232,212,0.035)'; g.lineWidth = 1;
    for (let X = -1000; X <= 1500; X += 50) { const x = Math.round(T.x(X)) + 0.5; if (x > 0 && x < size) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, size); g.stroke(); } }
    for (let Y = -1000; Y <= 1500; Y += 50) { const y = Math.round(T.y(Y)) + 0.5; if (y > 0 && y < size) { g.beginPath(); g.moveTo(0, y); g.lineTo(size, y); g.stroke(); } }

    const els = Object.values(ctx.site?.elements || {});
    const byId = (id) => ctx.site?.elements?.[id];
    const level = (e) => e.box && e.box.max[2] >= -1 && e.box.min[2] <= 30;

    // causeway, floors, stoas, chel
    const cw = byId('context.parah-causeway');
    if (cw?.box) rect(cw.box, 'rgba(201,180,138,0.10)', 'rgba(228,210,170,0.25)');
    const floors = els.filter((e) => e.kind === 'floor' && e.box).sort((a, b) => a.box.max[2] - b.box.max[2]);
    for (const e of floors) rect(e.box, FLOOR_FILL(e.box.max[2]));
    for (const zb of ctx.site?.zones?.chel?.boxes || []) rect(box(zb[0], zb[1]), 'rgba(212,166,64,0.045)');
    for (const e of els.filter((x) => x.id.startsWith('mount.stoa.') && x.box)) {
      rect(e.box, 'rgba(0,0,0,0.22)');
      const p = e.params || {};
      const along = p.along || (e.box.max[0] - e.box.min[0] > e.box.max[1] - e.box.min[1] ? 'X' : 'Y');
      if (T.k * (p.bay || 10) < 4) continue;
      g.fillStyle = 'rgba(241,232,212,0.5)';
      for (const off of p.columnRowsFromWall || []) {
        // the rows run parallel to the outer wall; the wall side is the box side on the Mount's edge
        const b = e.box;
        let fixed;
        if (along === 'X') fixed = b.min[1] <= 0.5 ? b.min[1] + off : b.max[1] - off;
        else fixed = b.min[0] <= 0.5 ? b.min[0] + off : b.max[0] - off;
        const a0 = along === 'X' ? b.min[0] : b.min[1], a1 = along === 'X' ? b.max[0] : b.max[1];
        for (let a = a0 + (p.bay || 10); a < a1; a += p.bay || 10) {
          if ((p.gateGaps || []).some(([s, t]) => a > s - 1 && a < t + 1)) continue;
          const X = along === 'X' ? a : fixed, Y = along === 'X' ? fixed : a;
          g.beginPath(); g.arc(T.x(X), T.y(Y), Math.max(0.8, 0.9 * T.k), 0, Math.PI * 2); g.fill();
        }
      }
    }
    // heichal podium, courts' special strips, sanctuary rooms
    const otem = byId('heichal.otem');
    if (otem?.box) rect(otem.box, 'rgba(232,206,152,0.16)', 'rgba(228,210,170,0.35)');
    const ek = byId('azarah.ezrat-kohanim');
    if (ek?.box) rect(ek.box, 'rgba(226,201,150,0.08)');
    for (const [id, fill] of [['heichal.ulam', 'rgba(212,166,64,0.10)'], ['heichal.kodesh', 'rgba(212,166,64,0.22)'], ['heichal.amah-traksin', 'rgba(212,166,64,0.35)'], ['heichal.khk', 'rgba(212,166,64,0.42)']]) {
      const e = byId(id);
      if (e?.box) rect(e.box, fill);
    }
    // soreg (lattice fence) from its path
    const soreg = byId('mount.soreg');
    if (soreg?.params?.path?.length) {
      g.save();
      g.setLineDash([Math.max(2, 1.6 * T.k), Math.max(2, 1.6 * T.k)]);
      g.strokeStyle = 'rgba(212,166,64,0.7)'; g.lineWidth = Math.max(1, 0.5 * T.k);
      g.beginPath();
      soreg.params.path.forEach(([X, Y], i) => (i ? g.lineTo(T.x(X), T.y(Y)) : g.moveTo(T.x(X), T.y(Y))));
      if (soreg.params.closed) g.closePath();
      g.stroke();
      g.restore();
    }
    // chambers
    for (const e of els) {
      if (e.kind !== 'chamber' || !e.box || !level(e) || e.box.min[2] >= 22.5 && !e.id.startsWith('heichal.taim')) continue;
      rect(e.box, 'rgba(160,140,108,0.32)', 'rgba(228,210,170,0.55)', 1);
    }
    // stairs and ramps
    for (const e of els) {
      if (!e.box || !level(e)) continue;
      if (e.kind === 'ramp' && !e.id.startsWith('context.')) {
        rect(e.box, 'rgba(214,190,145,0.28)', 'rgba(228,210,170,0.6)');
      } else if (e.kind === 'stair') {
        const p = e.params || {};
        if (p.form === 'semicircle-east' && p.center) {
          g.strokeStyle = 'rgba(241,232,212,0.5)'; g.lineWidth = 1;
          const radii = (p.stepRadii || []).map((s) => s.rOuter);
          for (const rr of radii.length ? radii : [p.outerRadius || 10]) {
            g.beginPath(); g.arc(T.x(p.center[0]), T.y(p.center[1]), rr * T.k, -Math.PI / 2, Math.PI / 2); g.stroke();
          }
          continue;
        }
        if (p.form === 'spiral') continue;
        rect(e.box, 'rgba(214,190,145,0.16)');
        const b = e.box, n = Math.min(p.steps || 8, Math.max(2, Math.round(Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) * T.k / 2.5)));
        const ew = p.ascentHeading === 90 || p.ascentHeading === 270;
        g.strokeStyle = 'rgba(241,232,212,0.45)'; g.lineWidth = 1;
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const f = i / n;
          if (ew) { const X = b.min[0] + (b.max[0] - b.min[0]) * f; g.moveTo(T.x(X), T.y(b.min[1])); g.lineTo(T.x(X), T.y(b.max[1])); }
          else { const Y = b.min[1] + (b.max[1] - b.min[1]) * f; g.moveTo(T.x(b.min[0]), T.y(Y)); g.lineTo(T.x(b.max[0]), T.y(Y)); }
        }
        g.stroke();
      }
    }
    // altar, rings, kiyor
    const yesod = byId('altar.yesod'), top = byId('altar.top');
    if (yesod?.box) rect(yesod.box, 'rgba(196,152,100,0.55)', 'rgba(240,215,170,0.75)');
    if (top?.box) {
      rect(top.box, 'rgba(120,88,55,0.55)', 'rgba(240,215,170,0.55)');
      const cx = T.x((top.box.min[0] + top.box.max[0]) / 2), cy = T.y((top.box.min[1] + top.box.max[1]) / 2);
      const fr = Math.max(3, 6 * T.k);
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, fr);
      glow.addColorStop(0, 'rgba(255,170,80,0.8)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, fr, 0, Math.PI * 2); g.fill();
    }
    const rings = byId('altar.rings');
    if (rings?.params?.positions && T.k > 0.9) {
      g.fillStyle = 'rgba(241,232,212,0.65)';
      for (const [X, Y] of rings.params.positions) { g.beginPath(); g.arc(T.x(X), T.y(Y), Math.max(0.8, 0.5 * T.k), 0, Math.PI * 2); g.fill(); }
    }
    for (const id of ['altar.marble-tables', 'altar.nanasin', 'heichal.ulam.tables']) { const e = byId(id); if (e?.box && T.k > 0.9) rect(e.box, null, 'rgba(228,210,170,0.4)'); }
    const kiyor = byId('altar.kiyor');
    if (kiyor?.box) {
      const b = kiyor.box;
      g.fillStyle = 'rgba(180,140,90,0.85)';
      g.beginPath(); g.arc(T.x((b.min[0] + b.max[0]) / 2), T.y((b.min[1] + b.max[1]) / 2), Math.max(2, ((b.max[0] - b.min[0]) / 2) * T.k), 0, Math.PI * 2); g.fill();
    }
    // walls, then gates on top
    for (const e of els) {
      if (e.kind !== 'wall' || !e.box || !level(e) || e.id === 'mount.soreg' || e.box.min[2] >= 30) continue;
      rect(e.box, WALL);
    }
    for (const e of els) {
      if (e.kind !== 'gate' || !e.box) continue;
      rect(e.box, GOLD);
    }
    // inner furnishings of the Heichal (sanctuary view)
    if (T.k > 2) for (const id of ['heichal.menorah', 'heichal.shulchan', 'heichal.mizbach-hazahav', 'heichal.even-shetiyah']) { const e = byId(id); if (e?.box) rect(e.box, 'rgba(242,211,138,0.9)'); }
    for (const id of ['heichal.parochet.outer', 'heichal.parochet.inner']) { const e = byId(id); if (e?.box && T.k > 1.2) rect(e.box, 'rgba(150,60,70,0.9)'); }

    // labels: anchored to the zones of ctx.site (a point within the zone's first box, as fractions of it, plus an
    // optional offset in amot for a label set beside its place), then kept inside the canvas
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const L of LABELS[viewKey]) {
      const b = ctx.site?.zones?.[L.zone]?.boxes?.[0];
      if (!b) continue;
      const f = L.f || [0.5, 0.5], d = L.d || [0, 0];
      const X = b[0][0] + (b[1][0] - b[0][0]) * f[0] + d[0];
      const Y = b[0][1] + (b[1][1] - b[0][1]) * f[1] + d[1];
      const fs = L.fs * Math.min(1.25, Math.max(0.9, size / 340));
      g.font = `italic 500 ${fs}px 'Cormorant Garamond', 'EB Garamond', Georgia, serif`;
      g.lineWidth = 3; g.strokeStyle = 'rgba(12,9,6,0.85)'; g.fillStyle = 'rgba(241,232,212,0.9)';
      const lines = L.text.split('\n');
      const w = Math.max(...lines.map((ln) => g.measureText(ln).width)), hh = lines.length * fs * 1.05;
      // rotated labels run along a narrow strip (e.g. Ezrat Yisrael, 11 amot wide)
      const [ew, eh] = L.rot ? [hh, w] : [w, hh];
      const x = Math.max(ew / 2 + 3, Math.min(size - ew / 2 - 3, T.x(X)));
      const y = Math.max(eh / 2 + 3, Math.min(size - eh / 2 - 3, T.y(Y)));
      g.save();
      g.translate(x, y);
      if (L.rot) g.rotate(L.rot);
      lines.forEach((ln, i) => {
        const ly = (i - (lines.length - 1) / 2) * fs * 1.05;
        g.strokeText(ln, 0, ly);
        g.fillText(ln, 0, ly);
      });
      g.restore();
    }
    // north arrow
    g.save();
    g.translate(18, 22);
    g.fillStyle = 'rgba(241,232,212,0.85)';
    g.beginPath(); g.moveTo(0, -11); g.lineTo(5, 3); g.lineTo(0, 0); g.lineTo(-5, 3); g.closePath(); g.fill();
    g.font = "600 10px 'EB Garamond', Georgia, serif"; g.fillText('N', 0, 12);
    g.restore();
    return c;
  }

  function plan() {
    const key = `${viewKey}|${W}|${dpr}`;
    if (!plans.has(key)) plans.set(key, drawPlan(view(), W));
    return plans.get(key);
  }

  function setView(k) {
    viewKey = k;
    try { localStorage.setItem('mikdash.mapView', k); } catch { /* ignore */ }
    for (const b of seg.children) b.setAttribute('aria-pressed', b.dataset.view === k ? 'true' : 'false');
    setText(scaleEl, `grid: 50 amot ≈ ${Math.round(50 * AMAH)} m`);
    draw(true);
  }

  // ---------------- dynamic layer ----------------
  let t0 = performance.now();
  function draw() {
    const w = wrap.clientWidth;
    if (!w) return;
    const ndpr = Math.min(2, devicePixelRatio || 1);
    if (w !== W || ndpr !== dpr) {
      W = w; dpr = ndpr;
      canvas.width = canvas.height = Math.round(W * dpr);
      plans.clear();
    }
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(plan(), 0, 0);
    g.scale(dpr, dpr);
    const T = tf(view(), W);
    const now = (performance.now() - t0) / 1000;

    // active events
    for (const ev of data.active()) {
      const p = data.eventPos(ev);
      if (!p) continue;
      const x = T.x(p[0]), y = T.y(p[1]);
      const ph = app.reducedMotion() ? 0.4 : (now * 0.6) % 1;
      g.strokeStyle = `rgba(242,211,138,${(1 - ph) * 0.9})`;
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y, 4 + ph * 12, 0, Math.PI * 2); g.stroke();
      g.fillStyle = GOLD;
      g.beginPath(); g.arc(x, y, (ev.importance || 1) >= 3 ? 4 : 3, 0, Math.PI * 2); g.fill();
    }
    // player
    const pos = ctx.player?.position;
    if (pos) {
      const s = w2m(pos);
      const x = T.x(s.X), y = T.y(s.Y);
      const hd = ((ctx.player.heading || 0) * Math.PI) / 180;
      const cam = ctx.camera;
      const hfov = cam ? 2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * cam.aspect) : 1.6;
      g.save();
      g.translate(x, y);
      g.rotate(hd);
      const cone = g.createRadialGradient(0, 0, 0, 0, 0, 46);
      cone.addColorStop(0, 'rgba(242,211,138,0.35)'); cone.addColorStop(1, 'rgba(242,211,138,0)');
      g.fillStyle = cone;
      g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 46, -Math.PI / 2 - hfov / 2, -Math.PI / 2 + hfov / 2); g.closePath(); g.fill();
      g.fillStyle = '#f2d38a'; g.strokeStyle = '#1a140d'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }

  // ---------------- interaction ----------------
  function siteAt(e) {
    const r = canvas.getBoundingClientRect();
    const T = tf(view(), r.width);
    return { X: T.X(e.clientX - r.left), Y: T.Y(e.clientY - r.top), px: e.clientX - r.left, py: e.clientY - r.top, w: r.width };
  }
  canvas.addEventListener('pointermove', (e) => {
    const p = siteAt(e);
    const id = data.zoneAt2D(p.X, p.Y);
    const z = id ? data.zone(id) : null;
    tip.replaceChildren(z?.name?.en || 'Outside the Mount', z?.name?.he ? he(z.name.he) : '');
    const tw = tip.offsetWidth || 150;
    tip.style.transform = `translate(${Math.max(4, Math.min(p.px + 12, p.w - tw - 6))}px, ${Math.max(4, p.py - 34)}px)`;
    tip.classList.add('in');
  });
  canvas.addEventListener('pointerleave', () => tip.classList.remove('in'));
  canvas.addEventListener('click', (e) => {
    const p = siteAt(e);
    const id = data.zoneAt2D(p.X, p.Y);
    const label = id ? data.zone(id)?.name?.en : 'that spot';
    app.goTo({ at: [Math.round(p.X * 10) / 10, Math.round(p.Y * 10) / 10] }, label, { keepMap: true });
  });
  if (document.fonts?.ready) document.fonts.ready.then(() => { plans.clear(); });
  setView(viewKey);

  let acc = 0;
  return {
    ...panel,
    onOpen() { requestAnimationFrame(() => draw()); },
    tick(dt) { acc += dt; if (acc < 1 / 15) return; acc = 0; draw(); },
  };
}

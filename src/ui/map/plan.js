// Static plan raster, drawn only from ctx.site (element boxes by kind and elevation, zone boxes, the soreg path,
// stair and stoa params) — never from the sample diagrams. One call renders the plan for a site rectangle at a scale
// into a transparent canvas; mappanel.js caches a few such rasters (overview, Mount, current view) and composites them.

const FLOOR_FILL = (z) => (z >= 21 ? 'rgba(232,206,152,0.30)' : z >= 13 ? 'rgba(226,201,150,0.23)' : z >= 5 ? 'rgba(214,190,145,0.17)' : 'rgba(201,180,138,0.10)');
const WALL = 'rgba(228,210,170,0.82)';
const GOLD = '#d4a640';

/**
 * opts: { k (css px per amah), x0, y1 (site coords of the raster's top-left), w, h (css px), dpr, cpu }
 * returns a canvas of w*dpr × h*dpr device pixels. cpu: a software canvas (willReadFrequently), for rasters only ever
 * copied into other software canvases (the minimap discs): no GPU-process work at all
 */
export function renderPlan(ctx, model, { k, x0, y1, w, h, dpr = 1, cpu = false }) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * dpr));
  c.height = Math.max(1, Math.round(h * dpr));
  const g = c.getContext('2d', cpu ? { willReadFrequently: true } : undefined);
  g.scale(dpr, dpr);
  const T = { k, x: (X) => (X - x0) * k, y: (Y) => (y1 - Y) * k };
  const X1 = x0 + w / k, Y0 = y1 - h / k;
  const vis = (b) => b && b.max[0] >= x0 && b.min[0] <= X1 && b.max[1] >= Y0 && b.min[1] <= y1;
  const visZ = (bx) => bx[1][0] >= x0 && bx[0][0] <= X1 && bx[1][1] >= Y0 && bx[0][1] <= y1;
  const rect = (b, fill, stroke, lw = 1) => {
    if (!vis(b)) return;
    const x = T.x(b.min[0]), y = T.y(b.max[1]), ww = (b.max[0] - b.min[0]) * k, hh = (b.max[1] - b.min[1]) * k;
    if (fill) { g.fillStyle = fill; g.fillRect(x, y, ww, hh); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.strokeRect(x + 0.5 * lw, y + 0.5 * lw, Math.max(0, ww - lw), Math.max(0, hh - lw)); }
  };
  const box = (mn, mx) => ({ min: mn, max: mx });
  const site = ctx.site || {};
  const els = Object.values(site.elements || {});
  const byId = (id) => site.elements?.[id];
  const level = (e) => e.box && e.box.max[2] >= -1 && e.box.min[2] <= 30;

  // ---- context: the Kidron valley and Har HaMishchah (zone boxes), the causeway over the valley ----
  const zbox = (id) => model.get(id)?.main;
  const kid = zbox('kidron'), olv = zbox('har-hamishchah');
  if (kid && visZ(kid)) {
    const x = T.x(kid[0][0]), xx = T.x(kid[1][0]);
    const gr = g.createLinearGradient(x, 0, xx, 0);
    gr.addColorStop(0, 'rgba(0,0,0,0.05)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0.08)');
    g.fillStyle = gr;
    g.fillRect(x, T.y(kid[1][1]), xx - x, (kid[1][1] - kid[0][1]) * k);
  }
  if (olv && visZ(olv)) {
    const x = T.x(olv[0][0]), xx = T.x(olv[1][0]);
    const gr = g.createLinearGradient(x, 0, xx, 0);
    gr.addColorStop(0, 'rgba(201,180,138,0.03)'); gr.addColorStop(0.45, 'rgba(201,180,138,0.085)'); gr.addColorStop(1, 'rgba(201,180,138,0.03)');
    g.fillStyle = gr;
    g.fillRect(x, T.y(olv[1][1]), xx - x, (olv[1][1] - olv[0][1]) * k);
  }

  // ---- grid: 100 amot far out, 50 on the Mount, 10 more when close ----
  const grid = (step, a) => {
    g.strokeStyle = `rgba(241,232,212,${a})`; g.lineWidth = 1;
    g.beginPath();
    for (let X = Math.ceil(x0 / step) * step; X <= X1; X += step) { const x = Math.round(T.x(X)) + 0.5; g.moveTo(x, 0); g.lineTo(x, h); }
    for (let Y = Math.ceil(Y0 / step) * step; Y <= y1; Y += step) { const y = Math.round(T.y(Y)) + 0.5; g.moveTo(0, y); g.lineTo(w, y); }
    g.stroke();
  };
  if (k * 10 >= 9) grid(10, 0.022);
  grid(k < 0.8 ? 100 : 50, 0.04);

  // ---- causeway, floors, stoas, chel ----
  const cw = byId('context.parah-causeway');
  if (cw?.box) rect(cw.box, 'rgba(201,180,138,0.13)', 'rgba(228,210,170,0.3)');
  const pyre = byId('context.parah.pyre');
  if (pyre?.box && vis(pyre.box)) {
    const cx = T.x((pyre.box.min[0] + pyre.box.max[0]) / 2), cy = T.y((pyre.box.min[1] + pyre.box.max[1]) / 2);
    g.fillStyle = 'rgba(200,150,95,0.75)';
    g.beginPath(); g.arc(cx, cy, Math.max(2, 3 * k), 0, Math.PI * 2); g.fill();
  }
  const floors = els.filter((e) => e.kind === 'floor' && e.box).sort((a, b) => a.box.max[2] - b.box.max[2]);
  for (const e of floors) rect(e.box, FLOOR_FILL(e.box.max[2]));
  for (const zb of site.zones?.chel?.boxes || []) rect(box(zb[0], zb[1]), 'rgba(212,166,64,0.045)');
  for (const e of els) {
    if (!e.id.startsWith('mount.stoa.') || !e.box || !vis(e.box)) continue;
    rect(e.box, 'rgba(0,0,0,0.22)');
    const p = e.params || {};
    const along = p.along || (e.box.max[0] - e.box.min[0] > e.box.max[1] - e.box.min[1] ? 'X' : 'Y');
    const bay = p.bay || 10;
    if (k * bay < 4) continue;
    g.fillStyle = 'rgba(241,232,212,0.5)';
    const b = e.box;
    for (const off of p.columnRowsFromWall || []) {
      // the rows run parallel to the outer wall; the wall side is the box side on the Mount's edge
      const fixed = along === 'X' ? (b.min[1] <= 0.5 ? b.min[1] + off : b.max[1] - off) : (b.min[0] <= 0.5 ? b.min[0] + off : b.max[0] - off);
      const a0 = along === 'X' ? b.min[0] : b.min[1], a1 = along === 'X' ? b.max[0] : b.max[1];
      for (let a = a0 + bay; a < a1; a += bay) {
        if ((p.gateGaps || []).some(([s, t]) => a > s - 1 && a < t + 1)) continue;
        const X = along === 'X' ? a : fixed, Y = along === 'X' ? fixed : a;
        if (X < x0 - 2 || X > X1 + 2 || Y < Y0 - 2 || Y > y1 + 2) continue;
        g.beginPath(); g.arc(T.x(X), T.y(Y), Math.max(0.8, 0.9 * k), 0, Math.PI * 2); g.fill();
      }
    }
  }
  // ---- heichal podium, Ezrat Kohanim strip, sanctuary rooms ----
  const otem = byId('heichal.otem');
  if (otem?.box) rect(otem.box, 'rgba(232,206,152,0.16)', 'rgba(228,210,170,0.35)');
  const ek = byId('azarah.ezrat-kohanim');
  if (ek?.box) rect(ek.box, 'rgba(226,201,150,0.08)');
  for (const [id, fill] of [['heichal.ulam', 'rgba(212,166,64,0.10)'], ['heichal.kodesh', 'rgba(212,166,64,0.22)'], ['heichal.amah-traksin', 'rgba(212,166,64,0.35)'], ['heichal.khk', 'rgba(212,166,64,0.42)']]) {
    const e = byId(id);
    if (e?.box) rect(e.box, fill);
  }
  // ---- soreg (lattice fence) from its path ----
  const soreg = byId('mount.soreg');
  if (soreg?.params?.path?.length) {
    g.save();
    g.setLineDash([Math.max(2, 1.6 * k), Math.max(2, 1.6 * k)]);
    g.strokeStyle = 'rgba(212,166,64,0.7)'; g.lineWidth = Math.max(1, 0.5 * k);
    g.beginPath();
    soreg.params.path.forEach(([X, Y], i) => (i ? g.lineTo(T.x(X), T.y(Y)) : g.moveTo(T.x(X), T.y(Y))));
    if (soreg.params.closed) g.closePath();
    g.stroke();
    g.restore();
  }
  // ---- chambers ----
  for (const e of els) {
    if (e.kind !== 'chamber' || !e.box || !level(e) || (e.box.min[2] >= 22.5 && !e.id.startsWith('heichal.taim'))) continue;
    rect(e.box, 'rgba(160,140,108,0.32)', 'rgba(228,210,170,0.55)', 1);
  }
  // ---- stairs and ramps ----
  for (const e of els) {
    if (!e.box || !level(e) || !vis(e.box)) continue;
    if (e.kind === 'ramp' && !e.id.startsWith('context.')) {
      rect(e.box, 'rgba(214,190,145,0.28)', 'rgba(228,210,170,0.6)');
    } else if (e.kind === 'stair') {
      const p = e.params || {};
      if (p.form === 'semicircle-east' && p.center) {
        g.strokeStyle = 'rgba(241,232,212,0.5)'; g.lineWidth = 1;
        const radii = (p.stepRadii || []).map((s) => s.rOuter);
        for (const rr of radii.length ? radii : [p.outerRadius || 10]) {
          g.beginPath(); g.arc(T.x(p.center[0]), T.y(p.center[1]), rr * k, -Math.PI / 2, Math.PI / 2); g.stroke();
        }
        continue;
      }
      if (p.form === 'spiral') continue;
      rect(e.box, 'rgba(214,190,145,0.16)');
      const b = e.box, n = Math.min(p.steps || 8, Math.max(2, Math.round(Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1]) * k / 2.5)));
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
  // ---- altar, rings, kiyor ----
  const yesod = byId('altar.yesod'), top = byId('altar.top');
  if (yesod?.box) rect(yesod.box, 'rgba(196,152,100,0.55)', 'rgba(240,215,170,0.75)');
  if (top?.box && vis(top.box)) {
    rect(top.box, 'rgba(120,88,55,0.55)', 'rgba(240,215,170,0.55)');
    const cx = T.x((top.box.min[0] + top.box.max[0]) / 2), cy = T.y((top.box.min[1] + top.box.max[1]) / 2);
    const fr = Math.max(3, 6 * k);
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, fr);
    glow.addColorStop(0, 'rgba(255,170,80,0.8)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, fr, 0, Math.PI * 2); g.fill();
  }
  const rings = byId('altar.rings');
  if (rings?.params?.positions && k > 0.9) {
    g.fillStyle = 'rgba(241,232,212,0.65)';
    for (const [X, Y] of rings.params.positions) { g.beginPath(); g.arc(T.x(X), T.y(Y), Math.max(0.8, 0.5 * k), 0, Math.PI * 2); g.fill(); }
  }
  if (k > 0.9) for (const id of ['altar.marble-tables', 'altar.nanasin', 'heichal.ulam.tables']) { const e = byId(id); if (e?.box) rect(e.box, null, 'rgba(228,210,170,0.4)'); }
  const kiyor = byId('altar.kiyor');
  if (kiyor?.box && vis(kiyor.box)) {
    const b = kiyor.box;
    g.fillStyle = 'rgba(180,140,90,0.85)';
    g.beginPath(); g.arc(T.x((b.min[0] + b.max[0]) / 2), T.y((b.min[1] + b.max[1]) / 2), Math.max(2, ((b.max[0] - b.min[0]) / 2) * k), 0, Math.PI * 2); g.fill();
  }
  // ---- walls, then gates on top ----
  for (const e of els) {
    if (e.kind !== 'wall' || !e.box || !level(e) || e.id === 'mount.soreg' || e.box.min[2] >= 30) continue;
    rect(e.box, WALL);
  }
  for (const e of els) if (e.kind === 'gate' && e.box) rect(e.box, GOLD);
  // ---- furnishings of the Heichal (close up) ----
  if (k > 2) for (const id of ['heichal.menorah', 'heichal.shulchan', 'heichal.mizbach-hazahav', 'heichal.even-shetiyah']) { const e = byId(id); if (e?.box) rect(e.box, 'rgba(242,211,138,0.9)'); }
  for (const id of ['heichal.parochet.outer', 'heichal.parochet.inner']) { const e = byId(id); if (e?.box && k > 1.2) rect(e.box, 'rgba(150,60,70,0.9)'); }

  // ---- places on other storeys: dashed (above) / dotted (below) outlines, so the ground stays readable ----
  g.save();
  g.lineCap = 'round';
  for (const z of model.stacked) {
    // roofs and standless spaces (the Ulam above its ceiling) coincide with the building outlines beneath
    if (z.level === 'roof' || z.standless) continue;
    const below = z.level === 'below';
    g.setLineDash(below ? [0.1, 3.2] : [4.5, 3]);
    g.lineWidth = below ? 1.8 : 1.1;
    g.strokeStyle = below ? 'rgba(170,190,220,0.75)' : 'rgba(241,232,212,0.6)';
    for (const b of z.boxes) {
      if (!visZ(b)) continue;
      const ww = (b[1][0] - b[0][0]) * k, hh = (b[1][1] - b[0][1]) * k;
      if (Math.max(ww, hh) < 5) continue;
      g.strokeRect(T.x(b[0][0]) + 0.5, T.y(b[1][1]) + 0.5, Math.max(1, ww - 1), Math.max(1, hh - 1));
    }
  }
  g.restore();
  return c;
}

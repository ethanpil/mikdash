// Ground features that make the slopes read as Judean hills (all reconstruction — docs/decisions/build-mount.md):
//   * limestone ledges (karst steps lying along the contours) and boulders where the rock is exposed — one instanced
//     draw call of a single irregular rock, scaled long and flat for the ledges
//   * dry-stone terrace walls along the contours of Har HaMishchah's west face and the Kidron's west side (the
//     olive mount was farmed; terraces are how such slopes are farmed) — merged strips in the terrain batch; the
//     benches above them are returned so the olives can be planted in rows
//   * low field walls round garden plots along the Kidron bed (Yoma 58b: the Azarah's effluent was sold to the
//     gardeners) — the plots are returned for the garden trees
import { InstancedMesh, IcosahedronGeometry, Matrix4, Vector3, Quaternion, Float32BufferAttribute } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { rng, smooth } from '../mount/kit.js';
import { distToPolyline, rectDist, inRect } from './plan.js';

export function buildFeatures(ctx, T, kit, group, detail) {
  const A = AMAH, m = (v) => v / A;
  const { fp, plan } = T;
  const rand = rng((ctx.params?.seed ?? 5786) * 31 + 7);
  const corridors = [...plan.streets, plan.parahPath];
  const R = (ctx.quality?.drawDistance || 4000) / A;
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const blocked = (X, Y, pad = 3) => {
    for (const r of plan.keepOut) if (inRect(r, X, Y, m(pad))) return true;
    for (const f of plan.flats) if (rectDist(f.rect, X, Y) < m(pad + 2)) return true;
    for (const c of corridors) if (distToPolyline(c.pts, X, Y).d < c.half + m(pad)) return true;
    if (plan.districts.some((d) => inRect(d.rect, X, Y, m(8)))) return true;
    return Math.hypot(X - cx, Y - cy) > R * 0.9;
  };
  const terr = buildTerraces(ctx, T, kit, detail, blocked, rand);
  const plots = buildPlots(ctx, T, kit, detail, blocked, rand);
  const rocks = buildRocks(ctx, T, group, detail, blocked, rand, plots);
  return { rows: terr.rows, terraceSegs: terr.segs, plots, rocks };
}

// --------------------------------------------------------------------------------------------------------- terraces
function buildTerraces(ctx, T, kit, detail, blocked, rand) {
  const A = AMAH, m = (v) => v / A;
  const { fp, plan } = T;
  const tr = plan.terraces;
  const dy = m(detail >= 1 ? 4.5 : 9), dh = detail >= 1 ? 3.4 : 6.8, dxs = m(3);
  const y0 = fp.y0 - m(tr.yPad), y1 = fp.y1 + m(tr.yPad);
  const rows = [];
  let segs = 0;
  // two slopes: the west face of Har HaMishchah (rising east) and the Kidron's west side (rising west to the wall)
  const slopes = [
    { u0: tr.u0, u1: tr.u1, rising: 1 },
    { u0: tr.uw0, u1: tr.uw1, rising: -1 },
  ];
  for (const sl of slopes) {
    // one height profile per row, crossings for every level from it
    const Ys = [];
    for (let Y = y0; Y <= y1; Y += dy) Ys.push(Y);
    const prof = Ys.map((Y) => {
      const xa = fp.x1 + m(sl.u0), xb = fp.x1 + m(sl.u1);
      const pts = [];
      for (let X = xa; X <= xb; X += dxs) pts.push([X, T.sample(X, Y).h]);
      return pts;
    });
    let hMin = Infinity, hMax = -Infinity;
    for (const p of prof) for (const [, h] of p) { hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); }
    for (let hc = Math.ceil((hMin + 4) / dh) * dh; hc < hMax - 3; hc += dh) {
      let line = [];
      const flush = () => { if (line.length >= 3) rows.push({ pts: line, rising: sl.rising }); line = []; };
      Ys.forEach((Y, r) => {
        const p = prof[r];
        let X = null;
        // first crossing walking uphill
        const order = sl.rising > 0 ? p : [...p].reverse();
        for (let i = 0; i + 1 < order.length; i++) {
          const [xa, ha] = order[i], [xb, hb] = order[i + 1];
          if (ha < hc && hb >= hc) { X = xa + (xb - xa) * (hc - ha) / (hb - ha); break; }
        }
        // terraces come in patches (qa-r1-fix-world: fewer and shorter runs — long unbroken lines read as drawn strokes)
        const patch = T.noise.fbm(Y * A / 120 + hc * 0.07, hc * 0.13, 2) > -0.02;
        // qa-r1-fix-world: in a view cone only where the wall stays under the sight line (was: never in the cones)
        if (X == null || !patch || blocked(X, Y, 4) || plan.sightTop(X, Y, T.heightZ) < T.heightZ(X, Y) + m(1.3)) { flush(); return; }
        if (line.length && Math.abs(X - line[line.length - 1][0]) > 3 * dy) flush();
        line.push([X, Y]);
      });
      flush();
    }
  }
  // the walls: a battered face downhill, a top, a back into the bench ⚙ heights 0.6–1.2 m, the top ragged (each 4.5 m
  // piece its own height, slumped here and there); dry-stone field rubble (qa-r1-fix-world: the pale limestone key read
  // as white lines across the slope)
  const wallH = m(0.95), thick = m(0.6), bury = m(0.5);
  const KEY = ctx.mats?.has?.('house_rubble') ? 'house_rubble' : 'terrain_rock';
  for (const row of rows) {
    const P = row.pts;
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, ay] = P[i], [bx, by] = P[i + 1];
      const L = Math.hypot(bx - ax, by - ay) || 1;
      // downhill normal in plan: perpendicular to the segment, pointing toward lower ground
      let nx = (by - ay) / L, ny = -(bx - ax) / L;
      const za = T.heightZ(ax, ay), zb = T.heightZ(bx, by);
      const probe = T.heightZ((ax + bx) / 2 + nx * m(2), (ay + by) / 2 + ny * m(2));
      if (probe > (za + zb) / 2) { nx = -nx; ny = -ny; }
      if (rand() < 0.1) continue;                                  // a slumped gap
      const h = wallH * (0.7 + 0.5 * rand()) * (rand() < 0.15 ? 0.5 : 1);
      const ux = -nx * thick, uy = -ny * thick;                     // uphill offset of the wall's back
      const zab = T.heightZ(ax + ux, ay + uy), zbb = T.heightZ(bx + ux, by + uy);
      const topA = za + h, topB = zb + h;
      kit.quad([[ax, ay, za - bury], [bx, by, zb - bury], [bx, by, topB], [ax, ay, topA]], [nx, ny, 0], KEY, { collide: false });
      kit.quad([[ax, ay, topA], [bx, by, topB], [bx + ux, by + uy, Math.max(topB, zbb + m(0.15))], [ax + ux, ay + uy, Math.max(topA, zab + m(0.15))]], [0, 0, 1], KEY, { collide: false, castShadow: false });
      kit.quad([[ax + ux, ay + uy, Math.max(topA, zab + m(0.15))], [bx + ux, by + uy, Math.max(topB, zbb + m(0.15))], [bx + ux, by + uy, zbb - bury], [ax + ux, ay + uy, zab - bury]], [-nx, -ny, 0], KEY, { collide: false, castShadow: false });
      segs++;
    }
  }
  return { rows, segs };
}

// ----------------------------------------------------------------------------------------------------- garden plots
function buildPlots(ctx, T, kit, detail, blocked, rand) {
  const A = AMAH, m = (v) => v / A;
  const { fp, plan } = T;
  const plots = [];
  const axisY = plan.axisY;
  const yA = fp.y0 - m(330), yB = fp.y1 + m(260);
  for (let Y = yA; Y < yB; Y += m(22)) {
    if (Math.abs(Y + m(8) - axisY) < m(26)) continue;                  // clear of the causeway
    const xt = T.thalwegX(Y + m(8));
    for (const side of [-1, 1]) {
      if (rand() < 0.3) continue;
      const w = m(13 + 8 * rand()), d = m(16 + 5 * rand());
      const x0 = side > 0 ? xt + m(5) : xt - m(5) - w, x1 = x0 + w;
      const r = [x0, Y, x1, Y + d];
      const corners = [[x0, Y], [x1, Y], [x1, Y + d], [x0, Y + d]];
      if (corners.some(([X, Yc]) => blocked(X, Yc, 2))) continue;
      const zs = corners.map(([X, Yc]) => T.heightZ(X, Yc));
      if ((Math.max(...zs) - Math.min(...zs)) * A > 6) continue;     // too steep for a garden plot
      plots.push(r);
    }
  }
  // low field walls (0.6 m), draped in 4 m pieces, a gap for the gate on the side toward the bed ⚙
  const H = m(0.6), t = m(0.45), step = m(4);
  const KEY = ctx.mats?.has?.('house_rubble') ? 'house_rubble' : 'terrain_rock';
  for (const [x0, y0, x1, y1] of plots) {
    const xt = T.thalwegX((y0 + y1) / 2);
    const gateSide = Math.abs(x0 - xt) < Math.abs(x1 - xt) ? 3 : 1;   // edge index nearer the bed (3 = west, 1 = east)
    const edges = [[[x0, y0], [x1, y0]], [[x1, y0], [x1, y1]], [[x1, y1], [x0, y1]], [[x0, y1], [x0, y0]]];
    edges.forEach(([[ax, ay], [bx, by]], k) => {
      const L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / step));
      const ox = (by - ay) / L, oy = -(bx - ax) / L;                 // outward (CCW corners)
      for (let i = 0; i < n; i++) {
        if (k === gateSide && i === Math.floor(n / 2)) continue;      // the gate
        const f0 = i / n, f1 = (i + 1) / n;
        const p = [ax + (bx - ax) * f0, ay + (by - ay) * f0], q = [ax + (bx - ax) * f1, ay + (by - ay) * f1];
        const zp = T.heightZ(...p), zq = T.heightZ(...q);
        const pi = [p[0] - ox * t, p[1] - oy * t], qi = [q[0] - ox * t, q[1] - oy * t];
        kit.quad([[...p, zp - m(0.3)], [...q, zq - m(0.3)], [...q, zq + H], [...p, zp + H]], [ox, oy, 0], KEY, { collide: false, castShadow: false });
        kit.quad([[...pi, zp - m(0.3)], [...qi, zq - m(0.3)], [...qi, zq + H], [...pi, zp + H]], [-ox, -oy, 0], KEY, { collide: false, castShadow: false });
        kit.quad([[...p, zp + H], [...q, zq + H], [...qi, zq + H], [...pi, zp + H]], [0, 0, 1], KEY, { collide: false, castShadow: false });
      }
    });
  }
  return plots;
}

// ------------------------------------------------------------------------------------------------ ledges and boulders
const ROCKS_BY_DETAIL = [250, 700, 1300, 1600];

function rockGeometry(seed) {
  const r = rng(seed);
  const g0 = new IcosahedronGeometry(1, 1);
  const g = g0.index ? g0.toNonIndexed() : g0;
  const p = g.attributes.position;
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.8 + 0.38 * r());
    const k = jit.get(key);
    p.setXYZ(i, x * k, Math.max(y * k * 0.8, -0.3), z * k);            // flattened base (sits sunk in the ground)
  }
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  // world-scale UVs on the unit rock (1 UV ≈ 1 m at an average instance)
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i) * 1.6 + p.getZ(i) * 0.7; uv[i * 2 + 1] = p.getY(i) * 1.6 - p.getZ(i) * 0.5; }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

function buildRocks(ctx, T, group, detail, blocked, rand, plots) {
  const A = AMAH, m = (v) => v / A;
  const { fp, plan } = T;
  const n = ROCKS_BY_DETAIL[Math.max(0, Math.min(3, detail))];
  const Rr = Math.min(1500, (ctx.quality?.drawDistance || 4000) * 0.4) / A;
  const cx = (fp.x0 + fp.x1) / 2 + m(250), cy = (fp.y0 + fp.y1) / 2;   // biased east, toward Har HaMishchah
  const items = [];
  let tries = 0;
  while (items.length < n && tries < n * 40) {
    tries++;
    const rr = Rr * Math.sqrt(rand()), a = rand() * Math.PI * 2;
    const X = cx + Math.cos(a) * rr, Y = cy + Math.sin(a) * rr;
    if (T.footDist(X, Y) < 18) continue;
    const rk = T.rockiness(X, Y);
    if (rk < 0.48 || rand() > smooth(0.48, 0.7, rk)) continue;
    if (blocked(X, Y, 3) || plots.some((p) => inRect(p, X, Y, m(2)))) continue;   // low: allowed in the view cones (keepOut keeps 12 m)
    const z = T.heightZ(X, Y), zx = T.heightZ(X + m(2), Y), zy = T.heightZ(X, Y + m(2));
    const gx = (zx - z) / m(2), gy = (zy - z) / m(2), g = Math.hypot(gx, gy);
    if (g > 0.75) continue;
    items.push({ X, Y, z, gx, gy, g });
  }
  if (!items.length) return 0;
  const geo = rockGeometry(4242);
  const im = new InstancedMesh(geo, ctx.mats.get('terrain_rock'), items.length);
  im.name = 'terrain:rocks';
  const mtx = new Matrix4(), q = new Quaternion(), q2 = new Quaternion(), s = new Vector3(), p = new Vector3(), up = new Vector3(0, 1, 0), nrm = new Vector3();
  items.forEach((it, i) => {
    const ledge = it.g > 0.12 && rand() < 0.62;
    // ledges lie along the contour (long axis across the gradient), boulders anywhere
    const yawAcross = Math.atan2(-it.gx, it.gy);              // local x along the contour
    q.setFromAxisAngle(up, ledge ? yawAcross + (rand() - 0.5) * 0.3 : rand() * Math.PI * 2);
    // tilt halfway toward the ground's normal
    nrm.set(-it.gx, 1, it.gy).normalize().lerp(up, 0.5).normalize();
    q2.setFromUnitVectors(up, nrm);
    q.premultiply(q2);
    if (ledge) s.set(1.6 + 2.6 * rand(), 0.35 + 0.35 * rand(), 0.7 + 0.6 * rand());
    else { const k = 0.35 + 0.65 * rand() ** 2; s.set(k * (0.8 + 0.4 * rand()), k * (0.6 + 0.3 * rand()), k * (0.8 + 0.4 * rand())); }
    m2w(it.X, it.Y, it.z, p);
    p.y -= s.y * 0.25;
    mtx.compose(p, q, s);
    im.setMatrixAt(i, mtx);
  });
  im.instanceMatrix.needsUpdate = true;
  im.castShadow = detail >= 3;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  group.add(im);
  return items.length;
}

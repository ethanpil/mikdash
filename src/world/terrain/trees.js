// Olive groves on Har HaMishchah ("the Mount of Anointing" — the olive mount), planted in rows on the terrace benches
// (terrain/features.js), and garden trees in the Kidron plots (the Azarah's effluent was sold to gardeners — Yoma
// 58b). Instanced: trunks + crowns, a near and a far level of detail swapped by camera distance; only the near
// trees cast shadows. Placement, density and tree form are reconstruction (docs/decisions/build-mount.md).
import { Group, InstancedMesh, CylinderGeometry, IcosahedronGeometry, Matrix4, Vector3, Quaternion, Color, Euler, Float32BufferAttribute } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { mergeGeometries, applyWorldUV } from '../geom.js';
import { rng, smooth } from '../mount/kit.js';
import { distToPolyline, rectDist, inRect } from './plan.js';

const MAX_BY_DETAIL = [700, 1400, 2400, 3000];

/** A short, thick, leaning trunk splitting into three gnarled leaders that spread into the crown (metres). */
function trunkGeometry(seg, seed, far = false) {
  const r = rng(seed);
  const parts = [];
  const limb = (r0, r1, h, rx, rz, base) => {
    const g = new CylinderGeometry(r1, r0, h, seg, far ? 1 : 2, true);
    // a slight twist / bulge along the limb
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), k = 1 + 0.12 * Math.sin((y / h + 0.5) * 5 + r() * 0.3);
      p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
    }
    g.translate(0, h / 2, 0);
    g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rx, 0, rz)));
    g.translate(...base);
    parts.push(g.toNonIndexed());
  };
  limb(0.34, 0.26, 1.25, 0.06, 0.1, [0, -0.2, 0]);                 // bole
  limb(0.2, 0.08, 1.7, 0.25, -0.62, [0.08, 0.95, 0.02]);            // three leaders
  limb(0.19, 0.08, 1.6, -0.58, 0.32, [0.1, 0.92, 0.06]);
  if (!far) limb(0.17, 0.07, 1.5, 0.55, 0.45, [0.06, 0.95, -0.08]);
  const g = mergeGeometries(parts, false);
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return applyWorldUV(g, 1);
}

/**
 * The crown: lumps round a ring and one or two over the centre, flattened, each vertex pushed in or out (an open,
 * broken outline rather than a ball); its base lifted ~1.7 m so the split trunk shows. The normals lean toward the
 * whole crown's centre so it shades as one mass, not as separate balls. Olive: ≈ 6.5 m wide, 3.3 m deep.
 */
function canopyGeometry(lumpDetail, nRing, seed, nTop = 1) {
  const r = rng(seed);
  const lumps = [];
  for (let i = 0; i < nRing; i++) {
    const a = (i / nRing) * Math.PI * 2 + r() * 0.5;
    const rr = (nRing > 5 ? 1.75 : 1.55) + 0.5 * r();
    const rad = nRing > 5 ? 0.82 + 0.3 * r() : 1.05 + 0.35 * r();
    lumps.push([Math.cos(a) * rr, 2.45 + 0.6 * r(), Math.sin(a) * rr, rad]);
  }
  for (let i = 0; i < nTop; i++) lumps.push([0.15 + (i ? -0.9 : 0.3) * r(), 3.2 + 0.2 * i, -0.1 + (i ? 0.8 : -0.2) * r(), nTop > 1 ? 1.0 : 1.25]);
  const C = [0, 2.75, 0];
  const parts = [];
  lumps.forEach(([cx, cy, cz, rad]) => {
    const ico = new IcosahedronGeometry(rad, lumpDetail);
    const g = ico.index ? ico.toNonIndexed() : ico;
    const p = g.attributes.position, n = new Float32Array(p.count * 3);
    const jit = new Map();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      if (!jit.has(key)) jit.set(key, 0.7 + 0.55 * r());
      const k = jit.get(key);
      const px = cx + x * k, py = cy + y * k * 0.62, pz = cz + z * k;
      const len = Math.hypot(x, y, z) || 1;
      let nx = px - C[0], ny = (py - C[1]) * 1.6, nz = pz - C[2];
      const cl = Math.hypot(nx, ny, nz) || 1;
      nx = 0.35 * x / len + 0.65 * nx / cl; ny = 0.35 * y / len + 0.65 * ny / cl + 0.15; nz = 0.35 * z / len + 0.65 * nz / cl;
      const nl = Math.hypot(nx, ny, nz) || 1;
      n.set([nx / nl, ny / nl, nz / nl], i * 3);
      p.setXYZ(i, px, py, pz);
    }
    g.setAttribute('normal', new Float32BufferAttribute(n, 3));
    parts.push(g);
  });
  return applyWorldUV(mergeGeometries(parts, false), 1);
}

export function buildTrees(ctx, T, detail, feat = {}) {
  const A = AMAH;
  const { fp, plan } = T;
  const m = (meters) => meters / A;
  const rand = rng((ctx.params?.seed ?? 5786) * 7 + 3);
  const R = (ctx.quality?.drawDistance || 4000) / A;
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const corridors = [...plan.streets, plan.parahPath];
  const blocked = (X, Y) => {
    for (const r of plan.keepOut) if (inRect(r, X, Y, m(2))) return true;
    for (const f of plan.flats) if (rectDist(f.rect, X, Y) < m(4)) return true;
    for (const c of corridors) if (distToPolyline(c.pts, X, Y).d < c.half + m(5)) return true;
    if (plan.inViewCone(X, Y)) return true;
    return Math.hypot(X - cx, Y - cy) > R * 0.92;
  };
  const cand = [];
  const slopeOk = (X, Y) => {
    const h = T.heightZ(X, Y), hx = T.heightZ(X + m(3), Y), hy = T.heightZ(X, Y + m(3));
    return { h, ok: Math.hypot(hx - h, hy - h) / m(3) <= 0.62 };
  };
  const add = (X, Y, kind) => {
    if (blocked(X, Y)) return;
    const { h, ok } = slopeOk(X, Y);
    if (ok) cand.push({ X, Y, Z: h, kind });
  };
  // olives in rows on the terrace benches: 3.5–5 m uphill of each wall, 8.5–12 m apart
  for (const row of feat.rows || []) {
    const P = row.pts;
    const cum = [0];
    for (let i = 0; i + 1 < P.length; i++) cum.push(cum[i] + Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]));
    let i = 0;
    for (let s = rand() * m(8); s < cum[cum.length - 1]; s += m(8.5 + 3.5 * rand())) {
      while (i + 2 < cum.length && cum[i + 1] < s) i++;
      if (rand() < 0.22) continue;                                    // gaps in the rows
      const [ax, ay] = P[i], [bx, by] = P[i + 1];
      const L = cum[i + 1] - cum[i] || 1, f = (s - cum[i]) / L;
      let nx = (by - ay) / L, ny = -(bx - ax) / L;                    // a normal; flip it uphill
      const X0 = ax + (bx - ax) * f, Y0 = ay + (by - ay) * f;
      if (T.heightZ(X0 + nx * m(3), Y0 + ny * m(3)) < T.heightZ(X0, Y0)) { nx = -nx; ny = -ny; }
      const off = m(3.5 + 1.5 * rand());
      add(X0 + nx * off, Y0 + ny * off, 'olive');
    }
  }
  const scatter = (x0, y0, x1, y1, cell, prob, kind) => {
    for (let Y = y0; Y < y1; Y += cell) {
      for (let X = x0; X < x1; X += cell) {
        const px = X + cell * (0.15 + 0.7 * rand()), py = Y + cell * (0.15 + 0.7 * rand());
        if (rand() > prob(px, py)) continue;
        add(px, py, kind);
      }
    }
  };
  const u = (X) => (X - fp.x1) * A;
  // beyond the terraces: the crest and the east side of Har HaMishchah, in irregular groves
  scatter(fp.x1 + m(760), fp.y0 - m(650), fp.x1 + m(1300), fp.y1 + m(550), m(12), (X, Y) => {
    const g = 0.3 + 0.7 * smooth(-0.2, 0.25, T.noise.fbm(X * A / 230 + 5, Y * A / 230 - 2, 3));
    return 0.75 * g * (1 - 0.65 * smooth(950, 1250, u(X)));
  }, 'olive');
  // garden trees in the Kidron plots (fig, pomegranate), two loose rows each
  for (const [x0, y0, x1, y1] of feat.plots || []) {
    for (const f of [0.3, 0.72]) for (let Y = y0 + m(3); Y < y1 - m(2); Y += m(5.5 + 2 * rand())) if (rand() < 0.8) add(x0 + (x1 - x0) * (f + (rand() - 0.5) * 0.12), Y, 'garden');
  }
  // a few olives on the edges of the city and the north
  scatter(fp.x0 - m(900), fp.y1 + m(420), fp.x1, fp.y1 + m(800), m(18), (X, Y) => 0.25 * smooth(0, 0.3, T.noise.fbm(X * A / 300, Y * A / 300, 2)), 'olive');

  const max = MAX_BY_DETAIL[Math.max(0, Math.min(3, detail))];
  // weighted sample: groves facing the Temple (the west slope on the axis) keep their density when the tier thins them
  const focusX = fp.x1 + m(620), axisY = ctx.site.axisY;
  for (const c of cand) {
    const d = Math.hypot((c.X - focusX) * A, (c.Y - axisY) * A * 0.8);
    const w = 1 / (1 + (d / 450) ** 2) + (c.kind === 'garden' ? 0.6 : 0.08);
    c.key = Math.pow(rand(), 1 / w);
  }
  cand.sort((p, q) => q.key - p.key);
  const list = cand.slice(0, max);
  if (!list.length) return null;

  // two levels of detail swapped by distance to the camera (near: 10 detailed lumps, casting; far: 4 low-poly lumps)
  const foliageKey = ctx.mats.has('olive_foliage') ? 'olive_foliage' : 'plaster';
  const farTrunk = trunkGeometry(4, 11, true), farCrown = canopyGeometry(0, 3, 17);
  const nearTrunk = trunkGeometry(detail >= 2 ? 9 : 7, 11), nearCrown = canopyGeometry(1, 8, 17, 2);
  const NEAR_MAX = [0, 60, 140, 220][Math.max(0, Math.min(3, detail))];
  const NEAR_R = [0, 70, 110, 150][Math.max(0, Math.min(3, detail))];
  const mk = (geo, key, n, name) => {
    const im = new InstancedMesh(geo, ctx.mats.get(key), Math.max(1, n));
    im.name = name;
    if (key === foliageKey) im.setColorAt(0, new Color(1, 1, 1));       // allocate instanceColor up front (one program)
    return im;
  };
  const trunks = mk(farTrunk, 'timber_rough', list.length, 'terrain:olive-trunks');
  const crowns = mk(farCrown, foliageKey, list.length, 'terrain:olive-crowns');
  const nTrunks = NEAR_MAX ? mk(nearTrunk, 'timber_rough', NEAR_MAX, 'terrain:olive-trunks-near') : null;
  const nCrowns = NEAR_MAX ? mk(nearCrown, foliageKey, NEAR_MAX, 'terrain:olive-crowns-near') : null;
  const mtx = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), up = new Vector3(0, 1, 0), col = new Color();
  // olive: grey-green with a silvery bias; garden trees (fig, pomegranate): deeper, warmer green. With the neutral
  // 'plaster' stand-in the colour carries the whole tint; with a real foliage material it only varies it.
  const tintOlive = foliageKey === 'plaster' ? [0.13, 0.148, 0.122] : [1, 1, 1];
  const tintGarden = foliageKey === 'plaster' ? [0.085, 0.118, 0.06] : [0.85, 0.95, 0.8];
  const mats = new Float32Array(list.length * 16), cols = new Float32Array(list.length * 3), wpos = new Float32Array(list.length * 3);
  list.forEach((t, i) => {
    const sc = (t.kind === 'garden' ? 0.72 : 1.0) * (0.8 + 0.5 * rand());
    m2w(t.X, t.Y, t.Z, p);
    p.y -= 0.12;
    wpos.set([p.x, p.y, p.z], i * 3);
    q.setFromAxisAngle(up, rand() * Math.PI * 2);
    s.set(sc * (0.9 + 0.2 * rand()), sc * (0.85 + 0.25 * rand()), sc * (0.9 + 0.2 * rand()));
    mtx.compose(p, q, s);
    mtx.toArray(mats, i * 16);
    const base = t.kind === 'garden' ? tintGarden : tintOlive;
    const v = 0.86 + 0.26 * rand(), silver = t.kind === 'garden' ? 0 : 0.06 * rand();
    col.setRGB(base[0] * v + silver * base[0], base[1] * v * (0.96 + 0.08 * rand()) + silver * base[1], base[2] * v + silver * base[2] * 1.2);
    col.toArray(cols, i * 3);
  });
  const all = [trunks, crowns, nTrunks, nCrowns].filter(Boolean);
  for (const im of all) { im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; }
  if (nTrunks) { nTrunks.castShadow = detail >= 1; nCrowns.castShadow = detail >= 1; }
  // assign instances: near ones (closest to the camera, within NEAR_R) to the detailed meshes, the rest to the far ones
  const tmpC = new Color();
  let lastX = Infinity, lastZ = Infinity;
  const assign = (cx2, cz2) => {
    const near = [];
    if (NEAR_MAX) {
      for (let i = 0; i < list.length; i++) {
        const dx = wpos[i * 3] - cx2, dz = wpos[i * 3 + 2] - cz2, d2 = dx * dx + dz * dz;
        if (d2 < NEAR_R * NEAR_R) near.push([d2, i]);
      }
      near.sort((a, b) => a[0] - b[0]);
      near.length = Math.min(near.length, NEAR_MAX);
    }
    const isNear = new Uint8Array(list.length);
    near.forEach(([, i], k) => {
      isNear[i] = 1;
      mtx.fromArray(mats, i * 16); nTrunks.setMatrixAt(k, mtx); nCrowns.setMatrixAt(k, mtx);
      tmpC.fromArray(cols, i * 3); nCrowns.setColorAt(k, tmpC);
    });
    let k = 0;
    for (let i = 0; i < list.length; i++) {
      if (isNear[i]) continue;
      mtx.fromArray(mats, i * 16); trunks.setMatrixAt(k, mtx); crowns.setMatrixAt(k, mtx);
      tmpC.fromArray(cols, i * 3); crowns.setColorAt(k, tmpC);
      k++;
    }
    trunks.count = crowns.count = k;
    if (nTrunks) { nTrunks.count = nCrowns.count = near.length; nTrunks.visible = nCrowns.visible = near.length > 0; }
    for (const im of all) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  };
  assign(1e9, 1e9);
  for (const im of all) im.computeBoundingSphere();
  if (NEAR_MAX && ctx.engine?.onUpdate) {
    ctx.engine.onUpdate(() => {
      const c = ctx.camera?.position;
      if (!c) return;
      if ((c.x - lastX) ** 2 + (c.z - lastZ) ** 2 < 15 * 15) return;
      lastX = c.x; lastZ = c.z;
      assign(c.x, c.z);
    }, 45);
  }
  const g = new Group();
  g.name = 'terrain:trees';
  g.add(...all);
  g.userData.count = list.length;
  const scrub = buildScrub(ctx, T, detail, foliageKey, blocked, rand);
  if (scrub) { g.add(scrub); g.userData.scrub = scrub.count; }
  return g;
}

const SCRUB_BY_DETAIL = [0, 2500, 5000, 6500];

/** Low garrigue (thorny burnet, sage, thyme) on the soil of the slopes outside the city — one instanced draw call. */
function buildScrub(ctx, T, detail, foliageKey, blocked, rand) {
  const n = SCRUB_BY_DETAIL[Math.max(0, Math.min(3, detail))];
  if (!n) return null;
  const A = AMAH, m = (v) => v / A;
  const { fp, plan } = T;
  const inCity = (X, Y) => plan.districts.some((d) => inRect(d.rect, X, Y, m(10)));
  const pts = [];
  let tries = 0;
  const R = Math.min(1600, (ctx.quality?.drawDistance || 4000) * 0.45) / A;
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  while (pts.length < n && tries < n * 12) {
    tries++;
    // denser toward the Mount: radius ~ sqrt-biased; in small clumps
    const r = R * Math.pow(rand(), 0.75), a = rand() * Math.PI * 2;
    const X0 = cx + Math.cos(a) * r, Y0 = cy + Math.sin(a) * r;
    if (T.footDist(X0, Y0) < 12 || inCity(X0, Y0) || blocked(X0, Y0)) continue;
    if (T.rockiness(X0, Y0) > 0.6 && rand() < 0.5) continue;
    const k = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < k && pts.length < n; i++) {
      const X = X0 + m((rand() - 0.5) * 3), Y = Y0 + m((rand() - 0.5) * 3);
      const z = T.heightZ(X, Y), zx = T.heightZ(X + m(2), Y);
      if (Math.abs(zx - z) / m(2) > 0.7) continue;
      pts.push([X, Y, z]);
    }
  }
  if (!pts.length) return null;
  const ico = new IcosahedronGeometry(0.55, 0);
  const geo = ico.index ? ico.toNonIndexed() : ico;
  const p = geo.attributes.position, nrm = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1;
    nrm.set([x / l, y / l * 0.7 + 0.3, z / l], i * 3);
    p.setXYZ(i, x * 1.15, y * 0.5 + 0.15, z * 1.15);
  }
  geo.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
  applyWorldUV(geo, 1);
  const im = new InstancedMesh(geo, ctx.mats.get(foliageKey), pts.length);
  im.name = 'terrain:scrub';
  const mtx = new Matrix4(), q = new Quaternion(), s = new Vector3(), v = new Vector3(), up = new Vector3(0, 1, 0), col = new Color();
  // dry grey-green and grey-brown garrigue at the end of the dry season
  const tints = foliageKey === 'plaster' ? [[0.105, 0.11, 0.08], [0.11, 0.1, 0.075], [0.09, 0.1, 0.075]] : [[0.7, 0.72, 0.6], [0.75, 0.68, 0.55], [0.65, 0.7, 0.6]];
  pts.forEach(([X, Y, Z], i) => {
    m2w(X, Y, Z, v);
    v.y -= 0.08;
    q.setFromAxisAngle(up, rand() * 6.283);
    const sc = 0.45 + 0.9 * rand();
    s.set(sc * (0.8 + 0.5 * rand()), sc * (0.7 + 0.4 * rand()), sc * (0.8 + 0.5 * rand()));
    mtx.compose(v, q, s);
    im.setMatrixAt(i, mtx);
    const t = tints[Math.floor(rand() * tints.length)], k = 0.8 + 0.4 * rand();
    col.setRGB(t[0] * k, t[1] * k, t[2] * k);
    im.setColorAt(i, col);
  });
  im.instanceMatrix.needsUpdate = true;
  im.instanceColor.needsUpdate = true;
  im.castShadow = false;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  return im;
}

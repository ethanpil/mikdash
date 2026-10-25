// Olive groves on Har HaMishchah ("the Mount of Anointing" — the olive mount), planted in rows on the terrace benches
// (terrain/features.js), and garden trees in the Kidron plots (the Azarah's effluent was sold to gardeners — Yoma
// 58b). Instanced: trunks + crowns, a near and a far level of detail swapped by camera distance; only the near
// trees cast shadows. Placement, density and tree form are reconstruction (docs/decisions/build-mount.md).
import { Group, InstancedMesh, CylinderGeometry, IcosahedronGeometry, Matrix4, Vector3, Quaternion, Color, Euler, Float32BufferAttribute } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { mergeGeometries, applyWorldUV } from '../geom.js';
import { rng, smooth } from '../mount/kit.js';
import { distToPolyline, rectDist, inRect } from './plan.js';

// gate-world-materials: more trees (the QA gate: hundreds in the Mount of Olives views, ~10 seen from the crest), paid for
// by a third, very cheap level of detail beyond MID_R
const MAX_BY_DETAIL = [1100, 2000, 3200, 4200];

/**
 * Olive forms ⚙ (qa-r1-fix-world: three instead of one, so groves are not rows of clones). Each: the bole
 * [r0, r1, h, rx, rz] and its leaders [r0, r1, h, rx, rz, base] (metres, radians), and the crown: ring radius and its
 * spread, lump radius and spread, the ring's height, the top lumps' height, the vertical squash, the crown's offset
 * from the bole (the lean) and how many lumps sit over the centre.
 * qa-r2-fix-world: the crowns read as flat-topped acacias (a tall bare trunk under a squashed plate of foliage). An
 * olive is low and wide: a short, thick bole splitting low into twisted leaders that spread under the crown, and a
 * domed, lumpy crown 5–7 m across whose outer masses droop to within ≈ 1 m of the ground — so the ring sits lower
 * (1.6–2.25 m), its lumps are larger and rounder (squash 0.72–0.85), the top lumps stand ≈ 1.1 m over it, and the
 * lumps' heights scatter more (canopyGeometry).
 *   0: the broad tree — a short leaning bole splitting into three gnarled leaders, a wide domed crown
 *   1: a younger, taller tree on two leaders, its crown higher and rounder
 *   2: an old tree, its bole thick and low, three leaders sprawling, the crown wide, low and lopsided
 */
const FORMS = [
  { bole: [0.36, 0.28, 0.95, 0.08, 0.12], leaders: [[0.21, 0.09, 1.45, 0.38, -0.72, [0.08, 0.7, 0.02]], [0.2, 0.09, 1.35, -0.68, 0.4, [0.1, 0.68, 0.06]], [0.18, 0.08, 1.3, 0.62, 0.58, [0.06, 0.72, -0.08]]],
    crown: { ring: [1.85, 0.55], lump: [1.0, 0.32], y: 1.85, top: 2.95, squash: 0.8, shift: [0.1, -0.1], nTop: 2 } },
  { bole: [0.28, 0.22, 1.3, -0.04, 0.08], leaders: [[0.18, 0.07, 1.6, 0.26, -0.46, [0.04, 1.05, 0.0]], [0.17, 0.07, 1.55, -0.4, 0.36, [0.05, 1.02, 0.04]]],
    crown: { ring: [1.45, 0.4], lump: [0.95, 0.28], y: 2.25, top: 3.35, squash: 0.85, shift: [0.15, 0.05], nTop: 2 } },
  { bole: [0.5, 0.36, 0.75, 0.18, -0.22], leaders: [[0.27, 0.1, 1.25, 0.62, -0.92, [0.14, 0.45, 0.05]], [0.25, 0.09, 1.35, -0.88, 0.5, [-0.04, 0.47, 0.1]], [0.18, 0.06, 1.2, 0.3, 1.08, [0.1, 0.5, -0.12]]],
    crown: { ring: [2.1, 0.65], lump: [0.95, 0.36], y: 1.6, top: 2.55, squash: 0.72, shift: [0.45, -0.3], nTop: 1 } },
];

/** The trunk of a form: the bole and its leaders, each a slightly twisted, bulging tapered tube (metres). */
function trunkGeometry(seg, seed, far = false, form = FORMS[0]) {
  const r = rng(seed);
  const parts = [];
  const limb = (r0, r1, h, rx, rz, base) => {
    const g = new CylinderGeometry(r1, r0, h, seg, far ? 1 : 3, true);
    // gate-world-materials: gnarled — the old olive's fluted, twisting bole: lobes round the limb (3 buttress-like flutes)
    // that spiral up it, swellings along it, the whole limb twisted (was a smooth bulge only)
    const p = g.attributes.position;
    const ph = r() * 6.28, tw = 0.9 + 0.6 * r();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), f = y / h + 0.5;
      const a = Math.atan2(z, x) + tw * f;
      const k = (1 + 0.12 * Math.sin(f * 5 + ph)) * (1 + (far ? 0.1 : 0.2) * Math.sin(3 * a + ph) + (far ? 0 : 0.07 * Math.sin(7 * a - 2 * ph)));
      const rr = Math.hypot(x, z) * k;
      p.setXYZ(i, Math.cos(a) * rr, y, Math.sin(a) * rr);
    }
    g.translate(0, h / 2, 0);
    g.applyMatrix4(new Matrix4().makeRotationFromEuler(new Euler(rx, 0, rz)));
    g.translate(...base);
    parts.push(g.toNonIndexed());
  };
  limb(...form.bole, [0, -0.2, 0]);
  form.leaders.forEach((L, i) => { if (!far || i < 2) limb(...L); });
  const g = mergeGeometries(parts, false);
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return applyWorldUV(g, 1);
}

/**
 * The crown: lumps round a ring and one or two over the centre, flattened, each vertex pushed in or out (an open,
 * broken outline rather than a ball); its base lifted so the split trunk shows. The normals lean toward the whole
 * crown's centre so it shades as one mass, not as separate balls. Olive: ≈ 5–7 m wide, 3–3.5 m deep.
 */
function canopyGeometry(lumpDetail, nRing, seed, form = FORMS[0], far = false) {
  const r = rng(seed);
  const c = form.crown, nTop = far ? 1 : c.nTop;
  const lumps = [];
  for (let i = 0; i < nRing; i++) {
    const a = (i / nRing) * Math.PI * 2 + r() * 0.5;
    const rr = (nRing > 5 ? c.ring[0] : c.ring[0] - 0.2) + c.ring[1] * r();
    const rad = nRing > 5 ? c.lump[0] + c.lump[1] * r() : c.lump[0] + 0.23 + (c.lump[1] + 0.05) * r();
    // heights scattered over ≈ 0.9 m, the lumps reaching furthest out hanging lowest (the drooping outer masses)
    lumps.push([c.shift[0] + Math.cos(a) * rr, c.y + 0.9 * r() - 0.45 * (rr - c.ring[0]), c.shift[1] + Math.sin(a) * rr, rad]);
  }
  for (let i = 0; i < nTop; i++) lumps.push([c.shift[0] + 0.15 + (i ? -0.9 : 0.3) * r(), c.top + 0.2 * i, c.shift[1] - 0.1 + (i ? 0.8 : -0.2) * r(), nTop > 1 ? 1.0 : 1.25]);
  const C = [c.shift[0], (c.y + c.top) / 2 + 0.05, c.shift[1]];
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
      const px = cx + x * k, py = cy + y * k * c.squash, pz = cz + z * k;
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
    return Math.hypot(X - cx, Y - cy) > R * 0.92;
  };
  // a tree in a viewpoint's cone only where its crown (≤ 5.5 m) stays under the sight line (qa-r1-fix-world: was none in
  // the cones at all, which left the near slope bare from the lookouts)
  const sightOk = (X, Y, h) => plan.sightTop(X, Y, T.heightZ) > h + m(5.5);
  const cand = [];
  const slopeOk = (X, Y) => {
    const h = T.heightZ(X, Y), hx = T.heightZ(X + m(3), Y), hy = T.heightZ(X, Y + m(3));
    return { h, ok: Math.hypot(hx - h, hy - h) / m(3) <= 0.62 };
  };
  const add = (X, Y, kind) => {
    if (blocked(X, Y)) return;
    const { h, ok } = slopeOk(X, Y);
    if (ok && sightOk(X, Y, h)) cand.push({ X, Y, Z: h, kind });
  };
  // olives in rows on the terrace benches: 3.5–5 m uphill of each wall, 8.5–12 m apart
  for (const row of feat.rows || []) {
    const P = row.pts;
    const cum = [0];
    for (let i = 0; i + 1 < P.length; i++) cum.push(cum[i] + Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]));
    let i = 0;
    for (let s = rand() * m(8); s < cum[cum.length - 1]; s += m(8.5 + 3.5 * rand())) {
      while (i + 2 < cum.length && cum[i + 1] < s) i++;
      if (rand() < 0.15) continue;                                    // gaps in the rows
      const [ax, ay] = P[i], [bx, by] = P[i + 1];
      const L = cum[i + 1] - cum[i] || 1, f = (s - cum[i]) / L;
      let nx = (by - ay) / L, ny = -(bx - ax) / L;                    // a normal; flip it uphill
      const X0 = ax + (bx - ax) * f, Y0 = ay + (by - ay) * f;
      if (T.heightZ(X0 + nx * m(3), Y0 + ny * m(3)) < T.heightZ(X0, Y0)) { nx = -nx; ny = -ny; }
      const off = m(3.5 + 1.5 * rand());
      add(X0 + nx * off, Y0 + ny * off, 'olive');
      // gate-world-materials: a second row further up the bench where the bench is deep (the next wall ≥ 15 m uphill), the
      // trees set between those of the first (quincunx)
      const off2 = off + m(8 + 2 * rand());
      const Xb = X0 + nx * off2 + (bx - ax) / L * m(4.5), Yb = Y0 + ny * off2 + (by - ay) / L * m(4.5);
      if (rand() < 0.8 && T.heightZ(Xb, Yb) - T.heightZ(X0, Y0) < m(2.6)) add(Xb, Yb, 'olive');
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
  // gate-world-materials: a tree in some of the city's courtyards (fig, pomegranate, olive — terrain/city.js courtTrees)
  for (const [X, Y] of feat.courts || []) {
    const { h } = slopeOk(X, Y);
    cand.push({ X, Y, Z: h, kind: 'garden', court: true });
  }
  // a few olives on the edges of the city and the north
  scatter(fp.x0 - m(900), fp.y1 + m(420), fp.x1, fp.y1 + m(800), m(18), (X, Y) => 0.25 * smooth(0, 0.3, T.noise.fbm(X * A / 300, Y * A / 300, 2)), 'olive');

  const max = MAX_BY_DETAIL[Math.max(0, Math.min(3, detail))];
  // weighted sample: groves facing the Temple (the west slope on the axis) keep their density when the tier thins them
  const focusX = fp.x1 + m(620), axisY = ctx.site.axisY;
  for (const c of cand) {
    const d = Math.hypot((c.X - focusX) * A, (c.Y - axisY) * A * 0.8);
    const w = c.court ? 50 : 1 / (1 + (d / 450) ** 2) + (c.kind === 'garden' ? 0.6 : 0.08);
    c.key = Math.pow(rand(), 1 / w);
  }
  cand.sort((p, q) => q.key - p.key);
  const list = cand.slice(0, max);
  if (!list.length) return null;

  // two levels of detail swapped by distance to the camera (near: 10 detailed lumps, casting; far: 4 low-poly lumps), in
  // two (low) or three olive forms (FORMS), each form its own pair of instanced meshes per level
  const foliageKey = ctx.mats.has('olive_foliage') ? 'olive_foliage' : 'plaster';
  const NF = detail === 0 ? 2 : 3;
  const NEAR_MAX = [0, 60, 140, 220][Math.max(0, Math.min(3, detail))];
  const NEAR_R = [0, 70, 110, 150][Math.max(0, Math.min(3, detail))];
  // gate-world-materials: a third level beyond MID_R — two lumps and a single-limb trunk (≈ 46 triangles: the mid level's
  // five lumps and two limbs are ≈ 140), so the groves can hold hundreds of trees on every tier
  const MID_R = [280, 380, 480, 600][Math.max(0, Math.min(3, detail))];
  const mk = (geo, key, n, name) => {
    const im = new InstancedMesh(geo, ctx.mats.get(key), Math.max(1, n));
    im.name = name;
    if (key === foliageKey) im.setColorAt(0, new Color(1, 1, 1));       // allocate instanceColor up front (one program)
    return im;
  };
  // olive bark on the trunks (world-4: they had the altar firewood's walnut bark, timber_rough)
  const trunkKey = ctx.mats.has?.('olive_bark') ? 'olive_bark' : 'timber_rough';
  const counts = new Array(NF).fill(0);
  const formOf = list.map(() => { const f = Math.min(NF - 1, Math.floor(rand() * NF)); counts[f]++; return f; });
  const far = [], near = [], vfar = [];
  for (let f = 0; f < NF; f++) {
    const F = FORMS[f], sfx = f ? `.${f}` : '';
    // far crowns: four ring lumps and one over the centre (were three and one: a flat, three-cornered plate) — 100 triangles
    far.push({ t: mk(trunkGeometry(4, 11 + f, true, F), trunkKey, counts[f], `terrain:olive-trunks${sfx}`), c: mk(canopyGeometry(0, 4, 17 + f, F, true), foliageKey, counts[f], `terrain:olive-crowns${sfx}`) });
    vfar.push({ t: mk(trunkGeometry(3, 11 + f, true, { ...F, leaders: [] }), trunkKey, counts[f], `terrain:olive-trunks-far${sfx}`), c: mk(canopyGeometry(0, 2, 17 + f, { ...F, crown: { ...F.crown, nTop: 0, lump: [F.crown.lump[0] * 1.35, F.crown.lump[1]] } }, true), foliageKey, counts[f], `terrain:olive-crowns-far${sfx}`) });
    if (NEAR_MAX) near.push({ t: mk(trunkGeometry(detail >= 2 ? 9 : 7, 11 + f, false, F), trunkKey, NEAR_MAX, `terrain:olive-trunks-near${sfx}`), c: mk(canopyGeometry(1, 8, 17 + f, F), foliageKey, NEAR_MAX, `terrain:olive-crowns-near${sfx}`) });
  }
  const mtx = new Matrix4(), q = new Quaternion(), s = new Vector3(), p = new Vector3(), up = new Vector3(0, 1, 0), col = new Color();
  // olive: grey-green with a silvery bias; garden trees (fig, pomegranate): deeper, warmer green. With the neutral
  // 'plaster' stand-in the colour carries the whole tint; with a real foliage material it only varies it.
  // qa-r2-fix-world: the olive's silver-grey-green (toward #7d8a6a; olive_foliage's base is #6c7462) — the leaves' pale
  // undersides show as the wind turns them, so a grove reads lighter and greyer than the garden trees
  const tintOlive = foliageKey === 'plaster' ? [0.15, 0.17, 0.132] : [1.22, 1.3, 1.08];
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
  const all = [...far, ...near, ...vfar].flatMap((x) => [x.t, x.c]);
  for (const im of all) { im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; }
  for (const x of near) { x.t.castShadow = detail >= 1; x.c.castShadow = detail >= 1; }
  // assign instances: near ones (closest to the camera, within NEAR_R) to the detailed meshes, the rest to the far ones
  const tmpC = new Color();
  let lastX = Infinity, lastZ = Infinity;
  const put = (pair, k, i) => {
    mtx.fromArray(mats, i * 16); pair.t.setMatrixAt(k, mtx); pair.c.setMatrixAt(k, mtx);
    tmpC.fromArray(cols, i * 3); pair.c.setColorAt(k, tmpC);
  };
  const assign = (cx2, cz2) => {
    const close = [];
    if (NEAR_MAX) {
      for (let i = 0; i < list.length; i++) {
        const dx = wpos[i * 3] - cx2, dz = wpos[i * 3 + 2] - cz2, d2 = dx * dx + dz * dz;
        if (d2 < NEAR_R * NEAR_R) close.push([d2, i]);
      }
      close.sort((a, b) => a[0] - b[0]);
      close.length = Math.min(close.length, NEAR_MAX);
    }
    const isNear = new Uint8Array(list.length);
    const nk = new Array(NF).fill(0), fk = new Array(NF).fill(0), vk = new Array(NF).fill(0);
    for (const [, i] of close) { isNear[i] = 1; put(near[formOf[i]], nk[formOf[i]]++, i); }
    for (let i = 0; i < list.length; i++) {
      if (isNear[i]) continue;
      const dx = wpos[i * 3] - cx2, dz = wpos[i * 3 + 2] - cz2;
      if (dx * dx + dz * dz < MID_R * MID_R) put(far[formOf[i]], fk[formOf[i]]++, i);
      else put(vfar[formOf[i]], vk[formOf[i]]++, i);
    }
    for (let f = 0; f < NF; f++) {
      vfar[f].t.count = vfar[f].c.count = vk[f];
      vfar[f].t.visible = vfar[f].c.visible = vk[f] > 0;
      far[f].t.count = far[f].c.count = fk[f];
      far[f].t.visible = far[f].c.visible = fk[f] > 0;
      if (near[f]) { near[f].t.count = near[f].c.count = nk[f]; near[f].t.visible = near[f].c.visible = nk[f] > 0; }
    }
    for (const im of all) { im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  };
  assign(1e9, 1e9);
  for (const im of all) im.computeBoundingSphere();
  // (every tier now: the mid / far split follows the camera on low too)
  if (ctx.engine?.onUpdate) {
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

// Ground cover round the camera ⚙ (qa-r1-fix-world): tufts of dry grass, low garrigue cushions (thorny burnet, sage)
// and loose limestone stones on the open ground outside the Mount and the city — early November, the end of the dry
// season (the hills straw and grey, a little green where the first rains came). Without them the slopes near a viewer
// read as a flat plain at every tier, since the grid's cells are metres across.
//
// Scattered per 8 m chunk from a hash of the chunk (deterministic: the same ground always carries the same tufts,
// wherever the camera came from) and kept within a tier's radius of the camera, nearest chunks first, the edge
// thinned toward it. Each sits on the RENDERED ground (terrain/grid.js gridSampler). Fewer where the limestone is bare or the
// ground steep; none on paving, the burning-place floor, the city, the garden plots (tufts), nor the trodden middle of
// the Parah path (its edges ragged with them). No shadows cast. Same programs as the scrub (olive_foliage, instance
// colour) and the rocks (terrain_rock): three draw calls on medium and up, two on low.
import { Group, InstancedMesh, IcosahedronGeometry, BufferGeometry, Float32BufferAttribute, Matrix4, Vector3, Quaternion, Euler, Color } from 'three';
import { AMAH } from '../../core/units.js';
import { rng, smooth } from '../mount/kit.js';
import { distToPolyline, rectDist, inRect } from './plan.js';

const CH = 8;                                            // chunk size (m)
// per tier: radius (m), caps, densities per m² (open soil)
const TIERS = [
  { r: 26, tuft: 2200, cush: 0, stone: 600, dT: 2.6, dC: 0, dS: 0.4, sd: 0 },
  { r: 38, tuft: 4500, cush: 300, stone: 1300, dT: 2.8, dC: 0.05, dS: 0.45, sd: 1 },
  { r: 52, tuft: 8000, cush: 520, stone: 2200, dT: 3.0, dC: 0.055, dS: 0.5, sd: 1 },
  { r: 66, tuft: 11000, cush: 760, stone: 3000, dT: 3.0, dC: 0.055, dS: 0.5, sd: 1 },
];
// tints (linear multipliers on olive_foliage's grey-green): straw, pale straw, grey-brown dead grass, a little new green
const TUFT_TINTS = [[2.7, 2.05, 1.5], [3.1, 2.55, 1.9], [2.0, 1.65, 1.5], [1.45, 1.55, 1.05]];
const CUSH_TINTS = [[1.6, 1.45, 1.25], [1.9, 1.55, 1.15], [1.35, 1.3, 1.15]];   // grey, brownish, grey-green (autumn burnet)

/**
 * A clump of dry grass ≈ 0.35 m high and 0.4 m across at scale 1: sixteen tapering blades, each one two-sided triangle,
 * fanning and leaning out from a tight base — tall ones in the middle, short ones round them. The shading normal is
 * mostly up so the clump reads as one soft mass from both sides.
 */
function tuftGeometry(seed) {
  const r = rng(seed);
  const pos = [], nor = [], uv = [];
  const blade = (a, rad, h, w, lean) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    const base = [ca * rad, 0, sa * rad];
    const b0 = [base[0] - sa * w, 0, base[2] + ca * w], b1 = [base[0] + sa * w, 0, base[2] - ca * w];
    const tip = [ca * (rad + h * lean), h * (1 - 0.25 * lean), sa * (rad + h * lean)];
    const nn = [ca * 0.3, 0.95, sa * 0.3];
    const u0 = r() * 3, v0 = r() * 3;
    const tUV = [u0, v0, u0 + 0.05, v0, u0 + 0.025, v0 + 0.35];
    pos.push(...b0, ...b1, ...tip, ...b0, ...tip, ...b1);
    for (let k = 0; k < 6; k++) nor.push(...nn);
    uv.push(...tUV, tUV[0], tUV[1], tUV[4], tUV[5], tUV[2], tUV[3]);
  };
  for (let i = 0; i < 9; i++) blade((i / 9) * Math.PI * 2 + r() * 0.6, 0.02 + 0.05 * r(), 0.22 + 0.16 * r(), 0.012 + 0.008 * r(), 0.2 + 0.5 * r());
  for (let i = 0; i < 7; i++) blade(r() * Math.PI * 2, 0.08 + 0.12 * r(), 0.1 + 0.09 * r(), 0.012 + 0.007 * r(), 0.35 + 0.6 * r());
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.computeBoundingSphere();
  return g;
}

/** a lumpy unit body (icosahedron, each vertex pushed in or out), flattened by `flat`; normals rounded */
function lumpGeometry(detail, seed, flat, base) {
  const r = rng(seed);
  const g0 = new IcosahedronGeometry(1, detail);
  const g = g0.index ? g0.toNonIndexed() : g0;
  const p = g.attributes.position, n = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2);
  const jit = new Map();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    if (!jit.has(key)) jit.set(key, 0.78 + 0.4 * r());
    const k = jit.get(key), l = Math.hypot(x, y, z) || 1;
    p.setXYZ(i, x * k, Math.max(y * k * flat, base), z * k);
    n.set([x / l, y / l * 0.75 + 0.25, z / l], i * 3);
    uv[i * 2] = x * 0.9 + z * 0.4; uv[i * 2 + 1] = y * 0.9 - z * 0.3;
  }
  g.setAttribute('normal', new Float32BufferAttribute(n, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/** integer hash of a chunk -> 32-bit seed */
function hash2(ix, iz, s) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * @param ground (X, Y, out) -> world y of the rendered grid (gridSampler), or null
 * @param feat   terrain/features.js result (garden plots)
 */
export function buildCover(ctx, T, detail, ground, feat = {}) {
  const tier = TIERS[Math.max(0, Math.min(3, detail))];
  const foliageKey = ctx.mats.has?.('olive_foliage') ? 'olive_foliage' : null;
  if (!foliageKey || !ctx.engine?.onUpdate) return null;
  const A = AMAH, m = (v) => v / A;
  const { fp, plan } = T;
  const seed = (ctx.params?.seed ?? 5786) * 101 + 7;
  const pp = plan.parahPath, plots = feat.plots || [];
  const paved = plan.flats.filter((f) => f.id !== 'burning-place');
  const cuts = plan.burning.cut;
  const R = (ctx.quality?.drawDistance || 4000) / A * 0.9;
  const cx0 = (fp.x0 + fp.x1) / 2, cy0 = (fp.y0 + fp.y1) / 2;

  const meshes = [];
  const mk = (geo, key, cap, name, colour) => {
    if (!cap) return null;
    const im = new InstancedMesh(geo, ctx.mats.get(key), cap);
    im.name = name;
    if (colour) im.setColorAt(0, new Color(1, 1, 1));       // allocate instanceColor up front (the scrub's program)
    im.count = 0;
    im.castShadow = false;
    im.receiveShadow = true;
    im.frustumCulled = false;
    meshes.push(im);
    return im;
  };
  const tufts = mk(tuftGeometry(seed + 1), foliageKey, tier.tuft, 'terrain:cover-grass', true);
  const cush = mk(lumpGeometry(1, seed + 2, 0.55, -0.25), foliageKey, tier.cush, 'terrain:cover-cushions', true);
  const stones = mk(lumpGeometry(tier.sd, seed + 3, 0.5, -0.35), 'terrain_rock', tier.stone, 'terrain:cover-stones', false);

  // ---------------------------------------------------------------- one chunk's instances (cached)
  const mtx = new Matrix4(), q = new Quaternion(), e = new Euler(), sc = new Vector3(), pv = new Vector3(), sl = {};
  const cache = new Map();
  function chunk(ix, iz) {
    const key = `${ix},${iz}`;
    let c = cache.get(key);
    if (c) return c;
    c = { T: [], C: [], S: [] };
    cache.set(key, c);
    const x0 = ix * CH, z0 = iz * CH;
    // chunk-level culls (site coordinates of the chunk's centre; a chunk is ≈ 16.7 amot across)
    const Xc = (x0 + CH / 2) / A, Yc = -(z0 + CH / 2) / A, half = m(CH * 0.75);
    if (Math.hypot(Xc - cx0, Yc - cy0) > R) return c;
    if (Xc > fp.x0 + half && Xc < fp.x1 - half && Yc > fp.y0 + half && Yc < fp.y1 - half) return c;
    if (plan.districts.some((d) => inRect(d.rect, Xc, Yc, -half - m(2)))) return c;
    const streets = plan.streets.filter((s) => distToPolyline(s.pts, Xc, Yc).d < s.half + half + m(1));
    const nearPath = distToPolyline(pp.pts, Xc, Yc).d < pp.half + half + m(1);
    const nearFlat = paved.filter((f) => rectDist(f.rect, Xc, Yc) < half + m(1));
    const nearPlots = plots.filter((p) => rectDist(p, Xc, Yc) < half + m(1));
    const nearCut = cuts.some((r) => rectDist(r, Xc, Yc) < half + m(1));
    const r = rng(hash2(ix, iz, seed));
    const spot = (kind, pre) => {
      const x = x0 + CH * r(), z = z0 + CH * r();
      if (pre && !pre(x, z)) return null;
      const X = x / A, Y = -z / A;
      if (T.footDist(X, Y) < 1.5) return null;
      if (plan.districts.some((d) => inRect(d.rect, X, Y, m(2)))) return null;
      for (const s of streets) if (distToPolyline(s.pts, X, Y).d < s.half + m(0.4)) return null;
      for (const f of nearFlat) if (rectDist(f.rect, X, Y) < m(0.5)) return null;
      if (nearCut && cuts.some((rc) => rectDist(rc, X, Y) < m(0.3))) return null;
      if (nearPath) {
        const d = distToPolyline(pp.pts, X, Y).d / pp.half;
        if (d < 0.5 || (d < 1.05 && r() > (kind === 'S' ? 0.6 : 0.3))) return null;
      }
      if (kind !== 'S' && nearPlots.some((p) => inRect(p, X, Y, m(0.3)))) return null;
      const y = ground(X, Y, sl);
      if (y == null) return null;
      return { x, y, z, X, Y, gx: sl.gx, gy: sl.gy, g: Math.hypot(sl.gx, sl.gy) };
    };
    const n = (d) => { const v = d * CH * CH * (0.8 + 0.4 * r()); return Math.floor(v) + (r() < v % 1 ? 1 : 0); };
    // clumping: tufts grow in patches (a few metres), leave others bare
    const patch = (x, z) => smooth(-0.35, 0.3, T.noise.fbm(x / 7 + 13.1, z / 7 - 4.7, 2));
    const nT = tufts ? n(tier.dT) : 0, nC = cush ? n(tier.dC) : 0, nS = stones ? n(tier.dS) : 0;
    for (let i = 0; i < nT; i++) {
      // clumped: swathes of grass, bare ground between (tested first: it is the cheap one)
      const s = spot('T', (x, z) => r() <= 0.1 + 0.9 * patch(x, z));
      if (!s) continue;
      const rk = T.rockiness(s.X, s.Y);
      if (r() > (1 - 0.9 * smooth(0.5, 0.8, rk)) * (1 - smooth(0.45, 0.8, s.g))) continue;
      const k = 0.6 + 0.7 * r() * r();
      // colour by a broad patch noise (whole swathes straw or grey), varied per tuft
      const w = T.noise.fbm(s.x / 23 - 7.7, s.z / 23 + 2.9, 2);
      const t = TUFT_TINTS[w > 0.28 ? 3 : w > 0.05 ? 1 : w > -0.2 ? 0 : 2], v = 0.82 + 0.3 * r();
      put(c.T, s, k * (0.85 + 0.3 * r()), k, k * (0.85 + 0.3 * r()), r() * 6.283, 0.12, [t[0] * v, t[1] * v, t[2] * v], r(), -0.02);
    }
    for (let i = 0; i < nC; i++) {
      const s = spot('C');
      if (!s || s.g > 0.6) continue;
      if (r() > (1 - smooth(0.55, 0.8, T.rockiness(s.X, s.Y))) * (0.3 + 0.7 * patch(s.x + 50, s.z))) continue;
      const k = 0.25 + 0.3 * r(), t = CUSH_TINTS[Math.floor(r() * CUSH_TINTS.length)], v = 0.8 + 0.35 * r();
      put(c.C, s, k * (0.9 + 0.4 * r()), k * (0.8 + 0.4 * r()), k * (0.9 + 0.4 * r()), r() * 6.283, 0.25, [t[0] * v, t[1] * v, t[2] * v], r(), -0.04 * k);
    }
    for (let i = 0; i < nS; i++) {
      const s = spot('S');
      if (!s) continue;
      if (r() > 0.3 + 0.7 * smooth(0.35, 0.7, T.rockiness(s.X, s.Y)) + 0.3 * s.g) continue;
      const k = 0.05 + 0.22 * r() ** 2.2;
      put(c.S, s, k * (0.8 + 0.6 * r()), k * (0.6 + 0.5 * r()), k * (0.8 + 0.6 * r()), r() * 6.283, 0.6, null, r(), -0.3 * k);
    }
    for (const k of ['T', 'C', 'S']) c[k] = pack(c[k]);
    return c;
  }
  /** a chunk's instances of one kind as flat arrays (matrices, colours, x, z, dither) — copied in bulk when the whole
   *  chunk lies inside the unthinned radius */
  function pack(list) {
    const n = list.length, M = new Float32Array(n * 16), C = new Float32Array(n * 3), X = new Float32Array(n), Z = new Float32Array(n), D = new Float32Array(n);
    list.forEach((it, i) => { M.set(it.m, i * 16); if (it.c) C.set(it.c, i * 3); X[i] = it.x; Z[i] = it.z; D[i] = it.d; });
    return { n, M, C, X, Z, D };
  }
  /** an instance: matrix (yaw, tilted toward the ground's slope by `tilt`), colour, the dither of the radius edge */
  function put(list, s, sx, sy, sz, yaw, tilt, col, dither, dy) {
    // yaw about the vertical first, then tilt toward the ground's normal (−gx, 1, gy in world axes) by `tilt`
    e.set(Math.atan(s.gy * tilt), yaw, Math.atan(s.gx * tilt), 'ZXY');
    q.setFromEuler(e);
    sc.set(sx, sy, sz);
    pv.set(s.x, s.y + dy, s.z);
    mtx.compose(pv, q, sc);
    list.push({ m: mtx.toArray(new Float32Array(16)), c: col, x: s.x, z: s.z, d: dither });
  }

  // ---------------------------------------------------------------- the ring round the camera
  let lastX = Infinity, lastZ = Infinity;
  function rebuild(cx, cz) {
    const rr = tier.r, ixa = Math.floor((cx - rr) / CH), ixb = Math.floor((cx + rr) / CH), iza = Math.floor((cz - rr) / CH), izb = Math.floor((cz + rr) / CH);
    const list = [];
    for (let iz = iza; iz <= izb; iz++) {
      for (let ix = ixa; ix <= ixb; ix++) {
        const dx = Math.max(ix * CH - cx, 0, cx - (ix + 1) * CH), dz = Math.max(iz * CH - cz, 0, cz - (iz + 1) * CH);
        if (dx * dx + dz * dz < rr * rr) list.push([dx * dx + dz * dz, ix, iz]);
      }
    }
    list.sort((a, b) => a[0] - b[0]);
    const n = { T: 0, C: 0, S: 0 };
    const target = { T: tufts, C: cush, S: stones };
    const inner = rr * 0.3;
    for (const [, ix, iz] of list) {
      const c = chunk(ix, iz);
      // the chunk's farthest corner: inside the unthinned radius, the whole chunk is copied at once
      const fx = Math.max(Math.abs(ix * CH - cx), Math.abs((ix + 1) * CH - cx)), fz = Math.max(Math.abs(iz * CH - cz), Math.abs((iz + 1) * CH - cz));
      const whole = fx * fx + fz * fz <= inner * inner;
      for (const k of ['T', 'C', 'S']) {
        const im = target[k], P = c[k];
        if (!im || !P.n) continue;
        const cap = im.instanceMatrix.count, M = im.instanceMatrix.array, CA = im.instanceColor?.array;
        if (whole && n[k] + P.n <= cap) {
          M.set(P.M, n[k] * 16);
          if (CA) CA.set(P.C, n[k] * 3);
          n[k] += P.n;
          continue;
        }
        for (let i = 0; i < P.n && n[k] < cap; i++) {
          const dx = P.X[i] - cx, dz = P.Z[i] - cz;
          // thinning with distance: all within 0.3 r, ≈ ¾ at 0.65 r, none at r (the dither is the instance's own)
          if (dx * dx + dz * dz > (rr * (0.3 + 0.7 * Math.sqrt(1 - P.D[i]))) ** 2) continue;
          for (let j = 0, o = n[k] * 16, q = i * 16; j < 16; j++) M[o + j] = P.M[q + j];
          if (CA) { CA[n[k] * 3] = P.C[i * 3]; CA[n[k] * 3 + 1] = P.C[i * 3 + 1]; CA[n[k] * 3 + 2] = P.C[i * 3 + 2]; }
          n[k]++;
        }
      }
    }
    for (const k of ['T', 'C', 'S']) {
      const im = target[k];
      if (!im) continue;
      im.count = n[k];
      im.visible = n[k] > 0;                                         // no zero-instance draw (inside the Mount, the city)
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    // forget chunks far away (memory stays bounded however far one walks)
    if (cache.size > list.length * 3) {
      for (const [key] of cache) {
        const [ix, iz] = key.split(',').map(Number);
        if (Math.hypot((ix + 0.5) * CH - cx, (iz + 0.5) * CH - cz) > rr * 2.5) cache.delete(key);
      }
    }
    stats.instances = n.T + n.C + n.S;
  }
  const stats = { instances: 0 };
  ctx.engine.onUpdate(() => {
    const c = ctx.camera?.position;
    if (!c) return;
    if ((c.x - lastX) ** 2 + (c.z - lastZ) ** 2 < 16) return;      // every 4 m
    lastX = c.x; lastZ = c.z;
    rebuild(c.x, c.z);
  }, 45);
  const group = new Group();
  group.name = 'terrain:cover';
  group.add(...meshes);
  group.userData.stats = stats;
  group.userData.rebuild = rebuild;
  return group;
}

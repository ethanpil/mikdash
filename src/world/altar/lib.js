// Geometry kit for the altar builder. Authored in the SITE frame (X east, Y north, Z up; amot) and emitted as
// WORLD-space BufferGeometry (meters) with world-scaled UVs (1 UV = 1 m — world/geom.js applyWorldUV).
//
// The site→world map (X, Y, Z) → (X·A, Z·A, −Y·A) is a proper rotation (det +1): a triangle wound counter-
// clockwise seen from outside in the site frame stays front-facing in the world frame.
//
//   Mesher          site-space triangles / quads (flat or with explicit normals) → BufferGeometry
//   Buckets         one Mesher per (material, collide, cast) + loose geometries → StaticBatcher (1 draw call / key)
//   sweepRing       a 2D profile [outward offset, z] swept round a closed plan ring (rounded rects, polygons with
//                   per-edge offset weights) with smooth fillet normals and a triangulated top cap (holes allowed)
//   roundedRect / polyRing   ring generators for sweepRing
//   lathe           revolved profile at a site point, with its own metric UVs (arc length round and along)
//   heightField / polarField   ash drifts and mounds, plan UVs (planarUV)
//   logGeometry     a tapered, slightly irregular log with its own bark UVs (u along the log) + end caps
//   rng             deterministic mulberry32
import {
  BufferGeometry, Float32BufferAttribute, Vector2, Vector3, ShapeUtils, LatheGeometry, Matrix4, Quaternion,
} from 'three';
import { AMAH } from '../../core/units.js';
import { applyWorldUV } from '../geom.js';

const EPS = 1e-9;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** smooth 2D value noise in [−1, 1] with a few octaves (deterministic by seed) */
export function noise2(seed = 1) {
  const h = (x, y) => {
    let n = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295 * 2 - 1;
  };
  const s = (t) => t * t * (3 - 2 * t);
  const v = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 3) => { let t = 0, amp = 1, f = 1, norm = 0; for (let i = 0; i < oct; i++) { t += v(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; } return t / norm; };
}

/** site point → world array (meters) */
export const w3 = (p) => [p[0] * AMAH, p[2] * AMAH, -p[1] * AMAH];

/**
 * Plan UVs (u = x, v = −z, meters) for every vertex. For mounds and drifts: applyWorldUV picks a projection per
 * VERTEX, so on a smooth indexed surface a triangle whose corners fall in different classes smears the texture
 * (a pale seam across the tapuach); slopes here stay ≤ ~40°, so the plan stretch is ≤ 1.3× and seamless.
 */
export function planarUV(g) {
  const p = g.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = -p.getZ(i); }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

/** Height-field surface over a site rectangle (indexed, smooth normals, plan UVs): h(X, Y) → Z */
export function heightField(x0, y0, x1, y1, nx, ny, h) {
  const pos = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const X = x0 + ((x1 - x0) * i) / nx, Y = y0 + ((y1 - y0) * j) / ny;
    pos.push(X * AMAH, h(X, Y) * AMAH, -Y * AMAH);
  }
  const row = nx + 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return planarUV(g);
}

/**
 * Polar height-field (mound) about site (cx, cy): rings × segs; rad(θ) the rim radius, h(r01, θ, X, Y) → Z.
 * Rings are spaced by `ringAt(i/rings)` (default linear) so the crown can get a tiny first ring (no pinched star
 * at the apex); h receives the vertex's site X, Y so noise can be sampled in plan (continuous through the centre).
 * Plan UVs.
 */
export function polarField(cx, cy, rings, segs, rad, h, ringAt = (u) => u) {
  const pos = [], idx = [];
  pos.push(cx * AMAH, h(0, 0, cx, cy) * AMAH, -cy * AMAH);
  for (let i = 1; i <= rings; i++) for (let s = 0; s < segs; s++) {
    const t = (2 * Math.PI * s) / segs, r01 = ringAt(i / rings), r = rad(t) * r01;
    const X = cx + r * Math.cos(t), Y = cy + r * Math.sin(t);
    pos.push(X * AMAH, h(r01, t, X, Y) * AMAH, -Y * AMAH);
  }
  const at = (i, s) => (i === 0 ? 0 : 1 + (i - 1) * segs + (s % segs));
  for (let s = 0; s < segs; s++) idx.push(0, at(1, s), at(1, s + 1));
  for (let i = 1; i < rings; i++) for (let s = 0; s < segs; s++) {
    const a = at(i, s), b = at(i, s + 1), c = at(i + 1, s), d = at(i + 1, s + 1);
    idx.push(a, c, d, a, d, b);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return planarUV(g);
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** Site-space triangle accumulator (amot in, meters out). */
export class Mesher {
  constructor() { this.p = []; this.n = []; }
  get tris() { return this.p.length / 9; }

  /** flat triangle; front = counter-clockwise seen from outside */
  tri(a, b, c) {
    const n = cross(sub(b, a), sub(c, a));
    const l = Math.hypot(n[0], n[1], n[2]);
    if (l < 1e-12) return this;
    const u = [n[0] / l, n[1] / l, n[2] / l];
    return this.triN(a, b, c, u, u, u);
  }

  /** triangle with explicit site-frame normals */
  triN(a, b, c, na, nb, nc) {
    const n = cross(sub(b, a), sub(c, a));
    if (Math.hypot(n[0], n[1], n[2]) < 1e-12) return this;
    this.p.push(a[0] * AMAH, a[2] * AMAH, -a[1] * AMAH, b[0] * AMAH, b[2] * AMAH, -b[1] * AMAH, c[0] * AMAH, c[2] * AMAH, -c[1] * AMAH);
    this.n.push(na[0], na[2], -na[1], nb[0], nb[2], -nb[1], nc[0], nc[2], -nc[1]);
    return this;
  }

  quad(a, b, c, d) { this.tri(a, b, c); return this.tri(a, c, d); }
  quadN(a, b, c, d, na, nb, nc, nd) { this.triN(a, b, c, na, nb, nc); return this.triN(a, c, d, na, nc, nd); }

  /** quad oriented so its normal agrees with hint */
  quadH(a, b, c, d, hint) {
    const n = cross(sub(b, a), sub(c, a));
    return dot(n, hint) < 0 ? this.quad(a, d, c, b) : this.quad(a, b, c, d);
  }

  /** planar polygon (any winding) triangulated, oriented to the hint normal; holes optional (same plane) */
  poly(pts0, hint, holes0 = []) {
    const ax = Math.abs(hint[0]), ay = Math.abs(hint[1]), az = Math.abs(hint[2]);
    const [i, j] = az >= ax && az >= ay ? [0, 1] : ax >= ay ? [1, 2] : [0, 2];
    const dedupe = (arr) => {
      const out = [];
      for (const p of arr) { const q = out[out.length - 1]; if (!q || Math.abs(q[i] - p[i]) + Math.abs(q[j] - p[j]) > 1e-7) out.push(p); }
      while (out.length > 2 && Math.abs(out[0][i] - out[out.length - 1][i]) + Math.abs(out[0][j] - out[out.length - 1][j]) < 1e-7) out.pop();
      return out;
    };
    const pts = dedupe(pts0), holes = holes0.map(dedupe);
    if (pts.length < 3) return this;
    const flat = [pts, ...holes].flat();
    const tris = ShapeUtils.triangulateShape(pts.map((p) => new Vector2(p[i], p[j])), holes.map((h) => h.map((p) => new Vector2(p[i], p[j]))));
    const hn = norm(hint);
    for (const [a, b, c] of tris) {
      const n = cross(sub(flat[b], flat[a]), sub(flat[c], flat[a]));
      if (dot(n, hint) < 0) this.triN(flat[a], flat[c], flat[b], hn, hn, hn); else this.triN(flat[a], flat[b], flat[c], hn, hn, hn);
    }
    return this;
  }

  /** axis-aligned box (site min/max); faces = subset of 'xXyYzZ' (lower case = min side) */
  box(min, max, faces = 'xXyYzZ') {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    if (faces.includes('X')) this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
    if (faces.includes('x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
    if (faces.includes('Y')) this.quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
    if (faces.includes('y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
    if (faces.includes('Z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
    if (faces.includes('z')) this.quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
    return this;
  }

  /** a box rotated about Z (rad) around its centre */
  boxRot(c, size, ang, faces = 'xXyYzZ') {
    const [hx, hy] = [size[0] / 2, size[1] / 2];
    const cs = Math.cos(ang), sn = Math.sin(ang);
    const P = (x, y, z) => [c[0] + x * cs - y * sn, c[1] + x * sn + y * cs, z];
    const z0 = c[2], z1 = c[2] + size[2];
    const v = [P(-hx, -hy, 0), P(hx, -hy, 0), P(hx, hy, 0), P(-hx, hy, 0)];
    const lo = v.map((p) => [p[0], p[1], z0]), hi = v.map((p) => [p[0], p[1], z1]);
    if (faces.includes('Z')) this.quad(hi[0], hi[1], hi[2], hi[3]);
    if (faces.includes('z')) this.quad(lo[0], lo[3], lo[2], lo[1]);
    for (let i = 0; i < 4; i++) { const k = (i + 1) % 4; this.quad(lo[i], lo[k], hi[k], hi[i]); }
    return this;
  }

  /** append another mesher */
  merge(o) { for (let i = 0; i < o.p.length; i++) this.p.push(o.p[i]); for (let i = 0; i < o.n.length; i++) this.n.push(o.n[i]); return this; }

  geometry(uvScale = 1) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    applyWorldUV(g, uvScale);
    return g;
  }
}

/** Material buckets → StaticBatcher. m(key, {collide, cast}) returns a Mesher; geo() adds a ready geometry. */
export class Buckets {
  constructor() { this.map = new Map(); this.extra = []; }
  m(key, o = {}) {
    const collide = o.collide ?? true, cast = o.cast ?? true;
    const k = `${key}|${collide ? 1 : 0}|${cast ? 1 : 0}`;
    let b = this.map.get(k);
    if (!b) { b = { key, collide, cast, mesher: new Mesher() }; this.map.set(k, b); }
    return b.mesher;
  }
  geo(g, key, o = {}) { this.extra.push([g, key, { collide: o.collide ?? true, castShadow: o.cast ?? true, worldUV: !!o.worldUV }]); }
  /** returns { tris } and feeds the batcher */
  flush(batcher) {
    let tris = 0;
    for (const { key, collide, cast, mesher } of this.map.values()) {
      if (!mesher.tris) continue;
      tris += mesher.tris;
      batcher.add(mesher.geometry(), key, { collide, castShadow: cast });
    }
    for (const [g, key, opts] of this.extra) {
      tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
      batcher.add(g, key, opts);
    }
    return { tris };
  }
}

// ---------------------------------------------------------------- rings for sweepRing (CCW seen from +Z)

/** rounded rectangle ring generator: (o) → points of the rect grown by o, corner radius max(r + o, ε) */
export function roundedRect(x0, y0, x1, y1, r, segs = 3) {
  const n = Math.max(0, segs | 0);
  return (o) => {
    const rr = Math.max(r + o, 1e-4);
    const X0 = x0 - o, Y0 = y0 - o, X1 = x1 + o, Y1 = y1 + o;
    const pts = [];
    const corner = (cx, cy, a0) => {
      if (n === 0) { pts.push([cx + rr * Math.cos(a0 + Math.PI / 4) * Math.SQRT2, cy + rr * Math.sin(a0 + Math.PI / 4) * Math.SQRT2]); return; }
      for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI / 2) * i / n; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    };
    corner(X0 + rr, Y0 + rr, Math.PI);          // SW
    corner(X1 - rr, Y0 + rr, -Math.PI / 2);     // SE
    corner(X1 - rr, Y1 - rr, 0);                // NE
    corner(X0 + rr, Y1 - rr, Math.PI / 2);      // NW
    return pts;
  };
}

/** polygon ring generator with per-edge offset weights (0 = that edge stays put, e.g. against another body) */
export function polyRing(pts, weights = null) {
  const n = pts.length;
  const nrm = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    nrm.push([dy / l, -dx / l]);
  }
  const w = weights || pts.map(() => 1);
  return (o) => pts.map((p, i) => {
    const i0 = (i - 1 + n) % n;
    const n1 = nrm[i0], n2 = nrm[i];
    const a = o * w[i0], b = o * w[i];
    const det = n1[0] * n2[1] - n1[1] * n2[0];
    if (Math.abs(det) < 1e-6) return [p[0] + n1[0] * a, p[1] + n1[1] * a];
    return [p[0] + (a * n2[1] - b * n1[1]) / det, p[1] + (b * n1[0] - a * n2[0]) / det];
  });
}

/**
 * Sweep a profile round a closed plan ring.
 *   M(key) → Mesher; ringAt(o) → CCW points (same count for every o)
 *   profile: [[o, z, key?], …] bottom → top; o = outward offset (amot); key = material of the segment ABOVE the point
 *   opts: mat (default key), cap (top cap), capMat, capHoles ([[x,y]…] at the top level), smoothPlan / smoothProf (deg),
 *         skipEdges (Set of edge indices to leave open — e.g. faces buried against another body),
 *         subdiv (max segment length, amot: tessellate rings and profile), displace ((x, y, z) → amot, applied along the
 *         horizontal part of the vertex's averaged normal, so tops and caps stay sealed), dispZMax (no displacement above),
 *         capBottom (close the first ring at the first profile height, facing down — e.g. a slab's underside, so no
 *         slit opens between the sides and an inset panel), matAt ((edge, key, x, y, z) → key|null: a per-face material
 *         override; edge = index in the un-subdivided ring, x y z = the face's mid-point), dispFull (displace every
 *         profile point by the full amount, horizontally — for a moulding riding on a displaced wall)
 */
export function sweepRing(M, ringAt0, profile0, opts = {}) {
  const mat = opts.mat || 'lime_whitewash';
  const sub = opts.subdiv || 0;
  let profile = profile0, ringAt = ringAt0, edgeMap = null;
  if (sub > 0) {
    profile = [];
    for (let k = 0; k < profile0.length; k++) {
      const p = profile0[k];
      profile.push(p);
      const q = profile0[k + 1];
      if (!q) continue;
      const c = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / sub);
      for (let s = 1; s < c; s++) { const t = s / c; profile.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2]]); }
    }
    const r0 = ringAt0(profile0[0][0]), n0 = r0.length;
    const counts = r0.map((p, i) => { const q = r0[(i + 1) % n0]; return Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / sub)); });
    edgeMap = [];
    counts.forEach((c, i) => { for (let s = 0; s < c; s++) edgeMap.push(i); });
    ringAt = (o) => {
      const r = ringAt0(o), out = [];
      r.forEach((p, i) => { const q = r[(i + 1) % r.length]; for (let s = 0; s < counts[i]; s++) { const t = s / counts[i]; out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } });
      return out;
    };
  }
  const rings = profile.map(([o]) => ringAt(o));
  const n = rings[0].length;
  const base = rings[0];
  // plan normals per edge and smoothed per vertex
  const en = [];
  for (let i = 0; i < n; i++) {
    const a = base[i], b = base[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
    en.push(l < 1e-7 ? null : [dy / l, -dx / l]);
  }
  for (let i = 0; i < n; i++) if (!en[i]) { let k = 1; while (!en[(i + k) % n] && k < n) k++; en[i] = en[(i + k) % n]; }
  const cosP = Math.cos(((opts.smoothPlan ?? 40) * Math.PI) / 180);
  const vn = (v, e) => { // normal at vertex v for its edge e (e = v, or e = v − 1)
    const a = en[e], b = e === v ? en[(v - 1 + n) % n] : en[v];
    if (a[0] * b[0] + a[1] * b[1] >= cosP) { const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
    return a;
  };
  // profile normals per segment and smoothed per point
  const sn = [];
  for (let k = 0; k < profile.length - 1; k++) {
    const dO = profile[k + 1][0] - profile[k][0], dZ = profile[k + 1][1] - profile[k][1];
    const l = Math.hypot(dO, dZ) || 1;
    sn.push([dZ / l, -dO / l]);
  }
  const cosS = Math.cos(((opts.smoothProf ?? 50) * Math.PI) / 180);
  const pn = (k, s) => { // profile normal at point k for segment s
    const a = sn[s];
    const o = s === k ? sn[k - 1] : sn[k];
    if (!o) return a;
    if (a[0] * o[0] + a[1] * o[1] >= cosS) { const x = a[0] + o[0], y = a[1] + o[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
    return a;
  };
  const N = (pl, pr) => norm([pl[0] * pr[0], pl[1] * pr[0], pr[1]]);
  const skip = opts.skipEdges || null;
  // displacement: one direction per (ring vertex, profile point) — the averaged plan normal × the horizontal part of
  // the averaged profile normal — so neighbouring faces move together and no seam opens
  const disp = opts.displace || null, zMax = opts.dispZMax ?? Infinity;
  const avgPlan = (v) => { const a = en[v], b = en[(v - 1 + n) % n]; const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
  const avgProfH = (k) => { const a = sn[Math.min(k, sn.length - 1)], b = sn[Math.max(0, k - 1)]; const x = a[0] + b[0], y = a[1] + b[1]; return x / (Math.hypot(x, y) || 1); };
  const P3 = (ring, v, k, z) => {
    const p = ring[v];
    if (!disp || z > zMax) return [p[0], p[1], z];
    const h = opts.dispFull ? 1 : avgProfH(k);
    if (Math.abs(h) < 1e-3) return [p[0], p[1], z];
    const d2 = avgPlan(v), off = disp(p[0], p[1], z) * h;
    return [p[0] + d2[0] * off, p[1] + d2[1] * off, z];
  };
  const matAt = opts.matAt || null;
  for (let k = 0; k < profile.length - 1; k++) {
    const key = profile[k][2] || mat;
    const m = M(key);
    const zA = profile[k][1], zB = profile[k + 1][1];
    const rA = rings[k], rB = rings[k + 1];
    for (let i = 0; i < n; i++) {
      const e = edgeMap ? edgeMap[i] : i;
      if (skip && skip.has(e)) continue;
      const j = (i + 1) % n;
      const A = P3(rA, i, k, zA), B = P3(rA, j, k, zA), C = P3(rB, j, k + 1, zB), D = P3(rB, i, k + 1, zB);
      const pi = vn(i, i), pj = vn(j, i);
      const mm = matAt ? M(matAt(e, key, (rA[i][0] + rA[j][0]) / 2, (rA[i][1] + rA[j][1]) / 2, (zA + zB) / 2) || key) : m;
      mm.quadN(A, B, C, D, N(pi, pn(k, k)), N(pj, pn(k, k)), N(pj, pn(k + 1, k)), N(pi, pn(k + 1, k)));
    }
  }
  const clean = (ring) => {
    // drop coincident points (collapsed corner arcs)
    const pts = [];
    for (const p of ring) { const q = pts[pts.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) pts.push(p); }
    if (pts.length > 2 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop();
    return pts;
  };
  if (opts.cap) {
    const z = profile[profile.length - 1][1];
    M(opts.capMat || mat).poly(clean(rings[rings.length - 1]).map((p) => [p[0], p[1], z]), [0, 0, 1], (opts.capHoles || []).map((h) => h.map((p) => [p[0], p[1], z])));
  }
  if (opts.capBottom) {
    const z = profile[0][1];
    M(profile[0][2] || mat).poly(clean(rings[0]).map((p) => [p[0], p[1], z]), [0, 0, -1]);
  }
  return rings;
}

/** circle polygon (CCW) */
export function circle(cx, cy, r, n, a0 = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = a0 + (2 * Math.PI * i) / n; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}

/**
 * Lathe with its own metric UVs: u = arc length round the axis at that profile point's radius, v = arc length along
 * the profile (meters). No per-vertex projection classes, so no smeared seam down a bowl; the one texture seam is at
 * φ = phiStart (three's lathe puts φ = 0 toward local +z = world south).
 */
function latheMetric(prof, seg, phiStart) {
  const pts = prof.map(([r, z]) => new Vector2(Math.max(0, r) * AMAH, z * AMAH));
  const g = new LatheGeometry(pts, seg, phiStart);
  const n = pts.length, uv = g.attributes.uv;
  const s = [0];
  for (let j = 1; j < n; j++) s.push(s[j - 1] + pts[j].distanceTo(pts[j - 1]));
  for (let i = 0; i <= seg; i++) for (let j = 0; j < n; j++) {
    const k = i * n + j;
    uv.setXY(k, (i / seg) * 2 * Math.PI * Math.max(pts[j].x, 0.02), s[j]);
  }
  uv.needsUpdate = true;
  return g;
}

/** Revolved profile [[r, z], …] (amot) centred at site point c; world geometry with metric lathe UVs */
export function lathe(prof, c, seg = 16, phiStart = 0) {
  const g = latheMetric(prof, seg, phiStart);
  g.translate(c[0] * AMAH, c[2] * AMAH, -c[1] * AMAH);
  return g;
}

/** Revolved profile as LOCAL geometry (meters, axis +y, base at origin), metric lathe UVs */
export function latheLocal(prof, seg = 16, phiStart = 0) {
  return latheMetric(prof, seg, phiStart);
}

/** rescale a Torus/Tube geometry's 0..1 UVs to meters (u along the ring: wood grain follows a wheel rim) */
export function torusUV(g, R, r) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2 * Math.PI * R, uv.getY(i) * 2 * Math.PI * r);
  uv.needsUpdate = true;
  return g;
}

/** world-space matrix placing a local (meters) object at site point p, yawed by a compass-free angle about Z (rad, CCW in plan) */
export function siteMatrix(p, yaw = 0, scale = 1) {
  const m = new Matrix4();
  const q = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yaw);
  m.compose(new Vector3(p[0] * AMAH, p[2] * AMAH, -p[1] * AMAH), q, new Vector3(scale, scale, scale));
  return m;
}

/**
 * A log as two LOCAL geometries (meters): bark side (u along the log, v round it — the bark set's rows run along u)
 * and end caps. Axis +X, centred at the origin. r0/r1 radii at −x/+x (m); bump = radial irregularity (fraction);
 * squash (< 1) flattens the section across local y (a split or half-round billet), turned by `roll` about the axis.
 */
export function logGeometry(len, r0, r1, seg, R, bump = 0.06, rows = 3, squash = 1, roll = 0) {
  const pos = [], nor = [], uv = [], cpos = [], cnor = [], cuv = [];
  const ou = R() * 0.96, ov = R() * 0.96, bu = R() * 2.4, bv = R() * 0.96; // per-log texture offsets
  const ring = [];
  const phase = R() * 6.28, phase2 = R() * 6.28;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  for (let k = 0; k <= rows; k++) {
    const t = k / rows, x = -len / 2 + len * t, r = r0 + (r1 - r0) * t;
    const pts = [];
    for (let i = 0; i < seg; i++) {
      const a = (2 * Math.PI * i) / seg;
      const rr = r * (1 + bump * (Math.sin(a * 3 + phase + t * 2) * 0.6 + Math.sin(a * 5 + phase2) * 0.4));
      const y0 = Math.cos(a) * rr * squash, z0 = Math.sin(a) * rr;
      // ellipse normal ∝ (cos a / squash, sin a), then rolled
      const ny0 = Math.cos(a) / squash, nz0 = Math.sin(a), nl = Math.hypot(ny0, nz0) || 1;
      pts.push([x, y0 * cr - z0 * sr, y0 * sr + z0 * cr, a, r, (ny0 * cr - nz0 * sr) / nl, (ny0 * sr + nz0 * cr) / nl]);
    }
    ring.push(pts);
  }
  for (let k = 0; k < rows; k++) {
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      const q = [ring[k][i], ring[k][j], ring[k + 1][j], ring[k + 1][i]];
      const tri = [[0, 1, 2], [0, 2, 3]];
      for (const t of tri) for (const v of t) {
        const p = q[v];
        pos.push(p[0], p[1], p[2]);
        nor.push(0, p[5], p[6]);
        const vv = (v === 1 || v === 2) && j === 0 ? 2 * Math.PI * p[4] : p[3] * p[4];
        uv.push(p[0] + len / 2 + bu, vv + bv);
      }
    }
  }
  for (const [end, sgn] of [[0, -1], [rows, 1]]) {
    const pts = ring[end];
    const cx = pts[0][0];
    for (let i = 0; i < seg; i++) {
      const j = (i + 1) % seg;
      const a = pts[i], b = pts[j];
      const tri = sgn > 0 ? [[cx, 0, 0], a, b] : [[cx, 0, 0], b, a];
      for (const p of tri) {
        cpos.push(p[0], p[1], p[2]);
        cnor.push(sgn, 0, 0);
        cuv.push(p[2] + ou, p[1] + ov);
      }
    }
  }
  const side = new BufferGeometry();
  side.setAttribute('position', new Float32BufferAttribute(pos, 3));
  side.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  side.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const caps = new BufferGeometry();
  caps.setAttribute('position', new Float32BufferAttribute(cpos, 3));
  caps.setAttribute('normal', new Float32BufferAttribute(cnor, 3));
  caps.setAttribute('uv', new Float32BufferAttribute(cuv, 2));
  return { side, caps };
}

/** orient a local +X log so it runs from site point a to site point b; returns { matrix, len (m) } */
export function logBetween(a, b) {
  const A = new Vector3(...w3(a)), B = new Vector3(...w3(b));
  const d = B.clone().sub(A);
  const len = d.length();
  const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), d.normalize());
  const m = new Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new Vector3(1, 1, 1));
  return { matrix: m, len };
}

/**
 * A half-burnt brand from site point a (the end that lay in the fire) to b, as world geometries: the burnt part
 * (fraction `burnt` of the length) tapering to the tip and a little thinner than the bark it burnt back from (charred
 * wood shrinks), then the bark. r = the bark's radius (m). Returns { burnt: [side, caps], bark: [side], ends: [caps] }.
 */
export function brandGeometry(a, b, r, R, burnt = 0.4) {
  const m = a.map((v, i) => v + (b[i] - v) * burnt);
  const out = { burnt: [], bark: [], ends: [] };
  for (const [p, q, r0, r1, part] of [[a, m, r * 0.55, r * 0.82, 'burnt'], [m, b, r * 0.95, r, 'bark']]) {
    const { matrix, len } = logBetween(p, q);
    const g = logGeometry(len, r0, r1, 6, R, 0.07, 2, 0.85, R() * 3);
    g.side.applyMatrix4(matrix); g.caps.applyMatrix4(matrix);
    if (part === 'burnt') out.burnt.push(g.side, g.caps);
    else { out.bark.push(g.side); out.ends.push(g.caps); }
  }
  return out;
}

export { AMAH };

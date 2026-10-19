// Geometry primitives for the Heichal builder, authored in the SITE frame (X east, Y north, Z up; amot) and
// emitted as WORLD-space BufferGeometry (meters) with world-scaled UVs (1 UV = 1 m, see world/geom.js).
// The site→world map (X, Y, Z) → (X·A, Z·A, −Y·A) is a proper rotation, so counter-clockwise-from-outside
// winding in the site frame stays front-facing in the world.
//
//   Mesher      site-space triangle accumulator → BufferGeometry
//   gridSolid   union(adds) − union(subs) of axis-aligned boxes on their non-uniform grid, greedy-merged faces,
//               no internal faces, a material key per face (keys may carry a "|uvTag" suffix, see kit.js)
//   sweep       a 2D profile swept along a straight horizontal run (stringcourses, cornices)
//   lathe       a revolved profile placed at a site point (world geometry) / latheLocal (local, for instancing)
//   tube        a round bar between two site points (branches, rods, chains at low detail)
import { BufferGeometry, Float32BufferAttribute, LatheGeometry, Vector2, Vector3, Matrix4, Quaternion, ShapeUtils } from 'three';
import { AMAH } from '../../../core/units.js';
import { applyWorldUV } from '../../geom.js';

const EPS = 1e-6;

export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scl3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len3 = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm3 = (a) => { const l = len3(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** box literal: B(x0,y0,z0,x1,y1,z1, tags) → { min, max, ...tags } (normalised) */
export function B(x0, y0, z0, x1, y1, z1, tags) {
  return {
    min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)],
    max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)],
    ...(tags || {}),
  };
}
/** site element box (or a params box) → B with tags */
export const EB = (box, tags) => ({ min: [...box.min], max: [...box.max], ...(tags || {}) });

/** Site-space triangle accumulator. Coordinates in amot; output in world meters. */
export class Mesher {
  constructor() { this.p = []; this.n = []; }
  get count() { return this.p.length / 9; }

  tri(a, b, c) {
    const A = AMAH;
    const ax = a[0] * A, ay = a[2] * A, az = -a[1] * A;
    const bx = b[0] * A, by = b[2] * A, bz = -b[1] * A;
    const cx = c[0] * A, cy = c[2] * A, cz = -c[1] * A;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return this;
    nx /= l; ny /= l; nz /= l;
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    return this;
  }

  /** triangle with explicit site-frame vertex normals */
  triN(a, b, c, na, nb, nc) {
    const A = AMAH;
    this.p.push(a[0] * A, a[2] * A, -a[1] * A, b[0] * A, b[2] * A, -b[1] * A, c[0] * A, c[2] * A, -c[1] * A);
    this.n.push(na[0], na[2], -na[1], nb[0], nb[2], -nb[1], nc[0], nc[2], -nc[1]);
    return this;
  }

  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); return this; }

  /** quad oriented so its normal agrees with hint (site vector) */
  quadH(a, b, c, d, hint) {
    const n = cross3(sub3(b, a), sub3(c, a));
    if (dot3(n, hint) < 0) return this.quad(a, d, c, b);
    return this.quad(a, b, c, d);
  }

  /** planar polygon (site points) triangulated, oriented to the hint normal */
  poly(pts, hint) {
    const ax = Math.abs(hint[0]), ay = Math.abs(hint[1]), az = Math.abs(hint[2]);
    const [i, j] = az >= ax && az >= ay ? [0, 1] : ax >= ay ? [1, 2] : [0, 2];
    const tris = ShapeUtils.triangulateShape(pts.map((p) => new Vector2(p[i], p[j])), []);
    for (const [a, b, c] of tris) {
      const n = cross3(sub3(pts[b], pts[a]), sub3(pts[c], pts[a]));
      if (dot3(n, hint) < 0) this.tri(pts[a], pts[c], pts[b]); else this.tri(pts[a], pts[b], pts[c]);
    }
    return this;
  }

  /** axis-aligned box (site min/max), all faces or a subset ('xXyYzZ': lower = min side) */
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

  /** box rotated about Z by angle (rad) around its centre */
  boxRot(center, size, angle, faces = 'xXyYzZ') {
    const [cx, cy, cz] = center, [sx, sy, sz] = size;
    const c = Math.cos(angle), s = Math.sin(angle);
    const P = (dx, dy, dz) => [cx + dx * c - dy * s, cy + dx * s + dy * c, cz + dz];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const v = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    if (faces.includes('Z')) this.quad(v[4], v[5], v[6], v[7]);
    if (faces.includes('z')) this.quad(v[0], v[3], v[2], v[1]);
    if (faces.includes('X')) this.quad(v[1], v[2], v[6], v[5]);
    if (faces.includes('x')) this.quad(v[0], v[4], v[7], v[3]);
    if (faces.includes('Y')) this.quad(v[3], v[7], v[6], v[2]);
    if (faces.includes('y')) this.quad(v[0], v[1], v[5], v[4]);
    return this;
  }

  /** prism from p0 to p1 with a w × h section; `up` orients the section */
  beam(p0, p1, w, h, up = [0, 0, 1], ends = true) {
    const d = sub3(p1, p0); const L = len3(d); if (L < 1e-9) return this;
    const dn = scl3(d, 1 / L);
    let sd = cross3(dn, up); let sl = len3(sd);
    if (sl < 1e-6) { sd = cross3(dn, [1, 0, 0]); sl = len3(sd); }
    sd = scl3(sd, 1 / sl);
    const uv = cross3(sd, dn);
    const c = (p, a, b) => add3(add3(p, scl3(sd, a * w / 2)), scl3(uv, b * h / 2));
    const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const A = q.map(([a, b]) => c(p0, a, b)), Bq = q.map(([a, b]) => c(p1, a, b));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const mid = add3(scl3(sd, (q[i][0] + q[j][0]) / 2), scl3(uv, (q[i][1] + q[j][1]) / 2));
      this.quadH(A[i], A[j], Bq[j], Bq[i], mid);
    }
    if (ends) { this.quadH(A[0], A[1], A[2], A[3], scl3(dn, -1)); this.quadH(Bq[0], Bq[1], Bq[2], Bq[3], dn); }
    return this;
  }

  merge(m) { for (const v of m.p) this.p.push(v); for (const v of m.n) this.n.push(v); return this; }

  geometry() {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    applyWorldUV(g);
    return g;
  }
}

/**
 * Solid = union(adds) − union(subs), meshed on the non-uniform grid of all box bounds (plus `cuts`, extra
 * grid planes per axis that only split faces), greedy-merged per material key.
 *   mat(face) → key | null (skip). face = { axis 0|1|2, dir ±1 (normal along +/−axis), at, center:[X,Y,Z],
 *   sub (the sub box the face looks into, first listed wins, or null), add (the add box owning the solid cell; the
 *   LAST listed add covering a cell owns it) }.  Returns Map(key → Mesher). No internal faces are emitted.
 */
export function gridSolid(adds, subs, mat, cuts = [[], [], []], out = new Map()) {
  if (!adds.length) return out;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of adds) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.min[a]); hi[a] = Math.max(hi[a], b.max[a]); }
  const R = (v) => Math.round(v * 1e5) / 1e5;
  const C = [new Set(), new Set(), new Set()];
  const clampR = (a, v) => R(Math.min(hi[a], Math.max(lo[a], v)));
  for (const b of [...adds, ...subs]) for (let a = 0; a < 3; a++) { C[a].add(clampR(a, b.min[a])); C[a].add(clampR(a, b.max[a])); }
  for (let a = 0; a < 3; a++) for (const v of cuts[a] || []) C[a].add(clampR(a, v));
  const G = C.map((s) => Float64Array.from([...s].sort((p, q) => p - q)));
  const nx = G[0].length - 1, ny = G[1].length - 1, nz = G[2].length - 1;
  if (nx < 1 || ny < 1 || nz < 1) return out;
  const N = nx * ny * nz;
  const solid = new Int32Array(N).fill(-1);
  const subId = new Int32Array(N).fill(-1);
  const cell = (i, j, k) => (k * ny + j) * nx + i;
  const find = (arr, v) => {
    let l = 0, h = arr.length - 1; const t = R(v);
    while (l <= h) { const m = (l + h) >> 1; if (arr[m] < t - 1e-7) l = m + 1; else if (arr[m] > t + 1e-7) h = m - 1; else return m; }
    return Math.max(0, Math.min(arr.length - 1, l));
  };
  const range = (b) => [0, 1, 2].map((a) => [find(G[a], Math.max(lo[a], b.min[a])), find(G[a], Math.min(hi[a], b.max[a]))]);
  adds.forEach((b, s) => {
    const [[i0, i1], [j0, j1], [k0, k1]] = range(b);
    for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) solid[cell(i, j, k)] = s;
  });
  subs.forEach((b, s) => {
    if (b.max[0] <= lo[0] || b.min[0] >= hi[0] || b.max[1] <= lo[1] || b.min[1] >= hi[1] || b.max[2] <= lo[2] || b.min[2] >= hi[2]) return;
    const [[i0, i1], [j0, j1], [k0, k1]] = range(b);
    for (let k = k0; k < k1; k++) for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) {
      const c = cell(i, j, k);
      solid[c] = -1;
      if (subId[c] < 0) subId[c] = s;
    }
  });
  const keys = [];
  const keyId = new Map();
  const idOf = (k) => { let v = keyId.get(k); if (v == null) { v = keys.length + 1; keys.push(k); keyId.set(k, v); } return v; };
  const face = { axis: 0, dir: 1, at: 0, center: [0, 0, 0], sub: null, add: null };
  const dims = [nx, ny, nz];
  const idx3 = [0, 0, 0];
  for (let axis = 0; axis < 3; axis++) {
    const ua = (axis + 1) % 3, va = (axis + 2) % 3;
    const nu = dims[ua], nv = dims[va], na = dims[axis];
    const maskP = new Int32Array(nu * nv), maskN = new Int32Array(nu * nv);
    for (let p = 0; p <= na; p++) {
      maskP.fill(0); maskN.fill(0);
      let any = false;
      for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
        idx3[ua] = u; idx3[va] = v;
        let A = -1, Bc = -1, ca = -1, cb = -1;
        if (p > 0) { idx3[axis] = p - 1; ca = cell(idx3[0], idx3[1], idx3[2]); A = solid[ca]; }
        if (p < na) { idx3[axis] = p; cb = cell(idx3[0], idx3[1], idx3[2]); Bc = solid[cb]; }
        if ((A >= 0) === (Bc >= 0)) continue;
        const dir = A >= 0 ? 1 : -1;
        const empty = A >= 0 ? cb : ca;
        face.axis = axis; face.dir = dir; face.at = G[axis][p];
        face.center[axis] = G[axis][p];
        face.center[ua] = (G[ua][u] + G[ua][u + 1]) / 2;
        face.center[va] = (G[va][v] + G[va][v + 1]) / 2;
        face.sub = empty >= 0 && subId[empty] >= 0 ? subs[subId[empty]] : null;
        face.add = adds[A >= 0 ? A : Bc];
        const key = mat(face);
        if (key == null) continue;
        (dir > 0 ? maskP : maskN)[v * nu + u] = idOf(key);
        any = true;
      }
      if (!any) continue;
      for (const [mask, dir] of [[maskP, 1], [maskN, -1]]) {
        for (let v = 0; v < nv; v++) for (let u = 0; u < nu; u++) {
          const id = mask[v * nu + u];
          if (!id) continue;
          let w = 1;
          while (u + w < nu && mask[v * nu + u + w] === id) w++;
          let h = 1;
          grow: while (v + h < nv) { for (let q = 0; q < w; q++) if (mask[(v + h) * nu + u + q] !== id) break grow; h++; }
          for (let r = 0; r < h; r++) for (let q = 0; q < w; q++) mask[(v + r) * nu + u + q] = 0;
          const u0 = G[ua][u], u1 = G[ua][u + w], v0 = G[va][v], v1 = G[va][v + h], at = G[axis][p];
          const P = (uu, vv) => { const o = [0, 0, 0]; o[axis] = at; o[ua] = uu; o[va] = vv; return o; };
          let m = out.get(keys[id - 1]);
          if (!m) { m = new Mesher(); out.set(keys[id - 1], m); }
          if (dir > 0) m.quad(P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1));
          else m.quad(P(u0, v0), P(u0, v1), P(u1, v1), P(u1, v0));
        }
      }
    }
  }
  return out;
}

/**
 * Sweep a profile along a straight horizontal run.
 *   prof: [[u, v], …] from the wall face (u = 0) outward (u) and upward (v), ending back on the face (amot)
 *   a, b: [X, Y] run endpoints on the face line; z: base height; outN: [ox, oy] outward unit normal
 */
export function sweep(m, prof, a, b, z, outN, caps = true) {
  const P = (end, [u, v]) => [end[0] + outN[0] * u, end[1] + outN[1] * u, z + v];
  const d = [b[0] - a[0], b[1] - a[1], 0];
  for (let i = 0; i + 1 < prof.length; i++) {
    const p = prof[i], q = prof[i + 1];
    const du = q[0] - p[0], dv = q[1] - p[1];
    if (Math.abs(du) < EPS && Math.abs(dv) < EPS) continue;
    const nu = dv, nv = -du;
    m.quadH(P(a, p), P(b, p), P(b, q), P(a, q), [outN[0] * nu, outN[1] * nu, nv]);
  }
  if (caps) {
    const L = Math.hypot(d[0], d[1]) || 1;
    const dn = [d[0] / L, d[1] / L, 0];
    if (prof.length >= 3) {
      m.poly(prof.map((p) => P(a, p)), scl3(dn, -1));
      m.poly(prof.map((p) => P(b, p)), dn);
    }
  }
  return m;
}

/** Revolved profile [[r, z], …] (amot, from the base) at site point c → WORLD geometry with world UVs */
export function lathe(prof, c, seg = 16) {
  const g = new LatheGeometry(prof.map(([r, z]) => new Vector2(Math.max(0, r) * AMAH, z * AMAH)), seg);
  g.translate(c[0] * AMAH, c[2] * AMAH, -c[1] * AMAH);
  applyWorldUV(g);
  return g;
}

/** Revolved profile as LOCAL geometry (meters, axis +y, base at origin) — instancing */
export function latheLocal(prof, seg = 16) {
  const g = new LatheGeometry(prof.map(([r, z]) => new Vector2(Math.max(0, r) * AMAH, z * AMAH)), seg);
  applyWorldUV(g);
  return g;
}

const _q = new Quaternion();
const _m = new Matrix4();
const _up = new Vector3(0, 1, 0);
/**
 * Revolved profile [[r, s], …] placed along the axis from site point p0 toward p1 (s = distance along the axis,
 * amot). Returns WORLD geometry. Used for ornaments on the menorah's diagonal branches.
 */
export function latheAlong(prof, p0, p1, seg = 12) {
  const g = new LatheGeometry(prof.map(([r, s]) => new Vector2(Math.max(0, r) * AMAH, s * AMAH)), seg);
  const a = new Vector3(p0[0] * AMAH, p0[2] * AMAH, -p0[1] * AMAH);
  const b = new Vector3(p1[0] * AMAH, p1[2] * AMAH, -p1[1] * AMAH);
  const d = b.sub(a).normalize();
  _q.setFromUnitVectors(_up, d);
  _m.compose(a, _q, new Vector3(1, 1, 1));
  g.applyMatrix4(_m);
  applyWorldUV(g);
  return g;
}

/** round bar between two site points (radius r amot) → WORLD geometry */
export function tube(p0, p1, r, seg = 8, caps = false) {
  const L = len3(sub3(p1, p0));
  const prof = caps ? [[0, 0], [r, 0], [r, L], [0, L]] : [[r, 0], [r, L]];
  return latheAlong(prof, p0, p1, seg);
}

/** world geometry from a Mesher-like callback (convenience) */
export function meshOf(fn) { const m = new Mesher(); fn(m); return m.geometry(); }

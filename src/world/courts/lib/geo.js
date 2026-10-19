// Geometry primitives for the courts builder, authored in the SITE frame (X east, Y north, Z up; amot) and
// emitted as WORLD-space BufferGeometry (meters) with world-scaled UVs (1 UV = 1 m, see world/geom.js).
//
// The site→world map (X, Y, Z) → (X·A, Z·A, −Y·A) is a proper rotation (det +1), so a triangle wound
// counter-clockwise when seen from outside in the site frame stays front-facing in the world frame.
//
//   Mesher        accumulate site-space triangles/quads → BufferGeometry
//   gridSolid     union(adds) − union(subs) of axis-aligned boxes, meshed on the non-uniform grid of their
//                 bounds with greedy face merging: closed, outward-wound, no internal faces; a material per face
//   sweep         a 2D profile swept along a straight horizontal run (cornices, rails), with end caps
//   lathe         a revolved profile (columns, jars, lamps) placed at a site point
import { BufferGeometry, Float32BufferAttribute, LatheGeometry, Vector2, ShapeUtils } from 'three';
import { AMAH } from '../../../core/units.js';
import { applyWorldUV } from '../../geom.js';

const EPS = 1e-6;

/** Site-space triangle accumulator. Coordinates in amot; output in world meters. */
export class Mesher {
  constructor() { this.p = []; this.n = []; this.smooth = false; }
  get count() { return this.p.length / 9; }

  /** flat triangle (a, b, c site [X,Y,Z]); front = counter-clockwise seen from outside */
  tri(a, b, c) {
    const ax = a[0] * AMAH, ay = a[2] * AMAH, az = -a[1] * AMAH;
    const bx = b[0] * AMAH, by = b[2] * AMAH, bz = -b[1] * AMAH;
    const cx = c[0] * AMAH, cy = c[2] * AMAH, cz = -c[1] * AMAH;
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) return this;
    nx /= l; ny /= l; nz /= l;
    this.p.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    this.n.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    return this;
  }

  /** triangle with explicit site-frame vertex normals (smooth surfaces) */
  triN(a, b, c, na, nb, nc) {
    this.p.push(a[0] * AMAH, a[2] * AMAH, -a[1] * AMAH, b[0] * AMAH, b[2] * AMAH, -b[1] * AMAH, c[0] * AMAH, c[2] * AMAH, -c[1] * AMAH);
    this.n.push(na[0], na[2], -na[1], nb[0], nb[2], -nb[1], nc[0], nc[2], -nc[1]);
    return this;
  }

  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); return this; }

  /** quad oriented so its normal agrees with hint (site vector) */
  quadH(a, b, c, d, hint) {
    const n = cross(sub(b, a), sub(c, a));
    if (dot(n, hint) < 0) return this.quad(a, d, c, b);
    return this.quad(a, b, c, d);
  }

  /** planar polygon (site points, any winding) triangulated, oriented to hint normal */
  poly(pts, hint) {
    // project to the plane's dominant axes
    const ax = Math.abs(hint[0]), ay = Math.abs(hint[1]), az = Math.abs(hint[2]);
    const [i, j] = az >= ax && az >= ay ? [0, 1] : ax >= ay ? [1, 2] : [0, 2];
    const c2 = pts.map((p) => new Vector2(p[i], p[j]));
    const tris = ShapeUtils.triangulateShape(c2, []);
    for (const [a, b, c] of tris) {
      const n = cross(sub(pts[b], pts[a]), sub(pts[c], pts[a]));
      if (dot(n, hint) < 0) this.tri(pts[a], pts[c], pts[b]); else this.tri(pts[a], pts[b], pts[c]);
    }
    return this;
  }

  /** axis-aligned box (site min/max), all six faces (or a subset: faces = 'xXyYzZ' letters, lower = min side) */
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

  /** a box rotated about Z by angle (rad) around its centre (site units) */
  boxRot(center, size, angle, faces) {
    const [cx, cy, cz] = center, [sx, sy, sz] = size;
    const c = Math.cos(angle), s = Math.sin(angle);
    const P = (dx, dy, dz) => [cx + dx * c - dy * s, cy + dx * s + dy * c, cz + dz];
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;
    const v = [P(-hx, -hy, -hz), P(hx, -hy, -hz), P(hx, hy, -hz), P(-hx, hy, -hz), P(-hx, -hy, hz), P(hx, -hy, hz), P(hx, hy, hz), P(-hx, hy, hz)];
    const f = faces || 'xXyYzZ';
    if (f.includes('Z')) this.quad(v[4], v[5], v[6], v[7]);
    if (f.includes('z')) this.quad(v[0], v[3], v[2], v[1]);
    if (f.includes('X')) this.quad(v[1], v[2], v[6], v[5]);
    if (f.includes('x')) this.quad(v[0], v[4], v[7], v[3]);
    if (f.includes('Y')) this.quad(v[3], v[7], v[6], v[2]);
    if (f.includes('y')) this.quad(v[0], v[1], v[5], v[4]);
    return this;
  }

  /** prism from p0 to p1 (site points) with a w × h section; `up` orients the section (default +Z) */
  beam(p0, p1, w, h, up = [0, 0, 1], ends = true) {
    const d = sub(p1, p0); const L = Math.hypot(...d); if (L < 1e-9) return this;
    const dn = scl(d, 1 / L);
    let sd = cross(dn, up); let sl = Math.hypot(...sd);
    if (sl < 1e-6) { sd = cross(dn, [1, 0, 0]); sl = Math.hypot(...sd); }
    sd = scl(sd, 1 / sl);
    const uv = cross(sd, dn);
    const c = (p, a, b) => add(add(p, scl(sd, a * w / 2)), scl(uv, b * h / 2));
    const q = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const A = q.map(([a, b]) => c(p0, a, b)), Bq = q.map(([a, b]) => c(p1, a, b));
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const mid = add(scl(sd, (q[i][0] + q[j][0]) / 2), scl(uv, (q[i][1] + q[j][1]) / 2));
      this.quadH(A[i], A[j], Bq[j], Bq[i], mid);
    }
    if (ends) { this.quadH(A[0], A[1], A[2], A[3], scl(dn, -1)); this.quadH(Bq[0], Bq[1], Bq[2], Bq[3], dn); }
    return this;
  }

  /** append another Mesher */
  merge(m) { for (const v of m.p) this.p.push(v); for (const v of m.n) this.n.push(v); return this; }

  geometry(uvScale = 1) {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new Float32BufferAttribute(this.n, 3));
    applyWorldUV(g, uvScale);
    return g;
  }
}

export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** box literal helper: B(x0,y0,z0,x1,y1,z1, extra) → { min, max, ...extra } (normalised) */
export function B(x0, y0, z0, x1, y1, z1, extra) {
  return { min: [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], max: [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)], ...(extra || {}) };
}
/** site element box → B (optionally merged with extra tags) */
export const EB = (e, extra) => ({ min: [...e.box.min], max: [...e.box.max], ...(extra || {}) });
/** intersection of two boxes or null */
export function isect(a, b) {
  const min = [0, 1, 2].map((i) => Math.max(a.min[i], b.min[i]));
  const max = [0, 1, 2].map((i) => Math.min(a.max[i], b.max[i]));
  return min.every((v, i) => v < max[i] - EPS) ? { min, max } : null;
}
export const inside = (b, p) => p[0] > b.min[0] && p[0] < b.max[0] && p[1] > b.min[1] && p[1] < b.max[1] && p[2] > b.min[2] && p[2] < b.max[2];

/**
 * Solid = union(adds) − union(subs) on the non-uniform grid of all box bounds, greedy-meshed.
 *   adds, subs: [{ min:[X,Y,Z], max:[X,Y,Z], ...tags }]
 *   mat(face) -> material key; face = { axis 0|1|2, dir ±1, at, center:[X,Y,Z], sub (the sub box the face looks into, or null), add (the add box the solid cell belongs to) }
 * Returns Map(materialKey -> Mesher). Faces between two solid cells are never emitted (no internal faces).
 */
export function gridSolid(adds, subs, mat, out = new Map()) {
  if (!adds.length) return out;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const b of adds) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], b.min[a]); hi[a] = Math.max(hi[a], b.max[a]); }
  const R = (v) => Math.round(v * 1e5) / 1e5;
  const C = [new Set(), new Set(), new Set()];
  const clampR = (a, v) => R(Math.min(hi[a], Math.max(lo[a], v)));
  for (const b of [...adds, ...subs]) for (let a = 0; a < 3; a++) { C[a].add(clampR(a, b.min[a])); C[a].add(clampR(a, b.max[a])); }
  const G = C.map((s) => Float64Array.from([...s].sort((p, q) => p - q)));
  const [X, Y, Z] = G;
  const nx = X.length - 1, ny = Y.length - 1, nz = Z.length - 1;
  if (nx < 1 || ny < 1 || nz < 1) return out;
  const N = nx * ny * nz;
  const solid = new Int32Array(N).fill(-1);   // index of the add box, -1 = empty
  const subId = new Int32Array(N).fill(-1);
  const cell = (i, j, k) => (k * ny + j) * nx + i;
  const find = (arr, v) => { // index of value (exact after rounding) via binary search
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
  for (let axis = 0; axis < 3; axis++) {
    const ua = (axis + 1) % 3, va = (axis + 2) % 3; // in-plane axes (cyclic so u × v = +axis)
    const nu = dims[ua], nv = dims[va], na = dims[axis];
    const maskP = new Int32Array(nu * nv), maskN = new Int32Array(nu * nv);
    const idx3 = [0, 0, 0];
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
          // u × v = +axis for the cyclic pair, so (u0v0, u1v0, u1v1, u0v1) faces +axis
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
 *   prof: [[u, v], …] from the wall face (u = 0) outward and upward, ending back on the face; u outward, v up (amot)
 *   a, b: [X, Y] run endpoints on the face line; z: reference height (v = 0); outN: [ox, oy] outward unit normal
 *   caps: add end caps (default true)
 */
export function sweep(m, prof, a, b, z, outN, caps = true) {
  const P = (end, [u, v]) => [end[0] + outN[0] * u, end[1] + outN[1] * u, z + v];
  const d = [b[0] - a[0], b[1] - a[1], 0];
  for (let i = 0; i + 1 < prof.length; i++) {
    const p = prof[i], q = prof[i + 1];
    const du = q[0] - p[0], dv = q[1] - p[1];
    if (Math.abs(du) < EPS && Math.abs(dv) < EPS) continue;
    // outward normal of segment p→q in (u, v): rotate by −90°
    const nu = dv, nv = -du;
    const hint = [outN[0] * nu, outN[1] * nu, nv];
    m.quadH(P(a, p), P(b, p), P(b, q), P(a, q), hint);
  }
  if (caps) {
    const len = Math.hypot(d[0], d[1]) || 1;
    const dn = [d[0] / len, d[1] / len, 0];
    const ring = prof.slice(0, prof.length - (samePt(prof[0], prof[prof.length - 1]) ? 1 : 0));
    if (ring.length >= 3) {
      m.poly(ring.map((p) => P(a, p)), scl(dn, -1));
      m.poly(ring.map((p) => P(b, p)), dn);
    }
  }
  return m;
}
const samePt = (p, q) => Math.abs(p[0] - q[0]) < EPS && Math.abs(p[1] - q[1]) < EPS;

/**
 * Revolved profile at site point c (base), returning WORLD geometry (meters) with world UVs.
 *   prof: [[r, z], …] in amot from the base, bottom to top; seg: radial segments
 */
export function lathe(prof, c, seg = 16, uv = true) {
  const g = new LatheGeometry(prof.map(([r, z]) => new Vector2(Math.max(0, r) * AMAH, z * AMAH)), seg);
  g.translate(c[0] * AMAH, c[2] * AMAH, -c[1] * AMAH);
  if (uv) applyWorldUV(g);
  return g;
}

/** Revolved profile as LOCAL geometry (meters, axis = +y, base at origin) — for InstancedMesh parts. */
export function latheLocal(prof, seg = 16) {
  const g = new LatheGeometry(prof.map(([r, z]) => new Vector2(Math.max(0, r) * AMAH, z * AMAH)), seg);
  applyWorldUV(g);
  return g;
}

/** Closed wedge (ramp) solid: rises from z0 at the `from` edge to z1 at the `to` edge over the plan rectangle.
 *  axis 'x'|'y': direction of the slope; from/to are the coordinates along that axis; [c0, c1] the cross extent. */
export function wedge(m, axis, from, to, c0, c1, z0, z1, zBase = z0) {
  const pt = (s, c, z) => (axis === 'x' ? [s, c, z] : [c, s, z]);
  const lo = [pt(from, c0, zBase), pt(from, c1, zBase), pt(to, c1, zBase), pt(to, c0, zBase)];
  const top = [pt(from, c0, z0), pt(from, c1, z0), pt(to, c1, z1), pt(to, c0, z1)];
  const up = [0, 0, 1];
  m.quadH(top[0], top[1], top[2], top[3], up);
  m.quadH(lo[0], lo[1], lo[2], lo[3], [0, 0, -1]);
  const sdir = Math.sign(to - from);
  const along = axis === 'x' ? [sdir, 0, 0] : [0, sdir, 0];
  const cross_ = axis === 'x' ? [0, 1, 0] : [1, 0, 0];
  if (z1 > zBase) m.quadH(lo[3], lo[2], top[2], top[3], along);
  if (z0 > zBase) m.quadH(lo[0], lo[1], top[1], top[0], scl(along, -1));
  m.poly([lo[0], lo[3], top[3], top[0]].filter(uniqueZ), scl(cross_, -1));
  m.poly([lo[1], lo[2], top[2], top[1]].filter(uniqueZ), cross_);
  return m;
}
function uniqueZ(p, i, arr) { return !arr.slice(0, i).some((q) => Math.abs(q[0] - p[0]) < EPS && Math.abs(q[1] - p[1]) < EPS && Math.abs(q[2] - p[2]) < EPS); }

/** Circle points helper: n points on an arc (site plane), angles in radians (0 = +X, CCW). */
export function arc(cx, cy, r, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
  return pts;
}

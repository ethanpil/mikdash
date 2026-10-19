// Geometry kit shared by the mount and terrain builders (owned by build-mount).
// Everything is authored in SITE coordinates (X east, Y north, Z up, amot) and converted to world meters here.
//   const k = new Kit(ctx, 'mount');
//   k.faces([x0,y0,z0], [x1,y1,z1], { e: 'herodian_wall', t: 'ashlar_plain' });   // only the listed faces
//   k.box(min, max, 'marble_white', { collide: false });
//   k.quad([p0,p1,p2,p3], [nx,ny,nz], key)      // site points, outward normal (site axes) fixes the winding
//   k.extrude(shape, plane, key)                 // a THREE.Shape drawn in a vertical wall plane, extruded through it
//   group.add(k.build());
import { BufferGeometry, Float32BufferAttribute, ExtrudeGeometry, ShapeGeometry, Matrix4, Vector3, BoxGeometry } from 'three';
import { StaticBatcher, applyWorldUV } from '../geom.js';
import { m2w, AMAH } from '../../core/units.js';

const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _d = new Vector3(), _n = new Vector3();

/** site direction vector -> world direction vector */
export function siteDir(n, t = new Vector3()) { return t.set(n[0], n[2], -n[1]); }

/** Non-indexed quad (two triangles) from four WORLD points; winding chosen so the face normal points along `nWorld`. */
export function worldQuad(a, b, c, d, nWorld) {
  _n.subVectors(b, a).cross(_c.subVectors(c, a));
  let p = [a, b, c, d];
  if (nWorld && _n.dot(nWorld) < 0) p = [a, d, c, b];
  const n = _n.subVectors(p[1], p[0]).cross(_d.subVectors(p[2], p[0])).normalize();
  const idx = [0, 1, 2, 0, 2, 3];
  const pos = new Float32Array(18), nor = new Float32Array(18);
  idx.forEach((k, i) => { pos.set([p[k].x, p[k].y, p[k].z], i * 3); nor.set([n.x, n.y, n.z], i * 3); });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  return g;
}

/** Quad from four SITE points (any winding) with outward site normal n. */
export function siteQuad(pts, n) {
  return worldQuad(m2w(...pts[0], _a.clone()), m2w(...pts[1], _b.clone()), m2w(...pts[2]), m2w(...pts[3]), siteDir(n));
}

/** Axis-aligned site box as six optional faces. mats: { e, w, n, s, t, b } (east +X, west −X, north +Y, south −Y, top, bottom). */
export function boxFaceGeos(min, max, which = 'ewnstb') {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const out = {};
  if (which.includes('e')) out.e = siteQuad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]);
  if (which.includes('w')) out.w = siteQuad([[x0, y0, z0], [x0, y1, z0], [x0, y1, z1], [x0, y0, z1]], [-1, 0, 0]);
  if (which.includes('n')) out.n = siteQuad([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], [0, 1, 0]);
  if (which.includes('s')) out.s = siteQuad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]);
  if (which.includes('t')) out.t = siteQuad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]);
  if (which.includes('b')) out.b = siteQuad([[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], [0, 0, -1]);
  return out;
}

/** World-space BoxGeometry from a site box (all faces), world UVs. */
export function siteBox(min, max) {
  const c = m2w((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const g = new BoxGeometry(Math.abs(max[0] - min[0]) * AMAH, Math.abs(max[2] - min[2]) * AMAH, Math.abs(max[1] - min[1]) * AMAH);
  g.translate(c.x, c.y, c.z);
  return applyWorldUV(g);
}

/**
 * Matrix mapping a local "wall plane" frame to world: local x = along-wall coordinate s (amot), local y = Z (amot),
 * local z = thickness coordinate t (amot) — for along 'X' t is site Y, for along 'Y' t is site X.
 */
export function planeMatrix(along) {
  const A = AMAH;
  const m = new Matrix4();
  if (along === 'X') {
    // world = (s*A, y*A, -t*A)
    m.set(A, 0, 0, 0, 0, A, 0, 0, 0, 0, -A, 0, 0, 0, 0, 1);
  } else {
    // site X = t, site Y = s -> world = (t*A, y*A, -s*A)
    m.set(0, 0, A, 0, 0, A, 0, 0, -A, 0, 0, 0, 0, 0, 0, 1);
  }
  return m;
}

/** Extrude a Shape drawn in (s, Z) amot through t0..t1 of a wall plane ('X' or 'Y' along). Returns world geometry. */
export function extrudeInPlane(shape, along, t0, t1, curveSegments = 12) {
  const g = new ExtrudeGeometry(shape, { depth: t1 - t0, bevelEnabled: false, curveSegments, steps: 1 });
  g.translate(0, 0, t0);
  g.applyMatrix4(planeMatrix(along));
  // the matrix for along 'X' flips handedness (det < 0): fix winding so normals point outward
  if (planeMatrix(along).determinant() < 0) flipWinding(g);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return applyWorldUV(g);
}

/** Flat Shape face in a wall plane at thickness t, facing +t (dir = 1) or −t (dir = −1). */
export function shapeInPlane(shape, along, t, dir = 1, curveSegments = 12) {
  const g = new ShapeGeometry(shape, curveSegments);
  g.translate(0, 0, t);
  const m = planeMatrix(along);
  g.applyMatrix4(m);
  // ShapeGeometry faces +z local; after the matrix that is +t (along 'Y': +X site) or −t (along 'X': −Y site... see sign)
  const nLocal = new Vector3(0, 0, 1).transformDirection(m);
  const want = along === 'X' ? siteDir([0, dir, 0]) : siteDir([dir, 0, 0]);
  if (nLocal.dot(want) < 0) flipWinding(g);
  g.deleteAttribute('uv');
  g.computeVertexNormals();
  return applyWorldUV(g);
}

export function flipWinding(g) {
  if (g.index) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    g.index.needsUpdate = true;
  } else {
    for (const name of Object.keys(g.attributes)) {
      const at = g.attributes[name], it = at.itemSize, arr = at.array;
      for (let i = 0; i < at.count; i += 3) {
        for (let k = 0; k < it; k++) { const t = arr[(i + 1) * it + k]; arr[(i + 1) * it + k] = arr[(i + 2) * it + k]; arr[(i + 2) * it + k] = t; }
      }
      at.needsUpdate = true;
    }
  }
  return g;
}

/** A StaticBatcher wrapper that speaks site coordinates. */
export class Kit {
  constructor(ctx, name) {
    this.ctx = ctx;
    this.b = new StaticBatcher(ctx, name);
    this.tris = 0;
  }

  geo(g, key, opts) {
    if (!g) return this;
    this.tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    this.b.add(g, key, opts);
    return this;
  }

  box(min, max, key, opts) { return this.geo(siteBox(min, max), key, opts); }

  /** faces: { e: key, w: key, n, s, t, b } — only listed faces are emitted. */
  faces(min, max, mats, opts) {
    if (max[0] - min[0] <= 1e-6 && !('e' in mats || 'w' in mats)) return this;
    const which = Object.keys(mats).filter((k) => mats[k]).join('');
    const g = boxFaceGeos(min, max, which);
    for (const k of Object.keys(g)) this.geo(g[k], mats[k], opts);
    return this;
  }

  quad(pts, n, key, opts) { return this.geo(siteQuad(pts, n), key, opts); }

  extrude(shape, along, t0, t1, key, opts, seg) { return this.geo(extrudeInPlane(shape, along, t0, t1, seg), key, opts); }

  build() { return this.b.build(); }
}

/** Piecewise-linear interpolation of [[x, y], ...] (clamped at the ends). */
export function interp(points, x) {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (x <= points[i][0]) {
      const [a, ya] = points[i - 1], [b, yb] = points[i];
      return b === a ? yb : ya + (yb - ya) * (x - a) / (b - a);
    }
  }
  return points[points.length - 1][1];
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;

/** Deterministic PRNG (mulberry32). */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

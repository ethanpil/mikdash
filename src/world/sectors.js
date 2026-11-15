// perf-cpu round 2: cells around the Mount — an inner disc and rings cut into angular sectors — so three's frustum test
// can drop the parts of a landscape-wide batch that lie behind or beside the viewer. The world's merged batches (one mesh
// per material over the precinct and its surroundings) and the landscape's instanced batches (olive crowns, rocks) were
// drawn whole from every view: at the Azarah 79 % of the terrain's triangles and 72 % of the Mount's lay outside the view
// frustum (docs/decisions/perf-cpu.md). Rings, not plain sectors: three culls by bounding sphere, and the sphere of a
// wedge that starts at the apex holds the apex — every sector would pass the test for a viewer on the Mount. A wedge of
// a ring (inner radius ≥ 0.3 × the outer) has a sphere clear of the centre. Each piece keeps the batch's material
// instance, flags and layers (no new material or program) and gets a bounding sphere of its own triangles / instances.
// Colliders are not touched: the builders register them from the whole batch before it is split.
//
// Round 2b: a piece must be worth its draw call. Cells holding fewer than `sectorMin` triangles (instances × the
// geometry's triangles for instanced batches) go into ONE remainder piece per batch (a big sphere, nearly always drawn:
// one call, as the whole batch was); a batch left with fewer than two pieces besides the remainder, or with more than
// 70 % of its triangles in the remainder, stays whole.
import { BufferGeometry, BufferAttribute, Mesh, InstancedMesh, Sphere, Vector3, Matrix4, Box3, Color } from 'three';
import { m2w } from '../core/units.js';

// Six sectors: the coarsest cells whose spheres still clear the centre (a 60° wedge of a ring whose inner radius is
// ≥ 0.3 × its outer).
export const SECTORS = 6;
/** ring boundaries (m from the Mount's centre): the disc inside the first is one cell (the precinct and its walls) */
export const RINGS = [250, 800, 2400];
/** the Mount's own rings (m): its walls and stoas stand ≈ 120 m from the centre, inside the landscape's first disc */
export const MOUNT_RINGS = [60, 200];
/** a piece's least triangle count (`?sectorMin=N` overrides: measuring); see docs/decisions/perf-cpu.md, round 2b */
export const SECTOR_MIN = 4000;
/** a batch whose remainder would hold more than this share of its triangles stays whole */
const MAX_REST = 0.7;

/** cells on? `?sectors=0` turns them off (the batches whole, as before: an A/B switch for the GPU on the HD 4600) */
export function sectorsOn(ctx) { return ctx?.params?.raw?.get?.('sectors') !== '0'; }
/** the least triangles of a piece */
export function sectorMin(ctx) { const v = +ctx?.params?.raw?.get?.('sectorMin'); return Number.isFinite(v) && v > 0 ? v : SECTOR_MIN; }
/** the Mount's clear interior's centre (site amot 250, 250), the cells' apex — world x, z */
export function mountCentre() { const c = m2w(250, 250, 0); return [c.x, c.z]; }
/** time a split at build (ctx.sectorStats: ms, batches split, pieces made — reported by the perf tools) */
export function timed(ctx, fn) {
  const st = ctx.sectorStats ||= { ms: 0, batches: 0, pieces: 0 };
  const t0 = performance.now();
  try { return fn(st); } finally { st.ms += performance.now() - t0; }
}

/** sector of world point (x, z) among n around (cx, cz), offset by `rot` radians: 0 … n − 1 */
export function sectorOf(x, z, cx, cz, n = SECTORS, rot = 0) {
  let a = Math.atan2(z - cz, x - cx) - rot;
  a -= Math.floor(a / (2 * Math.PI)) * 2 * Math.PI;
  return Math.min(n - 1, Math.floor(a / (2 * Math.PI / n)));
}
/** cell of world point (x, z): 0 inside the first ring, else 1 + ring × n + sector */
export function cellOf(x, z, cx, cz, rings = RINGS, n = SECTORS) {
  const d = Math.hypot(x - cx, z - cz);
  if (d < rings[0]) return 0;
  let r = 0;
  while (r + 1 < rings.length && d >= rings[r + 1]) r++;
  return 1 + r * n + sectorOf(x, z, cx, cz, n);
}
export const cellCount = (rings = RINGS, n = SECTORS) => 1 + rings.length * n;

/**
 * Pieces from the triangles per cell: cells of ≥ `min` triangles their own piece (in cell order), the rest one remainder
 * piece (last). → { of: Int16Array cell → piece (−1 empty), n: pieces, rest: true when the last is the remainder }, or
 * null when the batch should stay whole (fewer than 2 pieces besides the remainder, or a remainder over MAX_REST).
 */
export function groupCells(tris, min) {
  let total = 0, rest = 0, big = 0;
  for (const t of tris) { total += t; if (t >= min) big++; else rest += t; }
  if (big < 2 || rest > MAX_REST * total) return null;
  const of = new Int16Array(tris.length).fill(-1);
  let k = 0;
  tris.forEach((t, c) => { if (t >= min) of[c] = k++; });
  if (rest > 0) tris.forEach((t, c) => { if (t > 0 && t < min) of[c] = k; });
  return { of, n: k + (rest > 0 ? 1 : 0), rest: rest > 0 };
}

/** a copy of a mesh's look for a piece: same material instance, flags, layers, render order, user data */
function likeMesh(src, geo) {
  const m = new Mesh(geo, src.material);
  m.castShadow = src.castShadow; m.receiveShadow = src.receiveShadow;
  m.layers.mask = src.layers.mask;
  m.renderOrder = src.renderOrder;
  m.frustumCulled = src.frustumCulled;
  m.visible = src.visible;
  m.matrixAutoUpdate = src.matrixAutoUpdate;
  m.matrix.copy(src.matrix); m.matrixWorld.copy(src.matrixWorld);
  m.position.copy(src.position); m.quaternion.copy(src.quaternion); m.scale.copy(src.scale);
  m.userData = { ...src.userData, sectorOf: src.name };
  if (src.raycast !== Mesh.prototype.raycast) m.raycast = src.raycast;
  return m;
}

/**
 * Split a non-indexed merged Mesh (StaticBatcher / Kit output: world-space, identity transform) by the cell of each
 * triangle's centroid, small cells into one remainder (groupCells). Returns the pieces, or null when it is not worth
 * splitting (indexed, transformed, morph targets, groups, under 2 × `min` triangles, or groupCells says whole).
 * Attributes keep their own typed arrays, normalisation, usage and gpuType.
 */
export function splitMeshBySector(mesh, { n = SECTORS, rings = RINGS, min = SECTOR_MIN, centre = mountCentre() } = {}) {
  const g = mesh.geometry;
  if (!mesh.isMesh || mesh.isInstancedMesh || g.index || g.groups.length || Object.keys(g.morphAttributes).length) return null;
  if (!mesh.matrix.equals(new Matrix4())) return null;
  const pos = g.attributes.position;
  const nTri = Math.floor(Math.min(pos.count, g.drawRange.count) / 3);
  if (nTri < 2 * min) return null;
  const [cx, cz] = centre;
  const N = cellCount(rings, n);
  const sec = new Uint8Array(nTri), perCell = new Array(N).fill(0);
  const P = pos.array;
  for (let t = 0; t < nTri; t++) {
    const o = t * 9;
    const x = (P[o] + P[o + 3] + P[o + 6]) / 3, z = (P[o + 2] + P[o + 5] + P[o + 8]) / 3;
    const s = cellOf(x, z, cx, cz, rings, n);
    sec[t] = s; perCell[s]++;
  }
  const grp = groupCells(perCell, min);
  if (!grp) return null;
  // one pass per attribute: each triangle copied to its piece's cursor
  const count = new Uint32Array(grp.n);
  for (let t = 0; t < nTri; t++) { const p = grp.of[sec[t]]; sec[t] = p; count[p]++; }
  const geos = Array.from({ length: grp.n }, () => new BufferGeometry());
  for (const k of Object.keys(g.attributes)) {
    const at = g.attributes[k], sz = at.itemSize, src = at.array, stride = 3 * sz;
    const dst = Array.from({ length: grp.n }, (_, p) => new src.constructor(count[p] * stride));
    const cur = new Uint32Array(grp.n);
    for (let t = 0; t < nTri; t++) {
      const d = dst[sec[t]], o = t * stride;
      let w = cur[sec[t]];
      for (let j = 0; j < stride; j++) d[w++] = src[o + j];   // (element copy: a subarray view per triangle cost more)
      cur[sec[t]] = w;
    }
    for (let p = 0; p < grp.n; p++) {
      const a = new BufferAttribute(dst[p], sz, at.normalized);
      a.usage = at.usage;
      if (at.gpuType !== undefined) a.gpuType = at.gpuType;
      geos[p].setAttribute(k, a);
    }
  }
  return geos.map((geo, p) => {
    geo.computeBoundingSphere();
    const m = likeMesh(mesh, geo);
    m.name = `${mesh.name}#${grp.rest && p === grp.n - 1 ? 'rest' : `p${p}`}`;
    return m;
  });
}

/** replace each mesh of `meshes` (children of their parents) by its pieces (timed in ctx.sectorStats) */
export function splitMeshes(ctx, meshes, opts = {}) {
  return timed(ctx, (st) => {
    for (const mesh of meshes) {
      const pieces = splitMeshBySector(mesh, { min: sectorMin(ctx), ...opts });
      if (!pieces) continue;
      const parent = mesh.parent;
      const i = parent.children.indexOf(mesh);
      parent.remove(mesh);
      for (const p of pieces) parent.add(p);
      // (the pieces where the batch was among its parent's children: a stable traversal order)
      parent.children.splice(i, 0, ...parent.children.splice(parent.children.length - pieces.length, pieces.length));
      mesh.geometry.dispose();
      st.batches++; st.pieces += pieces.length;
    }
    return st;
  });
}

const _p = new Vector3(), _s = new Sphere(), _b = new Box3();
/**
 * A sphere holding instance matrices `mats` (Float32Array of 16 each, indices `idx`) applied to `geo`'s bounding sphere:
 * the union of each instance's own sphere (centre transformed, radius × the matrix's largest scale).
 */
export function instancesSphere(geo, mats, idx) {
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const gs = geo.boundingSphere, M = new Matrix4();
  _b.makeEmpty();
  const spheres = [];
  for (const i of idx) {
    M.fromArray(mats, i * 16);
    _s.copy(gs).applyMatrix4(M);
    spheres.push(_s.clone());
    _b.expandByPoint(_p.copy(_s.center).addScalar(_s.radius));
    _b.expandByPoint(_p.copy(_s.center).addScalar(-_s.radius));
  }
  const out = new Sphere();
  if (!spheres.length) return out.makeEmpty();
  _b.getCenter(out.center);
  let r = 0;
  for (const s of spheres) r = Math.max(r, out.center.distanceTo(s.center) + s.radius);
  out.radius = r;
  return out;
}

/** triangles of one instance of a geometry */
export const geoTris = (geo) => Math.floor((geo.index ? geo.index.count : geo.attributes.position.count) / 3);

/**
 * Group instances (world x, z of each: `xz(i)`) into pieces by cell: → { pieces: [[i…]…] in cell order, the remainder
 * last } or null (stay whole). Weight of a cell = its instances × `trisEach`.
 */
export function groupInstances(count, xz, trisEach, { n = SECTORS, rings = RINGS, min = SECTOR_MIN, centre = mountCentre() } = {}) {
  const [cx, cz] = centre;
  const N = cellCount(rings, n);
  const cell = new Uint8Array(count), per = new Array(N).fill(0);
  const p = [0, 0];
  for (let i = 0; i < count; i++) { xz(i, p); cell[i] = cellOf(p[0], p[1], cx, cz, rings, n); per[cell[i]] += trisEach; }
  const grp = groupCells(per, min);
  if (!grp) return null;
  const pieces = Array.from({ length: grp.n }, () => []);
  for (let i = 0; i < count; i++) pieces[grp.of[cell[i]]].push(i);
  return { pieces, rest: grp.rest };
}

/**
 * Split a static InstancedMesh by cell (groupInstances): one InstancedMesh per piece, same geometry and material, the
 * instances (and colours) in their original order, each with its own bounding sphere. Returns the pieces, or null.
 */
export function splitInstancedBySector(im, opts = {}) {
  if (!im.isInstancedMesh) return null;
  const M = im.instanceMatrix.array, C = im.instanceColor?.array || null;
  const grp = groupInstances(im.count, (i, out) => { out[0] = M[i * 16 + 12]; out[1] = M[i * 16 + 14]; }, geoTris(im.geometry), opts);
  if (!grp) return null;
  return grp.pieces.map((list, k) => {
    const p = new InstancedMesh(im.geometry, im.material, list.length);
    p.name = `${im.name}#${grp.rest && k === grp.pieces.length - 1 ? 'rest' : `p${k}`}`;
    list.forEach((i, j) => {
      p.instanceMatrix.array.set(M.subarray(i * 16, i * 16 + 16), j * 16);
      if (C) p.setColorAt(j, _col.fromArray(C, i * 3));
    });
    p.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
    p.castShadow = im.castShadow; p.receiveShadow = im.receiveShadow;
    p.layers.mask = im.layers.mask; p.renderOrder = im.renderOrder; p.frustumCulled = im.frustumCulled; p.visible = im.visible;
    p.matrixAutoUpdate = im.matrixAutoUpdate; p.matrix.copy(im.matrix); p.matrixWorld.copy(im.matrixWorld);
    p.userData = { ...im.userData, sectorOf: im.name };
    p.computeBoundingSphere();
    return p;
  });
}
const _col = new Color();

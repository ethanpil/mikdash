// perf-cpu round 2: cells around the Mount — an inner disc and rings cut into angular sectors — so three's frustum test
// can drop the parts of a landscape-wide batch that lie behind or beside the viewer. The world's merged batches (one mesh
// per material over the precinct and its surroundings) and the landscape's instanced batches (olive crowns, rocks) were
// drawn whole from every view: at the Azarah 79 % of the terrain's triangles and 72 % of the Mount's lay outside the view
// frustum (docs/decisions/perf-cpu.md). Rings, not plain sectors: three culls by bounding sphere, and the sphere of a
// wedge that starts at the apex holds the apex — every sector would pass the test for a viewer on the Mount. A wedge of
// a ring (inner radius ≥ 1/3 of the outer) has a sphere clear of the centre. Each piece keeps the batch's material
// instance, flags and layers (no new material or program) and gets a bounding sphere of its own triangles / instances.
// Colliders are not touched: the builders register them from the whole batch before it is split.
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Mesh, InstancedMesh, Sphere, Vector3, Matrix4, Box3, Color } from 'three';
import { m2w } from '../core/units.js';

// Six sectors and two rings: the coarsest cells whose spheres still clear the centre (a 60° wedge of a ring whose inner
// radius is ≥ 0.3 × its outer). 8 sectors and rings at 250 / 700 / 1600 m added 76–107 draw calls on low.
export const SECTORS = 6;
/** ring boundaries (m from the Mount's centre): the disc inside the first is one cell (the precinct and its walls) */
export const RINGS = [250, 800, 2400];
/** the Mount's own rings (m): its walls and stoas stand ≈ 120 m from the centre, inside the landscape's first disc */
export const MOUNT_RINGS = [60, 200];
/** cells on? `?sectors=0` turns them off (the batches whole, as before: an A/B switch for the GPU on the HD 4600) */
export function sectorsOn(ctx) { return ctx?.params?.raw?.get?.('sectors') !== '0'; }
/** the Mount's clear interior's centre (site amot 250, 250), the cells' apex — world x, z */
export function mountCentre() { const c = m2w(250, 250, 0); return [c.x, c.z]; }

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
const cellCount = (rings = RINGS, n = SECTORS) => 1 + rings.length * n;

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
 * Split a non-indexed merged Mesh (StaticBatcher / Kit output: world-space, identity transform) by the sector of each
 * triangle's centroid. Returns the pieces (≥ 1 triangle each, in sector order), or null when it is not worth splitting
 * (indexed, transformed, morph targets, groups, under `minTris`, or all in one sector).
 */
export function splitMeshBySector(mesh, { n = SECTORS, rings = RINGS, minTris = 8000, centre = mountCentre() } = {}) {
  const g = mesh.geometry;
  if (!mesh.isMesh || mesh.isInstancedMesh || g.index || g.groups.length || Object.keys(g.morphAttributes).length) return null;
  if (!mesh.matrix.equals(new Matrix4())) return null;
  const pos = g.attributes.position;
  const nTri = Math.floor(Math.min(pos.count, g.drawRange.count) / 3);
  if (nTri < minTris) return null;
  const [cx, cz] = centre;
  const N = cellCount(rings, n);
  const sec = new Uint8Array(nTri), count = new Uint32Array(N);
  const P = pos.array;
  for (let t = 0; t < nTri; t++) {
    const o = t * 9;
    const x = (P[o] + P[o + 3] + P[o + 6]) / 3, z = (P[o + 2] + P[o + 5] + P[o + 8]) / 3;
    const s = cellOf(x, z, cx, cz, rings, n);
    sec[t] = s; count[s]++;
  }
  if (count.filter((c) => c > 0).length < 2) return null;
  const names = Object.keys(g.attributes);
  const pieces = [];
  for (let s = 0; s < N; s++) {
    if (!count[s]) continue;
    const geo = new BufferGeometry();
    for (const k of names) {
      const at = g.attributes[k], sz = at.itemSize, src = at.array;
      const dst = new src.constructor(count[s] * 3 * sz);
      let w = 0;
      for (let t = 0; t < nTri; t++) {
        if (sec[t] !== s) continue;
        dst.set(src.subarray(t * 3 * sz, t * 3 * sz + 3 * sz), w);
        w += 3 * sz;
      }
      geo.setAttribute(k, new Float32BufferAttribute(dst, sz, at.normalized));
    }
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const m = likeMesh(mesh, geo);
    m.name = `${mesh.name}#s${s}`;
    pieces.push(m);
  }
  return pieces;
}

/** replace each mesh of `meshes` (children of their parents) by its sector pieces; returns { split, added } */
export function splitMeshes(meshes, opts) {
  let split = 0, added = 0;
  for (const mesh of meshes) {
    const pieces = splitMeshBySector(mesh, opts);
    if (!pieces) continue;
    const parent = mesh.parent;
    const i = parent.children.indexOf(mesh);
    parent.remove(mesh);
    for (const p of pieces) parent.add(p);
    // (keep the order of the parent's children where the batch was: the pieces after the others is also fine for
    // three — opaque draws are sorted by program and depth — but a stable place keeps traversal order predictable)
    parent.children.splice(i, 0, ...parent.children.splice(parent.children.length - pieces.length, pieces.length));
    mesh.geometry.dispose();
    split++; added += pieces.length - 1;
  }
  return { split, added };
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

/**
 * Split a static InstancedMesh by the sector of each instance's position: one InstancedMesh per occupied sector, same
 * geometry and material, the instances (and colours) in their original order, each with its own bounding sphere.
 * Returns the pieces, or null (fewer than `minInstances`, or all in one sector).
 */
export function splitInstancedBySector(im, { n = SECTORS, rings = RINGS, minInstances = 64, centre = mountCentre() } = {}) {
  if (!im.isInstancedMesh || im.count < minInstances) return null;
  const [cx, cz] = centre;
  const M = im.instanceMatrix.array, C = im.instanceColor?.array || null;
  const by = Array.from({ length: cellCount(rings, n) }, () => []);
  for (let i = 0; i < im.count; i++) by[cellOf(M[i * 16 + 12], M[i * 16 + 14], cx, cz, rings, n)].push(i);
  if (by.filter((l) => l.length).length < 2) return null;
  const pieces = [];
  by.forEach((list, s) => {
    if (!list.length) return;
    const p = new InstancedMesh(im.geometry, im.material, list.length);
    p.name = `${im.name}#s${s}`;
    list.forEach((i, k) => {
      p.instanceMatrix.array.set(M.subarray(i * 16, i * 16 + 16), k * 16);
      if (C) { p.setColorAt(k, _col.fromArray(C, i * 3)); }
    });
    p.instanceMatrix.needsUpdate = true;
    if (p.instanceColor) p.instanceColor.needsUpdate = true;
    p.castShadow = im.castShadow; p.receiveShadow = im.receiveShadow;
    p.layers.mask = im.layers.mask; p.renderOrder = im.renderOrder; p.frustumCulled = im.frustumCulled; p.visible = im.visible;
    p.matrixAutoUpdate = im.matrixAutoUpdate; p.matrix.copy(im.matrix); p.matrixWorld.copy(im.matrixWorld);
    p.userData = { ...im.userData, sectorOf: im.name };
    p.computeBoundingSphere();
    pieces.push(p);
  });
  return pieces;
}
const _col = new Color();

export { cellCount };

/**
 * Split an INDEXED geometry (the terrain's grid tiles) by the cell of each triangle's centroid: one compact indexed
 * geometry per occupied cell (vertices shared within a cell are kept shared). Returns geometries, or null (one cell).
 */
export function splitIndexedByCell(geo, { n = SECTORS, rings = RINGS, centre = mountCentre(), names = null } = {}) {
  const idx = geo.index.array, P = geo.attributes.position.array;
  const [cx, cz] = centre;
  const N = cellCount(rings, n);
  const lists = Array.from({ length: N }, () => []);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const x = (P[a * 3] + P[b * 3] + P[c * 3]) / 3, z = (P[a * 3 + 2] + P[b * 3 + 2] + P[c * 3 + 2]) / 3;
    lists[cellOf(x, z, cx, cz, rings, n)].push(a, b, c);
  }
  if (lists.filter((l) => l.length).length < 2) return null;
  const attrs = names || Object.keys(geo.attributes);
  const out = [];
  for (const L of lists) {
    if (!L.length) continue;
    const map = new Map();
    const remap = new Uint32Array(L.length);
    for (let k = 0; k < L.length; k++) {
      let r = map.get(L[k]);
      if (r === undefined) { r = map.size; map.set(L[k], r); }
      remap[k] = r;
    }
    const g = new BufferGeometry();
    for (const nm of attrs) {
      const src = geo.attributes[nm];
      if (!src) continue;
      const sz = src.itemSize, arr = new Float32Array(map.size * sz);
      for (const [o, r] of map) for (let c = 0; c < sz; c++) arr[r * sz + c] = src.array[o * sz + c];
      g.setAttribute(nm, new Float32BufferAttribute(arr, sz));
    }
    g.setIndex(new Uint32BufferAttribute(remap, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    out.push(g);
  }
  return out;
}

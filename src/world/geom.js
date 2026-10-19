// Shared geometry helpers for world builders.
//
// Conventions:
//  * All geometry handed to the batcher is in WORLD space (meters) — use units.m2w / boxToWorld.
//  * UVs are world-scaled: 1 UV unit = 1 meter. Materials set their own texture repeat
//    (see world/materials/) so textures tile at physical scale on every surface.
//  * Static architecture goes through StaticBatcher so each material is ONE draw call.
import {
  BoxGeometry, BufferGeometry, Mesh, Group, Matrix4, Vector3, Float32BufferAttribute,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { boxToWorld } from '../core/units.js';

/**
 * Re-project UVs from world position by dominant normal axis (box/triplanar-style per face).
 * scale: UV units per meter (default 1). Works for any geometry already transformed to world space.
 */
export function applyWorldUV(geometry, scale = 1) {
  const pos = geometry.attributes.position;
  const nor = geometry.attributes.normal || (geometry.computeVertexNormals(), geometry.attributes.normal);
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = -z; }          // floors/ceilings: plan coordinates
    else if (nx >= nz) { u = -z * Math.sign(nor.getX(i) || 1); v = y; } // east/west faces
    else { u = x * Math.sign(nor.getZ(i) || 1); v = y; }                // north/south faces
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/** World-space box geometry from a site-frame box (min/max in amot), with world-scaled UVs. */
export function siteBoxGeometry(min, max) {
  const { center, size } = boxToWorld(min, max);
  const g = new BoxGeometry(size.x, size.y, size.z);
  g.translate(center.x, center.y, center.z);
  return applyWorldUV(g);
}

/** World-space box from center/size in meters. */
export function worldBoxGeometry(center, size) {
  const g = new BoxGeometry(size.x, size.y, size.z);
  g.translate(center.x, center.y, center.z);
  return applyWorldUV(g);
}

/** Bake a mesh's (or object's) transform into a cloned non-indexed-compatible geometry. */
export function bakeGeometry(geometry, matrix) {
  let g = geometry.clone();
  if (matrix) {
    g.applyMatrix4(matrix);
    if (matrix.determinant() < 0) g = flipWinding(g); // applyMatrix4 does not re-wind mirrored parts
  }
  return g;
}

/** Reverse triangle winding (for geometry baked through a mirroring transform). */
export function flipWinding(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  for (const name of Object.keys(g.attributes)) {
    const at = g.attributes[name];
    const n = at.itemSize;
    const arr = at.array;
    for (let i = 0; i < at.count; i += 3) {
      for (let k = 0; k < n; k++) {
        const a = (i + 1) * n + k, b = (i + 2) * n + k;
        const tmp = arr[a]; arr[a] = arr[b]; arr[b] = tmp;
      }
    }
    at.needsUpdate = true;
  }
  return g;
}

/**
 * Collects world-space geometries per material key and merges them into one mesh per key.
 *   const b = new StaticBatcher(ctx, 'heichal');
 *   b.add(geo, 'marble_white', { collide: true, castShadow: true });
 *   group.add(b.build());
 * Geometries must share attribute sets (position/normal/uv). Index/non-index is normalized.
 */
export class StaticBatcher {
  constructor(ctx, name = 'batch') {
    this.ctx = ctx;
    this.name = name;
    this.buckets = new Map(); // key -> { geos: [], cast, receive }
    this.colliderGeos = [];
  }

  add(geometry, materialKey, opts = {}) {
    const { collide = true, castShadow = true, receiveShadow = true, worldUV = false } = opts;
    let g = geometry;
    if (worldUV) applyWorldUV(g);
    if (!g.attributes.uv) applyWorldUV(g);
    if (!g.attributes.normal) g.computeVertexNormals();
    // keep only the attributes we merge on
    for (const k of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    }
    if (g.index) g = g.toNonIndexed();
    const key = `${materialKey}|${castShadow ? 1 : 0}${receiveShadow ? 1 : 0}`;
    if (!this.buckets.has(key)) this.buckets.set(key, { materialKey, geos: [], castShadow, receiveShadow });
    this.buckets.get(key).geos.push(g);
    if (collide) this.colliderGeos.push(g);
    return this;
  }

  /** Add an object3D hierarchy (meshes) with their world transforms baked; uses each mesh's userData.mat or materialKey. */
  addObject(object, materialKey, opts = {}) {
    object.updateMatrixWorld(true);
    object.traverse((o) => {
      if (o.isMesh) this.add(bakeGeometry(o.geometry, o.matrixWorld), o.userData.mat || materialKey, opts);
    });
    return this;
  }

  build() {
    const group = new Group();
    group.name = this.name;
    for (const { materialKey, geos, castShadow, receiveShadow } of this.buckets.values()) {
      if (!geos.length) continue;
      const merged = mergeGeometries(geos, false);
      if (!merged) { console.warn(`[batch:${this.name}] merge failed for ${materialKey}`); continue; }
      merged.computeBoundingSphere();
      const mesh = new Mesh(merged, this.ctx.mats.get(materialKey));
      mesh.name = `${this.name}:${materialKey}`;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      group.add(mesh);
    }
    if (this.colliderGeos.length) {
      const c = mergeGeometries(this.colliderGeos.map((g) => {
        const p = new BufferGeometry();
        p.setAttribute('position', g.attributes.position);
        return p;
      }), false);
      if (c) this.ctx.addCollider(c, this.name);
    }
    return group;
  }
}

export { mergeGeometries, mergeVertices, Matrix4, Vector3 };

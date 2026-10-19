// Collision world: one MeshBVH over every static collider (world space), plus the queries the player,
// nav and other systems use.  ctx.physics = { floorAt, floorsAt, standFloor, insideAt, findStand, raycast,
// bvh, rebuild, ... }.
//
// Per-frame queries (capsule push-out, ground probe) and the column queries traverse the BVH through
// BVH.prototype.shapecast with persistent callback objects: MeshBVH.shapecast spreads a new callbacks
// object per call and raycasts allocate hit objects, which adds up to steady garbage on phones.
import { BufferGeometry, BufferAttribute, Box3, Line3, Ray, Vector3, DoubleSide } from 'three';
import { MeshBVH, BVH, ExtendedTriangle } from 'three-mesh-bvh';
import { NAV_DEFAULTS, columnFloors, surfaceKind } from './nav/grid-build.js';
import { a } from '../core/units.js';

/** collider tags never collided with: door leaves / curtains move, observers pass them (ARCHITECTURE §12) */
const SKIP_TAG = /\b(door|doors|leaf|leaves|curtain|curtains|parochet|nocollide)\b/i;
export const WALK_NY = NAV_DEFAULTS.walkNy;
const shapecast = BVH.prototype.shapecast;
const warned = new Set();
const warnOnce = (msg) => { if (!warned.has(msg)) { warned.add(msg); console.warn(msg); } };

/** Merge ctx.colliders (BufferGeometry in world space, or Mesh/Object3D with world transforms) into a triangle soup. */
export function gatherTriangles(ctx) {
  const movables = new Set();
  ctx.movables?.forEach?.((o) => movables.add(o));
  const isMovable = (o) => { for (let p = o; p; p = p.parent) if (movables.has(p)) return true; return false; };
  const parts = [];
  let total = 0;
  const addGeo = (geo, matrix, label) => {
    const pa = geo?.attributes?.position;
    if (!pa) return;
    const idx = geo.index;
    const start = Math.max(0, geo.drawRange?.start || 0);
    const end = Math.min(idx ? idx.count : pa.count, start + (Number.isFinite(geo.drawRange?.count) ? geo.drawRange.count : Infinity));
    const n = Math.floor((end - start) / 3) * 3;
    if (n <= 0) return;
    const out = new Float32Array(n * 3);
    const fast = !pa.isInterleavedBufferAttribute && !pa.normalized && pa.itemSize === 3 ? pa.array : null;
    const ix = idx ? idx.array : null;
    const e = matrix ? matrix.elements : null;
    // a mirroring transform (negative determinant) reverses the winding: swap two vertices per triangle
    const mirror = !!matrix && matrix.determinant() < 0;
    for (let k = 0; k < n; k++) {
      const v = ix ? ix[start + k] : start + k;
      let x, y, z;
      if (fast) { x = fast[v * 3]; y = fast[v * 3 + 1]; z = fast[v * 3 + 2]; } else { x = pa.getX(v); y = pa.getY(v); z = pa.getZ(v); }
      if (e) {
        const X = e[0] * x + e[4] * y + e[8] * z + e[12];
        const Y = e[1] * x + e[5] * y + e[9] * z + e[13];
        const Z = e[2] * x + e[6] * y + e[10] * z + e[14];
        x = X; y = Y; z = Z;
      }
      const o = mirror && k % 3 ? (k % 3 === 1 ? k + 1 : k - 1) : k;
      out[o * 3] = x; out[o * 3 + 1] = y; out[o * 3 + 2] = z;
    }
    orient(out, label);
    parts.push(out);
    total += out.length;
  };
  for (const c of ctx.colliders || []) {
    const object = c?.object ?? c;
    if (!object || SKIP_TAG.test(c?.tag || '')) continue;
    const label = c?.tag || object.name || 'collider';
    if (object.isBufferGeometry) addGeo(object, null, label);
    else if (object.isObject3D) {
      if (isMovable(object) || SKIP_TAG.test(object.name || '')) continue;
      object.updateWorldMatrix(true, true);
      object.traverse((o) => { if (o.isMesh && !isMovable(o)) addGeo(o.geometry, o.matrixWorld, o.name || label); });
    }
  }
  const soup = new Float32Array(total);
  let off = 0;
  for (const p of parts) { soup.set(p, off); off += p.length; }
  return soup;
}

/**
 * Floors and solids are told apart by triangle winding (outward normals). A closed mesh wound inside-out
 * (negative volume, up and down areas balanced) is flipped; a mesh that faces mostly down is reported,
 * since a floor wound the wrong way is fallen through.
 */
function orient(t, label) {
  let vol = 0, up = 0, down = 0;
  for (let o = 0; o < t.length; o += 9) {
    const ax = t[o], ay = t[o + 1], az = t[o + 2], bx = t[o + 3], by = t[o + 4], bz = t[o + 5];
    const cx = t[o + 6], cy = t[o + 7], cz = t[o + 8];
    const ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az); // 2 × signed plan area
    if (ny > 0) up += ny; else down -= ny;
    vol += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
  }
  const sum = up + down;
  if (!(sum > 1e-6)) return;
  if (Math.abs(up - down) < 0.02 * sum && vol < 0) {
    for (let o = 0; o < t.length; o += 9) {
      for (let q = 3; q < 6; q++) { const s = t[o + q]; t[o + q] = t[o + q + 3]; t[o + q + 3] = s; }
    }
    warnOnce(`[physics] collider "${label}" is a closed mesh wound inside-out; flipped (fix its winding)`);
  } else if (down > 1.5 * up + 1) {
    warnOnce(`[physics] collider "${label}" faces mostly down; a floor wound the wrong way is fallen through`);
  }
}

export function createPhysics(ctx) {
  const ray = new Ray();
  const seg = new Line3();
  const qbox = new Box3();
  const tp = new Vector3(), cp = new Vector3(), dv = new Vector3(), nv = new Vector3();
  const tri = new ExtendedTriangle();
  const col = { ys: new Float32Array(64), ny: new Float32Array(64), ks: new Uint8Array(64), bl: new Float32Array(2), out: new Float32Array(8) };
  const cfgFloors = { ...NAV_DEFAULTS, maxLevels: 8 };
  let P = null, I = null; // BVH positions (the soup) and its (reordered) index

  const setTri = (t) => {
    const i0 = I[3 * t] * 3, i1 = I[3 * t + 1] * 3, i2 = I[3 * t + 2] * 3;
    tri.a.set(P[i0], P[i0 + 1], P[i0 + 2]);
    tri.b.set(P[i1], P[i1 + 1], P[i1 + 2]);
    tri.c.set(P[i2], P[i2 + 1], P[i2 + 2]);
    tri.needsUpdate = true;
  };

  // ---- capsule push-out (horizontal only) ----
  const capQ = { radius: 0, moved: false, blocked: false };
  const capsuleCB = {
    intersectsBounds: (box) => box.intersectsBox(qbox),
    intersectsRange: (offset, count) => {
      const radius = capQ.radius;
      for (let t = offset, e = offset + count; t < e; t++) {
        setTri(t);
        const d = tri.closestPointToSegment(seg, tp, cp);
        if (d >= radius) continue;
        dv.subVectors(cp, tp);
        const len = dv.length();
        let hx, hz, hl, push;
        if (len > 1e-6) {
          if (Math.abs(dv.y) > 0.75 * len) { capQ.blocked = true; continue; }
          hx = dv.x; hz = dv.z; hl = Math.hypot(hx, hz);
          push = (radius - d) * (len / hl) + 1e-4;
        } else {
          // the axis pierces the triangle: leave along its plan normal
          tri.getNormal(nv);
          hx = nv.x; hz = nv.z; hl = Math.hypot(hx, hz);
          if (hl < 1e-4) { capQ.blocked = true; continue; }
          push = radius + 1e-4;
        }
        hx /= hl; hz /= hl;
        seg.start.x += hx * push; seg.start.z += hz * push;
        seg.end.x += hx * push; seg.end.z += hz * push;
        capQ.moved = true;
      }
      return false;
    },
  };

  // ---- vertical column: every surface crossing the vertical line (x, z) between lo and hi ----
  const colQ = { x: 0, z: 0, lo: 0, hi: 0, n: 0 };
  const colBox = new Box3();
  const columnCB = {
    intersectsBounds: (box) => box.intersectsBox(colBox),
    intersectsRange: (offset, count) => {
      const { x, z, lo, hi } = colQ;
      for (let t = offset, e = offset + count; t < e; t++) {
        const i0 = I[3 * t] * 3, i1 = I[3 * t + 1] * 3, i2 = I[3 * t + 2] * 3;
        const ax = P[i0], ay = P[i0 + 1], az = P[i0 + 2];
        const e1x = P[i1] - ax, e1y = P[i1 + 1] - ay, e1z = P[i1 + 2] - az;
        const e2x = P[i2] - ax, e2y = P[i2 + 1] - ay, e2z = P[i2 + 2] - az;
        const d = e1x * e2z - e2x * e1z; // = −(normal.y), unnormalized
        if (Math.abs(d) < 1e-12) continue; // vertical: no area in plan
        const px = x - ax, pz = z - az;
        const u = (px * e2z - e2x * pz) / d, v = (e1x * pz - px * e1z) / d;
        if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
        const y = ay + u * e1y + v * e2y;
        if (y < lo || y > hi) continue;
        const nX = e1y * e2z - e1z * e2y, nZ = e1x * e2y - e1y * e2x;
        if (colQ.n === col.ys.length) grow();
        col.ys[colQ.n] = y;
        col.ny[colQ.n++] = -d / Math.hypot(nX, d, nZ);
      }
      return false;
    },
  };
  function grow() {
    const m = col.ys.length * 2;
    const ys = new Float32Array(m); ys.set(col.ys); col.ys = ys;
    const ny = new Float32Array(m); ny.set(col.ny); col.ny = ny;
    col.ks = new Uint8Array(m);
  }
  /** fill col.ys / col.ny with the column's surfaces in [lo, hi]; returns their count */
  function column(x, z, lo, hi) {
    if (!phys.bvh) return 0;
    colQ.x = x; colQ.z = z; colQ.lo = lo; colQ.hi = hi; colQ.n = 0;
    colBox.min.set(x - 1e-3, lo, z - 1e-3);
    colBox.max.set(x + 1e-3, hi, z + 1e-3);
    shapecast.call(phys.bvh, columnCB);
    return colQ.n;
  }
  /** standable floors of the column into col.out (ascending); returns their count */
  function floorsInto(x, z, top) {
    const n = column(x, z, -Infinity, top);
    let m = 0;
    for (let i = 0; i < n; i++) {
      const ny = col.ny[i];
      if (Math.abs(ny) < 0.02) continue;
      col.ys[m] = col.ys[i];
      col.ks[m++] = surfaceKind(ny, WALK_NY);
    }
    return columnFloors(col.ys, col.ks, m, col.bl, 0, cfgFloors, col.out);
  }

  // ---- ground probe: 7 vertical rays (centre + ring) in one traversal ----
  const PR = 7;
  const prQ = { lo: 0, hi: 0, x: new Float64Array(PR), z: new Float64Array(PR), y: new Float64Array(PR), nx: new Float64Array(PR), ny: new Float64Array(PR), nz: new Float64Array(PR) };
  const prBox = new Box3();
  const probeCB = {
    intersectsBounds: (box) => box.intersectsBox(prBox),
    intersectsRange: (offset, count) => {
      const { lo, hi } = prQ;
      for (let t = offset, e = offset + count; t < e; t++) {
        const i0 = I[3 * t] * 3, i1 = I[3 * t + 1] * 3, i2 = I[3 * t + 2] * 3;
        const ax = P[i0], ay = P[i0 + 1], az = P[i0 + 2];
        const e1x = P[i1] - ax, e1y = P[i1 + 1] - ay, e1z = P[i1 + 2] - az;
        const e2x = P[i2] - ax, e2y = P[i2 + 1] - ay, e2z = P[i2 + 2] - az;
        const d = e1x * e2z - e2x * e1z;
        if (Math.abs(d) < 1e-12) continue;
        for (let k = 0; k < PR; k++) {
          const px = prQ.x[k] - ax, pz = prQ.z[k] - az;
          const u = (px * e2z - e2x * pz) / d, v = (e1x * pz - px * e1z) / d;
          if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
          const y = ay + u * e1y + v * e2y;
          if (y < lo || y > hi || y <= prQ.y[k]) continue;
          // first surface met by the downward ray; its normal (either winding) turned to face up
          const nX = e1y * e2z - e1z * e2y, nZ = e1x * e2y - e1y * e2x;
          const s = (d > 0 ? -1 : 1) / Math.hypot(nX, d, nZ);
          prQ.y[k] = y; prQ.nx[k] = nX * s; prQ.ny[k] = -d * s; prQ.nz[k] = nZ * s;
        }
      }
      return false;
    },
  };

  const phys = {
    bvh: null,
    soup: null, // Float32Array triangle soup (world) — shared with the nav builder
    bounds: new Box3(),
    stats: { triangles: 0, buildMs: 0 },
    version: 0,

    /** (Re)build the BVH from ctx.colliders. Also rebuilds ctx.nav when present; returns ctx.nav.ready or a resolved promise. */
    rebuild() {
      const t0 = performance.now();
      const soup = gatherTriangles(ctx);
      phys.soup = soup;
      phys.bvh = null;
      P = I = null;
      phys.bounds.makeEmpty();
      phys.stats.triangles = soup.length / 9;
      if (soup.length >= 9) {
        const g = new BufferGeometry();
        g.setAttribute('position', new BufferAttribute(soup, 3));
        phys.bvh = new MeshBVH(g, { maxDepth: 64 });
        phys.bvh.getBoundingBox(phys.bounds);
        P = g.attributes.position.array;
        I = g.index.array;
      }
      phys.stats.buildMs = Math.round(performance.now() - t0);
      phys.version++;
      return ctx.nav?.rebuild ? ctx.nav.rebuild() : Promise.resolve(null);
    },

    /**
     * floorAt(x, z) — the standable WALKING floor at (x, z) (as standFloor: court/hall floors, not roof tops).
     * floorAt(x, z, fromY, minNy = 0.3, far = Infinity) — the highest up-facing surface (normal.y ≥ minNy) in
     * [fromY − far, fromY]; undersides and steep faces are passed through. Returns world y or null.
     */
    floorAt(x, z, fromY, minNy = 0.3, far = Infinity) {
      if (fromY == null) return phys.standFloor(x, z);
      const n = column(x, z, fromY - far, fromY);
      let best = -Infinity;
      for (let i = 0; i < n; i++) if (col.ny[i] >= minNy && col.ys[i] > best) best = col.ys[i];
      return best === -Infinity ? null : best;
    },

    /** All standable floor heights at (x, z), ascending (column analysis with the capsule's clearance). */
    floorsAt(x, z, top = 1e4) {
      const k = floorsInto(x, z, top);
      return Array.from(col.out.subarray(0, k));
    },

    /**
     * The floor an observer stands on at (x, z): among the standable floors, prefer the site's walking
     * datums (Mount 0, Ezrat Nashim 6, Ezrat Yisrael 13.5, Azarah 16, Heichal 22; not the crown) unless
     * `exact`; then the one nearest hintY (the lowest without a hint). Falls back to the top surface.
     */
    standFloor(x, z, hintY = null, exact = false) {
      const k = floorsInto(x, z, 1e4);
      if (!k) return phys.floorAt(x, z, 1e4, WALK_NY);
      const floors = Array.from(col.out.subarray(0, k));
      let set = floors;
      if (!exact) {
        const datums = Object.entries(ctx.site?.datums || {})
          .filter(([key, v]) => Number.isFinite(v) && !/crown|roof|top|parapet|ceiling/i.test(key)).map(([, v]) => a(v));
        const pref = floors.filter((y) => datums.some((d) => Math.abs(d - y) < 0.25));
        if (pref.length) set = pref;
      }
      if (hintY == null) return set[0];
      return set.reduce((b, y) => (Math.abs(y - hintY) < Math.abs(b - hintY) ? y : b));
    },

    /** Is the point (x, y, z) inside a closed solid? (column parity by winding, counted from below) */
    insideAt(x, y, z) {
      const n = column(x, z, -Infinity, y);
      const ys = col.ys, ny = col.ny;
      // ascending; at equal heights up-facing first (a top face flush with the next solid's bottom)
      for (let i = 1; i < n; i++) {
        const yi = ys[i], ni = ny[i];
        let j = i - 1;
        while (j >= 0 && (ys[j] > yi || (ys[j] === yi && ny[j] < 0 && ni > 0))) { ys[j + 1] = ys[j]; ny[j + 1] = ny[j]; j--; }
        ys[j + 1] = yi; ny[j + 1] = ni;
      }
      let inside = 0;
      for (let i = 0; i < n; i++) {
        if (Math.abs(ny[i]) < 0.02) continue;
        if (ny[i] < 0) inside++; else if (inside > 0) inside--;
      }
      return inside > 0;
    },

    /**
     * Nearest place to stand near p (world): the nav grid's nearest walkable node when it is built, else
     * the standable floors of columns in rings around p. Floors at or below p are preferred. Vector3 | null.
     */
    findStand(p, radius = 8) {
      const nav = ctx.nav;
      if (nav?.isReady) {
        const q = nav.nearest(p, radius);
        if (q) return q;
      }
      let bestD = Infinity, bx = 0, by = 0, bz = 0;
      const step = 0.75;
      for (let r = 0; r <= radius; r += step) {
        if (bestD < Infinity && (r - step) * (r - step) > bestD) break;
        const m = r === 0 ? 1 : Math.max(6, Math.round((2 * Math.PI * r) / step));
        for (let i = 0; i < m; i++) {
          const ang = (i / m) * 2 * Math.PI;
          const x = p.x + Math.cos(ang) * r, z = p.z + Math.sin(ang) * r;
          const k = floorsInto(x, z, 1e4);
          for (let l = 0; l < k; l++) {
            const dy = col.out[l] - p.y;
            const d = r * r + (dy > 0.4 ? 9 : 2) * dy * dy;
            if (d < bestD) { bestD = d; bx = x; by = col.out[l]; bz = z; }
          }
        }
      }
      return bestD < Infinity ? new Vector3(bx, by, bz) : null;
    },

    /** First hit along a ray: { point, distance, normal (world, facing the ray origin), faceIndex } | null */
    raycast(origin, dir, far = Infinity) {
      const bvh = phys.bvh;
      if (!bvh) return null;
      ray.origin.copy(origin);
      ray.direction.copy(dir).normalize();
      const hit = bvh.raycastFirst(ray, DoubleSide, 0, far);
      if (!hit) return null;
      const normal = hit.face.normal.clone();
      if (normal.dot(ray.direction) > 0) normal.negate();
      return { point: hit.point, distance: hit.distance, normal, faceIndex: hit.faceIndex };
    },

    /**
     * Push a vertical capsule (axis through feet.x/z, spanning feet.y+bottom … feet.y+top) out of the
     * geometry, horizontally only. Mutates feet.x/z. Returns true when blocked by a floor/ceiling-like
     * contact that horizontal sliding cannot resolve.
     */
    collideCapsule(feet, radius, bottom, top) {
      if (!phys.bvh) return false;
      seg.start.set(feet.x, feet.y + bottom + radius, feet.z);
      seg.end.set(feet.x, feet.y + top - radius, feet.z);
      capQ.radius = radius;
      capQ.blocked = false;
      for (let it = 0; it < 4; it++) {
        qbox.min.set(seg.start.x - radius, seg.start.y - radius, seg.start.z - radius);
        qbox.max.set(seg.end.x + radius, seg.end.y + radius, seg.end.z + radius);
        capQ.moved = false;
        shapecast.call(phys.bvh, capsuleCB);
        if (!capQ.moved) break;
      }
      feet.x = seg.start.x;
      feet.z = seg.start.z;
      return capQ.blocked;
    },

    /**
     * Ground under a standing capsule: highest walkable surface hit by 7 short downward rays (centre +
     * ring), each projected to the centre along its surface plane. Rays start at feet.y + up (outside
     * solids while walking) and reach `down` below the feet; either winding counts. Returns the height or null.
     */
    probeGround(feet, up, down, ring = 0.22) {
      if (!phys.bvh) return null;
      for (let k = 0; k < PR; k++) {
        const an = (k - 1) * Math.PI / 3;
        prQ.x[k] = feet.x + (k === 0 ? 0 : Math.cos(an) * ring);
        prQ.z[k] = feet.z + (k === 0 ? 0 : Math.sin(an) * ring);
        prQ.y[k] = -Infinity;
      }
      prQ.lo = feet.y - down; prQ.hi = feet.y + up;
      prBox.min.set(feet.x - ring - 1e-3, prQ.lo, feet.z - ring - 1e-3);
      prBox.max.set(feet.x + ring + 1e-3, prQ.hi, feet.z + ring + 1e-3);
      shapecast.call(phys.bvh, probeCB);
      let best = -Infinity;
      for (let k = 0; k < PR; k++) {
        const hy = prQ.y[k], ny = prQ.ny[k];
        if (hy === -Infinity || ny < WALK_NY) continue;
        // plane height at the capsule axis, never extrapolated far above what was hit
        const y = hy + (prQ.nx[k] * (prQ.x[k] - feet.x) + prQ.nz[k] * (prQ.z[k] - feet.z)) / ny;
        const yc = Math.min(y, hy + 0.05);
        if (yc > best) best = yc;
      }
      return best === -Infinity ? null : best;
    },
  };
  return phys;
}

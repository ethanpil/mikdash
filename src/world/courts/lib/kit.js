// Build kit for the courts: material buckets → StaticBatcher (one draw call per material), instanced sets,
// door leaves and gate curtains (instanced, animated through movables), and registration helpers.
//
// Movables (ctx.movables, see docs/decisions/build-courts.md):
//   'door:<element id>'    Object3D at the doorway; userData.open(f) sets every leaf, f ∈ [0, 1]
//                          (0 = shut, 1 = folded back into the passage / room); userData.openAmount reads it back
//   'curtain:<gate id>'    the gate's parochet; userData.open(f): 0 = drawn across the opening, 1 = gathered at the jambs
//   'wheel:<element id>'   userData.spin(angleRad) turns the wheel about its axle
import {
  Group, Object3D, InstancedMesh, Mesh, Matrix4, Quaternion, Vector3, BoxGeometry, BufferGeometry, CylinderGeometry,
  Float32BufferAttribute, DynamicDrawUsage,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { StaticBatcher, applyWorldUV } from '../../geom.js';
import { AMAH, m2w } from '../../../core/units.js';
import { Mesher, latheLocal } from './geo.js';

const Y_AXIS = new Vector3(0, 1, 0);

export class Kit {
  constructor(ctx, name) {
    this.ctx = ctx;
    this.name = name;
    this.detail = ctx.quality?.detail ?? 1;
    this.group = new Group();
    this.group.name = name;
    this.batch = new StaticBatcher(ctx, name);
    this.buckets = new Map();
    this.extra = [];               // [geometry, key, opts] added straight to the batcher
    this.sets = new Map();         // instanced sets
    this.doors = new Map();
    this.curtainSets = [];         // Curtains instances (gate parochot, linen screens)
    this.stats = {};
  }

  /** material key with a fallback while the materials task has not added it yet */
  mat(key, fallback) { return this.ctx.mats?.has?.(key) ? key : fallback; }

  /** the Mesher bucket for (material, collide, castShadow) */
  m(key, collide = true, cast = true) {
    const k = `${key}|${collide ? 1 : 0}|${cast ? 1 : 0}`;
    let b = this.buckets.get(k);
    if (!b) { b = { key, collide, cast, mesher: new Mesher() }; this.buckets.set(k, b); }
    return b.mesher;
  }

  /** merge a gridSolid result (Map key → Mesher) into the buckets */
  solid(map, collide = true, cast = true) {
    for (const [key, mesher] of map) this.m(key, collide, cast).merge(mesher);
  }

  /** a ready world-space geometry (lathes etc.) */
  geo(g, key, opts = {}) { this.extra.push([g, key, opts]); }

  /** an instanced set: factory() → LOCAL geometry (meters); add(matrix) per instance.
   *  key: a material key, or an array of keys for a geometry with groups (one draw call per group) */
  set(name, factory, key, opts = {}) {
    let s = this.sets.get(name);
    if (!s) { s = { name, factory, key, opts, mats: [] }; this.sets.set(name, s); }
    return s;
  }

  inst(name, matrix) { this.sets.get(name).mats.push(matrix.clone()); }

  finish() {
    for (const { key, collide, cast, mesher } of this.buckets.values()) {
      if (!mesher.count) continue;
      this.batch.add(mesher.geometry(), key, { collide, castShadow: cast });
    }
    for (const [g, key, opts] of this.extra) this.batch.add(g, key, opts);
    this.group.add(this.batch.build());
    for (const s of this.sets.values()) {
      if (!s.mats.length) continue;
      const geo = s.factory();
      const mat = Array.isArray(s.key) ? s.key.map((k) => this.ctx.mats.get(k)) : this.ctx.mats.get(s.key);
      const im = new InstancedMesh(geo, mat, s.mats.length);
      im.name = `${this.name}:${s.name}`;
      s.mats.forEach((mx, i) => im.setMatrixAt(i, mx));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = s.opts.cast ?? true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
    }
    for (const d of this.doorSets?.values?.() || []) d.build(this);
    for (const c of this.curtainSets) c.build(this);
    return this.group;
  }
}

// ----------------------------------------------------------------------------------------------- door leaves
/** world-space hinge description for one leaf */
function leafMatrix(hinge, yaw, scale, target = new Matrix4()) {
  const q = new Quaternion().setFromAxisAngle(Y_AXIS, yaw);
  return target.compose(hinge, q, scale || new Vector3(1, 1, 1));
}
const yawOf = (dx, dz) => Math.atan2(-dz, dx); // local +x → world (dx, dz)

/**
 * A set of identical leaves (same size/style/material) drawn as one InstancedMesh.
 * geometry(): LOCAL geometry in meters, hinge edge on the local y axis, leaf along +x, thickness centred on z.
 */
export class LeafSet {
  constructor(name, key, geometry) { this.name = name; this.key = key; this.geometryFn = geometry; this.leaves = []; this.mesh = null; }
  add(leaf) { leaf.index = this.leaves.length; this.leaves.push(leaf); leaf.set = this; return leaf; }
  build(kit) {
    if (!this.leaves.length) return;
    const im = new InstancedMesh(this.geometryFn(), kit.ctx.mats.get(this.key), this.leaves.length);
    im.name = `${kit.name}:leaves:${this.name}`;
    im.instanceMatrix.setUsage(DynamicDrawUsage);
    im.castShadow = true; im.receiveShadow = true;
    this.mesh = im;
    for (const l of this.leaves) l.apply();
    im.computeBoundingSphere();
    kit.group.add(im);
  }
}

/**
 * Doors: addDoor(id, spec) with spec = {
 *   set: LeafSet (or mesh: a dedicated Object3D for special leaves), leaves: [{ hinge:[X,Y,Z] site, along:[dx,dy] closed direction,
 *   into:[dx,dy] swing direction }], open: initial 0..1, label }
 * Registers ctx.movables 'door:<id>'.
 */
export class Doors {
  constructor(kit) { this.kit = kit; this.sets = new Map(); kit.doorSets = this.sets; }
  leafSet(name, key, geometry) {
    let s = this.sets.get(name);
    if (!s) { s = new LeafSet(name, key, geometry); this.sets.set(name, s); }
    return s;
  }
  /**
   * leaves: [{ set | object, hinge:[X,Y,Z], along:[dx,dy], into:[dx,dy], maxAngle? }]
   *   along: site direction the leaf spans when shut; into: the side it swings to (the passage/room).
   */
  addDoor(id, leaves, { open = 1, center, label, kind = 'gate' } = {}) {
    const ctx = this.kit.ctx;
    const node = new Object3D();
    node.name = `door:${id}`;
    if (center) node.position.copy(m2w(center[0], center[1], center[2]));
    const L = leaves.map((spec) => {
      const hinge = m2w(spec.hinge[0], spec.hinge[1], spec.hinge[2]);
      const yaw0 = yawOf(spec.along[0], -spec.along[1]);
      // swing sign: the open leaf must point along `into`
      const cand = [1, -1].map((s) => yaw0 + s * (spec.maxAngle ?? Math.PI / 2));
      const want = [spec.into[0], -spec.into[1]];
      const score = (y) => Math.cos(y) * want[0] + -Math.sin(y) * want[1];
      const yaw1 = score(cand[0]) >= score(cand[1]) ? cand[0] : cand[1];
      const leaf = { hinge, yaw0, yaw1, f: open, object: spec.object || null, scale: spec.scale ? new Vector3(...spec.scale) : null };
      leaf.apply = () => {
        const yaw = leaf.yaw0 + (leaf.yaw1 - leaf.yaw0) * leaf.f;
        if (leaf.object) {
          leaf.object.position.copy(leaf.hinge);
          leaf.object.rotation.set(0, yaw, 0);
          leaf.object.updateMatrix();
        } else if (leaf.set?.mesh) {
          leaf.set.mesh.setMatrixAt(leaf.index, leafMatrix(leaf.hinge, yaw, leaf.scale));
          leaf.set.mesh.instanceMatrix.needsUpdate = true;
        }
      };
      if (spec.set) spec.set.add(leaf);
      if (spec.object) { this.kit.group.add(spec.object); leaf.apply(); }
      return leaf;
    });
    node.userData = {
      kind, id, label,
      leaves: L.length,
      get openAmount() { return L[0]?.f ?? 0; },
      open(f) {
        const v = Math.min(1, Math.max(0, +f || 0));
        for (const l of L) { l.f = v; l.apply(); }
        const sets = new Set(L.map((l) => l.set).filter(Boolean));
        for (const s of sets) s.mesh?.computeBoundingSphere();
        return v;
      },
    };
    this.kit.group.add(node);
    ctx.movables.set(node.name, node);
    return node;
  }
}

// ------------------------------------------------------------------------------------------ leaf geometry
const boxAt = (x0, y0, z0, x1, y1, z1) => {
  const g = new BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};
/** merge LOCAL parts with world-scaled UVs, each part projected by its own normals (a part flagged userData.mkUV keeps
 *  the UVs it carries — the smooth-shaded mouldings, whose UVs come from their flat faces) */
const finishLocal = (parts) => {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => {
    for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k);
    if (!p.userData.mkUV) applyWorldUV(p);
    return p;
  }), false);
  g.computeBoundingSphere();
  return g;
};

/**
 * Local quads (amot in, meters out) with flat normals; each [a, b, c, d, hint] is turned to face its hint.
 * A sixth element zs (±1) makes the quad a bevel from a face to a sunk panel (a, b on the face, c, d on the panel):
 * its normal sweeps from near the face's (±z) at a, b to its own slope at c, d — an ovolo, shaded smooth (qa-r2-fix-world:
 * a flat bevel of polished metal turned to the sun lit up as one even strip of light) ⚙. UVs from the flat faces.
 */
export function quadsLocal(list) {
  const A = AMAH, p = [], n = [], uvp = [];
  const sub3 = (u, v) => [u[0] - v[0], u[1] - v[1], u[2] - v[2]];
  const cross3 = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const unit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  for (const [a, b, c, d, hint, zs] of list) {
    let q = [a, b, c, d], ord = [0, 1, 2, 3];
    let N = cross3(sub3(b, a), sub3(c, a));
    if (N[0] * hint[0] + N[1] * hint[1] + N[2] * hint[2] < 0) { q = [a, d, c, b]; ord = [0, 3, 2, 1]; N = N.map((v) => -v); }
    N = unit(N);
    const vn = zs ? [0, 1, 2, 3].map((k) => (ord[k] < 2 ? unit([N[0], N[1], N[2] + 0.8 * zs]) : unit([N[0], N[1], N[2] + 0.1 * zs]))) : null;
    for (const i of [0, 1, 2, 0, 2, 3]) {
      p.push(q[i][0] * A, q[i][1] * A, q[i][2] * A);
      const m = vn ? vn[i] : N;
      n.push(m[0], m[1], m[2]);
      uvp.push(N[0], N[1], N[2]);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(p, 3));
  // UVs projected from the flat normals, then the shading normals put in
  g.setAttribute('normal', new Float32BufferAttribute(uvp, 3));
  applyWorldUV(g);
  g.setAttribute('normal', new Float32BufferAttribute(n, 3));
  g.userData.mkUV = true;
  return g;
}

/** the leaf's two vertical edges (local x = 0 and x = w, metres) shaded as rounded arrises across its thickness: the
 *  edge faces' normals turn toward the face they meet (up to ±0.9 at the frames' outer faces) ⚙ (qa-r2-fix-world: a
 *  sunlit flat edge of gold or bronze read as a slit of light beside the jamb) */
function roundEdges(g, w, zMax) {
  const p = g.attributes.position, nr = g.attributes.normal, e = 1e-4;
  for (let i = 0; i < p.count; i++) {
    const nx = nr.getX(i);
    if (Math.abs(nx) < 0.99) continue;
    const x = p.getX(i);
    if (Math.abs(x) > e && Math.abs(x - w) > e) continue;
    const k = 0.9 * Math.max(-1, Math.min(1, p.getZ(i) / zMax));
    const l = Math.hypot(nx, k);
    nr.setXYZ(i, nx / l, 0, k / l);
  }
  nr.needsUpdate = true;
  return g;
}

/**
 * Panelled leaf (local meters): hinge on the y axis, width w along +x, height h, thickness t (all amot in, meters out).
 * style: 'gate' (gold plate over panelled wood), 'bronze' (cast Corinthian bronze, a domed boss in each panel),
 *        'plank' (vertical boards with battens and nail heads).
 * holes: [[x0, y0, x1, y1]] amot cut-outs (a wicket in the leaf).
 * Detail ≥ 1: stiles and rails stand 0.14 proud with a chamfer down to each sunk panel (the edges catch raking light);
 * bronze panels carry a domed boss. Detail ≥ 2: nail-head rows on the gold leaves' rails.
 * o.astragal (a leaf of a PAIR): a meeting astragal on the +z face of the meeting stile, lapping ASTRAGAL.lap past the
 * leaf's free edge over its fellow (whose +z face is the other side, so each face of the joint is covered): the
 * 0.04-amah joint between the leaves no longer shows light through it (world-4, as the Mount gates have).
 */
export const ASTRAGAL = { w: 0.08, lap: 0.12, t: 0.06 };
export function leafGeometry(w, h, t, style, detail, holes = [], o = {}) {
  const A = AMAH, parts = [];
  // the core: a slab (minus holes, as a set of strips)
  const slab = (x0, y0, x1, y1, z0, z1) => parts.push(boxAt(x0 * A, y0 * A, z0 * A, x1 * A, y1 * A, z1 * A));
  // the astragal sits on the stile's face (the panelled frame stands 0.14 proud from detail 1)
  const astragal = () => {
    if (!o.astragal) return;
    const z0 = t / 2 + (style !== 'plank' && detail >= 1 ? 0.14 : 0);
    slab(w - ASTRAGAL.w, 0.03, w + ASTRAGAL.lap, h - 0.03, z0, z0 + ASTRAGAL.t);
  };
  if (!holes.length) slab(0, 0, w, h, -t / 2, t / 2);
  else {
    // split the leaf around a single rectangular hole: left, right, below, above
    const [hx0, hy0, hx1, hy1] = holes[0];
    slab(0, 0, hx0, h, -t / 2, t / 2);
    slab(hx1, 0, w, h, -t / 2, t / 2);
    if (hy0 > 0) slab(hx0, 0, hx1, hy0, -t / 2, t / 2);
    slab(hx0, hy1, hx1, h, -t / 2, t / 2);
  }
  if (style === 'plank') {
    // horizontal battens on both faces: three on a 16-amah leaf, more on taller ones (rows stay about 5 amot apart)
    const nb = Math.max(3, Math.round(h / 5.5));
    const rows = Array.from({ length: nb }, (_, i) => h * (0.1 + (0.8 * i) / (nb - 1)));
    if (detail >= 1) {
      for (const yy of rows) {
        for (const s of [-1, 1]) slab(0.15, yy - 0.3, w - 0.15, yy + 0.3, s > 0 ? t / 2 : -t / 2 - 0.08, s > 0 ? t / 2 + 0.08 : -t / 2);
      }
      // board joints: shallow grooves suggested by thin raised strips between boards
      const boards = Math.max(2, Math.round(w / 1.0));
      for (let i = 1; i < boards; i++) {
        const x = (w * i) / boards;
        for (const s of [-1, 1]) slab(x - 0.02, 0, x + 0.02, h, s > 0 ? t / 2 : -t / 2 - 0.015, s > 0 ? t / 2 + 0.015 : -t / 2);
      }
    }
    if (detail >= 2) {
      const stud = 0.07;
      for (const yy of rows) for (let i = 0; i < Math.max(2, Math.round(w / 0.8)); i++) {
        const x = 0.4 + i * ((w - 0.8) / Math.max(1, Math.round(w / 0.8) - 1));
        for (const s of [-1, 1]) {
          const z0 = s > 0 ? t / 2 + 0.08 : -t / 2 - 0.08 - stud, z1 = s > 0 ? t / 2 + 0.08 + stud : -t / 2 - 0.08;
          slab(x - stud, yy - stud, x + stud, yy + stud, z0, z1);
        }
      }
    }
    astragal();
    return finishLocal(parts);
  }
  // panelled leaf: a raised frame (stiles + rails) on both faces, sunk panels between
  if (detail >= 1) {
    const fw = Math.min(0.55, w * 0.11);           // frame width (amot)
    const proud = 0.14;                            // frame stands proud of the panels
    const cham = 0.12;                             // chamfer from the frame face down to the panel
    const nPan = Math.max(1, Math.round((h - fw) / (w - fw) * 0.9));
    const ph = (h - fw * (nPan + 1)) / nPan;
    const hole = holes[0];
    const crossesHole = (y0, y1) => hole && y1 > hole[1] && y0 < hole[3];
    const quads = [];
    const segB = [0, 12, 16, 24][detail] || 16;
    for (const s of [-1, 1]) {
      const zf = s * t / 2, zt = s * (t / 2 + proud);
      const z0 = Math.min(zf, zt), z1 = Math.max(zf, zt);
      slab(0, 0, fw, h, z0, z1);
      slab(w - fw, 0, w, h, z0, z1);
      for (let i = 0; i <= nPan; i++) {
        const y = i * (ph + fw);
        // skip rails crossing a hole
        if (crossesHole(y, y + fw)) {
          slab(fw, y, hole[0], y + fw, z0, z1);
          slab(hole[2], y, w - fw, y + fw, z0, z1);
        } else slab(fw, y, w - fw, y + fw, z0, z1);
      }
      // a frame around the wicket
      if (hole) {
        const [hx0, hy0, hx1, hy1] = hole;
        slab(hx0 - 0.2, hy0, hx0, hy1 + 0.2, z0, z1);
        slab(hx1, hy0, hx1 + 0.2, hy1 + 0.2, z0, z1);
        slab(hx0 - 0.2, hy1, hx1 + 0.2, hy1 + 0.2, z0, z1);
      }
      for (let i = 0; i < nPan; i++) {
        const y0 = fw + i * (ph + fw), y1 = y0 + ph, x0 = fw, x1 = w - fw;
        if (crossesHole(y0, y1)) continue;
        // the chamfered ring round the sunk panel (mitred at the corners)
        const c = cham;
        quads.push(
          [[x0, y0, zt], [x1, y0, zt], [x1 - c, y0 + c, zf], [x0 + c, y0 + c, zf], [0, 1, s], s],
          [[x0, y1, zt], [x1, y1, zt], [x1 - c, y1 - c, zf], [x0 + c, y1 - c, zf], [0, -1, s], s],
          [[x0, y0, zt], [x0, y1, zt], [x0 + c, y1 - c, zf], [x0 + c, y0 + c, zf], [1, 0, s], s],
          [[x1, y0, zt], [x1, y1, zt], [x1 - c, y1 - c, zf], [x1 - c, y0 + c, zf], [-1, 0, s], s],
        );
        if (style === 'bronze') {
          // a cast domed boss with a fillet at its foot ⚙
          const r = Math.min(x1 - x0, ph) * 0.17, hb = Math.min(0.3, Math.max(0.15, 0.4 * r));
          const prof = [[0, 0], [r * 1.18, 0], [r * 1.18, hb * 0.13], [r * 1.02, hb * 0.23], [r * 0.98, hb * 0.38], [r * 0.86, hb * 0.65],
            [r * 0.62, hb * 0.88], [r * 0.32, hb * 0.98], [0, hb]];
          const g = latheLocal(prof, segB);
          g.rotateX(s > 0 ? Math.PI / 2 : -Math.PI / 2);
          g.translate(((x0 + x1) / 2) * A, ((y0 + y1) / 2) * A, zf * A);
          parts.push(g);
        }
      }
      // nail heads along the rails
      if (style === 'gate' && detail >= 2) {
        const stud = 0.06;
        for (let i = 0; i <= nPan; i++) {
          const y = i * (ph + fw) + fw / 2;
          const n = Math.max(3, Math.round(w / 0.7));
          for (let k = 0; k < n; k++) {
            const x = fw * 0.5 + (k * (w - fw)) / (n - 1);
            if (hole && x > hole[0] - 0.25 && x < hole[2] + 0.25 && y > hole[1] - 0.25 && y < hole[3] + 0.25) continue;
            const z0s = s > 0 ? t / 2 + proud : -t / 2 - proud - stud, z1s = s > 0 ? t / 2 + proud + stud : -t / 2 - proud;
            slab(x - stud, y - stud, x + stud, y + stud, z0s, z1s);
          }
        }
      }
    }
    if (quads.length) parts.push(quadsLocal(quads));
    // the hinge stile turned round, a pivot post (a heavy leaf turns on pivots in sockets in the threshold and lintel)
    // ⚙ (qa-r2-fix-world): the leaf's flat hinge end, turned to the sun 0.2 amah out of the reveal when the leaf
    // stood open, read as a slit of light; the half-round post's back half lies in the reveal, and as the post turns
    // in place it shows a rounded, graded highlight instead
    const R = t / 2 + 0.14;
    parts.push(new CylinderGeometry(R * A, R * A, h * A, detail >= 2 ? 16 : 10, 1, true, Math.PI, Math.PI).translate(0, (h / 2) * A, 0));
  }
  astragal();
  return roundEdges(finishLocal(parts), w * A, (t / 2 + (detail >= 1 ? 0.14 : 0)) * A);
}

// ------------------------------------------------------------------------------------------------ curtains
/** Folded curtain half (local meters): x 0..w (amot→m), y 0..h, folds in z; DoubleSide material. */
export function curtainGeometry(w, h, folds, detail) {
  const A = AMAH;
  const nx = Math.max(8, folds * (detail >= 2 ? 8 : 4)), ny = detail >= 2 ? 6 : 2;
  const amp = 0.12 * A;
  const pos = [], nor = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny;
    const ph = u * folds * Math.PI * 2;
    const z = Math.sin(ph) * amp * (0.85 + 0.15 * v);
    pos.push(u * w * A, v * h * A, z);
    const dz = Math.cos(ph) * amp * folds * Math.PI * 2 / (w * A);
    const l = Math.hypot(dz, 1);
    nor.push(-dz / l, 0, 1 / l);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 2, d = a + nx + 1;
    idx.push(a, b, c, a, c, d);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  applyWorldUV(ng);
  return ng;
}

/**
 * Curtains as one InstancedMesh per set (the seven gate parochot of the Azarah — Yoma 54a; the Kohen Gadol's linen
 * screens — Yoma 3:4). Each item is two halves hung from a rod and gathered toward its two ends.
 * add(id, { left:[X,Y,Z] (rod end, site), along:[dx,dy], span? (amot, default 2·halfW), h? (amot) })
 *   → movable 'curtain:<id>'; userData.open(f): 0 = drawn across, 1 = gathered at the ends.
 */
export class Curtains {
  constructor(kit, key, halfW, h, gathered = 0.16, name = 'curtains') {
    this.kit = kit; this.key = key; this.halfW = halfW; this.h = h; this.gathered = gathered; this.name = name;
    this.items = []; this.mesh = null;
    kit.curtainSets.push(this);
  }
  add(id, { left, along, open = 1, label, span = null, h = null }) {
    const halfW = span ? span / 2 : this.halfW;
    const sw = halfW / this.halfW, sh = (h ?? this.h) / this.h;
    const a = new Vector3(along[0], 0, -along[1]).normalize();
    const p0 = m2w(left[0], left[1], left[2]);
    const p1 = p0.clone().addScaledVector(a, 2 * halfW * AMAH);
    const yawL = Math.atan2(-a.z, a.x), yawR = yawL + Math.PI;
    const item = { id, f: open, halves: [{ p: p0, yaw: yawL }, { p: p1, yaw: yawR }], base: this.items.length * 2 };
    const node = new Object3D();
    node.name = `curtain:${id}`;
    node.position.copy(p0.clone().lerp(p1, 0.5));
    const self = this;
    item.apply = () => {
      if (!self.mesh) return;
      const sx = (1 - (1 - self.gathered) * item.f) * sw;
      item.halves.forEach((hv, i) => {
        const m = new Matrix4().compose(hv.p, new Quaternion().setFromAxisAngle(Y_AXIS, hv.yaw), new Vector3(sx, sh, 1));
        self.mesh.setMatrixAt(item.base + i, m);
      });
      self.mesh.instanceMatrix.needsUpdate = true;
    };
    node.userData = {
      kind: 'curtain', id, label,
      get openAmount() { return item.f; },
      open(f) { item.f = Math.min(1, Math.max(0, +f || 0)); item.apply(); self.mesh?.computeBoundingSphere(); return item.f; },
    };
    this.kit.group.add(node);
    this.kit.ctx.movables.set(node.name, node);
    this.items.push(item);
    return node;
  }
  build(kit) {
    if (!this.items.length) return;
    const g = curtainGeometry(this.halfW, this.h, Math.round(this.halfW * 1.6), kit.detail);
    const im = new InstancedMesh(g, kit.ctx.mats.get(this.key), this.items.length * 2);
    im.name = `${kit.name}:${this.name}`;
    im.instanceMatrix.setUsage(DynamicDrawUsage);
    im.castShadow = true; im.receiveShadow = true;
    this.mesh = im;
    for (const it of this.items) it.apply();
    im.computeBoundingSphere();
    kit.group.add(im);
  }
}

/** Matrix for an instanced LOCAL part placed at a site point with a compass heading (deg) and uniform scale. */
export function placeAt(X, Y, Z, headingDeg = 0, s = 1) {
  const p = m2w(X, Y, Z);
  const q = new Quaternion().setFromAxisAngle(Y_AXIS, -headingDeg * Math.PI / 180);
  return new Matrix4().compose(p, q, new Vector3(s, s, s));
}

/** A dedicated mesh (special leaves, wheels) in LOCAL meters. */
export function meshOf(kit, geometry, key, name) {
  const m = new Mesh(geometry, kit.ctx.mats.get(key));
  m.name = name;
  m.castShadow = true; m.receiveShadow = true;
  m.matrixAutoUpdate = false;
  return m;
}

export { Mesh, Group, Object3D, Vector3, Matrix4, Quaternion, mergeGeometries, boxAt, finishLocal };

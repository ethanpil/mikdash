// Build kit for the Heichal: material buckets → StaticBatcher (one draw call per material), per-key UV mappers,
// instanced sets, door leaves (instanced, animated through ctx.movables), thick drapes (the parochot) and helpers.
//
// Bucket keys are 'materialKey' or 'materialKey|uvTag'. The tag selects a UV mapper (registered with uv(tag, fn))
// that rewrites the bucket's UVs before batching — e.g. the Kodesh relief registers aligned to the walls, the Ulam
// rovadin courses mapped onto single texture courses. Buckets with different tags but the same material still land
// in ONE draw call (StaticBatcher merges by material).
//
// Movables (see docs/decisions/build-heichal.md):
//   'door:<element id>'      Object3D at the doorway; userData.open(f), f ∈ [0, 1] (0 shut … 1 open), openAmount
//   'curtain:<element id>'   userData.open(f): split curtains 0 = drawn across … 1 = gathered at the jambs;
//                            pinned parochot 0 = closed to the wall … 1 = fully drawn back (default ≈ the pinned gap)
import {
  Group, Object3D, InstancedMesh, Mesh, Matrix4, Quaternion, Vector3, BoxGeometry, CylinderGeometry, BufferGeometry,
  Float32BufferAttribute, DynamicDrawUsage, SphereGeometry, LatheGeometry, Vector2, Color, MeshStandardMaterial,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { StaticBatcher, applyWorldUV } from '../../geom.js';
import { AMAH, m2w } from '../../../core/units.js';
import { Mesher } from './geo.js';

const Y_AXIS = new Vector3(0, 1, 0);

export class Kit {
  constructor(ctx, name) {
    this.ctx = ctx;
    this.name = name;
    this.detail = ctx.quality?.detail ?? 1;
    this.group = new Group();
    this.group.name = name;
    // the batcher resolves keys through this kit, so '~variant' keys (see variant()) batch like library keys
    this.batch = new StaticBatcher({ mats: { get: (k) => this.material(k) }, addCollider: (g, t) => ctx.addCollider(g, t) }, name);
    this.buckets = new Map();
    this.extra = [];
    this.sets = new Map();
    this.leafSets = new Map();
    this.uvFns = new Map();
    this.colliders = [];
    this.fallbacks = [];
    this.variants = new Map();
  }

  /** material key with a fallback while the materials task has not added it yet */
  mat(key, fallback) {
    if (this.ctx.mats?.has?.(key)) return key;
    if (!this.fallbacks.includes(key)) this.fallbacks.push(key);
    return fallback;
  }

  /** a library material, or a '~name' variant registered with variant() */
  material(key) {
    if (key && key[0] === '~') return this.variants.get(key.slice(1))?.material || this.ctx.mats.get('debug');
    return this.ctx.mats.get(key);
  }

  /**
   * A variant of a library material for a part the library has no key for yet (a tint, a polish): the SAME texture
   * maps and the same shader patch and program-cache key (no new shader program), with plain overrides — color
   * (a multiplier on the library's), roughness / metalness (multipliers), envMapIntensity. Re-synced on
   * 'quality:change' (the library swaps its maps in place then). Returns the key '~name' for kit buckets.
   */
  variant(name, baseKey, o = {}) {
    if (this.variants.has(name)) return `~${name}`;
    const src = this.ctx.mats.get(baseKey);
    const Ctor = src.constructor || MeshStandardMaterial;
    const m = new Ctor();
    const sync = () => {
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'metalnessMap']) m[k] = src[k] || null;
      if (src.normalScale) m.normalScale.copy(src.normalScale);
      m.color.copy(src.color || new Color(1, 1, 1));
      if (o.color) m.color.multiply(new Color(o.color));
      m.roughness = src.roughness * (o.roughness ?? 1);
      m.metalness = Math.min(1, src.metalness * (o.metalness ?? 1));
      m.side = src.side;
      if (src.sheen != null && m.sheen != null) { m.sheen = src.sheen; m.sheenColor?.copy(src.sheenColor); m.sheenRoughness = src.sheenRoughness; }
      if (o.envMapIntensity != null) m.envMapIntensity = o.envMapIntensity;
      m.needsUpdate = true;
    };
    sync();
    if (src.onBeforeCompile && src.onBeforeCompile !== Ctor.prototype.onBeforeCompile) {
      m.onBeforeCompile = src.onBeforeCompile;
      m.customProgramCacheKey = src.customProgramCacheKey;
    }
    m.name = `${baseKey}~${name}`;
    m.userData = { matKey: baseKey, variant: name };
    this.variants.set(name, { material: m, baseKey });
    this.ctx.bus?.on?.('quality:change', sync);
    return `~${name}`;
  }

  /** register a UV mapper: fn(geometry) rewrites geometry.attributes.uv (world-space positions) */
  uv(tag, fn) { this.uvFns.set(tag, fn); }

  /** the Mesher bucket for (key[|uvTag], collide, castShadow) */
  m(key, collide = true, cast = true) {
    const k = `${key}#${collide ? 1 : 0}${cast ? 1 : 0}`;
    let b = this.buckets.get(k);
    if (!b) { b = { key, collide, cast, mesher: new Mesher() }; this.buckets.set(k, b); }
    return b.mesher;
  }

  /** merge a gridSolid result (Map key → Mesher) into the buckets */
  solid(map, collide = true, cast = true) {
    for (const [key, mesher] of map) this.m(key, collide, cast).merge(mesher);
  }

  /** a ready WORLD geometry */
  geo(g, key, opts = {}) { this.extra.push([g, key, opts]); }

  /** an extra collider-only geometry (world) — e.g. smooth ramps over stairs */
  collider(g, tag) { this.colliders.push([g, tag || `${this.name}:ramp`]); }

  /** instanced set: factory() → LOCAL geometry (meters); inst(name, matrix) per instance */
  set(name, factory, key, opts = {}) {
    let s = this.sets.get(name);
    if (!s) { s = { name, factory, key, opts, mats: [] }; this.sets.set(name, s); }
    return s;
  }

  inst(name, matrix) { this.sets.get(name).mats.push(matrix.clone()); }

  /** add an Object3D straight to the area group */
  add(o) { this.group.add(o); return o; }

  _uvApply(key, g) {
    const bar = key.indexOf('|');
    if (bar < 0) return key;
    const mat = key.slice(0, bar);
    const tag = key.slice(bar + 1);
    const [name, ...args] = tag.split(':');
    const fn = this.uvFns.get(name);
    if (fn) fn(g, ...args);
    return mat;
  }

  finish() {
    for (const { key, collide, cast, mesher } of this.buckets.values()) {
      if (!mesher.count) continue;
      const g = mesher.geometry();
      const mat = this._uvApply(key, g);
      this.batch.add(g, mat, { collide, castShadow: cast });
    }
    for (const [g, key, opts] of this.extra) {
      const mat = this._uvApply(key, g);
      this.batch.add(g, mat, opts);
    }
    this.group.add(this.batch.build());
    for (const [g, tag] of this.colliders) this.ctx.addCollider(g, tag);
    for (const s of this.sets.values()) {
      if (!s.mats.length) continue;
      const geo = s.factory();
      const im = new InstancedMesh(geo, this.material(s.key), s.mats.length);
      im.name = `${this.name}:${s.name}`;
      s.mats.forEach((mx, i) => im.setMatrixAt(i, mx));
      im.instanceMatrix.needsUpdate = true;
      im.castShadow = s.opts.cast ?? true;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.group.add(im);
    }
    for (const ls of this.leafSets.values()) ls.build(this);
    return this.group;
  }
}

// ------------------------------------------------------------------------------------------- UV helpers
/** For each vertex call fn(X, Y, Z, nX, nY, nZ) in SITE coordinates (amot) → [u, v] (meters of texture) */
export function mapUV(g, fn) {
  const p = g.attributes.position, n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const X = p.getX(i) / AMAH, Y = -p.getZ(i) / AMAH, Z = p.getY(i) / AMAH;
    const r = fn(X, Y, Z, n.getX(i), -n.getZ(i), n.getY(i), i);
    uv[i * 2] = r[0]; uv[i * 2 + 1] = r[1];
  }
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return g;
}

// ------------------------------------------------------------------------------------------ door leaves
const yawOf = (dx, dy) => Math.atan2(dy, dx); // site direction (dx east, dy north) → yaw about world +y (local +x)

/**
 * Identical leaves (size/style/material) as one InstancedMesh. geometryFn() → LOCAL geometry (meters), hinge on
 * the local y axis, leaf along +x, thickness centred on z.
 */
class LeafSet {
  constructor(name, key, geometryFn) { this.name = name; this.key = key; this.geometryFn = geometryFn; this.leaves = []; this.mesh = null; }
  add(leaf) { leaf.index = this.leaves.length; this.leaves.push(leaf); leaf.set = this; return leaf; }
  build(kit) {
    if (!this.leaves.length) return;
    const im = new InstancedMesh(this.geometryFn(), kit.material(this.key), this.leaves.length);
    im.name = `${kit.name}:leaves:${this.name}`;
    im.instanceMatrix.setUsage(DynamicDrawUsage);
    im.castShadow = true; im.receiveShadow = true;
    this.mesh = im;
    for (const l of this.leaves) l.apply();
    im.computeBoundingSphere();
    kit.group.add(im);
  }
}

export function leafSet(kit, name, key, geometryFn) {
  let s = kit.leafSets.get(name);
  if (!s) { s = new LeafSet(name, key, geometryFn); kit.leafSets.set(name, s); }
  return s;
}

const _lq = new Quaternion();
const _ls = new Vector3(1, 1, 1);
/**
 * Register a door: leaves [{ set, hinge:[X,Y,Z] site, along:[dx,dy] shut direction, into:[dx,dy] swing side,
 * angle (rad, default π/2) }]. The leaf rotates about the vertical through its hinge. For a 180° swing `into` is
 * the side the leaf passes through. → movable 'door:<id>' with userData.open(f) / openAmount.
 */
export function addDoor(kit, id, leaves, { open = 0, center, label, extra = {} } = {}) {
  const node = new Object3D();
  node.name = `door:${id}`;
  if (center) node.position.copy(m2w(center[0], center[1], center[2]));
  const L = leaves.map((spec) => {
    const hinge = m2w(spec.hinge[0], spec.hinge[1], spec.hinge[2]);
    const ang = spec.angle ?? Math.PI / 2;
    const yaw0 = yawOf(spec.along[0], spec.along[1]);
    const want = yawOf(spec.into[0], spec.into[1]);
    const score = (s) => Math.cos(yaw0 + s * ang / 2 - want);
    const sign = score(1) >= score(-1) ? 1 : -1;
    const leaf = { hinge, yaw0, yaw1: yaw0 + sign * ang, f: open, scale: spec.scale ? new Vector3(...spec.scale) : null };
    leaf.apply = () => {
      if (!leaf.set?.mesh) return;
      const yaw = leaf.yaw0 + (leaf.yaw1 - leaf.yaw0) * leaf.f;
      _lq.setFromAxisAngle(Y_AXIS, yaw);
      leaf.set.mesh.setMatrixAt(leaf.index, new Matrix4().compose(leaf.hinge, _lq, leaf.scale || _ls));
      leaf.set.mesh.instanceMatrix.needsUpdate = true;
    };
    spec.set.add(leaf);
    leaf.group = spec.group || 'all';
    return leaf;
  });
  const setOpen = (list, f) => {
    const v = Math.min(1, Math.max(0, +f || 0));
    for (const l of list) { l.f = v; l.apply(); }
    for (const s of new Set(list.map((l) => l.set))) s.mesh?.computeBoundingSphere();
    return v;
  };
  node.userData = {
    kind: 'door', id, label, leaves: L.length, ...extra,
    get openAmount() { return L[0]?.f ?? 0; },
    open(f) { return setOpen(L, f); },
    /** open only the leaves of one group (e.g. 'outer' / 'inner' of the great gate) */
    openGroup(group, f) { return setOpen(L.filter((l) => l.group === group), f); },
  };
  kit.group.add(node);
  kit.ctx.movables.set(node.name, node);
  return node;
}

const boxAt = (x0, y0, z0, x1, y1, z1) => {
  const g = new BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  return g;
};
export function finishLocal(parts) {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)).map((p) => {
    for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(k)) p.deleteAttribute(k);
    return p;
  }), false);
  applyWorldUV(g);
  g.computeBoundingSphere();
  return g;
}

/**
 * Panelled leaf (LOCAL meters; inputs in amot): hinge on the y axis, width w along +x, height h, thickness t.
 * style 'gold': gold sheet over panelled wood — raised stiles and rails, sunk panels, bead mouldings and rows of
 * nail heads at higher detail; 'plank': cedar boards with three battens.
 */
export function leafGeometry(w, h, t, style, detail) {
  const A = AMAH, parts = [];
  const slab = (x0, y0, x1, y1, z0, z1) => parts.push(boxAt(x0 * A, y0 * A, z0 * A, x1 * A, y1 * A, z1 * A));
  slab(0, 0, w, h, -t / 2, t / 2);
  if (style === 'plank') {
    if (detail >= 1) {
      for (const yy of [h * 0.12, h * 0.5, h * 0.88]) for (const s of [-1, 1]) {
        slab(0.12, yy - 0.25, w - 0.12, yy + 0.25, s > 0 ? t / 2 : -t / 2 - 0.07, s > 0 ? t / 2 + 0.07 : -t / 2);
      }
      const boards = Math.max(2, Math.round(w / 0.9));
      for (let i = 1; i < boards; i++) {
        const x = (w * i) / boards;
        for (const s of [-1, 1]) slab(x - 0.02, 0, x + 0.02, h, s > 0 ? t / 2 : -t / 2 - 0.012, s > 0 ? t / 2 + 0.012 : -t / 2);
      }
    }
    return finishLocal(parts);
  }
  if (detail >= 1) {
    const fw = Math.min(0.5, w * 0.1);
    const proud = 0.06;
    const nPan = Math.max(1, Math.round((h - fw) / (w - fw) * 0.75));
    const ph = (h - fw * (nPan + 1)) / nPan;
    for (const s of [-1, 1]) {
      const z0 = s > 0 ? t / 2 : -t / 2 - proud, z1 = s > 0 ? t / 2 + proud : -t / 2;
      slab(0, 0, fw, h, z0, z1);
      slab(w - fw, 0, w, h, z0, z1);
      for (let i = 0; i <= nPan; i++) { const y = i * (ph + fw); slab(fw, y, w - fw, y + fw, z0, z1); }
      if (detail >= 2) {
        for (let i = 0; i < nPan; i++) {
          const y0 = fw + i * (ph + fw), y1 = y0 + ph;
          const b = 0.1, i0 = 0.22, zb0 = s > 0 ? t / 2 : -t / 2 - 0.03, zb1 = s > 0 ? t / 2 + 0.03 : -t / 2;
          slab(fw + i0, y0 + i0, w - fw - i0, y0 + i0 + b, zb0, zb1);
          slab(fw + i0, y1 - i0 - b, w - fw - i0, y1 - i0, zb0, zb1);
          slab(fw + i0, y0 + i0, fw + i0 + b, y1 - i0, zb0, zb1);
          slab(w - fw - i0 - b, y0 + i0, w - fw - i0, y1 - i0, zb0, zb1);
          // an open flower in the middle of each panel (a rosette of eight flat-topped petals round a button): flat
          // petals catch the light like the panel (a flat cap vanished against the plate and read as a hollow ring;
          // a polished dome mirrored the court like a porthole)
          const r = Math.min(w - 2 * fw, ph) * 0.13;
          const cx0 = (w / 2) * A, cy0 = ((y0 + y1) / 2) * A, zf = s * (t / 2) * A;
          const nP = 8, pt = 0.035;
          for (let k = 0; k < nP; k++) {
            const a = (k / nP) * Math.PI * 2 + Math.PI / nP;
            const len = r * 0.95, pw = r * 0.36;
            const g = new BoxGeometry(len * A, pw * A, pt * A);
            g.translate((r * 0.22 + len / 2) * A, 0, 0);
            // taper the petal toward its tip
            const pp = g.attributes.position;
            for (let i = 0; i < pp.count; i++) { const f = 1 - 0.55 * Math.max(0, pp.getX(i) / A - r * 0.22) / len; pp.setY(i, pp.getY(i) * f); }
            g.rotateZ(a);
            g.translate(cx0, cy0, zf + s * (pt / 2) * A);
            parts.push(g);
          }
          const btn = new LatheGeometry([[r * 0.3, 0], [r * 0.28, 0.04], [r * 0.16, 0.065], [0, 0.07]].map(([pr, pz]) => new Vector2(pr * A, pz * A)), detail >= 3 ? 16 : 10);
          btn.rotateX(s * Math.PI / 2);
          btn.translate(cx0, cy0, zf);
          parts.push(btn);
        }
        const stud = 0.05;
        for (let i = 0; i <= nPan; i++) {
          const y = i * (ph + fw) + fw / 2;
          const n = Math.max(3, Math.round(w / 0.6));
          for (let k = 0; k < n; k++) {
            const x = fw * 0.5 + (k * (w - fw)) / (n - 1);
            const z0 = s > 0 ? t / 2 + proud : -t / 2 - proud - stud, z1 = s > 0 ? t / 2 + proud + stud : -t / 2 - proud;
            slab(x - stud, y - stud, x + stud, y + stud, z0, z1);
          }
        }
      }
    }
  }
  return finishLocal(parts);
}

// ---------------------------------------------------------------------------------------------- drapes
/**
 * A thick hanging curtain (a tefach-thick parochet) with soft folds, as one dynamic Mesh in WORLD space.
 *   mode 'split': two halves hung from the jambs (a, b ends of the rod), gathered toward the jambs by open(f).
 *   mode 'pinned': one sheet fixed at end a; its far end (b) is drawn back toward a by open(f) — the "perufah"
 *                  of Yoma 52b: the end portion bunches into tight folds, leaving a gap at b.
 * spec: { a:[X,Y], b:[X,Y] rod ends (site), z0 floor, z1 top (rod), t thickness (amot), fold (period, amot),
 *         amp (fold depth, amot), gather (fraction a fully gathered sheet keeps), endPortion (pinned: share of the
 *         sheet that bunches) }
 */
export class Drape {
  constructor(kit, spec) {
    this.kit = kit;
    this.spec = { t: 1 / 6, fold: 1.4, amp: 0.12, gather: 0.16, endPortion: 0.22, mode: 'split', ...spec };
    const d = kit.detail;
    const s = this.spec;
    const W = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    this.W = W;
    const nFolds = Math.max(4, Math.round(W / s.fold));
    this.cols = Math.max(24, nFolds * [4, 6, 8, 10][d]);
    this.rows = [3, 5, 12, 16][d];
    this.f = 0;
    const halves = s.mode === 'split' ? 2 : 1;
    // vertex layout per sheet: front grid, back grid (rows+1 × cols+1 each), then edges are separate quads
    this.perSheet = (this.rows + 1) * (this.cols + 1);
    const nV = halves * (2 * this.perSheet + 4 * (this.cols + 1) + 4 * (this.rows + 1));
    this.geometry = new BufferGeometry();
    // (Float32BufferAttribute copies its input: keep references to the attributes' own arrays)
    this.geometry.setAttribute('position', new Float32BufferAttribute(nV * 3, 3).setUsage(DynamicDrawUsage));
    this.geometry.setAttribute('uv', new Float32BufferAttribute(nV * 2, 2));
    this.geometry.setAttribute('normal', new Float32BufferAttribute(nV * 3, 3).setUsage(DynamicDrawUsage));
    this.pos = this.geometry.attributes.position.array;
    this.uv = this.geometry.attributes.uv.array;
    this.halves = halves;
    this._buildIndex();
    this.edgePairs = new Int32Array(nV).fill(-1);   // edge-strip vertex → the face vertex it continues (normals)
    this.mesh = new Mesh(this.geometry, kit.material(spec.key || 'parochet'));
    this.mesh.name = `${kit.name}:drape:${spec.id}`;
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.seed = (spec.seed ?? 1) * 1.7;
  }

  _buildIndex() {
    const idx = [];
    const C = this.cols, R = this.rows;
    let base = 0;
    for (let h = 0; h < this.halves; h++) {
      const grid = (o, flip) => {
        for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
          const a = o + j * (C + 1) + i, b = a + 1, c = a + C + 2, dd = a + C + 1;
          if (flip) idx.push(a, c, b, a, dd, c); else idx.push(a, b, c, a, c, dd);
        }
      };
      grid(base, false);
      grid(base + this.perSheet, true);
      let o = base + 2 * this.perSheet;
      // bottom and top edges (cols+1 pairs each), then the two side edges (rows+1 pairs each)
      const strip = (n, flip) => {
        for (let i = 0; i < n - 1; i++) {
          const a = o + i * 2, b = a + 1, c = a + 3, dd = a + 2;
          if (flip) idx.push(a, c, b, a, dd, c); else idx.push(a, b, c, a, c, dd);
        }
        o += n * 2;
      };
      strip(C + 1, false); strip(C + 1, true); strip(R + 1, true); strip(R + 1, false);
      base = o;
    }
    this.geometry.setIndex(idx);
  }

  /** layout for open amount f */
  update(f) {
    this.f = Math.min(1, Math.max(0, f));
    const s = this.spec, A = AMAH, C = this.cols, R = this.rows;
    const ax = s.a[0], ay = s.a[1], bx = s.b[0], by = s.b[1];
    const W = this.W;
    const dx = (bx - ax) / W, dy = (by - ay) / W;          // rod direction (site)
    const nx = -dy, ny = dx;                                // horizontal normal (site)
    const pos = this.pos, uv = this.uv;
    let vi = 0;
    const put = (X, Y, Z, u, v, pair = -1) => {
      pos[vi * 3] = X * A; pos[vi * 3 + 1] = Z * A; pos[vi * 3 + 2] = -Y * A;
      uv[vi * 2] = u; uv[vi * 2 + 1] = v; this.edgePairs[vi] = pair; vi++;
    };
    const H = s.z1 - s.z0;
    const sheets = [];
    const split = s.mode === 'split';
    if (split) {
      // the two halves overlap by `overlap` at the middle and hang on two lines `layer` apart (the second toward
      // −normal), so drawn shut they lap instead of interpenetrating
      const ov = s.overlap ?? 1, lay = s.layer ?? s.t * 1.15;
      const Wh = W / 2 + ov / 2, L = Wh * (1 - this.f * (1 - s.gather));
      sheets.push({ o: [ax, ay], dir: [dx, dy], Wrest: Wh, x: (q) => q * L, comp: () => L / Wh, phase: 0, lift: 0 });
      sheets.push({ o: [bx, by], dir: [-dx, -dy], Wrest: Wh, x: (q) => q * L, comp: () => L / Wh, phase: 2.1, lift: -lay });
    } else {
      const r = s.endPortion, gap = this.f * r * W * (1 - s.gather);
      const Lend = r * W - gap;
      sheets.push({
        o: [ax, ay], dir: [dx, dy], Wrest: W, phase: 0, lift: 0,
        x: (q) => (q <= 1 - r ? q * W : (1 - r) * W + ((q - (1 - r)) / r) * Lend),
        comp: (q) => (q <= 1 - r ? 1 : Lend / (r * W)),
      });
    }
    const folds = Math.max(4, Math.round(W / s.fold));
    const sstep = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    for (const sh of sheets) {
      const kf = (sh.Wrest / W) * folds;
      const t = s.t / 2;
      const col = (q, v) => {
        // fold offset (perpendicular to the rod); deeper where the cloth is gathered, a little deeper at the hem —
        // but the two vertical edges hang straight (a constant offset down their length: no saw-tooth)
        const c = Math.max(0.12, sh.comp(q));
        const eDist = Math.min(q, 1 - q) * sh.Wrest;
        const vf = 0.92 + (0.35 * v - 0.17) * sstep(0, 0.8, eDist);
        let amp = s.amp * Math.min(3.2, 1 / Math.sqrt(c)) * vf;
        // a split curtain's meeting edge flattens over its last amah and a half, where the other half laps it
        if (split) amp *= 0.3 + 0.7 * sstep(0, 1.5, (1 - q) * sh.Wrest);
        const ph = 2 * Math.PI * kf * q + sh.phase + this.seed;
        const off = amp * (0.82 * Math.sin(ph) + 0.18 * Math.sin(2.37 * ph + 1.3 + this.seed));
        const slope = amp * 2 * Math.PI * kf * (0.82 * Math.cos(ph) + 0.18 * 2.37 * Math.cos(2.37 * ph + 1.3 + this.seed)) / Math.max(sh.Wrest * c, 1e-3);
        // the hem swings a touch where the cloth is free; the sheet's edges are held at the rod
        const x = sh.x(q);
        return { x, off: (q < 0.002 ? off * 0.3 : off) + sh.lift, slope };
      };
      const P = (q, v, side) => {
        const { x, off, slope } = col(q, v);
        const ln = Math.hypot(1, slope);
        // offset ±t along the local normal of the folded sheet (in the horizontal plane)
        const tnx = (-slope * sh.dir[0] + 1 * nx) / ln, tny = (-slope * sh.dir[1] + 1 * ny) / ln;
        const X = sh.o[0] + sh.dir[0] * x + nx * off + tnx * t * side;
        const Y = sh.o[1] + sh.dir[1] * x + ny * off + tny * t * side;
        const Z = s.z0 + 0.03 + v * (H - 0.03);
        return [X, Y, Z];
      };
      const base = vi;
      const fIdx = (side, j, i) => base + (side > 0 ? 0 : this.perSheet) + j * (C + 1) + i;
      for (const side of [1, -1]) {
        for (let j = 0; j <= R; j++) for (let i = 0; i <= C; i++) {
          const q = i / C, v = j / R;
          const p = P(q, v, side);
          put(p[0], p[1], p[2], q * sh.Wrest * A, v * H * A);
        }
      }
      // the edge strips (hem, head, the two vertical edges) continue the faces' texture (same u, v as the face edge
      // they belong to) and take the faces' normals (below), so the tefach-thick edge reads as the cloth's own edge
      // and not as a separately lit stripe
      for (const v of [0, 1]) for (let i = 0; i <= C; i++) {
        const q = i / C, j = v * R;
        const p1 = P(q, v, 1), p2 = P(q, v, -1);
        put(p1[0], p1[1], p1[2], q * sh.Wrest * A, v * H * A, fIdx(1, j, i)); put(p2[0], p2[1], p2[2], q * sh.Wrest * A, v * H * A, fIdx(-1, j, i));
      }
      for (const q of [0, 1]) for (let j = 0; j <= R; j++) {
        const v = j / R, i = q * C;
        const p1 = P(q, v, 1), p2 = P(q, v, -1);
        put(p1[0], p1[1], p1[2], q * sh.Wrest * A, v * H * A, fIdx(1, j, i)); put(p2[0], p2[1], p2[2], q * sh.Wrest * A, v * H * A, fIdx(-1, j, i));
      }
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.geometry.computeVertexNormals();
    // edge strips: their normals mostly follow the face they continue (a little of their own, for the rim light)
    const nrm = this.geometry.attributes.normal.array;
    for (let k = 0; k < vi; k++) {
      const f = this.edgePairs[k];
      if (f < 0) continue;
      const x = nrm[f * 3] + 0.25 * nrm[k * 3], y = nrm[f * 3 + 1] + 0.25 * nrm[k * 3 + 1], z = nrm[f * 3 + 2] + 0.25 * nrm[k * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      nrm[k * 3] = x / l; nrm[k * 3 + 1] = y / l; nrm[k * 3 + 2] = z / l;
    }
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
  }

  /** register as movable 'curtain:<id>' */
  register(id, { open = 0, label, extra = {} } = {}) {
    const node = new Object3D();
    node.name = `curtain:${id}`;
    const s = this.spec;
    node.position.copy(m2w((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, s.z0));
    const self = this;
    node.userData = {
      kind: 'curtain', id, label, mode: s.mode, ...extra,
      get openAmount() { return self.f; },
      open(f) { self.update(+f || 0); return self.f; },
    };
    this.update(open);
    this.kit.group.add(this.mesh);
    this.kit.group.add(node);
    this.kit.ctx.movables.set(node.name, node);
    return node;
  }
}

/** Matrix for an instanced LOCAL part at a site point with a compass heading (deg) and scale */
export function placeAt(X, Y, Z, headingDeg = 0, s = 1) {
  const p = m2w(X, Y, Z);
  const q = new Quaternion().setFromAxisAngle(Y_AXIS, -headingDeg * Math.PI / 180);
  const sc = Array.isArray(s) ? new Vector3(...s) : new Vector3(s, s, s);
  return new Matrix4().compose(p, q, sc);
}

export { Mesh, Group, Object3D, Vector3, Matrix4, Quaternion, mergeGeometries, boxAt, SphereGeometry, CylinderGeometry };

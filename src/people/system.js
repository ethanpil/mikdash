// People runtime: every figure — hero actor or crowd member — is an instance in a GPU-animated InstancedMesh
// batch (one batch per archetype × LOD, one per prop variant). Each frame we cull, pick an LOD by projected
// size, honour quality.maxFigures (nearest first, actors first; the next ones are drawn as cheap LOD3
// silhouettes that dither out at the far cap) and write compact instance buffers; the vertex shader does all
// the skinning, so the CPU cost per figure is a few dozen floats.
import {
  Group, Object3D, InstancedMesh, InstancedBufferAttribute, BufferGeometry, DynamicDrawUsage, Frustum, Matrix4,
  Vector3, Sphere, Mesh, BufferAttribute, MeshStandardMaterial, ShaderMaterial,
} from 'three';
import { AnimAtlas } from './anim.js';
import { LocalPose, blendPose } from './pose.js';
import { ARCHETYPES, ROLES, ANIMALS } from './roles.js';
import { buildHumanGeometry } from './human.js';
import { buildAnimalGeometry, halterPoint } from './animals.js';
import { gripOffset } from './clips.js';
import { PROPS, HELD_VESSELS, buildPropGeometry, propAttach, propTip } from './props.js';
import { createPeopleMaterial, createPeopleDepthMaterials } from './material.js';
import { CLIP_ALIASES } from './clips.js';
import { m2w, headingToYaw, AMAH } from '../core/units.js';
import { rng, hashStr, clamp, lerp, smooth } from './util.js';

const LOD0_PX = [300, 220, 170, 130];
const LOD1_PX = [110, 90, 72, 56];
const LOD3_PX = [30, 24, 18, 14];   // smaller than this on screen → LOD3 even within the budget
const MAX_HERO = [8, 14, 24, 48];
const FAR_MULT = 3;                 // beyond maxFigures: up to FAR_MULT × maxFigures more, as LOD3
const FAR_FADE = 0.2;               // the last 20 % of that far allowance dithers out (no popping)
const WALK_SPEED = 1.25, RUN_SPEED = 3.6;
const FLOW_FADE_M = 1.6;            // flowing crowds dither in/out within this distance of the region edge
const OFFDUTY_POSES = new Set(['sleep', 'lie']);
const OFFDUTY_ARCH = 'israelite';   // a kohen's own clothes (Tamid 1:1): ordinary tunic + mantle, head bare
const BATH_POSES = new Set(['bathe']);
const MASK_HEADGEAR = 8, MASK_BARE = 16; // human.js GRP.HEADGEAR / GRP.BARE as instance mask bits
const TORCH_FLAME = { size: 0.32, intensity: 1, kind: 'torch' };

/**
 * The figure a role shows in a pose, when it is not its own archetype: kohanim never sleep in the holy garments — in
 * 'sleep' / 'lie' they wear their own clothes and lie on the folded garments under their own mantle (Tamid 1:1; the
 * elders on the ledge bedding); in 'bathe' a kohanic role shows its bathing figure. → { arch, prop } | null
 */
function poseVariant(def, pose) {
  if (!def) return null;
  if (def.offduty && OFFDUTY_POSES.has(pose)) return def._off || (def._off = { arch: def.offArch || OFFDUTY_ARCH, prop: { name: def.offProp || 'folded_garments', side: 'r' } });
  if (def.bathArch && BATH_POSES.has(pose)) return def._bath || (def._bath = { arch: def.bathArch, prop: null });
  return null;
}
/** the clip a prop asks for in a pose (PROPS[name].poses, e.g. wood on the shoulder → carry_log), if the rig has it */
function propClip(arch, prop, pose) {
  const pp = prop && PROPS[prop.name]?.poses?.[pose];
  return pp ? arch.clip(pp) : null;
}
const _bathWarned = new Set();
/** 'bathe' on a role with no bathing figure immerses it in its clothes: say so once per role */
function warnBathe(role, def) {
  if (!def || def.bathArch || /bathing/.test(def.arch) || _bathWarned.has(role)) return;
  _bathWarned.add(role);
  console.warn(`[people] pose "bathe" on role ${role}: it has no bathing figure (bathArch) and immerses in its clothes`);
}

const _m = new Matrix4();
const _m2 = new Matrix4();
const _v = new Vector3();
const _v2 = new Vector3();
const _sph = new Sphere();
const _fa = [0, 0, 0];
const _fb = [0, 0, 0];
const _e2 = new Float32Array(16);

// distinct prop batches (draw calls) per frame by tier (low … ultra); see the draw loop
const PROP_BATCH_CAP = [14, 22, 34, 56];

// --------------------------------------------------------------------------------------------- batches
class Batch {
  constructor(sys, name, src, material, depth, opts = {}) {
    this.sys = sys; this.name = name; this.src = src; this.material = material; this.depth = depth;
    this.opts = opts; this.cap = 0; this.n = 0; this.mesh = null;
    this._alloc(opts.cap || 16);
  }
  _alloc(cap) {
    const old = this.mesh;
    const g = new BufferGeometry();
    for (const k of Object.keys(this.src.attributes)) g.setAttribute(k, this.src.attributes[k]);
    g.setIndex(this.src.index);
    g.boundingSphere = this.src.boundingSphere;
    const mk = (n) => new InstancedBufferAttribute(new Float32Array(cap * n), n).setUsage(DynamicDrawUsage);
    this.aA = mk(4); this.aB = mk(4); this.aT = mk(4);
    g.setAttribute('pAnimA', this.aA); g.setAttribute('pAnimB', this.aB); g.setAttribute('pTint', this.aT);
    const mesh = new InstancedMesh(g, this.material, cap);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    mesh.visible = false;
    mesh.name = `people:${this.name}`;
    mesh.castShadow = !!this.opts.castShadow;
    mesh.receiveShadow = true;
    mesh.customDepthMaterial = this.depth.depth;
    mesh.customDistanceMaterial = this.depth.distance;
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldAutoUpdate = false;
    if (old) {
      mesh.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.n * 16));
      this.aA.array.set(this._oA.array.subarray(0, this.n * 4));
      this.aB.array.set(this._oB.array.subarray(0, this.n * 4));
      this.aT.array.set(this._oT.array.subarray(0, this.n * 4));
      this._release(old);
    }
    this._oA = this.aA; this._oB = this.aB; this._oT = this.aT;
    this.mesh = mesh;
    this.cap = cap;
    this.sys.root.add(mesh);
  }
  /** detach a mesh: the shared source attributes stay, its own instance buffers are freed */
  _release(mesh) {
    this.sys.root.remove(mesh);
    const og = mesh.geometry;
    for (const k of Object.keys(this.src.attributes)) og.deleteAttribute(k);
    og.setIndex(null);
    og.dispose();      // frees pAnimA / pAnimB / pTint
    mesh.dispose();    // frees instanceMatrix (WebGLObjects listens for the mesh's 'dispose')
  }
  begin() { this.n = 0; }
  push(e16, a0, a1, a2, a3, b0, b1, b2, b3, t0, t1, t2, t3) {
    if (this.n >= this.cap) this._alloc(this.cap * 2);
    const i = this.n++;
    this.mesh.instanceMatrix.array.set(e16, i * 16);
    let A = this.aA.array; const o = i * 4;
    A[o] = a0; A[o + 1] = a1; A[o + 2] = a2; A[o + 3] = a3;
    A = this.aB.array; A[o] = b0; A[o + 1] = b1; A[o + 2] = b2; A[o + 3] = b3;
    A = this.aT.array; A[o] = t0; A[o + 1] = t1; A[o + 2] = t2; A[o + 3] = t3;
  }
  end() {
    const n = this.n;
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    if (!n) return;
    for (const [attr, s] of [[this.mesh.instanceMatrix, 16], [this.aA, 4], [this.aB, 4], [this.aT, 4]]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, n * s);
      attr.needsUpdate = true;
    }
  }
  dispose() {
    if (!this.mesh) return;
    this._release(this.mesh);
    this.mesh = null;
  }
}

// --------------------------------------------------------------------------------------------- archetypes
class Arch {
  constructor(sys, key, def, isAnimal) {
    this.sys = sys; this.key = key; this.def = def; this.isAnimal = isAnimal;
    this.entry = sys.atlas.ensure(def.rig);
    this.rig = this.entry.rig;
    this.H = this.rig.dims.H || 1;
    // projected-size metric for LOD: animals are longer than tall
    this.size = isAnimal ? Math.max(this.H, (this.rig.dims.L || 0) * 1.2, 0.25) : this.H;
    this.radius = isAnimal ? Math.max(0.4, (this.rig.dims.L || 0.3) * 0.9 + 0.2) : 1.9;
    this.geos = [null, null, null, null];
    this.batches = [null, null, null, null];
  }
  clip(name) {
    const c = this.entry.clips;
    return c[name] || c[CLIP_ALIASES[name]] || null;
  }
  batch(lod) {
    if (this.isAnimal && lod >= 2) lod = 1; // a few animals at most: their LOD1 is cheap enough
    if (this.batches[lod]) return this.batches[lod];
    const sys = this.sys;
    if (!this.geos[lod]) {
      this.geos[lod] = this.isAnimal ? buildAnimalGeometry(this.def, this.rig, lod) : buildHumanGeometry(this.def.recipe, this.rig, lod);
    }
    const mat = createPeopleMaterial({
      atlas: sys.atlas, palette: this.def.palette, lerp: lod < 2, detail: lod === 0 || (lod === 1 && sys.detail >= 1),
      physical: sys.detail >= 2 && lod < 2, dither: lod >= 1, morph: !this.isAnimal && lod <= 1,
      groups: this.isAnimal ? ['BEAST'] : this.key === 'kg_gold' ? ['FIG', 'KG'] : ['FIG'],
    });
    // heroes (LOD0) cast their shadows through the LOD1 proxy below: the same silhouette at an eighth of the
    // triangles, which matters because every shadow pass (two sun cascades, six faces per torch shadow) draws it
    const b = new Batch(sys, `${this.key}:${lod}`, this.geos[lod], mat, sys.depthFig, {
      castShadow: !!sys.quality.shadows && (lod === 1 || (lod === 0 && this.isAnimal)), cap: lod >= 2 ? 64 : 16,
    });
    this.batches[lod] = b;
    sys.batches.push(b);
    return b;
  }
  /** shadow-only stand-in for LOD0 instances (LOD1 geometry; draws nothing in the colour pass) */
  shadowProxy() {
    if (this.proxy) return this.proxy;
    const sys = this.sys;
    if (!sys.quality.shadows || this.isAnimal) return null;
    if (!this.geos[1]) this.geos[1] = buildHumanGeometry(this.def.recipe, this.rig, 1);
    const b = new Batch(sys, `${this.key}:shadow`, this.geos[1], sys.proxyMat, sys.depthFig, { castShadow: true, cap: 16 });
    b.mesh.receiveShadow = false;
    this.proxy = b;
    sys.batches.push(b);
    return b;
  }
  dispose() {
    for (const b of this.batches) { if (b) { b.dispose(); b.material.dispose(); } }
    this.proxy?.dispose();
    this.proxy = null;
    for (const g of this.geos) g?.dispose();
    this.batches = [null, null, null, null];
    this.geos = [null, null, null, null];
  }
}

class PropVariant {
  constructor(sys, name, grip, side) {
    this.sys = sys; this.name = name; this.grip = grip; this.side = side;
    this.geos = [null, null];
    this.batches = [null, null];
  }
  batch(lod) {
    lod = Math.min(1, lod);
    if (this.batches[lod]) return this.batches[lod];
    const sys = this.sys;
    if (!this.geos[lod]) this.geos[lod] = buildPropGeometry(this.name, this.grip, this.side, lod);
    const mat = sys.propMat(PROPS[this.name]?.flesh ? 'FLESH' : 'PROP', lod);
    const b = new Batch(sys, `prop:${this.name}:${this.grip}:${this.side}:${lod}`, this.geos[lod], mat, sys.depthProp, { castShadow: !!sys.quality.shadows && lod === 0, cap: 8 });
    this.batches[lod] = b;
    sys.batches.push(b);
    return b;
  }
  dispose() {
    for (const b of this.batches) b?.dispose();
    for (const g of this.geos) g?.dispose();
    this.batches = [null, null];
    this.geos = [null, null];
  }
}

// --------------------------------------------------------------------------------------------- figures
function makeTint(R, role, isAnimal) {
  const g = role?.grey || [0, 0.2];
  const skin = isAnimal ? R() : clamp(0.42 + (R() + R() + R() - 1.5) * 0.42, 0, 1);
  const grey = lerp(g[0], g[1], R() ** 1.4);
  return [skin, grey, Math.floor(R() * 4) + R() * 0.99, Math.floor(R() * 4) + R() * 0.99];
}
/** per-figure shape: [face-shape weight −1…1, fullness −0.6…1] (variety without extra draw calls) */
function makeMorph(R, isAnimal) {
  if (isAnimal) return [0, 0];
  const a = R() * 2 - 1, b = (R() + R()) - 0.9;
  return [a, Math.max(-0.6, Math.min(1, b))];
}
function makeMask(R, role) {
  let m = 0;
  if (R() < (role?.mantle ?? 1)) m |= 1;
  if (R() < (role?.headcloth ?? 0)) m |= 2;
  m |= 4 | MASK_HEADGEAR;   // the priestly headgear on (setHeadgear)
  return m;
}
/** site Z argument: number (exact) | { near: Z } (the floor nearest Z) | omitted (the walking floor) */
function zArg(Z) {
  if (typeof Z === 'number' && Number.isFinite(Z)) return { exact: Z, near: null };
  if (Z && typeof Z === 'object' && Number.isFinite(Z.near)) return { exact: null, near: Z.near };
  return { exact: null, near: null };
}

/** A single figure (person, animal or free-standing prop). See ARCHITECTURE.md §10. */
export class Actor {
  constructor(sys, arch, opts = {}) {
    this.sys = sys;
    this.arch = arch;
    this.baseArch = arch;
    this.role = opts.role;
    this.kind = arch ? (arch.isAnimal ? 'animal' : 'human') : 'prop';
    this.object3D = new Group();
    this.object3D.name = `actor:${opts.role || opts.kind || 'figure'}`;
    this.object3D.userData.actor = this;
    sys.root.add(this.object3D);
    const seed = opts.seed ?? hashStr(`${opts.role}:${sys.spawnCount++}`);
    const R = rng(seed);
    const roleDef = ROLES[opts.role] || null;
    this.roleDef = roleDef;
    this.tint = makeTint(R, roleDef, this.kind === 'animal');
    this.mask = makeMask(R, roleDef);
    const sc = roleDef?.scale || [0.97, 1.03];
    this.scale = lerp(sc[0], sc[1], R());
    this.clip = arch ? (arch.clip('stand') || Object.values(arch.entry.clips)[0]) : null;
    this.phase = R();
    this.morph = makeMorph(R, this.kind !== 'human');
    this.auto = true;
    this.prev = null;
    this.fade = 0;
    this.scratch = -1;
    this.scratchEpoch = -1;
    this.prop = null;
    this.prop2 = null;
    this.leader = null;
    this.leadSide = 'r';
    this.autoProp = null;
    this.visible = true;
    this.heading = 0;
    this.speed = 0;
    this.flames = [];
    this.disposed = false;
    this._floor = null;
    if (roleDef?.prop) this.setProp(roleDef.prop, 'right');
    if (roleDef?.pose) this.setPose(roleDef.pose);
  }

  get poseName() { return this.clip?.name || null; }

  /**
   * Site frame (amot). Z: a number = exact height; { near: Z } = the walking floor nearest that height
   * (multi-level spots: stairs, roofs, galleries); omitted = the walking floor (court/hall floors, not roofs).
   */
  setSite(X, Y, Z) {
    const z = zArg(Z);
    const w = m2w(X, Y, z.exact ?? z.near ?? 0, _v);
    if (z.exact == null) {
      this._floor = { x: w.x, z: w.z, hint: z.near != null ? w.y : null, ok: false };
      w.y = this.sys.resolveFloor(this._floor);
    } else this._floor = null;
    this.object3D.position.copy(w);
    this.object3D.updateMatrixWorld();
    return this;
  }
  setPosition(v) { this._floor = null; this.object3D.position.copy(v); this.object3D.updateMatrixWorld(); return this; }
  setHeading(deg) {
    this.heading = deg;
    this.object3D.rotation.set(0, headingToYaw(deg), 0);
    this.object3D.updateMatrixWorld();
    return this;
  }
  /** name: a pose (ARCHITECTURE §10); phase: 0..1 (omit → auto-advance at the clip's natural rate) */
  setPose(name, phase) {
    if (!this.arch) return this;
    let n = CLIP_ALIASES[name] || name;
    if ((n === 'raise_hands') && this.roleDef?.lowBlessing) n = 'raise_hands_low';
    // kohanim never sleep in the holy garments: they fold them under their heads and cover themselves with
    // their own clothes (Tamid 1:1) — the figure switches to its own clothes, the folded garments appear; a kohanic
    // role in 'bathe' shows its bathing figure
    const v = poseVariant(this.roleDef, n);
    this.arch = v ? this.sys.arch(v.arch) : this.baseArch;
    this.autoProp = v?.prop?.name || null;
    if (BATH_POSES.has(n) && !this.arch.isAnimal) warnBathe(this.role, this.roleDef);
    this._req = name;
    // a prop may be held its own way in a pose (a log or bundle on the shoulder: carry_log)
    let clip = (!v && propClip(this.arch, this.prop, n)) || this.arch.clip(n);
    if (!clip) {
      if (!this.sys._warnedPose.has(`${this.arch.key}:${n}`)) {
        this.sys._warnedPose.add(`${this.arch.key}:${n}`);
        if (!this.arch.isAnimal || !['walk', 'stand'].includes(n)) console.warn(`[people] pose "${name}" not available for ${this.arch.key}; using stand`);
      }
      clip = this.arch.clip('stand');
    }
    if (clip !== this.clip) {
      if (this.clip && !this.sys.snapping) {
        this.prev = { clip: this.clip, phase: this.phase };
        this.fade = 1;
      }
      this.clip = clip;
      if (phase == null && !clip.loop) this.phase = 0;
    }
    if (phase == null) this.auto = true;
    else { this.auto = false; this.phase = phase; }
    return this;
  }
  /** prop: a name from ctx.people.props or null; hand: 'right' | 'left' */
  setProp(name, hand = 'right') {
    if (name && !PROPS[name]) { console.warn(`[people] unknown prop "${name}"`); name = null; }
    const was = this.prop?.name;
    this.prop = name ? { name, side: /^l/i.test(hand || '') ? 'l' : 'r' } : null;
    // the pose's clip may depend on the prop (PROPS[name].poses): re-resolve it
    if (this._req && this.arch && (name !== was) && (PROPS[name]?.poses || PROPS[was]?.poses)) this.setPose(this._req, this.auto ? undefined : this.phase);
    this.sys._syncFlames(this);
    return this;
  }
  /**
   * Two props, one per hand (additive API): e.g. the tamid limb-bearers of Tamid 4:3 — setProps('limb_head', 'limb')
   * with pose 'carry_limbs'. right/left: prop names or null. Outside two-handed poses the left prop is held in the
   * left fist.
   */
  setProps(right, left) {
    this.setProp(right || null, 'right');
    if (left && !PROPS[left]) { console.warn(`[people] unknown prop "${left}"`); left = null; }
    this.prop2 = left ? { name: left, side: 'l' } : null;
    return this;
  }
  /**
   * Animals: lead on a rope held in the leader's hand (Tamid 3:5 "draws it"); null lets go. The halter shows in
   * the led poses (walk_led, stand_led, stand_halter, drink); the rope runs from its chin ring to the leader's fist.
   */
  setLead(leader, hand = 'right') {
    this.leader = leader && leader !== this ? leader : null;
    this.leadSide = /^l/i.test(hand || '') ? 'l' : 'r';
    return this;
  }
  /** the prop actually drawn: the one set, else the automatic one (the folded garments of a sleeping kohen) */
  get shownProp() { return this.prop || (this.autoProp ? { name: this.autoProp, side: 'r' } : null); }
  /**
   * The priestly headgear (migba'at / mitznefet and tzitz) on or off — the officer lifts the mitre off one man's head
   * to start the count (Yoma 25a). Off, the hair shows (with strand shells close up). Other figures ignore it.
   */
  setHeadgear(on = true) {
    this.mask = on ? (this.mask | MASK_HEADGEAR) & ~MASK_BARE : (this.mask & ~MASK_HEADGEAR) | MASK_BARE;
    return this;
  }
  get headgear() { return !!(this.mask & MASK_HEADGEAR); }
  setVisible(b) { this.visible = !!b; this.object3D.visible = this.visible; this.sys._syncFlames(this); return this; }
  /** auto-advanced walking speed (m/s) for locomotion poses without an explicit phase */
  setSpeed(mps) { this.speed = mps; return this; }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.scratch >= 0) { this.sys.atlas.freeScratch(this.scratch); this.scratch = -1; }
    this.prop = null;
    this.prop2 = null;
    this.leader = null;
    this.autoProp = null;
    this.sys._syncFlames(this);
    this.object3D.removeFromParent();
    this.sys.actors.delete(this);
  }

  _tick(dt) {
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt / 0.4);
    if (this.fade === 0) {
      this.prev = null;
      if (this.scratch >= 0) { this.sys.atlas.freeScratch(this.scratch); this.scratch = -1; }
    }
    if (!this.clip) return;
    if (this.auto) {
      const c = this.clip;
      let rate = c.rate;
      if (c.stride) rate = (this.speed || (c.name === 'run' ? RUN_SPEED : WALK_SPEED)) / (c.stride * this.scale);
      this.phase += dt * rate;
      if (c.loop) this.phase -= Math.floor(this.phase);
      else if (this.phase > 1) this.phase = c.name === 'prostrate' || c.name === 'bow' || c.name === 'kneel' ? this.phase % 1 : 1;
    }
  }
}

/** A free-standing prop (vessel on a table, log on the ground…) — same interface as an Actor. */
export class PropActor extends Actor {
  constructor(sys, name, opts = {}) {
    super(sys, null, { kind: 'prop', role: null, seed: opts.seed });
    this.object3D.name = `prop:${name}`;
    this.prop = { name, side: 'r', free: true };
    this.scale = 1;
    sys._syncFlames(this); // a free torch burns too
  }
  setPose() { return this; }
  setProp() { return this; }
}

// --------------------------------------------------------------------------------------------- crowds
export class Crowd {
  constructor(sys, opts = {}) {
    this.sys = sys;
    this.seed = opts.seed ?? hashStr(`crowd${sys.crowds.size}`);
    const R = rng(this.seed);
    // roles: string | array | { role: weight } — person roles or animal kinds (a flock)
    let roles = opts.roles || opts.role || ['israelite'];
    if (typeof roles === 'string') roles = [roles];
    let weights = Array.isArray(roles) ? roles.map((r) => [r, 1]) : Object.entries(roles);
    weights = weights.filter(([r]) => {
      if (ROLES[r] || ANIMALS[r]) return true;
      console.warn(`[people] crowd: unknown role "${r}" — skipped`);
      return false;
    });
    if (!weights.length) weights = [['israelite', 1]];
    const total = weights.reduce((s, w) => s + w[1], 0);
    const pickRole = () => { let x = R() * total; for (const [r, w] of weights) { x -= w; if (x <= 0) return r; } return weights[0][0]; };
    // positions
    let pts = [];
    this.region = null;
    if (opts.points?.length) {
      pts = opts.points.map((p) => {
        if (Array.isArray(p)) return { X: p[0], Y: p[1], ...zArg(p[2]), h: null };
        const z = zArg(p.pos?.[2] ?? p.Z ?? (Number.isFinite(p.near) ? { near: p.near } : undefined));
        return { X: p.pos?.[0] ?? p.X, Y: p.pos?.[1] ?? p.Y, ...z, h: Number.isFinite(p.heading) ? p.heading : null };
      });
    } else {
      const reg = opts.region || { min: [240, 100], max: [270, 120] };
      const count = opts.count ?? 50;
      const [x0, y0] = reg.min, [x1, y1] = reg.max;
      const W = Math.abs(x1 - x0), Hh = Math.abs(y1 - y0);
      this.region = { x0: Math.min(x0, x1) * AMAH, x1: Math.max(x0, x1) * AMAH, z0: -Math.max(y0, y1) * AMAH, z1: -Math.min(y0, y1) * AMAH };
      // A full-length prostration needs ≈ 2.3 m along the heading and 1.1 m across: crowds that will prostrate
      // get cells of that aspect, staggered row to row. (Avot 5:5's "standing crowded, prostrating with room"
      // is a miracle — how much room to show is the sim's stylistic choice: region size and count.)
      const prost = opts.layout === 'prostrate' || (opts.layout == null && opts.pose === 'prostrate');
      let alongX = false;
      if (prost) {
        let hd = 0;
        if (typeof opts.heading === 'number') hd = opts.heading;
        else if (opts.heading?.at) hd = Math.atan2(opts.heading.at[0] - (x0 + x1) / 2, opts.heading.at[1] - (y0 + y1) / 2) * 180 / Math.PI;
        alongX = Math.abs(Math.sin(hd * Math.PI / 180)) > Math.abs(Math.cos(hd * Math.PI / 180));
      }
      const asp = prost ? 2.1 : 1; // cell length along the heading / across
      const cellA = Math.sqrt((W * Hh) / Math.max(1, count));
      const cw = prost && alongX ? cellA * Math.sqrt(asp) : prost ? cellA / Math.sqrt(asp) : cellA;
      const nx = Math.max(1, Math.round(W / cw)), ny = Math.max(1, Math.ceil(count / nx));
      const cells = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) cells.push([i, j]);
      for (let i = cells.length - 1; i > 0; i--) { const k = Math.floor(R() * (i + 1)); [cells[i], cells[k]] = [cells[k], cells[i]]; }
      const jit = prost ? 0.18 : 0.7;
      for (let c = 0; c < Math.min(count, cells.length); c++) {
        const [i, j] = cells[c];
        let fi = i + 0.5 + (R() - 0.5) * jit, fj = j + 0.5 + (R() - 0.5) * jit;
        if (prost) { if (alongX) fj += (i & 1) * 0.5 - 0.25; else fi += (j & 1) * 0.5 - 0.25; } // brick stagger
        const z = zArg(reg.z ?? (Number.isFinite(reg.near) ? { near: reg.near } : undefined));
        pts.push({ X: x0 + (x1 - x0) * fi / nx, Y: y0 + (y1 - y0) * fj / ny, ...z, h: null });
      }
    }
    const n = pts.length;
    this.capacity = n;
    this.count = n;
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n);
    this.bx = new Float32Array(n); this.bz = new Float32Array(n);
    this.yaw = new Float32Array(n); this.sc = new Float32Array(n); this.off = new Float32Array(n);
    this.tint = new Float32Array(n * 4); this.mask = new Float32Array(n); this.morph = new Float32Array(n * 2);
    this.fadeM = new Float32Array(n).fill(1);
    this.pointH = new Float32Array(n).fill(NaN);
    this.autoY = new Uint8Array(n); this.hintY = new Float32Array(n).fill(NaN);
    this.arch = new Array(n); this.roleDef = new Array(n); this.role = new Array(n);
    for (let i = 0; i < n; i++) {
      const role = pickRole();
      const animal = !ROLES[role];
      const def = animal ? { arch: role, scale: [0.92, 1.08] } : ROLES[role];
      this.role[i] = role;
      this.roleDef[i] = def;
      this.arch[i] = sys.arch(def.arch);
      const p = pts[i];
      const w = m2w(p.X, p.Y, p.exact ?? p.near ?? 0, _v);
      if (p.exact == null) {
        this.autoY[i] = 1;
        if (p.near != null) this.hintY[i] = w.y;
        const y = sys.floorAt(w.x, w.z, p.near != null ? w.y : null);
        if (y != null) w.y = y;
      }
      this.x[i] = this.bx[i] = w.x; this.y[i] = w.y; this.z[i] = this.bz[i] = w.z;
      const sc = def.scale || [0.96, 1.04];
      this.sc[i] = lerp(sc[0], sc[1], R());
      const t = makeTint(R, def, animal);
      this.tint.set(t, i * 4);
      this.mask[i] = animal ? 0 : makeMask(R, def);
      this.off[i] = R();
      this.morph.set(makeMorph(R, animal), i * 2);
      this.pointH[i] = p.h ?? NaN;
    }
    this.visible = true;
    this.prop = opts.prop && PROPS[opts.prop] ? { name: opts.prop, side: 'r' } : null;
    this.flames = [];
    this.flow = 0;
    this._rr = 0;
    this.phase = 0; this.auto = true; this.poseName = 'stand';
    this.prevPose = null; this.prevPhase = 0; this.fade = 0;
    this._applyHeadings(opts.heading, R, true);
    this.setPose(opts.pose || 'stand', opts.phase);
    sys._syncFlames(this);
  }
  /**
   * heading: degrees | 'random' | { at: [X, Y] } (face a point) | function(i, X, Y) → degrees.
   * Omitted: each point's own heading (points: [{ pos, heading }]), else north.
   */
  setHeadings(h, R = rng(this.seed + 7)) { return this._applyHeadings(h, R, false); }
  _applyHeadings(h, R, pointsWin) {
    for (let i = 0; i < this.capacity; i++) {
      let deg;
      const ph = this.pointH[i];
      if ((h == null || pointsWin) && Number.isFinite(ph)) deg = ph;
      else if (typeof h === 'function') deg = h(i, this.bx[i] / AMAH, -this.bz[i] / AMAH);
      else if (h === 'random') deg = R() * 360;
      else if (h && h.at) {
        const t = m2w(h.at[0], h.at[1], 0, _v2);
        deg = Math.atan2(t.x - this.bx[i], -(t.z - this.bz[i])) * 180 / Math.PI;
      } else deg = (h || 0) + (R() - 0.5) * 16;
      this.yaw[i] = headingToYaw(deg);
    }
    return this;
  }
  setPose(name, phase) {
    name = CLIP_ALIASES[name] || name;
    const c = this.arch[0]?.clip(name);
    if (name !== this.poseName) {
      // crowds switch instantly: one-shots (prostrate, bow, kneel) start from the standing pose anyway
      this.poseName = name;
      if (phase == null) this.phase = 0;
      this.off_ = OFFDUTY_POSES.has(name) || BATH_POSES.has(name);
      if (BATH_POSES.has(name)) for (let i = 0; i < this.capacity; i++) if (!this.arch[i].isAnimal) warnBathe(this.role[i], this.roleDef[i]);
      if (c?.stride && !this.region && !this.sys._warnedFlow) {
        this.sys._warnedFlow = true;
        console.warn('[people] crowd: a points-crowd in a walking pose walks in place — use Actors (or a region crowd, which flows) for people who move');
      }
    } else if (phase != null && c?.stride) {
      // explicit phases drive the flow too: advance by the (wrapped) phase step
      let dp = phase - this.phase; dp -= Math.round(dp);
      this.flow += dp * c.stride;
    }
    if (phase == null) this.auto = true; else { this.auto = false; this.phase = phase; }
    return this;
  }
  setProp(name, hand = 'right') {
    this.prop = name && PROPS[name] ? { name, side: /^l/i.test(hand) ? 'l' : 'r' } : null;
    this.sys._syncFlames(this);
    return this;
  }
  setVisible(b) { this.visible = !!b; this.sys._syncFlames(this); return this; }
  setCount(n) { this.count = Math.max(0, Math.min(this.capacity, n | 0)); this.sys._syncFlames(this); return this; }
  dispose() { this.count = 0; this.prop = null; this.sys._syncFlames(this); this.sys.crowds.delete(this); }
  memberVariant(i) { return this.off_ ? poseVariant(this.roleDef[i], this.poseName) : null; }
  memberArch(i) { const v = this.memberVariant(i); return v ? this.sys.arch(v.arch) : this.arch[i]; }
  memberProp(i) { const v = this.memberVariant(i); return v?.prop || (v ? null : this.prop); }
  _tick(dt) {
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt / 0.35);
    if (!this.capacity) return;
    const c = this.arch[0].clip(this.poseName) || { rate: 0.2, loop: true };
    if (this.auto) {
      const rate = c.stride ? (this.poseName === 'run' ? RUN_SPEED : WALK_SPEED) / c.stride : c.rate;
      this.phase += dt * rate;
      if (c.stride) this.flow += dt * rate * c.stride;
      if (c.loop || ['prostrate', 'bow', 'kneel'].includes(this.poseName)) this.phase -= Math.floor(this.phase);
      else this.phase = Math.min(1, this.phase);
    }
    // region crowds in a walking pose flow along their headings and wrap inside the region
    const flowing = !!(c.stride && this.region);
    if (flowing || this._flowed) {
      this._flowed = flowing;
      const g = this.region, W = g.x1 - g.x0, D = g.z1 - g.z0;
      const d = flowing ? this.flow : 0;
      for (let i = 0; i < this.count; i++) {
        const fx = -Math.sin(this.yaw[i]), fz = -Math.cos(this.yaw[i]);
        let x = this.bx[i] + fx * d, z = this.bz[i] + fz * d;
        if (flowing) {
          x = g.x0 + (((x - g.x0) % W) + W) % W;
          z = g.z0 + (((z - g.z0) % D) + D) % D;
          const ex = Math.abs(fx) > 0.15 ? clamp(Math.min(x - g.x0, g.x1 - x) / FLOW_FADE_M) : 1;
          const ez = Math.abs(fz) > 0.15 ? clamp(Math.min(z - g.z0, g.z1 - z) / FLOW_FADE_M) : 1;
          this.fadeM[i] = smooth(0, 1, ex * ez);
        } else this.fadeM[i] = 1;
        this.x[i] = x; this.z[i] = z;
      }
      // keep moving members on the floor: a few re-resolved per frame (round robin)
      for (let k = 0; k < Math.min(6, this.count); k++) {
        const i = this._rr++ % this.count;
        if (!this.autoY[i]) continue;
        const y = this.sys.floorAt(this.x[i], this.z[i], Number.isFinite(this.hintY[i]) ? this.hintY[i] : this.y[i]);
        if (y != null) this.y[i] = y;
      }
    }
  }
  memberPhase(i, clip, ph = this.phase) {
    if (clip.loop) return ph + this.off[i];
    // one-shots move nearly together ("ten thousand people going down in one motion") with small human lag
    return clamp(ph + (this.off[i] - 0.5) * 0.05, 0, 1);
  }
}

// --------------------------------------------------------------------------------------------- system
export class PeopleSystem {
  constructor(ctx) {
    this.ctx = ctx;
    this.quality = ctx.quality;
    this.detail = ctx.quality?.detail ?? 1;
    this.atlas = new AnimAtlas();
    this.root = new Group();
    this.root.name = 'people';
    ctx.scene.add(this.root);
    this.archs = new Map();
    this.props = new Map();
    this.batches = [];
    this.actors = new Set();
    this.crowds = new Set();
    this.spawnCount = 0;
    this.snapping = false;
    this._warnedPose = new Set();
    this.frustum = new Frustum();
    this.stats = { figures: 0, drawn: 0, lod: [0, 0, 0, 0], props: 0, batches: 0, culled: 0, overBudget: 0, far: 0, dropped: 0 };
    this._cand = { d: new Float32Array(256), owner: new Array(256), idx: new Int32Array(256), n: 0 };
    this._e = new Float32Array(16);
    this._lp = [null, null, null];
    this._frame = 0;
    this._physVer = this._physVersion();
    this._makeShared();
  }

  _makeShared() {
    this.depthFig = createPeopleDepthMaterials(this.atlas, false);
    this.depthProp = createPeopleDepthMaterials(this.atlas, true);
    this.propMats = new Map();
    // the colour pass of a shadow proxy: every vertex outside the clip volume (nothing drawn, almost free)
    this.proxyMat = new ShaderMaterial({ vertexShader: 'void main() { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); }', fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }' });
    this.proxyMat.name = 'people-shadow-proxy';
  }
  /** prop material by pattern group ('PROP' vessels/instruments/wood/cloth, 'FLESH' carcass and limbs) and LOD */
  propMat(group, lod) {
    const key = `${group}:${lod ? 1 : 0}`;
    if (!this.propMats.has(key)) {
      this.propMats.set(key, createPeopleMaterial({ atlas: this.atlas, prop: true, lerp: true, groups: [group],
        detail: lod ? this.detail >= 1 : true, physical: !lod && this.detail >= 2 }));
    }
    return this.propMats.get(key);
  }

  // ---------------------------------------------------------------- floors
  /**
   * The walking floor (world y) at world (x, z): the floor an observer would stand on there — court and
   * hall floors on the site's datums, never the roof, beam or column top above (physics.standFloor). With
   * hintY, the standable floor nearest that height (stairs, galleries, upper rooms). null = physics not
   * ready (the caller keeps a provisional height and is re-resolved when the colliders are built).
   */
  floorAt(x, z, hintY = null) {
    const ctx = this.ctx, ph = ctx.physics;
    if (!ph) return null;
    try {
      let y = null;
      if (typeof ph.standFloor === 'function') y = ph.standFloor(x, z, hintY);
      else if (typeof ctx.player?.pickFloor === 'function') y = ctx.player.pickFloor(x, z, hintY);
      else if (typeof ph.floorsAt === 'function') {
        const fl = ph.floorsAt(x, z);
        if (fl?.length) y = hintY == null ? fl[0] : fl.reduce((b, f) => (Math.abs(f - hintY) < Math.abs(b - hintY) ? f : b));
      }
      // never pass fromY here: floorAt(x, z, fromY) returns the TOP surface (roofs, architraves)
      if (y == null && typeof ph.floorAt === 'function' && !ph.standFloor) y = ph.floorAt(x, z);
      if (Number.isFinite(y)) return y;
      if (y && Number.isFinite(y.y)) return y.y;
    } catch { /* physics not ready */ }
    return null;
  }
  resolveFloor(req) {
    const y = this.floorAt(req.x, req.z, req.hint);
    req.ok = y != null;
    return y ?? req.hint ?? 0;
  }
  _physVersion() {
    const ph = this.ctx.physics;
    if (!ph) return -1;
    return (ph.version ?? 0) * 2 + (ph.bvh ? 1 : 0);
  }
  /** colliders (re)built: put every auto-floored figure back on its floor */
  _refloor() {
    for (const a of this.actors) {
      const f = a._floor;
      if (!f || a.object3D.parent !== this.root) continue;
      const p = a.object3D.position;
      if (Math.abs(p.x - f.x) > 1e-4 || Math.abs(p.z - f.z) > 1e-4) { a._floor = null; continue; } // moved by hand
      p.y = this.resolveFloor(f);
      a.object3D.updateMatrixWorld();
    }
    for (const c of this.crowds) {
      for (let i = 0; i < c.capacity; i++) {
        if (!c.autoY[i]) continue;
        const y = this.floorAt(c.x[i], c.z[i], Number.isFinite(c.hintY[i]) ? c.hintY[i] : null);
        if (y != null) c.y[i] = y;
      }
    }
  }

  arch(key) {
    if (this.archs.has(key)) return this.archs.get(key);
    const isAnimal = !!ANIMALS[key];
    const def = isAnimal ? ANIMALS[key] : ARCHETYPES[key];
    if (!def) throw new Error(`[people] unknown archetype ${key}`);
    const a = new Arch(this, key, def, isAnimal);
    this.archs.set(key, a);
    return a;
  }

  propVariant(name, grip, side) {
    const key = `${name}:${grip}:${side}`;
    if (!this.props.has(key)) this.props.set(key, new PropVariant(this, name, grip, side));
    return this.props.get(key);
  }

  spawn({ role = 'israelite', seed, ...rest } = {}) {
    const def = ROLES[role];
    if (!def) { console.warn(`[people] unknown role "${role}" — using israelite`); }
    const a = new Actor(this, this.arch((def || ROLES.israelite).arch), { role: def ? role : 'israelite', seed });
    this.actors.add(a);
    if (rest.site) a.setSite(...rest.site);
    if (rest.heading != null) a.setHeading(rest.heading);
    if (rest.pose) a.setPose(rest.pose, rest.phase);
    if (rest.prop) a.setProp(rest.prop, rest.hand);
    return a;
  }
  spawnAnimal(kind = 'lamb', opts = {}) {
    if (!ANIMALS[kind]) { console.warn(`[people] unknown animal "${kind}" — using lamb`); kind = 'lamb'; }
    const a = new Actor(this, this.arch(kind), { role: null, kind: 'animal', seed: opts.seed });
    a.animal = kind;
    this.actors.add(a);
    return a;
  }
  spawnProp(name, opts = {}) {
    if (!PROPS[name]) { console.warn(`[people] unknown prop "${name}"`); return null; }
    const a = new PropActor(this, name, opts);
    this.actors.add(a);
    return a;
  }
  crowd(opts) {
    const c = new Crowd(this, opts);
    this.crowds.add(c);
    return c;
  }

  // ---------------------------------------------------------------- torch flames
  // render/fx follows an anchor we place at the torch head every frame — for every bearer, drawn or not
  _syncFlames(owner) {
    const fx = this.ctx.fx;
    const want = [];
    const pname = owner.prop?.name || null;
    // a prop swapped for another with a different flame (torch ↔ taper): relight from scratch
    if (owner.flames.length && owner.flames[0].prop !== pname) {
      for (const f of owner.flames.splice(0)) { try { fx?.remove?.(f.handle); } catch { /* ignore */ } f.anchor.removeFromParent(); }
    }
    if (owner instanceof Crowd) {
      if (owner.visible && owner.prop && PROPS[owner.prop.name]?.tip) for (let i = 0; i < Math.min(owner.count, 24); i++) want.push(i);
    } else if (owner.visible && !owner.disposed && owner.prop && PROPS[owner.prop.name]?.tip) want.push(0);
    while (owner.flames.length > want.length) {
      const f = owner.flames.pop();
      try { fx?.remove?.(f.handle); } catch { /* ignore */ }
      f.anchor.removeFromParent();
    }
    while (owner.flames.length < want.length) {
      const anchor = new Object3D();
      anchor.name = 'people:torch-anchor';
      this.root.add(anchor);
      const f = { anchor, handle: null, i: want[owner.flames.length], stamp: -1, hidden: -1, lit: 1, prop: pname };
      this._flameAt(owner, f); // at the hand from the start (fx samples the anchor when the fire is added)
      try { f.handle = fx?.attachTorch?.(anchor, { ...(PROPS[pname]?.flame || TORCH_FLAME) }) || null; } catch (e) { console.warn('[people] fx.attachTorch failed', e); }
      owner.flames.push(f);
    }
  }

  /** place a flame anchor from the owner's current pose (used for bearers that were not drawn this frame) */
  _flameAt(owner, f) {
    const prop = owner.prop;
    if (!prop) return;
    if (owner instanceof PropActor) {
      const tip = propTip(prop.name, 'free', 'r');
      if (!tip) return;
      owner.object3D.updateWorldMatrix(true, false);
      f.anchor.position.copy(tip).applyMatrix4(owner.object3D.matrixWorld);
      f.anchor.updateMatrixWorld();
      return;
    }
    let arch, clip, phase;
    const e16 = _e2;
    if (owner instanceof Crowd) {
      const i = f.i;
      arch = owner.memberArch(i);
      clip = arch.clip(owner.poseName) || arch.clip('stand');
      phase = owner.memberPhase(i, clip);
      this._crowdMatrix(owner, i, e16);
    } else {
      arch = owner.arch; clip = owner.clip; phase = owner.phase;
      if (!arch || !clip) return;
      owner.object3D.updateWorldMatrix(true, false);
      this._actorMatrix(owner, e16);
    }
    this.atlas.sample(clip, phase, _fb);
    this._placeFlames(owner, f.i, arch, clip, e16, _fb);
  }

  setSnap(b) { this.snapping = b; }

  /** rebuild GPU resources after a quality change */
  reconfigure(quality) {
    this.quality = quality;
    this.detail = quality?.detail ?? 1;
    for (const a of this.archs.values()) a.dispose();
    for (const p of this.props.values()) p.dispose();
    this.batches = [];
    for (const m of [...this.propMats.values(), this.proxyMat, this.depthFig.depth, this.depthFig.distance, this.depthProp.depth, this.depthProp.distance]) m.dispose();
    this._makeShared();
  }

  _cands(n) {
    const c = this._cand;
    if (c.d.length < n) {
      const m = Math.max(n, c.d.length * 2);
      c.d = new Float32Array(m); c.idx = new Int32Array(m); c.owner = new Array(m);
    }
    return c;
  }

  _crowdMatrix(c, i, e16) {
    const s = c.sc[i], yw = c.yaw[i];
    const co = Math.cos(yw) * s, si = Math.sin(yw) * s;
    e16[0] = co; e16[1] = 0; e16[2] = -si; e16[3] = 0;
    e16[4] = 0; e16[5] = s; e16[6] = 0; e16[7] = 0;
    e16[8] = si; e16[9] = 0; e16[10] = co; e16[11] = 0;
    e16[12] = c.x[i]; e16[13] = c.y[i]; e16[14] = c.z[i]; e16[15] = 1;
    return e16;
  }
  _actorMatrix(a, e16) {
    const me = a.object3D.matrixWorld.elements;
    for (let q = 0; q < 16; q++) e16[q] = me[q];
    if (a.scale !== 1) for (let q = 0; q < 12; q++) if ((q & 3) !== 3) e16[q] *= a.scale;
    return e16;
  }

  update(dtIn) {
    // a negative/huge first delta (Timer vs rAF timestamp base) must never rewind fades or phases
    const dt = Number.isFinite(dtIn) ? Math.min(Math.max(dtIn, 0), 0.25) : 0;
    const frame = ++this._frame;
    const ctx = this.ctx;
    const cam = ctx.camera;
    const pv = this._physVersion();
    if (pv !== this._physVer) { this._physVer = pv; this._refloor(); }
    cam.updateMatrixWorld();
    _m.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(_m);
    const cx = cam.matrixWorld.elements[12], cy = cam.matrixWorld.elements[13], cz = cam.matrixWorld.elements[14];
    const hPx = ctx.renderer?.domElement?.height || 720;
    const focal = hPx / (2 * Math.tan((cam.fov * Math.PI / 180) / 2));
    const det = clamp(this.detail | 0, 0, 3);
    const lod0px = LOD0_PX[det], lod1px = LOD1_PX[det], lod3px = LOD3_PX[det], maxHero = MAX_HERO[det];
    const budget = Math.max(0, this.quality?.maxFigures ?? 180);
    const farCap = budget * FAR_MULT;

    for (const a of this.actors) a._tick(dt);
    for (const c of this.crowds) c._tick(dt);

    // ---- candidates (visible & in frustum)
    let total = 0;
    for (const c of this.crowds) total += c.visible ? c.count : 0;
    const C = this._cands(total + this.actors.size + 1);
    let n = 0;
    let figures = 0;
    for (const a of this.actors) {
      if (!a.visible || a.disposed) continue;
      figures++;
      a.object3D.updateWorldMatrix(true, false);
      const e = a.object3D.matrixWorld.elements;
      if (!a.object3D.parent || !isShown(a.object3D)) continue;
      const r = a.arch ? a.arch.radius : 0.6;
      _sph.center.set(e[12], e[13] + (a.arch ? a.arch.H * 0.45 : 0.2), e[14]);
      _sph.radius = r * a.scale;
      if (!this.frustum.intersectsSphere(_sph)) continue;
      const dx = e[12] - cx, dy = e[13] - cy, dz = e[14] - cz;
      C.d[n] = Math.sqrt(dx * dx + dy * dy + dz * dz) - 1e5; // actors first
      C.owner[n] = a; C.idx[n] = -1; n++;
    }
    for (const c of this.crowds) {
      if (!c.visible) continue;
      figures += c.count;
      for (let i = 0; i < c.count; i++) {
        if (c.fadeM[i] <= 0.004) continue;
        const ar = c.arch[i];
        _sph.center.set(c.x[i], c.y[i] + ar.H * 0.45, c.z[i]);
        _sph.radius = ar.radius * c.sc[i];
        if (!this.frustum.intersectsSphere(_sph)) continue;
        const dx = c.x[i] - cx, dy = c.y[i] - cy, dz = c.z[i] - cz;
        C.d[n] = Math.sqrt(dx * dx + dy * dy + dz * dz);
        C.owner[n] = c; C.idx[n] = i; n++;
      }
    }
    // ---- budget: nearest first (actors first); LOD0–2 up to maxFigures, then LOD3 up to the far cap
    let order = null;
    const limit = Math.min(n, budget + farCap);
    if (n > 1) {
      order = this._order && this._order.length >= n ? this._order : (this._order = new Int32Array(Math.max(n, 64)));
      for (let i = 0; i < n; i++) order[i] = i;
      const sub = order.subarray(0, n);
      const d = C.d;
      sub.sort((i, j) => d[i] - d[j]);
    }
    for (const b of this.batches) b.begin();
    const st = this.stats;
    st.lod[0] = st.lod[1] = st.lod[2] = st.lod[3] = 0;
    st.props = 0;
    // every distinct prop (name × grip × hand × LOD) is its own instanced batch, i.e. a draw call: at most
    // PROP_BATCH_CAP of them per frame by tier, given out nearest first — a rare prop far away is not drawn
    let propBatches = 0;
    const propCap = PROP_BATCH_CAP[Math.max(0, Math.min(3, this.detail | 0))];
    const propBatch = (v, lod) => {
      const b = v.batch(lod);
      if (b.n === 0) { if (propBatches >= propCap && v.name !== 'torch') return null; propBatches++; }   // a burning torch always shows
      return b;
    };
    let heroes = 0;
    const e16 = this._e;
    const fadeFrom = budget + farCap * (1 - FAR_FADE);
    for (let k = 0; k < limit; k++) {
      const ci = order ? order[k] : k;
      const owner = C.owner[ci];
      const dist = C.d[ci] < 0 ? C.d[ci] + 1e5 : C.d[ci];
      let arch, clip, phase, prevClip = null, prevPhase = 0, fade = 0, tint, mask, prop, alpha = 1, mA = 0, mB = 0;
      if (owner instanceof Crowd) {
        const i = C.idx[ci];
        arch = owner.memberArch(i);
        clip = (!owner.off_ && propClip(arch, owner.prop, owner.poseName)) || arch.clip(owner.poseName) || arch.clip('stand');
        phase = owner.memberPhase(i, clip);
        this._crowdMatrix(owner, i, e16);
        tint = owner.tint.subarray(i * 4, i * 4 + 4);
        mask = owner.mask[i] | (clip.halter ? 24 : 0) | (clip.cord ? 32 : 0);
        if (owner.memberVariant(i)?.prop) mask &= ~1;   // asleep under his own mantle: not also wearing it
        mA = owner.morph[i * 2]; mB = owner.morph[i * 2 + 1];
        prop = owner.memberProp(i);
        alpha = owner.fadeM[i];
      } else {
        const a = owner;
        this._actorMatrix(a, e16);
        prop = a.shownProp;
        if (!a.arch) { // free prop
          const v = this.propVariant(prop.name, 'free', 'r');
          const b = propBatch(v, dist < 25 ? 0 : 1);
          if (b) { b.push(e16, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, -1); st.props++; }
          if (a.flames.length) this._placeFreeFlame(a, frame);
          continue;
        }
        arch = a.arch; clip = a.clip; phase = a.phase;
        if (a.prev && a.fade > 0) { prevClip = a.prev.clip; prevPhase = a.prev.phase; fade = a.fade; }
        tint = a.tint; mask = a.mask;
        if (a.autoProp) mask &= ~1;  // asleep under his own mantle (Tamid 1:1): not also wearing it
        if (arch.isAnimal) mask = (mask & ~56) | (clip.halter ? 8 | (a.leader ? 0 : 16) : 0) | (clip.cord ? 32 : 0);
        mA = a.morph[0]; mB = a.morph[1];
        if (prevClip && this._crossfade(a, arch, clip, phase, prevClip, prevPhase, fade)) { prevClip = null; fade = -1; }
      }
      // LOD by projected height (LOD3 beyond the budget or when tiny)
      const px = (arch.size * focal) / Math.max(0.1, dist);
      let lod;
      if (k >= budget || px < lod3px) lod = 3;
      else lod = px > lod0px && heroes < maxHero && alpha > 0.999 ? 0 : px > lod1px ? 1 : 2;
      if (lod === 0) heroes++;
      if (k >= fadeFrom) alpha *= 1 - smooth(fadeFrom, limit, k + 0.5);
      st.lod[lod]++;
      if (!(owner instanceof Crowd)) owner.lod = lod;
      if (fade === -1) { _fa[0] = _fa[1] = owner.scratch; _fa[2] = 0; } // blended pose in a scratch frame
      else this.atlas.sample(clip, phase, _fa);
      fade = 0;
      const b = arch.batch(lod);
      b.push(e16, _fa[0], _fa[1], _fa[2], alpha, 0, mA, mB, mask, tint[0], tint[1], tint[2], tint[3]);
      if (lod === 0) arch.shadowProxy()?.push(e16, _fa[0], _fa[1], _fa[2], alpha, 0, 0, 0, mask, tint[0], tint[1], tint[2], tint[3]);
      // props (none on LOD3 silhouettes except the big ones); a second prop (setProps) in the left hand
      const prop2 = owner instanceof Crowd ? null : owner.prop2;
      // ritual vessels in an actor's hands stay drawn at LOD 2 (crowds keep only the big props there)
      const actorV = !(owner instanceof Crowd);
      const showP = (pr) => pr && (lod < 2 || (PROPS[pr.name]?.big && lod < 3) || (PROPS[pr.name]?.big && alpha > 0.5) || (lod === 2 && actorV && HELD_VESSELS.has(pr.name)));
      if (showP(prop) || showP(prop2)) {
        const grip = clip.grip || 'fist';
        const list = [];
        if (grip === 'pair') {
          const pg = clip.pairGrip || 'fist';
          if (showP(prop)) list.push([prop.name, 'r', pg]);
          const left = prop2 || prop;
          if (showP(left)) list.push([left.name, 'l', pg]);
        } else {
          if (showP(prop)) list.push([prop.name, clip.hand || prop.side, grip]);
          if (showP(prop2) && (grip === 'fist' || grip.startsWith('pillow')) && (clip.hand || prop?.side || 'r') !== 'l') list.push([prop2.name, 'l', 'fist']);
        }
        for (const [name, side, gcls] of list) {
          const att = propAttach(name, gcls, side, arch.rig);
          if (!att) continue;
          const v = this.propVariant(name, att.cls || gcls, side);
          const pb = propBatch(v, lod);
          if (!pb) continue;
          pb.push(e16, _fa[0], _fa[1], _fa[2], 1, _fa[0], _fa[1], _fa[2], 0, att.x, att.y, att.z, att.bone);
          st.props++;
        }
      }
      // torch anchors
      if (owner.flames?.length) {
        const f = owner instanceof Crowd ? owner.flames.find((q) => q.i === C.idx[ci]) : owner.flames[0];
        if (f) { this._placeFlames(owner, f.i, arch, clip, e16, _fa); f.stamp = frame; }
      }
    }
    // bearers in view but beyond the far cap are not drawn: their flames go out
    for (let k = limit; k < n; k++) {
      const ci = order ? order[k] : k;
      const owner = C.owner[ci];
      if (!owner.flames?.length) continue;
      const f = owner instanceof Crowd ? owner.flames.find((q) => q.i === C.idx[ci]) : owner.flames[0];
      if (f) f.hidden = frame;
    }
    // flames of bearers not drawn this frame (behind the camera, culled): follow the pose anyway
    this._updateFlames(frame);
    this._updateRopes();
    for (const b of this.batches) b.end();
    st.figures = figures;
    st.drawn = limit;
    st.culled = figures - n;
    st.overBudget = Math.max(0, n - budget);
    st.far = st.lod[3];
    st.dropped = Math.max(0, n - limit);
    st.batches = this.batches.reduce((s, b) => s + (b.n > 0 ? 1 : 0), 0);
  }

  /** lead ropes: from each led animal's halter (chin ring) to its leader's fist, sagging a little */
  _updateRopes() {
    const list = [];
    for (const a of this.actors) {
      if (!a.leader || a.disposed || !a.visible || !a.arch?.isAnimal || !a.clip?.halter) continue;
      const h = a.leader;
      if (h.disposed || !h.visible || !h.arch || h.arch.isAnimal) continue;
      list.push(a);
    }
    if (!list.length && !this.ropes) return;
    if (!this.ropes) this.ropes = new RopeSet(this.root);
    const R = this.ropes;
    R.begin();
    for (const a of list) {
      const h = a.leader;
      const A = this._bonePoint(a, a.arch, a.arch.rig.index.head, halterPoint(a.arch.rig), _v);
      const side = a.leadSide || 'r';
      const hb = h.arch.rig.index[`hand_${side}`];
      const g = gripOffset(h.arch.rig, side);
      const hr = h.arch.rig.rest[hb];
      const Bp = this._bonePoint(h, h.arch, hb, new Vector3(hr.x + g.x, hr.y + g.y, hr.z + g.z), _v2);
      if (A && Bp) R.add(Bp, A);
    }
    R.end();
  }

  /** world position of a rest-space point carried by a bone of an actor in its current pose */
  _bonePoint(a, arch, bone, restPoint, out) {
    if (!a.clip) return null;
    this.atlas.sample(a.clip, a.phase, _fb);
    this.atlas.boneMatrix(arch.rig, _fb[0], _fb[1], _fb[2], bone, _m2);
    const rp = arch.rig.rest[bone];
    out.set(restPoint.x - rp.x, restPoint.y - rp.y, restPoint.z - rp.z).applyMatrix4(_m2);
    a.object3D.updateWorldMatrix(true, false);
    this._actorMatrix(a, this._e);
    _m.fromArray(this._e);
    return out.applyMatrix4(_m);
  }

  _updateFlames(frame) {
    const each = (owner) => {
      for (const f of owner.flames) {
        if (f.stamp !== frame) this._flameAt(owner, f);
        const want = f.hidden === frame || (owner instanceof Crowd && owner.fadeM[f.i] < 0.5) ? 0 : 1;
        if (want !== f.lit) { f.lit = want; try { f.handle?.setIntensity?.(want * (PROPS[f.prop]?.flame?.intensity ?? 1)); } catch { /* ignore */ } }
      }
    };
    for (const a of this.actors) if (a.flames.length) each(a);
    for (const c of this.crowds) if (c.flames.length) each(c);
  }

  _placeFreeFlame(a, frame) {
    const f = a.flames[0];
    this._flameAt(a, f);
    f.stamp = frame;
  }

  /** cross-fade in LOCAL space (slerp per bone) into a scratch frame — linear blending of skinning matrices
   *  would shrink limbs mid-way. Returns true when the scratch frame holds this frame's pose. */
  _crossfade(a, arch, clip, phase, prevClip, prevPhase, fade) {
    const at = this.atlas;
    if (a.scratch < 0 || a.scratchEpoch !== at.epoch) { a.scratch = at.allocScratch(); a.scratchEpoch = at.epoch; }
    if (a.scratch < 0) return false;
    const n = arch.rig.n;
    for (let i = 0; i < 3; i++) if (!this._lp[i] || this._lp[i].n !== n) this._lp[i] = new LocalPose(n);
    const [cur, prev, out] = this._lp;
    at.localAt(arch.rig, clip, phase, cur);
    at.localAt(arch.rig, prevClip, prevPhase, prev);
    blendPose(out, cur, prev, smooth(0, 1, fade));
    at.writeScratch(a.scratch, arch.rig, out);
    return true;
  }

  _placeFlames(owner, i, arch, clip, e16, fa) {
    const f = owner instanceof Crowd ? owner.flames.find((q) => q.i === i) : owner.flames[0];
    if (!f || !owner.prop) return;
    const grip = clip.grip === 'pair' ? 'fist' : (clip.grip || 'fist');
    const side = clip.hand || owner.prop.side;
    const att = propAttach(owner.prop.name, grip, side, arch.rig);
    const tip = att && propTip(owner.prop.name, att.cls || grip, side);
    if (!att || !tip) return;
    this.atlas.boneMatrix(arch.rig, fa[0], fa[1], fa[2], att.bone, _m2);
    // bone-local tip = (attach offset − bone rest) + tip
    const rest = arch.rig.rest[att.bone];
    _v.set(att.x - rest.x + tip.x, att.y - rest.y + tip.y, att.z - rest.z + tip.z).applyMatrix4(_m2);
    _m.fromArray(e16);
    _v.applyMatrix4(_m);
    f.anchor.position.copy(_v);
    f.anchor.updateMatrixWorld();
  }

  dispose() {
    for (const a of [...this.actors]) a.dispose();
    for (const c of [...this.crowds]) c.dispose();
    for (const a of this.archs.values()) a.dispose();
    for (const p of this.props.values()) p.dispose();
    this.ropes?.dispose();
    this.root.removeFromParent();
  }
}

/** One dynamic mesh for every lead rope (one draw call): a four-sided tube along a sagging curve. */
class RopeSet {
  constructor(parent, max = 24, seg = 14) {
    this.max = max; this.seg = seg; this.side = 5;
    const nv = max * (seg + 1) * this.side;
    this.pos = new Float32Array(nv * 3);
    this.nrm = new Float32Array(nv * 3);
    const idx = [];
    for (let r = 0; r < max; r++) {
      const b = r * (seg + 1) * this.side;
      for (let i = 0; i < seg; i++) for (let k = 0; k < this.side - 1; k++) {
        const a0 = b + i * this.side + k, a1 = a0 + 1, c0 = a0 + this.side, c1 = c0 + 1;
        idx.push(a0, c0, a1, a1, c0, c1);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage));
    g.setAttribute('normal', new BufferAttribute(this.nrm, 3).setUsage(DynamicDrawUsage));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new Mesh(g, new MeshStandardMaterial({ color: 0x8f7a5c, roughness: 0.92 }));
    this.mesh.name = 'people:lead-ropes';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.matrixAutoUpdate = false;
    parent.add(this.mesh);
    this.n = 0;
  }
  begin() { this.n = 0; }
  add(A, B) {
    if (this.n >= this.max) return;
    const r = this.n++;
    const dist = A.distanceTo(B);
    const sag = Math.max(0.03, 0.18 * Math.max(0, 1.25 - dist));
    const T = new Vector3(), N = new Vector3(), Bn = new Vector3(), up = new Vector3(0, 1, 0), p = new Vector3(), q = new Vector3();
    const at = (t, o) => o.lerpVectors(A, B, t).addScaledVector(up, -sag * 4 * t * (1 - t));
    let o = r * (this.seg + 1) * this.side * 3;
    for (let i = 0; i <= this.seg; i++) {
      const t = i / this.seg;
      at(t, p);
      at(Math.min(1, t + 0.02), q); T.copy(q); at(Math.max(0, t - 0.02), q); T.sub(q).normalize();
      N.crossVectors(T, up); if (N.lengthSq() < 1e-6) N.set(1, 0, 0); N.normalize();
      Bn.crossVectors(N, T).normalize();
      for (let k = 0; k < this.side; k++) {
        const a = (k / (this.side - 1)) * Math.PI * 2;
        const cx = Math.cos(a), cy = Math.sin(a);
        const nx = N.x * cx + Bn.x * cy, ny = N.y * cx + Bn.y * cy, nz = N.z * cx + Bn.z * cy;
        this.pos[o] = p.x + nx * 0.0055; this.pos[o + 1] = p.y + ny * 0.0055; this.pos[o + 2] = p.z + nz * 0.0055;
        this.nrm[o] = nx; this.nrm[o + 1] = ny; this.nrm[o + 2] = nz;
        o += 3;
      }
    }
  }
  end() {
    const per = (this.seg + 1) * this.side;
    this.geo.setDrawRange(0, this.n * this.seg * (this.side - 1) * 6);
    this.mesh.visible = this.n > 0;
    if (!this.n) return;
    const pa = this.geo.attributes.position, na = this.geo.attributes.normal;
    pa.clearUpdateRanges(); na.clearUpdateRanges();
    pa.addUpdateRange(0, this.n * per * 3); na.addUpdateRange(0, this.n * per * 3);
    pa.needsUpdate = true; na.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
  dispose() { this.mesh.removeFromParent(); this.geo.dispose(); this.mesh.material.dispose(); }
}

function isShown(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

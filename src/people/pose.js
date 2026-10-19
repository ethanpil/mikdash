// Pose evaluation: local pose (per-bone rotation + translation offset), a builder with FK/IK helpers used by
// the clip library, pose blending, and conversion to skinning matrices (bake).
//
// Rotation conventions (figure faces -z, +x = its right, rest rotations are identity):
//   X: for a bone pointing DOWN (limbs) +X swings its tip FORWARD (flexion of hip/shoulder);
//      for a bone pointing UP (spine/neck/head) +X leans it BACK. Knee flexion = -X, elbow flexion = +X.
//   Z: for a downward bone +Z swings the tip toward +x (right arm abduction +Z, left arm abduction -Z);
//      for an upward bone +Z tilts the top toward -x (lean to the figure's left).
//   Y: +Y turns the figure's front toward its left (counter-clockwise seen from above).
// Euler order 'XYZ' (three's default), angles in DEGREES at this API.
import { Matrix4, Quaternion, Vector3, Euler } from 'three';
import { DEG } from './util.js';

const _e = new Euler();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _m = new Matrix4();
const _m2 = new Matrix4();
const _v = new Vector3();
const _v2 = new Vector3();
const _v3 = new Vector3();
const _s = new Vector3(1, 1, 1);

export class LocalPose {
  constructor(n) {
    this.n = n;
    this.q = new Float32Array(n * 4);
    this.t = new Float32Array(n * 3);
    this.reset();
  }
  reset() {
    this.q.fill(0);
    for (let i = 0; i < this.n; i++) this.q[i * 4 + 3] = 1;
    this.t.fill(0);
    return this;
  }
  copy(o) { this.q.set(o.q); this.t.set(o.t); return this; }
}

/** out = slerp(a, b, k) per bone (nlerp with hemisphere fix — plenty for keyframe blending). */
export function blendPose(out, a, b, k) {
  const n = a.n;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    let bx = b.q[o], by = b.q[o + 1], bz = b.q[o + 2], bw = b.q[o + 3];
    const d = a.q[o] * bx + a.q[o + 1] * by + a.q[o + 2] * bz + a.q[o + 3] * bw;
    if (d < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
    _q.set(a.q[o], a.q[o + 1], a.q[o + 2], a.q[o + 3]).slerp(_q2.set(bx, by, bz, bw), k);
    out.q[o] = _q.x; out.q[o + 1] = _q.y; out.q[o + 2] = _q.z; out.q[o + 3] = _q.w;
  }
  for (let i = 0; i < n * 3; i++) out.t[i] = a.t[i] + (b.t[i] - a.t[i]) * k;
  return out;
}

export function eulerQ(x, y, z, out = new Quaternion()) {
  return out.setFromEuler(_e.set(x * DEG, y * DEG, z * DEG, 'XYZ'));
}

/** Build a world rotation from basis vectors (columns). */
function basisQ(x, y, z, out) {
  _m.makeBasis(x, y, z);
  return out.setFromRotationMatrix(_m);
}

export class PoseBuilder {
  constructor(rig) {
    this.rig = rig;
    this.lp = new LocalPose(rig.n);
    this._wq = Array.from({ length: rig.n }, () => new Quaternion());
    this._wp = Array.from({ length: rig.n }, () => new Vector3());
  }

  reset() { this.lp.reset(); return this; }
  i(name) {
    const i = this.rig.index[name];
    if (i === undefined) throw new Error(`[people] no bone ${name}`);
    return i;
  }
  getQ(i, out = new Quaternion()) {
    const q = this.lp.q, o = i * 4;
    return out.set(q[o], q[o + 1], q[o + 2], q[o + 3]);
  }
  setQ(i, qq) {
    const q = this.lp.q, o = i * 4;
    q[o] = qq.x; q[o + 1] = qq.y; q[o + 2] = qq.z; q[o + 3] = qq.w;
    return this;
  }
  /** set local rotation (deg, XYZ) */
  rot(name, x = 0, y = 0, z = 0) { return this.setQ(this.i(name), eulerQ(x, y, z, _q)); }
  /** compose an extra local rotation after the current one (deg) */
  add(name, x = 0, y = 0, z = 0) {
    const i = this.i(name);
    this.getQ(i, _q2).multiply(eulerQ(x, y, z, _q));
    return this.setQ(i, _q2);
  }
  /** translation offset of the bone origin, in its parent's frame (m) */
  off(name, x = 0, y = 0, z = 0) {
    const o = this.i(name) * 3, t = this.lp.t;
    t[o] = x; t[o + 1] = y; t[o + 2] = z;
    return this;
  }
  addOff(name, x = 0, y = 0, z = 0) {
    const o = this.i(name) * 3, t = this.lp.t;
    t[o] += x; t[o + 1] += y; t[o + 2] += z;
    return this;
  }
  /** whole-figure transform (root bone): position (m) & rotation (deg) */
  root(px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0) {
    this.off('root', px, py, pz);
    return this.rot('root', rx, ry, rz);
  }

  /** world (model-space) rotation & position of bone i from the current local pose */
  world(i, outQ = this._wq[i], outP = this._wp[i]) {
    const rig = this.rig;
    const chain = [];
    for (let j = i; j >= 0; j = rig.parent[j]) chain.push(j);
    const q = outQ.set(0, 0, 0, 1);
    const p = outP.set(0, 0, 0);
    for (let c = chain.length - 1; c >= 0; c--) {
      const j = chain[c];
      const t = this.lp.t;
      _v.copy(rig.local[j]).add(_v2.set(t[j * 3], t[j * 3 + 1], t[j * 3 + 2])).applyQuaternion(q);
      p.add(_v);
      q.multiply(this.getQ(j, _q));
    }
    return { q, p };
  }
  worldPos(name, out = new Vector3()) { return out.copy(this.world(this.i(name)).p); }
  worldQ(name, out = new Quaternion()) { return out.copy(this.world(this.i(name)).q); }

  /** set bone i's local rotation so that its WORLD rotation equals wq */
  setWorldQ(i, wq) {
    const p = this.rig.parent[i];
    if (p < 0) return this.setQ(i, wq);
    const pq = this.world(p).q;
    _q2.copy(pq).invert().multiply(wq);
    return this.setQ(i, _q2);
  }

  /**
   * Analytic two-bone IK. a, b, c = bone indices (upper, lower, end). target = world position of c.
   * bend = world direction the middle joint should move toward (knee: forward; elbow: back/out).
   * restBend = that direction in the rest pose.
   */
  twoBone(a, b, c, target, bend, restBend) {
    const rig = this.rig;
    const A = this.world(a).p.clone();
    const l1 = rig.rest[b].distanceTo(rig.rest[a]);
    const l2 = rig.rest[c].distanceTo(rig.rest[b]);
    const toT = _v.copy(target).sub(A);
    let d = toT.length();
    const dMax = (l1 + l2) * 0.9995, dMin = Math.abs(l1 - l2) * 1.05 + 1e-4;
    d = Math.min(dMax, Math.max(dMin, d));
    const dir = toT.normalize().clone();
    const bn = _v2.copy(bend).addScaledVector(dir, -bend.dot(dir));
    if (bn.lengthSq() < 1e-8) bn.set(0, 0, -1).addScaledVector(dir, -dir.z);
    bn.normalize();
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const mid = A.clone().addScaledVector(dir, l1 * cosA).addScaledVector(bn, l1 * sinA);
    const end = A.clone().addScaledVector(dir, d);
    const u1 = mid.clone().sub(A).normalize();
    const u2 = end.clone().sub(mid).normalize();
    const side = new Vector3().crossVectors(dir, bn).normalize();
    // rest frames
    const r1 = rig.rest[b].clone().sub(rig.rest[a]).normalize();
    const r2 = rig.rest[c].clone().sub(rig.rest[b]).normalize();
    const rDir = rig.rest[c].clone().sub(rig.rest[a]).normalize();
    const rSide = new Vector3().crossVectors(rDir, restBend).normalize();
    const qa = this._frameQ(r1, rSide, u1, side);
    const qb = this._frameQ(r2, rSide, u2, side);
    this.setWorldQ(a, qa);
    this.setWorldQ(b, qb);
    return this;
  }
  /** rotation mapping rest (dir, side) frame to posed (dir, side) frame */
  _frameQ(rDir, rSide, pDir, pSide) {
    const rs = rSide.clone().addScaledVector(rDir, -rSide.dot(rDir)).normalize();
    const rf = new Vector3().crossVectors(rs, rDir);
    const ps = pSide.clone().addScaledVector(pDir, -pSide.dot(pDir)).normalize();
    const pf = new Vector3().crossVectors(ps, pDir);
    const Qr = basisQ(rs, rDir, rf, new Quaternion());
    const Qp = basisQ(ps, pDir, pf, new Quaternion());
    return Qp.multiply(Qr.invert());
  }

  /**
   * Place a foot: ankle at target (world, m). opts: knee (bend dir, default forward of the pelvis),
   * pitch (deg, + = toes up), yaw (deg, + = toes turned to the figure's left), roll, toe (deg toe flexion).
   */
  leg(side, target, opts = {}) {
    const s = side === 'l' ? 'l' : 'r';
    const T = Array.isArray(target) ? new Vector3(...target) : target;
    const pq = this.world(this.i('pelvis')).q.clone();
    const bend = opts.knee ? new Vector3(...opts.knee) : new Vector3(0, 0, -1).applyQuaternion(pq);
    this.twoBone(this.i(`thigh_${s}`), this.i(`shin_${s}`), this.i(`foot_${s}`), T, bend, new Vector3(0, 0, -1));
    // foot orientation in world: base = root yaw (+ pelvis yaw share), then pitch/yaw/roll
    const rootQ = this.world(this.i('root')).q;
    const fq = (opts.frame ? opts.frame.clone() : rootQ.clone())
      .multiply(eulerQ(opts.pitch || 0, (opts.yaw || 0) * (s === 'l' ? -1 : 1), (opts.roll || 0) * (s === 'l' ? -1 : 1), _q));
    this.setWorldQ(this.i(`foot_${s}`), fq);
    this.rot(`toe_${s}`, opts.toe || 0, 0, 0);
    return this;
  }

  /**
   * Place a hand: wrist at target (world). opts: elbow (bend dir world; default back & out & slightly down),
   * hand: { thumb:[x,y,z] world dir, fingers:[x,y,z] world dir } or handQ (world quaternion).
   */
  arm(side, target, opts = {}) {
    const s = side === 'l' ? 'l' : 'r';
    const sg = s === 'l' ? -1 : 1;
    const T = Array.isArray(target) ? new Vector3(...target) : target;
    const cq = this.world(this.i('chest')).q.clone();
    const bend = (opts.elbow ? new Vector3(opts.elbow[0] * sg, opts.elbow[1], opts.elbow[2]) : new Vector3(0.35 * sg, -0.25, 1))
      .normalize().applyQuaternion(opts.elbowWorld ? new Quaternion() : cq);
    this.twoBone(this.i(`uarm_${s}`), this.i(`farm_${s}`), this.i(`hand_${s}`), T, bend, new Vector3(0, 0, 1));
    if (opts.handQ) this.setWorldQ(this.i(`hand_${s}`), opts.handQ);
    else if (opts.hand) this.aimHand(s, opts.hand.thumb, opts.hand.fingers, opts.hand.world);
    return this;
  }

  /**
   * Orient a hand: thumb (direction the fist axis / thumb points) and fingers (direction the fingers point
   * out of the knuckles). Directions are in the CHEST frame unless world = true. For the left hand pass the
   * mirrored directions yourself (or use mirrorDir).
   */
  aimHand(side, thumb, fingers, world = false) {
    const s = side === 'l' ? 'l' : 'r';
    const t = new Vector3(...thumb).normalize();
    const f = new Vector3(...fingers);
    if (!world) {
      const cq = this.world(this.i('chest')).q;
      t.applyQuaternion(cq);
      f.applyQuaternion(cq);
    }
    // hand-local rest axes: thumb = -Z, fingers = -Y  =>  Z' = -t, Y' = -(f ⟂ t), X' = Y' × Z'
    const Z = t.clone().negate();
    const Y = f.clone().addScaledVector(t, -f.dot(t)).normalize().negate();
    const X = new Vector3().crossVectors(Y, Z);
    const q = basisQ(X, Y, Z, new Quaternion());
    return this.setWorldQ(this.i(`hand_${s}`), q);
  }

  /** finger curls (deg): fingers (middle-ring-little), index, thumb */
  fingers(side, curl = 20, index = curl, thumb = 10, spread = 0) {
    const s = side === 'l' ? 'l' : 'r';
    const sg = s === 'l' ? -1 : 1;
    // finger curl rotates the finger tips toward the palm: palm faces -x (right) => about Z.
    // two joints per finger group: proximal takes ~45%, the middle/distal ~55% of the curl
    this.rot(`fing_${s}`, 0, 0, -curl * 0.85 * sg);
    this.rot(`fing2_${s}`, 0, 0, -curl * 1.05 * sg);
    this.rot(`idx_${s}`, spread, 0, -index * 0.85 * sg);
    this.rot(`idx2_${s}`, 0, 0, -index * 1.05 * sg);
    this.rot(`thb_${s}`, -thumb * 0.5, 0, -thumb * sg);
    return this;
  }
}

/** mirror a world/chest-frame direction across the sagittal plane (x → -x) */
export const mirrorDir = (d) => [-d[0], d[1], d[2]];

/**
 * Local pose → skinning matrices (bone world × inverse rest) written as 3 rows of 4 floats per bone
 * into out[offset + bone*12 ...]. Also returns world matrices in `worlds` if given.
 */
export function poseToSkin(rig, lp, out, offset = 0, worlds = null) {
  const n = rig.n;
  const W = worlds || poseToSkin._w || (poseToSkin._w = []);
  for (let i = 0; i < n; i++) {
    if (!W[i]) W[i] = new Matrix4();
    const p = rig.parent[i];
    _v.copy(rig.local[i]).add(_v2.set(lp.t[i * 3], lp.t[i * 3 + 1], lp.t[i * 3 + 2]));
    _q.set(lp.q[i * 4], lp.q[i * 4 + 1], lp.q[i * 4 + 2], lp.q[i * 4 + 3]);
    _m.compose(_v, _q, _s);
    if (p < 0) W[i].copy(_m); else W[i].multiplyMatrices(W[p], _m);
    // skin = W × T(-rest)
    _m2.copy(W[i]).multiply(_m.makeTranslation(-rig.rest[i].x, -rig.rest[i].y, -rig.rest[i].z));
    const e = _m2.elements, o = offset + i * 12;
    for (let r = 0; r < 3; r++) {
      out[o + r * 4] = e[r];
      out[o + r * 4 + 1] = e[4 + r];
      out[o + r * 4 + 2] = e[8 + r];
      out[o + r * 4 + 3] = e[12 + r];
    }
  }
  return out;
}
export { _v3 as _tmpV };

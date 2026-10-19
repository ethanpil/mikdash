// Skirt cage: pose-aware garment deformation without extra vertex attributes.
// Long robes (ketonet, tunics, mantles, the me'il and ephod) are skinned to the pelvis at the seat, to an
// upper cage bone per side (skt_*, hip → knee) and a hem cage bone per side (skh_*, knee → hem). After every
// baked clip frame the cage is solved from the legs in two steps:
//
// 1. clothCage (rotations, on the local pose):
//   standing / walking — the cloth HANGS: the upper panel follows the thigh about half way, the hem panel stays
//                        near the vertical (it swings a little with the shin), as before;
//   kneeling, sitting, bowing low, prostrating, lying — the cloth FOLLOWS the legs: the upper panel lies along
//                        the thigh and the hem panel along the shin, so the robe covers the shins instead of
//                        parting over them (a fitted ketonet does not ride up — report §34.1).
//   The blend k is driven by how far the thigh has left the vertical (in the figure's own frame and in the world)
//   and by the shin's angle (kneeling upright). The two sides may not diverge by more than CAP degrees (legs
//   spread in prostration would otherwise stretch the cloth between them into a web).
//
// 2. clothSkin (affine, on the baked skinning matrices): a robe section that follows a near-horizontal leg is a
//   tube of the robe's own girth around the leg — rigidly rotated, its upper side would stand ~15 cm proud of the
//   calves and its open end would gape (seen from behind: "bare shins inside a loop"). Real cloth falls onto the
//   leg and the floor. So each cage bone's matrix is pre-multiplied by a vertical squash about the leg's axis
//   height that brings the section's top down to just above the leg and its bottom up to the floor. The squash is
//   faded in with how horizontal the section lies, so standing and sitting shins are untouched.
//
// Every clip — keyed one-shots and cross-fades included (the atlas re-runs clothSkin on scratch frames) — gets it
// for free.
import { Quaternion, Vector3 } from 'three';
import { smooth, clamp, lerp } from './util.js';

const _down = new Vector3(0, -1, 0);
const _a = new Vector3();
const _b = new Vector3();
const _q0 = new Quaternion();
const _q1 = new Quaternion();
const _q2 = new Quaternion();
const _qm = new Quaternion();
const _yaw = new Quaternion();
const CAP = 12; // degrees: largest left/right divergence of the cage panels

/** pull two rotations toward their midpoint so they differ by at most cap degrees */
function capPair(ql, qr, cap) {
  const d = Math.abs(ql.dot(qr));
  const ang = 2 * Math.acos(Math.min(1, d)) * 180 / Math.PI;
  if (ang <= cap) return;
  _qm.copy(ql).slerp(qr, 0.5);
  const t = cap / ang;
  _q2.copy(ql); ql.copy(_qm).slerp(_q2, t);
  _q2.copy(qr); qr.copy(_qm).slerp(_q2, t);
}

/** Solve the cage bones of a human pose (PoseBuilder) in place. No-op for rigs without a cage. */
export function clothCage(P, rig) {
  const I = rig.index;
  if (I.skt_l === undefined) return;
  const rootQ = P.world(I.root).q.clone();
  const pelvisQ = P.world(I.pelvis).q.clone();
  // "hanging" frame: the figure's yaw only (cloth falls to the world's down, whatever the pelvis does)
  _a.set(0, 0, -1).applyQuaternion(rootQ);
  _yaw.setFromAxisAngle(new Vector3(0, 1, 0), Math.atan2(-_a.x, -_a.z));
  const up = {}, hem = {};
  for (const s of ['l', 'r']) {
    const thighQ = P.world(I[`thigh_${s}`]).q.clone();
    const shinQ = P.world(I[`shin_${s}`]).q.clone();
    // thigh flexion relative to the pelvis, and the thigh's angle from the world vertical
    _a.copy(_down).applyQuaternion(thighQ);
    _b.copy(_down).applyQuaternion(pelvisQ);
    const flexRel = Math.acos(Math.max(-1, Math.min(1, _a.dot(_b)))) * 180 / Math.PI;
    const flexWorld = Math.acos(Math.max(-1, Math.min(1, _a.dot(_down)))) * 180 / Math.PI;
    // ... and the shin's angle from the vertical (kneeling upright: thighs vertical, shins along the floor)
    _b.copy(_down).applyQuaternion(shinQ);
    const shinWorld = Math.acos(Math.max(-1, Math.min(1, _b.dot(_down)))) * 180 / Math.PI;
    const k = Math.max(smooth(28, 62, flexRel), smooth(35, 70, flexWorld), smooth(55, 85, shinWorld));
    // upper panel: half-way pelvis → thigh when hanging, the thigh itself when following
    _q0.copy(pelvisQ).slerp(thighQ, 0.55);
    _q0.slerp(thighQ, k);
    up[s] = _q0.clone();
    // hem panel: near-vertical (yaw only) with a little shin swing when hanging, the shin when following
    _q1.copy(_yaw).slerp(shinQ, 0.4);
    hem[s] = _q1.clone().slerp(shinQ, k);
  }
  capPair(up.l, up.r, CAP);
  capPair(hem.l, hem.r, CAP);
  // parents first: the hem bones are children of the upper ones
  P.setWorldQ(I.skt_l, up.l);
  P.setWorldQ(I.skt_r, up.r);
  P.setWorldQ(I.skh_l, hem.l);
  P.setWorldQ(I.skh_r, hem.r);
}

// rest-space points of a skin matrix (3 rows × 4 floats, row-major) → model space
function xf(m, o, x, y, z, out) {
  out.x = m[o] * x + m[o + 1] * y + m[o + 2] * z + m[o + 3];
  out.y = m[o + 4] * x + m[o + 5] * y + m[o + 6] * z + m[o + 7];
  out.z = m[o + 8] * x + m[o + 9] * y + m[o + 10] * z + m[o + 11];
  return out;
}
const _pA = new Vector3();
const _pB = new Vector3();
const _pM = new Vector3();

/**
 * Flatten the cage sections that lie along a near-horizontal leg onto the leg and the floor (see the header).
 * out: the skinning-matrix buffer of one frame (MAX_BONES × 12 floats from `off`), cage bones already rigid.
 * Model-space floor is y = 0 (every human clip keeps the figure's origin on the floor).
 */
export function clothSkin(rig, out, off = 0) {
  const I = rig.index;
  if (I.skt_l === undefined) return;
  const d = rig.dims, k = d.H / 1.67;
  const seatY = d.hipY - 0.06 * k, kneeY = d.kneeY, hemY = d.ankleY + 0.04 * k;
  // the girth of a long robe around the legs (front–back and side half-extents, generous: mantles are wider)
  const rzUp = d.hips[1] * 1.05 + 0.025 * k, rxUp = d.hips[0] * 1.05 + 0.03 * k;
  const rzHem = d.hips[1] * 1.05 + 0.055 * k, rxHem = d.hips[0] * 1.05 + 0.07 * k;
  const sections = [
    // bone, rest axis ends (y), leg radius under the cloth, cloth half-extents
    ['skt', seatY, kneeY, 0.07 * k, rxUp, rzUp],
    ['skh', kneeY, hemY, 0.047 * k, rxHem, rzHem],
  ];
  for (const s of ['l', 'r']) {
    const hx = (s === 'l' ? -1 : 1) * d.hipX;
    for (const [name, yA, yB, legR, rx, rz] of sections) {
      const o = off + I[`${name}_${s}`] * 12;
      xf(out, o, hx, yA, 0.006, _pA);
      xf(out, o, hx, yB, 0.012, _pB);
      const len = _pA.distanceTo(_pB);
      if (len < 1e-4) continue;
      const cosV = Math.abs(_pB.y - _pA.y) / len;          // 1 = hanging straight down
      const hz = smooth(0.72, 0.3, cosV);                   // 0 within ~45° of the vertical, 1 past ~72°
      if (hz <= 0) continue;
      // vertical half-extent of the cloth's cross-section: the bone's x and z axes, scaled by the girth
      const h = Math.hypot(rx * out[o + 4], rz * out[o + 6]);
      if (h < 1e-4) continue;
      // the section's axis height (the leg runs inside it); the cloth spans yc ± h after the rigid transform
      const yc = (_pA.y + _pB.y) / 2;
      // target span: just over the leg on top; just under it below — or, when the leg rests on the floor, the
      // underside goes just below the floor (hidden), so no band of cloth lies on the floor round the feet
      const c = 0.022 * k;
      const T = yc + legR + c;
      let Bt = yc - legR - c;
      if (Bt < 0.03 * k) Bt = -0.015 * k;
      const a = clamp((T - Bt) / (2 * h), 0.2, 1);
      const b = Bt - a * (yc - h);
      const ae = lerp(1, a, hz), be = b * hz;
      // the midline of the robe under this section (pivot of the side squash), before the vertical squash
      xf(out, o, 0, (yA + yB) / 2, 0.01, _pM);
      // M' = S · M with S: y' = ae · y + be  → scale row 1, add to its translation
      for (let q = 0; q < 4; q++) out[o + 4 + q] *= ae;
      out[o + 7] += be;
      // ... and across: the robe's sides fall in toward the legs instead of standing out as flaps on the floor.
      // u = the horizontal direction across the section; S2 = I − (1 − s)·u uᵀ about the midline
      const ux = _pB.z - _pA.z, uz = -(_pB.x - _pA.x), ul = Math.hypot(ux, uz);
      if (ul < 1e-4) continue;
      const nx = ux / ul, nz = uz / ul;
      const w = Math.hypot(rx * (out[o] * nx + out[o + 8] * nz), rz * (out[o + 2] * nx + out[o + 10] * nz));
      // (the hem section closes in round the ankles, the upper one round the thighs)
      const s2 = lerp(1, clamp((d.hipX + legR + (name === 'skh' ? 0.022 : 0.05) * k) / Math.max(1e-4, w), 0.5, 1), hz);
      if (s2 >= 0.999) continue;
      const f = 1 - s2, pmu = _pM.x * nx + _pM.z * nz;
      for (let q = 0; q < 4; q++) {
        const cx = out[o + q], cz = out[o + 8 + q];
        const dot = cx * nx + cz * nz - (q === 3 ? pmu : 0);
        out[o + q] = cx - f * dot * nx;
        out[o + 8 + q] = cz - f * dot * nz;
      }
    }
  }
}

// Human pose library. Each clip is a pure function of a phase (0..1) so the simulation can drive it
// deterministically from sim time; clips are baked once per rig into the animation atlas.
//
//   loop clips  : phase wraps (cycles: stand/breathing, walk, run, playing, swaying …)
//   one-shots   : 0 → 0.3 go down / act, 0.3 → 0.7 hold, 0.7 → 1 return (prostrate, bow, kneel)
//                 or 0 → 1 a single action (pour, throw)
//
// Research notes (see docs/decisions/people.md): prostration is FULL LENGTH — arms and legs spread flat,
// face down (Shevuot 16b; report §35.2); Birkat Kohanim in the Mikdash: hands raised ABOVE the head
// (Tamid 7:2; Sotah 38a), the Kohen Gadol not above the Tzitz (stam, report lock #37) → 'raise_hands_low';
// trumpets are raised (Tamid 7:3).
import { Vector3, Quaternion, Matrix4 } from 'three';
import { PoseBuilder, blendPose } from './pose.js';
import { TAU, smooth, clamp, lerp } from './util.js';
import { AMAH } from '../core/units.js';

const sin = Math.sin, cos = Math.cos, abs = Math.abs;
const V = (x, y, z) => new Vector3(x, y, z);

// ------------------------------------------------------------------------------------------- helpers
function stance(P, r, o = {}) {
  const d = r.dims;
  const elder = d.style === 'elder';
  P.off('pelvis', o.px || 0, (o.dy || 0) - (elder ? 0.018 : 0.006), o.pz || 0);
  P.rot('pelvis', o.pp || 0, o.py || 0, o.pr || 0);
  P.rot('spine', (o.lean || 0) + (elder ? -5 : -0.5), o.sy || 0, o.sr || 0);
  P.rot('chest', (o.chest || 0) + (elder ? -7 : 0.5), o.cy || 0, o.cr || 0);
  P.rot('neck', (o.neck ?? 0) + (elder ? 9 : 2.5), o.ny || 0, 0);
  P.rot('head', (o.head ?? 0) + (elder ? 2 : -2.5), o.hy || 0, o.hr || 0);
  if (!o.noLegs) {
    const fx = d.hipX * 1.02 + 0.012;
    const fz = o.fz || 0;
    P.leg('l', V(-fx + (o.lx || 0), d.ankleY, fz + (o.lz || 0)), { yaw: 7 });
    P.leg('r', V(fx + (o.rx || 0), d.ankleY, fz + (o.rz || 0)), { yaw: 7 });
  }
}

/**
 * Relaxed arm: the rig's rest splay (9°, see rig.js) is taken back so the arm hangs just clear of the hips and
 * the garments over them — the hand close to the thigh, not held out in an A-pose.
 */
function hangAdduction(r) {
  if (r._hangAdd != null) return r._hangAdd;
  const d = r.dims, k = d.H / 1.67;
  const sh = r.rest[r.index.uarm_r], wr = r.rest[r.index.hand_r];
  const armL = sh.distanceTo(wr);
  const clear = d.hips[0] * 1.06 + 0.014 + 0.03 * k; // hip half-width + tunic + forearm radius
  const out = Math.asin(clamp((clear - d.shX) / armL, -0.2, 0.35)) * 180 / Math.PI;
  r._hangAdd = 9 - out;
  return r._hangAdd;
}
function armHang(P, s, k = {}) {
  const sg = s === 'l' ? -1 : 1;
  P.rot(`clav_${s}`, 0, 0, (k.shrug || 0) * sg);
  P.rot(`uarm_${s}`, k.flex ?? 4, (k.twist || 0) * sg, -(k.add ?? hangAdduction(P.rig)) * sg);
  P.rot(`farm_${s}`, k.elbow ?? 10, (k.ftwist ?? 12) * sg, 0);
  P.rot(`hand_${s}`, k.wrist ?? 4, 0, (k.dev ?? 0) * sg);
  // a relaxed hand: the fingers held together in a soft cascade (index least, little finger most — the cascade
  // across the three is modelled in the mesh), the thumb alongside the index
  P.fingers(s, k.curl ?? 30, k.icurl ?? 22, k.thumb ?? 4);
}

function breathe(P, ph, a = 1) {
  const b = sin(ph * TAU);
  P.add('chest', 0.8 * b * a, 0, 0);
  P.add('clav_l', 0, 0, -0.6 * b * a);
  P.add('clav_r', 0, 0, 0.6 * b * a);
  P.add('neck', -0.4 * b * a, 0, 0);
}

// grip offset of the fist centre from the wrist, hand-local (right; mirror x for left)
export function gripOffset(r, s) {
  const k = r.dims.handS || 1;
  return V((s === 'l' ? 1 : -1) * 0.012 * k, -0.072 * k, -0.006 * k);
}

/** hand world rotation from thumb & finger directions (model space) */
const _bm = new Matrix4();
function handQ(thumb, fingers) {
  const t = thumb.clone().normalize();
  const Z = t.clone().negate();
  const Y = fingers.clone().addScaledVector(t, -fingers.dot(t)).normalize().negate();
  const X = new Vector3().crossVectors(Y, Z);
  return new Quaternion().setFromRotationMatrix(_bm.makeBasis(X, Y, Z));
}

/** Place a fist (the grip centre) at `center` (model space) with given thumb/finger directions. */
function fist(P, r, s, center, thumb, fingers, o = {}) {
  const q = handQ(thumb, fingers);
  const wrist = center.clone().sub(gripOffset(r, s).applyQuaternion(q));
  P.arm(s, wrist, { elbow: o.elbow, handQ: q });
  P.fingers(s, o.curl ?? 85, o.icurl ?? (o.curl ?? 80), o.thumb ?? 40);
  return q;
}

/** open hand: wrist at `wrist`, palm/thumb directions given */
function openHand(P, s, wrist, thumb, fingers, o = {}) {
  P.arm(s, wrist, { elbow: o.elbow, elbowWorld: o.elbowWorld, handQ: handQ(thumb, fingers) });
  P.fingers(s, o.curl ?? 12, o.icurl ?? 8, o.thumb ?? 10, o.spread ?? 0);
}

// head/face reference points (model space, rest)
const lips = (r) => V(0, r.rest[r.index.head].y + 0.03 * r.dims.headS, -0.105 * r.dims.headS);

// ------------------------------------------------------------------------------------------- locomotion
function feetCycle(P, r, ph, o) {
  const d = r.dims;
  const L = o.L, sF = o.stanceF;
  const halfW = d.hipX * 0.92;
  const a = d.ankleY, heelB = 0.05 * d.H / 1.67, ball = d.footLen * 0.55;
  for (const [s, sg, off] of [['r', 1, 0], ['l', -1, 0.5]]) {
    const u = (ph + off) % 1;
    let y, z, pitch, toe = 0;
    if (u < sF) {
      const k = u / sF;
      const zFlat = -L * sF / 2 + k * L * sF;
      pitch = o.heelStrike * (1 - smooth(0, 0.2, k)) - o.toeOff * smooth(0.55, 1, k);
      const th = pitch * Math.PI / 180;
      if (pitch >= 0) { // pivot at the heel
        y = a * cos(th) + heelB * sin(th);
        z = zFlat + heelB + a * sin(th) - heelB * cos(th);
      } else {          // pivot at the ball
        y = a * cos(th) - ball * sin(th);
        z = zFlat - ball + a * sin(th) + ball * cos(th);
        toe = -pitch * 0.9;
      }
    } else {
      const k = (u - sF) / (1 - sF);
      const e = (1 - cos(Math.PI * k)) / 2;
      z = L * sF / 2 - e * L * sF + (o.kick || 0) * sin(Math.PI * clamp(k * 1.3)) ;
      pitch = -o.toeOff * (1 - smooth(0, 0.4, k)) + o.heelStrike * smooth(0.55, 1, k);
      y = a + o.lift * sin(Math.PI * k) * (1 - 0.25 * k) + 0.03 * (1 - smooth(0, 0.3, k));
      toe = o.toeOff * 0.5 * (1 - smooth(0, 0.3, k));
    }
    P.leg(s, V(sg * halfW, y, z), { pitch, yaw: 4, toe });
  }
}

function walkBody(P, r, ph, o = {}) {
  const d = r.dims;
  const elder = d.style === 'elder';
  const run = !!o.run;
  const sw = cos(TAU * ph);
  const bobA = run ? 0.035 : 0.013, base = run ? -0.07 : -0.024;
  P.off('pelvis', (run ? 0.006 : 0.013) * sin(TAU * (ph - 0.05)),
    base + bobA * cos(2 * TAU * (ph - (run ? 0.18 : 0.3))) - (elder ? 0.02 : 0), 0);
  P.rot('pelvis', run ? -6 : -1.5, (run ? 8 : 5) * sw, (run ? 2 : 3) * sin(TAU * (ph - 0.05)));
  P.rot('spine', (run ? -10 : -2) + (elder ? -5 : 0), -(run ? 6 : 3) * sw, -1.5 * sin(TAU * (ph - 0.05)));
  P.rot('chest', (run ? -4 : 0) + (elder ? -7 : 0), -(run ? 7 : 3.5) * sw, -0.8 * sin(TAU * (ph - 0.05)));
  P.rot('neck', (run ? 8 : 3) + (elder ? 9 : 0), 2 * sw, 0);
  P.rot('head', (run ? 4 : -2) + 1.2 * cos(2 * TAU * (ph - 0.3)), 2.5 * sw, 0);
  if (!o.noArms) {
    const A = run ? 34 : (o.armSwing ?? 13);
    for (const [s, sg] of [['r', 1], ['l', -1]]) {
      const f = -sg * sw; // +1 = this arm forward
      P.rot(`clav_${s}`, 0, 0, 0);
      P.rot(`uarm_${s}`, 3 + A * f, 0, -(run ? 8 : hangAdduction(r) - 1) * sg);
      P.rot(`farm_${s}`, (run ? 78 : 12) + (run ? 12 : 9) * Math.max(0, f), 6 * sg, 0);
      P.rot(`hand_${s}`, 0, 0, 0);
      P.fingers(s, run ? 70 : 36, run ? 60 : 28, 16);
    }
  }
  feetCycle(P, r, ph, run
    ? { L: d.runStride, stanceF: 0.36, lift: 0.17, heelStrike: 8, toeOff: 38, kick: 0.12 }
    : { L: d.stride * (elder ? 0.84 : 1), stanceF: 0.6, lift: 0.07, heelStrike: 14, toeOff: 30 });
}

// ------------------------------------------------------------------------------------------- arm layers
function carryArms(P, r, ph) {
  const d = r.dims, y = d.H * 0.585, z = -0.27 * d.H / 1.67;
  const w = 0.135 * d.H / 1.67;
  openHand(P, 'r', V(w, y, z + 0.02), V(-0.2, 0.55, -1), V(-0.6, -0.15, -0.55), { curl: 30, elbow: [0.6, -0.6, 0.6] });
  openHand(P, 'l', V(-w, y, z + 0.02), V(0.2, 0.55, -1), V(0.6, -0.15, -0.55), { curl: 30, elbow: [0.6, -0.6, 0.6] });
}

function shoulderArms(P, r, ph, walking) {
  const d = r.dims, k = d.H / 1.67;
  // right hand steadies the load on the right shoulder
  openHand(P, 'r', V(0.17 * k, d.H * 0.93, -0.02 * k), V(-0.2, 0.3, -1), V(-0.3, 1, 0.1), { curl: 35, elbow: [0.4, -1, -0.5] });
  if (!walking) armHang(P, 'l', {});
}

function torchArm(P, r, ph) {
  const d = r.dims, k = d.H / 1.67;
  fist(P, r, 'r', V(0.25 * k, d.H * 0.74, -0.24 * k), V(0.05, 1, -0.12), V(-1, 0, -0.2), { elbow: [0.5, -1, 0.4] });
}

// ------------------------------------------------------------------------------------------- key poses
function keyStand(P, r) { stance(P, r); armHang(P, 'l'); armHang(P, 'r'); }

function keyKneel(P, r) {
  const d = r.dims;
  const thigh = r.rest[r.index.thigh_r].y - r.rest[r.index.shin_r].y;
  const hipY = 0.07 + thigh;
  P.off('pelvis', 0, hipY - r.rest[r.index.thigh_r].y, 0.02);
  P.rot('pelvis', 0, 0, 0);
  P.rot('spine', 1, 0, 0); P.rot('chest', 0, 0, 0); P.rot('neck', 3, 0, 0); P.rot('head', -6, 0, 0);
  for (const s of ['l', 'r']) {
    P.rot(`thigh_${s}`, -2, 0, 0);
    P.rot(`shin_${s}`, -90, 0, 0);
    P.rot(`foot_${s}`, -72, 0, 0);
    P.rot(`toe_${s}`, 0, 0, 0);
  }
  // hands resting on the thighs
  const k = d.H / 1.67;
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    openHand(P, s, V(sg * 0.13 * k, hipY - 0.06, -0.20 * k), V(0, 0.2, -1), V(0, -1, -0.35), { curl: 22, elbow: [0.4, -0.5, 1] });
  }
}

function keyBowDown(P, r) {
  const k = r.dims.H / 1.67;
  stance(P, r, { pz: 0.07 * k, dy: -0.01, pp: -22, lean: -22, chest: -18, neck: -6, head: -14 });
  for (const s of ['r', 'l']) armHang(P, s, { flex: 58, elbow: 14, add: 3 });
}

function keyHandsDown(P, r) { // kneeling, hands to the floor in front (on the way into full prostration)
  const d = r.dims, k = d.H / 1.67;
  const thigh = r.rest[r.index.thigh_r].y - r.rest[r.index.shin_r].y;
  const hipY = 0.07 + thigh * 0.93;
  P.off('pelvis', 0, hipY - r.rest[r.index.thigh_r].y, -0.05 * k);
  P.rot('pelvis', -38, 0, 0);
  P.rot('spine', -22, 0, 0); P.rot('chest', -14, 0, 0); P.rot('neck', 14, 0, 0); P.rot('head', -12, 0, 0);
  for (const s of ['l', 'r']) {
    P.rot(`thigh_${s}`, 20, 0, 0);
    P.rot(`shin_${s}`, -100, 0, 0);
    P.rot(`foot_${s}`, -60, 0, 0);
  }
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    openHand(P, s, V(sg * 0.24 * k, 0.07, -0.62 * k), V(-sg * 0.6, 0, -1), V(0, -0.3, -1), { curl: 6, elbow: [0.8, 0.4, 0.4] });
  }
}

function keyFlat(P, r) { // full-length hishtachavayah: face down, arms & legs spread (Shevuot 16b)
  const d = r.dims, k = d.H / 1.67;
  const lift = d.chest[1] + 0.035 * k;
  P.root(0, lift, 0.32 * k, -90, 0, 0);
  P.off('pelvis', 0, 0, 0);
  P.rot('pelvis', 0, 0, 0);
  P.rot('spine', 2, 0, 0); P.rot('chest', 2, 0, 0); P.rot('neck', 10, 0, 0); P.rot('head', 6, 0, 0);
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    P.rot(`clav_${s}`, 0, 0, 14 * sg);
    P.rot(`uarm_${s}`, 168, 0, 34 * sg);
    P.rot(`farm_${s}`, 6, 0, 0);
    P.rot(`hand_${s}`, 0, 80 * sg, 0);
    P.fingers(s, 6, 4, 8, 6);
    // the legs rest on the floor (thighs, knees and the tops of the feet down), a little apart: the hips flex
    // toward the floor from the chest-supported pelvis and the knees take it back (the robe lies on them — cloth.js)
    P.rot(`thigh_${s}`, 12.5, 0, 5 * sg);
    P.rot(`shin_${s}`, -12, 0, 0);
    P.rot(`foot_${s}`, -66, 0, 0);
    P.rot(`toe_${s}`, 10, 0, 0);
  }
}

function keySit(P, r) {
  const d = r.dims, k = d.H / 1.67;
  const seat = 0.46 * Math.min(1, k * 1.05);
  const hipY = seat + 0.085 * k;
  P.off('pelvis', 0, hipY - r.rest[r.index.thigh_r].y, 0);
  P.rot('pelvis', 0, 0, 0);
  P.rot('spine', 4, 0, 0); P.rot('chest', -2, 0, 0); P.rot('neck', 4, 0, 0); P.rot('head', -6, 0, 0);
  const fx = d.hipX * 1.15 + 0.02;
  const thigh = r.rest[r.index.thigh_r].y - r.rest[r.index.shin_r].y;
  P.leg('l', V(-fx, d.ankleY, -thigh * 0.98), { yaw: 6, knee: [0, 0.6, -1] });
  P.leg('r', V(fx, d.ankleY, -thigh * 0.98), { yaw: 6, knee: [0, 0.6, -1] });
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    openHand(P, s, V(sg * 0.13 * k, hipY + 0.06, -0.24 * k), V(0, 0.15, -1), V(0, -1, -0.5), { curl: 26, elbow: [0.5, -0.6, 1] });
  }
}

/** evaluate keyed one-shot: keys = [[t, fn], ...] (t ascending), eased blend between neighbours */
function keyed(keys) {
  return (P, r, ph) => {
    let i = 0;
    while (i < keys.length - 2 && ph > keys[i + 1][0]) i++;
    const [t0, f0] = keys[i], [t1, f1] = keys[i + 1];
    const k = smooth(0, 1, clamp((ph - t0) / Math.max(1e-6, t1 - t0)));
    if (k <= 0 || f0 === f1) { P.reset(); f0(P, r, ph); return; }
    if (k >= 1) { P.reset(); f1(P, r, ph); return; }
    const A = _aux(r, 0), B = _aux(r, 1);
    A.reset(); f0(A, r, ph);
    B.reset(); f1(B, r, ph);
    blendPose(P.lp, A.lp, B.lp, k);
  };
}
const _auxCache = new Map();
function _aux(r, n) {
  const key = `${r.key || r.type}:${n}`;
  if (!_auxCache.has(key)) _auxCache.set(key, new PoseBuilder(r));
  return _auxCache.get(key);
}

// ------------------------------------------------------------------------------------------- the clips
// frames = baked samples; loop; rate = natural cycles/second when auto-advanced; grip = prop attachment class
export const HUMAN_CLIPS = {
  stand: {
    frames: 24, loop: true, rate: 0.125,
    fn(P, r, ph) {
      const w = sin(ph * TAU);
      stance(P, r, { px: 0.009 * w, pr: -1.1 * w, sr: 0.7 * w, cr: 0.5 * w, hy: 2.2 * sin(ph * TAU + 1.3), hr: 0.8 * w });
      armHang(P, 'l'); armHang(P, 'r');
      breathe(P, ph * 2);
    },
  },
  walk: {
    frames: 32, loop: true, stride: 'stride',
    fn(P, r, ph) { walkBody(P, r, ph); },
  },
  run: {
    frames: 24, loop: true, stride: 'runStride',
    fn(P, r, ph) { walkBody(P, r, ph, { run: true }); },
  },
  carry: {
    frames: 16, loop: true, rate: 0.2, grip: 'tray',
    fn(P, r, ph) { stance(P, r, { lean: 1.5 }); carryArms(P, r, ph); breathe(P, ph); },
  },
  carry_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'tray',
    fn(P, r, ph) { walkBody(P, r, ph, { noArms: true }); carryArms(P, r, ph); },
  },
  carry_shoulder: {
    frames: 16, loop: true, rate: 0.2, grip: 'shoulder',
    fn(P, r, ph) { stance(P, r, { cr: -2, hr: 3 }); shoulderArms(P, r, ph, false); breathe(P, ph); },
  },
  carry_shoulder_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'shoulder',
    fn(P, r, ph) {
      walkBody(P, r, ph);
      shoulderArms(P, r, ph, true);
    },
  },
  torch: {
    frames: 16, loop: true, rate: 0.15, grip: 'fist', hand: 'r',
    fn(P, r, ph) { stance(P, r, { hy: 3 * sin(ph * TAU) }); armHang(P, 'l'); torchArm(P, r, ph); breathe(P, ph); },
  },
  torch_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'fist', hand: 'r',
    fn(P, r, ph) { walkBody(P, r, ph); torchArm(P, r, ph); },
  },
  prostrate: {
    frames: 64, loop: false, rate: 1 / 9,
    fn: keyed([[0, keyStand], [0.1, keyKneel], [0.19, keyHandsDown], [0.3, keyFlat], [0.7, keyFlat], [0.81, keyHandsDown], [0.9, keyKneel], [1, keyStand]]),
  },
  bow: {
    frames: 32, loop: false, rate: 1 / 4,
    fn: keyed([[0, keyStand], [0.3, keyBowDown], [0.7, keyBowDown], [1, keyStand]]),
  },
  kneel: {
    frames: 40, loop: false, rate: 1 / 6,
    fn: keyed([[0, keyStand], [0.3, keyKneel], [0.7, keyKneel], [1, keyStand]]),
  },
  sing: {
    frames: 24, loop: true, rate: 0.3,
    fn(P, r, ph) {
      const w = sin(ph * TAU);
      stance(P, r, { px: 0.012 * w, pr: -1.5 * w, sr: 1.4 * w, cr: 1.0 * w, hr: -3 * w, head: 4, neck: -3 });
      for (const [s, sg] of [['r', 1], ['l', -1]]) armHang(P, s, { flex: 14, elbow: 34, add: 2, ftwist: 30 });
      breathe(P, ph * 2, 1.6);
    },
  },
  play_kinnor: {
    frames: 24, loop: true, rate: 0.6, grip: 'fist', hand: 'l',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const w = sin(ph * TAU);
      stance(P, r, { sr: 0.8 * w, hr: 2 * w, head: 5 });
      fist(P, r, 'l', V(-0.17 * k, d.H * 0.66, -0.17 * k), V(0.35, 1, -0.15), V(1, 0, -0.35), { elbow: [0.4, -1, 0.3] });
      const st = 0.5 - 0.5 * cos(ph * TAU * 2);
      openHand(P, 'r', V(-0.02 * k + 0.06 * st * k, d.H * 0.715 - 0.07 * st, -0.235 * k),
        V(-0.3, 0.5, -1), V(-0.7, -0.6, -0.2), { curl: 40, icurl: 18, elbow: [0.6, -0.8, 0.3] });
      breathe(P, ph);
    },
  },
  play_nevel: {
    frames: 24, loop: true, rate: 0.5, grip: 'fist', hand: 'l',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const w = sin(ph * TAU);
      stance(P, r, { sr: 0.8 * w, hr: 2 * w, head: 6, cy: 6 });
      fist(P, r, 'l', V(-0.15 * k, d.H * 0.76, -0.2 * k), V(0.2, 1, -0.1), V(1, 0, -0.5), { elbow: [0.5, -1, 0.4] });
      const st = 0.5 - 0.5 * cos(ph * TAU * 2 + 1);
      openHand(P, 'r', V(0.0 + 0.05 * st * k, d.H * 0.62 + 0.05 * st, -0.25 * k),
        V(-0.3, 0.6, -1), V(-0.8, -0.5, -0.1), { curl: 36, icurl: 16, elbow: [0.6, -0.8, 0.3] });
      breathe(P, ph);
    },
  },
  play_cymbal: { // Ben Arza's single cymbal (pair of plates) — clash at phase 0.5
    frames: 32, loop: true, rate: 0.5, grip: 'pair',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const open = ph < 0.5 ? smooth(0.05, 0.42, ph) * (1 - smooth(0.44, 0.5, ph)) : smooth(0.5, 0.7, ph) * 0.6 * (1 - smooth(0.75, 1, ph));
      const lift = smooth(0.0, 0.4, ph) * (1 - smooth(0.6, 1, ph));
      stance(P, r, { lean: -2 * lift, head: -4, neck: -2 });
      const gap = 0.045 + 0.24 * open;
      const y = d.H * (0.64 + 0.1 * lift), z = -0.33 * k;
      fist(P, r, 'r', V(gap * k, y, z), V(0, 1, -0.15), V(0, 0, -1), { elbow: [0.6, -1, 0.3] });
      fist(P, r, 'l', V(-gap * k, y, z), V(0, 1, -0.15), V(0, 0, -1), { elbow: [0.6, -1, 0.3] });
    },
  },
  blow_trumpet: {
    frames: 16, loop: true, rate: 0.25, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { lean: 2.5, chest: 3, neck: -6, head: 10 });
      const L = lips(r);
      const el = 24 * Math.PI / 180;
      const dir = V(0, sin(el), -cos(el));
      // head pitch moves the lips: approximate by lifting slightly
      const mp = L.clone().add(V(0, 0.012, 0.006));
      fist(P, r, 'r', mp.clone().addScaledVector(dir, 0.1 * k), dir.clone().negate(), V(-1, -0.3, 0), { elbow: [0.35, -1, 0.1] });
      fist(P, r, 'l', mp.clone().addScaledVector(dir, 0.27 * k).add(V(0, -0.012, 0)), dir.clone().negate(), V(1, -0.3, 0), { elbow: [0.35, -1, 0.05] });
      breathe(P, ph, 1.8);
    },
  },
  blow_shofar: {
    frames: 16, loop: true, rate: 0.25, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { lean: 2, neck: -5, head: 9, hy: -4 });
      const mp = lips(r).add(V(0.012, 0.01, 0.0));
      const dir = V(0.42, 0.22, -0.88).normalize();
      // fingers wrap from below so the horn's curve sweeps upward
      fist(P, r, 'r', mp.clone().addScaledVector(dir, 0.085 * k), dir.clone().negate(), V(0.45, 1, 0.25), { elbow: [0.4, -1, 0.1] });
      armHang(P, 'l', { flex: 30, elbow: 70, add: 8, ftwist: 40 });
      breathe(P, ph, 1.8);
    },
  },
  raise_hands: { // Birkat Kohanim in the Mikdash: hands above the head (Tamid 7:2)
    frames: 16, loop: true, rate: 0.2,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { head: 2, neck: -2 });
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        openHand(P, s, V(sg * 0.15 * k, d.H * 1.075, -0.15 * k), V(-sg, 0.15, 0.05), V(sg * 0.08, 1, -0.1),
          { curl: 4, icurl: 2, thumb: 0, spread: 9, elbow: [1, -0.5, 0.2] });
      }
      breathe(P, ph);
    },
  },
  raise_hands_low: { // the Kohen Gadol does not raise his hands above the Tzitz (Sotah 7:6, stam)
    frames: 16, loop: true, rate: 0.2,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { head: 2 });
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        openHand(P, s, V(sg * 0.2 * k, d.H * 0.93, -0.2 * k), V(-sg, 0.15, 0.05), V(sg * 0.1, 1, -0.15),
          { curl: 4, icurl: 2, thumb: 0, spread: 9, elbow: [1, -0.8, 0.2] });
      }
      breathe(P, ph);
    },
  },
  pour: {
    frames: 32, loop: false, rate: 1 / 4, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const up = smooth(0, 0.3, ph) * (1 - smooth(0.78, 1, ph));
      const tilt = smooth(0.32, 0.5, ph) * (1 - smooth(0.66, 0.8, ph));
      stance(P, r, { lean: -6 * up, chest: -4 * up, head: -8 * up });
      const a = tilt * 100 * Math.PI / 180;
      fist(P, r, 'r', V(0.17 * k, d.H * (0.56 + 0.12 * up), -(0.2 + 0.16 * up) * k), V(-sin(a) * 0.9, cos(a), -0.15), V(0, 0, -1), { elbow: [0.7, -1, 0.3] });
      armHang(P, 'l', { flex: 8 + 20 * up, elbow: 20 + 30 * up });
    },
  },
  throw: { // zerikah: the blood thrown from the mizrak at the altar corner
    frames: 32, loop: false, rate: 1 / 2.5, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const back = smooth(0.05, 0.4, ph) * (1 - smooth(0.4, 0.5, ph));
      const fwd = smooth(0.4, 0.52, ph) * (1 - smooth(0.7, 1, ph));
      stance(P, r, { lean: -4 - 8 * fwd + 3 * back, cy: 14 * back - 10 * fwd, py: 6 * back - 4 * fwd, rz: -0.05 * k, lz: 0.06 * k });
      const y = d.H * (0.52 + 0.04 * back + 0.2 * fwd), z = (-0.2 + 0.22 * back - 0.34 * fwd) * k, x = (0.22 + 0.06 * back - 0.06 * fwd) * k;
      fist(P, r, 'r', V(x, y, z), V(-0.15, 1, -0.3 + 0.9 * fwd), V(0, -0.2, -1), { elbow: [0.6, -1, 0.4] });
      armHang(P, 'l', { flex: 10 + 15 * fwd, elbow: 25 });
    },
  },
  sprinkle: { // dip the finger, flick "like one who whips" — bowl in the left hand
    frames: 24, loop: true, rate: 0.7, grip: 'fist', hand: 'l',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { lean: -4, head: -6 });
      fist(P, r, 'l', V(-0.08 * k, d.H * 0.6, -0.25 * k), V(0, 1, -0.2), V(1, 0, -0.4), { elbow: [0.5, -1, 0.4] });
      const dip = 1 - smooth(0.15, 0.4, ph) * (1 - smooth(0.85, 1, ph));
      const flick = smooth(0.4, 0.55, ph) * (1 - smooth(0.6, 0.85, ph));
      openHand(P, 'r', V((-0.02 + 0.12 * (1 - dip)) * k, d.H * (0.63 + 0.06 * (1 - dip) - 0.08 * flick), (-0.27 - 0.12 * flick) * k),
        V(-0.5, 0.2, -1), V(-0.2, -1, -0.6 - flick), { curl: 75, icurl: 5, thumb: 40, elbow: [0.6, -1, 0.3] });
    },
  },
  sleep: { // on the side, knees drawn up (the young kohanim slept on the Moked floor, Tamid 1:1)
    frames: 12, loop: true, rate: 0.08, grip: 'pillow_side',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      P.root(0, d.chest[0] * 0.95, 0, 0, 0, -90);
      P.rot('pelvis', 0, 0, 0);
      P.rot('spine', -8, 0, 0); P.rot('chest', -8, 0, 0); P.rot('neck', -6, 0, -8); P.rot('head', -8, 0, -6);
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        P.rot(`thigh_${s}`, 62 + (s === 'l' ? 8 : 0), 0, 0);
        P.rot(`shin_${s}`, -88, 0, 0);
        P.rot(`foot_${s}`, -25, 0, 0);
      }
      breathe(P, ph * 3, 1.4);
      // the arms rest on the floor in front of him (model space while lying on the right side: +y up off the floor,
      // +x toward the head, −z his front): the lower (right) arm comes forward from under the body, its hand palm down
      // before the face; the upper (left) arm has fallen forward over it, the hand on the floor before the chest. (They
      // were held out at shoulder height — 0.4 m up in the air, the lower one under the floor — and the cover hung
      // from them as a wall round the head.)
      const sR = P.worldPos('uarm_r'), sL = P.worldPos('uarm_l');
      openHand(P, 'r', V(sR.x + 0.13 * k, 0.04 * k, sR.z - 0.25 * k), V(-0.85, 0, -0.5), V(0.5, 0, -0.85),
        { curl: 34, icurl: 26, thumb: 14, elbow: [-0.4, 0.3, -0.6], elbowWorld: true });
      openHand(P, 'l', V(sL.x - 0.05 * k, 0.05 * k, sL.z - 0.36 * k), V(0.6, 0, 0.8), V(0.8, -0.05, -0.6),
        { curl: 30, icurl: 22, thumb: 12, elbow: [0, -1, -0.3], elbowWorld: true });
    },
  },
  lie: { // on the back, the hands resting on the belly and the elbows by the sides: ≈ 0.47 m across the elbows, so
    // the elders fit the 1-amah rovadin (Tamid 1:1) — the arms at the sides made the figure ≈ 0.7 m wide
    frames: 12, loop: true, rate: 0.08, grip: 'pillow_back',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const lift = d.chest[1] + 0.01;
      P.root(0, lift, 0, 90, 0, 0);
      P.rot('neck', -10, 0, 0); P.rot('head', -6, 8, 0);
      // the right knee a little drawn up, its heel on the floor (qa-r1: under the mantle a knee, not a flat slab, tells the
      // eye where the body is)
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        if (s === 'r') { P.rot('thigh_r', 21, 0, 3); P.rot('shin_r', -40, 0, 0); P.rot('foot_r', -5, 0, 2); }
        else { P.rot(`thigh_${s}`, 8, 0, 2 * sg); P.rot(`shin_${s}`, -14, 0, 0); P.rot(`foot_${s}`, -25, 0, 2 * sg); }
      }
      breathe(P, ph * 3, 1.4);
      // model space while lying: +y up off the floor, +z toward the head. The wrists over the flanks on the belly's
      // top, palms down, fingers toward the navel, thumbs toward the chest; the right hand a little higher
      const yB = lift + d.waist[1] + 0.046 * k, zB = r.rest[r.index.spine].y;
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const w = V(sg * 0.118 * k, yB, zB + (s === 'r' ? 0.02 : -0.055) * k);
        openHand(P, s, w, V(-sg * 0.3, 0.05, 0.85), V(-sg * 0.85, -0.38, -0.3), { curl: 30, icurl: 22, thumb: 14, elbow: [0.24, -0.5, 0.8] });
      }
    },
  },
  sit: { // on a seat ≈ 1 amah high; origin = floor point under the seat
    frames: 16, loop: true, rate: 0.1,
    fn(P, r, ph) { keySit(P, r); breathe(P, ph * 2); },
  },
  slaughter: { // shechitah: bent over the animal, knife drawn to and fro (holachah / hava'ah)
    frames: 24, loop: true, rate: 0.8, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { dy: -0.16 * k, pz: 0.12 * k, pp: -30, lean: -24, chest: -12, neck: 2, head: -14, lz: -0.05, rz: 0.08 });
      const s = sin(ph * TAU);
      fist(P, r, 'r', V((0.04 + 0.08 * s) * k, 0.36 * k, -0.52 * k), V(-1, -0.1, -0.15), V(0, -1, 0.1), { elbow: [0.9, -0.2, 0.3] });
      openHand(P, 'l', V(-0.2 * k, 0.32 * k, -0.5 * k), V(0.5, 0, -1), V(0, -1, -0.4), { curl: 50, elbow: [0.9, -0.2, 0.3] });
    },
  },
  sweep: { // raking with the magrefah (two hands on the long handle)
    frames: 24, loop: true, rate: 0.5, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const s = sin(ph * TAU);
      stance(P, r, { lean: -8 - 4 * s, chest: -4, cy: 8, py: 5, head: -12, lz: -0.12, rz: 0.1 });
      const ax = V(-0.28, -0.62, -0.73).normalize();
      const top = V(0.15 * k, d.H * (0.6 + 0.02 * s), (-0.1 - 0.12 * s) * k);
      fist(P, r, 'r', top, ax.clone().negate(), V(-1, 0, 0.3), { elbow: [0.6, -1, 0.3] });
      fist(P, r, 'l', top.clone().addScaledVector(ax, 0.42 * k), ax.clone().negate(), V(1, 0, -0.3), { elbow: [0.6, -1, 0.3] });
    },
  },
  circle_lot: { // the lottery: hand put forward, fingers out (Yoma 2:1 — never the thumb)
    frames: 24, loop: false, rate: 1 / 3, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const up = smooth(0.05, 0.3, ph) * (1 - smooth(0.75, 0.95, ph));
      stance(P, r, { head: -6 * up });
      armHang(P, 'l');
      const y = d.H * (0.52 + 0.17 * up), z = -(0.12 + 0.24 * up) * k;
      P.arm('r', V(0.2 * k - 0.05 * up, y, z), { elbow: [0.5, -1, 0.5] });
      P.aimHand('r', [0, 0.3 + 0.7 * up, -1], [0, -1 + up, -0.3 - up], true);
      P.fingers('r', 85, 85 - 82 * up, 70);
    },
  },
  point: {
    frames: 16, loop: true, rate: 0.12,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { cy: -5, hy: -4 });
      armHang(P, 'l');
      P.arm('r', V(0.3 * k, d.H * 0.86, -0.62 * k), { elbow: [0.5, -1, 0.2] });
      P.aimHand('r', [-0.2, 0.6, -0.4], [0.3, 0.25, -1], true);
      P.fingers('r', 88, 0, 50);
      breathe(P, ph * 2);
    },
  },
};

// ------------------------------------------------------------------------------------------- offering poses
// For the sim's individual offerings and the tamid (docs/decisions/people-realism.md):
//   semichah — the owner leans both hands on the animal's head "with all his strength" (Menachot 9:8; Yoma 36a);
//   hold_legs — the limb-winners hold the bound tamid (Tamid 4:1; Rambam Temidin 1:10 — held by hand);
//   receive — kabbalah: the blood caught in the mizrak under the throat;
//   flay — at the hook, knife in the right hand, the left drawing the hide down (Tamid 4:2);
//   carry_limbs(_walk) — a limb on each open palm as Tamid 4:3 lists them (setProps(right, left));
//   lead(_walk) — leading an animal on a rope (Tamid 3:5 "he draws it"; animal.setLead(actor));
//   wave — tenufah: the portions on the palms moved to and fro, up and down (Menachot 61a);
//   kemitzah — the handful of a meal offering taken with three fingers closed over the palm (Menachot 11a);
//   melikah — the bird held in the left hand, its nape nipped with the right thumbnail (Vayikra 1:15; Zevachim 64b);
//   stoke — turning the limbs on the pyre with the fork (Tamid 1:4; 2:5 — all night);
//   toss — laying a limb onto the fire; salt — salting the limbs on the ramp (Tamid 4:3).
const palmUp = (s) => ({ thumb: V(s === 'r' ? 1 : -1, 0.25, -0.05), fingers: V(s === 'r' ? -0.05 : 0.05, 0.12, -1) });
const palmDown = (s) => ({ thumb: V(s === 'r' ? -1 : 1, 0.1, -0.15), fingers: V(0, -0.35, -1) });

function carryLimbsArms(P, r, ph, lift = 0) {
  const d = r.dims, k = d.H / 1.67;
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    const h = palmUp(s);
    openHand(P, s, V(sg * 0.2 * k, d.H * 0.6 + lift, -0.24 * k), h.thumb, h.fingers, { curl: 28, icurl: 22, thumb: 14, elbow: [0.5, -1, 0.6] });
  }
}

function leadArm(P, r, back) {
  const d = r.dims, k = d.H / 1.67;
  fist(P, r, 'r', V(0.22 * k, d.H * (back ? 0.5 : 0.53), (back ? 0.06 : -0.16) * k), V(0.15, 0.4, back ? 0.9 : -0.9), V(-1, -0.2, 0), { elbow: [0.4, -1, back ? -0.2 : 0.4], curl: 88 });
}

export const OFFERING_CLIPS = {
  semichah: {
    frames: 16, loop: true, rate: 0.25,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const press = 0.5 + 0.5 * sin(ph * TAU);
      stance(P, r, { dy: -0.04 * k, pz: 0.08 * k, pp: -14, lean: -20 - 2 * press, chest: -10, head: -14, lz: -0.06, rz: 0.1 });
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const h = palmDown(s);
        openHand(P, s, V(sg * 0.05 * k, 0.66 - 0.01 * press, -0.5 * k), h.thumb, h.fingers, { curl: 14, icurl: 8, thumb: 6, elbow: [0.8, -0.6, 0.4] });
      }
      breathe(P, ph, 1.4);
    },
  },
  semichah_high: { // on a bull's head
    frames: 16, loop: true, rate: 0.25,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const press = 0.5 + 0.5 * sin(ph * TAU);
      stance(P, r, { lean: -6 - 2 * press, chest: -4, head: -6, lz: -0.08, rz: 0.12 });
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const h = palmDown(s);
        openHand(P, s, V(sg * 0.07 * k, 1.12 - 0.01 * press, -0.46 * k), h.thumb, h.fingers, { curl: 14, icurl: 8, thumb: 6, elbow: [0.9, -0.5, 0.3] });
      }
      breathe(P, ph, 1.4);
    },
  },
  hold_legs: {
    frames: 16, loop: true, rate: 0.3,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      keyKneel(P, r);
      P.rot('spine', -16, 0, 0); P.rot('chest', -14, 0, 0); P.rot('neck', 6, 0, 0); P.rot('head', -16, 0, 0);
      const tug = 0.01 * sin(ph * TAU * 2);
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const h = palmDown(s);
        openHand(P, s, V(sg * 0.1 * k, 0.24 + tug, -0.5 * k), h.thumb, V(0, -0.8, -0.6), { curl: 70, icurl: 66, thumb: 40, elbow: [0.8, -0.3, 0.5] });
      }
    },
  },
  receive: {
    frames: 16, loop: true, rate: 0.3, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const b = 0.005 * sin(ph * TAU);
      stance(P, r, { dy: -0.2 * k, pz: 0.13 * k, pp: -32, lean: -26, chest: -14, neck: 4, head: -18, lz: -0.04, rz: 0.08 });
      fist(P, r, 'r', V(0.02 * k, 0.34 * k + b, -0.52 * k), V(0, 1, -0.1), V(-1, 0, -0.2), { elbow: [0.9, -0.3, 0.3] });
      const h = palmUp('l');
      openHand(P, 'l', V(-0.1 * k, 0.33 * k + b, -0.5 * k), h.thumb, h.fingers, { curl: 30, elbow: [0.9, -0.3, 0.3] });
    },
  },
  flay: {
    frames: 32, loop: true, rate: 0.35, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const cut = sin(ph * TAU), pull = 0.5 + 0.5 * sin(ph * TAU + 1.2);
      stance(P, r, { lean: -6, chest: -4, head: -10 + 4 * cut, lz: -0.06, rz: 0.06, cy: 6 * cut });
      fist(P, r, 'r', V(0.06 * k, d.H * (0.6 - 0.05 * cut), -0.33 * k), V(-0.2, 0.3, -1), V(-1, -0.3, 0), { elbow: [0.7, -1, 0.3] });
      openHand(P, 'l', V(-0.1 * k, d.H * (0.64 - 0.04 * pull), -(0.3 + 0.03 * pull) * k), V(1, 0.2, -0.3), V(0, -0.6, -1), { curl: 62, icurl: 55, thumb: 35, elbow: [0.7, -1, 0.3] });
    },
  },
  carry_limbs: {
    frames: 16, loop: true, rate: 0.2, grip: 'pair', pairGrip: 'palm',
    fn(P, r, ph) { stance(P, r, { lean: 1 }); carryLimbsArms(P, r, ph); breathe(P, ph); },
  },
  carry_limbs_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'pair', pairGrip: 'palm',
    fn(P, r, ph) { walkBody(P, r, ph, { noArms: true }); carryLimbsArms(P, r, ph, 0.006 * cos(2 * TAU * ph)); },
  },
  lead: {
    frames: 16, loop: true, rate: 0.15, grip: 'fist', hand: 'r',
    fn(P, r, ph) { stance(P, r, { cy: -4 }); armHang(P, 'l'); leadArm(P, r, false); breathe(P, ph); },
  },
  lead_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'fist', hand: 'r',
    fn(P, r, ph) { walkBody(P, r, ph); leadArm(P, r, true); },
  },
  wave: {
    frames: 32, loop: true, rate: 0.4, grip: 'pair', pairGrip: 'palm',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      // to and fro (molich u'mevi), then up and down (ma'aleh u'morid)
      const fwd = ph < 0.5 ? sin(ph * 2 * TAU) : 0, up = ph >= 0.5 ? sin((ph - 0.5) * 2 * TAU) : 0;
      stance(P, r, { lean: -3 - 3 * fwd, chest: -2 });
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const h = palmUp(s);
        openHand(P, s, V(sg * 0.13 * k, d.H * (0.62 + 0.05 * up), -(0.3 + 0.09 * fwd) * k), h.thumb, h.fingers, { curl: 24, elbow: [0.6, -1, 0.5] });
      }
    },
  },
  kemitzah: {
    frames: 32, loop: true, rate: 0.3, grip: 'palm', hand: 'l',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const dip = smooth(0.1, 0.35, ph) * (1 - smooth(0.6, 0.85, ph));
      stance(P, r, { lean: -8, chest: -4, head: -16 });
      const h = palmUp('l');
      openHand(P, 'l', V(-0.06 * k, d.H * 0.56, -0.3 * k), h.thumb, h.fingers, { curl: 30, elbow: [0.6, -1, 0.5] });
      const hd = palmDown('r');
      openHand(P, 'r', V(0.02 * k, d.H * (0.66 - 0.05 * dip), -0.31 * k), hd.thumb, V(0, -0.9, -0.4), { curl: 20 + 70 * smooth(0.3, 0.5, ph) * (1 - smooth(0.9, 1, ph)), icurl: 15, thumb: 20, elbow: [0.6, -1, 0.4] });
    },
  },
  melikah: {
    frames: 24, loop: true, rate: 0.3, grip: 'palm', hand: 'l',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const nip = smooth(0.3, 0.45, ph) * (1 - smooth(0.75, 0.9, ph));
      stance(P, r, { lean: -6, chest: -4, head: -14 });
      const h = palmUp('l');
      openHand(P, 'l', V(-0.06 * k, d.H * 0.62, -0.3 * k), h.thumb, h.fingers, { curl: 45, elbow: [0.6, -1, 0.5] });
      openHand(P, 'r', V(0.01 * k, d.H * (0.67 - 0.012 * nip), -0.34 * k), V(-0.4, 0.2, -1), V(0.2, -1, -0.3), { curl: 70, icurl: 45, thumb: 30 + 30 * nip, elbow: [0.6, -1, 0.4] });
    },
  },
  stoke: {
    frames: 24, loop: true, rate: 0.35, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const s = sin(ph * TAU);
      stance(P, r, { lean: -4 - 3 * s, chest: -2, cy: 6, py: 4, head: -8, lz: -0.14, rz: 0.12 });
      const ax = V(-0.12, -0.32, -0.94).normalize();
      const top = V(0.14 * k, d.H * (0.62 + 0.02 * s), (-0.06 - 0.12 * s) * k);
      fist(P, r, 'r', top, ax.clone().negate(), V(-1, 0, 0.2), { elbow: [0.6, -1, 0.3] });
      fist(P, r, 'l', top.clone().addScaledVector(ax, 0.4 * k), ax.clone().negate(), V(1, 0, -0.2), { elbow: [0.6, -1, 0.3] });
    },
  },
  toss: {
    frames: 32, loop: false, rate: 1 / 1.6, grip: 'pair', pairGrip: 'palm',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const up = smooth(0.1, 0.55, ph) * (1 - smooth(0.75, 1, ph));
      stance(P, r, { lean: -4 - 6 * up, chest: -3 * up, head: -6 });
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const h = palmUp(s);
        openHand(P, s, V(sg * 0.15 * k, d.H * (0.6 + 0.16 * up), -(0.24 + 0.22 * up) * k), h.thumb, h.fingers.clone().add(V(0, 0.6 * up, 0)), { curl: 22 - 14 * up, elbow: [0.6, -1, 0.5] });
      }
    },
  },
  salt: {
    frames: 24, loop: true, rate: 0.6, grip: 'palm', hand: 'l',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { lean: -6, head: -10 });
      const h = palmUp('l');
      openHand(P, 'l', V(-0.08 * k, d.H * 0.58, -0.27 * k), h.thumb, h.fingers, { curl: 30, elbow: [0.6, -1, 0.5] });
      const take = 1 - smooth(0.15, 0.4, ph) * (1 - smooth(0.85, 1, ph));
      const fling = smooth(0.45, 0.55, ph) * (1 - smooth(0.6, 0.85, ph));
      openHand(P, 'r', V((-0.03 + 0.12 * (1 - take)) * k, d.H * (0.62 + 0.04 * (1 - take)), (-0.28 - 0.1 * fling) * k),
        V(-0.5, 0.2, -1), V(-0.2, -1, -0.6 - fling), { curl: 70 - 50 * fling, icurl: 60 - 50 * fling, thumb: 40, elbow: [0.6, -1, 0.3] });
    },
  },
};
Object.assign(HUMAN_CLIPS, OFFERING_CLIPS);

// ------------------------------------------------------------------------------------------- night, Moked and service poses
// (docs/decisions/people-3.md) — the stations they assume are given in metres in the figure's frame (faces −z, +x its
// right, origin on the floor between the feet) at scale 1; the sim places the figure so the station meets the fixture
// and gives it setScale(1) (an actor's seeded size scales the pose about its feet — people-4-fix).
//   sit_floor  on the floor, sitting back on the heels, hands on the thighs ("he came and sat beside his brothers",
//              Tamid 1:1)
//   call       the crier, the hands on either side of the mouth like a funnel, chin up (Gevini, Yoma 20b)
//   knock      three raps with the knuckles of the closed right fist on a door 0.47 m ahead, then a pause (Tamid 1:2
//              "the officer knocks")
//   lift_mitre the officer lifts the migba'at off the head of a man 0.5 m ahead (Yoma 25a): reach 0–0.25, grasp at
//              MITRE_GRASP, raise to 0.65, then held at the chest
//   lock       a key turned in a lock at chest height, the door face 0.5 m ahead: turned 90° over 0.15–0.45, held,
//              turned back over 0.65–0.95 (Middot 1:9)
//   staff / staff_walk / strike   the Ish Har HaBayit's staff; "he struck him with his staff" (Middot 1:2): raised by
//              0.35, down by 0.5 so the tip lands on a man lying ≈ 1.32 m ahead (STAFF.strike.tip), held to 0.7, back
//              to the staff stance by 1
//   windlass   both hands hand-over-hand on the pegs of Ben Katin's muchni wheel (Tamid 1:4; Yoma 37a): WINDLASS gives
//              the hub and peg geometry and the wheel angle <-> phase coupling; lowering the kiyor (the south rim, on
//              his right, pulled down). windlass_raise: the same operator mirrored onto the north side of the axle,
//              pulling the north rim down — raising the kiyor (WINDLASS_RAISE)
//   kiddush    stooped, right hand on the right foot and left on the left under the spigot (Zevachim 19b; standing —
//              "sheirut is standing")
//   rinse      rinsing the innards on a marble table 1½ amot high (Tamid 4:2; Rambam BhB 5:14)
//   carry_lamb / carry_lamb_walk  the slaughtered lamb across the forearms, its back to the carrier's chest
//   pour_low   bent to pour (Tamid 7:3 "he bent to pour"; 5:5 the coals emptied into the gold pan): down by 0.28, the
//              vessel tipped forward 78° over 0.32–0.5, held, righted by 0.76, up by 1; the fist ≈ 0.45 m above the
//              floor and 0.5 m ahead at the bottom (grip class 'pour': pans and jugs tip over their front lip)
//   wave_sudar the segan waving the cloth overhead, the arc kept out to his right so the hanging cloth clears his
//              head (Tamid 7:3 "the segan waved the sudarin")
//   carry_log / carry_log_walk  a log or bundle of wood on the right shoulder, the right hand holding its front end
//              (the props gizrin_branch and branch_bundle switch carry_shoulder(_walk) to these — Tamid 2:3)
//   tend_lamp  dressing / lighting a Menorah lamp: the taper's tip at the lamp's mouth ≈ 0.84 m above his feet and
//              0.45 m ahead (on the stone's top step, Tamid 3:9) — taper in the right hand, a second prop (the kuz) left
//   warm       warming the hands at a fire ≈ 0.6 m ahead (Tamid 1:1 "he warmed himself before the fire")
//   bathe      immersion: down into a deep crouch 0–0.3, under 0.3–0.6, up by 0.9 (Tamid 1:1–2; Yoma 3:3)
//   stand_hold / walk_hold  a full vessel by its handle in the right fist (the kaf and its cover, Tamid 7:2): that arm
//              steady and the fingers closed, the vessel level (props choose these through PROPS[name].poses)
export const MITRE_GRASP = 0.33;
// the staff (reconstruction) and its grip below the top; strike.tip: where the staff's tip lands at the blow (figure
// frame, k = 1; scales with the figure) — the top of a man lying on his back ≈ 0.2 m above the floor, 1.32 m ahead
export const STAFF = { len: 1.25, grip: 0.1, strike: { tip: [0.08, 0.2, -1.32], phase: 0.5 } };
/**
 * The muchni wheel as the operator sees it (world/altar/kiyor.js: rim r 1.7 amot, axle 2.6 amot up, 8 pegs on the
 * west face, one at the top when the wheel's rotation.x is 0; rotation.x > 0 = the south rim going down = the kiyor
 * sinking). The operator faces the peg (west) face, heading 90, 1.146 amot west of the wheel plane and 1.5625 amot
 * SOUTH of the axle line: the hub 0.75 m to his left. Each hand pulls a peg from 30° to −15° (0° = right of the hub,
 * 90° up); the wheel turns π/2 per pose cycle. His fists meet the pegs when wheel angle = spin0 + phase·π/2, i.e.
 * phase = phaseAt(angle) = ((angle − spin0) / (π/2)) mod 1 — drive the pose from the wheel (or the wheel from the pose).
 * The hub is in metres at scale 1: give the operator setScale(1) (people-4-fix), as for WINDLASS_RAISE and CRANK.
 */
export const WINDLASS = {
  hub: [-0.75, 1.248, -0.55], radius: 0.816, pegOut: 0.17, pegStep: Math.PI / 4,
  stroke: [30, -15],
  side: 'south', dir: 1, spin0: Math.PI / 12, perCycle: Math.PI / 2,
  stand: { westOfWheel: 1.146, fromAxle: -1.5625, heading: 90 },   // amot (fromAxle: + north, − south)
  phaseAt(angle) { const p = (angle - Math.PI / 12) / (Math.PI / 2); return p - Math.floor(p); },
};
/**
 * windlass_raise: the operator mirrored onto the NORTH side of the axle line (1.5625 amot north, same distance west of
 * the wheel, heading 90): the hub 0.75 m to his right, his hands pull the north rim down, the wheel's angle falls —
 * the kiyor rises (kiyor.userData.raise(f) sets rotation.x = (1 − f)·drop/0.36, so raising turns it negative). Drive
 * the pose from the raising: phase = phaseAt(wheel angle) = ((spin0 − angle) / (π/2)) mod 1.
 */
export const WINDLASS_RAISE = {
  hub: [0.75, 1.248, -0.55], radius: 0.816, pegOut: 0.17, pegStep: Math.PI / 4,
  stroke: [30, -15],                                    // 0° = LEFT of the hub (north), 90° up
  side: 'north', dir: -1, spin0: -Math.PI / 12, perCycle: Math.PI / 2,
  stand: { westOfWheel: 1.146, fromAxle: 1.5625, heading: 90 },
  phaseAt(angle) { const p = (-Math.PI / 12 - angle) / (Math.PI / 2); return p - Math.floor(p); },
};
const D2R = Math.PI / 180;

/** world (model) position of a point given in the head bone's frame */
function headPt(P, x, y, z) { const w = P.world(P.i('head')); return V(x, y, z).applyQuaternion(w.q).add(w.p); }
function headDir(P, x, y, z) { return V(x, y, z).applyQuaternion(P.world(P.i('head')).q); }

function keySitFloor(P, r) {
  const d = r.dims, k = d.H / 1.67;
  // sitting back on the heels: knees on the floor ahead, shins along the floor, the seat resting on the heels
  const thigh = r.rest[r.index.thigh_r].y - r.rest[r.index.shin_r].y;
  const hipY = 0.19 * k;
  const drop = Math.asin(clamp((hipY - 0.06 * k) / thigh, 0, 0.9)) * 180 / Math.PI;   // the thigh slopes down to the knee
  P.off('pelvis', 0, hipY - r.rest[r.index.thigh_r].y, 0.1 * k);
  P.rot('pelvis', 6, 0, 0);
  P.rot('spine', -6, 0, 0); P.rot('chest', -4, 0, 0); P.rot('neck', 6, 0, 0); P.rot('head', -8, 0, 0);
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    P.rot(`thigh_${s}`, 90 - drop - 6, 0, 3 * sg);
    P.rot(`shin_${s}`, -(180 - drop - 6), 0, 0);
    P.rot(`foot_${s}`, -72, 0, 0);
    P.rot(`toe_${s}`, 0, 0, 0);
  }
  // hands resting on the thighs half-way to the knees, the arms hanging close to the body (a mantle stays over them)
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    openHand(P, s, V(sg * 0.13 * k, hipY + 0.07 * k, -0.11 * k), V(-sg * 0.15, 0.25, -1), V(0, -1, -0.45), { curl: 26, icurl: 18, elbow: [0.3, -0.5, 1] });
  }
}

function staffHold(P, r, o = {}) {
  const d = r.dims, k = d.H / 1.67;
  const below = STAFF.len - STAFF.grip;
  // the staff's foot planted 0.44 m ahead; the fist above it on the staff
  const foot = V(0.3 * k, 0, -0.44 * k);
  const top = V(0.25 * k, 0, (o.z ?? -0.16) * k);
  const dz = top.z - foot.z, dx = top.x - foot.x;
  top.y = Math.sqrt(Math.max(0.2, below * below - dz * dz - dx * dx));
  const axis = top.clone().sub(foot).normalize();           // the thumb points up the staff
  return { center: top, thumb: axis, fingers: V(-0.2, 0, -1) };
}

/** the fist at the blow: the staff's tip on STAFF.strike.tip, the fist ≈ 0.46 H up and the staff along the thumb */
function staffHit(r) {
  const d = r.dims, k = d.H / 1.67, below = STAFF.len - STAFF.grip;
  const [tx, ty, tz] = STAFF.strike.tip;
  const T = V(tx * k, ty * k, tz * k);
  const c = V(0.15 * k, d.H * 0.46, 0);
  const dx = c.x - T.x, dy = c.y - T.y;
  c.z = T.z + Math.sqrt(Math.max(0.05, below * below - dx * dx - dy * dy));
  const thumb = c.clone().sub(T).normalize();
  const fingers = V(0, 1, 0).addScaledVector(thumb, -thumb.y).normalize();   // ⟂ the staff, pointing up
  return { center: c, thumb, fingers };
}

/** the right fist on the staff: held planted (o.t = 0), raised (≈ 0.5) or down on the target (1) */
function staffArm(P, r, t) {
  const d = r.dims, k = d.H / 1.67;
  const hold = staffHold(P, r);
  const raised = { center: V(0.27 * k, d.H * 1.03, 0.04 * k), thumb: V(0, -0.55, -0.83), fingers: V(0, 0.83, -0.55) };
  const hit = staffHit(r);
  const lerpK = (a, b, u) => ({ center: a.center.clone().lerp(b.center, u), thumb: a.thumb.clone().lerp(b.thumb, u).normalize(), fingers: a.fingers.clone().lerp(b.fingers, u).normalize() });
  const st = t < 0.5 ? lerpK(hold, raised, smooth(0, 0.5, t)) : lerpK(raised, hit, smooth(0.5, 1, t));
  fist(P, r, 'r', st.center, st.thumb, st.fingers, { elbow: [0.7, -1, 0.3] });
}

/** windlass: the grip point of a peg at angle th (rad) on the operator's side of the wheel (m = −1: mirrored) */
function pegAt(W, th, out = 0, m = 1) {
  const [hx, hy, hz] = W.hub, R = W.radius + 0.02 * out;
  return V(hx + m * R * Math.cos(th), hy + R * Math.sin(th), hz + W.pegOut + 0.09 * out);
}

/**
 * Hand over hand on the pegs (m = 1: south of the axle, the hub on his left, pulling the south rim down; m = −1: the
 * mirror image north of it, pulling the north rim down). The lead hand (right, or left mirrored) pulls a peg through
 * the stroke over phase 0–0.5 while the other returns clear of the pegs, then they swap.
 */
function windlassPose(P, r, ph, W, m) {
  const [a0, a1] = W.stroke.map((x) => x * D2R);
  const lead = m > 0 ? 'r' : 'l', other = m > 0 ? 'l' : 'r';
  let pull = 0;
  const g = {};
  for (const [s, off] of [[lead, 0], [other, 0.5]]) {
    const u = (ph + off) % 1;
    let th, out = 0, curl = 84;
    if (u < 0.5) { const q = u / 0.5; th = lerp(a0, a1, q); pull = Math.max(pull, Math.sin(Math.PI * q)); } else {
      const q = smooth(0, 1, (u - 0.5) / 0.5);
      th = lerp(a1, a0, q); out = Math.sin(Math.PI * q); curl = 84 - 64 * Math.sin(Math.PI * Math.min(1, q * 1.15));
    }
    g[s] = { c: pegAt(W, th, out, m), th, curl, role: s === lead ? 'lead' : 'other' };
  }
  const k = r.dims.H / 1.67;
  const lz = m > 0 ? 0.08 * k : -0.06 * k, rz = m > 0 ? -0.06 * k : 0.08 * k;
  stance(P, r, { dy: -0.03 * k * pull, lean: -4 - 5 * pull, chest: -2 - 2 * pull, cy: 8 * m, py: 5 * m, head: -2, lz, rz, rx: m > 0 ? 0.03 * k : 0, lx: m > 0 ? 0 : -0.03 * k });
  for (const s of ['r', 'l']) {
    const h = g[s];
    // the fist on the peg from outside the rim: fingers outward along the radius, thumb toward the wheel
    fist(P, r, s, h.c, V(0, 0, -1), V(m * Math.cos(h.th), Math.sin(h.th), 0), { elbow: h.role === 'lead' ? [0.8, -1, 0.2] : [0.3, -1, 0.4] });
    P.fingers(s, h.curl, h.curl * 0.92, 35 + 0.3 * (h.curl - 20));
  }
}

/** a load on the right shoulder (carry_log): the right palm up under its front end, ahead of the shoulder */
function logArm(P, r) {
  const k = r.dims.H / 1.67;
  const I = r.index, cw = P.world(I.clav_r);
  // the shoulder anchor of props.js propAttach('shoulder') in the posed clavicle's frame
  const a = V(r.dims.shX * 0.86, r.rest[I.uarm_r].y + 0.072 * k, 0.03 * k).sub(r.rest[I.clav_r]).applyQuaternion(cw.q).add(cw.p);
  const w = a.clone().add(V(0.03 * k, -0.05 * k, -0.19 * k));
  openHand(P, 'r', w, V(-0.9, 0.15, -0.35), V(-0.2, 0.55, -0.8), { curl: 72, icurl: 64, thumb: 34, elbow: [0.25, -1, -0.3] });
}

function keyBatheDown(P, r) {
  const d = r.dims, k = d.H / 1.67;
  const thighY = r.rest[r.index.thigh_r].y;
  P.off('pelvis', 0, 0.27 * k - thighY, 0.17 * k);
  P.rot('pelvis', -30, 0, 0); P.rot('spine', -22, 0, 0); P.rot('chest', -14, 0, 0); P.rot('neck', -10, 0, 0); P.rot('head', -24, 0, 0);
  for (const [s, sg] of [['r', 1], ['l', -1]]) P.leg(s, V(sg * 0.14 * k, d.ankleY + 0.035 * k, 0.02 * k), { pitch: -22, knee: [sg * 0.25, 0.3, -1] });
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    const kn = P.worldPos(`shin_${s}`);
    openHand(P, s, kn.add(V(-sg * 0.03 * k, -0.04 * k, -0.06 * k)), V(-sg * 0.4, 0.2, -0.9), V(0, -1, -0.15), { curl: 40, elbow: [0.6, -0.4, 0.6] });
  }
}
function keyBatheStand(P, r) {
  stance(P, r, { head: -6 });
  // arms drawn in against the cold: hands crossed on the chest
  const d = r.dims, k = d.H / 1.67;
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    openHand(P, s, V(-sg * 0.06 * k, d.H * 0.72, -0.15 * k), V(0, 1, -0.2), V(-sg * 0.9, 0.25, -0.2), { curl: 35, elbow: [0.4, -1, 0.3] });
  }
}

export const SERVICE_CLIPS = {
  sit_floor: {
    frames: 16, loop: true, rate: 0.1,
    fn(P, r, ph) { keySitFloor(P, r); breathe(P, ph * 2); },
  },
  call: {
    frames: 24, loop: true, rate: 0.2,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67, hs = d.headS;
      const shout = smooth(0.06, 0.18, ph) * (1 - smooth(0.72, 0.92, ph));
      stance(P, r, { lean: 2 + 2 * shout, chest: 2 + 3 * shout, neck: -3, head: 6 + 4 * shout });
      breathe(P, ph, 1 + 1.5 * shout);
      // the hands on either side of the mouth, a funnel opening forward: the heels of the hands at the mouth's
      // corners, the palms facing each other (turned only a little forward), fingers forward and level, the
      // little-finger edges down by the chin, the thumb sides up toward the cheekbones (handQ's 'thumb' is the flat
      // hand's thumb side) — seen from the front only the hands' edges frame the mouth. The rig has no jaw bone
      // (36 bones = MAX_BONES): the hands hide the mouth.
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const w = headPt(P, sg * 0.06 * hs, -0.01 * hs, -0.115 * hs);
        const f = V(sg * 0.14, -0.24, -1).normalize();         // level in the world: the head is tilted up
        const t = V(0, 1, 0).addScaledVector(f, -f.y).normalize();
        // the elbows forward and a little out, just above the shoulders (the wrists are only ≈ 9 cm ahead of the shoulder
        // joints, so the elbows cannot drop to the sides)
        openHand(P, s, w, headDir(P, t.x, t.y, t.z), headDir(P, f.x, f.y, f.z), { curl: 28, icurl: 20, thumb: 10, elbow: [1, -0.7, -0.6] });
      }
    },
  },
  knock: {
    frames: 24, loop: true, rate: 0.5, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      let rap = 0;
      for (const c of [0.12, 0.26, 0.4]) rap = Math.max(rap, Math.exp(-(((ph - c) / 0.04) ** 2)));
      stance(P, r, { lean: -1, head: -2, hy: 3 });
      armHang(P, 'l');
      // knuckles forward: the door face 0.47 m ahead; an empty fist — all four fingers rolled tight into the palm (the
      // index as far as the others: half-curled it met the thumb's tip in an 'O', as if round a rod), the thumb folded
      // across the middle phalanges of the index and middle fingers, the proximal knuckles presented to the door
      fist(P, r, 'r', V(0.13 * k, d.H * 0.8, (-0.37 - 0.065 * rap) * k), V(-1, 0.1, 0.1), V(0, 0.15, -1), { elbow: [0.6, -1, 0.2] });
      P.fingers('r', 108, 110, 30);
      P.rot('thb_r', -18, 0, -33);   // the thumb across the middle phalanges (solved against the curled fingers' positions)
      breathe(P, ph);
    },
  },
  lift_mitre: {
    frames: 32, loop: false, rate: 1 / 3.5, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const reach = smooth(0, 0.25, ph);
      const lift = smooth(0.4, 0.62, ph);
      const lower = smooth(0.72, 0.98, ph);
      // the officer turns his shoulders ≈ 15° to his left as he reaches (pelvis, spine and chest share it, the head turns
      // back to the crown): the crown straight ahead then lies to the right of his body's line, so the right arm rises
      // beside his face, not across it
      const turn = reach * (1 - lower);
      stance(P, r, { lean: -6 * reach * (1 - lift) + 3 * lift * (1 - lower), head: 4 * lift - 3, py: 4 * turn, sy: 5 * turn, cy: 6 * turn, hy: -11 * turn, rz: -0.04 * k * turn });
      armHang(P, 'l');
      // the crown of the other man's migba'at 0.5 m ahead, ≈ 1.68 m up
      const rest = V(0.2 * k, d.H * 0.5, -0.06 * k);
      const crown = V(0.05 * k, 1.69, -0.5 * k);
      const high = V(0.24 * k, d.H * 1.08, -0.42 * k);
      const chest = V(0.16 * k, d.H * 0.66, -0.3 * k);
      let c = rest.clone().lerp(crown, reach);
      c.lerp(high, lift);
      c.lerp(chest, lower);
      // palm down onto the crown, fingers forward, thumb in
      fist(P, r, 'r', c, V(-1, 0.05, -0.15), V(0, -0.3, -1), { elbow: [0.6, -1, 0.3] });
      const grip = smooth(0.24, MITRE_GRASP, ph);
      P.fingers('r', lerp(14, 82, grip), lerp(10, 76, grip), lerp(8, 40, grip));
    },
  },
  lock: {
    frames: 24, loop: true, rate: 0.35, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const a = 90 * D2R * smooth(0.15, 0.45, ph) * (1 - smooth(0.65, 0.95, ph));
      stance(P, r, { lean: -3, head: -10, cy: -4 });
      armHang(P, 'l');
      // the key's shaft runs on from the fingers into the lock; the turn rolls the hand about it
      fist(P, r, 'r', V(0.06 * k, d.H * 0.68, -0.31 * k), V(Math.sin(a), Math.cos(a), 0.05), V(0, 0, -1), { elbow: [0.7, -1, 0.4] });
      breathe(P, ph);
    },
  },
  staff: {
    frames: 16, loop: true, rate: 0.12, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      stance(P, r, { hy: 2 * sin(ph * TAU) });
      armHang(P, 'l');
      const h = staffHold(P, r);
      fist(P, r, 'r', h.center, h.thumb, h.fingers, { elbow: [0.6, -1, 0.3] });
      breathe(P, ph * 2);
    },
  },
  staff_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      walkBody(P, r, ph, { noArms: true });
      armHang(P, 'l', { flex: 4 + 10 * cos(TAU * ph) });
      // the staff is planted with the left foot (ph 0.5) and stays put on the ground while the body passes over it,
      // then swings forward clear of the floor
      const below = STAFF.len - STAFF.grip, stride = d.stride;
      const u = (ph + 0.5) % 1;
      let fz, fy;
      if (u < 0.5) { fz = -0.42 * k + u * stride; fy = 0; } else { const s2 = (u - 0.5) / 0.5; fz = -0.42 * k + 0.5 * stride * (1 - smooth(0, 1, s2)); fy = 0.07 * Math.sin(Math.PI * s2); }
      const foot = V(0.3 * k, fy, fz);
      const hz = -0.12 * k + (fz + 0.11 * k) * 0.3;
      const dz = hz - fz, dx = -0.05 * k;
      const top = V(foot.x + dx, fy + Math.sqrt(Math.max(0.2, below * below - dz * dz - dx * dx)), hz);
      fist(P, r, 'r', top, top.clone().sub(foot).normalize(), V(-0.2, 0, -1), { elbow: [0.6, -1, 0.3] });
    },
  },
  strike: {
    frames: 40, loop: false, rate: 1 / 1.6, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const k = r.dims.H / 1.67;
      const up = smooth(0.05, 0.35, ph), down = smooth(0.38, 0.5, ph), back = smooth(0.72, 1, ph);
      const t = back > 0 ? 1 - back : up * 0.5 + down * 0.5;
      const hitW = t > 0.5 ? (t - 0.5) * 2 : 0;
      stance(P, r, { dy: -0.03 * k * hitW, lean: 3 * (t < 0.5 ? t * 2 : 1 - hitW) - 20 * hitW, chest: -8 * hitW, cy: 10 * (t < 0.5 ? t * 2 : 1) - 14 * hitW, head: -14 * hitW, rz: 0.06 * k * hitW, lz: -0.06 * k * hitW });
      armHang(P, 'l', { flex: 10 + 14 * hitW, elbow: 24 });
      if (back > 0) {
        // back to the staff stance: from the strike pose toward the planted hold
        const h = staffHold(P, r);
        const hit = staffHit(r);
        const u = smooth(0, 1, back);
        fist(P, r, 'r', hit.center.lerp(h.center, u), hit.thumb.lerp(h.thumb, u).normalize(), hit.fingers.lerp(h.fingers, u).normalize(), { elbow: [0.7, -1, 0.3] });
      } else staffArm(P, r, t);
    },
  },
  windlass: {
    frames: 32, loop: true, rate: 0.3,
    fn(P, r, ph) { windlassPose(P, r, ph, WINDLASS, 1); },
  },
  windlass_raise: {
    frames: 32, loop: true, rate: 0.3,
    fn(P, r, ph) { windlassPose(P, r, ph, WINDLASS_RAISE, -1); },
  },
  carry_log: {
    frames: 16, loop: true, rate: 0.2, grip: 'shoulder',
    fn(P, r, ph) { stance(P, r, { cr: -2, hr: -4, hy: -3 }); armHang(P, 'l'); logArm(P, r); breathe(P, ph); },
  },
  carry_log_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'shoulder',
    fn(P, r, ph) { walkBody(P, r, ph); P.add('head', 0, -3, -4); logArm(P, r); },
  },
  kiddush: {
    frames: 16, loop: true, rate: 0.35,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const rub = sin(ph * TAU);
      stance(P, r, { noLegs: true, dy: -0.34 * k, pz: 0.2 * k, pp: -56, lean: -30, chest: -16, neck: 26, head: -4 });
      for (const [s, sg] of [['r', 1], ['l', -1]]) P.leg(s, V(sg * 0.12 * k, d.ankleY, 0), { knee: [sg * 0.3, 0, -1] });
      // right hand on the right foot and left on the left (Zevachim 19b): palms on the insteps, fingers toward the toes
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        openHand(P, s, V(sg * 0.118 * k, 0.142 * k + 0.004 * rub * sg, (-0.03 - 0.006 * rub * sg) * k), V(-sg, 0.1, -0.1), V(0, -0.5, -0.86),
          { curl: 16, icurl: 10, thumb: 6, elbow: [0.6, 0.2, 0.8] });
      }
    },
  },
  rinse: {
    frames: 24, loop: true, rate: 0.5,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const rub = sin(ph * TAU);
      stance(P, r, { dy: -0.03 * k, pz: 0.03 * k, pp: -6, lean: -18, chest: -8, head: -16, lz: 0.02 * k, rz: -0.02 * k });
      // the table top 1½ amot (0.72 m) high, its edge ≈ 0.25 m ahead: the hands work the innards on it
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        openHand(P, s, V(sg * 0.12 * k, 0.8 + 0.008 * Math.abs(rub), (-0.4 - 0.05 * rub * sg) * k), V(-sg, 0.05, -0.12), V(sg * 0.1, -0.55, -0.83),
          { curl: 50, icurl: 40, thumb: 30, elbow: [0.7, -0.6, 0.5] });
      }
    },
  },
  carry_lamb: {
    frames: 16, loop: true, rate: 0.2, grip: 'tray',
    fn(P, r, ph) { stance(P, r, { lean: 2, chest: 0, neck: -2, head: -8 }); carryLambArms(P, r, ph); breathe(P, ph); },
  },
  carry_lamb_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'tray',
    fn(P, r, ph) { walkBody(P, r, ph, { noArms: true }); P.add('spine', 4, 0, 0); carryLambArms(P, r, ph, 0.006 * cos(2 * TAU * ph)); },
  },
  pour_low: {
    frames: 40, loop: false, rate: 1 / 5, grip: 'pour', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const down = smooth(0, 0.28, ph) * (1 - smooth(0.78, 1, ph));
      const tilt = smooth(0.32, 0.5, ph) * (1 - smooth(0.62, 0.76, ph));
      stance(P, r, { dy: -0.3 * k * down, pz: 0.18 * k * down, pp: -32 * down, lean: -24 * down, chest: -8 * down, neck: 20 * down, head: -14 * down, rz: -0.06 * k * down, lz: 0.07 * k * down });
      // the right fist from the chest down to ≈ 0.38 m above the floor, 0.5 m ahead; the vessel tips forward over its lip
      const c = V(0.17 * k, d.H * 0.58, -0.3 * k).lerp(V(0.13 * k, 0.44 * k, -0.5 * k), down);
      const a = 78 * D2R * tilt;
      fist(P, r, 'r', c, V(0, -Math.sin(a), -Math.cos(a)), V(0.12, -Math.cos(a), Math.sin(a)), { elbow: [0.7, -0.6, 0.5] });
      // the left hand on the left knee, steadying the bend: the heel of the hand on the thigh just above the knee, palm
      // down on it, fingers over the kneecap
      if (down > 0.05) {
        const kn = P.worldPos('shin_l'), hip = P.worldPos('thigh_l');
        const ax = hip.clone().sub(kn).normalize();                        // along the thigh, toward the hip
        const up = V(0, 1, 0).addScaledVector(ax, -ax.y).normalize();       // the thigh's top
        const f = ax.clone().negate().addScaledVector(up, -0.35).normalize();
        const t = f.clone().cross(up).normalize();                           // left hand: palm = −(t × f) = −up
        const hk = kn.clone().addScaledVector(ax, 0.1 * k).addScaledVector(up, 0.072 * k);
        const free = V(-0.17 * k, d.H * 0.5, -0.05 * k);
        openHand(P, 'l', free.lerp(hk, smooth(0.05, 0.9, down)), t, f, { curl: 34, icurl: 26, thumb: 18, elbow: [0.7, -0.2, 0.5] });
      } else armHang(P, 'l');
    },
  },
  wave_sudar: {
    frames: 24, loop: true, rate: 0.6, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const s = sin(ph * TAU);
      stance(P, r, { lean: 2, head: 5, cy: -4 * s, hr: -2 * s });
      // the left fist low at his side, thumb up, so a second cloth (setProps) hangs down from it
      fist(P, r, 'l', V(-0.21 * k, d.H * 0.5, -0.1 * k), V(0.05, 1, 0.12), V(0.1, 0, -1), { elbow: [0.4, -1, 0.5] });
      // the cloth swung high from over his right shoulder out to the side and back (a signal seen across the court):
      // the fist stays ≥ 0.3 m right of the head and a little forward, so the 0.54 m drape never passes his face
      const c = V((0.42 + 0.12 * s) * k, d.H * (1.1 + 0.025 * cos(2 * ph * TAU)) - 0.03 * k * Math.max(0, s), -0.14 * k);
      fist(P, r, 'r', c, V(-0.3 * s - 0.25, 1, -0.1), V(0.15, 0.1, -1), { elbow: [0.7, -0.5, 0.3] });
    },
  },
  tend_lamp: {
    frames: 24, loop: true, rate: 0.3, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const w = ph * TAU;
      stance(P, r, { lean: -16, chest: -5, neck: -4, head: -16, lz: 0.03 * k, rz: -0.03 * k });
      // the taper's tip at the lamp's mouth ≈ 0.84 m above his feet and 0.45 m ahead: small working movements there
      const tdir = V(-0.12, -0.5, -0.86).normalize();
      const tip = V((0.02 + 0.015 * sin(w)) * k, (0.84 + 0.01 * cos(w)) * k, -0.45 * k);
      fist(P, r, 'r', tip.addScaledVector(tdir, -0.25), tdir, V(-0.9, 0.1, 0.2), { elbow: [0.7, -0.8, 0.3] });
      // the left hand holds the kuz (setProps) at the waist
      fist(P, r, 'l', V(-0.15 * k, d.H * 0.56, -0.24 * k), V(0, 1, -0.1), V(0.2, 0, -1), { elbow: [0.5, -1, 0.4] });
      breathe(P, ph);
    },
  },
  warm: {
    frames: 24, loop: true, rate: 0.15,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const rub = Math.max(0, sin(ph * TAU)) ** 2;
      stance(P, r, { lean: -4, head: -10, dy: -0.01 });
      // palms to the fire, now and then rubbed together
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const x = lerp(0.13, 0.035, rub) * sg * k;
        openHand(P, s, V(x, d.H * 0.57, -0.32 * k), V(-sg, 0.05 + 0.3 * rub, 0), V(-sg * 0.1 * rub, 0.6 - 0.3 * rub, -0.8), { curl: 14, icurl: 8, thumb: 10, elbow: [0.6, -0.7, 0.4] });
      }
      breathe(P, ph * 2);
    },
  },
  bathe: {
    frames: 40, loop: false, rate: 1 / 5,
    fn: keyed([[0, keyBatheStand], [0.3, keyBatheDown], [0.6, keyBatheDown], [0.9, keyBatheStand], [1, keyBatheStand]]),
  },
  // a full vessel held by its handle in the right hand (the kaf and its cover, Tamid 7:2): that hand closed on the
  // handle and the arm carried steady, so the vessel stays level (the prop's fist grip is set for this hang); props
  // choose these for stand / walk through PROPS[name].poses
  stand_hold: {
    frames: 24, loop: true, rate: 0.125, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const w = sin(ph * TAU);
      stance(P, r, { px: 0.009 * w, pr: -1.1 * w, sr: 0.7 * w, cr: 0.5 * w, hy: 2.2 * sin(ph * TAU + 1.3), hr: 0.8 * w });
      armHang(P, 'l'); armHang(P, 'r', HOLD_ARM);
      breathe(P, ph * 2);
    },
  },
  walk_hold: {
    frames: 32, loop: true, stride: 'stride', grip: 'fist', hand: 'r',
    fn(P, r, ph) { walkBody(P, r, ph); armHang(P, 'r', { ...HOLD_ARM, flex: 4 + 1.5 * cos(TAU * ph) }); },
  },
};
// the steady arm of stand_hold / walk_hold: the stand's hang (the vessel grips are levelled for it), fingers closed
const HOLD_ARM = { curl: 84, icurl: 80, thumb: 42 };

function carryLambArms(P, r, ph, lift = 0) {
  const d = r.dims, k = d.H / 1.67;
  // cradled: the elbows at the sides bent ≈ 90°, the forearms run forward under the barrel (the right under the rump,
  // the left under the chest), sloping a little down to the hands, palms up, fingers curled round the far flank; the
  // lamb's back lies against his belly (a 25–30 kg yearling is not held out on straight arms)
  const y = d.H * 0.54 + lift;
  openHand(P, 'r', V(0.155 * k, y, -0.2 * k), V(0.75, 0.2, -0.6), V(-0.45, 0.1, -0.9), { curl: 50, icurl: 42, thumb: 18, elbow: [0.35, -1, 0.55] });
  openHand(P, 'l', V(-0.155 * k, y + 0.01, -0.2 * k), V(-0.75, 0.2, -0.6), V(0.45, 0.1, -0.9), { curl: 50, icurl: 42, thumb: 18, elbow: [0.35, -1, 0.55] });
}
// ------------------------------------------------------------------------------------------- pose variants (qa-r1)
// A crowd or a row of kohanim in one pose must not be clones: some poses are baked in a few variants ('<pose>~k'), and
// each figure keeps one (system.js variantOf: an actor by its seed, a crowd member by its own offset). CLIP_VARIANTS
// lists how many there are beside the base clip. The variants are small, natural differences of stance and gesture —
// how a man stands at rest, how far apart he lifts his hands — never a different act.
export const CLIP_VARIANTS = { stand: 3, raise_hands: 3 };

/** a variant of 'stand': weight on one leg (the other foot a little forward and out), the head turned and tilted, arms
 *  a touch bent or hanging further back; o: { w (weight shift −1…1), foot: [x, z], head: [pitch, yaw, roll], arm } */
function standVariant(o) {
  return {
    frames: 24, loop: true, rate: o.rate ?? 0.12,
    fn(P, r, ph) {
      const k = r.dims.H / 1.67, w = sin(ph * TAU), sh = o.w;
      const fx = o.foot[0] * k, fz = o.foot[1] * k;
      // the leg that does not bear the weight steps a little forward and out (its side is −sign(w))
      const side = sh > 0 ? { lx: -fx, lz: fz } : { rx: fx, rz: fz };
      stance(P, r, {
        px: 0.022 * sh * k + 0.007 * w, pr: -3.2 * sh - 0.9 * w, sr: 1.6 * sh + 0.6 * w, cr: 0.8 * sh + 0.4 * w,
        head: o.head[0], hy: o.head[1] + 2.4 * sin(ph * TAU + 1.3), hr: o.head[2] + 0.8 * w, neck: o.neck ?? 2.5, ...side,
      });
      armHang(P, 'l', o.arm?.l || {}); armHang(P, 'r', o.arm?.r || {});
      breathe(P, ph * 2);
    },
  };
}
HUMAN_CLIPS['stand~1'] = standVariant({ w: 1, foot: [0.025, -0.07], head: [-1, 9, 2.5], arm: { r: { elbow: 16, flex: 6 } } });
HUMAN_CLIPS['stand~2'] = standVariant({ w: -0.8, foot: [0.03, -0.05], head: [3.5, -11, -1.5], neck: 4, arm: { l: { elbow: 22, flex: 2, ftwist: 30 } } });
HUMAN_CLIPS['stand~3'] = standVariant({ w: 0.35, foot: [0.04, 0.03], head: [-4.5, 4, -2.5], neck: 0.5, rate: 0.1, arm: { l: { flex: -2, elbow: 14 }, r: { flex: -3, elbow: 12 } } });

/** a variant of 'raise_hands' (Birkat Kohanim in the Mikdash, hands above the head — Tamid 7:2): o = { x, y, z (the
 *  wrists: half spread, height in H, forward), spread (fingers), out (palms turned outward), head [pitch, yaw, roll],
 *  lift (the right hand a little higher than the left) } */
function raiseVariant(o) {
  return {
    frames: 16, loop: true, rate: 0.2,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      stance(P, r, { head: o.head[0], neck: -2, hy: o.head[1], hr: o.head[2] });
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const lift = sg > 0 ? o.lift : -o.lift;
        openHand(P, s, V(sg * o.x * k, d.H * (o.y + lift), -o.z * k), V(-sg, 0.15, 0.05 + o.out), V(sg * (0.08 + o.out * 0.5), 1, -0.1),
          { curl: o.curl ?? 4, icurl: 2, thumb: o.thumb ?? 0, spread: o.spread, elbow: [1, -0.5, 0.2] });
      }
      breathe(P, ph);
    },
  };
}
SERVICE_CLIPS['raise_hands~1'] = raiseVariant({ x: 0.19, y: 1.06, z: 0.19, spread: 13, out: 0.12, head: [5, 3, 2], lift: 0.006, thumb: 6 });
SERVICE_CLIPS['raise_hands~2'] = raiseVariant({ x: 0.125, y: 1.09, z: 0.12, spread: 6, out: -0.05, head: [-3, -2, -1.5], lift: -0.008, curl: 8 });
SERVICE_CLIPS['raise_hands~3'] = raiseVariant({ x: 0.165, y: 1.08, z: 0.17, spread: 11, out: 0.2, head: [1, 5, 0], lift: 0.012, thumb: 3 });

Object.assign(HUMAN_CLIPS, SERVICE_CLIPS);

// ------------------------------------------------------------------------------------------- people-4 poses
// (docs/decisions/people-4.md) — figure frame as above: metres, −z ahead, +x his right, origin on the floor.
//   eat         a piece raised to the mouth and bitten, lowered, chewed (the showbread eaten standing in the court,
//               Rambam MK 10:3; Sukkah 5:8): rest 0–0.1, up by 0.3, at the mouth 0.3–0.46 (the bite pulls away at
//               ≈ 0.42), down by 0.64, chewing to 1. Right hand, grip 'palm' (bread_piece), the left arm at rest
//   knead       kneading dough in a trough or on a table whose working surface is KNEAD.surface high, KNEAD.reach
//               ahead: the heels of both hands push the dough forward and down (0–0.45), fold it back (0.45–0.75),
//               press (0.75–1) — the meal offerings and the showbread (Menachot 5:1–2; Beit Garmu, Yoma 38a)
//   crank       hand over hand on the hand-spokes of the Golah wheel (Middot 5:4; courts/chambers.js golah): CRANK
//               gives the hub, the spokes' grip radius and the wheel angle <-> phase coupling (the wheel turns
//               π/2 per cycle, a spoke a half cycle)
//   wave_under  tenufah: the kohen's palms up beneath the owner's hands, moving with them (Menachot 61b "the kohen
//               puts his hand beneath the owner's and waves"; Rambam MK 9:6). The owner faces him WAVE_UNDER.partner
//               metres away in 'wave' (or 'wave' with the bikkurim basket — wave_basket); give both the SAME phase
//   wave_basket the owner holding the bikkurim basket by its rims and waving it (Bikkurim 3:6 "he holds it by its
//               rims and the kohen puts his hand beneath it and waves it"): the basket's bottom follows the path of
//               the palms in 'wave', so the kohen's wave_under meets it. The basket chooses it for 'wave'
//               (PROPS.basket.poses); grip class 'rims'
//   carry_slain / carry_slain_walk  a slaughtered lamb or kid across the shoulders behind the neck, its legs held
//               before the chest (the right fist the hind legs, the left the fore legs); the slain carcasses choose
//               these for carry_shoulder(_walk) (grip 'shoulder')
/** the working surface the knead pose assumes (m): its top KNEAD.surface above the floor, the dough KNEAD.reach ahead
 *  (at scale 1: give the kneader setScale(1), or scale the surface with him); the 'dough' prop lies there */
export const KNEAD = { surface: 0.78, reach: 0.42 };
/** the eat pose: the bite at the lips at phase ≈ 0.36–0.42 */
export const EAT = { bite: [0.3, 0.46], reach: 0.062 };   // reach: the piece's edge beyond the fist's centre (m)
/** a loose fist holding a piece between thumb and fingers (the eat clip) */
function openFist(P, r, c, thumb, fingers) { fist(P, r, 'r', c, thumb, fingers, { elbow: [0.35, -1, 0.2], curl: 64, icurl: 56, thumb: 34 }); }
/**
 * The Golah wheel seen by its operator (courts/chambers.js golah: hand-wheel r 2.1 amot on an axle 5.2 amot above the
 * chamber floor, 8 hand-spokes out to r 2.65; the axle along site X, the wheel in the YZ plane at X = cistern + 2.1).
 * The operator stands east of the wheel, facing it (heading 270), stand.eastOfWheel amot from its plane and
 * stand.fromAxle amot from the axle line (− = south: the hub up to his right). A spoke at wheel angle φ (rotation.x of
 * 'wheel:azarah.chamber.golah' + i·π/4; φ = 0 straight up, growing toward the south = his left) is at
 * hub + radius·(−sin φ, cos φ, 0) in his frame. Each hand pulls a spoke from stroke[0] to stroke[1] (degrees of φ, the
 * spokes on his side going down: the angle grows — the direction chambers-daily turns it to raise the bucket) over half
 * a cycle while the other returns; phase = phaseAt(rotation) = ((rotation − spin0) / perCycle) mod 1.
 * The hub is in metres at scale 1: give the operator setScale(1) (a levi's seeded ±5 % moves his fists 7–9 cm).
 */
export const CRANK = (() => {
  const A = AMAH;
  const st = { eastOfWheel: 0.84, fromAxle: -1.85, heading: 270 };
  const stroke = [126, 171];
  const spin0 = ((stroke[0] % 45) * Math.PI) / 180;
  return {
    hub: [-st.fromAxle * A, 5.2 * A, -st.eastOfWheel * A], radius: 2.42 * A, spokes: 8, stroke, spin0, perCycle: Math.PI / 2,
    stand: st,
    phaseAt(angle) { const p = (angle - spin0) / (Math.PI / 2); return p - Math.floor(p); },
  };
})();
/** tenufah together (wave + wave_under, the same phase): the owner and the kohen face each other partner metres apart
 *  (origin to origin, ≈ 1.55 amot); the kohen's palms drop metres below the owner's hands (under their backs).
 *  Made at scale 1: the two must share ONE scale s — kohen.setScale(owner.scale) and partner·s apart, or both
 *  setScale(1) — else his palms land in or a hand's breadth below the owner's (±5 % seeded sizes: up to ±11 cm) */
export const WAVE_UNDER = { partner: 0.74, drop: 0.036 };
/** the owner's palms in 'wave' (owner frame): wrist, and the palm's centre on it */
function waveHands(r, ph) {
  const d = r.dims, k = d.H / 1.67;
  const fwd = ph < 0.5 ? sin(ph * 2 * TAU) : 0, up = ph >= 0.5 ? sin((ph - 0.5) * 2 * TAU) : 0;
  const out = {};
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    const w = V(sg * 0.13 * k, d.H * (0.62 + 0.05 * up), -(0.3 + 0.09 * fwd) * k);
    const f = palmUp(s).fingers.clone().normalize();
    out[s] = { w, c: w.clone().addScaledVector(f, 0.075 * k) };
  }
  return { fwd, up, ...out };
}
/** the bikkurim basket held by its rims (wave_basket): the right fist's orientation (thumb along the rim, forward;
 *  fingers in and down over it) — props.js seats the basket's 'rims' grip with it */
export const RIMS_HAND = { thumb: V(0, 0.05, -1), fingers: V(-1, -0.7, 0), rimR: 0.196, rimY: 0.16, out: 0.006 };

/** the slain lamb across the shoulders: the fists before the chest (figure frame, k = 1) — props.js aims the legs here */
export const SLAIN_HANDS = { r: [0.105, 0.74, -0.16], l: [-0.105, 0.745, -0.16] };   // y in units of H
function slainArms(P, r, lift = 0) {
  const d = r.dims, k = d.H / 1.67;
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    const [x, y, z] = SLAIN_HANDS[s];
    // a vertical grip on the legs held against the chest: palm toward the chest, thumb up
    fist(P, r, s, V(x * k, d.H * y + lift, z * k), V(0, 1, 0.3), V(-sg, 0, -0.25), { elbow: [0.5, -1, 0.2], curl: 88 });
  }
}

function stackArms(P, r, lift = 0) {
  const d = r.dims, k = d.H / 1.67;
  for (const [s, sg] of [['r', 1], ['l', -1]]) {
    const h = palmUp(s);
    openHand(P, s, V(sg * 0.15 * k, d.H * 0.56 + lift, -0.34 * k), h.thumb, h.fingers, { curl: 26, icurl: 20, thumb: 14, elbow: [0.5, -1, 0.7] });
  }
}

export const PEOPLE4_CLIPS = {
  eat: {
    frames: 32, loop: true, rate: 0.2, grip: 'fist', hand: 'r',
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67, hs = d.headS;
      const up = smooth(0.1, 0.3, ph) * (1 - smooth(0.46, 0.64, ph));
      const bite = smooth(0.36, 0.42, ph) * (1 - smooth(0.44, 0.5, ph));
      // chewing: small nods of the head (the rig has no jaw bone)
      const chew = ph > 0.44 ? Math.max(0, sin((ph - 0.44) * TAU * 6)) * (1 - smooth(0.92, 1, ph)) : 0;
      stance(P, r, { lean: -1.5 * up, neck: 3 * up, head: -6 * up + 1.6 * chew - 2.5 * bite, hy: 2.5 * sin(ph * TAU) * (1 - up), hr: -2 * up });
      breathe(P, ph);
      armHang(P, 'l', { flex: 6, elbow: 14 });
      // the lips' front (head bone frame) after the stance
      const M = headPt(P, 0.004 * hs, 0.012 * hs, -0.112 * hs);
      // the piece held between the thumb and the curled fingers, its broken edge out of the top of the fist (the fist's
      // axis, props.js bread_piece 'fist'): at rest before the belly, the axis up; at the mouth the axis tipped back to
      // the lips, the knuckles forward, the edge between the lips; the bite pulls it a little down and away
      const t0 = V(0.05, 1, -0.1).normalize(), f0 = V(-0.35, 0, -1).normalize();
      const t1 = V(-0.12, 0.72, 0.68).normalize(), f1 = V(-0.4, 0.25, -0.85).normalize();
      const c0 = V(0.11 * k, d.H * 0.575, -0.23 * k);
      const c1 = M.clone().addScaledVector(t1, -EAT.reach * k).add(V(0.006, -0.008 * bite, -0.012 - 0.018 * bite));
      openFist(P, r, c0.lerp(c1, up), t0.lerp(t1, up).normalize(), f0.lerp(f1, up).normalize());
    },
  },
  knead: {
    frames: 24, loop: true, rate: 0.5,
    fn(P, r, ph) {
      const d = r.dims, k = d.H / 1.67;
      const push = smooth(0.02, 0.42, ph) * (1 - smooth(0.46, 0.72, ph));   // forward and down with the heels
      const fold = smooth(0.46, 0.6, ph) * (1 - smooth(0.68, 0.8, ph));     // the fingers draw the far edge back
      const press = smooth(0.78, 0.9, ph) * (1 - smooth(0.94, 1, ph));
      stance(P, r, { dy: -0.02 * k, pz: 0.03 * k, pp: -8, lean: -14 - 8 * push, chest: -6 - 3 * push, head: -16, lz: 0.03 * k, rz: -0.03 * k });
      const top = KNEAD.surface, z0 = -KNEAD.reach * k;
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const h = palmDown(s);
        const w = V(sg * (0.1 - 0.015 * push) * k, top + 0.06 - 0.028 * push - 0.018 * press + 0.025 * fold, z0 + (0.08 - 0.13 * push + 0.04 * fold) * k);
        openHand(P, s, w, h.thumb, V(-sg * 0.08, -0.5 - 0.35 * fold, -1), { curl: 18 + 62 * fold, icurl: 14 + 58 * fold, thumb: 16 + 20 * fold, elbow: [0.7, -0.7, 0.4] });
      }
      breathe(P, ph);
    },
  },
  crank: {
    frames: 32, loop: true, rate: 0.25,
    fn(P, r, ph) {
      const W = CRANK, [hx, hy, hz] = W.hub, R = W.radius;
      const [a0, a1] = W.stroke.map((x) => x * D2R);
      const k = r.dims.H / 1.67;
      const g = {};
      let pull = 0, lowL = 0, lowR = 0;
      // the left hand leads the stroke over phase 0–0.5, the right over 0.5–1; the hand not pulling goes back up clear
      // of the spokes (off them toward him) to the next one
      for (const [s, off] of [['l', 0], ['r', 0.5]]) {
        const u = (ph + off) % 1;
        let a, out = 0, curl = 86;
        if (u < 0.5) { const q = u / 0.5; a = lerp(a0, a1, q); pull = Math.max(pull, Math.sin(Math.PI * q)); if (s === 'r') lowR = q; else lowL = q; } else {
          const q = smooth(0, 1, (u - 0.5) / 0.5);
          a = lerp(a1, a0, q); out = Math.sin(Math.PI * q); curl = 86 - 60 * Math.sin(Math.PI * Math.min(1, q * 1.15));
        }
        const rad = V(-Math.sin(a), Math.cos(a), 0);                    // hub → spoke, in his frame
        const c = V(hx, hy, hz).addScaledVector(rad, R + 0.03 * out).add(V(0, 0, 0.045 + 0.1 * out));
        g[s] = { c, rad, curl };
      }
      // he leans in and his body follows the pulling hand down toward the stroke's lower end on his right (the hub is up
      // to his right): the hips shift right, the shoulders turn right and drop on that side; most for the left hand,
      // which has to cross his body
      // (continuous over the cycle: the shift for the left hand's stroke eases back across the hand-over at 0.5)
      void lowL; void lowR;
      const low = smooth(0.02, 0.30, ph) * (1 - smooth(0.44, 0.56, ph)) + 0.35 * smooth(0.62, 0.95, ph) * (1 - smooth(0.95, 1, ph));
      stance(P, r, { px: 0.07 * k * low, dy: -0.03 * k * pull, lean: -8 - 5 * pull, chest: -3, pr: -3 * low, sr: -4 * low, cr: -6 * low, cy: -8 - 18 * low, sy: -6 * low, py: -4 - 4 * low, head: 4 - 6 * pull, hy: -4 + 10 * low, lz: -0.05 * k, rz: 0.06 * k, rx: 0.03 * k });
      for (const s of ['l', 'r']) {
        const h = g[s];
        // the fist round the spoke: its axis along the spoke (the thumb toward the hub), the fingers over it from in front
        fist(P, r, s, h.c, h.rad.clone().negate(), V(0, -0.15, -1), { elbow: s === 'l' ? [0.6, -1, 0.1] : [0.5, -1, 0.3] });
        P.fingers(s, h.curl, h.curl * 0.92, 30 + 0.3 * (h.curl - 20));
      }
    },
  },
  wave_under: {
    frames: 32, loop: true, rate: 0.4,
    fn(P, r, ph) {
      const k = r.dims.H / 1.67;
      const o = waveHands(r, ph);
      const D = WAVE_UNDER.partner;
      // he leans back a little as the owner's hands come toward him, follows them out again
      stance(P, r, { lean: -4 + 2.5 * o.fwd, chest: -2, head: -10 });
      for (const [s, so] of [['r', 'l'], ['l', 'r']]) {        // the owner's left hand is on his right
        const c = o[so].c;
        // the owner's palm centre in his frame (facing each other), dropped under the back of the owner's hand
        const pc = V(-c.x, c.y - WAVE_UNDER.drop, -D - c.z);
        const h = palmUp(s);
        const f = h.fingers.clone().normalize();
        openHand(P, s, pc.addScaledVector(f, -0.075 * k), h.thumb, h.fingers, { curl: 22, icurl: 16, thumb: 12, elbow: [0.6, -1, 0.5] });
      }
      breathe(P, ph);
    },
  },
  wave_basket: {
    frames: 32, loop: true, rate: 0.4, grip: 'rims', hand: 'r',
    fn(P, r, ph) {
      const k = r.dims.H / 1.67;
      const o = waveHands(r, ph);
      stance(P, r, { lean: -3 - 3 * o.fwd, chest: -2 });
      // the basket's bottom where the palms would be in 'wave', a little lower (the kohen's palms meet it there)
      const bottom = o.r.c.clone().lerp(o.l.c, 0.5).add(V(0, -0.02 * k, 0));
      const RH = RIMS_HAND;
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        const c = bottom.clone().add(V(sg * (RH.rimR + RH.out), RH.rimY, 0));
        fist(P, r, s, c, RH.thumb, V(sg * RH.fingers.x, RH.fingers.y, RH.fingers.z), { elbow: [0.8, -1, 0.3], curl: 78 });
      }
    },
  },
  // the showbread's stack (props.js showbread_stack / showbread_half choose these for carry / carry_walk): held out on
  // the forearms, palms up under its floor, leaning back a little against the weight, the head turned to see past it
  carry_stack: {
    frames: 16, loop: true, rate: 0.2, grip: 'tray',
    fn(P, r, ph) { stance(P, r, { lean: 3, chest: 1, hy: 9, head: -3 }); stackArms(P, r); breathe(P, ph); },
  },
  carry_stack_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'tray',
    fn(P, r, ph) { walkBody(P, r, ph, { noArms: true }); P.add('spine', 3, 0, 0); P.add('head', -3, 9, 0); stackArms(P, r, 0.005 * cos(2 * TAU * ph)); },
  },
  carry_slain: {
    frames: 16, loop: true, rate: 0.2, grip: 'shoulder',
    fn(P, r, ph) { stance(P, r, { lean: -4, chest: -2, neck: 8, head: -4 }); slainArms(P, r); breathe(P, ph); },
  },
  carry_slain_walk: {
    frames: 32, loop: true, stride: 'stride', grip: 'shoulder',
    fn(P, r, ph) { walkBody(P, r, ph, { noArms: true }); P.add('spine', -4, 0, 0); P.add('neck', 8, 0, 0); P.add('head', -4, 0, 0); slainArms(P, r, 0.006 * cos(2 * TAU * ph)); },
  },
};
Object.assign(SERVICE_CLIPS, PEOPLE4_CLIPS);
Object.assign(HUMAN_CLIPS, PEOPLE4_CLIPS);

// name aliases for the sim's convenience
export const CLIP_ALIASES = {
  stand_still: 'stand', prostration: 'prostrate', kneel_down: 'kneel', lot: 'circle_lot', sleeping: 'sleep',
  kabbalah: 'receive', tenufah: 'wave', hefshet: 'flay', carry_limb: 'carry_limbs', led: 'walk_led', bind: 'bound',
  sit_ground: 'sit_floor', crier: 'call', muchni: 'windlass', sanctify: 'kiddush', nesech: 'pour_low',
  signal: 'wave_sudar', dress_lamp: 'tend_lamp', light_lamp: 'tend_lamp', immerse: 'bathe', tevilah: 'bathe',
  muchni_raise: 'windlass_raise', carry_wood: 'carry_log', carry_wood_walk: 'carry_log_walk',
  achilah: 'eat', lash: 'knead', galgal: 'crank', tenufah_under: 'wave_under', wave_beneath: 'wave_under',
};
// service clips baked for every human rig (the rest only for the men's rigs that serve — SERVICE_RIGS)
export const SERVICE_RIGS = new Set(['man', 'elder']);
export const SERVICE_ANY = new Set(['sit_floor', 'warm', 'eat']);
export { handQ, fist };

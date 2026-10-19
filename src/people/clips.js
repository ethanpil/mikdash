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
import { TAU, smooth, clamp } from './util.js';

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
  P.arm(s, wrist, { elbow: o.elbow, handQ: handQ(thumb, fingers) });
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
        P.rot(`uarm_${s}`, 70 + (s === 'r' ? 20 : 0), 0, (s === 'r' ? 20 : -5) * sg);
        P.rot(`farm_${s}`, s === 'r' ? 100 : 40, 0, 0);
        P.fingers(s, 30, 25, 15);
      }
      breathe(P, ph * 3, 1.4);
    },
  },
  lie: { // on the back
    frames: 12, loop: true, rate: 0.08, grip: 'pillow_back',
    fn(P, r, ph) {
      const d = r.dims;
      P.root(0, d.chest[1] + 0.01, 0, 90, 0, 0);
      P.rot('neck', -10, 0, 0); P.rot('head', -6, 8, 0);
      for (const [s, sg] of [['r', 1], ['l', -1]]) {
        P.rot(`uarm_${s}`, 0, 0, 6 * sg); P.rot(`farm_${s}`, 18, 0, 0); P.fingers(s, 30, 25, 15);
        P.rot(`thigh_${s}`, 8, 0, 4 * sg); P.rot(`shin_${s}`, -14, 0, 0); P.rot(`foot_${s}`, -25, 0, 0);
      }
      breathe(P, ph * 3, 1.4);
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

// name aliases for the sim's convenience
export const CLIP_ALIASES = {
  stand_still: 'stand', prostration: 'prostrate', kneel_down: 'kneel', lot: 'circle_lot', sleeping: 'sleep',
  kabbalah: 'receive', tenufah: 'wave', hefshet: 'flay', carry_limb: 'carry_limbs', led: 'walk_led', bind: 'bound',
};
export { handQ, fist };

// Skeleton definitions. Every bone's REST rotation is the identity (bone frames are aligned with the figure
// frame), so a rig is just a parent table + rest joint positions. The figure faces -z, +x is its right,
// +y up, origin on the ground between the feet (meters).
//
// Human body types are proportioned from the anthropometry of an adult (fractions of stature H) and of
// children (larger head fraction, shorter legs). Statures are reconstruction (docs/decisions/people.md).
import { Vector3 } from 'three';

export const MAX_BONES = 32; // texture block width = MAX_BONES * 3 texels

export const HUMAN_BONES = [
  'root', 'pelvis', 'spine', 'chest', 'neck', 'head',
  'clav_l', 'uarm_l', 'farm_l', 'hand_l', 'fing_l', 'idx_l', 'thb_l',
  'clav_r', 'uarm_r', 'farm_r', 'hand_r', 'fing_r', 'idx_r', 'thb_r',
  'thigh_l', 'shin_l', 'foot_l', 'toe_l', 'thigh_r', 'shin_r', 'foot_r', 'toe_r',
  'fing2_l', 'idx2_l', 'fing2_r', 'idx2_r',
];
const HUMAN_PARENT = {
  pelvis: 'root', spine: 'pelvis', chest: 'spine', neck: 'chest', head: 'neck',
  clav_l: 'chest', uarm_l: 'clav_l', farm_l: 'uarm_l', hand_l: 'farm_l', fing_l: 'hand_l', idx_l: 'hand_l', thb_l: 'hand_l',
  clav_r: 'chest', uarm_r: 'clav_r', farm_r: 'uarm_r', hand_r: 'farm_r', fing_r: 'hand_r', idx_r: 'hand_r', thb_r: 'hand_r',
  thigh_l: 'pelvis', shin_l: 'thigh_l', foot_l: 'shin_l', toe_l: 'foot_l',
  thigh_r: 'pelvis', shin_r: 'thigh_r', foot_r: 'shin_r', toe_r: 'foot_r',
  fing2_l: 'fing_l', idx2_l: 'idx_l', fing2_r: 'fing_r', idx2_r: 'idx_r',
};

// Fractions of stature. adult ≈ classical canon; child/boy have proportionally larger heads, shorter legs.
const FRAC = {
  adult: { ankle: 0.044, knee: 0.285, hip: 0.525, pelvis: 0.56, spine: 0.615, chest: 0.70, neck: 0.825,
    head: 0.884, shY: 0.812, uarm: 0.182, farm: 0.150, hand: 0.108, palm: 0.058, foot: 0.152, headH: 0.13 },
  boy: { ankle: 0.045, knee: 0.28, hip: 0.515, pelvis: 0.55, spine: 0.605, chest: 0.69, neck: 0.815,
    head: 0.872, shY: 0.80, uarm: 0.180, farm: 0.148, hand: 0.106, palm: 0.057, foot: 0.152, headH: 0.145 },
  child: { ankle: 0.046, knee: 0.272, hip: 0.495, pelvis: 0.53, spine: 0.585, chest: 0.67, neck: 0.795,
    head: 0.848, shY: 0.78, uarm: 0.175, farm: 0.145, hand: 0.104, palm: 0.056, foot: 0.155, headH: 0.172 },
};

// girths as fractions of H: [rx, rz] half-widths (x = side to side, z = front to back)
export const BODY_TYPES = {
  man: { H: 1.67, frac: 'adult', sex: 'm', shX: 0.113, hipX: 0.052, chest: [0.098, 0.066], waist: [0.086, 0.061], hips: [0.094, 0.068], neckR: 0.031 },
  elder: { H: 1.64, frac: 'adult', sex: 'm', shX: 0.111, hipX: 0.052, chest: [0.099, 0.068], waist: [0.092, 0.068], hips: [0.095, 0.069], neckR: 0.031, style: 'elder' },
  woman: { H: 1.55, frac: 'adult', sex: 'f', shX: 0.104, hipX: 0.060, chest: [0.092, 0.068], waist: [0.078, 0.057], hips: [0.106, 0.074], neckR: 0.028 },
  boy: { H: 1.45, frac: 'boy', sex: 'm', shX: 0.108, hipX: 0.053, chest: [0.090, 0.060], waist: [0.081, 0.057], hips: [0.088, 0.062], neckR: 0.029, young: true },
  child: { H: 1.18, frac: 'child', sex: 'm', shX: 0.105, hipX: 0.055, chest: [0.092, 0.066], waist: [0.090, 0.066], hips: [0.091, 0.066], neckR: 0.029, young: true },
};

const ARM_SPLAY = 9 * Math.PI / 180; // A-pose: arms 9° out from vertical

function finish(kind, names, parents, rest, extra) {
  const index = Object.fromEntries(names.map((n, i) => [n, i]));
  const parent = names.map((n) => (parents[n] ? index[parents[n]] : -1));
  const local = rest.map((p, i) => (parent[i] < 0 ? p.clone() : p.clone().sub(rest[parent[i]])));
  return { kind, names, index, parent, rest, local, n: names.length, ...extra };
}

/** Human rig for a body type key of BODY_TYPES. */
export function humanRig(type = 'man') {
  const B = BODY_TYPES[type] || BODY_TYPES.man;
  const H = B.H, f = FRAC[B.frac];
  const rest = HUMAN_BONES.map(() => new Vector3());
  const set = (n, x, y, z) => rest[HUMAN_BONES.indexOf(n)].set(x, y, z);
  const shX = B.shX * H, hipX = B.hipX * H;
  set('root', 0, 0, 0);
  set('pelvis', 0, f.pelvis * H, 0.0);
  set('spine', 0, f.spine * H, 0.006);
  set('chest', 0, f.chest * H, 0.004);
  set('neck', 0, f.neck * H, 0.016);
  set('head', 0, f.head * H, 0.008);
  const sa = Math.sin(ARM_SPLAY), ca = Math.cos(ARM_SPLAY);
  for (const [s, sg] of [['l', -1], ['r', 1]]) {
    const shY = f.shY * H;
    set(`clav_${s}`, sg * 0.022 * H / 1.67, shY - 0.012, 0.0);
    const sx = sg * shX, sz = 0.012;
    set(`uarm_${s}`, sx, shY, sz);
    const ua = f.uarm * H, fa = f.farm * H, palm = f.palm * H;
    const ex = sx + sg * sa * ua, ey = shY - ca * ua;
    set(`farm_${s}`, ex, ey, sz + 0.004);
    const wx = ex + sg * sa * fa, wy = ey - ca * fa;
    set(`hand_${s}`, wx, wy, sz + 0.004);
    const kx = wx + sg * sa * palm, ky = wy - ca * palm;
    set(`fing_${s}`, kx, ky, sz + 0.012);
    set(`idx_${s}`, kx - sg * 0.004, ky + 0.004, sz - 0.022 * H / 1.67);
    const fl = 0.046 * H / 1.67;
    set(`fing2_${s}`, kx + sg * sa * fl, ky - ca * fl, sz + 0.012);
    set(`idx2_${s}`, kx - sg * 0.004 + sg * sa * fl * 0.92, ky + 0.004 - ca * fl * 0.92, sz - 0.022 * H / 1.67);
    set(`thb_${s}`, wx - sg * 0.012 * H / 1.67, wy - 0.022 * H / 1.67, sz - 0.022 * H / 1.67);
    const hx = sg * hipX;
    set(`thigh_${s}`, hx, f.hip * H, 0.0);
    set(`shin_${s}`, hx * 1.0, f.knee * H, -0.004);
    set(`foot_${s}`, hx * 0.98, f.ankle * H, 0.012);
    set(`toe_${s}`, hx * 0.98 + sg * 0.004, 0.016, 0.012 - (f.foot * 0.62) * H);
  }
  const dims = {
    H, type, sex: B.sex, young: !!B.young, style: B.style || null,
    shX, hipX,
    chest: [B.chest[0] * H, B.chest[1] * H], waist: [B.waist[0] * H, B.waist[1] * H], hips: [B.hips[0] * H, B.hips[1] * H],
    neckR: B.neckR * H,
    headH: f.headH * H, headS: (f.headH * H) / 0.217,
    footLen: f.foot * H, heel: 0.032 * H / 1.67 + 0.0,
    handS: (f.hand * H) / 0.18,
    ankleY: f.ankle * H, kneeY: f.knee * H, hipY: f.hip * H,
    // walking stride (two steps, m) — reconstruction: dignified pace ≈ 0.74 H
    stride: 0.74 * H, runStride: 1.45 * H,
  };
  return finish('human', HUMAN_BONES, HUMAN_PARENT, rest, { dims, type });
}

// ---------------------------------------------------------------------------------------------- quadrupeds
export const QUAD_BONES = [
  'root', 'pelvis', 'spine', 'chest', 'neck', 'neck2', 'head', 'ear_l', 'ear_r', 'tail', 'tail2',
  'fl_up', 'fl_lo', 'fl_ft', 'fr_up', 'fr_lo', 'fr_ft', 'hl_up', 'hl_lo', 'hl_ft', 'hr_up', 'hr_lo', 'hr_ft', 'jaw',
];
const QUAD_PARENT = {
  pelvis: 'root', spine: 'pelvis', chest: 'spine', neck: 'chest', neck2: 'neck', head: 'neck2',
  ear_l: 'head', ear_r: 'head', jaw: 'head', tail: 'pelvis', tail2: 'tail',
  fl_up: 'chest', fl_lo: 'fl_up', fl_ft: 'fl_lo', fr_up: 'chest', fr_lo: 'fr_up', fr_ft: 'fr_lo',
  hl_up: 'pelvis', hl_lo: 'hl_up', hl_ft: 'hl_lo', hr_up: 'pelvis', hr_lo: 'hr_up', hr_ft: 'hr_lo',
};

// withers height H, body length L (point of shoulder → point of buttock), half body width W, head length, neck
export const QUAD_TYPES = {
  lamb: { H: 0.64, L: 0.74, W: 0.18, head: 0.22, neck: 0.20, legW: 0.05, stride: 0.62, up: 0.7 },
  ram: { H: 0.78, L: 0.90, W: 0.22, head: 0.27, neck: 0.24, legW: 0.06, stride: 0.75, up: 0.65 },
  goat: { H: 0.70, L: 0.80, W: 0.15, head: 0.24, neck: 0.25, legW: 0.055, stride: 0.72, up: 0.85 },
  bull: { H: 1.35, L: 1.70, W: 0.33, head: 0.48, neck: 0.36, legW: 0.1, stride: 1.40, up: 0.15 },
};

export function quadRig(type = 'lamb') {
  const Q = QUAD_TYPES[type] || QUAD_TYPES.lamb;
  const { H, L, W } = Q;
  const rest = QUAD_BONES.map(() => new Vector3());
  const set = (n, x, y, z) => rest[QUAD_BONES.indexOf(n)].set(x, y, z);
  const zf = -L / 2, zr = L / 2;
  const backY = H * 0.97;          // top line
  const hipY = H * 0.86;           // hip joint
  const shY = H * 0.80;            // shoulder joint
  set('root', 0, 0, 0);
  set('pelvis', 0, hipY, zr - 0.06 * L);
  set('spine', 0, backY * 0.93, 0.05 * L);
  set('chest', 0, shY + 0.05 * H, zf + 0.18 * L);
  // neck carriage: sheep/goats hold the head up, cattle carry it low and forward
  const up = Q.up ?? 0.7, fw = Math.sqrt(1 - up * up);
  const n0 = new Vector3(0, shY + 0.1 * H, zf - 0.02 * L);
  const nd = new Vector3(0, up, -fw - 0.2).normalize();
  const hp = n0.clone().addScaledVector(nd, Q.neck);
  set('neck', n0.x, n0.y, n0.z);
  set('neck2', 0, n0.y + nd.y * Q.neck * 0.55, n0.z + nd.z * Q.neck * 0.55);
  set('head', hp.x, hp.y, hp.z);
  set('jaw', 0, hp.y - 0.02, hp.z - 0.04);
  set('ear_l', -Q.head * 0.22, hp.y + Q.head * 0.12, hp.z + 0.01);
  set('ear_r', Q.head * 0.22, hp.y + Q.head * 0.12, hp.z + 0.01);
  set('tail', 0, hipY + 0.04 * H, zr + 0.02 * L);
  set('tail2', 0, hipY - 0.10 * H, zr + 0.06 * L);
  for (const [s, sg] of [['l', -1], ['r', 1]]) {
    const lx = sg * (W - Q.legW * 0.6);
    set(`f${s}_up`, lx, shY, zf + 0.12 * L);
    set(`f${s}_lo`, lx, shY * 0.52, zf + 0.10 * L);
    set(`f${s}_ft`, lx, 0.07 * H, zf + 0.11 * L);
    set(`h${s}_up`, lx, hipY, zr - 0.06 * L);
    set(`h${s}_lo`, lx, hipY * 0.42, zr + 0.02 * L);
    set(`h${s}_ft`, lx, 0.07 * H, zr - 0.01 * L);
  }
  const dims = { ...Q, type, zf, zr, backY, hipY, shY };
  return finish('quad', QUAD_BONES, QUAD_PARENT, rest, { dims, type });
}

// ---------------------------------------------------------------------------------------------- dove
export const BIRD_BONES = ['root', 'body', 'neck', 'head', 'tail', 'wing_l', 'wing_l2', 'wing_r', 'wing_r2', 'leg_l', 'leg_r'];
const BIRD_PARENT = { body: 'root', neck: 'body', head: 'neck', tail: 'body', wing_l: 'body', wing_l2: 'wing_l', wing_r: 'body', wing_r2: 'wing_r', leg_l: 'body', leg_r: 'body' };

export function birdRig() {
  const rest = BIRD_BONES.map(() => new Vector3());
  const set = (n, x, y, z) => rest[BIRD_BONES.indexOf(n)].set(x, y, z);
  set('root', 0, 0, 0);
  set('body', 0, 0.085, 0.0);
  set('neck', 0, 0.12, -0.06);
  set('head', 0, 0.165, -0.075);
  set('tail', 0, 0.09, 0.07);
  set('wing_l', -0.035, 0.115, -0.03);
  set('wing_l2', -0.035, 0.11, 0.05);
  set('wing_r', 0.035, 0.115, -0.03);
  set('wing_r2', 0.035, 0.11, 0.05);
  set('leg_l', -0.018, 0.055, -0.005);
  set('leg_r', 0.018, 0.055, -0.005);
  return finish('bird', BIRD_BONES, BIRD_PARENT, rest, { dims: { type: 'dove', H: 0.2, stride: 0.12 }, type: 'dove' });
}

const _cache = new Map();
/** Cached rig by key: human types ('man','woman','elder','boy','child'), quad types, or 'dove'. */
export function getRig(key) {
  if (_cache.has(key)) return _cache.get(key);
  let r;
  if (BODY_TYPES[key]) r = humanRig(key);
  else if (QUAD_TYPES[key]) r = quadRig(key);
  else if (key === 'dove') r = birdRig();
  else throw new Error(`[people] unknown rig ${key}`);
  r.key = key;
  _cache.set(key, r);
  return r;
}

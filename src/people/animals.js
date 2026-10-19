// Procedural animals for the offerings: the tamid lamb (male yearling sheep, white fleece, with the broad
// fat tail — the alyah offered with the right hind leg, Tamid 4:3 / Vayikra 3:9), ram (curled horns), goat
// (black, long drooping ears, swept-back horns, beard), bull (red-brown, short horns, dewlap, low hump) and the
// dove (turtle-dove / pigeon).
// LOD0: a lofted head (brow, eye sockets and glossy eyes, nostrils, mouth line, a jaw that chews), jointed legs
// (forearm/gaskin, knee/hock, cannon, fetlock, pastern) on cloven hooves, clumped fleece. LOD1: the same parts
// with fewer segments.
import { Vector3, Matrix4 } from 'three';
import { MeshBuilder, envelope, normW, CLS, PAT } from './builder.js';
import { smooth, lerp, clamp } from './util.js';

const V = (x, y, z) => new Vector3(x, y, z);
const R = (rig, n) => rig.rest[rig.index[n]];
const sgL = (lod, a, b) => (lod === 0 ? a : b);
const g2 = (x, y, sx, sy) => Math.exp(-((x / sx) ** 2) - ((y / sy) ** 2));

// a small deterministic value noise for geometry (fleece clumps)
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}

function tubeAlong(B, pts, radii, seg, opts = {}) {
  const n = pts.length;
  const rings = pts.map((c, j) => {
    const dir = (j < n - 1 ? pts[j + 1].clone().sub(c) : c.clone().sub(pts[j - 1])).normalize();
    if (j > 0 && j < n - 1) dir.add(c.clone().sub(pts[j - 1]).normalize()).normalize();
    const ref = Math.abs(dir.z) > 0.9 ? V(0, 1, 0) : V(0, 0, 1);
    const az = ref.clone().addScaledVector(dir, -ref.dot(dir)).normalize();
    const ax = new Vector3().crossVectors(az, dir);
    const r = radii[j];
    return { c, rx: Array.isArray(r) ? r[0] : r, rz: Array.isArray(r) ? r[1] : r, ax, az };
  });
  return B.tube(rings, { seg, ...opts });
}

// per-kind head shape: [t along the head, half-width, half-height, centre drop] (× head half-width hw)
const HEADS = {
  sheep: [[0, 0.5, 0.5, 0], [0.1, 0.9, 0.84, 0], [0.28, 0.96, 0.92, 0.03], [0.5, 0.72, 0.8, 0.1], [0.72, 0.56, 0.68, 0.16], [0.88, 0.5, 0.6, 0.2], [1, 0.36, 0.42, 0.22]],
  goat: [[0, 0.5, 0.5, 0], [0.1, 0.9, 0.86, 0], [0.3, 0.92, 0.9, 0.04], [0.52, 0.66, 0.76, 0.12], [0.74, 0.5, 0.64, 0.18], [0.9, 0.44, 0.54, 0.22], [1, 0.3, 0.36, 0.24]],
  bull: [[0, 0.68, 0.62, 0], [0.12, 1.02, 0.9, 0], [0.3, 0.98, 0.82, 0.05], [0.52, 0.82, 0.7, 0.12], [0.72, 0.74, 0.66, 0.16], [0.88, 0.8, 0.62, 0.2], [1, 0.62, 0.46, 0.22]],
};

function quad(B, rig, lod, kind) {
  const d = rig.dims, H = d.H, L = d.L, W = d.W;
  const sheep = kind === 'sheep', goat = kind === 'goat', bull = kind === 'bull';
  const fleece = sheep;
  const bodyCls = { cls: CLS.GA, pat: fleece ? PAT.FLEECE : PAT.COAT, rough: fleece ? 0.95 : 0.65, metal: 0, color: [1, 1, 1], grp: 0 };
  const skinCls = { cls: CLS.GB, pat: sheep ? PAT.SKIN : PAT.COAT, rough: 0.7, metal: 0, color: [1, 1, 1], grp: 0 };
  const W_body = (p) => envelope(rig, p, { pelvis: 1, spine: 1, chest: 1, neck: 0.4, fl_up: 0.2, fr_up: 0.2, hl_up: 0.25, hr_up: 0.25, tail: 0.15 }, 3);
  // fleece: locks as soft clumps on the surface (geometry), the crimp in the shader
  const clump = fleece && lod === 0 ? (th, j) => 1 + 0.03 * (vnoise(th * 3.1, j * 1.1) - 0.45) + 0.015 * (vnoise(th * 7.1, j * 2.3) - 0.5) : null;
  // ---- body barrel (rear → front)
  B.set(bodyCls);
  const N = sgL(lod, 16, 7);
  const zA = d.zr + 0.1 * L, zB = d.zf - 0.08 * L;
  const rings = [];
  for (let j = 0; j <= N; j++) {
    const t = j / N; // 0 rear, 1 front
    const z = lerp(zA, zB, t);
    const end = Math.min(t, 1 - t);
    const taper = smooth(0, 0.16, end);
    // top line; the bull carries a low hump over the withers
    const top = H * (0.965 - 0.02 * Math.sin(Math.PI * t) + (bull ? 0.07 * smooth(0.55, 0.78, t) * (1 - smooth(0.82, 0.97, t)) : 0));
    // belly line: tucked-up flank at the rear, deep brisket in front
    const bot = H * (bull ? 0.5 : 0.47) + H * 0.1 * (1 - smooth(0.0, 0.35, t)) - H * (bull ? 0.05 : 0.02) * smooth(0.55, 0.85, t) + H * 0.06 * smooth(0.88, 1, t);
    const mid = (top + bot) / 2, ry = (top - bot) / 2;
    const wf = W * (0.98 + (fleece ? 0.08 : 0)) * (bull && t > 0.6 ? 1.06 : 1) * (1 + 0.05 * smooth(0.1, 0.3, t) * (1 - smooth(0.4, 0.55, t)));
    rings.push({ c: V(0, mid - ry * (1 - taper) * 0.15, z), rx: Math.max(0.02, wf * (0.35 + 0.65 * taper)), rz: Math.max(0.02, ry * (0.42 + 0.58 * taper)), ax: V(1, 0, 0), az: V(0, 1, 0) });
  }
  B.tube(rings, {
    seg: sgL(lod, 26, 12), weights: W_body, capA: 'dome', capB: 'dome', domeH: 0.5,
    radial: clump || (!fleece && lod === 0 ? (th, j) => 1 + 0.025 * Math.max(0, -Math.sin(th)) * Math.sin(j * 0.9) : null),
  });
  // ---- neck
  const ch = R(rig, 'chest'), nk = R(rig, 'neck'), n2 = R(rig, 'neck2'), hd = R(rig, 'head');
  const nr = bull ? 0.24 : sheep ? 0.1 * H / 0.64 : 0.065 * H / 0.7;
  tubeAlong(B, [V(0, ch.y - 0.06 * H, d.zf + 0.08 * L), nk.clone().add(V(0, -0.03 * H, 0)), n2.clone(), hd.clone().add(V(0, -0.01, 0.02))],
    [[nr * 1.05, nr * 1.15], [nr, nr * 1.1], [nr * 0.8, nr * 0.9], [nr * 0.62, nr * 0.7]], sgL(lod, 16, 8),
    { weights: (p) => envelope(rig, p, { chest: 1, neck: 1, neck2: 1, head: 0.6 }, 4), radial: clump });
  if (bull) { // dewlap: a fold of skin hanging from the throat to the brisket
    B.set(skinCls);
    B.ellipsoid(n2.clone().add(V(0, -0.21, 0.04)), [0.045, 0.17, 0.2], {
      nu: sgL(lod, 12, 6), nv: sgL(lod, 7, 4), weights: (p) => envelope(rig, p, { neck: 1, neck2: 1, chest: 0.5 }, 4),
      deform: (l) => { l.x *= 1 - 0.5 * smooth(0, -0.17, l.y); return l; },
    });
  }
  head(B, rig, lod, kind, bodyCls, skinCls);
  // ---- legs
  for (const leg of ['fl', 'fr', 'hl', 'hr']) legMesh(B, rig, lod, leg, kind, bodyCls, skinCls);
  // ---- tail
  const tl = R(rig, 'tail'), t2 = R(rig, 'tail2');
  const tb = rig.index.tail, t2b = rig.index.tail2;
  B.set(bodyCls);
  if (sheep) { // the broad fat tail (alyah)
    const k = H / 0.64;
    B.ellipsoid(tl.clone().lerp(t2, 0.75).add(V(0, -0.03 * k, 0.045 * k)), [0.095 * k, 0.13 * k, 0.07 * k], {
      nu: sgL(lod, 16, 8), nv: sgL(lod, 10, 5),
      deform: (l) => { l.x *= 1 + 0.25 * smooth(0.05, -0.12 * k, l.y); l.z *= 1 - 0.3 * smooth(0, 0.07 * k, l.z) * smooth(0.05 * k, -0.1 * k, l.y); return l; },
      weights: (p) => normW([[tb, 1], [t2b, smooth(tl.y, t2.y, p.y)], [rig.index.pelvis, 0.3]]),
    });
  } else if (goat) {
    tubeAlong(B, [tl.clone(), tl.clone().add(V(0, 0.05, 0.03)), tl.clone().add(V(0, 0.08, 0.05))], [0.022, 0.016, 0.006], 6, { bone: tb, capB: 'flat' });
  } else {
    tubeAlong(B, [tl.clone(), t2.clone(), t2.clone().add(V(0, -0.45, 0.02))], [0.03, 0.022, 0.015], 6, { weights: (p) => normW([[tb, 1], [t2b, smooth(tl.y, t2.y - 0.2, p.y) * 2]]) });
    B.set({ ...bodyCls, color: [0.4, 0.4, 0.4] });
    B.ellipsoid(t2.clone().add(V(0, -0.5, 0.02)), [0.035, 0.08, 0.035], { nu: 6, nv: 4, bone: t2b });
  }
}

/** a lofted head: poll → brow → face → muzzle, eye sockets and eyes, nostrils, mouth line, ears, horns */
function head(B, rig, lod, kind, bodyCls, skinCls) {
  const d = rig.dims, H = d.H;
  const sheep = kind === 'sheep', goat = kind === 'goat', bull = kind === 'bull';
  const hd = R(rig, 'head');
  const hl = d.head;
  const pitch = bull ? -1.0 : goat ? -0.75 : -0.85;
  const fwd = V(0, Math.sin(pitch), -Math.cos(pitch));       // along the face, toward the nose
  const up = V(0, Math.cos(pitch), Math.sin(pitch));         // forehead side
  const hw = bull ? 0.13 : sheep ? 0.058 * H / 0.64 : 0.05;
  const hb = rig.index.head, jb = rig.index.jaw;
  const P0 = hd.clone().addScaledVector(up, hw * 0.25).addScaledVector(fwd, -hw * 0.55);
  const len = hl * (bull ? 0.88 : sheep ? 0.92 : 1.0);
  const prof = HEADS[kind] || HEADS.sheep;
  const rows = lod === 0 ? prof : [prof[0], prof[2], prof[4], prof[6]];
  const eyeT = 0.3;
  const rings = rows.map(([t, w, h, drop]) => ({
    c: P0.clone().addScaledVector(fwd, t * len).addScaledVector(up, -drop * hw), rx: w * hw, rz: h * hw, ax: V(1, 0, 0), az: up.clone(), t,
  }));
  // sheep and goats: the face and lower legs are short-haired skin; the bull's head is coat
  B.set(bull ? bodyCls : { ...skinCls, pat: sheep ? PAT.SKIN : PAT.COAT });
  const W = (p) => {
    const q = p.clone().sub(P0);
    const t = q.dot(fwd) / len, v = q.dot(up) / hw;
    const jw = jb != null ? 0.85 * smooth(0.45, 0.75, t) * smooth(-0.05, -0.35, v + 0.12) : 0;
    return jw > 0.02 ? normW([[hb, 1 - jw], [jb, jw]]) : [[hb, 1]];
  };
  B.tube(rings, {
    seg: sgL(lod, 22, 10), weights: W, capA: 'dome', capB: 'dome', domeH: bull ? 0.45 : 0.6,
    radial: lod === 0 ? (th, j, Rg) => {
      const t = Rg.t, s = Math.sin(th), c = Math.cos(th);
      // eye sockets under a brow ridge; cheek / jaw fullness below; a Roman-nosed top line for the sheep
      const sock = -0.07 * g2(Math.abs(c) - 0.82, s - 0.32, 0.22, 0.25) * g2(t - eyeT, 0, 0.09, 1);
      const brow = 0.05 * g2(Math.abs(c) - 0.7, s - 0.62, 0.3, 0.2) * g2(t - eyeT + 0.05, 0, 0.08, 1);
      const cheek = 0.06 * Math.max(0, -s) * g2(t - 0.4, 0, 0.16, 1);
      const roman = sheep ? 0.05 * Math.max(0, s) ** 3 * g2(t - 0.6, 0, 0.2, 1) : 0;
      return 1 + sock + brow + cheek + roman;
    } : null,
    shade: (th, j, p) => {
      const q = p.clone().sub(P0);
      const t = q.dot(fwd) / len, v = q.dot(up) / hw, x = q.x / hw;
      if (t < 0.75) return 1;
      const nos = 0.75 * g2(Math.abs(x) - 0.2, v + 0.14, 0.08, 0.08) * smooth(0.9, 1.0, t);           // nostrils
      const mouth = 0.55 * g2(v + 0.32 + 0.1 * (t - 0.85), 0, 0.04, 1) * smooth(0.72, 0.85, t) * (Math.abs(x) > 0.15 ? 1 : 0.7);
      const muzzle = 0.18 * smooth(0.85, 1, t);
      return 1 - Math.min(0.85, nos + mouth + muzzle);
    },
  });
  // eyes: dark and glossy, set in the sockets
  if (lod < 2) {
    B.set({ cls: CLS.FIX, pat: PAT.GEM, rough: 0.05, metal: 0, color: '#1b1511', grp: 0 });
    const er = hw * (bull ? 0.11 : 0.13);
    for (const sg of [-1, 1]) {
      const r0 = rings[lod === 0 ? 2 : 1];
      const c = r0.c.clone().addScaledVector(fwd, (eyeT - r0.t) * len).add(V(sg * r0.rx * 0.86, 0, 0)).addScaledVector(up, r0.rz * 0.3);
      B.ellipsoid(c, [er * 0.8, er, er * 1.1], { nu: sgL(lod, 10, 6), nv: sgL(lod, 6, 4), bone: hb, xf: new Matrix4().makeRotationY(sg * 0.5) });
    }
  }
  // ears: leaf-shaped, cupped; sheep and the Levantine black goat carry them out and down, the bull level
  B.set({ ...(bull ? bodyCls : skinCls), pat: bull || goat ? PAT.COAT : PAT.SKIN });
  for (const s of ['l', 'r']) {
    const e = R(rig, `ear_${s}`), sg = s === 'l' ? -1 : 1;
    const el = bull ? 0.13 : goat ? 0.14 : 0.07 * H / 0.64;
    const droop = goat ? 1.25 : sheep ? 0.8 : 0.15;
    const m = new Matrix4().makeRotationZ(sg * (Math.PI / 2 - droop * 0.9)).multiply(new Matrix4().makeRotationX(0.25));
    B.ellipsoid(e.clone().add(V(sg * el * 0.42, -el * 0.35 * droop, 0.01)), [el * 0.16, el * 0.55, el * 0.27], {
      nu: sgL(lod, 10, 5), nv: sgL(lod, 6, 4), bone: rig.index[`ear_${s}`], xf: m,
      deform: (l) => { l.x += 0.6 * el * 0.16 * (1 - (l.z / (el * 0.27)) ** 2) * smooth(-el * 0.5, el * 0.2, l.y); return l; }, // cupped
      shade: (l) => (l.x * sg < 0 ? 0.8 : 1),
    });
  }
  // horns
  const cran = rings[lod === 0 ? 1 : 1].c;
  if (d.type === 'ram' || goat || bull) {
    B.set({ cls: CLS.FIX, pat: PAT.HORN, rough: 0.5, metal: 0, color: goat ? '#3a3330' : '#b9a27e', grp: 0 });
    for (const sg of [-1, 1]) {
      const pts = [], rad = [];
      const n = sgL(lod, 18, 8);
      const base = cran.clone().addScaledVector(up, hw * 0.7).add(V(sg * hw * 0.5, 0, 0));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        let p;
        if (d.type === 'ram') {
          const a = t * Math.PI * 1.7, Rr = 0.075 * (1 - 0.25 * t);
          p = base.clone().add(V(sg * (0.02 + 0.06 * t), Rr * Math.sin(a) * 0.9, Rr * (1 - Math.cos(a)) * 0.95 - 0.02 * t));
          p.y -= 0.09 * t;
          rad.push(lerp(0.028, 0.006, t));
        } else if (goat) {
          p = base.clone().add(V(sg * 0.03 * t, 0.16 * t - 0.05 * t * t, 0.16 * t * t + 0.03 * t));
          rad.push(lerp(0.018, 0.003, t));
        } else {
          p = base.clone().add(V(sg * 0.16 * t, 0.07 * t * t + 0.02 * t, -0.05 * t * t));
          rad.push(lerp(0.035, 0.008, t));
        }
        pts.push(p);
      }
      // ridged horn (rings of growth)
      tubeAlong(B, pts, rad, sgL(lod, 9, 5), { bone: hb, capB: 'flat', radial: lod === 0 && !bull ? (th, j) => 1 + 0.08 * Math.max(0, Math.sin(j * 2.6)) : null });
    }
  }
  if (goat) { // beard
    B.set(bodyCls);
    const chin = rings[rings.length - 2].c.clone().addScaledVector(up, -hw * 0.6);
    tubeAlong(B, [chin, chin.clone().add(V(0, -0.05, 0.012)), chin.clone().add(V(0, -0.09, 0.02))], [[0.012, 0.016], [0.011, 0.013], [0.004, 0.005]], 6, { weights: (p) => normW([[hb, 0.4], [jb, 0.6]]), capB: 'flat' });
  }
}

/**
 * Leg from inside the body to the hoof: forearm (front) / gaskin (hind) muscle, the knee (carpus) or the
 * point of the hock, a slim cannon, the fetlock, a short sloping pastern and two claws (cloven hoof).
 */
function legMesh(B, rig, lod, leg, kind, bodyCls, skinCls) {
  const d = rig.dims, H = d.H;
  const sheep = kind === 'sheep', bull = kind === 'bull';
  const front = leg[0] === 'f';
  const up = R(rig, `${leg}_up`), lo = R(rig, `${leg}_lo`), ft = R(rig, `${leg}_ft`);
  const lw = d.legW;
  const trunk = front ? 'chest' : 'pelvis';
  const W = (p) => envelope(rig, p, { [trunk]: 0.6, [`${leg}_up`]: 1, [`${leg}_lo`]: 1, [`${leg}_ft`]: 1 }, 5);
  const pastern = V(0, -0.035 * H, -0.014 * H / 0.64);
  const hoofTop = ft.clone().add(V(0, -0.05 * H, -0.02 * H / 0.64));
  const back = front ? 0 : 0.022 * H;
  const pts = [
    V(up.x * 0.6, up.y - (front ? 0.2 : 0.16) * H, up.z + (front ? 0 : 0.02 * L(d))), // deep inside the barrel
    up.clone().lerp(lo, 0.45),                                     // forearm / gaskin
    up.clone().lerp(lo, 0.82),
    lo.clone().add(V(0, 0, back * 0.5)),                           // knee / hock
    lo.clone().lerp(ft, 0.35),                                     // cannon
    lo.clone().lerp(ft, 0.82),
    ft.clone(),                                                    // fetlock
    ft.clone().add(pastern),                                       // pastern
    hoofTop,
  ];
  const k = lw;
  const rad = [
    [k * (bull ? 1.3 : 1.2), k * (front ? 1.2 : 1.45)],
    [k * 0.95, k * (front ? 1.0 : 1.25)],
    [k * 0.66, k * (front ? 0.7 : 0.8)],
    [k * 0.66, k * (front ? 0.72 : 0.9)],
    [k * 0.44, k * 0.52],
    [k * 0.45, k * 0.5],
    [k * 0.56, k * 0.6],
    [k * 0.44, k * 0.46],
    [k * 0.47, k * 0.5],
  ];
  const sel = lod === 0 ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 3, 4, 6, 8];
  if (sheep) {
    // fleece down to just past the knee/hock (a woolly cuff over the leg), short white hair below
    B.set(bodyCls);
    const top = [0, 1, 2, 3, 4].filter((i) => sel.includes(i) || i === 4);
    tubeAlong(B, top.map((i) => pts[i]), top.map((i) => (i === 4 ? [rad[i][0] * 1.22, rad[i][1] * 1.22] : rad[i])), sgL(lod, 12, 6), { weights: W, capA: 'dome' });
    B.set(skinCls);
    const lower = [3, 4, 5, 6, 7, 8].filter((i) => sel.includes(i));
    tubeAlong(B, lower.map((i) => pts[i]), lower.map((i) => [rad[i][0] * 0.96, rad[i][1] * 0.96]), sgL(lod, 10, 6), { weights: W });
  } else {
    B.set(bodyCls);
    tubeAlong(B, sel.map((i) => pts[i]), sel.map((i) => rad[i]), sgL(lod, 12, 6), { weights: W, capA: 'dome' });
  }
  // cloven hoof: two claws, flat soles, toes forward
  B.set({ cls: CLS.FIX, pat: PAT.HORN, rough: 0.45, metal: 0, color: '#2b2622', grp: 0 });
  const fb = rig.index[`${leg}_ft`];
  const hh = Math.max(0.02, hoofTop.y);
  for (const sg of [-1, 1]) {
    const c = V(hoofTop.x + sg * lw * 0.24, hh * 0.5, hoofTop.z - lw * 0.18);
    B.ellipsoid(c, [lw * 0.25, hh * 0.55, lw * 0.5], {
      nu: sgL(lod, 10, 5), nv: sgL(lod, 6, 3), bone: fb,
      deform: (l) => {
        if (l.y < -hh * 0.38) l.y = -hh * 0.38 - (l.y + hh * 0.38) * 0.1;   // flat sole
        l.z += 0.35 * Math.max(0, hh * 0.5 - l.y) * -0.4;                    // toe sweeps forward
        if (l.x * sg < 0) l.x *= 0.55;                                       // the cleft between the claws
        return l;
      },
    });
  }
  // dewclaws at the back of the fetlock
  if (lod === 0) {
    for (const sg of [-1, 1]) B.ellipsoid(ft.clone().add(V(sg * lw * 0.3, -0.012 * H, lw * 0.5)), [lw * 0.1, lw * 0.14, lw * 0.12], { nu: 5, nv: 3, bone: fb });
  }
}
const L = (d) => d.L;

function dove(B, rig, lod) {
  const body = { cls: CLS.GA, pat: PAT.COAT, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 };
  const I = rig.index;
  B.set(body);
  B.ellipsoid(V(0, 0.085, 0.005), [0.036, 0.036, 0.075], { nu: sgL(lod, 14, 8), nv: sgL(lod, 8, 5), bone: I.body, xf: new Matrix4().makeRotationX(0.25),
    deform: (l) => { if (l.z < 0) l.y *= 1.05; return l; } });
  // neck & head (an iridescent neck patch)
  B.set({ cls: CLS.STRIPE, pat: PAT.COAT, rough: 0.4, metal: 0, color: [1, 1, 1], grp: 0 });
  B.ellipsoid(V(0, 0.125, -0.055), [0.022, 0.03, 0.022], { nu: 8, nv: 5, weights: [[I.neck, 0.7], [I.body, 0.3]] });
  B.set(body);
  B.ellipsoid(R(rig, 'head').clone().add(V(0, 0.005, -0.004)), [0.018, 0.019, 0.022], { nu: sgL(lod, 10, 6), nv: 6, bone: I.head,
    shade: (l) => 1 - 0.85 * Math.exp(-(((Math.abs(l.x) - 0.014) / 0.004) ** 2) - (((l.y - 0.004) / 0.004) ** 2) - (((l.z + 0.006) / 0.005) ** 2)) });
  B.set({ cls: CLS.FIX, pat: PAT.HORN, rough: 0.5, metal: 0, color: '#3a3433', grp: 0 });
  tubeAlong(B, [R(rig, 'head').clone().add(V(0, 0.0, -0.022)), R(rig, 'head').clone().add(V(0, -0.004, -0.038))], [0.005, 0.0015], 5, { bone: I.head, capB: 'flat' });
  // wings (folded along the sides)
  B.set(body);
  for (const s of ['l', 'r']) {
    const sg = s === 'l' ? -1 : 1;
    const a = R(rig, `wing_${s}`), b = R(rig, `wing_${s}2`);
    B.ellipsoid(a.clone().lerp(b, 0.5).add(V(sg * 0.008, -0.006, 0.01)), [0.012, 0.025, 0.07], { nu: 8, nv: 5,
      weights: (p) => normW([[I[`wing_${s}`], 1], [I[`wing_${s}2`], smooth(a.z, b.z + 0.03, p.z)]]),
      shade: (l) => 1 - 0.35 * Math.exp(-(((l.z - 0.01) / 0.008) ** 2)) - 0.35 * Math.exp(-(((l.z - 0.03) / 0.008) ** 2)) });
  }
  // tail fan
  B.box(R(rig, 'tail').clone().add(V(0, 0, 0.05)), [0.05, 0.008, 0.08], { bone: I.tail, shade: (p) => (p.z > 0.13 ? 0.6 : 1) });
  // legs
  B.set({ cls: CLS.FIX, pat: PAT.SKIN, rough: 0.6, metal: 0, color: '#b0545a', grp: 0 });
  for (const s of ['l', 'r']) {
    const l = R(rig, `leg_${s}`);
    tubeAlong(B, [l.clone(), V(l.x, 0.005, l.z - 0.004)], [0.004, 0.0035], 5, { bone: I[`leg_${s}`], capB: 'flat' });
    B.box(V(l.x, 0.003, l.z - 0.012), [0.012, 0.004, 0.02], { bone: I[`leg_${s}`] });
  }
}

export function buildAnimalGeometry(def, rig, lod) {
  const B = new MeshBuilder(rig);
  if (def.build === 'dove') dove(B, rig, lod);
  else quad(B, rig, lod, def.build);
  return B.build();
}
export { clamp };

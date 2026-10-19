// Hand props, vessels and instruments (procedural). Report Part IX/Appendix B, §34.3 and §65 for the vessels:
// the coal pans (Yoma 4:4 / 44b: daily — silver 4 kav scooped and poured into a gold 3-kav pan that is heavy,
// thick-walled, short-handled and of greenish gold; Yom Kippur — one gold 3-kav pan, light, thin, long-handled,
// with a ne'ashtik, of red parvayim gold), the Teni (gold basket-vessel) and Kuz (gold jug), Kaf + Bazach,
// mizrakot "with no flat bottoms" (Pesachim 5:5), hammered-silver trumpets (no length in Chazal), Ben Arza's
// bronze cymbal, the reed chalil, the two lots, the gold water flask (3 log), the magrefah, the gizrin
// (1 × 1 amah, thin as a se'ah strickle — Zevachim 62b), keys of the Azarah, and the folded priestly garments
// a kohen sleeps on (Tamid 1:1).
//
// Each prop is modelled in a NATURAL frame (Y up, front −Z, metres) and placed by a grip class:
//   fist     — in the hand. The fist frame: X = fingers, Y = thumb / fist axis, Z = back of the (right) hand.
//   tray     — carried in front in both hands (attached to the chest).
//   shoulder — on the right/left shoulder (attached to the clavicle).
//   pillow_side / pillow_back — on the floor under the head of a figure sleeping on its side / lying on its
//              back (attached to the root; the natural frame stays world-aligned, origin on the floor).
//   free     — standing/lying on its own (no bone).
import { Vector3, Matrix4, Euler, Quaternion, Color } from 'three';
import { MeshBuilder, PAT, CLS } from './builder.js';
import { gripOffset, HUMAN_CLIPS } from './clips.js';
import { PoseBuilder, poseToSkin } from './pose.js';
import { DEG, smooth, lerp } from './util.js';
import { AMAH } from '../core/units.js';
import { buildAnimalGeometry, quadHeadFrame } from './animals.js';
import { getRig } from './rig.js';
import { ANIMALS } from './roles.js';

const V = (x, y, z) => new Vector3(x, y, z);
const MAT = {
  gold: { color: '#e0b34c', rough: 0.2, metal: 1, pat: PAT.METAL },
  goldGreen: { color: '#cdbf63', rough: 0.24, metal: 1, pat: PAT.METAL },  // the daily pan's "green" gold (Yoma 44b)
  goldRed: { color: '#d07d3e', rough: 0.22, metal: 1, pat: PAT.METAL },    // zahav parvayim, "like bulls' blood" (YK pan)
  silver: { color: '#d3d5d8', rough: 0.2, metal: 1, pat: PAT.METAL },
  bronze: { color: '#b98d55', rough: 0.3, metal: 1, pat: PAT.METAL },
  copper: { color: '#b66d43', rough: 0.35, metal: 1, pat: PAT.METAL },
  iron: { color: '#48443f', rough: 0.45, metal: 0.9, pat: PAT.METAL },
  wood: { color: '#7a5634', rough: 0.72, metal: 0, pat: PAT.WOOD },
  woodDark: { color: '#5a3d24', rough: 0.75, metal: 0, pat: PAT.WOOD },
  linen: { color: '#efeadf', rough: 0.85, metal: 0, pat: PAT.LINEN },
  parchment: { color: '#e5d9bc', rough: 0.8, metal: 0, pat: PAT.LINEN },
  meat: { color: '#8a3a2e', rough: 0.3, metal: 0, pat: PAT.MEAT },     // cut faces: dark muscle, marbled
  fell: { color: '#dcc3ad', rough: 0.3, metal: 0, pat: PAT.FAT },     // the outside of a flayed carcass: creamy fat & fell
  sinew: { color: '#b0705c', rough: 0.34, metal: 0, pat: PAT.FAT },    // flayed lower legs: tendon and thin fascia
  fat: { color: '#e9dcc4', rough: 0.42, metal: 0, pat: PAT.FAT },
  bone: { color: '#e8e0cf', rough: 0.5, metal: 0, pat: PAT.NONE },
  reed: { color: '#c4a46a', rough: 0.8, metal: 0, pat: PAT.REED },
  horn: { color: '#bfa57c', rough: 0.45, metal: 0, pat: PAT.HORN },
  string: { color: '#e9e1cc', rough: 0.6, metal: 0, pat: PAT.CORD },
  pitch: { color: '#2f241b', rough: 0.95, metal: 0, pat: PAT.CORD },
  mat: { color: '#7d6a55', rough: 0.95, metal: 0, pat: PAT.WOOL },
  fleeceProp: { color: '#e6dccb', rough: 0.95, metal: 0, pat: PAT.FLEECE },
  coatProp: { color: '#5a3b28', rough: 0.65, metal: 0, pat: PAT.COAT },
  hide: { color: '#e3c6b6', rough: 0.4, metal: 0, pat: PAT.HIDE },
  liquid: { color: '#8a9aa4', rough: 0.04, metal: 0, pat: PAT.LIQUID },
  flour: { color: '#f1ebdf', rough: 0.97, metal: 0, pat: PAT.FLOUR },
  bread: { color: '#d8a866', rough: 0.8, metal: 0, pat: PAT.BREAD },
  salt: { color: '#efede6', rough: 0.5, metal: 0, pat: PAT.SALT },
};

/** override metal tints from the world material library (ctx.mats) so props match the architecture */
export function setPropMetals(m) {
  for (const k of ['gold', 'goldGreen', 'goldRed', 'silver', 'copper', 'iron', 'bronze']) if (m[k]) MAT[k] = { ...MAT[k], color: m[k] };
}

const S = (B, key, extra = {}) => B.set({ ...MAT[key], cls: CLS.FIX, grp: 0, ...extra });
const lathe = (B, prof, seg, opts = {}) => B.tube(prof.map(([r, y]) => ({ c: V(0, y, 0), rx: Math.max(r, 1e-4), rz: Math.max(r, 1e-4) })), { seg, bone: 0, ...opts });
const sg = (lod, a, b) => (lod === 0 ? a : b);

/** a lathe vessel with an inner wall (open top); prof from the bottom centre up to the rim */
function vessel(B, prof, seg, wall = 0.004) {
  lathe(B, prof, seg, { capA: 'flat' });
  const inner = prof.slice(1).reverse().map(([r, y]) => [Math.max(0.001, r - wall), y]);
  inner.push([0.001, prof[0][1] + wall]);
  lathe(B, inner, seg, { invert: true });
}

function rodY(B, y0, y1, r0, r1, seg, opts = {}) {
  return B.tube([{ c: V(0, y0, 0), rx: r0, rz: r0 }, { c: V(0, y1, 0), rx: r1, rz: r1 }], { seg, bone: 0, ...opts });
}
function rod(B, a, b, r, seg) {
  const dir = b.clone().sub(a).normalize();
  const ref = Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
  const az = ref.clone().addScaledVector(dir, -ref.dot(dir)).normalize();
  const ax = new Vector3().crossVectors(az, dir);
  return B.tube([{ c: a, rx: r, rz: r, ax, az }, { c: b, rx: r, rz: r, ax, az }], { seg, bone: 0, capA: 'flat', capB: 'flat' });
}
function curve(B, pts, radii, seg, opts = {}) {
  const n = pts.length;
  const rings = pts.map((c, j) => {
    const dir = (j < n - 1 ? pts[j + 1].clone().sub(c) : c.clone().sub(pts[j - 1])).normalize();
    const ref = Math.abs(dir.z) > 0.9 ? V(0, 1, 0) : V(0, 0, 1);
    const az = ref.clone().addScaledVector(dir, -ref.dot(dir)).normalize();
    const ax = new Vector3().crossVectors(az, dir);
    const r = radii[j];
    return { c, rx: Array.isArray(r) ? r[0] : r, rz: Array.isArray(r) ? r[1] : r, ax, az };
  });
  return B.tube(rings, { seg, bone: 0, ...opts });
}
function plateGrid(B, w, h, fn, nu, nv) {
  // double-sided sheet (cloth)
  for (const side of [1, -1]) {
    B.grid(nu, nv, (i, j) => {
      const p = fn(i / nu, j / nv);
      return { p: p.clone().add(V(0, 0, side * 0.0008)), u: (i / nu) * w, v: (j / nv) * h, w: 0 };
    }, { flip: side < 0 });
  }
}
/** rounded slab (a cushion-like box): superellipsoid, flat faces, soft edges */
function slab(B, c, size, opts = {}) {
  const [hx, hy, hz] = size.map((s) => s / 2);
  const e = opts.round ?? 0.25;
  return B.ellipsoid(c, [hx, hy, hz], {
    nu: opts.nu || 16, nv: opts.nv || 8, bone: 0, xf: opts.xf, shade: opts.shade,
    deform: (l) => {
      const q = [l.x / hx, l.y / hy, l.z / hz].map((t) => Math.sign(t) * Math.abs(t) ** e);
      return l.set(q[0] * hx, q[1] * hy, q[2] * hz);
    },
  });
}

const basis = (x, y, z) => new Matrix4().makeBasis(V(...x), V(...y), V(...z));
// vessels carried upright on both palms ('tray' without a grip of their own)
const VESSELS = new Set(['teni', 'kuz', 'flask', 'kaf', 'bazach', 'mizrak_gold', 'mizrak_silver', 'bowl', 'machtah_silver', 'machtah_gold', 'machtah_gold_yk', 'lot']);
const eul = (x, y, z) => new Matrix4().makeRotationFromEuler(new Euler(x * DEG, y * DEG, z * DEG, 'XYZ'));
const ID = () => new Matrix4();
const PAN_FIST = basis([0, 0, 1], [-1, 0, 0], [0, -1, 0]);

// coal-pan capacity: a kav = 24 eggs ≈ 1.38 l at R' Chaim Naeh's measures, scaled with the chosen amah standard
const KAV_M3 = 0.001376 * (AMAH / 0.48) ** 3;
const panDims = (kav) => { const w = Math.cbrt((kav * KAV_M3) / 0.2295); return { w, d: 0.85 * w, h: 0.27 * w }; };
const PAN = {
  silver: { ...panDims(4), handle: 0.15, wall: 0.006, rod: 0.011 },     // daily scooping pan, 4 kav
  daily: { ...panDims(3), handle: 0.14, wall: 0.007, rod: 0.012 },      // daily gold pan, 3 kav: heavy, short
  yk: { ...panDims(3), handle: 0.5, wall: 0.0025, rod: 0.008 },         // YK: light, thin, long-handled
};
const panGrip = (p) => [0, p.h * 0.7 + p.handle * 0.75 * 0.22, p.d / 2 + p.handle * 0.75];

// ---------------------------------------------------------------------------------------------- catalogue
export const PROPS = {
  torch: {
    big: true, tip: [0, 0.47, 0],
    build(B, lod) {
      S(B, 'wood'); rodY(B, -0.3, 0.3, 0.014, 0.017, sg(lod, 10, 6), { capA: 'flat' });
      S(B, 'pitch');
      lathe(B, [[0.02, 0.28], [0.034, 0.33], [0.037, 0.39], [0.03, 0.44], [0.012, 0.455]], sg(lod, 12, 7), { capB: 'flat', radial: (th, j) => 1 + 0.08 * Math.sin(th * 5 + j * 2) });
    },
    // set down, a burning torch stands upright on its butt (as in a socket); the sim gives it a height
    grips: { free: { rot: ID(), pos: [0, 0.3, 0] } },
  },
  trumpet: { // chatzotzrah — hammered silver
    build(B, lod) {
      S(B, 'silver');
      lathe(B, [[0.006, 0.083], [0.012, 0.096], [0.0135, 0.104], [0.009, 0.106]], sg(lod, 10, 6));
      rodY(B, -0.385, 0.085, 0.0068, 0.0062, sg(lod, 8, 5));
      if (lod === 0) for (const y of [-0.06, -0.24]) lathe(B, [[0.0068, y - 0.008], [0.0095, y - 0.004], [0.0095, y + 0.004], [0.0068, y + 0.008]], 8);
      lathe(B, [[0.0066, -0.385], [0.009, -0.42], [0.016, -0.445], [0.03, -0.462], [0.046, -0.472], [0.044, -0.468]], sg(lod, 14, 8));
    },
    grips: { free: { rot: eul(0, 0, 90), pos: [0, 0.047, 0] } },
  },
  shofar: {
    build(B, lod) {
      S(B, 'horn');
      const pts = [], rad = [];
      const n = sg(lod, 14, 7);
      for (let i = 0; i <= n; i++) {
        const t = i / n, a = t * 2.1, R = 0.16;
        pts.push(V(R * (1 - Math.cos(a)), 0.08 - R * Math.sin(a) + 0.05 * t * t, -0.03 * t));
        rad.push(0.0065 + 0.034 * t ** 1.6);
      }
      curve(B, pts, rad, sg(lod, 10, 6), { capA: 'flat' });
    },
    grips: { free: { rot: eul(0, 0, 90), pos: [0, 0.04, 0] } },
  },
  chalil: { // the reed pipe (abuv shel kaneh)
    build(B, lod) {
      S(B, 'reed', { pat: PAT.WOOD });
      rodY(B, -0.32, 0.12, 0.0085, 0.008, sg(lod, 8, 5), { capA: 'flat', capB: 'flat' });
    },
    grips: { free: { rot: eul(0, 0, 90), pos: [0, 0.009, 0] } },
  },
  kinnor: { // lyre of the Mikdash — seven strings (Arachin 13b); a box sound-chest, two arms, a yoke with tuning
    // collars, after the lyres on Judean coins of the period (reconstruction)
    build(B, lod) {
      S(B, 'wood');
      slab(B, V(0, 0.07, 0), [0.26, 0.14, 0.065], { round: 0.25, nu: sg(lod, 16, 8), nv: sg(lod, 8, 4) });
      S(B, 'woodDark');
      B.ellipsoid(V(0, 0.08, -0.033), [0.035, 0.035, 0.004], { nu: 12, nv: 3, bone: 0, lat: [0, 0.5], xf: eul(-90, 0, 0) }); // the sound-hole's rim
      S(B, 'wood');
      for (const s of [-1, 1]) curve(B, [V(s * 0.1, 0.13, 0), V(s * 0.14, 0.22, 0), V(s * 0.145, 0.32, 0), V(s * 0.125, 0.43, 0), V(s * 0.1, 0.45, 0)], [0.018, 0.016, 0.014, 0.013, 0.012], sg(lod, 8, 5), { capB: 'dome' });
      rod(B, V(-0.16, 0.405, 0), V(0.16, 0.405, 0), 0.012, sg(lod, 8, 5));
      if (lod === 0) { S(B, 'woodDark'); for (let i = 0; i < 7; i++) { const x = (-0.075 + i * 0.025) * 1.15; rod(B, V(x - 0.005, 0.405, 0), V(x + 0.005, 0.405, 0), 0.016, 6); } }
      S(B, 'bronze'); B.box(V(0, 0.03, -0.036), [0.13, 0.012, 0.01]);          // the tailpiece
      S(B, 'string');
      for (let i = 0; i < 7; i++) {
        const x = -0.075 + i * 0.025;
        B.ribbon([V(x, 0.03, -0.038), V(x * 1.02, 0.11, -0.04), V(x * 1.15, 0.397, -0.012)], lod ? 0.003 : 0.0016, { side: V(1, 0, 0), weights: 0 });
      }
    },
    grips: { fist: { grip: [0.135, 0.29, 0], rot: eul(0, 180, 0) }, free: { rot: eul(-80, 0, 0), pos: [0, 0.03, 0] } },
  },
  nevel: { // the larger lyre with a jar-shaped (nevel) sound-body, ten strings ("nevel asor", Tehillim 33:2),
    // after the coin lyres (reconstruction)
    big: true,
    build(B, lod) {
      S(B, 'woodDark');
      B.ellipsoid(V(0, 0.16, 0), [0.15, 0.16, 0.07], { nu: sg(lod, 18, 9), nv: sg(lod, 10, 5), bone: 0,
        deform: (l) => { l.x *= 1 - 0.35 * smooth(0.04, 0.16, l.y); l.z *= 1 - 0.2 * smooth(0.04, 0.16, l.y); return l; } });
      for (const s of [-1, 1]) curve(B, [V(s * 0.07, 0.27, 0), V(s * 0.14, 0.42, 0), V(s * 0.155, 0.58, 0), V(s * 0.13, 0.72, 0), V(s * 0.1, 0.74, 0)], [0.021, 0.018, 0.016, 0.015, 0.013], sg(lod, 8, 5), { capB: 'dome' });
      rod(B, V(-0.165, 0.69, 0), V(0.165, 0.69, 0), 0.015, sg(lod, 8, 5));
      S(B, 'bronze'); B.box(V(0, 0.06, -0.07), [0.17, 0.014, 0.012]);
      S(B, 'string');
      for (let i = 0; i < 10; i++) {
        const x = -0.09 + i * 0.02;
        B.ribbon([V(x * 0.9, 0.06, -0.075), V(x * 1.2, 0.68, -0.014)], lod ? 0.003 : 0.0018, { side: V(1, 0, 0), weights: 0 });
      }
    },
    grips: { fist: { grip: [0.15, 0.52, 0], rot: eul(0, 180, 0) }, free: { rot: eul(-80, 0, 0), pos: [0, 0.07, 0] } },
  },
  cymbal: { // Ben Arza's bronze cymbal (held as a pair)
    build(B, lod) {
      S(B, 'bronze');
      const seg = sg(lod, 20, 10);
      lathe(B, [[0.001, 0.016], [0.022, 0.012], [0.03, 0.004], [0.075, -0.004], [0.11, -0.013], [0.112, -0.016]], seg);
      lathe(B, [[0.106, -0.018], [0.07, -0.009], [0.028, 0.0], [0.02, 0.006], [0.001, 0.008]], seg);
      if (lod === 0) { S(B, 'woodDark', { pat: PAT.CORD }); B.ribbon([V(-0.02, 0.016, 0), V(0, 0.034, 0), V(0.02, 0.016, 0)], 0.01, { side: V(1, 0, 0), weights: 0 }); }
    },
    grips: { fist: { grip: [0, 0.02, 0], rot: eul(90, 0, 0) }, free: { rot: ID(), pos: [0, 0.018, 0] } },
  },
  machtah_silver: { // the daily scooping pan: silver, 4 kav (Yoma 4:4; ⚠️ R' Yosi: a se'ah)
    build(B, lod) { pan(B, lod, 'silver', PAN.silver); },
    grips: { fist: { grip: panGrip(PAN.silver), rot: PAN_FIST } },
  },
  machtah_gold: { // the daily gold pan, 3 kav: heavy, thick-walled, short-handled, greenish gold (Yoma 4:4, 44b)
    build(B, lod) { pan(B, lod, 'goldGreen', PAN.daily); },
    grips: { fist: { grip: panGrip(PAN.daily), rot: PAN_FIST } },
  },
  machtah_gold_yk: { // Yom Kippur: gold 3 kav, light, thin, long handle "so his arm helps him", a ne'ashtik; red gold
    big: true,
    build(B, lod) { pan(B, lod, 'goldRed', PAN.yk, { ring: true }); },
    grips: { fist: { grip: panGrip(PAN.yk), rot: PAN_FIST } },
  },
  teni: { // gold basket-vessel, 2.5 kav (Tamid 3:6)
    build(B, lod) {
      S(B, 'gold');
      vessel(B, [[0.001, 0], [0.07, 0], [0.1, 0.03], [0.116, 0.1], [0.121, 0.13], [0.126, 0.135]], sg(lod, 20, 10));
      if (lod === 0) for (const s of [-1, 1]) curve(B, [V(s * 0.115, 0.115, 0), V(s * 0.15, 0.135, 0), V(s * 0.115, 0.08, 0)], [0.006, 0.006, 0.006], 6);
    },
    grips: { fist: { grip: [0.15, 0.12, 0], rot: eul(0, -90, 0) } },
  },
  kuz: { // gold jug "like a large gold kiton"
    build(B, lod) {
      S(B, 'gold');
      vessel(B, [[0.001, 0], [0.05, 0], [0.07, 0.04], [0.072, 0.1], [0.05, 0.16], [0.025, 0.19], [0.028, 0.22], [0.033, 0.232]], sg(lod, 18, 9));
      curve(B, [V(0, 0.2, 0.026), V(0, 0.215, 0.07), V(0, 0.15, 0.09), V(0, 0.09, 0.07)], [0.007, 0.007, 0.007, 0.007], 6);
    },
    grips: { fist: { grip: [0, 0.16, 0.088], rot: ID() } },
  },
  flask: { // the gold water flask of the Sukkot libation, 3 log (Sukkah 4:9)
    build(B, lod) {
      S(B, 'gold');
      lathe(B, [[0.001, 0], [0.05, 0], [0.071, 0.04], [0.07, 0.11], [0.042, 0.15], [0.017, 0.17], [0.016, 0.205], [0.023, 0.215], [0.013, 0.218]], sg(lod, 18, 9), { capA: 'flat' });
    },
    grips: { fist: { grip: [0, 0.188, 0], rot: ID() } },
  },
  kaf: { // the ketoret spoon/ladle, gold, 3 kav (with the bazach in it)
    build(B, lod) {
      S(B, 'gold');
      vessel(B, [[0.001, 0], [0.05, 0.0], [0.08, 0.03], [0.092, 0.06], [0.096, 0.065]], sg(lod, 18, 9));
      rod(B, V(0, 0.05, 0.09), V(0, 0.07, 0.2), 0.009, 6);
    },
    grips: { fist: { grip: [0, 0.07, 0.19], rot: PAN_FIST } },
  },
  bazach: { // the small dish of incense with its cover
    build(B, lod) {
      S(B, 'gold');
      lathe(B, [[0.001, 0], [0.04, 0], [0.058, 0.02], [0.062, 0.026], [0.05, 0.04], [0.03, 0.052], [0.008, 0.056], [0.01, 0.066], [0.001, 0.068]], sg(lod, 16, 8), { capA: 'flat' });
    },
    grips: { fist: { grip: [0, 0.03, 0.06], rot: ID() } },
  },
  mizrak_gold: { // basin for the blood — no flat bottom, so it cannot be set down (Pesachim 5:5)
    build(B, lod) { mizrak(B, lod, 'gold'); },
    grips: { fist: { grip: [0.108, 0.112, 0], rot: eul(0, -90, 0) }, free: { rot: eul(0, 0, 70), pos: [0, 0.1, 0] } },
  },
  mizrak_silver: {
    build(B, lod) { mizrak(B, lod, 'silver'); },
    grips: { fist: { grip: [0.108, 0.112, 0], rot: eul(0, -90, 0) }, free: { rot: eul(0, 0, 70), pos: [0, 0.1, 0] } },
  },
  bowl: {
    build(B, lod) {
      S(B, 'silver');
      vessel(B, [[0.001, 0], [0.06, 0], [0.09, 0.03], [0.1, 0.06], [0.104, 0.065]], sg(lod, 18, 9));
    },
    grips: { fist: { grip: [0.1, 0.06, 0], rot: eul(0, -90, 0) } },
  },
  knife: { // the shechitah knife (chalaf): iron — never brought to the altar, used in the slaughter zone
    build(B, lod) { knifeSlaughter(B, lod); },
    grips: { free: { rot: eul(0, 0, 90), pos: [0, 0.012, 0] } },
  },
  limb: { // a hind leg of the tamid lamb (the regel), flayed: haunch, hock, shank
    build(B, lod) { hindLeg(B, lod); },
    grips: { tray: { grip: [0, -0.13, 0], rot: eul(0, 0, 90) }, shoulder: { grip: [0, -0.12, 0], rot: eul(90, 0, 0) }, free: { rot: eul(0, 0, 90), pos: [0, 0.06, 0] } },
  },
  lamb_carcass: { // the flayed lamb, before it is cut up: fat-covered body, rib cage, spine, the alyah tail
    big: true,
    build(B, lod) { carcass(B, lod); },
    grips: {
      fist: { grip: [0.08, -0.3, 0.27], rot: eul(90, 0, 0) },
      tray: { grip: [0, -0.12, 0], rot: ID() },
      shoulder: { grip: [0, -0.07, 0.02], rot: eul(0, 0, 10) },
      free: { rot: eul(0, 0, 90), pos: [0, 0.11, 0] },
    },
  },
  log: { // gizer: 1 amah × 1 amah, as thin as a se'ah strickle (Zevachim 62b)
    big: true,
    build(B, lod) {
      S(B, 'wood', { color: '#8a6a48' });
      const a = AMAH;
      B.box(V(0, 0, 0), [a, 0.035, a], { shade: (p) => (Math.abs(p.x) > a * 0.48 || Math.abs(p.z) > a * 0.48 ? 0.7 : 1) });
    },
    grips: {
      tray: { grip: [0, -0.03, AMAH / 6], rot: eul(-75, 0, 0) },
      shoulder: { grip: [0, -0.02, 0], rot: eul(0, 0, 12) },
      fist: { grip: [0, 0, AMAH / 2], rot: eul(90, 0, 0) },
      free: { rot: ID(), pos: [0, 0.018, 0] },
    },
  },
  keys: { // the keys of the Azarah on their ring
    build(B, lod) {
      S(B, 'iron');
      const n = sg(lod, 14, 8), pts = [], rad = [];
      for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(V(Math.sin(a) * 0.04, -Math.cos(a) * 0.04 - 0.04, 0)); rad.push(0.004); }
      curve(B, pts, rad, 5);
      for (const [x, L] of [[-0.012, 0.2], [0.014, 0.14]]) {
        rod(B, V(x, -0.08, 0), V(x, -0.08 - L, 0), 0.006, 5);
        B.box(V(x + 0.012, -0.08 - L + 0.015, 0), [0.024, 0.026, 0.006]);
      }
    },
    grips: { free: { rot: eul(90, 0, 0), pos: [0, 0.006, 0.08] } },
  },
  scroll: { // a Torah scroll (Yoma 7:1 — each held his own at the reading)
    big: true,
    build(B, lod) {
      for (const s of [-1, 1]) {
        B.transform(new Matrix4().makeTranslation(s * 0.047, 0, 0));
        S(B, 'wood'); rodY(B, -0.06, 0.44, 0.011, 0.011, 6, { capA: 'flat', capB: 'flat' });
        S(B, 'parchment'); rodY(B, 0.02, 0.36, 0.045, 0.045, sg(lod, 14, 8), { capA: 'flat', capB: 'flat' });
        S(B, 'wood'); for (const y of [0.0, 0.38]) lathe(B, [[0.012, y], [0.05, y + 0.004], [0.05, y + 0.016], [0.012, y + 0.02]], 10);
        B.transform(null);
      }
    },
    grips: { fist: { grip: [0.047, 0.0, 0], rot: ID() }, tray: { grip: [0, 0.06, 0], rot: ID() } },
  },
  sudar: { // the segan's cloth signal (Tamid 7:3)
    build(B, lod) {
      S(B, 'linen');
      plateGrid(B, 0.34, 0.46, (u, v) => V(u * 0.34 - 0.03, -v * 0.46, 0.025 * Math.sin(u * 9 + v * 2) * v), sg(lod, 8, 3), sg(lod, 6, 2));
    },
    grips: {},
  },
  basket: { // bikkurim basket — peeled willow; fruit of the seven species heaped on top
    big: true,
    build(B, lod) {
      S(B, 'reed');
      vessel(B, [[0.001, 0], [0.13, 0], [0.17, 0.04], [0.19, 0.15], [0.196, 0.16]], sg(lod, 20, 10), 0.008);
      const fruit = [
        ['#4a2440', [-0.05, 0.16, 0.02], 0.03], ['#4a2440', [-0.08, 0.15, -0.03], 0.028], ['#55304c', [-0.03, 0.18, -0.04], 0.027],
        ['#8e2a22', [0.07, 0.17, 0.03], 0.045], ['#7d5a38', [0.03, 0.17, -0.07], 0.032], ['#6a7a3a', [0.1, 0.15, -0.05], 0.03],
        ['#b48a3c', [0.0, 0.19, 0.08], 0.035],
      ];
      for (const [c, p, r] of fruit) {
        B.set({ color: c, rough: 0.55, metal: 0, pat: PAT.NONE, cls: CLS.FIX });
        B.ellipsoid(V(...p), [r, r * 0.9, r], { nu: sg(lod, 8, 5), nv: sg(lod, 5, 3), bone: 0 });
      }
    },
    grips: {
      tray: { grip: [0, 0, 0], rot: ID() },
      shoulder: { grip: [-0.05, 0.0, 0], rot: eul(0, 0, -12) },
      fist: { grip: [0.19, 0.15, 0], rot: eul(0, -90, 0) },
    },
  },
  magrefah: { // the long ash shovel: a copper blade with raised sides and back on a wooden handle
    big: true,
    build(B, lod) {
      S(B, 'wood'); rodY(B, -1.25, 0.06, 0.016, 0.016, sg(lod, 8, 5), { capB: 'flat' });
      S(B, 'copper');
      rodY(B, -1.3, -1.22, 0.02, 0.017, 8);
      const m = eul(30, 0, 0);
      B.box(V(0, -1.36, -0.06), [0.22, 0.17, 0.005], { m });
      for (const s of [-1, 1]) B.box(V(s * 0.108, -1.36, -0.04), [0.005, 0.17, 0.04], { m });
      B.box(V(0, -1.285, -0.02), [0.22, 0.006, 0.04], { m });
    },
    grips: { free: { rot: eul(0, 0, 90), pos: [0, 0.02, 0] } },
  },
  lot: { // one of the two lots (Ben Gamla's gold)
    build(B, lod) {
      S(B, 'gold');
      B.box(V(0, 0.03, 0), [0.07, 0.045, 0.004]);
    },
    grips: { fist: { grip: [0, 0.0, 0], rot: eul(0, 90, 0) }, free: { rot: eul(90, 0, 0), pos: [0, 0.002, 0] } },
  },
  folded_garments: { // "they took them off, folded them and laid them under their heads" (Tamid 1:1)
    big: true,
    build(B, lod, cls) { foldedGarments(B, lod, cls); },
    grips: {
      pillow_side: { rot: eul(0, 0, 90) },   // inverse of the sleep pose's root roll (natural frame = world)
      pillow_back: { rot: eul(-90, 0, 0) },  // inverse of the lie pose's root pitch
      free: { rot: ID(), pos: [0, 0, 0] },
    },
  },
};

/**
 * A coal pan (machtah): a fire-pan of beaten metal — a flat floor with rounded corners, walls flaring out to a rolled
 * rim, the front wall lower and drawn out into a lip for scooping and pouring coals, the back wall carrying a socket
 * into which the handle is set (form after the period's fire-shovels; reconstruction). Floor and walls are sized so
 * the pan holds its measure (w, d, h from panDims: 4 or 3 kav); wall thickness and handle per variant (Yoma 4:4).
 */
function pan(B, lod, metal, p, o = {}) {
  S(B, metal);
  const { w, d, h, wall: t } = p;
  const seg = sg(lod, 40, 16);
  const n = 5;                                                     // rounded-rectangle exponent (superellipse)
  const sq = (th) => 1 / (Math.abs(Math.cos(th)) ** n + Math.abs(Math.sin(th)) ** n) ** (1 / n);
  const front = (th) => smooth(-0.15, -0.95, Math.sin(th));         // 1 at the front (−z), 0 elsewhere
  const top = (th) => h - h * 0.5 * front(th);                     // the front wall lower: the scooping lip
  const lipOut = (th) => 1 + 0.12 * front(th);                     // ... and drawn out
  const k = 1.04;                                                  // flare compensates the sloped walls' volume
  const ring = (y, f) => ({ c: V(0, y, 0), rx: (w / 2) * k * f, rz: (d / 2) * k * f });
  const walls = (inset, invert) => B.tube([ring(inset ? t : 0, 0.86 - inset), ring(h * 0.5, 0.95 - inset), ring(h, 1 - inset)], {
    seg, bone: 0, invert, capA: invert ? null : 'flat',
    radial: (th, j) => sq(th) * (j === 2 ? lipOut(th) : j === 1 ? 1 + 0.04 * front(th) : 1),
    lift: (th, j) => (j === 2 ? top(th) - h : j === 1 ? (top(th) - h) * 0.45 : 0),
  });
  walls(0, false);
  walls(t / Math.min(w, d) * 2.2, true);
  // the floor inside (an up-facing disc of the same rounded-rectangle outline)
  const fi = 0.86 - t / Math.min(w, d) * 2.2;
  B.grid(seg, 2, (i, j) => {
    const th = (i / seg) * Math.PI * 2, r = sq(th) * fi * (j / 2);
    return { p: V(Math.cos(th) * (w / 2) * k * r, t * 1.02, Math.sin(th) * (d / 2) * k * r), u: Math.cos(th) * r * w, v: Math.sin(th) * r * d, w: 0 };
  }, { wrap: true, inside: V(0, -1, 0) });
  // the rolled rim along the top edge
  if (lod <= 1) {
    const m = sg(lod, 48, 20), pts = [], rad = [];
    for (let i = 0; i <= m; i++) {
      const th = (i / m) * Math.PI * 2;
      const r = sq(th) * lipOut(th);
      pts.push(V(Math.cos(th) * (w / 2) * k * r, top(th) + t * 0.2, Math.sin(th) * (d / 2) * k * r));
      rad.push(t * 0.9);
    }
    curve(B, pts, rad, sg(lod, 6, 4));
  }
  // the socket on the back wall and the handle set in it
  const a = V(0, h * 0.62, (d / 2) * k), b = V(0, h * 0.7 + p.handle * 0.22, (d / 2) * k + p.handle);
  const dir = b.clone().sub(a).normalize();
  curve(B, [a.clone().addScaledVector(dir, -0.006), a.clone().addScaledVector(dir, 0.012), a.clone().addScaledVector(dir, 0.045)],
    [p.rod * 1.9, p.rod * 1.65, p.rod * 1.35], sg(lod, 10, 6), { capA: 'flat', capB: 'flat' });
  if (lod === 0) curve(B, [a.clone().addScaledVector(dir, 0.04), a.clone().addScaledVector(dir, 0.05)], [p.rod * 1.6, p.rod * 1.6], 10, { capA: 'flat', capB: 'flat' }); // a collar
  rod(B, a.clone().addScaledVector(dir, 0.04), b, p.rod, sg(lod, 8, 5));
  if (o.ring) { // the ne'ashtik: a ring at the end of the long handle (reconstruction of the word's sense)
    const nn = sg(lod, 12, 6), pts = [], rad = [];
    for (let i = 0; i <= nn; i++) {
      const ang = (i / nn) * Math.PI * 2;
      pts.push(b.clone().addScaledVector(dir, 0.024 + 0.022 * Math.cos(ang)).add(V(0.022 * Math.sin(ang), 0, 0)));
      rad.push(0.0035);
    }
    curve(B, pts, rad, 5);
  } else {
    B.ellipsoid(b, [p.rod * 1.35, p.rod * 1.35, p.rod * 1.35], { nu: sg(lod, 10, 6), nv: sg(lod, 6, 4), bone: 0 });   // the end knob
  }
}

function mizrak(B, lod, metal) {
  S(B, metal);
  vessel(B, [[0.001, 0], [0.03, 0.012], [0.068, 0.042], [0.098, 0.085], [0.111, 0.113], [0.117, 0.12]], sg(lod, 20, 10));
}

/** a flayed hind leg (natural frame: hip cut at the top, y = 0; shank down −y; the front of the leg −z) */
function hindLeg(B, lod) {
  const prof = [ // y, half-width x, half-depth z, centre z (hock behind)
    [0.0, 0.058, 0.066, 0.0], [-0.03, 0.068, 0.08, 0.004], [-0.08, 0.066, 0.078, 0.006], [-0.14, 0.054, 0.062, 0.006],
    [-0.2, 0.038, 0.044, 0.004], [-0.245, 0.026, 0.031, 0.006], [-0.272, 0.024, 0.033, 0.012], [-0.3, 0.019, 0.022, 0.004],
    [-0.36, 0.016, 0.017, -0.002], [-0.41, 0.017, 0.018, -0.004],
  ];
  const rows = lod === 0 ? prof : [prof[0], prof[2], prof[4], prof[7], prof[9]];
  S(B, 'fell');
  const rings = rows.map(([y, rx, rz, cz]) => ({ c: V(0, y, cz), rx, rz }));
  B.tube(rings, {
    seg: sg(lod, 18, 9), bone: 0,
    // the muscle groups of the round show as soft lobes under the fell
    radial: lod === 0 ? (th, j) => 1 + 0.05 * Math.sin(th * 3 + 0.6) * smooth(0, 3, j) * (1 - smooth(4, 6, j)) : null,
  });
  // the cut face at the hip: marbled muscle with the round of the femur
  S(B, 'meat');
  const top = rings[0];
  B.ellipsoid(V(0, 0.0005, 0), [top.rx * 0.985, 0.004, top.rz * 0.985], { nu: sg(lod, 18, 9), nv: 2, lat: [0, 0.5], bone: 0 });
  S(B, 'bone');
  B.ellipsoid(V(0.008, 0.003, 0.012), [0.012, 0.0035, 0.012], { nu: 8, nv: 2, lat: [0, 0.5], bone: 0 });
  // the shank's cut end
  const last = rings[rings.length - 1];
  B.ellipsoid(last.c.clone().add(V(0, -0.002, 0)), [last.rx * 0.95, 0.004, last.rz * 0.95], { nu: 8, nv: 2, lat: [0.5, 1], bone: 0 });
}

/** the flayed carcass (natural frame: body along z, rear +z, back up) */
function carcass(B, lod) {
  const L = 0.62, zR = L / 2, zF = -L / 2;
  const N = sg(lod, 28, 8);
  const rings = [];
  for (let j = 0; j <= N; j++) {
    const t = j / N; // 0 rear → 1 front
    const z = lerp(zR, zF, t);
    const chest = smooth(0.45, 0.75, t) * (1 - smooth(0.88, 1, t));
    const ry = 0.07 + 0.045 * chest + 0.015 * smooth(0, 0.2, t) * (1 - smooth(0.25, 0.45, t)); // haunch, loin, chest
    const rx = 0.07 + 0.03 * chest + 0.02 * (1 - smooth(0.05, 0.3, t));
    const end = Math.min(t, 1 - t);
    const tap = 0.55 + 0.45 * smooth(0, 0.12, end);
    rings.push({ c: V(0, -0.012 * chest, z), rx: rx * tap, rz: ry * tap, ax: V(1, 0, 0), az: V(0, 1, 0), t });
  }
  S(B, 'fell');
  B.tube(rings, {
    seg: sg(lod, 22, 10), bone: 0,
    radial: lod === 0 ? (th, j, R) => {
      const t = R.t;
      const side = Math.abs(Math.cos(th));                    // flanks
      const top = Math.max(0, Math.sin(th)) ** 16;           // spine ridge
      const ribs = 0.02 * side * smooth(0.42, 0.52, t) * (1 - smooth(0.82, 0.92, t)) * (0.5 + 0.5 * Math.cos(j * Math.PI));
      return 1 + ribs + 0.05 * top - 0.04 * Math.max(0, -Math.sin(th)) ** 2 * (1 - smooth(0.4, 0.6, t)); // tucked belly at the rear
    } : null,
    // the intercostal hollows read darker (thin fell over red muscle)
    shade: lod === 0 ? (th, j) => 1 - 0.16 * Math.abs(Math.cos(th)) * smooth(0.42, 0.52, rings[j].t) * (1 - smooth(0.82, 0.92, rings[j].t)) * (0.5 - 0.5 * Math.cos(j * Math.PI)) : null,
  });
  // neck cut (the head is off) and the fat tail (alyah)
  S(B, 'meat');
  const f = rings[rings.length - 1];
  B.ellipsoid(f.c.clone().add(V(0, 0.0, -0.002)), [f.rx * 0.98, f.rz * 0.98, 0.006], { nu: sg(lod, 14, 7), nv: sg(lod, 8, 4), bone: 0 });
  S(B, 'fat');
  B.ellipsoid(V(0, -0.02, zR + 0.03), [0.07, 0.085, 0.035], { nu: sg(lod, 12, 6), nv: sg(lod, 6, 4), bone: 0,
    deform: (l) => { l.x *= 1 + 0.25 * smooth(0.02, -0.08, l.y); return l; } });
  // legs: forelegs folded, hind legs stretched back; each tapers to a bent joint and the shank's cut end
  const legs = [
    { s: -1, a: V(-0.05, -0.06, zF + 0.1), pts: [V(-0.055, -0.13, zF + 0.08), V(-0.055, -0.2, zF + 0.04), V(-0.05, -0.27, zF + 0.06)] },
    { s: 1, a: V(0.05, -0.06, zF + 0.1), pts: [V(0.055, -0.13, zF + 0.08), V(0.055, -0.2, zF + 0.04), V(0.05, -0.27, zF + 0.06)] },
    { s: -1, a: V(-0.05, -0.04, zR - 0.06), pts: [V(-0.055, -0.1, zR + 0.04), V(-0.05, -0.14, zR + 0.14), V(-0.045, -0.15, zR + 0.26)] },
    { s: 1, a: V(0.05, -0.04, zR - 0.06), pts: [V(0.055, -0.1, zR + 0.04), V(0.05, -0.14, zR + 0.14), V(0.045, -0.15, zR + 0.26)] },
  ];
  for (const g of legs) {
    const pts = [g.a, ...g.pts];
    S(B, 'sinew');
    curve(B, pts, [0.05, 0.034, 0.02, 0.016], sg(lod, 10, 6));
    S(B, 'bone');
    const e = pts[pts.length - 1], dir = e.clone().sub(pts[pts.length - 2]).normalize();
    B.ellipsoid(e, [0.013, 0.013, 0.013], { nu: 6, nv: 4, bone: 0, deform: (l) => l.addScaledVector(dir, Math.max(0, l.dot(dir)) * -0.5) });
  }
}

/** a wool mantle laid over a sleeper: draped over the body's height profile, falling to the mat at the sides */
function cover(B, lod, lay) {
  const back = lay === 'back';
  // along the body from the shoulders to past the feet, and across it; heights of the body under the cloth
  const prof = back
    ? [[0.2, 0.27], [0.45, 0.31], [0.7, 0.29], [0.95, 0.25], [1.15, 0.26], [1.35, 0.2], [1.58, 0.22], [1.74, 0.06]]
    : [[0.2, 0.3], [0.45, 0.32], [0.7, 0.33], [0.9, 0.36], [1.1, 0.3], [1.3, 0.22], [1.45, 0.12]];
  const hAt = (t) => { let k = 0; while (k < prof.length - 2 && t > prof[k + 1][0]) k++; const [a0, h0] = prof[k], [a1, h1] = prof[k + 1]; return lerp(h0, h1, Math.min(1, Math.max(0, (t - a0) / (a1 - a0)))); };
  const L0 = prof[0][0], L1 = prof[prof.length - 1][0], half = back ? 0.42 : 0.45;
  const nu = sg(lod, 14, 7), nv = sg(lod, 18, 8);
  for (const inner of [false, true]) {
    S(B, 'mat', { color: '#988670', rough: 0.95 });
    B.grid(nu, nv, (i, j) => {
      const x = lerp(-half, half, i / nu), t = lerp(L0, L1, j / nv);
      const h = hAt(t);
      const body = back ? 0.2 : 0.2;
      const y = 0.012 + (h - 0.012) * (1 - smooth(body * 0.75, half * 0.95, Math.abs(x))) ** 1.4 + 0.012 * Math.sin(x * 23 + t * 7) * smooth(0.1, 0.3, Math.abs(x));
      const yy = y - (inner ? 0.006 : 0);
      // pillow_back: the body runs toward −z; pillow_side: toward −x (across is z)
      const p = back ? V(x, yy, -t) : V(-t, yy, x - 0.1);
      return { p, u: x, v: t, w: 0, shade: inner ? 0.5 : 1 - 0.15 * smooth(body, half, Math.abs(x)) };
    }, { inside: back ? V(0, -1, -0.9) : V(-0.8, -1, 0), invert: inner });
  }
}

/** the four white garments folded into a bundle (+ his own mat, the kesset, under the body when used as a pillow) */
function foldedGarments(B, lod, cls) {
  const lay = cls === 'pillow_side' ? 'side' : cls === 'pillow_back' ? 'back' : null;
  let y0 = 0;
  if (lay) { // "each one's kesset on the ground" (Tamid 1:1): a thin wool mat under the sleeper
    S(B, 'mat');
    const c = lay === 'side' ? V(-0.72, 0.005, -0.1) : V(0, 0.005, -0.74);
    const size = lay === 'side' ? [1.95, 0.01, 0.78] : [0.78, 0.01, 1.95];
    slab(B, c, size, { nu: sg(lod, 12, 6), nv: 4, round: 0.15 });
    y0 = 0.01;
  }
  // "they covered themselves with their own clothes" (Tamid 1:1): his mantle spread over him from the shoulders
  if (lay) cover(B, lod, lay);
  // folded ketonet (largest), michnasayim, the migba'at's coil and the avnet's coil on top
  S(B, 'linen', { pat: PAT.LINEN_BOX });
  const fold = (p) => 1 - 0.08 * Math.max(0, Math.cos(p.x * 21));
  slab(B, V(0, y0 + 0.022, 0), [0.34, 0.044, 0.25], { nu: sg(lod, 16, 8), nv: sg(lod, 8, 4), round: 0.3, shade: lod === 0 ? (l) => fold(l) : null });
  slab(B, V(0.012, y0 + 0.054, -0.006), [0.3, 0.024, 0.21], { nu: sg(lod, 14, 7), nv: sg(lod, 6, 3), round: 0.35 });
  if (lod === 0) {
    S(B, 'linen');
    curve(B, Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return V(-0.08 + 0.05 * Math.cos(a), y0 + 0.072, 0.05 * Math.sin(a)); }),
      Array(13).fill(0.012), 8);
    S(B, 'linen', { pat: PAT.AVNET });
    curve(B, Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return V(0.08 + 0.035 * Math.cos(a), y0 + 0.07, 0.035 * Math.sin(a)); }),
      Array(13).fill(0.009), 6);
  }
}

// ---------------------------------------------------------------------------------------------- offerings
// The tamid's limbs as carried (Tamid 4:3 — checked in sources/Mishnah Tamid): nine kohanim stand in a row "with
// the limbs in their hands": 1st the head in his right hand — its nose toward his arm, its horns between his
// fingers, the place of slaughter upward with the fat (peder) laid on it — and the right hind leg in his left,
// the skin side outward; 2nd the two fore legs; 3rd the tail-piece (oketz) with the alyah hanging between his
// fingers, the finger of the liver and the two kidneys with it, and the left hind leg; 4th the breast (chazeh) in
// his right and the neck (gerah) in his left, its ribs between his fingers; 5th the two flanks (dfanot), the skin
// side outward; 6th the entrails in a bazach with the lower legs (kera'ayim) on top; 7th the fine flour; 8th the
// chavitin; 9th the wine. The limbs lie on the open palm ('palm' grip: natural frame Y up out of the palm, −Z
// toward the fingertips, +Z back toward the wrist). An olah is flayed entire (Vayikra 1:6), so every limb shows
// fell and fat on its skin side and cut, marbled muscle and bone where it was jointed.
const PALM = basis([0, 1, 0], [0, 0, -1], [-1, 0, 0]);   // palm natural frame → fist frame
const palmGrip = (g = [0, 0, 0]) => ({ palm: { grip: g, rot: PALM }, tray: { grip: g, rot: ID() }, free: { rot: ID(), pos: [0, 0.04, 0] } });

/** a lofted lump of meat along z: profile rows [z, halfW, halfH, yCentre]; fell/fat outside, cut faces at the ends */
function meatLoft(B, lod, prof, o = {}) {
  const rows = lod === 0 ? prof : prof.filter((_, i) => i % 2 === 0 || i === prof.length - 1);
  const rings = rows.map(([z, w, h, y]) => ({ c: V(o.x || 0, y, z), rx: w, rz: h, ax: V(1, 0, 0), az: V(0, 1, 0) }));
  S(B, o.skin || 'fell');
  B.tube(rings, { seg: sg(lod, 16, 8), bone: 0, radial: lod === 0 ? (th, j) => 1 + 0.05 * Math.sin(th * 3 + j * 1.7) : null,
    shade: o.cutSide != null ? (th) => (Math.sin(th) * o.cutSide < -0.3 ? 0.75 : 1) : null });
  for (const end of o.cutEnds || [0, 1]) {
    const R = rings[end ? rings.length - 1 : 0];
    S(B, 'meat');
    B.ellipsoid(R.c.clone().add(V(0, 0, end ? -0.001 : 0.001)), [R.rx * 0.97, R.rz * 0.97, 0.003], { nu: sg(lod, 14, 7), nv: 2, bone: 0, lat: end ? [0.5, 1] : [0, 0.5],
      xf: new Matrix4().makeRotationX(Math.PI / 2 * (end ? -1 : 1)) });
  }
  return rings;
}
function boneEnd(B, p, r) { S(B, 'bone'); B.ellipsoid(p, [r, r, r * 0.6], { nu: 8, nv: 4, bone: 0 }); }

/** the lamb's head as the first limb-bearer holds it (Tamid 4:3): in the right hand, its nose toward his arm, its
 *  horns between his fingers, the place of slaughter uppermost with the fat (peder) laid on it. The head is NOT
 *  flayed: the flaying runs down the hung carcass only "until he reaches the breast; on reaching the breast he cut
 *  off the head" (Tamid 4:2), so it goes up in its hair, with ears and horns. Baked from the live lamb's head.
 *  Natural frame: the palm at y = 0, fingers toward −z, the wrist +z. */
function limbHead(B, lod) {
  const rig = getRig('lamb');
  const { fwd, up, hw, P0, len } = quadHeadFrame(rig);
  const I = rig.index;
  const headBones = new Set([I.head, I.jaw, I.ear_l, I.ear_r]);
  const base = B.count;
  const res = bakeAnimal(B, 'lamb', lod, () => {}, {
    tint: [0.3, 0.3, 0.4, 0.4],
    only: (si, sw, i) => { let w = 0; for (let k = 0; k < 4; k++) if (headBones.has(si[i * 4 + k])) w += sw[i * 4 + k] / 255; return w > 0.6; },
  });
  if (!res) return;
  // re-seat it: the nose (fwd) toward +z, the forehead (up) down on the palm, the poll and horns toward the fingers
  const side = new Vector3().crossVectors(up, fwd).normalize();
  const S0 = new Matrix4().makeBasis(side, up, fwd).invert();
  const T0 = new Matrix4().makeBasis(V(-1, 0, 0), V(0, -1, 0), V(0, 0, 1));
  const centre = P0.clone().addScaledVector(fwd, len * 0.5).addScaledVector(up, -hw * 0.1);
  const M = new Matrix4().makeTranslation(0, hw * 0.95, 0.01).multiply(T0).multiply(S0).multiply(new Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z));
  const v = new Vector3();
  for (let i = base; i < B.count; i++) {
    v.set(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2]).applyMatrix4(M);
    B.pos[i * 3] = v.x; B.pos[i * 3 + 1] = v.y; B.pos[i * 3 + 2] = v.z;
  }
  // the place of slaughter: the neck cut behind the jaw, uppermost, toward the fingers
  const cut = P0.clone().addScaledVector(fwd, len * 0.12).addScaledVector(up, -hw * 0.55).applyMatrix4(M);
  S(B, 'meat');
  B.ellipsoid(cut, [hw * 0.82, 0.006, hw * 0.7], { nu: sg(lod, 14, 7), nv: 3, bone: 0, lat: [0, 0.5] });
  S(B, 'meat', { color: '#e3d5c6' });   // the windpipe and gullet in the cut
  B.ellipsoid(cut.clone().add(V(0, 0.004, 0.012)), [0.009, 0.003, 0.009], { nu: 8, nv: 2, bone: 0, lat: [0, 0.5] });
  // the fat (peder) laid over the cut
  S(B, 'fat');
  slab(B, cut.clone().add(V(0, 0.012, -0.004)), [hw * 1.45, 0.014, hw * 1.15], { round: 0.55, nu: sg(lod, 12, 6), nv: 4, shade: (l) => 0.9 + 0.1 * Math.sin(l.x * 160) });
}

/** a fore leg (zeroa + the shoulder): shoulder blade end on the palm, the shank toward the fingers */
function limbForeleg(B, lod) {
  const prof = [[0.07, 0.04, 0.03, 0.04], [0.04, 0.05, 0.036, 0.04], [0.0, 0.046, 0.034, 0.038], [-0.05, 0.034, 0.028, 0.032], [-0.1, 0.022, 0.02, 0.026], [-0.14, 0.016, 0.016, 0.022], [-0.19, 0.013, 0.014, 0.02]];
  meatLoft(B, lod, prof, { cutSide: 1 });
  boneEnd(B, V(0, 0.02, -0.192), 0.011);
}

/** the tail-piece (oketz): the rump with the broad fat tail (alyah) hanging down between the fingers, the liver's
 *  lobe and the two kidneys with it */
function limbOketz(B, lod) {
  const prof = [[0.06, 0.06, 0.04, 0.05], [0.02, 0.07, 0.045, 0.052], [-0.03, 0.065, 0.042, 0.05], [-0.06, 0.05, 0.036, 0.046]];
  meatLoft(B, lod, prof);
  // the alyah hangs over the finger end
  S(B, 'fat');
  B.ellipsoid(V(0, -0.02, -0.11), [0.075, 0.1, 0.04], { nu: sg(lod, 14, 8), nv: sg(lod, 10, 5), bone: 0,
    xf: new Matrix4().makeRotationX(0.35), deform: (l) => { l.z += 0.012 * Math.exp(-((l.x / 0.015) ** 2)); return l; } });
  // kidneys and the lobe of the liver
  S(B, 'meat', { color: '#5a1c16', rough: 0.2 });
  for (const s of [-1, 1]) B.ellipsoid(V(s * 0.032, 0.085, 0.01), [0.018, 0.012, 0.026], { nu: 8, nv: 5, bone: 0 });
  S(B, 'meat', { color: '#4a1210', rough: 0.15 });
  B.ellipsoid(V(0.0, 0.088, 0.045), [0.03, 0.008, 0.022], { nu: 8, nv: 4, bone: 0 });
}

/** the breast (chazeh): the brisket with the sternum and the cartilage of the lower ribs */
function limbChazeh(B, lod) {
  const prof = [[0.08, 0.04, 0.02, 0.025], [0.04, 0.055, 0.024, 0.028], [-0.02, 0.06, 0.026, 0.03], [-0.07, 0.05, 0.024, 0.028], [-0.1, 0.035, 0.02, 0.026]];
  meatLoft(B, lod, prof, { cutSide: -1 });
  // the sternum: rounded segments (sternebrae) along the middle, the rib cartilages running off them
  S(B, 'bone', { color: '#e9e2d4' });
  for (let i = 0; i < 5; i++) B.ellipsoid(V(0, 0.049, 0.06 - i * 0.035), [0.011, 0.004, 0.014], { nu: sg(lod, 10, 6), nv: 4, bone: 0, lat: [0, 0.5] });
  S(B, 'fat', { color: '#e6d6c4' });
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) curve(B, [V(s * 0.008, 0.049, 0.043 - i * 0.035), V(s * 0.03, 0.046, 0.04 - i * 0.035), V(s * 0.05, 0.04, 0.034 - i * 0.035)], [0.003, 0.0028, 0.0025], 5);
}

/** the neck (gerah) with two ribs on each side, the windpipe, heart and lungs hanging from it */
function limbGerah(B, lod) {
  const prof = [[0.07, 0.035, 0.035, 0.04], [0.02, 0.04, 0.038, 0.042], [-0.04, 0.042, 0.04, 0.042], [-0.08, 0.05, 0.042, 0.044]];
  meatLoft(B, lod, prof);
  // the ribs reach out between the fingers
  S(B, 'bone');
  for (const s of [-1, 1]) for (const z of [-0.06, -0.085]) curve(B, [V(s * 0.04, 0.05, z), V(s * 0.07, 0.03, z - 0.04), V(s * 0.08, 0.0, z - 0.09)], [0.006, 0.005, 0.004], 5);
  // the windpipe and the heart and lungs hanging below the hand
  S(B, 'fat', { color: '#d8c3b0' });
  curve(B, [V(0, 0.01, 0.06), V(0, -0.03, 0.1), V(0.0, -0.08, 0.11)], [0.011, 0.011, 0.01], 8);
  S(B, 'meat', { color: '#c9726a', rough: 0.25 });
  for (const s of [-1, 1]) B.ellipsoid(V(s * 0.035, -0.12, 0.1), [0.035, 0.06, 0.022], { nu: 10, nv: 7, bone: 0 });
  S(B, 'meat', { color: '#5e1814', rough: 0.2 });
  B.ellipsoid(V(0, -0.105, 0.115), [0.026, 0.038, 0.024], { nu: 10, nv: 7, bone: 0, deform: (l) => { l.x *= 1 - 0.4 * smooth(0, -0.038, l.y); return l; } });
}

/** a flank (dofen): a slab of ribs, skin side outward; the right carries the liver, the left the spine and spleen */
function limbDofen(B, lod) {
  S(B, 'fell');
  const w = 0.11, len = 0.24;
  slab(B, V(0, 0.022, -0.02), [w, 0.03, len], { round: 0.4, nu: sg(lod, 14, 8), nv: sg(lod, 8, 4) });
  // the inner face: ribs and the meat between them
  S(B, 'meat');
  slab(B, V(0, 0.038, -0.02), [w * 0.92, 0.008, len * 0.94], { round: 0.6, nu: sg(lod, 12, 6), nv: 3 });
  // the ribs, rounded and curving with the flank, half sunk in the meat between them
  S(B, 'bone', { color: '#e6dccb' });
  for (let i = 0; i < 6; i++) {
    const z = 0.075 - i * 0.033;
    curve(B, [V(-w * 0.42, 0.036, z + 0.004), V(0, 0.041, z), V(w * 0.42, 0.036, z - 0.004)], [0.0045, 0.005, 0.0045], 6, { capA: 'flat', capB: 'flat' });
  }
  S(B, 'meat', { color: '#4a1210', rough: 0.15 });
  B.ellipsoid(V(0.02, -0.03, 0.02), [0.06, 0.018, 0.08], { nu: 10, nv: 6, bone: 0 });   // the liver hanging below
}

/** the entrails in a bazach with the lower legs (kera'ayim) laid on top */
function entrailsBazach(B, lod) {
  S(B, 'silver');
  vessel(B, [[0.001, 0], [0.08, 0], [0.12, 0.03], [0.135, 0.06], [0.14, 0.065]], sg(lod, 20, 10));
  S(B, 'fat', { color: '#d9b7a3', rough: 0.2 });
  const n = sg(lod, 26, 10), pts = [], rad = [];
  for (let i = 0; i <= n; i++) { const a = i * 0.9; const r = 0.03 + 0.07 * (i / n); pts.push(V(Math.cos(a) * r, 0.055 + 0.012 * Math.sin(i * 1.7), Math.sin(a) * r)); rad.push(0.012); }
  curve(B, pts, rad, 6);
  S(B, 'sinew');
  for (const [x, a] of [[-0.03, 0.4], [0.02, -0.3], [0.05, 0.9], [-0.05, -1.1]]) {
    const d = V(Math.sin(a), 0, Math.cos(a));
    rod(B, V(x, 0.08, 0).addScaledVector(d, -0.07), V(x, 0.085, 0).addScaledVector(d, 0.07), 0.009, 6);
    S(B, 'horn'); B.ellipsoid(V(x, 0.085, 0).addScaledVector(d, 0.075), [0.01, 0.012, 0.01], { nu: 6, nv: 4, bone: 0 }); S(B, 'sinew');
  }
}

// --- baked animals (the live rigs posed and skinned on the CPU, palette baked into the vertex colours) ---------
function bakeAnimal(B, kind, lod, poseFn, o = {}) {
  const def = ANIMALS[kind], rig = getRig(def.rig);
  const g = buildAnimalGeometry(def, rig, Math.min(1, lod));
  const P = new PoseBuilder(rig);
  P.reset();
  poseFn(P, rig);
  const M = new Float32Array(rig.n * 12);
  poseToSkin(rig, P.lp, M, 0);
  const pos = g.attributes.position.array, uv = g.attributes.uv.array, col = g.attributes.color.array, mat = g.attributes.pMat.array;
  const si = g.attributes.pIdx.array, sw = g.attributes.pW.array, idx = g.index.array;
  const pal = def.palette;
  const t = o.tint || [0.3, 0.3, 0.4, 0.4];
  const palCol = (cls) => {
    if (cls === 1) return pal[0].clone().lerp(pal[1], t[0]);
    if (cls === 2) return pal[2].clone().lerp(pal[3], t[1]);
    if (cls === 3) return pal[4 + Math.floor(t[2] * 4)];
    if (cls === 4) return pal[8 + Math.floor(t[3] * 4)];
    if (cls === 5) return pal[12];
    return null;
  };
  const base = B.count;
  const keep = new Uint8Array(pos.length / 3);
  for (let i = 0; i < pos.length / 3; i++) {
    const cg = mat[i * 4 + 3];
    const grp = Math.floor((cg + 0.5) / 8), cls = Math.round(cg) & 7;
    keep[i] = grp === 0 && (!o.only || o.only(si, sw, i)) ? 1 : 0;
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) {
      const w = sw[i * 4 + k] / 255;
      if (w <= 0) continue;
      const b = si[i * 4 + k] * 12, px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
      x += w * (M[b] * px + M[b + 1] * py + M[b + 2] * pz + M[b + 3]);
      y += w * (M[b + 4] * px + M[b + 5] * py + M[b + 6] * pz + M[b + 7]);
      z += w * (M[b + 8] * px + M[b + 9] * py + M[b + 10] * pz + M[b + 11]);
    }
    const pc = palCol(cls);
    B.pos.push(x, y, z);
    B.uv.push(uv[i * 2], uv[i * 2 + 1]);
    B.col.push(col[i * 3] * (pc ? pc.r : 1), col[i * 3 + 1] * (pc ? pc.g : 1), col[i * 3 + 2] * (pc ? pc.b : 1));
    B.mat.push(mat[i * 4], mat[i * 4 + 1], mat[i * 4 + 2], 0);
    B.si.push(0, 0, 0, 0); B.sw.push(1, 0, 0, 0);
  }
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    if (keep[a] && keep[b] && keep[c]) B.idx.push(base + a, base + b, base + c);
  }
  g.dispose();
  return { rig, P };
}

/** the lamb hung for flaying: pierced through the left hind hock and hung on the iron hook head-down (Tamid 4:2 —
 *  "he did not break the leg but pierced it through the hock and hung it"; the right hind leg is cut off while it
 *  hangs, the left last, so it hangs by the left). Natural frame: origin at the hook, the body below. */
function hungPose(P, rig) {
  const d = rig.dims;
  P.root(0, 0, 0, -90, 0, 0);                              // head down, back toward −z
  const I = rig.index;
  // the left hind leg straight up to the hook, the right one splayed out and flexed; fore legs hanging; head hangs
  const pv = P.worldPos('pelvis');
  P.twoBone(I.hl_up, I.hl_lo, I.hl_ft, pv.clone().add(new Vector3(-0.03, d.H * 0.62, 0.02)), new Vector3(0, 0, 1), new Vector3(0, 0, 1));
  P.rot('hr_up', 70, 0, 25); P.rot('hr_lo', -40, 0, 0);
  P.rot('fl_up', 80, 0, -8); P.rot('fr_up', 80, 0, 8); P.rot('fl_lo', 10, 0, 0); P.rot('fr_lo', 10, 0, 0);
  P.rot('neck', -40, 0, 0); P.rot('neck2', -30, 0, 0); P.rot('head', -20, 0, 0);
  P.rot('tail', 0, 0, 0);
  // put the hock (the left hind 'lo' joint) on the hook at the origin
  const hock = P.worldPos('hl_lo');
  P.root(-hock.x, -hock.y, -hock.z, -90, 0, 0);
}

function lambHung(B, lod) {
  if (!bakeAnimal(B, 'lamb', lod, hungPose, { tint: [0.3, 0.3, 0.2, 0.3] })) return;
  hookRing(B);
}
/** the iron hook's ring through the hock (the hook itself is part of the slaughterhouse fixtures) */
function hookRing(B) {
  S(B, 'iron');
  const pts = [], n = 10;
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts.push(V(Math.cos(a) * 0.02, 0.02 + Math.sin(a) * 0.02, 0)); }
  curve(B, pts, pts.map(() => 0.004), 5);
}

/** the flayed carcass hanging by the left hind leg (head and lower legs already off, belly opened) */
function carcassHungBody(B, lod, o = {}) {
  // body hanging along −y from the rump at the top; back toward −z
  const L = 0.6;
  const N = sg(lod, 22, 8);
  const rings = [];
  for (let j = 0; j <= N; j++) {
    const t = j / N; // 0 rump (top) → 1 neck (bottom)
    const y = -0.16 - t * L;
    const chest = smooth(0.45, 0.75, t) * (1 - smooth(0.9, 1, t));
    const rz = 0.075 + 0.04 * chest + 0.015 * (1 - smooth(0.05, 0.3, t));
    const rx = 0.07 + 0.03 * chest + 0.02 * (1 - smooth(0.05, 0.3, t));
    const end = Math.min(t, 1 - t);
    const tap = 0.55 + 0.45 * smooth(0, 0.12, end);
    rings.push({ c: V(0, y, 0), rx: rx * tap, rz: rz * tap, ax: V(1, 0, 0), az: V(0, 0, -1), t });
  }
  S(B, 'fell');
  B.tube(rings, { seg: sg(lod, 20, 10), bone: 0,
    radial: lod === 0 ? (th, j, R) => 1 + 0.02 * Math.abs(Math.cos(th)) * smooth(0.42, 0.52, R.t) * (1 - smooth(0.82, 0.92, R.t)) * (0.5 + 0.5 * Math.cos(j * Math.PI)) + 0.05 * Math.max(0, Math.sin(th)) ** 16 : null,
    shade: (th, j) => (o.opened && Math.sin(th) < -0.93 ? 0.35 : 1) });
  // the neck cut at the bottom
  S(B, 'meat');
  const f = rings[rings.length - 1];
  B.ellipsoid(f.c.clone().add(V(0, -0.002, 0)), [f.rx * 0.98, 0.006, f.rz * 0.98], { nu: sg(lod, 12, 6), nv: 3, bone: 0 });
  // the left hind leg up to the hook, the right hind leg out, the fore leg stumps; the fat tail on the rump
  S(B, 'sinew');
  curve(B, [V(-0.04, -0.17, 0.0), V(-0.035, -0.08, 0.0), V(-0.025, 0.0, 0.0), V(-0.02, 0.04, 0)], [0.05, 0.03, 0.017, 0.014], sg(lod, 10, 6));
  curve(B, [V(0.045, -0.17, 0.0), V(0.09, -0.12, -0.04), V(0.15, -0.1, -0.06)], [0.05, 0.032, 0.016], sg(lod, 10, 6));
  S(B, 'bone'); B.ellipsoid(V(0.155, -0.1, -0.06), [0.012, 0.012, 0.012], { nu: 6, nv: 4, bone: 0 });
  S(B, 'sinew');
  for (const s of [-1, 1]) curve(B, [V(s * 0.05, -0.62, 0.0), V(s * 0.06, -0.69, 0.02), V(s * 0.06, -0.74, 0.03)], [0.035, 0.022, 0.016], sg(lod, 8, 5));
  S(B, 'fat');
  B.ellipsoid(V(0, -0.16, 0.06), [0.075, 0.09, 0.035], { nu: sg(lod, 12, 6), nv: sg(lod, 6, 4), bone: 0 });
  hookRing(B);
  return rings;
}

/** half-way through the flaying (Tamid 4:2 "he flays downward until he reaches the breast"): the rear flayed, the
 *  fleece turned inside-out and hanging round the fore quarters, the head still on */
function carcassFlaying(B, lod) {
  carcassHungBody(B, lod);
  // the peeled hide hangs as a skirt from the chest, fleece outside, the pale inner face showing at the rolled edge
  const top = -0.42, bot = -0.86;
  const n = sg(lod, 22, 10), m = sg(lod, 6, 3);
  for (const inner of [false, true]) {
    S(B, inner ? 'hide' : 'fleeceProp');
    B.grid(n, m, (i, j) => {
      const a = (i / n) * Math.PI * 2, s = j / m;
      const r = (0.13 + 0.06 * s) * (inner ? 0.94 : 1) * (1 + 0.08 * Math.sin(a * 5 + s * 2));
      return { p: V(Math.cos(a) * r, lerp(top, bot, s) - 0.03 * Math.sin(a * 3) * s, -Math.sin(a) * r * 0.9), u: a * 0.15, v: s * 0.4, w: 0 };
    }, { inside: V(0, (top + bot) / 2, 0), invert: inner });
  }
  // the head, still on, hanging below
  S(B, 'coatProp');
  B.ellipsoid(V(0, -0.98, -0.02), [0.05, 0.11, 0.055], { nu: sg(lod, 12, 6), nv: sg(lod, 8, 4), bone: 0 });
}

/** the hide after flaying: the fleece spread, folded once, the pale inner face showing at the fold */
function hide(B, lod) {
  S(B, 'fleeceProp');
  slab(B, V(0, 0.03, 0), [0.62, 0.06, 0.5], { round: 0.35, nu: sg(lod, 18, 9), nv: sg(lod, 8, 4),
    shade: (l) => 0.85 + 0.15 * Math.sin(l.x * 40 + l.z * 31) });
  S(B, 'hide');
  slab(B, V(0.0, 0.012, 0.26), [0.6, 0.02, 0.04], { round: 0.5, nu: sg(lod, 12, 6), nv: 3 });
}

/** a dove held in the hand for melikah (Vayikra 1:15): its body in the palm, the head out between thumb and finger */
function doveHeld(B, lod) {
  bakeAnimal(B, 'pigeon', lod, (P) => { P.root(0, -0.085, 0.01, 0, 0, 0); P.rot('neck', 10, 0, 0); }, { tint: [0.3, 0.3, 0.4, 0.4] });
}

/** a wicker cage with a pair of birds (bird offerings come in pairs — Vayikra 5:7, 12:8; Kinnim) */
function birdCage(B, lod, kind = 'turtledove') {
  S(B, 'reed');
  const rr = 0.13, h = 0.16;
  B.tube([{ c: V(0, 0.0, 0), rx: rr, rz: rr * 0.7 }, { c: V(0, 0.012, 0), rx: rr, rz: rr * 0.7 }], { seg: 16, bone: 0, capA: 'flat' });
  const nb = sg(lod, 16, 8);
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * Math.PI * 2;
    curve(B, [V(Math.cos(a) * rr, 0.01, Math.sin(a) * rr * 0.7), V(Math.cos(a) * rr * 0.98, h * 0.7, Math.sin(a) * rr * 0.69), V(Math.cos(a) * rr * 0.4, h, Math.sin(a) * rr * 0.28)], [0.0035, 0.0035, 0.003], 4);
  }
  for (const y of [h * 0.35, h * 0.7]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push(V(Math.cos(a) * rr * 0.99, y, Math.sin(a) * rr * 0.7)); }
    curve(B, pts, pts.map(() => 0.004), 4);
  }
  curve(B, [V(-0.04, h - 0.005, 0), V(0, h + 0.05, 0), V(0.04, h - 0.005, 0)], [0.005, 0.005, 0.005], 5);   // the handle
  for (const [x, z, ry] of [[-0.05, 0.0, 0.5], [0.05, 0.01, -2.4]]) {
    bakeAnimal(B, kind, lod, (P) => { P.root(x, 0.008, z, 0, ry * 57.3, 0); P.off('body', 0, -0.02, 0); P.rot('body', 4, 0, 0); P.off('neck', 0, -0.012, 0.008); }, { tint: [0.3, 0.3, 0.4, 0.4] });
  }
}

/** a gold cup (Tamid 3:4 "they watered the tamid from a gold cup") */
function cupGold(B, lod) {
  S(B, 'gold');
  vessel(B, [[0.001, 0], [0.03, 0], [0.034, 0.006], [0.012, 0.016], [0.011, 0.03], [0.03, 0.04], [0.048, 0.07], [0.052, 0.1], [0.054, 0.104]], sg(lod, 20, 10), 0.002);
  S(B, 'liquid', { color: '#7f9aa8' });
  B.ellipsoid(V(0, 0.088, 0), [0.049, 0.002, 0.049], { nu: 14, nv: 2, bone: 0, lat: [0, 0.5] });
}

/** meal-offering pans (Menachot 5:8): the machavat flat — "its works are hard" — and the marcheshet deep — "its works
 *  soft" (R' Chanina b. Gamliel) — with a lid (R' Yosi HaGelili); both of copper here (reconstruction) */
function machavat(B, lod) {
  S(B, 'copper');
  vessel(B, [[0.001, 0], [0.16, 0], [0.17, 0.006], [0.172, 0.018], [0.175, 0.02]], sg(lod, 24, 12), 0.004);
  rod(B, V(0.17, 0.014, 0), V(0.34, 0.03, 0), 0.008, 6);
}
function marcheshet(B, lod) {
  S(B, 'copper');
  vessel(B, [[0.001, 0], [0.09, 0], [0.12, 0.03], [0.13, 0.09], [0.135, 0.1]], sg(lod, 24, 12), 0.004);
  lathe(B, [[0.14, 0.1], [0.12, 0.115], [0.05, 0.13], [0.012, 0.132], [0.014, 0.15], [0.001, 0.155]], sg(lod, 20, 10), { capB: 'flat' });
  for (const s of [-1, 1]) curve(B, [V(s * 0.13, 0.08, 0), V(s * 0.165, 0.085, 0), V(s * 0.13, 0.05, 0)], [0.006, 0.006, 0.006], 5);
}

/** fine flour (solet) heaped in a silver vessel, mingled with oil */
function solet(B, lod) {
  S(B, 'silver');
  vessel(B, [[0.001, 0], [0.06, 0], [0.09, 0.03], [0.1, 0.06], [0.104, 0.065]], sg(lod, 20, 10));
  S(B, 'flour');
  B.ellipsoid(V(0, 0.058, 0), [0.097, 0.03, 0.097], { nu: sg(lod, 16, 8), nv: 5, bone: 0, lat: [0, 0.5], deform: (l) => { l.y *= 1 + 0.15 * Math.sin(l.x * 60) * Math.sin(l.z * 50); return l; } });
}

/** the chavitin: the Kohen Gadol's daily griddle-cakes, half offered in the morning (Lev 6:13; report §65.5) */
function chavitin(B, lod) {
  machavat(B, lod);
  S(B, 'bread');
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, r = i ? 0.09 : 0;
    B.ellipsoid(V(Math.cos(a) * r, 0.016 + (i % 2) * 0.004, Math.sin(a) * r), [0.055, 0.01, 0.055], { nu: sg(lod, 12, 6), nv: 4, bone: 0 });
  }
}

/** the loaves of a todah (Menachot 7:1): forty — ten each of chametz, challot, rekikin and revuchah — on a tray */
function loavesTodah(B, lod) {
  S(B, 'reed');
  vessel(B, [[0.001, 0], [0.2, 0], [0.22, 0.03], [0.225, 0.035]], sg(lod, 20, 10), 0.006);
  S(B, 'bread');
  const n = lod === 0 ? 16 : 6;
  for (let i = 0; i < n; i++) {
    const a = i * 2.4, r = 0.03 + 0.15 * Math.sqrt(i / n);
    const thin = i % 3 === 0;
    B.ellipsoid(V(Math.cos(a) * r, 0.03 + (i % 4) * 0.012, Math.sin(a) * r), thin ? [0.045, 0.004, 0.045] : [0.04, 0.016, 0.04], { nu: sg(lod, 10, 6), nv: 4, bone: 0 });
  }
}

/** oil and wine: a small silver flask of oil (a log measure) and a silver jug of libation wine */
function flaskOil(B, lod) {
  S(B, 'silver');
  lathe(B, [[0.001, 0], [0.035, 0], [0.045, 0.03], [0.04, 0.07], [0.016, 0.1], [0.014, 0.12], [0.02, 0.125], [0.012, 0.127]], sg(lod, 16, 8), { capA: 'flat' });
}
function jugWine(B, lod) {
  S(B, 'silver');
  vessel(B, [[0.001, 0], [0.05, 0], [0.075, 0.05], [0.07, 0.12], [0.04, 0.17], [0.034, 0.2], [0.042, 0.215]], sg(lod, 18, 9));
  curve(B, [V(0, 0.19, 0.035), V(0, 0.2, 0.08), V(0, 0.13, 0.085), V(0, 0.08, 0.07)], [0.007, 0.007, 0.007, 0.007], 6);
  S(B, 'liquid', { color: '#3a0c12' });
  B.ellipsoid(V(0, 0.2, 0), [0.033, 0.002, 0.033], { nu: 12, nv: 2, bone: 0, lat: [0, 0.5] });
}
/** coarse salt in a bowl ("on all your offerings you shall offer salt" — Vayikra 2:13; the limbs were salted on the
 *  ramp, Tamid 4:3) */
function saltBowl(B, lod) {
  S(B, 'woodDark');
  vessel(B, [[0.001, 0], [0.06, 0], [0.085, 0.03], [0.09, 0.05], [0.092, 0.053]], sg(lod, 18, 9));
  S(B, 'salt');
  B.ellipsoid(V(0, 0.045, 0), [0.084, 0.022, 0.084], { nu: sg(lod, 14, 8), nv: 4, bone: 0, lat: [0, 0.5], deform: (l) => { l.y *= 1 + 0.3 * Math.sin(l.x * 90) * Math.sin(l.z * 70); return l; } });
}

/** the shechitah knife (chalaf): a long, smooth, straight blade with a square end, many times the neck's width
 *  (reconstruction of its form); wooden grip with rivets */
function knifeSlaughter(B, lod) {
  S(B, 'woodDark'); slab(B, V(0, -0.055, 0), [0.024, 0.11, 0.02], { round: 0.5, nu: 10, nv: 6 });
  S(B, 'bronze'); for (const y of [-0.08, -0.03]) B.ellipsoid(V(0, y, 0.0105), [0.004, 0.004, 0.0015], { nu: 6, nv: 3, bone: 0 });
  S(B, 'iron', { rough: 0.22 });
  B.box(V(0, 0.003, 0), [0.03, 0.01, 0.006]);
  // the blade: 26 cm, its edge bevelled
  const n = 6;
  for (let i = 0; i < n; i++) {
    const y0 = 0.008 + (i / n) * 0.26, y1 = 0.008 + ((i + 1) / n) * 0.26;
    B.box(V(0.002, (y0 + y1) / 2, 0), [0.032 - 0.002 * (i / n), y1 - y0, 0.0026], { taper: [1, 1] });
  }
  B.box(V(-0.014, 0.138, 0), [0.004, 0.26, 0.0012]);   // the honed edge
}
/** a shorter, pointed knife for flaying and jointing */
function knifeFlay(B, lod) {
  S(B, 'woodDark'); slab(B, V(0, -0.045, 0), [0.022, 0.09, 0.019], { round: 0.5, nu: 10, nv: 6 });
  S(B, 'iron', { rough: 0.25 });
  B.box(V(0, 0.075, 0), [0.026, 0.15, 0.0028], { taper: [0.12, 1] });
}
/** the fork (tzinorah) for turning the limbs on the pyre (Tamid 1:4 "they took the magrefot and the tzinorot") */
function fork(B, lod) {   // handle up from the hands (natural +y), the prongs at the far end (−y), like the magrefah
  S(B, 'wood'); rodY(B, -1.2, 0.06, 0.016, 0.016, sg(lod, 8, 5), { capB: 'flat' });
  S(B, 'copper');
  rodY(B, -1.28, -1.19, 0.011, 0.014, 8);
  for (const s of [-1, 1]) curve(B, [V(0, -1.275, 0), V(s * 0.03, -1.3, 0), V(s * 0.032, -1.44, 0), V(s * 0.03, -1.46, 0)], [0.007, 0.006, 0.005, 0.002], 5, { capB: 'flat' });
}

export const OFFERING_PROPS = {
  limb_head: { flesh: true, build(B, lod) { limbHead(B, lod); }, grips: palmGrip([0, 0, 0.01]) },
  limb_foreleg: { flesh: true, build(B, lod) { limbForeleg(B, lod); }, grips: palmGrip([0, 0, 0.02]) },
  limb_oketz: { flesh: true, build(B, lod) { limbOketz(B, lod); }, grips: palmGrip([0, 0, 0.01]) },
  limb_chazeh: { flesh: true, build(B, lod) { limbChazeh(B, lod); }, grips: palmGrip([0, 0, 0]) },
  limb_gerah: { flesh: true, build(B, lod) { limbGerah(B, lod); }, grips: palmGrip([0, 0, -0.01]) },
  limb_dofen: { flesh: true, big: true, build(B, lod) { limbDofen(B, lod); }, grips: palmGrip([0, 0, 0]) },
  entrails_bazach: { flesh: true, build(B, lod) { entrailsBazach(B, lod); }, grips: { tray: { grip: [0, 0, 0], rot: ID() }, free: { rot: ID(), pos: [0, 0, 0] } } },
  lamb_hung: { flesh: true, big: true, build(B, lod) { lambHung(B, lod); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } },
  carcass_flaying: { flesh: true, big: true, build(B, lod) { carcassFlaying(B, lod); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } },
  carcass_hung: { flesh: true, big: true, build(B, lod) { carcassHungBody(B, lod, { opened: true }); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } },
  hide: { flesh: true, big: true, build(B, lod) { hide(B, lod); }, grips: { shoulder: { grip: [0, -0.02, 0], rot: eul(0, 0, 10) }, free: { rot: ID(), pos: [0, 0, 0] } } },
  dove_held: { flesh: true, build(B, lod) { doveHeld(B, lod); }, grips: { palm: { grip: [0, 0, 0], rot: PALM }, free: { rot: ID(), pos: [0, 0, 0] } } },
  bird_cage: { flesh: true, big: true, build(B, lod) { birdCage(B, lod, 'turtledove'); }, grips: { fist: { grip: [0, 0.2, 0], rot: eul(0, 90, 0) }, tray: { grip: [0, 0, 0], rot: ID() }, free: { rot: ID(), pos: [0, 0, 0] } } },
  bird_cage_pigeons: { flesh: true, big: true, build(B, lod) { birdCage(B, lod, 'pigeon'); }, grips: { fist: { grip: [0, 0.2, 0], rot: eul(0, 90, 0) }, tray: { grip: [0, 0, 0], rot: ID() }, free: { rot: ID(), pos: [0, 0, 0] } } },
  cup_gold: { build(B, lod) { cupGold(B, lod); }, grips: { fist: { grip: [0.05, 0.06, 0], rot: eul(0, -90, 0) }, free: { rot: ID(), pos: [0, 0, 0] } } },
  knife_flay: { build(B, lod) { knifeFlay(B, lod); }, grips: { free: { rot: eul(0, 0, 90), pos: [0, 0.011, 0] } } },
  fork: { big: true, build(B, lod) { fork(B, lod); }, grips: { free: { rot: eul(0, 0, 90), pos: [0, 0.02, 0] } } },
  machavat: { build(B, lod) { machavat(B, lod); }, grips: { fist: { grip: [0.3, 0.025, 0], rot: eul(0, 90, 0) }, tray: { grip: [0, 0, 0], rot: ID() } } },
  marcheshet: { build(B, lod) { marcheshet(B, lod); }, grips: { tray: { grip: [0, 0, 0], rot: ID() } } },
  solet: { build(B, lod) { solet(B, lod); }, grips: { palm: { grip: [0, 0, 0], rot: PALM }, tray: { grip: [0, 0, 0], rot: ID() } } },
  chavitin: { build(B, lod) { chavitin(B, lod); }, grips: { palm: { grip: [0, 0, 0], rot: PALM }, tray: { grip: [0, 0, 0], rot: ID() } } },
  loaves_todah: { big: true, build(B, lod) { loavesTodah(B, lod); }, grips: { tray: { grip: [0, 0, 0], rot: ID() }, shoulder: { grip: [0, 0, 0], rot: ID() } } },
  oil_flask: { build(B, lod) { flaskOil(B, lod); }, grips: { fist: { grip: [0, 0.11, 0], rot: ID() }, palm: { grip: [0, 0, 0], rot: PALM } } },
  wine_jug: { build(B, lod) { jugWine(B, lod); }, grips: { fist: { grip: [0, 0.14, 0.08], rot: ID() }, palm: { grip: [0, 0, 0], rot: PALM }, tray: { grip: [0, 0, 0], rot: ID() } } },
  salt: { build(B, lod) { saltBowl(B, lod); }, grips: { palm: { grip: [0, 0, 0], rot: PALM }, tray: { grip: [0, 0, 0], rot: ID() } } },
};
// props that can stand on the palms in a two-handed carry
for (const k of ['solet', 'chavitin', 'salt', 'wine_jug', 'marcheshet', 'machavat', 'entrails_bazach', 'cup_gold']) VESSELS.add(k);

Object.assign(PROPS, OFFERING_PROPS);

// ---------------------------------------------------------------------------------------------- placement
const M_R = basis([0, -1, 0], [0, 0, -1], [1, 0, 0]);   // fist frame → right hand-local
const M_L = basis([0, -1, 0], [0, 0, -1], [-1, 0, 0]);  // mirrored for the left hand

function gripOf(name, cls) {
  const p = PROPS[name];
  const g = p.grips?.[cls];
  if (g) return { grip: g.grip || [0, 0, 0], rot: g.rot || ID(), pos: g.pos || [0, 0, 0] };
  if (cls === 'free') return { grip: [0, 0, 0], rot: ID(), pos: [0, 0, 0] };
  // vessels carried in both hands sit upright on the palms (natural frame, base on the hands)
  if (cls === 'tray') return VESSELS.has(name) ? { grip: [0, 0, 0], rot: ID(), pos: [0, 0, 0] } : null;
  if (cls === 'shoulder' || cls === 'palm' || cls.startsWith('pillow')) return null;
  return { grip: [0, 0, 0], rot: ID(), pos: [0, 0, 0] };
}

/** resolve the grip class actually available for a prop (tray/shoulder/pillow fall back to the fist) */
export function gripClass(name, cls) { return gripOf(name, cls) ? cls : 'fist'; }

function placementMatrix(name, cls, side) {
  const g = gripOf(name, cls) || gripOf(name, 'fist');
  const m = new Matrix4().makeTranslation(-g.grip[0], -g.grip[1], -g.grip[2]);
  m.premultiply(g.rot);
  if (cls === 'free') m.premultiply(new Matrix4().makeTranslation(...g.pos));
  else if (cls === 'fist' || cls === 'palm' || !gripOf(name, cls)) m.premultiply(side === 'l' ? M_L : M_R);
  else if (side === 'l' && !cls.startsWith('pillow')) m.premultiply(new Matrix4().makeScale(-1, 1, 1));
  return m;
}

/** geometry of a prop placed for (grip class, side) in the attach bone's frame */
export function buildPropGeometry(name, cls, side, lod) {
  const B = new MeshBuilder(null);
  const real = cls === 'free' ? 'free' : gripClass(name, cls);
  PROPS[name].build(B, lod, real);
  B.applyMatrix(placementMatrix(name, real, side));
  return B.build();
}

/** flame/tip point (geometry frame) of a prop, or null */
export function propTip(name, cls, side) {
  const p = PROPS[name];
  if (!p?.tip) return null;
  const real = cls === 'free' ? 'free' : gripClass(name, cls);
  return new Vector3(...p.tip).applyMatrix4(placementMatrix(name, real, side));
}

/** floor point under the head of a figure in a lying clip, in the root bone's frame */
function pillowPoint(rig, clipName) {
  const clip = HUMAN_CLIPS[clipName];
  const P = new PoseBuilder(rig);
  clip.fn(P, rig, 0);
  const hq = P.worldQ('head'), hp = P.worldPos('head');
  const hs = rig.dims.headS;
  const C = new Vector3(0, 0.075 * hs, -0.008 * hs).applyQuaternion(hq).add(hp); // head centre (see human.js headFrame)
  const rq = P.worldQ('root'), rp = P.worldPos('root');
  return new Vector3(C.x, 0, C.z).sub(rp).applyQuaternion(rq.invert());
}

const _attach = new Map();
/**
 * attach point of a prop on a rig: { bone, x, y, z, cls } where xyz = the attach bone's rest position plus the
 * grip offset (the vertex shader turns this into bone-world × (offset + vertex)) and cls = the grip class used.
 */
export function propAttach(name, cls, side, rig) {
  const real = gripClass(name, cls);
  const key = `${rig.key}:${real}:${side}`;
  if (_attach.has(key)) return _attach.get(key);
  let out = null;
  if (rig.kind === 'human') {
    const d = rig.dims, k = d.H / 1.67, sgn = side === 'l' ? -1 : 1;
    if (real === 'fist' || real === 'palm') {
      const b = rig.index[`hand_${side}`];
      const g = gripOffset(rig, side);
      const r = rig.rest[b];
      out = { bone: b, x: r.x + g.x, y: r.y + g.y, z: r.z + g.z };
    } else if (real === 'tray') {
      out = { bone: rig.index.chest, x: 0, y: d.H * 0.585 - 0.025 * k, z: -0.27 * k };
    } else if (real === 'shoulder') {
      const b = rig.index[`clav_${side}`];
      out = { bone: b, x: sgn * d.shX * 0.86, y: rig.rest[rig.index.uarm_r].y + 0.072 * k, z: 0.03 * k };
    } else if (real === 'pillow_side' || real === 'pillow_back') {
      const p = pillowPoint(rig, real === 'pillow_side' ? 'sleep' : 'lie');
      out = { bone: rig.index.root, x: p.x, y: p.y, z: p.z };
    }
    if (out) out.cls = real;
  } else {
    // animals carry nothing; birds/beasts with props are unsupported
    out = null;
  }
  _attach.set(key, out);
  return out;
}

export const PROP_NAMES = Object.keys(PROPS);
export { Color, Quaternion };

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
import { PoseBuilder } from './pose.js';
import { DEG, smooth, lerp } from './util.js';
import { AMAH } from '../core/units.js';

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
  fell: { color: '#cfa58b', rough: 0.38, metal: 0, pat: PAT.FAT },     // the outside of a flayed carcass: fat & fell
  sinew: { color: '#b0705c', rough: 0.34, metal: 0, pat: PAT.FAT },    // flayed lower legs: tendon and thin fascia
  fat: { color: '#e9dcc4', rough: 0.42, metal: 0, pat: PAT.FAT },
  bone: { color: '#e8e0cf', rough: 0.5, metal: 0, pat: PAT.NONE },
  reed: { color: '#c4a46a', rough: 0.8, metal: 0, pat: PAT.REED },
  horn: { color: '#bfa57c', rough: 0.45, metal: 0, pat: PAT.HORN },
  string: { color: '#e9e1cc', rough: 0.6, metal: 0, pat: PAT.CORD },
  pitch: { color: '#2f241b', rough: 0.95, metal: 0, pat: PAT.CORD },
  mat: { color: '#7d6a55', rough: 0.95, metal: 0, pat: PAT.WOOL },
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
  kinnor: { // lyre of the Mikdash — seven strings (Arachin 13b)
    build(B, lod) {
      S(B, 'wood');
      B.box(V(0, 0.07, 0), [0.26, 0.14, 0.06]);
      for (const s of [-1, 1]) curve(B, [V(s * 0.1, 0.13, 0), V(s * 0.135, 0.23, 0), V(s * 0.14, 0.33, 0), V(s * 0.125, 0.43, 0)], [0.016, 0.014, 0.013, 0.012], sg(lod, 8, 5), { capB: 'flat' });
      rod(B, V(-0.155, 0.405, 0), V(0.155, 0.405, 0), 0.011, sg(lod, 8, 5));
      if (lod === 0) {
        S(B, 'string');
        for (let i = 0; i < 7; i++) {
          const x = -0.075 + i * 0.025;
          B.ribbon([V(x, 0.05, -0.034), V(x * 1.15, 0.397, -0.01)], 0.0018, { side: V(1, 0, 0), weights: 0 });
        }
      }
    },
    grips: { fist: { grip: [0.135, 0.29, 0], rot: eul(0, 180, 0) }, free: { rot: eul(-80, 0, 0), pos: [0, 0.03, 0] } },
  },
  nevel: { // larger harp-lyre; ten strings ("nevel asor", Tehillim 33:2)
    big: true,
    build(B, lod) {
      S(B, 'woodDark');
      B.ellipsoid(V(0, 0.15, 0), [0.15, 0.15, 0.065], { nu: sg(lod, 16, 9), nv: sg(lod, 8, 5), bone: 0 });
      for (const s of [-1, 1]) curve(B, [V(s * 0.09, 0.26, 0), V(s * 0.14, 0.42, 0), V(s * 0.15, 0.58, 0), V(s * 0.12, 0.72, 0)], [0.02, 0.017, 0.015, 0.014], sg(lod, 8, 5), { capB: 'flat' });
      rod(B, V(-0.16, 0.69, 0), V(0.16, 0.69, 0), 0.014, sg(lod, 8, 5));
      if (lod === 0) {
        S(B, 'string');
        for (let i = 0; i < 10; i++) {
          const x = -0.09 + i * 0.02;
          B.ribbon([V(x, 0.1, -0.066), V(x * 1.2, 0.68, -0.012)], 0.002, { side: V(1, 0, 0), weights: 0 });
        }
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
  knife: { // iron blade (chalaf) — iron never touched the altar, it is used in the slaughter zone
    build(B, lod) {
      S(B, 'woodDark'); B.box(V(0, -0.005, 0), [0.024, 0.11, 0.02]);
      S(B, 'iron', { rough: 0.3 });
      B.box(V(0, 0.155, 0), [0.034, 0.21, 0.003], { taper: [0.15, 1] });
    },
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
  magrefah: { // the long ash shovel/rake
    big: true,
    build(B, lod) {
      S(B, 'wood'); rodY(B, -1.25, 0.06, 0.016, 0.016, sg(lod, 8, 5), { capB: 'flat' });
      S(B, 'copper');
      B.box(V(0, -1.33, -0.05), [0.22, 0.16, 0.006], { m: eul(30, 0, 0) });
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

function pan(B, lod, metal, p, o = {}) {
  S(B, metal);
  const { w, d, h, wall: t } = p;
  B.box(V(0, t / 2, 0), [w, t, d]);
  B.box(V(0, h / 2, d / 2 - t / 2), [w, h, t]); B.box(V(0, h / 2, -d / 2 + t / 2), [w, h, t]);
  B.box(V(w / 2 - t / 2, h / 2, 0), [t, h, d - 2 * t]); B.box(V(-w / 2 + t / 2, h / 2, 0), [t, h, d - 2 * t]);
  if (lod === 0) { // a rolled rim
    for (const [c, s] of [[V(0, h, d / 2 - t / 2), [w + t, t * 1.2, t * 1.6]], [V(0, h, -d / 2 + t / 2), [w + t, t * 1.2, t * 1.6]],
      [V(w / 2 - t / 2, h, 0), [t * 1.6, t * 1.2, d]], [V(-w / 2 + t / 2, h, 0), [t * 1.6, t * 1.2, d]]]) B.box(c, s);
  }
  const a = V(0, h * 0.7, d / 2), b = V(0, h * 0.7 + p.handle * 0.22, d / 2 + p.handle);
  rod(B, a, b, p.rod, sg(lod, 8, 5));
  if (o.ring) { // the ne'ashtik: a ring at the end of the long handle (reconstruction of the word's sense)
    const dir = b.clone().sub(a).normalize();
    const n = sg(lod, 12, 6), pts = [], rad = [];
    for (let i = 0; i <= n; i++) {
      const ang = (i / n) * Math.PI * 2;
      pts.push(b.clone().addScaledVector(dir, 0.024 + 0.022 * Math.cos(ang)).add(V(0.022 * Math.sin(ang), 0, 0)));
      rad.push(0.0035);
    }
    curve(B, pts, rad, 5);
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

// ---------------------------------------------------------------------------------------------- placement
const M_R = basis([0, -1, 0], [0, 0, -1], [1, 0, 0]);   // fist frame → right hand-local
const M_L = basis([0, -1, 0], [0, 0, -1], [-1, 0, 0]);  // mirrored for the left hand

const VESSELS = new Set(['teni', 'kuz', 'flask', 'kaf', 'bazach', 'mizrak_gold', 'mizrak_silver', 'bowl', 'machtah_silver', 'machtah_gold', 'machtah_gold_yk', 'lot']);

function gripOf(name, cls) {
  const p = PROPS[name];
  const g = p.grips?.[cls];
  if (g) return { grip: g.grip || [0, 0, 0], rot: g.rot || ID(), pos: g.pos || [0, 0, 0] };
  if (cls === 'free') return { grip: [0, 0, 0], rot: ID(), pos: [0, 0, 0] };
  // vessels carried in both hands sit upright on the palms (natural frame, base on the hands)
  if (cls === 'tray') return VESSELS.has(name) ? { grip: [0, 0, 0], rot: ID(), pos: [0, 0, 0] } : null;
  if (cls === 'shoulder' || cls.startsWith('pillow')) return null;
  return { grip: [0, 0, 0], rot: ID(), pos: [0, 0, 0] };
}

/** resolve the grip class actually available for a prop (tray/shoulder/pillow fall back to the fist) */
export function gripClass(name, cls) { return gripOf(name, cls) ? cls : 'fist'; }

function placementMatrix(name, cls, side) {
  const g = gripOf(name, cls) || gripOf(name, 'fist');
  const m = new Matrix4().makeTranslation(-g.grip[0], -g.grip[1], -g.grip[2]);
  m.premultiply(g.rot);
  if (cls === 'free') m.premultiply(new Matrix4().makeTranslation(...g.pos));
  else if (cls === 'fist' || !gripOf(name, cls)) m.premultiply(side === 'l' ? M_L : M_R);
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
    if (real === 'fist') {
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

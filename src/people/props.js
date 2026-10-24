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
//   palm / pour / rims — hand classes like fist with their own seating: on the open palm; upright for tipping over the
//              lip (pour_low); a basket held by its rims (wave_basket). A prop without one falls back to its fist grip.
import { Vector3, Matrix4, Euler, Quaternion, Color } from 'three';
import { MeshBuilder, PAT, CLS } from './builder.js';
import { gripOffset, HUMAN_CLIPS } from './clips.js';
import { PoseBuilder, poseToSkin } from './pose.js';
import { clothCage, clothSkin } from './cloth.js';
import { RECIPES } from './human.js';
import { MAX_BONES } from './rig.js';
import { DEG, smooth, lerp, clamp } from './util.js';
import { STAFF, handQ, RIMS_HAND, SLAIN_HANDS } from './clips.js';
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
  clay: { color: '#9c5f3d', rough: 0.88, metal: 0, pat: PAT.FLOUR },   // unglazed earthenware (the flour's matte grain)
};

/** override metal tints from the world material library (ctx.mats) so props match the architecture */
export function setPropMetals(m) {
  for (const k of ['gold', 'goldGreen', 'goldRed', 'silver', 'copper', 'iron', 'bronze']) if (m[k]) MAT[k] = { ...MAT[k], color: m[k] };
}

// Charred variants (limbs on the pyre, Tamid 2:1 "the limbs not consumed since evening"): while CHAR is set every
// flesh material is swapped for its roasted / charred look (cracked black crust, the PAT.CHAR pattern) and baked animal
// parts (the head) are blackened — same geometry, so a limb can be swapped for its charred twin in place.
let CHAR = false;
const CHARRED = {
  meat: { color: '#140c09', rough: 0.88 }, fell: { color: '#160d09', rough: 0.88 }, fat: { color: '#1c110b', rough: 0.85 },
  sinew: { color: '#160d0a', rough: 0.88 }, bone: { color: '#24201c', rough: 0.9 }, hide: { color: '#170f0b', rough: 0.88 },
  string: { color: '#1a1512', rough: 0.9 }, pitch: { color: '#14100d', rough: 0.9 },
  fleeceProp: { color: '#120f0d', rough: 0.8 }, coatProp: { color: '#110d0b', rough: 0.7 }, horn: { color: '#1c1714', rough: 0.55 },
};
const S = (B, key, extra = {}) => {
  if (CHAR && CHARRED[key]) return B.set({ ...MAT[key], ...extra, ...CHARRED[key], metal: 0, pat: PAT.CHAR, cls: CLS.FIX, grp: 0 });
  return B.set({ ...MAT[key], cls: CLS.FIX, grp: 0, ...extra });
};
/** build fn as its charred twin */
const charred = (fn) => (B, lod, cls) => { CHAR = true; try { fn(B, lod, cls); } finally { CHAR = false; } };
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

/** slab() with its poles closed: the superellipsoid's exponent blows the ellipsoid's tiny pole rings up into a square
 *  hole on the top and bottom faces (≈ 13 % of the side at round 0.32); collapse each ring onto its centre (people-4) */
function slabC(B, c, size, opts = {}) {
  const nu = opts.nu || 16, nv = opts.nv || 8;
  const g = slab(B, c, size, opts);
  for (const j of [0, nv]) {
    let x = 0, y = 0, z = 0;
    for (let i = 0; i <= nu; i++) { const k = g.id(i, j) * 3; x += B.pos[k]; y += B.pos[k + 1]; z += B.pos[k + 2]; }
    x /= nu + 1; y /= nu + 1; z /= nu + 1;
    for (let i = 0; i <= nu; i++) { const k = g.id(i, j) * 3; B.pos[k] = x; B.pos[k + 1] = y; B.pos[k + 2] = z; }
  }
  return g;
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

// the kaf: a deep round gold vessel sized to hold exactly 3 kav (Tamid 5:4) with a short side handle (reconstruction)
const KAF = (() => {
  const base = [[0.001, 0], [0.08, 0], [0.112, 0.022], [0.128, 0.05], [0.134, 0.075], [0.136, 0.086], [0.14, 0.09]];
  let v = 0;
  for (let i = 1; i < base.length; i++) { const [r0, y0] = base[i - 1], [r1, y1] = base[i]; v += Math.PI * (y1 - y0) * (r0 * r0 + r0 * r1 + r1 * r1) / 3; }
  const sc = Math.cbrt((3 * KAV_M3) / v);
  const prof = base.map(([r, y]) => [r * sc, y * sc]);
  const rim = prof[prof.length - 1];
  return { prof, sc, rimR: rim[0], rimY: rim[1], h0: V(0, 0.05 * sc, 0.128 * sc), h1: V(0, 0.072 * sc, 0.128 * sc + 0.11), grip: [0, 0.07 * sc, 0.128 * sc + 0.1] };
})();
// the kaf held by its handle in a hanging hand (stand_hold / walk_hold, and any stand / walk): the pan pitched down 19°
// about its handle grip, which is how far the hanging hand's fingers point forward of the vertical — the rim stays
// level and the cover on (PAN_FIST alone tipped it 19° in stand, 34° at the walk's back swing)
const KAF_FIST = PAN_FIST.clone().multiply(new Matrix4().makeRotationX(-19 * DEG));
const KAF_POSES = { stand: 'stand_hold', walk: 'walk_hold' };

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
  kaf: { // the ketoret kaf "like a large gold tarkav, holding three kav" with the bazach in it (Tamid 5:4)
    build(B, lod) { kaf(B, lod); },
    poses: KAF_POSES,
    grips: { fist: { grip: KAF.grip, rot: KAF_FIST }, pour: { grip: KAF.grip, rot: PAN_FIST } },
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
    // in the fist the hand holds the ring, the keys hanging on from the fingers' side (so in 'lock' the long key's
    // shaft runs on into the lock)
    grips: { fist: { grip: [0, -0.07, 0], rot: basis([0, 1, 0], [-1, 0, 0], [0, 0, 1]) }, free: { rot: eul(90, 0, 0), pos: [0, 0.006, 0.08] } },
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
  sudar: { // the segan's cloth signal (Tamid 7:3): in the hand it hangs from a pinched corner; set down it lies flat
    build(B, lod, cls) {
      S(B, 'linen');
      if (cls === 'free') { plateGrid(B, 0.34, 0.46, (u, v) => V(u * 0.34 - 0.17, 0.004 + 0.003 * Math.sin(u * 9 + v * 4), v * 0.46 - 0.23), sg(lod, 8, 3), sg(lod, 6, 2)); return; }
      sudarHanging(B, lod);
    },
    grips: { fist: { grip: [0, 0.012, 0], rot: eul(0, 90, 0) }, free: { rot: ID(), pos: [0, 0, 0] } },
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
    big: true, cache: true,                  // (its sleeper covers are costly to build: see prewarmBedding)
    build(B, lod, cls) { foldedGarments(B, lod, cls); },
    grips: {
      pillow_side: { rot: eul(0, 0, 90) },   // inverse of the sleep pose's root roll (natural frame = world)
      pillow_back: { rot: eul(-90, 0, 0) },  // inverse of the lie pose's root pitch
      tray: { grip: [0, 0, 0], rot: ID() },  // carried on both palms (the attendants of Tamid 5:3, a kohen dressing)
      free: { rot: ID(), pos: [0, 0, 0] },
    },
  },
  // the elders of the beit av on the stone rovadin (Tamid 1:1): the same bundle and own mantle, the kesset folded double
  // along its length so it lies within a 1-amah ledge
  folded_garments_ledge: {
    big: true, cache: true,
    build(B, lod, cls) { foldedGarments(B, lod, cls, { narrow: true }); },
    grips: {
      pillow_side: { rot: eul(0, 0, 90) }, pillow_back: { rot: eul(-90, 0, 0) },
      tray: { grip: [0, 0, 0], rot: ID() }, free: { rot: ID(), pos: [0, 0, 0] },
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

// ---- the sleeper's own mantle over him (Tamid 1:1 "they covered themselves with their own clothes")
// The cover is draped over the actual posed body: the off-duty figure (israelite / elder recipe, LOD0, without the
// mantle it no longer wears) is skinned in the sleep / lie clip at several breathing phases and rasterised into a
// height field in the pillow frame; the cloth then hangs from the highest points (a cone of slope SLOPE: wool falls
// steeply off the shoulders and knees but tents over hollows), is smoothed, and kept ≥ CLEAR above the body
// everywhere — hands, sleeves and belt ends stay under it. On the elders' 1-amah ledge (narrow) the mantle runs over
// the body to ±0.245 m (the tread is ±0.24 m about a centred body) and falls straight down past both edges: over the
// lip it hangs down the riser, on the wall side it is tucked down between body and riser.
const COVER = { CELL: 0.025, CLEAR: 0.016, SLOPE: 2.6, FALL: 0.2, NARROW: 0.245 };
// The fields are built by resumable jobs (generators that yield every few ms of work) so prewarmBedding() can spread
// them over boot and idle time; a sleeper drawn before then drains whatever is left of its job at once.
const _sleepers = new Map(), _sleeperGeo = new Map(), _figJobs = new Map(), _fieldJobs = new Map();
/** the off-duty figure the cover is draped over (see sleeperField), built one LOD per step */
function* figureJob(narrow) {
  const rig = getRig(narrow ? 'elder' : 'man');
  // the figure at LOD0, 1 and 2 together (the hero's fingers, toes and belt ends; the coarser builds' mitten hands and
  // blunter feet reach a centimetre or two further), without his mantle (it is over him), a head-cloth or the head
  // itself (above the cover's edge) — the costly parts of a hero build
  const B = new MeshBuilder(rig);
  for (const lod of [0, 1, 2]) {
    const b = new MeshBuilder(rig);
    b.skipGrp = new Set([1, 2]);
    b.noHead = true;
    RECIPES[narrow ? 'elder' : 'israelite'](b, rig, lod);
    b.morph = null;
    B.merge(b);
    yield;
  }
  _sleeperGeo.set(narrow, B);
}
/** steps until the figure for `narrow` exists (shared by the side and back jobs: one build) */
function* ensureFigure(narrow) {
  while (!_sleeperGeo.has(narrow)) {
    if (!_figJobs.has(narrow)) _figJobs.set(narrow, figureJob(narrow));
    if (_figJobs.get(narrow).next().done) _figJobs.delete(narrow); else yield;
  }
}
function* sleeperFieldJob(lay, narrow, key) {
  yield* ensureFigure(narrow);
  const rig = getRig(narrow ? 'elder' : 'man');
  const B = _sleeperGeo.get(narrow);
  const clip = HUMAN_CLIPS[lay === 'side' ? 'sleep' : 'lie'];
  const P = new PoseBuilder(rig);
  // the pillow frame's origin: the floor point under the head centre (props.js pillowPoint), in model space
  P.reset(); clip.fn(P, rig, 0);
  const hs = rig.dims.headS;
  const C = new Vector3(0, 0.075 * hs, -0.008 * hs).applyQuaternion(P.worldQ('head')).add(P.worldPos('head'));
  const { CELL } = COVER;
  const x0 = -0.625, nx = Math.round(1.25 / CELL) + 1, t0 = -0.1, nt = Math.round(2.1 / CELL) + 1;
  const F = new Float32Array(nx * nt).fill(-1);
  const ext = new Float32Array(nt).fill(0);
  const M = new Float32Array(MAX_BONES * 12);
  const n = B.count;
  const skip = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const grp = Math.floor(B.mat[i * 4 + 3] / 8); skip[i] = grp === 1 || grp === 2 ? 1 : 0; }   // his mantle (now over him), a head-cloth
  const XC = new Float32Array(n), YC = new Float32Array(n), TC = new Float32Array(n);
  const splat = (xc, y, tc) => {
    const ix = Math.round((xc - x0) / CELL), it = Math.round((tc - t0) / CELL);
    if (ix < 0 || ix >= nx || it < 0 || it >= nt) return;
    const k = it * nx + ix;
    if (y > F[k]) F[k] = y;
    if (y > 0.015) ext[it] = Math.max(ext[it], Math.abs(xc));
  };
  for (const ph of [1 / 12, 3 / 12]) {           // the breath in and out (breathe(P, ph · 3) in both clips)
    P.reset(); clip.fn(P, rig, ph); clothCage(P, rig);
    M.fill(0); poseToSkin(rig, P.lp, M, 0); clothSkin(rig, M, 0);
    for (let i = 0; i < n; i++) {
      const px = B.pos[i * 3], py = B.pos[i * 3 + 1], pz = B.pos[i * 3 + 2];
      let X = 0, Y = 0, Z = 0;
      for (let q = 0; q < 4; q++) {
        const w = B.sw[i * 4 + q];
        if (w <= 0) continue;
        const o = B.si[i * 4 + q] * 12;
        X += w * (M[o] * px + M[o + 1] * py + M[o + 2] * pz + M[o + 3]);
        Y += w * (M[o + 4] * px + M[o + 5] * py + M[o + 6] * pz + M[o + 7]);
        Z += w * (M[o + 8] * px + M[o + 9] * py + M[o + 10] * pz + M[o + 11]);
      }
      X -= C.x; Z -= C.z;
      XC[i] = lay === 'side' ? Z + 0.1 : X; TC[i] = lay === 'side' ? -X : -Z;
      YC[i] = Y + Math.max(0, B.mo ? B.mo[i * 4 + 3] : 0);                   // + the fullest build's belly
      if ((i & 16383) === 16383) yield;
    }
    // every triangle, sampled finer than a cell (vertices alone leave holes the cloth would sag into)
    const I = B.idx;
    for (let f = 0; f < I.length; f += 3) {
      if (f % 9000 === 8997) yield;
      const a = I[f], b = I[f + 1], c = I[f + 2];
      if (skip[a] || skip[b] || skip[c]) continue;
      const L = Math.max(Math.hypot(XC[a] - XC[b], TC[a] - TC[b]), Math.hypot(XC[b] - XC[c], TC[b] - TC[c]), Math.hypot(XC[c] - XC[a], TC[c] - TC[a]));
      const m = Math.min(16, Math.max(1, Math.ceil(L / (CELL * 0.9))));
      for (let u = 0; u <= m; u++) for (let w = 0; w <= m - u; w++) {
        const wa = u / m, wb = w / m, wc = 1 - wa - wb;
        splat(wa * XC[a] + wb * XC[b] + wc * XC[c], wa * YC[a] + wb * YC[b] + wc * YC[c], wa * TC[a] + wb * TC[b] + wc * TC[c]);
      }
    }
  }
  _sleepers.set(key, { F, ext, x0, nx, t0, nt, cell: CELL });
  // both lays of this figure done: its merged build (several MB of plain arrays) is not needed any more
  if (_sleepers.has(`side:${narrow ? 1 : 0}`) && _sleepers.has(`back:${narrow ? 1 : 0}`)) _sleeperGeo.delete(narrow);
}
/** the steps of a field's job (created once; shared by the prewarm and a first draw) */
function fieldJob(lay, narrow) {
  const key = `${lay}:${narrow ? 1 : 0}`;
  if (!_fieldJobs.has(key)) _fieldJobs.set(key, sleeperFieldJob(lay, narrow, key));
  return _fieldJobs.get(key);
}
function sleeperField(lay, narrow) {
  const key = `${lay}:${narrow ? 1 : 0}`;
  if (_sleepers.has(key)) return _sleepers.get(key);
  const job = fieldJob(lay, narrow);
  while (!job.next().done);
  _fieldJobs.delete(key);
  return _sleepers.get(key);
}

/** the cloth's height over the field: hung from the body (cone), smoothed, ≥ body + CLEAR; floor = the mat's top */
function coverHeights(fd, floor, tMin) {
  const ck = `${floor}:${tMin}`;
  if (fd.cache?.[ck]) return fd.cache[ck];
  const { F, nx, nt, cell } = fd, { CLEAR, SLOPE } = COVER;
  const R = Math.ceil(0.3 / cell), W = 2 * R + 1;
  const cone = new Float32Array(W * W);
  for (let b = -R; b <= R; b++) for (let a = -R; a <= R; a++) cone[(b + R) * W + a + R] = SLOPE * cell * Math.hypot(a, b);
  let D = new Float32Array(nx * nt).fill(floor);
  for (let j = 0; j < nt; j++) for (let i = 0; i < nx; i++) {
    const f = F[j * nx + i];
    if (f < 0 || fd.t0 + j * cell < tMin - 0.04) continue;       // nothing of the head or neck above the edge
    const h = f + CLEAR;
    const r = Math.min(R, Math.ceil((h - floor) / (SLOPE * cell)));   // the cone meets the floor within r cells
    for (let b = Math.max(0, j - r); b <= Math.min(nt - 1, j + r); b++) {
      const row = b * nx, crow = (b - j + R) * W + R - i;
      for (let a = Math.max(0, i - r); a <= Math.min(nx - 1, i + r); a++) {
        const d = h - cone[crow + a];
        if (d > D[row + a]) D[row + a] = d;
      }
    }
  }
  for (let pass = 0; pass < 2; pass++) {                           // soften (wool does not take every edge)
    const E = new Float32Array(D.length);
    for (let j = 0; j < nt; j++) for (let i = 0; i < nx; i++) {
      let sum = 0, c = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
        const jj = Math.min(nt - 1, Math.max(0, j + b)), ii = Math.min(nx - 1, Math.max(0, i + a));
        sum += D[jj * nx + ii]; c++;
      }
      E[j * nx + i] = sum / c;
    }
    D = E;
  }
  for (let k = 0; k < D.length; k++) if (F[k] >= 0) D[k] = Math.max(D[k], F[k] + CLEAR * 0.6);
  (fd.cache ||= {})[ck] = D;
  return D;
}
function sampleH(fd, D, xc, tc) {
  const { nx, nt, cell } = fd;
  const fx = Math.min(nx - 1.001, Math.max(0, (xc - fd.x0) / cell)), ft = Math.min(nt - 1.001, Math.max(0, (tc - fd.t0) / cell));
  const i = Math.floor(fx), j = Math.floor(ft), u = fx - i, w = ft - j;
  const g = (a, b) => D[b * nx + a];
  return lerp(lerp(g(i, j), g(i + 1, j), u), lerp(g(i, j + 1), g(i + 1, j + 1), u), w);
}
/** the field's max over the rectangle ±dx, ±dt round (xc, tc) — the cover's own mesh cell */
function sampleHmax(fd, D, xc, tc, dx, dt) {
  let h = sampleH(fd, D, xc, tc);
  const n = 2;
  for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) if (a || b) h = Math.max(h, sampleH(fd, D, xc + (a / n) * dx, tc + (b / n) * dt));
  return h;
}
function sampleExt(fd, tc) {
  const j = Math.round((tc - fd.t0) / fd.cell);
  let e = 0;
  for (let b = j - 2; b <= j + 2; b++) if (b >= 0 && b < fd.nt) e = Math.max(e, fd.ext[b]);
  return e;
}

/** a wool mantle laid over a sleeper (see COVER) */
function cover(B, lod, lay, o = {}) {
  const back = lay === 'back';
  const narrow = !!o.narrow;
  const fd = sleeperField(lay, narrow);
  const floor = (o.y0 ?? 0.01) + 0.003;
  const L0 = back ? 0.2 : 0.22;
  const D = coverHeights(fd, floor, L0);
  // the extent along the body: from the shoulders to past the feet
  let tEnd = L0 + 0.5;
  for (let j = 0; j < fd.nt; j++) if (fd.ext[j] > 0) tEnd = Math.max(tEnd, fd.t0 + j * fd.cell);
  const L1 = tEnd + 0.22;                                            // over the feet and down beyond the toes
  const half = back ? 0.45 : 0.5;
  const nu = narrow ? sg(lod, 30, 14) : sg(lod, 36, 16), nv = sg(lod, 56, 22);
  const dt = (L1 - L0) / nv;
  const nf = narrow ? sg(lod, 4, 2) : 0;                              // rows of the fall at each edge (narrow)
  const pt = (i, j, inner) => {
    let t = lerp(L0, L1, j / nv);
    // on the side: the hem at the head end is pulled up over the high shoulder and sags back where the cloth falls to
    // the floor in front and behind — a curved edge, not a straight cut across the shoulders
    if (!back && !narrow) t += 0.07 * (1 - smooth(floor + 0.03, floor + 0.22, sampleH(fd, D, lerp(-half, half, i / nu), L0))) * (1 - j / nv);
    let x, y;
    if (narrow) {
      const hx = Math.max(COVER.NARROW, sampleExt(fd, t) + 0.012);
      const top = nu - 2 * nf;
      const ii = i - nf;
      if (ii >= 0 && ii <= top) {
        x = lerp(-hx, hx, ii / top);
        y = sampleHmax(fd, D, x, t, hx / top, dt);
      } else {
        // over the edge: rolls over and falls straight down, a little wavy at the hem
        const side = ii < 0 ? -1 : 1, q = (ii < 0 ? -ii : ii - top) / nf;
        const yTop = sampleHmax(fd, D, side * hx, t, hx / top, dt);
        const roll = Math.sin(Math.PI / 2 * Math.min(1, q * 2.2));
        x = side * (hx + 0.012 * roll + 0.004 * q);
        y = lerp(yTop, -COVER.FALL + 0.02 * Math.sin(t * 9 + side), smooth(0, 1, q)) - 0.01 * roll * (1 - q);
      }
    } else {
      x = lerp(-half, half, i / nu);
      y = sampleHmax(fd, D, x, t, half / nu, dt);
      // where it lies flat on the floor: soft wrinkles; at the far edge the cloth ends a little uneven
      const flat = 1 - smooth(floor + 0.004, floor + 0.05, y);
      y += flat * 0.008 * (0.5 + 0.5 * Math.sin(x * 23 + t * 7)) * smooth(0.1, 0.3, Math.abs(x));
    }
    if (lod === 0) y += 0.004 * Math.sin(t * 17 + x * 5) * smooth(floor + 0.03, floor + 0.12, y);   // shallow folds on top
    if (!back && j === 0) y -= 0.008 * smooth(floor + 0.02, floor + 0.06, y);                        // the edge rolls down
    // qa-r1: where the wool falls from the body to the floor it hangs in folds — rounded ridges and sharp creases running
    // down the fall (displaced along the cloth's normal, strongest mid-fall) — and the body's forms read through: the
    // occlusion term darkens the hollows between shoulder, hip and knees and the foot of each fall (see shade below)
    let ao = 1;
    if (!(narrow && (i < nf || i > nu - nf))) {
      const e = 0.03;
      const gx = (sampleH(fd, D, x + e, t) - sampleH(fd, D, x - e, t)) / (2 * e);
      const gt = (sampleH(fd, D, x, t + e) - sampleH(fd, D, x, t - e)) / (2 * e);
      const g = Math.hypot(gx, gt);
      const up = y - floor;
      const fall = smooth(0.35, 1.4, g) * smooth(0.005, 0.03, up) * smooth(0.45, 0.12, up);
      if (fall > 0.01 && g > 1e-3) {
        const px = -gt / g, pt_ = gx / g;                            // along the contour: the folds alternate this way
        const ph = (x * px + t * pt_) * (Math.PI * 2 / 0.15) + 1.3 * Math.sin(x * 7.1 - t * 5.3);
        const prof = (Math.abs(Math.sin(ph)) - 0.64) * fall * (lod === 0 ? 0.011 : 0.008);
        const nl = Math.hypot(gx, 1, gt);
        x += (-gx / nl) * prof; y += (1 / nl) * prof; t += (-gt / nl) * prof;
        ao *= 1 - 0.22 * fall * Math.max(0, 0.64 - Math.abs(Math.sin(ph))) / 0.64;   // the creases in shadow
      }
      // occlusion: below the local mean height (a hollow, the cloth's foot by the body) darker; on a crest lighter
      let m = 0;
      for (const [a, b] of [[0.09, 0], [-0.09, 0], [0, 0.09], [0, -0.09], [0.064, 0.064], [-0.064, 0.064], [0.064, -0.064], [-0.064, -0.064]]) m += sampleH(fd, D, x + a, t + b);
      ao *= clamp(1 + 3.2 * (y - m / 8), 0.62, 1.1) * (1 - 0.2 * smooth(0.035, 0.0, up) * smooth(0.2, 0.6, g));
    }
    const yy = y - (inner ? 0.006 : 0);
    // pillow_back: the body runs toward −z; pillow_side: toward −x (across is z)
    _coverAO = ao;
    return back ? V(x, yy, -t) : V(-t, yy, x - 0.1);
  };
  for (const inner of [false, true]) {
    // his own mantle (undyed wool, lighter than the kesset under him, so the body's forms read against it)
    S(B, 'mat', { color: '#b09e7e', rough: 0.95 });
    B.grid(nu, nv, (i, j) => {
      const p = pt(i, j, inner);
      const h = p.y, edge = Math.min(i, nu - i) / nu;
      return { p, u: (i / nu) * 0.9, v: (j / nv) * 1.6, w: 0, shade: inner ? 0.5 : (1 - 0.18 * smooth(0.12, 0, h) * smooth(0.25, 0.05, edge)) * _coverAO };
    }, { inside: back ? V(0, -1, -0.9) : V(-0.8, -1, -0.1), invert: inner });
  }
}
let _coverAO = 1;

/** the four white garments folded into a bundle (+ his own mat, the kesset, under the body when used as a pillow) */
function foldedGarments(B, lod, cls, o = {}) {
  const lay = cls === 'pillow_side' ? 'side' : cls === 'pillow_back' ? 'back' : null;
  let y0 = 0;
  if (lay) { // "each one's kesset on the ground" (Tamid 1:1): a thin wool mat under the sleeper (folded double on a ledge)
    S(B, 'mat');
    const w = o.narrow ? 0.39 : 0.78, t = o.narrow ? 0.02 : 0.01;
    const c = lay === 'side' ? V(-0.72, t / 2, -0.1) : V(0, t / 2, -0.74);
    const size = lay === 'side' ? [1.95, t, w] : [w, t, 1.95];
    slab(B, c, size, { nu: sg(lod, 12, 6), nv: 4, round: 0.15 });
    y0 = t;
  }
  // "they covered themselves with their own clothes" (Tamid 1:1): his mantle spread over him from the shoulders
  if (lay) cover(B, lod, lay, { ...o, y0 });
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
    // the cut face: a thin closed lens over the loft's open end, covering its ±5 % ripple (a half-lens faced into the
    // loft at the far end and was culled, so the ground showed through the open end: the 'white rims' of the cut ends)
    B.ellipsoid(R.c.clone().add(V(0, 0, end ? -0.001 : 0.001)), [R.rx * 1.06, R.rz * 1.06, 0.003], { nu: sg(lod, 14, 7), nv: sg(lod, 4, 3), bone: 0,
      xf: new Matrix4().makeRotationX(Math.PI / 2) });
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
  // charred on the pyre the ears shrivel and fold back flat against the skull (standing out they read as plates)
  const res = bakeAnimal(B, 'lamb', lod, (P) => { if (CHAR) { P.rot('ear_l', 55, 0, 45); P.rot('ear_r', 55, 0, 45); } }, {
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
  // the alyah hangs over the finger end, growing out of the rump (seated against its end: apart, the ground showed
  // through the gap between them — a white crescent on the charred piece)
  S(B, 'fat');
  B.ellipsoid(V(0, -0.012, -0.088), [0.075, 0.1, 0.04], { nu: sg(lod, 14, 8), nv: sg(lod, 10, 5), bone: 0,
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
    const ch = CHAR ? [0.06, 0.042, 0.034] : [1, 1, 1];   // singed wool and skin on the pyre
    B.col.push(col[i * 3] * (pc ? pc.r : 1) * ch[0], col[i * 3 + 1] * (pc ? pc.g : 1) * ch[1], col[i * 3 + 2] * (pc ? pc.b : 1) * ch[2]);
    if (CHAR) B.mat.push(0.9, 0, PAT.CHAR, 0); else B.mat.push(mat[i * 4], mat[i * 4 + 1], mat[i * 4 + 2], 0);
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

function lambHung(B, lod, kind = 'lamb') {
  if (!bakeAnimal(B, kind, lod, hungPose, { tint: [0.3, 0.3, 0.2, 0.3] })) return;
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
  // body hanging along −y from the rump at the top; back toward −z. By kind (CARCASS): a ram longer and fuller, a goat
  // longer and slimmer, leaner (redder under a thinner fell) and without the fat tail
  const K = CARCASS[o.kind || 'lamb'] || CARCASS.lamb, sl = K.L, sw = K.W;
  const L = 0.6 * sl;
  const N = sg(lod, 22, 8);
  const rings = [];
  for (let j = 0; j <= N; j++) {
    const t = j / N; // 0 rump (top) → 1 neck (bottom)
    const y = -0.16 * sl - t * L;
    const chest = smooth(0.45, 0.75, t) * (1 - smooth(0.9, 1, t));
    const rz = 0.075 + 0.04 * chest + 0.015 * (1 - smooth(0.05, 0.3, t));
    const rx = 0.07 + 0.03 * chest + 0.02 * (1 - smooth(0.05, 0.3, t));
    const end = Math.min(t, 1 - t);
    const tap = 0.55 + 0.45 * smooth(0, 0.12, end);
    rings.push({ c: V(0, y, 0), rx: rx * tap * sw, rz: rz * tap * sw, ax: V(1, 0, 0), az: V(0, 0, -1), t });
  }
  S(B, 'fell', K.lean ? { color: '#cf9f8c' } : {});
  B.tube(rings, { seg: sg(lod, 20, 10), bone: 0,
    radial: lod === 0 ? (th, j, R) => 1 + 0.02 * Math.abs(Math.cos(th)) * smooth(0.42, 0.52, R.t) * (1 - smooth(0.82, 0.92, R.t)) * (0.5 + 0.5 * Math.cos(j * Math.PI)) + 0.05 * Math.max(0, Math.sin(th)) ** 16 : null,
    shade: (th, j) => (o.opened && Math.sin(th) < -0.93 ? 0.35 : 1) });
  // the neck cut at the bottom
  S(B, 'meat');
  const f = rings[rings.length - 1];
  B.ellipsoid(f.c.clone().add(V(0, -0.002, 0)), [f.rx * 0.98, 0.006, f.rz * 0.98], { nu: sg(lod, 12, 6), nv: 3, bone: 0 });
  // the left hind leg up to the hook, the right hind leg out, the fore leg stumps; the fat tail on the rump
  const P3 = (x, y, z) => V(x * sw, y * sl, z * sw);
  S(B, 'sinew');
  curve(B, [P3(-0.04, -0.17, 0.0), P3(-0.035, -0.08, 0.0), V(-0.025 * sw, 0.0, 0.0), V(-0.02, 0.04, 0)], [0.05 * sw, 0.03 * sw, 0.017 * sw, 0.014], sg(lod, 10, 6));
  curve(B, [P3(0.045, -0.17, 0.0), P3(0.09, -0.12, -0.04), P3(0.15, -0.1, -0.06)], [0.05 * sw, 0.032 * sw, 0.016 * sw], sg(lod, 10, 6));
  S(B, 'bone'); B.ellipsoid(P3(0.155, -0.1, -0.06), [0.012, 0.012, 0.012], { nu: 6, nv: 4, bone: 0 });
  S(B, 'sinew');
  const yF = -0.16 * sl - L * 0.77;
  for (const s of [-1, 1]) curve(B, [V(s * 0.05 * sw, yF, 0.0), V(s * 0.06 * sw, yF - 0.07 * sl, 0.02), V(s * 0.06 * sw, yF - 0.12 * sl, 0.03)], [0.035 * sw, 0.022 * sw, 0.016 * sw], sg(lod, 8, 5));
  if (K.alyah > 0) {
    S(B, 'fat');
    B.ellipsoid(V(0, -0.16 * sl, 0.06 * sw), [0.075 * K.alyah, 0.09 * K.alyah, 0.035 * K.alyah], { nu: sg(lod, 12, 6), nv: sg(lod, 6, 4), bone: 0 });
  } else {
    // a goat's short tail, flayed: a thin stub of sinew on the rump
    S(B, 'sinew');
    curve(B, [V(0, -0.15 * sl, 0.06 * sw), V(0, -0.1 * sl, 0.075 * sw), V(0, -0.06 * sl, 0.08 * sw)], [0.016, 0.012, 0.007], sg(lod, 6, 4), { capB: 'dome' });
  }
  hookRing(B);
  return rings;
}

/** half-way through the flaying (Tamid 4:2 "he flays downward until he reaches the breast"): the rear flayed, the
 *  fleece turned inside-out and hanging round the fore quarters, the head still on */
function carcassFlaying(B, lod, kind = 'lamb') {
  const K = CARCASS[kind] || CARCASS.lamb, sl = K.L, sw = K.W;
  const goat = kind === 'goat' || kind === 'she_goat';
  carcassHungBody(B, lod, { kind });
  // the peeled hide hangs as a skirt from the chest: peeled downward from the hind legs it is turned inside out, so the
  // pale flesh side is outside and the fleece (or the goat's hair) inside, showing only as the roll at its free edge
  // (people-4-fix: the layers were the wrong way round)
  const top = -0.42 * sl, bot = -0.86 * sl;
  const n = sg(lod, 22, 10), m = sg(lod, 6, 3);
  const coat = () => (goat ? S(B, 'coatProp', { color: '#1c1917', rough: 0.72 }) : S(B, 'fleeceProp'));
  // qa-r2: a draped hide, not a sack — deeper, uneven folds, and the hem drawn down into the two empty skins of the hind
  // legs (peeled off them first) hanging as tapering flaps at the sides
  const flap = (a) => Math.exp(-((Math.atan2(Math.sin(a - 0.35), Math.cos(a - 0.35)) / 0.32) ** 2)) + Math.exp(-((Math.atan2(Math.sin(a - Math.PI + 0.35), Math.cos(a - Math.PI + 0.35)) / 0.32) ** 2));
  const at = (i, s, k) => {
    const a = (i / n) * Math.PI * 2, r = (0.13 + 0.06 * s) * sw * k * (1 + 0.11 * Math.sin(a * 5 + s * 2) + 0.05 * Math.sin(a * 9 + 1.3 + s * 3)) * (1 - 0.35 * flap(a) * s * s);
    return V(Math.cos(a) * r, lerp(top, bot, s) - 0.03 * Math.sin(a * 3) * s - 0.11 * sl * flap(a) * s * s, -Math.sin(a) * r * 0.9);
  };
  for (const inner of [false, true]) {
    if (inner) coat(); else S(B, 'hide');
    B.grid(n, m, (i, j) => ({ p: at(i, j / m, inner ? 0.94 : 1), u: (i / n) * 0.95, v: (j / m) * 0.4, w: 0, shade: inner ? 0.8 : 0.92 + 0.08 * Math.sin(i * 1.7 + j) }),
      { inside: V(0, (top + bot) / 2, 0), invert: inner });
  }
  // the free edge rolled: the fleece / hair turned up round the hem of the skirt
  coat();
  const rho = (goat ? 0.009 : 0.013) * sw;
  const roll = [];
  for (let i = 0; i <= n; i++) {
    const e = at(i % n, 1, 0.97), out = V(e.x, 0, e.z).normalize();
    roll.push(e.addScaledVector(out, rho * 0.7).add(V(0, rho * 0.4, 0)));
  }
  curve(B, roll, roll.map((_, i) => rho * (1 + 0.15 * Math.sin(i * 2.3))), sg(lod, 6, 4));
  // the head, still on, hanging below the hide: baked from the live animal (its horns, ears and face)
  hangingHead(B, lod, kind, V(0, bot - 0.02 * sl, -0.01));
  // qa-r2: and the fore legs, not yet taken off (Tamid 4:2: flayed down to the breast, then the head, then the legs),
  // hanging below the hide's hem either side of the head — the silhouette was a pink sack with one dark end
  hangingForelegs(B, lod, kind, V(0, bot + 0.035 * sl, 0.045 * sw), sw);
}

/** the live animal's lower fore legs (from the knee: short hair and hooves), baked hanging straight down with the knees
 *  at `at` (carcass frame), drawn together under the breast */
function hangingForelegs(B, lod, kind, at, sw = 1) {
  const rig = getRig(ANIMALS[kind].rig), I = rig.index;
  const bones = new Set([I.fl_lo, I.fl_ft, I.fr_lo, I.fr_ft]);
  const base = B.count;
  const res = bakeAnimal(B, kind, lod, (P) => { P.rot('fl_lo', 4, 0, 6); P.rot('fr_lo', 9, 0, -5); P.rot('fl_ft', 14, 0, 0); P.rot('fr_ft', 8, 0, 0); }, {
    tint: [0.3, 0.3, 0.4, 0.4],
    only: (si, sw2, i) => { let w = 0; for (let q = 0; q < 4; q++) if (bones.has(si[i * 4 + q])) w += sw2[i * 4 + q] / 255; return w > 0.6; },
  });
  if (!res) return;
  const kl = res.P.worldPos('fl_lo'), kr = res.P.worldPos('fr_lo');
  const kx = (Math.abs(kl.x) + Math.abs(kr.x)) / 2, ky = (kl.y + kr.y) / 2, kz = (kl.z + kr.z) / 2;
  const gap = 0.05 * sw;
  for (let i = base; i < B.count; i++) {
    const x = B.pos[i * 3];
    B.pos[i * 3] = x - Math.sign(x) * (kx - gap);
    B.pos[i * 3 + 1] += at.y - ky;
    B.pos[i * 3 + 2] += at.z - kz;
  }
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
// ---------------------------------------------------------------------------------------------- people-3 props
// (docs/decisions/people-3.md)

/** the kaf (Tamid 5:4), optionally with its domed cover and the cloth (metotelet) laid over it */
function kaf(B, lod, o = {}) {
  S(B, 'gold');
  vessel(B, KAF.prof, sg(lod, 22, 11), 0.003);
  if (lod === 0) curve(B, Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return V(Math.cos(a) * KAF.rimR, KAF.rimY, Math.sin(a) * KAF.rimR); }), Array(25).fill(0.0035), 5);
  rod(B, KAF.h0, KAF.h1, 0.0085, sg(lod, 8, 5));
  B.ellipsoid(KAF.h1, [0.012, 0.012, 0.012], { nu: 8, nv: 5, bone: 0 });
  if (!o.covered) return;
  // the cover: a low gold dome with a knob, seated on the rim
  const R = KAF.rimR + 0.004, Y = KAF.rimY;
  const lid = [[R, Y - 0.004], [R, Y + 0.004], [R * 0.86, Y + 0.022], [R * 0.55, Y + 0.04], [R * 0.2, Y + 0.048], [0.012, Y + 0.05], [0.015, Y + 0.062], [0.001, Y + 0.068]];
  lathe(B, lid, sg(lod, 22, 11), { capB: 'flat' });
  // "and a kind of metotelet on it from above" — a linen cloth laid over the cover (tented over the knob), its corners
  // falling over the rim
  const lidTop = (r) => {
    if (r < 0.022) return Y + 0.076 - 0.25 * r;                       // over the knob
    const pr = lid.slice(1, 5);                                        // R … 0.2R, descending radii
    if (r <= pr[3][0]) return lerp(Y + 0.071, pr[3][1], smooth(0.022, pr[3][0], r));
    let k = 0;
    while (k < pr.length - 2 && r < pr[k + 1][0]) k++;
    const [r0, y0] = pr[k], [r1, y1] = pr[k + 1];
    return lerp(y0, y1, (r0 - r) / Math.max(1e-6, r0 - r1));
  };
  S(B, 'linen', { color: '#ece6d8' });
  const half = R * 1.16, n = sg(lod, 16, 7);
  plateGrid(B, half * 2, half * 2, (u, v) => {
    const x = (u - 0.5) * 2 * half, z = (v - 0.5) * 2 * half, r = Math.hypot(x, z) || 1e-6;
    let y, rr = r;
    if (r <= R) y = lidTop(r) + 0.005;
    else { rr = R + 0.006 + 0.008 * Math.min(1, (r - R) / 0.05); y = Y + 0.009 - (r - R) * 0.78; }
    const fold = lod === 0 ? 0.004 * Math.sin(Math.atan2(z, x) * 7) * smooth(R * 0.8, R * 1.3, r) : 0;
    return V((x / r) * (rr + fold), y, (z / r) * (rr + fold));
  }, n, n);
}

/** the staff (makel) of the Ish Har HaBayit (Middot 1:2): smooth hand-worn wood, held STAFF.grip below its top */
function staff(B, lod) {
  const below = STAFF.len - STAFF.grip;
  S(B, 'woodDark', { color: '#5b4129', rough: 0.55 });
  B.tube([{ c: V(0, -below, 0), rx: 0.0125, rz: 0.0125 }, { c: V(0, -below * 0.5, 0), rx: 0.0148, rz: 0.0148 }, { c: V(0, STAFF.grip - 0.012, 0), rx: 0.0165, rz: 0.0165 }], {
    seg: sg(lod, 9, 5), bone: 0, capA: 'flat', capB: 'dome', domeH: 0.7,
    radial: lod === 0 ? (th, j) => 1 + 0.06 * Math.sin(th * 2 + j * 2.3) * (j === 1 ? 1 : 0.3) : null,
  });
  if (lod === 0) for (const y of [-0.62, -0.31, -0.86]) B.ellipsoid(V(0.012, y, 0.003), [0.006, 0.012, 0.006], { nu: 6, nv: 4, bone: 0 });   // knots
}

/** the migba'at off the head, held by its crown (Yoma 25a): the wound linen dome of the kohen hedyot */
function migbaatProp(B, lod) {
  S(B, 'linen', { color: '#efebe1', rough: 0.86 });
  const prof = [[0.0, 1.08, 1.06], [0.02, 1.15, 1.12], [0.05, 1.18, 1.14], [0.08, 1.16, 1.12], [0.104, 1.08, 1.04], [0.122, 0.94, 0.9], [0.136, 0.74, 0.71], [0.146, 0.48, 0.46], [0.152, 0.12, 0.12]];
  const rx0 = 0.074, rz0 = 0.096;
  const rows = lod === 0 ? 34 : 7;
  const rings = [];
  for (let j = 0; j < rows; j++) {
    const yy = (j / (rows - 1)) * 0.152;
    let k = 0;
    while (k < prof.length - 2 && yy > prof[k + 1][0]) k++;
    const t = (yy - prof[k][0]) / (prof[k + 1][0] - prof[k][0]);
    rings.push({ c: V(0, yy, 0), rx: rx0 * lerp(prof[k][1], prof[k + 1][1], t), rz: rz0 * lerp(prof[k][2], prof[k + 1][2], t), yy });
  }
  const pitch = 0.022, slant = 3.2;
  const ph = (th, j) => { const q = (rings[j].yy + (th / (Math.PI * 2)) * pitch * slant) / pitch; return q - Math.floor(q); };
  B.tube(rings, { seg: sg(lod, 48, 12), bone: 0, capB: 'flat',
    radial: lod === 0 ? (th, j) => 1 + 0.04 * Math.sqrt(Math.sin(Math.PI * ph(th, j))) * (1 - smooth(0.12, 0.152, rings[j].yy)) : null,
    shade: (th, j) => 1 - 0.22 * (1 - smooth(0, 0.16, ph(th, j))) * (1 - smooth(0.12, 0.152, rings[j].yy)) });
  // the inside, seen when it is lifted off: a shallower inner shell
  S(B, 'linen', { color: '#d9d3c5', rough: 0.9 });
  B.tube(rings.slice(0, -2).map((q) => ({ c: q.c.clone().add(V(0, -0.006, 0)), rx: q.rx * 0.93, rz: q.rz * 0.93 })), { seg: sg(lod, 24, 10), bone: 0, invert: true, capB: 'flat' });
}

/** the psachter: "a large vessel holding a letech, with two chains — one he pulls by and goes down, one he holds from
 *  above so it does not roll" (Tamid 5:5). Copper like every vessel of the outer altar (Shemot 27:3); a letech = 15
 *  se'ah (≈ 124 l at R' Chaim Naeh), scaled with the amah. Mouth down (inverted) it covers the coals on Shabbat. */
const PSACHTER = (() => {
  const base = [[0.001, 0], [0.2, 0], [0.26, 0.04], [0.31, 0.16], [0.345, 0.34], [0.36, 0.47], [0.37, 0.49]];
  let v = 0;
  for (let i = 1; i < base.length; i++) { const [r0, y0] = base[i - 1], [r1, y1] = base[i]; v += Math.PI * (y1 - y0) * (r0 * r0 + r0 * r1 + r1 * r1) / 3; }
  const sc = Math.cbrt((90 * KAV_M3) / v);
  return { prof: base.map(([r, y]) => [r * sc, y * sc]) };
})();
/** a chain along a polyline: links every 4.4 cm, alternate links turned a quarter (LOD0); a cord-like tube (LOD1).
 *  Copper, darkened with use: no iron may touch the altar — "iron disqualifies by touch", they would not even plaster
 *  it with an iron trowel "lest it touch" (Middot 3:4) — and this chain is dragged down the ramp (Tamid 5:5). */
function chain(B, pts, lod) {
  S(B, 'copper', { color: '#5e3a28', rough: 0.55 });
  if (lod > 0) { curve(B, pts, pts.map(() => 0.006), 4); return; }
  const L = 0.044;
  let acc = 0, k = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], seg = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const ref = Math.abs(dir.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0);
    const n1 = ref.clone().addScaledVector(dir, -ref.dot(dir)).normalize();
    const n2 = new Vector3().crossVectors(dir, n1);
    for (let t = L - acc; t <= seg; t += L, k++) {
      const c = a.clone().addScaledVector(dir, t - L / 2);
      const side = k % 2 ? n1 : n2;
      const loop = [];
      for (let q = 0; q <= 8; q++) { const an = (q / 8) * Math.PI * 2; loop.push(c.clone().addScaledVector(dir, Math.cos(an) * 0.027).addScaledVector(side, Math.sin(an) * 0.013)); }
      curve(B, loop, loop.map(() => 0.0042), 4);
    }
    acc = (acc + seg) % L;
  }
}
function psachter(B, lod, inverted = false) {
  const { prof } = PSACHTER;
  const H = prof[prof.length - 1][1], Rr = prof[prof.length - 1][0];
  const flip = (p) => (inverted ? V(p.x, H + 0.012 - p.y, p.z) : p);
  const m0 = B.count;
  S(B, 'copper', { color: '#8d5537', rough: 0.48 });
  lathe(B, prof, sg(lod, 32, 14), { capA: 'flat', radial: lod === 0 ? (th, j) => 1 + 0.004 * Math.sin(th * 13 + j * 2.1) : null });
  S(B, 'copper', { color: '#2b211c', rough: 0.85 });            // sooty inside: it brings the ashes down from the altar
  lathe(B, prof.slice(1).reverse().map(([r, y]) => [Math.max(0.001, r - 0.006), y]).concat([[0.001, 0.008]]), sg(lod, 32, 14), { invert: true });
  S(B, 'copper', { color: '#9a5f3d', rough: 0.4 });
  curve(B, Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return V(Math.cos(a) * (Rr + 0.004), H + 0.002, Math.sin(a) * (Rr + 0.004)); }), Array(33).fill(0.011), sg(lod, 6, 4));
  // two rings riveted below the rim, opposite each other (±x), each carrying a chain
  const ends = [];
  for (const sx of [-1, 1]) {
    const c = V(sx * (Rr + 0.022), H - 0.05, 0);
    S(B, 'copper', { color: '#5e3a28', rough: 0.55 });
    curve(B, Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return c.clone().add(V(0, Math.cos(a) * 0.026, Math.sin(a) * 0.026)); }), Array(13).fill(0.005), 4);
    ends.push(c);
  }
  // mouth down when inverted (a point reflection in y keeps the winding when x is mirrored too — only y is flipped,
  // so swap every triangle's winding)
  if (inverted) {
    for (let i = m0; i < B.count; i++) { const p = flip(V(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2])); B.pos[i * 3] = p.x; B.pos[i * 3 + 1] = p.y; B.pos[i * 3 + 2] = p.z; }
    for (let i = 0; i < B.idx.length; i += 3) if (B.idx[i] >= m0) { const t = B.idx[i + 1]; B.idx[i + 1] = B.idx[i + 2]; B.idx[i + 2] = t; }
  }
  // the chains: from each ring down the side and out across the floor (≈ 1.6 m each), lying as a dropped chain does —
  // a sagging fall to the floor, then an irregular meander with a loop where it fell on itself
  for (const [k, c0] of ends.entries()) {
    const sx = k ? 1 : -1, c = flip(c0);
    const pts = [c];
    const drop = Math.max(0.05, c.y - 0.012);
    for (let i = 1; i <= 5; i++) { const u = i / 5; pts.push(V(c.x + sx * (0.015 + 0.09 * u * u), c.y - drop * Math.sin(u * Math.PI / 2), 0.01 + 0.04 * u)); }
    let x = pts[pts.length - 1].x, z = pts[pts.length - 1].z, a = sx > 0 ? 0.2 : Math.PI - 0.2;
    const R = (i) => { const q = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return q - Math.floor(q); };
    for (let i = 0; i < 26; i++) {
      a += (R(i) - 0.5) * 1.1 + (i > 9 && i < 15 ? sx * 0.62 : 0);    // wanders; a loop part-way
      x += Math.cos(a) * 0.05; z += Math.sin(a) * 0.05;
      pts.push(V(x, 0.012 + 0.006 * (i > 9 && i < 15 ? Math.sin((i - 9) * 0.9) : 0), z));
    }
    chain(B, pts, lod);
  }
}

/** bark on a branch tube (PAT.BARK, people material): the roughness channel selects the bark — ≤ 0.8 the smooth grey
 *  bark of the fig with lenticels, ≥ 0.92 the furrowed bark of walnut and oil-wood (Tamid 2:3) */
const BARK = {
  fig: { color: '#7c766d', rough: 0.78, pat: PAT.BARK },
  walnut: { color: '#5c5248', rough: 0.95, pat: PAT.BARK },
  oil: { color: '#6a5f50', rough: 0.93, pat: PAT.BARK },
};
const hash1 = (i) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
/** a round branch along z from a to b (bent through `bow`), tapering r0 → r1, with bark and pale cut ends */
function branch(B, lod, o) {
  const { a, b, r0, r1, bark, seed = 1 } = o;
  const n = sg(lod, o.rows ?? 9, 3);
  const dir = b.clone().sub(a), L = dir.length();
  const side = V(-dir.z, 0, dir.x).normalize(), up = new Vector3().crossVectors(side, dir).normalize();
  const pts = [], rad = [];
  for (let j = 0; j <= n; j++) {
    const t = j / n;
    const bend = Math.sin(Math.PI * t);
    const wob = 0.006 * Math.sin(t * 7.3 + seed) * L;
    pts.push(a.clone().addScaledVector(dir, t).addScaledVector(up, (o.bow || 0) * L * bend + wob).addScaledVector(side, (o.sway || 0) * L * bend));
    // taper, with a swelling at the collars where shoots were lopped
    let r = lerp(r0, r1, t) * (1 + 0.07 * Math.exp(-(((t - 0.3) / 0.06) ** 2)) + 0.05 * Math.exp(-(((t - 0.72) / 0.05) ** 2)));
    rad.push(r);
  }
  S(B, 'wood', BARK[bark]);
  const deep = bark !== 'fig';
  const rings = curve(B, pts, rad, sg(lod, deep ? 16 : 14, 6), {
    radial: lod === 0 ? (th, j) => 1 + (deep ? 0.06 * (Math.abs(Math.sin(th * 7 + j * 0.4 + seed)) - 0.6) : 0.012 * Math.sin(th * 5 + j * 1.9 + seed)) + 0.02 * Math.sin(th * 2 + seed * 3) : null,
    shade: (th, j) => (deep ? 0.86 + 0.14 * Math.abs(Math.sin(th * 7 + j * 0.4 + seed)) : 0.92 + 0.08 * Math.sin(th * 3 + j + seed)),
  });
  void rings;
  // the cut ends: pale wood with growth rings inside a dark rim of bark
  for (const [end, sgn] of [[0, -1], [n, 1]]) {
    const c = pts[end], R0 = rad[end] * 0.96, m = sg(lod, 14, 7);
    const ax = (end ? pts[n].clone().sub(pts[n - 1]) : pts[0].clone().sub(pts[1])).normalize();
    const e1 = V(0, 1, 0).addScaledVector(ax, -ax.y).normalize(), e2 = new Vector3().crossVectors(ax, e1);
    S(B, 'wood', { color: bark === 'walnut' ? '#9c7a55' : '#c7a676', rough: 0.8 });
    B.grid(m, 2, (i, j) => {
      const an = (i / m) * Math.PI * 2, rr = R0 * (j / 2);
      return { p: c.clone().addScaledVector(e1, Math.cos(an) * rr).addScaledVector(e2, Math.sin(an) * rr).addScaledVector(ax, 0.0008), u: rr + 0.003 * Math.sin(an * 3), v: an * 0.01, w: 0, shade: j === 2 ? 0.55 : 1 };
    }, { wrap: true, inside: c.clone().addScaledVector(ax, -1) });
    void sgn;
  }
  return { pts, rad };
}

/** a gizer of the pile (Tamid 2:3 "murbiyot of fig, walnut and oil-wood"): a round fig branch ≈ 1 amah long, the smooth
 *  grey bark of the fig with lenticels, a slight bend, the cut ends pale with growth rings, two lopped side shoots.
 *  Natural frame: along z, resting on y = 0. */
function gizrinBranch(B, lod) {
  const L = AMAH, r = 0.06;
  const { pts, rad } = branch(B, lod, { a: V(0, r * 1.02, -L / 2), b: V(0.01, r * 0.98, L / 2), r0: r * 1.04, r1: r * 0.92, bark: 'fig', bow: 0.03, sway: 0.02, seed: 2.1, rows: 10 });
  if (lod === 0) {   // lopped side shoots, the stubs' cut faces pale
    for (const [t, an] of [[0.3, 0.7], [0.72, 2.5]]) {
      const j = Math.round(t * (pts.length - 1)), c = pts[j], rr = rad[j];
      const dir = V(Math.cos(an), Math.sin(an), 0.45).normalize();
      S(B, 'wood', BARK.fig);
      curve(B, [c.clone().addScaledVector(dir, rr * 0.5), c.clone().addScaledVector(dir, rr + 0.03)], [0.019, 0.015], 7);
      S(B, 'wood', { color: '#c7a676', rough: 0.8 });
      B.ellipsoid(c.clone().addScaledVector(dir, rr + 0.0305), [0.014, 0.014, 0.014], { nu: 7, nv: 2, lat: [0, 0.5], bone: 0, xf: new Matrix4().lookAt(V(0, 0, 0), dir, V(0, 1, 0)).multiply(new Matrix4().makeRotationX(Math.PI / 2)) });
    }
  }
}

/** a bundle of thinner branches of the three woods tied with cord at two places (small wood for the pile) */
function branchBundle(B, lod) {
  const n = sg(lod, 12, 6);
  const kinds = ['fig', 'walnut', 'oil'];
  for (let i = 0; i < n; i++) {
    const an = i * 2.4, rr = 0.022 + 0.045 * Math.sqrt(hash1(i));
    const x = Math.cos(an) * rr, y = 0.07 + Math.sin(an) * rr * 0.8;
    const L = 0.6 + 0.16 * hash1(i + 9), r = 0.011 + 0.011 * hash1(i + 3);
    const z0 = (hash1(i + 11) - 0.5) * 0.08;
    const tilt = V((hash1(i + 5) - 0.5) * 0.1, (hash1(i + 7) - 0.5) * 0.06, 1).normalize();
    const c = V(x, y, z0);
    const kind = kinds[i % 3];
    branch(B, lod, { a: c.clone().addScaledVector(tilt, -L / 2), b: c.clone().addScaledVector(tilt, L / 2), r0: r, r1: r * 0.72, bark: kind, bow: (hash1(i + 13) - 0.5) * 0.05, sway: (hash1(i + 17) - 0.5) * 0.05, seed: i * 1.7, rows: 5 });
    if (lod === 0 && i % 3 === 0) {   // a forked twig at the thin end
      const tip = c.clone().addScaledVector(tilt, L / 2 - 0.06);
      S(B, 'wood', BARK[kind]);
      curve(B, [tip, tip.clone().add(V(0.025 * (hash1(i) - 0.5), 0.018, 0.08))], [r * 0.5, r * 0.28], 5, { capB: 'flat' });
    }
  }
  // two cords, each wound twice and knotted
  S(B, 'string', { color: '#9a8461', pat: PAT.ROPE, rough: 0.9 });
  for (const z of [-0.17, 0.17]) {
    curve(B, Array.from({ length: 25 }, (_, i) => { const an = (i / 12) * Math.PI * 2; return V(Math.cos(an) * 0.082, 0.07 + Math.sin(an) * 0.068, z + 0.008 * (i / 24 - 0.5)); }), Array(25).fill(0.0055), sg(lod, 5, 3));
    if (lod === 0) B.ellipsoid(V(0.07, 0.11, z), [0.012, 0.01, 0.012], { nu: 7, nv: 4, bone: 0 });
  }
}

/** the slaughtered lamb, limp, unflayed (carried to the hook in the arms — Tamid 4:2; or laid down). Baked from the
 *  live rig: on its left side, the head hanging, legs dangling (carried) or lying out on the floor (free). Natural
 *  frame: the trunk across x (head toward −x), back toward +z, the origin under the middle of the trunk. */
function lambDead(B, lod, cls, o = {}) {
  const carried = cls !== 'free';
  const droop = carried ? 62 : 18;
  const base = B.count;
  const res = bakeAnimal(B, o.kind || 'lamb', lod, (P) => {
    // lamb x → +y, lamb y → +z, lamb z → +x: lying on its left side, back toward +z, head toward −x
    P.setQ(P.i('root'), new Quaternion().setFromRotationMatrix(basis([0, 1, 0], [0, 0, 1], [1, 0, 0])));
    for (const s of ['l', 'r']) {
      const a = droop * (s === 'r' ? 1.1 : 0.8);
      P.rot(`f${s}_up`, carried ? -6 : -14, 0, -a); P.rot(`f${s}_lo`, carried ? -14 : -6, 0, -8); P.rot(`f${s}_ft`, -20, 0, 0);
      P.rot(`h${s}_up`, carried ? 10 : 22, 0, -a); P.rot(`h${s}_lo`, carried ? 14 : 6, 0, -8); P.rot(`h${s}_ft`, 10, 0, 0);
    }
    // carried, the dead lamb's neck hangs limp beside the carrier's left forearm, the head below it, the muzzle down
    // (a raised neck read as a live animal held out): lying on its left side the neck falls by lateral flexion — about
    // the lamb's dorsal (y) axis — and turns a little away from the carrier
    if (carried) { P.rot('neck', -10, 44, 0); P.rot('neck2', -6, 44, 0); P.rot('head', 0, 34, 0); } else {
      P.rot('neck', 6, 0, 12); P.rot('neck2', 4, 0, 8); P.rot('head', -12, 0, 6);
    }
    P.rot('jaw', 10, 0, 0); P.rot('tail', 0, 0, -30); P.rot('ear_l', 0, 0, carried ? -20 : 30); P.rot('ear_r', 0, 0, carried ? -20 : 30);
  }, { tint: [0.3, 0.3, 0.4, 0.4] });
  if (!res) return;
  const { P, rig } = res;
  if (o.wound) throatWound(B, lod, P, rig);
  const mid = P.worldPos('pelvis').lerp(P.worldPos('chest'), 0.5);
  const barrel = Math.abs(P.worldPos('pelvis').x - P.worldPos('chest').x) * 0.5 + 0.04;
  let bottom = Infinity, back = -Infinity;
  for (let i = base; i < B.count; i++) {
    bottom = Math.min(bottom, B.pos[i * 3 + 1]);
    // the back's line from the barrel only (the head and legs must not set it: they held the body 0.14 m out)
    if (Math.abs(B.pos[i * 3] - mid.x) < barrel) back = Math.max(back, B.pos[i * 3 + 2]);
  }
  // carried: the origin on the line where the back lies against the carrier and the left flank on his forearms
  const oy = carried ? mid.y - rig.dims.W * 1.22 : bottom, oz = carried ? back : mid.z;
  for (let i = base; i < B.count; i++) { B.pos[i * 3] -= mid.x; B.pos[i * 3 + 1] -= oy; B.pos[i * 3 + 2] -= oz; }
}

/** a lighting taper (a splinter with a twisted linen wick, burning) for the Menorah's lamps — reconstruction of the
 *  tool; natural frame along +y, the burning end at the top */
function taper(B, lod) {
  S(B, 'wood', { color: '#a68a62', rough: 0.7 });
  rodY(B, -0.08, 0.22, 0.0042, 0.0034, sg(lod, 6, 4), { capA: 'flat' });
  S(B, 'string', { color: '#d9cfb6', pat: PAT.CORD });
  rodY(B, 0.205, 0.245, 0.0058, 0.005, sg(lod, 6, 4), { capB: 'dome' });
  S(B, 'pitch', { color: '#1d1611' });
  rodY(B, 0.238, 0.25, 0.0052, 0.003, 5, { capB: 'dome' });
}

/** the innards (kerev) laid out on the marble table to be rinsed (Tamid 4:2): a heap of loops — the narrow small
 *  intestine in many tight coils, the wider large intestine in a few, glossy pink-grey with the mesentery's fat — and
 *  the stomach, a lumpy sac. Natural frame: resting on y = 0, ≈ 0.4 × 0.3 m. */
function entrails(B, lod) {
  const guts = [
    { r: 0.0105, n: sg(lod, 120, 40), s: 22, color: '#d4a596', seed: 0.7, amp: [0.13, 0.1], h: 0.035 },
    { r: 0.017, n: sg(lod, 48, 18), s: 9, color: '#c99a87', seed: 2.3, amp: [0.11, 0.08], h: 0.03 },
  ];
  for (const g of guts) {
    S(B, 'fat', { color: g.color, rough: 0.16, pat: PAT.NONE });       // smooth, wet serosa (the fat pattern's streaks read as cut meat)
    const pts = [], rad = [];
    for (let i = 0; i <= g.n; i++) {
      const u = (i / g.n) * g.s;
      // a Lissajous tangle with a slow drift: loops lying over each other on a low mound
      const x = g.amp[0] * (0.62 * Math.sin(1.31 * u + g.seed) + 0.38 * Math.sin(3.7 * u + 2 * g.seed));
      const z = g.amp[1] * (0.6 * Math.sin(1.73 * u + 0.5 + g.seed) + 0.4 * Math.cos(4.3 * u + g.seed));
      const mound = 1 - Math.min(1, Math.hypot(x / 0.16, z / 0.12));
      const y = g.r + g.h * mound + 0.012 * (0.5 + 0.5 * Math.sin(2.9 * u + g.seed * 2));
      pts.push(V(x + 0.03, y, z));
      rad.push(g.r * (0.85 + 0.3 * (0.5 + 0.5 * Math.sin(u * 5.1 + g.seed))));    // contractions along the gut
    }
    curve(B, pts, rad, sg(lod, 10, 5), { shade: (th, j) => 0.86 + 0.14 * Math.sin(j * 0.9 + g.seed) });
  }
  // the fat of the mesentery between the loops: pale, lumpy webbing under them
  S(B, 'fat', { color: '#e6d9bf', rough: 0.3 });
  for (const [x, z, w] of [[0.0, 0.02, 0.05], [0.08, -0.04, 0.04], [-0.06, -0.05, 0.035]]) {
    B.ellipsoid(V(x + 0.03, 0.018, z), [w, 0.01, w * 0.8], { nu: sg(lod, 10, 6), nv: sg(lod, 5, 3), bone: 0,
      deform: (l) => { l.y += 0.005 * Math.sin(l.x * 120) * Math.cos(l.z * 90); return l; } });
  }
  // the stomach: a lumpy sac with its folds
  S(B, 'fat', { color: '#c9b9a0', rough: 0.24 });
  B.ellipsoid(V(-0.13, 0.04, 0.09), [0.085, 0.04, 0.06], { nu: sg(lod, 14, 7), nv: sg(lod, 8, 4), bone: 0, xf: new Matrix4().makeRotationY(0.5),
    deform: (l) => { l.y += 0.007 * Math.sin(l.x * 70) * Math.sin(l.z * 60); l.x *= 1 + 0.15 * Math.sin(l.z * 30); return l; } });
}

/** a cloth held by one corner: the diagonal hangs, the side corners droop, soft folds (natural frame: the held corner
 *  at the origin, hanging along −y, spread along x) */
function sudarHanging(B, lod) {
  const n = sg(lod, 14, 5);
  // the square collapses under its own weight into a narrow drape: the diagonal hangs straight down, the two free
  // corners fall in beside it, deep soft folds run down from the pinch
  plateGrid(B, 0.42, 0.42, (s1, t1) => {
    const d = s1 - t1, m = (s1 + t1) / 2;
    const spread = 0.085 * Math.sin(Math.PI * Math.min(1, m * 1.15)) + 0.012;
    const x = d * spread * 2.2;
    const y = -(s1 + t1) * 0.27 - 0.06 * d * d - 0.03 * m;
    const z = 0.038 * Math.sin(d * 7.5) * smooth(0, 0.35, m) + 0.012 * Math.sin(9 * m + 2 * d);
    return V(x, y, z);
  }, n, n);
}

const GRIP_TRAY = { grip: [0, 0, 0], rot: ID() };
export const SERVICE_PROPS = {
  staff: { big: true, build(B, lod) { staff(B, lod); }, grips: { fist: { grip: [0, 0, 0], rot: ID() }, free: { rot: eul(0, 0, 90), pos: [0, 0.016, 0] } } },
  migbaat: { build(B, lod) { migbaatProp(B, lod); }, grips: { fist: { grip: [0, 0.128, 0], rot: basis([0, -1, 0], [0, 0, 1], [-1, 0, 0]) }, tray: GRIP_TRAY, free: { rot: ID(), pos: [0, 0, 0] } } },
  psachter: { big: true, build(B, lod) { psachter(B, lod, false); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } },
  psachter_inverted: { big: true, build(B, lod) { psachter(B, lod, true); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } },
  kaf_covered: { build(B, lod) { kaf(B, lod, { covered: true }); }, poses: KAF_POSES, grips: { fist: { grip: KAF.grip, rot: KAF_FIST }, free: { rot: ID(), pos: [0, 0, 0] } } },
  // on the shoulder the load rests ON it (its underside 2 cm below the anchor, which is ≈ 2 cm above the shoulder's
  // cloth), shifted out onto the acromion so it clears the head; carried there with carry_shoulder(_walk) it is held by
  // the right hand under its front end (the clip carry_log(_walk), chosen by `poses`)
  gizrin_branch: {
    big: true, build(B, lod) { gizrinBranch(B, lod); },
    poses: { carry_shoulder: 'carry_log', carry_shoulder_walk: 'carry_log_walk' },
    grips: { shoulder: { grip: [-0.02, 0.018, 0.02], rot: ID() }, tray: { grip: [0, -0.02, 0], rot: eul(0, 90, 0) }, free: { rot: ID(), pos: [0, 0, 0] } },
  },
  branch_bundle: {
    big: true, build(B, lod) { branchBundle(B, lod); },
    poses: { carry_shoulder: 'carry_log', carry_shoulder_walk: 'carry_log_walk' },
    grips: { shoulder: { grip: [-0.04, 0.0, 0.03], rot: ID() }, tray: { grip: [0, 0, 0], rot: eul(0, 90, 0) }, free: { rot: ID(), pos: [0, 0, 0] } },
  },
  // carried (carry_lamb): the left flank on the forearms ≈ 0.92 m up, the back against the belly (z ≈ −0.15 m); the
  // fleeced yearling is ≈ 0.49 m thick, so its top comes to the carrier's collarbones
  lamb_dead: { flesh: true, big: true, build(B, lod, cls) { lambDead(B, lod, cls); }, grips: { tray: { grip: [0, -0.015, -0.12], rot: ID() }, free: { rot: ID(), pos: [0, 0, 0] } } },
  taper: { tip: [0, 0.255, 0], flame: { size: 0.035, intensity: 0.6, kind: 'lamp' }, build(B, lod) { taper(B, lod); }, grips: { fist: { grip: [0, 0, 0], rot: ID() }, free: { rot: eul(0, 0, 90), pos: [0, 0.005, 0] } } },
  entrails: { flesh: true, build(B, lod) { entrails(B, lod); }, grips: { tray: GRIP_TRAY, palm: { grip: [0, 0, 0], rot: PALM }, free: { rot: ID(), pos: [0, 0, 0] } } },
};
// charred twins of the limbs, for the pyre (free on the fire; the same grips as the fresh limbs)
for (const k of ['limb', 'limb_head', 'limb_foreleg', 'limb_oketz', 'limb_chazeh', 'limb_gerah', 'limb_dofen']) {
  const src = PROPS[k] || OFFERING_PROPS[k];
  SERVICE_PROPS[`${k}_charred`] = { ...src, flesh: true, build: charred(src.build) };
}
// ---------------------------------------------------------------------------------------------- people-4 props
// (docs/decisions/people-4.md)
const TEF = AMAH / 6, ETZ = TEF / 4;
const hashN = (i, s = 0) => { const x = Math.sin(i * 12.9898 + s * 78.233 + 4.1) * 43758.5453; return x - Math.floor(x); };
const SHOWBREAD = '#e2bc86';    // an unleavened loaf baked in its mould: pale gold, browned at the edges (reconstruction)

/**
 * One loaf of the lechem hapanim, as world/heichal/vessels.js lays them on the Shulchan: a "breached box" (R' Chanina,
 * Menachot 94b) — 10 × 5 tefachim, the 10 folded into a 5-tefach floor and two walls of 2½ (R' Yehudah, Menachot 11:5 /
 * 96a), open at both ends; the walls lean out a little and dip toward the middle; four 7-etzba horns rise from the walls'
 * ends and curl outward (Menachot 11:4; the seven etzba'ot are the horns' own height). Natural frame: the floor's
 * underside at y0, centred; the walls at ±x, the open ends toward ±z.
 */
function showbreadLoaf(B, lod, y0, seed) {
  const W = 5 * TEF, L = 5 * TEF, hw = 10 * ETZ, tw = 1.25 * ETZ;
  const lean = 0.35 * ETZ * (0.7 + 0.6 * hashN(seed, 1));
  const sag = 0.35 * ETZ * (0.6 + 0.8 * hashN(seed, 2));
  const nu = sg(lod, 14, 7), nv = sg(lod, 6, 3);
  // the crust browned along the edges and the walls' tops, paler on the broad faces
  const crust = (l, h) => 0.88 + 0.12 * (1 - smooth(0.6, 1, Math.max(Math.abs(l.x) / h[0], Math.abs(l.y) / h[1], Math.abs(l.z) / h[2])));
  S(B, 'bread', { color: SHOWBREAD });
  slabC(B, V(0, y0 + tw / 2, 0), [W, tw, L], { round: 0.32, nu, nv, shade: (l) => crust(l, [W / 2, tw / 2, L / 2]) });
  for (const s of [-1, 1]) {
    const m = new Matrix4().makeRotationZ(-s * Math.atan2(lean, hw));
    slabC(B, V(s * (W / 2 - tw / 2 + lean / 2), y0 + hw / 2, 0), [tw, hw, L * 0.996], {
      round: 0.32, nu: nv + 2, nv: nu, xf: m, shade: (l) => crust(l, [tw / 2, hw / 2, L / 2]),
      // the wall's top dips toward the middle (lifted out of the mould soft)
      deform: (l) => { const q = [l.x / (tw / 2), l.y / (hw / 2), l.z / (L / 2)].map((t) => Math.sign(t) * Math.abs(t) ** 0.32); l.set(q[0] * tw / 2, q[1] * hw / 2, q[2] * L / 2); l.y -= sag * (1 - l.z * l.z / (L * L / 4)) * smooth(-hw / 2, hw / 2, l.y); return l; },
    });
  }
  // the horns at the walls' ends, drawn up from the wall's top and curled outward, tapering
  for (const s of [-1, 1]) for (const e of [-1, 1]) {
    const base = V(s * (W / 2 + lean - tw * 0.45), y0 + hw - 0.8 * ETZ, e * (L / 2 - tw * 0.9));
    const pts = [[0, 0], [0.9, 1.9], [2.2, 3.6], [3.6, 4.4], [4.8, 4.5]].map(([o, u]) => base.clone().add(V(s * o * ETZ, u * ETZ, 0)));
    curve(B, pts, pts.map((_, i) => lerp(1.15, 0.2, (i / 4) ** 1.3) * ETZ), sg(lod, 8, 5), { capA: 'flat', capB: 'dome', domeH: 0.8, shade: (th, j) => 0.86 + 0.06 * j / 4 });
  }
}
/** a stack (seder) of n loaves as carried in and out of the Heichal on Shabbat (Menachot 11:7): the kanim are pulled
 *  on Friday (Menachot 11:6), so each loaf rests on the walls of the one below; hand-made, a touch off line */
function showbreadStack(B, lod, n) {
  const hw = 10 * ETZ;
  for (let i = 0; i < n; i++) {
    B.transform(new Matrix4().makeRotationY((hashN(i, 3) - 0.5) * 0.04).setPosition((hashN(i, 4) - 0.5) * 0.45 * ETZ, 0, (hashN(i, 5) - 0.5) * 0.45 * ETZ));
    showbreadLoaf(B, lod, i * hw, i + 1);
    B.transform(null);
  }
}

/** a piece broken from a loaf (eaten standing in the court; the Kohen Gadol's loaves broken up among his men): a corner
 *  of the floor with the stub of a wall, crust outside, the pale crumb on the broken faces. Natural frame (palm grip):
 *  lying on the palm, y up from it, −z toward the fingertips, +x toward the thumb */
const PIECE = 0.82;   // the piece's scale (a share in one hand)
function breadPiece(B, lod) {
  B.transform(new Matrix4().makeScale(PIECE, PIECE, PIECE));
  try { breadPieceShape(B, lod); } finally { B.transform(null); }
}
function breadPieceShape(B, lod) {
  const tw = 1.25 * ETZ, y0 = 0.006;
  const nu = sg(lod, 12, 6), nv = sg(lod, 6, 3);
  S(B, 'bread', { color: SHOWBREAD });
  slabC(B, V(0.004, y0 + tw / 2, -0.014), [0.08, tw, 0.076], { round: 0.42, nu, nv, deform: (l) => { l.y += 0.002 * Math.sin(l.x * 70 + 1) * smooth(-0.02, 0.04, l.z); return l; } });
  slabC(B, V(-0.032, y0 + 0.031, -0.014), [tw, 0.054, 0.072], { round: 0.42, nu: nv + 2, nv: nu, xf: new Matrix4().makeRotationZ(0.08) });
  // the broken faces: the front edge, the thumb side and the wall's top — ragged, the crumb showing
  S(B, 'flour', { color: '#efe2c6', rough: 0.95 });
  const rag = (amp) => (l) => { l.x += amp * Math.sin(l.z * 260 + l.y * 90); l.z += amp * Math.sin(l.x * 240); return l; };
  slabC(B, V(0.004, y0 + tw / 2, -0.0515), [0.074, tw * 0.82, 0.004], { round: 0.5, nu: sg(lod, 10, 5), nv: 3, deform: rag(0.0012) });
  slabC(B, V(0.0435, y0 + tw / 2, -0.014), [0.004, tw * 0.82, 0.07], { round: 0.5, nu: 3, nv: sg(lod, 10, 5), deform: rag(0.0012) });
  slabC(B, V(-0.0295, y0 + 0.058, -0.014), [tw * 0.8, 0.004, 0.066], { round: 0.5, nu: sg(lod, 8, 4), nv: 3, deform: rag(0.001) });
}

/**
 * The slaughtered, unflayed carcass carried to its hook: in the arms (tray — the lamb_dead pose, by kind), lying (free),
 * or across the shoulders behind the neck (shoulder — clips.js carry_slain: the legs held before the chest). With the
 * shechitah cut across the throat behind the jaw (the gullet and windpipe severed, Chullin 2:1) and the fleece about it
 * dark with blood (the blood itself was caught in the mizrak — Zevachim 3:1, Tamid 4:1).
 */
function slainCarcass(B, lod, cls, kind) {
  if (cls === 'shoulder') return slainShoulder(B, lod, kind);
  lambDead(B, lod, cls, { kind, wound: true });
}
/** the cut and the blood (posed rig): a dark-red slit across the throat between neck2 and the head, a soaked patch */
function throatWound(B, lod, P, rig) {
  const k = rig.dims.H / 0.66;
  const n2 = P.worldPos('neck2'), hp = P.worldPos('head'), q = P.worldQ('neck2');
  const axis = hp.clone().sub(n2).normalize();                                 // along the neck, toward the head
  const side = V(1, 0, 0).applyQuaternion(q);
  const ventral = new Vector3().crossVectors(axis, side).normalize();          // ⟂ both; the throat side (down at rest)
  if (ventral.dot(V(0, -1, 0).applyQuaternion(q)) < 0) ventral.negate();
  const r = (rig.dims.type === 'goat' ? 0.058 : 0.088) * k;                    // to the surface of the fleece / coat
  const c = n2.clone().lerp(hp, 0.62).addScaledVector(ventral, r);
  const basisM = (x, y, z) => new Matrix4().makeBasis(x, y, z);
  const fr = basisM(side, ventral, axis);
  S(B, 'liquid', { color: '#3f0a0a', rough: 0.4 });
  B.ellipsoid(c.clone().addScaledVector(axis, -0.022 * k).addScaledVector(ventral, -0.004), [0.05 * k, 0.012, 0.07 * k], { nu: sg(lod, 12, 6), nv: sg(lod, 6, 3), bone: 0, xf: fr,
    deform: (l) => { l.x *= 1 + 0.25 * Math.sin(l.z * 60); return l; } });
  S(B, 'meat', { color: '#6a1712', rough: 0.22 });
  B.ellipsoid(c.clone().addScaledVector(ventral, 0.004), [0.034 * k, 0.008, 0.009 * k], { nu: sg(lod, 10, 6), nv: 4, bone: 0, xf: fr });
  S(B, 'fat', { color: '#e4cfc0', rough: 0.3 });                              // the cut windpipe's pale ring
  B.ellipsoid(c.clone().addScaledVector(ventral, 0.008).addScaledVector(axis, 0.002), [0.008, 0.003, 0.004], { nu: 8, nv: 3, bone: 0, xf: fr });
}

/** across the shoulders (clips.js carry_slain): the barrel behind the neck, its back to the rear, the fore legs over the
 *  left shoulder to the left fist, the hind legs over the right to the right fist, the head hanging at the left. Natural
 *  frame = the shoulder grip's (the right clavicle's anchor, figure axes) */
function slainShoulder(B, lod, kind) {
  const man = getRig('man'), d = man.dims, k = d.H / 1.67;
  const A = V(d.shX * 0.86, man.rest[man.index.uarm_r].y + 0.072 * k, 0.03 * k);
  const fistAt = (s) => { const [x, y, z] = SLAIN_HANDS[s]; return V(x * k, d.H * y, z * k); };
  const sc = (getRig(ANIMALS[kind].rig).dims.H / 0.66);
  // the barrel's middle (figure frame): its belly on the trapezius behind the neck, clear of the back of the head
  const C = V(0.02 * k, (1.64 + 0.06 * (sc - 1)) * k, (0.3 + 0.08 * (sc - 1)) * k);
  const dorsal = V(0, 0.2, 0.98).normalize(), long = V(1, 0, 0);
  const side = new Vector3().crossVectors(dorsal, long).normalize();
  const base = B.count;
  let mid = null;
  const res = bakeAnimal(B, kind, lod, (P, rig) => {
    P.setQ(P.i('root'), new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(side, dorsal, long)));
    mid = P.worldPos('pelvis').lerp(P.worldPos('chest'), 0.5);
    const I = rig.index;
    for (const [leg, s, dx] of [['fl', 'l', -0.014], ['fr', 'l', 0.014], ['hl', 'r', -0.014], ['hr', 'r', 0.014]]) {
      const t = fistAt(s).sub(C).add(mid).add(V(dx, -0.03, 0.012));
      P.twoBone(I[`${leg}_up`], I[`${leg}_lo`], I[`${leg}_ft`], t, V(0, 1, 0.25), V(0, 0, 1));
      P.rot(`${leg}_ft`, 10, 0, 0);
    }
    // the neck and head hang limp at his left (lateral flexion — the lamb lies with its right side up)
    P.rot('neck', -8, 40, 0); P.rot('neck2', -6, 40, 0); P.rot('head', 0, 30, 0); P.rot('jaw', 10, 0, 0);
    P.rot('tail', 0, 0, -30); P.rot('ear_l', 0, 0, -20); P.rot('ear_r', 0, 0, -20);
  }, { tint: [0.3, 0.3, 0.4, 0.4] });
  if (!res) return;
  throatWound(B, lod, res.P, res.rig);
  // into the grip's frame: the barrel's middle onto C, relative to the clavicle anchor
  const off = C.clone().sub(mid).sub(A);
  for (let i = base; i < B.count; i++) { B.pos[i * 3] += off.x; B.pos[i * 3 + 1] += off.y; B.pos[i * 3 + 2] += off.z; }
}

/** a head baked from the live rig of `kind`, hanging nose-down below a carcass on the hook (still on in the flaying —
 *  Tamid 4:2 "until he reaches the breast; there he cut off the head"): its poll at `at`, the forehead toward −z (the
 *  carcass's back), the ears hanging toward the ground */
function hangingHead(B, lod, kind, at) {
  const rig = getRig(ANIMALS[kind].rig);
  const { fwd, up, P0 } = quadHeadFrame(rig);
  const I = rig.index;
  const headBones = new Set([I.head, I.jaw, I.ear_l, I.ear_r]);
  const base = B.count;
  const res = bakeAnimal(B, kind, lod, (P) => { P.rot('ear_l', 70, 0, 25); P.rot('ear_r', 70, 0, -25); P.rot('jaw', 8, 0, 0); }, {
    tint: [0.3, 0.3, 0.4, 0.4],
    only: (si, sw, i) => { let w = 0; for (let q = 0; q < 4; q++) if (headBones.has(si[i * 4 + q])) w += sw[i * 4 + q] / 255; return w > 0.6; },
  });
  if (!res) return;
  const side = new Vector3().crossVectors(up, fwd).normalize();
  const S0 = new Matrix4().makeBasis(side, up, fwd).invert();
  const T0 = new Matrix4().makeBasis(V(1, 0, 0), V(0, 0, -1), V(0, -1, 0));     // up (forehead) → −z, fwd (nose) → −y
  const M = new Matrix4().makeTranslation(at.x, at.y, at.z).multiply(T0).multiply(S0).multiply(new Matrix4().makeTranslation(-P0.x, -P0.y, -P0.z));
  const v = new Vector3();
  for (let i = base; i < B.count; i++) {
    v.set(B.pos[i * 3], B.pos[i * 3 + 1], B.pos[i * 3 + 2]).applyMatrix4(M);
    B.pos[i * 3] = v.x; B.pos[i * 3 + 1] = v.y; B.pos[i * 3 + 2] = v.z;
  }
  // the neck's cut stump above it is the carcass's; the throat cut shows on the head's underside (toward +z)
  S(B, 'meat', { color: '#5e1510', rough: 0.25 });
  B.ellipsoid(at.clone().add(V(0, -0.02, 0.045 * rig.dims.H / 0.66)), [0.035, 0.01, 0.02], { nu: 8, nv: 4, bone: 0 });
}

/** the kinds' carcass proportions against the lamb's (rig L, W) and their fell (the goat's leaner, redder) */
const CARCASS = {
  lamb: { L: 1, W: 1, alyah: 1 }, ewe: { L: 0.97, W: 0.97, alyah: 0.9 }, ram: { L: 1.22, W: 1.22, alyah: 1.3 },
  goat: { L: 1.07, W: 0.88, alyah: 0, lean: true }, she_goat: { L: 1.02, W: 0.85, alyah: 0, lean: true },
};

/**
 * The hide after flaying, by kind: the sheep's fleece (hide()); the goat's (people-4-fix) a real hide - its outline with
 * the flaps of the four legs and the neck and the stub of the tail, folded once along the backbone with the long black
 * hair outside, the two layers lying on one another, the hair hanging over the edges in locks. Natural frame: lying
 * on the floor, the fold along x.
 */
function hideKind(B, lod, kind) {
  if (kind !== 'goat') { hide(B, lod); return; }
  const L = 0.3, W0 = 0.2, rf = 0.011, T = 0.003, arc = (Math.PI * rf) / 2, Zf = W0 / 2;
  // half-width (spine to belly edge) along the hide: the legs' flaps fore (+x) and hind
  const Wx = (x) => W0 * (1 - 0.18 * (x / L) ** 2) + 0.075 * Math.exp(-(((x - 0.62 * L) / 0.045) ** 2)) + 0.08 * Math.exp(-(((x + 0.6 * L) / 0.05) ** 2));
  const at = (u, w, inner) => {
    const xu = lerp(-L, L, u), d = Math.abs(w) * Wx(xu), top = w > 0;
    const x = lerp(-L - 0.035 * smooth(0.03, 0, d), L + 0.08 * smooth(0.08, 0.02, d), u);   // the tail's stub; the neck
    const r = inner ? rf - T : rf;
    let y, z;
    if (d < arc) { const b = (top ? 1 : -1) * (Math.PI / 2) * (d / arc); y = rf + r * Math.sin(b); z = Zf + r * Math.cos(b); }
    else {
      const lay = smooth(arc, arc + 0.07, d);                                   // the upper layer settles onto the lower
      y = top ? lerp(rf + r, T + 0.0012 + (inner ? 0 : T), lay) : rf - r;
      z = Zf - (d - arc);
      if (top && lod === 0) y += 0.0025 * Math.sin(x * 31 + d * 17) * lay;      // the hair's lie
    }
    return V(x, y + 0.0015, z);
  };
  const nu = sg(lod, 22, 10), nw = sg(lod, 18, 8);
  S(B, 'coatProp', { color: '#1d1a18', rough: 0.74, pat: PAT.COAT });
  const C = (A) => V(A.x, 0.005, Math.min(A.z, Zf));          // between the two layers (inside the fold's round)
  B.grid(nu, nw, (i, j) => { const p = at(i / nu, (2 * j) / nw - 1, false); return { p, u: p.x, v: p.z, w: 0, shade: 0.8 + 0.2 * Math.sin(i * 2.1 + j * 1.3) ** 2 }; },
    { inside: (A) => C(A) });
  S(B, 'hide');
  B.grid(nu, nw, (i, j) => { const p = at(i / nu, (2 * j) / nw - 1, true); return { p, u: p.x, v: p.z, w: 0, shade: 0.7 }; }, { inside: (A) => C(A), invert: true });
  if (lod > 0) return;
  // the long hair over the edges: a shag of broad, overlapping locks from under the edge out onto the floor (matte, the
  // hair's own streaks along each), the free edges of both layers and the ends
  S(B, 'coatProp', { color: '#1a1715', rough: 0.92, pat: PAT.COAT });
  const lock = (p, out, len, wid, k) => {
    const d = V(out.x, 0, out.z).normalize(), sd = V(-d.z, 0, d.x).applyAxisAngle(d, (hashN(k, 7) - 0.5) * 0.5);
    const a = p.clone().addScaledVector(d, -0.012).add(V(0, 0.0006, 0));
    B.ribbon([a, p.clone().addScaledVector(d, len * 0.3).add(V(0, 0.0008, 0)), p.clone().addScaledVector(d, len * 0.7).setY(Math.max(0.0018, p.y * 0.35)), p.clone().addScaledVector(d, len).setY(0.0016)],
      (t) => wid * (1 - 0.45 * t), { side: sd, weights: 0, shade: 0.7 + 0.3 * hashN(k, 8) });
  };
  let k = 0;
  for (const w of [-1, 1]) for (let i = 0; i < 34; i++) {
    const u = Math.min(1, Math.max(0, (i + 0.5 + (hashN(++k, 2) - 0.5) * 0.8) / 34)), p = at(u, w, false);
    lock(p, V((hashN(k, 3) - 0.5) * 0.6, 0, -1), 0.022 + 0.03 * hashN(k, 4), 0.022 + 0.012 * hashN(k, 5), k);
  }
  for (const u of [0, 1]) for (let j = 0; j < 9; j++) {
    const w = ((j + 0.5) / 9) * 2 - 1, p = at(u, w, false);
    lock(p, V(u ? 1 : -1, 0, (hashN(++k, 5) - 0.5) * 0.6), 0.02 + 0.025 * hashN(k, 6), 0.02 + 0.01 * hashN(k, 9), k);
  }
}

/**
 * The fats (eimurim) of a lamb's or kid's shelamim, chatat or asham in a silver basin, as one kohen takes them up to
 * be salted and burned (Vayikra 3:9–10, 3:14–15; 4:8–9; Rambam MK 6:4): the fat that covers the innards (the caul, a
 * pale lace), the fat on the innards, the two kidneys in their suet, the lobe of the liver (yoteret) — and of a sheep the
 * whole fat tail (alyah), cut off near the backbone; a goat's tail is not offered (Vayikra 3:14–15).
 */
function eimurim(B, lod, o = {}) {
  S(B, 'silver');
  const prof = [[0.11, 0], [0.145, 0.025], [0.162, 0.05], [0.165, 0.056]];
  vessel(B, [[0.001, 0], ...prof], sg(lod, 24, 12), 0.003);
  const sheep = o.alyah !== false;
  const y0 = 0.006;
  // raw fat is waxy and opaque, not the carcass's thin fell (no red showing through): plain, with a soft mottle; the
  // kidney and the liver smooth and glossy, not cut muscle (people-4-fix: the marbled 'meat' read as steak)
  const fatSet = (color, rough) => S(B, 'fat', { color, rough, pat: PAT.NONE });
  const organ = (color, rough) => S(B, 'meat', { color, rough, pat: PAT.NONE });
  const mottle = (f, a) => (l) => 1 - a + a * (0.5 + 0.5 * Math.sin(l.x * f + 1.3) * Math.sin(l.z * f * 1.13 + 0.4));
  // the layout (people-4-fix: everything ≥ 1.5 cm inside the wall): a sheep's alyah fills the back half and the rest
  // lies in the front half, partly on top of one another; a goat's (no alyah) spread over the floor
  const L = sheep
    ? { kid: [[-0.055, -0.058, 0.5], [0.05, -0.064, -0.35]], kidR: [0.036, 0.022, 0.027], liver: [0.072, 0.034, -0.08, -0.72],
      caul: [-0.012, -0.072, 0.11, 0.06, 0.036], lumps: [[-0.092, 0.0, 0.016], [0.09, -0.004, 0.015], [-0.004, -0.098, 0.013]] }
    : { kid: [[-0.05, 0.03, 0.4], [0.05, 0.04, -0.3]], kidR: [0.036, 0.022, 0.027], liver: [0.02, 0.022, -0.05, -0.2],
      caul: [-0.02, -0.02, 0.13, 0.09, 0.03], lumps: [[-0.08, -0.05, 0.016], [0.085, -0.03, 0.015], [0.0, 0.085, 0.014]] };
  if (sheep) {
    // the alyah: a broad, heavy pad of fat in two lobes parted by a groove, lying across the basin's back half; at its
    // root the cut through the tail, the vertebra showing
    fatSet('#ecdfc5', 0.5);
    B.ellipsoid(V(0.0, y0 + 0.024, 0.042), [0.1, 0.026, 0.068], { nu: sg(lod, 18, 9), nv: sg(lod, 8, 4), bone: 0, shade: mottle(70, 0.07),
      // pear-shaped: broad where the fat sagged, narrowing to the root at the cut (+x); two lobes parted by a groove
      // cut off flat at its root (x 0.085), where the cut face shows
      deform: (l) => { l.y *= 1 - 0.5 * Math.exp(-((l.z / 0.012) ** 2)) * smooth(-0.01, 0.026, l.y); l.z *= 1 - 0.35 * smooth(-0.04, 0.1, l.x); l.y *= 1 - 0.25 * smooth(0.02, 0.1, l.x); l.x = Math.min(l.x, 0.085); return l; } });
    S(B, 'meat', { color: '#d9b8a3', rough: 0.3, pat: PAT.NONE });
    B.ellipsoid(V(0.0855, y0 + 0.024, 0.042), [0.0012, 0.0095, 0.022], { nu: 10, nv: 5, bone: 0 });
    S(B, 'bone');
    B.ellipsoid(V(0.0865, y0 + 0.025, 0.042), [0.0012, 0.0045, 0.0055], { nu: 6, nv: 4, bone: 0 });
  }
  // the two kidneys in their suet: white, crumbly lumps, the dark glossy kidney showing where the suet was opened
  const [kx, ky, kz] = L.kidR;
  for (const [x, z, a] of L.kid) {
    fatSet('#f4eedf', 0.7);
    B.ellipsoid(V(x, y0 + ky, z), [kx, ky, kz], { nu: sg(lod, 12, 6), nv: sg(lod, 7, 4), bone: 0, xf: new Matrix4().makeRotationY(a), shade: mottle(160, 0.08),
      deform: (l) => { l.y += 0.004 * Math.sin(l.x * 160) * Math.sin(l.z * 150); return l; } });
    organ('#4e1a14', 0.16);
    B.ellipsoid(V(x + 0.01 * Math.cos(a), y0 + 2 * ky - 0.004, z - 0.01 * Math.sin(a)), [0.021, 0.0105, 0.013], { nu: sg(lod, 10, 6), nv: 5, bone: 0, xf: new Matrix4().makeRotationY(a),
      shade: (l) => 0.82 + 0.18 * smooth(-0.006, 0.01, l.y) });
  }
  // the lobe of the liver (yoteret): smooth, glossy dark red-brown, a thin edge
  const [lx, ly, lz, la] = L.liver;
  organ('#45130f', 0.13);
  B.ellipsoid(V(lx, y0 + ly, lz), [0.048, 0.01, 0.024], { nu: sg(lod, 12, 6), nv: 5, bone: 0, xf: new Matrix4().makeRotationY(la),
    deform: (l) => { l.y *= 1 - 0.55 * smooth(0.01, 0.024, Math.abs(l.z)); return l; }, shade: (l) => 0.85 + 0.15 * smooth(-0.008, 0.008, l.y) });
  // the caul (the fat that covers the innards): a thin, pale, lacy sheet folded over the front of the pile
  const [cx, cz, cw, cd, ch] = L.caul;
  fatSet('#f6f0e2', 0.45);
  const n = sg(lod, 12, 5);
  plateGrid(B, cw, cd, (u, v) => {
    const x = cx + (u - 0.5) * cw, z = cz + (v - 0.5) * cd;
    return V(x, y0 + ch * (0.55 + 0.45 * Math.sin(Math.PI * u)) * (0.75 + 0.25 * Math.sin(v * 7)) + 0.004 * Math.sin(u * 17 + v * 9), z);
  }, n, Math.max(2, n - 4));
  // the fat stripped from the innards: small irregular lumps between them
  fatSet('#f1e8d6', 0.55);
  for (const [x, z, r] of L.lumps) B.ellipsoid(V(x, y0 + 0.012, z), [r * 1.3, r * 0.6, r], { nu: 8, nv: 4, bone: 0, shade: mottle(200, 0.08) });
}

/** the nazir's basket (sal matzot, Bamidbar 6:15; Menachot 7:2, 76b): ten loaves (challot) of matzah mingled with oil and ten
 *  wafers (rekikin) anointed with oil, in a shallow willow basket with two handles */
function salMatzot(B, lod) {
  S(B, 'reed');
  vessel(B, [[0.001, 0], [0.15, 0], [0.19, 0.03], [0.205, 0.1], [0.21, 0.108]], sg(lod, 24, 12), 0.008);
  for (const s of [-1, 1]) curve(B, [V(s * 0.2, 0.095, -0.06), V(s * 0.245, 0.11, 0), V(s * 0.2, 0.095, 0.06)], [0.008, 0.008, 0.008], sg(lod, 6, 4));
  // two piles: the challot (thick, round, glossy with the oil) and the rekikin (thin wafers, smeared with oil)
  const nC = sg(lod, 10, 4), nR = sg(lod, 10, 4);
  S(B, 'bread', { color: '#e4c48f', rough: 0.55 });
  for (let i = 0; i < nC; i++) {
    const t = i / nC;
    B.ellipsoid(V(-0.07 + 0.008 * Math.sin(i * 2.3), 0.025 + (lod === 0 ? i * 0.0075 : i * 0.019), 0.005 * Math.cos(i * 1.7)), [0.065, 0.012, 0.065], { nu: sg(lod, 12, 6), nv: 4, bone: 0,
      deform: (l) => { l.y *= 1 + 0.2 * Math.sin(l.x * 40 + t * 9) * Math.sin(l.z * 37); return l; } });
  }
  S(B, 'bread', { color: '#ead3a6', rough: 0.45 });
  for (let i = 0; i < nR; i++) {
    B.ellipsoid(V(0.085 + 0.006 * Math.cos(i * 2.1), 0.02 + (lod === 0 ? i * 0.0042 : i * 0.0105), 0.004 * Math.sin(i * 1.3)), [0.07, 0.003, 0.07], { nu: sg(lod, 12, 6), nv: 3, bone: 0 });
  }
}

/** a razor (ta'ar — Bamidbar 6:5, 6:18; the nazir's hair shaved in his chamber, Middot 2:5): a broad iron blade with a
 *  curved edge on a short bone handle (after the period's razors; reconstruction). Natural frame: the handle along +y */
function razor(B, lod) {
  S(B, 'bone', { color: '#e3d8c2', rough: 0.45 });
  slabC(B, V(0, 0.035, 0), [0.014, 0.07, 0.01], { round: 0.5, nu: sg(lod, 10, 6), nv: 5 });
  // the blade: one piece, its back straight along the handle's line, the edge swelling in a curve and rounding into a
  // blunt end; thick at the back (1.8 mm), ground thin to the edge, the honed bevel bright (people-4-fix)
  S(B, 'iron', { rough: 0.22 });
  const y0 = 0.072, y1 = 0.142, xb = -0.007;
  const xe = (t) => xb + 0.018 + 0.016 * Math.sin(Math.PI * t ** 0.9);
  const at = (u, t, sgn) => {
    const x = lerp(xb, xe(t), u), y = lerp(y0, y1 - 0.009 * u * u, t);
    return V(x, y, sgn * (0.0009 * (1 - u) ** 0.8 + 0.00012));
  };
  const nu = sg(lod, 6, 3), nt = sg(lod, 10, 5);
  for (const sgn of [1, -1]) {
    B.grid(nu, nt, (i, j) => ({ p: at(i / nu, j / nt, sgn), u: i * 0.005, v: j * 0.01, w: 0, shade: i / nu > 0.75 ? 1.25 : 1 }), { inside: V(0, 0.1, -sgn), flip: false });
  }
  // the back, the end and the heel: strips joining the two faces
  const strip = (pts, out) => B.grid(pts.length - 1, 1, (k, j) => ({ p: at(...pts[k], j ? -1 : 1), u: k * 0.005, v: j * 0.002, w: 0 }), { inside: out });
  strip(Array.from({ length: nt + 1 }, (_, j) => [0, j / nt]), V(0.05, 0.1, 0));                 // the back (spine)
  strip(Array.from({ length: nu + 1 }, (_, i) => [i / nu, 1]), V(0, 0.0, 0));                     // the end
  strip(Array.from({ length: nu + 1 }, (_, i) => [i / nu, 0]), V(0, 0.2, 0));                     // the heel
  S(B, 'bronze', { rough: 0.35 });
  B.box(V(0.0, y0, 0), [0.017, 0.006, 0.006]);                                                       // the bolster
}

/**
 * An earthenware cooking pot (the nazir's shelamim cooked in his chamber, Middot 2:5; Nazir 6:8; "an earthenware vessel
 * in which it was cooked is broken", Zevachim 11:7): the Jerusalem cooking pot of the period — a thin, red-brown, ribbed
 * globular body, a short neck with an everted rim, two strap handles from rim to shoulder, the base sooted (after the
 * pottery of Herodian Jerusalem; reconstruction).
 */
const POT_PROF = [[0.001, 0.0], [0.05, 0.004], [0.095, 0.03], [0.118, 0.075], [0.118, 0.11], [0.1, 0.15], [0.068, 0.178], [0.06, 0.186], [0.066, 0.2], [0.072, 0.206]];
const potSoot = (y) => lerp(0.32, 1, smooth(0.02, 0.1, y));     // the base blackened by the fire
function clayPot(B, lod) {
  S(B, 'clay');
  const prof = POT_PROF;
  const soot = (th, j) => { const y = prof[Math.min(j, prof.length - 1)][1]; return potSoot(y) * (lod === 0 && j >= 4 && j <= 6 ? 0.94 + 0.06 * Math.sin(j * 9) : 1); };
  lathe(B, prof, sg(lod, 22, 11), { capA: 'flat', shade: soot, radial: lod === 0 ? (th, j) => 1 + (j >= 4 && j <= 6 ? 0.012 * Math.sin(th * 3 + j) : 0) : null });
  const inner = prof.slice(5).reverse().map(([r, y]) => [Math.max(0.001, r - 0.004), y]);
  inner.push([0.03, 0.17]);
  lathe(B, inner, sg(lod, 22, 11), { invert: true, shade: () => 0.45 });
  if (lod === 0) for (let i = 0; i < 6; i++) {        // the ribbing of the shoulder
    const y = 0.112 + i * 0.009, r = lerp(0.116, 0.088, i / 6);
    curve(B, Array.from({ length: 25 }, (_, a) => V(Math.cos(a / 24 * Math.PI * 2) * (r + 0.0015), y, Math.sin(a / 24 * Math.PI * 2) * (r + 0.0015))), Array(25).fill(0.0016), 4);
  }
  for (const s of [-1, 1]) curve(B, [V(s * 0.068, 0.196, 0), V(s * 0.1, 0.19, 0), V(s * 0.112, 0.15, 0), V(s * 0.108, 0.13, 0)], [[0.006, 0.0025], [0.007, 0.0028], [0.007, 0.0028], [0.006, 0.0025]], sg(lod, 6, 4));
}
/** the pot's outer profile by arc-length fraction s (0 the base centre … 1 the rim): radius, height, outward normal */
const POT_S = (() => { const L = [0]; for (let i = 1; i < POT_PROF.length; i++) L.push(L[i - 1] + Math.hypot(POT_PROF[i][0] - POT_PROF[i - 1][0], POT_PROF[i][1] - POT_PROF[i - 1][1])); return L.map((l) => l / L[L.length - 1]); })();
function potAt(s) {
  let i = 1;
  while (i < POT_S.length - 1 && POT_S[i] < s) i++;
  const [r0, y0] = POT_PROF[i - 1], [r1, y1] = POT_PROF[i];
  const t = Math.min(1, Math.max(0, (s - POT_S[i - 1]) / (POT_S[i] - POT_S[i - 1])));
  const dr = r1 - r0, dy = y1 - y0, l = Math.hypot(dr, dy);
  return { r: lerp(r0, r1, t), y: lerp(y0, y1, t), nr: dy / l, ny: -dr / l };
}
/**
 * One sherd of the cooking pot in the pot's frame: the patch θ0…θ1 × s0…s1 of its wall (full: the whole round of the
 * base up to s1) with its 4.5 mm thickness - the sooted outer face (and the shoulder's ribbing), the plain inner face,
 * and the fresh break all round, paler and redder, along an irregular outline (people-4-fix).
 */
function sherd(B, lod, o) {
  const T = 0.0045, full = !!o.full, nu = full ? sg(lod, 16, 8) : sg(lod, 7, 3), nv = sg(lod, 5, 2);
  const [th0, th1] = full ? [0, Math.PI * 2] : o.th, [s0, s1] = o.s;
  const jag = (q, k) => 0.17 * Math.sin(q * 8.3 + o.seed * 3.7 + k * 1.9) + 0.09 * Math.sin(q * 21.7 + o.seed * 1.3 + k * 4.1);
  const at = (i, j, inner) => {
    const u = i / nu, v = j / nv;
    const dth = th1 - th0, ds = s1 - s0;
    const th = full ? th0 + dth * u : lerp(th0 + dth * 0.18 * jag(v, 0), th1 - dth * 0.18 * jag(v, 1), u);
    const top = full ? 0.17 * Math.sin(u * 6 * Math.PI + o.seed * 3.7) + 0.09 * Math.sin(u * 14 * Math.PI + o.seed * 1.3) : jag(u, 3);  // (periodic round the base)
    const sv = lerp(full ? s0 : s0 + ds * 0.25 * jag(u, 2), s1 - ds * 0.25 * top, v);
    const q = potAt(Math.min(1, Math.max(0, sv)));
    let r = q.r, y = q.y;
    if (lod === 0 && !inner && y > 0.11 && y < 0.16) r += 0.0011 * (0.5 + 0.5 * Math.sin(((y - 0.112) / 0.009) * Math.PI * 2));
    if (inner) { r -= T * q.nr; y -= T * q.ny; }
    return { p: V(Math.cos(th) * r, y, Math.sin(th) * r), y };
  };
  const axis = (A) => V(0, Math.min(0.15, Math.max(0.05, A.y + 0.05)), 0);
  S(B, 'clay');
  B.grid(nu, nv, (i, j) => { const q = at(i, j, false); return { p: q.p, u: i * 0.01, v: j * 0.01, w: 0, shade: potSoot(q.y) }; }, { inside: axis });
  B.grid(nu, nv, (i, j) => { const q = at(i, j, true); return { p: q.p, u: i * 0.01, v: j * 0.01, w: 0, shade: 0.72 }; }, { inside: axis, invert: true });
  // the break: a band round the outline from the outer face to the inner
  const ring = [];
  if (!full) { for (let i = 0; i < nu; i++) ring.push([i, 0]); for (let j = 0; j < nv; j++) ring.push([nu, j]); }
  for (let i = nu; i > 0; i--) ring.push([i, nv]);
  if (!full) for (let j = nv; j > 0; j--) ring.push([0, j]);
  ring.push(ring[0]);
  const c = at(nu / 2, nv / 2, false).p.lerp(at(nu / 2, nv / 2, true).p, 0.5);
  S(B, 'clay', { color: '#ad6c49', rough: 0.95 });
  B.grid(ring.length - 1, 1, (k, j) => { const [i, jj] = ring[k]; return { p: at(i, jj, j === 1).p, u: k * 0.004, v: j * 0.004, w: 0, shade: 1.06 }; },
    { inside: (A) => V(c.x, A.y, c.z) });
  return potAt((s0 + s1) / 2);
}
/** the pot broken (Zevachim 11:7 "an earthenware vessel in which it was cooked is broken"): its sherds on the floor —
 *  the rim with a strap handle, the sooted round of the base, pieces of the wall and the ribbed shoulder, most lying
 *  concave side up, one on its edge (people-4-fix: shells cut from the pot's own profile) */
function clayPotBroken(B, lod) {
  const pieces = [
    { th: [-0.5, 0.6], s: [0.58, 1.0], handle: true, at: [0.0, 0.03], yaw: 0.7, lie: 'side', seed: 1 },   // on its side, the handle up
    { full: true, s: [0, 0.22], at: [-0.15, -0.05], yaw: 0, lie: 'base', seed: 2 },
    { th: [1.3, 2.15], s: [0.24, 0.52], at: [0.15, 0.08], yaw: 2.2, lie: 'down', seed: 3 },
    { th: [2.5, 3.2], s: [0.4, 0.72], at: [0.03, -0.15], yaw: 4.1, lie: 'down', seed: 4 },
    { th: [3.6, 4.3], s: [0.44, 0.78], at: [-0.14, 0.12], yaw: 1.0, lie: 'edge', seed: 5 },
    { th: [4.8, 5.35], s: [0.26, 0.46], at: [0.19, -0.1], yaw: 5.3, lie: 'up', seed: 6 },
  ].slice(0, lod === 0 ? 6 : 4);
  const down = V(0, -1, 0), up = V(0, 1, 0), edge = V(0.75, -0.66, 0).normalize(), side = V(0.55, 0.83, 0).normalize();
  for (const pc of pieces) {
    const sub = new MeshBuilder();
    const mid = sherd(sub, lod, pc);
    if (pc.handle) {
      S(sub, 'clay');
      curve(sub, [V(0.068, 0.196, 0), V(0.1, 0.19, 0), V(0.112, 0.15, 0), V(0.108, 0.13, 0)], [[0.006, 0.0025], [0.007, 0.0028], [0.007, 0.0028], [0.006, 0.0025]], sg(lod, 6, 4));
    }
    // lie it down: the outer face's normal at its middle turned down (concave side up), up, or to the side (on edge)
    const thc = pc.full ? 0 : (pc.th[0] + pc.th[1]) / 2;
    const n = V(mid.nr * Math.cos(thc), mid.ny, mid.nr * Math.sin(thc)).normalize();
    const q = new Quaternion().setFromUnitVectors(n, { up, edge, side }[pc.lie] || down);
    const m = new Matrix4().makeRotationY(pc.yaw).multiply(new Matrix4().makeRotationFromQuaternion(pc.lie === 'base' ? new Quaternion() : q));
    sub.applyMatrix(m);
    let minY = Infinity, cx = 0, cz = 0;
    const nv = sub.count;
    for (let i = 0; i < nv; i++) { minY = Math.min(minY, sub.pos[i * 3 + 1]); cx += sub.pos[i * 3]; cz += sub.pos[i * 3 + 2]; }
    sub.applyMatrix(new Matrix4().makeTranslation(pc.at[0] - cx / nv, 0.0005 - minY, pc.at[1] - cz / nv));
    B.merge(sub);
  }
}

/** coins: silver shekels and half-shekels of Tyre (the sanctuary's reckoning is "in the Tyrian maneh", Bekhorot 8:7) and small
 *  bronze prutot — for the chests (Shekalim 6:5) or the seals (Shekalim 5:4). Natural frame: lying flat, a small spread */
function coins(B, lod) {
  const list = [[0, 0.0, 0.0, 0.0125, 'silver'], [0.024, 0.002, 0.012, 0.0105, 'silver'], [-0.02, 0.004, 0.016, 0.0125, 'silver'],
    [0.012, 0.0045, -0.018, 0.0075, 'bronze'], [-0.012, 0.002, -0.014, 0.0072, 'bronze'], [0.028, 0.0035, -0.008, 0.007, 'bronze']];
  list.forEach(([x, y, z, r, m], i) => {
    S(B, m, m === 'bronze' ? { color: '#7e6040', rough: 0.5 } : { rough: 0.32 });
    // each lying a little tilted on the ones below; the struck faces a touch domed
    B.transform(new Matrix4().makeRotationFromEuler(new Euler((hashN(i, 7) - 0.5) * 0.16, hashN(i, 8) * 6.28, (hashN(i, 9) - 0.5) * 0.16)).setPosition(x, y, z));
    lathe(B, [[0.001, 0], [r * 0.96, 0], [r, 0.0009], [r * 0.96, 0.0026], [0.001, 0.0029]], sg(lod, 12, 6), { capA: 'flat', capB: 'flat' });
    B.transform(null);
  });
}

/**
 * The isaron, the larger of the two dry measures of the Mikdash (Menachot 9:1: the isaron and the half-isaron), holding
 * a tenth of an ephah (43⅕ eggs ≈ 2.5 l at R' Chaim Naeh, scaled with the amah), heaped with fine flour — "all the
 * measures in the Mikdash were heaped" (Menachot 9:5). Silver, straight-walled (reconstruction of the form).
 */
const ISARON = (() => {
  const vol = 1.8 * KAV_M3;                     // a kav = 24 eggs, the isaron 43⅕
  const r = Math.cbrt(vol / (2 * Math.PI));     // a cylinder as deep as it is wide
  return { r, h: 2 * r };
})();
function measure(B, lod) {
  const { r, h } = ISARON;
  S(B, 'silver');
  vessel(B, [[0.001, 0], [r + 0.004, 0], [r + 0.004, 0.006], [r, 0.01], [r, h - 0.006], [r + 0.003, h - 0.002], [r + 0.003, h]], sg(lod, 22, 11), 0.0025);
  S(B, 'flour');
  // the heap's flour pattern laid flat from above (people-4-fix: the ellipsoid's own uv wound into a pinwheel at its pole)
  B.ellipsoid(V(0, h - 0.004, 0), [r - 0.002, r * 0.62, r - 0.002], { nu: sg(lod, 16, 8), nv: 5, bone: 0, lat: [0, 0.5],
    deform: (l) => { l.y *= 1 + 0.08 * Math.sin(l.x * 70) * Math.sin(l.z * 60); return l; }, uvFn: (q) => [q.x, q.z] });
}

/** dough being kneaded (people-4-fix — the 'knead' pose's work: the meal offerings, Menachot 5:1–2; the showbread's dough,
 *  Yoma 38a): about an isaron's worth (≈ 3 l), a soft mound pushed out long by the heels of the hands, its far edge folded
 *  back over it in a ridge, the dusting of flour round it. Natural frame: lying on the table, its bottom at y 0, the
 *  kneader at +z (lay it KNEAD.reach before him on the KNEAD.surface). */
function dough(B, lod) {
  S(B, 'flour', { color: '#efe4cd', rough: 0.95 });
  B.ellipsoid(V(0, 0.0008, -0.004), [0.165, 0.0012, 0.135], { nu: sg(lod, 16, 8), nv: 3, bone: 0, lat: [0, 0.5], uvFn: (q) => [q.x, q.z] });
  S(B, 'bread', { color: '#eadcbf', rough: 0.62, pat: PAT.NONE });
  B.ellipsoid(V(0, 0.002, 0), [0.13, 0.044, 0.1], { nu: sg(lod, 20, 10), nv: sg(lod, 10, 5), bone: 0,
    deform: (l) => {
      if (l.y < 0) l.y *= 0.04;                                                        // flat on the table
      l.y *= 1 - 0.18 * Math.exp(-(((l.z - 0.03) / 0.03) ** 2)) - 0.12 * Math.exp(-(((l.x / 0.05) ** 2) + ((l.z - 0.035) / 0.035) ** 2));   // the heels' trough
      l.y += 0.012 * Math.exp(-(((l.z + 0.045) / 0.018) ** 2)) * smooth(0.13, 0.05, Math.abs(l.x)) * smooth(0, 0.02, l.y);           // the fold
      return l;
    },
    shade: (l) => 0.92 + 0.08 * smooth(-0.07, -0.03, l.z) - 0.06 * Math.exp(-(((l.z + 0.06) / 0.008) ** 2)) });
}

const STACK_POSES = { carry: 'carry_stack', carry_walk: 'carry_stack_walk' };
const STACK_TRAY = { grip: [-0.19, 0.004, 0], rot: eul(0, 90, 0) };   // (natural +x → his front)
const SLAIN_GRIPS = { tray: { grip: [0, -0.015, -0.12], rot: ID() }, shoulder: { rot: ID() }, free: { rot: ID(), pos: [0, 0, 0] } };
export const PEOPLE4_PROPS = {
  // carried (carry_stack): the loaves' walls toward and away from the carrier (the solid bread before him), held well out
  // on the forearms so the back horns clear his chest (2–3 cm) — which way the kohanim turned the stacks is not stated ⚙
  showbread_stack: { big: true, build(B, lod) { showbreadStack(B, lod, 6); }, poses: STACK_POSES, grips: { tray: STACK_TRAY, free: { rot: ID(), pos: [0, 0, 0] } } },
  showbread_half: { big: true, build(B, lod) { showbreadStack(B, lod, 3); }, poses: STACK_POSES, grips: { tray: STACK_TRAY, free: { rot: ID(), pos: [0, 0, 0] } } },
  bread_piece: { build(B, lod) { breadPiece(B, lod); }, grips: { palm: { grip: [0, 0, 0], rot: PALM }, fist: { grip: [0.004 * PIECE, (0.006 + 0.625 * ETZ) * PIECE, 0.014 * PIECE], rot: eul(90, 0, 0) }, tray: { grip: [0, 0, 0], rot: ID() }, free: { rot: ID(), pos: [0, -0.006, 0] } } },
  lamb_slain: { flesh: true, big: true, poses: { carry_shoulder: 'carry_slain', carry_shoulder_walk: 'carry_slain_walk' }, build(B, lod, cls) { slainCarcass(B, lod, cls, 'lamb'); }, grips: SLAIN_GRIPS },
  ewe_slain: { flesh: true, big: true, poses: { carry_shoulder: 'carry_slain', carry_shoulder_walk: 'carry_slain_walk' }, build(B, lod, cls) { slainCarcass(B, lod, cls, 'ewe'); }, grips: SLAIN_GRIPS },
  goat_slain: { flesh: true, big: true, poses: { carry_shoulder: 'carry_slain', carry_shoulder_walk: 'carry_slain_walk' }, build(B, lod, cls) { slainCarcass(B, lod, cls, 'goat'); }, grips: SLAIN_GRIPS },
  she_goat_slain: { flesh: true, big: true, poses: { carry_shoulder: 'carry_slain', carry_shoulder_walk: 'carry_slain_walk' }, build(B, lod, cls) { slainCarcass(B, lod, cls, 'she_goat'); }, grips: SLAIN_GRIPS },
  hide_goat: { flesh: true, big: true, build(B, lod) { hideKind(B, lod, 'goat'); }, grips: { shoulder: { grip: [0, -0.02, 0], rot: eul(0, 0, 10) }, free: { rot: ID(), pos: [0, 0, 0] } } },
  eimurim: { flesh: true, build(B, lod) { eimurim(B, lod); }, grips: { tray: { grip: [0, 0, 0], rot: ID() }, palm: { grip: [0, 0, 0], rot: PALM }, free: { rot: ID(), pos: [0, 0, 0] } } },
  eimurim_goat: { flesh: true, build(B, lod) { eimurim(B, lod, { alyah: false }); }, grips: { tray: { grip: [0, 0, 0], rot: ID() }, palm: { grip: [0, 0, 0], rot: PALM }, free: { rot: ID(), pos: [0, 0, 0] } } },
  // tray: held out 10 cm and up 2 cm (the 42-cm basket's back wall clear of his belly, its floor on his fingers — people-4-fix)
  sal_matzot: { big: true, build(B, lod) { salMatzot(B, lod); }, grips: { tray: { grip: [0, -0.02, 0.1], rot: ID() }, shoulder: { grip: [-0.05, 0, 0], rot: eul(0, 0, -12) }, fist: { grip: [0.245, 0.11, 0], rot: eul(0, -90, 0) }, free: { rot: ID(), pos: [0, 0, 0] } } },
  razor: { build(B, lod) { razor(B, lod); }, grips: { fist: { grip: [0, 0.035, 0], rot: ID() }, free: { rot: eul(0, 0, 90), pos: [0, 0.007, 0] } } },
  clay_pot: { build(B, lod) { clayPot(B, lod); }, grips: { tray: { grip: [0, 0, 0], rot: ID() }, fist: { grip: [0.11, 0.16, 0], rot: eul(0, -90, 0) }, pour: { grip: [0, 0.17, 0.11], rot: PAN_FIST }, free: { rot: ID(), pos: [0, 0, 0] } } },
  clay_pot_broken: { build(B, lod) { clayPotBroken(B, lod); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } },
  coins: { build(B, lod) { coins(B, lod); }, grips: { palm: { grip: [0, -0.003, 0], rot: PALM }, fist: { grip: [0, 0, 0], rot: eul(0, 0, 90) }, free: { rot: ID(), pos: [0, 0, 0] } } },
  dough: { build(B, lod) { dough(B, lod); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } },
  measure: { build(B, lod) { measure(B, lod); }, grips: { tray: { grip: [0, 0, 0], rot: ID() }, palm: { grip: [0, 0, 0], rot: PALM }, pour: { grip: [0, ISARON.h * 0.85, ISARON.r + 0.006], rot: PAN_FIST }, free: { rot: ID(), pos: [0, 0, 0] } } },
};
// the hung states by kind (origin at the hook, free) — Tamid 4:2; a ram hangs from the middle row (G5)
for (const kind of ['ram', 'goat', 'ewe', 'she_goat']) {
  PEOPLE4_PROPS[`${kind}_hung`] = { flesh: true, big: true, build(B, lod) { lambHung(B, lod, kind); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } };
  PEOPLE4_PROPS[`carcass_flaying_${kind}`] = { flesh: true, big: true, build(B, lod) { carcassFlaying(B, lod, kind); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } };
  if (kind === 'ram' || kind === 'goat') PEOPLE4_PROPS[`carcass_hung_${kind}`] = { flesh: true, big: true, build(B, lod) { carcassHungBody(B, lod, { opened: true, kind }); }, grips: { free: { rot: ID(), pos: [0, 0, 0] } } };
}
// the bikkurim basket held by its rims and waved (clips.js wave_basket — Bikkurim 3:6): the right fist on the right rim,
// its orientation RIMS_HAND; the basket upright when the fist is (rot = (hand rotation · fist→hand)⁻¹)
{
  const q = handQ(RIMS_HAND.thumb, RIMS_HAND.fingers);
  const Q = new Matrix4().makeRotationFromQuaternion(q);
  const MR = basis([0, -1, 0], [0, 0, -1], [1, 0, 0]);
  const rot = MR.clone().transpose().multiply(Q.clone().transpose());
  PROPS.basket.grips.rims = { grip: [RIMS_HAND.rimR + RIMS_HAND.out, RIMS_HAND.rimY, 0], rot };
  PROPS.basket.poses = { ...(PROPS.basket.poses || {}), wave: 'wave_basket' };
}

// 'pour' grip (pour_low): the vessel upright in a fist whose thumb points along the pour and whose fingers point down,
// held at its handle (jugs), neck (flasks) or back rim (basins), so tipping the thumb down pours over the front lip
const POUR = {
  kuz: [0, 0.16, 0.088], wine_jug: [0, 0.15, 0.085], flask: [0, 0.188, 0], oil_flask: [0, 0.11, 0], cup_gold: [0, 0.02, 0],
  bowl: [0, 0.06, 0.1], mizrak_gold: [0, 0.115, 0.115], mizrak_silver: [0, 0.115, 0.115], teni: [0, 0.13, 0.12],
};
for (const [k, g] of Object.entries(POUR)) {
  const p = PROPS[k] || OFFERING_PROPS[k];
  p.grips = { ...p.grips, pour: { grip: g, rot: PAN_FIST } };
}
// ritual vessels kept in the hands of actors down to LOD 2 (system.js): they must not vanish at medium distance; the
// sudar too — the segan's waved cloth is a signal seen across the court (Tamid 7:3: Ben Arza and the Levites act on it)
export const HELD_VESSELS = new Set(['mizrak_gold', 'mizrak_silver', 'machtah_silver', 'machtah_gold', 'machtah_gold_yk', 'kaf', 'kaf_covered',
  'bazach', 'kuz', 'teni', 'flask', 'bowl', 'cup_gold', 'wine_jug', 'oil_flask', 'solet', 'chavitin', 'entrails_bazach', 'machavat', 'marcheshet',
  'sudar', 'eimurim', 'eimurim_goat', 'measure', 'clay_pot']);

// props that can stand on the palms in a two-handed carry
for (const k of ['solet', 'chavitin', 'salt', 'wine_jug', 'marcheshet', 'machavat', 'entrails_bazach', 'cup_gold', 'kaf_covered']) VESSELS.add(k);

Object.assign(PROPS, OFFERING_PROPS, SERVICE_PROPS, PEOPLE4_PROPS);

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
  if (cls === 'shoulder' || cls === 'palm' || cls === 'pour' || cls === 'rims' || cls.startsWith('pillow')) return null;
  return { grip: [0, 0, 0], rot: ID(), pos: [0, 0, 0] };
}

/** resolve the grip class actually available for a prop (tray/shoulder/pillow fall back to the fist) */
export function gripClass(name, cls) { return gripOf(name, cls) ? cls : 'fist'; }

function placementMatrix(name, cls, side) {
  const g = gripOf(name, cls) || gripOf(name, 'fist');
  const m = new Matrix4().makeTranslation(-g.grip[0], -g.grip[1], -g.grip[2]);
  m.premultiply(g.rot);
  if (cls === 'free') m.premultiply(new Matrix4().makeTranslation(...g.pos));
  else if (cls === 'fist' || cls === 'palm' || cls === 'pour' || cls === 'rims' || !gripOf(name, cls)) m.premultiply(side === 'l' ? M_L : M_R);
  else if (side === 'l' && !cls.startsWith('pillow')) m.premultiply(new Matrix4().makeScale(-1, 1, 1));
  return m;
}

/** geometry of a prop placed for (grip class, side) in the attach bone's frame */
export function buildPropGeometry(name, cls, side, lod) {
  const real = cls === 'free' ? 'free' : gripClass(name, cls);
  const key = PROPS[name].cache ? `${name}:${real}:${side}:${lod}` : null;
  if (key && _propGeos.has(key)) return _propGeos.get(key).clone();   // (each caller owns and may dispose its copy)
  const B = new MeshBuilder(null);
  PROPS[name].build(B, lod, real);
  B.applyMatrix(placementMatrix(name, real, side));
  const g = B.build();
  if (!key) return g;
  _propGeos.set(key, g);
  return g.clone();
}
const _propGeos = new Map();

/**
 * Build the sleepers' bedding ahead of the first sleeper: the four height fields (folded_garments /
 * folded_garments_ledge × lie / sleep) and the bedding props' LOD1 and LOD0 geometry, in steps of a few ms — run
 * for up to `budgetMs` per call; true when all is built. Drawn before then, a sleeper finishes its own part at once.
 */
export function prewarmBedding(budgetMs = 8) {
  _prewarm ||= prewarmJob();
  const t0 = performance.now();
  do { if (_prewarm.next().done) return true; } while (performance.now() - t0 < budgetMs);
  return false;
}
let _prewarm = null;
function* prewarmJob() {
  for (const [prop, narrow] of [['folded_garments', false], ['folded_garments_ledge', true]]) {
    for (const [lay, cls] of [['side', 'pillow_side'], ['back', 'pillow_back']]) {
      const key = `${lay}:${narrow ? 1 : 0}`;
      if (!_sleepers.has(key)) {
        const job = fieldJob(lay, narrow);
        while (!job.next().done) yield;
        _fieldJobs.delete(key);
      }
      for (const lod of [1, 0]) { buildPropGeometry(prop, cls, 'r', lod).dispose(); yield; }
    }
  }
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
    if (real === 'fist' || real === 'palm' || real === 'pour' || real === 'rims') {
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
/** dev tools only (src/people/dev): the sleepers' bedding internals */
export const _bedding = { sleeperField, coverHeights, sampleH, COVER };
export { Color, Quaternion };

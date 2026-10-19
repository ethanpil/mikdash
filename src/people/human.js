// Procedural human figures: body parts and the garments of each archetype (rest pose, figure space).
// Only what can be seen is modelled (e.g. the michnasayim are entirely covered by the ketonet).
// Garment rules: report Part VIII §34 and Rambam Klei HaMikdash 8 (kohanim: ketonet to just above the heel with
// hand-wide sleeves to the wrist, michnasayim, the avnet 3 fingers wide wound winding on winding and embroidered
// with wool, the migba'at wound "like a hat"; Kohen Gadol: + me'il, ephod, choshen, tzitz, and the mitznefet wound
// "like a bandage"; all barefoot). See docs/decisions/people.md and docs/decisions/people-realism.md.
//
// LOD0 (heroes): sculpted head with modelled eyeballs and lids, per-instance face/body morphs, hair and beard with
// strand shells, toes and nails, separate finger joints; long robes skinned to the skirt cage (cloth.js).
import { Vector3, Matrix4 } from 'three';
import { MeshBuilder, envelope, normW, CLS, PAT, lin } from './builder.js';
import { smooth, clamp, lerp } from './util.js';
import { AMAH } from '../core/units.js';

const V = (x, y, z) => new Vector3(x, y, z);
const R = (rig, n) => rig.rest[rig.index[n]];
const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));

// Fixed colours (sRGB). Dyes per report §26 / Part VII: techelet sky-blue wool — "the likeness of the firmament
// in the clarity of the sky" (Rambam Tzitzit 2:1), i.e. the deep blue of a clear sky, not a pale or violet one
// (the exact shade is reconstruction); argaman red-purple, tola'at shani crimson, shesh white linen; gold.
export const COL = {
  linen: '#eeeadf', linenKG: '#f7f4ec', techelet: '#183b74', argaman: '#6b2752', shani: '#a8202d',
  gold: '#e2b552', goldDeep: '#c4943a', shoham: '#20302b', tzitzit: '#f1ece0',
};

// The ephod / choshen / cheshev cloth seen from beyond arm's reach: each thread is twisted from 6 strands of each
// of the four colours and 4 of gold (Yoma 72a; Rashi Shemot 28:6), so the cloth reads as one even colour — the
// four dyes averaged (linear), darkened by the share of the gold foil strands, which add a gold specular (the
// people material, pattern 7). Baked into the vertex colour so it holds where the weave pattern is not drawn.
// The avnet's linen ground with its wool embroidery (rokem) as seen beyond the motif's resolution: about half the
// face is covered by the techelet / tola'at shani diamonds and argaman rails and hearts (people material, pattern 5).
export const AVNET_AVG = (() => {
  const L = lin(COL.linen), T = lin(COL.techelet), A = lin(COL.argaman), S = lin(COL.shani);
  return [0, 1, 2].map((i) => L[i] * 0.55 + (T[i] * 0.16 + S[i] * 0.16 + A[i] * 0.13));
})();

export const EPHOD_AVG = (() => {
  const c = [COL.techelet, COL.argaman, COL.shani, COL.linen].map((h) => lin(h));
  const g = lin(COL.gold);
  return [0, 1, 2].map((i) => (((c[0][i] + c[1][i] + c[2][i] + c[3][i]) / 4) * 0.75 + g[i] * 0.25) * 0.8);
})();

// The twelve stones of the choshen (Shemot 28:17–20) in four rows — odem, pitdah, bareket / nofech, sapir,
// yahalom / leshem, shevo, achlamah / tarshish, shoham, yashfeh. Colours after the tribal-banner colours of
// Bamidbar Rabbah 2:7 (each banner matched its stone) — a traditional identification; see decisions log.
export const STONES = [
  ['odem', '#a1161b'], ['pitdah', '#4f8a3a'], ['bareket', '#c9c6bd'],
  ['nofech', '#4a8fc4'], ['sapir', '#1d2a55'], ['yahalom', '#eeede6'],
  ['leshem', '#2c4382'], ['shevo', '#b5653a'], ['achlamah', '#8d8a84'],
  ['tarshish', '#5fa8a0'], ['shoham', '#17171a'], ['yashfeh', '#8a4f78'],
];

export const GRP = { MANTLE: 1, HEADCLOTH: 2 };

// segment counts per LOD; LOD3 (far silhouettes beyond the figure budget) thins LOD2 further
const L3 = (lod, a, b, c) => (lod === 0 ? a : lod === 1 ? b : lod === 2 || c <= 3 ? c : Math.max(3, Math.round(c * 0.65)));

// deterministic per-build pseudo-random (fold placement): same figure → same folds
function prng(seed) {
  let a = Math.floor(seed * 1e6) >>> 0 || 1;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}

// --------------------------------------------------------------------------------------------- head
function headFrame(rig, lod = 1) {
  const d = rig.dims, fem = d.sex === 'f';
  const hs = d.headS * (fem ? 0.96 : 1);
  const pv = R(rig, 'head');
  const C = V(0, pv.y + 0.075 * hs, pv.z - 0.008 * hs);
  const r = [0.074 * hs * (fem ? 0.96 : 1), 0.108 * hs, 0.096 * hs];
  const f = { eyeY: 0.008 * hs, nTip: -0.036 * hs, mouthY: -0.061 * hs, chinY: -0.1 * hs };
  // LOD0 carries modelled eyeballs in deep sockets; LOD1+ paints the eyes on a shallow socket
  const sock = lod === 0 ? { d: 0.0135, sx: 0.0165, sy: 0.0098 } : { d: 0.0055, sx: 0.012, sy: 0.0085 };
  return { C, r, hs, f, young: !!d.young, fem, sock, elder: d.style === 'elder' };
}

/**
 * Head surface deformation (local coords relative to the head centre). v: shape variant (face morph) —
 * { nose, hook, jaw, chin, cheek, brow } offsets around 0; noSock: without the eye sockets (to seat the eyes).
 */
function headShape(H, v = {}, noSock = false) {
  const { r, hs, f, young, fem, sock } = H;
  const kid = young ? 0.6 : 1;
  const nose = 1 + 0.35 * (v.nose || 0), hook = v.hook || 0, jawW = 0.07 * (v.jaw || 0);
  const chin = 1 + 0.45 * (v.chin || 0), cheek = 1 + 0.5 * (v.cheek || 0), brow = (fem ? 0.55 : young ? 0.6 : 1) * (1 + 0.4 * (v.brow || 0));
  const ex = 0.031 * hs, ey = f.eyeY;
  const sd = noSock ? 0 : sock.d * hs, sx = sock.sx * hs, sy = sock.sy * hs;
  return (l) => {
    const { x, y, z } = l;
    const ny = y / r[1];
    const front = z < 0;
    const jaw = smooth(-0.1, -0.85, ny);
    const X = x * (1 - (young || fem ? 0.2 : 0.25) * jaw) * (1 + jawW * smooth(-0.25, -0.62, ny) * (1 - smooth(-0.78, -0.96, ny)));
    let Z = z;
    if (!front) Z *= 1 - 0.45 * jaw;
    else Z *= 1 - 0.1 * jaw;
    if (!front && ny > -0.2) Z *= 1.03;
    if (front) {
      const ax = Math.abs(x);
      // the face is flatter than an ellipsoid across the front (a broad flattening, not a groove at the midline)
      Z *= 1 - 0.05 * Math.exp(-((x / (0.08 * hs)) ** 2));
      const { nTip, mouthY, chinY } = f;
      // nose: bridge rising from the nasion between the brows (nothing above it — no keel up the forehead),
      // widening and rising to a rounded tip; alae (nostril wings)
      const t = smooth(ey + 0.01 * hs, nTip, y);
      const below = 1 - smooth(nTip - 0.001 * hs, nTip - 0.012 * hs, y);
      const nasion = smooth(ey + 0.026 * hs, ey + 0.006 * hs, y);
      const nw = lerp(0.0085, 0.0125, t) * hs;
      const prot = kid * hs * (0.006 + 0.012 * t * nose) * below * nasion;
      Z -= prot * Math.exp(-((x / nw) ** 2));
      Z -= kid * hook * 0.0026 * hs * g2(x, y, 0, ey - 0.021 * hs, nw * 0.9, 0.008 * hs);
      Z -= kid * nose * 0.005 * hs * g2(x, y, 0, nTip + 0.002 * hs, 0.009 * hs, 0.007 * hs);
      Z -= 0.0045 * hs * (g2(x, y, 0.0115 * hs, nTip + 0.003 * hs, 0.0065 * hs, 0.0055 * hs) + g2(x, y, -0.0115 * hs, nTip + 0.003 * hs, 0.0065 * hs, 0.0055 * hs));
      // brow ridge (stronger in men), the eye sockets, cheekbones
      Z -= brow * 0.005 * hs * Math.exp(-(((y - (ey + 0.019 * hs)) / (0.008 * hs)) ** 2)) * smooth(0.058 * hs, 0.02 * hs, ax);
      Z += sd * (g2(x, y, ex, ey + 0.001 * hs, sx, sy) + g2(x, y, -ex, ey + 0.001 * hs, sx, sy));
      Z -= cheek * 0.0038 * hs * (g2(x, y, 0.046 * hs, ey - 0.024 * hs, 0.014 * hs, 0.013 * hs) + g2(x, y, -0.046 * hs, ey - 0.024 * hs, 0.014 * hs, 0.013 * hs));
      // temples: a slight hollow behind the outer end of the brow
      Z += 0.0025 * hs * (g2(x, y, 0.064 * hs, ey + 0.022 * hs, 0.01 * hs, 0.016 * hs) + g2(x, y, -0.064 * hs, ey + 0.022 * hs, 0.01 * hs, 0.016 * hs));
      // nasolabial folds: a soft crease from the nostril wing down to beyond the mouth corner (adults)
      if (!young) {
        const u = clamp((nTip - y) / Math.max(1e-4, nTip - mouthY + 0.008 * hs));
        const xc = lerp(0.0135, 0.027, u) * hs;
        Z += (fem ? 0.0006 : 0.0011) * hs * Math.exp(-(((ax - xc) / (0.0032 * hs)) ** 2)) * Math.sin(Math.PI * u);
      }
      // philtrum, lips (upper and lower vermilion), mouth corners, chin
      Z += 0.0008 * hs * g2(x, y, 0, (nTip + mouthY) / 2, 0.003 * hs, 0.007 * hs);
      Z -= 0.0034 * hs * g2(x, y, 0, mouthY + 0.0045 * hs, 0.017 * hs, 0.0042 * hs);
      Z -= 0.0038 * hs * g2(x, y, 0, mouthY - 0.006 * hs, 0.016 * hs, 0.005 * hs);
      Z += 0.0012 * hs * g2(ax, y, 0.023 * hs, mouthY, 0.004 * hs, 0.005 * hs);
      Z -= chin * 0.0048 * hs * g2(x, y, 0, chinY + 0.013 * hs, 0.017 * hs, 0.012 * hs);
    }
    return V(X, y, Z);
  };
}

/** surface point of the head shape at azimuth phi (0 = front) and height y (relative to C) */
function headSurf(H, shape, phi, y) {
  const ny = clamp(y / H.r[1], -0.999, 0.999);
  const s = Math.sqrt(1 - ny * ny);
  return shape(V(Math.sin(phi) * s * H.r[0], y, -Math.cos(phi) * s * H.r[2]));
}

/** the front surface point at a given x (bisection on the azimuth) */
function frontPoint(H, shape, x, y) {
  let a = -1.5, b = 1.5;
  for (let i = 0; i < 28; i++) {
    const m = (a + b) / 2;
    if (headSurf(H, shape, m, y).x < x) a = m; else b = m;
  }
  return headSurf(H, shape, (a + b) / 2, y);
}

// longitudes concentrated toward the face
const phiFace = (k) => (t) => { const s = 2 * t - 1; return Math.PI * Math.sign(s) * Math.abs(s) ** k; };
// latitudes concentrated in the face band (brow → chin) at LOD0
function thFace(t) {
  const a = 0.36, b = 0.88;      // the band as fractions of π
  if (t < 0.18) return lerp(0, a, t / 0.18);
  if (t < 0.82) return lerp(a, b, (t - 0.18) / 0.64);
  return lerp(b, 1, (t - 0.82) / 0.18);
}

/**
 * Morph fields of a head (spatial, so skin, eyes, lids and beard shells move together):
 *   A (vector)  — a longer, hooked nose, heavier brow, wider jaw, bigger chin (negative weight = the opposite);
 *   B (scalar)  — fullness along the normal: cheeks, jowls, under the chin.
 */
function headMorph(H) {
  const base = headShape(H), vari = headShape(H, { nose: 1, hook: 1, jaw: 1, chin: 1, brow: 0.6, cheek: 0.3 });
  const { hs, f, r } = H;
  return (P) => {
    const q = P.clone().sub(H.C);
    const y = clamp(q.y, f.chinY - 0.004 * hs, r[1] * 0.98);
    const phi = Math.atan2(q.x, -q.z);
    const ny = clamp(y / r[1], -0.999, 0.999), s = Math.sqrt(1 - ny * ny);
    const l = V(Math.sin(phi) * s * r[0], y, -Math.cos(phi) * s * r[2]);
    const d = vari(l.clone()).sub(base(l.clone()));
    if (q.y > 0.03 * hs) d.multiplyScalar(smooth(0.06 * hs, 0.03 * hs, q.y)); // nothing above the brow
    const ax = Math.abs(q.x);
    const full = 0.0045 * g2(ax, q.y, 0.045 * hs, f.mouthY + 0.004 * hs, 0.022 * hs, 0.026 * hs) * (q.z < 0.01 ? 1 : 0.4)
      + 0.005 * g2(q.x, q.y, 0, f.chinY - 0.012 * hs, 0.03 * hs, 0.014 * hs);
    return [d.x, d.y, d.z, full];
  };
}

/** body fullness field: belly, waist and hips swell along the normal; arms and legs untouched */
function bodyMorph(rig) {
  const d = rig.dims, k = d.H / 1.67;
  const sp = R(rig, 'spine'), pv = R(rig, 'pelvis'), ch = R(rig, 'chest'), kn = R(rig, 'shin_r');
  return (P) => {
    const y = P.y;
    if (y > ch.y + 0.1 * k || y < kn.y) return [0, 0, 0, 0];
    const rx = d.hips[0] * 1.08, rz = d.hips[1] * 1.15;
    const rad = Math.hypot(P.x / rx, P.z / rz);
    const inside = 1 - smooth(1.2, 1.6, rad);
    const belly = 0.03 * Math.exp(-(((y - (sp.y - 0.03 * k)) / (0.13 * k)) ** 2)) * (P.z < 0 ? 1 : 0.45);
    const hips = 0.014 * Math.exp(-(((y - (pv.y - 0.05 * k)) / (0.12 * k)) ** 2));
    const chest = 0.008 * Math.exp(-(((y - ch.y) / (0.08 * k)) ** 2));
    const skirt = y < pv.y - 0.1 * k ? 0.012 * smooth(kn.y, pv.y - 0.1 * k, y) : 0;
    return [0, 0, 0, (belly + hips + chest + skirt) * inside];
  };
}

export function head(B, rig, lod, o = {}) {
  const H = headFrame(rig, lod);
  const shape = headShape(H);
  const hb = rig.index.head;
  if (lod <= 1) B.morph = headMorph(H);
  B.set({ cls: CLS.SKIN, pat: lod === 0 ? PAT.FACE : lod === 1 ? PAT.FACE1 : PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  const nu = L3(lod, 44, 18, 8), nv = L3(lod, 34, 12, 5);
  B.ellipsoid(H.C, H.r, {
    nu, nv, bone: hb,
    phiMap: lod === 0 ? phiFace(1.5) : lod === 1 ? phiFace(1.2) : null,
    thMap: lod === 0 ? thFace : null,
    deform: lod >= 2 ? (l) => { l.x *= 1 - 0.2 * smooth(-0.1, -0.85, l.y / H.r[1]); return l; } : shape,
    uvFn: (q) => [q.x / H.hs, q.y / H.hs + (q.z > 0.004 ? 10 : 0)],
    // ambient occlusion: the eye sockets and under the nose a touch darker, the throat under the jaw
    shade: lod === 0 ? (l) => 1 - 0.18 * (g2(l.x, l.y, 0.031 * H.hs, H.f.eyeY, 0.014 * H.hs, 0.01 * H.hs) + g2(l.x, l.y, -0.031 * H.hs, H.f.eyeY, 0.014 * H.hs, 0.01 * H.hs)) * (l.z < 0 ? 1 : 0) : null,
  });
  if (lod === 0) eyes(B, rig, H);
  if (lod <= 1 && o.ears !== false) ears(B, rig, lod, H);
  const nk = R(rig, 'neck');
  const nr = rig.dims.neckR;
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  if (lod >= 3) { B.morph = null; return H; } // far silhouette: the collar meets the head
  // the neck flares into the trapezius at its root and is fuller at the back than the front
  const top = V(0, H.C.y - 0.07 * H.hs, H.C.z + 0.018 * H.hs);
  B.tube([
    { c: V(0, nk.y - 0.045, nk.z + 0.004), rx: nr * 1.45, rz: nr * 1.2 },
    { c: V(0, nk.y + 0.0, nk.z + 0.002), rx: nr * 1.2, rz: nr * 1.06 },
    { c: V(0, nk.y + 0.03, nk.z - 0.002), rx: nr * 1.05, rz: nr * 1.0 },
    { c: V(0, lerp(nk.y + 0.03, top.y, 0.6), lerp(nk.z, top.z, 0.6) - 0.003), rx: nr * 0.98, rz: nr * 0.98 },
    { c: top, rx: nr * 0.96, rz: nr * 1.02 },
  ], { seg: L3(lod, 20, 9, 5), weights: (p) => envelope(rig, p, { chest: 0.6, neck: 1, head: 0.8 }, 4),
    radial: lod === 0 ? (th) => 1 + 0.05 * Math.max(0, Math.sin(th)) ** 2 + 0.03 * Math.max(0, -Math.sin(th)) ** 6 : null, // fuller nape; the larynx
    shade: lod <= 1 ? (th, j) => (j >= 3 ? 0.82 + 0.18 * Math.max(0, Math.sin(th)) : 1) : null, // shadow under the jaw
  });
  B.morph = null;
  return H;
}

/** modelled eyeballs (wet, with iris and pupil) in deep sockets, behind upper and lower lids */
function eyes(B, rig, H) {
  const hb = rig.index.head;
  const shape0 = headShape(H, {}, true);
  const re = 0.0122 * H.hs, rl = re * 1.035;
  const y = H.f.eyeY + 0.0006 * H.hs;
  for (const sg of [-1, 1]) {
    const x = sg * 0.031 * H.hs;
    const S = frontPoint(H, shape0, x, y);
    const c = H.C.clone().add(V(x, y, S.z + re + 0.0016 * H.hs));
    // the eyeball: uv = position on the front in eyeball radii (the shader draws iris and pupil about 0,0)
    B.set({ cls: CLS.FIX, pat: PAT.EYE, rough: 0.07, metal: 0, color: [1, 1, 1], grp: 0 });
    B.ellipsoid(c, [re, re, re], { nu: 16, nv: 11, bone: hb, uvFn: (q) => [(q.x * sg + 0.0006) / re * sg, (q.y + 0.0004) / re] });
    // lids: spherical shells just outside the eyeball; margins curve, the outer corner a little higher
    B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.5, metal: 0, color: [1, 1, 1], grp: 0 });
    // a calm, slightly hooded gaze: the upper lid covers the top of the iris, the lower lid touches its bottom
    const marginU = (a) => 0.18 * Math.cos(clamp(a / 1.3, -1, 1) * Math.PI / 2) ** 0.7 + 0.05 * Math.max(0, a);
    const marginL = (a) => -0.4 * Math.cos(clamp(a / 1.3, -1, 1) * Math.PI / 2) ** 1.1 + 0.03 * Math.max(0, a);
    const pt = (a, b, rr) => c.clone().add(V(sg * Math.sin(a) * Math.cos(b) * rr, Math.sin(b) * rr, -Math.cos(a) * Math.cos(b) * rr));
    for (const upper of [true, false]) {
      const nu = 14, nv = 5;
      B.grid(nu, nv, (i, j) => {
        const a = lerp(-1.48, 1.48, i / nu);   // + = toward the outer corner
        const m = upper ? marginU(a) : marginL(a);
        const k = j / nv;
        const b = upper ? m + k * k * 1.0 : m - k * k * 0.75;
        // the margin is a rounded rim; the outer rows dive under the socket skin
        // never inside the eyeball (re): the outer rows only settle onto it, under the socket skin
        const rr = rl * (j === 0 ? 0.992 : 1.0 + 0.008 * (j === 1 ? 1 : 0)) * (1 - 0.025 * smooth(0.6, 1, k)) * (1 - 0.02 * smooth(1.2, 1.48, Math.abs(a)));
        const shade = j === 0 ? (upper ? 0.3 : 0.7) : j === 1 ? (upper ? 0.72 : 0.92) : 0.96;
        return { p: pt(a, b, rr), u: a * 0.012, v: b * 0.012, w: hb, shade };
      }, { inside: c });
    }
  }
}

/** ears: a cupped shell with a rolled rim (helix), angled off the head */
function ears(B, rig, lod, H) {
  const hb = rig.index.head;
  for (const sg of [-1, 1]) {
    const m = new Matrix4().makeRotationY(sg * 0.38).multiply(new Matrix4().makeRotationZ(-sg * 0.08));
    B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
    const er = [0.0095 * H.hs, 0.029 * H.hs, 0.017 * H.hs];
    B.ellipsoid(H.C.clone().add(V(sg * H.r[0] * 0.97, H.f.eyeY - 0.014 * H.hs, 0.012 * H.hs)), er, {
      nu: lod ? 7 : 11, nv: lod ? 5 : 7, bone: hb, xf: m,
      deform: lod ? null : (l) => {
        // the outer face is hollowed (concha), the rim rolled; the lobe hangs a little fuller
        const u = l.y / er[1], w = l.z / er[2];
        const rimD = Math.hypot(u, w);
        if (l.x * sg > 0) l.x -= sg * 0.6 * er[0] * (1 - smooth(0.55, 0.85, rimD)) * smooth(-0.6, 0.0, u) * 1.2;
        if (u < -0.55) l.x *= 1.25;
        return l;
      },
      shade: (l) => (l.x * sg < 0 ? 0.78 : 0.95),
    });
  }
}

/** hair cap (and long hair falling to the shoulders — the nazir lets it grow); LOD0 adds strand shells */
export function hair(B, rig, lod, H, o = {}) {
  const shape = headShape(H);
  const hb = rig.index.head;
  B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.7, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  const nu = L3(lod, 32, 12, 6), nv = L3(lod, 11, 5, 3);
  const front = Math.acos(clamp((H.f.eyeY + (o.hairline ?? 0.05) * H.hs) / H.r[1], -1, 1));
  const side = Math.acos(clamp((H.f.eyeY + 0.014 * H.hs) / H.r[1], -1, 1));
  const back = Math.acos(clamp((o.long ? H.f.mouthY - 0.02 * H.hs : H.f.mouthY + 0.008 * H.hs) / H.r[1], -1, 1));
  const vol = 0.0065 * H.hs + (o.volume || 0);
  const lock = lod === 0 ? (phi, th) => 1 + 0.35 * Math.sin(phi * 23 + th * 4) * Math.sin(phi * 7 - th * 9) : () => 1;
  const capAt = (i, j, nU, nV, off) => {
    const phi = (i / nU) * Math.PI * 2;
    const c = Math.cos(phi);
    // an irregular hairline: temples recede a little, the line itself wavers
    const lb = (c > 0 ? lerp(side, front, c ** 1.5) : lerp(side, back, (-c) ** 0.8)) + (lod === 0 ? 0.02 * Math.sin(phi * 11) : 0);
    const th = Math.max(0.03, (j / nV) * lb);
    const y = Math.cos(th) * H.r[1];
    const S = headSurf(H, shape, phi, y);
    const n = S.clone().setY(S.y * 0.4).normalize();
    const edge = j === nV ? 0.25 : 1;
    return { p: S.addScaledVector(n, off * edge * lock(phi, th)).add(H.C), u: phi * 0.09, v: -th * 0.1, th, phi };
  };
  B.grid(nu, nv, (i, j) => { const q = capAt(i, j, nu, nv, vol); return { p: q.p, u: q.u, v: q.v, w: hb }; }, { wrap: true, inside: H.C });
  if (lod === 0 && !o.covered) { // two strand shells: a soft, broken outline instead of a helmet
    for (const t of [0.5, 1]) {
      B.set({ cls: CLS.HAIR, pat: PAT.HAIR_SHELL, rough: 0.6, metal: t, color: [1.06 + 0.06 * t, 1.06 + 0.06 * t, 1.06 + 0.06 * t], grp: o.grp || 0 });
      B.grid(nu, nv, (i, j) => { const q = capAt(i, j, nu, nv, vol + 0.0035 * t); return { p: q.p, u: q.u, v: q.v, w: hb }; }, { wrap: true, inside: H.C });
    }
  }
  if (o.long) {
    B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.7, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
    const sh = R(rig, 'uarm_r');
    const rings = [];
    const n = lod === 0 ? 6 : 4;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const y = lerp(H.C.y + H.f.mouthY + 0.01, sh.y + 0.0, t);
      rings.push({ c: V(0, y, H.C.z + lerp(0.01, 0.035, t)), rx: lerp(H.r[0] * 0.98, rig.dims.shX * 0.78, t), rz: lerp(H.r[2] * 0.86, rig.dims.chest[1] * 1.1, t) });
    }
    B.tube(rings, {
      seg: L3(lod, 18, 8, 4), arc: [0.12, Math.PI - 0.12],
      weights: (p) => envelope(rig, p, { head: 1, neck: 0.9, chest: 0.5 }, 3),
      radial: (th, j) => 1 + (j ? 0.06 * Math.sin(th * 11) * Math.min(1, j / 2) : 0),
    });
  }
}

/** a point of a shell following the face (relative to the head centre): r = { phi, y, t, hang } */
function shellPoint(H, shape, r) {
  const { phi, y, t, hang = 0 } = r;
  const chinY = H.f.chinY - 0.006 * H.hs;
  if (y >= chinY || hang === 0) {
    const p = headSurf(H, shape, phi, Math.max(y, chinY - 0.0001));
    const n = p.clone().setY(0).normalize();
    p.addScaledVector(n, t);
    if (y < chinY) p.y = y;
    return p;
  }
  const S = headSurf(H, shape, phi, chinY);
  const k = (chinY - y) / Math.max(1e-4, hang);
  const n = S.clone().setY(0).normalize();
  S.addScaledVector(n, t * (1 - 0.35 * k));
  S.x *= 1 - 0.4 * k;
  S.z += 0.012 * H.hs * k + Math.abs(S.x) * 0.15 * k;
  S.y = y;
  return S;
}

/** shell following the face: phi(a) azimuth, y(a,b); thickness t(a,b) */
function faceShell(B, H, shape, nu, nv, fn, wfn) {
  const inside = H.C.clone().add(V(0, H.f.mouthY, 0.03));
  B.grid(nu, nv, (i, j) => {
    const a = (i / nu) * 2 - 1, b = j / nv;
    const r = fn(a, b);
    const p = shellPoint(H, shape, r).add(H.C);
    return { p, u: r.phi * 0.08, v: -b * 0.08, w: wfn(p), shade: r.shade ?? 1 };
  }, { inside });
}

/** full beard (and moustache): jaw line from the sideburns to below the lower lip; len = fall below the chin.
 *  A volume, not a decal: it thickens from nothing at its edges (so it grows out of the skin) to ~1.3 cm,
 *  its lower edge is closed back to the throat, and its outline is broken into soft locks; LOD0 adds strand
 *  shells so its edge is soft. Men did not shave the corners of the beard (Vayikra 19:27). */
export function beard(B, rig, lod, H, o = {}) {
  const shape = headShape(H);
  const hb = rig.index.head, nb = rig.index.neck;
  const { f, hs } = H;
  const len = (o.len ?? 0.04) * hs;
  const vol = o.volume || 0;
  if (lod <= 1) B.morph = headMorph(H);
  B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.75, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  const chinY = f.chinY - 0.006 * hs;
  const W = (p) => (p.y < H.C.y + chinY - 0.01 * hs ? normW([[hb, 0.8], [nb, 0.2]]) : [[hb, 1]]);
  const locks = lod === 0 ? (a, b) => 1 + 0.16 * Math.sin(a * 23 + 1.7) * Math.sin(b * 5 + a * 3) * smooth(0.25, 0.9, b) : () => 1;
  const prof = (a, b, extra = 0) => {
    const aa = Math.abs(a);
    const phi = a * 1.78;
    const yTop = aa < 0.28
      ? lerp(f.mouthY - 0.009 * hs, f.mouthY + 0.0 * hs, smooth(0.08, 0.28, aa))
      : lerp(f.mouthY, f.eyeY - 0.014 * hs, smooth(0.28, 1.0, aa) ** 0.85);
    // the lower edge: fuller and a little pointed under the chin, broken into uneven locks (no straight cut)
    const yBot = lerp(chinY - len * (1 + 0.22 * (1 - aa * aa)), f.mouthY - 0.038 * hs, smooth(0.5, 1, aa))
      - (lod === 0 ? (0.0045 * Math.sin(a * 21 + 0.7) + 0.003 * Math.sin(a * 47 + 2.1)) * hs * (1 - smooth(0.6, 1, aa)) : 0);
    const y = lerp(yTop, yBot, b);
    const edge = smooth(0, 0.3, b) * (1 - 0.7 * smooth(0.7, 1, aa));
    const t = ((0.0008 + 0.0125 * edge) * hs + vol * b) * locks(a, b) + extra * edge;
    return { phi, y, t, hang: len, shade: 0.82 + 0.18 * smooth(0, 0.5, b) };
  };
  const nu = L3(lod, 26, 12, 6), nv = L3(lod, 9, 5, 2);
  faceShell(B, H, shape, nu, nv, (a, b) => prof(a, b), W);
  if (lod === 0) { // strand shells for a soft edge
    for (const t of [0.5, 1]) {
      B.set({ cls: CLS.HAIR, pat: PAT.HAIR_SHELL, rough: 0.7, metal: t, color: [1.05 + 0.05 * t, 1.05 + 0.05 * t, 1.05 + 0.05 * t], grp: o.grp || 0 });
      faceShell(B, H, shape, nu, nv, (a, b) => prof(a, b, 0.0035 * t * hs), W);
    }
    B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.75, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  }
  // underside: from the beard's lower edge back to the throat, so the beard is a closed volume from below/behind
  if (lod < 3) {
    const nk = R(rig, 'neck'), nr = rig.dims.neckR;
    const uw = L3(lod, 14, 8, 4);
    B.grid(uw, 2, (i, j) => {
      const a = lerp(-0.62, 0.62, i / uw);
      const bot = shellPoint(H, shape, prof(a, 1)).add(H.C);
      const th = V(Math.sin(a * 1.4) * nr * 0.95, H.C.y + chinY - 0.012 * hs, nk.z - Math.cos(a * 1.4) * nr * 0.85);
      const k = j / 2;
      const p = bot.clone().lerp(th, k);
      p.y -= 0.006 * hs * Math.sin(Math.PI * k);
      return { p, u: a * 0.1, v: k * 0.05, w: W(p), shade: 0.6 };
    }, { inside: H.C.clone().add(V(0, f.mouthY, 0)) });
  }
  // moustache over the upper lip, drooping at the corners
  if (lod < 2) {
    faceShell(B, H, shape, L3(lod, 14, 6, 2), L3(lod, 3, 2, 1), (a, b) => {
      const aa = Math.abs(a);
      const phi = a * 0.52;
      const yTop = lerp(f.nTip - 0.007 * hs, f.mouthY + 0.004 * hs, smooth(0.3, 1, aa));
      const yBot = lerp(f.mouthY + 0.0025 * hs, f.mouthY - 0.008 * hs, smooth(0.45, 1, aa));
      return { phi, y: lerp(yTop, yBot, b), t: (0.0012 + 0.0055 * Math.sin(Math.PI * Math.min(1, b * 1.3))) * hs + vol * 0.3, hang: 0 };
    }, () => [[hb, 1]]);
  }
  B.morph = null;
}

// --------------------------------------------------------------------------------------------- headwear
function profileRings(H, prof, base, nRings, tall = 1) {
  // interpolate a [y, sx, sz] profile to nRings rings
  const out = [];
  const yMax = prof[prof.length - 1][0];
  for (let j = 0; j < nRings; j++) {
    const yy = (j / (nRings - 1)) * yMax;
    let k = 0;
    while (k < prof.length - 2 && yy > prof[k + 1][0]) k++;
    const [y0, x0, z0] = prof[k], [y1, x1, z1] = prof[k + 1];
    const t = (yy - y0) / Math.max(1e-6, y1 - y0);
    out.push({ c: V(0, H.C.y + base + yy * H.hs * tall, H.C.z + 0.004), rx: H.r[0] * lerp(x0, x1, t), rz: H.r[2] * lerp(z0, z1, t), yy });
  }
  return out;
}

/**
 * A wound linen head-dress: a long strip wound round the head, each winding lapping the last. The windings run
 * as diagonal bands (uv carries their phase to the WOUND pattern: crisp lapped edges and their shadows); the
 * geometry adds the soft puff of each band and gathered creases toward the crown.
 */
function wound(B, rig, lod, H, prof, o = {}) {
  const hb = rig.index.head;
  B.set({ cls: o.cls ?? CLS.GA, pat: lod <= 1 ? PAT.WOUND : PAT.LINEN, rough: 0.86, metal: 0, color: o.color || [1, 1, 1], grp: 0 });
  const rings = profileRings(H, prof, (o.base ?? 0.042) * H.hs, lod >= 3 ? 3 : L3(lod, 22, 9, 5), o.tall || 1);
  const pitch = 0.022, k = o.slant ?? 1.6;      // per turn the band advances k pitches (diagonal windings)
  const n = rings.length;
  const yMax = rings[n - 1].yy;
  const phase = (th, j) => (rings[j].yy * H.hs + (th / (Math.PI * 2)) * pitch * k) / pitch;
  const start = B.count;
  const seg = L3(lod, 38, 16, 7);
  B.tube(rings, {
    seg, bone: hb, capB: 'flat',
    radial: lod >= 2 ? null : (th, j) => {
      if (j === 0) return 1;
      const top = smooth(0.7 * yMax, yMax, rings[j].yy);
      const ph = phase(th, j);
      const band = Math.sin(Math.PI * (ph - Math.floor(ph)));            // each band bulges between its edges
      return 1 + (0.02 * band - 0.008) * (1 - top) + 0.035 * top * Math.max(0, Math.sin(th * 9 + j)) ** 3;
    },
    shade: lod >= 2 ? null : (th, j) => {
      const top = smooth(0.75 * yMax, yMax, rings[j].yy);
      return 1 - 0.1 * top * (1 - Math.max(0, Math.sin(th * 9 + j)) ** 3) - (j === 0 ? 0.12 : 0);
    },
  });
  // uv: (diagonal phase offset, height) — the band lines are lines of constant u + v
  const g = B.uv;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i <= seg; i++) {
      const vi = start + j * (seg + 1) + i;
      const th = (i / seg) * Math.PI * 2;
      g[vi * 2] = (th / (Math.PI * 2)) * pitch * k;
      g[vi * 2 + 1] = rings[j].yy * H.hs;
    }
  }
}

/** migba'at: the kohen hedyot's 16-amah linen winding, worn "like a hat" — a rounded dome (Rambam KhM 8:2) */
export function migbaat(B, rig, lod, H) {
  wound(B, rig, lod, H, [
    [0.0, 1.08, 1.06], [0.02, 1.15, 1.12], [0.05, 1.18, 1.14], [0.08, 1.16, 1.12], [0.104, 1.08, 1.04],
    [0.122, 0.94, 0.9], [0.136, 0.74, 0.71], [0.146, 0.48, 0.46], [0.152, 0.12, 0.12],
  ], { base: 0.04, slant: 3.2 });
}

/** mitznefet: the Kohen Gadol's turban, wound "like one who bandages a fracture" — lower, broader, the windings
 *  nearly level (Rambam KhM 8:2) */
export function mitznefet(B, rig, lod, H, o = {}) {
  wound(B, rig, lod, H, [
    [0.0, 1.13, 1.1], [0.02, 1.23, 1.17], [0.05, 1.27, 1.21], [0.078, 1.25, 1.19],
    [0.098, 1.15, 1.09], [0.11, 0.9, 0.86], [0.117, 0.45, 0.43], [0.12, 0.08, 0.08],
  ], { base: o.base ?? 0.068, cls: o.cls, color: o.color, slant: 1.2 });
}

/** tzitz: gold band ear to ear on the forehead, techelet cord behind (Shemot 28:36–38) */
export function tzitz(B, rig, lod, H) {
  const shape = headShape(H);
  const hb = rig.index.head;
  const { hs, f } = H;
  const y0 = f.eyeY + 0.021 * hs, y1 = f.eyeY + 0.058 * hs;
  B.set({ cls: CLS.FIX, pat: PAT.TZITZ, rough: 0.2, metal: 1, color: COL.gold, grp: 0 });
  const nu = L3(lod, 24, 10, 6);
  B.grid(nu, 2, (i, j) => {
    const phi = lerp(-1.42, 1.42, i / nu);
    const y = lerp(y1, y0, j / 2);
    const S = headSurf(H, shape, phi, y);
    const n = S.clone().setY(0).normalize();
    S.addScaledVector(n, 0.0045 * hs).add(H.C);
    return { p: S, u: i / nu, v: j / 2, w: hb };
  }, { inside: H.C });
  B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.8, metal: 0, color: COL.techelet });
  const nc = L3(lod, 14, 8, 4);
  B.grid(nc, 1, (i, j) => {
    const phi = lerp(1.42, Math.PI * 2 - 1.42, i / nc);
    const y = lerp(f.eyeY + 0.043 * hs, f.eyeY + 0.035 * hs, j);
    const S = headSurf(H, shape, phi, y);
    const n = S.clone().setY(0).normalize();
    S.addScaledVector(n, 0.01 * hs).add(H.C);
    return { p: S, u: i * 0.02, v: j * 0.01, w: hb };
  }, { inside: H.C });
}

/** veil / head-cloth: covers the hair, frames the face and falls over the shoulders and back */
export function headCloth(B, rig, lod, H, o = {}) {
  const shape = headShape(H);
  const { hs, f } = H;
  const sh = R(rig, 'uarm_r'), ch = R(rig, 'chest'), nk = R(rig, 'neck');
  B.set({ cls: o.cls ?? CLS.GB, pat: o.pat ?? PAT.WOOL, rough: 0.9, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  const nu = L3(lod, 34, 14, 7);
  const nv = L3(lod, 16, 9, 4);
  const open = o.open ?? 0.95;
  const bottomBack = o.backY ?? (ch.y - 0.05);
  const yEndAt = (phi) => lerp(f.eyeY + 0.042 * hs, f.mouthY - 0.012 * hs, smooth(-0.3, 0.9, -Math.cos(phi)));
  const W = (t) => (q) => envelope(rig, q, { head: 1.0, neck: 0.8, chest: t > 0 ? 0.9 : 0.05, clav_l: 0.4, clav_r: 0.4 }, 4);
  const neckClear = (y, back) => rig.dims.neckR * lerp(1.5, 1.1, smooth(nk.y - 0.05, nk.y + 0.06, y)) + 0.016 + 0.012 * Math.max(0, back);
  const clearNeck = (p, back) => {
    if (p.y > nk.y + 0.12 || p.y < nk.y - 0.08) return p;
    const dx = p.x, dz = p.z - nk.z, d = Math.hypot(dx, dz), m = neckClear(p.y, back);
    if (d < m && d > 1e-6) { p.x = dx * m / d; p.z = nk.z + dz * m / d; }
    return p;
  };
  const tr = torsoRings(rig, { thick: 0.035 }).filter((q) => q.c.y > ch.y - 0.12);
  const lift = backLift(rig);
  const torsoClear = (y, ang) => {
    if (y > tr[0].c.y + 0.02 || y < tr[tr.length - 1].c.y) return 0;
    let k = 0;
    while (k < tr.length - 2 && y < tr[k + 1].c.y) k++;
    const A = tr[k], Bq = tr[k + 1];
    const t = clamp((A.c.y - y) / Math.max(1e-4, A.c.y - Bq.c.y));
    const rx = lerp(A.rx, Bq.rx, t), rz = lerp(A.rz, Bq.rz, t);
    const dx = Math.sin(ang), dz = -Math.cos(ang);
    const back = Math.max(0, dz);
    const up = lerp(lift(Math.PI / 2, 0, A), lift(Math.PI / 2, 0, Bq), t) * back ** 1.5;
    return 1 / Math.sqrt((dx / rx) ** 2 + (dz / rz) ** 2) + 0.012 + up * 0.6;
  };
  const capRows = L3(lod, 6, 4, 2);
  B.grid(nu, capRows, (i, j) => {
    const phi = Math.PI + (i / nu) * Math.PI * 2;
    const k = j / capRows;
    const th = lerp(0.05, Math.acos(clamp(yEndAt(phi) / H.r[1], -1, 1)), k);
    const p = headSurf(H, shape, phi, Math.cos(th) * H.r[1]);
    // offset along the head's own normal (a flattened normal pinched the crown into a cowl's point)
    const nrm = V(p.x / H.r[0] ** 2, p.y / H.r[1] ** 2, p.z / H.r[2] ** 2).normalize();
    p.addScaledVector(nrm, 0.012 * hs + 0.004 * k).add(H.C);
    clearNeck(p, -Math.cos(phi));
    return { p, u: phi * 0.12, v: -k * 0.2, w: W(0) };
  }, { wrap: true, inside: H.C });
  // drape: from the cap's edge, hugging the cheeks and neck, then over the shoulders and back, in soft folds
  const folds = lod === 0 ? (phi, k) => 1 + 0.045 * k * k * (Math.abs(Math.sin(phi * 4.5 + 0.7)) - 0.64) : () => 1;
  B.grid(nu, nv, (i, j) => {
    const phi = lerp(open, Math.PI * 2 - open, i / nu);
    const c = -Math.cos(phi);
    const k = j / nv;
    const top = headSurf(H, shape, phi, yEndAt(phi));
    top.addScaledVector(top.clone().setY(top.y * 0.3).normalize(), 0.02 * hs).add(H.C);
    const yB = lerp(sh.y + 0.03, bottomBack, smooth(-0.5, 1, c)) + (o.short ? 0.08 : 0);
    const rx = rig.dims.shX + 0.04, rz = rig.dims.chest[1] + 0.035;
    const front = Math.max(0, -c);
    const lowX = Math.sin(phi) * rx * (1 - 0.35 * front), lowZ = ch.z - Math.cos(phi) * rz + 0.01;
    const y = lerp(top.y, yB, smooth(0, 1, k));
    const rTop = Math.hypot(top.x, top.z - H.C.z), rLow = Math.hypot(lowX, lowZ - H.C.z);
    const kk = k * k * (1.4 - 0.4 * k);
    let r = lerp(rTop, rLow, kk) * (1 + 0.04 * Math.sin(Math.PI * k)) * folds(phi, k);
    if (y > nk.y - 0.08 && y < nk.y + 0.12) r = Math.max(r, neckClear(y, c) + 0.002);
    const ang = Math.atan2(lerp(top.x, lowX, kk), -lerp(top.z - H.C.z, lowZ - H.C.z, kk));
    if (k > 0) r = Math.max(r, torsoClear(y, ang));
    const p = V(Math.sin(ang) * r, y, H.C.z - Math.cos(ang) * r);
    // the edge framing the face is rolled; inner folds a touch darker
    const edge = Math.min(phi - open, Math.PI * 2 - open - phi);
    const shade = 1 - 0.12 * smooth(0.12, 0, edge) - (lod === 0 ? 0.08 * k * Math.max(0, 0.64 - Math.abs(Math.sin(phi * 4.5 + 0.7))) : 0);
    return { p, u: phi * 0.12, v: -0.2 - k * 0.5, w: W(k), shade };
  }, { inside: (A) => V(0, A.y, H.C.z) });
}

// --------------------------------------------------------------------------------------------- limbs
function limbRings(points, radii) {
  const n = points.length;
  return points.map((c, j) => {
    const dir = (j < n - 1 ? points[j + 1].clone().sub(c) : c.clone().sub(points[j - 1])).normalize();
    if (j > 0 && j < n - 1) dir.add(c.clone().sub(points[j - 1]).normalize()).normalize();
    const ref = Math.abs(dir.z) > 0.9 ? V(0, 1, 0) : V(0, 0, 1);
    const az = ref.clone().addScaledVector(dir, -ref.dot(dir)).normalize();
    const ax = new Vector3().crossVectors(az, dir).normalize();
    const [rx, rz] = Array.isArray(radii[j]) ? radii[j] : [radii[j], radii[j]];
    return { c, rx, rz, ax, az };
  });
}

/**
 * Arm: a sleeve (garment class) to `sleeveTo` ('wrist' | 'elbow' | 'short' | 'none') and skin below.
 * The sleeve top is a low dome tucked inside the torso's shoulder so raised arms never open a hole.
 * Sleeves bunch a little at the elbow and close at the wrist; the inner arm is shaded (armpit, against the body).
 */
export function arm(B, rig, lod, s, o = {}) {
  const morph = B.morph;
  B.morph = null;                                   // sleeves and hands keep their shape whatever the build
  armBody(B, rig, lod, s, o);
  B.morph = morph;
}

function armBody(B, rig, lod, s, o) {
  const k = rig.dims.H / 1.67;
  const sg = s === 'l' ? -1 : 1;
  const sh = R(rig, `uarm_${s}`), el = R(rig, `farm_${s}`), wr = R(rig, `hand_${s}`);
  const W = (p) => envelope(rig, p, { [`clav_${s}`]: 0.5, [`uarm_${s}`]: 1, [`farm_${s}`]: 1, [`hand_${s}`]: 0.7, chest: 0.2 }, 4);
  const mid = (a, b, t) => a.clone().lerp(b, t);
  const seg = L3(lod, 16, 7, 5);
  const sleeve = o.sleeveTo || 'wrist';
  const t = o.thick ?? 0.006;
  const fem = rig.dims.sex === 'f';
  const ra = (fem ? 0.04 : 0.046) * k, re = (fem ? 0.033 : 0.038) * k, rf = (fem ? 0.031 : 0.036) * k, rw = (fem ? 0.023 : 0.026) * k;
  const top = sh.clone().add(V(-sg * 0.02 * k, -0.03 * k, 0));
  // the side of the arm facing the body (+/−x toward the midline) is in the body's shadow
  const inner = lod <= 1 ? (th, j, p) => 1 - 0.14 * Math.max(0, -sg * (p.x - (j < 2 ? sh.x : el.x)) / (ra + t)) * (j <= 2 ? 1 : 0.5) : null;
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  if (sleeve === 'elbow' || sleeve === 'short' || sleeve === 'none') {
    const from = sleeve === 'none' ? top : sleeve === 'short' ? mid(sh, el, 0.45) : mid(sh, el, 0.82);
    B.tube(limbRings([from, el, mid(el, wr, 0.5), wr.clone().add(V(0, 0.01, 0))], [ra * 0.92, re * 0.95, rf * 0.98, rw]), { seg, weights: W, shade: inner });
  }
  if (sleeve !== 'none') {
    B.set({ cls: o.cls ?? CLS.GA, pat: o.pat ?? PAT.LINEN_BOX, rough: o.rough ?? 0.85, metal: 0, color: o.color || [1, 1, 1], grp: o.grp || 0 });
    let pts, rad;
    if (sleeve === 'wrist' && lod >= 3) {
      pts = [top, el, wr.clone().add(V(0, 0.016 * k, 0))];
      rad = [ra + t + 0.006, re + t, rw + t * 0.8];
    } else if (sleeve === 'wrist' && lod <= 1) {
      // a little bunching at the elbow, the sleeve closing at the wrist (hand-wide — Rambam KhM 8:17)
      pts = [top, mid(sh, el, 0.3), mid(sh, el, 0.65), mid(sh, el, 0.9), el, mid(el, wr, 0.2), mid(el, wr, 0.55), mid(el, wr, 0.85), wr.clone().add(V(0, 0.016 * k, 0))];
      rad = [ra + t + 0.006, ra + t + 0.002, ra * 0.97 + t, re * 1.08 + t, re * 1.1 + t, re * 1.04 + t, rf * 0.95 + t * 0.8, rw * 1.12 + t * 0.7, rw + t * 0.8];
    } else if (sleeve === 'wrist') {
      pts = [top, mid(sh, el, 0.45), el, mid(el, wr, 0.55), wr.clone().add(V(0, 0.016 * k, 0))];
      rad = [ra + t + 0.006, ra * 0.98 + t, re + t, rf + t * 0.6, rw + t * 0.8];
    } else if (sleeve === 'elbow') {
      pts = [top, mid(sh, el, 0.5), mid(sh, el, 0.92)];
      rad = [ra + t + 0.008, ra * 1.1 + t, re * 1.32 + t];
    } else {
      pts = [top, mid(sh, el, 0.48)];
      rad = [ra + t + 0.008, ra * 1.12 + t];
    }
    const nP = pts.length;
    rad[0] *= 0.94;
    B.tube(limbRings(pts, rad), {
      seg, weights: W, capA: lod >= 2 ? 'flat' : 'dome', domeH: 0.35,
      radial: lod === 0 ? (th, j) => 1 + 0.05 * (Math.abs(Math.sin(th * 2.5 + j * 1.3)) - 0.6) * (j > 1 && j < nP - 1 ? 1 : 0.3) : null,
      shade: inner,
    });
  }
  hand(B, rig, lod, s);
}

export function hand(B, rig, lod, s) {
  const sg = s === 'l' ? -1 : 1;
  const hs = rig.dims.handS;
  const w = R(rig, `hand_${s}`), kn = R(rig, `fing_${s}`), k2 = R(rig, `fing2_${s}`), ix = R(rig, `idx_${s}`), i2 = R(rig, `idx2_${s}`), th = R(rig, `thb_${s}`);
  const down = kn.clone().sub(w).normalize();
  const palmN = new Vector3().crossVectors(down, V(0, 0, 1)).multiplyScalar(sg).normalize(); // palm faces the thigh
  const back = new Vector3().crossVectors(palmN, down).multiplyScalar(sg).normalize();       // +z: toward the little finger
  const rot = new Matrix4().makeBasis(palmN, down.clone().negate(), back.clone().negate());
  const I = rig.index;
  const hb = I[`hand_${s}`], fb = I[`fing_${s}`], f2 = I[`fing2_${s}`], ib = I[`idx_${s}`], i2b = I[`idx2_${s}`], tb = I[`thb_${s}`];
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  const palmL = kn.distanceTo(w);
  if (lod >= 1) {
    // mitten: palm + fingers in one shape (fingers curl with fing_*), thumb separate at LOD1
    const q = L3(lod, 0, 7, 5);
    B.ellipsoid(w.clone().addScaledVector(down, palmL * 0.95), [0.0145 * hs, palmL * 1.05, 0.036 * hs], { nu: q, nv: lod === 1 ? 5 : 3, xf: rot,
      weights: (p) => normW([[hb, 1], [fb, 2 * smooth(kn.y + 0.01, kn.y - 0.045, p.y)]]) });
    if (lod === 1) B.ellipsoid(th.clone().addScaledVector(down, 0.024 * hs).addScaledVector(back, -0.006 * hs), [0.0105 * hs, 0.03 * hs, 0.01 * hs], { nu: 5, nv: 3, xf: rot, bone: tb });
    return;
  }
  // wrist: skin between the sleeve's cuff and the palm
  B.tube(limbRings([w.clone().addScaledVector(down, -0.03 * hs), w.clone().addScaledVector(down, 0.012 * hs)], [[0.019 * hs, 0.027 * hs], [0.0155 * hs, 0.031 * hs]]), {
    seg: 12, weights: (p) => normW([[I[`farm_${s}`], 1 - smooth(-0.02 * hs, 0.01 * hs, p.clone().sub(w).dot(down))], [hb, smooth(-0.02 * hs, 0.01 * hs, p.clone().sub(w).dot(down))]]),
  });
  // palm: a rounded block, a little narrower at the wrist, thicker at the heel of the hand; knuckle ridge on the back
  const pc = w.clone().addScaledVector(down, palmL * 0.52).addScaledVector(back, 0.002 * hs);
  const pr = [0.0158 * hs, palmL * 0.57, 0.04 * hs];
  B.ellipsoid(pc, pr, {
    nu: 12, nv: 8, xf: rot,
    deform: (l) => {
      const qx = l.x / pr[0], qy = l.y / pr[1], qz = l.z / pr[2];
      const e = (t) => Math.sign(t) * Math.abs(t) ** 0.9;
      l.set(e(qx) * pr[0], e(qy) * pr[1], e(qz) * pr[2]);
      l.z *= 1 - 0.16 * smooth(0, 1, qy);                 // narrower toward the wrist (+y = up)
      if (qx > 0) l.x *= 1 + 0.08 * smooth(0.1, 1, qy);    // the fleshy heel of the palm
      if (qx < 0) l.x *= 1 + 0.18 * Math.exp(-(((qy + 0.85) / 0.18) ** 2)); // the knuckle ridge (back of the hand)
      if (qx > 0) l.x *= 1 - 0.18 * Math.exp(-((qy / 0.5) ** 2)) * (1 - qz * qz); // the hollow of the palm
      return l;
    },
    weights: (p) => normW([[hb, 1], [I[`farm_${s}`], 0.4 * smooth(w.y - 0.02, w.y + 0.02, p.y)]]),
    shade: (l) => (l.x > 0 ? 0.94 : 1),
  });
  // thenar pad at the base of the thumb
  B.ellipsoid(w.clone().addScaledVector(down, palmL * 0.3).addScaledVector(back, -0.028 * hs).addScaledVector(palmN, 0.007 * hs),
    [0.0125 * hs, 0.028 * hs, 0.016 * hs], { nu: 8, nv: 5, xf: rot, weights: [[hb, 0.6], [tb, 0.4]] });
  // fingers: separate two-segment capsules (proximal on fing_/idx_, middle+distal on fing2_/idx2_), knuckles,
  // nails. The ring and little fingers carry a little more natural flex than the middle (a relaxed cascade).
  const fl = k2.distanceTo(kn), il = i2.distanceTo(ix);
  const curlAxis = new Vector3().crossVectors(down, palmN).normalize();   // rotating +θ about it moves a tip toward the palm
  const fingers = [
    { base: ix, zo: 0.004, b1: ib, b2: i2b, p: il, d: 0.042, r: 0.0098, drop: 0.002, flex: 2 },
    { base: kn, zo: -0.0135, b1: fb, b2: f2, p: fl, d: 0.045, r: 0.0101, drop: 0, flex: 6 },
    { base: kn, zo: 0.0025, b1: fb, b2: f2, p: fl * 0.96, d: 0.042, r: 0.0096, drop: 0.002, flex: 12 },
    { base: kn, zo: 0.0175, b1: fb, b2: f2, p: fl * 0.86, d: 0.034, r: 0.0087, drop: 0.006, flex: 19 },
  ];
  for (const g of fingers) {
    const o = g.base.clone().addScaledVector(back, g.zo * hs).addScaledVector(down, g.drop * hs);
    const pipStraight = g.base.clone().addScaledVector(back, g.zo * hs).addScaledVector(down, g.p);
    const pip = pipStraight;
    // the middle and distal phalanges flex a little from the PIP joint for the cascade
    const fdir = down.clone().applyAxisAngle(curlAxis, (g.flex * Math.PI) / 180);
    const tip = pip.clone().addScaledVector(fdir, g.d * hs);
    const r = g.r * hs;
    const knuckle = o.clone().addScaledVector(down, -0.006 * hs).addScaledVector(palmN, -0.0025 * hs);
    B.tube(limbRings([knuckle, o.clone().lerp(pip, 0.5), pip], [[r * 1.12, r * 1.1], [r * 0.92, r * 0.98], [r * 0.98, r * 1.02]]), {
      seg: 7, weights: (p) => normW([[g.b1, 1], [hb, 1.2 * (1 - smooth(0, 0.016 * hs, p.clone().sub(o).dot(down)))]]),
    });
    B.tube(limbRings([pip.clone().addScaledVector(down, -0.004 * hs), pip.clone().lerp(tip, 0.55), tip], [[r * 0.98, r * 1.02], [r * 0.86, r * 0.92], [r * 0.8, r * 0.86]]), {
      seg: 7, capB: 'dome', domeH: 0.95, bone: g.b2,
      shade: (th2, j) => (j === 1 ? 0.92 : 1),
    });
    B.set({ cls: CLS.SKIN, pat: PAT.NAIL, rough: 0.3, metal: 0, color: [1.14, 1.04, 1.0], grp: 0 });
    const nailUp = palmN.clone().negate();
    B.ellipsoid(tip.clone().addScaledVector(nailUp, r * 0.8 - 0.0012).addScaledVector(fdir, -0.005 * hs), [r * 0.6, 0.0026 * hs, 0.0062 * hs],
      { nu: 6, nv: 3, lat: [0, 0.5], bone: g.b2, xf: new Matrix4().makeBasis(back, nailUp, fdir) });
    B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  }
  // thumb: metacarpal (blended into the palm), proximal and distal phalanx, lying along the index
  // the thumb lies along the side of the index, a little toward the palm (relaxed), not splayed forward
  const tdir = down.clone().multiplyScalar(0.95).addScaledVector(back, 0.04).addScaledVector(palmN, 0.1).normalize();
  // the metacarpal lies inside the thenar pad; the free thumb starts at its knuckle
  const t0 = th.clone().addScaledVector(tdir, 0.012 * hs), t1 = th.clone().addScaledVector(tdir, 0.04 * hs);
  const t2 = th.clone().addScaledVector(tdir, 0.064 * hs), t3 = th.clone().addScaledVector(tdir, 0.084 * hs);
  B.tube(limbRings([t0, t1, t2, t3], [0.0118 * hs, 0.0106 * hs, 0.0098 * hs, 0.0088 * hs]), {
    seg: 9, capB: 'dome', domeH: 0.95, weights: (p) => normW([[tb, 1], [hb, 0.9 * (1 - smooth(0, 0.03 * hs, p.distanceTo(t0)))]]),
  });
  B.set({ cls: CLS.SKIN, pat: PAT.NAIL, rough: 0.3, metal: 0, color: [1.14, 1.04, 1.0], grp: 0 });
  const dors = palmN.clone().multiplyScalar(-0.5).addScaledVector(back, -0.85);
  dors.addScaledVector(tdir, -dors.dot(tdir)).normalize();
  const tx = new Vector3().crossVectors(dors, tdir).normalize();
  B.ellipsoid(t3.clone().addScaledVector(tdir, -0.006 * hs).addScaledVector(dors, 0.0094 * hs * 0.82), [0.0058 * hs, 0.0026 * hs, 0.0066 * hs],
    { nu: 6, nv: 3, lat: [0, 0.5], bone: tb, xf: new Matrix4().makeBasis(tx, dors, tdir) });
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
}

/**
 * Bare foot (and ankle up to `to` height) — everyone is barefoot on Har HaBayit (Rambam BhB 7:2; the kohanim
 * with nothing between foot and floor, Zevachim 24a). LOD0: heel, arch, ankle bones, the ball of the foot and
 * five toes with nails; the sole a little darker (dust of the courts). LOD1+: one shaped volume.
 */
export function foot(B, rig, lod, s, o = {}) {
  const sg = s === 'l' ? -1 : 1;
  const k = rig.dims.H / 1.67;
  const an = R(rig, `foot_${s}`), toe = R(rig, `toe_${s}`), sn = R(rig, `shin_${s}`);
  const fb = rig.index[`foot_${s}`], tb = rig.index[`toe_${s}`];
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 });
  const to = Math.min(o.to ?? an.y + 0.16, sn.y + 0.06);
  const pts = [V(an.x, an.y - 0.012, an.z + 0.004), V(an.x, lerp(an.y, to, 0.45), an.z), V(an.x, to, an.z - 0.004)];
  if (to > sn.y - 0.12) pts.splice(2, 0, V(sn.x, sn.y - 0.13 * k, sn.z));
  const rad = pts.map((p) => (p.y < an.y + 0.05 ? 0.034 * k : p.y > sn.y - 0.06 ? 0.048 * k : 0.04 * k));
  const legW = (p) => envelope(rig, p, { [`shin_${s}`]: 1, [`foot_${s}`]: 0.6, [`thigh_${s}`]: 0.3 }, 4);
  if (lod < 3) B.tube(limbRings(lod >= 2 ? [pts[0], pts[pts.length - 1]] : pts, lod >= 2 ? [rad[0], rad[rad.length - 1]] : rad), { seg: L3(lod, 14, 6, 4), weights: legW,
    radial: lod === 0 ? (th, j) => 1 + (j === 1 ? 0.06 * Math.max(0, -Math.sin(th)) : 0) : null }); // the calf behind
  const len = rig.dims.footLen * 0.95;
  if (lod >= 1) {
    const cz = an.z - len * 0.26;
    const c = V(an.x + sg * 0.003, 0.036 * k, cz);
    B.ellipsoid(c, [0.038 * k, 0.042 * k, len * 0.5], {
      nu: L3(lod, 14, 8, 5), nv: L3(lod, 9, 5, 3),
      deform: (l) => {
        if (l.y < -0.028 * k) l.y = -0.028 * k - (l.y + 0.028 * k) * 0.15;
        const front = -l.z / (len * 0.52);
        l.y *= 1 - 0.55 * smooth(0.0, 1, front);
        l.x *= 1 + 0.12 * smooth(0.2, 0.8, front) - 0.25 * smooth(-0.3, -1, front);
        l.x += sg * 0.008 * smooth(0, 1, front);
        if (l.y > 0) l.y *= 1 + 0.6 * smooth(-0.1, -0.9, front);
        return l;
      },
      weights: (p) => (p.z < toe.z + 0.01 ? normW([[tb, 1], [fb, 0.6 * smooth(toe.z - 0.03, toe.z + 0.01, p.z)]]) : normW([[fb, 1], [tb, 0.3 * smooth(toe.z + 0.04, toe.z, p.z)]])),
      shade: (l) => (l.y < -0.02 * k ? 0.82 : 1),
    });
    return;
  }
  // LOD0: the body of the foot lofted from the heel to the ball, sole flat with the medial arch lifted
  const heelZ = an.z + len * 0.25, ballZ = toe.z + 0.012 * k;
  const secs = [ // [z, centre y, half-width, half-height, x shift outward]; the bottoms dip below 0 and are cut flat
    [heelZ + 0.004, 0.03, 0.014, 0.03, 0],
    [heelZ - 0.01, 0.032, 0.028, 0.036, 0],
    [an.z + 0.015, 0.045, 0.032, 0.05, 0],
    [an.z - 0.03, 0.04, 0.036, 0.045, 0.002],
    [lerp(an.z, ballZ, 0.55), 0.03, 0.04, 0.034, 0.004],
    [ballZ + 0.02, 0.02, 0.044, 0.024, 0.006],
    [ballZ - 0.004, 0.016, 0.045, 0.018, 0.007],
  ];
  const rings = secs.map(([z, y, w, h, xs]) => ({ c: V(an.x + sg * (0.003 + xs) * k, y * k, z), rx: w * k, rz: h * k, ax: V(1, 0, 0), az: V(0, 1, 0) }));
  const fw = (p) => (p.z < ballZ + 0.02 ? normW([[fb, 1], [tb, 0.6 * smooth(ballZ + 0.02, ballZ - 0.01, p.z)]]) : normW([[fb, 1], [rig.index[`shin_${s}`], 0.4 * smooth(0.08 * k, 0.12 * k, p.y)]]));
  B.tube(rings, {
    seg: 14, weights: fw, capA: 'dome', capB: 'dome', domeH: 0.5,
    radial: (th, j, Rg) => {
      const sinT = Math.sin(th), cosT = Math.cos(th);
      // the sole is cut flat on the floor; under the arch its inner side lifts; the ankle bones bulge
      let m = 1;
      const medial = -sg * cosT;            // +1 on the inner side
      if (j === 2) m *= 1 + 0.08 * Math.abs(cosT) * Math.max(0, sinT + 0.2);
      if (sinT < 0) {
        const level = (0.0025 + (j >= 2 && j <= 4 ? 0.014 * Math.max(0, medial) * (j === 3 ? 1 : 0.6) : 0)) * k;
        m = Math.min(m, (Rg.c.y - level) / (Rg.rz * -sinT));
      }
      return Math.max(0.2, m);
    },
    shade: (th) => (Math.sin(th) < -0.6 ? 0.8 : 1),
  });
  // toes: the big toe and four smaller ones, splayed a little, with nails
  const toes = [ // [x offset (× inner→outer), length, radius]
    [-0.026, 0.05, 0.0125], [-0.006, 0.042, 0.0088], [0.011, 0.038, 0.0082], [0.026, 0.032, 0.0076], [0.039, 0.026, 0.007],
  ];
  for (const [xo, L, r] of toes) {
    const x0 = an.x + sg * (0.007 + xo) * k;
    const z0 = ballZ + 0.01 * k + Math.abs(xo) * 0.35;
    const y0 = 0.014 * k;
    const spread = sg * xo * 0.35;
    const p0 = V(x0, y0 + 0.003 * k, z0), p1 = V(x0 + spread * L, y0 + 0.002 * k, z0 - L * 0.55 * k), p2 = V(x0 + spread * L * 1.6, r * k * 0.85, z0 - L * k);
    B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 });
    B.tube(limbRings([p0, p1, p2], [[r * k * 1.05, r * k * 0.95], [r * k, r * k * 0.82], [r * k * 0.9, r * k * 0.75]]), {
      seg: 6, capB: 'dome', domeH: 0.9, weights: (p) => normW([[tb, 1], [fb, 0.5 * smooth(z0 - 0.01, z0 + 0.005, p.z)]]),
      shade: (th) => (Math.sin(th) < -0.5 ? 0.82 : 1),
    });
    B.set({ cls: CLS.SKIN, pat: PAT.NAIL, rough: 0.3, metal: 0, color: [1.12, 1.03, 0.98], grp: 0 });
    B.ellipsoid(p2.clone().add(V(0, r * k * 0.62, 0.004 * k)), [r * k * 0.62, 0.0018 * k, r * k * 0.75], { nu: 6, nv: 3, lat: [0, 0.5], bone: tb });
  }
}

// --------------------------------------------------------------------------------------------- garments
function torsoRings(rig, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const nk = R(rig, 'neck'), sh = R(rig, 'uarm_r'), ch = R(rig, 'chest'), sp = R(rig, 'spine'), pv = R(rig, 'pelvis'), hp = R(rig, 'thigh_r');
  const t = o.thick ?? 0.006;
  const fem = d.sex === 'f';
  // neck → shoulder line: the trapezius falls ~5.5 cm (men) from the neck root to the shoulder tip, steep
  // near the neck and flattening outward (y = yAcr + drop·(1 − u)^1.4 along u = 0 … 1)
  const xN = d.neckR + t + 0.006, xA = d.shX + 0.012 * k + t;
  const yN = nk.y + 0.04 * k, yA = sh.y + 0.004 * k;
  const shoulderY = (u) => yA + (yN - yA) * (1 - u) ** 1.4;
  const rings = [
    { c: V(0, yN, nk.z + 0.002), rx: xN, rz: d.neckR + t + 0.004, tag: 'collar' },
    { c: V(0, shoulderY(0.24), 0.01), rx: lerp(xN, xA, 0.24), rz: lerp(d.neckR * 1.25, d.chest[1] * 0.98, 0.3) + t, tag: 'trap0' },
    { c: V(0, shoulderY(0.55), 0.012), rx: lerp(xN, xA, 0.55), rz: d.chest[1] * 0.84 + t, tag: 'trap' },
    { c: V(0, yA, 0.008), rx: xA, rz: d.chest[1] * 0.98 + t, tag: 'shoulder' },
    { c: V(0, ch.y + 0.075 * k, -0.002), rx: d.chest[0] * 1.02 + t, rz: d.chest[1] + t + (fem ? 0.008 : 0), tag: 'chest' },
    { c: V(0, ch.y - 0.03 * k, 0.0), rx: d.chest[0] * 0.95 + t, rz: d.chest[1] * 0.97 + t, tag: 'ribs' },
    { c: V(0, sp.y, 0.002), rx: d.waist[0] + t, rz: d.waist[1] + t, tag: 'waist' },
    { c: V(0, pv.y - 0.035 * k, 0.004), rx: d.hips[0] + t, rz: d.hips[1] + t, tag: 'hips' },
    { c: V(0, hp.y - 0.06 * k, 0.008), rx: d.hips[0] * 1.03 + t, rz: d.hips[1] * 1.05 + t, tag: 'seat' },
  ];
  let out = rings;
  if (o.from) out = rings.slice(rings.findIndex((r) => r.tag === o.from));
  if (o.lod === 2) out = out.filter((r) => ['collar', 'trap', 'shoulder', 'chest', 'waist', 'hips', 'seat'].includes(r.tag));
  if (o.lod >= 3) out = out.filter((r) => ['collar', 'shoulder', 'chest', 'waist', 'hips'].includes(r.tag));
  return out;
}

function skirtRings(rig, hemY, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const hp = R(rig, 'thigh_r');
  const t = o.thick ?? 0.006;
  const top = hp.y - 0.06 * k;
  const flare = o.flare ?? 0.05 * k;
  const step = o.lod === 0 ? 0.1 : 0.16;
  const n = o.lod >= 3 ? 1 : o.lod === 2 ? 2 : Math.max(2, Math.round((top - hemY) / (step * k)));
  const rings = [];
  for (let j = 1; j <= n; j++) {
    const s = j / n;
    const y = lerp(top, hemY, s);
    rings.push({ c: V(0, y, 0.008 + 0.01 * s), rx: d.hips[0] * 1.03 + t + flare * s ** 1.3 + (o.extra || 0), rz: d.hips[1] * 1.05 + t + flare * 0.85 * s ** 1.3 + (o.extra || 0), s });
  }
  return rings;
}

function torsoW(rig, armMul = 0.18) {
  return (p) => envelope(rig, p, { pelvis: 1, spine: 1, chest: 1, neck: 0.5, clav_l: 0.35, clav_r: 0.35, uarm_l: armMul, uarm_r: armMul }, 4);
}

/**
 * Skirt weights on the cage (cloth.js): pelvis at the seat → the upper cage bone toward the knee → the hem cage
 * bone below it; left/right by side with a soft blend across the middle (the cloth webs between the legs).
 */
function skirtW(rig, yTop, yHem) {
  const I = rig.index;
  const kneeY = R(rig, 'skh_r').y;
  const tw = torsoW(rig);
  return (p) => {
    if (p.y > yTop) return tw(p);
    const u = clamp((yTop - p.y) / Math.max(0.05, yTop - kneeY));
    const wPel = 1 - smooth(0, 0.6, u);
    const wHem = p.y < kneeY + 0.03 ? smooth(kneeY + 0.03, kneeY - 0.12, p.y) * (yHem < kneeY - 0.02 ? 1 : 0) : 0;
    const wUp = (1 - wPel) * (1 - wHem);
    const fl = smooth(0.05, -0.05, p.x);
    return normW([[I.pelvis, wPel], [I.skt_l, wUp * fl], [I.skt_r, wUp * (1 - fl)], [I.skh_l, wHem * fl * (1 - wPel)], [I.skh_r, wHem * (1 - fl) * (1 - wPel)]]);
  };
}

/**
 * Drape of a long garment: folds fall from where the cloth is held (belt / shoulders) and open toward the hem —
 * rounded ridges between sharp creases (|sin|), two incommensurate families slanting slightly, valleys shaded
 * (ambient occlusion in the creases). Returns { radial, shade, lift } for MeshBuilder.tube.
 */
function drape(lod, o) {
  if (lod >= 2) return { radial: null, shade: null };
  const r = prng(o.seed ?? 1.3);
  const n1 = o.n ?? 9, n2 = Math.round(n1 * 1.63) + 1;
  const s1 = r() * 6.28, s2 = r() * 6.28;
  const amp = o.amp ?? 0.05, start = o.start ?? 0, span = Math.max(1, o.span ?? 5);
  const F = (th, j) => {
    const a = 0.62 * (Math.abs(Math.sin((n1 * th) / 2 + s1 + 0.07 * j)) - 0.637) + 0.38 * (Math.abs(Math.sin((n2 * th) / 2 + s2 - 0.05 * j)) - 0.637);
    return a;
  };
  const A = (j) => amp * smooth(start - 0.6, start + span, j);
  return {
    radial: (th, j) => 1 + A(j) * F(th, j) * 2.2,
    shade: (th, j) => 1 - (lod === 0 ? 0.32 : 0.24) * (A(j) / amp) * Math.max(0, -F(th, j)) * 2.2,
    hem: (th, j) => A(j) * F(th, j) * 0.25,
  };
}

/** the collar and trapezius rings rise toward the back: the muscle climbs the back of the neck */
export function backLift(rig) {
  const k = rig.dims.H / 1.67;
  return (th, j, R) => {
    const up = { collar: 0.017, trap0: 0.013, trap: 0.006 }[R.tag] || 0;
    return up ? up * k * Math.max(0, Math.sin(th)) ** 1.5 : 0;
  };
}

/**
 * Torso + skirt of a garment as one tube. o: thick, flare, folds (amplitude), nFolds, seed, foldFrom (ring tag
 * where the folds begin — the belt), uvMode, inner (add the hem's inner facing).
 */
function garmentBody(B, rig, lod, hemY, o = {}) {
  const top = torsoRings(rig, { ...o, lod });
  const sk = skirtRings(rig, hemY, { ...o, lod });
  const rings = top.concat(sk);
  const ySeat = R(rig, 'thigh_r').y - 0.06 * rig.dims.H / 1.67;
  const nTop = top.length;
  const from = o.foldFrom ? Math.max(0, rings.findIndex((q) => q.tag === o.foldFrom)) : nTop - 1;
  const dr = drape(lod, { amp: o.folds ?? 0.045, n: o.nFolds ?? 9, seed: o.seed ?? 1.3, start: from, span: Math.max(2, rings.length - 1 - from) * 0.7 });
  const bl = backLift(rig);
  const last = rings.length - 1;
  const W = skirtW(rig, ySeat, hemY);
  const tw = torsoW(rig);
  B.tube(rings, {
    seg: L3(lod, 40, 16, 7), uvMode: o.uvMode,
    lift: (th, j, Rg) => bl(th, j, Rg) + (j === last && dr.hem ? dr.hem(th, j) : 0),
    weights: (p, j) => (j < nTop - 1 ? tw(p) : W(p)),
    radial: dr.radial, shade: dr.shade,
  });
  // the hem's inner facing: cloth thickness at the edge, dark inside (seen from low angles and when it lifts)
  if (lod <= 1 && o.inner !== false) {
    const hem = rings[last];
    const seg = L3(lod, 40, 16, 7);
    B.tube([
      { c: hem.c.clone(), rx: hem.rx, rz: hem.rz },
      { c: hem.c.clone().add(V(0, 0.05, 0)), rx: hem.rx * 0.97, rz: hem.rz * 0.97 },
    ], { seg, invert: true, weights: (q) => W(V(q.x, hem.c.y, q.z)), radial: dr.radial ? (th) => dr.radial(th, last) : null, // the hem's own weights
      lift: (th, j) => (j === 0 && dr.hem ? dr.hem(th, last) : 0), shade: () => 0.55 });
  }
  return rings;
}

/** the ketonet: fitted linen tunic to just above the heel, hand-wide sleeves to the wrist, boxed (meshubetzet)
 *  weave; it hangs low and straight (meshulshalim — Rambam KhM 8:4, 8:16–17) and blouses softly at the avnet */
export function ketonet(B, rig, lod, o = {}) {
  const hemY = R(rig, 'foot_r').y + 0.04 * rig.dims.H / 1.67;
  B.set({ cls: o.cls ?? CLS.GA, pat: PAT.LINEN_BOX, rough: 0.82, metal: 0, color: o.color || [1, 1, 1], grp: 0 });
  if (!o.noBody) garmentBody(B, rig, lod, hemY, { folds: 0.05, nFolds: 11, flare: 0.05, thick: 0.005, foldFrom: 'ribs', seed: o.seed ?? 2.1 });
  for (const s of ['l', 'r']) arm(B, rig, lod, s, { sleeveTo: 'wrist', cls: o.cls ?? CLS.GA, pat: PAT.LINEN_BOX, color: o.color });
  return hemY;
}

/** the avnet: 3 fingers wide, 32 amot long, wound winding on winding over the heart (Rambam KhM 8:19); wool
 *  embroidery (rokem) in techelet, argaman and tola'at shani on the linen (8:1), except the white YK avnet */
export function avnet(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const ch = R(rig, 'chest');
  const yc = ch.y - 0.035 * k, hh = AMAH / 16;            // 3 etzba'ot = 1/8 amah wide
  B.set({ cls: CLS.FIX, pat: o.white ? PAT.LINEN : PAT.AVNET, rough: 0.8, metal: 0, color: o.white ? COL.linenKG : AVNET_AVG, grp: 0 });
  const t = 0.0055;                                         // ~16 windings of fine linen: a flat band, not a roll
  const us = lod >= 2 ? [-1, 1] : [-1, -0.97, -0.75, 0, 0.75, 0.97, 1];
  const rings = us.map((u) => {
    const bulge = 1 - Math.abs(u) ** 8;                     // square-edged: the edges of flat windings
    return { c: V(0, yc + u * hh, 0.0), rx: d.chest[0] * 0.95 + 0.005 + t * (0.3 + 0.7 * bulge), rz: d.chest[1] * 0.97 + 0.005 + t * (0.3 + 0.7 * bulge), u };
  });
  const seg = L3(lod, 40, 16, 7);
  const start = B.count;
  B.tube(rings, {
    seg, weights: torsoW(rig, 0),
    // the outermost windings show as stepped edges at top and bottom; a slight twist in the band
    radial: lod >= 2 ? null : (th, j) => 1 + 0.004 * Math.sin(j * 3.1 + th * 2) * (j > 0 && j < us.length - 1 ? 1 : 0) + (Math.abs(us[j]) > 0.9 ? 0.003 * Math.sin(th * 3 + 1) : 0),
    shade: lod >= 2 ? null : (th, j) => (Math.abs(us[j]) > 0.99 ? 0.8 : 1),
  });
  // uv for the embroidery: around (m) × height (m)
  for (let j = 0; j < rings.length; j++) {
    for (let i = 0; i <= seg; i++) {
      const vi = start + j * (seg + 1) + i;
      const th = (i / seg) * Math.PI * 2;
      B.uv[vi * 2] = th * (rings[j].rx + rings[j].rz) / 2;
      B.uv[vi * 2 + 1] = rings[j].u * hh;
    }
  }
}

/** plain cloth belt at the waist (Israelites / Levites / women) */
export function belt(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const sp = R(rig, 'spine');
  const yc = sp.y - 0.01 * k, hh = 0.022 * k;
  B.set({ cls: o.cls ?? CLS.STRIPE, pat: PAT.WOOL, rough: 0.9, metal: 0, color: o.color || [0.9, 0.9, 0.9], grp: o.grp || 0 });
  const t = (o.thick ?? 0.006) + 0.01;
  B.tube((lod >= 2 ? [-1, 1] : [-1, -0.5, 0, 0.5, 1]).map((u) => ({ c: V(0, yc + u * hh, 0.002), rx: d.waist[0] + t - Math.abs(u) ** 3 * 0.004, rz: d.waist[1] + t - Math.abs(u) ** 3 * 0.004 })), {
    seg: L3(lod, 32, 14, 7), weights: torsoW(rig, 0),
    radial: lod === 0 ? (th, j) => 1 + 0.02 * Math.sin(th * 7 + j) : null,
  });
  // the knot and its hanging ends at the front
  if (lod === 0) {
    B.ellipsoid(V(-0.01 * k, yc, -d.waist[1] - t - 0.004), [0.018 * k, 0.016 * k, 0.012 * k], { nu: 8, nv: 5, weights: torsoW(rig, 0) });
    for (const x of [-0.014, 0.0]) {
      B.ribbon([V(x * k - 0.006, yc - 0.01, -d.waist[1] - t - 0.006), V(x * k - 0.004, yc - 0.12 * k, -d.waist[1] - t - 0.03), V(x * k, yc - 0.2 * k, -d.waist[1] - t - 0.035)], 0.022 * k,
        { side: V(1, 0, 0), weights: torsoW(rig, 0) });
    }
  }
}

/** an ordinary tunic (chaluk) of wool/linen; uvMode 'x' lets the shader draw clavi stripes */
export function tunic(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const hemY = o.hemY ?? R(rig, 'shin_r').y - 0.17 * k;
  B.set({ cls: o.cls ?? CLS.GA, pat: o.pat ?? PAT.WOOL_CLAVI, rough: 0.9, metal: 0, color: [1, 1, 1], grp: 0 });
  garmentBody(B, rig, lod, hemY, { folds: o.folds ?? 0.085, nFolds: o.nFolds ?? 8, flare: o.flare ?? 0.07 * k, thick: 0.008, uvMode: o.pat === PAT.WOOL ? undefined : 'x', seed: o.seed ?? 0.7, foldFrom: 'waist' });
  for (const s of ['l', 'r']) arm(B, rig, lod, s, { sleeveTo: o.sleeve || 'elbow', cls: o.cls ?? CLS.GA, pat: PAT.WOOL, rough: 0.9 });
  return hemY;
}

/**
 * Mantle (tallit): a large rectangle laid over both shoulders and around the back, open in front. Its two ends
 * hang as front panels to the shin, the back falls to the shin, and at the sides the cloth falls over the upper
 * arms to about the elbow, so the hem rises from front and back toward the arms (the way a wrapped shawl hangs;
 * reconstruction). Tzitzit hang from the four corners — the inner and outer bottom corners of the two front
 * panels: 4 strings doubled (8 ends), one of them techelet (Bamidbar 15:38; Rambam Tzitzit 1:6), wound (gedil)
 * at the top. Heavy wool: deep folds from the shoulders, the front edges rolled. The sides are skinned to the
 * upper arms, the panels below the seat to the skirt cage (cloth.js).
 */
export function mantle(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const hemLow = o.hemY ?? R(rig, 'shin_r').y + 0.02 * k;
  const grp = o.grp ?? GRP.MANTLE;
  const gap = o.gap ?? 0.5;                                   // half-angle of the open front (rad)
  const a0 = -Math.PI / 2 + gap, a1 = Math.PI * 1.5 - gap;
  const sh = R(rig, 'uarm_r'), el = R(rig, 'farm_r'), nk = R(rig, 'neck'), ch = R(rig, 'chest');
  const ySeat = R(rig, 'thigh_r').y - 0.06 * k;
  const SW = skirtW(rig, ySeat, hemLow);
  // body section under the mantle at a height (torso rings, then the skirt below the seat), plus clearance
  const tr = torsoRings(rig, { thick: 0.02, from: 'trap' });
  const sk = skirtRings(rig, hemLow, { thick: 0.03, flare: 0.05 * k, extra: 0.004, lod: 1 });
  const prof = tr.concat(sk);
  const bodyAt = (y) => {
    if (y >= prof[0].c.y) return { rx: prof[0].rx, rz: prof[0].rz, cz: prof[0].c.z };
    for (let i = 0; i < prof.length - 1; i++) {
      const A = prof[i], Bq = prof[i + 1];
      if (y <= A.c.y && y >= Bq.c.y) {
        const t = (A.c.y - y) / Math.max(1e-5, A.c.y - Bq.c.y);
        return { rx: lerp(A.rx, Bq.rx, t), rz: lerp(A.rz, Bq.rz, t), cz: lerp(A.c.z, Bq.c.z, t) };
      }
    }
    const L = prof[prof.length - 1];
    return { rx: L.rx, rz: L.rz, cz: L.c.z };
  };
  // the hem: each front panel (the two ends of the cloth) hangs to the shin with a square outer corner; from the
  // corner the edge steps up to the elbow over the arm and falls again in a curve to the middle of the back
  const pw = o.panel ?? 0.82;                                 // angular width of a front panel from the opening
  const backC = Math.PI - gap;                                 // the middle of the back, measured from the opening
  const fromOpen = (th) => (th < Math.PI / 2 ? th - a0 : a1 - th);
  const sideMask = (th) => {
    const ph = fromOpen(th);
    const panel = 1 - smooth(pw - 0.035, pw + 0.035, ph);
    const u = clamp((ph - pw) / Math.max(0.1, backC - pw));
    return (1 - panel) * (1 - smooth(0, 1, u)) ** 1.15;
  };
  const yTopAt = (th) => nk.y + 0.02 * k + 0.012 * k * Math.max(0, Math.sin(th));   // over the trapezius, higher behind
  const yHemAt = (th) => lerp(hemLow, el.y + 0.02 * k, sideMask(th));
  // over the upper arm the cloth clears it (the A-pose arm of the rest rig, which the stand pose brings in)
  const armClear = (th, y) => {
    if (y > sh.y + 0.02 || y < el.y - 0.06) return 0;
    const t = clamp((sh.y - y) / Math.max(0.01, sh.y - el.y));
    return (lerp(sh.x, el.x, t) + 0.052 * k) * smooth(0.55, 0.95, Math.abs(Math.cos(th)));
  };
  const dr = drape(lod, { amp: 0.11, n: 9, seed: o.seed ?? 3.7, start: 1, span: 5 });
  const nu = L3(lod, 44, 16, 7), nv = L3(lod, 15, 9, 4);
  const cols = [];
  B.set({ cls: CLS.GB, pat: PAT.WOOL, rough: 0.93, metal: 0, color: [1, 1, 1], grp });
  const W = (p, side) => {
    const base = p.y > ySeat ? envelope(rig, p, { pelvis: 0.6, spine: 1, chest: 1, neck: 0.3, clav_l: 0.6, clav_r: 0.6 }, 4) : SW(p);
    if (side < 0.02) return base;
    const s = p.x < 0 ? 'l' : 'r';
    const arm = envelope(rig, p, { [`clav_${s}`]: 0.5, [`uarm_${s}`]: 1, [`farm_${s}`]: 0.6 }, 4);
    return normW([...base.map(([b, w]) => [b, w * (1 - side)]), ...arm.map(([b, w]) => [b, w * side])]);
  };
  const sheet = (inner) => B.grid(nu, nv, (i, j) => {
    const th = lerp(a0, a1, i / nu);
    const t = j / nv;
    const yT = yTopAt(th), yH = yHemAt(th);
    const y = lerp(yT, yH, t);
    const body = bodyAt(y);
    const c = Math.cos(th), sn = Math.sin(th);
    // fold relief grows away from the shoulders; the front edges (near the opening) hang flatter and roll
    const edge = Math.min(th - a0, a1 - th);
    const fr = dr.radial ? 1 + (dr.radial(th, 1 + t * 6) - 1) * (1 - 0.5 * smooth(0.6, 0.1, edge)) : 1;
    let rx = body.rx + 0.022 * k, rz = body.rz + 0.022 * k;
    const need = armClear(th, y);
    rx = Math.max(rx, need);
    // below the arms the cloth falls from them and narrows gently toward the hem (it is not a box)
    if (y < el.y && sideMask(th) < 1) {
      const wide = (el.x + 0.04 * k) * smooth(0.5, 0.95, Math.abs(c)) * 0.92;
      rx = Math.max(rx, lerp(wide, body.rx + 0.03 * k, smooth(el.y, el.y - 0.35 * k, y)));
    }
    // the top edge is turned over and rolls softly onto the shoulders (outer surface tucked in at row 0)
    const r = fr - (inner ? 0.012 : 0) - (!inner && j === 0 ? 0.01 : 0);
    const p = V(c * rx * r, y, body.cz + sn * rz * r);
    // the shoulders: the cloth lies on the trapezius and the shoulder top
    if (t < 0.12) p.y += 0.004 * k * Math.sin(Math.PI * t / 0.12);
    const side = smooth(0.62, 0.95, Math.abs(c)) * (y > el.y - 0.08 ? 1 : 0);
    const shade = (dr.shade ? dr.shade(th, 1 + t * 6) : 1) * (1 - 0.12 * smooth(0.06, 0, edge)) * (t > 0.93 ? 0.9 : 1);
    if (!inner) cols.push(p);
    return { p, u: th * (rx + rz) / 2, v: -y, w: W(p, side * 0.42), shade: inner ? shade * 0.62 : shade };
  }, { inside: (A) => V(0, A.y, 0), invert: inner });
  sheet(false);
  if (lod <= 1) sheet(true);
  // (no separate collar tube: a rolled ring standing off the neck read as a torus — the sheet's own rolled
  // top row and the dark inner face give the edge)
  if (false) {
    const ring = [];
    const n = L3(lod, 30, 12, 6);
    for (let i = 0; i <= n; i++) {
      const th = lerp(a0, a1, i / n);
      const body = bodyAt(yTopAt(th));
      ring.push(V(Math.cos(th) * (body.rx + 0.026 * k), yTopAt(th) + 0.006, body.cz + Math.sin(th) * (body.rz + 0.026 * k)));
    }
    B.set({ cls: CLS.GB, pat: PAT.WOOL, rough: 0.93, metal: 0, color: [0.92, 0.92, 0.92], grp });
    B.tube(ring.map((c, j) => {
      const nx = ring[Math.min(ring.length - 1, j + 1)].clone().sub(ring[Math.max(0, j - 1)]).normalize();
      const az = V(0, 1, 0).addScaledVector(nx, -nx.y).normalize();
      return { c, rx: 0.011 * k, rz: 0.011 * k, ax: new Vector3().crossVectors(az, nx), az };
    }), { seg: 6, weights: (p) => envelope(rig, p, { chest: 1, neck: 0.5, clav_l: 0.5, clav_r: 0.5 }, 4) });
  }
  if (lod < 2 && o.tzitzit !== false) {
    // the four corners: inner and outer bottom corners of the two front panels
    // the outer corners: the bottom of each front panel's outer edge
    const corners = [a0 + 0.03, a1 - 0.03, a0 + pw - 0.05, a1 - pw + 0.05];
    for (const th of corners) {
      const y = yHemAt(th);
      const body = bodyAt(y);
      const need = armClear(th, y);
      const rx = Math.max(body.rx + 0.022 * k, need);
      const base = V(Math.cos(th) * rx * 1.02, y + 0.012, body.cz + Math.sin(th) * (body.rz + 0.022 * k) * 1.02);
      const tang = V(-Math.sin(th), 0, Math.cos(th));
      const out = V(Math.cos(th), 0, Math.sin(th));
      const wts = (p) => W(p, 0);
      const gl = 0.045 * k;
      B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.85, metal: 0, color: COL.techelet, grp });
      B.tube([{ c: base.clone().addScaledVector(out, 0.004), rx: 0.0035, rz: 0.0035 }, { c: base.clone().addScaledVector(out, 0.006).add(V(0, -gl, 0)), rx: 0.0032, rz: 0.0032 }],
        { seg: 5, weights: wts, capB: 'flat' });
      const n = lod === 0 ? 8 : 3;
      for (let q = 0; q < n; q++) {
        const blue = q === n - 1;
        B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.85, metal: 0, color: blue ? COL.techelet : COL.tzitzit, grp });
        const off = (q - (n - 1) / 2) * 0.0022;
        const top0 = base.clone().addScaledVector(out, 0.006).add(V(0, -gl, 0)).addScaledVector(tang, off * 0.4);
        const pts = [0, 0.5, 1].map((u) => top0.clone().addScaledVector(tang, off * u * 1.6).addScaledVector(out, 0.004 * u).add(V(0, -u * 0.1 * k, 0)));
        B.ribbon(pts, 0.0016, { side: tang, weights: wts });
      }
    }
  }
}

/** me'il: robe entirely of techelet, sleeveless, to the feet; hem of golden bells and wool pomegranates */
export function meil(B, rig, lod) {
  const d = rig.dims, k = d.H / 1.67;
  const hemY = R(rig, 'foot_r').y + 0.085 * k;
  B.set({ cls: CLS.FIX, pat: PAT.TECHELET, rough: 0.88, metal: 0, color: COL.techelet, grp: 0 });
  const rings = garmentBody(B, rig, lod, hemY, { folds: 0.065, nFolds: 10, flare: 0.07 * k, thick: 0.014, foldFrom: 'waist', seed: 5.3 });
  // woven binding at the neck opening (Shemot 28:32)
  const nk = rings[0];
  B.tube([-1, 0, 1].map((u) => ({ c: nk.c.clone().add(V(0, u * 0.008, 0)), rx: nk.rx + 0.006 - Math.abs(u) * 0.003, rz: nk.rz + 0.006 - Math.abs(u) * 0.003 })),
    { seg: L3(lod, 20, 12, 6), weights: torsoW(rig, 0) });
  const hem = rings[rings.length - 1];
  const ySeat = R(rig, 'thigh_r').y - 0.06 * k;
  const W = skirtW(rig, ySeat, hemY);
  if (lod >= 2) {
    B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.3, metal: 1, color: COL.gold });
    B.tube([0, 1].map((u) => ({ c: hem.c.clone().add(V(0, -0.012 - u * 0.02, 0)), rx: hem.rx + 0.006, rz: hem.rz + 0.006 })), { seg: 9, weights: W });
    return;
  }
  // bells (gold) and pomegranates (techelet, argaman, tola'at shani wool) alternating — 72 bells (Rambam KhM 9:3)
  const pomCols = [COL.techelet, COL.argaman, COL.shani];
  const dr = drape(lod, { amp: 0.045, n: 10, seed: 5.3, start: 0, span: 1 });
  const rad = (th) => (dr.radial ? 1 + (dr.radial(th, 99) - 1) : 1);
  if (lod === 1) { // a fringe of small alternating tabs reads the same at mid range
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const p = hem.c.clone().add(V(Math.cos(th) * (hem.rx * rad(th) + 0.004), -0.004, Math.sin(th) * (hem.rz * rad(th) + 0.004)));
      const tang = V(-Math.sin(th), 0, Math.cos(th));
      if (i % 2 === 0) B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.25, metal: 1, color: COL.gold });
      else B.set({ cls: CLS.FIX, pat: PAT.WOOL, rough: 0.9, metal: 0, color: pomCols[(i >> 1) % 3] });
      B.ribbon([p, p.clone().add(V(0, -0.026 * k, 0))], 0.02 * k, { side: tang, weights: W });
    }
    return;
  }
  const N = 72;
  for (let i = 0; i < N * 2; i++) {
    const th = (i / (N * 2)) * Math.PI * 2;
    const p = hem.c.clone().add(V(Math.cos(th) * hem.rx * rad(th), -0.004, Math.sin(th) * hem.rz * rad(th)));
    const s = 0.011 * k;
    if (i % 2 === 0) {
      B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.22, metal: 1, color: COL.gold });
      B.tube([
        { c: p.clone().add(V(0, -0.002, 0)), rx: s * 0.25, rz: s * 0.25 },
        { c: p.clone().add(V(0, -0.012, 0)), rx: s * 0.6, rz: s * 0.6 },
        { c: p.clone().add(V(0, -0.024, 0)), rx: s * 0.95, rz: s * 0.95 },
      ], { seg: 7, weights: W, capA: 'flat', capB: 'flat' });
    } else {
      B.set({ cls: CLS.FIX, pat: PAT.WOOL, rough: 0.9, metal: 0, color: pomCols[(i >> 1) % 3] });
      B.ellipsoid(p.clone().add(V(0, -0.016, 0)), [s * 0.85, s, s * 0.85], { nu: 7, nv: 5, weights: W,
        deform: (l) => { if (l.y < -s * 0.7) { l.x *= 1.25; l.z *= 1.25; } return l; } }); // the calyx crown
    }
  }
}

/** ephod (back apron to the heels) + its belt (cheshev) + shoulder-pieces with the two shoham stones.
 *  Woven of gold thread twisted with techelet, argaman, tola'at shani and shesh (28 strands — Yoma 72a). */
export function ephod(B, rig, lod) {
  const d = rig.dims, k = d.H / 1.67;
  const ch = R(rig, 'chest');
  const hemY = R(rig, 'foot_r').y + 0.11 * k;
  B.set({ cls: CLS.FIX, pat: PAT.EPHOD, rough: 0.34, metal: 0, color: EPHOD_AVG, grp: 0 });
  const top = torsoRings(rig, { thick: 0.024, from: 'ribs', lod });
  const sk = skirtRings(rig, hemY, { thick: 0.03, flare: 0.07 * k, extra: 0.006, lod });
  const rings = top.concat(sk);
  const ySeat = R(rig, 'thigh_r').y - 0.06 * k;
  const nTop = top.length;
  const SW = skirtW(rig, ySeat, hemY);
  const dr = drape(lod, { amp: 0.03, n: 5, seed: 0.4, start: 2, span: rings.length * 0.6 });
  B.tube(rings, {
    seg: L3(lod, 20, 9, 5), arc: [0.1, Math.PI - 0.1],
    weights: (p, j) => (j < nTop - 1 ? torsoW(rig, 0)(p) : SW(p)),
    radial: dr.radial, shade: dr.shade,
  });
  const yb = ch.y - 0.035 * k;
  B.tube((lod >= 2 ? [-1, 1] : [-1, 0, 1]).map((u) => ({ c: V(0, yb + u * 0.026 * k, 0.0), rx: d.chest[0] * 0.95 + 0.03 - Math.abs(u) * 0.003, rz: d.chest[1] * 0.97 + 0.03 - Math.abs(u) * 0.003 })),
    { seg: L3(lod, 32, 14, 7), weights: torsoW(rig, 0) });
  for (const sg of [-1, 1]) {
    const sh = R(rig, sg < 0 ? 'uarm_l' : 'uarm_r');
    const x = sg * (d.shX * 0.62);
    const pts = [V(x, ch.y - 0.0, 0.11 * k), V(x, sh.y - 0.02, 0.095 * k), V(x * 1.02, sh.y + 0.05 * k, 0.015), V(x, sh.y - 0.005, -0.09 * k), V(x, ch.y + 0.1 * k, -d.chest[1] - 0.03)];
    B.set({ cls: CLS.FIX, pat: PAT.EPHOD, rough: 0.34, metal: 0, color: EPHOD_AVG });
    B.ribbon(pts, 0.05 * k, { side: V(1, 0, 0), weights: (p) => envelope(rig, p, { chest: 1, clav_l: 0.5, clav_r: 0.5, neck: 0.2 }, 4) });
    const W2 = [[rig.index[sg < 0 ? 'clav_l' : 'clav_r'], 0.5], [rig.index.chest, 0.5]];
    B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.25, metal: 1, color: COL.goldDeep });
    const sp = V(x * 1.02, sh.y + 0.058 * k, 0.012);
    B.ellipsoid(sp, [0.023 * k, 0.008 * k, 0.027 * k], { nu: lod ? 8 : 14, nv: 4, weights: W2 });
    B.set({ cls: CLS.FIX, pat: PAT.GEM, rough: 0.12, metal: 0, color: COL.shoham });
    B.ellipsoid(sp.clone().add(V(0, 0.006 * k, 0)), [0.017 * k, 0.008 * k, 0.021 * k], { nu: lod ? 8 : 14, nv: 5, lat: [0, 0.5], weights: W2 });
  }
}

/** choshen: a zeret square (half an amah — Shemot 28:16) of the ephod's weave on the heart, 12 stones in four
 *  rows set in gold settings, gold chains to the shoulder-pieces, techelet cords below */
export function choshen(B, rig, lod) {
  const d = rig.dims, k = d.H / 1.67;
  const ch = R(rig, 'chest');
  const zeret = AMAH / 2;
  const cy = ch.y + 0.085 * k - 0.01, cz = -(d.chest[1] + 0.006 + 0.03);
  const W = (p) => envelope(rig, p, { chest: 1, spine: 0.3 }, 4);
  const curveZ = (x) => cz + x * x * 1.2;
  B.set({ cls: CLS.FIX, pat: PAT.EPHOD, rough: 0.34, metal: 0, color: EPHOD_AVG, grp: 0 });
  const nu = lod >= 2 ? 2 : 6;
  B.grid(nu, nu, (i, j) => {
    const x = (i / nu - 0.5) * zeret, y = cy + (0.5 - j / nu) * zeret;
    return { p: V(x, y, curveZ(x)), u: x, v: y, w: W };
  }, { inside: V(0, cy, 0) });
  // the folded double cloth shows its thickness at the edges (it was doubled — Shemot 28:16)
  if (lod < 2) {
    B.set({ cls: CLS.FIX, pat: PAT.EPHOD, rough: 0.34, metal: 0, color: EPHOD_AVG.map((x) => x * 0.85), grp: 0 });
    for (const [a, b] of [[[-0.5, 0.5], [0.5, 0.5]], [[0.5, 0.5], [0.5, -0.5]], [[0.5, -0.5], [-0.5, -0.5]], [[-0.5, -0.5], [-0.5, 0.5]]]) {
      const p0 = V(a[0] * zeret, cy + a[1] * zeret, 0), p1 = V(b[0] * zeret, cy + b[1] * zeret, 0);
      p0.z = curveZ(p0.x) + 0.004; p1.z = curveZ(p1.x) + 0.004;
      B.ribbon([p0.clone().add(V(0, 0, -0.0045)), p1.clone().add(V(0, 0, -0.0045))], 0.009, { side: V(0, 0, 1), weights: W });
    }
  }
  const cellW = zeret / 3, cellH = zeret / 4;
  const xf = new Matrix4().makeRotationX(-Math.PI / 2);
  for (let rI = 0; rI < (lod >= 3 ? 0 : 4); rI++) {
    for (let cI = 0; cI < 3; cI++) {
      const [, hex] = STONES[rI * 3 + cI];
      // Hebrew order as read by someone facing the Kohen Gadol: each row runs from the viewer's right
      // (the wearer's left, −x) to the viewer's left — odem top-right. See docs/decisions/people.md.
      const x = (cI - 1) * cellW, y = cy + (1.5 - rI) * cellH;
      const z = curveZ(x) - 0.002;
      if (lod < 2) { // gold setting (mishbetzot): a raised rim with a beaded edge around each stone
        B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.22, metal: 1, color: COL.goldDeep });
        B.ellipsoid(V(x, y, z), [cellW * 0.43, 0.005, cellH * 0.43], { nu: lod ? 10 : 20, nv: 3, lat: [0, 0.5], weights: W, xf,
          deform: lod === 0 ? (l) => { const a = Math.atan2(l.z, l.x); l.y *= 1 + 0.25 * Math.max(0, Math.cos(a * 10)); return l; } : null });
      }
      // the stone: an oval cabochon with a flattened table, standing proud of its setting; a darker heart and a
      // brighter rim (light carried through the stone) give it depth
      B.set({ cls: CLS.FIX, pat: PAT.GEM, rough: 0.06, metal: 0, color: hex });
      B.ellipsoid(V(x, y, z - 0.0025), [cellW * 0.34, 0.0085, cellH * 0.33], {
        nu: lod === 0 ? 16 : 6, nv: lod === 0 ? 6 : 2, lat: [0, 0.5], weights: W, xf,
        deform: lod === 0 ? (l) => { if (l.y > 0.0062) l.y = 0.0062 + (l.y - 0.0062) * 0.25; return l; } : null,
        shade: lod === 0 ? (l) => 0.7 + 0.45 * smooth(0.002, 0.0075, l.y) * 0 + 0.5 * (1 - smooth(0, 0.0085, l.y)) : null,
      });
    }
  }
  if (lod < 2) {
    for (const sg of [-1, 1]) {
      const sh = R(rig, sg < 0 ? 'uarm_l' : 'uarm_r');
      const a = V(sg * zeret / 2, cy + zeret / 2, cz);
      const b = V(sg * d.shX * 0.62, sh.y + 0.035 * k, -d.chest[1] * 0.45);
      const mid = a.clone().lerp(b, 0.5).add(V(0, 0, -0.03));
      B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.2, metal: 1, color: COL.gold });
      // gold chains of twisted (cord-like) work — Shemot 28:14
      const n = lod === 0 ? 10 : 2;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t).addScaledVector(V(0, 0, -1), Math.sin(Math.PI * t) * 0.03);
        pts.push(p);
      }
      if (lod === 0) {
        const nk = pts.length;
        B.tube(pts.map((c, j) => {
          const dir = (j < nk - 1 ? pts[j + 1].clone().sub(c) : c.clone().sub(pts[j - 1])).normalize();
          const az = V(0, 0, 1).addScaledVector(dir, -dir.z).normalize();
          return { c, rx: 0.0028, rz: 0.0028, ax: new Vector3().crossVectors(az, dir), az };
        }), { seg: 6, weights: (p) => envelope(rig, p, { chest: 1, clav_l: 0.4, clav_r: 0.4 }, 4), radial: (th, j) => 1 + 0.35 * Math.sin(th * 2 + j * 2.4) });
      } else B.ribbon([a, mid, b], 0.008, { side: V(1, 0, 0), weights: (p) => envelope(rig, p, { chest: 1, clav_l: 0.4, clav_r: 0.4 }, 4) });
      B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.8, metal: 0, color: COL.techelet });
      const c0 = V(sg * zeret / 2, cy - zeret / 2, cz + 0.002);
      B.ribbon([c0, c0.clone().add(V(sg * 0.01, -0.035 * k, 0.01))], 0.005, { side: V(1, 0, 0), weights: W });
    }
  }
}

// --------------------------------------------------------------------------------------------- recipes
function withBody(B, rig, lod, fn) {
  if (lod <= 1) B.morph = bodyMorph(rig);
  fn();
  B.morph = null;
}

export const RECIPES = {
  kohen(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04, covered: true });   // kohanim kept their hair short (Taanit 17a)
    beard(B, rig, lod, H, { len: 0.04 });
    migbaat(B, rig, lod, H);
    let hemY;
    withBody(B, rig, lod, () => { hemY = ketonet(B, rig, lod); avnet(B, rig, lod); });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.1 });
  },
  kg_white(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04, covered: true });
    beard(B, rig, lod, H, { len: 0.05 });
    mitznefet(B, rig, lod, H, { cls: CLS.FIX, color: COL.linenKG, base: 0.05 });
    let hemY;
    withBody(B, rig, lod, () => { hemY = ketonet(B, rig, lod, { cls: CLS.FIX, color: COL.linenKG }); avnet(B, rig, lod, { white: true }); });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.1 });
  },
  kg_gold(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04, covered: true });
    beard(B, rig, lod, H, { len: 0.05 });
    mitznefet(B, rig, lod, H);
    tzitz(B, rig, lod, H);
    withBody(B, rig, lod, () => {
      ketonet(B, rig, lod, { noBody: true }); // only the sleeves show from under the sleeveless me'il
      meil(B, rig, lod);
      ephod(B, rig, lod);
      choshen(B, rig, lod);
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: R(rig, 'foot_r').y + 0.2 });
  },
  levi(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.05 });
    beard(B, rig, lod, H, { len: 0.035 });
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'foot_r').y + 0.14 * rig.dims.H / 1.67, sleeve: 'wrist', pat: PAT.WOOL });
      belt(B, rig, lod, { thick: 0.008 });
      mantle(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.05 });
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  israelite(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.05 });
    beard(B, rig, lod, H, { len: 0.045 });
    headCloth(B, rig, lod, H, { grp: GRP.HEADCLOTH, short: true, open: 1.05, backY: R(rig, 'uarm_r').y - 0.08 });
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.2 * rig.dims.H / 1.67 });
      belt(B, rig, lod, { thick: 0.008 });
      mantle(B, rig, lod, {});
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  nazir(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.055, long: true, volume: 0.006 });
    beard(B, rig, lod, H, { len: 0.085, volume: 0.004 });
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.2 * rig.dims.H / 1.67 });
      belt(B, rig, lod, { thick: 0.008 });
      mantle(B, rig, lod, {});
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  elder(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.07 });
    beard(B, rig, lod, H, { len: 0.1, volume: 0.004 });
    headCloth(B, rig, lod, H, { grp: GRP.HEADCLOTH, cls: CLS.GB, open: 1.0 });
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'foot_r').y + 0.1 * rig.dims.H / 1.67, sleeve: 'wrist', pat: PAT.WOOL });
      belt(B, rig, lod, { thick: 0.008 });
      mantle(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.12, gap: 0.42 });
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  woman(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.05, covered: true });
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'foot_r').y + 0.05 * rig.dims.H / 1.67, sleeve: 'wrist', pat: PAT.WOOL, flare: 0.09, folds: 0.07, nFolds: 10, seed: 4.4 });
      belt(B, rig, lod, { thick: 0.008 });
      mantle(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.02, gap: 0.55, tzitzit: false, grp: 0, seed: 6.1 });
    });
    headCloth(B, rig, lod, H, { cls: CLS.GB, open: 0.92, backY: R(rig, 'pelvis').y - 0.05 });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  boy(B, rig, lod) { // levi_boy
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.055 });
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.12, sleeve: 'elbow', pat: PAT.WOOL });
      belt(B, rig, lod, { thick: 0.008 });
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  child(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.06, volume: 0.003 });
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y + 0.02, sleeve: 'elbow' });
      belt(B, rig, lod, { thick: 0.008 });
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
};

export function buildHumanGeometry(key, rig, lod) {
  const B = new MeshBuilder(rig);
  if (lod >= 2) B.maxInfluences = 2; // far crowd / silhouettes: half the skinning fetches
  const recipe = RECIPES[key];
  if (!recipe) throw new Error(`[people] no recipe ${key}`);
  recipe(B, rig, lod);
  return B.build();
}

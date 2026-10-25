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
import { MeshBuilder, envelope, normW, CLS, PAT, lin, MANTLE_ARMS } from './builder.js';
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

// optional parts by instance mask bit (1 << (grp - 1)): mantle, head-cloth, (3 always on), the priestly headgear (on by
// default; Actor.setHeadgear(false) hides it) and the hair shells drawn instead when it is off; the hair and the beard
// (on by default) and the shaven scalp and face drawn instead when they are shaved (Actor.setShaven — people-4); the
// hedyot's avnet of wool and linen (on by default; off outside the avodah — Actor.setGarb({ avnet: false }), qa-r1)
// gate-people-r2: HAIR_OPEN (no mask bit of its own) — hair standing proud of the cap, drawn with the hair grown and no
// head-cloth on (material.js VERT_BEGIN), so it never pierces the cloth
export const GRP = { MANTLE: 1, HEADCLOTH: 2, HEADGEAR: 4, BARE: 5, HAIR: 6, SHAVEN: 7, BEARD: 8, SHAVEN_FACE: 9, AVNET: 10, HAIR_OPEN: 11 };

// segment counts per LOD; LOD3 (far silhouettes beyond the figure budget) thins LOD2 further
const L3 = (lod, a, b, c) => (lod === 0 ? a : lod === 1 ? b : lod === 2 || c <= 3 ? c : Math.max(3, Math.round(c * 0.65)));

// deterministic per-build pseudo-random (fold placement): same figure → same folds
function prng(seed) {
  let a = Math.floor(seed * 1e6) >>> 0 || 1;
  return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
}
// smooth 2D value noise in [0, 1] (deterministic; gate-people-r2: the hair's lumps)
function vhash(i, j) { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); }
// (periodic in x with period px cells when px is given: an azimuth that wraps)
function vnoise2(x, y, px = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const w = (q) => (px ? ((q % px) + px) % px : q);
  const i0 = w(i), i1 = w(i + 1);
  return lerp(lerp(vhash(i0, j), vhash(i1, j), ux), lerp(vhash(i0, j + 1), vhash(i1, j + 1), ux), uy);
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
      // qa-r1: the dorsum stays narrow (the nasal bones) and widens only into the tip — a linear widening made a wedge
      const nw = lerp(0.0086, 0.0106, t ** 1.6) * hs;
      const prot = kid * hs * (0.006 + 0.012 * t * nose) * below * nasion;
      Z -= prot * Math.exp(-((x / nw) ** 2));
      Z -= kid * hook * 0.0026 * hs * g2(x, y, 0, ey - 0.021 * hs, nw * 0.9, 0.008 * hs);
      Z -= kid * nose * 0.0058 * hs * g2(x, y, 0, nTip + 0.0025 * hs, 0.0105 * hs, 0.0075 * hs);   // the rounded lobule
      Z -= 0.0052 * hs * (g2(x, y, 0.012 * hs, nTip + 0.0025 * hs, 0.0062 * hs, 0.0058 * hs) + g2(x, y, -0.012 * hs, nTip + 0.0025 * hs, 0.0062 * hs, 0.0058 * hs));
      Z += 0.0016 * hs * (g2(x, y, 0.0165 * hs, nTip + 0.006 * hs, 0.0028 * hs, 0.006 * hs) + g2(x, y, -0.0165 * hs, nTip + 0.006 * hs, 0.0028 * hs, 0.006 * hs)); // the alar groove
      // brow ridge (stronger in men: qa-r1 deeper, with the glabella), the eye sockets, cheekbones
      Z -= brow * (fem || young ? 0.005 : 0.0072) * hs * Math.exp(-(((y - (ey + 0.019 * hs)) / (0.0085 * hs)) ** 2)) * smooth(0.06 * hs, 0.018 * hs, ax);
      if (!fem && !young) Z -= 0.0022 * hs * g2(x, y, 0, ey + 0.016 * hs, 0.011 * hs, 0.008 * hs);
      Z += sd * (g2(x, y, ex, ey + 0.001 * hs, sx, sy) + g2(x, y, -ex, ey + 0.001 * hs, sx, sy));
      // cheekbones (the zygoma) — fuller and a little higher, with the hollow beneath them in an adult man's face
      Z -= cheek * 0.0052 * hs * (g2(x, y, 0.047 * hs, ey - 0.022 * hs, 0.0145 * hs, 0.012 * hs) + g2(x, y, -0.047 * hs, ey - 0.022 * hs, 0.0145 * hs, 0.012 * hs));
      if (!fem && !young) Z += 0.0024 * hs * (g2(x, y, 0.045 * hs, mouthY + 0.014 * hs, 0.012 * hs, 0.011 * hs) + g2(x, y, -0.045 * hs, mouthY + 0.014 * hs, 0.012 * hs, 0.011 * hs));
      // temples: a slight hollow behind the outer end of the brow
      Z += 0.0025 * hs * (g2(x, y, 0.064 * hs, ey + 0.022 * hs, 0.01 * hs, 0.016 * hs) + g2(x, y, -0.064 * hs, ey + 0.022 * hs, 0.01 * hs, 0.016 * hs));
      // nasolabial folds: a crease from the nostril wing down to beyond the mouth corner, the cheek fuller above it (adults)
      if (!young) {
        const u = clamp((nTip - y) / Math.max(1e-4, nTip - mouthY + 0.008 * hs));
        const xc = lerp(0.0145, 0.028, u) * hs;
        const env = Math.sin(Math.PI * Math.min(1, u * 1.1));
        Z += (fem ? 0.0007 : 0.0016) * hs * Math.exp(-(((ax - xc) / (0.0026 * hs)) ** 2)) * env;
        Z -= (fem ? 0.0006 : 0.0013) * hs * Math.exp(-(((ax - xc - 0.006 * hs) / (0.005 * hs)) ** 2)) * env;
      }
      // philtrum, lips (upper and lower vermilion), mouth corners, chin
      Z += 0.0008 * hs * g2(x, y, 0, (nTip + mouthY) / 2, 0.003 * hs, 0.007 * hs);
      Z -= 0.0034 * hs * g2(x, y, 0, mouthY + 0.0045 * hs, 0.017 * hs, 0.0042 * hs);
      Z -= 0.0038 * hs * g2(x, y, 0, mouthY - 0.006 * hs, 0.016 * hs, 0.005 * hs);
      Z += 0.0012 * hs * g2(ax, y, 0.023 * hs, mouthY, 0.004 * hs, 0.005 * hs);
      Z -= chin * 0.0048 * hs * g2(x, y, 0, chinY + 0.013 * hs, 0.017 * hs, 0.012 * hs);
    }
    // the zygomatic arch: the cheekbone carried back toward the ear, standing out a little sideways (qa-r1)
    let Xo = X;
    if (!young) Xo += Math.sign(x) * 0.0028 * hs * (fem ? 0.6 : 1) * Math.exp(-(((y - (f.eyeY - 0.02 * hs)) / (0.0065 * hs)) ** 2)) * smooth(-0.6, -0.15, z / r[2]) * smooth(0.035 * hs, 0.06 * hs, Math.abs(x));
    return V(Xo, y, Z);
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
  if (B.noHead) return H;            // a body-only build (props.js sleeperField: the head lies outside the cover)
  const shape = headShape(H);
  const hb = rig.index.head;
  if (lod <= 1) B.morph = headMorph(H);
  B.set({ cls: CLS.SKIN, pat: lod === 0 ? PAT.FACE : lod === 1 ? PAT.FACE1 : PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  // qa-r1: LOD1 (3–8 m on high, the most common face distance) 26 × 18 with the rows gathered in the face band, like
  // LOD0 — at 18 × 12 the nose, brow and cheeks were a few flat facets (a wedge nose on a mannequin)
  const nu = L3(lod, 48, 26, 8), nv = L3(lod, 36, 18, 5);
  // a bearded man's face (the adult men's rigs): the face shader paints the beard's shadow above its line (the uv's
  // v carries −20 on the front: material.js pat 19/25)
  const bearded = !H.fem && !H.young;
  const { hs, f } = H;
  const sk = (l, x, y, sx, sy) => g2(l.x, l.y, x * hs, y, sx * hs, sy * hs) + g2(l.x, l.y, -x * hs, y, sx * hs, sy * hs);
  B.ellipsoid(H.C, H.r, {
    nu, nv, bone: hb,
    phiMap: lod === 0 ? phiFace(1.5) : lod === 1 ? phiFace(1.35) : null,
    thMap: lod <= 1 ? thFace : null,
    deform: lod >= 2 ? (l) => { l.x *= 1 - 0.2 * smooth(-0.1, -0.85, l.y / H.r[1]); return l; } : shape,
    uvFn: (q) => [q.x / hs, q.y / hs + (q.z > 0.004 ? 10 : bearded ? -20 : 0)],
    // ambient occlusion: the eye sockets, the crease of the upper lid under the brow, beside the nose, the nasolabial
    // folds and under the lower lip a touch darker (only on the front)
    shade: lod <= 1 ? (l) => (l.z < 0 ? 1 - 0.17 * sk(l, 0.031, f.eyeY, 0.014, 0.01) - 0.1 * sk(l, 0.03, f.eyeY + 0.0095 * hs, 0.012, 0.0035)
      - 0.08 * sk(l, 0.012, f.eyeY - 0.012 * hs, 0.004, 0.012) - (H.young ? 0 : 0.07) * sk(l, 0.024, f.mouthY + 0.012 * hs, 0.004, 0.012)
      - 0.1 * g2(l.x, l.y, 0, f.mouthY - 0.011 * hs, 0.012 * hs, 0.0035 * hs) - 0.12 * g2(l.x, l.y, 0, f.nTip - 0.006 * hs, 0.012 * hs, 0.0035 * hs) : 1) : null,
  });
  if (lod === 0) eyes(B, rig, H);
  if (lod <= 1 && o.ears !== false) ears(B, rig, lod, H);
  const nk = R(rig, 'neck');
  const nr = rig.dims.neckR;
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  if (lod >= 3 || o.neck === false) { B.morph = null; return H; } // far silhouette: the collar meets the head
  // the neck flares into the trapezius at its root and is fuller at the back than the front; qa-r2: it tapers to the
  // jaw, the sternocleidomastoids run as two cords from the notch above the breastbone up and back to behind the ears,
  // the larynx stands out in front (a man's Adam's apple) — a plain tube read as a mannequin's post
  const top = V(0, H.C.y - 0.07 * H.hs, H.C.z + 0.018 * H.hs);
  const nRing = (u) => {
    const R4 = [[0, 1.45, 1.2], [0.25, 1.2, 1.06], [0.45, 1.05, 1.0], [0.75, 0.96, 0.97], [1, 0.95, 1.02]];   // [u, rx, rz] × neck radius
    let i = 0;
    while (i < R4.length - 2 && u > R4[i + 1][0]) i++;
    const [u0, x0, z0] = R4[i], [u1, x1, z1] = R4[i + 1], t = clamp((u - u0) / (u1 - u0));
    const y = u <= 0.45 ? lerp(nk.y - 0.045, nk.y + 0.03, u / 0.45) : lerp(nk.y + 0.03, top.y, (u - 0.45) / 0.55);
    const z = u <= 0.45 ? lerp(nk.z + 0.004, nk.z - 0.002, u / 0.45) : lerp(nk.z - 0.002, top.z, (u - 0.45) / 0.55);
    return { c: V(0, y, z), rx: nr * lerp(x0, x1, t), rz: nr * lerp(z0, z1, t), u };
  };
  const nUs = lod === 0 ? [0, 0.14, 0.27, 0.4, 0.52, 0.64, 0.78, 0.9, 1] : lod === 1 ? [0, 0.25, 0.45, 0.62, 0.8, 1] : [0, 0.25, 0.45, 0.75, 1];
  const neckRings = nUs.map(nRing);
  const man = !H.fem && !H.young;
  const FRONT = Math.PI * 1.5;
  const dAng = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
  const scm = (th, u) => {
    const off = lerp(0.3, 1.3, u), env = smooth(0.02, 0.2, u) * (1 - smooth(0.82, 1, u));
    return env * (Math.exp(-((dAng(th, FRONT + off) / 0.2) ** 2)) + Math.exp(-((dAng(th, FRONT - off) / 0.2) ** 2)));
  };
  const larynx = (th, u) => Math.exp(-((dAng(th, FRONT) / 0.17) ** 2)) * Math.exp(-(((u - 0.52) / 0.11) ** 2));
  const notch = (th, u) => Math.exp(-((dAng(th, FRONT) / 0.28) ** 2)) * (1 - smooth(0, 0.22, u));
  B.tube(neckRings, { seg: L3(lod, 24, 12, 5), weights: (p) => envelope(rig, p, { chest: 0.6, neck: 1, head: 0.8 }, 4),
    radial: lod <= 1 ? (th, j, Rg) => {
      const u = Rg.u;
      return 1 + 0.05 * Math.max(0, Math.sin(th)) ** 2                    // the fuller nape
        + (lod === 0 ? 0.055 : 0.035) * scm(th, u) + (man ? 0.075 : 0.02) * larynx(th, u) - 0.05 * notch(th, u);
    } : null,
    // the shadow under the jaw (front, top), the hollows beside the cords a touch darker, the notch darker
    shade: lod <= 1 ? (th, j) => {
      const u = neckRings[j].u;
      return (u >= 0.7 ? 0.8 + 0.2 * Math.max(0, Math.sin(th)) : 1) * (1 + 0.05 * scm(th, u)) * (1 - 0.12 * notch(th, u));
    } : null,
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
    // (qa-r2: a little rougher — the lids' sheen read as glass beads in the sun)
    B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.62, metal: 0, color: [1, 1, 1], grp: 0 });
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
        // (qa-r2: the outer rows sink further under the socket's skin — the lids stood out of the face as puffy shells)
        const rr = rl * (j === 0 ? 0.992 : 1.0 + 0.008 * (j === 1 ? 1 : 0)) * (1 - 0.06 * smooth(0.35, 1, k)) * (1 - 0.02 * smooth(1.2, 1.48, Math.abs(a)));
        const shade = j === 0 ? (upper ? 0.3 : 0.7) : j === 1 ? (upper ? 0.72 : 0.92) : 0.96;
        return { p: pt(a, b, rr), u: a * 0.012, v: b * 0.012, w: hb, shade };
      }, { inside: c });
    }
    // qa-r2: the upper lashes — a dark band along the upper lid's margin, standing a little forward and up, thicker toward
    // the outer corner (the lid line that frames the eye at conversation distance)
    B.set({ cls: CLS.HAIR, pat: PAT.NONE, rough: 0.7, metal: 0, color: [1, 1, 1], grp: 0 });
    B.grid(12, 1, (i, j) => {
      const a = lerp(-1.25, 1.3, i / 12);
      const w = 0.035 + 0.03 * smooth(-0.6, 1.2, a);
      return { p: pt(a, marginU(a) + (j ? -w : 0.03), rl * (j ? 1.09 : 1.004)), u: a * 0.012, v: j * 0.002, w: hb, shade: 0.26 };
    }, { inside: c });
  }
}

/** ears: a cupped shell with a rolled rim (helix), angled off the head */
function ears(B, rig, lod, H) {
  const hb = rig.index.head;
  for (const sg of [-1, 1]) {
    // (gate-people: LOD1 lies closer to the head — 0.26 rad off it, its root sunk 2 mm further in — with the hollowed concha
    // and rolled helix of LOD0 and a thinner rim: a plain ellipsoid stood off the head as a disc, worst on low, where LOD1 is
    // drawn from 3 m)
    const yaw = lod ? 0.26 : 0.38;
    const m = new Matrix4().makeRotationY(sg * yaw).multiply(new Matrix4().makeRotationZ(-sg * 0.08));
    // (qa-r2: warmer than the face — thin skin over the cartilage, blood close under it)
    // (gate-people-r2: redder — [1.05, 0.95, 0.92] barely parted them from the face)
    B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1.1, 0.92, 0.88], grp: 0 });
    const er = [(lod ? 0.008 : 0.0095) * H.hs, 0.029 * H.hs, 0.017 * H.hs];
    B.ellipsoid(H.C.clone().add(V(sg * H.r[0] * (lod ? 0.95 : 0.97), H.f.eyeY - 0.014 * H.hs, 0.012 * H.hs)), er, {
      nu: lod ? 9 : 11, nv: lod ? 6 : 7, bone: hb, xf: m,
      deform: (l) => {
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
  if (B.noHead) return;
  const shape = headShape(H);
  const hb = rig.index.head;
  B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.7, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  // (gate-people: LOD1 20 × 6, was 12 × 5 — the cap carries its locks in the geometry, since on low no shell is drawn there;
  // gate-people-r2: 28 × 8 where it shows, to carry the locks' tones along the fall)
  const nu = L3(lod, 32, o.covered ? 20 : 28, 6), nv = L3(lod, 11, o.covered ? 6 : 8, 3);
  const front = Math.acos(clamp((H.f.eyeY + (o.hairline ?? 0.05) * H.hs) / H.r[1], -1, 1));
  const side = Math.acos(clamp((H.f.eyeY + 0.014 * H.hs) / H.r[1], -1, 1));
  const back = Math.acos(clamp((o.long ? H.f.mouthY - 0.02 * H.hs : H.f.mouthY + 0.008 * H.hs) / H.r[1], -1, 1));
  const vol = 0.0065 * H.hs + (o.volume || 0);
  const wild = o.wild ?? 1;   // > 1: uncombed, unkempt locks (the metzora - Vayikra 13:45)
  // locks break the outline (qa-r1: at LOD1 too, and calm at the crown, where they drew a point)
  // gate-people-r2: lumps of hair, not a ruled cap — irregular clumps (value noise over azimuth and fall, seeded per head)
  // lift the cap by up to 1.5 × its volume and sink it to half between them, calm at the crown; with the old product of two
  // sines the outline was a smooth dome
  const hseed = 1.7 + (o.hairline ?? 0.05) * 13 + (o.long ? 0.3 : 0);
  const lump = (phi, th) => vnoise2(phi * 20 / (2 * Math.PI), th * 7 + hseed * 2, 20) * 0.65 + vnoise2(phi * 47 / (2 * Math.PI), th * 15 - hseed, 47) * 0.35;
  // (at most 1.5 × the volume, ≈ 1 cm: a head-cloth lies 1.2 cm off the head, and the hair stays under it)
  const lock = lod <= 1 ? (phi, th) => clamp(1 + 1.6 * Math.min(wild, 1.3) * (lump(phi, th) - 0.45) * smooth(0.12, 0.5, th), 0.45, 1.5) : () => 1;
  // gate-people: the locks' light and dark in the vertex colour too, along the hair's fall, darker between the lumps: the
  // low tier's LOD1 draws no hair pattern. gate-people-r2: from the lumps, not a regular wave (19 streaks round the head
  // read as the ruled lines of a beanie)
  // (and a finer noise drawn out along the fall — locks and their partings — strongest where the hair falls, calm at the
  // whorl: on low the cap's vertex colour is all the hair there is)
  const streak = lod <= 1 ? (phi, th) => {
    const fall = smooth(0.08, 0.4, th);
    return 0.8 + (0.3 * lump(phi, th) + 0.36 * (vnoise2(phi * 64 / (2 * Math.PI), th * 2.5 + hseed, 64) - 0.5)) * fall + 0.1 * (1 - fall);
  } : () => 1;
  // the hairline (polar angle from the crown at azimuth phi): the temples recede a little; qa-r2: it wavers irregularly
  // (three incommensurate waves, the phase per head) — one regular wave read as a scalloped cap
  const jit = lod <= 1 ? prng(1.7 + (o.hairline ?? 0.05) * 13 + (o.long ? 0.3 : 0)) : null;
  const jp = jit ? [jit() * 6.28, jit() * 6.28, jit() * 6.28] : null;
  const hairEdge = (phi) => {
    const c = Math.cos(phi);
    return (c > 0 ? lerp(side, front, c ** 1.5) : lerp(side, back, (-c) ** 0.8) + 0.06 * Math.max(0, -c) ** 3)
      + (jp ? 0.014 * Math.sin(phi * 11 + jp[0]) + (lod === 0 ? 0.009 * Math.sin(phi * 23 + jp[1]) + 0.006 * Math.sin(phi * 37 + jp[2]) : 0) : 0);
  };
  const capAt = (i, j, nU, nV, off) => {
    const phi = (i / nU) * Math.PI * 2;
    // an irregular hairline: temples recede a little, the line itself wavers
    // (qa-r1: the nape's hairline dips toward the middle — a straight cut round the back read as a bowl)
    const lb = hairEdge(phi);
    const th = Math.max(0.03, (j / nV) * lb);
    const y = Math.cos(th) * H.r[1];
    const S = headSurf(H, shape, phi, y);
    const n = S.clone().setY(S.y * 0.4).normalize();
    const edge = j === nV ? 0.25 : 1;
    // the hairline thins out: lighter (skin shows through) over the last two rows (qa-r1)
    const shade = (j === nV ? 1.38 : j === nV - 1 ? 1.12 : 1) * streak(phi, th);
    return { p: S.addScaledVector(n, off * edge * lock(phi, th)).add(H.C), u: phi * 0.09, v: -th * 0.1, th, phi, shade };
  };
  if (o.napeOnly) {
    // the short hair from the cap's back edge down to the nape (below the occiput, about the earlobes' bottom), behind
    // the ears: a covered cap ends at the mouth's level behind, which bare showed a bowl above a post of a neck
    const backN = Math.acos(clamp((H.f.mouthY - 0.016 * H.hs) / H.r[1], -1, 1));
    const nU = L3(lod, 16, 8, 4), nV = L3(lod, 4, 2, 1);
    const ph0 = Math.PI * 0.74, ph1 = Math.PI * 1.26;           // behind the ears the skull curves in: there it would lift off
    B.grid(nU, nV, (i, j) => {
      const phi = lerp(ph0, ph1, i / nU), c = Math.cos(phi);
      const w = (-c) ** 0.8;
      const fade = smooth(0.68, 0.95, -c);                      // thinning out toward behind the ears
      const lb = lerp(side, back, w), lbN = lerp(side, backN, w) + (lod === 0 ? 0.015 * Math.sin(phi * 13) : 0);
      const th = lerp(lb - 0.04, lerp(lb, Math.max(lb, lbN), fade), j / nV);
      const y = Math.cos(th) * H.r[1];
      const S = headSurf(H, shape, phi, y);
      const n = S.clone().setY(S.y * 0.4).normalize();
      const off = vol * (j === nV ? 0.22 : 0.85) * (0.4 + 0.6 * fade) * lock(phi, th);
      return { p: S.addScaledVector(n, off).add(H.C), u: phi * 0.09, v: -th * 0.1, w: hb };
    }, { inside: H.C });
    return;
  }
  if (!o.shellsOnly) B.grid(nu, nv, (i, j) => { const q = capAt(i, j, nu, nv, vol); return { p: q.p, u: q.u, v: q.v, w: hb, shade: o.covered ? 1 : q.shade }; }, { wrap: true, inside: H.C });
  // strand shells: a soft, broken outline instead of a helmet — qa-r2: three at LOD0 and one at LOD1 (their clumps now
  // hold out to ~6 m: material.js pattern 23), and a fringe over the hairline
  if (lod <= 1 && (!o.covered || o.shellsOnly) && !(lod === 1 && o.shellsOnly)) {
    // (the LOD1 shell and fringe keep the 12 × 5 grid: they are alpha-tested strands, and the cap under them has the locks)
    const nuS = lod === 1 ? 12 : nu, nvS = lod === 1 ? 5 : nv;
    // (gate-people-r2: the shells of grown hair stand up to 1.3 cm off the head, through a head-cloth 1.2 cm off it — dark
    // specks on the cloth's crown: group HAIR_OPEN, hidden under one; a bare kohen's shells stay in his BARE group)
    const shellGrp = o.shellsOnly ? o.grp || 0 : GRP.HAIR_OPEN;
    for (const t of lod === 0 ? [0.34, 0.67, 1] : [0.6]) {
      B.set({ cls: CLS.HAIR, pat: PAT.HAIR_SHELL, rough: 0.6, metal: t, color: [1.06 + 0.06 * t, 1.06 + 0.06 * t, 1.06 + 0.06 * t], grp: shellGrp });
      B.grid(nuS, nvS, (i, j) => { const q = capAt(i, j, nuS, nvS, vol + 0.0062 * t); return { p: q.p, u: q.u, v: q.v, w: hb }; }, { wrap: true, inside: H.C });
    }
    // the fringe: from a little inside the hairline to ~6 mm past it the hair thins out strand by strand over the skin
    // (alpha-tested like a shell, sparser toward its edge, close to the skin) — the cap's edge was one hard line
    const nF = L3(lod, 3, 2, 1), uF = Math.round(nuS * 0.7);
    B.grid(uF, nF, (i, j) => {
      const phi = lerp(-2.2, 2.2, i / uF);             // the forehead, temples and sides (the nape's edge is in shadow)
      const k = j / nF;
      const th = Math.max(0.03, hairEdge(phi) - 0.05 + 0.11 * k);
      const y = Math.cos(th) * H.r[1];
      const S = headSurf(H, shape, phi, y);
      const n = S.clone().setY(S.y * 0.4).normalize();
      // short strands (v × 4: the hairs at the line are short and grow back over the scalp, not hanging locks), lighter
      // toward the edge where the skin shows between them
      return { p: S.addScaledVector(n, lerp(vol * 0.5, 0.0006 * H.hs, k)).add(H.C), u: phi * 0.09, v: -th * 0.4, w: hb, shade: lerp(1.05, 1.32, k) };
    }, { inside: H.C });
    // its layer index rides in the metalness channel (pattern 23: denser at the cap, sparse at the edge)
    const v0 = B.count - (uF + 1) * (nF + 1);
    for (let j = 0; j <= nF; j++) for (let i = 0; i <= uF; i++) {
      const vi = v0 + j * (uF + 1) + i;
      B.mat[vi * 4] = 0.6; B.mat[vi * 4 + 1] = lerp(0.45, 1, j / nF); B.mat[vi * 4 + 2] = PAT.HAIR_SHELL; B.mat[vi * 4 + 3] = CLS.HAIR + 8 * (o.grp || 0);
    }
    // gate-people: tufts — small alpha-tested patches of strands from inside the cap's edge running past the hairline and
    // standing a little off the head, longer over the ears and at the nape (where the hair grows over), short and close on
    // the forehead: the cap's outline breaks into locks instead of the line of a beanie. 26 at LOD0, 12 at LOD1, seeded per
    // hairline; sparser toward their tips (metalness channel, as the fringe)
    if (!o.shellsOnly) {
      const nT = lod === 0 ? 26 : 12;
      const rT = prng(4.1 + (o.hairline ?? 0.05) * 7 + (o.long ? 0.5 : 0));
      for (let q = 0; q < nT; q++) {
        const phi = lerp(-2.95, 2.95, (q + 0.5) / nT) + (rT() - 0.5) * 0.14;
        const fk = smooth(0.25, 0.9, Math.cos(phi));                 // 1 on the forehead … 0 at the sides and back
        const lb = hairEdge(phi), past = lerp(0.17, 0.045, fk) * (0.7 + 0.6 * rT()), from = lb - 0.15;
        const dphi = lerp(0.24, 0.15, fk) * (0.8 + 0.4 * rT());
        const t0 = B.count;
        B.set({ cls: CLS.HAIR, pat: PAT.HAIR_SHELL, rough: 0.6, metal: 0.6, color: [1.08, 1.08, 1.08], grp: o.grp || 0 });
        B.grid(2, 3, (i, j) => {
          const k = j / 3;
          const ph = phi + (i / 2 - 0.5) * dphi * (1 - 0.4 * k);
          const th = Math.max(0.03, lerp(from, lb + past, k));
          const y = Math.cos(th) * H.r[1];
          const S = headSurf(H, shape, ph, y);
          const n = S.clone().setY(S.y * 0.4).normalize();
          const off = vol * lerp(0.95, 0.45, fk * k) + 0.0035 * H.hs * k * (1 - 0.7 * fk) + 0.0008;
          return { p: S.addScaledVector(n, off).add(H.C), u: ph * 0.09, v: -th * 0.1, w: hb, shade: lerp(1.0, 1.15, k) };
        }, { inside: H.C });
        for (let vi = t0; vi < B.count; vi++) B.mat[vi * 4 + 1] = lerp(0.5, 0.95, Math.floor((vi - t0) / 3) / 3);
      }
      // gate-people-r2: and over the crown and temples — longer locks lying along the hair's fall from the whorl, their tips
      // lifting off the cap (≈ 2.5–4 cm long, up to ~1.2 cm proud), so the dome's outline breaks into locks where it meets
      // the sky (the hairline tufts alone left a smooth cap above them). 22 at LOD0, 12 at LOD1; alpha-tested (pattern 23:
      // sparse toward the tips; none on low, where the lumped cap carries the outline)
      const nC = lod === 0 ? 22 : 12;
      const rC = prng(7.3 + (o.hairline ?? 0.05) * 5 + (o.long ? 0.7 : 0));
      for (let q = 0; q < nC; q++) {
        const phi = (q / nC) * Math.PI * 2 + (rC() - 0.5) * 0.5;
        const lb = hairEdge(phi);
        const th0 = lerp(0.12, Math.max(0.2, lb - 0.45), rC()), len = (0.26 + 0.14 * rC()) * (Math.cos(phi) > 0.6 ? 0.75 : 1);
        const th1 = Math.min(th0 + len, lb - 0.04), dphi = 0.22 + 0.12 * rC(), lift = (0.004 + 0.0045 * rC()) * H.hs;
        const t0 = B.count;
        B.set({ cls: CLS.HAIR, pat: PAT.HAIR_SHELL, rough: 0.6, metal: 0.6, color: [1.04, 1.04, 1.04], grp: GRP.HAIR_OPEN });
        B.grid(2, 3, (i, j) => {
          const k = j / 3;
          const ph = phi + (i / 2 - 0.5) * dphi * (1 - 0.35 * k) / Math.max(0.35, Math.sin(lerp(th0, th1, k)));
          const th = lerp(th0, th1, k);
          const y = Math.cos(th) * H.r[1];
          const S = headSurf(H, shape, ph, y);
          const n = S.clone().setY(S.y * 0.4).normalize();
          const off = vol * lock(ph, th) + 0.0015 * H.hs + lift * k * k;
          return { p: S.addScaledVector(n, off).add(H.C), u: ph * 0.09, v: -th * 0.1, w: hb, shade: lerp(0.95, 1.12, k) };
        }, { inside: H.C });
        for (let vi = t0; vi < B.count; vi++) B.mat[vi * 4 + 1] = lerp(0.45, 0.9, Math.floor((vi - t0) / 3) / 3);
      }
    }
  }
  if (o.long && !o.shellsOnly) {
    B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.7, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
    const sh = R(rig, 'uarm_r');
    const rings = [];
    const n = lod === 0 ? 6 : 4;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const y = lerp(H.C.y + H.f.mouthY + 0.01, sh.y + 0.0, t);
      rings.push({ c: V(0, y, H.C.z + lerp(0.01, 0.035, t)), rx: lerp(H.r[0] * 0.98, rig.dims.shX * 0.78, t), rz: lerp(H.r[2] * 0.86, rig.dims.chest[1] * 1.1, t) });
    }
    const longHair = {
      seg: L3(lod, 18, 8, 4), arc: [0.12, Math.PI - 0.12],
      weights: (p) => envelope(rig, p, { head: 1, neck: 0.9, chest: 0.5 }, 3),
      radial: wild > 1
        // unkempt: uneven locks, but held to the mass (≤ ±9 %), calm toward the sheet's side edges and the edges tucked in
        // to the neck and shoulders - seen from the front a free edge stood off beside the neck as a shard (people-4-fix)
        ? (th, j) => {
          const win = smooth(0.12, 0.7, th) * smooth(Math.PI - 0.12, Math.PI - 0.7, th);
          return (1 - 0.24 * (1 - win)) * (1 + (j ? Math.min(1, j / 2) * win * (0.055 * Math.sin(th * 11) + 0.035 * Math.sin(th * 23 + j * 2.3)) : 0));
        }
        : (th, j) => 1 + (j ? 0.06 * wild * Math.sin(th * 11) * Math.min(1, j / 2) : 0),
    };
    B.tube(rings, longHair);
    // unkempt hair is a mass, not a sheet: its inner face too (from the front a sheet showed only as its edge)
    if (wild > 1 && lod <= 1) B.tube(rings.map((q) => ({ ...q, rx: q.rx * 0.965, rz: q.rz * 0.965 })), { ...longHair, invert: true, shade: () => 0.72 });
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

// the beard's line on the face (qa-r1): from under the lower lip, out along the cheek, up in front of the ear as the
// sideburn to the scalp hair's edge (the hair cap's side hairline is at eyeY + 0.014 hs). a = 0 at the chin … 1 at the
// sideburn (azimuth a·BEARD_PHI). The face shader (material.js, pattern 19/25) paints the beard's shadow above this
// line with the same numbers in units of hs (keep in step).
const BEARD_PHI = 1.45;
function beardTop(H, aa) {
  const { f, hs } = H;
  if (aa < 0.28) return lerp(f.mouthY - 0.009 * hs, f.mouthY, smooth(0.08, 0.28, aa));
  const cheek = lerp(f.mouthY, f.eyeY - 0.016 * hs, smooth(0.28, 0.86, aa) ** 0.85);
  return lerp(cheek, f.eyeY + 0.03 * hs, smooth(0.8, 1, aa));
}

/** full beard (and moustache): jaw line from the sideburns to below the lower lip; len = fall below the chin.
 *  A volume, not a decal: it thickens from nothing at its edges (so it grows out of the skin) to ~1.3 cm,
 *  its lower edge is closed back to the throat, and its outline is broken into soft locks; LOD0 adds strand
 *  shells so its edge is soft. Men did not shave the corners of the beard (Vayikra 19:27). */
export function beard(B, rig, lod, H, o = {}) {
  if (B.noHead) return;
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
  // qa-r1: the beard runs up in front of the ear as the sideburn and joins the scalp hair (its top at the sides reaches
  // over the hair cap's edge: beardTop), it ends in front of the ear (BEARD_PHI), not behind it; its fringe — the
  // cheek line, the sideburn and the lower edge — is lighter than its dense body (thinner hair: skin shows through), and
  // the body darker in the hollows between locks. (Before: a dark shell from the mouth to behind the ear with a hard
  // straight top edge and a gap to the hair — at 3–15 m it read as a cloth mask.)
  const prof = (a, b, extra = 0) => {
    const aa = Math.abs(a);
    // its back edge: the sideburn in front of the ear, then back along the jaw's angle below the ear
    const phi = a * (BEARD_PHI + 0.3 * smooth(0.45, 1, b));
    const yTop = beardTop(H, aa);
    // the lower edge: fuller and a little pointed under the chin, broken into uneven locks (no straight cut)
    const yBot = lerp(chinY - len * (1 + 0.22 * (1 - aa * aa)), f.mouthY - 0.038 * hs, smooth(0.5, 1, aa))
      - (lod <= 1 ? (0.0045 * Math.sin(a * 21 + 0.7) + 0.003 * Math.sin(a * 47 + 2.1)) * hs * (1 - smooth(0.6, 1, aa)) * (lod ? 0.6 : 1) : 0);
    const y = lerp(yTop, yBot, b);
    // the sideburn is thinner than the jaw's beard and thins to the skin at its back edge; the cheek line grows in over
    // its first fifth (an edge standing off the skin read as the strap of a mask)
    const edge = smooth(0, 0.3, b) * (1 - 0.6 * smooth(0.65, 0.9, aa)) * (1 - 0.85 * smooth(0.78, 1, aa));
    const t = ((0.0008 + 0.0125 * edge) * hs + vol * b) * locks(a, b) + extra * edge;
    const fringe = Math.max(1 - smooth(0, 0.22, b), smooth(0.8, 1, b) * 0.7, smooth(0.85, 1, aa) * 0.6);
    const lockShade = lod <= 1 ? 0.06 * Math.sin(a * 23 + 1.7) * Math.sin(b * 5 + a * 3) : 0;
    return { phi, y, t, hang: len, shade: 0.9 + 0.32 * fringe + lockShade };
  };
  const nu = L3(lod, 30, 16, 6), nv = L3(lod, 10, 6, 2);
  faceShell(B, H, shape, nu, nv, (a, b) => prof(a, b), W);
  if (lod <= 1) { // strand shells for a soft edge — qa-r2: three at LOD0, one at LOD1 (their clumps hold out to ~6 m)
    for (const t of lod === 0 ? [0.34, 0.67, 1] : [0.6]) {
      B.set({ cls: CLS.HAIR, pat: PAT.HAIR_SHELL, rough: 0.7, metal: t, color: [1.05 + 0.05 * t, 1.05 + 0.05 * t, 1.05 + 0.05 * t], grp: o.grp || 0 });
      faceShell(B, H, shape, nu, nv, (a, b) => prof(a, b, 0.0042 * t * hs), W);
    }
    // gate-people: tufts along the beard's lower edge, hanging a little past it (its locks' tips), and along the cheek line
    // growing in from it: alpha-tested like the shells, so the edge is broken into locks, not the outline of a mask
    const rB = prng(2.3 + len * 40);
    const nB = lod === 0 ? 18 : 10;
    for (let q = 0; q < nB; q++) {
      const a = lerp(-0.94, 0.94, (q + 0.5) / nB) + (rB() - 0.5) * 0.06, da = 0.07 + 0.05 * rB();
      const cheek = q % 3 === 2 && Math.abs(a) > 0.3;               // a third of them (off the chin) at the cheek line
      const bA = cheek ? -0.08 : 0.8, bB = cheek ? 0.16 : 1.1 + 0.12 * rB();
      const t0 = B.count;
      B.set({ cls: CLS.HAIR, pat: PAT.HAIR_SHELL, rough: 0.7, metal: 0.6, color: [1.08, 1.08, 1.08], grp: o.grp || 0 });
      faceShell(B, H, shape, 2, 2, (aa, bb) => prof(a + aa * da, lerp(bA, bB, bb), (cheek ? 0.0015 : 0.0035) * hs), W);
      for (let vi = t0; vi < B.count; vi++) B.mat[vi * 4 + 1] = cheek ? lerp(0.95, 0.6, Math.floor((vi - t0) / 3) / 2) : lerp(0.55, 0.95, Math.floor((vi - t0) / 3) / 2);
    }
    B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.75, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  }
  // underside: from the beard's lower edge back to the throat, so the beard is a closed volume from below/behind
  if (lod < 3) {
    const nk = R(rig, 'neck'), nr = rig.dims.neckR;
    const uw = L3(lod, 18, 10, 4);
    B.grid(uw, 2, (i, j) => {
      const a = lerp(-0.9, 0.9, i / uw);
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
    faceShell(B, H, shape, L3(lod, 16, 8, 2), L3(lod, 3, 2, 1), (a, b) => {
      const aa = Math.abs(a);
      const phi = a * 0.52;
      // parted under the philtrum (thinner and a touch higher at the middle), drooping past the mouth's corners
      const yTop = lerp(f.nTip - 0.0075 * hs, f.mouthY + 0.004 * hs, smooth(0.3, 1, aa)) - 0.0015 * hs * (1 - smooth(0, 0.18, aa));
      const yBot = lerp(f.mouthY + 0.0028 * hs, f.mouthY - 0.008 * hs, smooth(0.45, 1, aa)) + 0.0012 * hs * (1 - smooth(0, 0.16, aa));
      const part = 0.55 + 0.45 * smooth(0.04, 0.2, aa);
      return { phi, y: lerp(yTop, yBot, b), t: (0.0012 + 0.0055 * part * Math.sin(Math.PI * Math.min(1, b * 1.3))) * hs + vol * 0.3, hang: 0,
        shade: 0.92 + 0.26 * Math.max(1 - smooth(0, 0.35, b), smooth(0.75, 1, b)) };
    }, () => [[hb, 1]]);
  }
  B.morph = null;
}

/**
 * The scalp shaved with a razor, shown instead of the hair (mask group SHAVEN; Actor.setShaven): a skin shell just over
 * the skull within the hairline - paler than the face (long under the hair) with the faint cool grey of the cut
 * stubble, fading out at its edge into the forehead and nape. The nazir at the end of his term (Bamidbar 6:18; Nazir
 * 6:8; his chamber, Middot 2:5), the metzora on his seventh day (Vayikra 14:9).
 */
export function shavenScalp(B, rig, lod, H, o = {}) {
  if (B.noHead || lod >= 3) return;
  const shape = headShape(H);
  const hb = rig.index.head;
  const nu = L3(lod, 28, 12, 6), nv = L3(lod, 7, 4, 2);
  const front = Math.acos(clamp((H.f.eyeY + (o.hairline ?? 0.05) * H.hs) / H.r[1], -1, 1));
  const side = Math.acos(clamp((H.f.eyeY + 0.014 * H.hs) / H.r[1], -1, 1));
  const back = Math.acos(clamp((H.f.mouthY + 0.008 * H.hs) / H.r[1], -1, 1));
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.52, metal: 0, color: [1, 1, 1], grp: o.grp ?? GRP.SHAVEN });
  B.grid(nu, nv, (i, j) => {
    const phi = (i / nu) * Math.PI * 2, c = Math.cos(phi);
    const lb = c > 0 ? lerp(side, front, c ** 1.5) : lerp(side, back, (-c) ** 0.8);
    const th = Math.max(0.03, (j / nv) * lb);
    const y = Math.cos(th) * H.r[1];
    const S = headSurf(H, shape, phi, y);
    const n = S.clone().setY(S.y * 0.4).normalize();
    const e = 1 - smooth(0.55, 1, j / nv);                        // 1 inside, 0 at the hairline
    const p = S.addScaledVector(n, 0.0007 * H.hs * (0.25 + 0.75 * e)).add(H.C);
    return { p, u: phi * 0.09, v: -th * 0.1, w: hb, col: [lerp(1, 1.05, e), lerp(1, 1.035, e), lerp(1, 1.075, e)] };
  }, { wrap: true, inside: H.C });
}

/** the beard shaved off (mask group SHAVEN_FACE): a skin shell over the jaw and chin within the beard's line, a touch
 *  darker with the stubble's shadow, fading at its edge (the metzora's seventh day: "all his hair: his head, his beard
 *  and his eyebrows", Vayikra 14:9 - the brows are taken off in the face shader by the same mask bit) */
export function shavenFace(B, rig, lod, H, o = {}) {
  if (B.noHead || lod >= 2) return;
  const shape = headShape(H);
  const hb = rig.index.head;
  const { f, hs } = H;
  const chinY = f.chinY - 0.004 * hs;
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.5, metal: 0, color: [0.97, 0.965, 0.975], grp: o.grp ?? GRP.SHAVEN_FACE });
  faceShell(B, H, shape, L3(lod, 22, 10, 6), L3(lod, 5, 3, 2), (a, b) => {
    const aa = Math.abs(a);
    const phi = a * 1.78;
    const yTop = aa < 0.28 ? lerp(f.mouthY - 0.009 * hs, f.mouthY, smooth(0.08, 0.28, aa)) : lerp(f.mouthY, f.eyeY - 0.014 * hs, smooth(0.28, 1.0, aa) ** 0.85);
    const yBot = lerp(chinY, f.mouthY - 0.038 * hs, smooth(0.5, 1, aa));
    const e = smooth(0, 0.3, b) * smooth(1, 0.7, b) * (1 - smooth(0.82, 1, aa));
    return { phi, y: lerp(yTop, yBot, b), t: 0.0005 * hs, hang: 0, shade: lerp(1.03, 0.96, e) };
  }, () => [[hb, 1]]);
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
 * as diagonal bands (uv carries their phase to the WOUND pattern: crisp lapped edges and their shadows).
 * qa-r2: the bands are modelled — each a WOUND_PITCH (≈ 3 cm) of the strip showing, five or six up the head: from the
 * edge of the winding that laps it the cloth rises (a rounded lip standing ~3 mm proud, casting its shadow on the band
 * below) and falls away again under the next; the lowest turn sags a little at the back and sides; the strip's end is
 * tucked under a winding at the back. Before: a smooth white dome with a faint stripe pattern.
 */
const WOUND_PITCH = 0.03;
function wound(B, rig, lod, H, prof, o = {}) {
  const hb = rig.index.head;
  B.set({ cls: o.cls ?? CLS.GA, pat: lod <= 1 ? PAT.WOUND : PAT.LINEN, rough: 0.86, metal: 0, color: o.color || [1, 1, 1], grp: o.grp || 0 });
  const rings = profileRings(H, prof, (o.base ?? 0.042) * H.hs, lod >= 3 ? 3 : L3(lod, 34, 11, 5), o.tall || 1);
  const pitch = WOUND_PITCH, k = o.slant ?? 1;   // per turn the band advances k pitches (diagonal windings)
  const n = rings.length;
  const yMax = rings[n - 1].yy;
  const phase = (th, j) => (rings[j].yy * H.hs + (th / (Math.PI * 2)) * pitch * k) / pitch;
  // the band's cross-profile over its phase f (0 = where it comes out from under the winding above … 1 = its lower lip
  // over the band below): the lip is rounded and stands proud, the cloth falls back toward the next winding
  const bandProf = (f) => (f > 0.88 ? 1 - smooth(0.88, 1, f) * 0.9 : smooth(0, 0.88, f) ** 0.8);
  const start = B.count;
  const seg = L3(lod, 40, 16, 7);
  B.tube(rings, {
    seg, bone: hb, capB: 'flat',
    radial: lod >= 2 ? null : (th, j) => {
      if (j === 0) return 1;
      const top = smooth(0.7 * yMax, yMax, rings[j].yy);
      const ph = phase(th, j);
      const f = 1 - (ph - Math.floor(ph));                              // the band's phase down its height (lip at 1)
      const band = lod === 0 ? bandProf(f) : Math.sin(Math.PI * f);
      return 1 + ((lod === 0 ? 0.034 : 0.02) * band - 0.012) * (1 - top) + 0.035 * top * Math.max(0, Math.sin(th * 9 + j)) ** 3;
    },
    // the lowest winding sags a little at the back and the sides (it carries the others' weight over the occiput)
    lift: lod >= 2 ? null : (th, j) => -0.005 * H.hs * (1 - smooth(0, 0.45 * pitch / H.hs, rings[j].yy)) * (0.35 + 0.65 * Math.max(0, Math.sin(th))),
    shade: lod >= 2 ? null : (th, j) => {
      const top = smooth(0.75 * yMax, yMax, rings[j].yy);
      const ph = phase(th, j), f = 1 - (ph - Math.floor(ph));
      // the shadow under each lip on the band below it
      const under = lod === 0 ? smooth(0.22, 0, f) * 0.22 : 0;
      return (1 - 0.1 * top * (1 - Math.max(0, Math.sin(th * 9 + j)) ** 3) - (j === 0 ? 0.12 : 0)) * (1 - under * (1 - top));
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
  // the strip's end, tucked under a winding behind (LOD0/1): a short tapering tongue lying on the band below it
  if (lod <= 1) {
    const jm = Math.round(n * 0.42), thE = Math.PI * 0.5 + 0.35;      // a little to one side of the back
    const R0 = rings[jm];
    const nT = lod === 0 ? 6 : 3;
    const tongue = B.count;
    B.grid(nT, 2, (i, jj) => {
      const t = i / nT;                                                 // 0 = under the winding … 1 = the end
      const w = (1 - 0.75 * t) * 0.022 * H.hs;                          // tapering
      const th = thE + (jj - 1) * w / Math.max(0.05, R0.rx);
      const y = R0.c.y - t * 0.032 * H.hs;
      const r = 1.04 + 0.012 * Math.sin(Math.PI * t);
      const p = V(Math.cos(th) * R0.rx * r, y, R0.c.z + Math.sin(th) * R0.rz * r);
      return { p, u: (th / (Math.PI * 2)) * pitch * k, v: rings[jm].yy * H.hs - t * 0.032, w: hb, shade: t < 0.15 ? 0.8 : 1 };
    }, { inside: V(0, R0.c.y, R0.c.z) });
    // (the tongue is plain linen: its own edges are the pattern)
    for (let v = tongue; v < B.count; v++) B.mat[v * 4 + 2] = PAT.LINEN;
  }
}

/** migba'at: the kohen hedyot's 16-amah linen winding, worn "like a hat" — a rounded dome (Rambam KhM 8:2) */
export function migbaat(B, rig, lod, H, o = {}) {
  wound(B, rig, lod, H, [
    [0.0, 1.08, 1.06], [0.02, 1.15, 1.12], [0.05, 1.18, 1.14], [0.08, 1.16, 1.12], [0.104, 1.08, 1.04],
    [0.122, 0.94, 0.9], [0.136, 0.74, 0.71], [0.146, 0.48, 0.46], [0.152, 0.12, 0.12],
  ], { base: 0.04, slant: 2, grp: o.grp });   // (slant: whole pitches per turn, so the windings meet at the seam)
}

/** mitznefet: the Kohen Gadol's turban, wound "like one who bandages a fracture" — lower, broader, the windings
 *  nearly level (Rambam KhM 8:2) */
export function mitznefet(B, rig, lod, H, o = {}) {
  wound(B, rig, lod, H, [
    [0.0, 1.13, 1.1], [0.02, 1.23, 1.17], [0.05, 1.27, 1.21], [0.078, 1.25, 1.19],
    [0.098, 1.15, 1.09], [0.11, 0.9, 0.86], [0.117, 0.45, 0.43], [0.12, 0.08, 0.08],
  ], { base: o.base ?? 0.068, cls: o.cls, color: o.color, slant: 1, grp: o.grp });
}

/** tzitz: gold band ear to ear on the forehead, techelet cord behind (Shemot 28:36–38) */
export function tzitz(B, rig, lod, H, o = {}) {
  const shape = headShape(H);
  const hb = rig.index.head;
  const { hs, f } = H;
  const y0 = f.eyeY + 0.021 * hs, y1 = f.eyeY + 0.058 * hs;
  B.set({ cls: CLS.FIX, pat: PAT.TZITZ, rough: 0.2, metal: 1, color: COL.gold, grp: o.grp || 0 });
  const nu = L3(lod, 24, 10, 6);
  B.grid(nu, 2, (i, j) => {
    const phi = lerp(-1.42, 1.42, i / nu);
    const y = lerp(y1, y0, j / 2);
    const S = headSurf(H, shape, phi, y);
    const n = S.clone().setY(0).normalize();
    S.addScaledVector(n, 0.0045 * hs).add(H.C);
    return { p: S, u: i / nu, v: j / 2, w: hb };
  }, { inside: H.C });
  B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.8, metal: 0, color: COL.techelet, grp: o.grp || 0 });
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
  if (o.grp && B.skipGrp?.has(o.grp)) return;
  const shape = headShape(H);
  const { hs, f } = H;
  const sh = R(rig, 'uarm_r'), ch = R(rig, 'chest'), nk = R(rig, 'neck');
  B.set({ cls: o.cls ?? CLS.GB, pat: o.pat ?? PAT.WOOL, rough: 0.9, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  const nu = L3(lod, 34, 14, 7);
  const nv = L3(lod, 16, 9, 4);
  const open = o.open ?? 0.95;
  const bottomBack = o.backY ?? (ch.y - 0.05);
  const yEndAt = (phi) => lerp(f.eyeY + 0.042 * hs, f.mouthY - 0.012 * hs, smooth(-0.3, 0.9, -Math.cos(phi)));
  // the cap follows the head; the hanging cloth hands over to the neck, collarbones and chest as it falls (qa-r1: weighted
  // to the head all the way down, the ends swung out with every turn of the head)
  const W = (t) => (q) => envelope(rig, q, { head: 1.0 - 0.75 * smooth(0.12, 0.65, t), neck: 0.8, chest: t > 0 ? 0.9 : 0.05, clav_l: 0.4 + 0.4 * t, clav_r: 0.4 + 0.4 * t }, 4);
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
  if (o.wrap) { wrapDrape(B, rig, lod, H, shape, { nu, nv, open, bottomBack, yEndAt, W, neckClear, torsoClear, folds }); return; }
  // the drape (qa-r1): wool hangs plumb from the cap's edge — at the sides of the face straight down past the jaw — until
  // it meets the neck, the trapezius and the shoulders, which it then lies on (neckClear / torsoClear push it out over
  // them); it widens only a little toward its foot, more behind. The ends at the front reach the collarbones even on the
  // short cloth. (Before, each column ran in a straight line from the cap to a point out on the shoulder tip, and the
  // short cloth stopped 8 cm above the shoulder: the front ends stood out from the temples like wings.)
  B.grid(nu, nv, (i, j) => {
    const phi = lerp(open, Math.PI * 2 - open, i / nu);
    const c = -Math.cos(phi);
    const k = j / nv;
    const top = headSurf(H, shape, phi, yEndAt(phi));
    top.addScaledVector(top.clone().setY(top.y * 0.3).normalize(), 0.02 * hs).add(H.C);
    const yB = lerp(sh.y + 0.03, bottomBack, smooth(-0.5, 1, c)) + (o.short ? 0.08 * smooth(-0.2, 0.6, c) - 0.03 * Math.max(0, -c) : 0);
    const y = lerp(top.y, yB, smooth(0, 1, k));
    const rTop = Math.hypot(top.x, top.z - H.C.z);
    const ang = Math.atan2(top.x, -(top.z - H.C.z));
    const kk = k * k * (1.4 - 0.4 * k);
    let r = rTop * (1 + (0.05 + 0.1 * Math.max(0, c)) * kk) * (1 + 0.03 * Math.sin(Math.PI * k)) * folds(phi, k);
    if (y > nk.y - 0.08 && y < nk.y + 0.12) r = Math.max(r, neckClear(y, c) + 0.002);
    if (k > 0) r = Math.max(r, torsoClear(y, ang));
    const p = V(Math.sin(ang) * r, y, H.C.z - Math.cos(ang) * r);
    // the edge framing the face is rolled; inner folds a touch darker
    const edge = Math.min(phi - open, Math.PI * 2 - open - phi);
    const shade = 1 - 0.12 * smooth(0.12, 0, edge) - (lod === 0 ? 0.08 * k * Math.max(0, 0.64 - Math.abs(Math.sin(phi * 4.5 + 0.7))) : 0);
    return { p, u: phi * 0.12, v: -0.2 - k * 0.5, w: W(k), shade };
  }, { inside: (A) => V(0, A.y, H.C.z) });
}

/**
 * The atifah (people-4-fix): the head-cloth wound round the head and the sides of the face down to the beard - "any
 * wrapping not like the Ishmaelites' is no wrapping; Rav Nachman showed it: up to the sides of the beard" (Moed Katan
 * 24a) - and a fold of it brought over the mouth ("al safam ya'teh", Vayikra 13:45; Rambam Avel 5:19). The mourner's;
 * the menudeh's by the same (reconstruction, Moed Katan 15a leaves it open). From under the cap's edge the cloth hugs
 * the head over the beard to the chin (no gap at the cap), then falls round the neck to the shoulders and back.
 */
function wrapDrape(B, rig, lod, H, shape, q) {
  const { hs, f } = H;
  const { nu, nv, open, bottomBack, yEndAt, W, neckClear, torsoClear, folds } = q;
  const sh = R(rig, 'uarm_r'), ch = R(rig, 'chest'), nk = R(rig, 'neck');
  const yC = f.chinY - 0.004 * hs;
  const off = (y) => lerp(0.016, 0.021, smooth(f.eyeY, f.mouthY, y)) * hs;    // clear of the hair, and of the beard below the cheekbones
  const hug = (phi, y) => { const S = headSurf(H, shape, phi, y); return S.addScaledVector(S.clone().setY(S.y * 0.3).normalize(), off(y)).add(H.C); };
  const kH = 0.45;
  B.grid(nu, nv, (i, j) => {
    const phi = lerp(open, Math.PI * 2 - open, i / nu), c = -Math.cos(phi), k = j / nv;
    let p;
    if (k <= kH) p = hug(phi, lerp(yEndAt(phi) + 0.01 * hs, yC, (k / kH) ** 0.9));   // from under the cap's edge
    else {
      const t = (k - kH) / (1 - kH), top = hug(phi, yC);
      const yB = lerp(sh.y + 0.03, bottomBack, smooth(-0.5, 1, c));
      const rx = rig.dims.shX + 0.04, rz = rig.dims.chest[1] + 0.035, front = Math.max(0, -c);
      const lowX = Math.sin(phi) * rx * (1 - 0.35 * front), lowZ = ch.z - Math.cos(phi) * rz + 0.01;
      const tt = t * t * (1.4 - 0.4 * t), y = lerp(top.y, yB, smooth(0, 1, t));
      const rTop = Math.hypot(top.x, top.z - H.C.z), rLow = Math.hypot(lowX, lowZ - H.C.z);
      let r = lerp(rTop, rLow, tt) * (1 + 0.04 * Math.sin(Math.PI * t)) * folds(phi, t);
      if (y > nk.y - 0.08 && y < nk.y + 0.12) r = Math.max(r, neckClear(y, c) + 0.002);
      const ang = Math.atan2(lerp(top.x, lowX, tt), -lerp(top.z - H.C.z, lowZ - H.C.z, tt));
      r = Math.max(r, torsoClear(y, ang));
      p = V(Math.sin(ang) * r, y, H.C.z - Math.cos(ang) * r);
    }
    const edge = Math.min(phi - open, Math.PI * 2 - open - phi);
    return { p, u: phi * 0.12, v: -0.2 - k * 0.5, w: W(k > kH ? 1 : 0), shade: 1 - 0.12 * smooth(0.12, 0, edge) };
  }, { inside: (A) => V(0, A.y, H.C.z) });
  // the fold over the mouth: from under the nose to the chin, its ends under the drape's edges, the edges rolled
  const hb = rig.index.head;
  faceShell(B, H, shape, L3(lod, 16, 8, 4), L3(lod, 3, 2, 1), (a, b) => ({
    phi: a * (open + 0.12), y: lerp(f.nTip - 0.01 * hs, f.chinY + 0.002 * hs, b),
    t: lerp(0.022, 0.016, smooth(0.75, 1, Math.abs(a))) * hs * (1 + (lod === 0 ? 0.05 * Math.sin(a * 9 + b * 3) : 0)), hang: 0,
    shade: Math.abs(b - 0.5) > 0.4 ? 0.86 : 1,
  }), () => [[hb, 1]]);
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
    // a long sleeve is cut full over the arm — the cloth stands off it — and closes to a hand's width at the wrist (Rambam
    // KhM 8:17); fuller than the arm by ~12 % above the elbow and ~10 % below (qa-r1: raised in the blessing, sleeves cut
    // to the arm's own girth read as sticks)
    const fu = 1.12, ff = 1.1;
    if (sleeve === 'wrist' && lod >= 3) {
      pts = [top, el, wr.clone().add(V(0, 0.016 * k, 0))];
      rad = [(ra + t + 0.006) * fu, (re + t) * fu, rw + t * 0.8];
    } else if (sleeve === 'wrist' && lod <= 1) {
      // a little bunching at the elbow, the sleeve closing at the wrist (hand-wide — Rambam KhM 8:17)
      pts = [top, mid(sh, el, 0.3), mid(sh, el, 0.65), mid(sh, el, 0.9), el, mid(el, wr, 0.2), mid(el, wr, 0.55), mid(el, wr, 0.85), wr.clone().add(V(0, 0.016 * k, 0))];
      rad = [ra + t + 0.006, (ra + t + 0.002) * fu, (ra * 0.97 + t) * fu, (re * 1.08 + t) * fu, (re * 1.1 + t) * fu, (re * 1.04 + t) * ff, (rf * 0.95 + t * 0.8) * ff, rw * 1.12 + t * 0.7, rw + t * 0.8];
    } else if (sleeve === 'wrist') {
      pts = [top, mid(sh, el, 0.45), el, mid(el, wr, 0.55), wr.clone().add(V(0, 0.016 * k, 0))];
      rad = [ra + t + 0.006, (ra * 0.98 + t) * fu, (re + t) * fu, (rf + t * 0.6) * ff, rw + t * 0.8];
    } else if (sleeve === 'elbow') {
      pts = [top, mid(sh, el, 0.5), mid(sh, el, 0.92)];
      rad = [ra + t + 0.008, ra * 1.1 + t, re * 1.32 + t];
    } else {
      pts = [top, mid(sh, el, 0.48)];
      rad = [ra + t + 0.008, ra * 1.12 + t];
    }
    const nP = pts.length;
    rad[0] *= 0.94;
    // gate-people: the elbow's crease zone in uv.v — v = 10 at the elbow, v − 10 the distance above it along the sleeve
    // (material.js pElbowH)
    let sEl = 0, acc = 0, best = Infinity;
    for (let i = 0; i < nP; i++) {
      if (i) acc += pts[i].distanceTo(pts[i - 1]);
      const dd = pts[i].distanceTo(el);
      if (dd < best) { best = dd; sEl = acc + (i === nP - 1 ? dd : 0); }
    }
    B.tube(limbRings(pts, rad), {
      seg, weights: W, capA: lod >= 2 ? 'flat' : 'dome', domeH: 0.35, v0: 10 + sEl,
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
  if (lod === 1) { handLod1(B, rig, s, { sg, hs, w, kn, k2, ix, i2, th, down, palmN, back, rot, hb, fb, f2, ib, i2b, tb, palmL }); return; }
  if (lod >= 2) {
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
 * gate-people: the LOD1 hand (≈ 3–8 m on low, 5–12 m on high — the distance the 'Go' views see hands from): a palm with
 * the knuckle ridge, four separate fingers in the relaxed cascade (each a proximal and a distal segment on its own bones,
 * so a grip or a gesture bends them) and the thumb along the index — the silhouette of a hand, not of a mitten. The same
 * joints and cascade as LOD0, ≈ 230 triangles (the mitten: 100).
 */
function handLod1(B, rig, s, q) {
  const { hs, w, kn, k2, ix, i2, th, down, palmN, back, rot, hb, fb, f2, ib, i2b, tb, palmL } = q;
  const I = rig.index;
  B.ellipsoid(w.clone().addScaledVector(down, palmL * 0.5).addScaledVector(back, 0.002 * hs), [0.0152 * hs, palmL * 0.58, 0.039 * hs], {
    nu: 8, nv: 5, xf: rot,
    deform: (l) => { if (l.x < 0) l.x *= 1 + 0.16 * Math.exp(-((((l.y / (palmL * 0.58)) + 0.85) / 0.2) ** 2)); return l; },
    weights: (p) => normW([[hb, 1], [I[`farm_${s}`], 0.4 * smooth(w.y - 0.02, w.y + 0.02, p.y)]]),
  });
  B.ellipsoid(w.clone().addScaledVector(down, palmL * 0.3).addScaledVector(back, -0.028 * hs).addScaledVector(palmN, 0.007 * hs),
    [0.012 * hs, 0.027 * hs, 0.015 * hs], { nu: 6, nv: 4, xf: rot, weights: [[hb, 0.6], [tb, 0.4]] });
  const fl = k2.distanceTo(kn), il = i2.distanceTo(ix);
  const curlAxis = new Vector3().crossVectors(down, palmN).normalize();
  const fingers = [
    { base: ix, zo: 0.004, b1: ib, b2: i2b, p: il, d: 0.042, r: 0.0098, drop: 0.002, flex: 2 },
    { base: kn, zo: -0.0135, b1: fb, b2: f2, p: fl, d: 0.045, r: 0.0101, drop: 0, flex: 6 },
    { base: kn, zo: 0.0025, b1: fb, b2: f2, p: fl * 0.96, d: 0.042, r: 0.0096, drop: 0.002, flex: 12 },
    { base: kn, zo: 0.0175, b1: fb, b2: f2, p: fl * 0.86, d: 0.034, r: 0.0087, drop: 0.006, flex: 19 },
  ];
  for (const g of fingers) {
    const o = g.base.clone().addScaledVector(back, g.zo * hs).addScaledVector(down, g.drop * hs);
    const pip = g.base.clone().addScaledVector(back, g.zo * hs).addScaledVector(down, g.p);
    const fdir = down.clone().applyAxisAngle(curlAxis, (g.flex * Math.PI) / 180);
    const tip = pip.clone().addScaledVector(fdir, g.d * hs);
    const r = g.r * hs * 1.05;          // a touch fuller: at 5–10 m a finger of true girth is under a pixel wide
    const knuckle = o.clone().addScaledVector(down, -0.006 * hs).addScaledVector(palmN, -0.0025 * hs);
    B.tube(limbRings([knuckle, pip], [[r * 1.12, r * 1.1], [r * 0.98, r * 1.02]]), {
      seg: 5, weights: (p) => normW([[g.b1, 1], [hb, 1.2 * (1 - smooth(0, 0.016 * hs, p.clone().sub(o).dot(down)))]]),
    });
    B.tube(limbRings([pip.clone().addScaledVector(down, -0.004 * hs), tip], [[r * 0.98, r * 1.02], [r * 0.82, r * 0.88]]), {
      seg: 5, capB: 'dome', domeH: 0.9, bone: g.b2,
    });
  }
  const tdir = down.clone().multiplyScalar(0.95).addScaledVector(back, 0.04).addScaledVector(palmN, 0.1).normalize();
  const t0 = th.clone().addScaledVector(tdir, 0.012 * hs), t2 = th.clone().addScaledVector(tdir, 0.058 * hs), t3 = th.clone().addScaledVector(tdir, 0.084 * hs);
  B.tube(limbRings([t0, t2, t3], [0.0122 * hs, 0.0102 * hs, 0.0092 * hs]), {
    seg: 5, capB: 'dome', domeH: 0.9, weights: (p) => normW([[tb, 1], [hb, 0.9 * (1 - smooth(0, 0.03 * hs, p.distanceTo(t0)))]]),
  });
}

/**
 * A bare shin from the ankle up to `to` (at most just above the knee): the ankle's narrow neck with the malleoli either
 * side (the inner one higher and further forward), the Achilles tendon behind, the tibia's flat inner face and its
 * crest in front, the calf's belly in the upper half behind (its inner head lower and fuller), the knee with the
 * kneecap and the condyles, the thigh's start above. Rings in u = 0 at the ankle joint … 1 at the knee joint:
 * [u, across, front–back, centre shift back].
 */
function bareShin(B, rig, lod, s, to, legW) {
  const k = rig.dims.H / 1.67, sg = s === 'l' ? -1 : 1;
  const an = R(rig, `foot_${s}`), sn = R(rig, `shin_${s}`);
  const L = sn.y - an.y;
  const prof = [[-0.03, 0.031, 0.029, 0.004], [0.06, 0.034, 0.03, 0.003], [0.2, 0.029, 0.031, 0.006], [0.42, 0.034, 0.039, 0.01],
    [0.62, 0.042, 0.048, 0.014], [0.8, 0.045, 0.047, 0.011], [0.93, 0.043, 0.042, 0.004], [1.03, 0.047, 0.047, 0], [1.15, 0.053, 0.055, 0.004]];
  const sel = lod === 0 ? prof : prof.filter((_, i) => [0, 2, 4, 6, 7, 8].includes(i));
  const uTo = (to - an.y) / L;
  const rows = sel.filter(([u]) => u < uTo - 0.02);
  // the last ring at `to`, interpolated
  const lastI = prof.findIndex(([u]) => u >= uTo);
  if (lastI > 0) {
    const [u0, a0, b0, z0] = prof[lastI - 1], [u1, a1, b1, z1] = prof[lastI], t = (uTo - u0) / (u1 - u0);
    rows.push([uTo, lerp(a0, a1, t), lerp(b0, b1, t), lerp(z0, z1, t)]);
  } else rows.push([uTo, ...prof[prof.length - 1].slice(1)]);
  const rings = rows.map(([u, a, b, zb]) => ({
    c: V(lerp(an.x, sn.x, clamp(u)), an.y + u * L, lerp(an.z, sn.z, clamp(u)) + zb * k), rx: a * k, rz: b * k, u,
    ax: V(1, 0, 0), az: V(0, 0, 1),                       // θ = 0 toward +x, π/2 toward the back
  }));
  const bump = (u, c, w) => Math.exp(-(((u - c) / w) ** 2));
  B.tube(rings, {
    seg: L3(lod, 16, 9, 5), weights: legW,
    radial: (th, j) => {
      const u = rings[j].u, sn2 = Math.sin(th), cs = Math.cos(th);
      const F = Math.max(0, -sn2), Bk = Math.max(0, sn2), med = Math.max(0, -sg * cs), lat = Math.max(0, sg * cs);
      let m = 1;
      m += 0.14 * med ** 3 * bump(u, 0.05, 0.05) + 0.12 * lat ** 3 * bump(u, 0.02, 0.05);          // the malleoli
      m += 0.08 * Bk ** 4 * bump(u, 0.12, 0.12);                                                    // the Achilles tendon
      m -= 0.06 * F ** 3 * bump(u, 0.5, 0.3) * (1 - 0.6 * med);                                     // the tibia's flat face …
      m += 0.025 * Math.exp(-(((cs + sg * 0.25) / 0.18) ** 2)) * F * bump(u, 0.5, 0.3);              // … and its crest
      m += 0.08 * Bk ** 1.5 * bump(u, 0.66, 0.16) + 0.05 * Bk * med * bump(u, 0.58, 0.14);          // the calf, its inner head lower
      m += 0.1 * F ** 3 * bump(u, 1.03, 0.05) + 0.05 * Math.abs(cs) ** 4 * bump(u, 1.0, 0.06);      // the kneecap, the condyles
      m -= 0.05 * Bk ** 3 * bump(u, 1.0, 0.05);                                                      // the hollow behind the knee
      return m;
    },
    shade: (th, j) => {
      const u = rings[j].u, Bk = Math.max(0, Math.sin(th));
      return 1 - 0.12 * Bk ** 2 * bump(u, 1.0, 0.05) - 0.06 * Bk * bump(u, 0.2, 0.08);
    },
  });
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
  const legW = (p) => envelope(rig, p, { [`shin_${s}`]: 1, [`foot_${s}`]: 0.6, [`thigh_${s}`]: 0.3 }, 4);
  if (to > an.y + 0.2 && lod <= 1) bareShin(B, rig, lod, s, to, legW);   // a bare shin to the knee (breeches, the bather)
  else {
    const pts = [V(an.x, an.y - 0.012, an.z + 0.004), V(an.x, lerp(an.y, to, 0.45), an.z), V(an.x, to, an.z - 0.004)];
    if (to > sn.y - 0.12) pts.splice(2, 0, V(sn.x, sn.y - 0.13 * k, sn.z));
    const rad = pts.map((p) => (p.y < an.y + 0.05 ? 0.034 * k : p.y > sn.y - 0.06 ? 0.048 * k : 0.04 * k));
    if (lod < 3) B.tube(limbRings(lod >= 2 ? [pts[0], pts[pts.length - 1]] : pts, lod >= 2 ? [rad[0], rad[rad.length - 1]] : rad), { seg: L3(lod, 14, 6, 4), weights: legW,
      radial: lod === 0 ? (th, j) => 1 + (j === 1 ? 0.06 * Math.max(0, -Math.sin(th)) : 0) : null }); // the calf behind
  }
  const len = rig.dims.footLen * 0.95;
  if (lod >= 2) {
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
      shade: (l) => (l.y < -0.02 * k ? 0.8 : 1),
    });
    return;
  }
  // LOD0 and (qa-r2) LOD1: the body of the foot lofted from the heel to the ball, sole flat with the medial arch lifted,
  // the toes apart. (LOD1 was one pointed ellipsoid: from 3–14 m, the distance most kohanim are seen at, the bare feet
  // of the kohanim — Zevachim 24a — read as toeless orange paddles.) The sole's edge is darker (the dust of the courts)
  // and so is everything within a centimetre of the floor (contact occlusion under the heel, the ball and the toes).
  const heelZ = an.z + len * 0.25, ballZ = toe.z + 0.012 * k;
  const secs0 = [ // [z, centre y, half-width, half-height, x shift outward]; the bottoms dip below 0 and are cut flat
    [heelZ + 0.004, 0.03, 0.014, 0.03, 0],
    [heelZ - 0.01, 0.032, 0.028, 0.036, 0],
    [an.z + 0.015, 0.045, 0.032, 0.05, 0],
    [an.z - 0.03, 0.04, 0.036, 0.045, 0.002],
    [lerp(an.z, ballZ, 0.55), 0.03, 0.04, 0.034, 0.004],
    [ballZ + 0.02, 0.02, 0.044, 0.024, 0.006],
    [ballZ - 0.004, 0.016, 0.045, 0.018, 0.007],
  ];
  const secs = lod === 0 ? secs0 : [secs0[0], secs0[2], secs0[3], secs0[4], secs0[6]];
  const iArch = lod === 0 ? [2, 4] : [1, 3], iMid = lod === 0 ? 3 : 2, iAnkle = lod === 0 ? 2 : 1;
  const rings = secs.map(([z, y, w, h, xs]) => ({ c: V(an.x + sg * (0.003 + xs) * k, y * k, z), rx: w * k, rz: h * k, ax: V(1, 0, 0), az: V(0, 1, 0) }));
  const fw = (p) => (p.z < ballZ + 0.02 ? normW([[fb, 1], [tb, 0.6 * smooth(ballZ + 0.02, ballZ - 0.01, p.z)]]) : normW([[fb, 1], [rig.index[`shin_${s}`], 0.4 * smooth(0.08 * k, 0.12 * k, p.y)]]));
  const floorAO = (p) => 1 - 0.2 * smooth(0.014 * k, 0.002 * k, p.y);
  B.tube(rings, {
    seg: lod === 0 ? 14 : 8, weights: fw, capA: 'dome', capB: lod === 0 ? 'dome' : 'flat', domeH: 0.5,
    radial: (th, j, Rg) => {
      const sinT = Math.sin(th), cosT = Math.cos(th);
      // the sole is cut flat on the floor; under the arch its inner side lifts; the ankle bones bulge
      let m = 1;
      const medial = -sg * cosT;            // +1 on the inner side
      if (j === iAnkle) m *= 1 + 0.08 * Math.abs(cosT) * Math.max(0, sinT + 0.2);
      if (sinT < 0) {
        const level = (0.0025 + (j >= iArch[0] && j <= iArch[1] ? 0.014 * Math.max(0, medial) * (j === iMid ? 1 : 0.6) : 0)) * k;
        m = Math.min(m, (Rg.c.y - level) / (Rg.rz * -sinT));
      }
      return Math.max(0.2, m);
    },
    shade: (th, j, p) => (Math.sin(th) < -0.6 ? 0.78 : Math.sin(th) < -0.25 ? 0.9 : 1) * floorAO(p),
  });
  // toes: the big toe and four smaller ones, splayed a little, with nails (LOD1: the big toe and the four others in two
  // pairs, mitten-like, no nails)
  const toes = lod === 0 ? [ // [x offset (× inner→outer), length, radius, width ×]
    [-0.026, 0.05, 0.0125, 1], [-0.006, 0.042, 0.0088, 1], [0.011, 0.038, 0.0082, 1], [0.026, 0.032, 0.0076, 1], [0.039, 0.026, 0.007, 1],
  ] : [[-0.026, 0.05, 0.0125, 1], [0.0025, 0.04, 0.0088, 1.9], [0.0325, 0.029, 0.0074, 1.8]];
  for (const [xo, L, r, wx] of toes) {
    const x0 = an.x + sg * (0.007 + xo) * k;
    const z0 = ballZ + 0.01 * k + Math.abs(xo) * 0.35;
    const y0 = 0.014 * k;
    const spread = sg * xo * 0.35;
    const p0 = V(x0, y0 + 0.003 * k, z0), p1 = V(x0 + spread * L, y0 + 0.002 * k, z0 - L * 0.55 * k), p2 = V(x0 + spread * L * 1.6, r * k * 0.85, z0 - L * k);
    B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 });
    // the crease where the toe leaves the foot and the one across its joint (top), its underside on the floor
    B.tube(limbRings([p0, p1, p2], [[r * k * 1.05 * wx, r * k * 0.95], [r * k * wx, r * k * 0.82], [r * k * 0.9 * wx, r * k * 0.75]]), {
      seg: lod === 0 ? 6 : 5, capB: 'dome', domeH: 0.9, weights: (p) => normW([[tb, 1], [fb, 0.5 * smooth(z0 - 0.01, z0 + 0.005, p.z)]]),
      shade: (th, j, p) => (Math.sin(th) < -0.5 ? 0.8 : 1) * (j === 0 ? 0.84 : j === 1 && Math.sin(th) > 0.3 ? 0.93 : 1) * floorAO(p),
    });
    if (lod > 0) continue;
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
  // o.soft (0…1): heavy wool folds rounder — the crease profile |sin| blended toward sin² (rounded both ways); linen
  // keeps its sharp creases (qa-r1: the mantle's sharp creases between flat panels read as folded paper)
  const sf = o.soft ?? 0, mean = 0.637 * (1 - sf) + 0.5 * sf;
  const g = (x) => { const s = Math.sin(x); return Math.abs(s) * (1 - sf) + s * s * sf - mean; };
  const F = (th, j) => 0.62 * g((n1 * th) / 2 + s1 + 0.07 * j) + 0.38 * g((n2 * th) / 2 + s2 - 0.05 * j);
  const A = (j) => amp * smooth(start - 0.6, start + span, j);
  return {
    radial: (th, j) => 1 + A(j) * F(th, j) * 2.2,
    shade: (th, j) => 1 - (lod === 0 ? 0.32 : 0.24) * (o.ao ?? 1) * (A(j) / amp) * Math.max(0, -F(th, j)) * 2.2,
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
  if (o.rent) rentRings(top, o.rent, lod);
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
  const seg = L3(lod, 40, 16, 7);
  // a rent (o.rent, keri'ah): the tube starts at the front centre so its seam is there, and the seam is parted along the
  // rent - the cloth's own edges, the chest behind (rentFront)
  const rent = o.rent || null;
  // gate-people: a garment girded at o.gatherY (the avnet, a belt) carries its gather zone in uv.v: v = 20 at the belt's
  // middle, v − 20 the distance along the cloth above it (material.js pGatherH: the radial gather folds under it)
  let v0 = 0;
  if (o.gatherY != null) {
    let acc = 0;
    for (let j = 1; j < rings.length; j++) {
      const A = rings[j - 1].c, Bq = rings[j].c, dd = A.distanceTo(Bq);
      if (Bq.y <= o.gatherY) { acc += dd * clamp((A.y - o.gatherY) / Math.max(1e-5, A.y - Bq.y)); break; }
      acc += dd;
    }
    v0 = 20 + acc;
  }
  // (and u from its front centre: the tube runs from the back, its seam welded there — see MeshBuilder.tube uPhase)
  const fromBack = o.gatherY != null && !rent && o.uvMode !== 'x';
  const g = B.tube(rings, {
    seg, uvMode: o.uvMode, arc: rent ? [-Math.PI / 2, Math.PI * 1.5] : fromBack ? [Math.PI / 2, Math.PI * 2.5] : undefined, thMap: rent ? rentMap(rent, seg) : undefined, v0,
    uPhase: fromBack ? Math.PI * 1.5 : 0,
    lift: (th, j, Rg) => bl(th, j, Rg) + (j === last && dr.hem ? dr.hem(th, j) : 0),
    weights: (p, j) => (j < nTop - 1 ? tw(p) : W(p)),
    radial: dr.radial, shade: dr.shade,
  });
  if (rent) {
    for (let j = 0; j < rings.length; j++) if (!(rent.half(rings[j].c.y) > 0)) B.seams.push([g.id(0, j), g.id(seg, j)]);
    rings.rentGrid = { g, seg };
  }
  if (fromBack) for (let j = 0; j < rings.length; j++) B.seams.push([g.id(0, j), g.id(seg, j)]);
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
  rings.radial = dr.radial;                                  // (the drape, for pieces laid on this garment)
  return rings;
}

/** the ketonet: fitted linen tunic to just above the heel, hand-wide sleeves to the wrist, boxed (meshubetzet)
 *  weave; it hangs low and straight (meshulshalim — Rambam KhM 8:4, 8:16–17) and blouses softly at the avnet */
export function ketonet(B, rig, lod, o = {}) {
  const hemY = R(rig, 'foot_r').y + 0.04 * rig.dims.H / 1.67;
  B.set({ cls: o.cls ?? CLS.GA, pat: PAT.LINEN_BOX, rough: 0.82, metal: 0, color: o.color || [1, 1, 1], grp: 0 });
  if (!o.noBody) garmentBody(B, rig, lod, hemY, { folds: 0.05, nFolds: 11, flare: 0.05, thick: 0.005, foldFrom: 'ribs', seed: o.seed ?? 2.1, gatherY: R(rig, 'chest').y - 0.035 * rig.dims.H / 1.67 });
  for (const s of ['l', 'r']) arm(B, rig, lod, s, { sleeveTo: 'wrist', cls: o.cls ?? CLS.GA, pat: PAT.LINEN_BOX, color: o.color });
  return hemY;
}

/** the avnet: 3 fingers wide, 32 amot long, wound winding on winding over the heart (Rambam KhM 8:19); wool
 *  embroidery (rokem) in techelet, argaman and tola'at shani on the linen (8:1), except the white YK avnet. The
 *  embroidered avnet is sha'atnez, worn only in the avodah: mask group AVNET, off outside it (Rambam KhM 8:11 —
 *  Actor.setGarb({ avnet: false })); the all-linen YK avnet is not kilayim and has no group */
export function avnet(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const ch = R(rig, 'chest');
  const yc = ch.y - 0.035 * k, hh = AMAH / 16;            // 3 etzba'ot = 1/8 amah wide
  B.set({ cls: CLS.FIX, pat: o.white ? PAT.LINEN : PAT.AVNET, rough: 0.8, metal: 0, color: o.white ? COL.linenKG : AVNET_AVG, grp: o.white ? 0 : GRP.AVNET });
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
  const rent = o.rent && lod <= 2 ? rentShape(rig) : null;
  // (every tunic is girded: belt() at the spine's height − 1 cm — the gather zone is there)
  const rings = garmentBody(B, rig, lod, hemY, { folds: o.folds ?? 0.085, nFolds: o.nFolds ?? 8, flare: o.flare ?? 0.07 * k, thick: 0.008, uvMode: o.pat === PAT.WOOL ? undefined : 'x', seed: o.seed ?? 0.7, foldFrom: 'waist', rent, gatherY: R(rig, 'spine').y - 0.01 * k });
  for (const s of ['l', 'r']) arm(B, rig, lod, s, { sleeveTo: o.sleeve || 'elbow', cls: o.cls ?? CLS.GA, pat: PAT.WOOL, rough: 0.9 });
  if (rent) rentFront(B, rig, lod, rings, rent, { cls: o.cls ?? CLS.GA });
  return hemY;
}

/**
 * Keri'ah: the tunic rent at the breast from the neckline down - the metzora's "garments shall be rent" (Vayikra 13:45;
 * Rambam Tumat Tzara'at 10:6), a mourner's a tefach and more (Moed Katan 22b): a V from the collar ring (the neckline)
 * 20 cm down, half(y) wide each side of the middle, closing to nothing at the bottom (people-4-fix: a real opening -
 * the tube's seam parted, not a patch laid over the cloth).
 */
function rentShape(rig) {
  const k = rig.dims.H / 1.67;
  const y0 = R(rig, 'neck').y + 0.04 * k, len = 0.2 * k, hw = 0.036 * k;   // y0: torsoRings' collar ring
  return { y0, len, half: (y) => hw * clamp((y - (y0 - len)) / len) ** 0.75 };
}
/** rows for the rent's V (the torso rings are 4-12 cm apart): rings interpolated at fractions of its length, the
 *  closing row always */
function rentRings(top, rent, lod) {
  for (const t of lod === 0 ? [0.3, 0.55, 0.8, 1] : lod === 1 ? [0.55, 1] : [1]) {
    const y = rent.y0 - rent.len * t;
    const j = top.findIndex((q, i) => i > 0 && q.c.y < y);
    if (j < 1) continue;
    const a = top[j - 1], b = top[j];
    if (t < 1 && Math.min(a.c.y - y, y - b.c.y) < 0.015) continue;      // a ring there already
    const u = (a.c.y - y) / (a.c.y - b.c.y);
    top.splice(j, 0, { c: a.c.clone().lerp(b.c, u), rx: lerp(a.rx, b.rx, u), rz: lerp(a.rz, b.rz, u) });
  }
}
/** the tube's angle map for a rent: column 0 (θ = -90°, the front centre, his right side of the seam) and column seg
 *  (his left) part to ±half(y); the cloth within 0.45 rad of the edge gathers toward it */
function rentMap(rent, seg) {
  return (th, j, Rg, i) => {
    const h = rent.half(Rg.c.y);
    if (!(h > 0)) return th;
    const right = i <= seg / 2, a = Math.abs(right ? th + Math.PI / 2 : th - Math.PI * 1.5);
    const hA = Math.asin(Math.min(0.9, h / Rg.rx)), A = hA + 0.45;
    if (a >= A) return th;
    return -Math.PI / 2 + (right ? 1 : -1) * (hA + a * (A - hA) / A);
  };
}
/** the chest seen in the rent (a strip of skin 7 mm inside the cloth, reaching 1.2 cm under each edge, shaded where the
 *  cloth overhangs) and the torn edges: frayed lips of the cloth along both, turned out a little - laid on the tube's
 *  own edge vertices */
function rentFront(B, rig, lod, rings, rent, o = {}) {
  const { g, seg } = rings.rentGrid;
  const k = rig.dims.H / 1.67;
  const tw = torsoW(rig);
  const rows = [];
  for (let j = 0; j < rings.length; j++) { rows.push(j); if (!(rent.half(rings[j].c.y) > 0)) break; }
  const tOf = (j) => clamp((rent.y0 - rings[j].c.y) / rent.len);
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [0.96, 0.94, 0.93], grp: 0 });
  const nu = L3(lod, 8, 4, 2);
  B.grid(nu, rows.length - 1, (i, jj) => {
    const Rg = rings[rows[jj]];
    const hA = Math.asin(Math.min(0.9, (rent.half(Rg.c.y) + 0.012 * k) / Rg.rx));
    const a = hA * (2 * i / nu - 1), th = -Math.PI / 2 + a;
    const p = V(Rg.c.x + Math.cos(th) * (Rg.rx - 0.007), Rg.c.y, Rg.c.z + Math.sin(th) * (Rg.rz - 0.007));
    const e = Math.abs(a) / Math.max(1e-4, hA);
    return { p, u: p.x, v: p.y, w: tw, shade: 1 - 0.32 * smooth(0.45, 1, e) - 0.12 * smooth(0.6, 1, tOf(rows[jj])) };
  }, { inside: V(0, rent.y0 - rent.len / 2, 0.03) });
  B.set({ cls: o.cls ?? CLS.GA, pat: PAT.WOOL, rough: 0.92, metal: 0, color: [1, 1, 1], grp: 0 });
  for (const [col, sg] of [[0, 1], [seg, -1]]) {
    const side = V(sg, 0, -0.4).normalize();
    const pts = [], wid = [];
    rows.forEach((j, n) => {
      const t = tOf(j), w = (0.009 * (1 - t) + 0.003) * k;
      const fray = lod === 0 && n < rows.length - 1 ? 0.0018 * (0.5 + 0.5 * Math.sin(n * 5.3 + sg)) : 0;
      const e = V(B.pos[g.id(col, j) * 3], B.pos[g.id(col, j) * 3 + 1], B.pos[g.id(col, j) * 3 + 2]);
      pts.push(e.addScaledVector(side, w / 2 - fray).add(V(0, 0, -0.0015 * (1 - t))));
      wid.push(w);
    });
    B.ribbon(pts, (u) => wid[Math.round(u * (wid.length - 1))], { side, weights: tw });
  }
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
  if (B.skipGrp?.has(grp)) return;   // (a build that leaves the optional mantle out — props.js sleeperField)
  const gap = o.gap ?? 0.5;                                   // half-angle of the open front (rad)
  const a0 = -Math.PI / 2 + gap, a1 = Math.PI * 1.5 - gap;
  const sh = R(rig, 'uarm_r'), el = R(rig, 'farm_r'), nk = R(rig, 'neck'), ch = R(rig, 'chest');
  const ySeat = R(rig, 'thigh_r').y - 0.06 * k;
  const SW = skirtW(rig, ySeat, hemLow);
  // body section under the mantle at a height (torso rings, then the skirt below the seat), plus clearance
  // (gate-people-r2: from the collar ring — the top edge lies round the neck on the trapezius; from the 'trap' ring it stood
  // ~5 cm off the neck as a wide yoke, the dark lining showing across the shoulders)
  const tr = torsoRings(rig, { thick: 0.02, from: 'collar' });
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
  const shY = R(rig, 'uarm_r').y + 0.004 * k;               // the top of the shoulder (torsoRings' 'shoulder' ring)
  const yHemAt = (th) => lerp(hemLow, el.y + 0.02 * k, sideMask(th));
  // over the upper arm the cloth clears it (the A-pose arm of the rest rig, which the stand pose brings in)
  const armClear = (th, y) => {
    if (y > sh.y + 0.02 || y < el.y - 0.06) return 0;
    const t = clamp((sh.y - y) / Math.max(0.01, sh.y - el.y));
    return (lerp(sh.x, el.x, t) + 0.052 * k) * smooth(0.55, 0.95, Math.abs(Math.cos(th)));
  };
  // gate-people-r2: the drape in the geometry — heavy wool falls in a few deep folds, rounded ridges between narrow valleys
  // (two families, ≈ 12 and 7.5 cm apart round the body — two or three across a front panel; LOD2 one, ≈ 23 cm) from
  // where it is held: none on the trapezius, growing over the shoulder and the chest to their full depth (≈ 4.5 cm) half a
  // metre below it, and on the front panels they fan out from the shoulder (their phase pulled toward it near the top). The cloth only stands OUT from its clearance (valleys on it, ridges proud),
  // so nothing sinks into the tunic. The hem follows the folds (a wavy edge, ±1 cm), the front edges cascade (a slow
  // zigzag), valleys are shaded. The old drape (13 + 22 folds round the body as radial ripples and crease shade) aliased on
  // LOD1's 32 columns into streaks: flat panels with "fold shading" (gate round 2). LOD3 keeps a plain sheet.
  const Am = (lod === 0 ? 0.046 : lod === 1 ? 0.042 : lod === 2 ? 0.034 : 0) * k;
  const rf = prng(o.seed ?? 3.7);
  const fs1 = rf() * 6.28, fs2 = rf() * 6.28, fs3 = rf() * 6.28;
  const foldAmp = (y) => Am * smooth(sh.y + 0.03 * k, sh.y - 0.5 * k, y);
  // fold field in [0, 1] (0 = a valley lying on the clearance) at material angle th, height y and row fraction t
  const foldF = (th, y, t) => {
    if (!Am) return 0.5;
    const front = smooth(0.25, -0.5, Math.sin(th));
    const thS = Math.cos(th) >= 0 ? 0 : Math.PI;
    const phi = th + (thS - th) * (1 - (0.45 + 0.55 * smooth(0, 0.8, t))) * front;
    if (lod >= 2) return (0.5 - 0.5 * Math.cos(phi * 6 + fs1)) ** 0.7;
    const r1 = 0.5 - 0.5 * Math.cos(phi * 11 + fs1 + 0.5 * Math.sin(t * 4 + fs3));
    const r2 = 0.5 - 0.5 * Math.cos(phi * 18 + fs2 - 0.4 * Math.sin(t * 3 + fs1));
    return 0.6 * r1 ** 0.6 + 0.4 * r2 ** 0.7;
  };
  const hemWave = (th) => (Am ? (foldF(th, hemLow, 1) - 0.5) * 0.02 * k : 0);
  // the front edges cascade: within 0.3 rad of the opening the cloth's angle zigzags slowly as it falls
  const edgeShift = (th, y) => (Am ? 0.1 * Math.sin(y * 16 / k + fs3) * (foldAmp(y) / Am) * (1 - smooth(0, 0.3, Math.min(th - a0, a1 - th))) : 0);
  // hang: below the seat, the share of the panels' outer (side) cloth that hangs from the pelvis instead of following
  // the leg cage while the figure is upright (material.js pSkin scales it by how upright the pelvis is) — a seated man's
  // mantle falls beside him from the arms to the floor and only its inner edges lie on the thighs (all on the cage, the
  // outer part stretched from the elbow to the knee: a stiff wedge with its inside showing); lying, the cage alone
  const hangAt = (th) => smooth(0.5, 0.93, Math.abs(Math.cos(th)));    // 0 at the opening's edges … 1 at the sides
  // (qa-r1: LOD1 24 × 11 instead of 16 × 9 — at 3–8 m the coarser sheet showed flat facets; qa-r2: 32 × 12 — the cloth
  // is lifted over the hanging arms vertex by vertex (material.js pArmPush), and between the sparser columns the lift
  // stood out beside the arm as a board)
  // (gate-people-r2: LOD0 56 and LOD1 40 columns, were 44 / 32 — a front panel had ~6 columns at LOD1, room for one fold;
  // LOD2 14 × 6 with its inner face, was 7 × 4 single — low draws it from ~9 m, and there it was a flat board with a panel
  // missing where its inside faced the camera; LOD3 5 × 3)
  const nu = lod === 0 ? 56 : lod === 1 ? 40 : lod === 2 ? 14 : 5, nv = lod === 0 ? 15 : lod === 1 ? 12 : lod === 2 ? 6 : 3;
  const cols = [];
  const store = [[], []];     // each sheet's vertices { p, w, hang } by j·(nu+1)+i, for the rolled edges below
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
    // (gate-people-r2: rows gathered toward the shoulders, where the cloth turns over the trapezius — with the top edge on the
    // neck, evenly spaced rows cut a chord through the tunic's shoulders; the hanging cloth below needs fewer)
    const t = (j / nv) ** 1.45;
    const yT = yTopAt(th), yH = yHemAt(th) + hemWave(th);
    const y = lerp(yT, yH, t);
    const body = bodyAt(y);
    // the front edges (near the opening) hang a little flatter and cascade: a slow zigzag of the edge as it falls
    const edge = Math.min(th - a0, a1 - th);
    const A = foldAmp(y), F = foldF(th, y, t), Ar = Am ? A / Am : 0;
    const thp = th + edgeShift(th, y);
    const c = Math.cos(thp), sn = Math.sin(thp);
    const off = A * F * (1 - 0.25 * smooth(0.3, 0.05, edge));
    let rx = body.rx + 0.022 * k + off, rz = body.rz + 0.022 * k + off;
    const need = armClear(th, y);
    rx = Math.max(rx, need);
    // gate-people-r2: thick wool bridges the shoulder's corner instead of following it — a fillet of ~5 cm where the flat
    // top of the shoulder meets the arm (it read as a square yoke: a horizontal top, then a vertical drop)
    if (y > shY - 0.03 * k) {
      const rf = 0.05 * k, oy = shY + 0.035 * k - rf, ox = sh.x + 0.052 * k - rf;
      if (y > oy) rx = Math.min(rx, lerp(rx, ox + Math.sqrt(Math.max(0, rf * rf - (y - oy) ** 2)), smooth(0.35, 0.85, Math.abs(c))));
    }
    // below the arms the cloth falls from them and narrows gently toward the hem (it is not a box)
    if (y < el.y && sideMask(th) < 1) {
      const wide = (el.x + 0.04 * k) * smooth(0.5, 0.95, Math.abs(c)) * 0.92;
      rx = Math.max(rx, lerp(wide, body.rx + 0.03 * k, smooth(el.y, el.y - 0.35 * k, y)));
    }
    // the top edge is turned over and rolls softly onto the shoulders (outer surface tucked in at row 0)
    const r = 1 - (inner ? 0.012 : 0) - (!inner && j === 0 ? 0.01 : 0);
    const p = V(c * rx * r, y, body.cz + sn * rz * r);
    // the shoulders: the cloth lies on the trapezius and the shoulder top
    if (t < 0.12) p.y += 0.004 * k * Math.sin(Math.PI * t / 0.12);
    // the sides follow the upper arms — but only well above the elbow: at the waist the cloth stays with the torso (qa-r1:
    // with the arms forward in semichah the band just above the elbow line was pulled off the body and the belt showed
    // through as a red patch)
    const side = smooth(0.62, 0.95, Math.abs(Math.cos(th))) * smooth(el.y + 0.02 * k, el.y + 0.16 * k, y);
    // the valleys hold less light (the normals carry the folds' own shading); the lining is dark where the cloth hangs and
    // lit where it turns over at the collar
    const shade = (1 - 0.4 * (1 - F) ** 2 * Ar) * (1 + 0.04 * F * Ar) * (1 - 0.12 * smooth(0.06, 0, edge)) * (t > 0.93 ? 0.9 : 1);
    if (!inner) cols.push(p);
    const hang = y <= ySeat ? hangAt(th) : 0;
    hv.push(hang);
    const w = W(p, side * 0.42);
    store[inner ? 1 : 0].push({ p, w, hang, u: th * (rx + rz) / 2 });
    return { p, u: th * (rx + rz) / 2, v: -y, w, shade: inner ? shade * lerp(0.86, 0.62, smooth(0.03, 0.2, t)) : shade };
  }, { inside: (A) => V(0, A.y, 0), invert: inner });
  const hv = [], s0 = B.count;
  sheet(false);
  if (lod <= 2) sheet(true);
  // the hang share rides in the (zero) metalness channel: −0.98·hang (material.js pSkin)
  for (let i = 0; i < hv.length; i++) if (hv[i] > 0.01) B.mat[(s0 + i) * 4 + 1] = -0.98 * hv[i];
  // qa-r1: the cloth's edges — the hem and the two front edges — are rolled: a strip from the outer sheet's edge round a
  // bulge (about 4 mm proud) to the inner sheet's edge, so the mantle has a thickness where it ends instead of two bare
  // surfaces (the faceted, paper-thin hem). Skinned like the edge it closes, with its hang share.
  if (lod <= 1) {
    const at = (s, i, j) => store[s][j * (nu + 1) + i];
    const roll = (n, pick, bulge, out) => {
      const r0 = B.count;
      const g0 = [at(0, ...pick(0)), at(1, ...pick(0))], g1 = [at(0, ...pick(1)), at(1, ...pick(1))];
      // winding: the first quad's normal must face `out` (away from the cloth)
      const A = g0[0].p, Bq = g1[0].p, C = g0[0].p.clone().lerp(g0[1].p, 0.5).add(bulge(0));
      const nrm = new Vector3().crossVectors(Bq.clone().sub(A), C.clone().sub(A));
      const flip = nrm.dot(out(0)) < 0;
      B.grid(n, 2, (i, j) => {
        const O = at(0, ...pick(i)), I = at(1, ...pick(i));
        const p = j === 0 ? O.p.clone() : j === 2 ? I.p.clone() : O.p.clone().lerp(I.p, 0.5).add(bulge(i));
        return { p, u: O.u, v: j * 0.004, w: O.w, shade: j === 0 ? 0.96 : j === 1 ? 0.86 : 0.6 };
      }, { flip });
      for (let v = r0; v < B.count; v++) {
        const i = (v - r0) % (n + 1), h = at(0, ...pick(i)).hang;
        if (h > 0.01) B.mat[v * 4 + 1] = -0.98 * h;
      }
    };
    // (gate-people: a hemmed edge ≈ 1–1.5 cm thick — the bulge 8 mm down at the hem, 6 mm out at the front edges, was 4: a
    // paper edge)
    const down = V(0, -0.008, 0);
    // the hem: outward and down
    roll(nu, (i) => [i, nv], (i) => down.clone().addScaledVector(at(0, i, nv).p.clone().setY(0).normalize(), 0.003), (i) => at(0, i, nv).p.clone().setY(0).normalize().add(V(0, -1, 0)));
    // the front edges: toward the opening (the edge's own tangent away from the sheet)
    for (const e of [0, nu]) {
      const nb = e === 0 ? 1 : nu - 1;
      const dir = (j) => at(0, e, j).p.clone().sub(at(0, nb, j).p).setY(0).normalize();
      roll(nv, (j) => [e, j], (j) => dir(j).multiplyScalar(0.006), dir);
    }
  }
  // qa-r2: the whole cloth (sheets and rolled edges, not the tzitzit) is kept outside the arms in the vertex shader — the
  // pattern channel carries + MANTLE_ARMS × (1 + margin step) (material.js pArmPush): the arms moved through a mantle
  // skinned to the torso below the elbow (the forearms of a man standing showed through its front, the sleeve through its
  // side). Not the far silhouettes' sheet (LOD3, 5 × 3: from ~20 m an arm in it is a pixel or two; gate-people-r2: LOD2,
  // drawn from ~9 m on low, is now 14 × 6 and kept off the arms too — its forearms showed through)
  if (lod <= 2) for (let v = s0; v < B.count; v++) B.mat[v * 4 + 2] += MANTLE_ARMS;
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
      const y = yHemAt(th) + hemWave(th);
      const body = bodyAt(y);
      const need = armClear(th, y);
      // (gate-people-r2: on the fold at the corner, and on the cascading edge)
      const fo = foldAmp(y) * foldF(th, y, 1), tp = th + edgeShift(th, y);
      const rx = Math.max(body.rx + 0.022 * k + fo, need);
      const base = V(Math.cos(tp) * rx * 1.02, y + 0.012, body.cz + Math.sin(tp) * (body.rz + 0.022 * k + fo) * 1.02);
      const tang = V(-Math.sin(th), 0, Math.cos(th));
      const out = V(Math.cos(th), 0, Math.sin(th));
      const wts = (p) => W(p, 0);
      const gl = 0.045 * k;
      const v0 = B.count;
      B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.85, metal: 0, color: COL.techelet, grp });
      B.tube([{ c: base.clone().addScaledVector(out, 0.004), rx: 0.0035, rz: 0.0035 }, { c: base.clone().addScaledVector(out, 0.006).add(V(0, -gl, 0)), rx: 0.0032, rz: 0.0032 }],
        { seg: 5, weights: wts, capB: 'flat' });
      // the eight strands (LOD0); at LOD1 the hanging tassel as one bundle, white with its techelet strand beside it —
      // three strands of 1.6 mm were sub-pixel there and broke into flickering dashes at the hems (qa-r2)
      const n = lod === 0 ? 8 : 2;
      for (let q = 0; q < n; q++) {
        const blue = q === n - 1;
        B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.85, metal: 0, color: blue ? COL.techelet : COL.tzitzit, grp });
        const off = lod === 0 ? (q - (n - 1) / 2) * 0.0022 : (blue ? 0.0036 : -0.001);
        const top0 = base.clone().addScaledVector(out, 0.006).add(V(0, -gl, 0)).addScaledVector(tang, off * 0.4);
        const pts = [0, 0.5, 1].map((u) => top0.clone().addScaledVector(tang, off * u * 1.6).addScaledVector(out, 0.004 * u).add(V(0, -u * 0.1 * k, 0)));
        B.ribbon(pts, lod === 0 ? 0.0016 : blue ? 0.0022 : 0.0065, { side: tang, weights: wts });
      }
      // plumb: each vertex carries its height h below the knot (material.js VERT_BEGIN) — the strings hang from the
      // corner straight down in any pose and lie on the floor where they reach it — and the corner's hang share q/20 (so
      // the knot stays on the corner): metalness channel = −1 − q − h
      const q = Math.round(hangAt(th) * 20);
      for (let i = v0; i < B.count; i++) B.mat[i * 4 + 1] = -1 - q - Math.min(0.95, Math.max(0, base.y - B.pos[i * 3 + 1]));
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


// --------------------------------------------------------------------------------------------- bare body (people-3)
// A kohen stripped to the michnasayim (Tamid 5:3 "they left them only the breeches") and a bather in a linen wrap
// (Tamid 1:1–2; Yoma 3:3). Only the upper body is bare: chest and shoulder girdle sculpted (pectorals over the
// sternum's groove, collar bones, shoulder blades, the spine's furrow, the lats), arms with deltoid, biceps and the
// forearm's bulk. Kept modest (docs/decisions/people-3.md).

/** the neck's rings under the head (head(): same placement), for a torso that carries its own neck */
function neckRings(rig, H) {
  const nk = R(rig, 'neck'), nr = rig.dims.neckR;
  // the top ring well inside the skull (under the occiput the head's own underside does not reach down far enough)
  const top = V(0, H.C.y - 0.035 * H.hs, H.C.z + 0.014 * H.hs);
  return [
    { c: top, rx: nr * 0.94, rz: nr * 1.0, tag: 'neck2', f: 0, b: 0, rf: 1 },
    { c: V(0, lerp(nk.y + 0.03, top.y, 0.55), lerp(nk.z, top.z, 0.55) - 0.003), rx: nr * 0.98, rz: nr * 0.99, tag: 'neck1', f: 0, b: 0, rf: 1 },
    { c: V(0, nk.y + 0.03, nk.z - 0.002), rx: nr * 1.04, rz: nr * 1.0, tag: 'neck0', f: 0, b: 0, rf: 1 },
  ];
}

/** the bare shoulder line, [|x|, y]: the trapezius from the neck's side out to the top of the shoulder */
function trapLine(rig) {
  const d = rig.dims, k = d.H / 1.67, nk = R(rig, 'neck'), sh = R(rig, 'uarm_r');
  return [[d.neckR * 1.04, nk.y + 0.03], [d.neckR * 1.6, nk.y + 0.016 * k], [d.shX * 0.66, sh.y + 0.03 * k]];
}
/** the deltoid cap over the shoulder joint as a circular arc in the [|x|, y] profile: a(deg) → [x, y] (90° = on top,
 *  0° = its widest, ≈ 0.49 m across both — the bideltoid breadth, wider than anything on the arm below it) */
function deltArc(rig, deg) {
  const d = rig.dims, k = d.H / 1.67, sh = R(rig, 'uarm_r');
  const a = deg * Math.PI / 180, r = 0.058 * k;
  return [d.shX - 0.003 * k + r * Math.cos(a), sh.y - 0.042 * k + r * Math.sin(a)];
}

/**
 * The bare torso from under the head down to the ring tagged `until` (tucked inside the garment that starts there).
 * The NECK is part of the same tube (head(…, { neck: false })): from under the skull it widens into the trapezius,
 * whose rings descend toward the front and the back as well as to the sides, so the skin runs on without a seam —
 * down to the collarbones in front, down the nape to the upper back behind (a separate neck tube meeting a torso ring
 * read as a post set in a collar). The shoulder line stays inside the deltoid caps (bareArm). H: head() frame.
 */
export function bareTorso(B, rig, lod, until = 'waist', H = headFrame(rig, lod)) {
  const d = rig.dims, k = d.H / 1.67;
  const ch = R(rig, 'chest'), sh = R(rig, 'uarm_r'), nk = R(rig, 'neck');
  const base = torsoRings(rig, { thick: -0.001 });
  const end = base.findIndex((q) => q.tag === until);
  const nr = d.neckR;
  const tl = trapLine(rig);
  const neck = lod >= 3 ? [] : neckRings(rig, H);
  // the shoulder carries the deltoid (one skin over the joint): over the acromion, its widest ≈ 4 cm lower, then in
  // under it to the armpit — the arm (bareArm) grows out from inside this mass below its widest. (A dome on the arm's
  // tube read as a lid set on a pipe, with a seam where it met the torso.) The trapezius falls gently toward the back.
  // rings round the deltoid's arc (the rz grows from the trapezius' to the chest's depth over the cap)
  const arcR = (deg, tag, f = 0, b = 0) => {
    const [x, y] = deltArc(rig, deg), u = clamp((90 - deg) / 90);
    return { c: V(0, y, lerp(0.01, 0.012, u)), rx: x, rz: d.chest[1] * lerp(0.92, 1.0, u), tag, f: f * (1 - u), b: b * (1 - u), rf: lerp(0.97, 1, u) };
  };
  // the arc ends at its widest: there the arm (bareArm) takes over the outer contour, and the torso turns in steeply
  // under it to the armpit (a clean crossing; running on down beside the arm, the two surfaces fought)
  const arcs = lod === 0 ? [[80, 'shoulder'], [56, 'delt1'], [30, 'delt2'], [0, 'delt']] : lod === 1 ? [[74, 'shoulder'], [32, 'delt1'], [0, 'delt']] : [[70, 'shoulder'], [0, 'delt']];
  const up = [
    ...neck,
    { c: V(0, tl[1][1], nk.z), rx: tl[1][0], rz: nr * 1.2, tag: 'trap0', f: -0.014, b: -0.004, rf: 0.88 },
    { c: V(0, tl[2][1], 0.012), rx: tl[2][0], rz: d.chest[1] * 0.8, tag: 'trap', f: -0.03, b: -0.005, rf: 0.94 },
    ...arcs.map(([deg, tag]) => arcR(deg, tag, -0.024, -0.004)),
    { c: V(0, sh.y - 0.084 * k, 0.006), rx: d.chest[0] * 1.05, rz: d.chest[1] * 1.02, tag: 'pit', f: 0, b: 0, rf: 1 },   // in under the cap
  ];
  const body = base.slice(base.findIndex((q) => q.tag === 'shoulder') + 1, end + 1).map((q) => ({ ...q, c: q.c.clone(), f: 0, b: 0, rf: 1 }));
  let rings = [...up, ...body];
  const yPec = ch.y + 0.01 * k, yTop = sh.y - 0.012 * k;
  if (lod === 0) { // rows placed on the pectorals' and shoulder blades' features
    const src = [up[up.length - 1], ...body];
    const at = (y, tag) => {
      let j = 1;
      while (j < src.length - 1 && src[j].c.y > y) j++;
      const a = src[j - 1], b = src[j], t = clamp((a.c.y - y) / Math.max(1e-4, a.c.y - b.c.y));
      return { c: a.c.clone().lerp(b.c, t), rx: lerp(a.rx, b.rx, t), rz: lerp(a.rz, b.rz, t), tag, f: lerp(a.f, b.f, t), b: lerp(a.b, b.b, t), rf: lerp(a.rf, b.rf, t) };
    };
    const ys = [yPec + 0.06 * k, yPec + 0.035 * k, yPec + 0.014 * k, yPec - 0.004 * k, yPec - 0.026 * k, yPec - 0.06 * k];
    const extra = ys.filter((y) => y > body[body.length - 1].c.y).map((y, i) => at(y, `f${i}`));
    rings = [...up, ...extra, ...body.filter((q) => q.c.y < yPec - 0.07 * k)];
    const lowest = rings[rings.length - 1];
    if (until !== 'ribs' && lowest.tag !== until) rings.push(body[body.length - 1]);
  } else if (lod >= 2) rings = rings.filter((q) => ['neck2', 'neck0', 'trap0', 'shoulder', 'delt', 'chest', 'waist', 'hips'].includes(q.tag) || q.tag === until);
  const nNeck = rings.findIndex((q) => q.tag === 'trap0');
  const win = (y, a, b, c, e) => smooth(a, b, y) * (1 - smooth(c, e, y));
  const pecAt = (ax, F, y) => 0.25 * Math.exp(-(((ax - 0.43) / 0.22) ** 2)) * F ** 0.5 * win(y, yPec - 0.012 * k, yPec + 0.022 * k, yTop - 0.045 * k, yTop + 0.01 * k);
  const sculpt = (th, j) => {
    const Rg = rings[j];
    const cs = Math.cos(th), sn = Math.sin(th);
    const F = Math.max(0, -sn), Bk = Math.max(0, sn), ax = Math.abs(cs);
    const front = 1 - (1 - Rg.rf) * F ** 1.5;                       // the upper rings narrower in front (the throat)
    if (lod >= 2) return front;
    if (j < nNeck) {                                                  // the neck: fuller nape, the larynx in front
      return 1 + 0.05 * Bk ** 2 + (lod === 0 ? 0.03 * F ** 6 * (Rg.tag === 'neck1' ? 1 : 0.4) : 0);
    }
    const y = Rg.c.y;
    if (Rg.tag.startsWith('delt') || Rg.tag === 'shoulder') {
      const heads = 0.05 * Math.sin(2 * th) ** 2 * smooth(0.4, 0.8, ax);   // the anterior and posterior deltoid
      return front * (1 + heads + 0.04 * Bk * Math.exp(-(((ax - 0.5) / 0.25) ** 2)));   // and the blade's spine behind
    }
    // pectorals either side of the sternum's groove, their lower border a soft step; collar bones over them
    const pec = pecAt(ax, F, y);
    const sternum = -0.05 * Math.exp(-((cs / 0.13) ** 2)) * F * win(y, yPec - 0.08 * k, yPec, yTop, yTop + 0.03 * k);
    const clav = 0.045 * Math.exp(-(((ax - 0.5) / 0.3) ** 2)) * F * win(y, sh.y - 0.03 * k, sh.y - 0.012 * k, sh.y + 0.004 * k, sh.y + 0.02 * k);
    // shoulder blades, the spine's furrow between the long back muscles, the lats under the arms
    const blade = 0.13 * Math.exp(-(((ax - 0.45) / 0.2) ** 2)) * Bk * win(y, ch.y - 0.05 * k, ch.y + 0.03 * k, yTop - 0.03 * k, yTop + 0.02 * k)
      + 0.05 * Math.exp(-(((ax - 0.36) / 0.1) ** 2)) * Bk * Math.exp(-(((y - (ch.y - 0.035 * k)) / (0.02 * k)) ** 2))   // the lower angles
      - 0.035 * Math.exp(-(((ax - 0.2) / 0.08) ** 2)) * Bk * win(y, ch.y - 0.02 * k, ch.y + 0.02 * k, yTop - 0.04 * k, yTop);   // between blade and spine
    const spine = -0.05 * Math.exp(-((cs / 0.09) ** 2)) * Bk + 0.03 * Math.exp(-(((ax - 0.22) / 0.11) ** 2)) * Bk * (1 - smooth(ch.y, sh.y, y));
    const lats = 0.05 * Math.exp(-(((ax - 0.86) / 0.14) ** 2)) * win(y, ch.y - 0.11 * k, ch.y - 0.03 * k, ch.y + 0.07 * k, ch.y + 0.12 * k);
    // the belly's gentle round and the navel's hollow (front, below the ribs)
    const belly = 0.035 * F * F * win(y, R(rig, 'pelvis').y - 0.06 * k, R(rig, 'spine').y - 0.04 * k, ch.y - 0.09 * k, ch.y - 0.04 * k)
      - 0.03 * Math.exp(-((cs / 0.06) ** 2)) * F * Math.exp(-(((y - (R(rig, 'spine').y - 0.03 * k)) / (0.012 * k)) ** 2));
    return front * (1 + pec + sternum + clav + blade + spine + lats + belly);
  };
  const shade = lod >= 2 ? null : (th, j, p) => {
    if (j < nNeck) return j === 0 ? 0.82 + 0.18 * Math.max(0, Math.sin(th)) : 1;    // the shadow under the jaw
    const F = Math.max(0, -Math.sin(th)), Bk = Math.max(0, Math.sin(th)), ax = Math.abs(Math.cos(th));
    // under the pectorals' border, the sternum's groove, the armpit's hollow, the furrow of the spine, the notch
    // between the collarbones
    const under = 0.24 * Math.exp(-(((p.y - (yPec - 0.008 * k)) / (0.016 * k)) ** 2)) * Math.exp(-(((ax - 0.52) / 0.3) ** 2)) * F;
    const groove = 0.1 * Math.exp(-((Math.cos(th) / 0.1) ** 2)) * (F + Bk) * win(p.y, yPec - 0.1 * k, yPec - 0.02 * k, yTop, yTop + 0.04 * k);
    const notch = 0.12 * Math.exp(-((Math.cos(th) / 0.12) ** 2)) * F * win(p.y, sh.y - 0.03 * k, sh.y - 0.01 * k, sh.y + 0.01 * k, sh.y + 0.025 * k);
    const pit = 0.2 * smooth(0.8, 0.97, ax) * win(p.y, ch.y - 0.02 * k, ch.y + 0.05 * k, sh.y - 0.07 * k, sh.y - 0.03 * k);
    const ridge = 0.05 * pecAt(ax, F, p.y) / 0.25;   // the pectorals' tops catch a little more light
    const bladeAO = 0.1 * Bk * Math.exp(-(((ax - 0.42) / 0.2) ** 2)) * Math.exp(-(((p.y - (ch.y - 0.055 * k)) / (0.025 * k)) ** 2));
    return 1 - under - groove - notch - pit - bladeAO + ridge;
  };
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  const tw = torsoW(rig);
  const nw = (p) => envelope(rig, p, { chest: 0.6, neck: 1, head: 0.8 }, 4);
  // the deltoid's mass on the torso goes partly with the arm (and its clavicle), so a raised or swung arm carries it
  const I = rig.index;
  const dw = (p) => {
    const ax = Math.abs(p.x), side = p.x < 0 ? 'l' : 'r';
    const f = 0.6 * smooth(d.shX - 0.035 * k, d.shX + 0.03 * k, ax) * smooth(sh.y - 0.11 * k, sh.y - 0.05 * k, p.y) * (1 - smooth(sh.y + 0.005 * k, sh.y + 0.035 * k, p.y));
    const base = tw(p);
    return f < 0.01 ? base : normW([...base.map(([b, w]) => [b, w * (1 - f)]), [I[`clav_${side}`], 0.3 * f], [I[`uarm_${side}`], 0.7 * f]]);
  };
  const v0 = B.count;
  B.tube(rings, { seg: L3(lod, 44, 18, 8), radial: sculpt, shade, capA: lod >= 3 ? null : 'flat',
    // the neck's rings follow the neck and head, the trapezius blends from them into the torso
    weights: (p, j) => (j < nNeck ? nw(p) : j === nNeck ? normW([...nw(p).map(([b, w]) => [b, w * 0.4]), ...tw(p).map(([b, w]) => [b, w * 0.6])]) : dw(p)),
    // the upper rings fall away toward the front (to the collarbones) and the back (down the nape)
    lift: (th, j, Rg) => (Rg.f * Math.max(0, -Math.sin(th)) ** 1.2 + Rg.b * Math.max(0, Math.sin(th)) ** 1.2) * k });
  // under the deltoid's widest, where the torso turns in and the arm takes over the outer contour, the torso is shaded
  // as the arm is (its normals as good as level): no dark crease along the junction
  if (lod <= 1) {
    const yW = deltArc(rig, 0)[1], yP = sh.y - 0.084 * k;
    B.normalFix(v0, B.count, (p, n) => {
      if (p.y > yW + 0.003 * k || p.y < yP - 0.004 * k || Math.abs(p.x) < d.shX - 0.025 * k || n.y > 0) return n;
      n.y *= 0.15;
      return n.normalize();
    });
  }
}

/** a bare arm: from inside the shoulder's deltoid (bareTorso carries its top) — the deltoid's lower part, its
 *  insertion, biceps and triceps, the narrower part above the elbow, the elbow's bones, the forearm's bulk, the hand */
export function bareArm(B, rig, lod, s) {
  const morph = B.morph;
  B.morph = null;
  const k = rig.dims.H / 1.67, sg = s === 'l' ? -1 : 1;
  const sh = R(rig, `uarm_${s}`), el = R(rig, `farm_${s}`), wr = R(rig, `hand_${s}`);
  const Wa = (p) => envelope(rig, p, { [`clav_${s}`]: 0.5, [`uarm_${s}`]: 1, [`farm_${s}`]: 1, [`hand_${s}`]: 0.7, chest: 0.25 }, 4);
  // the top (inside the torso's deltoid) goes with the shoulder girdle and the arm as the torso there does; the arm
  // takes over over ≈ 6 cm below the joint
  const I = rig.index;
  const W = (p) => {
    const f = smooth(sh.y, sh.y - 0.065 * k, p.y);
    if (f >= 0.999) return Wa(p);
    return normW([[I[`clav_${s}`], 0.45 * (1 - f)], [I[`uarm_${s}`], 0.4 * (1 - f)], [I.chest, 0.15 * (1 - f)], ...Wa(p).map(([b, w]) => [b, w * f])]);
  };
  const mid = (a, b, t) => a.clone().lerp(b, t);
  // the tube starts inside the deltoid (bareTorso's 'delt' ring is ≈ shX + 5 cm wide) and comes out below its widest
  const inTop = sh.clone().add(V(-sg * 0.016 * k, -0.012 * k, 0));
  let pts, rad;
  if (lod >= 2) {
    pts = [inTop, mid(sh, el, 0.3), el, wr.clone().add(V(0, 0.012, 0))];
    rad = [[0.03, 0.036], [0.05, 0.055], [0.041, 0.042], [0.029, 0.022]];
  } else {
    pts = [inTop, mid(sh, el, 0.17), mid(sh, el, 0.29), mid(sh, el, 0.44), mid(sh, el, 0.6), mid(sh, el, 0.76), mid(sh, el, 0.9), el,
      mid(el, wr, 0.17), mid(el, wr, 0.38), mid(el, wr, 0.68), wr.clone().add(V(0, 0.012, 0))];
    // [across, front–back]: the deltoid's lower part, its insertion, the biceps/triceps (deepest front–back at the
    // biceps' peak), narrower above the elbow, the elbow, the forearm's flexor/extensor bulk (widest a hand below the
    // elbow), the flatter wrist
    rad = [[0.028, 0.032], [0.048, 0.05], [0.049, 0.054], [0.046, 0.054], [0.045, 0.053], [0.042, 0.046], [0.039, 0.041], [0.04, 0.043],
      [0.046, 0.044], [0.043, 0.038], [0.035, 0.029], [0.029, 0.022]];
  }
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.55, metal: 0, color: [1, 1, 1], grp: 0 });
  const sc = (r) => (Array.isArray(r) ? [r[0] * k, r[1] * k] : r * k);
  const rings = limbRings(pts, rad.map(sc));
  const J = lod >= 2 ? { bi: [] } : { delt: 1, ins: 2, bi: [3, 4], above: 6, elbow: 7, fore: 8, fore2: 9 };
  B.tube(rings, {
    seg: L3(lod, 20, 9, 5), weights: W,
    // θ = 0 toward +x (outside of the right arm), π/2 toward the back: the deltoid rounder at the outside, the biceps in
    // front and triceps behind, the olecranon's point and the epicondyles at the elbow with its hollow in front, the
    // forearm's extensor bulk toward the outside-front
    radial: lod === 0 ? (th, j) => {
      const F = Math.max(0, -Math.sin(th)), Bk = Math.max(0, Math.sin(th)), out = Math.max(0, sg * Math.cos(th)), side = Math.abs(Math.cos(th));
      let m = 1;
      if (j === J.delt) m += 0.03 * F;
      if (j === J.ins) m += 0.03 * out + 0.02 * F - 0.02 * (1 - out) * Bk;
      if (J.bi.includes(j)) m += (j === J.bi[1] ? 0.12 : 0.08) * F ** 1.6 + 0.07 * Bk ** 1.3;
      if (j === J.above) m += -0.04 * F + 0.03 * Bk;
      if (j === J.elbow) m += 0.13 * Bk ** 6 - 0.06 * F + 0.05 * side ** 4;
      if (j === J.fore) m += 0.1 * Math.max(0, 0.7 * out + 0.7 * F) ** 2;
      if (j === J.fore2) m += 0.05 * Math.max(0, 0.7 * out + 0.7 * F) ** 2;
      return m;
    } : null,
    // the side toward the body in its shadow; the hollow in front of the elbow
    shade: lod <= 1 ? (th, j, p) => 1 - 0.12 * Math.max(0, -sg * (p.x - (j < 7 ? sh.x : el.x)) / 0.05) * (j <= 6 ? 1 : 0.5)
      - (lod === 0 && j === J.elbow ? 0.08 * Math.max(0, -Math.sin(th)) : 0) : null,
  });
  hand(B, rig, lod, s);
  B.morph = morph;
}

/** the michnasayim: plain linen breeches "from the loins to the thighs" — from above the navel close under the chest to
 *  the knee, closed like a pouch, with drawstrings (Rambam Klei HaMikdash 8:18; Shemot 28:42). Loose linen, gathered
 *  in fine pleats under the drawstring and filling out over the hips. Cut like trousers: the body tube ends at the
 *  seat, and each leg starts as that ring's half — a D whose flat inner wall is the crotch seam, skinned like the body
 *  there — so the legs grow out of the seat with no hem or step in any pose, then round out and taper to the knee. */
export function michnasayim(B, rig, lod) {
  const d = rig.dims, k = d.H / 1.67;
  const ch = R(rig, 'chest'), sp = R(rig, 'spine'), pv = R(rig, 'pelvis'), hp = R(rig, 'thigh_r');
  const top = ch.y - 0.05 * k;
  B.set({ cls: CLS.GA, pat: PAT.LINEN, rough: 0.86, metal: 0, color: [1, 1, 1], grp: 0 });
  const seat = { c: V(0, hp.y - 0.025 * k, 0.012), rx: d.hips[0] * 0.98 + 0.016, rz: d.hips[1] * 1.02 + 0.018 };
  const rings = [
    { c: V(0, top, 0.0), rx: d.chest[0] * 0.94 + 0.006, rz: d.chest[1] * 0.96 + 0.007 },             // gathered under the string, just over the skin
    { c: V(0, top - 0.025 * k, 0.0), rx: d.chest[0] * 0.93 + 0.011, rz: d.chest[1] * 0.95 + 0.013 },
    { c: V(0, sp.y, 0.002), rx: d.waist[0] + 0.016, rz: d.waist[1] + 0.018 },
    { c: V(0, pv.y - 0.03 * k, 0.006), rx: d.hips[0] + 0.02, rz: d.hips[1] + 0.02 },               // filling out over the hips
    seat,
  ];
  const nr = lod >= 2 ? [rings[0], rings[2], rings[4]] : rings;
  const seg = L3(lod, 40, 16, 7);
  // folds: fine pleats under the string that open into a few soft folds falling over the hips (none at the seat ring,
  // which the legs continue)
  const pleat = (th, j) => (Math.abs(Math.sin(th * 13 + j * 0.35)) - 0.637);
  const fold = (th, j) => (Math.abs(Math.sin(th * 4.5 + 0.8 + j * 0.2)) - 0.637);
  const pA = [0.03, 0.065, 0.035, 0.012, 0], fA = [0, 0.01, 0.035, 0.03, 0];
  const bodyW = torsoW(rig, 0.05);
  // the body and the legs meet on the seat ring: both are shaded there with the ring's own (ellipse) normal, so the
  // junction leaves no line
  const seatN = (q, n) => {
    if (Math.abs(q.y - seat.c.y) > 0.002 || Math.abs(q.x) < 0.012) return n;
    return n.set(q.x / (seat.rx * seat.rx), 0.15 * n.y, (q.z - seat.c.z) / (seat.rz * seat.rz)).normalize();
  };
  const v0 = B.count;
  B.tube(nr, { seg, weights: bodyW,
    radial: lod === 0 ? (th, j) => 1 + pleat(th, j) * pA[j] + fold(th, j) * fA[j] : null,
    shade: lod <= 1 ? (th, j) => 1 - Math.max(0, -pleat(th, j)) * pA[j] * 4 - Math.max(0, -fold(th, j)) * fA[j] * 5 : null });
  // the legs: from the seat ring's half down to the knee — loose linen, folds spiralling a little
  for (const [s, sg] of [['l', -1], ['r', 1]]) {
    const th = R(rig, `thigh_${s}`), kn = R(rig, `shin_${s}`);
    const legW = (p) => {
      const u = clamp((th.y - p.y) / Math.max(0.05, th.y - kn.y));
      return normW([[rig.index.pelvis, 1.2 * (1 - smooth(0, 0.35, u))], [rig.index[`thigh_${s}`], 1], [rig.index[`shin_${s}`], 0.9 * smooth(0.82, 1.08, u)]]);
    };
    // the D: centred half-way out, half as wide as the seat ring; its outer side lies on the seat ring's ellipse, its
    // inner side is a flat wall at the midline (m: the radius multiplier per θ, θ = 0 toward +x)
    const D = (th0) => {
      const c = Math.cos(th0) * sg, sn = Math.sin(th0);
      const a = 0.25 * c * c + sn * sn, bq = 0.5 * c;
      const mE = (-bq + Math.sqrt(bq * bq + 3 * a)) / (2 * a);
      return c < -1e-3 ? Math.min(mE, -1 / c) : mE;
    };
    const yA = seat.c.y;
    // loose linen: the legs stay full to the knee (no tailored taper), hanging a little off the thigh behind
    const legRings = [
      { c: V(sg * seat.rx / 2, yA, seat.c.z), rx: seat.rx / 2, rz: seat.rz, dn: 1 },
      { c: V(sg * (seat.rx / 2 + 0.008 * k), yA - 0.045 * k, seat.c.z - 0.002), rx: seat.rx / 2 + 0.008 * k, rz: seat.rz * 0.92, dn: 0.55 },
      { c: V(th.x * 1.0, lerp(th.y, kn.y, 0.3), 0.004), rx: 0.097 * k, rz: 0.1 * k, dn: 0 },
      { c: V(th.x * 1.01, lerp(th.y, kn.y, 0.55), 0.002), rx: 0.094 * k, rz: 0.097 * k, dn: 0 },
      { c: V(kn.x * 1.02, lerp(th.y, kn.y, 0.8), -0.002), rx: 0.09 * k, rz: 0.093 * k, dn: 0 },
      { c: V(kn.x * 1.02, kn.y - 0.025 * k, -0.004), rx: 0.089 * k, rz: 0.091 * k, dn: 0 },
    ];
    const sel = lod >= 2 ? [0, 2, 5] : lod === 1 ? [0, 1, 2, 4, 5] : [0, 1, 2, 3, 4, 5];
    const lr = sel.map((i) => legRings[i]);
    const last = lr.length - 1;
    // folds: a few soft ones spiralling down, and drag folds from the crotch out toward the outer knee (deeper in the
    // upper leg, where the cloth is pulled between the legs)
    const lf = (t, j) => (Math.abs(Math.sin(t * 3 + j * 0.9 + sg)) - 0.637);
    const drag = (t, j) => Math.max(0, Math.cos(t * 2 - sg * 0.6 + j * 0.55)) ** 3 * (j >= 1 && j <= 3 ? 1 : 0.35);
    // an uneven hem: the cloth hangs a little lower behind and at the outside, with a soft wave
    const hemLift = (t) => (0.012 * Math.sin(t * 3 + 1.3 * sg) - 0.012 * Math.max(0, Math.sin(t)) - 0.008 * Math.max(0, sg * Math.cos(t))) * k;
    B.tube(lr, { seg: L3(lod, 24, 10, 5),
      weights: (p, j) => (j === 0 ? bodyW(p) : legW(p)),               // the first ring skinned as the seat it continues
      radial: (t, j) => {
        const dn = lr[j].dn, m = dn > 0 ? lerp(1, D(t), dn) : 1;
        return m * (lod === 0 && j > 1 ? 1 + 0.08 * lf(t, j) - 0.05 * drag(t, j) : 1);
      },
      lift: lod <= 1 ? (t, j) => (j === last ? hemLift(t) : 0) : null,
      shade: lod <= 1 ? (t, j) => 1 - (j > 1 ? 0.18 * Math.max(0, -lf(t, j)) + 0.16 * drag(t, j) : 0) - 0.14 * Math.max(0, -sg * Math.cos(t)) * smooth(0, 1, lr[j].dn) : null });
    if (lod <= 1) {
      const hm = lr[last];
      B.tube([{ ...hm, c: hm.c.clone() }, { ...hm, c: hm.c.clone().add(V(0, 0.04, 0)), rx: hm.rx * 0.95, rz: hm.rz * 0.95 }], { seg: L3(lod, 24, 10, 5), invert: true, weights: legW, shade: () => 0.55,
        lift: (t, j) => (j === 0 ? hemLift(t) : 0),
        radial: lod === 0 ? (t) => 1 + 0.08 * lf(t, last) - 0.05 * drag(t, last) : null });
    }
  }
  B.normalFix(v0, B.count, seatN);
  // the drawstring and its knot at the front (shnatzim)
  if (lod === 0) {
    B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.8, metal: 0, color: '#e8e2d2', grp: 0 });
    const r0 = rings[0], W = torsoW(rig, 0);
    const pts = Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return V(Math.cos(a) * (r0.rx * 1.02 + 0.006), top - 0.002, Math.sin(a) * (r0.rz * 1.02 + 0.006)); });
    B.tube(limbRings(pts, pts.map(() => 0.0042)), { seg: 5, weights: W });
    const kn0 = V(0.01, top - 0.006, -r0.rz - 0.01);
    B.ellipsoid(kn0, [0.009, 0.007, 0.006], { nu: 7, nv: 4, weights: W });
    for (const x of [-0.004, 0.012]) B.ribbon([kn0.clone().add(V(x, -0.004, -0.002)), kn0.clone().add(V(x * 1.5, -0.07 * k, -0.012)), kn0.clone().add(V(x * 2, -0.13 * k, -0.016))], 0.006, { side: V(1, 0, 0), weights: W });
  }
}

/** the bather's linen sheet, wrapped round from the waist to mid-calf and tucked in at the front-left; it stands for
 *  the towel of "he came up and dried himself" (Tamid 1:1) — the immersion itself is without garments */
export function bathWrap(B, rig, lod) {
  const k = rig.dims.H / 1.67;
  const hemY = R(rig, 'shin_r').y - 0.17 * k;
  B.set({ cls: CLS.GA, pat: PAT.LINEN, rough: 0.86, metal: 0, color: [1, 1, 1], grp: 0 });
  // wrapped snug (thick 0.008): a towel stands off the skin only by its own thickness, so the back's curve in the
  // immersion crouch does not lift its rolled top off the lower back
  const rings = garmentBody(B, rig, lod, hemY, { from: 'waist', folds: 0.06, nFolds: 9, flare: 0.045 * k, thick: 0.008, foldFrom: 'hips', seed: 3.7 });
  if (lod <= 1) {
    // the tucked end: a vertical fold standing a little proud at the front-left, laid on the wrap's own drape (on plain
    // rings it cut in and out of the folds); and the rolled top edge, close round the waist
    const W = skirtW(rig, R(rig, 'thigh_r').y - 0.06 * k, hemY);
    const th0 = Math.PI * 1.32;
    const dr = rings.radial || (() => 1);
    B.grid(2, rings.length - 1, (i, j) => {
      const Rg = rings[j], t = th0 + (i / 2) * 0.22;
      const out = (dr(t, j) + 0.03 + 0.01 * Math.sin((i / 2) * Math.PI)) * 1.005;
      return { p: V(Math.cos(t) * Rg.rx * out, Rg.c.y, Rg.c.z + Math.sin(t) * Rg.rz * out), u: i * 0.05, v: -j * 0.1, w: (q) => (j === 0 ? torsoW(rig)(q) : W(q)), shade: 0.92 };
    }, { inside: (A) => V(0, A.y, 0) });
    const r0 = rings[0];
    B.tube(limbRings(Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return V(Math.cos(a) * (r0.rx + 0.002), r0.c.y + 0.003, r0.c.z + Math.sin(a) * (r0.rz + 0.002)); }), Array(33).fill(0.0075)), { seg: 6, weights: torsoW(rig) });
  }
  return hemY;
}

// --------------------------------------------------------------------------------------------- recipes
function withBody(B, rig, lod, fn) {
  if (lod <= 1) B.morph = bodyMorph(rig);
  fn();
  B.morph = null;
}

/** the priestly headgear in its mask group, and the hair shells shown in its place when it is lifted off (Yoma 25a) */
function headgear(B, rig, lod, H, fn, hairline) {
  fn({ grp: GRP.HEADGEAR });
  if (lod <= 1) hair(B, rig, lod, H, { hairline, napeOnly: true, grp: GRP.BARE });
  if (lod === 0) hair(B, rig, lod, H, { hairline, shellsOnly: true, grp: GRP.BARE });
}

export const RECIPES = {
  kohen(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04, covered: true });   // kohanim kept their hair short (Taanit 17a)
    beard(B, rig, lod, H, { len: 0.04 });
    headgear(B, rig, lod, H, (o) => migbaat(B, rig, lod, H, o), 0.04);
    let hemY;
    withBody(B, rig, lod, () => { hemY = ketonet(B, rig, lod); avnet(B, rig, lod); });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.1 });
  },
  kg_white(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04, covered: true });
    beard(B, rig, lod, H, { len: 0.05 });
    headgear(B, rig, lod, H, (o) => mitznefet(B, rig, lod, H, { cls: CLS.FIX, color: COL.linenKG, base: 0.05, ...o }), 0.04);
    let hemY;
    withBody(B, rig, lod, () => { hemY = ketonet(B, rig, lod, { cls: CLS.FIX, color: COL.linenKG }); avnet(B, rig, lod, { white: true }); });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.1 });
  },
  kg_gold(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04, covered: true });
    beard(B, rig, lod, H, { len: 0.05 });
    headgear(B, rig, lod, H, (o) => { mitznefet(B, rig, lod, H, o); tzitz(B, rig, lod, H, o); }, 0.04);
    withBody(B, rig, lod, () => {
      ketonet(B, rig, lod, { noBody: true }); // only the sleeves show from under the sleeveless me'il
      meil(B, rig, lod);
      ephod(B, rig, lod);
      choshen(B, rig, lod);
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: R(rig, 'foot_r').y + 0.2 });
  },
  // an elder of the beit av in the four garments: the older rig, receding hairline, long grey beard
  kohen_elder(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.07, covered: true });
    beard(B, rig, lod, H, { len: 0.1, volume: 0.004 });
    headgear(B, rig, lod, H, (o) => migbaat(B, rig, lod, H, o), 0.07);
    let hemY;
    withBody(B, rig, lod, () => { hemY = ketonet(B, rig, lod); avnet(B, rig, lod); });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.1 });
  },
  // stripped to the michnasayim (Tamid 5:3): bare from the chest up, head bare, linen breeches to the knee, bare shins
  kohen_breeches(B, rig, lod) {
    const H = head(B, rig, lod, { neck: false });
    hair(B, rig, lod, H, { hairline: rig.dims.style === 'elder' ? 0.07 : 0.04 });
    beard(B, rig, lod, H, rig.dims.style === 'elder' ? { len: 0.1, volume: 0.004 } : { len: 0.04 });
    withBody(B, rig, lod, () => { bareTorso(B, rig, lod, 'waist', H); michnasayim(B, rig, lod); });
    for (const s of ['l', 'r']) { bareArm(B, rig, lod, s); foot(B, rig, lod, s, { to: R(rig, `shin_${s}`).y + 0.06 }); }
  },
  // the bather: a linen sheet wrapped from the waist to mid-calf (Tamid 1:1–2; Yoma 3:3)
  kohen_bathing(B, rig, lod) {
    const H = head(B, rig, lod, { neck: false });
    hair(B, rig, lod, H, { hairline: rig.dims.style === 'elder' ? 0.07 : 0.04 });
    beard(B, rig, lod, H, rig.dims.style === 'elder' ? { len: 0.1, volume: 0.004 } : { len: 0.04 });
    let hemY;
    // the skin ends under the wrap's rolled top (the belly's round would cross the wrap's folds below it), and the shins
    // only just above the hem (higher, the knees came out through the wrap as they bent in the immersion)
    withBody(B, rig, lod, () => { bareTorso(B, rig, lod, 'waist', H); hemY = bathWrap(B, rig, lod); });
    for (const s of ['l', 'r']) { bareArm(B, rig, lod, s); foot(B, rig, lod, s, { to: hemY + 0.05 }); }
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
  israelite(B, rig, lod, cloth = null) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.05, grp: GRP.HAIR });
    beard(B, rig, lod, H, { len: 0.045, grp: GRP.BEARD });
    shavenScalp(B, rig, lod, H, { hairline: 0.05 });
    shavenFace(B, rig, lod, H);
    headCloth(B, rig, lod, H, cloth || { grp: GRP.HEADCLOTH, short: true, open: 1.05, backY: R(rig, 'uarm_r').y - 0.08 });
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.2 * rig.dims.H / 1.67 });
      belt(B, rig, lod, { thick: 0.008 });
      mantle(B, rig, lod, {});
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  // the mourner and the one under a ban (Middot 2:2): an Israelite wrapped in the atifah (wrapDrape) (people-4-fix)
  mourner(B, rig, lod) { RECIPES.israelite(B, rig, lod, { grp: GRP.HEADCLOTH, wrap: true, open: 0.72 }); },
  nazir(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.055, long: true, volume: 0.006, grp: GRP.HAIR });
    beard(B, rig, lod, H, { len: 0.085, volume: 0.004, grp: GRP.BEARD });
    shavenScalp(B, rig, lod, H, { hairline: 0.055 });
    shavenFace(B, rig, lod, H);
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.2 * rig.dims.H / 1.67 });
      belt(B, rig, lod, { thick: 0.008 });
      mantle(B, rig, lod, {});
    });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  // the metzora of Vayikra 13:45: the tunic rent at the breast, the hair let grow long and uncombed, the beard untrimmed
  // ("he may not cut his hair or wash his clothes all the days of his declaration" - Rambam Tumat Tzara'at 10:6); shaven
  // all over on his seventh day (Actor.setShaven('all'), Vayikra 14:9)
  metzora(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.055, long: true, volume: 0.009, wild: 1.7, grp: GRP.HAIR });
    beard(B, rig, lod, H, { len: 0.1, volume: 0.007, grp: GRP.BEARD });
    shavenScalp(B, rig, lod, H, { hairline: 0.055 });
    shavenFace(B, rig, lod, H);
    let hemY;
    withBody(B, rig, lod, () => {
      hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.2 * rig.dims.H / 1.67, rent: true, seed: 1.9 });
      belt(B, rig, lod, { thick: 0.008 });
      mantle(B, rig, lod, { gap: 0.5 });
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

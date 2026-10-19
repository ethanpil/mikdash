// Procedural human figures: body parts and the garments of each archetype (rest pose, figure space).
// Only what can be seen is modelled (e.g. the michnasayim are entirely covered by the ketonet).
// Garment rules: report Part VIII §34 (kohanim: ketonet / michnasayim / avnet / migba'at, barefoot;
// Kohen Gadol: + me'il, ephod, choshen, tzitz, mitznefet). See docs/decisions/people.md.
import { Vector3, Matrix4 } from 'three';
import { MeshBuilder, envelope, normW, CLS, PAT } from './builder.js';
import { smooth, clamp, lerp } from './util.js';
import { AMAH } from '../core/units.js';

const V = (x, y, z) => new Vector3(x, y, z);
const R = (rig, n) => rig.rest[rig.index[n]];
const g2 = (x, y, cx, cy, sx, sy) => Math.exp(-(((x - cx) / sx) ** 2) - (((y - cy) / sy) ** 2));

// Fixed colours (sRGB). Dyes per report §26: techelet sky-blue wool, argaman red-purple, tola'at shani
// crimson, shesh white linen; gold.
export const COL = {
  linen: '#eeeadf', linenKG: '#f7f4ec', techelet: '#2f5d9e', argaman: '#6b2752', shani: '#a8202d',
  gold: '#e2b552', goldDeep: '#c4943a', shoham: '#20302b', tzitzit: '#f1ece0',
};

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

// --------------------------------------------------------------------------------------------- head
function headFrame(rig) {
  const d = rig.dims, fem = d.sex === 'f';
  const hs = d.headS * (fem ? 0.96 : 1);
  const pv = R(rig, 'head');
  const C = V(0, pv.y + 0.075 * hs, pv.z - 0.008 * hs);
  const r = [0.074 * hs * (fem ? 0.96 : 1), 0.108 * hs, 0.096 * hs];
  const f = { eyeY: 0.008 * hs, nTip: -0.036 * hs, mouthY: -0.061 * hs, chinY: -0.1 * hs };
  return { C, r, hs, f, young: !!d.young, fem };
}

/** head surface deformation (local coords relative to the head centre) */
function headShape(H) {
  const { r, hs, f, young, fem } = H;
  return (l) => {
    const { x, y, z } = l;
    const ny = y / r[1];
    const front = z < 0;
    const jaw = smooth(-0.1, -0.85, ny);
    const X = x * (1 - (young || fem ? 0.2 : 0.25) * jaw);
    let Z = z;
    if (!front) Z *= 1 - 0.45 * smooth(-0.1, -0.85, ny);
    else Z *= 1 - 0.1 * jaw;
    if (!front && ny > -0.2) Z *= 1.03;
    if (front) {
      Z *= 1 - 0.075 * Math.exp(-((x / (0.05 * hs)) ** 2));
      const { eyeY, nTip, mouthY, chinY } = f;
      // nose: bridge from between the brows, widening and rising to a rounded tip
      const t = smooth(eyeY + 0.01 * hs, nTip, y);
      const below = 1 - smooth(nTip - 0.001 * hs, nTip - 0.012 * hs, y);
      const nw = lerp(0.0085, 0.0125, t) * hs;
      const prot = (young ? 0.6 : 1) * hs * (0.006 + 0.012 * t) * below;
      Z -= prot * Math.exp(-((x / nw) ** 2));
      Z -= (young ? 0.6 : 1) * 0.005 * hs * g2(x, y, 0, nTip + 0.002 * hs, 0.009 * hs, 0.007 * hs); // rounded tip
      Z -= 0.0045 * hs * (g2(x, y, 0.0115 * hs, nTip + 0.003 * hs, 0.0065 * hs, 0.0055 * hs) + g2(x, y, -0.0115 * hs, nTip + 0.003 * hs, 0.0065 * hs, 0.0055 * hs));
      // brow ridge, eye sockets, cheekbones, lips, chin
      Z -= (fem ? 0.003 : 0.005) * hs * Math.exp(-(((y - (eyeY + 0.019 * hs)) / (0.008 * hs)) ** 2)) * smooth(0.058 * hs, 0.02 * hs, Math.abs(x));
      Z += 0.0055 * hs * (g2(x, y, 0.031 * hs, eyeY, 0.012 * hs, 0.0085 * hs) + g2(x, y, -0.031 * hs, eyeY, 0.012 * hs, 0.0085 * hs));
      Z -= 0.0035 * hs * (g2(x, y, 0.045 * hs, eyeY - 0.024 * hs, 0.014 * hs, 0.014 * hs) + g2(x, y, -0.045 * hs, eyeY - 0.024 * hs, 0.014 * hs, 0.014 * hs));
      Z -= 0.003 * hs * g2(x, y, 0, mouthY + 0.002 * hs, 0.019 * hs, 0.006 * hs);
      Z -= 0.0045 * hs * g2(x, y, 0, chinY + 0.012 * hs, 0.017 * hs, 0.011 * hs);
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

// longitudes concentrated toward the face
const phiFace = (k) => (t) => { const s = 2 * t - 1; return Math.PI * Math.sign(s) * Math.abs(s) ** k; };

export function head(B, rig, lod, o = {}) {
  const H = headFrame(rig);
  const shape = headShape(H);
  const hb = rig.index.head;
  B.set({ cls: CLS.SKIN, pat: lod < 2 ? PAT.FACE : PAT.SKIN, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 });
  const nu = L3(lod, 52, 16, 8), nv = L3(lod, 32, 10, 5);
  B.ellipsoid(H.C, H.r, {
    nu, nv, bone: hb,
    phiMap: lod === 0 ? phiFace(1.45) : lod === 1 ? phiFace(1.2) : null,
    thMap: lod === 0 ? (t) => t + 0.06 * Math.sin(t * Math.PI * 2) : null,
    deform: lod >= 2 ? (l) => { l.x *= 1 - 0.2 * smooth(-0.1, -0.85, l.y / H.r[1]); return l; } : shape,
    uvFn: (q) => [q.x / H.hs, q.y / H.hs + (q.z > 0.004 ? 10 : 0)],
  });
  if (lod === 0 && o.ears !== false) {
    for (const sg of [-1, 1]) {
      const m = new Matrix4().makeRotationY(sg * 0.35);
      B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 });
      B.ellipsoid(H.C.clone().add(V(sg * H.r[0] * 0.97, H.f.eyeY - 0.014 * H.hs, 0.012 * H.hs)), [0.009 * H.hs, 0.026 * H.hs, 0.016 * H.hs],
        { nu: lod ? 6 : 10, nv: lod ? 4 : 6, bone: hb, xf: m, shade: () => 0.9 });
    }
  }
  const nk = R(rig, 'neck');
  const nr = rig.dims.neckR;
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 });
  // the neck flares into the trapezius at its root and is fuller at the back than the front
  if (lod >= 3) return H; // far silhouette: the collar meets the head
  const top = V(0, H.C.y - 0.07 * H.hs, H.C.z + 0.018 * H.hs);
  B.tube([
    { c: V(0, nk.y - 0.045, nk.z + 0.004), rx: nr * 1.45, rz: nr * 1.2 },
    { c: V(0, nk.y + 0.0, nk.z + 0.002), rx: nr * 1.2, rz: nr * 1.06 },
    { c: V(0, nk.y + 0.03, nk.z - 0.002), rx: nr * 1.05, rz: nr * 1.0 },
    { c: V(0, lerp(nk.y + 0.03, top.y, 0.6), lerp(nk.z, top.z, 0.6) - 0.003), rx: nr * 0.98, rz: nr * 0.98 },
    { c: top, rx: nr * 0.96, rz: nr * 1.02 },
  ], { seg: L3(lod, 18, 9, 5), weights: (p) => envelope(rig, p, { chest: 0.6, neck: 1, head: 0.8 }, 4),
    radial: lod === 0 ? (th) => 1 + 0.05 * Math.max(0, Math.sin(th)) ** 2 : null }); // fuller nape (+z)
  return H;
}

/** hair cap (and optional long hair falling to the shoulders — the nazir lets it grow) */
export function hair(B, rig, lod, H, o = {}) {
  const shape = headShape(H);
  const hb = rig.index.head;
  B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.75, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  const nu = L3(lod, 30, 11, 6), nv = L3(lod, 11, 5, 3);
  const front = Math.acos(clamp((H.f.eyeY + (o.hairline ?? 0.05) * H.hs) / H.r[1], -1, 1));
  const side = Math.acos(clamp((H.f.eyeY + 0.014 * H.hs) / H.r[1], -1, 1));
  const back = Math.acos(clamp((o.long ? H.f.mouthY - 0.02 * H.hs : H.f.mouthY + 0.008 * H.hs) / H.r[1], -1, 1));
  const off = 0.0065 * H.hs + (o.volume || 0);
  B.grid(nu, nv, (i, j) => {
    const phi = (i / nu) * Math.PI * 2;
    const c = Math.cos(phi);
    const lb = c > 0 ? lerp(side, front, c ** 1.5) : lerp(side, back, (-c) ** 0.8);
    const th = Math.max(0.03, (j / nv) * lb);
    const y = Math.cos(th) * H.r[1];
    const S = headSurf(H, shape, phi, y);
    const n = S.clone().setY(S.y * 0.4).normalize();
    const edge = j === nv ? 0.3 : 1;
    const p = S.addScaledVector(n, off * edge).add(H.C);
    return { p, u: phi * 0.09, v: -th * 0.1, w: hb };
  }, { wrap: true, inside: H.C });
  if (o.long) {
    const sh = R(rig, 'uarm_r');
    const rings = [];
    const n = 4;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      const y = lerp(H.C.y + H.f.mouthY + 0.01, sh.y + 0.02, t);
      rings.push({ c: V(0, y, H.C.z + lerp(0.01, 0.03, t)), rx: lerp(H.r[0] * 0.95, rig.dims.shX * 0.72, t), rz: lerp(H.r[2] * 0.85, rig.dims.chest[1] * 1.05, t) });
    }
    B.tube(rings, {
      seg: L3(lod, 14, 8, 4), arc: [0.15, Math.PI - 0.15],
      weights: (p) => envelope(rig, p, { head: 1, neck: 0.9, chest: 0.5 }, 3),
      radial: (th, j) => 1 + (j ? 0.04 * Math.sin(th * 9) : 0),
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
 *  its lower edge is closed back to the throat, and its outline is broken into soft locks. */
export function beard(B, rig, lod, H, o = {}) {
  const shape = headShape(H);
  const hb = rig.index.head, nb = rig.index.neck;
  const { f, hs } = H;
  const len = (o.len ?? 0.04) * hs;
  const vol = o.volume || 0;
  B.set({ cls: CLS.HAIR, pat: PAT.HAIR, rough: 0.8, metal: 0, color: [1, 1, 1], grp: o.grp || 0 });
  const chinY = f.chinY - 0.006 * hs;
  const W = (p) => (p.y < H.C.y + chinY - 0.01 * hs ? normW([[hb, 0.8], [nb, 0.2]]) : [[hb, 1]]);
  const locks = lod === 0 ? (a, b) => 1 + 0.12 * Math.sin(a * 23 + 1.7) * Math.sin(b * 5 + a * 3) * smooth(0.25, 0.9, b) : () => 1;
  const prof = (a, b) => {
    const aa = Math.abs(a);
    const phi = a * 1.78;
    const yTop = aa < 0.28
      ? lerp(f.mouthY - 0.009 * hs, f.mouthY + 0.0 * hs, smooth(0.08, 0.28, aa))
      : lerp(f.mouthY, f.eyeY - 0.014 * hs, smooth(0.28, 1.0, aa) ** 0.85);
    const yBot = lerp(chinY - len, f.mouthY - 0.038 * hs, smooth(0.5, 1, aa));
    const y = lerp(yTop, yBot, b);
    const edge = smooth(0, 0.3, b) * (1 - 0.7 * smooth(0.7, 1, aa));      // thin at the cheek line and sideburns
    const t = ((0.0008 + 0.0125 * edge) * hs + vol * b) * locks(a, b);
    return { phi, y, t, hang: len, shade: 0.88 + 0.12 * smooth(0, 0.5, b) };
  };
  const nu = L3(lod, 28, 12, 6), nv = L3(lod, 10, 5, 2);
  faceShell(B, H, shape, nu, nv, prof, W);
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
      return { p, u: a * 0.1, v: k * 0.05, w: W(p), shade: 0.7 };
    }, { inside: H.C.clone().add(V(0, f.mouthY, 0)) });
  }
  // moustache over the upper lip, drooping at the corners
  if (lod < 2) {
    faceShell(B, H, shape, L3(lod, 12, 6, 2), L3(lod, 3, 2, 1), (a, b) => {
      const aa = Math.abs(a);
      const phi = a * 0.52;
      const yTop = lerp(f.nTip - 0.007 * hs, f.mouthY + 0.004 * hs, smooth(0.3, 1, aa));
      const yBot = lerp(f.mouthY + 0.0025 * hs, f.mouthY - 0.008 * hs, smooth(0.45, 1, aa));
      return { phi, y: lerp(yTop, yBot, b), t: (0.0012 + 0.0055 * Math.sin(Math.PI * Math.min(1, b * 1.3))) * hs + vol * 0.3, hang: 0 };
    }, () => [[hb, 1]]);
  }
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

/** a wound linen head-dress: windings shown as a helical ridge */
function wound(B, rig, lod, H, prof, o = {}) {
  const hb = rig.index.head;
  B.set({ cls: o.cls ?? CLS.GA, pat: PAT.LINEN, rough: 0.86, metal: 0, color: o.color || [1, 1, 1], grp: 0 });
  const rings = profileRings(H, prof, (o.base ?? 0.042) * H.hs, lod >= 3 ? 3 : L3(lod, 18, 8, 5), o.tall || 1);
  const pitch = 0.021 * H.hs;
  const n = rings.length;
  B.tube(rings, {
    seg: L3(lod, 32, 13, 7), bone: hb, capB: 'flat',
    radial: lod >= 2 ? null : (th, j) => {
      if (j === 0 || j >= n - 2) return 1;
      const ph = (rings[j].yy / pitch) * Math.PI * 2 - th;
      return 1 + 0.03 * (0.5 + 0.5 * Math.sin(ph)) ** 2 + 0.008 * Math.sin(th * 5 + j);
    },
    shade: lod >= 2 ? null : (th, j) => {
      if (j === 0 || j >= n - 2) return 1;
      const ph = (rings[j].yy / pitch) * Math.PI * 2 - th;
      return 0.9 + 0.1 * (0.5 + 0.5 * Math.sin(ph));
    },
  });
}

/** migba'at: the kohen hedyot's 16-amah linen winding, worn "like a hat" — a rounded dome (Rambam KhM 8) */
export function migbaat(B, rig, lod, H) {
  wound(B, rig, lod, H, [
    [0.0, 1.09, 1.07], [0.02, 1.16, 1.13], [0.05, 1.19, 1.15], [0.08, 1.17, 1.13], [0.104, 1.09, 1.05],
    [0.122, 0.95, 0.91], [0.136, 0.74, 0.71], [0.146, 0.45, 0.43], [0.15, 0.08, 0.08],
  ], { base: 0.04 });
}

/** mitznefet: the Kohen Gadol's turban, wound "like a bandage" — lower and broader (Rambam KhM 8) */
export function mitznefet(B, rig, lod, H, o = {}) {
  wound(B, rig, lod, H, [
    [0.0, 1.13, 1.1], [0.02, 1.23, 1.17], [0.05, 1.27, 1.21], [0.078, 1.25, 1.19],
    [0.098, 1.15, 1.09], [0.11, 0.9, 0.86], [0.117, 0.45, 0.43], [0.12, 0.08, 0.08],
  ], { base: o.base ?? 0.068, cls: o.cls, color: o.color });
}

/** tzitz: gold band ear to ear on the forehead, techelet cord behind (Shemot 28:36–38) */
export function tzitz(B, rig, lod, H) {
  const shape = headShape(H);
  const hb = rig.index.head;
  const { hs, f } = H;
  const y0 = f.eyeY + 0.021 * hs, y1 = f.eyeY + 0.058 * hs;
  B.set({ cls: CLS.FIX, pat: PAT.TZITZ, rough: 0.2, metal: 1, color: COL.gold, grp: 0 });
  const nu = L3(lod, 20, 10, 6);
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
  const nu = L3(lod, 30, 14, 7);
  const nv = L3(lod, 16, 9, 4);
  const open = o.open ?? 0.95;
  const bottomBack = o.backY ?? (ch.y - 0.05);
  const yEndAt = (phi) => lerp(f.eyeY + 0.042 * hs, f.mouthY - 0.012 * hs, smooth(-0.3, 0.9, -Math.cos(phi)));
  const W = (t) => (q) => envelope(rig, q, { head: 1.0, neck: 0.8, chest: t > 0 ? 0.9 : 0.05, clav_l: 0.4, clav_r: 0.4 }, 4);
  // cap: a full ring over the crown (seam at the back), down to the forehead in front / the nape behind
  // the neck root emerges behind the skull's base: anything the cloth wraps there keeps clear of it
  const neckClear = (y, back) => rig.dims.neckR * lerp(1.5, 1.1, smooth(nk.y - 0.05, nk.y + 0.06, y)) + 0.016 + 0.012 * Math.max(0, back);
  const clearNeck = (p, back) => {
    if (p.y > nk.y + 0.12 || p.y < nk.y - 0.08) return p;
    const dx = p.x, dz = p.z - nk.z, d = Math.hypot(dx, dz), m = neckClear(p.y, back);
    if (d < m && d > 1e-6) { p.x = dx * m / d; p.z = nk.z + dz * m / d; }
    return p;
  };
  // ... and the drape stays outside the shoulders, the raised back of the collar and the mantle over them
  const tr = torsoRings(rig, { thick: 0.035 }).filter((q) => q.c.y > ch.y - 0.12);
  const lift = backLift(rig);
  const torsoClear = (y, ang) => {
    if (y > tr[0].c.y + 0.02 || y < tr[tr.length - 1].c.y) return 0;
    let k = 0;
    while (k < tr.length - 2 && y < tr[k + 1].c.y) k++;
    const A = tr[k], Bq = tr[k + 1];
    const t = clamp((A.c.y - y) / Math.max(1e-4, A.c.y - Bq.c.y));
    const rx = lerp(A.rx, Bq.rx, t), rz = lerp(A.rz, Bq.rz, t);
    const dx = Math.sin(ang), dz = -Math.cos(ang);  // +z = the back
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
    p.addScaledVector(p.clone().setY(p.y * 0.3).normalize(), 0.015 * hs + 0.005 * k).add(H.C);
    clearNeck(p, -Math.cos(phi));
    return { p, u: phi * 0.12, v: -k * 0.2, w: W(0) };
  }, { wrap: true, inside: H.C });
  // drape: from the cap's edge, hugging the cheeks and neck, then over the shoulders and back
  B.grid(nu, nv, (i, j) => {
    const phi = lerp(open, Math.PI * 2 - open, i / nu);
    const c = -Math.cos(phi); // 1 at the back
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
    let r = lerp(rTop, rLow, kk) * (1 + 0.04 * Math.sin(Math.PI * k));
    // never inside the neck (its root flares into the trapezius) or the raised back of the collar
    if (y > nk.y - 0.08 && y < nk.y + 0.12) r = Math.max(r, neckClear(y, c) + 0.002);
    const ang = Math.atan2(lerp(top.x, lowX, kk), -lerp(top.z - H.C.z, lowZ - H.C.z, kk));
    if (k > 0) r = Math.max(r, torsoClear(y, ang));
    const p = V(Math.sin(ang) * r, y, H.C.z - Math.cos(ang) * r);
    return { p, u: phi * 0.12, v: -0.2 - k * 0.5, w: W(k) };
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
 */
export function arm(B, rig, lod, s, o = {}) {
  const k = rig.dims.H / 1.67;
  const sg = s === 'l' ? -1 : 1;
  const sh = R(rig, `uarm_${s}`), el = R(rig, `farm_${s}`), wr = R(rig, `hand_${s}`);
  const W = (p) => envelope(rig, p, { [`clav_${s}`]: 0.5, [`uarm_${s}`]: 1, [`farm_${s}`]: 1, [`hand_${s}`]: 0.7, chest: 0.2 }, 4);
  const mid = (a, b, t) => a.clone().lerp(b, t);
  const seg = L3(lod, 14, 7, 5);
  const sleeve = o.sleeveTo || 'wrist';
  const t = o.thick ?? 0.006;
  const fem = rig.dims.sex === 'f';
  const ra = (fem ? 0.04 : 0.046) * k, re = (fem ? 0.033 : 0.038) * k, rf = (fem ? 0.031 : 0.036) * k, rw = (fem ? 0.023 : 0.026) * k;
  const top = sh.clone().add(V(-sg * 0.014 * k, -0.012 * k, 0));
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 });
  if (sleeve === 'elbow' || sleeve === 'short' || sleeve === 'none') {
    const from = sleeve === 'none' ? top : sleeve === 'short' ? mid(sh, el, 0.45) : mid(sh, el, 0.82);
    B.tube(limbRings([from, el, mid(el, wr, 0.5), wr.clone().add(V(0, 0.01, 0))], [ra * 0.92, re * 0.95, rf * 0.98, rw]), { seg, weights: W });
  }
  if (sleeve !== 'none') {
    B.set({ cls: o.cls ?? CLS.GA, pat: o.pat ?? PAT.LINEN_BOX, rough: o.rough ?? 0.85, metal: 0, color: o.color || [1, 1, 1], grp: o.grp || 0 });
    let pts, rad;
    if (sleeve === 'wrist' && lod >= 3) {
      pts = [top, el, wr.clone().add(V(0, 0.016 * k, 0))];
      rad = [ra + t + 0.006, re + t, rw + t * 0.8];
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
    B.tube(limbRings(pts, rad), { seg, weights: W, capA: lod >= 2 ? 'flat' : 'dome', domeH: 0.45 });
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
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.58, metal: 0, color: [1, 1, 1], grp: 0 });
  const palmL = kn.distanceTo(w);
  if (lod >= 1) {
    // mitten: palm + fingers in one shape (fingers curl with fing_*), thumb separate at LOD1
    const q = L3(lod, 0, 7, 5);
    B.ellipsoid(w.clone().addScaledVector(down, palmL * 0.95), [0.0145 * hs, palmL * 1.05, 0.037 * hs], { nu: q, nv: lod === 1 ? 5 : 3, xf: rot,
      weights: (p) => normW([[hb, 1], [fb, 2 * smooth(kn.y + 0.01, kn.y - 0.045, p.y)]]) });
    if (lod === 1) B.ellipsoid(th.clone().addScaledVector(down, 0.024 * hs).addScaledVector(back, -0.006 * hs), [0.0105 * hs, 0.03 * hs, 0.01 * hs], { nu: 5, nv: 3, xf: rot, bone: tb });
    return;
  }
  // wrist: skin between the sleeve's cuff and the palm
  B.tube(limbRings([w.clone().addScaledVector(down, -0.03 * hs), w.clone().addScaledVector(down, 0.012 * hs)], [[0.019 * hs, 0.027 * hs], [0.0155 * hs, 0.032 * hs]].map(([a, b]) => [a, b])), {
    seg: 10, weights: (p) => normW([[I[`farm_${s}`], 1 - smooth(-0.02 * hs, 0.01 * hs, p.clone().sub(w).dot(down))], [hb, smooth(-0.02 * hs, 0.01 * hs, p.clone().sub(w).dot(down))]]),
  });
  // palm: a rounded block, a little narrower at the wrist, thicker at the heel of the hand
  const pc = w.clone().addScaledVector(down, palmL * 0.52).addScaledVector(back, 0.002 * hs);
  const pr = [0.0145 * hs, palmL * 0.57, 0.042 * hs];
  B.ellipsoid(pc, pr, {
    nu: 14, nv: 8, xf: rot,
    deform: (l) => {
      const qx = l.x / pr[0], qy = l.y / pr[1], qz = l.z / pr[2];
      const e = (t) => Math.sign(t) * Math.abs(t) ** 0.8;
      l.set(e(qx) * pr[0], e(qy) * pr[1], e(qz) * pr[2]);
      l.z *= 1 - 0.16 * smooth(0, 1, qy);                 // narrower toward the wrist (+y = up)
      if (qx > 0) l.x *= 1 + 0.08 * smooth(0.1, 1, qy);    // the fleshy heel of the palm
      return l;
    },
    weights: (p) => normW([[hb, 1], [I[`farm_${s}`], 0.4 * smooth(w.y - 0.02, w.y + 0.02, p.y)]]),
  });
  // thenar pad at the base of the thumb
  B.ellipsoid(w.clone().addScaledVector(down, palmL * 0.32).addScaledVector(back, -0.026 * hs).addScaledVector(palmN, 0.006 * hs),
    [0.011 * hs, 0.022 * hs, 0.014 * hs], { nu: 9, nv: 6, xf: rot, weights: [[hb, 0.7], [tb, 0.3]] });
  // fingers: separate two-segment capsules (proximal on fing_/idx_, middle+distal on fing2_/idx2_), knuckles,
  // nails. z: offset across the palm (toward the little finger), len: proximal / distal lengths, r: radius
  const fl = k2.distanceTo(kn), il = i2.distanceTo(ix);
  const fingers = [
    { base: ix, zo: 0.003, b1: ib, b2: i2b, p: il, d: 0.042, r: 0.0094, drop: 0.002 },
    { base: kn, zo: -0.015, b1: fb, b2: f2, p: fl, d: 0.045, r: 0.0097, drop: 0 },
    { base: kn, zo: 0.002, b1: fb, b2: f2, p: fl * 0.96, d: 0.042, r: 0.0092, drop: 0.002 },
    { base: kn, zo: 0.018, b1: fb, b2: f2, p: fl * 0.86, d: 0.034, r: 0.0083, drop: 0.006 },
  ];
  for (const g of fingers) {
    const o = g.base.clone().addScaledVector(back, g.zo * hs).addScaledVector(down, g.drop * hs);
    const pip = g.base.clone().addScaledVector(back, g.zo * hs).addScaledVector(down, g.p);  // on the b2 pivot line
    const tip = pip.clone().addScaledVector(down, g.d * hs);
    const r = g.r * hs;
    const knuckle = o.clone().addScaledVector(down, -0.006 * hs).addScaledVector(palmN, -0.0025 * hs);
    // proximal phalanx (the base is buried in the palm; a dorsal knuckle bump where it leaves it)
    B.tube(limbRings([knuckle, o.clone().lerp(pip, 0.5), pip], [[r * 1.12, r * 1.1], [r * 0.92, r * 0.98], [r * 0.98, r * 1.02]]), {
      seg: 8, weights: (p) => normW([[g.b1, 1], [hb, 1.2 * (1 - smooth(0, 0.016 * hs, p.clone().sub(o).dot(down)))]]),
    });
    // middle + distal phalanx, rounded tip
    B.tube(limbRings([pip.clone().addScaledVector(down, -0.004 * hs), pip.clone().lerp(tip, 0.55), tip], [[r * 0.98, r * 1.02], [r * 0.86, r * 0.92], [r * 0.8, r * 0.86]]), {
      seg: 8, capB: 'dome', domeH: 0.95, bone: g.b2,
      shade: (th2, j) => (j === 1 ? 0.93 : 1), // a faint crease at the last joint
    });
    // nail on the back of the fingertip
    B.set({ cls: CLS.SKIN, pat: PAT.NONE, rough: 0.32, metal: 0, color: [1.12, 1.04, 1.02], grp: 0 });
    B.ellipsoid(tip.clone().addScaledVector(palmN, -(r * 0.8 - 0.0012)).addScaledVector(down, -0.005 * hs), [r * 0.6, 0.0026 * hs, 0.0062 * hs],
      { nu: 6, nv: 3, lat: [0, 0.5], bone: g.b2, xf: new Matrix4().makeBasis(back, palmN.clone().negate(), down) });
    B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.58, metal: 0, color: [1, 1, 1], grp: 0 });
  }
  // thumb: metacarpal (blended into the palm), proximal and distal phalanx, lying along the index
  const tdir = down.clone().multiplyScalar(0.92).addScaledVector(back, -0.1).addScaledVector(palmN, 0.38).normalize();
  const t0 = th.clone().addScaledVector(tdir, -0.008 * hs), t1 = th.clone().addScaledVector(tdir, 0.034 * hs);
  const t2 = th.clone().addScaledVector(tdir, 0.064 * hs), t3 = th.clone().addScaledVector(tdir, 0.088 * hs);
  B.tube(limbRings([t0, t1, t2, t3], [0.0128 * hs, 0.0112 * hs, 0.0104 * hs, 0.0094 * hs]), {
    seg: 8, capB: 'dome', domeH: 0.95, weights: (p) => normW([[tb, 1], [hb, 0.9 * (1 - smooth(0, 0.03 * hs, p.distanceTo(t0)))]]),
  });
  B.set({ cls: CLS.SKIN, pat: PAT.NONE, rough: 0.32, metal: 0, color: [1.12, 1.04, 1.02], grp: 0 });
  const dors = palmN.clone().multiplyScalar(-0.5).addScaledVector(back, -0.85);
  dors.addScaledVector(tdir, -dors.dot(tdir)).normalize();                       // the thumbnail faces out and forward
  const tx = new Vector3().crossVectors(dors, tdir).normalize();
  B.ellipsoid(t3.clone().addScaledVector(tdir, -0.006 * hs).addScaledVector(dors, 0.0094 * hs * 0.82), [0.0058 * hs, 0.0026 * hs, 0.0066 * hs],
    { nu: 6, nv: 3, lat: [0, 0.5], bone: tb, xf: new Matrix4().makeBasis(tx, dors, tdir) });
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.58, metal: 0, color: [1, 1, 1], grp: 0 });
}

/** bare foot (and ankle up to `to` height) — everyone is barefoot on Har HaBayit */
export function foot(B, rig, lod, s, o = {}) {
  const sg = s === 'l' ? -1 : 1;
  const k = rig.dims.H / 1.67;
  const an = R(rig, `foot_${s}`), toe = R(rig, `toe_${s}`), sn = R(rig, `shin_${s}`);
  const fb = rig.index[`foot_${s}`], tb = rig.index[`toe_${s}`];
  B.set({ cls: CLS.SKIN, pat: PAT.SKIN, rough: 0.62, metal: 0, color: [1, 1, 1], grp: 0 });
  const to = Math.min(o.to ?? an.y + 0.16, sn.y + 0.06);
  const pts = [V(an.x, an.y - 0.012, an.z + 0.004), V(an.x, lerp(an.y, to, 0.45), an.z), V(an.x, to, an.z - 0.004)];
  if (to > sn.y - 0.12) pts.splice(2, 0, V(sn.x, sn.y - 0.13 * k, sn.z));
  const rad = pts.map((p) => (p.y < an.y + 0.05 ? 0.034 * k : p.y > sn.y - 0.06 ? 0.048 * k : 0.04 * k));
  if (lod < 3) B.tube(limbRings(lod >= 2 ? [pts[0], pts[pts.length - 1]] : pts, lod >= 2 ? [rad[0], rad[rad.length - 1]] : rad), { seg: L3(lod, 12, 6, 4), weights: (p) => envelope(rig, p, { [`shin_${s}`]: 1, [`foot_${s}`]: 0.6, [`thigh_${s}`]: 0.3 }, 4) });
  const len = rig.dims.footLen * 0.95;
  const cz = an.z - len * 0.26;
  const c = V(an.x + sg * 0.003, 0.036 * k, cz);
  B.ellipsoid(c, [0.038 * k, 0.042 * k, len * 0.5], {
    nu: L3(lod, 14, 7, 5), nv: L3(lod, 9, 4, 3),
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
    shade: lod === 0 ? (l) => 1 - 0.18 * Math.max(0, Math.sin((l.x / (0.012 * k)) * Math.PI)) * smooth(-0.6 * len * 0.52, -0.85 * len * 0.52, l.z) : null,
  });
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
  const n = o.lod >= 3 ? 1 : o.lod === 2 ? 2 : Math.max(2, Math.round((top - hemY) / (0.16 * k)));
  const rings = [];
  for (let j = 1; j <= n; j++) {
    const s = j / n;
    const y = lerp(top, hemY, s);
    rings.push({ c: V(0, y, 0.008 + 0.01 * s), rx: d.hips[0] * 1.03 + t + flare * s ** 1.3 + (o.extra || 0), rz: d.hips[1] * 1.05 + t + flare * 0.85 * s ** 1.3 + (o.extra || 0) });
  }
  return rings;
}

function torsoW(rig, armMul = 0.18) {
  return (p) => envelope(rig, p, { pelvis: 1, spine: 1, chest: 1, neck: 0.5, clav_l: 0.35, clav_r: 0.35, uarm_l: armMul, uarm_r: armMul }, 4);
}

function skirtW(rig, yTop, yHem, follow = 0.85) {
  const I = rig.index;
  return (p) => {
    if (p.y > yTop) return torsoW(rig)(p);
    const s = clamp((yTop - p.y) / Math.max(0.01, yTop - yHem));
    const kk = follow * Math.pow(s, 0.8);
    const fl = smooth(0.06, -0.06, p.x);
    const shinK = smooth(0.45, 1, s) * 0.42;
    return normW([[I.pelvis, 1 - kk], [I.thigh_l, kk * fl * (1 - shinK)], [I.thigh_r, kk * (1 - fl) * (1 - shinK)],
      [I.shin_l, kk * fl * shinK], [I.shin_r, kk * (1 - fl) * shinK]]);
  };
}

function foldRadial(lod, amp = 0.05, n = 9, seed = 1.3, startRing = 0) {
  if (lod >= 2) return null;
  return (th, j) => {
    const a = amp * smooth(startRing, startRing + 4, j);
    return 1 + a * (0.6 * Math.sin(th * n + seed) + 0.4 * Math.sin(th * n * 2.13 + seed * 3.1));
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

function garmentBody(B, rig, lod, hemY, o = {}) {
  const top = torsoRings(rig, { ...o, lod });
  const sk = skirtRings(rig, hemY, { ...o, lod });
  const rings = top.concat(sk);
  const ySeat = R(rig, 'thigh_r').y - 0.06 * rig.dims.H / 1.67;
  const nTop = top.length;
  B.tube(rings, {
    seg: L3(lod, 30, 14, 7), uvMode: o.uvMode, lift: backLift(rig),
    weights: (p, j) => (j < nTop - 1 ? torsoW(rig)(p) : skirtW(rig, ySeat, hemY, o.follow)(p)),
    radial: foldRadial(lod, o.folds ?? 0.045, o.nFolds ?? 9, o.seed ?? 1.3, nTop),
  });
  return rings;
}

/** the ketonet: fitted linen tunic to above the heel, long sleeves to the wrist, boxed (meshubetzet) weave */
export function ketonet(B, rig, lod, o = {}) {
  const hemY = R(rig, 'foot_r').y + 0.045 * rig.dims.H / 1.67;
  B.set({ cls: o.cls ?? CLS.GA, pat: PAT.LINEN_BOX, rough: 0.82, metal: 0, color: o.color || [1, 1, 1], grp: 0 });
  if (!o.noBody) garmentBody(B, rig, lod, hemY, { folds: 0.028, nFolds: 11, flare: 0.045, thick: 0.005 });
  for (const s of ['l', 'r']) arm(B, rig, lod, s, { sleeveTo: 'wrist', cls: o.cls ?? CLS.GA, pat: PAT.LINEN_BOX, color: o.color });
  return hemY;
}

/** the avnet: 32 amot × 3 fingers, wound round and round over the heart; kilayim (wool figures on linen,
 *  per Rambam) unless white (Yom Kippur) */
export function avnet(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const ch = R(rig, 'chest');
  const yc = ch.y - 0.035 * k, hh = 0.04 * k;
  B.set({ cls: CLS.FIX, pat: o.white ? PAT.LINEN : PAT.AVNET, rough: 0.8, metal: 0, color: o.white ? COL.linenKG : COL.linen, grp: 0 });
  const t = 0.017;
  const rings = (lod >= 2 ? [-1, 1] : [-1, -0.5, 0, 0.5, 1]).map((u) => ({
    c: V(0, yc + u * hh, 0.0), rx: d.chest[0] * 0.95 + t - Math.abs(u) * 0.005, rz: d.chest[1] * 0.97 + t - Math.abs(u) * 0.005,
  }));
  B.tube(rings, { seg: L3(lod, 30, 14, 7), weights: torsoW(rig, 0), radial: lod >= 2 ? null : (th, j) => 1 + 0.01 * Math.sin(j * 3.1 + th * 2) });
}

/** plain cloth belt at the waist (Israelites / Levites / women) */
export function belt(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const sp = R(rig, 'spine');
  const yc = sp.y - 0.01 * k, hh = 0.022 * k;
  B.set({ cls: o.cls ?? CLS.STRIPE, pat: PAT.WOOL, rough: 0.9, metal: 0, color: o.color || [0.9, 0.9, 0.9], grp: o.grp || 0 });
  const t = (o.thick ?? 0.006) + 0.01;
  B.tube((lod >= 2 ? [-1, 1] : [-1, 0, 1]).map((u) => ({ c: V(0, yc + u * hh, 0.002), rx: d.waist[0] + t - Math.abs(u) * 0.003, rz: d.waist[1] + t - Math.abs(u) * 0.003 })), {
    seg: L3(lod, 28, 14, 7), weights: torsoW(rig, 0),
  });
}

/** an ordinary tunic (chaluk) of wool/linen; uvMode 'x' lets the shader draw clavi stripes */
export function tunic(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const hemY = o.hemY ?? R(rig, 'shin_r').y - 0.17 * k;
  B.set({ cls: o.cls ?? CLS.GA, pat: o.pat ?? PAT.WOOL_CLAVI, rough: 0.9, metal: 0, color: [1, 1, 1], grp: 0 });
  garmentBody(B, rig, lod, hemY, { folds: 0.055, nFolds: 8, flare: o.flare ?? 0.07 * k, thick: 0.008, uvMode: o.pat === PAT.WOOL ? undefined : 'x', seed: o.seed ?? 0.7 });
  for (const s of ['l', 'r']) arm(B, rig, lod, s, { sleeveTo: o.sleeve || 'elbow', cls: o.cls ?? CLS.GA, pat: PAT.WOOL, rough: 0.9 });
  return hemY;
}

/** mantle (tallit) over the shoulders, open in front, with tzitzit (one techelet strand) at its four corners */
export function mantle(B, rig, lod, o = {}) {
  const d = rig.dims, k = d.H / 1.67;
  const hemY = o.hemY ?? R(rig, 'shin_r').y + 0.02 * k;
  const grp = o.grp ?? GRP.MANTLE;
  B.set({ cls: CLS.GB, pat: PAT.WOOL, rough: 0.93, metal: 0, color: [1, 1, 1], grp });
  const top = torsoRings(rig, { thick: 0.02, from: 'trap', lod });
  top[0].rx = d.shX * 0.72 + 0.022; top[0].rz = d.chest[1] * 0.86 + 0.022;
  if (top[1]) { top[1].rx = d.shX + 0.04 * k; top[1].rz = d.chest[1] + 0.03; }
  for (const r of top.slice(2)) { r.rx += 0.018 * k; r.rz += 0.012 * k; }
  const sk = skirtRings(rig, hemY, { thick: 0.035, flare: 0.08 * k, extra: 0.012, lod });
  const rings = top.concat(sk);
  const gap = o.gap ?? 0.5; // half-angle of the open front (rad)
  const a0 = -Math.PI / 2 + gap, a1 = Math.PI * 1.5 - gap;
  const ySeat = R(rig, 'thigh_r').y - 0.06 * k;
  const nTop = top.length;
  const W = (p, j) => (j < nTop - 1
    ? envelope(rig, p, { pelvis: 0.6, spine: 1, chest: 1, neck: 0.3, clav_l: 0.6, clav_r: 0.6, uarm_l: 0.35, uarm_r: 0.35 }, 4)
    : skirtW(rig, ySeat, hemY, 0.7)(p));
  B.tube(rings, {
    seg: L3(lod, 30, 14, 7), arc: [a0, a1], weights: W,
    // soft drapery: broad folds, front edges curling inward
    radial: lod >= 2 ? null : (th, j) => {
      const a = 0.055 * smooth(1, 5, j);
      const edge = Math.min(th - a0, a1 - th);
      return (1 + a * (0.65 * Math.sin(th * 6 + 2.1) + 0.35 * Math.sin(th * 13 + 0.4))) * (1 - 0.06 * smooth(0.35, 0, edge) * smooth(2, 6, j));
    },
  });
  if (lod < 2 && o.tzitzit !== false) {
    const hem = rings[rings.length - 1];
    const corners = [a0 + 0.04, a1 - 0.04, Math.PI / 2 - 0.9, Math.PI / 2 + 0.9];
    for (const th of corners) {
      const base = hem.c.clone().add(V(Math.cos(th) * hem.rx, 0.01, Math.sin(th) * hem.rz));
      const n = lod === 0 ? 4 : 2;
      for (let q = 0; q < n; q++) {
        const blue = q === n - 1;
        B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.85, metal: 0, color: blue ? COL.techelet : COL.tzitzit, grp });
        const off = (q - (n - 1) / 2) * 0.006;
        const tang = V(-Math.sin(th), 0, Math.cos(th));
        const pts = [0, 0.5, 1].map((u) => base.clone().addScaledVector(tang, off).add(V(0, -u * 0.13 * k, 0)));
        B.ribbon(pts, 0.004, { side: tang, weights: (p) => skirtW(rig, ySeat, hemY, 0.7)(p) });
      }
    }
  }
}

/** me'il: robe entirely of techelet, sleeveless, to the feet; hem of golden bells and wool pomegranates */
export function meil(B, rig, lod) {
  const d = rig.dims, k = d.H / 1.67;
  const hemY = R(rig, 'foot_r').y + 0.085 * k;
  B.set({ cls: CLS.FIX, pat: PAT.TECHELET, rough: 0.88, metal: 0, color: COL.techelet, grp: 0 });
  const rings = garmentBody(B, rig, lod, hemY, { folds: 0.04, nFolds: 10, flare: 0.06 * k, thick: 0.014 });
  // woven binding at the neck opening (Shemot 28:32)
  const nk = rings[0];
  B.tube([-1, 0, 1].map((u) => ({ c: nk.c.clone().add(V(0, u * 0.008, 0)), rx: nk.rx + 0.006 - Math.abs(u) * 0.003, rz: nk.rz + 0.006 - Math.abs(u) * 0.003 })),
    { seg: L3(lod, 20, 12, 6), weights: torsoW(rig, 0) });
  const hem = rings[rings.length - 1];
  const ySeat = R(rig, 'thigh_r').y - 0.06 * k;
  const W = skirtW(rig, ySeat, hemY, 0.85);
  if (lod >= 2) {
    B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.3, metal: 1, color: COL.gold });
    B.tube([0, 1].map((u) => ({ c: hem.c.clone().add(V(0, -0.012 - u * 0.02, 0)), rx: hem.rx + 0.006, rz: hem.rz + 0.006 })), { seg: 9, weights: W });
    return;
  }
  // bells (gold) and pomegranates (techelet, argaman, tola'at shani wool) alternating — 72 bells (Rambam KhM 9:3)
  const pomCols = [COL.techelet, COL.argaman, COL.shani];
  if (lod === 1) { // a fringe of small alternating tabs reads the same at mid range
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const p = hem.c.clone().add(V(Math.cos(th) * (hem.rx + 0.004), -0.004, Math.sin(th) * (hem.rz + 0.004)));
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
    const rad = 1 + 0.04 * (0.6 * Math.sin(th * 10 + 1.3) + 0.4 * Math.sin(th * 21.3 + 4.03));
    const p = hem.c.clone().add(V(Math.cos(th) * hem.rx * rad, -0.004, Math.sin(th) * hem.rz * rad));
    const s = 0.011 * k;
    if (i % 2 === 0) {
      B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.22, metal: 1, color: COL.gold });
      B.tube([
        { c: p.clone().add(V(0, -0.002, 0)), rx: s * 0.25, rz: s * 0.25 },
        { c: p.clone().add(V(0, -0.012, 0)), rx: s * 0.6, rz: s * 0.6 },
        { c: p.clone().add(V(0, -0.024, 0)), rx: s * 0.95, rz: s * 0.95 },
      ], { seg: lod ? 5 : 7, weights: W, capA: 'flat', capB: 'flat' });
    } else {
      B.set({ cls: CLS.FIX, pat: PAT.WOOL, rough: 0.9, metal: 0, color: pomCols[(i >> 1) % 3] });
      B.ellipsoid(p.clone().add(V(0, -0.016, 0)), [s * 0.85, s, s * 0.85], { nu: lod ? 5 : 7, nv: lod ? 3 : 5, weights: W });
    }
  }
}

/** ephod (back apron to the heels) + its belt (cheshev) + shoulder-pieces with the two shoham stones.
 *  Woven of gold thread twisted with techelet, argaman, tola'at shani and shesh (28 strands — Yoma 72a). */
export function ephod(B, rig, lod) {
  const d = rig.dims, k = d.H / 1.67;
  const ch = R(rig, 'chest');
  const hemY = R(rig, 'foot_r').y + 0.11 * k;
  B.set({ cls: CLS.FIX, pat: PAT.EPHOD, rough: 0.5, metal: 0.25, color: [1, 1, 1], grp: 0 });
  const top = torsoRings(rig, { thick: 0.024, from: 'ribs', lod });
  const sk = skirtRings(rig, hemY, { thick: 0.03, flare: 0.07 * k, extra: 0.006, lod });
  const rings = top.concat(sk);
  const ySeat = R(rig, 'thigh_r').y - 0.06 * k;
  const nTop = top.length;
  B.tube(rings, {
    seg: L3(lod, 16, 9, 5), arc: [0.1, Math.PI - 0.1],
    weights: (p, j) => (j < nTop - 1 ? torsoW(rig, 0)(p) : skirtW(rig, ySeat, hemY, 0.8)(p)),
    radial: foldRadial(lod, 0.03, 5, 0.4, 2),
  });
  const yb = ch.y - 0.035 * k;
  B.tube((lod >= 2 ? [-1, 1] : [-1, 0, 1]).map((u) => ({ c: V(0, yb + u * 0.026 * k, 0.0), rx: d.chest[0] * 0.95 + 0.03 - Math.abs(u) * 0.003, rz: d.chest[1] * 0.97 + 0.03 - Math.abs(u) * 0.003 })),
    { seg: L3(lod, 28, 14, 7), weights: torsoW(rig, 0) });
  for (const sg of [-1, 1]) {
    const sh = R(rig, sg < 0 ? 'uarm_l' : 'uarm_r');
    const x = sg * (d.shX * 0.62);
    const pts = [V(x, ch.y - 0.0, 0.11 * k), V(x, sh.y - 0.02, 0.095 * k), V(x * 1.02, sh.y + 0.05 * k, 0.015), V(x, sh.y - 0.005, -0.09 * k), V(x, ch.y + 0.1 * k, -d.chest[1] - 0.03)];
    B.set({ cls: CLS.FIX, pat: PAT.EPHOD, rough: 0.5, metal: 0.25, color: [1, 1, 1] });
    B.ribbon(pts, 0.05 * k, { side: V(1, 0, 0), weights: (p) => envelope(rig, p, { chest: 1, clav_l: 0.5, clav_r: 0.5, neck: 0.2 }, 4) });
    const W2 = [[rig.index[sg < 0 ? 'clav_l' : 'clav_r'], 0.5], [rig.index.chest, 0.5]];
    B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.25, metal: 1, color: COL.goldDeep });
    const sp = V(x * 1.02, sh.y + 0.058 * k, 0.012);
    B.ellipsoid(sp, [0.023 * k, 0.008 * k, 0.027 * k], { nu: lod ? 8 : 12, nv: 4, weights: W2 });
    B.set({ cls: CLS.FIX, pat: PAT.GEM, rough: 0.12, metal: 0, color: COL.shoham });
    B.ellipsoid(sp.clone().add(V(0, 0.006 * k, 0)), [0.017 * k, 0.008 * k, 0.021 * k], { nu: lod ? 8 : 12, nv: 4, lat: [0, 0.5], weights: W2 });
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
  B.set({ cls: CLS.FIX, pat: PAT.EPHOD, rough: 0.5, metal: 0.25, color: [1, 1, 1], grp: 0 });
  const nu = lod >= 2 ? 2 : 6;
  B.grid(nu, nu, (i, j) => {
    const x = (i / nu - 0.5) * zeret, y = cy + (0.5 - j / nu) * zeret;
    return { p: V(x, y, curveZ(x)), u: x, v: y, w: W };
  }, { inside: V(0, cy, 0) });
  const cellW = zeret / 3, cellH = zeret / 4;
  // the ellipsoid's local +y is turned to face the viewer (−z): radii are [width, protrusion, height]
  const xf = new Matrix4().makeRotationX(-Math.PI / 2);
  for (let rI = 0; rI < (lod >= 3 ? 0 : 4); rI++) {
    for (let cI = 0; cI < 3; cI++) {
      const [, hex] = STONES[rI * 3 + cI];
      // Hebrew order as read by someone facing the Kohen Gadol: each row runs from the viewer's right
      // (the wearer's left, −x) to the viewer's left — odem top-right. See docs/decisions/people.md.
      const x = (cI - 1) * cellW, y = cy + (1.5 - rI) * cellH;
      const z = curveZ(x) - 0.002;
      if (lod < 2) { // gold setting (mishbetzot): a low rim around each stone
        B.set({ cls: CLS.FIX, pat: PAT.METAL, rough: 0.25, metal: 1, color: COL.goldDeep });
        B.ellipsoid(V(x, y, z), [cellW * 0.43, 0.0045, cellH * 0.43], { nu: lod ? 10 : 16, nv: 3, lat: [0, 0.5], weights: W, xf });
      }
      // the stone: an oval cabochon with a flattened table, standing proud of its setting
      B.set({ cls: CLS.FIX, pat: PAT.GEM, rough: 0.06, metal: 0, color: hex });
      B.ellipsoid(V(x, y, z - 0.0025), [cellW * 0.34, 0.0085, cellH * 0.33], {
        nu: lod === 0 ? 14 : 6, nv: lod === 0 ? 5 : 2, lat: [0, 0.5], weights: W, xf,
        deform: lod === 0 ? (l) => { if (l.y > 0.0062) l.y = 0.0062 + (l.y - 0.0062) * 0.25; return l; } : null,
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
      B.ribbon([a, mid, b], 0.008, { side: V(1, 0, 0), weights: (p) => envelope(rig, p, { chest: 1, clav_l: 0.4, clav_r: 0.4 }, 4) });
      B.set({ cls: CLS.FIX, pat: PAT.CORD, rough: 0.8, metal: 0, color: COL.techelet });
      const c0 = V(sg * zeret / 2, cy - zeret / 2, cz + 0.002);
      B.ribbon([c0, c0.clone().add(V(sg * 0.01, -0.035 * k, 0.01))], 0.005, { side: V(1, 0, 0), weights: W });
    }
  }
}

// --------------------------------------------------------------------------------------------- recipes
export const RECIPES = {
  kohen(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04 });
    beard(B, rig, lod, H, { len: 0.04 });
    migbaat(B, rig, lod, H);
    const hemY = ketonet(B, rig, lod);
    avnet(B, rig, lod);
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.1 });
  },
  kg_white(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04 });
    beard(B, rig, lod, H, { len: 0.05 });
    mitznefet(B, rig, lod, H, { cls: CLS.FIX, color: COL.linenKG, base: 0.05 });
    const hemY = ketonet(B, rig, lod, { cls: CLS.FIX, color: COL.linenKG });
    avnet(B, rig, lod, { white: true });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.1 });
  },
  kg_gold(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.04 });
    beard(B, rig, lod, H, { len: 0.05 });
    mitznefet(B, rig, lod, H);
    tzitz(B, rig, lod, H);
    ketonet(B, rig, lod, { noBody: true }); // only the sleeves show from under the sleeveless me'il
    meil(B, rig, lod);
    ephod(B, rig, lod);
    choshen(B, rig, lod);
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: R(rig, 'foot_r').y + 0.2 });
  },
  levi(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.05 });
    beard(B, rig, lod, H, { len: 0.035 });
    const hemY = tunic(B, rig, lod, { hemY: R(rig, 'foot_r').y + 0.14 * rig.dims.H / 1.67, sleeve: 'wrist', pat: PAT.WOOL });
    belt(B, rig, lod, { thick: 0.008 });
    mantle(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.05 });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  israelite(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.05 });
    beard(B, rig, lod, H, { len: 0.045 });
    headCloth(B, rig, lod, H, { grp: GRP.HEADCLOTH, short: true, open: 1.05, backY: R(rig, 'uarm_r').y - 0.08 });
    const hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.2 * rig.dims.H / 1.67 });
    belt(B, rig, lod, { thick: 0.008 });
    mantle(B, rig, lod, {});
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  nazir(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.055, long: true, volume: 0.006 });
    beard(B, rig, lod, H, { len: 0.085, volume: 0.004 });
    const hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.2 * rig.dims.H / 1.67 });
    belt(B, rig, lod, { thick: 0.008 });
    mantle(B, rig, lod, {});
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  elder(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.07 });
    beard(B, rig, lod, H, { len: 0.1, volume: 0.004 });
    headCloth(B, rig, lod, H, { grp: GRP.HEADCLOTH, cls: CLS.GB, open: 1.0 });
    const hemY = tunic(B, rig, lod, { hemY: R(rig, 'foot_r').y + 0.1 * rig.dims.H / 1.67, sleeve: 'wrist', pat: PAT.WOOL });
    belt(B, rig, lod, { thick: 0.008 });
    mantle(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.12, gap: 0.42 });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  woman(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.05 });
    const hemY = tunic(B, rig, lod, { hemY: R(rig, 'foot_r').y + 0.05 * rig.dims.H / 1.67, sleeve: 'wrist', pat: PAT.WOOL, flare: 0.09 });
    belt(B, rig, lod, { thick: 0.008 });
    mantle(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.02, gap: 0.55, tzitzit: false, grp: 0 });
    headCloth(B, rig, lod, H, { cls: CLS.GB, open: 0.92, backY: R(rig, 'pelvis').y - 0.05 });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  boy(B, rig, lod) { // levi_boy
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.055 });
    const hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y - 0.12, sleeve: 'elbow', pat: PAT.WOOL });
    belt(B, rig, lod, { thick: 0.008 });
    for (const s of ['l', 'r']) foot(B, rig, lod, s, { to: hemY + 0.12 });
  },
  child(B, rig, lod) {
    const H = head(B, rig, lod);
    hair(B, rig, lod, H, { hairline: 0.06, volume: 0.003 });
    const hemY = tunic(B, rig, lod, { hemY: R(rig, 'shin_r').y + 0.02, sleeve: 'elbow' });
    belt(B, rig, lod, { thick: 0.008 });
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

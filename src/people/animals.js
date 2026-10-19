// Procedural animals for the offerings (research: report Part VIII §33.6, §65.6; Tamid 3–4).
//   sheep — the tamid lamb and offering lambs are male yearlings (keves ben shenato) of the local fat-tailed breed:
//           white fleece in coarse, clumped locks, the face and lower legs short-haired and brown-to-black, long
//           pendulous ears, a convex (Roman) nose, and the broad fat tail (alyah) offered with the right hind leg
//           (Tamid 4:3; Vayikra 3:9). The yearling male already carries short horns — the limb-bearer holds the
//           head "with its horns between his fingers" (Tamid 4:3). Rams (ayil, in their second year) carry full
//           spiral horns. Breed type after the Awassi of the region (reconstruction).
//   goat  — the chatat goat (se'ir izim): the black long-haired goat of the Levant, beard, scimitar horns swept
//           back, long drooping ears.
//   bull  — par (young bull): heavy forequarters, a deep dewlap from the throat to the brisket, short forward
//           horns, red-brown coat darker on the head and neck, tail with a switch.
//   birds — turtledove (tor: small, pinkish-brown with scaled rufous-and-black wing coverts and a striped neck
//           patch) and young pigeon (ben yonah: grey with two dark wing bars and a glossy green-violet neck).
// Fleece and long coats are a lumpy volume (3D noise in rest space, continuous across body, neck, legs and tail)
// plus alpha-tested strand shells at LOD0. Optional parts shown by the pose (mask groups): halter with a short
// lead end, and the akedah cord (foreleg to hindleg).
import { Vector3, Matrix4 } from 'three';
import { MeshBuilder, envelope, normW, CLS, PAT } from './builder.js';
import { smooth, lerp, clamp } from './util.js';

const V = (x, y, z) => new Vector3(x, y, z);
const R = (rig, n) => rig.rest[rig.index[n]];
const sgL = (lod, a, b) => (lod === 0 ? a : b);
const g2 = (x, y, sx, sy) => Math.exp(-((x / sx) ** 2) - ((y / sy) ** 2));

// optional parts (mask groups; see system.js): bit 3 halter, bit 4 the hanging lead end, bit 5 the akedah cord
export const AGRP = { HALTER: 4, LEAD: 5, CORD: 6 };

// deterministic value noise (2D and 3D) for geometry: fleece locks, coat tufts
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
/** clumped locks: a few octaves, sharpened so locks have gaps between them */
const lockField = (p, f = 1, sy = 1) => {
  const a = vnoise3(p.x * 14 * f, p.y * 14 * f * sy, p.z * 14 * f), b = vnoise3(p.x * 24 * f + 3, p.y * 24 * f * sy, p.z * 24 * f);
  return smooth(0.18, 0.88, 0.66 * a + 0.34 * b);
};

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

/** displace every vertex added by fn outward from `centre(p)` by a lock field (fleece / shaggy coat) */
function withLocks(B, amount, f, centre, fn, droop = 0, ampFn = null, sy = 1) {
  const start = B.count;
  fn();
  const P = B.pos;
  const p = new Vector3();
  for (let i = start; i < B.count; i++) {
    p.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]);
    const c = centre(p);
    const d = p.clone().sub(c);
    const L = d.length() || 1;
    const lk = lockField(p, f, sy);
    const amp = ampFn ? ampFn(p) : 1;
    const k = amount * amp * (lk - 0.35);
    P[i * 3] += (d.x / L) * k;
    P[i * 3 + 1] += (d.y / L) * k - droop * amp * lk * smooth(0.0, -0.8, d.y / L);
    P[i * 3 + 2] += (d.z / L) * k;
    // crevices between the locks darker (dust, shadow)
    const sh = 1 - amp * (0.09 - 0.12 * lk);
    B.col[i * 3] *= sh; B.col[i * 3 + 1] *= sh; B.col[i * 3 + 2] *= sh;
  }
}

// per-kind head shape: [t along the head, half-width, half-height, centre drop] (× head half-width hw)
const HEADS = {
  sheep: [[0, 0.55, 0.55, 0], [0.1, 0.95, 0.88, 0], [0.26, 1.0, 0.94, 0.03], [0.46, 0.82, 0.88, 0.08], [0.66, 0.68, 0.8, 0.13], [0.84, 0.62, 0.72, 0.18], [1, 0.5, 0.54, 0.22]],
  goat: [[0, 0.5, 0.5, 0], [0.1, 0.9, 0.86, 0], [0.3, 0.92, 0.9, 0.04], [0.52, 0.66, 0.76, 0.12], [0.74, 0.5, 0.64, 0.18], [0.9, 0.44, 0.54, 0.22], [1, 0.3, 0.36, 0.24]],
  bull: [[0, 0.72, 0.72, 0], [0.12, 1.04, 0.96, 0], [0.3, 1.0, 0.9, 0.05], [0.52, 0.8, 0.8, 0.12], [0.72, 0.72, 0.8, 0.16], [0.88, 0.8, 0.8, 0.18], [1, 0.68, 0.64, 0.2]],
};

function quad(B, rig, lod, kind) {
  const d = rig.dims, H = d.H, L = d.L, W = d.W;
  const sheep = kind === 'sheep', goat = kind === 'goat', bull = kind === 'bull';
  const ram = d.type === 'ram';
  const fleeceSet = { cls: CLS.GA, pat: PAT.FLEECE, rough: 0.95, metal: 0, color: [1, 1, 1], grp: 0 };
  const coatSet = { cls: CLS.GA, pat: PAT.COAT, rough: goat ? 0.74 : 0.64, metal: 0, color: [1, 1, 1], grp: 0 };
  const bodySet = sheep ? fleeceSet : coatSet;
  const faceSet = { cls: CLS.GB, pat: PAT.COAT, rough: 0.66, metal: 0, color: [1, 1, 1], grp: 0 };
  const W_body = (p) => envelope(rig, p, { pelvis: 1, spine: 1, chest: 1, neck: 0.4, fl_up: 0.2, fr_up: 0.2, hl_up: 0.25, hr_up: 0.25, tail: 0.15 }, 3);
  const fleece = sheep ? (lod === 0 ? 0.05 : 0.042) * H / 0.66 : 0;
  // ---- body barrel (rear → front)
  const N = sgL(lod, sheep || bull ? 26 : 20, 8);
  const zA = d.zr + 0.1 * L, zB = d.zf - 0.08 * L;
  const rings = [];
  for (let j = 0; j <= N; j++) {
    const t = j / N; // 0 rear, 1 front
    const z = lerp(zA, zB, t);
    const end = Math.min(t, 1 - t);
    const taper = smooth(0, 0.16, end);
    const top = H * (0.965 - 0.02 * Math.sin(Math.PI * t) + (bull ? 0.07 * smooth(0.55, 0.78, t) * (1 - smooth(0.82, 0.97, t)) : 0) + (goat ? 0.025 * smooth(0.0, 0.3, t) * (1 - smooth(0.3, 0.5, t)) : 0));
    const bot = H * (bull ? 0.43 : goat ? 0.5 : 0.46) + H * 0.1 * (1 - smooth(0.0, 0.35, t)) - H * (bull ? 0.06 : 0.02) * smooth(0.55, 0.85, t) + H * 0.06 * smooth(0.88, 1, t);
    const mid = (top + bot) / 2, ry = (top - bot) / 2;
    const wf = W * (bull && t > 0.55 ? 1.08 : 1) * (1 + 0.05 * smooth(0.1, 0.3, t) * (1 - smooth(0.4, 0.55, t))) + fleece;
    rings.push({ c: V(0, mid - ry * (1 - taper) * 0.15, z), rx: Math.max(0.02, wf * (0.35 + 0.65 * taper)), rz: Math.max(0.02, (ry + fleece * 0.8) * (0.42 + 0.58 * taper)), ax: V(1, 0, 0), az: V(0, 1, 0), t });
  }
  if (bull) {
    const cut = rings.findIndex((r) => r.t > 0.84);
    const last = rings[cut - 1];
    rings.length = cut;
    const hdB = R(rig, 'head');
    const end = hdB.clone().add(V(0, -0.02, 0.06));
    const mid = V(0, lerp(last.c.y, end.y, 0.45), lerp(last.c.z, end.z, 0.5));
    const n = sgL(lod, 8, 4);
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      // quadratic path: barrel front → over the shoulders → down to the poll; deep and narrow, narrowing to the head
      const c = last.c.clone().multiplyScalar((1 - u) ** 2).addScaledVector(mid, 2 * u * (1 - u)).addScaledVector(end, u * u);
      const rx = lerp(last.rx, 0.13, smooth(0, 1, u ** 0.85)), rz = lerp(last.rz, 0.2, smooth(0, 1, u ** 0.8));
      rings.push({ c, rx, rz, ax: V(1, 0, 0), az: V(0, 1, 0), t: 1 + u * 0.3, neck: u, tLast: last.t });
    }
    // ring planes turn with the path (perpendicular to it) so the neck does not shear
    for (let j = cut; j < rings.length; j++) {
      const a = rings[j - 1].c, b = rings[Math.min(rings.length - 1, j + 1)].c;
      const dir = b.clone().sub(a).normalize();
      const perp = V(0, 1, 0).addScaledVector(dir, -dir.y).normalize();
      // the first rings stay upright like the barrel's, then turn with the path (no fold on the crest)
      rings[j].az = V(0, 1, 0).lerp(perp, smooth(0.3, 1, rings[j].neck)).normalize();
    }
  }
  // the bull's muscle: shoulders, the hook and pin bones of the hip, a little ribbing; the goat's spine and hips
  const relief = (th, j) => {
    const t = rings[j].t, s = Math.sin(th), c = Math.abs(Math.cos(th));
    if (rings[j].neck) { // the shoulder relief of the last barrel ring blends into the crest of the neck (no crease)
      const u = rings[j].neck, t0 = rings[j].tLast;
      const sh = 0.05 * c * g2(t0 - 0.72, s - 0.2, 0.1, 0.6);
      return 1 + sh * (1 - smooth(0, 1, u)) + 0.05 * Math.max(0, s) ** 2 * smooth(0, 1, u);
    }
    if (bull) return 1 + 0.05 * c * g2(t - 0.72, s - 0.2, 0.1, 0.6) + 0.06 * Math.max(0, s) ** 4 * g2(t - 0.16, 0, 0.06, 1) + 0.02 * c * Math.max(0, -s) * Math.sin(t * 38) * smooth(0.4, 0.6, t) * (1 - smooth(0.66, 0.74, t));
    if (goat) return 1 + 0.07 * Math.max(0, s) ** 8 + 0.05 * Math.max(0, s) ** 3 * g2(t - 0.15, 0, 0.07, 1) - 0.04 * c * g2(t - 0.35, s, 0.12, 0.5);
    return 1;
  };
  const W_neckB = (p) => envelope(rig, p, { chest: 1, neck: 1, neck2: 1, head: 0.5 }, 4);
  const body = () => B.tube(rings, { seg: sgL(lod, sheep || bull ? 40 : 32, 12), weights: (p, j) => { const u = rings[j]?.neck || 0; if (u <= 0) return W_body(p); if (u >= 0.5) return W_neckB(p); const k = u / 0.5; return normW([...W_body(p).map(([b, w]) => [b, w * (1 - k)]), ...W_neckB(p).map(([b, w]) => [b, w * k])]); }, capA: 'dome', capB: 'dome', domeH: 0.5, radial: lod === 0 && !sheep ? relief : null });
  const bodyCentre = (p) => {
    let best = rings[0].c, bd = Infinity;
    for (const r of rings) { const dd = Math.abs(r.c.z - p.z); if (dd < bd) { bd = dd; best = r.c; } }
    return V(0, best.y, p.z);
  };
  B.set(bodySet);
  // fleece: an opaque, clumped volume (locks displaced in rest space; the shader adds crimp and crevices). The
  // earlier alpha-tested strand shells read as a screen-door stipple at mid range and are gone.
  if (sheep) withLocks(B, lod === 0 ? 0.06 : 0.035, 1, bodyCentre, body, 0.014);
  else if (goat) withLocks(B, lod === 0 ? 0.03 : 0.016, 2.2, bodyCentre, body, 0.03, null, 0.25);
  else body();
  if (goat) goatSkirt(B, rig, lod, rings, coatSet, W_body);
  // ---- neck
  const ch = R(rig, 'chest'), nk = R(rig, 'neck'), n2 = R(rig, 'neck2'), hd = R(rig, 'head');
  const nr = bull ? 0.22 : sheep ? 0.075 * H / 0.66 + fleece : 0.062 * H / 0.7;
  // the neck grows out of the chest (its root deep inside the shoulders) and narrows to the poll
  const neckPts = [V(0, ch.y - (bull ? 0.1 : 0.06) * H, d.zf + (bull ? 0.16 : goat ? 0.12 : 0.08) * L), nk.clone().add(V(0, -0.03 * H, 0)), n2.clone(), hd.clone().add(V(0, -0.01, 0.02))];
  const neckR = [[nr * (bull ? 1.3 : goat ? 1.4 : 1.05), nr * (bull ? 1.5 : goat ? 1.6 : 1.15)], [nr, nr * (bull ? 1.25 : 1.1)], [nr * 0.8, nr * 0.95], [nr * (sheep ? 0.68 : 0.62), nr * (sheep ? 0.74 : 0.72)]];
  const W_neck = (p) => envelope(rig, p, { chest: 1, neck: 1, neck2: 1, head: 0.6 }, 4);
  B.set(bodySet);
  // the bull's neck flares into the shoulders from a root ring deep inside the barrel (no collar where they meet)
  const neck = () => tubeAlong(B, neckPts, neckR, sgL(lod, bull ? 28 : 20, 8), { weights: W_neck, capB: 'dome', domeH: 0.4, radial: bull && lod === 0 ? (th) => 1 + 0.06 * Math.max(0, Math.sin(th)) ** 2 : null });
  const neckC = (p) => { let best = neckPts[0], bd = Infinity; for (const q of neckPts) { const dd = q.distanceTo(p); if (dd < bd) { bd = dd; best = q; } } return best; };
  // the wool stops at the poll: the face is short-haired
  const hdC = R(rig, 'head');
  if (sheep) withLocks(B, lod === 0 ? 0.045 : 0.03, 1, neckC, neck, 0.008, (p) => 1 - smooth(0.06, 0.0, p.distanceTo(hdC)));
  else if (!bull) neck();             // the bull's neck is the barrel's own continuation (above)
  if (bull) { // dewlap: a fold of skin hanging along the throat to the brisket, thick at its root, with soft creases
    B.set(coatSet);
    const a = hd.clone().add(V(0, -0.16, 0.06)), b = ch.clone().add(V(0, -0.3 * H, -0.06));
    const n = sgL(lod, 12, 6);
    const pts = [], rads = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const depth = 0.03 + 0.11 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.8;
      const top = a.clone().lerp(b, t);
      pts.push(top.add(V(0, -depth * 0.55, 0)));
      rads.push([0.03 + 0.012 * Math.sin(Math.PI * t), depth]);
    }
    tubeAlong(B, pts, rads, sgL(lod, 12, 6), { weights: (q) => envelope(rig, q, { head: 0.3, neck: 1, neck2: 1, chest: 0.8 }, 4),
      radial: lod === 0 ? (th, j) => 1 + 0.08 * Math.sin(j * 2.1) * Math.max(0, Math.sin(th)) : null });
  }
  head(B, rig, lod, kind, faceSet, bodySet);
  // ---- legs
  for (const leg of ['fl', 'fr', 'hl', 'hr']) legMesh(B, rig, lod, leg, kind, bodySet, faceSet, fleece);
  // ---- male parts (modest): scrotum between the hind legs; the bull's sheath under the belly
  {
    const pv = R(rig, 'pelvis');
    B.set(sheep ? { ...fleeceSet } : coatSet);
    const sc = bull ? [0.07, 0.11, 0.07] : sheep ? [0.045, 0.06, 0.045] : [0.035, 0.05, 0.035];
    B.ellipsoid(V(0, pv.y * (bull ? 0.62 : 0.6), d.zr - 0.02 * L), sc, { nu: sgL(lod, 10, 6), nv: sgL(lod, 7, 4),
      weights: (p) => envelope(rig, p, { pelvis: 1, hl_up: 0.2, hr_up: 0.2 }, 4),
      deform: (l) => { l.x *= 1 - 0.18 * Math.exp(-((l.x / (sc[0] * 0.3)) ** 2)) * smooth(0, -sc[1], l.y); return l; } });
  }
  // ---- tail
  const tl = R(rig, 'tail'), t2 = R(rig, 'tail2');
  const tb = rig.index.tail, t2b = rig.index.tail2;
  if (sheep) { // the fat tail (alyah, Vayikra 3:9; Tamid 4:3): a heavy pad of fat hanging from the rump toward the
    // hocks — narrow where it hangs from the tail root, broad and thick below where the fat sags, two lobes parted
    // by a groove; wool over its back, its underside bare and pinkish, the thin tail tip turned up from the groove
    const k = H / 0.66 * (ram ? 1.25 : 1);
    const c = V(0, tl.y - 0.15 * k, tl.z + 0.05 * k);
    const r = [0.115 * k, 0.17 * k, 0.085 * k];
    const tw = (p) => normW([[tb, 1], [t2b, smooth(tl.y, t2.y, p.y)], [rig.index.pelvis, 0.3]]);
    const lobe = (l) => {
      const u = l.y / r[1];                                  // +1 top (root) … −1 bottom
      l.x *= 0.62 + 0.5 * smooth(0.75, -0.35, u);            // narrow root, broad sagging lower part
      l.z *= 0.75 + 0.35 * smooth(0.6, -0.5, u);             // thicker below
      l.z -= 0.035 * k * smooth(0.2, 1, u);                  // the root tucked against the rump
      if (l.z > 0) l.z += 0.03 * k * Math.exp(-((l.x / (0.022 * k)) ** 2)) * smooth(0.5, -0.4, u) * -1; // the groove between the lobes
      l.y += 0.012 * k * smooth(-0.6, -1, u);                // the lower edge rounded up a little
      return l;
    };
    B.set(fleeceSet);
    const fat = () => B.ellipsoid(c, r, { nu: sgL(lod, 22, 12), nv: sgL(lod, 16, 8), deform: lobe, weights: tw,
      col: (l) => (l.z < -r[2] * 0.25 && l.y < r[1] * 0.3 ? [0.86, 0.7, 0.62] : null) });   // the bare underside (toward the legs)
    withLocks(B, lod === 0 ? 0.022 : 0.014, 1.2, () => c, fat, 0.003, (p) => (p.z < c.z - r[2] * 0.25 ? 0.25 : 1));
    B.set(fleeceSet);
    const tip = c.clone().add(V(0, -r[1] * 0.62, r[2] * 0.55));
    tubeAlong(B, [tip, tip.clone().add(V(0, -r[1] * 0.2, r[2] * 0.22)), tip.clone().add(V(0, -r[1] * 0.12, r[2] * 0.42))], [0.022 * k, 0.017 * k, 0.008 * k], 7, { bone: t2b, capB: 'dome' });
  } else if (goat) {
    B.set(coatSet);
    tubeAlong(B, [tl.clone(), tl.clone().add(V(0, 0.05, 0.03)), tl.clone().add(V(0, 0.09, 0.045))], [0.022, 0.017, 0.007], 6, { bone: tb, capB: 'dome' });
  } else {
    B.set(coatSet);
    tubeAlong(B, [tl.clone(), t2.clone(), t2.clone().add(V(0, -0.45, 0.02))], [0.032, 0.022, 0.015], 7, { weights: (p) => normW([[tb, 1], [t2b, smooth(tl.y, t2.y - 0.2, p.y) * 2]]) });
    B.set({ ...faceSet, pat: PAT.COAT_LONG, color: [0.5, 0.5, 0.5] });
    B.ellipsoid(t2.clone().add(V(0, -0.53, 0.02)), [0.04, 0.1, 0.04], { nu: 8, nv: 5, bone: t2b, deform: (l) => { l.x *= 1 + 0.3 * smooth(0, -0.1, l.y); return l; } });
  }
}

/** the goat's long black hair hanging from the flanks below the belly line: a layer of hair 2-3 cm thick that
 *  follows the flank and falls past the belly line in hanging locks (striated outer face, ragged closed lower edge) */
function goatSkirt(B, rig, lod, rings, set, W_body) {
  const n = sgL(lod, 44, 14), m = sgL(lod, 10, 3);
  const j0 = 2, j1 = rings.length - 3;
  const lockLen = (i) => 0.045 + 0.018 * Math.sin(i * 0.55 + 0.4) * Math.sin(i * 0.23 + 1.1);
  for (const sg of [-1, 1]) {
    B.set({ ...set, pat: lod === 0 ? PAT.COAT_LONG : PAT.COAT });
    const at = (i, s, out) => {
      const f = lerp(j0, j1, i / n), a = Math.floor(f), k = f - a;
      const rA = rings[a], rB = rings[Math.min(rings.length - 1, a + 1)];
      const c = rA.c.clone().lerp(rB.c, k), rx = lerp(rA.rx, rB.rx, k), rz = lerp(rA.rz, rB.rz, k);
      // the band: from the flank (just below the widest line) round the lower barrel, then hanging straight down
      const th0 = 1.15, th1 = -1.0;                     // parted near the spine, falling over the flank to below the barrel
      const th = lerp(th0, th1, Math.min(1, s * 1.15));
      const strand = 0;
      const p = V(sg * Math.cos(th) * (rx + out + strand), c.y + Math.sin(th) * (rz + out), c.z);
      if (s > 0.84) p.y -= (s - 0.84) / 0.16 * lockLen(i) * smooth(0, 0.14, i / n) * smooth(1, 0.86, i / n);   // the locks hang below the belly line
      p.x += sg * 0.01 * Math.sin(Math.PI * s);
      return p;
    };
    // outer face, then the inner face (against the body) and the ragged lower edge closing them
    // the layer thins into the body at its front and rear ends (no open edge)
    const endF = (i) => smooth(0, 0.14, i / n) * smooth(1, 0.86, i / n);
    B.grid(n, m, (i, j) => ({ p: at(i, j / m, (0.004 + 0.028 * (j / m) ** 0.7) * endF(i)), u: i * 0.03, v: -(j / m) * 0.3, w: W_body, shade: 0.88 + 0.12 * (1 - j / m) }),
      { inside: V(0, rings[Math.round((j0 + j1) / 2)].c.y, rings[Math.round((j0 + j1) / 2)].c.z) });
    if (lod === 0) {
      B.grid(n, 1, (i, j) => ({ p: at(i, 1, j ? 0.004 : 0.032), u: i * 0.03, v: -0.3 - j * 0.02, w: W_body, shade: 0.55 }),
        { inside: V(sg * 0.5, rings[Math.round((j0 + j1) / 2)].c.y + 0.5, rings[Math.round((j0 + j1) / 2)].c.z) });
    }
  }
}

/** a lofted head: poll → brow → face → muzzle, eye sockets and eyes, nostrils, mouth line, ears, horns */
/** the head's frame (rest space): start point, face direction, forehead direction, half-width, length */
function headFrame(rig, kind) {
  const d = rig.dims, H = d.H;
  const sheep = kind === 'sheep', goat = kind === 'goat', bull = kind === 'bull';
  const hd = R(rig, 'head');
  const pitch = bull ? -1.0 : goat ? -0.75 : -0.88;
  const fwd = V(0, Math.sin(pitch), -Math.cos(pitch));       // along the face, toward the nose
  const up = V(0, Math.cos(pitch), Math.sin(pitch));         // forehead side
  const hw = bull ? 0.13 : sheep ? 0.055 * H / 0.66 : 0.05;
  const P0 = hd.clone().addScaledVector(up, hw * 0.25).addScaledVector(fwd, -hw * 0.55);
  const len = d.head * (bull ? 0.88 : sheep ? 0.95 : 1.0);
  return { pitch, fwd, up, hw, P0, len };
}

/** the head frame of a quadruped rig (rest space): { fwd (toward the nose), up (forehead side), hw, P0 (poll), len } */
export function quadHeadFrame(rig) {
  const kind = rig.dims.type === 'bull' ? 'bull' : rig.dims.type === 'goat' ? 'goat' : 'sheep';
  return headFrame(rig, kind);
}

/** rest-space point of the halter's chin ring (where a lead rope is tied) for a quadruped rig */
export function halterPoint(rig) {
  if (rig._halter) return rig._halter;
  const kind = rig.dims.type === 'bull' ? 'bull' : rig.dims.type === 'goat' ? 'goat' : 'sheep';
  const { fwd, up, hw, P0, len } = headFrame(rig, kind);
  const prof = HEADS[kind];
  const [t, , h, drop] = prof[prof.length - 2];
  const c = P0.clone().addScaledVector(fwd, t * len).addScaledVector(up, -drop * hw);
  rig._halter = c.addScaledVector(up, -h * hw * 1.05);
  return rig._halter;
}

function head(B, rig, lod, kind, faceSet, bodySet) {
  const d = rig.dims, H = d.H;
  const sheep = kind === 'sheep', goat = kind === 'goat', bull = kind === 'bull';
  const ram = d.type === 'ram';
  const { pitch, fwd, up, hw, P0, len } = headFrame(rig, kind);
  const hb = rig.index.head, jb = rig.index.jaw;
  const prof = HEADS[kind] || HEADS.sheep;
  const rows = lod === 0 ? prof : [prof[0], prof[2], prof[4], prof[6]];
  const eyeT = 0.3;
  const rings = rows.map(([t, w, h, drop]) => ({
    c: P0.clone().addScaledVector(fwd, t * len).addScaledVector(up, -drop * hw), rx: w * hw, rz: h * hw, ax: V(1, 0, 0), az: up.clone(), t,
  }));
  B.set(bull ? { ...faceSet, cls: CLS.GB } : faceSet);
  const W = (p) => {
    const q = p.clone().sub(P0);
    const t = q.dot(fwd) / len, v = q.dot(up) / hw;
    const jw = jb != null ? 0.85 * smooth(0.45, 0.75, t) * smooth(-0.05, -0.35, v + 0.12) : 0;
    return jw > 0.02 ? normW([[hb, 1 - jw], [jb, jw]]) : [[hb, 1]];
  };
  B.tube(rings, {
    seg: sgL(lod, 24, 10), weights: W, capA: 'dome', capB: 'dome', domeH: bull ? 0.45 : 0.6,
    radial: lod === 0 ? (th, j, Rg) => {
      const t = Rg.t, s = Math.sin(th), c = Math.cos(th);
      const sock = -0.07 * g2(Math.abs(c) - 0.82, s - 0.32, 0.22, 0.25) * g2(t - eyeT, 0, 0.09, 1);
      const brow = 0.06 * g2(Math.abs(c) - 0.7, s - 0.62, 0.3, 0.2) * g2(t - eyeT + 0.05, 0, 0.08, 1);
      const cheek = 0.06 * Math.max(0, -s) * g2(t - 0.4, 0, 0.16, 1);
      const roman = sheep ? 0.07 * Math.max(0, s) ** 3 * g2(t - 0.6, 0, 0.22, 1) : goat ? 0.03 * Math.max(0, s) ** 3 * g2(t - 0.6, 0, 0.2, 1) : 0;
      const nostril = 0.05 * Math.max(0, Math.abs(c) - 0.4) * smooth(0.86, 1, t) * Math.max(0, s + 0.2);
      return 1 + sock + brow + cheek + roman + nostril;
    } : null,
    shade: (th, j, p) => {
      const q = p.clone().sub(P0);
      const t = q.dot(fwd) / len, v = q.dot(up) / hw, x = q.x / hw;
      if (t < 0.75) return 1;
      const nos = 0.75 * g2(Math.abs(x) - 0.22, v + 0.12, 0.07, 0.1) * smooth(0.9, 1.0, t);
      const mouth = 0.55 * g2(v + 0.32 + 0.1 * (t - 0.85), 0, 0.04, 1) * smooth(0.72, 0.85, t) * (Math.abs(x) > 0.15 ? 1 : 0.7);
      const split = sheep || goat ? 0.4 * g2(x, v + 0.22, 0.03, 0.12) * smooth(0.92, 1, t) : 0;   // the cleft upper lip
      return 1 - Math.min(0.85, nos + mouth + split);
    },
  });
  // ---- the muzzle. The front of the head is the tube's dome cap: an ellipsoidal cap of depth D on the last ring.
  const mr = rings[rings.length - 1];
  const D = (bull ? 0.45 : 0.6) * Math.min(mr.rx, mr.rz);
  /** a point on the muzzle cap at lateral x and vertical v (head-frame metres, from the last ring's centre) */
  const capPt = (x, v, out = 0.0015) => {
    const q = 1 - (x / mr.rx) ** 2 - (v / mr.rz) ** 2;
    const a = D * Math.sqrt(Math.max(0, q)) + out;
    return mr.c.clone().add(V(x, 0, 0)).addScaledVector(up, v).addScaledVector(fwd, a);
  };
  const capN = (x, v) => V(x / mr.rx ** 2, 0, 0).addScaledVector(up, v / mr.rz ** 2)
    .addScaledVector(fwd, Math.sqrt(Math.max(0.05, 1 - (x / mr.rx) ** 2 - (v / mr.rz) ** 2)) / D).normalize();
  // a point on the side of the face at a fraction t along the head (for the lip line)
  const sideAt = (t, sinT, sg) => {
    let i = 0;
    while (i < rings.length - 2 && rings[i + 1].t < t) i++;
    const A = rings[i], Bq = rings[i + 1];
    const k = clamp((t - A.t) / Math.max(1e-4, Bq.t - A.t));
    const c = A.c.clone().lerp(Bq.c, k), rx = lerp(A.rx, Bq.rx, k), rz = lerp(A.rz, Bq.rz, k);
    const cosT = Math.sqrt(1 - sinT * sinT);
    return c.add(V(sg * cosT * rx * 1.02, 0, 0)).addScaledVector(up, sinT * rz * 1.02);
  };
  if (lod <= 1) {
    // the bare nose pad (rhinarium): a cap just over the muzzle's front — a broad wet pad on the bull; on sheep and
    // goats only the hairless area round the nostrils, down to the split upper lip
    B.set({ cls: CLS.SKIN, pat: PAT.MUZZLE, rough: 0.32, metal: 0, color: bull ? [1, 1, 1] : [0.8, 0.78, 0.78], grp: 0 });
    const pole = bull ? fwd.clone() : fwd.clone().addScaledVector(up, 0.28).normalize();
    const side = V(1, 0, 0), third = new Vector3().crossVectors(side, pole).normalize();
    B.ellipsoid(mr.c.clone(), [mr.rx * 1.02, D * 1.04, mr.rz * 1.02], {
      nu: sgL(lod, 16, 8), nv: sgL(lod, 5, 3), bone: hb, lat: [0, bull ? 0.32 : 0.22],
      xf: new Matrix4().makeBasis(side, pole, third),
    });
    // nostrils: oblique slits (sheep, goat: commas curving out and up; bull: wide openings) set in the pad
    B.set({ cls: CLS.FIX, pat: PAT.NONE, rough: 0.6, metal: 0, color: '#120c0a', grp: 0 });
    for (const sg of [-1, 1]) {
      const x = sg * mr.rx * (bull ? 0.36 : 0.3), v = mr.rz * (bull ? 0.05 : 0.2);
      const p0 = capPt(x, v, 0.0025 * hw / 0.055), n = capN(x, v);
      const along = V(sg * (bull ? 0.25 : 0.55), 0, 0).addScaledVector(up, bull ? 0.4 : 0.8).addScaledVector(n, -0.1).normalize();
      const across = new Vector3().crossVectors(n, along).normalize();
      B.ellipsoid(p0, [hw * (bull ? 0.09 : 0.045), hw * 0.012, hw * (bull ? 0.13 : 0.16)], {
        nu: sgL(lod, 8, 5), nv: 3, bone: hb, xf: new Matrix4().makeBasis(across, n, along), lat: [0, 0.5],
      });
    }
    // the lip line from the front of the muzzle back to the corner of the mouth, and (sheep, goat) the cleft upper
    // lip running down from between the nostrils
    const lipW = hw * (bull ? 0.035 : 0.028);
    for (const sg of [-1, 1]) {
      const pts = [capPt(0, -mr.rz * 0.5, 0.001), capPt(sg * mr.rx * 0.45, -mr.rz * 0.52, 0.001), capPt(sg * mr.rx * 0.82, -mr.rz * 0.5, 0.0005),
        sideAt(0.93, -0.56, sg), sideAt(0.82, -0.6, sg), sideAt(0.72, -0.64, sg)];
      tubeAlong(B, pts, pts.map((_, i) => lipW * (i === pts.length - 1 ? 0.5 : 1)), 4, { weights: W, capB: 'flat' });
    }
    if (!bull) tubeAlong(B, [capPt(0, mr.rz * 0.12, 0.0012), capPt(0, -mr.rz * 0.2, 0.0012), capPt(0, -mr.rz * 0.5, 0.001)], [lipW * 0.7, lipW * 0.8, lipW], 4, { bone: hb });
    // the chin and lower lip: a soft rounded volume under the front of the jaw
    B.set(bull ? { ...faceSet, cls: CLS.GB } : faceSet);
    const chinC = mr.c.clone().addScaledVector(fwd, -0.08 * len).addScaledVector(up, -mr.rz * 0.62);
    B.ellipsoid(chinC, [mr.rx * 0.62, hw * 0.3, mr.rz * 0.38], {
      nu: sgL(lod, 12, 6), nv: sgL(lod, 7, 4), weights: () => normW([[jb, 0.8], [hb, 0.2]]),
      xf: new Matrix4().makeBasis(V(1, 0, 0), fwd.clone(), up.clone().negate()),
    });
  }
  // eyes: large and dark, a horizontal pupil in an amber-brown iris, on the sides of the head under a brow; the upper
  // lid lies over the top of the eyeball (a placid look), dark lid rims all round
  if (lod < 2) {
    const er = hw * (bull ? 0.16 : 0.19);
    const r0 = rings[lod === 0 ? 2 : 1];
    for (const sg of [-1, 1]) {
      const c = r0.c.clone().addScaledVector(fwd, (eyeT - r0.t) * len).add(V(sg * r0.rx * 0.8, 0, 0)).addScaledVector(up, r0.rz * 0.3);
      const rot = new Matrix4().makeRotationY(sg * 1.05).multiply(new Matrix4().makeRotationX(-pitch * 0.4));
      B.set({ cls: CLS.FIX, pat: PAT.AEYE, rough: 0.05, metal: 0, color: bull ? '#2e1a0e' : goat ? '#a77b26' : '#7c5321', grp: 0 });
      B.ellipsoid(c, [er, er, er], { nu: sgL(lod, 14, 7), nv: sgL(lod, 10, 5), bone: hb, xf: rot, uvFn: (q) => [q.x / er, q.y / er] });
      B.set({ ...faceSet, color: [0.42, 0.42, 0.42] });
      B.ellipsoid(c, [er * 1.1, er * 1.1, er * 1.1], { nu: sgL(lod, 14, 8), nv: 4, bone: hb, xf: rot, lat: [0, 0.4] });
      if (lod === 0) B.ellipsoid(c, [er * 1.08, er * 1.08, er * 1.08], { nu: 12, nv: 3, bone: hb, xf: rot, lat: [0.72, 1] });
    }
  }
  // ears: a leaf, narrow at the root, widest past the middle, rounded at the tip, cupped (a hollow inner face, paler
  // and pinkish) and thicker at the root. The local sheep and goats carry long pendulous ears, the bull's stand level.
  for (const s of ['l', 'r']) {
    const e = R(rig, `ear_${s}`), sg = s === 'l' ? -1 : 1;
    const el = bull ? 0.15 : goat ? 0.19 : sheep ? 0.14 * H / 0.66 : 0.08;
    const ew = el * (goat ? 0.36 : sheep ? 0.44 : 0.55);
    const droop = goat ? 1.4 : sheep ? 1.2 : 0.15;
    // ear frame: a = along the ear (root → tip), b = across it, nrm = the outer (hairy) face's normal
    const a = V(0, 0, 0);
    a.set(sg * Math.cos(droop * 0.9), -Math.sin(droop * 0.9), 0.22).normalize();
    const nrm = V(sg * Math.sin(droop * 0.9), Math.cos(droop * 0.9), 0.1).normalize();  // up-and-out when level
    nrm.addScaledVector(a, -nrm.dot(a)).normalize();
    nrm.applyAxisAngle(a, sg * (bull ? 0.5 : 0.75)).normalize();          // the outer face turned back: the hollow faces forward
    const b = new Vector3().crossVectors(nrm, a).normalize();
    const root = e.clone().add(V(sg * 0.008, -0.004, 0.008));
    const nu2 = sgL(lod, 10, 5), nv2 = sgL(lod, 8, 4);
    const ear = (inner) => {
      B.set({ ...faceSet, pat: PAT.COAT, color: inner ? [1.3, 1.02, 0.96] : [1, 1, 1] });
      B.grid(nu2, nv2, (i, j) => {
        const u = j / nv2, w = (i / nu2) * 2 - 1;                 // u: root → tip, w: edge to edge
        const width = ew * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(1, u * 0.85 + 0.12))) * (1 - 0.55 * smooth(0.82, 1, u)) * 0.5;
        const cup = (1 - w * w) * ew * 0.16 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05));   // the hollow of the ear
        const thick = el * 0.045 * (1 - u * 0.7) * (1 - 0.5 * w * w);
        const p = root.clone().addScaledVector(a, u * el).addScaledVector(b, w * width)
          .addScaledVector(nrm, (inner ? -0.5 : 0.5) * thick - cup);
        return { p, u: w * width, v: -u * el, w: rig.index[`ear_${s}`], shade: inner ? 0.72 + 0.28 * (1 - Math.abs(w)) : 1 };
      }, { inside: root.clone().addScaledVector(nrm, inner ? 0.5 : -0.5).addScaledVector(a, el * 0.5) });
    };
    ear(false);
    ear(true);
  }
  // horns
  const cran = rings[1].c;
  const lambHorn = sheep && !ram;
  if (ram || lambHorn || goat || bull) {
    B.set({ cls: CLS.FIX, pat: PAT.HORN, rough: 0.5, metal: 0, color: goat ? '#2c2624' : bull ? '#cdbb9a' : '#c2ab86', grp: 0 });
    for (const sg of [-1, 1]) {
      const pts = [], rad = [];
      const n = sgL(lod, 20, 8);
      const base = cran.clone().addScaledVector(up, hw * 0.72).add(V(sg * hw * (goat ? 0.32 : 0.5), 0, 0));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        let p;
        if (ram) { // a full spiral back, down and forward round the ear, its plane tipped outward
          const a = t * Math.PI * 1.8, Rr = 0.075 * (1 - 0.3 * t);
          const off = V(sg * (0.015 + 0.05 * t), Rr * Math.sin(a) * 0.85 - 0.06 * t, Rr * (1 - Math.cos(a)) * 0.9 - 0.01 * t);
          off.applyAxisAngle(V(0, 0, 1), -sg * 0.6);
          p = base.clone().add(off);
          rad.push(lerp(0.034, 0.008, t));
        } else if (lambHorn) { // the yearling's short horns curving back and out
          p = base.clone().add(V(sg * 0.03 * t, 0.035 * t - 0.03 * t * t, 0.05 * t + 0.02 * t * t));
          rad.push(lerp(0.016, 0.005, t));
        } else if (goat) { // scimitar: up from the poll, then back in one smooth arc, the tips diverging
          const ang = t * 1.5;
          p = base.clone().add(V(sg * (0.012 + 0.05 * t * t), 0.2 * Math.sin(ang) * 0.85, 0.2 * (1 - Math.cos(ang)) * 0.9 + 0.01 * t));
          rad.push(lerp(0.017, 0.003, t ** 0.9));
        } else {
          p = base.clone().add(V(sg * 0.15 * t, 0.06 * t * t + 0.03 * t, -0.07 * t * t));
          rad.push(lerp(0.036, 0.008, t));
        }
        pts.push(p);
      }
      // goat horns are flattened side to side (a keel in front); sheep horns ridged across
      const hr = goat ? rad.map((r) => [r * 0.62, r * 1.15]) : rad;
      tubeAlong(B, pts, hr, sgL(lod, 10, 5), { bone: hb, capB: 'dome', domeH: 0.8,
        radial: lod === 0 && !bull ? (th, j) => 1 + (goat ? 0.05 * Math.max(0, Math.sin(j * 3.1)) : 0.07 * Math.max(0, Math.sin(j * 2.6))) : null });
    }
  }
  if (bull && lod === 0) { // the curly poll between the horns
    B.set({ ...faceSet, pat: PAT.COAT_LONG, color: [0.8, 0.8, 0.8] });
    B.ellipsoid(cran.clone().addScaledVector(up, hw * 0.65), [hw * 0.55, hw * 0.18, hw * 0.4], { nu: 10, nv: 5, bone: hb, lat: [0, 0.6] });
  }
  if (goat) { // beard: a tuft growing from the underside of the chin (its root sunk in the jaw), hanging down and a
    // little back, flattened side to side, tapering to a few locks
    B.set({ ...faceSet, pat: lod === 0 ? PAT.COAT_LONG : PAT.COAT });
    const r2 = rings[rings.length - 2];
    const chin = r2.c.clone().addScaledVector(fwd, -0.04 * len).addScaledVector(up, -r2.rz * 0.72);
    const down = V(0, -1, 0.18).normalize();
    const pts = [chin.clone().addScaledVector(up, r2.rz * 0.25), chin, chin.clone().addScaledVector(down, 0.045), chin.clone().addScaledVector(down, 0.09).add(V(0, 0, 0.006)), chin.clone().addScaledVector(down, 0.125).add(V(0, 0, 0.012))];
    const rad = [[0.012, 0.026], [0.013, 0.03], [0.011, 0.024], [0.007, 0.014], [0.002, 0.004]];
    tubeAlong(B, pts, rad, sgL(lod, 9, 5), { weights: (p) => normW([[jb, 0.7], [hb, 0.3]]), capB: 'dome', domeH: 0.5,
      radial: lod === 0 ? (th, j) => 1 + 0.18 * Math.sin(th * 5 + j * 1.7) * smooth(1, 3, j) : null });
  }
  // the halter (optional part): a rope over the nose and behind the ears, a short lead end hanging from the chin
  {
    const nose = rings[rings.length - 2], poll = rings[1];
    const ropeSet = { cls: CLS.FIX, pat: PAT.ROPE, rough: 0.9, metal: 0, color: '#9c8462' };
    const loop = (R0, scale, grp) => {
      B.set({ ...ropeSet, grp });
      const n = sgL(lod, 16, 8), pts = [];
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        pts.push(R0.c.clone().add(V(Math.cos(a) * R0.rx * scale, 0, 0)).addScaledVector(up, Math.sin(a) * R0.rz * scale));
      }
      tubeAlong(B, pts, pts.map(() => 0.006 * (bull ? 1.6 : 1)), 5, { bone: hb });
    };
    loop(nose, 1.08, AGRP.HALTER);
    loop({ ...poll, c: poll.c.clone().addScaledVector(fwd, -0.02) }, 1.12, AGRP.HALTER);
    // cheek pieces joining them
    for (const sg of [-1, 1]) {
      B.set({ ...ropeSet, grp: AGRP.HALTER });
      tubeAlong(B, [poll.c.clone().add(V(sg * poll.rx * 1.1, 0, 0)), nose.c.clone().add(V(sg * nose.rx * 1.08, 0, 0))], [0.005, 0.005], 4, { bone: hb });
    }
    B.set({ ...ropeSet, grp: AGRP.LEAD });
    const chin = nose.c.clone().addScaledVector(up, -nose.rz * 1.05);
    tubeAlong(B, [chin, chin.clone().add(V(0.01, -0.08, 0.02)), chin.clone().add(V(0.015, -0.16, 0.06)), chin.clone().add(V(0.012, -0.2, 0.12))],
      [0.006, 0.006, 0.006, 0.005].map((r) => r * (bull ? 1.5 : 1)), 5, { weights: () => normW([[hb, 0.7], [rig.index.neck2, 0.3]]), capB: 'flat' });
  }
}

/**
 * Leg from inside the body to the hoof: forearm (front) / gaskin (hind) muscle, the knee (carpus) or the
 * point of the hock, a slim cannon, the fetlock, a short sloping pastern and two claws (cloven hoof).
 */
function legMesh(B, rig, lod, leg, kind, bodySet, faceSet, fleece) {
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
    V(up.x * 0.6, up.y - (front ? 0.2 : 0.16) * H, up.z + (front ? 0 : 0.02 * d.L)),
    up.clone().lerp(lo, 0.45),
    up.clone().lerp(lo, 0.82),
    lo.clone().add(V(0, 0, back * 0.5)),
    lo.clone().lerp(ft, 0.35),
    lo.clone().lerp(ft, 0.82),
    ft.clone(),
    ft.clone().add(pastern),
    hoofTop,
  ];
  const k = lw;
  const rad = [
    [k * (bull ? 1.35 : 1.2), k * (front ? 1.2 : 1.5)],
    [k * 0.98, k * (front ? 1.02 : 1.28)],
    [k * 0.66, k * (front ? 0.7 : 0.8)],
    [k * 0.68, k * (front ? 0.74 : 0.92)],
    [k * 0.44, k * 0.52],
    [k * 0.45, k * 0.5],
    [k * 0.58, k * 0.62],
    [k * 0.44, k * 0.46],
    [k * 0.47, k * 0.5],
  ];
  const sel = lod === 0 ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 3, 4, 6, 8];
  if (sheep) {
    // fleece down to just past the knee/hock (a woolly cuff), short brown hair below
    // the fleece runs down the upper leg and thins out above the knee / hock into the short brown hair below:
    // the radius tapers onto the leg and the locks flatten, so there is no woolly sleeve with an open cuff
    B.set(bodySet);
    const top = [0, 1, 2].filter((i) => sel.includes(i) || i === 2);
    const legC = (p) => { let best = pts[0], bd = Infinity; for (const q of pts) { const dd = q.distanceTo(p); if (dd < bd) { bd = dd; best = q; } } return best; };
    const fade = (p) => smooth(pts[2].y, pts[1].y + 0.02 * H, p.y);
    const fr = (i) => [rad[i][0] * (i === 2 ? 1.08 : 1) + fleece * [0.62, 0.42, 0.06][i], rad[i][1] * (i === 2 ? 1.08 : 1) + fleece * [0.62, 0.42, 0.06][i]];
    withLocks(B, lod === 0 ? 0.03 : 0.02, 1.3, legC, () => tubeAlong(B, top.map((i) => pts[i]), top.map(fr), sgL(lod, 16, 6), { weights: W, capA: 'dome' }), 0.008, fade);
    B.set(faceSet);
    const lower = [3, 4, 5, 6, 7, 8].filter((i) => sel.includes(i));
    // the short-haired leg starts inside the end of the wool (no gap) and runs down through the knee / hock
    const lp = [pts[2].clone().lerp(pts[1], 0.3), ...lower.map((i) => pts[i])];
    const lr = [[rad[2][0] * 1.02, rad[2][1] * 1.02], ...lower.map((i) => [rad[i][0] * 0.98, rad[i][1] * 0.98])];
    tubeAlong(B, lp, lr, sgL(lod, 12, 6), { weights: W, capA: 'dome' });
  } else {
    B.set(bodySet);
    const upper = [0, 1, 2, 3].filter((i) => sel.includes(i));
    tubeAlong(B, upper.map((i) => pts[i]), upper.map((i) => rad[i]), sgL(lod, 12, 6), { weights: W, capA: 'dome' });
    B.set(kind === 'goat' ? bodySet : { ...faceSet, cls: CLS.GA });
    const lower = [3, 4, 5, 6, 7, 8].filter((i) => sel.includes(i));
    const lp = lower.map((i) => pts[i]); lp[0] = pts[3].clone().lerp(pts[2], 0.35);
    tubeAlong(B, lp, lower.map((i) => rad[i]), sgL(lod, 10, 6), { weights: W, capA: 'dome' });
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
        if (l.y < -hh * 0.38) l.y = -hh * 0.38 - (l.y + hh * 0.38) * 0.1;
        l.z += 0.35 * Math.max(0, hh * 0.5 - l.y) * -0.4;
        if (l.x * sg < 0) l.x *= 0.55;
        return l;
      },
    });
  }
  if (lod === 0) {
    for (const sg of [-1, 1]) B.ellipsoid(ft.clone().add(V(sg * lw * 0.3, -0.012 * H, lw * 0.5)), [lw * 0.1, lw * 0.14, lw * 0.12], { nu: 5, nv: 3, bone: fb });
  }
  // the akedah cord (optional part): binds the cannon of the upper fore leg to the upper hind leg (Tamid 4:1,
  // Bartenura "the hand with the foot") — placed on the left legs, which lie uppermost in the bound pose
  if (leg === 'fl' || leg === 'hl') {
    B.set({ cls: CLS.FIX, pat: PAT.ROPE, rough: 0.9, metal: 0, color: '#a89272', grp: AGRP.CORD });
    const c = lo.clone().lerp(ft, 0.6);
    const n = 10, pts2 = [];
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2; pts2.push(c.clone().add(V(Math.cos(a) * lw * 0.62, 0.012 * Math.sin(a * 0.5), Math.sin(a) * lw * 0.62))); }
    tubeAlong(B, pts2, pts2.map(() => 0.0045), 4, { bone: rig.index[`${leg}_lo`] });
  }
}

/** turtledove / young pigeon (and the generic 'dove'): body, neck, head with beak and eyes, folded wings with the
 *  primaries crossing over the tail, tail, pink legs. Feather pattern + per-region colours. */
function bird(B, rig, lod, kind) {
  const I = rig.index;
  const turtle = kind === 'turtledove';
  const body = { cls: CLS.GA, pat: PAT.FEATHER, rough: 0.6, metal: 0, color: [1, 1, 1], grp: 0 };
  B.set(body);
  B.ellipsoid(V(0, 0.085, 0.005), [0.034, 0.036, 0.074], { nu: sgL(lod, 16, 8), nv: sgL(lod, 10, 5), bone: I.body, xf: new Matrix4().makeRotationX(0.25),
    deform: (l) => { if (l.z < 0) l.y *= 1.08; if (l.y < 0) l.x *= 0.92; return l; },
    col: (l) => (l.y < -0.01 && l.z < 0.02 ? (turtle ? [1.12, 1.0, 0.92] : [1.06, 1.06, 1.08]) : null) }); // paler breast/belly
  // neck & head: the pigeon's iridescent neck, the turtledove's striped neck patch
  B.set({ cls: CLS.STRIPE, pat: PAT.FEATHER, rough: 0.35, metal: turtle ? 0 : 0.25, color: [1, 1, 1], grp: 0 });
  B.ellipsoid(V(0, 0.125, -0.054), [0.021, 0.03, 0.022], { nu: sgL(lod, 10, 6), nv: 6, weights: [[I.neck, 0.7], [I.body, 0.3]],
    col: turtle ? (l) => (Math.abs(l.x) > 0.012 && l.y > -0.01 && l.y < 0.012 ? [0.25, 0.25, 0.28] : null) : null });
  if (turtle && lod === 0) { // the black-and-white striped patch on each side of the neck
    for (const sg of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        B.set({ cls: CLS.FIX, pat: PAT.NONE, rough: 0.6, metal: 0, color: k % 2 ? '#e9e6e0' : '#1d1b1d', grp: 0 });
        B.ellipsoid(V(sg * 0.0205, 0.122 + k * 0.004 - 0.006, -0.05), [0.0025, 0.0018, 0.008], { nu: 5, nv: 3, weights: [[I.neck, 0.7], [I.body, 0.3]] });
      }
    }
  }
  B.set({ ...body, cls: CLS.HAIR });
  const hd = R(rig, 'head');
  B.ellipsoid(hd.clone().add(V(0, 0.005, -0.004)), [0.018, 0.019, 0.022], { nu: sgL(lod, 12, 6), nv: 7, bone: I.head });
  // eyes: dark with a coloured ring (turtledove: a red orbital ring; pigeon: orange iris)
  for (const sg of [-1, 1]) {
    const c = hd.clone().add(V(sg * 0.0145, 0.009, -0.009));
    B.set({ cls: CLS.FIX, pat: PAT.AEYE, rough: 0.05, metal: 0, color: turtle ? '#7a2a14' : '#d0761e', grp: 0 });
    B.ellipsoid(c, [0.0042, 0.0042, 0.0042], { nu: 8, nv: 6, bone: I.head, xf: new Matrix4().makeRotationY(sg * 1.4), uvFn: (q) => [q.x / 0.0042, q.y / 0.0042] });
    if (turtle && lod === 0) {
      B.set({ cls: CLS.FIX, pat: PAT.NONE, rough: 0.5, metal: 0, color: '#b0473a', grp: 0 });
      B.ellipsoid(c.clone().add(V(-sg * 0.0008, 0, 0)), [0.0052, 0.0052, 0.0052], { nu: 8, nv: 3, bone: I.head, xf: new Matrix4().makeRotationY(sg * 1.4), lat: [0.35, 0.65] });
    }
  }
  // beak with the cere at its base
  B.set({ cls: CLS.FIX, pat: PAT.HORN, rough: 0.5, metal: 0, color: '#3a3433', grp: 0 });
  tubeAlong(B, [hd.clone().add(V(0, 0.0, -0.022)), hd.clone().add(V(0, -0.004, -0.037))], [0.0048, 0.0014], 6, { bone: I.head, capB: 'flat' });
  if (!turtle) { B.set({ cls: CLS.FIX, pat: PAT.NONE, rough: 0.7, metal: 0, color: '#e7e1d8', grp: 0 }); B.ellipsoid(hd.clone().add(V(0, 0.003, -0.023)), [0.005, 0.003, 0.004], { nu: 6, nv: 3, bone: I.head }); }
  // wings (folded along the sides): coverts (turtledove: rufous edged, dark-centred scales; pigeon: two dark bars),
  // the primaries reach back over the tail
  for (const s of ['l', 'r']) {
    const sg = s === 'l' ? -1 : 1;
    const a = R(rig, `wing_${s}`), b = R(rig, `wing_${s}2`);
    B.set({ ...body, cls: CLS.GB });
    B.ellipsoid(a.clone().lerp(b, 0.5).add(V(sg * 0.009, -0.004, 0.012)), [0.012, 0.024, 0.072], { nu: sgL(lod, 10, 6), nv: 6,
      weights: (p) => normW([[I[`wing_${s}`], 1], [I[`wing_${s}2`], smooth(a.z, b.z + 0.03, p.z)]]),
      col: (l) => {
        if (turtle) return l.z < 0.01 ? (Math.sin(l.z * 600) > 0.2 ? [0.55, 0.42, 0.36] : [1.25, 0.95, 0.7]) : [0.55, 0.55, 0.6];
        return Math.abs(l.z - 0.005) < 0.005 || Math.abs(l.z - 0.022) < 0.005 ? [0.3, 0.3, 0.32] : (l.z > 0.04 ? [0.7, 0.7, 0.74] : null);
      } });
  }
  // tail fan (the turtledove's longer, dark with white tips)
  B.set({ ...body, cls: CLS.GB });
  B.box(R(rig, 'tail').clone().add(V(0, 0, turtle ? 0.06 : 0.05)), [0.05, 0.008, turtle ? 0.1 : 0.08], { bone: I.tail, shade: (p) => (p.z > (turtle ? 0.16 : 0.13) ? (turtle ? 1.6 : 0.5) : turtle ? 0.6 : 1) });
  // legs and toes
  B.set({ cls: CLS.FIX, pat: PAT.SKIN, rough: 0.6, metal: 0, color: '#b0545a', grp: 0 });
  for (const s of ['l', 'r']) {
    const l = R(rig, `leg_${s}`);
    tubeAlong(B, [l.clone(), V(l.x, 0.005, l.z - 0.004)], [0.004, 0.0035], 5, { bone: I[`leg_${s}`], capB: 'flat' });
    for (const a of [-0.5, 0, 0.5, Math.PI]) {
      const dir = V(Math.sin(a), 0, -Math.cos(a));
      tubeAlong(B, [V(l.x, 0.003, l.z - 0.004), V(l.x, 0.002, l.z - 0.004).addScaledVector(dir, a === Math.PI ? 0.01 : 0.016)], [0.0018, 0.0012], 4, { bone: I[`leg_${s}`], capB: 'flat' });
    }
  }
}

export function buildAnimalGeometry(def, rig, lod) {
  const B = new MeshBuilder(rig);
  if (def.build === 'dove') bird(B, rig, lod, def.kind || 'pigeon');
  else quad(B, rig, lod, def.build);
  return B.build();
}
export { clamp };

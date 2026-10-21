// The vessels: the Menorah (with the stone of three steps), the Shulchan with the lechem hapanim, the golden altar,
// and the two showbread tables of the Ulam. All in site amot; positions from site.js (heichal.menorah / shulchan /
// mizbach-hazahav / ulam.tables); forms from report Part IX §38 (the Menorah's 18-tefach ladder, Menachot 28b with
// Rambam BhB 3:1–11; the Shulchan's support set, Menachot 11:4–7, Rambam BhB 3:12–15) and the locks #11, #12, #30–#33.
import { BufferGeometry, Float32BufferAttribute, CatmullRomCurve3, Vector3, Group, Mesh } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AMAH } from '../../core/units.js';
import { applyWorldUV } from '../geom.js';
import { B, Mesher, lathe, latheAlong, tube, add3, sub3, scl3, len3, cross3 } from './lib/geo.js';

const TF = 1 / 6;            // one tefach in amot
const ETZ = TF / 4;          // one etzba

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** the Menorah: returns the 7 lamp flame points (site), east → west */
export function buildMenorah(H) {
  const { kit, el, d } = H;
  const e = el('heichal.menorah');
  const b = e.box;
  const cx = (b.min[0] + b.max[0]) / 2, cy = (b.min[1] + b.max[1]) / 2, z0 = b.min[2];
  const t = (v) => v * TF;                     // tefachim → amot
  const seg = [8, 12, 24, 32][d];              // ornaments (smooth-shaded lathes)
  const segS = [6, 8, 16, 24][d];              // shaft, branches, legs
  const segB = [6, 10, 20, 28][d];             // ornaments on the branches
  const key = 'gold_vessel';
  const add = (g) => kit.geo(g, key, { collide: false, castShadow: true });
  const C = (z) => [cx, cy, z0 + t(z)];
  // ornament profiles (tefachim, local to their base): goblet = Alexandrian cup (wide mouth, narrow foot);
  // knob = Cretan apple (egg, both ends alike); flower = column-capital flower (a bowl, its lip folded outward)
  // (Rambam BhB 3:9). Inner surfaces return to the stem so every part is closed. Thickness is not given anywhere
  // (Part IX §38.1): the shaft and ornaments are as full as the 2-tefach pitch of the lamp row lets the inner
  // branches clear the central stem's head ⚙ (docs/decisions/build-heichal.md).
  const R = 0.3;                                // shaft radius (t)
  const RB = 0.24, RB1 = 0.21;                  // branch radius at its knob / at the lamp (t)
  const goblet = (h, rm, r0 = R) => [[r0, 0], [r0 * 1.25, h * 0.12], [rm * 0.55, h * 0.55], [rm, h * 0.96], [rm * 0.92, h], [rm * 0.5, h * 0.72], [r0, h * 0.6]];
  const knob = (h, rk, r0 = R) => { const p = []; const n = d >= 2 ? 10 : 6; for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (Math.PI * i) / n; p.push([Math.max(r0, rk * Math.cos(a)), h / 2 + (h / 2) * Math.sin(a)]); } return p; };
  const flower = (h, rf, r0 = R) => [[r0, 0], [rf * 0.55, h * 0.45], [rf * 0.9, h * 0.8], [rf * 1.08, h * 0.86], [rf, h], [rf * 0.62, h * 0.82], [r0, h * 0.9]];
  const scaleT = (prof) => prof.map(([r, z]) => [t(r), t(z)]);
  const ornament = (prof, z) => add(lathe(scaleT(prof), C(z), seg));
  // the shaft (continuous)
  add(lathe([[t(R), 0], [t(R), t(16.4)]], C(1.4), segS));
  // legs and the base flower: 3 tefachim (three legs — Rambam BhB 3:2)
  ornament(flower(1.0, 0.9), 2.0);
  for (let i = 0; i < 3; i++) {
    const a = (i * 2 * Math.PI) / 3;              // 0 = north (toward the room / the stone), then 120°, 240°
    const dir = [Math.sin(a), Math.cos(a)];
    const p0 = [cx, cy, z0 + t(2.0)];
    const p1 = [cx + dir[0] * t(1.3), cy + dir[1] * t(1.3), z0 + t(0.9)];
    const p2 = [cx + dir[0] * t(2.35), cy + dir[1] * t(2.35), z0 + t(0.12)];
    add(latheAlong([[t(0.34), 0], [t(0.27), len3(sub3(p1, p0))]], p0, p1, segS));
    add(latheAlong([[t(0.27), 0], [t(0.22), len3(sub3(p2, p1))]], p1, p2, segS));
    add(lathe(scaleT([[0, 0], [0.4, 0], [0.43, 0.07], [0.3, 0.16], [0, 0.16]]), [p2[0], p2[1], z0], segS));
  }
  // 5–6: goblet, knob, flower
  ornament(goblet(0.36, 0.52), 5.0);
  ornament(knob(0.32, 0.46), 5.36);
  ornament(flower(0.32, 0.54), 5.68);
  // the three branch knobs (8–9, 10–11, 12–13), each with two branches "drawn up level with the Menorah's height"
  for (const kz of [8, 10, 12]) ornament(knob(1.0, 0.56), kz);
  // the head (15–18): three goblets, knob, flower — the central lamp sits on it
  ornament(goblet(0.55, 0.55), 15.0);
  ornament(goblet(0.55, 0.55), 15.55);
  ornament(goblet(0.55, 0.55), 16.1);
  ornament(knob(0.6, 0.48), 16.65);
  ornament(flower(0.45, 0.6), 17.25);
  // the six branches: straight diagonals (lock #30: Rashi; the Rambam's autograph sketch) from the knobs to an
  // east–west row of lamps (lock #11), spaced evenly over the site's 2-amah span ⚙
  const lampZ = 17.3;                               // branch tops (t) where the lamp seat begins
  const lamps = [];
  const half = (b.max[0] - b.min[0]) / 2;           // amot
  const pairs = [[12.5, 1 / 3], [10.5, 2 / 3], [8.5, 1]];
  for (const [kz, frac] of pairs) for (const s of [-1, 1]) {
    const dx = s * half * frac;
    const p0 = [cx, cy, z0 + t(kz)];
    const p1 = [cx + dx, cy, z0 + t(lampZ)];
    const dirv = sub3(p1, p0), L = len3(dirv), u = scl3(dirv, 1 / L);
    add(latheAlong([[t(RB), 0], [t(RB1), L]], p0, p1, segS));
    // the branch's ornaments along its last three tefachim (three goblets, knob, flower), aligned with it — at every
    // tier: all 22 goblets, 11 knobs and 9 flowers are me'akev (Rambam BhB 3:3)
    const cosA = (p1[2] - p0[2]) / L;
    const along = (zt) => (t(zt - kz)) / cosA;     // axis length at height zt (t)
    const onBranch = (prof, zt) => {
      const sA = along(zt);
      const q0 = add3(p0, scl3(u, sA)), q1 = add3(p0, scl3(u, sA + 1));
      add(latheAlong(scaleT(prof), q0, q1, segB));
    };
    onBranch(goblet(0.5, 0.44, RB1), lampZ - 2.6);
    onBranch(goblet(0.5, 0.44, RB1), lampZ - 2.1);
    onBranch(goblet(0.5, 0.44, RB1), lampZ - 1.6);
    onBranch(knob(0.55, 0.4, RB1), lampZ - 1.1);
    onBranch(flower(0.45, 0.48, RB1), lampZ - 0.5);
    lamps.push({ x: cx + dx, dir: -s });             // nozzles toward the centre (Rambam BhB 3:8)
  }
  lamps.push({ x: cx, dir: -1, centre: true });       // the middle lamp faces west, toward the KhK
  lamps.sort((a, c) => c.x - a.x);                    // east → west
  // the lamps: fixed in the branches (Rambam BhB 3:7) — round-bodied oil lamps with a short spatulate nozzle ⚙
  const flames = [];
  const lampBase = z0 + t(lampZ + 0.05);
  const body = scaleT([[0, 0], [0.26, 0], [0.4, 0.1], [0.42, 0.22], [0.32, 0.32], [0.14, 0.32], [0.1, 0.38], [0, 0.38]]);
  for (const L of lamps) {
    add(lathe(body, [L.x, cy, lampBase], seg));
    // nozzle toward the centre, its tip a little raised. The lamps stand 2 tefachim apart and the centre one faces
    // west, toward the inner western lamp that faces it: its nozzle is kept short so the two flames stay ≈ 9 cm
    // apart (the others 2 tefachim) ⚙
    const reach = L.centre ? 0.34 : 0.5;
    const tip = [L.x + L.dir * t(reach), cy, lampBase + t(0.27)];
    const m = new Mesher();
    m.beam([L.x + L.dir * t(L.centre ? 0.16 : 0.25), cy, lampBase + t(0.18)], tip, t(0.24), t(0.13));
    add(m.geometry());
    flames.push([tip[0] + L.dir * t(0.02), cy, tip[2] + t(0.1)]);
  }
  // the stone with three steps before it (Tamid 3:9; Rambam BhB 3:11), the kohen facing south toward the lamps
  const st = e.params.stone.box;
  const n = e.params.stone.steps, rise = (st.max[2] - st.min[2]) / n, run = (st.max[1] - st.min[1]) / n;
  const sm = kit.m('marble_white', true, true);
  for (let i = 0; i < n; i++) {
    // step 1 (lowest) at the north edge; each next one half an amah higher, toward the Menorah
    const y1 = st.max[1] - i * run, y0 = y1 - run;
    sm.box([st.min[0], y0, st.min[2]], [st.max[0], y1, st.min[2] + rise * (i + 1)], 'xXyYZ');
  }
  return { flames, centre: [cx, cy, z0], lamps };
}

/** a table of the Shulchan's form: top with a gold zer, four legs, the misgeret low between them (lock #33) */
function goldTable(H, box, key, { zer = true } = {}) {
  const { kit, d } = H;
  const m = kit.m(key, true, true);
  const top = box.max[2], th = 0.12, legW = 0.1;
  const [x0, y0] = box.min, [x1, y1] = box.max, z0 = box.min[2];
  m.box([x0, y0, top - th], [x1, y1, top]);
  if (zer) {
    // the zer (a gold crown-moulding round the top edge), rising a little above the top
    const zh = 0.06, zw = 0.04;
    m.box([x0 - 0.02, y0 - 0.02, top - 0.05], [x1 + 0.02, y0 + zw, top + zh]);
    m.box([x0 - 0.02, y1 - zw, top - 0.05], [x1 + 0.02, y1 + 0.02, top + zh]);
    m.box([x0 - 0.02, y0 + zw, top - 0.05], [x0 + zw, y1 - zw, top + zh]);
    m.box([x1 - zw, y0 + zw, top - 0.05], [x1 + 0.02, y1 - zw, top + zh]);
  }
  for (const [lx, ly] of [[x0 + 0.04, y0 + 0.04], [x1 - 0.04 - legW, y0 + 0.04], [x0 + 0.04, y1 - 0.04 - legW], [x1 - 0.04 - legW, y1 - 0.04 - legW]]) {
    m.box([lx, ly, z0], [lx + legW, ly + legW, top - th]);
    if (d >= 2) {
      m.box([lx - 0.015, ly - 0.015, z0 + 0.32], [lx + legW + 0.015, ly + legW + 0.015, z0 + 0.36]);
      m.box([lx - 0.02, ly - 0.02, z0], [lx + legW + 0.02, ly + legW + 0.02, z0 + 0.05]);
    }
  }
  // the misgeret: a frame a tefach high between the legs, below (Menachot 96b — the Rabbis)
  const fz0 = z0 + 0.22, fz1 = fz0 + TF, ft = 0.03;
  m.box([x0 + 0.06, y0 + 0.06, fz0], [x1 - 0.06, y0 + 0.06 + ft, fz1]);
  m.box([x0 + 0.06, y1 - 0.06 - ft, fz0], [x1 - 0.06, y1 - 0.06, fz1]);
  m.box([x0 + 0.06, y0 + 0.06, fz0], [x0 + 0.06 + ft, y1 - 0.06, fz1]);
  m.box([x1 - 0.06 - ft, y0 + 0.06, fz0], [x1 - 0.06, y1 - 0.06, fz1]);
  return top;
}

/** a polyline [y, z] with each corner rounded by radius r[i] (0 = sharp) into `n` arc steps */
function rounded(pts, radii, n) {
  const out = [];
  const N = pts.length;
  for (let i = 0; i < N; i++) {
    const A = pts[(i - 1 + N) % N], Bp = pts[i], Cp = pts[(i + 1) % N];
    const r = radii[i];
    if (!r || n < 1) { out.push(Bp); continue; }
    const u1 = [A[0] - Bp[0], A[1] - Bp[1]], u2 = [Cp[0] - Bp[0], Cp[1] - Bp[1]];
    const l1 = Math.hypot(...u1), l2 = Math.hypot(...u2);
    u1[0] /= l1; u1[1] /= l1; u2[0] /= l2; u2[1] /= l2;
    const th = Math.acos(Math.max(-1, Math.min(1, u1[0] * u2[0] + u1[1] * u2[1])));
    const dT = Math.min(r / Math.tan(th / 2), l1 * 0.49, l2 * 0.49);
    const rr = dT * Math.tan(th / 2);
    const bis = [u1[0] + u2[0], u1[1] + u2[1]], bl = Math.hypot(...bis) || 1;
    const c = [Bp[0] + (bis[0] / bl) * (rr / Math.sin(th / 2)), Bp[1] + (bis[1] / bl) * (rr / Math.sin(th / 2))];
    const t1 = [Bp[0] + u1[0] * dT, Bp[1] + u1[1] * dT], t2 = [Bp[0] + u2[0] * dT, Bp[1] + u2[1] * dT];
    let a1 = Math.atan2(t1[1] - c[1], t1[0] - c[0]), a2 = Math.atan2(t2[1] - c[1], t2[0] - c[0]);
    let da = a2 - a1;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    for (let k = 0; k <= n; k++) { const a = a1 + (da * k) / n; out.push([c[0] + rr * Math.cos(a), c[1] + rr * Math.sin(a)]); }
  }
  return out;
}

/**
 * One loaf of the lechem hapanim as a rounded "breached box" (R' Chanina, Menachot 94b): a 5-tefach floor across the
 * table and two walls folded up 2½ tefachim each side (R' Yehudah's 10-tefach loaf on his 10 × 5 table, lock #31),
 * open at its east and west ends; the walls lean out a little and their tops dip a little toward the middle (baked
 * in a mould and lifted out); 7-etzba horns rise from the walls' ends (Menachot 11:4; the 7 etzba'ot are the horns'
 * own height — Shiltei HaGiborim, Part X §53), curling outward. Indexed and smooth-shaded; world geometry.
 */
function loafGeometry(x0, x1, yS, yN, z, d, R) {
  const A = AMAH;
  const W = yN - yS;
  const hw = 10 * ETZ, tw = 1.25 * ETZ, tb = 1.25 * ETZ;
  const lean = 0.35 * ETZ * (0.7 + 0.6 * R());
  const sag = 0.35 * ETZ * (0.6 + 0.8 * R());
  const fo = d >= 2 ? 3 : d >= 1 ? 2 : 0;
  // section (y across, z up), counter-clockwise seen from the west end
  const sec = rounded([
    [0, 0], [W, 0], [W + lean, hw], [W - tw + lean, hw], [W - tw, tb], [tw, tb], [tw - lean, hw], [-lean, hw],
  ], [ETZ * 0.9, ETZ * 0.9, tw * 0.48, tw * 0.48, ETZ * 0.5, ETZ * 0.5, tw * 0.48, tw * 0.48], fo);
  const nS = sec.length;
  const nX = [1, 3, 6, 8][d];
  const pos = [], idx = [];
  const wp = (x, y, zz) => pos.push(x * A, zz * A, -y * A);
  const xm = (x0 + x1) / 2, hl = (x1 - x0) / 2;
  const at = (x, sy, sz) => {
    const k = 1 - ((x - xm) / hl) ** 2;                        // 1 in the middle, 0 at the ends
    return [x, yS + sy + (sy > W / 2 ? 1 : -1) * 0.15 * ETZ * k * (sz / hw), z + sz - sag * k * (sz / hw)];
  };
  for (let i = 0; i <= nX; i++) {
    const x = x0 + ((x1 - x0) * i) / nX;
    for (const [sy, sz] of sec) wp(...at(x, sy, sz));
  }
  for (let i = 0; i < nX; i++) for (let j = 0; j < nS; j++) {
    const a = i * nS + j, b = i * nS + ((j + 1) % nS), c = (i + 1) * nS + ((j + 1) % nS), dd = (i + 1) * nS + j;
    idx.push(a, b, c, a, c, dd);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // orientation check: the floor's underside must face down (−Z = world −y); flip the winding if not
  const nrm = g.attributes.normal;
  let below = 0;
  for (let j = 0; j < nS; j++) if (sec[j][1] < 1e-6) below += nrm.getY(j);
  if (below > 0) {
    for (let k = 0; k < idx.length; k += 3) { const tmp = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = tmp; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  applyWorldUV(g);
  // the open ends: the U section capped flat
  const m = new Mesher();
  for (const [x, dir] of [[x0, -1], [x1, 1]]) m.poly(sec.map(([sy, sz]) => at(x, sy, sz)), [dir, 0, 0]);
  return { body: g, caps: m.geometry(), hw, tw, lean };
}

/** a round, tapering, closed tube along a smooth curve through site points (r0 → r1 amot) → WORLD geometry (indexed) */
function taperTube(pts, r0, r1, seg, radial) {
  const curve = new CatmullRomCurve3(pts.map((p) => new Vector3(p[0] * AMAH, p[2] * AMAH, -p[1] * AMAH)), false, 'centripetal');
  const fr = curve.computeFrenetFrames(seg, false);
  const pos = [], idx = [];
  const P = new Vector3(), Q = new Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    curve.getPointAt(t, P);
    const r = (r0 + (r1 - r0) * t ** 1.3) * AMAH;
    for (let j = 0; j < radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      Q.copy(fr.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(fr.binormals[i], Math.sin(a));
      pos.push(P.x + Q.x * r, P.y + Q.y * r, P.z + Q.z * r);
    }
  }
  const tipC = pos.length / 3;
  curve.getPointAt(1, P); Q.copy(curve.getTangentAt(1)).multiplyScalar(r1 * AMAH);
  pos.push(P.x + Q.x, P.y + Q.y, P.z + Q.z);
  const baseC = pos.length / 3;
  curve.getPointAt(0, P);
  pos.push(P.x, P.y, P.z);
  for (let i = 0; i < seg; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + ((j + 1) % radial), c = (i + 1) * radial + ((j + 1) % radial), e = (i + 1) * radial + j;
    idx.push(a, b, c, a, c, e);
  }
  for (let j = 0; j < radial; j++) {
    idx.push(seg * radial + j, seg * radial + ((j + 1) % radial), tipC);
    idx.push(baseC, (j + 1) % radial, j);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // outward check (a ring vertex's normal points away from the curve)
  curve.getPointAt(0.5, P);
  const k = Math.round(seg / 2) * radial, n = g.attributes.normal;
  const ox = pos[k * 3] - P.x, oy = pos[k * 3 + 1] - P.y, oz = pos[k * 3 + 2] - P.z;
  if (ox * n.getX(k) + oy * n.getY(k) + oz * n.getZ(k) < 0) {
    for (let q = 0; q < idx.length; q += 3) { const tmp = idx[q + 1]; idx[q + 1] = idx[q + 2]; idx[q + 2] = tmp; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  applyWorldUV(g);
  return g;
}

/** a kaneh: half a hollow gold reed (Menachot 11:6; Rambam BhB 3:14 "כחצי קנה חלול"), lying N–S, open side down */
function halfReed(m, xc, y0, y1, zb, r, n) {
  const ri = r * 0.72;
  const P = (rad, a, y) => [xc + rad * Math.cos(a), y, zb + rad * Math.sin(a)];
  // a smooth triangle wound to face along its (mean) vertex normal
  const tri = (a, b, c, na, nb, nc) => {
    const g = cross3(sub3(b, a), sub3(c, a)), h = add3(add3(na, nb), nc);
    if (g[0] * h[0] + g[1] * h[1] + g[2] * h[2] < 0) m.triN(a, c, b, na, nc, nb); else m.triN(a, b, c, na, nb, nc);
  };
  for (let k = 0; k < n; k++) {
    const a0 = (Math.PI * k) / n, a1 = (Math.PI * (k + 1)) / n;
    const n0 = [Math.cos(a0), 0, Math.sin(a0)], n1 = [Math.cos(a1), 0, Math.sin(a1)];
    // outer surface (normals out), inner surface (normals in)
    tri(P(r, a0, y0), P(r, a1, y0), P(r, a1, y1), n0, n1, n1); tri(P(r, a0, y0), P(r, a1, y1), P(r, a0, y1), n0, n1, n0);
    const i0 = scl3(n0, -1), i1 = scl3(n1, -1);
    tri(P(ri, a0, y0), P(ri, a1, y1), P(ri, a1, y0), i0, i1, i1); tri(P(ri, a0, y0), P(ri, a0, y1), P(ri, a1, y1), i0, i0, i1);
    // the two ends (half annuli)
    for (const [y, s] of [[y0, -1], [y1, 1]]) m.quadH(P(ri, a0, y), P(r, a0, y), P(r, a1, y), P(ri, a1, y), [0, s, 0]);
  }
  // the two long edges, resting on the loaf's walls
  for (const a of [0, Math.PI]) m.quadH(P(ri, a, y0), P(r, a, y0), P(r, a, y1), P(ri, a, y1), [0, 0, -1]);
}

/**
 * The Shulchan with its twelve loaves in two stacks of six, the 28 kanim, 4 snifin, 2 bazichin of levonah.
 * The bread, the kanim between the loaves and the two bazichin with their levonah are one movable (world-4),
 * 'heichal.shulchan.bread', for the Shabbat exchange (Menachot 11:7: "four kohanim enter, two with the two stacks in
 * their hands and two with the two bazichin … the incoming stand in the north and the outgoing in the south; these
 * draw and those set down, the handbreadth of this one beside the handbreadth of that"):
 *   userData.slide(f, south = true): 0 = on the table … 1 = drawn its full width (plus the horns) off the table to the
 *     south (south false: to the north — the new bread is set on from the north); open(f) = slide(f) in the last
 *     direction (south by default), and
 *     openGroup('south' | 'north', f) for sim.door(id).setGroup; openAmount / amount = f;
 *   show(bool) hides it (the bread in the kohanim's hands as props); kanim(bool) shows or hides the reeds in the stacks
 *     (pulled out on Friday and laid along the table — Menachot 11:6 — the laid-out reeds are not drawn). Defaults: 0, on
 *     the table, shown, kanim in. The snifin stay with the table.
 * 'heichal.shulchan.bread.incoming' (world-4-fix) is a second set with the same userData, sharing the geometry: the new
 *   bread, so the table is never bare. Defaults: slide(1, false) (off the table to the north), hidden, kanim out. The
 *   exchange: incoming.show(true); for f 0 → 1, bread.slide(f, true) and incoming.slide(1 − f, false) (always D apart,
 *   handbreadth beside handbreadth); then bread.show(false) once the old is in the kohanim's hands. At the end the two
 *   are identical, so the sim may swap back: bread.slide(0) + show(true) + kanim(false), incoming.show(false) and
 *   slide(1, false).
 */
export function buildShulchan(H) {
  const { kit, el, d } = H;
  const e = el('heichal.shulchan');
  const b = e.box;
  // the movable's parts (world geometry): bread, the reeds, the bowls and their resin
  const breadGeos = [], bowlGeos = [], resinGeos = [];
  const km = new Mesher();
  // gold over acacia (Shemot 25:24; the Shulchan "is wood", Chagigah 26b; Part V §13 table): the plated sheet
  const top = goldTable(H, b, 'gold_plate');
  // the loaves (Menachot 11:4–5 / 96a; locks #31–#32): 10 × 5 tefachim, laid across the 5-tefach width and folded up
  // 2½ on each side (R' Yehudah) — a "breached box" (R' Chanina) with 7-etzba horns at the walls' ends
  const breadKey = kit.mat('bread', null) || kit.variant('bread', 'plaster', { color: '#efcc98', roughness: 1 });
  const gm = kit.m('gold_vessel', false, true);
  const nStacks = 2, perStack = e.params.loaves / nStacks;
  const Lx = (b.max[0] - b.min[0]) / nStacks;          // each stack 5 tefachim along the table (E–W)
  const yN = b.max[1], yS = b.min[1];
  const rK = ETZ;                                      // the half-reeds: 2 etzba'ot across ⚙
  const kanim = [0, 3, 3, 3, 3, 2];                    // under loaf i (Menachot 97a; Rambam BhB 3:15): 0-3-3-3-3-2
  const R = rng(4242);
  const stackTops = [];
  for (let s = 0; s < nStacks; s++) {
    const sx0 = b.min[0] + s * Lx + 0.012, sx1 = sx0 + Lx - 0.024;
    let z = top;
    let wallTop = top, inner = top;
    for (let i = 0; i < perStack; i++) {
      // hand-made: each loaf a touch off square and off line (≤ 2 %, ≤ ½ etzba)
      const jx = (R() - 0.5) * 0.5 * ETZ, sc = 1 + (R() - 0.5) * 0.03;
      const lx0 = (sx0 + sx1) / 2 - ((sx1 - sx0) / 2) * sc + jx, lx1 = (sx0 + sx1) / 2 + ((sx1 - sx0) / 2) * sc + jx;
      const jy = (R() - 0.5) * 0.4 * ETZ;
      if (i > 0) {
        // the kanim under this loaf, resting on the walls of the loaf below, N–S
        const n = kanim[i];
        for (let k = 0; k < n; k++) {
          const kx = sx0 + ((k + 1) * (sx1 - sx0)) / (n + 1);
          if (d >= 1) halfReed(km, kx, yS - 0.05, yN + 0.05, wallTop, rK, [3, 4, 6, 8][d]);
          else km.box([kx - rK, yS - 0.05, wallTop], [kx + rK, yN + 0.05, wallTop + rK]);
        }
        z = wallTop + rK;
      }
      const L = loafGeometry(lx0, lx1, yS + jy, yN + jy, z, d, R);
      breadGeos.push(L.body, L.caps);
      // the horns: four, at the walls' ends — the dough drawn up from the wall's end and curled outward, 7 etzba'ot
      // long, thick at the root and tapering (the loaf above rests on the kanim between them)
      for (const hx of [lx0 + L.tw * 0.9, lx1 - L.tw * 0.9]) for (const [hy, ey] of [[yS + jy - L.lean + L.tw * 0.45, -1], [yN + jy + L.lean - L.tw * 0.45, 1]]) {
        const zt = z + L.hw - 0.8 * ETZ;
        const pts = [[0, 0], [0.9, 1.9], [2.2, 3.6], [3.6, 4.4], [4.8, 4.5]].map(([o, u]) => [hx, hy + ey * o * ETZ, zt + u * ETZ]);
        breadGeos.push(taperTube(pts, 1.15 * ETZ, 0.18 * ETZ, [3, 8, 12, 14][d], [4, 6, 8, 10][d]));
      }
      wallTop = z + L.hw;
      inner = z + L.tw;
    }
    stackTops.push({ x: (sx0 + sx1) / 2, z: wallTop, floor: inner });
    // two snifin per stack, on the floor at its north and south side, rising to the stack's head and forked there to
    // hold it (Rambam BhB 3:13)
    for (const y of [yN + 0.08, yS - 0.08]) {
      const sx = (sx0 + sx1) / 2, r = 0.03;
      const zt = wallTop + 0.04;
      if (d >= 1) kit.geo(tube([sx, y, b.min[2]], [sx, y, zt], r, [6, 6, 10, 12][d], true), 'gold_vessel', { collide: false, castShadow: true });
      else gm.box([sx - r, y - r, b.min[2]], [sx + r, y + r, zt]);
      for (const fx of [-1, 1]) gm.beam([sx, y, zt - 0.02], [sx + fx * 0.07, y, zt + 0.12], 0.035, 0.035);
    }
  }
  // the two bazichin of levonah, one ON each stack — "put pure frankincense on each stack" (Vayikra 24:7), the
  // Rabbis' answer to Abba Shaul (Menachot 96a): R' Yehudah's table leaves no gap between the stacks ⚙ — set in the
  // top loaf's trough, the heaped resin rising above its walls
  const resinKey = kit.mat('frankincense', null) || kit.variant('frankincense', 'plaster', { color: '#f7efd8', roughness: 0.6 });
  for (const st of stackTops) {
    const r = 0.11, yc = (yN + yS) / 2;
    const z0 = st.floor;
    bowlGeos.push(lathe([[0, 0], [r * 0.45, 0], [r * 0.5, 0.02], [r, 0.09], [r * 1.05, 0.11], [r * 0.95, 0.11], [r * 0.85, 0.07], [0, 0.07]], [st.x, yc, z0], [8, 12, 16, 20][d]));
    // a heaped handful of resin tears (a fistful each — kemitzah)
    resinGeos.push(lathe([[0, 0], [0.085, 0], [0.08, 0.05], [0.06, 0.1], [0.035, 0.14], [0, 0.155]], [st.x, yc, z0 + 0.07], [6, 8, 12, 14][d]));
  }
  shulchanBread(H, { breadGeos, breadKey, reeds: km.count ? km.geometry() : null, bowlGeos, resinGeos, resinKey, depth: yN - yS });
  return { top, stackTops };
}

/** the movables 'heichal.shulchan.bread' and 'heichal.shulchan.bread.incoming' (see buildShulchan) */
function shulchanBread(H, { breadGeos, breadKey, reeds, bowlGeos, resinGeos, resinKey, depth }) {
  const { kit } = H;
  const clean = (g) => {
    let q = g.index ? g.toNonIndexed() : g;
    if (!q.attributes.normal) q.computeVertexNormals();
    if (!q.attributes.uv) applyWorldUV(q);
    for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k);
    return q;
  };
  const group = new Group();
  group.name = 'heichal.shulchan.bread';
  const part = (geos, key, name, cast = true) => {
    const list = geos.filter(Boolean).map(clean);
    if (!list.length) return null;
    const mesh = new Mesh(mergeGeometries(list, false), kit.material(key));
    mesh.name = `heichal.shulchan.bread:${name}`;
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  part(breadGeos, breadKey, 'loaves');
  part([reeds], 'gold_vessel', 'kanim');
  part(bowlGeos, 'gold_vessel', 'bazichin');
  part(resinGeos, resinKey, 'levonah', false);
  // the slide: the stacks' own N–S depth plus the horns (≈ 5 etzba'ot each side), so at 1 nothing is over the table.
  // The outgoing at slide(f, true) and the incoming at slide(1 − f, false) stay exactly D apart, horn tip by horn tip:
  // "the handbreadth of this one beside the handbreadth of that" (Menachot 11:7)
  const D = (depth + 0.45) * AMAH;
  // the incoming set: a copy sharing the geometry and materials (no memory; draw calls only while shown), hidden off
  // the table to the north, its kanim out — it is set down on Shabbat, and the kanim go back in after it (Menachot
  // 11:6) (world-4-fix). Cloned before either gets its userData (clone() would copy it through JSON).
  const incoming = group.clone();
  breadMovable(H, group, 'heichal.shulchan.bread', D, { f: 0, south: true, shown: true, kanim: true });
  breadMovable(H, incoming, 'heichal.shulchan.bread.incoming', D, { f: 1, south: false, shown: false, kanim: false });
}

/** register one bread set as a movable (userData: slide / open / openGroup / show / kanim; see buildShulchan) */
function breadMovable(H, group, id, D, init) {
  group.name = id;
  for (const m of group.children) m.name = `${id}:${m.name.split(':').pop()}`;
  const reedMesh = group.children.find((m) => m.name === `${id}:kanim`) || null;
  const ud = {
    kind: 'bread', id, f: 0, south: true, shown: true, kanimIn: true,
    get amount() { return ud.f; },
    get openAmount() { return ud.f; },
    slide(f, south = true) {
      const v = Math.min(1, Math.max(0, +f || 0));
      ud.f = v;
      ud.south = south !== false;
      group.position.set(0, 0, (ud.south ? 1 : -1) * v * D);       // site −Y (south) = world +z
      group.updateMatrixWorld(true);
      return v;
    },
    open(f) { return ud.slide(f, ud.south); },
    openGroup(g, f) { return ud.slide(f, g !== 'north'); },
    show(v) { ud.shown = v !== false; group.visible = ud.shown; return ud.shown; },
    kanim(v) { ud.kanimIn = v !== false; if (reedMesh) reedMesh.visible = ud.kanimIn; return ud.kanimIn; },
  };
  group.userData = ud;
  ud.slide(init.f, init.south);
  ud.show(init.shown);
  ud.kanim(init.kanim);
  H.kit.add(group);
  H.ctx.movables.set(id, group);
}

/** the golden altar: 1 × 1 × 2 with a zer round its top and four horns (Shemot 30:1–5) */
export function buildGoldenAltar(H) {
  const { kit, el, d } = H;
  const b = el('heichal.mizbach-hazahav').box;
  // gold over acacia (Shemot 30:3; "the altars … because they are plated", Chagigah 27a): the plated sheet
  const m = kit.m('gold_plate', true, true);
  const v = kit.m('gold_vessel', false, true);
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  const hornH = TF, top = z1 - hornH;
  // plinth moulding, body, the zer just under the top, the top plate ("its roof"), horns at the corners
  m.box([x0 - 0.03, y0 - 0.03, z0], [x1 + 0.03, y1 + 0.03, z0 + 0.08]);
  m.box([x0, y0, z0 + 0.08], [x1, y1, top]);
  const zz = top - 0.14;
  v.box([x0 - 0.05, y0 - 0.05, zz], [x1 + 0.05, y1 + 0.05, zz + 0.07]);
  if (d >= 1) v.box([x0 - 0.03, y0 - 0.03, zz + 0.07], [x1 + 0.03, y1 + 0.03, zz + 0.1]);
  const hw = 0.13;
  for (const [hx, hy] of [[x0, y0], [x1 - hw, y0], [x0, y1 - hw], [x1 - hw, y1 - hw]]) {
    if (d >= 1) kit.geo(lathe([[0, 0], [hw * 0.55, 0], [hw * 0.5, hornH * 0.6], [hw * 0.22, hornH], [0, hornH]], [hx + hw / 2, hy + hw / 2, top], [6, 8, 10, 12][d]), 'gold_vessel', { collide: false });
    else v.box([hx, hy, top], [hx + hw, hy + hw, top + hornH]);
  }
  return { top: [(x0 + x1) / 2, (y0 + y1) / 2, top] };
}

/** the Ulam's two showbread tables: marble for the incoming bread, gold for the outgoing (Shekalim 6:4) */
export function buildUlamTables(H) {
  const { kit, el, d } = H;
  const p = el('heichal.ulam.tables').params;
  goldTable(H, p.gold, 'gold_vessel');
  // the marble table: a monolithic slab top with a moulded edge on two slab supports (trapezophora) ⚙
  const b = p.marble, m = kit.m('marble_white', true, true);
  const [x0, y0, z0] = b.min, [x1, y1, z1] = b.max;
  m.box([x0, y0, z1 - 0.2], [x1, y1, z1]);
  if (d >= 1) m.box([x0 + 0.04, y0 + 0.04, z1 - 0.26], [x1 - 0.04, y1 - 0.04, z1 - 0.2]);
  for (const sx of [x0 + 0.2, x1 - 0.42]) {
    m.box([sx, y0 + 0.12, z0], [sx + 0.22, y1 - 0.12, z1 - 0.26]);
    if (d >= 1) m.box([sx - 0.04, y0 + 0.08, z0], [sx + 0.26, y1 - 0.08, z0 + 0.1]);
  }
}

export { B };

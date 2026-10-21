// Reusable architectural parts for the courts: chamber shells, straight flights, newel stairs, round logs, lamps.
import { gridSolid, B, lathe, latheLocal } from './geo.js';
import { CylinderGeometry, CircleGeometry, TorusGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { masonryLayout } from '../../materials/gen/layout.js';
import { classify, WALL } from '../masonry.js';
import { placeAt, mergeGeometries, boxAt, finishLocal } from './kit.js';
import { AMAH, m2w } from '../../../core/units.js';

/**
 * Hollow chamber: outer box minus interior (walls t, roof roofT, open floor unless floorT), minus doors/windows/holes.
 * o: { t, roofT, floorT, room, ceil, floor, top, side, doors: [box(+mat)], holes: [box], collide }
 */
export function shell(C, box, o = {}) {
  const t = o.t ?? 1, roofT = o.roofT ?? t, floorT = o.floorT ?? 0;
  const inner = B(box.min[0] + (o.tx0 ?? t), box.min[1] + (o.ty0 ?? t), box.min[2] + floorT, box.max[0] - (o.tx1 ?? t), box.max[1] - (o.ty1 ?? t),
    o.noRoof ? box.max[2] + 1 : box.max[2] - roofT, { room: o.room || 'ashlar_plain', ceil: o.ceil || o.room || 'ashlar_plain', floor: o.floor || 'paving_azarah' });
  const adds = [{ ...box, top: o.top || 'roof_plaster', side: o.side, under: 'ashlar_plain' }];
  const subs = [inner, ...(o.doors || []).map((d) => ({ mat: o.reveal || 'ashlar_plain', ...d })), ...(o.holes || [])];
  C.kit.solid(gridSolid(adds, subs, classify), o.collide ?? true, true);
  return inner;
}

/** a door box through a shell wall. face: 'x-'|'x+'|'y-'|'y+' of box; c: centre along the wall; w, h; z0 */
export function doorBox(box, face, c, w, h, t, z0 = box.min[2], extra = {}) {
  const e = 0.01;
  if (face[0] === 'x') {
    const x = face[1] === '-' ? box.min[0] : box.max[0];
    return B(face[1] === '-' ? x - e : x - t - e, c - w / 2, z0 - e, face[1] === '-' ? x + t + e : x + e, c + w / 2, z0 + h, extra);
  }
  const y = face[1] === '-' ? box.min[1] : box.max[1];
  return B(c - w / 2, face[1] === '-' ? y - e : y - t - e, z0 - e, c + w / 2, face[1] === '-' ? y + t + e : y + e, z0 + h, extra);
}

/**
 * Straight flight of `steps` risers between a wall face (head, top zTop) and the foot (z = zTop − steps·rise).
 *  axis 'x'|'y': run direction; head: coordinate of the wall face; dir: ±1 = direction of DESCENT along the axis;
 *  c0, c1: cross extent; cheek: thickness of the cheek walls inside the width (0 = none), their coping cheekH above
 *  the nosings — a continuous sloped coping at the stair's pitch with short level caps at the head and the foot
 *  underpass: { fromHead: [s0, s1], springZ } (site.js flight params.underpass) — the flight carried on a semicircular
 *  barrel vault spanning s0..s1, its axis across the flight, so a walkway passes under it at the foot's level ⚙
 */
export function flight(C, { axis, head, dir, c0, c1, steps, rise = 0.5, tread = 0.5, zTop, cheek = 0.75, cheekH = 2, base = null, collide = true, mat = 'steps_stone', sideMat = WALL, underpass = null }) {
  const adds = [];
  const zFoot = base ?? zTop - steps * rise;
  const P = (s0, s1, a, b, z0, z1, tags) => (axis === 'y'
    ? B(a, head + dir * s0, z0, b, head + dir * s1, z1, tags) : B(head + dir * s0, a, z0, head + dir * s1, b, z1, tags));
  const t0 = cheek > 0 ? c0 + cheek : c0, t1 = cheek > 0 ? c1 - cheek : c1;
  for (let j = 1; j <= steps; j++) adds.push(P(0, (steps - j + 1) * tread, t0, t1, zFoot, zFoot + j * rise, { step: true }));
  const ai = axis === 'y' ? 1 : 0;
  // the vault: a box void up to the crown under the treads, its upper corners filled back by two spandrels whose
  // undersides are the arch; the cheeks take the same arch as a notch in their profile
  const subs = [];
  let vault = null;
  if (underpass) {
    const [s0, s1] = underpass.fromHead, zs = underpass.springZ, R = (s1 - s0) / 2, sm = (s0 + s1) / 2;
    const nA = [8, 12, 16, 24][C.d] ?? 12;
    const arcPts = [];
    for (let i = 0; i <= nA; i++) { const th = Math.PI * (1 - i / nA); arcPts.push([sm + R * Math.cos(th), zs + R * Math.sin(th)]); }
    vault = { s0, s1, zs, zc: zs + R, arcPts, half: nA / 2 };
    subs.push(P(s0, s1, t0 - 0.01, t1 + 0.01, zFoot - 0.01, vault.zc, { vault: true }));
  }
  const map = gridSolid(adds, subs, (f) => {
    if (f.sub) return 'ashlar_plain';         // the vault's walls
    if (f.axis === 2) return f.dir > 0 ? mat : 'ashlar_plain';
    if (f.axis === ai) return mat;           // risers
    return sideMat;
  });
  C.kit.solid(map, collide, true);
  const ms = C.kit.m('ashlar_plain', collide, true);
  if (vault) {
    const { s0, s1, zc, arcPts, half } = vault;
    // spandrels over the void's corners (profiles counter-clockwise in s → right, z ↑): their arcs are the intrados
    prism(ms, axis, head, dir, t0, t1, [...arcPts.slice(0, half + 1), [s0, zc]]);
    prism(ms, axis, head, dir, t0, t1, [...arcPts.slice(half), [s1, zc]]);
  }
  if (cheek > 0) {
    // the coping runs cheekH above the nosing line (z = zFoot + (steps + 1 − s/tread)·rise), level for capT at the head
    // and capB at the foot ⚙
    const L = steps * tread, k = rise / tread, capT = 0.75, capB = 0.5;
    const zHigh = zTop + cheekH, zLow = zHigh - (L - capT - capB) * k;
    const cop = [[0, zHigh], [capT, zHigh], [L - capB, zLow], [L, zLow]];
    const copAt = (s) => { for (let i = 1; i < cop.length; i++) if (s <= cop[i][0]) { const [a, za] = cop[i - 1], [b, zb] = cop[i]; return za + (zb - za) * ((s - a) / (b - a)); } return zLow; };
    // a piece of the cheek over [a, b]: its underside `under` (points from a to b), its coping above, counter-clockwise
    const piece = (under, a, b) => [...under, [b, copAt(b)], ...cop.filter(([s]) => s > a + 1e-9 && s < b - 1e-9).reverse(), [a, copAt(a)]];
    // with a vault the cheek is three prisms (pier, over the arch, foot): a cap triangle spanning the whole profile
    // would reach from the ground across the passage, and the nav bounds a wall triangle by its full height
    const pieces = vault
      ? [piece([[0, zFoot], [vault.s0, zFoot]], 0, vault.s0), piece(vault.arcPts, vault.s0, vault.s1), piece([[vault.s1, zFoot], [L, zFoot]], vault.s1, L)]
      : [piece([[0, zFoot], [L, zFoot]], 0, L)];
    for (const [a, b] of [[c0, c0 + cheek], [c1 - cheek, c1]]) for (const prof of pieces) prism(ms, axis, head, dir, a, b, prof);
  }
}

/** A prism: profile [[s, z], …] (counter-clockwise in s → right, z ↑; s = distance from `head` along dir) extruded across [ca, cb]. */
export function prism(m, axis, head, dir, ca, cb, prof) {
  const P = (s, c, z) => (axis === 'y' ? [c, head + dir * s, z] : [head + dir * s, c, z]);
  const cross = axis === 'y' ? [1, 0, 0] : [0, 1, 0];
  const sv = axis === 'y' ? [0, dir, 0] : [dir, 0, 0];
  m.poly(prof.map(([s, z]) => P(s, ca, z)), cross.map((v) => -v));
  m.poly(prof.map(([s, z]) => P(s, cb, z)), cross);
  for (let i = 0; i < prof.length; i++) {
    const [s0, z0] = prof[i], [s1, z1] = prof[(i + 1) % prof.length];
    // outward normal of a counter-clockwise edge (ds, dz): (dz, −ds)
    const ns = z1 - z0, nz = -(s1 - s0);
    m.quadH(P(s0, ca, z0), P(s1, ca, z1), P(s1, cb, z1), P(s0, cb, z0), [sv[0] * ns, sv[1] * ns, nz]);
  }
}

/**
 * Newel (winding) stair: solid stone steps round a stout newel, each step's underside a helical soffit `soffit` below
 * its nosing line (a stone newel stair, not a corkscrew of thin wedges).
 *   c: [X, Y]; r0 newel radius; r1 outer radius; z0 → z1; rise; perTurn steps per turn; a0 start angle (rad, 0 = +X);
 *   cw: clockwise ascent when true. landing: the top step widened to this many steps' angle (a landing toward a
 *   door), in landingMat, with a parapet on its open edge.
 *   topRect [x0, y0, x1, y1]: the well's opening at the head (the hole cut in the floor the stair arrives on). The top
 *   step's outer edge is carried out to it (never drawn in), so no crack (r1 stops 0.05 short of the shaft) and no
 *   corner wedge stays open between the last tread and the floor.
 */
/** distance from c along angle a to the edge of the rectangle R = [x0, y0, x1, y1] (c inside R) */
function rayRect(c, a, R) {
  const dx = Math.cos(a), dy = Math.sin(a);
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (R[2] - c[0]) / dx); else if (dx < -1e-9) t = Math.min(t, (R[0] - c[0]) / dx);
  if (dy > 1e-9) t = Math.min(t, (R[3] - c[1]) / dy); else if (dy < -1e-9) t = Math.min(t, (R[1] - c[1]) / dy);
  return t;
}
export function spiral(C, { c, r0 = 0.5, r1, z0, z1, rise = 0.5, perTurn = 14, a0 = 0, cw = false, mat = 'steps_stone', newelMat = 'ashlar_plain', soffit = 0.5, landing = 1, landingMat = null, topRect = null }) {
  const n = Math.round((z1 - z0) / rise);
  const da = (2 * Math.PI / perTurn) * (cw ? -1 : 1);
  const segs = C.d >= 2 ? 4 : 2;
  const TAU = 2 * Math.PI;
  for (let k = 0; k < n; k++) {
    const top = k === n - 1, wide = top && landing > 1;
    const m = C.kit.m(wide && landingMat ? landingMat : mat, true, true);
    const zt = z0 + (k + 1) * rise;
    const aS = a0 + k * da, aE = aS + da * (wide ? landing : 1);
    const ns = wide ? Math.max(segs, Math.ceil(segs * landing)) : segs;
    // sample angles; a top step carried out to a rectangular well edge also takes the rectangle's corners
    const angs = [];
    for (let i = 0; i <= ns; i++) angs.push(aS + (aE - aS) * (i / ns));
    const reach = top && topRect;
    if (reach) {
      const lo = Math.min(aS, aE), hi = Math.max(aS, aE), R = topRect;
      for (const [x, y] of [[R[0], R[1]], [R[2], R[1]], [R[2], R[3]], [R[0], R[3]]]) {
        let a = Math.atan2(y - c[1], x - c[0]);
        a += Math.ceil((lo - a) / TAU) * TAU;
        if (a > lo + 1e-6 && a < hi - 1e-6) angs.push(a);
      }
      angs.sort((p, q) => (aE > aS ? p - q : q - p));
    }
    const rOut = (a) => (reach ? Math.max(r1, rayRect(c, a, topRect)) : r1);
    // underside: from (zt − rise − soffit) under the riser to (zt − soffit) under the back edge; the landing thins toward
    // its far end, where the turn below has climbed under it (head room for a 1.75 m walker)
    const zbS = Math.max(z0, zt - rise - soffit), zbE = wide ? zt - 0.25 : Math.max(z0, zt - soffit);
    const zb = (i) => zbS + (zbE - zbS) * ((angs[i] - aS) / (aE - aS));
    const outer = angs.map((a) => [c[0] + Math.cos(a) * rOut(a), c[1] + Math.sin(a) * rOut(a)]);
    const inner = angs.map((a) => [c[0] + Math.cos(a) * r0, c[1] + Math.sin(a) * r0]);
    for (let i = 0; i + 1 < angs.length; i++) {
      const o0 = outer[i], o1 = outer[i + 1], i0 = inner[i], i1 = inner[i + 1];
      m.quadH([i0[0], i0[1], zt], [o0[0], o0[1], zt], [o1[0], o1[1], zt], [i1[0], i1[1], zt], [0, 0, 1]);
      m.quadH([i0[0], i0[1], zb(i)], [o0[0], o0[1], zb(i)], [o1[0], o1[1], zb(i + 1)], [i1[0], i1[1], zb(i + 1)], [0, 0, -1]);
      const mo = [(o0[0] + o1[0]) / 2 - c[0], (o0[1] + o1[1]) / 2 - c[1], 0];
      m.quadH([o0[0], o0[1], zb(i)], [o1[0], o1[1], zb(i + 1)], [o1[0], o1[1], zt], [o0[0], o0[1], zt], mo);
    }
    // the riser: only its exposed band above the step below (the rest is the shared joint with that step)
    const fS = [Math.cos(aS), Math.sin(aS)], fE = [Math.cos(aE), Math.sin(aE)];
    const tS = cw ? [fS[1], -fS[0], 0] : [-fS[1], fS[0], 0];   // ascent tangent at aS
    const zr0 = k === 0 ? zbS : zt - rise;
    m.quadH([c[0] + fS[0] * r0, c[1] + fS[1] * r0, zr0], [c[0] + fS[0] * r1, c[1] + fS[1] * r1, zr0], [c[0] + fS[0] * r1, c[1] + fS[1] * r1, zt], [c[0] + fS[0] * r0, c[1] + fS[1] * r0, zt], [-tS[0], -tS[1], 0]);
    // a top step carried out past r1: its riser beyond the step below runs down to its own underside
    const rS = rOut(aS);
    if (rS > r1 + 1e-6) m.quadH([c[0] + fS[0] * r1, c[1] + fS[1] * r1, zbS], [c[0] + fS[0] * rS, c[1] + fS[1] * rS, zbS], [c[0] + fS[0] * rS, c[1] + fS[1] * rS, zt], [c[0] + fS[0] * r1, c[1] + fS[1] * r1, zt], [-tS[0], -tS[1], 0]);
    if (top) {
      const tE = cw ? [fE[1], -fE[0], 0] : [-fE[1], fE[0], 0];
      const rE = rOut(aE);
      m.quadH([c[0] + fE[0] * r0, c[1] + fE[1] * r0, zbE], [c[0] + fE[0] * rE, c[1] + fE[1] * rE, zbE], [c[0] + fE[0] * rE, c[1] + fE[1] * rE, zt], [c[0] + fE[0] * r0, c[1] + fE[1] * r0, zt], tE);
      if (wide) {
        // a parapet on the landing's open edge (the shaft falls away beyond it)
        C.kit.m('ashlar_plain', true, true).beam([c[0] + fE[0] * (r0 + 0.05), c[1] + fE[1] * (r0 + 0.05), zt + 1], [c[0] + fE[0] * rE, c[1] + fE[1] * rE, zt + 1], 0.25, 2);
      }
    }
  }
  // the newel: a drum of the steps' own stone, a little proud of their inner ends
  C.kit.geo(lathe([[0, 0], [r0, 0], [r0, z1 - z0 + 1], [0, z1 - z0 + 1]], [c[0], c[1], z0], C.d >= 2 ? 20 : 12), newelMat, { collide: true });
  return { steps: n, endAngle: a0 + n * da };
}

// ------------------------------------------------------------------------------------------------- logs
// Round logs (fig, walnut, pine — Tamid 2:3) as one instanced set: bark sides (timber_rough) and sawn ends whose UVs
// sit on one log end of the timber_pile_end texture, so each end shows its rings and bark rim ⚙
const LOG_NOM = { len: 1.2 * 1.8, r: 0.075 * 1.8 };   // the unit log's nominal size (m) × 1.8: bark plates of a few cm on 15-cm logs
let LOG_END_UV = null;
// the material generator's integer PCG hash (materials gen/glsl.js), to find where it draws each log end
const pcg = (v) => {
  const s = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0;
  const w = Math.imul(((s >>> ((s >>> 28) + 4)) ^ s) >>> 0, 277803737) >>> 0;
  return ((w >>> 22) ^ w) >>> 0;
};
const h3 = (x, y, seed) => {
  const a = pcg((x + pcg((y ^ Math.imul(seed, 2654435761)) >>> 0)) >>> 0), b = pcg(a);
  return [a * 2.3283064e-10, b * 2.3283064e-10, pcg(b) * 2.3283064e-10];
};
/** two whole (unsplit) log ends of the timber_pile_end tile (materials sets.js 'logend'): [{ c: [u, v], r }] */
function logEndUV() {
  if (LOG_END_UV) return LOG_END_UV;
  const ends = [];
  try {
    const seed = 143, rowH = 0.16, W = 0.96;
    const L = masonryLayout({ W, H: 0.96, seed, rowH, q: 0.04, minL: 0.16, maxL: 0.2, gap: 0.06 });
    L.list.forEach((s, row) => {
      for (let k = 0; k + 1 < s.length; k++) {
        const len = s[k + 1] - s[k];
        const bh = h3(row * 64 + k, 709, seed), bk = h3(row * 64 + k, 711, seed);
        if (bh[2] >= 0.72) continue;                                   // a split billet
        const R = Math.min(len, L.rowH) * 0.5 * (0.74 + 0.26 * bh[1]);
        const cx = len * 0.5 + (bk[0] - 0.5) * (len - 2 * R), cy = L.rowH * 0.5 + (bk[1] - 0.5) * (L.rowH - 2 * R);
        ends.push({ c: [s[k] + cx, row * L.rowH + cy], r: R * 0.97 });
      }
    });
    ends.sort((p, q) => q.r - p.r);
  } catch { /* fall back below */ }
  while (ends.length < 2) ends.push({ c: [0.48, 0.4], r: 0.06 });
  LOG_END_UV = ends.slice(0, 2);
  return LOG_END_UV;
}
/** unit log (LOCAL meters): axis +x from −0.5 to 0.5, radius 1 tapering to 0.93; groups: 0 bark, 1 the two ends */
export function logGeometry(seg = 9) {
  const side = new CylinderGeometry(0.93, 1, 1, seg, 1, true);
  const suv = side.attributes.uv;
  for (let i = 0; i < suv.count; i++) suv.setXY(i, suv.getY(i) * LOG_NOM.len, suv.getX(i) * 2 * Math.PI * LOG_NOM.r);
  side.rotateZ(-Math.PI / 2);
  const [e0, e1] = logEndUV();
  const cap = (x, r, face, { c: [uc, vc], r: ruv }) => {
    const g = new CircleGeometry(r, seg);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uc + (uv.getX(i) - 0.5) * 2 * ruv, vc + (uv.getY(i) - 0.5) * 2 * ruv);
    g.rotateY(face * Math.PI / 2);
    g.translate(x, 0, 0);
    return g;
  };
  const ends = mergeGeometries([cap(0.5, 0.93, 1, e0), cap(-0.5, 1, -1, e1)]);
  const g = mergeGeometries([side, ends], true);
  g.computeBoundingSphere();
  return g;
}
/** the firewood's bark, one species per log: fig, walnut and oil-tree (pine) — never olive or vine (Tamid 2:3) */
export const BARK_KEYS = ['timber_bark_fig', 'timber_bark_walnut', 'timber_bark_pine'];
/** register the log set of one bark species (0 fig, 1 walnut, 2 pine) once: an instanced set per species, the ends shared */
export function logSet(C, species = 1) {
  const sp = Math.max(0, Math.min(2, species | 0));
  return C.kit.set(`logs:${sp}`, () => logGeometry(C.d >= 2 ? 10 : 8), [C.kit.mat(BARK_KEYS[sp], 'timber_rough'), C.kit.mat('timber_pile_end', 'timber_rough')]);
}
/** a log's species from its place (stable: the same log keeps its bark whatever else is built) */
export function barkSpecies(X, Y, Z, heading = 0) {
  let k = (Math.round(X * 131) * 73856093) ^ (Math.round(Y * 131) * 19349663) ^ (Math.round(Z * 131 + heading) * 83492791);
  k = Math.imul(k ^ (k >>> 13), 0x5bd1e995);
  k ^= k >>> 15;
  return (k >>> 0) % 3;
}
const _q = new Quaternion(), _q2 = new Quaternion(), _s = new Vector3();
const UP = new Vector3(0, 1, 0), X_AX = new Vector3(1, 0, 0), Z_AX = new Vector3(0, 0, 1);
/** a log centred at site [X, Y, Z] (its axis), running toward compass heading `heading` (deg), tilted up by pitch (deg),
 *  length and radius in amot, rolled about its axis by roll (rad); species 0 fig, 1 walnut, 2 pine (default: from its place) */
export function logAt(C, [X, Y, Z], heading, len, r, { pitch = 0, roll = 0, species = null } = {}) {
  // detail 0 has only the sticks in the fire pits (the piles are boxes there): one species, two draw calls instead of six
  const sp = C.d >= 1 ? (species ?? barkSpecies(X, Y, Z, heading)) : 1;
  logSet(C, sp);
  const yaw = ((90 - heading) * Math.PI) / 180;
  _q.setFromAxisAngle(UP, yaw).multiply(_q2.setFromAxisAngle(Z_AX, (pitch * Math.PI) / 180)).multiply(new Quaternion().setFromAxisAngle(X_AX, roll));
  _s.set(len * AMAH, r * AMAH, r * AMAH);
  C.kit.inst(`logs:${Math.max(0, Math.min(2, sp | 0))}`, new Matrix4().compose(m2w(X, Y, Z), _q, _s));
}
/** a star fire: n logs pushed in from round the hearth, inner ends on the embers (zIn), outer ends on the kerb (zOut) */
export function starFire(C, [X, Y], zIn, zOut, rOut, n = 5, seed = 1, r = 0.16) {
  let s = seed * 9973;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < n; k++) {
    const h = (360 * k) / n + rnd() * 30, len = rOut - 0.05 + rnd() * 0.3, rr = r * (0.85 + rnd() * 0.3);
    const a = (h * Math.PI) / 180, mid = 0.1 + len / 2;
    const pitch = (Math.atan2(zOut - zIn, len) * 180) / Math.PI;    // outer end up on the kerb
    logAt(C, [X + Math.sin(a) * mid, Y + Math.cos(a) * mid, (zIn + zOut) / 2 + rr], h, len, rr, { pitch, roll: rnd() * 6.28 });
  }
}

// ------------------------------------------------------------------------------------------------- lamps
/** Herodian (knife-pared) oil lamp, LOCAL meters: round body, spatulate nozzle toward −z (the heading); base at y = 0. */
export function lampGeometry() {
  const A = AMAH;
  const body = latheLocal([[0, 0], [0.13, 0], [0.17, 0.05], [0.16, 0.1], [0.06, 0.12], [0.04, 0.1], [0, 0.1]], 14);
  const nozzle = boxAt(-0.045 * A, 0.02 * A, -0.3 * A, 0.045 * A, 0.1 * A, -0.1 * A);
  return finishLocal([body, nozzle]);
}
export const LAMP_TOP = 0.13;  // amot: wick height above the lamp's base

/** register the lamp instanced set (once) */
export function lampSet(C) {
  return C.kit.set('lamps', lampGeometry, C.kit.mat('terracotta', 'terrain_soil'), { cast: false });
}

/** a lamp at a site point (base), with its fire; returns the fire spec */
export function lamp(C, id, X, Y, Z, { heading = 0, schedule = 'always', intensity = 1, size = 0.08 } = {}) {
  lampSet(C);
  C.kit.inst('lamps', placeAt(X, Y, Z, heading));
  const r = 0.25;
  const hx = Math.sin(heading * Math.PI / 180) * r, hy = Math.cos(heading * Math.PI / 180) * r;
  return C.ctx.addFire({ id, kind: 'lamp', pos: [X + hx, Y + hy, Z + LAMP_TOP], size, intensity, schedule });
}

/** a stone lamp-stand (column with a dish) and its lamp */
export function lampStand(C, id, X, Y, Z, opts = {}) {
  const h = opts.h ?? 2.6;
  C.kit.geo(lathe([[0, 0], [0.45, 0], [0.45, 0.2], [0.28, 0.35], [0.2, 0.5], [0.17, h - 0.4], [0.24, h - 0.25], [0.42, h - 0.08], [0.42, h], [0, h]],
    [X, Y, Z], C.d >= 2 ? 14 : 8), opts.mat || 'ashlar_plain', { collide: true });
  return lamp(C, id, X, Y, Z + h, opts);
}

/** a small stone bracket on a wall face carrying a lamp. out: [ox, oy] unit outward normal of the wall */
export function wallLamp(C, id, X, Y, Z, out, opts = {}) {
  const m = C.kit.m('ashlar_plain', false, false);
  const d = 0.7;
  const x0 = Math.min(X, X + out[0] * d), x1 = Math.max(X, X + out[0] * d), y0 = Math.min(Y, Y + out[1] * d), y1 = Math.max(Y, Y + out[1] * d);
  const wx = out[0] === 0 ? 0.35 : 0, wy = out[1] === 0 ? 0.35 : 0;
  m.box([x0 - wx, y0 - wy, Z - 0.25], [x1 + wx, y1 + wy, Z]);
  m.box([Math.min(X, X + out[0] * 0.3) - wx * 0.6, Math.min(Y, Y + out[1] * 0.3) - wy * 0.6, Z - 0.6], [Math.max(X, X + out[0] * 0.3) + wx * 0.6, Math.max(Y, Y + out[1] * 0.3) + wy * 0.6, Z - 0.25]);
  const heading = (Math.atan2(out[0], out[1]) * 180) / Math.PI;
  return lamp(C, id, X + out[0] * d * 0.55, Y + out[1] * d * 0.55, Z, { heading, ...opts });
}

// ------------------------------------------------------------------------------------------- ring-slabs
// The three amah-square marble ring-slabs are one fitting (report Part IX §37.1: "model all three as identical
// fittings"; site.js keys-slab note): the keys slab of the Moked (Middot 1:9), the slab over the shit (Middot 3:3) and
// the sotah slab (Sotah 2:2). The ring is an iron drop-ring lying in a groove cut in the tablet, the top face of its
// hexagonal section a millimetre proud ("he put his garment on it and slept"), toward the edge the kohen kneels at ⚙
// (section, size, groove and place; the Mishnah gives only "a ring fixed in it"). Amot.
export const SLAB_RING = { r: 0.12, t: 0.025, inset: 0.27 };
/** the slabs' ring as WORLD geometry (meters, world UVs): centre (X, Y) in the site frame, on a tablet whose top is topZ */
export function slabRingGeometry(X, Y, topZ, d) {
  const g = new TorusGeometry(SLAB_RING.r * AMAH, SLAB_RING.t * AMAH, 6, d >= 2 ? 20 : 14).rotateX(Math.PI / 2);
  const p = m2w(X, Y, topZ + 0.002 - 0.866 * SLAB_RING.t);
  return finishLocal([g.translate(p.x, p.y, p.z)]);
}

/** wall niche lining (5 faces, inward) for a lamp in the passage: centre on the face, out normal, size w×h×depth */
export function nicheLining(m, X, Y, Z, out, w, h, depth) {
  const ix = -out[0], iy = -out[1];
  const ax = out[1] !== 0 ? 1 : 0, ay = out[0] !== 0 ? 1 : 0;
  const P = (a, b, dd) => [X + ax * a + ix * dd, Y + ay * a + iy * dd, Z + b];
  const hw = w / 2;
  m.quadH(P(-hw, 0, depth), P(hw, 0, depth), P(hw, h, depth), P(-hw, h, depth), [out[0], out[1], 0]);  // back
  m.quadH(P(-hw, 0, 0), P(hw, 0, 0), P(hw, 0, depth), P(-hw, 0, depth), [0, 0, 1]);                  // sill
  m.quadH(P(-hw, h, 0), P(hw, h, 0), P(hw, h, depth), P(-hw, h, depth), [0, 0, -1]);                 // head
  m.quadH(P(-hw, 0, 0), P(-hw, h, 0), P(-hw, h, depth), P(-hw, 0, depth), [ax, ay, 0]);              // sides
  m.quadH(P(hw, 0, 0), P(hw, h, 0), P(hw, h, depth), P(hw, 0, depth), [-ax, -ay, 0]);
}

export { mergeGeometries };

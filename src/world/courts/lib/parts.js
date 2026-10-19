// Reusable architectural parts for the courts: chamber shells, straight flights, newel stairs, round logs, lamps.
import { gridSolid, B, lathe, latheLocal, arc } from './geo.js';
import { CylinderGeometry, CircleGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { masonryLayout } from '../../materials/gen/layout.js';
import { classify } from '../masonry.js';
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
 */
export function flight(C, { axis, head, dir, c0, c1, steps, rise = 0.5, tread = 0.5, zTop, cheek = 0.75, cheekH = 2, base = null, collide = true, mat = 'steps_stone', sideMat = 'herodian_wall' }) {
  const adds = [];
  const zFoot = base ?? zTop - steps * rise;
  const P = (s0, s1, a, b, z0, z1, tags) => (axis === 'y'
    ? B(a, head + dir * s0, z0, b, head + dir * s1, z1, tags) : B(head + dir * s0, a, z0, head + dir * s1, b, z1, tags));
  const t0 = cheek > 0 ? c0 + cheek : c0, t1 = cheek > 0 ? c1 - cheek : c1;
  for (let j = 1; j <= steps; j++) adds.push(P(0, (steps - j + 1) * tread, t0, t1, zFoot, zFoot + j * rise, { step: true }));
  const ai = axis === 'y' ? 1 : 0;
  const map = gridSolid(adds, [], (f) => {
    if (f.axis === 2) return f.dir > 0 ? mat : 'ashlar_plain';
    if (f.axis === ai) return mat;           // risers
    return sideMat;
  });
  C.kit.solid(map, collide, true);
  if (cheek > 0) {
    // the coping runs cheekH above the nosing line (z = zFoot + (steps + 1 − s/tread)·rise), level for capT at the head
    // and capB at the foot ⚙
    const L = steps * tread, k = rise / tread, capT = 0.75, capB = 0.5;
    const zHigh = zTop + cheekH, zLow = zHigh - (L - capT - capB) * k;
    const prof = [[0, zFoot], [L, zFoot], [L, zLow], [L - capB, zLow], [capT, zHigh], [0, zHigh]];
    const m = C.kit.m('ashlar_plain', collide, true);
    for (const [a, b] of [[c0, c0 + cheek], [c1 - cheek, c1]]) prism(m, axis, head, dir, a, b, prof);
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
 */
export function spiral(C, { c, r0 = 0.5, r1, z0, z1, rise = 0.5, perTurn = 14, a0 = 0, cw = false, mat = 'steps_stone', newelMat = 'ashlar_plain', soffit = 0.5, landing = 1, landingMat = null }) {
  const n = Math.round((z1 - z0) / rise);
  const da = (2 * Math.PI / perTurn) * (cw ? -1 : 1);
  const segs = C.d >= 2 ? 4 : 2;
  for (let k = 0; k < n; k++) {
    const top = k === n - 1, wide = top && landing > 1;
    const m = C.kit.m(wide && landingMat ? landingMat : mat, true, true);
    const zt = z0 + (k + 1) * rise;
    const aS = a0 + k * da, aE = aS + da * (wide ? landing : 1);
    const ns = wide ? Math.max(segs, Math.ceil(segs * landing)) : segs;
    // underside: from (zt − rise − soffit) under the riser to (zt − soffit) under the back edge; the landing thins toward
    // its far end, where the turn below has climbed under it (head room for a 1.75 m walker)
    const zbS = Math.max(z0, zt - rise - soffit), zbE = wide ? zt - 0.25 : Math.max(z0, zt - soffit);
    const zb = (i) => zbS + (zbE - zbS) * (i / ns);
    const outer = arc(c[0], c[1], r1, aS, aE, ns), inner = arc(c[0], c[1], r0, aS, aE, ns);
    for (let i = 0; i < ns; i++) {
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
    if (top) {
      const tE = cw ? [fE[1], -fE[0], 0] : [-fE[1], fE[0], 0];
      m.quadH([c[0] + fE[0] * r0, c[1] + fE[1] * r0, zbE], [c[0] + fE[0] * r1, c[1] + fE[1] * r1, zbE], [c[0] + fE[0] * r1, c[1] + fE[1] * r1, zt], [c[0] + fE[0] * r0, c[1] + fE[1] * r0, zt], tE);
      if (wide) {
        // a parapet on the landing's open edge (the shaft falls away beyond it)
        C.kit.m('ashlar_plain', true, true).beam([c[0] + fE[0] * (r0 + 0.05), c[1] + fE[1] * (r0 + 0.05), zt + 1], [c[0] + fE[0] * r1, c[1] + fE[1] * r1, zt + 1], 0.25, 2);
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
/** register the log set (once) */
export function logSet(C) {
  return C.kit.set('logs', () => logGeometry(C.d >= 2 ? 10 : 8), ['timber_rough', C.kit.mat('timber_pile_end', 'timber_rough')]);
}
const _q = new Quaternion(), _q2 = new Quaternion(), _s = new Vector3();
const UP = new Vector3(0, 1, 0), X_AX = new Vector3(1, 0, 0), Z_AX = new Vector3(0, 0, 1);
/** a log centred at site [X, Y, Z] (its axis), running toward compass heading `heading` (deg), tilted up by pitch (deg),
 *  length and radius in amot, rolled about its axis by roll (rad) */
export function logAt(C, [X, Y, Z], heading, len, r, { pitch = 0, roll = 0 } = {}) {
  logSet(C);
  const yaw = ((90 - heading) * Math.PI) / 180;
  _q.setFromAxisAngle(UP, yaw).multiply(_q2.setFromAxisAngle(Z_AX, (pitch * Math.PI) / 180)).multiply(new Quaternion().setFromAxisAngle(X_AX, roll));
  _s.set(len * AMAH, r * AMAH, r * AMAH);
  C.kit.inst('logs', new Matrix4().compose(m2w(X, Y, Z), _q, _s));
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

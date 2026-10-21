// A quiet city massing outside the Mount (reconstruction, docs/decisions/build-mount.md): flat-roofed stone houses
// of one or two storeys (rarely three) in blocks between narrow lanes, some with an upper room on the roof, some lots
// left as walled courtyards; parapets on the roofs (ma'akeh, Devarim 22:8) from detail 2 and a plain roof-edge course.
// Walls of dressed stone, lime-washed or rough rubble; roofs of rolled earth (darker) or lime — so the city sits a
// clear value step below the Temple's marble and never competes with it. Houses along the streets get a recessed
// doorway with a lintel stone and small high windows. No specific buildings (none is placed by the research).
// Merged into the terrain batch (world UVs).
import { AMAH } from '../../core/units.js';
import { rng } from '../mount/kit.js';
import { distToPolyline, rectDist, inRect } from './plan.js';

const MAX_BY_DETAIL = [1100, 2200, 3200, 4200];

export function buildCity(ctx, T, kit, detail) {
  const A = AMAH;
  const m = (meters) => meters / A;
  // the houses' rubble walls and rolled-earth roofs (world-4: they borrowed terrain_rock and ash)
  const has = (k) => ctx.mats?.has?.(k);
  const RUBBLE = has('house_rubble') ? 'house_rubble' : 'terrain_rock', EARTH = has('roof_earth') ? 'roof_earth' : 'ash';
  const { plan, fp } = T;
  const rand = rng((ctx.params?.seed ?? 5786) * 13 + 1);
  const R = (ctx.quality?.drawDistance || 4000) / A;
  const cx0 = (fp.x0 + fp.x1) / 2, cy0 = (fp.y0 + fp.y1) / 2;
  const corridors = [...plan.streets, plan.parahPath];
  const blocked = (X, Y) => {
    for (const r of plan.keepOut) if (inRect(r, X, Y)) return true;
    for (const f of plan.flats) if (rectDist(f.rect, X, Y) < m(6)) return true;
    for (const c of corridors) if (distToPolyline(c.pts, X, Y).d < c.half + m(0.9)) return true;
    return Math.hypot(X - cx0, Y - cy0) > R * 0.9;
  };
  const max = MAX_BY_DETAIL[Math.max(0, Math.min(3, detail))];
  const thin = detail === 0 ? 0.7 : 1;
  const houses = [], yards = [];
  for (const d of plan.districts) {
    const [x0, y0, x1, y1] = d.rect;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, th = d.rot;
    const ca = Math.cos(th), sa = Math.sin(th);
    const toSite = (a, b) => [cx + a * ca - b * sa, cy + a * sa + b * ca];
    const lane = m(4.2);
    const [bw, bh] = d.block;
    const half = Math.hypot(x1 - x0, y1 - y0) / 2;
    for (let b = -half; b < half; b += bh + lane) {
      for (let a = -half; a < half; a += bw + lane) {
        const [bx, by] = toSite(a + bw / 2, b + bh / 2);
        if (bx < x0 || bx > x1 || by < y0 || by > y1) continue;
        // lots: 2–4 along the block, 2–3 across, each a house set back from its neighbours
        const na = 2 + Math.floor(rand() * 3), nb = 2 + (rand() < 0.35 ? 1 : 0);
        for (let i = 0; i < na; i++) {
          for (let j = 0; j < nb; j++) {
            const empty = rand() > d.density * thin || rand() < 0.07;     // courtyards, gardens, gaps
            const la0 = a + bw * i / na, la1 = a + bw * (i + 1) / na, lb0 = b + bh * j / nb, lb1 = b + bh * (j + 1) / nb;
            const ins = () => m(rand() < 0.6 ? 0.15 : 0.4 + 1.4 * rand());   // mostly party walls, some set back
            const p0 = [la0 + ins(), lb0 + ins()], p1 = [la1 - ins(), lb1 - ins()];
            if (p1[0] - p0[0] < m(4) || p1[1] - p0[1] < m(4)) continue;
            const corners = [toSite(p0[0], p0[1]), toSite(p1[0], p0[1]), toSite(p1[0], p1[1]), toSite(p0[0], p1[1])];
            if (corners.some(([X, Y]) => blocked(X, Y))) continue;
            const zs = corners.map(([X, Y]) => T.heightZ(X, Y));
            const zMin = Math.min(...zs), zMax = Math.max(...zs);
            if ((zMax - zMin) * A > 6) continue;                          // too steep for a house
            if (empty) { if (detail >= 1 && rand() < 0.4) yards.push({ corners, zMin, zMax, h: 2.1 + 0.5 * rand(), r: rand() }); continue; }
            const st = rand();
            houses.push({ corners, zMin, zMax, storeys: st < 0.05 ? 3 : st < 0.42 ? 2 : 1, wall: rand(), roof: rand(), upper: rand() < 0.22, hv: rand(), ua: rand(), ub: rand(), dp: rand(), wp: rand() });
          }
        }
      }
    }
  }
  for (let i = houses.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [houses[i], houses[j]] = [houses[j], houses[i]]; }
  const list = houses.slice(0, max);
  const parapet = detail >= 2;
  const streets = plan.streets;
  const nearMount = (X, Y) => T.footDist(X, Y) < 420;
  let fronts = 0;
  for (const h of list) {
    const height = h.storeys === 3 ? 9.4 + 1.2 * h.hv : h.storeys === 2 ? 6.3 + 1.4 * h.hv : 3.6 + 0.9 * h.hv;   // m
    const z0 = h.zMin - m(0.9), zTop = h.zMax + m(height);
    const wallTop = parapet ? zTop + m(0.55) : zTop;
    // the street front: the side whose midpoint is nearest a street (within 14 m of its edge), near the Mount
    const holes = [[], [], [], []];
    let frontSide = -1;
    if (detail >= 1) {
      let best = Infinity;
      for (let k = 0; k < 4; k++) {
        const a = h.corners[k], b = h.corners[(k + 1) % 4];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        if (!nearMount(mx, my)) continue;
        for (const s of streets) { const d = (distToPolyline(s.pts, mx, my).d - s.half) * A; if (d < 14 && d < best) { best = d; frontSide = k; } }
      }
      if (frontSide >= 0) {
        const a = h.corners[frontSide], b = h.corners[(frontSide + 1) % 4];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const dw = m(1.0), dh = m(2.0);
        if (L > dw + m(1.4)) {
          const s0 = m(0.7) + (L - dw - m(1.4)) * h.dp;
          const P = (s) => [a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L];
          const zg = T.heightZ(...P(s0 + dw / 2)) + m(0.05);
          holes[frontSide].push({ s0, s1: s0 + dw, z0: zg, z1: zg + dh, back: 'cedar_v', lintel: true });
          // small high windows (upper floor, or high in a single storey) clear of the door
          const wz = zg + m(h.storeys >= 2 ? 3.4 : 2.3), ww = m(0.45), wh = m(0.55);
          for (const f of h.wp < 0.5 ? [0.25] : [0.2, 0.78]) {
            const ws = (L - ww) * f;
            if (ws + ww < s0 - m(0.4) || ws > s0 + dw + m(0.4)) if (wz + wh < zTop - m(0.4)) holes[frontSide].push({ s0: ws, s1: ws + ww, z0: wz, z1: wz + wh, back: 'timber_rough' });
          }
          fronts++;
        }
      }
    }
    // walls: dressed stone or lime-washed along the streets (seen up close); mostly rubble elsewhere (darker from afar) ⚙
    const onStreet = frontSide >= 0 || streets.some((st) => (distToPolyline(st.pts, h.corners[0][0], h.corners[0][1]).d - st.half) * A < 40);
    const wallKey = onStreet ? (h.wall < 0.75 ? 'ashlar_plain' : 'plaster') : (h.wall < 0.55 ? RUBBLE : h.wall < 0.9 ? 'ashlar_plain' : 'plaster');
    const roofKey = h.roof < 0.8 ? EARTH : 'roof_tile';                // rolled earth roofs, some limed ⚙
    prism(kit, h.corners, z0, wallTop, wallKey, detail, false, holes);
    kit.quad(h.corners.map(([X, Y]) => [X, Y, zTop]), [0, 0, 1], roofKey, { castShadow: false });
    if (parapet) {
      const inner = inset(h.corners, m(0.3));
      prism(kit, inner, zTop, wallTop, wallKey, detail, true);
      for (let k = 0; k < 4; k++) {
        const a0 = h.corners[k], a1 = h.corners[(k + 1) % 4], b1 = inner[(k + 1) % 4], b0 = inner[k];
        kit.quad([[...a0, wallTop], [...a1, wallTop], [...b1, wallTop], [...b0, wallTop]], [0, 0, 1], wallKey, { castShadow: false });
      }
    }
    // a plain roof-edge course (street houses on medium, every house on high+)
    if (detail >= 2 || (detail >= 1 && frontSide >= 0)) roofCourse(kit, h.corners, zTop - m(0.3), zTop - m(0.08), m(0.07));
    if (h.upper && h.storeys === 1 && detail >= 1) {
      // an upper room (aliyah) on part of the roof
      const c = h.corners;
      const lerp2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
      const fa = 0.15 + 0.3 * h.ua, fb = 0.1 + 0.3 * h.ub;
      const e0 = lerp2(c[0], c[1], fa), e1 = lerp2(c[0], c[1], fa + 0.45);
      const f0 = lerp2(c[3], c[2], fa), f1 = lerp2(c[3], c[2], fa + 0.45);
      const room = [lerp2(e0, f0, fb), lerp2(e1, f1, fb), lerp2(e1, f1, fb + 0.5), lerp2(e0, f0, fb + 0.5)];
      const rTop = zTop + m(2.7);
      prism(kit, room, zTop, rTop, wallKey, detail);
      kit.quad(room.map(([X, Y]) => [X, Y, rTop]), [0, 0, 1], roofKey, { castShadow: false });
    }
  }
  // walled courtyards on some empty lots (2.1–2.6 m walls, a gate gap) ⚙
  for (const y of yards.slice(0, Math.round(max * 0.25))) {
    const H = m(y.h), t = m(0.45);
    const inner = inset(y.corners, t / 1.414);
    const z0 = y.zMin - m(0.6), zt = y.zMax + H;
    const gate = Math.floor(y.r * 4);
    for (let k = 0; k < 4; k++) {
      const a = y.corners[k], b = y.corners[(k + 1) % 4], ai = inner[k], bi = inner[(k + 1) % 4];
      const segs = k === gate ? [[0, 0.4], [0.6, 1]] : [[0, 1]];
      for (const [f0, f1] of segs) {
        const L = (p, q, f) => [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
        const p0 = L(a, b, f0), p1 = L(a, b, f1), q0 = L(ai, bi, f0), q1 = L(ai, bi, f1);
        const dx = b[0] - a[0], dy = b[1] - a[1];
        kit.quad([[...p0, z0], [...p1, z0], [...p1, zt], [...p0, zt]], [dy, -dx, 0], RUBBLE, { castShadow: detail >= 2 });
        kit.quad([[...q0, z0], [...q1, z0], [...q1, zt], [...q0, zt]], [-dy, dx, 0], RUBBLE, { collide: false, castShadow: false });
        kit.quad([[...p0, zt], [...p1, zt], [...q1, zt], [...q0, zt]], [0, 0, 1], RUBBLE, { collide: false, castShadow: false });
      }
    }
  }
  return { houses: list.length, fronts, yards: Math.min(yards.length, Math.round(max * 0.25)) };
}

/**
 * Vertical walls of a convex quad prism (corners CCW in plan). inward: faces point inside (parapet inner faces).
 * holes[k]: openings in side k — { s0, s1 (along the side, amot from its first corner), z0, z1, back (material of the
 * recess back), lintel } — cut through the face with a recess 0.35 m deep.
 */
function prism(kit, corners, z0, z1, key, detail, inward = false, holes = null) {
  for (let k = 0; k < 4; k++) {
    const a = corners[k], b = corners[(k + 1) % 4];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const n = inward ? [-dy, dx, 0] : [dy, -dx, 0];                  // CCW plan: outward = (dy, −dx)
    const opts = { castShadow: detail >= 1 && !inward, collide: !inward };
    const hs = holes?.[k];
    if (!hs?.length) { kit.quad([[a[0], a[1], z0], [b[0], b[1], z0], [b[0], b[1], z1], [a[0], a[1], z1]], n, key, opts); continue; }
    wallWithHoles(kit, a, b, z0, z1, hs, key, n, opts);
  }
}

function wallWithHoles(kit, a, b, z0, z1, holes, key, n, opts) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nl = Math.hypot(n[0], n[1]) || 1, nx = n[0] / nl, ny = n[1] / nl;
  const P = (s, z, d = 0) => [a[0] + (b[0] - a[0]) * s / L - nx * d, a[1] + (b[1] - a[1]) * s / L - ny * d, z];
  const ss = new Set([0, L]), zz = new Set([z0, z1]);
  for (const h of holes) { ss.add(h.s0); ss.add(h.s1); zz.add(h.z0); zz.add(h.z1); }
  const S = [...ss].sort((p, q) => p - q), Z = [...zz].sort((p, q) => p - q);
  const inHole = (s, z) => holes.some((h) => s > h.s0 && s < h.s1 && z > h.z0 && z < h.z1);
  for (let j = 0; j + 1 < Z.length; j++) for (let i = 0; i + 1 < S.length; i++) {
    if (inHole((S[i] + S[i + 1]) / 2, (Z[j] + Z[j + 1]) / 2)) continue;
    kit.quad([P(S[i], Z[j]), P(S[i + 1], Z[j]), P(S[i + 1], Z[j + 1]), P(S[i], Z[j + 1])], n, key, opts);
  }
  const A = AMAH, d = 0.35 / A, o = { collide: false, castShadow: false };
  const t = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
  for (const h of holes) {
    kit.quad([P(h.s0, h.z0, d), P(h.s1, h.z0, d), P(h.s1, h.z1, d), P(h.s0, h.z1, d)], n, h.back, o);              // back
    kit.quad([P(h.s0, h.z0), P(h.s0, h.z0, d), P(h.s0, h.z1, d), P(h.s0, h.z1)], [t[0], t[1], 0], key, o);          // jambs
    kit.quad([P(h.s1, h.z0), P(h.s1, h.z0, d), P(h.s1, h.z1, d), P(h.s1, h.z1)], [-t[0], -t[1], 0], key, o);
    kit.quad([P(h.s0, h.z1), P(h.s1, h.z1), P(h.s1, h.z1, d), P(h.s0, h.z1, d)], [0, 0, -1], key, o);               // head
    kit.quad([P(h.s0, h.z0), P(h.s1, h.z0), P(h.s1, h.z0, d), P(h.s0, h.z0, d)], [0, 0, 1], 'ashlar_plain', o);     // sill / threshold
    if (h.lintel) {
      // a lintel stone over the door, a little proud of the wall
      const e = 0.3 / A, pr = 0.06 / A, lt = 0.38 / A;
      const p0 = P(h.s0 - e, h.z1, -pr), p1 = P(h.s1 + e, h.z1, -pr);
      kit.quad([p0, p1, [p1[0], p1[1], h.z1 + lt], [p0[0], p0[1], h.z1 + lt]], n, 'ashlar_plain', o);
      kit.quad([P(h.s0 - e, h.z1), P(h.s1 + e, h.z1), p1, p0], [0, 0, -1], 'ashlar_plain', o);
      kit.quad([[...P(h.s0 - e, 0).slice(0, 2), h.z1 + lt], [...P(h.s1 + e, 0).slice(0, 2), h.z1 + lt], [p1[0], p1[1], h.z1 + lt], [p0[0], p0[1], h.z1 + lt]], [0, 0, 1], 'ashlar_plain', o);
    }
  }
}

/** a plain projecting band round the house just under the roof line (front + soffit) */
function roofCourse(kit, corners, za, zb, pr) {
  const o = { collide: false, castShadow: false };
  for (let k = 0; k < 4; k++) {
    const a = corners[k], b = corners[(k + 1) % 4];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = dy / L, ny = -dx / L, tx = dx / L, ty = dy / L;
    // extend along the side by the projection so the corners close
    const a2 = [a[0] - tx * pr + nx * pr, a[1] - ty * pr + ny * pr], b2 = [b[0] + tx * pr + nx * pr, b[1] + ty * pr + ny * pr];
    kit.quad([[...a2, za], [...b2, za], [...b2, zb], [...a2, zb]], [nx, ny, 0], 'ashlar_plain', o);
    kit.quad([[a[0] - tx * pr, a[1] - ty * pr, za], [b[0] + tx * pr, b[1] + ty * pr, za], [...b2, za], [...a2, za]], [0, 0, -1], 'ashlar_plain', o);
  }
}

function inset(c, d) {
  const cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, cy = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
  return c.map(([x, y]) => {
    const vx = x - cx, vy = y - cy, L = Math.hypot(vx, vy) || 1;
    return [x - vx / L * d * 1.414, y - vy / L * d * 1.414];
  });
}

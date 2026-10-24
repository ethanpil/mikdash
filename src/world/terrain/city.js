// A quiet city massing outside the Mount (reconstruction, docs/decisions/build-mount.md): flat-roofed stone houses
// of one or two storeys (rarely three) in blocks between narrow lanes, some with an upper room on the roof, some lots
// left as walled courtyards; parapets on the roofs (ma'akeh, Devarim 22:8) from detail 1 and a plain roof-edge course.
// Walls of dressed stone, lime-washed, earth-plastered or rough rubble; roofs of rolled earth (darker) or lime — so the
// city sits a clear value step below the Temple's marble and never competes with it. Houses along the streets get a
// recessed doorway with a lintel stone and small high windows. No specific buildings (none is placed by the research).
// qa-r1-fix-world: some blocks are courtyard houses — wings of rooms round an open court (the period's common house),
// the court closed by a wall with a gate where it has no fourth wing; a few courts send up the smoke of a cooking fire
// or an oven in the morning and evening, never on Shabbat. Merged into the terrain batch (world UVs).
import { AMAH } from '../../core/units.js';
import { rng } from '../mount/kit.js';
import { distToPolyline, rectDist, inRect } from './plan.js';

const MAX_BY_DETAIL = [2000, 2600, 3400, 4400];

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
  // qa-r2-fix-world: low keeps the full density (it was thinned to 0.7 — scattered cubes on the soil); a house is a few
  // quads in the terrain's merged batch, so the draw calls do not change and 2000 houses are ≈ 50 k triangles
  const thin = 1;
  const houses = [], yards = [], units = [], courts = [], cwalls = [];
  // wall stone: rubble, dressed stone, lime plaster, earth plaster (the city's value range — qa-r1-fix-world adds the
  // brown earth-plastered walls; the earth key is the roofs' own rolled earth)
  // qa-r2-fix-world: fewer white walls (the city read as a white block-out from the Mount and the air): along the
  // streets 35 % dressed stone, 20 % lime, 25 % earth plaster, 20 % rubble; behind them 45 % rubble, 25 % earth,
  // 20 % dressed, 10 % lime ⚙
  const wallOf = (v, street) => (street
    ? (v < 0.35 ? 'ashlar_plain' : v < 0.55 ? 'plaster' : v < 0.8 ? EARTH : RUBBLE)
    : (v < 0.45 ? RUBBLE : v < 0.7 ? EARTH : v < 0.9 ? 'ashlar_plain' : 'plaster'));
  const flatOk = (corners) => {
    if (corners.some(([X, Y]) => blocked(X, Y))) return null;
    const zs = corners.map(([X, Y]) => T.heightZ(X, Y));
    const zMin = Math.min(...zs), zMax = Math.max(...zs);
    return (zMax - zMin) * A > 6 ? null : { zMin, zMax };          // too steep for a house
  };
  const record = (corners, z, st, extra = {}) => ({ corners, zMin: z.zMin, zMax: z.zMax, storeys: st, wall: rand(), roof: rand(), upper: rand() < 0.22, hv: rand(), ua: rand(), ub: rand(), dp: rand(), wp: rand(), ...extra });
  // ---- the street fronts (qa-r2-fix-world) ⚙: continuous rows of houses on both sides of every street, party walls
  // between them and a lane into the block every few houses, set back a little from the paving — so the streets read
  // as streets from the Mount and from the air. The blocks behind fill in round them (`taken`).
  const frontUnits = [];
  const taken = new Map();                                   // spatial hash: cell -> [quad corners]
  const CELL = m(24);
  const inQuad = (q, X, Y) => {                              // strictly inside a convex quad (either winding)
    let sg = 0;
    for (let k = 0; k < 4; k++) {
      const a = q[k], b = q[(k + 1) % 4], c = (b[0] - a[0]) * (Y - a[1]) - (b[1] - a[1]) * (X - a[0]);
      if (Math.abs(c) < 1e-9) return false;
      if (sg === 0) sg = Math.sign(c); else if (Math.sign(c) !== sg) return false;
    }
    return true;
  };
  const shrink = (q, f) => { const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2; return q.map(([X, Y]) => [cx + (X - cx) * f, cy + (Y - cy) * f]); };
  const probes = (q) => { const c = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2]; return [c, ...shrink(q, 0.92), ...[0, 1, 2, 3].map((k) => [(q[k][0] + q[(k + 1) % 4][0]) / 2 * 0.92 + c[0] * 0.08, (q[k][1] + q[(k + 1) % 4][1]) / 2 * 0.92 + c[1] * 0.08])]; };
  const cellsOf = (q) => {
    const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]), out = [];
    for (let i = Math.floor(Math.min(...xs) / CELL); i <= Math.floor(Math.max(...xs) / CELL); i++) for (let j = Math.floor(Math.min(...ys) / CELL); j <= Math.floor(Math.max(...ys) / CELL); j++) out.push(`${i},${j}`);
    return out;
  };
  const overlaps = (q) => {
    const near = new Set();
    for (const c of cellsOf(q)) for (const o of taken.get(c) || []) near.add(o);
    for (const o of near) {
      if (probes(q).some(([X, Y]) => inQuad(o, X, Y))) return true;
      if (probes(o).some(([X, Y]) => inQuad(q, X, Y))) return true;
    }
    return false;
  };
  const take = (q) => { for (const c of cellsOf(q)) { let l = taken.get(c); if (!l) taken.set(c, l = []); l.push(q); } };
  const ccw = (q) => { let a = 0; for (let k = 0; k < 4; k++) { const p = q[k], r = q[(k + 1) % 4]; a += p[0] * r[1] - r[0] * p[1]; } return a > 0 ? q : [q[0], q[3], q[2], q[1]]; };
  for (const st of plan.streets) {
    for (let i = 0; i + 1 < st.pts.length; i++) {
      const [ax, ay] = st.pts[i], [bx, by] = st.pts[i + 1];
      const L = Math.hypot(bx - ax, by - ay);
      if (L < m(12)) continue;
      const tx = (bx - ax) / L, ty = (by - ay) / L;
      for (const side of [1, -1]) {
        const nx = ty * side, ny = -tx * side;                // the side's normal, away from the street
        const off0 = st.half + m(1.0 + 0.5 * rand());           // clear of the street's corridor (blocked: half + 0.9 m)
        let s0 = m(2 + 3 * rand());
        let row = 0;
        while (s0 < L - m(6)) {
          const w = m(4.5 + 4 * rand()), dep = m(6 + 4.5 * rand());
          if (s0 + w > L - m(2)) break;
          if (row >= 3 && rand() < 0.22) { s0 += m(2.2 + 0.8 * rand()); row = 0; continue; }   // a lane into the block
          const off = off0 + (rand() < 0.2 ? m(0.3 + 0.6 * rand()) : 0);
          const P = (s, o) => [ax + tx * s + nx * o, ay + ty * s + ny * o];
          const q = ccw([P(s0, off), P(s0 + w, off), P(s0 + w, off + dep), P(s0, off + dep)]);
          const z = flatOk(q);
          if (z && !overlaps(q)) {
            const s2 = rand();
            frontUnits.push([record(q, z, s2 < 0.05 ? 3 : s2 < 0.5 ? 2 : 1, { front: true })]);
            take(q);
            row++;
          } else row = 0;
          s0 += w + (rand() < 0.8 ? m(0.04) : m(0.4 + 0.8 * rand()));      // a party wall, or a narrow gap
        }
      }
    }
  }
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
        // qa-r1-fix-world: each block a little turned (±3°) and shifted (±0.6 m) — the lanes wander instead of ruling
        // the city into a grid; the 2 m lanes keep the blocks apart
        const dr = (rand() - 0.5) * 0.1, ox = (rand() - 0.5) * m(1.2), oy = (rand() - 0.5) * m(1.2);
        const bc0 = a + bw / 2, bc1 = b + bh / 2, cr = Math.cos(dr), sr = Math.sin(dr);
        const P = (pa, pb) => { const u = pa - bc0, v = pb - bc1; return toSite(bc0 + u * cr - v * sr + ox, bc1 + u * sr + v * cr + oy); };
        const rect = (a0, b0, a1, b1) => [P(a0, b0), P(a1, b0), P(a1, b1), P(a0, b1)];
        // a courtyard house over the whole block: wings round a court ⚙ (more of them in the upper city)
        if (rand() < (d.id === 'upper' ? 0.42 : 0.26)) {
          const e = () => m(0.15 + 1.2 * rand());
          const o0 = [a + e(), b + e()], o1 = [a + bw - e(), b + bh - e()];
          const dd = m(3.6 + 1.6 * rand());
          const outer = rect(o0[0], o0[1], o1[0], o1[1]);
          const z = flatOk(outer);
          if (z && o1[0] - o0[0] > 2 * dd + m(4) && o1[1] - o0[1] > 2 * dd + m(4) && !overlaps(outer)) {
            const wv = rand(), tall = rand() < (d.id === 'upper' ? 0.55 : 0.35);
            const st = () => (tall && rand() < 0.7 ? 2 : 1);
            const four = rand() < 0.55;
            const wings = [
              rect(o0[0], o0[1], o0[0] + dd, o1[1]),                     // west wing, full depth
              rect(o1[0] - dd, o0[1], o1[0], o1[1]),                     // east wing
              rect(o0[0] + dd, o0[1], o1[0] - dd, o0[1] + dd),           // south wing between them
            ];
            if (four) wings.push(rect(o0[0] + dd, o1[1] - dd, o1[0] - dd, o1[1]));
            const unit = wings.map((c) => record(c, z, st(), { wing: true, wall: rand() < 0.8 ? wv : rand() }));
            units.push(unit);
            const court = rect(o0[0] + dd, o0[1] + dd, o1[0] - dd, o1[1] - dd);
            if (!four) cwalls.push({ a: P(o0[0] + dd, o1[1]), b: P(o1[0] - dd, o1[1]), t: m(0.55), z, h: 2.4 + 0.5 * rand(), wv: unit[0].wall, unit });
            courts.push({ c: [(court[0][0] + court[2][0]) / 2, (court[0][1] + court[2][1]) / 2], z: z.zMin, unit });
            continue;
          }
        }
        // lots: 2–4 along the block, 2–3 across, each a house set back from its neighbours
        const na = 2 + Math.floor(rand() * 3), nb = 2 + (rand() < 0.35 ? 1 : 0);
        for (let i = 0; i < na; i++) {
          for (let j = 0; j < nb; j++) {
            const empty = rand() > d.density * thin || rand() < 0.07;     // courtyards, gardens, gaps
            const la0 = a + bw * i / na, la1 = a + bw * (i + 1) / na, lb0 = b + bh * j / nb, lb1 = b + bh * (j + 1) / nb;
            // party walls between the lots of a block (qa-r2-fix-world: 0.02 m each side, was 0.15 — the block reads as
            // one mass of houses, its lanes and courts the gaps), some houses set back
            const ins = () => m(rand() < 0.75 ? 0.02 : 0.4 + 1.2 * rand());
            const p0 = [la0 + ins(), lb0 + ins()], p1 = [la1 - ins(), lb1 - ins()];
            if (p1[0] - p0[0] < m(4) || p1[1] - p0[1] < m(4)) continue;
            const corners = rect(p0[0], p0[1], p1[0], p1[1]);
            const z = flatOk(corners);
            if (!z || overlaps(corners)) continue;
            if (empty) { if (detail >= 1 && rand() < 0.4) yards.push({ corners, zMin: z.zMin, zMax: z.zMax, h: 2.1 + 0.5 * rand(), r: rand() }); continue; }
            const s2 = rand();
            units.push([record(corners, z, s2 < 0.07 ? 3 : s2 < 0.45 ? 2 : 1)]);
          }
        }
      }
    }
  }
  // whole units (a courtyard house keeps all its wings) up to the tier's budget, nearest the Mount first (qa-r2-fix-world:
  // a random pick spread the low tier's budget thinly over the whole district — scattered cubes; now the city is dense
  // where it is seen from the Mount and thins out with distance, a jitter keeping the edge ragged), street fronts
  // favoured
  const pri = new Map();
  for (const u of frontUnits) pri.set(u, T.footDist(u[0].corners[0][0], u[0].corners[0][1]) * (0.55 + 0.4 * rand()));
  for (const u of units) pri.set(u, T.footDist(u[0].corners[0][0], u[0].corners[0][1]) * (0.75 + 0.5 * rand()));
  const order = [...frontUnits, ...units].sort((p, q) => pri.get(p) - pri.get(q));
  const kept = new Set();
  for (const u of order) { if (houses.length + u.length > max) continue; houses.push(...u); kept.add(u); }
  const list = houses;
  // the roof parapets (ma'akeh, Devarim 22:8) on every tier (qa-r2-fix-world: low too — the flat boxes read as cubes)
  const parapet = true;
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
    const wallKey = wallOf(h.wall, onStreet);
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
    if (h.upper && !h.wing && h.storeys === 1 && detail >= 1) {
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
  // the court walls of three-winged courtyard houses: between the wings' ends, a gate in the middle ⚙
  for (const w of cwalls) {
    if (!kept.has(w.unit)) continue;
    const key = wallOf(w.wv, false), H = m(w.h), z0 = w.z.zMin - m(0.6), zt = w.z.zMax + H;
    const dx = w.b[0] - w.a[0], dy = w.b[1] - w.a[1], L = Math.hypot(dx, dy) || 1;
    const nx = dy / L, ny = -dx / L;                                   // toward the court (the wall stands inside the edge)
    for (const [f0, f1] of [[0, 0.38], [0.62, 1]]) {
      const P = (f, o) => [w.a[0] + dx * f + nx * o, w.a[1] + dy * f + ny * o];
      const p0 = P(f0, 0), p1 = P(f1, 0), q0 = P(f0, w.t), q1 = P(f1, w.t);
      kit.quad([[...p0, z0], [...p1, z0], [...p1, zt], [...p0, zt]], [-nx, -ny, 0], key, { castShadow: detail >= 2 });
      kit.quad([[...q0, z0], [...q1, z0], [...q1, zt], [...q0, zt]], [nx, ny, 0], key, { collide: false, castShadow: false });
      kit.quad([[...p0, zt], [...p1, zt], [...q1, zt], [...q0, zt]], [0, 0, 1], key, { collide: false, castShadow: false });
      for (const [e, s] of [[f0, -1], [f1, 1]]) {
        if (e !== 0.38 && e !== 0.62) continue;                         // the gate's jambs
        const pe = P(e, 0), qe = P(e, w.t);
        kit.quad([[...pe, z0], [...qe, z0], [...qe, zt], [...pe, zt]], [dx / L * s, dy / L * s, 0], key, { collide: false, castShadow: false });
      }
    }
  }
  // smoke of cooking fires and ovens from a few courts near the Mount (render's smoke columns, once fx exists)
  // spread over the city near the Mount (≥ 120 m apart), in a seeded order
  const smokes = [];
  const pool = courts.filter((c) => kept.has(c.unit) && T.footDist(...c.c) < 700).map((c) => ({ c, k: rand() }));
  pool.sort((p, q) => p.k - q.k);
  for (const { c } of pool) {
    if (smokes.length >= 6) break;
    if (smokes.every((o) => Math.hypot(o.c[0] - c.c[0], o.c[1] - c.c[1]) * A > 120)) smokes.push(c);
  }
  const smokeState = { columns: 0, lit: 0 };
  if (smokes.length) citySmoke(ctx, smokes, smokeState);
  return { houses: list.length, fronts, yards: Math.min(yards.length, Math.round(max * 0.25)), compounds: courts.filter((c) => kept.has(c.unit)).length, smokes: smokes.map((c) => c.c.map((v) => +v.toFixed(1))), smokeState };
}

/**
 * Thin wisps of wood smoke from a few courtyards ⚙: the household's morning baking and evening cooking — from dawn into
 * the third seasonal hour and from the ninth hour to an hour after nightfall — none on Shabbat (no fire is kindled;
 * Shemot 35:3), so from Friday's sunset to Saturday's nightfall the courts are still. A pure function of the clock.
 */
function citySmoke(ctx, courts, state) {
  const A = AMAH;
  ctx.bus?.on?.('ready', () => {
    const fx = ctx.fx;
    if (!fx?.smokeColumn || !ctx.time) return;
    // a household fire's smoke: thin at the oven's mouth, spreading as it rises; drifting up 15–25 m before it thins out
    const cols = courts.map((c, i) => fx.smokeColumn({ pos: [c.c[0], c.c[1], c.z + 1.2 / A], height: 15 + 10 * ((i * 0.37) % 1), width: 1.4, density: 0.32, kind: 'wood', rise: 1.2, spread: 3.2, seed: 401 + i * 37 }));
    state.columns = cols.length;
    ctx.engine.onUpdate(() => {
      const tm = ctx.time, z = tm?.zmanim;
      if (!z) return;
      const t = tm.t, dt = tm.dayType;
      const shabbat = dt === 'shabbat' ? t < z.tzeit : dt === 'friday' && t >= z.sunset;
      const morning = t >= z.alot && t < z.sunrise + 3 * z.shaahDay;
      const evening = t >= z.sunrise + 9 * z.shaahDay && t < z.tzeit + 60;
      const on = !shabbat && (morning || evening);
      state.lit = 0;
      cols.forEach((col, i) => {
        // each household at its own time: the fires are lit and die at staggered minutes
        const ph = (i * 0.61) % 1, k = on ? Math.min(1, Math.max(0, Math.sin(((t / 47) + ph) * Math.PI * 2) * 0.5 + 0.6)) : 0;
        const key = Math.round(k * 20);
        if (col.__k !== key) { col.__k = key; col.setIntensity(k); }
        if (k > 0) state.lit++;
      });
    }, 55);
  });
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

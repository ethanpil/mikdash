// The soreg and the chel (Middot 2:3; lock #26/#44): a lattice "of wooden slats crossed diagonally, like a bed-frame
// laced with cords" (Bartenura), 10 tefachim high on a 1-amah stone base, along mount.soreg.params.path, open at its
// passages; the 13 breaches of the Greek kings, re-fenced, show as repaired panels (a closer lattice, heavier posts
// of the same weathered wood, and the base stones replaced in a slightly different stone) — mount.soreg.breaches.
// The chel is the 10-amah strip inside it (Mount pavement); its 12 steps (mount.chel.steps) climb against the
// Ezrat Nashim east gate.
import { Float32BufferAttribute } from 'three';
import { AMAH } from '../../core/units.js';
import { siteQuad, rng } from './kit.js';
import { applyWorldUV } from '../geom.js';

export function buildSoreg(ctx, kit, detail) {
  const e = ctx.el('mount.soreg');
  const P = e.params;
  const br = ctx.el('mount.soreg.breaches').params;
  const path = P.path;
  const z0 = e.box.min[2], zb = z0 + P.baseHeight, zt = zb + P.latticeHeight;
  const bt = P.baseThickness / 2;
  const A = AMAH;
  const segs = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[i], b = path[(i + 1) % path.length];
    segs.push({ a, b, alongX: a[1] === b[1] });
  }
  // assign each passage to its segment: right orientation, covering range, outermost on its side
  const gaps = segs.map(() => []);
  for (const ps of P.passages) {
    const wantX = ps.along === 'X';
    let best = -1, bestV = null;
    segs.forEach((s, i) => {
      if (s.alongX !== wantX) return;
      const lo = wantX ? Math.min(s.a[0], s.b[0]) : Math.min(s.a[1], s.b[1]);
      const hi = wantX ? Math.max(s.a[0], s.b[0]) : Math.max(s.a[1], s.b[1]);
      if (ps.from < lo - 1e-6 || ps.to > hi + 1e-6) return;
      const v = wantX ? s.a[1] : s.a[0];
      const better = bestV == null || (ps.side === 'N' || ps.side === 'E' ? v > bestV : v < bestV);
      if (better) { best = i; bestV = v; }
    });
    if (best >= 0) gaps[best].push([ps.from, ps.to]);
  }
  const breaches = segs.map(() => []);
  for (const st of br.stations) {
    segs.forEach((s, i) => {
      const [x, y] = st.pos;
      if (s.alongX && Math.abs(y - s.a[1]) < 1e-6 && x >= Math.min(s.a[0], s.b[0]) && x <= Math.max(s.a[0], s.b[0])) breaches[i].push([x - br.breachWidth / 2, x + br.breachWidth / 2]);
      if (!s.alongX && Math.abs(x - s.a[0]) < 1e-6 && y >= Math.min(s.a[1], s.b[1]) && y <= Math.max(s.a[1], s.b[1])) breaches[i].push([y - br.breachWidth / 2, y + br.breachWidth / 2]);
    });
  }
  const POST = 0.3, POSTSTEP = 4;
  segs.forEach((s, i) => {
    const lo = s.alongX ? Math.min(s.a[0], s.b[0]) : Math.min(s.a[1], s.b[1]);
    const hi = s.alongX ? Math.max(s.a[0], s.b[0]) : Math.max(s.a[1], s.b[1]);
    const c = s.alongX ? s.a[1] : s.a[0];
    // runs between passages (corners: extend the base by half its thickness so the corners close)
    const cuts = gaps[i].slice().sort((p, q) => p[0] - q[0]);
    const runs = [];
    let cur = lo - bt;
    for (const [g0, g1] of cuts) { if (g0 > cur) runs.push([cur, g0]); cur = Math.max(cur, g1); }
    if (hi + bt > cur) runs.push([cur, hi + bt]);
    const box = (s0, s1, t0, t1, za, zz, key, opts) => kit.box(s.alongX ? [s0, t0, za] : [t0, s0, za], s.alongX ? [s1, t1, zz] : [t1, s1, zz], key, opts);
    for (const [r0, r1] of runs) {
      // stone base, with the repaired stretches in another stone
      const reps = breaches[i].filter(([b0, b1]) => b0 >= r0 && b1 <= r1).sort((p, q) => p[0] - q[0]);
      let x = r0;
      for (const [b0, b1] of reps) {
        if (b0 > x) box(x, b0, c - bt, c + bt, z0, zb, 'ashlar_plain');
        box(b0, b1, c - bt, c + bt, z0, zb, 'steps_stone');
        x = b1;
      }
      if (r1 > x) box(x, r1, c - bt, c + bt, z0, zb, 'ashlar_plain');
      // lattice panel: one double-sided alpha-tested quad on the centre line; denser in the repairs
      const lat = (s0, s1, dense) => {
        const pts = s.alongX ? [[s0, c, zb], [s1, c, zb], [s1, c, zt], [s0, c, zt]] : [[c, s0, zb], [c, s1, zb], [c, s1, zt], [c, s0, zt]];
        const g = siteQuad(pts, s.alongX ? [0, 1, 0] : [1, 0, 0]);
        const k = dense ? 1.3 : 1;
        const uv = new Float32Array(12);
        const p = g.attributes.position;
        for (let j = 0; j < 6; j++) {
          const wx = p.getX(j), wy = p.getY(j), wz = p.getZ(j);
          const u = s.alongX ? wx : -wz;
          uv[j * 2] = u * k + (dense ? 0.37 : 0); uv[j * 2 + 1] = (wy - zb * A) * k;
        }
        g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
        kit.geo(g, 'wood_lattice_screen', { castShadow: true });
      };
      x = r0 + (r0 === lo - bt ? bt : 0);
      const end = r1 - (r1 === hi + bt ? bt : 0);
      for (const [b0, b1] of reps) { if (b0 > x) lat(x, b0, false); lat(b0, b1, true); x = b1; }
      if (end > x) lat(x, end, false);
      // posts and a top rail; heavier posts at the passage ends and either side of each repair. On low: the rail
      // and the end posts only (the lattice must never end in a raw cut)
      const s0 = r0 + (r0 === lo - bt ? bt : 0), s1 = end;
      const n = Math.max(1, Math.round((s1 - s0) / POSTSTEP));
      for (let k = 0; k <= n; k++) {
        if (detail < 1 && k !== 0 && k !== n) continue;
        const v = s0 + (s1 - s0) * k / n;
        const w = (k === 0 || k === n) ? POST * 1.4 : POST;
        box(v - w / 2, v + w / 2, c - w / 2, c + w / 2, zb, zt + 0.12, 'wood_lattice_v', { collide: false });
      }
      if (detail >= 1) for (const [b0, b1] of reps) for (const v of [b0, b1]) box(v - POST * 0.7, v + POST * 0.7, c - POST * 0.7, c + POST * 0.7, zb, zt + 0.16, 'wood_lattice_v', { collide: false });
      box(s0, s1, c - 0.11, c + 0.11, zt - 0.02, zt + 0.1, 'wood_lattice', { collide: false });
    }
  });
}

/**
 * The 12 steps of the chel (Middot 2:3; Rambam BhB 6:1): rise ½, tread ½, against the Ezrat Nashim east gate.
 * Each course is laid in 4–5 stones with staggered joints (a small V-joint on tread and riser, each stone with its
 * own texture offset), a nosing with a chamfered arris over a riser set back 3 cm, and a plain sloping cheek block
 * at each end ⚙. The nosing line keeps the site.js tread positions; the cheeks stand inside the 20-amah width.
 */
export function buildChelSteps(ctx, kit, detail) {
  const e = ctx.el('mount.chel.steps');
  const P = e.params;
  const [x0, y0, z0] = e.box.min, [x1, y1] = e.box.max;
  const rand = rng(1212);
  const CH = 0.8;                                    // cheek width (amot)
  const ya0 = y0 + CH, ya1 = y1 - CH;
  const nose = 0.06, nh = 0.1, ar = 0.03, vj = 0.025, vd = 0.02;   // nosing, its height, arris, V-joint half width, depth
  const stone = 'steps_stone';
  const q = (pts, n, uvOff, opts) => {
    const g = applyWorldUV(siteQuad(pts, n));
    if (uvOff) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + uvOff[0], uv.getY(i) + uvOff[1]); }
    kit.geo(g, stone, opts);
  };
  for (let i = 0; i < P.steps; i++) {
    const xn = x1 - i * P.tread;                     // nosing line (site.js tread edge)
    const xr = xn - nose;                            // riser face, set back
    const xBack = x1 - (i + 1) * P.tread - nose;     // where the next riser stands
    const top = z0 + (i + 1) * P.rise, bot = z0 + i * P.rise;
    // stones: joints staggered course by course
    const nSt = i % 2 ? 5 : 4;
    const joints = [];
    for (let k = 1; k < nSt; k++) joints.push(ya0 + (ya1 - ya0) * (k + (i % 2 ? 0 : 0.5) - 0.5) / nSt + (rand() - 0.5) * 0.8);
    const edges = [ya0, ...joints.filter((y) => y > ya0 + 1 && y < ya1 - 1), ya1];
    for (let k = 0; k + 1 < edges.length; k++) {
      const a = edges[k], b = edges[k + 1];
      const off = [rand() * 3, rand() * 3];
      const ia = k > 0 ? a + vj : a, ib = k + 2 < edges.length ? b - vj : b;   // flat part of this stone
      // tread, arris, nosing front, nosing soffit, riser
      q([[xBack, ia, top], [xn - ar, ia, top], [xn - ar, ib, top], [xBack, ib, top]], [0, 0, 1], off);
      q([[xn - ar, ia, top], [xn, ia, top - ar], [xn, ib, top - ar], [xn - ar, ib, top]], [1, 0, 1], off, { collide: false });
      q([[xn, ia, top - nh], [xn, ib, top - nh], [xn, ib, top - ar], [xn, ia, top - ar]], [1, 0, 0], off, { collide: false });
      q([[xr, ia, top - nh], [xn, ia, top - nh], [xn, ib, top - nh], [xr, ib, top - nh]], [0, 0, -1], off, { collide: false, castShadow: false });
      q([[xr, ia, bot], [xr, ib, bot], [xr, ib, top - nh], [xr, ia, top - nh]], [1, 0, 0], off);
      // V-joint at the stone's upper edge (toward +Y): tread and riser grooves
      if (k + 2 < edges.length) {
        const jm = b, off2 = [rand() * 3, rand() * 3];
        q([[xBack, b - vj, top], [xn - ar, b - vj, top], [xn - ar, jm, top - vd], [xBack, jm, top - vd]], [0, -1, 8], off, { collide: false });
        q([[xBack, jm, top - vd], [xn - ar, jm, top - vd], [xn - ar, b + vj, top], [xBack, b + vj, top]], [0, 1, 8], off2, { collide: false });
        q([[xr, b - vj, bot], [xr - vd, jm, bot], [xr - vd, jm, top - nh], [xr, b - vj, top - nh]], [1, 0, 0], off, { collide: false });
        q([[xr - vd, jm, bot], [xr, b + vj, bot], [xr, b + vj, top - nh], [xr - vd, jm, top - nh]], [1, 0, 0], off2, { collide: false });
        q([[xn - ar, b - vj, top], [xn, b - vj, top - ar], [xn, b + vj, top - ar], [xn - ar, b + vj, top]], [1, 0, 1], off, { collide: false });
        q([[xn, b - vj, top - nh], [xn, b + vj, top - nh], [xn, b + vj, top - ar], [xn, b - vj, top - ar]], [1, 0, 0], off, { collide: false });
        q([[xr, b - vj, top - nh], [xn, b - vj, top - nh], [xn, b + vj, top - nh], [xr, b + vj, top - nh]], [0, 0, -1], off, { collide: false, castShadow: false });
      }
    }
    // the nosing's ends against the cheeks are hidden; nothing else to close
  }
  // cheek blocks: plain sloping blocks, their top half an amah above the nosing line, square end at the foot ⚙
  const zFoot = z0 + P.rise + 0.5;                                   // over the first nosing (x1)
  const zHead = zFoot + (x1 - x0) / P.tread * P.rise;                // the same slope, at the EN wall (x0)
  for (const [c0, c1] of [[y0, y0 + CH], [y1 - CH, y1]]) {
    q([[x1, c0, zFoot], [x0, c0, zHead], [x0, c1, zHead], [x1, c1, zFoot]], [1, 0, 1], [0.2, 0.9]);
    for (const [y, n] of [[c0, -1], [c1, 1]]) kit.quad([[x1, y, z0], [x0, y, z0], [x0, y, zHead], [x1, y, zFoot]], [0, n, 0], 'ashlar_plain');
    kit.quad([[x1, c0, z0], [x1, c1, z0], [x1, c1, zFoot], [x1, c0, zFoot]], [1, 0, 0], 'ashlar_plain');
  }
}

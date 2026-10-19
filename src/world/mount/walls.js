// The four walls of Har HaBayit (mount.wall.*): thickness, height and footProfile from site.js; openings for the five
// gates; Herodian banded marble ashlar — courses of shayish / kochla / marmara, "one course set out and one drawn
// in", left unplastered "like the waves of the sea" (Bava Batra 4a; Part VII §21 #1, §25). The banding and the
// drafted margins are in the herodian_wall texture (course height = its rowH); the set-out courses are modelled as
// 4 cm projections on the courses whose index floor(y / rowH) is even — the same rows the texture marks as set out.
// No battlements: a plain projecting coping course crowns each wall (Part VII §25).
import { Shape } from 'three';
import { AMAH } from '../../core/units.js';
import { interp } from './kit.js';

export const LEAN = { side: 1.5, thick: 1.5 };              // Tadi's leaning stones: reach past the jamb, thickness (amot) ⚙

/** Geometry description of one wall (all amot). */
export function wallDesc(ctx, side) {
  const e = ctx.el(`mount.wall.${side}`);
  const b = e.box;
  const along = e.params.footProfile.along;
  const sA = along === 'X' ? 0 : 1, tA = 1 - sA;
  const extSign = side === 'south' || side === 'west' ? -1 : 1;
  const tMin = b.min[tA], tMax = b.max[tA];
  const openings = (e.params.openings || []).map((id) => {
    const g = ctx.el(id).box;
    return { id, s0: g.min[sA], s1: g.max[sA], z0: g.min[2], z1: g.max[2], tadi: id === 'mount.gate.tadi' };
  });
  return {
    side, el: e, along, sA, tA, extSign,
    s0: b.min[sA], s1: b.max[sA], tMin, tMax,
    tExt: extSign < 0 ? tMin : tMax, tInt: extSign < 0 ? tMax : tMin,
    top: b.max[2],
    foot: (s) => interp(e.params.footProfile.points, s),
    profileS: e.params.footProfile.points.map((p) => p[0]),
    openings,
    /** site point from (s, t, z) */
    pt: (s, t, z) => (along === 'X' ? [s, t, z] : [t, s, z]),
    nT: (sgn) => (along === 'X' ? [0, sgn, 0] : [sgn, 0, 0]),
    nS: (sgn) => (along === 'X' ? [sgn, 0, 0] : [0, sgn, 0]),
    endsExposed: along === 'X',                              // N/S walls run through the corners
  };
}

// z-interval helpers
const subtract = (list, cut) => {
  let out = list.map((r) => r.slice());
  for (const [c0, c1] of cut) {
    const next = [];
    for (const [a, b] of out) {
      if (c1 <= a || c0 >= b) { next.push([a, b]); continue; }
      if (c0 > a) next.push([a, c0]);
      if (c1 < b) next.push([c1, b]);
    }
    out = next;
  }
  return out.filter(([a, b]) => b - a > 1e-4);
};

export function buildWalls(ctx, kit, detail, extra = {}) {
  const A = AMAH;
  const rowH = (ctx.mats.tile?.('herodian_wall')?.rowH ?? 1.1) / A;   // course height in amot
  const SET_OUT = 0.04 / A;                                          // 4 cm
  const COPE = { h: 0.7, proj: 0.3 };
  const out = { walls: {} };
  for (const side of ['south', 'north', 'west', 'east']) {
    const W = wallDesc(ctx, side);
    out.walls[side] = W;
    const { pt, nT, nS, tExt, tInt, extSign, top } = W;
    const skipCope = side === 'east' ? (extra.copingGaps || []) : [];
    const coping = detail >= 1;
    // breakpoints along the wall
    const bps = new Set([W.s0, W.s1, ...W.profileS.filter((s) => s > W.s0 && s < W.s1)]);
    for (const o of W.openings) {
      bps.add(o.s0); bps.add(o.s1);
      if (o.tadi) { bps.add(o.s0 - LEAN.side); bps.add(o.s1 + LEAN.side); }
    }
    for (const g of skipCope) { bps.add(g[0]); bps.add(g[1]); }
    const s = [...bps].sort((a, b) => a - b);
    const pieces = [];
    for (let i = 0; i + 1 < s.length; i++) {
      const a = s[i], b = s[i + 1], mid = (a + b) / 2;
      const bottom = Math.min(W.foot(a), W.foot(b)) - 2;
      let solid = [[bottom, top]];
      let sill = null;
      for (const o of W.openings) {
        if (mid > o.s0 && mid < o.s1) {
          if (o.tadi) solid = [[bottom, o.z0]];
          else solid = subtract(solid, [[o.z0, o.z1]]);
          if (o.z0 > bottom + 0.01) sill = o.z0;
        } else if (o.tadi && ((mid > o.s0 - LEAN.side && mid < o.s0) || (mid > o.s1 && mid < o.s1 + LEAN.side))) {
          solid = [[bottom, o.z1 - (o.s1 - o.s0) / 2]];          // jamb below the leaning stone; the head is extruded
        }
      }
      const noCope = skipCope.some(([g0, g1]) => mid > g0 && mid < g1);
      pieces.push({ a, b, bottom, solid, sill, noCope });
    }
    // faces of each piece
    for (const p of pieces) {
      for (const [za, zb] of p.solid) {
        kit.quad([pt(p.a, tExt, za), pt(p.b, tExt, za), pt(p.b, tExt, zb), pt(p.a, tExt, zb)], nT(extSign), 'herodian_wall');
        const zi = Math.max(za, -1);
        if (zb > zi) kit.quad([pt(p.a, tInt, zi), pt(p.b, tInt, zi), pt(p.b, tInt, zb), pt(p.a, tInt, zb)], nT(-extSign), 'herodian_wall_inner');
        const isTop = Math.abs(zb - top) < 1e-6;
        if (isTop && !(coping && !p.noCope)) {
          kit.quad([pt(p.a, W.tMin, zb), pt(p.b, W.tMin, zb), pt(p.b, W.tMax, zb), pt(p.a, W.tMax, zb)], [0, 0, 1], 'ashlar_plain');
        } else if (!isTop) {
          // top of a sill (threshold) or of a jamb under the Tadi stones
          kit.quad([pt(p.a, W.tMin, zb), pt(p.b, W.tMin, zb), pt(p.b, W.tMax, zb), pt(p.a, W.tMax, zb)], [0, 0, 1], p.sill != null && Math.abs(zb - p.sill) < 1e-6 ? 'steps_stone' : 'ashlar_plain');
        }
        if (za > p.bottom + 1e-6) {
          // soffit of a lintel
          kit.quad([pt(p.a, W.tMin, za), pt(p.b, W.tMin, za), pt(p.b, W.tMax, za), pt(p.a, W.tMax, za)], [0, 0, -1], 'ashlar_plain', { collide: false });
        }
      }
    }
    // end faces: what one piece exposes beyond its neighbour
    for (let i = 0; i <= pieces.length; i++) {
      const L = pieces[i - 1], R = pieces[i];
      const sAt = R ? R.a : L.b;
      if (L) {                                                // face of L pointing +s
        const exp = R ? subtract(L.solid, R.solid) : (W.endsExposed ? L.solid : []);
        for (const [za, zb] of exp) kit.quad([pt(sAt, W.tMin, za), pt(sAt, W.tMax, za), pt(sAt, W.tMax, zb), pt(sAt, W.tMin, zb)], nS(1), R ? 'herodian_wall_inner' : 'herodian_wall');
      }
      if (R) {
        const exp = L ? subtract(R.solid, L.solid) : (W.endsExposed ? R.solid : []);
        for (const [za, zb] of exp) kit.quad([pt(sAt, W.tMin, za), pt(sAt, W.tMax, za), pt(sAt, W.tMax, zb), pt(sAt, W.tMin, zb)], nS(-1), L ? 'herodian_wall_inner' : 'herodian_wall');
      }
    }
    // Tadi: "two stones leaning one on the other" instead of a lintel (Middot 2:3) — a pointed head ⚙ 45°
    for (const o of W.openings.filter((x) => x.tadi)) {
      const hw = (o.s1 - o.s0) / 2, mid = (o.s0 + o.s1) / 2, zs = o.z1 - hw, v = LEAN.thick * Math.SQRT2;
      const edge = (sv) => zs + (sv < mid ? sv - o.s0 : o.s1 - sv) + v;   // upper edge of the stones
      const head = new Shape();
      head.moveTo(o.s0 - LEAN.side, edge(o.s0 - LEAN.side));
      head.lineTo(mid, o.z1 + v);
      head.lineTo(o.s1 + LEAN.side, edge(o.s1 + LEAN.side));
      head.lineTo(o.s1 + LEAN.side, top);
      head.lineTo(o.s0 - LEAN.side, top);
      head.closePath();
      kit.extrude(head, W.along, W.tMin, W.tMax, 'herodian_wall');
      for (const dir of [-1, 1]) {
        const st = new Shape();
        const sj = dir < 0 ? o.s0 : o.s1, so = sj + dir * LEAN.side;
        st.moveTo(so, zs);
        st.lineTo(sj, zs);
        st.lineTo(mid, o.z1);
        st.lineTo(mid, o.z1 + v);
        st.lineTo(so, edge(so));
        st.closePath();
        kit.extrude(st, W.along, W.tMin - 0.15, W.tMax + 0.15, 'marble_white');
      }
      o.head = { zs, v };
    }
    // set-out courses (apik shefa): 4 cm proud on every even course
    if (detail >= 1) {
      const strips = (t, sgn, zFloor) => {
        for (const p of pieces) {
          const ext0 = (W.endsExposed && Math.abs(p.a - W.s0) < 1e-6) ? SET_OUT : 0;
          const ext1 = (W.endsExposed && Math.abs(p.b - W.s1) < 1e-6) ? SET_OUT : 0;
          for (const [za, zb0] of p.solid) {
            const zb = coping && Math.abs(zb0 - top) < 1e-6 && !p.noCope ? top - COPE.h : zb0;
            const lo = Math.max(za, zFloor);
            for (let k = Math.floor(lo / rowH); k * rowH < zb; k++) {
              if (((k % 2) + 2) % 2 !== 0) continue;
              const c0 = Math.max(k * rowH, lo), c1 = Math.min((k + 1) * rowH, zb);
              if (c1 - c0 < 0.02) continue;
              const t0 = t, t1 = t + sgn * SET_OUT;
              const mn = pt(p.a - ext0, Math.min(t0, t1), c0), mx = pt(p.b + ext1, Math.max(t0, t1), c1);
              const min = [Math.min(mn[0], mx[0]), Math.min(mn[1], mx[1]), c0], max = [Math.max(mn[0], mx[0]), Math.max(mn[1], mx[1]), c1];
              const f = { t: 'herodian_wall', b: 'herodian_wall' };
              const key = W.along === 'X' ? (sgn > 0 ? 'n' : 's') : (sgn > 0 ? 'e' : 'w');
              f[key] = 'herodian_wall';
              const endKeys = W.along === 'X' ? ['e', 'w'] : ['n', 's'];
              for (const ek of endKeys) f[ek] = 'herodian_wall';
              kit.faces(min, max, f, { collide: false, castShadow: detail >= 2 && t === tExt });   // exterior: real shadow lines on high+
            }
          }
        }
      };
      strips(tExt, extSign, -1e9);
      if (detail >= 2) strips(tInt, -extSign, 0);
    }
    // coping course (plain, projecting — no merlons)
    if (coping) {
      for (const p of pieces) {
        if (p.noCope || !p.solid.some(([, zb]) => Math.abs(zb - top) < 1e-6)) continue;
        const e0 = W.endsExposed && Math.abs(p.a - W.s0) < 1e-6 ? COPE.proj : 0;
        const e1 = W.endsExposed && Math.abs(p.b - W.s1) < 1e-6 ? COPE.proj : 0;
        const mn = pt(p.a - e0, W.tMin - COPE.proj, top - COPE.h), mx = pt(p.b + e1, W.tMax + COPE.proj, top);
        kit.box([Math.min(mn[0], mx[0]), Math.min(mn[1], mx[1]), top - COPE.h], [Math.max(mn[0], mx[0]), Math.max(mn[1], mx[1]), top], 'ashlar_plain');
      }
    }
  }
  return out;
}

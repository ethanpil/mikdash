// The kevesh and its satellites (Middot 3:3–4, 5:2; Zevachim 62b–63a; Rambam BhB 2:13–15; Tamid 1:4; Shekalim 6:4).
//
//   kevesh        altar.kevesh: params.groundPiece (30 on the ground) + params.flying (1 over the yesod line at underside +17,
//                 1 over the sovev a hair above it) — the flying span is NOT extruded to the floor; a hair's breadth of air
//                 is left before the altar (Zevachim 62b). Same cast, whitewashed stone as the altar (Middot 3:4).
//   small ramps   altar.kevesh.ramp-sovev (east: a slab carried on the kevesh's east face, underside params.undersideZ,
//                 open below) and altar.kevesh.ramp-yesod (west: a 1:3 branch + a level run to the SW corner, solid)
//   revuvah       altar.kevesh.revuvah — a 1 × 1 window in the west face into a cavity (depth ⚙)
//   tables        altar.table.marble ("of the fats") and altar.table.silver, west of the ramp (Shekalim 6:4)
//   machtah       the silver fire-pan resting in the angle between ramp and altar (altar.machtah-niche) — movable
//   beit hadeshen the ash heap east of the ramp (altar.beit-hadeshen) and the notar fire on it ('altar.beit-hadeshen.fire',
//                 kind 'pyre', small, schedule 'service': the sim lights it by day)
import { Group, Mesh } from 'three';
import { Mesher, sweepRing, polyRing, lathe, polarField, noise2, rng, brandGeometry } from './lib.js';
import { roundedRectFn } from './mizbeach.js';
import { mergeGeometries } from '../geom.js';

const DEG = Math.PI / 180;

/**
 * A ramp-like prism swept along Y: plan [x0, x1] × [y0, y1]; top(y) and bot(y) linear in y.
 * Rounded top arrises (f, fs) on the sides listed in `round` ('w', 'e'); faces: 'w','e' sides, 's','n' ends, 'u' underside.
 * westGap: [z0, z1] leaves a window in the west face (the revuvah). subdiv (amot) tessellates the sides; displace(x, y, z)
 * (amot) pushes side points along x (tops stay flat; ends and underside follow the same displaced corners).
 */
function rampSweep(m, o) {
  const { x0, x1, y0, y1, top, bot } = o;
  const f = o.f ?? 0.1, fs = o.fs ?? 2;
  const faces = o.faces ?? 'wesnu';
  const round = o.round ?? 'we';
  const sub = o.subdiv || 0, disp = o.displace || null;
  const slope = (top(y1) - top(y0)) / (y1 - y0);
  // cross-section points: [x, ref ('b' bottom | 't' top | 'a' absolute | 'm' u of the way bottom → fillet), dz|u, nx, nz]
  const arcPts = (cx, cdz, a0, a1) => {
    const out = [];
    for (let i = 0; i <= fs; i++) { const a = (a0 + ((a1 - a0) * i) / fs) * DEG; out.push([cx + f * Math.cos(a), 't', cdz + f * Math.sin(a), Math.cos(a), Math.sin(a)]); }
    return out;
  };
  const rw = round.includes('w') && fs > 0, re = round.includes('e') && fs > 0;
  const fw = rw ? f : 0, fe = re ? f : 0;
  const T = [];
  if (rw) T.push(...arcPts(x0 + f, -f, 180, 90)); else T.push([x0, 't', 0, -1, 0], [x0, 't', 0, 0, 1]);
  if (re) T.push(...arcPts(x1 - f, -f, 90, 0)); else T.push([x1, 't', 0, 0, 1], [x1, 't', 0, 1, 0]);
  const hMax = Math.max(top(y0) - bot(y0), top(y1) - bot(y1));
  const nv = sub > 0 ? Math.max(1, Math.ceil(hMax / sub)) : 1;
  const side = (x, nx) => { const pts = [[x, 'b', 0, nx, 0]]; for (let i = 1; i < nv; i++) pts.push([x, 'm', i / nv, nx, 0]); return pts; };
  const zAt = (p, y) => {
    if (p[1] === 'b') return bot(y) + p[2];
    if (p[1] === 't') return top(y) + p[2];
    if (p[1] === 'm') return bot(y) + p[2] * (top(y) - (p[0] === x0 ? fw : fe) - bot(y));
    return p[2];
  };
  const P = (p, y) => {
    const z = zAt(p, y);
    let x = p[0];
    if (disp && Math.abs(p[3]) > 1e-3) x += p[3] * disp(p[0], y, z);
    return [x, y, z];
  };
  const nrm = (p) => { const l = Math.hypot(p[3], slope * p[4], p[4]) || 1; return [p[3] / l, -slope * p[4] / l, p[4] / l]; };
  const ny = sub > 0 ? Math.max(1, Math.ceil((y1 - y0) / sub)) : 1;
  const ys = Array.from({ length: ny + 1 }, (_, i) => y0 + ((y1 - y0) * i) / ny);
  const strip = (poly) => {
    for (let c = 0; c < ny; c++) {
      const ya = ys[c], yb = ys[c + 1];
      for (let s = 0; s < poly.length - 1; s++) {
        const a = poly[s], b = poly[s + 1];
        if (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) continue;
        const na = nrm(a), nb = nrm(b);
        // the flat walking surface (both points facing straight up) may take its own (foot-worn) material
        const mm = o.mTop && a[4] === 1 && b[4] === 1 && a[1] === 't' && b[1] === 't' ? o.mTop : m;
        mm.quadN(P(a, ya), P(b, ya), P(b, yb), P(a, yb), na, nb, nb, na);
      }
    }
  };
  if (faces.includes('w')) {
    if (o.westGap) {
      strip([[x0, 'b', 0, -1, 0], [x0, 'a', o.westGap[0], -1, 0]]);
      strip([[x0, 'a', o.westGap[1], -1, 0], T[0]]);
    } else strip([...side(x0, -1), T[0]]);
  }
  strip(T);
  if (faces.includes('e')) strip([T[T.length - 1], ...side(x1, 1).reverse()]);
  // ends (the same displaced points as the sides)
  const section = (y) => [...side(x0, -1).map((p) => P(p, y)), ...T.map((p) => P(p, y)), ...side(x1, 1).reverse().map((p) => P(p, y))];
  if (faces.includes('s') && top(y0) - bot(y0) > 1e-4) m.poly(section(y0), [0, -1, 0]);
  if (faces.includes('n') && top(y1) - bot(y1) > 1e-4) m.poly(section(y1), [0, 1, 0]);
  if (faces.includes('u')) {
    for (let c = 0; c < ny; c++) {
      const ya = ys[c], yb = ys[c + 1];
      const w0 = [x0, 'b', 0, -1, 0], e0 = [x1, 'b', 0, 1, 0];
      m.quad(P(w0, ya), P(w0, yb), P(e0, yb), P(e0, ya));
    }
  }
}

export function buildKevesh(A) {
  const { el, d, B, ctx } = A;
  const LIME = 'lime_whitewash';
  // walking surfaces worn smooth by bare feet: the worn variant once the materials task adds it, else the same cast,
  // whitewashed mass as the altar (Middot 3:3–4) — never the plaster key, whose crazing read as a paved ramp
  const WORN = A.mat('lime_whitewash_worn', LIME);
  const M = B.m(LIME), MT = B.m(WORN);
  const R = rng(A.seed ^ 0x4b45);
  const fs = d >= 1 ? 2 : 0, f = 0.1;
  const kv = el('altar.kevesh'), kp = kv.params;
  const [X0, X1] = [kv.box.min[0], kv.box.max[0]];
  const yF = kp.from[1], yT = kp.to[1], zF = kp.from[2], zT = kp.to[2];
  const kevZ = (y) => zF + ((zT - zF) * (y - yF)) / (yT - yF);
  const HAIR = A.HAIR;                                     // "a hair's breadth" ⚙ (1 cm) — visible as a dark seam up close
  const gp = kp.groundPiece;
  const flat = (z) => () => z;

  // ground piece, split round the revuvah window
  const rv = el('altar.kevesh.revuvah').box;
  const ry0 = rv.min[1], ry1 = rv.max[1];
  // detail ≥ 2: the long sides waver by ≤ 1.2 cm along their length (a function of Y only, so the slices meet exactly);
  // zero where the small ramps abut, so no seam opens against them
  const nzK = noise2(A.seed + 202);
  const rsY = el('altar.kevesh.ramp-sovev').box, ryY = el('altar.kevesh.ramp-yesod').params.segments[0].box;
  const fade = (y, a, b) => Math.min(1, Math.max(0, Math.max(a - 0.6 - y, y - b - 0.6) / 1.2));
  const wob = d >= 2 ? (x, y) => 0.025 * nzK(y * 0.25, x * 0.5, 3) * (x > (X0 + X1) / 2 ? fade(y, rsY.min[1], rsY.max[1] + 2) : fade(y, ryY.min[1], ryY.max[1] + 3)) : null;
  const base = { x0: X0, x1: X1, top: kevZ, bot: flat(gp.min[2]), f, fs, mTop: MT, ...(wob ? { subdiv: d >= 3 ? 0.6 : 1.0, displace: wob } : {}) };
  // closed underneath ('u', flush with the pavement and never seen): open, the pavement under the ramp counted as a
  // standable floor 7½ amot under its top, and an observer placed by plan alone (a jump, a stand without Z) stood
  // INSIDE the kevesh, looking at the altar's south face through its culled skin (world-3)
  rampSweep(M, { ...base, y0: gp.min[1], y1: ry0, faces: 'wesu' });
  rampSweep(M, { ...base, y0: ry0, y1: ry1, faces: 'weu', westGap: [rv.min[2], rv.max[2]] });
  rampSweep(M, { ...base, y0: ry1, y1: gp.max[1], faces: 'wenu' });
  // the revuvah cavity (Middot 3:3): a recess in the same limed mass, depth ⚙ 1½
  {
    const cav = B.m(LIME);
    const x0 = X0, x1 = X0 + 1.5, z0 = rv.min[2], z1 = rv.max[2];
    cav.quadH([x0, ry0, z0], [x1, ry0, z0], [x1, ry1, z0], [x0, ry1, z0], [0, 0, 1]);                // floor
    cav.quadH([x0, ry0, z1], [x1, ry0, z1], [x1, ry1, z1], [x0, ry1, z1], [0, 0, -1]);               // ceiling
    cav.quadH([x1, ry0, z0], [x1, ry1, z0], [x1, ry1, z1], [x1, ry0, z1], [-1, 0, 0]);               // back
    cav.quadH([x0, ry0, z0], [x1, ry0, z0], [x1, ry0, z1], [x0, ry0, z1], [0, 1, 0]);                // south side
    cav.quadH([x0, ry1, z0], [x1, ry1, z0], [x1, ry1, z1], [x0, ry1, z1], [0, -1, 0]);               // north side
  }
  // the flying span: over the yesod line (underside +17) and over the sovev (a hair above it) — never down to the floor
  const [fl1, fl2] = kp.flying;
  rampSweep(M, { ...base, y0: fl1.y[0], y1: fl1.y[1] - HAIR, bot: flat(fl1.undersideZ), faces: 'wenu' });
  rampSweep(M, { ...base, y0: fl2.y[0] - HAIR, y1: fl2.y[1] - HAIR, bot: flat(fl2.undersideZ + HAIR), faces: 'wenu' });

  // the small ramp to the sovev (east): descends 1:3 north from the junction, a hair short of the altar. A slab "going
  // out from the kevesh" (Zevachim 62b), carried on its east face with a flat underside at params.undersideZ and open
  // below (site-model-2); the box runs to the pavement only as the overall extent. No west face: it is bonded to the
  // kevesh's east face.
  {
    const rs = el('altar.kevesh.ramp-sovev'), p = rs.params;
    const ya = p.from[1], yb = p.to[1] - HAIR, za = p.from[2], zb = p.to[2];
    const top = (y) => za + ((zb - za) * (y - ya)) / (p.to[1] - ya);
    const carried = p.solidToFloor === false && Number.isFinite(p.undersideZ);
    rampSweep(M, { x0: rs.box.min[0], x1: rs.box.max[0], y0: ya, y1: yb, top, bot: flat(carried ? p.undersideZ : rs.box.min[2]), f, fs, faces: carried ? 'esnu' : 'esn', round: 'e', mTop: MT });
  }
  // the small ramp to the yesod (west): the 1:3 branch, then the level run along the S face to the SW corner
  {
    const ry = el('altar.kevesh.ramp-yesod'), [sa, sb] = ry.params.segments;
    const ya = sa.from[1], yb = sa.to[1], za = sa.from[2], zb = sa.to[2];
    const top = (y) => za + ((zb - za) * (y - ya)) / (yb - ya);
    rampSweep(M, { x0: sa.box.min[0], x1: sa.box.max[0], y0: ya, y1: yb, top, bot: flat(sa.box.min[2]), f, fs, faces: 'ws', round: 'w', mTop: MT });
    const lb = sb.box;
    const pts = [[lb.min[0], lb.min[1]], [lb.max[0], lb.min[1]], [lb.max[0], lb.max[1] - HAIR], [lb.min[0], lb.max[1] - HAIR]];
    const prof = [[0, lb.min[2]]];
    if (fs) for (let i = 0; i <= fs; i++) { const a = (90 * i) / fs * DEG; prof.push([-f + f * Math.cos(a), lb.max[2] - f + f * Math.sin(a)]); }
    else prof.push([0, lb.max[2]]);
    sweepRing((k) => B.m(k), polyRing(pts, [1, 0, 1, 1]), prof, { mat: LIME, cap: true, capMat: WORN, skipEdges: new Set([1]), smoothPlan: 10 });
  }

  // ---------------------------------------------------------------- the two tables west of the ramp (Shekalim 6:4)
  const MAR = 'marble_white', SIL = 'silver';
  {
    // the marble "table of the fats" (Tamid 7:3): a thick slab on two end slabs (trestles) ⚙
    const t = el('altar.table.marble').box;
    const zt0 = t.max[2] - 0.24;
    const TP = [[0, zt0, MAR]];
    if (fs) { TP.push([0, t.max[2] - 0.06]); for (let i = 1; i <= fs; i++) { const a = (90 * i) / fs * DEG; TP.push([-0.06 + 0.06 * Math.cos(a), t.max[2] - 0.06 + 0.06 * Math.sin(a)]); } }
    else TP.push([0, t.max[2]]);
    const mm = (k) => B.m(k);
    // the slab, closed underneath by the same ring as its sides (no slit of sky between edge and underside)
    sweepRing(mm, roundedRectFn(t.min[0], t.min[1], t.max[0], t.max[1], (o) => 0.05 + o, fs ? 2 : 0), [[0, zt0 - 0.001], ...TP.slice(1)], { mat: MAR, cap: true, capBottom: true });
    for (const yy of [t.min[1] + 0.2, t.max[1] - 0.5]) {
      sweepRing(mm, roundedRectFn(t.min[0] + 0.12, yy, t.max[0] - 0.12, yy + 0.3, (o) => 0.03 + o, fs ? 1 : 0),
        [[0.06, t.min[2]], [0.06, t.min[2] + 0.1], [0, t.min[2] + 0.16], [0, zt0]], { mat: MAR });
    }
  }
  {
    // the silver table: a rimmed silver top on four turned legs with stretchers ⚙
    const t = el('altar.table.silver').box;
    const S = B.m(SIL, { collide: true, cast: true });
    const zt = t.max[2] - 0.06, th = 0.08;
    S.box([t.min[0], t.min[1], zt - th], [t.max[0], t.max[1], zt]);
    // rim
    const rimW = 0.05;
    S.box([t.min[0], t.min[1], zt], [t.max[0], t.min[1] + rimW, t.max[2]], 'xXyYZ');
    S.box([t.min[0], t.max[1] - rimW, zt], [t.max[0], t.max[1], t.max[2]], 'xXyYZ');
    S.box([t.min[0], t.min[1] + rimW, zt], [t.min[0] + rimW, t.max[1] - rimW, t.max[2]], 'xXZ');
    S.box([t.max[0] - rimW, t.min[1] + rimW, zt], [t.max[0], t.max[1] - rimW, t.max[2]], 'xXZ');
    // a frieze (apron) under the top, as on period furniture
    const ap = 0.14, ai = 0.04;
    S.box([t.min[0] + ai, t.min[1] + ai, zt - th - ap], [t.max[0] - ai, t.min[1] + ai + 0.03, zt - th], 'xXyYz');
    S.box([t.min[0] + ai, t.max[1] - ai - 0.03, zt - th - ap], [t.max[0] - ai, t.max[1] - ai, zt - th], 'xXyYz');
    S.box([t.min[0] + ai, t.min[1] + ai, zt - th - ap], [t.min[0] + ai + 0.03, t.max[1] - ai, zt - th], 'xXyYz');
    S.box([t.max[0] - ai - 0.03, t.min[1] + ai, zt - th - ap], [t.max[0] - ai, t.max[1] - ai, zt - th], 'xXyYz');
    const legSeg = d >= 2 ? 14 : 8;
    const legH = zt - th - t.min[2];
    // turned legs: a foot, a vase-shaped swelling and a ring under the frieze ⚙
    const legProf = [[0.075, 0], [0.085, 0.03], [0.06, 0.07], [0.05, 0.12], [0.065, legH * 0.3], [0.075, legH * 0.4], [0.055, legH * 0.55],
      [0.045, legH * 0.7], [0.06, legH * 0.78], [0.045, legH * 0.82], [0.05, legH - 0.04], [0.07, legH]];
    const legs = [];
    for (const [lx, ly] of [[t.min[0] + 0.1, t.min[1] + 0.1], [t.max[0] - 0.1, t.min[1] + 0.1], [t.min[0] + 0.1, t.max[1] - 0.1], [t.max[0] - 0.1, t.max[1] - 0.1]]) legs.push(lathe(legProf, [lx, ly, t.min[2]], legSeg));
    B.geo(mergeGeometries(legs.map((g) => g.toNonIndexed()), false), SIL, { collide: false, cast: true });
    const zs = t.min[2] + legH * 0.25;
    S.box([t.min[0] + 0.08, t.min[1] + 0.085, zs], [t.max[0] - 0.08, t.min[1] + 0.115, zs + 0.04]);
    S.box([t.min[0] + 0.08, t.max[1] - 0.115, zs], [t.max[0] - 0.08, t.max[1] - 0.085, zs + 0.04]);
    S.box([t.min[0] + 0.085, t.min[1] + 0.1, zs], [t.min[0] + 0.115, t.max[1] - 0.1, zs + 0.04]);
    S.box([t.max[0] - 0.115, t.min[1] + 0.1, zs], [t.max[0] - 0.085, t.max[1] - 0.1, zs + 0.04]);
    // service vessels on it (detail ≥ 2): two silver bowls (mizrakot) and a jug ⚙
    if (d >= 2) {
      const cx = (t.min[0] + t.max[0]) / 2;
      const bowl = [[0.08, 0], [0.12, 0.02], [0.2, 0.08], [0.24, 0.16], [0.23, 0.17], [0.19, 0.09], [0.1, 0.035], [0, 0.03]];
      const vs = [lathe(bowl, [cx, t.min[1] + 0.45, zt], 20), lathe(bowl, [cx, t.max[1] - 0.45, zt], 20),
        lathe([[0.07, 0], [0.11, 0.08], [0.12, 0.2], [0.07, 0.3], [0.05, 0.36], [0.07, 0.42], [0.06, 0.43], [0.04, 0.37], [0, 0.36]], [cx, (t.min[1] + t.max[1]) / 2, zt], 16)];
      B.geo(mergeGeometries(vs.map((g) => g.toNonIndexed()), false), SIL, { collide: false, cast: true });
    }
  }

  // ---------------------------------------------------------------- the silver machtah in its niche (Tamid 1:4) — movable
  {
    const nb = el('altar.machtah-niche').box;
    const mm = new Mesher();
    const pw = 0.5, pd = 0.42, ph = 0.09, wt = 0.02;
    const cx = nb.max[0] - 0.05 - pw / 2, cy = (nb.min[1] + nb.max[1]) / 2, z0 = nb.min[2] + 0.004;
    const x0 = cx - pw / 2, x1 = cx + pw / 2, y0 = cy - pd / 2, y1 = cy + pd / 2;
    mm.box([x0, y0, z0], [x1, y1, z0 + wt]);                                 // floor
    mm.box([x0, y0, z0], [x1, y0 + wt, z0 + ph]);
    mm.box([x0, y1 - wt, z0], [x1, y1, z0 + ph]);
    mm.box([x0, y0, z0], [x0 + wt, y1, z0 + ph]);
    mm.box([x1 - wt, y0, z0], [x1, y1, z0 + ph]);
    mm.box([nb.min[0] + 0.04, cy - 0.025, z0 + ph * 0.6], [x0, cy + 0.025, z0 + ph * 0.6 + 0.035]); // handle (west)
    const mesh = new Mesh(mm.geometry(), ctx.mats.get(SIL));
    mesh.name = 'altar.machtah:mesh';
    mesh.castShadow = d >= 2;
    mesh.receiveShadow = true;
    const g = new Group();
    g.name = 'altar.machtah';
    g.add(mesh);
    A.group.add(g);
    A.movables.set(g.name, g);
  }

  // ---------------------------------------------------------------- Beit HaDeshen: the ash heap, "swallowed in its place"
  {
    const bd = el('altar.beit-hadeshen').box;
    const nz = noise2(A.seed + 3);
    const cx = (bd.min[0] + bd.max[0]) / 2, cy = (bd.min[1] + bd.max[1]) / 2;
    const rr = (bd.max[0] - bd.min[0]) / 2 * 0.95, hh = (bd.max[2] - bd.min[2]) * 0.8;
    const ph = R() * 6;
    const heapZ = (r01, t) => bd.min[2] - 0.02 + hh * Math.pow(Math.max(0, 1 - r01 * r01), 0.9) * (1 + (d >= 1 ? 0.2 * nz(Math.cos(t) * 2 * r01, Math.sin(t) * 2 * r01) : 0));
    B.geo(polarField(cx, cy, [3, 6, 9, 12][d], [12, 22, 32, 40][d], (t) => rr * (1 + 0.1 * Math.sin(3 * t + ph) + 0.06 * Math.sin(7 * t)),
      heapZ), 'ash', { collide: true, cast: true });
    // the notar fire (disqualified and left-over most-holy meat is burned "in the court, east of the ramp" — Rambam
    // MK 7:3; Zevachim 104b; offerings.js beit-hadeshen): a small open wood fire on the heap that the sim lights by day
    // ('service', intensity 0 until then); a few charred brands of the last burning lie on the crown (detail ≥ 1) ⚙
    const crown = heapZ(0, 0);
    if (d >= 1) {
      // half-burnt brands, their burnt ends toward the crown: timber_charred once the materials task adds it, until then
      // grey with ash (never glass_dark, whose gloss drew them as black pipes — review); the rest bark
      // the bark: one species per brand — fig, walnut, oil-tree (Tamid 2:3; world-4), from its own stream
      const BARKS = ['timber_bark_fig', 'timber_bark_walnut', 'timber_bark_pine'].map((k) => A.mat(k, 'timber_rough'));
      const CHAR = A.mat('timber_charred', 'ash'), END = A.mat('timber_pile_end', 'timber_rough');
      const RS = rng(A.seed ^ 0x51e5);
      const burnt = [], bark = [[], [], []], ends = [];
      for (let i = 0; i < 4; i++) {
        const a = ph + i * 1.7 + R() * 0.4, L = 0.55 + 0.25 * R(), r0 = 0.12 + 0.1 * R();
        const p0 = [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], p1 = [p0[0] - Math.cos(a + 0.5) * L, p0[1] - Math.sin(a + 0.5) * L];
        const z0 = heapZ(Math.min(0.95, r0 / rr), a) + 0.02, z1 = heapZ(Math.min(0.95, Math.hypot(p1[0] - cx, p1[1] - cy) / rr), a) + 0.02;
        const g = brandGeometry([p0[0], p0[1], z0], [p1[0], p1[1], z1], 0.03, R, 0.5);
        burnt.push(...g.burnt); bark[Math.min(2, Math.floor(RS() * 3))].push(...g.bark); ends.push(...g.ends);
      }
      B.geo(mergeGeometries(burnt, false), CHAR, { collide: false, cast: false });
      bark.forEach((list, sp) => { if (list.length) B.geo(mergeGeometries(list, false), BARKS[sp], { collide: false, cast: true }); });
      B.geo(mergeGeometries(ends, false), END, { collide: false, cast: true });
    }
    A.fires.push(ctx.addFire({ id: 'altar.beit-hadeshen.fire', kind: 'pyre', pos: [cx, cy, crown], size: 0.6, intensity: 0, schedule: 'service', smoke: true }));
  }
}

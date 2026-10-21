// The Mizbeach (Middot 3:1–4; Zevachim 53b–54b, 61b–62a; Rambam BhB 2; locks #2–#4, #19, #29).
//
// Cast solid of whole rounded field-stones in lime / lead / pitch, whitewashed (`lime_whitewash` — the stones read as
// soft bulges under the lime), so every tier is a single swept skin with softened arrises (cast in timber forms,
// limed twice a year — no tooled mouldings). Built from site.js only:
//   yesod      altar.yesod params.pieces (N + W full, S and E 1-amah stubs, none at the SE) — one L-shaped skin
//   body       altar.body (30 × 30 from the floor to the sovev) with the chut hasikra (altar.chut-hasikra) as a band
//              of `sikra_red` in the same skin, the sovev ledge (altar.sovev) and the plain upper body (altar.top)
//   karkov     lock #19 — both (Zevachim 62a, RNbY "two: one for beauty, one so the kohanim not slip"): the braita's
//              karkov "between horn and horn, the place of the kohanim's feet, an amah" is the walkway on top itself
//              (altar.walkway, flush, foot-worn); the ornamental one is the one of "under its karkov below, to its half"
//              — a modest cast band on the 30-square just above the chut hasikra and under the sovev, broken where the
//              kevesh and the sovev ramp meet the face (a hair's breadth of air before the altar — Zevachim 62b)
//   keranot    altar.keren.* — 1 × 1 × 1, hollow (Zevachim 54b), open at the top
//   shitin     two thin "nostril" holes in the SW yesod (altar.shitin); the libation cups (altar.libation-cups) at the
//              SW horn; the marble ring-slab over the shit in the pavement (altar.shit-slab)
import { Group, Mesh } from 'three';
import { polyRing, sweepRing, circle, lathe, noise2 } from './lib.js';
import { slabRingGeometry, SLAB_RING } from '../courts/lib/parts.js';

const DEG = Math.PI / 180;

/** profile points along a circular arc in the (o, z) plane, degrees, excluding the start point when skipFirst */
function arc(co, cz, r, a0, a1, segs, key) {
  const out = [];
  for (let i = 0; i <= segs; i++) {
    const a = (a0 + ((a1 - a0) * i) / segs) * DEG;
    out.push(key ? [co + r * Math.cos(a), cz + r * Math.sin(a), key] : [co + r * Math.cos(a), cz + r * Math.sin(a)]);
  }
  return out;
}

export function buildMizbeach(A) {
  const { el, d, B } = A;
  const M = (key) => B.m(key);
  const LIME = 'lime_whitewash', RED = A.mat('sikra_red', 'lime_whitewash');
  // the sovev and the walkway, trodden barefoot: a foot-polished lime once the materials task adds it, else the altar's
  // own whitewash (the plaster key's trowel crazing read as crazy paving on a surface cast and limed with the altar)
  const WORN = A.mat('lime_whitewash_worn', LIME);
  // signs of use, restrained (limed twice a year, wiped every Erev Shabbat — Middot 3:4; Zevachim 54a): smoke-darkened
  // lime on the upper course and the horns, and faint runs where the blood is applied — the S and W yesod (the
  // shirayim), the NE and SW corners below the line, the horns' heads. Both fall back to the plain whitewash.
  const SOOT = A.mat('lime_whitewash_soot', LIME), STAIN = A.mat('lime_whitewash_stained', LIME);
  const yes = el('altar.yesod'), body = el('altar.body'), top = el('altar.top'), sikra = el('altar.chut-hasikra');
  const maar = el('altar.maarachah-area');
  const Z_AZ = body.box.min[2], Z_YES = yes.box.max[2], Z_SOV = body.box.max[2], Z_TOP = top.box.max[2];
  const Z_SIK = sikra.params.z, SIK_H = (sikra.box.max[2] - sikra.box.min[2]) / 2;
  const [bx0, by0] = body.box.min, [bx1, by1] = body.box.max;
  const o28 = -(top.box.min[0] - bx0);                 // −1: the 28-square face, relative to the 30-square
  const o24 = -(maar.box.min[0] - bx0);                // −3: the inner edge of the walkway (ma'arachah line)
  const fs = d >= 1 ? (d >= 2 ? 3 : 2) : 0;             // fillet segments
  const cs = d >= 1 ? (d >= 2 ? 4 : 2) : 0;             // plan-corner segments
  const f = 0.1, cove = 0.06, rc = 0.14;               // arris fillet, inner cove, plan corner radius (amot)
  const HAIR = A.HAIR;                                 // the kevesh's air gap (kevesh.js)
  const kev = el('altar.kevesh').box, rsv = el('altar.kevesh.ramp-sovev').box;
  // detail ≥ 2: the cast, hand-limed faces are not machine-true — tessellate and push them in and out by ≤ 1.2 cm
  // (low-frequency) so long arrises and silhouettes waver slightly; horizontal only, so tops and caps stay sealed.
  // Along the S side, where the kevesh head, the sovev ramp and the yesod branch stand a hair's breadth off the faces
  // (Zevachim 62b), the faces may only waver INWARD, so no vertex ever closes that gap.
  const nzD = noise2(A.seed + 101);
  const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const qx0 = yes.box.min[0] - 1, qx1 = rsv.max[0] + 1, qy1 = by0 + 1.5;
  const quiet = (x, y) => sstep(qx0 - 1, qx0, x) * (1 - sstep(qx1, qx1 + 1, x)) * (1 - sstep(qy1, qy1 + 1, y));
  const wobble = d >= 2 ? (x, y, z) => {
    const r = 0.025 * nzD(x * 0.22 + z * 0.13, y * 0.22 - z * 0.11, 3);
    return r > 0 ? r * (1 - quiet(x, y)) : r;
  } : null;
  const sub = d >= 3 ? 0.5 : d >= 2 ? 0.8 : 0;
  const dispOpts = wobble ? { subdiv: sub, displace: wobble } : {};

  // ---------------------------------------------------------------- the main mass: body → sovev → upper body → top
  const P = [];
  P.push([0, Z_AZ, LIME]);
  P.push([0, Z_SIK - SIK_H, RED]);                      // the chut hasikra "girds it at its middle" (Middot 3:1)
  P.push([0, Z_SIK + SIK_H, LIME]);                     // (the ornamental karkov rides on this face — below)
  if (fs) P.push(...arc(-f, Z_SOV - f, f, 0, 90, fs, LIME)); else P.push([0, Z_SOV, LIME]);
  P[P.length - 1][2] = WORN;                            // the sovev ledge itself
  if (fs) P.push(...arc(o28 + cove, Z_SOV + cove, cove, 270, 180, fs, LIME)); else P.push([o28, Z_SOV, LIME]);
  P.push([o28, Z_TOP - 0.6, SOOT]);                     // the plain upper body; its top course smoke-darkened
  if (fs) P.push(...arc(o28 - f, Z_TOP - f, f, 0, 90, fs, SOOT)); else P.push([o28, Z_TOP, SOOT]);
  P[P.length - 1][2] = WORN;                            // the horn ring and the kohanim's walkway (the braita's karkov)
  P.push([o24, Z_TOP, WORN]);                           // flush to the ma'arachah place (the ash floor, fire.js)
  // corner radius per tier: the 30-square and the 28-square both keep rc
  const rf = (o) => (o > (o28 / 2) ? rc + o : rc + (o - o28));
  const ring = roundedRectFn(bx0, by0, bx1, by1, rf, cs);
  // lower bloods at the NE and SW corners, below the line (Zevachim 53a; Tamid 4:1): a faint stain on the corner faces
  const cornerStain = (e, key, x, y, z) => {
    if (key !== LIME || z > Z_SIK - SIK_H || z < Z_SIK - 3) return null;
    return (x - bx0 < 0.9 && y - by0 < 0.9) || (bx1 - x < 0.9 && by1 - y < 0.9) ? STAIN : null;
  };
  // capBottom: the cast mass is closed at the pavement (never seen), so the pavement inside it is not a standable floor
  // (an observer placed by plan alone stood inside the altar — world-3)
  sweepRing(M, ring, P, { mat: LIME, smoothProf: 50, ...dispOpts, dispZMax: Z_TOP - 0.005, matAt: cornerStain, capBottom: true });

  // ---------------------------------------------------------------- karkov (ornament) under the sovev — lock #19
  // Zevachim 62a: "under its karkov below, to its half" puts a karkov at mid-height, and RNbY: "two — one for beauty"
  // (Rebbi's kiyur). A modest cast band on the 30-square just over the chut hasikra (the half) and under the sovev:
  // cavetto foot, flat fascia, half-round roll, weathered top — a moulding, so detail ≥ 1 only (ARCHITECTURE §5; at 0 its
  // thin underside only aliased into a dashed line). It is broken across the kevesh and the sovev ramp (X kevesh − 2
  // hairs … ramp + 2 hairs), so the hair's breadth of air before the altar stays open; it returns into the face there
  // with flat ends.
  if (d >= 1) {
    const zb = Z_SIK + SIK_H + 0.1, zc = zb + 0.1, zt = Z_SOV - 0.25, pr = 0.08;
    const BP = [[0, zb]];
    BP.push(...arc(0, zc, 0.1, 270, 360, fs).map(([o, z]) => [o * 0.6, z]).slice(1));
    BP.push([pr * 0.75, zc + 0.06], [pr * 0.75, zt - 0.14]);
    BP.push(...arc(pr * 0.75, zt - 0.07, 0.07, 270, 450, fs + 2).map(([o, z]) => [Math.max(o, pr * 0.75), z]).slice(1));
    BP.push([0, zt + 0.02]);
    const xa = kev.min[0] - 2 * HAIR, xb = rsv.max[0] + 2 * HAIR;
    const base = roundedRectFn(bx0, by0, bx1, by1, (o) => rc + o, cs);
    const nSW = cs + 1;                                  // first index after the SW corner's points = the S edge
    const bandRing = (o) => { const r = base(o); r.splice(nSW, 0, [xa, by0 - o], [xb, by0 - o]); return r; };
    sweepRing(M, bandRing, BP, { mat: LIME, smoothProf: 50, skipEdges: new Set([nSW]),
      ...(wobble ? { subdiv: sub, displace: wobble, dispFull: true } : {}) });
    // the two flat ends, displaced with the face exactly as the sweep's end vertices are
    const end = (x, sgn) => M(LIME).poly(BP.map(([o, z]) => [x, by0 - o - (wobble ? wobble(x, by0 - o, z) : 0), z]), [sgn, 0, 0]);
    end(xa, 1); end(xb, -1);
  }

  // ---------------------------------------------------------------- the yesod (L + stubs; the SE has none — Middot 3:1)
  // outline (CCW) from the pieces; edges against the body stay put (weight 0) and are not skinned
  const pc = yes.params.pieces;
  const N_ = pc[0], W_ = pc[1], Ss = pc[2], Es = pc[3];
  const outline = [
    [W_.min[0], W_.min[1]], [Ss.max[0], Ss.min[1]], [Ss.max[0], Ss.max[1]], [W_.max[0], Ss.max[1]],
    [W_.max[0], N_.min[1]], [Es.min[0], N_.min[1]], [Es.min[0], Es.min[1]], [Es.max[0], Es.min[1]],
    [N_.max[0], N_.max[1]], [N_.min[0], N_.max[1]],
  ];
  const hidden = new Set([2, 3, 4, 5]);                  // stub-N, body-W, body-N, E-stub-W
  const wts = outline.map((_, i) => (hidden.has(i) ? 0 : 1));
  const shit = el('altar.shitin');
  const sc = [(shit.box.min[0] + shit.box.max[0]) / 2, (shit.box.min[1] + shit.box.max[1]) / 2];
  const holeR = 0.06, holeSeg = d >= 2 ? 12 : 8;
  const holes = [[sc[0] - 0.14, sc[1] + 0.06], [sc[0] + 0.14, sc[1] + 0.06]].map(([x, y]) => circle(x, y, holeR, holeSeg).reverse());
  const YP = [[0, Z_AZ]];
  if (fs) YP.push(...arc(-f, Z_YES - f, f, 0, 90, fs)); else YP.push([0, Z_YES]);
  // the southern and western yesod receive the shirayim (Zevachim 53a): its S (edges 0, 1) and W (9) faces and its top
  const stainedEdges = new Set([0, 1, 9]);
  sweepRing(M, polyRing(outline, wts), YP, { mat: LIME, cap: true, capMat: STAIN, capHoles: holes, skipEdges: hidden, smoothPlan: 10,
    ...dispOpts, dispZMax: Z_YES - 0.005, matAt: (e) => (stainedEdges.has(e) ? STAIN : null) });
  // the shitin: two thin "nostrils" (Middot 3:2) — short dark throats into the drain shafts
  const dark = B.m(A.mat('glass_dark', 'iron'), { collide: false, cast: false });
  const depth = Math.min(0.3, Z_YES - shit.box.min[2] + 0.1);
  for (const h of holes) {
    const c = h.slice().reverse();
    for (let i = 0; i < c.length; i++) {
      const a = c[i], b = c[(i + 1) % c.length];
      dark.quad([a[0], a[1], Z_YES], [b[0], b[1], Z_YES], [b[0], b[1], Z_YES - depth], [a[0], a[1], Z_YES - depth]);
    }
    dark.poly(c.map((p) => [p[0], p[1], Z_YES - depth]), [0, 0, 1]);
  }

  // ---------------------------------------------------------------- the four keranot: hollow 1 × 1 × 1 (Zevachim 54b)
  // the horn's skin starts where the top's arris fillet starts, flush with the 28-square face and with its corner radius
  const fh = 0.06, wt = 0.17, hollow = 0.62;
  for (const k of ['sw', 'se', 'nw', 'ne']) {
    const kb = el(`altar.keren.${k}`).box;
    const zK = kb.max[2];
    // smoke-darkened sides; the head, where the blood of the chatat is put "on the horns" (Zevachim 53a), stained
    const HP = [[0, kb.min[2] - (fs ? f : 0), SOOT], [0, zK - 0.22, STAIN]];
    if (fs) HP.push(...arc(-fh, zK - fh, fh, 0, 90, fs, STAIN)); else HP.push([0, zK, STAIN]);
    if (fs) HP.push(...arc(-wt + 0.04, zK - 0.04, 0.04, 90, 180, fs, SOOT)); else HP.push([-wt, zK, SOOT]);
    HP.push([-wt, zK - hollow, SOOT]);
    // only the horn's foot ring follows the wobble (so it stays flush with the 28-square face under it)
    sweepRing(M, roundedRectFn(kb.min[0], kb.min[1], kb.max[0], kb.max[1], (o) => rc + o, cs), HP,
      { mat: SOOT, cap: true, smoothProf: 50, ...(wobble ? { subdiv: 0.34, displace: wobble } : {}), dispZMax: kb.min[2] - 0.05 });
  }

  // ---------------------------------------------------------------- the silver libation cups at the SW horn (lock #29)
  const lc = el('altar.libation-cups');
  const cups = new Group();
  cups.name = 'altar.libation-cups';
  const cy = (lc.box.min[1] + lc.box.max[1]) / 2, cz = lc.box.min[2];
  const cupSeg = d >= 2 ? 32 : d >= 1 ? 20 : 12;
  // Sukkah 4:9 / 48b: the western for water, the eastern for wine; the wine's spout wider so both empty together
  for (const [name, x, spout] of [['water', lc.box.min[0] + 0.27, 0.022], ['wine', lc.box.min[0] + 0.73, 0.04]]) {
    const prof = [[0.11, 0], [0.115, 0.015], [0.08, 0.04], [0.06, 0.07], [0.09, 0.095], [0.15, 0.13], [0.195, 0.19], [0.21, 0.245],
      [0.2, 0.255], [0.188, 0.24], [0.172, 0.18], [0.12, 0.13], [spout + 0.01, 0.112], [spout, 0.1], [spout, 0.0]];
    const g = lathe(prof, [x, cy, cz], cupSeg);
    const mesh = new Mesh(g, A.ctx.mats.get('silver'));
    mesh.name = `altar.libation-cup.${name}`;
    mesh.castShadow = d >= 2;
    mesh.receiveShadow = true;
    cups.add(mesh);
    A.movables.set(mesh.name, mesh);
  }
  A.movables.set(cups.name, cups);
  A.group.add(cups);

  // ---------------------------------------------------------------- the marble slab over the shit, with its ring (Middot 3:3)
  const ss = el('altar.shit-slab').box;
  const SP = [[0, ss.min[2]], [0, ss.max[2] + 0.005], [-0.03, ss.max[2] + 0.025]];
  sweepRing(M, roundedRectFn(ss.min[0] + 0.015, ss.min[1] + 0.015, ss.max[0] - 0.015, ss.max[1] - 0.015, (o) => 0.03 + o, d >= 1 ? 2 : 0),
    SP, { mat: 'marble_white', cap: true });
  // its ring: the fitting shared with the keys and sotah slabs (courts/lib/parts.js), toward the south edge; the tablet
  // stands 0.025 proud of the pavement (SP)
  B.geo(slabRingGeometry((ss.min[0] + ss.max[0]) / 2, ss.min[1] + SLAB_RING.inset, ss.max[2] + 0.025, d), 'iron', { collide: false, cast: false });

  return { Z_TOP, Z_SOV, Z_YES };
}

/** roundedRect with a radius function of the offset (keeps rc on each tier of a multi-tier sweep) */
export function roundedRectFn(x0, y0, x1, y1, rFn, segs) {
  const n = Math.max(0, segs | 0);
  return (o) => {
    const rr = Math.max(rFn(o), 1e-4);
    const X0 = x0 - o, Y0 = y0 - o, X1 = x1 + o, Y1 = y1 + o;
    const pts = [];
    const corner = (cx, cy, a0) => {
      if (n === 0) { pts.push([cx + rr * Math.SQRT2 * Math.cos(a0 + Math.PI / 4), cy + rr * Math.SQRT2 * Math.sin(a0 + Math.PI / 4)]); return; }
      for (let i = 0; i <= n; i++) { const a = a0 + (Math.PI / 2) * i / n; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
    };
    corner(X0 + rr, Y0 + rr, Math.PI);
    corner(X1 - rr, Y0 + rr, -Math.PI / 2);
    corner(X1 - rr, Y1 - rr, 0);
    corner(X0 + rr, Y1 - rr, Math.PI / 2);
    return pts;
  };
}

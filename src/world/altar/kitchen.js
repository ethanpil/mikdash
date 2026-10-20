// The kohanim's cooking place in the court (reconstruction, restrained), and the fire the sim lights there.
//
// The most-holy meat (chatat, asham) is cooked and eaten "within the hangings" and the meal-offerings are baked inside
// the court (Zevachim 5:3, 11:4; Rambam MK 12:22–23), but no source places a kitchen. offerings.js STATIONS.kitchen
// sets the cook's station in the south-east of Ezrat Kohanim; the hearth stands just WEST of that point, so the
// dawn inspection route (azarah.achsadra-route, which runs N–S along the station's X) stays clear.
//
//   hearth     squared hearth stones (one course, ≈ 26 cm) in an open rectangle on the pavement, a stoking mouth on the
//              east (the cook's side), an ash-and-charcoal bed inside — "set on the pot" on the hearth stones
//              (Yechezkel 24:3)
//   cauldron   a copper cauldron (dud) with a lid, seated on the stones over the north half, its belly blackened where
//              the flames lick it — copper, because a copper vessel a sin-offering was cooked in is scoured and rinsed,
//              not broken (Vayikra 6:21; Zevachim 11:7)
//   griddle    a copper machavat (flat, with a low rim and a handle) over the south half (Menachot 5:8)
//   basin      a wide copper basin of cold water south of the hearth for the scouring and rinsing ("both in cold",
//              Zevachim 11:7) — with two pots set upside down to drain beside it (detail ≥ 1)
//   firewood   a small stack of split billets north of the hearth (detail ≥ 1)
//
// Fire: 'altar.kitchen.fire' (kind 'hearth', small, schedule 'service', intensity 0) on the bed UNDER the cauldron, its
// light point below the pot's bottom: the sim lights it with ctx.fx.setFire(id, v) while the cooking runs.
// Colliders: the hearth (stones, pots and fire) and the basin are kept out of reach — neither can be stepped onto.
// Forms ⚙ — see docs/decisions/builders-2-inner.md (and builders-2-inner-fix.md).
import { BufferGeometry, Float32BufferAttribute, Matrix4, Quaternion, Euler, Vector3, OctahedronGeometry, CircleGeometry, TorusGeometry } from 'three';
import { Mesher, lathe, heightField, logGeometry, logBetween, brandGeometry, rng, noise2 } from './lib.js';
import { applyWorldUV, mergeGeometries } from '../geom.js';
import { STATIONS } from '../../data/offerings.js';

/** hearth layout relative to its centre (amot) — exported so the anchors can name the cook's place */
export const HEARTH = { halfX: 0.7, halfY: 1.2, wall: 0.3, h: 0.55, mouth: 0.3, cookOff: 1.9 };
/** the kitchen fire's flame size (m) — small enough that its light point (fx: 0.6 × size over the bed) stays under the pot */
const FIRE_SIZE = 0.24;

/**
 * Fire-blackening over a lathe profile [[r, z], …] centred at site point c (built by lathe() with the same `seg`, so
 * the columns coincide): a skin `e` amot proud of the surface from the bottom up to a ragged line that wanders
 * between profile heights zLo and zHi (where the flames stop licking). Its rows are the profile's own vertices, and the
 * ragged edge stays within ONE profile segment, so every skin quad lies on a single facet of the vessel: a quad that
 * bridged a bend of the profile would sink into the copper (review). World geometry, outward-facing, smooth normals.
 */
function sootSkin(prof, c, zLo, zHi, seg, R, AMAH, e = 0.005) {
  const k = prof.findIndex((p, j) => j > 0 && prof[j - 1][1] <= zLo && p[1] >= zHi);
  if (k < 1) throw new Error('sootSkin: zLo..zHi must lie within one profile segment');
  const P = prof.slice(0, k + 1);
  const segN = [];
  for (let j = 1; j < P.length; j++) {
    const dr = P[j][0] - P[j - 1][0], dz = P[j][1] - P[j - 1][1], l = Math.hypot(dr, dz) || 1;
    segN.push([dz / l, -dr / l]);                       // outward (the profile runs bottom → top)
  }
  // offset along each vertex's bisector: at a convex bend the skin then stays outside both facets
  const off = (p, a, b) => { const x = a[0] + b[0], y = a[1] + b[1], l = Math.hypot(x, y) || 1; return [p[0] + (e * x) / l, p[1] + (e * y) / l]; };
  const fixed = P.slice(0, k).map((p, j) => off(p, segN[Math.max(0, j - 1)], segN[Math.min(segN.length - 1, j)]));
  const ph = [R() * 6.3, R() * 6.3, R() * 6.3];
  const edge = (phi) => {                               // the ragged edge on segment k, offset along that facet's normal
    const u = 0.5 + 0.28 * Math.sin(3 * phi + ph[0]) + 0.16 * Math.sin(7 * phi + ph[1]) + 0.08 * Math.sin(13 * phi + ph[2]);
    const z = zLo + (zHi - zLo) * Math.min(1, Math.max(0, u));
    const t = (z - P[k - 1][1]) / (P[k][1] - P[k - 1][1]);
    return off([P[k - 1][0] + (P[k][0] - P[k - 1][0]) * t, z], segN[k - 1], segN[k - 1]);
  };
  const rows = k, n = rows + 1, pos = [], idx = [];
  for (let i = 0; i <= seg; i++) {
    const phi = ((i % seg) / seg) * 2 * Math.PI, sn = Math.sin(phi), cs = Math.cos(phi);
    for (const [r, z] of [...fixed, edge(phi)]) pos.push((c[0] + r * sn) * AMAH, (c[2] + z) * AMAH, -(c[1] + r * cs) * AMAH);
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * n + j, b = (i + 1) * n + j, cc = b + 1, d = a + 1;
      idx.push(a, cc, b, a, d, cc);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return applyWorldUV(g);
}

/** a closed upright prism (n sides, flats at radius r) round site (cx, cy) from z0 to z1 — a round collider */
function prism(M, cx, cy, r, n, z0, z1) {
  const R = r / Math.cos(Math.PI / n);
  const p = Array.from({ length: n }, (_, i) => { const a = ((i + 0.5) / n) * 2 * Math.PI; return [cx + R * Math.cos(a), cy + R * Math.sin(a)]; });
  M.poly(p.map(([x, y]) => [x, y, z1]), [0, 0, 1]);
  M.poly(p.map(([x, y]) => [x, y, z0]), [0, 0, -1]);
  for (let i = 0; i < n; i++) {
    const [ax, ay] = p[i], [bx, by] = p[(i + 1) % n];
    M.quadH([ax, ay, z0], [bx, by, z0], [bx, by, z1], [ax, ay, z1], [(ax + bx) / 2 - cx, (ay + by) / 2 - cy, 0]);
  }
}

export function buildKitchen(A) {
  const { d, B, ctx } = A;
  const R = rng(A.seed ^ 0x6b17);
  const nz = noise2(A.seed + 41);
  const K = STATIONS.kitchen.at;                      // the cook's station (offerings.js)
  const Z = K[2];
  const cx = K[0] - HEARTH.cookOff, cy = K[1];        // the hearth's centre, west of the cook
  const { halfX: hx, halfY: hy, wall: tw, h: hS, mouth } = HEARTH;
  const STONE = 'steps_stone', COP = 'copper', IRON = 'iron', ASH = 'ash';
  const BARK = 'timber_rough', END = A.mat('timber_pile_end', 'timber_rough');
  // charred wood: the materials task's timber_charred once it exists. Until then a brand is drawn as it lies after a
  // burning — its burnt end grey with ash, the rest bark — and the charcoal satin black-grey (iron: a dark, rough metal
  // has a black dielectric's reflectance, F0 ≈ 0.05, and no diffuse); never glass_dark's gloss, which drew the brands
  // as black pipes (review). Soot on the pot: 'soot' once it exists, else the same dark iron.
  const CHAR = A.mat('timber_charred', ASH), COAL = A.mat('timber_charred', IRON), SOOT = A.mat('soot', IRON);
  const jit = (s) => (R() - 0.5) * 2 * s;

  // ---------------------------------------------------------------- the hearth stones (one course, set dry)
  // not colliders themselves: the hearth's collider box (below) keeps the observer out of the stones and the fire
  const S = B.m(STONE, { collide: false, cast: true });
  /** a run of squared stones from a to b (site X/Y along one axis), thickness tw, split into n stones */
  const run = (x0, y0, x1, y1, n) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(y1 - y0);
    const L = alongX ? x1 - x0 : y1 - y0;
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n;
      const len = (b - a) * L - 0.03 - Math.abs(jit(0.02));          // dry joints, a finger wide or less
      const mid = (a + b) / 2;
      const c = alongX ? [x0 + mid * L, (y0 + y1) / 2, Z] : [(x0 + x1) / 2, y0 + mid * L, Z];
      const size = alongX ? [len, tw - 0.02 + jit(0.015), hS + jit(0.03)] : [tw - 0.02 + jit(0.015), len, hS + jit(0.03)];
      S.boxRot([c[0] + jit(0.01), c[1] + jit(0.01), Z], size, jit(0.035), 'Z');
    }
  };
  const n = d >= 1 ? 1 : 0;                            // more, smaller stones from detail 1
  run(cx - hx + tw / 2, cy - hy, cx - hx + tw / 2, cy + hy, 3 + n);                       // west
  run(cx - hx + tw, cy + hy - tw / 2, cx + hx, cy + hy - tw / 2, 2);                       // north
  run(cx - hx + tw, cy - hy + tw / 2, cx + hx, cy - hy + tw / 2, 2);                       // south
  run(cx + hx - tw / 2, cy + mouth, cx + hx - tw / 2, cy + hy - tw, 1 + n);                // east, north of the mouth
  run(cx + hx - tw / 2, cy - hy + tw, cx + hx - tw / 2, cy - mouth, 1 + n);                // east, south of the mouth

  // the bed: ash and embers' leavings inside the stones and spilling a little out of the mouth
  const ix0 = cx - hx + tw - 0.02, ix1 = cx + hx + 0.25, iy0 = cy - hy + tw - 0.02, iy1 = cy + hy - tw + 0.02;
  const bed = (X, Y) => {
    const inside = X < cx + hx - tw ? 1 : Math.max(0, 1 - Math.abs(Y - cy) / mouth) * Math.max(0, 1 - (X - (cx + hx - tw)) / 0.55);
    const mound = 0.07 * Math.max(0, 1 - ((X - cx) / 0.5) ** 2 - ((Y - cy) / 0.95) ** 2);
    return Z - 0.01 + inside * (0.025 + mound + (d >= 1 ? 0.012 * nz(X * 3, Y * 3, 2) : 0));
  };
  const nb = [4, 10, 16, 22][d];
  B.geo(heightField(ix0, iy0, ix1, iy1, nb, Math.round(nb * 1.6), bed), ASH, { collide: false, cast: false });

  // ---------------------------------------------------------------- the copper cauldron and its lid, on the stones
  const seg = [10, 16, 24, 32][d];
  const potC = [cx, cy + hy - tw - 0.45];
  // its belly seated on the stones' inner arrises (the profile's r 0.4 is at z ≈ 0.12), the bottom ≈ 0.2 m over the bed
  const zb = Z + hS - 0.12;
  // the fire burns under the cauldron, a little toward the mouth so the cook sees it (and stokes it) from the east
  const fireXY = [cx + 0.1, potC[1] - 0.13];

  const coal = [], burnt = [], bark = [], ends = [];
  if (d >= 1) {
    // charcoal in the bed and two half-burnt brands pushed in at the mouth, their burnt ends under the pot
    const oct = new OctahedronGeometry(1, 0);
    const q = new Quaternion(), e = new Euler(), sv = new Vector3(), pv = new Vector3(), mtx = new Matrix4();
    for (let i = 0; i < [0, 14, 24, 32][d]; i++) {
      const X = cx - 0.3 + 0.75 * R(), Y = cy + (R() - 0.5) * 1.5, sz = (0.03 + 0.04 * R()) * A.AMAH;
      e.set(R() * 6.3, R() * 6.3, R() * 6.3); q.setFromEuler(e);
      sv.set(sz * (0.8 + 0.6 * R()), sz * (0.45 + 0.3 * R()), sz * (0.6 + 0.5 * R()));
      pv.set(X * A.AMAH, (bed(X, Y) + 0.01) * A.AMAH, -Y * A.AMAH);
      coal.push(applyWorldUV(oct.clone().applyMatrix4(mtx.compose(pv, q, sv))));
    }
    for (const [a0, b0, f] of [[[cx - 0.02, fireXY[1] + 0.1], [cx + 0.82, cy + 0.04], 0.45], [[cx + 0.06, cy + 0.08], [cx + 0.72, cy - 0.2 + jit(0.04)], 0.4]]) {
      const g = brandGeometry([a0[0], a0[1], bed(a0[0], a0[1]) + 0.04], [b0[0], b0[1], Z + 0.07], 0.032, R, f);
      burnt.push(...g.burnt); bark.push(...g.bark); ends.push(...g.ends);
    }
  }

  const shell = [[0, 0], [0.18, 0.006], [0.32, 0.05], [0.42, 0.14], [0.46, 0.26], [0.45, 0.38], [0.4, 0.48], [0.36, 0.53],
    [0.375, 0.57], [0.395, 0.585], [0.375, 0.59], [0.35, 0.56], [0.0, 0.56]];
  const lid = [[0.385, 0.585], [0.405, 0.592], [0.38, 0.604], [0.26, 0.632], [0.11, 0.664], [0.04, 0.676], [0.055, 0.705], [0.045, 0.735], [0, 0.738]];
  const vessels = [lathe(shell, [potC[0], potC[1], zb], seg), lathe(lid, [potC[0], potC[1], zb], seg)];
  if (d >= 1) {
    // two ring handles on lugs at the shoulder, east and west
    for (const s of [-1, 1]) {
      const g = new TorusGeometry(0.06 * A.AMAH, 0.012 * A.AMAH, 5, 10);
      g.rotateY(Math.PI / 2).translate((potC[0] + s * 0.47) * A.AMAH, (zb + 0.42) * A.AMAH, -potC[1] * A.AMAH);
      vessels.push(g);
    }
    // the bottom and lower belly blackened by the fire, to a ragged line just under the widest part ⚙
    B.geo(sootSkin(shell, [potC[0], potC[1], zb], 0.155, 0.255, seg, R, A.AMAH), SOOT, { collide: false, cast: d >= 2 });
  }
  // ---------------------------------------------------------------- the griddle (machavat) over the south half
  const G = B.m(COP, { collide: false, cast: true });
  const gy0 = cy - hy + tw - 0.02, gy1 = cy - 0.36, gx0 = cx - hx + 0.12, gx1 = cx + hx - 0.08, gz = Z + hS + 0.005;
  G.box([gx0, gy0, gz], [gx1, gy1, gz + 0.025]);
  const rim = 0.025;
  G.box([gx0, gy0, gz + 0.025], [gx1, gy0 + rim, gz + 0.06], 'xXyYZ');
  G.box([gx0, gy1 - rim, gz + 0.025], [gx1, gy1, gz + 0.06], 'xXyYZ');
  G.box([gx0, gy0 + rim, gz + 0.025], [gx0 + rim, gy1 - rim, gz + 0.06], 'xXZ');
  G.box([gx1 - rim, gy0 + rim, gz + 0.025], [gx1, gy1 - rim, gz + 0.06], 'xXZ');
  const gm = (gy0 + gy1) / 2;
  G.box([gx1, gm - 0.025, gz + 0.03], [gx1 + 0.32, gm + 0.025, gz + 0.055]);                // handle toward the cook

  // ---------------------------------------------------------------- the scouring basin and the pots beside it
  const bC = [cx + 0.55, cy - hy - 0.85];
  const basin = [[0, 0], [0.26, 0], [0.3, 0.02], [0.44, 0.1], [0.53, 0.22], [0.56, 0.28], [0.58, 0.3], [0.555, 0.305], [0.53, 0.27],
    [0.5, 0.22], [0.42, 0.12], [0.28, 0.05], [0, 0.045]];
  vessels.push(lathe(basin, [bC[0], bC[1], Z], seg));
  const water = new CircleGeometry(0.495 * A.AMAH, seg).rotateX(-Math.PI / 2).translate(bC[0] * A.AMAH, (Z + 0.215) * A.AMAH, -bC[1] * A.AMAH);
  B.geo(applyWorldUV(water), 'water', { collide: false, cast: false });
  if (d >= 1) {
    // two pots set mouth-down on the pavement to drain after the rinsing
    // mouth (with its out-turned rim) on the pavement, neck, shoulder, belly, and the flat base uppermost
    const pot = [[0.235, 0], [0.25, 0.012], [0.235, 0.032], [0.205, 0.055], [0.24, 0.12], [0.275, 0.2], [0.28, 0.25], [0.25, 0.32],
      [0.19, 0.365], [0.17, 0.372], [0, 0.372]];
    vessels.push(lathe(pot, [bC[0] - 0.95, bC[1] - 0.15, Z], seg));
    vessels.push(lathe(pot.map(([r, z]) => [r * 0.8, z * 0.82]), [bC[0] - 0.55, bC[1] - 0.75, Z], seg));
  }
  B.geo(mergeGeometries(vessels.map((g) => (g.index ? g.toNonIndexed() : g)), false), COP, { collide: false, cast: true });

  // ---------------------------------------------------------------- colliders: the hearth, the basin, the woodpile
  // The player steps up 0.35 m. The hearth box and the basin's round collider rise 2 amot (≈ 0.96 m), so no one steps
  // onto the stones and into the fire, or walks on the water — not from the pavement, and not from the woodpile
  // (0.45 amah, which may be stood on): a 1.2-amah box let a walk from the woodpile climb onto the hearth and cross it
  // to the basin, and nav's stair rule (a riser of 0.35 + 1.2·d m within a 0.5 m cell) took a 0.41 m drum for a step.
  // Above the capsule's step probe (0.65 m) the height no longer changes where the observer stops (0.3 m off).
  const col = new Mesher();
  col.box([cx - hx, cy - hy, Z], [cx + hx, cy + hy, Z + 2]);
  prism(col, bC[0], bC[1], 0.6, 12, Z, Z + 2);

  // ---------------------------------------------------------------- firewood north of the hearth (detail ≥ 1)
  const wy0 = cy + hy + 0.3, wy1 = wy0 + 0.6, wx0 = cx - 0.55, wx1 = cx + 0.55;
  if (d >= 1) {
    const sides = [], caps = [];
    const r = 0.075;
    for (let layer = 0; layer < 3; layer++) {
      const nL = 4 - (layer === 2 ? 1 : 0);
      for (let i = 0; i < nL; i++) {
        const y = wy0 + r + (i + (layer % 2) * 0.5) * ((wy1 - wy0 - 2 * r) / 3.5);
        const z = Z + r + layer * r * 1.75;
        const a = [wx0 + jit(0.06), y + jit(0.03), z], b = [wx1 + jit(0.06), y + jit(0.03), z + jit(0.01)];
        const { matrix, len } = logBetween(a, b);
        const rb = r * A.AMAH * (0.85 + 0.25 * R());
        const g = logGeometry(len, rb, rb * (0.9 + 0.1 * R()), [5, 6, 7, 8][d], R, 0.06, 2, R() < 0.4 ? 0.6 : 1, R() * 3);
        g.side.applyMatrix4(matrix); g.caps.applyMatrix4(matrix);
        sides.push(g.side); caps.push(g.caps);
      }
    }
    sides.push(...bark); caps.push(...ends);
    B.geo(mergeGeometries(sides, false), BARK, { collide: false, cast: true });
    B.geo(mergeGeometries(caps, false), END, { collide: false, cast: true });
    col.box([wx0, wy0, Z], [wx1, wy1, Z + 0.45]);
  }
  if (burnt.length) B.geo(mergeGeometries(burnt, false), CHAR, { collide: false, cast: false });
  if (coal.length) B.geo(mergeGeometries(coal, false), COAL, { collide: false, cast: d >= 2 });
  ctx.addCollider(col.geometry(), 'altar:kitchen');

  // ---------------------------------------------------------------- the fire (the sim lights it)
  const fireZ = bed(fireXY[0], fireXY[1]) + 0.01;
  A.fires.push(ctx.addFire({ id: 'altar.kitchen.fire', kind: 'hearth', pos: [fireXY[0], fireXY[1], fireZ], size: FIRE_SIZE, intensity: 0, schedule: 'service', smoke: false }));
  A.kitchen = { centre: [cx, cy, Z], cook: [K[0], K[1], Z], fire: [fireXY[0], fireXY[1], fireZ], potBottomZ: zb };
}

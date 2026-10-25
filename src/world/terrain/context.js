// Context features on the land: the paved streets and the rock-cut Parah path (draped on the graded ground), and the
// burning place of the Parah on the crest of Har HaMishchah (context.parah.pyre) with its beit tevilah.
import { Group, Mesh, CylinderGeometry, Matrix4, Vector3, Quaternion } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { rng } from '../mount/kit.js';
import { mergeGeometries, applyWorldUV } from '../geom.js';

const LIFT = 0.17;   // m: paving top above the graded bed (a little margin against the mesh's interpolation)

/**
 * Paved strips along the plan's streets (top = graded centre-line ground + LIFT, skirts down). The Parah path is no
 * longer a strip (qa-r1-fix-world): the ground itself is graded and worn along it (terrain/index.js).
 */
export function buildDraped(ctx, T, kit, detail) {
  const A = AMAH;
  const list = T.plan.streets.map((s) => ({ ...s, key: 'paving_mount' }));
  const R = (ctx.quality?.drawDistance || 4000) / A;
  const cx = (T.fp.x0 + T.fp.x1) / 2, cy = (T.fp.y0 + T.fp.y1) / 2;
  for (const s of list) {
    const step = (detail >= 2 ? 2.5 : 4) / A;
    const samples = [];
    for (let i = 0; i + 1 < s.pts.length; i++) {
      const [ax, ay] = s.pts[i], [bx, by] = s.pts[i + 1];
      const L = Math.hypot(bx - ax, by - ay);
      const n = Math.max(1, Math.ceil(L / step));
      for (let k = (i === 0 ? 0 : 1); k <= n; k++) {
        const t = k / n;
        const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        if (Math.hypot(x - cx, y - cy) > R * 0.95) continue;
        samples.push({ x, y, dx: (bx - ax) / L, dy: (by - ay) / L, z: (T.sample(x, y).h + LIFT - T.DATUM) / A });
      }
    }
    for (let i = 0; i < samples.length; i++) {
      const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      if (L > 1e-6 && L < step * 3.2) { samples[i].dx = (b.x - a.x) / L; samples[i].dy = (b.y - a.y) / L; }
    }
    const skirt = 0.6 / A;
    for (let i = 0; i + 1 < samples.length; i++) {
      const p = samples[i], q = samples[i + 1];
      if (Math.hypot(q.x - p.x, q.y - p.y) > step * 1.6) continue;
      const nxp = -p.dy * s.half, nyp = p.dx * s.half, nxq = -q.dy * s.half, nyq = q.dx * s.half;
      const L0 = [p.x + nxp, p.y + nyp], R0 = [p.x - nxp, p.y - nyp], L1 = [q.x + nxq, q.y + nyq], R1 = [q.x - nxq, q.y - nyq];
      kit.quad([[...R0, p.z], [...R1, q.z], [...L1, q.z], [...L0, p.z]], [0, 0, 1], s.key, { castShadow: false });
      kit.quad([[...L0, p.z - skirt], [...L1, q.z - skirt], [...L1, q.z], [...L0, p.z]], [-p.dy, p.dx, 0], 'ashlar_plain', { collide: false, castShadow: false });
      kit.quad([[...R0, p.z - skirt], [...R1, q.z - skirt], [...R1, q.z], [...R0, p.z]], [p.dy, -p.dx, 0], 'ashlar_plain', { collide: false, castShadow: false });
    }
  }
}

/** The burning place on the crest (paved, with its mikveh) and the pyre tower as a hidden movable. */
export function buildBurningPlace(ctx, T, kit, group, detail) {
  const b = ctx.el('context.parah.pyre').box;
  const bp = T.plan.burning;                              // floor and tank rects (terrain/plan.js; the ground is cut under them)
  const top = bp.top;                                     // the crest ground at the pyre (site.js)
  const [x0, y0, x1, y1] = bp.floor;
  // the beit tevilah (Parah 3:7): a stone tank (40 se'ah needs 1 x 1 x 3 amot — Yoma 31a; here 4 x 4 x 3 ⚙), NE of the
  // pyre, its west wall against the floor's east edge
  const [mx0, my0, mx1, my1] = bp.tankIn, wt = bp.tankWall, rim = top + 0.75;
  const bottom = top - 3.2;
  const [hx0, hy0, hx1, hy1] = bp.tank;
  // a plain stone floor for the pyre (its place is fixed by Middot 2:4 / Parah 3:9; the floor itself is a reconstruction),
  // its top flush with the crest ground of site.js so a standing eye on it is exactly groundEye; the ground round it lies
  // LIFT (0.17 m) lower, the Parah path's paving meets its top. Closed underneath (the ground is cut out under it).
  // qa-r1-fix-world: laid as courses of separate slabs (it was one flat plane that read as a white sheet): each slab
  // with worn, unevenly chamfered arrises, a few millimetres of lift and tilt of its own, open joints a centimetre wide
  // down to an earth bed ⚙
  const JD = 0.07 / AMAH;                                 // joint depth
  kit.faces([x0, y0, top - 1.2], [x1, y1, top - JD], { t: 'roof_earth', b: 'ashlar_plain', e: 'ashlar_plain', w: 'ashlar_plain', n: 'ashlar_plain', s: 'ashlar_plain' });
  layFloor(kit, [x0, y0, x1, y1], top, JD, (ctx.params?.seed ?? 5786) * 17 + 5, ctx.mats?.has?.('stone_local') ? 'stone_local' : 'ashlar_plain');
  for (const [a0, a1, c0, c1] of [[hx0, hx1, hy0, my0], [hx0, hx1, my1, hy1], [hx0, mx0, my0, my1], [mx1, hx1, my0, my1]]) {
    kit.box([a0, c0, top - 0.6], [a1, c1, rim], 'ashlar_plain');
  }
  // inner walls of the tank (facing inward), floor and the still water
  kit.quad([[mx0, my0, bottom], [mx0, my1, bottom], [mx0, my1, top], [mx0, my0, top]], [1, 0, 0], 'ashlar_plain', { collide: false });
  kit.quad([[mx1, my0, bottom], [mx1, my1, bottom], [mx1, my1, top], [mx1, my0, top]], [-1, 0, 0], 'ashlar_plain', { collide: false });
  kit.quad([[mx0, my0, bottom], [mx1, my0, bottom], [mx1, my0, top], [mx0, my0, top]], [0, 1, 0], 'ashlar_plain', { collide: false });
  kit.quad([[mx0, my1, bottom], [mx1, my1, bottom], [mx1, my1, top], [mx0, my1, top]], [0, -1, 0], 'ashlar_plain', { collide: false });
  kit.quad([[mx0, my0, bottom], [mx1, my0, bottom], [mx1, my1, bottom], [mx0, my1, bottom]], [0, 0, 1], 'ashlar_plain');   // a floor to stand on (no ground under the tank)
  kit.quad([[mx0, my0, top - 0.55], [mx1, my0, top - 0.55], [mx1, my1, top - 0.55], [mx0, my1, top - 0.55]], [0, 0, 1], 'water', { collide: false, castShadow: false });

  // the pyre: "like a tower, with windows; its facade westward" (Parah 3:8) — cedar, pine, cypress and smooth fig
  // logs laid crosswise in courses, the west side open. Shown only for the Parah scene (movable 'parah.pyre').
  const logs = [];
  const layers = Math.round((b.max[2] - b.min[2]) / 0.5);
  const unit = new CylinderGeometry(0.12, 0.13, 1, detail >= 2 ? 8 : 6, 1);
  unit.rotateZ(Math.PI / 2);                              // along x
  const mtx = new Matrix4(), qq = new Quaternion(), sc = new Vector3(), pp = new Vector3();
  for (let L = 0; L < layers; L++) {
    const z = b.min[2] + 0.25 + L * 0.5;
    const alongX = L % 2 === 0;
    const n = 4;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      let X, Y, len;
      if (alongX) { Y = b.min[1] + 0.4 + f * (b.max[1] - b.min[1] - 0.8); X = (b.min[0] + b.max[0]) / 2; len = (b.max[0] - b.min[0]) * AMAH; }
      else {
        X = b.min[0] + 0.4 + f * (b.max[0] - b.min[0] - 0.8); Y = (b.min[1] + b.max[1]) / 2; len = (b.max[1] - b.min[1]) * AMAH;
        if (i === 0 && L > 2 && L < layers - 3) continue;   // the open west facade (windows)
      }
      if (alongX && (i === 1 || i === 2) && L % 4 === 1) continue; // windows in the long sides
      m2w(X, Y, z, pp);
      qq.setFromAxisAngle(new Vector3(0, 1, 0), alongX ? 0 : Math.PI / 2);
      sc.set(len, 1, 1);
      mtx.compose(pp, qq, sc);
      logs.push(unit.clone().applyMatrix4(mtx));
    }
  }
  const pyreGeo = applyWorldUV(mergeGeometries(logs.map((g) => g.toNonIndexed()), false));
  const pyreMesh = new Mesh(pyreGeo, ctx.mats.get('timber_rough'));
  pyreMesh.castShadow = true; pyreMesh.receiveShadow = true;
  const pyreGroup = new Group();
  pyreGroup.name = 'parah.pyre';
  pyreGroup.add(pyreMesh);
  pyreGroup.visible = false;
  pyreGroup.userData = { kind: 'pyre', show(v = true) { pyreGroup.visible = !!v; }, note: 'Parah 3:8–9 — hidden by default; the sim shows it (and may add a pyre fire at context.parah.pyre) for the Parah scene' };
  group.add(pyreGroup);
  ctx.movables.set('parah.pyre', pyreGroup);
}

/**
 * Slabs over the rect [x0, y0, x1, y1] (amot), top at `top`: courses running north–south (1.1–1.5 amot wide), slabs of
 * 1.3–2.6 amot along each, the joints staggered; each slab a frustum — its arrises worn back 1.5–5 cm (more on the
 * floor's outer edge) — with a lift of up to ±11 mm and a tilt of up to ±9 mm across. Outer edges flush with the rect.
 */
function layFloor(kit, [x0, y0, x1, y1], top, jd, seed, STONE) {
  const A = AMAH, r = rng(seed);
  const J = 0.012 / A;                                     // half a joint
  const xs = [x0];
  while (xs[xs.length - 1] < x1 - 1e-6) {
    const w = 1.1 + 0.4 * r();
    xs.push(x1 - xs[xs.length - 1] < w + 0.9 ? x1 : xs[xs.length - 1] + w);
  }
  for (let i = 0; i + 1 < xs.length; i++) {
    const ys = [y0];
    let y = y0 + (i % 2 ? 0.6 + 0.8 * r() : 0);
    if (y > y0) ys.push(y);
    while (y < y1 - 1e-6) { const L = 1.3 + 1.3 * r(); y = y1 - y < L + 0.8 ? y1 : y + L; ys.push(y); }
    for (let j = 0; j + 1 < ys.length; j++) {
      const a0 = xs[i] + (i ? J : 0), a1 = xs[i + 1] - (i + 2 < xs.length ? J : 0);
      const b0 = ys[j] + (j ? J : 0), b1 = ys[j + 1] - (j + 2 < ys.length ? J : 0);
      const edge = i === 0 || i + 2 === xs.length || j === 0 || j + 2 === ys.length;
      const lift = (r() - 0.5) * 0.022 / A, tx = (r() - 0.5) * 0.018 / A, ty = (r() - 0.5) * 0.018 / A;
      const ch = (0.015 + (edge ? 0.035 : 0.022) * r()) / A;
      // gate-world-materials: rough-dressed local limestone (stone_local) — the terrain_rock / steps_stone slabs read as
      // polished veined marble tiles; the weathering and the slab-to-slab tone come from the key's macro and pitting
      slab(kit, a0, b0, a1, b1, top + lift, tx, ty, ch, top - jd, STONE);
    }
  }
}

/** one slab: its top (`key`) chamfered all round by c (amot) over vertical sides down to zb; tx / ty tilt the top (amot across) */
function slab(kit, a0, b0, a1, b1, zt, tx, ty, c, zb, key) {
  const z = (X, Y) => zt + tx * ((X - a0) / (a1 - a0) - 0.5) + ty * ((Y - b0) / (b1 - b0) - 0.5);
  const i0 = a0 + c, i1 = a1 - c, j0 = b0 + c, j1 = b1 - c, dz = c * 0.9;   // the arris drops a little less than it is worn back
  const T = (X, Y) => [X, Y, z(X, Y)], F = (X, Y) => [X, Y, z(X, Y) - dz];
  const o = { castShadow: false };
  kit.quad([T(i0, j0), T(i1, j0), T(i1, j1), T(i0, j1)], [0, 0, 1], key, o);
  kit.quad([F(a0, j0), T(i0, j0), T(i0, j1), F(a0, j1)], [-1, 0, 1], key, o);
  kit.quad([T(i1, j0), F(a1, j0), F(a1, j1), T(i1, j1)], [1, 0, 1], key, o);
  kit.quad([F(i0, b0), F(i1, b0), T(i1, j0), T(i0, j0)], [0, -1, 1], key, o);
  kit.quad([T(i0, j1), T(i1, j1), F(i1, b1), F(i0, b1)], [0, 1, 1], key, o);
  kit.quad([F(a0, b0), F(i0, b0), T(i0, j0), F(a0, j0)], [-1, -1, 1], key, o);
  kit.quad([F(a1, b0), F(a1, j0), T(i1, j0), F(i1, b0)], [1, -1, 1], key, o);
  kit.quad([F(a1, b1), F(i1, b1), T(i1, j1), F(a1, j1)], [1, 1, 1], key, o);
  kit.quad([F(a0, b1), F(a0, j1), T(i0, j1), F(i0, b1)], [-1, 1, 1], key, o);
  // sides down to the bed
  const side = (p, q, n) => kit.quad([[...p, zb], [...q, zb], F(...q), F(...p)], n, 'ashlar_plain', { castShadow: false, collide: false });
  side([a0, b0], [a0, b1], [-1, 0, 0]);
  side([a1, b0], [a1, b1], [1, 0, 0]);
  side([a0, b0], [a1, b0], [0, -1, 0]);
  side([a0, b1], [a1, b1], [0, 1, 0]);
}

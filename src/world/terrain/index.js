// World builder: terrain — the land around Har HaBayit (owner: build-mount).
//   * heightfield from site.js context profiles (terrain/height.js), limestone / brown stony soil by slope and outcrop
//     mask, split into tiles so the camera and the shadow cascades can cull it; a coarse depth-only proxy casts the
//     ground's shadows; a skirt ring past the draw distance so the land never ends in a cut edge
//   * the few streets and the Parah path, graded and paved (terrain/plan.js)
//   * the burning place of the Parah on the crest of Har HaMishchah with its beit tevilah (Parah 3:7) and the pyre
//     tower as a hidden movable 'parah.pyre' (Parah 3:8: "like a tower with windows, its facade westward")
//   * limestone ledges and boulders, dry-stone terraces on Har HaMishchah and the Kidron sides, the Kidron garden
//     plots (Yoma 58b) — terrain/features.js
//   * olive groves on the terraces of Har HaMishchah and garden trees in the Kidron plots (terrain/trees.js)
//   * a quiet city massing outside the Mount (terrain/city.js)
// Detail scales with ctx.quality (terrainSegments, drawDistance, detail).
import { Group, Mesh, BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, MeshBasicMaterial } from 'three';
import { AMAH, m2w } from '../../core/units.js';
import { getTerrain } from './height.js';
import { solveLines, buildGrid, gridSampler } from './grid.js';
import { buildCover } from './cover.js';
import { groundMaterial, TINT, UV_SCALE } from './material.js';
import { Kit, smooth } from '../mount/kit.js';
import { buildTrees } from './trees.js';
import { buildCity } from './city.js';
import { buildDraped, buildBurningPlace } from './context.js';
import { buildFeatures } from './features.js';
import { distToPolyline } from './plan.js';

export async function build(ctx) {
  const t0 = performance.now();
  const q = ctx.quality || {};
  const detail = q.detail ?? 1;
  const T = getTerrain(ctx);
  const A = AMAH;
  const { fp } = T;
  const group = new Group();
  group.name = 'terrain';
  const kit = new Kit(ctx, 'terrain');

  // ---------------------------------------------------------------- the heightfield
  const R = (q.drawDistance || 4000) / A;               // amot
  const cx = (fp.x0 + fp.x1) / 2, cy = (fp.y0 + fp.y1) / 2;
  const seg = q.terrainSegments || 192;
  const footS = ctx.el('mount.wall.south').params.footProfile.points.map((p) => p[0]);
  const footN = ctx.el('mount.wall.north').params.footProfile.points.map((p) => p[0]);
  // the burning place on Har HaMishchah: grid lines on the edges of its graded flat, its stone floor and its tank, so
  // on every tier the ground is level across the flat and meets the floor's edge (no coarse cell sags under it); the
  // ground is cut out under the floor and the tank
  const bp = T.plan.burning, bf = T.plan.flats.find((f) => f.id === 'burning-place').rect;
  const bpX = [bf[0], bf[2], ...bp.cut.flatMap((r) => [r[0], r[2]])], bpY = [bf[1], bf[3], ...bp.cut.flatMap((r) => [r[1], r[3]])];
  // qa-r1-fix-world: lines along the Parah path's edges and centre (its worn band is drawn by the ground itself — the
  // vertex weights below), and the fine bands over the near field of the Har HaMishchah viewpoints (plan.detail), where
  // the ground carries its micro-relief (height.js). Not in the shadow proxy.
  const pp = T.plan.parahPath, dt = T.plan.detail, ti = Math.max(0, Math.min(3, detail));
  const band = (a, b, sp) => { const out = []; const n = Math.max(1, Math.round((b - a) * A / sp)); for (let i = 0; i <= n; i++) out.push(a + (b - a) * i / n); return out; };
  const fineX = [...band(dt.x0, dt.xFine, dt.coarse[ti]), ...band(dt.xFine, dt.x1, dt.fine[ti])];
  const fineY = [...band(dt.y0, dt.y1, dt.fine[ti]), pp.pts[0][1] - pp.half, pp.pts[0][1], pp.pts[0][1] + pp.half];
  const lineSets = (s, fine = true) => ({
    xs: solveLines({ lo: cx - R, hi: cx + R, f0: fp.x0, f1: fp.x1, Llo: 260, Lhi: 520, A, specials: [...footS, ...footN, fp.x0, fp.x1, ...bpX] }, Math.round(1.12 * s), fine ? fineX : []),
    ys: solveLines({ lo: cy - R, hi: cy + R, f0: fp.y0, f1: fp.y1, Llo: 300, Lhi: 300, A, specials: [fp.y0, fp.y1, 0, 500, ...bpY] }, Math.round(0.9 * s), fine ? fineY : []),
  });
  const within = (r, X0, Y0, X1, Y1) => X0 >= r[0] - 1e-6 && X1 <= r[2] + 1e-6 && Y0 >= r[1] - 1e-6 && Y1 <= r[3] + 1e-6;
  const inside = (X0, Y0, X1, Y1) => within([fp.x0, fp.y0, fp.x1, fp.y1], X0, Y0, X1, Y1) || bp.cut.some((r) => within(r, X0, Y0, X1, Y1));
  const { xs, ys } = lineSets(seg);
  const sampleZ = (X, Y) => { const s = T.sample(X, Y); return { z: (s.h - T.DATUM) / A, g: s.g }; };
  const grid = buildGrid(xs, ys, sampleZ, inside);
  const triCount = grid.index.count / 3;
  const pos = grid.attributes.position.array;
  const graded = grid.userData.graded;
  // per-vertex ground: bare grey limestone on steep ground and on the karst outcrops of the slopes, the stony Kidron
  // bed, grey-brown stony soil between, cultivated ground in the Kidron gardens and the olive terraces; graded beds soil
  const nor = grid.attributes.normal.array;
  const nv = pos.length / 3;
  const col = new Float32Array(nv * 3);
  const { material: groundMat, mode } = groundMaterial(ctx);
  for (let v = 0; v < nv; v++) {
    const X = pos[v * 3] / A, Y = -pos[v * 3 + 2] / A;
    const ny = nor[v * 3 + 1];
    const slope = smooth(0.94, 0.84, ny);                            // ~20° .. 33°
    const r = T.rockiness(X, Y);
    const fine = T.noise.fbm(X * A / 9 + 3.3, Y * A / 9 - 1.7, 2);
    const onSlope = smooth(0.999, 0.97, ny);
    let rock = Math.max(slope, smooth(0.42, 0.62, r + 0.18 * fine) * (0.35 + 0.65 * onSlope));
    const u = (X - fp.x1) * A;
    const bed = X > fp.x1 ? 1 - smooth(2.5, 6, Math.abs(X - T.thalwegX(Y)) * A) : 0;
    const green = X > fp.x1 ? Math.max(smooth(100, 140, u) * (1 - smooth(280, 320, u)) * 0.7, smooth(300, 380, u) * (1 - smooth(1000, 1300, u)) * 0.45) : 0;
    // limestone strata outcropping along the contours (every ~7.5 m of height, in patches) on moderate slopes — the
    // banded look of the Judean hills; faded out far away where the cells cannot carry it ⚙
    const hm = pos[v * 3 + 1] + 3 * T.noise.fbm(X * A / 60 - 7, Y * A / 60 + 2, 2);
    const fr = hm / 7.5 - Math.floor(hm / 7.5);
    const near = 1 - smooth(1800, 2600, T.footDist(X, Y));
    const strata = smooth(0.66, 0.8, fr) * (1 - smooth(0.9, 0.97, fr)) * smooth(0.995, 0.96, ny) * smooth(-0.15, 0.25, T.noise.fbm(X * A / 140 + 4, Y * A / 140 - 9, 2)) * near;
    rock = Math.max(rock, 0.85 * strata);
    rock *= 1 - graded[v];
    // qa-r1-fix-world: the Parah path is the ground itself, worn to the limestone along its middle and to trodden soil
    // at its edges (it was a separate pale strip with hard edges); the material's noisy layer edges wear it ragged
    if (Math.abs(Y - pp.pts[0][1]) < pp.half + 4 && X > pp.pts[0][0] - 2 && X < pp.pts[1][0] + 6) {
      const dp = distToPolyline(pp.pts, X, Y).d;
      // gate-world-materials: trodden soil with the limestone showing through in patches (0.22–0.32 rock, was 0.4–0.6): the
      // rock layer down the whole path read as a pale, sky-blue ribbon of wet stone in the dawn views
      rock = Math.max(rock, (0.22 + 0.1 * fine) * (1 - smooth(pp.half * 0.3, pp.half * 1.1, dp)));
    }
    if (mode === 'blend') {
      col.set([rock, (1 - rock) * (1 - green), (1 - rock) * green], v * 3);
    } else {
      const soil = TINT.soil.map((c, k) => c + (TINT.green[k] - c) * green * (0.6 + 0.4 * fine));
      for (let k = 0; k < 3; k++) {
        let c = soil[k] + (TINT.rock[k] - soil[k]) * rock;
        c += (TINT.bed[k] - c) * bed;
        col[v * 3 + k] = c * (0.94 + 0.08 * fine);
      }
    }
  }
  grid.setAttribute('color', new Float32BufferAttribute(col, 3));
  if (UV_SCALE !== 1) { const uv = grid.attributes.uv.array; for (let i = 0; i < uv.length; i++) uv[i] *= UV_SCALE; }
  // render tiles (index ranges of the grid: small tiles near the Mount where the cells are fine)
  const nTiles = detail === 0 ? 2 : detail === 1 ? 3 : 4;
  const tiles = splitGrid(grid, xs.length, ys.length, nTiles);
  tiles.forEach((g, i) => {
    const mesh = new Mesh(g, groundMat);
    mesh.name = `terrain:ground.${i}`;
    mesh.castShadow = false;                                         // the proxy below casts
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  });
  // collider: the visual grid up to 300 k triangles; above that (ultra) the high-tier grid
  const visualIsCollider = triCount <= 300000;
  const cgrid = visualIsCollider ? grid : (() => { const lc = lineSets(320); return buildGrid(lc.xs, lc.ys, sampleZ, inside); })();
  { const p = new BufferGeometry(); p.setAttribute('position', cgrid.attributes.position); p.setIndex(cgrid.index); ctx.addCollider(p, 'terrain'); }
  // shadow caster: a coarse grid sunk 0.6 m (no self-acne on the visual surface), depth only — never drawn in colour
  if (detail >= 1) {
    const lc = lineSets(Math.min(110, seg), false);
    const drop = 0.6 / A;
    const pg = buildGrid(lc.xs, lc.ys, (X, Y) => { const s = sampleZ(X, Y); return { z: s.z - drop, g: s.g }; }, inside);
    const proxyGeo = new BufferGeometry();
    proxyGeo.setAttribute('position', pg.attributes.position);
    proxyGeo.setIndex(pg.index);
    proxyGeo.computeBoundingSphere();
    const proxy = new Mesh(proxyGeo, new MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
    proxy.name = 'terrain:shadow-proxy';
    proxy.castShadow = true;
    proxy.receiveShadow = false;
    proxy.renderOrder = -10;
    proxy.raycast = () => {};
    proxy.matrixAutoUpdate = false;
    group.add(proxy);
  }
  // skirt: the outer edge of the field continued 50 % further out, falling away below the horizon
  const skirt = buildSkirt(grid, xs, ys, R, cx, cy);
  if (skirt) { const sm = new Mesh(skirt, groundMat); sm.name = 'terrain:skirt'; sm.receiveShadow = false; sm.matrixAutoUpdate = false; group.add(sm); }

  // ---------------------------------------------------------------- streets, the Parah path, the burning place
  buildDraped(ctx, T, kit, detail);
  buildBurningPlace(ctx, T, kit, group, detail);

  // ---------------------------------------------------------------- rocks, terraces, gardens; city massing and trees
  const feat = buildFeatures(ctx, T, kit, group, detail);
  const city = buildCity(ctx, T, kit, detail);
  group.add(kit.build());
  const trees = buildTrees(ctx, T, detail, { ...feat, courts: city.courtTrees });
  if (trees) group.add(trees);
  // grass, garrigue and stones round the camera, on the rendered ground (qa-r1-fix-world)
  const cover = buildCover(ctx, T, detail, gridSampler(xs, ys, grid), feat);
  if (cover) group.add(cover);

  group.userData.stats = { gridLines: [xs.length, ys.length], terrainTris: triCount, tiles: tiles.length, houses: city.houses, compounds: city.compounds, smokes: city.smokes, smokeState: city.smokeState, trees: trees?.userData.count || 0, cover: cover?.userData.stats, rocks: feat.rocks, terraceSegs: feat.terraceSegs, plots: feat.plots, ms: Math.round(performance.now() - t0) };
  return group;
}

/** Split the indexed grid into n × n tiles by grid index (each tile its own compact geometry, so it can be culled). */
function splitGrid(grid, nx, ny, n) {
  const idx = grid.index.array;
  const ib = (len, k) => Math.round(k * (len - 1) / n);
  const iBounds = Array.from({ length: n + 1 }, (_, k) => ib(nx, k)), jBounds = Array.from({ length: n + 1 }, (_, k) => ib(ny, k));
  const which = (b, v) => { let t = 0; while (t + 1 < n && v >= b[t + 1]) t++; return t; };
  const lists = Array.from({ length: n * n }, () => []);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const i = Math.min(a % nx, b % nx, c % nx), j = Math.min(Math.floor(a / nx), Math.floor(b / nx), Math.floor(c / nx));
    lists[which(jBounds, j) * n + which(iBounds, i)].push(a, b, c);
  }
  const names = ['position', 'normal', 'uv', 'color'];
  const out = [];
  for (const L of lists) {
    if (!L.length) continue;
    const map = new Map();
    const remap = new Uint32Array(L.length);
    for (let k = 0; k < L.length; k++) {
      let r = map.get(L[k]);
      if (r === undefined) { r = map.size; map.set(L[k], r); }
      remap[k] = r;
    }
    const g = new BufferGeometry();
    for (const nm of names) {
      const src = grid.attributes[nm];
      if (!src) continue;
      const sz = src.itemSize, arr = new Float32Array(map.size * sz);
      for (const [o, r] of map) for (let c = 0; c < sz; c++) arr[r * sz + c] = src.array[o * sz + c];
      g.setAttribute(nm, new Float32BufferAttribute(arr, sz));
    }
    g.setIndex(new Uint32BufferAttribute(remap, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    out.push(g);
  }
  return out;
}

/** A ring of quads from the grid's outer boundary to 1.5 × R, sinking 6 % (below the horizon from any eye). */
function buildSkirt(grid, xs, ys, R, cx, cy) {
  const nx = xs.length, ny = ys.length;
  const P = grid.attributes.position.array, C = grid.attributes.color?.array, U = grid.attributes.uv.array;
  const ring = [];
  for (let i = 0; i < nx; i++) ring.push(i);                                   // south edge, west -> east
  for (let j = 1; j < ny; j++) ring.push(j * nx + nx - 1);                     // east edge
  for (let i = nx - 2; i >= 0; i--) ring.push((ny - 1) * nx + i);             // north edge
  for (let j = ny - 2; j >= 1; j--) ring.push(j * nx);                         // west edge
  const A = AMAH, pos = [], col = [], uv = [], idx = [];
  const cw = m2w(cx, cy, 0);
  for (const v of ring) {
    const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    const dx = x - cw.x, dz = z - cw.z, d = Math.hypot(dx, dz) || 1;
    const ext = R * A * 0.5;
    const ox = x + dx / d * ext, oz = z + dz / d * ext, oy = y - ext * 0.06;
    pos.push(x, y, z, ox, oy, oz);
    const c = C ? [C[v * 3], C[v * 3 + 1], C[v * 3 + 2]] : [1, 1, 1];
    col.push(...c, ...c);
    uv.push(U[v * 2], U[v * 2 + 1], ox * UV_SCALE, -oz * UV_SCALE);
  }
  const n = ring.length;
  for (let k = 0; k < n; k++) {
    const a = 2 * k, b = 2 * ((k + 1) % n);
    // ring runs counter-clockwise seen from above (S edge W->E, E edge S->N …): inner a, b; outer a+1, b+1
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// Walkability grid builder — pure JS (no three.js), so it runs unchanged in a Web Worker (nav.worker.js)
// or time-sliced on the main thread.
//
// Instead of casting millions of rays, every collider triangle is rasterized into the columns of a
// regular grid (Recast-style "heightfield"):
//   * non-vertical triangles add a SURFACE entry (height at the cell centre; up- or down-facing),
//   * steep triangles (not walkable) add a BLOCKER interval [ymin, ymax] to every cell whose centre lies
//     within the capsule radius of the triangle's plan projection (this dilates walls by the radius).
// A column's up-facing walkable surfaces become FLOORS when (a) they are not inside a closed solid,
// (b) nothing lies between floor and floor + capsule height, and (c) no blocker at plan distance d
// rises above floor + stepUp + STAIR_SLOPE·d (so ½-amah stair risers within the radius do not block,
// walls and ledges do) while starting below floor + height. Up to `maxLevels` floors per cell (stairs
// under ceilings, the underground passage, upper chambers, roofs).
//
// Output (compact, node-based): nodeStart[cell..cell+1) indexes nodeY / nodeCell / nodeFlags / comp /
// links (8 direction bits, stairs validated with a floor probe) / coarseOf; plus a coarse graph (local
// components of 8×8-cell blocks) whose Dijkstra distances guide A* along long routes.

export const NAV_DEFAULTS = {
  cell: 0.5, // m
  height: 1.75, // capsule height (m)
  radius: 0.3, // capsule radius (m)
  stepUp: 0.35, // max single riser (m)
  walkNy: 0.62, // min normal.y of a walkable surface (~51.7°; ½×½-amah stairs as ramps are 45°)
  maxLevels: 6, // the ta'im columns under the aliyah landing hold 5 (+22, +33, +44, roof +55, landing +67)
  tile: 64,
  climbOrth: 0.8, // max |Δh| between orthogonal neighbours worth testing: 0.5 m cells over ½-amah treads can
  //               straddle three 24 cm risers (0.72 m); real ledges are rejected by the sub-step probe
};

const UP_WALK = 1, UP_STEEP = 2, DOWN = 3, BLOCK = 4;
/** a riser at plan distance d may rise stepUp + STAIR_SLOPE·d above the floor (45° stairs + margin) */
export const STAIR_SLOPE = 1.2;
export const FLAG_NEAR_EDGE = 1;
/** neighbour directions (di, dj) by bit index; OPP = opposite bit; FORWARD = one of each opposite pair */
export const DIRS = [1, 0, -1, 0, 0, 1, 0, -1, 1, 1, 1, -1, -1, 1, -1, -1];
export const OPP = [1, 0, 3, 2, 7, 6, 5, 4];
const FORWARD = [0, 2, 4, 6];

/**
 * Valid floor heights of one column from its surface & blocker entries.
 * ys/kinds: surface heights + kinds (UP_WALK, UP_STEEP, DOWN), any order; blocks: flat [y0, y1, d, ...].
 * Shared by the grid builder and physics.floorsAt (exact column queries).
 */
export function columnFloors(ys, kinds, n, blocks, nb, cfg, out) {
  const { height: H, stepUp, maxLevels } = cfg;
  // insertion sort by y, ties: up-facing before down-facing
  for (let i = 1; i < n; i++) {
    const y = ys[i], k = kinds[i];
    let j = i - 1;
    while (j >= 0 && (ys[j] > y || (ys[j] === y && kinds[j] === DOWN && k !== DOWN))) {
      ys[j + 1] = ys[j]; kinds[j + 1] = kinds[j]; j--;
    }
    ys[j + 1] = y; kinds[j + 1] = k;
  }
  // drop duplicates (a cell centre on the shared edge of two coplanar triangles is reported twice)
  let m = 0;
  for (let i = 0; i < n; i++) {
    if (m && kinds[m - 1] === kinds[i] && ys[i] - ys[m - 1] < 1e-4) continue;
    ys[m] = ys[i]; kinds[m++] = kinds[i];
  }
  n = m;
  let inside = 0, count = 0, last = -Infinity;
  for (let i = 0; i < n; i++) {
    const k = kinds[i];
    if (k === DOWN) { inside++; continue; }
    if (inside > 0) inside--;
    if (inside > 0 || k !== UP_WALK) continue;
    const f = ys[i];
    if (f - last < 0.05) continue; // coplanar duplicate
    // (b) clearance: anything between the floor and the head (incl. a solid's underside flush with it)
    let ok = true;
    for (let j = i - 1; j >= 0 && ys[j] >= f - 0.001; j--) if (kinds[j] === DOWN) { ok = false; break; }
    for (let j = i + 1; ok && j < n; j++) {
      const y = ys[j];
      if (y >= f + H) break;
      if (kinds[j] === DOWN ? y >= f - 0.02 : y > f + 0.02) { ok = false; break; }
    }
    if (!ok) continue;
    // (c) walls / steep faces within the capsule radius
    for (let b = 0; b < nb; b += 3) {
      if (blocks[b + 1] > f + stepUp + STAIR_SLOPE * blocks[b + 2] && blocks[b] < f + H) { ok = false; break; }
    }
    if (!ok) continue;
    last = f;
    out[count++] = f;
    if (count >= maxLevels) break;
  }
  return count;
}

/** Classify a triangle by its (unnormalized) normal. */
export function surfaceKind(nyUnit, walkNy) {
  if (nyUnit > 0) return nyUnit >= walkNy ? UP_WALK : UP_STEEP;
  return DOWN;
}

/**
 * Generator: yields progress in [0,1]; returns the grid.
 * pos: Float32Array triangle soup (x,y,z × 3 per triangle), world meters.
 * floorAt(x, z, fromY, far) -> y|null: walkable floor probe used to validate steep links (stairs vs ledges);
 *   defaults to makeFloorProbe(pos) (built lazily on the first steep link).
 * cfg: NAV_DEFAULTS + { x0, z0, nx, nz } (grid origin = min corner; cell (i,j) centre = x0+(i+.5)c, z0+(j+.5)c)
 *   + optional exclude: [[i0, j0, i1, j1], …] inclusive cell rectangles left empty (covered by a finer layer).
 */
export function* buildGrid(pos, cfgIn, floorAt = null) {
  const cfg = { ...NAV_DEFAULTS, ...cfgIn };
  const { x0, z0, nx, nz, cell, radius: R, walkNy, maxLevels: ML, tile: T, climbOrth } = cfg;
  const nTri = (pos.length / 9) | 0;
  const ntx = Math.ceil(nx / T), ntz = Math.ceil(nz / T), nTiles = ntx * ntz;
  const inv = 1 / cell;
  const t0 = now();
  let skip = null;
  if (cfg.exclude?.length) {
    skip = new Uint8Array(nx * nz);
    for (const [a0, b0, a1, b1] of cfg.exclude) {
      for (let j = Math.max(0, b0); j <= Math.min(nz - 1, b1); j++) skip.fill(1, j * nx + Math.max(0, a0), j * nx + Math.min(nx - 1, a1) + 1);
    }
  }

  // ---- pass 1/2: bucket triangles into tiles (bbox, dilated by R for steep ones) ----
  const tileCount = new Uint32Array(nTiles + 1);
  const triRange = (t, out) => {
    const o = t * 9;
    let minx = pos[o], maxx = minx, minz = pos[o + 2], maxz = minz;
    for (let v = 1; v < 3; v++) {
      const x = pos[o + v * 3], z = pos[o + v * 3 + 2];
      if (x < minx) minx = x; else if (x > maxx) maxx = x;
      if (z < minz) minz = z; else if (z > maxz) maxz = z;
    }
    minx -= R; maxx += R; minz -= R; maxz += R;
    const i0 = Math.max(0, Math.ceil((minx - x0) * inv - 0.5));
    const i1 = Math.min(nx - 1, Math.floor((maxx - x0) * inv - 0.5));
    const j0 = Math.max(0, Math.ceil((minz - z0) * inv - 0.5));
    const j1 = Math.min(nz - 1, Math.floor((maxz - z0) * inv - 0.5));
    if (i0 > i1 || j0 > j1) return false;
    out[0] = (i0 / T) | 0; out[1] = (i1 / T) | 0; out[2] = (j0 / T) | 0; out[3] = (j1 / T) | 0;
    return true;
  };
  const r4 = [0, 0, 0, 0];
  for (let t = 0; t < nTri; t++) {
    if (!triRange(t, r4)) continue;
    for (let b = r4[2]; b <= r4[3]; b++) for (let a = r4[0]; a <= r4[1]; a++) tileCount[b * ntx + a + 1]++;
  }
  for (let k = 0; k < nTiles; k++) tileCount[k + 1] += tileCount[k];
  const tileTris = new Uint32Array(tileCount[nTiles]);
  const fill = tileCount.slice(0, nTiles);
  for (let t = 0; t < nTri; t++) {
    if (!triRange(t, r4)) continue;
    for (let b = r4[2]; b <= r4[3]; b++) for (let a = r4[0]; a <= r4[1]; a++) tileTris[fill[b * ntx + a]++] = t;
  }
  yield 0.05;

  // ---- per-tile rasterization ----
  const cells = nx * nz;
  const lvCount = new Uint8Array(cells);
  const lvY = new Float32Array(cells * ML);
  let cap = 1 << 16;
  let eY0 = new Float32Array(cap), eY1 = new Float32Array(cap), eD = new Float32Array(cap);
  let eKind = new Uint8Array(cap), eNext = new Int32Array(cap);
  const head = new Int32Array(T * T);
  let ne = 0;
  const push = (local, y0, y1, kind, d) => {
    if (ne === cap) {
      cap *= 2;
      const a = new Float32Array(cap); a.set(eY0); eY0 = a;
      const b = new Float32Array(cap); b.set(eY1); eY1 = b;
      const g = new Float32Array(cap); g.set(eD); eD = g;
      const c = new Uint8Array(cap); c.set(eKind); eKind = c;
      const d = new Int32Array(cap); d.set(eNext); eNext = d;
    }
    eY0[ne] = y0; eY1[ne] = y1; eD[ne] = d; eKind[ne] = kind; eNext[ne] = head[local]; head[local] = ne++;
  };
  let sY = new Float32Array(64), sK = new Uint8Array(64), bl = new Float32Array(64);
  const outF = new Float32Array(ML);
  let entries = 0, tilesDone = 0, fullCells = 0; // fullCells: columns at maxLevels (a higher floor may be lost)

  for (let tb = 0; tb < ntz; tb++) {
    for (let ta = 0; ta < ntx; ta++) {
      const ti0 = ta * T, tj0 = tb * T;
      const ti1 = Math.min(nx, ti0 + T) - 1, tj1 = Math.min(nz, tj0 + T) - 1;
      head.fill(-1); ne = 0;
      const tk = tb * ntx + ta;
      for (let q = tileCount[tk], qe = tileCount[tk + 1]; q < qe; q++) {
        const o = tileTris[q] * 9;
        const ax = pos[o], ay = pos[o + 1], az = pos[o + 2];
        const bx = pos[o + 3], by = pos[o + 4], bz = pos[o + 5];
        const cx = pos[o + 6], cy = pos[o + 7], cz = pos[o + 8];
        const e1x = bx - ax, e1y = by - ay, e1z = bz - az, e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
        const nX = e1y * e2z - e1z * e2y, nY = e1z * e2x - e1x * e2z, nZ = e1x * e2y - e1y * e2x;
        const len = Math.hypot(nX, nY, nZ);
        if (len < 1e-12) continue;
        const ny = nY / len;
        const minx = Math.min(ax, bx, cx), maxx = Math.max(ax, bx, cx);
        const minz = Math.min(az, bz, cz), maxz = Math.max(az, bz, cz);
        if (Math.abs(ny) > 0.02) {
          // surface: cell centres inside the plan projection
          const i0 = Math.max(ti0, Math.ceil((minx - x0) * inv - 0.5)), i1 = Math.min(ti1, Math.floor((maxx - x0) * inv - 0.5));
          const j0 = Math.max(tj0, Math.ceil((minz - z0) * inv - 0.5)), j1 = Math.min(tj1, Math.floor((maxz - z0) * inv - 0.5));
          if (i0 <= i1 && j0 <= j1) {
            const kind = surfaceKind(ny, walkNy);
            // 2D barycentric (x,z): d = e1x*e2z - e2x*e1z  (= -nY)
            const d = e1x * e2z - e2x * e1z;
            const id = 1 / d, eps = 1e-6;
            for (let j = j0; j <= j1; j++) {
              const pz = z0 + (j + 0.5) * cell - az;
              for (let i = i0; i <= i1; i++) {
                const px = x0 + (i + 0.5) * cell - ax;
                const u = (px * e2z - e2x * pz) * id;
                const v = (e1x * pz - px * e1z) * id;
                if (u < -eps || v < -eps || u + v > 1 + eps) continue;
                const y = ay + u * e1y + v * e2y;
                push((j - tj0) * T + (i - ti0), y, y, kind, 0);
              }
            }
          }
        }
        if (Math.abs(ny) < walkNy) {
          // blocker: dilate by R in plan
          const i0 = Math.max(ti0, Math.ceil((minx - R - x0) * inv - 0.5)), i1 = Math.min(ti1, Math.floor((maxx + R - x0) * inv - 0.5));
          const j0 = Math.max(tj0, Math.ceil((minz - R - z0) * inv - 0.5)), j1 = Math.min(tj1, Math.floor((maxz + R - z0) * inv - 0.5));
          if (i0 <= i1 && j0 <= j1) {
            const ymin = Math.min(ay, by, cy), ymax = Math.max(ay, by, cy);
            const R2 = R * R;
            for (let j = j0; j <= j1; j++) {
              const pz = z0 + (j + 0.5) * cell;
              for (let i = i0; i <= i1; i++) {
                const px = x0 + (i + 0.5) * cell;
                const d2 = planDist2(px, pz, ax, az, bx, bz, cx, cz);
                if (d2 <= R2) push((j - tj0) * T + (i - ti0), ymin, ymax, BLOCK, Math.sqrt(d2));
              }
            }
          }
        }
      }
      entries += ne;
      // ---- resolve columns of this tile ----
      for (let j = tj0; j <= tj1; j++) {
        for (let i = ti0; i <= ti1; i++) {
          let e = head[(j - tj0) * T + (i - ti0)];
          if (e < 0 || (skip && skip[j * nx + i])) continue;
          let n = 0, nb = 0;
          for (; e >= 0; e = eNext[e]) {
            if (eKind[e] === BLOCK) {
              if (nb + 3 > bl.length) { const a = new Float32Array(bl.length * 2); a.set(bl); bl = a; }
              bl[nb++] = eY0[e]; bl[nb++] = eY1[e]; bl[nb++] = eD[e];
            } else {
              if (n === sY.length) {
                const a = new Float32Array(n * 2); a.set(sY); sY = a;
                const b = new Uint8Array(n * 2); b.set(sK); sK = b;
              }
              sY[n] = eY0[e]; sK[n++] = eKind[e];
            }
          }
          if (!n) continue;
          const c = j * nx + i;
          const k = columnFloors(sY, sK, n, bl, nb, cfg, outF);
          if (k === ML) fullCells++;
          lvCount[c] = k;
          for (let l = 0; l < k; l++) lvY[c * ML + l] = outF[l];
        }
      }
      tilesDone++;
      yield 0.05 + 0.8 * (tilesDone / nTiles);
    }
  }

  // ---- cracks (fine layers): a cell with no surface at all just under a level both of its opposite neighbours
  // stand on is a crack narrower than two cells (e.g. the 2 cm between a newel stair's top step and the round of the
  // hole it rises through) — a walker steps across it, so it gets a floor at that level ----
  let bridged = 0;
  if (cfg.bridge) {
    floorAt ||= makeFloorProbe(pos, cfg);
    const H = cfg.height, add = [];
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const c = j * nx + i;
        if ((skip && skip[c]) || lvCount[c] >= ML) continue;
        for (let ax = 0; ax < 2; ax++) {
          const da = ax ? nx : 1;
          if (ax ? (j === 0 || j === nz - 1) : (i === 0 || i === nx - 1)) continue;
          const pa = c - da, pb = c + da;
          for (let la = 0; la < lvCount[pa]; la++) {
            const y = lvY[pa * ML + la];
            let yb = NaN;
            for (let lb = 0; lb < lvCount[pb]; lb++) if (Math.abs(lvY[pb * ML + lb] - y) <= 0.03) { yb = lvY[pb * ML + lb]; break; }
            if (yb !== yb) continue;
            let clash = false;
            for (let l = 0; l < lvCount[c]; l++) { const d = lvY[c * ML + l] - y; if (d > -0.7 && d < H) { clash = true; break; } }
            if (clash || floorAt(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell, y + 0.03, 0.3) !== null) continue;
            add.push(c, (y + yb) / 2);
          }
        }
      }
      if ((j & 63) === 63) yield 0.86;
    }
    for (let q = 0; q < add.length; q += 2) {
      const c = add[q], y = add[q + 1];
      let n = lvCount[c], dup = false;
      for (let l = 0; l < n; l++) if (Math.abs(lvY[c * ML + l] - y) < 0.05) { dup = true; break; }
      if (dup || n >= ML) continue;
      let l = n;
      while (l > 0 && lvY[c * ML + l - 1] > y) { lvY[c * ML + l] = lvY[c * ML + l - 1]; l--; }
      lvY[c * ML + l] = y;
      lvCount[c] = n + 1;
      bridged++;
    }
  }

  // ---- compact into nodes ----
  const nodeStart = new Uint32Array(cells + 1);
  let nNodes = 0;
  for (let c = 0; c < cells; c++) { nodeStart[c] = nNodes; nNodes += lvCount[c]; }
  nodeStart[cells] = nNodes;
  const nodeY = new Float32Array(nNodes), nodeCell = new Uint32Array(nNodes);
  for (let c = 0; c < cells; c++) {
    const s = nodeStart[c];
    for (let l = 0; l < lvCount[c]; l++) { nodeY[s + l] = lvY[c * ML + l]; nodeCell[s + l] = c; }
  }
  const tRaster = now();
  yield 0.9;

  // ---- links: 8 direction bits per node (step height, stairs probe, corner rule) ----
  const near = (c, y, tol) => {
    let best = -1, bd = tol;
    for (let k = nodeStart[c], e = nodeStart[c + 1]; k < e; k++) {
      const d = Math.abs(nodeY[k] - y);
      if (d <= bd) { bd = d; best = k; }
    }
    return best;
  };
  const links = new Uint8Array(nNodes);
  const { stepUp } = cfg;
  let probes = 0;
  const stairOK = (ka, kb) => {
    floorAt ||= makeFloorProbe(pos, cfg);
    const ca = nodeCell[ka], cb = nodeCell[kb];
    const ax = x0 + (ca % nx + 0.5) * cell, az = z0 + (((ca / nx) | 0) + 0.5) * cell;
    const bx = x0 + (cb % nx + 0.5) * cell, bz = z0 + (((cb / nx) | 0) + 0.5) * cell;
    const ya = nodeY[ka], yb = nodeY[kb], top = Math.max(ya, yb) + 0.3;
    let prev = ya;
    for (let s = 1; s <= 3; s++) {
      const t = s / 4;
      const y = floorAt(ax + (bx - ax) * t, az + (bz - az) * t, top, 3);
      probes++;
      if (y == null || Math.abs(y - prev) > stepUp + 0.03) return false;
      prev = y;
    }
    return Math.abs(yb - prev) <= stepUp + 0.03;
  };
  // components (pa) and block-local components (pb) are united while the links are made
  const B = cfg.block || 8;
  const pa = new Int32Array(nNodes), pb = new Int32Array(nNodes);
  for (let k = 0; k < nNodes; k++) { pa[k] = k; pb[k] = k; }
  const find = (p, a) => { while (p[a] !== a) { p[a] = p[p[a]]; a = p[a]; } return a; };
  const unite = (p, a, b) => { const ra = find(p, a), rb = find(p, b); if (ra !== rb) p[ra] = rb; };
  let crossA = new Int32Array(1 << 16), crossB = new Int32Array(1 << 16), nCross = 0;
  for (let c = 0; c < cells; c++) {
    const ks = nodeStart[c], ke = nodeStart[c + 1];
    if (ks === ke) continue;
    const i = c % nx, j = (c / nx) | 0;
    for (let k = ks; k < ke; k++) {
      const ya = nodeY[k];
      for (let f = 0; f < 4; f++) {
        const d = FORWARD[f];
        const di = DIRS[d * 2], dj = DIRS[d * 2 + 1];
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        const diag = di !== 0 && dj !== 0;
        const tol = diag ? climbOrth * Math.SQRT2 : climbOrth;
        const b = near(nj * nx + ni, ya, tol);
        if (b < 0) continue;
        const yb = nodeY[b];
        if (diag) {
          const ym = (ya + yb) / 2;
          if (near(c + di, ym, climbOrth) < 0 || near(c + dj * nx, ym, climbOrth) < 0) continue;
        }
        if (Math.abs(yb - ya) > 0.4 && !stairOK(k, b)) continue;
        links[k] |= 1 << d;
        // reverse link only when the way back resolves to this very node (levels can be 1.75 m apart)
        if (near(c, yb, tol) === k) links[b] |= 1 << OPP[d];
        unite(pa, k, b);
        if (((i / B) | 0) === ((ni / B) | 0) && ((j / B) | 0) === ((nj / B) | 0)) unite(pb, k, b);
        else {
          if (nCross === crossA.length) {
            const a2 = new Int32Array(nCross * 2); a2.set(crossA); crossA = a2;
            const b2 = new Int32Array(nCross * 2); b2.set(crossB); crossB = b2;
          }
          crossA[nCross] = k; crossB[nCross++] = b;
        }
      }
    }
    if ((c & 0x3fff) === 0) yield 0.9 + 0.07 * (c / cells);
  }
  const tLinks = now();
  // near an edge or wall: some neighbour unreachable
  const nodeFlags = new Uint8Array(nNodes);
  for (let k = 0; k < nNodes; k++) if (links[k] !== 0xff) nodeFlags[k] |= FLAG_NEAR_EDGE;

  // ---- exact connected components + coarse graph (B×B-cell blocks split into local components) ----
  const comp = new Int32Array(nNodes), coarseOf = new Int32Array(nNodes);
  const labA = new Int32Array(nNodes).fill(-1), labB = new Int32Array(nNodes).fill(-1);
  let nComp = 0, nC = 0;
  for (let k = 0; k < nNodes; k++) {
    const ra = find(pa, k), rb = find(pb, k);
    if (labA[ra] < 0) labA[ra] = nComp++;
    if (labB[rb] < 0) labB[rb] = nC++;
    comp[k] = labA[ra];
    coarseOf[k] = labB[rb];
    if ((k & 0xffff) === 0xffff) yield 0.97;
  }
  const sx = new Float64Array(nC), sy = new Float64Array(nC), sz = new Float64Array(nC), cnt = new Uint32Array(nC);
  for (let k = 0; k < nNodes; k++) {
    const c = nodeCell[k], q = coarseOf[k];
    sx[q] += x0 + (c % nx + 0.5) * cell; sz[q] += z0 + (((c / nx) | 0) + 0.5) * cell; sy[q] += nodeY[k]; cnt[q]++;
    if ((k & 0xffff) === 0xffff) yield 0.98;
  }
  const cx = new Float32Array(nC), cy = new Float32Array(nC), cz = new Float32Array(nC);
  for (let q = 0; q < nC; q++) { cx[q] = sx[q] / cnt[q]; cy[q] = sy[q] / cnt[q]; cz[q] = sz[q] / cnt[q]; }
  const pairs = new Set();
  for (let e = 0; e < nCross; e++) {
    const qa = coarseOf[crossA[e]], qb = coarseOf[crossB[e]];
    if (qa !== qb) pairs.add(qa < qb ? qa * nC + qb : qb * nC + qa);
  }
  const deg = new Uint32Array(nC + 1);
  for (const key of pairs) { deg[Math.floor(key / nC) + 1]++; deg[key % nC + 1]++; }
  for (let q = 0; q < nC; q++) deg[q + 1] += deg[q];
  const cAdj = new Int32Array(deg[nC]), cW = new Float32Array(deg[nC]), fillC = deg.slice(0, nC);
  for (const key of pairs) {
    const a = Math.floor(key / nC), b = key % nC;
    const w = Math.hypot(cx[a] - cx[b], cz[a] - cz[b]) + Math.abs(cy[a] - cy[b]) * 0.8;
    cAdj[fillC[a]] = b; cW[fillC[a]++] = w;
    cAdj[fillC[b]] = a; cW[fillC[b]++] = w;
  }
  yield 1;
  return {
    nodeStart, nodeY, nodeCell, nodeFlags, comp, links, coarseOf,
    coarse: { n: nC, cx, cy, cz, off: deg, adj: cAdj, w: cW },
    stats: {
      nx, nz, cells, nodes: nNodes, components: nComp, coarseNodes: nC, coarseEdges: pairs.size, triangles: nTri,
      entries, tiles: nTiles, stairProbes: probes, bridged, fullCells, ms: Math.round(now() - t0),
      rasterMs: Math.round(tRaster - t0), linkMs: Math.round(tLinks - tRaster), graphMs: Math.round(now() - tLinks),
    },
  };
}

/** Transferable buffers of a buildGrid result. */
export function gridTransfer(res) {
  const c = res.coarse;
  return [res.nodeStart, res.nodeY, res.nodeCell, res.nodeFlags, res.comp, res.links, res.coarseOf,
    c.cx, c.cy, c.cz, c.off, c.adj, c.w].map((a) => a.buffer);
}

function now() { return globalThis.performance?.now?.() ?? Date.now(); }

/**
 * Floor probe over the triangle soup without a BVH: walkable (up-facing) triangles bucketed on a 2 m plan
 * grid. probe(x, z, top, far) -> highest walkable surface y in [top - far, top] at (x, z), or null —
 * the same answer as a downward ray that skips non-walkable hits.
 */
export function makeFloorProbe(pos, cfgIn) {
  const { x0, z0, nx, nz, cell, walkNy } = { ...NAV_DEFAULTS, ...cfgIn };
  const BK = 2, inv = 1 / BK;
  const bx = Math.ceil((nx * cell) / BK), bz = Math.ceil((nz * cell) / BK);
  const nTri = (pos.length / 9) | 0;
  const count = new Uint32Array(bx * bz + 1);
  const range = (o, out) => {
    const minx = Math.min(pos[o], pos[o + 3], pos[o + 6]), maxx = Math.max(pos[o], pos[o + 3], pos[o + 6]);
    const minz = Math.min(pos[o + 2], pos[o + 5], pos[o + 8]), maxz = Math.max(pos[o + 2], pos[o + 5], pos[o + 8]);
    out[0] = Math.max(0, Math.floor((minx - x0) * inv)); out[1] = Math.min(bx - 1, Math.floor((maxx - x0) * inv));
    out[2] = Math.max(0, Math.floor((minz - z0) * inv)); out[3] = Math.min(bz - 1, Math.floor((maxz - z0) * inv));
    return out[0] <= out[1] && out[2] <= out[3];
  };
  const walk = new Uint8Array(nTri);
  const r = [0, 0, 0, 0];
  for (let t = 0; t < nTri; t++) {
    const o = t * 9;
    const e1x = pos[o + 3] - pos[o], e1y = pos[o + 4] - pos[o + 1], e1z = pos[o + 5] - pos[o + 2];
    const e2x = pos[o + 6] - pos[o], e2y = pos[o + 7] - pos[o + 1], e2z = pos[o + 8] - pos[o + 2];
    const nX = e1y * e2z - e1z * e2y, nY = e1z * e2x - e1x * e2z, nZ = e1x * e2y - e1y * e2x;
    const len = Math.hypot(nX, nY, nZ);
    if (!(len > 1e-12) || nY / len < walkNy || !range(o, r)) continue;
    walk[t] = 1;
    for (let j = r[2]; j <= r[3]; j++) for (let i = r[0]; i <= r[1]; i++) count[j * bx + i + 1]++;
  }
  for (let k = 0; k < bx * bz; k++) count[k + 1] += count[k];
  const list = new Uint32Array(count[bx * bz]);
  const fill = count.slice(0, bx * bz);
  for (let t = 0; t < nTri; t++) {
    if (!walk[t] || !range(t * 9, r)) continue;
    for (let j = r[2]; j <= r[3]; j++) for (let i = r[0]; i <= r[1]; i++) list[fill[j * bx + i]++] = t;
  }
  return (x, z, top, far) => {
    const i = Math.floor((x - x0) * inv), j = Math.floor((z - z0) * inv);
    if (i < 0 || j < 0 || i >= bx || j >= bz) return null;
    const lo = top - far;
    let best = -Infinity;
    for (let e = count[j * bx + i], ee = count[j * bx + i + 1]; e < ee; e++) {
      const o = list[e] * 9;
      const ax = pos[o], az = pos[o + 2];
      const e1x = pos[o + 3] - ax, e1z = pos[o + 5] - az, e2x = pos[o + 6] - ax, e2z = pos[o + 8] - az;
      const d = e1x * e2z - e2x * e1z;
      if (d === 0) continue;
      const px = x - ax, pz = z - az;
      const u = (px * e2z - e2x * pz) / d, v = (e1x * pz - px * e1z) / d;
      if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) continue;
      const y = pos[o + 1] + u * (pos[o + 4] - pos[o + 1]) + v * (pos[o + 7] - pos[o + 1]);
      if (y <= top && y >= lo && y > best) best = y;
    }
    return best === -Infinity ? null : best;
  };
}

/** squared plan distance from point (px,pz) to triangle (a,b,c) projected on x/z */
function planDist2(px, pz, ax, az, bx, bz, cx, cz) {
  // inside test (works for either winding); degenerate (vertical) triangles fall through to edges
  const d1 = (bx - ax) * (pz - az) - (bz - az) * (px - ax);
  const d2 = (cx - bx) * (pz - bz) - (cz - bz) * (px - bx);
  const d3 = (ax - cx) * (pz - cz) - (az - cz) * (px - cx);
  const area = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
  if (Math.abs(area) > 1e-9 && ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0))) return 0;
  return Math.min(segDist2(px, pz, ax, az, bx, bz), segDist2(px, pz, bx, bz, cx, cz), segDist2(px, pz, cx, cz, ax, az));
}

function segDist2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz;
  let t = l2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px, qz = az + t * dz - pz;
  return qx * qx + qz * qz;
}

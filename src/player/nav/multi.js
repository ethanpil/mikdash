// Multi-resolution nav: several walkability grids (layers) stitched into one graph — pure JS, runs in the Worker.
//
//   layer 0  'main'   0.5 m cells over the Mount and its surroundings (as before)
//   patches  'fine'   ~4 cm cells over small regions the main grid cannot resolve: newel stairs (a 7–12 cm band
//                     between the newel and the shaft is all a 0.3 m capsule has), turret doorways
//   'outer'           2 m cells over the far ground the UI can send the observer to (Kidron, causeway, Har HaMishchah)
// A finer layer's rectangle is aligned to its parent's cells and those parent cells are left empty (cfg.exclude), so
// every place belongs to exactly one layer. Stitches link a parent node in the ring of cells round a child's
// rectangle to the child nodes along the shared edge (same floor within a step, floor continuity probed between).
// Components and the coarse guidance graph are made global (per-layer labels mapped through the stitches).
import { buildGrid, makeFloorProbe, NAV_DEFAULTS, DIRS } from './grid-build.js';

/**
 * specs: [{ name, x0, z0, nx, nz, cell, parent (index of the coarser layer it is cut out of; -1 for roots), clip?,
 *           maxLevels?, block?, climbOrth?, exclude? }]  (parents before children)
 * Generator: yields progress in [0, 1]; returns { layers: [grid result + spec fields], stitch, coarse, stats }.
 */
export function* buildNav(pos, specs) {
  const t0 = now();
  const layers = [];
  const W = specs.map((s) => s.nx * s.nz);
  const Wsum = W.reduce((a, b) => a + b, 0) || 1;
  let done = 0;
  for (let li = 0; li < specs.length; li++) {
    const s = { ...NAV_DEFAULTS, ...specs[li] };
    const soup = s.clip ? clipSoup(pos, s, s.radius + 1.5) : pos;
    // the floor probe also covers a 1.5 m margin round the layer: stitches probe between the layers
    const pm = Math.ceil(1.5 / s.cell);
    const probe = makeFloorProbe(soup, { ...s, x0: s.x0 - pm * s.cell, z0: s.z0 - pm * s.cell, nx: s.nx + 2 * pm, nz: s.nz + 2 * pm });
    const gen = buildGrid(soup, s, probe);
    let r;
    while (!(r = gen.next()).done) yield 0.92 * (done + r.value * W[li]) / Wsum;
    done += W[li];
    const L = r.value;
    Object.assign(L, { spec: s, probe, soupTris: soup.length / 9 });
    layers.push(L);
  }
  // node offsets (global ids)
  let off = 0;
  for (const L of layers) { L.off = off; off += L.nodeY.length; }
  const total = off;
  // ---- stitches ----
  const sa = [], sb = [], sw = [];
  for (let li = 0; li < layers.length; li++) {
    const F = layers[li];
    if (!(F.spec.parent >= 0)) continue;
    stitch(layers[F.spec.parent], F, sa, sb, sw);
  }
  yield 0.95;
  // flag stitched nodes; CSR sorted by global node id (both directions)
  const nS = sa.length;
  const keys = new Float64Array(2 * nS);
  for (let e = 0; e < nS; e++) { keys[2 * e] = sa[e] * 4294967296 + e * 2; keys[2 * e + 1] = sb[e] * 4294967296 + e * 2 + 1; }
  keys.sort();
  const stNodeL = [], stOff = [], stTo = new Int32Array(2 * nS), stW = new Float32Array(2 * nS);
  for (let q = 0; q < keys.length; q++) {
    const node = Math.floor(keys[q] / 4294967296), ee = keys[q] - node * 4294967296, e = ee >> 1;
    if (!stNodeL.length || stNodeL[stNodeL.length - 1] !== node) { stNodeL.push(node); stOff.push(q); }
    stTo[q] = ee & 1 ? sa[e] : sb[e];
    stW[q] = sw[e];
  }
  stOff.push(keys.length);
  for (const node of stNodeL) {
    const L = layerOf(layers, node);
    L.nodeFlags[node - L.off] |= FLAG_STITCH;
  }
  // ---- global components ----
  let cOff = 0;
  for (const L of layers) { L.compOff = cOff; cOff += L.stats.components; }
  const uf = new Int32Array(cOff);
  for (let k = 0; k < cOff; k++) uf[k] = k;
  const find = (a) => { while (uf[a] !== a) { uf[a] = uf[uf[a]]; a = uf[a]; } return a; };
  const gcomp = (g) => { const L = layerOf(layers, g); return L.compOff + L.comp[g - L.off]; };
  for (let e = 0; e < nS; e++) { const ra = find(gcomp(sa[e])), rb = find(gcomp(sb[e])); if (ra !== rb) uf[ra] = rb; }
  const lab = new Int32Array(cOff).fill(-1);
  let nComp = 0;
  for (const L of layers) {
    L.compMap = new Int32Array(L.stats.components);
    for (let c = 0; c < L.compMap.length; c++) {
      const r = find(L.compOff + c);
      if (lab[r] < 0) lab[r] = nComp++;
      L.compMap[c] = lab[r];
    }
  }
  // ---- global coarse graph (each layer's block components + stitched pairs) ----
  let qOff = 0;
  for (const L of layers) { L.coarseOff = qOff; qOff += L.coarse.n; }
  const cx = new Float32Array(qOff), cy = new Float32Array(qOff), cz = new Float32Array(qOff);
  const pairs = new Map();
  for (const L of layers) {
    const c = L.coarse, o = L.coarseOff;
    cx.set(c.cx, o); cy.set(c.cy, o); cz.set(c.cz, o);
    for (let q = 0; q < c.n; q++) for (let e = c.off[q]; e < c.off[q + 1]; e++) if (c.adj[e] > q) pairs.set((q + o) * qOff + c.adj[e] + o, c.w[e]);
  }
  const gq = (g) => { const L = layerOf(layers, g); return L.coarseOff + L.coarseOf[g - L.off]; };
  for (let e = 0; e < nS; e++) {
    let a = gq(sa[e]), b = gq(sb[e]);
    if (a === b) continue;
    if (a > b) { const t = a; a = b; b = t; }
    const key = a * qOff + b;
    if (!pairs.has(key)) pairs.set(key, Math.hypot(cx[a] - cx[b], cz[a] - cz[b]) + Math.abs(cy[a] - cy[b]) * 0.8);
  }
  const deg = new Uint32Array(qOff + 1);
  for (const key of pairs.keys()) { deg[Math.floor(key / qOff) + 1]++; deg[key % qOff + 1]++; }
  for (let q = 0; q < qOff; q++) deg[q + 1] += deg[q];
  const adj = new Int32Array(deg[qOff]), w = new Float32Array(deg[qOff]), fill = deg.slice(0, qOff);
  for (const [key, wt] of pairs) {
    const a = Math.floor(key / qOff), b = key % qOff;
    adj[fill[a]] = b; w[fill[a]++] = wt;
    adj[fill[b]] = a; w[fill[b]++] = wt;
  }
  yield 1;
  // per-node labels as 16 bits when they fit (they nearly always do: ~10² components, ~10⁴ blocks per layer)
  const small = (a, n) => (n <= 65535 ? new Uint16Array(a) : a);
  const out = layers.map((L) => ({
    name: L.spec.name, x0: L.spec.x0, z0: L.spec.z0, nx: L.spec.nx, nz: L.spec.nz, cell: L.spec.cell,
    climbOrth: L.spec.climbOrth, block: L.spec.block || 8, parent: L.spec.parent ?? -1,
    off: L.off, coarseOff: L.coarseOff,
    nodeStart: L.nodeStart, nodeY: L.nodeY, nodeCell: L.nodeCell, nodeFlags: L.nodeFlags, comp: small(L.comp, L.stats.components), compMap: L.compMap,
    links: L.links, coarseOf: small(L.coarseOf, L.coarse.n),
    stats: { ...L.stats, soupTris: L.soupTris },
  }));
  return {
    layers: out,
    stitch: { node: Int32Array.from(stNodeL), off: Int32Array.from(stOff), to: stTo, w: stW },
    coarse: { n: qOff, cx, cy, cz, off: deg, adj, w },
    stats: {
      layers: out.length, nodes: total, components: nComp, stitches: nS, coarseNodes: qOff, coarseEdges: pairs.size,
      cells: out.reduce((s, L) => s + L.nx * L.nz, 0), ms: Math.round(now() - t0),
      perLayer: out.map((L) => `${L.name} ${L.cell.toFixed(3)}m ${L.nx}x${L.nz} ${L.nodeY.length}n ${L.stats.ms}ms`),
    },
  };
}

/** stitched nodes carry this flag in nodeFlags (FLAG_NEAR_EDGE is 1) */
export const FLAG_STITCH = 2;

export function navTransfer(res) {
  const t = [];
  for (const L of res.layers) t.push(L.nodeStart, L.nodeY, L.nodeCell, L.nodeFlags, L.comp, L.compMap, L.links, L.coarseOf);
  t.push(res.stitch.node, res.stitch.off, res.stitch.to, res.stitch.w, res.coarse.cx, res.coarse.cy, res.coarse.cz, res.coarse.off, res.coarse.adj, res.coarse.w);
  return t.map((a) => a.buffer);
}

function layerOf(layers, g) {
  for (let i = layers.length - 1; i >= 0; i--) if (g >= layers[i].off) return layers[i];
  return layers[0];
}

/** triangles whose plan bbox meets the layer's rectangle grown by m (a compact copy) */
function clipSoup(pos, s, m) {
  const xa = s.x0 - m, xb = s.x0 + s.nx * s.cell + m, za = s.z0 - m, zb = s.z0 + s.nz * s.cell + m;
  const n = pos.length / 9;
  const keep = new Int32Array(n);
  let nk = 0;
  for (let t = 0; t < n; t++) {
    const o = t * 9;
    const minx = Math.min(pos[o], pos[o + 3], pos[o + 6]), maxx = Math.max(pos[o], pos[o + 3], pos[o + 6]);
    if (maxx < xa || minx > xb) continue;
    const minz = Math.min(pos[o + 2], pos[o + 5], pos[o + 8]), maxz = Math.max(pos[o + 2], pos[o + 5], pos[o + 8]);
    if (maxz < za || minz > zb) continue;
    keep[nk++] = t;
  }
  const out = new Float32Array(nk * 9);
  for (let k = 0; k < nk; k++) out.set(pos.subarray(keep[k] * 9, keep[k] * 9 + 9), k * 9);
  return out;
}

/**
 * Link the parent C to its child F along F's rectangle (aligned to C's cells, ratio r = C.cell / F.cell).
 * Each C node in the ring round the rectangle links to, per neighbouring child cell along the shared edge, the
 * child node of nearest height: within a step (+ the slope allowance over the distance), the floor between them
 * continuous in two probes (F's probe, built over F's clipped soup and margin).
 */
function stitch(C, F, sa, sb, sw) {
  const cs = C.spec, fs = F.spec;
  const r = Math.round(cs.cell / fs.cell);
  const ci0 = Math.round((fs.x0 - cs.x0) / cs.cell), cj0 = Math.round((fs.z0 - cs.z0) / cs.cell);
  const ci1 = ci0 + Math.round(fs.nx / r) - 1, cj1 = cj0 + Math.round(fs.nz / r) - 1;
  const stepUp = cs.stepUp, probe = cs.cell > fs.cell * 1.5 && F.probe ? F.probe : C.probe;
  const inside = (i, j) => i >= ci0 && i <= ci1 && j >= cj0 && j <= cj1;
  for (let cj = cj0 - 1; cj <= cj1 + 1; cj++) {
    for (let ci = ci0 - 1; ci <= ci1 + 1; ci++) {
      if (inside(ci, cj) || ci < 0 || cj < 0 || ci >= cs.nx || cj >= cs.nz) continue;
      const c = cj * cs.nx + ci;
      const ax = cs.x0 + (ci + 0.5) * cs.cell, az = cs.z0 + (cj + 0.5) * cs.cell;
      for (let a = C.nodeStart[c]; a < C.nodeStart[c + 1]; a++) {
        const ya = C.nodeY[a];
        for (let d = 0; d < 8; d++) {
          const di = DIRS[2 * d], dj = DIRS[2 * d + 1];
          const ni = ci + di, nj = cj + dj;
          if (!inside(ni, nj)) continue;
          // diagonal: only where the two orthogonal neighbours are both outside (the corner of the rectangle)
          if (di && dj && (inside(ci + di, cj) || inside(ci, cj + dj))) continue;
          const fi0 = (ni - ci0) * r, fj0 = (nj - cj0) * r;
          const iLo = di > 0 ? fi0 : di < 0 ? fi0 + r - 1 : fi0, iHi = di > 0 ? fi0 : di < 0 ? fi0 + r - 1 : fi0 + r - 1;
          const jLo = dj > 0 ? fj0 : dj < 0 ? fj0 + r - 1 : fj0, jHi = dj > 0 ? fj0 : dj < 0 ? fj0 + r - 1 : fj0 + r - 1;
          for (let fj = jLo; fj <= jHi; fj++) {
            for (let fi = iLo; fi <= iHi; fi++) {
              const fc = fj * fs.nx + fi;
              let b = -1, bd = Infinity;
              for (let k = F.nodeStart[fc]; k < F.nodeStart[fc + 1]; k++) {
                const dd = Math.abs(F.nodeY[k] - ya);
                if (dd < bd) { bd = dd; b = k; }
              }
              if (b < 0) continue;
              const bx = fs.x0 + (fi + 0.5) * fs.cell, bz = fs.z0 + (fj + 0.5) * fs.cell, yb = F.nodeY[b];
              const dist = Math.hypot(bx - ax, bz - az);
              if (bd > stepUp + 0.05 + dist) continue; // ≤ 45° plus one step
              let prev = ya, ok = true;
              const top = Math.max(ya, yb) + 0.3;
              for (const t of [1 / 3, 2 / 3]) {
                const y = probe(ax + (bx - ax) * t, az + (bz - az) * t, top, 3);
                if (y == null || Math.abs(y - prev) > stepUp + 0.03) { ok = false; break; }
                prev = y;
              }
              if (!ok || Math.abs(yb - prev) > stepUp + 0.03) continue;
              sa.push(C.off + a); sb.push(F.off + b); sw.push(dist);
            }
          }
        }
      }
    }
  }
}

function now() { return globalThis.performance?.now?.() ?? Date.now(); }

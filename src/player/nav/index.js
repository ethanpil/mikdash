// Navigation: multi-level walkability grid (built off-thread from the collider soup) + A* + string pulling.
// ctx.nav = { findPath(fromWorld, toWorld) -> Vector3[] | null, ready: Promise, nearest(p), landing(p, goal),
//             floorsAt(x,z), rebuild(), stats, lastQueryMs }
// Long routes: a coarse graph (local components of 8×8-cell blocks, built with the grid) is searched
// with Dijkstra from the goal at query time; its distances steer the fine A* along the right corridor
// (gates, stairs) instead of flooding the open Mount.
import { Vector3, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, Line, LineBasicMaterial } from 'three';
import { NAV_DEFAULTS, FLAG_NEAR_EDGE, DIRS, buildGrid } from './grid-build.js';
import { AMAH } from '../../core/units.js';

/** Site extent covered by the grid, amot (incl. ground outside the Mount walls). */
const SITE_EXTENT = { min: [-150, -150], max: [650, 650] };
const SQRT2 = Math.SQRT2;

export function createNav(ctx, physics) {
  const cfgBase = { ...NAV_DEFAULTS };
  let grid = null; // NavGrid
  let resolveReady;
  let settled = false;
  let buildToken = 0;
  let worker = null;

  const nav = {
    ready: null,
    stats: null,
    lastQueryMs: 0,
    lastExpanded: 0,
    /** World-space path (feet points) from → to, or null (unreachable / not built yet). */
    findPath(from, to) {
      if (!grid) return null;
      const t0 = performance.now();
      const p = grid.findPath(from, to);
      nav.lastQueryMs = performance.now() - t0;
      nav.lastExpanded = grid.lastExpanded;
      if (p && debugOn) drawPath(p);
      return p;
    },
    /** Nearest walkable point (world) to p, searching up to `radius` m. */
    nearest(p, radius = 4) {
      if (!grid) return null;
      const n = grid.nearestNode(p.x, p.y, p.z, Math.ceil(radius / grid.cell), -1);
      return n < 0 ? null : grid.nodePos(n, new Vector3());
    },
    /**
     * Where a flier at p comes down before walking to `goal`: the nearest walkable point within `radius` m
     * that is connected to the walkable area at goal, not above p, and open straight up to p's height (the
     * descent never passes through a roof or floor). Vector3 | null.
     */
    landing(p, goal, radius = 16) {
      if (!grid) return null;
      const t = grid.nearestNode(goal.x, goal.y, goal.z, Math.ceil(8 / grid.cell), -1);
      if (t < 0) return null;
      const v = new Vector3();
      const clear = (k) => {
        grid.nodePos(k, v);
        if (v.y > p.y + 0.3) return false;
        const top = physics.floorAt(v.x, v.z, p.y + 0.1, 0.02);
        return top === null || top < v.y + 0.1;
      };
      const n = grid.nearestNode(p.x, p.y, p.z, Math.ceil(radius / grid.cell), grid.comp[t], clear);
      return n < 0 ? null : grid.nodePos(n, new Vector3());
    },
    /** Floor heights of the grid cell containing (x, z). */
    floorsAt(x, z) { return grid ? grid.floorsAt(x, z) : []; },
    get grid() { return grid; },
    get isReady() { return !!grid; },
    rebuild() { return start(); },
  };

  function newReady() {
    settled = false;
    nav.ready = new Promise((r) => { resolveReady = (v) => { settled = true; r(v); }; });
    return nav.ready;
  }
  newReady();

  function gridConfig() {
    const b = physics.bounds;
    const x0 = Math.max(SITE_EXTENT.min[0] * AMAH, b.min.x - 2);
    const x1 = Math.min(SITE_EXTENT.max[0] * AMAH, b.max.x + 2);
    const z0 = Math.max(-SITE_EXTENT.max[1] * AMAH, b.min.z - 2);
    const z1 = Math.min(-SITE_EXTENT.min[1] * AMAH, b.max.z + 2);
    const cell = cfgBase.cell;
    if (!(x1 > x0 && z1 > z0)) return null;
    return { ...cfgBase, x0, z0, nx: Math.ceil((x1 - x0) / cell), nz: Math.ceil((z1 - z0) / cell) };
  }

  /** Build (or rebuild) the grid. Resolves nav.ready with the stats. */
  function start() {
    const token = ++buildToken;
    if (grid || settled) { grid = null; newReady(); }
    const ready = nav.ready;
    const cfg = physics.soup && physics.soup.length ? gridConfig() : null;
    if (!cfg) { nav.stats = { error: 'no colliders' }; resolveReady(nav.stats); return ready; }
    const t0 = performance.now();
    const done = (res, how) => {
      if (token !== buildToken) return;
      grid = new NavGrid(res, cfg, physics);
      nav.stats = { ...res.stats, totalMs: Math.round(performance.now() - t0), how, physicsVersion: physics.version };
      if (debugOn) drawGrid();
      resolveReady(nav.stats);
    };
    const fallback = () => runSliced(buildGrid(physics.soup, cfg), token, (res) => done(res, 'main-thread'));
    let w = null;
    try {
      w = new Worker(new URL('./nav.worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      console.warn('[nav] worker unavailable, building on the main thread', e);
    }
    if (!w) { fallback(); return ready; }
    worker?.terminate();
    worker = w;
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'done') { w.terminate(); if (worker === w) worker = null; done(m.res, 'worker'); }
      else if (m.type === 'error') {
        console.warn('[nav] worker failed, building on the main thread:', m.message);
        w.terminate(); if (worker === w) worker = null;
        fallback();
      }
    };
    w.onerror = (e) => {
      e.preventDefault?.();
      console.warn('[nav] worker error, building on the main thread', e.message || e);
      w.terminate(); if (worker === w) worker = null;
      fallback();
    };
    // one copy, transferred (not cloned again): physics keeps its soup for the BVH and the main-thread fallback
    const positions = physics.soup.slice();
    w.postMessage({ positions, cfg }, [positions.buffer]);
    return ready;
  }

  function runSliced(gen, token, onDone) {
    const step = () => {
      if (token !== buildToken) return;
      const t = performance.now();
      let r;
      while (!(r = gen.next()).done) if (performance.now() - t > 6) break;
      if (r.done) onDone(r.value);
      else setTimeout(step, 0);
    };
    setTimeout(step, 0);
  }

  // ---- debug overlay (?debug=nav): walkable nodes as points + last path ----
  const debugOn = !!ctx.params?.debug?.has?.('nav');
  let dbgPoints = null, dbgPath = null;
  function drawGrid() {
    if (!grid) return;
    if (dbgPoints) { ctx.scene.remove(dbgPoints); dbgPoints.geometry.dispose(); }
    const n = grid.nodeY.length;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const v = new Vector3();
    for (let k = 0; k < n; k++) {
      grid.nodePos(k, v);
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y + 0.04; pos[k * 3 + 2] = v.z;
      const edge = grid.nodeFlags[k] & FLAG_NEAR_EDGE;
      const lvl = k - grid.nodeStart[grid.nodeCell[k]];
      col[k * 3] = edge ? 1 : lvl ? 0.3 : 0.2;
      col[k * 3 + 1] = edge ? 0.75 : lvl ? 0.5 : 0.9;
      col[k * 3 + 2] = edge ? 0.1 : lvl ? 1 : 0.3;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new Float32BufferAttribute(col, 3));
    dbgPoints = new Points(g, new PointsMaterial({ size: 3, sizeAttenuation: false, vertexColors: true, depthWrite: false, toneMapped: false }));
    dbgPoints.name = 'nav-debug';
    dbgPoints.frustumCulled = false;
    ctx.scene.add(dbgPoints);
  }
  function drawPath(path) {
    if (dbgPath) { ctx.scene.remove(dbgPath); dbgPath.geometry.dispose(); }
    const g = new BufferGeometry().setFromPoints(path.map((p) => p.clone().setY(p.y + 0.15)));
    dbgPath = new Line(g, new LineBasicMaterial({ color: 0xff3020, depthTest: false, toneMapped: false }));
    dbgPath.renderOrder = 999;
    dbgPath.frustumCulled = false;
    ctx.scene.add(dbgPath);
  }

  return nav;
}

// ---------------------------------------------------------------------------------------------------

class NavGrid {
  constructor(res, cfg, physics) {
    Object.assign(this, cfg);
    this.nodeStart = res.nodeStart; this.nodeY = res.nodeY; this.nodeCell = res.nodeCell;
    this.nodeFlags = res.nodeFlags; this.comp = res.comp; this.links = res.links; this.coarseOf = res.coarseOf;
    this.coarse = res.coarse;
    this.physics = physics;
    const n = this.nodeY.length;
    this.n = n;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.search = 0;
    this.heap = new Heap(1 << 14);
    this.cdist = new Float32Array(this.coarse.n);
    this.cHeap = new Heap(1 << 12);
    this.lastExpanded = 0;
  }

  cellOf(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }

  nodePos(k, out) {
    const c = this.nodeCell[k];
    const i = c % this.nx, j = (c / this.nx) | 0;
    return out.set(this.x0 + (i + 0.5) * this.cell, this.nodeY[k], this.z0 + (j + 0.5) * this.cell);
  }

  floorsAt(x, z) {
    const c = this.cellOf(x, z);
    if (c < 0) return [];
    return Array.from(this.nodeY.subarray(this.nodeStart[c], this.nodeStart[c + 1]));
  }

  /** node of cell c whose floor is nearest y within tol, or -1 */
  near(c, y, tol) {
    let best = -1, bd = tol;
    const ns = this.nodeStart, ny = this.nodeY;
    for (let k = ns[c], e = ns[c + 1]; k < e; k++) {
      const d = Math.abs(ny[k] - y);
      if (d <= bd) { bd = d; best = k; }
    }
    return best;
  }

  /** nearest node to (x,y,z) within r cells (optionally restricted to component comp and to nodes accept(k) allows) */
  nearestNode(x, y, z, r, comp, accept = null) {
    const c0 = this.cellOf(x, z);
    let ci, cj;
    if (c0 >= 0) { ci = c0 % this.nx; cj = (c0 / this.nx) | 0; } else {
      ci = Math.min(this.nx - 1, Math.max(0, Math.floor((x - this.x0) / this.cell)));
      cj = Math.min(this.nz - 1, Math.max(0, Math.floor((z - this.z0) / this.cell)));
    }
    let best = -1, bestD = Infinity;
    const cell = this.cell;
    for (let ring = 0; ring <= r; ring++) {
      if (best >= 0 && (ring - 1) * cell > Math.sqrt(bestD)) break;
      for (let dj = -ring; dj <= ring; dj++) {
        for (let di = -ring; di <= ring; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) continue;
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) continue;
          const c = j * this.nx + i;
          const px = this.x0 + (i + 0.5) * cell - x, pz = this.z0 + (j + 0.5) * cell - z;
          for (let k = this.nodeStart[c], e = this.nodeStart[c + 1]; k < e; k++) {
            if (comp >= 0 && this.comp[k] !== comp) continue;
            if (!this.links[k]) continue; // isolated specks (wall tops a cell wide) are never useful
            const dy = this.nodeY[k] - y;
            // prefer floors at or just below the point (feet); penalize floors far above/below
            const d = px * px + pz * pz + (dy > 0.4 ? dy * dy * 9 : dy * dy * 2);
            if (d < bestD && (!accept || accept(k))) { bestD = d; best = k; }
          }
        }
      }
    }
    return best;
  }

  /** Neighbour node of a in direction bit d (DIRS), or -1 when the link is not walkable. */
  link(a, d) {
    if (!(this.links[a] & (1 << d))) return -1;
    const c = this.nodeCell[a];
    return this.near(c + DIRS[d * 2 + 1] * this.nx + DIRS[d * 2], this.nodeY[a], this.climbOrth * (d >= 4 ? SQRT2 : 1));
  }

  /** Coarse-graph Dijkstra from the goal's block component (distances in m to the goal). */
  coarseFrom(q0) {
    const { off, adj, w } = this.coarse;
    const dist = this.cdist, heap = this.cHeap;
    dist.fill(Infinity);
    heap.clear();
    dist[q0] = 0;
    heap.push(q0, 0);
    while (heap.size) {
      const key = heap.topKey(), q = heap.pop();
      if (key > dist[q]) continue;
      for (let e = off[q], ee = off[q + 1]; e < ee; e++) {
        const r = adj[e], nd = key + w[e];
        if (nd < dist[r]) { dist[r] = nd; heap.push(r, nd); }
      }
    }
  }

  astar(s, t, maxExpand = 2e6) {
    const { g, parent, seen, closed, heap, nodeY, nodeFlags, cell, nodeCell, nx, coarseOf, cdist } = this;
    const search = ++this.search;
    if (search === 0xffffffff) { seen.fill(0); closed.fill(0); this.search = 1; }
    const tc = nodeCell[t];
    const ti = tc % nx, tj = (tc / nx) | 0;
    this.coarseFrom(coarseOf[t]);
    // h = max(octile, coarse distance − slack): the coarse term knows about walls and gates
    const slack = (this.block || 8) * cell * 0.7;
    const h = (k) => {
      const c = nodeCell[k];
      const dx = Math.abs(c % nx - ti), dz = Math.abs(((c / nx) | 0) - tj);
      const oct = (dx > dz ? dx + (SQRT2 - 1) * dz : dz + (SQRT2 - 1) * dx) * cell;
      const cd = cdist[coarseOf[k]] - slack;
      return cd > oct ? cd : oct;
    };
    const W = 1.1;
    heap.clear();
    g[s] = 0; parent[s] = -1; seen[s] = search;
    heap.push(s, h(s) * W);
    let expanded = 0;
    while (heap.size) {
      const a = heap.pop();
      if (closed[a] === search) continue;
      closed[a] = search;
      if (a === t) break;
      if (++expanded > maxExpand) { this.lastExpanded = expanded; return null; }
      const ga = g[a], ya = nodeY[a];
      for (let d = 0; d < 8; d++) {
        const b = this.link(a, d);
        if (b < 0 || closed[b] === search) continue;
        const dy = Math.abs(nodeY[b] - ya);
        const ng = ga + (d >= 4 ? SQRT2 : 1) * cell * ((nodeFlags[b] & FLAG_NEAR_EDGE) ? 1.35 : 1) + dy * 0.8;
        if (seen[b] !== search || ng < g[b]) {
          g[b] = ng; parent[b] = a; seen[b] = search;
          heap.push(b, ng + h(b) * W);
        }
      }
    }
    this.lastExpanded = expanded;
    if (closed[t] !== search) return null;
    const out = [];
    for (let k = t; k >= 0; k = parent[k]) out.push(k);
    return out.reverse();
  }

  /** Grid line of sight a→b (cell centres), stepping through valid links only. */
  los(a, b) {
    const nx = this.nx;
    const ca = this.nodeCell[a], cb = this.nodeCell[b];
    const ai = ca % nx, aj = (ca / nx) | 0, bi = cb % nx, bj = (cb / nx) | 0;
    const nxs = Math.abs(bi - ai), nzs = Math.abs(bj - aj);
    const sx = Math.sign(bi - ai), sz = Math.sign(bj - aj);
    let cur = a, ix = 0, iz = 0;
    while (ix < nxs || iz < nzs) {
      const lhs = (1 + 2 * ix) * nzs, rhs = (1 + 2 * iz) * nxs;
      let di = 0, dj = 0;
      if (lhs === rhs) { di = sx; dj = sz; ix++; iz++; } else if (lhs < rhs) { di = sx; ix++; } else { dj = sz; iz++; }
      cur = this.link(cur, DIR_INDEX[(dj + 1) * 3 + di + 1]);
      if (cur < 0) return false;
    }
    return cur === b;
  }

  /** String pulling: from each anchor, the farthest path node in line of sight (galloping + binary search). */
  smooth(nodes) {
    const out = [nodes[0]];
    let anchor = 0;
    const last = nodes.length - 1;
    while (anchor < last) {
      let lo = anchor + 1, hi = -1;
      for (let step = 2; ; step *= 2) {
        const j = Math.min(last, anchor + step);
        if (this.los(nodes[anchor], nodes[j])) { lo = j; if (j === last || step >= 256) break; } else { hi = j; break; }
      }
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (this.los(nodes[anchor], nodes[mid])) lo = mid; else hi = mid;
      }
      out.push(nodes[lo]);
      anchor = lo;
    }
    return out;
  }

  findPath(from, to) {
    this.lastExpanded = 0;
    const rStart = Math.ceil(3 / this.cell), rGoal = Math.ceil(8 / this.cell);
    const s = this.nearestNode(from.x, from.y, from.z, rStart, -1);
    if (s < 0) return null;
    // goal: nearest node in the start's component (falls back to the nearest reachable spot)
    const t = this.nearestNode(to.x, to.y, to.z, rGoal, this.comp[s]);
    if (t < 0) return null;
    let nodes = s === t ? [s] : this.astar(s, t);
    if (!nodes) return null;
    nodes = nodes.length > 2 ? this.smooth(nodes) : nodes;
    const pts = nodes.map((k) => this.nodePos(k, new Vector3()));
    // exact endpoints when they are close to the snapped nodes
    const first = pts[0], lastP = pts[pts.length - 1];
    if (Math.hypot(from.x - first.x, from.z - first.z) < 1.0 && Math.abs(from.y - first.y) < 0.6) pts[0] = new Vector3(from.x, first.y, from.z);
    else pts.unshift(new Vector3(from.x, from.y, from.z));
    if (Math.hypot(to.x - lastP.x, to.z - lastP.z) < 0.75 && Math.abs(to.y - lastP.y) < 0.6) pts[pts.length - 1] = new Vector3(to.x, to.y, to.z);
    return pts;
  }
}

/** (dj+1)*3 + (di+1) -> DIRS bit index */
const DIR_INDEX = (() => {
  const t = new Int8Array(9).fill(-1);
  for (let d = 0; d < 8; d++) t[(DIRS[d * 2 + 1] + 1) * 3 + DIRS[d * 2] + 1] = d;
  return t;
})();

/** Binary min-heap of (id, key) with typed arrays; duplicates allowed (lazy deletion by the caller). */
class Heap {
  constructor(cap) { this.ids = new Int32Array(cap); this.keys = new Float32Array(cap); this.size = 0; }
  clear() { this.size = 0; }
  topKey() { return this.keys[0]; }
  push(id, key) {
    if (this.size === this.ids.length) {
      const i2 = new Int32Array(this.size * 2); i2.set(this.ids); this.ids = i2;
      const k2 = new Float32Array(this.size * 2); k2.set(this.keys); this.keys = k2;
    }
    const ids = this.ids, keys = this.keys;
    let i = this.size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      ids[i] = ids[p]; keys[i] = keys[p]; i = p;
    }
    ids[i] = id; keys[i] = key;
  }
  pop() {
    const ids = this.ids, keys = this.keys;
    const top = ids[0];
    const n = --this.size;
    if (n > 0) {
      const id = ids[n], key = keys[n];
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && keys[c + 1] < keys[c]) c++;
        if (keys[c] >= key) break;
        ids[i] = ids[c]; keys[i] = keys[c]; i = c;
      }
      ids[i] = id; keys[i] = key;
    }
    return top;
  }
}

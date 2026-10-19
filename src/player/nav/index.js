// Navigation: multi-level walkability grids (built off-thread from the collider soup) + A* + string pulling.
// ctx.nav = { findPath(fromWorld, toWorld) -> Vector3[] | null, ready: Promise, nearest(p), landing(p, goal),
//             floorsAt(x,z), rebuild(), stats, lastQueryMs }
// Layers (nav/multi.js): the 0.5 m main grid; ~4 cm patches over the site's winding stairs and the rooms they are
// entered from (a 0.3 m capsule has a 7–12 cm band round a newel); a 2 m layer over the far ground the UI can send
// the observer to (Kidron, Parah causeway, Har HaMishchah). Stitches join them into one graph.
// Long routes: a coarse graph (local components of blocks of cells, all layers) is searched with Dijkstra from the
// goal at query time; its distances steer the fine A* along the right corridor (gates, stairs) instead of flooding
// the open Mount.
import { Vector3, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, Line, LineBasicMaterial } from 'three';
import { NAV_DEFAULTS, FLAG_NEAR_EDGE, DIRS } from './grid-build.js';
import { buildNav, FLAG_STITCH } from './multi.js';
import { AMAH, m2w } from '../../core/units.js';
import { BODY } from '../controller.js';

/** Site extent covered by the main grid, amot (incl. ground outside the Mount walls). */
const SITE_EXTENT = { min: [-150, -150], max: [650, 650] };
const SQRT2 = Math.SQRT2;
/** fine patch cell = main cell / FINE_RATIO (≈ 4.2 cm): ≥ 1.7 cells across the narrowest newel band (7 cm) */
const FINE_RATIO = 12;
/** margin round a fine region (amot): doorways and landings just outside the stair's room */
const FINE_MARGIN = 1.5;
const MAX_FINE_CELLS = 700000;
/** the far-ground layer: cell (m), margin round the far targets (m), size cap */
const OUTER_CELL = 2, OUTER_MARGIN = 40, MAX_OUTER_CELLS = 450000;
/** half-size (m) of the 0.5 m patch round each far target */
const NEAR_PATCH = 12;

export function createNav(ctx, physics) {
  let grid = null; // NavGraph
  let resolveReady;
  let settled = false;
  let buildToken = 0;
  let worker = null;
  // The worker is spawned now and handed the build later: loading its module needs the main thread, which the
  // first frame's shader compiles block for tens of seconds. Spawned when the build starts (on 'ready', just before
  // that frame), it only began work after the frame (docs/decisions/player-2-fix.md).
  const spawn = () => {
    try {
      return new Worker(new URL('./nav.worker.js', import.meta.url), { type: 'module' });
    } catch (e) {
      console.warn('[nav] worker unavailable, building on the main thread', e);
      return null;
    }
  };
  let spare = spawn();

  const nav = {
    ready: null,
    stats: null,
    lastQueryMs: 0,
    lastExpanded: 0,
    /** site points [X, Y, Z?] the observer may be sent to (zone stands, event viewpoints): the far-ground layer reaches them */
    targets: null,
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
      const n = grid.nearestNodeM(p.x, p.y, p.z, radius, -1);
      return n < 0 ? null : grid.nodePos(n, new Vector3());
    },
    /**
     * Where a flier at p comes down before walking to `goal`. The glide moves level at p's height over the spot,
     * then straight down (goto.js glide), so the spot must be: within `radius` m in plan, connected to the
     * walkable area at goal, not above p, open straight up to p's height, and reached by a level move the body
     * fits through (rays at feet, waist and eye height, centre and both sides). Among those, the quickest trip:
     * glide length + walkK · the walk left to goal (coarse graph); walkK = glide speed / walk speed. Vector3 | null.
     */
    landing(p, goal, radius = 16, walkK = 3) {
      if (!grid) return null;
      const t = grid.nearestNodeM(goal.x, goal.y, goal.z, 8, -1);
      if (t < 0) return null;
      const n = grid.landingNode(p, t, radius, walkK);
      return n < 0 ? null : grid.nodePos(n, new Vector3());
    },
    /** Floor heights of the finest grid cell containing (x, z). */
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

  /** Build (or rebuild) the grid. Resolves nav.ready with the stats. */
  function start() {
    const token = ++buildToken;
    if (grid || settled) { grid = null; newReady(); }
    const ready = nav.ready;
    const specs = physics.soup && physics.soup.length ? navSpecs(ctx, physics, nav.targets) : null;
    if (!specs) { nav.stats = { error: 'no colliders' }; resolveReady(nav.stats); return ready; }
    const t0 = performance.now();
    const done = (res, how) => {
      if (token !== buildToken) return;
      const t1 = performance.now();
      grid = new NavGraph(res, physics);
      const L0 = res.layers[0].stats;
      nav.stats = {
        ...res.stats, nx: L0.nx, nz: L0.nz, triangles: L0.triangles, stairProbes: res.layers.reduce((s, L) => s + L.stats.stairProbes, 0),
        regions: specs.filter((s) => s.why).map((s) => s.why),
        totalMs: Math.round(performance.now() - t0), adoptMs: Math.round(performance.now() - t1), how, physicsVersion: physics.version,
        memMB: +(grid.bytes / 1e6).toFixed(1), doneAt: Math.round(performance.now()),
      };
      // the build's own time (totalMs, start → adopted, also waits out a main thread busy with the first frame)
      (ctx.buildTimes ||= {})['player.nav'] = res.stats.workerMs ?? nav.stats.totalMs;
      if (debugOn) drawGrid();
      resolveReady(nav.stats);
    };
    const fallback = () => runSliced(buildNav(physics.soup, specs), token, (res) => done(res, 'main-thread'));
    const w = spare || spawn();
    spare = null;
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
    w.postMessage({ positions, specs }, [positions.buffer]);
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
    const n = grid.n;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const v = new Vector3();
    for (let k = 0; k < n; k++) {
      grid.nodePos(k, v);
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y + 0.04; pos[k * 3 + 2] = v.z;
      const L = grid.layerOf(k), lk = k - L.off;
      const edge = L.nodeFlags[lk] & FLAG_NEAR_EDGE;
      const lvl = lk - L.nodeStart[L.nodeCell[lk]];
      const fine = L.cell < 0.2;
      col[k * 3] = edge ? 1 : fine ? 1 : lvl ? 0.3 : 0.2;
      col[k * 3 + 1] = edge ? 0.75 : fine ? 0.2 : lvl ? 0.5 : 0.9;
      col[k * 3 + 2] = edge ? 0.1 : fine ? 0.9 : lvl ? 1 : 0.3;
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
// layer specs

/**
 * Plan regions (site amot) the main grid cannot resolve, read from the site model:
 *  * winding stairs: stair elements whose params say spiral/winding, and params objects of any element that do
 *    (e.g. a chamber's `mesibah` or `roofStair`) — with the element that holds them;
 *  * the rooms such a stair is entered from (`params.stair` names it);
 *  * a chamber carrying an upper storey (another chamber standing on its roof, half its plan or more, its floor
 *    not at a walking datum): the way up starts in the chamber below and builders give it a stair the site model
 *    does not place (a turret stair).
 */
export function fineRegions(site) {
  const E = site?.elements || {};
  const out = [];
  const add = (box, why) => {
    if (!box?.min || !box?.max) return;
    out.push({ min: [box.min[0] - FINE_MARGIN, box.min[1] - FINE_MARGIN], max: [box.max[0] + FINE_MARGIN, box.max[1] + FINE_MARGIN], why });
  };
  const winding = (o) => !!o && typeof o === 'object' && !Array.isArray(o)
    && (o.form === 'spiral' || /\b(winding|newel|spiral)\b/i.test(`${o.note || ''} ${o.use || ''}`));
  const spirals = new Set();
  for (const [id, e] of Object.entries(E)) {
    if (!e?.box) continue;
    if (e.kind === 'stair' && winding(e.params)) { add(e.box, id); spirals.add(id); }
    for (const [k, v] of Object.entries(e.params || {})) {
      if (winding(v) && v.box) { add(v.box, `${id}.${k}`); add(e.box, id); spirals.add(id); }
    }
  }
  for (const [id, e] of Object.entries(E)) if (e?.box && spirals.has(e.params?.stair) && !spirals.has(id)) add(e.box, id);
  const ch = Object.entries(E).filter(([, e]) => e?.box && e.kind === 'chamber');
  const datums = Object.values(site?.datums || {}).filter(Number.isFinite);
  for (const [uid, u] of ch) {
    // a storey at a walking datum (a chamber off a court, the Heichal's upper floors) is reached from that level
    if (datums.some((d) => Math.abs(d - u.box.min[2]) <= 0.5)) continue;
    const au = (u.box.max[0] - u.box.min[0]) * (u.box.max[1] - u.box.min[1]);
    for (const [lid, l] of ch) {
      if (uid === lid || Math.abs(l.box.max[2] - u.box.min[2]) > 0.5) continue;
      const ox = Math.min(u.box.max[0], l.box.max[0]) - Math.max(u.box.min[0], l.box.min[0]);
      const oy = Math.min(u.box.max[1], l.box.max[1]) - Math.max(u.box.min[1], l.box.min[1]);
      if (ox > 0 && oy > 0 && ox * oy >= 0.5 * au) add(l.box, `${lid} (under ${uid})`);
    }
  }
  return out;
}

/**
 * Places (world) the far-ground layer should reach: { targets: zone stands + event viewpoints (nav.targets, or
 * ctx.zones / ctx.schedule once they exist), anchors }.
 */
function farPoints(ctx, extra) {
  const P = (p) => (Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) ? m2w(p[0], p[1], p[2] ?? 0) : null);
  const targets = [];
  for (const p of extra || []) { const v = P(p); if (v) targets.push(v); }
  for (const z of Object.values(ctx.zones?.content || {})) { const v = P(z?.stand); if (v) targets.push(v); }
  for (const e of ctx.schedule?.events || []) { const v = P(e?.view?.at); if (v) targets.push(v); }
  const anchors = [];
  ctx.anchors?.forEach?.((a) => { if (a?.pos?.isVector3) anchors.push(a.pos); });
  return { targets, anchors };
}

/**
 * Layer specs: [main, …fine patches, outer?, …near patches] (main first: global node ids 0…n0−1 are the main
 * grid's). targets: extra site points [X, Y, Z?] the observer may be sent to.
 */
export function navSpecs(ctx, physics, targets = null) {
  const b = physics.bounds;
  const cell = NAV_DEFAULTS.cell;
  const x0 = Math.max(SITE_EXTENT.min[0] * AMAH, b.min.x - 2);
  const x1 = Math.min(SITE_EXTENT.max[0] * AMAH, b.max.x + 2);
  const z0 = Math.max(-SITE_EXTENT.max[1] * AMAH, b.min.z - 2);
  const z1 = Math.min(-SITE_EXTENT.min[1] * AMAH, b.max.z + 2);
  if (!(x1 > x0 && z1 > z0)) return null;
  // nx, nz multiples of 4 so a 2 m outer layer aligns with the main grid's cells
  const ratio = Math.round(OUTER_CELL / cell);
  const nx = Math.ceil((x1 - x0) / cell / ratio) * ratio, nz = Math.ceil((z1 - z0) / cell / ratio) * ratio;
  const main = { name: 'main', x0, z0, nx, nz, cell, parent: -1, exclude: [] };
  const specs = [main];

  // ---- fine patches: regions → main-cell rectangles (outward), merged when they touch
  let rects = [];
  for (const R of fineRegions(ctx.site)) {
    const wx0 = R.min[0] * AMAH, wx1 = R.max[0] * AMAH, wz0 = -R.max[1] * AMAH, wz1 = -R.min[1] * AMAH;
    const i0 = Math.max(0, Math.floor((wx0 - x0) / cell)), i1 = Math.min(nx - 1, Math.ceil((wx1 - x0) / cell) - 1);
    const j0 = Math.max(0, Math.floor((wz0 - z0) / cell)), j1 = Math.min(nz - 1, Math.ceil((wz1 - z0) / cell) - 1);
    if (i0 <= i1 && j0 <= j1) rects.push({ r: [i0, j0, i1, j1], why: [R.why] });
  }
  for (let merged = true; merged;) {
    merged = false;
    outer: for (let a = 0; a < rects.length; a++) {
      for (let c = a + 1; c < rects.length; c++) {
        const A = rects[a].r, C = rects[c].r;
        if (A[0] > C[2] + 1 || C[0] > A[2] + 1 || A[1] > C[3] + 1 || C[1] > A[3] + 1) continue;
        rects[a] = { r: [Math.min(A[0], C[0]), Math.min(A[1], C[1]), Math.max(A[2], C[2]), Math.max(A[3], C[3])], why: [...rects[a].why, ...rects[c].why] };
        rects.splice(c, 1);
        merged = true;
        break outer;
      }
    }
  }
  const area = (q) => (q.r[2] - q.r[0] + 1) * (q.r[3] - q.r[1] + 1) * FINE_RATIO * FINE_RATIO;
  rects.sort((p, q) => area(p) - area(q));
  let fineCells = 0;
  for (const q of rects) {
    if (fineCells + area(q) > MAX_FINE_CELLS) { console.warn(`[nav] fine region skipped (cell budget): ${q.why.join(', ')}`); continue; }
    fineCells += area(q);
    const [i0, j0, i1, j1] = q.r;
    main.exclude.push([i0, j0, i1, j1]);
    specs.push({
      name: `fine:${q.why[0]}`, why: q.why.join(' + '), x0: x0 + i0 * cell, z0: z0 + j0 * cell,
      nx: (i1 - i0 + 1) * FINE_RATIO, nz: (j1 - j0 + 1) * FINE_RATIO, cell: cell / FINE_RATIO,
      parent: 0, clip: true, maxLevels: 8, block: 24, climbOrth: 0.45, tile: 96, bridge: true,
    });
  }

  // ---- far ground: a 2 m layer round the main grid out to the far targets, when there are any
  const fp = farPoints(ctx, targets);
  const outside = (p, m) => p.x < x0 - m || p.x > x0 + nx * cell + m || p.z < z0 - m || p.z > z0 + nz * cell + m;
  const far = [...fp.targets, ...fp.anchors].filter((p) => outside(p, 1));
  if (far.length) {
    let ox0 = x0, ox1 = x0 + nx * cell, oz0 = z0, oz1 = z0 + nz * cell;
    for (const p of far) {
      ox0 = Math.min(ox0, p.x - OUTER_MARGIN); ox1 = Math.max(ox1, p.x + OUTER_MARGIN);
      oz0 = Math.min(oz0, p.z - OUTER_MARGIN); oz1 = Math.max(oz1, p.z + OUTER_MARGIN);
    }
    ox0 = Math.max(ox0, b.min.x); ox1 = Math.min(ox1, b.max.x); oz0 = Math.max(oz0, b.min.z); oz1 = Math.min(oz1, b.max.z);
    // align to the main grid: main.x0 = outer.x0 + kx·OUTER_CELL
    const kx = Math.max(0, Math.ceil((x0 - ox0) / OUTER_CELL)), kz = Math.max(0, Math.ceil((z0 - oz0) / OUTER_CELL));
    const ax0 = x0 - kx * OUTER_CELL, az0 = z0 - kz * OUTER_CELL;
    const onx = Math.max(kx + nx / ratio, Math.ceil((ox1 - ax0) / OUTER_CELL)), onz = Math.max(kz + nz / ratio, Math.ceil((oz1 - az0) / OUTER_CELL));
    if (onx * onz <= MAX_OUTER_CELLS && (onx > nx / ratio || onz > nz / ratio)) {
      const outer = {
        name: 'outer', x0: ax0, z0: az0, nx: onx, nz: onz, cell: OUTER_CELL, parent: -1, block: 8, climbOrth: 2.0,
        exclude: [[kx, kz, kx + nx / ratio - 1, kz + nz / ratio - 1]],
      };
      specs.push(outer);
      const oi = specs.length - 1;
      main.parent = oi;
      // walking precision where the observer is sent: a 0.5 m patch round each far target (2 m cells cannot reach a
      // spot on a narrow causeway or by the burning place within the arrival tolerance)
      let near = [];
      for (const p of fp.targets) {
        if (!outside(p, NEAR_PATCH + OUTER_CELL)) continue;
        const i0 = Math.floor((p.x - NEAR_PATCH - ax0) / OUTER_CELL), i1 = Math.floor((p.x + NEAR_PATCH - ax0) / OUTER_CELL);
        const j0 = Math.floor((p.z - NEAR_PATCH - az0) / OUTER_CELL), j1 = Math.floor((p.z + NEAR_PATCH - az0) / OUTER_CELL);
        if (i0 < 1 || j0 < 1 || i1 > onx - 2 || j1 > onz - 2) continue;
        near.push([i0, j0, i1, j1]);
      }
      near = mergeRects(near);
      for (const [i0, j0, i1, j1] of near) {
        outer.exclude.push([i0, j0, i1, j1]);
        specs.push({
          name: `near:${Math.round((ax0 + (i0 + i1 + 1) * OUTER_CELL / 2) / AMAH)},${Math.round(-(az0 + (j0 + j1 + 1) * OUTER_CELL / 2) / AMAH)}`,
          x0: ax0 + i0 * OUTER_CELL, z0: az0 + j0 * OUTER_CELL, nx: (i1 - i0 + 1) * ratio, nz: (j1 - j0 + 1) * ratio, cell,
          parent: oi, clip: true,
        });
      }
    } else if (onx * onz > MAX_OUTER_CELLS) console.warn(`[nav] far-ground layer skipped: ${onx}×${onz} cells`);
  }
  return specs;
}

/** merge cell rectangles [i0, j0, i1, j1] that overlap or touch */
function mergeRects(rs) {
  rs = rs.map((r) => r.slice());
  for (let merged = true; merged;) {
    merged = false;
    for (let a = 0; a < rs.length && !merged; a++) {
      for (let c = a + 1; c < rs.length; c++) {
        const A = rs[a], C = rs[c];
        if (A[0] > C[2] + 1 || C[0] > A[2] + 1 || A[1] > C[3] + 1 || C[1] > A[3] + 1) continue;
        rs[a] = [Math.min(A[0], C[0]), Math.min(A[1], C[1]), Math.max(A[2], C[2]), Math.max(A[3], C[3])];
        rs.splice(c, 1);
        merged = true;
        break;
      }
    }
  }
  return rs;
}

// ---------------------------------------------------------------------------------------------------

class Layer {
  constructor(r) {
    Object.assign(this, r);
    this.n = r.nodeY.length;
    this.x1 = this.x0 + this.nx * this.cell;
    this.z1 = this.z0 + this.nz * this.cell;
    this.climb = r.climbOrth ?? NAV_DEFAULTS.climbOrth;
    this.slack = (r.block || 8) * this.cell * 0.7;
  }

  cellOf(x, z) {
    const i = Math.floor((x - this.x0) / this.cell), j = Math.floor((z - this.z0) / this.cell);
    if (i < 0 || j < 0 || i >= this.nx || j >= this.nz) return -1;
    return j * this.nx + i;
  }

  /** local node of cell c whose floor is nearest y within tol, or -1 */
  near(c, y, tol) {
    let best = -1, bd = tol;
    const ns = this.nodeStart, ny = this.nodeY;
    for (let k = ns[c], e = ns[c + 1]; k < e; k++) {
      const d = Math.abs(ny[k] - y);
      if (d <= bd) { bd = d; best = k; }
    }
    return best;
  }

  /** local neighbour of local node a in direction bit d, or -1 when the link is not walkable */
  link(a, d) {
    if (!(this.links[a] & (1 << d))) return -1;
    const c = this.nodeCell[a];
    return this.near(c + DIRS[d * 2 + 1] * this.nx + DIRS[d * 2], this.nodeY[a], this.climb * (d >= 4 ? SQRT2 : 1));
  }
}

class NavGraph {
  constructor(res, physics) {
    this.layers = res.layers.map((r) => new Layer(r));
    this.main = this.layers[0];
    this.physics = physics;
    this.st = res.stitch;
    this.coarse = res.coarse;
    this.stats = res.stats;
    const n = this.layers.reduce((s, L) => s + L.n, 0);
    this.n = n;
    this.cell = this.main.cell;
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.mark = new Uint32Array(n); // 2·search = open, 2·search + 1 = closed
    this.search = 0;
    this.heap = new Heap(1 << 14);
    this.cdist = new Float32Array(this.coarse.n);
    this.cHeap = new Heap(1 << 12);
    this.lastExpanded = 0;
    // finest first for point lookups
    this.byFine = [...this.layers].sort((a, b) => a.cell - b.cell);
    let bytes = n * 12 + this.coarse.n * 8;
    for (const L of this.layers) for (const k of ['nodeStart', 'nodeY', 'nodeCell', 'nodeFlags', 'comp', 'links', 'coarseOf']) bytes += L[k].byteLength;
    this.bytes = bytes;
  }

  // ---- compatibility (main layer views) ----
  get nodeY() { return this.main.nodeY; }
  get nodeStart() { return this.main.nodeStart; }
  get nodeCell() { return this.main.nodeCell; }
  get nodeFlags() { return this.main.nodeFlags; }
  get links() { return this.main.links; }

  layerOf(k) {
    const ls = this.layers;
    if (k < ls[0].n) return ls[0];
    for (let i = ls.length - 1; i > 0; i--) if (k >= ls[i].off) return ls[i];
    return ls[0];
  }

  yOf(k) { const L = this.layerOf(k); return L.nodeY[k - L.off]; }
  compOf(k) { const L = this.layerOf(k); return L.compMap[L.comp[k - L.off]]; }

  nodePos(k, out) {
    const L = this.layerOf(k), lk = k - L.off;
    const c = L.nodeCell[lk];
    return out.set(L.x0 + (c % L.nx + 0.5) * L.cell, L.nodeY[lk], L.z0 + (((c / L.nx) | 0) + 0.5) * L.cell);
  }

  /** the finest layer whose rectangle holds (x, z), or null */
  layerAt(x, z) {
    for (const L of this.byFine) if (x >= L.x0 && x < L.x1 && z >= L.z0 && z < L.z1) return L;
    return null;
  }

  floorsAt(x, z) {
    const L = this.layerAt(x, z);
    if (!L) return [];
    const c = L.cellOf(x, z);
    return Array.from(L.nodeY.subarray(L.nodeStart[c], L.nodeStart[c + 1]));
  }

  /** compatibility: r in main-grid cells */
  nearestNode(x, y, z, r, comp, accept = null) { return this.nearestNodeM(x, y, z, r * this.cell, comp, accept); }

  /**
   * Nearest node to (x, y, z) within r metres (optionally in global component comp and accepted by accept(k)).
   * Metric: plan distance² + a height term that keeps to the requested level: within ±0.4 m (feet on a step)
   * 2·dy², beyond it (another storey) 16·dy² — a floor 3.5 m above or below counts like 14 m away in plan, so a
   * point in a cellar snaps to the cellar, not to the court over it.
   */
  nearestNodeM(x, y, z, r, comp, accept = null) {
    let best = -1, bestD = Infinity;
    for (const L of this.byFine) {
      const ex = Math.max(L.x0 - x, 0, x - L.x1), ez = Math.max(L.z0 - z, 0, z - L.z1);
      const out2 = ex * ex + ez * ez;
      if (out2 > r * r || out2 > bestD) continue;
      const cell = L.cell, nx = L.nx;
      const ci = Math.min(nx - 1, Math.max(0, Math.floor((x - L.x0) / cell)));
      const cj = Math.min(L.nz - 1, Math.max(0, Math.floor((z - L.z0) / cell)));
      const rings = Math.ceil((r + Math.sqrt(out2)) / cell) + 1;
      for (let ring = 0; ring <= rings; ring++) {
        if (best >= 0 && (ring - 1) * cell > Math.sqrt(bestD)) break;
        if (ring > Math.max(ci, nx - 1 - ci, cj, L.nz - 1 - cj)) break;
        for (let dj = -ring; dj <= ring; dj++) {
          const j = cj + dj;
          if (j < 0 || j >= L.nz) continue;
          const edge = dj === -ring || dj === ring;
          for (let di = -ring; di <= ring; di += edge ? 1 : 2 * ring) {
            const i = ci + di;
            if (i < 0 || i >= nx) { if (!ring) break; continue; }
            const c = j * nx + i;
            const ks = L.nodeStart[c], ke = L.nodeStart[c + 1];
            if (ks === ke) { if (!ring) break; continue; }
            const px = L.x0 + (i + 0.5) * cell - x, pz = L.z0 + (j + 0.5) * cell - z;
            const p2 = px * px + pz * pz;
            if (p2 > r * r) { if (!ring) break; continue; }
            for (let k = ks; k < ke; k++) {
              if (!L.links[k]) continue; // isolated specks (wall tops a cell wide) are never useful
              if (comp >= 0 && L.compMap[L.comp[k]] !== comp) continue;
              const dy = L.nodeY[k] - y;
              const d = p2 + (dy > 0.4 || dy < -0.4 ? 16 : 2) * dy * dy;
              if (d < bestD && (!accept || accept(k + L.off))) { bestD = d; best = k + L.off; }
            }
            if (!ring) break;
          }
        }
      }
    }
    return best;
  }

  /**
   * Landing spot for a flier at p (world) bound for global node t: nodes within r m of p in plan, in t's component,
   * not above p, by cost = plan + drop + walkK · the walk left to t (max(coarse distance − slack, octile), as A*'s
   * heuristic). Tried cheapest first: the column must be open up to p's height and the level move over it clear
   * (levelHit). A level ray blocked at distance d rules out its 0.5° direction bin beyond d without new rays. When
   * the budget runs out, the floor straight below p. Global node or -1.
   */
  landingNode(p, t, r, walkK, maxCols = 4000, maxRays = 160) {
    const comp = this.compOf(t);
    const tp = this.nodePos(t, TMP), tx = tp.x, tz = tp.z;
    const Lt = this.layerOf(t);
    this.coarseFrom(Lt.coarseOff + Lt.coarseOf[t - Lt.off]);
    const cdist = this.cdist, heap = this.heap;
    heap.clear();
    for (const L of this.layers) {
      const cell = L.cell;
      const i0 = Math.max(0, Math.floor((p.x - r - L.x0) / cell)), i1 = Math.min(L.nx - 1, Math.floor((p.x + r - L.x0) / cell));
      const j0 = Math.max(0, Math.floor((p.z - r - L.z0) / cell)), j1 = Math.min(L.nz - 1, Math.floor((p.z + r - L.z0) / cell));
      for (let j = j0; j <= j1; j++) {
        const wz = L.z0 + (j + 0.5) * cell;
        for (let i = i0; i <= i1; i++) {
          const c = j * L.nx + i, ks = L.nodeStart[c], ke = L.nodeStart[c + 1];
          if (ks === ke) continue;
          const wx = L.x0 + (i + 0.5) * cell;
          const plan = Math.hypot(wx - p.x, wz - p.z);
          if (plan > r) continue;
          const gx = Math.abs(wx - tx), gz = Math.abs(wz - tz);
          const oct = gx > gz ? gx + (SQRT2 - 1) * gz : gz + (SQRT2 - 1) * gx;
          for (let k = ks; k < ke; k++) {
            const y = L.nodeY[k];
            if (y > p.y + 0.3 || !L.links[k] || L.compMap[L.comp[k]] !== comp) continue;
            const cd = cdist[L.coarseOff + L.coarseOf[k]] - L.slack;
            if (!(cd < Infinity)) continue;
            heap.push(k + L.off, plan + Math.max(0, p.y - y) + walkK * (cd > oct ? cd : oct));
          }
        }
      }
    }
    const v = TMP2, R = BODY.radius;
    const open = (k) => {
      this.nodePos(k, v);
      const top = this.physics.floorAt(v.x, v.z, p.y + 0.1, 0.02);
      return top === null || top < v.y + 0.1;
    };
    const bins = new Float32Array(LAND_BINS).fill(Infinity); // nearest level hit (m) per direction
    let cols = 0, rays = 0;
    while (heap.size && cols < maxCols && rays < maxRays) {
      const k = heap.pop();
      this.nodePos(k, v);
      const dx = v.x - p.x, dz = v.z - p.z, len = Math.hypot(dx, dz);
      const b = len < 0.05 ? -1 : Math.floor(((Math.atan2(dz, dx) / Math.PI + 1) / 2) * LAND_BINS) % LAND_BINS;
      if (b >= 0 && len + R > bins[b]) continue;
      cols++;
      if (!open(k)) continue;
      if (b < 0) return k;
      rays++;
      const hit = this.levelHit(p, dx / len, dz / len, len + R);
      if (hit === Infinity) return k;
      if (hit < bins[b]) bins[b] = hit;
    }
    // out of budget (the cheap spots all lie behind walls or under roofs): the floor straight below p
    const L = this.layerAt(p.x, p.z);
    if (!L) return -1;
    const c = L.cellOf(p.x, p.z);
    let best = -1, by = -Infinity;
    for (let k = L.nodeStart[c], e = L.nodeStart[c + 1]; k < e; k++) {
      const y = L.nodeY[k];
      if (y <= p.y + 0.3 && y > by && L.links[k] && L.compMap[L.comp[k]] === comp) { by = y; best = k + L.off; }
    }
    if (best < 0 || !open(best)) return -1;
    const dx = v.x - p.x, dz = v.z - p.z, len = Math.hypot(dx, dz);
    return len < 0.05 || this.levelHit(p, dx / len, dz / len, len + R) === Infinity ? best : -1;
  }

  /**
   * Level move of the body from feet p along plan direction (ux, uz) for far m: the nearest hit of nine rays (feet,
   * waist and eye height; centre and both sides at the capsule radius), or Infinity when clear.
   */
  levelHit(p, ux, uz, far) {
    const sx = -uz * BODY.radius, sz = ux * BODY.radius;
    RAY_D.set(ux, 0, uz);
    let best = Infinity;
    for (const h of LEVEL_RAY_H) {
      for (let s = -1; s <= 1; s++) {
        RAY_O.set(p.x + sx * s, p.y + h, p.z + sz * s);
        const hit = this.physics.raycast(RAY_O, RAY_D, far);
        if (hit && hit.distance < best) best = hit.distance;
      }
    }
    return best;
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

  /** stitch CSR row of global node k, or -1 */
  stRow(k) {
    const a = this.st.node;
    let lo = 0, hi = a.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, v = a[mid];
      if (v === k) return mid;
      if (v < k) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
  }

  astar(s, t, maxExpand = 2e6) {
    const { g, parent, mark, heap, cdist, st } = this;
    let search = ++this.search;
    if (search >= 0x7fffffff) { mark.fill(0); this.search = search = 1; }
    const OPEN = search * 2, CLOSED = OPEN + 1;
    const tp = this.nodePos(t, TMP);
    const tx = tp.x, tz = tp.z;
    const Lt = this.layerOf(t);
    this.coarseFrom(Lt.coarseOff + Lt.coarseOf[t - Lt.off]);
    // h = max(octile, coarse distance − slack): the coarse term knows about walls, gates and stairs
    const h = (L, lk) => {
      const c = L.nodeCell[lk];
      const dx = Math.abs(L.x0 + (c % L.nx + 0.5) * L.cell - tx), dz = Math.abs(L.z0 + (((c / L.nx) | 0) + 0.5) * L.cell - tz);
      const oct = dx > dz ? dx + (SQRT2 - 1) * dz : dz + (SQRT2 - 1) * dx;
      const cd = cdist[L.coarseOff + L.coarseOf[lk]] - L.slack;
      return cd > oct ? cd : oct;
    };
    const W = 1.1;
    heap.clear();
    g[s] = 0; parent[s] = -1; mark[s] = OPEN;
    { const L = this.layerOf(s); heap.push(s, h(L, s - L.off) * W); }
    let expanded = 0;
    while (heap.size) {
      const a = heap.pop();
      if (mark[a] === CLOSED) continue;
      mark[a] = CLOSED;
      if (a === t) break;
      if (++expanded > maxExpand) { this.lastExpanded = expanded; return null; }
      const L = this.layerOf(a), la = a - L.off;
      const ga = g[a], ya = L.nodeY[la], step = L.cell, off = L.off;
      for (let d = 0; d < 8; d++) {
        const lb = L.link(la, d);
        if (lb < 0) continue;
        const b = lb + off;
        if (mark[b] === CLOSED) continue;
        const ng = ga + (d >= 4 ? SQRT2 : 1) * step * ((L.nodeFlags[lb] & FLAG_NEAR_EDGE) ? 1.35 : 1) + Math.abs(L.nodeY[lb] - ya) * 0.8;
        if (mark[b] !== OPEN || ng < g[b]) {
          g[b] = ng; parent[b] = a; mark[b] = OPEN;
          heap.push(b, ng + h(L, lb) * W);
        }
      }
      if (L.nodeFlags[la] & FLAG_STITCH) {
        const q = this.stRow(a);
        for (let e = q < 0 ? 0 : st.off[q], ee = q < 0 ? 0 : st.off[q + 1]; e < ee; e++) {
          const b = st.to[e];
          if (mark[b] === CLOSED) continue;
          const Lb = this.layerOf(b), lb = b - Lb.off;
          const ng = ga + st.w[e] * 1.1 + Math.abs(Lb.nodeY[lb] - ya) * 0.8;
          if (mark[b] !== OPEN || ng < g[b]) {
            g[b] = ng; parent[b] = a; mark[b] = OPEN;
            heap.push(b, ng + h(Lb, lb) * W);
          }
        }
      }
    }
    this.lastExpanded = expanded;
    if (mark[t] !== CLOSED) return null;
    const out = [];
    for (let k = t; k >= 0; k = parent[k]) out.push(k);
    return out.reverse();
  }

  /** Grid line of sight a→b (cell centres, global ids of one layer), stepping through valid links only. */
  los(L, a, b) {
    const nx = L.nx;
    const ca = L.nodeCell[a], cb = L.nodeCell[b];
    const ai = ca % nx, aj = (ca / nx) | 0, bi = cb % nx, bj = (cb / nx) | 0;
    const nxs = Math.abs(bi - ai), nzs = Math.abs(bj - aj);
    const sx = Math.sign(bi - ai), sz = Math.sign(bj - aj);
    let cur = a, ix = 0, iz = 0;
    while (ix < nxs || iz < nzs) {
      const lhs = (1 + 2 * ix) * nzs, rhs = (1 + 2 * iz) * nxs;
      let di = 0, dj = 0;
      if (lhs === rhs) { di = sx; dj = sz; ix++; iz++; } else if (lhs < rhs) { di = sx; ix++; } else { dj = sz; iz++; }
      cur = L.link(cur, DIR_INDEX[(dj + 1) * 3 + di + 1]);
      if (cur < 0) return false;
    }
    return cur === b;
  }

  /** String pulling within one layer (local ids): from each anchor, the farthest node in line of sight. */
  smoothRun(L, nodes) {
    const out = [nodes[0]];
    let anchor = 0;
    const last = nodes.length - 1;
    while (anchor < last) {
      let lo = anchor + 1, hi = -1;
      for (let step = 2; ; step *= 2) {
        const j = Math.min(last, anchor + step);
        if (this.los(L, nodes[anchor], nodes[j])) { lo = j; if (j === last || step >= 256) break; } else { hi = j; break; }
      }
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (this.los(L, nodes[anchor], nodes[mid])) lo = mid; else hi = mid;
      }
      out.push(nodes[lo]);
      anchor = lo;
    }
    return out;
  }

  /** String pulling per same-layer run of the A* path (global ids); stitch crossings are kept. */
  smooth(nodes) {
    const out = [];
    for (let i = 0; i < nodes.length;) {
      const L = this.layerOf(nodes[i]);
      let j = i;
      while (j + 1 < nodes.length && this.layerOf(nodes[j + 1]) === L) j++;
      const run = nodes.slice(i, j + 1).map((k) => k - L.off);
      for (const k of run.length > 2 ? this.smoothRun(L, run) : run) out.push(k + L.off);
      i = j + 1;
    }
    return out;
  }

  findPath(from, to) {
    this.lastExpanded = 0;
    const s = this.nearestNodeM(from.x, from.y, from.z, 3, -1);
    if (s < 0) return null;
    // goal: nearest node in the start's component (falls back to the nearest reachable spot)
    const t = this.nearestNodeM(to.x, to.y, to.z, 8, this.compOf(s));
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

const TMP = new Vector3(), TMP2 = new Vector3(), RAY_O = new Vector3(), RAY_D = new Vector3();
/** landing: direction bins of the level-move cache (0.5°), ray heights above the feet (m) */
const LAND_BINS = 720;
const LEVEL_RAY_H = [0.3, 0.95, BODY.eye];

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

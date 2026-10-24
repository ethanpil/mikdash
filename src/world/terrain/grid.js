// Heightfield mesh: a tensor grid in site coordinates with fine lines near the Mount (and toward Har HaMishchah)
// and growing cells outward, cut out under the Mount footprint. Grid lines include the wall faces and every
// footProfile breakpoint, so the ground meets the walls' feet exactly (the profile is linear between them).
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute, Vector3 } from 'three';
import { m2w } from '../../core/units.js';

/**
 * Lines along one axis (amot): uniform spacing s0 inside [f0, f1]; outside, spacing s0·(1 + d/L) (d in m), out to
 * [lo, hi]. `specials` are inserted exactly (lines closer than 0.4·s are dropped next to them).
 */
export function axisLines({ lo, hi, f0, f1, s0, Llo, Lhi, A, specials = [] }) {
  const out = [];
  const n = Math.max(1, Math.round((f1 - f0) / s0));
  for (let i = 0; i <= n; i++) out.push(f0 + (f1 - f0) * i / n);
  for (let x = f1; x < hi;) { const d = (x - f1) * A; x += s0 * (1 + d / Lhi); out.push(Math.min(x, hi)); if (x >= hi) break; }
  for (let x = f0; x > lo;) { const d = (f0 - x) * A; x -= s0 * (1 + d / Llo); out.push(Math.max(x, lo)); if (x <= lo) break; }
  out.sort((a, b) => a - b);
  const sp = [...new Set(specials)].sort((a, b) => a - b);
  const keep = out.filter((x) => !sp.some((s) => Math.abs(x - s) < 0.4 * localSpacing(x)));
  function localSpacing(x) {
    if (x >= f0 && x <= f1) return s0;
    const d = (x > f1 ? x - f1 : f0 - x) * A;
    return s0 * (1 + d / (x > f1 ? Lhi : Llo));
  }
  const all = [...keep, ...sp].sort((a, b) => a - b);
  return all.filter((x, i) => i === 0 || x - all[i - 1] > 1e-6);
}

/**
 * Find s0 so that axisLines yields about `target` lines. `extra` specials are added after solving (they refine a band
 * without coarsening the rest of the grid; the regular lines next to them are dropped as for any special).
 */
export function solveLines(opts, target, extra = []) {
  let a = 0.2, b = 400;
  for (let i = 0; i < 40; i++) {
    const m = Math.sqrt(a * b);
    const n = axisLines({ ...opts, s0: m }).length;
    if (n > target) a = m; else b = m;
  }
  return axisLines({ ...opts, s0: b, specials: [...(opts.specials || []), ...extra] });
}

/**
 * Build the grid. heightZ(X, Y) -> site Z (amot). skip(X0, Y0, X1, Y1) -> true to drop a cell.
 * Returns { geometry (indexed, positions/normals/uv world), xs, ys, cellTri: Int32Array (first tri index of each cell or −1) }.
 */
export function buildGrid(xs, ys, sampleZ, skip) {
  const nx = xs.length, ny = ys.length;
  const pos = new Float32Array(nx * ny * 3);
  const uv = new Float32Array(nx * ny * 2);
  const graded = new Float32Array(nx * ny);
  const v = new Vector3();
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const s = sampleZ(xs[i], ys[j]);
      graded[k] = s.g;
      m2w(xs[i], ys[j], s.z, v);
      pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z;
      uv[k * 2] = v.x; uv[k * 2 + 1] = -v.z;
    }
  }
  const idx = [];
  for (let j = 0; j + 1 < ny; j++) {
    for (let i = 0; i + 1 < nx; i++) {
      if (skip(xs[i], ys[j], xs[i + 1], ys[j + 1])) continue;
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      // world: +X east, Y north -> −z; CCW from above: a(SW) b(SE) d(NE) c(NW)
      // alternate the diagonal for a less directional look
      if ((i + j) & 1) idx.push(a, b, d, a, d, c); else idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(new Uint32BufferAttribute(new Uint32Array(idx), 1));
  g.computeVertexNormals();
  g.userData.graded = graded;
  return g;
}

/**
 * Height of the RENDERED grid at site (X, Y): the cell's own triangle, with buildGrid's diagonals (qa-r1-fix-world: the
 * ground cover sits on the drawn surface, not on the analytic field the cells only sample). Keeps only the vertex
 * heights. Returns (X, Y, out) -> world y (m) or null outside; out.gx / out.gy = the slope (m per m east / north).
 */
export function gridSampler(xs, ys, geometry) {
  const nx = xs.length, ny = ys.length, P = geometry.attributes.position.array;
  const H = new Float32Array(nx * ny);
  for (let k = 0; k < H.length; k++) H[k] = P[k * 3 + 1];
  const find = (arr, v) => {
    let lo = 0, hi = arr.length - 1;
    if (!(v > arr[0] && v < arr[hi])) return -1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (arr[mid] <= v) lo = mid; else hi = mid; }
    return lo;
  };
  const AM = m2w(1, 0, 0, new Vector3()).x - m2w(0, 0, 0, new Vector3()).x;   // metres per amah
  return (X, Y, out) => {
    const i = find(xs, X), j = find(ys, Y);
    if (i < 0 || j < 0) return null;
    const du = xs[i + 1] - xs[i], dv = ys[j + 1] - ys[j];
    const u = (X - xs[i]) / du, v = (Y - ys[j]) / dv;
    const a = j * nx + i, ha = H[a], hb = H[a + 1], hc = H[a + nx], hd = H[a + nx + 1];
    let h, su, sv;                                     // su, sv: rise per cell along u, v
    if ((i + j) & 1) {
      if (u >= v) { su = hb - ha; sv = hd - hb; } else { su = hd - hc; sv = hc - ha; }
      h = ha + u * su + v * sv;
    } else if (u + v <= 1) { su = hb - ha; sv = hc - ha; h = ha + u * su + v * sv; }
    else { su = hd - hc; sv = hd - hb; h = hd - (1 - u) * su - (1 - v) * sv; }
    if (out) { out.gx = su / (du * AM); out.gy = sv / (dv * AM); }
    return h;
  };
}

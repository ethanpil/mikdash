// The visibility volume's computations (env/visibility.js), shared by its Worker and the main-thread fallback.
// Pure functions of plain data: no three, no DOM.

const _f = new Float32Array(1), _u = new Uint32Array(_f.buffer);
/** float → IEEE half (round to nearest; the values here are 0 … 1) */
export function toHalf(v) {
  _f[0] = v;
  const x = _u[0], s = (x >> 16) & 0x8000, e = ((x >> 23) & 0xff) - 112, m = x & 0x7fffff;
  if (e <= 0) {
    if (e < -10) return s;
    const mm = m | 0x800000;
    return s | ((mm >> (14 - e)) + ((mm >> (13 - e)) & 1));
  }
  if (e >= 31) return s | 0x7bff;
  return s | ((e << 10) + (m >> 13) + ((m >> 12) & 1));
}

/** the shader's cheap aperture form (interiors-glsl.js mkAperture) with weight 1, from point (px, py, pz) */
export function cheapAperture(px, py, pz, a) {
  const dx = a.cx - px, dy = a.cy - py, dz = a.cz - pz;
  const h = (a.axis === 0 ? dx : a.axis === 1 ? dy : dz) * a.sign;
  if (h <= 0) return 0;
  const u = a.u === 0 ? dx : a.u === 1 ? dy : dz, v = a.v === 0 ? dx : a.v === 1 ? dy : dz;
  const ex = Math.max(Math.abs(u) - a.hx, 0), ey = Math.max(Math.abs(v) - a.hy, 0);
  const h2 = h * h, area = 4 * a.hx * a.hy;
  const k = h2 / (h2 + ex * ex + ey * ey);
  return (1 - h / Math.sqrt(h2 + area * 0.3183099)) * k * Math.sqrt(k);
}

/**
 * Room bricks. msg: { dims: [W, H, D] (atlas texels), rooms: [{ min: [x,y,z], cell: [cx,cy,cz], n: [nx,ny,nz],
 * origin: [ox,oy,oz] (atlas texel of the brick's first texel), aps: [{ cx,cy,cz, axis, sign, u, v, hx, hy }] (≤ 4) }] }.
 * Returns the atlas: Uint16Array W × H × D × 4 half floats — per texel the share of each opening (RGBA = openings 0..3).
 */
export function computeRooms(msg) {
  const [W, H, D] = msg.dims;
  const out = new Uint16Array(W * H * D * 4);
  for (const r of msg.rooms) {
    const aps = r.aps.slice(0, 4);
    for (let k = 0; k < r.n[2]; k++) {
      const z = r.min[2] + k * r.cell[2];
      for (let j = 0; j < r.n[1]; j++) {
        const y = r.min[1] + j * r.cell[1];
        let o = (((r.origin[2] + k) * H + r.origin[1] + j) * W + r.origin[0]) * 4;
        for (let i = 0; i < r.n[0]; i++, o += 4) {
          const x = r.min[0] + i * r.cell[0];
          for (let q = 0; q < aps.length; q++) out[o + q] = toHalf(cheapAperture(x, y, z, aps[q]));
        }
      }
    }
  }
  return out;
}

/** FNV-1a over 32-bit words */
export function fnv(u32, h = 0x811c9dc5) {
  for (let i = 0; i < u32.length; i++) { h ^= u32[i]; h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}

/** K directions on the sphere (Fibonacci), as a flat array */
export function sphereDirs(K) {
  const d = new Float32Array(K * 3), g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < K; i++) {
    const y = 1 - (2 * (i + 0.5)) / K, r = Math.sqrt(1 - y * y), t = g * i;
    d[i * 3] = Math.cos(t) * r; d[i * 3 + 1] = y; d[i * 3 + 2] = Math.sin(t) * r;
  }
  return d;
}

/**
 * Precinct ambient obscurance. msg: { soup (Float32Array triangle soup, world m), origin, cell (m), dims [nx, ny, nz],
 * K (rays per cell), R (m), rooms: [{ min, max }] }. Returns { data: Uint8Array nx·ny·nz·4 (r = a, gba = b × 0.5 + 0.5:
 * the cosine-weighted visibility around a normal n is a + b·n), rays, steps, voxMs }.
 *
 * The soup is voxelised at half the cell (points every ≤ half a voxel over each triangle mark their voxels), the empty
 * space reachable from the grid's top and sides is flood-filled (what it does not reach is the inside of a solid: walls,
 * the altar, the fill under the courts), and from each cell centre within R of anything K rays are marched voxel by voxel
 * (DDA) up to R: visibility d / R of each, projected on SH L1. A cell centred in a solid takes the mean of its open
 * neighbours (two rings); a cell inside a room is divided by the room's mean (its enclosure is its sky visibility already).
 */
export function computeAO(msg, progress = null) {
  const { soup, origin, cell, dims, K, R } = msg;
  const [nx, ny, nz] = dims;
  const VOX = cell / 2;
  const vx = nx * 2, vy = ny * 2, vz = nz * 2;
  const t0 = performance.now();
  // 1. surfaces → voxels (1 = surface)
  const vox = new Uint8Array(vx * vy * vz);
  const ox = origin[0], oy = origin[1], oz = origin[2], inv = 1 / VOX;
  const h = VOX * 0.5;
  const hi = [ox + vx * VOX, oy + vy * VOX, oz + vz * VOX], lo = [ox, oy, oz];
  const sample = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    const nu = Math.max(1, Math.ceil(Math.hypot(bx, by, bz) / h)), nv = Math.max(1, Math.ceil(Math.hypot(cx, cy, cz) / h));
    for (let a = 0; a <= nu; a++) {
      const u = a / nu;
      for (let b = 0; b <= nv; b++) {
        const v = b / nv;
        if (u + v > 1 + 1e-6) break;
        const i = Math.floor((ax + bx * u + cx * v - ox) * inv), j = Math.floor((ay + by * u + cy * v - oy) * inv), k = Math.floor((az + bz * u + cz * v - oz) * inv);
        if (i >= 0 && j >= 0 && k >= 0 && i < vx && j < vy && k < vz) vox[(k * vy + j) * vx + i] = 1;
      }
    }
  };
  // a polygon clipped to one face of the grid (Sutherland–Hodgman)
  const clip = (poly, axis, value, keepAbove) => {
    const out = [];
    for (let q = 0; q < poly.length; q++) {
      const p = poly[q], r = poly[(q + 1) % poly.length];
      const pin = keepAbove ? p[axis] >= value : p[axis] <= value, rin = keepAbove ? r[axis] >= value : r[axis] <= value;
      if (pin) out.push(p);
      if (pin !== rin) {
        const f = (value - p[axis]) / (r[axis] - p[axis]);
        out.push([p[0] + (r[0] - p[0]) * f, p[1] + (r[1] - p[1]) * f, p[2] + (r[2] - p[2]) * f]);
      }
    }
    return out;
  };
  for (let t = 0; t < soup.length; t += 9) {
    const ax = soup[t], ay = soup[t + 1], az = soup[t + 2];
    const bx = soup[t + 3] - ax, by = soup[t + 4] - ay, bz = soup[t + 5] - az;
    const cx = soup[t + 6] - ax, cy = soup[t + 7] - ay, cz = soup[t + 8] - az;
    const xa = Math.min(ax, ax + bx, ax + cx), xb = Math.max(ax, ax + bx, ax + cx);
    const ya = Math.min(ay, ay + by, ay + cy), yb = Math.max(ay, ay + by, ay + cy);
    const za = Math.min(az, az + bz, az + cz), zb = Math.max(az, az + bz, az + cz);
    if (xb < lo[0] || yb < lo[1] || zb < lo[2] || xa > hi[0] || ya > hi[1] || za > hi[2]) continue;
    if (xa >= lo[0] && ya >= lo[1] && za >= lo[2] && xb <= hi[0] && yb <= hi[1] && zb <= hi[2]) { sample(ax, ay, az, bx, by, bz, cx, cy, cz); continue; }
    // reaching out of the grid (terrain, the plaza's great slabs): only the part inside it
    let poly = [[ax, ay, az], [ax + bx, ay + by, az + bz], [ax + cx, ay + cy, az + cz]];
    for (let a = 0; a < 3 && poly.length >= 3; a++) { poly = clip(poly, a, lo[a], true); if (poly.length >= 3) poly = clip(poly, a, hi[a], false); }
    for (let q = 1; q + 1 < poly.length; q++) {
      const p0 = poly[0], p1 = poly[q], p2 = poly[q + 1];
      sample(p0[0], p0[1], p0[2], p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2], p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]);
    }
  }
  // 2. flood fill the open air from the top and the sides (2 = open); what stays 0 is inside a solid
  const queue = new Int32Array(vx * vy * vz);
  let qh = 0, qt = 0;
  const seed = (i, j, k) => { const c = (k * vy + j) * vx + i; if (vox[c] === 0) { vox[c] = 2; queue[qt++] = c; } };
  for (let k = 0; k < vz; k++) for (let i = 0; i < vx; i++) seed(i, vy - 1, k);
  for (let j = 0; j < vy; j++) {
    for (let k = 0; k < vz; k++) { seed(0, j, k); seed(vx - 1, j, k); }
    for (let i = 0; i < vx; i++) { seed(i, j, 0); seed(i, j, vz - 1); }
  }
  const sxy = vx * vy;
  while (qh < qt) {
    const c = queue[qh++];
    const i = c % vx, j = ((c - i) / vx) % vy, k = Math.floor(c / sxy);
    if (i > 0 && vox[c - 1] === 0) { vox[c - 1] = 2; queue[qt++] = c - 1; }
    if (i < vx - 1 && vox[c + 1] === 0) { vox[c + 1] = 2; queue[qt++] = c + 1; }
    if (j > 0 && vox[c - vx] === 0) { vox[c - vx] = 2; queue[qt++] = c - vx; }
    if (j < vy - 1 && vox[c + vx] === 0) { vox[c + vx] = 2; queue[qt++] = c + vx; }
    if (k > 0 && vox[c - sxy] === 0) { vox[c - sxy] = 2; queue[qt++] = c - sxy; }
    if (k < vz - 1 && vox[c + sxy] === 0) { vox[c + sxy] = 2; queue[qt++] = c + sxy; }
  }
  const voxMs = performance.now() - t0;
  // 3. cells near anything: a cell-resolution occupancy, dilated by R
  const N = nx * ny * nz;
  let near = new Uint8Array(N);
  for (let k = 0; k < vz; k++) for (let j = 0; j < vy; j++) for (let i = 0; i < vx; i++) {
    if (vox[(k * vy + j) * vx + i] !== 2) near[((k >> 1) * ny + (j >> 1)) * nx + (i >> 1)] = 1;
  }
  const reach = Math.ceil(R / cell);
  const dilate = (src, stride, n) => {
    const out = new Uint8Array(src.length);
    for (let c = 0; c < src.length; c++) {
      if (!src[c]) continue;
      const p = Math.floor(c / stride) % n;
      for (let d = -reach; d <= reach; d++) { const q = p + d; if (q >= 0 && q < n) out[c + d * stride] = 1; }
    }
    return out;
  };
  near = dilate(dilate(dilate(near, 1, nx), nx, ny), nx * ny, nz);
  // 4. rays, from each cell's centre (a voxel corner, in voxel units)
  const dirs = sphereDirs(K);
  const A = new Float32Array(N).fill(1), B = new Float32Array(N * 3);
  const solid = new Uint8Array(N);
  const Rv = R / VOX;
  let rays = 0, steps = 0, rot = 0x9e3779b9;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const c = (k * ny + j) * nx + i;
        if (!near[c]) continue;
        const px = i * 2 + 1, py = j * 2 + 1, pz = k * 2 + 1;
        // centred in a solid (none of its 8 voxels open, some inside a solid): filled from its neighbours below
        let open = 0, inside = 0;
        for (let q = 0; q < 8; q++) {
          const w = vox[((pz - 1 + (q >> 2)) * vy + py - 1 + ((q >> 1) & 1)) * vx + px - 1 + (q & 1)];
          if (w === 2) open++; else if (w === 0) inside++;
        }
        if (!open && inside) { solid[c] = 1; continue; }
        // a per-cell turn of the direction set about the vertical (no shared pattern between neighbouring cells)
        rot = Math.imul(rot ^ c, 0x01000193) >>> 0;
        const th = (rot / 4294967296) * 2 * Math.PI, cs = Math.cos(th), sn = Math.sin(th);
        let sa = 0, sx = 0, sy = 0, sz = 0;
        for (let q = 0; q < K; q++) {
          const x0 = dirs[q * 3], dy = dirs[q * 3 + 1], z0 = dirs[q * 3 + 2];
          const dx = cs * x0 - sn * z0, dz = sn * x0 + cs * z0;
          const x = px + dx * 1e-3, y = py + dy * 1e-3, z = pz + dz * 1e-3;
          let vi = Math.floor(x), vj = Math.floor(y), vk = Math.floor(z);
          const si = dx > 0 ? 1 : -1, sj = dy > 0 ? 1 : -1, sk = dz > 0 ? 1 : -1;
          const tdx = 1 / Math.max(Math.abs(dx), 1e-9), tdy = 1 / Math.max(Math.abs(dy), 1e-9), tdz = 1 / Math.max(Math.abs(dz), 1e-9);
          let tx = (dx > 0 ? vi + 1 - x : x - vi) * tdx, ty = (dy > 0 ? vj + 1 - y : y - vj) * tdy, tz = (dz > 0 ? vk + 1 - z : z - vk) * tdz;
          // the start voxel is not tested (the cell's centre may sit on a surface); the first blocked voxel ends the ray
          let d = Rv;
          for (;;) {
            let tn;
            if (tx < ty) { if (tx < tz) { tn = tx; vi += si; tx += tdx; } else { tn = tz; vk += sk; tz += tdz; } }
            else if (ty < tz) { tn = ty; vj += sj; ty += tdy; } else { tn = tz; vk += sk; tz += tdz; }
            steps++;
            if (tn >= Rv || vi < 0 || vj < 0 || vk < 0 || vi >= vx || vj >= vy || vk >= vz) break;
            if (vox[(vk * vy + vj) * vx + vi] !== 2) { d = tn; break; }
          }
          const v = d / Rv;
          rays++;
          sa += v; sx += v * dx; sy += v * dy; sz += v * dz;
        }
        A[c] = sa / K; B[c * 3] = (2 * sx) / K; B[c * 3 + 1] = (2 * sy) / K; B[c * 3 + 2] = (2 * sz) / K;
      }
    }
    if (progress && (k % 8 === 7 || k === nz - 1)) progress(k + 1, nz);
  }
  // 5. solids: the mean of their open neighbours (two rings into a wall)
  for (let pass = 0; pass < 2; pass++) {
    const fill = [];
    for (let c = 0; c < N; c++) {
      if (!solid[c]) continue;
      const i = c % nx, j = Math.floor(c / nx) % ny, k = Math.floor(c / (nx * ny));
      let n = 0, sa = 0, s0 = 0, s1 = 0, s2 = 0;
      for (let q = 0; q < 6; q++) {
        const ii = i + (q === 0 ? 1 : q === 1 ? -1 : 0), jj = j + (q === 2 ? 1 : q === 3 ? -1 : 0), kk = k + (q === 4 ? 1 : q === 5 ? -1 : 0);
        if (ii < 0 || jj < 0 || kk < 0 || ii >= nx || jj >= ny || kk >= nz) continue;
        const o = (kk * ny + jj) * nx + ii;
        if (solid[o]) continue;
        n++; sa += A[o]; s0 += B[o * 3]; s1 += B[o * 3 + 1]; s2 += B[o * 3 + 2];
      }
      if (n) fill.push(c, sa / n, s0 / n, s1 / n, s2 / n);
    }
    for (let f = 0; f < fill.length; f += 5) {
      const c = fill[f];
      A[c] = fill[f + 1]; B[c * 3] = fill[f + 2]; B[c * 3 + 1] = fill[f + 3]; B[c * 3 + 2] = fill[f + 4]; solid[c] = 0;
    }
  }
  // 6. rooms: divided by the room's mean visibility (cells whose centre lies in it)
  for (const r of msg.rooms || []) {
    const lo = [0, 1, 2].map((a) => Math.max(0, Math.ceil((r.min[a] - origin[a]) / cell - 0.5)));
    const hi = [0, 1, 2].map((a) => Math.min(dims[a] - 1, Math.floor((r.max[a] - origin[a]) / cell - 0.5)));
    if (lo[0] > hi[0] || lo[1] > hi[1] || lo[2] > hi[2]) continue;
    let s = 0, n = 0;
    for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) { s += A[(k * ny + j) * nx + i]; n++; }
    const mean = n ? s / n : 1;
    if (!(mean > 0.05)) continue;
    for (let k = lo[2]; k <= hi[2]; k++) for (let j = lo[1]; j <= hi[1]; j++) for (let i = lo[0]; i <= hi[0]; i++) {
      const c = (k * ny + j) * nx + i;
      A[c] = Math.min(1, A[c] / mean); B[c * 3] /= mean; B[c * 3 + 1] /= mean; B[c * 3 + 2] /= mean;
    }
  }
  const data = new Uint8Array(N * 4);
  for (let c = 0; c < N; c++) {
    data[c * 4] = Math.round(Math.min(1, Math.max(0, A[c])) * 255);
    for (let e = 0; e < 3; e++) data[c * 4 + 1 + e] = Math.round(Math.min(1, Math.max(-1, B[c * 3 + e])) * 127.5 + 127.5);
  }
  return { data, rays, steps, voxMs: Math.round(voxMs) };
}

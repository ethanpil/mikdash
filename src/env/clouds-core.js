// Cloud field bake (sky-smoke-fire): one tiling RGBA8 texture, made once at load on the CPU (env/clouds.worker.js), so
// the sky shader reads its clouds from a texture — a few fetches a pixel on every tier — instead of evaluating noise in
// ALU (the high tiers' old procedural cirrus; on the HD 4600 an fbm per sky pixel was not affordable, so low / medium had
// a clear dome). Pure functions (no DOM, no three): the worker runs them, and a Node script can preview them.
//
// Channels (each tiles seamlessly; every noise is periodic over the tile):
//   R  cumulus "dome height" over a 64 km tile: inverted cellular clouds (≈ 3.2 km), towers (≈ 1.3 km) and cauliflower lobes
//      (≈ 0.6 km) on a fbm of fields. RANK-EQUALISED: a fraction c of the texels lies above 1 − c, so the shader's threshold
//      1 − coverage covers exactly that share of the layer's base, and a dome's core (higher values) is its thick middle.
//   G  cirrus fibres (sampled on a larger tile, 160 km): brush strokes broken into tufts, fibres inside, warped into hooks,
//      in patches; rank-equalised over the whole tile (coverage as above).
//   B  the "weather": a smooth fbm that thickens and thins the cumulus fields, sampled with the cirrus coordinates, so it
//      does not repeat with the cumulus tile and drifts at its own speed.
//   A  R blurred over ≈ 0.5 km: a cloud's smooth mass. The weak tiers' flat layer shades a cloud from it (its sun-ward
//      slope, its thickness); R − A is the cauliflower relief lit on the tops.

/** bump when the bake changes (the worker's IndexedDB cache key) */
export const BAKE_VERSION = 2;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** periodic gradient noise with px × py lattice cells over the unit tile; returns ≈ [−0.7, 0.7] */
function perlin(px, py, rand) {
  const n = px * py, gx = new Float32Array(n), gy = new Float32Array(n);
  for (let i = 0; i < n; i++) { const a = rand() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
  return (u, v) => {
    const x = u * px, y = v * py;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const i0 = ((x0 % px) + px) % px, j0 = ((y0 % py) + py) % py;
    const i1 = (i0 + 1) % px, j1 = (j0 + 1) % py;
    const k00 = j0 * px + i0, k10 = j0 * px + i1, k01 = j1 * px + i0, k11 = j1 * px + i1;
    const n00 = gx[k00] * tx + gy[k00] * ty;
    const n10 = gx[k10] * (tx - 1) + gy[k10] * ty;
    const n01 = gx[k01] * tx + gy[k01] * (ty - 1);
    const n11 = gx[k11] * (tx - 1) + gy[k11] * (ty - 1);
    const a = fade(tx), b = fade(ty);
    const nx0 = n00 + a * (n10 - n00), nx1 = n01 + a * (n11 - n01);
    return nx0 + b * (nx1 - nx0);
  };
}

/** periodic cellular noise (one jittered point per cell, c × c cells): distance to the nearest point, in cells (0 … ≈ 1) */
function worley(c, rand) {
  const px = new Float32Array(c * c), py = new Float32Array(c * c);
  for (let i = 0; i < c * c; i++) { px[i] = 0.1 + 0.8 * rand(); py[i] = 0.1 + 0.8 * rand(); }
  return (u, v) => {
    const x = u * c, y = v * c;
    const cx = Math.floor(x), cy = Math.floor(y);
    let best = 9;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const ix = cx + dx, iy = cy + dy;
        const k = (((iy % c) + c) % c) * c + (((ix % c) + c) % c);
        const ddx = ix + px[k] - x, ddy = iy + py[k] - y;
        const d = ddx * ddx + ddy * ddy;
        if (d < best) best = d;
      }
    }
    return Math.sqrt(best);
  };
}

/**
 * rank-equalise a Float32Array to bytes: value k / (n − 1) of its sorted order (a uniform distribution). A counting sort over
 * 2¹⁶ bins of the value range (ties within a bin keep their order) — a comparison sort of 1 M indices took ≈ 0.27 s
 */
function equalise(src, out, channel, stride = 4, rank = null) {
  const n = src.length, B = 65536;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const v = src[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const k = (B - 1) / Math.max(hi - lo, 1e-12);
  const bin = new Uint16Array(n), count = new Uint32Array(B + 1);
  for (let i = 0; i < n; i++) { const b = Math.floor((src[i] - lo) * k); bin[i] = b; count[b + 1]++; }
  for (let b = 0; b < B; b++) count[b + 1] += count[b];
  const s = 255 / (n - 1);
  for (let i = 0; i < n; i++) { const r = count[bin[i]]++; out[i * stride + channel] = Math.round(r * s); if (rank) rank[i] = r / (n - 1); }
}

/** periodic box blur of a size² field, radius r texels, in place (two passes ≈ a Gaussian) */
function blur(f, size, r) {
  const tmp = new Float32Array(size), w = 1 / (2 * r + 1);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < size; y++) {            // rows
      const o = y * size;
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += f[o + ((k % size) + size) % size];
      for (let x = 0; x < size; x++) { tmp[x] = acc * w; acc += f[o + (x + r + 1) % size] - f[o + ((x - r) % size + size) % size]; }
      f.set(tmp, o);
    }
    for (let x = 0; x < size; x++) {            // columns
      let acc = 0;
      for (let k = -r; k <= r; k++) acc += f[(((k % size) + size) % size) * size + x];
      for (let y = 0; y < size; y++) { tmp[y] = acc * w; acc += f[((y + r + 1) % size) * size + x] - f[(((y - r) % size + size) % size) * size + x]; }
      for (let y = 0; y < size; y++) f[y * size + x] = tmp[y];
    }
  }
}

/**
 * Bake the cloud tile. size: texels per side (power of two). Returns a Uint8Array RGBA (size² × 4).
 * Deterministic for a seed: the same sky on every visit (the per-date variation is an offset and a coverage, clouds.js).
 * The cumulus tile spans CU_TILE (64 km, clouds.js): cells below are per tile side.
 */
export function bakeClouds(size = 1024, seed = 7411) {
  const rand = mulberry32(seed);
  // cumulus: fields where clusters form (4, 8, 16 cells: 16 / 8 / 4 km), the clouds (20 cells ≈ 3.2 km), their towers
  // (48 ≈ 1.3 km), the cauliflower lobes (112 ≈ 0.6 km) and a fine fringe (perlin 256 ≈ 250 m)
  const f4 = perlin(4, 4, rand), f8 = perlin(8, 8, rand), f16 = perlin(16, 16, rand);
  const w20 = worley(20, rand), w48 = worley(48, rand), w112 = worley(112, rand);
  const d256 = perlin(256, 256, rand);
  // cirrus tile (sampled 4× larger): fibres stretched along u (the wind), warped across, in patches; the weather mask
  const cWarp = perlin(5, 5, rand), cWarp2 = perlin(11, 11, rand);
  const str1 = perlin(6, 40, rand), str2 = perlin(9, 70, rand), tuftN = perlin(7, 18, rand);
  const fib1 = perlin(16, 260, rand), fib2 = perlin(32, 520, rand);
  const patch = perlin(3, 3, rand), patch2 = perlin(7, 7, rand);
  const wx2 = perlin(2, 2, rand), wx4 = perlin(4, 4, rand);
  const N = size * size;
  const R = new Float32Array(N), G = new Float32Array(N);
  const out = new Uint8Array(N * 4);
  for (let y = 0; y < size; y++) {
    const v = (y + 0.5) / size;
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size, i = y * size + x;
      // cumulus: fields × clouds × towers × lobes — the domes' height over the layer; the fields decide the clusters and
      // the cloud sizes vary with them (a cluster's cloud may be one cell or several merged)
      const field = 0.5 + 0.9 * (0.55 * f4(u, v) + 0.3 * f8(u, v) + 0.15 * f16(u, v));
      const b1 = 1 - Math.min(1, w20(u, v)), b2 = 1 - Math.min(1, w48(u, v)), b3 = 1 - Math.min(1, w112(u, v));
      R[i] = field * 0.55 + b1 * b1 * 0.27 + b2 * 0.12 + b3 * 0.05 + 0.02 * d256(u, v);
      // cirrus: brush strokes (≈ 27 × 4 km, smooth, ridged) broken into tufts of uneven length and strength down the wind,
      // fibres inside them as texture; the cross coordinate bent by a slow warp that also varies along the wind (the
      // hooks of cirrus uncinus where it turns)
      const wv = v + 0.045 * cWarp(u, v) + 0.015 * cWarp2(u, v);
      const s1 = 1 - Math.abs(str1(u, wv) * 1.7), s2 = 1 - Math.abs(str2(u, wv) * 1.7);
      const strokes = Math.max(0, 0.65 * s1 * s1 * s1 + 0.35 * s2 * s2);
      const tuft = Math.min(1, Math.max(0, 0.5 + 1.6 * tuftN(u, wv)));
      const r1 = 1 - Math.abs(fib1(u, wv) * 1.6), r2 = 1 - Math.abs(fib2(u, wv) * 1.6);
      const fibres = 0.55 + 0.45 * (0.6 * r1 * r1 + 0.4 * r2 * r2);
      const p = 0.5 + 0.8 * (0.7 * patch(u, v) + 0.3 * patch2(u, v));
      const pm = Math.min(1, Math.max(0, (p - 0.3) / 0.45));
      G[i] = strokes * tuft * fibres * (0.03 + 0.97 * pm * pm * (3 - 2 * pm)) + 1e-4 * fibres; // never flat: equalised ranks need no ties
      // weather (B): smooth, 0..1
      const wm = 0.5 + 0.9 * (0.7 * wx2(u, v) + 0.3 * wx4(u, v));
      out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(wm * 255)));
    }
  }
  // R equalised; A: R blurred over ≈ 0.5 km — the cloud's smooth mass (its thickness, the sun-ward slope that shades it), so
  // R − A is the cauliflower relief on its top
  const rank = new Float32Array(N);
  equalise(R, out, 0, 4, rank);
  blur(rank, size, Math.max(1, Math.round(size / 128)));
  for (let i = 0; i < N; i++) out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(rank[i] * 255)));
  equalise(G, out, 1);
  return out;
}

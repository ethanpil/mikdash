// Cloud field bake (sky-smoke-fire): one tiling RGBA8 texture, made once at load on the CPU (env/clouds.worker.js), so
// the sky shader reads its clouds from a texture — a few fetches a pixel on every tier — instead of evaluating noise in
// ALU (the high tiers' old procedural cirrus; on the HD 4600 an fbm per sky pixel was not affordable, so low / medium had
// a clear dome). Pure functions (no DOM, no three): the worker runs them, and a Node script can preview them.
//
// Channels (each tiles seamlessly; every noise is periodic over the tile):
//   R  cumulus "dome height": an inverted cellular field (billows ≈ 1.7 km and ≈ 0.6 km over a 40 km tile) on a 10 km fbm
//      (fields of cloud and clear air). RANK-EQUALISED: a fraction c of the texels lies above 1 − c, so the shader's
//      threshold 1 − coverage covers exactly that share of the layer's base, and a dome's core (higher values) reaches
//      the layer's top plane (the 2.5-D sampling in clouds.js).
//   G  cirrus fibres (sampled on a 4× larger tile, ≈ 160 km): fine filaments stretched ≈ 12 : 1 down the upper wind,
//      bent by a slow cross-wind warp and gathered in patches; rank-equalised over the whole tile (coverage as above).
//   B  the "weather": a smooth fbm (≈ 40–80 km on the cirrus tile) that thickens and thins the cumulus fields, sampled
//      with the cirrus coordinates, so it does not repeat with the cumulus tile and drifts at its own speed.
//   A  detail: fbm ≈ 160–310 m on the cumulus tile, the cauliflower edge of a cumulus (erodes its margin).

/** bump when the bake changes (the worker's IndexedDB cache key) */
export const BAKE_VERSION = 1;

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
function equalise(src, out, channel, stride = 4) {
  const n = src.length, B = 65536;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const v = src[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
  const k = (B - 1) / Math.max(hi - lo, 1e-12);
  const bin = new Uint16Array(n), count = new Uint32Array(B + 1);
  for (let i = 0; i < n; i++) { const b = Math.floor((src[i] - lo) * k); bin[i] = b; count[b + 1]++; }
  for (let b = 0; b < B; b++) count[b + 1] += count[b];
  const s = 255 / (n - 1);
  for (let i = 0; i < n; i++) out[i * stride + channel] = Math.round(count[bin[i]]++ * s);
}

/**
 * Bake the cloud tile. size: texels per side (power of two). Returns a Uint8Array RGBA (size² × 4).
 * Deterministic for a seed: the same sky on every visit (the per-date variation is an offset and a coverage, clouds.js).
 */
export function bakeClouds(size = 1024, seed = 7411) {
  const rand = mulberry32(seed);
  // cumulus tile: fields (4, 8 cells), billows (24, 64 cells), cauliflower detail (128, 256 cells)
  const f4 = perlin(4, 4, rand), f8 = perlin(8, 8, rand), f16 = perlin(16, 16, rand);
  const w24 = worley(24, rand), w64 = worley(64, rand);
  const d128 = perlin(128, 128, rand), d256 = perlin(256, 256, rand);
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
      // cumulus: fields × billows (a cloud is a cluster of rounded towers; the fields decide where clusters form)
      const field = 0.5 + 0.9 * (0.55 * f4(u, v) + 0.3 * f8(u, v) + 0.15 * f16(u, v));
      const b1 = 1 - Math.min(1, w24(u, v)), b2 = 1 - Math.min(1, w64(u, v));
      R[i] = field * 0.6 + b1 * b1 * 0.3 + b2 * 0.1;
      // detail (A): the cauliflower margin, 0..1 around 0.5
      const det = 0.5 + 0.75 * (0.65 * d128(u, v) + 0.35 * d256(u, v));
      out[i * 4 + 3] = Math.max(0, Math.min(255, Math.round(det * 255)));
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
  equalise(R, out, 0);
  equalise(G, out, 1);
  return out;
}

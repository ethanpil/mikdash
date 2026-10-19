// CPU-generated basis textures for the GPU generators (pure JS: runs in a worker or on the main thread).
//
// Why on the CPU: on ANGLE/Direct3D every generator program pays an HLSL + driver compile proportional to its
// instruction count; inlined ALU noise made each program cost 0.3–3 s on an HD 4600. Generators therefore sample
// these small periodic textures instead (one texture fetch per noise layer), and stay loop-free.
//
//   noise:   4 independent periodic gradient-fbm fields (period = the texture), 4 base cells, signed ~[-1, 1]
//            R: 6 octaves gain 0.5 · G: 6 oct gain 0.55 · B: 3 oct (smooth) · A: 6 oct gain 0.65 (rough)
//   voronoi: periodic jittered-grid Voronoi, C cells per period:
//            R: F1 (cell units) · G: distance to the nearest cell border · B: cell hash [0,1) · A: F2

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic gradient fbm into channel `ch` of an RGBA Float32Array. */
function fbmChannel(out, size, ch, { base = 4, oct = 6, gain = 0.5, seed = 1 }) {
  const rand = rng(seed);
  const acc = new Float32Array(size * size);
  const cx0 = new Int32Array(size);
  const cx1 = new Int32Array(size);
  const cfx = new Float32Array(size);
  const cvx = new Float32Array(size);
  let norm = 0;
  let amp = 1;
  for (let o = 0; o < oct; o++) {
    const P = base << o;
    const gx = new Float32Array(P * P);
    const gy = new Float32Array(P * P);
    for (let i = 0; i < P * P; i++) {
      const a = rand() * Math.PI * 2;
      gx[i] = Math.cos(a) * amp;
      gy[i] = Math.sin(a) * amp;
    }
    const s = P / size;
    for (let x = 0; x < size; x++) {
      const f = (x + 0.5) * s;
      const ix = Math.floor(f);
      const fx = f - ix;
      cx0[x] = ix % P;
      cx1[x] = (ix + 1) % P;
      cfx[x] = fx;
      cvx[x] = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    }
    for (let y = 0; y < size; y++) {
      const f = (y + 0.5) * s;
      const iy = Math.floor(f);
      const fy = f - iy;
      const fy1 = fy - 1;
      const y0 = (iy % P) * P;
      const y1 = ((iy + 1) % P) * P;
      const vy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      const row = y * size;
      for (let x = 0; x < size; x++) {
        const fx = cfx[x];
        const fx1 = fx - 1;
        const vx = cvx[x];
        const i00 = y0 + cx0[x];
        const i01 = y0 + cx1[x];
        const i10 = y1 + cx0[x];
        const i11 = y1 + cx1[x];
        const a = gx[i00] * fx + gy[i00] * fy;
        const b = gx[i01] * fx1 + gy[i01] * fy;
        const c = gx[i10] * fx + gy[i10] * fy1;
        const d = gx[i11] * fx1 + gy[i11] * fy1;
        const ab = a + (b - a) * vx;
        acc[row + x] += ab + (c + (d - c) * vx - ab) * vy;
      }
    }
    norm += amp;
    amp *= gain;
  }
  const k = 1.414 * 1.6 / norm;
  for (let i = 0; i < size * size; i++) out[i * 4 + ch] = acc[i] * k;
}

export function noiseBasis(size, seed = 1) {
  const out = new Float32Array(size * size * 4);
  const oct = Math.max(3, Math.min(6, Math.round(Math.log2(size / 4)) - 1));
  fbmChannel(out, size, 0, { oct, gain: 0.5, seed: seed * 13 + 1 });
  fbmChannel(out, size, 1, { oct, gain: 0.55, seed: seed * 13 + 2 });
  fbmChannel(out, size, 2, { oct: 3, gain: 0.5, seed: seed * 13 + 3 });
  fbmChannel(out, size, 3, { oct, gain: 0.65, seed: seed * 13 + 4 });
  return out;
}

export function voronoiBasis(size, cells, seed = 1, jitter = 0.9) {
  const rand = rng(seed * 31 + 7);
  const C = cells;
  const ox = new Float32Array(C * C);
  const oy = new Float32Array(C * C);
  const hash = new Float32Array(C * C);
  for (let i = 0; i < C * C; i++) {
    ox[i] = 0.5 + jitter * (rand() - 0.5);
    oy[i] = 0.5 + jitter * (rand() - 0.5);
    hash[i] = rand();
  }
  // padded feature table (cells -3 .. C+2) so neighbour lookups need no modulo
  const PAD = 3;
  const E = C + 2 * PAD;
  const px = new Float32Array(E * E);
  const py = new Float32Array(E * E);
  const ph = new Float32Array(E * E);
  for (let j = 0; j < E; j++) {
    for (let i = 0; i < E; i++) {
      const src = (((j - PAD) % C + C) % C) * C + (((i - PAD) % C + C) % C);
      px[j * E + i] = i - PAD + ox[src];
      py[j * E + i] = j - PAD + oy[src];
      ph[j * E + i] = hash[src];
    }
  }
  const out = new Float32Array(size * size * 4);
  const s = C / size;
  for (let y = 0; y < size; y++) {
    const qy = (y + 0.5) * s;
    const cy = Math.floor(qy) + PAD;
    for (let x = 0; x < size; x++) {
      const qx = (x + 0.5) * s;
      const cx = Math.floor(qx) + PAD;
      let d1 = 9;
      let d2 = 9;
      let mi = 0;
      let mx = 0;
      let my = 0;
      for (let j = cy - 1; j <= cy + 1; j++) {
        const r = j * E;
        for (let i = cx - 1; i <= cx + 1; i++) {
          const rx = px[r + i] - qx;
          const ry = py[r + i] - qy;
          const d = rx * rx + ry * ry;
          if (d < d1) { d2 = d1; d1 = d; mi = r + i; mx = rx; my = ry; } else if (d < d2) d2 = d;
        }
      }
      // exact distance to the nearest border (two-pass)
      const mcx = mi % E;
      const mcy = (mi - mcx) / E;
      let md = 9;
      for (let j = mcy - 2; j <= mcy + 2; j++) {
        const r = j * E;
        for (let i = mcx - 2; i <= mcx + 2; i++) {
          const id = r + i;
          if (id === mi) continue;
          const rx = px[id] - qx;
          const ry = py[id] - qy;
          const ex = rx - mx;
          const ey = ry - my;
          const el2 = ex * ex + ey * ey;
          // bisector distance; skip candidates that cannot beat the current best
          const num = 0.5 * ((mx + rx) * ex + (my + ry) * ey);
          if (num < md * Math.sqrt(el2)) md = num / Math.sqrt(el2);
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.sqrt(d1);
      out[o + 1] = md;
      out[o + 2] = ph[mi];
      out[o + 3] = Math.sqrt(d2);
    }
  }
  return out;
}

// float32 -> float16 bits (round to nearest; values here are small and finite)
const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
export function toHalf(src) {
  const out = new Uint16Array(src.length);
  for (let i = 0; i < src.length; i++) {
    f32[0] = src[i];
    const x = u32[0];
    const sign = (x >>> 16) & 0x8000;
    let e = ((x >>> 23) & 0xff) - 127 + 15;
    let m = x & 0x7fffff;
    if (e <= 0) {
      if (e < -10) { out[i] = sign; continue; }
      m = (m | 0x800000) >> (1 - e);
      out[i] = sign | ((m + 0x1000) >> 13);
      continue;
    }
    if (e >= 31) { out[i] = sign | 0x7bff; continue; }
    const r = m + 0x1000;
    if (r & 0x800000) { m = 0; e++; } else m = r;
    out[i] = e >= 31 ? (sign | 0x7bff) : (sign | (e << 10) | (m >> 13));
  }
  return out;
}

/** All basis maps for a tier, as half-float RGBA arrays. */
export function makeBasis({ noiseSize = 512, vorSize = 512, seed = 1 } = {}) {
  const t0 = (globalThis.performance || Date).now();
  const noise = toHalf(noiseBasis(noiseSize, seed));
  const vor16 = toHalf(voronoiBasis(vorSize, 16, seed));
  const vor5 = toHalf(voronoiBasis(Math.max(128, vorSize >> 1), 5, seed + 3));
  const ms = (globalThis.performance || Date).now() - t0;
  return { noiseSize, vorSize, vor5Size: Math.max(128, vorSize >> 1), noise, vor16, vor5, ms };
}

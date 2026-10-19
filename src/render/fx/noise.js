// Tileable gradient-noise texture generated at runtime (no downloaded assets).
// RGBA = four independent Perlin octaves with periods 4, 8, 16, 32 cells over the tile, remapped to [0,1].
// FX shaders fetch it with scrolling UVs instead of computing noise in ALU (much cheaper on iGPUs).
import { DataTexture, RGBAFormat, UnsignedByteType, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter } from 'three';

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

function periodicPerlin(size, period, rand) {
  const gx = new Float32Array(period * period);
  const gy = new Float32Array(period * period);
  for (let i = 0; i < period * period; i++) {
    const a = rand() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const out = new Float32Array(size * size);
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * period;
      const fy = (y / size) * period;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const dot = (ix, iy, dx, dy) => {
        const k = ((iy % period) * period) + (ix % period);
        return gx[k] * dx + gy[k] * dy;
      };
      const n00 = dot(x0, y0, tx, ty);
      const n10 = dot(x0 + 1, y0, tx - 1, ty);
      const n01 = dot(x0, y0 + 1, tx, ty - 1);
      const n11 = dot(x0 + 1, y0 + 1, tx - 1, ty - 1);
      const u = fade(tx), v = fade(ty);
      const nx0 = n00 + u * (n10 - n00);
      const nx1 = n01 + u * (n11 - n01);
      out[y * size + x] = nx0 + v * (nx1 - nx0);
    }
  }
  return out;
}

let cached = null;

export function getNoiseTexture(size = 128) {
  if (cached) return cached;
  const rand = mulberry32(5786);
  const periods = [4, 8, 16, 32];
  const data = new Uint8Array(size * size * 4);
  periods.forEach((p, c) => {
    const n = periodicPerlin(size, p, rand);
    for (let i = 0; i < n.length; i++) {
      data[i * 4 + c] = Math.max(0, Math.min(255, Math.round((n[i] * 0.9 + 0.5) * 255)));
    }
  });
  const tex = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.name = 'fx.noise';
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}

// Pure DSP toolkit for the procedural soundscape (no Web Audio, no DOM): runs in the synthesis
// Worker, on the main thread as a fallback, and in node for tests. All buffers are Float32Array.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const db = (d) => Math.pow(10, d / 20);
export const toDb = (g) => 20 * Math.log10(Math.max(1e-12, g));
export const cents = (c) => Math.pow(2, c / 1200);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** Seeded PRNG (mulberry32) with helpers. */
export class Rng {
  constructor(seed = 1) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  uni(a = 0, b = 1) { return a + (b - a) * this.next(); }
  bi() { return this.next() * 2 - 1; }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  gauss() { // Box-Muller
    const u = Math.max(1e-9, this.next()), v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
  /** exponential inter-arrival time for a Poisson process of `rate` events/s */
  exp(rate) { return -Math.log(Math.max(1e-9, this.next())) / rate; }
  fork(salt = 1) { return new Rng(Math.imul(this.s ^ (salt * 0x85ebca6b), 0xc2b2ae35) ^ salt); }
}

/** Stable 32-bit hash of a string (seeds per cue id / variant). */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ---------------------------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------------------------

/** RBJ biquad (direct form I). */
export class Biquad {
  constructor(type = 'lowpass', f = 1000, q = 0.707, gainDb = 0, sr = 48000) {
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(type, f, q, gainDb, sr);
  }
  set(type, f, q, gainDb, sr) {
    const w = TAU * clamp(f, 5, sr * 0.49) / sr, cw = Math.cos(w), sw = Math.sin(w);
    const alpha = sw / (2 * Math.max(1e-4, q)), A = Math.pow(10, (gainDb || 0) / 40);
    let b0, b1, b2, a0, a1, a2;
    switch (type) {
      case 'highpass': b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'bandpass': b0 = alpha; b1 = 0; b2 = -alpha; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break; // 0 dB peak
      case 'notch': b0 = 1; b1 = -2 * cw; b2 = 1; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; break;
      case 'peaking': b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A; a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A; break;
      case 'lowshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s);
        a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s; break;
      }
      case 'highshelf': {
        const s = 2 * Math.sqrt(A) * alpha;
        b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s);
        a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s; break;
      }
      default: b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha; // lowpass
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
    return this;
  }
  process(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
  run(buf, from = 0, to = buf.length) { for (let i = from; i < to; i++) buf[i] = this.process(buf[i]); return buf; }
}

/** Topology-preserving state-variable filter (stable under fast modulation). Outputs lp/bp/hp. */
export class SVF {
  constructor(f = 1000, q = 0.707, sr = 48000) { this.ic1 = this.ic2 = 0; this.lp = this.bp = this.hp = 0; this.sr = sr; this.set(f, q); }
  set(f, q) {
    const g = Math.tan(Math.PI * clamp(f, 5, this.sr * 0.49) / this.sr), k = 1 / Math.max(0.05, q);
    this.a1 = 1 / (1 + g * (g + k)); this.a2 = g * this.a1; this.a3 = g * this.a2; this.k = k;
    return this;
  }
  process(x) {
    const v3 = x - this.ic2, v1 = this.a1 * this.ic1 + this.a2 * v3, v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    this.lp = v2; this.bp = v1; this.hp = x - this.k * v1 - v2;
    return v2;
  }
}

/** Klatt digital resonator: unity gain at DC, peak at F with bandwidth BW (cascade formant synthesis). */
export class Reson {
  constructor(sr) { this.sr = sr; this.y1 = this.y2 = 0; this.A = 1; this.B = 0; this.C = 0; }
  set(F, BW) {
    const T = 1 / this.sr, r = Math.exp(-Math.PI * BW * T);
    this.C = -r * r; this.B = 2 * r * Math.cos(TAU * Math.min(F, this.sr * 0.47) * T); this.A = 1 - this.B - this.C;
  }
  process(x) { const y = this.A * x + this.B * this.y1 + this.C * this.y2; this.y2 = this.y1; this.y1 = y; return y; }
}

/** One-pole lowpass (and the matching highpass = x - lp). */
export class OnePole {
  constructor(f = 1000, sr = 48000) { this.sr = sr; this.z = 0; this.set(f); }
  set(f) { this.a = 1 - Math.exp(-TAU * clamp(f, 1, this.sr * 0.49) / this.sr); return this; }
  process(x) { return (this.z += this.a * (x - this.z)); }
  hp(x) { return x - this.process(x); }
}

export class DCBlock {
  constructor(r = 0.995) { this.r = r; this.x1 = 0; this.y1 = 0; }
  process(x) { const y = x - this.x1 + this.r * this.y1; this.x1 = x; this.y1 = y; return y; }
}

// ---------------------------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------------------------

/** Pink noise (Paul Kellet's refined filter), ~unit RMS-ish. */
export class Pink {
  constructor(rng) { this.r = rng; this.b0 = this.b1 = this.b2 = this.b3 = this.b4 = this.b5 = this.b6 = 0; }
  next() {
    const w = this.r.bi();
    this.b0 = 0.99886 * this.b0 + w * 0.0555179; this.b1 = 0.99332 * this.b1 + w * 0.0750759;
    this.b2 = 0.969 * this.b2 + w * 0.153852; this.b3 = 0.8665 * this.b3 + w * 0.3104856;
    this.b4 = 0.55 * this.b4 + w * 0.5329522; this.b5 = -0.7616 * this.b5 - w * 0.016898;
    const y = this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + w * 0.5362;
    this.b6 = w * 0.115926;
    return y * 0.2;
  }
}

/** Brown (red) noise: leaky integrated white noise. */
export class Brown {
  constructor(rng) { this.r = rng; this.z = 0; }
  next() { this.z = this.z * 0.996 + this.r.bi() * 0.06; return this.z; }
}

/** Smooth random control signal (band-limited random walk), values roughly in [-1, 1]. */
export class Drift {
  constructor(rng, rateHz, sr, step = 32) {
    this.r = rng; this.sr = sr; this.step = step; this.n = 0; this.a = 0; this.b = rng.bi();
    this.len = Math.max(step, Math.round(sr / Math.max(0.01, rateHz))); this.t = 0; this.v = 0;
  }
  next() {
    if (this.t >= this.len) { this.t = 0; this.a = this.b; this.b = this.r.bi(); }
    const x = this.t / this.len; this.t++;
    return (this.v = this.a + (this.b - this.a) * (x * x * (3 - 2 * x)));
  }
}

// ---------------------------------------------------------------------------------------------
// Buffers and envelopes
// ---------------------------------------------------------------------------------------------

export const secs = (s, sr) => Math.max(1, Math.round(s * sr));

export function addInto(dst, src, offset = 0, gain = 1) {
  const o = Math.round(offset);
  const n = Math.min(src.length, dst.length - o);
  for (let i = Math.max(0, -o); i < n; i++) dst[o + i] += src[i] * gain;
  return dst;
}

export function peak(buf) { let p = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > p) p = a; } return p; }
export function rms(buf) { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / Math.max(1, buf.length)); }

/** Scale channels so the loudest sample hits `target`. */
export function normalize(chs, target = 0.89) {
  let p = 0;
  for (const c of chs) p = Math.max(p, peak(c));
  if (p > 1e-9) { const g = target / p; for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g; }
  return chs;
}

export function fade(buf, inS = 0, outS = 0) {
  const n = buf.length;
  for (let i = 0; i < inS && i < n; i++) buf[i] *= smooth01(i / inS);
  for (let i = 0; i < outS && i < n; i++) buf[n - 1 - i] *= smooth01(i / outS);
  return buf;
}

/** Remove DC and fade edges (every rendered cue goes through this). */
export function finish(chs, sr, fadeIn = 0.002, fadeOut = 0.02) {
  for (const c of chs) {
    const dc = new DCBlock(0.9995);
    for (let i = 0; i < c.length; i++) c[i] = dc.process(c[i]);
    fade(c, secs(fadeIn, sr), secs(fadeOut, sr));
  }
  return chs;
}

/**
 * Make a seamless loop: the buffers were rendered `x` samples longer than the loop; the tail beyond
 * the loop length is equal-power cross-faded into the head. Returns new buffers of length len.
 */
export function loopify(chs, len) {
  return chs.map((c) => {
    const x = c.length - len, out = c.slice(0, len);
    for (let i = 0; i < x; i++) {
      const t = (i + 0.5) / x, gi = Math.sin(t * Math.PI / 2), go = Math.cos(t * Math.PI / 2);
      out[i] = c[i] * gi + c[len + i] * go;
    }
    return out;
  });
}

/** Piecewise-linear envelope from [[t, v], ...] (seconds) sampled into a Float32Array. */
export function envelope(points, n, sr) {
  const e = new Float32Array(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    while (k < points.length - 2 && t > points[k + 1][0]) k++;
    const [t0, v0] = points[k], [t1, v1] = points[Math.min(k + 1, points.length - 1)];
    e[i] = t <= t0 ? v0 : t >= t1 ? v1 : v0 + (v1 - v0) * (t - t0) / (t1 - t0);
  }
  return e;
}

/** Decaying exciter burst: noise shaped by an exponential decay (seconds), optional lowpass. */
export function burst(rng, sr, dur, decay, lp = 0) {
  const n = secs(dur, sr), b = new Float32Array(n), f = lp ? new OnePole(lp, sr) : null;
  const k = Math.exp(-1 / (decay * sr));
  let g = 1;
  for (let i = 0; i < n; i++) { const w = rng.bi() * g; b[i] = f ? f.process(w) : w; g *= k; }
  return b;
}

/**
 * Modal synthesis: a bank of exponentially decaying sinusoids excited at sample `at`.
 * modes: [{ f, a, t60 }] ; optional per-mode phase randomisation; writes into out.
 */
export function modes(out, sr, at, list, gain = 1, rng = null) {
  const start = Math.max(0, Math.round(at));
  for (const m of list) {
    if (!(m.f > 20 && m.f < sr * 0.48)) continue;
    const r = Math.exp(-6.907755 / (Math.max(0.005, m.t60) * sr)); // -60 dB after t60
    const w = TAU * m.f / sr, c = Math.cos(w), s = Math.sin(w);
    let re = 0, im = (m.a || 1) * gain;
    if (rng) { const ph = rng.uni(0, TAU); re = im * Math.sin(ph); im *= Math.cos(ph); }
    const n = Math.min(out.length - start, Math.ceil(m.t60 * 1.15 * sr));
    const att = Math.max(1, Math.round((m.attack || 0.0006) * sr));
    for (let i = 0; i < n; i++) {
      const nr = (re * c - im * s) * r, ni = (re * s + im * c) * r;
      re = nr; im = ni;
      out[start + i] += i < att ? re * (i / att) : re;
    }
  }
  return out;
}

/** Feed `input` through a parallel bank of resonant bandpass filters (body resonances). */
export function resonate(input, sr, bank, dry = 0) {
  const out = new Float32Array(input.length);
  for (const r of bank) {
    const f = new Biquad('bandpass', r.f, r.q, 0, sr);
    const g = r.g ?? 1;
    for (let i = 0; i < input.length; i++) out[i] += f.process(input[i]) * g;
  }
  if (dry) for (let i = 0; i < input.length; i++) out[i] += input[i] * dry;
  return out;
}

// ---------------------------------------------------------------------------------------------
// Analysis (tests / debug)
// ---------------------------------------------------------------------------------------------

/** In-place iterative radix-2 complex FFT. */
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const a = i + j, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

/** Magnitude spectrogram frames (Hann window). Returns { frames: Float32Array[], size, hop }. */
export function spectrogram(buf, size = 1024, hop = 512) {
  const win = new Float32Array(size);
  for (let i = 0; i < size; i++) win[i] = 0.5 - 0.5 * Math.cos(TAU * i / (size - 1));
  const frames = [];
  const re = new Float64Array(size), im = new Float64Array(size);
  for (let s = 0; s + size <= buf.length; s += hop) {
    for (let i = 0; i < size; i++) { re[i] = buf[s + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const mag = new Float32Array(size / 2);
    for (let k = 0; k < size / 2; k++) mag[k] = Math.hypot(re[k], im[k]);
    frames.push(mag);
  }
  return { frames, size, hop };
}

/**
 * Stats for test/debug: duration, peak/RMS (dBFS), NaN/Inf count, clipped samples, energy-weighted
 * spectral centroid (Hz), 85 % roll-off, and the loudest 50 ms window (dBFS RMS).
 */
export function analyze(chs, sr) {
  const n = chs[0].length;
  let nan = 0, clip = 0, p = 0, s = 0;
  const mono = new Float32Array(n);
  for (const c of chs) for (let i = 0; i < n; i++) {
    const v = c[i];
    if (!Number.isFinite(v)) { nan++; continue; }
    const a = Math.abs(v); if (a > p) p = a; if (a > 1) clip++;
    s += v * v; mono[i] += v / chs.length;
  }
  const { frames, size } = spectrogram(mono, 2048, 1024);
  let num = 0, den = 0;
  const total = new Float64Array(size / 2);
  for (const f of frames) for (let k = 1; k < f.length; k++) { const e = f[k] * f[k]; num += e * k * sr / size; den += e; total[k] += e; }
  let acc = 0, roll = 0;
  for (let k = 1; k < total.length; k++) { acc += total[k]; if (acc >= den * 0.85) { roll = k * sr / size; break; } }
  const w = secs(0.05, sr);
  let loud = 0;
  for (let i = 0; i + w <= n; i += w >> 1) { let e = 0; for (let j = 0; j < w; j++) e += mono[i + j] * mono[i + j]; loud = Math.max(loud, Math.sqrt(e / w)); }
  return {
    duration: +(n / sr).toFixed(3), channels: chs.length, sampleRate: sr,
    peakDb: +toDb(p).toFixed(1), rmsDb: +toDb(Math.sqrt(s / (n * chs.length))).toFixed(1), loudest50msDb: +toDb(loud).toFixed(1),
    nan, clipped: clip, centroidHz: Math.round(den ? num / den : 0), rolloff85Hz: Math.round(roll),
  };
}

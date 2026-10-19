// Procedural impulse responses for the ConvolverNode reverbs, one per acoustic space.
// RT60 per band (low < 500 Hz, mid, high > 4 kHz), sparse early reflections sized to the space, a
// density build-up, decorrelated stereo channels. Values are acoustic estimates for the geometry and
// materials of each space (report Part VII) — reconstruction, logged in docs/decisions/audio.md.
import { Rng, Biquad, secs, smooth01 } from './dsp.js';

export const SPACES = {
  // open air outside the walls: almost dry, a far echo off the Mount's walls
  open: { rt: [0.9, 0.7, 0.45], pre: 0.02, er: { n: 4, min: 0.12, max: 0.42, g: 0.22 }, build: 0.08, wet: 0.14 },
  // Har HaBayit: a 500-amah paved court ringed by walls and stoas — sparse, late echoes
  mount: { rt: [2.0, 1.7, 1.1], pre: 0.018, er: { n: 12, min: 0.06, max: 0.3, g: 0.4 }, build: 0.12, wet: 0.24 },
  // colonnaded, roofed stoa: dense early sound, medium tail
  stoa: { rt: [2.1, 1.8, 1.25], pre: 0.006, er: { n: 18, min: 0.008, max: 0.07, g: 0.5 }, build: 0.04, wet: 0.32 },
  // the walled stone courts (Ezrat Nashim, the Azarah): open to the sky, hard walls ~65-90 m apart
  court: { rt: [1.7, 1.45, 1.0], pre: 0.012, er: { n: 16, min: 0.03, max: 0.19, g: 0.45 }, build: 0.07, wet: 0.3 },
  // a large stone hall (Gazit basilica, the domed Moked, Beit Avtinas)
  hall: { rt: [2.7, 2.3, 1.6], pre: 0.008, er: { n: 20, min: 0.007, max: 0.06, g: 0.55 }, build: 0.035, wet: 0.4 },
  // small stone chamber
  chamber: { rt: [1.2, 1.0, 0.7], pre: 0.004, er: { n: 14, min: 0.003, max: 0.03, g: 0.55 }, build: 0.02, wet: 0.3 },
  // the Heichal: 40 x 20 x 40 amot, gold-plated walls and ceiling — long, bright tail
  heichal: { rt: [5.2, 4.7, 3.7], pre: 0.01, er: { n: 18, min: 0.012, max: 0.075, g: 0.55 }, build: 0.06, wet: 0.5 },
  // narrow passages (mesibah, ta'im, the underground passage): flutter between close walls
  tight: { rt: [1.1, 0.9, 0.6], pre: 0.002, er: { n: 8, min: 0.002, max: 0.015, g: 0.5 }, flutter: 0.0115, build: 0.01, wet: 0.32 },
};

// air + surface absorption: stone and plaster darken the tail; the gold-plated Heichal stays bright
const TONE = { open: 6000, mount: 7000, stoa: 6500, court: 7500, hall: 6000, chamber: 6000, heichal: 11000, tight: 5500 };

export { ZONE_SPACE, spaceForZone } from './meta.js';

/**
 * Render a stereo IR for a space. maxLen caps the tail (low tier): when the cap would cut the decay while it is
 * still louder than -40 dB, all three RT60s are shortened in proportion so the room still decays
 * naturally into the cap — a shorter room, never a gated one. Returns [L, R] with unit energy per channel.
 */
export function impulse(key, sr, seed = 1, maxLen = 6) {
  const base = SPACES[key] || SPACES.court;
  const fit = Math.min(1, (1.5 * (maxLen - base.pre)) / base.rt[0]); // the longest band reaches -40 dB by maxLen
  const s = fit < 1 ? { ...base, rt: base.rt.map((r) => r * fit) } : base;
  const len = Math.min(maxLen, s.rt[0] * 1.15 + s.pre + 0.05);
  const n = secs(len, sr);
  const chans = [0, 1].map((c) => {
    const rng = new Rng(seed * 31 + c * 7 + key.length);
    const out = new Float32Array(n);
    const lo = new Biquad('lowpass', 500, 0.7, 0, sr), hi = new Biquad('highpass', 4000, 0.7, 0, sr);
    const kl = 6.907755 / (s.rt[0] * sr), km = 6.907755 / (s.rt[1] * sr), kh = 6.907755 / (s.rt[2] * sr);
    const pre = secs(s.pre, sr), build = Math.max(1, secs(s.build, sr));
    const tone = new Biquad('lowpass', TONE[key] || 7000, 0.6, 0, sr);
    // a late fade over the last 15 % keeps capped tails from ending abruptly
    const fadeFrom = Math.floor(n * 0.85);
    for (let i = pre; i < n; i++) {
      const w = rng.bi(), j = i - pre;
      const l = lo.process(w), h = hi.process(w), m = w - l - h;
      let y = l * Math.exp(-kl * j) + m * Math.exp(-km * j) + h * Math.exp(-kh * j);
      y *= smooth01(j / build);
      if (i > fadeFrom) y *= 1 - (i - fadeFrom) / (n - fadeFrom);
      out[i] = tone.process(y);
    }
    // early reflections: discrete taps (wall echoes), different per ear
    const er = s.er;
    for (let k = 0; k < er.n; k++) {
      const t = er.min + (er.max - er.min) * Math.pow(rng.next(), 0.8);
      const i = Math.round((t + s.pre * 0.5) * sr);
      if (i >= n - 3) continue;
      const g = er.g * (0.5 + 0.5 * rng.next()) * Math.exp(-6.9 * t / s.rt[1]) * (rng.chance(0.5) ? 1 : -1);
      out[i] += g; out[i + 1] += g * 0.5; out[i + 2] += g * 0.2;
    }
    if (s.flutter) {
      const p = s.flutter * (1 + (c ? 0.03 : 0));
      for (let k = 1; k * p < len * 0.5; k++) {
        const i = Math.round(k * p * sr);
        if (i < n) out[i] += 0.5 * Math.exp(-6.9 * k * p / (s.rt[1] * 0.7)) * (k % 2 ? -1 : 1);
      }
    }
    let e = 0; for (let i = 0; i < n; i++) e += out[i] * out[i];
    const g = 1 / Math.sqrt(e || 1);
    for (let i = 0; i < n; i++) out[i] *= g;
    return out;
  });
  return chans;
}

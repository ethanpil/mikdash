// Instruments of the Mikdash (report §27.1, §29.2; Arachin 2:3-6): the silver trumpets (hammered block
// silver, Bamidbar 10:2; Menachot 28a), Ben Arza's single bronze cymbal (Shekalim 5:1; Radak: two plates),
// the kinnor (lyre) and nevel (larger, lower), the chalil/abuv (reed pipe — flute days only) and the
// Kohen Gadol's golden bells (Shemot 28:33-35). The hydraulis was NOT used in the Mikdash (Arachin 10b):
// nothing here imitates an organ.
import { Rng, Biquad, OnePole, SVF, TAU, clamp, cents, secs, modes, resonate, burst, addInto } from './dsp.js';

// ---------------------------------------------------------------------------------------------
// Plucked strings — extended Karplus-Strong (pick-position comb, loss filter, allpass tuning)
// ---------------------------------------------------------------------------------------------
/**
 * Add one plucked gut string into `out`. o: { t (s), f (Hz), amp, decay (T60 s), bright 0..1, pick 0..0.5,
 * click (contact noise level; 0.15 = plectrum, less for a fingertip), clickLp (Hz) }
 */
export function pluck(out, sr, rng, o) {
  const f = clamp(o.f, 30, sr / 6), N = sr / f;
  const S = 0.5; // loss-filter weight (two-point average): delay 0.5 sample
  const L = Math.max(2, Math.floor(N - S - 0.05)), frac = N - S - L;
  const ap = (1 - frac) / (1 + frac);
  const T60 = Math.max(0.2, o.decay ?? 2) * Math.pow(220 / f, 0.35);
  const rho = Math.pow(10, -3 / (f * T60));
  const len = Math.min(out.length - Math.round(o.t * sr), secs(Math.min(T60 * 1.1, 7), sr));
  if (len <= 0) return out;
  const start = Math.max(0, Math.round(o.t * sr));
  const buf = new Float32Array(L);
  // excitation: noise burst lowpassed by brightness, then pick-position comb (removes harmonics at 1/pick)
  const lp = new OnePole(800 + 9000 * (o.bright ?? 0.5), sr);
  const exc = new Float32Array(L);
  for (let i = 0; i < L; i++) exc[i] = lp.process(rng.bi());
  const pd = Math.max(1, Math.round((o.pick ?? 0.15) * L));
  for (let i = 0; i < L; i++) buf[i] = exc[i] - (i >= pd ? exc[i - pd] : 0) * 0.9;
  let mean = 0; for (let i = 0; i < L; i++) mean += buf[i]; mean /= L;
  let pk = 1e-9; for (let i = 0; i < L; i++) { buf[i] -= mean; pk = Math.max(pk, Math.abs(buf[i])); }
  const g = (o.amp ?? 0.5) / pk;
  let idx = 0, prev = 0, apx1 = 0, apy1 = 0;
  const damp = new OnePole(Math.min(sr * 0.45, 2500 + 12000 * (o.bright ?? 0.5)), sr);
  for (let i = 0; i < len; i++) {
    const y = buf[idx];
    const avg = (1 - S) * y + S * prev; prev = y;
    // first-order allpass for the fractional delay (accurate tuning)
    const apy = ap * avg + apx1 - ap * apy1; apx1 = avg; apy1 = apy;
    buf[idx] = apy * rho;
    idx = idx + 1 === L ? 0 : idx + 1;
    out[start + i] += damp.process(y) * g;
  }
  // plectrum/finger contact noise
  const click = burst(rng, sr, 0.006, 0.0015, o.clickLp ?? 7000);
  addInto(out, click, start, (o.amp ?? 0.5) * (o.click ?? 0.15));
  return out;
}

/** Wooden soundbox resonances (applied on the string bus). */
export const BODY = {
  kinnor: [{ f: 240, q: 5, g: 0.8 }, { f: 410, q: 6, g: 0.7 }, { f: 680, q: 7, g: 0.5 }, { f: 1150, q: 8, g: 0.35 }, { f: 2100, q: 6, g: 0.25 }],
  nevel: [{ f: 105, q: 4, g: 0.9 }, { f: 185, q: 5, g: 0.8 }, { f: 310, q: 6, g: 0.6 }, { f: 520, q: 7, g: 0.45 }, { f: 900, q: 7, g: 0.3 }],
  // sg1612 lens (report §54): Renaissance harp — long soundbox under the strings, broad low resonances
  harp: [{ f: 190, q: 3.5, g: 0.8 }, { f: 340, q: 4, g: 0.75 }, { f: 590, q: 5, g: 0.55 }, { f: 1000, q: 5, g: 0.4 }, { f: 1900, q: 4, g: 0.25 }],
  // lute — ribbed bowl, rose, thin soundboard: air mode ~120 Hz, a brighter top than the nevel's box
  lute: [{ f: 118, q: 5, g: 0.85 }, { f: 240, q: 6, g: 0.8 }, { f: 420, q: 7, g: 0.7 }, { f: 700, q: 7, g: 0.55 }, { f: 1200, q: 6, g: 0.45 }, { f: 2500, q: 4, g: 0.35 }],
};

// mode on D with B-flat (Pythagorean), D3 = 146.83 Hz
const RATIO = { D: 1, E: 9 / 8, F: 32 / 27, G: 4 / 3, A: 3 / 2, Bb: 128 / 81, C: 16 / 9 };
const nf = (name, oct) => 146.83 * RATIO[name] * Math.pow(2, oct - 3);

/** A short improvised kinnor phrase in the mode (cue 'kinnor'). */
export function kinnorPhrase(sr, rng, o = {}) {
  const dur = o.duration || 5.5, out = new Float32Array(secs(dur + 2.5, sr));
  const scale = [['D', 4], ['E', 4], ['F', 4], ['G', 4], ['A', 4], ['Bb', 4], ['C', 5], ['D', 5]];
  let t = 0.05, k = 4;
  // opening strum D-A-D, then a stepwise line with an ornament and a cadence to D
  for (const [n, oc] of [['D', 3], ['A', 3], ['D', 4], ['A', 4]]) { pluck(out, sr, rng, { t, f: nf(n, oc), amp: 0.4, decay: 2.2, bright: 0.55, pick: 0.17 }); t += 0.045; }
  t += 0.45;
  while (t < dur - 1.2) {
    k = clamp(k + rng.pick([-1, -1, 1, 1, 2, -2, 0]), 0, scale.length - 1);
    const [n, oc] = scale[k];
    pluck(out, sr, rng, { t, f: nf(n, oc), amp: rng.uni(0.3, 0.45), decay: 1.8, bright: 0.6, pick: rng.uni(0.1, 0.2) });
    if (rng.chance(0.2)) pluck(out, sr, rng, { t: t + 0.09, f: nf(...scale[Math.min(k + 1, 7)]), amp: 0.22, decay: 1.2, bright: 0.6, pick: 0.15 });
    t += rng.pick([0.28, 0.28, 0.42, 0.56]);
  }
  for (const [n, oc] of [['F', 4], ['E', 4], ['D', 4]]) { pluck(out, sr, rng, { t, f: nf(n, oc), amp: 0.38, decay: 2.4, bright: 0.5, pick: 0.15 }); t += 0.36; }
  pluck(out, sr, rng, { t: t - 0.36, f: nf('D', 3), amp: 0.3, decay: 2.6, bright: 0.45, pick: 0.2 });
  return resonate(out, sr, BODY.kinnor, 0.7);
}

/** The nevel: larger, lower, longer-sounding (cue 'nevel'). */
export function nevelPhrase(sr, rng, o = {}) {
  const dur = o.duration || 6, out = new Float32Array(secs(dur + 3.5, sr));
  const seq = [[['D', 2], ['A', 2], ['D', 3]], [['F', 2], ['C', 3]], [['G', 2], ['D', 3]], [['A', 2], ['E', 3]], [['D', 2], ['A', 2], ['D', 3], ['F', 3]]];
  let t = 0.05;
  for (const chord of seq) {
    chord.forEach(([n, oc], j) => pluck(out, sr, rng, { t: t + j * 0.07, f: nf(n, oc), amp: rng.uni(0.45, 0.6), decay: 3.4, bright: 0.35, pick: 0.28 }));
    t += dur / seq.length;
  }
  return resonate(out, sr, BODY.nevel, 0.6);
}

// ---------------------------------------------------------------------------------------------
// Reed pipe (chalil / abuv): double-reed tone — waveshaped, bore resonances, breath, ornaments
// ---------------------------------------------------------------------------------------------
export function reedNote(out, sr, rng, t, dur, f, o = {}) {
  const start = Math.round(t * sr), n = Math.min(out.length - start, secs(dur + 0.12, sr));
  if (n <= 0) return out;
  const res1 = new Biquad('peaking', 1450, 2.5, 7, sr), res2 = new Biquad('peaking', 3100, 3, 5, sr), lp = new OnePole(7000, sr);
  const br = new SVF(2600, 1.2, sr);
  let ph = rng.next();
  const vib = rng.uni(4.5, 5.5), amp = o.amp ?? 0.5;
  for (let i = 0; i < n; i++) {
    const tt = i / sr;
    const env = Math.min(1, tt / 0.035) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.1) : 1);
    const scoop = 1 - 0.025 * Math.exp(-tt / 0.03);
    const fr = f * scoop * cents(Math.sin(TAU * vib * tt) * 9 * Math.min(1, tt / 0.4));
    ph += fr / sr; if (ph > 1) ph -= 1;
    const k = 1.6 + 2.2 * env;
    let y = Math.tanh(k * Math.sin(TAU * ph) + 0.35) - Math.tanh(0.35);
    br.process(rng.bi());
    y = y * env + br.bp * 0.12 * env;
    y = lp.process(res2.process(res1.process(y)));
    out[start + i] += y * amp;
  }
  return out;
}

/** A reed-pipe phrase (cue 'chalil'): ornamented line ending on a single pipe (Arachin 2:3 — "it concludes pleasantly"). */
export function chalilPhrase(sr, rng, o = {}) {
  const out = new Float32Array(secs((o.duration || 6) + 1, sr));
  const line = [['A', 4, 0.5], ['Bb', 4, 0.18], ['A', 4, 0.35], ['G', 4, 0.35], ['A', 4, 0.7], ['C', 5, 0.3], ['Bb', 4, 0.25], ['A', 4, 0.3], ['G', 4, 0.3], ['F', 4, 0.35], ['E', 4, 0.4], ['D', 4, 1.3]];
  let t = 0.05;
  for (const [n, oc, d] of line) { reedNote(out, sr, rng, t, d * 0.92, nf(n, oc), { amp: 0.5 }); t += d; }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Silver trumpets (chatzotzrot): additive brass tone whose spectrum brightens with blowing pressure
// ---------------------------------------------------------------------------------------------
/** One trumpet note into out. o: { t, dur, f, amp, staccato } */
function trumpetNote(out, sr, rng, o) {
  const start = Math.round(o.t * sr), rel = o.staccato ? 0.035 : 0.09;
  const n = Math.min(out.length - start, secs(o.dur + rel + 0.02, sr));
  if (n <= 0) return;
  const K = Math.min(24, Math.floor(sr * 0.42 / o.f));
  let ph = rng.next();
  // radiated spectrum: strong to ~1.5 kHz (bell), then ~-10 dB/oct; varied a little per instrument
  const w = Array.from({ length: K }, (_, k) => {
    const fk = o.f * (k + 1);
    return (fk < 1500 ? 1 : Math.pow(1500 / fk, 1.7)) * (k === 0 ? 0.7 : 1) * (1 + rng.bi() * 0.15);
  });
  // slow independent amplitude wander per harmonic (+-1.5 dB): a living, not static, spectrum
  const wan = Array.from({ length: K }, () => ({ a: rng.bi(), b: rng.bi(), t: rng.next(), len: rng.uni(0.15, 0.4) }));
  const att = o.staccato ? 0.018 : 0.05;
  const dr = new Rng(rng.int(1, 1e9));
  let drift = 0, dt = 0, da = 0, db = dr.bi();
  const breath = new SVF(o.f * 4, 0.7, sr);
  const gk = new Float32Array(K);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    // envelope: lip attack with a small overshoot, slow swell, release
    let A = t < att ? Math.pow(t / att, 1.4) * 1.06 : t < att + 0.1 ? 1.06 - 0.12 * ((t - att) / 0.1) : 0.94;
    if (!o.staccato) A *= 0.93 + 0.07 * Math.min(1, t / Math.max(0.5, o.dur));
    if (t > o.dur) A *= Math.max(0, 1 - (t - o.dur) / rel);
    if ((i & 63) === 0) {
      dt += 64 / sr; if (dt > 0.35) { dt = 0; da = db; db = dr.bi(); } drift = da + (db - da) * (dt / 0.35);
      for (let k = 0; k < K; k++) {
        const v = wan[k]; v.t += 64 / sr / v.len; if (v.t >= 1) { v.t -= 1; v.a = v.b; v.b = dr.bi(); }
        const m = v.a + (v.b - v.a) * v.t;
        // brassiness: upper harmonics grow faster than the lower with lip pressure
        gk[k] = w[k] * Math.pow(A, 1 + 0.28 * k) * (1 + 0.18 * m);
      }
    }
    const scoop = 1 - 0.035 * Math.exp(-t / (o.staccato ? 0.012 : 0.03));
    const fr = o.f * scoop * (1 + drift * 0.002) * (1 + 0.0015 * dr.bi());
    ph += fr / sr; if (ph > 1) ph -= 1;
    // all partials of a brass tone are phase-locked to the fundamental: sin((k+1)θ) by the Chebyshev
    // recurrence 2cosθ·sin(kθ) − sin((k−1)θ) — one sin/cos per sample instead of one per partial
    const th = TAU * ph, c2 = 2 * Math.cos(th);
    let sPrev = 0, sCur = Math.sin(th), y = 0;
    for (let k = 0; k < K; k++) {
      y += gk[k] * sCur;
      const sNext = c2 * sCur - sPrev; sPrev = sCur; sCur = sNext;
    }
    breath.process(rng.bi());
    y += breath.bp * 0.06 * (t < 0.08 ? 3 : 1) * A;
    out[start + i] += y * (o.amp ?? 0.4);
  }
}

/** Trumpet patterns played by `players` trumpeters in unison (Tamid 7:3: two). */
export function trumpets(sr, rng, o = {}) {
  const f = o.f || 440.5; // the choir's reciting tone A (reconstruction; no length datum in Chazal)
  const players = o.players || 2;
  const seq = [];
  const tekiah = (t) => { seq.push({ t, dur: o.tekiahDur || 3.1 }); return t + (o.tekiahDur || 3.1); };
  const teruah = (t) => { // 9 short blasts (three yevavot of three)
    for (let k = 0; k < 9; k++) seq.push({ t: t + k * 0.27 + Math.floor(k / 3) * 0.06, dur: 0.15, staccato: true });
    return t + 9 * 0.27 + 0.12;
  };
  let t = 0.03;
  if (o.pattern === 'teruah') t = teruah(t);
  else if (o.pattern === 'set') { t = tekiah(t); t = teruah(t + 0.55); t = tekiah(t + 0.55); }
  else t = tekiah(t);
  const out = new Float32Array(secs(t + 0.5, sr));
  const hp = new OnePole(320, sr);
  for (let p = 0; p < players; p++) {
    const r = rng.fork(p + 3), det = cents(p === 0 ? 0 : r.uni(5, 11) * (p % 2 ? 1 : -1)), lag = p === 0 ? 0 : r.uni(0.015, 0.04);
    for (const nt of seq) trumpetNote(out, sr, r, { ...nt, t: nt.t + lag, f: f * det, amp: 0.4 });
  }
  for (let i = 0; i < out.length; i++) out[i] = hp.hp(out[i]); // the small bell radiates little low end
  return out;
}

// ---------------------------------------------------------------------------------------------
// Ben Arza's bronze cymbal: two plates clashed — dense inharmonic modes, crash noise, long shimmer
// ---------------------------------------------------------------------------------------------
export function cymbal(sr, rng, o = {}) {
  const out = new Float32Array(secs(o.duration || 5.5, sr));
  const plate = (at, gain, r) => {
    const list = [];
    for (let k = 0; k < 140; k++) {
      const f = 380 * Math.pow(30, Math.pow(r.next(), 0.8));
      list.push({ f, a: Math.pow(f / 380, -0.45) * Math.pow(10, r.bi() * 0.3), t60: clamp(3.6 * Math.pow(500 / f, 0.5) * r.uni(0.7, 1.3), 0.35, 5), attack: 0.0005 + 0.03 * Math.min(1, f / 9000) * r.next() });
    }
    modes(out, sr, at * sr, list, gain * 0.05, r);
  };
  plate(0.005, 1, rng.fork(1));
  plate(0.005 + rng.uni(0.006, 0.013), 0.8, rng.fork(2));
  // crash noise
  const hp = new Biquad('highpass', 1800, 0.7, 0, sr);
  const nz = burst(rng, sr, 0.5, 0.07);
  for (let i = 0; i < nz.length; i++) nz[i] = hp.process(nz[i]);
  addInto(out, nz, secs(0.005, sr), 0.35);
  return out;
}

// ---------------------------------------------------------------------------------------------
// The Kohen Gadol's golden bells (pa'amonim between pomegranates): a jingle cluster per step
// ---------------------------------------------------------------------------------------------
export function bells(sr, rng, o = {}) {
  const steps = o.steps || 6, pace = o.pace || 0.62;
  const out = new Float32Array(secs(steps * pace + 1.2, sr));
  // 72 bells (or 36 — Zevachim 88b), each its own pitch; small soft-gold bells, damped by the wool pomegranates
  const bank = Array.from({ length: 36 }, () => rng.uni(2100, 3600));
  const ratios = [1, 2.27, 3.9, 5.8];
  for (let s = 0; s < steps; s++) {
    const t0 = 0.04 + s * pace + rng.uni(-0.02, 0.02);
    for (const swing of [0, 0.22]) {
      const hits = rng.int(6, 13) * (swing ? 0.6 : 1);
      for (let h = 0; h < hits; h++) {
        const f = rng.pick(bank), at = t0 + swing + Math.abs(rng.gauss()) * 0.045;
        const v = rng.uni(0.25, 1) * (swing ? 0.6 : 1);
        modes(out, sr, at * sr, ratios.map((r, k) => ({ f: f * r * (1 + rng.bi() * 0.01), a: [1, 0.55, 0.35, 0.2][k], t60: [0.55, 0.4, 0.25, 0.15][k] * rng.uni(0.7, 1.2) })), v * 0.12, rng);
      }
    }
  }
  return out;
}

// Formant voice synthesis (Klatt-style cascade) for the Levite choir, the criers, the grinder's chant
// and crowd babble. Source: band-limited LF/Rosenberg glottal-flow-derivative wavetables with
// per-period jitter/shimmer, pulsed aspiration noise, vibrato, slow intonation drift and portamento;
// filter: 5 cascaded formant resonators per voice (unity DC gain) + a parallel fricative branch.
// Text comes in as transliterated syllables ("shir miz-mor liv-nei ko-rach") → phoneme segments.
import { Rng, Reson, SVF, OnePole, Biquad, Drift, TAU, clamp, cents, smooth01, fft } from './dsp.js';

// ---------------------------------------------------------------------------------------------
// Formant tables (Hz). Singing-voice values after the standard vocal-formant tables (Peterson &
// Barney / IRCAM-Csound sets); bandwidths widened ~30 % from the sung table to sound less "ringy".
// ---------------------------------------------------------------------------------------------
const V = (F, B) => ({ F, B });
const TABLES = {
  bass: {
    a: V([600, 1040, 2250, 2450, 2750], [78, 90, 140, 150, 170]), e: V([400, 1620, 2400, 2800, 3100], [60, 100, 130, 150, 160]),
    i: V([250, 1750, 2600, 3050, 3340], [70, 110, 130, 150, 160]), o: V([400, 750, 2400, 2600, 2900], [60, 100, 130, 150, 160]),
    u: V([350, 600, 2400, 2675, 2950], [60, 100, 130, 150, 160]),
  },
  tenor: {
    a: V([650, 1080, 2650, 2900, 3250], [100, 110, 150, 170, 180]), e: V([400, 1700, 2600, 3200, 3580], [90, 100, 130, 150, 160]),
    i: V([290, 1870, 2800, 3250, 3540], [60, 110, 130, 150, 160]), o: V([400, 800, 2600, 2800, 3000], [60, 100, 130, 150, 160]),
    u: V([350, 600, 2700, 2900, 3300], [60, 80, 130, 150, 160]),
  },
  alto: {
    a: V([800, 1150, 2800, 3500, 4950], [100, 110, 150, 170, 180]), e: V([400, 1600, 2700, 3300, 4950], [80, 100, 150, 190, 250]),
    i: V([350, 1700, 2700, 3700, 4950], [70, 130, 150, 190, 250]), o: V([450, 800, 2830, 3500, 4950], [90, 100, 130, 170, 180]),
    u: V([325, 700, 2530, 3500, 4950], [70, 80, 210, 230, 250]),
  },
  soprano: {
    a: V([800, 1150, 2900, 3900, 4950], [100, 110, 150, 170, 180]), e: V([350, 2000, 2800, 3600, 4950], [80, 130, 150, 190, 250]),
    i: V([270, 2140, 2950, 3900, 4950], [80, 110, 130, 150, 160]), o: V([450, 800, 2830, 3800, 4950], [90, 100, 130, 170, 180]),
    u: V([325, 700, 2700, 3800, 4950], [70, 80, 210, 230, 250]),
  },
};
TABLES.baritone = mixTable(TABLES.bass, TABLES.tenor, 0.5);
TABLES.boy = mixTable(TABLES.alto, TABLES.soprano, 0.5);
TABLES.woman = TABLES.alto;

function mixTable(A, B, t) {
  const o = {};
  for (const k of Object.keys(A)) o[k] = V(A[k].F.map((f, i) => f + (B[k].F[i] - f) * t), A[k].B.map((b, i) => b + (B[k].B[i] - b) * t));
  return o;
}

// consonant formant loci (F1..F3 offsets used while the consonant sounds; F4/F5 follow the vowel)
const LOCI = {
  lab: [300, 900, 2200], alv: [320, 1700, 2600], vel: [300, 2000, 2400], nasm: [260, 1100, 2300], nasn: [260, 1600, 2600],
  lat: [360, 1050, 2650], rho: [420, 1300, 2300], pal: [270, 2100, 2900], glot: null,
};

// consonant inventory: dur (s, sung onset), voice (0..1 voicing), fric {f, q, amp}, burst, asp, locus
const C = {
  b: { dur: 0.055, voice: 0.22, burst: { f: 900, q: 0.8, amp: 0.25 }, locus: 'lab' },
  p: { dur: 0.06, voice: 0, burst: { f: 1000, q: 0.7, amp: 0.4 }, asp: 0.025, locus: 'lab' },
  m: { dur: 0.065, voice: 0.4, nasal: true, locus: 'nasm' },
  v: { dur: 0.06, voice: 0.5, fric: { f: 3000, q: 0.6, amp: 0.1 }, locus: 'lab' },
  f: { dur: 0.08, voice: 0, fric: { f: 3600, q: 0.5, amp: 0.2 }, locus: 'lab' },
  d: { dur: 0.05, voice: 0.22, burst: { f: 3800, q: 1.1, amp: 0.3 }, locus: 'alv' },
  t: { dur: 0.055, voice: 0, burst: { f: 4200, q: 1.1, amp: 0.45 }, asp: 0.02, locus: 'alv' },
  n: { dur: 0.06, voice: 0.4, nasal: true, locus: 'nasn' },
  l: { dur: 0.045, voice: 0.65, locus: 'lat' },
  r: { dur: 0.05, voice: 0.55, tap: true, locus: 'rho' },
  s: { dur: 0.095, voice: 0, fric: { f: 5600, q: 2.2, amp: 0.55 }, locus: 'alv' },
  z: { dur: 0.08, voice: 0.45, fric: { f: 5400, q: 2.0, amp: 0.3 }, locus: 'alv' },
  sh: { dur: 0.1, voice: 0, fric: { f: 3000, q: 1.8, amp: 0.6 }, locus: 'pal' },
  tz: { dur: 0.1, voice: 0, burst: { f: 4200, q: 1.1, amp: 0.35 }, fric: { f: 5600, q: 2.2, amp: 0.5 }, locus: 'alv' },
  ch: { dur: 0.085, voice: 0, fric: { f: 1700, q: 1.0, amp: 0.4 }, locus: 'vel' }, // kh / pharyngeal chet
  k: { dur: 0.06, voice: 0, burst: { f: 2100, q: 1.5, amp: 0.45 }, asp: 0.022, locus: 'vel' },
  g: { dur: 0.055, voice: 0.22, burst: { f: 2000, q: 1.4, amp: 0.28 }, locus: 'vel' },
  h: { dur: 0.06, voice: 0, asp: 1, locus: null },
  y: { dur: 0.045, voice: 0.8, locus: 'pal' },
  "'": { dur: 0.035, voice: 0.08, locus: null },
};
C.q = C.k; C.c = C.k; C.w = C.v; C.kh = C.ch; C.ts = C.tz; C.j = C.y; C.x = C.ch;
const DIGRAPHS = ['sh', 'ch', 'tz', 'ts', 'kh'];
const VOWELS = ['ai', 'ei', 'oi', 'ui', 'a', 'e', 'i', 'o', 'u'];

/** Parse one transliterated syllable into { onset: [cons], vowel, coda: [cons] }. */
export function parseSyllable(s) {
  s = s.toLowerCase().replace(/[^a-z']/g, '');
  const toks = [];
  for (let i = 0; i < s.length;) {
    const two = s.slice(i, i + 2);
    if (VOWELS.includes(two)) { toks.push({ v: two }); i += 2; continue; }
    if (DIGRAPHS.includes(two)) { toks.push({ c: two }); i += 2; continue; }
    const ch = s[i];
    if ('aeiou'.includes(ch)) toks.push({ v: ch }); else if (C[ch]) toks.push({ c: ch });
    i++;
  }
  const vi = toks.findIndex((t) => t.v);
  if (vi < 0) return { onset: toks.map((t) => t.c), vowel: 'e', coda: [] }; // shva-only fragment
  // a 'y' right after the vowel closes a diphthong (ai, ei, oi)
  const coda = toks.slice(vi + 1).map((t) => t.c || null).filter(Boolean);
  let vowel = toks[vi].v;
  if (coda[0] === 'y' && vowel.length === 1) { vowel += 'i'; coda.shift(); }
  return { onset: toks.slice(0, vi).map((t) => t.c), vowel, coda };
}

// syllabify lives in chant.js (pure, shared with the main thread's caption timing); re-exported for the callers here
export { syllabify } from './chant.js';

// ---------------------------------------------------------------------------------------------
// Glottal source wavetables (band-limited, mip-mapped by maximum harmonic)
// ---------------------------------------------------------------------------------------------
const TABLE_N = 2048;
const LEVELS = [512, 256, 128, 64, 32, 16, 8, 4];
let TABLE_CACHE = null;

/** Rosenberg glottal flow pulse → derivative (the radiated excitation). tp/tn as fractions of the period. */
function pulseSpectrum(tp, tn) {
  const N = 4096, re = new Float64Array(N), im = new Float64Array(N);
  const g = (x) => (x < tp ? 0.5 * (1 - Math.cos(Math.PI * x / tp)) : x < tp + tn ? Math.cos(Math.PI * (x - tp) / (2 * tn)) : 0);
  for (let i = 0; i < N; i++) re[i] = g((i + 1) / N) - g(i / N);
  fft(re, im);
  return { re, im };
}

function buildTables() {
  const shapes = { modal: pulseSpectrum(0.42, 0.18), pressed: pulseSpectrum(0.36, 0.08) };
  const out = {};
  const re = new Float64Array(TABLE_N), im = new Float64Array(TABLE_N);
  for (const [name, sp] of Object.entries(shapes)) {
    out[name] = LEVELS.map((maxH) => {
      // t[i] = Σ_h a_h·cos(2π h i / N + φ_h) = Re(N · IFFT(A)), and IFFT(A) = conj(FFT(conj(A))) / N:
      // one 2048-point FFT per table instead of a ~1M-term cosine sum (each worker builds them once)
      re.fill(0); im.fill(0);
      for (let h = 1; h <= maxH; h++) { re[h] = sp.re[h]; im[h] = -sp.im[h]; }
      fft(re, im);
      const t = new Float32Array(TABLE_N + 1);
      for (let i = 0; i < TABLE_N; i++) t[i] = re[i];
      let p = 0; for (let i = 0; i < TABLE_N; i++) p = Math.max(p, Math.abs(t[i]));
      for (let i = 0; i < TABLE_N; i++) t[i] /= p;
      t[TABLE_N] = t[0];
      return t;
    });
  }
  return out;
}

function tables() { return TABLE_CACHE || (TABLE_CACHE = buildTables()); }
function levelFor(f0, sr) {
  const maxH = 0.45 * sr / Math.max(20, f0);
  for (let k = 0; k < LEVELS.length; k++) if (LEVELS[k] <= maxH) return k;
  return LEVELS.length - 1;
}

// ---------------------------------------------------------------------------------------------
// Segment timeline
// ---------------------------------------------------------------------------------------------

/** Formant targets for a vowel in a voice table, scaled by vocal-tract factor. 'ai' etc. glide. */
let OPEN = 0; // jaw opening for shouts/calls (raises F1, a little F2); set per buildSegments call
function vowelFB(table, v, tract) {
  const t = table[v[0]] || table.a;
  return { F: t.F.map((f, i) => f * tract * (i === 0 ? 1 + 0.18 * OPEN : i === 1 ? 1 + 0.05 * OPEN : 1)), B: t.B.slice() };
}

function consFB(table, cons, nextVowel, tract) {
  const base = vowelFB(table, nextVowel || 'e', tract);
  const loc = cons.locus && LOCI[cons.locus];
  if (!loc) return base;
  return { F: base.F.map((f, i) => (i < 3 ? (loc[i] * tract) * 0.65 + f * 0.35 : f)), B: base.B.map((b, i) => (cons.nasal && i < 2 ? b * 1.8 : b)) };
}

/**
 * Build voice segments from note events.
 * notes: [{ t (vowel onset, s), dur (to next vowel onset), syl, f0 | f0s: [[frac, f0], ...], amp?, hold?, ghost? }]
 * (ghost: not sung — only shapes the end of the note before it, as the next verse does when a chunk is rendered alone)
 * Each segment: { t0, t1, f0, voice, asp, fric: {f,q,amp}|null, burst: {...}|null, F, B, tap, onset }
 */
export function buildSegments(notes, opt) {
  const table = TABLES[opt.type] || TABLES.baritone, tract = opt.tract || 1, rate = opt.consScale || 1;
  OPEN = opt.open || 0;
  const segs = [];
  const parsed = notes.map((e) => (e.rest ? null : parseSyllable(e.syl || 'a')));
  const onsetDur = (p) => (p ? p.onset.reduce((s, c) => s + (C[c]?.dur || 0.05) * rate, 0) : 0);
  for (let n = 0; n < notes.length; n++) {
    const e = notes[n];
    if (e.rest || e.ghost) continue;
    const p = parsed[n];
    // the next syllable's onset consonants are sung before its beat: end this syllable early enough
    const next = notes[n + 1];
    const vEnd = Math.min(e.t + e.dur, next && !next.rest ? next.t - onsetDur(parsed[n + 1]) : Infinity);
    // onset consonants are sung before the beat (the vowel lands on it)
    let t = e.t - onsetDur(p);
    for (const c of p.onset) {
      const cc = C[c]; if (!cc) continue;
      const d = cc.dur * rate;
      segs.push({ kind: 'c', t0: t, t1: t + d, f0: firstF0(e), voice: cc.voice, asp: cc.asp || 0, fric: cc.fric || null, burst: cc.burst || null, tap: !!cc.tap, ...consFB(table, cc, p.vowel, tract), amp: e.amp ?? 1 });
      t += d;
    }
    let codaDur = p.coda.reduce((s, c) => s + (C[c]?.dur || 0.05) * rate * 0.9, 0);
    const room = vEnd - e.t - (e.gap ?? 0);
    if (codaDur > room * 0.5) codaDur = room * 0.5; // fast syllables: squeeze the coda, keep the vowel
    const vowelEnd = Math.max(e.t + 0.03, vEnd - codaDur - (e.gap ?? 0));
    const fb = vowelFB(table, p.vowel, tract);
    const f0s = e.f0s || [[0, e.f0]];
    for (let k = 0; k < f0s.length; k++) {
      const a = e.t + (vowelEnd - e.t) * f0s[k][0], b = k + 1 < f0s.length ? e.t + (vowelEnd - e.t) * f0s[k + 1][0] : vowelEnd;
      // diphthong: glide to /i/ over the last 40 % of the vowel
      if (p.vowel.length === 2 && k === f0s.length - 1) {
        const mid = a + (b - a) * 0.6;
        segs.push({ kind: 'v', t0: a, t1: mid, f0: f0s[k][1], voice: 1, asp: 0, fric: null, burst: null, ...fb, amp: e.amp ?? 1, note: k === 0 });
        segs.push({ kind: 'v', t0: mid, t1: b, f0: f0s[k][1], voice: 1, asp: 0, fric: null, burst: null, ...vowelFB(table, 'i', tract), amp: e.amp ?? 1 });
      } else {
        segs.push({ kind: 'v', t0: a, t1: b, f0: f0s[k][1], voice: 1, asp: 0, fric: null, burst: null, ...fb, amp: e.amp ?? 1, note: true });
      }
    }
    t = vowelEnd;
    const codaScale = p.coda.length ? codaDur / p.coda.reduce((s, c) => s + (C[c]?.dur || 0.05) * rate * 0.9, 0) : 1;
    for (const c of p.coda) {
      const cc = C[c]; if (!cc) continue;
      const d = cc.dur * rate * 0.9 * codaScale;
      segs.push({ kind: 'c', t0: t, t1: t + d, f0: lastF0(e), voice: cc.voice, asp: (cc.asp || 0) * 0.5, fric: cc.fric || null, burst: cc.burst ? { ...cc.burst, amp: cc.burst.amp * 0.6 } : null, tap: !!cc.tap, ...consFB(table, cc, p.vowel, tract), amp: e.amp ?? 1 });
      t += d;
    }
    if (e.breathAfter) segs.push({ kind: 'r', t0: t + 0.03, t1: t + 0.03 + e.breathAfter, f0: lastF0(e), voice: 0, asp: 0, fric: { f: 1500, q: 0.6, amp: opt.inhale ?? 0.05 }, burst: null, ...vowelFB(table, 'a', tract), amp: 1, inhale: true });
  }
  segs.sort((a, b) => a.t0 - b.t0);
  return segs;
}
const firstF0 = (e) => (e.f0s ? e.f0s[0][1] : e.f0);
const lastF0 = (e) => (e.f0s ? e.f0s[e.f0s.length - 1][1] : e.f0);

// ---------------------------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------------------------

/**
 * Render one voice into `out` (mono Float32Array) at time offset 0 = out[0].
 * opt: { type, tract, sr, seed, gain, vib: {rate, depth (cents), delay}, drift (cents), jitter, shimmer,
 *        breath (0..1), effort (0..1), glide (s), singer (dB boost ~2.8 kHz), f1Track (bool), detune (cents) }
 */
export function renderVoice(out, segs, opt) {
  if (!segs.length) return out;
  const sr = opt.sr, rng = new Rng(opt.seed || 7);
  const T = tables(), effort = clamp(opt.effort ?? 0.5, 0, 1);
  const modal = T.modal, pressed = T.pressed;
  const res = [0, 1, 2, 3, 4].map(() => new Reson(sr));
  // Parallel high-formant branch (F6-F8 of a ~17 cm tract, ~1.1 kHz apart): the sung tables cluster
  // F3-F5 below ~3.2 kHz, so the cascade alone leaves the voice dull above that. Source + aspiration feed
  // three bandpasses with alternating signs (Klatt's parallel-branch convention).
  const tr = opt.tract || 1, hiGain = opt.hiGain ?? 1;
  const hi = [[4300, 2.2, 1], [5500, 2.4, -0.7], [7000, 2.2, 0.3]].map(([f, q, g]) => ({ f: new SVF(Math.min(f * tr, sr * 0.45), q, sr), g }));
  const fricF = new SVF(3000, 1, sr), fricF2 = new SVF(3000, 1, sr), burstF = new SVF(2000, 1, sr), fricHP = new OnePole(900, sr);
  const tilt = new OnePole(1200 + effort * 5000, sr), aspHP = new OnePole(400, sr);
  const singer = opt.singer ? new Biquad('peaking', 2800 * (opt.tract || 1), 1.4, opt.singer, sr) : null;
  const vibRate = (opt.vib?.rate || 5.5) * (1 + rng.bi() * 0.08), vibDepth = opt.vib?.depth ?? 0, vibDelay = opt.vib?.delay ?? 0.25;
  const detune = cents(opt.detune || 0), driftC = opt.drift ?? 6, jit = opt.jitter ?? 0.004, shim = opt.shimmer ?? 0.04;
  const breath = opt.breath ?? 0.08, glide = Math.max(0.005, opt.glide ?? 0.06), gain = opt.gain ?? 1;

  const i0 = Math.max(0, Math.floor((segs[0].t0 - 0.05) * sr));
  const lastT = segs.reduce((m, s) => Math.max(m, s.t1), 0);
  const i1 = Math.min(out.length, Math.ceil((lastT + 0.25) * sr));
  const CR = opt.cr || 16; // control rate (samples); 32 on the low tier (≈1 ms steps: still inaudible)
  const kAmp = 1 - Math.exp(-CR / (0.014 * sr)), kF = 1 - Math.exp(-CR / (0.022 * sr)), kFric = 1 - Math.exp(-CR / (0.006 * sr));
  const kGl = 1 - Math.exp(-CR / (glide * sr));
  let si = 0, amp = 0, aspA = 0, fricA = 0, burstA = 0, lf0 = Math.log(segs[0].f0 || 150);
  const F = segs[0].F.slice(), B = segs[0].B.slice();
  let phase = rng.next(), per = 1, perAmp = 1, noteStart = segs[0].t0, driftV = 0, driftT = 0, driftA = 0, driftB = rng.bi();
  let tapPh = -1, noteF0 = 0, seen = -1, inc = 0, fricOn = false, vibPh = rng.next();
  const vibWander = new Drift(rng.fork(3), 0.7, sr / CR, 1), depthWander = new Drift(rng.fork(4), 0.45, sr / CR, 1);
  let level = levelFor(150, sr), tm = modal[level], tp = pressed[level];

  for (let i = i0; i < i1; i++) {
    if ((i - i0) % CR === 0) {
      const t = i / sr;
      while (si < segs.length - 1 && t >= segs[si + 1].t0) si++;
      const s = segs[si];
      const active = t >= s.t0 - 0.002 && t < s.t1;
      if (si !== seen) { // entering a new segment
        seen = si;
        if (s.kind === 'v' && s.note && Math.abs(Math.log(s.f0 / (noteF0 || 1))) > 0.01) { noteStart = s.t0; noteF0 = s.f0; }
        if (s.fric) { fricF.set(s.fric.f * (opt.tract || 1), s.fric.q); fricF2.set(s.fric.f * (opt.tract || 1), s.fric.q); }
        if (s.burst) burstF.set(s.burst.f * (opt.tract || 1), s.burst.q);
      }
      const tgtAmp = active ? s.voice * s.amp : 0;
      amp += (tgtAmp - amp) * (tgtAmp > amp && s.kind === 'v' && amp < 0.05 ? kAmp * 0.45 : kAmp); // softer phrase onsets
      aspA += ((active ? s.asp * 0.6 : 0) - aspA) * kFric;
      fricA += ((active && s.fric ? s.fric.amp * s.amp : 0) - fricA) * kFric;
      // stop burst: a short noise transient at the release of the closure
      if (active && s.burst && t >= s.t1 - 0.018) burstA = s.burst.amp * s.amp; else burstA *= 0.55;
      for (let k = 0; k < 5; k++) { F[k] += (s.F[k] - F[k]) * kF; B[k] += (s.B[k] - B[k]) * kF; }
      if (s.f0) lf0 += (Math.log(s.f0) - lf0) * kGl;
      // tap: brief voicing dip in the middle of an r
      tapPh = active && s.tap ? (t - s.t0) / Math.max(0.01, s.t1 - s.t0) : -1;
      // slow intonation drift
      driftT += CR / sr;
      if (driftT > 0.9) { driftT = 0; driftA = driftB; driftB = rng.bi(); }
      driftV = driftA + (driftB - driftA) * smooth01(driftT / 0.9);
      // high voices raise F1 to the fundamental (vowel tuning)
      const f0now = Math.exp(lf0);
      if (opt.f1Track && F[0] < f0now * 1.1) F[0] = f0now * 1.1;
      for (let k = 0; k < 5; k++) res[k].set(F[k], B[k]);
      level = levelFor(f0now, sr); tm = modal[level]; tp = pressed[level];
      // pitch (vibrato + drift) at control rate: 0.36 ms steps are inaudible, Math.pow per sample is not cheap
      // vibrato wanders in rate (±7 %) and depth (±30 %) like a real singer's; a fixed sine sounds synthetic
      const vt = t - noteStart - vibDelay;
      vibPh += vibRate * (1 + 0.07 * vibWander.next()) * CR / sr;
      const vib = vt > 0 ? vibDepth * (1 + 0.3 * depthWander.next()) * smooth01(vt / 0.35) * Math.sin(TAU * vibPh) : 0;
      inc = f0now * detune * cents(vib + driftV * driftC) / sr;
      fricOn = fricA > 1e-4 || burstA > 1e-4;
    }
    phase += inc * per;
    if (phase >= 1) { phase -= 1; per = 1 + rng.bi() * jit; perAmp = 1 + rng.bi() * shim; }
    const x = phase * TABLE_N, xi = x | 0, fr = x - xi;
    const gm = tm[xi] + (tm[xi + 1] - tm[xi]) * fr, gp = tp[xi] + (tp[xi + 1] - tp[xi]) * fr;
    let src = (gm + (gp - gm) * effort);
    src = src * 0.55 + tilt.process(src) * 0.45 * (2 - effort);
    let a = amp * perAmp;
    if (tapPh >= 0.35 && tapPh <= 0.65) a *= 0.25;
    const noise = rng.bi();
    const open = phase < 0.5 ? 1 : 0.35;
    const asp = aspHP.hp(noise) * (breath * amp * open + aspA * 0.5);
    let y = src * a + asp;
    for (let k = 0; k < 5; k++) y = res[k].process(y);
    if (hiGain) {
      const hin = src * a + asp * 1.3;
      let yh = 0;
      for (let k = 0; k < 3; k++) { hi[k].f.process(hin); yh += hi[k].f.bp * hi[k].g; }
      y += yh * 0.75 * hiGain;
    }
    if (singer) y = singer.process(y);
    // fricative + burst branch (parallel, not through the cascade): 4th-order bandpass on highpassed noise
    if (fricOn) {
      const hn = fricHP.hp(noise);
      fricF.process(hn); fricF2.process(fricF.bp);
      burstF.process(hn);
      y += fricF2.bp * fricA * 1.6 + burstF.bp * burstA * 2;
    }
    out[i] += y * gain;
  }
  return out;
}

export { TABLES };

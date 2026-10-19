// Synthesis registry: cue / loop / IR id → rendered channels. Pure (no DOM, no Web Audio); called from the
// Worker (worker.js), the main-thread fallback, and node tests.
//
// synthesize({ kind: 'cue'|'loop'|'ir', id, opts, sr, seed, tier }) → { channels: Float32Array[], sampleRate, stats }
// Cues are loudness-normalised (loudest 400 ms window, K-weighted as in ITU-R BS.1770 → -16 dB) so the
// mixer's per-cue levels are meaningful; loops are cross-faded seamless, sparse ones normalised like cues.
import { Rng, Biquad, hash, finish, loopify, secs, toDb, db, analyze } from './dsp.js';
import { trumpets, cymbal, kinnorPhrase, nevelPhrase, chalilPhrase, bells } from './instruments.js';
import { gateBoom, greatGateOpen, magrefah, muchni, knock, footsteps, keys, crowdProstrate } from './foley.js';
import { barkai, gevini, shalomCall, grinderChant, bleat, babble } from './calls.js';
import { fire, torch, water, wind, insects, dovesCue, dovesBed, sheepBed } from './nature.js';
import { renderPsalm, PSALM_BY_DAY } from './music.js';
import { impulse } from './ir.js';

const mono = (b) => [b];
// Every tier renders at least the attested minimum on the duchan: 12 men, 9 kinnorot, 2 nevalim (Arachin 2:3-6).
// Weak tiers save worker time per voice instead (control rate, no parallel high-formant branch).
const TIER_CHOIR = {
  low: { men: 12, boys: 2, kinnorot: 9, nevalim: 2, cr: 32, hiGain: 0 },
  medium: { men: 12, boys: 3, kinnorot: 9, nevalim: 2, cr: 24 },
  high: { men: 12, boys: 4, kinnorot: 9, nevalim: 2 },
  ultra: { men: 14, boys: 6, kinnorot: 9, nevalim: 2 },
};

function choir(sr, rng, o, tier) {
  const t = TIER_CHOIR[tier] || TIER_CHOIR.medium;
  const psalm = o.psalm || PSALM_BY_DAY[o.weekday ?? 1] || 48;
  return renderPsalm({ sr, seed: rng.int(1, 1e9), psalm, section: o.section || 0, style: o.style, fluteDay: !!o.fluteDay, ...t, ...(o.men ? { men: o.men } : {}) }).buffer;
}

export const CUES = {
  'trumpet-tekiah': (sr, r, o) => mono(trumpets(sr, r, { ...o, pattern: 'tekiah' })),
  'trumpet-teruah': (sr, r, o) => mono(trumpets(sr, r, { ...o, pattern: 'teruah' })),
  'trumpet-set': (sr, r, o) => mono(trumpets(sr, r, { ...o, pattern: 'set' })),
  'gate-boom': (sr, r, o) => mono(gateBoom(sr, r, o)),
  'great-gate-open': (sr, r, o) => mono(greatGateOpen(sr, r, o)),
  magrefah: (sr, r, o) => mono(magrefah(sr, r, o)),
  muchni: (sr, r, o) => mono(muchni(sr, r, o)),
  knock: (sr, r, o) => mono(knock(sr, r, o)),
  barkai: (sr, r, o) => mono(barkai(sr, r, o)),
  gevini: (sr, r, o) => mono(gevini(sr, r, o)),
  'shalom-call': (sr, r, o) => mono(shalomCall(sr, r, o)),
  cymbal: (sr, r, o) => mono(cymbal(sr, r, o)),
  'choir-psalm': (sr, r, o, tier) => mono(choir(sr, r, o, tier)),
  kinnor: (sr, r, o) => mono(kinnorPhrase(sr, r, o)),
  nevel: (sr, r, o) => mono(nevelPhrase(sr, r, o)),
  chalil: (sr, r, o) => mono(chalilPhrase(sr, r, o)),
  bells: (sr, r, o) => mono(bells(sr, r, o)),
  'grinder-chant': (sr, r, o) => mono(grinderChant(sr, r, o)),
  sheep: (sr, r, o) => mono(bleat(sr, r, o)),
  doves: (sr, r) => mono(dovesCue(sr, r)),
  'crowd-prostrate': (sr, r, o) => mono(crowdProstrate(sr, r, o)),
  footsteps: (sr, r, o) => mono(footsteps(sr, r, o)),
  keys: (sr, r, o) => mono(keys(sr, r, o)),
};

/**
 * Loudness normalisation: loudest 400 ms window of the K-weighted signal (BS.1770: +4 dB shelf above
 * ~1.7 kHz, highpass at 38 Hz) → target, never letting a sample exceed -1 dBFS. Flat RMS would count 30-80 Hz
 * energy as loud and leave boomy cues far quieter than their level estimates.
 */
function normGain(chs, sr, target) {
  let p = 0; for (const c of chs) for (let i = 0; i < c.length; i++) { const a = Math.abs(c[i]); if (a > p) p = a; }
  const kw = chs.map((c) => {
    const x = Float32Array.from(c);
    new Biquad('highshelf', 1681.97, 0.7071752, 4, sr).run(x);
    new Biquad('highpass', 38.13547, 0.500327, 0, sr).run(x);
    return x;
  });
  return Math.min(db(target - loudestWindowDb(kw, sr)), db(-1) / Math.max(1e-9, p));
}

// loops: [length (s), render(sr, rng, dur, opts, tier) → channels, norm: 'rms' (steady beds) | 'window' (sparse), (opts) → dB after norm]
const TIER_BABBLE = { low: 8, medium: 12, high: 16, ultra: 20 };
export const LOOPS = {
  fire: [12, (sr, r, d, o) => fire(sr, r, d, o)],
  torch: [8, (sr, r, d) => torch(sr, r, d)],
  'water-channel': [10, (sr, r, d) => water(sr, r, d)],
  // o.women: share of women's voices (0 for the kohanim and Levites on duty); o.sparse: fewer talkers
  'crowd-murmur': [16, (sr, r, d, o, tier) => [babble(sr, r, { duration: d, talkers: Math.max(4, Math.round((TIER_BABBLE[tier] || 12) * (o.sparse ? 0.6 : 1))), women: o.women })]],
  wind: [20, (sr, r, d) => wind(sr, r, d)],
  doves: [24, (sr, r, d) => dovesBed(sr, r, d), 'window'],
  sheep: [20, (sr, r, d) => sheepBed(sr, r, d), 'window'],
  // the bed's power follows the calling rate: fewer chirps on a cool night, not louder ones (4th field: dB after norm)
  'night-insects': [16, (sr, r, d, o) => insects(sr, r, d, { temp: o.temp }), 'rms', (o) => 10 * Math.log10(Math.max(0.25, Math.min(1.3, (7.2 * (o.temp ?? 24) - 32) / 140.8)))],
  choir: [0, (sr, r, d, o, tier) => [choir(sr, r, { ...o, section: o.section ?? 0 }, tier)], 'window'],
  bells: [0, (sr, r, d, o) => [bells(sr, r, { steps: 12, ...o })], 'window'],
};

function loudestWindowDb(chs, sr, win = 0.4) {
  const w = secs(win, sr), n = chs[0].length;
  let best = 0;
  for (let i = 0; i + w <= n || i === 0; i += w >> 1) {
    let e = 0;
    for (const c of chs) for (let j = i; j < Math.min(n, i + w); j++) e += c[j] * c[j];
    best = Math.max(best, e / (Math.min(w, n - i) * chs.length));
    if (i + w > n) break;
  }
  return toDb(Math.sqrt(best));
}

function gainTo(chs, g) { for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= g; return chs; }

export function synthesize({ kind, id, opts = {}, sr = 48000, seed, tier = 'medium', stats = false }) {
  const s = seed ?? hash(`${kind}:${id}:${opts.variant ?? ''}`) ^ ((opts.v | 0) * 0x9e3779b1);
  const rng = new Rng(s >>> 0);
  let chs, loopLen = 0;
  if (kind === 'ir') {
    chs = impulse(id, sr, s & 0xffff, opts.maxLen || 6);
    return { channels: chs, sampleRate: sr };
  }
  if (kind === 'cue') {
    const fn = CUES[id];
    if (!fn) throw new Error(`unknown cue ${id}`);
    chs = finish(fn(sr, rng, opts, tier), sr, 0.001, 0.05);
    gainTo(chs, normGain(chs, sr, -16));
  } else {
    const def = LOOPS[id];
    if (!def) throw new Error(`unknown loop ${id}`);
    const [len] = def;
    if (len > 0) {
      const xf = Math.min(2, len * 0.15);
      chs = def[1](sr, rng, len + xf, opts, tier);
      loopLen = secs(len, sr);
      chs = loopify(finish(chs, sr, 0, 0), loopLen);
    } else {
      // musical loops: render once, fade the edges; the loop restarts after a breath
      chs = finish(def[1](sr, rng, 0, opts, tier), sr, 0.01, 0.6);
    }
    if (def[2] === 'window') gainTo(chs, normGain(chs, sr, -16));
    else { // steady beds: long-term RMS -20 dBFS (peak-capped)
      let e = 0, m = 0, p = 0;
      for (const c of chs) for (let i = 0; i < c.length; i++) { e += c[i] * c[i]; m++; p = Math.max(p, Math.abs(c[i])); }
      gainTo(chs, Math.min(db(-20 - toDb(Math.sqrt(e / Math.max(1, m))) + (def[3]?.(opts) || 0)), db(-1) / Math.max(1e-9, p)));
    }
  }
  for (const c of chs) for (let i = 0; i < c.length; i++) if (!Number.isFinite(c[i])) c[i] = 0;
  return { channels: chs, sampleRate: sr, stats: stats ? analyze(chs, sr) : undefined };
}

export const CUE_IDS = Object.keys(CUES);
export const LOOP_IDS = Object.keys(LOOPS);

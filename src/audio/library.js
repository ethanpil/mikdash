// Mixer metadata for every cue and loop (ARCHITECTURE.md §11).
//
// Loudness model (docs/decisions/audio.md): each source has an estimated sound level `spl` (dB SPL) at its
// near-field radius `r0` (m). The mix maps real levels to the screen's range with one global compression:
//     dBFS = -10 + 0.6 · (SPL - 100)        (100 dB SPL ≈ -10 dBFS; a 40 dB night bed ≈ -46 dBFS)
// and distance with the PannerNode's exponential model, rolloff 0.6 (= 0.6 · 20·log10 d): a trumpet blast
// (two silver trumpets ≈ 112 dB at 1 m) still sits ~16 dB above the crowd bed 200 m away, across the Mount.
// Rendered buffers are normalised to -16 dB (loudest 400 ms, K-weighted), so playback gain = SPL→dBFS + 16.
//
// send: reverb send scale · cat: mixer category · variants: distinct renders rotated per play ·
// synth: option keys that change the rendered buffer (everything else is playback-only) ·
// people: crowd size the level refers to (+10·log10 N/N0, power sum).
import { songHeading, songId } from './songs.js';

export const ROLLOFF = 0.6;
export const splToGainDb = (spl) => 6 + 0.6 * (spl - 100);

const C = (spl, r0, extra) => ({ spl, r0, send: 0.6, variants: 1, synth: [], priority: 1, ...extra });

export const CUE_LIB = {
  'trumpet-tekiah': C(112, 1, { cat: 'signal', variants: 2, priority: 3, send: 0.7 }),
  'trumpet-teruah': C(112, 1, { cat: 'signal', variants: 2, priority: 3, send: 0.7 }),
  'trumpet-set': C(112, 1, { cat: 'signal', variants: 2, priority: 3, send: 0.7 }),
  'gate-boom': C(100, 2, { cat: 'fx', variants: 2, priority: 2, send: 0.75 }),
  'great-gate-open': C(101, 3, { cat: 'fx', priority: 3, send: 0.8 }),
  magrefah: C(116, 1, { cat: 'fx', variants: 2, priority: 3, send: 0.8 }),
  muchni: C(90, 2, { cat: 'fx', priority: 2, send: 0.65 }),
  knock: C(84, 1, { cat: 'fx', variants: 2, send: 0.6, synth: ['count'] }),
  barkai: C(104, 1, { cat: 'voice', priority: 3, send: 0.55, synth: ['variant'], caption: (o) => (o.variant === 'hebron' ? 'barkai-hebron' : 'barkai') }),
  gevini: C(106, 1, { cat: 'voice', priority: 3, send: 0.55, caption: () => 'gevini' }),
  'shalom-call': C(90, 1, { cat: 'voice', priority: 2, send: 0.55, synth: ['variant'], caption: (o) => (o.variant === 'all-well' ? 'shalom-all-well' : 'shalom-call') }),
  cymbal: C(110, 1, { cat: 'music', variants: 2, priority: 3, send: 0.7 }),
  // lyrics: the section's verses are captioned as they are sung (timeline.js sectionLyrics), after a heading
  'choir-psalm': C(89, 3, { cat: 'music', priority: 3, send: 0.75, synth: ['psalm', 'song', 'section', 'style', 'fluteDay', 'weekday', 'men'], lyrics: true, caption: (o) => songHeading(songId(o), o.section, o.style) }),
  kinnor: C(78, 1, { cat: 'music', variants: 3, send: 0.6 }),
  nevel: C(80, 1, { cat: 'music', variants: 2, send: 0.6 }),
  chalil: C(94, 1, { cat: 'music', variants: 2, priority: 2, send: 0.65 }),
  bells: C(72, 1, { cat: 'fx', variants: 3, priority: 2, send: 0.5, synth: ['steps', 'pace'] }),
  'grinder-chant': C(88, 1, { cat: 'voice', variants: 2, send: 0.55, synth: ['cycles'], caption: () => 'grinder-chant' }),
  sheep: C(88, 1, { cat: 'animal', variants: 6, send: 0.45, synth: ['kind'] }),
  doves: C(70, 1, { cat: 'animal', variants: 4, send: 0.4 }),
  'crowd-prostrate': C(74, 12, { cat: 'crowd', variants: 2, priority: 3, send: 0.7, people: 600 }),
  footsteps: C(56, 1, { cat: 'foley', variants: 4, send: 0.4, synth: ['steps', 'pace'] }),
  keys: C(72, 1, { cat: 'foley', variants: 2, send: 0.5 }),
};
// aliases accepted by cue(): schedule ids may name blast sets this way
export const CUE_ALIAS = {
  'trumpet-tekiah-set': 'trumpet-set', 'trumpets-3': 'trumpet-set', 'tekiah-teruah-tekiah': 'trumpet-set', trumpets: 'trumpet-set', 'blasts-3': 'trumpet-set',
  teruah: 'trumpet-teruah', tekiah: 'trumpet-tekiah', trumpet: 'trumpet-tekiah',
  'great-gate': 'great-gate-open', 'gate-open': 'gate-boom', 'gate-close': 'gate-boom', gate: 'gate-boom', shalom: 'shalom-call',
  choir: 'choir-psalm', psalm: 'choir-psalm', song: 'choir-psalm', 'levites-song': 'choir-psalm', prostration: 'crowd-prostrate',
  'cymbal-crash': 'cymbal', 'muchni-creak': 'muchni', 'kg-bells': 'bells',
};

// Loops. bed: non-spatial stereo bed through the outdoor bus (muffled indoors); spl of a bed = level heard.
export const LOOP_LIB = {
  fire: C(76, 4, { send: 0.4, cat: 'fire', synth: ['size'], priority: 2 }),
  torch: C(56, 0.5, { send: 0.3, cat: 'fire' }),
  'water-channel': C(56, 1, { send: 0.35, cat: 'water' }),
  'crowd-murmur': C(62, 10, { send: 0.55, cat: 'crowd', priority: 2, people: 300, synth: ['women', 'sparse'] }),
  wind: C(43, 1, { bed: true, cat: 'wind', send: 0 }),
  doves: C(47, 4, { bed: true, cat: 'animal', send: 0.3 }),
  sheep: C(70, 2, { send: 0.4, cat: 'animal' }),
  'night-insects': C(48, 1, { bed: true, cat: 'insects', send: 0, synth: ['temp'] }),
  // the section sung through, again and again: plays the choir-psalm cue's own buffer (shareCue), from its start or
  // straight after a choir-psalm cue of the same section that is still sounding; its verses captioned as sung when the
  // caller asks (opts.caption: true)
  choir: C(89, 3, { send: 0.75, cat: 'music', synth: ['psalm', 'song', 'section', 'style', 'fluteDay', 'weekday', 'men'], priority: 3, shareCue: 'choir-psalm', lyrics: true }),
  bells: C(72, 1, { send: 0.5, cat: 'fx', priority: 2 }),
};

/** Voice budget per quality tier (one-shots + active loops). */
export const VOICE_LIMIT = { low: 14, medium: 24, high: 36, ultra: 48 };
/** Synthesis sample rate per tier (low renders at 32 kHz: less CPU and memory; content < 16 kHz). */
export const SYNTH_RATE = { low: 32000, medium: 48000, high: 48000, ultra: 48000 };
/** The Levites' song renders at 32 kHz on medium too: a whole section is 13–71 s (Worker time and ~9 MB at 32 kHz vs
 *  ~13 MB and 1.5× the time at 48 kHz); voices and strings sit below 16 kHz. */
export const CHOIR_RATE = { low: 32000, medium: 32000, high: 48000, ultra: 48000 };
/** Longest impulse response per tier (s). */
export const IR_MAX = { low: 2.2, medium: 3.5, high: 6, ultra: 6 };
/** Rendered-buffer cache budget (MB). */
export const CACHE_MB = { low: 40, medium: 80, high: 140, ultra: 200 };
/** Occlusion raycasts per 100 ms tick. */
export const OCCLUSION_RAYS = { low: 0, medium: 2, high: 4, ultra: 6 };

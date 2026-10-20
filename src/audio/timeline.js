// The libation concert's clock, in seconds, computed (not measured) from the same pure code the synthesis uses — so a
// choreography can stage the trumpeters, the pour, the Levites and the people's prostrations in step with the sound
// without rendering anything (works with ?audio=0 and in node). Also the per-verse caption track of a sung section.
//
// The concert (Tamid 7:3; Sukkah 5:5 — nine blasts = three teki'ah-teru'ah-teki'ah sets; docs/decisions/audio.md):
//   set 0 on the table of the fats → the trumpeters walk to Ben Arza → the pour: the segan waves the sudarin, Ben Arza
//   strikes the cymbal, the Levites begin section 1 → set 1 beside Ben Arza → section 2 → set 2 → section 3.
//   "At each teki'ah, a prostration": the people prostrate at each set (the crowd-prostrate cue starts 2.2 s before
//   the set's buffer ends). sg1612 (Shiltei HaGiborim): the cymbal at every break.
import { psalmMelody, syllabify, SECTION_TAIL } from './synth/chant.js';
import { songId, sectionVerses, sectionText, songHeading, SONGS } from './songs.js';

// trumpet-set buffer (synth/instruments.js trumpets(), pattern 'set'): teki'ah 3.1 s, 0.55 s, teru'ah = 9 short blasts
// (k·0.27 + 0.06 per group of three, each 0.15 s), 0.55 s, teki'ah 3.1 s; 0.03 s lead-in, 0.5 s tail.
const TEKIAH = 3.1, BREAK = 0.55, T0 = 0.03;
const TERUAH = 9 * 0.27 + 0.12;
/** the trumpet-set buffer length (s) */
export const D_SET = T0 + TEKIAH + BREAK + TERUAH + BREAK + TEKIAH + 0.5;
/** the blasts within a set, relative to its start: [{ kind, t0, t1 }] (the second trumpeter is up to 40 ms behind) */
export const SET_BLASTS = (() => {
  const b = [{ kind: 'tekiah', t0: T0, t1: T0 + TEKIAH }];
  const r0 = T0 + TEKIAH + BREAK;
  for (let k = 0; k < 9; k++) {
    const t = r0 + k * 0.27 + Math.floor(k / 3) * 0.06;
    b.push({ kind: 'teruah', t0: t, t1: t + 0.15, group: Math.floor(k / 3) });
  }
  const t2 = r0 + TERUAH + BREAK;
  b.push({ kind: 'tekiah', t0: t2, t1: t2 + TEKIAH });
  return b;
})();
/** crowd-prostrate buffer (synth/foley.js): 5.5 s — cloth from 0.1 s, knees and palms on stone 0.5–3.2 s, the exhale
 *  as they lie flat from 1.3 s */
export const PROSTRATE = { lead: 2.2, duration: 5.5, kneel: 0.5, flat: 1.3, rise: 4.2 };
/** cymbal: the crash at +0.005 s of its 5.5 s buffer; the song starts 0.9 s after it */
export const CYMBAL = { duration: 5.5, toSong: 0.9 };
/** the next set starts this long after a section's last note (the ring-out overlaps it): SECTION_TAIL − 2.6 */
export const SET_AFTER_SECTION = SECTION_TAIL - 2.6;

const cache = new Map();
/**
 * A sung section's timing (s, from the start of its choir-psalm buffer): { id, section, duration (the buffer),
 * singEnd (last note), verses: [{ key, ref {en,he}, he, en, t0, t1 }], heading {en,he} }. Memoised.
 */
export function sectionTiming(opts = {}, section = opts.section ?? 0) {
  const id = songId(opts), s = Math.max(0, Math.min(2, section | 0)), tempo = opts.tempo || 1;
  const key = `${id}:${s}:${tempo}:${opts.style === 'sg1612' ? 'sg' : ''}`;
  let r = cache.get(key);
  if (r) return r;
  const verses = sectionVerses(id, s);
  const { events, length } = psalmMelody(sectionText(id, s), { tempo });
  // events are one per syllable in order; each verse's syllables follow on
  let i = 0;
  const vs = verses.map((v) => {
    const n = syllabify(v.tr).length;
    const a = events[i], b = events[i + n - 1];
    i += n;
    return { key: v.key, ref: v.ref, he: v.he, en: v.en, t0: +a.t.toFixed(3), t1: +(b.t + b.dur - b.breathAfter).toFixed(3) };
  });
  r = { id, section: s, duration: length + SECTION_TAIL, singEnd: +vs[vs.length - 1].t1.toFixed(3), verses: vs, heading: songHeading(id, s, opts.style) };
  cache.set(key, r);
  return r;
}

/**
 * The caption track of a section (s from the buffer start): [{ t, dur, text: {en, he}, key }]. Each verse shows from its
 * first note until the next verse starts (the last one until the ring-out ends).
 */
export function sectionLyrics(opts = {}, section = opts.section ?? 0) {
  const T = sectionTiming(opts, section);
  return T.verses.map((v, k) => {
    const next = T.verses[k + 1]?.t0 ?? T.duration - 1;
    return { t: Math.max(0, v.t0 - 0.15), dur: next - v.t0 + 0.4, key: v.key, text: { en: `${v.en} (${v.ref.en})`, he: v.he } };
  });
}

/**
 * The libation concert's schedule in seconds from the first blast (t = 0), exactly as ctx.audio.libation(opts) plays it.
 * opts: { psalm | song (+ week) | weekday, style ('mishnah'|'sg1612'), walk (s, the trumpeters' walk to Ben Arza;
 *         default 20 — pass the same value as to libation()), gap (s or [s1, s2]: extra pause after section 1 / 2's
 *         last note before the next set; default 0), tempo }.
 * → { song, psalm?, title, style, walk, sets: [{ t0, t1, at: 'table'|'benArza', blasts: [{kind, t0, t1}] }],
 *     prostrations: [{ t0 (sound starts), kneel, flat, rise, t1 }], pour (the cymbal = the pour), cymbals: [t],
 *     sections: [{ index, t0 (cue starts), sing0 (first note), singEnd (last note), t1 (buffer ends), verses: [{ key, ref,
 *     he, en, t0, t1 }] }], cues: [{ id, t, at, opts }] (every sound in order), end (last sound ends), done (when
 *     libation() resolves) }.
 */
export function libationTimeline(opts = {}) {
  const id = songId(opts), S = SONGS[id];
  const sg = opts.style === 'sg1612';
  const walk = Number.isFinite(opts.walk) ? opts.walk : 20;
  const gaps = Array.isArray(opts.gap) ? opts.gap : [opts.gap, opts.gap];
  const sets = [], prostrations = [], cymbals = [], sections = [], cues = [];
  const so = { ...(S.kind === 'psalm' ? { psalm: S.psalm } : { song: id }), style: sg ? 'sg1612' : 'mishnah' };
  let t = 0;
  for (let s = 0; s < 3; s++) {
    const at = s === 0 ? 'table' : 'benArza';
    sets.push({ index: s, t0: r3(t), t1: r3(t + D_SET), at, blasts: SET_BLASTS.map((b) => ({ ...b, t0: r3(t + b.t0), t1: r3(t + b.t1) })) });
    cues.push({ id: 'trumpet-set', t: r3(t), at });
    const p0 = t + D_SET - PROSTRATE.lead;
    prostrations.push({ index: s, t0: r3(p0), kneel: r3(p0 + PROSTRATE.kneel), flat: r3(p0 + PROSTRATE.flat), rise: r3(p0 + PROSTRATE.rise), t1: r3(p0 + PROSTRATE.duration) });
    cues.push({ id: 'crowd-prostrate', t: r3(p0), at: 'crowd' });
    t += D_SET - 0.2;
    if (s === 0) t += walk;
    if (s === 0 || sg) { cymbals.push(r3(t)); cues.push({ id: 'cymbal', t: r3(t), at: 'benArza' }); t += CYMBAL.toSong; }
    const T = sectionTiming({ ...so, tempo: opts.tempo }, s);
    sections.push({
      index: s, t0: r3(t), sing0: r3(t + T.verses[0].t0), singEnd: r3(t + T.singEnd), t1: r3(t + T.duration),
      verses: T.verses.map((v) => ({ ...v, t0: r3(t + v.t0), t1: r3(t + v.t1) })),
    });
    cues.push({ id: 'choir-psalm', t: r3(t), at: 'duchan', opts: { ...so, section: s } });
    t += T.duration - SECTION_TAIL + SET_AFTER_SECTION + (s < 2 ? Math.max(0, +gaps[s] || 0) : 0);
  }
  const end = Math.max(sections[2].t1, prostrations[2].t1);
  return {
    song: id, ...(S.kind === 'psalm' ? { psalm: S.psalm } : {}), title: S.title, style: so.style, walk,
    sets, prostrations, pour: cymbals[0], cymbals, sections, cues, end: r3(end), done: r3(t),
  };
}
const r3 = (x) => Math.round(x * 1000) / 1000;

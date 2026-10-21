// The Levites' song: psalm of the day (Tamid 7:4) — or on Shabbat the musaf's Ha'azinu and the afternoon's Song at
// the Sea / of the Well (Rosh HaShanah 31a) — sung in three sections with a teki'ah and the people's prostration at
// each break (Tamid 7:3). Each section is sung through, every verse of it (src/audio/songs.js). Minimum 12 Levites on the duchan = 9 kinnorot + 2 nevalim +
// 1 cymbal; boy Levites below sweeten the treble (Arachin 2:3-6, 13b; report §27.1, §29).
//
// The melodies are NOT preserved: everything here is a labelled modal reconstruction (docs/decisions/audio.md).
//  * style 'mishnah' (default): unison psalmody on a reciting tone (intonation · recitation · mediant ·
//    termination), Pythagorean-tuned mode on D with B-flat, men in unison, boys an octave above, kinnorot
//    plucking the melody heterophonically, nevalim sounding the final and fifth. No chalil unless a flute day.
//  * style 'sg1612': the Shiltei HaGiborim (Portaleone, Mantua 1612) Renaissance-lens layer (report §54):
//    four-voice homophonic psalmody (falsobordone) in quarter-comma meantone with cadential musica ficta.
//    A style layer, never the default.
import { Rng, Biquad, resonate, cents } from './dsp.js';
import { buildSegments, renderVoice } from './voice.js';
import { psalmMelody, syllabify, melodyChunks, SECTION_TAIL } from './chant.js';
import { SONGS, songId, sectionText, sectionVerses } from '../songs.js';
import { pluck, reedNote, BODY } from './instruments.js';
import { CHOIR_CAL } from './choir-cal.js';

// The texts (Hebrew, chant syllables, English) and the three sections of each psalm and song are in ../songs.js.
// Divine names are sung in their customary substitutes (Hashem, Elokim, Kel, Kah): a simulation, not liturgy.
/** psalm number → { sections: [chant text × 3] } — every verse of each section (kept for older callers) */
export const PSALMS = Object.fromEntries(Object.values(SONGS).filter((S) => S.kind === 'psalm')
  .map((S) => [S.psalm, { get sections() { return [0, 1, 2].map((k) => sectionText(`psalm-${S.psalm}`, k)); } }]));
export { PSALM_BY_DAY } from './meta.js';

// ---------------------------------------------------------------------------------------------
// Tuning: the mode on D with B-flat (degrees D E F G A Bb C D')
// ---------------------------------------------------------------------------------------------
const PYTH = { D: 1, E: 9 / 8, F: 32 / 27, G: 4 / 3, A: 3 / 2, Bb: 128 / 81, C: 16 / 9, 'C#': 243 / 128, 'F#': 81 / 64 };
// quarter-comma meantone from D (fifths 696.58 c)
const MT_FIFTH = Math.pow(5, 1 / 4);
const mt = (k) => { let r = Math.pow(MT_FIFTH, k); while (r >= 2) r /= 2; while (r < 1) r *= 2; return r; };
const MEANTONE = { D: 1, A: mt(1), E: mt(2), B: mt(3), 'F#': mt(4), 'C#': mt(5), G: mt(-1), C: mt(-2), F: mt(-3), Bb: mt(-4) };
export const D3 = 146.83;
/** frequency of note name with octave offset relative to D3 (octave 3) e.g. ('A', 3) */
export function freq(name, oct = 3, tuning = 'pyth') {
  const t = tuning === 'meantone' ? MEANTONE : PYTH;
  return D3 * t[name] * Math.pow(2, oct - 3);
}

// The psalm-tone melody (intonation F-G, recitation on A, mediant Bb-A-G, termination G-F-E-D) is in chant.js, pure,
// so the main thread times captions and libationTimeline() exactly as this renders.
export { psalmMelody };

// falsobordone voicing for the SG 1612 layer: melody (tenor) note → [bass, tenor, alto, cantus] (name, octave)
const FB = {
  A: [['D', 3], ['A', 3], ['D', 4], ['F', 4]],
  Bb: [['Bb', 2], ['Bb', 3], ['D', 4], ['F', 4]],
  G: [['G', 2], ['G', 3], ['Bb', 3], ['D', 4]],
  F: [['F', 2], ['F', 3], ['A', 3], ['C', 4]],
  E: [['A', 2], ['E', 3], ['A', 3], ['C#', 4]],
  D: [['D', 2], ['D', 3], ['A', 3], ['F#', 4]],
  Am: [['A', 2], ['A', 3], ['E', 4], ['C#', 4]], // mediant half-cadence (A major with ficta C#)
};

// ---------------------------------------------------------------------------------------------
// Choir renderer
// ---------------------------------------------------------------------------------------------
/**
 * Render a psalm section with voices and the Levites' strings. Mono Float32Array.
 * o: { sr, seed, psalm | song (src/audio/songs.js ids), section, style, men, boys, kinnorot, nevalim, fluteDay, tempo, text,
 *      cr, hiGain (per-voice cost: control rate, parallel high-formant branch — weak tiers),
 *      chunk (one verse only: chant.js melodyChunks — its buffer starts at that chunk's t0 on the section's clock),
 *      stringsGain (the strings' level against the voices; default: their peaks matched, 0.32 — choirCalibration) }
 * → { buffer, length (the whole section's), events, chunk, voicePeak, stringsPeak }
 */
export function renderPsalm(o) {
  const sr = o.sr, rng = new Rng(o.seed || 48);
  const section = Math.max(0, Math.min(2, o.section | 0));
  const verses = o.text ? null : sectionVerses(songId(o), section);
  const text = o.text || sectionText(songId(o), section);
  const style = o.style === 'sg1612' ? 'sg1612' : 'mishnah';
  const tuning = style === 'sg1612' ? 'meantone' : 'pyth';
  const { events, length } = psalmMelody(text, { tempo: o.tempo || 1 });
  const total = length + SECTION_TAIL;
  // one verse (o.chunk): its own events on its own buffer, which starts at the chunk's t0 on the section's clock
  const chunks = Number.isInteger(o.chunk) && verses ? melodyChunks(events, length, verses.map((v) => syllabify(v.tr).length)) : null;
  const chunk = chunks ? chunks[Math.max(0, Math.min(chunks.length - 1, o.chunk))] : null;
  const t0 = chunk ? chunk.t0 : 0, e0 = chunk ? chunk.e0 : 0, e1 = chunk ? chunk.e1 : events.length;
  const out = new Float32Array(Math.ceil((chunk ? chunk.t1 - chunk.t0 : total) * sr));

  const men = o.men ?? 12, boys = style === 'sg1612' ? 0 : (o.boys ?? 4);
  const types = ['bass', 'baritone', 'baritone', 'tenor'];
  // per-singer realisation of the shared melody: own timing, intonation, vibrato, timbre. Drawn for every event of the
  // section, so a chunk's notes are exactly the whole section's; the next verse's first note closes the chunk's last
  // syllable (a ghost: not sung) as it does in the whole section
  const singerNotes = (part, octave, lag, jitter, r) => {
    const all = events.map((e) => {
      const names = part ? part(e) : e.notes;
      const dt = lag + Math.max(-0.035, Math.min(0.035, r.gauss() * jitter));
      return {
        t: e.t + dt - t0, dur: e.dur, syl: e.syl, gap: e.gap, breathAfter: e.breathAfter ? Math.min(0.28, e.breathAfter * 0.6) : 0,
        f0s: names.map(([fr, nm, oc]) => [fr, freq(nm, (oc ?? 3) + octave, tuning)]),
        amp: e.stress ? 1 : 0.86,
      };
    });
    return chunk ? [...all.slice(e0, e1), ...(e1 < all.length ? [{ ...all[e1], ghost: true }] : [])] : all;
  };

  const voices = [];
  if (style === 'mishnah') {
    for (let k = 0; k < men; k++) {
      const r = rng.fork(k + 1), type = types[k % types.length];
      voices.push({
        notes: singerNotes(null, 0, r.uni(0, 0.025), 0.016, r),
        opt: {
          type, tract: r.uni(0.94, 1.06), seed: r.int(1, 1e9), detune: r.gauss() * 7, drift: r.uni(4, 9), jitter: 0.004, shimmer: 0.05,
          vib: { rate: r.uni(4.7, 6.0), depth: r.uni(10, 28), delay: r.uni(0.18, 0.35) }, effort: r.uni(0.55, 0.78), singer: r.uni(3, 6),
          breath: r.uni(0.05, 0.11), glide: r.uni(0.05, 0.09), gain: r.uni(0.8, 1.15), cr: o.cr, hiGain: o.hiGain,
        },
      });
    }
    // boy Levites (tzo'arei haLeviim): the melody an octave up, simpler (no melisma), lighter vibrato
    const simple = (e) => (e.notes.length > 2 ? [e.notes[0], e.notes[e.notes.length - 1]] : e.notes);
    for (let k = 0; k < boys; k++) {
      const r = rng.fork(100 + k);
      voices.push({
        notes: singerNotes(simple, 1, r.uni(0, 0.03), 0.02, r),
        opt: {
          type: 'boy', tract: r.uni(1.02, 1.1), seed: r.int(1, 1e9), detune: r.gauss() * 9, drift: r.uni(5, 10), jitter: 0.005, shimmer: 0.05,
          vib: { rate: r.uni(5.2, 6.3), depth: r.uni(6, 14), delay: 0.3 }, effort: r.uni(0.45, 0.6), singer: 0, breath: r.uni(0.1, 0.16),
          glide: 0.06, gain: r.uni(0.5, 0.65), f1Track: true, hiGain: o.hiGain ?? 0.7, cr: o.cr,
        },
      });
    }
  } else {
    // SG 1612 (Magen I, report §54): each section sung "in four voices" by its group of four Levites; all
    // twelve together in the last section. Four parts: bass, tenor (the psalm tone), alto, cantus.
    const parts = [0, 1, 2, 3];
    const pt = ['bass', 'tenor', 'tenor', 'tenor'];
    const tr = [0.96, 1.0, 1.06, 1.1];
    const singers = (o.section | 0) < 2 ? Math.max(4, Math.round(men / 3)) : men;
    for (let k = 0; k < singers; k++) {
      const r = rng.fork(k + 1), p = parts[k % 4];
      const part = (e) => e.notes.map(([fr, nm]) => {
        const key = e.cadence === 'm' && nm === 'A' ? 'Am' : nm;
        const v = (FB[key] || FB.A)[p];
        return [fr, v[0], v[1]];
      });
      voices.push({
        notes: singerNotes(part, 0, r.uni(0, 0.015), 0.01, r),
        opt: {
          type: pt[p], tract: tr[p] * r.uni(0.97, 1.03), seed: r.int(1, 1e9), detune: r.gauss() * 5, drift: r.uni(3, 6), jitter: 0.004, shimmer: 0.04,
          vib: { rate: r.uni(4.8, 5.8), depth: r.uni(8, 18), delay: 0.3 }, effort: r.uni(0.5, 0.7), singer: r.uni(3, 5), breath: 0.07,
          glide: 0.05, gain: p === 0 ? 1.1 : 0.95, f1Track: p === 3, cr: o.cr, hiGain: o.hiGain,
        },
      });
    }
  }
  for (const v of voices) {
    const segs = buildSegments(v.notes, { type: v.opt.type, tract: v.opt.tract, inhale: 0.035 });
    renderVoice(out, segs, { ...v.opt, sr });
  }
  const voicePeak = peakOf(out);

  // strings: kinnorot (lyres) pluck the melody heterophonically; nevalim (larger, lower) the final & fifth.
  // sg1612 voices Shiltei HaGiborim's identifications (report §54): kinnor = arpa (harp: finger-plucked near
  // mid-string, long ring, soft contact), nevel = liuto (lute: paired courses, plucked near the bridge,
  // strumming the four-part chord); 12 players = 9 harps + 3 lutes (Magen I: "12 singers + 12 players").
  const sg = style === 'sg1612';
  const kinBus = new Float32Array(out.length), nevBus = new Float32Array(out.length);
  const kin = o.kinnorot ?? 9, nev = sg ? 3 : o.nevalim ?? 2;
  const kp = sg ? { decay: 2.8, bright: 0.4, pick: [0.3, 0.45], click: 0.04, clickLp: 2200 } : { decay: 1.6, bright: 0.55, pick: [0.12, 0.22] };
  // each event draws from its own stream, so a chunk plucks exactly as the whole section does
  const kroot = rng.fork(777);
  for (let i = e0; i < e1; i++) {
    const e = events[i], kr = kroot.fork(i + 1), et = e.t - t0;
    const [, first] = e.notes[0];
    const key = sg ? (FB[e.cadence === 'm' && first === 'A' ? 'Am' : first] || FB.A) : null;
    if (e.stress || e.cadence || kr.chance(0.35)) {
      const n = Math.max(1, Math.round(kin * (e.cadence ? 0.6 : e.stress ? 0.35 : 0.15)));
      for (let j = 0; j < n; j++) {
        const [fr, nm, oc] = sg ? [0, ...key[1 + (j % 3)]] : kr.pick(e.notes);
        const octave = sg ? oc : kr.chance(0.6) ? 4 : 5;
        const t = et + fr * e.dur * 0.8 + kr.uni(-0.02, 0.05) + j * 0.012;
        pluck(kinBus, sr, kr, { t, f: freq(nm, octave, tuning), amp: kr.uni(0.25, 0.45), decay: kp.decay, bright: kp.bright, pick: kr.uni(kp.pick[0], kp.pick[1]), click: kp.click, clickLp: kp.clickLp });
      }
    }
    if ((e.cadence || i === 0 || (e.stress && kr.chance(0.3))) && nev > 0) {
      if (sg) {
        // lutes: bass, tenor and alto of the chord, thumb then fingers; each note on a paired course
        for (let j = 0; j < nev; j++) key.slice(0, 3).forEach(([nm, oc], m) => {
          const t = et + kr.uni(-0.01, 0.04) + j * 0.02 + m * 0.028, f = freq(nm, oc, tuning);
          for (const c of [-1, 1]) pluck(nevBus, sr, kr, { t: t + (c > 0 ? kr.uni(0.003, 0.009) : 0), f: f * cents(c * kr.uni(1.5, 3.5)), amp: kr.uni(0.3, 0.42), decay: 2.2, bright: 0.7, pick: kr.uni(0.09, 0.14), click: 0.07, clickLp: 4500 });
        });
      } else {
        const names = e.cadence === 'f' ? [['D', 2], ['A', 2]] : [['D', 2], ['A', 2]].slice(0, kr.chance(0.5) ? 2 : 1);
        for (let j = 0; j < nev; j++) for (const [nm, oc] of names) {
          pluck(nevBus, sr, kr, { t: et + kr.uni(-0.01, 0.06) + j * 0.03, f: freq(nm, oc, tuning) * (j ? 2 : 1), amp: kr.uni(0.45, 0.6), decay: 3.2, bright: 0.35, pick: 0.3 });
        }
      }
    }
  }
  const str = resonate(kinBus, sr, sg ? BODY.harp : BODY.kinnor, 0.7);
  const nb = resonate(nevBus, sr, sg ? BODY.lute : BODY.nevel, 0.6);
  for (let i = 0; i < str.length; i++) str[i] += nb[i] * 0.8;
  // flute days only (Arachin 2:3): the chalil doubles the melody; never on an ordinary weekday
  if (o.fluteDay) chalilLine(str, sr, rng.fork(55 + (chunk ? chunk.k : 0)), events.slice(e0, e1).map((e) => ({ ...e, t: e.t - t0 })), tuning);
  const sp = peakOf(str);
  if (sp > 0) { const g = Number.isFinite(o.stringsGain) ? o.stringsGain : (voicePeak * 0.32) / sp; for (let i = 0; i < out.length; i++) out[i] += str[i] * g; }
  return { buffer: out, length: total, events, chunk, voicePeak, stringsPeak: sp };
}

// One level for every verse of a section: a verse rendered alone cannot be normalised on its own (the loudest 400 ms
// of a unison choir is a chance alignment of its voices, ±2 dB from verse to verse), so the strings' balance and the
// output gain are calibrated once per choir (the same singers, tier and style) on a fixed phrase it sings, and applied
// to the whole section and to each verse alike. Psalm 150:4, which names no Divine Name. The standard choirs' values are
// precomputed (choir-cal.js, written by dev/songs-test.mjs --write-cal, which also checks them): no Worker time.
export const REF_TEXT = 'ha-le-lu-hu ve-tof u-ma-chol, ha-le-lu-hu be-mi-nim ve-u-gav.';
const CAL = new Map();
/** the configuration a calibration depends on (renderPsalm's options without the text, chunk and tempo) */
export function calConfig(o) {
  const style = o.style === 'sg1612' ? 'sg1612' : 'mishnah';
  return {
    sr: o.sr, seed: o.seed || 48, style, section: style === 'sg1612' && (o.section | 0) >= 2 ? 2 : 0, men: o.men ?? 12, boys: style === 'sg1612' ? 0 : o.boys ?? 4,
    kinnorot: o.kinnorot ?? 9, nevalim: o.nevalim ?? 2, fluteDay: !!o.fluteDay, cr: o.cr, hiGain: o.hiGain, // (unset: renderPsalm's defaults)
  };
}
export const calKey = (p) => [p.sr, p.seed, p.style, p.section, p.men, p.boys, p.kinnorot, p.nevalim, p.fluteDay ? 1 : 0, p.cr ?? '-', p.hiGain ?? '-'].join('|');
/**
 * The choir's calibration (memoised per configuration): { stringsGain (as renderPsalm's default would set it on the
 * reference), loudDb (K-weighted level of the reference, gated mean of its 400 ms windows within 20 dB of the loudest) }.
 * o: renderPsalm's options (the text, chunk and tempo are ignored). fresh: compute it, never the precomputed table.
 */
export function choirCalibration(o, fresh = false) {
  const p = calConfig(o), key = calKey(p);
  let c = fresh ? null : CHOIR_CAL[key] || CAL.get(key);
  if (c) return c;
  const r = renderPsalm({ ...p, text: REF_TEXT });
  c = { stringsGain: r.stringsPeak > 0 ? (r.voicePeak * 0.32) / r.stringsPeak : 0, loudDb: gatedLoudness(r.buffer, o.sr) };
  if (!fresh) CAL.set(key, c);
  return c;
}

/** K-weighted (BS.1770 pre-filter) level, dB: the mean power of the 400 ms windows within 20 dB of the loudest */
export function gatedLoudness(x, sr) {
  const k = Float32Array.from(x);
  new Biquad('highshelf', 1681.97, 0.7071752, 4, sr).run(k);
  new Biquad('highpass', 38.13547, 0.500327, 0, sr).run(k);
  const w = Math.round(0.4 * sr), win = [];
  for (let i = 0; i + w <= k.length; i += w >> 1) { let e = 0; for (let j = i; j < i + w; j++) e += k[j] * k[j]; win.push(e / w); }
  const max = Math.max(...win), gate = max * 0.01, on = win.filter((e) => e >= gate);
  return 10 * Math.log10(on.reduce((s, e) => s + e, 0) / Math.max(1, on.length) + 1e-12);
}

function chalilLine(out, sr, r, events, tuning) {
  for (const e of events) {
    if (!e.stress && !e.cadence) continue;
    for (const [fr, nm] of e.notes) reedNote(out, sr, r, e.t + fr * e.dur, Math.max(0.2, e.dur * 0.6), freq(nm, 4, tuning), { amp: 0.35 });
  }
}

function peakOf(b) { let p = 0; for (let i = 0; i < b.length; i++) { const a = Math.abs(b[i]); if (a > p) p = a; } return p; }

// The chant's timing, without any DSP: syllables of a transliterated text and the psalm-tone melody laid on them.
// Pure and small, so the main thread (captions, libationTimeline) times a section exactly as the Worker renders it.

/**
 * Split a text line into syllables: words separated by spaces, syllables by '-'. Stress defaults to the
 * last syllable of a word (Hebrew milra); '*' after a syllable marks it stressed (e.g. penultimate, milel).
 * ',' ends a half-verse, '.' a verse. Returns [{ syl, stress, wordEnd, pause: 0|1|2 }].
 */
export function syllabify(text) {
  const out = [];
  for (const raw of text.trim().split(/\s+/)) {
    let pause = 0, w = raw;
    if (/[.;!?]$/.test(w)) pause = 2; else if (/,$/.test(w)) pause = 1;
    w = w.replace(/[.,;!?]+$/, '');
    if (!w) continue;
    const parts = w.split('-').filter(Boolean);
    let stressIdx = parts.length - 1;
    parts.forEach((p, k) => { if (p.endsWith('*')) stressIdx = k; });
    parts.forEach((p, k) => out.push({
      syl: p.replace('*', ''), stress: k === stressIdx, wordEnd: k === parts.length - 1, pause: k === parts.length - 1 ? pause : 0,
    }));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Psalm-tone melody (reconstruction): intonation F-G → recite A; mediant: accent Bb→A, after-tones G;
// termination: preparatory accent on A (Bb grace), then G-F-E → D.
// ---------------------------------------------------------------------------------------------
/** Returns { events: [{ t, dur, syl, notes: [[frac, name]], stress, cadence: 'm'|'f'|null, breathAfter }], length }. */
export function psalmMelody(text, { tempo = 1, firstIntonation = true } = {}) {
  const syl = syllabify(text);
  // split into hemistichs at pauses
  const hemis = []; let cur = [];
  for (const s of syl) { cur.push(s); if (s.pause) { hemis.push({ syl: cur, end: s.pause }); cur = []; } }
  if (cur.length) hemis.push({ syl: cur, end: 2 });
  const out = [];
  let t = 0.25, verseStart = true;
  const U = 0.27 / tempo, S = 0.41 / tempo, M = 0.3 / tempo;
  for (const h of hemis) {
    const n = h.syl.length;
    const stresses = h.syl.map((s, i) => (s.stress ? i : -1)).filter((i) => i >= 0);
    const last = stresses[stresses.length - 1] ?? n - 1, prep = stresses[stresses.length - 2] ?? -1;
    const final = h.end === 2;
    for (let i = 0; i < n; i++) {
      const s = h.syl[i];
      let notes, dur = s.stress ? S : U, cadence = null;
      if (verseStart && firstIntonation && i < 2 && i < last - 1) notes = [[0, i === 0 ? 'F' : 'G']];
      else if (i < last) notes = [[0, final && i === prep ? 'A' : (final && i > prep && prep >= 0 ? 'G' : 'A')]];
      if (final && i === prep) { notes = [[0, 'Bb'], [0.3, 'A']]; dur = S * 1.15; }
      if (i === last) {
        cadence = final ? 'f' : 'm';
        if (final) { notes = i === n - 1 ? [[0, 'G'], [0.25, 'F'], [0.5, 'E'], [0.72, 'D']] : [[0, 'G'], [0.4, 'F'], [0.72, 'E']]; dur = M * (i === n - 1 ? 5.2 : 3); }
        else { notes = i === n - 1 ? [[0, 'Bb'], [0.35, 'A'], [0.7, 'G']] : [[0, 'Bb'], [0.5, 'A']]; dur = M * (i === n - 1 ? 3.4 : 2); }
      } else if (i > last) {
        notes = final ? [[0, i === n - 1 ? 'D' : 'E']] : [[0, 'G']];
        if (i === n - 1) dur = final ? M * 3.2 : M * 2;
      }
      const breathAfter = i === n - 1 ? (final ? 0.55 : 0.3) / tempo : 0;
      out.push({ t, dur: dur + breathAfter, syl: s.syl, notes, stress: s.stress, cadence, breathAfter, hemi: h, gap: breathAfter });
      t += dur + breathAfter;
    }
    verseStart = final;
  }
  return { events: out, length: t };
}

/** A rendered section is the melody plus this ring-out (strings, reverberant tail) — renderPsalm(). */
export const SECTION_TAIL = 3.5;

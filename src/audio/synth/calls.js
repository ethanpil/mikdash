// Voices of the Mikdash: the lookout's "Barkai!" (Tamid 3:2), Gevini the crier (Yoma 20b; Shekalim 5:1),
// the Ish Har HaBayit's "Shalom alecha" (Middot 1:2) and the torch companies' "Shalom, hakol shalom"
// (Tamid 1:3), the grinder's "hadek heitev" (Keritot 6b), sheep, and the murmur of a crowd.
import { secs, addInto } from './dsp.js';
import { syllabify, buildSegments, renderVoice } from './voice.js';
import { pestle } from './foley.js';

export { CAPTIONS } from './meta.js';

const SHOUT = { type: 'tenor', effort: 1, open: 1, singer: 4, breath: 0.07, jitter: 0.008, shimmer: 0.08, glide: 0.07, drift: 6 };

/**
 * Speak/call a line with a pitch contour. spec: [{ text, t, rate (s/syl), base (Hz), peak (Hz), hold (s), fall (ratio) }]
 * The last stressed syllable of each phrase is held and carries the call's peak, then falls.
 */
function callLine(out, sr, rng, phrases, voice) {
  for (const ph of phrases) {
    const syl = syllabify(ph.text);
    const lastStress = syl.map((s, i) => (s.stress ? i : -1)).filter((i) => i >= 0).pop() ?? syl.length - 1;
    let t = ph.t;
    const notes = syl.map((s, i) => {
      const held = i === lastStress;
      const dur = held ? ph.hold : (s.stress ? ph.rate * 1.35 : ph.rate);
      const step = (i / Math.max(1, syl.length - 1));
      const f = held ? null : ph.base * (1 + (ph.rise ?? 0.06) * step) * (s.stress ? 1.05 : 1);
      const n = held
        ? { t, dur, syl: s.syl, f0s: [[0, ph.base * 1.1], [0.12, ph.peak], [0.7, ph.peak * 0.98], [0.86, ph.peak * (ph.fall ?? 0.85)]], amp: 1 }
        : { t, dur, syl: s.syl, f0: f, amp: s.stress ? 1 : 0.85 };
      t += dur;
      return n;
    });
    const segs = buildSegments(notes, { type: voice.type, tract: voice.tract, open: voice.open, consScale: ph.cons ?? 0.9 });
    renderVoice(out, segs, { ...voice, sr, seed: rng.int(1, 1e9), vib: { rate: 5.6, depth: voice.vibDepth ?? 14, delay: 0.3 } });
  }
  return out;
}

export function barkai(sr, rng, o = {}) {
  if (o.variant === 'hebron') {
    const out = new Float32Array(secs(6, sr));
    // the officer calls up to the lookout; the lookout answers from above
    callLine(out, sr, rng, [{ text: 'He-ir pe-nei kol ha-miz-rach ad she-be-chev-ron?', t: 0.15, rate: 0.17, base: 150, peak: 205, hold: 0.75, fall: 1.06, rise: 0.15 }],
      { ...SHOUT, type: 'baritone', tract: 0.97, effort: 0.8, gain: 1 });
    callLine(out, sr, rng, [{ text: 'Hein!', t: 3.6, rate: 0.2, base: 230, peak: 285, hold: 0.85, fall: 0.86 }], { ...SHOUT, tract: 1.03, gain: 1.1 });
    return out;
  }
  const out = new Float32Array(secs(2.6, sr));
  return callLine(out, sr, rng, [{ text: 'Bar-kai!', t: 0.2, rate: 0.2, base: 245, peak: 312, hold: 1.25, fall: 0.84 }], { ...SHOUT, tract: 1.02, gain: 1 });
}

export function gevini(sr, rng) {
  const out = new Float32Array(secs(9, sr));
  // the crier's chant: phrases on a high reciting pitch, each closing on a long carried note (heard 3 parsaot)
  return callLine(out, sr, rng, [
    { text: 'Im-du ko-ha-nim la-a-vo-dat-chem,', t: 0.2, rate: 0.16, base: 205, peak: 262, hold: 1.0, fall: 0.88 },
    { text: 'u-le-vi-yim le-du-chan-chem,', t: 3.05, rate: 0.16, base: 210, peak: 270, hold: 1.0, fall: 0.87 },
    { text: 've-yis-ra-el le-ma-a-mad-chem!', t: 5.65, rate: 0.16, base: 215, peak: 290, hold: 1.6, fall: 0.78 },
  ], { ...SHOUT, type: 'baritone', tract: 1.0, gain: 1, vibDepth: 18 });
}

export function shalomCall(sr, rng, o = {}) {
  if (o.variant === 'all-well') {
    const out = new Float32Array(secs(4, sr));
    callLine(out, sr, rng, [{ text: 'Sha-lom!', t: 0.15, rate: 0.2, base: 160, peak: 195, hold: 0.6, fall: 0.85 }], { ...SHOUT, type: 'baritone', effort: 0.75, open: 0.5, tract: 0.98, gain: 1 });
    callLine(out, sr, rng, [{ text: 'Ha-kol sha-lom.', t: 1.35, rate: 0.19, base: 150, peak: 180, hold: 0.7, fall: 0.8 }], { ...SHOUT, type: 'bass', effort: 0.7, open: 0.4, tract: 0.95, gain: 1 });
    return out;
  }
  const out = new Float32Array(secs(2.8, sr));
  return callLine(out, sr, rng, [{ text: 'Sha-lom a-le*-cha!', t: 0.15, rate: 0.19, base: 170, peak: 215, hold: 0.5, fall: 0.86 }], { ...SHOUT, type: 'baritone', effort: 0.8, open: 0.6, tract: 0.99, gain: 1 });
}

/** The Beit Avtinas grinder (Keritot 6b): work-chant in time with the pestle. */
export function grinderChant(sr, rng, o = {}) {
  const cycles = o.cycles || 3, beat = 0.62;
  const out = new Float32Array(secs(cycles * beat * 4 + 1.5, sr));
  const line = [['ha', 196], ['dek', 220], ['hei', 220], ['tev', 196], ['hei', 196], ['tev', 220], ['ha', 175], ['dek', 196]];
  const notes = [];
  for (let c = 0; c < cycles; c++) {
    line.forEach(([syl, f], k) => {
      const onBeat = k % 2 === 1;
      const t = 0.3 + c * beat * 4 + Math.floor(k / 2) * beat + (onBeat ? beat * 0.45 : 0);
      notes.push({ t, dur: onBeat ? beat * 0.5 : beat * 0.42, syl, f0: f * (c === cycles - 1 && k === 7 ? 0.9 : 1), amp: onBeat ? 1 : 0.8 });
      if (onBeat) pestle(out, sr, rng, t - 0.01, rng.uni(0.8, 1));
    });
  }
  const segs = buildSegments(notes, { type: 'baritone', tract: 0.99 });
  const v = new Float32Array(out.length);
  renderVoice(v, segs, { sr, seed: rng.int(1, 1e9), type: 'baritone', effort: 0.65, singer: 2, breath: 0.09, vib: { rate: 5.2, depth: 8, delay: 0.25 }, glide: 0.04 });
  addInto(out, v, 0, 1.6);
  return out;
}

/** A sheep's bleat: nasal onset, strong ~10 Hz quaver of pitch and level, open "eh-ah". kind: lamb|ewe|ram */
export function bleat(sr, rng, o = {}) {
  const kind = o.kind || rng.pick(['lamb', 'lamb', 'ewe', 'ram']);
  const f = kind === 'lamb' ? rng.uni(400, 520) : kind === 'ewe' ? rng.uni(250, 320) : rng.uni(170, 215);
  const dur = rng.uni(0.55, 1.05) * (kind === 'lamb' ? 0.85 : 1);
  const out = new Float32Array(secs(dur + 0.5, sr));
  const notes = [{ t: 0.12, dur: dur * 0.45, syl: 'me', f0s: [[0, f * 0.9], [0.35, f * 1.04]] }, { t: 0.12 + dur * 0.45, dur: dur * 0.55, syl: 'ah', f0s: [[0, f], [0.7, f * 0.93]] }];
  const segs = buildSegments(notes, { type: 'woman', tract: kind === 'lamb' ? 1.12 : kind === 'ewe' ? 1.0 : 0.88, open: 0.6 });
  return renderVoice(out, segs, { sr, seed: rng.int(1, 1e9), type: 'woman', effort: 0.85, breath: 0.22, jitter: 0.02, shimmer: 0.18, glide: 0.04, vib: { rate: rng.uni(9, 12.5), depth: rng.uni(55, 95), delay: 0.04 }, drift: 15 });
}

const SYLS = ['ba', 'ka', 'shi', 'le', 'mo', 'ra', 'ne', 'ta', 'da', 've', 'yo', 'ha', 'tzi', 'ge', 'lo', 'mi', 'en', 'at', 'hu', 'ze', 'ki', 'sha', 'ma', 'el', 'ad', 'nu', 'be', 'sim', 'kol', 'tov', 'ech', 'ri', 'ach', 'dol', 'ya', 'or', 'pe', 'sa', 'ken'];

/** Murmur of many people talking low (crowd-murmur bed). o: { talkers, duration, women (share, default 0.35) } */
export function babble(sr, rng, o = {}) {
  const dur = o.duration || 16, talkers = o.talkers || 16, women = o.women ?? 0.35;
  const out = new Float32Array(secs(dur, sr));
  for (let k = 0; k < talkers; k++) {
    const r = rng.fork(k + 11), woman = r.next() < women;
    const base = woman ? r.uni(185, 230) : r.uni(100, 135);
    const notes = [];
    let t = r.uni(-0.5, 1.5);
    while (t < dur - 0.5) {
      const n = r.int(4, 13), syl = 1 / r.uni(4.2, 5.8);
      for (let i = 0; i < n; i++) {
        const decl = 1.08 - 0.18 * (i / n);
        notes.push({ t, dur: syl * (i === n - 1 ? 1.6 : 1), syl: r.pick(SYLS), f0: base * decl * (1 + r.bi() * 0.05), amp: r.uni(0.7, 1) });
        t += syl * (i === n - 1 ? 1.6 : 1);
      }
      t += r.uni(0.35, 2.2);
    }
    const segs = buildSegments(notes.filter((x) => x.t > 0.05), { type: woman ? 'woman' : r.pick(['baritone', 'bass', 'tenor']), tract: r.uni(0.94, 1.06), consScale: 0.75 });
    const g = r.uni(0.25, 1);
    renderVoice(out, segs, { sr, seed: r.int(1, 1e9), type: woman ? 'woman' : 'baritone', gain: g, effort: 0.3, breath: 0.12, jitter: 0.006, glide: 0.03, vib: { rate: 5, depth: 0 }, drift: 20, hiGain: 0.6 });
  }
  return out;
}

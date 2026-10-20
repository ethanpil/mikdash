#!/usr/bin/env node
// Offline checks of the Levites' song (node, no browser):
//   node src/audio/dev/songs-test.mjs [--render N] [--tier low|medium|high] [--wav DIR]
// 1. texts: every song's three sections cover its verses once, in order; each verse has Hebrew, English and syllables;
// 2. libationTimeline invariants (order, the nine blasts, the pour = the cymbal, prostrations at the sets);
// 3. renders N sections (default 3: the shortest, a middle and the longest) with the real synthesis and checks the buffer
//    length against sectionTiming, the verse boundaries against the audio (the breath before each verse is a dip in
//    the singing; each verse's first note is a rise), loudness and peaks; --wav writes them for listening.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SONGS, sectionVerses, sectionRefs } from '../songs.js';
import { HEB } from '../songs-text.js';
import { libationTimeline, sectionTiming, sectionLyrics, D_SET, SET_BLASTS } from '../timeline.js';
import { synthesize } from '../synth/index.js';
import { renderPsalm } from '../synth/music.js';
import { syllabify } from '../synth/chant.js';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const N = +arg('--render', 3), tier = arg('--tier', 'low'), wavDir = arg('--wav', null);
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

// ---- 1. texts
const CH = { 'Ps 24': 10, 'Ps 48': 15, 'Ps 82': 8, 'Ps 94': 23, 'Ps 81': 17, 'Ps 93': 5, 'Ps 92': 16 };
const seen = {};
for (const [id, S] of Object.entries(SONGS)) {
  const refs = [0, 1, 2].flatMap((k) => sectionRefs(id, k));
  const nums = refs.map((r) => +r.split(':')[1]);
  check(nums.every((n, i) => i === 0 || n === nums[i - 1] + 1), `${id}: sections not contiguous ${nums}`);
  for (const k of [0, 1, 2]) check(sectionRefs(id, k).length > 0, `${id}: empty section ${k}`);
  if (CH[S.ch]) check(nums[0] === 1 && nums[nums.length - 1] === CH[S.ch], `${id}: does not cover ${S.ch}:1-${CH[S.ch]}`);
  for (const r of refs) seen[r] = (seen[r] || 0) + 1;
  for (const k of [0, 1, 2]) for (const v of sectionVerses(id, k)) {
    check(v.he && v.en && v.tr, `${v.key}: missing text`);
    check(/\.$/.test(v.tr), `${v.key}: chant line must end a verse`);
    check(!/[֑-ֽ֯]/.test(v.he), `${v.key}: cantillation left in caption Hebrew`);
    check(!/יהוה/.test(v.he.replace(/[ְ-ׇ]/g, '')), `${v.key}: the Tetragrammaton written out`);
    check(syllabify(v.tr).every((s) => /[aeiou]/i.test(s.syl)), `${v.key}: a syllable without a vowel`);
  }
}
check(Object.values(seen).every((n) => n === 1), 'a verse appears in two sections');
check(Object.keys(HEB).length === Object.keys(seen).length, `HEB has ${Object.keys(HEB).length} verses, songs use ${Object.keys(seen).length}`);
// Ha'azinu's six (Rambam Tefillah 13:5): 1, 7, 13, 19, 29, 40
check(['haazinu-1', 'haazinu-2', 'haazinu-3', 'haazinu-4', 'haazinu-5', 'haazinu-6'].map((id) => SONGS[id].parts[0][0]).join() === '1,7,13,19,29,40', 'Ha\'azinu section starts');

// ---- 2. timelines
const rows = [];
for (const id of Object.keys(SONGS)) for (const style of ['mishnah', 'sg1612']) {
  const T = libationTimeline({ song: id, style, walk: 20, gap: style === 'sg1612' ? [30, 45] : 0 });
  check(T.sets.length === 3 && T.sets.every((s) => s.blasts.length === 11), `${id}: 3 sets × (2 teki'ot + 9 teru'ah notes)`);
  check(T.sets.reduce((n, s) => n + s.blasts.filter((b) => b.kind === 'tekiah').length + 1, 0) === 9, `${id}: nine blasts (Sukkah 5:5)`);
  check(T.pour === T.cymbals[0] && T.cymbals.length === (style === 'sg1612' ? 3 : 1), `${id}/${style}: cymbals`);
  check(Math.abs(T.sections[0].t0 - (T.pour + 0.9)) < 1e-6, `${id}: the song starts 0.9 s after the cymbal`);
  for (let s = 1; s < 3; s++) {
    check(T.sets[s].t0 >= T.sections[s - 1].singEnd + 0.9 - 1e-6, `${id}: set ${s} before section ${s} ends`);
    check(T.sections[s].t0 >= T.sets[s].t1 - 0.2 - 1e-6, `${id}: section ${s + 1} before set ${s} ends`);
  }
  for (let s = 0; s < 3; s++) check(T.prostrations[s].t0 > T.sets[s].t0 && T.prostrations[s].t0 < T.sets[s].t1, `${id}: prostration ${s} outside its set`);
  check(T.cues.every((c, i) => i === 0 || c.t >= T.cues[i - 1].t - 1e-9), `${id}: cues out of order`);
  if (style === 'mishnah') rows.push(`${id.padEnd(18)} sections ${T.sections.map((x) => (x.t1 - x.t0).toFixed(1)).join(' / ')} s · concert ${T.done.toFixed(0)} s`);
}
check(Math.abs(D_SET - 10.38) < 1e-9 && SET_BLASTS.length === 11, 'trumpet set length');

// caption tracks
for (const id of Object.keys(SONGS)) for (const k of [0, 1, 2]) {
  const L = sectionLyrics({ song: id }, k), T = sectionTiming({ song: id }, k);
  check(L.length === T.verses.length && L.every((l, i) => l.dur > 1 && (i === 0 || l.t > L[i - 1].t)), `${id}/${k}: caption track`);
  check(L[L.length - 1].t + L[L.length - 1].dur <= T.duration + 0.5, `${id}/${k}: last caption outlasts the section`);
}
console.log(rows.join('\n'));

// ---- 3. renders
const all = Object.keys(SONGS).flatMap((id) => [0, 1, 2].map((k) => ({ id, k, d: sectionTiming({ song: id }, k).duration }))).sort((a, b) => a.d - b.d);
const pick = N <= 0 ? [] : N === 1 ? [all[all.length - 1]] : Array.from({ length: N }, (_, i) => all[Math.round((i * (all.length - 1)) / (N - 1))]);
const SR = { low: 32000, medium: 32000, high: 48000, ultra: 48000 }[tier];
const env = (x, sr, win = 0.05) => {
  const w = Math.round(win * sr), out = [];
  for (let i = 0; i + w <= x.length; i += w) { let e = 0; for (let j = i; j < i + w; j++) e += x[j] * x[j]; out.push(10 * Math.log10(e / w + 1e-12)); }
  return out;
};
for (const { id, k } of pick) {
  const S = SONGS[id], opts = S.kind === 'psalm' ? { psalm: S.psalm } : { song: id };
  const T = sectionTiming(opts, k);
  const t0 = performance.now();
  const r = synthesize({ kind: 'cue', id: 'choir-psalm', opts: { ...opts, section: k, style: 'mishnah' }, sr: SR, tier, stats: true });
  const ms = performance.now() - t0;
  const x = r.channels[0], dur = x.length / SR;
  check(Math.abs(dur - T.duration) < 2 / SR, `${id}/${k}: buffer ${dur.toFixed(4)} s vs timing ${T.duration.toFixed(4)} s`);
  // the voices alone, to see the verses in the audio: the same render without strings (kinnorot 0, nevalim 0)
  const vo = renderPsalm({ sr: SR, seed: 7, ...opts, section: k, men: 12, boys: 2, kinnorot: 0, nevalim: 0, cr: 32, hiGain: 0 }).buffer;
  const E = env(vo, SR), med = [...E].sort((a, b) => a - b)[Math.floor(E.length * 0.6)];
  const at = (t) => E[Math.max(0, Math.min(E.length - 1, Math.floor(t / 0.05)))];
  const dips = [], rises = [];
  T.verses.forEach((v, i) => {
    // the breath between verses: minimum just before this verse's first note
    if (i > 0) { let m = Infinity; for (let t = T.verses[i - 1].t1 - 0.1; t < v.t0 + 0.05; t += 0.05) m = Math.min(m, at(t)); dips.push(med - m); }
    // the first note: energy 0.1–0.5 s after the onset vs the dip
    let m = -Infinity; for (let t = v.t0 + 0.05; t < v.t0 + 0.5; t += 0.05) m = Math.max(m, at(t));
    rises.push(m - med);
  });
  const minDip = dips.length ? Math.min(...dips) : null, minRise = Math.min(...rises);
  if (minDip !== null) check(minDip > 6, `${id}/${k}: a verse boundary is not a breath in the singing (dip ${minDip.toFixed(1)} dB)`);
  check(minRise > -6, `${id}/${k}: a verse does not start where its caption does (rise ${minRise.toFixed(1)} dB)`);
  const st = r.stats;
  check(st.peakDb <= -1.0 + 1e-6 && !st.nan, `${id}/${k}: peak ${st.peakDb} dBFS / NaN`);
  console.log(`render ${id}/${k} [${tier} ${SR / 1000} kHz]: ${dur.toFixed(1)} s audio in ${(ms / 1000).toFixed(1)} s (${(ms / 1000 / dur).toFixed(3)} s/s), ${(x.length * 4 / 1048576).toFixed(1)} MB; peak ${st.peakDb} dBFS, rms ${st.rmsDb} dB, loudest 50 ms ${st.loudest50msDb} dB; verse breaths ≥ ${minDip?.toFixed(1) ?? '–'} dB below the singing, onsets ≥ ${minRise.toFixed(1)} dB`);
  if (wavDir) {
    mkdirSync(resolve(wavDir), { recursive: true });
    const n = x.length, dv = new DataView(new ArrayBuffer(44 + n * 2));
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, SR, true); dv.setUint32(28, SR * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), true);
    writeFileSync(join(resolve(wavDir), `${id}-${k + 1}.wav`), new Uint8Array(dv.buffer));
  }
}

console.log(fails.length ? `FAIL (${fails.length}):\n  ${fails.slice(0, 40).join('\n  ')}` : 'all checks passed');
process.exit(fails.length ? 1 : 0);

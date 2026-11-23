#!/usr/bin/env node
// Offline checks of the lifelike-audio additions (docs/decisions/lifelike-audio.md), node, no browser:
//   node src/audio/dev/lifelike-test.mjs [--tier low|high]
// 1. the wind bed's level shape (ambience.js windShape): gusts, the afternoon breeze, the weather — range, the largest
//    change between two 0.5 s ticks, the gust depth when the clock runs fast; the wind bed's own render (unchanged synth)
// 2. the visitor's barefoot step (foley.js footsteps, steps: 1, pavement and stair): peak, no DC, silent ends (no
//    clicks), the energy band, and its level at the ear against the wind bed, the crowd and the pyre (library.js model)
import { synthesize } from '../synth/index.js';
import { CUE_LIB, LOOP_LIB, SYNTH_RATE, splToGainDb, ROLLOFF } from '../library.js';
import { windShape } from '../ambience.js';

const args = process.argv.slice(2);
const tier = args.includes('--tier') ? args[args.indexOf('--tier') + 1] : 'low';
const sr = SYNTH_RATE[tier] || 48000;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const db = (x) => 20 * Math.log10(Math.max(Math.abs(x), 1e-12));
const f1 = (x) => x.toFixed(1);

// ---- 1. wind shape ------------------------------------------------------------------------------------------------
const zm = { alot: 300, sunrise: 380, sunset: 1000 };               // an autumn day (minutes after midnight)
const ms0 = Date.UTC(2026, 9, 14, 0, 0, 0) - 120 * 60000;            // local midnight (UTC+2)
const shape = (t, cover = 0, speed = 1, extraS = 0) => windShape({ ms: ms0 + t * 60000 + extraS * 1000, t, zm, speed, cover });
let lo = Infinity, hi = -Infinity, maxStep = 0;
for (let s = 0; s < 86400; s += 0.5) {
  const g = db(shape(s / 60));
  lo = Math.min(lo, g); hi = Math.max(hi, g);
  if (s > 0) maxStep = Math.max(maxStep, Math.abs(g - db(shape((s - 0.5) / 60))));
}
// gusts alone over an hour before dawn (no breeze term), at 1× and 60×
const gustRange = (speed) => { let a = Infinity, b = -Infinity; for (let s = 0; s < 3600; s += 0.5) { const g = db(shape(200 + s / 60, 0, speed)); a = Math.min(a, g); b = Math.max(b, g); } return [a, b]; };
const g1 = gustRange(1), g60 = gustRange(60);
const meanDb = (t0, t1, cover = 0) => { let e = 0, n = 0; for (let t = t0; t < t1; t += 0.25) { e += shape(t, cover) ** 2; n++; } return 10 * Math.log10(e / n); };
const preDawn = meanDb(240, 360), afternoon = meanDb(14 * 60, 16 * 60), cloudy = meanDb(14 * 60, 16 * 60, 0.16);
console.log(`wind shape: day range ${f1(lo)}..${f1(hi)} dB, largest change per 0.5 s tick ${maxStep.toFixed(2)} dB (setGain ramps over 2 s)`);
console.log(`  gusts (1 h before dawn): ${f1(g1[0])}..${f1(g1[1])} dB at 1×, ${f1(g60[0])}..${f1(g60[1])} dB at 60×`);
console.log(`  mean: 04:00–06:00 ${f1(preDawn)} dB, 14:00–16:00 ${f1(afternoon)} dB clear, ${f1(cloudy)} dB on a cumulus day`);
check(hi < 6.5 && lo > -3.5, `wind shape out of range ${lo}..${hi}`);
check(maxStep < 0.5, `wind shape steps ${maxStep} dB per tick`);
check(g60[1] - g60[0] < 0.5, 'gusts not flattened at 60×');
check(afternoon - preDawn > 1.2 && afternoon - preDawn < 3, 'afternoon breeze term');
check(cloudy - afternoon > 2 && cloudy - afternoon < 3.5, 'weather term');
check(Number.isFinite(windShape({})) && windShape({}) === 1, 'windShape without a clock must be 1');

const wind = synthesize({ kind: 'loop', id: 'wind', sr, tier, stats: true });
const wL = wind.channels[0], wn = wL.length;
console.log(`wind bed (${tier}, ${wind.stats.duration} s): rms ${wind.stats.rmsDb} dBFS, peak ${wind.stats.peakDb}, centroid ${wind.stats.centroidHz} Hz; loop seam |Δ| ${Math.abs(wL[0] - wL[wn - 1]).toFixed(4)} (median |Δ| ${median(wL).toFixed(4)})`);

// ---- 2. the visitor's step --------------------------------------------------------------------------------------------
function median(x) { const d = []; for (let i = 1; i < x.length; i += 7) d.push(Math.abs(x[i] - x[i - 1])); d.sort((a, b) => a - b); return d[d.length >> 1]; }
// level at the ear (dBFS of the loudest 400 ms, normalised to −16 dB): gain dB = splToGainDb(spl + levelDb) − rolloff
const ear = (def, levelDb, d, norm = -16) => norm + splToGainDb(def.spl + levelDb) - ROLLOFF * 20 * Math.log10(Math.max(d, def.r0) / def.r0);
const bed = (def, gainLin = 1, d = 0, people = 0) => -20 + splToGainDb(def.spl) + db(gainLin) - (d ? ROLLOFF * 20 * Math.log10(Math.max(d, def.r0) / def.r0) : 0) + (people ? 10 * Math.log10(people / def.people) : 0);
const loud400 = {};
for (const surface of [undefined, 'stair']) {
  const cents = []; let l4 = -Infinity;
  for (let v = 0; v < 4; v++) {
    const r = synthesize({ kind: 'cue', id: 'footsteps', opts: { steps: 1, surface, variant: v }, sr, tier, stats: true });
    const x = r.channels[0], n = x.length;
    let dc = 0; for (let i = 0; i < n; i++) dc += x[i]; dc /= n;
    const head = Math.abs(x[0]), tail = Math.max(...Array.from(x.subarray(n - 64)).map(Math.abs));
    // where the energy is: share below 300 Hz (a crude two-pole split)
    let lp = 0, lp2 = 0, eLo = 0, eAll = 0; const a = Math.exp(-2 * Math.PI * 300 / sr);
    for (let i = 0; i < n; i++) { lp = (1 - a) * x[i] + a * lp; lp2 = (1 - a) * lp + a * lp2; eLo += lp2 * lp2; eAll += x[i] * x[i]; }
    cents.push(r.stats.centroidHz);
    const w = Math.round(0.4 * sr); let best = 0;
    for (let i = 0; i + w <= n; i += w >> 2) { let e = 0; for (let j = i; j < i + w; j++) e += x[j] * x[j]; best = Math.max(best, e / w); }
    l4 = Math.max(l4, 10 * Math.log10(best));
    console.log(`step ${surface || 'pavement'} v${v}: ${r.stats.duration} s, peak ${r.stats.peakDb} dBFS, loudest 50 ms ${r.stats.loudest50msDb}, rms ${r.stats.rmsDb}, centroid ${r.stats.centroidHz} Hz, roll-off ${r.stats.rolloff85Hz} Hz, < 300 Hz ${(100 * eLo / eAll).toFixed(0)} %, DC ${dc.toExponential(1)}, first ${head.toExponential(1)}, last 64 max ${tail.toExponential(1)}`);
    check(r.stats.nan === 0 && r.stats.clipped === 0 && r.stats.peakDb <= -0.9, `step ${surface} v${v}: peak ${r.stats.peakDb}`);
    check(Math.abs(dc) < 1e-3, `step ${surface} v${v}: DC ${dc}`);
    check(head < 1e-3 && tail < 1e-3, `step ${surface} v${v}: edges ${head} ${tail}`);
    check(r.stats.centroidHz > 150 && r.stats.centroidHz < 2500, `step ${surface} v${v}: centroid ${r.stats.centroidHz}`);
  }
  loud400[surface || 'pavement'] = l4;
  console.log(`  ${surface || 'pavement'}: loudest 400 ms ≤ ${f1(l4)} dBFS (the −1 dBFS peak cap holds it under the −16 target)`);
  if (surface) console.log(`  stair centroid mean ${Math.round(cents.reduce((a, b) => a + b) / 4)} Hz (darker than the pavement's)`);
}
const fs = CUE_LIB.footsteps;
const stepEar = ear(fs, -10, 1.6, loud400.pavement), stairEar = ear(fs, -10, 1.6, loud400.stair);
const windNight = bed(LOOP_LIB.wind, 0.65), windDay = bed(LOOP_LIB.wind, 1);
const crowd = bed(LOOP_LIB['crowd-murmur'], 1, 10, 320), pyre = bed(LOOP_LIB.fire, 1, 20);
console.log(`at the ear (1.6 m above the feet): step ${f1(stepEar)} dBFS (loudest 400 ms), stair ${f1(stairEar)}; wind bed rms ${f1(windNight)} (night) / ${f1(windDay)} (day) before gusts; court crowd at 10 m ${f1(crowd)}; pyre at 20 m ${f1(pyre)}`);
check(stepEar < crowd - 4, 'step not under the day crowd');

if (fails.length) { console.error(`FAIL\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('ok');

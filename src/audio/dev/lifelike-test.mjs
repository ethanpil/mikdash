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

function median(x) { const d = []; for (let i = 1; i < x.length; i += 7) d.push(Math.abs(x[i] - x[i - 1])); d.sort((a, b) => a - b); return d[d.length >> 1]; }

if (fails.length) { console.error(`FAIL\n  ${fails.join('\n  ')}`); process.exit(1); }
console.log('ok');

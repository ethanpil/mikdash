#!/usr/bin/env node
// Offline checks of the 'pot-break' cue (render-audio-3; Lev 6:21, Zevachim 11:4), node, no browser:
//   node src/audio/dev/pot-break-test.mjs [--wav DIR] [--tier low|high]
// Renders the cue's variants (and a small and a large pot) through synthesize() exactly as the Worker does, then checks:
// finite samples and the −1 dBFS peak cap; the hit within the first 25 ms (the sim cues it on the toss's moment); the
// hit as the loudest moment; the sherds as separate transients after it (onsets in the 50 ms envelope, ≥ 5 within
// 0.05–1.2 s); the decay (each later half-second quieter) and silence by 2.3 s; the energy where struck terracotta and
// stone put it (spectral centroid 1.5–6 kHz); and the render time.
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { synthesize } from '../synth/index.js';
import { CUE_LIB, CUE_ALIAS, SYNTH_RATE } from '../library.js';

const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const wavDir = arg('--wav', null), tier = arg('--tier', 'high');
const sr = SYNTH_RATE[tier] || 48000;
const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const db = (x) => 20 * Math.log10(Math.max(x, 1e-12));

check(!!CUE_LIB['pot-break'] && CUE_ALIAS['pot-shatter'] === 'pot-break', 'pot-break missing from the library or its aliases');
const cases = [{ variant: 0 }, { variant: 1 }, { variant: 2 }, { variant: 0, size: 0.6 }, { variant: 0, size: 1.4 }];
for (const o of cases) {
  const t0 = performance.now();
  const r = synthesize({ kind: 'cue', id: 'pot-break', opts: o, sr, tier, stats: true });
  const ms = performance.now() - t0;
  const x = r.channels[0], n = x.length, tag = `pot-break ${JSON.stringify(o)}`;
  // 5 ms RMS envelope
  const w = Math.round(0.005 * sr), env = [];
  for (let i = 0; i + w <= n; i += w) { let e = 0; for (let j = i; j < i + w; j++) e += x[j] * x[j]; env.push(Math.sqrt(e / w)); }
  const at = (t) => env[Math.min(env.length - 1, Math.floor(t / 0.005))];
  const peakI = env.indexOf(Math.max(...env));
  const first = env.findIndex((v) => db(v) > db(env[peakI]) - 20);
  // onsets: a 5 ms frame ≥ 6 dB above the mean of the 20 ms before it, ≥ 15 ms apart
  const on = [];
  for (let i = 4; i < env.length; i++) {
    const prev = (env[i - 4] + env[i - 3] + env[i - 2] + env[i - 1]) / 4;
    if (db(env[i]) - db(prev) >= 6 && db(env[i]) > db(env[peakI]) - 45 && (!on.length || i - on[on.length - 1] >= 3)) on.push(i);
  }
  const sherds = on.filter((i) => i * 0.005 > 0.05 && i * 0.005 < 1.2).length;
  const seg = (a, b) => { let e = 0, c = 0; for (let i = Math.floor(a / 0.005); i < Math.min(env.length, b / 0.005); i++) { e += env[i] * env[i]; c++; } return db(Math.sqrt(e / Math.max(c, 1))); };
  const halves = [seg(0, 0.5), seg(0.5, 1.0), seg(1.0, 1.5), seg(1.5, 2.0)];
  const tail = seg(2.3, n / sr);
  check(r.stats.nan === 0 && r.stats.peakDb <= -0.9, `${tag}: NaN ${r.stats.nan}, peak ${r.stats.peakDb} dBFS`);
  check(first >= 0 && first * 0.005 <= 0.025, `${tag}: the hit at ${(first * 0.005).toFixed(3)} s (want ≤ 0.025)`);
  check(peakI * 0.005 <= 0.03, `${tag}: loudest at ${(peakI * 0.005).toFixed(3)} s, not the hit`);
  check(sherds >= 5, `${tag}: ${sherds} sherd onsets in 0.05–1.2 s (want ≥ 5)`);
  check(halves.every((v, i) => i === 0 || v < halves[i - 1]), `${tag}: does not decay ${halves.map((v) => v.toFixed(1)).join(' ')}`);
  check(tail < halves[0] - 50, `${tag}: tail ${tail.toFixed(1)} dB not silent`);
  check(r.stats.centroidHz > 1500 && r.stats.centroidHz < 6000, `${tag}: centroid ${r.stats.centroidHz} Hz`);
  console.log(`${tag}: ${(n / sr).toFixed(2)} s, render ${ms.toFixed(0)} ms; peak ${r.stats.peakDb} dBFS, loudest 50 ms ${r.stats.loudest50msDb} dB; hit ${(first * 0.005 * 1000).toFixed(0)} ms; sherd onsets ${sherds}; half-seconds ${halves.map((v) => v.toFixed(1)).join(' / ')} dB, after 2.3 s ${tail.toFixed(1)} dB; centroid ${r.stats.centroidHz} Hz, roll-off ${r.stats.rolloff85Hz} Hz`);
  if (wavDir) {
    mkdirSync(wavDir, { recursive: true });
    const buf = Buffer.alloc(44 + n * 2), dv = new DataView(buf.buffer);
    const str = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) dv.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true);
    writeFileSync(join(wavDir, `pot-break-v${o.variant}${o.size ? `-s${o.size}` : ''}.wav`), buf);
  }
}
console.log(fails.length ? `FAIL\n  ${fails.join('\n  ')}` : 'all checks passed');
process.exit(fails.length ? 1 : 0);

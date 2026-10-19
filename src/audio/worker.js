// Synthesis worker: renders cues, loops and impulse responses off the main thread (no frame hitches).
// Message in:  { job, kind, id, opts, sr, seed?, tier }
// Message out: { job, ok, channels: Float32Array[], sampleRate, ms } (buffers transferred) | { job, ok: false, error }
import { synthesize } from './synth/index.js';

self.onmessage = (e) => {
  const { job, kind, id, opts, sr, seed, tier } = e.data || {};
  try {
    const t0 = performance.now();
    const r = synthesize({ kind, id, opts, sr, seed, tier });
    self.postMessage({ job, ok: true, channels: r.channels, sampleRate: r.sampleRate, ms: performance.now() - t0 }, r.channels.map((c) => c.buffer));
  } catch (err) {
    self.postMessage({ job, ok: false, error: String(err?.stack || err) });
  }
};

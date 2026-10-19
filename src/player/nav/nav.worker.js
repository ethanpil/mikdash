// Builds the walkability grid off the main thread. Message in: { positions: Float32Array, cfg }.
// Messages out: { type: 'progress', p } … { type: 'done', res } | { type: 'error', message }.
// Dependency-free: the stairs-vs-ledge floor probes use grid-build's bucketed triangle probe.
import { buildGrid, gridTransfer } from './grid-build.js';

self.onmessage = (e) => {
  try {
    const { positions, cfg } = e.data;
    const t0 = performance.now();
    const gen = buildGrid(positions, cfg);
    let r, lastPost = 0;
    while (!(r = gen.next()).done) {
      const t = performance.now();
      if (t - lastPost > 100) { lastPost = t; self.postMessage({ type: 'progress', p: r.value }); }
    }
    const res = r.value;
    res.stats.workerMs = Math.round(performance.now() - t0);
    self.postMessage({ type: 'done', res }, gridTransfer(res));
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.stack || err) });
  }
};

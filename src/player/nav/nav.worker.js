// Builds the walkability layers off the main thread. Message in: { positions: Float32Array, specs }.
// Messages out: { type: 'progress', p } … { type: 'done', res } | { type: 'error', message }.
// Dependency-free: the stairs-vs-ledge floor probes use grid-build's bucketed triangle probe.
import { buildNav, navTransfer } from './multi.js';

self.onmessage = (e) => {
  try {
    const { positions, specs } = e.data;
    const t0 = performance.now();
    const gen = buildNav(positions, specs);
    let r, lastPost = 0;
    while (!(r = gen.next()).done) {
      const t = performance.now();
      if (t - lastPost > 100) { lastPost = t; self.postMessage({ type: 'progress', p: r.value }); }
    }
    const res = r.value;
    res.stats.workerMs = Math.round(performance.now() - t0);
    self.postMessage({ type: 'done', res }, navTransfer(res));
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err?.stack || err) });
  }
};

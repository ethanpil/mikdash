// perf-1: bakes rigs' animation clips off the main thread (people/prebake.js). The page's amah standard arrives in the
// worker's name (core/units.js reads it there), so clips that use amot bake exactly as on the main thread.
import { bakeRig } from './anim.js';

self.onmessage = (e) => {
  for (const key of e.data?.rigs || []) {
    try {
      const res = bakeRig(key);
      self.postMessage({ type: 'rig', res }, [res.master.buffer, res.locals.buffer]);
    } catch (err) {
      self.postMessage({ type: 'error', key, message: String(err?.stack || err) });
    }
  }
};

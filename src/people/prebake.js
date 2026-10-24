// perf-1: the animation atlas's clips (≈ 1 s of CPU for the rigs the boot needs, 2–5 s once the shader compiler threads
// compete for the cores) are baked in a Worker started at the very beginning of the boot, while the main thread
// builds the world. AnimAtlas.ensure() takes a rig's result from here when it has arrived, else bakes it itself —
// the same bakeRig() either way, so the atlas is identical.
//
//   startPrebake(rigs)          main.js, before the world is built (no-op without module workers)
//   whenPrebaked(timeoutMs)     resolves when every requested rig has arrived (or failed / timed out)
//   takePrebaked(rigKey)        the result, once (null if not here)
import { AMAH_KEY } from '../core/units.js';

const results = new Map();
let waiting = new Set();
let settle = null;
let done = Promise.resolve();

/** the rigs the default first views need (man, elder, woman, boy, child and the courts' animals) — qa-r2: the sim pools
 *  ensure 'child' at every boot (the women's court crowds); it was baked on the main thread there (≈ 0.4–0.7 s on low) */
export const BOOT_RIGS = ['man', 'elder', 'woman', 'boy', 'child', 'lamb', 'ram', 'goat'];

export function startPrebake(rigs = BOOT_RIGS) {
  if (typeof Worker === 'undefined' || waiting.size) return done;
  let worker;
  try {
    // the worker has no page URL or storage: it reads the amah standard from its name (core/units.js)
    worker = new Worker(new URL('./bake.worker.js', import.meta.url), { type: 'module', name: `mikdash-bake amah=${AMAH_KEY}` });
  } catch { return done; }
  waiting = new Set(rigs);
  done = new Promise((r) => { settle = r; });
  const finish = () => { waiting.clear(); worker.terminate(); settle?.(); settle = null; };
  worker.onmessage = (e) => {
    const m = e.data;
    if (m?.type === 'rig') { results.set(m.res.key, m.res); waiting.delete(m.res.key); }
    else if (m?.type === 'error') { console.warn('[people] clip bake worker:', m.message); waiting.delete(m.key); }
    if (!waiting.size) finish();
  };
  worker.onerror = (e) => { e.preventDefault?.(); finish(); }; // the main thread bakes what is missing
  worker.postMessage({ rigs });
  return done;
}

export function whenPrebaked(timeoutMs = 15000) {
  return Promise.race([done, new Promise((r) => setTimeout(r, timeoutMs))]);
}

export function takePrebaked(rigKey) {
  const r = results.get(rigKey);
  if (r) results.delete(rigKey);
  return r || null;
}

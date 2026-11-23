// node src/people/dev/bake-stats.mjs — frames and CPU time of the clip bake per boot rig (the atlas's size and the
// prebake worker's cost), and the idle clips' frame counts. A dev measurement; nothing imports it.
import { bakeRig } from '../anim.js';

let tot = 0, totF = 0;
for (const k of ['man', 'elder', 'woman', 'boy', 'child', 'lamb', 'ram', 'goat']) {
  bakeRig(k); // warm the JIT
  const t0 = performance.now(); const b = bakeRig(k); const ms = performance.now() - t0;
  tot += ms; totF += b.frames;
  console.log(k.padEnd(6), String(b.frames).padStart(5), `${ms.toFixed(0)} ms`.padStart(7),
    b.clips.filter((c) => /^(stand|lie)/.test(c.name)).map((c) => `${c.name}:${c.frames}`).join(' '));
}
console.log('total', totF, 'frames', `${tot.toFixed(0)} ms`);

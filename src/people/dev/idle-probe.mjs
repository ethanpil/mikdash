// node src/people/dev/idle-probe.mjs <rig> <clip>[,<clip>...] [bones,...]
// The idle clips' motion, numerically (lifelike-people): for each clip, each bone's world position over the loop —
// its range of travel (cm), the largest step between two baked frames (cm: a pop if large), and the seam (loop end vs
// start, cm). Pure function of the phase: run twice, the numbers are identical.
import { Vector3 } from 'three';
import { getRig } from '../rig.js';
import { PoseBuilder } from '../pose.js';
import { HUMAN_CLIPS } from '../clips.js';
import { QUAD_CLIPS } from '../animal-clips.js';

const [rigKey = 'lamb', clipList = 'stand', list] = process.argv.slice(2);
const rig = getRig(rigKey);
const set = rig.kind === 'human' ? HUMAN_CLIPS : QUAD_CLIPS;
const bones = list ? list.split(',') : rig.kind === 'human' ? ['nose', 'head', 'chest', 'hand_l', 'hand_r', 'pelvis'] : ['nose', 'head', 'ear_l', 'ear_r', 'tail2', 'chest'];
const P = new PoseBuilder(rig);
for (const name of clipList.split(',')) {
  const c = set[name];
  if (!c) { console.log(name, 'missing'); continue; }
  const n = c.frames, pos = [];
  for (let i = 0; i <= n; i++) {
    P.reset(); c.fn(P, rig, c.loop ? i / n : i / (n - 1));
    // 'nose' = a point 15 cm ahead of the head joint (−z is ahead in the figure frame; +z for the quad rigs' head)
    pos.push(bones.map((b) => b === 'nose'
      ? new Vector3(0, 0, rig.kind === 'human' ? -0.15 : 0.15).applyQuaternion(P.worldQ('head')).add(P.worldPos('head'))
      : P.worldPos(b).clone()));
  }
  console.log(`${name}: ${n} frames, loop ${(1 / (c.rate ?? 0.2)).toFixed(1)} s, ${((1 / (c.rate ?? 0.2)) / n).toFixed(2)} s/frame`);
  bones.forEach((b, j) => {
    let lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9], step = 0;
    for (let i = 0; i < n; i++) {
      const p = pos[i][j];
      ['x', 'y', 'z'].forEach((a, k) => { lo[k] = Math.min(lo[k], p[a]); hi[k] = Math.max(hi[k], p[a]); });
      step = Math.max(step, p.distanceTo(pos[i + 1][j]));
    }
    const seam = pos[n][j].distanceTo(pos[0][j]);
    const range = hi.map((h, k) => ((h - lo[k]) * 100).toFixed(1)).join('/');
    console.log(`  ${b.padEnd(7)} range x/y/z ${range} cm   max step ${(step * 100).toFixed(1)} cm   seam ${(seam * 100).toFixed(2)} cm`);
  });
}

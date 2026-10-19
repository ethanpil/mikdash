// Print world joint positions of a clip frame: node src/people/dev/joints.mjs <rig> <clip> <phase> [bones,...]
import { getRig } from '../rig.js';
import { PoseBuilder } from '../pose.js';
import { HUMAN_CLIPS } from '../clips.js';
import { QUAD_CLIPS } from '../animal-clips.js';
const [rigKey = 'man', clip = 'prostrate', ph = '0.5', list] = process.argv.slice(2);
const rig = getRig(rigKey);
const P = new PoseBuilder(rig); P.reset();
(rig.kind === 'human' ? HUMAN_CLIPS : QUAD_CLIPS)[clip].fn(P, rig, +ph);
const names = list ? list.split(',') : rig.names;
for (const n of names) { const p = P.worldPos(n); console.log(n.padEnd(8), p.x.toFixed(3), p.y.toFixed(3), p.z.toFixed(3)); }

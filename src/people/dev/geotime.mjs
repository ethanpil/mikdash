// Times geometry building and atlas baking for every archetype in Node (no GPU): node src/people/dev/geotime.mjs
import { buildHumanGeometry } from '../human.js';
import { buildAnimalGeometry } from '../animals.js';
import { ARCHETYPES, ANIMALS } from '../roles.js';
import { getRig } from '../rig.js';
import { AnimAtlas } from '../anim.js';

const at = new AnimAtlas();
at._upload = () => {};
for (const [k, def] of Object.entries(ARCHETYPES)) {
  const t0 = performance.now();
  at.ensure(def.rig);
  const t1 = performance.now();
  const tris = [0, 1, 2, 3].map((l) => { const g = buildHumanGeometry(def.recipe, getRig(def.rig), l); return (g.index.count / 3) | 0; });
  console.log(`${k.padEnd(10)} bake ${(t1 - t0).toFixed(0)} ms  geo ${(performance.now() - t1).toFixed(0)} ms  tris ${tris.join(' / ')}`);
}
for (const [k, def] of Object.entries(ANIMALS)) {
  const t0 = performance.now();
  at.ensure(def.rig);
  const t1 = performance.now();
  const tris = [0, 1].map((l) => { const g = buildAnimalGeometry(def, getRig(def.rig), l); return (g.index.count / 3) | 0; });
  console.log(`${k.padEnd(10)} bake ${(t1 - t0).toFixed(0)} ms  geo ${(performance.now() - t1).toFixed(0)} ms  tris ${tris.join(' / ')}`);
}
console.log('atlas frames', at.frames);

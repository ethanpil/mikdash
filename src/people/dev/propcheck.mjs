// Builds every prop × grip class × hand × LOD in Node and reports triangles (right hand), NaNs and errors:
//   node src/people/dev/propcheck.mjs [name,name,...]   (people-4)
import { PROPS, buildPropGeometry, propAttach } from '../props.js';
import { HUMAN_CLIPS } from '../clips.js';
import { getRig } from '../rig.js';
const names = process.argv[2] ? process.argv[2].split(',') : Object.keys(PROPS);
let bad = 0;
for (const n of names) {
  const g = Object.keys(PROPS[n].grips || {}); if (!g.includes('free')) g.push('free');
  const out = [];
  for (const cls of g) for (const lod of [0, 1]) for (const side of cls === 'free' ? ['r'] : ['r', 'l']) {
    try {
      const geo = buildPropGeometry(n, cls, side, lod);
      const p = geo.attributes.position.array; let nan = 0; for (const v of p) if (!Number.isFinite(v)) nan++;
      if (nan) { bad++; out.push(`${cls}/${side}/${lod}: NaN ${nan}`); }
      if (side === 'r') out.push(`${cls}${lod}:${geo.index.count / 3}`);
    } catch (e) { bad++; out.push(`${cls}/${side}/${lod}: ERR ${e.message}`); }
  }
  console.log(n.padEnd(26), out.join(' '));
}
const rig = getRig('man');
for (const c of ['eat', 'knead', 'crank', 'wave_under', 'wave_basket', 'carry_slain', 'carry_slain_walk']) {
  if (!HUMAN_CLIPS[c]) { console.log('missing clip', c); bad++; }
}
console.log('bad', bad);

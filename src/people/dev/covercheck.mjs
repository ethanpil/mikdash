#!/usr/bin/env node
// Checks the sleepers' bedding covers (props.js cover / sleeperField) against the figures they cover: every bedding
// prop × lay (lie / sleep) × figure LOD × clip phase is posed exactly as the atlas bakes it, the cover's top surface
// is rasterised to a 1 cm height map in model space, and every visible body vertex that rises above it is a poke.
//   node src/people/dev/covercheck.mjs [--fullness 0..1]
import { Vector3, Quaternion, Matrix4 } from 'three';
import { getRig, MAX_BONES } from '../rig.js';
import { PoseBuilder, poseToSkin } from '../pose.js';
import { HUMAN_CLIPS } from '../clips.js';
import { clothCage, clothSkin } from '../cloth.js';
import { buildHumanGeometry } from '../human.js';
import { buildPropGeometry, propAttach } from '../props.js';

const args = process.argv.slice(2);
const fullness = args.includes('--fullness') ? +args[args.indexOf('--fullness') + 1] : 1;
const CASES = [
  { prop: 'folded_garments_ledge', rig: 'elder', recipe: 'elder', who: 'kohen_elder (ledge)' },
  { prop: 'folded_garments', rig: 'man', recipe: 'israelite', who: 'kohen / kohen_offduty' },
];
const M = new Float32Array(MAX_BONES * 12);
let total = 0;
for (const c of CASES) {
  const rig = getRig(c.rig);
  for (const [clipName, cls] of [['lie', 'pillow_back'], ['sleep', 'pillow_side']]) {
    const clip = HUMAN_CLIPS[clipName];
    const att = propAttach(c.prop, cls, 'r', rig);
    const covers = [0, 1].map((l) => buildPropGeometry(c.prop, cls, 'r', l));
    for (const lod of [0, 1, 2]) {
      const cover = covers[Math.min(lod, 1)];       // a figure's props are drawn at its LOD (LOD2 with the LOD1 geometry)
      const g = buildHumanGeometry(c.recipe, rig, lod);
      const pos = g.attributes.position.array, si = g.attributes.pIdx.array, sw = g.attributes.pW.array, mat = g.attributes.pMat.array;
      const mo = g.attributes.pMorph?.array, nrm = g.attributes.normal.array;
      let worst = 0, n = 0;
      const ex = [];
      for (let f = 0; f < clip.frames; f++) {
        const ph = f / clip.frames;
        const P = new PoseBuilder(rig);
        P.reset(); clip.fn(P, rig, ph); clothCage(P, rig);
        M.fill(0); poseToSkin(rig, P.lp, M, 0); clothSkin(rig, M, 0);
        // the cover in model space: root bone world × (attach offset + vertex)
        const R = new Matrix4().set(M[0], M[1], M[2], M[3], M[4], M[5], M[6], M[7], M[8], M[9], M[10], M[11], 0, 0, 0, 1);
        const cp = cover.attributes.position.array, ci = cover.index.array, cc = cover.attributes.color.array;
        // the cover's own triangles (its wool's hue: r/b ≈ 1.9 — the mat under him is redder, the linen bundle grey)
        const isCover = (i) => { const r = cc[i * 3], b = cc[i * 3 + 2]; return b > 0.01 && r / b > 1.7 && r / b < 2.05; };
        const H = new Map(), cell = 0.01;
        const v = [new Vector3(), new Vector3(), new Vector3()];
        for (let t = 0; t < ci.length; t += 3) {
          if (!isCover(ci[t]) || !isCover(ci[t + 1]) || !isCover(ci[t + 2])) continue;
          for (let q = 0; q < 3; q++) { const i = ci[t + q]; v[q].set(cp[i * 3] + att.x, cp[i * 3 + 1] + att.y, cp[i * 3 + 2] + att.z).applyMatrix4(R); }
          const L = Math.max(v[0].distanceTo(v[1]), v[1].distanceTo(v[2]), v[2].distanceTo(v[0]));
          const m = Math.max(1, Math.ceil(L / (cell * 0.7)));
          for (let a = 0; a <= m; a++) for (let b = 0; b <= m - a; b++) {
            const wa = a / m, wb = b / m, wc = 1 - wa - wb;
            const x = wa * v[0].x + wb * v[1].x + wc * v[2].x, y = wa * v[0].y + wb * v[1].y + wc * v[2].y, z = wa * v[0].z + wb * v[1].z + wc * v[2].z;
            const key = `${Math.round(x / cell)},${Math.round(z / cell)}`;
            if (!(H.get(key) >= y)) H.set(key, y);
          }
        }
        for (let i = 0; i < pos.length / 3; i++) {
          const grp = Math.floor(mat[i * 4 + 3] / 8);
          if (grp === 1 || grp === 2) continue;                 // his mantle (over him now), a head-cloth (off)
          let X = 0, Y = 0, Z = 0;
          for (let q = 0; q < 4; q++) {
            const w = sw[i * 4 + q] / 255;
            if (!w) continue;
            const o = si[i * 4 + q] * 12, px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
            X += w * (M[o] * px + M[o + 1] * py + M[o + 2] * pz + M[o + 3]);
            Y += w * (M[o + 4] * px + M[o + 5] * py + M[o + 6] * pz + M[o + 7]);
            Z += w * (M[o + 8] * px + M[o + 9] * py + M[o + 10] * pz + M[o + 11]);
          }
          if (mo) Y += Math.max(0, mo[i * 4 + 3]) * fullness * Math.max(0, nrm[i * 3 + 1]);   // fullness along the (rest) normal, roughly
          const hc = H.get(`${Math.round(X / cell)},${Math.round(Z / cell)}`);
          if (hc == null || hc < 0.03) continue;                  // not under the cover (head, beyond its edge) or where it lies flat
          const over = Y - hc;
          if (over > 0.002) { n++; if (over > worst) worst = over; if (ex.length < 6) ex.push(`cls${mat[i * 4 + 3] % 8} grp${grp} (${X.toFixed(2)},${Y.toFixed(2)},${Z.toFixed(2)}) +${(over * 1000).toFixed(0)}mm ph${ph.toFixed(2)}`); }
        }
      }
      total += n;
      console.log(`${c.prop.padEnd(22)} ${clipName.padEnd(5)} LOD${lod}: ${n ? `${n} pokes, worst ${(worst * 1000).toFixed(0)} mm` : 'clean'}${ex.length ? `\n    ${ex.join('\n    ')}` : ''}`);
    }
  }
}
console.log(total ? `${total} pokes` : 'all clean');

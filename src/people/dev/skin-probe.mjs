// CPU skinning probe for cloth debugging: node src/people/dev/skin-probe.mjs <recipe> <rig> <clip> <phase> [lod]
// Prints, for each rest-height band of the garment classes below the seat, the skinned y range, and counts
// triangles that face away from the body (inside-out) and vertices under the floor.
import { buildHumanGeometry } from '../human.js';
import { getRig } from '../rig.js';
import { AnimAtlas } from '../anim.js';
import { Vector3, Matrix4 } from 'three';
const [recipe = 'kohen', rigKey = 'man', clipName = 'prostrate', phase = '0.5', lodS = '0'] = process.argv.slice(2);
const rig = getRig(rigKey);
const at = new AnimAtlas(); at._upload = () => {};
const e = at.ensure(rigKey);
const clip = e.clips[clipName];
const fr = at.sample(clip, +phase, [0, 0, 0]);
const g = buildHumanGeometry(recipe, rig, +lodS);
const P = g.attributes.position.array, SI = g.attributes.pIdx.array, SW = Array.from(g.attributes.pW.array, (x) => x / 255), M = g.attributes.pMat.array;
const F = at.master; const FPF = 36 * 12;
const mats = [];
for (let b = 0; b < rig.n; b++) { const o = fr[0] * FPF + b * 12; const m = new Matrix4(); const el = m.elements; for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) el[c * 4 + r] = F[o + r * 4 + c]; el[15] = 1; mats.push(m); }
const n = P.length / 3; const out = new Float32Array(P.length); const v = new Vector3(), acc = new Vector3();
for (let i = 0; i < n; i++) { acc.set(0, 0, 0); for (let k = 0; k < 4; k++) { const w = SW[i * 4 + k]; if (!w) continue; v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(mats[SI[i * 4 + k]]); acc.addScaledVector(v, w); } out.set([acc.x, acc.y, acc.z], i * 3); }
const seat = rig.rest[rig.index.thigh_r].y - 0.06 * rig.dims.H / 1.67;
const bands = new Map();
for (let i = 0; i < n; i++) {
  const cls = M[i * 4 + 3] % 8; if (cls !== 3 && cls !== 4) continue;
  const y = P[i * 3 + 1]; if (y > seat) continue;
  const key = Math.round(y * 50) / 50;
  const b = bands.get(key) || { n: 0, ymin: 9, ymax: -9, under: 0 }; b.n++; b.ymin = Math.min(b.ymin, out[i * 3 + 1]); b.ymax = Math.max(b.ymax, out[i * 3 + 1]); if (out[i * 3 + 1] < 0) b.under++; bands.set(key, b);
}
console.log('rest y  n  skinned y range  under-floor');
for (const [k, b] of [...bands].sort((a, b) => b[0] - a[0])) console.log(k.toFixed(2).padStart(6), String(b.n).padStart(5), b.ymin.toFixed(3), b.ymax.toFixed(3), b.under);
// export OBJ of garment-class verts below the seat for inspection
if (process.env.OBJ) {
  const { writeFileSync } = await import('node:fs');
  let s = ''; for (let i = 0; i < n; i++) s += `v ${out[i * 3].toFixed(4)} ${out[i * 3 + 1].toFixed(4)} ${out[i * 3 + 2].toFixed(4)}\n`;
  const I = g.index.array; for (let t = 0; t < I.length; t += 3) s += `f ${I[t] + 1} ${I[t + 1] + 1} ${I[t + 2] + 1}\n`;
  writeFileSync(process.env.OBJ, s);
}
// inside-out check: skinned face normal vs the rest face normal carried by the dominant bone's rotation
{
  const I = g.index.array; let flipped = 0, tot = 0; const fb = new Map();
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), n0 = new Vector3(), n1 = new Vector3();
  for (let t = 0; t < I.length; t += 3) {
    const [i0, i1, i2] = [I[t], I[t + 1], I[t + 2]];
    const cls = M[i0 * 4 + 3] % 8; if (cls !== 3 && cls !== 4) continue;
    if (P[i0 * 3 + 1] > seat) continue;
    a.fromArray(P, i0 * 3); b.fromArray(P, i1 * 3); c.fromArray(P, i2 * 3);
    n0.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    // dominant bone of i0
    let best = 0; for (let k = 1; k < 4; k++) if (SW[i0 * 4 + k] > SW[i0 * 4 + best]) best = k;
    const bone = SI[i0 * 4 + best];
    n0.transformDirection(mats[bone]);
    a.fromArray(out, i0 * 3); b.fromArray(out, i1 * 3); c.fromArray(out, i2 * 3);
    n1.subVectors(b, a).cross(c.clone().sub(a)).normalize();
    tot++;
    if (n0.dot(n1) < 0) { flipped++; const key = rig.names[bone] + ' y' + (Math.round(P[i0 * 3 + 1] * 20) / 20).toFixed(2); fb.set(key, (fb.get(key) || 0) + 1); }
  }
  console.log('garment tris below seat', tot, 'flipped', flipped);
  console.log([...fb].slice(0, 30).map(([k, v]) => `${k}:${v}`).join('  '));
}

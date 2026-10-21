// Fist centres of a clip over its cycle (16 phases) — for crank also the error against the spoke it should hold:
//   node src/people/dev/reach.mjs <clip> [rig]   (people-4)
//   node src/people/dev/reach.mjs pair           (people-4-fix) the tenufah pair (wave + wave_under, one phase): the
//        kohen's palms against the owner's over the scale range — at ONE scale s, partner·s apart (the rule), and at
//        the two roles' independent seeded scales (what the rule avoids)
import { Vector3 } from 'three';
import { getRig } from '../rig.js';
import { PoseBuilder } from '../pose.js';
import { HUMAN_CLIPS, gripOffset, CRANK, WAVE_UNDER } from '../clips.js';
import { ROLES } from '../roles.js';
const rig = getRig(process.argv[3] || 'man');
const clip = process.argv[2] || 'crank';
const P = new PoseBuilder(rig);
const fistAt = (s) => { const w = P.world(P.i(`hand_${s}`)); return gripOffset(rig, s).applyQuaternion(w.q).add(w.p); };
if (clip === 'pair') {
  const palmC = (s) => { const w = P.world(P.i(`hand_${s}`)); return new Vector3(0, -0.075, 0).applyQuaternion(w.q).add(w.p); };
  const err = (sO, sK, D, ph) => {          // the kohen's palm centres minus (the owner's − drop), in the owner's frame
    P.reset(); HUMAN_CLIPS.wave.fn(P, rig, ph);
    const o = { l: palmC('l').multiplyScalar(sO), r: palmC('r').multiplyScalar(sO) };
    P.reset(); HUMAN_CLIPS.wave_under.fn(P, rig, ph);
    const k = { l: palmC('l').multiplyScalar(sK), r: palmC('r').multiplyScalar(sK) };
    return [['r', 'l'], ['l', 'r']].map(([ks, os]) => {
      const kw = new Vector3(-k[ks].x, k[ks].y, -D - k[ks].z), t = o[os].clone();
      t.y -= WAVE_UNDER.drop * sO;
      return kw.sub(t);
    });
  };
  const phs = [0, 0.15, 0.35, 0.6, 0.75];
  const base = phs.map((ph) => err(1, 1, WAVE_UNDER.partner, ph));   // the design at scale 1 (the hand-bone palm offset)
  // departure from the design scaled by the owner's size (the whole pair scaled about the owner's feet)
  const worst = (sO, sK, D) => Math.max(...phs.flatMap((ph, i) => err(sO, sK, D, ph).map((e, j) => e.distanceTo(base[i][j].clone().multiplyScalar(sO)))));
  const [k0, k1] = ROLES.kohen.scale, [i0, i1] = ROLES.israelite.scale;
  let ruled = 0, seeded = 0, n = 0, off = 0;
  for (let a = 0; a <= 20; a++) for (let b = 0; b <= 20; b++) {
    const sO = i0 + (i1 - i0) * a / 20, sK = k0 + (k1 - k0) * b / 20;
    ruled = Math.max(ruled, worst(sO, sO, WAVE_UNDER.partner * sO));   // the rule: kohen.setScale(owner.scale), partner·s
    const w = worst(sO, sK, WAVE_UNDER.partner); seeded = Math.max(seeded, w); n++; if (w > 0.02) off++;
  }
  console.log(`one scale s, partner·s apart: worst departure from the (scaled) design ${(ruled * 100).toFixed(2)} cm`);
  console.log(`independent seeded scales (kohen ${k0}–${k1}, owner ${i0}–${i1}): worst ${(seeded * 100).toFixed(1)} cm, ${(100 * off / n).toFixed(0)} % of pairs > 2 cm`);
  process.exit(ruled > 0.002 ? 1 : 0);
}
for (let i = 0; i < 16; i++) {
  const ph = i / 16;
  P.reset(); HUMAN_CLIPS[clip].fn(P, rig, ph);
  const L = fistAt('l'), R = fistAt('r');
  let extra = '';
  if (clip === 'crank') {
    const W = CRANK, [a0, a1] = W.stroke.map((x) => x * Math.PI / 180);
    const tgt = (s, off) => { const u = (ph + off) % 1; if (u >= 0.5) return null; const a = a0 + (a1 - a0) * (u / 0.5); return new Vector3(W.hub[0] - Math.sin(a) * W.radius, W.hub[1] + Math.cos(a) * W.radius, W.hub[2] + 0.045); };
    const tl = tgt('l', 0), tr = tgt('r', 0.5);
    extra = ` errL ${tl ? tl.distanceTo(L).toFixed(3) : '-'} errR ${tr ? tr.distanceTo(R).toFixed(3) : '-'}`;
  }
  const head = P.worldPos('head');
  console.log(ph.toFixed(3), 'L', L.toArray().map((v) => v.toFixed(3)).join(','), 'R', R.toArray().map((v) => v.toFixed(3)).join(','), 'head', head.toArray().map((v)=>v.toFixed(2)).join(','), extra);
}

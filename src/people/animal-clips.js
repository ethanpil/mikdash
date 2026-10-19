// Animal pose library (quadrupeds: lamb, ram, goat, bull; and the dove). Same phase contract as clips.js.
// 'bound' = lying on its side with fore and hind legs held together — the tamid lamb is not tied but held
// "hand and foot" (akedah) for shechitah (Tamid 4:1).
import { Vector3 } from 'three';
import { TAU, smooth, clamp } from './util.js';

const sin = Math.sin, cos = Math.cos;
const V = (x, y, z) => new Vector3(x, y, z);

function quadLegs(P, r, ph, o) {
  const d = r.dims;
  const L = d.stride, sF = 0.68;
  const lift = 0.07 * d.H;
  const legs = [['hl', 0], ['fl', 0.25], ['hr', 0.5], ['fr', 0.75]];
  for (const [leg, off] of legs) {
    const front = leg[0] === 'f';
    const sg = leg[1] === 'l' ? -1 : 1;
    const up = r.index[`${leg}_up`], lo = r.index[`${leg}_lo`], ft = r.index[`${leg}_ft`];
    const rest = r.rest[ft];
    let z = 0, y = 0, pitch = 0;
    if (o.walk) {
      const u = (ph + off) % 1;
      if (u < sF) { const k = u / sF; z = -L * sF / 2 + k * L * sF; }
      else {
        const k = (u - sF) / (1 - sF);
        const e = (1 - cos(Math.PI * k)) / 2;
        z = L * sF / 2 - e * L * sF;
        y = lift * sin(Math.PI * k);
        pitch = 50 * sin(Math.PI * k) * (front ? 1 : 0.6);
      }
    }
    const tgt = V(rest.x + sg * 0.004, rest.y + y, rest.z + z);
    // carpus (front) folds with the joint forward; hock (hind) points back
    const bend = V(0, 0, front ? -1 : 1);
    P.twoBone(up, lo, ft, tgt, bend, bend);
    P.rot(`${leg}_ft`, front ? pitch : -pitch * 0.5, 0, 0);
  }
}

function quadBody(P, r, ph, o = {}) {
  const d = r.dims;
  const b = sin(ph * TAU * (o.walk ? 2 : 1));
  P.off('pelvis', 0, (o.walk ? -0.012 + 0.008 * b : 0.002 * b) * d.H, 0);
  P.rot('pelvis', 0, o.walk ? 3 * sin(ph * TAU) : 0, o.walk ? 2 * sin(ph * TAU) : 0);
  P.rot('spine', 0.6 * b, 0, 0);
  P.rot('chest', o.walk ? 1.5 * b : 0.5 * b, o.walk ? -3 * sin(ph * TAU) : 0, 0);
  const look = o.walk ? 0 : 14 * sin(ph * TAU * 0.5) * smooth(0.2, 0.5, (ph * 2) % 1);
  P.rot('neck', (o.headDown || 0) + (o.walk ? -2 * b : 1.5 * b), look * 0.4, 0);
  P.rot('neck2', (o.headDown || 0) * 0.6, look * 0.3, 0);
  P.rot('head', 0, look * 0.3, 0);
  const tail = o.walk ? 12 * sin(ph * TAU * 2) : 18 * Math.max(0, sin(ph * TAU * 3)) ** 6;
  P.rot('tail', 0, 0, tail);
  P.rot('tail2', 0, 0, tail * 0.6);
  const ear = 10 * Math.max(0, sin(ph * TAU * 2 + 1)) ** 8;
  P.rot('ear_l', 0, 0, -ear);
  P.rot('ear_r', 0, 0, 0);
}

export const QUAD_CLIPS = {
  stand: { frames: 24, loop: true, rate: 0.1, fn(P, r, ph) { quadBody(P, r, ph); quadLegs(P, r, ph, {}); } },
  walk: { frames: 32, loop: true, stride: 'stride', fn(P, r, ph) { quadBody(P, r, ph, { walk: true }); quadLegs(P, r, ph, { walk: true }); } },
  graze: {
    frames: 24, loop: true, rate: 0.25,
    fn(P, r, ph) {
      quadBody(P, r, ph, { headDown: -48 });
      quadLegs(P, r, ph, {});
      P.rot('jaw', 6 + 6 * sin(ph * TAU * 3), 0, 0);
    },
  },
  lie: {
    frames: 12, loop: true, rate: 0.08,
    fn(P, r, ph) {
      const d = r.dims;
      const drop = d.H * 0.6;
      P.off('pelvis', 0, -drop * 1.02, 0);
      P.rot('pelvis', 2, 0, 3);
      P.addOff('chest', 0, 0, 0);
      P.rot('chest', 4, 0, 0);
      P.rot('neck', 10 + 2 * sin(ph * TAU), 8, 0); P.rot('neck2', 6, 6, 0); P.rot('head', -6, 4, 0);
      for (const s of ['l', 'r']) {
        // fore legs folded back under the chest at the carpus; hind legs tucked forward under the belly
        P.rot(`f${s}_up`, -12, 0, 0); P.rot(`f${s}_lo`, -150, 0, 0); P.rot(`f${s}_ft`, -10, 0, 0);
        P.rot(`h${s}_up`, 72, 0, s === 'l' ? -10 : 10); P.rot(`h${s}_lo`, -128, 0, 0); P.rot(`h${s}_ft`, -15, 0, 0);
      }
    },
  },
  bound: { // on its side, fore and hind legs drawn together and held (akedah — Tamid 4:1)
    frames: 12, loop: true, rate: 0.3,
    fn(P, r, ph) {
      const d = r.dims;
      P.root(0, d.W * 0.92, 0, 0, 0, 88);
      P.rot('spine', 0, 0, 2); P.rot('chest', 0, 0, 2);
      P.rot('neck', 18, 0, -6); P.rot('neck2', 10, 0, 0); P.rot('head', 6 + 2 * sin(ph * TAU), 0, 0);
      for (const s of ['l', 'r']) {
        const sg = s === 'l' ? -1 : 1;
        // legs gathered toward the belly: fore legs angled back, hind legs forward, crossing near the middle
        P.rot(`f${s}_up`, -28, 0, -sg * 22); P.rot(`f${s}_lo`, 30, 0, 0); P.rot(`f${s}_ft`, 10, 0, 0);
        P.rot(`h${s}_up`, 34, 0, -sg * 22); P.rot(`h${s}_lo`, -36, 0, 0); P.rot(`h${s}_ft`, -10, 0, 0);
      }
      P.rot('tail', 0, 0, 0);
    },
  },
};

export const BIRD_CLIPS = {
  stand: {
    frames: 16, loop: true, rate: 0.4,
    fn(P, r, ph) {
      const b = sin(ph * TAU);
      P.rot('body', 2 * b, 0, 0);
      const bob = Math.max(0, sin(ph * TAU * 2)) ** 3;
      P.off('neck', 0, 0, -0.012 * bob);
      P.rot('head', -6 * bob, 20 * sin(ph * TAU * 0.5), 0);
      P.rot('tail', -4, 0, 0);
    },
  },
  peck: {
    frames: 16, loop: true, rate: 0.8,
    fn(P, r, ph) {
      const k = smooth(0.1, 0.4, ph) * (1 - smooth(0.6, 0.9, ph));
      P.rot('body', -25 * k, 0, 0);
      P.rot('neck', -45 * k, 0, 0);
      P.rot('head', -20 * k, 0, 0);
      P.rot('tail', 15 * k, 0, 0);
    },
  },
  fly: {
    frames: 16, loop: true, rate: 4,
    fn(P, r, ph) {
      const f = sin(ph * TAU);
      P.off('body', 0, 0.01 * f, 0);
      P.rot('body', 8, 0, 0);
      P.rot('neck', -10, 0, 0);
      for (const [s, sg] of [['l', -1], ['r', 1]]) {
        // spread the folded wing sideways (about Y), then flap about the body axis (Z)
        P.rot(`wing_${s}`, 0, 0, sg * (10 + 55 * f));
        P.add(`wing_${s}`, 0, sg * 82, 0);
        P.rot(`wing_${s}2`, 0, 0, sg * (5 + 25 * f));
        P.rot(`leg_${s}`, 70, 0, 0);
      }
      P.rot('tail', 6, 0, 0);
    },
  },
};
export { clamp };

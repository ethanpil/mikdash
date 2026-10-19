// Animal pose library (quadrupeds: lamb, ram, goat, bull; and the birds). Same phase contract as clips.js.
// Clip flags read by the system: halter (show the halter and, without a leader, its hanging lead end),
// cord (show the akedah cord).
//
// 'bound' — the tamid lamb for shechitah (Tamid 4:1): "they did not tie it (kofet) but bound it as an akedah,
// and those who won the limbs held it". The akedah is "the hand with the foot, like the binding of Yitzchak"
// (Tamid 31b; Bartenura) — one fore leg drawn to the hind leg — and the Rambam rules it was not tied at all but
// held, fore and hind feet, by hand (Temidin uMusafin 1:10). It lies on its RIGHT side so the throat faces the
// slaughterer standing on the east facing west; with the actor's heading set to 180 (head to the south) the face,
// drawn back to bare the throat, turns toward the west — "its head to the south and its face to the west".
// 'bound_tied' adds the cord (Bartenura's reading); 'struggle' is the bound pose with small kicks.
import { Vector3 } from 'three';
import { TAU, smooth, clamp } from './util.js';

const sin = Math.sin, cos = Math.cos;
const V = (x, y, z) => new Vector3(x, y, z);

function quadLegs(P, r, ph, o) {
  const d = r.dims;
  const L = d.stride, sF = 0.68;
  const lift = 0.07 * d.H;
  const legs = [['hl', 0], ['fl', 0.25], ['hr', 0.5], ['fr', 0.75]];   // lateral-sequence walk
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
    const tgt = V(rest.x + sg * 0.004, rest.y + y, rest.z + z + (o.lean || 0) * (front ? -1 : 1));
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
  const look = o.walk || o.led ? 0 : 14 * sin(ph * TAU * 0.5) * smooth(0.2, 0.5, (ph * 2) % 1);
  // a led animal stretches its neck forward against the halter
  const pull = o.led ? -14 : 0;
  P.rot('neck', (o.headDown || 0) + pull + (o.walk ? -2 * b : 1.5 * b), look * 0.4, 0);
  P.rot('neck2', (o.headDown || 0) * 0.6 + pull * 0.5, look * 0.3, 0);
  P.rot('head', (o.led ? 8 : 0) + (o.headTilt || 0), look * 0.3 + (o.led ? 4 * sin(ph * TAU) : 0), 0);
  const tail = o.walk ? 12 * sin(ph * TAU * 2) : 18 * Math.max(0, sin(ph * TAU * 3)) ** 6;
  P.rot('tail', 0, 0, tail);
  P.rot('tail2', 0, 0, tail * 0.6);
  const ear = 10 * Math.max(0, sin(ph * TAU * 2 + 1)) ** 8;
  P.rot('ear_l', 0, 0, -ear);
  P.rot('ear_r', 0, 0, 0);
}

/** on the right side, the left (upper) fore and hind legs drawn together, the neck stretched back */
function boundPose(P, r, ph, kick = 0) {
  const d = r.dims;
  const k1 = kick * sin(ph * TAU * 3), k2 = kick * sin(ph * TAU * 2 + 1.3);
  // the body's half-width (with fleece) above the floor; the barrel centred on the actor's position
  P.root(-d.H * 0.47, d.W * 1.18 + 0.03 * d.H / 0.66, 0, 0, 0, -88);
  P.rot('spine', 0, 0, -2); P.rot('chest', 0, 0, -2);
  // neck and head drawn back (dorsal): the throat bared toward the slaughterer, the face turned up-and-back
  P.rot('neck', 24 + 3 * k2, 0, 4); P.rot('neck2', 16, 0, 0); P.rot('head', 14 + 4 * k1, 0, 0);
  P.rot('jaw', 3 + 3 * Math.max(0, k2), 0, 0);
  for (const s of ['l', 'r']) {
    const top = s === 'l';                        // the left legs lie uppermost
    const a = top ? 1 : 0.8;
    // the legs stand out from the belly toward the slaughterer, the fore leg swung back and the hind leg forward
    // until fore and hind feet come together (akedah) where the holders grip them; knees and hocks nearly straight
    P.rot(`f${s}_up`, -40 * a + 4 * k1, 0, top ? 8 : -4); P.rot(`f${s}_lo`, -10 * a, 0, 0); P.rot(`f${s}_ft`, -14, 0, 0);
    P.rot(`h${s}_up`, 40 * a + 4 * k2, 0, top ? 8 : -4); P.rot(`h${s}_lo`, 16 * a - 6 * k2, 0, 0); P.rot(`h${s}_ft`, 12, 0, 0);
  }
  P.rot('tail', 6, 0, 0);
  P.rot('ear_l', 0, 0, -10); P.rot('ear_r', 0, 0, 10);
}

export const QUAD_CLIPS = {
  stand: { frames: 24, loop: true, rate: 0.1, fn(P, r, ph) { quadBody(P, r, ph); quadLegs(P, r, ph, {}); } },
  walk: { frames: 32, loop: true, stride: 'stride', fn(P, r, ph) { quadBody(P, r, ph, { walk: true }); quadLegs(P, r, ph, { walk: true }); } },
  // led on a rope (Tamid 3:5 "he who won the tamid draws it to the slaughterhouse"): halter on, neck stretched
  walk_led: { frames: 32, loop: true, stride: 'stride', halter: true, fn(P, r, ph) { quadBody(P, r, ph, { walk: true, led: true }); quadLegs(P, r, ph, { walk: true }); } },
  stand_led: { frames: 24, loop: true, rate: 0.12, halter: true, fn(P, r, ph) { quadBody(P, r, ph, { led: true }); quadLegs(P, r, ph, { lean: 0.02 * r.dims.H }); } },
  stand_halter: { frames: 24, loop: true, rate: 0.1, halter: true, fn(P, r, ph) { quadBody(P, r, ph); quadLegs(P, r, ph, {}); } },
  graze: {
    frames: 24, loop: true, rate: 0.25,
    fn(P, r, ph) {
      quadBody(P, r, ph, { headDown: -48 });
      quadLegs(P, r, ph, {});
      P.rot('jaw', 6 + 6 * sin(ph * TAU * 3), 0, 0);
    },
  },
  // watered from the gold cup before the slaughter (Tamid 3:4): head lowered forward to the cup
  drink: {
    frames: 16, loop: true, rate: 0.5, halter: true,
    fn(P, r, ph) {
      quadBody(P, r, ph, { headDown: -30, headTilt: -14 });
      quadLegs(P, r, ph, {});
      P.rot('jaw', 3 + 4 * Math.max(0, sin(ph * TAU)), 0, 0);
    },
  },
  lie: {
    frames: 12, loop: true, rate: 0.08,
    fn(P, r, ph) {
      const d = r.dims;
      // sternal recumbency: the barrel resting on the floor, fore legs folded under at the knee, hind legs tucked
      P.off('pelvis', 0, -d.H * 0.6, 0);
      P.rot('pelvis', 2, 0, 4);
      P.rot('chest', 4, 0, -2);
      P.rot('neck', 10 + 2 * sin(ph * TAU), 8, 0); P.rot('neck2', 6, 6, 0); P.rot('head', -6, 4, 0);
      for (const s of ['l', 'r']) {
        P.rot(`f${s}_up`, -14, 0, 0); P.rot(`f${s}_lo`, -150, 0, 0); P.rot(`f${s}_ft`, -12, 0, 0);
        P.rot(`h${s}_up`, 74, 0, s === 'l' ? -12 : 12); P.rot(`h${s}_lo`, -130, 0, 0); P.rot(`h${s}_ft`, -15, 0, 0);
      }
    },
  },
  bound: { frames: 12, loop: true, rate: 0.3, fn(P, r, ph) { boundPose(P, r, ph, 0.3); } },
  bound_tied: { frames: 12, loop: true, rate: 0.3, cord: true, fn(P, r, ph) { boundPose(P, r, ph, 0.3); } },
  struggle: { frames: 24, loop: true, rate: 0.9, fn(P, r, ph) { boundPose(P, r, ph, 2.5); } },
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
  // crouched in a cage or a basket: fluffed, head drawn in
  perch: {
    frames: 12, loop: true, rate: 0.3,
    fn(P, r, ph) {
      P.off('body', 0, -0.02, 0);
      P.rot('body', 4, 0, 0);
      P.off('neck', 0, -0.012, 0.008);
      P.rot('head', -8, 25 * sin(ph * TAU * 0.5) * smooth(0.3, 0.6, (ph * 2) % 1), 0);
      for (const s of ['l', 'r']) P.rot(`leg_${s}`, 40, 0, 0);
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

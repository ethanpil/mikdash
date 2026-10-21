// Mechanical and human foley: gates and their bolts, the magrefah, Ben Katin's muchni, the knock at the
// Moked, barefoot kohanim on stone, the keys and chains, thousands prostrating, the Beit Avtinas pestle, an earthenware
// pot broken at the scouring.
// Techniques: modal synthesis for struck wood/metal/stone, stick-slip impulse trains through structural
// resonances for creaks and groans, granular noise for cloth and grit.
import { Biquad, OnePole, SVF, Brown, TAU, clamp, secs, modes, burst, addInto, resonate, smooth01 } from './dsp.js';

/** Stick-slip friction: an impulse train whose rate follows rate(t) with per-slip jitter → resonator bank. */
function friction(sr, rng, dur, rate, ampf, bank, o = {}) {
  const n = secs(dur, sr), exc = new Float32Array(n);
  let t = o.t0 || 0;
  while (t < dur) {
    const r = Math.max(2, rate(t));
    const a = ampf(t) * (1 + rng.bi() * (o.ampJit ?? 0.35));
    const i = Math.round(t * sr);
    if (i < n && a > 0) {
      // each slip is a tiny decaying click (a few samples) – sharper for squeaks
      const len = Math.max(2, Math.round(sr * (o.slipLen ?? 0.0012)));
      for (let k = 0; k < len && i + k < n; k++) exc[i + k] += a * (1 - k / len) * (k === 0 ? 1 : rng.bi() * 0.6);
    }
    t += (1 / r) * (1 + rng.bi() * (o.jitter ?? 0.18));
  }
  return resonate(exc, sr, bank, o.dry ?? 0.05);
}

/** A struck-body impact: modal ring + noise transient. */
function impact(out, sr, rng, at, o) {
  const list = o.modes.map((m) => ({ f: m.f * (1 + rng.bi() * (o.spread ?? 0.02)), a: m.a * (0.6 + 0.8 * rng.next()), t60: m.t60 * rng.uni(0.85, 1.15) }));
  modes(out, sr, at * sr, list, o.gain ?? 1, rng);
  if (o.noise) {
    const b = burst(rng, sr, o.noise.dur, o.noise.decay, o.noise.lp || 0);
    if (o.noise.hp) { const h = new Biquad('highpass', o.noise.hp, 0.7, 0, sr); h.run(b); }
    addInto(out, b, at * sr, o.noise.gain ?? 0.3);
  }
}

/**
 * A heavy door leaf meeting its stop: low leaf modes (the boom), mid-band wood-plate partials (150-720 Hz:
 * the body a small speaker can reproduce), a knock transient (400-1200 Hz), a thud of noise, and an
 * asymmetric soft-clip of the low layer whose 2nd/3rd harmonics carry the boom's pitch where the
 * fundamentals (31-118 Hz) are lost on phone and laptop speakers.
 */
function doorBoom(out, sr, rng, at, g, low) {
  const lowBuf = new Float32Array(Math.min(out.length, secs(at + 2, sr)));
  impact(lowBuf, sr, rng, at, { modes: low, gain: 0.4 * g });
  const pk = lowBuf.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-9);
  const harm = new Float32Array(lowBuf.length), b = 0.25, k = 2.4, off = Math.tanh(k * b);
  for (let i = 0; i < lowBuf.length; i++) harm[i] = Math.tanh(k * (lowBuf[i] / pk + b)) - off;
  for (let s = 0; s < 2; s++) new Biquad('highpass', 150, 0.7, 0, sr).run(harm);
  addInto(out, lowBuf, 0, 1);
  addInto(out, harm, 0, pk * 0.55);
  // wood-plate partials of the leaf and its frame
  const plate = [148, 186, 232, 281, 347, 412, 498, 596, 715].map((f, j) => ({ f, a: 0.95 - j * 0.05, t60: 0.48 - j * 0.03 }));
  impact(out, sr, rng, at, { modes: plate, gain: 0.5 * g, spread: 0.04, noise: { dur: 0.12, decay: 0.03, lp: 900, gain: 0.9 * g } });
  // the knock of the meeting edges
  const kn = burst(rng, sr, 0.03, 0.006);
  new Biquad('bandpass', 720, 0.8, 0, sr).run(kn);
  addInto(out, kn, at * sr, 1.1 * g);
  impact(out, sr, rng, at, { modes: [{ f: 480, a: 1, t60: 0.09 }, { f: 760, a: 0.8, t60: 0.07 }, { f: 1120, a: 0.5, t60: 0.05 }], gain: 0.22 * g });
}

// structural resonances (the leaves' low modes radiate weakly; the mid-band body carries the groan)
const DOOR_BIG = [{ f: 38, q: 6, g: 0.8 }, { f: 61, q: 7, g: 0.8 }, { f: 92, q: 8, g: 0.8 }, { f: 140, q: 9, g: 0.8 }, { f: 215, q: 10, g: 0.8 }, { f: 330, q: 11, g: 0.7 }, { f: 520, q: 12, g: 0.5 }, { f: 860, q: 12, g: 0.3 }];
const DOOR = [{ f: 70, q: 7, g: 1 }, { f: 118, q: 8, g: 0.9 }, { f: 190, q: 9, g: 0.75 }, { f: 300, q: 10, g: 0.55 }, { f: 470, q: 11, g: 0.4 }, { f: 760, q: 12, g: 0.25 }, { f: 1250, q: 12, g: 0.15 }];
const WHEEL = [{ f: 85, q: 6, g: 0.8 }, { f: 150, q: 8, g: 0.9 }, { f: 240, q: 10, g: 0.8 }, { f: 390, q: 12, g: 0.6 }, { f: 610, q: 14, g: 0.45 }, { f: 980, q: 14, g: 0.3 }, { f: 1600, q: 12, g: 0.2 }];

/** Heavy wooden gate boom: bolt, the leaves meeting the stops, plating rattle. */
export function gateBoom(sr, rng, o = {}) {
  const out = new Float32Array(secs(3.2, sr));
  // the bolt shot home / drawn: a short scrape then a clack
  const scr = friction(sr, rng.fork(1), 0.35, (t) => 220 + 300 * t, (t) => 0.25 * smooth01(t / 0.05), [{ f: 900, q: 6, g: 1 }, { f: 1700, q: 8, g: 0.6 }, { f: 2900, q: 10, g: 0.4 }], { slipLen: 0.0006 });
  addInto(out, scr, 0, 0.5);
  impact(out, sr, rng, 0.36, { modes: [{ f: 1150, a: 1, t60: 0.18 }, { f: 2350, a: 0.6, t60: 0.12 }, { f: 3900, a: 0.4, t60: 0.08 }], gain: 0.12, noise: { dur: 0.02, decay: 0.004, gain: 0.25, hp: 1500 } });
  // the boom: leaves striking — low leaf modes, wood-plate body, knock
  const t1 = 0.62;
  doorBoom(out, sr, rng, t1, 1, [{ f: 34, a: 1, t60: 0.9 }, { f: 52, a: 0.95, t60: 0.75 }, { f: 77, a: 0.85, t60: 0.6 }, { f: 118, a: 0.75, t60: 0.45 }]);
  // metal plating / fittings rattle after the hit
  for (let k = 0; k < 7; k++) impact(out, sr, rng, t1 + 0.03 + k * rng.uni(0.025, 0.05), { modes: [{ f: rng.uni(1400, 2600), a: 1, t60: 0.2 }, { f: rng.uni(3000, 5200), a: 0.5, t60: 0.12 }], gain: 0.02 * (1 - k / 8) });
  return out;
}

/** The great gate of the Heichal: locks, the bar (negar) drawn, the leaves groaning on their pivots, the boom. */
export function greatGateOpen(sr, rng, o = {}) {
  const out = new Float32Array(secs(9.5, sr));
  // two locks (pote'ach) — heavy metal clacks
  for (const at of [0.1, 0.75]) {
    impact(out, sr, rng, at, { modes: [{ f: 640, a: 1, t60: 0.3 }, { f: 1330, a: 0.7, t60: 0.2 }, { f: 2240, a: 0.5, t60: 0.15 }, { f: 3600, a: 0.3, t60: 0.1 }], gain: 0.1, noise: { dur: 0.02, decay: 0.005, gain: 0.3, hp: 800 } });
    impact(out, sr, rng, at + 0.11, { modes: [{ f: 180, a: 1, t60: 0.25 }, { f: 330, a: 0.6, t60: 0.2 }], gain: 0.15 });
  }
  // the bar drawn: long wood-on-metal scrape
  const bar = friction(sr, rng.fork(2), 1.3, (t) => 140 + 90 * Math.sin(t * 3), (t) => 0.3 * smooth01(t / 0.1) * smooth01((1.3 - t) / 0.15), [{ f: 260, q: 6, g: 1 }, { f: 520, q: 8, g: 0.8 }, { f: 1100, q: 9, g: 0.5 }, { f: 2300, q: 10, g: 0.25 }], { slipLen: 0.001 });
  addInto(out, bar, secs(1.25, sr), 1.6);
  impact(out, sr, rng, 2.6, { modes: [{ f: 95, a: 1, t60: 0.4 }, { f: 210, a: 0.6, t60: 0.3 }, { f: 480, a: 0.3, t60: 0.15 }], gain: 0.35, noise: { dur: 0.05, decay: 0.012, lp: 1500, gain: 0.4 } });
  // two leaves (outer pair, then inner pair folding) groaning on their pivots
  for (const [start, len, base] of [[3.0, 4.2, 24], [3.6, 3.9, 31]]) {
    const r = rng.fork(Math.round(start * 10));
    const groan = friction(sr, r, len, (t) => base + 14 * Math.sin(t * 1.7 + r.next() * 3) + 9 * Math.sin(t * 5.3) + (t < 0.4 ? 30 * (1 - t / 0.4) : 0),
      (t) => 0.6 * smooth01(t / 0.3) * smooth01((len - t) / 0.5) * (0.75 + 0.25 * Math.sin(t * 2.3)), DOOR_BIG, { jitter: 0.25, slipLen: 0.002, dry: 0.02 });
    // a higher squeal riding the groan in places (stick-slip at the metal-shod pivot)
    const sq = friction(sr, r.fork(5), len, (t) => 380 + 120 * Math.sin(t * 2.1), (t) => 0.12 * Math.max(0, Math.sin(t * 1.3 + 0.5)) * smooth01(t / 0.5) * smooth01((len - t) / 0.5), [{ f: 760, q: 18, g: 1 }, { f: 1520, q: 20, g: 0.5 }], { jitter: 0.06, slipLen: 0.0005 });
    addInto(out, groan, secs(start, sr), 2.6);
    addInto(out, sq, secs(start, sr), 0.9);
  }
  // the leaves reach their stops: the boom heard to Yericho (Tamid 3:8)
  for (const [at, g] of [[7.25, 1.2], [7.55, 0.9]]) {
    doorBoom(out, sr, rng, at, g, [{ f: 31, a: 1, t60: 1.2 }, { f: 47, a: 0.95, t60: 1 }, { f: 71, a: 0.85, t60: 0.75 }, { f: 109, a: 0.75, t60: 0.5 }]);
  }
  return out;
}

/** Magrefah hurled between the Ulam and the altar (Tamid 5:6): impact, bounces, ringing blade, slide. */
export function magrefah(sr, rng, o = {}) {
  const out = new Float32Array(secs(5.5, sr));
  // blade modes: a heavy metal plate (inharmonic plate ratios), long ring at the bottom
  const base = rng.uni(165, 195), ratios = [1, 1.59, 2.14, 2.65, 2.92, 3.5, 4.06, 4.6, 5.3, 6.2, 7.4, 8.9, 10.5, 12.3, 14.9, 18.2, 22.5, 27.6, 33.5, 41];
  const blade = ratios.map((r, k) => ({ f: base * r * (1 + rng.bi() * 0.015), a: Math.pow(k + 1, -0.35), t60: clamp(2.8 * Math.pow(k + 1, -0.55), 0.18, 3) }));
  const hits = [[0.03, 1], [0.34, 0.55], [0.55, 0.3], [0.68, 0.16], [0.76, 0.08]];
  for (const [at, g] of hits) {
    const list = blade.map((m) => ({ f: m.f, a: m.a * (0.3 + 1.2 * rng.next()), t60: m.t60 }));
    modes(out, sr, at * sr, list, 0.09 * g, rng);
    // stone floor: thud + grit crunch
    const thud = burst(rng, sr, 0.15, 0.03, 380);
    addInto(out, thud, at * sr, 1.4 * g);
    const crunch = burst(rng, sr, 0.03, 0.006);
    const hp = new Biquad('highpass', 2500, 0.7, 0, sr); hp.run(crunch);
    addInto(out, crunch, at * sr, 0.5 * g);
    // the wooden handle clatters
    impact(out, sr, rng, at + rng.uni(0.03, 0.08), { modes: [{ f: rng.uni(420, 520), a: 1, t60: 0.08 }, { f: rng.uni(900, 1200), a: 0.6, t60: 0.06 }, { f: rng.uni(1900, 2400), a: 0.4, t60: 0.04 }], gain: 0.12 * g });
  }
  // final scrape as it slides to rest
  const slide = friction(sr, rng.fork(9), 0.55, (t) => 300 - 250 * t, (t) => 0.2 * (1 - t / 0.55), [{ f: base * 2.14, q: 15, g: 1 }, { f: base * 4.06, q: 15, g: 0.6 }, { f: 2800, q: 4, g: 0.4 }], { slipLen: 0.0006 });
  addInto(out, slide, secs(0.85, sr), 0.5);
  return out;
}

/** Ben Katin's muchni: the wooden wheel machine raising the kiyor from its well (Tamid 1:4, 3:8). */
export function muchni(sr, rng, o = {}) {
  const dur = o.duration || 8.5, out = new Float32Array(secs(dur + 1.5, sr));
  // four hauls: each a rising wooden groan of the axle plus creaks of the frame and a peg knock
  const hauls = [0.15, 2.0, 3.85, 5.6];
  hauls.forEach((t0, h) => {
    const r = rng.fork(h + 1), len = 1.65;
    const groan = friction(sr, r, len, (t) => 55 + 70 * smooth01(t / len) + 12 * Math.sin(t * 9), (t) => 0.5 * smooth01(t / 0.25) * smooth01((len - t) / 0.3), WHEEL, { jitter: 0.22, slipLen: 0.0016 });
    addInto(out, groan, secs(t0, sr), 0.8);
    const creak = friction(sr, r.fork(3), 0.6, (t) => 240 + 260 * t, (t) => 0.2 * Math.sin(Math.PI * t / 0.6), [{ f: 640, q: 16, g: 1 }, { f: 1290, q: 18, g: 0.5 }, { f: 2050, q: 14, g: 0.3 }], { jitter: 0.08, slipLen: 0.0006 });
    addInto(out, creak, secs(t0 + r.uni(0.4, 0.9), sr), 0.5);
    // peg / pawl knock as the wheel is held between hauls
    impact(out, sr, r, t0 + len + 0.05, { modes: [{ f: 190, a: 1, t60: 0.15 }, { f: 420, a: 0.7, t60: 0.1 }, { f: 860, a: 0.4, t60: 0.06 }, { f: 1500, a: 0.2, t60: 0.04 }], gain: 0.35, noise: { dur: 0.015, decay: 0.004, gain: 0.15, lp: 3000 } });
  });
  // water streaming off the rising laver and dripping back into the well
  addInto(out, waterRunoff(sr, rng.fork(77), dur), 0, 0.5);
  return out;
}

function waterRunoff(sr, rng, dur) {
  const out = new Float32Array(secs(dur + 1, sr));
  // pouring stream: dense small bubbles, intensifying with the hauls, then drips
  let t = 0.5;
  while (t < dur) {
    const dens = t < dur - 2 ? 140 * smooth01((t - 0.5) / 2) : 25 * (1 - (t - dur + 2) / 2);
    bubble(out, sr, rng, t, rng.uni(500, 2400) * (t > dur - 2 ? 0.7 : 1), rng.uni(0.15, 0.6) * (t > dur - 2 ? 1.5 : 1));
    t += rng.exp(Math.max(3, dens));
  }
  const lp = new OnePole(5000, sr);
  for (let i = 0; i < out.length; i++) out[i] = lp.process(out[i]);
  return out;
}

/** One Minnaert bubble: a rising, quickly decaying sinusoid. */
export function bubble(out, sr, rng, t, f0, amp) {
  const i0 = Math.round(t * sr), tau = clamp(0.4 / f0 + 0.003, 0.003, 0.02), n = Math.min(out.length - i0, secs(tau * 6, sr));
  let ph = 0;
  const rise = rng.uni(0.08, 0.35);
  for (let i = 0; i < n; i++) {
    const tt = i / sr, f = f0 * (1 + rise * tt / tau * 0.25);
    ph += f / sr;
    out[i0 + i] += Math.sin(TAU * ph) * Math.exp(-tt / tau) * amp * (i < 8 ? i / 8 : 1);
  }
}

/** Knock at the Moked door (Tamid 1:2): three knocks on a heavy wooden door. */
export function knock(sr, rng, o = {}) {
  const out = new Float32Array(secs(2.2, sr));
  const times = o.count === 2 ? [0.05, 0.45] : [0.05, 0.42, 0.78];
  times.forEach((at, k) => {
    const g = k === times.length - 1 ? 1.05 : 0.92;
    impact(out, sr, rng, at, { modes: DOOR.map((m) => ({ f: m.f * 1.15, a: m.g, t60: 0.22 * Math.pow(100 / m.f, 0.3) })), gain: 0.5 * g, noise: { dur: 0.02, decay: 0.003, gain: 0.5 * g, lp: 4200 }, spread: 0.04 });
  });
  return out;
}

/** Barefoot steps on stone (kohanim always barefoot — Zevachim 24a): heel thump, skin slap, toe roll. */
export function footsteps(sr, rng, o = {}) {
  const steps = o.steps ?? 6, pace = o.pace || 0.56;
  const out = new Float32Array(secs(steps * pace + 0.5, sr));
  const lp2 = (b, f) => { const q = new Biquad('lowpass', f, 0.7, 0, sr); q.run(b); return b; };
  const hp2 = (b, f) => { const q = new Biquad('highpass', f, 0.7, 0, sr); q.run(b); return b; };
  for (let s = 0; s < steps; s++) {
    const at = 0.02 + s * pace + rng.uni(-0.03, 0.03), g = rng.uni(0.75, 1) * (s % 2 ? 0.92 : 1);
    addInto(out, lp2(burst(rng, sr, 0.07, 0.014), 220), at * sr, 2.2 * g);                       // heel: soft low thump
    addInto(out, lp2(hp2(burst(rng, sr, 0.03, 0.005), 700), 2600), at * sr, 0.5 * g);            // skin slap on stone
    addInto(out, lp2(hp2(burst(rng, sr, 0.04, 0.008), 500), 1900), (at + rng.uni(0.07, 0.11)) * sr, 0.35 * g); // toe roll-off
    if (rng.chance(0.3)) addInto(out, lp2(hp2(burst(rng, sr, 0.06, 0.02), 2500), 6000), (at + 0.1) * sr, 0.05 * g); // grit scuff
  }
  return out;
}

/** Keys and chains (Middot 1:9; Tamid 3:6 — two keys, one reaching to the armpit): chain, jingle, set down. */
export function keys(sr, rng, o = {}) {
  const out = new Float32Array(secs(3, sr));
  // chain drawn through the hand: rapid small clinks
  let t = 0.05;
  while (t < 0.85) {
    impact(out, sr, rng, t, { modes: [{ f: rng.uni(2600, 4200), a: 1, t60: 0.05 }, { f: rng.uni(5200, 7600), a: 0.5, t60: 0.03 }], gain: 0.05 * rng.uni(0.4, 1) * (1 - t) });
    t += rng.uni(0.012, 0.045);
  }
  // the big keys knocking together
  const keyF = [rng.uni(900, 1100), rng.uni(1500, 1800)];
  for (let k = 0; k < 9; k++) {
    const at = 0.7 + Math.abs(rng.gauss()) * 0.45, f = rng.pick(keyF);
    impact(out, sr, rng, at, { modes: [{ f, a: 1, t60: 0.35 }, { f: f * 2.76, a: 0.6, t60: 0.22 }, { f: f * 5.4, a: 0.35, t60: 0.12 }, { f: f * 8.9, a: 0.2, t60: 0.06 }], gain: 0.06 * rng.uni(0.4, 1) });
  }
  // laid on the marble slab
  impact(out, sr, rng, 1.9, { modes: [{ f: keyF[0], a: 1, t60: 0.25 }, { f: keyF[1], a: 0.8, t60: 0.2 }, { f: 3400, a: 0.4, t60: 0.08 }], gain: 0.1, noise: { dur: 0.02, decay: 0.004, gain: 0.25, lp: 6000 } });
  return out;
}

/** Thousands prostrating at once (Tamid 7:3): a wave of cloth, knees and palms on stone, one long exhale. */
export function crowdProstrate(sr, rng, o = {}) {
  const dur = 5.5, out = new Float32Array(secs(dur, sr));
  const dens = (t) => Math.exp(-Math.pow((t - 1.2) / 0.55, 2)) + 0.35 * Math.exp(-Math.pow((t - 2.1) / 0.8, 2));
  // cloth rustle grains
  for (let t = 0.1; t < 4; t += rng.exp(260 * Math.max(0.02, dens(t)))) {
    const len = rng.uni(0.03, 0.12), b = burst(rng, sr, len, len * 0.4);
    const f = new Biquad('bandpass', rng.uni(1500, 5500), 0.9, 0, sr); f.run(b);
    addInto(out, b, t * sr, 0.12 * rng.uni(0.3, 1));
  }
  // knees, palms and foreheads on stone: low dull thuds
  for (let t = 0.5; t < 3.2; t += rng.exp(90 * Math.max(0.03, dens(t)))) {
    addInto(out, burst(rng, sr, 0.05, 0.012, rng.uni(180, 420)), t * sr, 0.35 * rng.uni(0.3, 1));
  }
  // the collective exhale as they lie flat (shaped breath noise)
  const ex = new Float32Array(out.length), br = new Brown(rng), bp = new SVF(700, 0.8, sr), bp2 = new SVF(1600, 1.2, sr);
  for (let i = 0; i < ex.length; i++) {
    const t = i / sr, e = smooth01((t - 1.3) / 0.9) * smooth01((4.9 - t) / 1.6);
    const w = rng.bi() * 0.6 + br.next();
    bp.process(w); bp2.process(w);
    ex[i] = (bp.bp + bp2.bp * 0.5) * e;
  }
  addInto(out, ex, 0, 0.35);
  return out;
}

/**
 * An earthenware pot dashed on the court's stone pavement and broken — the scouring: "an earthenware vessel in which
 * [a sin-offering] was cooked shall be broken" (Lev 6:21), in a holy place (Zevachim 11:4; 11:5 for one taken outside
 * the curtains), as the copper ones are scoured and rinsed (11:7). Fired clay is lossy (loss factor ~0.01–0.02): its
 * shell rings for tens of milliseconds, not seconds. The hit: the pot's body knocks (a few damped shell modes, 0.4–2.3 kHz) with a
 * thud of the floor and the air in its mouth; the fractures run in a burst of clicks; then three to six large sherds
 * bounce and settle on the stone (each its own small-plate modes, 1–6 kHz, shorter for the smaller pieces, hits closing
 * up by the restitution), many small bits skitter over about a second, and one sherd slides to rest.
 * o.size: the pot's size (0.6 small … 1.4 large cauldron; default 1).
 */
export function potBreak(sr, rng, o = {}) {
  const size = clamp(o.size ?? 1, 0.5, 1.6);
  const out = new Float32Array(secs(2.6, sr));
  const t0 = 0.012;
  // the body's knock (lower for a larger pot) and the floor's thud
  const f0 = rng.uni(430, 520) / size;
  impact(out, sr, rng, t0, { modes: [{ f: f0, a: 1, t60: 0.06 }, { f: f0 * rng.uni(1.75, 1.95), a: 0.8, t60: 0.045 }, { f: f0 * rng.uni(2.9, 3.3), a: 0.6, t60: 0.035 }, { f: f0 * rng.uni(4.4, 5), a: 0.4, t60: 0.025 }], gain: 0.55, spread: 0.03, noise: { dur: 0.03, decay: 0.006, lp: 2600, gain: 0.9 } });
  addInto(out, burst(rng, sr, 0.07, 0.014, 260 / Math.sqrt(size)), t0 * sr, 0.8);
  // the fractures: a dense, bright cluster of clicks within ~10 ms (kept below the knock: as single-sample spikes they
  // set the buffer's peak, and the −1 dBFS cap then held the whole cue ~8 dB under its level)
  for (let k = 0; k < 16; k++) {
    const b = burst(rng, sr, 0.005, 0.0012);
    new Biquad('highpass', rng.uni(1500, 3000), 0.7, 0, sr).run(b);
    addInto(out, b, (t0 + 0.0015 + Math.abs(rng.gauss()) * 0.007) * sr, 0.22 * rng.uni(0.4, 1));
  }
  // the large sherds: thrown up a little, then a bounce sequence each (restitution ≈ 0.45–0.6 in time, energy falling)
  const big = rng.int(3, 6);
  for (let s = 0; s < big; s++) {
    const piece = rng.uni(0.45, 1) * size; // relative size of the sherd
    const f1 = rng.uni(1100, 1900) / piece;
    const modesS = [1, rng.uni(1.6, 1.85), rng.uni(2.6, 3.0), rng.uni(3.9, 4.5)]
      .map((r, j) => ({ f: f1 * r, a: [1, 0.7, 0.45, 0.3][j], t60: clamp(55 / (f1 * r) * (0.8 + 0.4 * piece), 0.012, 0.07) }));
    let at = t0 + rng.uni(0.07, 0.24), dt = rng.uni(0.07, 0.15), g = rng.uni(0.45, 0.85) * Math.sqrt(piece);
    for (let b = 0; b < 7 && g > 0.04 && at < 2.2; b++) {
      impact(out, sr, rng, at, { modes: modesS, gain: 0.22 * g, spread: 0.02, noise: { dur: 0.006, decay: 0.0012, gain: 0.3 * g, hp: 1800 } });
      at += dt; dt *= rng.uni(0.45, 0.62); g *= rng.uni(0.45, 0.65);
    }
    // it rocks to rest: a few quick ticks
    for (let r = 0; r < 3; r++) impact(out, sr, rng, at + r * rng.uni(0.012, 0.025), { modes: modesS.slice(1), gain: 0.04 * g, spread: 0.02 });
  }
  // the small bits: Poisson ticks, dense at first and thinning (τ ≈ 0.3 s), high and short
  for (let t = t0 + 0.02; t < 1.6; t += rng.exp(240 * Math.exp(-(t - t0) / 0.3) + 4)) {
    const f = rng.uni(2600, 7500);
    impact(out, sr, rng, t, { modes: [{ f, a: 1, t60: rng.uni(0.008, 0.025) }, { f: f * rng.uni(1.7, 2.4), a: 0.5, t60: 0.01 }], gain: 0.05 * rng.uni(0.2, 1) * Math.exp(-(t - t0) / 0.45) });
  }
  // one sherd slides over the stone to rest
  const len = rng.uni(0.22, 0.38);
  const slide = friction(sr, rng.fork(5), len, (t) => 900 - 1600 * t, (t) => 0.18 * (1 - t / len), [{ f: rng.uni(1800, 2400), q: 5, g: 1 }, { f: rng.uni(3400, 4200), q: 6, g: 0.6 }, { f: 5600, q: 5, g: 0.35 }], { slipLen: 0.0005, jitter: 0.3 });
  addInto(out, slide, secs(t0 + rng.uni(0.3, 0.5), sr), 0.45);
  // the hit's spikes last a millisecond or two (the ear integrates over tens): a soft clip (× 2.5 into tanh) lets the
  // cue reach its level under the −1 dBFS peak cap, which otherwise held it ~9 dB under (K-weighted loudest 400 ms)
  let pk = 0;
  for (let i = 0; i < out.length; i++) pk = Math.max(pk, Math.abs(out[i]));
  if (pk > 0) { const k = 2.5, nk = Math.tanh(k); for (let i = 0; i < out.length; i++) out[i] = Math.tanh((k * out[i]) / pk) / nk; }
  return out;
}

/** The Beit Avtinas pestle in the stone mortar (thud + crushed-spice grit). */
export function pestle(out, sr, rng, at, g = 1) {
  addInto(out, burst(rng, sr, 0.12, 0.025, 320), at * sr, 0.9 * g);
  impact(out, sr, rng, at, { modes: [{ f: rng.uni(210, 250), a: 1, t60: 0.12 }, { f: rng.uni(520, 600), a: 0.5, t60: 0.08 }, { f: rng.uni(1300, 1500), a: 0.25, t60: 0.05 }], gain: 0.25 * g });
  const grit = burst(rng, sr, 0.09, 0.03);
  const hp = new Biquad('bandpass', rng.uni(2500, 4500), 0.8, 0, sr); hp.run(grit);
  addInto(out, grit, (at + 0.005) * sr, 0.35 * g);
}

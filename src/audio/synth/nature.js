// Ambient beds and creatures: the altar pyre and torches, the amah channel, gentle wind, night insects,
// doves (and the turtledoves/young pigeons of the kinim), sheep. Beds are rendered a little longer than
// their loop and cross-faded into seamless loops by the caller (index.js).
import { Biquad, OnePole, SVF, Pink, Brown, Drift, TAU, clamp, secs, burst, addInto } from './dsp.js';
import { bubble } from './foley.js';
import { bleat } from './calls.js';

/** Altar pyre (ma'arachah): low roar, flame flutter, crackles, pops, fat sizzle. Mono. */
export function fire(sr, rng, dur, o = {}) {
  const n = secs(dur, sr), out = new Float32Array(n);
  const size = o.size ?? 1; // 1 = the great pyre, ~0.3 = a hearth
  const br = new Brown(rng), pk = new Pink(rng);
  const lp1 = new Biquad('lowpass', 180 + 120 * (1 - size), 0.8, 0, sr), lp2 = new Biquad('lowpass', 260, 0.7, 0, sr), sub = new Biquad('highpass', 70, 0.7, 0, sr);
  const body = new SVF(650, 0.7, sr), sizzle = new Biquad('highpass', 4200, 0.7, 0, sr);
  const am = new Drift(rng.fork(1), 0.6, sr), flut = new Drift(rng.fork(2), 9, sr), gust = new Drift(rng.fork(3), 0.12, sr), siz = new Drift(rng.fork(4), 18, sr), sizSw = new Drift(rng.fork(5), 0.25, sr);
  for (let i = 0; i < n; i++) {
    const g = 0.75 + 0.25 * gust.next();
    const roar = lp2.process(lp1.process(br.next() * 3)) * (0.8 + 0.3 * am.next()) * g;
    body.process(pk.next());
    const fl = body.bp * (0.55 + 0.45 * flut.next()) * 0.5 * g;
    const sz = sizzle.process(rng.bi()) * Math.max(0, 0.35 + 0.65 * siz.next()) * Math.max(0, 0.4 + 0.6 * sizSw.next()) * 0.05 * size;
    out[i] = sub.process(roar) * 0.55 * size + fl * (0.7 + 0.4 * size) + sz;
  }
  // crackles: Poisson micro-bursts, often in small clusters
  for (let t = rng.exp(16); t < dur; t += rng.exp(16 * (0.5 + size * 0.7))) {
    const cl = rng.chance(0.3) ? rng.int(2, 6) : 1;
    for (let c = 0; c < cl; c++) {
      const at = t + c * rng.uni(0.002, 0.012), len = rng.uni(0.0006, 0.004);
      const b = burst(rng, sr, len * 4, len);
      const f = new Biquad('bandpass', rng.uni(1400, 7500), 1.1, 0, sr); f.run(b);
      addInto(out, b, at * sr, Math.pow(10, rng.uni(-1.6, 0)) * 2.4);
    }
  }
  // pops: sap steam / splitting wood — a thump and a sharp crack
  for (let t = rng.exp(0.5); t < dur; t += rng.exp(0.45 * (0.4 + size))) {
    addInto(out, burst(rng, sr, 0.04, 0.008, 900), t * sr, rng.uni(0.4, 1));
    const c = burst(rng, sr, 0.01, 0.0015);
    const h = new Biquad('highpass', 2000, 0.7, 0, sr); h.run(c);
    addInto(out, c, t * sr, rng.uni(1, 2.4));
  }
  return [out];
}

/** Torch: fluttering flame, soft roar, sparse crackle. Mono. */
export function torch(sr, rng, dur) {
  const n = secs(dur, sr), out = new Float32Array(n);
  const pk = new Pink(rng), br = new Brown(rng);
  const bp = new SVF(520, 0.8, sr), lp = new Biquad('lowpass', 240, 0.7, 0, sr);
  const flut = new Drift(rng.fork(1), 11, sr), slow = new Drift(rng.fork(2), 0.4, sr), whoosh = new Drift(rng.fork(3), 0.15, sr);
  for (let i = 0; i < n; i++) {
    const w = Math.max(0, whoosh.next()) ** 2;
    bp.process(pk.next());
    out[i] = bp.bp * (0.5 + 0.5 * flut.next()) * (0.7 + 0.3 * slow.next() + w * 0.8) * 0.8 + lp.process(br.next() * 2) * (0.25 + 0.6 * w);
  }
  for (let t = rng.exp(4); t < dur; t += rng.exp(4)) {
    const b = burst(rng, sr, 0.01, rng.uni(0.0005, 0.002));
    const f = new Biquad('bandpass', rng.uni(1800, 6500), 1.2, 0, sr); f.run(b);
    addInto(out, b, t * sr, Math.pow(10, rng.uni(-1.4, -0.2)) * 1.2);
  }
  const hp = new Biquad('highpass', 80, 0.7, 0, sr); hp.run(out);
  return [out];
}

/** The amah: water running in a stone channel — Minnaert bubbles over a soft flow bed. Mono. */
export function water(sr, rng, dur) {
  const n = secs(dur, sr), out = new Float32Array(n);
  const pk = new Pink(rng), bp = new SVF(900, 0.5, sr), hp = new Biquad('highpass', 2500, 0.7, 0, sr), sw = new Drift(rng.fork(1), 0.5, sr);
  for (let i = 0; i < n; i++) {
    const p = pk.next();
    bp.process(p);
    out[i] = bp.bp * 0.25 * (0.85 + 0.15 * sw.next()) + hp.process(p) * 0.03;
  }
  const dens = new Drift(rng.fork(2), 0.7, sr);
  for (let t = 0; t < dur; t += rng.exp(110 * (0.75 + 0.25 * dens.next()))) {
    const f = 300 * Math.pow(9, Math.pow(rng.next(), 1.4));
    bubble(out, sr, rng, t, f, 0.22 * Math.pow(300 / f, 0.35) * rng.uni(0.3, 1));
  }
  const lp = new OnePole(6500, sr), rumble = new Biquad('highpass', 180, 0.7, 0, sr);
  for (let i = 0; i < n; i++) out[i] = rumble.process(lp.process(out[i]));
  return [out];
}

/** Gentle wind around stone walls: slow gusts, a faint edge-whistle. Stereo (partly decorrelated). */
export function wind(sr, rng, dur) {
  const n = secs(dur, sr), L = new Float32Array(n), R = new Float32Array(n);
  const gust = new Drift(rng.fork(1), 0.07, sr), gust2 = new Drift(rng.fork(2), 0.19, sr);
  const ch = [0, 1].map((k) => ({ pk: new Pink(rng.fork(10 + k)), lp: new SVF(400, 0.6, sr), lp2: new OnePole(900, sr), wh: new SVF(900, 14, sr), cut: new Drift(rng.fork(20 + k), 0.25, sr), whf: new Drift(rng.fork(30 + k), 0.09, sr) }));
  const common = new Pink(rng.fork(5));
  for (let i = 0; i < n; i++) {
    const g = clamp(0.45 + 0.4 * gust.next() + 0.15 * gust2.next(), 0.08, 1);
    const cm = common.next();
    for (let k = 0; k < 2; k++) {
      const c = ch[k];
      if ((i & 31) === 0) { c.lp.set(260 + 520 * g + 120 * c.cut.next(), 0.6); c.wh.set(780 + 380 * c.whf.next(), 14); }
      const x = c.pk.next() * 0.6 + cm * 0.4;
      c.lp.process(x); c.wh.process(x);
      const y = c.lp2.process(c.lp.lp) * g * 0.9 + c.wh.bp * Math.pow(Math.max(0, g - 0.55) * 2.2, 2) * 0.05;
      (k ? R : L)[i] = y;
    }
  }
  return [L, R];
}

/**
 * Night insects: field crickets (chirps of 3-4 pulses ~4.7 kHz) and tree crickets (long trills ~2.9 kHz). Stereo.
 * o.temp (°C, default 24): calling rates scale linearly with temperature (Dolbear's law, N ∝ 7.2·T − 32);
 * the ambience silences the bed in the cold months.
 */
export function insects(sr, rng, dur, o = {}) {
  const n = secs(dur, sr), L = new Float32Array(n), R = new Float32Array(n);
  const pulse = (buf, t, f, len, a) => {
    const i0 = Math.round(t * sr), m = Math.min(buf.length - i0, secs(len, sr));
    for (let i = 0; i < m; i++) { const e = Math.sin(Math.PI * i / m); buf[i0 + i] += Math.sin(TAU * f * i / sr + 0.3 * Math.sin(TAU * f * 2 * i / sr)) * e * e * a; }
  };
  const slow = 1 / clamp((7.2 * (o.temp ?? 24) - 32) / (7.2 * 24 - 32), 0.25, 1.3); // period stretch vs a 24 °C night
  const crickets = o.crickets ?? 4;
  for (let k = 0; k < crickets; k++) {
    const r = rng.fork(k + 1), f = r.uni(4300, 5100), per = r.uni(0.32, 0.6) * slow, pan = r.uni(-0.9, 0.9), a = r.uni(0.15, 0.5);
    const gl = Math.sqrt((1 - pan) / 2) * a, gr = Math.sqrt((1 + pan) / 2) * a, pp = 0.033 * Math.min(1.8, slow);
    for (let t = r.uni(0, per); t < dur; t += per * r.uni(0.96, 1.04)) {
      if (r.chance(0.08)) { t += r.uni(1, 4); continue; } // pauses
      const pulses = r.int(3, 4);
      for (let p = 0; p < pulses; p++) { pulse(L, t + p * pp, f, 0.017, gl); pulse(R, t + p * pp, f, 0.017, gr); }
    }
  }
  for (let k = 0; k < (o.trills ?? 2); k++) {
    const r = rng.fork(k + 50), f = r.uni(2750, 3050), pan = r.uni(-0.8, 0.8), a = r.uni(0.08, 0.22);
    const gl = Math.sqrt((1 - pan) / 2) * a, gr = Math.sqrt((1 + pan) / 2) * a, tp = 0.021 * Math.min(1.8, slow);
    for (let t = r.uni(0, 3); t < dur;) {
      const len = r.uni(1.5, 4.5);
      for (let p = 0; p * tp < len && t + p * tp < dur - 0.05; p++) { pulse(L, t + p * tp, f, 0.012, gl); pulse(R, t + p * tp, f, 0.012, gr); }
      t += len + r.uni(0.6, 2.5);
    }
  }
  return [L, R];
}

// ---- birds ----------------------------------------------------------------------------------
/** Rock dove "oo-roo-coo": near-sinusoidal hoots from the inflated crop, with a rolling middle note. */
export function dovesCoo(out, sr, rng, at, o = {}) {
  const f0 = o.f0 || rng.uni(430, 560), a = o.amp ?? 0.4;
  const parts = [[0, 0.13, 1, 1.02, 0], [0.17, 0.5, 1.02, 0.94, 1], [0.72, 0.26, 0.95, 0.88, 0]];
  const lp = new OnePole(1400, sr);
  for (const [t0, len, fa, fb, roll] of parts) {
    const i0 = Math.round((at + t0) * sr), m = Math.min(out.length - i0, secs(len, sr));
    let ph = 0;
    for (let i = 0; i < m; i++) {
      const x = i / m, f = f0 * (fa + (fb - fa) * x + (roll ? 0.08 * Math.sin(Math.PI * x) : 0));
      ph += f / sr;
      const env = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 1.5 * (roll ? 0.75 + 0.25 * Math.sin(TAU * 26 * i / sr) : 1);
      out[i0 + i] += lp.process(Math.sin(TAU * ph) + 0.12 * Math.sin(2 * TAU * ph)) * env * a;
    }
  }
}

/** Turtledove purr "turr-turr-turr" (the tor of the kinim). */
export function turtledove(out, sr, rng, at, o = {}) {
  const f0 = rng.uni(520, 600), a = o.amp ?? 0.3;
  for (let k = 0; k < 3; k++) {
    const i0 = Math.round((at + k * 0.62) * sr), m = Math.min(out.length - i0, secs(0.42, sr));
    let ph = 0;
    for (let i = 0; i < m; i++) {
      const x = i / m;
      ph += f0 * (1.03 - 0.06 * x) / sr;
      const pulse = 0.5 + 0.5 * Math.sin(TAU * 31 * i / sr);
      out[i0 + i] += (Math.sin(TAU * ph) + 0.25 * Math.sin(2 * TAU * ph)) * Math.sin(Math.PI * x) * pulse * pulse * a;
    }
  }
}

/** Wing claps of a pigeon taking off. */
export function wings(out, sr, rng, at, o = {}) {
  const claps = o.claps || rng.int(4, 7);
  for (let k = 0; k < claps; k++) {
    const b = burst(rng, sr, 0.04, 0.009, 2600);
    addInto(out, b, (at + k * rng.uni(0.07, 0.095)) * sr, (o.amp ?? 0.6) * (1 - k / (claps + 2)));
  }
  // flutter tail
  const fl = burst(rng, sr, 0.6, 0.18, 1800);
  for (let i = 0; i < fl.length; i++) fl[i] *= 0.5 + 0.5 * Math.sin(TAU * 13 * i / sr);
  addInto(out, fl, (at + claps * 0.08) * sr, (o.amp ?? 0.6) * 0.25);
}

/** Doves one-shot: a coo or two and sometimes a take-off. */
export function dovesCue(sr, rng) {
  const out = new Float32Array(secs(3.2, sr));
  dovesCoo(out, sr, rng, 0.1);
  if (rng.chance(0.6)) dovesCoo(out, sr, rng, 1.25, { amp: 0.3 });
  if (rng.chance(0.4)) turtledove(out, sr, rng, 0.6, { amp: 0.2 });
  if (rng.chance(0.5)) wings(out, sr, rng, 2.2, { amp: 0.5 });
  return out;
}

/** Doves bed: sparse cooing from several birds, a turtledove now and then, rare wing claps. Stereo. */
export function dovesBed(sr, rng, dur) {
  const n = secs(dur, sr), L = new Float32Array(n), R = new Float32Array(n);
  const birds = Array.from({ length: 4 }, (_, k) => ({ f0: rng.uni(430, 560), pan: rng.uni(-0.8, 0.8), a: rng.uni(0.15, 0.4) }));
  const tmp = new Float32Array(n);
  for (const b of birds) {
    tmp.fill(0);
    for (let t = rng.uni(0, 3); t < dur - 1.2; t += rng.exp(0.13) + 1.1) {
      // a bout of 2-4 coos
      const bout = rng.int(2, 4);
      for (let k = 0; k < bout && t < dur - 1.2; k++, t += rng.uni(1.05, 1.3)) dovesCoo(tmp, sr, rng, t, { f0: b.f0, amp: b.a });
    }
    const gl = Math.sqrt((1 - b.pan) / 2), gr = Math.sqrt((1 + b.pan) / 2);
    for (let i = 0; i < n; i++) { L[i] += tmp[i] * gl; R[i] += tmp[i] * gr; }
  }
  tmp.fill(0);
  for (let t = rng.uni(2, 8); t < dur - 2; t += rng.exp(0.06) + 3) turtledove(tmp, sr, rng, t, { amp: 0.12 });
  for (let t = rng.uni(4, 12); t < dur - 1; t += rng.exp(0.04) + 4) wings(tmp, sr, rng, t, { amp: 0.25 });
  for (let i = 0; i < n; i++) { L[i] += tmp[i] * 0.7; R[i] += tmp[i] * 0.7; }
  return [L, R];
}

/** Sheep bed: occasional bleats from a small flock, hoof shuffles on stone. Mono (spatial). */
export function sheepBed(sr, rng, dur) {
  const n = secs(dur, sr), out = new Float32Array(n);
  for (let t = rng.uni(0.5, 2.5); t < dur - 1.3; t += rng.exp(0.16) + 1.2) {
    const b = bleat(sr, rng, { kind: rng.pick(['lamb', 'lamb', 'ewe', 'ewe', 'ram']) });
    addInto(out, b, t * sr, rng.uni(0.25, 0.8));
  }
  for (let t = rng.uni(0, 1); t < dur; t += rng.exp(1.5)) {
    for (let k = 0; k < rng.int(1, 4); k++) {
      const c = burst(rng, sr, 0.012, 0.002, 4500);
      addInto(out, c, (t + k * rng.uni(0.08, 0.2)) * sr, rng.uni(0.05, 0.15));
    }
  }
  return [out];
}

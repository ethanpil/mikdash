// Pure helpers for choreographies: seeded randomness, easing and time windows on the cyclic sim clock.
// Everything here is a pure function of its arguments (no hidden state) — the sim's determinism rests on it.

export const DAY = 1440;
/** minutes → [0, 1440) */
export const wrap = (t) => ((t % DAY) + DAY) % DAY;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, k) => a + (b - a) * k;
export function smooth(e0, e1, x) {
  const k = clamp((x - e0) / (e1 - e0));
  return k * k * (3 - 2 * k);
}
export const easeInOut = (k) => { k = clamp(k); return k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k); };
export const easeOut = (k) => 1 - (1 - clamp(k)) ** 2;
/** 0 → 1 → 0: rises over [a,b], holds, falls over [c,d] */
export const window4 = (x, a, b, c, d) => smooth(a, b, x) * (1 - smooth(c, d, x));

// ------------------------------------------------------------------------------------------- randomness
export function hashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** mulberry32 stream: () => [0,1) */
export function rng(seed = 1) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mixKey = (h, k) => Math.imul(h ^ (typeof k === 'number' ? (k * 2654435761) >>> 0 : hashStr(k)), 0x85ebca6b) >>> 0;
/**
 * One stateless random number in [0,1) for (seed, k0..k3) — order-independent of any other draw. Up to four keys
 * (numbers or strings); fixed arity, so a call allocates nothing.
 */
export function rand(seed, k0, k1, k2, k3) {
  let h = (seed >>> 0) ^ 0x9e3779b9;
  if (k0 !== undefined) h = mixKey(h, k0);
  if (k1 !== undefined) h = mixKey(h, k1);
  if (k2 !== undefined) h = mixKey(h, k2);
  if (k3 !== undefined) h = mixKey(h, k3);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0; h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export const randRange = (seed, a, b, k0, k1, k2, k3) => a + (b - a) * rand(seed, k0, k1, k2, k3);
/**
 * Smooth deterministic wander in [-1,1] over time t (minutes), period ≈ p: sum of two seeded sines.
 * wanderer(seed, p) returns the same function of t with its constants drawn once (for per-frame use).
 */
export function wanderer(seed, p = 6) {
  const a = rand(seed, 'wa') * 6.283, b = rand(seed, 'wb') * 6.283, q = p * (1.3 + 0.4 * rand(seed, 'wp'));
  return (t) => 0.62 * Math.sin((t / p) * 6.283 + a) + 0.38 * Math.sin((t / q) * 6.283 + b);
}
export const wander = (seed, t, p = 6) => wanderer(seed, p)(t);

// ------------------------------------------------------------------------------------------- time windows
/** minutes from t0 forward to t on the cycle */
export const since = (t, t0) => wrap(t - t0);
/** length of the cyclic window [t0, t1) (0 → 0) */
export const span = (t0, t1) => wrap(t1 - t0);
/** t inside the cyclic window [t0, t1) — handles windows that wrap past midnight */
export const within = (t, t0, t1) => since(t, t0) < span(t0, t1);
/** t inside [t0 - lead, t1 + lag) */
export const near = (t, t0, t1, lead = 0, lag = 0) => within(t, wrap(t0 - lead), wrap(t1 + lag));
/** first index i of an ascending array with arr[i] > x (arr.length when none) */
export function upperBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] <= x) lo = m + 1; else hi = m; }
  return lo;
}
/**
 * Phase of t in [t0, t1]: 0 before (within `pre` minutes), 1 after (within `post` minutes), the fraction inside.
 * Outside both margins → NaN (the window is not near).
 */
export function phase(t, t0, t1, pre = 720, post = 720) {
  const len = span(t0, t1) || 1e-6;
  const d = since(t, t0);
  if (d <= len) return d / len;
  if (d >= DAY - pre) return 0;
  if (d - len <= post) return 1;
  return NaN;
}
/**
 * Timeline segments: list = [{ id, d (minutes), ...data }] laid end to end from `start`; returns
 * { seg, index, k (0..1 inside), local (minutes inside), total } for t, or null when t is outside the run.
 */
export function segmentAt(list, start, t, loop = false) {
  const total = list.reduce((s, x) => s + x.d, 0);
  if (!total) return null;
  let d = since(t, start);
  if (loop) d %= total;
  else if (d >= total) return null;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (d < s.d || i === list.length - 1) return { seg: s, index: i, k: clamp(d / (s.d || 1)), local: d, total };
    d -= s.d;
  }
  return null;
}

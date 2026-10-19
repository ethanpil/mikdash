// Small shared helpers for the people module (deterministic RNG, easing, path sampling).
import { Vector3 } from 'three';
import { m2w, AMAH } from '../core/units.js';

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

/** Deterministic PRNG (mulberry32). Returns () => [0,1). */
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

export function hashStr(s) {
  let h = 2166136261;
  const str = String(s);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smooth(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
/** 0 → 1 → 0 window: rises over [a,b], holds, falls over [c,d]. */
export function window4(x, a, b, c, d) {
  return smooth(a, b, x) * (1 - smooth(c, d, x));
}

/**
 * Sample a polyline at a distance (meters) along it.
 * points: site-frame arrays [X,Y] / [X,Y,Z] (amot) — result pos is [X,Y,Z?] amot —
 *         or world Vector3s (meters) — result pos is a Vector3.
 * Returns { pos, heading (compass deg), length (m), done (bool), t (0..1) }.
 */
export function poseAlongPath(points, distanceMeters) {
  if (!points?.length) return null;
  const isVec = points[0] instanceof Vector3;
  const P = points.map((p) => (isVec ? p : m2w(p[0], p[1], p[2] ?? 0)));
  let total = 0;
  const seg = [];
  for (let i = 1; i < P.length; i++) {
    const dx = P[i].x - P[i - 1].x, dz = P[i].z - P[i - 1].z;
    const L = Math.hypot(dx, dz);
    seg.push(L);
    total += L;
  }
  let d = Math.max(0, Math.min(distanceMeters, total));
  let i = 0;
  while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
  const a = P[Math.min(i, P.length - 1)], b = P[Math.min(i + 1, P.length - 1)];
  const k = seg[i] > 1e-9 ? d / seg[i] : 0;
  const w = new Vector3().lerpVectors(a, b, k);
  const dx = b.x - a.x, dz = b.z - a.z;
  let heading = Math.atan2(dx, -dz) / DEG;
  if (heading < 0) heading += 360;
  let pos;
  if (isVec) pos = w;
  else {
    const p0 = points[Math.min(i, points.length - 1)], p1 = points[Math.min(i + 1, points.length - 1)];
    pos = [w.x / AMAH, -w.z / AMAH];
    if (p0.length > 2 || p1.length > 2) pos.push(lerp(p0[2] ?? 0, p1[2] ?? 0, k));
  }
  return { pos, heading, length: total, done: distanceMeters >= total, t: total > 0 ? Math.min(1, distanceMeters / total) : 1 };
}

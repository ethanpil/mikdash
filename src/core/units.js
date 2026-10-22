// Units and coordinate frames.
//
// SITE frame (src/data/site.js — the research-derived site model; amah-native):
//   X = east, Y = north, Z = up, all in amot.
//   Origin: SW corner of the 500x500 clear interior of Har HaBayit.
//   Z = 0 is the threshold of the eastern gate of Har HaBayit (Shushan).
//
// WORLD frame (three.js scene): meters, +x = east, +y = up, -z = north (so +z = south).
//
// The amah->meter standard is chosen once per page load (URL ?amah=naeh|feinstein|chazonish).
// Default: R' Avraham Chaim Naeh, 48 cm (report §0.2).
import { Vector3 } from 'three';

export const AMAH_STANDARDS = {
  naeh: { meters: 0.48, label: "R' Avraham Chaim Naeh — 48 cm" },
  feinstein: { meters: 0.5398, label: "R' Moshe Feinstein — ≈54 cm" },
  chazonish: { meters: 0.576, label: 'Chazon Ish — ≈57.6 cm' },
};

function readAmahKey() {
  try {
    // a Worker of this page (perf-1: people/bake.worker.js) has no page URL or storage: it is told by its name
    if (typeof WorkerGlobalScope !== 'undefined') {
      const w = /\bamah=(\w+)/.exec(String(globalThis.name || ''));
      if (w && AMAH_STANDARDS[w[1]]) return w[1];
    }
    const q = new URLSearchParams(globalThis.location?.search || '').get('amah');
    if (q && AMAH_STANDARDS[q]) return q;
    const s = globalThis.localStorage?.getItem('mikdash.amah');
    if (s && AMAH_STANDARDS[s]) return s;
  } catch { /* storage may be unavailable */ }
  return 'naeh';
}

export const AMAH_KEY = readAmahKey();
/** meters per amah (building amah = 6 tefachim) */
export const AMAH = AMAH_STANDARDS[AMAH_KEY].meters;
/** meters per tefach */
export const TEFACH = AMAH / 6;
/** meters per etzba (finger; 4 per tefach) */
export const ETZBA = TEFACH / 4;

/** amot -> meters */
export const a = (amot) => amot * AMAH;
/** tefachim -> meters */
export const tf = (tefachim) => tefachim * TEFACH;

/** Site (X east, Y north, Z up; amot) -> world Vector3 (meters). */
export function m2w(X, Y, Z = 0, target = new Vector3()) {
  return target.set(X * AMAH, Z * AMAH, -Y * AMAH);
}

/** World Vector3 (meters) -> site {X, Y, Z} in amot. */
export function w2m(v) {
  return { X: v.x / AMAH, Y: -v.z / AMAH, Z: v.y / AMAH };
}

/**
 * Site box (min/max arrays in amot) -> world center & size (meters).
 * size.x = east-west extent, size.y = height, size.z = north-south extent.
 */
export function boxToWorld(min, max) {
  const center = m2w((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2);
  const size = new Vector3(
    Math.abs(max[0] - min[0]) * AMAH,
    Math.abs(max[2] - min[2]) * AMAH,
    Math.abs(max[1] - min[1]) * AMAH,
  );
  return { center, size };
}

/**
 * Compass heading (degrees; 0 = north, 90 = east, 180 = south, 270 = west)
 * -> three.js yaw (rotation.y) for an object/camera whose forward is -z.
 */
export function headingToYaw(headingDeg) {
  return -headingDeg * Math.PI / 180;
}

/** three.js yaw (rotation.y, forward -z) -> compass heading in degrees [0, 360). */
export function yawToHeading(yaw) {
  const h = (-yaw * 180 / Math.PI) % 360;
  return h < 0 ? h + 360 : h;
}

/** Unit vector (world) for a compass heading, horizontal. */
export function headingDir(headingDeg, target = new Vector3()) {
  const r = headingDeg * Math.PI / 180;
  return target.set(Math.sin(r), 0, -Math.cos(r));
}

/** Standard eye height of the observer above the floor (meters). */
export const EYE_HEIGHT = 1.62;

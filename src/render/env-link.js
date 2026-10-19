// Read-only adapter over ctx.env / ctx.time, so render + FX work with the stub env and the real one.
// Everything here tolerates missing fields; nothing here writes to env.
import { Vector3, Color } from 'three';

const _a = new Vector3();
const _b = new Vector3();
const UP = new Vector3(0, 1, 0);
const DEG = 180 / Math.PI;

/** The directional lights env drives (sun first). Stub env exposes `sun`. */
export function envDirLights(ctx) {
  const env = ctx.env || {};
  const out = [];
  const sun = env.sunLight || env.sun;
  if (sun?.isLight) out.push(sun);
  if (env.moonLight?.isLight && env.moonLight !== sun) out.push(env.moonLight);
  return out;
}

/** World unit vector pointing TOWARD a directional light (DirectionalLight: position - target). */
export function lightDir(light, target = new Vector3()) {
  if (!light) return target.set(0, 1, 0);
  light.updateWorldMatrix(true, false);
  light.getWorldPosition(_a);
  if (light.isDirectionalLight && light.target) {
    light.target.updateWorldMatrix(true, false);
    light.target.getWorldPosition(_b);
    target.subVectors(_a, _b);
  } else {
    target.copy(_a); // SunLight / Hemisphere-style: direction = position
  }
  if (target.lengthSq() < 1e-12) target.set(0, 1, 0);
  return target.normalize();
}

/** World unit vector toward the sun: env.sunDir > time.sun.dir > sun light geometry. */
export function sunDir(ctx, target = new Vector3()) {
  const env = ctx.env || {};
  if (env.sunDir?.isVector3) return target.copy(env.sunDir).normalize();
  const t = ctx.time?.sun?.dir;
  if (t?.isVector3) return target.copy(t).normalize();
  return lightDir(env.sunLight || env.sun, target);
}

/** Sun altitude in degrees (+ above horizon). */
export function sunAltitude(ctx) {
  const alt = ctx.time?.sun?.altitude;
  if (Number.isFinite(alt)) return alt;
  return Math.asin(Math.max(-1, Math.min(1, sunDir(ctx, _a).y))) * DEG;
}

/** Linear exposure multiplier env wants applied at tone mapping (default 1). */
export function exposure(ctx) {
  const e = ctx.env?.exposure;
  return Number.isFinite(e) && e > 0 ? e : 1;
}

/** Irradiance-style colour of a light (color * intensity), 0 when hidden. */
export function lightIrradiance(light, target = new Color()) {
  if (!light || !light.visible) return target.setRGB(0, 0, 0);
  return target.copy(light.color).multiplyScalar(light.intensity);
}

/**
 * Ambient sky / ground RADIANCE used to light smoke (linear).
 * Prefers env.ambient (irradiance, scene units), then env.skyColorAt(dir) (radiance), else hemisphere / PI.
 */
export function ambientRadiance(ctx, sky = new Color(), ground = new Color()) {
  const env = ctx.env || {};
  // env.ambient: irradiance in scene units (sky from above, ground bounce) -> Lambertian radiance
  if (env.ambient?.sky?.isColor && env.ambient?.ground?.isColor) {
    sky.copy(env.ambient.sky).multiplyScalar(1 / Math.PI);
    ground.copy(env.ambient.ground).multiplyScalar(1 / Math.PI);
    return { sky, ground };
  }
  if (typeof env.skyColorAt === 'function') {
    try {
      const s = env.skyColorAt(UP);
      const h = env.skyColorAt(_b.set(0.8, 0.2, 0).normalize());
      if (s?.isColor && h?.isColor) {
        sky.copy(s).lerp(h, 0.35);
        ground.copy(h).multiplyScalar(0.35);
        return { sky, ground };
      }
    } catch { /* fall through */ }
  }
  const hemi = env.hemi || env.hemiLight || env.skyLight;
  if (hemi?.isHemisphereLight && hemi.visible) {
    sky.copy(hemi.color).multiplyScalar(hemi.intensity / Math.PI);
    ground.copy(hemi.groundColor).multiplyScalar(hemi.intensity / Math.PI);
  } else if (ctx.scene.background?.isColor) {
    sky.copy(ctx.scene.background).multiplyScalar(0.25);
    ground.copy(sky).multiplyScalar(0.4);
  } else {
    sky.setRGB(0.05, 0.06, 0.08);
    ground.setRGB(0.02, 0.02, 0.02);
  }
  return { sky, ground };
}

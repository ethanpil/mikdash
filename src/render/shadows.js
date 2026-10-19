// Cascaded sun shadows for high/ultra, built on three r186's native SunLight (2-cascade atlas, handled inside
// WebGLRenderer — no material patching). env keeps owning the sun's colour/intensity/direction: each frame we
// mirror env's brightest directional light (sun by day, moon by night) into our SunLight and hide env's light
// for the duration of the draw ("borrow"), then restore its visibility. env's own shadow (castShadow) is switched
// off while we own the shadows and restored on dispose (tier change).
// See docs/decisions/render.md for why this replaces examples/jsm/csm/CSM.js.
import { Matrix4, Vector3, WebGPUCoordinateSystem } from 'three';
import { SunLight } from 'three/addons/lights/SunLight.js';
import { SunLightShadow } from 'three/addons/lights/SunLightShadow.js';
import { envDirLights, lightDir } from './env-link.js';

const _lightOrientation = new Matrix4();
const _viewToLight = new Matrix4();
const _lightDirection = new Vector3();
const _up = new Vector3();
const _center = new Vector3();
const _near = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
const _far = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
const _corners = Array.from({ length: 8 }, () => new Vector3());
const _dir = new Vector3();

/**
 * SunLightShadow with an explicit split distance. three's stock "practical" split puts the cascade-0/1
 * boundary at ~F/4 (≈100 m for a 400 m range), wasting cascade 0's texels; architecture needs the near
 * cascade tight (people, steps, columns) and the far one long (56 m walls, the Heichal).
 * Logic otherwise mirrors three r186 SunLightShadow.updateMatrices (texel snapping, caster ceiling).
 */
export class CascadedSunShadow extends SunLightShadow {
  constructor({ split = 36, far = 400, fade = 0.15 } = {}) {
    super();
    this.split = split;
    this.far = far;
    this.fade = fade;
  }

  updateMatrices(light, viewCamera) {
    if (viewCamera === undefined) return;
    const count = this._cameras.length;
    const insetX = Math.min(0.25, (Math.ceil(this.radius) + 1) / this.mapSize.x);
    const insetY = Math.min(0.25, (Math.ceil(this.radius) + 1) / this.mapSize.y);
    for (let i = 0; i < count; i++) this._viewports[i].set(i + insetX, insetY, 1 - 2 * insetX, 1 - 2 * insetY);
    const resolutionX = this.mapSize.x * (1 - 2 * insetX);
    const resolutionY = this.mapSize.y * (1 - 2 * insetY);
    const resolution = Math.min(resolutionX, resolutionY);

    const cameraNear = viewCamera.near;
    const cameraFar = Math.max(cameraNear + 1e-6, Math.min(this.far, viewCamera.far));
    const splits = this._cascadeSplits;
    splits[0] = cameraNear;
    // explicit near split (clamped inside the range); any further cascades split geometrically
    for (let i = 1; i < count; i++) {
      const s = this.split * Math.pow(cameraFar / this.split, (i - 1) / Math.max(1, count - 1));
      splits[i] = Math.min(cameraFar * 0.9, Math.max(cameraNear + 1, s));
    }
    splits[count] = cameraFar;

    _lightDirection.setFromMatrixPosition(light.matrixWorld).negate().normalize();
    _up.set(0, 1, 0);
    if (Math.abs(_up.dot(_lightDirection)) > 0.99) _up.set(0, 0, 1);
    _lightOrientation.lookAt(_center.set(0, 0, 0), _lightDirection, _up);
    _viewToLight.copy(_lightOrientation).transpose().multiply(viewCamera.matrixWorld);

    const zNear = viewCamera.reversedDepth ? 1 : (viewCamera.coordinateSystem === WebGPUCoordinateSystem ? 0 : -1);
    const invProj = viewCamera.projectionMatrixInverse;
    let globalMaxZ = -Infinity;
    for (let i = 0; i < 4; i++) {
      const x = i === 0 || i === 1 ? 1 : -1;
      const y = i === 0 || i === 3 ? 1 : -1;
      const n = _near[i].set(x, y, zNear).applyMatrix4(invProj);
      const f = _far[i];
      if (viewCamera.isPerspectiveCamera === true) f.copy(n).multiplyScalar(cameraFar / cameraNear);
      else f.set(n.x, n.y, -cameraFar);
      n.applyMatrix4(_viewToLight);
      f.applyMatrix4(_viewToLight);
      globalMaxZ = Math.max(globalMaxZ, n.z, f.z);
    }
    // caster ceiling: tall buildings outside the view frustum (behind / above) still cast into it
    globalMaxZ += Math.min(cameraFar, 300);
    const shadowNear = this.camera.near;

    for (let i = 0; i < count; i++) {
      const cascadeNear = i === 0 ? splits[0] : this._cascadeData[i - 1].z;
      const cascadeFar = splits[i + 1];
      const fadeStart = cascadeFar - this.fade * (cascadeFar - splits[i]);
      this._cascadeData[i].set(i === 0 ? -1e10 : cascadeNear, cascadeFar, fadeStart, 0);
      const nearAlpha = (cascadeNear - cameraNear) / (cameraFar - cameraNear);
      const farAlpha = (cascadeFar - cameraNear) / (cameraFar - cameraNear);
      _center.set(0, 0, 0);
      for (let j = 0; j < 4; j++) {
        _corners[j * 2].lerpVectors(_near[j], _far[j], nearAlpha);
        _corners[j * 2 + 1].lerpVectors(_near[j], _far[j], farAlpha);
        _center.add(_corners[j * 2]).add(_corners[j * 2 + 1]);
      }
      _center.multiplyScalar(1 / 8);
      let radiusSq = 0;
      let minZ = Infinity;
      for (let j = 0; j < 8; j++) {
        radiusSq = Math.max(radiusSq, _corners[j].distanceToSquared(_center));
        minZ = Math.min(minZ, _corners[j].z);
      }
      let radius = Math.sqrt(radiusSq);
      if (resolution > 1) {
        radius /= 1 - 1 / resolution;
        const tx = 2 * radius / resolutionX;
        const ty = 2 * radius / resolutionY;
        _center.x = Math.round(_center.x / tx) * tx;
        _center.y = Math.round(_center.y / ty) * ty;
      }
      _center.z = globalMaxZ + shadowNear;
      _center.applyMatrix4(_lightOrientation);
      const cam = this._cameras[i];
      cam.position.copy(_center);
      cam.quaternion.setFromRotationMatrix(_lightOrientation);
      cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
      cam.near = shadowNear;
      cam.far = globalMaxZ - minZ + 2 * shadowNear;
      cam.coordinateSystem = this.camera.coordinateSystem;
      cam._reversedDepth = this.camera.reversedDepth;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld();
      this._updateMatrix(cam, this._matrices[i], this._frustums[i], this._viewports[i]);
    }
  }
}

/**
 * Per-tier cascade settings (r186 SunLight = exactly 2 cascades; quality.cascades is not used).
 * Texel sizes (bounding-sphere fit, 16:9, 62° vertical fov) — see docs/decisions/render.md:
 *   high : cascade 0 ≈ 3.1 cm to 24 m, cascade 1 ≈ 27 cm to 210 m (2048² per cascade)
 *   ultra: cascade 0 ≈ 1.9 cm to 30 m, cascade 1 ≈ 19 cm to 300 m (4096² per cascade)
 * The Azarah (≈ 65 × 90 m) and everything seen across it sits in cascade 1; beyond `far` env's terrain
 * visibility dims the sun. In fly mode the range grows with height (`farPerMetre` above `flyFrom`).
 */
export const SHADOW_PRESETS = {
  high: { mapSize: 2048, split: 24, far: 210, radius: 2.2, bias: -0.00025, normalBias: 0.035, flyFrom: 12, farPerMetre: 3, farMax: 700 },
  ultra: { mapSize: 4096, split: 30, far: 300, radius: 2.6, bias: -0.0002, normalBias: 0.03, flyFrom: 12, farPerMetre: 3, farMax: 900 },
};

export class SunShadows {
  constructor(ctx, tierKey) {
    this.ctx = ctx;
    const p = SHADOW_PRESETS[tierKey] || SHADOW_PRESETS.high;
    this.preset = p;
    this.light = new SunLight(0xffffff, 0);
    this.light.name = 'render:sun-csm';
    this.light.castShadow = true;
    const sh = new CascadedSunShadow({ split: p.split, far: p.far });
    sh.mapSize.set(p.mapSize, p.mapSize);
    sh.radius = p.radius;
    sh.bias = p.bias;
    sh.normalBias = p.normalBias;
    sh.camera.near = 0.5;
    this.light.shadow = sh;
    ctx.scene.add(this.light);
    this.borrowed = null;
    this.key = null;
    this.restore = new Map(); // env light -> its castShadow before we took the shadows over
    try { ctx.env?.setShadowsManaged?.(false); } catch (e) { console.warn('[render] env.setShadowsManaged failed', e); }
  }

  /** Mirror env's key light into the SunLight and hide env's copy for this draw. */
  beforeRender() {
    const lights = envDirLights(this.ctx);
    let key = this.key;
    let best = -1;
    for (const l of lights) {
      const v = l.visible ? l.intensity * (l.color.r * 0.2126 + l.color.g * 0.7152 + l.color.b * 0.0722) : 0;
      if (v > best) { best = v; key = l; }
    }
    if (best <= 0 && this.key) key = this.key; // keep the same light hidden so light counts stay stable
    this.key = key;
    const sun = this.light;
    // fly mode: the higher the viewer, the further the shadowed range (texels grow, but so does distance)
    const p = this.preset;
    const h = Math.max(0, this.ctx.camera.position.y - p.flyFrom);
    sun.shadow.far = Math.min(p.far + p.farPerMetre * h, p.farMax);
    if (!key) { sun.intensity = 0; sun.shadow.autoUpdate = false; return; }
    lightDir(key, _dir);
    sun.position.copy(_dir);
    sun.color.copy(key.color);
    sun.intensity = key.visible ? key.intensity : 0;
    // below the horizon or dark: skip the shadow passes (castShadow stays on: no shader recompiles)
    const lit = sun.intensity > 1e-4 && _dir.y > -0.01;
    sun.shadow.autoUpdate = lit;
    if (!this.restore.has(key)) this.restore.set(key, key.castShadow);
    if (key.castShadow) key.castShadow = false;
    this.borrowed = key;
    this.borrowedVisible = key.visible;
    key.visible = false;
  }

  afterRender() {
    if (this.borrowed) this.borrowed.visible = this.borrowedVisible;
    this.borrowed = null;
  }

  dispose() {
    this.afterRender();
    for (const [l, cast] of this.restore) l.castShadow = cast;
    this.restore.clear();
    this.ctx.scene.remove(this.light);
    this.light.dispose();
    try { this.ctx.env?.setShadowsManaged?.(true); } catch { /* ignore */ }
  }
}

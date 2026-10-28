// Cascaded sun shadows for high/ultra, built on three r186's native SunLight (2-cascade atlas, handled inside
// WebGLRenderer — no material patching). env keeps owning the sun's colour/intensity/direction: each frame we
// mirror env's brightest directional light (sun by day, moon by night) into our SunLight and hide env's light
// for the duration of the draw ("borrow"), then restore its visibility. env's own shadow (castShadow) is switched
// off while we own the shadows and restored on dispose (tier change).
// See docs/decisions/render.md for why this replaces examples/jsm/csm/CSM.js.
import { Matrix4, Vector3, WebGPUCoordinateSystem, ShaderChunk, Object3D, BackSide, DoubleSide } from 'three';
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
 * render-env-2: sun / moon shadows with the casters' FRONT faces as well (double-sided depth), a slope-scaled normal
 * offset, and a normal bias per cascade.
 *
 * three draws a FrontSide material into the shadow map by its back faces. That avoids self-shadowing acne, but where a
 * caster meets a receiver (the sovev slab's underside on the kevesh's face, the ⅙-amah proud milah lintels, a curtain
 * against its jamb, two walls in a corner) the caster's back face lies ON the receiver, and the PCF taps that fall just
 * beyond the contact read the receiver's own far side as "lit": a saw-toothed lit band under every contact edge (it
 * did not change with the depth or normal bias). With front faces drawn too, the contact compares against the
 * caster's far side and the band is gone; the lit surfaces now compare against their own depth, so the receiver is
 * offset along its normal by the bias × (1 + tan θ, ≤ 4) (θ = the light's angle of incidence; the depth error across a
 * texel grows with tan θ) — no acne at grazing sun. Only orthographic shadow cameras (env's key light on medium,
 * render's cascades on high / ultra) — the fires' cube maps keep three's back faces (their large, near texels would
 * need metres of offset) — and not the people (their own depth material).
 *
 * The per-cascade normal bias: three applies one world-space offset to both cascades, too small for the far
 * cascade's texels or too large for the near one; the cascade's spare w (sunShadowCascade[i].w, set by
 * CascadedSunShadow) adds a share of that cascade's texel size. Installed once, before programs compile.
 */
let chunkPatched = false;
/**
 * qa-r2-fix-env-render (ENV-R2-7): the casters' faces drawn with a slope-scaled depth offset (glPolygonOffset factor, in
 * units of each face's own depth slope across a shadow texel). With front faces in the map, a PCF tap a texel or two
 * below a lit receiver in light space lands on the adjacent surface in front of it — the tread at a riser's foot, seen
 * from a low sun — and that surface is nearer the light by up to tap reach × cot(sun altitude) (≈ 20 cm at 20°): a false
 * shadow band along every concave edge, stepped by the texel grid (the sawtooth on the 15 steps' risers at d2). The
 * offset pushes a face back by about one texel's depth change across it, so only faces grazing the light move: the
 * treads by ≈ 9 cm at a 20° sun, a riser facing it by ≈ 1.5 cm. Factor 1 removes the sawtooth; the 8 cm proud lintels'
 * shadows and the sovev slab's contact edge are unchanged (2.5 began to thin the lintel shadows). Casters only: the
 * receivers' slope term is below.
 */
const CASTER_SLOPE_OFFSET = 1;
const SLOPE = '( 1.0 + min( sqrt( max( 1.0 - mkSc * mkSc, 0.0 ) ) / mkSc, 3.0 ) )'; // 1 + tan θ, ≤ 4 (mkSc = cos θ)
/**
 * lowend-visuals (quality.shadowFilter): the taps of the sun / moon / spot maps' PCF lookup — 5 (three's Vogel disk, each
 * a hardware 2 × 2 compare) or 1 (one hardware compare: a one-texel penumbra). The 5-tap lookup was 4.3 ms of low's 22.5 ms
 * Azarah frame on the HD 4600; the fires' cube maps (getPointShadow) are not touched. Returns true when the chunk changed:
 * lit programs must then recompile (render/index.js).
 */
let tapsNow = 5, tapsStock = null;
export function setShadowTaps(n) {
  const taps = n === 1 ? 1 : 5;
  if (taps === tapsNow) return false;
  const c = ShaderChunk.shadowmap_pars_fragment;
  const f = c.indexOf('float getShadow( sampler2DShadow');
  const a = f < 0 ? -1 : c.indexOf('vec2 texelSize', f), b = a < 0 ? -1 : c.indexOf(') * 0.2;', a);
  if (taps === 1) {
    if (b < 0) { console.warn('[render] shadow chunk changed; one-tap PCF unavailable'); return false; }
    tapsStock = c.slice(a, b + ') * 0.2;'.length);
    ShaderChunk.shadowmap_pars_fragment = `${c.slice(0, a)}shadow = texture( shadowMap, shadowCoord.xyz ); // one hardware compare (render/shadows.js setShadowTaps)${c.slice(b + ') * 0.2;'.length)}`;
  } else {
    const k = c.indexOf('shadow = texture( shadowMap, shadowCoord.xyz ); // one hardware compare');
    if (k < 0 || !tapsStock) return false;
    const e = c.indexOf('\n', k);
    ShaderChunk.shadowmap_pars_fragment = c.slice(0, k) + tapsStock + c.slice(e);
  }
  tapsNow = taps;
  return true;
}

export function installCascadeBiasChunk() {
  if (chunkPatched) return true;
  const c = ShaderChunk.shadowmap_pars_fragment;
  const A = 'vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );';
  const B = 'sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition';
  const v = ShaderChunk.shadowmap_vertex;
  const D = 'shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );';
  if (!c.includes(A) || !c.includes(B) || !v.includes(D)) { console.warn('[render] shadow chunks changed; slope-scaled / per-cascade normal bias unavailable'); return false; }
  // the light's direction from the shadow matrix: its depth row grows away from the light
  ShaderChunk.shadowmap_pars_fragment = c.replace(A, `// per-cascade, slope-scaled normal bias: render/shadows.js (render-env-2)
			vec3 mkSn = normalize( vSunShadowWorldNormal );`)
    .replace(B, `sunShadowMatrix[ cascadeOffset + i ] * vec4( vSunShadowWorldPosition.xyz + mkSn * ( ( sunLightShadow.shadowNormalBias + cascade.w ) * mkSlopeK( mkSn, sunShadowMatrix[ cascadeOffset + i ] ) ), 1.0 )`)
    .replace('#if NUM_SUN_LIGHT_SHADOWS > 0', `#if NUM_SUN_LIGHT_SHADOWS > 0
		// 1 + tan θ (≤ 4): θ the light's angle of incidence, from the shadow matrix's depth row (render-env-2)
		float mkSlopeK( vec3 n, mat4 M ) {
			float mkSc = clamp( - dot( n, normalize( vec3( M[ 0 ][ 2 ], M[ 1 ][ 2 ], M[ 2 ][ 2 ] ) ) ), 0.2, 1.0 );
			return ${SLOPE};
		}
	#endif
	#if NUM_SUN_LIGHT_SHADOWS > 0`);
  ShaderChunk.shadowmap_vertex = v.replace(D, `{
				// slope-scaled normal offset (render-env-2): sun / moon casters draw their front faces too
				vec3 mkLd = normalize( vec3( directionalShadowMatrix[ i ][ 0 ][ 2 ], directionalShadowMatrix[ i ][ 1 ][ 2 ], directionalShadowMatrix[ i ][ 2 ][ 2 ] ) );
				float mkSc = clamp( - dot( shadowWorldNormal, mkLd ), 0.2, 1.0 );
				shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * ( directionalLightShadows[ i ].shadowNormalBias * ${SLOPE} ), 0 );
			}`);
  chunkPatched = true;
  // front faces into the sun / moon shadow maps (orthographic shadow cameras only; not the people's own depth material,
  // nor a depth-only shadow proxy — frontFaces below), drawn with a slope-scaled depth offset (qa-r2-fix-env-render)
  const proto = Object3D.prototype, prev = proto.onBeforeShadow;
  proto.onBeforeShadow = function (renderer, object, camera, shadowCamera, geometry, depthMaterial, group) {
    if (shadowCamera?.isOrthographicCamera && depthMaterial && !object.customDepthMaterial) {
      const dbl = depthMaterial.side === BackSide && frontFaces(object, group);
      if (dbl) depthMaterial.side = DoubleSide;
      // three never resets a cached depth material's offset: set it on every draw
      depthMaterial.polygonOffset = dbl;
      depthMaterial.polygonOffsetFactor = dbl ? CASTER_SLOPE_OFFSET : 0;
      depthMaterial.polygonOffsetUnits = 0;
    }
    return prev.call(this, renderer, object, camera, shadowCamera, geometry, depthMaterial, group);
  };
  return true;
}

/**
 * render-audio-3: which casters draw their front faces too. Not a depth-only shadow proxy (colorWrite false: the
 * terrain's coarse caster grid, sunk 0.6 m under the ground it stands for — world/terrain), nor a material that chose
 * its own shadowSide. Drawn with its sunlit top, the proxy's coarse chords stood above the finer visible ground across
 * the terraces' concave steps: a false ≈10 m shadow and concentric acne rings round it (`at=924,197&look=90,4&t=d3`,
 * high; materials-2-fix). By its back faces alone (three's default) a heightfield still casts its ridges' shadows (the
 * slopes facing away from the light) and never its own lit side. Its contact edges are nothing the front faces are for.
 */
function frontFaces(object, group) {
  const m = Array.isArray(object.material) ? object.material[group?.materialIndex ?? 0] : object.material;
  return !m || (m.colorWrite !== false && (m.shadowSide === null || m.shadowSide === undefined));
}

/**
 * SunLightShadow with an explicit split distance. three's stock "practical" split puts the cascade-0/1
 * boundary at ~F/4 (≈100 m for a 400 m range), wasting cascade 0's texels; architecture needs the near
 * cascade tight (people, steps, columns) and the far one long (56 m walls, the Heichal).
 * Logic otherwise mirrors three r186 SunLightShadow.updateMatrices (texel snapping, caster ceiling).
 */
export class CascadedSunShadow extends SunLightShadow {
  constructor({ split = 36, far = 400, fade = 0.15, normalTexels = 0.6 } = {}) {
    super();
    this.split = split;
    this.far = far;
    this.fade = fade;
    /** share of each cascade's texel size added to the normal bias (installCascadeBiasChunk) */
    this.normalTexels = normalTexels;
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
      this._cascadeData[i].set(i === 0 ? -1e10 : cascadeNear, cascadeFar, fadeStart, 0); // w: the normal bias below
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
      // this cascade's texel (world m) → its share of the normal bias (sunShadowCascade[i].w)
      this._cascadeData[i].w = chunkPatched ? this.normalTexels * (2 * radius) / Math.max(resolution, 1) : 0;
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
 * Texel sizes (bounding-sphere fit, 16:9, 62° vertical fov) — see docs/decisions/render.md, render-env-2.md:
 *   high : cascade 0 ≈ 3.4 cm to 40 m, cascade 1 ≈ 15 cm to 180 m (3072² per cascade)
 *   ultra: cascade 0 ≈ 2.6 cm to 40 m, cascade 1 ≈ 16 cm to 300 m (4096² per cascade)
 * The Azarah (≈ 65 × 90 m) and everything seen across it sits in cascade 1; beyond `far` env's terrain
 * visibility dims the sun. In fly mode the range grows with height (`farPerMetre` above `flyFrom`).
 */
export const SHADOW_PRESETS = {
  // render-env-2: high 2048 → 3072 per cascade, split 24 → 40 m, far 210 → 180 m: from the court the Heichal's facade
  // (25–60 m) stood in the far cascade's 27 cm texels — the ⅙-amah proud lintels (8 cm) cast saw-tooth shadows; now
  // ≈ 3.4 cm to 40 m, 15 cm beyond. Depth bias −2.5e-4 (≈ 10 cm over the cascade's depth range) → −4e-5 (≈ 1.5 cm):
  // with back faces drawn into the map, contact edges (under the sovev slab) leaked a lit sawtooth band as deep as
  // the bias; the normal bias is now a base plus 0.6 texel per cascade (installCascadeBiasChunk)
  high: { mapSize: 3072, split: 40, far: 180, radius: 2.2, bias: -0.00004, normalBias: 0.012, normalTexels: 0.6, flyFrom: 12, farPerMetre: 3, farMax: 700 },
  ultra: { mapSize: 4096, split: 40, far: 300, radius: 2.6, bias: -0.00004, normalBias: 0.01, normalTexels: 0.6, flyFrom: 12, farPerMetre: 3, farMax: 900 },
};

export class SunShadows {
  constructor(ctx, tierKey) {
    this.ctx = ctx;
    const p = SHADOW_PRESETS[tierKey] || SHADOW_PRESETS.high;
    this.preset = p;
    this.light = new SunLight(0xffffff, 0);
    this.light.name = 'render:sun-csm';
    this.light.castShadow = true;
    installCascadeBiasChunk();
    const sh = new CascadedSunShadow({ split: p.split, far: p.far, normalTexels: p.normalTexels });
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

  /** perf-fix-1: run fn (a warm-up compile) with this frame's light state; inside a frame as it is */
  withFrameLights(fn) {
    if (this.borrowed) return fn();
    this.beforeRender();
    try { return fn(); } finally { this.afterRender(); }
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

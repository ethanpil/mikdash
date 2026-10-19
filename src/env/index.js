// Environment: physically based sky, sun/moon/stars/planets, sun & moon light, sky ambient (PMREM),
// aerial-perspective fog and the exposure curve — all driven by ctx.time every frame. ARCHITECTURE.md §7.
//
// Light units are PHOTOMETRIC (lx for the directional light, cd/m² for sky radiance) multiplied by
// ctx.env.preExposure, a slowly varying scalar that keeps the frame buffer in half-float range from starlight
// to noon. Anything else that emits light (fires, lamps, emissive) must multiply its physical value
// (candela, cd/m²) by ctx.env.preExposure. ctx.env.exposure is what the tone mapper applies on top (≈1).
import {
  DirectionalLight, Mesh, BoxGeometry, Scene, CubeCamera, WebGLCubeRenderTarget, HalfFloatType, LinearFilter,
  PMREMGenerator, FogExp2, Color, Vector2, Vector3, Matrix3, MathUtils,
} from 'three';
import { PRIORITY } from '../core/engine.js';
import { ATMO, mieCoefficients, transmittanceCPU, zenithOpticalDepth, luminance, nightFloorShape } from './atmosphere.js';
import { AtmosphereLUTs, LUT_SCALE } from './luts.js';
import { createSkyUniforms, createSkyMaterial, setSkyFeatures } from './sky.js';
import { createStarfield, EQ_TO_GAL } from './stars.js';
import { installFogChunks, FogUniforms } from './fog.js';

const TIERS = {
  low: { skyW: 128, skyH: 64, steps: 18, envSize: 32, envInterval: 1.0, envAngle: 1.0, stars: 1200, magLimit: 5.6, milkyWay: false, clouds: false, twinkle: false },
  medium: { skyW: 192, skyH: 96, steps: 26, envSize: 64, envInterval: 0.3, envAngle: 0.5, stars: 3000, magLimit: 6.2, milkyWay: false, clouds: false, twinkle: false },
  high: { skyW: 256, skyH: 128, steps: 34, envSize: 128, envInterval: 0.15, envAngle: 0.35, stars: 5500, magLimit: 6.5, milkyWay: true, mwOct: 4, clouds: true, cloudOct: 4, twinkle: true },
  ultra: { skyW: 320, skyH: 160, steps: 44, envSize: 128, envInterval: 0.1, envAngle: 0.25, stars: 8000, magLimit: 6.8, milkyWay: true, mwOct: 5, clouds: true, cloudOct: 5, twinkle: true },
};

// Exposure key: displayed "average" value (pre-tone-map) vs adaptation luminance La (cd/m², log10).
// Day ≈ 0.18 (photographic mid-grey); dimming towards night as the eye goes mesopic/scotopic, so night reads
// as night (half-moon ≈ 0.03, starlight ≈ 0.018) while staying legible.
const KEY = [[-5, 0.013], [-4, 0.019], [-3, 0.026], [-2, 0.042], [-1, 0.065], [0, 0.095], [1, 0.125], [2, 0.15], [3, 0.17], [4, 0.18], [6, 0.18]];
const TONE_EXPOSURE = 1.0; // applied by the tone mapper on top of preExposure (tuned with the render grade)
const SCENE_ALBEDO = 0.3;  // average reflectance assumed by the exposure meter
const NIGHT_SKY_L = 2.0e-4; // cd/m² zenith airglow + integrated starlight (≈21.8 mag/arcsec², dark site)
const MOON_COLOR = [1.06, 0.98, 0.86]; // moonlight is redder than sunlight (lunar regolith reflectance)
const SCOTOPIC_TINT = [0.60, 0.75, 1.18]; // Purkinje shift: rods peak near 507 nm, moonlit scenes read blue-grey
const LOCAL_ALBEDO = [0.50, 0.46, 0.40]; // Jerusalem limestone / marble pavements around the observer
const MOON_FULL_LX = 0.267;
// night floor hue (slightly blue, as the dark-adapted eye reads it), normalised to luminance 1 so the dome's
// zenith is exactly NIGHT_SKY_L — the same value the exposure meter, fog and ambient use
const NIGHT_TINT = (() => { const t = SCOTOPIC_TINT.map((v) => 0.8 + (v - 1) * 0.6); const l = luminance(t); return t.map((v) => v / l); })();
// a low Sun's compressed disc stays at least this much brighter than the sky beside it: 2× while it is coloured
// (≤1°: more turns it cream under AgX), 5× by 4° where the sky beside it is already near white
const DISC_OVER_SKY = [2, 5];
const AUREOLE_TAU_MAX = 0.1; // slant coarse-dust depth cap: aureole(1°)/disc ≈ 1e-3 at the horizon (multiple scattering broadens beyond)
const FOG_MATCH_DIST = 300; // m: stock exp2 fog (FX) equals the physical extinction at this distance

const DEG = Math.PI / 180;
const smooth = (a, b, x) => { const t = MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Bennett (1982) refraction for apparent altitude h (deg), arcmin; its gradient flattens a low Sun's disc
const bennett = (h) => 1 / Math.tan((h + 7.31 / (h + 4.4)) * DEG);
function refractionFlattening(h) {
  if (h > 20) return 1;
  const c = Math.max(h, -1), d = 0.25;
  const dRdh = (bennett(c - d) - bennett(c + d)) / (2 * d * 60);
  return MathUtils.clamp(1 - dRdh, 0.6, 1); // ≈0.78 on the horizon, 0.9 at 2.5°, 0.97 at 10°
}

function keyFor(log10La) {
  for (let i = 1; i < KEY.length; i++) {
    if (log10La <= KEY[i][0]) {
      const [x0, y0] = KEY[i - 1], [x1, y1] = KEY[i];
      return y0 + (y1 - y0) * MathUtils.clamp((log10La - x0) / (x1 - x0), 0, 1);
    }
  }
  return KEY[KEY.length - 1][1];
}

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10000) / 10000;
}

export async function init(ctx) {
  const { renderer, scene, camera } = ctx;
  const qkey = ctx.quality?.key in TIERS ? ctx.quality.key : 'medium';
  let tier = TIERS[qkey]; // replaced on 'quality:change' (applyTier)
  installFogChunks();
  // three's PMREM shader triggers a benign ANGLE/D3D constant-folding warning (X4122) at our first compile;
  // render/ owns the idempotent filter for such logs (it should move to main.js boot — see report)
  try { (await import('../render/log-filter.js')).installShaderLogFilter?.(); } catch { /* optional */ }

  // ---------------------------------------------------------------- atmosphere LUTs
  const luts = new AtmosphereLUTs(renderer, tier);
  luts.init();
  const obsR = ATMO.groundRadius + ATMO.observerAltitude;
  const mie = mieCoefficients(ATMO);
  const tauZenith = zenithOpticalDepth(ATMO);

  // night-sky floor: the dome draws NIGHT_SKY_L × nightFloorShape(el)/shape(zenith); the stats, fog, ambient and
  // exposure add the very same curve (horizon band 0.5–3.5° like the stats pass, 85° "zenith", irradiance)
  const nightFloor = (() => {
    const T = [0, 0, 0];
    const shape = (elDeg) => {
      const y = Math.sin(elDeg * DEG);
      transmittanceCPU(obsR, y, ATMO, T, 40);
      return nightFloorShape(y, luminance(T));
    };
    const norm = 1 / shape(90);
    const horizon = [0.5, 1.5, 2.5, 3.5].reduce((s, e) => s + shape(e), 0) / 4 * norm;
    let irr = 0;
    const n = 90;
    for (let i = 0; i < n; i++) {
      const el = (i + 0.5) / n * 90;
      irr += shape(el) * norm * Math.sin(el * DEG) * Math.cos(el * DEG) * (90 / n) * DEG;
    }
    return { norm, horizon, zenith: shape(85) * norm, irr: 2 * Math.PI * irr };
  })();

  // ---------------------------------------------------------------- sky dome + env-pass sky
  const skyU = createSkyUniforms();
  Object.assign(skyU, luts.atmo);
  skyU.uTransmittance.value = luts.transRT.texture;
  skyU.uSkyLUT.value = luts.skyRT.texture;
  skyU.uObsR.value = obsR;
  skyU.uSunCos.value = Math.cos(ATMO.sunAngularRadius);
  const domeFeatures = (t) => ({ milkyWay: t.milkyWay, mwOctaves: t.mwOct, clouds: t.clouds, cloudOctaves: t.cloudOct });
  const envFeatures = (t) => ({ clouds: t.clouds, cloudOctaves: Math.min(3, t.cloudOct || 3) });
  const skyMat = createSkyMaterial(skyU, domeFeatures(tier));
  const sky = new Mesh(new BoxGeometry(2, 2, 2), skyMat);
  sky.name = 'env.sky';
  sky.frustumCulled = false;
  sky.renderOrder = 1e6; // last opaque: early-z rejects every pixel covered by the world
  sky.castShadow = false; sky.receiveShadow = false;
  scene.add(sky);
  scene.background = null;

  const envMat = createSkyMaterial(skyU, { envPass: true, ...envFeatures(tier) });
  const envScene = new Scene();
  const envSky = new Mesh(new BoxGeometry(2, 2, 2), envMat);
  envSky.frustumCulled = false;
  envScene.add(envSky);
  const CUBE_OPTS = { type: HalfFloatType, generateMipmaps: false, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false };
  let cubeRT = new WebGLCubeRenderTarget(tier.envSize, CUBE_OPTS);
  const cubeCam = new CubeCamera(0.1, 10, cubeRT);
  envScene.add(cubeCam);
  const pmrem = new PMREMGenerator(renderer);
  let pmremRT = null;

  // ---------------------------------------------------------------- stars & planets
  const field = createStarfield({ count: tier.stars, magLimit: tier.magLimit, seed: 5786 });
  field.uniforms.uTau.value.fromArray(tauZenith);
  field.uniforms.uSkyLUT.value = luts.skyRT.texture;
  field.uniforms.uLutPhys.value = LUT_SCALE;
  field.uniforms.uObsR.value = obsR;
  field.uniforms.uBgFloor.value = NIGHT_SKY_L * nightFloor.norm; // × nightFloorShape in the shader, as the dome
  field.uniforms.uTwinkle.value = tier.twinkle ? 1 : 0;
  const tmpV2 = new Vector2();
  const pxInfo = (r) => {
    const rt = r.getRenderTarget();
    const h = rt ? rt.height : r.getDrawingBufferSize(tmpV2).y;
    field.uniforms.uSizeScale.value = MathUtils.clamp(h / 800, 1, 2.5);
  };
  field.stars.onBeforeRender = (r) => pxInfo(r);
  scene.add(field.stars, field.planets);

  // ---------------------------------------------------------------- lights
  // One shadow-casting key light: the Sun by day, the Moon by night (they never matter together: when the
  // Sun is above -4° moonlight is < 0.1% of skylight). ctx.env.moonLight is the same object.
  const key = new DirectionalLight(0xffffff, 0);
  key.name = 'env.key (sun/moon)';
  const q = ctx.quality || {};
  key.castShadow = !!q.shadows;
  const mapSize = q.shadowMapSize || 2048;
  key.shadow.mapSize.set(mapSize, mapSize);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 1000;
  scene.add(key, key.target);

  // ---------------------------------------------------------------- fog
  const fogU = new FogUniforms(renderer);
  scene.fog = new FogExp2(0x000000, 0.00005);

  // ---------------------------------------------------------------- state
  const st = {
    P: 1, logP: 0, La: 1, scotopic: 0,
    sunE0: ATMO.sunIlluminanceTOA, Tsun: [1, 1, 1], Tmoon: [1, 1, 1],
    sunVis: 1, moonVis: 1, keyIsMoon: false, keyE: 0, keyDir: new Vector3(0, 1, 0),
    skyIrr: 1e4, floorIrr: NIGHT_SKY_L * nightFloor.irr,
    lutSun: new Vector3(0, -2, 0), lutMoon: new Vector3(0, -2, 0), lutMoonE: -1,
    envSun: new Vector3(0, -2, 0), envMoon: new Vector3(0, -2, 0), envAt: -1e9, envNorm: 1, envDirty: true,
    force: true, clock: 0, skyIrrRGB: [1e4, 1e4, 1e4],
    refIsSun: true, skySun: [0, 0, 0], // sky in the 0.5–3.5° band below the Sun's azimuth (physical)
    horizon: null, // Float32Array [H, D] per 2° azimuth
    shadowsManaged: true,
    fourier: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], zenith: [0, 0, 0], horizonMean: [0, 0, 0],
    refDir: new Vector3(0, 1, 0),
  };
  const celestial = new Matrix3();
  const worldToGal = new Matrix3();
  const ncp = new Vector3();
  const tmp = new Vector3();
  const lutSunE = new Vector3(), lutMoonE = new Vector3(), lutGround = new Vector3();
  // thin cirrus coverage: a property of the chosen date (deterministic), or forced via ctx.env.cirrus / ?cirrus=
  const urlCirrus = parseFloat(ctx.params.raw?.get?.('cirrus'));
  const cloudCoverage = () => {
    if (Number.isFinite(api.cirrus)) return MathUtils.clamp(api.cirrus, 0, 1);
    const h = hash01(ctx.time?.dateString || '');
    return h < 0.45 ? 0 : (h - 0.45) / 0.55 * 0.5;
  };

  // ---------------------------------------------------------------- terrain horizon (sun behind Har HaMishchah)
  function horizonAngle(azDeg, camY) {
    const hp = st.horizon;
    if (!hp) return -90;
    const i = Math.round(MathUtils.euclideanModulo(azDeg, 360) / 2) % 180;
    const H = hp[i * 2], D = hp[i * 2 + 1];
    if (!(D > 0)) return -90;
    return Math.atan2(H - camY, D) / DEG;
  }
  function terrainVisibility(azDeg, altDeg, camY) {
    const h = horizonAngle(azDeg, camY);
    return smooth(-0.27, 0.27, altDeg - h);
  }
  /** samples: Float32Array/Array of [height(m, world y), distance(m)] per 2° of azimuth (180 entries), or fn(az)->[H,D] */
  function setHorizonProfile(samples) {
    const out = new Float32Array(360);
    for (let i = 0; i < 180; i++) {
      const v = typeof samples === 'function' ? samples(i * 2) : [samples[i * 2], samples[i * 2 + 1]];
      out[i * 2] = v?.[0] ?? 0; out[i * 2 + 1] = v?.[1] ?? 0;
    }
    st.horizon = out;
  }
  function computeHorizonFromPhysics() {
    const fa = ctx.physics?.floorAt;
    if (typeof fa !== 'function') return;
    const out = new Float32Array(360);
    const c = ctx.anchors?.get?.('start')?.pos || new Vector3();
    let any = false;
    for (let i = 0; i < 180; i++) {
      const az = i * 2 * DEG;
      const sx = Math.sin(az), sz = -Math.cos(az);
      let best = -Infinity, bh = 0, bd = 0;
      for (let k = 0; k < 36; k++) {
        // 350 m .. 4 km, geometric spacing: beyond the Mount's own walls (their shadows are the shadow map's job),
        // out to Har HaMishchah (~1 km east) and the city ridges
        const d = 350 * Math.pow(4000 / 350, k / 35);
        let y;
        try { y = fa.call(ctx.physics, c.x + sx * d, c.z + sz * d, 2000); } catch { y = null; }
        if (!Number.isFinite(y)) continue;
        const ang = Math.atan2(y - (c.y + 1.6), d);
        if (ang > best) { best = ang; bh = y; bd = d; any = true; }
      }
      out[i * 2] = bh; out[i * 2 + 1] = bd;
    }
    if (any) st.horizon = out;
  }
  ctx.bus.on('ready', () => { if (!st.horizon) computeHorizonFromPhysics(); st.force = true; });
  ctx.bus.on('time:jump', () => { st.force = true; });
  ctx.bus.on('time:date', () => { st.force = true; });
  ctx.bus.on('quality:change', () => {
    const nq = ctx.quality || {};
    key.castShadow = !!nq.shadows;
    const ms = nq.shadowMapSize || mapSize;
    if (key.shadow.mapSize.x !== ms) { key.shadow.mapSize.set(ms, ms); key.shadow.map?.dispose(); key.shadow.map = null; }
    if (nq.key in TIERS) applyTier(TIERS[nq.key]);
  });

  /** Runtime tier switch: sky-view LUT size/steps, PMREM size & cadence, Milky Way/cirrus, star count, twinkle. */
  function applyTier(nt) {
    if (nt === tier) return;
    const old = tier;
    tier = nt;
    if (nt.skyW !== old.skyW || nt.skyH !== old.skyH || nt.steps !== old.steps) luts.resize(nt);
    if (nt.envSize !== old.envSize) {
      cubeRT.dispose();
      cubeRT = new WebGLCubeRenderTarget(nt.envSize, CUBE_OPTS);
      cubeCam.renderTarget = cubeRT;
      pmremRT?.dispose(); // fromCubemap reallocates at the new size (it never resizes a target it is given)
      pmremRT = null;
    }
    setSkyFeatures(skyMat, domeFeatures(nt));
    setSkyFeatures(envMat, envFeatures(nt));
    if (nt.stars !== old.stars || nt.magLimit !== old.magLimit) field.rebuild({ count: nt.stars, magLimit: nt.magLimit });
    field.uniforms.uTwinkle.value = nt.twinkle ? 1 : 0;
    // refill the resized LUT and PMREM now, so no frame samples a disposed target
    st.force = true; st.envDirty = true;
    update(0);
  }

  // ---------------------------------------------------------------- shadows (one function the render task can disable)
  const sBasisX = new Vector3(), sBasisY = new Vector3(), sCenter = new Vector3(), UP = new Vector3(0, 1, 0);
  function updateShadowCamera(sunAltDeg) {
    if (!st.shadowsManaged || !key.castShadow) return;
    const R = MathUtils.lerp(80, 220, smooth(14, 3, sunAltDeg)); // whole Mount when shadows are long
    const D = sunAltDeg < 14 ? 2600 : 700; // reach far enough toward a low Sun to catch the eastern ridge
    const size = key.shadow.mapSize.x;
    const texel = (2 * R) / size;
    const dir = st.keyDir;
    // the shadow camera's basis (same as Object3D.lookAt with up = +y)
    sBasisX.crossVectors(UP, dir);
    if (sBasisX.lengthSq() < 1e-8) sBasisX.set(1, 0, 0);
    sBasisX.normalize();
    sBasisY.crossVectors(dir, sBasisX).normalize();
    const fwd = tmp.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
    if (fwd.lengthSq() > 1e-6) fwd.normalize().multiplyScalar(R * 0.35);
    sCenter.copy(camera.position).add(fwd);
    // snap the centre to whole texels in light space (no shimmering when walking)
    const x = Math.round(sCenter.dot(sBasisX) / texel) * texel;
    const y = Math.round(sCenter.dot(sBasisY) / texel) * texel;
    const z = sCenter.dot(dir);
    sCenter.copy(sBasisX).multiplyScalar(x).addScaledVector(sBasisY, y).addScaledVector(dir, z);
    key.target.position.copy(sCenter);
    key.position.copy(sCenter).addScaledVector(dir, D);
    const cam = key.shadow.camera;
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R;
    cam.near = 1; cam.far = D + R * 1.5;
    cam.updateProjectionMatrix();
    key.shadow.bias = -0.04 / (cam.far - cam.near);
    key.shadow.normalBias = texel * 1.2;
    key.target.updateMatrixWorld();
  }

  // ---------------------------------------------------------------- env map
  function refreshEnvMap(Enorm) {
    st.envNorm = Math.max(Enorm, 1e-9);
    envMat.uniforms.uLutScale.value = LUT_SCALE / st.envNorm;
    envMat.uniforms.uOutScale.value = 1 / st.envNorm;
    luts.withState(() => {
      cubeCam.update(renderer, envScene);
      pmremRT = pmrem.fromCubemap(cubeRT.texture, pmremRT);
    });
    scene.environment = pmremRT.texture;
    api.envMap = pmremRT.texture;
  }

  // ---------------------------------------------------------------- the per-frame update
  function update(dt) {
    const time = ctx.time;
    if (!time) return;
    const force = st.force;
    st.force = false;
    st.clock += dt;
    const sun = time.sun, moon = time.moon;
    const camY = camera.position.y;

    // --- light sources at the observer (physical)
    st.sunE0 = ATMO.sunIlluminanceTOA / (sun.distanceAU * sun.distanceAU);
    transmittanceCPU(obsR, sun.dir.y, ATMO, st.Tsun, 40);
    transmittanceCPU(obsR, moon.dir.y, ATMO, st.Tmoon, 40);
    st.sunVis = terrainVisibility(sun.azimuth, sun.altitude, camY);
    st.moonVis = terrainVisibility(moon.azimuth, moon.altitude, camY);
    const moonE0 = moon.altitude > -2 ? moon.illuminanceTOA : 0;

    // --- sky-view LUT + statistics when the lights moved
    const moved = st.lutSun.angleTo(sun.dir) > 0.01 * DEG || st.lutMoon.angleTo(moon.dir) > 0.05 * DEG
      || Math.abs(moonE0 - st.lutMoonE) > 0.02 * Math.max(moonE0, 1e-6);
    if (force || moved) {
      const s = st.sunE0 / LUT_SCALE;
      const m = moonE0 / LUT_SCALE;
      const gi = (st.skyIrr + st.floorIrr) / LUT_SCALE;
      luts.updateSky({
        sunDir: sun.dir, sunE: lutSunE.set(s, s, s), moonDir: moon.dir,
        moonE: lutMoonE.set(m * MOON_COLOR[0], m * MOON_COLOR[1], m * MOON_COLOR[2]),
        groundIrr: lutGround.set(gi, gi, gi),
      });
      st.lutSun.copy(sun.dir); st.lutMoon.copy(moon.dir); st.lutMoonE = moonE0;
      const sunRules = sun.altitude > -14 || moon.altitude < 0;
      st.refIsSun = sunRules;
      st.refDir.copy(sunRules ? sun.dir : moon.dir);
      luts.runStats(sunRules ? sun.azimuth : moon.azimuth);
      if (force || !luts.stats) luts.readStatsSync();
      else luts.readStatsAsync();
    }
    const S = luts.stats;
    if (S) {
      // 0 E_up, 1 horizon mean, 2..6 horizon at 0..180° from ref, 7 zenith
      st.skyIrrRGB = [S[0], S[1], S[2]];
      st.skyIrr = luminance(st.skyIrrRGB);
      const h = (k) => [S[k * 4], S[k * 4 + 1], S[k * 4 + 2]];
      const s0 = h(2), s45 = h(3), s90 = h(4), s135 = h(5), s180 = h(6);
      const c45 = Math.SQRT1_2;
      for (let c = 0; c < 3; c++) {
        st.fourier[0][c] = (s0[c] + 2 * s45[c] + 2 * s90[c] + 2 * s135[c] + s180[c]) / 8;
        st.fourier[1][c] = (s0[c] + 2 * c45 * s45[c] - 2 * c45 * s135[c] - s180[c]) / 4;
        st.fourier[2][c] = (s0[c] - 2 * s90[c] + s180[c]) / 4;
      }
      st.horizonMean = h(1);
      st.zenith = h(7);
      st.skySun = s0;
      // the dome adds the airglow/starlight floor on top of the LUT: add the identical curve here
      for (let c = 0; c < 3; c++) {
        const nf = NIGHT_SKY_L * NIGHT_TINT[c];
        st.fourier[0][c] += nf * nightFloor.horizon;
        st.horizonMean[c] += nf * nightFloor.horizon;
        st.zenith[c] += nf * nightFloor.zenith;
      }
    }
    const Esky = st.skyIrr + st.floorIrr;

    // --- key light (sun by day, moon by night)
    const sunDuty = sun.altitude > -4;
    st.keyIsMoon = !sunDuty;
    // without our own far-reaching shadow camera, dim the light by the terrain horizon seen from the camera
    const useTerrainVis = api.useTerrainVisibility ?? !(key.castShadow && st.shadowsManaged);
    let keyRGB, keyE;
    if (sunDuty) {
      keyRGB = st.Tsun; keyE = st.sunE0; st.keyDir.copy(sun.dir);
      if (useTerrainVis) keyE *= st.sunVis;
    } else {
      keyRGB = [st.Tmoon[0] * MOON_COLOR[0], st.Tmoon[1] * MOON_COLOR[1], st.Tmoon[2] * MOON_COLOR[2]];
      keyE = moonE0; st.keyDir.copy(moon.dir);
      if (useTerrainVis) keyE *= st.moonVis;
    }
    const kl = luminance(keyRGB);
    st.keyE = keyE * kl; // beam illuminance (lx) on a surface facing the light

    // --- exposure (adaptation luminance from what the observer sees)
    const vis = sunDuty ? st.sunVis : st.moonVis;
    const Edir = st.keyE * Math.max(st.keyDir.y, 0) * (useTerrainVis ? 1 : vis);
    const La = Math.max((0.6 * SCENE_ALBEDO * (Edir + Esky) + 0.4 * Esky) / Math.PI, 1e-7);
    st.La = La;
    const lg = Math.log10(La);
    const target = Math.log(keyFor(lg) / La);
    if (force || !Number.isFinite(st.logP)) st.logP = target;
    else st.logP += (target - st.logP) * (1 - Math.exp(-dt / 0.7));
    st.P = Math.exp(st.logP);
    const P = st.P;
    st.scotopic = smooth(-1.0, -3.0, lg);

    // --- apply the key light
    const tint = sunDuty ? [1, 1, 1] : SCOTOPIC_TINT.map((v) => 1 + (v - 1) * st.scotopic);
    if (kl > 1e-9) key.color.setRGB(keyRGB[0] / kl * tint[0], keyRGB[1] / kl * tint[1], keyRGB[2] / kl * tint[2]);
    key.intensity = st.keyE * P;
    key.shadow.autoUpdate = key.intensity > 1e-6;
    if (!key.castShadow || !st.shadowsManaged) {
      key.position.copy(key.target.position).addScaledVector(st.keyDir, 500);
    }
    updateShadowCamera(sunDuty ? sun.altitude : moon.altitude);

    // --- sky dome uniforms (physical; uOutScale = P)
    skyU.uLutScale.value = LUT_SCALE * P;
    skyU.uOutScale.value = P;
    skyU.uSunDir.value.copy(sun.dir);
    const sunOmega = Math.PI * Math.sin(ATMO.sunAngularRadius) ** 2;
    const Ld = st.sunE0 / (sunOmega * 0.8);
    skyU.uSunRadiance.value.set(Ld, Ld, Ld);
    // Disc local adaptation: the eye keeps a low Sun's colour instead of a white clip (cap ≈3 output units),
    // yet the disc always stays the brightest thing in view (≥ DISC_OVER_SKY × the sky beside it); by ~25°
    // the cap is gone and the Sun is blinding again. One factor (discK) scales the disc AND its aureole.
    const discOut = Ld * Math.max(st.Tsun[0], st.Tsun[1], st.Tsun[2]) * P; // uncapped disc centre
    const skyBeside = st.refIsSun ? Math.max(st.skySun[0], st.skySun[1], st.skySun[2]) * P : 0;
    const cap = Math.max(MathUtils.lerp(3.0, 6e4, smooth(3, 25, sun.altitude) ** 2), MathUtils.lerp(DISC_OVER_SKY[0], DISC_OVER_SKY[1], smooth(1, 4, sun.altitude)) * skyBeside);
    const discK = discOut > cap ? cap / discOut : 1;
    skyU.uSunDiscScale.value = discK;
    skyU.uSunDiscCap.value = cap;
    skyU.uSunFlat.value = refractionFlattening(sun.altitude);
    // Narrow aureole (coarse dust, HG g 0.99 — finer than the LUT holds): single forward scattering along the
    // disc's own line of sight, so the disc's transmittance (0 below the horizon: no false Sun before netz) and
    // a slant depth capped at AUREOLE_TAU_MAX: aureole(1°)/disc ≈ 1e-4 high, ≈1e-3 at the horizon (measured).
    const airmassSun = 1 / (Math.max(sun.dir.y, 0) + 0.50572 * Math.pow(Math.max(96.07995 - (90 - sun.altitude), 0.5), -1.6364));
    const coarse = 0.08 * ATMO.aod * Math.exp(-ATMO.observerAltitude / ATMO.mieHeight);
    const aur = Math.min(coarse * airmassSun, AUREOLE_TAU_MAX) * st.sunE0 * discK;
    skyU.uSunAureole.value.set(aur * st.Tsun[0], aur * st.Tsun[1], aur * st.Tsun[2]);
    skyU.uMoonDir.value.copy(moon.dir);
    const moonOmega = Math.PI * Math.sin(moon.angularRadius * DEG) ** 2;
    const Efull = MOON_FULL_LX * (384400 / moon.distanceKm) ** 2;
    // local adaptation: the eye reads the Moon's face (maria, terminator) even in a night exposure, so the
    // disc is compressed to ~1.6 output units instead of clipping to a white blob
    const moonAdapt = Math.min(1, 3.2 / Math.max((Efull / moonOmega) * P, 1e-9));
    const Lm = 2 * Efull / moonOmega * moonAdapt;
    skyU.uMoonRadiance.value.set(Lm * MOON_COLOR[0], Lm * MOON_COLOR[1], Lm * MOON_COLOR[2]);
    const es = (Efull / moonOmega) * 3e-4 * (1 - moon.illumination) ** 2 * moonAdapt;
    skyU.uEarthshine.value.set(es * 0.85, es * 0.95, es * 1.1);
    skyU.uMoonCos.value = Math.cos(moon.angularRadius * DEG);
    const airmassMoon = 1 / (Math.max(moon.dir.y, 0) + 0.50572 * Math.pow(Math.max(96.07995 - (90 - moon.altitude), 0.5), -1.6364));
    let aurM = Math.min(coarse * Math.min(airmassMoon, 38), 1) * moonE0;
    aurM *= Math.min(1, 0.12 / Math.max(aurM * 200 * P, 1e-12)); // same local adaptation for the moon's halo
    skyU.uMoonAureole.value.set(aurM * st.Tmoon[0], aurM * st.Tmoon[1], aurM * st.Tmoon[2]);
    const nk = NIGHT_SKY_L * nightFloor.norm;
    skyU.uNightSky.value.set(nk * NIGHT_TINT[0], nk * NIGHT_TINT[1], nk * NIGHT_TINT[2]);
    skyU.uMilkyWay.value.set(2.6e-4, 2.6e-4, 2.8e-4);

    // celestial sphere orientation (local sidereal time)
    field.setCelestial(time.lst, time.geo.lat, celestial);
    field.uniforms.uCelestial.value.copy(celestial);
    worldToGal.copy(celestial).transpose().premultiply(EQ_TO_GAL);
    skyU.uWorldToGal.value.copy(worldToGal);
    ncp.set(0, Math.sin(time.geo.lat * DEG), -Math.cos(time.geo.lat * DEG));
    skyU.uMoonNorth.value.copy(ncp).addScaledVector(moon.dir, -ncp.dot(moon.dir)).normalize();

    // cirrus (high+): coverage seeded per date, drifting with sim time
    skyU.uCloudParams.value.set(cloudCoverage(), 0.55, time.t);
    skyU.uCloudSun.value.set(st.sunE0, st.sunE0, st.sunE0);
    skyU.uCloudSky.value.set(Esky / Math.PI, Esky / Math.PI, Esky / Math.PI);

    // local ground seen by the env probe below the horizon
    const Eg = st.keyE * Math.max(st.keyDir.y, 0) * vis + Esky;
    const gt = SCOTOPIC_TINT.map((v) => 1 + (v - 1) * st.scotopic);
    skyU.uLocalGround.value.set(LOCAL_ALBEDO[0] * gt[0] * Eg / Math.PI, LOCAL_ALBEDO[1] * gt[1] * Eg / Math.PI, LOCAL_ALBEDO[2] * gt[2] * Eg / Math.PI);

    // stars & planets
    field.uniforms.uOut.value = P;
    field.uniforms.uTime.value = st.clock;
    if (time.planets?.length) field.updatePlanets(time.planets);

    // --- environment map (sky-only PMREM)
    const envAngle = (sun.altitude > -14 && sun.altitude < 10 ? 0.5 : 1) * tier.envAngle * DEG;
    const envMoved = st.envSun.angleTo(sun.dir) > envAngle || (!sunDuty && st.envMoon.angleTo(moon.dir) > tier.envAngle * DEG);
    if (force || st.envDirty || (envMoved && st.clock - st.envAt > tier.envInterval)) {
      refreshEnvMap(Esky);
      st.envSun.copy(sun.dir); st.envMoon.copy(moon.dir); st.envAt = st.clock; st.envDirty = false;
    }
    scene.environmentIntensity = Esky * P;

    // --- aerial perspective
    const F = st.fourier;
    fogU.set('mkFogA0', F[0].map((v) => v * P));
    fogU.set('mkFogA1', F[1].map((v) => v * P));
    fogU.set('mkFogA2', F[2].map((v) => v * P));
    fogU.set('mkFogRefDir', st.refDir.toArray());
    const rho = Math.exp(-ATMO.observerAltitude / ATMO.rayleighHeight);
    fogU.set('mkFogExtR', ATMO.rayleighScattering.map((v) => v * rho / 1000));
    const mieY0 = mie.ext[1] * Math.exp(-ATMO.observerAltitude / ATMO.mieHeight) / 1000;
    const zr = luminance(st.zenith) / Math.max(luminance(st.horizonMean), 1e-12);
    fogU.set('mkFogParams', [mieY0 * api.haze, 1 / (ATMO.mieHeight * 1000), MathUtils.clamp(zr, 0.15, 1), 1]);
    fogU.apply();
    scene.fog.color.setRGB(F[0][0] * P, F[0][1] * P, F[0][2] * P);
    // stock exp2 consumers (FX flames/smoke, custom shaders): 1 - exp(-(ρd)²) equals the physical
    // 1 - exp(-σd) at FOG_MATCH_DIST (≈4.8e-4/m: 0.3 % at 100 m, 1.4 % at 300 m), not 50× stronger
    const sigma = mieY0 * api.haze + ATMO.rayleighScattering[1] * rho / 1000;
    scene.fog.density = Math.sqrt(sigma / FOG_MATCH_DIST);
    api.fog.density = scene.fog.density;
    api.fog.extinction = sigma;

    // --- exposure for the tone mapper
    api.exposure = TONE_EXPOSURE;
    if (!ctx.post) renderer.toneMappingExposure = api.exposure;

    // --- public read-outs
    api.preExposure = P;
    api.physicalExposure = P * TONE_EXPOSURE;
    api.luminance = La;
    api.scotopic = st.scotopic;
    api.sunIlluminance = st.sunE0 * luminance(st.Tsun) * st.sunVis;
    api.moonIlluminance = moonE0 * luminance(st.Tmoon) * st.moonVis;
    api.skyIrradiance = Esky;
    api.sunTerrainVisibility = st.sunVis;
    api.keyIsMoon = st.keyIsMoon;
    api.sunDir.copy(sun.dir);
    api.moonDir.copy(moon.dir);
    api.keyDir.copy(st.keyDir);
    const fl = st.floorIrr;
    api.ambient.sky.setRGB((st.skyIrrRGB[0] + fl * NIGHT_TINT[0]) * P, (st.skyIrrRGB[1] + fl * NIGHT_TINT[1]) * P, (st.skyIrrRGB[2] + fl * NIGHT_TINT[2]) * P);
    api.ambient.ground.setRGB(Eg * LOCAL_ALBEDO[0] * P, Eg * LOCAL_ALBEDO[1] * P, Eg * LOCAL_ALBEDO[2] * P);
  }

  const api = {
    sunLight: key,
    moonLight: key,
    keyLight: key,
    keyIsMoon: false,
    envMap: null,
    sky,
    stars: field.stars,
    planets: field.planets,
    sunDir: new Vector3(0, 1, 0),
    moonDir: new Vector3(0, -1, 0),
    keyDir: new Vector3(0, 1, 0),
    /** tone-mapper exposure (apply as renderer.toneMappingExposure or in the post ToneMapping effect) */
    exposure: TONE_EXPOSURE,
    /** factor already applied to all env light; multiply physical fire/lamp/emissive values by it */
    preExposure: 1,
    physicalExposure: 1,
    luminance: 1,
    scotopic: 0,
    sunIlluminance: 0,
    moonIlluminance: 0,
    skyIrradiance: 0,
    sunTerrainVisibility: 1,
    /** irradiance in SCENE units (lx × preExposure): sky from above, bounce from the ground — for custom shaders */
    ambient: { sky: new Color(), ground: new Color() },
    /** neutral multiplier for FX emission (FX should move to physical values × preExposure; see decisions) */
    fireScale: 1,
    /** null = automatic; true/false forces dimming the key light by the terrain horizon at the camera */
    useTerrainVisibility: null,
    /** aerosol multiplier on the fog extinction (1 = the modelled Jerusalem autumn haze) */
    haze: 1,
    /**
     * Aerial perspective for custom shaders. `values` is live (FogUniforms): mkFogA0/A1/A2 horizon in-scatter
     * Fourier terms around mkFogRefDir (scene units), mkFogExtR Rayleigh extinction rgb (1/m), mkFogParams
     * [aerosol extinction at y=0 (1/m), 1/aerosol scale height (1/m), zenith/horizon in-scatter ratio, 1].
     * Easiest use: material `fog: true` + the standard fog chunks; the env chunk then provides
     * mkFogTransmittance() and mkApplyFog(col), and the uniforms are uploaded automatically. Additive emitters:
     * multiply by mkFogTransmittance() and `#define MK_FOG_DONE` before <tonemapping_fragment>.
     * `density` is the FogExp2-equivalent (also scene.fog.density), `extinction` the green-channel σ (1/m).
     */
    fog: { values: fogU.values, density: 0, extinction: 0 },
    /** cirrus coverage 0..1 (high/ultra only); null = per-date deterministic weather */
    cirrus: Number.isFinite(urlCirrus) ? urlCirrus : null,
    atmosphere: ATMO,
    get shadowsManaged() { return st.shadowsManaged; },
    /** false: the render task drives sunLight.shadow (e.g. CSM); env stops moving the shadow camera */
    setShadowsManaged(on) { st.shadowsManaged = !!on; },
    setHorizonProfile,
    horizonElevation: (az, y = camera.position.y) => horizonAngle(az, y),
    /** force a full refresh (LUT, stats, PMREM) on the next frame; pass true to do it now */
    update(now = false) { st.force = true; st.envDirty = true; if (now) update(0); },
    /** internal: time one update (ms); for profiling */
    _profile(force = false) {
      const gl = renderer.getContext();
      if (force) { st.force = true; st.envDirty = true; }
      const t0 = performance.now(); update(0.016); gl.finish(); return performance.now() - t0;
    },
    /** sky radiance toward a world direction in SCENE units (cd/m² × preExposure), from the measured stats */
    skyColorAt(dir, target = new Color()) {
      const F = st.fourier;
      const h = Math.hypot(dir.x, dir.z), r = Math.hypot(st.refDir.x, st.refDir.z);
      const c = h > 1e-6 && r > 1e-6 ? (dir.x * st.refDir.x + dir.z * st.refDir.z) / (h * r) : 0;
      const c2 = 2 * c * c - 1;
      const w = Math.pow(MathUtils.clamp(dir.y, 0, 1), 0.6);
      const ch = (i) => (Math.max(F[0][i] + F[1][i] * c + F[2][i] * c2, 0) * (1 - w) + st.zenith[i] * w) * st.P;
      return target.setRGB(ch(0), ch(1), ch(2));
    },
    dispose() {
      luts.dispose(); pmrem.dispose(); cubeRT.dispose(); pmremRT?.dispose();
      skyMat.dispose(); envMat.dispose();
    },
  };
  ctx.env = api;
  ctx.engine.onUpdate((dt) => update(dt), PRIORITY.env);
  update(0); // first frame correct even before the loop starts (and for headless shots)
}

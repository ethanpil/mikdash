// Environment: physically based sky, sun/moon/stars/planets, sun & moon light, sky ambient (PMREM),
// aerial-perspective fog and the exposure curve — all driven by ctx.time every frame. ARCHITECTURE.md §7.
//
// Light units are PHOTOMETRIC (lx for the directional light, cd/m² for sky radiance) multiplied by
// ctx.env.preExposure, a slowly varying scalar that keeps the frame buffer in half-float range from starlight
// to noon. Anything else that emits light (fires, lamps, emissive) must multiply its physical value
// (candela, cd/m²) by ctx.env.preExposure. ctx.env.exposure is what the tone mapper applies on top (≈1).
import {
  DirectionalLight, Mesh, BoxGeometry, Scene, CubeCamera, WebGLCubeRenderTarget, HalfFloatType, LinearFilter,
  PMREMGenerator, FogExp2, Color, Vector2, Vector3, Matrix3, MathUtils, ShaderChunk, BufferGeometry, Float32BufferAttribute,
} from 'three';
import { PRIORITY } from '../core/engine.js';
import { ATMO, mieCoefficients, transmittanceCPU, zenithOpticalDepth, luminance, nightFloorShape } from './atmosphere.js';
import { AtmosphereLUTs, LUT_SCALE } from './luts.js';
import { createSkyUniforms, createSkyMaterial, setSkyFeatures } from './sky.js';
import { createStarfield, EQ_TO_GAL, precessionFromJ2000 } from './stars.js';
import { installFogChunks, FogUniforms } from './fog.js';
import { createInteriors } from './interiors.js';
import { setInteriorProbes } from './interiors-glsl.js';
import { createProbes } from './probes.js';

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
// Interiors (lighting-polish): inside a roofed room the eye adapts to what it sees there — the room's mean
// luminance measured by its reflection probe (the Kodesh), else the sky through its openings plus the fires
// burning IN it (the Moked hearth), which env then meters itself (fx stops adapting to those). Toward a dimmer
// room the eye adapts only this fraction of the way (in log luminance): a dim room stays dim but readable;
// toward a brighter one (a lamp-lit room at night) it adapts fully.
// render-env-2: 1 (was 0.9 — lighting-polish-fix; 0.7 before that): within the fast-adaptation range below the eye
// adapts to a dim room; the daylit Kodesh looking west read murky and darker than the lamp-lit Kodesh at night
const INTERIOR_ADAPT = 1.0;
// …but within seconds of stepping out of daylight the eye's cone (and neural) adaptation covers about this many
// decades below the outdoor level; deeper darkness takes minutes of dark adaptation (rods). The KhK behind its two
// closed parochot (≈ 2.5 decades below the court) therefore stays "a dark chamber", darker than the Kodesh lit
// through its gate (≈ 1.7 decades) — render-env-2; before, both adapted to the same display level
const FAST_ADAPT_DECADES = 2.0;
// a lamp-lit room's log-average luminance over its surfaces' mean (the Kodesh probe: 0.2 at night, 0.27 by day)
const FIRE_LOG = 0.3;
// …and a room lit by its own lamps: lighting-polish raised the exposure key toward 0.115 with the fires' share of the
// room's light ("firelight read by a dark-adapted eye"), which put the lamp-lit Kodesh at night above its daylight
// level (seven oil lamps, ≈ 21 cd, in a 19 × 10 × 19 m room: ≈ 0.01 cd/m², a hundredth of the daylit room).
// render-env-2: the room follows the eye's own key curve, lowered by the glare of the flames in view (they hold the
// eye's sensitivity down: a lamp-lit room reads dimmer than a uniformly lit one of the same mean luminance)
// render-env-2-fix: 0.4 → 0.75 — at 0.4 the lamp-lit Kodesh still measured 0.8–1.0 × its daylit display level on
// medium / high: a lamp-lit room is a few bright pools in the dark, its log-average (what the eye adapts to) far below
// the pools, which then dominate what is seen; daylight through the gate fills the room evenly. The hearth-lit Moked
// read like a daylit room. (0.65: the night Kodesh 0.70–0.79 × day on medium)
const FIRE_GLARE = 0.75;
// the surroundings in the env probe's lower sky (low tier everywhere; medium+ outside the probes): walls,
// colonnades and buildings of the Mount up to this elevation (deg) — the courts are enclosed by 40-amah walls
const WALL_TOP = { court: 16, open: 6 };
const WALL_ALBEDO = [0.55, 0.5, 0.43]; // dressed Jerusalem limestone / marble
const KEY_PCF_RADIUS = 1.5; // texels, the key light's shadow filter (medium; high / ultra use render/'s cascades)
// interiors (lighting-polish-fix): albedo of a room's own surfaces seen in reflections (gold and limestone), and
// the degree of chromatic adaptation toward firelight in a room the fires light (0 none … 1 full von Kries)
const ROOM_ALBEDO = 0.6;
const WB_FIRE = 0.55; // render-env-2-fix: low-CCT, mesopic firelight is adapted to incompletely — a hearth-lit room stays warm
const WB_FIRE_GOLD = 0.75; // render-env-2: in a gilded room (the eye adapts to the gold-tinted light that fills it)
// render-env-2: the eye adapts chromatically to the light that fills the room — in a gilded room that is the lamps'
// (or the doorway's) light after the gold walls have coloured it, not the bare flame colour (gold × 1900 K, squared by
// interreflection, read as deep orange-red under AgX at night). Daylit rooms: a smaller degree where daylight is in
// view through an opening (it anchors the white point), up to WB_CLOSED in a closed room (the KhK behind its parochot:
// its gold-tinted light is all the eye sees, so the Even Shetiyah's bare rock reads pale against the gold)
const WB_ROOM = 0.45;
const WB_CLOSED = 0.9;
const lum3 = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

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

// perf-1: env's fixed passes (atmosphere LUTs, PMREM) are created and their programs issued at the start of the boot,
// while the world is built (main.js) — compiled synchronously at init they held env's init for ≈ 2 s on the HD 4600
let pre = null;
export function prewarm(ctx) {
  if (pre) return;
  const renderer = ctx.renderer;
  const qkey = ctx.quality?.key in TIERS ? ctx.quality.key : 'medium';
  const tier = TIERS[qkey];
  const luts = new AtmosphereLUTs(renderer, tier);
  const pmrem = new PMREMGenerator(renderer);
  pre = { qkey, luts, pmrem };
  // every pass renders into a target: compile against one (three keys programs by output colour space / tone mapping)
  const prev = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(luts.transRT);
    const s = new Scene();
    for (const m of [luts.transMat, luts.msMat, luts.skyMat, luts.statsMat]) {
      const q = new Mesh(luts.quad.geometry, m);
      q.frustumCulled = false;
      s.add(q);
    }
    renderer.compile(s, luts.cam);
    // the cube → cubeUV and GGX programs of this tier's environment size (PMREM private API of three r186: skipped if
    // it changes; fromCubemap then compiles them as before)
    // (compiled on a quad: three's own _compileMaterial uses an empty geometry, whose program key lacks the position
    // attribute, so the program it builds is never the one drawn)
    pmrem.compileCubemapShader();
    if (typeof pmrem._setSize === 'function' && typeof pmrem._allocateTargets === 'function') {
      pmrem._setSize(tier.envSize);
      pmrem._allocateTargets().dispose();
      const p = new Scene();
      const g = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(new Float32Array(9), 3));
      for (const m of [pmrem._cubemapMaterial, pmrem._ggxMaterial]) if (m) p.add(Object.assign(new Mesh(g, m), { frustumCulled: false }));
      renderer.compile(p, luts.cam);
    }
  } catch (e) {
    console.warn('[env] prewarm failed', e);
  } finally {
    renderer.setRenderTarget(prev);
  }
}

export async function init(ctx) {
  const { renderer, scene, camera } = ctx;
  const qkey = ctx.quality?.key in TIERS ? ctx.quality.key : 'medium';
  let tier = TIERS[qkey]; // replaced on 'quality:change' (applyTier)
  const warm = pre?.qkey === qkey ? pre : null;
  pre = null;
  installFogChunks();
  // three's PMREM shader triggers a benign ANGLE/D3D constant-folding warning (X4122) at our first compile;
  // render/ owns the idempotent filter for such logs (it should move to main.js boot — see report)
  try { (await import('../render/log-filter.js')).installShaderLogFilter?.(); } catch { /* optional */ }

  // ---------------------------------------------------------------- atmosphere LUTs
  const luts = warm?.luts || new AtmosphereLUTs(renderer, tier);
  luts.init();
  // per-source statistics: jumps and time-lapse need no GPU read-back (false → read back as before). perf-1: built
  // after the first view, a few altitudes a frame (until then the statistics are read back, as without a table)
  // perf-fix-1: started with the shader warm-up (main.js: 'ready' → programs linking → 'firstFrame'), when this thread and
  // the GPU idle while the programs link; landed before the first view, the boot meters from the table as before perf-1
  // (a forced refresh, as 'ready' did) — the reads after the first view also stuttered play (0.15–0.25 s each)
  let shown = false;
  ctx.bus.on('firstFrame', () => { shown = true; });
  ctx.bus.on('ready', () => {
    if (luts.table) return;
    luts.buildTableAsync().then((ok) => { if (ok && !shown) { st.force = true; st.envDirty = true; } });
  });
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
  const pmrem = warm?.pmrem || new PMREMGenerator(renderer);
  let pmremRT = null;

  // ---------------------------------------------------------------- interiors + scene probes (lighting-polish)
  let booted = false;
  let interiors = null;
  const off = (k) => ctx.params?.raw?.get?.(k) === '0';
  if (!off('interiors')) {
    try { interiors = createInteriors(ctx, { probes: qkey !== 'low' && !off('probes') }); } catch (e) { console.warn('[env] interior light unavailable', e); }
  }
  // a probe sees the sky dome, but not the Sun's or Moon's disc: the key light already brings their light (and
  // the GGX highlight that mirrors the disc); a captured disc would double it in every indirect term
  // Nor the stars and planets: point sprites a few texels wide on a 64² face, whose colours the PMREM blur smeared
  // into green / magenta blotches on night gold once the outdoor probes stopped holding fire light; their light is
  // already in the night-sky floor (NIGHT_SKY_L) of the dome (lighting-polish-fix)
  // `gain`: the capture's output gain (probes.js), which the dome applies through its output scale
  const withoutDiscs = (fn, gain = 1) => {
    const sd = skyU.uSunDiscScale.value, mr = skyU.uMoonRadiance.value.clone(), es = skyU.uEarthshine.value.clone();
    const sv = field.stars.visible, pv = field.planets.visible;
    const ls = skyU.uLutScale.value, os = skyU.uOutScale.value;
    skyU.uSunDiscScale.value = 0; skyU.uMoonRadiance.value.set(0, 0, 0); skyU.uEarthshine.value.set(0, 0, 0);
    skyU.uLutScale.value = ls * gain; skyU.uOutScale.value = os * gain;
    field.stars.visible = false; field.planets.visible = false;
    try { return fn(); } finally {
      skyU.uSunDiscScale.value = sd; skyU.uMoonRadiance.value.copy(mr); skyU.uEarthshine.value.copy(es);
      skyU.uLutScale.value = ls; skyU.uOutScale.value = os;
      field.stars.visible = sv; field.planets.visible = pv;
    }
  };
  const makeProbes = (t, key) => {
    if (!interiors || off('probes')) return null;
    try { return createProbes(ctx, { pmrem, cubeSize: t.envSize, tierKey: key, interiors, ready: booted, withoutDiscs }); } catch (e) {
      console.warn('[env] reflection probes unavailable', e);
      return null;
    }
  };
  let probes = makeProbes(tier, qkey);
  // render-env-2: a material marked userData.mkInterior = false (one that never appears inside a room) compiles the
  // room path of the interior patch out (MK_NO_ROOMS; the outdoor IBL, probes and fire occluders stay): set before the
  // first compile and once more on 'ready' for materials made later.
  const optedOut = new WeakSet();
  const optOut = (m, recompile) => {
    if (optedOut.has(m)) return;
    optedOut.add(m);
    m.defines = { ...(m.defines || {}), MK_NO_ROOMS: '' };
    if (recompile) m.needsUpdate = true;
  };
  const matsOf = (o) => (Array.isArray(o.material) ? o.material : o.material ? [o.material] : []).filter((m) => m?.isMeshStandardMaterial);
  const applyInteriorOptOut = (recompile) => {
    if (!interiors) return;
    scene.traverse((o) => { for (const m of matsOf(o)) if (m.userData?.mkInterior === false) optOut(m, recompile); });
  };
  applyInteriorOptOut(false);
  // where the surroundings band of the sky probe sits (court: enclosed by the 40-amah walls)
  const courtBoxes = [['azarah.wall.west', 'azarah.wall.east', 'azarah.wall.south', 'azarah.wall.north'], ['azarah.wall.east', 'en.wall.east', 'en.wall.south', 'en.wall.north']]
    .map(([w, e, s, n]) => [ctx.elOpt(w)?.box, ctx.elOpt(e)?.box, ctx.elOpt(s)?.box, ctx.elOpt(n)?.box])
    .filter((b) => b.every(Boolean)).map(([w, e, s, n]) => [w.min[0], e.max[0], s.min[1], n.max[1]]);
  const inCourt = (p) => {
    const X = p.x / ctx.units.AMAH, Y = -p.z / ctx.units.AMAH;
    return courtBoxes.some((b) => X > b[0] && X < b[1] && Y > b[2] && Y < b[3]);
  };

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
  // render-env-2-fix: PCF over 1.5 texels (three's 5 Vogel taps × radius): at 1 the 7.8 cm texels of the ±80 m map
  // showed as scallops along the shadows of the proud lintels and courses; at 2–3 the taps sampled the lit faces' own
  // depth and grained them (shadow-ab.mjs mr1 / mr2 / mr3, lintel-close-d1). A tighter map (±64 m) only moved them.
  key.shadow.radius = KEY_PCF_RADIUS;
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
    // the horizon band's radiance at 0, 45, 90, 135, 180° from the reference azimuth (physical, night floor included):
    // what the aerial perspective interpolates (fog.js mkFogA0..A4; qa-r2-fix-env-render)
    horizon5: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
    refDir: new Vector3(0, 1, 0),
    skyline: [1, 1, 1, 1, 1, 1, 1],
    snapFrames: 0,
    lutGi: 0, relut: false, refine: false, checkGround: false, lastStats: null,
  };
  const celestial = new Matrix3();
  const _prec = new Matrix3();
  const worldToGal = new Matrix3();
  const ncp = new Vector3();
  const tmp = new Vector3();
  const tmp2 = new Vector3();
  const lutSunE = new Vector3(), lutMoonE = new Vector3(), lutGround = new Vector3();
  // statistics table (lighting-polish-fix): sources of the current sky for luts.estimate
  const estSun = { alt: 0, az: 0, E: [0, 0, 0] }, estMoon = { alt: 0, az: 0, E: [0, 0, 0] };
  const estSources = [estSun, estMoon], estBuf = new Float32Array(32);
  const fireCol = new Color(1, 1, 1);  // the light colour of the fires in the camera's room
  // the world's extent (terrain built for the boot tier's draw distance): the haze is total there (HAZE_FROM)
  const drawDistance = ctx.quality?.drawDistance || 4000;
  const hazeFar = ctx.params?.raw?.get?.('farhaze') === '0' ? 0 : drawDistance;
  const roomCol = [1, 1, 1];          // the light the eye adapts to in the camera's room (luminance 1)
  const intEnv = [0, 0, 0];            // what rooms' openings show, per unit sky irradiance
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
  ctx.bus.on('ready', () => { booted = true; applyInteriorOptOut(true); if (!st.horizon) computeHorizonFromPhysics(); st.force = true; });
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
    if (nt.skyW !== old.skyW || nt.skyH !== old.skyH || nt.steps !== old.steps) { luts.resize(nt); luts.buildTable(); }
    if (nt.envSize !== old.envSize) {
      cubeRT.dispose();
      cubeRT = new WebGLCubeRenderTarget(nt.envSize, CUBE_OPTS);
      cubeCam.renderTarget = cubeRT;
      pmremRT?.dispose(); // fromCubemap reallocates at the new size (it never resizes a target it is given)
      pmremRT = null;
    }
    setSkyFeatures(skyMat, domeFeatures(nt));
    setSkyFeatures(envMat, envFeatures(nt));
    probes?.dispose();
    probes = makeProbes(nt, ctx.quality?.key in TIERS ? ctx.quality.key : 'medium');
    // the probe loop is compiled only where probes exist: recompile the lit materials when that changes
    if (interiors && setInteriorProbes(ShaderChunk, !!probes)) {
      scene.traverse((o) => {
        for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) if (m.isMeshStandardMaterial) m.needsUpdate = true;
      });
    }
    if (nt.stars !== old.stars || nt.magLimit !== old.magLimit) field.rebuild({ count: nt.stars, magLimit: nt.magLimit });
    field.uniforms.uTwinkle.value = nt.twinkle ? 1 : 0;
    // refill the resized LUT and PMREM now, so no frame samples a disposed target
    st.force = true; st.envDirty = true;
    update(0);
  }

  // ---------------------------------------------------------------- shadows (one function the render task can disable)
  const sBasisX = new Vector3(), sBasisY = new Vector3(), sCenter = new Vector3(), UP = new Vector3(0, 1, 0);
  // m, texels; the half-extent (m) with the Sun above 14° and the share of it the map reaches ahead of the viewer
  // (api._shadowTune: dev A/B)
  const shadowTune = { depth: 0.015, normal: 0.7, extent: 80, ahead: 0.35 };
  // perf-fix-1: while render/ caches the static casters' shadow depth (render/shadow-cache.js, setShadowHold) the framing
  // is kept until the light turns by more than HOLD_DEG, the extent changes by more than HOLD_R, or the ideal centre
  // drifts more than R / HOLD_STEP from it in any light-space axis (a step of the walk, a turn of the head): the map then
  // reaches R − R / 16 around the ideal centre instead of R, the light lags by ≤ 0.05°; a framing is computed as before
  const HOLD_DEG = 0.05, HOLD_R = 0.02, HOLD_STEP = 16;
  const held = { on: false, valid: false, dir: new Vector3(), R: 0, D: 0, size: 0, c: new Vector3(), bx: new Vector3(), by: new Vector3() };
  function updateShadowCamera(sunAltDeg) {
    if (!st.shadowsManaged || !key.castShadow) return;
    const R = MathUtils.lerp(shadowTune.extent, 220, smooth(14, 3, sunAltDeg)); // whole Mount when shadows are long
    const D = sunAltDeg < 14 ? 2600 : 700; // reach far enough toward a low Sun to catch the eastern ridge
    const size = key.shadow.mapSize.x;
    const texel = (2 * R) / size;
    const dir = st.keyDir;
    const fwd = tmp.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
    if (fwd.lengthSq() > 1e-6) fwd.normalize().multiplyScalar(R * shadowTune.ahead);
    if (held.on && held.valid && held.D === D && held.size === size && Math.abs(R / held.R - 1) < HOLD_R
      && held.dir.angleTo(dir) < HOLD_DEG * DEG) {
      const g = held.R / HOLD_STEP;
      const ideal = tmp2.copy(camera.position).add(fwd).sub(held.c);
      if (Math.abs(ideal.dot(held.bx)) <= g && Math.abs(ideal.dot(held.by)) <= g && Math.abs(ideal.dot(held.dir)) <= g) return;
    }
    // the shadow camera's basis (same as Object3D.lookAt with up = +y)
    sBasisX.crossVectors(UP, dir);
    if (sBasisX.lengthSq() < 1e-8) sBasisX.set(1, 0, 0);
    sBasisX.normalize();
    sBasisY.crossVectors(dir, sBasisX).normalize();
    sCenter.copy(camera.position).add(fwd);
    if (held.on) {
      held.valid = true; held.dir.copy(dir); held.R = R; held.D = D; held.size = size;
      held.c.copy(sCenter); held.bx.copy(sBasisX); held.by.copy(sBasisY);
    }
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
    // render-env-2: depth bias 4 → 1.5 cm and normal bias 1.2 → 0.7 texel (× 1 + tan θ in render/'s shadow chunk patch,
    // which also draws the casters' front faces into this map): an offset of more than a proud course's 8 cm lifted
    // the sample out from under it
    key.shadow.bias = -shadowTune.depth / (cam.far - cam.near);
    key.shadow.normalBias = texel * shadowTune.normal;
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
      probes?.copySky(pmremRT.texture);
    });
    // medium+: the atlas of [sky | scene probes] (interiors-glsl.js picks the slice per fragment)
    scene.environment = probes ? probes.texture : pmremRT.texture;
    interiors?.setEnvWidth(scene.environment.image?.width || 0);
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
    interiors?.update((v) => (v.probe && probes ? probes.coverage(v.probe) : 0)); // rooms a probe captures need no fill
    const ci = interiors?.camera;

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
    // fast-forward (time-lapse): the light changes by orders of magnitude between frames; the 1–2 frame latency
    // of the async read would expose dawn with the night's meter (white frames at 600×)
    const fast = !time.paused && Math.abs(time.speed) > 20;
    if (force || moved || st.relut) {
      const s = st.sunE0 / LUT_SCALE;
      const m = moonE0 / LUT_SCALE;
      const sunRules = sun.altitude > -14 || moon.altitude < 0;
      st.refIsSun = sunRules;
      st.refDir.copy(sunRules ? sun.dir : moon.dir);
      const refAz = sunRules ? sun.azimuth : moon.azimuth;
      // The LUT's ground term (below the horizon) is lit by the sky irradiance measured FROM this LUT. In continuous
      // play the previous measurement is a frame stale, but after a clock jump it is the other end of the day (a
      // day→night jump left daylight ground in a PMREM normalised by the night sky: a white-out). On a jump and in
      // a time-lapse the statistics come from the per-source table (luts.buildTable) — no GPU read-back, which
      // drained the frame (120–190 ms a jump) — and are refined by an async read once the clock runs normally.
      const useTable = !!luts.table && (force || fast || !luts.stats);
      let est = null;
      if (useTable) {
        const src = (d) => ({ alt: Math.asin(MathUtils.clamp(d.y, -1, 1)) / DEG, az: Math.atan2(d.x, -d.z) / DEG });
        estSun.E[0] = estSun.E[1] = estSun.E[2] = st.sunE0;
        Object.assign(estSun, src(sun.dir));
        Object.assign(estMoon, src(moon.dir));
        for (let c = 0; c < 3; c++) estMoon.E[c] = moonE0 * MOON_COLOR[c];
        est = luts.estimate(estSources, Math.atan2(st.refDir.x, -st.refDir.z) / DEG, estBuf);
      }
      const gi = ((est ? luminance(est) : st.skyIrr) + st.floorIrr) / LUT_SCALE;
      luts.updateSky({
        sunDir: sun.dir, sunE: lutSunE.set(s, s, s), moonDir: moon.dir,
        moonE: lutMoonE.set(m * MOON_COLOR[0], m * MOON_COLOR[1], m * MOON_COLOR[2]),
        groundIrr: lutGround.set(gi, gi, gi),
      });
      luts.runStats(refAz);
      st.lutSun.copy(sun.dir); st.lutMoon.copy(moon.dir); st.lutMoonE = moonE0;
      st.lutGi = gi * LUT_SCALE;
      st.relut = false;
      if (est) {
        luts.stats = Float32Array.from(est);
        luts.syncSerial = luts.statsSerial; // a read of an older pass still in flight is dropped
        st.refine = true;                   // measure this pass once the clock runs at normal speed
      } else if (!luts.stats || (fast && !luts.table)) {
        luts.readStatsSync();               // no table (fallback): the previous behaviour
      } else luts.readStatsAsync();
    } else if (st.refine && !fast && !luts.reading) {
      st.refine = false;
      st.checkGround = true;
      luts.readStatsAsync();
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
        [s0, s45, s90, s135, s180].forEach((sv, k) => { st.horizon5[k][c] = sv[c] + nf * nightFloor.horizon; });
      }
      // render-env-2-fix: the skyline profile — the dome's luminance at SKYLINE_ELS (azimuth-averaged, alpha of the stats)
      // over the horizon band's, floor included: what the far haze converges to (fog.js)
      const B = luminance(st.horizonMean), F = NIGHT_SKY_L * nightFloor.horizon;
      for (let i = 0; i < 7; i++) st.skyline[i] = MathUtils.clamp((S[i * 4 + 3] + F) / Math.max(B, 1e-12), 0.05, 2);
    }
    const Esky = st.skyIrr + st.floorIrr;
    // the measured sky differs from the one the LUT's ground term assumed (a table estimate, or a jump without the
    // table): re-run the LUT and the env map once with the measurement
    if (S && !fast && st.lutGi > 0 && Math.abs(Math.log(Esky / st.lutGi)) > 0.2 && (st.checkGround || !luts.table)) {
      st.relut = true; st.envDirty = true;
    }
    if (S !== st.lastStats) { st.lastStats = S; if (!st.refine) st.checkGround = false; }

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
    let La = Math.max((0.6 * SCENE_ALBEDO * (Edir + Esky) + 0.4 * Esky) / Math.PI, 1e-7);
    let fireShare = 0;
    if (ci && ci.s > 0) {
      // the room's fires: its surfaces' mean luminance from them as rendered (interiors.fireLuminance: the fires'
      // flux over the room's area, interreflected) × the log-average / mean ratio of a lamp-lit room — the same
      // quantity the probe meters (Kodesh at night: 0.011 estimated, 0.011 measured; lighting-polish-fix). It was
      // the illuminance at the camera, 3× the probe's value beside the Menorah and a pop when the probe's landed.
      try { ctx.fx?.illuminanceAt?.(camera.position, { sameVolume: true, rendered: true, color: fireCol }); } catch { /* colour only */ }
      const Lf = FIRE_LOG * (interiors.fireLuminance(ci.vol) || 0);
      // a gilded room passes the daylight from its openings on, bounce after bounce (the shader's gold gain)
      const gain = interiors.roomGain(ci.vol);
      const Lopen = La * (ci.raw ?? 1) * lum3(gain);
      const rp = probes?.roomProbe(ci.vol);
      // a probe that went stale (time-lapse) is faded toward the room's fallback light (openings + fire fill) in the
      // shader: meter the same blend (lighting-polish-fix)
      // the estimate, metered like the probe: the room as a whole (sky visibility at the eye) and the part in view
      // (at the walls the view ray meets: bright beside the great gate, dim at the far end), 0.6 / 0.4 in log
      const cdir = camera.getWorldDirection(tmp);
      const Vv = interiors.viewVisibility(ci.vol, camera.position, cdir);
      const Lview = Vv == null ? Lopen : La * Vv;
      const est = Math.exp(0.6 * Math.log(Math.max(Lopen + Lf, 1e-9)) + 0.4 * Math.log(Math.max(Lview + Lf, 1e-9)));
      const w = rp ? probes.coverage(rp.id) : 0;
      const Lroom = Math.max(w > 0 ? Math.exp(w * Math.log(Math.max(probes.roomLuminance(rp, camera.getWorldDirection(tmp)), 1e-9)) + (1 - w) * Math.log(est)) : est, 1e-9);
      const lo = Math.log(La);
      const leff = Lroom >= La ? Math.log(Lroom) : lo - Math.min(INTERIOR_ADAPT * (lo - Math.log(Lroom)), FAST_ADAPT_DECADES * Math.LN10);
      La = Math.max(Math.exp(lo + ci.s * (leff - lo)), 1e-7);
      fireShare = (ci.s * Lf) / Math.max(Lopen + Lf, 1e-12);
      // the room's light colour: measured by its probe (the mean colour of the capture), else the fires' and the
      // daylight's mix as the room's walls colour it
      const pc = rp && w > 0.5 ? rp.meanColor : null;
      if (pc) for (let c = 0; c < 3; c++) roomCol[c] = pc[c];
      else {
        const gl = lum3(gain), fc = [fireCol.r, fireCol.g, fireCol.b], fl = lum3(fc) || 1;
        const fs = Lf / Math.max(Lopen + Lf, 1e-12);
        for (let c = 0; c < 3; c++) roomCol[c] = (fs * fc[c] / fl + (1 - fs)) * gain[c] / gl;
      }
      // dev read-out (src/render/dev/room-jumps.mjs)
      const m = st.meter || (st.meter = { Lopen: 0, Lf: 0, Lroom: 0, probe: false });
      m.Lopen = Lopen; m.Lf = Lf; m.Lroom = Lroom; m.probe = !!rp;
      api._meter = m;
    } else api._meter = null;
    st.La = La;
    const lg = Math.log10(La);
    let keyV = keyFor(lg);
    keyV *= 1 - FIRE_GLARE * fireShare;
    const target = Math.log(keyV / La);
    // adaptation runs in real time (τ 0.7 s) AND sim time (τ 0.5 sim-min): at 1× the sim term is negligible; in a
    // 600× time-lapse twilight brightens ~1000× in 2.5 s and a real-time-only eye would overexpose dawn / crush dusk
    const simDt = Math.abs(time.frameDelta || 0);
    // a forced refresh (clock jump, boot) snaps for three frames: on the first, fx has not yet re-scheduled its
    // fires (lamps lit at night), which env meters inside rooms; fx snaps its fire adaptation alongside (adaptSnap).
    // In a room with a probe the snap holds until the post-jump capture's luminance has landed (≤ 0.6 s): the room
    // is metered from its openings and fires meanwhile (lighting-polish-fix: the eye otherwise adapted for seconds
    // from the previous time of day's measurement)
    if (force) st.snapFrames = 3;
    if (ci && ci.s > 0.5 && probes?.meterPending(ci.vol)) st.snapFrames = Math.max(st.snapFrames, 2);
    api.adaptSnap = st.snapFrames > 0; // fx snaps its fire adaptation with us
    const snapNow = st.snapFrames > 0 || !Number.isFinite(st.logP);
    const ease = snapNow ? 1 : 1 - Math.exp(-(dt / 0.7 + simDt / 0.5));
    if (snapNow) { st.logP = target; st.snapFrames--; }
    else st.logP += (target - st.logP) * ease;
    st.P = Math.exp(st.logP);
    // Partial chromatic (von Kries) adaptation toward the fires' colour when they light the room the eye is in: a
    // gilded room under 1900 K lamplight is warm gold to the eye, not the deep red its RGB product (gold × fire,
    // squared by interreflection) is — gain_c = ill_c^−k / lum(ill^(1−k)), luminance-preserving for the fires'
    // light (lighting-polish-fix). Applied in the tone-mapping step (render/: grade effect, direct-path chunk).
    {
      // degree: firelight in the room (WB_FIRE × its share) and the room's own colouring of daylight (WB_ROOM, up to
      // WB_CLOSED as its openings close)
      const inRoom = ci && ci.s > 0 ? ci.s : 0;
      const kDay = inRoom > 0 ? WB_ROOM + (WB_CLOSED - WB_ROOM) * (1 - interiors.openness(ci.vol)) : WB_ROOM;
      const kFire = ci?.vol?.gold ? WB_FIRE_GOLD : WB_FIRE;
      const k = inRoom * (kFire * Math.min(1, fireShare / Math.max(inRoom, 1e-6)) + kDay * (1 - Math.min(1, fireShare / Math.max(inRoom, 1e-6))));
      const l = luminance(roomCol);
      let g0 = 1, g1 = 1, g2 = 1;
      if (k > 1e-3 && l > 1e-6) {
        const ill = [roomCol[0] / l, roomCol[1] / l, roomCol[2] / l].map((v) => Math.max(v, 0.02));
        const n = luminance(ill.map((v) => v ** (1 - k)));
        [g0, g1, g2] = ill.map((v) => MathUtils.clamp(v ** -k / n, 0.25, 4));
      }
      const wb = api.whiteBalance;
      wb.set(wb.x + (g0 - wb.x) * ease, wb.y + (g1 - wb.y) * ease, wb.z + (g2 - wb.z) * ease);
      fogU.set('mkWBd', [wb.x - 1, wb.y - 1, wb.z - 1]);
    }
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
    // the J2000 catalogue precessed to the date (qa-r1-fix-env-render): world ← equator of date ← J2000
    if (Number.isFinite(time.ms)) celestial.multiply(precessionFromJ2000((time.ms / 86400000 + 2440587.5 - 2451545) / 36525, _prec));
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
    // the surroundings band (walls / colonnades): a vertical face sees ~45 % of the sky and half the lit ground;
    // the key light reaches the faces turned toward it (× cos of its altitude); its height by where the viewer is
    const wallTop = WALL_TOP[inCourt(camera.position) ? 'court' : 'open'];
    if (Math.abs(Math.asin(skyU.uWallShade.value.w || 0) / DEG - wallTop) > 0.5) st.envDirty = true;
    const Ev = 0.45 * Esky + 0.5 * luminance(LOCAL_ALBEDO) * Eg;
    const Ek = st.keyE * Math.sqrt(Math.max(0, 1 - st.keyDir.y * st.keyDir.y)) * vis * (st.keyDir.y > -0.02 ? 1 : 0);
    skyU.uWallShade.value.set(WALL_ALBEDO[0] * gt[0] * Ev / Math.PI, WALL_ALBEDO[1] * gt[1] * Ev / Math.PI, WALL_ALBEDO[2] * gt[2] * Ev / Math.PI, Math.sin(wallTop * DEG));
    const kc = key.color;
    skyU.uWallLit.value.set(WALL_ALBEDO[0] * kc.r * Ek / Math.PI, WALL_ALBEDO[1] * kc.g * Ek / Math.PI, WALL_ALBEDO[2] * kc.b * Ek / Math.PI);
    skyU.uWallKey.value.copy(st.keyDir);
    // interiors: what a room's openings show — the court's pavement under the global light, its walls (shaded, half
    // of them sunlit) and a little horizon sky — per unit sky irradiance (the shader scales by envMapIntensity)
    if (interiors) {
      const Edir = st.keyE * Math.max(st.keyDir.y, 0) * vis;
      const kcc = [kc.r, kc.g, kc.b];
      for (let c = 0; c < 3; c++) {
        const skyC = st.skyIrrRGB[c] + st.floorIrr * NIGHT_TINT[c];
        const ground = Edir * kcc[c] + skyC;
        const wall = 0.45 * skyC + 0.5 * LOCAL_ALBEDO[c] * ground + 0.5 * Ek * kcc[c];
        const stone = (WALL_ALBEDO[c] * gt[c] * (0.5 * ground + 0.5 * wall)) / Math.PI;
        intEnv[c] = (0.85 * stone + 0.15 * st.horizonMean[c]) / Math.max(Esky, 1e-12);
      }
      interiors.setIntEnv(intEnv, ROOM_ALBEDO);
    }

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
    // qa-r2-fix-env-render (ENV-R2-3): the five measured horizon samples themselves, not their 3-term Fourier synthesis
    // (fog.js): with the Sun just up, the sunward sample is many times the others, and the truncated series rang below
    // zero ≈ 100–120° from it — in red first: the far south-western ridges from Har HaMishchah hazed to violet under a
    // pure-blue crest while the sky above them was warm grey
    st.horizon5.forEach((v, k) => fogU.set(`mkFogA${k}`, v.map((x) => x * P)));
    fogU.set('mkFogRefDir', st.refDir.toArray());
    const rho = Math.exp(-ATMO.observerAltitude / ATMO.rayleighHeight);
    fogU.set('mkFogExtR', ATMO.rayleighScattering.map((v) => v * rho / 1000));
    const mieY0 = mie.ext[1] * Math.exp(-ATMO.observerAltitude / ATMO.mieHeight) / 1000;
    const zr = luminance(st.zenith) / Math.max(luminance(st.horizonMean), 1e-12);
    fogU.set('mkFogParams', [mieY0 * api.haze, 1 / (ATMO.mieHeight * 1000), MathUtils.clamp(zr, 0.15, 1), hazeFar]);
    const sk = st.skyline;
    fogU.set('mkFogSky0', [sk[0], sk[1], sk[2], sk[3]]);
    fogU.set('mkFogSky1', [sk[4], sk[5], sk[6], 1]);
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
    // the Sun's beam at normal incidence (lx, physical) and its colour (luminance 1), without the terrain horizon:
    // render/fx lights the nivreshet's glint with it, taking the horizon at the globe's own height (render-env-2-fix)
    const tl = luminance(st.Tsun);
    api.sunBeam = st.sunE0 * tl;
    if (tl > 1e-12) api.sunBeamColor.setRGB(st.Tsun[0] / tl, st.Tsun[1] / tl, st.Tsun[2] / tl);
    api.moonIlluminance = moonE0 * luminance(st.Tmoon) * st.moonVis;
    api.skyIrradiance = Esky;
    api.globalIlluminance = Eg; // lx on open horizontal ground: sun / moon beam + sky (probes normalise by it)
    api.sunTerrainVisibility = st.sunVis;
    api.keyIsMoon = st.keyIsMoon;
    api.sunDir.copy(sun.dir);
    api.moonDir.copy(moon.dir);
    api.keyDir.copy(st.keyDir);
    const fl = st.floorIrr;
    // inside a room the ambient (smoke, custom shaders near the viewer) is what comes through its openings
    const av = P * (ci ? ci.V : 1);
    api.ambient.sky.setRGB((st.skyIrrRGB[0] + fl * NIGHT_TINT[0]) * av, (st.skyIrrRGB[1] + fl * NIGHT_TINT[1]) * av, (st.skyIrrRGB[2] + fl * NIGHT_TINT[2]) * av);
    api.ambient.ground.setRGB(Eg * LOCAL_ALBEDO[0] * av, Eg * LOCAL_ALBEDO[1] * av, Eg * LOCAL_ALBEDO[2] * av);
    // sun / moon inside rooms: the shadow maps (medium+) or, without them, the rooms' sky visibility
    interiors?.setDirectAttenuation(key.castShadow || ctx.post?.shadows ? 0 : 1);
    // the key light reaches into a room only through its openings (interiors-glsl.js): where shadow maps draw the true
    // edge the mask keeps a slack round the opening; without them (low) it is the edge
    interiors?.setKey(st.keyDir, key.castShadow || ctx.post?.shadows ? 0.35 : 0.06);
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
    /** white-balance gains (rgb) the tone-mapping step applies: partial adaptation to firelight in rooms */
    whiteBalance: new Vector3(1, 1, 1),
    /** factor already applied to all env light; multiply physical fire/lamp/emissive values by it */
    preExposure: 1,
    physicalExposure: 1,
    luminance: 1,
    scotopic: 0,
    sunIlluminance: 0,
    /** the Sun's beam at normal incidence (lx, physical, no terrain horizon) and its colour (linear, luminance 1) */
    sunBeam: 0,
    sunBeamColor: new Color(1, 1, 1),
    moonIlluminance: 0,
    skyIrradiance: 0,
    globalIlluminance: 0,
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
     * Aerial perspective for custom shaders. `values` is live (FogUniforms): mkFogA0…A4 the horizon in-scatter at 0, 45,
     * 90, 135, 180° from mkFogRefDir's azimuth (scene units; fog.js interpolates them geometrically), mkFogExtR Rayleigh extinction rgb (1/m), mkFogParams
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
    /** perf-fix-1: keep the key light's shadow framing within small drifts (render/shadow-cache.js caches its static depth) */
    setShadowHold(on) { held.on = !!on; held.valid = false; },
    /**
     * perf-fix-2: point every linked program at env's fog uniforms and interiors block now (the boot's shader warm-up
     * calls it as programs link), so these synchronous per-program queries run in the warm-up's idle time, not in a frame
     */
    bindPrograms() { fogU.apply(); interiors?.apply(); },
    setHorizonProfile,
    horizonElevation: (az, y = camera.position.y) => horizonAngle(az, y),
    /** force a full refresh (LUT, stats, PMREM) on the next frame; pass true to do it now */
    update(now = false) { st.force = true; st.envDirty = true; if (now) update(0); },
    /**
     * perf-fix-1: issue the env pass's sky program as refreshEnvMap draws it (cube target, env's render state) for the
     * boot's shader warm-up (main.js); returns the Set of materials. It linked synchronously at its first use otherwise.
     */
    warmupMaterials() {
      let set = new Set();
      luts.withState(() => { renderer.setRenderTarget(cubeRT); set = renderer.compile(envScene, cubeCam.children[0]); });
      return set;
    },
    /** internal (dev scripts): the key light's shadow biases { depth (m), normal (texels) } */
    get _shadowTune() { return shadowTune; },
    /** internal (dev scripts): the atmosphere LUTs and the statistics table */
    get _luts() { return luts; },
    /** internal: time one update (ms); for profiling */
    _profile(force = false) {
      const gl = renderer.getContext();
      if (force) { st.force = true; st.envDirty = true; }
      const t0 = performance.now(); update(0.016); gl.finish(); return performance.now() - t0;
    },
    /** sky radiance toward a world direction in SCENE units (cd/m² × preExposure), from the measured stats */
    skyColorAt(dir, target = new Color()) {
      const H = st.horizon5;
      const h = Math.hypot(dir.x, dir.z), r = Math.hypot(st.refDir.x, st.refDir.z);
      const c = h > 1e-6 && r > 1e-6 ? (dir.x * st.refDir.x + dir.z * st.refDir.z) / (h * r) : 0;
      // as fog.js: geometric interpolation between the samples at 45° steps from the reference azimuth
      const u = Math.min(Math.acos(MathUtils.clamp(c, -1, 1)) / (Math.PI / 4), 3.9999), k = Math.floor(u), f = u - k;
      const w = Math.pow(MathUtils.clamp(dir.y, 0, 1), 0.6);
      const ch = (i) => (Math.exp(MathUtils.lerp(Math.log(Math.max(H[k][i], 1e-12)), Math.log(Math.max(H[k + 1][i], 1e-12)), f)) * (1 - w) + st.zenith[i] * w) * st.P;
      return target.setRGB(ch(0), ch(1), ch(2));
    },
    /** interior light: volumes, sky visibility, light occlusion (interiors.js); null if unavailable */
    get interiors() { return interiors; },
    /** scene reflection probes (probes.js, medium+); null on low */
    get probes() { return probes; },
    dispose() {
      probes?.dispose();
      luts.dispose(); pmrem.dispose(); cubeRT.dispose(); pmremRT?.dispose();
      skyMat.dispose(); envMat.dispose();
    },
  };
  ctx.env = api;
  ctx.engine.onUpdate((dt) => update(dt), PRIORITY.env);
  update(0); // first frame correct even before the loop starts (and for headless shots)
}

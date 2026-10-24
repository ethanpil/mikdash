// Post-processing chain for the medium/high/ultra tiers. Loaded on demand (dynamic import) so the low tier
// never downloads postprocessing + n8ao.
//   medium : RenderPass -> FX -> [heat shimmer + bloom + grade] -> SMAA
//   high   : RenderPass -> N8AO (half-res) -> FX -> [heat shimmer + bloom + grade] -> SMAA
//   ultra  : RenderPass -> N8AO (full-res) -> FX -> sun shafts -> [heat shimmer + bloom + grade + vignette] -> SMAA
import { HalfFloatType, Vector2, Vector3, Color, MathUtils, Uniform } from 'three';
import {
  EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode, SMAAEffect,
  SMAAPreset, VignetteEffect, BlendFunction, Effect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { FXPass } from './fx-pass.js';
import { SkyMaskedBloom, SunShaftsEffect, HeatHazeEffect } from './post-effects.js';
import { getNoiseTexture } from './fx/noise.js';
import { sunDir, sunAltitude, envDirLights } from './env-link.js';

// Thresholds are DISPLAY-relative (divided by the tone-mapping exposure each frame); the prefilter keeps only
// the energy above the threshold (soft knee), clamped to `clamp` × threshold.
// spark: the clamp of an isolated sub-3-px highlight (render-env-2), × threshold
const BLOOM = {
  medium: { intensity: 0.75, radius: 0.62, levels: 6, threshold: 1.3, knee: 0.6, clamp: 4, spark: 120 },
  high: { intensity: 0.8, radius: 0.7, levels: 7, threshold: 1.3, knee: 0.6, clamp: 4, spark: 120 },
  ultra: { intensity: 0.85, radius: 0.75, levels: 8, threshold: 1.3, knee: 0.6, clamp: 4, spark: 120 },
};
const DISC_DEG = 0.6;    // key-light glint radius fed to bloom (the solar disc is 0.27°)
// qa-r1-fix-env-render: inside a roofed room (env interiors), a doorway or the Ulam's opening onto the sunlit court is
// 50–100× the room's adaptation: the broad-area clamp and the intensity are lowered there by these shares, so the
// opening's glare stays a rim instead of washing the gold walls and the floor white (sparks and flames keep theirs)
const BLOOM_INDOOR = { clamp: 0.65, intensity: 0.4 };
// qa-r2-fix-env-render (ENV-R2-4b): at night the bloom source of a LIT SURFACE (not a flame, ember or glow — the emitter
// mask in the buffer's alpha, render/fx-pass.js — nor the sky) is clamped at this × threshold, against the broad clamp
// (4×) and the spark clamp (120×) that emitters keep. The Nikanor gateway's upper courses, lit by the altar's fire past the
// altar's corner while the viewer stands in its shadow, are far above the dark-adapted exposure: with the emitters' clamp
// their glow drew the courses' edges as orange neon tubes (the eye's own glare round a 25 cd/m² wall is ~1 % of it at
// 1°). By day lit surfaces keep it: sun glints on gold and bronze are what the spark clamp is for. Faded in as the Sun
// sets from +2° to −4°.
const BLOOM_SURFACE_NIGHT = 1.0;
// sun shafts: added in-scatter at the sun direction (display-relative, × key-light colour), two phase lobes
const SHAFT_PEAK = 0.9;     // at the sun, fully open path, low sun
const SHAFT_NARROW = 4;     // narrow forward-scattering lobe, degrees
const SHAFT_BROAD = 20;     // broad lobe, degrees
const SHAFT_BROAD_W = 0.3;
const SHAFT_DESAT = 0.4;    // haze in-scatter is paler than the reddened direct sun
const DEG = Math.PI / 180;

const _sun = new Vector3();
const _ndc = new Vector3();
const _fwd = new Vector3();
const _disc = new Vector3();
const _sunView = new Vector3();
const _upView = new Vector3();
const _col = new Vector3();
const _white = new Vector3();
const _ins = { V: 1, vol: null, s: 0 };
const _shaft = { color: _col, narrow: SHAFT_NARROW * Math.PI / 180, broad: SHAFT_BROAD * Math.PI / 180, broadWeight: SHAFT_BROAD_W, sunView: _sunView, upView: _upView, camera: null };

/**
 * Same curve as the direct path's CustomToneMapping (see tonemap.js); exposure = renderer.toneMappingExposure;
 * `wb` = env's white-balance gains (partial adaptation to firelight in rooms), as the direct path's mkWBd.
 */
class MikdashGradeEffect extends Effect {
  constructor() {
    super('MikdashGradeEffect', /* glsl */`
#include <tonemapping_pars_fragment>
uniform vec3 wb;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(mikdashAgX(inputColor.rgb * wb), inputColor.a);
}`, { blendFunction: BlendFunction.SRC, uniforms: new Map([['wb', new Uniform(new Vector3(1, 1, 1))]]) });
  }
}

export function buildPost(ctx, fx, quality, toneMapper, prepass = null) {
  const { renderer: r, scene, camera } = ctx;
  const composer = new EffectComposer(r, { frameBufferType: HalfFloatType, multisampling: 0, stencilBuffer: false });
  const scenePass = new RenderPass(scene, camera);
  if (prepass) {
    // perf-1: the opaque world's depth first (render/prepass.js), right after the pass's clear; the scene keeps it
    const draw = scenePass.render.bind(scenePass);
    scenePass.render = (renderer, inputBuffer, outputBuffer, dt, stencil) => {
      if (!prepass.enabled) { draw(renderer, inputBuffer, outputBuffer, dt, stencil); return; }
      const clear = scenePass.clearPass.enabled;
      if (clear) scenePass.clearPass.render(renderer, inputBuffer);
      renderer.setRenderTarget(scenePass.renderToScreen ? null : inputBuffer);
      scenePass.clearPass.enabled = false;
      try {
        prepass.drawScene(renderer, scene, camera, () => draw(renderer, inputBuffer, outputBuffer, dt, stencil));
      } finally { scenePass.clearPass.enabled = clear; }
    };
  }
  composer.addPass(scenePass);
  const db = r.getDrawingBufferSize(new Vector2());
  const out = { composer, ao: null, bloom: null, shafts: null, shaftPass: null, haze: null };

  if (quality.ao) {
    const ao = new N8AOPostPass(scene, camera, db.x, db.y);
    const ultra = quality.key === 'ultra';
    ao.setQualityMode(ultra ? 'High' : 'Medium');
    const c = ao.configuration;
    c.transparencyAware = false;    // FX are drawn after AO; avoids per-frame scene traversal + double draws
    c.gammaCorrection = false;      // not the last pass
    c.screenSpaceRadius = false;
    c.halfRes = !ultra;
    c.aoRadius = ultra ? 2.4 : 2.0; // metres: steps, column bases, wall/floor junctions
    c.distanceFalloff = 1.0;
    c.intensity = ultra ? 2.6 : 2.3;
    c.color = new Color(0x120d08);  // warm-dark: bounce light off limestone/marble is warm
    out.ao = ao;
    composer.addPass(ao);
  }

  const fxPass = new FXPass(fx, camera);
  composer.addPass(fxPass); // creates the composer's stable depth texture (needsDepthTexture)
  const depth = fxPass.getDepthTexture();

  if (quality.godrays) {
    out.shafts = new SunShaftsEffect({ samples: 64, resolutionScale: 0.5 });
    out.shafts.setDepthTexture(depth);
    out.shaftPass = new EffectPass(camera, out.shafts);
    composer.addPass(out.shaftPass);
  }

  const effects = [];
  // qa-r1-fix-env-render: the heat shimmer over the large fires (a UV transform: merged into this pass, no extra one)
  out.haze = new HeatHazeEffect(getNoiseTexture());
  out.haze.setDepthTexture(depth);
  effects.push(out.haze);
  const bp = BLOOM[quality.key] || BLOOM.medium;
  if (quality.bloom) {
    out.bloom = new SkyMaskedBloom({ mipmapBlur: true, intensity: bp.intensity, radius: bp.radius, levels: bp.levels });
    out.bloom.setDepthTexture(depth);
    effects.push(out.bloom);
  }
  if (toneMapper === 'grade') out.grade = new MikdashGradeEffect();
  effects.push(out.grade || new ToneMappingEffect({ mode: ToneMappingMode[toneMapper] }));
  if (quality.key === 'ultra') effects.push(new VignetteEffect({ offset: 0.3, darkness: 0.38 }));
  const grade = new EffectPass(camera, ...effects);
  composer.addPass(grade);
  if (quality.aa === 'smaa') {
    const aaPass = new EffectPass(camera, new SMAAEffect({ preset: quality.key === 'ultra' ? SMAAPreset.ULTRA : SMAAPreset.HIGH }));
    aaPass.dithering = true;
    composer.addPass(aaPass);
  } else {
    grade.dithering = true;
  }
  // effects added after the FX pass also received the depth texture from the composer; make sure ours did
  out.bloom?.setDepthTexture(depth);
  out.shafts?.setDepthTexture(depth);
  out.haze?.setDepthTexture(depth);

  return {
    ...out,
    /** per frame: exposure-relative bloom prefilter, key-light glint disc, sun shafts */
    update(ex) {
      camera.updateMatrixWorld(); // the player moved it this frame; render() would only refresh it later
      const aspect = camera.aspect || 1;
      const tanHalf = Math.tan((camera.fov * DEG) / 2) || 1;
      if (out.bloom) {
        const env = ctx.env || {};
        if (env.keyDir?.isVector3) _sun.copy(env.keyDir); else sunDir(ctx, _sun); // sun by day, moon by night
        screenUv(camera, _sun, _disc);
        const t = bp.threshold / ex;
        const ins = env.interiors?.at ? env.interiors.at(camera.position, _ins).s || 0 : 0;
        const broad = bp.clamp * (1 - BLOOM_INDOOR.clamp * ins) * t;
        const night = MathUtils.clamp((2 - sunAltitude(ctx)) / 6, 0, 1);
        out.bloom.setPrefilter(t, bp.knee * t, broad, _disc, Math.tan(DISC_DEG * DEG) / (2 * tanHalf), aspect, bp.spark * t,
          night > 0 ? MathUtils.lerp(broad, Math.min(broad, BLOOM_SURFACE_NIGHT * t), night) : null);
        out.bloom.intensity = bp.intensity * (1 - BLOOM_INDOOR.intensity * ins);
      }
      if (out.shafts) updateShafts(ctx, out, ex);
      if (out.haze) out.haze.setSources(ctx.fx?.haze, ctx.fx?.time || 0, camera);
      const wb = ctx.env?.whiteBalance;
      if (out.grade && wb?.isVector3) out.grade.uniforms.get('wb').value.copy(wb);
    },
    render(dt) { composer.render(dt); },
    /**
     * perf-1: the passes' own materials (and their effects' inner passes'), each with whether it draws onto the canvas,
     * for render/warmup.js to compile in parallel before the first frame instead of one after another inside it
     */
    warmupMaterials() {
      const out = new Map();
      const geo = new Map(); // perf-fix-1: a material drawn by a pass's own mesh compiles on that mesh's geometry
      const seen = new Set();
      const walk = (o, toScreen, depth) => {
        if (!o || typeof o !== 'object' || seen.has(o) || depth > 4) return;
        seen.add(o);
        if (o.isMaterial) { if (!out.has(o)) out.set(o, toScreen); return; }
        const fm = o.fullscreenMaterial; // a pass's material is a getter (its screen mesh's)
        if (fm?.isMaterial && !out.has(fm)) out.set(fm, !!o.renderToScreen);
        // perf-fix-1: a pass's own full-screen mesh (N8AO's FullScreenTriangle quads keep theirs in `_mesh`): its
        // material was missed (the walk stops at objects), and N8AO's AO / denoise / compositer programs (≈ 2 s on high)
        // linked in the first frame. Parentless only: a mesh in a scene (FX) is compiled with its scene
        if (o.isMesh && !o.parent && o.material?.isMaterial && !out.has(o.material)) { out.set(o.material, toScreen); geo.set(o.material, o.geometry); }
        if (o.isObject3D || o.isTexture || o.isWebGLRenderTarget || o.isWebGLRenderer || o.isBufferGeometry || ArrayBuffer.isView(o)) return;
        const vals = o instanceof Map ? [...o.values()] : Array.isArray(o) ? o : Object.values(o);
        for (const v of vals) walk(v, toScreen, depth + 1);
      };
      for (const p of composer.passes) {
        if (p.fullscreenMaterial) out.set(p.fullscreenMaterial, !!p.renderToScreen);
        walk(p, false, 0);
      }
      return [...out].map(([material, toScreen]) => ({ material, toScreen, geometry: geo.get(material) || composer.passes[0]?.screen?.geometry || null }));
    },
    setSize(w, h) { composer.setSize(w, h, false); },
    dispose() { composer.dispose(); },
  };
}

/** uv of a world direction on screen; z = 1 when in front of the camera (else 0). */
function screenUv(camera, dir, target) {
  camera.getWorldDirection(_fwd);
  _ndc.copy(camera.position).add(dir).project(camera);
  return target.set(_ndc.x * 0.5 + 0.5, _ndc.y * 0.5 + 0.5, _fwd.dot(dir) > 0.05 ? 1 : 0);
}

function updateShafts(ctx, out, ex) {
  const { camera } = ctx;
  sunDir(ctx, _sun);
  const alt = sunAltitude(ctx);
  screenUv(camera, _sun, _disc);
  const onScreen = _disc.z > 0 && Math.abs(_disc.x - 0.5) < 0.9 && Math.abs(_disc.y - 0.5) < 0.9;
  // strongest with a low sun (long hazy light path at dawn/dusk), weaker toward noon, none at night
  const k = MathUtils.clamp((alt + 1.5) / 3, 0, 1) * (1 - 0.6 * MathUtils.clamp((alt - 10) / 35, 0, 1));
  out.shaftPass.enabled = onScreen && k > 0.01;
  if (!out.shaftPass.enabled) return;
  out.shafts.sunUv.set(_disc.x, _disc.y);
  _sunView.copy(_sun).transformDirection(camera.matrixWorldInverse);
  _upView.set(0, 1, 0).transformDirection(camera.matrixWorldInverse);
  // source colour = the sun's (key light) colour, luminance-normalised, display-relative peak
  const c = envDirLights(ctx)[0]?.color;
  if (c) _col.set(c.r, c.g, c.b); else _col.set(1, 0.9, 0.75);
  let y = 0.2126 * _col.x + 0.7152 * _col.y + 0.0722 * _col.z;
  _col.lerp(_white.set(y, y, y), SHAFT_DESAT);
  y = 0.2126 * _col.x + 0.7152 * _col.y + 0.0722 * _col.z;
  _col.multiplyScalar((SHAFT_PEAK * k) / ex / Math.max(y, 1e-4));
  _shaft.camera = camera;
  out.shafts.setParams(_shaft);
}

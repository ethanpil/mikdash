// Post-processing chain for the medium/high/ultra tiers. Loaded on demand (dynamic import) so the low tier
// never downloads postprocessing + n8ao.
//   medium : RenderPass -> FX -> [bloom + grade] -> SMAA
//   high   : RenderPass -> N8AO (half-res) -> FX -> [bloom + grade] -> SMAA
//   ultra  : RenderPass -> N8AO (full-res) -> FX -> sun shafts -> [bloom + grade + vignette] -> SMAA
import { HalfFloatType, Vector2, Vector3, Color, MathUtils, Uniform } from 'three';
import {
  EffectComposer, RenderPass, EffectPass, ToneMappingEffect, ToneMappingMode, SMAAEffect,
  SMAAPreset, VignetteEffect, BlendFunction, Effect,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { FXPass } from './fx-pass.js';
import { SkyMaskedBloom, SunShaftsEffect } from './post-effects.js';
import { sunDir, sunAltitude, envDirLights } from './env-link.js';

// Thresholds are DISPLAY-relative (divided by the tone-mapping exposure each frame); the prefilter keeps only
// the energy above the threshold (soft knee), clamped to `clamp` × threshold.
const BLOOM = {
  medium: { intensity: 0.75, radius: 0.62, levels: 6, threshold: 1.3, knee: 0.6, clamp: 4 },
  high: { intensity: 0.8, radius: 0.7, levels: 7, threshold: 1.3, knee: 0.6, clamp: 4 },
  ultra: { intensity: 0.85, radius: 0.75, levels: 8, threshold: 1.3, knee: 0.6, clamp: 4 },
};
const DISC_DEG = 0.6;    // key-light glint radius fed to bloom (the solar disc is 0.27°)
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

export function buildPost(ctx, fx, quality, toneMapper) {
  const { renderer: r, scene, camera } = ctx;
  const composer = new EffectComposer(r, { frameBufferType: HalfFloatType, multisampling: 0, stencilBuffer: false });
  composer.addPass(new RenderPass(scene, camera));
  const db = r.getDrawingBufferSize(new Vector2());
  const out = { composer, ao: null, bloom: null, shafts: null, shaftPass: null };

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
        out.bloom.setPrefilter(t, bp.knee * t, bp.clamp * t, _disc, Math.tan(DISC_DEG * DEG) / (2 * tanHalf), aspect);
      }
      if (out.shafts) updateShafts(ctx, out, ex);
      const wb = ctx.env?.whiteBalance;
      if (out.grade && wb?.isVector3) out.grade.uniforms.get('wb').value.copy(wb);
    },
    render(dt) { composer.render(dt); },
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

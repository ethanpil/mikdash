// render/ — tiered frame pipeline, cascaded sun shadows, adaptive resolution and fire/smoke FX.
// Sets ctx.post (pipeline + stats) and ctx.fx (fires, torches, smoke). See ARCHITECTURE.md §7 and
// docs/decisions/render.md.
import { PCFShadowMap } from 'three';
import { PRIORITY } from '../core/engine.js';
import { createFx } from './fx/index.js';
import { installFireFalloffChunk } from './fx/lights.js';
import { Pipeline, TONE_MAPPERS } from './pipeline.js';
import { SunShadows, installCascadeBiasChunk } from './shadows.js';
import { AdaptiveResolution } from './adaptive.js';
import { detectDevice, isMobile } from './detect.js';
import { installShaderLogFilter } from './log-filter.js';
import { setFrameLights, warmHidden } from './warmup.js';
import { KeyShadowCache } from './shadow-cache.js';

export async function init(ctx) {
  const { engine, renderer } = ctx;
  // r186 removed PCFSoftShadowMap (it warns and falls back); PCF now does 5 Vogel-disk hardware-PCF taps.
  renderer.shadowMap.type = PCFShadowMap;
  // sun / moon shadow casters' front faces + slope-scaled normal offset (medium's env key light, high / ultra cascades)
  installCascadeBiasChunk();
  // fire lights soften within their flames' radius (render/fx/lights.js, qa-r1-fix-env-render)
  installFireFalloffChunk();
  // count the whole frame (composer passes + FX), not just the last render() call
  renderer.info.autoReset = false;

  const fx = createFx(ctx, { tier: ctx.quality.key, soft: !!ctx.quality.post });
  ctx.fx = fx;
  const pipeline = new Pipeline(ctx, fx);
  let shadows = null;
  let shadowCache = null; // perf-fix-1: medium's key-light shadow, static casters cached (render/shadow-cache.js)
  const stats = { fps: 60, ms: 16.7, scale: 1, calls: 0, triangles: 0, tier: ctx.quality.key, mode: 'direct' };

  const size = () => ({
    w: ctx.renderer.domElement.clientWidth || globalThis.innerWidth,
    h: ctx.renderer.domElement.clientHeight || globalThis.innerHeight,
  });
  function applyScale(s) {
    renderer.setPixelRatio(engine.pixelRatio * s);
    const { w, h } = size();
    pipeline.setSize(w, h);
    stats.scale = s;
  }
  const fixed = ctx.params.shot || ctx.params.raw?.get?.('fixedres') === '1';
  const adaptive = new AdaptiveResolution({ target: isMobile() ? 30 : 55, enabled: !fixed, onChange: applyScale });

  let building = Promise.resolve();
  async function configure(q) {
    shadows?.dispose();
    shadows = null;
    shadowCache?.dispose();
    shadowCache = null;
    renderer.shadowMap.enabled = !!q.shadows;
    if (q.shadows && (q.cascades || 1) > 1) {
      try { shadows = new SunShadows(ctx, q.key); } catch (e) { console.error('[render] cascaded shadows unavailable', e); }
    } else if (q.shadows) {
      try { shadowCache = new KeyShadowCache(ctx); } catch (e) { console.error('[render] key shadow cache unavailable', e); }
    }
    fx.setMode({ tier: q.key, soft: !!q.post });
    try {
      await pipeline.build(q);
    } catch (e) {
      console.error('[render] post pipeline failed — falling back to direct rendering', e);
      await pipeline.build({ ...q, post: false });
      fx.setMode({ tier: q.key, soft: false });
    }
    stats.tier = q.key;
    stats.mode = pipeline.mode;
    applyScale(adaptive.scale);
  }
  installShaderLogFilter();
  // perf-fix-1: shader warm-ups (render/warmup.js) compile with the frame's light state (the cascades' borrow)
  setFrameLights((fn) => (shadows ? shadows.withFrameLights(fn) : fn()));
  await configure(ctx.quality);

  engine.onResize((w, h, pr) => {
    renderer.setPixelRatio(pr * adaptive.scale);
    pipeline.setSize(w, h);
  });
  engine.onUpdate((dt) => fx.update(dt), PRIORITY.fx);
  // qa-r1-fix-env-render (ENV-5): after the first view, warm what the boot could not see (hidden meshes, the plain
  // program of lazily made ones) in idle slices — render/warmup.js warmHidden
  let hiddenWarm = null;
  ctx.bus.on('firstFrame', () => { if (!hiddenWarm && ctx.params?.raw?.get?.('warmhidden') !== '0') hiddenWarm = warmHidden(ctx); });
  ctx.bus.on('time:jump', () => fx.snap());
  ctx.bus.on('quality:change', () => {
    if (engine.quality !== ctx.quality) engine.configure(ctx.quality);
    building = building.then(() => configure(ctx.quality));
  });

  let last = performance.now();
  let errored = false;
  let probeErrored = false;
  engine.setRenderFn((dt) => {
    const now = performance.now();
    adaptive.sample((now - last) / 1000);
    last = now;
    renderer.info.reset();
    pipeline.updateFrame();
    shadows?.beforeRender();
    ensureShadowMaps(ctx, shadows); // after beforeRender: it decides this frame's shadow autoUpdate
    try {
      // scene reflection probes (env, medium+): rare captures, lit exactly like this frame
      ctx.env?.probes?.render(dt);
    } catch (e) {
      if (!probeErrored) console.error('[render] probe capture failed', e);
      probeErrored = true;
    }
    // interior light uniforms: fx placed its lights after env's update, assign them to their rooms now
    ctx.env?.interiors?.beforeRender(fx.pointLights());
    try {
      pipeline.render(dt);
    } catch (e) {
      if (!errored) console.error('[render] frame failed', e);
      errored = true;
    } finally {
      shadows?.afterRender();
    }
    stats.fps = Math.round(adaptive.fps * 10) / 10;
    stats.ms = Math.round(adaptive.ms * 100) / 100;
    stats.calls = renderer.info.render.calls;
    stats.triangles = renderer.info.render.triangles;
    if (overlay) overlay.update();
  });

  const overlay = ctx.params.debug?.has?.('stats') && !ctx.params.shot ? makeOverlay(ctx, stats, fx) : null;

  ctx.post = {
    pipeline,
    stats,
    get composer() { return pipeline.composer; },
    get shadows() { return shadows; },
    /** perf-fix-1: medium's key-light shadow cache ({ enabled, stats }) or null */
    get shadowCache() { return shadowCache; },
    get toneMapper() { return pipeline.toneMapper; },
    /** final tone-mapping exposure (env.exposure × operator parity gain) */
    get exposureTotal() { return pipeline.exposureTotal; },
    /** local eye adaptation of fire light/emission (on by default); turn off if env meters fire light itself */
    setFireAdaptation(on) { fx.setAdaptation(on); },
    /** 'agx' | 'aces' | 'neutral' — rebuilds the pipeline */
    setToneMapper(key) {
      if (!TONE_MAPPERS[key]) return Promise.resolve();
      pipeline.toneMapper = key;
      building = building.then(() => configure(ctx.quality));
      return building;
    },
    get scale() { return adaptive.scale; },
    /** force a render scale (0.5..1); pass null to resume adaptive control */
    setScale(s) {
      if (s == null) { adaptive.enabled = !fixed; return; }
      adaptive.enabled = false;
      adaptive.set(s);
    },
    adaptive,
    /** the post-boot warm-up of hidden objects ({ queued, issued, programs }; null before the first frame) */
    get hiddenWarm() { return hiddenWarm; },
    /** GPU string + micro-benchmark tier suggestion (cached per GPU) */
    detect: () => detectDevice(renderer),
    rebuild: () => (building = building.then(() => configure(ctx.quality))),
  };
}

function makeOverlay(ctx, stats, fx) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:40;font:11px/1.35 ui-monospace,monospace;'
    + 'color:#e8dcc0;background:rgba(13,11,8,.72);padding:6px 8px;border-radius:4px;pointer-events:none;white-space:pre';
  document.body.appendChild(el);
  let t = 0;
  return {
    update() {
      const now = performance.now();
      if (now - t < 250) return;
      t = now;
      const s = fx.stats;
      el.textContent = `${stats.tier} ${stats.mode}  ${stats.fps.toFixed(0)} fps  ${stats.ms.toFixed(1)} ms  scale ${stats.scale.toFixed(1)}\n`
        + `calls ${stats.calls}  tris ${(stats.triangles / 1000).toFixed(0)}k\n`
        + `fires ${s.fires}  lights ${s.lights}/${s.maxLights}  puffs ${s.puffs}`;
    },
  };
}

/**
 * A shadow-casting light whose map was never rendered (shadow.autoUpdate=false from the first frame, e.g. env's
 * key light at night) leaves its sampler2DShadow bound to a non-depth texture; Chrome then rejects every lit draw
 * (GL_INVALID_OPERATION: sampler type mismatch) and geometry vanishes. Force one shadow render for such lights.
 */
function ensureShadowMaps(ctx, shadows) {
  if (!ctx.renderer.shadowMap.enabled) return;
  const env = ctx.env || {};
  for (const l of [env.keyLight || env.sunLight, env.moonLight, shadows?.light]) {
    if (l?.castShadow && l.shadow && !l.shadow.map && !l.shadow.autoUpdate) l.shadow.needsUpdate = true;
  }
}

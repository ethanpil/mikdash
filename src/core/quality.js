// Quality tiers. ctx.quality is one of these objects (a copy), chosen by URL ?q=, saved setting, or auto-detect.
// Subsystems READ these knobs; they never hard-code device assumptions.
//
// Capability flags (lowend-visuals; docs/decisions/lowend-visuals.md):
//   shadows    false | 'static' (the key light's map holds the static world only, re-rendered when the light's framing, a
//              caster or a door changes; figures keep their contact shadows) | 'cached' (static world cached, figures
//              drawn every frame: render/shadow-cache.js) | 'cascaded' (two view-fitted sun cascades: render/shadows.js)
//   shadowFilter 'pcf1' (one hardware 2 × 2 compare per lookup) | 'pcf5' (three's 5-tap Vogel disk): render/shadows.js
//   aa         'none' | 'fxaa' (one pass over the finished frame: render/fxaa.js) | 'smaa' (post pipeline)
//   ao         false | 'volume' (env's load-time visibility volume: env/visibility.js) | 'n8ao' (screen space, post)
//   interiors  'volume' (room sky visibility from the visibility volume) | 'exact' (per-pixel room and aperture loop)
import { detectTier } from '../render/detect.js';
// The render/ owner may refine autoDetect() and add knobs; keep existing keys stable.

export const TIERS = {
  low: {
    key: 'low', label: 'Low — phones & integrated graphics',
    pixelRatioCap: 1.0, renderScale: 0.8,
    shadows: 'static', shadowFilter: 'pcf1', shadowMapSize: 2048, cascades: 1,
    post: false, ao: 'volume', interiors: 'volume', bloom: false, aa: 'fxaa', godrays: false,
    textureSize: 512, anisotropy: 2, detail: 0,
    maxFigures: 60, maxFireLights: 2, terrainSegments: 96, drawDistance: 2500,
  },
  medium: {
    key: 'medium', label: 'Medium — balanced',
    pixelRatioCap: 1.25, renderScale: 1.0,
    shadows: 'cached', shadowFilter: 'pcf5', shadowMapSize: 2048, cascades: 1,
    post: true, ao: 'volume', interiors: 'volume', bloom: true, aa: 'smaa', godrays: false,
    textureSize: 1024, anisotropy: 4, detail: 1,
    maxFigures: 180, maxFireLights: 4, terrainSegments: 192, drawDistance: 4000,
  },
  high: {
    key: 'high', label: 'High — discrete GPU',
    pixelRatioCap: 1.5, renderScale: 1.0,
    shadows: 'cascaded', shadowFilter: 'pcf5', shadowMapSize: 4096, cascades: 2,
    post: true, ao: 'n8ao', interiors: 'exact', bloom: true, aa: 'smaa', godrays: false,
    textureSize: 2048, anisotropy: 8, detail: 2,
    maxFigures: 450, maxFireLights: 8, terrainSegments: 320, drawDistance: 6000,
  },
  ultra: {
    key: 'ultra', label: 'Ultra — maximum realism',
    pixelRatioCap: 2.0, renderScale: 1.0,
    shadows: 'cascaded', shadowFilter: 'pcf5', shadowMapSize: 4096, cascades: 2,
    post: true, ao: 'n8ao', interiors: 'exact', bloom: true, aa: 'smaa', godrays: true,
    textureSize: 2048, anisotropy: 16, detail: 3,
    maxFigures: 1200, maxFireLights: 12, terrainSegments: 512, drawDistance: 8000,
  },
};

export const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];

/** do figures (people, animals, their props) cast into the key light's shadow map? Not with 'static' maps */
export const figuresCastShadows = (q) => q?.shadows === 'cached' || q?.shadows === 'cascaded';

/** GPU/device classification — delegated to render/detect.js (GPU string + cached micro-benchmark). */
export function autoDetect(renderer) {
  try { const k = detectTier(renderer); if (TIERS[k]) return k; } catch (e) { console.warn('[quality] detectTier failed', e); }
  return legacyDetect(renderer);
}

function legacyDetect(renderer) {
  const nav = globalThis.navigator || {};
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '');
  let gpu = '';
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch { /* ignore */ }
  const g = String(gpu).toLowerCase();
  if (/swiftshader|llvmpipe|software/.test(g)) return 'low';
  if (mobile) return /apple gpu|adreno \(tm\) (7|8)\d\d|mali-g7\d\d/.test(g) ? 'medium' : 'low';
  if (/rtx|radeon rx|radeon pro|apple m[2-9]|arc a\d/.test(g)) return 'high';
  if (/intel.*(hd|uhd) graphics( \d{3,4})?$|intel\(r\) hd/.test(g)) return 'low';
  if (/intel|iris|apple m1|vega|radeon\(tm\) graphics/.test(g)) return 'medium';
  return 'medium';
}

export function resolveTier(requested, renderer) {
  let key = requested;
  if (!TIERS[key]) {
    try { key = globalThis.localStorage?.getItem('mikdash.quality') || 'auto'; } catch { key = 'auto'; }
  }
  if (!TIERS[key]) key = autoDetect(renderer);
  return { ...TIERS[key] };
}

// Quality tiers. ctx.quality is one of these objects (a copy), chosen by URL ?q=, saved setting, or auto-detect.
// Subsystems READ these knobs; they never hard-code device assumptions.
// The render/ owner may refine autoDetect() and add knobs; keep existing keys stable.

export const TIERS = {
  low: {
    key: 'low', label: 'Low — phones & integrated graphics',
    pixelRatioCap: 1.0, renderScale: 0.8,
    shadows: false, shadowMapSize: 1024, cascades: 1,
    post: false, ao: false, bloom: false, aa: 'none', godrays: false,
    textureSize: 512, anisotropy: 2, detail: 0,
    maxFigures: 60, maxFireLights: 2, terrainSegments: 96, drawDistance: 2500,
  },
  medium: {
    key: 'medium', label: 'Medium — balanced',
    pixelRatioCap: 1.25, renderScale: 1.0,
    shadows: true, shadowMapSize: 2048, cascades: 1,
    post: true, ao: false, bloom: true, aa: 'smaa', godrays: false,
    textureSize: 1024, anisotropy: 4, detail: 1,
    maxFigures: 180, maxFireLights: 4, terrainSegments: 192, drawDistance: 4000,
  },
  high: {
    key: 'high', label: 'High — discrete GPU',
    pixelRatioCap: 1.5, renderScale: 1.0,
    shadows: true, shadowMapSize: 4096, cascades: 3,
    post: true, ao: true, bloom: true, aa: 'smaa', godrays: false,
    textureSize: 2048, anisotropy: 8, detail: 2,
    maxFigures: 450, maxFireLights: 8, terrainSegments: 320, drawDistance: 6000,
  },
  ultra: {
    key: 'ultra', label: 'Ultra — maximum realism',
    pixelRatioCap: 2.0, renderScale: 1.0,
    shadows: true, shadowMapSize: 4096, cascades: 4,
    post: true, ao: true, bloom: true, aa: 'smaa', godrays: true,
    textureSize: 2048, anisotropy: 16, detail: 3,
    maxFigures: 1200, maxFireLights: 12, terrainSegments: 512, drawDistance: 8000,
  },
};

export const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];

/** Rough GPU/device classification. render/ may replace with a better heuristic. */
export function autoDetect(renderer) {
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

// Ground material for the heightfield.
// Preferred: a library key 'terrain_blend' (requested from the materials task) that blends terrain_rock / terrain_soil /
// dry grass by the vertex attribute `color` (r = rock, g = soil, b = vegetation weights).
// Until it exists: a TEMPORARY derived material — the library's own terrain_rock maps and shader patch (same textures,
// same uniforms, no new texture) with vertexColors on, so the ground can shade smoothly from bare limestone to the
// grey-brown stony soil between the rocks instead of switching material per triangle. Its normal map is softened
// (0.4 ×) and the grid's UVs are scaled (UV_SCALE) so the karst cracks read as ground texture, not as repeated decals.
// Re-synced on 'quality:change'.
import { MeshStandardMaterial, Color } from 'three';

/** the ground grid's UV scale (tint mode): 1 / 0.6 → the 8 m rock tile covers ≈ 13 m */
export let UV_SCALE = 1;
const NORMAL_SOFT = 0.4;

export function groundMaterial(ctx) {
  if (ctx.mats.has?.('terrain_blend')) { UV_SCALE = 1; return { material: ctx.mats.get('terrain_blend'), mode: 'blend' }; }
  UV_SCALE = 0.6;
  const src = ctx.mats.get('terrain_rock');
  const m = new MeshStandardMaterial();
  const sync = () => {
    m.map = src.map || null;
    m.normalMap = src.normalMap || null;
    if (src.normalScale) m.normalScale.copy(src.normalScale).multiplyScalar(NORMAL_SOFT);
    m.roughnessMap = src.roughnessMap || null;
    m.aoMap = src.aoMap || null;
    m.roughness = src.roughness;
    m.metalness = src.metalness;
    m.color.copy(src.color || new Color(1, 1, 1));
    m.needsUpdate = true;
  };
  sync();
  m.vertexColors = true;
  m.name = 'terrain_rock (tinted, build-mount fallback)';
  if (src.onBeforeCompile && src.onBeforeCompile !== MeshStandardMaterial.prototype.onBeforeCompile) {
    m.onBeforeCompile = src.onBeforeCompile;
    m.customProgramCacheKey = src.customProgramCacheKey;
  }
  m.userData.matKey = 'terrain_rock';
  ctx.bus?.on?.('quality:change', () => sync());
  return { material: m, mode: 'tint' };
}

// linear-RGB multipliers over the limestone texture (mode 'tint') — grey-brown, early November (reconstruction)
export const TINT = {
  rock: [0.92, 0.91, 0.88],          // bare grey limestone
  soil: [0.56, 0.49, 0.42],          // stony grey-brown soil (terra rossa weathered and mixed with limestone grit)
  bed: [0.84, 0.83, 0.8],            // pale gravel of the Kidron bed
  green: [0.5, 0.5, 0.4],            // cultivated ground: gardens, olive terraces (stubble, weeds, olive litter)
};

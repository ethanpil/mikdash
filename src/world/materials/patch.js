// Optional onBeforeCompile enhancement for the library's MeshStandard/Physical materials. It never replaces
// anything the material needs: if a chunk it hooks is missing (another patch rewrote the shader) that feature
// is skipped, and any earlier onBeforeCompile is chained first. Three features, all cheap:
//   1. macro variation — two lookups of a shared low-frequency noise map in WORLD space modulate albedo,
//      weathering tint and roughness, so a texture tile never repeats identically across a 200 m wall;
//   2. per-block variation — masonry/sheet sets store each texel's distance from its block's start in the
//      albedo alpha; the block's absolute start (uv - d) identifies the stone, which gets its own tint and
//      roughness, so repeated tiles do not show the same stone twice (faded out when minified);
//   3. close-range detail (medium+) — a shared micro-detail map (normal.xy, albedo, roughness) tiled at
//      millimetre scale, blended in within a few meters of the camera.
// Programs stay shared: every patched material returns the same customProgramCacheKey per variant and keeps
// its own uniform values.
import { ShaderChunk, Material } from 'three';

const VERT_PARS = /* glsl */`
varying vec3 vMkWorld;
varying vec2 vMkUv;
`;

const VERT_MAIN = /* glsl */`
{
  vec4 mkW = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    mkW = batchingMatrix * mkW;
  #endif
  #ifdef USE_INSTANCING
    mkW = instanceMatrix * mkW;
  #endif
  vMkWorld = ( modelMatrix * mkW ).xyz;
  vMkUv = uv;
}
`;

const FRAG_PARS = /* glsl */`
varying vec3 vMkWorld;
varying vec2 vMkUv;
uniform sampler2D mkMacroMap; // periodic signed fbm (4 channels), see gen/basis.js
uniform vec4 mkMacro;      // x albedo amp, y roughness amp, z 1/scale (1/m), w tint amp
uniform vec3 mkTint;       // weathering tint (multiplier)
uniform vec4 mkBlock;      // x start quantum (m), y row height (m), z dMax (m), w albedo amp
uniform vec2 mkBlockR;     // x roughness amp, y hue amp
#ifdef MK_DETAIL
uniform sampler2D mkDetailMap;
uniform vec4 mkDetail;     // x uv scale (1/m), y normal strength, z albedo amp, w roughness amp
uniform vec2 mkDetailFade; // fade start / end distance (m)
#endif
float mkHash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
`;

const FRAG_MAP = /* glsl */`
float mkRoughAdd = 0.0;
vec2 mkDN = vec2( 0.0 );
{
  vec4 mkM1 = texture2D( mkMacroMap, vMkWorld.xz * mkMacro.z );
  vec4 mkM2 = texture2D( mkMacroMap, vec2( vMkWorld.x - vMkWorld.z, vMkWorld.y ) * ( mkMacro.z * 1.7 ) + 0.37 );
  float mkMv = mkM1.r * 0.6 + mkM2.g * 0.4;
  diffuseColor.rgb *= 1.0 + mkMacro.x * clamp( mkMv * 1.6, -1.0, 1.0 );
  float mkTv = smoothstep( -0.1, 0.5, mkM1.b * 0.5 + mkM2.a * 0.5 );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * mkTint, mkMacro.w * mkTv );
  mkRoughAdd += mkMacro.y * clamp( mkM2.r * 1.6, -1.0, 1.0 );
  #ifdef USE_MAP
  if ( mkBlock.w > 0.0 ) {
    float mkU0 = vMkUv.x - sampledDiffuseColor.a * mkBlock.z;
    vec2 mkBid = vec2( floor( mkU0 / mkBlock.x ), floor( vMkUv.y / mkBlock.y ) );
    float mkPx = max( length( dFdx( vMkUv ) ), length( dFdy( vMkUv ) ) );
    float mkFade = 1.0 - smoothstep( 0.08, 0.25, mkPx );
    float mkBh = mkHash( mkBid + 0.5 );
    float mkBh2 = mkHash( mkBid.yx + 17.31 );
    diffuseColor.rgb *= 1.0 + mkBlock.w * ( mkBh - 0.5 ) * 2.0 * mkFade;
    diffuseColor.rgb *= 1.0 + vec3( 1.0, 0.0, -1.0 ) * mkBlockR.y * ( mkBh2 - 0.5 ) * mkFade;
    mkRoughAdd += mkBlockR.x * ( fract( mkBh * 13.7 ) - 0.5 ) * 2.0 * mkFade;
  }
  #endif
  #ifdef MK_DETAIL
  if ( mkDetail.x > 0.0 ) {
    float mkDf = 1.0 - smoothstep( mkDetailFade.x, mkDetailFade.y, length( vViewPosition ) );
    vec4 mkD = texture2D( mkDetailMap, vMkUv * mkDetail.x );
    diffuseColor.rgb *= 1.0 + mkDetail.z * ( mkD.b - 0.5 ) * 2.0 * mkDf;
    mkRoughAdd += mkDetail.w * ( mkD.a - 0.5 ) * 2.0 * mkDf;
    mkDN = ( mkD.rg * 2.0 - 1.0 ) * mkDetail.y * mkDf;
  }
  #endif
}
`;

const FRAG_ROUGH = /* glsl */`
roughnessFactor = clamp( roughnessFactor + mkRoughAdd, 0.035, 1.0 );
`;

let warned = false;

function patchShader(shader, uniforms, detail) {
  let vs = shader.vertexShader;
  let fs = shader.fragmentShader;
  const mainRe = /void\s+main\s*\(\s*\)\s*\{/;
  if (!vs.includes('#include <worldpos_vertex>') || !vs.includes('#include <common>')
    || !fs.includes('#include <map_fragment>') || !mainRe.test(fs)) return false;
  vs = vs.replace('#include <common>', `#include <common>\n${VERT_PARS}`)
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_MAIN}`);
  fs = fs.replace(mainRe, (m) => `${detail ? '#define MK_DETAIL\n' : ''}${FRAG_PARS}\n${m}`)
    .replace('#include <map_fragment>', `#include <map_fragment>\n${FRAG_MAP}`);
  if (fs.includes('#include <roughnessmap_fragment>')) {
    fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`);
  }
  const nm = ShaderChunk.normal_fragment_maps;
  if (fs.includes('#include <normal_fragment_maps>') && nm.includes('mapN.xy *= normalScale;')) {
    fs = fs.replace('#include <normal_fragment_maps>',
      nm.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;\n\tmapN.xy += mkDN;'));
  }
  shader.vertexShader = vs;
  shader.fragmentShader = fs;
  Object.assign(shader.uniforms, uniforms);
  return true;
}

/**
 * Attach the enhancement to a material. `state.detail` (boolean) selects the program variant and may be
 * flipped later (set material.needsUpdate = true afterwards).
 */
export function applyPatch(material, uniforms, state) {
  const prev = material.onBeforeCompile;
  const chained = prev && prev !== Material.prototype.onBeforeCompile ? prev : null;
  const prevKey = chained ? material.customProgramCacheKey.bind(material) : null;
  material.onBeforeCompile = function onBeforeCompileMk(shader, renderer) {
    if (chained) chained.call(this, shader, renderer);
    if (!state.enabled) return;
    try {
      patchShader(shader, uniforms, state.detail);
    } catch (e) {
      if (!warned) console.warn('[mats] shader patch skipped', e);
      warned = true;
    }
  };
  material.customProgramCacheKey = () => `mk2${state.enabled ? 1 : 0}${state.detail ? 'd' : ''}${prevKey ? `|${prevKey()}` : ''}`;
}

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
// Per-material options:
//   blend   — terrain_blend: three layer sets (rock, soil, vegetation) mixed by the vertex colour weights
//             (r, g, b), with height-aware, world-noise-broken edges that widen with distance (materials-2-fix);
//   glow    — the albedo alpha is an emission mask (embers);
//   outdoor — material.userData.mkInterior === false: the material never stands in a room. When env's chunk supports
//             it, env itself compiles its room path out (MK_NO_ROOMS, a define on the material) and this patch does
//             nothing more; otherwise (fallback) env's interior terms are compiled out here (#undef MK_INT after env's
//             chunk) — the sky slice is still read exactly as env does and probe captures still apply their gain;
//   comb    — Herodian drafted margins (materials-2-fix): a second detail map of comb-chisel strokes, masked to the
//             margin by the baked roughness step (margin ~0.55, boss ~0.8) and turned to run across the margin it
//             dresses (vertical on the top/bottom margins, horizontal on the sides);
//   courses — the set has a course table: block ids and the course-local height come from a 1-cm course map;
//   uvSwap  — grain-along-v views of a u set (the *_v wood keys): every map's UV (and the detail UV) is swapped in
//             the vertex shader; the tangent frame follows the swapped UVs, so the normal map stays right.
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
  #ifdef MK_UVSWAP
  vMkUv = uv.yx;
  #else
  vMkUv = uv;
  #endif
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
#ifdef MK_COMB
uniform sampler2D mkCombMap;
uniform vec4 mkComb;       // x/y roughness of the margin -> boss step, z normal strength, w margin depth limit (m)
#endif
#endif
#ifdef MK_COURSES
uniform highp sampler2D mkCourseMap;  // (row, row start m, row height m, code) per cm of the tile height
uniform vec2 mkCourse;     // x tile height (m), y entries (cm)
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
  // two oblique projections, each a 2-D function on floors and on walls of either orientation (a plain xz lookup is
  // constant along y on walls and the old (x - z, y) one constant on floors: bands and diagonal stripes)
  vec4 mkM1 = texture2D( mkMacroMap, vec2( vMkWorld.x + 0.6 * vMkWorld.y, vMkWorld.z - 0.4 * vMkWorld.y ) * mkMacro.z );
  vec4 mkM2 = texture2D( mkMacroMap, vec2( vMkWorld.x - 0.5 * vMkWorld.z + 0.3 * vMkWorld.y, vMkWorld.y + 0.8 * vMkWorld.z ) * ( mkMacro.z * 1.7 ) + 0.37 );
  float mkMv = mkM1.r * 0.6 + mkM2.g * 0.4;
  diffuseColor.rgb *= 1.0 + mkMacro.x * clamp( mkMv * 1.6, -1.0, 1.0 );
  float mkTv = smoothstep( -0.1, 0.5, mkM1.b * 0.5 + mkM2.a * 0.5 );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * mkTint, mkMacro.w * mkTv );
  mkRoughAdd += mkMacro.y * clamp( mkM2.r * 1.6, -1.0, 1.0 );
  // the course this texel lies in: uniform rows, or the course table
  float mkRow = floor( vMkUv.y / mkBlock.y );
  float mkLy = vMkUv.y - mkRow * mkBlock.y;
  float mkRh = mkBlock.y;
  #ifdef MK_COURSES
  {
    float mkT = floor( vMkUv.y / mkCourse.x );
    float mkYt = vMkUv.y - mkT * mkCourse.x;
    vec4 mkC = texelFetch( mkCourseMap, ivec2( clamp( int( mkYt * 100.0 ), 0, int( mkCourse.y ) - 1 ), 0 ), 0 );
    mkRow = mkT * 64.0 + mkC.x;
    mkLy = mkYt - mkC.y;
    mkRh = mkC.z;
  }
  #endif
  #ifdef USE_MAP
  if ( mkBlock.w > 0.0 ) {
    float mkU0 = vMkUv.x - sampledDiffuseColor.a * mkBlock.z;
    vec2 mkBid = vec2( floor( mkU0 / mkBlock.x ), mkRow );
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
    vec2 mkDn = ( mkD.rg * 2.0 - 1.0 ) * mkDetail.y;
    float mkDa = mkDetail.z * ( mkD.b - 0.5 ) * 2.0;
    float mkDr = mkDetail.w * ( mkD.a - 0.5 ) * 2.0;
    #if defined( MK_COMB ) && defined( USE_ROUGHNESSMAP )
    {
      // the margin (smooth, combed) vs the pointed boss: the baked roughness step; strokes run across the margin
      float mkR = texture2D( roughnessMap, vRoughnessMapUv ).g;
      float mkMarg = 1.0 - smoothstep( mkComb.x, mkComb.y, mkR );
      float mkEy = min( mkLy, mkRh - mkLy );
      bool mkVert = mkEy < mkComb.w;
      vec2 mkCuv = ( mkVert ? vMkUv : vMkUv.yx ) * mkDetail.x;
      vec4 mkC = texture2D( mkCombMap, mkCuv );
      vec2 mkCn = ( mkC.rg * 2.0 - 1.0 ) * mkComb.z;
      mkCn = mkVert ? mkCn : mkCn.yx;
      mkDn = mix( mkDn, mkCn, mkMarg );
      mkDa = mix( mkDa, mkDetail.z * ( mkC.b - 0.5 ) * 2.0, mkMarg );
      mkDr = mix( mkDr, mkDetail.w * ( mkC.a - 0.5 ) * 2.0, mkMarg );
    }
    #endif
    diffuseColor.rgb *= 1.0 + mkDa * mkDf;
    mkRoughAdd += mkDr * mkDf;
    mkDN = mkDn * mkDf;
  }
  #endif
}
`;

const FRAG_ROUGH = /* glsl */`
roughnessFactor = clamp( roughnessFactor + mkRoughAdd, 0.035, 1.0 );
`;

// ---------------------------------------------------------------- terrain_blend
// Layer 0 (rock) is the material's own map / normalMap (so three sets up USE_MAP and the tangent frame); layers 1
// and 2 are extra samplers. Each layer: (albedo sRGB, height) + (normal.xy, roughness, AO), sampled at its own tile.
// Edges: the vertex weights are perturbed by world-space noise and by each layer's own height (rock stands proud of
// the soil, grass fills the hollows) and resolved with a soft maximum whose band widens with distance and with the
// weights' own screen-space rate (materials-2-fix: a fixed narrow band drew hard pale blobs on the far hills); far
// off, the layers are also pulled toward a shared mid-tone, so rock outcrops read as grey mottling, not snow.
const BLEND_PARS = /* glsl */`
uniform sampler2D tbA1;
uniform sampler2D tbA2;
uniform sampler2D tbN1;
uniform sampler2D tbN2;
uniform vec3 tbRep;      // 1 / tile (1/m) of rock, soil, vegetation
uniform vec4 tbK;        // x height influence, y edge-noise amplitude, z blend band, w edge-noise frequency (1/m)
uniform vec4 tbF;        // x/y distance (m) over which edges widen and the layers converge, z band gain far, w mid-tone pull
vec3 tbW = vec3( 1.0, 0.0, 0.0 );
vec4 tbQ0 = vec4( 0.5, 0.5, 1.0, 1.0 );
vec4 tbQ1 = vec4( 0.5, 0.5, 1.0, 1.0 );
vec4 tbQ2 = vec4( 0.5, 0.5, 1.0, 1.0 );
`;

const BLEND_MAP = /* glsl */`
#ifdef USE_MAP
vec4 sampledDiffuseColor = vec4( 1.0 );
{
  vec2 tbUv = vMkUv;
  vec4 tbS0 = texture2D( map, tbUv * tbRep.x );
  vec4 tbS1 = texture2D( tbA1, tbUv * tbRep.y );
  vec4 tbS2 = texture2D( tbA2, tbUv * tbRep.z );
  tbQ0 = texture2D( normalMap, tbUv * tbRep.x );
  tbQ1 = texture2D( tbN1, tbUv * tbRep.y );
  tbQ2 = texture2D( tbN2, tbUv * tbRep.z );
  // edge noise at ~9 m, ~2.5 m and ~0.7 m (the macro map is periodic fbm, so each lookup carries its octaves)
  vec4 tbE = texture2D( mkMacroMap, vMkWorld.xz * tbK.w + 0.19 );
  vec4 tbE2 = texture2D( mkMacroMap, vMkWorld.xz * ( tbK.w * 3.7 ) + 0.61 );
  #if defined( USE_COLOR )
    vec3 w = max( vColor.rgb, vec3( 0.0 ) );
  #else
    vec3 w = vec3( 0.34, 0.33, 0.33 );
  #endif
  w /= max( w.x + w.y + w.z, 1e-4 );
  float tbFar = smoothstep( tbF.x, tbF.y, length( vViewPosition ) );
  vec3 pres = smoothstep( 0.0, 0.3, w );
  vec3 e = w + ( vec3( tbS0.a, tbS1.a, tbS2.a ) - 0.5 ) * tbK.x * pres * ( 1.0 - 0.6 * tbFar )
             + ( tbE.xyz * 0.55 + tbE2.yzw * 0.45 ) * tbK.y * pres;
  float tbBand = tbK.z * ( 1.0 + tbF.z * tbFar ) + 2.0 * ( fwidth( w.x ) + fwidth( w.y ) + fwidth( w.z ) );
  float em = max( max( e.x, e.y ), e.z ) - tbBand;
  tbW = max( e - em, vec3( 0.0 ) );
  tbW /= max( tbW.x + tbW.y + tbW.z, 1e-4 );
  vec3 tbMid = ( tbS0.rgb + tbS1.rgb + tbS2.rgb ) / 3.0;
  float tbPull = tbF.w * tbFar;
  sampledDiffuseColor = vec4( mix( tbS0.rgb * tbW.x + tbS1.rgb * tbW.y + tbS2.rgb * tbW.z, tbMid, tbPull ), 1.0 );
  diffuseColor *= sampledDiffuseColor;
}
#endif
`;

const BLEND_ROUGH = /* glsl */`
float roughnessFactor = roughness * dot( tbW, vec3( tbQ0.b, tbQ1.b, tbQ2.b ) );
`;

const BLEND_NORMAL = /* glsl */`
#if defined( USE_NORMALMAP_TANGENTSPACE )
{
  vec2 tbNxy = ( tbQ0.xy * tbW.x + tbQ1.xy * tbW.y + tbQ2.xy * tbW.z ) * 2.0 - 1.0;
  vec3 mapN = vec3( tbNxy * normalScale + mkDN, 0.0 );
  mapN.z = sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) );
  normal = normalize( tbn * mapN );
}
#endif
`;

const BLEND_AO = /* glsl */`
reflectedLight.indirectDiffuse *= dot( tbW, vec3( tbQ0.a, tbQ1.a, tbQ2.a ) );
`;

// ---------------------------------------------------------------- outdoor-only: env's interior terms compiled out
// (fallback when env's chunk has no MK_NO_ROOMS) env/interiors-glsl.js defines MK_INT inside
// envmap_physical_pars_fragment; every interior hook is #ifdef MK_INT. After that chunk MK_INT is undefined again;
// env's sky sampling (mkSky) still needs the atlas width, which env keeps in mkUnionB.w = 1 / width of
// scene.environment — the same as textureSize() of the bound map. On tiers with probes the capture gain (and the
// debug view) still apply: MK_INT comes back just before the tone-mapping chunk with the flags read once.
const OUT_AFTER_ENV = /* glsl */`
#ifdef MK_INT
#undef MK_INT
#define MK_INT_OFF
#endif
`;
const OUT_BEFORE_IBL = /* glsl */`
#if defined( MK_INT_OFF ) && defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
  mkInvW = 1.0 / float( textureSize( envMap, 0 ).x );
#endif
`;
const OUT_BEFORE_TONEMAP = /* glsl */`
#if defined( MK_INT_OFF ) && defined( MK_PROBES )
#define MK_INT
  mkFlags = int( mkUnionA.w + 0.5 );
#endif
`;

const GLOW = /* glsl */`
#ifdef USE_MAP
totalEmissiveRadiance *= sampledDiffuseColor.a;
#endif
`;

/** true when env's interior chunk compiles its room path out natively (MK_NO_ROOMS) */
export function envHasNoRooms() {
  return (ShaderChunk.envmap_physical_pars_fragment || '').includes('MK_NO_ROOMS');
}

let warned = false;

function patchShader(shader, uniforms, detail, opt) {
  let vs = shader.vertexShader;
  let fs = shader.fragmentShader;
  const mainRe = /void\s+main\s*\(\s*\)\s*\{/;
  if (!vs.includes('#include <worldpos_vertex>') || !vs.includes('#include <common>')
    || !fs.includes('#include <map_fragment>') || !mainRe.test(fs)) return false;
  const swap = opt.uvSwap && vs.includes('#include <uv_vertex>');
  vs = vs.replace(mainRe, (m) => `${swap ? '#define MK_UVSWAP\n' : ''}${m}`)
    .replace('#include <common>', `#include <common>\n${VERT_PARS}`)
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_MAIN}`);
  if (swap) {
    // every map UV from the swapped attribute (channel 0 only: the library's materials use no other channel)
    vs = vs.replace('#include <uv_vertex>', ShaderChunk.uv_vertex.replace(/vec3\(\s*(?:uv|[A-Z]+_UV)\s*,\s*1\s*\)/g, 'vec3( uv.yx, 1 )'));
  }
  const blend = opt.blend && fs.includes('#include <color_fragment>') && fs.includes('#include <roughnessmap_fragment>')
    && fs.includes('#include <normal_fragment_maps>') && fs.includes('#include <aomap_fragment>');
  const defs = `${detail ? '#define MK_DETAIL\n' : ''}${detail && opt.comb ? '#define MK_COMB\n' : ''}${opt.courses ? '#define MK_COURSES\n' : ''}`;
  fs = fs.replace(mainRe, (m) => `${defs}${FRAG_PARS}\n${blend ? BLEND_PARS : ''}\n${m}`);
  if (blend) {
    fs = fs.replace('#include <map_fragment>', `${BLEND_MAP}\n${FRAG_MAP}`)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', `${BLEND_ROUGH}\n${FRAG_ROUGH}`)
      .replace('#include <normal_fragment_maps>', BLEND_NORMAL)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${BLEND_AO}`);
  } else {
    fs = fs.replace('#include <map_fragment>', `#include <map_fragment>\n${FRAG_MAP}`);
    if (fs.includes('#include <roughnessmap_fragment>')) {
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${FRAG_ROUGH}`);
    }
    const nm = ShaderChunk.normal_fragment_maps;
    if (fs.includes('#include <normal_fragment_maps>') && nm.includes('mapN.xy *= normalScale;')) {
      fs = fs.replace('#include <normal_fragment_maps>',
        nm.replace('mapN.xy *= normalScale;', 'mapN.xy *= normalScale;\n\tmapN.xy += mkDN;'));
    }
  }
  if (opt.glow && fs.includes('#include <emissivemap_fragment>')) {
    fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${GLOW}`);
  }
  // outdoor-only materials, fallback path (env without MK_NO_ROOMS): compile env's interior path out here — only when
  // env's patch has the expected shape
  const envPars = ShaderChunk.envmap_physical_pars_fragment || '';
  if (opt.outdoor && !envHasNoRooms() && envPars.includes('#define MK_INT') && envPars.includes('mkInvW') && envPars.includes('mkUnionA')
    && fs.includes('#include <envmap_physical_pars_fragment>') && fs.includes('#include <lights_fragment_maps>')
    && fs.includes('#include <tonemapping_fragment>')) {
    fs = fs.replace('#include <envmap_physical_pars_fragment>', `#include <envmap_physical_pars_fragment>\n${OUT_AFTER_ENV}`)
      .replace('#include <lights_fragment_maps>', `${OUT_BEFORE_IBL}\n#include <lights_fragment_maps>`)
      .replace('#include <tonemapping_fragment>', `${OUT_BEFORE_TONEMAP}\n#include <tonemapping_fragment>`);
  }
  shader.vertexShader = vs;
  shader.fragmentShader = fs;
  Object.assign(shader.uniforms, uniforms);
  return true;
}

/**
 * Attach the enhancement to a material. `state.detail` (boolean) selects the program variant and may be
 * flipped later (set material.needsUpdate = true afterwards). `opt`: { blend, glow, outdoor, comb, courses, uvSwap }.
 */
export function applyPatch(material, uniforms, state, opt = {}) {
  const prev = material.onBeforeCompile;
  const chained = prev && prev !== Material.prototype.onBeforeCompile ? prev : null;
  const prevKey = chained ? material.customProgramCacheKey.bind(material) : null;
  const o = { blend: !!opt.blend, glow: !!opt.glow, outdoor: !!opt.outdoor, comb: !!opt.comb, courses: !!opt.courses, uvSwap: !!opt.uvSwap };
  // the fallback opt-out (env without MK_NO_ROOMS) follows userData.mkInterior, which setOutdoorOpt() flips too
  const out = () => o.outdoor && state.outdoor !== false && material.userData.mkInterior === false && !envHasNoRooms();
  const flags = () => `${o.blend ? 'B' : ''}${o.glow ? 'E' : ''}${out() ? 'O' : ''}${o.comb ? 'C' : ''}${o.courses ? 'R' : ''}${o.uvSwap ? 'S' : ''}`;
  material.onBeforeCompile = function onBeforeCompileMk(shader, renderer) {
    if (chained) chained.call(this, shader, renderer);
    if (!state.enabled) {
      // ?matfx=0 still swaps the UVs of the grain-along-v keys (they have no texture set of their own)
      if (o.uvSwap && shader.vertexShader.includes('#include <uv_vertex>')) {
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>',
          ShaderChunk.uv_vertex.replace(/vec3\(\s*(?:uv|[A-Z]+_UV)\s*,\s*1\s*\)/g, 'vec3( uv.yx, 1 )'));
      }
      return;
    }
    try {
      patchShader(shader, uniforms, state.detail, { ...o, outdoor: out() });
    } catch (e) {
      if (!warned) console.warn('[mats] shader patch skipped', e);
      warned = true;
    }
  };
  material.customProgramCacheKey = () => `mk4${state.enabled ? 1 : 0}${state.detail ? 'd' : ''}${flags()}${prevKey ? `|${prevKey()}` : ''}`;
}

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
//             the vertex shader; the tangent frame follows the swapped UVs, so the normal map stays right;
//   foot    — (qa-r1, the Herodian walls) dust and splash over the bottom ~0.5 m of a wall and a contact-AO band at
//             its foot: the floor beside the face comes from a shared floor map (the nav grid's lowest / highest walkable
//             floor per 0.5 m cell, built by index.js once the grid is ready; faded in, off until then);
//   altar   — (qa-r1, the altar's lime keys) soot darkening toward the top and over each ma'arachah, an ash crust along
//             the top arrises and down the corners, positioned in world space from the site model's altar;
//   burn    — (gate-world-materials, the altar's firewood and ash beds) a second texture set (charred wood or a coal
//             bed) blended in by a per-vertex attribute `mkBurn` (x char, y ash crust, z ember glow) that the builder
//             paints per log: char over the bark, a grey-white ash crust on the burnt ends, and emission in the char's
//             cracks (or the coal bed's glow mask) where the log faces the coals; the emission follows the fire scale;
//   metal   — (qa-r1, every metal key; the values are uniforms, and all metals already share programs) a cool (sky-blue)
//             cast in the environment reflection and the ambient is desaturated, the reflection is blended toward the
//             mean ambient (a broad second lobe: beaten, not mirror, metal) and its peaks soft-capped against that
//             ambient: gold under blue skylight stays yellow-gold instead of olive / teal, a bright doorway reflected in
//             interior gold no longer clips to white, candle-lit gold keeps its amber (gold keys; bronze, more on low).
// Programs stay shared: every patched material returns the same customProgramCacheKey per variant and keeps
// its own uniform values.
import { ShaderChunk, Material } from 'three';

const VERT_PARS = /* glsl */`
varying vec3 vMkWorld;
varying vec2 vMkUv;
uniform float mkUvSwap; // 1: the grain-along-v views (uvSwap) read every map at uv.yx (perf-1: a uniform, not a variant)
#ifdef MK_BURN
attribute vec3 mkBurn;  // x char, y ash crust, z ember glow (0 where the geometry has no such attribute)
varying vec3 vMkBurn;
#endif
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
  vMkUv = mkUvS;
  #ifdef MK_BURN
  vMkBurn = mkBurn;
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
#ifdef MK_FOOT
uniform sampler2D mkFootMap; // per 0.5 m cell: (lowest, highest) walkable floor, world y (m); 9999 = none
uniform vec4 mkFoot;       // xy world origin (x, z) of the map, zw 1 / its extent (m)
uniform vec4 mkFootK;      // x fade-in (0 until the map exists), y grime band height (m), z contact-AO height (m), w AO depth
uniform vec2 mkFootG;      // x grime amount
#endif
#ifdef MK_ALTAR
uniform vec4 mkAlt0;       // xy altar centre (world x, z), z half-width of the 28-square (m), w its top (world y)
uniform vec4 mkAlt1;       // x court floor y, y chut hasikra y, z soot amount, w ash amount
uniform vec4 mkAltF0;      // the three ma'arachot: xy (world x, z), z radius (m), w strength
uniform vec4 mkAltF1;
uniform vec4 mkAltF2;
#endif
#ifdef MK_METAL
uniform vec4 mkMetal;      // x env desaturation, y blend toward the mean ambient, z peak cap (x the mean ambient; 0 = off)
#endif
#ifdef MK_BURN
uniform sampler2D mkBurnMap; // the burn set (charred wood / coal bed): albedo (alpha: the coal bed's glow mask)
uniform sampler2D mkBurnOrm; // its AO / roughness
uniform sampler2D mkBurnNor; // its normal (packed xy)
uniform vec4 mkBurnK;      // xy 1 / its tile (1/m), z glow mask source (0 the char's cracks: wood, 1 the albedo alpha: ash),
                           // w wood: the ash crust's tone (linear); ash: the soot's darkening at x = 1
uniform vec3 mkBurnE;      // ember emission: colour x luminance x the fire emission scale (set every frame)
varying vec3 vMkBurn;
float mkBurnC = 0.0;       // char share here, after the noise breakup
float mkBurnA = 0.0;       // ash crust share
float mkBurnRo = 1.0;      // the burn set's roughness here
float mkGlow = 0.0;        // ember emission mask
#endif
// qa-r2 (paving_mount): the routes worn across the Mount — x amount (0 = off: every other material), y half-width (m),
// z lightening, w smoothing; A, B, C: three route segments (world x, z of their ends). A uniform, not a variant: the
// pavement keeps the plain stone program (every patched material sets these, to zero when it has no routes)
uniform vec4 mkWear;
uniform vec4 mkWearA;
uniform vec4 mkWearB;
uniform vec4 mkWearC;
float mkSegD( vec2 p, vec4 s ) {
  vec2 ab = s.zw - s.xy;
  float t = clamp( dot( p - s.xy, ab ) / max( dot( ab, ab ), 1e-6 ), 0.0, 1.0 );
  return length( p - s.xy - ab * t );
}
float mkHash( vec2 p ) {
  vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
  p3 += dot( p3, p3.yzx + 33.33 );
  return fract( ( p3.x + p3.y ) * p3.z );
}
`;

const FRAG_MAP = /* glsl */`
float mkRoughAdd = 0.0;
vec2 mkDN = vec2( 0.0 );
float mkFootAO = 1.0;
{
  // two oblique projections, each a 2-D function on floors and on walls of either orientation (a plain xz lookup is
  // constant along y on walls and the old (x - z, y) one constant on floors: bands and diagonal stripes)
  vec4 mkM1 = texture2D( mkMacroMap, vec2( vMkWorld.x + 0.6 * vMkWorld.y, vMkWorld.z - 0.4 * vMkWorld.y ) * mkMacro.z );
  vec4 mkM2 = texture2D( mkMacroMap, vec2( vMkWorld.x - 0.5 * vMkWorld.z + 0.3 * vMkWorld.y, vMkWorld.y + 0.8 * vMkWorld.z ) * ( mkMacro.z * 1.7 ) + 0.37 );
  float mkMv = mkM1.r * 0.6 + mkM2.g * 0.4;
  // worn routes (paving_mount): dust scuffed away and the stone a little paler and smoother along the crowds' ways,
  // their edges wandering with the macro noise
  float mkWr = 0.0;
  if ( mkWear.x > 0.0 ) {
    float mkWd = min( mkSegD( vMkWorld.xz, mkWearA ), min( mkSegD( vMkWorld.xz, mkWearB ), mkSegD( vMkWorld.xz, mkWearC ) ) );
    mkWr = mkWear.x * ( 1.0 - smoothstep( mkWear.y * 0.3, mkWear.y, mkWd + mkWear.y * 0.5 * mkMv ) );
  }
  diffuseColor.rgb *= 1.0 + mkMacro.x * clamp( mkMv * 1.6, -1.0, 1.0 ) * ( 1.0 - 0.6 * mkWr );
  float mkTv = smoothstep( -0.1, 0.5, mkM1.b * 0.5 + mkM2.a * 0.5 ) * ( 1.0 - 0.85 * mkWr );
  diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * mkTint, mkMacro.w * mkTv );
  diffuseColor.rgb *= 1.0 + mkWear.z * mkWr;
  mkRoughAdd += mkMacro.y * clamp( mkM2.r * 1.6, -1.0, 1.0 ) - mkWear.w * mkWr;
  #ifdef MK_FOOT
  {
    // the face's own normal (facing the viewer), the floor 0.35 m out from it, and the height above that floor
    vec3 mkFn = normalize( cross( dFdx( vMkWorld ), dFdy( vMkWorld ) ) );
    mkFn *= dot( mkFn, cameraPosition - vMkWorld ) < 0.0 ? -1.0 : 1.0;
    float mkVert = 1.0 - smoothstep( 0.35, 0.6, abs( mkFn.y ) );
    vec2 mkNh = mkFn.xz / max( length( mkFn.xz ), 1e-4 );
    vec2 mkFuv = ( vMkWorld.xz + mkNh * 0.35 - mkFoot.xy ) * mkFoot.zw;
    vec2 mkFl = texture2D( mkFootMap, mkFuv ).rg;
    float mkFy = mkFl.y <= vMkWorld.y + 0.08 ? mkFl.y : mkFl.x;
    float mkHh = vMkWorld.y - mkFy;
    float mkIn = step( 0.0, mkFuv.x ) * step( mkFuv.x, 1.0 ) * step( 0.0, mkFuv.y ) * step( mkFuv.y, 1.0 );
    float mkOk = mkIn * mkVert * step( -0.1, mkHh ) * step( mkFy, 9000.0 ) * mkFootK.x;
    // dust and splash, densest at the foot; an uneven top edge (the macro map along the wall)
    vec4 mkGn = texture2D( mkMacroMap, vec2( ( vMkWorld.x - vMkWorld.z ) * 0.45, vMkWorld.y * 0.9 ) + 0.29 );
    float mkGr = mkOk * ( 1.0 - smoothstep( 0.0, mkFootK.y, mkHh + 0.14 * mkGn.r + 0.06 * mkMv ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.80, 0.76, 0.69 ), mkGr * mkFootG.x );
    mkRoughAdd += 0.05 * mkGr;
    mkFootAO = 1.0 - mkFootK.w * mkOk * ( 1.0 - smoothstep( 0.0, mkFootK.z, mkHh ) );
  }
  #endif
  #ifdef MK_ALTAR
  {
    // soot: over the upper body (smoke and heat; the smoke rises straight up, Avot 5:5, so streaks run vertically), more
    // over each ma'arachah; limed twice a year and wiped weekly (Middot 3:4), so patchy and moderate
    vec3 mkW = vMkWorld;
    float mkTop = mkAlt0.w;
    vec2 mkD0 = ( mkW.xz - mkAltF0.xy ) / mkAltF0.z;
    vec2 mkD1 = ( mkW.xz - mkAltF1.xy ) / mkAltF1.z;
    vec2 mkD2 = ( mkW.xz - mkAltF2.xy ) / mkAltF2.z;
    float mkNear = max( mkAltF0.w * exp( - dot( mkD0, mkD0 ) ), max( mkAltF1.w * exp( - dot( mkD1, mkD1 ) ), mkAltF2.w * exp( - dot( mkD2, mkD2 ) ) ) );
    float mkUp = smoothstep( mkAlt1.y + 0.4, mkTop, mkW.y );
    float mkHi = smoothstep( mkTop - 2.0, mkTop, mkW.y );
    vec4 mkSn = texture2D( mkMacroMap, vec2( ( mkW.x - mkW.z ) * 0.7, mkW.y * 0.18 ) + 0.53 );
    float mkSoot = clamp( mkAlt1.z * ( 0.45 * mkUp * mkUp + mkNear * mkHi ) * ( 0.7 + 0.9 * mkSn.g + 0.5 * mkMv ), 0.0, 0.85 );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 0.40, 0.38, 0.36 ), mkSoot );
    mkRoughAdd += 0.04 * mkSoot;
    // ash crust: along the top arrises (the faces' top 0.45 m and the walkway's outer 0.5-0.9 m) and down the corners
    vec2 mkDc = abs( mkW.xz - mkAlt0.xy ) - mkAlt0.z;
    float mkCorner = ( 1.0 - smoothstep( 0.1, 1.1, abs( mkDc.x ) ) ) * ( 1.0 - smoothstep( 0.1, 1.1, abs( mkDc.y ) ) );
    float mkEdge = smoothstep( mkTop - 0.45, mkTop - 0.03, mkW.y ) * ( 1.0 - smoothstep( 0.5, 0.9, - max( mkDc.x, mkDc.y ) ) );
    float mkAsh = ( mkEdge * ( 0.55 + 0.45 * mkCorner ) + 0.45 * mkCorner * smoothstep( mkTop - 1.6, mkTop - 0.2, mkW.y ) )
                * ( 1.0 - smoothstep( mkTop + 0.04, mkTop + 0.2, mkW.y ) );
    mkAsh = clamp( mkAsh * mkAlt1.w * smoothstep( -0.25, 0.35, mkSn.b + 0.4 * mkMv + 0.3 * mkCorner ), 0.0, 1.0 );
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.34, 0.325, 0.31 ) * ( 0.85 + 0.3 * mkSn.a ), mkAsh * 0.6 );
    mkRoughAdd += 0.06 * mkAsh;
  }
  #endif
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
  #ifdef MK_BURN
  {
    // fire-touched wood: the char creeps over the bark in tongues (the per-vertex share broken by ~30 cm noise), the burnt
    // ends crusted grey-white with ash on the char's cushions (the cracks stay black), and the cracks facing the coals glow
    vec2 mkBuv = vMkUv * mkBurnK.xy;
    vec4 mkBa = texture2D( mkBurnMap, mkBuv );
    // the alligator checks' contrast eased 35 % toward the char's local mean (a blurred, biased lookup): lit by the fire
    // at night the grey cushions between black cracks read as an orange net over the pile (wood only; the ash keeps its
    // coal lumps)
    if ( mkBurnK.z < 0.5 ) mkBa.rgb = mix( mkBa.rgb, texture2D( mkBurnMap, mkBuv, 4.0 ).rgb, 0.35 );
    vec2 mkBo = texture2D( mkBurnOrm, mkBuv ).rg;
    vec4 mkBn = texture2D( mkMacroMap, vec2( vMkWorld.x + 0.7 * vMkWorld.y, vMkWorld.z - 0.5 * vMkWorld.y ) * 3.3 + 0.43 );
    float mkCrack = smoothstep( 0.22, 0.45, 1.0 - mkBo.r );
    float mkBx = vMkBurn.x;
    mkBurnC = clamp( ( mkBx - 0.5 ) * 2.2 + 0.5 + 0.55 * mkBn.r, 0.0, 1.0 ) * smoothstep( 0.0, 0.08, mkBx );
    if ( mkBurnK.z > 0.5 ) {
      // ash (the coal bed's set): x is soot — the ash darkened toward the arrangement, its charcoal lumps only close in
      diffuseColor.rgb *= 1.0 - mkBurnK.w * mkBurnC;
      mkBurnC *= smoothstep( 0.45, 0.95, mkBx );
    }
    diffuseColor.rgb = mix( diffuseColor.rgb, mkBa.rgb, mkBurnC );
    mkBurnA = clamp( ( vMkBurn.y - 0.35 ) * 2.0 + 0.5 + 0.6 * mkBn.g, 0.0, 1.0 ) * smoothstep( 0.0, 0.1, vMkBurn.y ) * ( 1.0 - 0.35 * mkCrack );
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( mkBurnK.w ) * vec3( 1.0, 0.975, 0.93 ) * ( 0.85 + 0.3 * mkBn.b ), mkBurnA );
    mkBurnRo = max( mkBo.g, 0.92 );  // charcoal is matte: its satin crests drew an orange net in the fire's light, and a pale sheen of the dawn sky on low
    float mkMask = mkBurnK.z > 0.5 ? mkBa.a : mkCrack * ( 0.55 + 0.45 * mkBurnC );
    mkGlow = clamp( vMkBurn.z * ( 1.0 + 0.6 * mkBn.a ), 0.0, 1.0 ) * mkMask * ( 1.0 - 0.85 * mkBurnA );
    diffuseColor.rgb *= 1.0 - 0.5 * mkGlow;
  }
  #endif
}
`;

const FRAG_ROUGH = /* glsl */`
roughnessFactor = clamp( roughnessFactor + mkRoughAdd, 0.035, 1.0 );
#ifdef MK_BURN
roughnessFactor = mix( mix( roughnessFactor, mkBurnRo, mkBurnC ), 0.97, mkBurnA );
#endif
`;

// burn (gate-world-materials): the char's own relief where the char lies, flattened under the ash crust; the embers
const BURN_NORMAL = /* glsl */`
#ifdef MK_BURN
	mapN.xy = mix( mapN.xy, ( texture2D( mkBurnNor, vMkUv * mkBurnK.xy ).xy * 2.0 - 1.0 ) * normalScale + mkDN, mkBurnC ) * ( 1.0 - 0.6 * mkBurnA );
	mapN.z = sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) );
#endif
`;
const BURN_GLOW = /* glsl */`
#ifdef MK_BURN
totalEmissiveRadiance += mkBurnE * mkGlow;
#endif
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
// gate-world-materials: dry open ground is never glossy — roughness at least 0.9 (after the detail / macro terms)
const BLEND_ROUGH_FLOOR = /* glsl */`
roughnessFactor = max( roughnessFactor, 0.9 );
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

// gate-world-materials: …and the sky's reflection on it is occluded by the ground's own clods, stones and grass (dry porous
// soil scatters back toward the light, not forward): the GGX lobe's sheen of the dawn sky made the hills read wet. The
// specular IBL is scaled by the cavity AO and a micro-occlusion factor of 0.35
const BLEND_AO = /* glsl */`
{
  float tbAo = dot( tbW, vec3( tbQ0.a, tbQ1.a, tbQ2.a ) );
  reflectedLight.indirectDiffuse *= tbAo;
  reflectedLight.indirectSpecular *= 0.35 * tbAo;
}
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

// before lights_fragment_end: the IBL radiance of metals (MK_METAL above); `irradiance` + `iblIrradiance` hold the
// ambient (sky, probes, env's interior terms) at this point
const METAL_IBL = /* glsl */`
#if defined( MK_METAL ) && defined( RE_IndirectSpecular ) && defined( RE_IndirectDiffuse )
{
  vec3 mkLw = vec3( 0.2126, 0.7152, 0.0722 );
  vec3 mkA = ( iblIrradiance + irradiance ) * RECIPROCAL_PI;
  float mkRl = dot( radiance, mkLw );
  float mkAl = dot( mkA, mkLw );
  // only a COOL (sky-blue) cast is taken out: warm light — candles, gold reflecting gold — keeps its colour
  float mkCr = clamp( 2.0 * ( radiance.b - radiance.r ) / max( mkRl, 1e-6 ), 0.0, 1.0 );
  float mkCa = clamp( 2.0 * ( mkA.b - mkA.r ) / max( mkAl, 1e-6 ), 0.0, 1.0 );
  radiance = mix( radiance, vec3( mkRl ), mkMetal.x * mkCr );
  mkA = mix( mkA, vec3( mkAl ), mkMetal.x * mkCa );
  radiance = mix( radiance, mkA, mkMetal.y );
  if ( mkMetal.z > 0.0 ) {
    float mkR2 = dot( radiance, mkLw );
    radiance *= ( 1.0 + 1.0 / mkMetal.z ) / ( 1.0 + mkR2 / max( mkAl * mkMetal.z, 1e-6 ) );
  }
}
#endif
`;
const FOOT_AO = /* glsl */`
#ifdef MK_FOOT
reflectedLight.indirectDiffuse *= mkFootAO;
reflectedLight.indirectSpecular *= mkFootAO;
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
  // perf-1: every patched material reads its UVs through mkUvS (uv, or uv.yx where mkUvSwap = 1), so the grain-along-v
  // views share the programs of the plain keys (a lit program costs ≈ 1–2 s to compile on ANGLE/D3D11)
  const vburn = !!opt.burn && !opt.blend && fs.includes('#include <emissivemap_fragment>') && fs.includes('#include <normal_fragment_maps>');
  vs = vs.replace(mainRe, (m) => `${m}\n  vec2 mkUvS = mkUvSwap > 0.5 ? uv.yx : uv;`)
    .replace('#include <common>', `#include <common>\n${vburn ? '#define MK_BURN\n' : ''}${VERT_PARS}`)
    .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${VERT_MAIN}`);
  if (vs.includes('#include <uv_vertex>')) {
    // every map UV from the (possibly swapped) attribute (channel 0 only: the library's materials use no other channel)
    vs = vs.replace('#include <uv_vertex>', ShaderChunk.uv_vertex.replace(/vec3\(\s*(?:uv|[A-Z]+_UV)\s*,\s*1\s*\)/g, 'vec3( mkUvS, 1 )'));
  }
  const blend = opt.blend && fs.includes('#include <color_fragment>') && fs.includes('#include <roughnessmap_fragment>')
    && fs.includes('#include <normal_fragment_maps>') && fs.includes('#include <aomap_fragment>');
  const metal = opt.metal && fs.includes('#include <lights_fragment_end>');
  const foot = opt.foot && fs.includes('#include <aomap_fragment>');
  // the burn blend (plain path only) hooks the normal and emissive chunks; the vertex shader declares its attribute alike
  const burn = !!opt.burn && !opt.blend && fs.includes('#include <emissivemap_fragment>') && fs.includes('#include <normal_fragment_maps>');
  const defs = `${detail ? '#define MK_DETAIL\n' : ''}${detail && opt.comb ? '#define MK_COMB\n' : ''}${opt.courses ? '#define MK_COURSES\n' : ''}`
    + `${foot ? '#define MK_FOOT\n' : ''}${opt.altar ? '#define MK_ALTAR\n' : ''}${metal ? '#define MK_METAL\n' : ''}${burn ? '#define MK_BURN\n' : ''}`;
  fs = fs.replace(mainRe, (m) => `${defs}${FRAG_PARS}\n${blend ? BLEND_PARS : ''}\n${m}`);
  if (blend) {
    fs = fs.replace('#include <map_fragment>', `${BLEND_MAP}\n${FRAG_MAP}`)
      .replace('#include <color_fragment>', '')
      .replace('#include <roughnessmap_fragment>', `${BLEND_ROUGH}\n${FRAG_ROUGH}\n${BLEND_ROUGH_FLOOR}`)
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
        nm.replace('mapN.xy *= normalScale;', `mapN.xy *= normalScale;\n\tmapN.xy += mkDN;${burn ? BURN_NORMAL : ''}`));
    }
  }
  if (metal) fs = fs.replace('#include <lights_fragment_end>', `${METAL_IBL}\n#include <lights_fragment_end>`);
  if (foot) fs = fs.replace('#include <aomap_fragment>', `#include <aomap_fragment>\n${FOOT_AO}`);
  if (burn) fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${BURN_GLOW}`);
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
  shader.uniforms.mkUvSwap = { value: opt.uvSwap ? 1 : 0 };
  return true;
}

/**
 * Attach the enhancement to a material. `state.detail` (boolean) selects the program variant and may be
 * flipped later (set material.needsUpdate = true afterwards). `opt`: { blend, glow, outdoor, comb, courses, uvSwap, foot,
 * altar, metal, burn } (foot / altar / metal / burn need their uniforms in `uniforms`: index.js patchUniforms).
 */
export function applyPatch(material, uniforms, state, opt = {}) {
  const prev = material.onBeforeCompile;
  const chained = prev && prev !== Material.prototype.onBeforeCompile ? prev : null;
  const prevKey = chained ? material.customProgramCacheKey.bind(material) : null;
  const o = {
    blend: !!opt.blend, glow: !!opt.glow, outdoor: !!opt.outdoor, comb: !!opt.comb, courses: !!opt.courses, uvSwap: !!opt.uvSwap,
    foot: !!opt.foot, altar: !!opt.altar, metal: !!opt.metal, burn: !!opt.burn,
  };
  // the fallback opt-out (env without MK_NO_ROOMS) follows userData.mkInterior, which setOutdoorOpt() flips too
  const out = () => o.outdoor && state.outdoor !== false && material.userData.mkInterior === false && !envHasNoRooms();
  // perf-1: the key names only what changes the program — the comb is compiled only with detail (MK_COMB), and the UV
  // swap is a uniform (in code only with the patch off, ?matfx=0)
  const flags = () => `${o.blend ? 'B' : ''}${o.glow ? 'E' : ''}${out() ? 'O' : ''}${o.comb && state.detail ? 'C' : ''}${o.courses ? 'R' : ''}${o.uvSwap && !state.enabled ? 'S' : ''}`
    + `${o.foot ? 'F' : ''}${o.altar ? 'A' : ''}${o.metal ? 'M' : ''}${o.burn ? 'W' : ''}`;
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

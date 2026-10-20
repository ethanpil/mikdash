// Global shader-chunk patch for MeshStandard/Physical materials (every world, people and terrain material):
//
//  1. INTERIOR VOLUMES — boxes (roofed rooms from site.js) with rectangular APERTURES (doors, windows, a portico's
//     open side). A fragment inside a volume sees the outdoor sky only through the apertures: its sky visibility
//     V = base + Σ Ω(aperture) / 2π × openness (Ω = exact solid angle of the rectangle from the fragment). V scales
//     the outdoor image-based light (sky PMREM, outdoor probes), the sun/moon on tiers without shadow maps, and
//     the light of point lights in OTHER volumes (fires in the court do not light the Kodesh through its walls).
//     Specular keeps the outdoor light where the reflected ray leaves through an opening. Surfaces near a volume's
//     boundary that face OUTWARD count as outside (the outer face of a wall whose box includes the wall), so a box
//     may be the room's inner or outer extent.
//  2. REFLECTION PROBES — scene-captured PMREMs stored as extra SLICES of one CubeUV atlas (scene.environment), so
//     no extra sampler is needed: slice 0 is env's sky PMREM (× envMapIntensity, as before), slices 1..n are local
//     probes (× their own exposure ratio), each with an influence box (weight) and a proxy box (box-projected
//     reflections: gold walls reflect the opposite gold walls where they really are). Interior probes are not
//     attenuated by V (they already see the room as it is lit); outdoor probes and the sky are.
//
// Uniforms are uploaded by env/interiors.js through ProgramUniforms (zeros until a program's first upload: no
// volumes, no probes — the stock behaviour). Layout constants must match MK_LIMITS.
//
// All of it lives in ONE std140 uniform block, MkInteriors (env/uniforms.js UniformBlock): as plain uniforms the
// ~1.8 KB were re-uploaded by ANGLE/D3D11 with every draw call (+15 ms a frame on the HD 4600 at low). Loops are
// dynamic with early exits (a constant buffer indexes natively); fully unrolled, FXC flattened the aperture tests
// and evaluated all of them for every fragment.
export const MK_LIMITS = { vol: 12, ap: 16, probe: 3, lights: 16, gap: 8 };

/** member layout of the MkInteriors block: [name, vec4 count] (std140: vec4 arrays are tightly packed) */
export const MK_BLOCK = [
  ['mkVolA', MK_LIMITS.vol], ['mkVolB', MK_LIMITS.vol], ['mkVolC', MK_LIMITS.vol], ['mkVolD', MK_LIMITS.vol],
  ['mkApA', MK_LIMITS.ap], ['mkApB', MK_LIMITS.ap],
  ['mkPrA', MK_LIMITS.probe], ['mkPrB', MK_LIMITS.probe], ['mkPrC', MK_LIMITS.probe], ['mkPrD', MK_LIMITS.probe],
  ['mkPrE', MK_LIMITS.probe], ['mkPrF', MK_LIMITS.probe],
  ['mkIntP', 1], ['mkIntQ', 1], ['mkUnionA', 1], ['mkUnionB', 1], ['mkPtVol', MK_LIMITS.lights],
  ['mkIntEnv', 1], ['mkFillCol', 1], ['mkVolH', MK_LIMITS.vol],
];

const PARS = /* glsl */`
#define MK_INT
layout( std140 ) uniform MkInteriors {
  vec4 mkVolA[ ${MK_LIMITS.vol} ];  // xyz box min − margin (world m), w base sky visibility
  vec4 mkVolB[ ${MK_LIMITS.vol} ];  // xyz box max + margin, w shell: outward-facing surfaces this deep count as outside
  vec4 mkVolC[ ${MK_LIMITS.vol} ];  // x first aperture, y aperture count, z margin (m), w fire fill (scene units)
  vec4 mkVolD[ ${MK_LIMITS.vol} ];  // xyz the room's fire centroid, w falloff radius² (m²) of the fire fill
  vec4 mkApA[ ${MK_LIMITS.ap} ];    // xyz rectangle centre, w openness × brightness beyond (0 shut)
  vec4 mkApB[ ${MK_LIMITS.ap} ];    // x, y half extents on the two in-plane axes, z normal axis (0..2 outward +, 3..5 −), w volume slot
  vec4 mkPrA[ ${MK_LIMITS.probe} ]; // xyz influence min, w atlas slice
  vec4 mkPrB[ ${MK_LIMITS.probe} ]; // xyz influence max, w shell
  vec4 mkPrC[ ${MK_LIMITS.probe} ]; // xyz capture position, w intensity (P now / P at capture …); 0 = unused
  vec4 mkPrD[ ${MK_LIMITS.probe} ]; // xyz proxy min, w 1 = outdoor probe (× sky visibility)
  vec4 mkPrE[ ${MK_LIMITS.probe} ]; // xyz proxy max, w influence margin (m)
  vec4 mkPrF[ ${MK_LIMITS.probe} ]; // x weight (fades a stale probe out toward the sky map), yzw unused
  vec4 mkIntP;                      // x volume count, y camera volume + 1 (0 none), z direct-light attenuation 0..1, w debug view
  vec4 mkIntQ;                      // z probe capture gain (read only while the capture flag is set)
  vec4 mkUnionA;                    // xyz min of all the selected rooms' grown boxes, w flags (MK_F_*) + active probes
  vec4 mkUnionB;                    // xyz max, w 1 / width of scene.environment (texels; 0 = three's own)
  vec4 mkPtVol[ ${MK_LIMITS.lights} ]; // per point light (shader order): x volume + 1 (0 outdoors), y sky visibility there
  vec4 mkIntEnv;                    // xyz what a room's openings show (lit court stone + some sky) / sky irradiance; w albedo of the room's surfaces
  vec4 mkFillCol;                   // xyz colour of the fires' light (the point lights' own colour)
  uvec4 mkVolH[ ${MK_LIMITS.vol} ]; // the grown boxes as halves (conservatively rounded), one read a room: x min.xy, y min.z max.x, z max.yz
};

vec3 mkWorldPos;
vec3 mkWorldN;
// Each block read is a memory load on Intel iGPUs (≈ 0.5–1 ms a frame per vec4 per fragment on the HD 4600 at low):
// a fragment outside every room reads only the two union vec4s, whose w carry what it still needs — the flags and
// probe count (A.w) and the atlas width (B.w); mkIntP is read inside the union only (lighting-polish-fix: the
// outdoor base path read six and cost ≈ 5 ms a frame at low with no room selected at all)
#define MK_F_PROBES 3
#define MK_F_PTROOM 4
#define MK_F_CAPTURE 8
#define MK_F_DEBUG 48
vec4 mkP = vec4( 0.0 ); // mkIntP, inside the union only
int mkFlags = 0;        // mkUnionA.w: bits 0–1 active probes, 2 a point light in a selected room, 3 capture, 4–5 debug view
float mkInvW = 0.0;     // mkUnionB.w
float mkV = 1.0;      // sky visibility at this fragment (1 outdoors)
float mkVol = 0.0;    // its volume slot + 1 (0 outdoors)
float mkSlot = -1.0;  // its volume slot (-1 outdoors)
float mkS = 0.0;      // how far inside it
int mkA0 = 0;         // its apertures: first index, count
int mkNa = 0;
float mkFill = 0.0;   // the room's own fires, interreflected (rooms without a probe; × insideness)
float mkHit = 0.0;    // the part of the reflection that leaves the room through an opening (× insideness)
vec4 mkFillAt = vec4( 0.0, 0.0, 0.0, 1.0 ); // the fires' centroid, falloff radius²

// how far inside a box: 1 inside, fading to 0 at margin outside; outward-facing surfaces in the shell -> 0 —
// except on the box's floor face: a floor is solid ground, never an opening to the sky (the Menorah's feet,
// facing down within the shell of the Kodesh floor, lit as outdoors — lighting-polish-fix)
float mkInside( vec3 p, vec3 n, vec3 bmin, vec3 bmax, float margin, float shell ) {
  vec3 lo = p - bmin, hi = bmax - p;
  vec3 dm = min( lo, hi );
  float d = min( dm.x, min( dm.y, dm.z ) );
  float s = smoothstep( - margin, 0.0, d );
  vec3 o = dm.x <= dm.y && dm.x <= dm.z ? vec3( lo.x < hi.x ? - 1.0 : 1.0, 0.0, 0.0 )
    : dm.y <= dm.z ? vec3( 0.0, lo.y < hi.y ? - 1.0 : 1.0, 0.0 ) : vec3( 0.0, 0.0, lo.z < hi.z ? - 1.0 : 1.0 );
  return d < shell && o.y > - 0.5 ? s * ( 1.0 - smoothstep( 0.3, 0.6, dot( n, o ) ) ) : s;
}

// a vector in an aperture's frame: the component along its outward normal, and the two in-plane components
void mkApFrame( vec3 v, float code, out float along, out vec2 plane ) {
  float ax = code < 2.5 ? code : code - 3.0;
  if ( ax < 0.5 ) { along = v.x; plane = v.yz; } else if ( ax < 1.5 ) { along = v.y; plane = v.xz; } else { along = v.z; plane = v.xy; }
  along *= code < 2.5 ? 1.0 : - 1.0;
}

// fraction of the outward hemisphere an aperture fills, seen from p (inside), × its openness. Cheap form of the
// rectangle's solid angle: the on-axis disc of equal area, 2π(1 − h/√(h² + a/π)), × (h²/(h² + e²))^1.5 where e is how
// far the foot of p lies beyond the rectangle — exact on the axis, → a·h/d³ far away; the exact four-atan form cost
// ≈ 10 ms a frame inside the Kodesh on the HD 4600 (env/interiors.js keeps the exact form on the CPU).
float mkAperture( vec3 p, vec4 A, vec4 B ) {
  float h; vec2 c;
  mkApFrame( A.xyz - p, B.z, h, c );
  if ( h <= 0.0 ) return 0.0;
  float h2 = h * h, a = 4.0 * B.x * B.y;
  vec2 e = max( abs( c ) - B.xy, vec2( 0.0 ) );
  float k = h2 / ( h2 + dot( e, e ) );
  return ( 1.0 - h * inversesqrt( h2 + a * 0.3183099 ) ) * k * sqrt( k ) * A.w;
}

// Does a reflected ray d leave through aperture (A, B)? Soft-edged by the reflection's blur (roughness × the distance
// to the opening): a gold door at the back of the Ulam mirrors the court through the 20 × 40 opening.
float mkApHit( vec3 p, vec3 d, float rough, vec4 A, vec4 B ) {
  if ( A.w <= 0.0 ) return 0.0;
  float pc, dn; vec2 off, dd;
  mkApFrame( A.xyz - p, B.z, pc, off );
  mkApFrame( d, B.z, dn, dd );
  if ( dn <= 1e-3 || pc <= - 0.05 ) return 0.0;
  float t = max( pc, 0.0 ) / dn;
  vec2 q = abs( dd * t - off );
  float soft = 0.05 + rough * t;
  return ( 1.0 - smoothstep( B.x - soft, B.x + soft, q.x ) ) * ( 1.0 - smoothstep( B.y - soft, B.y + soft, q.y ) ) * A.w;
}

// n, rough: the shading normal (view space) and roughness, for the reflection's exit through the openings
void mkSetup( vec3 viewPos, vec3 viewN, vec3 n, float rough ) {
  mkWorldPos = cameraPosition + ( vec4( viewPos, 0.0 ) * viewMatrix ).xyz;
  mkWorldN = normalize( ( vec4( viewN, 0.0 ) * viewMatrix ).xyz );
  vec4 UA = mkUnionA, UB = mkUnionB;
  mkFlags = int( UA.w + 0.5 );
  mkInvW = UB.w;
  // one test against the union of the selected rooms first (most fragments stop here), then the rooms until the
  // live count, keeping the one the fragment is deepest in; the full test and apertures for it only
  if ( any( lessThan( mkWorldPos, UA.xyz ) ) || any( greaterThan( mkWorldPos, UB.xyz ) ) ) return;
  mkP = mkIntP;
  int nv = int( mkP.x + 0.5 );
  float depth = 0.0, slot = -1.0, depth2 = 0.0, slot2 = -1.0;
  for ( int i = 0; i < ${MK_LIMITS.vol}; i ++ ) {
    if ( i >= nv ) break;
    uvec4 H = mkVolH[ i ]; // one read a room (lighting-polish-fix: two full-precision vec4s before)
    vec2 h0 = unpackHalf2x16( H.x ), h1 = unpackHalf2x16( H.y ), h2 = unpackHalf2x16( H.z );
    vec3 lo = mkWorldPos - vec3( h0, h1.x ), hi = vec3( h1.y, h2 ) - mkWorldPos;
    float d = min( min( min( lo.x, lo.y ), min( lo.z, hi.x ) ), min( hi.y, hi.z ) );
    if ( d > depth ) { depth2 = depth; slot2 = slot; depth = d; slot = float( i ); }
    else if ( d > depth2 ) { depth2 = d; slot2 = float( i ); }
  }
  if ( depth <= 0.0 ) return;
  // pass 2: the deepest room; where two rooms meet (a parochet between the Kodesh and the KhK, a door leaf between
  // a passage and the Ulam) the second one too when the first rejects the surface as facing out of it
  int bi = int( slot + 0.5 );
  vec4 A = mkVolA[ bi ], B = mkVolB[ bi ], C = mkVolC[ bi ];
  float best = mkInside( mkWorldPos, mkWorldN, A.xyz + C.z, B.xyz - C.z, C.z, B.w );
  if ( best < 0.5 && depth2 > 0.0 ) {
    int bj = int( slot2 + 0.5 );
    vec4 A2 = mkVolA[ bj ], B2 = mkVolB[ bj ], C2 = mkVolC[ bj ];
    float s2 = mkInside( mkWorldPos, mkWorldN, A2.xyz + C2.z, B2.xyz - C2.z, C2.z, B2.w );
    if ( s2 > best ) { best = s2; bi = bj; A = A2; C = C2; }
  }
  if ( best <= 0.0 ) return;
  float v = A.w;
  mkA0 = int( C.x + 0.5 ); mkNa = int( C.y + 0.5 );
  // one pass over the apertures: the sky visibility and the reflection's exit (mkIBL used to read them again)
  vec3 Rv = reflect( normalize( viewPos ), n );
  Rv = normalize( mix( Rv, n, pow4( rough ) ) );
  vec3 Rw = ( vec4( Rv, 0.0 ) * viewMatrix ).xyz;
  float hit = 0.0;
  for ( int k = 0; k < ${MK_LIMITS.ap}; k ++ ) {
    if ( k >= mkNa ) break;
    vec4 AA = mkApA[ mkA0 + k ], AB = mkApB[ mkA0 + k ];
    v += mkAperture( mkWorldPos, AA, AB );
    hit = max( hit, mkApHit( mkWorldPos, Rw, rough, AA, AB ) );
  }
  mkHit = best * hit;
  mkSlot = float( bi );
  mkV = mix( 1.0, clamp( v, 0.0, 1.0 ), best );
  mkVol = mkSlot + 1.0;
  mkS = best;
  if ( C.w > 0.0 ) {
    mkFillAt = mkVolD[ bi ];
    mkFill = C.w * best;
  }
}

// direct light (sun / moon) on tiers without shadow maps, and during probe captures
float mkDirK() { return mix( 1.0, mkV, mkP.z ); }

// a point light in another volume reaches this fragment only through the openings of both (no block read for an
// outdoor fragment while no light stands in a room)
// fx multiplies each fire light by the sky visibility at the fire (render/fx/lights.js, mkPtVol[i].y): an outdoor
// fragment takes it as it comes — no block read — while a fragment in a room divides it out for a light in the same
// room and multiplies its own visibility for any other (lighting-polish-fix; per-light block reads for every
// fragment cost ≈ 0.5 ms a light at low whenever a lamp burned in a selected room)
#define mkPtOccAt( i ) ( mkVol < 0.5 ? 1.0 : mkPtOcc( mkPtVol[ i ].xy ) )
float mkPtOcc( vec2 lv ) {
  if ( lv.x > 0.5 && abs( lv.x - mkVol ) < 0.5 ) return 1.0 / max( lv.y, 1e-4 );
  return mkV;
}

#if defined( ENVMAP_TYPE_CUBE_UV )
// bilinearCubeUV for one slice of a horizontal atlas of PMREMs (slice stride = PMREM width + gap). A plain PMREM
// is an atlas of one slice, so this equals three's own sampling for slice 0.
vec3 mkBilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt, float slice ) {
  float face = getFace( direction );
  float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
  mipInt = max( mipInt, cubeUV_minMipLevel );
  float faceSize = exp2( mipInt );
  highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
  if ( face > 2.0 ) { uv.y += faceSize; face -= 3.0; }
  uv.x += face * faceSize;
  uv.x += filterInt * 3.0 * cubeUV_minTileSize;
  uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
  uv.x = ( uv.x + slice * ( 1.0 / CUBEUV_TEXEL_WIDTH + ${MK_LIMITS.gap}.0 ) ) * ( mkInvW > 0.0 ? mkInvW : CUBEUV_TEXEL_WIDTH );
  uv.y *= CUBEUV_TEXEL_HEIGHT;
  #ifdef texture2DGradEXT
    return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
  #else
    return texture2D( envMap, uv ).rgb;
  #endif
}
vec3 mkTextureCubeUV( sampler2D envMap, vec3 dir, float roughness, float slice ) {
  float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
  float mipInt = floor( mip ), mipF = fract( mip );
  vec3 c0 = mkBilinearCubeUV( envMap, dir, mipInt, slice );
  if ( mipF == 0.0 ) return c0; // irradiance (roughness 1) sits on a whole mip: one fetch, as three's own
  return mix( c0, mkBilinearCubeUV( envMap, dir, mipInt + 1.0, slice ), mipF );
}
vec4 mkSky( sampler2D envMap, vec3 dir, float roughness ) { return vec4( mkTextureCubeUV( envMap, dir, roughness, 0.0 ), 1.0 ); }

// parallax-corrected direction: where the ray from p hits the proxy box, seen from the capture point c
vec3 mkBoxProject( vec3 dir, vec3 p, vec3 bmin, vec3 bmax, vec3 c ) {
  vec3 inv = 1.0 / ( sign( dir ) * max( abs( dir ), vec3( 1e-5 ) ) );
  vec3 tf = max( ( bmax - p ) * inv, ( bmin - p ) * inv );
  float t = min( tf.x, min( tf.y, tf.z ) );
  return t > 0.0 ? normalize( p + dir * t - c ) : dir;
}

vec3 mkIrr = vec3( 0.0 );
vec3 mkRad = vec3( 0.0 );
vec3 mkDbgW = vec3( 0.0 ); // probe weights (debug view 2): interior probe, outdoor probes, sky
void mkIBL( vec3 viewDir, vec3 normal, float roughness ) {
  vec3 Nw = transformNormalByInverseViewMatrix( normal, viewMatrix );
  vec3 R = reflect( - viewDir, normal );
  R = normalize( mix( R, normal, pow4( roughness ) ) );
  vec3 Rw = transformDirectionByInverseViewMatrix( R, viewMatrix );
  mkIrr = vec3( 0.0 ); mkRad = vec3( 0.0 );
  float rem = 1.0;
  // Outdoor light inside a room (lighting-polish-fix). It comes in through the openings, which show the lit court
  // — sunlit and shaded stone, a little sky — not the sky overhead that env(N) would give a floor or a ceiling: the
  // gold of the Kodesh on low (no probe) read olive under blue zenith sky × V. So inside (× mkS) the diffuse light
  // is V × the openings' radiance Lb (mkIntEnv, per unit sky irradiance), and a reflection that does not leave
  // through an opening sees the room's own surfaces lit by it (albedo × V × Lb); one that does sees outdoors.
  float hit = mkHit;
  vec3 LbN = vec3( 0.0 ), inRad = vec3( 0.0 );
  if ( mkS > 0.0 ) {
    vec4 ie = mkIntEnv;
    LbN = ie.xyz;
    inRad = ie.w * mkV * LbN; // the room's own surfaces in a reflection (per unit sky irradiance)
  }
  // the probe loop is compiled only where probes exist (MK_PROBES: medium+): its code alone cost ≈ 3 ms a frame at
  // low on the HD 4600 (register pressure for every lit fragment) though no probe was ever read there
  #ifdef MK_PROBES
  int np = mkFlags & MK_F_PROBES;
  for ( int k = 0; k < ${MK_LIMITS.probe}; k ++ ) {
    if ( k >= np ) break;
    // the influence boxes are stored grown by their margin: a fragment outside reads two vec4s for the probe
    vec4 PA = mkPrA[ k ], PB = mkPrB[ k ];
    if ( rem < 1e-3 || any( lessThan( mkWorldPos, PA.xyz ) ) || any( greaterThan( mkWorldPos, PB.xyz ) ) ) continue;
    vec4 PC = mkPrC[ k ], PE = mkPrE[ k ];
    float sc = PC.w, m = PE.w;
    float w = sc > 0.0 ? mkInside( mkWorldPos, mkWorldN, PA.xyz + m, PB.xyz - m, m, PB.w ) * mkPrF[ k ].x * rem : 0.0;
    if ( w >= 1e-3 ) {
      vec4 PD = mkPrD[ k ];
      bool outdoor = PD.w > 0.5;
      vec3 Rp = mkBoxProject( Rw, mkWorldPos, PD.xyz, PE.xyz, PC.xyz );
      vec3 irr = sc * mkTextureCubeUV( envMap, Nw, 1.0, PA.w );
      vec3 rad = sc * mkTextureCubeUV( envMap, Rp, roughness, PA.w );
      if ( outdoor ) {
        float E = envMapIntensity; // scene units per unit sky irradiance
        irr = mkV * mix( irr, LbN * E, mkS );
        rad = hit * rad + ( 1.0 - hit ) * mix( rad, inRad * E, mkS );
        mkDbgW.g += w;
      } else mkDbgW.r += w;
      mkIrr += w * PI * irr;
      mkRad += w * rad;
      rem -= w;
    }
  }
  #endif
  mkDbgW.b = rem;
  // lamp light filling a room with no probe (low tier, chambers), in the colour of the fires' own light. Its
  // reflection is the fill where the reflected ray has travelled as far as the fires (glossy gold mirrors the
  // lamp-lit end of the room, not a flat wash); rough surfaces see the local fill
  if ( mkFill > 0.0 ) {
    vec3 fd0 = mkWorldPos - mkFillAt.xyz;
    vec3 fd1 = fd0 + Rw * length( fd0 );
    float f0 = mkFill * mkFillAt.w / ( mkFillAt.w + dot( fd0, fd0 ) );
    float f1 = mkFill * mkFillAt.w / ( mkFillAt.w + dot( fd1, fd1 ) );
    vec3 fc = mkFillCol.xyz;
    mkIrr += PI * f0 * fc;
    mkRad += mix( f1, f0, roughness ) * fc;
  }
  if ( rem >= 1e-3 ) {
    float g = rem * envMapIntensity;
    vec3 irr = mkTextureCubeUV( envMap, envMapRotation * Nw, 1.0, 0.0 );
    vec3 rad = mkTextureCubeUV( envMap, envMapRotation * Rw, roughness, 0.0 );
    mkIrr += g * mkV * PI * mix( irr, LbN, mkS );
    mkRad += g * ( hit * rad + ( 1.0 - hit ) * mix( rad, inRad, mkS ) );
  }
}
#endif

// debug views (ctx.env.interiors.debug): 1 sky visibility (grey, sqrt for legibility), 2 volume tint x probe weights
vec3 mkDebugColor() {
  if ( ( mkFlags & MK_F_DEBUG ) == 16 ) return vec3( sqrt( mkV ) );
  vec3 c = mkVol > 0.5 ? 0.35 + 0.65 * fract( vec3( 0.37, 0.61, 0.83 ) * mkVol ) : vec3( 1.0 );
  #if defined( ENVMAP_TYPE_CUBE_UV )
    c *= 0.4 + 0.6 * mkDbgW;
  #endif
  return c;
}
`;

let installed = false;

/**
 * Install the patch into three's ShaderChunk (once, before any lit program compiles). Returns false (and changes
 * nothing) when the stock chunks do not have the expected shape — a future three version.
 */
export function installInteriorChunks(ShaderChunk, { probes = true } = {}) {
  if (installed || ShaderChunk.__mkInt) return true;
  probesOn = !!probes;
  const env = ShaderChunk.envmap_physical_pars_fragment;
  const begin = ShaderChunk.lights_fragment_begin;
  const maps = ShaderChunk.lights_fragment_maps;
  STOCK.envmap_physical_pars_fragment = env; STOCK.lights_fragment_begin = begin; STOCK.lights_fragment_maps = maps;
  const IRR = 'iblIrradiance += getIBLIrradiance( geometryNormal );';
  const RAD = 'vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );';
  const PT = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
  const SUN = 'getSunLightInfo( sunLight, directLight );';
  const DIR = 'getDirectionalLightInfo( directionalLight, directLight );';
  const ok = env.includes('textureCubeUV( envMap,') && maps.includes(IRR) && maps.includes(RAD)
    && begin.includes(PT) && begin.includes(DIR) && ShaderChunk.normal_fragment_begin.includes('nonPerturbedNormal');
  if (!ok) { console.warn('[env] three lighting chunks changed — interior light / probes unavailable'); return false; }
  ShaderChunk.envmap_physical_pars_fragment = envChunk(env);
  ShaderChunk.lights_fragment_begin = `
#ifdef MK_INT
  mkSetup( - vViewPosition, nonPerturbedNormal, normal, material.roughness );
#endif
${begin
    .replace(PT, `${PT}\n\t\t#ifdef MK_INT\n\t\tdirectLight.color *= mkPtOccAt( UNROLLED_LOOP_INDEX );\n\t\t#endif`)
    .replace(SUN, `${SUN}\n\t\t#ifdef MK_INT\n\t\tdirectLight.color *= mkDirK();\n\t\t#endif`)
    .replace(DIR, `${DIR}\n\t\t#ifdef MK_INT\n\t\tdirectLight.color *= mkDirK();\n\t\t#endif`)}`;
  ShaderChunk.lights_fragment_maps = `
#if defined( MK_INT ) && defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
  mkIBL( geometryViewDir, geometryNormal, material.roughness );
#endif
${maps
    .replace(IRR, `#if defined( MK_INT ) && defined( ENVMAP_TYPE_CUBE_UV )\n\t\t\tiblIrradiance += mkIrr;\n\t\t\t#else\n\t\t\t${IRR}\n\t\t\t#endif`)
    .replace(RAD, `#if defined( MK_INT ) && defined( ENVMAP_TYPE_CUBE_UV )\n\t\tvec3 iblRadiance = mkRad;\n\t\t#else\n\t\t${RAD}\n\t\t#endif`)}`;
  for (const k of PATCHED) PATCH[k] = ShaderChunk[k];
  ShaderChunk.__mkInt = true;
  installed = true;
  return true;
}

const PATCHED = ['envmap_physical_pars_fragment', 'lights_fragment_begin', 'lights_fragment_maps'];
const STOCK = {}, PATCH = {};
let probesOn = true;
// stock IBL helpers (clearcoat, anisotropy) read the sky slice of the atlas
function envChunk(env) {
  return `${probesOn ? '#define MK_PROBES\n' : ''}${PARS}\n${env.replaceAll('textureCubeUV( envMap,', 'mkSky( envMap,')}`;
}

/**
 * Compile the probe loop in or out (tiers with / without scene probes). Returns true when the chunk changed: every
 * lit material must then recompile (material.needsUpdate) — env does it on a tier switch.
 */
export function setInteriorProbes(ShaderChunk, on) {
  if (!installed || probesOn === !!on) return false;
  probesOn = !!on;
  const k = 'envmap_physical_pars_fragment';
  const active = ShaderChunk[k] === PATCH[k];
  PATCH[k] = envChunk(STOCK[k]);
  if (active) ShaderChunk[k] = PATCH[k];
  return true;
}

/**
 * Debug / profiling only: switch the patched chunks off (stage 0) or on (3), or partly (1: declarations only,
 * 2: + light hooks and mkSetup); every lit material must then recompile (material.needsUpdate).
 */
export function setInteriorStage(ShaderChunk, stage) {
  if (!installed) return;
  PATCHED.forEach((k, i) => { ShaderChunk[k] = stage > i ? PATCH[k] : STOCK[k]; });
}

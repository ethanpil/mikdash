// Global shader-chunk patch for MeshStandard/Physical materials (every world, people and terrain material):
//
//  1. INTERIOR VOLUMES — boxes (roofed rooms from site.js) with rectangular APERTURES (doors, windows, a portico's
//     open side). A fragment inside a volume sees the outdoor sky only through the apertures: its sky visibility
//     V = base + Σ Ω(aperture) / 2π × openness (Ω = exact solid angle of the rectangle from the fragment). V scales
//     the outdoor image-based light (sky PMREM, outdoor probes) and the light of point lights in OTHER volumes (fires
//     in the court do not light the Kodesh through its walls). The sun / moon reaches a fragment in a room only where
//     the ray toward it leaves through an aperture (render-env-2: the shadow maps leaked light stripes into corners
//     and along ceilings; on tiers without shadow maps this mask is the room's sun shadow). Specular keeps the outdoor
//     light where the reflected ray leaves through an opening. Surfaces near a volume's boundary that face OUTWARD
//     count as outside (the outer face of a wall whose box includes the wall), so a box may be the room's inner or
//     outer extent.
//  2. REFLECTION PROBES — scene-captured PMREMs stored as extra SLICES of one CubeUV atlas (scene.environment), so
//     no extra sampler is needed: slice 0 is env's sky PMREM (× envMapIntensity, as before), slices 1..n are local
//     probes (× their own exposure ratio), each with an influence box (weight) and a proxy box (box-projected
//     reflections: gold walls reflect the opposite gold walls where they really are). Interior probes are not
//     attenuated by V (they already see the room as it is lit); outdoor probes and the sky are.
//  3. FIRE OCCLUDERS — analytic, compile-time constant shapes (env/volumes.js defineFireOccluders): a court's walls
//     and the top of the altar stop a fire's light where no shadow map does (render-env-2).
//
// All runtime data lives in ONE std140 uniform block, MkInteriors (env/uniforms.js UniformBlock): as plain uniforms
// it was re-uploaded by ANGLE/D3D11 with every draw call. Every block read is a memory load on Intel iGPUs (≈ 1–2 ms a
// frame per vec4 per fragment at medium on the HD 4600), so the data is packed (render-env-2): a fragment inside the
// union of the selected rooms finds its candidate rooms in a plan-view grid (one load) instead of testing every room;
// apertures, probe boxes and point-light records are 16-bit fixed point / halves in uvec4s.
export const MK_LIMITS = { vol: 12, ap: 16, probe: 4, lights: 16, gap: 8, gridX: 32, gridZ: 24, occ: 1 };
MK_LIMITS.grid = (MK_LIMITS.gridX * MK_LIMITS.gridZ) / 8; // uvec4s: 8 cells of 16 bits each

/** member layout of the MkInteriors block: [name, vec4 count] (std140: vec4 / uvec4 arrays are tightly packed) */
export const MK_BLOCK = [
  ['mkVolA', MK_LIMITS.vol], ['mkVolB', MK_LIMITS.vol], ['mkVolC', MK_LIMITS.vol], ['mkVolD', MK_LIMITS.vol],
  ['mkApU', MK_LIMITS.ap],
  ['mkPrH', MK_LIMITS.probe], ['mkPrC', MK_LIMITS.probe], ['mkPrD', MK_LIMITS.probe], ['mkPrE', MK_LIMITS.probe],
  ['mkIntP', 1], ['mkIntQ', 1], ['mkUnionA', 1], ['mkUnionB', 1], ['mkPtU', MK_LIMITS.lights / 4],
  ['mkIntEnv', 1], ['mkFillCol', 1], ['mkVolH', MK_LIMITS.vol], ['mkKey', 1], ['mkOcc', MK_LIMITS.occ], ['mkGrid', MK_LIMITS.grid],
];

/** flag bits in mkUnionA.w (a float: exact to 2^24): occluded fire lights at occShift (1 bit; which ones: mkOcc[0].w) */
export const MK_FLAGS = { probes: 7, ptRoom: 8, capture: 16, debugShift: 5, occShift: 8, intShift: 14 };

/** fire occluders: a receiver counts as beyond a court's walls once this far outside their outer faces (m, faded) */
export const OCC_EDGE = 0.1;

const f = (v) => (Number.isFinite(v) ? v : 0).toFixed(4);
const v4 = (a) => `vec4( ${a.map(f).join(', ')} )`;

function pars({ origin, records }) {
  const R = (records.length ? records : [{ enc: null, plate: null }]).slice(0, 4);
  // the fire occluder records as literal constants, selected by a chain of ternaries with immediate operands
  // (render-env-2-fix; was an if / else chain of constant assignments, the pattern FXC may fold into an indexed
  // immediate constant buffer — no difference measurable on the HD 4600 in a frame-interleaved A/B, kept as the safer form)
  const sel = (get) => R.slice(0, -1).reduceRight((acc, r, i) => `r == ${i} ? ${v4(get(r))} : ${acc}`, v4(get(R[R.length - 1])));
  const recordFn = ['void mkOccRecord( int r, out vec4 E, out vec4 T, out vec4 P, out vec4 Q ) {',
    `  E = ${sel((r) => (r.enc ? r.enc.rect : [0, 0, 0, 0]))};`,
    `  T = ${sel((r) => (r.enc ? r.enc.tops : [0, 0, 0, 0]))};`,
    `  P = ${sel((r) => (r.plate ? r.plate.rect : [0, 0, 0, 0]))};`,
    `  Q = ${sel((r) => [r.plate ? r.plate.top : 0, 0, r.plate ? 1 : 0, r.enc ? 1 : 0])};`,
    '}'].join('\n');
  return /* glsl */`
#define MK_INT
layout( std140 ) uniform MkInteriors {
  vec4 mkVolA[ ${MK_LIMITS.vol} ];  // xyz box min − margin (world m), w base sky visibility
  vec4 mkVolB[ ${MK_LIMITS.vol} ];  // xyz box max + margin, w shell: outward-facing surfaces this deep count as outside
  vec4 mkVolC[ ${MK_LIMITS.vol} ];  // x first aperture, y aperture count, z margin (m), w fire fill (scene units)
  vec4 mkVolD[ ${MK_LIMITS.vol} ];  // xyz the room's fire centroid, w falloff radius² (m²) of the fire fill
  uvec4 mkApU[ ${MK_LIMITS.ap} ];   // x,y.lo centre − its room's mkVolA (cm), y.hi openness, brightness beyond (unorm8),
                                    // z half extents (cm), w normal axis code (0..2 outward +, 3..5 −)
  uvec4 mkPrH[ ${MK_LIMITS.probe} ]; // influence box grown by its margin (cm from MK_ORIGIN), w half2( shell, margin )
  vec4 mkPrC[ ${MK_LIMITS.probe} ]; // xyz capture position, w intensity (P now / P at capture …); 0 = unused
  vec4 mkPrD[ ${MK_LIMITS.probe} ]; // xyz proxy min, w weight (fades a stale probe out) + 2 × its sky share × 255
  vec4 mkPrE[ ${MK_LIMITS.probe} ]; // xyz proxy max, w atlas slice + 8 for an outdoor probe (× sky visibility) + 16 × (cap + 16 × mode: all openings / the main one); fraction: V at an interior probe whose irradiance follows V
  vec4 mkIntP;                      // x volume count, y camera volume + 1 (0 none), z direct-light attenuation 0..1, w debug view
  vec4 mkIntQ;                      // z probe capture gain, w its texel clamp (read only while the capture flag is set)
  vec4 mkUnionA;                    // xyz min of all the selected rooms' grown boxes, w flags (MK_F_*) + active probes
  vec4 mkUnionB;                    // xyz max, w 1 / width of scene.environment (texels; 0 = three's own)
  uvec4 mkPtU[ ${MK_LIMITS.lights / 4} ]; // per point light (shader order): lo half the sky visibility at it, bits 16–19 its room + 1
  vec4 mkIntEnv;                    // xyz what a room's openings show (lit court stone + some sky) / sky irradiance; w albedo of the room's surfaces
  vec4 mkFillCol;                   // xyz colour of the fires' light (the point lights' own colour)
  uvec4 mkVolH[ ${MK_LIMITS.vol} ]; // the grown boxes as halves (conservatively rounded): x min.xy, y min.z max.x, z max.yz; w gold gain (3 × 10 bits / 256), bit 30 the room's own probe
  vec4 mkKey;                       // xyz world direction toward the key light (sun / moon), w the sun mask's slack (m)
  vec4 mkOcc[ ${MK_LIMITS.occ} ];   // the occluded fire lights: xyz their centroid (world), w record + 4 × their light mask + radius / 4
  uvec4 mkGrid[ ${MK_LIMITS.grid} ]; // plan grid over the union box (${MK_LIMITS.gridX} × ${MK_LIMITS.gridZ} cells of 16 bits): up to 4 room slots + 1
};
const vec3 MK_ORIGIN = vec3( ${f(origin[0])}, ${f(origin[1])}, ${f(origin[2])} );
${recordFn}

// a fragment outside every room reads only the two union vec4s, whose w carry what it still needs — the flags and
// probe count (A.w) and the atlas width (B.w); mkIntP is read inside the union only
#define MK_F_PROBES ${MK_FLAGS.probes}
#define MK_F_PTROOM ${MK_FLAGS.ptRoom}
#define MK_F_CAPTURE ${MK_FLAGS.capture}
#define MK_F_DEBUG ( 3 << ${MK_FLAGS.debugShift} )
int mkFlags = 0;        // mkUnionA.w: bits 0–2 active probes, 3 a point light in a selected room, 4 capture, 5–6 debug view, 8 occluded fire lights (mkOcc), 14–16 interior probes (listed first)
float mkInvW = 0.0;     // mkUnionB.w
float mkV = 1.0;      // sky visibility at this fragment (1 outdoors)
float mkVap = 1.0;    // … through its room's apertures only (without the closed room's floor): lights outside the room
float mkVm = 0.0;     // … through its room's main (first) opening alone: the Kodesh's great gate (render-audio-3, the probe's irradiance)
float mkVol = 0.0;    // its volume slot + 1 (0 outdoors)
float mkS = 0.0;      // how far inside it
float mkSun = 1.0;    // the key light's way out of the room (1 outdoors)
uint mkHw = 0u;       // its packed record word: gold gain (3 × 10 bits / 256), bit 30 its own probe (mkVolH.w)
float mkFill = 0.0;   // the room's own fires, interreflected (rooms without a probe; × insideness)
int mkOccMask = 0;     // the occluded fire lights' shader indices (bit mask)
float mkOccV0 = 1.0;   // … and their visibility from this fragment
float mkHit = 0.0;    // the part of the reflection that leaves the room through an opening (× insideness)
#ifdef MK_DEBUG
vec3 mkDbgPath = vec3( 0.0 ); // debug view 3: r inside the union, g the cell lists rooms, b inside a room
#endif
// render-env-2-fix: only the values above stay live from mkSetup through three's light loop to the IBL (the world
// position and normal, the room's gain and fill centre are recomputed or read where they are used): fewer registers
// held across the unrolled light loop

// how far inside a box: 1 inside, fading to 0 at margin outside; outward-facing surfaces in the shell -> 0 —
// except on the box's floor face: a floor is solid ground, never an opening to the sky — and on the faces in joins
// (bits 0–5: world −x, +x, −y, +y, −z, +z), which border another room, not the open (qa-r1-fix-env-render)
float mkInside( vec3 p, vec3 n, vec3 bmin, vec3 bmax, float margin, float shell, int joins ) {
  vec3 lo = p - bmin, hi = bmax - p;
  vec3 dm = min( lo, hi );
  float d = min( dm.x, min( dm.y, dm.z ) );
  float s = smoothstep( - margin, 0.0, d );
  vec3 o = dm.x <= dm.y && dm.x <= dm.z ? vec3( lo.x < hi.x ? - 1.0 : 1.0, 0.0, 0.0 )
    : dm.y <= dm.z ? vec3( 0.0, lo.y < hi.y ? - 1.0 : 1.0, 0.0 ) : vec3( 0.0, 0.0, lo.z < hi.z ? - 1.0 : 1.0 );
  int fb = abs( o.x ) > 0.5 ? ( o.x > 0.0 ? 1 : 0 ) : abs( o.y ) > 0.5 ? ( o.y > 0.0 ? 3 : 2 ) : ( o.z > 0.0 ? 5 : 4 );
  bool joined = ( ( joins >> fb ) & 1 ) != 0;
  return d < shell && o.y > - 0.5 && ! joined ? s * ( 1.0 - smoothstep( 0.3, 0.6, dot( n, o ) ) ) : s;
}

// An aperture's frame, built once per aperture without branches: its outward normal and two in-plane axes (axis code
// 0..2 outward +, 3..5 outward −). Fewer branches per aperture keep the loop small for FXC (compile time on ANGLE).
struct MkApF { vec3 n; vec3 u; vec3 v; };
MkApF mkApFrame( float code ) {
  float ax = code < 2.5 ? code : code - 3.0;
  vec3 a = vec3( step( abs( ax ), 0.5 ), step( abs( ax - 1.0 ), 0.5 ), step( abs( ax - 2.0 ), 0.5 ) );
  MkApF F;
  F.n = a * ( code < 2.5 ? 1.0 : - 1.0 );
  F.u = vec3( a.y + a.z, a.x, 0.0 );       // x → y, y → x, z → x
  F.v = vec3( 0.0, a.z, a.x + a.y );       // x → z, y → z, z → y
  return F;
}

// fraction of the outward hemisphere an aperture (centre c, half extents he, frame F, weight w) fills, seen from p
// (inside). Cheap form of the rectangle's solid angle: the on-axis disc of equal area × (h²/(h² + e²))^1.5 where e is
// how far the foot of p lies beyond the rectangle (env/interiors.js keeps the exact four-atan form on the CPU).
float mkAperture( vec3 d, vec2 he, MkApF F, float w ) {
  float h = dot( d, F.n );
  if ( h <= 0.0 ) return 0.0;
  vec2 cc = vec2( dot( d, F.u ), dot( d, F.v ) );
  float h2 = h * h, a = 4.0 * he.x * he.y;
  vec2 e = max( abs( cc ) - he, vec2( 0.0 ) );
  float k = h2 / ( h2 + dot( e, e ) );
  return ( 1.0 - h * inversesqrt( h2 + a * 0.3183099 ) ) * k * sqrt( k ) * w;
}

// Does a ray r leave through the aperture (d = centre − p)? Soft-edged by soft0 + soft1 × the distance to the opening
// (a reflection's blur: roughness; the key light's mask: a slack where shadow maps draw the true edge).
float mkApHit( vec3 d, vec3 r, float soft0, float soft1, vec2 he, MkApF F ) {
  float pc = dot( d, F.n ), dn = dot( r, F.n );
  if ( dn <= 1e-3 || pc <= - 0.05 ) return 0.0;
  float t = max( pc, 0.0 ) / dn;
  vec2 q = abs( vec2( dot( r, F.u ), dot( r, F.v ) ) * t - vec2( dot( d, F.u ), dot( d, F.v ) ) );
  float soft = soft0 + soft1 * t;
  return ( 1.0 - smoothstep( he.x - soft, he.x + soft, q.x ) ) * ( 1.0 - smoothstep( he.y - soft, he.y + soft, q.y ) );
}

// qa-r1-fix-env-render: a row of n windows evenly spaced along the aperture's u axis (bits of its axis word: 4–7 n,
// 8–15 period, 16–21 inner width, 22–27 outer width in 4 cm, 28–31 the wall's depth in 20 cm), each narrow at the room's
// face (the aperture plane) and wide at the outer face (Menachot 86b). The ray r leaves through one only if it passes
// both ends of that window; the beam keeps the key light's full strength. d = aperture centre − p.
float mkSlot( vec3 d, vec3 r, vec2 he, MkApF F, uint bits ) {
  float dn = dot( r, F.n );
  if ( dn <= 1e-3 ) return 0.0;
  float n = float( ( bits >> 4 ) & 15u ), period = float( ( bits >> 8 ) & 255u ) * 0.04;
  float wi = float( ( bits >> 16 ) & 63u ) * 0.02, wo = float( ( bits >> 22 ) & 63u ) * 0.02; // half widths
  float depth = float( bits >> 28 ) * 0.2;
  float t = max( dot( d, F.n ), 0.0 ) / dn;
  vec2 q = vec2( dot( r, F.u ), dot( r, F.v ) ) * t - vec2( dot( d, F.u ), dot( d, F.v ) );
  vec2 sh = vec2( dot( r, F.u ), dot( r, F.v ) ) / dn * depth; // where the ray meets the outer face
  float c = ( n - 1.0 ) * 0.5;
  float u = q.x - ( clamp( floor( q.x / max( period, 0.01 ) + c + 0.5 ), 0.0, n - 1.0 ) - c ) * period;
  float s = 0.02 + 0.005 * t; // the Sun's penumbra over the way from the window
  float pu = ( 1.0 - smoothstep( wi - s, wi + s, abs( u ) ) ) * ( 1.0 - smoothstep( wo - s, wo + s, abs( u + sh.x ) ) );
  float pv = ( 1.0 - smoothstep( he.y - s, he.y + s, abs( q.y ) ) ) * ( 1.0 - smoothstep( he.y - s, he.y + s, abs( q.y + sh.y ) ) );
  return pu * pv;
}

// depth of p inside a room's coarse (half-float) box
float mkHalfDepth( uvec4 H, vec3 p ) {
  vec2 h0 = unpackHalf2x16( H.x ), h1 = unpackHalf2x16( H.y ), h2 = unpackHalf2x16( H.z );
  vec3 lo = p - vec3( h0, h1.x ), hi = vec3( h1.y, h2 ) - p;
  return min( min( min( lo.x, lo.y ), min( lo.z, hi.x ) ), min( hi.y, hi.z ) );
}

// Fire occluders (render-env-2): the fire at L lights P only over a court's walls and not down through the top of
// the solid it stands on. Soft: the edge is compared with the flames' radius at the fire's distance (a 2 m pile's
// penumbra is metres wide close to the altar). Shapes are compile-time constants (no block reads).
float mkFireOcc( vec3 L, vec3 P, int r, float rad ) {
  vec4 E, T, R, Q;
  mkOccRecord( r, E, T, R, Q );
  vec3 d = P - L;
  float vis = 1.0;
  rad = max( rad, 0.02 );
  if ( Q.z > 0.5 && L.y > Q.x && P.y < Q.x ) {
    float t = ( L.y - Q.x ) / ( L.y - P.y );
    vec2 q = L.xz + d.xz * t;
    vec2 e = min( q - R.xy, R.zw - q );
    vis *= 1.0 - smoothstep( - rad, rad, min( e.x, e.y ) / max( 1.0 - t, 1e-3 ) );
  }
  if ( Q.w > 0.5 ) {
    // how far outside the walls' outer faces (render-env-2-fix: faded in over MK_OCC_EDGE so a surface on the boundary
    // cannot flip between lit and shadowed with sub-millimetre position noise)
    vec2 lo = P.xz - E.xy, hi = E.zw - P.xz;
    float outside = - min( min( lo.x, lo.y ), min( hi.x, hi.y ) );
    if ( outside > 0.0 ) {
      vec2 inv = vec2( abs( d.x ) > 1e-4 ? 1.0 / d.x : 1e4, abs( d.z ) > 1e-4 ? 1.0 / d.z : 1e4 );
      vec2 te = vec2( ( ( d.x > 0.0 ? E.z : E.x ) - L.x ) * inv.x, ( ( d.z > 0.0 ? E.w : E.y ) - L.z ) * inv.y );
      float t = min( te.x, te.y );
      float top = te.x < te.y ? ( d.x > 0.0 ? T.y : T.x ) : ( d.z > 0.0 ? T.w : T.z );
      float u = ( top - ( L.y + d.y * t ) ) / max( 1.0 - t, 1e-3 );
      vis *= 1.0 - smoothstep( - rad, rad, u ) * smoothstep( 0.0, ${OCC_EDGE.toFixed(2)}, outside );
    }
  }
  return vis;
}

// The room a fragment is in (P, N: world position and geometric normal; n, rough: the shading normal (view space) and
// roughness, for the reflection's exit through the openings). Early exits for the many fragments outside every room.
// The loops below run to a data-dependent count (not a constant bound with a break): FXC keeps them as loops instead of
// unrolling every iteration (compile time on ANGLE/D3D11)
void mkRoom( vec4 UA, vec4 UB, vec3 viewPos, vec3 n, float rough, vec3 P, vec3 N ) {
  // one test against the union of the selected rooms first (most fragments stop here), then the candidate rooms of
  // the fragment's plan cell, keeping the one it is deepest in; the full test and apertures for that one only
  if ( any( lessThan( P, UA.xyz ) ) || any( greaterThan( P, UB.xyz ) ) ) return;
  #ifdef MK_DEBUG
  mkDbgPath.r = 1.0;
  #endif
  vec2 gq = ( P.xz - UA.xz ) / max( UB.xz - UA.xz, vec2( 1e-3 ) ) * vec2( ${MK_LIMITS.gridX}.0, ${MK_LIMITS.gridZ}.0 );
  ivec2 gi = clamp( ivec2( gq ), ivec2( 0 ), ivec2( ${MK_LIMITS.gridX - 1}, ${MK_LIMITS.gridZ - 1} ) );
  int gc = gi.x + gi.y * ${MK_LIMITS.gridX};
  uvec4 GW = mkGrid[ gc >> 3 ];
  int gk = ( gc >> 1 ) & 3;
  uint gw = gk == 0 ? GW.x : gk == 1 ? GW.y : gk == 2 ? GW.z : GW.w;
  uint cell = ( gw >> uint( ( gc & 1 ) << 4 ) ) & 0xffffu;
  if ( cell == 0u ) return;
  #ifdef MK_DEBUG
  mkDbgPath.g = 1.0;
  #endif
  float depth = 0.0, slot = -1.0, depth2 = 0.0, slot2 = -1.0;
  uint hw = 0u, hw2 = 0u;
  for ( int k = 0; k < 4; k ++ ) {
    uint s = ( cell >> uint( 4 * k ) ) & 15u;
    if ( s == 0u ) break;
    int i = int( s ) - 1;
    uvec4 H = mkVolH[ i ];
    float d = mkHalfDepth( H, P );
    if ( d > depth ) { depth2 = depth; slot2 = slot; hw2 = hw; depth = d; slot = float( i ); hw = H.w; }
    else if ( d > depth2 ) { depth2 = d; slot2 = float( i ); hw2 = H.w; }
  }
  if ( depth <= 0.0 ) return;
  // pass 2: the deepest room; where two rooms meet (a parochet between the Kodesh and the KhK, a door leaf between
  // a passage and the Ulam) the second one too when the first rejects the surface as facing out of it
  int bi = int( slot + 0.5 );
  vec4 A = mkVolA[ bi ], B = mkVolB[ bi ], C = mkVolC[ bi ];
  // mkVolB.w = shell (m) + 4 × the faces joining another room (env/interiors.js)
  float sh = mod( B.w, 4.0 );
  int jn = int( B.w * 0.25 );
  float best = mkInside( P, N, A.xyz + C.z, B.xyz - C.z, C.z, sh, 0 );
  // qa-r1-fix-env-render: where two rooms meet, a surface facing out of one faces INTO the other, never into the open:
  // its insideness is at least either room's own (without the shell rule), and on a face joining another room a surface
  // beyond that room's reach stays in its own. Both were mixed toward open sky and lit near white — the inner parochet's
  // east face in the amah traksin, seen through the outer one's pinned-back south end.
  float other = 0.0;
  bool swapped = false;
  if ( best < 0.5 && depth2 > 0.0 ) {
    int bj = int( slot2 + 0.5 );
    vec4 A2 = mkVolA[ bj ], B2 = mkVolB[ bj ], C2 = mkVolC[ bj ];
    float s2 = mkInside( P, N, A2.xyz + C2.z, B2.xyz - C2.z, C2.z, mod( B2.w, 4.0 ), 0 );
    if ( s2 > best ) {
      other = mkInside( P, N, A.xyz + C.z, B.xyz - C.z, C.z, 0.0, 0 );
      best = s2; bi = bj; A = A2; C = C2; hw = hw2; swapped = true;
    } else other = mkInside( P, N, A2.xyz + C2.z, B2.xyz - C2.z, C2.z, 0.0, 0 );
  }
  if ( ! swapped && jn != 0 && best < 0.5 ) best = max( best, mkInside( P, N, A.xyz + C.z, B.xyz - C.z, C.z, sh, jn ) );
  best = max( best, other );
  if ( best <= 0.0 ) return;
  #ifdef MK_DEBUG
  mkDbgPath.b = 1.0;
  #endif
  float v = A.w;
  int a0 = int( C.x + 0.5 ), na = int( C.y + 0.5 );
  // one pass over the apertures: the sky visibility, the reflection's exit and the key light's
  vec3 Rv = reflect( normalize( viewPos ), n );
  Rv = normalize( mix( Rv, n, pow4( rough ) ) );
  vec3 Rw = ( vec4( Rv, 0.0 ) * viewMatrix ).xyz;
  vec4 K = mkKey;
  float hit = 0.0, sun = 0.0;
  // a room with its own probe (the Kodesh, the Ulam on medium+) takes its reflections from it: no exit test
  bool ownProbe = ( hw & 0x40000000u ) != 0u;
  na = min( na, ${MK_LIMITS.ap} - a0 );
  for ( int k = 0; k < na; k ++ ) {
    uvec4 U = mkApU[ a0 + k ];
    vec3 ac = A.xyz + vec3( float( U.x & 0xffffu ), float( U.x >> 16 ), float( U.y & 0xffffu ) ) * 0.01;
    float open = float( ( U.y >> 16 ) & 255u ) * ( 1.0 / 255.0 );
    if ( open <= 0.0 ) continue;
    float w = open * float( U.y >> 24 ) * ( 1.0 / 255.0 );
    vec2 he = vec2( float( U.z & 0xffffu ), float( U.z >> 16 ) ) * 0.01;
    MkApF F = mkApFrame( float( U.w & 7u ) );
    vec3 d = ac - P;
    float va = mkAperture( d, he, F, w );
    v += va;
    if ( k == 0 ) mkVm = va;
    // qa-r2-fix-env-render (ENV-R2-10, low): a rough lobe sees an opening it meets edge-on as a sliver — the exit is
    // weighted by the opening's foreshortening (dot(r, n)), which the test above, in the opening's own plane, misses: it
    // stayed near a constant as r turned parallel to the plane and then fell to 0, drawing a hard-edged bright band (the
    // Ulam's 20 × 40 opening seen down the porch from Beit HaChalifot's niche wall). Glossy lobes keep the exact test
    if ( ! ownProbe ) hit = max( hit, mkApHit( d, Rw, 0.05, rough, he, F ) * w * mix( 1.0, smoothstep( 0.0, 0.35, dot( Rw, F.n ) ), smoothstep( 0.2, 0.6, rough ) ) );
    // the key light: through an open rectangle in proportion to its openness; through a row of splayed windows (F1) at
    // full strength, but only where a ray can pass one of them (qa-r1-fix-env-render)
    float ks = mkApHit( d, K.xyz, K.w, 0.01, he, F );
    sun = max( sun, ks > 0.0 && ( U.w & 8u ) != 0u ? mkSlot( d, K.xyz, he, F, U.w ) * min( open * 64.0, 1.0 ) : ks * open );
  }
  mkHit = best * hit;
  mkSun = mix( 1.0, sun, best );
  mkV = mix( 1.0, clamp( v, 0.0, 1.0 ), best );
  // render-env-2-fix: a light outside the room reaches it through its apertures only — not through the closed room's
  // leak / bounce floor (base), which let the court fires light the KhK's gold behind two closed parochot
  mkVap = mix( 1.0, clamp( v - A.w, 0.0, 1.0 ), best );
  mkVol = float( bi ) + 1.0;
  mkS = best;
  mkHw = hw;
  if ( C.w > 0.0 ) mkFill = C.w * best;
}

void mkSetup( vec3 viewPos, vec3 viewN, vec3 n, float rough ) {
  vec3 P = cameraPosition + ( vec4( viewPos, 0.0 ) * viewMatrix ).xyz;
  vec3 N = normalize( ( vec4( viewN, 0.0 ) * viewMatrix ).xyz );
  vec4 UA = mkUnionA, UB = mkUnionB;
  mkFlags = int( UA.w + 0.5 );
  mkInvW = UB.w;
  #ifndef MK_NO_ROOMS
  mkRoom( UA, UB, viewPos, n, rough, P, N );
  #endif
  // the occluded fire lights (those sharing the brightest one's record): one evaluation per fragment from their
  // centroid, not one per unrolled light (w = record + 4 × their shader-index mask + radius / 4). Not where no light
  // from outside a room reaches (render-env-2-fix: × mkVap, a closed room)
  if ( ( ( mkFlags >> ${MK_FLAGS.occShift} ) & 1 ) != 0 && mkVap >= 0.02 ) {
    vec4 O = mkOcc[ 0 ];
    float ip = floor( O.w );
    int bits = int( ip + 0.5 );
    mkOccMask = bits >> 2;
    // a surface facing away from the fires takes none of their light anyway
    vec3 toL = O.xyz - P;
    if ( dot( N, toL ) > - 0.1 * length( toL ) ) mkOccV0 = mkFireOcc( O.xyz, P, bits & 3, 4.0 * ( O.w - ip ) );
  }
}

// direct light (sun / moon): in a room only where the ray toward it leaves through an opening
float mkDirK() { return mkSun; }

// Point lights: fx multiplies each fire light by the sky visibility at the fire (render/fx/lights.js, the low half of
// mkPtU): an outdoor fragment takes it as it comes, while a fragment in a room divides it out for a light in the same
// room and multiplies its own visibility through its apertures (mkVap) for any other. The occluded fire lights
// (mkOcc) take the visibility mkSetup found for them. Nothing is read for an outdoor fragment.
float mkPtOccL( int i ) {
  float k = ( ( mkOccMask >> i ) & 1 ) != 0 ? mkOccV0 : 1.0;
  if ( mkVol > 0.5 ) {
    uvec4 W = mkPtU[ i >> 2 ];
    int j = i & 3;
    uint u = j == 0 ? W.x : j == 1 ? W.y : j == 2 ? W.z : W.w;
    float lv = float( ( u >> 16 ) & 15u );
    k *= ( lv > 0.5 && abs( lv - mkVol ) < 0.5 ) ? 1.0 / max( unpackHalf2x16( u ).x, 1e-4 ) : mkVap;
  }
  return k;
}
#define mkPtOccAt( i ) mkPtOccL( i )

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
// … and k: how much farther the reflected surface is from p than from c (≥ 1). render-env-2-fix: a probe's blur is an
// angle seen from c, so a reflection of a surface far from p but near c came out too sharp — the opening's jambs as a
// chrome-like stripe on the Ulam's wing walls, 21 m from the opening, from a probe 2.6 m from it. The lobe's footprint
// there (∝ distance × α, α = roughness²) seen from c asks for roughness × √k
vec3 mkBoxProject( vec3 dir, vec3 p, vec3 bmin, vec3 bmax, vec3 c, out float k ) {
  vec3 inv = 1.0 / ( sign( dir ) * max( abs( dir ), vec3( 1e-5 ) ) );
  vec3 tf = max( ( bmax - p ) * inv, ( bmin - p ) * inv );
  float t = min( tf.x, min( tf.y, tf.z ) );
  k = 1.0;
  if ( t <= 0.0 ) return dir;
  vec3 h = p + dir * t - c;
  float dc = length( h );
  k = clamp( t / max( dc, 0.1 ), 1.0, 16.0 );
  return h / max( dc, 1e-4 );
}

vec3 mkIrr = vec3( 0.0 );
vec3 mkRad = vec3( 0.0 );
#ifdef MK_DEBUG
vec3 mkDbgW = vec3( 0.0 ); // probe weights (debug view 2): interior probe, outdoor probes, sky
#endif
// geoPos: the fragment's view-space position (three's geometryPosition), from which the world position is recomputed
void mkIBL( vec3 geoPos, vec3 viewDir, vec3 normal, float roughness ) {
  vec3 Pw = cameraPosition + ( vec4( geoPos, 0.0 ) * viewMatrix ).xyz;
  vec3 Nw = transformNormalByInverseViewMatrix( normal, viewMatrix );
  vec3 R = reflect( - viewDir, normal );
  R = normalize( mix( R, normal, pow4( roughness ) ) );
  vec3 Rw = transformDirectionByInverseViewMatrix( R, viewMatrix );
  mkIrr = vec3( 0.0 ); mkRad = vec3( 0.0 );
  float rem = 1.0;
  // Outdoor light inside a room comes in through the openings, which show the lit court — sunlit and shaded stone, a
  // little sky — not the sky overhead that env(N) would give a floor or a ceiling. So inside (× mkS) the diffuse light
  // is V × the openings' radiance Lb (mkIntEnv, per unit sky irradiance), and a reflection that does not leave
  // through an opening sees the room's own surfaces lit by it (albedo × V × Lb); one that does sees outdoors. In a
  // gilded room without a probe (the KhK) the gold walls pass that light on, bounce after bounce (the record word's gain).
  float hit = mkHit;
  vec3 LbN = vec3( 0.0 ), inRad = vec3( 0.0 );
  // a gilded room's interreflection gain (rooms without a probe of their own), from the room's record word
  vec3 gain = ( mkHw & 0x3fffffffu ) != 0u ? mix( vec3( 1.0 ), vec3( float( mkHw & 1023u ), float( ( mkHw >> 10 ) & 1023u ), float( ( mkHw >> 20 ) & 1023u ) ) * ( 1.0 / 256.0 ), mkS ) : vec3( 1.0 );
  if ( mkS > 0.0 ) {
    vec4 ie = mkIntEnv;
    LbN = ie.xyz * gain;
    inRad = ie.w * mkV * LbN; // the room's own surfaces in a reflection (per unit sky irradiance)
  }
  // the probe loop is compiled only where probes exist (MK_PROBES: medium+); probes are sorted interior first, so once
  // their weight has used up the fragment nothing further is read
  #ifdef MK_PROBES
  int np = min( mkFlags & MK_F_PROBES, ${MK_LIMITS.probe} );
  // a fragment outside every room never reads the interior probes' boxes (listed first; two block reads a court
  // fragment on medium otherwise)
  int k0 = mkVol > 0.5 ? 0 : min( ( mkFlags >> ${MK_FLAGS.intShift} ) & 7, np );
  for ( int k = k0; k < np; k ++ ) {
    if ( rem < 1e-3 ) break;
    uvec4 H = mkPrH[ k ];
    vec3 lo = MK_ORIGIN + vec3( float( H.x & 0xffffu ), float( H.x >> 16 ), float( H.y & 0xffffu ) ) * 0.01;
    vec3 hi = MK_ORIGIN + vec3( float( H.y >> 16 ), float( H.z & 0xffffu ), float( H.z >> 16 ) ) * 0.01;
    if ( any( lessThan( Pw, lo ) ) || any( greaterThan( Pw, hi ) ) ) continue;
    vec2 sm = unpackHalf2x16( H.w ); // shell, margin
    vec4 PC = mkPrC[ k ], PD = mkPrD[ k ];
    float sc = PC.w;
    // PD.w = weight (0..1) + 2 × the probe's sky share × 255 (render-audio-3)
    float shareQ = floor( PD.w * 0.5 );
    float w = sc > 0.0 ? mkInside( Pw, Nw, lo + sm.y, hi - sm.y, sm.y, sm.x, 0 ) * ( PD.w - 2.0 * shareQ ) * rem : 0.0;
    if ( w >= 1e-3 ) {
      vec4 PE = mkPrE[ k ];
      // PE.w = slice + 8 (outdoor) + 16 × (cap index + 16 × mode) + V at the probe (fraction)
      float code = floor( PE.w ), vRef = PE.w - code;
      float cg = floor( code * 0.0625 ), base = code - 16.0 * cg;
      float mq = floor( cg * 0.0625 );
      bool outdoor = base > 7.5;
      float slice = outdoor ? base - 8.0 : base;
      float kr;
      vec3 Rp = mkBoxProject( Rw, Pw, PD.xyz, PE.xyz, PC.xyz, kr );
      vec3 irr = sc * mkTextureCubeUV( envMap, Nw, 1.0, slice );
      // a room lit through its openings: its diffuse light follows the sky visibility here / at the probe — the Ulam's
      // wings dim (all its openings, ≤ 1.5); the Kodesh's far end by the parochet dimmer, its gate end brighter
      // (render-audio-3: the square root of the ratio through the great gate alone, ≤ 2.5 — the gold walls spread its
      // light; fitted to captures moved along the axis) — for the share of the probe's light that came in as skylight
      float vr = vRef > 0.0 ? mix( 1.0, min( mq > 0.5 ? sqrt( mkVm / vRef ) : mkV / vRef, 1.0 + 0.5 * ( cg - 16.0 * mq ) ), shareQ * ( 1.0 / 255.0 ) ) : 1.0;
      irr *= vr;
      float eR = roughness * sqrt( kr );
      vec3 rad = sc * mkTextureCubeUV( envMap, Rp, min( eR, 1.0 ), slice );
      // a rough lobe gathers its light like the irradiance, over a cone no box projection places: the same scale (the
      // parochet's 4 % specular at roughness 0.85 is as bright as its 5.6 % diffuse); glossy gold keeps its projected image.
      // qa-r2-fix-env-render (ENV-R2-10): in every interior probe's room, not the Kodesh's alone — in the Ulam's dim wings
      // (Beit HaChalifot, V a fifth of the probe's) the stone's diffuse light was scaled down to the wing's but its rough
      // reflections kept the bright mid-porch's: a third of the niche wall's brightness, mottled by its pecked bosses into a
      // "wet" band. The gold leaves, the vine and the nivreshet (roughness < 0.35) keep their reflections as they were.
      rad *= mix( 1.0, vr, smoothstep( 0.35, 0.8, roughness ) );
      // …and past the probe's widest blur (eR > 1) the lobe's footprint is larger than any lobe the probe holds (a surface
      // far from the reflected one, which the probe sees close): such a lobe tends to the cosine-weighted radiance about
      // the normal, blended toward it by 1 − 1 / eR²
      if ( eR > 1.0 ) rad = mix( rad, irr, 1.0 - 1.0 / ( eR * eR ) );
      if ( outdoor ) {
        float E = envMapIntensity; // scene units per unit sky irradiance
        irr = mkV * mix( irr, LbN * E, mkS );
        rad = hit * rad + ( 1.0 - hit ) * mix( rad, inRad * E, mkS );
        #ifdef MK_DEBUG
        mkDbgW.g += w;
        #endif
      }
      #ifdef MK_DEBUG
      else mkDbgW.r += w;
      #endif
      mkIrr += w * PI * irr;
      mkRad += w * rad;
      rem -= w;
    }
  }
  #endif
  #ifdef MK_DEBUG
  mkDbgW.b = rem;
  #endif
  // lamp light filling a room with no probe (low tier, chambers), in the colour of the fires' own light (gold-tinted in
  // a gilded room, as its probe sees it on medium+). Its reflection is the fill where the reflected ray has travelled
  // as far as the fires (glossy gold mirrors the lamp-lit end of the room, not a flat wash); rough surfaces see the
  // local fill
  if ( mkFill > 0.0 ) {
    vec4 fa = mkVolD[ int( mkVol - 0.5 ) ]; // the fires' centroid, falloff radius²
    vec3 fd0 = Pw - fa.xyz;
    vec3 fd1 = fd0 + Rw * length( fd0 );
    float f0 = mkFill * fa.w / ( fa.w + dot( fd0, fd0 ) );
    float f1 = mkFill * fa.w / ( fa.w + dot( fd1, fd1 ) );
    vec3 fc = mkFillCol.xyz * gain / max( dot( gain, vec3( 0.2126, 0.7152, 0.0722 ) ), 1e-3 );
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

// debug views (ctx.env.interiors.debug; compiled only with MK_DEBUG): 1 sky visibility (grey, sqrt for legibility),
// 2 volume tint x probe weights, 3 the room path taken
#ifdef MK_DEBUG
vec3 mkDebugColor() {
  if ( ( mkFlags & MK_F_DEBUG ) == ( 1 << ${MK_FLAGS.debugShift} ) ) return vec3( sqrt( mkV ) );
  if ( ( mkFlags & MK_F_DEBUG ) == ( 3 << ${MK_FLAGS.debugShift} ) ) return 0.15 + 0.85 * mkDbgPath;
  vec3 c = mkVol > 0.5 ? 0.35 + 0.65 * fract( vec3( 0.37, 0.61, 0.83 ) * mkVol ) : vec3( 1.0 );
  #if defined( ENVMAP_TYPE_CUBE_UV )
    c *= 0.4 + 0.6 * mkDbgW;
  #endif
  return c;
}
#endif
`;
}

let installed = false;
let parsText = '';

/**
 * Install the patch into three's ShaderChunk (once, before any lit program compiles). Returns false (and changes
 * nothing) when the stock chunks do not have the expected shape — a future three version.
 * opts.origin: world point the 16-bit centimetre coordinates count from; opts.records: fire occluder records
 * ({ enc: { rect: [x0, z0, x1, z1], tops: [x−, x+, z−, z+] } | null, plate: { rect, top } | null }, world m).
 */
export function installInteriorChunks(ShaderChunk, { probes = true, origin = [0, 0, 0], records = [], debug = false } = {}) {
  if (installed || ShaderChunk.__mkInt) return true;
  probesOn = !!probes;
  debugOn = !!debug;
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
  parsText = pars({ origin, records });
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
  mkIBL( geometryPosition, geometryViewDir, geometryNormal, material.roughness );
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
let debugOn = false;
// stock IBL helpers (clearcoat, anisotropy) read the sky slice of the atlas
function envChunk(env) {
  return `${probesOn ? '#define MK_PROBES\n' : ''}${debugOn ? '#define MK_DEBUG\n' : ''}${parsText}\n${env.replaceAll('textureCubeUV( envMap,', 'mkSky( envMap,')}`;
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
 * Compile the debug views in or out (render-env-2-fix: their outputs were live through the whole shader). Returns true
 * when the chunk changed: every lit material must then recompile.
 */
export function setInteriorDebug(ShaderChunk, on) {
  if (!installed || debugOn === !!on) return false;
  debugOn = !!on;
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

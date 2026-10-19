// Physically based atmosphere model (Bruneton 2017 / Hillaire 2020 parameterisation), shared by the GPU LUT
// passes and a small CPU evaluator used for light colours. Geometry in km, coefficients in 1/km.
//
// Units of light: photometric. Solar illuminance at the top of the atmosphere E0 = 128 000 lx (at 1 AU);
// sky radiance comes out in cd/m². RGB channels stand for ~680/550/440 nm.

export const ATMO = {
  groundRadius: 6360,
  topRadius: 6460,
  rayleighScattering: [5.802e-3, 13.558e-3, 33.1e-3],
  rayleighHeight: 8.0,
  // Aerosol: Eastern-Mediterranean autumn (continental + desert dust). AOD(550nm) at sea level ≈ 0.14,
  // i.e. ≈0.09 above the Temple Mount (740 m). Ångström exponent ≈1 → bluer channels scatter a little more.
  aod: 0.14,
  mieHeight: 1.6,
  mieAngstrom: 1.0,
  mieSingleScatteringAlbedo: 0.9,
  mieG: 0.76,
  // Chappuis band: the sRGB red primary integrates ~580-640 nm where ozone absorbs MOST, so the red channel
  // gets the 600 nm cross-section, not the 680 nm one (else twilight zeniths turn magenta; measured ≈ x,y 0.22,0.22)
  ozoneAbsorption: [2.10e-3, 1.881e-3, 0.085e-3],
  groundAlbedo: [0.30, 0.28, 0.25], // Judean limestone hills & terra rossa, regional average
  observerAltitude: 0.75, // km above sea level (the Mount ~740 m)
  sunIlluminanceTOA: 128000, // lx at 1 AU
  sunAngularRadius: 0.2666 * Math.PI / 180,
};

/** Wavelength-resolved aerosol coefficients (1/km at sea level) from AOD and scale height. */
export function mieCoefficients(p = ATMO) {
  const ext550 = p.aod / p.mieHeight;
  const lam = [680, 550, 440];
  const ext = lam.map((l) => ext550 * Math.pow(l / 550, -p.mieAngstrom));
  const scat = ext.map((e) => e * p.mieSingleScatteringAlbedo);
  return { ext, scat };
}

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export { lum as luminance };

/**
 * CPU transmittance from radius rKm along cos-zenith mu to the top of the atmosphere (rgb, 0 if the ray
 * hits the ground, with a soft edge across the solar disc so sunsets fade instead of popping).
 */
export function transmittanceCPU(rKm, mu, p = ATMO, out = [0, 0, 0], steps = 48) {
  const Rg = p.groundRadius, Rt = p.topRadius;
  const { ext: mieExt } = mieCoefficients(p);
  const disc = rKm * rKm * (mu * mu - 1) + Rt * Rt;
  const d = Math.max(0, -rKm * mu + Math.sqrt(Math.max(disc, 0)));
  const dt = d / steps;
  const tau = [0, 0, 0];
  for (let i = 0; i < steps; i++) {
    const t = (i + 0.5) * dt;
    const h = Math.sqrt(rKm * rKm + t * t + 2 * rKm * mu * t) - Rg;
    const dR = Math.exp(-h / p.rayleighHeight);
    const dM = Math.exp(-h / p.mieHeight);
    const dO = Math.max(0, 1 - Math.abs(h - 25) / 15);
    for (let c = 0; c < 3; c++) {
      tau[c] += (p.rayleighScattering[c] * dR + mieExt[c] * dM + p.ozoneAbsorption[c] * dO) * dt;
    }
  }
  // planet shadow: soft across ±(sun radius) around the geometric horizon of this point
  const muH = -Math.sqrt(Math.max(0, 1 - (Rg / rKm) ** 2));
  const w = Math.sin(p.sunAngularRadius) * 1.0;
  const s = Math.min(1, Math.max(0, (mu - muH + w) / (2 * w)));
  const shadow = s * s * (3 - 2 * s);
  for (let c = 0; c < 3; c++) out[c] = Math.exp(-tau[c]) * shadow;
  return out;
}

// ------------------------------------------------------------------------------------ night-sky floor
// Airglow (a thin layer at ~90 km, van Rhijn-brightened toward the horizon) + unresolved starlight, seen
// (a) directly, dimmed by the air in front of it (luminance transmittance tl), and (b) scattered toward the
// observer by that same air: in the optically thick horizontal path the air takes on roughly the mean radiance
// of the night sky that lights it (NIGHT_SCATTER × zenith). Dark-site skies are ~0.5–1 mag brighter at 10–20°
// than at the zenith and stay bright down to the horizon (Roach & Gordon, The Light of the Night Sky; Garstang 1989).
export const NIGHT_SCATTER = 2.0;
const VAN_RHIJN_K = (6360 / 6450) ** 2; // airglow layer at ~90 km
/** shape (zenith ≈ tlZenith + K(1 - tlZenith); normalise by its zenith value); cz = view direction y */
export function nightFloorShape(cz, tl) {
  const c = Math.max(cz, 0);
  const vr = 1 / Math.sqrt(Math.max(1 - VAN_RHIJN_K * (1 - c * c), 0.03));
  return vr * tl + NIGHT_SCATTER * (1 - tl);
}
export const NIGHT_FLOOR_GLSL = /* glsl */`
float nightFloorShape( float y, float tl ) {
  float c = max( y, 0.0 );
  float vr = 1.0 / sqrt( max( 1.0 - ${VAN_RHIJN_K.toFixed(5)} * ( 1.0 - c * c ), 0.03 ) );
  return vr * tl + ${NIGHT_SCATTER.toFixed(3)} * ( 1.0 - tl );
}
`;

/** Vertical optical depth above the observer (for star extinction), rgb. */
export function zenithOpticalDepth(p = ATMO) {
  const T = transmittanceCPU(p.groundRadius + p.observerAltitude, 1, p, [0, 0, 0], 64);
  return T.map((v) => -Math.log(Math.max(v, 1e-9)));
}

// ------------------------------------------------------------------------------------------------- GLSL

/** Uniform declarations + helpers shared by every atmosphere shader. */
export const ATMO_GLSL = /* glsl */`
#ifndef PI
#define PI 3.141592653589793
#endif
#define RG ${ATMO.groundRadius.toFixed(1)}
#define RT ${ATMO.topRadius.toFixed(1)}
uniform vec3 uRayleighScat;
uniform float uRayleighH;
uniform vec3 uMieScat;
uniform vec3 uMieExt;
uniform float uMieH;
uniform float uMieG;
uniform vec3 uOzoneAbs;
uniform vec3 uGroundAlbedo;

struct Medium { vec3 scatR; vec3 scatM; vec3 ext; };

Medium sampleMedium( float h ) {
  h = max( h, 0.0 );
  float dR = exp( - h / uRayleighH );
  float dM = exp( - h / uMieH );
  float dO = max( 0.0, 1.0 - abs( h - 25.0 ) / 15.0 );
  Medium m;
  m.scatR = uRayleighScat * dR;
  m.scatM = uMieScat * dM;
  m.ext = m.scatR + uMieExt * dM + uOzoneAbs * dO;
  return m;
}

float distToTop( float r, float mu ) {
  float d = r * r * ( mu * mu - 1.0 ) + RT * RT;
  return max( 0.0, - r * mu + sqrt( max( d, 0.0 ) ) );
}
bool hitsGround( float r, float mu ) {
  return mu < 0.0 && r * r * ( mu * mu - 1.0 ) + RG * RG >= 0.0;
}
float distToGround( float r, float mu ) {
  float d = r * r * ( mu * mu - 1.0 ) + RG * RG;
  return max( 0.0, - r * mu - sqrt( max( d, 0.0 ) ) );
}
// soft planet shadow for a light of angular radius ~0.27deg seen from radius r
float planetShadow( float r, float mu ) {
  float muH = - sqrt( max( 0.0, 1.0 - ( RG / r ) * ( RG / r ) ) );
  return smoothstep( muH - 0.0047, muH + 0.0047, mu );
}

float rayleighPhase( float c ) { return 3.0 / ( 16.0 * PI ) * ( 1.0 + c * c ); }
float miePhase( float c, float g ) { // Cornette-Shanks
  float g2 = g * g;
  float k = 3.0 / ( 8.0 * PI ) * ( 1.0 - g2 ) / ( 2.0 + g2 );
  return k * ( 1.0 + c * c ) / pow( max( 1.0 + g2 - 2.0 * g * c, 1e-4 ), 1.5 );
}

float unitToUV( float x, float n ) { return ( 0.5 + x * ( n - 1.0 ) ) / n; }
float uvToUnit( float u, float n ) { return ( u * n - 0.5 ) / ( n - 1.0 ); }

#define T_W 256.0
#define T_H 64.0
#define MS_N 32.0

vec2 transmittanceUV( float r, float mu ) {
  float H = sqrt( RT * RT - RG * RG );
  float rho = sqrt( max( 0.0, r * r - RG * RG ) );
  float d = distToTop( r, mu );
  float dmin = RT - r, dmax = rho + H;
  float xmu = clamp( ( d - dmin ) / max( dmax - dmin, 1e-4 ), 0.0, 1.0 );
  return vec2( unitToUV( xmu, T_W ), unitToUV( clamp( rho / H, 0.0, 1.0 ), T_H ) );
}
`;

export const FULLSCREEN_VERT = /* glsl */`
void main() { gl_Position = vec4( position.xy, 0.0, 1.0 ); }
`;

/** Transmittance LUT (256x64): rgb transmittance to the top of the atmosphere. */
export const TRANSMITTANCE_FRAG = /* glsl */`
${ATMO_GLSL}
void main() {
  vec2 uv = gl_FragCoord.xy / vec2( T_W, T_H );
  float xmu = uvToUnit( uv.x, T_W ), xr = uvToUnit( uv.y, T_H );
  float H = sqrt( RT * RT - RG * RG );
  float rho = H * xr;
  float r = sqrt( rho * rho + RG * RG );
  float dmin = RT - r, dmax = rho + H;
  float d = dmin + xmu * ( dmax - dmin );
  float mu = d <= 0.0 ? 1.0 : clamp( ( H * H - rho * rho - d * d ) / ( 2.0 * r * d ), -1.0, 1.0 );
  vec3 tau = vec3( 0.0 );
  const int N = 48;
  float dt = d / float( N );
  for ( int i = 0; i < N; i ++ ) {
    float t = ( float( i ) + 0.5 ) * dt;
    float ri = sqrt( r * r + t * t + 2.0 * r * mu * t );
    tau += sampleMedium( ri - RG ).ext * dt;
  }
  gl_FragColor = vec4( exp( - tau ), 1.0 );
}
`;

const TRANS_LOOKUP = /* glsl */`
uniform sampler2D uTransmittance;
vec3 transmittance( float r, float mu ) { return textureLod( uTransmittance, transmittanceUV( r, mu ), 0.0 ).rgb; }
`;

/** Hillaire 2020 multiple-scattering LUT (32x32): Psi_ms(r, mu_s) for unit solar illuminance. */
export const MULTISCAT_FRAG = /* glsl */`
${ATMO_GLSL}
${TRANS_LOOKUP}
void main() {
  vec2 uv = gl_FragCoord.xy / vec2( MS_N );
  float muS = uvToUnit( uv.x, MS_N ) * 2.0 - 1.0;
  float r = RG + clamp( uvToUnit( uv.y, MS_N ), 0.0, 1.0 ) * ( RT - RG ) + 0.01;
  vec3 sunDir = vec3( sqrt( max( 0.0, 1.0 - muS * muS ) ), muS, 0.0 );
  vec3 pos = vec3( 0.0, r, 0.0 );
  vec3 Lsum = vec3( 0.0 ), Fsum = vec3( 0.0 );
  const int SQ = 8;
  const int STEPS = 20;
  float isoPhase = 1.0 / ( 4.0 * PI );
  for ( int i = 0; i < SQ; i ++ ) for ( int j = 0; j < SQ; j ++ ) {
    float th = 2.0 * PI * ( float( i ) + 0.5 ) / float( SQ );
    float cp = 1.0 - 2.0 * ( float( j ) + 0.5 ) / float( SQ );
    float sp = sqrt( max( 0.0, 1.0 - cp * cp ) );
    vec3 dir = vec3( cos( th ) * sp, cp, sin( th ) * sp );
    float mu = dir.y;
    bool ground = hitsGround( r, mu );
    float tMax = ground ? distToGround( r, mu ) : distToTop( r, mu );
    float dt = tMax / float( STEPS );
    vec3 T = vec3( 1.0 ), L = vec3( 0.0 ), F = vec3( 0.0 );
    for ( int k = 0; k < STEPS; k ++ ) {
      float t = ( float( k ) + 0.5 ) * dt;
      vec3 P = pos + t * dir;
      float rP = length( P );
      float muSP = dot( P / rP, sunDir );
      Medium m = sampleMedium( rP - RG );
      vec3 Ts = transmittance( rP, muSP ) * planetShadow( rP, muSP );
      vec3 scat = m.scatR + m.scatM;
      vec3 S = scat * Ts * isoPhase;
      vec3 sT = exp( - m.ext * dt );
      vec3 integ = ( 1.0 - sT ) / max( m.ext, vec3( 1e-7 ) );
      L += T * S * integ;
      F += T * scat * integ;
      T *= sT;
    }
    if ( ground ) {
      vec3 P = pos + tMax * dir;
      float muSP = dot( normalize( P ), sunDir );
      L += T * transmittance( RG, muSP ) * planetShadow( RG, muSP ) * max( muSP, 0.0 ) * uGroundAlbedo / PI;
    }
    Lsum += L;
    Fsum += F;
  }
  float n = float( SQ * SQ );
  vec3 L2 = Lsum / n;
  vec3 fms = Fsum / n;
  gl_FragColor = vec4( L2 / max( 1.0 - fms, vec3( 1e-3 ) ), 1.0 );
}
`;

/**
 * Sky-view LUT: in-scattered radiance (cd/m², divided by LUT_SCALE) towards every direction from the
 * observer, lit by the Sun AND the Moon. u = compass azimuth (0 = north, 90 = east), v = elevation with a
 * square-root mapping centred on the geometric horizon (fine near the horizon, coarse overhead).
 */
export const SKYVIEW_FRAG = /* glsl */`
${ATMO_GLSL}
${TRANS_LOOKUP}
uniform sampler2D uMultiScat;
uniform vec2 uSize;
uniform float uObsR;
uniform vec3 uSunDir;
uniform vec3 uSunE;     // TOA illuminance * colour / LUT_SCALE
uniform vec3 uMoonDir;
uniform vec3 uMoonE;
uniform vec3 uGroundIrr; // sky irradiance on the ground (for the far-ground term), / LUT_SCALE
uniform int uSteps;

vec3 multiScat( float r, float muS ) {
  vec2 uv = vec2( unitToUV( muS * 0.5 + 0.5, MS_N ), unitToUV( ( r - RG ) / ( RT - RG ), MS_N ) );
  return textureLod( uMultiScat, uv, 0.0 ).rgb;
}

vec3 skyDirFromUV( vec2 uv, float r ) {
  float horizon = - acos( clamp( RG / r, -1.0, 1.0 ) ); // elevation of the geometric horizon (negative)
  float v = uv.y;
  float el;
  if ( v >= 0.5 ) { float x = ( v - 0.5 ) * 2.0; el = horizon + x * x * ( 0.5 * PI - horizon ); }
  else { float x = ( 0.5 - v ) * 2.0; el = horizon - x * x * ( 0.5 * PI + horizon ); }
  float az = uv.x * 2.0 * PI;
  float ce = cos( el );
  return vec3( sin( az ) * ce, sin( el ), - cos( az ) * ce );
}

void lightContribution( vec3 P, float rP, vec3 dir, vec3 L, vec3 E, Medium m, inout vec3 S ) {
  float muS = dot( P / rP, L );
  vec3 Ts = transmittance( rP, muS ) * planetShadow( rP, muS );
  float c = dot( dir, L );
  vec3 ms = multiScat( rP, muS );
  S += E * ( Ts * ( m.scatR * rayleighPhase( c ) + m.scatM * miePhase( c, uMieG ) ) + ms * ( m.scatR + m.scatM ) );
}

// Crossings of the ray with the Earth's shadow cylinder (axis through the planet centre along the light).
// Splitting the march there puts the lit/shadowed boundary exactly on a segment edge: no twilight rings.
vec2 shadowSpan( vec3 O, vec3 d, vec3 s, float tMax ) {
  vec3 a = d - dot( d, s ) * s;
  vec3 b = O - dot( O, s ) * s;
  float A = dot( a, a ), B = 2.0 * dot( a, b ), C = dot( b, b ) - RG * RG;
  float disc = B * B - 4.0 * A * C;
  if ( A < 1e-9 || disc < 0.0 ) return vec2( -1.0 );
  float q = sqrt( disc );
  float t0 = ( - B - q ) / ( 2.0 * A ), t1 = ( - B + q ) / ( 2.0 * A );
  float os = dot( O, s ), ds = dot( d, s );
  if ( abs( ds ) > 1e-6 ) {
    float tz = - os / ds; // where the ray crosses the terminator plane (P.s = 0)
    if ( ds > 0.0 ) t1 = min( t1, tz ); else t0 = max( t0, tz );
  } else if ( os > 0.0 ) return vec2( -1.0 );
  t0 = clamp( t0, 0.0, tMax ); t1 = clamp( t1, 0.0, tMax );
  return t1 > t0 + 1e-3 ? vec2( t0, t1 ) : vec2( -1.0 );
}

void marchSegment( vec3 O, vec3 dir, float ta, float tb, int n, bool moonOn, inout vec3 L, inout vec3 T ) {
  if ( tb <= ta ) return;
  float tPrev = ta;
  for ( int i = 0; i < 64; i ++ ) {
    if ( i >= n ) break;
    float x = ( float( i ) + 1.0 ) / float( n );
    float t1 = ta + ( tb - ta ) * x * x;
    float dt = t1 - tPrev;
    float t = tPrev + 0.5 * dt;
    tPrev = t1;
    vec3 P = O + t * dir;
    float rP = length( P );
    Medium m = sampleMedium( rP - RG );
    vec3 S = vec3( 0.0 );
    lightContribution( P, rP, dir, uSunDir, uSunE, m, S );
    if ( moonOn ) lightContribution( P, rP, dir, uMoonDir, uMoonE, m, S );
    vec3 sT = exp( - m.ext * dt );
    L += T * S * ( 1.0 - sT ) / max( m.ext, vec3( 1e-7 ) );
    T *= sT;
  }
}

void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  float r = uObsR;
  vec3 dir = skyDirFromUV( uv, r );
  vec3 O = vec3( 0.0, r, 0.0 );
  float mu = dir.y;
  bool ground = hitsGround( r, mu );
  float tMax = ground ? distToGround( r, mu ) : distToTop( r, mu );
  bool moonOn = dot( uMoonE, vec3( 1.0 ) ) > 0.0;
  vec3 L = vec3( 0.0 ), T = vec3( 1.0 );
  vec2 sh = shadowSpan( O, dir, uSunDir, tMax );
  if ( sh.x < 0.0 ) {
    marchSegment( O, dir, 0.0, tMax, uSteps, moonOn, L, T );
  } else {
    int n3 = max( 4, uSteps / 3 );
    marchSegment( O, dir, 0.0, sh.x, n3, moonOn, L, T );
    marchSegment( O, dir, sh.x, sh.y, n3, moonOn, L, T );
    marchSegment( O, dir, sh.y, tMax, max( 4, uSteps - ( sh.x > 0.0 ? 2 : 1 ) * n3 ), moonOn, L, T );
  }
  if ( ground ) {
    vec3 P = O + tMax * dir;
    vec3 up = normalize( P );
    float ms = dot( up, uSunDir ), mm = dot( up, uMoonDir );
    vec3 Eg = uSunE * transmittance( RG, ms ) * planetShadow( RG, ms ) * max( ms, 0.0 )
            + uMoonE * transmittance( RG, mm ) * planetShadow( RG, mm ) * max( mm, 0.0 ) + uGroundIrr;
    L += T * Eg * uGroundAlbedo / PI;
  }
  gl_FragColor = vec4( min( L, vec3( 6.0e4 ) ), 1.0 );
}
`;

/**
 * Sky statistics (8x1): 0 sky irradiance on an upward horizontal surface; 1 mean horizon radiance;
 * 2..6 horizon radiance at 0/45/90/135/180 deg of azimuth from the reference light; 7 zenith radiance.
 * Values in LUT units (multiply by LUT_SCALE).
 */
export const STATS_FRAG = /* glsl */`
#define PI 3.141592653589793
uniform sampler2D uSky;
uniform float uHorizonV;   // v coordinate of the geometric horizon (0.5)
uniform float uRefAz;      // radians, compass
uniform float uObsR;
vec3 skyAt( float az, float el ) {
  float horizon = - acos( clamp( 6360.0 / uObsR, -1.0, 1.0 ) );
  float v;
  if ( el >= horizon ) v = 0.5 + 0.5 * sqrt( ( el - horizon ) / ( 0.5 * PI - horizon ) );
  else v = 0.5 - 0.5 * sqrt( ( horizon - el ) / ( 0.5 * PI + horizon ) );
  return textureLod( uSky, vec2( fract( az / ( 2.0 * PI ) ), v ), 0.0 ).rgb;
}
vec3 horizonBand( float az ) {
  vec3 s = vec3( 0.0 );
  for ( int k = 0; k < 4; k ++ ) s += skyAt( az, radians( 0.5 + float( k ) * 1.0 ) );
  return s * 0.25;
}
void main() {
  int px = int( gl_FragCoord.x );
  vec3 c = vec3( 0.0 );
  if ( px == 0 ) {
    // cosine-weighted hemisphere: E = PI * mean(L)
    for ( int i = 0; i < 24; i ++ ) for ( int j = 0; j < 8; j ++ ) {
      float u1 = ( float( j ) + 0.5 ) / 8.0;
      float el = 0.5 * PI - asin( sqrt( u1 ) ); // cosine-weighted: sin(zenith) = sqrt(u1)
      float az = 2.0 * PI * ( float( i ) + 0.5 ) / 24.0;
      c += skyAt( az, el );
    }
    c *= PI / 192.0;
  } else if ( px == 1 ) {
    for ( int i = 0; i < 32; i ++ ) c += horizonBand( 2.0 * PI * ( float( i ) + 0.5 ) / 32.0 );
    c /= 32.0;
  } else if ( px <= 6 ) {
    float rel = radians( 45.0 * float( px - 2 ) );
    c = 0.5 * ( horizonBand( uRefAz + rel ) + horizonBand( uRefAz - rel ) );
  } else {
    for ( int i = 0; i < 8; i ++ ) c += skyAt( 2.0 * PI * float( i ) / 8.0, radians( 85.0 ) );
    c /= 8.0;
  }
  gl_FragColor = vec4( c, 1.0 );
}
`;

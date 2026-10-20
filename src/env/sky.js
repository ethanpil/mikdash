// Sky dome: per pixel only a sky-view-LUT lookup plus analytic sun/moon discs, aureoles, the night-sky
// floor (airglow + unresolved starlight), and on high+ a procedural Milky Way and thin cirrus.
// The same shader (ENV_PASS) renders the sky-only cube that is prefiltered into the PMREM environment.
import { ShaderMaterial, BackSide, Matrix3, Vector2, Vector3, Vector4 } from 'three';
import { ATMO_GLSL, NIGHT_FLOOR_GLSL } from './atmosphere.js';

const SKY_VERT = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * vec4( mat3( viewMatrix ) * position, 1.0 );
  gl_Position = p.xyww; // on the far plane: drawn only where nothing else is
}
`;

const NOISE_GLSL = /* glsl */`
float hash13( vec3 p ) { p = fract( p * 0.1031 ); p += dot( p, p.zyx + 31.32 ); return fract( ( p.x + p.y ) * p.z ); }
float vnoise( vec3 p ) {
  vec3 i = floor( p ), f = fract( p );
  f = f * f * ( 3.0 - 2.0 * f );
  return mix( mix( mix( hash13( i ), hash13( i + vec3( 1, 0, 0 ) ), f.x ),
                   mix( hash13( i + vec3( 0, 1, 0 ) ), hash13( i + vec3( 1, 1, 0 ) ), f.x ), f.y ),
              mix( mix( hash13( i + vec3( 0, 0, 1 ) ), hash13( i + vec3( 1, 0, 1 ) ), f.x ),
                   mix( hash13( i + vec3( 0, 1, 1 ) ), hash13( i + vec3( 1, 1, 1 ) ), f.x ), f.y ), f.z );
}
float fbm( vec3 p, int oct ) {
  float a = 0.5, s = 0.0;
  for ( int i = 0; i < 6; i ++ ) { if ( i >= oct ) break; s += a * vnoise( p ); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`;

const SKY_FRAG = /* glsl */`
#include <common>
${ATMO_GLSL}
uniform sampler2D uTransmittance;
uniform sampler2D uSkyLUT;
uniform float uLutScale;      // LUT -> output units (LUT_SCALE * preExposure * outScale)
uniform float uOutScale;      // extra factor (env pass normalisation); 1 for the visible dome
uniform float uObsR;
uniform vec3 uSunDir;
// all radiances below are PHYSICAL (cd/m², lx); uOutScale converts to output units
uniform vec3 uSunRadiance;    // disc centre radiance at TOA
uniform float uSunCos;
uniform float uSunDiscScale;  // local adaptation of the disc (CPU: brings the disc centre down to ~uSunDiscCap)
uniform float uSunDiscCap;    // output level above which the disc is compressed logarithmically (keeps its colour)
uniform float uSunFlat;       // vertical/horizontal diameter ratio from refraction (≈0.8 on the horizon)
uniform vec3 uSunAureole;     // narrow forward-scatter glow strength (already × uSunDiscScale)
uniform vec3 uMoonDir;
uniform vec3 uMoonNorth;      // lunar north on the sky (celestial north projected)
uniform vec3 uMoonRadiance;   // full-disc radiance scale (already includes the local-adaptation scale)
uniform vec3 uEarthshine;
uniform float uMoonCos;
uniform vec3 uMoonAureole;
uniform vec3 uNightSky;       // airglow + starlight floor: zenith value / nightFloorShape(zenith) (physical)
uniform vec3 uMilkyWay;       // peak Milky Way surface brightness (pre-exposed)
uniform mat3 uWorldToGal;
uniform vec3 uCloudParams;    // x coverage, y opacity, z time (minutes)
uniform vec2 uWind;
uniform vec3 uCloudSky;       // ambient (sky) irradiance at cloud level / PI (pre-exposed)
uniform vec3 uCloudSun;       // TOA sun illuminance
uniform vec3 uLocalGround;    // radiance of the sunlit local pavement (env pass lower hemisphere)
uniform vec4 uWallShade;      // env pass: surroundings (walls, colonnades) radiance in shade, w = sin(top elevation)
uniform vec3 uWallLit;        // env pass: extra radiance of a wall face turned fully to the key light
uniform vec3 uWallKey;        // key light direction (sun by day, moon by night)
varying vec3 vDir;

#include <dithering_pars_fragment>
${NOISE_GLSL}
${NIGHT_FLOOR_GLSL}

vec2 skyUV( vec3 dir ) {
  float horizon = - acos( clamp( RG / uObsR, -1.0, 1.0 ) );
  float el = asin( clamp( dir.y, -1.0, 1.0 ) );
  float v = el >= horizon
    ? 0.5 + 0.5 * sqrt( ( el - horizon ) / ( 0.5 * PI - horizon ) )
    : 0.5 - 0.5 * sqrt( ( horizon - el ) / ( 0.5 * PI + horizon ) );
  float az = ( abs( dir.x ) + abs( dir.z ) < 1e-6 ) ? 0.0 : atan( dir.x, - dir.z );
  return vec2( fract( az / ( 2.0 * PI ) ), v );
}
vec3 transmittanceView( vec3 dir ) {
  return textureLod( uTransmittance, transmittanceUV( uObsR, max( dir.y, 0.0 ) ), 0.0 ).rgb;
}
float hgPhase( float c, float g ) { float g2 = g * g; return ( 1.0 - g2 ) / ( 4.0 * PI * pow( max( 1.0 + g2 - 2.0 * g * c, 1e-5 ), 1.5 ) ); }

// Lunar albedo: maria (dark basaltic plains) at their selenographic positions, highlands brighter.
float moonAlbedo( float lat, float lon ) {
  float a = 1.12;
  // lat, lon (deg), radius (deg), depth
  vec4 maria[11];
  maria[0] = vec4( 33.0, -16.0, 17.0, 0.42 );  // Imbrium
  maria[1] = vec4( 28.0, 17.5, 9.0, 0.40 );    // Serenitatis
  maria[2] = vec4( 8.5, 31.0, 10.0, 0.42 );    // Tranquillitatis
  maria[3] = vec4( 17.0, 59.0, 6.5, 0.42 );    // Crisium
  maria[4] = vec4( -7.8, 51.3, 8.0, 0.36 );    // Fecunditatis
  maria[5] = vec4( -15.2, 35.5, 5.0, 0.34 );   // Nectaris
  maria[6] = vec4( 18.0, -57.0, 22.0, 0.38 );  // Procellarum
  maria[7] = vec4( -21.3, -16.6, 9.0, 0.34 );  // Nubium
  maria[8] = vec4( -24.4, -38.6, 5.5, 0.36 );  // Humorum
  maria[9] = vec4( 13.3, 3.6, 4.0, 0.30 );     // Vaporum
  maria[10] = vec4( 56.0, 5.0, 7.0, 0.25 );    // Frigoris (part)
  for ( int i = 0; i < 11; i ++ ) {
    vec4 m = maria[ i ];
    float dl = lat - m.x, dn = ( lon - m.y ) * cos( radians( lat ) );
    a -= m.w * exp( - ( dl * dl + dn * dn ) / ( m.z * m.z ) );
  }
  // Tycho, the bright rayed crater
  float tl = lat + 43.3, tn = ( lon + 11.2 ) * cos( radians( lat ) );
  a += 0.35 * exp( - ( tl * tl + tn * tn ) / 6.0 );
  return clamp( a, 0.45, 1.5 );
}

#ifdef MILKY_WAY
float milkyWay( vec3 dir ) {
  vec3 g = uWorldToGal * dir;
  float b = asin( clamp( g.z, -1.0, 1.0 ) );
  float l = atan( g.y, g.x );               // 0 toward the galactic centre (Sagittarius)
  float w = radians( 7.5 ) + radians( 6.0 ) * exp( - l * l / 0.5 );
  float band = exp( - b * b / ( w * w ) );
  float lon = 0.30 + 0.70 * exp( - l * l / 1.6 );
  float n = fbm( g * 9.0, MW_OCT );
  float clumps = 0.45 + 1.1 * n * n;
  // the dark Great Rift (Cygnus -> Aquila -> Sagittarius), slightly north of the plane
  float rift = 1.0 - 0.7 * exp( - pow( ( b - radians( 2.5 ) ) / radians( 3.0 ), 2.0 ) )
                   * smoothstep( radians( 95.0 ), radians( 60.0 ), l ) * smoothstep( radians( -5.0 ), radians( 15.0 ), l );
  float bulge = 0.9 * exp( - ( l * l + 2.0 * b * b ) / 0.045 );
  return band * lon * clumps * rift + bulge;
}
#endif

#ifdef CLOUDS
// Thin cirrus at ~8.5 km: fibrous streaks drifting with the upper wind, lit through the atmosphere.
vec4 cirrus( vec3 dir ) {
  if ( dir.y < 0.015 ) return vec4( 0.0 );
  float hC = 8.5;
  float rC = RG + hC + 0.0;
  float b = uObsR * dir.y;
  float t = - b + sqrt( b * b - uObsR * uObsR + rC * rC ); // km to the cloud layer
  vec3 P = vec3( 0.0, uObsR, 0.0 ) + dir * t;
  vec2 q = P.xz + uWind * uCloudParams.z;
  vec2 wdir = normalize( uWind + vec2( 1e-4 ) );
  vec2 qs = vec2( dot( q, wdir ), dot( q, vec2( - wdir.y, wdir.x ) ) );
  vec3 pp = vec3( qs.x * 0.06, qs.y * 0.22, uCloudParams.z * 0.0005 );
  float n = fbm( pp, CLOUD_OCT );
  float streak = fbm( vec3( qs.x * 0.02, qs.y * 0.9, 3.7 ), 3 );
  float d = smoothstep( 1.0 - uCloudParams.x, 1.0 - uCloudParams.x + 0.35, n * 0.75 + streak * 0.45 );
  d *= smoothstep( 0.015, 0.12, dir.y );
  float alpha = d * uCloudParams.y;
  if ( alpha <= 0.0 ) return vec4( 0.0 );
  vec3 up = normalize( P );
  float muS = dot( up, uSunDir );
  vec3 Ts = textureLod( uTransmittance, transmittanceUV( length( P ), muS ), 0.0 ).rgb * planetShadow( length( P ), muS );
  float c = dot( dir, uSunDir );
  float ph = mix( hgPhase( c, 0.75 ), hgPhase( c, -0.2 ), 0.35 ) * 4.0 * PI;
  vec3 Lc = uCloudSun * Ts * ph * 0.08 + uCloudSky * 0.9;
  // attenuate by the air between observer and cloud (ratio of transmittances to the top)
  vec3 Tv = textureLod( uTransmittance, transmittanceUV( uObsR, dir.y ), 0.0 ).rgb
          / max( textureLod( uTransmittance, transmittanceUV( length( P ), dot( up, dir ) ), 0.0 ).rgb, vec3( 1e-4 ) );
  return vec4( Lc * min( Tv, vec3( 1.0 ) ), alpha );
}
#endif

void main() {
  vec3 dir = normalize( vDir );
  vec3 L = textureLod( uSkyLUT, skyUV( dir ), 0.0 ).rgb * uLutScale;
  vec3 Tv = transmittanceView( dir );
  float above = smoothstep( -0.01, 0.01, dir.y );

  // night-sky floor: airglow layer at ~90 km (van Rhijn brightening) + integrated starlight, seen directly
  // (dimmed by the air, not reddened) plus the same light scattered by the long horizontal air path — so the
  // floor brightens toward ~10-20° and stays bright down to the horizon (same function on the CPU: nightFloor)
  float tl = dot( Tv, vec3( 0.2126, 0.7152, 0.0722 ) );
  float nf;
  if ( hitsGround( uObsR, dir.y ) ) {
    // toward the distant ground: no airglow seen directly (the LUT already holds the ground's own radiance),
    // only the floor light scattered by the air in front of it — continuous with the sky at the dip horizon
    vec3 O = vec3( 0.0, uObsR, 0.0 );
    vec3 Pg = O + dir * distToGround( uObsR, dir.y );
    float rg = length( Pg );
    vec3 Tg = textureLod( uTransmittance, transmittanceUV( rg, - dot( Pg / rg, dir ) ), 0.0 ).rgb
            / max( textureLod( uTransmittance, transmittanceUV( uObsR, - dir.y ), 0.0 ).rgb, vec3( 1e-6 ) );
    nf = nightFloorShape( 0.0, 0.0 ) * ( 1.0 - clamp( dot( Tg, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.0, 1.0 ) );
  } else {
    nf = nightFloorShape( dir.y, tl );
  }
  L += uNightSky * uOutScale * nf;
#ifdef MILKY_WAY
  L += uMilkyWay * uOutScale * milkyWay( dir ) * Tv * above;
#endif

  // aureoles (narrow forward-scattering peak of large aerosols, finer than the LUT can hold)
  float cs = dot( dir, uSunDir );
  float cm = dot( dir, uMoonDir );
  L += ( uSunAureole * hgPhase( cs, 0.99 ) + uMoonAureole * hgPhase( cm, 0.99 ) ) * uOutScale * above;

#ifdef CLOUDS
  vec4 cl = cirrus( dir );
  L = mix( L, cl.rgb * uOutScale + L * 0.35, cl.a );
#endif

#ifdef ENV_PASS
  // below the horizon the probe sees the bright stone of the courts, not the distant hills
  L = mix( L, uLocalGround * uOutScale, smoothstep( -0.02, -0.25, dir.y ) );
  // just above it, the courts' walls and colonnades: sunlit where they face the key light (lighting-polish:
  // gold reflecting the bare horizon sky read olive; stone surroundings keep it golden)
  if ( uWallShade.w > 0.0 ) {
    vec2 h = dir.xz;
    float hl = length( h ), kl = length( uWallKey.xz );
    float facing = ( hl > 1e-4 && kl > 1e-4 ) ? max( - dot( h / hl, uWallKey.xz / kl ), 0.0 ) : 0.0;
    vec3 Lw = ( uWallShade.rgb + uWallLit * facing ) * uOutScale;
    float band = smoothstep( uWallShade.w + 0.03, uWallShade.w - 0.03, dir.y ) * smoothstep( -0.04, -0.005, dir.y );
    L = mix( L, Lw, band );
  }
#else
  // Sun disc with limb darkening (u = 0.6), flattened vertically by refraction near the horizon
  vec3 upS = vec3( 0.0, 1.0, 0.0 ) - uSunDir * uSunDir.y;
  upS = dot( upS, upS ) > 1e-8 ? normalize( upS ) : vec3( 0.0, 0.0, -1.0 );
  vec3 qS = dir - uSunDir * cs;
  float qv = dot( qS, upS ) / uSunFlat;
  float rS = sqrt( max( dot( qS, qS ) - dot( qS, upS ) * dot( qS, upS ), 0.0 ) + qv * qv ); // ≈ angle (rad)
  float sinRS = sqrt( max( 1.0 - uSunCos * uSunCos, 1e-12 ) );
  float fwS = max( fwidth( rS ), 1e-6 );
  float covS = smoothstep( sinRS + fwS, sinRS - fwS, rS ) * step( 0.0, cs );
  if ( covS > 0.0 ) {
    float x2 = clamp( rS * rS / ( sinRS * sinRS ), 0.0, 1.0 );
    float limb = 1.0 - 0.6 * ( 1.0 - sqrt( 1.0 - x2 ) );
    vec3 Ls = uSunRadiance * uOutScale * uSunDiscScale * Tv * limb;
    // logarithmic shoulder above the cap: the brighter top of a low Sun stays brighter than its reddened
    // lower limb without clipping to white
    float mc = max( Ls.r, max( Ls.g, Ls.b ) );
    if ( mc > uSunDiscCap ) Ls *= uSunDiscCap * ( 1.0 + log( mc / uSunDiscCap ) ) / mc;
    L += Ls * covS * above * planetShadow( uObsR, dir.y );
  }
  // Moon disc: Lommel-Seeliger shading from the real Sun direction (phase & terminator come out right),
  // maria albedo, earthshine on the night side.
  float fwM = max( fwidth( cm ), 1e-6 );
  float covM = smoothstep( uMoonCos - fwM, uMoonCos + fwM, cm );
  if ( covM > 0.0 ) {
    float sinR = sqrt( max( 1.0 - uMoonCos * uMoonCos, 1e-10 ) );
    vec3 q = dir - uMoonDir * cm;
    float ql = length( q );
    float x = clamp( ql / sinR, 0.0, 1.0 );
    vec3 qn = ql > 1e-9 ? q / ql : uMoonNorth;
    float muV = sqrt( max( 1.0 - x * x, 0.0 ) );
    vec3 n = - uMoonDir * muV + qn * x;
    float mu0 = dot( n, uSunDir );
    float ls = mu0 > 0.0 ? mu0 / ( mu0 + muV + 1e-4 ) : 0.0;
    vec3 east = cross( uMoonDir, uMoonNorth );
    float lat = degrees( asin( clamp( dot( n, uMoonNorth ), -1.0, 1.0 ) ) );
    float lon = degrees( atan( dot( n, east ), dot( n, - uMoonDir ) ) );
    float alb = moonAlbedo( lat, lon );
    vec3 Lm = ( uMoonRadiance * ls + uEarthshine * muV ) * alb * uOutScale;
    // the Moon lies beyond the air: the in-scattered sky light in front of it adds on top
    L += Lm * Tv * covM * above;
  }
#endif
  gl_FragColor = vec4( clamp( L, vec3( 0.0 ), vec3( 6.0e4 ) ), 1.0 );
#ifndef ENV_PASS
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <dithering_fragment>
#endif
}
`;

/** Uniform set shared by the visible dome and the env-cube sky. */
export function createSkyUniforms() {
  return {
    uRayleighScat: { value: new Vector3() },
    uRayleighH: { value: 8 },
    uMieScat: { value: new Vector3() },
    uMieExt: { value: new Vector3() },
    uMieH: { value: 1.2 },
    uMieG: { value: 0.76 },
    uOzoneAbs: { value: new Vector3() },
    uGroundAlbedo: { value: new Vector3(0.3, 0.3, 0.3) },
    uTransmittance: { value: null },
    uSkyLUT: { value: null },
    uLutScale: { value: 1 },
    uOutScale: { value: 1 },
    uObsR: { value: 6360.75 },
    uSunDir: { value: new Vector3(0, 1, 0) },
    uSunRadiance: { value: new Vector3() },
    uSunCos: { value: Math.cos(0.2666 * Math.PI / 180) },
    uSunAureole: { value: new Vector3() },
    uSunDiscScale: { value: 1 },
    uSunDiscCap: { value: 6e4 },
    uSunFlat: { value: 1 },
    uMoonDir: { value: new Vector3(0, -1, 0) },
    uMoonNorth: { value: new Vector3(0, 0, -1) },
    uMoonRadiance: { value: new Vector3() },
    uEarthshine: { value: new Vector3() },
    uMoonCos: { value: Math.cos(0.26 * Math.PI / 180) },
    uMoonAureole: { value: new Vector3() },
    uNightSky: { value: new Vector3() },
    uMilkyWay: { value: new Vector3() },
    uWorldToGal: { value: new Matrix3() },
    uCloudParams: { value: new Vector3(0, 0, 0) },
    uWind: { value: new Vector2(0.9, 0.25) }, // km per sim-minute (~15 m/s from the west-southwest)
    uCloudSky: { value: new Vector3() },
    uCloudSun: { value: new Vector3() },
    uLocalGround: { value: new Vector3() },
    uWallShade: { value: new Vector4() },
    uWallLit: { value: new Vector3() },
    uWallKey: { value: new Vector3(0, 1, 0) },
  };
}

/**
 * opts: { envPass, milkyWay, clouds, mwOctaves, cloudOctaves }. Uniform objects are shared, so one update
 * drives both materials; the env material overrides uLutScale/uOutScale with its own copies.
 */
export function skyDefines(opts = {}) {
  const defines = {};
  if (opts.envPass) defines.ENV_PASS = '';
  if (opts.milkyWay) { defines.MILKY_WAY = ''; defines.MW_OCT = opts.mwOctaves || 4; }
  if (opts.clouds) { defines.CLOUDS = ''; defines.CLOUD_OCT = opts.cloudOctaves || 4; }
  return defines;
}

/** Runtime quality change: new feature defines on an existing sky material (recompiles on next use). */
export function setSkyFeatures(material, opts = {}) {
  const d = skyDefines({ ...opts, envPass: !!material.defines?.ENV_PASS });
  const a = JSON.stringify(material.defines || {}), b = JSON.stringify(d);
  if (a === b) return;
  material.defines = d;
  material.needsUpdate = true;
}

export function createSkyMaterial(uniforms, opts = {}) {
  const defines = skyDefines(opts);
  const u = { ...uniforms };
  if (opts.envPass) {
    u.uLutScale = { value: 1 };
    u.uOutScale = { value: 1 };
  }
  const m = new ShaderMaterial({
    name: opts.envPass ? 'env.skyEnvPass' : 'env.sky',
    uniforms: u,
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    defines,
    side: BackSide,
    depthWrite: false,
    depthTest: !opts.envPass,
    fog: false,
    toneMapped: !opts.envPass,
  });
  m.dithering = !opts.envPass;
  return m;
}


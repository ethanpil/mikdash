// Fair-weather clouds (sky-smoke-fire): a few small cumulus at ≈ 1.8–2.6 km and thin cirrus at ≈ 9 km, drawn by the sky
// dome only (never in front of the world: the dome is the last opaque draw, on the far plane), lit by the Sun's and the
// Moon's actual direction and colour at the cloud (the transmittance LUT), dimmed and hazed by the air in front of them.
//
// Cost: the field is a 1024² RGBA8 tile baked once on the CPU in a Worker (clouds-core.js, ≈ 1–1.5 s off the main thread,
// started before the world build); the dome reads it: the cirrus layer, a detail and a sun-ward fetch, the cumulus layer
// marched in 3 slices overhead to 16 (low) / 24 near the horizon, two transmittance-LUT fetches — no noise in ALU, no
// derivative in flow control (ANGLE/D3D11). Every tier draws the same clouds (the old procedural cirrus of high / ultra is
// replaced). The stars read the cover once per star in their vertex shader. No new program: the dome and the stars change
// their own.
//
// Determinism: a pure function of the sim's absolute time and date — the drift is the wind × the minutes since the epoch
// (time.ms), wrapped to the tile in double precision on the CPU; the date picks the field's offset and its coverage (some
// days clear); the cumulus coverage follows the day's heating (they build by midday, thin by night).
//
// Lighting of the courts is unchanged: the clouds are in neither the environment map's sky (ENV_PASS) nor the probe
// captures, the exposure meter reads the clear-sky LUT, and they cast no shadow on the ground.
import { DataTexture, RGBAFormat, UnsignedByteType, RepeatWrapping, LinearFilter, LinearMipmapLinearFilter, Vector3, Vector4, MathUtils } from 'three';
import { bakeClouds } from './clouds-core.js';

export const CLOUD_SIZE = 1024;
const MAX_SLICES = 24; // the loop's static bound (CLOUD_SLICES, per tier, caps it)
const CU_TILE = 110;    // km: the cumulus tile (billows ≈ 4.6 km, clouds ≈ 1.5–3 km across)
const CI_TILE = 160;    // km: the cirrus tile (strokes ≈ 27 × 4 km)
const CU_BASE = 1.8, CU_TOP = 2.6, CI_ALT = 9.0; // km above sea level (the observer is at ATMO.observerAltitude)
// winds (km per minute, world x east, z south): low-level west-south-westerly ≈ 5 m/s; the upper westerlies ≈ 20 m/s ⚙
const CU_WIND = [0.28, -0.08], CI_WIND = [1.15, -0.2];
const CI_ROT_DEG = 35, CI_ROT = (CI_ROT_DEG * Math.PI) / 180; // the cirrus tile's turn (CLOUD_UNIFORMS_GLSL)
const rotCi = (x, z) => [Math.cos(CI_ROT) * x - Math.sin(CI_ROT) * z, Math.sin(CI_ROT) * x + Math.cos(CI_ROT) * z];
// seasonal chance of a day with cumulus, and how many (share of the layer) ⚙ — Jerusalem: dry summers (June–September
// cloudless), fair-weather cumulus and passing cloud from the early rains (yoreh, Cheshvan) through the winter; never
// overcast here (no rain is drawn)
const CU_CHANCE = [0.6, 0.6, 0.55, 0.45, 0.25, 0.04, 0, 0, 0.06, 0.3, 0.6, 0.6];
const CU_AMOUNT = [0.06, 0.16];
// the season's least cirrus cover (gate-env-render: high cloud ahead of the early-rain fronts; summer clear)
export const CIRRUS_FLOOR = [0.3, 0.28, 0.24, 0.16, 0.06, 0, 0, 0, 0, 0.15, 0.28, 0.3];

function hash01(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return ((h >>> 0) % 100000) / 100000;
}
const smooth = (a, b, x) => { const t = MathUtils.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ------------------------------------------------------------------------------------------------ GLSL
// Uniforms shared by the dome and the stars. Radii relative to the observer (km above it); offsets in tile units.
export const CLOUD_UNIFORMS_GLSL = /* glsl */`
uniform sampler2D uCloudTex;
uniform vec4 uCuUV;    // xy cumulus offset (tile), z 1 / tile (1/km), w coverage
uniform vec4 uCiUV;    // xy cirrus offset (tile),  z 1 / tile (1/km), w coverage
uniform vec4 uCloudH;  // x base, y top of the cumulus layer, z cirrus — km above the observer; w master opacity (0 = none)
// the cirrus field turned ${CI_ROT_DEG}° from the world's axes: its fibres run from the WNW, oblique to the Temple's east–west
// axis (aligned with it, the opening frame looking west saw them converge on the vanishing point like searchlight beams)
const mat2 MK_CI_ROT = mat2( ${Math.cos(CI_ROT).toFixed(6)}, ${Math.sin(CI_ROT).toFixed(6)}, ${(-Math.sin(CI_ROT)).toFixed(6)}, ${Math.cos(CI_ROT).toFixed(6)} );
float mkShellDist( float r0, float mu, float dh ) { float b = r0 * mu; return - b + sqrt( b * b + dh * ( 2.0 * r0 + dh ) ); }
`;

// The cover a point of light behind the clouds (a star) sees: explicit LOD (vertex shaders have no derivatives)
export const CLOUD_COVER_GLSL = /* glsl */`
float mkCloudCover( vec3 dir, float r0 ) {
  float mu = max( dir.y, 0.0 );
  vec2 uvB = dir.xz * mkShellDist( r0, mu, uCloudH.x ) * uCuUV.z + uCuUV.xy;
  vec2 uvC = MK_CI_ROT * dir.xz * mkShellDist( r0, mu, uCloudH.z ) * uCiUV.z + uCiUV.xy;
  vec4 cB = textureLod( uCloudTex, uvB, 2.0 ), cC = textureLod( uCloudTex, uvC, 2.0 );
  float cov = clamp( uCuUV.w * ( 0.2 + 1.0 * cC.b ), 0.0, 0.4 );
  float aB = smoothstep( 1.0 - cov, 1.0 - cov + 0.06, cB.r );
  float aC = 0.6 * smoothstep( 1.0 - uCiUV.w, 1.0 - uCiUV.w + 0.3, cC.g );
  return uCloudH.w * ( 1.0 - ( 1.0 - aB ) * ( 1.0 - aC ) ) * smoothstep( 0.0, 0.05, dir.y );
}
`;

// The dome. Needs ATMO_GLSL (transmittanceUV, planetShadow), hgPhase, uTransmittance, uObsR, uSunDir, uMoonDir.
// mkClouds composites the two layers over the sky radiance L (scene units) and returns the transmittance a disc behind
// them keeps. Two cumulus paths, chosen by the tier's flags (env/index.js):
//   CLOUD_MARCH  (high / ultra) the layer marched in slices along the ray: domes with height near the horizon;
//   otherwise    (the weak tiers: low / medium, the HD 4600's) a flat layer, loop-free: two fetches (the point and one
//                0.45 km toward the key light) shaded from the bake's smooth mass channel — three cloud fetches a sky pixel
//                in all with the cirrus, no LUT fetch (the light at each layer is a CPU uniform).
export const CLOUD_GLSL = /* glsl */`
${CLOUD_UNIFORMS_GLSL}
uniform vec3 uCuSig;     // mean extinction (1/km) of the air between the observer and the cumulus layer
uniform vec3 uCiSig;     // …and the cirrus layer
uniform vec3 uCloudSunE; // the Sun's beam at the top of the atmosphere (lx, physical)
uniform vec3 uCuSunE;    // the Sun's beam at the cumulus layer (its air path and the Earth's shadow included; lx, physical)
uniform vec3 uCiSunE;    // …at the cirrus layer
uniform vec3 uCloudMoonE;// the Moon's beam at the cloud (lx, physical, its own air path included)
uniform vec3 uCloudAmb;  // sky radiance reaching a cloud from around (Esky / π, physical)
uniform vec3 uCloudGnd;  // the lit ground below it (radiance, physical)
uniform vec3 uCloudKey;  // the light that models the clouds (the Sun by day, the Moon at night), world direction
float mkCloudSide( vec3 dir, vec3 L ) {
  // 1 when the viewer looks away from the light (sees the cloud's lit side), 0 toward it (the shaded side)
  vec2 a = dir.xz, b = L.xz;
  float la = length( a ), lb = length( b );
  return la > 1e-4 && lb > 1e-4 ? 0.5 - 0.5 * dot( a / la, b / lb ) : 0.5;
}
#ifndef CLOUD_SLICES
#define CLOUD_SLICES 16
#endif
float mkClouds( vec3 dir, vec3 Tfull, float outScale, inout vec3 L ) {
  float r0 = uObsR;
  float mu = max( dir.y, 0.0 );
  float tB = mkShellDist( r0, mu, uCloudH.x ), tT = mkShellDist( r0, mu, uCloudH.y ), tC = mkShellDist( r0, mu, uCloudH.z );
  float tm = mix( tB, tT, 0.35 );
  // the fetches first, outside any flow control (implicit derivatives: ANGLE/D3D11)
  vec4 cC = texture( uCloudTex, MK_CI_ROT * dir.xz * tC * uCiUV.z + uCiUV.xy );
  // 0.45 km toward the key light (horizontally), at the layer's middle: the cloud mass there shades this point
  vec2 kh = uCloudKey.xz;
  vec2 sh = kh / max( length( kh ), 1e-3 ) * 0.45;
  vec2 uv0 = dir.xz * tm * uCuUV.z + uCuUV.xy;
  vec4 cS = texture( uCloudTex, uv0 + sh * uCuUV.z );
#ifndef CLOUD_MARCH
  vec4 c0 = texture( uCloudTex, uv0 );
  float fw0 = fwidth( c0.r );
#endif
  vec3 Lsky = L;
  float fade = uCloudH.w * smoothstep( 0.04, 0.12, dir.y );
  float cs = dot( dir, uSunDir ), cm = dot( dir, uMoonDir );
  float fwd = min( hgPhase( cs, 0.6 ) * 4.0 * PI, 8.0 );
  float litM = 0.3 + 0.45 * mkCloudSide( dir, uMoonDir ) + 0.1 * min( hgPhase( cm, 0.6 ) * 4.0 * PI, 8.0 );

  // ---- cirrus (behind the cumulus): thin, fibrous; forward-scattering ice. (The forward peak capped: by the setting Sun
  // the old cirrus blew out into a white fan.) Thin ice, optical depth ≈ 0.3 at the fibres' cores: moonlit, a faint veil
  float aC = 0.45 * smoothstep( 1.0 - uCiUV.w, 1.0 - uCiUV.w + 0.3, cC.g ) * smoothstep( 0.0, 0.03, dir.y ) * uCloudH.w;
  float phC = min( mix( hgPhase( cs, 0.75 ), hgPhase( cs, -0.2 ), 0.35 ) * 4.0 * PI, 2.2 );
  float phM = min( mix( hgPhase( cm, 0.75 ), hgPhase( cm, -0.2 ), 0.35 ) * 4.0 * PI, 3.0 );
  vec3 Lci = uCiSunE * phC * 0.05 + uCloudMoonE * phM * 0.02 + uCloudAmb * 0.85;
  vec3 TfC = exp( - uCiSig * tC );
  vec3 frontC = clamp( ( 1.0 - TfC ) / max( 1.0 - Tfull, vec3( 1e-3 ) ), 0.0, 1.0 );
  L = mix( L, Lci * outScale * TfC + Lsky * frontC, aC );

  // ---- cumulus. The weather mask (on the cirrus tile) thickens or thins the fields. Seen from below (high up the sky) a
  // cumulus shows its flat base: grey, its thin margins brighter; seen far off (low) its sides and cauliflower tops: white
  // on the side facing the Sun, grey on the far side. A Sun near the cloud's horizon lights the bases from the side (the
  // warm undersides at dawn and dusk)
  float cov = clamp( uCuUV.w * ( 0.2 + 1.0 * cC.b ), 0.0, 0.4 );
  float thr = 1.0 - cov;
  float muS = uCloudKey.y;
  float low = smoothstep( 0.16, 0.0, muS );
  float under = smoothstep( 0.22, 0.7, mu );
  float away = mix( mkCloudSide( dir, uCloudKey ), 0.7, muS * muS );
  float massS = clamp( ( cS.a - thr ) / max( cov, 0.03 ), 0.0, 1.0 );
#ifdef CLOUD_MARCH
  // slices along the ray through the layer, front to back: a dome's cross-section narrows with height (the threshold rises
  // with z), so a distant cumulus shows a flat base and a rounded top. n ≈ 3 / tan e slices (3 from ≈ 45° up, the cap by
  // 7–10°); explicit LODs (no derivative inside flow control: ANGLE/D3D11), the LOD from the pixel's footprint at the slice;
  // the slices' heights jittered per pixel by a white hash (a structured dither showed as combed streaks)
  float pa = length( dFdx( dir ) ) + length( dFdy( dir ) );
  int n = uCuUV.w > 0.0 ? int( clamp( ceil( 3.0 * sqrt( max( 1.0 - mu * mu, 0.0 ) ) / max( mu, 0.04 ) ), 3.0, float( CLOUD_SLICES ) ) ) : 0;
  float jit = ( fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ) - 0.5 ) * 0.5;
  float texKm = 1.0 / ( uCuUV.z * ${'${CLOUD_TEX_SIZE}'} );
  float span = 0.6 * cov;
  float T = 1.0, sumLit = 0.0, sumZ = 0.0, sumA = 0.0;
  for ( int k = 0; k < ${MAX_SLICES}; k ++ ) {
    if ( k >= n ) break;
    float z = clamp( ( float( k ) + 0.5 + jit ) / float( n ), 0.0, 1.0 );
    float tk = mix( tB, tT, z );
    float lod = log2( max( tk * pa / texKm, 1.0 ) );
    vec4 c = textureLod( uCloudTex, dir.xz * tk * uCuUV.z + uCuUV.xy, lod );
    float th = thr + span * z * sqrt( z );
    float d = smoothstep( th, th + 0.06, c.r );
    float core = smoothstep( th, th + 0.2 * cov + 0.02, c.a );
    float a = d * mix( 0.7, 1.0, core );
    float relief = clamp( ( c.r - c.a ) / max( cov, 0.03 ) * 3.0, -1.0, 1.0 );
    float sideLit = ( mix( 0.3, 1.1, away ) + 0.35 * relief ) * mix( 1.0, 0.4, massS * ( 1.0 - z ) ) * mix( 1.0, 0.85, low );
    float baseLit = mix( 0.1 + 0.3 * ( 1.0 - core ), 0.35 + 0.55 * away, low );
    float lit = mix( sideLit, baseLit, under * ( 1.0 - z ) ) + 0.15 * fwd * ( 1.0 - core );
    float w = T * a;
    sumLit += w * lit; sumZ += w * z; sumA += w;
    T *= 1.0 - a;
  }
  float aCu = ( 1.0 - T ) * fade;
  float lit = sumLit / max( sumA, 1e-4 ), zs = sumZ / max( sumA, 1e-4 ), baseShare = under * ( 1.0 - zs );
  vec3 PM = dir * tm; PM.y += r0;
  float rM = length( PM );
  float muSM = dot( PM / rM, uSunDir );
  vec3 Es = uCloudSunE * textureLod( uTransmittance, transmittanceUV( rM, muSM ), 0.0 ).rgb * planetShadow( rM, muSM );
#else
  // the flat layer: R is the domes' height (with their lobes), A its smooth mass (bake: clouds-core.js). The edge as sharp as
  // the pixel allows (soft by the field's own footprint, never smeared); the mass toward the light shades the far side; the
  // relief R − A lights the lobes on the tops
  float e = clamp( 1.5 * fw0, 0.012, 0.08 );
  float d = smoothstep( thr, thr + e + 0.015, c0.r );
  float mass = clamp( ( c0.a - thr ) / max( cov, 0.03 ), 0.0, 1.0 );
  float core = smoothstep( thr, thr + 0.35 * cov + 0.02, c0.r );
  float relief = clamp( ( c0.r - c0.a ) / max( cov, 0.03 ) * 3.0, -1.0, 1.0 );
  // the light's side: mass rising toward the light hides it (the far side), falling away leaves this point lit
  float sunFace = clamp( 0.65 - 1.8 * ( massS - mass ), 0.0, 1.0 );
  float sideLit = ( mix( 0.25, 1.1, sunFace ) * mix( 0.75, 1.0, away ) + 0.35 * relief * sunFace ) * mix( 1.0, 0.85, low );
  float baseLit = mix( 0.1 + 0.35 * ( 1.0 - mass ), 0.3 + 0.55 * sunFace, low );
  float lit = mix( sideLit, baseLit, under ) + 0.15 * fwd * ( 1.0 - core );
  float aCu = d * mix( 0.72, 1.0, core ) * fade;
  float baseShare = under;
  vec3 Es = uCuSunE;
#endif
  // albedo of the visible face ≈ 0.8; the ambient: the sky round it, and the lit ground below (bases see the ground)
  vec3 amb = uCloudAmb * mix( 0.85, 0.6, baseShare ) + uCloudGnd * mix( 0.2, 0.6, baseShare );
  vec3 Lcu = 0.8 * 0.3183 * ( Es * max( lit, 0.0 ) + uCloudMoonE * litM * step( 0.0, uMoonDir.y ) ) + amb;
  vec3 Tf = exp( - uCuSig * tm );
  vec3 front = clamp( ( 1.0 - Tf ) / max( 1.0 - Tfull, vec3( 1e-3 ) ), 0.0, 1.0 );
  L = mix( L, Lcu * outScale * Tf + Lsky * front, aCu );
  // what a disc behind keeps (the cirrus is thin ice: the Sun shines through it, dimmed)
  return ( 1.0 - aCu ) * ( 1.0 - 0.6 * aC );
}
`;

// ------------------------------------------------------------------------------------------------ CPU side
export function createCloudUniforms() {
  return {
    uCloudTex: { value: null },
    uCuUV: { value: new Vector4(0, 0, 1 / CU_TILE, 0) },
    uCiUV: { value: new Vector4(0, 0, 1 / CI_TILE, 0) },
    uCloudH: { value: new Vector4(1, 2, 8, 0) },
    uCuSig: { value: new Vector3() },
    uCiSig: { value: new Vector3() },
    uCloudSunE: { value: new Vector3() },
    uCloudMoonE: { value: new Vector3() },
    uCloudAmb: { value: new Vector3() },
    uCloudGnd: { value: new Vector3() },
  };
}

let bake = null; // { promise, data }
/** start the bake (env prewarm, before the world build: the Worker runs beside it). Idempotent. */
export function startCloudBake() {
  if (bake) return bake.promise;
  bake = { data: null };
  bake.promise = new Promise((resolve) => {
    const done = (d) => { bake.data = d; resolve(d); };
    let worker = null;
    try { worker = new Worker(new URL('./clouds.worker.js', import.meta.url), { type: 'module', name: 'mikdash-clouds' }); } catch { worker = null; }
    if (!worker) { setTimeout(() => done(bakeClouds(CLOUD_SIZE)), 0); return; }
    worker.onmessage = (e) => { done(e.data?.data || null); worker.terminate(); };
    worker.onerror = () => { worker.terminate(); setTimeout(() => done(bakeClouds(CLOUD_SIZE)), 0); };
    worker.postMessage({ size: CLOUD_SIZE });
  });
  return bake.promise;
}

/**
 * The cloud state: the texture (a 1 × 1 empty one until the bake lands, then faded in), and the per-frame uniforms.
 * opts: { ATMO, mie } from env (the extinction of the air in front of each layer).
 */
export function createClouds(ctx, U, { ATMO, mie }) {
  const empty = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat, UnsignedByteType);
  empty.needsUpdate = true;
  U.uCloudTex.value = empty;
  let tex = null, shownAt = -1, data = null;
  const out = { sunT: 1 };
  const p = ctx.params?.raw;
  const urlCu = parseFloat(p?.get?.('cumulus')), urlCi = parseFloat(p?.get?.('cirrus'));
  const off = p?.get?.('clouds') === '0';
  const land = (d) => {
    if (!d || tex) return;
    data = d;
    tex = new DataTexture(d, CLOUD_SIZE, CLOUD_SIZE, RGBAFormat, UnsignedByteType);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = Math.min(8, ctx.renderer?.capabilities?.getMaxAnisotropy?.() || 1);
    tex.name = 'env.clouds';
    tex.needsUpdate = true;
    U.uCloudTex.value = tex;
    empty.dispose();
  };
  const ready = startCloudBake().then(land);

  // the mean extinction of the air between the observer and a layer (exponential atmosphere, straight path): the path
  // length × the mean of σ(h) over the heights it crosses — the same for every elevation (flat-earth slant), 1/km
  const h0 = ATMO.observerAltitude;
  const sigma = (h1, out) => {
    const mean = (H) => (H * (Math.exp(-h0 / H) - Math.exp(-h1 / H))) / (h1 - h0);
    const r = mean(ATMO.rayleighHeight), m = mean(ATMO.mieHeight);
    out.set(ATMO.rayleighScattering[0] * r + mie.ext[0] * m, ATMO.rayleighScattering[1] * r + mie.ext[1] * m, ATMO.rayleighScattering[2] * r + mie.ext[2] * m);
  };
  sigma((CU_BASE + CU_TOP) / 2, U.uCuSig.value);
  sigma(CI_ALT, U.uCiSig.value);
  U.uCloudH.value.set(CU_BASE - h0, CU_TOP - h0, CI_ALT - h0, 0);

  const T = [0, 0, 0];
  let dateKey = '', day = null;
  function dayWeather(time) {
    const ds = time.dateString || '';
    if (ds === dateKey && day) return day;
    dateKey = ds;
    const m = ((time.date?.m ?? 1) - 1 + 12) % 12;
    // ⚙ the salts are chosen so that the default date (2026-11-02, the opening frame) has a few cumulus (15 % by day)
    const hc = hash01(`${ds}#cu7`), ha = hash01(`${ds}#cua8`), hci = hash01(`${ds}#ci`), hfl = hash01(`${ds}#c`);
    const cu = hc < CU_CHANCE[m] ? CU_AMOUNT[0] + (CU_AMOUNT[1] - CU_AMOUNT[0]) * ha : 0;
    // cirrus as before (gate-env-render): the season's floor varied ±25 %, or a per-date draw that can only add to it
    const floor = CIRRUS_FLOOR[m] ?? 0;
    const ci = Math.max(floor * (0.75 + 0.5 * hfl), hci < 0.45 ? 0 : ((hci - 0.45) / 0.55) * 0.5);
    day = { cu, ci, ox: hash01(`${ds}#ox`), oy: hash01(`${ds}#oy`), cx: hash01(`${ds}#cx`), cy: hash01(`${ds}#cy`) };
    return day;
  }

  // the cover toward a direction, on the CPU from the baked tile (as the stars' mkCloudCover): the Sun's for render/'s sun
  // shafts (ultra), which a cumulus over the Sun should dim
  const texel = (u, v, c) => {
    const N = CLOUD_SIZE, x = (u - Math.floor(u)) * N - 0.5, y = (v - Math.floor(v)) * N - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const at = (i, j) => data[((((j % N) + N) % N) * N + (((i % N) + N) % N)) * 4 + c] / 255;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
  function coverToward(dir, r0) {
    if (!data || dir.y <= 0.0) return 0;
    const H = U.uCloudH.value, cu = U.uCuUV.value, ci = U.uCiUV.value;
    const shell = (dh) => { const b = r0 * dir.y; return -b + Math.sqrt(b * b + dh * (2 * r0 + dh)); };
    const tB = shell(H.x), tC = shell(H.z);
    const [rx, rz] = rotCi(dir.x * tC, dir.z * tC);
    const wx = texel(rx * ci.z + ci.x, rz * ci.z + ci.y, 2), g = texel(rx * ci.z + ci.x, rz * ci.z + ci.y, 1);
    const cov = MathUtils.clamp(cu.w * (0.2 + 1.0 * wx), 0, 0.4);
    const ss = (e0, e1, x) => { const t = MathUtils.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
    const h = texel(dir.x * tB * cu.z + cu.x, dir.z * tB * cu.z + cu.y, 0);
    const aB = cu.w > 0 ? ss(1 - cov, 1 - cov + 0.05, h) : 0;
    const aC = 0.45 * ss(1 - ci.w, 1 - ci.w + 0.3, g);
    return 1 - (1 - aB) * (1 - 0.6 * aC);
  }

  /** per frame: drift, coverage, light at the clouds. st: env's state (sunE0, Tmoon, moon illuminance, Esky, Eg). */
  function update(time, { sunE0, sunDir, moonE, moonDirY, moonColor, sky, ground, transmittanceCPU, obsR }) {
    if (off || !time) { U.uCloudH.value.w = 0; return; }
    const d = dayWeather(time);
    const min = Number.isFinite(time.ms) ? time.ms / 60000 : (time.t || 0);
    const wrap = (x) => x - Math.floor(x);
    U.uCuUV.value.set(wrap(d.ox - (CU_WIND[0] * min) / CU_TILE), wrap(d.oy - (CU_WIND[1] * min) / CU_TILE), 1 / CU_TILE,
      0);
    const cw = rotCi(CI_WIND[0], CI_WIND[1]);
    U.uCiUV.value.set(wrap(d.cx - (cw[0] * min) / CI_TILE), wrap(d.cy - (cw[1] * min) / CI_TILE), 1 / CI_TILE, 0);
    // the cumulus build with the day's heating and thin out by night (fair-weather cumulus are convective) ⚙
    const hr = (((time.t || 0) / 60) % 24 + 24) % 24;
    const diurnal = 0.55 + 0.45 * smooth(8, 13, hr) * (1 - smooth(16, 21, hr));
    const cu = Number.isFinite(urlCu) ? MathUtils.clamp(urlCu, 0, 0.6) : d.cu * diurnal;
    const ci = Number.isFinite(urlCi) ? MathUtils.clamp(urlCi, 0, 1) : Number.isFinite(ctx.env?.cirrus) ? MathUtils.clamp(ctx.env.cirrus, 0, 1) : d.ci;
    U.uCuUV.value.w = cu;
    U.uCiUV.value.w = ci;
    // fade in over 1.5 s once the bake has landed (a late bake does not pop)
    if (tex && shownAt < 0) shownAt = performance.now();
    U.uCloudH.value.w = tex ? (ctx.params?.shot ? 1 : smooth(0, 1500, performance.now() - shownAt)) : 0;
    U.uCloudSunE.value.set(sunE0, sunE0, sunE0);
    // the Moon's beam at the cumulus layer (its slant path from there; the cirrus see nearly the same)
    if (moonE > 0) {
      transmittanceCPU(obsR + (CU_BASE - h0), moonDirY, ATMO, T, 24);
      U.uCloudMoonE.value.set(moonE * T[0] * moonColor[0], moonE * T[1] * moonColor[1], moonE * T[2] * moonColor[2]);
    } else U.uCloudMoonE.value.set(0, 0, 0);
    // sky: irradiance rgb (lx); ground: its lit radiance rgb (cd/m²)
    U.uCloudAmb.value.set(sky[0] / Math.PI, sky[1] / Math.PI, sky[2] / Math.PI);
    U.uCloudGnd.value.set(ground[0], ground[1], ground[2]);
    out.sunT = 1 - U.uCloudH.value.w * coverToward(sunDir, obsR);
  }

  return {
    uniforms: U,
    ready,
    update,
    /** probe captures and other passes that must not see the clouds: run fn with them hidden */
    hidden(fn) { const w = U.uCloudH.value.w; U.uCloudH.value.w = 0; try { return fn(); } finally { U.uCloudH.value.w = w; } },
    get texture() { return tex; },
    /** the share of the Sun's light the clouds let through toward the viewer (1 = clear), for screen-space effects */
    get sunTransmittance() { return out.sunT; },
    get bytes() { return tex ? Math.round(CLOUD_SIZE * CLOUD_SIZE * 4 * 4 / 3) : 0; },
    dispose() { tex?.dispose(); empty.dispose(); },
  };
}

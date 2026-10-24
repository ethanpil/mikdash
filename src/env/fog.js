// Aerial perspective for every built-in material through three's fog chunks.
//
// Three's stock fog is one colour mixed in AFTER tone mapping. We replace the chunks so that fog
//  * is applied in linear HDR before tone mapping (same result with or without the post pipeline),
//  * uses physical extinction (Rayleigh rgb + height-dependent aerosol) along the actual view ray,
//  * takes its in-scattered colour from the sky in that direction (the horizon radiance measured from the sky LUT every
//    refresh at 0, 45, 90, 135 and 180° from the dominant light's azimuth, interpolated geometrically between them).
// It also clamps HDR output to the half-float range (sun glints on gold would otherwise overflow to Inf).
//
// The extra uniforms are not part of any material: they are uploaded directly into every compiled program
// that declares them (FogUniforms.apply). Until a program receives them (its first frame) they are zero, which
// means no fog (never black, never a flash). scene.fog (FogExp2) stays set so USE_FOG is defined and stock-fog
// consumers (FX) get a density equivalent to the physical extinction at Temple distances.
import { ShaderChunk } from 'three';

const ORIGINAL_TONEMAP = ShaderChunk.tonemapping_fragment;
// where the far haze begins, as a fraction of the draw distance (env/index.js passes the distance in mkFogParams.w)
export const HAZE_FROM = 0.55;

const PARS_FRAGMENT = /* glsl */`
#ifdef USE_FOG
  uniform vec3 fogColor;
  varying float vFogDepth;
  varying vec3 vFogOffset;
  #ifdef FOG_EXP2
    uniform float fogDensity;
  #else
    uniform float fogNear;
    uniform float fogFar;
  #endif
  uniform vec3 mkFogA0;      // horizon radiance at 0, 45, 90, 135, 180° from mkFogRefDir's azimuth (output units)
  uniform vec3 mkFogA1;
  uniform vec3 mkFogA2;
  uniform vec3 mkFogA3;
  uniform vec3 mkFogA4;
  uniform vec3 mkFogRefDir;  // direction of the dominant light (world)
  uniform vec3 mkFogExtR;    // Rayleigh extinction, 1/m
  uniform vec4 mkFogParams;  // x aerosol extinction at y=0 (1/m), y 1/aerosol scale height (1/m), z zenith/horizon ratio, w the draw distance (m; 0 off)
  uniform vec4 mkFogSky0;    // the dome's luminance over the horizon band's at −8, −4, −2, −1° (env SKYLINE_ELS) …
  uniform vec4 mkFogSky1;    // … at −0.5, 0, +0.25°; w 1 once set
  // A program that has not received these uniforms yet (its first frame) has them all zero: T = 1, no fog —
  // invisible at Temple distances (≈1 % at 200 m), unlike a stock-fog fallback that flashed distant geometry.
  // transmittance camera -> fragment (Rayleigh rgb + aerosol with its scale height along the real ray);
  // additive emitters (flames, glows) multiply by this alone and #define MK_FOG_DONE before tonemapping
  vec3 mkFogTransmittance() {
    float d = length( vFogOffset );
    float k = mkFogParams.y;
    float dy = vFogOffset.y * k;
    float rho0 = exp( - cameraPosition.y * k );
    float rho = abs( dy ) > 1e-4 ? rho0 * ( 1.0 - exp( - dy ) ) / dy : rho0;
    vec3 T = exp( - ( mkFogExtR + mkFogParams.x * rho ) * d );
    // render-env-2: the world ends at the draw distance (a skirt continues the terrain beyond it, falling away): the
    // haze reaches full density there, so the far ridges dissolve into the horizon sky instead of showing the skirt
    if ( mkFogParams.w > 0.0 ) T *= 1.0 - smoothstep( ${HAZE_FROM.toFixed(2)} * mkFogParams.w, mkFogParams.w, d );
    return T;
  }
  vec3 mkApplyFog( vec3 col ) {
    float d = length( vFogOffset );
    vec3 dir = vFogOffset / max( d, 1e-4 );
    vec3 T = mkFogTransmittance();
    vec2 h = dir.xz;
    float hl = length( h );
    vec2 r = mkFogRefDir.xz;
    float rl = length( r );
    float cphi = ( hl > 1e-4 && rl > 1e-4 ) ? dot( h / hl, r / rl ) : 0.0;
    // qa-r2-fix-env-render: between the measured samples, geometrically (exact at them, never below zero). A 2nd-order
    // Fourier fit of the five rang below zero ≈ 110° from a just-risen Sun, red first: blue-violet far ridges
    float u = min( acos( clamp( cphi, - 1.0, 1.0 ) ) * 1.2732395, 3.9999 );
    vec3 La = u < 1.0 ? mkFogA0 : u < 2.0 ? mkFogA1 : u < 3.0 ? mkFogA2 : mkFogA3;
    vec3 Lb = u < 1.0 ? mkFogA1 : u < 2.0 ? mkFogA2 : u < 3.0 ? mkFogA3 : mkFogA4;
    vec3 Linf = exp( mix( log( max( La, vec3( 1e-12 ) ) ), log( max( Lb, vec3( 1e-12 ) ) ), fract( u ) ) );
    Linf *= mix( 1.0, mkFogParams.z, clamp( dir.y, 0.0, 1.0 ) ); // looking up: thinner, darker air light
    // render-env-2-fix: where the far haze closes over the world's end, its air light follows the dome right there (the
    // sky-view LUT's skyline profile: darker just above and below a far silhouette than the 0.5–3.5° band the Fourier
    // terms fit), so hazed far ridges do not stand out as a pale rim against the sky above them
    if ( mkFogParams.w > 0.0 && mkFogSky1.w > 0.5 && d > ${HAZE_FROM.toFixed(2)} * mkFogParams.w ) {
      float el = degrees( asin( clamp( dir.y, -1.0, 1.0 ) ) );
      vec4 A = mkFogSky0, B = mkFogSky1;
      float r = el < -4.0 ? mix( A.x, A.y, clamp( ( el + 8.0 ) * 0.25, 0.0, 1.0 ) )
        : el < -2.0 ? mix( A.y, A.z, ( el + 4.0 ) * 0.5 )
        : el < -1.0 ? mix( A.z, A.w, el + 2.0 )
        : el < -0.5 ? mix( A.w, B.x, ( el + 1.0 ) * 2.0 )
        : el < 0.0 ? mix( B.x, B.y, ( el + 0.5 ) * 2.0 )
        : el < 0.25 ? mix( B.y, B.z, el * 4.0 )
        : mix( B.z, 1.0, clamp( ( el - 0.25 ) / 1.75, 0.0, 1.0 ) );
      Linf *= mix( 1.0, r, smoothstep( ${HAZE_FROM.toFixed(2)} * mkFogParams.w, mkFogParams.w, d ) );
    }
    #ifdef MK_INT
      // camera and surface in the same roofed room (interiors-glsl.js): the air between them sees the sky only
      // through the room's openings (a view out of the door keeps the full outdoor air light)
      if ( mkVol > 0.5 && abs( mkVol - mkIntP.y ) < 0.5 ) Linf *= mkV;
    #endif
    return col * T + Linf * ( 1.0 - T );
  }
#endif
`;

export function installFogChunks() {
  if (ShaderChunk.__mkFog) return;
  ShaderChunk.__mkFog = true;
  ShaderChunk.fog_pars_vertex = /* glsl */`
#ifdef USE_FOG
  varying float vFogDepth;
  varying vec3 vFogOffset;
#endif
`;
  ShaderChunk.fog_vertex = /* glsl */`
#ifdef USE_FOG
  vFogDepth = - mvPosition.z;
  vFogOffset = ( vec4( mvPosition.xyz, 0.0 ) * viewMatrix ).xyz; // camera -> vertex, world axes
#endif
`;
  ShaderChunk.fog_pars_fragment = PARS_FRAGMENT;
  ShaderChunk.fog_fragment = /* glsl */`
#if defined( USE_FOG ) && ! defined( MK_FOG_DONE )
  gl_FragColor.rgb = mkApplyFog( gl_FragColor.rgb );
#endif
`;
  ShaderChunk.tonemapping_fragment = /* glsl */`
#ifdef USE_FOG
  gl_FragColor.rgb = mkApplyFog( gl_FragColor.rgb );
  #define MK_FOG_DONE
#endif
#ifdef MK_INT
  // probe capture gain (env/probes.js): keeps a dark capture (the moonless court captured at a lamp-lit room's
  // exposure) out of the half-float denormals, whose per-channel rounding the PMREM smeared into colour noise
  if ( ( mkFlags & MK_F_CAPTURE ) != 0 ) {
    vec4 q = mkIntQ;
    if ( q.z > 0.0 ) gl_FragColor.rgb *= q.z;
    // a skylit probe's hot texels (render-env-2-fix): luminance clamped, hue kept
    float y = dot( gl_FragColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) );
    if ( q.w > 0.0 && y > q.w ) gl_FragColor.rgb *= q.w / y;
  }
#endif
gl_FragColor.rgb = min( gl_FragColor.rgb, vec3( 6.0e4 ) );
#if defined( MK_INT ) && defined( MK_DEBUG )
  if ( ( mkFlags & MK_F_DEBUG ) != 0 ) gl_FragColor.rgb = mkDebugColor(); // interiors debug view (lighting-polish)
#endif
${ORIGINAL_TONEMAP}`;
}

// mkWBd: white-balance gain − 1 (render/tonemap.js applies it in the direct path's tone mapping; zero = neutral)
const NAMES = ['mkFogA0', 'mkFogA1', 'mkFogA2', 'mkFogA3', 'mkFogA4', 'mkFogRefDir', 'mkFogExtR', 'mkFogParams', 'mkWBd', 'mkFogSky0', 'mkFogSky1'];

/** Uploads the aerial-perspective uniforms into every program that uses them. */
export class FogUniforms {
  constructor(renderer) {
    this.renderer = renderer;
    this.values = {
      mkFogA0: [0, 0, 0], mkFogA1: [0, 0, 0], mkFogA2: [0, 0, 0], mkFogA3: [0, 0, 0], mkFogA4: [0, 0, 0], mkFogRefDir: [0, 1, 0],
      mkFogExtR: [0, 0, 0], mkFogParams: [0, 0, 1, 0], mkWBd: [0, 0, 0], mkFogSky0: [1, 1, 1, 1], mkFogSky1: [1, 1, 1, 0],
    };
    this.version = 1;
    this.entries = new WeakMap(); // WebGLProgram -> [uniform|null] | null
    this.uploaded = new WeakMap(); // WebGLProgram -> version
    this.count = -1;
  }

  set(name, arr) {
    const v = this.values[name];
    let changed = false;
    for (let i = 0; i < v.length; i++) {
      const a = arr[i];
      if (Math.abs(a - v[i]) > 1e-4 * Math.max(Math.abs(a), Math.abs(v[i]), 1e-30)) changed = true;
    }
    if (changed) { for (let i = 0; i < v.length; i++) v[i] = arr[i]; this.version++; }
  }

  apply() {
    const programs = this.renderer.info.programs;
    if (!programs) return;
    const last = programs[programs.length - 1];
    if (programs.length === this.count && last === this.lastProgram && this.lastVersion === this.version) return;
    const gl = this.renderer.getContext();
    const state = this.renderer.state;
    let bound = false;
    let pending = false;
    for (const p of programs) {
      let e = this.entries.get(p);
      if (e === undefined) {
        if (typeof p.isReady === 'function' && !p.isReady()) { pending = true; continue; }
        const map = p.getUniforms().map;
        e = NAMES.some((n) => map[n]) ? NAMES.map((n) => map[n] || null) : null;
        this.entries.set(p, e);
      }
      if (!e || this.uploaded.get(p) === this.version) continue;
      state.useProgram(p.program);
      bound = true;
      for (let i = 0; i < NAMES.length; i++) if (e[i]) e[i].setValue(gl, this.values[NAMES[i]]);
      this.uploaded.set(p, this.version);
    }
    if (bound) state.useProgram(null);
    this.count = pending ? -1 : programs.length;
    this.lastProgram = last;
    this.lastVersion = this.version;
  }
}

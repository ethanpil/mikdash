// Aerial perspective for every built-in material through three's fog chunks.
//
// Three's stock fog is one colour mixed in AFTER tone mapping. We replace the chunks so that fog
//  * is applied in linear HDR before tone mapping (same result with or without the post pipeline),
//  * uses physical extinction (Rayleigh rgb + height-dependent aerosol) along the actual view ray,
//  * takes its in-scattered colour from the sky in that direction (a 2nd-order Fourier fit of the horizon
//    radiance around the dominant light, measured from the sky LUT every refresh).
// It also clamps HDR output to the half-float range (sun glints on gold would otherwise overflow to Inf).
//
// The extra uniforms are not part of any material: they are uploaded directly into every compiled program
// that declares them (FogUniforms.apply). Until a program receives them (its first frame) they are zero, which
// means no fog (never black, never a flash). scene.fog (FogExp2) stays set so USE_FOG is defined and stock-fog
// consumers (FX) get a density equivalent to the physical extinction at Temple distances.
import { ShaderChunk } from 'three';

const ORIGINAL_TONEMAP = ShaderChunk.tonemapping_fragment;

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
  uniform vec3 mkFogA0;      // horizon radiance Fourier terms (output units)
  uniform vec3 mkFogA1;
  uniform vec3 mkFogA2;
  uniform vec3 mkFogRefDir;  // direction of the dominant light (world)
  uniform vec3 mkFogExtR;    // Rayleigh extinction, 1/m
  uniform vec4 mkFogParams;  // x aerosol extinction at y=0 (1/m), y 1/aerosol scale height (1/m), z zenith/horizon ratio, w unused
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
    return exp( - ( mkFogExtR + mkFogParams.x * rho ) * d );
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
    vec3 Linf = max( mkFogA0 + mkFogA1 * cphi + mkFogA2 * ( 2.0 * cphi * cphi - 1.0 ), vec3( 0.0 ) );
    Linf *= mix( 1.0, mkFogParams.z, clamp( dir.y, 0.0, 1.0 ) ); // looking up: thinner, darker air light
    #ifdef MK_INT
      // camera and surface in the same roofed room (interiors-glsl.js): the air between them sees the sky only
      // through the room's openings (a view out of the door keeps the full outdoor air light)
      if ( mkVol > 0.5 && abs( mkVol - mkP.y ) < 0.5 ) Linf *= mkV;
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
  if ( ( mkFlags & MK_F_CAPTURE ) != 0 ) gl_FragColor.rgb *= mkIntQ.z;
#endif
gl_FragColor.rgb = min( gl_FragColor.rgb, vec3( 6.0e4 ) );
#ifdef MK_INT
  if ( ( mkFlags & MK_F_DEBUG ) != 0 ) gl_FragColor.rgb = mkDebugColor(); // interiors debug view (lighting-polish)
#endif
${ORIGINAL_TONEMAP}`;
}

// mkWBd: white-balance gain − 1 (render/tonemap.js applies it in the direct path's tone mapping; zero = neutral)
const NAMES = ['mkFogA0', 'mkFogA1', 'mkFogA2', 'mkFogRefDir', 'mkFogExtR', 'mkFogParams', 'mkWBd'];

/** Uploads the aerial-perspective uniforms into every program that uses them. */
export class FogUniforms {
  constructor(renderer) {
    this.renderer = renderer;
    this.values = {
      mkFogA0: [0, 0, 0], mkFogA1: [0, 0, 0], mkFogA2: [0, 0, 0], mkFogRefDir: [0, 1, 0],
      mkFogExtR: [0, 0, 0], mkFogParams: [0, 0, 1, 0], mkWBd: [0, 0, 0],
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

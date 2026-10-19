// Custom post effects for the post tiers (loaded with post.js, i.e. never on the low tier).
//
//  SkyMaskedBloom  — BloomEffect whose prefilter ignores the sky (scene depth at the far plane) except a small
//                    disc around the key light (sun by day, moon by night), uses a continuous soft-knee
//                    "energy above threshold" curve and clamps its output, so no iso-luminance plateau can form.
//                    env's analytic aureole already carries the sky glare around the sun.
//  SunShaftsEffect — screen-space crepuscular rays: a light mask built from the SKY (depth == far) near the sun,
//                    radially blurred toward the sun and ADDED (scene-linear HDR light).
// Both read the composer's stable scene-depth texture (setDepthTexture).
import { ShaderMaterial, NoBlending, Uniform, Vector2, Vector3, WebGLRenderTarget, HalfFloatType } from 'three';
import { BloomEffect, Effect, BlendFunction, ShaderPass, Resolution } from 'postprocessing';

const FULLSCREEN_VS = /* glsl */`
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }`;

// cleared depth (sky, drawn at the far plane without depth writes) is exactly 1.0; geometry at 8990 m of a
// 9000 m far plane is still < 1 - 1e-6
const SKY_TEST = 'float isSky(float d) { return step(0.99999994, d); }';

// ------------------------------------------------------------------ bloom prefilter
const PREFILTER_FS = /* glsl */`
#include <common>
#ifdef FRAMEBUFFER_PRECISION_HIGH
uniform mediump sampler2D inputBuffer;
#else
uniform lowp sampler2D inputBuffer;
#endif
uniform highp sampler2D depthBuffer;
uniform float threshold;  // scene-linear
uniform float knee;       // soft-knee half width (scene-linear)
uniform float maxLum;     // clamp of the bloom source luminance (scene-linear)
uniform vec3 disc;        // key-light disc: uv.xy, z = 1 when in front of the camera
uniform float discR;      // disc radius, uv-height units
uniform float aspect;
varying vec2 vUv;
${SKY_TEST}
void main() {
  vec3 c = texture2D(inputBuffer, vUv).rgb;
  float l = luminance(c);
  // sky contributes only inside the key light's own disc (a sun / moon glint), never the bright sky around it
  vec2 dv = (vUv - disc.xy) * vec2(aspect, 1.0);
  float inDisc = disc.z * (1.0 - smoothstep(0.55 * discR, discR, length(dv)));
  float m = mix(1.0, inDisc, isSky(texture2D(depthBuffer, vUv).r));
  // energy above threshold with a quadratic soft knee: continuous from zero, no contour at the threshold
  float s = clamp(l - threshold + knee, 0.0, 2.0 * knee);
  s = s * s / (4.0 * knee + 1e-6);
  float w = m * max(s, l - threshold) / max(l, 1e-6);
  float lo = l * w;
  gl_FragColor = vec4(c * w * min(1.0, maxLum / max(lo, 1e-6)), 1.0);
}`;

class SkyMaskedLuminanceMaterial extends ShaderMaterial {
  constructor() {
    super({
      name: 'SkyMaskedLuminanceMaterial',
      uniforms: {
        inputBuffer: new Uniform(null),
        depthBuffer: new Uniform(null),
        threshold: new Uniform(1),
        knee: new Uniform(0.5),
        maxLum: new Uniform(4),
        disc: new Uniform(new Vector3(0.5, 0.5, 0)),
        discR: new Uniform(0.01),
        aspect: new Uniform(1),
      },
      defines: {},
      blending: NoBlending,
      toneMapped: false,
      depthWrite: false,
      depthTest: false,
      vertexShader: FULLSCREEN_VS,
      fragmentShader: PREFILTER_FS,
    });
  }

  /** LuminancePass sets this every frame */
  set inputBuffer(v) { this.uniforms.inputBuffer.value = v; }
}

export class SkyMaskedBloom extends BloomEffect {
  constructor(opts = {}) {
    super({ ...opts, blendFunction: BlendFunction.ADD }); // bloom is added light; SCREEN darkens HDR values >= 1
    this.prefilter = new SkyMaskedLuminanceMaterial();
    const old = this.luminancePass.fullscreenMaterial;
    this.luminancePass.fullscreenMaterial = this.prefilter;
    old.dispose();
  }

  setDepthTexture(depthTexture) { this.prefilter.uniforms.depthBuffer.value = depthTexture; }

  /**
   * @param {number} threshold scene-linear
   * @param {number} knee scene-linear half width
   * @param {number} maxLum scene-linear
   * @param {Vector3} disc uv.xy of the key light, z = 1 if in front
   * @param {number} discR uv-height radius
   * @param {number} aspect
   */
  setPrefilter(threshold, knee, maxLum, disc, discR, aspect) {
    const u = this.prefilter.uniforms;
    u.threshold.value = threshold;
    u.knee.value = Math.max(knee, 1e-6);
    u.maxLum.value = maxLum;
    u.disc.value.copy(disc);
    u.discR.value = discR;
    u.aspect.value = aspect;
  }
}

// ------------------------------------------------------------------ sun shafts
// In-scattered sunlight along each view ray ≈ phase(angle to the sun) × the fraction of the ray's air that sees
// the sun. Screen-space proxy for that fraction: V = how much of the screen path from the pixel toward the sun
// is OPEN — sky, or a horizontal surface below eye level (floors, roofs, distant ground), which never blocks a
// low sun for the air at eye level. Walls, columns and gates close it: their shadows carve darker streaks into
// the glow and the gaps carry beams. Not a sky-brightness blur: that makes the horizon a false occluder (a hard
// shelf of light across every object at horizon height), and treating the ground as a source smears the aureole
// into a blob below the sun.
const MASK_FS = /* glsl */`
#include <packing>
uniform highp sampler2D depthBuffer;
uniform vec3 upView;     // world up, view space
uniform vec2 tanHalf;    // tan(fov/2) x, y
uniform vec2 nearFar;
varying vec2 vUv;
${SKY_TEST}
void main() {
  float d = texture2D(depthBuffer, vUv).r;
  float open = isSky(d);
  if (open < 0.5) {
    vec3 ray = vec3((vUv * 2.0 - 1.0) * tanHalf, -1.0);
    vec3 P = ray * -perspectiveDepthToViewZ(d, nearFar.x, nearFar.y);
    vec3 N = normalize(cross(dFdx(P), dFdy(P)));
    open = smoothstep(0.75, 0.9, abs(dot(N, upView))) * smoothstep(-0.3, -0.6, dot(P, upView));
  }
  gl_FragColor = vec4(open, 0.0, 0.0, 1.0);
}`;

const RADIAL_FS = /* glsl */`
uniform mediump sampler2D inputBuffer;  // openness mask
uniform vec2 sunUv;
uniform vec3 sunView;    // unit vector toward the sun, view space
uniform vec2 tanHalf;
uniform float density;   // fraction of the way to the sun covered by the samples
uniform float decay;
uniform vec3 color;      // scene-linear in-scatter at the sun (× gain)
uniform vec3 phaseK;     // narrow width, broad width (radians), broad weight
varying vec2 vUv;
float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
void main() {
  vec2 delta = (sunUv - vUv) * (density / float(SAMPLES));
  vec2 coord = vUv + delta * ign(gl_FragCoord.xy); // jittered start: noise instead of ghost copies
  float k = 1.0, wsum = 0.0, v = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    v += texture2D(inputBuffer, coord).r * k;
    wsum += k;
    k *= decay;
    coord += delta;
  }
  v /= wsum;
  vec3 ray = normalize(vec3((vUv * 2.0 - 1.0) * tanHalf, -1.0));
  float theta = acos(clamp(dot(ray, sunView), -1.0, 1.0));
  float phase = mix(exp(-theta / phaseK.x), exp(-theta / phaseK.y), phaseK.z);
  gl_FragColor = vec4(color * (phase * v), 1.0);
}`;

const SHAFTS_FS = /* glsl */`
uniform mediump sampler2D map;
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(texture2D(map, uv).rgb, inputColor.a);
}`;

export class SunShaftsEffect extends Effect {
  constructor({ samples = 64, resolutionScale = 0.5, density = 0.97, decay = 0.985 } = {}) {
    super('SunShaftsEffect', SHAFTS_FS, {
      blendFunction: BlendFunction.ADD, // in-scattered light, scene-linear
      uniforms: new Map([['map', new Uniform(null)]]),
    });
    this.rtMask = new WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.rtMask.texture.name = 'SunShafts.Mask';
    this.rtRays = new WebGLRenderTarget(1, 1, { depthBuffer: false });
    this.rtRays.texture.name = 'SunShafts.Rays';
    this.uniforms.get('map').value = this.rtRays.texture;
    const upView = new Uniform(new Vector3(0, 1, 0));
    const tanHalf = new Uniform(new Vector2(1, 1));
    this.maskMaterial = new ShaderMaterial({
      name: 'SunShafts.MaskMaterial',
      uniforms: { depthBuffer: new Uniform(null), upView, tanHalf, nearFar: new Uniform(new Vector2(0.1, 1000)) },
      blending: NoBlending, depthWrite: false, depthTest: false, toneMapped: false,
      vertexShader: FULLSCREEN_VS, fragmentShader: MASK_FS,
    });
    this.radialMaterial = new ShaderMaterial({
      name: 'SunShafts.RadialMaterial',
      defines: { SAMPLES: String(samples | 0) },
      uniforms: {
        inputBuffer: new Uniform(null), sunUv: new Uniform(new Vector2(0.5, 0.5)), sunView: new Uniform(new Vector3(0, 0, -1)),
        tanHalf, density: new Uniform(density), decay: new Uniform(decay), color: new Uniform(new Vector3()),
        phaseK: new Uniform(new Vector3(0.07, 0.35, 0.3)),
      },
      blending: NoBlending, depthWrite: false, depthTest: false, toneMapped: false,
      vertexShader: FULLSCREEN_VS, fragmentShader: RADIAL_FS,
    });
    this.samples = samples;
    this.maskPass = new ShaderPass(this.maskMaterial);
    this.radialPass = new ShaderPass(this.radialMaterial);
    const res = this.resolution = new Resolution(this, Resolution.AUTO_SIZE, Resolution.AUTO_SIZE, resolutionScale);
    res.addEventListener('change', () => this.setSize(res.baseWidth, res.baseHeight));
  }

  get sunUv() { return this.radialMaterial.uniforms.sunUv.value; }

  setDepthTexture(depthTexture) { this.maskMaterial.uniforms.depthBuffer.value = depthTexture; }

  /**
   * @param {object} p
   * @param {Vector3} p.color scene-linear in-scatter colour at the sun (strength included; 0 = off)
   * @param {number} p.narrow narrow phase lobe width (radians)
   * @param {number} p.broad broad phase lobe width (radians)
   * @param {number} p.broadWeight weight of the broad lobe (0..1)
   * @param {Vector3} p.sunView unit vector toward the sun in view space
   * @param {Vector3} p.upView world up in view space
   * @param {Camera} p.camera perspective camera (fov, aspect, near, far)
   */
  setParams({ color, narrow, broad, broadWeight, sunView, upView, camera }) {
    const m = this.maskMaterial.uniforms;
    const r = this.radialMaterial.uniforms;
    r.color.value.copy(color);
    r.phaseK.value.set(narrow, broad, broadWeight);
    r.sunView.value.copy(sunView);
    m.upView.value.copy(upView);
    const ty = Math.tan((camera.fov * Math.PI) / 360);
    m.tanHalf.value.set(ty * camera.aspect, ty);
    m.nearFar.value.set(camera.near, camera.far);
  }

  update(renderer, inputBuffer) {
    this.maskPass.render(renderer, null, this.rtMask);
    this.radialPass.render(renderer, this.rtMask, this.rtRays);
  }

  setSize(width, height) {
    const res = this.resolution;
    res.setBaseSize(width, height);
    this.rtMask.setSize(res.width, res.height);
    this.rtRays.setSize(res.width, res.height);
  }

  initialize(renderer, alpha, frameBufferType) {
    const type = frameBufferType ?? HalfFloatType;
    this.rtMask.texture.type = type;
    this.rtRays.texture.type = type;
  }
}
